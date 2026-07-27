// Tutto il disegno sul canvas. E' l'unico modulo che sa che esiste un canvas:
// il resto del gioco non sa nemmeno di quanti pixel e' fatto lo schermo.
//
// Tre idee tengono insieme il file:
//
// 1. **Si disegna dal lontano al vicino.** Non c'e' nessun controllo di
//    profondita': l'ordine di disegno *e'* la profondita'. Percio' ogni elenco
//    (palazzi, alberi, auto, ostacoli) viene raccolto, ordinato per z
//    decrescente e solo allora passato al pennello.
// 2. **Le figure si disegnano in metri.** `conFigura` piazza l'origine ai
//    piedi del personaggio e ribalta l'asse y, cosi' dentro a quel blocco si
//    ragiona in metri con l'alto verso l'alto, e la stessa funzione serve per
//    l'omino bianco, per i maranza e per chi sta sul monopattino.
// 3. **Ogni volume e' una scatola di tre facce**: il fianco lungo la strada,
//    la testa che guarda la telecamera e il tetto. Bastano a palazzi, auto,
//    tram e cassonetti, e sono la ragione per cui la scena ha spessore invece
//    di sembrare un fondale dipinto.

import {
  proietta,
  davantiAllaCamera,
  xDiCorsia,
  bordoSinistroDiCorsia,
  DISTANZA_CAMERA,
} from './proiezione.js';
import { SEMI_STRADA, LARGHEZZA_CORSIA, DISTANZA_VISIBILE, ALTEZZA_OMINO } from './costanti.js';
import { BUCA, MONOPATTINO, ALTEZZA_LAMPIONE, corsieOstacolo } from './ostacoli.js';
import { MONETA, SCUDO, SCATTO, CALAMITA } from './percorso.js';
import { abbassato } from './corridore.js';
import { minaccia, DISTACCO_INIZIALE } from './inseguitori.js';
import { areaPausa } from './pausa.js';
import {
  creaCitta,
  zRelativo,
  BORDO_STRADA,
  BORDO_MARCIAPIEDE,
  FILO_PALAZZI,
  ROTAIE,
  LATO_TRAM,
  LATO_SOSTA,
  PALAZZO,
  DUOMO,
  GALLERIA,
  VELASCA,
  BOSCO,
} from './citta.js';
import {
  scattoAttivo,
  calamitaAttiva,
  rimastoScatto,
  rimastoCalamita,
  DURATA_SCATTO,
  DURATA_CALAMITA,
  PUNTI_PER_MONETA,
} from './mondo.js';

/** La citta' si genera una volta sola: e' sempre la stessa strada. */
const CITTA = creaCitta();

/** Oltre questa z gli arredi non si disegnano piu': sono dietro la telecamera.
 *  Non si taglia prima, o i lampioni sparirebbero mentre li stai superando. */
const CODA_ARREDI = -DISTANZA_CAMERA + 1.1;

const COLORI = {
  cieloAlto: '#6f9dc8',
  cieloBasso: '#c8d8e2',
  foschia: '#dce6ec',
  asfalto: '#4b4e54',
  asfaltoLontano: '#6b6f76',
  rattoppoChiaro: '#565a61',
  rattoppoScuro: '#42454b',
  tombino: '#3b3e44',
  striscia: '#ddd8c8',
  strisciaConsumata: '#b8b4a6',
  sede: '#565961',
  rotaia: '#8f9198',
  sosta: '#585b62',
  marciapiede: '#a8a29a',
  marciapiedeChiaro: '#b3ada4',
  cordolo: '#8b857d',
  // Le facciate di un viale milanese: ocra, beige, un grigio, un mattone
  // stinto, una crema, un verdino. Se sono troppo simili fra loro la fila di
  // palazzi si legge come un muro solo.
  palazzi: ['#c0ab92', '#a08972', '#d0c4af', '#8e8c89', '#ab8672', '#98a297'],
  testaPalazzo: 'rgba(92,86,78,0.92)',
  tetto: '#7a7269',
  vetrina: '#4c5560',
  tenda: ['#9c4a3c', '#3f6b57', '#4a5f86', '#8a6f2f', '#6a4a6b'],
  balcone: '#c9c3b8',
  albero: ['#4f7a44', '#5f8c4e', '#446b3c'],
  tronco: '#5d5348',
  palo: '#4e5158',
  cavo: 'rgba(40,42,48,0.55)',
  auto: ['#8d3b34', '#2f4a6b', '#6d6f74', '#b0b3b8', '#39463c', '#7a6a52'],
  vetroAuto: '#2f3740',
  tramCorpo: '#e0762f',
  tramFascia: '#f2ece2',
  tramVetro: '#3a444e',
  omino: '#f5f7fa',
  ominoOmbra: '#c2c9d3',
  maranza: '#24262c',
  maranzaLuce: '#474c56',
  coltello: '#ccd3dc',
  buca: '#26282d',
  bucaBordo: '#3c4046',
  bucaFondo: '#1a1c20',
  moneta: '#f0c246',
  monetaScura: '#b58a1f',
  scudo: '#57b0e6',
  scatto: '#f4813c',
  calamita: '#d9534f',
  testo: '#f7f8fa',
};

export function disegnaMondo(ctx, mondo, interfaccia = {}) {
  const vista = mondo.vista;
  ctx.clearRect(0, 0, vista.larghezza, vista.altezza);

  disegnaCielo(ctx, vista, mondo.scorrimento);
  disegnaProfiloLontano(ctx, vista, mondo.scorrimento);
  disegnaStrada(ctx, vista, mondo.scorrimento);
  disegnaCitta(ctx, vista, mondo.scorrimento);
  disegnaLineaAerea(ctx, vista, mondo.scorrimento);
  disegnaPercorso(ctx, mondo);
  disegnaCorridore(ctx, mondo);
  disegnaInseguitori(ctx, mondo);
  disegnaVignetta(ctx, mondo);

  // Il pannello serve solo mentre si gioca: sulle schermate i numeri ci sono
  // gia', piu' grandi, e ripeterli in piccolo e' solo rumore. Il pulsante
  // invece resta anche in pausa, perche' e' quello che fa riprendere.
  if (mondo.stato === 'in-gioco') disegnaHud(ctx, mondo, interfaccia);
  if (mondo.stato === 'in-gioco' || mondo.stato === 'pausa') {
    disegnaPulsantePausa(ctx, mondo, interfaccia);
  }

  if (mondo.stato === 'attesa') disegnaSchermataIniziale(ctx, mondo, interfaccia);
  if (mondo.stato === 'pausa') disegnaSchermataPausa(ctx, mondo, interfaccia);
  if (mondo.stato === 'finita') disegnaSchermataFine(ctx, mondo, interfaccia);
}

// --- attrezzi comuni -------------------------------------------------------

/** Un quadrilatero orizzontale (a quota `y`) fra due z e due x. E' con questo
 *  che si disegna quasi tutto quello che sta per terra. */
function fasciaStrada(ctx, vista, xDa, xA, zVicino, zLontano, y = 0) {
  const a = proietta(vista, xDa, y, zVicino);
  const b = proietta(vista, xA, y, zVicino);
  const c = proietta(vista, xA, y, zLontano);
  const d = proietta(vista, xDa, y, zLontano);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
}

/** Un quadrilatero verticale lungo la strada: il fianco di un palazzo, di
 *  un'auto, di un tram. */
function parete(ctx, vista, x, yBasso, yAlto, zVicino, zLontano) {
  const a = proietta(vista, x, yBasso, zVicino);
  const b = proietta(vista, x, yAlto, zVicino);
  const c = proietta(vista, x, yAlto, zLontano);
  const d = proietta(vista, x, yBasso, zLontano);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
}

/** Un quadrilatero verticale di traverso: la testa di un volume, quella che
 *  guarda la telecamera. Si vede solo finche' il volume e' davanti. */
function testa(ctx, vista, z, xDa, xA, yBasso, yAlto) {
  const a = proietta(vista, xDa, yBasso, z);
  const b = proietta(vista, xDa, yAlto, z);
  const c = proietta(vista, xA, yAlto, z);
  const d = proietta(vista, xA, yBasso, z);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
}

/** Una scatola vista di tre quarti: fianco, testa e tetto. */
function scatola(ctx, vista, opzioni) {
  const { xDentro, xFuori, zVicino, zLontano, yBasso, yAlto, lato, tetto, fronte } = opzioni;
  if (zLontano <= CODA_ARREDI) return;
  const vicino = Math.max(zVicino, CODA_ARREDI);

  ctx.fillStyle = lato;
  parete(ctx, vista, xDentro, yBasso, yAlto, vicino, zLontano);

  if (tetto) {
    ctx.fillStyle = tetto;
    fasciaStrada(ctx, vista, xDentro, xFuori, vicino, zLontano, yAlto);
  }
  if (fronte && zVicino > 0.4) {
    ctx.fillStyle = fronte;
    testa(ctx, vista, zVicino, xDentro, xFuori, yBasso, yAlto);
  }
}

/** Disegna una sagoma data in coordinate (z, y) sul piano verticale x. */
function sagomaSulMuro(ctx, vista, x, punti, colore) {
  ctx.fillStyle = colore;
  ctx.beginPath();
  punti.forEach((punto, i) => {
    const p = proietta(vista, x, punto[1], punto[0]);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fill();
}

function linea(ctx, vista, da, a, colore, spessore) {
  const p1 = proietta(vista, da[0], da[1], da[2]);
  const p2 = proietta(vista, a[0], a[1], a[2]);
  ctx.strokeStyle = colore;
  ctx.lineWidth = Math.max(0.8, spessore * Math.min(p1.scala, p2.scala));
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
}

// --- cielo -----------------------------------------------------------------

function disegnaCielo(ctx, vista, scorrimento) {
  const cielo = ctx.createLinearGradient(0, 0, 0, vista.orizzonte + 10);
  cielo.addColorStop(0, COLORI.cieloAlto);
  cielo.addColorStop(1, COLORI.cieloBasso);
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, vista.larghezza, vista.orizzonte + 10);

  disegnaNuvole(ctx, vista, scorrimento);

  // La foschia sopra i tetti: e' cio' che fa sembrare lontano l'orizzonte.
  // A Milano, poi, la foschia non e' una licenza poetica.
  const velo = ctx.createLinearGradient(0, vista.orizzonte - vista.altezza * 0.16, 0, vista.orizzonte + 6);
  velo.addColorStop(0, 'rgba(220,230,236,0)');
  velo.addColorStop(1, COLORI.foschia);
  ctx.fillStyle = velo;
  ctx.fillRect(0, vista.orizzonte - vista.altezza * 0.16, vista.larghezza, vista.altezza * 0.16 + 6);
}

/** Quattro nuvole basse che scorrono lentissime. Sono in coordinate schermo:
 *  a quella distanza la prospettiva non aggiungerebbe niente. */
function disegnaNuvole(ctx, vista, scorrimento) {
  const nuvole = [
    [0.12, 0.1, 1.2],
    [0.45, 0.16, 0.9],
    [0.78, 0.08, 1.4],
    [1.15, 0.19, 0.8],
  ];
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (const [posizione, quota, taglia] of nuvole) {
    const larghezza = vista.larghezza * 0.3 * taglia;
    const x = ((posizione - (scorrimento * 0.06) / vista.larghezza) % 1.6) * vista.larghezza * 1.2 - larghezza;
    const y = vista.orizzonte * quota + vista.altezza * 0.04;
    ctx.beginPath();
    ctx.ellipse(x, y, larghezza * 0.5, larghezza * 0.13, 0, 0, Math.PI * 2);
    ctx.ellipse(x + larghezza * 0.18, y - larghezza * 0.05, larghezza * 0.3, larghezza * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Il profilo della citta' all'orizzonte: non e' fatto di palazzi veri, e' una
 *  sagoma che scorre lentissima. Serve a non lasciare vuoto il punto di fuga e
 *  a far capire che si sta correndo dentro una citta' grande. */
function disegnaProfiloLontano(ctx, vista, scorrimento) {
  const base = vista.orizzonte + 1;
  const unita = vista.larghezza / 16;
  const alte = [0.5, 1.2, 0.8, 1.7, 0.6, 1, 2.4, 0.7, 1.4, 0.9, 1.1, 1.9, 0.6, 1.3];

  for (const [fattore, tinta] of [[0.3, 'rgba(150,166,180,0.42)'], [0.62, 'rgba(128,146,162,0.5)']]) {
    const scorri = (scorrimento * fattore) % (unita * 6);
    ctx.fillStyle = tinta;
    for (let i = -2; i < 22; i += 1) {
      const x = i * unita - scorri;
      const altezza = alte[((i % alte.length) + alte.length) % alte.length] * unita * 0.9;
      ctx.fillRect(x, base - altezza, unita * 0.9, altezza);
    }
  }
}

// --- strada ----------------------------------------------------------------

function disegnaStrada(ctx, vista, scorrimento) {
  const zVicino = -DISTANZA_CAMERA + 0.45;
  const zLontano = DISTANZA_VISIBILE;

  // Terra: riempie tutto quel che sta sotto l'orizzonte, cosi' non restano
  // buchi di cielo fra un palazzo e l'altro.
  ctx.fillStyle = COLORI.marciapiede;
  ctx.fillRect(0, vista.orizzonte, vista.larghezza, vista.altezza - vista.orizzonte);

  // Marciapiedi, un filo piu' chiari verso il muro.
  for (const lato of [-1, 1]) {
    ctx.fillStyle = COLORI.marciapiedeChiaro;
    fasciaStrada(ctx, vista, lato * BORDO_MARCIAPIEDE, lato * FILO_PALAZZI, zVicino, zLontano, 0.16);
  }

  disegnaSedeTranviaria(ctx, vista, zVicino, zLontano);
  disegnaFasciaSosta(ctx, vista, zVicino, zLontano);

  // Asfalto, con una sfumatura che schiarisce verso l'orizzonte.
  const asfalto = ctx.createLinearGradient(0, vista.orizzonte, 0, vista.altezza);
  asfalto.addColorStop(0, COLORI.asfaltoLontano);
  asfalto.addColorStop(0.35, COLORI.asfalto);
  asfalto.addColorStop(1, '#3f4248');
  ctx.fillStyle = asfalto;
  fasciaStrada(ctx, vista, -SEMI_STRADA, SEMI_STRADA, zVicino, zLontano);

  disegnaRattoppi(ctx, vista, scorrimento);
  disegnaTombini(ctx, vista, scorrimento);
  disegnaStrisce(ctx, vista, scorrimento);
  disegnaAttraversamenti(ctx, vista, scorrimento);

  // Cordoli: la faccia verticale del marciapiede, che regge tutto il resto.
  ctx.fillStyle = COLORI.cordolo;
  for (const lato of [-1, 1]) {
    parete(ctx, vista, lato * BORDO_MARCIAPIEDE, 0, 0.16, zVicino, zLontano);
  }
}

/** La sede del tram: asfalto piu' chiaro e due rotaie lucide che corrono
 *  lungo tutta la strada. E' il pezzo di Milano che si vede senza doverlo
 *  spiegare. */
function disegnaSedeTranviaria(ctx, vista, zVicino, zLontano) {
  const segno = LATO_TRAM;
  ctx.fillStyle = COLORI.sede;
  fasciaStrada(ctx, vista, segno * BORDO_STRADA, segno * BORDO_MARCIAPIEDE, zVicino, zLontano, 0.005);

  for (const distanza of ROTAIE) {
    const x = segno * distanza;
    ctx.fillStyle = '#3a3d43';
    fasciaStrada(ctx, vista, x - 0.11, x + 0.11, zVicino, zLontano, 0.01);
    ctx.fillStyle = COLORI.rotaia;
    fasciaStrada(ctx, vista, x - 0.045, x + 0.045, zVicino, zLontano, 0.02);
  }
}

function disegnaFasciaSosta(ctx, vista, zVicino, zLontano) {
  const segno = LATO_SOSTA;
  ctx.fillStyle = COLORI.sosta;
  fasciaStrada(ctx, vista, segno * BORDO_STRADA, segno * BORDO_MARCIAPIEDE, zVicino, zLontano, 0.005);
  // la riga blu della sosta a pagamento
  ctx.fillStyle = 'rgba(82,116,168,0.75)';
  fasciaStrada(ctx, vista, segno * (BORDO_STRADA + 0.15), segno * (BORDO_STRADA + 0.27), zVicino, zLontano, 0.012);
}

/** I rattoppi dell'asfalto. Grigi, mai neri: un rattoppo scuro si legge come
 *  una buca, e in un gioco dove le buche si saltano sarebbe un inganno. */
function disegnaRattoppi(ctx, vista, scorrimento) {
  for (const rattoppo of CITTA.rattoppi) {
    const z = zRelativo(rattoppo.z, scorrimento);
    if (z > 70 || z < CODA_ARREDI) continue;
    ctx.fillStyle = rattoppo.chiaro ? COLORI.rattoppoChiaro : COLORI.rattoppoScuro;
    fasciaStrada(
      ctx,
      vista,
      rattoppo.x - rattoppo.larghezza / 2,
      rattoppo.x + rattoppo.larghezza / 2,
      z - rattoppo.lunghezza / 2,
      z + rattoppo.lunghezza / 2,
      0.002,
    );
  }
}

function disegnaTombini(ctx, vista, scorrimento) {
  for (const tombino of CITTA.tombini) {
    const z = zRelativo(tombino.z, scorrimento);
    if (z > 45 || z < CODA_ARREDI) continue;
    const p = proietta(vista, tombino.x, 0.004, z);
    ctx.fillStyle = COLORI.tombino;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 0.32 * p.scala, 0.13 * p.scala, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,124,132,0.4)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 0.24 * p.scala, 0.09 * p.scala, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Le strisce tratteggiate fra le corsie. Il tratteggio scorre col mondo: e'
 *  il segnale piu' forte della velocita' che si ha. */
function disegnaStrisce(ctx, vista, scorrimento) {
  const PASSO = 9;
  const TRATTO = 4;
  const inizio = -(scorrimento % PASSO);

  ctx.fillStyle = COLORI.striscia;
  for (const bordo of [1, 2]) {
    const x = bordoSinistroDiCorsia(bordo);
    for (let z = inizio; z < DISTANZA_VISIBILE; z += PASSO) {
      const vicino = Math.max(z, -DISTANZA_CAMERA + 0.5);
      const lontano = z + TRATTO;
      if (lontano < -DISTANZA_CAMERA + 0.5) continue;
      fasciaStrada(ctx, vista, x - 0.09, x + 0.09, vicino, lontano, 0.01);
    }
  }

  // Bordi della carreggiata: righe continue, consumate dal passaggio.
  ctx.fillStyle = COLORI.strisciaConsumata;
  for (const lato of [-1, 1]) {
    const x = lato * (SEMI_STRADA - 0.22);
    fasciaStrada(ctx, vista, x - 0.07, x + 0.07, -DISTANZA_CAMERA + 0.5, DISTANZA_VISIBILE, 0.01);
  }
}

/** Le strisce pedonali: bande larghe **parallele** alla strada, come sono
 *  davvero, non di traverso. */
function disegnaAttraversamenti(ctx, vista, scorrimento) {
  ctx.fillStyle = COLORI.striscia;
  for (const zStrisce of CITTA.attraversamenti) {
    const z = zRelativo(zStrisce, scorrimento);
    if (z > DISTANZA_VISIBILE || z < CODA_ARREDI - 3) continue;
    for (let x = -SEMI_STRADA + 0.35; x < SEMI_STRADA - 0.3; x += 0.92) {
      fasciaStrada(ctx, vista, x, x + 0.46, Math.max(z - 1.6, CODA_ARREDI), z + 1.6, 0.011);
    }
  }
}

// --- citta' ----------------------------------------------------------------

function disegnaCitta(ctx, vista, scorrimento) {
  const cose = [];
  const aggiungi = (z, disegna) => cose.push({ z, disegna });

  for (const edificio of CITTA.edifici) {
    const z = zRelativo(edificio.z, scorrimento);
    if (z > DISTANZA_VISIBILE || z + edificio.profondita < CODA_ARREDI) continue;
    aggiungi(z, () => disegnaEdificio(ctx, vista, edificio, z));
  }

  const arco = zRelativo(CITTA.arco.z, scorrimento);
  if (arco < DISTANZA_VISIBILE && arco > CODA_ARREDI - 8) {
    aggiungi(arco, () => disegnaArco(ctx, vista, arco));
  }

  for (const albero of CITTA.alberi) {
    const z = zRelativo(albero.z, scorrimento);
    if (z > DISTANZA_VISIBILE || z < CODA_ARREDI) continue;
    aggiungi(z, () => disegnaAlbero(ctx, vista, albero, z));
  }
  for (const lampione of CITTA.lampioni) {
    const z = zRelativo(lampione.z, scorrimento);
    if (z > DISTANZA_VISIBILE || z < CODA_ARREDI) continue;
    aggiungi(z, () => disegnaLampioneInPiedi(ctx, vista, lampione, z));
  }
  for (const palo of CITTA.paliLinea) {
    const z = zRelativo(palo.z, scorrimento);
    if (z > DISTANZA_VISIBILE || z < CODA_ARREDI) continue;
    aggiungi(z, () => disegnaPaloLinea(ctx, vista, z));
  }
  for (const auto of CITTA.auto) {
    const z = zRelativo(auto.z, scorrimento);
    if (z > 90 || z < CODA_ARREDI - 5) continue;
    aggiungi(z, () => disegnaAuto(ctx, vista, auto, z));
  }
  for (const tram of CITTA.tram) {
    const z = zRelativo(tram.z, scorrimento);
    if (z > 120 || z < CODA_ARREDI - 20) continue;
    aggiungi(z, () => disegnaTram(ctx, vista, z));
  }

  cose.sort((a, b) => b.z - a.z);
  for (const cosa of cose) cosa.disegna();
}

/** Quanto e' profondo un palazzo verso l'interno dell'isolato. Non si vede mai
 *  per intero: serve solo a dare spessore alla facciata di testa. */
const PROFONDITA_ISOLATO = 18;

/** Un palazzo e' un muro lungo la strada, la sua facciata di testa e un
 *  cornicione. Senza la testa, fra un palazzo e l'altro si vedrebbe
 *  attraverso l'isolato e sembrerebbero muri di cartone spessi zero. */
function disegnaEdificio(ctx, vista, edificio, z) {
  const zVicino = Math.max(z, CODA_ARREDI);
  const zLontano = z + edificio.profondita;
  if (zLontano <= CODA_ARREDI) return;

  const x = edificio.lato * FILO_PALAZZI;
  const fuori = edificio.lato * (FILO_PALAZZI + PROFONDITA_ISOLATO);
  const h = edificio.altezza;

  // la testa per prima: il fianco le sta davanti e la copre dove si toccano
  if (z > 0.4) {
    ctx.fillStyle = COLORI.testaPalazzo;
    testa(ctx, vista, z, x, fuori, 0, h);
  }

  if (edificio.tipo === DUOMO) return disegnaDuomo(ctx, vista, edificio, x, zVicino, zLontano);
  if (edificio.tipo === GALLERIA) return disegnaGalleria(ctx, vista, edificio, x, zVicino, zLontano);
  if (edificio.tipo === VELASCA) return disegnaVelasca(ctx, vista, edificio, x, zVicino, zLontano);
  if (edificio.tipo === BOSCO) return disegnaBosco(ctx, vista, edificio, x, zVicino, zLontano);

  ctx.fillStyle = COLORI.palazzi[edificio.tinta % COLORI.palazzi.length];
  parete(ctx, vista, x, 0, h, zVicino, zLontano);

  disegnaPianiEFinestre(ctx, vista, edificio, x, zVicino, zLontano);
  if (edificio.vetrine) disegnaPianoTerra(ctx, vista, edificio, x, zVicino, zLontano);

  ctx.fillStyle = COLORI.tetto;
  parete(ctx, vista, x, h, h + 0.6, zVicino, zLontano);
}

/** Le finestre sono riquadri veri, non tratti: da vicino la differenza fra un
 *  palazzo e una parete colorata sta tutta qui. Piu' in la' di settanta metri
 *  si smette di disegnarle, perche' li' non si distinguono comunque. */
function disegnaPianiEFinestre(ctx, vista, edificio, x, zVicino, zLontano) {
  if (zVicino > 75) return;
  const h = edificio.altezza;
  const partenza = edificio.vetrine ? 4.2 : 1.6;
  const piani = Math.max(1, Math.floor((h - partenza) / 3.1));
  const colonne = Math.max(1, Math.round((zLontano - zVicino) / 3.2));
  const passoZ = (zLontano - zVicino) / colonne;

  for (let p = 0; p < piani; p += 1) {
    const yBasso = partenza + p * 3.1 + 0.9;
    const yAlto = yBasso + 1.5;

    if (edificio.balconi) {
      ctx.fillStyle = COLORI.balcone;
      parete(ctx, vista, x - edificio.lato * 0.18, yBasso - 0.95, yBasso - 0.72, zVicino, zLontano);
    }

    for (let c = 0; c < colonne; c += 1) {
      // finestre strette e alte: quadrate sembrano oblo', non finestre
      const zDa = zVicino + c * passoZ + passoZ * 0.34;
      const zA = zVicino + c * passoZ + passoZ * 0.66;
      ctx.fillStyle = COLORI.vetrina;
      parete(ctx, vista, x - edificio.lato * 0.04, yBasso, yAlto, zDa, zA);
    }
  }
}

/** Il piano terra di una via commerciale, negozio per negozio: vetrina scura,
 *  tenda da sole, insegna. E' la fascia che si ha sotto gli occhi correndo,
 *  quindi e' quella che vale la pena disegnare bene.
 *
 *  I negozi sono **spezzati**, non una fascia continua lungo tutto l'isolato:
 *  una tenda unica lunga trenta metri diventa un nastro colorato, e nessuna
 *  via ha un nastro colorato al posto delle vetrine. */
function disegnaPianoTerra(ctx, vista, edificio, x, zVicino, zLontano) {
  if (zVicino > 70) return;
  const dentro = x - edificio.lato * 0.05;

  // il fondo continuo delle vetrine, con lo zoccolo scuro
  ctx.fillStyle = COLORI.vetrina;
  parete(ctx, vista, dentro, 0.4, 3.4, zVicino, zLontano);
  ctx.fillStyle = 'rgba(38,42,48,0.85)';
  parete(ctx, vista, dentro, 0.16, 0.55, zVicino, zLontano);

  const quanti = Math.max(1, Math.round((zLontano - zVicino) / 5.5));
  const passo = (zLontano - zVicino) / quanti;

  for (let i = 0; i < quanti; i += 1) {
    const da = zVicino + i * passo + 0.35;
    const a = zVicino + (i + 1) * passo - 0.35;
    const tinta = (edificio.insegna + i * 3) % COLORI.tenda.length;

    // il montante fra un negozio e l'altro
    ctx.fillStyle = COLORI.palazzi[edificio.tinta % COLORI.palazzi.length];
    parete(ctx, vista, dentro, 0.4, 3.4, zVicino + i * passo, da);

    // due negozi su tre hanno la tenda fuori
    if ((edificio.insegna + i) % 3 !== 0) {
      const sporgenza = x - edificio.lato * 1.5;
      ctx.fillStyle = COLORI.tenda[tinta];
      fasciaStrada(ctx, vista, Math.min(dentro, sporgenza), Math.max(dentro, sporgenza), da, a, 3.5);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      parete(ctx, vista, sporgenza, 3.15, 3.5, da, a);
    }

    // l'insegna sopra la vetrina
    ctx.fillStyle = i % 2 === 0 ? 'rgba(246,244,238,0.9)' : COLORI.tenda[tinta];
    parete(ctx, vista, dentro, 3.65, 4.1, da, a);
  }
}

function disegnaDuomo(ctx, vista, edificio, x, zVicino, zLontano) {
  const h = edificio.altezza;
  sagomaSulMuro(ctx, vista, x, [[zVicino, 0], [zVicino, h * 0.62], [zLontano, h * 0.62], [zLontano, 0]], '#ded7c5');

  // le guglie: sono loro a rendere riconoscibile il Duomo di profilo
  const quante = 11;
  for (let i = 0; i < quante; i += 1) {
    const z = zVicino + ((zLontano - zVicino) * (i + 0.5)) / quante;
    const alta = h * (i === Math.floor(quante / 2) ? 1 : 0.76 + 0.16 * Math.sin(i * 1.7));
    sagomaSulMuro(
      ctx,
      vista,
      x,
      [[z - 0.85, h * 0.62], [z - 0.35, alta * 0.94], [z, alta], [z + 0.35, alta * 0.94], [z + 0.85, h * 0.62]],
      i % 2 === 0 ? '#e8e1cf' : '#d5cebc',
    );
  }

  // finestroni a sesto acuto
  for (let i = 0; i < 6; i += 1) {
    const z = zVicino + ((zLontano - zVicino) * (i + 0.5)) / 6;
    sagomaSulMuro(
      ctx,
      vista,
      x,
      [[z - 1, h * 0.08], [z - 1, h * 0.36], [z, h * 0.5], [z + 1, h * 0.36], [z + 1, h * 0.08]],
      '#a89f8c',
    );
  }

  // la Madonnina sulla guglia di mezzo
  const zMezzo = zVicino + (zLontano - zVicino) / 2;
  sagomaSulMuro(ctx, vista, x, [[zMezzo - 0.3, h], [zMezzo, h + 2.6], [zMezzo + 0.3, h]], '#e8d99a');
}

function disegnaGalleria(ctx, vista, edificio, x, zVicino, zLontano) {
  const h = edificio.altezza;
  sagomaSulMuro(ctx, vista, x, [[zVicino, 0], [zVicino, h], [zLontano, h], [zLontano, 0]], '#cdc3b1');

  const centro = (zVicino + zLontano) / 2;
  const raggio = Math.min(6, (zLontano - zVicino) / 2.8);
  const punti = [[centro - raggio, 0]];
  for (let i = 0; i <= 10; i += 1) {
    const angolo = Math.PI * (i / 10);
    punti.push([centro - raggio * Math.cos(angolo), h * 0.42 + Math.sin(angolo) * raggio * 1.4]);
  }
  punti.push([centro + raggio, 0]);
  sagomaSulMuro(ctx, vista, x, punti, '#6d6a63');

  // la volta di vetro sul tetto, bassa: alta diventerebbe una vela
  const volta = [];
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12;
    volta.push([zVicino + (zLontano - zVicino) * t, h + Math.sin(t * Math.PI) * 2.4]);
  }
  volta.push([zLontano, h], [zVicino, h]);
  sagomaSulMuro(ctx, vista, x, volta, 'rgba(160,186,198,0.85)');
}

function disegnaVelasca(ctx, vista, edificio, x, zVicino, zLontano) {
  const h = edificio.altezza;
  // il fusto stretto e il cappello che sporge: e' tutta li' la Torre Velasca
  sagomaSulMuro(
    ctx,
    vista,
    x,
    [[zVicino + 3, 0], [zVicino + 3, h * 0.62], [zLontano - 3, h * 0.62], [zLontano - 3, 0]],
    '#9a7f72',
  );
  sagomaSulMuro(
    ctx,
    vista,
    x,
    [
      [zVicino + 3, h * 0.62],
      [zVicino, h * 0.72],
      [zVicino, h],
      [zLontano, h],
      [zLontano, h * 0.72],
      [zLontano - 3, h * 0.62],
    ],
    '#8d7367',
  );
  for (let p = 1; p < 14; p += 1) {
    const y = (h * p) / 14;
    const rientro = y < h * 0.62 ? 3 : 0;
    linea(ctx, vista, [x, y, zVicino + rientro], [x, y, zLontano - rientro], 'rgba(50,42,38,0.35)', 0.05);
  }
}

function disegnaBosco(ctx, vista, edificio, x, zVicino, zLontano) {
  const h = edificio.altezza;
  sagomaSulMuro(ctx, vista, x, [[zVicino, 0], [zVicino, h], [zLontano, h], [zLontano, 0]], '#6f6f6d');

  const piani = 13;
  for (let p = 1; p <= piani; p += 1) {
    const y = (h * p) / (piani + 1);
    sagomaSulMuro(
      ctx,
      vista,
      x,
      [[zVicino, y], [zVicino, y + 0.35], [zLontano, y + 0.35], [zLontano, y]],
      '#8b8b88',
    );
    for (let i = 0; i < 3; i += 1) {
      if ((p + i) % 2 === 0) continue;
      const z = zVicino + ((zLontano - zVicino) * (i + 0.5)) / 3;
      chioma(ctx, vista, x, z, y + 1.9, 1.5, COLORI.albero[(p + i) % COLORI.albero.length]);
    }
  }
}

/** Una massa di foglie sul piano verticale x: serve al Bosco Verticale e ai
 *  platani del viale. */
function chioma(ctx, vista, x, z, y, raggio, colore) {
  const punti = [];
  for (let i = 0; i <= 9; i += 1) {
    const angolo = (Math.PI * 2 * i) / 9;
    const r = raggio * (0.82 + 0.18 * ((i * 7) % 5) / 4);
    punti.push([z + Math.cos(angolo) * r, y + Math.sin(angolo) * r * 0.92]);
  }
  sagomaSulMuro(ctx, vista, x, punti, colore);
}

/** L'Arco della Pace: scavalca la strada in fondo alla via. Non e' un
 *  ostacolo, e' un momento — si passa sotto e basta. */
function disegnaArco(ctx, vista, z) {
  const h = CITTA.arco.altezza;
  const larghezza = BORDO_MARCIAPIEDE;
  const spessore = 1.9;

  for (const lato of [-1, 1]) {
    const dentro = lato * (larghezza - spessore);
    const fuori = lato * larghezza;
    scatola(ctx, vista, {
      xDentro: dentro,
      xFuori: fuori,
      zVicino: z - CITTA.arco.profondita / 2,
      zLontano: z + CITTA.arco.profondita / 2,
      yBasso: 0,
      yAlto: h * 0.72,
      lato: '#d9d2c2',
      fronte: '#c8c1b1',
    });
  }

  // l'attico, con la quadriga in sagoma
  const zTesta = z - CITTA.arco.profondita / 2;
  if (zTesta > 0.4) {
    ctx.fillStyle = '#cfc8b8';
    testa(ctx, vista, zTesta, -larghezza, larghezza, h * 0.72, h);
    ctx.fillStyle = '#b3ab9a';
    testa(ctx, vista, zTesta, -larghezza * 0.62, larghezza * 0.62, h * 0.74, h * 0.88);
    // Il fornice non si disegna: e' un buco, e attraverso ci si vede la
    // strada. Riempirlo anche solo di un velo lo farebbe sembrare tappato.
    ctx.fillStyle = '#8e8878';
    const cavalli = proietta(vista, 0, h, zTesta);
    ctx.fillRect(cavalli.x - 1.6 * cavalli.scala, cavalli.y - 1.5 * cavalli.scala, 3.2 * cavalli.scala, 1.5 * cavalli.scala);
  }
}

/** Un platano del filare: tronco dritto, chioma larga. Sono loro a dire
 *  "viale" invece che "strada". */
function disegnaAlbero(ctx, vista, albero, z) {
  const x = albero.lato * (BORDO_MARCIAPIEDE + 1.1);
  const altezza = 5.4 * albero.taglia;
  linea(ctx, vista, [x, 0.16, z], [x, altezza * 0.55, z], COLORI.tronco, 0.34);

  const raggio = 2.1 * albero.taglia;
  chioma(ctx, vista, x, z, altezza * 0.78, raggio, COLORI.albero[Math.floor(albero.z) % COLORI.albero.length]);
  chioma(ctx, vista, x, z - raggio * 0.5, altezza * 0.62, raggio * 0.7, COLORI.albero[(Math.floor(albero.z) + 1) % COLORI.albero.length]);
  chioma(ctx, vista, x, z + raggio * 0.5, altezza * 0.66, raggio * 0.72, COLORI.albero[(Math.floor(albero.z) + 2) % COLORI.albero.length]);
}

function disegnaLampioneInPiedi(ctx, vista, lampione, z) {
  const x = lampione.lato * (BORDO_MARCIAPIEDE + 2.4);
  linea(ctx, vista, [x, 0.16, z], [x, 7, z], COLORI.palo, 0.17);
  linea(ctx, vista, [x, 7, z], [x - lampione.lato * 1.8, 6.7, z], COLORI.palo, 0.15);

  const braccio = proietta(vista, x - lampione.lato * 1.8, 6.7, z);
  ctx.fillStyle = '#c9ccd1';
  ctx.beginPath();
  ctx.ellipse(braccio.x, braccio.y, 0.4 * braccio.scala, 0.17 * braccio.scala, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Il palo della linea aerea del tram, sul marciapiede della sede. */
function disegnaPaloLinea(ctx, vista, z) {
  const x = LATO_TRAM * (BORDO_MARCIAPIEDE + 0.4);
  linea(ctx, vista, [x, 0.16, z], [x, 8.2, z], COLORI.palo, 0.2);
  // il tirante che attraversa la strada, e i due isolatori
  linea(ctx, vista, [x, 7.6, z], [-LATO_TRAM * BORDO_MARCIAPIEDE, 8, z], COLORI.cavo, 0.05);
}

function disegnaAuto(ctx, vista, auto, z) {
  const lunghezza = auto.furgone ? 5.4 : 4.3;
  const altezza = auto.furgone ? 2.3 : 1.45;
  const dentro = LATO_SOSTA * (BORDO_STRADA + 0.45);
  const fuori = LATO_SOSTA * (BORDO_STRADA + 2.25);
  const colore = COLORI.auto[auto.tinta % COLORI.auto.length];
  const zVicino = z - lunghezza / 2;
  const zLontano = z + lunghezza / 2;

  // ombra sotto
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  fasciaStrada(ctx, vista, dentro - 0.1 * LATO_SOSTA, fuori + 0.1 * LATO_SOSTA, zVicino, zLontano, 0.008);

  scatola(ctx, vista, {
    xDentro: dentro,
    xFuori: fuori,
    zVicino,
    zLontano,
    yBasso: 0.3,
    yAlto: altezza,
    lato: colore,
    tetto: schiarisci(colore),
    fronte: scurisci(colore),
  });

  // finestrini lungo la fiancata
  if (zVicino < 40) {
    ctx.fillStyle = COLORI.vetroAuto;
    const yVetro = auto.furgone ? [1.3, 2.1] : [0.95, 1.32];
    parete(ctx, vista, dentro - LATO_SOSTA * 0.02, yVetro[0], yVetro[1], zVicino + 0.8, zLontano - 0.9);
  }

  // Ruote. Non si disegnano sull'auto che si sta superando: a mezzo metro
  // dall'obiettivo diventano due dischi neri grandi come lo schermo, e di
  // quell'auto si vede comunque solo la fiancata.
  if (zVicino < 3) return;
  ctx.fillStyle = '#1e2024';
  for (const zRuota of [zVicino + 0.95, zLontano - 0.95]) {
    const p = proietta(vista, dentro, 0.3, zRuota);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 0.29 * p.scala, 0.29 * p.scala, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Un tram fermo sulla sua sede. Arancione ATM: non serve altro perche' si
 *  capisca in che citta' si sta correndo. */
function disegnaTram(ctx, vista, z) {
  const lunghezza = 19;
  const dentro = LATO_TRAM * (BORDO_STRADA + 0.55);
  const fuori = LATO_TRAM * (BORDO_STRADA + 2.35);
  const zVicino = z - lunghezza / 2;
  const zLontano = z + lunghezza / 2;

  scatola(ctx, vista, {
    xDentro: dentro,
    xFuori: fuori,
    zVicino,
    zLontano,
    yBasso: 0.35,
    yAlto: 3.3,
    lato: COLORI.tramCorpo,
    tetto: '#c9c3ba',
    fronte: '#c9601f',
  });

  // la fascia chiara e i finestrini
  ctx.fillStyle = COLORI.tramFascia;
  parete(ctx, vista, dentro - LATO_TRAM * 0.02, 2.55, 2.95, zVicino, zLontano);
  ctx.fillStyle = COLORI.tramVetro;
  for (let i = 0; i < 6; i += 1) {
    const passo = lunghezza / 6;
    parete(
      ctx,
      vista,
      dentro - LATO_TRAM * 0.03,
      1.5,
      2.5,
      zVicino + i * passo + passo * 0.18,
      zVicino + i * passo + passo * 0.82,
    );
  }

  // il pantografo che tocca il filo
  linea(ctx, vista, [(dentro + fuori) / 2, 3.3, z + 3], [(dentro + fuori) / 2, 5.4, z + 1.5], '#3a3d43', 0.09);
}

/** I fili della linea aerea, tirati lungo la sede del tram. Si disegnano dopo
 *  la citta' perche' passano sopra a tutto, ma prima degli ostacoli, che sono
 *  quello che il giocatore deve guardare. */
function disegnaLineaAerea(ctx, vista) {
  const x = LATO_TRAM * (BORDO_STRADA + 1.4);
  const vicino = -DISTANZA_CAMERA + 1;
  linea(ctx, vista, [x, 5.6, vicino], [x, 5.6, DISTANZA_VISIBILE], COLORI.cavo, 0.05);
  linea(ctx, vista, [x - LATO_TRAM * 0.5, 6.4, vicino], [x - LATO_TRAM * 0.5, 6.4, DISTANZA_VISIBILE], 'rgba(40,42,48,0.3)', 0.04);
}

function schiarisci(colore) {
  return mescola(colore, 255, 0.22);
}

function scurisci(colore) {
  return mescola(colore, 0, 0.25);
}

/** Sposta un colore esadecimale verso il bianco o il nero. Serve a ricavare
 *  tetto e fronte di un volume dal suo colore, senza doverne elencare tre. */
function mescola(colore, verso, quanto) {
  const n = parseInt(colore.slice(1), 16);
  const canale = (spostamento) => {
    const valore = (n >> spostamento) & 255;
    return Math.round(valore + (verso - valore) * quanto);
  };
  return `rgb(${canale(16)},${canale(8)},${canale(0)})`;
}

// --- ostacoli e monete -----------------------------------------------------

function disegnaPercorso(ctx, mondo) {
  const vista = mondo.vista;
  const cose = [];

  for (const ostacolo of mondo.percorso.ostacoli) {
    const z = ostacolo.z - mondo.distanza;
    if (z > DISTANZA_VISIBILE || !davantiAllaCamera(z + ostacolo.profondita)) continue;
    cose.push({ z, disegna: () => disegnaOstacolo(ctx, vista, ostacolo, z, mondo) });
  }
  for (const raccolta of mondo.percorso.raccolte) {
    if (raccolta.presa) continue;
    const z = raccolta.z - mondo.distanza;
    if (z > DISTANZA_VISIBILE || !davantiAllaCamera(z)) continue;
    cose.push({ z, disegna: () => disegnaRaccolta(ctx, vista, raccolta, z, mondo.tempo) });
  }

  cose.sort((a, b) => b.z - a.z);
  for (const cosa of cose) cosa.disegna();
}

function disegnaOstacolo(ctx, vista, ostacolo, z, mondo) {
  if (ostacolo.tipo === BUCA) return disegnaBuca(ctx, vista, ostacolo, z);
  if (ostacolo.tipo === MONOPATTINO) return disegnaMonopattino(ctx, vista, ostacolo, z, mondo);
  return disegnaLampioneCaduto(ctx, vista, ostacolo, z);
}

function estremiCorsie(ostacolo) {
  const corsie = corsieOstacolo(ostacolo);
  const sinistra = bordoSinistroDiCorsia(corsie[0]);
  const destra = bordoSinistroDiCorsia(corsie[corsie.length - 1]) + LARGHEZZA_CORSIA;
  return { sinistra, destra };
}

/** Il contorno della buca, dal profilo irregolare che si porta dietro.
 *  `gonfia` allarga o stringe la stessa forma: e' cosi' che si ricavano bordo,
 *  vuoto e fondo senza descriverla tre volte. */
function contornoBuca(ctx, vista, buca, z, sinistra, destra, gonfia, y) {
  const semiX = ((destra - sinistra) / 2) * gonfia;
  const semiZ = (buca.profondita / 2) * gonfia;
  const centroX = (sinistra + destra) / 2;

  ctx.beginPath();
  buca.contorno.forEach(([ux, uz], i) => {
    const p = proietta(vista, centroX + ux * semiX, y, z + uz * semiZ);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fill();
}

function disegnaBuca(ctx, vista, buca, z) {
  const { sinistra, destra } = estremiCorsie(buca);

  // l'asfalto sbriciolato attorno
  ctx.fillStyle = COLORI.bucaBordo;
  contornoBuca(ctx, vista, buca, z, sinistra, destra, 1, 0.012);
  // il vuoto
  ctx.fillStyle = buca.travolto ? '#33363c' : COLORI.buca;
  contornoBuca(ctx, vista, buca, z, sinistra, destra, 0.88, 0.014);
  // il fondo, spostato in avanti: e' quel che da' profondita' invece di
  // sembrare una macchia di vernice
  ctx.fillStyle = COLORI.bucaFondo;
  contornoBuca(ctx, vista, buca, z + buca.profondita * 0.07, sinistra, destra, 0.62, 0.016);
}

function disegnaLampioneCaduto(ctx, vista, lampione, z) {
  const { sinistra, destra } = estremiCorsie(lampione);
  const y = ALTEZZA_LAMPIONE;

  // Ombra sull'asfalto: senza, il palo sembra appoggiato da nessuna parte.
  // Volutamente tenue e stretta: un'ombra marcata, vista da vicino, si legge
  // come una buca, e in un gioco dove le buche si saltano e' un inganno.
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  fasciaStrada(ctx, vista, sinistra, destra, z - 0.22, z + 0.22, 0.015);

  const a = proietta(vista, sinistra - 0.3, y, z);
  const b = proietta(vista, destra + 0.3, y, z);
  const spessore = Math.max(2, 0.26 * a.scala);

  ctx.strokeStyle = '#5c5f66';
  ctx.lineWidth = spessore;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  // la fascia gialla e nera: e' quel che si vede per primo da lontano
  ctx.strokeStyle = '#e8c545';
  ctx.lineWidth = spessore * 0.75;
  const passo = (destra + 0.3 - (sinistra - 0.3)) / 8;
  for (let i = 0; i < 8; i += 2) {
    const da = proietta(vista, sinistra - 0.3 + i * passo, y, z);
    const a2 = proietta(vista, sinistra - 0.3 + (i + 1) * passo, y, z);
    ctx.beginPath();
    ctx.moveTo(da.x, da.y);
    ctx.lineTo(a2.x, a2.y);
    ctx.stroke();
  }

  // la lampada rotta a un capo
  const capo = lampione.versoDestra ? proietta(vista, destra + 0.3, y, z) : a;
  ctx.fillStyle = '#c9ccd1';
  ctx.beginPath();
  ctx.ellipse(capo.x, capo.y, 0.5 * capo.scala, 0.24 * capo.scala, 0, 0, Math.PI * 2);
  ctx.fill();

  // due montanti che lo tengono sollevato: senza, non si capisce che ci si
  // passa sotto
  ctx.strokeStyle = '#4e5158';
  ctx.lineWidth = Math.max(1, 0.12 * a.scala);
  for (const x of [sinistra - 0.3, destra + 0.3]) {
    const alto = proietta(vista, x, y, z);
    const basso = proietta(vista, x, 0, z);
    ctx.beginPath();
    ctx.moveTo(alto.x, alto.y);
    ctx.lineTo(basso.x, basso.y);
    ctx.stroke();
  }
}

function disegnaMonopattino(ctx, vista, ostacolo, z, mondo) {
  const x = xDiCorsia(ostacolo.corsiaInizio);
  const p = proietta(vista, x, 0, z);
  if (p.scala <= 0) return;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, 0.55 * p.scala, 0.18 * p.scala, 0, 0, Math.PI * 2);
  ctx.fill();

  const sbanda = Math.sin(mondo.tempo * 3 + ostacolo.sbandata * 6) * 0.05;
  conFigura(ctx, p.x, p.y, p.scala, () => {
    ctx.rotate(sbanda);
    ctx.fillStyle = '#3a3d43';
    ctx.fillRect(-0.32, 0.06, 0.64, 0.08);
    ctx.fillStyle = '#1b1d21';
    for (const rx of [-0.3, 0.3]) {
      ctx.beginPath();
      ctx.arc(rx, 0.1, 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#4a4e55';
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.moveTo(0.28, 0.1);
    ctx.lineTo(0.34, 1.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0.1, 1.05);
    ctx.lineTo(0.58, 1.05);
    ctx.stroke();

    disegnaFigura(ctx, {
      colore: COLORI.maranza,
      luce: COLORI.maranzaLuce,
      base: 0.14,
      posa: 'monopattino',
    });
  });
}

function disegnaRaccolta(ctx, vista, raccolta, z, tempo) {
  const x = xDiCorsia(raccolta.corsia + raccolta.spostamento);
  const p = proietta(vista, x, raccolta.y, z);
  if (p.scala <= 0) return;

  if (raccolta.tipo === MONETA) {
    const giro = Math.abs(Math.cos(tempo * 3 + raccolta.z));
    const raggio = 0.3 * p.scala;
    ctx.fillStyle = COLORI.monetaScura;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, Math.max(1, raggio * giro), raggio, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORI.moneta;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, Math.max(1, raggio * giro * 0.74), raggio * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const raggio = 0.45 * p.scala;
  const colore =
    raccolta.tipo === SCUDO ? COLORI.scudo : raccolta.tipo === SCATTO ? COLORI.scatto : COLORI.calamita;

  const alone = ctx.createRadialGradient(p.x, p.y, raggio * 0.2, p.x, p.y, raggio * 2);
  alone.addColorStop(0, colore);
  alone.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 0.45 + 0.25 * Math.sin(tempo * 5);
  ctx.fillStyle = alone;
  ctx.beginPath();
  ctx.arc(p.x, p.y, raggio * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#fbfcfd';
  ctx.beginPath();
  ctx.arc(p.x, p.y, raggio, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colore;
  ctx.beginPath();
  ctx.arc(p.x, p.y, raggio * 0.78, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fbfcfd';
  disegnaSimboloBonus(ctx, raccolta.tipo, p.x, p.y, raggio * 0.5);
}

function disegnaSimboloBonus(ctx, tipo, cx, cy, r) {
  if (tipo === SCUDO) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.8, cy - r * 0.5);
    ctx.lineTo(cx + r * 0.8, cy + r * 0.2);
    ctx.quadraticCurveTo(cx + r * 0.8, cy + r, cx, cy + r);
    ctx.quadraticCurveTo(cx - r * 0.8, cy + r, cx - r * 0.8, cy + r * 0.2);
    ctx.lineTo(cx - r * 0.8, cy - r * 0.5);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (tipo === SCATTO) {
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.2, cy - r);
    ctx.lineTo(cx - r * 0.7, cy + r * 0.1);
    ctx.lineTo(cx - r * 0.05, cy + r * 0.1);
    ctx.lineTo(cx - r * 0.2, cy + r);
    ctx.lineTo(cx + r * 0.7, cy - r * 0.1);
    ctx.lineTo(cx + r * 0.05, cy - r * 0.1);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.lineWidth = r * 0.55;
  ctx.strokeStyle = ctx.fillStyle;
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.1, r * 0.62, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.62, cy + r * 0.1);
  ctx.lineTo(cx - r * 0.62, cy + r * 0.75);
  ctx.moveTo(cx + r * 0.62, cy + r * 0.1);
  ctx.lineTo(cx + r * 0.62, cy + r * 0.75);
  ctx.stroke();
}

// --- figure ----------------------------------------------------------------

/** Sposta l'origine ai piedi del personaggio e mette l'asse y verso l'alto,
 *  con l'unita' uguale a un metro. Dentro `disegna` si ragiona in metri. */
function conFigura(ctx, x, y, scala, disegna) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scala, -scala);
  disegna();
  ctx.restore();
}

/** Una persona **vista di spalle** che corre, alta 1,75 m, con l'origine fra i
 *  piedi. La stessa funzione disegna l'omino bianco e i maranza.
 *
 *  Da dietro una corsa non si legge come di profilo: le gambe non si aprono
 *  avanti e indietro sullo schermo, perche' quel movimento va nella direzione
 *  in cui si guarda. Quello che si vede davvero e', in ordine di evidenza:
 *
 *  1. il **tallone che si alza dietro**, con la pianta della scarpa che
 *     lampeggia a ogni passo;
 *  2. il **sobbalzo del busto**, due volte per falcata;
 *  3. le **braccia che escono di lato** quando vanno indietro e spariscono
 *     dietro il fianco quando vanno avanti;
 *  4. una leggera **torsione** delle spalle, contraria a quella del bacino.
 *
 *  Il codice qui sotto disegna esattamente queste quattro cose, in quest'ordine
 *  di importanza. Le braccia si disegnano **prima** del busto proprio perche'
 *  quella che va avanti debba finirci dietro. */
function disegnaFigura(ctx, opzioni) {
  const { colore, luce, fase = 0, posa = 'corsa', coltello = false, base = 0 } = opzioni;

  ctx.save();
  ctx.translate(0, base);

  if (posa === 'scivolata') {
    disegnaAccosciato(ctx, colore, luce);
    ctx.restore();
    return;
  }

  const destro = Math.sin(fase);
  const sinistro = Math.sin(fase + Math.PI);
  const corsa = posa === 'corsa';
  const sobbalzo = corsa ? Math.abs(Math.cos(fase)) * 0.06 : 0;
  const anca = 0.86 + sobbalzo;
  const spalla = 1.4 + sobbalzo;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. gambe
  ctx.strokeStyle = colore;
  ctx.lineWidth = 0.17;
  if (posa === 'salto') {
    gambaInVolo(ctx, -1, destro, anca);
    gambaInVolo(ctx, 1, sinistro, anca);
  } else if (posa === 'monopattino') {
    for (const segno of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(segno * 0.1, anca);
      ctx.lineTo(segno * 0.13, anca * 0.5);
      ctx.lineTo(segno * 0.15, 0);
      ctx.stroke();
    }
  } else {
    gambaDiCorsa(ctx, -1, destro, anca, colore, luce);
    gambaDiCorsa(ctx, 1, sinistro, anca, colore, luce);
  }

  // 4. torsione: il busto si gira appena, al contrario del passo. Appena:
  // di piu' e l'omino sembra che stia per cadere di lato invece di correre.
  if (corsa) ctx.rotate(destro * 0.02);

  // 3. braccia, prima del busto: quella che va avanti deve finirci dietro
  ctx.strokeStyle = colore;
  ctx.lineWidth = 0.13;
  if (posa === 'monopattino') {
    for (const segno of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(segno * 0.22, spalla);
      ctx.lineTo(segno * 0.34, spalla - 0.18);
      ctx.lineTo(segno * 0.4, spalla - 0.34);
      ctx.stroke();
    }
  } else {
    braccio(ctx, -1, sinistro, spalla, anca, colore, coltello);
    braccio(ctx, 1, destro, spalla, anca, colore, coltello);
  }

  // 2. busto
  ctx.fillStyle = colore;
  riquadroTondo(ctx, -0.25, anca - 0.06, 0.5, spalla - anca + 0.22, 0.17);
  ctx.fill();
  ctx.fillStyle = luce;
  riquadroTondo(ctx, -0.25, spalla - 0.12, 0.5, 0.16, 0.07);
  ctx.fill();

  // collo e testa
  ctx.fillStyle = colore;
  ctx.beginPath();
  ctx.arc(0, spalla + 0.25, 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = luce;
  ctx.beginPath();
  ctx.arc(-0.05, spalla + 0.3, 0.09, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Una gamba durante la corsa. `p` va da -1 (portata avanti, quasi nascosta
 *  dal corpo) a +1 (spinta indietro, tallone in alto). */
function gambaDiCorsa(ctx, segno, p, anca, colore, luce) {
  const dietro = Math.max(0, p);
  const avanti = Math.max(0, -p);
  const piedeY = dietro * dietro * 0.55;
  const piedeX = segno * (0.1 + dietro * 0.12);
  const ginocchioX = segno * (0.12 + avanti * 0.05);
  const ginocchioY = anca * 0.5 + dietro * 0.12 + avanti * 0.14;

  ctx.strokeStyle = colore;
  ctx.beginPath();
  ctx.moveTo(segno * 0.11, anca);
  ctx.lineTo(ginocchioX, ginocchioY);
  ctx.lineTo(piedeX, piedeY);
  ctx.stroke();

  // la pianta della scarpa: da dietro e' il segnale piu' forte della corsa
  if (dietro > 0.25) {
    ctx.fillStyle = luce;
    ctx.beginPath();
    ctx.ellipse(piedeX, piedeY, 0.105, 0.06, segno * -0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** In aria le gambe si raccolgono: e' quello che fa capire, in un fotogramma,
 *  che si sta scavalcando qualcosa e non correndo. */
function gambaInVolo(ctx, segno, p, anca) {
  ctx.beginPath();
  ctx.moveTo(segno * 0.11, anca);
  ctx.lineTo(segno * (0.2 + p * 0.06), anca * 0.62);
  ctx.lineTo(segno * (0.13 + p * 0.1), 0.34 + Math.abs(p) * 0.14);
  ctx.stroke();
}

function braccio(ctx, segno, p, spalla, anca, colore, coltello) {
  const indietro = Math.max(0, p);
  const avanti = Math.max(0, -p);
  // Il braccio che va indietro esce bene di lato: e' l'unico dei due che si
  // vede, perche' l'altro finisce dietro il busto, ed e' quindi lui a dover
  // raccontare la bracciata.
  const manoX = segno * (0.3 + indietro * 0.16 - avanti * 0.08);
  const manoY = anca + 0.14 + indietro * 0.2 - avanti * 0.08;
  const gomitoX = segno * (0.32 + indietro * 0.08);
  const gomitoY = (spalla + manoY) / 2 + 0.04;

  ctx.strokeStyle = colore;
  ctx.beginPath();
  ctx.moveTo(segno * 0.22, spalla);
  ctx.lineTo(gomitoX, gomitoY);
  ctx.lineTo(manoX, manoY);
  ctx.stroke();

  if (!coltello || segno !== 1) return;
  ctx.save();
  ctx.translate(manoX, manoY);
  ctx.rotate(-0.6 + p * 0.35);
  ctx.fillStyle = COLORI.coltello;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0.07, 0.42);
  ctx.lineTo(0, 0.5);
  ctx.lineTo(-0.07, 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** La scivolata: non e' la figura in piedi schiacciata, e' un'altra posa.
 *  Schiacciandola verrebbe una testa ovale e le braccia spalancate, e da
 *  dietro non si capirebbe cosa sta succedendo. Qui invece le gambe sono
 *  distese in avanti (piu' lontane, quindi piu' in alto sullo schermo), le
 *  braccia raccolte e la testa resta tonda. Alta in tutto 0,8 m, come dice
 *  ALTEZZA_OMINO_ABBASSATO. */
function disegnaAccosciato(ctx, colore, luce) {
  ctx.strokeStyle = colore;
  ctx.lineCap = 'round';

  ctx.lineWidth = 0.17;
  for (const segno of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(segno * 0.1, 0.26);
    ctx.lineTo(segno * 0.34, 0.4);
    ctx.stroke();
  }

  ctx.fillStyle = colore;
  riquadroTondo(ctx, -0.26, 0.2, 0.52, 0.36, 0.14);
  ctx.fill();
  ctx.fillStyle = luce;
  riquadroTondo(ctx, -0.26, 0.44, 0.52, 0.13, 0.06);
  ctx.fill();

  ctx.strokeStyle = colore;
  ctx.lineWidth = 0.12;
  for (const segno of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(segno * 0.24, 0.5);
    ctx.lineTo(segno * 0.34, 0.28);
    ctx.stroke();
  }

  ctx.fillStyle = colore;
  ctx.beginPath();
  ctx.arc(0, 0.65, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = luce;
  ctx.beginPath();
  ctx.arc(-0.04, 0.69, 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function riquadroTondo(ctx, x, y, larghezza, altezza, raggio) {
  const r = Math.min(raggio, larghezza / 2, altezza / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + larghezza - r, y);
  ctx.quadraticCurveTo(x + larghezza, y, x + larghezza, y + r);
  ctx.lineTo(x + larghezza, y + altezza - r);
  ctx.quadraticCurveTo(x + larghezza, y + altezza, x + larghezza - r, y + altezza);
  ctx.lineTo(x + r, y + altezza);
  ctx.quadraticCurveTo(x, y + altezza, x, y + altezza - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function disegnaCorridore(ctx, mondo) {
  const vista = mondo.vista;
  const corridore = mondo.corridore;
  const x = xDiCorsia(corridore.posizione);
  const suolo = proietta(vista, x, 0, 0);
  const p = proietta(vista, x, corridore.y, 0);

  // ombra a terra: si stringe quando si salta
  const stretta = 1 / (1 + corridore.y * 0.8);
  ctx.fillStyle = `rgba(0,0,0,${0.32 * stretta})`;
  ctx.beginPath();
  ctx.ellipse(suolo.x, suolo.y, 0.45 * suolo.scala * stretta, 0.16 * suolo.scala * stretta, 0, 0, Math.PI * 2);
  ctx.fill();

  const posa = abbassato(corridore) ? 'scivolata' : corridore.inAria ? 'salto' : 'corsa';
  const lampeggia = mondo.tempo < mondo.invulnerabileFinoA && Math.floor(mondo.tempo * 12) % 2 === 0;

  ctx.globalAlpha = lampeggia ? 0.55 : 1;
  conFigura(ctx, p.x, p.y, p.scala, () => {
    if (corridore.inciampo > 0) ctx.rotate(Math.sin(corridore.inciampo * 40) * 0.12);
    disegnaFigura(ctx, {
      colore: COLORI.omino,
      luce: COLORI.ominoOmbra,
      fase: corridore.fase,
      posa,
    });
  });
  ctx.globalAlpha = 1;

  if (mondo.scudo) disegnaBollaScudo(ctx, p, mondo.tempo);
  if (scattoAttivo(mondo)) disegnaScia(ctx, p, mondo.tempo);
}

function disegnaBollaScudo(ctx, p, tempo) {
  const raggio = 1.15 * p.scala;
  ctx.strokeStyle = `rgba(87,176,230,${0.55 + 0.25 * Math.sin(tempo * 6)})`;
  ctx.lineWidth = Math.max(1.5, 0.06 * p.scala);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - raggio * 0.75, raggio * 0.72, raggio, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function disegnaScia(ctx, p, tempo) {
  ctx.strokeStyle = 'rgba(244,129,60,0.5)';
  ctx.lineWidth = Math.max(1, 0.05 * p.scala);
  for (let i = 1; i <= 4; i += 1) {
    const y = p.y - (0.4 + i * 0.32) * p.scala;
    const larghezza = (0.6 + i * 0.25 + Math.sin(tempo * 12 + i) * 0.1) * p.scala;
    ctx.beginPath();
    ctx.moveTo(p.x - larghezza, y);
    ctx.lineTo(p.x + larghezza, y);
    ctx.stroke();
  }
}

/** I maranza stanno **dietro** la telecamera: non hanno una z da proiettare.
 *  Si disegnano in coordinate schermo, in fondo, e crescono man mano che si
 *  avvicinano. E' una bugia prospettica, ma e' l'unico modo di vedere in
 *  faccia il pericolo che ti sta alle spalle. */
function disegnaInseguitori(ctx, mondo) {
  const vista = mondo.vista;
  const vicinanza = minaccia(mondo.inseguitori);
  const preso = mondo.stato === 'finita';
  const spinta = preso ? Math.min(1, (mondo.tempo - mondo.tempoFine) * 2.5) : 0;

  // Col distacco pieno si vedono appena spuntare dal fondo; man mano che si
  // avvicinano crescono e salgono. E' l'unico modo che ha il giocatore di
  // sentire il fiato sul collo senza doversi girare a leggere una barra.
  const altezzaFigura = vista.altezza * (0.15 + 0.42 * vicinanza + 0.14 * spinta);
  const scala = altezzaFigura / ALTEZZA_OMINO;
  const visibile = 0.18 + 0.56 * vicinanza + 0.26 * spinta;
  const piedi = vista.altezza + altezzaFigura * (1 - visibile);

  const posti = [-0.24, 0.02, 0.26];
  posti.forEach((offset, i) => {
    const x =
      vista.larghezza * (0.5 + offset) +
      Math.sin(mondo.inseguitori.fase * 0.6 + i) * vista.larghezza * 0.012;
    const suo = scala * (i === 1 ? 1.06 : 0.92);
    conFigura(ctx, x, piedi, suo, () => {
      disegnaFigura(ctx, {
        colore: COLORI.maranza,
        luce: COLORI.maranzaLuce,
        fase: mondo.inseguitori.fase * 1.1 + i * 2,
        coltello: true,
      });
    });
  });
}

/** Bordi che si scuriscono e si arrossano quando i maranza sono vicini. */
function disegnaVignetta(ctx, mondo) {
  const vicinanza = minaccia(mondo.inseguitori);
  if (vicinanza < 0.35) return;
  const forza = (vicinanza - 0.35) / 0.65;
  const vista = mondo.vista;
  const alone = ctx.createRadialGradient(
    vista.larghezza / 2,
    vista.altezza * 0.45,
    vista.altezza * 0.25,
    vista.larghezza / 2,
    vista.altezza * 0.45,
    vista.altezza * 0.8,
  );
  alone.addColorStop(0, 'rgba(150,20,20,0)');
  alone.addColorStop(1, `rgba(130,18,18,${0.55 * forza})`);
  ctx.fillStyle = alone;
  ctx.fillRect(0, 0, vista.larghezza, vista.altezza);
}

// --- interfaccia -----------------------------------------------------------

function margini(interfaccia) {
  return interfaccia.margini || { alto: 0, destro: 0, basso: 0, sinistro: 0 };
}

/** Imposta il font piu' grande che fa stare il testo nella larghezza data.
 *  Serve sugli schermi stretti: senza, la riga piu' lunga esce dallo schermo e
 *  si legge mezza frase. */
function corpoCheCiSta(ctx, testo, corpoIniziale, larghezzaMassima, peso = 600) {
  let corpo = corpoIniziale;
  for (let tentativo = 0; tentativo < 14; tentativo += 1) {
    ctx.font = `${peso} ${corpo}px system-ui, -apple-system, sans-serif`;
    if (ctx.measureText(testo).width <= larghezzaMassima) break;
    corpo *= 0.93;
  }
  return corpo;
}

function disegnaHud(ctx, mondo, interfaccia) {
  const vista = mondo.vista;
  const m = margini(interfaccia);
  const unita = Math.min(vista.larghezza, vista.altezza * 0.62);
  const bordo = unita * 0.05;
  const alto = m.alto + bordo;

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORI.testo;
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = unita * 0.02;

  ctx.font = `700 ${unita * 0.095}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(String(mondo.punteggio), m.sinistro + bordo, alto);

  ctx.font = `600 ${unita * 0.042}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = 'rgba(247,248,250,0.8)';
  ctx.fillText(`record ${interfaccia.record || 0}`, m.sinistro + bordo, alto + unita * 0.115);

  // monete, sotto il punteggio: a destra ora c'e' il pulsante di pausa
  const yMonete = alto + unita * 0.175;
  ctx.fillStyle = COLORI.moneta;
  ctx.beginPath();
  ctx.ellipse(m.sinistro + bordo + unita * 0.022, yMonete + unita * 0.028, unita * 0.02, unita * 0.028, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORI.testo;
  ctx.font = `700 ${unita * 0.055}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(String(mondo.monete), m.sinistro + bordo + unita * 0.055, yMonete);

  ctx.shadowBlur = 0;
  disegnaBarraDistacco(ctx, mondo, interfaccia, unita);
  disegnaBonusAttivi(ctx, mondo, interfaccia, unita);
  disegnaAvviso(ctx, mondo, unita);
}

/** Quanto manca prima che ti prendano. E' l'unica vita che hai. */
function disegnaBarraDistacco(ctx, mondo, interfaccia, unita) {
  const vista = mondo.vista;
  const m = margini(interfaccia);
  const pulsante = areaPausa(vista, m);
  const larghezza = Math.min(vista.larghezza * 0.4, unita * 0.46);
  const altezza = unita * 0.026;
  const x = vista.larghezza - m.destro - unita * 0.05 - larghezza;
  const y = pulsante.y + pulsante.raggio + unita * 0.04;

  const parte = Math.max(0, Math.min(1, mondo.inseguitori.distacco / DISTACCO_INIZIALE));
  ctx.fillStyle = 'rgba(20,22,26,0.45)';
  riquadroTondo(ctx, x, y, larghezza, altezza, altezza / 2);
  ctx.fill();

  ctx.fillStyle = parte > 0.6 ? '#5ec07a' : parte > 0.3 ? '#e8b23c' : '#e05543';
  if (parte > 0.02) {
    riquadroTondo(ctx, x, y, larghezza * parte, altezza, altezza / 2);
    ctx.fill();
  }

  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(247,248,250,0.75)';
  ctx.font = `600 ${unita * 0.032}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('distacco', x + larghezza, y + altezza + unita * 0.012);
}

function disegnaBonusAttivi(ctx, mondo, interfaccia, unita) {
  const m = margini(interfaccia);
  const attivi = [];
  if (mondo.scudo) attivi.push({ tipo: SCUDO, parte: 1, colore: COLORI.scudo });
  if (scattoAttivo(mondo)) {
    attivi.push({ tipo: SCATTO, parte: rimastoScatto(mondo) / DURATA_SCATTO, colore: COLORI.scatto });
  }
  if (calamitaAttiva(mondo)) {
    attivi.push({ tipo: CALAMITA, parte: rimastoCalamita(mondo) / DURATA_CALAMITA, colore: COLORI.calamita });
  }
  if (attivi.length === 0) return;

  const raggio = unita * 0.042;
  let x = m.sinistro + unita * 0.05 + raggio;
  const y = m.alto + unita * 0.05 + unita * 0.29;

  for (const attivo of attivi) {
    ctx.fillStyle = 'rgba(20,22,26,0.5)';
    ctx.beginPath();
    ctx.arc(x, y, raggio, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = attivo.colore;
    ctx.lineWidth = raggio * 0.22;
    ctx.beginPath();
    ctx.arc(x, y, raggio * 0.86, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * attivo.parte);
    ctx.stroke();

    ctx.fillStyle = attivo.colore;
    disegnaSimboloBonus(ctx, attivo.tipo, x, y, raggio * 0.5);
    x += raggio * 2.5;
  }
}

function disegnaAvviso(ctx, mondo, unita) {
  if (!mondo.avviso) return;
  const eta = mondo.tempo - mondo.avviso.tempo;
  if (eta > 1.4) return;
  const vista = mondo.vista;
  ctx.globalAlpha = Math.max(0, 1 - eta / 1.4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORI.testo;
  ctx.font = `800 ${unita * 0.07}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(mondo.avviso.testo.toUpperCase(), vista.larghezza / 2, vista.altezza * 0.3 - eta * unita * 0.05);
  ctx.globalAlpha = 1;
}

/** Il pulsante di pausa: due sbarre in un cerchio, o un triangolo quando il
 *  gioco e' gia' fermo. Sta in alto a destra, lontano dal pollice che scorre. */
function disegnaPulsantePausa(ctx, mondo, interfaccia) {
  const area = areaPausa(mondo.vista, margini(interfaccia));
  const fermo = mondo.stato === 'pausa';

  ctx.fillStyle = 'rgba(20,22,26,0.5)';
  ctx.beginPath();
  ctx.arc(area.x, area.y, area.raggio, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(247,248,250,0.35)';
  ctx.lineWidth = Math.max(1, area.raggio * 0.06);
  ctx.stroke();

  ctx.fillStyle = COLORI.testo;
  const r = area.raggio;
  if (fermo) {
    ctx.beginPath();
    ctx.moveTo(area.x - r * 0.26, area.y - r * 0.42);
    ctx.lineTo(area.x + r * 0.45, area.y);
    ctx.lineTo(area.x - r * 0.26, area.y + r * 0.42);
    ctx.closePath();
    ctx.fill();
    return;
  }
  for (const segno of [-1, 1]) {
    riquadroTondo(ctx, area.x + segno * r * 0.34 - r * 0.13, area.y - r * 0.42, r * 0.26, r * 0.84, r * 0.09);
    ctx.fill();
  }
}

// --- schermate -------------------------------------------------------------

function velo(ctx, vista, opacita) {
  ctx.fillStyle = `rgba(12,14,18,${opacita})`;
  ctx.fillRect(0, 0, vista.larghezza, vista.altezza);
}

function disegnaSchermataIniziale(ctx, mondo, interfaccia) {
  const vista = mondo.vista;
  const unita = Math.min(vista.larghezza, vista.altezza * 0.62);
  velo(ctx, vista, 0.42);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORI.testo;
  ctx.font = `800 ${unita * 0.13}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('MARANZA', vista.larghezza / 2, vista.altezza * 0.2);
  ctx.fillStyle = '#f4813c';
  ctx.fillText('ESCAPE', vista.larghezza / 2, vista.altezza * 0.2 + unita * 0.14);

  ctx.fillStyle = 'rgba(247,248,250,0.85)';
  ctx.font = `600 ${unita * 0.045}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('ti inseguono. non farti prendere.', vista.larghezza / 2, vista.altezza * 0.2 + unita * 0.26);

  const righe = [
    ['scorri a lato', 'cambi corsia: il monopattino'],
    ['scorri in alto', 'salti: la buca'],
    ['scorri in basso', 'ti abbassi: il lampione'],
  ];
  const y0 = vista.altezza * 0.46;
  righe.forEach((riga, i) => {
    const testo = `${riga[0]}  ·  ${riga[1]}`;
    corpoCheCiSta(ctx, testo, unita * 0.042, vista.larghezza * 0.9);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORI.testo;
    ctx.fillText(testo, vista.larghezza / 2, y0 + i * unita * 0.085);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORI.testo;
  ctx.font = `700 ${unita * 0.06}px system-ui, -apple-system, sans-serif`;
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(mondo.tempo * 3);
  ctx.fillText('tocca per scappare', vista.larghezza / 2, vista.altezza * 0.78);
  ctx.globalAlpha = 1;

  if (interfaccia.record) {
    ctx.font = `600 ${unita * 0.042}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(247,248,250,0.7)';
    ctx.fillText(`record ${interfaccia.record}`, vista.larghezza / 2, vista.altezza * 0.85);
  }
}

function disegnaSchermataPausa(ctx, mondo, interfaccia) {
  const vista = mondo.vista;
  const unita = Math.min(vista.larghezza, vista.altezza * 0.62);
  velo(ctx, vista, 0.55);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORI.testo;
  ctx.font = `800 ${unita * 0.12}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('PAUSA', vista.larghezza / 2, vista.altezza * 0.4);

  ctx.font = `700 ${unita * 0.08}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(String(mondo.punteggio), vista.larghezza / 2, vista.altezza * 0.5);
  ctx.font = `600 ${unita * 0.04}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = 'rgba(247,248,250,0.75)';
  ctx.fillText(
    `${Math.floor(mondo.distanza)} metri  ·  ${mondo.monete} monete`,
    vista.larghezza / 2,
    vista.altezza * 0.56,
  );

  ctx.fillStyle = COLORI.testo;
  ctx.font = `700 ${unita * 0.055}px system-ui, -apple-system, sans-serif`;
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(mondo.tempo * 3);
  ctx.fillText('tocca per riprendere', vista.larghezza / 2, vista.altezza * 0.8);
  ctx.globalAlpha = 1;
}

const SPIEGAZIONI = {
  buca: 'sei finito in una buca',
  monopattino: 'ti ha travolto un monopattino',
  lampione: 'hai preso in pieno il lampione',
  raggiunto: 'ti hanno raggiunto',
};

function disegnaSchermataFine(ctx, mondo, interfaccia) {
  const vista = mondo.vista;
  const unita = Math.min(vista.larghezza, vista.altezza * 0.62);
  const eta = mondo.tempo - mondo.tempoFine;
  velo(ctx, vista, Math.min(0.62, eta * 1.2));

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e05543';
  ctx.font = `800 ${unita * 0.15}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('PRESO', vista.larghezza / 2, vista.altezza * 0.24);

  ctx.fillStyle = 'rgba(247,248,250,0.85)';
  ctx.font = `600 ${unita * 0.045}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(SPIEGAZIONI[mondo.causaFine] || 'ti hanno preso', vista.larghezza / 2, vista.altezza * 0.32);

  ctx.fillStyle = COLORI.testo;
  ctx.font = `800 ${unita * 0.12}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(String(mondo.punteggio), vista.larghezza / 2, vista.altezza * 0.44);

  const riassunto = `${Math.floor(mondo.distanza)} metri  ·  ${mondo.monete} monete (${mondo.monete * PUNTI_PER_MONETA})`;
  corpoCheCiSta(ctx, riassunto, unita * 0.04, vista.larghezza * 0.9);
  ctx.fillStyle = 'rgba(247,248,250,0.75)';
  ctx.fillText(riassunto, vista.larghezza / 2, vista.altezza * 0.52);

  const record = interfaccia.record || 0;
  const nuovo = mondo.punteggio >= record && record > 0;
  ctx.fillStyle = nuovo ? '#e8b23c' : 'rgba(247,248,250,0.75)';
  ctx.fillText(nuovo ? 'nuovo record!' : `record ${record}`, vista.larghezza / 2, vista.altezza * 0.58);

  if (eta < 0.9) return;
  ctx.fillStyle = COLORI.testo;
  ctx.font = `700 ${unita * 0.06}px system-ui, -apple-system, sans-serif`;
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(mondo.tempo * 3);
  ctx.fillText('tocca per riprovare', vista.larghezza / 2, vista.altezza * 0.72);
  ctx.globalAlpha = 1;
}

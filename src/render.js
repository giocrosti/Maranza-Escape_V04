// Tutto il disegno sul canvas. E' l'unico modulo che sa che esiste un canvas:
// il resto del gioco non sa nemmeno di quanti pixel e' fatto lo schermo.
//
// Tre idee tengono insieme il file:
//
// 1. **Si disegna dal lontano al vicino.** Non c'e' nessun controllo di
//    profondita': l'ordine di disegno *e'* la profondita'. Percio' ogni elenco
//    (palazzi, alberi, auto, ostacoli) viene raccolto, ordinato per z
//    decrescente e solo allora passato al pennello.
// 2. **Le forme prospettiche stanno in `pennello.js`**, le persone e i
//    monopattini in `figure.js`, i monumenti in `monumenti.js`. Qui restano la
//    scena e l'interfaccia.
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
import { BUCA, AIUOLA, MONOPATTINO, PONTICELLO, ARCO, ALTEZZA_PONTICELLO, corsieOstacolo } from './ostacoli.js';
import { MONETA, SCUDO, SCATTO, CALAMITA, MADONNINA, SPRITZ } from './percorso.js';
import { abbassato } from './corridore.js';
import { minaccia, DISTACCO_INIZIALE } from './inseguitori.js';
import { areaPausa, areaIstruzioni, areaCasa } from './pulsanti.js';
import {
  fascia,
  parete,
  testa,
  scatola,
  linea,
  chioma,
  riquadroTondo,
  schiarisci,
  scurisci,
} from './pennello.js';
import {
  conFigura,
  disegnaFigura,
  disegnaMacchinina,
  disegnaMadonnina,
  disegnaSpritz,
  disegnaMaranzaDiFronte,
  disegnaMonopattinoDiLato,
  disegnaMonopattinoDiFronte,
  disegnaMaranzaInSella,
  postiDelBranco,
  CAPPELLI,
  SEDILE_MACCHININA,
} from './figure.js';
import { disegnaFacciataMonumento, disegnaFiancoMonumento, disegnaArco } from './monumenti.js';
import {
  creaCitta,
  zRelativo,
  BORDO_STRADA,
  BORDO_MARCIAPIEDE,
  FILO_PALAZZI,
  FILO_MONUMENTI,
  ROTAIE,
  LATO_TRAM,
  LATO_SOSTA,
} from './citta.js';
import {
  scattoAttivo,
  calamitaAttiva,
  madonninaAttiva,
  fuoriDallaCorsa,
  rimastoScatto,
  rimastoCalamita,
  rimastoMadonnina,
  DURATA_SCATTO,
  DURATA_CALAMITA,
  DURATA_MADONNINA,
  DURATA_APPARIZIONE,
  PUNTI_PER_MONETA,
  GRIDO_SCONFITTA,
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
  // stinto, una crema, un verdino. Se sono troppo simili la fila di palazzi si
  // legge come un muro solo.
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
  tramCorpo: '#e0862c',
  tramFascia: '#f0e7d2',
  tramVetro: '#3f4a54',
  tramLegno: '#5b3f2a',
  omino: '#f5f7fa',
  ominoOmbra: '#c2c9d3',
  maranza: '#24262c',
  maranzaLuce: '#474c56',
  borsello: '#8a8f98',
  bucaBordo: '#3c4046',
  bucaParete: '#26282d',
  bucaFondo: '#131519',
  poliziaDivisa: '#2e3f68',
  poliziaLuce: '#93a2c0',
  poliziaBerretto: '#eef1f5',
  poliziaBanda: '#dbe24e',
  macchinina: '#d8342c',
  moneta: '#f0c246',
  monetaScura: '#b58a1f',
  scudo: '#57b0e6',
  scatto: '#f4813c',
  calamita: '#4f7ec4',
  madonnina: '#e6c150',
  spritz: '#e8722a',
  testo: '#f7f8fa',
};

const COLORI_BONUS = {
  scudo: COLORI.scudo,
  scatto: COLORI.scatto,
  calamita: COLORI.calamita,
  madonnina: COLORI.madonnina,
  spritz: COLORI.spritz,
};

export function disegnaMondo(ctx, mondo, interfaccia = {}) {
  const vista = mondo.vista;
  ctx.clearRect(0, 0, vista.larghezza, vista.altezza);

  disegnaCielo(ctx, vista, mondo.scorrimento);
  disegnaProfiloLontano(ctx, vista, mondo.scorrimento);
  disegnaStrada(ctx, vista, mondo.scorrimento);
  disegnaCitta(ctx, vista, mondo.scorrimento);
  disegnaLineaAerea(ctx, vista);
  disegnaPercorso(ctx, mondo);
  // Sulla schermata iniziale e sulle istruzioni la strada e' solo lo sfondo:
  // l'omino e gli inseguitori li' non ci vanno, o si ritroverebbero in mezzo
  // al capannello senza motivo.
  if (!fuoriDallaCorsa(mondo)) {
    disegnaCorridore(ctx, mondo);
    disegnaInseguitori(ctx, mondo);
  }
  disegnaVignetta(ctx, mondo);

  // Il pannello serve solo mentre si gioca: sulle schermate i numeri ci sono
  // gia', piu' grandi, e ripeterli in piccolo e' solo rumore. Il pulsante
  // invece resta anche in pausa, perche' e' quello che fa riprendere.
  if (mondo.stato === 'in-gioco' || mondo.stato === 'apparizione') {
    disegnaHud(ctx, mondo, interfaccia);
  }
  if (mondo.stato === 'in-gioco' || mondo.stato === 'pausa') {
    disegnaPulsantePausa(ctx, mondo, interfaccia);
  }

  if (mondo.stato === 'apparizione') disegnaApparizione(ctx, mondo);
  if (mondo.stato === 'attesa') disegnaSchermataIniziale(ctx, mondo, interfaccia);
  if (mondo.stato === 'istruzioni') disegnaIstruzioni(ctx, mondo);
  if (mondo.stato === 'pausa') disegnaSchermataPausa(ctx, mondo, interfaccia);
  if (mondo.stato === 'finita') disegnaSchermataFine(ctx, mondo, interfaccia);
}

/** Un pulsante rettangolare con la sua scritta. */
function disegnaPulsante(ctx, area, testo, unita, evidenza = false) {
  ctx.fillStyle = evidenza ? 'rgba(244,129,60,0.9)' : 'rgba(28,32,40,0.72)';
  riquadroTondo(ctx, area.x, area.y, area.larghezza, area.altezza, area.altezza / 2);
  ctx.fill();
  ctx.strokeStyle = evidenza ? 'rgba(255,255,255,0.5)' : 'rgba(247,248,250,0.4)';
  ctx.lineWidth = Math.max(1, unita * 0.004);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORI.testo;
  corpoCheCiSta(ctx, testo, area.altezza * 0.42, area.larghezza * 0.86, 700);
  ctx.fillText(testo, area.x + area.larghezza / 2, area.y + area.altezza / 2);
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
 *  sagoma che scorre lentissima. Serve a non lasciare vuoto il punto di fuga. */
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

  ctx.fillStyle = COLORI.marciapiede;
  ctx.fillRect(0, vista.orizzonte, vista.larghezza, vista.altezza - vista.orizzonte);

  for (const lato of [-1, 1]) {
    ctx.fillStyle = COLORI.marciapiedeChiaro;
    fascia(ctx, vista, lato * BORDO_MARCIAPIEDE, lato * FILO_PALAZZI, zVicino, zLontano, 0.16);
  }

  disegnaSedeTranviaria(ctx, vista, zVicino, zLontano);
  disegnaFasciaSosta(ctx, vista, zVicino, zLontano);

  const asfalto = ctx.createLinearGradient(0, vista.orizzonte, 0, vista.altezza);
  asfalto.addColorStop(0, COLORI.asfaltoLontano);
  asfalto.addColorStop(0.35, COLORI.asfalto);
  asfalto.addColorStop(1, '#3f4248');
  ctx.fillStyle = asfalto;
  fascia(ctx, vista, -SEMI_STRADA, SEMI_STRADA, zVicino, zLontano);

  disegnaRattoppi(ctx, vista, scorrimento);
  disegnaTombini(ctx, vista, scorrimento);
  disegnaStrisce(ctx, vista, scorrimento);
  disegnaAttraversamenti(ctx, vista, scorrimento);

  ctx.fillStyle = COLORI.cordolo;
  for (const lato of [-1, 1]) {
    parete(ctx, vista, lato * BORDO_MARCIAPIEDE, 0, 0.16, zVicino, zLontano);
  }
}

/** La sede del tram: asfalto piu' chiaro e due rotaie lucide che corrono lungo
 *  tutta la strada. E' il pezzo di Milano che si vede senza spiegarlo. */
function disegnaSedeTranviaria(ctx, vista, zVicino, zLontano) {
  const segno = LATO_TRAM;
  ctx.fillStyle = COLORI.sede;
  fascia(ctx, vista, segno * BORDO_STRADA, segno * BORDO_MARCIAPIEDE, zVicino, zLontano, 0.005);

  for (const distanza of ROTAIE) {
    const x = segno * distanza;
    ctx.fillStyle = '#3a3d43';
    fascia(ctx, vista, x - 0.11, x + 0.11, zVicino, zLontano, 0.01);
    ctx.fillStyle = COLORI.rotaia;
    fascia(ctx, vista, x - 0.045, x + 0.045, zVicino, zLontano, 0.02);
  }
}

function disegnaFasciaSosta(ctx, vista, zVicino, zLontano) {
  const segno = LATO_SOSTA;
  ctx.fillStyle = COLORI.sosta;
  fascia(ctx, vista, segno * BORDO_STRADA, segno * BORDO_MARCIAPIEDE, zVicino, zLontano, 0.005);
  ctx.fillStyle = 'rgba(82,116,168,0.75)';
  fascia(ctx, vista, segno * (BORDO_STRADA + 0.15), segno * (BORDO_STRADA + 0.27), zVicino, zLontano, 0.012);
}

/** I rattoppi dell'asfalto. Grigi, mai neri: un rattoppo scuro si legge come
 *  una buca, e in un gioco dove le buche si saltano sarebbe un inganno. */
function disegnaRattoppi(ctx, vista, scorrimento) {
  for (const rattoppo of CITTA.rattoppi) {
    const z = zRelativo(rattoppo.z, scorrimento);
    if (z > 70 || z < CODA_ARREDI) continue;
    ctx.fillStyle = rattoppo.chiaro ? COLORI.rattoppoChiaro : COLORI.rattoppoScuro;
    fascia(
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
      fascia(ctx, vista, x - 0.09, x + 0.09, vicino, lontano, 0.01);
    }
  }

  ctx.fillStyle = COLORI.strisciaConsumata;
  for (const lato of [-1, 1]) {
    const x = lato * (SEMI_STRADA - 0.22);
    fascia(ctx, vista, x - 0.07, x + 0.07, -DISTANZA_CAMERA + 0.5, DISTANZA_VISIBILE, 0.01);
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
      fascia(ctx, vista, x, x + 0.46, Math.max(z - 1.6, CODA_ARREDI), z + 1.6, 0.011);
    }
  }
}

// --- citta' ----------------------------------------------------------------

/** La citta' si disegna in **due passate**: prima i palazzi, poi tutto quello
 *  che sta fra loro e la strada — alberi, lampioni, cartelli, auto, tram.
 *
 *  Non e' un vezzo. L'ordine di disegno fa da profondita', e un palazzo e'
 *  lungo venti metri: ordinando tutto insieme per la sola z d'attacco, un
 *  palazzo che comincia poco piu' avanti finisce sopra un cartello che gli sta
 *  davanti di lato. Due passate tolgono il problema alla radice, perche' gli
 *  arredi stanno **sempre** piu' vicini alla strada dei muri. */
function disegnaCitta(ctx, vista, scorrimento) {
  const palazzi = [];
  const cose = [];
  const aggiungi = (z, disegna) => cose.push({ z, disegna });

  for (const edificio of CITTA.edifici) {
    const z = zRelativo(edificio.z, scorrimento);
    if (z > DISTANZA_VISIBILE || z + edificio.profondita < CODA_ARREDI) continue;
    palazzi.push({ z, disegna: () => disegnaEdificio(ctx, vista, edificio, z) });
  }

  palazzi.sort((a, b) => b.z - a.z);
  for (const palazzo of palazzi) palazzo.disegna();

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
  for (const fermata of CITTA.metro) {
    const z = zRelativo(fermata.z, scorrimento);
    if (z > 70 || z < CODA_ARREDI) continue;
    aggiungi(z, () => disegnaSegnaleMetro(ctx, vista, fermata, z));
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

function disegnaEdificio(ctx, vista, edificio, z) {
  const zVicino = Math.max(z, CODA_ARREDI);
  const zLontano = z + edificio.profondita;
  if (zLontano <= CODA_ARREDI) return;

  if (edificio.monumento) {
    const x = edificio.lato * FILO_MONUMENTI;
    disegnaFiancoMonumento(ctx, vista, edificio, x, zVicino, zLontano);
    if (z > 0.4) {
      disegnaFacciataMonumento(ctx, vista, edificio, z, x, edificio.lato * (FILO_MONUMENTI + edificio.larghezza));
    }
    return;
  }

  const x = edificio.lato * FILO_PALAZZI;
  const fuori = edificio.lato * (FILO_PALAZZI + PROFONDITA_ISOLATO);
  const h = edificio.altezza;

  // la testa per prima: il fianco le sta davanti e la copre dove si toccano
  if (z > 0.4) {
    ctx.fillStyle = COLORI.testaPalazzo;
    testa(ctx, vista, z, x, fuori, 0, h);
  }

  ctx.fillStyle = COLORI.palazzi[edificio.tinta % COLORI.palazzi.length];
  parete(ctx, vista, x, 0, h, zVicino, zLontano);

  disegnaPianiEFinestre(ctx, vista, edificio, x, zVicino, zLontano);
  if (edificio.vetrine) disegnaPianoTerra(ctx, vista, edificio, x, zVicino, zLontano);

  ctx.fillStyle = COLORI.tetto;
  parete(ctx, vista, x, h, h + 0.6, zVicino, zLontano);
}

/** Le finestre sono riquadri veri con il loro contorno chiaro, la persiana
 *  socchiusa e il davanzale: da vicino la differenza fra un palazzo e una
 *  parete colorata sta tutta qui. Piu' in la' di settanta metri si smette,
 *  perche' li' non si distinguono comunque. */
function disegnaPianiEFinestre(ctx, vista, edificio, x, zVicino, zLontano) {
  if (zVicino > 75) return;
  const h = edificio.altezza;
  const partenza = edificio.vetrine ? 4.2 : 1.6;
  const piani = Math.max(1, Math.floor((h - partenza) / 3.1));
  const colonne = Math.max(1, Math.round((zLontano - zVicino) / 3.2));
  const passoZ = (zLontano - zVicino) / colonne;
  const vicino = zVicino < 38;

  for (let p = 0; p < piani; p += 1) {
    const yBasso = partenza + p * 3.1 + 0.9;
    const yAlto = yBasso + 1.55;

    if (edificio.balconi) {
      // la soletta e la ringhiera: il balcone a filo di un palazzo milanese
      ctx.fillStyle = COLORI.balcone;
      parete(ctx, vista, x - edificio.lato * 0.22, yBasso - 0.95, yBasso - 0.78, zVicino, zLontano);
      if (vicino) {
        ctx.strokeStyle = 'rgba(70,66,60,0.55)';
        for (let b = 0; b < colonne * 4; b += 1) {
          const z = zVicino + ((zLontano - zVicino) * (b + 0.5)) / (colonne * 4);
          linea(ctx, vista, [x - edificio.lato * 0.2, yBasso - 0.78, z], [x - edificio.lato * 0.2, yBasso - 0.2, z], 'rgba(70,66,60,0.5)', 0.035);
        }
        ctx.fillStyle = COLORI.balcone;
        parete(ctx, vista, x - edificio.lato * 0.22, yBasso - 0.24, yBasso - 0.18, zVicino, zLontano);
      }
    }

    for (let c = 0; c < colonne; c += 1) {
      const zDa = zVicino + c * passoZ + passoZ * 0.34;
      const zA = zVicino + c * passoZ + passoZ * 0.66;
      const dentro = x - edificio.lato * 0.04;

      // contorno chiaro attorno alla finestra
      if (vicino) {
        ctx.fillStyle = 'rgba(248,245,238,0.75)';
        parete(ctx, vista, dentro, yBasso - 0.16, yAlto + 0.16, zDa - 0.16, zA + 0.16);
      }
      ctx.fillStyle = COLORI.vetrina;
      parete(ctx, vista, x - edificio.lato * 0.06, yBasso, yAlto, zDa, zA);

      if (!vicino) continue;
      // la persiana tirata su a meta', diversa da finestra a finestra
      const quanta = ((p * 7 + c * 3 + edificio.tinta) % 4) * 0.22;
      if (quanta > 0) {
        ctx.fillStyle = '#8e8f7e';
        parete(ctx, vista, x - edificio.lato * 0.07, yAlto - 1.55 * quanta, yAlto, zDa, zA);
      }
      // il davanzale
      ctx.fillStyle = 'rgba(238,234,226,0.85)';
      parete(ctx, vista, x - edificio.lato * 0.1, yBasso - 0.12, yBasso - 0.02, zDa - 0.18, zA + 0.18);
    }
  }

  // marcapiano fra il piano terra e il primo piano, e cornicione in cima
  ctx.fillStyle = 'rgba(250,246,238,0.5)';
  parete(ctx, vista, x - edificio.lato * 0.08, partenza + 0.2, partenza + 0.5, zVicino, zLontano);
}

/** Il piano terra di una via commerciale, negozio per negozio: vetrina scura,
 *  tenda da sole, insegna. E' la fascia che si ha sotto gli occhi correndo.
 *
 *  I negozi sono **spezzati**, non una fascia continua lungo tutto l'isolato:
 *  una tenda unica lunga trenta metri diventa un nastro colorato, e nessuna
 *  via ha un nastro colorato al posto delle vetrine. */
function disegnaPianoTerra(ctx, vista, edificio, x, zVicino, zLontano) {
  if (zVicino > 70) return;
  const dentro = x - edificio.lato * 0.05;

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

    ctx.fillStyle = COLORI.palazzi[edificio.tinta % COLORI.palazzi.length];
    parete(ctx, vista, dentro, 0.4, 3.4, zVicino + i * passo, da);

    if ((edificio.insegna + i) % 3 !== 0) {
      const sporgenza = x - edificio.lato * 1.5;
      ctx.fillStyle = COLORI.tenda[tinta];
      fascia(ctx, vista, Math.min(dentro, sporgenza), Math.max(dentro, sporgenza), da, a, 3.5);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      parete(ctx, vista, sporgenza, 3.15, 3.5, da, a);
    }

    ctx.fillStyle = i % 2 === 0 ? 'rgba(246,244,238,0.9)' : COLORI.tenda[tinta];
    parete(ctx, vista, dentro, 3.65, 4.1, da, a);
  }
}

/** Un platano del filare: tronco dritto, chioma larga. Sono loro a dire
 *  "viale" invece che "strada". */
function disegnaAlbero(ctx, vista, albero, z) {
  const x = albero.lato * (BORDO_MARCIAPIEDE + 1.1);
  const altezza = 5.4 * albero.taglia;
  linea(ctx, vista, [x, 0.16, z], [x, altezza * 0.55, z], COLORI.tronco, 0.34);

  const raggio = 2.1 * albero.taglia;
  const tinta = (indice) => COLORI.albero[(Math.floor(albero.z) + indice) % COLORI.albero.length];
  chioma(ctx, vista, x, z, altezza * 0.78, raggio, tinta(0));
  chioma(ctx, vista, x, z - raggio * 0.5, altezza * 0.62, raggio * 0.7, tinta(1));
  chioma(ctx, vista, x, z + raggio * 0.5, altezza * 0.66, raggio * 0.72, tinta(2));
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

/** Il cartello di una fermata della metro: il palo, il quadrato rosso con la M
 *  bianca e il nome della stazione.
 *
 *  Il pannello guarda la telecamera (sta tutto su una z sola), quindi la
 *  scritta si puo' disegnare dritta con `fillText`: su un piano a z costante la
 *  proiezione e' affine, e un testo orizzontale resta orizzontale. Il cartello
 *  sta dalla parte dei palazzi, mai sopra la strada. */
function disegnaSegnaleMetro(ctx, vista, fermata, z) {
  const xPalo = fermata.lato * (BORDO_MARCIAPIEDE + 1.9);
  linea(ctx, vista, [xPalo, 0.16, z], [xPalo, 3.4, z], '#5b5f66', 0.12);

  // il pannello e' generoso: uno a misura di realta' sarebbe illeggibile gia'
  // a venti metri, e un cartello che non si legge non e' un cartello
  const dentro = fermata.lato > 0 ? xPalo - 0.4 : xPalo - 2.5;
  const fuori = dentro + 2.9;
  const base = 2.4;
  const alto = 3.25;

  ctx.fillStyle = '#c8332b';
  testa(ctx, vista, z, dentro, fuori, base, alto);

  const p = proietta(vista, (dentro + fuori) / 2, (base + alto) / 2, z);
  if (p.scala < 4) return; // troppo lontano perche' si legga qualcosa

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f6f7f9';

  const pM = proietta(vista, dentro + 0.44, (base + alto) / 2, z);
  ctx.font = `800 ${0.66 * p.scala}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('M', pM.x, pM.y);

  const pNome = proietta(vista, dentro + 1.72, (base + alto) / 2, z);
  let corpo = 0.42 * p.scala;
  const massima = 2.1 * p.scala;
  for (let tentativo = 0; tentativo < 10; tentativo += 1) {
    ctx.font = `700 ${corpo}px system-ui, -apple-system, sans-serif`;
    if (ctx.measureText(fermata.nome).width <= massima) break;
    corpo *= 0.9;
  }
  ctx.fillText(fermata.nome, pNome.x, pNome.y);
}

function disegnaPaloLinea(ctx, vista, z) {
  const x = LATO_TRAM * (BORDO_MARCIAPIEDE + 0.4);
  linea(ctx, vista, [x, 0.16, z], [x, 8.2, z], COLORI.palo, 0.2);
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

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  fascia(ctx, vista, dentro - 0.1 * LATO_SOSTA, fuori + 0.1 * LATO_SOSTA, zVicino, zLontano, 0.008);

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
    coda: CODA_ARREDI,
  });

  if (zVicino < 40) {
    ctx.fillStyle = COLORI.vetroAuto;
    const yVetro = auto.furgone ? [1.3, 2.1] : [0.95, 1.32];
    parete(ctx, vista, dentro - LATO_SOSTA * 0.02, yVetro[0], yVetro[1], zVicino + 0.8, zLontano - 0.9);
  }

  // Ruote. Non si disegnano sull'auto che si sta superando: a mezzo metro
  // dall'obiettivo diventano due dischi neri grandi come lo schermo.
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
    tetto: '#d9cfba',
    fronte: COLORI.tramCorpo,
    coda: CODA_ARREDI,
  });

  // La livrea del 1500, quello vero: arancione sotto, panna dalla cintura dei
  // finestrini in su, e i telai in legno scuro. E' la combinazione a farlo
  // riconoscere, non la forma della cassa.
  const filo = dentro - LATO_TRAM * 0.02;
  ctx.fillStyle = COLORI.tramFascia;
  parete(ctx, vista, filo, 2.42, 3.3, zVicino, zLontano);
  ctx.fillStyle = COLORI.tramLegno;
  parete(ctx, vista, filo, 2.32, 2.46, zVicino, zLontano);
  // il profilo panna anche in basso, sotto i finestrini
  ctx.fillStyle = COLORI.tramFascia;
  parete(ctx, vista, filo, 0.42, 0.56, zVicino, zLontano);

  // finestrini alti, coi montanti in legno fra l'uno e l'altro
  const quanti = 7;
  const passo = lunghezza / quanti;
  for (let i = 0; i < quanti; i += 1) {
    const da = zVicino + i * passo + passo * 0.16;
    const a = zVicino + (i + 1) * passo - passo * 0.16;
    // le due porte, piu' scure e piu' alte
    const porta = i === 1 || i === 5;
    ctx.fillStyle = COLORI.tramLegno;
    parete(ctx, vista, dentro - LATO_TRAM * 0.03, porta ? 0.62 : 1.28, 2.46, da - 0.12, a + 0.12);
    ctx.fillStyle = COLORI.tramVetro;
    parete(ctx, vista, dentro - LATO_TRAM * 0.04, porta ? 0.95 : 1.42, 2.34, da, a);
  }

  // il numero di vettura sulla fiancata
  const pNumero = proietta(vista, dentro, 1.0, z + lunghezza * 0.34);
  if (pNumero.scala > 6) {
    ctx.fillStyle = COLORI.tramFascia;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${0.5 * pNumero.scala}px system-ui, -apple-system, sans-serif`;
    ctx.fillText('1623', pNumero.x, pNumero.y);
  }

  // Il tetto: una calotta piu' stretta della cassa, che sporge sui due lati.
  // E' quella a togliere al tram l'aria di scatola da scarpe.
  ctx.fillStyle = '#cfc5b0';
  fascia(ctx, vista, dentro - LATO_TRAM * 0.06, fuori + LATO_TRAM * 0.06, zVicino, zLontano, 3.32);
  ctx.fillStyle = '#b9ae99';
  parete(ctx, vista, dentro - LATO_TRAM * 0.06, 3.24, 3.32, zVicino, zLontano);

  // lo zoccolo scuro e i due carrelli sotto la cassa
  ctx.fillStyle = COLORI.tramLegno;
  parete(ctx, vista, filo, 0.3, 0.44, zVicino, zLontano);
  ctx.fillStyle = '#26282d';
  for (const zCarrello of [zVicino + lunghezza * 0.22, zLontano - lunghezza * 0.22]) {
    parete(ctx, vista, dentro - LATO_TRAM * 0.06, 0.02, 0.34, zCarrello - 1.1, zCarrello + 1.1);
    for (const zRuota of [zCarrello - 0.7, zCarrello + 0.7]) {
      const ruota = proietta(vista, dentro, 0.32, zRuota);
      if (ruota.scala <= 0) continue;
      ctx.beginPath();
      ctx.arc(ruota.x, ruota.y, 0.3 * ruota.scala, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // La coda, che e' la faccia che si vede arrivandogli dietro: finestrone,
  // cassa della linea col numero, fanali rossi e respingente.
  if (zVicino > 0.4) {
    const centro = (dentro + fuori) / 2;
    ctx.fillStyle = COLORI.tramFascia;
    testa(ctx, vista, zVicino, dentro, fuori, 2.42, 3.3);
    ctx.fillStyle = COLORI.tramLegno;
    testa(ctx, vista, zVicino, dentro, fuori, 2.3, 2.46);
    ctx.fillStyle = COLORI.tramVetro;
    testa(ctx, vista, zVicino, dentro - LATO_TRAM * 0.25, fuori + LATO_TRAM * 0.25, 1.5, 2.3);

    // la cassa della linea, nera con il numero
    ctx.fillStyle = '#1d2024';
    testa(ctx, vista, zVicino, dentro - LATO_TRAM * 0.5, fuori + LATO_TRAM * 0.5, 2.62, 3.12);
    const pLinea = proietta(vista, centro, 2.87, zVicino);
    if (pLinea.scala > 7) {
      ctx.fillStyle = '#f2ead0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${0.42 * pLinea.scala}px system-ui, -apple-system, sans-serif`;
      ctx.fillText('19', pLinea.x, pLinea.y);
    }

    // fanali e respingente
    ctx.fillStyle = '#c0392b';
    for (const lato of [-0.55, 0.55]) {
      const fanale = proietta(vista, centro + lato, 1.15, zVicino);
      ctx.beginPath();
      ctx.arc(fanale.x, fanale.y, 0.14 * fanale.scala, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = COLORI.tramLegno;
    testa(ctx, vista, zVicino, dentro - LATO_TRAM * 0.1, fuori + LATO_TRAM * 0.1, 0.5, 0.72);
  }

  // l'asta del trolley verso il filo
  linea(ctx, vista, [(dentro + fuori) / 2, 3.34, z + 3], [(dentro + fuori) / 2, 5.5, z - 1], COLORI.tramLegno, 0.07);
}

/** I fili della linea aerea, tirati lungo la sede del tram. */
function disegnaLineaAerea(ctx, vista) {
  const x = LATO_TRAM * (BORDO_STRADA + 1.4);
  const vicino = -DISTANZA_CAMERA + 1;
  linea(ctx, vista, [x, 5.6, vicino], [x, 5.6, DISTANZA_VISIBILE], COLORI.cavo, 0.05);
  linea(
    ctx,
    vista,
    [x - LATO_TRAM * 0.5, 6.4, vicino],
    [x - LATO_TRAM * 0.5, 6.4, DISTANZA_VISIBILE],
    'rgba(40,42,48,0.3)',
    0.04,
  );
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
  if (ostacolo.tipo === AIUOLA) return disegnaAiuola(ctx, vista, ostacolo, z);
  if (ostacolo.tipo === MONOPATTINO) return disegnaMonopattinoConMaranza(ctx, vista, ostacolo, z, mondo);
  if (ostacolo.tipo === ARCO) {
    return disegnaArco(ctx, vista, z, 22, BORDO_MARCIAPIEDE, LARGHEZZA_CORSIA / 2);
  }
  return disegnaPonticello(ctx, vista, ostacolo, z);
}

function estremiCorsie(ostacolo) {
  const corsie = corsieOstacolo(ostacolo);
  const sinistra = bordoSinistroDiCorsia(corsie[0]);
  const destra = bordoSinistroDiCorsia(corsie[corsie.length - 1]) + LARGHEZZA_CORSIA;
  return { sinistra, destra };
}

/** Quanto e' profonda una buca, in metri. Non conta per il gioco — nella buca
 *  si cade e basta — ma e' quello che la fa sembrare una buca e non una
 *  macchia di vernice. */
const PROFONDITA_BUCA = 0.7;

/** Traccia il contorno irregolare della buca a una certa quota, senza
 *  riempirlo. `gonfia` allarga o stringe la stessa forma: e' cosi' che si
 *  ricavano bordo, imboccatura e fondo senza descriverla tre volte. */
function tracciaContornoBuca(ctx, vista, buca, z, sinistra, destra, gonfia, y) {
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
}

/** Una buca con dentro il suo vuoto.
 *
 *  Il trucco della profondita' e' tutto nel ritaglio: si limita il disegno
 *  all'imboccatura e dentro ci si mette il fondo, che e' la stessa forma
 *  settanta centimetri piu' in basso e quindi proiettata piu' in giu'. Quel
 *  che avanza fra le due — la striscia in alto — e' la **parete di fondo**
 *  della buca, l'unica che da questa telecamera si vede davvero: quella
 *  vicina guarda dall'altra parte, ed e' giusto che resti nascosta.
 *
 *  Senza il ritaglio il fondo sborderebbe in basso, sull'asfalto che sta
 *  *davanti* alla buca, e sembrerebbe un'ombra sbavata. */
function disegnaBuca(ctx, vista, buca, z) {
  const { sinistra, destra } = estremiCorsie(buca);
  const imboccatura = 0.9;

  // l'asfalto sbriciolato tutto attorno
  ctx.fillStyle = COLORI.bucaBordo;
  tracciaContornoBuca(ctx, vista, buca, z, sinistra, destra, 1, 0.012);
  ctx.fill();

  ctx.save();
  tracciaContornoBuca(ctx, vista, buca, z, sinistra, destra, imboccatura, 0.014);
  ctx.clip();

  // le pareti, che riempiono tutta l'imboccatura
  ctx.fillStyle = buca.travolto ? '#3a3d43' : COLORI.bucaParete;
  ctx.fill();

  // il fondo, alla sua quota
  ctx.fillStyle = buca.travolto ? '#2b2e34' : COLORI.bucaFondo;
  tracciaContornoBuca(ctx, vista, buca, z, sinistra, destra, imboccatura * 0.92, -PROFONDITA_BUCA);
  ctx.fill();
  ctx.restore();

  // il labbro chiaro sul bordo lontano: e' la luce che entra e si ferma li',
  // ed e' quello che fa capire in un colpo d'occhio che il buco e' profondo
  ctx.strokeStyle = 'rgba(150,154,162,0.5)';
  ctx.lineWidth = Math.max(1, 0.05 * proietta(vista, 0, 0, z).scala);
  ctx.beginPath();
  const semiX = ((destra - sinistra) / 2) * imboccatura;
  const semiZ = (buca.profondita / 2) * imboccatura;
  const centroX = (sinistra + destra) / 2;
  let iniziato = false;
  for (const [ux, uz] of buca.contorno) {
    if (uz < 0.25) {
      iniziato = false;
      continue;
    }
    const p = proietta(vista, centroX + ux * semiX, 0.015, z + uz * semiZ);
    if (!iniziato) {
      ctx.moveTo(p.x, p.y);
      iniziato = true;
    } else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

/** Un'aiuola del sindaco: cassone di cemento, terra dentro e l'erba alta che
 *  non taglia nessuno. Si scavalca. */
function disegnaAiuola(ctx, vista, aiuola, z) {
  const { sinistra, destra } = estremiCorsie(aiuola);
  const zVicino = z - aiuola.profondita / 2;
  const zLontano = z + aiuola.profondita / 2;
  const bordo = 0.42;

  // il cassone: fianco verso di noi, poi il bordo superiore
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  fascia(ctx, vista, sinistra - 0.1, destra + 0.1, zVicino, zLontano + 0.2, 0.008);

  ctx.fillStyle = '#8d8579';
  testa(ctx, vista, zVicino, sinistra, destra, 0, bordo);
  ctx.fillStyle = '#9d968a';
  fascia(ctx, vista, sinistra, destra, zVicino, zLontano, bordo);
  // la terra dentro, un filo piu' bassa del bordo
  ctx.fillStyle = '#4a3d31';
  fascia(ctx, vista, sinistra + 0.12, destra - 0.12, zVicino + 0.12, zLontano - 0.12, bordo - 0.06);

  // l'erba: ciuffi alti e disordinati, sempre gli stessi per la stessa aiuola
  let stato = (aiuola.seme + 1) >>> 0;
  const caso = () => {
    stato = (Math.imul(stato, 1664525) + 1013904223) >>> 0;
    return stato / 4294967296;
  };
  const quanti = Math.round((destra - sinistra) * 14);
  for (let i = 0; i < quanti; i += 1) {
    const x = sinistra + 0.15 + caso() * (destra - sinistra - 0.3);
    const zCiuffo = zVicino + 0.15 + caso() * (aiuola.profondita - 0.3);
    const alto = bordo + 0.3 + caso() * 0.55;
    const piega = (caso() - 0.5) * 0.5;
    const base = proietta(vista, x, bordo - 0.05, zCiuffo);
    const cima = proietta(vista, x + piega, alto, zCiuffo);
    ctx.strokeStyle = i % 3 === 0 ? '#6f8f4a' : i % 3 === 1 ? '#57783c' : '#7fa055';
    ctx.lineWidth = Math.max(1, 0.045 * base.scala);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.quadraticCurveTo((base.x + cima.x) / 2 - piega * base.scala * 0.3, (base.y + cima.y) / 2, cima.x, cima.y);
    ctx.stroke();
  }
}

/** Il ponticello di ghisa: due spalle in pietra, l'arcata ribassata, la
 *  ringhiera a volute e le statuine sui pilastrini. Ci si passa **sotto**, e
 *  l'intradosso sta a ALTEZZA_PONTICELLO: e' quella la quota che decide. */
function disegnaPonticello(ctx, vista, ponticello, z) {
  const { sinistra, destra } = estremiCorsie(ponticello);
  const y = ALTEZZA_PONTICELLO;
  const spalla = 0.55;
  const zVicino = z - ponticello.profondita / 2;
  const zLontano = z + ponticello.profondita / 2;
  const daX = sinistra - 0.35;
  const aX = destra + 0.35;

  // ombra sotto l'arcata, tenue: marcata si leggerebbe come una buca
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  fascia(ctx, vista, daX, aX, zVicino, zLontano, 0.015);

  // le due spalle in pietra, che scendono a terra fuori dal varco
  for (const x of [daX - spalla, aX]) {
    ctx.fillStyle = '#9a9287';
    testa(ctx, vista, zVicino, x, x + spalla, 0, y + 1.5);
    ctx.fillStyle = '#877f74';
    parete(ctx, vista, x + (x < 0 ? spalla : 0), 0, y + 1.5, zVicino, zLontano);
  }

  // l'impalcato: l'arcata ribassata sotto e la fascia piena sopra
  const arcata = [];
  for (let i = 0; i <= 14; i += 1) {
    const t = i / 14;
    arcata.push([daX + (aX - daX) * t, y + Math.sin(t * Math.PI) * 0.3]);
  }
  arcata.push([aX, y + 1.05], [daX, y + 1.05]);
  ctx.fillStyle = '#8f9299';
  ctx.beginPath();
  arcata.forEach(([x, altezza], i) => {
    const p = proietta(vista, x, altezza, zVicino);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fill();

  // il piano del ponte, visto di taglio
  ctx.fillStyle = '#a8a49b';
  testa(ctx, vista, zVicino, daX, aX, y + 1.05, y + 1.22);
  ctx.fillStyle = '#8b877e';
  fascia(ctx, vista, daX, aX, zVicino, zLontano, y + 1.22);

  // la ringhiera a volute
  const p = proietta(vista, 0, y, zVicino);
  ctx.strokeStyle = '#4f545c';
  ctx.lineWidth = Math.max(1, 0.05 * p.scala);
  const alto = proietta(vista, 0, y + 1.85, zVicino);
  ctx.beginPath();
  ctx.moveTo(proietta(vista, daX, y + 1.85, zVicino).x, alto.y);
  ctx.lineTo(proietta(vista, aX, y + 1.85, zVicino).x, alto.y);
  ctx.stroke();
  const passo = (aX - daX) / 12;
  for (let i = 0; i <= 12; i += 1) {
    const x = daX + i * passo;
    const basso = proietta(vista, x, y + 1.22, zVicino);
    const cima = proietta(vista, x, y + 1.85, zVicino);
    ctx.beginPath();
    ctx.moveTo(basso.x, basso.y);
    ctx.lineTo(cima.x, cima.y);
    ctx.stroke();
    if (i % 2 === 0) continue;
    // le volute fra un montante e l'altro
    const mezzo = proietta(vista, x, y + 1.54, zVicino);
    ctx.beginPath();
    ctx.arc(mezzo.x, mezzo.y, 0.28 * mezzo.scala, 0, Math.PI * 2);
    ctx.stroke();
  }

  // i pilastrini con le statuine, uno per spalla
  for (const x of [daX - spalla / 2, aX + spalla / 2]) {
    const base = proietta(vista, x, y + 1.22, zVicino);
    const dado = proietta(vista, x, y + 2.05, zVicino);
    ctx.fillStyle = '#b0aa9f';
    ctx.fillRect(base.x - 0.3 * base.scala, dado.y, 0.6 * base.scala, base.y - dado.y);
    ctx.fillStyle = ponticello.versoDestra ? '#8d8677' : '#948d7e';
    ctx.beginPath();
    ctx.ellipse(dado.x, dado.y - 0.22 * dado.scala, 0.22 * dado.scala, 0.32 * dado.scala, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function disegnaMonopattinoConMaranza(ctx, vista, ostacolo, z, mondo) {
  const x = xDiCorsia(ostacolo.corsiaInizio);
  const p = proietta(vista, x, 0, z);
  if (p.scala <= 0) return;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, 0.4 * p.scala, 0.14 * p.scala, 0, 0, Math.PI * 2);
  ctx.fill();

  const sbanda = Math.sin(mondo.tempo * 3 + ostacolo.sbandata * 6) * 0.05;
  conFigura(ctx, p.x, p.y, p.scala, () => {
    ctx.rotate(sbanda);
    // Viene verso di noi, quindi lo si vede di faccia: faro acceso e non
    // catarifrangente, e il maranza che ti guarda mentre arriva.
    disegnaMonopattinoDiFronte(ctx, { accento: ostacolo.sbandata > 0.5 ? '#6fd18a' : '#e8b23c' });
    disegnaMaranzaInSella(ctx, {
      colore: COLORI.maranza,
      luce: COLORI.maranzaLuce,
      base: 0.16,
      cappello: CAPPELLI[Math.floor(ostacolo.sbandata * 4) % CAPPELLI.length],
      borsello: COLORI.borsello,
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
  const colore = COLORI_BONUS[raccolta.tipo] || COLORI.scudo;

  // l'alone, che vale per tutti: un bonus si deve vedere da lontano
  const alone = ctx.createRadialGradient(p.x, p.y, raggio * 0.2, p.x, p.y, raggio * 2.2);
  alone.addColorStop(0, colore);
  alone.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 0.45 + 0.25 * Math.sin(tempo * 5);
  ctx.fillStyle = alone;
  ctx.beginPath();
  ctx.arc(p.x, p.y, raggio * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // La calamita non e' un disco: e' una carta di credito, che gira su se'
  // stessa come le monete.
  if (raccolta.tipo === CALAMITA) {
    const giro = Math.abs(Math.cos(tempo * 2.4 + raccolta.z));
    disegnaCartaDiCredito(ctx, p.x, p.y, raggio * 1.5 * Math.max(0.12, giro), raggio * 0.95);
    return;
  }

  if (raccolta.tipo === MADONNINA) {
    conFigura(ctx, p.x, p.y + raggio, raggio * 2.1, () => disegnaMadonnina(ctx, { tempo }));
    return;
  }

  if (raccolta.tipo === SPRITZ) {
    conFigura(ctx, p.x, p.y + raggio * 0.9, raggio * 1.9, () => disegnaSpritz(ctx, { tempo }));
    return;
  }

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

/** Una carta di credito: banda magnetica, chip dorato e il numero in rilievo.
 *  `mezzaLarghezza` si stringe quando la carta e' di taglio, cosi' gira. */
function disegnaCartaDiCredito(ctx, cx, cy, mezzaLarghezza, mezzaAltezza) {
  const raggio = Math.min(mezzaAltezza * 0.24, mezzaLarghezza);
  ctx.fillStyle = '#2f3d55';
  riquadroTondo(ctx, cx - mezzaLarghezza, cy - mezzaAltezza, mezzaLarghezza * 2, mezzaAltezza * 2, raggio);
  ctx.fill();

  if (mezzaLarghezza < mezzaAltezza * 0.35) return; // di taglio non si vede altro

  // banda magnetica
  ctx.fillStyle = '#16202f';
  ctx.fillRect(cx - mezzaLarghezza, cy - mezzaAltezza * 0.62, mezzaLarghezza * 2, mezzaAltezza * 0.36);
  // chip
  ctx.fillStyle = '#e0bb52';
  riquadroTondo(
    ctx,
    cx - mezzaLarghezza * 0.62,
    cy - mezzaAltezza * 0.05,
    mezzaLarghezza * 0.42,
    mezzaAltezza * 0.5,
    mezzaAltezza * 0.08,
  );
  ctx.fill();
  // il numero, tre gruppi
  ctx.fillStyle = 'rgba(226,233,242,0.75)';
  for (let i = 0; i < 3; i += 1) {
    ctx.fillRect(
      cx - mezzaLarghezza * 0.62 + i * mezzaLarghezza * 0.44,
      cy + mezzaAltezza * 0.62,
      mezzaLarghezza * 0.32,
      mezzaAltezza * 0.14,
    );
  }
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
  if (tipo === SPRITZ) {
    // il calice in miniatura: coppa, stelo e piede
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.7, cy - r * 0.9);
    ctx.lineTo(cx + r * 0.7, cy - r * 0.9);
    ctx.lineTo(cx + r * 0.22, cy + r * 0.15);
    ctx.lineTo(cx - r * 0.22, cy + r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - r * 0.09, cy + r * 0.15, r * 0.18, r * 0.6);
    ctx.fillRect(cx - r * 0.5, cy + r * 0.72, r, r * 0.2);
    return;
  }
  if (tipo === MADONNINA) {
    // una stella della corona
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angolo = (Math.PI * i) / 5 - Math.PI / 2;
      const raggio = i % 2 === 0 ? r : r * 0.42;
      const x = cx + Math.cos(angolo) * raggio;
      const y = cy + Math.sin(angolo) * raggio;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    return;
  }
  // calamita: la carta di credito in miniatura
  riquadroTondo(ctx, cx - r * 0.95, cy - r * 0.62, r * 1.9, r * 1.24, r * 0.2);
  ctx.fill();
  const tinta = ctx.fillStyle;
  ctx.fillStyle = 'rgba(20,26,38,0.65)';
  ctx.fillRect(cx - r * 0.95, cy - r * 0.34, r * 1.9, r * 0.3);
  ctx.fillStyle = tinta;
}

// --- personaggi ------------------------------------------------------------

function disegnaCorridore(ctx, mondo) {
  const vista = mondo.vista;
  const corridore = mondo.corridore;
  const x = xDiCorsia(corridore.posizione);
  const suolo = proietta(vista, x, 0, 0);
  const p = proietta(vista, x, corridore.y, 0);
  // La Madonnina batte tutto: si corre, non si guida, e si e' d'oro.
  const conMadonnina = madonninaAttiva(mondo);
  const inMacchina = !conMadonnina && scattoAttivo(mondo);

  // Lo scudo non e' una bolla: e' un poliziotto che ti corre a fianco. Si
  // disegna prima dell'omino, cosi' resta l'omino la figura in primo piano.
  if (mondo.scudo) disegnaPoliziotto(ctx, vista, corridore, mondo.tempo);

  const stretta = 1 / (1 + corridore.y * 0.8);
  ctx.fillStyle = `rgba(0,0,0,${0.32 * stretta})`;
  ctx.beginPath();
  ctx.ellipse(
    suolo.x,
    suolo.y,
    (inMacchina ? 0.7 : 0.45) * suolo.scala * stretta,
    0.16 * suolo.scala * stretta,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  const posa = abbassato(corridore) ? 'scivolata' : corridore.inAria ? 'salto' : 'corsa';
  const lampeggia = mondo.tempo < mondo.invulnerabileFinoA && Math.floor(mondo.tempo * 12) % 2 === 0;

  // la scia prima della figura: passandoci sopra sembrerebbe una gabbia
  if (inMacchina || conMadonnina) {
    disegnaScia(ctx, p, mondo.tempo, conMadonnina ? 'rgba(240,206,110,0.6)' : 'rgba(244,129,60,0.5)');
  }
  if (conMadonnina) disegnaAureola(ctx, p, mondo.tempo);

  ctx.globalAlpha = lampeggia ? 0.55 : 1;
  conFigura(ctx, p.x, p.y, p.scala, () => {
    if (corridore.inciampo > 0) ctx.rotate(Math.sin(corridore.inciampo * 40) * 0.12);

    if (inMacchina) {
      // Durante lo scatto non si corre: si sale su una macchinina rossa. Le
      // gambe stanno dentro, quindi la posa e' quella seduta e parte dal
      // sedile, non dai piedi.
      disegnaMacchinina(ctx, { corpo: COLORI.macchinina, tempo: mondo.tempo });
      disegnaFigura(ctx, {
        colore: COLORI.omino,
        luce: COLORI.ominoOmbra,
        posa: 'seduto',
        base: SEDILE_MACCHININA,
      });
      return;
    }

    disegnaFigura(ctx, {
      colore: conMadonnina ? '#f2d573' : COLORI.omino,
      luce: conMadonnina ? '#fbeeb8' : COLORI.ominoOmbra,
      fase: corridore.fase,
      posa,
    });
  });
  ctx.globalAlpha = 1;
}

/** L'aureola di chi corre con la Madonnina: un alone dorato e le stelle che
 *  girano sopra la testa. */
function disegnaAureola(ctx, p, tempo) {
  const alone = ctx.createRadialGradient(
    p.x,
    p.y - 1 * p.scala,
    0.2 * p.scala,
    p.x,
    p.y - 1 * p.scala,
    1.8 * p.scala,
  );
  alone.addColorStop(0, 'rgba(246,224,143,0.5)');
  alone.addColorStop(1, 'rgba(246,224,143,0)');
  ctx.fillStyle = alone;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 1 * p.scala, 1.8 * p.scala, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f7e296';
  for (let i = 0; i < 7; i += 1) {
    const angolo = Math.PI * (0.1 + (i / 6) * 0.8) + tempo * 1.2;
    const cx = p.x + Math.cos(angolo) * 0.42 * p.scala;
    const cy = p.y - (1.98 + Math.sin(angolo) * 0.12) * p.scala;
    ctx.beginPath();
    ctx.arc(cx, cy, 0.05 * p.scala, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Il poliziotto dello scudo: corre a fianco, dalla parte dove c'e' piu'
 *  strada, un passo fuori sincrono con l'omino perche' non sembrino due copie.
 *  Sparisce nell'istante in cui lo scudo si consuma. */
function disegnaPoliziotto(ctx, vista, corridore, tempo) {
  const lato = corridore.posizione < 1.5 ? 1 : -1;
  const x = xDiCorsia(corridore.posizione) + lato * 1.25;
  const zAffianco = -0.35;
  const suolo = proietta(vista, x, 0, zAffianco);

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(suolo.x, suolo.y, 0.42 * suolo.scala, 0.15 * suolo.scala, 0, 0, Math.PI * 2);
  ctx.fill();

  conFigura(ctx, suolo.x, suolo.y, suolo.scala, () => {
    disegnaFigura(ctx, {
      colore: COLORI.poliziaDivisa,
      luce: COLORI.poliziaLuce,
      fase: corridore.fase + 0.9,
      posa: 'corsa',
      cappello: COLORI.poliziaBerretto,
      banda: COLORI.poliziaBanda,
    });
  });

  // il lampeggiante blu sul berretto, perche' si veda anche di sfuggita
  const sopra = proietta(vista, x, 2.02, zAffianco);
  ctx.fillStyle = `rgba(90,150,235,${0.28 + 0.3 * Math.sin(tempo * 9)})`;
  ctx.beginPath();
  ctx.arc(sopra.x, sopra.y, 0.1 * sopra.scala, 0, Math.PI * 2);
  ctx.fill();
}

function disegnaScia(ctx, p, tempo, colore = 'rgba(244,129,60,0.5)') {
  ctx.strokeStyle = colore;
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
        cappello: CAPPELLI[i % CAPPELLI.length],
        borsello: COLORI.borsello,
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
 *  Serve sugli schermi stretti: senza, la riga piu' lunga esce dallo schermo. */
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
  if (madonninaAttiva(mondo)) {
    attivi.push({
      tipo: MADONNINA,
      parte: rimastoMadonnina(mondo) / DURATA_MADONNINA,
      colore: COLORI.madonnina,
    });
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

/** Il branco della schermata iniziale: quattro maranza a semicerchio, coltelli
 *  e bottiglie rotte in mano, e due monopattini appoggiati. E' il ritratto di
 *  chi ti sta per correre dietro, e si disegna **sopra** il velo scuro, cosi'
 *  restano loro la cosa piu' chiara dello schermo. */
function disegnaBranco(ctx, vista, tempo) {
  const { figure, monopattini } = postiDelBranco(vista);

  // ombre a terra, tutte insieme: cosi' nessuna finisce sopra una figura
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (const posto of [...monopattini, ...figure]) {
    ctx.beginPath();
    ctx.ellipse(posto.x, posto.y, posto.altezza * 0.26, posto.altezza * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Quattro sagome dello stesso identico nero si leggerebbero come una macchia
  // sola: ognuno ha il suo grigio, appena diverso dal vicino.
  const TONI = ['#20222a', '#2b2f38', '#191b21', '#262a33'];

  for (const [i, posto] of figure.entries()) {
    const scala = posto.altezza / ALTEZZA_OMINO;
    conFigura(ctx, posto.x, posto.y, scala, () => {
      disegnaMaranzaDiFronte(ctx, {
        colore: TONI[i % TONI.length],
        luce: COLORI.maranzaLuce,
        cappello: CAPPELLI[posto.cappello],
        borsello: COLORI.borsello,
        arma: posto.arma,
        verso: posto.verso,
        dondolo: Math.sin(tempo * 1.4 + posto.ritardo),
      });
    });
  }

  // i monopattini davanti a tutti: coprono qualche stinco e si vedono interi
  for (const posto of monopattini) {
    const scala = posto.altezza / 1.05;
    conFigura(ctx, posto.x - posto.verso * scala * 0.6, posto.y, scala, () => {
      if (posto.verso < 0) ctx.scale(-1, 1);
      disegnaMonopattinoDiLato(ctx, { accento: posto.verso > 0 ? '#6fd18a' : '#e8b23c' });
    });
  }
}

function disegnaSchermataIniziale(ctx, mondo, interfaccia) {
  const vista = mondo.vista;
  const unita = Math.min(vista.larghezza, vista.altezza * 0.62);
  velo(ctx, vista, 0.5);

  disegnaBranco(ctx, vista, mondo.tempo);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORI.testo;
  ctx.font = `800 ${unita * 0.125}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('MARANZA', vista.larghezza / 2, vista.altezza * 0.115);
  ctx.fillStyle = '#f4813c';
  ctx.fillText('ESCAPE', vista.larghezza / 2, vista.altezza * 0.115 + unita * 0.135);

  const sottotitolo = 'Ti inseguono. Non farti prendere il portafoglio';
  corpoCheCiSta(ctx, sottotitolo, unita * 0.045, vista.larghezza * 0.92);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(247,248,250,0.85)';
  ctx.fillText(sottotitolo, vista.larghezza / 2, vista.altezza * 0.28);

  const istruzioni = 'a lato il monopattino · in alto la buca · in basso il lampione';
  corpoCheCiSta(ctx, istruzioni, unita * 0.038, vista.larghezza * 0.94);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(247,248,250,0.8)';
  ctx.fillText(istruzioni, vista.larghezza / 2, vista.altezza * 0.755);

  ctx.fillStyle = COLORI.testo;
  ctx.font = `700 ${unita * 0.06}px system-ui, -apple-system, sans-serif`;
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(mondo.tempo * 3);
  ctx.fillText('tocca per scappare', vista.larghezza / 2, vista.altezza * 0.83);
  ctx.globalAlpha = 1;

  if (interfaccia.record) {
    ctx.font = `600 ${unita * 0.042}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(247,248,250,0.7)';
    ctx.fillText(`record ${interfaccia.record}`, vista.larghezza / 2, vista.altezza * 0.855);
  }

  disegnaPulsante(ctx, areaIstruzioni(vista), 'come si gioca', unita);
}

/** La pagina delle istruzioni: i tre gesti, la regola dei tre errori e i
 *  quattro poteri, ognuno col suo segno accanto. E' l'unica schermata dove si
 *  legge invece di correre, quindi il testo puo' essere piccolo ma le icone
 *  devono essere quelle vere del gioco: cosi' quando le si incontra in strada
 *  sono gia' state viste. */
function disegnaIstruzioni(ctx, mondo) {
  const vista = mondo.vista;
  const unita = Math.min(vista.larghezza, vista.altezza * 0.62);
  velo(ctx, vista, 0.82);

  const centro = vista.larghezza / 2;
  const sinistra = Math.max(vista.larghezza * 0.08, centro - unita * 0.42);
  const corpo = unita * 0.034;
  const titolo = (testo, y) => {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f4813c';
    ctx.font = `800 ${unita * 0.04}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(testo, sinistra, vista.altezza * y);
  };
  const riga = (testo, y, colonna = sinistra + unita * 0.09) => {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(247,248,250,0.92)';
    corpoCheCiSta(ctx, testo, corpo, vista.larghezza - colonna - vista.larghezza * 0.06);
    ctx.fillText(testo, colonna, vista.altezza * y);
  };

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORI.testo;
  ctx.font = `800 ${unita * 0.075}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('COME SI GIOCA', centro, vista.altezza * 0.075);

  titolo('SI SCAPPA COSÌ', 0.135);
  const gesti = [
    [0.172, 'lato', 'scorri a lato: cambi corsia'],
    [0.208, 'alto', 'scorri in alto: salti'],
    [0.244, 'basso', 'scorri in basso: ti abbassi'],
  ];
  for (const [y, verso, testo] of gesti) {
    disegnaFrecciaGesto(ctx, sinistra + unita * 0.03, vista.altezza * y, unita * 0.028, verso);
    riga(testo, y);
  }

  titolo('CHI TI VUOLE FERMARE', 0.3);
  const ostacoli = [
    [0.337, 'buche e aiuole del sindaco: si saltano'],
    [0.373, 'maranza sul monopattino, contromano: si cambia corsia'],
    [0.409, 'ponticelli: ci si abbassa e si passa sotto'],
    [0.445, "l'Arco della Pace: si passa solo dal buco in mezzo"],
  ];
  for (const [y, testo] of ostacoli) {
    ctx.fillStyle = 'rgba(247,248,250,0.45)';
    ctx.beginPath();
    ctx.arc(sinistra + unita * 0.03, vista.altezza * y, unita * 0.008, 0, Math.PI * 2);
    ctx.fill();
    riga(testo, y);
  }

  titolo('TRE ERRORI E TI PRENDONO', 0.5);
  riga('ogni errore ti mangia un terzo del distacco. e più vai avanti, più stringe', 0.537, sinistra);

  titolo('I POTERI', 0.59);
  const poteri = [
    [0.627, SCUDO, 'scudo: un poliziotto ti affianca e si mangia un errore'],
    [0.663, SCATTO, 'car sharing: macchinina rossa, velocissimo e passi attraverso'],
    [0.699, CALAMITA, 'carta di credito: le monete vengono da te da sole'],
    [0.735, SPRITZ, 'spritz: ti ridà una vita, uno solo fra due Madonnine'],
    [0.771, MADONNINA, 'Madonnina: dieci secondi al triplo, e non ti tocca nessuno'],
  ];
  for (const [y, tipo, testo] of poteri) {
    const cx = sinistra + unita * 0.03;
    const cy = vista.altezza * y;
    ctx.fillStyle = COLORI_BONUS[tipo];
    ctx.beginPath();
    ctx.arc(cx, cy, unita * 0.024, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbfcfd';
    disegnaSimboloBonus(ctx, tipo, cx, cy, unita * 0.012);
    riga(testo, y);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORI.testo;
  ctx.font = `700 ${unita * 0.05}px system-ui, -apple-system, sans-serif`;
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(mondo.tempo * 3);
  ctx.fillText('tocca per tornare', centro, vista.altezza * 0.86);
  ctx.globalAlpha = 1;
}

/** La freccia del gesto: una punta nella direzione della passata. */
function disegnaFrecciaGesto(ctx, cx, cy, r, verso) {
  ctx.fillStyle = 'rgba(247,248,250,0.9)';
  ctx.save();
  ctx.translate(cx, cy);
  if (verso === 'alto') ctx.rotate(-Math.PI / 2);
  if (verso === 'basso') ctx.rotate(Math.PI / 2);
  if (verso === 'lato') {
    // a lato la freccia e' doppia: si puo' andare da tutte e due le parti
    for (const segno of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(segno * r, 0);
      ctx.lineTo(segno * r * 0.25, -r * 0.62);
      ctx.lineTo(segno * r * 0.25, r * 0.62);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(-r * 0.4, -r * 0.7);
  ctx.lineTo(-r * 0.4, r * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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
  ctx.fillText('tocca per riprendere', vista.larghezza / 2, vista.altezza * 0.78);
  ctx.globalAlpha = 1;

  disegnaPulsante(ctx, areaCasa(vista, true), 'torna alla home', unita);
}

const SPIEGAZIONI = {
  buca: 'sei finito in una buca',
  aiuola: "sei finito in un'aiuola del sindaco",
  monopattino: 'ti ha travolto un monopattino',
  ponticello: 'hai preso in pieno il ponticello',
  arco: "sei andato addosso a un pilone dell'arco",
  raggiunto: 'ti hanno raggiunto',
};

/** L'apparizione della Madonnina: il mondo e' fermo, lei arriva dall'alto in
 *  mezzo ai raggi, e per due secondi non si gioca. */
function disegnaApparizione(ctx, mondo) {
  const vista = mondo.vista;
  const unita = Math.min(vista.larghezza, vista.altezza * 0.62);
  const t = Math.min(1, mondo.tempoApparizione / (DURATA_APPARIZIONE * 0.45));
  const uscita = Math.max(0, (mondo.tempoApparizione - DURATA_APPARIZIONE * 0.8) / (DURATA_APPARIZIONE * 0.2));

  ctx.globalAlpha = 1 - uscita;
  velo(ctx, vista, 0.55 * t);

  const cx = vista.larghezza / 2;
  const cy = vista.altezza * 0.42;
  const altezza = vista.altezza * 0.3 * (0.6 + 0.4 * t);

  // i raggi, che girano piano
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(mondo.tempoApparizione * 0.35);
  for (let i = 0; i < 16; i += 1) {
    ctx.rotate((Math.PI * 2) / 16);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(246,224,143,0.28)' : 'rgba(246,224,143,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(altezza * 2.2, -altezza * 0.13);
    ctx.lineTo(altezza * 2.2, altezza * 0.13);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  const alone = ctx.createRadialGradient(cx, cy, altezza * 0.1, cx, cy, altezza * 1.4);
  alone.addColorStop(0, 'rgba(250,236,180,0.75)');
  alone.addColorStop(1, 'rgba(250,236,180,0)');
  ctx.fillStyle = alone;
  ctx.beginPath();
  ctx.arc(cx, cy, altezza * 1.4, 0, Math.PI * 2);
  ctx.fill();

  conFigura(ctx, cx, cy + altezza * 0.55, altezza, () => {
    disegnaMadonnina(ctx, { tempo: mondo.tempoApparizione });
  });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f7e296';
  ctx.font = `800 ${unita * 0.085}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('LA MADONNINA', cx, vista.altezza * 0.68);
  ctx.fillStyle = 'rgba(247,248,250,0.8)';
  ctx.font = `600 ${unita * 0.042}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('dieci secondi che non ti prende nessuno', cx, vista.altezza * 0.74);
  ctx.globalAlpha = 1;
}

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

  corpoCheCiSta(ctx, GRIDO_SCONFITTA, unita * 0.055, vista.larghezza * 0.92, 700);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f7f8fa';
  ctx.fillText(GRIDO_SCONFITTA, vista.larghezza / 2, vista.altezza * 0.325);

  ctx.fillStyle = 'rgba(247,248,250,0.6)';
  ctx.font = `600 ${unita * 0.038}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(SPIEGAZIONI[mondo.causaFine] || 'ti hanno preso', vista.larghezza / 2, vista.altezza * 0.375);

  ctx.fillStyle = COLORI.testo;
  ctx.font = `800 ${unita * 0.12}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(String(mondo.punteggio), vista.larghezza / 2, vista.altezza * 0.45);

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
  ctx.fillText('tocca per riprovare', vista.larghezza / 2, vista.altezza * 0.7);
  ctx.globalAlpha = 1;

  disegnaPulsante(ctx, areaCasa(vista, false), 'torna alla home', unita);
}

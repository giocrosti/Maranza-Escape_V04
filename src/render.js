// Tutto il disegno sul canvas. E' l'unico modulo che sa che esiste un canvas:
// il resto del gioco non sa nemmeno di quanti pixel e' fatto lo schermo.
//
// Due idee tengono insieme il file:
//
// 1. **Si disegna dal lontano al vicino.** Non c'e' nessun controllo di
//    profondita': l'ordine di disegno *e'* la profondita'. Percio' ogni elenco
//    (palazzi, ostacoli, monete) viene ordinato per z decrescente prima di
//    passare al pennello.
// 2. **Le figure si disegnano in metri.** `conFigura` piazza l'origine ai
//    piedi del personaggio e ribalta l'asse y, cosi' dentro a quel blocco si
//    ragiona in metri con l'alto verso l'alto, e la stessa funzione serve per
//    l'omino bianco, per i maranza e per chi sta sul monopattino.

import {
  proietta,
  davantiAllaCamera,
  xDiCorsia,
  bordoSinistroDiCorsia,
  DISTANZA_CAMERA,
} from './proiezione.js';
import { SEMI_STRADA, LARGHEZZA_CORSIA, DISTANZA_VISIBILE, ALTEZZA_OMINO } from './costanti.js';
import { BUCA, MONOPATTINO, LAMPIONE, ALTEZZA_LAMPIONE, corsieOstacolo } from './ostacoli.js';
import { MONETA, SCUDO, SCATTO, CALAMITA } from './percorso.js';
import { abbassato } from './corridore.js';
import { minaccia, DISTACCO_INIZIALE } from './inseguitori.js';
import {
  creaCitta,
  zRelativo,
  FILO_PALAZZI,
  BORDO_MARCIAPIEDE,
  LARGHEZZA_MARCIAPIEDE,
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

const COLORI = {
  cieloAlto: '#7ea6cc',
  cieloBasso: '#cfdae2',
  foschia: '#dde5ea',
  asfalto: '#4a4d53',
  asfaltoLontano: '#6a6e75',
  striscia: '#e3ddcd',
  marciapiede: '#a8a29a',
  cordolo: '#8b857d',
  palazzi: ['#b6a591', '#a6947e', '#c4b5a0', '#918f8b', '#ad9e8e', '#9a938a'],
  tetto: '#7a7269',
  vetro: '#6e7a82',
  omino: '#f5f7fa',
  ominoOmbra: '#c2c9d3',
  maranza: '#24262c',
  maranzaLuce: '#474c56',
  coltello: '#ccd3dc',
  buca: '#26282d',
  bucaBordo: '#3a3d43',
  moneta: '#f0c246',
  monetaScura: '#b58a1f',
  scudo: '#57b0e6',
  scatto: '#f4813c',
  calamita: '#d9534f',
  testo: '#f7f8fa',
  testoScuro: '#1b1d21',
};

export function disegnaMondo(ctx, mondo, interfaccia = {}) {
  const vista = mondo.vista;
  ctx.clearRect(0, 0, vista.larghezza, vista.altezza);

  disegnaCielo(ctx, vista);
  disegnaProfiloLontano(ctx, vista, mondo.scorrimento);
  disegnaStrada(ctx, vista, mondo.scorrimento);
  disegnaCitta(ctx, vista, mondo.scorrimento);
  disegnaPercorso(ctx, mondo);
  disegnaCorridore(ctx, mondo);
  disegnaInseguitori(ctx, mondo);
  disegnaVignetta(ctx, mondo);
  // Il pannello serve solo mentre si gioca: sulle due schermate i numeri ci
  // sono gia', piu' grandi, e ripeterli in piccolo e' solo rumore.
  if (mondo.stato === 'in-gioco') disegnaHud(ctx, mondo, interfaccia);

  if (mondo.stato === 'attesa') disegnaSchermataIniziale(ctx, mondo, interfaccia);
  if (mondo.stato === 'finita') disegnaSchermataFine(ctx, mondo, interfaccia);
}

// --- sfondo ---------------------------------------------------------------

function disegnaCielo(ctx, vista) {
  const cielo = ctx.createLinearGradient(0, 0, 0, vista.orizzonte + 10);
  cielo.addColorStop(0, COLORI.cieloAlto);
  cielo.addColorStop(1, COLORI.cieloBasso);
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, vista.larghezza, vista.orizzonte + 10);

  // La foschia sopra i tetti: e' cio' che fa sembrare lontano l'orizzonte.
  const velo = ctx.createLinearGradient(0, vista.orizzonte - vista.altezza * 0.12, 0, vista.orizzonte + 6);
  velo.addColorStop(0, 'rgba(221,229,234,0)');
  velo.addColorStop(1, COLORI.foschia);
  ctx.fillStyle = velo;
  ctx.fillRect(0, vista.orizzonte - vista.altezza * 0.12, vista.larghezza, vista.altezza * 0.12 + 6);
}

/** Il profilo della citta' all'orizzonte: non e' fatto di palazzi veri, e'
 *  una sagoma che scorre lentissima. Serve a non lasciare vuoto il punto di
 *  fuga e a far capire che si sta correndo dentro una citta' grande. */
function disegnaProfiloLontano(ctx, vista, scorrimento) {
  const base = vista.orizzonte + 1;
  const unita = vista.larghezza / 14;
  const scorri = (scorrimento * 0.55) % (unita * 6);
  ctx.fillStyle = 'rgba(140,158,172,0.55)';

  for (let i = -2; i < 18; i += 1) {
    const x = i * unita - scorri;
    // altezze fisse: una sagoma che cambia a ogni giro darebbe l'impressione
    // di una citta' che si rifa' ogni volta
    const alte = [0.5, 1.2, 0.8, 1.7, 0.6, 1, 2.1, 0.7, 1.4, 0.9, 1.1, 1.9, 0.6, 1.3];
    const altezza = alte[((i % alte.length) + alte.length) % alte.length] * unita * 0.9;
    ctx.fillRect(x, base - altezza, unita * 0.92, altezza);
  }
}

// --- strada ---------------------------------------------------------------

/** Un quadrilatero fra due quote z, dai bordi `xDa` a `xA`. */
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

function disegnaStrada(ctx, vista, scorrimento) {
  const zVicino = -DISTANZA_CAMERA + 0.45;
  const zLontano = DISTANZA_VISIBILE;

  // Terra oltre i marciapiedi: riempie tutto quel che sta sotto l'orizzonte,
  // cosi' non restano buchi di cielo fra un palazzo e l'altro.
  ctx.fillStyle = COLORI.marciapiede;
  ctx.fillRect(0, vista.orizzonte, vista.larghezza, vista.altezza - vista.orizzonte);

  // Asfalto, con una sfumatura che schiarisce verso l'orizzonte.
  const asfalto = ctx.createLinearGradient(0, vista.orizzonte, 0, vista.altezza);
  asfalto.addColorStop(0, COLORI.asfaltoLontano);
  asfalto.addColorStop(0.35, COLORI.asfalto);
  asfalto.addColorStop(1, '#3f4248');
  ctx.fillStyle = asfalto;
  fasciaStrada(ctx, vista, -SEMI_STRADA, SEMI_STRADA, zVicino, zLontano);

  // Cordoli: la faccia verticale del marciapiede.
  ctx.fillStyle = COLORI.cordolo;
  for (const lato of [-1, 1]) {
    const x = lato * BORDO_MARCIAPIEDE;
    const a = proietta(vista, x, 0, zVicino);
    const b = proietta(vista, x, 0.16, zVicino);
    const c = proietta(vista, x, 0.16, zLontano);
    const d = proietta(vista, x, 0, zLontano);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
  }

  // Piano del marciapiede, un filo piu' chiaro dell'asfalto.
  ctx.fillStyle = COLORI.marciapiede;
  for (const lato of [-1, 1]) {
    const dentro = lato * BORDO_MARCIAPIEDE;
    const fuori = lato * (BORDO_MARCIAPIEDE + LARGHEZZA_MARCIAPIEDE);
    fasciaStrada(ctx, vista, dentro, fuori, zVicino, zLontano, 0.16);
  }

  disegnaBinari(ctx, vista, scorrimento);
  disegnaStrisce(ctx, vista, scorrimento);
}

/** Le strisce tratteggiate fra le corsie. Il tratteggio scorre col mondo:
 *  e' il segnale piu' forte della velocita' che si ha. */
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
      // le strisce lontane si assottigliano da sole con la prospettiva
      fasciaStrada(ctx, vista, x - 0.09, x + 0.09, vicino, lontano, 0.01);
    }
  }

  // Bordi della carreggiata: righe continue attaccate al cordolo.
  for (const lato of [-1, 1]) {
    const x = lato * (SEMI_STRADA - 0.25);
    fasciaStrada(ctx, vista, x - 0.07, x + 0.07, -DISTANZA_CAMERA + 0.5, DISTANZA_VISIBILE, 0.01);
  }
}

/** I binari del tram che tagliano la strada. Solo un tocco milanese: non
 *  fanno inciampare nessuno. */
function disegnaBinari(ctx, vista, scorrimento) {
  ctx.fillStyle = '#5a5d63';
  for (const zBinario of CITTA.binari) {
    const z = zRelativo(zBinario, scorrimento);
    if (z < -DISTANZA_CAMERA || z > DISTANZA_VISIBILE) continue;
    fasciaStrada(ctx, vista, -SEMI_STRADA, SEMI_STRADA, z - 1.4, z + 1.4, 0.005);
    ctx.fillStyle = '#3c3f45';
    fasciaStrada(ctx, vista, -SEMI_STRADA, SEMI_STRADA, z - 1.05, z - 0.88, 0.01);
    fasciaStrada(ctx, vista, -SEMI_STRADA, SEMI_STRADA, z + 0.88, z + 1.05, 0.01);
    ctx.fillStyle = '#5a5d63';
  }
}

// --- citta' ---------------------------------------------------------------

function disegnaCitta(ctx, vista, scorrimento) {
  const cose = [];
  for (const edificio of CITTA.edifici) {
    const z = zRelativo(edificio.z, scorrimento);
    if (z > DISTANZA_VISIBILE || z + edificio.profondita < -DISTANZA_CAMERA) continue;
    cose.push({ z, disegna: () => disegnaEdificio(ctx, vista, edificio, z) });
  }
  // Gli arredi non si disegnano a ridosso della telecamera: un lampione a
  // mezzo metro dall'obiettivo diventa una sbarra nera in mezzo allo schermo.
  for (const lampione of CITTA.lampioni) {
    const z = zRelativo(lampione.z, scorrimento);
    if (z > DISTANZA_VISIBILE || z < 1) continue;
    cose.push({ z, disegna: () => disegnaLampioneInPiedi(ctx, vista, lampione.lato, z) });
  }
  for (const cassonetto of CITTA.cassonetti) {
    const z = zRelativo(cassonetto.z, scorrimento);
    if (z > DISTANZA_VISIBILE || z < 1) continue;
    cose.push({ z, disegna: () => disegnaCassonetto(ctx, vista, cassonetto, z) });
  }

  cose.sort((a, b) => b.z - a.z);
  for (const cosa of cose) cosa.disegna();
}

/** Un palazzo e' un muro lungo la strada piu' la sua facciata di testa.
 *  Il muro e' quello che si vede quasi sempre; la facciata compare solo
 *  quando il palazzo e' ancora davanti. */
function disegnaEdificio(ctx, vista, edificio, z) {
  const zVicino = Math.max(z, -DISTANZA_CAMERA + 0.5);
  const zLontano = z + edificio.profondita;
  if (zLontano <= -DISTANZA_CAMERA + 0.5) return;

  const x = edificio.lato * FILO_PALAZZI;
  const parete = (yBasso, yAlto, colore) => {
    const a = proietta(vista, x, yBasso, zVicino);
    const b = proietta(vista, x, yAlto, zVicino);
    const c = proietta(vista, x, yAlto, zLontano);
    const d = proietta(vista, x, yBasso, zLontano);
    ctx.fillStyle = colore;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
  };

  disegnaFacciataDiTesta(ctx, vista, edificio, zVicino);

  if (edificio.tipo === PALAZZO) {
    parete(0, edificio.altezza, COLORI.palazzi[edificio.tinta % COLORI.palazzi.length]);
    disegnaFinestre(ctx, vista, edificio, x, zVicino, zLontano);
    // cornicione
    parete(edificio.altezza, edificio.altezza + 0.5, COLORI.tetto);
    return;
  }

  if (edificio.tipo === DUOMO) return disegnaDuomo(ctx, vista, edificio, x, zVicino, zLontano);
  if (edificio.tipo === GALLERIA) return disegnaGalleria(ctx, vista, edificio, x, zVicino, zLontano);
  if (edificio.tipo === VELASCA) return disegnaVelasca(ctx, vista, edificio, x, zVicino, zLontano);
  if (edificio.tipo === BOSCO) return disegnaBosco(ctx, vista, edificio, x, zVicino, zLontano);
}

/** Quanto e' profondo un palazzo verso l'interno dell'isolato. Non si vede
 *  mai per intero: serve solo a dare spessore alla facciata di testa. */
const PROFONDITA_ISOLATO = 16;

/** La facciata che guarda la telecamera, cioe' il fianco corto del palazzo.
 *  Senza, fra un palazzo e l'altro si vedrebbe attraverso l'isolato e i
 *  palazzi sembrerebbero muri di cartone spessi zero. Si vede solo finche' il
 *  palazzo e' davanti: appena lo si supera, resta il muro lungo la strada. */
function disegnaFacciataDiTesta(ctx, vista, edificio, zVicino) {
  if (zVicino < 0.5) return;
  const dentro = edificio.lato * FILO_PALAZZI;
  const fuori = edificio.lato * (FILO_PALAZZI + PROFONDITA_ISOLATO);
  const h = edificio.altezza;

  const a = proietta(vista, dentro, 0, zVicino);
  const b = proietta(vista, dentro, h, zVicino);
  const c = proietta(vista, fuori, h, zVicino);
  const d = proietta(vista, fuori, 0, zVicino);

  // piu' scura del muro lungo la strada: e' la faccia in ombra
  ctx.fillStyle = edificio.tipo === PALAZZO ? 'rgba(90,84,76,0.92)' : 'rgba(104,98,88,0.92)';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
}

/** Il reticolo delle finestre: righe di piano e colonne. Sono tratti, non
 *  riquadri pieni: costano un decimo e a questa velocita' si leggono uguale. */
function disegnaFinestre(ctx, vista, edificio, x, zVicino, zLontano) {
  if (zVicino > 70) return; // troppo lontano perche' si veda qualcosa
  ctx.strokeStyle = 'rgba(60,62,68,0.35)';
  ctx.lineWidth = Math.max(1, vista.larghezza * 0.0022);

  const piani = Math.max(2, Math.floor(edificio.altezza / 3.1));
  for (let p = 1; p <= piani; p += 1) {
    const y = (edificio.altezza * p) / (piani + 0.4);
    const a = proietta(vista, x, y, zVicino);
    const b = proietta(vista, x, y, zLontano);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  const colonne = Math.max(2, Math.floor(edificio.profondita / 3.4));
  for (let c = 1; c <= colonne; c += 1) {
    const z = zVicino + ((zLontano - zVicino) * c) / (colonne + 1);
    const a = proietta(vista, x, 0.4, z);
    const b = proietta(vista, x, edificio.altezza - 0.6, z);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

/** Disegna una sagoma data in coordinate (z, y) sul muro che guarda la strada. */
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

function disegnaDuomo(ctx, vista, edificio, x, zVicino, zLontano) {
  const h = edificio.altezza;
  sagomaSulMuro(ctx, vista, x, [[zVicino, 0], [zVicino, h * 0.62], [zLontano, h * 0.62], [zLontano, 0]], '#ddd6c4');

  // le guglie: sono loro a rendere riconoscibile il Duomo di profilo
  const quante = 9;
  for (let i = 0; i < quante; i += 1) {
    const z = zVicino + ((zLontano - zVicino) * (i + 0.5)) / quante;
    if (z < zVicino) continue;
    const alta = h * (i === Math.floor(quante / 2) ? 1 : 0.78 + 0.14 * Math.sin(i * 1.7));
    sagomaSulMuro(
      ctx,
      vista,
      x,
      [[z - 0.9, h * 0.62], [z, alta], [z + 0.9, h * 0.62]],
      i % 2 === 0 ? '#e6dfcd' : '#d6cfbd',
    );
  }

  // finestroni a sesto acuto
  for (let i = 0; i < 5; i += 1) {
    const z = zVicino + ((zLontano - zVicino) * (i + 0.5)) / 5;
    sagomaSulMuro(
      ctx,
      vista,
      x,
      [[z - 1, h * 0.1], [z - 1, h * 0.38], [z, h * 0.5], [z + 1, h * 0.38], [z + 1, h * 0.1]],
      '#a89f8c',
    );
  }

  // la Madonnina sulla guglia di mezzo
  const zMezzo = zVicino + (zLontano - zVicino) / 2;
  sagomaSulMuro(ctx, vista, x, [[zMezzo - 0.35, h], [zMezzo, h + 2.4], [zMezzo + 0.35, h]], '#e8d99a');
}

function disegnaGalleria(ctx, vista, edificio, x, zVicino, zLontano) {
  const h = edificio.altezza;
  sagomaSulMuro(ctx, vista, x, [[zVicino, 0], [zVicino, h], [zLontano, h], [zLontano, 0]], '#cdc3b1');

  // l'arco d'ingresso
  const centro = (zVicino + zLontano) / 2;
  const raggio = Math.min(6, (zLontano - zVicino) / 2.6);
  const punti = [[centro - raggio, 0]];
  for (let i = 0; i <= 10; i += 1) {
    const angolo = Math.PI * (i / 10);
    punti.push([centro - raggio * Math.cos(angolo), h * 0.42 + Math.sin(angolo) * raggio * 1.5]);
  }
  punti.push([centro + raggio, 0]);
  sagomaSulMuro(ctx, vista, x, punti, '#6d6a63');

  // la volta di vetro sul tetto: bassa, altrimenti da vicino diventa una vela
  const volta = [];
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12;
    volta.push([zVicino + (zLontano - zVicino) * t, h + Math.sin(t * Math.PI) * 2.2]);
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
  ctx.strokeStyle = 'rgba(50,42,38,0.35)';
  ctx.lineWidth = Math.max(1, vista.larghezza * 0.002);
  for (let p = 1; p < 12; p += 1) {
    const y = (h * p) / 12;
    const a = proietta(vista, x, y, zVicino + (y < h * 0.62 ? 3 : 0));
    const b = proietta(vista, x, y, zLontano - (y < h * 0.62 ? 3 : 0));
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function disegnaBosco(ctx, vista, edificio, x, zVicino, zLontano) {
  const h = edificio.altezza;
  sagomaSulMuro(ctx, vista, x, [[zVicino, 0], [zVicino, h], [zLontano, h], [zLontano, 0]], '#6f6f6d');

  // i balconi e gli alberi: e' il verde a dire che palazzo e'
  const piani = 12;
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
      const z = zVicino + ((zLontano - zVicino) * (i + 0.5)) / 3;
      if ((p + i) % 2 === 0) continue;
      const raggio = 1.5;
      const punti = [];
      for (let v = 0; v <= 8; v += 1) {
        const angolo = (Math.PI * 2 * v) / 8;
        punti.push([z + Math.cos(angolo) * raggio, y + 1.75 + Math.sin(angolo) * raggio * 0.9]);
      }
      sagomaSulMuro(ctx, vista, x, punti, verdeAlternato(p, i) ? '#4e7a45' : '#5f8c4e');
    }
  }
}

/** Alterna due verdi: senza, il Bosco Verticale sembra di plastica. */
function verdeAlternato(piano, indice) {
  return (piano * 3 + indice) % 3 === 0;
}

function disegnaLampioneInPiedi(ctx, vista, lato, z) {
  const x = lato * (BORDO_MARCIAPIEDE + 0.7);
  const base = proietta(vista, x, 0.16, z);
  const cima = proietta(vista, x, 6.2, z);
  ctx.strokeStyle = '#54565c';
  ctx.lineWidth = Math.max(1, 0.16 * base.scala);
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(cima.x, cima.y);
  ctx.stroke();

  // il braccio piegato verso la strada
  const braccio = proietta(vista, x - lato * 1.5, 5.9, z);
  ctx.beginPath();
  ctx.moveTo(cima.x, cima.y);
  ctx.lineTo(braccio.x, braccio.y);
  ctx.stroke();
  ctx.fillStyle = '#c9ccd1';
  ctx.beginPath();
  ctx.ellipse(braccio.x, braccio.y, 0.36 * braccio.scala, 0.16 * braccio.scala, 0, 0, Math.PI * 2);
  ctx.fill();
}

function disegnaCassonetto(ctx, vista, cassonetto, z) {
  const x = cassonetto.lato * (BORDO_MARCIAPIEDE + 1.5);
  const colori = ['#7b8a5f', '#8a7b5f', '#5f6f8a'];
  const p = proietta(vista, x, 0.16, z);
  const alto = proietta(vista, x, 1.35, z);
  const larghezza = 1.5 * p.scala;
  ctx.fillStyle = colori[cassonetto.tinta % colori.length];
  ctx.fillRect(p.x - larghezza / 2, alto.y, larghezza, p.y - alto.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(p.x - larghezza / 2, alto.y, larghezza, 0.18 * p.scala);
}

// --- ostacoli e monete ----------------------------------------------------

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

function disegnaBuca(ctx, vista, buca, z) {
  const { sinistra, destra } = estremiCorsie(buca);
  const zVicino = z - buca.profondita / 2;
  const zLontano = z + buca.profondita / 2;
  const margine = 0.22;

  // bordo sbrecciato
  ctx.fillStyle = COLORI.bucaBordo;
  fasciaStrada(ctx, vista, sinistra + 0.05, destra - 0.05, zVicino, zLontano, 0.012);
  // il vuoto
  ctx.fillStyle = buca.travolto ? '#2c2f34' : COLORI.buca;
  fasciaStrada(ctx, vista, sinistra + margine, destra - margine, zVicino + 0.25, zLontano - 0.25, 0.014);

  // un accenno di profondita': la parete piu' lontana prende luce
  ctx.fillStyle = '#33363c';
  fasciaStrada(ctx, vista, sinistra + margine, destra - margine, zLontano - 0.55, zLontano - 0.25, 0.014);
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

  // la lampada rotta a un capo, il moncone dall'altro
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

  // ombra
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, 0.55 * p.scala, 0.18 * p.scala, 0, 0, Math.PI * 2);
  ctx.fill();

  const sbanda = Math.sin(mondo.tempo * 3 + ostacolo.sbandata * 6) * 0.05;
  conFigura(ctx, p.x, p.y, p.scala, () => {
    ctx.rotate(sbanda);
    // pedana e ruote
    ctx.fillStyle = '#3a3d43';
    ctx.fillRect(-0.32, 0.06, 0.64, 0.08);
    ctx.fillStyle = '#1b1d21';
    for (const rx of [-0.3, 0.3]) {
      ctx.beginPath();
      ctx.arc(rx, 0.1, 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
    // piantone e manubrio
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
    // la moneta gira su se stessa: la larghezza segue il coseno
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

  // alone: i bonus devono vedersi da lontano
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
  // calamita: il ferro di cavallo
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

// --- figure ---------------------------------------------------------------

/** Sposta l'origine ai piedi del personaggio e mette l'asse y verso l'alto,
 *  con l'unita' uguale a un metro. Dentro `disegna` si ragiona in metri. */
function conFigura(ctx, x, y, scala, disegna) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scala, -scala);
  disegna();
  ctx.restore();
}

/** Una persona vista di spalle, alta 1,75 m, con l'origine fra i piedi.
 *  La stessa funzione disegna l'omino bianco e i maranza: cambiano i colori,
 *  la posa e cosa hanno in mano. */
function disegnaFigura(ctx, opzioni) {
  const {
    colore,
    luce,
    fase = 0,
    posa = 'corsa',
    coltello = false,
    base = 0,
  } = opzioni;

  const oscilla = Math.sin(fase);
  const oscilla2 = Math.sin(fase + Math.PI);

  ctx.save();
  ctx.translate(0, base);

  if (posa === 'scivolata') {
    disegnaAccosciato(ctx, colore, luce);
    ctx.restore();
    return;
  }

  const anca = 0.88;
  const spalla = 1.42;

  // gambe
  ctx.strokeStyle = colore;
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.17;
  const apertura = posa === 'salto' ? 0.34 : posa === 'monopattino' ? 0.12 : 0.5;
  for (const [segno, dondolo] of [[1, oscilla], [-1, oscilla2]]) {
    const piedeX = dondolo * apertura;
    const piedeY = posa === 'salto' ? 0.25 + Math.abs(dondolo) * 0.2 : Math.max(0, dondolo * 0.18);
    ctx.beginPath();
    ctx.moveTo(segno * 0.1, anca);
    ctx.lineTo(piedeX * 0.6 + segno * 0.08, anca * 0.5);
    ctx.lineTo(piedeX, piedeY);
    ctx.stroke();
  }

  // busto
  ctx.fillStyle = colore;
  riquadroTondo(ctx, -0.24, anca - 0.05, 0.48, spalla - anca + 0.2, 0.16);
  ctx.fill();
  // luce sul bordo: e' cio' che distingue una persona da una macchia
  ctx.fillStyle = luce;
  riquadroTondo(ctx, -0.24, spalla - 0.14, 0.48, 0.16, 0.07);
  ctx.fill();

  // braccia
  ctx.strokeStyle = colore;
  ctx.lineWidth = 0.13;
  const bracciaAvanti = posa === 'monopattino';
  for (const [segno, dondolo] of [[-1, oscilla2], [1, oscilla]]) {
    const mano = bracciaAvanti ? 0.5 : dondolo * 0.42;
    const manoY = bracciaAvanti ? spalla - 0.32 : anca + 0.1 - Math.abs(dondolo) * 0.1;
    ctx.beginPath();
    ctx.moveTo(segno * 0.22, spalla);
    ctx.lineTo(segno * 0.3 + mano * 0.4, (spalla + manoY) / 2);
    ctx.lineTo(segno * 0.26 + mano, manoY);
    ctx.stroke();

    if (coltello && segno === 1) {
      ctx.save();
      ctx.translate(segno * 0.26 + mano, manoY);
      ctx.rotate(-0.7 + dondolo * 0.3);
      ctx.fillStyle = COLORI.coltello;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0.07, 0.42);
      ctx.lineTo(0, 0.5);
      ctx.lineTo(-0.07, 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = colore;
    }
  }

  // collo e testa
  ctx.fillStyle = colore;
  ctx.beginPath();
  ctx.arc(0, spalla + 0.24, 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = luce;
  ctx.beginPath();
  ctx.arc(-0.05, spalla + 0.29, 0.09, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** La scivolata: non e' la figura in piedi schiacciata, e' un'altra posa.
 *  Schiacciandola verrebbe una testa ovale e le braccia spalancate, e da
 *  dietro non si capirebbe cosa sta succedendo. Qui invece le gambe sono
 *  distese in avanti (piu' lontane, quindi piu' in alto sullo schermo), le
 *  braccia raccolte e la testa resta tonda. Alto in tutto 0,8 m, come dice
 *  ALTEZZA_OMINO_ABBASSATO. */
function disegnaAccosciato(ctx, colore, luce) {
  ctx.strokeStyle = colore;
  ctx.lineCap = 'round';

  // gambe distese verso il fondo della strada
  ctx.lineWidth = 0.17;
  for (const segno of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(segno * 0.1, 0.26);
    ctx.lineTo(segno * 0.34, 0.4);
    ctx.stroke();
  }

  // schiena bassa
  ctx.fillStyle = colore;
  riquadroTondo(ctx, -0.26, 0.2, 0.52, 0.36, 0.14);
  ctx.fill();
  ctx.fillStyle = luce;
  riquadroTondo(ctx, -0.26, 0.44, 0.52, 0.13, 0.06);
  ctx.fill();

  // braccia raccolte lungo i fianchi
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
  if (scattoAttivo(mondo)) disegnaScia(ctx, vista, p, mondo.tempo);
}

function disegnaBollaScudo(ctx, p, tempo) {
  const raggio = 1.15 * p.scala;
  ctx.strokeStyle = `rgba(87,176,230,${0.55 + 0.25 * Math.sin(tempo * 6)})`;
  ctx.lineWidth = Math.max(1.5, 0.06 * p.scala);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - raggio * 0.75, raggio * 0.72, raggio, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function disegnaScia(ctx, vista, p, tempo) {
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

  const altezzaFigura = vista.altezza * (0.16 + 0.4 * vicinanza + 0.14 * spinta);
  const scala = altezzaFigura / ALTEZZA_OMINO;
  const visibile = 0.25 + 0.5 * vicinanza + 0.25 * spinta;
  const piedi = vista.altezza + altezzaFigura * (1 - visibile);

  const posti = [-0.24, 0.02, 0.26];
  posti.forEach((offset, i) => {
    const x = vista.larghezza * (0.5 + offset) + Math.sin(mondo.inseguitori.fase * 0.6 + i) * vista.larghezza * 0.012;
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

// --- interfaccia ----------------------------------------------------------

function margini(interfaccia) {
  return interfaccia.margini || { alto: 0, destro: 0, basso: 0, sinistro: 0 };
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

  // monete
  ctx.textAlign = 'right';
  const destra = vista.larghezza - m.destro - bordo;
  ctx.fillStyle = COLORI.moneta;
  ctx.beginPath();
  ctx.ellipse(destra - unita * 0.11, alto + unita * 0.035, unita * 0.02, unita * 0.028, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORI.testo;
  ctx.font = `700 ${unita * 0.06}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(String(mondo.monete), destra, alto + unita * 0.005);

  ctx.shadowBlur = 0;
  disegnaBarraDistacco(ctx, mondo, interfaccia, unita);
  disegnaBonusAttivi(ctx, mondo, interfaccia, unita);
  disegnaAvviso(ctx, mondo, unita);
}

/** Quanto manca prima che ti prendano. E' l'unica vita che hai. */
function disegnaBarraDistacco(ctx, mondo, interfaccia, unita) {
  const vista = mondo.vista;
  const m = margini(interfaccia);
  const larghezza = Math.min(vista.larghezza * 0.42, unita * 0.5);
  const altezza = unita * 0.026;
  const x = vista.larghezza - m.destro - unita * 0.05 - larghezza;
  const y = m.alto + unita * 0.05 + unita * 0.09;

  const parte = Math.max(0, Math.min(1, mondo.inseguitori.distacco / DISTACCO_INIZIALE));
  ctx.fillStyle = 'rgba(20,22,26,0.45)';
  riquadroTondo(ctx, x, y, larghezza, altezza, altezza / 2);
  ctx.fill();

  const colore = parte > 0.6 ? '#5ec07a' : parte > 0.3 ? '#e8b23c' : '#e05543';
  ctx.fillStyle = colore;
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
  const y = m.alto + unita * 0.05 + unita * 0.2;

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

// --- schermate ------------------------------------------------------------

/** Imposta il font piu' grande che fa stare il testo nella larghezza data.
 *  Serve sugli schermi stretti: senza, la riga piu' lunga esce dallo schermo
 *  e si legge mezza frase. */
function corpoCheCiSta(ctx, testo, corpoIniziale, larghezzaMassima, peso = 600) {
  let corpo = corpoIniziale;
  for (let tentativo = 0; tentativo < 14; tentativo += 1) {
    ctx.font = `${peso} ${corpo}px system-ui, -apple-system, sans-serif`;
    if (ctx.measureText(testo).width <= larghezzaMassima) break;
    corpo *= 0.93;
  }
  return corpo;
}

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
  ctx.font = `800 ${unita * 0.13}px system-ui, -apple-system, sans-serif`;
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
    const y = y0 + i * unita * 0.085;
    const testo = `${riga[0]}  ·  ${riga[1]}`;
    corpoCheCiSta(ctx, testo, unita * 0.042, vista.larghezza * 0.9);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORI.testo;
    ctx.fillText(testo, vista.larghezza / 2, y);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORI.testo;
  ctx.font = `700 ${unita * 0.06}px system-ui, -apple-system, sans-serif`;
  const battito = 0.65 + 0.35 * Math.sin(mondo.tempo * 3);
  ctx.globalAlpha = battito;
  ctx.fillText('tocca per scappare', vista.larghezza / 2, vista.altezza * 0.78);
  ctx.globalAlpha = 1;

  if (interfaccia.record) {
    ctx.font = `600 ${unita * 0.042}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(247,248,250,0.7)';
    ctx.fillText(`record ${interfaccia.record}`, vista.larghezza / 2, vista.altezza * 0.85);
  }
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
  ctx.fillStyle = mondo.punteggio >= record && record > 0 ? '#e8b23c' : 'rgba(247,248,250,0.75)';
  ctx.fillText(
    mondo.punteggio >= record && record > 0 ? 'nuovo record!' : `record ${record}`,
    vista.larghezza / 2,
    vista.altezza * 0.58,
  );

  if (eta < 0.9) return;
  ctx.fillStyle = COLORI.testo;
  ctx.font = `700 ${unita * 0.06}px system-ui, -apple-system, sans-serif`;
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(mondo.tempo * 3);
  ctx.fillText('tocca per riprovare', vista.larghezza / 2, vista.altezza * 0.72);
  ctx.globalAlpha = 1;
}

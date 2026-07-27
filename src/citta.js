// La Milano che scorre ai lati della strada.
//
// Non e' una via qualsiasi: e' una **via a grande scorrimento** milanese, e la
// sezione e' quella vera di un viale, dal centro verso l'esterno:
//
//     0 - 3,0 m   carreggiata, le tre corsie su cui si corre
//     3,0 - 5,4   a sinistra la sede tranviaria (rotaie e linea aerea),
//                 a destra la fila delle auto in sosta
//     5,4 - 8,6   marciapiede, con il filare di platani e i lampioni
//     oltre       i palazzi, con le vetrine al piano terra e i balconi
//
// I due lati sono diversi apposta: una via simmetrica sembra un rendering, una
// via con il tram da una parte e le macchine dall'altra sembra un posto.
//
// La citta' non e' infinita: e' un pezzo lungo `PERIODO` metri che si ripete.
// Nessuno se ne accorge, perche' fra un passaggio e l'altro corrono minuti, e
// in cambio la scena si genera una volta sola all'avvio, con un seme fisso.
// I monumenti stanno in punti stabiliti, non a caso: il Duomo e l'Arco della
// Pace devono arrivare come un momento, non come una sorpresa ogni tre passi.
//
// Modulo puro: qui c'e' solo dove stanno le cose, non come si disegnano.

import { creaRng } from './rng.js';
import { SEMI_STRADA } from './costanti.js';

/** Lunghezza del pezzo di citta' che si ripete, in metri. */
export const PERIODO = 760;

// --- la sezione della strada, in metri dalla riga di mezzo ------------------

/** Dove finisce l'asfalto su cui si corre. */
export const BORDO_STRADA = SEMI_STRADA;

/** La fascia laterale: tram a sinistra, sosta a destra. */
export const LARGHEZZA_FASCIA = 2.4;
export const BORDO_MARCIAPIEDE = BORDO_STRADA + LARGHEZZA_FASCIA;

export const LARGHEZZA_MARCIAPIEDE = 3.2;
export const FILO_PALAZZI = BORDO_MARCIAPIEDE + LARGHEZZA_MARCIAPIEDE;

/** Il lato con il tram e quello con le auto in sosta. */
export const LATO_TRAM = -1;
export const LATO_SOSTA = 1;

/** Dove corrono le due rotaie, in metri dalla riga di mezzo. */
export const ROTAIE = [BORDO_STRADA + 0.75, BORDO_STRADA + 2.0];

export const PALAZZO = 'palazzo';
export const DUOMO = 'duomo';
export const GALLERIA = 'galleria';
export const VELASCA = 'velasca';
export const BOSCO = 'bosco';

/** I monumenti sul filo dei palazzi, col lato della strada su cui stanno.
 *  Le altezze non sono in scala fra loro: sono in scala con la strada, che e'
 *  l'unica cosa che il giocatore ha accanto per giudicare. */
const MONUMENTI = [
  { tipo: GALLERIA, lato: -1, z: 120, profondita: 26, altezza: 32, larghezza: 22 },
  { tipo: DUOMO, lato: 1, z: 270, profondita: 40, altezza: 48, larghezza: 25 },
  { tipo: VELASCA, lato: -1, z: 470, profondita: 22, altezza: 52, larghezza: 16 },
  { tipo: BOSCO, lato: 1, z: 620, profondita: 26, altezza: 58, larghezza: 22 },
];

/** I monumenti stanno sul filo della strada, non arretrati come i palazzi:
 *  una facciata che comincia otto metri di lato esce dallo schermo prima di
 *  farsi riconoscere. */
export const FILO_MONUMENTI = BORDO_STRADA + 0.6;

/** Quanti metri di strada restano sgombri prima di un monumento. E' la
 *  piazza: senza, il Duomo sta dietro l'ultimo palazzo della fila e non lo si
 *  vede arrivare. */
const PIAZZA = 72;

/** L'Arco della Pace scavalca la strada: e' il fondo di corso Sempione, e ci
 *  si passa sotto correndo. Sta in alto, non tocca nessuno. */
export const ARCO = { z: 380, profondita: 6, altezza: 25 };

/** Ogni quanti metri, all'incirca, gli arredi del marciapiede. */
const PASSO_ALBERI = 13;
const PASSO_LAMPIONI = 26;
const PASSO_PALI = 24;

/** Dove la strada e' attraversata dalle strisce pedonali. */
const ATTRAVERSAMENTI = [95, 250, 430, 600, 715];

export function creaCitta(seme = 7) {
  const rng = creaRng(seme);
  return {
    edifici: [...generaLato(-1, rng), ...generaLato(1, rng)],
    arco: ARCO,
    alberi: generaFilare(rng, PASSO_ALBERI, 2.2),
    lampioni: generaFilare(rng, PASSO_LAMPIONI, 1.1),
    paliLinea: generaPali(),
    auto: generaAuto(rng),
    tram: generaTram(rng),
    attraversamenti: ATTRAVERSAMENTI.slice(),
    tombini: generaTombini(rng),
    rattoppi: generaRattoppi(rng),
  };
}

function generaLato(lato, rng) {
  const edifici = [];
  const miei = MONUMENTI.filter((m) => m.lato === lato).sort((a, b) => a.z - b.z);
  let z = rng() * 12;

  for (const monumento of miei) {
    z = riempiFino(edifici, lato, z, monumento.z - PIAZZA, rng);
    edifici.push({ ...monumento, lato, tinta: 0, vetrine: false, balconi: false, monumento: true });
    z = monumento.z + monumento.profondita + 2 + rng() * 4;
  }
  riempiFino(edifici, lato, z, PERIODO, rng);
  return edifici;
}

/** Palazzi normali da `da` a `a`, senza sforare. */
function riempiFino(edifici, lato, da, a, rng) {
  let z = da;
  while (true) {
    const profondita = 11 + rng() * 16;
    if (z + profondita > a) break;
    // Ogni tanto uno piu' basso e uno molto piu' alto: una fila di palazzi
    // tutti della stessa altezza si legge come un muro, non come una via.
    const dado = rng();
    const altezza = dado < 0.25 ? 10 + rng() * 5 : dado > 0.85 ? 28 + rng() * 10 : 15 + rng() * 10;
    edifici.push({
      tipo: PALAZZO,
      lato,
      z,
      profondita,
      altezza,
      tinta: Math.floor(rng() * 6),
      // quasi tutti hanno le vetrine al piano terra: e' una via commerciale
      vetrine: rng() < 0.8,
      // i balconi lunghi sono degli anni Sessanta, non di tutti
      balconi: rng() < 0.45,
      insegna: Math.floor(rng() * 5),
    });
    z += profondita + 0.5 + rng() * 2;
  }
  return z;
}

/** Un filare su entrambi i marciapiedi, sfalsato fra un lato e l'altro. */
function generaFilare(rng, passo, sfasamento) {
  const elementi = [];
  for (let z = 6; z < PERIODO; z += passo) {
    elementi.push({ lato: -1, z: z + rng() * 1.5, taglia: 0.85 + rng() * 0.3 });
    elementi.push({ lato: 1, z: z + sfasamento + rng() * 1.5, taglia: 0.85 + rng() * 0.3 });
  }
  return elementi;
}

/** I pali della linea aerea del tram: stanno sul marciapiede di sinistra e
 *  reggono il filo che attraversa la strada. */
function generaPali() {
  const pali = [];
  for (let z = 10; z < PERIODO; z += PASSO_PALI) pali.push({ z });
  return pali;
}

function generaAuto(rng) {
  const auto = [];
  let z = 8;
  while (z < PERIODO) {
    // ogni tanto un buco: un viale con la fila di auto perfetta non esiste
    if (rng() > 0.22) auto.push({ z, tinta: Math.floor(rng() * 6), furgone: rng() < 0.18 });
    z += 5.4 + rng() * 1.2;
  }
  return auto;
}

function generaTram(rng) {
  const tram = [];
  for (let z = 150; z < PERIODO; z += 240 + rng() * 120) tram.push({ z });
  return tram;
}

function generaTombini(rng) {
  const tombini = [];
  for (let z = 12; z < PERIODO; z += 22 + rng() * 30) {
    tombini.push({ z, x: (rng() * 2 - 1) * (SEMI_STRADA - 0.6) });
  }
  return tombini;
}

/** I rattoppi dell'asfalto: a Milano non c'e' un metro di strada che non sia
 *  stato riaperto e richiuso. Sono grigi, non neri: non vanno confusi con le
 *  buche, che invece si saltano. */
function generaRattoppi(rng) {
  const rattoppi = [];
  for (let z = 5; z < PERIODO; z += 9 + rng() * 16) {
    rattoppi.push({
      z,
      x: (rng() * 2 - 1) * (SEMI_STRADA - 0.8),
      larghezza: 0.8 + rng() * 1.8,
      lunghezza: 1.2 + rng() * 3.5,
      chiaro: rng() < 0.5,
    });
  }
  return rattoppi;
}

/** Dove sta un elemento della citta' rispetto all'omino, tenuto conto che la
 *  citta' si ripete. Ritorna un valore fra -coda e PERIODO - coda. */
export function zRelativo(z, scorrimento, coda = 14) {
  const grezzo = (((z - scorrimento) % PERIODO) + PERIODO) % PERIODO;
  return grezzo > PERIODO - coda ? grezzo - PERIODO : grezzo;
}

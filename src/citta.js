// La Milano che scorre ai lati della strada.
//
// Non e' infinita: e' un pezzo di citta' lungo `PERIODO` metri che si ripete.
// Nessuno se ne accorge, perche' fra un passaggio e l'altro corrono sette
// minuti buoni, e in cambio la scena non costa niente: si genera una volta
// sola all'avvio, con un seme fisso, e resta uguale a se stessa.
//
// I monumenti stanno in punti stabiliti, non a caso: il Duomo deve arrivare
// come un momento, non come una sorpresa ogni tre passi.
// Modulo puro: qui c'e' solo dove stanno le cose, non come si disegnano.

import { creaRng } from './rng.js';
import { SEMI_STRADA } from './costanti.js';

/** Lunghezza del pezzo di citta' che si ripete, in metri. */
export const PERIODO = 760;

/** Dove comincia il marciapiede e dove comincia la fila di palazzi. */
export const BORDO_MARCIAPIEDE = SEMI_STRADA;
// Marciapiedi larghi: senza, i palazzi stanno addosso alla strada e la scena
// diventa un pozzo in cui non si vede piu' dove si sta andando.
export const LARGHEZZA_MARCIAPIEDE = 3.4;
export const FILO_PALAZZI = SEMI_STRADA + LARGHEZZA_MARCIAPIEDE;

export const PALAZZO = 'palazzo';
export const DUOMO = 'duomo';
export const GALLERIA = 'galleria';
export const VELASCA = 'velasca';
export const BOSCO = 'bosco';

/** I monumenti, col lato della strada su cui stanno (-1 sinistra, +1 destra).
 *  Le altezze non sono in scala fra loro: sono in scala con la strada, che e'
 *  l'unica cosa che il giocatore vede accanto. */
const MONUMENTI = [
  { tipo: GALLERIA, lato: -1, z: 120, profondita: 26, altezza: 26 },
  { tipo: DUOMO, lato: 1, z: 260, profondita: 42, altezza: 40 },
  { tipo: VELASCA, lato: -1, z: 450, profondita: 24, altezza: 44 },
  { tipo: BOSCO, lato: 1, z: 610, profondita: 26, altezza: 50 },
];

/** Ogni quanti metri, all'incirca, un lampione sul marciapiede. */
const PASSO_LAMPIONI = 26;

/** Dove la strada e' attraversata dai binari del tram. */
const BINARI = [70, 330, 545];

export function creaCitta(seme = 7) {
  const rng = creaRng(seme);
  const edifici = [...generaLato(-1, rng), ...generaLato(1, rng)];
  return {
    edifici,
    binari: BINARI.slice(),
    lampioni: generaLampioni(rng),
    cassonetti: generaCassonetti(rng),
  };
}

function generaLato(lato, rng) {
  const edifici = [];
  const miei = MONUMENTI.filter((m) => m.lato === lato).sort((a, b) => a.z - b.z);
  let z = rng() * 12;

  for (const monumento of miei) {
    z = riempiFino(edifici, lato, z, monumento.z, rng);
    edifici.push({ ...monumento, lato, finestre: 0, tinta: 0 });
    z = monumento.z + monumento.profondita + 2 + rng() * 4;
  }
  riempiFino(edifici, lato, z, PERIODO, rng);
  return edifici;
}

/** Palazzi normali da `da` a `a`, senza sforare. */
function riempiFino(edifici, lato, da, a, rng) {
  let z = da;
  while (true) {
    const profondita = 9 + rng() * 15;
    if (z + profondita > a) break;
    edifici.push({
      tipo: PALAZZO,
      lato,
      z,
      profondita,
      altezza: 8 + rng() * 20,
      tinta: Math.floor(rng() * 6),
      // i piani sono alti circa tre metri: le finestre vengono da li'
      finestre: rng(),
    });
    z += profondita + 0.6 + rng() * 2.5;
  }
  return z;
}

function generaLampioni(rng) {
  const lampioni = [];
  for (let z = 8; z < PERIODO; z += PASSO_LAMPIONI) {
    lampioni.push({ lato: -1, z: z + rng() * 3 });
    lampioni.push({ lato: 1, z: z + PASSO_LAMPIONI / 2 + rng() * 3 });
  }
  return lampioni;
}

function generaCassonetti(rng) {
  const cassonetti = [];
  for (let z = 20; z < PERIODO; z += 40 + rng() * 50) {
    cassonetti.push({ lato: rng() < 0.5 ? -1 : 1, z, tinta: Math.floor(rng() * 3) });
  }
  return cassonetti;
}

/** Dove sta un elemento della citta' rispetto all'omino, tenuto conto che la
 *  citta' si ripete. Ritorna un valore fra -CODA e PERIODO - CODA. */
export function zRelativo(z, scorrimento, coda = 14) {
  const grezzo = (((z - scorrimento) % PERIODO) + PERIODO) % PERIODO;
  return grezzo > PERIODO - coda ? grezzo - PERIODO : grezzo;
}

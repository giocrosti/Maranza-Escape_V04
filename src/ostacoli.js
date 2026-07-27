// I modi di farsi prendere, e le regole che dicono quando succede.
// Modulo puro: un ostacolo e' un oggetto con dentro dove sta e quanto e' largo.
//
// Ogni ostacolo si passa con **un gesto suo**, sempre lo stesso:
//   buca         -> si salta
//   aiuola       -> si salta (e' un'aiuola del sindaco, con l'erba alta)
//   monopattino  -> si cambia corsia (e' alto: saltargli sopra non funziona)
//   ponticello   -> ci si abbassa e si passa sotto
//   arco         -> si passa in mezzo, e in mezzo si sta solo dalla corsia
//                   centrale: i due piloni chiudono le altre due
//
// Quel che non copre tutte e tre le corsie si puo' sempre anche scansare di
// lato: e' vero per il monopattino, per un'aiuola stretta, per un ponticello
// corto. Il gesto proprio dell'ostacolo e' quello che funziona **sempre**,
// anche quando l'ostacolo prende tutta la strada.

import { CORSIE, SEMI_PROFONDITA_OMINO } from './costanti.js';
import { aTerra, altezzaTesta, corsieOccupate } from './corridore.js';

export const BUCA = 'buca';
export const AIUOLA = 'aiuola';
export const MONOPATTINO = 'monopattino';
export const PONTICELLO = 'ponticello';
export const ARCO = 'arco';

/** Quanto sta in alto l'intradosso del ponticello, in metri: sopra l'omino
 *  abbassato (0,75 m), sotto l'omino in piedi (1,75 m). */
export const ALTEZZA_PONTICELLO = 1.05;

/** Quanto e' profondo un monopattino col suo maranza sopra, in metri. */
const PROFONDITA_MONOPATTINO = 1.4;

/** L'impalcato del ponticello e' stretto: si passa sotto in un attimo, ma per
 *  quell'attimo bisogna essere gia' abbassati. */
const PROFONDITA_PONTICELLO = 1.1;

/** Un'aiuola e' un cassone: ha il suo spessore da scavalcare. */
const PROFONDITA_AIUOLA = 1.8;

/** Lo spessore dei piloni dell'arco. */
const PROFONDITA_ARCO = 4;

/** Le corsie chiuse dai piloni dell'Arco della Pace: la centrale resta
 *  libera, ed e' l'unico modo di passare. */
const CORSIE_ARCO = [0, 2];

/** Quanti vertici ha il contorno di una buca. */
const VERTICI_BUCA = 18;

/** Il contorno frastagliato di una buca, in coordinate da -1 a 1 rispetto al
 *  suo riquadro: -1 e' il bordo sinistro (o vicino), +1 quello destro (o
 *  lontano). Chi disegna non deve fare altro che scalarlo.
 *
 *  Non e' un cerchio deformato: e' un rettangolo con gli angoli smussati e i
 *  bordi rosicchiati. La differenza conta, e non solo per l'occhio — l'urto
 *  usa il riquadro pieno, e un contorno tondo lascerebbe fuori le due punte
 *  della corsia, dove si cadrebbe in una buca che li' non si vede.
 *
 *  Deterministico: la stessa buca ha sempre la stessa forma, anche dopo aver
 *  ricaricato la pagina. */
export function profiloBuca(seme, vertici = VERTICI_BUCA) {
  let stato = (Math.imul(seme + 1, 2654435761) ^ 0x9e3779b9) >>> 0;
  const successivo = () => {
    stato = (Math.imul(stato, 1664525) + 1013904223) >>> 0;
    return stato / 4294967296;
  };

  const contorno = [];
  for (let i = 0; i < vertici; i += 1) {
    const angolo = (Math.PI * 2 * i) / vertici;
    const coseno = Math.cos(angolo);
    const seno = Math.sin(angolo);
    // esponente sotto 1: il contorno si gonfia verso il rettangolo invece di
    // restare un'ellisse
    const raggio = 0.86 + successivo() * 0.14;
    contorno.push([
      Math.sign(coseno) * Math.abs(coseno) ** 0.55 * raggio,
      Math.sign(seno) * Math.abs(seno) ** 0.55 * raggio,
    ]);
  }
  return contorno;
}

/** `z` e' sempre il centro dell'ostacolo, in metri dalla partenza. */
export function creaBuca(z, corsiaInizio, quanteCorsie, lunghezza) {
  return {
    tipo: BUCA,
    z,
    profondita: lunghezza,
    corsiaInizio,
    quanteCorsie,
    colpito: false,
    contorno: profiloBuca(Math.floor(z * 7919) % 100000),
  };
}

/** Un'aiuola del sindaco: cassone di cemento, terra e mezzo metro d'erba mai
 *  tagliata. Una o due corsie, mai tutte e tre. */
export function creaAiuola(z, corsiaInizio, quanteCorsie) {
  return {
    tipo: AIUOLA,
    z,
    profondita: PROFONDITA_AIUOLA,
    corsiaInizio,
    quanteCorsie,
    colpito: false,
    seme: Math.floor(z * 1103) % 10000,
  };
}

export function creaMonopattino(z, corsia) {
  return {
    tipo: MONOPATTINO,
    z,
    profondita: PROFONDITA_MONOPATTINO,
    corsiaInizio: corsia,
    quanteCorsie: 1,
    colpito: false,
    // dondola guidando: e' cio' che lo distingue da un ostacolo fermo
    sbandata: (Math.floor(z * 31) % 100) / 100,
  };
}

export function creaPonticello(z, corsiaInizio, quanteCorsie) {
  return {
    tipo: PONTICELLO,
    z,
    profondita: PROFONDITA_PONTICELLO,
    corsiaInizio,
    quanteCorsie,
    colpito: false,
    // da che parte guardano le statuine sui pilastrini
    versoDestra: Math.floor(z) % 2 === 0,
  };
}

/** L'Arco della Pace. Non e' piu' un monumento da guardare: e' un ostacolo, e
 *  l'unico varco e' il fornice centrale, cioe' la corsia di mezzo. */
export function creaArco(z) {
  return {
    tipo: ARCO,
    z,
    profondita: PROFONDITA_ARCO,
    corsie: CORSIE_ARCO.slice(),
    corsiaInizio: CORSIE_ARCO[0],
    quanteCorsie: CORSIE_ARCO.length,
    colpito: false,
  };
}

/** Le corsie coperte dall'ostacolo, in ordine.
 *  Quasi tutti occupano corsie di fila e bastano `corsiaInizio` e
 *  `quanteCorsie`; l'arco no, chiude la prima e la terza e lascia aperta
 *  quella in mezzo, e per lui c'e' l'elenco esplicito. */
export function corsieOstacolo(ostacolo) {
  if (ostacolo.corsie) return ostacolo.corsie.filter((c) => c >= 0 && c < CORSIE);
  const corsie = [];
  for (let i = 0; i < ostacolo.quanteCorsie; i += 1) {
    const corsia = ostacolo.corsiaInizio + i;
    if (corsia >= 0 && corsia < CORSIE) corsie.push(corsia);
  }
  return corsie;
}

/** Vero se l'ostacolo lascia libera almeno una corsia. Le buche e i lampioni
 *  che coprono tutta la strada non la lasciano, e vanno scavalcati o passati
 *  sotto: e' il generatore del percorso a doverlo sapere. */
export function lasciaUnaCorsiaLibera(ostacolo) {
  return corsieOstacolo(ostacolo).length < CORSIE;
}

/** Quanto e' avanti l'ostacolo rispetto all'omino, in metri.
 *  Negativo vuol dire che e' gia' stato superato. */
export function distanzaRelativa(ostacolo, distanzaPercorsa) {
  return ostacolo.z - distanzaPercorsa;
}

/** Vero mentre l'omino e l'ostacolo si sovrappongono lungo la strada. */
export function sovrapposto(ostacolo, zRelativo) {
  return Math.abs(zRelativo) < ostacolo.profondita / 2 + SEMI_PROFONDITA_OMINO;
}

/** Vero se in questo istante l'ostacolo prende l'omino.
 *  Non modifica niente: e' mondo.js a decidere cosa farne. */
export function prendeIlCorridore(ostacolo, corridore, zRelativo) {
  if (ostacolo.colpito) return false;
  if (!sovrapposto(ostacolo, zRelativo)) return false;

  const corsieCoinvolte = corsieOstacolo(ostacolo);
  const dentro = corsieOccupate(corridore).some((c) => corsieCoinvolte.includes(c));
  if (!dentro) return false;

  if (ostacolo.tipo === BUCA || ostacolo.tipo === AIUOLA) return aTerra(corridore);
  if (ostacolo.tipo === PONTICELLO) return altezzaTesta(corridore) > ALTEZZA_PONTICELLO;
  // monopattino e piloni dell'arco: se sei nella loro corsia ti prendono, punto
  return true;
}

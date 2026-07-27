// I tre modi di farsi prendere, e le regole che dicono quando succede.
// Modulo puro: un ostacolo e' un oggetto con dentro dove sta e quanto e' largo.
//
// Ogni ostacolo si evita in un modo solo, e sempre lo stesso:
//   buca         -> si salta
//   monopattino  -> si cambia corsia (e' alto: saltargli sopra non funziona)
//   lampione     -> ci si abbassa
// La regola vale anche al contrario, ed e' quella che rende il gioco leggibile:
// non esiste un ostacolo che si eviti in due modi diversi a seconda di come
// capita.

import { CORSIE, SEMI_PROFONDITA_OMINO } from './costanti.js';
import { aTerra, altezzaTesta, corsieOccupate } from './corridore.js';

export const BUCA = 'buca';
export const MONOPATTINO = 'monopattino';
export const LAMPIONE = 'lampione';

/** Quanto sta in alto il palo del lampione caduto, in metri: sopra l'omino
 *  abbassato (0,75 m), sotto l'omino in piedi (1,75 m). */
export const ALTEZZA_LAMPIONE = 1.05;

/** Quanto e' profondo un monopattino col suo maranza sopra, in metri. */
const PROFONDITA_MONOPATTINO = 1.4;

/** Il palo e' sottile: passa in fretta, ma per quel poco bisogna essere gia'
 *  abbassati. */
const PROFONDITA_LAMPIONE = 0.7;

/** `z` e' sempre il centro dell'ostacolo, in metri dalla partenza. */
export function creaBuca(z, corsiaInizio, quanteCorsie, lunghezza) {
  return {
    tipo: BUCA,
    z,
    profondita: lunghezza,
    corsiaInizio,
    quanteCorsie,
    colpito: false,
    seme: Math.floor(z * 7919) % 1000, // per un bordo frastagliato sempre uguale
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

export function creaLampione(z, corsiaInizio, quanteCorsie) {
  return {
    tipo: LAMPIONE,
    z,
    profondita: PROFONDITA_LAMPIONE,
    corsiaInizio,
    quanteCorsie,
    colpito: false,
    // da che parte pende la lampada rotta
    versoDestra: Math.floor(z) % 2 === 0,
  };
}

/** Le corsie coperte dall'ostacolo, in ordine. */
export function corsieOstacolo(ostacolo) {
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

  if (ostacolo.tipo === BUCA) return aTerra(corridore);
  if (ostacolo.tipo === LAMPIONE) return altezzaTesta(corridore) > ALTEZZA_LAMPIONE;
  return true; // monopattino: se sei nella sua corsia ti prende, punto
}

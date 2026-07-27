// Il generatore della strada: decide cosa c'e' davanti.
//
// La strada non esiste tutta insieme: si crea a pezzi mano a mano che ci si
// avvicina e si butta via quel che e' rimasto indietro. Un pezzo e' un
// ostacolo (a volte due nella stessa posizione) piu' le monete che gli stanno
// intorno.
//
// La regola che tiene in piedi tutto: **un ostacolo per volta**. Due ostacoli
// non si sovrappongono mai lungo la strada, e la distanza fra uno e l'altro
// non scende mai sotto quella che serve a rimettersi in piedi dopo il primo.
// Senza, capiterebbe di atterrare da un salto dentro un lampione, e non ci
// sarebbe modo di passare.
//
// Modulo puro: prende un generatore casuale come parametro, cosi' i test
// possono farsi dare sempre lo stesso percorso.

import { CORSIE, DISTANZA_VISIBILE } from './costanti.js';
import { BUCA, creaBuca, creaMonopattino, creaLampione, corsieOstacolo } from './ostacoli.js';

export const MONETA = 'moneta';
export const SCUDO = 'scudo';
export const SCATTO = 'scatto';
export const CALAMITA = 'calamita';

export const BONUS = [SCUDO, SCATTO, CALAMITA];

/** Il primo ostacolo non arriva subito: i primi metri servono a capire che si
 *  sta correndo e che si puo' cambiare corsia. */
export const PRIMO_OSTACOLO = 70;

/** Distanza minima fra due ostacoli, in metri. Un salto lungo copre una
 *  quindicina di metri alla velocita' massima: sotto questa soglia si
 *  atterrerebbe dentro l'ostacolo successivo. */
export const SPAZIO_MINIMO = 26;

/** Dopo quanti metri il gioco e' alla difficolta' massima. */
const METRI_PER_DIFFICOLTA_PIENA = 1400;

/** Ogni quanti metri, all'incirca, si trova un bonus. */
const METRI_FRA_I_BONUS = 260;

/** Quanto restano indietro le cose prima di essere buttate via. Non zero:
 *  la telecamera sta qualche metro dietro l'omino e le vede ancora. */
const CODA = 14;

export function creaPercorso(rng) {
  return {
    ostacoli: [],
    raccolte: [],
    prossimoZ: PRIMO_OSTACOLO,
    prossimoBonusZ: PRIMO_OSTACOLO + 120 + (rng ? rng() * 80 : 40),
  };
}

/** Quanto e' avanti il gioco, da 0 (partenza) a 1 (difficolta' piena). */
export function difficoltaA(z) {
  return Math.min(1, Math.max(0, z / METRI_PER_DIFFICOLTA_PIENA));
}

/** Crea i pezzi che servono a coprire la strada visibile davanti a `distanza`. */
export function generaAvanti(percorso, distanza, velocita, rng) {
  let contatore = 0;
  while (percorso.prossimoZ < distanza + DISTANZA_VISIBILE) {
    aggiungiPezzo(percorso, velocita, rng);
    // rete di sicurezza: se un giorno la spaziatura diventasse zero per un
    // errore di calcolo, meglio un fotogramma povero che una pagina bloccata
    contatore += 1;
    if (contatore > 40) break;
  }
  return percorso;
}

/** Butta via ostacoli e monete ormai alle spalle. */
export function ripulisci(percorso, distanza) {
  const limite = distanza - CODA;
  percorso.ostacoli = percorso.ostacoli.filter((o) => o.z + o.profondita / 2 > limite);
  percorso.raccolte = percorso.raccolte.filter((r) => r.z > limite && !r.presa);
  return percorso;
}

function aggiungiPezzo(percorso, velocita, rng) {
  const z = percorso.prossimoZ;
  const difficolta = difficoltaA(z);

  const gruppo = creaOstacoli(z, rng, difficolta);
  percorso.ostacoli.push(...gruppo);
  aggiungiRaccolte(percorso, gruppo, rng, difficolta);

  // Piu' si corre veloce, piu' spazio serve fra un ostacolo e l'altro solo per
  // avere il tempo di vederlo. Il margine in piu' si assottiglia con la
  // difficolta': e' il modo in cui il gioco stringe.
  const base = Math.max(SPAZIO_MINIMO, velocita * 1.15);
  percorso.prossimoZ = z + base + (1 - difficolta) * 15 + rng() * 10;
  return percorso;
}

/** Un ostacolo, o due monopattini affiancati quando il gioco si e' scaldato.
 *  Ritorna sempre un elenco, anche di uno solo. */
export function creaOstacoli(z, rng, difficolta) {
  const dado = rng();

  if (dado < 0.4) {
    const quante = quanteCorsie(rng, difficolta, 0.26, 0.1);
    const inizio = Math.floor(rng() * (CORSIE - quante + 1));
    return [creaBuca(z, inizio, quante, 2.4 + rng() * 1.4 + difficolta * 0.9)];
  }

  if (dado < 0.72) {
    const corsia = Math.floor(rng() * CORSIE);
    // Due monopattini lasciano una corsia sola: la scelta diventa secca.
    const doppio = difficolta > 0.4 && rng() < 0.18 + difficolta * 0.22;
    if (!doppio) return [creaMonopattino(z, corsia)];
    const altra = (corsia + 1 + Math.floor(rng() * (CORSIE - 1))) % CORSIE;
    return [creaMonopattino(z, corsia), creaMonopattino(z, altra)];
  }

  const quante = quanteCorsie(rng, difficolta, 0.38, 0.22);
  const inizio = Math.floor(rng() * (CORSIE - quante + 1));
  return [creaLampione(z, inizio, quante)];
}

/** Da una a tre corsie, con la larghezza che cresce insieme alla difficolta'. */
function quanteCorsie(rng, difficolta, sogliaDue, sogliaTre) {
  let quante = 1;
  if (rng() < sogliaDue + difficolta * 0.3) quante += 1;
  if (rng() < sogliaTre + difficolta * 0.28) quante += 1;
  return Math.min(CORSIE, quante);
}

/** Le corsie che l'ostacolo lascia libere. Vuoto se occupa tutta la strada. */
export function corsieLibere(gruppo) {
  const occupate = new Set(gruppo.flatMap(corsieOstacolo));
  const libere = [];
  for (let c = 0; c < CORSIE; c += 1) if (!occupate.has(c)) libere.push(c);
  return libere;
}

function aggiungiRaccolte(percorso, gruppo, rng, difficolta) {
  const primo = gruppo[0];

  if (primo.z > percorso.prossimoBonusZ) {
    percorso.raccolte.push(bonusDopo(primo, gruppo, rng));
    percorso.prossimoBonusZ = primo.z + METRI_FRA_I_BONUS + rng() * 140;
    return; // un bonus da solo si vede meglio che in mezzo alle monete
  }

  // Sopra una buca le monete fanno un arco: seguono il salto, e prenderle
  // tutte vuol dire aver saltato al momento giusto.
  if (primo.tipo === BUCA && rng() < 0.55) {
    percorso.raccolte.push(...arcoDiMonete(primo));
    return;
  }

  if (rng() > 0.7 + difficolta * 0.1) return; // ogni tanto niente, per respirare
  percorso.raccolte.push(...filaDiMonete(primo, gruppo, rng));
}

function corsiaLiberaOQualsiasi(gruppo, rng) {
  const libere = corsieLibere(gruppo);
  if (libere.length > 0) return libere[Math.floor(rng() * libere.length)];
  return Math.floor(rng() * CORSIE);
}

/** Monete in fila subito dopo l'ostacolo, nella corsia che l'ostacolo lascia
 *  libera: la ricompensa sta dove passa la scelta giusta. */
function filaDiMonete(ostacolo, gruppo, rng) {
  const corsia = corsiaLiberaOQualsiasi(gruppo, rng);
  const quante = 4 + Math.floor(rng() * 4);
  const inizio = ostacolo.z + ostacolo.profondita / 2 + 5;
  const monete = [];
  for (let i = 0; i < quante; i += 1) {
    monete.push(creaRaccolta(MONETA, inizio + i * 2.2, corsia, 0.85));
  }
  return monete;
}

/** Sette monete che salgono e ridiscendono sopra la buca. */
function arcoDiMonete(buca) {
  const corsia = buca.corsiaInizio + Math.floor(buca.quanteCorsie / 2);
  const meta = buca.profondita / 2 + 2.5;
  const quante = 7;
  const monete = [];
  for (let i = 0; i < quante; i += 1) {
    const t = i / (quante - 1); // da 0 a 1 lungo l'arco
    const altezza = 0.85 + Math.sin(t * Math.PI) * 1;
    monete.push(creaRaccolta(MONETA, buca.z - meta + t * meta * 2, corsia, altezza));
  }
  return monete;
}

function bonusDopo(ostacolo, gruppo, rng) {
  const tipo = BONUS[Math.floor(rng() * BONUS.length)];
  const corsia = corsiaLiberaOQualsiasi(gruppo, rng);
  return creaRaccolta(tipo, ostacolo.z + ostacolo.profondita / 2 + 9, corsia, 1.15);
}

export function creaRaccolta(tipo, z, corsia, y) {
  return { tipo, z, corsia, y, presa: false, spostamento: 0 };
}

// Il gruppo di maranza col coltello che corre dietro all'omino bianco.
//
// Non sono ostacoli: sono il cronometro del gioco. Tutta la partita si gioca
// su un numero solo, il **distacco** in metri. Sbagliare non fa perdere una
// vita: fa perdere terreno. Correre pulito lo fa riguadagnare, piano.
// Quando il distacco arriva a zero ti prendono, e li' finisce.
//
// Tre errori ravvicinati bastano (16 - 3 x 5,5 = -0,5): il terzo e' quello che
// ti costa la partita, ma nessuno dei tre e' definitivo se in mezzo corri bene.
// Modulo puro.

/** Il vantaggio con cui si parte, in metri. E' anche il massimo: correndo
 *  bene si torna qui e non oltre, altrimenti basterebbe un minuto pulito per
 *  rendersi immortali. */
export const DISTACCO_INIZIALE = 16;

/** Quanti metri costa un errore. */
export const PENALITA_ERRORE = 5.5;

/** Metri di vantaggio riguadagnati ogni secondo di corsa pulita. */
export const RECUPERO = 0.62;

/** Durante lo scatto si guadagna terreno molto piu' in fretta: e' il momento
 *  in cui il gioco tira il fiato. */
export const RECUPERO_SCATTO = 4.5;

/** Sotto questa soglia i maranza sono ormai addosso: e' la zona in cui il
 *  disegno li mostra grandi e il gioco fa capire che la prossima e' l'ultima. */
export const DISTACCO_CRITICO = 6;

export function creaInseguitori() {
  return {
    distacco: DISTACCO_INIZIALE,
    /** Sale a ogni errore e scende piano: serve solo al disegno, per farli
     *  agitare i coltelli quando si sono appena avvicinati. */
    agitazione: 0,
    fase: 0,
  };
}

export function azzeraInseguitori(inseguitori) {
  inseguitori.distacco = DISTACCO_INIZIALE;
  inseguitori.agitazione = 0;
  inseguitori.fase = 0;
  return inseguitori;
}

/** Avanza di `dt` secondi. `scatto` dice se il bonus di corsa e' attivo. */
export function avanzaInseguitori(inseguitori, dt, { scatto = false, velocita = 0 } = {}) {
  const recupero = scatto ? RECUPERO_SCATTO : RECUPERO;
  inseguitori.distacco = Math.min(DISTACCO_INIZIALE, inseguitori.distacco + recupero * dt);
  inseguitori.agitazione = Math.max(0, inseguitori.agitazione - dt * 0.8);
  inseguitori.fase += velocita * dt * 0.62;
  return inseguitori;
}

/** Li fa guadagnare terreno: e' quello che succede a ogni errore.
 *  Ritorna il distacco che resta. */
export function avvicina(inseguitori, metri = PENALITA_ERRORE) {
  inseguitori.distacco = Math.max(0, inseguitori.distacco - metri);
  inseguitori.agitazione = 1;
  return inseguitori.distacco;
}

/** Li rimanda indietro. Usato dallo scatto, che da' un vantaggio immediato. */
export function allontana(inseguitori, metri) {
  inseguitori.distacco = Math.min(DISTACCO_INIZIALE, inseguitori.distacco + metri);
  return inseguitori.distacco;
}

/** Vero quando ti hanno preso. */
export function hannoPreso(inseguitori) {
  return inseguitori.distacco <= 0;
}

/** Quanto sono vicini, da 0 (lontani) a 1 (addosso). E' il numero che
 *  comanda quanto grandi si disegnano e quanto rosso c'e' sui bordi. */
export function minaccia(inseguitori) {
  return 1 - Math.max(0, Math.min(1, inseguitori.distacco / DISTACCO_INIZIALE));
}

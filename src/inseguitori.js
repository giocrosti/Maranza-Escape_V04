// Il gruppo di maranza col coltello che corre dietro all'omino bianco.
//
// Non sono ostacoli: sono il conto alla rovescia della partita. Tutto si gioca
// su un numero solo, il **distacco** in metri, e quel numero ha tre tacche.
//
// **Tre errori e ti prendono.** Non ci sono sconti e non si recupera terreno:
// il vantaggio perso e' perso. Sbagliare una volta ti lascia due terzi di
// margine, sbagliare due volte un terzo, e alla terza sei a zero. La barra in
// alto e' esattamente questo, e i maranza che crescono in fondo allo schermo
// sono la stessa cosa detta senza numeri.
//
// (Prima il distacco si riguadagnava correndo pulito, e capitava di sbagliare
// quattro o cinque volte senza perdere: era troppo comodo e il conto non
// tornava mai con quello che il giocatore aveva in testa.)
// Modulo puro.

/** Il vantaggio con cui si parte, in metri. */
export const DISTACCO_INIZIALE = 16;

/** Quanti errori si possono fare prima di essere presi. */
export const ERRORI_PER_PERDERE = 3;

/** Quanti metri costa un errore: un terzo esatto del vantaggio, cosi' il terzo
 *  errore azzera il distacco al centimetro. */
export const PENALITA_ERRORE = DISTACCO_INIZIALE / ERRORI_PER_PERDERE;

/** Sotto questa soglia i maranza sono ormai addosso: e' la zona in cui il
 *  disegno li mostra grandi e il gioco fa capire che la prossima e' l'ultima. */
export const DISTACCO_CRITICO = DISTACCO_INIZIALE / ERRORI_PER_PERDERE + 0.5;

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

/** Avanza di `dt` secondi. Il distacco non si tocca: cambia solo agli errori.
 *  Qui si muovono l'agitazione e il passo, che servono al disegno. */
export function avanzaInseguitori(inseguitori, dt, { velocita = 0 } = {}) {
  inseguitori.agitazione = Math.max(0, inseguitori.agitazione - dt * 0.8);
  inseguitori.fase += velocita * dt * 0.62;
  return inseguitori;
}

/** Li rimanda indietro di una tacca: e' lo spritz, l'unica cosa al mondo che
 *  restituisce terreno gia' perso. Non si va oltre il vantaggio di partenza. */
export function restituisci(inseguitori, metri = PENALITA_ERRORE) {
  inseguitori.distacco = Math.min(DISTACCO_INIZIALE, inseguitori.distacco + metri);
  inseguitori.agitazione = 0;
  return inseguitori.distacco;
}

/** Li fa guadagnare terreno: e' quello che succede a ogni errore, ed e'
 *  quasi l'unica cosa che muove il distacco. Ritorna il distacco che resta. */
export function avvicina(inseguitori, metri = PENALITA_ERRORE) {
  // sotto un centesimo di metro e' zero: e' il terzo errore, e le divisioni
  // non devono lasciare briciole che tengono in vita una partita finita
  const restante = inseguitori.distacco - metri;
  inseguitori.distacco = restante < 0.01 ? 0 : restante;
  inseguitori.agitazione = 1;
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

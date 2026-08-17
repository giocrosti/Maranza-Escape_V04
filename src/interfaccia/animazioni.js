// Le curve, e i pochi valori che le usano.
//
// Il principio: **niente nell'interfaccia cambia di colpo.** Una schermata che
// compare in un fotogramma si legge come uno sfarfallio; la stessa schermata
// che entra in un quinto di secondo con una curva si legge come una cosa che
// arriva. Il tempo e' quasi lo stesso, la sensazione no.
//
// Due modi di ammorbidire, e vanno tenuti distinti:
//
//   **la curva**    prende un avanzamento da 0 a 1 e lo deforma. Serve quando
//                   si sa gia' dove si va a finire e quanto deve durare.
//   **l'inseguimento** avvicina un valore a un bersaglio di una frazione per
//                   secondo. Serve quando il bersaglio cambia da solo — il
//                   punteggio che sale, la barra del distacco — perche' li' non
//                   esiste ne' un inizio ne' una durata.
//
// L'inseguimento si scrive con un esponenziale e non con "mi avvicino del 10%
// a ogni fotogramma": la seconda forma va al doppio della velocita' su uno
// schermo a 120 Hz, e su un telefono che perde colpi rallenta. Con
// l'esponenziale il tempo di arrivo e' lo stesso ovunque.

/** Parte piano e si ferma piano: la curva buona per far comparire le cose. */
export function morbida(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** Frena in fondo. Per quello che entra da fuori e si posa. */
export function frenata(t) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) * (1 - x) * (1 - x);
}

/** Supera il bersaglio e torna indietro. Da usare con parsimonia: su un gioco
 *  dove si perde in mezzo secondo, un rimbalzo di troppo e' una presa in giro. */
export function rimbalzo(t) {
  const x = Math.min(1, Math.max(0, t));
  const s = 1.7;
  const y = x - 1;
  return y * y * ((s + 1) * y + s) + 1;
}

/**
 * Avvicina `valore` a `bersaglio`. `tempo` e' quanto ci mette a coprire circa
 * il 63% della distanza: e' la costante di tempo, non la durata.
 */
export function insegue(valore, bersaglio, dt, tempo = 0.12) {
  if (tempo <= 0 || dt <= 0) return bersaglio;
  const quanto = 1 - Math.exp(-dt / tempo);
  return valore + (bersaglio - valore) * quanto;
}

/** Quanto dura la comparsa di una schermata. */
const DURATA_SCHERMATA = 0.26;

export function creaAnimazioni() {
  return {
    /** Da 0 a 1: quanto e' entrata la schermata sovrapposta di adesso. */
    schermata: 0,
    statoPrecedente: null,

    /** Il punteggio che si vede, che rincorre quello vero. */
    punteggio: 0,

    /** Il distacco disegnato sulla barra, che insegue quello vero: senza,
     *  la barra fa un salto secco a ogni penalita' e non si vede *quanto* si e'
     *  perso, si vede solo che si e' perso. */
    distacco: 1,

    /** Quanto e' aperto il pannello di gioco. */
    hud: 0,
  };
}

/** Le schermate sovrapposte: sono queste ad avere una comparsa. */
function haSchermata(stato) {
  return stato === 'attesa' || stato === 'istruzioni' || stato === 'pausa' || stato === 'finita';
}

export function avanzaAnimazioni(animazioni, mondo, dt) {
  const passo = Math.min(Math.max(dt, 0), 0.05);

  // Cambiando schermata l'avanzamento riparte da zero: la nuova entra invece
  // di ereditare la posizione della vecchia.
  if (mondo.stato !== animazioni.statoPrecedente) {
    if (haSchermata(mondo.stato)) animazioni.schermata = 0;
    animazioni.statoPrecedente = mondo.stato;
  }

  const bersaglio = haSchermata(mondo.stato) ? 1 : 0;
  if (bersaglio > animazioni.schermata) {
    animazioni.schermata = Math.min(1, animazioni.schermata + passo / DURATA_SCHERMATA);
  } else {
    // sparisce piu' in fretta di quanto compare: uscire di scena non e' un
    // momento da assaporare
    animazioni.schermata = Math.max(0, animazioni.schermata - passo / (DURATA_SCHERMATA * 0.6));
  }

  animazioni.hud = insegue(
    animazioni.hud,
    mondo.stato === 'in-gioco' || mondo.stato === 'apparizione' ? 1 : 0,
    passo,
    0.14,
  );

  // Il punteggio sale in fretta ma non istantaneamente: raccogliendo una moneta
  // da venticinque punti si vede il numero correre, ed e' quello che rende la
  // moneta una piccola soddisfazione invece di un incremento.
  animazioni.punteggio = insegue(animazioni.punteggio, mondo.punteggio, passo, 0.09);
  if (Math.abs(animazioni.punteggio - mondo.punteggio) < 0.6) {
    animazioni.punteggio = mondo.punteggio;
  }
  // ricominciando, il contatore torna a zero subito: vederlo scendere da
  // duemila a zero sarebbe ridicolo
  if (mondo.punteggio === 0) animazioni.punteggio = 0;

  animazioni.distacco = insegue(
    animazioni.distacco,
    mondo.inseguitori.distacco,
    passo,
    0.16,
  );

  return animazioni;
}

// Stato della partita e sua evoluzione nel tempo.
// Modulo puro: nessun riferimento a DOM, canvas o eventi. Si puo' eseguire e
// testare da solo, ed e' quello che fanno i test.

import {
  ACCELERAZIONE,
  DT_MASSIMO,
  VELOCITA_INIZIALE,
  VELOCITA_MASSIMA,
} from './costanti.js';
import { creaVista, ridimensionaVista } from './proiezione.js';
import { creaCorridore, avanzaCorridore, cambiaCorsia, salta, scivola, corsieOccupate, inciampa } from './corridore.js';
import { prendeIlCorridore, avvicinaOstacoli } from './ostacoli.js';
import {
  creaPercorso,
  generaAvanti,
  ripulisci,
  MONETA,
  SCUDO,
  SCATTO,
  CALAMITA,
  MADONNINA,
} from './percorso.js';
import {
  creaInseguitori,
  azzeraInseguitori,
  avanzaInseguitori,
  avvicina,
  hannoPreso,
  ERRORI_PER_PERDERE,
} from './inseguitori.js';

/** Quanto si aspetta prima di accettare il tocco che fa ripartire: senza, lo
 *  stesso dito che ha provato a schivare farebbe ripartire subito la partita
 *  senza far leggere il punteggio. */
export const RITARDO_RIAVVIO = 0.9;

/** Quanto vale una moneta, in punti. Un metro ne vale uno. */
export const PUNTI_PER_MONETA = 25;

/** Le scritte che compaiono a schermo quando si raccoglie un bonus, e quella
 *  che chiude la partita. */
export const GRIDO_CALAMITA = 'oggi si fattura';
export const GRIDO_SCATTO = 'car sharing';
export const GRIDO_SCONFITTA = 'Ti hanno fatto il portafoglio';

export const DURATA_SCATTO = 4.5;
export const DURATA_CALAMITA = 6;

/** La Madonnina: dieci secondi indistruttibili al triplo della velocita'. */
export const DURATA_MADONNINA = 10;

/** Quanto resta fermo il gioco mentre la Madonnina appare. */
export const DURATA_APPARIZIONE = 2;

/** Di quanto va piu' forte l'omino durante lo scatto, e con la Madonnina:
 *  il doppio della macchinina. */
export const MOLTIPLICATORE_SCATTO = 1.55;
export const MOLTIPLICATORE_MADONNINA = MOLTIPLICATORE_SCATTO * 2;

/** Quanto dura il barcollamento dopo un urto e quanto rallenta. */
export const DURATA_INCIAMPO = 0.55;
export const RALLENTAMENTO_INCIAMPO = 0.55;

/** Dopo un urto si e' intoccabili per un istante: senza, un inciampo davanti a
 *  un ostacolo largo lo farebbe contare due volte nello stesso secondo. */
export const INVULNERABILITA_DOPO_URTO = 0.9;

/** Quanto dura l'invulnerabilita' regalata dallo scudo che si consuma. */
const INVULNERABILITA_SCUDO = 1.2;

/** Quanto vicino bisogna passare a una moneta per prenderla, in metri. */
export const RAGGIO_RACCOLTA = 1.1;

/** Da quanto lontano la calamita comincia a tirare le monete. */
const RAGGIO_CALAMITA = 11;

/** Velocita' con cui scorre la strada nella schermata iniziale. */
const VELOCITA_ATTESA = 7;

export function creaMondo(larghezza, altezza, rng = Math.random) {
  return {
    vista: creaVista(larghezza, altezza),
    tempo: 0,
    stato: 'attesa', // 'attesa' | 'in-gioco' | 'apparizione' | 'pausa' | 'finita'
    causaFine: null, // 'buca' | 'monopattino' | 'lampione'
    tempoInizio: 0,
    tempoFine: null,

    /** Metri percorsi nella partita in corso: e' l'origine di tutte le z. */
    distanza: 0,
    /** Metri percorsi da quando la pagina e' aperta: muove solo la citta',
     *  cosi' facendo ripartire una partita i palazzi non saltano di colpo. */
    scorrimento: 0,
    velocita: VELOCITA_INIZIALE,

    corridore: creaCorridore(),
    percorso: creaPercorso(rng),
    inseguitori: creaInseguitori(),

    punteggio: 0,
    monete: 0,
    errori: 0,

    scudo: false,
    scattoFinoA: 0,
    calamitaFinoA: 0,
    madonninaFinoA: 0,
    inciampoFinoA: 0,
    invulnerabileFinoA: 0,

    /** Secondi che restano all'apparizione della Madonnina, e da quanto e'
     *  cominciata. Contati a parte perche' durante l'apparizione l'orologio
     *  del mondo e' fermo. */
    apparizione: 0,
    tempoApparizione: 0,

    /** Ultimo fatto degno di una scritta a schermo: { testo, tempo }. */
    avviso: null,
  };
}

export function scattoAttivo(mondo) {
  return mondo.tempo < mondo.scattoFinoA;
}

export function calamitaAttiva(mondo) {
  return mondo.tempo < mondo.calamitaFinoA;
}

export function madonninaAttiva(mondo) {
  return mondo.tempo < mondo.madonninaFinoA;
}

export function rimastoMadonnina(mondo) {
  return Math.max(0, mondo.madonninaFinoA - mondo.tempo);
}

/** Vero quando niente puo' fare male: lo scatto travolge, la Madonnina di
 *  piu'. E' l'unica cosa che i due bonus hanno in comune. */
export function invulnerabile(mondo) {
  return scattoAttivo(mondo) || madonninaAttiva(mondo);
}

/** Secondi che restano al bonus, zero se non e' attivo. */
export function rimastoScatto(mondo) {
  return Math.max(0, mondo.scattoFinoA - mondo.tempo);
}

export function rimastoCalamita(mondo) {
  return Math.max(0, mondo.calamitaFinoA - mondo.tempo);
}

/** La velocita' di questo istante: cresce col tempo di corsa, raddoppia quasi
 *  con lo scatto, crolla mentre si barcolla. */
export function velocitaCorsa(mondo) {
  if (mondo.stato !== 'in-gioco') return VELOCITA_ATTESA;
  const corsa = mondo.tempo - mondo.tempoInizio;
  let velocita = Math.min(VELOCITA_MASSIMA, VELOCITA_INIZIALE + ACCELERAZIONE * corsa);
  if (madonninaAttiva(mondo)) velocita *= MOLTIPLICATORE_MADONNINA;
  else if (scattoAttivo(mondo)) velocita *= MOLTIPLICATORE_SCATTO;
  if (mondo.tempo < mondo.inciampoFinoA) velocita *= RALLENTAMENTO_INCIAMPO;
  return velocita;
}

/** Comincia (o ricomincia) una partita. */
export function avviaPartita(mondo, rng = Math.random) {
  azzeraPartita(mondo, rng);
  mondo.stato = 'in-gioco';
  mondo.tempoInizio = mondo.tempo;
  return mondo;
}

/** Torna alla schermata iniziale, dalla pausa o da partita finita. La partita
 *  in corso si butta via: sulla home non deve restare in scena niente di
 *  quello che si stava correndo. */
export function tornaAllaHome(mondo, rng = Math.random) {
  if (mondo.stato !== 'pausa' && mondo.stato !== 'finita') return false;
  azzeraPartita(mondo, rng);
  mondo.stato = 'attesa';
  return true;
}

/** Apre e chiude la pagina delle istruzioni. Si puo' solo dalla home: e' li'
 *  che si ha tempo di leggere. */
export function apriIstruzioni(mondo) {
  if (mondo.stato !== 'attesa') return false;
  mondo.stato = 'istruzioni';
  return true;
}

export function chiudiIstruzioni(mondo) {
  if (mondo.stato !== 'istruzioni') return false;
  mondo.stato = 'attesa';
  return true;
}

/** Vero quando si sta guardando qualcosa e non si sta correndo: home e
 *  istruzioni. Serve al disegno, che li' non deve mettere in scena l'omino. */
export function fuoriDallaCorsa(mondo) {
  return mondo.stato === 'attesa' || mondo.stato === 'istruzioni';
}

/** Riporta tutto a zero, senza decidere in che stato si va a finire. */
function azzeraPartita(mondo, rng) {
  mondo.causaFine = null;
  mondo.tempoFine = null;
  mondo.tempoInizio = mondo.tempo;
  mondo.distanza = 0;
  mondo.velocita = VELOCITA_INIZIALE;
  mondo.punteggio = 0;
  mondo.monete = 0;
  mondo.errori = 0;
  mondo.scudo = false;
  mondo.scattoFinoA = 0;
  mondo.calamitaFinoA = 0;
  mondo.madonninaFinoA = 0;
  mondo.inciampoFinoA = 0;
  mondo.invulnerabileFinoA = 0;
  mondo.apparizione = 0;
  mondo.tempoApparizione = 0;
  mondo.avviso = null;
  mondo.corridore = creaCorridore();
  mondo.percorso = creaPercorso(rng);
  azzeraInseguitori(mondo.inseguitori);
  return mondo;
}

/** Vero quando il giocatore puo' far partire una partita con un tocco. */
export function puoRiavviare(mondo) {
  if (mondo.stato === 'attesa') return true;
  if (mondo.stato !== 'finita') return false;
  return mondo.tempo - mondo.tempoFine >= RITARDO_RIAVVIO;
}

/** L'unica porta d'ingresso dei comandi: tastiera e dito passano di qui.
 *  `azione` vale 'sinistra' | 'destra' | 'salta' | 'scivola'. */
export function comando(mondo, azione) {
  if (mondo.stato !== 'in-gioco') return false;
  if (azione === 'sinistra') cambiaCorsia(mondo.corridore, -1);
  else if (azione === 'destra') cambiaCorsia(mondo.corridore, +1);
  else if (azione === 'salta') salta(mondo.corridore);
  else if (azione === 'scivola') scivola(mondo.corridore);
  else return false;
  return true;
}

/** Mette in pausa. Si puo' solo da dentro una partita: sulle due schermate
 *  non c'e' niente da fermare. */
export function mettiInPausa(mondo) {
  if (mondo.stato !== 'in-gioco') return false;
  mondo.stato = 'pausa';
  return true;
}

export function riprendi(mondo) {
  if (mondo.stato !== 'pausa') return false;
  mondo.stato = 'in-gioco';
  return true;
}

/** Il pulsante fa le due cose: ferma se si sta correndo, riparte se e' fermo. */
export function alternaPausa(mondo) {
  return mettiInPausa(mondo) || riprendi(mondo);
}

export function inPausa(mondo) {
  return mondo.stato === 'pausa';
}

/** Avanza il mondo di `dt` secondi. Ritorna il mondo stesso, modificato. */
export function avanzaMondo(mondo, dt, rng = Math.random) {
  // In pausa il tempo non passa affatto: non e' solo la strada che si ferma,
  // sono anche i secondi che restano allo scatto e alla calamita, che sono
  // contati sull'orologio del mondo. Fermare il mondo li ferma con se'.
  if (mondo.stato === 'pausa') return mondo;

  const passo = Math.min(Math.max(dt, 0), DT_MASSIMO);

  // L'apparizione della Madonnina: il mondo sta fermo, e a scorrere e' solo il
  // suo cronometro. I dieci secondi di potere partono quando finisce, non
  // quando la si raccoglie, altrimenti due se ne andrebbero nell'apparizione.
  if (mondo.stato === 'apparizione') {
    mondo.apparizione -= passo;
    mondo.tempoApparizione += passo;
    if (mondo.apparizione <= 0) {
      mondo.apparizione = 0;
      mondo.stato = 'in-gioco';
      mondo.madonninaFinoA = mondo.tempo + DURATA_MADONNINA;
    }
    return mondo;
  }
  mondo.tempo += passo;
  mondo.velocita = velocitaCorsa(mondo);
  mondo.scorrimento += mondo.velocita * passo;

  if (mondo.stato !== 'in-gioco') {
    // Fuori dalla partita la strada continua a scorrere e l'omino continua a
    // correre: la schermata iniziale e' il gioco stesso, senza pericoli.
    avanzaCorridore(mondo.corridore, passo, mondo.velocita);
    avanzaInseguitori(mondo.inseguitori, mondo.stato === 'finita' ? 0 : passo, {
      velocita: mondo.velocita,
    });
    return mondo;
  }

  mondo.distanza += mondo.velocita * passo;
  avanzaCorridore(mondo.corridore, passo, mondo.velocita);

  generaAvanti(mondo.percorso, mondo.distanza, mondo.velocita, rng);
  // i monopattini arrivano contromano: si muovono prima che si guardi chi tocca
  avvicinaOstacoli(mondo.percorso.ostacoli, mondo.distanza, passo);
  risolviOstacoli(mondo);
  risolviRaccolte(mondo, passo);
  ripulisci(mondo.percorso, mondo.distanza);

  avanzaInseguitori(mondo.inseguitori, passo, { velocita: mondo.velocita });

  mondo.punteggio = Math.floor(mondo.distanza) + mondo.monete * PUNTI_PER_MONETA;
  return mondo;
}

function risolviOstacoli(mondo) {
  for (const ostacolo of mondo.percorso.ostacoli) {
    const zRelativo = ostacolo.z - mondo.distanza;
    // Fuori da questa finestra non c'e' niente da controllare: l'ostacolo e'
    // ancora lontano o gia' alle spalle.
    if (zRelativo > 4 || zRelativo < -6) continue;
    if (!prendeIlCorridore(ostacolo, mondo.corridore, zRelativo)) continue;

    ostacolo.colpito = true;
    if (invulnerabile(mondo)) {
      // Scatto e Madonnina passano attraverso: l'ostacolo si sfascia e non
      // costa nulla.
      ostacolo.travolto = true;
      continue;
    }
    subisciErrore(mondo, ostacolo.tipo);
  }
}

/** Un errore. Ritorna true se e' costato davvero terreno. */
export function subisciErrore(mondo, causa) {
  if (mondo.tempo < mondo.invulnerabileFinoA) return false;
  if (invulnerabile(mondo)) return false;

  if (mondo.scudo) {
    mondo.scudo = false;
    mondo.invulnerabileFinoA = mondo.tempo + INVULNERABILITA_SCUDO;
    mondo.avviso = { testo: 'scudo consumato', tempo: mondo.tempo };
    return false;
  }

  avvicina(mondo.inseguitori);
  inciampa(mondo.corridore, DURATA_INCIAMPO);
  mondo.inciampoFinoA = mondo.tempo + DURATA_INCIAMPO;
  mondo.invulnerabileFinoA = mondo.tempo + INVULNERABILITA_DOPO_URTO;
  mondo.errori += 1;
  mondo.causaFine = causa; // se questo e' l'ultimo errore, e' cosi' che e' finita

  // Il terzo errore chiude la partita, sempre. Il controllo sul distacco
  // dovrebbe bastare da solo — tre penalita' fanno esattamente il vantaggio di
  // partenza — ma il conto degli errori e' quello che il giocatore ha in
  // testa, e vince lui.
  if (mondo.errori >= ERRORI_PER_PERDERE || hannoPreso(mondo.inseguitori)) {
    mondo.inseguitori.distacco = 0;
    terminaPartita(mondo, causa);
  }
  return true;
}

function risolviRaccolte(mondo, dt) {
  const calamita = calamitaAttiva(mondo);
  const corsie = corsieOccupate(mondo.corridore);

  for (const raccolta of mondo.percorso.raccolte) {
    if (raccolta.presa) continue;
    const zRelativo = raccolta.z - mondo.distanza;
    if (zRelativo < -RAGGIO_RACCOLTA) continue;

    if (calamita && zRelativo < RAGGIO_CALAMITA) {
      // Si sposta verso la corsia dell'omino invece di aspettarlo li' dov'e'.
      const mancante = mondo.corridore.posizione - raccolta.corsia - raccolta.spostamento;
      raccolta.spostamento += mancante * Math.min(1, dt * 6);
    }

    if (zRelativo > RAGGIO_RACCOLTA) continue;
    const inCorsia = calamita || corsie.includes(raccolta.corsia);
    if (inCorsia) prendiRaccolta(mondo, raccolta);
  }
}

function prendiRaccolta(mondo, raccolta) {
  raccolta.presa = true;

  if (raccolta.tipo === MONETA) {
    mondo.monete += 1;
    return;
  }
  if (raccolta.tipo === SCUDO) {
    mondo.scudo = true;
    mondo.avviso = { testo: 'scudo', tempo: mondo.tempo };
    return;
  }
  if (raccolta.tipo === SCATTO) {
    mondo.scattoFinoA = mondo.tempo + DURATA_SCATTO;
    mondo.avviso = { testo: GRIDO_SCATTO, tempo: mondo.tempo };
    return;
  }
  if (raccolta.tipo === CALAMITA) {
    mondo.calamitaFinoA = mondo.tempo + DURATA_CALAMITA;
    mondo.avviso = { testo: GRIDO_CALAMITA, tempo: mondo.tempo };
    return;
  }
  if (raccolta.tipo === MADONNINA) {
    // Il mondo si ferma e la Madonnina appare. Il potere parte dopo, quando
    // l'apparizione finisce: lo fa `avanzaMondo`.
    mondo.stato = 'apparizione';
    mondo.apparizione = DURATA_APPARIZIONE;
    mondo.tempoApparizione = 0;
    mondo.avviso = null;
  }
}

export function terminaPartita(mondo, causa) {
  if (mondo.stato === 'finita') return mondo;
  mondo.stato = 'finita';
  mondo.causaFine = causa;
  mondo.tempoFine = mondo.tempo;
  mondo.inseguitori.distacco = 0;
  return mondo;
}

/** Aggiorna le dimensioni dell'area di gioco (finestra ridimensionata). */
export function ridimensionaMondo(mondo, larghezza, altezza) {
  ridimensionaVista(mondo.vista, larghezza, altezza);
  return mondo;
}

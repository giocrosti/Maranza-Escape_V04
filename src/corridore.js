// L'omino bianco: dove sta, cosa sta facendo, come cambia nel tempo.
// Modulo puro: niente DOM, niente canvas. Non decide nulla sugli ostacoli,
// dice soltanto in che corsia si trova e quanto e' alto in questo istante.

import {
  CORSIE,
  DURATA_CAMBIO_CORSIA,
  DURATA_SCIVOLATA,
  GRAVITA,
  VELOCITA_SALTO,
  ALTEZZA_OMINO,
  ALTEZZA_OMINO_ABBASSATO,
  QUOTA_A_TERRA,
} from './costanti.js';

/** Corsie al secondo. Il cambio di corsia non e' istantaneo: si vede
 *  scivolare di lato, ed e' li' che si puo' venire presi a meta' strada. */
const VELOCITA_CAMBIO = 1 / DURATA_CAMBIO_CORSIA;

/** Mezza larghezza del corpo, in metri, ai fini degli urti. Volutamente piu'
 *  stretta della figura disegnata: di striscio non si viene presi, altrimenti
 *  ogni cambio di corsia sembrerebbe rubato. */
export const SEMI_LARGHEZZA_OMINO = 0.28;

/** Chi scivola in aria viene sbattuto a terra a questa velocita': serve a
 *  poter passare sotto un lampione dopo aver saltato per sbaglio. */
const PICCHIATA = 16;

export function creaCorridore(corsia = 1) {
  return {
    posizione: corsia, // corsia con la virgola: 1.5 vuol dire a meta' fra la 1 e la 2
    bersaglio: corsia, // la corsia verso cui si sta andando
    y: 0, // quota dei piedi, in metri
    vy: 0,
    inAria: false,
    scivolata: 0, // secondi che restano da abbassato
    scivolataInAttesa: false, // ha premuto "giu'" mentre era in aria
    fase: 0, // avanzamento del passo di corsa, per il disegno
    inciampo: 0, // secondi di barcollamento dopo un urto
  };
}

/** Sposta il bersaglio di una corsia. `direzione` vale -1 o +1.
 *  Chiamarla due volte di fila fa saltare due corsie: e' voluto, cosi' un
 *  doppio colpo di pollice non va perso. */
export function cambiaCorsia(corridore, direzione) {
  const nuovo = corridore.bersaglio + Math.sign(direzione);
  corridore.bersaglio = Math.max(0, Math.min(CORSIE - 1, nuovo));
  return corridore;
}

/** Salta, se si e' a terra. Un salto annulla la scivolata in corso: e' il
 *  modo di uscire subito da una scivolata partita troppo presto. */
export function salta(corridore) {
  if (corridore.inAria) return corridore;
  corridore.vy = VELOCITA_SALTO;
  corridore.inAria = true;
  corridore.scivolata = 0;
  corridore.scivolataInAttesa = false;
  return corridore;
}

/** Abbassati. In aria non ci si abbassa: si precipita, e ci si abbassa
 *  all'atterraggio. */
export function scivola(corridore) {
  if (corridore.inAria) {
    corridore.vy = Math.min(corridore.vy, -PICCHIATA);
    corridore.scivolataInAttesa = true;
    return corridore;
  }
  corridore.scivolata = DURATA_SCIVOLATA;
  return corridore;
}

/** Avanza di `dt` secondi. `velocita` e' quella di corsa: serve solo al
 *  ritmo delle gambe. */
export function avanzaCorridore(corridore, dt, velocita = 0) {
  if (corridore.inAria) {
    corridore.vy -= GRAVITA * dt;
    corridore.y += corridore.vy * dt;
    if (corridore.y <= 0) {
      corridore.y = 0;
      corridore.vy = 0;
      corridore.inAria = false;
      if (corridore.scivolataInAttesa) {
        corridore.scivolata = DURATA_SCIVOLATA;
        corridore.scivolataInAttesa = false;
      }
    }
  }

  if (corridore.scivolata > 0) corridore.scivolata = Math.max(0, corridore.scivolata - dt);
  if (corridore.inciampo > 0) corridore.inciampo = Math.max(0, corridore.inciampo - dt);

  const passo = VELOCITA_CAMBIO * dt;
  const mancante = corridore.bersaglio - corridore.posizione;
  corridore.posizione =
    Math.abs(mancante) <= passo ? corridore.bersaglio : corridore.posizione + Math.sign(mancante) * passo;

  // Le gambe girano con la strada che scorre, non col cronometro: rallentando
  // il passo si accorcia da solo. In aria non si corre.
  if (!corridore.inAria) corridore.fase += velocita * dt * 0.62;

  return corridore;
}

/** Vero quando i piedi sono abbastanza in basso da finire dentro una buca.
 *
 *  Mentre si sale si e' **subito** in aria, anche se i piedi sono ancora a due
 *  dita dall'asfalto: chi ha premuto il salto un istante prima del bordo deve
 *  passare. In discesa invece la quota conta davvero, altrimenti si
 *  atterrerebbe dentro la buca senza caderci. */
export function aTerra(corridore) {
  if (!corridore.inAria) return true;
  return corridore.vy < 0 && corridore.y < QUOTA_A_TERRA;
}

/** Vero quando si sta passando abbassati. */
export function abbassato(corridore) {
  return corridore.scivolata > 0;
}

/** Quota della testa in questo istante, in metri: e' cio' che decide se il
 *  lampione caduto passa sopra o addosso. */
export function altezzaTesta(corridore) {
  return corridore.y + (abbassato(corridore) ? ALTEZZA_OMINO_ABBASSATO : ALTEZZA_OMINO);
}

/** Le corsie che il corpo tocca adesso: una sola, o due mentre si scavalca
 *  la riga. Serve a decidere gli urti. */
export function corsieOccupate(corridore) {
  const meta = SEMI_LARGHEZZA_OMINO / 2; // in corsie: la corsia e' larga 2 metri
  const da = Math.round(corridore.posizione - meta);
  const a = Math.round(corridore.posizione + meta);
  return da === a ? [da] : [da, a];
}

/** Fa barcollare l'omino per qualche istante dopo un urto. */
export function inciampa(corridore, durata) {
  corridore.inciampo = Math.max(corridore.inciampo, durata);
  return corridore;
}

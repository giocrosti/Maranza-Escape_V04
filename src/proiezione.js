// Da mondo a schermo: e' qui che la strada diventa prospettica.
//
// Il mondo e' in metri, con l'omino sempre nell'origine:
//   x  a destra   (0 = riga centrale della strada, +-3 = bordi)
//   y  in alto    (0 = asfalto)
//   z  in avanti  (0 = dove sta l'omino, cresce verso l'orizzonte)
//
// La telecamera sta dietro e sopra l'omino, e guarda dritta davanti a se'.
// Con una telecamera cosi' la proiezione e' una sola divisione: piu' una cosa
// e' lontana, piu' si stringe verso il punto di fuga, che sta sull'orizzonte.
// Modulo puro: non tocca il canvas, disegna solo chi lo chiama.

import { SEMI_STRADA, LARGHEZZA_CORSIA } from './costanti.js';

/** Quanto sta indietro la telecamera rispetto all'omino, in metri. */
export const DISTANZA_CAMERA = 4.5;

/** Quanto sta in alto, in metri. Alta: la strada si vede un po' dall'alto,
 *  che su uno schermo stretto e' l'unico modo di leggere le tre corsie. */
export const ALTEZZA_CAMERA = 4.5;

/** Dove cade l'orizzonte, in frazione dell'altezza dello schermo. Sopra ci
 *  stanno cielo e profilo della citta'. */
export const FRAZIONE_ORIZZONTE = 0.4;

/** Quanta larghezza dello schermo occupa la carreggiata all'altezza
 *  dell'omino. Il resto lo prendono marciapiedi e palazzi. */
const FRAZIONE_STRADA = 0.44;

/** Quanto in basso puo' finire l'omino sullo schermo. Serve solo alle finestre
 *  larghe (il computer): senza, in orizzontale la strada diventerebbe enorme e
 *  l'omino uscirebbe dal fondo. */
const CADUTA_MASSIMA = 0.42;

/** Piu' vicino di cosi' alla telecamera non si proietta: la divisione
 *  esploderebbe e le figure diventerebbero grandi quanto lo schermo. */
export const DISTANZA_MINIMA = 0.4;

/** Quanto la telecamera segue l'omino quando cambia corsia, da 0 (ferma) a 1
 *  (incollata).
 *
 *  Questo e' il pezzo che mancava per far sembrare il gioco un gioco e non una
 *  proiezione. Con la telecamera inchiodata al centro, cambiare corsia sposta
 *  l'omino nel riquadro e basta; con la telecamera che lo insegue **in ritardo**
 *  si sente lo scarto — il mondo scorre di lato, l'omino si stacca per un
 *  istante e poi si ricentra. E' il modo in cui si legge un cambio di corsia in
 *  tutti i giochi di corsa fatti bene.
 *
 *  Non 1: seguirlo del tutto cancellerebbe il movimento invece di raccontarlo. */
export const SEGUITO_CAMERA = 0.55;

/** I dati che servono a proiettare, ricalcolati a ogni ridimensionamento. */
export function creaVista(larghezza, altezza) {
  const vista = {
    larghezza: 0,
    altezza: 0,
    centroX: 0,
    orizzonte: 0,
    fuoco: 0,
    /** Dove guarda la telecamera, in metri dalla riga di mezzo. Non e' dove sta
     *  l'omino: e' dove **stava** un istante fa, ed e' quel ritardo a far
     *  sentire lo spostamento. */
    guarda: 0,
  };
  return ridimensionaVista(vista, larghezza, altezza);
}

export function ridimensionaVista(vista, larghezza, altezza) {
  vista.larghezza = larghezza;
  vista.altezza = altezza;
  vista.centroX = larghezza / 2;
  vista.orizzonte = altezza * FRAZIONE_ORIZZONTE;
  // La distanza focale e' decisa dalla larghezza (la strada deve starci
  // dentro), con un tetto dettato dall'altezza (l'omino deve restare in campo).
  vista.fuoco = Math.min(
    (larghezza * FRAZIONE_STRADA * DISTANZA_CAMERA) / SEMI_STRADA,
    (altezza * CADUTA_MASSIMA * DISTANZA_CAMERA) / ALTEZZA_CAMERA,
  );
  return vista;
}

/** Il punto (x, y, z) del mondo dove finisce sullo schermo.
 *  `scala` e' quanti pixel vale un metro a quella distanza: serve a
 *  dimensionare tutto il resto (una moneta larga 0,4 m e' larga 0,4 * scala). */
export function proietta(vista, x, y, z) {
  const distanza = Math.max(z + DISTANZA_CAMERA, DISTANZA_MINIMA);
  const scala = vista.fuoco / distanza;
  return {
    // `guarda` sposta il punto di vista, non l'immagine: entra prima della
    // divisione prospettica, quindi le cose vicine scorrono di lato piu' di
    // quelle lontane. E' una parallasse vera, gratis.
    x: vista.centroX + (x - vista.guarda) * scala,
    y: vista.orizzonte + (ALTEZZA_CAMERA - y) * scala,
    scala,
  };
}

/** Vero se il punto sta davanti alla telecamera: dietro non si proietta,
 *  si scarta. */
export function davantiAllaCamera(z) {
  return z + DISTANZA_CAMERA > DISTANZA_MINIMA;
}

/** Il centro della corsia, in metri. Corsia 0 a sinistra, 2 a destra.
 *  Accetta anche valori intermedi: durante il cambio di corsia l'omino sta
 *  a meta' strada fra due numeri interi. */
export function xDiCorsia(corsia) {
  return -SEMI_STRADA + (corsia + 0.5) * LARGHEZZA_CORSIA;
}

/** Il bordo sinistro della corsia: serve alle buche e ai lampioni, che
 *  occupano piu' corsie di fila. */
export function bordoSinistroDiCorsia(corsia) {
  return -SEMI_STRADA + corsia * LARGHEZZA_CORSIA;
}

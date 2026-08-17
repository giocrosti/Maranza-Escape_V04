// L'accensione di PixiJS.
//
// Si chiede WebGPU e si lascia che Pixi ricada da solo su WebGL2 dove non c'e':
// `preference: 'webgpu'` non vuol dire "solo WebGPU", vuol dire "prima questo".
// Su iPhone 15 Pro con iOS 18 WebGPU c'e'; su iOS 17 no, e il gioco deve
// partire lo stesso senza che nessuno se ne accorga.
//
// Due scelte che contano piu' di quanto sembri su un telefono:
//
// - **la risoluzione si tiene sotto 2.** Un iPhone 15 Pro ha un rapporto di 3:
//   disegnare 1179x2556 pixel per fotogramma, con dietro una catena di filtri a
//   schermo intero, e' il modo piu' rapido di scendere sotto i 60. A 2 la
//   differenza non si vede, il costo si dimezza abbondantemente.
// - **l'antialias e' spento.** Tutta la scena passa comunque per dei filtri a
//   schermo intero, che dell'antialias del disegno non saprebbero cosa farsene.

import { Application } from 'pixi.js';

/** Oltre questo non si sale, qualunque cosa dica il telefono. */
export const RISOLUZIONE_MASSIMA = 2;

export function risoluzioneUtile() {
  return Math.min(window.devicePixelRatio || 1, RISOLUZIONE_MASSIMA);
}

/** Il nome del motore che e' stato scelto davvero: 'webgpu' o 'webgl'. */
export function motoreDi(app) {
  const renderer = app.renderer;
  return renderer?.name || (renderer?.type === 2 ? 'webgl' : 'webgpu');
}

/** Quanto si aspetta un motore prima di considerarlo perso, in millisecondi.
 *
 *  Non e' un margine di sicurezza, e' una **rete**. La ricaduta automatica di
 *  PixiJS copre il caso "WebGPU non c'e'", non il caso "WebGPU c'e' a meta'":
 *  se il browser espone un adattatore ma poi non riesce a creare il dispositivo,
 *  Pixi stampa un avviso e la promessa di `init` **non si risolve mai**. Non
 *  fallisce: resta appesa. Il gioco non parte, la pagina resta nera e non c'e'
 *  nessun errore da leggere da nessuna parte.
 *
 *  Succede sul serio: e' esattamente quello che fa questa build su un Chromium
 *  senza GPU, ed e' quello che farebbe un iPhone con WebGPU dietro una bandiera
 *  sperimentale.
 *
 *  Due secondi e mezzo: un'inizializzazione riuscita ne impiega un decimo, e
 *  chi guarda uno schermo fermo comincia a chiedersi cosa non va molto prima
 *  che siano passati quattro secondi. */
const ATTESA_MOTORE = 2500;

function dopo(millisecondi, valore) {
  return new Promise((risolvi) => setTimeout(() => risolvi(valore), millisecondi));
}

/**
 * WebGPU si prova **prima** di darlo a PixiJS, e si prova fino in fondo:
 * l'adattatore *e* il dispositivo.
 *
 * Il controllo che fa Pixi si ferma all'adattatore, e li' sta la trappola: un
 * browser puo' esporre `navigator.gpu`, dare un adattatore, e poi non riuscire
 * a creare il dispositivo. A quel punto Pixi ha gia' scelto WebGPU, non torna
 * piu' indietro, e resta appeso.
 *
 * La prima versione di questa correzione metteva una corsa contro il tempo
 * attorno a `app.init`. Funzionava a meta': faceva partire la ricaduta, ma
 * lasciava in piedi un tentativo abbandonato che continuava a lavorare e
 * rallentava il secondo fino a farlo scadere a sua volta. Provare prima, e
 * lasciare a Pixi una sola inizializzazione pulita, e' l'unica forma che non
 * lascia niente per strada.
 */
async function webgpuUsabile(attesa) {
  if (typeof navigator === 'undefined' || !navigator.gpu) return false;

  const scaduto = Symbol('scaduto');
  try {
    const adattatore = await Promise.race([navigator.gpu.requestAdapter(), dopo(attesa, scaduto)]);
    if (!adattatore || adattatore === scaduto) return false;

    const dispositivo = await Promise.race([adattatore.requestDevice(), dopo(attesa, scaduto)]);
    if (!dispositivo || dispositivo === scaduto) return false;

    // era solo una prova: il dispositivo vero se lo crea Pixi
    dispositivo.destroy?.();
    return true;
  } catch {
    return false;
  }
}

/** Accende il motore migliore che risponde davvero. */
export async function creaApplicazione(canvas) {
  const motore = (await webgpuUsabile(ATTESA_MOTORE)) ? 'webgpu' : 'webgl';
  if (motore === 'webgl') {
    console.info('WebGPU non utilizzabile su questo browser: si usa WebGL2.');
  }

  const app = new Application();
  await app.init(opzioniDi(canvas, motore));
  return app;
}

function opzioniDi(canvas, motore) {
  return {
    canvas,
    // Un motore per volta, e mai `canvas`: il rendering su canvas 2D di Pixi non
    // sa eseguire nessuno dei filtri di questo gioco, e ricadere li' vorrebbe
    // dire mostrare una scena senza luci, senza profondita' e senza colore
    // fingendo che vada tutto bene. Meglio non partire e dirlo.
    preference: motore,
    resolution: risoluzioneUtile(),
    autoDensity: true,
    antialias: false,
    powerPreference: 'high-performance',
    // Il cielo lo dipinge il gioco: lo sfondo serve solo al primo fotogramma,
    // e deve essere lo stesso azzurro del manifest o all'avvio si vede un lampo.
    background: 0x7ea6cc,
    backgroundAlpha: 1,
    // Il ciclo di gioco e' gia' scritto e sta in main.js: quello di Pixi
    // farebbe solo un secondo requestAnimationFrame in parallelo.
    autoStart: false,
    sharedTicker: false,
    // Su iOS il contesto si perde uscendo e rientrando dall'app: senza questo
    // si torna a un canvas nero.
    preserveDrawingBuffer: false,
  };
}

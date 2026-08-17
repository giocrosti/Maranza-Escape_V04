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

export async function creaApplicazione(canvas) {
  const app = new Application();

  await app.init({
    canvas,
    // Elenco esplicito, non `preference: 'webgpu'`: quella forma aggiunge in
    // coda anche il rendering su canvas 2D di Pixi, che non sa eseguire nessuno
    // dei filtri di questo gioco. Ricadere li' vorrebbe dire mostrare una scena
    // senza luci, senza profondita' e senza colore fingendo che vada tutto bene.
    // Meglio non partire e dirlo.
    preference: ['webgpu', 'webgl'],
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
  });

  return app;
}

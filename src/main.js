// Punto di ingresso: collega canvas, ciclo di gioco e disegno.

import {
  creaMondo,
  avanzaMondo,
  ridimensionaMondo,
  avviaPartita,
  puoRiavviare,
  comando,
} from './mondo.js';
import { disegnaMondo } from './render.js';
import { collegaInput, azioneDaTasto } from './input.js';
import { leggiRecord, aggiornaRecord } from './record.js';

const canvas = document.getElementById('gioco');
const ctx = canvas.getContext('2d');
const sicurezza = document.getElementById('sicurezza');

const mondo = creaMondo(window.innerWidth, window.innerHeight);

const interfaccia = {
  fps: 0,
  record: leggiRecord(),
  mostraFps: false,
  // zone coperte da tacca, isola dinamica e barra di casa
  margini: { alto: 0, destro: 0, basso: 0, sinistro: 0 },
};

/** Legge i margini di sicurezza dal riquadro nascosto in pagina.
 *  Su computer sono tutti zero; su iPhone valgono decine di pixel, e senza
 *  tenerne conto il punteggio finisce sotto l'isola dinamica. */
function leggiMarginiSicurezza() {
  if (!sicurezza) return;
  const stile = getComputedStyle(sicurezza);
  interfaccia.margini = {
    alto: parseFloat(stile.paddingTop) || 0,
    destro: parseFloat(stile.paddingRight) || 0,
    basso: parseFloat(stile.paddingBottom) || 0,
    sinistro: parseFloat(stile.paddingLeft) || 0,
  };
}

/** Adatta il canvas alla finestra, ma solo se qualcosa e' cambiato davvero:
 *  riassegnare `canvas.width` azzera il contenuto, quindi non va fatto a ogni
 *  fotogramma. */
function adattaCanvas() {
  // Il canvas ha due dimensioni: quella CSS (px logici) e quella del buffer
  // (px fisici). Su schermi ad alta densita' vanno tenute separate, altrimenti
  // il disegno risulta sfocato.
  const dpr = window.devicePixelRatio || 1;
  const larghezza = window.innerWidth;
  const altezza = window.innerHeight;
  const larghezzaBuffer = Math.round(larghezza * dpr);
  const altezzaBuffer = Math.round(altezza * dpr);
  if (canvas.width === larghezzaBuffer && canvas.height === altezzaBuffer) return;

  canvas.width = larghezzaBuffer;
  canvas.height = altezzaBuffer;
  canvas.style.width = larghezza + 'px';
  canvas.style.height = altezza + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ridimensionaMondo(mondo, larghezza, altezza);
  // i margini cambiano ruotando il telefono, quindi si rileggono qui
  leggiMarginiSicurezza();
}

let ultimoTempo = performance.now();
let contatoreFotogrammi = 0;
let tempoContatore = 0;
let statoPrecedente = mondo.stato;

function ciclo(ora) {
  const dt = (ora - ultimoTempo) / 1000;
  ultimoTempo = ora;

  // Controllo a ogni fotogramma invece che sul solo evento `resize`: se la
  // pagina nasce in una scheda nascosta la finestra misura 0x0, e senza questo
  // il canvas resterebbe vuoto per sempre.
  adattaCanvas();

  avanzaMondo(mondo, dt);

  // Il record si aggiorna nell'istante in cui la partita si chiude.
  if (statoPrecedente !== 'finita' && mondo.stato === 'finita') {
    interfaccia.record = aggiornaRecord(mondo.punteggio);
    lasciaSpegnereLoSchermo();
  }
  statoPrecedente = mondo.stato;

  contatoreFotogrammi += 1;
  tempoContatore += dt;
  if (tempoContatore >= 0.5) {
    interfaccia.fps = Math.round(contatoreFotogrammi / tempoContatore);
    contatoreFotogrammi = 0;
    tempoContatore = 0;
  }

  disegnaMondo(ctx, mondo, interfaccia);
  if (interfaccia.mostraFps) disegnaFps();
  requestAnimationFrame(ciclo);
}

function disegnaFps() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(
    `${interfaccia.fps} fps · ${mondo.velocita.toFixed(1)} m/s · distacco ${mondo.inseguitori.distacco.toFixed(1)}`,
    mondo.vista.larghezza / 2,
    mondo.vista.altezza - interfaccia.margini.basso - 4,
  );
}

function partenza() {
  if (mondo.stato === 'in-gioco' || !puoRiavviare(mondo)) return;
  avviaPartita(mondo);
  tieniAccesoLoSchermo();
}

collegaInput(canvas, {
  azione: (azione) => {
    // Fuori dalla partita anche una passata fa partire: chi ha gia' il pollice
    // in movimento non deve scoprire che serviva un tocco secco.
    if (mondo.stato !== 'in-gioco') partenza();
    else comando(mondo, azione);
  },
  tocco: partenza,
});

window.addEventListener('keydown', (evento) => {
  const azione = azioneDaTasto(evento.key);
  if (azione) {
    evento.preventDefault();
    if (mondo.stato !== 'in-gioco') partenza();
    else comando(mondo, azione);
    return;
  }
  if (evento.key === 'Enter') {
    evento.preventDefault();
    partenza();
  }
  // diagnostica a richiesta: durante una partita il contatore distrae
  if (evento.key === 'f' || evento.key === 'F') interfaccia.mostraFps = !interfaccia.mostraFps;
});

// --- comportamenti da app installata ---------------------------------------

/** Tenere acceso lo schermo mentre si gioca: senza, dopo qualche secondo senza
 *  tocchi il telefono si spegne in mezzo a una partita. Non e' disponibile
 *  ovunque, e se manca si gioca lo stesso. */
let blocco = null;

async function tieniAccesoLoSchermo() {
  if (!('wakeLock' in navigator) || blocco) return;
  try {
    blocco = await navigator.wakeLock.request('screen');
    blocco.addEventListener('release', () => {
      blocco = null;
    });
  } catch (errore) {
    blocco = null; // batteria bassa o permesso negato: pazienza
  }
}

function lasciaSpegnereLoSchermo() {
  if (!blocco) return;
  blocco.release().catch(() => {});
  blocco = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    lasciaSpegnereLoSchermo();
    return;
  }
  // Tornando dall'app in secondo piano il tempo e' andato avanti, ma il gioco
  // no: senza questo, il primo fotogramma varrebbe un salto enorme, e si
  // riaprirebbe l'app gia' dentro un ostacolo.
  ultimoTempo = performance.now();
  if (mondo.stato === 'in-gioco') tieniAccesoLoSchermo();
});

/** Il service worker fa funzionare il gioco senza rete, ma serve solo alla
 *  versione pubblicata: in locale terrebbe in cache i file mentre li si
 *  modifica, che e' esattamente il problema che il dev-server evita. */
function registraServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (['localhost', '127.0.0.1'].includes(location.hostname)) return;
  navigator.serviceWorker.register('./sw.js').catch(() => {
    /* senza service worker si gioca comunque, solo con la rete */
  });
}

adattaCanvas();
registraServiceWorker();
requestAnimationFrame(ciclo);

// utile per ispezionare lo stato dalla console durante lo sviluppo
window.mondo = mondo;
window.interfaccia = interfaccia;

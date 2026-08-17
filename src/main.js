// Punto di ingresso: accende PixiJS, collega i comandi e tiene il ciclo di gioco.
//
// Lo schermo e' fatto di due tele sovrapposte, e la divisione non e' un
// dettaglio di implementazione:
//
//   #gioco        la scena, montata da PixiJS su WebGPU (o WebGL2 dove manca).
//                 Passa dai layer di profondita', dalle luci e dal
//                 post-processing.
//   #interfaccia  punteggio, pulsanti e schermate, in canvas 2D, sopra.
//                 Fuori dal post-processing apposta: aberrazione cromatica e
//                 vignetta su una scritta la rendono solo illeggibile.
//
// Il mondo — regole, corsie, urti, punteggio — non sa niente di tutto questo, ed
// e' rimasto quello di prima: `mondo.js` e i suoi moduli non hanno una riga che
// parli di canvas, di Pixi o di pixel.

import {
  creaMondo,
  avanzaMondo,
  ridimensionaMondo,
  avviaPartita,
  puoRiavviare,
  comando,
  alternaPausa,
  mettiInPausa,
  inPausa,
  tornaAllaHome,
  apriIstruzioni,
  chiudiIstruzioni,
} from './mondo.js';
import { disegnaInterfaccia } from './render.js';
import { collegaInput, azioneDaTasto } from './input.js';
import { leggiRecord, aggiornaRecord } from './record.js';
import {
  areaPausa,
  toccaPausa,
  areaIstruzioni,
  areaCasa,
  areaCondivisione,
  toccaRiquadro,
} from './pulsanti.js';
import { sapraCondividere, condividiRecord } from './interfaccia/condivisione.js';
import { creaApplicazione, motoreDi, risoluzioneUtile } from './grafica/applicazione.js';
import { Scena } from './grafica/scena.js';
import { creaQualita, valutaQualita } from './grafica/qualita.js';
import { creaAnimazioni, avanzaAnimazioni } from './interfaccia/animazioni.js';
import { creaCassa, sblocca, aggiornaCassa, zittisci } from './suono/cassa.js';
import { minaccia } from './inseguitori.js';

const canvasScena = document.getElementById('gioco');
const canvasInterfaccia = document.getElementById('interfaccia');
const ctxInterfaccia = canvasInterfaccia.getContext('2d');
const sicurezza = document.getElementById('sicurezza');

const mondo = creaMondo(window.innerWidth, window.innerHeight);

const interfaccia = {
  fps: 0,
  record: leggiRecord(),
  mostraFps: false,
  // zone coperte da tacca, isola dinamica e barra di casa
  margini: { alto: 0, destro: 0, basso: 0, sinistro: 0 },
  // i valori che si muovono con una curva invece che a scatto
  animazioni: creaAnimazioni(),
  // il pulsante di condivisione compare solo dove la condivisione esiste
  puoCondividere: sapraCondividere(),
  esitoCondivisione: null,
};

/** La cassa degli inseguitori. Nasce muta: iOS non fa suonare niente finche'
 *  non c'e' stato un tocco, quindi si accende al primo comando. */
const cassa = creaCassa();

let app;
try {
  app = await creaApplicazione(canvasScena);
} catch (errore) {
  spiegaCheNonSiPuoGiocare(errore);
  throw errore;
}
const scena = new Scena(app);

/** Senza WebGPU ne' WebGL2 non c'e' niente da fare: la scena e' fatta di layer
 *  e filtri, e nessuno dei due esiste su un canvas 2D. Meglio una frase chiara
 *  di uno schermo nero. */
function spiegaCheNonSiPuoGiocare() {
  document.body.innerHTML =
    '<div style="color:#f7f8fa;font:16px/1.5 system-ui;padding:32px;text-align:center">' +
    '<p><b>Questo telefono non regge la grafica del gioco.</b></p>' +
    '<p>Serve un browser con WebGPU o WebGL2. Su iPhone basta aggiornare iOS.</p>' +
    '</div>';
  document.body.style.background = '#1b2536';
}

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

let larghezzaAttuale = 0;
let altezzaAttuale = 0;

/** Se il telefono non tiene i sessanta, si scende di risoluzione invece di
 *  restare belli e a scatti. */
const qualita = creaQualita(risoluzioneUtile());

/** Adatta le due tele alla finestra, ma solo se qualcosa e' cambiato davvero:
 *  rigenerare i fondali e riallocare le texture a ogni fotogramma sarebbe il
 *  modo piu' rapido di non arrivare mai a sessanta. */
function adatta() {
  const larghezza = window.innerWidth;
  const altezza = window.innerHeight;
  if (larghezza === larghezzaAttuale && altezza === altezzaAttuale) return;
  if (larghezza < 2 || altezza < 2) return; // pagina in una scheda nascosta
  larghezzaAttuale = larghezza;
  altezzaAttuale = altezza;

  ridimensionaMondo(mondo, larghezza, altezza);

  app.renderer.resize(larghezza, altezza, qualita.risoluzione);
  scena.ridimensiona(larghezza, altezza, mondo.vista.orizzonte, qualita.risoluzione);

  // L'interfaccia sta alla densita' piena dello schermo, non a quella tagliata
  // della scena: le scritte sono l'unica cosa che si legge, e su un iPhone la
  // differenza fra 2 e 3 su un testo si vede.
  const dpr = window.devicePixelRatio || 1;
  canvasInterfaccia.width = Math.round(larghezza * dpr);
  canvasInterfaccia.height = Math.round(altezza * dpr);
  canvasInterfaccia.style.width = larghezza + 'px';
  canvasInterfaccia.style.height = altezza + 'px';
  ctxInterfaccia.setTransform(dpr, 0, 0, dpr, 0, 0);

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

  adatta();
  avanzaMondo(mondo, dt);

  // Il record si aggiorna nell'istante in cui la partita si chiude.
  if (statoPrecedente !== 'finita' && mondo.stato === 'finita') {
    interfaccia.record = aggiornaRecord(mondo.punteggio);
    lasciaSpegnereLoSchermo();
    zittisci(cassa);
  }
  statoPrecedente = mondo.stato;

  // Il giudizio sulla qualita' si prende sul tempo vero del fotogramma, non
  // sugli fps arrotondati: e' il p95 che conta, e gli fps mediati lo perdono.
  const nuovaRisoluzione = valutaQualita(qualita, dt * 1000);
  if (nuovaRisoluzione) {
    app.renderer.resize(larghezzaAttuale, altezzaAttuale, nuovaRisoluzione);
    scena.ridimensiona(larghezzaAttuale, altezzaAttuale, mondo.vista.orizzonte, nuovaRisoluzione);
  }

  contatoreFotogrammi += 1;
  tempoContatore += dt;
  if (tempoContatore >= 0.5) {
    interfaccia.fps = Math.round(contatoreFotogrammi / tempoContatore);
    contatoreFotogrammi = 0;
    tempoContatore = 0;
  }

  // Lo stesso passo che vede il mondo: le particelle devono muoversi con la
  // strada, non col cronometro di sistema.
  const passo = Math.min(Math.max(dt, 0), 0.05);
  avanzaAnimazioni(interfaccia.animazioni, mondo, passo);
  aggiornaCassa(cassa, minaccia(mondo.inseguitori), mondo.stato === 'in-gioco');

  scena.aggiorna(mondo, passo);
  app.render();

  disegnaInterfaccia(ctxInterfaccia, mondo, interfaccia);
  if (interfaccia.mostraFps) disegnaFps();

  requestAnimationFrame(ciclo);
}

function disegnaFps() {
  const ctx = ctxInterfaccia;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(
    `${interfaccia.fps} fps · ${motoreGrafico} · ${mondo.velocita.toFixed(1)} m/s · ` +
      `part ${scena.particelleVive} · distacco ${mondo.inseguitori.distacco.toFixed(1)}`,
    mondo.vista.larghezza / 2,
    mondo.vista.altezza - interfaccia.margini.basso - 4,
  );
}

function partenza() {
  if (mondo.stato === 'in-gioco' || !puoRiavviare(mondo)) return;
  avviaPartita(mondo);
  tieniAccesoLoSchermo();
}

/** Il pulsante di pausa, e il tocco che riprende da fermo. */
function commutaPausa() {
  if (!alternaPausa(mondo)) return;
  if (inPausa(mondo)) {
    lasciaSpegnereLoSchermo();
    zittisci(cassa);
  } else {
    tieniAccesoLoSchermo();
  }
}

/** Torna alla schermata iniziale e lascia spegnere lo schermo. */
function vaiAllaHome() {
  if (!tornaAllaHome(mondo)) return false;
  lasciaSpegnereLoSchermo();
  zittisci(cassa);
  return true;
}

/** Il primo gesto dell'utente, qualunque sia, e' anche quello che accende
 *  l'audio: e' l'unico momento in cui Safari lo permette. Chiamarla piu' volte
 *  non costa niente. */
function primoGesto() {
  sblocca(cassa);
}

/** I pulsanti, in ordine di precedenza. Ritorna true se il tocco e' stato
 *  preso da uno di loro, cosi' non conta anche come tocco sullo schermo. */
function pulsanteSotto(x, y) {
  const inGiocoOFermo = mondo.stato === 'in-gioco' || inPausa(mondo);
  if (inGiocoOFermo && toccaPausa(areaPausa(mondo.vista, interfaccia.margini), x, y)) {
    commutaPausa();
    return true;
  }
  // "torna alla home": in pausa subito, a partita finita solo dopo il ritardo
  // che protegge dai tocchi involontari, cioe' quando compare
  const casaVisibile = inPausa(mondo) || (mondo.stato === 'finita' && puoRiavviare(mondo));
  if (casaVisibile && toccaRiquadro(areaCasa(mondo.vista, inPausa(mondo)), x, y)) {
    vaiAllaHome();
    return true;
  }
  // La condivisione si chiama **da qui dentro**, senza nessun await prima:
  // Safari accetta `navigator.share` solo se la chiamata parte dalla catena di
  // un gesto vero, e basta un `await` di troppo per perdere quel diritto.
  const condivisioneVisibile =
    interfaccia.puoCondividere && mondo.stato === 'finita' && puoRiavviare(mondo);
  if (condivisioneVisibile && toccaRiquadro(areaCondivisione(mondo.vista), x, y)) {
    interfaccia.esitoCondivisione = 'apro...';
    condividiRecord(mondo).then((esito) => {
      interfaccia.esitoCondivisione =
        esito === 'mandato' ? 'mandato!' : esito === 'annullato' ? 'manda il record' : null;
    });
    return true;
  }
  if (mondo.stato === 'attesa' && toccaRiquadro(areaIstruzioni(mondo.vista), x, y)) {
    apriIstruzioni(mondo);
    return true;
  }
  return false;
}

// I comandi si prendono sulla tela dell'interfaccia perche' e' quella sopra:
// e' li' che il dito arriva davvero.
collegaInput(canvasInterfaccia, {
  intercetta: (x, y) => {
    primoGesto();
    return pulsanteSotto(x, y);
  },
  azione: (azione) => {
    // Sulle istruzioni qualunque gesto chiude la pagina: non si comanda niente.
    if (mondo.stato === 'istruzioni') chiudiIstruzioni(mondo);
    // In pausa una passata non comanda l'omino: fa solo riprendere.
    else if (inPausa(mondo)) commutaPausa();
    // Fuori dalla partita anche una passata fa partire: chi ha gia' il pollice
    // in movimento non deve scoprire che serviva un tocco secco.
    else if (mondo.stato !== 'in-gioco') partenza();
    else comando(mondo, azione);
  },
  tocco: () => {
    if (mondo.stato === 'istruzioni') chiudiIstruzioni(mondo);
    else if (inPausa(mondo)) commutaPausa();
    else partenza();
  },
});

window.addEventListener('keydown', (evento) => {
  primoGesto();
  if (evento.key === 'p' || evento.key === 'P' || evento.key === 'Escape') {
    evento.preventDefault();
    if (mondo.stato === 'istruzioni') chiudiIstruzioni(mondo);
    else commutaPausa();
    return;
  }
  if (evento.key === 'h' || evento.key === 'H') {
    evento.preventDefault();
    if (mondo.stato === 'attesa') apriIstruzioni(mondo);
    else vaiAllaHome();
    return;
  }
  const azione = azioneDaTasto(evento.key);
  if (azione) {
    evento.preventDefault();
    if (mondo.stato === 'istruzioni') chiudiIstruzioni(mondo);
    else if (inPausa(mondo)) commutaPausa();
    else if (mondo.stato !== 'in-gioco') partenza();
    else comando(mondo, azione);
    return;
  }
  if (evento.key === 'Enter') {
    evento.preventDefault();
    if (mondo.stato === 'istruzioni') chiudiIstruzioni(mondo);
    else if (inPausa(mondo)) commutaPausa();
    else partenza();
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
    // Chi torna da una chiamata o da un'altra app non deve trovarsi morto:
    // uscire mette in pausa, e si riprende quando si vuole.
    mettiInPausa(mondo);
    lasciaSpegnereLoSchermo();
    zittisci(cassa);
    return;
  }
  // Il tempo e' andato avanti mentre l'app era dietro, ma il gioco no: senza
  // questo, il primo fotogramma varrebbe un salto enorme.
  ultimoTempo = performance.now();
});

/** Il service worker fa funzionare il gioco senza rete, ma serve solo alla
 *  versione pubblicata: in locale terrebbe in cache i file mentre li si
 *  modifica, che e' esattamente il problema che il server di sviluppo evita. */
function registraServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (['localhost', '127.0.0.1'].includes(location.hostname)) return;
  navigator.serviceWorker.register(new URL('sw.js', location.href).href).catch(() => {
    /* senza service worker si gioca comunque, solo con la rete */
  });
}

const motoreGrafico = motoreDi(app);

adatta();
registraServiceWorker();
requestAnimationFrame(ciclo);

// utili per ispezionare lo stato dalla console e per gli scatti di confronto
window.mondo = mondo;
window.interfaccia = interfaccia;
window.scena = scena;
window.motoreGrafico = motoreGrafico;

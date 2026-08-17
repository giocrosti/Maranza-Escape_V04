// Misura le prestazioni invece di stimarle.
//
// Tre numeri, e nessuno dei tre si puo' indovinare leggendo il codice:
//
//   **chiamate di disegno per fotogramma** — contate avvolgendo le funzioni di
//   WebGL prima che la pagina si carichi. Non c'e' un contatore da chiedere a
//   PixiJS: l'unico modo onesto e' contare le chiamate vere.
//   **tempo per fotogramma** — la mediana e il novantacinquesimo percentile,
//   non la media. La media nasconde esattamente quello che si vuole vedere: uno
//   scatto ogni due secondi sparisce in una media e rovina una partita.
//   **texture vive** — per accorgersi che qualcosa non viene buttato via.
//
// Un avvertimento che vale piu' dei numeri: **questo non e' Safari su iPhone.**
// Gira su Chromium, su un computer. Serve a trovare le regressioni e a sapere
// se una modifica costa il doppio o la meta'; per sapere se tiene i sessanta su
// un telefono non c'e' scorciatoia, bisogna aprirlo sul telefono.
//
//   node strumenti/prestazioni.mjs [--secondi 8]

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = 5183;

const args = process.argv.slice(2);
const leggi = (nome, difetto) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : difetto;
};
const secondi = Number(leggi('secondi', 8));
// gli stessi interruttori degli scatti: servono a sapere **dove** va il tempo,
// che e' l'unica domanda utile quando un numero non torna
const query = leggi('query', '');

const processo = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vite', '--port', String(PORTA), '--strictPort', '--host', '127.0.0.1'],
  { cwd: RADICE, stdio: 'ignore', shell: process.platform === 'win32' },
);
const spegni = () => {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(processo.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    processo.kill();
  }
};

const url = `http://127.0.0.1:${PORTA}/`;
for (let i = 0; i < 100; i += 1) {
  try {
    if ((await fetch(url)).ok) break;
  } catch {
    /* non ancora */
  }
  await new Promise((r) => setTimeout(r, 300));
}

const browser = await chromium.launch({
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-gpu'],
});
const contesto = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

// Va installato **prima** che la pagina si carichi: dopo, PixiJS ha gia' preso
// il suo riferimento alle funzioni e avvolgerle non conterebbe piu' niente.
await contesto.addInitScript(() => {
  window.__misure = { chiamate: 0, fotogrammi: 0, tempi: [], perFotogramma: [] };

  const conta = (prototipo, nomi) => {
    if (!prototipo) return;
    for (const nome of nomi) {
      const originale = prototipo[nome];
      if (!originale) continue;
      prototipo[nome] = function (...argomenti) {
        window.__misure.chiamate += 1;
        return originale.apply(this, argomenti);
      };
    }
  };
  const disegni = ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'];
  conta(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype, disegni);
  conta(window.WebGLRenderingContext && WebGLRenderingContext.prototype, disegni);

  let ultimo = performance.now();
  const passo = () => {
    const ora = performance.now();
    const m = window.__misure;
    m.tempi.push(ora - ultimo);
    m.perFotogramma.push(m.chiamate);
    m.chiamate = 0;
    m.fotogrammi += 1;
    ultimo = ora;
    requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
});

const pagina = await contesto.newPage();
await pagina.goto(query ? `${url}?${query}` : url, { waitUntil: 'load' });
await pagina.waitForFunction(() => Boolean(window.mondo), null, { timeout: 15000 });

// Si misura **giocando**, non sulla schermata iniziale: e' in corsa che ci sono
// ostacoli, particelle, luci e inseguitori, cioe' tutto quello che costa.
await pagina.evaluate(() => {
  const m = window.mondo;
  m.stato = 'in-gioco';
  m.distanza = 200;
  m.scorrimento = 200;
  m.velocita = 28;
  m.inseguitori.distacco = 1.6;
});

// un secondo di rodaggio: i primi fotogrammi compilano shader e caricano
// texture, e includerli falserebbe tutto in peggio
await pagina.waitForTimeout(1000);
await pagina.evaluate(() => {
  window.__misure.tempi.length = 0;
  window.__misure.perFotogramma.length = 0;
});

await pagina.waitForTimeout(secondi * 1000);

const esito = await pagina.evaluate(() => {
  const m = window.__misure;
  const ordina = (v) => [...v].sort((a, b) => a - b);
  const percentile = (v, p) => (v.length ? ordina(v)[Math.floor((v.length - 1) * p)] : 0);
  const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
  return {
    motore: window.motoreGrafico,
    fotogrammi: m.tempi.length,
    tempoMediano: percentile(m.tempi, 0.5),
    tempo95: percentile(m.tempi, 0.95),
    tempoPeggiore: Math.max(...m.tempi, 0),
    chiamateMedie: media(m.perFotogramma),
    chiamateMassime: Math.max(...m.perFotogramma, 0),
    particelle: window.scena ? window.scena.particelleVive : -1,
  };
});

const fps = esito.tempoMediano > 0 ? 1000 / esito.tempoMediano : 0;
console.log('');
console.log(`configurazione              ${query || 'tutto acceso'}`);
console.log(`motore                      ${esito.motore}`);
console.log(`fotogrammi misurati         ${esito.fotogrammi}`);
console.log(`tempo per fotogramma        mediana ${esito.tempoMediano.toFixed(2)} ms  ` +
  `p95 ${esito.tempo95.toFixed(2)} ms  peggiore ${esito.tempoPeggiore.toFixed(2)} ms`);
console.log(`fotogrammi al secondo       ${fps.toFixed(1)} (dalla mediana)`);
console.log(`chiamate di disegno         media ${esito.chiamateMedie.toFixed(1)}  ` +
  `massimo ${esito.chiamateMassime}`);
console.log(`particelle vive alla fine   ${esito.particelle}`);
console.log('');

const problemi = [];
if (esito.chiamateMassime >= 100) {
  problemi.push(`chiamate di disegno oltre il tetto di 100 (${esito.chiamateMassime})`);
}
if (esito.tempo95 > 16.7) {
  problemi.push(`il 5% dei fotogrammi sfora i 16,7 ms (p95 = ${esito.tempo95.toFixed(1)} ms)`);
}
for (const p of problemi) console.error('ATTENZIONE: ' + p);
console.log('Nota: e Chromium su computer, non Safari su iPhone.');

await browser.close();
spegni();
process.exit(problemi.length ? 1 : 0);

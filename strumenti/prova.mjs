// Esegue i test.
//
// I test girano **nel browser**, non in Node, e non e' una scelta di comodo: la
// meta' di quello che c'e' da verificare — che un filtro compili, che una LUT
// abbia i pixel giusti, che il manifest si scarichi — esiste solo dentro un
// browser. Questo script apre `tests.html`, aspetta che l'esito finisca nel
// titolo della pagina e riporta a riga di comando quello che ha trovato.
//
//   npm test

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = 5182;

// --- controlli sui file su disco -------------------------------------------
//
// Questi non possono stare nella suite del browser: il server di sviluppo
// riscrive i percorsi della pagina, e guardando quello che serve si vedrebbero
// percorsi assoluti sempre e comunque. Quello che deve restare relativo e' il
// **sorgente** e la **cartella costruita**, che sono file, e si leggono da qui.

const problemi = [];

function controllaPercorsiRelativi(percorso, etichetta) {
  if (!existsSync(percorso)) return;
  const html = readFileSync(percorso, 'utf8');
  // `/@vite/...` lo mette il server di sviluppo e non finisce mai nel costruito
  const assoluti = (html.match(/(?:src|href)="\/[^/@][^"]*"/g) || []).join(', ');
  if (assoluti) {
    problemi.push(
      `${etichetta}: percorsi assoluti (${assoluti}). Su GitHub Pages il gioco sta in una sottocartella e questi puntano fuori.`,
    );
  }
}

controllaPercorsiRelativi(join(RADICE, 'index.html'), 'index.html');
controllaPercorsiRelativi(join(RADICE, 'dist', 'index.html'), 'dist/index.html');

if (existsSync(join(RADICE, 'dist'))) {
  const manifest = join(RADICE, 'dist', 'manifest.json');
  if (!existsSync(manifest)) problemi.push('dist: manca manifest.json');
  if (!existsSync(join(RADICE, 'dist', 'sw.js'))) {
    problemi.push('dist: manca sw.js, quindi niente gioco senza rete');
  }
}

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

const url = `http://127.0.0.1:${PORTA}/tests.html`;
let acceso = false;
for (let i = 0; i < 100; i += 1) {
  try {
    if ((await fetch(url)).ok) {
      acceso = true;
      break;
    }
  } catch {
    /* non ancora */
  }
  await new Promise((r) => setTimeout(r, 300));
}
if (!acceso) {
  console.error('il server di sviluppo non e partito');
  spegni();
  process.exit(1);
}

const browser = await chromium.launch();
const pagina = await browser.newPage();
const falliti = [];
pagina.on('console', (m) => {
  if (m.text().startsWith('FAIL ')) falliti.push(m.text());
});
pagina.on('pageerror', (e) => falliti.push(`ERRORE DI PAGINA ${e.message}`));

await pagina.goto(url, { waitUntil: 'load' });
await pagina.waitForFunction(() => /^TEST (OK|FALLITI)/.test(document.title), null, {
  timeout: 30000,
});

const titolo = await pagina.title();
console.log(titolo);
for (const riga of falliti) console.error('  ' + riga);

// --- il pacchetto costruito parte davvero? ---------------------------------
//
// Questo controllo esiste perche' e' mancato una volta, ed e' costato caro: il
// gioco funzionava in sviluppo e nel pacchetto costruito **non partiva**. Non
// dava errori, non falliva nessuna richiesta: l'inizializzazione restava appesa
// e lo schermo restava vuoto. Era colpa di come Rollup spezzava PixiJS in
// chunk, cioe' di una cosa che in sviluppo non esiste proprio.
//
// Morale: una suite che prova solo i sorgenti non dice niente su cio' che si
// pubblica. Se `dist/` c'e', si apre e si guarda se il mondo nasce.
if (existsSync(join(RADICE, 'dist', 'index.html'))) {
  const anteprima = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', 'preview', '--port', '5184', '--strictPort', '--host', '127.0.0.1'],
    { cwd: RADICE, stdio: 'ignore', shell: process.platform === 'win32' },
  );
  const spegniAnteprima = () => {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(anteprima.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      anteprima.kill();
    }
  };

  const indirizzo = 'http://127.0.0.1:5184/';
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(indirizzo)).ok) break;
    } catch {
      /* non ancora */
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  const costruito = await browser.newPage();
  try {
    await costruito.goto(indirizzo, { waitUntil: 'load' });
    // generoso: se un motore grafico non risponde, la ricaduta sull'altro
    // arriva dopo qualche secondo, e non e' un guasto
    await costruito.waitForFunction(() => Boolean(window.mondo), null, { timeout: 20000 });
    const motore = await costruito.evaluate(() => window.motoreGrafico);
    console.log(`il pacchetto costruito parte (motore: ${motore})`);
  } catch {
    problemi.push(
      'il pacchetto in dist/ non parte: window.mondo non compare entro 20 secondi. ' +
        'In sviluppo puo funzionare lo stesso — guarda come e stato spezzato il bundle.',
    );
  }
  await costruito.close();
  spegniAnteprima();
}

if (problemi.length) {
  console.error(`CONTROLLI SUI FILE FALLITI (${problemi.length})`);
  for (const p of problemi) console.error('  ' + p);
} else {
  console.log('controlli sui file: ok');
}

await browser.close();
spegni();
process.exit(titolo.startsWith('TEST OK') && problemi.length === 0 ? 0 : 1);

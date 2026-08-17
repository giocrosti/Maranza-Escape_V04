// Apre il gioco e riporta *tutto* quello che dice la console, non solo gli
// errori. Serve quando uno shader non compila: Pixi stampa il sorgente
// annotato con un `warn`, e con il solo filtro sugli errori si vede la frase
// "Could not initialize shader" senza mai vedere la riga colpevole.
//
//   node strumenti/diagnostica.mjs [--url http://...] [--filtro parola]

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const leggi = (nome, difetto) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : difetto;
};

const porta = Number(leggi('porta', 5181));
const filtro = leggi('filtro', null);

const processo = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vite', '--port', String(porta), '--strictPort', '--host', '127.0.0.1'],
  { cwd: RADICE, stdio: 'ignore', shell: process.platform === 'win32' },
);

const spegni = () => {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(processo.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    processo.kill();
  }
};

const url = leggi('url', `http://127.0.0.1:${porta}/`);
for (let i = 0; i < 100; i += 1) {
  try {
    if ((await fetch(url)).ok) break;
  } catch {
    /* non ancora */
  }
  await new Promise((r) => setTimeout(r, 300));
}

// `--forza-webgpu` monta l'adattatore software di Dawn. Non serve a misurare
// niente — e' lentissimo — ma e' l'unico modo, su una macchina senza GPU
// esposta, di sapere se gli shader WGSL compilano davvero. Fare a meno di questa
// verifica vuol dire scoprire su un iPhone che meta' dei filtri non esiste.
const forzaWebgpu = args.includes('--forza-webgpu');
const browser = await chromium.launch({
  args: [
    '--enable-unsafe-webgpu',
    '--ignore-gpu-blocklist',
    '--enable-gpu',
    ...(forzaWebgpu
      ? ['--use-webgpu-adapter=swiftshader', '--enable-features=Vulkan', '--use-angle=swiftshader']
      : []),
  ],
});
const pagina = await browser.newPage({ viewport: { width: 393, height: 852 } });

// `main.js` ha un await di primo livello, quindi il suo corpo e' una promessa:
// un'eccezione dopo quell'await diventa un rifiuto non gestito, e i rifiuti non
// gestiti **non passano** da `pageerror`. Senza questo aggancio il sintomo e'
// "la pagina si carica, non stampa niente, e il gioco non c'e'": il modo piu'
// lungo possibile di scoprire un errore che si presenta da solo.
await pagina.addInitScript(() => {
  window.addEventListener('unhandledrejection', (evento) => {
    const motivo = evento.reason;
    console.error('RIFIUTO NON GESTITO: ' + (motivo && motivo.stack ? motivo.stack : motivo));
  });
});

pagina.on('console', (m) => {
  const testo = m.text();
  if (filtro && !testo.includes(filtro)) return;
  console.log(`[${m.type()}] ${testo}`);
});
pagina.on('pageerror', (e) => console.log(`[pageerror] ${e.stack || e}`));

await pagina.goto(url, { waitUntil: 'load' });
// Abbondante apposta: se un motore grafico non risponde, la ricaduta sull'altro
// arriva dopo qualche secondo. Aspettando meno si fotografa il gioco mentre sta
// ancora decidendo, e si scambia un'attesa per un guasto.
await pagina.waitForTimeout(9000);

const stato = await pagina.evaluate(() => ({
  motore: window.motoreGrafico,
  webgpu: 'gpu' in navigator,
  mondo: Boolean(window.mondo),
}));
console.log('stato:', JSON.stringify(stato));

await browser.close();
spegni();
process.exit(0);

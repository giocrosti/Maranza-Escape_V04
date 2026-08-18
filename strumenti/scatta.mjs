// Screenshot del gioco con Playwright, per guardarlo davvero invece di
// immaginarselo.
//
// Avvia il server di sviluppo, apre una finestra delle dimensioni di un
// iPhone 15 Pro, mette il mondo in pose fissate e scatta.
//
// Le pose sono fissate apposta: la citta' e' generata con un seme costante,
// quindi allo stesso `scorrimento` i palazzi sono sempre gli stessi. Cosi' due
// serie di scatti (prima / dopo una modifica) si possono mettere una accanto
// all'altra e la differenza e' solo quella che si e' toccato.
//
//   node strumenti/scatta.mjs --etichetta prima
//   node strumenti/scatta.mjs --etichetta dopo --scene viale,duomo
//   node strumenti/scatta.mjs --url http://localhost:5173   (server gia' acceso)

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CARTELLA = join(RADICE, 'schermate');

/** iPhone 15 Pro: punti logici, non pixel. Il fattore di scala vero e' 3, ma
 *  per gli scatti di confronto 2 basta e i file pesano meno della meta'. */
const IPHONE = { larghezza: 393, altezza: 852, scala: 2 };

/** Le pose. `scorrimento` sceglie il pezzo di citta' che si vede. */
const SCENE = {
  home: { stato: 'attesa', scorrimento: 8 },
  viale: { stato: 'in-gioco', scorrimento: 44, distanza: 44, velocita: 16 },
  duomo: { stato: 'in-gioco', scorrimento: 232, distanza: 232, velocita: 20 },
  bosco: { stato: 'in-gioco', scorrimento: 584, distanza: 584, velocita: 24 },
  salto: { stato: 'in-gioco', scorrimento: 108, distanza: 108, velocita: 18, salto: true },

  /* Queste due non congelano una posa: la impostano e poi **lasciano correre**
     il gioco per un momento. Servono a fotografare le cose che non esistono in
     un istante isolato — la polvere ha bisogno di qualche passo per alzarsi, la
     tensione ha bisogno che gli inseguitori si avvicinino davvero. */
  polvere: { stato: 'in-gioco', scorrimento: 300, distanza: 300, velocita: 26, attesa: 1400 },
  /* Gli ostacoli rari non si aspettano: si mettono dove servono. Aspettare che
     il generatore tiri fuori un terzetto di tram vorrebbe dire scattare a caso. */
  tram: { stato: 'in-gioco', scorrimento: 160, distanza: 160, velocita: 18,
    ostacoli: [{ tipo: 'tram', avanti: 26, corsia: 1 }] },
  tramTre: { stato: 'in-gioco', scorrimento: 160, distanza: 160, velocita: 18,
    ostacoli: [
      { tipo: 'tram', avanti: 16, corsia: 0 },
      { tipo: 'tram', avanti: 37, corsia: 2 },
      { tipo: 'tram', avanti: 58, corsia: 1 },
    ] },
  binari: { stato: 'in-gioco', scorrimento: 160, distanza: 160, velocita: 18,
    ostacoli: [{ tipo: 'tram', avanti: 46, corsia: 0 }] },
  arco: { stato: 'in-gioco', scorrimento: 210, distanza: 210, velocita: 18,
    ostacoli: [{ tipo: 'arco', avanti: 2.5 }] },
  monopattini: { stato: 'in-gioco', scorrimento: 90, distanza: 90, velocita: 18,
    ostacoli: [
      { tipo: 'monopattino', avanti: 11, corsia: 0 },
      { tipo: 'monopattino', avanti: 24, corsia: 2 },
    ] },
  /* La Velasca sta a z=470 ed e' profonda 22: qui la si e' appena superata, ed
     e' il punto in cui prima spariva di colpo. */
  velasca: { stato: 'in-gioco', scorrimento: 486, distanza: 486, velocita: 18 },
  minaccia: {
    stato: 'in-gioco',
    scorrimento: 430,
    distanza: 430,
    velocita: 22,
    distacco: 0.9,
    attesa: 900,
  },
};

function argomenti() {
  const args = process.argv.slice(2);
  const leggi = (nome, difetto) => {
    const i = args.indexOf(`--${nome}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : difetto;
  };
  return {
    etichetta: leggi('etichetta', 'scatto'),
    url: leggi('url', null),
    porta: Number(leggi('porta', 5180)),
    scene: leggi('scene', Object.keys(SCENE).join(',')).split(','),
    scala: Number(leggi('scala', IPHONE.scala)),
    // interruttori della grafica: vedi src/grafica/opzioni.js
    query: leggi('query', ''),
  };
}

/** Accende `vite` e aspetta che risponda. Ritorna come spegnerlo. */
async function accendiServer(porta) {
  const processo = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', '--port', String(porta), '--strictPort', '--host', '127.0.0.1'],
    { cwd: RADICE, stdio: 'pipe', shell: process.platform === 'win32' },
  );
  processo.stdout.on('data', () => {});
  processo.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));

  // Su Windows `npx` e' uno script: ucciderlo lascia in piedi il node di vite,
  // e lo script non esce mai. Si ammazza l'albero.
  const spegni = () => {
    if (process.platform === 'win32') {
      try {
        spawn('taskkill', ['/pid', String(processo.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch {
        processo.kill();
      }
    } else {
      processo.kill();
    }
  };

  const url = `http://127.0.0.1:${porta}/`;
  for (let tentativo = 0; tentativo < 100; tentativo += 1) {
    try {
      const risposta = await fetch(url);
      if (risposta.ok) return { url, spegni };
    } catch {
      /* non e' ancora su */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  spegni();
  throw new Error(`il server non ha risposto su ${url}`);
}

async function principale() {
  const opzioni = argomenti();
  if (!existsSync(CARTELLA)) mkdirSync(CARTELLA, { recursive: true });

  const server = opzioni.url ? { url: opzioni.url, spegni: () => {} } : await accendiServer(opzioni.porta);

  // Le tre bandierine servono a far uscire WebGPU anche senza finestra vera:
  // senza, Chromium headless ricade su WebGL2 e non si vedrebbe mai il
  // percorso che poi Safari prende davvero.
  const browser = await chromium.launch({
    args: [
      '--enable-unsafe-webgpu',
      '--enable-features=Vulkan,WebGPUExperimentalFeatures',
      '--use-angle=default',
      '--ignore-gpu-blocklist',
      '--enable-gpu',
    ],
  });

  const contesto = await browser.newContext({
    viewport: { width: IPHONE.larghezza, height: IPHONE.altezza },
    deviceScaleFactor: opzioni.scala,
    isMobile: true,
    hasTouch: true,
  });
  const pagina = await contesto.newPage();

  const errori = [];
  pagina.on('console', (m) => {
    if (m.type() === 'error') errori.push(m.text());
  });
  pagina.on('pageerror', (e) => errori.push(String(e)));

  const indirizzo = opzioni.query ? `${server.url}?${opzioni.query}` : server.url;
  await pagina.goto(indirizzo, { waitUntil: 'load' });
  await pagina.waitForFunction(() => Boolean(window.mondo), null, { timeout: 15000 });
  // qualche fotogramma per far salire texture e shader
  await pagina.waitForTimeout(900);

  const motore = await pagina.evaluate(() => window.motoreGrafico || 'canvas2d');

  for (const nome of opzioni.scene) {
    const posa = SCENE[nome];
    if (!posa) {
      console.warn(`scena sconosciuta: ${nome}`);
      continue;
    }
    await pagina.evaluate(async (p) => {
      const m = window.mondo;
      m.stato = p.stato;
      m.scorrimento = p.scorrimento;
      if (p.distanza !== undefined) m.distanza = p.distanza;
      if (p.velocita !== undefined) m.velocita = p.velocita;
      m.corridore.posizione = 1;
      m.corridore.bersaglio = 1;
      m.corridore.fase = 2.4; // passo sempre alla stessa altezza, fra due scatti
      if (p.salto) {
        m.corridore.y = 1.15;
        m.corridore.vy = 1.2;
        m.corridore.inAria = true;
      }
      if (p.distacco !== undefined) m.inseguitori.distacco = p.distacco;
      if (p.ostacoli) {
        // Si sgombera prima: le pose si scattano di fila sulla stessa pagina, e
        // senza questo gli ostacoli della posa precedente restano in scena.
        m.percorso.ostacoli = [];
        for (const voce of p.ostacoli) {
          const z = m.distanza + voce.avanti;
          if (voce.tipo === 'arco') {
            m.percorso.ostacoli.push({
              tipo: 'arco', z, profondita: 4,
              corsie: [0, 2], corsiaInizio: 0, quanteCorsie: 2, colpito: false,
            });
            continue;
          }
          m.percorso.ostacoli.push({
            tipo: voce.tipo,
            z,
            profondita: voce.tipo === 'tram' ? 19 : 1.4,
            corsiaInizio: voce.corsia,
            quanteCorsie: 1,
            colpito: false,
            velocitaVerso: 0, // fermi: uno scatto deve essere ripetibile
            binariCentro: z,
            sbandata: 0.3,
          });
        }
      }
      // due fotogrammi: uno per far girare il mondo, uno per disegnarlo
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, posa);
    await pagina.waitForTimeout(posa.attesa ?? 120);

    const file = join(CARTELLA, `${opzioni.etichetta}-${nome}.png`);
    await pagina.screenshot({ path: file });
    console.log(`scattata ${file}`);
  }

  if (errori.length) {
    console.error('\nerrori in pagina:');
    for (const e of errori.slice(0, 10)) console.error('  ' + e);
  }
  console.log(`motore grafico: ${motore}`);

  await browser.close();
  server.spegni();
  // taskkill e' asincrono e il processo di vite puo' tenere aperto l'event loop
  process.exit(errori.length ? 2 : 0);
}

principale().catch((e) => {
  console.error(e);
  process.exit(1);
});

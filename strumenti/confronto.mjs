// Mette due o piu' scatti uno accanto all'altro in un'immagine sola.
//
// Guardare due file a turno non e' un confronto: la memoria visiva dura poco, e
// una differenza di un quinto di contrasto sparisce nel tempo di aprire l'altra
// finestra. Affiancati, la stessa differenza salta all'occhio.
//
// Il foglio si compone in HTML e si fotografa con Playwright: e' l'unico modo di
// comporre immagini senza tirarsi in casa una libreria di grafica solo per
// questo.
//
//   node strumenti/confronto.mjs --nome profondita \
//        --immagini 1-nudo-duomo.png:prima,2-strati-duomo.png:dopo

import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CARTELLA = join(RADICE, 'schermate');

const args = process.argv.slice(2);
const leggi = (nome, difetto) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : difetto;
};

const nome = leggi('nome', 'confronto');
const titolo = leggi('titolo', nome);
const elenco = leggi('immagini', '')
  .split(',')
  .filter(Boolean)
  .map((voce) => {
    const [file, etichetta] = voce.split(':');
    return { file, etichetta: etichetta || file };
  });

if (elenco.length < 2) {
  console.error('servono almeno due immagini: --immagini a.png:prima,b.png:dopo');
  process.exit(1);
}

function inLinea(file) {
  const percorso = join(CARTELLA, file);
  if (!existsSync(percorso)) throw new Error(`non trovo ${percorso}`);
  const tipo = extname(file) === '.jpg' ? 'jpeg' : 'png';
  return `data:image/${tipo};base64,${readFileSync(percorso).toString('base64')}`;
}

/* Il ritaglio serve piu' di quanto sembri: certe differenze — il volume di una
   figura, un riflesso su un bordo — a un terzo di scala non si vedono, e un
   confronto in cui non si vede la differenza dice il falso. `--ritaglio` prende
   x,y,larghezza,altezza in frazioni dell'immagine. */
const ritaglio = leggi('ritaglio', null);
const finestra = ritaglio ? ritaglio.split(',').map(Number) : null;

function riquadro(voce, i) {
  const immagine = inLinea(voce.file);
  const dentro = finestra
    ? `<div class="ritaglio" style="
         background-image:url('${immagine}');
         background-size:${100 / finestra[2]}% auto;
         background-position:${(finestra[0] / (1 - finestra[2])) * 100}% ${
           (finestra[1] / (1 - finestra[3])) * 100
         }%;
         aspect-ratio:${finestra[2]} / ${finestra[3] * (852 / 393)};
       "></div>`
    : `<img src="${immagine}" alt="${voce.etichetta}">`;

  return `
      <figure>
        ${dentro}
        <figcaption><span class="n">${i + 1}</span>${voce.etichetta}</figcaption>
      </figure>`;
}

const riquadri = elenco.map(riquadro).join('');

const html = `<!doctype html><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #12151a;
    color: #e9ecef;
    font: 15px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
    padding: 22px;
    width: max-content;
  }
  h1 { font-size: 17px; font-weight: 650; margin-bottom: 16px; letter-spacing: .2px; }
  .fila { display: flex; gap: 16px; align-items: flex-start; }
  figure { width: 300px; }
  img, .ritaglio { width: 100%; display: block; border-radius: 10px; border: 1px solid #2b313a; }
  .ritaglio { background-repeat: no-repeat; image-rendering: auto; }
  figcaption {
    margin-top: 9px; font-size: 13px; color: #aeb6c0;
    display: flex; align-items: center; gap: 7px;
  }
  .n {
    background: #2b313a; color: #e9ecef; border-radius: 5px;
    padding: 1px 6px; font-size: 11px; font-weight: 700;
  }
</style>
<h1>${titolo}</h1>
<div class="fila">${riquadri}</div>`;

const browser = await chromium.launch();
const pagina = await browser.newPage({ deviceScaleFactor: 1 });
await pagina.setContent(html, { waitUntil: 'load' });
const corpo = await pagina.locator('body').boundingBox();
await pagina.setViewportSize({
  width: Math.ceil(corpo.width),
  height: Math.ceil(corpo.height),
});

const uscita = join(CARTELLA, `confronto-${nome}.png`);
await pagina.screenshot({ path: uscita, fullPage: true });
console.log(`composto ${uscita}`);

await browser.close();
process.exit(0);

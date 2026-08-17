import { testAsync, assert, assertUguale } from './mini-test.js';

/* Tutti i percorsi qui dentro si risolvono rispetto alla pagina, mai rispetto
   alla radice del dominio: su GitHub Pages il sito sta in una sottocartella
   (/maranza-escape/), e un percorso assoluto come /src/main.js finirebbe fuori
   dal sito. E' lo stesso motivo per cui il manifest usa start_url relativo. */
const BASE = new URL('./', new URL('.', location.href)); // la cartella di tests.html

function indirizzo(relativo) {
  return new URL(relativo, BASE).href;
}

async function scarica(relativo) {
  const risposta = await fetch(indirizzo(relativo), { cache: 'no-store' });
  if (!risposta.ok) throw new Error(`${relativo} non si scarica (${risposta.status})`);
  return risposta;
}

/** Segue gli import a partire da un modulo e restituisce gli indirizzi di tutti
 *  i file raggiunti. Serve a sapere di quali file ha davvero bisogno il gioco,
 *  senza fidarsi di un elenco scritto a mano. */
async function moduliRaggiungibili(partenza) {
  const visti = new Set();
  const daVedere = [indirizzo(partenza)];

  while (daVedere.length > 0) {
    const url = daVedere.pop();
    if (visti.has(url)) continue;
    visti.add(url);

    const risposta = await fetch(url, { cache: 'no-store' });
    if (!risposta.ok) throw new Error(`${url} non si scarica (${risposta.status})`);
    const sorgente = await risposta.text();

    // Il server di sviluppo riscrive gli import: `./mondo.js` diventa
    // `/src/mondo.js`. Vanno seguiti tutti e due i modi, o il test crede di
    // avere finito dopo il primo file e non guarda piu' niente.
    (sorgente.match(/from\s+["'](\.{1,2}\/[^"']+|\/src\/[^"']+)["']/g) || []).forEach((riga) => {
      const percorso = riga.match(/["'](\.{1,2}\/[^"']+|\/src\/[^"']+)["']/)[1];
      daVedere.push(new URL(percorso, url).href);
    });
  }
  return visti;
}

/* L'elenco dei file da tenere in cache non e' piu' scritto a mano.
   Prima c'era in `sw.js` un array `FILE` con dentro ogni modulo, e due test che
   controllavano che non si scollasse da quello che il gioco carica davvero:
   erano test giusti, perche' un elenco a mano si scolla sempre.
   Adesso il service worker lo genera `vite-plugin-pwa` a partire dal contenuto
   della cartella costruita, quindi l'elenco non puo' piu' essere incompleto per
   distrazione — e il modo di rompere l'offline e' un altro: non pubblicare la
   build. Restano i test sul manifest e sulla pagina, che a mano ci sono ancora. */

testAsync('il gioco carica solo moduli che esistono', async () => {
  const necessari = await moduliRaggiungibili('src/main.js');
  assert(
    necessari.size > 5,
    `trovati solo ${necessari.size} moduli: il test non sta guardando niente`,
  );
});

testAsync('il manifest e quello di un app installabile a schermo intero', async () => {
  const manifest = await (await scarica('manifest.json')).json();

  // `fullscreen` con `standalone` come ripiego: dove il primo non e' supportato
  // (iOS lo tratta gia' cosi', Android no) si scende al secondo invece di
  // ricadere sulla barra del browser, che e' il vero fallimento.
  assert(
    ['fullscreen', 'standalone'].includes(manifest.display),
    `display "${manifest.display}": cosi' resta la barra del browser`,
  );
  if (manifest.display === 'fullscreen') {
    assert(
      (manifest.display_override || []).includes('standalone'),
      'con fullscreen serve standalone in display_override come ripiego',
    );
  }
  assert(manifest.name && manifest.short_name, 'servono nome e nome breve');
  assert(manifest.short_name.length <= 12, 'il nome breve deve stare sotto l icona');
  // percorsi relativi: su GitHub Pages il sito non sta nella radice del dominio
  assert(manifest.start_url.startsWith('.'), 'start_url deve essere relativo');
  assert(manifest.scope.startsWith('.'), 'scope deve essere relativo');
  assert(/^#[0-9a-f]{6}$/i.test(manifest.background_color), 'manca il colore di sfondo');
});

testAsync('il manifest dichiara un icona da 512 e una mascherabile', async () => {
  const manifest = await (await scarica('manifest.json')).json();
  const misure = manifest.icons.map((i) => i.sizes);
  assert(misure.includes('512x512'), 'manca l icona 512x512');
  assert(
    manifest.icons.some((i) => (i.purpose || '').includes('maskable')),
    'senza icona mascherabile Android la ritaglia male',
  );
  assert(
    manifest.icons.every((i) => !i.src.startsWith('/')),
    'i percorsi delle icone devono essere relativi, come start_url',
  );
});

testAsync('le icone dichiarate esistono e hanno la misura giusta', async () => {
  const manifest = await (await scarica('manifest.json')).json();

  for (const icona of manifest.icons) {
    const risposta = await fetch(indirizzo(icona.src), { cache: 'no-store' });
    assert(risposta.ok, `${icona.src} non si scarica (${risposta.status})`);
    const immagine = await createImageBitmap(await risposta.blob());
    assertUguale(`${immagine.width}x${immagine.height}`, icona.sizes, `misura di ${icona.src}`);
  }
});

testAsync('le schermate d avvio hanno la misura esatta che iOS pretende', async () => {
  /* Una schermata d'avvio della misura sbagliata non da' nessun errore: iOS la
     ignora in silenzio e mostra una pagina bianca all'apertura. E' il tipo di
     difetto che non si scopre mai guardando il codice, perche' il codice e'
     giusto — e' l'immagine a essere larga un pixel di meno. */
  const html = await (await scarica('index.html')).text();
  const collegamenti = html.match(/<link rel="apple-touch-startup-image"[^>]*>/g) || [];
  assert(collegamenti.length >= 8, `trovate solo ${collegamenti.length} schermate d avvio`);

  const sbagliate = [];
  for (const collegamento of collegamenti) {
    const percorso = collegamento.match(/href="([^"]+)"/)[1];
    const attese = percorso.match(/avvio-(\d+)x(\d+)\.png/);
    assert(attese, `nome senza misura: ${percorso}`);

    const risposta = await fetch(indirizzo(percorso.replace('./', '')), { cache: 'no-store' });
    if (!risposta.ok) {
      sbagliate.push(`${percorso} non si scarica`);
      continue;
    }
    const immagine = await createImageBitmap(await risposta.blob());
    const vera = `${immagine.width}x${immagine.height}`;
    const attesa = `${attese[1]}x${attese[2]}`;
    if (vera !== attesa) sbagliate.push(`${percorso}: e ${vera}, dovrebbe essere ${attesa}`);
  }
  assertUguale(sbagliate.join(', '), '', 'schermate d avvio della misura sbagliata');
});

testAsync('ogni schermata d avvio ha la coppia ritratto e paesaggio', async () => {
  // Il gioco chiede l'orientamento orizzontale, ma iOS non lo impone: se manca
  // la schermata per l'orientamento in cui il telefono si trova al momento
  // dell'avvio, resta bianco. Servono tutte e due, sempre.
  const html = await (await scarica('index.html')).text();
  const collegamenti = html.match(/<link rel="apple-touch-startup-image"[^>]*>/g) || [];

  const versi = { portrait: 0, landscape: 0 };
  for (const collegamento of collegamenti) {
    if (collegamento.includes('orientation: portrait')) versi.portrait += 1;
    if (collegamento.includes('orientation: landscape')) versi.landscape += 1;
  }
  assertUguale(versi.portrait, versi.landscape, 'ritratti e paesaggi non sono in pari');
  assert(versi.landscape > 0, 'nessuna schermata d avvio orizzontale');
});

testAsync('la pagina dichiara cio che serve a iOS per l app sulla Home', async () => {
  const html = await (await scarica('index.html')).text();

  assert(html.includes('rel="manifest"'), 'manca il collegamento al manifest');
  assert(html.includes('apple-touch-icon'), 'senza, iOS mette una miniatura della pagina');
  assert(html.includes('apple-mobile-web-app-capable'), 'senza, iOS apre dentro Safari');
  assert(html.includes('viewport-fit=cover'), 'senza, restano bande vuote attorno alla tacca');
  assert(html.includes('apple-mobile-web-app-title'), 'manca il nome sotto l icona');
  assert(html.includes('touch-action: none'), 'senza, scorrere per saltare trascina la pagina');
});

/* Il controllo sui percorsi assoluti non sta qui.
   Il server di sviluppo riscrive `./manifest.json` in `/manifest.json` e ci
   infila dentro `/@vite/client`: guardando la pagina servita si vedrebbero
   sempre percorsi assoluti, e il test direbbe sempre di no. Quello che conta e'
   il sorgente e la cartella costruita, che sono file su disco: li controlla
   `strumenti/prova.mjs` prima di aprire il browser. */

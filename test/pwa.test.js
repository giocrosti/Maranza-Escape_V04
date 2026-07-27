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

    (sorgente.match(/from\s+'(\.[^']+)'/g) || []).forEach((riga) => {
      const relativo = riga.match(/'(\.[^']+)'/)[1];
      daVedere.push(new URL(relativo, url).href);
    });
  }
  return visti;
}

/** L'elenco dei file dentro sw.js, gia' trasformato in indirizzi assoluti. */
async function elencoDelServiceWorker() {
  const testo = await (await scarica('sw.js')).text();
  const blocco = testo.match(/const FILE = \[([\s\S]*?)\];/);
  if (!blocco) throw new Error('non trovo l elenco FILE dentro sw.js');
  return (blocco[1].match(/'([^']+)'/g) || []).map((s) => indirizzo(s.slice(1, -1)));
}

testAsync('il service worker mette in cache tutti i moduli che il gioco carica', async () => {
  const necessari = await moduliRaggiungibili('src/main.js');
  const inCache = await elencoDelServiceWorker();

  assert(necessari.size > 5, `trovati solo ${necessari.size} moduli: il test non sta guardando niente`);
  const dimenticati = [...necessari]
    .filter((m) => !inCache.includes(m))
    .map((m) => new URL(m).pathname);
  assertUguale(
    dimenticati.join(', '),
    '',
    'moduli caricati dal gioco ma assenti da sw.js: senza, il gioco non parte offline',
  );
});

testAsync('tutti i file elencati nel service worker esistono davvero', async () => {
  const elenco = await elencoDelServiceWorker();
  const esiti = await Promise.all(
    elenco.map(async (url) => {
      const risposta = await fetch(url, { cache: 'no-store' });
      return risposta.ok ? null : `${new URL(url).pathname} (${risposta.status})`;
    }),
  );
  assertUguale(esiti.filter(Boolean).join(', '), '', 'percorsi morti in sw.js');
});

testAsync('il manifest e quello di un app installabile a schermo intero', async () => {
  const manifest = await (await scarica('manifest.json')).json();

  assertUguale(manifest.display, 'standalone', 'senza standalone resta la barra del browser');
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

testAsync('la pagina dichiara cio che serve a iOS per l app sulla Home', async () => {
  const html = await (await scarica('index.html')).text();

  assert(html.includes('rel="manifest"'), 'manca il collegamento al manifest');
  assert(html.includes('apple-touch-icon'), 'senza, iOS mette una miniatura della pagina');
  assert(html.includes('apple-mobile-web-app-capable'), 'senza, iOS apre dentro Safari');
  assert(html.includes('viewport-fit=cover'), 'senza, restano bande vuote attorno alla tacca');
  assert(html.includes('apple-mobile-web-app-title'), 'manca il nome sotto l icona');
  assert(html.includes('touch-action: none'), 'senza, scorrere per saltare trascina la pagina');
});

testAsync('nessun percorso assoluto: il gioco deve funzionare in una sottocartella', async () => {
  const html = await (await scarica('index.html')).text();
  const assolutiNellHtml = html.match(/(?:src|href)="\/[^/][^"]*"/g) || [];
  assertUguale(assolutiNellHtml.join(', '), '', 'percorsi assoluti in index.html');

  const sw = await (await scarica('sw.js')).text();
  const elenco = (sw.match(/const FILE = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g) || []).map((s) =>
    s.slice(1, -1),
  );
  assertUguale(
    elenco.filter((f) => f.startsWith('/')).join(', '),
    '',
    'percorsi assoluti nell elenco di sw.js',
  );
});

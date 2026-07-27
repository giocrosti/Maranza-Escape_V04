/* Service worker: e' cio' che fa funzionare il gioco senza rete.
 *
 * Strategia: si risponde subito da quel che e' in cache e intanto si riscarica
 * in sottofondo, cosi' l'avvio e' istantaneo e la versione nuova arriva al
 * lancio successivo.
 *
 * `VERSIONE` va cambiata a ogni pubblicazione: e' cio' che manda in pensione la
 * cache precedente. Senza, chi ha gia' aperto il gioco continuerebbe a vedere
 * la versione vecchia.
 */

const VERSIONE = 'maranza-escape-v6';

const FILE = [
  './',
  './index.html',
  './manifest.json',
  './icone/icona-180.png',
  './icone/icona-192.png',
  './icone/icona-512.png',
  './src/main.js',
  './src/mondo.js',
  './src/render.js',
  './src/input.js',
  './src/record.js',
  './src/costanti.js',
  './src/proiezione.js',
  './src/corridore.js',
  './src/ostacoli.js',
  './src/percorso.js',
  './src/inseguitori.js',
  './src/citta.js',
  './src/pausa.js',
  './src/pennello.js',
  './src/figure.js',
  './src/monumenti.js',
  './src/rng.js',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(VERSIONE)
      // se un singolo file non si scarica non si butta via tutto il resto
      .then((cache) => Promise.allSettled(FILE.map((f) => cache.add(f))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chiavi) => Promise.all(chiavi.filter((k) => k !== VERSIONE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function indirizziDelGioco() {
  return FILE.map((f) => new URL(f, self.registration.scope).href);
}

async function scaricaEConserva(richiesta) {
  const risposta = await fetch(richiesta);
  if (risposta && risposta.ok) {
    const cache = await caches.open(VERSIONE);
    await cache.put(richiesta, risposta.clone());
  }
  return risposta;
}

self.addEventListener('fetch', (evento) => {
  const richiesta = evento.request;
  if (richiesta.method !== 'GET') return;
  if (new URL(richiesta.url).origin !== self.location.origin) return;

  const eDelGioco = indirizziDelGioco().includes(new URL(richiesta.url).href);

  if (!eDelGioco) {
    evento.respondWith(scaricaEConserva(richiesta).catch(() => caches.match(richiesta)));
    return;
  }

  evento.respondWith(
    caches.match(richiesta).then((inCache) => {
      const dallaRete = scaricaEConserva(richiesta).catch(() => inCache);
      // senza waitUntil il browser puo' spegnere il service worker appena ha
      // risposto, uccidendo il riscaricamento: la cache non si aggiornerebbe mai
      if (inCache) evento.waitUntil(dallaRete.catch(() => {}));
      return inCache || dallaRete;
    }),
  );
});

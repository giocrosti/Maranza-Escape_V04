// La tavolozza del gioco, e la LUT che ce la porta.
//
// L'idea: la scena e' dipinta con decine di colori diversi — ocra dei palazzi,
// verde dei platani, arancione del tram, rosso di un'insegna — e va bene cosi',
// perche' e' quello che rende riconoscibile un viale. Ma **l'immagine finale**
// deve leggersi con pochi colori dominanti, o non ha carattere.
//
// Invece di ridipingere tutto si rimappa alla fine, con una tabella di
// conversione (una LUT 16x16x16 stesa in una striscia 256x16). Applicata dopo la
// composizione tocca tutti i layer allo stesso modo: e' per questo che la
// palette resta coerente fra fondali e primo piano, cosa che ridipingendo a mano
// non succede mai.
//
// **Come si limita una palette senza spegnere l'immagine.** Il modo ovvio —
// mescolare ogni colore con una rampa di quattro tinte scelte per luminosita' —
// e' quello sbagliato, ed e' stato il primo tentativo: due colori diversi ma
// ugualmente chiari finiscono sullo stesso punto della rampa, e quindi si
// avvicinano fra loro. Il contrasto locale cala, e l'immagine si legge come
// sfocata anche se e' perfettamente a fuoco.
//
// Quello giusto e' lavorare sulla **tinta** e non toccare la luminosita': si
// sceglie un pugno di tinte d'ancoraggio, e ogni colore ruota verso la piu'
// vicina. Un ocra e un verde restano lontani come prima — cambia dove stanno,
// non quanto sono distanti — ma tutta la scena finisce per parlare con tre
// colori invece che con trenta. La struttura di chiaro e scuro resta intatta:
// e' quella che regge la leggibilita' del gioco.

/** I quattro colori dominanti, dal buio alla luce. Servono alle tinte piatte
 *  (la vignetta, i riverberi) e a dire com'e' la scena a parole. */
export const TAVOLOZZA = {
  ombra: [0.106, 0.145, 0.212], //  #1b2536  ardesia
  freddo: [0.365, 0.482, 0.565], //  #5d7b90  azzurro polvere
  caldo: [0.788, 0.639, 0.443], //  #c9a371  ocra
  luce: [0.957, 0.933, 0.878], //  #f4eee0  crema
};

/** Le tinte verso cui ruota tutto, in gradi, con la saturazione a cui tendono.
 *  Tre e non quattro: il quarto colore dominante e' la crema, che non e' una
 *  tinta ma un'assenza di tinta, e ci si arriva da sola togliendo saturazione
 *  alle alte luci. */
export const ANCORE = [
  { tinta: 210, saturazione: 0.3 }, // il blu-ardesia di asfalto, ombre e cielo
  { tinta: 34, saturazione: 0.42 }, // l'ocra delle facciate e della luce calda
  { tinta: 96, saturazione: 0.26 }, // il verde spento dei platani
];

/** Quanto ruota la tinta verso l'ancora piu' vicina. A 1 non resta nessuna
 *  sfumatura fra un palazzo e l'altro; a 0,55 la via ha ancora le sue variazioni
 *  ma il colpo d'occhio e' di tre colori. */
export const FORZA_PALETTE = 0.55;

const PESI_LUMINANZA = [0.2126, 0.7152, 0.0722];

function luminanza(c) {
  return c[0] * PESI_LUMINANZA[0] + c[1] * PESI_LUMINANZA[1] + c[2] * PESI_LUMINANZA[2];
}

function mescola(a, b, q) {
  return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q];
}

// --- conversioni ------------------------------------------------------------

function versoHsl([r, g, b]) {
  const massimo = Math.max(r, g, b);
  const minimo = Math.min(r, g, b);
  const chiarezza = (massimo + minimo) / 2;
  const delta = massimo - minimo;

  if (delta < 1e-6) return { tinta: 0, saturazione: 0, chiarezza };

  const saturazione = delta / (1 - Math.abs(2 * chiarezza - 1));
  let tinta;
  if (massimo === r) tinta = 60 * (((g - b) / delta) % 6);
  else if (massimo === g) tinta = 60 * ((b - r) / delta + 2);
  else tinta = 60 * ((r - g) / delta + 4);

  return { tinta: (tinta + 360) % 360, saturazione, chiarezza };
}

function daHsl({ tinta, saturazione, chiarezza }) {
  const c = (1 - Math.abs(2 * chiarezza - 1)) * saturazione;
  const x = c * (1 - Math.abs(((tinta / 60) % 2) - 1));
  const m = chiarezza - c / 2;

  let rgb;
  if (tinta < 60) rgb = [c, x, 0];
  else if (tinta < 120) rgb = [x, c, 0];
  else if (tinta < 180) rgb = [0, c, x];
  else if (tinta < 240) rgb = [0, x, c];
  else if (tinta < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return rgb.map((v) => Math.min(1, Math.max(0, v + m)));
}

/** La distanza fra due tinte sul cerchio: 350 e 10 distano 20, non 340. */
function distanzaTinta(a, b) {
  const grezza = Math.abs(a - b) % 360;
  return grezza > 180 ? 360 - grezza : grezza;
}

function ancoraPiuVicina(tinta) {
  let migliore = ANCORE[0];
  let minima = 361;
  for (const ancora of ANCORE) {
    const d = distanzaTinta(tinta, ancora.tinta);
    if (d < minima) {
      minima = d;
      migliore = ancora;
    }
  }
  return migliore;
}

/** Ruota `tinta` verso `bersaglio` prendendo la strada corta. */
function ruota(tinta, bersaglio, quanto) {
  let differenza = ((bersaglio - tinta + 540) % 360) - 180;
  return (tinta + differenza * quanto + 360) % 360;
}

/** Curva a S sul contrasto: apre i mezzitoni **senza spostare gli estremi**.
 *
 *  Il vincolo che conta e' che 0 resti 0 e 1 resti 1. La versione precedente —
 *  moltiplicare lo scarto dal grigio medio per un fattore — non lo rispettava:
 *  con contrasto 1,12 portava il nero a 0,14, e un nero che non e' nero mette
 *  una patina lattiginosa su tutta l'immagine. Non si vede come "il nero e'
 *  sbagliato", si vede come "sembra sfocato", ed e' per questo che ci e' voluto
 *  un test per trovarlo. */
function curvaS(v, forza) {
  const morbida = v * v * (3 - 2 * v); // smoothstep: passa per 0 e per 1
  const quanto = Math.min(1, Math.max(0, (forza - 1) * 2.5));
  return Math.min(1, Math.max(0, v + (morbida - v) * quanto));
}

function gradua(colore, { forza, contrasto, saturazione }) {
  const contrastato = colore.map((v) => curvaS(v, contrasto));
  const hsl = versoHsl(contrastato);

  // Un colore quasi grigio non ha una tinta da ruotare: ruotarla comunque
  // tingerebbe l'asfalto di blu elettrico. Sotto una soglia si lascia stare.
  const quanto = forza * Math.min(1, hsl.saturazione / 0.12);
  const ancora = ancoraPiuVicina(hsl.tinta);

  let c = daHsl({
    tinta: ruota(hsl.tinta, ancora.tinta, quanto),
    saturazione: Math.min(1, hsl.saturazione * saturazione * (1 - quanto) + ancora.saturazione * quanto),
    chiarezza: hsl.chiarezza,
  });

  // Separazione fredda nelle ombre, calda nelle luci: e' quel filo che fa
  // sembrare graduata un'immagine, e costa pochissimo contrasto.
  const l = luminanza(c);
  c = mescola(c, TAVOLOZZA.ombra, Math.max(0, 1 - l * 2.4) * 0.13);
  c = mescola(c, TAVOLOZZA.luce, Math.max(0, l * 2.4 - 1.5) * 0.1);

  return c.map((v) => Math.min(1, Math.max(0, v)));
}

/** Il lato del cubo di colore. 16 e' lo standard: 4096 voci in una striscia
 *  256x16, abbastanza fitte da non far vedere gradini. */
export const LATO_LUT = 16;

/**
 * Costruisce la striscia della LUT come canvas 256x16.
 * Il blu sceglie la fetta (sedici fette in fila lungo x), il rosso la colonna
 * dentro la fetta, il verde la riga.
 */
export function creaCanvasLut({
  forza = FORZA_PALETTE,
  contrasto = 1.12,
  saturazione = 1.05,
} = {}) {
  const lato = LATO_LUT;
  const canvas = document.createElement('canvas');
  canvas.width = lato * lato;
  canvas.height = lato;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  const immagine = ctx.createImageData(canvas.width, canvas.height);
  const dati = immagine.data;

  for (let b = 0; b < lato; b += 1) {
    for (let g = 0; g < lato; g += 1) {
      for (let r = 0; r < lato; r += 1) {
        const fuori = gradua([r / (lato - 1), g / (lato - 1), b / (lato - 1)], {
          forza,
          contrasto,
          saturazione,
        });
        const x = b * lato + r;
        const indice = (g * canvas.width + x) * 4;
        dati[indice + 0] = Math.round(fuori[0] * 255);
        dati[indice + 1] = Math.round(fuori[1] * 255);
        dati[indice + 2] = Math.round(fuori[2] * 255);
        dati[indice + 3] = 255;
      }
    }
  }

  ctx.putImageData(immagine, 0, 0);
  return canvas;
}

/** Un colore della tavolozza in formato Pixi (0xRRGGBB). */
export function tinta(nome) {
  const c = TAVOLOZZA[nome];
  return (Math.round(c[0] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[2] * 255);
}

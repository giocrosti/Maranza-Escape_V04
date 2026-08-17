// I fondali piatti: cielo, i due profili di citta' lontani, i due primi piani.
//
// Sono l'unica parte della scena che **non** si ridipinge a ogni fotogramma.
// Ognuno e' una striscia disegnata una volta sola, larga il doppio dello
// schermo e ripetibile: da li' in poi scorre e basta, e scorrere una texture
// non costa niente. E' quello che permette di avere sei layer di parallasse
// senza pagarli sei volte.
//
// "Ripetibile" vuol dire che il pezzo che esce da destra deve rientrare da
// sinistra senza giunta: ogni sagoma che sfora il bordo si ridisegna anche
// spostata di una larghezza. E' l'unica accortezza, ma se salta si vede subito,
// perche' passa sotto gli occhi ogni pochi secondi.
//
// La direzione dello scorrimento e' orizzontale anche se il gioco corre in
// avanti: e' la convenzione che il gioco ha da sempre — i palazzi lontani che
// scivolano di lato raccontano una strada che curva — e con i layer separati
// diventa finalmente una scala di velocita' invece di due valori a caso.

import { creaRng } from '../rng.js';

function tela(larghezza, altezza) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.ceil(larghezza));
  canvas.height = Math.max(2, Math.ceil(altezza));
  return canvas;
}

/**
 * Cuoce l'aria dentro la texture, una volta sola.
 *
 * Un fondale piatto sta tutto alla stessa distanza, quindi la sua dose di
 * foschia, desaturazione e sfocatura **non cambia mai**. Farla con un filtro a
 * ogni fotogramma vuol dire ridisegnare uno schermo intero sessanta volte al
 * secondo per ottenere sempre lo stesso risultato: e' la definizione di lavoro
 * sprecato, e su cinque fondali erano cinque passate a schermo intero.
 *
 * Qui si fa una volta, quando la striscia nasce. Restano filtri solo i due
 * primi piani, la cui sfocatura si allunga con la velocita' e quindi cambia
 * davvero.
 *
 * @param aria [r, g, b, forza] con le componenti da 0 a 1
 */
export function cuociAria(canvas, { aria = null, desaturazione = 0, contrasto = 1, luminosita = 0, sfocatura = 0, opacita = 1 } = {}) {
  const ctx = canvas.getContext('2d');

  if (desaturazione || contrasto !== 1 || luminosita || aria) {
    const immagine = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = immagine.data;
    const [ar, ag, ab, af] = aria || [0, 0, 0, 0];

    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue; // trasparente: non c'e' colore da toccare
      let r = d[i] / 255;
      let g = d[i + 1] / 255;
      let b = d[i + 2] / 255;

      const luce = r * 0.2126 + g * 0.7152 + b * 0.0722;
      r += (luce - r) * desaturazione;
      g += (luce - g) * desaturazione;
      b += (luce - b) * desaturazione;

      r = (r - 0.5) * contrasto + 0.5 + luminosita;
      g = (g - 0.5) * contrasto + 0.5 + luminosita;
      b = (b - 0.5) * contrasto + 0.5 + luminosita;

      if (af) {
        r += (ar - r) * af;
        g += (ag - g) * af;
        b += (ab - b) * af;
      }

      d[i] = Math.max(0, Math.min(255, r * 255));
      d[i + 1] = Math.max(0, Math.min(255, g * 255));
      d[i + 2] = Math.max(0, Math.min(255, b * 255));
      if (opacita !== 1) d[i + 3] *= opacita;
    }
    ctx.putImageData(immagine, 0, 0);
  }

  if (sfocatura > 0) {
    // Ci si appoggia al filtro del canvas 2D, che e' accelerato dal browser.
    // Serve una copia: sfocare una tela dentro se stessa la impasta, perche'
    // ogni riga letta e' gia' quella scritta un attimo prima.
    const copia = tela(canvas.width, canvas.height);
    copia.getContext('2d').drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = `blur(${sfocatura}px)`;
    ctx.drawImage(copia, 0, 0);
    ctx.filter = 'none';
  }

  return canvas;
}

// --- cielo -----------------------------------------------------------------

/** Il cielo: un gradiente e nient'altro. Non scorre, non si ripete: e' il
 *  fondo su cui sta tutto il resto. */
export function texturaCielo(larghezza, altezza, orizzonte) {
  const canvas = tela(larghezza, altezza);
  const ctx = canvas.getContext('2d');

  const cielo = ctx.createLinearGradient(0, 0, 0, orizzonte + 10);
  cielo.addColorStop(0, '#5b86b4');
  cielo.addColorStop(0.55, '#8fb0cd');
  cielo.addColorStop(1, '#cdd9e0');
  ctx.fillStyle = cielo;
  ctx.fillRect(0, 0, canvas.width, orizzonte + 10);

  // sotto l'orizzonte il cielo non c'e' piu': lo copre la strada, ma la fascia
  // di foschia deve arrivare fino a li' o si vede il taglio
  ctx.fillStyle = '#cdd9e0';
  ctx.fillRect(0, orizzonte, canvas.width, canvas.height - orizzonte);

  return canvas;
}

// --- nuvole ----------------------------------------------------------------

/** Nuvole basse, chiare, ripetibili. Sono la cosa piu' lontana che si muove:
 *  se si muovono percettibilmente il cielo smette di sembrare un fondale. */
export function texturaNuvole(larghezza, altezza) {
  const canvas = tela(larghezza, altezza);
  const ctx = canvas.getContext('2d');
  const rng = creaRng(19);

  const disegna = (x, y, raggio, opacita) => {
    for (const scarto of [0, -canvas.width, canvas.width]) {
      const cx = x + scarto;
      if (cx < -raggio * 2 || cx > canvas.width + raggio * 2) continue;
      const alone = ctx.createRadialGradient(cx, y, 0, cx, y, raggio);
      alone.addColorStop(0, `rgba(255,255,255,${opacita})`);
      alone.addColorStop(0.6, `rgba(255,255,255,${opacita * 0.45})`);
      alone.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = alone;
      ctx.beginPath();
      ctx.ellipse(cx, y, raggio, raggio * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  for (let i = 0; i < 14; i += 1) {
    const x = rng() * canvas.width;
    const y = canvas.height * (0.12 + rng() * 0.55);
    const raggio = canvas.height * (0.18 + rng() * 0.3);
    const opacita = 0.24 + rng() * 0.3;
    // ogni nuvola e' tre bolle: una sola sembra una macchia
    disegna(x, y, raggio, opacita);
    disegna(x + raggio * 0.7, y - raggio * 0.14, raggio * 0.68, opacita * 0.9);
    disegna(x - raggio * 0.6, y + raggio * 0.06, raggio * 0.55, opacita * 0.8);
  }

  return canvas;
}

// --- profili di citta' ------------------------------------------------------

/** Le sagome che si riconoscono da lontano. Non sono i monumenti del gioco (che
 *  sono volumi veri, con una facciata): sono il profilo di Milano visto da un
 *  chilometro, dove di un grattacielo restano l'altezza e la punta. */
const SAGOME = ['torre', 'guglia', 'lastra', 'gradoni', 'cupola', 'blocco', 'gru'];

/**
 * Un profilo ripetibile, appoggiato al fondo della striscia.
 * @param densita   quanti edifici per larghezza di schermo
 * @param altezzaMax frazione dell'altezza della striscia
 */
export function texturaProfilo(
  larghezza,
  altezza,
  { colore = 'rgba(126,146,166,0.55)', seme = 3, densita = 11, altezzaMax = 0.86 } = {},
) {
  const canvas = tela(larghezza, altezza);
  const ctx = canvas.getContext('2d');
  const rng = creaRng(seme);
  const base = canvas.height;
  const passo = canvas.width / densita;

  ctx.fillStyle = colore;

  for (let i = 0; i < densita; i += 1) {
    const tipo = SAGOME[Math.floor(rng() * SAGOME.length)];
    const larghezzaEdificio = passo * (0.5 + rng() * 0.42);
    const alto = base * altezzaMax * (0.28 + rng() * 0.72);
    const x = i * passo + rng() * (passo - larghezzaEdificio);

    // due volte: una al suo posto, una spostata di una larghezza, cosi' chi
    // sfora il bordo destro rientra da sinistra senza giunta
    for (const scarto of [0, -canvas.width]) {
      disegnaSagoma(ctx, tipo, x + scarto, base, larghezzaEdificio, alto, rng);
    }
  }

  return canvas;
}

function disegnaSagoma(ctx, tipo, x, base, larghezza, alto, rng) {
  const cima = base - alto;

  if (tipo === 'guglia') {
    ctx.fillRect(x, cima, larghezza, alto);
    ctx.beginPath();
    ctx.moveTo(x + larghezza * 0.5, cima - alto * 0.42);
    ctx.lineTo(x + larghezza * 0.62, cima);
    ctx.lineTo(x + larghezza * 0.38, cima);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (tipo === 'gradoni') {
    ctx.fillRect(x, cima, larghezza, alto);
    ctx.fillRect(x + larghezza * 0.12, cima - alto * 0.14, larghezza * 0.76, alto * 0.14);
    ctx.fillRect(x + larghezza * 0.28, cima - alto * 0.24, larghezza * 0.44, alto * 0.1);
    return;
  }
  if (tipo === 'lastra') {
    ctx.fillRect(x, cima, larghezza * 0.94, alto);
    ctx.fillRect(x + larghezza * 0.42, cima - alto * 0.06, larghezza * 0.06, alto * 0.06);
    return;
  }
  if (tipo === 'cupola') {
    ctx.fillRect(x, cima, larghezza, alto);
    ctx.beginPath();
    ctx.ellipse(x + larghezza * 0.5, cima, larghezza * 0.42, alto * 0.2, 0, Math.PI, 0);
    ctx.fill();
    return;
  }
  if (tipo === 'gru') {
    // una gru edile: a Milano ce n'e' sempre una all'orizzonte
    const palo = Math.max(1.5, larghezza * 0.08);
    ctx.fillRect(x + larghezza * 0.4, cima, palo, alto);
    ctx.fillRect(x - larghezza * 0.1, cima, larghezza * 1.1, palo);
    return;
  }
  if (tipo === 'torre') {
    ctx.fillRect(x, cima, larghezza, alto);
    const antenna = Math.max(1, larghezza * 0.05);
    ctx.fillRect(x + larghezza * 0.48, cima - alto * (0.1 + rng() * 0.12), antenna, alto * 0.22);
    return;
  }
  ctx.fillRect(x, cima, larghezza, alto);
}

// --- primi piani ------------------------------------------------------------

/** Il primo piano vicino: fusti di platano e pali che passano ai lati.
 *  Restano lontani dal centro apposta — un primo piano che copre la corsia di
 *  mezzo non e' atmosfera, e' un ostacolo che non si puo' saltare. */
export function texturaPaliVicini(larghezza, altezza) {
  const canvas = tela(larghezza, altezza);
  const ctx = canvas.getContext('2d');
  const rng = creaRng(41);

  // Due soli su tutta la striscia, che e' larga due schermi: sullo schermo ne
  // passa uno ogni tanto, ed e' quello che deve succedere. Il primo tentativo ne
  // metteva sei "verso i bordi", ma un fondale che scorre non ha bordi: prima o
  // poi passano tutti davanti alla corsia di mezzo, e in sei erano graffi sulla
  // lente, non alberi vicini.
  const posti = [0.22, 0.71];
  for (const posto of posti) {
    const x = posto * canvas.width;
    const spessore = canvas.width * (0.01 + rng() * 0.01);
    const opacita = 0.16 + rng() * 0.06;

    for (const scarto of [0, -canvas.width]) {
      const cx = x + scarto;
      // il fusto si assottiglia salendo, come un fusto vero visto da sotto
      ctx.beginPath();
      ctx.moveTo(cx - spessore * 0.6, canvas.height * 1.1);
      ctx.lineTo(cx + spessore * 1.6, canvas.height * 1.1);
      ctx.lineTo(cx + spessore * 1.0, -canvas.height * 0.1);
      ctx.lineTo(cx - spessore * 0.2, -canvas.height * 0.1);
      ctx.closePath();

      const fusto = ctx.createLinearGradient(cx - spessore, 0, cx + spessore * 1.6, 0);
      fusto.addColorStop(0, `rgba(22,26,34,${opacita * 0.35})`);
      fusto.addColorStop(0.5, `rgba(30,36,46,${opacita})`);
      fusto.addColorStop(1, `rgba(18,22,28,${opacita * 0.35})`);
      ctx.fillStyle = fusto;
      ctx.fill();
    }
  }

  return canvas;
}

/** Il primo piano vicinissimo: rami e foglie che sfiorano l'obiettivo dall'alto.
 *  Non si devono riconoscere: e' una macchia scura fuori fuoco, e il suo lavoro
 *  e' chiudere la parte alta dell'inquadratura. */
export function texturaFogliame(larghezza, altezza) {
  const canvas = tela(larghezza, altezza);
  const ctx = canvas.getContext('2d');
  const rng = creaRng(77);

  const macchia = (x, y, raggio, opacita) => {
    for (const scarto of [0, -canvas.width, canvas.width]) {
      const cx = x + scarto;
      if (cx < -raggio * 2 || cx > canvas.width + raggio * 2) continue;
      // sfumata sui bordi: una macchia piena, per quanto scura, si legge come
      // una nuvola nera appoggiata sopra il cielo
      const sfumatura = ctx.createRadialGradient(cx, y, raggio * 0.2, cx, y, raggio);
      sfumatura.addColorStop(0, `rgba(18,26,22,${opacita})`);
      sfumatura.addColorStop(1, 'rgba(18,26,22,0)');
      ctx.fillStyle = sfumatura;
      ctx.beginPath();
      ctx.ellipse(cx, y, raggio, raggio * (0.5 + rng() * 0.3), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Tutto appeso al bordo alto e con poca opacita': la prima versione era una
  // fascia scura continua che sembrava maltempo, non un ramo davanti alla lente.
  for (let i = 0; i < 14; i += 1) {
    const x = rng() * canvas.width;
    const y = -canvas.height * 0.25 + rng() * canvas.height * 0.4;
    macchia(x, y, canvas.height * (0.22 + rng() * 0.3), 0.16 + rng() * 0.2);
  }
  // due ciuffi negli angoli, un poco piu' densi: sono gli angoli che si chiudono
  for (let i = 0; i < 4; i += 1) {
    macchia(rng() * canvas.width * 0.1, rng() * canvas.height * 0.2, canvas.height * 0.42, 0.3);
    macchia(
      canvas.width - rng() * canvas.width * 0.1,
      rng() * canvas.height * 0.2,
      canvas.height * 0.42,
      0.3,
    );
  }

  return canvas;
}

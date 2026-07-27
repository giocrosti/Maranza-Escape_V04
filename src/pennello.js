// I pennelli prospettici: le poche forme con cui e' disegnato tutto il mondo.
//
// Ognuna prende coordinate in **metri** e le proietta. Chi le usa non deve mai
// vedere un pixel. Sono cinque, e bastano:
//
//   fascia   un quadrilatero orizzontale (strada, marciapiedi, tetti)
//   parete   un quadrilatero verticale lungo la strada (fianchi)
//   testa    un quadrilatero verticale di traverso (facciate che ci guardano)
//   sagoma   un poligono qualsiasi su un piano verticale
//   linea    un segmento
//
// `scatola` e' solo la comodita' di mettere insieme fianco, testa e tetto, che
// e' quello che serve per un'auto, un tram o un palazzo.

import { proietta } from './proiezione.js';

/** Un quadrilatero orizzontale a quota `y`, fra due x e due z. */
export function fascia(ctx, vista, xDa, xA, zVicino, zLontano, y = 0) {
  const a = proietta(vista, xDa, y, zVicino);
  const b = proietta(vista, xA, y, zVicino);
  const c = proietta(vista, xA, y, zLontano);
  const d = proietta(vista, xDa, y, zLontano);
  quadrilatero(ctx, a, b, c, d);
}

/** Un quadrilatero verticale sul piano x costante: il fianco di un volume. */
export function parete(ctx, vista, x, yBasso, yAlto, zVicino, zLontano) {
  const a = proietta(vista, x, yBasso, zVicino);
  const b = proietta(vista, x, yAlto, zVicino);
  const c = proietta(vista, x, yAlto, zLontano);
  const d = proietta(vista, x, yBasso, zLontano);
  quadrilatero(ctx, a, b, c, d);
}

/** Un quadrilatero verticale sul piano z costante: la faccia che ci guarda. */
export function testa(ctx, vista, z, xDa, xA, yBasso, yAlto) {
  const a = proietta(vista, xDa, yBasso, z);
  const b = proietta(vista, xDa, yAlto, z);
  const c = proietta(vista, xA, yAlto, z);
  const d = proietta(vista, xA, yBasso, z);
  quadrilatero(ctx, a, b, c, d);
}

function quadrilatero(ctx, a, b, c, d) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
}

/** Un poligono dato in coordinate (z, y) sul piano verticale x. */
export function sagoma(ctx, vista, x, punti, colore) {
  ctx.fillStyle = colore;
  ctx.beginPath();
  punti.forEach((punto, i) => {
    const p = proietta(vista, x, punto[1], punto[0]);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fill();
}

export function linea(ctx, vista, da, a, colore, spessore) {
  const p1 = proietta(vista, da[0], da[1], da[2]);
  const p2 = proietta(vista, a[0], a[1], a[2]);
  ctx.strokeStyle = colore;
  ctx.lineWidth = Math.max(0.8, spessore * Math.min(p1.scala, p2.scala));
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
}

/** Una scatola vista di tre quarti: fianco, tetto e testa. */
export function scatola(ctx, vista, opzioni) {
  const { xDentro, xFuori, zVicino, zLontano, yBasso, yAlto, lato, tetto, fronte, coda = -3 } = opzioni;
  if (zLontano <= coda) return;
  const vicino = Math.max(zVicino, coda);

  ctx.fillStyle = lato;
  parete(ctx, vista, xDentro, yBasso, yAlto, vicino, zLontano);

  if (tetto) {
    ctx.fillStyle = tetto;
    fascia(ctx, vista, xDentro, xFuori, vicino, zLontano, yAlto);
  }
  if (fronte && zVicino > 0.4) {
    ctx.fillStyle = fronte;
    testa(ctx, vista, zVicino, xDentro, xFuori, yBasso, yAlto);
  }
}

/** Una massa tondeggiante (foglie) su un piano verticale. */
export function chioma(ctx, vista, x, z, y, raggio, colore) {
  const punti = [];
  for (let i = 0; i <= 9; i += 1) {
    const angolo = (Math.PI * 2 * i) / 9;
    const r = raggio * (0.82 + (0.18 * ((i * 7) % 5)) / 4);
    punti.push([z + Math.cos(angolo) * r, y + Math.sin(angolo) * r * 0.92]);
  }
  sagoma(ctx, vista, x, punti, colore);
}

/** Un riquadro con gli angoli arrotondati, in coordinate schermo o figura. */
export function riquadroTondo(ctx, x, y, larghezza, altezza, raggio) {
  const r = Math.min(raggio, Math.abs(larghezza) / 2, Math.abs(altezza) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + larghezza - r, y);
  ctx.quadraticCurveTo(x + larghezza, y, x + larghezza, y + r);
  ctx.lineTo(x + larghezza, y + altezza - r);
  ctx.quadraticCurveTo(x + larghezza, y + altezza, x + larghezza - r, y + altezza);
  ctx.lineTo(x + r, y + altezza);
  ctx.quadraticCurveTo(x, y + altezza, x, y + altezza - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Una facciata su un piano z costante, in coordinate comode: `u` da 0 (lato
 *  strada) a 1 (lato opposto), `v` da 0 (terra) a 1 (cima).
 *
 *  E' con questa che si disegnano i monumenti: una facciata e' fatta di decine
 *  di pezzi, e ragionare ogni volta in metri assoluti renderebbe illeggibile
 *  il disegno del Duomo. */
export function pianoFacciata(vista, z, xDa, xA, yBasso, yAlto) {
  return (u, v) => proietta(vista, xDa + (xA - xDa) * u, yBasso + (yAlto - yBasso) * v, z);
}

/** Disegna un poligono dato in coordinate (u, v) di una facciata. */
export function poligonoFacciata(ctx, punto, punti, colore) {
  ctx.fillStyle = colore;
  ctx.beginPath();
  punti.forEach(([u, v], i) => {
    const p = punto(u, v);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fill();
}

/** Un rettangolo in coordinate di facciata. */
export function rettangoloFacciata(ctx, punto, u1, v1, u2, v2, colore) {
  poligonoFacciata(ctx, punto, [[u1, v1], [u2, v1], [u2, v2], [u1, v2]], colore);
}

/** Sposta un colore esadecimale verso il bianco o il nero. Serve a ricavare
 *  tetto e fronte di un volume dal suo colore, senza doverne elencare tre. */
export function mescola(colore, verso, quanto) {
  const n = parseInt(colore.slice(1), 16);
  const canale = (spostamento) => {
    const valore = (n >> spostamento) & 255;
    return Math.round(valore + (verso - valore) * quanto);
  };
  return `rgb(${canale(16)},${canale(8)},${canale(0)})`;
}

export function schiarisci(colore, quanto = 0.22) {
  return mescola(colore, 255, quanto);
}

export function scurisci(colore, quanto = 0.25) {
  return mescola(colore, 0, quanto);
}

// Il layer delle emissive: solo quello che emette luce, su fondo trasparente.
//
// E' questo che rende **selettivo** il bloom. Il modo comune di fare il bloom e'
// prendere l'immagine finita, tenere i pixel piu' luminosi di una soglia e
// sfocarli: funziona, ma non distingue una moneta accesa da un muro bianco al
// sole, e con una palette chiara come questa il muro vince sempre.
//
// Qui invece le sorgenti si dichiarano: la stessa lista che accende le luci
// dipinge gli aloni. Se una cosa non e' in quella lista non brilla, per quanto
// chiara sia. La sfocatura e la somma le mette poi `scena.js`.
//
// La tela e' a mezza risoluzione: e' fatta di macchie sfumate che verranno
// sfocate ancora. Ogni pixel in piu' sarebbe pixel buttato.

/** Disegna gli aloni. `luci` sono in coordinate di schermo (pixel logici). */
export function disegnaEmissive(ctx, luci) {
  // somma invece di sovrapporre: due luci vicine devono farsi piu' luce, non
  // coprirsi a vicenda
  const modoPrecedente = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';

  for (const luce of luci) {
    const raggio = Math.max(2, luce.raggio);
    const forza = Math.min(1, luce.intensita);
    const [r, g, b] = luce.colore;
    const tinta = (a) =>
      `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;

    const alone = ctx.createRadialGradient(luce.x, luce.y, 0, luce.x, luce.y, raggio);
    // tre fermate e non due: con due la macchia ha il bordo duro di un cerchio
    alone.addColorStop(0, tinta(0.5 * forza));
    alone.addColorStop(0.28, tinta(0.2 * forza));
    alone.addColorStop(1, tinta(0));

    ctx.fillStyle = alone;
    ctx.beginPath();
    ctx.arc(luce.x, luce.y, raggio, 0, Math.PI * 2);
    ctx.fill();

    // il nocciolo: la sorgente vera, piccola e quasi bianca
    const nocciolo = ctx.createRadialGradient(luce.x, luce.y, 0, luce.x, luce.y, raggio * 0.18);
    nocciolo.addColorStop(0, `rgba(255,255,255,${0.45 * forza})`);
    nocciolo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = nocciolo;
    ctx.beginPath();
    ctx.arc(luce.x, luce.y, raggio * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = modoPrecedente;
}

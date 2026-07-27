// Geometria del pulsante di pausa.
//
// Sta in un modulo suo perche' la sanno in due: `render.js` per disegnarlo e
// `main.js` per capire se il dito l'ha centrato. Se il conto stesse in un solo
// posto, l'altro finirebbe per toccare il vuoto.
// Modulo puro: nessun canvas, nessun evento.

/** Il cerchio del pulsante, in pixel dello schermo. */
export function areaPausa(vista, margini = {}) {
  const unita = Math.min(vista.larghezza, vista.altezza * 0.62);
  const raggio = Math.max(20, unita * 0.052);
  const bordo = unita * 0.05;
  return {
    x: vista.larghezza - (margini.destro || 0) - bordo - raggio,
    y: (margini.alto || 0) + bordo + raggio,
    raggio,
  };
}

/** Vero se il tocco in (x, y) e' sul pulsante.
 *  L'area sensibile e' piu' larga del disegno: un pollice non guarda dove
 *  preme, e un pulsante da centrare al pixel in mezzo a una corsa sarebbe
 *  peggio che non averlo. */
export function toccaPausa(area, x, y) {
  const dx = x - area.x;
  const dy = y - area.y;
  const utile = Math.max(area.raggio * 1.4, 26);
  return dx * dx + dy * dy <= utile * utile;
}

// Dove stanno i pulsanti, e come si capisce se il dito li ha centrati.
//
// Sta in un modulo suo perche' la geometria la sanno in due: `render.js` per
// disegnarli e `main.js` per capire dove si e' premuto. Se il conto stesse in
// un posto solo, l'altro finirebbe per toccare il vuoto.
// Modulo puro: nessun canvas, nessun evento.

/** L'unita' con cui sono misurate tutte le interfacce del gioco. */
function unitaDi(vista) {
  return Math.min(vista.larghezza, vista.altezza * 0.62);
}

/** Il cerchio della pausa, in alto a destra. */
export function areaPausa(vista, margini = {}) {
  const unita = unitaDi(vista);
  const raggio = Math.max(20, unita * 0.052);
  const bordo = unita * 0.05;
  return {
    x: vista.larghezza - (margini.destro || 0) - bordo - raggio,
    y: (margini.alto || 0) + bordo + raggio,
    raggio,
  };
}

/** Vero se il tocco in (x, y) e' sul pulsante tondo.
 *  L'area sensibile e' piu' larga del disegno: un pollice non guarda dove
 *  preme, e un pulsante da centrare al pixel in mezzo a una corsa sarebbe
 *  peggio che non averlo. */
export function toccaPausa(area, x, y) {
  const dx = x - area.x;
  const dy = y - area.y;
  const utile = Math.max(area.raggio * 1.4, 26);
  return dx * dx + dy * dy <= utile * utile;
}

/** Un pulsante rettangolare centrato, alla quota `frazione` dello schermo. */
function riquadroCentrato(vista, frazione, larghezzaFrazione = 0.52) {
  const unita = unitaDi(vista);
  const larghezza = Math.min(vista.larghezza * 0.8, unita * larghezzaFrazione);
  const altezza = Math.max(38, unita * 0.085);
  return {
    x: vista.larghezza / 2 - larghezza / 2,
    y: vista.altezza * frazione - altezza / 2,
    larghezza,
    altezza,
  };
}

/** "come si gioca", sulla schermata iniziale. */
export function areaIstruzioni(vista) {
  return riquadroCentrato(vista, 0.905, 0.46);
}

/** "torna alla home", in pausa e a partita finita. Le due quote sono diverse
 *  perche' diverse sono le due schermate. */
export function areaCasa(vista, inPausa) {
  return riquadroCentrato(vista, inPausa ? 0.9 : 0.92);
}

/** "manda il record", solo a partita finita. Sta **sopra** "torna alla home"
 *  perche' e' la cosa che si fa piu' spesso: si guarda il punteggio, lo si
 *  manda, e solo dopo si decide se smettere. */
export function areaCondivisione(vista) {
  return riquadroCentrato(vista, 0.845, 0.46);
}

/** Vero se il tocco e' dentro il riquadro, con un margine di tolleranza. */
export function toccaRiquadro(area, x, y) {
  const tolleranza = 8;
  return (
    x >= area.x - tolleranza &&
    x <= area.x + area.larghezza + tolleranza &&
    y >= area.y - tolleranza &&
    y <= area.y + area.altezza + tolleranza
  );
}

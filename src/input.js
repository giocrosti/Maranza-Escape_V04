// Traduce dito e mouse in comandi. E' l'unico modulo, oltre a main.js, che
// parla con il DOM.
//
// Una passata di dito vale **un comando solo**: si decide alla prima direzione
// che supera la soglia, e per darne un altro bisogna staccare il dito. E' come
// funzionano tutti i giochi di corsa, e serve a non far partire tre cambi di
// corsia perche' il pollice ha continuato a scivolare.

/** Quanti pixel bisogna spostarsi perche' sia una passata e non un tocco. */
export const SOGLIA = 26;

/** Oltre questo tempo un tocco fermo non fa piu' partire la partita: e' un
 *  dito appoggiato, non un tocco. */
const DURATA_MASSIMA_TOCCO = 500;

/** Collega gli eventi del puntatore a due funzioni: `azione` riceve
 *  'sinistra' | 'destra' | 'salta' | 'scivola', `tocco` il tocco secco.
 *  Ritorna la funzione per scollegare tutto. */
export function collegaInput(elemento, { azione, tocco }) {
  let passata = null;

  const coordinate = (evento) => {
    const area = elemento.getBoundingClientRect();
    return { x: evento.clientX - area.left, y: evento.clientY - area.top };
  };

  const premuto = (evento) => {
    // Su un telefono arrivano piu' dita insieme: la passata e' quella del
    // primo, le altre si ignorano finche' non si stacca.
    if (passata) return;
    const { x, y } = coordinate(evento);
    passata = { puntatore: evento.pointerId, x, y, tempo: performance.now(), fatta: false };
    try {
      elemento.setPointerCapture?.(evento.pointerId);
    } catch (errore) {
      /* puntatore gia' rilasciato: si continua lo stesso */
    }
  };

  const mosso = (evento) => {
    if (!passata || passata.puntatore !== evento.pointerId || passata.fatta) return;
    const { x, y } = coordinate(evento);
    const dx = x - passata.x;
    const dy = y - passata.y;
    if (Math.abs(dx) < SOGLIA && Math.abs(dy) < SOGLIA) return;

    passata.fatta = true;
    if (Math.abs(dx) > Math.abs(dy)) azione(dx > 0 ? 'destra' : 'sinistra');
    else azione(dy > 0 ? 'scivola' : 'salta');
  };

  const rilasciato = (evento) => {
    if (!passata || passata.puntatore !== evento.pointerId) return;
    const fermo = !passata.fatta;
    const breve = performance.now() - passata.tempo < DURATA_MASSIMA_TOCCO;
    passata = null;
    if (fermo && breve && tocco) tocco();
  };

  elemento.addEventListener('pointerdown', premuto);
  elemento.addEventListener('pointermove', mosso);
  elemento.addEventListener('pointerup', rilasciato);
  elemento.addEventListener('pointercancel', rilasciato);

  return function scollega() {
    elemento.removeEventListener('pointerdown', premuto);
    elemento.removeEventListener('pointermove', mosso);
    elemento.removeEventListener('pointerup', rilasciato);
    elemento.removeEventListener('pointercancel', rilasciato);
  };
}

/** Il comando corrispondente a un tasto, o null. Sta qui e non in main.js
 *  perche' e' una traduzione come le altre, e cosi' si puo' provare. */
export function azioneDaTasto(tasto) {
  if (tasto === 'ArrowLeft' || tasto === 'a' || tasto === 'A') return 'sinistra';
  if (tasto === 'ArrowRight' || tasto === 'd' || tasto === 'D') return 'destra';
  if (tasto === 'ArrowUp' || tasto === 'w' || tasto === 'W' || tasto === ' ') return 'salta';
  if (tasto === 'ArrowDown' || tasto === 's' || tasto === 'S') return 'scivola';
  return null;
}

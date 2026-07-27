// I test usano lo stesso generatore deterministico del gioco: se cambia
// quello, cambiano anche i percorsi riproducibili dei test.

export { creaRng as rngFinto } from '../src/rng.js';

/** Restituisce sempre lo stesso valore: utile quando il test vuole fissare
 *  un parametro preciso della generazione. */
export function rngCostante(valore) {
  return () => valore;
}

/** Ripete una sequenza data. Serve a costruire un percorso su misura. */
export function rngSequenza(valori) {
  let i = 0;
  return () => valori[i++ % valori.length];
}

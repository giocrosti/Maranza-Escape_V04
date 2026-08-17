import { test, assert, assertUguale } from './mini-test.js';
import { PARALLASSE } from '../src/grafica/scena.js';
import { luciNelRiquadro } from '../src/scena/luci.js';

/* La regola della parallasse e' una sola, ed e' quella che rende profonda una
   scena piatta: **piu' e' vicino, piu' corre**. Se due piani si scambiano di
   posto la profondita' non si legge un po' meno, si legge al contrario. */

test('i fattori di parallasse crescono dal fondo al primo piano', () => {
  const ordine = ['cielo', 'lontano', 'medio', 'vicino', 'vicinissimo'];
  for (let i = 1; i < ordine.length; i += 1) {
    const dietro = PARALLASSE[ordine[i - 1]];
    const davanti = PARALLASSE[ordine[i]];
    assert(
      davanti > dietro,
      `${ordine[i]} (${davanti}) deve correre piu' di ${ordine[i - 1]} (${dietro})`,
    );
  }
});

test('il piano di gioco sta in mezzo alla scala', () => {
  // I piani in prospettiva valgono 1: i fondali devono stare sotto, i primi
  // piani sopra. E' quello che rende il numero leggibile come una distanza.
  assert(PARALLASSE.medio < 1, 'un fondale non puo correre quanto il piano di gioco');
  assert(PARALLASSE.vicino > 1, 'un primo piano deve correre di piu del piano di gioco');
});

test('le luci si convertono in coordinate del riquadro che le riceve', () => {
  // Il filtro delle luci lavora in frazioni del proprio riquadro: se la
  // conversione sbaglia, le luci finiscono a illuminare un punto qualsiasi.
  const area = { x: 100, y: 200, larghezza: 400, altezza: 800 };
  const [luce] = luciNelRiquadro(
    [{ x: 300, y: 600, raggio: 40, intensita: 1, colore: [1, 1, 1] }],
    area,
  );

  assertUguale(luce.x, 0.5, 'centro orizzontale del riquadro');
  assertUguale(luce.y, 0.5, 'centro verticale del riquadro');
  assertUguale(luce.raggio, 0.1, 'raggio in frazioni di larghezza');
});

test('un riquadro degenere non fa esplodere la conversione', () => {
  // Succede per un fotogramma quando la finestra e' larga zero (scheda
  // nascosta, telefono che ruota): non deve uscire nessun NaN, o le uniform
  // restano avvelenate anche dopo.
  const [luce] = luciNelRiquadro(
    [{ x: 10, y: 10, raggio: 5, intensita: 1, colore: [1, 1, 1] }],
    { x: 0, y: 0, larghezza: 0, altezza: 0 },
  );
  assert(Number.isFinite(luce.x) && Number.isFinite(luce.y), 'coordinate non finite');
  assert(Number.isFinite(luce.raggio), 'raggio non finito');
});

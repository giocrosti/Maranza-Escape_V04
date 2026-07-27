import { test, assert, assertQuasi } from './mini-test.js';
import {
  creaVista,
  proietta,
  xDiCorsia,
  bordoSinistroDiCorsia,
  davantiAllaCamera,
  DISTANZA_CAMERA,
} from '../src/proiezione.js';
import { SEMI_STRADA, LARGHEZZA_CORSIA, ALTEZZA_OMINO } from '../src/costanti.js';

// Un iPhone in verticale e un monitor in orizzontale: il gioco deve stare in
// piedi su tutti e due.
const TELEFONO = creaVista(390, 844);
const COMPUTER = creaVista(1280, 720);

test('piu una cosa e lontana, piu diventa piccola', () => {
  const vicino = proietta(TELEFONO, 0, 0, 5);
  const lontano = proietta(TELEFONO, 0, 0, 50);
  assert(lontano.scala < vicino.scala, 'la scala deve calare con la distanza');
  assert(lontano.y < vicino.y, 'il punto lontano deve stare piu in alto sullo schermo');
});

test('quel che e infinitamente lontano finisce sull orizzonte', () => {
  const lontanissimo = proietta(TELEFONO, 3, 0, 100000);
  assertQuasi(lontanissimo.y, TELEFONO.orizzonte, 0.5, 'quota del punto di fuga');
  assertQuasi(lontanissimo.x, TELEFONO.centroX, 0.5, 'il punto di fuga sta al centro');
});

test('le tre corsie sono in fila e larghe uguale', () => {
  assertQuasi(xDiCorsia(0), -SEMI_STRADA + LARGHEZZA_CORSIA / 2, 1e-9);
  assertQuasi(xDiCorsia(1), 0, 1e-9, 'la corsia di mezzo e centrata');
  assertQuasi(xDiCorsia(2), SEMI_STRADA - LARGHEZZA_CORSIA / 2, 1e-9);
  assertQuasi(bordoSinistroDiCorsia(0), -SEMI_STRADA, 1e-9);
  assertQuasi(bordoSinistroDiCorsia(3), SEMI_STRADA, 1e-9, 'il bordo destro chiude la strada');
});

test('la strada ci sta dentro lo schermo, in verticale e in orizzontale', () => {
  for (const vista of [TELEFONO, COMPUTER]) {
    const sinistra = proietta(vista, -SEMI_STRADA, 0, 0);
    const destra = proietta(vista, SEMI_STRADA, 0, 0);
    assert(sinistra.x > 0, 'il bordo sinistro esce dallo schermo');
    assert(destra.x < vista.larghezza, 'il bordo destro esce dallo schermo');
  }
});

test('l omino resta in campo, e non troppo in alto ne troppo in basso', () => {
  for (const vista of [TELEFONO, COMPUTER]) {
    const piedi = proietta(vista, 0, 0, 0);
    const testa = proietta(vista, 0, ALTEZZA_OMINO, 0);
    assert(piedi.y < vista.altezza, 'i piedi finiscono sotto lo schermo');
    assert(piedi.y > vista.altezza * 0.55, 'l omino sta troppo in alto, si vede poca strada davanti');
    assert(testa.y > vista.orizzonte, 'la testa buca l orizzonte');
  }
});

test('dietro la telecamera non si proietta', () => {
  assert(davantiAllaCamera(0), 'la posizione dell omino e davanti alla telecamera');
  assert(!davantiAllaCamera(-DISTANZA_CAMERA), 'il piano della telecamera non e davanti a se stesso');
  assert(!davantiAllaCamera(-DISTANZA_CAMERA - 5), 'quel che e alle spalle va scartato');
});

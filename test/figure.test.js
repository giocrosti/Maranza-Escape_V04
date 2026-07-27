import { test, assert, assertUguale } from './mini-test.js';
import { creaVista } from '../src/proiezione.js';
import { postiDelBranco, COLTELLO_IN_MANO, BOTTIGLIA_ROTTA, CAPPELLI } from '../src/figure.js';

const TELEFONO = creaVista(390, 844);
const STRETTO = creaVista(320, 568);

test('il branco e di quattro maranza con due monopattini', () => {
  const { figure, monopattini } = postiDelBranco(TELEFONO);
  assertUguale(figure.length, 4);
  assertUguale(monopattini.length, 2);
});

test('sono disposti a semicerchio: gli esterni sono piu vicini a chi guarda', () => {
  const { figure } = postiDelBranco(TELEFONO);
  const [sinistro, dentroSinistra, dentroDestra, destro] = figure;

  for (const esterno of [sinistro, destro]) {
    for (const interno of [dentroSinistra, dentroDestra]) {
      assert(esterno.altezza > interno.altezza, 'chi sta ai lati e piu vicino, quindi piu grande');
      assert(esterno.y > interno.y, 'ed essendo piu vicino sta anche piu in basso');
    }
  }
});

test('il capannello e centrato e ordinato da sinistra a destra', () => {
  const { figure } = postiDelBranco(TELEFONO);
  const centro = TELEFONO.larghezza / 2;
  for (let i = 1; i < figure.length; i += 1) {
    assert(figure[i].x > figure[i - 1].x, 'le posizioni devono venire in ordine');
  }
  const scarto = (figure[0].x - centro + (figure[3].x - centro)) / TELEFONO.larghezza;
  assert(Math.abs(scarto) < 0.02, `il gruppo pende da una parte (${scarto.toFixed(3)})`);
});

test('ci stanno tutti nello schermo, anche su uno piccolo', () => {
  for (const vista of [TELEFONO, STRETTO, creaVista(1280, 720)]) {
    const { figure, monopattini } = postiDelBranco(vista);
    for (const posto of [...figure, ...monopattini]) {
      assert(posto.x - posto.mezzaLarghezza > 0, 'qualcuno esce da sinistra');
      assert(posto.x + posto.mezzaLarghezza < vista.larghezza, 'qualcuno esce da destra');
      assert(posto.y < vista.altezza * 0.78, 'i piedi finiscono troppo in basso');
      assert(posto.y - posto.altezza > vista.altezza * 0.28, 'la testa arriva sopra il titolo');
    }
  }
});

test('hanno due coltelli e due bottiglie rotte, e quattro cappellini diversi', () => {
  const { figure } = postiDelBranco(TELEFONO);
  const coltelli = figure.filter((f) => f.arma === COLTELLO_IN_MANO).length;
  const bottiglie = figure.filter((f) => f.arma === BOTTIGLIA_ROTTA).length;
  assertUguale(coltelli, 2);
  assertUguale(bottiglie, 2);

  const cappelli = new Set(figure.map((f) => f.cappello));
  assertUguale(cappelli.size, 4, 'quattro cappellini uguali sembrerebbero quattro copie');
  assert(
    figure.every((f) => CAPPELLI[f.cappello]),
    'ogni cappellino deve avere un colore vero',
  );
});

test('i monopattini stanno negli spazi, non davanti a una faccia', () => {
  const { figure, monopattini } = postiDelBranco(TELEFONO);
  for (const monopattino of monopattini) {
    const addosso = figure.some((f) => Math.abs(f.x - monopattino.x) < f.altezza * 0.12);
    assert(!addosso, 'un monopattino e centrato su una figura');
  }
  assert(monopattini[0].x < TELEFONO.larghezza / 2, 'uno per parte: questo a sinistra');
  assert(monopattini[1].x > TELEFONO.larghezza / 2, 'e questo a destra');
});

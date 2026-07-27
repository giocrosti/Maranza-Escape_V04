import { test, assert } from './mini-test.js';
import { creaVista } from '../src/proiezione.js';
import {
  areaPausa,
  toccaPausa,
  areaIstruzioni,
  areaCasa,
  toccaRiquadro,
} from '../src/pulsanti.js';

const TELEFONO = creaVista(390, 844);
const STRETTO = creaVista(320, 568);
/** I margini di un iPhone con la tacca, tenuto in verticale. */
const CON_TACCA = { alto: 47, destro: 0, basso: 34, sinistro: 0 };

test('il pulsante di pausa sta in alto a destra, tutto dentro lo schermo', () => {
  const area = areaPausa(TELEFONO, {});
  assert(area.x + area.raggio < TELEFONO.larghezza, 'sborda a destra');
  assert(area.x - area.raggio > TELEFONO.larghezza * 0.7, 'non e a destra');
  assert(area.y - area.raggio > 0, 'sborda in alto');
  assert(area.y < TELEFONO.altezza * 0.2, 'non e in alto');
});

test('con la tacca il pulsante scende sotto la zona coperta', () => {
  const senza = areaPausa(TELEFONO, {});
  const con = areaPausa(TELEFONO, CON_TACCA);
  assert(con.y > senza.y + 40, 'senza scendere finirebbe sotto l isola dinamica');
  assert(con.y - con.raggio >= CON_TACCA.alto, 'il cerchio deve stare tutto sotto la tacca');
});

test('i pulsanti sono abbastanza grandi da centrarli senza guardare', () => {
  assert(areaPausa(TELEFONO, {}).raggio * 2 >= 40, 'la pausa e troppo piccola per un pollice');
  for (const area of [areaIstruzioni(TELEFONO), areaCasa(TELEFONO, true), areaCasa(TELEFONO, false)]) {
    assert(area.altezza >= 38, `pulsante alto ${area.altezza.toFixed(0)} px: troppo poco`);
    assert(area.larghezza >= 120, 'e troppo stretto');
  }
});

test('il tocco prende il pulsante tondo, e l area utile e piu larga del disegno', () => {
  const area = areaPausa(TELEFONO, {});
  assert(toccaPausa(area, area.x, area.y), 'in mezzo');
  assert(toccaPausa(area, area.x + area.raggio * 0.9, area.y), 'sul bordo del disegno');
  assert(toccaPausa(area, area.x - area.raggio * 1.2, area.y), 'appena fuori dal disegno');
});

test('un tocco lontano non fa pausa per sbaglio', () => {
  const area = areaPausa(TELEFONO, {});
  assert(!toccaPausa(area, TELEFONO.larghezza / 2, TELEFONO.altezza / 2), 'in mezzo allo schermo');
  assert(!toccaPausa(area, 20, 20), 'nell angolo opposto');
  assert(!toccaPausa(area, area.x, area.y + area.raggio * 3), 'ben sotto il pulsante');
});

test('i pulsanti rettangolari stanno dentro lo schermo, anche su uno piccolo', () => {
  for (const vista of [TELEFONO, STRETTO, creaVista(1280, 720)]) {
    for (const area of [areaIstruzioni(vista), areaCasa(vista, true), areaCasa(vista, false)]) {
      assert(area.x > 0 && area.x + area.larghezza < vista.larghezza, 'sborda di lato');
      assert(area.y > 0 && area.y + area.altezza < vista.altezza, 'sborda sopra o sotto');
    }
  }
});

test('il tocco prende il pulsante rettangolare e non quel che gli sta lontano', () => {
  const area = areaIstruzioni(TELEFONO);
  assert(toccaRiquadro(area, area.x + area.larghezza / 2, area.y + area.altezza / 2), 'in mezzo');
  assert(toccaRiquadro(area, area.x + 2, area.y + 2), 'nell angolo');
  assert(!toccaRiquadro(area, area.x - 60, area.y), 'ben a sinistra');
  assert(!toccaRiquadro(area, area.x, area.y - 80), 'ben sopra');
});

test('il pulsante casa non finisce sotto la barra di casa dell iPhone', () => {
  for (const inPausa of [true, false]) {
    const area = areaCasa(TELEFONO, inPausa);
    assert(area.y + area.altezza < TELEFONO.altezza - 34, 'lo copre la barra di casa');
  }
});

test('la pausa e il pulsante casa non si sovrappongono', () => {
  const pausa = areaPausa(TELEFONO, {});
  const casa = areaCasa(TELEFONO, true);
  assert(casa.y > pausa.y + pausa.raggio, 'due pulsanti sovrapposti sono un pulsante sbagliato');
});

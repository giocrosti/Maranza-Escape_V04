import { test, assert } from './mini-test.js';
import { creaVista } from '../src/proiezione.js';
import { areaPausa, toccaPausa } from '../src/pausa.js';

const TELEFONO = creaVista(390, 844);
/** I margini di un iPhone con la tacca, tenuto in verticale. */
const CON_TACCA = { alto: 47, destro: 0, basso: 34, sinistro: 0 };

test('il pulsante sta in alto a destra, tutto dentro lo schermo', () => {
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

test('il pulsante e abbastanza grande da centrarlo senza guardare', () => {
  const area = areaPausa(TELEFONO, {});
  assert(area.raggio * 2 >= 40, `pulsante da ${(area.raggio * 2).toFixed(0)} px: troppo piccolo per un pollice`);
});

test('il tocco lo prende, e l area utile e piu larga del disegno', () => {
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

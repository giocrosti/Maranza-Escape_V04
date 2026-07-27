import { test, assert, assertUguale } from './mini-test.js';
import { creaCitta, zRelativo, PERIODO, BORDO_MARCIAPIEDE, FILO_PALAZZI } from '../src/citta.js';

const CITTA = creaCitta();

test('la citta e sempre la stessa: stesso seme, stessa via', () => {
  const altra = creaCitta();
  assertUguale(
    JSON.stringify(altra.edifici.map((e) => [e.z, e.tipo, e.altezza])),
    JSON.stringify(CITTA.edifici.map((e) => [e.z, e.tipo, e.altezza])),
    'due partite non possono trovarsi in due vie diverse',
  );
});

test('tutto sta dentro il pezzo di citta che si ripete', () => {
  const dentro = (z) => z >= 0 && z < PERIODO;
  for (const elenco of [CITTA.alberi, CITTA.lampioni, CITTA.auto, CITTA.metro, CITTA.paliLinea]) {
    assert(elenco.length > 0, 'un arredo mancante lascia la via spoglia');
    assert(elenco.every((e) => dentro(e.z)), 'qualcosa e finito fuori dal periodo');
  }
});

test('i cartelli della metro hanno nomi di fermate vere e stanno sul marciapiede', () => {
  assert(CITTA.metro.length >= 8, `solo ${CITTA.metro.length} fermate in tutta la via`);
  for (const fermata of CITTA.metro) {
    assert(fermata.nome && fermata.nome.length >= 4, `nome di fermata sospetto: "${fermata.nome}"`);
    assertUguale(fermata.nome, fermata.nome.toUpperCase(), 'sui cartelli veri il nome e in maiuscolo');
    assert(fermata.lato === 1 || fermata.lato === -1, 'un cartello in mezzo alla strada');
  }
  assert(CITTA.metro.some((f) => f.nome === 'DUOMO'), 'in una via di Milano il Duomo ci deve essere');
});

test('nessun cartello si pianta davanti alla facciata di un monumento', () => {
  const monumenti = CITTA.edifici.filter((e) => e.monumento);
  assert(monumenti.length === 4, `trovati ${monumenti.length} monumenti invece di 4`);
  for (const fermata of CITTA.metro) {
    for (const monumento of monumenti) {
      if (monumento.lato !== fermata.lato) continue;
      const distanza = Math.abs(fermata.z - monumento.z);
      assert(distanza > 40, `il cartello ${fermata.nome} copre il ${monumento.tipo}`);
    }
  }
});

test('ogni monumento ha la sua piazza sgombra davanti', () => {
  const monumenti = CITTA.edifici.filter((e) => e.monumento);
  for (const monumento of monumenti) {
    const inPiazza = CITTA.edifici.filter(
      (e) =>
        !e.monumento &&
        e.lato === monumento.lato &&
        e.z + e.profondita > monumento.z - 60 &&
        e.z < monumento.z,
    );
    assertUguale(
      inPiazza.length,
      0,
      `davanti al ${monumento.tipo} c'e' ancora un palazzo: da lontano non si vedrebbe`,
    );
  }
});

test('i monumenti stanno piu avanti dei palazzi, sul filo della strada', () => {
  const monumenti = CITTA.edifici.filter((e) => e.monumento);
  for (const monumento of monumenti) {
    assert(monumento.larghezza > 10, 'una facciata stretta non si riconosce');
    assert(monumento.altezza > monumento.larghezza, 'i monumenti qui sono piu alti che larghi');
  }
  assert(BORDO_MARCIAPIEDE < FILO_PALAZZI, 'i palazzi stanno oltre il marciapiede');
});

test('la citta si ripete senza salti', () => {
  // subito prima della fine del periodo si deve gia' vedere l'inizio
  assert(zRelativo(5, PERIODO - 3) > 0, 'passato il periodo, la via ricomincia davanti');
  assert(zRelativo(5, 5) === 0, 'quel che si ha addosso sta a distanza zero');
  const dietro = zRelativo(PERIODO - 4, 0);
  assert(dietro < 0, 'quel che sta poco dietro deve avere distanza negativa, non 750 metri');
});

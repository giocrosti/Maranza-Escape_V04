import { test, assert, assertUguale, assertQuasi } from './mini-test.js';
import {
  creaCorridore,
  cambiaCorsia,
  salta,
  scivola,
  avanzaCorridore,
  aTerra,
  abbassato,
  altezzaTesta,
  corsieOccupate,
} from '../src/corridore.js';
import {
  CORSIE,
  DURATA_CAMBIO_CORSIA,
  DURATA_SCIVOLATA,
  ALTEZZA_OMINO,
  ALTEZZA_OMINO_ABBASSATO,
} from '../src/costanti.js';
import { ALTEZZA_PORTALE } from '../src/ostacoli.js';

/** Fa passare `secondi` a passi da un sessantesimo, come nel gioco vero. */
function passa(corridore, secondi) {
  const dt = 1 / 60;
  for (let t = 0; t < secondi; t += dt) avanzaCorridore(corridore, dt, 12);
  return corridore;
}

test('non si esce dalla strada', () => {
  const corridore = creaCorridore(0);
  cambiaCorsia(corridore, -1);
  assertUguale(corridore.bersaglio, 0, 'a sinistra della prima corsia non c e niente');

  corridore.bersaglio = CORSIE - 1;
  cambiaCorsia(corridore, +1);
  assertUguale(corridore.bersaglio, CORSIE - 1, 'a destra dell ultima corsia nemmeno');
});

test('due comandi di fila saltano due corsie', () => {
  const corridore = creaCorridore(0);
  cambiaCorsia(corridore, +1);
  cambiaCorsia(corridore, +1);
  assertUguale(corridore.bersaglio, 2, 'il secondo comando non deve andare perso');
  passa(corridore, DURATA_CAMBIO_CORSIA * 2 + 0.05);
  assertUguale(corridore.posizione, 2);
});

test('il cambio di corsia non e istantaneo, ma dura quel che deve', () => {
  const corridore = creaCorridore(1);
  cambiaCorsia(corridore, +1);
  passa(corridore, DURATA_CAMBIO_CORSIA / 2);
  assert(corridore.posizione > 1.2 && corridore.posizione < 1.8, 'a meta strada sta in mezzo');
  passa(corridore, DURATA_CAMBIO_CORSIA);
  assertUguale(corridore.posizione, 2, 'alla fine ci arriva esatto, senza avanzi');
});

test('a cavallo della riga si occupano due corsie', () => {
  const corridore = creaCorridore(1);
  assertUguale(corsieOccupate(corridore).join(), '1', 'fermo in corsia se ne occupa una sola');
  corridore.posizione = 1.5;
  assertUguale(corsieOccupate(corridore).join(), '1,2', 'a meta strada si e in due corsie');
});

test('si salta, si ricade, e in aria non si salta di nuovo', () => {
  const corridore = creaCorridore();
  salta(corridore);
  assert(corridore.inAria, 'dopo il comando e in aria');

  let massima = 0;
  for (let t = 0; t < 0.7; t += 1 / 120) {
    avanzaCorridore(corridore, 1 / 120, 12);
    massima = Math.max(massima, corridore.y);
    if (corridore.inAria) salta(corridore); // insistere non deve servire a nulla
  }
  assert(massima > 1.1 && massima < 1.6, `salto alto ${massima.toFixed(2)} m: fuori misura`);
  assert(!corridore.inAria, 'dopo mezzo secondo abbondante deve essere atterrato');
  assertUguale(corridore.y, 0, 'atterrato vuol dire a quota zero');
});

test('saltando non si e piu a terra: e cosi che si scavalca una buca', () => {
  const corridore = creaCorridore();
  assert(aTerra(corridore), 'fermo e a terra');
  salta(corridore);
  assert(!aTerra(corridore), 'si e in aria dal primo istante, non quando i piedi sono gia alti');
  passa(corridore, 0.12);
  assert(!aTerra(corridore), 'a mezzo salto non si e piu dentro la buca');
});

test('in discesa si torna a terra prima di toccare, e si cade nella buca', () => {
  const corridore = creaCorridore();
  salta(corridore);
  passa(corridore, 0.6); // quasi tutto il volo
  assert(corridore.vy < 0, 'sta scendendo');
  assert(aTerra(corridore), 'atterrando dentro una buca ci si finisce dentro');
});

test('abbassandosi la testa passa sotto il portale', () => {
  const corridore = creaCorridore();
  assertQuasi(altezzaTesta(corridore), ALTEZZA_OMINO, 1e-9);
  assert(altezzaTesta(corridore) > ALTEZZA_PORTALE, 'in piedi la traversa lo prende');

  scivola(corridore);
  assert(abbassato(corridore));
  assertQuasi(altezzaTesta(corridore), ALTEZZA_OMINO_ABBASSATO, 1e-9);
  assert(altezzaTesta(corridore) < ALTEZZA_PORTALE, 'abbassato ci passa sotto');
});

test('la scivolata finisce da sola', () => {
  const corridore = creaCorridore();
  scivola(corridore);
  passa(corridore, DURATA_SCIVOLATA + 0.05);
  assert(!abbassato(corridore), 'dopo la sua durata si torna in piedi');
});

test('abbassarsi in aria fa precipitare, e la scivolata parte all atterraggio', () => {
  const corridore = creaCorridore();
  salta(corridore);
  passa(corridore, 0.2);
  const quota = corridore.y;
  scivola(corridore);
  assert(!abbassato(corridore), 'in aria non ci si abbassa: prima si atterra');
  passa(corridore, 0.12);
  assert(corridore.y < quota, 'la picchiata deve far scendere in fretta');
  passa(corridore, 0.3);
  assert(!corridore.inAria, 'a terra');
  assert(abbassato(corridore), 'appena atterrato si abbassa, senza dover ripremere');
});

test('il salto annulla una scivolata partita troppo presto', () => {
  const corridore = creaCorridore();
  scivola(corridore);
  salta(corridore);
  assert(!abbassato(corridore), 'saltare rialza');
  assert(corridore.inAria);
});

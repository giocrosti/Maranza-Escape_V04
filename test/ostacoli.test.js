import { test, assert, assertUguale } from './mini-test.js';
import {
  creaBuca,
  creaMonopattino,
  creaLampione,
  prendeIlCorridore,
  corsieOstacolo,
  lasciaUnaCorsiaLibera,
  sovrapposto,
  profiloBuca,
} from '../src/ostacoli.js';
import { creaCorridore, salta, scivola, avanzaCorridore } from '../src/corridore.js';

function inVolo(corsia = 1) {
  const corridore = creaCorridore(corsia);
  salta(corridore);
  avanzaCorridore(corridore, 0.15, 12);
  return corridore;
}

function abbassato(corsia = 1) {
  const corridore = creaCorridore(corsia);
  scivola(corridore);
  return corridore;
}

test('la buca si evita saltando, e solo saltando', () => {
  const buca = creaBuca(0, 1, 1, 3);
  assert(prendeIlCorridore(buca, creaCorridore(1), 0), 'chi ci passa dentro a piedi ci cade');
  assert(!prendeIlCorridore(buca, inVolo(1), 0), 'chi la scavalca passa');
  assert(prendeIlCorridore(buca, abbassato(1), 0), 'abbassarsi non serve a niente contro una buca');
  assert(!prendeIlCorridore(buca, creaCorridore(2), 0), 'in un altra corsia non c e problema');
});

test('una buca larga tre corsie si puo solo saltare', () => {
  const buca = creaBuca(0, 0, 3, 4);
  assertUguale(corsieOstacolo(buca).join(), '0,1,2');
  assert(!lasciaUnaCorsiaLibera(buca), 'non lascia scampo di lato');
  for (const corsia of [0, 1, 2]) {
    assert(prendeIlCorridore(buca, creaCorridore(corsia), 0), `corsia ${corsia}: si cade`);
    assert(!prendeIlCorridore(buca, inVolo(corsia), 0), `corsia ${corsia}: saltando si passa`);
  }
});

test('il monopattino si evita solo cambiando corsia', () => {
  const monopattino = creaMonopattino(0, 1);
  assert(prendeIlCorridore(monopattino, creaCorridore(1), 0), 'nella sua corsia ti prende');
  assert(prendeIlCorridore(monopattino, inVolo(1), 0), 'e alto: saltargli sopra non funziona');
  assert(prendeIlCorridore(monopattino, abbassato(1), 0), 'nemmeno abbassarsi');
  assert(!prendeIlCorridore(monopattino, creaCorridore(0), 0), 'a lato si passa');
  assert(!prendeIlCorridore(monopattino, creaCorridore(2), 0), 'anche dall altro lato');
});

test('il lampione caduto si passa solo abbassandosi', () => {
  const lampione = creaLampione(0, 0, 3);
  assert(prendeIlCorridore(lampione, creaCorridore(1), 0), 'in piedi lo si prende in pieno');
  assert(prendeIlCorridore(lampione, inVolo(1), 0), 'saltare peggiora le cose');
  assert(!prendeIlCorridore(lampione, abbassato(1), 0), 'abbassati ci si passa sotto');
});

test('un lampione su una corsia sola si evita anche di lato', () => {
  const lampione = creaLampione(0, 2, 1);
  assert(prendeIlCorridore(lampione, creaCorridore(2), 0));
  assert(!prendeIlCorridore(lampione, creaCorridore(1), 0), 'in un altra corsia non tocca');
});

test('quel che e lontano non tocca nessuno', () => {
  const monopattino = creaMonopattino(0, 1);
  assert(!sovrapposto(monopattino, 6), 'sei metri avanti');
  assert(!sovrapposto(monopattino, -6), 'sei metri indietro');
  assert(sovrapposto(monopattino, 0), 'addosso');
  assert(!prendeIlCorridore(monopattino, creaCorridore(1), 6), 'da lontano non prende');
});

test('un ostacolo gia colpito non colpisce due volte', () => {
  const buca = creaBuca(0, 1, 1, 3);
  const corridore = creaCorridore(1);
  assert(prendeIlCorridore(buca, corridore, 0));
  buca.colpito = true;
  assert(!prendeIlCorridore(buca, corridore, 0), 'una buca si paga una volta sola');
});

/** Il punto sta dentro il poligono? Lancio di raggio, il metodo di sempre. */
function dentroIlContorno(contorno, x, z) {
  let dentro = false;
  for (let i = 0, j = contorno.length - 1; i < contorno.length; j = i, i += 1) {
    const [xi, zi] = contorno[i];
    const [xj, zj] = contorno[j];
    const attraversa = zi > z !== zj > z;
    if (attraversa && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) dentro = !dentro;
  }
  return dentro;
}

test('il contorno della buca non esce dal suo riquadro', () => {
  for (const seme of [0, 1, 17, 4242, 99999]) {
    for (const [x, z] of profiloBuca(seme)) {
      assert(Math.abs(x) <= 1.0001 && Math.abs(z) <= 1.0001, `seme ${seme}: vertice fuori dal riquadro`);
    }
  }
});

test('la stessa buca ha sempre la stessa forma, buche diverse no', () => {
  assertUguale(JSON.stringify(profiloBuca(7)), JSON.stringify(profiloBuca(7)), 'deve essere stabile');
  assert(
    JSON.stringify(profiloBuca(7)) !== JSON.stringify(profiloBuca(8)),
    'due buche di fila non possono essere identiche',
  );
});

test('il contorno non e un ellisse: copre le corsie fino ai bordi', () => {
  // La regola che conta: l'urto usa il riquadro pieno, quindi la buca deve
  // vedersi in tutte le corsie che occupa, anche in quelle di lato. Un
  // contorno tondo lascerebbe scoperte le punte e si cadrebbe in una buca che
  // li' non c'e'.
  const contorno = profiloBuca(123);
  for (const quante of [1, 2, 3]) {
    for (let corsia = 0; corsia < quante; corsia += 1) {
      const x = (2 * corsia + 1) / quante - 1; // centro della corsia, da -1 a 1
      assert(dentroIlContorno(contorno, x, 0.55), `${quante} corsie, corsia ${corsia}: buca troppo corta`);
      assert(dentroIlContorno(contorno, x, -0.55), `${quante} corsie, corsia ${corsia}: buca troppo corta`);
    }
  }
});

test('a meta cambio di corsia si viene presi da tutte e due le corsie', () => {
  const corridore = creaCorridore(1);
  corridore.posizione = 1.5;
  assert(prendeIlCorridore(creaMonopattino(0, 1), corridore, 0), 'quella che si sta lasciando');
  assert(prendeIlCorridore(creaMonopattino(0, 2), corridore, 0), 'quella in cui si sta entrando');
});

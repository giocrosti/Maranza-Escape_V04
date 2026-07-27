import { test, assertUguale } from './mini-test.js';
import { leggiRecord, aggiornaRecord } from '../src/record.js';

/** Un localStorage finto: i test non devono toccare il record vero. */
function deposito(valori = {}) {
  return {
    dati: { ...valori },
    getItem(chiave) {
      return chiave in this.dati ? this.dati[chiave] : null;
    },
    setItem(chiave, valore) {
      this.dati[chiave] = String(valore);
    },
  };
}

/** Un deposito rotto: e' quel che succede in navigazione privata. */
function depositoRotto() {
  return {
    getItem() {
      throw new Error('niente accesso');
    },
    setItem() {
      throw new Error('niente accesso');
    },
  };
}

test('senza record salvato si parte da zero', () => {
  assertUguale(leggiRecord(deposito()), 0);
});

test('il record migliore vince, quello peggiore si scarta', () => {
  const d = deposito();
  assertUguale(aggiornaRecord(120, d), 120);
  assertUguale(aggiornaRecord(90, d), 120, 'un punteggio piu basso non sovrascrive');
  assertUguale(aggiornaRecord(300, d), 300);
  assertUguale(leggiRecord(d), 300);
});

test('un valore sporco nel deposito non fa esplodere niente', () => {
  assertUguale(leggiRecord(deposito({ 'maranza-escape.record': 'chissa' })), 0);
  assertUguale(leggiRecord(deposito({ 'maranza-escape.record': '-5' })), 0);
});

test('se il deposito non funziona si gioca lo stesso', () => {
  const rotto = depositoRotto();
  assertUguale(leggiRecord(rotto), 0);
  assertUguale(aggiornaRecord(50, rotto), 50, 'il record vale almeno per questa partita');
});

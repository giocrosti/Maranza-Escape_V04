import { test, assert, assertUguale, assertQuasi } from './mini-test.js';
import {
  creaInseguitori,
  avanzaInseguitori,
  avvicina,
  hannoPreso,
  minaccia,
  DISTACCO_INIZIALE,
  PENALITA_ERRORE,
  ERRORI_PER_PERDERE,
} from '../src/inseguitori.js';

test('si parte col vantaggio pieno e nessuno ti ha ancora preso', () => {
  const inseguitori = creaInseguitori();
  assertUguale(inseguitori.distacco, DISTACCO_INIZIALE);
  assert(!hannoPreso(inseguitori));
  assertUguale(minaccia(inseguitori), 0);
});

test('ogni errore li porta piu vicini, ma mai dietro di te', () => {
  const inseguitori = creaInseguitori();
  avvicina(inseguitori);
  assertQuasi(inseguitori.distacco, DISTACCO_INIZIALE - PENALITA_ERRORE, 1e-9);
  for (let i = 0; i < 10; i += 1) avvicina(inseguitori);
  assertUguale(inseguitori.distacco, 0, 'il distacco non diventa negativo');
  assert(hannoPreso(inseguitori));
});

test('tre errori bastano, due no', () => {
  const inseguitori = creaInseguitori();
  for (let i = 1; i < ERRORI_PER_PERDERE; i += 1) {
    avvicina(inseguitori);
    assert(!hannoPreso(inseguitori), `dopo ${i} errori si e messi male ma si corre ancora`);
  }
  avvicina(inseguitori);
  assert(hannoPreso(inseguitori), 'al terzo ti prendono');
});

test('la penalita e un terzo esatto: il terzo errore azzera il distacco', () => {
  assertQuasi(PENALITA_ERRORE * ERRORI_PER_PERDERE, DISTACCO_INIZIALE, 1e-9);
  const inseguitori = creaInseguitori();
  for (let i = 0; i < ERRORI_PER_PERDERE; i += 1) avvicina(inseguitori);
  assertUguale(inseguitori.distacco, 0, 'niente briciole di virgola mobile a tenere in vita la partita');
});

test('il terreno perso non si riprende piu, per quanto si corra pulito', () => {
  const inseguitori = creaInseguitori();
  avvicina(inseguitori);
  const dopo = inseguitori.distacco;
  avanzaInseguitori(inseguitori, 60, { velocita: 20 });
  assertUguale(inseguitori.distacco, dopo, 'un minuto di corsa pulita non restituisce un metro');
});

test('la minaccia va da zero a uno', () => {
  const inseguitori = creaInseguitori();
  assertUguale(minaccia(inseguitori), 0, 'lontani: nessuna minaccia');
  avvicina(inseguitori, DISTACCO_INIZIALE / 2);
  assertQuasi(minaccia(inseguitori), 0.5, 1e-9);
  avvicina(inseguitori, 100);
  assertUguale(minaccia(inseguitori), 1, 'addosso: minaccia piena');
});

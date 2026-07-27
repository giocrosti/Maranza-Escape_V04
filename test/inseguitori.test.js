import { test, assert, assertUguale, assertQuasi } from './mini-test.js';
import {
  creaInseguitori,
  avanzaInseguitori,
  avvicina,
  allontana,
  hannoPreso,
  minaccia,
  DISTACCO_INIZIALE,
  PENALITA_ERRORE,
  RECUPERO,
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
  const due = creaInseguitori();
  avvicina(due);
  avvicina(due);
  assert(!hannoPreso(due), 'dopo due errori si e messi male ma si corre ancora');

  avvicina(due);
  assert(hannoPreso(due), 'al terzo ti prendono');
});

test('correndo pulito si recupera, senza superare il vantaggio di partenza', () => {
  const inseguitori = creaInseguitori();
  avvicina(inseguitori);
  const dopo = inseguitori.distacco;
  avanzaInseguitori(inseguitori, 1);
  assertQuasi(inseguitori.distacco, dopo + RECUPERO, 1e-9);

  avanzaInseguitori(inseguitori, 100);
  assertUguale(inseguitori.distacco, DISTACCO_INIZIALE, 'il recupero ha un tetto');
});

test('lo scatto fa recuperare molto piu in fretta', () => {
  const piano = creaInseguitori();
  const scattando = creaInseguitori();
  avvicina(piano, 10);
  avvicina(scattando, 10);
  avanzaInseguitori(piano, 1);
  avanzaInseguitori(scattando, 1, { scatto: true });
  assert(scattando.distacco > piano.distacco * 1.5, 'lo scatto deve valere la pena');
});

test('allontanarli non li manda oltre il massimo', () => {
  const inseguitori = creaInseguitori();
  allontana(inseguitori, 50);
  assertUguale(inseguitori.distacco, DISTACCO_INIZIALE);
});

test('la minaccia va da zero a uno', () => {
  const inseguitori = creaInseguitori();
  assertUguale(minaccia(inseguitori), 0, 'lontani: nessuna minaccia');
  avvicina(inseguitori, DISTACCO_INIZIALE / 2);
  assertQuasi(minaccia(inseguitori), 0.5, 1e-9);
  avvicina(inseguitori, 100);
  assertUguale(minaccia(inseguitori), 1, 'addosso: minaccia piena');
});

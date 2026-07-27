import { test, assert, assertUguale, assertQuasi } from './mini-test.js';
import {
  creaMondo,
  avviaPartita,
  avanzaMondo,
  comando,
  subisciErrore,
  puoRiavviare,
  terminaPartita,
  mettiInPausa,
  riprendi,
  alternaPausa,
  inPausa,
  scattoAttivo,
  madonninaAttiva,
  RITARDO_RIAVVIO,
  PUNTI_PER_MONETA,
  DURATA_SCATTO,
  DURATA_MADONNINA,
  DURATA_APPARIZIONE,
  GRIDO_CALAMITA,
  GRIDO_SCATTO,
  GRIDO_SCONFITTA,
} from '../src/mondo.js';
import { creaBuca, creaMonopattino } from '../src/ostacoli.js';
import { creaRaccolta, MONETA, SCUDO, SCATTO, CALAMITA, MADONNINA } from '../src/percorso.js';
import { DISTACCO_INIZIALE, PENALITA_ERRORE, ERRORI_PER_PERDERE } from '../src/inseguitori.js';
import { DT_MASSIMO, VELOCITA_MASSIMA } from '../src/costanti.js';
import { rngFinto } from './rng-finto.js';

/** Una partita con un percorso deciso a mano: la generazione automatica e'
 *  spenta spostando all'infinito il prossimo pezzo da creare. */
function partitaControllata(ostacoli = [], raccolte = []) {
  const mondo = creaMondo(390, 844);
  avviaPartita(mondo);
  mondo.percorso.ostacoli = ostacoli;
  mondo.percorso.raccolte = raccolte;
  mondo.percorso.prossimoZ = Infinity;
  mondo.percorso.prossimoBonusZ = Infinity;
  return mondo;
}

const rng = rngFinto(11);

/** Fa correre il mondo per `secondi`. `durante` viene chiamata a ogni
 *  fotogramma: e' li' che il finto giocatore decide cosa fare. */
function corri(mondo, secondi, durante) {
  const dt = 1 / 60;
  for (let t = 0; t < secondi; t += dt) {
    if (durante) durante(mondo);
    avanzaMondo(mondo, dt, rng);
  }
  return mondo;
}

test('una partita comincia con tutto azzerato', () => {
  const mondo = creaMondo(390, 844);
  corri(mondo, 2); // un po' di schermata iniziale
  avviaPartita(mondo);
  assertUguale(mondo.stato, 'in-gioco');
  assertUguale(mondo.distanza, 0);
  assertUguale(mondo.punteggio, 0);
  assertUguale(mondo.monete, 0);
  assertUguale(mondo.errori, 0);
  assertUguale(mondo.inseguitori.distacco, DISTACCO_INIZIALE);
  assertUguale(mondo.corridore.posizione, 1, 'si riparte dalla corsia di mezzo');
});

test('correndo si fanno metri, e i metri sono punti', () => {
  const mondo = partitaControllata();
  corri(mondo, 3);
  assert(mondo.distanza > 30, `in tre secondi si fanno piu di 30 metri, non ${mondo.distanza}`);
  assertUguale(mondo.punteggio, Math.floor(mondo.distanza), 'un metro, un punto');
});

test('un errore fa guadagnare terreno agli inseguitori', () => {
  const mondo = partitaControllata();
  subisciErrore(mondo, 'buca');
  assertQuasi(mondo.inseguitori.distacco, DISTACCO_INIZIALE - PENALITA_ERRORE, 1e-9);
  assertUguale(mondo.errori, 1);
  assertUguale(mondo.stato, 'in-gioco', 'un errore solo non basta a farsi prendere');
});

test('tre errori e ti prendono', () => {
  const mondo = partitaControllata();
  for (let i = 0; i < 3; i += 1) {
    mondo.invulnerabileFinoA = 0; // l'invulnerabilita' si prova altrove
    subisciErrore(mondo, 'monopattino');
  }
  assertUguale(mondo.stato, 'finita');
  assertUguale(mondo.causaFine, 'monopattino', 'la schermata finale deve saper dire com e finita');
  assertUguale(mondo.inseguitori.distacco, 0);
});

test('il terreno perso resta perso: correre pulito non lo restituisce', () => {
  const mondo = partitaControllata();
  subisciErrore(mondo, 'buca');
  const dopoErrore = mondo.inseguitori.distacco;
  corri(mondo, 20);
  assertUguale(mondo.inseguitori.distacco, dopoErrore, 'venti secondi puliti non valgono un metro');
  assertUguale(mondo.stato, 'in-gioco', 'ma nemmeno si perde per il solo passare del tempo');
});

test('al terzo errore si perde, sempre e comunque', () => {
  // anche con tutto il tempo del mondo fra un errore e l'altro
  const mondo = partitaControllata();
  for (let i = 0; i < 2; i += 1) {
    subisciErrore(mondo, 'buca');
    corri(mondo, 25);
    assertUguale(mondo.stato, 'in-gioco', `dopo ${i + 1} errori si corre ancora`);
  }
  subisciErrore(mondo, 'buca');
  assertUguale(mondo.stato, 'finita', 'il terzo errore chiude la partita');
  assertUguale(mondo.errori, ERRORI_PER_PERDERE);
  assertUguale(mondo.inseguitori.distacco, 0);
});

test('subito dopo un errore si e intoccabili', () => {
  const mondo = partitaControllata();
  subisciErrore(mondo, 'buca');
  const distacco = mondo.inseguitori.distacco;
  assertUguale(subisciErrore(mondo, 'lampione'), false, 'il secondo urto immediato non conta');
  assertUguale(mondo.inseguitori.distacco, distacco);
  assertUguale(mondo.errori, 1);
});

test('lo scudo si mangia un errore e poi non c e piu', () => {
  const mondo = partitaControllata();
  mondo.scudo = true;
  assertUguale(subisciErrore(mondo, 'buca'), false, 'con lo scudo non si perde terreno');
  assertUguale(mondo.scudo, false, 'lo scudo si consuma');
  assertUguale(mondo.inseguitori.distacco, DISTACCO_INIZIALE);
  assertUguale(mondo.errori, 0);

  mondo.invulnerabileFinoA = 0;
  assertUguale(subisciErrore(mondo, 'buca'), true, 'il secondo errore si paga');
});

test('saltare al momento giusto evita davvero la buca', () => {
  const mondo = partitaControllata([creaBuca(40, 1, 1, 3)]);
  corri(mondo, 5, (m) => {
    const zRelativo = 40 - m.distanza;
    if (zRelativo < 4 && zRelativo > 3 && !m.corridore.inAria) comando(m, 'salta');
  });
  assertUguale(mondo.errori, 0, 'il salto era in tempo: non doveva costare nulla');
  assertUguale(mondo.inseguitori.distacco, DISTACCO_INIZIALE);
});

test('correre dritti dentro una buca si paga', () => {
  const mondo = partitaControllata([creaBuca(40, 1, 1, 3)]);
  // il distacco piu' stretto della partita e' quello subito dopo l'urto:
  // guardare solo il valore finale non direbbe niente, perche' nel frattempo
  // si e' gia' ricominciato a recuperare
  let minimo = DISTACCO_INIZIALE;
  corri(mondo, 5, (m) => {
    minimo = Math.min(minimo, m.inseguitori.distacco);
  });
  assertUguale(mondo.errori, 1);
  assertUguale(mondo.causaFine, 'buca');
  assertQuasi(minimo, DISTACCO_INIZIALE - PENALITA_ERRORE, 0.05, 'un errore costa la sua penalita');
});

test('cambiare corsia in tempo evita il monopattino', () => {
  const mondo = partitaControllata([creaMonopattino(40, 1)]);
  corri(mondo, 5, (m) => {
    if (40 - m.distanza < 12 && m.corridore.bersaglio === 1) comando(m, 'destra');
  });
  assertUguale(mondo.errori, 0);
});

test('durante lo scatto si passa attraverso tutto', () => {
  const mondo = partitaControllata([creaMonopattino(40, 1)]);
  mondo.scattoFinoA = mondo.tempo + 100;
  corri(mondo, 4);
  assertUguale(mondo.errori, 0, 'lo scatto travolge');
  assertUguale(mondo.inseguitori.distacco, DISTACCO_INIZIALE);
  assert(mondo.percorso.ostacoli.every((o) => o.travolto), 'l ostacolo travolto va segnato');
});

test('le monete si prendono solo nella corsia in cui stanno', () => {
  const mia = partitaControllata([], [creaRaccolta(MONETA, 30, 1, 0.85)]);
  corri(mia, 4);
  assertUguale(mia.monete, 1, 'quella nella mia corsia si prende');
  assertUguale(mia.punteggio, Math.floor(mia.distanza) + PUNTI_PER_MONETA);

  const altrui = partitaControllata([], [creaRaccolta(MONETA, 30, 2, 0.85)]);
  corri(altrui, 4);
  assertUguale(altrui.monete, 0, 'quella di un altra corsia resta li');
});

test('la calamita tira anche le monete delle altre corsie', () => {
  const mondo = partitaControllata([], [creaRaccolta(MONETA, 30, 2, 0.85)]);
  mondo.calamitaFinoA = mondo.tempo + 100;
  corri(mondo, 4);
  assertUguale(mondo.monete, 1);
});

test('i bonus raccolti fanno quel che promettono', () => {
  const scudo = partitaControllata([], [creaRaccolta(SCUDO, 30, 1, 1.1)]);
  corri(scudo, 4);
  assertUguale(scudo.scudo, true);

  const scatto = partitaControllata([], [creaRaccolta(SCATTO, 30, 1, 1.1)]);
  corri(scatto, 4);
  assert(scatto.scattoFinoA > scatto.tempo, 'lo scatto deve essere acceso');
  assert(scatto.scattoFinoA - scatto.tempo <= DURATA_SCATTO, 'e non piu del dovuto');
  assertUguale(scatto.avviso.testo, GRIDO_SCATTO, 'lo scatto e la macchinina del car sharing');
  assertUguale(GRIDO_SCATTO, 'car sharing');

  const calamita = partitaControllata([], [creaRaccolta(CALAMITA, 30, 1, 1.1)]);
  corri(calamita, 4);
  assert(calamita.calamitaFinoA > calamita.tempo);
  assertUguale(calamita.avviso.testo, GRIDO_CALAMITA, 'la calamita ha il suo grido');
  assertUguale(GRIDO_CALAMITA, 'oggi si fattura');
});

test('lo scatto fa andare piu forte', () => {
  const normale = partitaControllata();
  corri(normale, 2);
  const veloce = partitaControllata();
  veloce.scattoFinoA = veloce.tempo + 100;
  corri(veloce, 2);
  assert(veloce.distanza > normale.distanza * 1.3, 'lo scatto deve sentirsi');
});

test('tornare dall app in secondo piano non teletrasporta dentro un ostacolo', () => {
  const mondo = partitaControllata();
  avanzaMondo(mondo, 60, rng); // un minuto in un solo passo
  assert(
    mondo.distanza <= VELOCITA_MASSIMA * DT_MASSIMO + 1e-9,
    `un fotogramma lungo un minuto ha fatto correre ${mondo.distanza.toFixed(1)} metri`,
  );
});

test('fuori dalla partita i comandi non fanno niente', () => {
  const mondo = creaMondo(390, 844);
  assertUguale(comando(mondo, 'destra'), false, 'sulla schermata iniziale non si gioca');
  assertUguale(mondo.corridore.bersaglio, 1);
});

test('si puo riprovare, ma non nello stesso istante in cui si perde', () => {
  const mondo = partitaControllata();
  assert(puoRiavviare(mondo) === false, 'durante la partita non si riparte');
  terminaPartita(mondo, 'buca');
  assert(!puoRiavviare(mondo), 'subito dopo la sconfitta il tocco non conta');
  corri(mondo, RITARDO_RIAVVIO + 0.2);
  assert(puoRiavviare(mondo), 'passato un attimo si puo riprovare');
});

test('la Madonnina ferma il gioco per due secondi, poi da dieci secondi di potere', () => {
  const mondo = partitaControllata([], [creaRaccolta(MADONNINA, 30, 1, 1.1)]);
  corri(mondo, 3);
  assertUguale(mondo.stato, 'apparizione', 'appena presa, il mondo si ferma');
  assert(!madonninaAttiva(mondo), 'il potere non e ancora partito: prima l apparizione');

  const fermo = { tempo: mondo.tempo, distanza: mondo.distanza };
  corri(mondo, DURATA_APPARIZIONE * 0.4);
  assertUguale(mondo.tempo, fermo.tempo, 'durante l apparizione l orologio del mondo sta fermo');
  assertUguale(mondo.distanza, fermo.distanza, 'e la strada non scorre');
  assertUguale(mondo.stato, 'apparizione');

  // un fotogramma per volta fino a quando l'apparizione finisce: i dieci
  // secondi vanno misurati li', non dopo aver continuato a correre
  let fotogrammi = 0;
  while (mondo.stato === 'apparizione' && fotogrammi < 600) {
    corri(mondo, 1 / 60);
    fotogrammi += 1;
  }
  assertUguale(mondo.stato, 'in-gioco', 'dopo due secondi si riparte');
  assert(madonninaAttiva(mondo), 'e li comincia il potere');
  assertQuasi(mondo.madonninaFinoA - mondo.tempo, DURATA_MADONNINA, 0.05, 'dieci secondi pieni');
});

test('con la Madonnina si va piu forte della macchinina e non ti tocca niente', () => {
  const conMadonnina = partitaControllata([creaMonopattino(60, 1), creaBuca(120, 0, 3, 4)]);
  conMadonnina.madonninaFinoA = conMadonnina.tempo + 100;
  corri(conMadonnina, 6);

  const conScatto = partitaControllata();
  conScatto.scattoFinoA = conScatto.tempo + 100;
  corri(conScatto, 6);

  assert(
    conMadonnina.distanza > conScatto.distanza * 1.8,
    `la Madonnina deve valere il doppio della macchinina (${conMadonnina.distanza.toFixed(0)} contro ${conScatto.distanza.toFixed(0)})`,
  );
  assertUguale(conMadonnina.errori, 0, 'indistruttibile vuol dire indistruttibile');
  assertUguale(conMadonnina.inseguitori.distacco, DISTACCO_INIZIALE);
});

test('in apparizione i comandi non arrivano all omino', () => {
  const mondo = partitaControllata([], [creaRaccolta(MADONNINA, 30, 1, 1.1)]);
  corri(mondo, 3);
  assertUguale(mondo.stato, 'apparizione');
  assertUguale(comando(mondo, 'destra'), false);
  assertUguale(puoRiavviare(mondo), false, 'un tocco durante l apparizione non ricomincia la partita');
});

test('la sconfitta ha la sua scritta', () => {
  assertUguale(GRIDO_SCONFITTA, 'Ti hanno fatto il portafoglio');
});

test('in pausa non si muove piu niente, nemmeno il tempo', () => {
  const mondo = partitaControllata([creaMonopattino(40, 1)]);
  corri(mondo, 1);
  const fotografia = {
    tempo: mondo.tempo,
    distanza: mondo.distanza,
    corsia: mondo.corridore.posizione,
    distacco: mondo.inseguitori.distacco,
    scorrimento: mondo.scorrimento,
  };

  assertUguale(mettiInPausa(mondo), true);
  corri(mondo, 5); // cinque secondi di fotogrammi a vuoto

  assertUguale(mondo.tempo, fotografia.tempo, 'in pausa l orologio del mondo sta fermo');
  assertUguale(mondo.distanza, fotografia.distanza, 'la strada non scorre');
  assertUguale(mondo.scorrimento, fotografia.scorrimento, 'nemmeno la citta');
  assertUguale(mondo.corridore.posizione, fotografia.corsia);
  assertUguale(mondo.inseguitori.distacco, fotografia.distacco, 'e i maranza non guadagnano terreno');
  assertUguale(mondo.errori, 0, 'e nessun ostacolo arriva addosso da fermo');
});

test('la pausa non consuma i bonus', () => {
  const mondo = partitaControllata();
  mondo.scattoFinoA = mondo.tempo + DURATA_SCATTO;
  mettiInPausa(mondo);
  corri(mondo, 30);
  assertUguale(riprendi(mondo), true);
  assert(scattoAttivo(mondo), 'lo scatto era acceso quando si e messo in pausa, e lo e ancora');
});

test('si riprende da dove si era rimasti', () => {
  const mondo = partitaControllata();
  corri(mondo, 2);
  const distanza = mondo.distanza;
  mettiInPausa(mondo);
  corri(mondo, 3);
  riprendi(mondo);
  corri(mondo, 1);
  assert(mondo.distanza > distanza, 'ripreso, la strada torna a scorrere');
  assertUguale(mondo.stato, 'in-gioco');
});

test('in pausa i comandi non arrivano all omino', () => {
  const mondo = partitaControllata();
  mettiInPausa(mondo);
  assertUguale(comando(mondo, 'destra'), false);
  assertUguale(comando(mondo, 'salta'), false);
  assertUguale(mondo.corridore.bersaglio, 1);
  assertUguale(mondo.corridore.inAria, false);
});

test('si mette in pausa solo una partita in corso', () => {
  const attesa = creaMondo(390, 844);
  assertUguale(mettiInPausa(attesa), false, 'sulla schermata iniziale non c e niente da fermare');
  assertUguale(attesa.stato, 'attesa');

  const finita = partitaControllata();
  terminaPartita(finita, 'buca');
  assertUguale(mettiInPausa(finita), false, 'a partita finita nemmeno');
  assertUguale(finita.stato, 'finita');
});

test('lo stesso pulsante ferma e fa ripartire', () => {
  const mondo = partitaControllata();
  assertUguale(alternaPausa(mondo), true);
  assert(inPausa(mondo), 'primo tocco: fermo');
  assertUguale(alternaPausa(mondo), true);
  assertUguale(mondo.stato, 'in-gioco', 'secondo tocco: si riparte');
});

test('in pausa non si riavvia per sbaglio con un tocco', () => {
  const mondo = partitaControllata();
  mettiInPausa(mondo);
  assertUguale(puoRiavviare(mondo), false, 'il tocco in pausa riprende, non ricomincia da capo');
});

test('a partita finita non si fanno piu metri', () => {
  const mondo = partitaControllata();
  corri(mondo, 2);
  const distanza = mondo.distanza;
  terminaPartita(mondo, 'buca');
  corri(mondo, 2);
  assertUguale(mondo.distanza, distanza, 'da fermi non si guadagnano punti');
});

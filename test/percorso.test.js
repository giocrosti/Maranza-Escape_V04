import { test, assert, assertUguale, assertQuasi } from './mini-test.js';
import {
  creaPercorso,
  generaAvanti,
  ripulisci,
  corsieLibere,
  SPAZIO_MINIMO,
  PRIMO_OSTACOLO,
  MONETA,
  BONUS,
  MADONNINA,
  SPRITZ,
} from '../src/percorso.js';
import {
  BUCA,
  MONOPATTINO,
  corsieOstacolo,
  creaBuca,
  creaMonopattino,
  avvicinaOstacoli,
  VELOCITA_MONOPATTINO,
  DISTANZA_AVVICINAMENTO,
} from '../src/ostacoli.js';
import {
  CORSIE,
  DISTANZA_VISIBILE,
  VELOCITA_MASSIMA,
  VELOCITA_SALTO,
  GRAVITA,
  SEMI_PROFONDITA_OMINO,
} from '../src/costanti.js';
import { rngFinto } from './rng-finto.js';

/** Genera un percorso lungo `metri`, come se ci si corresse sopra davvero:
 *  la velocita' cresce, e con lei la spaziatura. */
function percorsoLungo(metri, seme = 3) {
  const rng = rngFinto(seme);
  const percorso = creaPercorso(rng);
  for (let distanza = 0; distanza < metri; distanza += 20) {
    const velocita = Math.min(VELOCITA_MASSIMA, 11 + distanza / 90);
    generaAvanti(percorso, distanza, velocita, rng);
  }
  return percorso;
}

/** Gli ostacoli raggruppati per posizione: due monopattini affiancati stanno
 *  alla stessa z e sono un ostacolo solo dal punto di vista del giocatore. */
function gruppi(percorso) {
  const per = new Map();
  for (const ostacolo of percorso.ostacoli) {
    if (!per.has(ostacolo.z)) per.set(ostacolo.z, []);
    per.get(ostacolo.z).push(ostacolo);
  }
  return [...per.entries()].sort((a, b) => a[0] - b[0]).map(([z, gruppo]) => ({ z, gruppo }));
}

test('i primi metri sono liberi: c e il tempo di capire che si sta correndo', () => {
  const percorso = percorsoLungo(200);
  const primo = gruppi(percorso)[0];
  assert(primo.z >= PRIMO_OSTACOLO, `il primo ostacolo arriva a ${primo.z.toFixed(1)} m`);
});

test('due ostacoli non si sovrappongono mai, con nessun seme', () => {
  for (const seme of [1, 7, 42, 1234, 99999]) {
    const elenco = gruppi(percorsoLungo(3000, seme));
    assert(elenco.length > 40, `solo ${elenco.length} ostacoli: il test non sta guardando niente`);
    for (let i = 1; i < elenco.length; i += 1) {
      const spazio = elenco[i].z - elenco[i - 1].z;
      assert(
        spazio >= SPAZIO_MINIMO,
        `seme ${seme}: due ostacoli a ${spazio.toFixed(1)} m, meno del minimo ${SPAZIO_MINIMO}`,
      );
    }
  }
});

test('nessun ostacolo esce dalla strada', () => {
  for (const ostacolo of percorsoLungo(3000).ostacoli) {
    assert(ostacolo.quanteCorsie >= 1, 'un ostacolo che non occupa nessuna corsia non ha senso');
    assert(ostacolo.corsiaInizio >= 0, 'comincia fuori strada a sinistra');
    assert(
      ostacolo.corsiaInizio + ostacolo.quanteCorsie <= CORSIE,
      'finisce fuori strada a destra',
    );
    assertUguale(
      corsieOstacolo(ostacolo).length,
      ostacolo.quanteCorsie,
      'le corsie dichiarate e quelle vere devono coincidere',
    );
  }
});

test('ogni buca si puo saltare, anche alla velocita massima', () => {
  // un salto sta in aria 2v/g e a quella velocita' copre questi metri
  const voloInMetri = ((2 * VELOCITA_SALTO) / GRAVITA) * VELOCITA_MASSIMA;
  for (const ostacolo of percorsoLungo(4000).ostacoli) {
    if (ostacolo.tipo !== BUCA) continue;
    const daScavalcare = ostacolo.profondita + 2 * SEMI_PROFONDITA_OMINO;
    assert(
      daScavalcare < voloInMetri * 0.75,
      `buca lunga ${ostacolo.profondita.toFixed(1)} m: troppo per un salto`,
    );
  }
});

test('due monopattini insieme lasciano sempre una corsia libera', () => {
  let coppie = 0;
  for (const { gruppo } of gruppi(percorsoLungo(4000))) {
    if (gruppo.length < 2) continue;
    assert(gruppo.every((o) => o.tipo === MONOPATTINO), 'solo i monopattini vanno in coppia');
    coppie += 1;
    assert(corsieLibere(gruppo).length >= 1, 'una coppia che chiude la strada e imbattibile');
  }
  assert(coppie > 0, 'in quattro chilometri una coppia di monopattini deve pur uscire');
});

test('la strada e generata fin dove si vede', () => {
  const rng = rngFinto(5);
  const percorso = creaPercorso(rng);
  generaAvanti(percorso, 0, 11, rng);
  assert(percorso.prossimoZ >= DISTANZA_VISIBILE, 'davanti agli occhi non devono esserci buchi');
  assert(percorso.ostacoli.length > 0, 'e nemmeno il vuoto');
});

test('quel che e alle spalle viene buttato via, quel che e davanti no', () => {
  const percorso = percorsoLungo(500);
  const davanti = percorso.ostacoli.filter((o) => o.z > 300).length;
  ripulisci(percorso, 300);
  assert(percorso.ostacoli.every((o) => o.z > 280), 'e rimasto qualcosa di gia superato');
  assertUguale(percorso.ostacoli.filter((o) => o.z > 300).length, davanti, 'non si butta il futuro');
});

test('la Madonnina e un avvenimento, non un rifornimento', () => {
  for (const seme of [3, 11, 77]) {
    const percorso = percorsoLungo(5000, seme);
    const madonnine = percorso.raccolte.filter((r) => r.tipo === MADONNINA).sort((a, b) => a.z - b.z);
    assert(madonnine.length <= 2, `${madonnine.length} Madonnine in cinque chilometri: troppe`);
    assert(madonnine.length >= 1, 'in cinque chilometri almeno una deve uscire');
    assert(madonnine[0].z > 1250, `la prima arriva gia a ${madonnine[0].z.toFixed(0)} m`);
    for (let i = 1; i < madonnine.length; i += 1) {
      assert(madonnine[i].z - madonnine[i - 1].z > 2300, 'due Madonnine troppo vicine fra loro');
    }
  }
});

test('fra due Madonnine c e uno spritz, e uno solo', () => {
  for (const seme of [3, 11, 77, 404]) {
    const percorso = percorsoLungo(6000, seme);
    const madonnine = percorso.raccolte.filter((r) => r.tipo === MADONNINA).map((r) => r.z).sort((a, b) => a - b);
    const spritz = percorso.raccolte.filter((r) => r.tipo === SPRITZ).map((r) => r.z).sort((a, b) => a - b);
    assert(spritz.length >= 1, `nessuno spritz in sei chilometri (seme ${seme})`);

    // uno prima della prima Madonnina, e poi uno per ogni intervallo
    assert(spritz[0] < madonnine[0], 'il primo spritz arriva prima della prima Madonnina');
    for (let i = 1; i < madonnine.length; i += 1) {
      const dentro = spritz.filter((z) => z > madonnine[i - 1] && z < madonnine[i]);
      assertUguale(dentro.length, 1, `fra due Madonnine ci sono ${dentro.length} spritz invece di uno`);
    }
    // e mai due di fila senza una Madonnina in mezzo
    for (let i = 1; i < spritz.length; i += 1) {
      const madonninaInMezzo = madonnine.some((z) => z > spritz[i - 1] && z < spritz[i]);
      assert(madonninaInMezzo, 'due spritz di fila senza Madonnina in mezzo');
    }
  }
});

test('piu si va avanti, meno spazio c e fra un ostacolo e l altro', () => {
  const percorso = percorsoLungo(4000);
  const elenco = gruppi(percorso);
  const distanze = [];
  for (let i = 1; i < elenco.length; i += 1) {
    distanze.push({ z: elenco[i].z, spazio: elenco[i].z - elenco[i - 1].z });
  }
  const media = (da, a) => {
    const scelte = distanze.filter((d) => d.z >= da && d.z < a);
    return scelte.reduce((somma, d) => somma + d.spazio, 0) / scelte.length;
  };
  const inizio = media(0, 500);
  const fine = media(3000, 4000);
  assert(
    fine < inizio * 0.75,
    `all inizio ${inizio.toFixed(1)} m fra gli ostacoli, alla fine ${fine.toFixed(1)}: non stringe abbastanza`,
  );
  assert(fine >= SPAZIO_MINIMO, 'ma non deve scendere sotto il minimo, o non si passerebbe');
});

test('i monopattini vengono verso di te, e nascono piu avanti per compensare', () => {
  const percorso = percorsoLungo(2000);
  const mobili = percorso.ostacoli.filter((o) => o.tipo === MONOPATTINO);
  assert(mobili.length > 5, 'servono monopattini per poter dire qualcosa');
  assert(mobili.every((o) => o.velocitaVerso > 0), 'un monopattino fermo non e piu un monopattino');

  // avvicinandosi guadagnano terreno, ma solo da vicino
  const uno = creaMonopattino(200, 1);
  avvicinaOstacoli([uno], 0, 1);
  assertUguale(uno.z, 200, 'da duecento metri sta ancora fermo');

  avvicinaOstacoli([uno], 200 - DISTANZA_AVVICINAMENTO + 1, 1);
  assertQuasi(uno.z, 200 - VELOCITA_MONOPATTINO, 1e-9, 'da vicino viene avanti');
});

test('gli ostacoli fermi restano fermi', () => {
  const buca = creaBuca(20, 1, 1, 3);
  avvicinaOstacoli([buca], 19, 5);
  assertUguale(buca.z, 20, 'una buca non ti corre incontro');
});

test('le monete ci sono, e i bonus arrivano col contagocce', () => {
  const percorso = percorsoLungo(3000);
  const monete = percorso.raccolte.filter((r) => r.tipo === MONETA).length;
  const bonus = percorso.raccolte.filter((r) => BONUS.includes(r.tipo));
  assert(monete > 100, `solo ${monete} monete in tre chilometri`);
  assert(bonus.length >= 5 && bonus.length <= 20, `${bonus.length} bonus in tre chilometri`);
  assert(
    new Set(bonus.map((b) => b.tipo)).size === BONUS.length,
    'in tre chilometri devono uscire tutti e tre i tipi di bonus',
  );
  assert(
    percorso.raccolte.every((r) => r.corsia >= 0 && r.corsia < CORSIE),
    'una moneta fuori strada non si prende',
  );
});

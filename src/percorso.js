// Il generatore della strada: decide cosa c'e' davanti.
//
// La strada non esiste tutta insieme: si crea a pezzi mano a mano che ci si
// avvicina e si butta via quel che e' rimasto indietro. Un pezzo e' un
// ostacolo (a volte due nella stessa posizione) piu' le monete che gli stanno
// intorno.
//
// La regola che tiene in piedi tutto: **un ostacolo per volta**. Due ostacoli
// non si sovrappongono mai lungo la strada, e la distanza fra uno e l'altro
// non scende mai sotto quella che serve a rimettersi in piedi dopo il primo.
// Senza, capiterebbe di atterrare da un salto dentro un lampione, e non ci
// sarebbe modo di passare.
//
// Modulo puro: prende un generatore casuale come parametro, cosi' i test
// possono farsi dare sempre lo stesso percorso.

import { CORSIE, DISTANZA_VISIBILE } from './costanti.js';
import {
  BUCA,
  AIUOLA,
  creaBuca,
  creaAiuola,
  creaMonopattino,
  creaPortale,
  creaArco,
  creaTram,
  scia,
  corsieOstacolo,
  spintaPerAvvicinamento,
} from './ostacoli.js';

export const MONETA = 'moneta';
export const SCUDO = 'scudo';
export const SCATTO = 'scatto';
export const CALAMITA = 'calamita';
export const MADONNINA = 'madonnina';
export const SPRITZ = 'spritz';

export const BONUS = [SCUDO, SCATTO, CALAMITA];

/** Ogni quanti metri, all'incirca, appare la Madonnina — e dopo quanti la
 *  prima. E' rarissima di proposito: dieci secondi di corsa indistruttibile a
 *  velocita' tripla devono restare un avvenimento, non un rifornimento. */
const METRI_FRA_LE_MADONNINE = 2430;
const PRIMA_MADONNINA = 1290;

/** Il primo ostacolo non arriva subito: i primi metri servono a capire che si
 *  sta correndo e che si puo' cambiare corsia. */
export const PRIMO_OSTACOLO = 70;

/** Distanza minima fra due ostacoli, in metri. Un salto lungo copre una
 *  ventina di metri alla velocita' massima: sotto questa soglia si
 *  atterrerebbe dentro l'ostacolo successivo, e non ci sarebbe modo di
 *  passare. E' il pavimento sotto cui la difficolta' non puo' scendere. */
export const SPAZIO_MINIMO = 30;

/** Dopo quanti metri il gioco e' alla difficolta' massima. Lungo: la corsa
 *  deve continuare a stringere per un paio di minuti buoni, non appiattirsi
 *  dopo il primo. */
const METRI_PER_DIFFICOLTA_PIENA = 2200;

/** Ogni quanti metri, all'incirca, si trova un bonus. */
const METRI_FRA_I_BONUS = 260;

/** Quanto restano indietro le cose prima di essere buttate via. Non zero:
 *  la telecamera sta qualche metro dietro l'omino e le vede ancora. */
const CODA = 14;

export function creaPercorso(rng) {
  const caso = rng || (() => 0.5);
  const primaMadonnina = PRIMA_MADONNINA + caso() * 715;
  return {
    ostacoli: [],
    raccolte: [],
    prossimoZ: PRIMO_OSTACOLO,
    prossimoBonusZ: PRIMO_OSTACOLO + 120 + caso() * 80,
    prossimaMadonninaZ: primaMadonnina,
    // Il primo spritz sta a meta' strada verso la prima Madonnina; da li' in
    // poi ce n'e' sempre uno esatto in mezzo a due Madonnine consecutive.
    prossimoSpritzZ: primaMadonnina / 2,
  };
}

/** Quanto e' avanti il gioco, da 0 (partenza) a 1 (difficolta' piena). */
export function difficoltaA(z) {
  return Math.min(1, Math.max(0, z / METRI_PER_DIFFICOLTA_PIENA));
}

/** Crea i pezzi che servono a coprire la strada visibile davanti a `distanza`. */
export function generaAvanti(percorso, distanza, velocita, rng) {
  let contatore = 0;
  while (percorso.prossimoZ < distanza + DISTANZA_VISIBILE) {
    aggiungiPezzo(percorso, velocita, rng);
    // rete di sicurezza: se un giorno la spaziatura diventasse zero per un
    // errore di calcolo, meglio un fotogramma povero che una pagina bloccata
    contatore += 1;
    if (contatore > 40) break;
  }
  return percorso;
}

/** Butta via ostacoli e monete ormai alle spalle. */
export function ripulisci(percorso, distanza) {
  const limite = distanza - CODA;
  percorso.ostacoli = percorso.ostacoli.filter(
    (o) => o.z + o.profondita / 2 + scia(o) > limite,
  );
  percorso.raccolte = percorso.raccolte.filter((r) => r.z > limite && !r.presa);
  return percorso;
}

function aggiungiPezzo(percorso, velocita, rng) {
  const z = percorso.prossimoZ;
  const difficolta = difficoltaA(z);

  const gruppo = creaOstacoli(z, rng, difficolta);

  // Chi ci verra' incontro nasce piu' avanti, di quel tanto che si mangera'
  // avvicinandosi: cosi' lo si incontra con lo stesso preavviso di un ostacolo
  // fermo, e la distanza garantita fra un ostacolo e l'altro resta vera.
  // Ogni cosa che viene incontro si mangia terreno a modo suo: il tram va piu'
  // del monopattino, quindi la spinta si calcola sulla piu' veloce del gruppo.
  const incontro = Math.max(0, ...gruppo.map((o) => o.velocitaVerso || 0));
  const spinta = incontro > 0 ? spintaPerAvvicinamento(velocita, incontro) : 0;
  for (const ostacolo of gruppo) ostacolo.z += spinta;

  percorso.ostacoli.push(...gruppo);
  aggiungiRaccolte(percorso, gruppo, rng, difficolta);

  // Piu' si corre veloce, piu' spazio serve fra un ostacolo e l'altro solo per
  // avere il tempo di vederlo — ma quel margine si assottiglia man mano che si
  // va avanti, ed e' il modo in cui il gioco stringe. All'inizio passano
  // cinque secondi buoni fra un ostacolo e l'altro, alla fine poco piu' di
  // uno: sotto non si scende, perche' sotto non si passerebbe.
  //
  // Si misura dalla **fine** del gruppo, non dalla sua z: un terzetto di tram
  // sfalsati e' lungo cinquanta metri, e contare dal primo farebbe nascere il
  // pezzo successivo dentro l'ultimo.
  const respiro = velocita * (1.25 - difficolta * 0.45);
  const fine = Math.max(...gruppo.map((o) => o.z + o.profondita / 2));
  const base = Math.max(SPAZIO_MINIMO, respiro);
  percorso.prossimoZ = fine + base + (1 - difficolta) * 18 + rng() * 10;
  return percorso;
}

/** Un ostacolo, o due monopattini affiancati quando il gioco si e' scaldato.
 *  Ritorna sempre un elenco, anche di uno solo. */
export function creaOstacoli(z, rng, difficolta) {
  const dado = rng();

  // Il tram e' l'ostacolo piu' frequente della strada: e' una via di Milano, e
  // su una via di Milano il tram passa in continuazione. Non prima che si sia
  // capito come si cambia corsia, pero' — arrivare secondi in un tram al terzo
  // ostacolo non insegna niente.
  if (dado < QUOTA_TRAM && difficolta > 0.12) return creaGruppoTram(z, rng, difficolta);

  if (dado < 0.3) {
    const quante = quanteCorsie(rng, difficolta, 0.26, 0.1);
    const inizio = Math.floor(rng() * (CORSIE - quante + 1));
    return [creaBuca(z, inizio, quante, 2.4 + rng() * 1.4 + difficolta * 0.9)];
  }

  if (dado < 0.46) {
    // Aiuola: una o due corsie, mai tutte e tre. Una fioriera larga quanto la
    // strada sarebbe un muro, e un muro non si salta.
    const quante = rng() < 0.35 + difficolta * 0.25 ? 2 : 1;
    const inizio = Math.floor(rng() * (CORSIE - quante + 1));
    return [creaAiuola(z, inizio, quante)];
  }

  if (dado < 0.7) {
    const corsia = Math.floor(rng() * CORSIE);
    // Due monopattini lasciano una corsia sola: la scelta diventa secca.
    const doppio = difficolta > 0.4 && rng() < 0.18 + difficolta * 0.22;
    if (!doppio) return [creaMonopattino(z, corsia)];
    const altra = (corsia + 1 + Math.floor(rng() * (CORSIE - 1))) % CORSIE;
    return [creaMonopattino(z, corsia), creaMonopattino(z, altra)];
  }

  // L'arco arriva di rado: e' il momento in cui la strada si stringe a una
  // corsia sola, e capita ogni una decina di ostacoli.
  if (dado > 0.93) return [creaArco(z)];



  // Il portale prende sempre tutta la strada: non ha una larghezza da tirare a
  // sorte, ed e' proprio quello che lo rende leggibile.
  return [creaPortale(z)];
}

/** Quanta parte degli ostacoli sono tram. Una manopola sola: alzarla riempie
 *  la strada di tram, abbassarla li rende un avvenimento. */
const QUOTA_TRAM = 0.45;

/** Di quanto sono sfalsati due tram consecutivi di un gruppo, in metri.
 *
 *  E' il numero che decide se un terzetto e' uno slalom o una condanna. Sotto i
 *  9,5 metri — meta' della lunghezza di un tram — il primo e il terzo si
 *  sovrappongono e chiudono due corsie mentre il secondo chiude la terza:
 *  muro. Sopra i 22 non si sovrappone piu' niente e si passa stando fermi in
 *  una corsia, che e' l'altro modo di non essere un momento di gioco. In mezzo
 *  c'e' la finestra dove ne passa uno per volta ma senza respiro, e si e'
 *  costretti a muoversi. */
function sfalsamento(rng, difficolta) {
  return 22 - difficolta * 4 - rng() * 1.5;
}

/** Le tre corsie in ordine sparso, senza ripetizioni. */
function corsieMescolate(rng) {
  const corsie = [];
  for (let c = 0; c < CORSIE; c += 1) corsie.push(c);
  for (let i = corsie.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [corsie[i], corsie[j]] = [corsie[j], corsie[i]];
  }
  return corsie;
}

/** Uno, due o tre tram. Il terzetto arriva solo a gioco caldo. */
function creaGruppoTram(z, rng, difficolta) {
  const corsie = corsieMescolate(rng);
  const dado = rng();

  if (dado < 0.5 || difficolta < 0.25) return [creaTram(z, corsie[0])];

  if (dado < 0.84 || difficolta < 0.55) {
    // Due: affiancati lasciano una corsia sola e sono una scelta secca,
    // sfalsati sono due scelte di fila.
    const scarto = rng() < 0.45 ? 0 : sfalsamento(rng, difficolta);
    return [creaTram(z, corsie[0]), creaTram(z + scarto, corsie[1])];
  }

  // Tre, sempre sfalsati: uno per corsia, e si passa in mezzo cambiando due
  // volte. Non esistono tre tram affiancati, sarebbe la fine della partita.
  const passo = sfalsamento(rng, difficolta);
  return [
    creaTram(z, corsie[0]),
    creaTram(z + passo, corsie[1]),
    creaTram(z + passo * 2, corsie[2]),
  ];
}

/** Da una a tre corsie, con la larghezza che cresce insieme alla difficolta'. */
function quanteCorsie(rng, difficolta, sogliaDue, sogliaTre) {
  let quante = 1;
  if (rng() < sogliaDue + difficolta * 0.3) quante += 1;
  if (rng() < sogliaTre + difficolta * 0.28) quante += 1;
  return Math.min(CORSIE, quante);
}

/** Le corsie che l'ostacolo lascia libere. Vuoto se occupa tutta la strada. */
export function corsieLibere(gruppo) {
  const occupate = new Set(gruppo.flatMap(corsieOstacolo));
  const libere = [];
  for (let c = 0; c < CORSIE; c += 1) if (!occupate.has(c)) libere.push(c);
  return libere;
}

function aggiungiRaccolte(percorso, gruppo, rng, difficolta) {
  const primo = gruppo[0];

  if (primo.z > percorso.prossimaMadonninaZ) {
    percorso.raccolte.push(bonusDopo(primo, gruppo, rng, MADONNINA));
    percorso.prossimaMadonninaZ = primo.z + METRI_FRA_LE_MADONNINE + rng() * 860;
    // Lo spritz cade esattamente a meta' fra questa Madonnina e la prossima:
    // e' il rifornimento di meta' viaggio, e sta li' perche' chi ha sbagliato
    // due volte sappia dove guardare.
    percorso.prossimoSpritzZ = (primo.z + percorso.prossimaMadonninaZ) / 2;
    // la Madonnina non si divide la scena con nient'altro
    return;
  }

  if (primo.z > percorso.prossimoSpritzZ) {
    percorso.raccolte.push(bonusDopo(primo, gruppo, rng, SPRITZ));
    // il prossimo lo fissera' la prossima Madonnina; intanto si mette fuori
    // portata, cosi' non ne escono due di fila
    percorso.prossimoSpritzZ = Infinity;
    return;
  }

  if (primo.z > percorso.prossimoBonusZ) {
    percorso.raccolte.push(bonusDopo(primo, gruppo, rng));
    percorso.prossimoBonusZ = primo.z + METRI_FRA_I_BONUS + rng() * 140;
    return; // un bonus da solo si vede meglio che in mezzo alle monete
  }

  // Sopra una buca o un'aiuola le monete fanno un arco: seguono il salto, e
  // prenderle tutte vuol dire aver saltato al momento giusto.
  if ((primo.tipo === BUCA || primo.tipo === AIUOLA) && rng() < 0.55) {
    percorso.raccolte.push(...arcoDiMonete(primo));
    return;
  }

  if (rng() > 0.7 + difficolta * 0.1) return; // ogni tanto niente, per respirare
  percorso.raccolte.push(...filaDiMonete(primo, gruppo, rng));
}

function corsiaLiberaOQualsiasi(gruppo, rng) {
  const libere = corsieLibere(gruppo);
  if (libere.length > 0) return libere[Math.floor(rng() * libere.length)];
  return Math.floor(rng() * CORSIE);
}

/** Monete in fila subito dopo l'ostacolo, nella corsia che l'ostacolo lascia
 *  libera: la ricompensa sta dove passa la scelta giusta. */
function filaDiMonete(ostacolo, gruppo, rng) {
  const corsia = corsiaLiberaOQualsiasi(gruppo, rng);
  const quante = 4 + Math.floor(rng() * 4);
  const inizio = ostacolo.z + ostacolo.profondita / 2 + 5;
  const monete = [];
  for (let i = 0; i < quante; i += 1) {
    monete.push(creaRaccolta(MONETA, inizio + i * 3.3, corsia, 0.85));
  }
  return monete;
}

/** Sette monete che salgono e ridiscendono sopra la buca. */
function arcoDiMonete(buca) {
  const corsia = buca.corsiaInizio + Math.floor(buca.quanteCorsie / 2);
  const meta = (buca.profondita / 2 + 2.5) * 1.5;
  const quante = 7;
  const monete = [];
  for (let i = 0; i < quante; i += 1) {
    const t = i / (quante - 1); // da 0 a 1 lungo l'arco
    const altezza = 0.85 + Math.sin(t * Math.PI) * 1;
    monete.push(creaRaccolta(MONETA, buca.z - meta + t * meta * 2, corsia, altezza));
  }
  return monete;
}

function bonusDopo(ostacolo, gruppo, rng, forzato = null) {
  const tipo = forzato || BONUS[Math.floor(rng() * BONUS.length)];
  const corsia = corsiaLiberaOQualsiasi(gruppo, rng);
  return creaRaccolta(tipo, ostacolo.z + ostacolo.profondita / 2 + 9, corsia, 1.15);
}

export function creaRaccolta(tipo, z, corsia, y) {
  return { tipo, z, corsia, y, presa: false, spostamento: 0 };
}

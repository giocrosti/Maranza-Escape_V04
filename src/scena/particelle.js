// La polvere, i detriti e le scintille.
//
// Tre scelte che tengono in piedi il modulo.
//
// **Le particelle vivono nel mondo, in metri, non sullo schermo.** Una nuvola
// di polvere alzata da un passo deve restare dove il piede l'ha alzata e
// scivolare indietro insieme all'asfalto: se vivesse in coordinate schermo
// seguirebbe l'omino come un'ombra, e invece di raccontare la corsa la
// nasconderebbe. Costa una moltiplicazione in piu' per particella, e vale ogni
// ciclo speso.
//
// **La riserva e' fissa.** Nessuna allocazione dopo l'avvio: le particelle
// esistono tutte da subito e si riciclano. Un sistema che alloca a ogni scoppio
// funziona benissimo sul computer e regala micro-scatti al telefono, sempre nel
// momento peggiore, perche' il momento in cui alloca di piu' e' quello in cui
// sta gia' succedendo tutto.
//
// **Quando finiscono, si ricicla la piu' vecchia.** Non si smette di emettere:
// il fotogramma in cui il giocatore prende una botta e' l'ultimo in cui si puo'
// accettare che l'effetto non si veda.

import { proietta, davantiAllaCamera, xDiCorsia } from '../proiezione.js';

/** Quante ne esistono in tutto. Duecentoquaranta bastano a coprire un urto
 *  mentre sono ancora per aria la polvere di tre passi. */
const RISERVA = 240;

/** Le famiglie di particelle. Ogni voce dice come nasce e come muore. */
const RICETTE = {
  passo: {
    quante: 4,
    vita: [0.34, 0.55],
    raggio: [0.1, 0.19],
    crescita: 2.2,
    velocita: { x: 0.5, y: 0.8, z: 0.7 },
    gravita: -1.1,
    attrito: 2.2,
    colore: [0.74, 0.71, 0.65],
    opacita: 0.44,
  },
  atterraggio: {
    quante: 12,
    vita: [0.4, 0.72],
    raggio: [0.08, 0.2],
    crescita: 2.4,
    // l'atterraggio spinge la polvere **in fuori**, non in su: e' l'anello che
    // si allarga a raccontare il peso
    velocita: { x: 2.4, y: 0.7, z: 1.6 },
    gravita: -1.4,
    attrito: 2.6,
    colore: [0.76, 0.73, 0.66],
    opacita: 0.46,
  },
  urto: {
    quante: 22,
    vita: [0.45, 0.9],
    raggio: [0.05, 0.14],
    crescita: 0.9,
    velocita: { x: 3.4, y: 3.2, z: 2.6 },
    gravita: -9,
    attrito: 0.9,
    colore: [0.35, 0.33, 0.3],
    opacita: 0.85,
  },
  travolto: {
    quante: 18,
    vita: [0.35, 0.7],
    raggio: [0.06, 0.16],
    crescita: 1.4,
    velocita: { x: 4.2, y: 3.6, z: 3.4 },
    gravita: -8,
    attrito: 1.1,
    colore: [0.95, 0.62, 0.3],
    opacita: 0.9,
  },
  sfiorata: {
    quante: 9,
    vita: [0.16, 0.3],
    raggio: [0.03, 0.08],
    crescita: 0.5,
    // veloci e piatte: una sfiorata e' un guizzo, non una nuvola
    velocita: { x: 3.6, y: 1.6, z: 1.2 },
    gravita: -1,
    attrito: 3.4,
    colore: [0.86, 0.94, 1.0],
    opacita: 1,
  },
  scudo: {
    quante: 14,
    vita: [0.3, 0.6],
    raggio: [0.05, 0.13],
    crescita: 1.6,
    velocita: { x: 2.6, y: 2.4, z: 2.0 },
    gravita: -4,
    attrito: 1.6,
    colore: [0.42, 0.68, 1.0],
    opacita: 0.9,
  },
};

export function creaParticelle(riserva = RISERVA) {
  const particelle = new Array(riserva);
  for (let i = 0; i < riserva; i += 1) {
    particelle[i] = {
      viva: false,
      nata: 0,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      vita: 0,
      durata: 1,
      raggio: 0.1,
      crescita: 1,
      gravita: 0,
      attrito: 1,
      colore: RICETTE.passo.colore,
      opacita: 1,
    };
  }
  return { particelle, prossima: 0, contatore: 0 };
}

/** Prende la prossima particella libera. Se sono tutte occupate ricicla, in
 *  ordine: quella che si sacrifica e' la piu' vecchia della giostra. */
function libera(sistema) {
  const { particelle } = sistema;
  for (let tentativo = 0; tentativo < particelle.length; tentativo += 1) {
    const p = particelle[sistema.prossima];
    sistema.prossima = (sistema.prossima + 1) % particelle.length;
    if (!p.viva) return p;
  }
  const p = particelle[sistema.prossima];
  sistema.prossima = (sistema.prossima + 1) % particelle.length;
  return p;
}

function fra(rng, a, b) {
  return a + rng() * (b - a);
}

/**
 * Accende una manciata di particelle.
 * @param dove  { x, y, z } in metri, con z relativa all'omino
 * @param forza da 0 a 1: scala quantita' e vivacita'
 */
export function emetti(sistema, tipo, dove, forza = 1, rng = Math.random) {
  const ricetta = RICETTE[tipo];
  if (!ricetta) return;

  const quante = Math.max(1, Math.round(ricetta.quante * (0.4 + forza * 0.6)));
  for (let i = 0; i < quante; i += 1) {
    const p = libera(sistema);
    const angolo = rng() * Math.PI * 2;
    const spinta = 0.35 + rng() * 0.65;

    p.viva = true;
    p.x = dove.x + fra(rng, -0.12, 0.12);
    p.y = (dove.y || 0) + fra(rng, 0, 0.1);
    p.z = (dove.z || 0) + fra(rng, -0.12, 0.12);
    p.vx = Math.cos(angolo) * ricetta.velocita.x * spinta * forza;
    p.vy = fra(rng, 0.3, 1) * ricetta.velocita.y * forza;
    p.vz = Math.sin(angolo) * ricetta.velocita.z * spinta * forza;
    p.durata = fra(rng, ricetta.vita[0], ricetta.vita[1]);
    p.vita = p.durata;
    p.raggio = fra(rng, ricetta.raggio[0], ricetta.raggio[1]);
    p.crescita = ricetta.crescita;
    p.gravita = ricetta.gravita;
    p.attrito = ricetta.attrito;
    p.colore = ricetta.colore;
    p.opacita = ricetta.opacita;
  }
}

/** Traduce gli eventi del mondo in emissioni. E' l'unico punto che sa che
 *  "atterraggio" vuol dire polvere: il mondo dice solo che e' atterrato. */
export function consumaEventi(sistema, mondo, rng = Math.random) {
  for (const evento of mondo.eventi) {
    if (!RICETTE[evento.tipo]) continue;
    const x = xDiCorsia(evento.corsia ?? mondo.corridore.posizione);
    // l'urto nasce all'altezza del petto, la polvere ai piedi
    const y = evento.tipo === 'urto' || evento.tipo === 'travolto' || evento.tipo === 'scudo' ? 0.9 : 0;
    emetti(sistema, evento.tipo, { x, y, z: 0 }, evento.forza ?? 1, rng);
  }
}

/** @param velocita quella di corsa: e' cio' che fa scivolare indietro il mondo. */
export function avanzaParticelle(sistema, dt, velocita) {
  if (dt <= 0) return sistema;
  let vive = 0;

  for (const p of sistema.particelle) {
    if (!p.viva) continue;

    p.vita -= dt;
    // Sotto i piedi della telecamera la proiezione esplode: una particella
    // grande dieci centimetri diventa una macchia larga mezzo schermo, e non si
    // legge piu' come polvere. Si spegne prima di arrivarci.
    if (p.vita <= 0 || p.z < -2.6) {
      p.viva = false;
      continue;
    }
    vive += 1;

    // il mondo scorre sotto: la polvere resta dov'e' e quindi si allontana
    p.z -= velocita * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;

    p.vy += p.gravita * dt;
    const freno = Math.max(0, 1 - p.attrito * dt);
    p.vx *= freno;
    p.vz *= freno;

    if (p.y < 0) {
      p.y = 0;
      p.vy = 0;
    }
  }

  sistema.contatore = vive;
  return sistema;
}

export function disegnaParticelle(ctx, vista, sistema) {
  for (const p of sistema.particelle) {
    if (!p.viva) continue;
    if (!davantiAllaCamera(p.z)) continue;

    const t = 1 - p.vita / p.durata; // 0 appena nata, 1 alla fine
    const punto = proietta(vista, p.x, p.y, p.z);
    if (punto.scala <= 0) continue;

    // Il tetto e' una rete di sicurezza, non un effetto: vicinissimo alla
    // telecamera la scala cresce senza limite, e una polvere piu' grande di
    // cosi' e' un difetto, non una nuvola.
    const raggio = Math.min(
      p.raggio * (1 + p.crescita * t) * punto.scala,
      vista.altezza * 0.026,
    );
    if (raggio < 0.4) continue;

    // svanisce sul finale, non per tutta la vita: una particella che sbiadisce
    // dal primo istante non si vede mai davvero. In piu' si spegne avvicinandosi
    // alla telecamera, cosi' non arriva mai a sbattere in faccia.
    const vicinissima = Math.min(1, Math.max(0, (p.z + 2.6) / 2.2));
    const opacita = p.opacita * Math.min(1, (1 - t) * 2.2) * vicinissima;
    const [r, g, b] = p.colore;
    ctx.fillStyle = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${opacita})`;
    ctx.beginPath();
    ctx.arc(punto.x, punto.y, raggio, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Quante ne stanno vivendo adesso: serve solo alla diagnostica. */
export function quanteVive(sistema) {
  return sistema.contatore;
}

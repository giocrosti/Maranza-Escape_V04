// Chi fa luce, in questo gioco.
//
// La richiesta era "luci puntiformi per torce, lanterne e proiettili". Qui non
// ci sono ne' torce ne' proiettili, ma ci sono le cose che fanno lo stesso
// mestiere, ed e' quello che conta:
//
//   lanterne    i lampioni del viale, fermi, caldi, che passano uno alla volta
//   proiettili  i monopattini contromano, che arrivano col faro puntato addosso
//   raccolte    monete e bonus, che si accendono da soli
//   addosso     l'aureola della Madonnina, la scia dello scatto, il lampeggiante
//               del poliziotto e quello dei maranza alle spalle
//
// Una lista sola, in coordinate di **schermo** (pixel logici) e con il raggio
// gia' in pixel: la stessa lista accende i filtri di illuminazione e disegna gli
// aloni del bloom. Averne due, una per la luce e una per il bagliore, e' il modo
// sicuro di ritrovarsi con un alone dove non c'e' nessuna luce.

import { proietta, xDiCorsia } from '../proiezione.js';
import { zRelativo, BORDO_MARCIAPIEDE } from '../citta.js';
import { DISTANZA_VISIBILE } from '../costanti.js';
import { MONETA } from '../percorso.js';
import { MONOPATTINO } from '../ostacoli.js';
import { madonninaAttiva, scattoAttivo, fuoriDallaCorsa } from '../mondo.js';
import { LUCI_MASSIME } from '../grafica/filtri/luce.js';

export const COLORI_LUCE = {
  lampione: [1.0, 0.76, 0.42],
  faro: [0.88, 0.95, 1.0],
  moneta: [1.0, 0.84, 0.34],
  bonus: [0.45, 0.78, 1.0],
  aura: [1.0, 0.87, 0.52],
  scatto: [1.0, 0.52, 0.22],
  polizia: [0.4, 0.6, 1.0],
};

/** Oltre questa distanza una luce non illumina piu' niente di leggibile: la si
 *  lascia al fondale, che la sfoca insieme a tutto il resto. */
const PORTATA = 46;

function aggiungi(elenco, p, { raggio, intensita, colore }) {
  if (!p || p.scala <= 0) return;
  elenco.push({
    x: p.x,
    y: p.y,
    raggio: raggio * p.scala,
    intensita,
    colore,
  });
}

/**
 * Le luci del fotogramma, gia' ordinate per importanza e tagliate a quante ne
 * regge il filtro.
 * @param citta  la citta' generata (per i lampioni)
 */
export function raccogliLuci(mondo, citta) {
  const vista = mondo.vista;
  const luci = [];

  // --- i lampioni: la lanterna di questo gioco ---
  for (const lampione of citta.lampioni) {
    const z = zRelativo(lampione.z, mondo.scorrimento);
    if (z > PORTATA || z < -1) continue;
    // Il palo sta a BORDO_MARCIAPIEDE + 2.4 e il braccio sporge di 1.8 verso la
    // strada: la lampada e' li', non in cima al palo.
    const testa = proietta(vista, lampione.lato * (BORDO_MARCIAPIEDE + 0.6), 6.7, z);
    // Piano: e' giorno. Un lampione che a mezzogiorno illumina come di notte
    // non fa atmosfera, fa nebbia gialla. Il raggio e' quello di un alone
    // credibile, non quello del cono di luce vero.
    aggiungi(luci, testa, {
      raggio: 3.4,
      intensita: 0.34 * (1 - z / PORTATA),
      colore: COLORI_LUCE.lampione,
    });
  }

  // --- i monopattini contromano: fari in arrivo ---
  for (const ostacolo of mondo.percorso.ostacoli) {
    if (ostacolo.tipo !== MONOPATTINO) continue;
    const z = ostacolo.z - mondo.distanza;
    if (z > 34 || z < -2) continue;
    const p = proietta(vista, xDiCorsia(ostacolo.corsiaInizio), 0.95, z);
    aggiungi(luci, p, {
      raggio: 2.6,
      intensita: 0.8,
      colore: COLORI_LUCE.faro,
    });
  }

  // --- monete e bonus ---
  for (const raccolta of mondo.percorso.raccolte) {
    if (raccolta.presa) continue;
    const z = raccolta.z - mondo.distanza;
    if (z > 26 || z < -1.5) continue;
    const p = proietta(vista, xDiCorsia(raccolta.corsia + raccolta.spostamento), raccolta.y, z);
    const moneta = raccolta.tipo === MONETA;
    aggiungi(luci, p, {
      raggio: moneta ? 1.1 : 2.2,
      intensita: moneta ? 0.35 : 0.9,
      colore: moneta ? COLORI_LUCE.moneta : COLORI_LUCE.bonus,
    });
  }

  // --- quello che sta addosso all'omino ---
  if (!fuoriDallaCorsa(mondo)) {
    const corridore = mondo.corridore;
    const suX = xDiCorsia(corridore.posizione);

    if (madonninaAttiva(mondo)) {
      aggiungi(luci, proietta(vista, suX, corridore.y + 1.1, 0), {
        raggio: 2.8,
        intensita: 1.3,
        colore: COLORI_LUCE.aura,
      });
    } else if (scattoAttivo(mondo)) {
      aggiungi(luci, proietta(vista, suX, corridore.y + 0.5, -0.6), {
        raggio: 2.4,
        intensita: 1.0,
        colore: COLORI_LUCE.scatto,
      });
    }

    if (mondo.scudo) {
      // il lampeggiante del poliziotto: acceso a intermittenza, come quello vero
      const acceso = Math.floor(mondo.tempo * 4) % 2 === 0;
      aggiungi(luci, proietta(vista, suX + 1.5, 1.9, 0), {
        raggio: 1.8,
        intensita: acceso ? 1.0 : 0.25,
        colore: COLORI_LUCE.polizia,
      });
    }
  }
  // Il riverbero rosso dei maranza addosso non sta qui: e' diventato un
  // parametro della vignetta, dove costa un passaggio invece di una luce e non
  // ruba un posto alle otto che illuminano davvero.

  // Le piu' forti per prime: quando ne restano otto devono essere le otto che
  // si notano, non le prime otto trovate.
  luci.sort((a, b) => b.intensita * b.raggio - a.intensita * a.raggio);
  return luci.slice(0, LUCI_MASSIME);
}

/** Converte le luci in coordinate di un riquadro (una tela): frazioni del
 *  riquadro, come le vogliono i filtri. */
export function luciNelRiquadro(luci, area) {
  const larghezza = Math.max(1, area.larghezza);
  const altezza = Math.max(1, area.altezza);
  return luci.map((luce) => ({
    x: (luce.x - area.x) / larghezza,
    y: (luce.y - area.y) / altezza,
    raggio: luce.raggio / larghezza,
    intensita: luce.intensita,
    colore: luce.colore,
  }));
}

/** Quanto lontano si spinge la generazione, per chi deve sapere se una luce e'
 *  ancora in scena. */
export const PORTATA_LUCI = Math.min(PORTATA, DISTANZA_VISIBILE);

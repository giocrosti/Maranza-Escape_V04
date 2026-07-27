// I monumenti, disegnati per essere riconosciuti.
//
// La differenza rispetto a un palazzo qualsiasi non e' il colore: e' che di un
// monumento si guarda la **facciata**, non il fianco. Percio' ogni monumento
// qui e' disegnato sul piano di testa — quello che guarda la telecamera mentre
// ci si corre incontro — in coordinate comode: `u` da 0 (lato strada) a 1
// (lato opposto), `v` da 0 (terra) a 1 (cima). Il fianco resta una massa
// semplice, perche' lo si vede solo mentre lo si supera.
//
// Ogni monumento e' ridotto a quel poco che lo rende inconfondibile:
//
//   Duomo             le guglie, i cinque portali, la Madonnina in cima
//   Galleria          l'arcone d'ingresso, il timpano, la volta di vetro
//   Torre Velasca     il fusto stretto e il cappello che sporge sui puntoni
//   Bosco Verticale   due torri sfalsate e gli alberi sui balconi
//   Arco della Pace   tre fornici, le colonne, la sestiga in cima
//
// Modulo puro dal punto di vista del gioco: disegna e basta, non sa niente di
// partite e di ostacoli.

import { pianoFacciata, poligonoFacciata, rettangoloFacciata, sagoma, parete } from './pennello.js';

export const MARMO = '#e4dbcb';
const MARMO_OMBRA = '#cfc4b0';
const MARMO_SCURO = '#b3a894';
const VUOTO = '#5c5749';
const ORO = '#e3c765';

/** Il fianco di un monumento: una massa piena col suo colore. Il dettaglio
 *  sta tutto sulla facciata, che e' quella che si guarda. */
export function disegnaFiancoMonumento(ctx, vista, edificio, x, zVicino, zLontano) {
  const h = edificio.altezza;
  const tinte = {
    duomo: MARMO_OMBRA,
    galleria: '#c3b8a4',
    velasca: '#96786b',
    bosco: '#6e6e6c',
  };
  sagoma(
    ctx,
    vista,
    x,
    [[zVicino, 0], [zVicino, h * 0.72], [zLontano, h * 0.72], [zLontano, 0]],
    tinte[edificio.tipo] || MARMO_OMBRA,
  );

  if (edificio.tipo === 'duomo') fiancoDuomo(ctx, vista, x, zVicino, zLontano, h);
  if (edificio.tipo === 'bosco') fiancoBosco(ctx, vista, x, zVicino, zLontano, h);
  if (edificio.tipo === 'velasca') fiancoVelasca(ctx, vista, x, zVicino, zLontano, h);
  if (edificio.tipo === 'galleria') fiancoGalleria(ctx, vista, x, zVicino, zLontano, h);
}

function fiancoDuomo(ctx, vista, x, zVicino, zLontano, h) {
  const quante = Math.max(4, Math.round((zLontano - zVicino) / 4));
  for (let i = 0; i < quante; i += 1) {
    const z = zVicino + ((zLontano - zVicino) * (i + 0.5)) / quante;
    // archi rampanti e guglie lungo il fianco
    sagoma(
      ctx,
      vista,
      x,
      [[z - 1, h * 0.72], [z - 0.45, h * 0.86 + (i % 2) * h * 0.05], [z, h * 0.72]],
      i % 2 === 0 ? MARMO : MARMO_OMBRA,
    );
    sagoma(
      ctx,
      vista,
      x,
      [[z - 0.8, h * 0.1], [z - 0.8, h * 0.42], [z - 0.35, h * 0.54], [z + 0.1, h * 0.42], [z + 0.1, h * 0.1]],
      MARMO_SCURO,
    );
  }
}

function fiancoVelasca(ctx, vista, x, zVicino, zLontano, h) {
  // anche di fianco il cappello sporge: e' quello a dire che torre e'
  sagoma(
    ctx,
    vista,
    x,
    [
      [zVicino + 2.5, h * 0.44],
      [zVicino, h * 0.54],
      [zVicino, h * 0.72],
      [zLontano, h * 0.72],
      [zLontano, h * 0.54],
      [zLontano - 2.5, h * 0.44],
    ],
    '#8b7062',
  );
}

function fiancoBosco(ctx, vista, x, zVicino, zLontano, h) {
  for (let p = 1; p < 12; p += 1) {
    const y = (h * 0.72 * p) / 12;
    sagoma(
      ctx,
      vista,
      x,
      [[zVicino, y], [zVicino, y + 0.34], [zLontano, y + 0.34], [zLontano, y]],
      '#8a8a86',
    );
  }
}

function fiancoGalleria(ctx, vista, x, zVicino, zLontano, h) {
  const volta = [];
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12;
    volta.push([zVicino + (zLontano - zVicino) * t, h * 0.72 + Math.sin(t * Math.PI) * 2.6]);
  }
  volta.push([zLontano, h * 0.72], [zVicino, h * 0.72]);
  sagoma(ctx, vista, x, volta, 'rgba(158,184,196,0.85)');
}

/** La facciata di un monumento, sul piano di testa. `xDentro` e' il lato verso
 *  la strada. */
export function disegnaFacciataMonumento(ctx, vista, edificio, z, xDentro, xFuori) {
  const punto = pianoFacciata(vista, z, xDentro, xFuori, 0, edificio.altezza);
  if (edificio.tipo === 'duomo') return facciataDuomo(ctx, punto);
  if (edificio.tipo === 'galleria') return facciataGalleria(ctx, punto);
  if (edificio.tipo === 'velasca') return facciataVelasca(ctx, punto);
  if (edificio.tipo === 'bosco') return facciataBosco(ctx, punto);
}

// --- Duomo -----------------------------------------------------------------

/** Il Duomo di Milano visto di faccia: la selva di guglie sopra, i sei
 *  contrafforti che dividono la facciata in cinque campate, i cinque portali
 *  in basso e la Madonnina in cima alla guglia maggiore. */
function facciataDuomo(ctx, punto) {
  // la selva di guglie dietro la facciata: si disegna per prima, cosi' la
  // facciata le sta davanti
  for (let i = 0; i < 15; i += 1) {
    const u = 0.03 + (i / 14) * 0.94;
    const alta = 0.72 + 0.1 * Math.abs(Math.sin(i * 2.3)) + (i % 3 === 0 ? 0.06 : 0);
    poligonoFacciata(
      ctx,
      punto,
      [[u - 0.028, 0.5], [u, alta], [u + 0.028, 0.5]],
      i % 2 === 0 ? MARMO_OMBRA : MARMO_SCURO,
    );
  }

  // corpo della facciata
  rettangoloFacciata(ctx, punto, 0, 0, 1, 0.62, MARMO);

  // le cinque campate: portale in basso, finestrone sopra
  for (let campata = 0; campata < 5; campata += 1) {
    const centro = 0.1 + campata * 0.2;
    const centrale = campata === 2;
    const mezzo = centrale ? 0.075 : 0.052;

    // portale, col suo archivolto
    rettangoloFacciata(ctx, punto, centro - mezzo, 0, centro + mezzo, centrale ? 0.2 : 0.15, VUOTO);
    poligonoFacciata(
      ctx,
      punto,
      [
        [centro - mezzo, centrale ? 0.2 : 0.15],
        [centro, centrale ? 0.27 : 0.2],
        [centro + mezzo, centrale ? 0.2 : 0.15],
      ],
      MARMO_SCURO,
    );

    // finestrone a sesto acuto
    const largo = centrale ? 0.062 : 0.045;
    poligonoFacciata(
      ctx,
      punto,
      [
        [centro - largo, 0.3],
        [centro - largo, 0.44],
        [centro, 0.53],
        [centro + largo, 0.44],
        [centro + largo, 0.3],
      ],
      VUOTO,
    );
    // il montante centrale della vetrata
    rettangoloFacciata(ctx, punto, centro - 0.005, 0.3, centro + 0.005, 0.5, MARMO_OMBRA);
  }

  // i sei contrafforti, ognuno con la sua guglia e le sue statue
  for (let i = 0; i < 6; i += 1) {
    const u = i * 0.2;
    rettangoloFacciata(ctx, punto, u - 0.022, 0, u + 0.022, 0.66, MARMO_OMBRA);
    rettangoloFacciata(ctx, punto, u - 0.026, 0.64, u + 0.026, 0.67, MARMO);
    poligonoFacciata(ctx, punto, [[u - 0.026, 0.67], [u, 0.86], [u + 0.026, 0.67]], MARMO);
    // le statue nelle nicchie
    for (const v of [0.24, 0.42]) {
      rettangoloFacciata(ctx, punto, u - 0.011, v, u + 0.011, v + 0.045, MARMO_SCURO);
    }
  }

  // il coronamento centrale, piu' alto delle campate laterali
  poligonoFacciata(
    ctx,
    punto,
    [[0.38, 0.62], [0.5, 0.74], [0.62, 0.62]],
    MARMO,
  );
  // il rosone sopra il portale maggiore
  const cerchio = [];
  for (let i = 0; i <= 14; i += 1) {
    const a = (Math.PI * 2 * i) / 14;
    cerchio.push([0.5 + Math.cos(a) * 0.03, 0.585 + Math.sin(a) * 0.035]);
  }
  poligonoFacciata(ctx, punto, cerchio, VUOTO);

  // la guglia maggiore e la Madonnina
  poligonoFacciata(ctx, punto, [[0.47, 0.74], [0.5, 0.95], [0.53, 0.74]], MARMO);
  poligonoFacciata(ctx, punto, [[0.487, 0.95], [0.5, 1.0], [0.513, 0.95]], ORO);
}

// --- Galleria Vittorio Emanuele II ----------------------------------------

/** L'ingresso della Galleria: l'arcone, le colonne binate, il timpano e,
 *  dietro, la volta di vetro con la cupola. */
function facciataGalleria(ctx, punto) {
  // la volta di vetro e la cupola, dietro la facciata
  const volta = [];
  for (let i = 0; i <= 16; i += 1) {
    const t = i / 16;
    volta.push([0.22 + t * 0.56, 0.6 + Math.sin(t * Math.PI) * 0.22]);
  }
  volta.push([0.78, 0.55], [0.22, 0.55]);
  poligonoFacciata(ctx, punto, volta, 'rgba(150,178,192,0.9)');
  const cupola = [];
  for (let i = 0; i <= 14; i += 1) {
    const a = Math.PI * (i / 14);
    cupola.push([0.5 - Math.cos(a) * 0.16, 0.74 + Math.sin(a) * 0.16]);
  }
  poligonoFacciata(ctx, punto, cupola, 'rgba(168,192,204,0.92)');

  // corpo della facciata
  rettangoloFacciata(ctx, punto, 0, 0, 1, 0.62, '#d8cdb8');

  // l'arcone d'ingresso
  const arco = [[0.28, 0]];
  for (let i = 0; i <= 16; i += 1) {
    const a = Math.PI * (i / 16);
    arco.push([0.5 - Math.cos(a) * 0.22, 0.3 + Math.sin(a) * 0.22]);
  }
  arco.push([0.72, 0]);
  poligonoFacciata(ctx, punto, arco, VUOTO);
  // la ghiera dell'arco
  const ghiera = [];
  for (let i = 0; i <= 16; i += 1) {
    const a = Math.PI * (i / 16);
    ghiera.push([0.5 - Math.cos(a) * 0.245, 0.3 + Math.sin(a) * 0.245]);
  }
  for (let i = 16; i >= 0; i -= 1) {
    const a = Math.PI * (i / 16);
    ghiera.push([0.5 - Math.cos(a) * 0.22, 0.3 + Math.sin(a) * 0.22]);
  }
  poligonoFacciata(ctx, punto, ghiera, MARMO);

  // colonne binate ai lati, con basamento e capitello
  for (const u of [0.13, 0.2, 0.8, 0.87]) {
    rettangoloFacciata(ctx, punto, u - 0.022, 0.05, u + 0.022, 0.52, MARMO);
    rettangoloFacciata(ctx, punto, u - 0.03, 0.52, u + 0.03, 0.56, MARMO_OMBRA);
    rettangoloFacciata(ctx, punto, u - 0.03, 0, u + 0.03, 0.05, MARMO_OMBRA);
    // finestre fra le colonne
  }
  for (const u of [0.165, 0.835]) {
    rettangoloFacciata(ctx, punto, u - 0.02, 0.22, u + 0.02, 0.42, VUOTO);
  }

  // trabeazione e attico
  rettangoloFacciata(ctx, punto, 0, 0.56, 1, 0.63, MARMO_OMBRA);
  rettangoloFacciata(ctx, punto, 0, 0.63, 1, 0.66, MARMO);

  // il timpano
  poligonoFacciata(ctx, punto, [[0.24, 0.66], [0.5, 0.82], [0.76, 0.66]], MARMO);
  poligonoFacciata(ctx, punto, [[0.3, 0.665], [0.5, 0.775], [0.7, 0.665]], MARMO_OMBRA);
  // le statue sugli spigoli
  for (const u of [0.24, 0.5, 0.76]) {
    rettangoloFacciata(ctx, punto, u - 0.013, u === 0.5 ? 0.82 : 0.66, u + 0.013, u === 0.5 ? 0.88 : 0.72, MARMO_SCURO);
  }
}

// --- Torre Velasca ---------------------------------------------------------

/** La Torre Velasca: fusto stretto, cappello che sporge, e i puntoni in
 *  diagonale che lo reggono. Senza i puntoni e' un palazzo qualunque. */
function facciataVelasca(ctx, punto) {
  const CEMENTO = '#a8887a';
  const CEMENTO_OMBRA = '#8d7063';
  const FINESTRA = '#4e4a4a';

  // fusto
  rettangoloFacciata(ctx, punto, 0.2, 0, 0.8, 0.6, CEMENTO);

  // i puntoni: cinque per lato, in diagonale
  for (let i = 0; i < 5; i += 1) {
    const t = i / 4;
    poligonoFacciata(
      ctx,
      punto,
      [
        [0.2, 0.5 + t * 0.055],
        [0.2 - t * 0.2, 0.64 + t * 0.02],
        [0.2 - t * 0.2 + 0.03, 0.66 + t * 0.02],
        [0.2 + 0.03, 0.5 + t * 0.055],
      ],
      CEMENTO_OMBRA,
    );
    poligonoFacciata(
      ctx,
      punto,
      [
        [0.8, 0.5 + t * 0.055],
        [0.8 + t * 0.2, 0.64 + t * 0.02],
        [0.8 + t * 0.2 - 0.03, 0.66 + t * 0.02],
        [0.8 - 0.03, 0.5 + t * 0.055],
      ],
      CEMENTO_OMBRA,
    );
  }

  // il cappello, piu' largo del fusto
  rettangoloFacciata(ctx, punto, 0, 0.66, 1, 0.97, CEMENTO);
  rettangoloFacciata(ctx, punto, 0, 0.97, 1, 1, CEMENTO_OMBRA);

  // finestre: sul fusto una griglia fitta, sul cappello piu' larghe e
  // irregolari, come sono davvero
  for (let piano = 0; piano < 11; piano += 1) {
    const v = 0.04 + piano * 0.05;
    for (let c = 0; c < 5; c += 1) {
      if ((piano * 7 + c * 3) % 11 === 0) continue;
      const u = 0.26 + c * 0.12;
      rettangoloFacciata(ctx, punto, u, v, u + 0.075, v + 0.03, FINESTRA);
    }
  }
  for (let piano = 0; piano < 5; piano += 1) {
    const v = 0.7 + piano * 0.055;
    for (let c = 0; c < 7; c += 1) {
      if ((piano * 5 + c * 2) % 9 === 0) continue;
      const u = 0.05 + c * 0.135;
      rettangoloFacciata(ctx, punto, u, v, u + 0.09, v + 0.032, FINESTRA);
    }
  }
}

// --- Bosco Verticale -------------------------------------------------------

/** Le due torri del Bosco Verticale: sfalsate in altezza, i solai dei balconi
 *  che sporgono a quote diverse e gli alberi che debordano dai bordi. */
function facciataBosco(ctx, punto) {
  const CEMENTO = '#7c7c79';
  const SOLAIO = '#9a9a95';
  const VETRO = '#4a5560';
  const VERDI = ['#4e7a45', '#5f8c4e', '#3f6a3a'];

  const torri = [
    { da: 0.0, a: 0.44, cima: 1 },
    { da: 0.56, a: 1.0, cima: 0.72 },
  ];

  for (const [indice, torre] of torri.entries()) {
    rettangoloFacciata(ctx, punto, torre.da, 0, torre.a, torre.cima, CEMENTO);

    const piani = Math.round(torre.cima / 0.055);
    for (let p = 1; p <= piani; p += 1) {
      const v = (torre.cima * p) / (piani + 1);
      // il solaio sporge dal filo della torre: e' il balcone
      const sporgenza = (p + indice) % 2 === 0 ? 0.035 : 0.015;
      rettangoloFacciata(ctx, punto, torre.da - sporgenza, v, torre.a + sporgenza, v + 0.012, SOLAIO);
      // la fascia vetrata sotto il solaio
      rettangoloFacciata(ctx, punto, torre.da + 0.02, v - 0.03, torre.a - 0.02, v - 0.004, VETRO);

      // gli alberi, non su tutti i balconi e non sempre nello stesso punto
      for (let i = 0; i < 3; i += 1) {
        if ((p * 5 + i * 3 + indice) % 4 === 0) continue;
        const u = torre.da + ((torre.a - torre.da) * (i + 0.5)) / 3 + ((p % 3) - 1) * 0.02;
        const raggio = 0.035 + ((p + i) % 3) * 0.012;
        const foglie = [];
        for (let k = 0; k <= 8; k += 1) {
          const a = (Math.PI * 2 * k) / 8;
          const r = raggio * (0.8 + 0.2 * ((k * 3) % 4) / 3);
          foglie.push([u + Math.cos(a) * r, v + 0.012 + raggio * 0.9 + Math.sin(a) * r * 1.1]);
        }
        poligonoFacciata(ctx, punto, foglie, VERDI[(p + i) % VERDI.length]);
      }
    }
  }
}

// --- Arco della Pace -------------------------------------------------------

/** L'Arco della Pace scavalca la strada, e ci si passa sotto correndo.
 *  Ha tre fornici — quello grande in mezzo e due piccoli ai lati — le colonne
 *  corinzie, l'attico con l'iscrizione e in cima la Sestiga della Pace con le
 *  quattro Vittorie a cavallo agli angoli. */
export function disegnaArco(ctx, vista, arco, z, semiLarghezza) {
  const h = arco.altezza;
  const spessore = arco.profondita;
  const zTesta = z - spessore / 2;
  const zFondo = z + spessore / 2;

  // i due piloni, in volume: fianco interno e testa
  for (const lato of [-1, 1]) {
    const dentro = lato * (semiLarghezza - 2.1);
    ctx.fillStyle = MARMO_OMBRA;
    parete(ctx, vista, dentro, 0, h * 0.68, Math.max(zTesta, -3), zFondo);
  }
  // il cielo dell'arcata
  ctx.fillStyle = MARMO_SCURO;
  parete(ctx, vista, 0, h * 0.62, h * 0.68, Math.max(zTesta, -3), zFondo);

  if (zTesta <= 0.4) return;

  const punto = pianoFacciata(vista, zTesta, -semiLarghezza, semiLarghezza, 0, h);

  // Il fronte con i tre fornici. I fornici sono **buchi veri**: si vede la
  // strada attraverso. Si ottengono disegnando il rettangolo esterno e i tre
  // archi in un percorso solo, riempito con la regola pari-dispari, che lascia
  // vuoto quel che sta dentro un numero dispari di contorni.
  const fornici = [
    fornice(0.5, 0.145, 0.34),
    fornice(0.185, 0.062, 0.22),
    fornice(0.815, 0.062, 0.22),
  ];
  facciataForata(ctx, punto, [[0, 0], [1, 0], [1, 0.68], [0, 0.68]], fornici, MARMO);

  // la ghiera attorno a ogni fornice
  for (const [centro, raggio, imposta] of [[0.5, 0.145, 0.34], [0.185, 0.062, 0.22], [0.815, 0.062, 0.22]]) {
    const ghiera = [];
    for (let i = 0; i <= 18; i += 1) {
      const a = Math.PI * (i / 18);
      ghiera.push([centro - Math.cos(a) * (raggio + 0.02), imposta + Math.sin(a) * (raggio + 0.02)]);
    }
    for (let i = 18; i >= 0; i -= 1) {
      const a = Math.PI * (i / 18);
      ghiera.push([centro - Math.cos(a) * raggio, imposta + Math.sin(a) * raggio]);
    }
    poligonoFacciata(ctx, punto, ghiera, MARMO_OMBRA);
  }

  // le quattro colonne corinzie
  for (const u of [0.29, 0.4, 0.6, 0.71]) {
    rettangoloFacciata(ctx, punto, u - 0.016, 0.03, u + 0.016, 0.56, MARMO_OMBRA);
    rettangoloFacciata(ctx, punto, u - 0.022, 0.56, u + 0.022, 0.6, MARMO_SCURO);
    rettangoloFacciata(ctx, punto, u - 0.022, 0, u + 0.022, 0.03, MARMO_SCURO);
  }

  // i bassorilievi negli spazi fra gli archi
  for (const u of [0.32, 0.68]) {
    rettangoloFacciata(ctx, punto, u - 0.03, 0.46, u + 0.03, 0.53, MARMO_SCURO);
  }

  // trabeazione e attico con l'iscrizione
  rettangoloFacciata(ctx, punto, 0, 0.6, 1, 0.65, MARMO_OMBRA);
  rettangoloFacciata(ctx, punto, 0, 0.65, 1, 0.88, MARMO);
  rettangoloFacciata(ctx, punto, 0.22, 0.71, 0.78, 0.8, MARMO_SCURO);

  // la Sestiga della Pace: sei cavalli e il carro
  const carro = 0.88;
  for (let i = 0; i < 6; i += 1) {
    const u = 0.4 + i * 0.035;
    rettangoloFacciata(ctx, punto, u, carro, u + 0.022, carro + 0.055, '#6f6a5c');
    rettangoloFacciata(ctx, punto, u + 0.004, carro + 0.055, u + 0.018, carro + 0.075, '#6f6a5c');
  }
  rettangoloFacciata(ctx, punto, 0.34, carro, 0.4, carro + 0.075, '#5f5a4e');
  rettangoloFacciata(ctx, punto, 0.355, carro + 0.075, 0.375, carro + 0.11, '#5f5a4e');

  // le quattro Vittorie a cavallo, agli angoli dell'attico
  for (const u of [0.06, 0.2, 0.8, 0.94]) {
    rettangoloFacciata(ctx, punto, u - 0.025, 0.88, u + 0.025, 0.93, '#6f6a5c');
    rettangoloFacciata(ctx, punto, u - 0.008, 0.93, u + 0.008, 0.97, '#6f6a5c');
  }
}

/** Il contorno di un fornice: due piedritti e l'arco a tutto sesto. */
function fornice(centro, raggio, imposta) {
  const punti = [[centro - raggio, 0]];
  for (let i = 0; i <= 18; i += 1) {
    const a = Math.PI * (i / 18);
    punti.push([centro - Math.cos(a) * raggio, imposta + Math.sin(a) * raggio]);
  }
  punti.push([centro + raggio, 0]);
  return punti;
}

/** Una facciata con dei buchi veri: si disegna il contorno esterno e i buchi
 *  in un percorso solo, e si riempie con la regola pari-dispari. Attraverso i
 *  buchi si vede quello che era gia' stato disegnato — cioe' la strada. */
function facciataForata(ctx, punto, contorno, buchi, colore) {
  ctx.beginPath();
  traccia(ctx, punto, contorno);
  for (const buco of buchi) traccia(ctx, punto, buco);
  ctx.fillStyle = colore;
  ctx.fill('evenodd');
}

function traccia(ctx, punto, punti) {
  punti.forEach(([u, v], i) => {
    const p = punto(u, v);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
}

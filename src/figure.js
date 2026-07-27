// Le persone e i monopattini.
//
// Tutto qui dentro si disegna **in metri**, con l'origine fra i piedi e l'asse
// y verso l'alto: ci pensa `conFigura` a piazzare l'origine e a ribaltare
// l'asse. Cosi' una persona e' alta 1,75 e un monopattino 1,05, e non bisogna
// mai chiedersi a quanti pixel corrispondano.
//
// Ci sono due punti di vista, e sono due disegni diversi, non lo stesso girato:
//
// - **di spalle**, per chi corre davanti a noi (l'omino bianco, i maranza che
//   inseguono, quello sul monopattino). Di spalle non si vede la faccia, e la
//   corsa si legge dal tallone che si alza e dalla bracciata che esce di lato;
// - **di fronte**, per il branco fermo sulla schermata iniziale. Li' servono
//   la faccia, la visiera del cappello puntata addosso e l'arma in mano.

import { riquadroTondo, scurisci } from './pennello.js';

const COLTELLO = '#ccd3dc';
const MANICO = '#1a1c20';
const BOTTIGLIA = 'rgba(104,150,96,0.85)';
const BOTTIGLIA_ORLO = '#c8ddc0';

/** I colori dei cappellini: quattro tinte diverse, cosi' nel branco non
 *  sembrano quattro copie della stessa persona. */
export const CAPPELLI = ['#d8483c', '#e8e4dc', '#3f6bb0', '#e0a92c'];

/** Sposta l'origine ai piedi del personaggio e mette l'asse y verso l'alto,
 *  con l'unita' uguale a un metro. */
export function conFigura(ctx, x, y, scala, disegna) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scala, -scala);
  disegna();
  ctx.restore();
}

// --- di spalle -------------------------------------------------------------

/** Una persona vista di spalle che corre, alta 1,75 m.
 *
 *  Da dietro una corsa non si legge come di profilo: le gambe non si aprono
 *  avanti e indietro sullo schermo, perche' quel movimento va nella direzione
 *  in cui si guarda. Quello che si vede davvero e', in ordine di evidenza:
 *
 *  1. il **tallone che si alza dietro**, con la pianta della scarpa che
 *     lampeggia a ogni passo;
 *  2. il **sobbalzo del busto**, due volte per falcata;
 *  3. le **braccia che escono di lato** quando vanno indietro e spariscono
 *     dietro il fianco quando vanno avanti;
 *  4. una leggera **torsione** delle spalle, contraria a quella del bacino.
 *
 *  Le braccia si disegnano **prima** del busto proprio perche' quella che va
 *  avanti debba finirci dietro. */
export function disegnaFigura(ctx, opzioni) {
  const {
    colore,
    luce,
    fase = 0,
    posa = 'corsa',
    coltello = false,
    cappello = null,
    borsello = null,
    banda = null,
    base = 0,
  } = opzioni;

  ctx.save();
  ctx.translate(0, base);

  if (posa === 'scivolata') {
    disegnaAccosciato(ctx, colore, luce, cappello);
    ctx.restore();
    return;
  }

  if (posa === 'seduto') {
    disegnaSeduto(ctx, colore, luce, cappello);
    ctx.restore();
    return;
  }

  const destro = Math.sin(fase);
  const sinistro = Math.sin(fase + Math.PI);
  const corsa = posa === 'corsa';
  const sobbalzo = corsa ? Math.abs(Math.cos(fase)) * 0.06 : 0;
  const anca = 0.86 + sobbalzo;
  const spalla = 1.4 + sobbalzo;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. gambe
  ctx.strokeStyle = colore;
  ctx.lineWidth = 0.17;
  if (posa === 'salto') {
    gambaInVolo(ctx, -1, destro, anca);
    gambaInVolo(ctx, 1, sinistro, anca);
  } else if (posa === 'monopattino') {
    for (const segno of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(segno * 0.1, anca);
      ctx.lineTo(segno * 0.13, anca * 0.5);
      ctx.lineTo(segno * 0.15, 0);
      ctx.stroke();
    }
  } else {
    gambaDiCorsa(ctx, -1, destro, anca, colore, luce);
    gambaDiCorsa(ctx, 1, sinistro, anca, colore, luce);
  }

  // 4. torsione: il busto si gira appena, al contrario del passo. Appena: di
  // piu' e sembra che stia per cadere di lato invece di correre.
  if (corsa) ctx.rotate(destro * 0.02);

  // 3. braccia, prima del busto: quella che va avanti deve finirci dietro
  ctx.strokeStyle = colore;
  ctx.lineWidth = 0.13;
  if (posa === 'monopattino') {
    for (const segno of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(segno * 0.22, spalla);
      ctx.lineTo(segno * 0.34, spalla - 0.18);
      ctx.lineTo(segno * 0.4, spalla - 0.34);
      ctx.stroke();
    }
  } else {
    braccio(ctx, -1, sinistro, spalla, anca, colore, coltello);
    braccio(ctx, 1, destro, spalla, anca, colore, coltello);
  }

  // 2. busto
  ctx.fillStyle = colore;
  riquadroTondo(ctx, -0.25, anca - 0.06, 0.5, spalla - anca + 0.22, 0.17);
  ctx.fill();
  ctx.fillStyle = luce;
  riquadroTondo(ctx, -0.25, spalla - 0.12, 0.5, 0.16, 0.07);
  ctx.fill();

  // la banda rifrangente sulla schiena, per chi la divisa ce l'ha
  if (banda) {
    ctx.fillStyle = banda;
    riquadroTondo(ctx, -0.25, anca + 0.28, 0.5, 0.11, 0.04);
    ctx.fill();
  }

  if (borsello) borselloDiSpalle(ctx, spalla, anca, borsello);

  // collo e testa
  ctx.fillStyle = colore;
  ctx.beginPath();
  ctx.arc(0, spalla + 0.25, 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = luce;
  ctx.beginPath();
  ctx.arc(-0.05, spalla + 0.3, 0.09, 0, Math.PI * 2);
  ctx.fill();

  if (cappello) cappelloDiSpalle(ctx, spalla + 0.25, cappello);

  ctx.restore();
}

/** Il cappellino visto da dietro: la calotta, la fascia di chiusura e i due
 *  spigoli della visiera che spuntano ai lati della testa. E' quel poco che si
 *  vede, ed e' abbastanza perche' si capisca che ce l'ha. */
function cappelloDiSpalle(ctx, yTesta, colore) {
  ctx.fillStyle = colore;
  ctx.beginPath();
  ctx.arc(0, yTesta + 0.02, 0.195, 0, Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, yTesta + 0.02, 0.195, 0.07, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // gli angoli della visiera, che punta dall'altra parte
  ctx.beginPath();
  ctx.ellipse(0, yTesta + 0.03, 0.235, 0.05, 0, Math.PI * 0.08, Math.PI * 0.92);
  ctx.fill();

  // la fascetta di regolazione dietro
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.fillRect(-0.05, yTesta - 0.03, 0.1, 0.05);
}

/** La tracolla del borsello che attraversa la schiena, e la borsa sul fianco.
 *  Da dietro e' la diagonale a raccontarlo. */
function borselloDiSpalle(ctx, spalla, anca, colore) {
  ctx.strokeStyle = colore;
  ctx.lineWidth = 0.075;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(0.23, spalla - 0.02);
  ctx.lineTo(-0.2, anca + 0.06);
  ctx.stroke();
  ctx.lineCap = 'round';

  ctx.fillStyle = colore;
  riquadroTondo(ctx, -0.31, anca - 0.04, 0.2, 0.19, 0.05);
  ctx.fill();
}

/** Una gamba durante la corsa. `p` va da -1 (portata avanti, quasi nascosta
 *  dal corpo) a +1 (spinta indietro, tallone in alto). */
function gambaDiCorsa(ctx, segno, p, anca, colore, luce) {
  const dietro = Math.max(0, p);
  const avanti = Math.max(0, -p);
  const piedeY = dietro * dietro * 0.55;
  const piedeX = segno * (0.1 + dietro * 0.12);
  const ginocchioX = segno * (0.12 + avanti * 0.05);
  const ginocchioY = anca * 0.5 + dietro * 0.12 + avanti * 0.14;

  ctx.strokeStyle = colore;
  ctx.beginPath();
  ctx.moveTo(segno * 0.11, anca);
  ctx.lineTo(ginocchioX, ginocchioY);
  ctx.lineTo(piedeX, piedeY);
  ctx.stroke();

  // la pianta della scarpa: da dietro e' il segnale piu' forte della corsa
  if (dietro > 0.25) {
    ctx.fillStyle = luce;
    ctx.beginPath();
    ctx.ellipse(piedeX, piedeY, 0.105, 0.06, segno * -0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** In aria le gambe si raccolgono: e' quello che fa capire, in un fotogramma,
 *  che si sta scavalcando qualcosa e non correndo. */
function gambaInVolo(ctx, segno, p, anca) {
  ctx.beginPath();
  ctx.moveTo(segno * 0.11, anca);
  ctx.lineTo(segno * (0.2 + p * 0.06), anca * 0.62);
  ctx.lineTo(segno * (0.13 + p * 0.1), 0.34 + Math.abs(p) * 0.14);
  ctx.stroke();
}

function braccio(ctx, segno, p, spalla, anca, colore, coltello) {
  const indietro = Math.max(0, p);
  const avanti = Math.max(0, -p);
  // Il braccio che va indietro esce bene di lato: e' l'unico dei due che si
  // vede, perche' l'altro finisce dietro il busto, ed e' quindi lui a dover
  // raccontare la bracciata.
  const manoX = segno * (0.3 + indietro * 0.16 - avanti * 0.08);
  const manoY = anca + 0.14 + indietro * 0.2 - avanti * 0.08;
  const gomitoX = segno * (0.32 + indietro * 0.08);
  const gomitoY = (spalla + manoY) / 2 + 0.04;

  ctx.strokeStyle = colore;
  ctx.beginPath();
  ctx.moveTo(segno * 0.22, spalla);
  ctx.lineTo(gomitoX, gomitoY);
  ctx.lineTo(manoX, manoY);
  ctx.stroke();

  if (!coltello || segno !== 1) return;
  ctx.save();
  ctx.translate(manoX, manoY);
  ctx.rotate(-0.6 + p * 0.35);
  ctx.fillStyle = COLTELLO;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0.07, 0.42);
  ctx.lineTo(0, 0.5);
  ctx.lineTo(-0.07, 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** La scivolata: non e' la figura in piedi schiacciata, e' un'altra posa.
 *  Schiacciandola verrebbe una testa ovale e le braccia spalancate, e da
 *  dietro non si capirebbe cosa sta succedendo. Alta in tutto 0,8 m, come dice
 *  ALTEZZA_OMINO_ABBASSATO. */
function disegnaAccosciato(ctx, colore, luce, cappello) {
  ctx.strokeStyle = colore;
  ctx.lineCap = 'round';

  ctx.lineWidth = 0.17;
  for (const segno of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(segno * 0.1, 0.26);
    ctx.lineTo(segno * 0.34, 0.4);
    ctx.stroke();
  }

  ctx.fillStyle = colore;
  riquadroTondo(ctx, -0.26, 0.2, 0.52, 0.36, 0.14);
  ctx.fill();
  ctx.fillStyle = luce;
  riquadroTondo(ctx, -0.26, 0.44, 0.52, 0.13, 0.06);
  ctx.fill();

  ctx.strokeStyle = colore;
  ctx.lineWidth = 0.12;
  for (const segno of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(segno * 0.24, 0.5);
    ctx.lineTo(segno * 0.34, 0.28);
    ctx.stroke();
  }

  ctx.fillStyle = colore;
  ctx.beginPath();
  ctx.arc(0, 0.65, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = luce;
  ctx.beginPath();
  ctx.arc(-0.04, 0.69, 0.08, 0, Math.PI * 2);
  ctx.fill();

  if (cappello) cappelloDiSpalle(ctx, 0.65, cappello);
}

/** Seduto: busto, braccia in avanti sul volante e testa. Le gambe non si
 *  disegnano perche' stanno dentro la macchinina, e da dietro non si vedono.
 *  L'origine e' il sedile, non il suolo: la mette a posto chi chiama. */
function disegnaSeduto(ctx, colore, luce, cappello) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const spalla = 0.54;

  // braccia tese avanti, verso il volante
  ctx.strokeStyle = colore;
  ctx.lineWidth = 0.13;
  for (const segno of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(segno * 0.22, spalla);
    ctx.lineTo(segno * 0.3, spalla - 0.16);
    ctx.lineTo(segno * 0.26, spalla - 0.3);
    ctx.stroke();
  }

  ctx.fillStyle = colore;
  riquadroTondo(ctx, -0.25, 0, 0.5, spalla + 0.22, 0.17);
  ctx.fill();
  ctx.fillStyle = luce;
  riquadroTondo(ctx, -0.25, spalla - 0.12, 0.5, 0.16, 0.07);
  ctx.fill();

  ctx.fillStyle = colore;
  ctx.beginPath();
  ctx.arc(0, spalla + 0.25, 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = luce;
  ctx.beginPath();
  ctx.arc(-0.05, spalla + 0.3, 0.09, 0, Math.PI * 2);
  ctx.fill();

  if (cappello) cappelloDiSpalle(ctx, spalla + 0.25, cappello);
}

/** La macchinina rossa dello scatto, vista di spalle: un giocattolo a pedali,
 *  con le ruote che sporgono ai lati, il musetto tondo e l'alettone. L'origine
 *  e' a terra, in mezzo alle ruote.
 *
 *  Il posto di guida sta a 0,42 m: e' li' che va messo il busto di chi ci sale,
 *  ed e' la ragione per cui la posa 'seduto' parte dal sedile e non dai piedi. */
export const SEDILE_MACCHININA = 0.42;

export function disegnaMacchinina(ctx, { corpo = '#d8342c', tempo = 0 } = {}) {
  const sobbalzo = Math.sin(tempo * 22) * 0.012;

  ctx.save();
  ctx.translate(0, sobbalzo);

  // ruote, grosse e sporgenti come su un giocattolo
  ctx.fillStyle = '#1b1d21';
  for (const segno of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(segno * 0.6, 0.16, 0.14, 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9ccd1';
    ctx.beginPath();
    ctx.ellipse(segno * 0.6, 0.16, 0.06, 0.075, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1d21';
  }

  // scocca, larga abbastanza da contenere chi ci sta dentro
  ctx.fillStyle = corpo;
  riquadroTondo(ctx, -0.56, 0.1, 1.12, 0.44, 0.13);
  ctx.fill();
  // il bordo dell'abitacolo, piu' stretto
  riquadroTondo(ctx, -0.4, 0.44, 0.8, 0.14, 0.06);
  ctx.fill();

  // paraurti e fanali posteriori
  ctx.fillStyle = '#f0f2f5';
  riquadroTondo(ctx, -0.52, 0.12, 1.04, 0.07, 0.03);
  ctx.fill();
  ctx.fillStyle = '#ffd24a';
  for (const segno of [-1, 1]) {
    riquadroTondo(ctx, segno * 0.4 - 0.07, 0.31, 0.14, 0.09, 0.03);
    ctx.fill();
  }

  // l'abitacolo scuro dove sta seduto
  ctx.fillStyle = 'rgba(30,32,38,0.55)';
  riquadroTondo(ctx, -0.32, 0.42, 0.64, 0.13, 0.05);
  ctx.fill();

  // alettone da macchinina
  ctx.fillStyle = corpo;
  riquadroTondo(ctx, -0.42, 0.58, 0.84, 0.06, 0.025);
  ctx.fill();
  for (const segno of [-1, 1]) {
    ctx.fillRect(segno * 0.3 - 0.025, 0.52, 0.05, 0.08);
  }

  ctx.restore();
}

/** La Madonnina, alta un metro con l'origine ai piedi. E' la statua in cima
 *  alla guglia maggiore del Duomo: veste dorata, braccia aperte e la corona di
 *  stelle intorno al capo. Chi la disegna la scala a quel che gli serve — un
 *  ciondolo da raccogliere o un'apparizione alta mezzo schermo. */
export function disegnaMadonnina(ctx, { tempo = 0 } = {}) {
  const ORO = '#e6c150';
  const ORO_CHIARO = '#f7e296';
  const ORO_SCURO = '#b3892a';

  // la veste, che si allarga verso il basso
  ctx.fillStyle = ORO;
  ctx.beginPath();
  ctx.moveTo(-0.2, 0);
  ctx.lineTo(-0.09, 0.5);
  ctx.lineTo(-0.075, 0.66);
  ctx.lineTo(0.075, 0.66);
  ctx.lineTo(0.09, 0.5);
  ctx.lineTo(0.2, 0);
  ctx.closePath();
  ctx.fill();

  // le pieghe del manto
  ctx.strokeStyle = ORO_SCURO;
  ctx.lineWidth = 0.016;
  for (const segno of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.moveTo(segno * 0.03, 0.6);
    ctx.lineTo(segno * 0.1, 0.02);
    ctx.stroke();
  }

  // le braccia aperte, un po' abbassate
  ctx.strokeStyle = ORO;
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.055;
  for (const segno of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(segno * 0.06, 0.63);
    ctx.lineTo(segno * 0.17, 0.56);
    ctx.lineTo(segno * 0.27, 0.5);
    ctx.stroke();
  }

  // Il velo prima, la faccia dentro: il velo scende sulle spalle e incornicia
  // il viso, non ci sta appoggiato sopra come un cappello.
  ctx.fillStyle = ORO;
  ctx.beginPath();
  ctx.moveTo(-0.075, 0.63);
  ctx.quadraticCurveTo(-0.105, 0.78, 0, 0.815);
  ctx.quadraticCurveTo(0.105, 0.78, 0.075, 0.63);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = ORO_CHIARO;
  ctx.beginPath();
  ctx.ellipse(0, 0.735, 0.045, 0.055, 0, 0, Math.PI * 2);
  ctx.fill();

  // la corona di stelle, che gira piano
  ctx.fillStyle = ORO_CHIARO;
  for (let i = 0; i < 7; i += 1) {
    const angolo = Math.PI * (0.12 + (i / 6) * 0.76) + Math.sin(tempo * 0.6) * 0.04;
    stella(ctx, Math.cos(angolo) * 0.13, 0.78 + Math.sin(angolo) * 0.11, 0.022);
  }

  // il parafulmine sopra la statua, che nelle foto c'e' sempre
  ctx.strokeStyle = ORO_SCURO;
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  ctx.moveTo(0, 0.84);
  ctx.lineTo(0, 1);
  ctx.stroke();
}

function stella(ctx, cx, cy, raggio) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angolo = (Math.PI * i) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? raggio : raggio * 0.42;
    const x = cx + Math.cos(angolo) * r;
    const y = cy + Math.sin(angolo) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

// --- di fronte -------------------------------------------------------------

export const COLTELLO_IN_MANO = 'coltello';
export const BOTTIGLIA_ROTTA = 'bottiglia';

/** Un maranza visto di fronte, fermo, che ti guarda male. Alto 1,75 m.
 *
 *  Di fronte servono cose che di spalle non esistono: la visiera del
 *  cappellino puntata addosso, gli occhi, la tracolla del borsello sul petto e
 *  l'arma tenuta bene in vista. E' la figura della schermata iniziale, quella
 *  che deve dire in un colpo d'occhio da chi si sta scappando. */
export function disegnaMaranzaDiFronte(ctx, opzioni) {
  const {
    colore = '#24262c',
    luce = '#474c56',
    cappello = CAPPELLI[0],
    borsello = '#8a8f98',
    arma = COLTELLO_IN_MANO,
    verso = 1, // da che parte tiene l'arma
    dondolo = 0, // oscillazione lenta, perche' non sembrino statue
  } = opzioni;

  ctx.save();
  ctx.rotate(dondolo * 0.012);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const anca = 0.86;
  const spalla = 1.42;

  // gambe piantate, un po' larghe
  ctx.strokeStyle = colore;
  ctx.lineWidth = 0.19;
  for (const segno of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(segno * 0.12, anca);
    ctx.lineTo(segno * 0.16, anca * 0.5);
    ctx.lineTo(segno * 0.19, 0.05);
    ctx.stroke();
  }
  // la banda della tuta lungo la gamba
  ctx.strokeStyle = luce;
  ctx.lineWidth = 0.035;
  for (const segno of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(segno * 0.2, anca - 0.04);
    ctx.lineTo(segno * 0.26, 0.12);
    ctx.stroke();
  }

  // scarpe grosse
  ctx.fillStyle = luce;
  for (const segno of [-1, 1]) {
    riquadroTondo(ctx, segno * 0.19 - 0.11, 0, 0.22, 0.1, 0.04);
    ctx.fill();
  }

  // busto: felpa larga
  ctx.fillStyle = colore;
  riquadroTondo(ctx, -0.29, anca - 0.1, 0.58, spalla - anca + 0.24, 0.14);
  ctx.fill();

  // Braccia: una lungo il fianco, l'altra piegata con l'arma in vista. Tenute
  // strette al corpo: braccia spalancate allargano troppo la figura, e in un
  // capannello di quattro si finisce per non distinguere piu' chi e' chi.
  ctx.strokeStyle = colore;
  ctx.lineWidth = 0.15;
  const giu = -verso;
  ctx.beginPath();
  ctx.moveTo(giu * 0.25, spalla);
  ctx.lineTo(giu * 0.3, spalla - 0.3);
  ctx.lineTo(giu * 0.28, spalla - 0.56);
  ctx.stroke();

  const manoX = verso * 0.31;
  const manoY = spalla - 0.24;
  ctx.beginPath();
  ctx.moveTo(verso * 0.25, spalla);
  ctx.lineTo(verso * 0.34, spalla - 0.16);
  ctx.lineTo(manoX, manoY);
  ctx.stroke();

  // la tracolla sul petto e il borsello sul fianco
  ctx.strokeStyle = borsello;
  ctx.lineWidth = 0.075;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(-0.22, spalla - 0.02);
  ctx.lineTo(0.2, anca + 0.02);
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.fillStyle = borsello;
  riquadroTondo(ctx, 0.12, anca - 0.1, 0.24, 0.2, 0.05);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0.14, anca + 0.02, 0.2, 0.03);

  // testa
  ctx.fillStyle = colore;
  ctx.beginPath();
  ctx.arc(0, spalla + 0.26, 0.175, 0, Math.PI * 2);
  ctx.fill();

  // lo sguardo: due fessure storte sotto la visiera, strette e all'ingiu'
  ctx.fillStyle = '#e8ecf2';
  for (const segno of [-1, 1]) {
    ctx.save();
    ctx.translate(segno * 0.072, spalla + 0.19);
    ctx.rotate(segno * 0.42);
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.048, 0.014, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  cappelloDiFronte(ctx, spalla + 0.26, cappello, luce);

  if (arma === COLTELLO_IN_MANO) coltelloInMano(ctx, manoX, manoY, verso);
  else bottigliaRotta(ctx, manoX, manoY, verso);

  ctx.restore();
}

/** Il cappellino visto di fronte. La differenza fra un cappellino e un casco
 *  da cantiere sta nelle proporzioni: la calotta e' alta e tonda, la visiera
 *  e' **piu' stretta** della calotta e sporge in avanti facendo ombra. Se la
 *  visiera e' piu' larga della testa, viene fuori un elmetto. */
function cappelloDiFronte(ctx, yTesta, colore, luce) {
  // calotta, alta e bombata
  ctx.fillStyle = colore;
  ctx.beginPath();
  ctx.ellipse(0, yTesta + 0.055, 0.175, 0.195, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillRect(-0.175, yTesta + 0.05, 0.35, 0.02);

  // La visiera, che viene verso di noi. E' **piu' scura** della calotta:
  // sporgendo si mette in ombra da sola, ed e' quello stacco a far leggere un
  // cappellino invece di un casco tondo.
  ctx.fillStyle = scurisci(colore, 0.42);
  ctx.beginPath();
  ctx.ellipse(0, yTesta + 0.052, 0.205, 0.09, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, yTesta + 0.05, 0.185, 0.055, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // le cuciture degli spicchi e il bottoncino in cima
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.014;
  for (const segno of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, yTesta + 0.225);
    ctx.quadraticCurveTo(segno * 0.1, yTesta + 0.17, segno * 0.125, yTesta + 0.06);
    ctx.stroke();
  }
  ctx.fillStyle = luce;
  ctx.beginPath();
  ctx.arc(0, yTesta + 0.225, 0.022, 0, Math.PI * 2);
  ctx.fill();
}

function coltelloInMano(ctx, x, y, verso) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(verso * -0.25);
  ctx.fillStyle = MANICO;
  riquadroTondo(ctx, -0.035, -0.12, 0.07, 0.16, 0.025);
  ctx.fill();
  ctx.fillStyle = COLTELLO;
  ctx.beginPath();
  ctx.moveTo(-0.045, 0.04);
  ctx.lineTo(0.045, 0.04);
  ctx.lineTo(0.03, 0.42);
  ctx.lineTo(0, 0.5);
  ctx.lineTo(-0.045, 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(-0.012, 0.06, 0.016, 0.33);
  ctx.restore();
}

/** Una bottiglia rotta tenuta per il collo: il vetro spezzato in cima e' il
 *  dettaglio che la distingue da una bottiglia qualsiasi. */
function bottigliaRotta(ctx, x, y, verso) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(verso * -0.18);

  // Tenuta per il collo, col fondo in alto: e' cosi' che si impugna una
  // bottiglia rotta, ed e' anche l'unico modo perche' si veda che e' rotta.
  ctx.fillStyle = BOTTIGLIA;
  ctx.beginPath();
  ctx.moveTo(-0.035, -0.1);
  ctx.lineTo(0.035, -0.1);
  ctx.lineTo(0.035, 0.08);
  ctx.lineTo(0.07, 0.15);
  ctx.lineTo(0.07, 0.33);
  ctx.lineTo(-0.07, 0.33);
  ctx.lineTo(-0.07, 0.15);
  ctx.lineTo(-0.035, 0.08);
  ctx.closePath();
  ctx.fill();

  // l'orlo spezzato: punte corte e irregolari, non una corona di aculei
  ctx.fillStyle = BOTTIGLIA_ORLO;
  ctx.beginPath();
  ctx.moveTo(-0.07, 0.33);
  ctx.lineTo(-0.045, 0.4);
  ctx.lineTo(-0.02, 0.34);
  ctx.lineTo(0.008, 0.42);
  ctx.lineTo(0.035, 0.35);
  ctx.lineTo(0.07, 0.39);
  ctx.lineTo(0.07, 0.33);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(-0.05, 0.17, 0.018, 0.12);
  ctx.restore();
}

// --- monopattini -----------------------------------------------------------

/** Un monopattino elettrico visto **di lato**, con l'origine a terra sotto la
 *  ruota posteriore e il muso verso destra. Lungo 1,15 m, manubrio a 1,05.
 *
 *  Di lato si capisce cos'e' senza spiegazioni: due ruote grosse, la pedana
 *  bassa in mezzo, il piantone inclinato e il manubrio in cima. E' la vista
 *  che serve alla schermata iniziale, dove i monopattini sono parcheggiati. */
export function disegnaMonopattinoDiLato(ctx, { tinta = '#3f4a52', accento = '#6fd18a' } = {}) {
  const RAGGIO = 0.135;
  const dietro = 0.16;
  const davanti = 1.02;

  // cavalletto
  ctx.strokeStyle = tinta;
  ctx.lineWidth = 0.03;
  ctx.beginPath();
  ctx.moveTo(dietro + 0.16, 0.11);
  ctx.lineTo(dietro + 0.02, 0);
  ctx.stroke();

  // pedana, con lo spessore della batteria sotto
  ctx.fillStyle = tinta;
  riquadroTondo(ctx, dietro + 0.05, 0.1, davanti - dietro - 0.1, 0.075, 0.025);
  ctx.fill();
  ctx.fillStyle = accento;
  ctx.fillRect(dietro + 0.12, 0.155, davanti - dietro - 0.28, 0.018);

  // parafango posteriore
  ctx.strokeStyle = tinta;
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  ctx.arc(dietro, RAGGIO, RAGGIO + 0.045, Math.PI * 0.05, Math.PI * 0.95);
  ctx.stroke();

  // ruote
  for (const cx of [dietro, davanti]) {
    ctx.fillStyle = '#17191d';
    ctx.beginPath();
    ctx.arc(cx, RAGGIO, RAGGIO, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#454b52';
    ctx.beginPath();
    ctx.arc(cx, RAGGIO, RAGGIO * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }

  // forcella e piantone, inclinato all'indietro come sono davvero
  ctx.strokeStyle = tinta;
  ctx.lineWidth = 0.045;
  ctx.beginPath();
  ctx.moveTo(davanti, RAGGIO);
  ctx.lineTo(davanti + 0.02, 0.34);
  ctx.stroke();
  ctx.lineWidth = 0.055;
  ctx.beginPath();
  ctx.moveTo(davanti + 0.02, 0.3);
  ctx.lineTo(davanti - 0.1, 1.02);
  ctx.stroke();

  // manubrio: di lato si vede corto, ma le due manopole sporgono
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(davanti - 0.22, 1.05);
  ctx.lineTo(davanti + 0.02, 1.02);
  ctx.stroke();
  ctx.fillStyle = '#1d2024';
  riquadroTondo(ctx, davanti - 0.26, 1.0, 0.1, 0.075, 0.03);
  ctx.fill();

  // cruscotto e faro
  ctx.fillStyle = accento;
  riquadroTondo(ctx, davanti - 0.16, 0.95, 0.09, 0.06, 0.02);
  ctx.fill();
  ctx.fillStyle = '#f2ead0';
  ctx.beginPath();
  ctx.ellipse(davanti + 0.03, 0.88, 0.035, 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Lo stesso monopattino visto **di faccia**, che e' come lo si incontra: i
 *  maranza arrivano contromano, addosso a chi corre. Di faccia si vede una
 *  ruota sola di taglio, la pedana in larghezza, il manubrio largo e il faro
 *  acceso — ed e' il faro a dire, da lontano, che quello ti sta venendo
 *  incontro invece di scappare come te. */
export function disegnaMonopattinoDiFronte(ctx, { tinta = '#3f4a52', accento = '#6fd18a' } = {}) {
  ctx.fillStyle = '#17191d';
  riquadroTondo(ctx, -0.055, 0.01, 0.11, 0.26, 0.05);
  ctx.fill();

  // parafango anteriore
  ctx.fillStyle = tinta;
  riquadroTondo(ctx, -0.085, 0.24, 0.17, 0.07, 0.03);
  ctx.fill();

  ctx.fillStyle = tinta;
  riquadroTondo(ctx, -0.14, 0.1, 0.28, 0.055, 0.02);
  ctx.fill();
  ctx.fillStyle = accento;
  ctx.fillRect(-0.12, 0.145, 0.24, 0.014);

  ctx.strokeStyle = tinta;
  ctx.lineWidth = 0.055;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0.15);
  ctx.lineTo(-0.015, 1.0);
  ctx.stroke();

  ctx.lineWidth = 0.045;
  ctx.beginPath();
  ctx.moveTo(-0.27, 1.03);
  ctx.lineTo(0.24, 1.03);
  ctx.stroke();
  ctx.fillStyle = '#1d2024';
  for (const segno of [-1, 1]) {
    riquadroTondo(ctx, segno * 0.24 - 0.045, 0.99, 0.09, 0.08, 0.03);
    ctx.fill();
  }

  // il faro, acceso: e' quello che dice che sta venendo verso di te
  ctx.fillStyle = '#f6efd0';
  ctx.beginPath();
  ctx.ellipse(0, 0.93, 0.075, 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(246,239,208,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 0.93, 0.15, 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Il maranza in sella, visto di faccia: piedi sulla pedana, braccia tese al
 *  manubrio e lo stesso sguardo storto degli altri. */
export function disegnaMaranzaInSella(ctx, opzioni) {
  const { colore = '#24262c', luce = '#474c56', cappello = CAPPELLI[0], borsello = '#8a8f98', base = 0 } =
    opzioni;

  ctx.save();
  ctx.translate(0, base);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const anca = 0.86;
  const spalla = 1.42;

  // gambe vicine, una un po' avanti all'altra sulla pedana
  ctx.strokeStyle = colore;
  ctx.lineWidth = 0.19;
  for (const [segno, avanti] of [[-1, 0.04], [1, -0.02]]) {
    ctx.beginPath();
    ctx.moveTo(segno * 0.1, anca);
    ctx.lineTo(segno * 0.12 + avanti, anca * 0.5);
    ctx.lineTo(segno * 0.13 + avanti, 0.05);
    ctx.stroke();
  }

  ctx.fillStyle = colore;
  riquadroTondo(ctx, -0.29, anca - 0.1, 0.58, spalla - anca + 0.24, 0.14);
  ctx.fill();

  // braccia tese al manubrio
  ctx.strokeStyle = colore;
  ctx.lineWidth = 0.15;
  for (const segno of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(segno * 0.26, spalla);
    ctx.lineTo(segno * 0.3, spalla - 0.22);
    ctx.lineTo(segno * 0.26, spalla - 0.44);
    ctx.stroke();
  }

  ctx.strokeStyle = borsello;
  ctx.lineWidth = 0.075;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(-0.22, spalla - 0.02);
  ctx.lineTo(0.2, anca + 0.02);
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.fillStyle = borsello;
  riquadroTondo(ctx, 0.12, anca - 0.1, 0.24, 0.2, 0.05);
  ctx.fill();

  ctx.fillStyle = colore;
  ctx.beginPath();
  ctx.arc(0, spalla + 0.26, 0.175, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e8ecf2';
  for (const segno of [-1, 1]) {
    ctx.save();
    ctx.translate(segno * 0.072, spalla + 0.19);
    ctx.rotate(segno * 0.42);
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.048, 0.014, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  cappelloDiFronte(ctx, spalla + 0.26, cappello, luce);
  ctx.restore();
}

// --- il branco della schermata iniziale ------------------------------------

/** Dove stanno i quattro maranza e i due monopattini sulla schermata iniziale.
 *
 *  Sono disposti a **semicerchio aperto verso di noi**: i due esterni sono
 *  piu' vicini, quindi piu' grandi e piu' in basso; i due interni piu'
 *  lontani, quindi piu' piccoli e piu' in alto. E' quello che distingue un
 *  capannello attorno a te da quattro figurine in fila.
 *
 *  Modulo puro: ritorna solo posizioni, non disegna niente. Cosi' si puo'
 *  controllare con un test che stiano tutti dentro lo schermo. */
/** Quanto e' larga una figura rispetto a quanto e' alta, braccia comprese. */
const LARGHEZZA_FIGURA = 0.24;

export function postiDelBranco(vista) {
  const suolo = vista.altezza * 0.62;
  // L'altezza la decide il lato corto: su uno schermo basso e largo comanda
  // l'altezza, su uno stretto comanda la larghezza, altrimenti i due esterni
  // escono dai bordi.
  const altezzaBase = Math.min(vista.altezza * 0.21, vista.larghezza * 0.46);

  const figure = [
    { fianco: -0.325, avanti: 1, cappello: 0, arma: COLTELLO_IN_MANO, verso: -1 },
    { fianco: -0.115, avanti: 0, cappello: 1, arma: BOTTIGLIA_ROTTA, verso: 1 },
    { fianco: 0.115, avanti: 0, cappello: 2, arma: COLTELLO_IN_MANO, verso: 1 },
    { fianco: 0.325, avanti: 1, cappello: 3, arma: BOTTIGLIA_ROTTA, verso: -1 },
  ].map((posto, i) => {
    const altezza = altezzaBase * (1 + posto.avanti * 0.15);
    return {
      x: vista.larghezza / 2 + vista.larghezza * posto.fianco,
      y: suolo + posto.avanti * vista.altezza * 0.045,
      altezza,
      mezzaLarghezza: altezza * LARGHEZZA_FIGURA,
      cappello: posto.cappello,
      arma: posto.arma,
      verso: posto.verso,
      ritardo: i * 1.7,
    };
  });

  // I due monopattini stanno **davanti** al capannello, appoggiati sul
  // cavalletto negli spazi fra una figura e l'altra. Davanti e non dietro
  // perche' sono alti la meta' di una persona: messi dietro sparirebbero, cosi'
  // invece coprono solo qualche stinco e si vedono per intero.
  const monopattini = [
    { fianco: -0.215, verso: 1 },
    { fianco: 0.215, verso: -1 },
  ].map((posto) => {
    const altezza = altezzaBase * 0.62;
    return {
      x: vista.larghezza / 2 + vista.larghezza * posto.fianco,
      y: suolo + vista.altezza * 0.065,
      altezza,
      // un monopattino e' piu' lungo che alto: l'ingombro di lato e' maggiore
      mezzaLarghezza: altezza * 0.62,
      verso: posto.verso,
    };
  });

  return { figure, monopattini };
}

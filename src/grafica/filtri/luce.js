// Illuminazione 2D con normal map ricavata al volo.
//
// Il problema: la grafica di questo gioco non e' fatta di sprite disegnate a
// mano, e' dipinta a ogni fotogramma da codice. Non esiste nessun file di
// normal map da affiancarle, e non ci sara' mai.
//
// La soluzione: **la normal map si ricava dal canale alpha**. Si prende la
// silhouette, la si legge come un campo di altezza (dentro alto, fuori basso),
// se ne stima la pendenza con sedici prelievi su due anelli, e quella pendenza
// e' la normale. Il risultato e' una figura piatta che si gonfia: piatta al
// centro, arrotondata sul contorno. E' esattamente il volume che serve a una
// sagoma 2D per non sembrare un ritaglio di carta.
//
// Sopra ci vanno tre luci:
//   - una **direzionale**, il sole, in mezza-lambert cosi' l'ombra non diventa
//     mai nera (una figura 2D nera a meta' sembra rotta, non illuminata);
//   - una **rim light** da dietro, che accende solo il contorno e stacca la
//     figura dal fondo: e' quella che fa il grosso del lavoro;
//   - fino a otto **luci puntiformi** (lampioni, fari, monete, aura), passate
//     in coordinate del riquadro del filtro.
//
// Convenzione degli assi, valida per tutte le direzioni qui dentro:
//   x a destra, **y in basso** (come le uv), z verso chi guarda.

import { creaFiltro, AIUTI_GL, AIUTI_WGSL } from './comune.js';

/** Quante luci puntiformi entrano in un fotogramma. Oltre non e' il costo che
 *  preoccupa, e' che non si distinguono piu'. */
export const LUCI_MASSIME = 8;

const FRAGMENT_GL = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
// highp obbligatorio: il vertex shader la dichiara ad alta precisione e il link
// fallisce se qui e' mediump. Vedi la nota in profondita.js.
uniform highp vec4 uInputSize;
uniform vec4 uInputClamp;

uniform vec4 uSole;        // xyz = verso il sole, w = forza
uniform vec4 uColoreSole;  // rgb = tinta del sole, w = ambiente
uniform vec4 uRim;         // xy = da dove arriva, z = strettezza, w = forza
uniform vec4 uColoreRim;
uniform vec4 uRilievo;     // x,y = raggi (px), z = forza del rilievo, w = n. luci
uniform vec4 uMisto;       // x = quanto si illumina, y = quanto scaldano le luci
uniform vec4 uLuci[${LUCI_MASSIME}];   // xy = centro (uv), z = raggio (uv), w = intensita
uniform vec4 uColoriLuci[${LUCI_MASSIME}];

${AIUTI_GL}

float alfa(vec2 uv) {
    return texture(uTexture, clamp(uv, uInputClamp.xy, uInputClamp.zw)).a;
}

/** La pendenza del campo di altezza, stimata su due anelli di otto prelievi.
 *  Due raggi e non uno: il piccolo tiene il contorno netto, il grande da' la
 *  curvatura larga senza la quale il volume non si vede. */
vec2 pendenza(vec2 uv) {
    vec2 g = vec2(0.0);
    for (int i = 0; i < 8; i++) {
        float angolo = float(i) * 0.7853981634;
        vec2 d = vec2(cos(angolo), sin(angolo));
        vec2 p1 = d * uRilievo.x * uInputSize.zw;
        vec2 p2 = d * uRilievo.y * uInputSize.zw;
        g += d * (alfa(uv + p1) * 0.62 + alfa(uv + p2) * 0.38);
    }
    return g / 8.0;
}

void main(void) {
    vec4 c = texture(uTexture, vTextureCoord);
    if (c.a <= 0.003) { finalColor = c; return; }

    vec3 albedo = c.rgb / c.a;

    vec2 g = pendenza(vTextureCoord);
    vec3 N = normalize(vec3(-g * uRilievo.z, 1.0));

    // mezza lambert: il lato in ombra si scurisce, non si spegne
    float sole = pow(dot(N, normalize(uSole.xyz)) * 0.5 + 0.5, 1.4);
    vec3 illuminato = albedo * (vec3(uColoreSole.w) + uColoreSole.rgb * sole * uSole.w);

    // rim light: si accende dove la normale guarda di taglio e verso la luce
    float bordo = pow(1.0 - clamp(N.z, 0.0, 1.0), uRim.z);
    float verso = max(dot(normalize(N.xy + vec2(0.00001)), normalize(uRim.xy)), 0.0);
    illuminato += uColoreRim.rgb * bordo * verso * uRim.w;

    // luci puntiformi
    for (int i = 0; i < ${LUCI_MASSIME}; i++) {
        if (float(i) >= uRilievo.w) break;
        vec2 versoLuce = (uLuci[i].xy - vTextureCoord) * uInputSize.xy;
        float raggio = max(uLuci[i].z * uInputSize.x, 1.0);
        float caduta = 1.0 - clamp(length(versoLuce) / raggio, 0.0, 1.0);
        caduta *= caduta;
        vec3 L = normalize(vec3(versoLuce, raggio * 0.55));
        float lambert = max(dot(N, L), 0.0) * 0.7 + 0.3;
        illuminato += albedo * uColoriLuci[i].rgb * lambert * caduta * uLuci[i].w * uMisto.y;
    }

    vec3 col = mix(albedo, illuminato, uMisto.x);
    finalColor = vec4(clamp(col, 0.0, 1.0) * c.a, c.a);
}
`;

const FRAGMENT_WGSL = `
${AIUTI_WGSL}

fn alfa(uv: vec2<f32>) -> f32 {
    return textureSample(uTexture, uSampler, clamp(uv, gfu.uInputClamp.xy, gfu.uInputClamp.zw)).a;
}

fn pendenza(uv: vec2<f32>) -> vec2<f32> {
    var g = vec2<f32>(0.0);
    for (var i = 0; i < 8; i = i + 1) {
        let angolo = f32(i) * 0.7853981634;
        let d = vec2<f32>(cos(angolo), sin(angolo));
        let p1 = d * parametri.uRilievo.x * gfu.uInputSize.zw;
        let p2 = d * parametri.uRilievo.y * gfu.uInputSize.zw;
        g = g + d * (alfa(uv + p1) * 0.62 + alfa(uv + p2) * 0.38);
    }
    return g / 8.0;
}

@fragment
fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let c = textureSample(uTexture, uSampler, uv);
    if (c.a <= 0.003) { return c; }

    let albedo = c.rgb / c.a;

    let g = pendenza(uv);
    let N = normalize(vec3<f32>(-g * parametri.uRilievo.z, 1.0));

    let sole = pow(dot(N, normalize(parametri.uSole.xyz)) * 0.5 + 0.5, 1.4);
    var illuminato = albedo * (vec3<f32>(parametri.uColoreSole.w)
        + parametri.uColoreSole.rgb * sole * parametri.uSole.w);

    let bordo = pow(1.0 - clamp(N.z, 0.0, 1.0), parametri.uRim.z);
    let verso = max(dot(normalize(N.xy + vec2<f32>(0.00001)), normalize(parametri.uRim.xy)), 0.0);
    illuminato = illuminato + parametri.uColoreRim.rgb * bordo * verso * parametri.uRim.w;

    for (var i = 0; i < ${LUCI_MASSIME}; i = i + 1) {
        if (f32(i) >= parametri.uRilievo.w) { break; }
        let luce = parametri.uLuci[i];
        let versoLuce = (luce.xy - uv) * gfu.uInputSize.xy;
        let raggio = max(luce.z * gfu.uInputSize.x, 1.0);
        var caduta = 1.0 - clamp(length(versoLuce) / raggio, 0.0, 1.0);
        caduta = caduta * caduta;
        let L = normalize(vec3<f32>(versoLuce, raggio * 0.55));
        let lambert = max(dot(N, L), 0.0) * 0.7 + 0.3;
        illuminato = illuminato + albedo * parametri.uColoriLuci[i].rgb
            * lambert * caduta * luce.w * parametri.uMisto.y;
    }

    let col = mix(albedo, illuminato, parametri.uMisto.x);
    return vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)) * c.a, c.a);
}
`;

export function creaFiltroLuce({
  sole = [-0.42, -0.58, 0.7, 0.55],
  coloreSole = [1.0, 0.94, 0.82, 0.62],
  rim = [0.55, -0.5, 2.4, 0.85],
  coloreRim = [0.62, 0.82, 1.0],
  rilievo = { vicino: 2.5, lontano: 7, forza: 2.2 },
  misto = { illuminazione: 1, luci: 1 },
} = {}) {
  const filtro = creaFiltro({
    nome: 'luce',
    uniformi: {
      uSole: { value: new Float32Array(sole), type: 'vec4<f32>' },
      uColoreSole: { value: new Float32Array(coloreSole), type: 'vec4<f32>' },
      uRim: { value: new Float32Array(rim), type: 'vec4<f32>' },
      uColoreRim: { value: new Float32Array([...coloreRim, 0]), type: 'vec4<f32>' },
      uRilievo: {
        value: new Float32Array([rilievo.vicino, rilievo.lontano, rilievo.forza, 0]),
        type: 'vec4<f32>',
      },
      uMisto: {
        value: new Float32Array([misto.illuminazione, misto.luci, 0, 0]),
        type: 'vec4<f32>',
      },
      uLuci: { value: new Float32Array(LUCI_MASSIME * 4), type: 'vec4<f32>', size: LUCI_MASSIME },
      uColoriLuci: {
        value: new Float32Array(LUCI_MASSIME * 4),
        type: 'vec4<f32>',
        size: LUCI_MASSIME,
      },
    },
    campiWgsl: [
      '  uSole: vec4<f32>,',
      '  uColoreSole: vec4<f32>,',
      '  uRim: vec4<f32>,',
      '  uColoreRim: vec4<f32>,',
      '  uRilievo: vec4<f32>,',
      '  uMisto: vec4<f32>,',
      `  uLuci: array<vec4<f32>, ${LUCI_MASSIME}>,`,
      `  uColoriLuci: array<vec4<f32>, ${LUCI_MASSIME}>,`,
    ].join('\n'),
    corpoGl: FRAGMENT_GL,
    corpoWgsl: FRAGMENT_WGSL,
  });

  /** Carica le luci del fotogramma. `luci` sono gia' in coordinate del riquadro
   *  del filtro: { x, y, raggio (frazioni), intensita, colore: [r,g,b] }. */
  filtro.caricaLuci = (luci) => {
    const quante = Math.min(luci.length, LUCI_MASSIME);
    for (let i = 0; i < quante; i += 1) {
      const l = luci[i];
      filtro.p.uLuci[i * 4 + 0] = l.x;
      filtro.p.uLuci[i * 4 + 1] = l.y;
      filtro.p.uLuci[i * 4 + 2] = l.raggio;
      filtro.p.uLuci[i * 4 + 3] = l.intensita;
      filtro.p.uColoriLuci[i * 4 + 0] = l.colore[0];
      filtro.p.uColoriLuci[i * 4 + 1] = l.colore[1];
      filtro.p.uColoriLuci[i * 4 + 2] = l.colore[2];
    }
    filtro.p.uRilievo[3] = quante;
  };

  return filtro;
}

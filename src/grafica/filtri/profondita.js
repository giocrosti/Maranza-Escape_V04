// Prospettiva aerea e profondita' di campo dentro un layer prospettico.
//
// Sui fondali piatti tutto il layer sta alla stessa distanza e basta `aria.js`.
// Sulla strada no: il metro davanti ai piedi e il palazzo all'orizzonte stanno
// nella stessa immagine. Ma in questa proiezione la distanza si legge dalla
// posizione verticale — piu' su, piu' lontano — quindi si puo' ricavare una
// mappa di profondita' senza un canale di profondita': la da' `uv.y`.
//
//   t = 0   il piano dove corre l'omino, in fondo allo schermo: nitido
//   t = 1   l'orizzonte: sfocato, slavato, annegato nella foschia
//
// Da li' escono due cose insieme:
//   - la **profondita' di campo**, con un raggio di sfocatura che cresce con t
//     (dodici prelievi su una spirale, che a raggi piccoli non si contano);
//   - la **prospettiva aerea**, con desaturazione e foschia che crescono con t.
//
// Il fuoco non e' per forza a t = 0: `fuoco` dice da dove comincia a sfocare,
// cosi' il piano di gioco resta perfettamente a fuoco per una fascia, e non
// solo in un punto.

import { creaFiltro, AIUTI_GL, AIUTI_WGSL } from './comune.js';

/** Quanti prelievi fa la sfocatura. Dodici e' il minimo che non fa vedere i
 *  singoli cerchietti quando il raggio diventa grande. */
const PRELIEVI = 12;

const FRAGMENT_GL = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
// highp non e' un vezzo: nel vertex shader la precisione di default e' alta,
// nel fragment e' media. Dichiarare qui la stessa uniform senza qualifica fa
// fallire il *link* — non la compilazione — con un messaggio che parla di
// precisioni e non nomina il file da cui viene.
uniform highp vec4 uInputSize;
uniform vec4 uInputClamp;

uniform vec4 uAria;    // rgb = foschia, w = quanta se ne prende all'orizzonte
uniform vec4 uCampo;   // x = orizzonte, y = fuoco, z = sfocatura max (px), w = potenza
uniform vec4 uTono;    // x = desaturazione max, y = contrasto, z = luminosita, w = opacita

${AIUTI_GL}

void main(void) {
    // quanto e' lontano questo pixel: 0 ai piedi, 1 all'orizzonte
    float t = clamp((1.0 - vTextureCoord.y) / max(1.0 - uCampo.x, 0.001), 0.0, 1.0);
    t = pow(t, uCampo.w);

    float raggio = uCampo.z * smoothstep(uCampo.y, 1.0, t);

    vec4 c = texture(uTexture, vTextureCoord);
    if (raggio > 0.25) {
        // Si media il colore gia' premoltiplicato: e' l'unico modo di sfocare
        // senza tirare dentro il colore dei pixel trasparenti.
        vec4 somma = c;
        for (int i = 0; i < ${PRELIEVI}; i++) {
            float angolo = float(i) * 2.3999632;               // angolo aureo
            float passo = sqrt((float(i) + 0.5) / float(${PRELIEVI}));
            vec2 scarto = vec2(cos(angolo), sin(angolo)) * passo * raggio * uInputSize.zw;
            somma += texture(uTexture, clamp(vTextureCoord + scarto, uInputClamp.xy, uInputClamp.zw));
        }
        c = somma / float(${PRELIEVI} + 1);
    }

    if (c.a <= 0.0001) { finalColor = c; return; }

    vec3 col = c.rgb / c.a;
    col = desatura(col, uTono.x * t);
    col = contrasta(col, mix(1.0, uTono.y, t));
    col += uTono.z * t;
    col = mix(col, uAria.rgb, uAria.w * t);

    float a = c.a * uTono.w;
    finalColor = vec4(clamp(col, 0.0, 1.0) * a, a);
}
`;

const FRAGMENT_WGSL = `
${AIUTI_WGSL}

@fragment
fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    var t = clamp((1.0 - uv.y) / max(1.0 - parametri.uCampo.x, 0.001), 0.0, 1.0);
    t = pow(t, parametri.uCampo.w);

    let raggio = parametri.uCampo.z * smoothstep(parametri.uCampo.y, 1.0, t);

    var c = textureSample(uTexture, uSampler, uv);
    if (raggio > 0.25) {
        var somma = c;
        for (var i = 0; i < ${PRELIEVI}; i = i + 1) {
            let angolo = f32(i) * 2.3999632;
            let passo = sqrt((f32(i) + 0.5) / f32(${PRELIEVI}));
            let scarto = vec2<f32>(cos(angolo), sin(angolo)) * passo * raggio * gfu.uInputSize.zw;
            somma = somma + textureSample(
                uTexture, uSampler,
                clamp(uv + scarto, gfu.uInputClamp.xy, gfu.uInputClamp.zw)
            );
        }
        c = somma / f32(${PRELIEVI} + 1);
    }

    if (c.a <= 0.0001) { return c; }

    var col = c.rgb / c.a;
    col = desatura(col, parametri.uTono.x * t);
    col = contrasta(col, mix(1.0, parametri.uTono.y, t));
    col = col + vec3<f32>(parametri.uTono.z * t);
    col = mix(col, parametri.uAria.rgb, parametri.uAria.w * t);

    let a = c.a * parametri.uTono.w;
    return vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)) * a, a);
}
`;

export function creaFiltroProfondita({
  aria = [0.84, 0.88, 0.92, 0.62],
  orizzonte = 0.4,
  fuoco = 0.28,
  sfocatura = 4,
  potenza = 1.6,
  tono = {},
} = {}) {
  const { desaturazione = 0.5, contrasto = 0.82, luminosita = 0.05, opacita = 1 } = tono;

  const filtro = creaFiltro({
    nome: 'profondita',
    uniformi: {
      uAria: { value: new Float32Array(aria), type: 'vec4<f32>' },
      uCampo: { value: new Float32Array([orizzonte, fuoco, sfocatura, potenza]), type: 'vec4<f32>' },
      uTono: {
        value: new Float32Array([desaturazione, contrasto, luminosita, opacita]),
        type: 'vec4<f32>',
      },
    },
    campiWgsl: '  uAria: vec4<f32>,\n  uCampo: vec4<f32>,\n  uTono: vec4<f32>,',
    corpoGl: FRAGMENT_GL,
    corpoWgsl: FRAGMENT_WGSL,
  });

  /** L'orizzonte si muove col formato dello schermo: va riportato qui a ogni
   *  ridimensionamento, o la profondita' si stacca dalla strada. */
  filtro.impostaOrizzonte = (frazione) => {
    filtro.p.uCampo[0] = frazione;
  };
  return filtro;
}

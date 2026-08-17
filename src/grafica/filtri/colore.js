// Color grading con LUT.
//
// Tutta la conversione vera sta gia' dentro la striscia costruita da
// `tavolozza.js`: qui si legge e basta. Il valore del blu sceglie fra due fette
// vicine e si interpola a mano fra le due — e' l'unico punto delicato, perche'
// una interpolazione lasciata al campionatore sconfinerebbe nella fetta
// accanto e tingerebbe di verde le ombre blu.

import { creaFiltro } from './comune.js';
import { LATO_LUT } from '../tavolozza.js';

const LATO = LATO_LUT;
const LARGHEZZA = LATO * LATO;

const FRAGMENT_GL = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uLutTexture;
uniform vec4 uForza;   // x = quanto si applica la LUT

vec3 dallaLut(vec3 c) {
    float lato = float(${LATO});
    float blu = c.b * (lato - 1.0);
    float fetta = floor(blu);
    float frazione = blu - fetta;

    float x = (c.r * (lato - 1.0) + 0.5) / ${LARGHEZZA}.0;
    float y = (c.g * (lato - 1.0) + 0.5) / lato;

    vec2 a = vec2(x + fetta / lato, y);
    vec2 b = vec2(x + min(fetta + 1.0, lato - 1.0) / lato, y);
    return mix(texture(uLutTexture, a).rgb, texture(uLutTexture, b).rgb, frazione);
}

void main(void) {
    vec4 c = texture(uTexture, vTextureCoord);
    if (c.a <= 0.0001) { finalColor = c; return; }

    vec3 col = clamp(c.rgb / c.a, 0.0, 1.0);
    col = mix(col, dallaLut(col), uForza.x);
    finalColor = vec4(col * c.a, c.a);
}
`;

const FRAGMENT_WGSL = `
fn dallaLut(c: vec3<f32>) -> vec3<f32> {
    let lato = f32(${LATO});
    let blu = c.b * (lato - 1.0);
    let fetta = floor(blu);
    let frazione = blu - fetta;

    let x = (c.r * (lato - 1.0) + 0.5) / f32(${LARGHEZZA});
    let y = (c.g * (lato - 1.0) + 0.5) / lato;

    let a = vec2<f32>(x + fetta / lato, y);
    let b = vec2<f32>(x + min(fetta + 1.0, lato - 1.0) / lato, y);
    return mix(
        textureSample(uLutTexture, uLutSampler, a).rgb,
        textureSample(uLutTexture, uLutSampler, b).rgb,
        frazione
    );
}

@fragment
fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let c = textureSample(uTexture, uSampler, uv);
    if (c.a <= 0.0001) { return c; }

    var col = clamp(c.rgb / c.a, vec3<f32>(0.0), vec3<f32>(1.0));
    col = mix(col, dallaLut(col), parametri.uForza.x);
    return vec4<f32>(col * c.a, c.a);
}
`;

/** @param texturaLut una Texture costruita sul canvas della striscia. */
export function creaFiltroColore(texturaLut, { forza = 1 } = {}) {
  const sorgente = texturaLut.source;
  // niente mipmap e niente ripetizione: una LUT si legge com'e'
  sorgente.style.addressMode = 'clamp-to-edge';
  sorgente.style.scaleMode = 'linear';

  return creaFiltro({
    nome: 'colore',
    uniformi: {
      uForza: { value: new Float32Array([forza, 0, 0, 0]), type: 'vec4<f32>' },
    },
    campiWgsl: '  uForza: vec4<f32>,',
    corpoGl: FRAGMENT_GL,
    corpoWgsl: FRAGMENT_WGSL,
    risorse: { uLutTexture: sorgente, uLutSampler: sorgente.style },
    extraWgsl: [
      '@group(1) @binding(1) var uLutTexture: texture_2d<f32>;',
      '@group(1) @binding(2) var uLutSampler: sampler;',
    ].join('\n'),
  });
}

// L'impalcatura comune dei filtri scritti a mano.
//
// PixiJS v8 parla due lingue: GLSL (WebGL2) e WGSL (WebGPU). Un filtro che
// abbia solo il programma GL funziona finche' il gioco ricade su WebGL2, e
// smette di funzionare proprio sul percorso veloce. Quindi **ogni filtro qui
// dentro ha due programmi**, e questo file tiene la parte che non cambia mai:
// le uniform globali, il vertex shader, l'ordine dei gruppi di binding.
//
// Due regole da non dimenticare scrivendo un fragment:
//
// 1. **Il colore in ingresso e' premoltiplicato.** rgb sono gia' moltiplicati
//    per alpha. Prima di toccare la tinta si divide, alla fine si rimoltiplica.
//    Saltare il passaggio schiarisce i bordi sfumati e li fa sembrare sporchi.
// 2. **`uv` copre il riquadro del filtro, non lo schermo.** Vale 0..1 solo se
//    il filtro ha padding zero. Per questo i filtri che ricevono posizioni
//    (le luci) le vogliono gia' in coordinate del proprio riquadro, e hanno
//    tutti `padding: 0`.

import { Filter, GlProgram, GpuProgram, UniformGroup } from 'pixi.js';

/** Il vertex shader GLSL: e' quello di Pixi, ricopiato per non dipendere da un
 *  percorso interno della libreria. */
const VERTICE_GL = `
in vec2 aPosition;
out vec2 vTextureCoord;

// highp esplicito: chi la ridichiara nel fragment deve fare altrettanto, o il
// programma non linka. Scritta com'e' non lascia dubbi.
uniform highp vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 posizioneFiltro() {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

void main(void) {
    gl_Position = posizioneFiltro();
    vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}
`;

/** La testa di ogni sorgente WGSL: uniform globali, texture d'ingresso,
 *  il gruppo 1 con i parametri del filtro e il vertex shader. */
function testaWgsl(campi, extra) {
  return `
struct GlobalFilterUniforms {
  uInputSize: vec4<f32>,
  uInputPixel: vec4<f32>,
  uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>,
  uGlobalFrame: vec4<f32>,
  uOutputTexture: vec4<f32>,
};

struct Parametri {
${campi}
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;

@group(1) @binding(0) var<uniform> parametri: Parametri;
${extra}

struct VSOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
  var posizione = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
  posizione.x = posizione.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
  posizione.y = posizione.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
  return VSOutput(
    vec4(posizione, 0.0, 1.0),
    aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw)
  );
}
`;
}

/** Frammenti di GLSL/WGSL che tornano utili a piu' filtri. */
export const AIUTI_GL = `
float luminanza(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 desatura(vec3 c, float q) { return mix(c, vec3(luminanza(c)), q); }
vec3 contrasta(vec3 c, float q) { return (c - 0.5) * q + 0.5; }
`;

export const AIUTI_WGSL = `
fn luminanza(c: vec3<f32>) -> f32 { return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722)); }
fn desatura(c: vec3<f32>, q: f32) -> vec3<f32> { return mix(c, vec3<f32>(luminanza(c)), q); }
fn contrasta(c: vec3<f32>, q: f32) -> vec3<f32> { return (c - 0.5) * q + 0.5; }
`;

/**
 * Costruisce un filtro con i due programmi.
 *
 * @param nome        etichetta per i messaggi d'errore del compilatore
 * @param uniformi    descrizione dei parametri, nel formato di UniformGroup
 * @param campiWgsl   gli stessi parametri, dichiarati come campi di struct
 * @param corpoGl     il fragment GLSL completo (usa `vTextureCoord`)
 * @param corpoWgsl   il fragment WGSL completo (entry point `mainFragment`)
 * @param risorse     texture aggiuntive: { nome: sorgente }
 * @param extraWgsl   dichiarazioni extra nel gruppo 1 (le texture aggiuntive)
 */
export function creaFiltro({
  nome,
  uniformi,
  campiWgsl,
  corpoGl,
  corpoWgsl,
  risorse = {},
  extraWgsl = '',
  padding = 0,
  blendMode = 'normal',
  antialias = 'off',
  risoluzione = 'inherit',
}) {
  const parametri = new UniformGroup(uniformi);

  const glProgram = GlProgram.from({
    vertex: VERTICE_GL,
    fragment: corpoGl,
    name: nome,
  });

  const sorgente = testaWgsl(campiWgsl, extraWgsl) + corpoWgsl;
  const gpuProgram = GpuProgram.from({
    vertex: { source: sorgente, entryPoint: 'mainVertex' },
    fragment: { source: sorgente, entryPoint: 'mainFragment' },
    name: nome,
  });

  const filtro = new Filter({
    glProgram,
    gpuProgram,
    resources: { parametri, ...risorse },
    padding,
    blendMode,
    antialias,
    // `resolution` di default in Pixi vale **1**, non quella dello schermo, e
    // per una catena di filtri vince il minimo di tutti. Su un telefono a
    // densita' 2 vuol dire disegnare tutta la scena a meta' risoluzione e
    // ringrandirla: sfoca tutto, comprese le cose che devono restare nitide, e
    // non lo dice nessuno. 'inherit' e' l'unico valore giusto qui.
    resolution: risoluzione,
  });

  // Scorciatoia: filtro.p.uQualcosa invece di filtro.resources.parametri.uniforms.uQualcosa
  filtro.p = parametri.uniforms;
  return filtro;
}

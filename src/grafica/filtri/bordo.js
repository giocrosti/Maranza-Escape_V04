// L'ultimo passaggio: aberrazione cromatica, vignetta, e la paura ai bordi.
//
// Aberrazione e vignetta sono due difetti di un obiettivo vero, e servono alla
// stessa cosa: dire all'occhio dove guardare. La vignetta chiude gli angoli,
// l'aberrazione scompone i colori solo alla periferia — al centro, dove corre
// l'omino, i tre canali restano perfettamente sovrapposti. Lo scarto cresce col
// **quadrato** della distanza dal centro, come in un obiettivo: e' l'unico modo
// di tenerlo invisibile in mezzo e leggibile agli angoli.
//
// Sopra ci sta la minaccia, che e' un solo numero — quanto sono vicini i
// maranza — e da qui esce in tre modi che salgono insieme:
//
//   la vignetta si stringe e vira al rosso
//   i rossi della scena si accendono, gli altri colori si spengono un poco
//   i bordi cominciano a ondeggiare, ma solo all'ultimo passo
//
// Tre segnali diversi che dicono la stessa cosa e arrivano tutti dalla
// periferia dell'occhio: il centro resta pulito, perche' e' li' che si gioca.

import { creaFiltro } from './comune.js';

const FRAGMENT_GL = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputClamp;
uniform vec4 uBordo;    // x = aberrazione, y = forza vignetta, z = raggio, w = morbidezza
uniform vec4 uMisura;   // x = proporzioni (l/h), y = grana
uniform vec4 uVignetta; // rgb = tinta della minaccia, w = quanto e' vicina
uniform vec4 uDisturbo; // x = ondeggiamento, y = tempo, z = rossi accesi

float rumore(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main(void) {
    vec2 d = vTextureCoord - 0.5;
    float r2 = dot(d, d);

    // L'ondeggiamento arriva solo dove r2 e' grande: al centro resta fermo,
    // qualunque cosa stia succedendo. Un centro che ondeggia non fa paura, fa
    // sbagliare il salto.
    float periferia = smoothstep(0.13, 0.3, r2);
    vec2 onda = vec2(
        sin(vTextureCoord.y * 34.0 + uDisturbo.y * 6.5),
        cos(vTextureCoord.x * 27.0 + uDisturbo.y * 5.0)
    ) * 0.0045 * uDisturbo.x * periferia;

    vec2 uv = clamp(vTextureCoord + onda, uInputClamp.xy, uInputClamp.zw);
    vec2 scarto = d * r2 * uBordo.x;

    vec4 centro = texture(uTexture, uv);
    float rosso = texture(uTexture, clamp(uv + scarto, uInputClamp.xy, uInputClamp.zw)).r;
    float blu = texture(uTexture, clamp(uv - scarto, uInputClamp.xy, uInputClamp.zw)).b;
    vec3 col = vec3(rosso, centro.g, blu);

    // i rossi si accendono e il resto si spegne: la scena vira verso il colore
    // del pericolo senza che si debba disegnare niente di nuovo
    col = mix(col, vec3(col.r * 1.28, col.g * 0.86, col.b * 0.82), uDisturbo.z);

    // la vignetta si misura su un cerchio, non su un'ellisse: senza correggere
    // le proporzioni su uno schermo di telefono chiuderebbe solo sopra e sotto
    vec2 corretto = d * vec2(uMisura.x, 1.0);
    float ombra = smoothstep(uBordo.z, uBordo.z - uBordo.w, length(corretto));
    col *= mix(1.0 - (uBordo.y + uVignetta.w * 0.35), 1.0, ombra);
    // il rosso dei maranza addosso entra dagli stessi bordi: e' una vignetta
    // sola che cambia colore, non due sovrapposte
    col += uVignetta.rgb * (1.0 - ombra) * uVignetta.w * 0.55;

    col += (rumore(vTextureCoord * 512.0) - 0.5) * uMisura.y;

    finalColor = vec4(col, centro.a);
}
`;

const FRAGMENT_WGSL = `
fn rumore(p: vec2<f32>) -> f32 {
    return fract(sin(dot(p, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

@fragment
fn mainFragment(@location(0) uvIn: vec2<f32>) -> @location(0) vec4<f32> {
    let d = uvIn - 0.5;
    let r2 = dot(d, d);

    let periferia = smoothstep(0.13, 0.3, r2);
    let onda = vec2<f32>(
        sin(uvIn.y * 34.0 + parametri.uDisturbo.y * 6.5),
        cos(uvIn.x * 27.0 + parametri.uDisturbo.y * 5.0)
    ) * 0.0045 * parametri.uDisturbo.x * periferia;

    let uv = clamp(uvIn + onda, gfu.uInputClamp.xy, gfu.uInputClamp.zw);
    let scarto = d * r2 * parametri.uBordo.x;

    let centro = textureSample(uTexture, uSampler, uv);
    let rosso = textureSample(uTexture, uSampler,
        clamp(uv + scarto, gfu.uInputClamp.xy, gfu.uInputClamp.zw)).r;
    let blu = textureSample(uTexture, uSampler,
        clamp(uv - scarto, gfu.uInputClamp.xy, gfu.uInputClamp.zw)).b;

    var col = vec3<f32>(rosso, centro.g, blu);
    col = mix(col, vec3<f32>(col.r * 1.28, col.g * 0.86, col.b * 0.82), parametri.uDisturbo.z);

    let corretto = d * vec2<f32>(parametri.uMisura.x, 1.0);
    let ombra = smoothstep(parametri.uBordo.z, parametri.uBordo.z - parametri.uBordo.w, length(corretto));
    col = col * mix(1.0 - (parametri.uBordo.y + parametri.uVignetta.w * 0.35), 1.0, ombra);
    col = col + parametri.uVignetta.rgb * (1.0 - ombra) * parametri.uVignetta.w * 0.55;

    col = col + vec3<f32>((rumore(uvIn * 512.0) - 0.5) * parametri.uMisura.y);

    return vec4<f32>(col, centro.a);
}
`;

export function creaFiltroBordo({
  aberrazione = 0.02,
  vignetta = { forza: 0.34, raggio: 0.82, morbidezza: 0.42 },
  grana = 0.012,
} = {}) {
  const filtro = creaFiltro({
    nome: 'bordo',
    uniformi: {
      uBordo: {
        value: new Float32Array([aberrazione, vignetta.forza, vignetta.raggio, vignetta.morbidezza]),
        type: 'vec4<f32>',
      },
      uMisura: { value: new Float32Array([0.46, grana, 0, 0]), type: 'vec4<f32>' },
      uVignetta: { value: new Float32Array([0.72, 0.1, 0.09, 0]), type: 'vec4<f32>' },
      uDisturbo: { value: new Float32Array([0, 0, 0, 0]), type: 'vec4<f32>' },
    },
    campiWgsl: [
      '  uBordo: vec4<f32>,',
      '  uMisura: vec4<f32>,',
      '  uVignetta: vec4<f32>,',
      '  uDisturbo: vec4<f32>,',
    ].join('\n'),
    corpoGl: FRAGMENT_GL,
    corpoWgsl: FRAGMENT_WGSL,
  });

  filtro.impostaMisura = (larghezza, altezza) => {
    filtro.p.uMisura[0] = larghezza / altezza;
  };

  /**
   * Tutto quello che dipende da quanto sono vicini gli inseguitori.
   * @param minaccia da 0 (lontani) a 1 (addosso)
   * @param tempo    l'orologio del mondo, per far ondeggiare i bordi
   */
  filtro.impostaMinaccia = (minaccia, tempo = 0) => {
    filtro.p.uVignetta[3] = minaccia;
    // L'ondeggiamento parte a tre quarti e non prima: se accompagnasse tutta la
    // salita diventerebbe il fondo della scena invece dell'ultimo avvertimento.
    filtro.p.uDisturbo[0] = Math.max(0, (minaccia - 0.72) / 0.28);
    filtro.p.uDisturbo[1] = tempo;
    filtro.p.uDisturbo[2] = minaccia * 0.42;
  };

  return filtro;
}

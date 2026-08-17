import { test, assert, assertUguale } from './mini-test.js';
import { creaFiltroProfondita } from '../src/grafica/filtri/profondita.js';
import { creaFiltroLuce, LUCI_MASSIME } from '../src/grafica/filtri/luce.js';
import { creaFiltroBordo } from '../src/grafica/filtri/bordo.js';
import { creaFiltroColore } from '../src/grafica/filtri/colore.js';
import { creaCanvasLut, LATO_LUT, ANCORE } from '../src/grafica/tavolozza.js';
import { Texture } from 'pixi.js';

/* Questi test non guardano l'immagine: guardano che i filtri **esistano in
   entrambe le lingue**.

   Il motivo e' che l'errore piu' facile da fare qui e' anche il piu' difficile
   da vedere: si scrive un filtro, lo si prova sul computer — che ricade su
   WebGL2 — funziona, e si scopre sull'iPhone che su WebGPU meta' della catena
   non c'e'. Costruire il filtro basta a smascherarlo, perche' PixiJS analizza
   il sorgente WGSL nel costruttore di GpuProgram: se e' scritto male, o se i
   gruppi di binding non tornano, si rompe qui e non fra tre mesi. */

const FILTRI = {
  profondita: () => creaFiltroProfondita(),
  luce: () => creaFiltroLuce(),
  bordo: () => creaFiltroBordo(),
  colore: () => creaFiltroColore(Texture.from(creaCanvasLut())),
};

for (const [nome, costruisci] of Object.entries(FILTRI)) {
  test(`il filtro ${nome} ha tutti e due i programmi`, () => {
    const filtro = costruisci();
    assert(filtro.glProgram, 'manca il programma GLSL: niente WebGL2');
    assert(filtro.gpuProgram, 'manca il programma WGSL: niente WebGPU');
    assert(
      filtro.gpuProgram.structsAndGroups,
      'PixiJS non e riuscito a leggere i gruppi del WGSL',
    );
  });

  test(`il filtro ${nome} eredita la risoluzione dello schermo`, () => {
    // Il valore di default di PixiJS e' 1, e in una catena di filtri vince il
    // minimo: un solo filtro distratto disegna tutta la scena a meta'
    // risoluzione, e sembra che sia sfocata l'arte.
    assertUguale(costruisci().resolution, 'inherit', `risoluzione del filtro ${nome}`);
  });

  test(`il filtro ${nome} non chiede padding`, () => {
    // I filtri che leggono posizioni dentro l'immagine (profondita' dalla y,
    // luci dalle uv) si appoggiano al fatto che il riquadro coincida con lo
    // sprite. Basta un padding in catena e quelle coordinate puntano altrove.
    assertUguale(costruisci().padding, 0, `padding del filtro ${nome}`);
  });
}

test('il filtro luce accetta esattamente le luci che dichiara', () => {
  const filtro = creaFiltroLuce();
  const troppe = Array.from({ length: LUCI_MASSIME + 4 }, (_, i) => ({
    x: 0.5,
    y: 0.5,
    raggio: 0.1,
    intensita: i,
    colore: [1, 1, 1],
  }));
  filtro.caricaLuci(troppe);
  assertUguale(filtro.p.uRilievo[3], LUCI_MASSIME, 'numero di luci caricate');
});

test('la striscia della LUT ha la forma che il fragment si aspetta', () => {
  const canvas = creaCanvasLut();
  assertUguale(canvas.width, LATO_LUT * LATO_LUT, 'larghezza della striscia');
  assertUguale(canvas.height, LATO_LUT, 'altezza della striscia');
});

test('la LUT tiene la luminosita e sposta solo la tinta', () => {
  // E' la promessa della tavolozza: limitare i colori senza spegnere il
  // contrasto. Se una LUT scurisce le luci o schiarisce le ombre, la
  // leggibilita' del gioco se ne va con loro.
  const canvas = creaCanvasLut();
  const dati = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;

  const luminanza = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const voce = (r, g, b) => {
    const x = b * LATO_LUT + r;
    const i = (g * canvas.width + x) * 4;
    return luminanza(dati[i], dati[i + 1], dati[i + 2]);
  };

  // il nero resta scuro, il bianco resta chiaro
  assert(voce(0, 0, 0) < 0.12, 'il nero si e schiarito');
  assert(voce(15, 15, 15) > 0.88, 'il bianco si e scurito');
  // e un grigio medio resta medio
  const medio = voce(7, 7, 7);
  assert(medio > 0.32 && medio < 0.68, `il grigio medio e finito a ${medio.toFixed(2)}`);
});

test('le ancore della tavolozza sono poche e distinte', () => {
  assert(ANCORE.length >= 2 && ANCORE.length <= 4, 'servono da due a quattro tinte dominanti');
  for (let i = 0; i < ANCORE.length; i += 1) {
    for (let j = i + 1; j < ANCORE.length; j += 1) {
      const grezza = Math.abs(ANCORE[i].tinta - ANCORE[j].tinta) % 360;
      const distanza = grezza > 180 ? 360 - grezza : grezza;
      assert(distanza > 40, `le ancore ${i} e ${j} sono troppo vicine (${distanza} gradi)`);
    }
  }
});

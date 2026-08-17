// Una tela: un canvas 2D che fa da texture a uno sprite di Pixi.
//
// E' il ponte fra le due meta' del gioco. La scena continua a essere **dipinta**
// col canvas 2D — un viale milanese fatto di quadrilateri prospettici e' molto
// piu' semplice da scrivere cosi' che da montare con migliaia di sprite — ma
// ogni pezzo di scena finisce sulla sua tela, e da li' in poi e' una texture
// come le altre: si sposta, si sfoca, si illumina, passa nei filtri.
//
// Due cose da sapere.
//
// **La scala.** Una tela puo' lavorare a meno pixel dello schermo. Le quinte
// vengono comunque sfocate dalla profondita' di campo, e le emissive vengono
// sfocate dal bloom: tenerle a piena risoluzione vuol dire caricare sulla GPU
// pixel che verranno buttati via. E' li' che si guadagna il fotogramma su
// telefono, non nei filtri.
//
// **Il ritaglio.** Una tela puo' coprire solo una parte dello schermo. Il
// personaggio e gli inseguitori stanno sempre nella meta' bassa: una tela di
// quella meta' costa la meta'. Il ritaglio deve pero' restare **dentro lo
// schermo**, perche' i filtri delle luci ricevono le posizioni in coordinate
// del proprio riquadro e Pixi il riquadro lo taglia sul bordo della finestra.

import { CanvasSource, Sprite, Texture } from 'pixi.js';

export class Tela {
  /**
   * @param nome       serve solo a leggere i profili di memoria
   * @param scala      quanti pixel per pixel logico, rispetto alla risoluzione
   * @param ritaglio   { x, y, larghezza, altezza } in frazioni di schermo,
   *                   oppure null per tutto lo schermo
   */
  constructor({ nome, scala = 1, ritaglio = null }) {
    this.nome = nome;
    this.scala = scala;
    this.ritaglio = ritaglio;

    this.canvas = document.createElement('canvas');
    this.canvas.width = 2;
    this.canvas.height = 2;
    this.ctx = this.canvas.getContext('2d', { alpha: true, desynchronized: false });

    this.sorgente = new CanvasSource({
      resource: this.canvas,
      resolution: 1,
      antialias: false,
      autoGenerateMipmaps: false,
      alphaMode: 'premultiply-alpha-on-upload',
    });
    this.sorgente.style.scaleMode = 'linear';
    this.sorgente.style.addressMode = 'clamp-to-edge';

    this.texture = new Texture({ source: this.sorgente });
    this.sprite = new Sprite(this.texture);

    /** L'area che questa tela copre, in pixel logici di schermo. */
    this.area = { x: 0, y: 0, larghezza: 0, altezza: 0 };
  }

  /** @param risoluzione i pixel fisici per pixel logico dello schermo. */
  ridimensiona(larghezzaSchermo, altezzaSchermo, risoluzione) {
    const r = this.ritaglio;
    const area = r
      ? {
          x: Math.floor(r.x * larghezzaSchermo),
          y: Math.floor(r.y * altezzaSchermo),
          larghezza: Math.ceil(r.larghezza * larghezzaSchermo),
          altezza: Math.ceil(r.altezza * altezzaSchermo),
        }
      : { x: 0, y: 0, larghezza: larghezzaSchermo, altezza: altezzaSchermo };

    // dentro lo schermo, sempre: vedi la nota in testa al file
    area.larghezza = Math.min(area.larghezza, larghezzaSchermo - area.x);
    area.altezza = Math.min(area.altezza, altezzaSchermo - area.y);
    this.area = area;

    this.sorgente.resize(area.larghezza, area.altezza, risoluzione * this.scala);
    // riassegnare canvas.width azzera anche la trasformazione: va rimessa
    this.ctx.setTransform(
      risoluzione * this.scala,
      0,
      0,
      risoluzione * this.scala,
      0,
      0,
    );
    // la Texture segue da sola la sorgente: e' nata senza `frame`, e sull'evento
    // di ridimensionamento si riallinea

    this.sprite.position.set(area.x, area.y);
    this.sprite.width = area.larghezza;
    this.sprite.height = area.altezza;
  }

  /** Prepara la tela per il fotogramma e ritorna il contesto su cui dipingere.
   *  L'origine e' quella dello schermo, non del ritaglio: il codice di disegno
   *  ragiona sempre in coordinate di schermo, e la traslazione la fa qui. */
  apri() {
    const { ctx, area } = this;
    ctx.save();
    ctx.clearRect(0, 0, area.larghezza, area.altezza);
    ctx.translate(-area.x, -area.y);
    return ctx;
  }

  /** Chiude il fotogramma e manda la tela alla GPU. */
  chiudi() {
    this.ctx.restore();
    this.sorgente.update();
  }
}

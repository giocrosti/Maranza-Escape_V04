// La pila dei piani di profondita', e come si rimettono insieme.
//
// Prima c'era una tela sola e un ordine di disegno. Adesso ci sono otto piani,
// ognuno alla sua distanza, e la distanza decide tre cose insieme:
//
//   quanto scorre   piu' e' vicino, piu' corre (e' la parallasse)
//   quanta aria     piu' e' lontano, piu' e' slavato, chiaro e sfocato
//   quanta luce     le luci puntiformi arrivano solo ai piani vicini
//
//   n.  piano         parallasse   com'e' fatto
//   --------------------------------------------------------------------------
//   0   cielo            0.02      striscia fissa + nuvole ripetibili
//   1   lontano          0.16      profilo di citta', quasi solo foschia
//   2   medio            0.40      secondo profilo, piu' scuro e piu' netto
//   3   scena            1.00      strada, palazzi, ostacoli: in prospettiva
//   4   personaggi       1.00      omino e maranza: illuminazione piena
//   5   emissive         1.00      solo cio' che brilla, per il bloom
//   6   vicino           1.85      pali e fusti che passano ai lati
//   7   vicinissimo      2.90      fogliame appeso al bordo alto, fuori fuoco
//
// I piani 3 e 4 non hanno un fattore di parallasse perche' non ne hanno bisogno:
// sono in prospettiva, e la parallasse gliela fa la proiezione stessa — una cosa
// a cinquanta metri si sposta di un decimo di una a cinque. Il numero 1.00 e' li'
// per ricordare che sono loro il metro di paragone degli altri.
//
// Un vincolo che vale per tutta la pila: **i filtri che leggono una posizione
// dentro l'immagine non possono avere padding**. La profondita' di campo legge
// `uv.y` per sapere quanto e' lontano un pixel, le luci leggono `uv` per sapere
// dove sono: se qualcuno nella stessa catena chiedesse del padding, Pixi
// allargherebbe il riquadro e quelle coordinate punterebbero altrove. Per questo
// la sfocatura dei piani 3 e 4 sta *dentro* i loro filtri, e i BlurFilter di
// Pixi si usano solo sui fondali piatti, dove nessuno legge posizioni.

import { BlurFilter, CanvasSource, Container, Sprite, Texture, TilingSprite } from 'pixi.js';

import { Tela } from './tela.js';
import { creaFiltroProfondita } from './filtri/profondita.js';
import { creaFiltroLuce } from './filtri/luce.js';
import { creaFiltroColore } from './filtri/colore.js';
import { creaFiltroBordo } from './filtri/bordo.js';
import { creaCanvasLut } from './tavolozza.js';
import { OPZIONI } from './opzioni.js';

import {
  texturaCielo,
  texturaNuvole,
  texturaProfilo,
  texturaPaliVicini,
  texturaFogliame,
  cuociAria,
} from '../scena/fondali.js';
import { raccogliLuci, luciNelRiquadro } from '../scena/luci.js';
import { disegnaEmissive } from '../scena/emissive.js';
import {
  creaParticelle,
  consumaEventi,
  avanzaParticelle,
  disegnaParticelle,
  quanteVive,
} from '../scena/particelle.js';
import { creaCamera, avanzaCamera, SOVRAMISURA } from './camera.js';
import { minaccia } from '../inseguitori.js';
import { VELOCITA_MASSIMA } from '../costanti.js';
import { CITTA, disegnaQuinte, disegnaCampo, disegnaPersonaggi } from '../render.js';

/** Quanti pixel vale un metro per i fondali piatti. Non e' una misura vera —
 *  un fondale piatto non ha una distanza — e' la scala che rende leggibile la
 *  differenza fra un piano e l'altro senza che il cielo sfarfalli. */
const PIXEL_PER_METRO = 1 / 60;

/** I fattori di parallasse, uno per piano. Cambiarli e' il modo piu' rapido di
 *  cambiare quanto e' profonda la scena. */
export const PARALLASSE = {
  cielo: 0.02,
  lontano: 0.16,
  medio: 0.4,
  vicino: 1.85,
  vicinissimo: 2.9,
};

/** Quanto si allarga la scala della parallasse quando si corre al massimo.
 *
 *  Non e' realismo — la parallasse vera dipende solo dalla distanza, non da
 *  quanto vai forte — ed e' voluto: allargando la forbice fra i piani lontani e
 *  quelli vicini, la velocita' si **vede** invece di doverla leggere sul
 *  contatore. I piani lontani restano quasi fermi, i vicini schizzano. */
const SPINTA_PARALLASSE = 0.85;

/** Quanti pixel di sfocatura orizzontale prendono i piani vicini a tutta
 *  velocita'. Solo orizzontale: e' la direzione in cui si muovono, e sfocare
 *  anche in verticale farebbe solo una macchia. */
const SFOCATURA_MOTO = 9;

export class Scena {
  constructor(app) {
    this.app = app;

    /** Tutto quello che passa dal post-processing. L'interfaccia no: sta su una
     *  tela 2D sopra il canvas di Pixi. */
    this.palco = new Container();
    app.stage.addChild(this.palco);

    this.larghezza = 0;
    this.altezza = 0;
    this.orizzonte = 0;

    /** Le texture dei fondali, per chiave. Si rifanno a ogni ridimensionamento e
     *  la vecchia va buttata: senza, ruotare il telefono qualche volta lascia in
     *  memoria una decina di immagini a schermo intero. */
    this._fondali = {};

    this.camera = creaCamera();
    this.particelle = creaParticelle();

    /** Lo scorrimento di ogni fondale, accumulato **a ogni passo** invece che
     *  ricavato da `mondo.scorrimento`.
     *
     *  Sembra un giro lungo per lo stesso numero, e non lo e': la spinta della
     *  parallasse cambia con la velocita', e moltiplicare per un fattore che
     *  cambia una distanza gia' accumulata farebbe saltare tutti i fondali di
     *  colpo a ogni variazione. Integrando passo per passo, la spinta agisce
     *  sulla derivata e non sulla posizione, e non si vede nessun salto. */
    this._scorrimenti = { cielo: 0, lontano: 0, medio: 0, vicino: 0, vicinissimo: 0 };

    this._costruisciFondali();
    this._costruisciPianiVivi();
    this._costruisciPrimiPiani();
    this._costruisciPostProcessing();
    this._applicaOpzioni();
  }

  /** Spegne gli stadi che la riga d'indirizzo chiede di spegnere. Un filtro
   *  spento resta al suo posto con `enabled = false`: non si ricostruisce
   *  niente, e riaccenderlo e' un assegnamento. */
  _applicaOpzioni() {
    if (!OPZIONI.strati) {
      this.cielo.visible = false;
      this.lontano.visible = false;
      this.medio.visible = false;
      this.vicino.visible = false;
      this.vicinissimo.visible = false;
    }
    if (!OPZIONI.aria) {
      // I fondali piatti non hanno piu' filtri da spegnere: la loro aria e'
      // cotta nella texture, e con l'interruttore giu' `_ariaDi` non la mette.
      this.filtroProfondita.enabled = false;
    }
    if (!OPZIONI.luci) {
      this.filtroLuceScena.enabled = false;
      this.filtroLucePersonaggi.enabled = false;
      this.bagliore.visible = false;
    }
    if (!OPZIONI.post) {
      this.filtroColore.enabled = false;
      this.filtroBordo.enabled = false;
    }
  }

  // --- costruzione ----------------------------------------------------------

  _costruisciFondali() {
    // Nessuno di questi tre ha filtri: la loro dose d'aria e' costante e viene
    // **cotta dentro la texture** quando la striscia nasce (vedi `cuociAria`).
    // Erano cinque passate a schermo intero per fotogramma che davano sempre lo
    // stesso risultato; toglierle e' stato il guadagno piu' grosso di tutti.

    // piano 0: il cielo. Il gradiente non si muove, le nuvole appena.
    this.cielo = new Container();
    this.spriteCielo = new Sprite(Texture.WHITE);
    this.nuvole = new TilingSprite({ texture: Texture.WHITE, width: 1, height: 1 });
    this.cielo.addChild(this.spriteCielo, this.nuvole);
    this.palco.addChild(this.cielo);

    // piano 1: il profilo lontano. E' quasi solo aria: piu' foschia che citta'.
    this.lontano = new TilingSprite({ texture: Texture.WHITE, width: 1, height: 1 });
    this.palco.addChild(this.lontano);

    // piano 2: il secondo profilo. Piu' vicino, piu' scuro, quasi a fuoco.
    this.medio = new TilingSprite({ texture: Texture.WHITE, width: 1, height: 1 });
    this.palco.addChild(this.medio);
  }

  /** L'aria cotta dentro ogni fondale, per nome. Con `?aria=0` diventa niente:
   *  gli interruttori devono spegnere anche quello che non e' un filtro. */
  _ariaDi(nome) {
    if (!OPZIONI.aria) return {};
    return {
      nuvole: {
        aria: [0.88, 0.92, 0.95, 0.1],
        desaturazione: 0.14,
        contrasto: 0.95,
        luminosita: 0.02,
        sfocatura: 3,
      },
      lontano: {
        aria: [0.85, 0.9, 0.94, 0.45],
        desaturazione: 0.6,
        contrasto: 0.78,
        luminosita: 0.08,
        sfocatura: 2.5,
      },
      medio: {
        aria: [0.83, 0.88, 0.93, 0.34],
        desaturazione: 0.44,
        contrasto: 0.84,
        luminosita: 0.05,
        sfocatura: 1.4,
      },
      vicino: {
        aria: [0.1, 0.12, 0.16, 0.14],
        desaturazione: 0.1,
        contrasto: 1.06,
        luminosita: -0.06,
        opacita: 0.5,
      },
      vicinissimo: {
        aria: [0.08, 0.1, 0.12, 0.2],
        desaturazione: 0.06,
        contrasto: 1.1,
        luminosita: -0.1,
        opacita: 0.38,
      },
    }[nome] || {};
  }

  _costruisciPianiVivi() {
    // piano 3: la scena in prospettiva. Strada, citta', ostacoli e monete stanno
    // sulla stessa tela apposta: cosi' una buca a quaranta metri prende la
    // stessa sfocatura del palazzo che le sta accanto, che e' l'unica cosa che
    // ha senso. La profondita' di campo li separa da sola.
    this.telaScena = new Tela({ nome: 'scena', scala: 1 });
    this.filtroLuceScena = creaFiltroLuce({
      // sulla scena la luce serve solo a far posare le luci puntiformi: il
      // volume ce l'ha gia', glielo danno le tre facce di ogni volume
      misto: { illuminazione: 0.34, luci: 1 },
      rim: [0.55, -0.5, 2.4, 0.0],
      rilievo: { vicino: 2, lontano: 5, forza: 0.9 },
    });
    // Tarato guardando gli scatti, non a tavolino. La prima versione (aria 0.48,
    // desaturazione 0.4) cancellava il Duomo: un monumento deve arrivare come un
    // momento, e se la foschia se lo mangia il momento non c'e'.
    this.filtroProfondita = creaFiltroProfondita({
      aria: [0.82, 0.87, 0.92, 0.3],
      fuoco: 0.42,
      sfocatura: 3,
      potenza: 1.8,
      tono: { desaturazione: 0.26, contrasto: 0.93, luminosita: 0.04 },
    });
    this.telaScena.sprite.filters = [this.filtroLuceScena, this.filtroProfondita];
    this.palco.addChild(this.telaScena.sprite);

    // piano 4: le persone. Ritagliate sulla meta' bassa dello schermo, che e'
    // dove stanno sempre: la tela costa il ritaglio, non lo schermo.
    this.telaPersonaggi = new Tela({
      nome: 'personaggi',
      scala: 1,
      ritaglio: { x: 0, y: 0.34, larghezza: 1, altezza: 0.66 },
    });
    this.filtroLucePersonaggi = creaFiltroLuce({
      // ambiente + sole devono stare sotto 1: l'omino e' quasi bianco, e sopra
      // 1 il volume che si e' appena costruito si perde tutto nel bianco
      // Ambiente + sole si tengono sotto 1 apposta. L'omino e' quasi bianco: se
      // il corpo arriva gia' al bianco, la rim light non ha piu' dove salire e
      // il contorno sparisce nel corpo. Lasciandogli un margine, la rim ha un
      // decimo di scala per accendersi, ed e' li' che si vede.
      sole: [-0.42, -0.6, 0.68, 0.4],
      // poco giallo: un sole caldo porta subito il bianco al color crema, che e'
      // il colore di tutto il resto, e cosi' l'omino smette di staccare
      coloreSole: [1.0, 0.97, 0.92, 0.52],
      // la rim arriva da dietro-destra e taglia in alto
      rim: [0.62, -0.48, 2.0, 1.25],
      // fredda e satura: su una figura bianca il contorno non puo' staccare per
      // luminosita', deve staccare per colore
      coloreRim: [0.42, 0.7, 1.0],
      rilievo: { vicino: 2.6, lontano: 7.5, forza: 2.4 },
      // Le luci puntiformi sull'omino si tengono al 60%: a piena forza una
      // moneta a mezzo metro lo investe come un faro, e una moneta non e' un
      // faro. Devono tingerlo, non accenderlo.
      misto: { illuminazione: 1, luci: 0.6 },
    });
    this.telaPersonaggi.sprite.filters = [this.filtroLucePersonaggi];
    this.palco.addChild(this.telaPersonaggi.sprite);

    // piano 5: le emissive. Mezza risoluzione, perche' e' tutto sfocato comunque.
    this.telaEmissive = new Tela({ nome: 'emissive', scala: 0.5 });
    this.bagliore = new Container();
    // due passate: una stretta che fa il nocciolo, una larga che fa l'alone
    this.bagliorStretto = new Sprite(this.telaEmissive.texture);
    this.bagliorStretto.blendMode = 'add';
    this.bagliorStretto.filters = [new BlurFilter({ strength: 5, quality: 2, resolution: 0.5 })];
    this.bagliorLargo = new Sprite(this.telaEmissive.texture);
    this.bagliorLargo.blendMode = 'add';
    this.bagliorLargo.alpha = 0.28;
    this.bagliorLargo.filters = [new BlurFilter({ strength: 16, quality: 3, resolution: 0.25 })];
    this.bagliore.addChild(this.bagliorLargo, this.bagliorStretto);
    this.palco.addChild(this.bagliore);
  }

  _costruisciPrimiPiani() {
    // La sfocatura dei primi piani si tiene da parte: a ogni fotogramma le si
    // allarga il solo asse orizzontale con la velocita' di corsa, ed e' quella
    // che fa sentire lo sprint.
    this.sfocaturaVicino = new BlurFilter({ strength: 4, quality: 2, resolution: 0.5 });
    this.sfocaturaVicinissimo = new BlurFilter({ strength: 5, quality: 2, resolution: 0.4 });

    // Sui due primi piani il filtro di sfocatura resta, perche' e' l'unico che
    // cambia davvero da un fotogramma all'altro: si allunga con la velocita'.
    // Tinta e opacita' invece sono cotte nella texture come per gli altri.

    // piano 6: pali e fusti ai lati. Contrasto pieno, sfocatura appena.
    this.vicino = new TilingSprite({ texture: Texture.WHITE, width: 1, height: 1 });
    this.vicino.filters = [this.sfocaturaVicino];
    this.palco.addChild(this.vicino);

    // piano 7: il fogliame appeso in alto. Non si deve riconoscere niente.
    this.vicinissimo = new TilingSprite({ texture: Texture.WHITE, width: 1, height: 1 });
    this.vicinissimo.filters = [this.sfocaturaVicinissimo];
    this.palco.addChild(this.vicinissimo);
  }

  _costruisciPostProcessing() {
    // La LUT si costruisce una volta sola all'avvio: e' un canvas 256x16.
    this.texturaLut = Texture.from(creaCanvasLut());
    this.filtroColore = creaFiltroColore(this.texturaLut, { forza: 1 });
    this.filtroBordo = creaFiltroBordo({
      aberrazione: 0.02,
      vignetta: { forza: 0.34, raggio: 0.82, morbidezza: 0.42 },
      grana: 0.012,
    });
    // L'ordine conta: prima si decide il colore dell'immagine, poi le si mette
    // addosso l'obiettivo. Invertendoli la LUT graderebbe anche le frange
    // dell'aberrazione, e le farebbe rientrare nella palette invece di lasciarle
    // sporche come devono essere.
    this.palco.filters = [this.filtroColore, this.filtroBordo];
  }

  // --- ridimensionamento ----------------------------------------------------

  /** Rifa' un fondale e butta quello di prima. Mai `texture.destroy()` diretto
   *  su quella che c'e': al primo giro e' `Texture.WHITE`, che e' condivisa da
   *  mezzo Pixi e distruggerla svuota lo schermo senza dire perche'.
   *
   *  La sorgente si costruisce a mano, invece di usare `Texture.from`, per una
   *  ragione sola ma decisiva: **l'alpha di un canvas 2D non e' premoltiplicata**.
   *  Caricarla come se lo fosse schiarisce tutto quello che e' semitrasparente
   *  in proporzione a quanto e' trasparente — un fusto scuro al 7% di opacita'
   *  diventa una colonna chiara. Il difetto e' rimasto nascosto finche' questi
   *  fondali avevano davanti un filtro che divideva per alpha e rimoltiplicava:
   *  quel filtro rimetteva le cose a posto per caso, e togliendolo e' venuto
   *  fuori. */
  _fondale(chiave, canvas) {
    const sorgente = new CanvasSource({
      resource: canvas,
      resolution: 1,
      antialias: false,
      autoGenerateMipmaps: false,
      alphaMode: 'premultiply-alpha-on-upload',
    });
    sorgente.style.addressMode = 'repeat';
    sorgente.style.scaleMode = 'linear';

    const nuova = new Texture({ source: sorgente });
    const vecchia = this._fondali[chiave];
    if (vecchia) vecchia.destroy(true);
    this._fondali[chiave] = nuova;
    return nuova;
  }

  ridimensiona(larghezza, altezza, orizzonte, risoluzione) {
    this.larghezza = larghezza;
    this.altezza = altezza;
    this.orizzonte = orizzonte;

    // Il palco si scuote e ruota attorno al proprio centro, quindi il perno va
    // in mezzo; e sta un filo piu' grande dello schermo, o lo scossone
    // scoprirebbe i bordi e si vedrebbe il fondo.
    this.palco.pivot.set(larghezza / 2, altezza / 2);
    this.palco.position.set(larghezza / 2, altezza / 2);
    this.palco.scale.set(SOVRAMISURA);

    const doppio = Math.ceil(larghezza * 2);

    // piano 0
    this.spriteCielo.texture = this._fondale('cielo', texturaCielo(larghezza, altezza, orizzonte));
    this.spriteCielo.width = larghezza;
    this.spriteCielo.height = altezza;

    const altezzaNuvole = Math.max(8, orizzonte * 0.82);
    this.nuvole.texture = this._fondale(
      'nuvole',
      cuociAria(texturaNuvole(doppio, altezzaNuvole), this._ariaDi('nuvole')),
    );
    this.nuvole.width = larghezza;
    this.nuvole.height = altezzaNuvole;
    this.nuvole.position.set(0, 0);

    // piano 1
    const altezzaLontano = Math.max(10, altezza * 0.24);
    this.lontano.texture = this._fondale(
      'lontano',
      cuociAria(
        texturaProfilo(doppio, altezzaLontano, {
          colore: 'rgba(122,142,164,0.62)',
          seme: 3,
          densita: 13,
          altezzaMax: 0.88,
        }),
        this._ariaDi('lontano'),
      ),
    );
    this.lontano.width = larghezza;
    this.lontano.height = altezzaLontano;
    this.lontano.position.set(0, orizzonte + 1 - altezzaLontano);

    // piano 2
    const altezzaMedio = Math.max(8, altezza * 0.16);
    this.medio.texture = this._fondale(
      'medio',
      cuociAria(
        texturaProfilo(doppio, altezzaMedio, {
          colore: 'rgba(96,116,138,0.78)',
          seme: 11,
          densita: 9,
          altezzaMax: 0.82,
        }),
        this._ariaDi('medio'),
      ),
    );
    this.medio.width = larghezza;
    this.medio.height = altezzaMedio;
    this.medio.position.set(0, orizzonte + 2 - altezzaMedio);

    // piani 3, 4, 5
    this.telaScena.ridimensiona(larghezza, altezza, risoluzione);
    this.telaPersonaggi.ridimensiona(larghezza, altezza, risoluzione);
    this.telaEmissive.ridimensiona(larghezza, altezza, risoluzione);
    this.bagliorStretto.width = larghezza;
    this.bagliorStretto.height = altezza;
    this.bagliorLargo.width = larghezza;
    this.bagliorLargo.height = altezza;

    // piano 6
    this.vicino.texture = this._fondale(
      'vicino',
      cuociAria(texturaPaliVicini(doppio, altezza), this._ariaDi('vicino')),
    );
    this.vicino.width = larghezza;
    this.vicino.height = altezza;

    // piano 7
    const altezzaFogliame = Math.max(20, altezza * 0.24);
    this.vicinissimo.texture = this._fondale(
      'vicinissimo',
      cuociAria(texturaFogliame(doppio, altezzaFogliame), this._ariaDi('vicinissimo')),
    );
    this.vicinissimo.width = larghezza;
    this.vicinissimo.height = altezzaFogliame;
    this.vicinissimo.position.set(0, 0);

    // i filtri che devono sapere com'e' fatto lo schermo
    this.filtroProfondita.impostaOrizzonte(orizzonte / altezza);
    this.filtroBordo.impostaMisura(larghezza, altezza);
  }

  // --- fotogramma -----------------------------------------------------------

  aggiorna(mondo, dt = 0) {
    // Quanto si sta correndo, da 0 a 1. E' il numero che spinge la parallasse,
    // allunga la sfocatura orizzontale e detta quanta polvere si alza.
    const corsa = Math.min(1, mondo.velocita / VELOCITA_MASSIMA);
    const vicinanza = minaccia(mondo.inseguitori);

    // Durante il fermo immagine il mondo non avanza, e non devono avanzare
    // nemmeno fondali e particelle: se la polvere continuasse a salire mentre
    // tutto il resto e' fermo, il fermo immagine si leggerebbe come uno scatto
    // del gioco invece che come un accento voluto. Lo scossone invece prosegue,
    // ed e' proprio quel contrasto — tutto fermo tranne la scossa — a dare il
    // colpo.
    const passoMondo = mondo.fermoImmagine > 0 || mondo.stato === 'pausa' ? 0 : dt;

    this._muoviFondali(mondo, passoMondo, corsa);
    this._scuotiPalco(dt, mondo.scossa, vicinanza);
    this._sfocaturaDiMoto(corsa);

    // le luci del fotogramma: una lista sola, per i filtri e per il bagliore
    const luci = raccogliLuci(mondo, CITTA);

    // Le particelle: prima si prendono i fatti del mondo, poi si integrano.
    // In quest'ordine, la polvere di un passo appena avvenuto ha gia' fatto il
    // suo primo passo di integrazione quando la si disegna, e non appare
    // incollata al piede.
    consumaEventi(this.particelle, mondo);
    avanzaParticelle(this.particelle, passoMondo, mondo.velocita);

    // piano 3: prospettiva
    const ctxScena = this.telaScena.apri();
    disegnaQuinte(ctxScena, mondo);
    disegnaCampo(ctxScena, mondo);
    disegnaParticelle(ctxScena, mondo.vista, this.particelle);
    this.telaScena.chiudi();

    // piano 4: le persone
    const ctxPersone = this.telaPersonaggi.apri();
    disegnaPersonaggi(ctxPersone, mondo);
    this.telaPersonaggi.chiudi();

    // piano 5: quello che brilla
    const ctxEmissive = this.telaEmissive.apri();
    disegnaEmissive(ctxEmissive, luci);
    this.telaEmissive.chiudi();

    // ogni filtro vuole le luci in coordinate del proprio riquadro
    this.filtroLuceScena.caricaLuci(luciNelRiquadro(luci, this.telaScena.area));
    this.filtroLucePersonaggi.caricaLuci(luciNelRiquadro(luci, this.telaPersonaggi.area));

    this.filtroBordo.impostaMinaccia(vicinanza, mondo.tempo);
  }

  /** La parallasse, integrata passo per passo e spinta dalla velocita'. */
  _muoviFondali(mondo, dt, corsa) {
    const avanzamento = mondo.velocita * dt * this.larghezza * PIXEL_PER_METRO;
    const spinta = 1 + corsa * SPINTA_PARALLASSE;

    for (const nome of Object.keys(this._scorrimenti)) {
      // La spinta agisce solo sui piani vicini: allargare anche il cielo
      // toglierebbe la forbice invece di aprirla, ed e' la forbice che si vede.
      const fattore = PARALLASSE[nome];
      const suo = fattore > 1 ? spinta : 1 + (spinta - 1) * 0.15;
      this._scorrimenti[nome] += avanzamento * fattore * suo;
    }

    this.nuvole.tilePosition.x = -this._scorrimenti.cielo;
    this.lontano.tilePosition.x = -this._scorrimenti.lontano;
    this.medio.tilePosition.x = -this._scorrimenti.medio;
    this.vicino.tilePosition.x = -this._scorrimenti.vicino;
    this.vicinissimo.tilePosition.x = -this._scorrimenti.vicinissimo;
  }

  /** Lo scossone. Si muove il palco, mai l'interfaccia. */
  _scuotiPalco(dt, scossa, vicinanza) {
    avanzaCamera(this.camera, dt, scossa, vicinanza);
    this.palco.position.set(
      this.larghezza / 2 + this.camera.x,
      this.altezza / 2 + this.camera.y,
    );
    this.palco.rotation = this.camera.rotazione;
  }

  /** Sfocatura direzionale sui piani vicini: solo orizzontale, perche' e' la
   *  direzione in cui scorrono. La verticale resta al valore di riposo, che e'
   *  quello che li tiene fuori fuoco. */
  _sfocaturaDiMoto(corsa) {
    const strascico = corsa * corsa * SFOCATURA_MOTO;
    // `strengthX`/`strengthY`, non `blurX`/`blurY`: quelli sono deprecati da
    // PixiJS 8.3 e stampano un avviso a ogni fotogramma.
    this.sfocaturaVicino.strengthX = 4 + strascico;
    this.sfocaturaVicino.strengthY = 4;
    this.sfocaturaVicinissimo.strengthX = 5 + strascico * 1.4;
    this.sfocaturaVicinissimo.strengthY = 5;
  }

  /** Quante particelle stanno vivendo: per il pannello di diagnostica. */
  get particelleVive() {
    return quanteVive(this.particelle);
  }
}

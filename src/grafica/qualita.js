// La qualita' che si adatta da sola.
//
// Il problema onesto: **non si puo' sapere in anticipo se un telefono ce la
// fa.** Il bersaglio dichiarato e' un iPhone 15 Pro, ma lo stesso file lo apre
// un iPhone di sei anni fa, o un 15 Pro col telefono caldo e la batteria al
// dieci per cento, che va la meta'. Scegliere una risoluzione fissa vuol dire
// sbagliarla per qualcuno, sempre.
//
// Quindi non si sceglie: si misura. La catena di filtri costa in proporzione ai
// pixel, quindi scendere da 2 a 1,5 toglie il 44% del lavoro dove il lavoro sta
// davvero.
//
// **Ma scendere costa nitidezza, e la nitidezza si vede subito.** La prima
// versione di questo file scendeva al primo brutto quarto di secondo e non
// risaliva mai piu': bastava un inciampo all'avvio — le prime texture che si
// caricano, i primi shader che si compilano — e il gioco restava sgranato per
// tutta la sessione, senza che nessuno capisse perche'. E' esattamente quello
// che poi si racconta come "si vede tutto sfocato".
//
// Le tre regole che rimediano:
//
//   **si guarda tardi.** I primi secondi non si giudicano affatto: e' il momento
//   in cui il gioco sta ancora sistemandosi, e non dice niente su come andra'.
//   **si scende con prove ripetute.** Non un campione brutto, tre di fila.
//   **si risale.** Con isteresi larga — per tornare su serve andare molto
//   meglio della soglia per cui si era scesi — cosi' non si oscilla, ma un
//   rallentamento passeggero non condanna la partita.

/** I gradini, dal migliore al peggiore. Non si scende sotto 1: da li' in giu'
 *  non e' piu' un compromesso, e' un'altra cosa. */
const GRADINI = [2, 1.5, 1.25, 1];

/** Quanti fotogrammi si guardano prima di dare un giudizio. */
const CAMPIONE = 90;

/** Quanti giudizi negativi di fila servono per scendere davvero. */
const CONFERME = 3;

/** Sopra questo tempo per fotogramma si sta perdendo il ritmo dei sessanta.
 *  20 ms, non 16,7: la tolleranza serve, o si scende per un nulla. */
const SOGLIA_GIU = 20;

/** Sotto questo si sta andando cosi' bene che si puo' riprovare a salire.
 *  La forbice fra le due soglie e' l'isteresi: e' larga apposta. */
const SOGLIA_SU = 13;

/** Quanti giudizi ottimi di fila servono per risalire. Molti piu' di quelli che
 *  servono a scendere: salire e' un lusso, scendere e' un rimedio. */
const CONFERME_SU = 8;

/** I primi fotogrammi non si giudicano: shader da compilare, texture da
 *  caricare, e il telefono che si sta ancora svegliando. */
const RODAGGIO = 180;

export function creaQualita(risoluzioneIniziale) {
  let gradino = 0;
  while (gradino < GRADINI.length - 1 && GRADINI[gradino] > risoluzioneIniziale) gradino += 1;

  return {
    gradino,
    tetto: gradino, // il gradino migliore a cui si puo' tornare
    risoluzione: Math.min(risoluzioneIniziale, GRADINI[gradino]),
    tempi: [],
    scarsi: 0,
    ottimi: 0,
    visti: 0,
  };
}

/**
 * Da chiamare a ogni fotogramma con il tempo che ha impiegato.
 * Ritorna la nuova risoluzione se e' cambiata, altrimenti null.
 */
export function valutaQualita(qualita, millisecondi) {
  // Un fotogramma lunghissimo e' quasi sempre la scheda tornata in primo piano
  // o il telefono che ha fatto altro: non e' un giudizio sulla grafica.
  if (millisecondi > 200) return null;

  qualita.visti += 1;
  if (qualita.visti < RODAGGIO) return null;

  qualita.tempi.push(millisecondi);
  if (qualita.tempi.length < CAMPIONE) return null;

  const ordinati = [...qualita.tempi].sort((a, b) => a - b);
  const p95 = ordinati[Math.floor((ordinati.length - 1) * 0.95)];
  qualita.tempi.length = 0;

  if (p95 > SOGLIA_GIU) {
    qualita.ottimi = 0;
    qualita.scarsi += 1;
    if (qualita.scarsi >= CONFERME && qualita.gradino < GRADINI.length - 1) {
      qualita.scarsi = 0;
      qualita.gradino += 1;
      qualita.risoluzione = GRADINI[qualita.gradino];
      return qualita.risoluzione;
    }
    return null;
  }

  qualita.scarsi = 0;
  if (p95 < SOGLIA_SU) {
    qualita.ottimi += 1;
    if (qualita.ottimi >= CONFERME_SU && qualita.gradino > qualita.tetto) {
      qualita.ottimi = 0;
      qualita.gradino -= 1;
      qualita.risoluzione = GRADINI[qualita.gradino];
      return qualita.risoluzione;
    }
  }
  return null;
}

// La cassa bluetooth che i maranza si portano dietro.
//
// E' un **indicatore di distanza travestito da colonna sonora**. Il giocatore
// corre guardando avanti e gli inseguitori stanno alle spalle: l'unico modo di
// dirgli quanto sono vicini senza costringerlo a leggere una barra e' dirglielo
// nell'orecchio. Piu' si avvicinano, piu' la cassa si sente; e non solo piu'
// forte, anche **piu' aperta** — da lontano arriva solo il colpo di cassa
// attraverso l'aria, da vicino si sentono anche i medi. E' cosi' che si sente
// la musica di qualcuno che ti sta arrivando dietro, in strada, davvero.
//
// Non c'e' nessun file audio. Il suono e' sintetizzato: una cassa dritta a
// quattro quarti fatta di un seno che scende in frequenza, piu' un hi-hat di
// rumore. Costa qualche decina di righe e zero byte da scaricare, e vuol dire
// che il service worker non deve mettere in cache niente perche' il gioco suoni
// anche offline.
//
// **iOS non fa suonare niente** finche' non c'e' stato un tocco: il contesto
// nasce sospeso e va ripreso dentro il gestore di un evento vero. Per questo
// `sblocca()` va chiamata dal primo tocco e non all'avvio.

/** I battiti al minuto. 128 e' la techno da cassa portatile, non e' un caso. */
const BPM = 128;

/** Sopra questo distacco non si sente piu' niente: la cassa e' un avviso di
 *  pericolo vicino, non un sottofondo perenne. */
const SILENZIO = 0.12;

export function creaCassa() {
  return {
    contesto: null,
    volume: null,
    filtro: null,
    battuto: 0,
    acceso: false,
    sospeso: true,
  };
}

/** Costruisce la catena audio. Va chiamata dentro un gesto dell'utente. */
export function sblocca(cassa) {
  if (cassa.contesto) {
    if (cassa.contesto.state === 'suspended') cassa.contesto.resume().catch(() => {});
    cassa.sospeso = false;
    return true;
  }

  const Contesto = window.AudioContext || window.webkitAudioContext;
  if (!Contesto) return false;

  try {
    const contesto = new Contesto();

    // Il filtro passa-basso e' quello che racconta la distanza: da lontano
    // taglia tutto tranne il colpo grave, da vicino lascia passare anche il
    // resto. Il volume da solo non basterebbe — una cassa lontana non e' una
    // cassa vicina abbassata, e l'orecchio lo sa.
    const filtro = contesto.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 180;
    filtro.Q.value = 0.8;

    const volume = contesto.createGain();
    volume.gain.value = 0;

    filtro.connect(volume);
    volume.connect(contesto.destination);

    cassa.contesto = contesto;
    cassa.filtro = filtro;
    cassa.volume = volume;
    cassa.sospeso = contesto.state === 'suspended';
    if (cassa.sospeso) contesto.resume().then(() => { cassa.sospeso = false; }).catch(() => {});
    return true;
  } catch {
    return false; // niente audio: si gioca lo stesso, si vede e basta
  }
}

/** Un colpo di cassa: un seno che scende da 130 a 45 Hz in un sesto di secondo.
 *  E' la sintesi piu' vecchia del mondo ed e' ancora quella che suona meglio. */
function colpo(cassa, quando, forza) {
  const c = cassa.contesto;
  const onda = c.createOscillator();
  const inviluppo = c.createGain();

  onda.frequency.setValueAtTime(130, quando);
  onda.frequency.exponentialRampToValueAtTime(45, quando + 0.16);

  inviluppo.gain.setValueAtTime(0.0001, quando);
  inviluppo.gain.exponentialRampToValueAtTime(forza, quando + 0.005);
  inviluppo.gain.exponentialRampToValueAtTime(0.0001, quando + 0.28);

  onda.connect(inviluppo);
  inviluppo.connect(cassa.filtro);
  onda.start(quando);
  onda.stop(quando + 0.3);
}

/** Il contrattempo: un colpetto di rumore fra una cassa e l'altra. Si sente
 *  solo da vicino, perche' e' tutto in alto e il filtro se lo mangia da lontano
 *  — ed e' esattamente il dettaglio che avverte "adesso sono qui". */
function contrattempo(cassa, quando, forza) {
  const c = cassa.contesto;
  const durata = 0.05;
  const campioni = Math.floor(c.sampleRate * durata);
  const buffer = c.createBuffer(1, campioni, c.sampleRate);
  const dati = buffer.getChannelData(0);
  for (let i = 0; i < campioni; i += 1) {
    dati[i] = (Math.random() * 2 - 1) * (1 - i / campioni);
  }

  const sorgente = c.createBufferSource();
  sorgente.buffer = buffer;

  const inviluppo = c.createGain();
  inviluppo.gain.value = forza * 0.35;

  sorgente.connect(inviluppo);
  inviluppo.connect(cassa.filtro);
  sorgente.start(quando);
}

/**
 * Da chiamare a ogni fotogramma.
 * @param vicinanza da 0 (lontanissimi) a 1 (addosso)
 * @param attiva    falso fuori dalla partita: sulla home non deve suonare
 */
export function aggiornaCassa(cassa, vicinanza, attiva) {
  if (!cassa.contesto || cassa.sospeso) return;
  const c = cassa.contesto;

  const forza = attiva ? Math.max(0, (vicinanza - SILENZIO) / (1 - SILENZIO)) : 0;

  // Le rampe sono lente apposta (un quinto di secondo): il volume deve seguire
  // la distanza, non sobbalzare a ogni fotogramma. E si usa `setTargetAtTime`
  // e non un assegnamento, o su ogni cambio si sente un clic.
  cassa.volume.gain.setTargetAtTime(forza * 0.5, c.currentTime, 0.2);
  cassa.filtro.frequency.setTargetAtTime(180 + forza * forza * 2600, c.currentTime, 0.25);

  if (forza <= 0.001) {
    cassa.acceso = false;
    return;
  }
  cassa.acceso = true;

  // Si programmano i battiti un po' in anticipo: chiedere al filo del tempo di
  // suonare "adesso" a ogni fotogramma da' un ritmo che sbanda, perche' i
  // fotogrammi non cadono mai esattamente a tempo.
  const battuta = 60 / BPM;
  const orizzonte = c.currentTime + 0.25;
  if (cassa.battuto < c.currentTime) cassa.battuto = c.currentTime + 0.05;

  while (cassa.battuto < orizzonte) {
    colpo(cassa, cassa.battuto, 0.9);
    contrattempo(cassa, cassa.battuto + battuta * 0.5, 1);
    cassa.battuto += battuta;
  }
}

/** Zittisce tutto: uscendo dall'app, in pausa, a partita finita. */
export function zittisci(cassa) {
  if (!cassa.contesto || !cassa.volume) return;
  cassa.volume.gain.setTargetAtTime(0, cassa.contesto.currentTime, 0.08);
  cassa.acceso = false;
}

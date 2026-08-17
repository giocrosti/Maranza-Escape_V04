// La qualita' che si adatta da sola.
//
// Il problema onesto: **non si puo' sapere in anticipo se un telefono ce la
// fa.** Il bersaglio dichiarato e' un iPhone 15 Pro, ma lo stesso file lo apre
// un iPhone di sei anni fa, o un 15 Pro col telefono caldo e la batteria al
// dieci per cento, che va la meta'. Scegliere una risoluzione fissa vuol dire
// sbagliarla per qualcuno, sempre.
//
// Quindi non si sceglie: si misura e si scende. La catena di filtri costa in
// proporzione ai pixel, quindi passare da 2 a 1,5 toglie il 44% del lavoro dove
// il lavoro sta davvero — e su uno schermo di telefono la differenza si vede
// poco, molto meno di quanto si veda uno scatto.
//
// Due cautele che rendono la cosa usabile invece che fastidiosa:
//
// - **si scende, non si risale.** Un sistema che oscilla fra due qualita' e'
//   peggio di uno lento: lo scalino si vede a ogni passaggio. Si scende e si
//   resta giu' per il resto della sessione.
// - **si guarda il novantacinquesimo percentile, non la media.** Il problema
//   sono gli scatti, e in una media gli scatti spariscono.

/** I gradini, dal migliore al peggiore. Non si scende sotto 1: da li' in giu'
 *  non e' piu' un compromesso, e' un'altra cosa. */
const GRADINI = [2, 1.5, 1.25, 1];

/** Quanti fotogrammi si guardano prima di decidere. Due secondi scarsi: meno
 *  vuol dire reagire a un rallentamento di passaggio (una texture che si
 *  carica), che non e' un problema di qualita'. */
const CAMPIONE = 90;

/** Sopra questo tempo per fotogramma si sta perdendo il ritmo dei sessanta.
 *  18 ms e non 16,7: un filo di tolleranza, o si scende per un nulla. */
const SOGLIA_MS = 18;

export function creaQualita(risoluzioneIniziale) {
  // si parte dal gradino piu' vicino a quello che il telefono dichiara
  let gradino = 0;
  while (gradino < GRADINI.length - 1 && GRADINI[gradino] > risoluzioneIniziale) gradino += 1;

  return {
    gradino,
    risoluzione: Math.min(risoluzioneIniziale, GRADINI[gradino]),
    tempi: [],
    scesoDaPoco: 0,
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

  qualita.tempi.push(millisecondi);
  if (qualita.tempi.length < CAMPIONE) return null;

  const ordinati = [...qualita.tempi].sort((a, b) => a - b);
  const p95 = ordinati[Math.floor((ordinati.length - 1) * 0.95)];
  qualita.tempi.length = 0;

  if (p95 <= SOGLIA_MS) return null;
  if (qualita.gradino >= GRADINI.length - 1) return null;

  qualita.gradino += 1;
  qualita.risoluzione = GRADINI[qualita.gradino];
  qualita.scesoDaPoco = 1;
  return qualita.risoluzione;
}

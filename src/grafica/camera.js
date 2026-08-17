// Lo scossone dello schermo.
//
// Due sorgenti, che si sommano ma non si somigliano:
//
//   il **colpo**   secco, forte, e finisce subito. Lo alza `mondo.scossa`.
//   il **tremore** basso e continuo, cresce col fiato sul collo. Non finisce
//                  mai finche' gli inseguitori sono vicini, e serve a rendere
//                  faticoso stare fermi a guardare.
//
// Lo spostamento non e' rumore a caso per fotogramma: e' una somma di seni a
// frequenze incommensurabili. La differenza si vede: il rumore per fotogramma a
// 60 al secondo sfarfalla, e a 120 sfarfalla il doppio senza scuotere di piu';
// una somma di seni scuote alla stessa velocita' su qualunque schermo, perche'
// e' funzione del tempo e non dei fotogrammi.
//
// Chi si scuote e' il **palco**, cioe' tutta la scena, non l'interfaccia: il
// punteggio deve restare fermo e leggibile mentre il mondo balla.

/** Di quanto si allarga il palco per non scoprire i bordi mentre trema.
 *  Uno scossone di venti pixel su uno schermo largo 393 chiede l'1% per lato:
 *  il 3% e' abbondante e non si nota. */
export const SOVRAMISURA = 1.03;

/** Ampiezza massima, in pixel logici, per uno scossone pieno. */
const AMPIEZZA_COLPO = 26;

/** Ampiezza del tremore continuo quando la minaccia e' al massimo. */
const AMPIEZZA_TREMORE = 4.5;

export function creaCamera() {
  return { tempo: 0, x: 0, y: 0, rotazione: 0 };
}

/**
 * @param scossa   da 0 a 1, l'impulso dei colpi (lo tiene `mondo.scossa`)
 * @param minaccia da 0 a 1, quanto sono vicini gli inseguitori
 */
export function avanzaCamera(camera, dt, scossa, minaccia) {
  camera.tempo += dt;
  const t = camera.tempo;

  // Il colpo cala di ampiezza col quadrato: parte forte e si spegne in fretta,
  // che e' come si comporta una botta vera.
  const colpo = scossa * scossa * AMPIEZZA_COLPO;
  const tremore = minaccia * minaccia * AMPIEZZA_TREMORE;

  // frequenze scelte per non tornare mai in fase fra loro: il moto non si
  // ripete, e quindi non si riconosce come un ciclo
  camera.x =
    Math.sin(t * 43.7) * colpo * 0.6 +
    Math.sin(t * 27.3 + 1.7) * colpo * 0.4 +
    Math.sin(t * 11.3) * tremore;
  camera.y =
    Math.sin(t * 51.1 + 0.6) * colpo * 0.55 +
    Math.sin(t * 33.9 + 2.4) * colpo * 0.45 +
    Math.sin(t * 8.7 + 1.2) * tremore * 0.8;
  // una punta di rotazione: e' quella che distingue uno scossone da una
  // traslazione, ed e' talmente poca che nessuno la vede come rotazione
  camera.rotazione = Math.sin(t * 19.7) * scossa * scossa * 0.012;

  return camera;
}

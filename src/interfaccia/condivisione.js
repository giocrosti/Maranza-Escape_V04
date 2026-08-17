// Mandare il record agli amici.
//
// Safari ha la Web Share API, ed e' l'unica strada che apre il **foglio di
// condivisione di sistema**: da li' si finisce su WhatsApp, in un messaggio, in
// una nota, ovunque la persona voglia. Fare un pulsante "copia negli appunti" e'
// una risposta a una domanda diversa.
//
// Due punti che non si possono saltare:
//
// - **`navigator.share` va chiamata dentro un gesto dell'utente.** Non dopo un
//   `await`, non in un `setTimeout`: Safari controlla che la chiamata parta
//   dalla catena di un evento vero, e se non lo e' rifiuta senza spiegazioni.
// - **L'annullamento non e' un errore.** Chi apre il foglio e cambia idea fa
//   arrivare un `AbortError`: mostrargli un messaggio di errore per aver deciso
//   di no e' maleducato.

/** Vero se il telefono sa condividere. Su un computer quasi sempre no. */
export function sapraCondividere() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

function testo(punteggio, metri, monete) {
  return (
    `Ho fatto ${punteggio} a Maranza Escape: ${metri} metri e ${monete} monete ` +
    `prima che mi facessero il portafoglio. Battimi.`
  );
}

/**
 * Apre il foglio di condivisione. Ritorna cosa e' successo, in una parola:
 * 'mandato' | 'annullato' | 'impossibile'.
 *
 * Va chiamata **direttamente** dal gestore del tocco.
 */
export async function condividiRecord(mondo) {
  if (!sapraCondividere()) return 'impossibile';

  const dati = {
    title: 'Maranza Escape',
    text: testo(mondo.punteggio, Math.floor(mondo.distanza), mondo.monete),
    // L'indirizzo del gioco, non quello della pagina corrente: se qualcuno
    // condivide mentre sta guardando una schermata con dei parametri strani
    // nell'indirizzo, l'amico si ritroverebbe il gioco configurato a caso.
    url: new URL('./', location.href).href,
  };

  try {
    await navigator.share(dati);
    return 'mandato';
  } catch (errore) {
    if (errore && errore.name === 'AbortError') return 'annullato';
    return 'impossibile';
  }
}

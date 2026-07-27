// Il record personale, conservato fra una sessione e l'altra.
// Il deposito e' iniettabile: i test non devono sporcare il record vero.

const CHIAVE = 'maranza-escape.record';

function depositoPredefinito() {
  // In navigazione privata o con i cookie bloccati l'accesso a localStorage
  // solleva un'eccezione gia' in lettura: in quel caso si gioca senza record.
  try {
    return window.localStorage;
  } catch (errore) {
    return null;
  }
}

export function leggiRecord(deposito = depositoPredefinito()) {
  if (!deposito) return 0;
  try {
    const valore = Number(deposito.getItem(CHIAVE));
    return Number.isFinite(valore) && valore > 0 ? Math.floor(valore) : 0;
  } catch (errore) {
    return 0;
  }
}

/** Salva il punteggio se batte il record. Ritorna il record aggiornato. */
export function aggiornaRecord(punteggio, deposito = depositoPredefinito()) {
  const attuale = leggiRecord(deposito);
  if (punteggio <= attuale) return attuale;
  if (!deposito) return punteggio;
  try {
    deposito.setItem(CHIAVE, String(Math.floor(punteggio)));
  } catch (errore) {
    /* deposito pieno o non scrivibile: il record vale solo per questa partita */
  }
  return Math.floor(punteggio);
}

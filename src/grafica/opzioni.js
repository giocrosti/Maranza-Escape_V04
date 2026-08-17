// Gli interruttori della grafica, letti dalla riga d'indirizzo.
//
//   ?strati=0   spegne i fondali a parallasse (cielo, profili, primi piani)
//   ?aria=0     spegne separazione atmosferica e profondita' di campo
//   ?luci=0     spegne illuminazione dinamica e bloom
//   ?post=0     spegne color grading, aberrazione e vignetta
//
// Servono a due cose, e sono la stessa cosa vista da due lati:
//
// - **confrontare.** Due scatti dello stesso identico fotogramma, uno con uno
//   stadio acceso e uno spento, dicono cosa fa quello stadio meglio di
//   qualunque descrizione. Con gli interruttori il confronto e' onesto: stessa
//   build, stesso seme, stessa posa.
// - **trovare il colpevole.** Quando l'immagine e' sbagliata e gli stadi sono
//   cinque, spegnerne uno alla volta e' l'unico modo che non richieda fortuna.

const PRESENTI = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

function acceso(nome) {
  const valore = PRESENTI.get(nome);
  return valore !== '0' && valore !== 'no' && valore !== 'false';
}

export const OPZIONI = {
  strati: acceso('strati'),
  aria: acceso('aria'),
  luci: acceso('luci'),
  post: acceso('post'),
};

/** Vero se qualcosa e' stato spento: serve solo a dirlo negli scatti. */
export function tuttoAcceso() {
  return OPZIONI.strati && OPZIONI.aria && OPZIONI.luci && OPZIONI.post;
}

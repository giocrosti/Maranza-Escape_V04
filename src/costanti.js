// Costanti condivise. Stanno qui, e non in mondo.js, perche' le usano moduli
// che mondo.js importa a sua volta: metterle li' creerebbe un giro di import.
//
// L'unita' di misura del mondo e' il METRO, non il pixel: cosi' le regole del
// gioco (quanto e' larga una corsia, quanto si salta) non cambiano al cambiare
// dello schermo. La conversione in pixel la fa solo proiezione.js.

/** Le corsie della strada, numerate da 0 a 2 partendo da sinistra. */
export const CORSIE = 3;

/** Larghezza di una corsia, in metri. */
export const LARGHEZZA_CORSIA = 2;

/** Meta' della carreggiata: da -3 a +3 metri rispetto alla riga centrale. */
export const SEMI_STRADA = (CORSIE * LARGHEZZA_CORSIA) / 2;

/** Gravita', in metri al secondo quadrato. Piu' alta di quella vera (9,81):
 *  con la gravita' reale il salto resta in aria un'eternita' e il gioco
 *  diventa molle. */
export const GRAVITA = 26;

/** Spinta iniziale del salto, in metri al secondo.
 *  Con questa gravita' fa un salto alto 1,3 m che dura 0,63 s. */
export const VELOCITA_SALTO = 8.2;

/** Quanto si resta abbassati, in secondi. */
export const DURATA_SCIVOLATA = 0.62;

/** Quanto ci mette l'omino a passare da una corsia all'altra. */
export const DURATA_CAMBIO_CORSIA = 0.16;

/** Altezza dell'omino in piedi e da abbassato, in metri.
 *  E' cio' che decide se il lampione caduto lo prende in pieno. */
export const ALTEZZA_OMINO = 1.75;
export const ALTEZZA_OMINO_ABBASSATO = 0.75;

/** Sotto questa quota i piedi sono considerati a terra: e' la soglia che
 *  distingue "sto scavalcando la buca" da "ci sono dentro". */
export const QUOTA_A_TERRA = 0.35;

/** Mezza profondita' del corpo, in metri: serve a decidere quando l'omino e'
 *  "sopra" un ostacolo. */
export const SEMI_PROFONDITA_OMINO = 0.35;

/** Velocita' di corsa, in metri al secondo, e sua crescita col tempo.
 *  Il tetto e' alto e ci si arriva in due minuti: prima si toccava il massimo
 *  dopo un minuto e da li' in poi la corsa non cambiava piu'. */
export const VELOCITA_INIZIALE = 11;
export const VELOCITA_MASSIMA = 30;
/** Metri al secondo guadagnati per ogni secondo di corsa. */
export const ACCELERAZIONE = 0.16;

/** Quanti metri di strada si disegnano davanti all'omino. */
export const DISTANZA_VISIBILE = 95;

/** Salto massimo di tempo accettato in un passo, in secondi. Senza questo
 *  limite, tornare sulla scheda dopo un minuto farebbe avanzare il mondo di
 *  sessanta secondi in un colpo solo, con l'omino teletrasportato dentro un
 *  ostacolo. */
export const DT_MASSIMO = 0.05;

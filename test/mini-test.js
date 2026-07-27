// Harness di test minimale: nessuna dipendenza, gira nel browser.
// Se un giorno il progetto avra' Node, i moduli testati restano gli stessi.

const risultati = [];

export function test(nome, fn) {
  try {
    fn();
    risultati.push({ nome, ok: true });
  } catch (errore) {
    risultati.push({ nome, ok: false, messaggio: errore.message });
  }
}

/** Test che devono aspettare qualcosa (una fetch, di solito).
 *  Vanno attesi con `attendiTest()` prima di stampare i risultati. */
const inAttesa = [];

export function testAsync(nome, fn) {
  inAttesa.push(
    Promise.resolve()
      .then(fn)
      .then(
        () => risultati.push({ nome, ok: true }),
        (errore) => risultati.push({ nome, ok: false, messaggio: errore.message }),
      ),
  );
}

export function attendiTest() {
  return Promise.all(inAttesa);
}

export function assert(condizione, messaggio) {
  if (!condizione) throw new Error(messaggio || 'condizione falsa');
}

export function assertUguale(effettivo, atteso, messaggio) {
  if (effettivo !== atteso) {
    throw new Error(`${messaggio || 'valori diversi'}: atteso ${atteso}, ottenuto ${effettivo}`);
  }
}

export function assertQuasi(effettivo, atteso, tolleranza = 1e-6, messaggio) {
  if (Math.abs(effettivo - atteso) > tolleranza) {
    throw new Error(`${messaggio || 'valori diversi'}: atteso ~${atteso}, ottenuto ${effettivo}`);
  }
}

/** Stampa l'esito nella pagina e in console. Ritorna true se e' tutto verde. */
export function stampaRisultati(contenitore) {
  const falliti = risultati.filter((r) => !r.ok);
  const righe = risultati
    .map((r) => {
      const esito = r.ok ? 'PASS' : 'FAIL';
      const dettaglio = r.ok ? '' : ` — ${r.messaggio}`;
      return `<li class="${r.ok ? 'ok' : 'ko'}"><b>${esito}</b> ${r.nome}${dettaglio}</li>`;
    })
    .join('');

  const tuttoVerde = falliti.length === 0;
  contenitore.innerHTML = `
    <h1 class="${tuttoVerde ? 'ok' : 'ko'}">
      ${risultati.length - falliti.length}/${risultati.length} test passati
    </h1>
    <ul>${righe}</ul>`;

  // marcatore stabile per la verifica automatica
  document.title = tuttoVerde ? `TEST OK (${risultati.length})` : `TEST FALLITI (${falliti.length})`;
  console.log(document.title);
  falliti.forEach((r) => console.error(`FAIL ${r.nome}: ${r.messaggio}`));
  return tuttoVerde;
}

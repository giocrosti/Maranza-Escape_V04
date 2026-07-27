// Generatore pseudocasuale deterministico: stesso seme, stessa sequenza.
// Serve ai palazzi della citta' (che devono restare identici fra un fotogramma
// e l'altro) e ai test, che senza non potrebbero controllare un percorso.
// Congruenziale lineare, gli stessi parametri di Numerical Recipes.

export function creaRng(seme = 1) {
  let stato = seme >>> 0;
  return function successivo() {
    stato = (Math.imul(stato, 1664525) + 1013904223) >>> 0;
    return stato / 4294967296;
  };
}

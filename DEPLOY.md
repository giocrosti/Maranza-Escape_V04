# Pubblicare il gioco: cosa devi fare tu su GitHub

Il workflow e' gia' scritto (`.github/workflows/pubblica.yml`) e fa tutto da solo a
ogni push. Ma la prima volta GitHub va acceso a mano, perche' nessuno puo' attivare
le Pages di un repository al posto tuo. Sono cinque minuti, una volta sola.

## 1. Metti il codice su GitHub

Se il progetto non e' ancora su GitHub:

1. Vai su <https://github.com/new>.
2. Nome del repository: `maranza-escape` (o quello che preferisci).
3. Lascialo **pubblico**. Le GitHub Pages su repository privati funzionano solo con
   un piano a pagamento, e questo gioco non ha niente da nascondere.
4. **Non** spuntare "Add a README" ne' "Add .gitignore": ci sono gia' nel progetto e
   creerebbero un conflitto al primo push.
5. Premi "Create repository".

Poi, dalla cartella del gioco:

```bash
git remote add origin https://github.com/TUO-NOME/maranza-escape.git
```

```bash
git branch -M main
```

```bash
git push -u origin main
```

Se `git remote add` risponde che `origin` esiste gia', il collegamento c'e' e basta
fare il push.

## 2. Accendi le Pages

1. Sul repository, scheda **Settings** (in alto a destra).
2. Nella barra di sinistra, **Pages**.
3. Alla voce **Source** scegli **GitHub Actions** — non "Deploy from a branch".

   Questo e' il passaggio che conta. Con "Deploy from a branch" GitHub pubblicherebbe
   i file sorgenti cosi' come sono, e il gioco non partirebbe: quello che va pubblicato
   e' la cartella `dist/`, che esiste solo dopo la costruzione.
4. Non serve salvare: la scelta e' immediata.

## 3. Guarda la prima pubblicazione

1. Scheda **Actions**.
2. Trovi un'esecuzione chiamata "Pubblica su GitHub Pages", partita dal tuo push.
   Ci mette due o tre minuti: installa le dipendenze, scarica un browser, esegue i
   test, costruisce e pubblica.
3. Quando il pallino diventa verde, l'indirizzo del gioco e'

   `https://TUO-NOME.github.io/maranza-escape/`

   Lo trovi anche in Settings → Pages, in cima.

Se il pallino diventa rosso, aprilo e guarda quale passo si e' fermato. Quasi sempre
e' "Esegui i test": vuol dire che qualcosa si e' rotto, ed e' esattamente il motivo
per cui i test stanno li'.

## 4. Mettilo sulla Home dell'iPhone

1. Apri quell'indirizzo **con Safari**. Non con Chrome: su iOS solo Safari sa
   installare le app dalla rete.
2. Tocca il pulsante Condividi (il quadrato con la freccia in su).
3. Scorri e tocca **Aggiungi a Home**.
4. Il nome proposto e' "Maranza": confermalo.

Da quel momento l'icona apre il gioco a schermo intero, senza barra di Safari, e
funziona anche in aereo — il service worker tiene in cache tutto quello che serve.

## Cosa succede a ogni push successivo

Niente da fare: ogni `git push` sul ramo `main` fa ripartire il workflow, e se i test
passano il sito si aggiorna da solo. Sui telefoni che hanno gia' l'app installata la
versione nuova arriva **al lancio successivo**, non subito: il service worker serve
per prima cosa quello che ha in cache, e intanto scarica il resto in sottofondo.

## Se qualcosa non torna

**La pagina e' bianca.** Quasi sempre e' il passo 2 fatto con "Deploy from a branch"
invece che con "GitHub Actions". Torna in Settings → Pages e cambialo.

**Il gioco si vede ma le icone no.** Controlla che l'indirizzo finisca con la barra
(`/maranza-escape/` e non `/maranza-escape`). Tutti i percorsi del gioco sono
relativi apposta, ma senza la barra finale il browser sbaglia la cartella di partenza.

**Ho aggiornato ma sul telefono vedo la versione vecchia.** Chiudi l'app dalla lista
delle app aperte e riaprila: e' il "lancio successivo" di cui sopra. Se proprio non
cambia, togli l'icona dalla Home e rimettila.

**Voglio ripubblicare senza cambiare niente.** Scheda Actions → "Pubblica su GitHub
Pages" → "Run workflow". Il workflow ha `workflow_dispatch` apposta.

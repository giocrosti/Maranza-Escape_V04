# Maranza escape — convenzioni del progetto

Corsa infinita su tre corsie per le vie di Milano. Vite + PixiJS v8, WebGPU con
ricaduta su WebGL2, installabile sulla Home di un iPhone come PWA.

## Comandi

```bash
npm run dev          # server di sviluppo su 127.0.0.1:5173
```

```bash
npm test             # controlli sui file + suite nel browser (tests.html)
```

```bash
npm run build        # costruisce dist/ e genera il service worker
```

```bash
npm run scatta -- --etichetta dopo            # screenshot iPhone 15 Pro in schermate/
npm run diagnostica                            # apre il gioco e riporta tutta la console
```

## La lingua

**Tutto in italiano**: nomi di file, funzioni, variabili, commenti, messaggi.
`disegnaCorridore`, non `drawRunner`. Le uniform degli shader fanno eccezione
solo dove il nome lo impone PixiJS (`uTexture`, `uInputSize`, `aPosition`); le
altre sono italiane come il resto (`uAria`, `uRilievo`, `parametri`).

Niente lettere accentate nel codice e nei commenti: si scrive `perche'`, `puo'`,
`citta'`. E' una regola vecchia del progetto, e vale ancora.

I commenti dicono **perche'**, non cosa. Un commento che ripete la riga sotto e'
rumore; un commento che spiega quale disastro evita quella riga vale dieci
righe di codice. Diversi punti di questo progetto sono cosi': la riga sembra
arbitraria finche' non si legge cosa e' successo la prima volta che non c'era.

## Le due meta' del gioco

La divisione piu' importante del progetto, e va difesa:

- **Il mondo e' puro.** `mondo.js`, `corridore.js`, `percorso.js`, `ostacoli.js`,
  `inseguitori.js`, `citta.js`, `proiezione.js`, `costanti.js`, `rng.js` non
  nominano mai il DOM, un canvas, PixiJS o un pixel. Si eseguono e si testano da
  soli, ed e' quello che fanno i test.
- **Il disegno e' a valle.** `render.js`, `figure.js`, `monumenti.js`,
  `pennello.js`, `scena/`, `grafica/` leggono lo stato del mondo e non lo
  toccano mai.

Se una regola di gioco ha bisogno di sapere quanto e' largo lo schermo, e'
scritta male.

## Le unita'

Il mondo si misura in **metri**, non in pixel. Una corsia e' larga 2 metri,
l'omino e' alto 1,75, si salta 1,3. La conversione in pixel la fa solo
`proiezione.js`, con una divisione: piu' una cosa e' lontana, piu' si stringe
verso il punto di fuga.

I fondali piatti (che non hanno una distanza) ragionano in frazioni di schermo.

## L'architettura grafica

```
index.html
  #gioco         canvas di PixiJS: la scena, i layer, le luci, il post-processing
  #interfaccia   canvas 2D sopra: punteggio, pulsanti, schermate

src/
  main.js               ciclo di gioco, comandi, comportamenti da app installata
  render.js             il pennello: dipinge la scena sul canvas 2D, per livello
  figure.js monumenti.js pennello.js   le forme con cui e' dipinta

  grafica/
    applicazione.js     accensione di Pixi (webgpu -> webgl2)
    scena.js            la pila degli otto piani, e come si rimettono insieme
    tela.js             canvas 2D -> texture Pixi
    tavolozza.js        i colori dominanti e la LUT che ce li porta
    opzioni.js          gli interruttori ?strati= ?aria= ?luci= ?post=
    filtri/             i filtri scritti a mano, in due lingue

  scena/
    fondali.js          le strisce ripetibili dei piani piatti
    luci.js             chi fa luce, in coordinate di schermo
    emissive.js         gli aloni, dalla stessa lista
    particelle.js       polvere, detriti, scintille

  interfaccia/
    animazioni.js       le curve e i valori che le usano
    condivisione.js     mandare il record con la Web Share API

  suono/
    cassa.js            la cassa bluetooth degli inseguitori, sintetizzata
```

## Gli ostacoli

Ognuno si passa con **un gesto suo**, sempre lo stesso, e il gesto proprio
funziona anche quando l'ostacolo prende tutta la strada:

| ostacolo | gesto | note |
|---|---|---|
| buca, aiuola | si salta | |
| ponticello | ci si abbassa | |
| monopattino | si cambia corsia | viene incontro |
| arco | corsia centrale | i piloni chiudono le altre due |
| tram | si cambia corsia | piu' stretto di una corsia, 19 metri, viene incontro |

Il tram e' l'ostacolo piu' frequente della strada (`QUOTA_TRAM`), e viene da
solo, in due o in tre. Il terzetto e' sempre **sfalsato**, mai affiancato: lo
sfalsamento sta in una finestra stretta — sotto i 9,5 metri due tram chiudono
due corsie mentre il terzo chiude l'ultima, sopra i 22 si passa stando fermi in
una corsia. In mezzo c'e' lo slalom.

Il tram ha una regola sua: **i binari sono l'avviso**. Non stanno attaccati al
tram, stanno dipinti sull'asfalto attorno al punto d'incontro (`binariCentro`,
che e' la z di generazione *prima* della spinta che compensa l'avvicinamento), e
ai due capi curvano fuori verso la sede laterale. La curva d'ingresso va messa
dove il giocatore **passa**, non dove il tratto finisce: al capo lontano
cadrebbe oltre la distanza visibile e non la vedrebbe mai nessuno.

Un tram superato non si butta via subito: `scia()` dice quanto ancora deve
vivere, perche' i binari restano sotto i piedi molto dopo che la vettura e'
passata.

Un ostacolo che viene incontro nasce piu' lontano di uno fermo, di quel tanto
che si mangera' avvicinandosi (`spintaPerAvvicinamento`), e la spinta si calcola
sulla **sua** velocita': il tram va piu' del monopattino, e senza questo
arriverebbe addosso con meno preavviso.

### La telecamera

Non e' inchiodata al centro: **insegue l'omino di lato, in ritardo**
(`vista.guarda`, mosso da `mondo.js`). E' il pezzo che fa sembrare il gioco un
gioco invece di una proiezione — con la telecamera ferma, cambiare corsia sposta
l'omino nel riquadro e basta; inseguendolo in ritardo si sente lo scarto, il
mondo scorre di lato e l'omino si ricentra.

`guarda` entra **prima** della divisione prospettica, quindi le cose vicine
scorrono piu' di quelle lontane: e' una parallasse vera, e non costa niente. Non
va a 1: seguirlo del tutto cancellerebbe il movimento invece di raccontarlo.

### Quello che sparisce troppo presto

Un intero gruppo di difetti, tutti con la stessa faccia: una cosa svanisce
mentre la si sta ancora guardando. Vale la pena riconoscerli, perche' si
ripresentano ogni volta che si aggiunge roba lunga.

- **La citta' si ripete**, e `zRelativo` riporta dentro il periodo quello che va
  oltre la coda — che di default e' quattordici metri. Un palazzo profondo
  ventidue (Velasca, Duomo) veniva rispedito a settecento metri di distanza
  mentre lo si costeggiava. La coda va **misurata sull'oggetto**.
- **I ritagli di sicurezza vanno messi dove la proiezione esplode**, non dove fa
  comodo. L'arco si tagliava a `-3` e la sua facciata spariva a `+0,4`: ma la
  telecamera sta a `-4,5`, quindi c'era ancora mezzo arco davanti all'obiettivo.
- **Le suddivisioni vanno ancorate al mondo, non alla finestra visibile.** I
  binari erano una spezzata di venti segmenti ripartiti fra i due estremi
  *visibili*: i vertici si spostavano a ogni fotogramma insieme al giocatore, e
  nel tratto in curva l'errore di approssimazione oscillava avanti e indietro —
  si vedeva il binario ondeggiare come una corda. Ancorati a metri interi del
  mondo, restano dove sono.
- **Una soglia che nasconde un dettaglio nasconde troppo.** Le ruote delle auto
  si spegnevano tutte insieme a tre metri per non diventare dischi giganti: si
  vedeva l'auto scivolare via appoggiata sul niente. Meglio un **tetto al
  raggio** e un taglio per singola ruota.

## Il feedback di gioco

Il gioco e' una **fuga**, e ogni effetto deve servire alla tensione. Se un
effetto e' solo bello, e' rumore che copre il segnale.

**Il mondo non disegna, racconta.** `mondo.js` riempie `mondo.eventi` con quello
che e' successo nel fotogramma (`passo`, `atterraggio`, `urto`, `sfiorata`,
`travolto`, `scudo`) e non sa che esistono le particelle. La traduzione da fatto
a effetto sta tutta in `scena/particelle.js`. Un evento vive **un fotogramma**:
chi lo perde lo ha perso, ed e' giusto — una nuvola di polvere in ritardo di
mezzo secondo e' peggio di nessuna nuvola.

**Il fermo immagine non e' la pausa.** `mondo.fermoImmagine` ferma l'avanzamento
ma non i cronometri dei bonus, e soprattutto **non ferma lo scossone**: e' quel
contrasto — tutto immobile tranne la scossa — a dare il colpo. Dura 58 ms, cioe'
tre fotogrammi e mezzo, contati sul tempo vero e non sui fotogrammi (su uno
schermo a 120 Hz durerebbero la meta').

**La minaccia e' un numero solo** — `minaccia(mondo.inseguitori)` — e da li'
escono cinque cose che salgono insieme: il tremore della camera, la vignetta che
si stringe e vira, i rossi che si accendono, i bordi che ondeggiano (solo
sopra 0,72) e il volume della cassa. Tutte periferiche, nessuna al centro: il
centro dello schermo e' dove si gioca e deve restare pulito.

**La camera si scuote con una somma di seni**, non con rumore per fotogramma:
il rumore a 60 Hz sfarfalla e a 120 Hz sfarfalla il doppio senza scuotere di
piu'. A scuotersi e' il palco, mai l'interfaccia.

**Niente nell'interfaccia cambia di colpo** (`interfaccia/animazioni.js`). Per
valori con un bersaglio che cambia da solo si usa `insegue`, scritto con un
esponenziale: "mi avvicino del 10% a ogni fotogramma" va al doppio della
velocita' su uno schermo a 120 Hz.

## Prestazioni

```bash
npm run prestazioni     # chiamate di disegno, tempo per fotogramma, particelle
```

Tre regole imparate misurando, non ragionando:

1. **Quello che non cambia non si fa a ogni fotogramma.** I fondali piatti
   avevano un filtro d'aria ciascuno: cinque passate a schermo intero che
   davano sempre lo stesso risultato. Adesso l'aria e' **cotta nella texture**
   (`cuociAria`) quando la striscia nasce. Restano filtri solo i due primi
   piani, la cui sfocatura si allunga con la velocita'.
2. **Le chiamate di disegno non erano il collo di bottiglia.** Passare da 50 a
   30 ha spostato gli fps di un punto: il costo sta nei pixel dei filtri, non
   nelle chiamate. Prima di ottimizzare, misurare quale delle due.
3. **La qualita' si adatta da sola** (`grafica/qualita.js`), ma con prudenza.
   Non si puo' sapere in anticipo se un telefono ce la fa; si guarda il p95 del
   tempo per fotogramma e si scende di risoluzione. La prima versione scendeva
   al primo brutto quarto di secondo e non risaliva mai: bastava un inciampo
   all'avvio e il gioco restava sgranato per tutta la sessione, il che poi si
   racconta come "si vede tutto sfocato". Adesso i primi tre secondi non si
   giudicano, per scendere servono tre giudizi negativi di fila, e si puo'
   risalire con un'isteresi larga.

4. **La sfocatura non e' profondita'.** La profondita' di campo sulla scena e'
   spenta (`sfocatura: 0`) ed e' una scelta, non una dimenticanza: in un gioco
   di corsa si guarda lontano per vedere cosa arriva, e sfocare il lontano vuol
   dire sfocare l'informazione che serve. Su uno schermo tenuto a trenta
   centimetri tre pixel di sfocatura non si leggono come distanza, si leggono
   come "e' fuori fuoco". La distanza la raccontano contrasto e colore, che
   restano. L'unica sfocatura viva e' lo strascico orizzontale dei due piani
   vicini quando si corre forte, e a fermo vale zero.

## Alpha premoltiplicata

Un canvas 2D produce alpha **non** premoltiplicata. Ogni texture costruita da un
canvas va quindi creata con `alphaMode: 'premultiply-alpha-on-upload'`, sia in
`grafica/tela.js` sia in `_fondale` di `grafica/scena.js`.

Saltarlo non da' nessun errore: schiarisce quello che e' semitrasparente in
proporzione a quanto e' trasparente. Un fusto scuro al 7% di opacita' diventa
una colonna chiara. E' rimasto nascosto per una intera sessione perche' quei
fondali avevano davanti un filtro che divideva per alpha e rimoltiplicava, e
quel filtro rimetteva le cose a posto per caso.

### I piani di profondita'

Sette, dal fondo al primo piano. Il numero e' il fattore di parallasse: **piu' e'
vicino, piu' corre**. I piani in prospettiva valgono 1 e sono il metro di
paragone — la loro parallasse la fa gia' la proiezione.

| # | piano | parallasse | come |
|---|-------|-----------|------|
| 0 | cielo | 0,02 | striscia fissa + nuvole ripetibili |
| 1 | lontano | 0,16 | profilo di citta', quasi solo foschia |
| 2 | medio | 0,40 | secondo profilo, piu' scuro |
| 3 | scena | 1,00 | strada, palazzi, ostacoli: prospettiva |
| 4 | personaggi | 1,00 | omino e maranza: illuminazione piena |
| 5 | emissive | 1,00 | solo cio' che brilla, per il bloom |
| 6 | vicinissimo | 2,90 | fogliame appeso in alto, fuori fuoco |

I piani 0-2 e 6 sono texture disegnate **una volta sola** e fatte scorrere: e'
quello che permette otto piani senza pagarli otto volte. I piani 3-5 si
ridipingono a ogni fotogramma su una `Tela`.

Un aggiunta a `scena/fondali.js` deve essere **ripetibile**: ogni sagoma che
sfora il bordo destro va ridisegnata spostata di una larghezza, o si vede la
giunta passare ogni pochi secondi.

C'era anche un piano di fusti verticali, ed e' stato tolto: un fondale che
scorre non ha bordi, quindi qualunque cosa ci si metta prima o poi passa davanti
alla corsia di mezzo. Un primo piano si mette **in alto o all'orizzonte**, dove
non si gioca.

### Regole degli shader

Ogni filtro in `grafica/filtri/` ha **due programmi**: GLSL e WGSL. Un filtro con
il solo GLSL funziona sul computer, che ricade su WebGL2, e sparisce sull'iPhone,
che prende WebGPU. `test/filtri.test.js` lo verifica costruendoli tutti.

Tre trappole, tutte gia' costate una sessione:

1. **`resolution: 'inherit'`, sempre.** Il valore di default di PixiJS e' `1`, e
   in una catena vince il minimo: un filtro distratto disegna tutta la scena a
   meta' risoluzione. Non sembra un errore di risoluzione, sembra che sia sfocata
   l'arte.
2. **`padding: 0` sui filtri che leggono posizioni.** La profondita' di campo
   ricava la distanza da `uv.y`, le luci arrivano in coordinate del riquadro: se
   qualcuno in catena chiede padding, Pixi allarga il riquadro e quelle
   coordinate puntano altrove. Per questo la sfocatura dei piani 3 e 4 sta
   *dentro* i loro filtri, e i `BlurFilter` di Pixi si usano solo sui fondali.
3. **`uniform highp vec4 uInputSize;`** nel fragment. Nel vertex la precisione di
   default e' alta, nel fragment media: dichiararla senza qualifica fa fallire il
   *link*, con un messaggio che parla di precisioni e non nomina il file.

Il colore in ingresso a un filtro e' **premoltiplicato**: si divide per alpha
prima di toccare la tinta e si rimoltiplica alla fine.

### Le luci

Una lista sola, costruita da `scena/luci.js` in coordinate di schermo, che serve
a due cose: accende i filtri di illuminazione e disegna gli aloni del bloom.
Averne due e' il modo sicuro di ritrovarsi un alone dove non c'e' nessuna luce.

Le normal map non esistono come file e non esisteranno: la grafica e' dipinta da
codice a ogni fotogramma. Il rilievo si ricava dal **canale alpha**, leggendo la
silhouette come un campo di altezza. Chi aggiunge una figura non deve preparare
niente: basta che sia disegnata su fondo trasparente.

Il massimo e' otto luci (`LUCI_MASSIME`). Non e' il costo a fermarsi li', e' che
oltre non si distinguono piu'.

### La palette

Quattro colori dominanti, in `grafica/tavolozza.js`. Si applicano alla fine, con
una LUT, quindi valgono per tutti i piani allo stesso modo.

Si limita la palette ruotando le **tinte** verso poche ancore, non mescolando i
colori con una rampa di luminosita': la rampa avvicina fra loro due colori
diversi ma ugualmente chiari, il contrasto locale cala e l'immagine si legge come
sfocata anche se e' perfettamente a fuoco. La luminosita' non si tocca — e'
quella che regge la leggibilita' del gioco, e c'e' un test che lo controlla.

## Il telefono

Il bersaglio e' un iPhone 15 Pro in Safari, aggiunto alla Home.

- La risoluzione della scena si tiene **sotto 2** (`RISOLUZIONE_MASSIMA`), anche
  se il telefono ne dichiara 3. L'interfaccia invece va alla densita' piena: e'
  fatta di scritte, e la' la differenza si vede.
- I margini di sicurezza (tacca, isola dinamica, barra di casa) si leggono dal
  riquadro `#sicurezza` in pagina, non si indovinano.
- Percorsi **sempre relativi**: il gioco gira anche pubblicato in una
  sottocartella. `base: './'` in `vite.config.js`, e un controllo in
  `strumenti/prova.mjs`.
- Il service worker lo genera `vite-plugin-pwa` dalla cartella costruita. Non c'e'
  piu' nessun elenco di file scritto a mano, e non va reintrodotto.

## Verificare col browser, non a memoria

Il progetto ha gli strumenti per **guardare** quello che si e' fatto, e vanno
usati prima di dire che una modifica grafica funziona.

`npm run scatta` mette in `schermate/` una serie di pose fissate (`home`,
`viale`, `duomo`, `bosco`, `salto`). Le pose sono deterministiche: la citta' e'
generata con un seme costante, quindi allo stesso `scorrimento` i palazzi sono
gli stessi, e due serie si confrontano davvero.

Gli interruttori della riga d'indirizzo servono a isolare uno stadio:

```bash
npm run scatta -- --etichetta senza-aria --query "aria=0"
```

`?strati=0` spegne i fondali, `?aria=0` la separazione atmosferica e la
profondita' di campo, `?luci=0` illuminazione e bloom, `?post=0` grading,
aberrazione e vignetta. Quando l'immagine e' sbagliata e gli stadi sono cinque,
spegnerne uno alla volta e' l'unico modo che non richieda fortuna.

## Server MCP

`.mcp.json` dichiara il server Playwright. Va autorizzato in una sessione
interattiva prima di poterlo usare; nel frattempo `strumenti/scatta.mjs` e
`strumenti/diagnostica.mjs` fanno lo stesso lavoro da riga di comando.

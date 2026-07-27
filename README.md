# Maranza escape

Gioco di corsa infinita nel browser, ambientato su una via a grande scorrimento di
Milano: tre corsie d'asfalto, la sede del tram con le rotaie e la linea aerea da una
parte, la fila delle auto in sosta dall'altra, i platani sui marciapiedi. Lungo la
corsa si passa davanti al Duomo, alla Galleria, alla Torre Velasca e al Bosco
Verticale, e si corre sotto l'Arco della Pace. Un omino bianco scappa da un branco
di maranza col cappellino, il borsello a tracolla e il coltello in mano: si saltano
le buche, si schivano i monopattini cambiando corsia e ci si abbassa sotto i
lampioni caduti.
HTML5 Canvas e JavaScript vanilla, nessuna dipendenza da installare.

E' pensato per stare sulla schermata Home di un iPhone: manifest, icone,
funzionamento senza rete e schermo che non si spegne mentre giochi.

## Come si gioca

Il telefono si tiene **in verticale**. Si comanda scorrendo il dito:

| Passata | Cosa fa | Ostacolo che serve a evitare |
| --- | --- | --- |
| a lato | cambia corsia | il maranza sul monopattino |
| in alto | salta | la buca (larga una, due o tre corsie) |
| in basso | ti abbassi | il lampione caduto di traverso |

Il **pulsante di pausa** sta in alto a destra: ferma tutto, orologio compreso, e i
secondi che restano ai bonus non scorrono. Si riprende toccando il pulsante, o
toccando lo schermo. Il gioco si mette in pausa **da solo** quando l'app finisce in
secondo piano: chi risponde a una chiamata non deve tornare e trovarsi morto.

Da tastiera, per provarlo sul computer: frecce o `WASD`, spazio per saltare,
`Invio` per cominciare, `P` o `Esc` per la pausa, `F` per il contatore di fotogrammi.

Ogni ostacolo si evita **in un modo solo**, sempre lo stesso: il monopattino e' alto,
saltargli sopra non funziona; abbassarsi dentro una buca non serve a niente. Due
ostacoli non capitano mai nello stesso punto, e fra uno e l'altro c'e' sempre lo
spazio per rimettersi in piedi.

### Il distacco e' l'unica vita che hai

Non ci sono tre vite: c'e' un numero solo, il **distacco** in metri fra te e i
maranza, che si vede nella barra in alto a destra e, soprattutto, si vede in fondo
allo schermo — piu' si avvicinano, piu' diventano grandi.

- si parte con 16 metri di vantaggio;
- ogni errore ne costa 5,5 e ti fa barcollare;
- correndo pulito se ne riguadagnano 0,62 al secondo, fino a un massimo di 16.

Quindi **tre errori ravvicinati bastano per farsi prendere**, ma nessuno dei tre e'
definitivo se in mezzo si corre bene.

### Monete e bonus

Le monete valgono 25 punti l'una, i metri uno. Stanno nella corsia che l'ostacolo
lascia libera, o in arco sopra le buche: prenderle tutte vuol dire aver saltato al
momento giusto.

| Bonus | Cosa fa |
| --- | --- |
| scudo | si mangia un errore, poi si consuma |
| scatto | qualche secondo a tutta velocita', passando attraverso gli ostacoli e guadagnando terreno in fretta |
| calamita | per qualche secondo le monete vengono a te anche dalle altre corsie |

Il record e' salvato nel browser di questo telefono e non va da nessun'altra parte.

## Installarla sull'iPhone

Il gioco e' fatto di file statici, non serve nessuna build: si pubblica la radice
del progetto e la si aggiunge alla Home.

1. Crea un repository **pubblico** su GitHub (Pages e' gratuito solo sui pubblici).
2. `git remote add origin <url>` e `git push -u origin main`.
3. Su GitHub: **Settings -> Pages**, sorgente **Deploy from a branch**, ramo `main`,
   cartella `/ (root)`. Dopo un minuto il gioco e' online.
4. Sul telefono, apri l'indirizzo in **Safari** (non in Chrome: solo Safari puo'
   aggiungere alla schermata Home su iOS).
5. Tocca **Condividi** e poi **Aggiungi a Home**.

Da installata si apre a schermo intero, senza barre del browser, e da li' in poi
funziona anche **senza rete**. Lo schermo non si spegne mentre giochi, il gioco
riprende senza scatti se arriva una chiamata, e i margini di tacca e isola dinamica
sono rispettati.

Tutti i percorsi del progetto sono relativi (`./src/...`, `start_url: "./"`), quindi
funziona anche quando il sito non sta nella radice del dominio, come succede appunto
su GitHub Pages.

> **A ogni pubblicazione cambia `VERSIONE` in `sw.js`.** E' quello che manda in
> pensione la cache precedente: senza, chi ha gia' aperto il gioco continuerebbe a
> vedere la versione vecchia.

## Come si avvia sul computer

Doppio clic su **`avvia_maranza.bat`**: accende il server e apre il browser da solo.
Per spegnere, si chiude quella finestra. Per usare un'altra porta:
`avvia_maranza.bat 8790`.

A mano, lo stesso risultato:

```bash
python dev-server.py
```

Poi apri <http://localhost:8775/>. Serve un server perche' i moduli ES non si caricano
da `file://`: aprendo `index.html` con un doppio clic si vede solo lo sfondo. Il
server e' `http.server` con le intestazioni di cache disattivate, cosi' dopo una
modifica il browser non serve la versione precedente.

### Il server di sviluppo non e' raggiungibile dalla rete

Scelta voluta: `dev-server.py` ascolta **solo** su `127.0.0.1`. Non ha alcuna
autenticazione e servirebbe tutti i file della cartella a chiunque sia collegato alla
stessa Wi-Fi. Per giocare dal telefono si usa la versione pubblicata, non il server
di sviluppo.

## Come si testa

Apri <http://localhost:8775/tests.html>: la pagina esegue i test della logica pura e
stampa l'esito (il titolo della scheda diventa `TEST OK (n)` o `TEST FALLITI (n)`).

I test non hanno bisogno di Node ne' di alcun framework: `test/mini-test.js` sono una
sessantina di righe. Ogni nuovo file di test va aggiunto all'elenco di import in
`tests.html`.

## Rigenerare le icone

Le icone non sono disegnate a mano: sono ricostruite con gli stessi colori del gioco,
quindi se cambia la grafica basta rilanciare

```bash
python strumenti/genera-icone.py
```

## Com'e' fatto

Tutta la logica sta in moduli puri, senza alcun riferimento al DOM: si possono
eseguire e testare da soli. Solo `main.js`, `input.js` e `render.js` sanno che esiste
un browser.

| File | Responsabilita' |
| --- | --- |
| `src/costanti.js` | le misure del mondo: corsie, gravita', velocita', altezze |
| `src/proiezione.js` | da metri a pixel: e' qui che la strada diventa prospettica |
| `src/corridore.js` | l'omino bianco: corsia, salto, scivolata, altezza della testa |
| `src/ostacoli.js` | i tre ostacoli e la regola che dice quando ti prendono |
| `src/percorso.js` | genera la strada davanti: ostacoli, monete, bonus |
| `src/inseguitori.js` | il distacco dai maranza: penalita', recupero, cattura |
| `src/citta.js` | la sezione della via e dove stanno palazzi, monumenti, alberi, auto e tram |
| `src/pennello.js` | le cinque forme prospettiche con cui e' disegnato tutto il mondo |
| `src/figure.js` | persone e monopattini, di spalle e di fronte; il branco della home |
| `src/monumenti.js` | le facciate dei monumenti, disegnate per essere riconosciute |
| `src/pausa.js` | geometria del pulsante di pausa, condivisa fra disegno e tocco |
| `src/mondo.js` | stato della partita e sua evoluzione: urti, raccolte, fine |
| `src/record.js` | record personale in localStorage |
| `src/render.js` | tutto il disegno sul canvas |
| `src/input.js` | dito e tastiera tradotti in comandi |
| `src/main.js` | canvas, ciclo di gioco, schermo sempre acceso, service worker |
| `src/rng.js` | generatore deterministico, usato dalla citta' e dai test |
| `sw.js` | cache dei file: e' cio' che fa funzionare il gioco senza rete |
| `manifest.json` | nome, icone e `display: standalone` dell'app installata |
| `strumenti/genera-icone.py` | ricostruisce le icone dalla grafica del gioco |

Qualche scelta che vale la pena conoscere prima di mettere le mani al codice:

- **Il mondo e' in metri, non in pixel.** Una corsia e' larga 2 metri, l'omino e' alto
  1,75, il salto ne fa 1,3. Cosi' le regole del gioco non cambiano al cambiare dello
  schermo: la conversione la fa solo `proiezione.js`, in un punto solo.
- **La telecamera guarda dritta davanti a se',** quindi la proiezione e' una sola
  divisione. La distanza focale la decide la larghezza della finestra (la strada deve
  starci dentro), con un tetto dettato dall'altezza (l'omino deve restare in campo):
  e' cosi' che il gioco regge sia in verticale sul telefono sia in una finestra larga.
- **Si disegna dal lontano al vicino.** Non c'e' nessun controllo di profondita':
  l'ordine di disegno *e'* la profondita'. Ogni elenco viene ordinato per z
  decrescente prima di passare al pennello.
- **Saltando si e' in aria dal primo istante,** anche coi piedi ancora a due dita
  dall'asfalto. In discesa invece la quota conta davvero. Senza questa asimmetria,
  chi salta un attimo prima del bordo della buca ci cadeva dentro lo stesso, e non si
  capiva perche'.
- **L'ombra del lampione caduto e' tenue di proposito**, e i rattoppi dell'asfalto
  sono grigi e mai neri. Qualunque macchia scura sulla strada, vista da vicino, si
  legge come una buca: in un gioco dove le buche si saltano sarebbe un inganno.
- **Le buche non sono rettangoli.** Ognuna ha un contorno frastagliato suo, generato
  una volta sola dalla sua posizione, quindi sempre uguale a se stesso. Non e'
  un'ellisse ma un rettangolo smussato: l'urto usa il riquadro pieno, e un contorno
  tondo lascerebbe scoperte le due punte laterali, dove si cadrebbe in una buca che
  li' non si vede. C'e' un test che lo verifica corsia per corsia.
- **La corsa e' disegnata per come si vede da dietro**, che non e' come si vede di
  profilo. Le gambe non si aprono avanti e indietro sullo schermo, perche' quel
  movimento va nella direzione in cui si guarda: quello che si vede e' il tallone
  che si alza dietro con la pianta della scarpa che lampeggia, il busto che
  sobbalza due volte per falcata e il braccio che esce di lato quando va indietro.
  Le braccia si disegnano **prima** del busto apposta, cosi' quella che va avanti
  gli finisce dietro.
- **La pausa ferma l'orologio del mondo, non solo la strada.** I secondi che restano
  a scatto e calamita sono contati su quell'orologio: fermarlo li ferma con se',
  senza doverli salvare e rimettere a posto.
- **Un ostacolo per volta.** Il generatore non mette mai due ostacoli sovrapposti, e
  la distanza minima fra uno e l'altro cresce con la velocita': serve il tempo di
  vederlo arrivare. Un test lo verifica su quattro chilometri di strada e cinque semi
  diversi.
- **I maranza si disegnano in coordinate schermo, non nel mondo.** Stanno *dietro* la
  telecamera, quindi una z da proiettare non ce l'hanno: crescono dal fondo dello
  schermo man mano che si avvicinano. E' una bugia prospettica, ed e' l'unico modo di
  vedere in faccia il pericolo che ti sta alle spalle.
- **La citta' e' lunga 760 metri e si ripete.** Nessuno se ne accorge (fra un
  passaggio e l'altro corrono minuti) e in cambio la scena si genera una volta sola,
  con un seme fisso: la strada dev'essere sempre la stessa strada, non un posto
  diverso a ogni partita. I monumenti — Galleria, Duomo, Torre Velasca, Bosco
  Verticale, Arco della Pace — stanno in punti stabiliti, non a caso.
- **Di un monumento si guarda la facciata, non il fianco.** Percio' i monumenti
  sono disegnati sul piano di testa — quello che ci guarda mentre ci si corre
  incontro — e stanno sul filo della strada invece che arretrati come i palazzi:
  una facciata che comincia otto metri di lato esce dallo schermo prima di farsi
  riconoscere. Ognuno ha davanti una **piazza** di settanta metri senza edifici,
  senza la quale il Duomo resterebbe dietro l'ultimo palazzo della fila. Di ognuno
  e' disegnato solo quel poco che lo rende inconfondibile: del Duomo le guglie, i
  cinque portali e la Madonnina; della Velasca il cappello sui puntoni; della
  Galleria l'arcone col timpano e la volta di vetro; del Bosco le due torri
  sfalsate con gli alberi sui balconi.
- **L'Arco della Pace ha tre buchi veri.** I fornici non sono dipinti scuri: sono
  ritagliati riempiendo contorno esterno e archi in un percorso solo con la regola
  pari-dispari, quindi attraverso si vede la strada. Un velo scuro al posto del
  buco lo farebbe sembrare tappato.
- **Il cappellino dei maranza si distingue da un casco per le proporzioni**: la
  calotta e' alta e tonda, la visiera e' piu' stretta della calotta ed e' piu'
  scura, perche' sporgendo si mette in ombra da sola. Senza quello stacco viene
  fuori un elmetto da cantiere.
- **Il monopattino di spalle e quello di lato sono due disegni diversi**, non lo
  stesso girato. Di spalle si vede una ruota sola, la pedana di taglio e il
  manubrio largo; di lato le due ruote, la pedana e il piantone inclinato. Il
  primo e' l'ostacolo che si incontra in strada, il secondo quello parcheggiato
  sulla schermata iniziale — ed e' di lato che si capisce cosa sia.
- **I due lati della via sono diversi apposta**: a sinistra la sede tranviaria con le
  rotaie, i pali e ogni tanto un tram fermo, a destra la fila delle auto in sosta con
  la riga blu. Una via simmetrica sembra un rendering; una via col tram da una parte
  e le macchine dall'altra sembra un posto. La sezione completa — carreggiata, fascia
  laterale, marciapiede, filo dei palazzi — sta scritta in cima a `citta.js`.
- **Niente arredi a ridosso dell'obiettivo.** Lampioni, alberi e ruote delle auto
  smettono di disegnarsi quando la telecamera li ha quasi addosso: a mezzo metro
  diventano sbarre e dischi neri grandi come lo schermo. La soglia e' scelta perche'
  cadano fuori dai bordi, non perche' spariscano mentre li stai ancora superando.
- **La scivolata e' una posa a se',** non la figura in piedi schiacciata: schiacciata
  verrebbe una testa ovale e le braccia spalancate, e da dietro non si capirebbe cosa
  sta succedendo.

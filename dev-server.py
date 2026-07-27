"""Server statico per lo sviluppo.

Uguale a `python -m http.server`, ma con due differenze volute:

- dice al browser di non tenere niente in cache: senza, si finisce per provare
  la versione precedente di un modulo e non capire perche' una correzione non
  ha effetto;
- ascolta **solo** su 127.0.0.1, cioe' risponde soltanto a questo computer.
  Non e' un'impostazione da cambiare con un'opzione: questo server non ha
  alcuna protezione e servirebbe tutti i file della cartella a chiunque stia
  sulla stessa rete Wi-Fi. Per giocare dal telefono si usa la versione
  pubblicata, non questo server.

Uso:
    python dev-server.py [porta]
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer, test
from pathlib import Path

INDIRIZZO = "127.0.0.1"


class SenzaCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, formato, *argomenti):
        # meno rumore: le richieste andate a buon fine non interessano
        if not str(argomenti[1] if len(argomenti) > 1 else "").startswith("2"):
            super().log_message(formato, *argomenti)


if __name__ == "__main__":
    porte = [a for a in sys.argv[1:] if not a.startswith("--")]
    porta = int(porte[0]) if porte else 8775
    radice = str(Path(__file__).parent)

    print(f"\n  http://localhost:{porta}/")
    print(f"  Test:  http://localhost:{porta}/tests.html")
    print("  Raggiungibile solo da questo computer.\n")

    # ThreadingHTTPServer e non quello normale: la pagina dei test scarica una
    # trentina di file tutti insieme, e un server che ne serve uno per volta li
    # fa scadere. I test fallivano per colpa del server, non del gioco.
    test(
        HandlerClass=partial(SenzaCache, directory=radice),
        ServerClass=ThreadingHTTPServer,
        port=porta,
        bind=INDIRIZZO,
    )

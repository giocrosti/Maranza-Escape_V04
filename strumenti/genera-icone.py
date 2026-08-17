"""Genera le icone e le schermate d'avvio del gioco.

Niente e' disegnato a mano: tutto e' ricostruito qui con gli stessi colori del
gioco (la strada che si stringe verso il punto di fuga e l'omino bianco di
spalle), cosi' se un domani cambia la grafica basta rilanciare

    python strumenti/genera-icone.py

Non serve nessuna libreria: il PNG viene scritto a mano (zlib e struct stanno
nella libreria standard di Python).

Due cose sulle **schermate d'avvio** di iOS, che sono la parte noiosa.

iOS non ridimensiona niente: pretende un'immagine per ogni combinazione di
misura e orientamento, e se non ne trova una che corrisponde esattamente mostra
una pagina bianca. Da qui esce quindi una ventina di file, ed e' normale.

Disegnarli pixel per pixel in Python puro sarebbe lento (un 1290x2796 sono tre
milioni e mezzo di punti, per venti immagini): si disegna a un terzo della
misura e si ingrandisce replicando i punti. Su un fondo fatto di sfumature
larghe non si vede la differenza, e il conto scende di nove volte.
"""

import struct
import zlib
from pathlib import Path

CIELO = (126, 166, 204)
ASFALTO = (74, 77, 83)
ASFALTO_SCURO = (63, 66, 72)
MARCIAPIEDE = (168, 162, 154)
PALAZZI = (150, 140, 128)
STRISCIA = (227, 221, 205)
OMINO = (245, 247, 250)
OMBRA = (194, 201, 211)

RADICE = Path(__file__).resolve().parent.parent
USCITA = RADICE / "public" / "icone"
USCITA_AVVIO = RADICE / "public" / "avvio"

# Quota dell'orizzonte e apertura della strada, in frazioni del lato.
ORIZZONTE = 0.36
SEMI_STRADA_VICINA = 0.47
SEMI_STRADA_LONTANA = 0.035


def scrivi_png(percorso, pixel, larghezza, altezza):
    """pixel: bytearray RGB, tre byte per punto."""
    righe = bytearray()
    for y in range(altezza):
        righe.append(0)  # filtro "nessuno"
        inizio = y * larghezza * 3
        righe.extend(pixel[inizio : inizio + larghezza * 3])

    def pezzo(tipo, dati):
        return (
            struct.pack(">I", len(dati))
            + tipo
            + dati
            + struct.pack(">I", zlib.crc32(tipo + dati) & 0xFFFFFFFF)
        )

    intestazione = struct.pack(">IIBBBBB", larghezza, altezza, 8, 2, 0, 0, 0)
    percorso.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + pezzo(b"IHDR", intestazione)
        + pezzo(b"IDAT", zlib.compress(bytes(righe), 9))
        + pezzo(b"IEND", b"")
    )


def distanza_da_segmento(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    lunghezza = dx * dx + dy * dy
    t = 0.0 if lunghezza == 0 else ((px - ax) * dx + (py - ay) * dy) / lunghezza
    t = max(0.0, min(1.0, t))
    return ((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2) ** 0.5


def semi_strada(v):
    """Meta' larghezza della carreggiata alla quota verticale v."""
    t = (v - ORIZZONTE) / (1 - ORIZZONTE)
    return SEMI_STRADA_LONTANA + (SEMI_STRADA_VICINA - SEMI_STRADA_LONTANA) * t * t


# Il profilo dei palazzi sopra l'orizzonte: altezze fisse, non a caso, cosi'
# l'icona e' sempre identica a se stessa.
PROFILO = [0.09, 0.15, 0.06, 0.19, 0.11, 0.16, 0.08, 0.13]


def colore_del_punto(u, v):
    """Il colore dello sfondo in (u, v), con u e v fra 0 e 1."""
    if v < ORIZZONTE:
        indice = min(len(PROFILO) - 1, int(u * len(PROFILO)))
        if v > ORIZZONTE - PROFILO[indice]:
            return PALAZZI if indice % 2 == 0 else (136, 127, 116)
        return CIELO

    meta = semi_strada(v)
    if abs(u - 0.5) > meta:
        return MARCIAPIEDE

    # le due strisce fra le corsie, tratteggiate e in prospettiva
    t = (v - ORIZZONTE) / (1 - ORIZZONTE)
    spessore = 0.003 + 0.013 * t
    if int(t ** 0.65 * 7) % 2 == 0:
        for quota in (meta / 3, 2 * meta / 3):
            if abs(abs(u - 0.5) - quota) < spessore:
                return STRISCIA
    return ASFALTO if t > 0.25 else ASFALTO_SCURO


def punto_dell_omino(u, v, gonfia=0.0):
    """'chiaro', 'scuro' o None. `gonfia` allarga la figura: serve a
    ricavarne il contorno senza descriverla una seconda volta."""
    # La figura si rimpicciolisce tenendo fermi i piedi: cosi' resta spazio per
    # la strada, che e' l'altra meta' dell'icona.
    scala = 0.86
    u = 0.5 + (u - 0.5) / scala
    v = 0.92 + (v - 0.92) / scala

    if ((u - 0.5) ** 2 + (v - 0.525) ** 2) ** 0.5 < 0.058 + gonfia:
        return "chiaro"

    if abs(u - 0.5) < 0.072 + gonfia and 0.575 - gonfia < v < 0.735 + gonfia:
        return "scuro" if u > 0.545 else "chiaro"

    # gambe, aperte nel passo
    for bx, by in ((0.408, 0.885), (0.598, 0.905)):
        if distanza_da_segmento(u, v, 0.5, 0.715, bx, by) < 0.04 + gonfia:
            return "chiaro"

    # braccia
    if distanza_da_segmento(u, v, 0.5, 0.62, 0.388, 0.715) < 0.032 + gonfia:
        return "chiaro"
    if distanza_da_segmento(u, v, 0.5, 0.62, 0.618, 0.665) < 0.032 + gonfia:
        return "scuro"
    return None


def colore_dell_omino(u, v):
    """L'omino bianco di spalle col suo contorno, o None."""
    dentro = punto_dell_omino(u, v)
    if dentro:
        return OMINO if dentro == "chiaro" else OMBRA
    # un filo di contorno scuro: senza, il bianco si perde sul marciapiede
    if punto_dell_omino(u, v, 0.014):
        return (43, 47, 54)
    return None


def disegna(lato, scala_contenuto):
    pixel = bytearray()
    for y in range(lato):
        for x in range(lato):
            # il contenuto si rimpicciolisce verso il centro per l'icona
            # mascherabile, che su Android viene ritagliata
            u = (x + 0.5) / lato
            v = (y + 0.5) / lato
            u = 0.5 + (u - 0.5) / scala_contenuto
            v = 0.5 + (v - 0.5) / scala_contenuto

            if not (0 <= u <= 1 and 0 <= v <= 1):
                pixel.extend(ASFALTO_SCURO)
                continue

            colore = colore_dell_omino(u, v) or colore_del_punto(u, v)
            pixel.extend(colore)
    return pixel


def disegna_schermata(larghezza, altezza):
    """La schermata d'avvio: lo stesso quadro, steso su un rettangolo.

    Il fondo si allunga senza problemi — cielo, palazzi e asfalto sono fasce, e
    stirarle non si nota. L'omino no: quello va tenuto in **proporzione**, o su
    uno schermo di telefono diventa un fantoccio lungo il doppio. Per questo la
    figura si calcola in un quadrato suo, appoggiato in basso al centro.
    """
    pixel = bytearray()
    lato = min(larghezza, altezza)
    piedi = 0.86 * altezza

    for y in range(altezza):
        v = (y + 0.5) / altezza
        vo = 0.92 + (y + 0.5 - piedi) / lato
        for x in range(larghezza):
            u = (x + 0.5) / larghezza
            uo = 0.5 + (x + 0.5 - larghezza / 2) / lato
            colore = colore_dell_omino(uo, vo) or colore_del_punto(u, v)
            pixel.extend(colore)
    return pixel


def ingrandisci(pixel, larghezza, altezza, fattore):
    """Ingrandimento a punti replicati. Ogni riga si costruisce una volta e si
    ripete `fattore` volte: e' la parte che fa risparmiare davvero."""
    grande = bytearray()
    for y in range(altezza):
        riga = bytearray()
        inizio = y * larghezza * 3
        for x in range(larghezza):
            punto = pixel[inizio + x * 3 : inizio + x * 3 + 3]
            riga.extend(punto * fattore)
        grande.extend(riga * fattore)
    return grande


# Le misure che iOS pretende, in punti fisici. Sono i telefoni in circolazione:
# togliendone uno, quel modello mostra una schermata d'avvio bianca.
SCHERMATE = [
    (1179, 2556),  # iPhone 15/16 Pro, 14 Pro
    (1290, 2796),  # iPhone 15/16 Pro Max, 14 Pro Max
    (1170, 2532),  # iPhone 12/13/14
    (1284, 2778),  # iPhone 12/13 Pro Max
    (1125, 2436),  # iPhone X/XS/11 Pro
    (828, 1792),  # iPhone XR/11
    (750, 1334),  # iPhone SE, 8
]

# Le misure delle icone. iOS non legge il manifest: le prende da qui.
ICONE = [
    (120, "icona-120.png", 1.0),
    (152, "icona-152.png", 1.0),
    (167, "icona-167.png", 1.0),
    (180, "icona-180.png", 1.0),
    (192, "icona-192.png", 1.0),
    (256, "icona-256.png", 1.0),
    (384, "icona-384.png", 1.0),
    (512, "icona-512.png", 1.0),
    (512, "icona-maschera-512.png", 0.76),
]

def riduzione_per(larghezza, altezza):
    """Di quanto si puo' rimpicciolire senza perdere l'esattezza della misura.

    iOS confronta la misura dell'immagine con quella dello schermo e se non
    coincidono **al pixel** la butta via. Quindi si puo' dividere solo per un
    numero che divide esattamente tutte e due le dimensioni: per la maggior
    parte dei telefoni e' 3, per l'iPhone SE e l'XR e' 2, e va bene lo stesso.
    """
    for divisore in (3, 2):
        if larghezza % divisore == 0 and altezza % divisore == 0:
            return divisore
    return 1


if __name__ == "__main__":
    USCITA.mkdir(parents=True, exist_ok=True)
    USCITA_AVVIO.mkdir(parents=True, exist_ok=True)

    print("Icone:")
    for lato, nome, scala in ICONE:
        scrivi_png(USCITA / nome, disegna(lato, scala), lato, lato)
        print(f"  {nome}")

    print("Schermate d'avvio:")
    for larghezza, altezza in SCHERMATE:
        for verso, (l, a) in (
            ("ritratto", (larghezza, altezza)),
            ("paesaggio", (altezza, larghezza)),
        ):
            divisore = riduzione_per(l, a)
            piccola_l = l // divisore
            piccola_a = a // divisore
            pixel = disegna_schermata(piccola_l, piccola_a)
            if divisore > 1:
                pixel = ingrandisci(pixel, piccola_l, piccola_a, divisore)
            nome = f"avvio-{l}x{a}.png"
            scrivi_png(USCITA_AVVIO / nome, pixel, l, a)
            print(f"  {nome} ({verso})")

    print("Fatto.")

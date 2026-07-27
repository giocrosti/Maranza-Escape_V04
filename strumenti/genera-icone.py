"""Genera le icone del gioco.

Le icone non sono disegnate a mano: sono ricostruite qui con gli stessi colori
del gioco (la strada che si stringe verso il punto di fuga e l'omino bianco di
spalle), cosi' se un domani cambia la grafica basta rilanciare

    python strumenti/genera-icone.py

Non serve nessuna libreria: il PNG viene scritto a mano (zlib e struct stanno
nella libreria standard di Python).
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

USCITA = Path(__file__).resolve().parent.parent / "icone"

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


if __name__ == "__main__":
    USCITA.mkdir(exist_ok=True)
    for lato, nome, scala in [
        (180, "icona-180.png", 1.0),
        (192, "icona-192.png", 1.0),
        (512, "icona-512.png", 1.0),
        (512, "icona-maschera-512.png", 0.76),
    ]:
        scrivi_png(USCITA / nome, disegna(lato, scala), lato, lato)
        print(f"  {nome}")
    print("Icone rigenerate.")

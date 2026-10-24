# © 2026 Cristian Luis Celie. All rights reserved. Portfolio excerpt from AI Video Studio: shared for review only, not licensed for use, copying or redistribution.
# Alinea el guion con los tiempos de Whisper y genera src/apagon/words.json y events.json.
import json, re, difflib, wave

R = r"<REMOTION_STUDIO_DIR>"
TEXT = ("Si un apagón te sorprende en el piso 32, no bajes. A oscuras, treinta pisos de escaleras se convierten en una trampa. "
        "Tienes cuatro minutos. Y todavía no lo sabes. Cuatro minutos: es lo que queda de agua en las tuberías. "
        "Sin luz, las bombas que la suben hasta lo alto de la torre se detuvieron. Uno: el agua. Antes que nada. "
        "Tapas la bañera, llenas cada olla, cada botella. Después, sellas con cinta la tapa del inodoro. "
        "Una sola descarga son nueve litros perdidos. El grifo escupe aire. Ciento veinte litros: suficiente para tres semanas. "
        "Dos: el calor. Afuera hace ocho grados bajo cero. Sin calefacción, el departamento pierde un grado por hora. "
        "Abandonas todos los cuartos menos uno. Clavas mantas en la ventana y armas una tienda de campaña en medio de la sala. "
        "Un espacio pequeño se calienta con el cuerpo. Tres: la luz. Y aquí cometes tu único error. "
        "Toda la torre está a oscuras, menos una ventana. La tuya. Una linterna en el piso 32 se ve a kilómetros. "
        "La apagas. ¿Demasiado tarde? Día 3. Dos y cuarenta y uno. En la escalera, pasos. "
        "Desde hace tres días, todo el mundo baja. Estos… suben.")
NUM = {"32": "treintaydos", "30": "treinta", "4": "cuatro", "1": "uno", "2": "dos", "3": "tres", "9": "nueve", "8": "ocho", "120": "cientoveinte", "41": "cuarentayuno"}
def nz(s):
    s = re.sub(r"[^\wáéíóúñü]", "", s.lower())
    return NUM.get(s, s)

ws = TEXT.split()
raw = json.load(open(R + r"\src\apagon\words-raw.json", encoding="utf8"))
sm = difflib.SequenceMatcher(a=[nz(x["w"]) for x in raw], b=[nz(x) for x in ws], autojunk=False)
out = [None] * len(ws)
for b in sm.get_matching_blocks():
    for k in range(b.size):
        out[b.b + k] = {"w": ws[b.b + k], "s": raw[b.a + k]["s"], "e": raw[b.a + k]["e"]}
k = 0
while k < len(ws):
    if out[k] is None:
        j = k
        while j < len(ws) and out[j] is None: j += 1
        s0 = out[k - 1]["e"] if k > 0 else 0.0
        s1 = out[j]["s"] if j < len(ws) else s0 + 0.35 * (j - k)
        n = j - k
        for m in range(n):
            out[k + m] = {"w": ws[k + m], "s": round(s0 + (s1 - s0) * m / n, 3), "e": round(s0 + (s1 - s0) * (m + 1) / n, 3)}
        k = j
    else:
        k += 1
with wave.open(R + r"\public\apagon\narrador.wav") as h:
    dur = h.getnframes() / h.getframerate()
json.dump(out, open(R + r"\src\apagon\words.json", "w", encoding="utf8"), ensure_ascii=False)
json.dump({"events": [], "duration": round(dur, 3)}, open(R + r"\src\apagon\events.json", "w", encoding="utf8"))
miss = sum(1 for b in sm.get_matching_blocks() for _ in range(b.size))
print(len(ws), "palabras;", miss, "alineadas; dur", round(dur, 2))

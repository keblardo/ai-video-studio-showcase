# © 2026 Cristian Luis Celie. All rights reserved. Portfolio excerpt from AI Video Studio: shared for review only, not licensed for use, copying or redistribution.
# Arma dialogo.wav: el narrador con las líneas de los personajes insertadas al final de ciertas palabras.
# Genera src/coma2/words.json (tiempos ya desplazados) y events.json.
import json, subprocess, re, difflib, wave, os
import numpy as np

R = r"<REMOTION_STUDIO_DIR>"
P = R + r"\public\telefono"
A = r"<TIKTOK_PROJECTS_DIR>\telefono\trabajo\audio"
SR = 48000

TEXT = ("Imagina que tu celular te despierta a las tres y siete de la madrugada. Un mensaje nuevo... de ti. Tu nombre. Tu número. "
        "No prendas la luz. Soy tú, de mañana en la noche. Tiene que ser una broma. Entonces miras afuera: toda la ciudad está a oscuras. "
        "Menos una ventana, al otro lado de la calle. Alguien acaba de prender una lámpara. Abajo, en la calle, algo gira la cabeza hacia la luz. "
        "La ventana se apaga... y se queda apagada. Tu celular vibra. Regla uno: nunca prendas una luz. "
        "Regla dos: si alguien toca la puerta, no abras. Ni siquiera si soy yo. "
        "Regla tres: a las tres y treinta y tres, métete en la bañera y quédate ahí hasta el amanecer. "
        "Tres y treinta y uno. Pasos en el pasillo. Se detienen justo afuera de tu puerta. Es tu voz. Tu celular vibra. No. Ese no soy yo. "
        "Entonces llega una foto. Eres tú, dormido en tu cama, esta noche... tomada desde la esquina de tu cuarto. "
        "Quien te escribe estuvo en tu cuarto. Quien está en la puerta tiene tu voz. Entonces... ¿en quién confías? ¿En el celular... o en la puerta?")

INSERTS = [("puerta", 1, "puerta-filtrada.wav", 1.6, 0.35)]

nz = lambda s: re.sub(r"[^\wáéíóúñü]", "", s.lower())
ws = TEXT.split()
raw = json.load(open(R + r"\src\telefono\words-raw.json", encoding="utf8"))
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
w = out
for x in w: x["os"] = x["s"]; x["oe"] = x["e"]

def load(f, trim=False):
    af = ["-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"] if trim else []
    d = subprocess.check_output(["ffmpeg", "-v", "error", "-i", f, *af, "-ar", str(SR), "-ac", "1", "-f", "f32le", "-"])
    return np.frombuffer(d, np.float32).copy()

nar = load(P + r"\narrador.wav")
def word_end(word, nth):
    hits = [i for i, x in enumerate(w) if nz(x["w"]) == word]
    return w[hits[nth]]["oe"]

segs, events, cursor, shift = [], [], 0.0, 0.0
for word, nth, f, pre, post in INSERTS:
    path = A + "\\" + f
    if not os.path.exists(path):
        print("falta", f); continue
    at = word_end(word, nth) + 0.05
    segs.append(nar[int(round(cursor * SR)):int(round(at * SR))])
    clip = load(path, trim=True)
    dur = len(clip) / SR
    segs += [np.zeros(int(pre * SR), np.float32), clip, np.zeros(int(post * SR), np.float32)]
    events.append({"file": f.split(".")[0], "start": round(at + shift + pre, 3), "dur": round(dur, 3), "gapStart": round(at + shift, 3)})
    for x in w:
        if x["os"] > at - 0.03:
            x["s"] = round(x["s"] + pre + dur + post, 3); x["e"] = round(x["e"] + pre + dur + post, 3)
    shift += pre + dur + post
    cursor = at
segs.append(nar[int(round(cursor * SR)):])
mix = np.concatenate(segs)
pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
with wave.open(P + r"\dialogo.wav", "wb") as h:
    h.setnchannels(1); h.setsampwidth(2); h.setframerate(SR); h.writeframes(pcm.tobytes())
for x in w: x.pop("os", None); x.pop("oe", None)
json.dump(w, open(R + r"\src\telefono\words.json", "w", encoding="utf8"), ensure_ascii=False)
json.dump({"events": events, "duration": round(len(mix) / SR, 3)}, open(R + r"\src\telefono\events.json", "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(round(len(mix) / SR, 2)); print(events)

# © 2026 Cristian Luis Celie. All rights reserved. Portfolio excerpt from AI Video Studio: shared for review only, not licensed for use, copying or redistribution.
# Efectos sintetizados para «El despertar» Parte 2: disparo, lluvia, motor, gruñidos de horda, sputter de moto.
import numpy as np, wave, os
from scipy.signal import butter, lfilter

SR = 48000
OUT = r"<REMOTION_STUDIO_DIR>\public\coma2\sfx"
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

def bp(x, lo, hi):
    b, a = butter(2, [lo / (SR / 2), hi / (SR / 2)], "band"); return lfilter(b, a, x)
def lp(x, f):
    b, a = butter(2, f / (SR / 2), "low"); return lfilter(b, a, x)
def save(name, x, peak=0.9):
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    pcm = (x * 32767).astype(np.int16)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as h:
        h.setnchannels(1); h.setsampwidth(2); h.setframerate(SR); h.writeframes(pcm.tobytes())
def t(d): return np.arange(int(d * SR)) / SR

# disparo de rifle: chasquido + cuerpo grave + cola con eco
d = t(1.2)
crack = rng.normal(size=d.size) * np.exp(-d * 60)
body = lp(rng.normal(size=d.size), 900) * np.exp(-d * 9) * 2.5
thump = np.sin(2 * np.pi * 70 * d) * np.exp(-d * 14) * 1.5
shot = crack + body + thump
tail = np.zeros_like(shot); dl = int(0.11 * SR)
tail[dl:] = lp(shot[:-dl], 1500) * 0.35
save("shot", shot + tail)

# lluvia (loop de 6 s): ruido filtrado + gotitas
d = t(6)
rain = bp(rng.normal(size=d.size), 800, 9000) * 0.5 + lp(rng.normal(size=d.size), 400) * 0.25
for _ in range(900):
    p = rng.integers(0, d.size - 800); rain[p:p + 800] += bp(rng.normal(size=800), 2000, 8000) * np.exp(-np.arange(800) / 120) * rng.uniform(0.3, 1)
fade = np.minimum(1, np.minimum(d, 6 - d) / 0.3)
save("rain", rain * fade, 0.7)

# motor que arranca y ruge
d = t(3.0)
f0 = 28 + 60 * np.clip((d - 0.6) / 1.2, 0, 1) ** 0.7
ph = 2 * np.pi * np.cumsum(f0) / SR
eng = np.sign(np.sin(ph)) * 0.6 + np.sin(2 * ph) * 0.4
eng = lp(eng + rng.normal(size=d.size) * 0.3, 1200)
starter = np.where(d < 0.6, np.sin(2 * np.pi * 18 * d) > 0, 0) * lp(rng.normal(size=d.size), 600) * 2
env = np.clip((d - 0.5) / 0.15, 0, 1)
save("engine", eng * env + starter)

# moto que tose y se apaga
d = t(2.2)
x = np.zeros(d.size)
times = [0.0, 0.18, 0.33, 0.52, 0.8, 1.15, 1.6]
for i, tt in enumerate(times):
    n = int(0.12 * SR); p = int(tt * SR)
    x[p:p + n] += lp(rng.normal(size=n), 500 - i * 50) * np.exp(-np.arange(n) / (0.03 * SR)) * (1 - i * 0.12)
save("sputter", x)

# gruñidos de horda (loop 8 s): varias voces graves con formantes que se mueven
d = t(8)
horde = np.zeros(d.size)
for k in range(14):
    f = rng.uniform(70, 130); start = rng.uniform(0, 6); dur = rng.uniform(0.8, 2.0)
    m = (d > start) & (d < start + dur)
    env = np.zeros(d.size); env[m] = np.sin(np.pi * (d[m] - start) / dur) ** 2
    vib = f * (1 + 0.06 * np.sin(2 * np.pi * rng.uniform(3, 7) * d))
    src = np.sign(np.sin(2 * np.pi * np.cumsum(vib) / SR)) + rng.normal(size=d.size) * 0.8
    horde += bp(src, 250, 1100) * env * rng.uniform(0.5, 1)
fade = np.minimum(1, np.minimum(d, 8 - d) / 0.5)
save("horde", lp(horde, 1400) * fade, 0.7)

# gruñido solo (corto, cercano)
d = t(1.4)
f = 85 * (1 + 0.1 * np.sin(2 * np.pi * 5 * d))
src = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) + rng.normal(size=d.size)
env = np.sin(np.pi * d / 1.4) ** 1.5
save("growl", bp(src, 200, 1300) * env)

# olfateo: tres inhalaciones cortas
d = t(1.2)
x = np.zeros(d.size)
for tt in [0.05, 0.3, 0.55]:
    n = int(0.16 * SR); p = int(tt * SR)
    x[p:p + n] += bp(rng.normal(size=n), 1500, 6000) * np.sin(np.pi * np.arange(n) / n) ** 2
save("sniff", x, 0.6)
print("ok")

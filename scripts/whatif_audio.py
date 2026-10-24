# © 2026 Cristian Luis Celie. All rights reserved. Portfolio excerpt from AI Video Studio: shared for review only, not licensed for use, copying or redistribution.
"""Audio sintetizado para el piloto "electrones" (sin samples externos):
- meow.wav: "mia-" normal (0.6 s) y luego el "uuuu" estirado en cámara ultra lenta (9 s), con el tono
  cayendo como una grabación ralentizada, volumen bajo y cola de reverberación.
- pad_calm.wav: ambiente suave de tarde (acorde abierto), para antes del evento.
- drone.wav: zumbido grave e inquietante que crece despacio, para después del evento.
- dust.wav: "shhh" de polvo que sube (manos que se deshacen).
Uso: python scripts/whatif_audio.py  -> public/whatif/electrones/*.wav
"""
import os
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "whatif", "electrones")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def save(name, x, peak_db):
    x = x / (np.max(np.abs(x)) + 1e-9) * 10 ** (peak_db / 20)
    wavfile.write(os.path.join(OUT, name), SR, (x * 32767).astype(np.int16))
    print(name, f"{len(x) / SR:.2f}s", f"peak {peak_db} dBFS")


def reverb(x, seconds=2.2, mix=0.35):
    n = int(SR * seconds)
    ir = rng.standard_normal(n) * np.exp(-np.linspace(0, 7, n))
    ir = sosfilt(butter(2, 5000, "low", fs=SR, output="sos"), ir)
    dry = np.concatenate([x, np.zeros(n)])
    wet = fftconvolve(x, ir)[: len(dry)]
    wet = np.pad(wet, (0, len(dry) - len(wet)))
    return dry * (1 - mix) + wet / (np.max(np.abs(wet)) + 1e-9) * np.max(np.abs(x)) * mix


def formant_voice(f0, formants, bw, amp, breath=0.04):
    """Síntesis aditiva: armónicos de f0 con amplitudes dadas por las resonancias (formantes) de la vocal."""
    n = len(f0)
    phase = 2 * np.pi * np.cumsum(f0) / SR
    out = np.zeros(n)
    hmax = int(9000 / max(60, f0.min()))
    for h in range(1, hmax + 1):
        fh = f0 * h
        gain = np.zeros(n)
        for F, B in zip(formants, bw):
            gain += np.exp(-0.5 * ((fh - F) / B) ** 2)
        gain *= 1.0 / h ** 0.6
        gain[fh > SR / 2 - 500] = 0
        out += gain * np.sin(h * phase)
    noise = sosfilt(butter(2, [1500, 6000], "band", fs=SR, output="sos"), rng.standard_normal(n))
    return (out + noise * breath * np.max(np.abs(out))) * amp


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------------------------------------------------------- maullido "mia-UUUU"
# parte 1: "mi-a" (0.6 s) de gatita: arranque nasal suave ("m"), tono agudo que sube y se abre
n1 = int(0.6 * SR)
t1 = np.linspace(0, 1, n1)
f0_1 = np.where(t1 < 0.12, 780, np.where(t1 < 0.5, lerp(780, 1120, (t1 - 0.12) / 0.38), lerp(1120, 1050, (t1 - 0.5) / 0.5)))
f0_1 = f0_1 * (1 + 0.015 * np.sin(2 * np.pi * 7 * t1 * 0.6))
v = np.clip((t1 - 0.12) / 0.4, 0, 1)  # m -> i -> a
nasal = np.clip(1 - t1 / 0.12, 0, 1)
F1 = [lerp(lerp(380, 1000, v), 280, nasal), lerp(lerp(2700, 1550, v), 1250, nasal), lerp(3400, 3000, v)]
env1 = np.clip(t1 / 0.05, 0, 1) * (0.55 + 0.45 * (1 - nasal))
part1 = formant_voice(f0_1, F1, [160, 260, 340], env1, breath=0.025)

# parte 2: "uuuu" en cámara ultra lenta (9 s): el tono cae como cinta ralentizada y los formantes bajan
n2 = int(9.0 * SR)
t2 = np.linspace(0, 1, n2)
slow = np.power(t2, 0.55)
f0_2 = 1050 * np.power(150 / 1050, slow)  # 1050 Hz -> 150 Hz
f0_2 *= 1 + 0.01 * np.sin(2 * np.pi * 4 * np.linspace(0, 9, n2)) * (1 - t2)
scale = np.power(0.42, slow)  # formantes que bajan con la velocidad
F2 = [lerp(1000, 380, np.clip(t2 * 12, 0, 1)) * scale, lerp(1550, 850, np.clip(t2 * 12, 0, 1)) * scale, 2800 * scale]
env2 = np.minimum(1.0, 0.9 + 0.1 * np.cos(np.pi * t2)) * np.exp(-2.2 * t2) * np.clip((1 - t2) / 0.25, 0, 1)
part2 = formant_voice(f0_2, F2, [110 * scale + 30, 160 * scale + 40, 260 * scale + 60], env2, breath=0.02)
# empalme suave entre las dos partes
xf = int(0.04 * SR)
meow = np.concatenate([part1[:-xf], part1[-xf:] * np.linspace(1, 0, xf) + part2[:xf] * np.linspace(0, 1, xf), part2[xf:]])
meow = sosfilt(butter(2, 90, "high", fs=SR, output="sos"), meow)
save("meow.wav", reverb(meow, 2.6, 0.38), -10)

# ---------------------------------------------------------------- ambiente calmo (acorde abierto)
dur = 4.5
t = np.arange(int(dur * SR)) / SR
pad = np.zeros_like(t)
for f, a in [(261.6, 1), (392.0, 0.8), (493.9, 0.5), (587.3, 0.45), (659.3, 0.35)]:
    for d in (-0.4, 0.4):
        pad += a * np.sin(2 * np.pi * (f + d) * t + rng.random() * 6)
pad *= np.clip(t / 1.2, 0, 1) * np.clip((dur - t) / 1.5, 0, 1) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.25 * t))
pad = sosfilt(butter(2, 2500, "low", fs=SR, output="sos"), pad)
save("pad_calm.wav", reverb(pad, 2.0, 0.3), -14)

# ---------------------------------------------------------------- zumbido inquietante que crece
dur = 26.0
t = np.arange(int(dur * SR)) / SR
dr = np.zeros_like(t)
for f, a in [(55.0, 1), (82.4, 0.6), (110.0, 0.45), (116.5, 0.25), (164.8, 0.2)]:
    dr += a * np.sin(2 * np.pi * f * t + 0.6 * np.sin(2 * np.pi * 0.07 * t))
air = sosfilt(butter(2, [300, 1800], "band", fs=SR, output="sos"), rng.standard_normal(len(t)))
dr += air * 0.25
grow = np.clip(t / dur, 0, 1) ** 1.3
dr *= (0.25 + 0.75 * grow) * np.clip(t / 2.0, 0, 1) * np.clip((dur - t) / 2.5, 0, 1) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.18 * t))
save("drone.wav", dr, -13)

# ---------------------------------------------------------------- polvo que sube ("shhh")
dur = 8.0
t = np.arange(int(dur * SR)) / SR
nz = rng.standard_normal(len(t))
out = np.zeros_like(t)
# barrido de un pasabanda que sube de 900 a 5000 Hz por tramos
for i in range(16):
    a, b = int(i * len(t) / 16), int((i + 1) * len(t) / 16)
    fc = 900 * (5000 / 900) ** (i / 15)
    seg = sosfilt(butter(2, [fc * 0.7, fc * 1.3], "band", fs=SR, output="sos"), nz[max(0, a - 2000) : b])
    out[a:b] = seg[-(b - a) :]
grain = (rng.random(len(t)) < 0.002) * rng.standard_normal(len(t)) * 3
out += sosfilt(butter(2, 3000, "high", fs=SR, output="sos"), grain)
out *= np.clip(t / 1.5, 0, 1) ** 1.5 * np.clip((dur - t) / 2.5, 0, 1)
save("dust.wav", reverb(out, 1.5, 0.3), -15)

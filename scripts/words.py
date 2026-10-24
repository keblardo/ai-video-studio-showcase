# © 2026 Cristian Luis Celie. All rights reserved. Portfolio excerpt from AI Video Studio: shared for review only, not licensed for use, copying or redistribution.
# Tiempos por palabra de una narración (faster-whisper) -> JSON para Remotion
import json, sys
from faster_whisper import WhisperModel
src, out = sys.argv[1], sys.argv[2]
lang = sys.argv[3] if len(sys.argv) > 3 else "en"
m = WhisperModel("small.en" if lang == "en" else "small", device="cpu", compute_type="int8")
segs, _ = m.transcribe(src, word_timestamps=True, language=lang, beam_size=5)
words = []
for s in segs:
    for w in s.words:
        words.append({"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)})
json.dump(words, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(len(words), "words")
print(" ".join(f"{w['w']}@{w['s']}" for w in words))

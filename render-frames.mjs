// © 2026 Cristian Luis Celie. All rights reserved. Portfolio excerpt from AI Video Studio: shared for review only, not licensed for use, copying or redistribution.
// Fotogramas de revisión de cualquier composición con un solo bundle (WebGL vía ANGLE para las escenas 3D):
// node render-frames.mjs <CompositionId> <carpeta-salida> <frame> [frame...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const [id, outDir, ...rest] = process.argv.slice(2);
const frames = rest.map(Number);
fs.mkdirSync(outDir, { recursive: true });
const chromiumOptions = { gl: "angle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id, chromiumOptions });
console.log("duration", composition.durationInFrames);
for (const frame of frames) {
  const out = path.resolve(outDir, `f${String(frame).padStart(4, "0")}.jpg`);
  await renderStill({ composition, serveUrl, output: out, frame, imageFormat: "jpeg", jpegQuality: 85, chromiumOptions });
  console.log("ok", frame);
}
// el bundle temporal pesa cientos de MB: se borra al terminar para no llenar el disco
fs.rmSync(serveUrl, { recursive: true, force: true });

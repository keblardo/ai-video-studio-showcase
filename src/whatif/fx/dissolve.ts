// © 2026 Cristian Luis Celie. All rights reserved. Portfolio excerpt from AI Video Studio: shared for review only, not licensed for use, copying or redistribution.
import * as THREE from "three";

// Disolución de materia: un "frente" esférico que avanza desde un origen y hace desaparecer los
// materiales parcheados con un borde irregular y brillante. Hay dos frentes independientes:
// "world" (la plaza y la gata) y "hands" (el protagonista, que resiste más). Cada composición
// actualiza los uniforms en cada fotograma.
export type DissolveUniforms = {
  /** radio del frente en metros (negativo = nada disuelto) */
  uRadius: { value: number };
  uOrigin: { value: THREE.Vector3 };
  /** irregularidad del frente (m) */
  uBand: { value: number };
  uFreq: { value: number };
  uEdgeColor: { value: THREE.Color };
  /** 0..1: lleva los colores hacia un gris fantasmal (sin electrones no hay color) */
  uGhost: { value: number };
  /** intensidad del brillo del borde */
  uEdgeK: { value: number };
};

const make = (edge: string, band: number, freq: number): DissolveUniforms => ({
  uRadius: { value: -1 },
  uOrigin: { value: new THREE.Vector3() },
  uBand: { value: band },
  uFreq: { value: freq },
  uEdgeColor: { value: new THREE.Color(edge) },
  uGhost: { value: 0 },
  uEdgeK: { value: 3 },
});

export const FX = { world: make("#a8ecff", 0.18, 14), hands: make("#ffb27a", 0.1, 26), deck: make("#e8d2a8", 0.25, 3.5) };
FX.hands.uEdgeK.value = 0.9;
export type FxKey = keyof typeof FX;

const NOISE = /* glsl */ `
varying vec3 vWPosD;
uniform float uRadius;
uniform vec3 uOrigin;
uniform float uBand;
uniform float uFreq;
uniform vec3 uEdgeColor;
uniform float uGhost;
uniform float uEdgeK;
float dHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float dNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dHash(i), dHash(i + vec3(1,0,0)), f.x), mix(dHash(i + vec3(0,1,0)), dHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(dHash(i + vec3(0,0,1)), dHash(i + vec3(1,0,1)), f.x), mix(dHash(i + vec3(0,1,1)), dHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float dFront() {
  float n = dNoise(vWPosD * uFreq) * 0.65 + dNoise(vWPosD * uFreq * 2.9) * 0.35;
  float d = distance(vWPosD, uOrigin);
  // lo lejano se deshace con bordes más grandes (el frente crece con la distancia)
  return uRadius - d + (n - 0.5) * (uBand + d * 0.12);
}
`;

function patcher(U: DissolveUniforms) {
  return (shader: THREE.WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWPosD;").replace(
      "#include <project_vertex>",
      `#include <project_vertex>
#ifdef USE_INSTANCING
  vWPosD = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vWPosD = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + NOISE)
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
  float dF = dFront();
  if (dF > 0.0) discard;
  float dEdge = smoothstep(-(0.01 + distance(vWPosD, uOrigin) * 0.015), 0.0, dF);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
  totalEmissiveRadiance += uEdgeColor * dEdge * uEdgeK;`,
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
  float dL = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(dL) * vec3(0.9, 0.97, 1.06), uGhost);`,
      );
  };
}

/** Props para un <meshStandardMaterial> que se disuelve con el frente indicado. */
export const dissolveFor = (key: FxKey) => ({
  onBeforeCompile: patcher(FX[key]),
  customProgramCacheKey: () => `dissolve-${key}`,
});
export const dissolveProps = dissolveFor("world");

/** Frente que crece exponencialmente: r(t) = A·(e^(k·t) − 1), con t en segundos desde `start`. */
export const front = (A: number, k: number, start: number) => ({
  r: (t: number) => (t <= start ? -1 : A * (Math.exp(k * (t - start)) - 1)),
  /** momento (s) en que el frente alcanza la distancia d */
  tAt: (d: number) => start + Math.log(Math.max(0, d) / A + 1) / k,
});

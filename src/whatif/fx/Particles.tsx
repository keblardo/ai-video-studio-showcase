// © 2026 Cristian Luis Celie. All rights reserved. Portfolio excerpt from AI Video Studio: shared for review only, not licensed for use, copying or redistribution.
import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

// Partículas deterministas: cada una nace en `start`, se libera en `rel` (segundos de video) y se
// mueve con su velocidad + deriva hacia arriba + turbulencia. Todo se calcula en el shader a partir
// del tiempo, así cualquier fotograma se puede renderizar en cualquier orden (requisito de Remotion).
export type ParticleData = {
  start: number[];
  vel: number[];
  rel: number[];
  col: number[];
  size: number[];
  life: number[];
};

export const emptyParticles = (): ParticleData => ({ start: [], vel: [], rel: [], col: [], size: [], life: [] });

export function pushParticle(P: ParticleData, p: THREE.Vector3, v: THREE.Vector3, rel: number, c: THREE.Color, size: number, life: number) {
  P.start.push(p.x, p.y, p.z);
  P.vel.push(v.x, v.y, v.z);
  P.rel.push(rel);
  P.col.push(c.r, c.g, c.b);
  P.size.push(size);
  P.life.push(life);
}

const VERT = /* glsl */ `
attribute vec3 aVel;
attribute float aRel;
attribute vec3 aCol;
attribute float aSize;
attribute float aLife;
uniform float uT;
uniform float uPix;
uniform float uRise;
uniform float uTurb;
uniform vec3 uWind;
uniform float uMaxPx;
uniform float uGrow;
varying vec3 vCol;
varying float vA;
varying float vSeed;
varying float vAge;
void main() {
  float age = uT - aRel;
  vSeed = fract(float(gl_VertexID) * 0.6180339);
  vAge = max(age, 0.0);
  vec3 p = position;
  float a = 0.0;
  if (age > 0.0) {
    float s = float(gl_VertexID) * 0.6180339;
    p += aVel * age + vec3(0.0, uRise, 0.0) * age * age + uWind * age * age;
    p.x += sin(age * 1.9 + s * 6.2831) * uTurb * age;
    p.z += cos(age * 1.4 + s * 4.1) * uTurb * age;
    p.y += sin(age * 2.3 + s * 3.0) * uTurb * 0.5 * age;
    a = smoothstep(0.0, 0.1, age) * (1.0 - smoothstep(aLife * 0.55, aLife, age));
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = aSize * (1.0 + uGrow * max(age, 0.0)) * uPix / -mv.z;
  // las partículas que pasan pegadas a la cámara se desvanecen en vez de taparlo todo
  a *= 1.0 - smoothstep(uMaxPx * 0.6, uMaxPx, px);
  gl_PointSize = a > 0.001 ? clamp(px, 1.5, uMaxPx) : 0.0;
  vCol = aCol;
  vA = a;
}`;

const FRAG = /* glsl */ `
uniform float uGlow;
uniform float uSmoke;
varying vec3 vCol;
varying float vA;
varying float vSeed;
varying float vAge;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float s = smoothstep(0.5, 0.1, d);
  vec3 col = vCol;
  if (uSmoke > 0.0) {
    // bocanada de humo: borde de ruido que se arremolina, núcleo más denso y sombreado arriba-abajo
    float a = vSeed * 6.2831 + vAge * 0.3;
    vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * c;
    float n = n2(q * 4.0 + vSeed * 17.0) * 0.6 + n2(q * 9.0 + vSeed * 31.0) * 0.4;
    float puff = smoothstep(0.5, 0.05, d + (n - 0.5) * 0.45);
    s = mix(s, puff * (0.55 + 0.45 * n), uSmoke);
    col *= mix(1.0, 0.75 + 0.45 * (0.5 - c.y) + 0.15 * n, uSmoke);
  }
  gl_FragColor = vec4(col * (1.0 + uGlow), vA * s);
  #include <colorspace_fragment>
}`;

export const Particles: React.FC<{ data: ParticleData; t: number; additive?: boolean; glow?: number; rise?: number; turb?: number; wind?: [number, number, number]; maxPx?: number; smoke?: number; grow?: number }> = ({ data, t, additive = false, glow = 0, rise = 0, turb = 0, wind = [0, 0, 0], maxPx = 100000, smoke = 0, grow = 0 }) => {
  const { size, camera, gl } = useThree();
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(data.start, 3));
    g.setAttribute("aVel", new THREE.Float32BufferAttribute(data.vel, 3));
    g.setAttribute("aRel", new THREE.Float32BufferAttribute(data.rel, 1));
    g.setAttribute("aCol", new THREE.Float32BufferAttribute(data.col, 3));
    g.setAttribute("aSize", new THREE.Float32BufferAttribute(data.size, 1));
    g.setAttribute("aLife", new THREE.Float32BufferAttribute(data.life, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return g;
  }, [data]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: { uT: { value: 0 }, uPix: { value: 1 }, uRise: { value: 0 }, uTurb: { value: 0 }, uWind: { value: new THREE.Vector3() }, uGlow: { value: 0 }, uMaxPx: { value: 100000 }, uSmoke: { value: 0 }, uGrow: { value: 0 } },
      }),
    [additive],
  );
  const fov = (camera as THREE.PerspectiveCamera).fov ?? 60;
  mat.uniforms.uT.value = t;
  // gl_PointSize va en píxeles reales del lienzo: con supermuestreo (dpr > 1) hay que escalarlo
  mat.uniforms.uPix.value = (size.height * gl.getPixelRatio()) / 2 / Math.tan((fov * Math.PI) / 360);
  mat.uniforms.uRise.value = rise;
  mat.uniforms.uTurb.value = turb;
  mat.uniforms.uWind.value.set(...wind);
  mat.uniforms.uGlow.value = glow;
  mat.uniforms.uMaxPx.value = maxPx * gl.getPixelRatio();
  mat.uniforms.uSmoke.value = smoke;
  mat.uniforms.uGrow.value = grow;
  return <points geometry={geo} material={mat} frustumCulled={false} />;
};

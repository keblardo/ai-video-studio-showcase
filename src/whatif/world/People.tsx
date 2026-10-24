// © 2026 Cristian Luis Celie. All rights reserved. Portfolio excerpt from AI Video Studio: shared for review only, not licensed for use, copying or redistribution.
import React, { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { dissolveFor, type FxKey } from "../fx/dissolve";

// Multitudes de personas estilo juguete (instanciadas): piernas, cadera, torso, brazos, cuello,
// cabeza con pelo y zapatillas, con poses (parado, caminando, acostado, sentado, nadando, saludando)
// y colores de ropa/piel/pelo por persona. Pensado para cientos de personas a la vez.

export type Pose = "stand" | "walk" | "lie" | "sit" | "swim" | "wave";
export type PersonSpec = { x: number; y: number; z: number; yaw: number; pose: Pose; skin: string; hair: string; top: string; bottom: string; shoes: string; h: number; phase: number; bareArms?: boolean; bareLegs?: boolean; bald?: boolean; move?: number; stopAt?: number };

type Part = "legL" | "legR" | "hips" | "torso" | "armL" | "armR" | "neck" | "head" | "hair" | "shoeL" | "shoeR";
const PARTS: Part[] = ["legL", "legR", "hips", "torso", "armL", "armR", "neck", "head", "hair", "shoeL", "shoeR"];

const GEOS = (() => {
  let g: Record<Part, THREE.BufferGeometry> | null = null;
  return () => {
    if (g) return g;
    const leg = new THREE.CapsuleGeometry(0.075, 0.68, 4, 10).translate(0, -0.41, 0); // pivote en la cadera
    const arm = new THREE.CapsuleGeometry(0.052, 0.56, 4, 10).translate(0, -0.33, 0); // pivote en el hombro
    const torso = new THREE.CapsuleGeometry(0.16, 0.3, 6, 14).scale(1.08, 1, 0.72);
    const hips = new THREE.SphereGeometry(1, 14, 10).scale(0.17, 0.12, 0.12);
    const neck = new THREE.CylinderGeometry(0.045, 0.05, 0.1, 10);
    const head = new THREE.SphereGeometry(0.125, 18, 14).scale(1, 1.08, 1);
    const hair = new THREE.SphereGeometry(0.133, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1, 1.1, 1.05).rotateX(0.35);
    const shoe = new THREE.SphereGeometry(1, 12, 8).scale(0.06, 0.045, 0.12).translate(0, -0.85, 0.04);
    g = { legL: leg, legR: leg, hips, torso, armL: arm, armR: arm, neck, head, hair, shoeL: shoe, shoeR: shoe };
    return g;
  };
})();

const M4 = () => new THREE.Matrix4();
/** matrices locales de cada parte según la pose y el tiempo */
function partMatrices(p: PersonSpec, t: number): Record<Part, THREE.Matrix4> {
  const sw = p.pose === "walk" ? Math.sin(t * 6.5 + p.phase) * 0.55 : 0;
  const wave = p.pose === "wave" ? Math.sin(t * 8 + p.phase) * 0.5 : 0;
  const sit = p.pose === "sit";
  const leg = (s: number) => {
    const m = M4().makeTranslation(s * 0.095, 0.88, 0);
    const rx = sit ? -1.45 : s * sw;
    m.multiply(M4().makeRotationX(rx));
    return m;
  };
  const shoe = (s: number) => leg(s);
  const arm = (s: number) => {
    const m = M4().makeTranslation(s * 0.215, 1.4, 0);
    let rx = -s * sw * 0.9;
    let rz = s * 0.12;
    if (p.pose === "wave" && s > 0) {
      rx = 0;
      rz = 2.6 + wave * 0.3;
    }
    if (p.pose === "swim") rx = Math.sin(t * 3 + p.phase + s) * 1.6;
    m.multiply(M4().makeRotationZ(rz)).multiply(M4().makeRotationX(rx));
    return m;
  };
  return {
    legL: leg(-1),
    legR: leg(1),
    shoeL: shoe(-1),
    shoeR: shoe(1),
    hips: M4().makeTranslation(0, 0.92, 0),
    torso: M4().makeTranslation(0, 1.2, 0),
    armL: arm(-1),
    armR: arm(1),
    neck: M4().makeTranslation(0, 1.5, 0),
    head: M4().makeTranslation(0, 1.66, 0),
    hair: M4().makeTranslation(0, 1.685, 0.008),
  };
}
function personMatrix(p: PersonSpec, s: number, t: number) {
  const d = (p.move ?? 0) * Math.min(t, p.stopAt ?? 1e9);
  const m = M4().makeTranslation(p.x + Math.sin(p.yaw) * d, p.y, p.z + Math.cos(p.yaw) * d).multiply(M4().makeRotationY(p.yaw));
  if (p.pose === "lie") m.multiply(M4().makeTranslation(0, 0.13, 0)).multiply(M4().makeRotationX(-Math.PI / 2)).multiply(M4().makeTranslation(0, -0.9, 0));
  if (p.pose === "sit") m.multiply(M4().makeTranslation(0, -0.45, 0));
  return m.multiply(M4().makeScale(p.h * s, p.h * s, p.h * s));
}
const colorOf = (p: PersonSpec, part: Part) => {
  switch (part) {
    case "legL":
    case "legR":
      return p.bottom;
    case "hips":
      return p.bottom;
    case "torso":
      return p.top;
    case "armL":
    case "armR":
      return p.bareArms ? p.skin : p.top;
    case "neck":
    case "head":
      return p.skin;
    case "hair":
      return p.hair;
    default:
      return p.shoes;
  }
};

/** Multitud. `scaleOf(i)` devuelve 0..1 (0 = desaparecida). */
export const People: React.FC<{ people: PersonSpec[]; t: number; scaleOf?: (i: number) => number; fx?: FxKey; shadows?: boolean }> = ({ people, t, scaleOf, fx = "hands", shadows = true }) => {
  const refs = useRef<Partial<Record<Part, THREE.InstancedMesh | null>>>({});
  const geos = GEOS();
  useLayoutEffect(() => {
    const c = new THREE.Color();
    PARTS.forEach((part) => {
      const mesh = refs.current[part];
      if (!mesh) return;
      people.forEach((p, i) => {
        // piernas desnudas con traje de baño: la pierna va del color de la piel
        const col = (part === "legL" || part === "legR") && p.bareLegs ? p.skin : colorOf(p, part);
        mesh.setColorAt(i, c.set(p.bald && part === "hair" ? p.skin : col));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }, [people]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    people.forEach((p, i) => {
      const s = Math.max(1e-4, scaleOf ? scaleOf(i) : 1);
      const base = personMatrix(p, s, t);
      const parts = partMatrices(p, t);
      PARTS.forEach((part) => {
        const mesh = refs.current[part];
        if (!mesh) return;
        m.multiplyMatrices(base, parts[part]);
        mesh.setMatrixAt(i, m);
      });
    });
    PARTS.forEach((part) => {
      const mesh = refs.current[part];
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    });
  }, [people, t, scaleOf]);
  return (
    <group>
      {PARTS.map((part) => (
        <instancedMesh
          key={part}
          ref={(el) => {
            refs.current[part] = el;
          }}
          args={[geos[part], undefined, people.length]}
          castShadow={shadows}
          receiveShadow
          frustumCulled={false}
        >
          <meshStandardMaterial roughness={part === "hair" ? 0.7 : 0.75} {...dissolveFor(fx)} />
        </instancedMesh>
      ))}
    </group>
  );
};

// ---------------------------------------------------------------- paletas para generar gente
export const SKINS = ["#f1c9a5", "#e0ac87", "#c68863", "#8d5a3b", "#f6d7bf", "#a8714d", "#6b4630"];
export const HAIRS = ["#2b1d14", "#5a3a26", "#c9a063", "#1a1a1a", "#8a4b2a", "#d8c7a8", "#3a2a20"];
export const CLOTHES = ["#ff5f6d", "#ffc94d", "#4fd1c5", "#5b8def", "#ffffff", "#ff8fb1", "#2e3a4f", "#7bd389", "#b06bff", "#f2efe6", "#e07a3f", "#3c4a5e"];
export function randomPerson(r: () => number, x: number, y: number, z: number, pose: Pose, beach: boolean): PersonSpec {
  const skin = SKINS[Math.floor(r() * SKINS.length)];
  const top = CLOTHES[Math.floor(r() * CLOTHES.length)];
  const swim = beach && r() < 0.8;
  const bareChest = swim && r() < 0.45;
  return {
    x,
    y,
    z,
    yaw: r() * Math.PI * 2,
    pose,
    skin,
    hair: HAIRS[Math.floor(r() * HAIRS.length)],
    top: bareChest ? skin : top,
    bottom: swim ? (bareChest ? CLOTHES[Math.floor(r() * CLOTHES.length)] : top) : r() < 0.5 ? "#3c4a6e" : CLOTHES[Math.floor(r() * CLOTHES.length)],
    shoes: swim ? skin : r() < 0.6 ? "#f4f2ee" : "#2b2b2b",
    h: 0.88 + r() * 0.2,
    phase: r() * 6.28,
    bareArms: beach || r() < 0.4,
    bareLegs: swim,
    bald: r() < 0.08,
  };
}

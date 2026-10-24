// © 2026 Cristian Luis Celie. All rights reserved. Portfolio excerpt from AI Video Studio: shared for review only, not licensed for use, copying or redistribution.
import React from "react";
import { interpolate } from "remotion";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadNunito } from "@remotion/google-fonts/Nunito";

// Textos de pantalla compartidos por los episodios "What if": título de apertura (versalitas
// chiquitas + palabra clave enorme en serif cursiva con brillo + frase), contador fino y
// subtítulos. Mismo diseño en todos los episodios; cambian el texto y el color de la palabra clave.

export const { fontFamily: SERIF } = loadFraunces("italic", { weights: ["400", "700", "900"], subsets: ["latin", "latin-ext"] });
export const { fontFamily: SANS } = loadNunito("normal", { weights: ["600", "700", "800", "900"], subsets: ["latin", "latin-ext"] });
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type KeywordStyle = { gradient: string; glow: string };

export const TitleCard: React.FC<{ t: number; tEvent: number; pre: string; keyword: string; post: string; style: KeywordStyle; keywordSize?: number; t0?: number }> = ({ t, tEvent, pre, keyword, post, style, keywordSize = 158, t0 = 0 }) => {
  const o = interpolate(t, [t0, t0 + 0.25, tEvent - 0.1, tEvent + 0.25], [0, 1, 1, 0], clamp);
  if (o <= 0) return null;
  return (
    <div style={{ position: "absolute", top: 190, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", opacity: o }}>
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 30, letterSpacing: "0.32em", color: "rgba(255,255,255,.92)", textShadow: "0 2px 10px rgba(0,0,0,.5)" }}>{pre}</div>
      <div
        style={{
          fontFamily: SERIF,
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: keywordSize,
          lineHeight: 1.0,
          marginTop: 6,
          backgroundImage: style.gradient,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          filter: `drop-shadow(0 0 22px ${style.glow}) drop-shadow(0 4px 10px rgba(0,0,0,.45))`,
        }}
      >
        {keyword}
      </div>
      <div style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: 54, color: "#fff", marginTop: 2, textShadow: "0 2px 12px rgba(0,0,0,.55)" }}>{post}</div>
    </div>
  );
};

export const CountdownHud: React.FC<{ t: number; tEvent: number; tBack: number; seconds?: number; preLabel: string; postLabel: string; subLabel: string; subColor?: string; t0?: number }> = ({ t, tEvent, tBack, seconds = 5, preLabel, postLabel, subLabel, subColor = "rgba(190,240,255,.85)", t0 = 0 }) => {
  const pre = t < tEvent;
  if (t > tBack + 0.6) return null;
  const remaining = Math.max(0, seconds * (1 - (t - tEvent) / (tBack - tEvent)));
  const o = pre ? interpolate(t, [t0 + 0.4, t0 + 0.8], [0, 1], clamp) : interpolate(t, [tEvent, tEvent + 0.4, tBack, tBack + 0.6], [0, 1, 1, 0], clamp);
  const val = pre ? `${(tEvent - t).toFixed(2)} s` : `${remaining.toFixed(2)} s`;
  const urgent = !pre && remaining <= 2;
  return (
    <div style={{ position: "absolute", top: pre ? 640 : 205, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", opacity: o }}>
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 24, letterSpacing: "0.3em", color: "rgba(255,255,255,.85)", textShadow: "0 2px 8px rgba(0,0,0,.6)" }}>{pre ? preLabel : postLabel}</div>
      <div style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: pre ? 84 : 112, lineHeight: 1.05, color: urgent ? "#ffd2a8" : "#ffffff", textShadow: urgent ? "0 0 24px rgba(255,170,90,.6)" : "0 2px 14px rgba(0,0,0,.55)", fontVariantNumeric: "tabular-nums" }}>{val}</div>
      {!pre ? <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 20, letterSpacing: "0.28em", color: subColor, marginTop: 4, textShadow: "0 2px 8px rgba(0,0,0,.6)" }}>{subLabel}</div> : null}
    </div>
  );
};

export type Sub = [number, number, string];
export const Subtitles: React.FC<{ t: number; subs: Sub[]; top?: number }> = ({ t, subs, top = 1250 }) => {
  const s = subs.find(([a, b]) => t >= a - 0.05 && t < b);
  if (!s) return null;
  const [a, b, text] = s;
  const o = interpolate(t, [a, a + 0.15, b - 0.15, b], [0, 1, 1, 0], clamp);
  const y = interpolate(t, [a, a + 0.25], [14, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top, display: "flex", justifyContent: "center", opacity: o, transform: `translateY(${y}px)` }}>
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 54, lineHeight: 1.18, color: "#fff", textAlign: "center", textShadow: "0 2px 3px rgba(0,0,0,.55), 0 6px 22px rgba(0,0,0,.45)" }}>{text}</div>
    </div>
  );
};

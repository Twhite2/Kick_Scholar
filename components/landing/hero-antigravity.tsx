"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Antigravity } from "./antigravity";

/**
 * Mouse-reactive particle background for the hero. Skipped entirely under
 * prefers-reduced-motion, on small viewports (WebGL isn't worth the
 * battery/perf cost on a phone for a decorative background), and where the
 * browser can't create a WebGL context (hardware acceleration off), which
 * would otherwise throw an unhandled error from the renderer.
 */
function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function HeroAntigravityBackground({
  eventSource,
}: {
  eventSource: HTMLElement | null;
}) {
  const reduceMotion = useReducedMotion();
  // Lazy initializer instead of reading matchMedia + setState in an effect —
  // this component only ever mounts client-side (dynamic ssr:false), so
  // `window` is always available here.
  const [webgl] = useState(supportsWebGL);
  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 640px)").matches);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 640px)");
    const onChange = () => setWide(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  if (reduceMotion || !webgl || !wide || !eventSource) return null;

  return (
    <div className="absolute inset-0" aria-hidden>
      <Antigravity
        eventSource={eventSource}
        count={160}
        magnetRadius={9}
        ringRadius={7}
        waveSpeed={0.35}
        waveAmplitude={1.1}
        particleSize={1.6}
        lerpSpeed={0.08}
        colors={["#0b4f8c", "#2e8b57", "#3d8bd1"]}
        autoAnimate
        rotationSpeed={0.06}
        depthFactor={0.6}
        pulseSpeed={2.5}
        particleShape="capsule"
        fieldStrength={12}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { markHomeVisited } from "@/lib/actions/home";

/** Fires once after Home renders; see markHomeVisited. */
export function HomeVisitMarker() {
  const sent = useRef(false);
  useEffect(() => {
    // A short delay keeps it off the critical path of the first paint.
    const t = window.setTimeout(() => {
      if (sent.current) return;
      sent.current = true;
      void markHomeVisited().catch(() => {});
    }, 1500);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}

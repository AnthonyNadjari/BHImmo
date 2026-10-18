/**
 * Measures an element's content width (ResizeObserver), so SVG charts can be
 * drawn at their real pixel size — text stays legible on a phone instead of
 * being scaled down with a fixed viewBox.
 */

import { useEffect, useRef, useState } from "react";

export function useContainerWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(260, Math.round(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

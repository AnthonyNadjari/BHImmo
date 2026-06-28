/**
 * Resilient image element. Listing photos are hot-linked from a CDN; while a
 * photo loads we show a shimmer (so it never looks like a broken box), and if a
 * URL fails we fall back to a deterministic picsum image, then to a neutral
 * gradient.
 */

import { useEffect, useState } from "react";

interface Props {
  src: string;
  alt: string;
  /** Stable seed (property id) for the picsum fallback. */
  seed: string;
  className?: string;
  sizes?: string;
  eager?: boolean;
}

export function Img({ src, alt, seed, className, eager }: Props) {
  const fallback = `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/600`;
  const [current, setCurrent] = useState(src);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // When the `src` prop changes (e.g. gallery next/prev swaps the active photo)
  // re-sync internal state — otherwise the first image stays pinned forever.
  useEffect(() => {
    setCurrent(src);
    setFailed(false);
    setLoaded(false);
  }, [src]);

  if (failed) {
    return <div className={`img-fallback ${className ?? ""}`} role="img" aria-label={alt} />;
  }

  return (
    <img
      className={`${className ?? ""} ${loaded ? "" : "img-loading"}`}
      src={current}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
      onError={() => {
        setLoaded(false);
        if (current !== fallback) setCurrent(fallback);
        else setFailed(true);
      }}
    />
  );
}

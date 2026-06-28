/**
 * Resilient image element. Listing photos are hot-linked from a CDN; if a URL
 * ever fails we fall back to a deterministic picsum image, then to a neutral
 * gradient, so the UI never shows a broken-image icon.
 */

import { useState } from "react";

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

  if (failed) {
    return <div className={`img-fallback ${className ?? ""}`} role="img" aria-label={alt} />;
  }

  return (
    <img
      className={className}
      src={current}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => {
        if (current !== fallback) setCurrent(fallback);
        else setFailed(true);
      }}
    />
  );
}

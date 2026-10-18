/**
 * Resilient image element for the real location imagery (IGN aerial photos,
 * optional Mapillary / Street View). While a photo loads we show a shimmer; if
 * it fails we show a neutral placeholder — never a substitute stock photo.
 * IGN aerial views are centred on the address, so they get a location pin.
 */

import { useEffect, useState } from "react";

interface Props {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}

/** True for imagery centred on the property (IGN WMS views). */
export const isCentredView = (src: string): boolean => src.startsWith("https://data.geopf.fr/");

export function Img({ src, alt, className, eager }: Props) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Re-sync when `src` changes (gallery next/prev swaps the active photo).
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  if (failed || !src) {
    return <div className={`img-fallback ${className ?? ""}`} role="img" aria-label={alt} />;
  }

  return (
    <img
      className={`${className ?? ""} ${loaded ? "" : "img-loading"}`}
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  );
}

/** Pin marking the address at the centre of an aerial view. */
export function LocationPin({ src }: { src: string }) {
  return isCentredView(src) ? <span className="loc-pin" aria-hidden="true" /> : null;
}

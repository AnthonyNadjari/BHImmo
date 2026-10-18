/**
 * Location imagery gallery: a large active image (swipeable) + thumbnail
 * strip. The images are real views of the address — IGN aerial photography and
 * map, plus street-level photos when configured — with their credit line.
 */

import { useRef, useState } from "react";
import { Img, LocationPin } from "./Img";

export function Gallery({ images, alt, credit }: { images: string[]; alt: string; credit?: string }) {
  const [active, setActive] = useState(0);
  const startX = useRef<number | null>(null);

  if (images.length === 0) {
    return <div className="img-fallback gallery-main" role="img" aria-label={alt} />;
  }

  const go = (dir: number) => setActive((a) => (a + dir + images.length) % images.length);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0]!.clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    const dx = e.changedTouches[0]!.clientX - startX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    startX.current = null;
  };

  return (
    <div className="gallery">
      <div className="gallery-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <Img src={images[active]!} alt={alt} className="gallery-main" eager />
        <LocationPin src={images[active]!} />
        {credit && <span className="gallery-credit">{credit}</span>}
        {images.length > 1 && (
          <>
            <button className="gallery-nav prev" onClick={() => go(-1)} aria-label="Previous image">‹</button>
            <button className="gallery-nav next" onClick={() => go(1)} aria-label="Next image">›</button>
            <div className="gallery-count">{active + 1} / {images.length}</div>
            <div className="gallery-dots">
              {images.map((_, i) => (
                <span key={i} className={i === active ? "on" : ""} />
              ))}
            </div>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="gallery-strip">
          {images.map((src, i) => (
            <button
              key={i}
              className={`gallery-thumb ${i === active ? "active" : ""}`}
              onClick={() => setActive(i)}
              aria-label={`Image ${i + 1}`}
            >
              <Img src={src} alt={`${alt} — image ${i + 1}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

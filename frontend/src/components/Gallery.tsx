/** Listing photo gallery: a large active image (swipeable) + thumbnail strip. */

import { useRef, useState } from "react";
import { Img } from "./Img";

export function Gallery({ images, seed, alt }: { images: string[]; seed: string; alt: string }) {
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
        <Img src={images[active]!} seed={`${seed}-${active}`} alt={alt} className="gallery-main" eager />
        {images.length > 1 && (
          <>
            <button className="gallery-nav prev" onClick={() => go(-1)} aria-label="Previous photo">‹</button>
            <button className="gallery-nav next" onClick={() => go(1)} aria-label="Next photo">›</button>
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
              aria-label={`Photo ${i + 1}`}
            >
              <Img src={src} seed={`${seed}-${i}`} alt={`${alt} photo ${i + 1}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

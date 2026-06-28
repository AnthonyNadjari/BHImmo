/** Listing photo gallery: a large active image + a thumbnail strip. */

import { useState } from "react";
import { Img } from "./Img";

export function Gallery({ images, seed, alt }: { images: string[]; seed: string; alt: string }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return <div className="img-fallback gallery-main" role="img" aria-label={alt} />;
  }

  return (
    <div className="gallery">
      <Img src={images[active]!} seed={`${seed}-${active}`} alt={alt} className="gallery-main" eager />
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

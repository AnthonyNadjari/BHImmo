/** Toggle button that adds/removes a property from the local watchlist. */

import { useEffect, useState } from "react";
import type { Property } from "../types";
import { isWatched, toggleWatchlist } from "../services/watchlist";

export function WatchButton({ property }: { property: Property }) {
  const [watched, setWatched] = useState(false);

  useEffect(() => {
    setWatched(isWatched(property.id));
  }, [property.id]);

  return (
    <button
      type="button"
      className={`watch-btn ${watched ? "is-watched" : ""}`}
      onClick={() => setWatched(toggleWatchlist(property))}
    >
      {watched ? "★ Watching" : "☆ Add to watchlist"}
    </button>
  );
}

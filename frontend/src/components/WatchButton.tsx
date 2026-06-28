/** Toggle button that adds/removes a property from the local watchlist. */

import { useEffect, useState } from "react";
import type { Property } from "../types";
import { isWatched, toggleWatchlist } from "../services/watchlist";

export function WatchButton({ property }: { property: Property }) {
  const [watched, setWatched] = useState(false);

  // Stay in sync with changes from anywhere (other tabs, watchlist page).
  useEffect(() => {
    const sync = () => setWatched(isWatched(property.id));
    sync();
    window.addEventListener("prer:watchlist", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("prer:watchlist", sync);
      window.removeEventListener("storage", sync);
    };
  }, [property.id]);

  return (
    <button
      type="button"
      className={`watch-btn ${watched ? "is-watched" : ""}`}
      aria-pressed={watched}
      onClick={() => setWatched(toggleWatchlist(property))}
    >
      {watched ? "★ Watching" : "☆ Add to watchlist"}
    </button>
  );
}

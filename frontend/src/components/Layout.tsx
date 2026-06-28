/** App shell: top navigation + routed content. */

import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { watchCount } from "../services/watchlist";

export function Layout() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(watchCount());
    update();
    window.addEventListener("prer:watchlist", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("prer:watchlist", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◢◣</span>
          <span className="brand-name">Paris Real Estate Radar</span>
          <span className="brand-tag">P.R.E.R</span>
        </div>
        <nav className="nav">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/map">Map</NavLink>
          <NavLink to="/market">Market</NavLink>
          <NavLink to="/watchlist">
            Watchlist{count > 0 && <span className="nav-count">{count}</span>}
          </NavLink>
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">
        Data: BAN · DVF (Etalab) · Géorisques · ADEME · OSM · INSEE — open data.
        Synthetic listings, deterministic pipeline. No live offer.
      </footer>
    </div>
  );
}

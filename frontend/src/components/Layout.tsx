/** App shell: top navigation + routed content. */

import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Icon } from "./Icon";
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
        <Link to="/" className="brand" aria-label="BHImmobilier — home">
          <span className="brand-mark">
            <Icon name="radar" size={20} strokeWidth={2} />
          </span>
          <span className="brand-name">BHImmobilier</span>
        </Link>
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
        Live data: real Paris apartment transactions from DVF (Etalab), enriched with
        BAN · ADEME DPE · INSEE · IDFM · OSM · data.education · Vélib' &amp; arbres
        (opendata.paris.fr). Street-level photos © Mapillary contributors (CC-BY-SA) /
        Google Street View. Refreshed automatically via GitHub Actions.
      </footer>
    </div>
  );
}

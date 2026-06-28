/**
 * Routing. HashRouter is used so deep links work on GitHub Pages without any
 * server-side rewrite (no 404 fallback needed).
 */

import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { PropertyDetail } from "./pages/PropertyDetail";
import { Watchlist } from "./pages/Watchlist";
import { MapPage } from "./pages/MapPage";
import { Market } from "./pages/Market";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/market" element={<Market />} />
          <Route path="/property/:id" element={<PropertyDetail />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

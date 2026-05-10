// MotoAtlas Konstanten, transformRoute, applyFilters + Filter-State (Svelte 5 Runes).
//
// $state in .svelte.js-Modulen ist global teilbar — die Filter werden in
// Sidebar.svelte mutiert und in App.svelte / MapView.svelte gelesen,
// reaktiv ohne explicit prop-passing.

export const COUNTRIES = {
  de: { label: "Deutschland", flag: "DE" },
  be: { label: "Belgien", flag: "BE" },
  nl: { label: "Niederlande", flag: "NL" },
  fr: { label: "Frankreich", flag: "FR" },
  it: { label: "Italien", flag: "IT" },
};

export const TYPE_COLOR = { offroad: "#c4501e", touring: "#2d5016" };

export const MAP_BOUNDS = { west: 2.0, east: 14.5, north: 53.8, south: 42.3 };

export function transformRoute(r) {
  const coords =
    r.geometry && r.geometry.coordinates && r.geometry.coordinates.length > 1
      ? r.geometry.coordinates
      : r.bounds
        ? [
            [r.bounds.west, r.bounds.south],
            [(r.bounds.west + r.bounds.east) / 2, (r.bounds.south + r.bounds.north) / 2],
            [r.bounds.east, r.bounds.north],
          ]
        : [
            [7.0, 50.0],
            [7.5, 50.5],
          ];

  const duration_h =
    r.duration_h || Math.round((r.distance_km / (r.type === "offroad" ? 28 : 45)) * 10) / 10;

  const surfaceLabel =
    { paved: "Asphalt", gravel: "Schotter", mixed: "Asphalt / Schotter" }[r.surface] ||
    r.surface ||
    "–";

  return {
    id: r.id,
    name: r.name,
    country: r.country,
    region: r.region || (r.country || "").toUpperCase(),
    type: r.type || "touring",
    rating: r.rating || 4.0,
    distance_km: r.distance_km || 0,
    elevation_gain_m: r.elevation_gain_m || 0,
    duration_h,
    difficulty: r.difficulty || 2,
    surface: surfaceLabel,
    offroad_pct: r.offroad_pct || 0,
    review: r.agent_review || "",
    season: "Apr — Okt",
    path: coords,
    gpx_url: r.gpx_url || null,
    source_url: r.source_url || null,
    source_name: r.source_name || null,
    source_gpx_url: r.source_gpx_url || null,
    gpx_redistribution: r.gpx_redistribution || "link_only",
    images: [
      `${r.region || ""} ${r.type === "offroad" ? "trail" : "road"}`,
      `${r.name} panorama`,
      `${(r.country || "").toUpperCase()} ${r.type === "offroad" ? "offroad" : "touring"}`,
    ],
  };
}

export function applyFilters(routes, filters) {
  return routes.filter((r) => {
    if (filters.country !== "all" && r.country !== filters.country) return false;
    if (filters.type !== "all" && r.type !== filters.type) return false;
    if (filters.difficulty !== "all" && r.difficulty !== Number(filters.difficulty)) return false;
    return true;
  });
}

// Reaktiver Filter-State — wird quer durch alle Komponenten gelesen/geschrieben.
export const filters = $state({ country: "all", type: "all", difficulty: "all" });

// Aktive Selection / Hover — quer durch Map + Sidebar reaktiv.
export const ui = $state({ hoveredId: null, selectedId: null, mobileOpen: false });

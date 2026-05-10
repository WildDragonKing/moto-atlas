// MotoAtlas data — loads from catalog.json (pre-loaded into window.CATALOG)

const COUNTRIES = {
  de: { label: "Deutschland", flag: "DE" },
  be: { label: "Belgien",     flag: "BE" },
  nl: { label: "Niederlande", flag: "NL" },
  fr: { label: "Frankreich",  flag: "FR" },
  it: { label: "Italien",     flag: "IT" }
};

const TYPE_COLOR = { offroad: "#c4501e", touring: "#2d5016" };

const MAP_BOUNDS = { west: 2.0, east: 14.5, north: 53.8, south: 42.3 };

const COUNTRY_OUTLINES = {
  de: [[6.0,53.6],[7.2,53.7],[8.7,53.9],[9.8,54.8],[10.8,54.4],[12.2,54.5],[13.8,54.1],[14.4,53.0],[14.7,52.5],[14.6,51.5],[15.0,51.0],[14.8,50.4],[13.4,50.5],[12.5,50.2],[12.4,49.8],[13.5,48.8],[13.0,48.5],[12.8,47.7],[11.0,47.5],[10.5,47.5],[9.5,47.6],[8.5,47.7],[7.6,47.6],[7.5,48.0],[8.2,48.9],[6.8,49.2],[6.4,49.5],[6.1,50.1],[6.0,50.8],[6.1,51.5],[6.7,51.9],[7.0,52.4],[6.9,53.0],[6.0,53.6]],
  fr: [[2.5,51.0],[3.6,50.5],[4.8,49.8],[5.7,49.5],[6.2,49.2],[7.5,48.5],[7.6,47.8],[7.0,47.4],[6.5,46.4],[7.0,45.9],[6.8,45.0],[7.4,44.1],[7.6,43.7],[6.5,43.1],[4.8,43.4],[3.5,43.3],[3.0,42.4],[1.7,42.5],[0.6,42.7],[-0.5,43.0],[-1.5,43.4],[-1.8,44.6],[-1.3,45.5],[-1.2,46.5],[-2.0,47.3],[-3.5,47.7],[-4.7,48.1],[-4.4,48.7],[-2.0,48.6],[-1.6,49.7],[0.2,49.8],[1.6,50.7],[2.5,51.0]],
  be: [[2.5,51.1],[3.4,51.4],[4.2,51.4],[5.0,51.5],[5.8,51.2],[6.2,50.8],[6.4,50.3],[6.0,49.8],[5.7,49.5],[4.8,49.8],[3.6,50.5],[2.5,51.1]],
  nl: [[3.4,51.4],[4.0,51.4],[4.3,51.5],[5.0,51.5],[5.8,51.2],[6.2,51.5],[6.7,51.9],[7.0,52.4],[6.9,53.0],[6.0,53.6],[4.5,53.4],[4.7,52.9],[4.5,52.4],[4.0,51.9],[3.4,51.4]],
  it: [[7.0,45.9],[7.6,46.4],[9.0,46.5],[10.5,46.9],[12.4,46.7],[13.7,45.7],[13.6,45.0],[12.4,45.5],[12.3,44.5],[13.5,43.5],[14.0,42.5],[15.4,41.9],[16.0,41.9],[17.2,40.5],[18.4,40.1],[18.4,39.8],[17.0,40.5],[16.5,39.0],[15.6,38.3],[15.1,37.5],[14.0,36.7],[12.4,37.6],[13.0,38.2],[14.6,38.4],[15.6,38.0],[16.1,39.0],[15.8,40.0],[15.0,40.0],[14.0,40.8],[12.5,41.2],[11.2,42.4],[10.5,42.9],[10.0,44.0],[8.6,44.4],[7.5,43.8],[6.6,44.5],[7.0,45.9]]
};

function transformRoute(r) {
  const coords = r.geometry && r.geometry.coordinates && r.geometry.coordinates.length > 1
    ? r.geometry.coordinates
    : r.bounds
      ? [[r.bounds.west, r.bounds.south], [(r.bounds.west+r.bounds.east)/2, (r.bounds.south+r.bounds.north)/2], [r.bounds.east, r.bounds.north]]
      : [[7.0, 50.0], [7.5, 50.5]];

  const duration_h = r.duration_h
    || Math.round((r.distance_km / (r.type === 'offroad' ? 28 : 45)) * 10) / 10;

  const surfaceLabel = { paved: 'Asphalt', gravel: 'Schotter', mixed: 'Asphalt / Schotter' }[r.surface] || r.surface || '–';

  return {
    id: r.id,
    name: r.name,
    country: r.country,
    region: r.region || (r.country || '').toUpperCase(),
    type: r.type || 'touring',
    rating: r.rating || 4.0,
    distance_km: r.distance_km || 0,
    elevation_gain_m: r.elevation_gain_m || 0,
    duration_h,
    difficulty: r.difficulty || 2,
    surface: surfaceLabel,
    offroad_pct: r.offroad_pct || 0,
    review: r.agent_review || '',
    highlights: [],
    season: 'Apr — Okt',
    path: coords,
    gpx_url: r.gpx_url || null,
    images: [
      `${r.region || ''} ${r.type === 'offroad' ? 'trail' : 'road'}`,
      `${r.name} panorama`,
      `${(r.country || '').toUpperCase()} ${r.type === 'offroad' ? 'offroad' : 'touring'}`
    ],
  };
}

const catalog = window.CATALOG || { routes: [], drafts: [] };
const ROUTES = (catalog.routes || [])
  .filter(r => r.geometry || r.bounds)
  .map(transformRoute);

window.ROUTES = ROUTES;
window.COUNTRIES = COUNTRIES;
window.TYPE_COLOR = TYPE_COLOR;
window.MAP_BOUNDS = MAP_BOUNDS;
window.COUNTRY_OUTLINES = COUNTRY_OUTLINES;
window.applyFilters = (routes, filters) => routes.filter(r => {
  if (filters.country !== 'all' && r.country !== filters.country) return false;
  if (filters.type !== 'all' && r.type !== filters.type) return false;
  if (filters.difficulty !== 'all' && r.difficulty !== Number(filters.difficulty)) return false;
  return true;
});

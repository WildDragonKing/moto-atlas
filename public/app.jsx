// MotoAtlas App — MapLibre GL + route overlay + sidebar

const { useState: useS, useEffect: useE, useRef: useR, useMemo: useM, useCallback: useC } = React;

const MAPTILER_KEY = window.MAPTILER_KEY || '';
// Default: OpenFreeMap Liberty (Vector, kein API-Key, ~3-5x weniger Bytes/Viewport
// als OSM-Raster, schneller Re-Render bei Zoom). MapTiler nur als Opt-In Premium.
// Siehe docs/research/2026-05-10-maplibre-tile-performance.md
const MAP_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${MAPTILER_KEY}`
  : 'https://tiles.openfreemap.org/styles/liberty';

function makeMarkerEl(color) {
  const el = document.createElement('div');
  el.className = 'route-marker';
  el.style.setProperty('--mc', color);
  ['rm-pulse', 'rm-ring', 'rm-dot'].forEach(cls => {
    const d = document.createElement('div');
    d.className = cls;
    el.appendChild(d);
  });
  return el;
}

function MotoAtlasApp() {
  const [routes, setRoutes] = useS([]);
  const [hoveredId, setHoveredId] = useS(null);
  const [selectedId, setSelectedId] = useS(null);
  const [filters, setFilters] = useS({ country: 'all', type: 'all', difficulty: 'all' });
  const [mapReady, setMapReady] = useS(false);
  const [mobileOpen, setMobileOpen] = useS(false);

  const mapRef = useR(null);
  const mapDivRef = useR(null);
  const markerRefs = useR({});

  // Load catalog.json
  useE(() => {
    fetch('/catalog.json')
      .then(r => r.ok ? r.json() : { routes: [], drafts: [] })
      .catch(() => ({ routes: [], drafts: [] }))
      .then(cat => {
        const transformed = (cat.routes || [])
          .filter(r => r.geometry || r.bounds)
          .map(window.transformRoute);
        setRoutes(transformed);
      });
  }, []);

  const visibleRoutes = useM(() => window.applyFilters(routes, filters), [routes, filters]);
  const selectedRoute = useM(() => routes.find(r => r.id === selectedId), [routes, selectedId]);

  useE(() => {
    if (selectedId && !visibleRoutes.find(r => r.id === selectedId)) setSelectedId(null);
  }, [visibleRoutes, selectedId]);

  // Init map
  useE(() => {
    if (!mapDivRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapDivRef.current,
      style: MAP_STYLE,
      center: [7.5, 48.5],
      zoom: 4.6,
      minZoom: 4,                  // Europa-Bounds: <4 nutzlos
      maxZoom: 14,
      fadeDuration: 0,             // 300ms Cross-Fade → 0
      refreshExpiredTiles: false,  // bei statischen Tiles unnoetig
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
      transformRequest: (url, resourceType) => {
        // Vector-Tiles + Sprites immutable per URL → Browser-Cache aggressiv nutzen
        if (resourceType === 'Tile' || resourceType === 'SpriteImage' || resourceType === 'SpriteJSON') {
          return { url, cache: 'force-cache' };
        }
        return { url };
      },
    });
    mapRef.current = map;

    map.on('load', () => {
      const emptyFC = { type: 'FeatureCollection', features: [] };
      // maxzoom: keine neuen Geometrie-Tiles ab z12 (Re-Use fuer Zoom 12-14)
      // tolerance/buffer: simplify-Optimierung fuer Polyline-Source
      map.addSource('routes', { type: 'geojson', data: emptyFC, maxzoom: 12, tolerance: 0.5, buffer: 64 });

      map.addLayer({ id: 'routes-casing', type: 'line', source: 'routes',
        paint: { 'line-color': '#faf6ec', 'line-width': 6, 'line-opacity': 0.9 },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });
      map.addLayer({ id: 'routes-base', type: 'line', source: 'routes',
        paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.85 },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });
      map.addLayer({ id: 'routes-selected', type: 'line', source: 'routes',
        filter: ['==', ['get', 'id'], '__none__'],
        paint: { 'line-color': ['get', 'color'], 'line-width': 6, 'line-opacity': 1, 'line-blur': 0.5 },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });
      map.addLayer({ id: 'routes-hovered', type: 'line', source: 'routes',
        filter: ['==', ['get', 'id'], '__none__'],
        paint: { 'line-color': ['get', 'color'], 'line-width': 5, 'line-opacity': 0.95 },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });

      map.on('mouseenter', 'routes-base', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'routes-base', () => { map.getCanvas().style.cursor = ''; });
      map.on('click', 'routes-base', (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) setSelectedId(id);
      });

      setMapReady(true);
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Load routes into map when both map and routes are ready
  const routesRef = useR([]);
  useE(() => {
    routesRef.current = routes;
    if (!mapReady || !mapRef.current || !routes.length) return;
    const map = mapRef.current;
    const buildFC = (rs) => ({
      type: 'FeatureCollection',
      features: rs.map(r => ({
        type: 'Feature',
        properties: { id: r.id, type: r.type, color: window.TYPE_COLOR[r.type] || '#9b8b6e' },
        geometry: { type: 'LineString', coordinates: r.snappedPath || r.path }
      }))
    });
    if (map.getSource('routes')) map.getSource('routes').setData(buildFC(routes));

    // OSRM road snapping (best-effort, fail-soft)
    const snapRoute = async (r) => {
      try {
        const coords = r.path.slice(0, 100).map(p => p.join(',')).join(';');
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
        if (!res.ok) return;
        const json = await res.json();
        const geom = json?.routes?.[0]?.geometry?.coordinates;
        if (geom && geom.length > 5) r.snappedPath = geom;
      } catch (e) { /* fail soft */ }
    };
    const queue = [...routes];
    const workers = Array.from({length: 4}).map(async () => {
      while (queue.length) {
        const r = queue.shift();
        await snapRoute(r);
        if (mapRef.current && mapRef.current.getSource('routes')) {
          mapRef.current.getSource('routes').setData(buildFC(routesRef.current));
        }
      }
    });
    Promise.all(workers);
  }, [mapReady, routes]);

  // Markers
  useE(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    Object.values(markerRefs.current).forEach(m => m.remove());
    markerRefs.current = {};

    visibleRoutes.forEach(r => {
      const el = makeMarkerEl(window.TYPE_COLOR[r.type] || '#9b8b6e');
      el.dataset.routeId = r.id;
      el.addEventListener('mouseenter', () => setHoveredId(r.id));
      el.addEventListener('mouseleave', () => setHoveredId(null));
      el.addEventListener('click', (e) => { e.stopPropagation(); setSelectedId(r.id); });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(r.path[0]).addTo(map);
      markerRefs.current[r.id] = marker;
    });

    return () => {
      Object.values(markerRefs.current).forEach(m => m.remove());
      markerRefs.current = {};
    };
  }, [mapReady, visibleRoutes]);

  // Marker active states
  useE(() => {
    Object.entries(markerRefs.current).forEach(([id, m]) => {
      const el = m.getElement();
      el.classList.toggle('hover', id === hoveredId);
      el.classList.toggle('selected', id === selectedId);
      el.classList.toggle('dim', !!(hoveredId || selectedId) && id !== hoveredId && id !== selectedId);
    });
  }, [hoveredId, selectedId]);

  // Filter + highlight line layers
  useE(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    if (map.getLayer('routes-hovered'))
      map.setFilter('routes-hovered', ['==', ['get', 'id'], hoveredId || '__none__']);
    if (map.getLayer('routes-selected'))
      map.setFilter('routes-selected', ['==', ['get', 'id'], selectedId || '__none__']);
    if (map.getLayer('routes-base')) {
      const active = hoveredId || selectedId;
      map.setPaintProperty('routes-base', 'line-opacity',
        active ? ['case', ['==', ['get', 'id'], active], 1, 0.25] : 0.85);
    }
  }, [mapReady, hoveredId, selectedId]);

  // Visible routes filter on map
  useE(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const visIds = new Set(visibleRoutes.map(r => r.id));
    const filt = ['in', ['get', 'id'], ['literal', [...visIds]]];
    ['routes-base', 'routes-casing'].forEach(id => { if (map.getLayer(id)) map.setFilter(id, filt); });
  }, [mapReady, visibleRoutes]);

  // Auto fly-to selected
  useE(() => {
    if (!mapReady || !mapRef.current || !selectedRoute) return;
    const map = mapRef.current;
    const path = selectedRoute.snappedPath || selectedRoute.path;
    let west = Infinity, east = -Infinity, north = -Infinity, south = Infinity;
    path.forEach(([lng, lat]) => {
      if (lng < west) west = lng; if (lng > east) east = lng;
      if (lat > north) north = lat; if (lat < south) south = lat;
    });
    map.fitBounds([[west, south], [east, north]], {
      padding: { top: 100, bottom: 100, left: 80, right: 380 },
      duration: 1200, essential: true, maxZoom: 11
    });
  }, [mapReady, selectedRoute]);

  // Esc
  useE(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSelectedId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const resetView = useC(() => {
    setSelectedId(null);
    if (mapRef.current) mapRef.current.flyTo({ center: [7.5, 48.5], zoom: 4.6, duration: 1200, essential: true });
  }, []);

  const zoomBy = useC((factor) => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    map.easeTo({ zoom: map.getZoom() + (factor > 1 ? 0.7 : -0.7), duration: 350 });
  }, []);

  return (
    <div className="atlas-root">
      <div ref={mapDivRef} className="atlas-map"/>
      <div className="map-tint"/>

      <header className="atlas-nav">
        <div className="nav-logo-chip">
          <div className="nav-logo">Moto<em>Atlas</em></div>
        </div>
        <div className="nav-mid"/>
        <div className="nav-links">
          <a href="#" className="nav-link active">Routen</a>
          <a href="#" className="nav-link">↓ Scenic</a>
        </div>
      </header>

      <div className="map-controls">
        <button className="map-ctrl" onClick={() => zoomBy(1.4)} title="Zoom in">+</button>
        <button className="map-ctrl" onClick={() => zoomBy(0.7)} title="Zoom out">−</button>
        <button className="map-ctrl reset" onClick={resetView} title="Übersicht">⊙</button>
      </div>

      {!selectedRoute && (
        <div className="hero-overlay">
          <div className="hero-eyebrow"><span className="line"/> Motorrad · Offroad · Touring</div>
          <h1>Die <em>besten</em><br/>Routen.<br/>Kuratiert.</h1>
          <p>Offroad-Tracks und Touren für DE, BE, NL, FR und IT — agent-reviewed, direkt in Scenic importierbar.</p>
        </div>
      )}

      <window.Sidebar
        routes={routes}
        hoveredId={hoveredId}
        selectedId={selectedId}
        onHover={setHoveredId}
        onSelect={setSelectedId}
        filters={filters}
        setFilters={setFilters}
        allRoutesCount={routes.length}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
    </div>
  );
}

window.MotoAtlasApp = MotoAtlasApp;

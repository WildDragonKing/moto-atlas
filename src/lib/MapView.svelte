<script>
  import { onMount, onDestroy } from 'svelte'
  import maplibregl from 'maplibre-gl'
  import 'maplibre-gl/dist/maplibre-gl.css'
  import { TYPE_COLOR, ui } from './data.svelte.js'

  let { routes = [] } = $props()

  // Default-Provider: OpenFreeMap Liberty (Vector, kein API-Key).
  // MapTiler nur als Premium-Opt-In via VITE_MAPTILER_KEY.
  const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY ?? ''
  const MAP_STYLE = MAPTILER_KEY
    ? `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${MAPTILER_KEY}`
    : 'https://tiles.openfreemap.org/styles/liberty'

  let container = $state() // wird via bind:this gesetzt — oxlint sieht es nicht
  let map
  const markers = {}

  function makeMarkerEl(color) {
    const el = document.createElement('div')
    el.className = 'route-marker'
    el.style.setProperty('--mc', color)
    for (const cls of ['rm-pulse', 'rm-ring', 'rm-dot']) {
      const d = document.createElement('div')
      d.className = cls
      el.appendChild(d)
    }
    return el
  }

  function buildFC(rs) {
    return {
      type: 'FeatureCollection',
      features: rs.map((r) => ({
        type: 'Feature',
        properties: { id: r.id, type: r.type, color: TYPE_COLOR[r.type] || '#9b8b6e' },
        geometry: { type: 'LineString', coordinates: r.snappedPath || r.path },
      })),
    }
  }

  // OSRM-Road-Snapping (best-effort)
  async function snapRoute(r) {
    try {
      const coords = r.path
        .slice(0, 100)
        .map((p) => p.join(','))
        .join(';')
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
      )
      if (!res.ok) return
      const json = await res.json()
      const geom = json?.routes?.[0]?.geometry?.coordinates
      if (geom && geom.length > 5) r.snappedPath = geom
    } catch {
      /* fail soft */
    }
  }

  onMount(() => {
    map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: [7.5, 48.5],
      zoom: 4.6,
      minZoom: 4,
      maxZoom: 14,
      fadeDuration: 0,
      refreshExpiredTiles: false,
      prefetchZoomDelta: 5,
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
      transformRequest: (url, resourceType) => {
        if (
          resourceType === 'Tile' ||
          resourceType === 'SpriteImage' ||
          resourceType === 'SpriteJSON'
        ) {
          return { url, cache: 'force-cache' }
        }
        return { url }
      },
    })

    map.on('load', () => {
      map.addSource('routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        maxzoom: 12,
        tolerance: 0.5,
        buffer: 64,
        promoteId: 'id',
      })

      // **EIN Layer** statt vier — alle Visual-States via feature-state.
      // line-width steigt bei hover/selected, line-blur nur bei selected.
      // Dim-Modus (andere ausgrauen) per setPaintProperty auf line-opacity.
      map.addLayer({
        id: 'routes',
        type: 'line',
        source: 'routes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            6,
            ['boolean', ['feature-state', 'hover'], false],
            5,
            3,
          ],
          'line-opacity': 0.85,
          'line-blur': ['case', ['boolean', ['feature-state', 'selected'], false], 0.5, 0],
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })

      map.on('mouseenter', 'routes', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'routes', () => {
        map.getCanvas().style.cursor = ''
      })
      map.on('click', 'routes', (e) => {
        const id = e.features?.[0]?.properties?.id
        if (id) ui.selectedId = id
      })
    })
  })

  onDestroy(() => {
    map?.remove()
    map = null
  })

  // GeoJSON setzen wenn Routen reinkommen oder snapping fertig.
  $effect(() => {
    if (!map || !routes.length) return
    const apply = () => {
      const src = map.getSource('routes')
      if (src) src.setData(buildFC(routes))
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)

    // OSRM-Snapping parallel, danach jeweils refreshen.
    const queue = [...routes]
    const workers = Array.from({ length: 4 }).map(async () => {
      while (queue.length) {
        const r = queue.shift()
        await snapRoute(r)
        if (map?.getSource('routes')) map.getSource('routes').setData(buildFC(routes))
      }
    })
    Promise.all(workers).catch(() => {})
  })

  // Marker-Sync (visibleRoutes wird vom parent gefiltert reingegeben).
  $effect(() => {
    if (!map || !map.isStyleLoaded()) return
    const seen = new Set()
    for (const r of routes) {
      seen.add(r.id)
      if (markers[r.id]) continue
      const el = makeMarkerEl(TYPE_COLOR[r.type] || '#9b8b6e')
      el.dataset.routeId = r.id
      el.addEventListener('mouseenter', () => (ui.hoveredId = r.id))
      el.addEventListener('mouseleave', () => (ui.hoveredId = null))
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        ui.selectedId = r.id
      })
      markers[r.id] = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(r.path[0])
        .addTo(map)
    }
    // entfernte Routen
    for (const id of Object.keys(markers)) {
      if (!seen.has(id)) {
        markers[id].remove()
        delete markers[id]
      }
    }
  })

  // Marker-Aktivzustand (CSS-Klassen).
  $effect(() => {
    for (const [id, m] of Object.entries(markers)) {
      const el = m.getElement()
      el.classList.toggle('hover', id === ui.hoveredId)
      el.classList.toggle('selected', id === ui.selectedId)
      el.classList.toggle(
        'dim',
        !!(ui.hoveredId || ui.selectedId) && id !== ui.hoveredId && id !== ui.selectedId,
      )
    }
  })

  // feature-state Hover/Selected + Dim-Modus.
  let lastHover = null
  let lastSel = null
  $effect(() => {
    if (!map || !map.isStyleLoaded()) return
    const src = 'routes'
    if (lastHover && lastHover !== ui.hoveredId)
      map.setFeatureState({ source: src, id: lastHover }, { hover: false })
    if (lastSel && lastSel !== ui.selectedId)
      map.setFeatureState({ source: src, id: lastSel }, { selected: false })
    if (ui.hoveredId) map.setFeatureState({ source: src, id: ui.hoveredId }, { hover: true })
    if (ui.selectedId) map.setFeatureState({ source: src, id: ui.selectedId }, { selected: true })
    lastHover = ui.hoveredId
    lastSel = ui.selectedId

    const active = ui.hoveredId || ui.selectedId
    if (map.getLayer('routes')) {
      map.setPaintProperty(
        'routes',
        'line-opacity',
        active
          ? [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              1,
              ['boolean', ['feature-state', 'hover'], false],
              0.95,
              0.25,
            ]
          : 0.85,
      )
    }
  })

  // fitBounds bei selected.
  $effect(() => {
    if (!map || !ui.selectedId) return
    const r = routes.find((x) => x.id === ui.selectedId)
    if (!r) return
    const path = r.snappedPath || r.path
    let west = Infinity,
      east = -Infinity,
      north = -Infinity,
      south = Infinity
    for (const [lng, lat] of path) {
      if (lng < west) west = lng
      if (lng > east) east = lng
      if (lat > north) north = lat
      if (lat < south) south = lat
    }
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      {
        padding: { top: 100, bottom: 100, left: 80, right: 380 },
        duration: 1200,
        essential: true,
        maxZoom: 11,
      },
    )
  })

  // Escape-Key: Selection clear.
  function onKey(e) {
    if (e.key === 'Escape') ui.selectedId = null
  }

  export function resetView() {
    ui.selectedId = null
    if (map)
      map.flyTo({ center: [7.5, 48.5], zoom: 4.6, duration: 1200, essential: true })
  }
  export function zoomBy(factor) {
    if (!map) return
    map.easeTo({ zoom: map.getZoom() + (factor > 1 ? 0.7 : -0.7), duration: 350 })
  }
</script>

<svelte:window on:keydown={onKey} />

<div bind:this={container} class="atlas-map"></div>
<div class="map-tint"></div>

<style>
  .atlas-map {
    position: absolute;
    inset: 0;
  }
  .map-tint {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(
      to bottom,
      rgba(250, 246, 236, 0.05) 0%,
      rgba(250, 246, 236, 0) 35%
    );
  }
</style>

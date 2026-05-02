import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getBaseStyle } from './tiles.js'

const TYPE_COLOR = {
  offroad: '#c4501e',
  touring: '#2d5016',
  scenic: '#d4882a',
}

let map = null
let activeRouteId = null

export function initMap(catalog) {
  const { routes = [], drafts = [] } = catalog
  const allRoutes = [...routes, ...drafts].filter(r => r.geometry)

  if (!allRoutes.length) {
    const el = document.getElementById('map')
    if (el) {
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.justifyContent = 'center'
      el.style.color = '#9b8b6e'
      el.style.fontFamily = "'JetBrains Mono', monospace"
      el.style.fontSize = '12px'
      el.textContent = 'Keine Routen mit Geometrie im Katalog.'
    }
    return
  }

  // Bounding box über alle Routen
  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90
  allRoutes.forEach(r => {
    r.geometry.coordinates.forEach(([lon, lat]) => {
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    })
  })

  map = new maplibregl.Map({
    container: 'map',
    style: getBaseStyle(),
    bounds: [[minLon, minLat], [maxLon, maxLat]],
    fitBoundsOptions: { padding: 48 },
  })

  map.addControl(new maplibregl.NavigationControl(), 'top-right')

  map.on('load', () => {
    allRoutes.forEach(route => {
      const color = TYPE_COLOR[route.type] || '#9b8b6e'
      const isDraft = route.status === 'draft'

      map.addSource(`route-${route.id}`, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: { id: route.id },
          geometry: route.geometry,
        },
      })

      // Halo
      map.addLayer({
        id: `route-${route.id}-halo`,
        type: 'line',
        source: `route-${route.id}`,
        paint: {
          'line-color': '#ffffff',
          'line-width': 5,
          'line-opacity': 0.4,
        },
      })

      // Linie
      map.addLayer({
        id: `route-${route.id}-line`,
        type: 'line',
        source: `route-${route.id}`,
        paint: {
          'line-color': color,
          'line-width': isDraft ? 2 : 3,
          'line-opacity': isDraft ? 0.5 : 0.85,
          'line-dasharray': isDraft ? [4, 3] : [1],
        },
      })

      // Klick-Handler
      map.on('click', `route-${route.id}-line`, (e) => {
        e.preventDefault()
        showRoutePopup(route, e.lngLat)
      })
      map.on('mouseenter', `route-${route.id}-line`, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', `route-${route.id}-line`, () => {
        map.getCanvas().style.cursor = ''
      })
    })
  })
}

function showRoutePopup(route, lngLat) {
  // Bestehende Popups entfernen
  document.querySelectorAll('.maplibregl-popup').forEach(el => el.remove())

  const stars = route.rating ? '★'.repeat(Math.round(route.rating)) + '☆'.repeat(5 - Math.round(route.rating)) : ''
  const typeLabel = { offroad: 'Offroad', touring: 'Touring', scenic: 'Scenic' }[route.type] || route.type || '–'
  const color = TYPE_COLOR[route.type] || '#9b8b6e'

  // Popup-Inhalt via DOM (kein innerHTML mit Userdaten → XSS-sicher)
  const container = document.createElement('div')
  container.className = 'route-popup'

  const header = document.createElement('div')
  header.className = 'popup-header'
  header.style.borderLeft = `4px solid ${color}`

  const name = document.createElement('div')
  name.className = 'popup-name'
  name.textContent = route.name || '–'
  header.appendChild(name)

  const meta = document.createElement('div')
  meta.className = 'popup-meta'

  const countrySpan = document.createElement('span')
  countrySpan.textContent = (route.country || '').toUpperCase()
  meta.appendChild(countrySpan)

  if (route.region) {
    meta.append(' · ')
    const regionSpan = document.createElement('span')
    regionSpan.textContent = route.region
    meta.appendChild(regionSpan)
  }

  meta.append(' · ')
  const typeSpan = document.createElement('span')
  typeSpan.style.color = color
  typeSpan.textContent = typeLabel
  meta.appendChild(typeSpan)
  header.appendChild(meta)
  container.appendChild(header)

  const body = document.createElement('div')
  body.className = 'popup-body'

  const stats = document.createElement('div')
  stats.className = 'popup-stats'

  if (route.distance_km) {
    const s = document.createElement('div')
    s.className = 'popup-stat'
    const v = document.createElement('span')
    v.className = 'popup-stat-val'
    v.textContent = route.distance_km
    const k = document.createElement('span')
    k.className = 'popup-stat-key'
    k.textContent = 'km'
    s.appendChild(v); s.appendChild(k); stats.appendChild(s)
  }

  if (route.elevation_gain_m) {
    const s = document.createElement('div')
    s.className = 'popup-stat'
    const v = document.createElement('span')
    v.className = 'popup-stat-val'
    v.textContent = route.elevation_gain_m
    const k = document.createElement('span')
    k.className = 'popup-stat-key'
    k.textContent = 'Hm'
    s.appendChild(v); s.appendChild(k); stats.appendChild(s)
  }

  if (route.difficulty) {
    const s = document.createElement('div')
    s.className = 'popup-stat'
    const v = document.createElement('span')
    v.className = 'popup-stat-val'
    v.textContent = '●'.repeat(route.difficulty) + '○'.repeat(5 - route.difficulty)
    v.style.letterSpacing = '-1px'
    const k = document.createElement('span')
    k.className = 'popup-stat-key'
    k.textContent = 'Schwierigkeit'
    s.appendChild(v); s.appendChild(k); stats.appendChild(s)
  }

  if (stars) {
    const s = document.createElement('div')
    s.className = 'popup-stat'
    const v = document.createElement('span')
    v.className = 'popup-stat-val popup-stars'
    v.textContent = stars
    const k = document.createElement('span')
    k.className = 'popup-stat-key'
    k.textContent = String(route.rating)
    s.appendChild(v); s.appendChild(k); stats.appendChild(s)
  }

  body.appendChild(stats)

  if (route.agent_review) {
    const review = document.createElement('div')
    review.className = 'popup-review'
    review.textContent = route.agent_review
    body.appendChild(review)
  }

  if (!route.status || route.status === 'live') {
    const actions = document.createElement('div')
    actions.className = 'popup-actions'
    if (route.gpx_url) {
      const btn = document.createElement('button')
      btn.className = 'popup-btn primary'
      btn.textContent = '↓ GPX'
      btn.addEventListener('click', () => window.open('/' + route.gpx_url))
      actions.appendChild(btn)
    }
    body.appendChild(actions)
  }

  container.appendChild(body)

  new maplibregl.Popup({ maxWidth: '320px', closeButton: true })
    .setLngLat(lngLat)
    .setDOMContent(container)
    .addTo(map)
}

export function destroyMap() {
  if (map) { map.remove(); map = null }
}

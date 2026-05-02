import { loadCatalog, initCatalog } from './catalog.js'
import { initMap, destroyMap } from './map-view.js'

let catalog = null
let currentView = null
let catalogInited = false

async function getCatalog() {
  if (!catalog) {
    const res = await fetch('/catalog.json')
    if (!res.ok) throw new Error(`catalog.json nicht gefunden (${res.status})`)
    catalog = await res.json()
  }
  return catalog
}

function showView(view) {
  const catalogSections = document.querySelectorAll('.hero, .catalog-section, .drafts-section, .collections-section')
  const mapView = document.getElementById('map-view')

  if (view === 'map') {
    catalogSections.forEach(el => { el.style.display = 'none' })
    mapView.style.display = ''
    if (currentView !== 'map') {
      getCatalog().then(c => {
        const count = document.getElementById('map-route-count')
        const total = (c.routes?.length || 0) + (c.drafts?.length || 0)
        if (count) count.textContent = `${total} Routen`
        initMap(c)
      })
    }
  } else {
    destroyMap()
    catalogSections.forEach(el => { el.style.display = '' })
    mapView.style.display = 'none'
    if (!catalogInited) {
      catalogInited = true
      getCatalog().then(c => initCatalog(c)).catch(err => {
        const grid = document.getElementById('route-grid')
        if (grid) {
          grid.textContent = ''
          const msg = document.createElement('div')
          msg.className = 'loading'
          msg.textContent = `Fehler: ${err.message}`
          grid.appendChild(msg)
        }
      })
    }
  }
  currentView = view
}

function route() {
  const hash = window.location.hash
  if (hash === '#/map') {
    showView('map')
  } else {
    showView('catalog')
  }
}

window.addEventListener('hashchange', route)
route()

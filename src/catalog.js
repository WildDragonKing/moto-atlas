import { filterRoutes, renderCountryTabs, onFilterChange } from './filter.js'

const TYPE_COLOR = { offroad: '#c4501e', touring: '#2d5016', scenic: '#d4882a' }

function animCount(el, target) {
  let start = null
  const step = ts => {
    if (!start) start = ts
    const p = Math.min((ts - start) / 1600, 1)
    el.textContent = Math.floor(p * target)
    if (p < 1) requestAnimationFrame(step)
  }
  setTimeout(() => requestAnimationFrame(step), 300)
}

function starsText(rating) {
  const n = Math.round(rating)
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

function el(tag, cls) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  return e
}

function renderCard(route) {
  const isDraft = route.status === 'draft'
  const color = TYPE_COLOR[route.type] || '#9b8b6e'

  const card = el('div', 'route-card' + (isDraft ? ' draft' : ''))
  card.style.setProperty('--card-color', color)

  const bar = el('div', 'card-top-bar')
  card.appendChild(bar)

  const body = el('div', 'card-body')

  const country = el('div', 'card-country')
  country.textContent = `${(route.country || '').toUpperCase()} · ${route.region || '–'}`
  body.appendChild(country)

  const title = el('div', 'card-title')
  title.textContent = route.name || '–'
  body.appendChild(title)

  if (isDraft) {
    const badge = el('div', 'draft-badge')
    badge.textContent = 'Draft · wird bewertet…'
    body.appendChild(badge)
  }

  if (route.agent_review) {
    const desc = el('div', 'card-desc')
    desc.textContent = route.agent_review
    body.appendChild(desc)
  }

  const meta = el('div', 'card-meta')
  if (route.distance_km) {
    const mi = el('div', 'card-meta-item')
    const val = el('span', 'card-meta-val'); val.textContent = route.distance_km
    const key = el('span', 'card-meta-key'); key.textContent = 'km'
    mi.appendChild(val); mi.appendChild(key); meta.appendChild(mi)
  }
  if (route.elevation_gain_m) {
    const mi = el('div', 'card-meta-item')
    const val = el('span', 'card-meta-val'); val.textContent = route.elevation_gain_m
    const key = el('span', 'card-meta-key'); key.textContent = 'Hm'
    mi.appendChild(val); mi.appendChild(key); meta.appendChild(mi)
  }
  if (route.rating) {
    const rating = el('div', 'card-rating')
    const stars = el('span', 'stars'); stars.textContent = starsText(route.rating)
    const rval = el('span', 'rating-val'); rval.textContent = route.rating
    rating.appendChild(stars); rating.appendChild(rval); meta.appendChild(rating)
  }
  body.appendChild(meta)
  card.appendChild(body)

  if (!isDraft && route.gpx_url) {
    const footer = el('div', 'card-footer')
    const btn = el('button', 'card-btn primary')
    btn.textContent = '↓ GPX'
    btn.addEventListener('click', () => { window.open('/' + route.gpx_url) })
    footer.appendChild(btn)
    card.appendChild(footer)
  }

  return card
}

function renderCollections(collections, container) {
  container.textContent = ''
  collections.filter(c => c.id !== 'all-routes').forEach(col => {
    const card = el('div', 'collection-card')
    const name = el('div', 'col-name'); name.textContent = col.name
    const count = el('div', 'col-count'); count.textContent = `${col.count} Routen`
    const btn = el('button', 'card-btn primary'); btn.textContent = '↓ ZIP'
    btn.addEventListener('click', () => { window.open('/' + col.zip_url) })
    card.appendChild(name); card.appendChild(count); card.appendChild(btn)
    container.appendChild(card)
  })
}

export async function loadCatalog() {
  const res = await fetch('/catalog.json')
  if (!res.ok) throw new Error(`catalog.json nicht gefunden (${res.status})`)
  return res.json()
}

export function initCatalog(catalog) {
  const { routes = [], drafts = [], collections = [] } = catalog

  const statRoutes = document.getElementById('stat-routes')
  const statKm = document.getElementById('stat-km')
  if (statRoutes) animCount(statRoutes, routes.length)
  if (statKm) animCount(statKm, routes.reduce((s, r) => s + (r.distance_km || 0), 0))

  const collectionsGrid = document.getElementById('collections-grid')
  if (collectionsGrid) renderCollections(collections, collectionsGrid)

  const draftsSection = document.getElementById('drafts-section')
  const draftGrid = document.getElementById('draft-grid')
  const draftCount = document.getElementById('draft-count')
  if (drafts.length > 0 && draftsSection) {
    draftsSection.style.display = ''
    if (draftCount) draftCount.textContent = `${drafts.length} Routen warten auf Review`
    if (draftGrid) drafts.forEach(d => draftGrid.appendChild(renderCard(d)))
  }

  const grid = document.getElementById('route-grid')
  const tabs = document.getElementById('country-tabs')

  const render = () => {
    if (!grid) return
    grid.textContent = ''
    const filtered = filterRoutes(routes)
    if (!filtered.length) {
      const msg = el('div', 'loading'); msg.textContent = 'Keine Routen für diesen Filter.'
      grid.appendChild(msg)
      return
    }
    filtered.forEach(r => grid.appendChild(renderCard(r)))
  }

  if (tabs) {
    renderCountryTabs(tabs, routes)
    onFilterChange(() => { render(); renderCountryTabs(tabs, routes) })
  }
  render()
}

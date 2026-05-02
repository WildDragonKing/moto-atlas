const COUNTRIES = [
  { id: 'all', label: 'Alle', flag: '🌍' },
  { id: 'de', label: 'Deutschland', flag: '🇩🇪' },
  { id: 'be', label: 'Belgien', flag: '🇧🇪' },
  { id: 'nl', label: 'Niederlande', flag: '🇳🇱' },
  { id: 'fr', label: 'Frankreich', flag: '🇫🇷' },
  { id: 'it', label: 'Italien', flag: '🇮🇹' },
]

let state = { country: 'all' }
const listeners = new Set()

export function getFilter() { return { ...state } }

export function setFilter(patch) {
  state = { ...state, ...patch }
  listeners.forEach(fn => fn(state))
}

export function onFilterChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function filterRoutes(routes) {
  return routes.filter(r => state.country === 'all' || r.country === state.country)
}

export function renderCountryTabs(container, routes) {
  container.textContent = ''
  COUNTRIES.forEach(c => {
    const count = c.id === 'all' ? routes.length : routes.filter(r => r.country === c.id).length
    if (count === 0 && c.id !== 'all') return
    const btn = document.createElement('button')
    btn.className = 'country-tab' + (state.country === c.id ? ' active' : '')

    const flagSpan = document.createElement('span')
    flagSpan.className = 'flag'
    flagSpan.textContent = c.flag

    const countSpan = document.createElement('span')
    countSpan.className = 'count'
    countSpan.textContent = `·${count}`

    btn.appendChild(flagSpan)
    btn.append(` ${c.label} `)
    btn.appendChild(countSpan)

    btn.addEventListener('click', () => {
      setFilter({ country: c.id })
      renderCountryTabs(container, routes)
    })
    container.appendChild(btn)
  })
}

import { loadCatalog, initCatalog } from './catalog.js'

async function init() {
  try {
    const catalog = await loadCatalog()
    initCatalog(catalog)
  } catch (err) {
    const grid = document.getElementById('route-grid')
    if (grid) {
      grid.textContent = ''
      const msg = document.createElement('div')
      msg.className = 'loading'
      msg.textContent = `Fehler: ${err.message}`
      grid.appendChild(msg)
    }
    console.error(err)
  }
}

init()

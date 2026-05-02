export const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY || ''
export const hasMaptiler = !!MAPTILER_KEY

export function getBaseStyle() {
  if (hasMaptiler) {
    return `https://api.maptiler.com/maps/voyager/style.json?key=${MAPTILER_KEY}`
  }
  return {
    version: 8,
    sources: {
      carto: {
        type: 'raster',
        tiles: ['https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors © CARTO'
      }
    },
    layers: [{ id: 'carto', type: 'raster', source: 'carto' }]
  }
}

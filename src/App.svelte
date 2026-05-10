<script>
  import { onMount } from 'svelte'
  import { transformRoute, ui } from './lib/data.svelte.js'
  import MapView from './lib/MapView.svelte'
  import Sidebar from './lib/Sidebar.svelte'

  let routes = $state([])
  let mapView = $state()

  onMount(async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}catalog.json`)
      const cat = res.ok ? await res.json() : { routes: [] }
      routes = (cat.routes || []).filter((r) => r.geometry || r.bounds).map(transformRoute)
    } catch {
      routes = []
    }
  })

  const selectedRoute = $derived(routes.find((r) => r.id === ui.selectedId))
</script>

<div class="atlas-root">
  <MapView bind:this={mapView} {routes} />

  <header class="atlas-nav">
    <div class="nav-logo-chip">
      <div class="nav-logo">Moto<em>Atlas</em></div>
    </div>
    <div class="nav-mid"></div>
    <div class="nav-links">
      <a href="#" class="nav-link active">Routen</a>
      <a href="#" class="nav-link">↓ Scenic</a>
    </div>
  </header>

  <div class="map-controls">
    <button class="map-ctrl" onclick={() => mapView?.zoomBy(1.4)} title="Zoom in">+</button>
    <button class="map-ctrl" onclick={() => mapView?.zoomBy(0.7)} title="Zoom out">−</button>
    <button class="map-ctrl reset" onclick={() => mapView?.resetView()} title="Übersicht">⊙</button>
  </div>

  {#if !selectedRoute}
    <div class="hero-overlay">
      <div class="hero-eyebrow"><span class="line"></span> Motorrad · Offroad · Touring</div>
      <h1>Die <em>besten</em><br />Routen.<br />Kuratiert.</h1>
      <p>Offroad-Tracks und Touren für DE, BE, NL, FR und IT — agent-reviewed, direkt in Scenic importierbar.</p>
    </div>
  {/if}

  <Sidebar {routes} />
</div>

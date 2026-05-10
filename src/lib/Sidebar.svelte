<script>
  import { COUNTRIES, TYPE_COLOR, applyFilters, filters, ui } from './data.svelte.js'
  import RouteDetailPane from './RouteDetailPane.svelte'

  let { routes = [] } = $props()

  const filtered = $derived(applyFilters(routes, filters))
  const totalKm = $derived(filtered.reduce((s, r) => s + r.distance_km, 0))
  const avgRating = $derived(
    filtered.length ? filtered.reduce((s, r) => s + r.rating, 0) / filtered.length : 0,
  )
  const selectedRoute = $derived(routes.find((r) => r.id === ui.selectedId))

  // Mobile-Sheet automatisch aufmachen wenn etwas selected wird.
  $effect(() => {
    if (selectedRoute) ui.mobileOpen = true
  })

  // Wenn Filter die selected-Route ausblendet, deselect.
  $effect(() => {
    if (ui.selectedId && !filtered.find((r) => r.id === ui.selectedId)) {
      ui.selectedId = null
    }
  })
</script>

<aside
  class="sidebar"
  class:mobile-open={ui.mobileOpen}
  class:has-detail={!!selectedRoute}
>
  <div class="sheet-handle" onclick={() => (ui.mobileOpen = !ui.mobileOpen)}>
    <div class="sheet-grip"></div>
  </div>

  {#if selectedRoute}
    <RouteDetailPane route={selectedRoute} />
  {:else}
    <div class="sidebar-header">
      <div class="sidebar-title">
        <div class="title-tag">Index</div>
        <h2>Alle Routen</h2>
      </div>
      <div class="sidebar-stats">
        <div class="ss-cell">
          <span class="ss-num">{filtered.length}</span><span class="ss-key">Routen</span>
        </div>
        <div class="ss-cell">
          <span class="ss-num">{totalKm.toLocaleString('de')}</span
          ><span class="ss-key">km gesamt</span>
        </div>
        <div class="ss-cell">
          <span class="ss-num">{avgRating.toFixed(1)}</span
          ><span class="ss-key">Ø Bewertung</span>
        </div>
      </div>
    </div>

    <div class="filter-block">
      <div class="filter-label">Land</div>
      <div class="filter-row">
        <button
          class="f-chip"
          class:on={filters.country === 'all'}
          onclick={() => (filters.country = 'all')}
        >
          Alle · {routes.length}
        </button>
        {#each Object.entries(COUNTRIES) as [code, c]}
          {@const n = routes.filter((r) => r.country === code).length}
          {#if n}
            <button
              class="f-chip"
              class:on={filters.country === code}
              onclick={() => (filters.country = code)}
            >
              {c.flag} <span class="cc">·{n}</span>
            </button>
          {/if}
        {/each}
      </div>

      <div class="filter-label">Typ</div>
      <div class="filter-row">
        {#each ['all', 'touring', 'offroad'] as t}
          <button class="f-chip" class:on={filters.type === t} onclick={() => (filters.type = t)}>
            {t === 'all' ? 'Alle' : t === 'touring' ? 'Touring' : 'Offroad'}
          </button>
        {/each}
      </div>

      <div class="filter-label">Schwierigkeit</div>
      <div class="filter-row">
        <button
          class="f-chip"
          class:on={filters.difficulty === 'all'}
          onclick={() => (filters.difficulty = 'all')}
        >
          Alle
        </button>
        {#each [1, 2, 3, 4, 5] as d}
          <button
            class="f-chip"
            class:on={filters.difficulty === d}
            onclick={() => (filters.difficulty = d)}
          >
            {#each Array.from({ length: d }) as _}<span>●</span>{/each}
          </button>
        {/each}
      </div>
    </div>

    <div class="route-list">
      {#if !filtered.length}
        <div class="empty-msg">Keine Routen für diesen Filter.</div>
      {/if}
      {#each filtered as r, i}
        {@const color = TYPE_COLOR[r.type] || '#9b8b6e'}
        {@const c = COUNTRIES[r.country] || { flag: (r.country || '').toUpperCase() }}
        <div
          class="route-row"
          class:hover={ui.hoveredId === r.id}
          class:sel={ui.selectedId === r.id}
          onmouseenter={() => (ui.hoveredId = r.id)}
          onmouseleave={() => (ui.hoveredId = null)}
          onclick={() => (ui.selectedId = r.id)}
          style="animation-delay: {i * 30}ms"
        >
          <div class="row-num">{String(i + 1).padStart(2, '0')}</div>
          <div class="row-color-bar" style="background: {color}"></div>
          <div class="row-body">
            <div class="row-meta">
              <span style="color: {color}">{c.flag}</span>
              <span class="row-region">{r.region}</span>
              <span class="row-type">{r.type === 'offroad' ? 'Offroad' : 'Touring'}</span>
            </div>
            <div class="row-name">{r.name}</div>
            <div class="row-stats">
              <span><strong>{r.distance_km}</strong>km</span>
              <span><strong>{r.elevation_gain_m.toLocaleString('de')}</strong>hm</span>
              <span><strong>{r.duration_h}</strong>h</span>
              <span class="row-rating">★ {r.rating.toFixed(1)}</span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</aside>

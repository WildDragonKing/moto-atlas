<script>
  import { COUNTRIES, TYPE_COLOR, ui } from './data.svelte.js'

  let { route } = $props()
  const color = $derived(TYPE_COLOR[route.type] || '#9b8b6e')
  const country = $derived(COUNTRIES[route.country] || { flag: (route.country || '').toUpperCase() })

  // Pseudo-Elevation-Profile (kein echtes GPX-Parsing im Frontend)
  const points = $derived.by(() => {
    const n = 40
    const seed = route.id.length * 13
    const arr = []
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      arr.push(
        (Math.sin(t * Math.PI * 2 + seed * 0.1) * 0.3 +
          Math.sin(t * Math.PI * 5 + seed * 0.3) * 0.18 +
          Math.cos(t * Math.PI * 3 + seed * 0.7) * 0.22 +
          Math.sin(t * Math.PI * 7 + seed) * 0.1 +
          1) / 2,
      )
    }
    const min = Math.min(...arr)
    const max = Math.max(...arr)
    return arr.map((v) => (v - min) / (max - min || 1))
  })

  const pathD = $derived(
    points
      .map(
        (v, i) =>
          `${i === 0 ? 'M' : 'L'}${((i / (points.length - 1)) * 260).toFixed(1)} ${(48 - v * 44 - 2).toFixed(1)}`,
      )
      .join(' '),
  )

  const full = $derived(Math.floor(route.rating))
  const half = $derived(route.rating - full >= 0.4 && route.rating - full < 0.9)

  // Footer-Button-Logic — vgl. CLAUDE.md gpx_redistribution-Cases.
  const effGpx = $derived(
    route.gpx_url ? `${window.location.origin}/${route.gpx_url}` : route.source_gpx_url,
  )
  const scenicUrl = $derived(
    effGpx
      ? `https://scenicapp.space/Scenic/api/import/gpxurl?gpxurl=${encodeURIComponent(effGpx)}&source=MotoAtlas`
      : null,
  )
  const gpxHref = $derived(route.gpx_url ? `/${route.gpx_url}` : route.source_gpx_url)
  const gpxLabel = $derived(
    route.gpx_url ? '↓ GPX' : `↓ GPX (via ${route.source_name || 'Quelle'})`,
  )
</script>

<div class="route-detail">
  <div class="detail-top-bar" style="background: {color}"></div>
  <button class="detail-back" onclick={() => (ui.selectedId = null)}>
    <span class="back-arrow">←</span>
    <span>Zurück zur Liste</span>
  </button>
  <div class="detail-scroll">
    <div class="detail-body">
      <div class="popout-meta-row">
        <span class="popout-eyebrow">
          <span class="dot" style="background: {color}"></span>
          {country.flag} · {route.region}
        </span>
        <span class="popout-type" style="color: {color}">
          {route.type === 'offroad' ? 'Offroad' : 'Touring'}
        </span>
      </div>

      <h3 class="popout-title">{route.name}</h3>

      <div class="popout-rating">
        <span style="color: #d4882a; letter-spacing: 0.5px; font-size: 11px">
          {#each Array.from({ length: 5 }) as _, i}
            {#if i < full}<span>★</span>
            {:else if i === full && half}<span style="opacity: 0.55">★</span>
            {:else}<span style="opacity: 0.2">★</span>
            {/if}
          {/each}
        </span>
        <span class="rating-num">{route.rating.toFixed(1)}</span>
      </div>

      {#if route.review}<p class="popout-desc">{route.review}</p>{/if}

      <div class="popout-stats">
        <div class="stat-cell">
          <div class="stat-num">{route.distance_km}</div>
          <div class="stat-key">km</div>
        </div>
        <div class="stat-cell">
          <div class="stat-num">{route.elevation_gain_m.toLocaleString('de')}</div>
          <div class="stat-key">Hm</div>
        </div>
        <div class="stat-cell">
          <div class="stat-num">{route.duration_h}<span class="stat-unit">h</span></div>
          <div class="stat-key">Fahrt</div>
        </div>
        <div class="stat-cell">
          <div class="stat-num">{route.offroad_pct}<span class="stat-unit">%</span></div>
          <div class="stat-key">Offroad</div>
        </div>
      </div>

      <div class="popout-section">
        <div class="section-tag">Höhenprofil</div>
        <svg
          width="100%"
          height="48"
          viewBox="0 0 260 48"
          preserveAspectRatio="none"
          style="display: block"
        >
          <defs>
            <linearGradient id={`eg-${route.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color={color} stop-opacity="0.32" />
              <stop offset="100%" stop-color={color} stop-opacity="0" />
            </linearGradient>
          </defs>
          <path d={`${pathD} L260 48 L0 48 Z`} fill={`url(#eg-${route.id})`} />
          <path
            d={pathD}
            fill="none"
            stroke={color}
            stroke-width="1.2"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
        </svg>
      </div>

      <div class="popout-detail-rows">
        <div class="detail-row">
          <span class="detail-key">Schwierigkeit</span>
          <span class="detail-val">
            <span class="diff-pips">
              {#each Array.from({ length: 5 }) as _, i}
                <span
                  class="pip"
                  class:on={i < route.difficulty}
                  style={i < route.difficulty ? `background: ${color}` : ''}
                ></span>
              {/each}
            </span>
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-key">Belag</span>
          <span class="detail-val">{route.surface}</span>
        </div>
      </div>

      <div class="popout-footer">
        {#if gpxHref}
          <a
            class="popout-btn primary"
            href={gpxHref}
            download={route.gpx_url ? '' : null}
            target={route.gpx_url ? null : '_blank'}
            rel="noopener"
          >
            {gpxLabel}
          </a>
        {/if}
        {#if scenicUrl}
          <a class="popout-btn" href={scenicUrl} target="_blank" rel="noopener">→ Scenic</a>
        {/if}
        {#if route.source_url}
          <a class="popout-btn source" href={route.source_url} target="_blank" rel="noopener">
            ↗ {route.source_name || 'Quelle'}
          </a>
        {/if}
      </div>
    </div>
  </div>
</div>

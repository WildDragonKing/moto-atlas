// Sidebar — route list + integrated detail view

const { useState: useState_sb, useMemo: useMemo_sb, useEffect: useEffect_sb } = React;

function ElevationProfile_sb({ route, color }) {
  const W = 260, H = 48;
  const points = useMemo_sb(() => {
    const n = 40, seed = route.id.length * 13, arr = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      arr.push((Math.sin(t*Math.PI*2+seed*0.1)*0.3 + Math.sin(t*Math.PI*5+seed*0.3)*0.18 +
        Math.cos(t*Math.PI*3+seed*0.7)*0.22 + Math.sin(t*Math.PI*7+seed)*0.1 + 1) / 2);
    }
    const min = Math.min(...arr), max = Math.max(...arr);
    return arr.map(v => (v - min) / (max - min || 1));
  }, [route.id]);

  const pathD = points.map((v, i) =>
    `${i===0?'M':'L'}${((i/(points.length-1))*W).toFixed(1)} ${(H - v*(H-4) - 2).toFixed(1)}`
  ).join(' ');

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{display:'block'}}>
      <defs>
        <linearGradient id={`eg-${route.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={pathD + ` L${W} ${H} L0 ${H} Z`} fill={`url(#eg-${route.id})`}/>
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
    </svg>
  );
}

function Stars_sb({ rating }) {
  const full = Math.floor(rating), half = rating - full >= 0.4 && rating - full < 0.9;
  return (
    <span style={{color:'#d4882a', letterSpacing:'0.5px', fontSize:'11px'}}>
      {Array.from({length:5}).map((_, i) =>
        i < full ? <span key={i}>★</span> :
        (i === full && half) ? <span key={i} style={{opacity:0.55}}>★</span> :
        <span key={i} style={{opacity:0.2}}>★</span>
      )}
    </span>
  );
}

function StripePlaceholder_sb({ caption, color }) {
  return (
    <div style={{position:'relative', flex:'1 1 0', minWidth:0, aspectRatio:'4/3',
      background:`repeating-linear-gradient(135deg,rgba(28,18,8,0.06) 0 6px,rgba(28,18,8,0.02) 6px 12px),#ede0c4`,
      border:'1px solid rgba(155,139,110,0.35)', display:'flex', alignItems:'flex-end',
      padding:'5px', overflow:'hidden'}}>
      <div style={{position:'absolute', top:5, right:5, width:4, height:4, background:color, borderRadius:'50%'}}/>
      <div style={{fontFamily:"'JetBrains Mono',monospace", fontSize:'7.5px', letterSpacing:'0.06em',
        textTransform:'uppercase', color:'#1c1208', opacity:0.55, lineHeight:1.25}}>{caption}</div>
    </div>
  );
}

function RouteDetailPane({ route, onBack }) {
  const color = window.TYPE_COLOR[route.type] || '#9b8b6e';
  const country = window.COUNTRIES[route.country] || { flag: (route.country || '').toUpperCase() };

  return (
    <div className="route-detail">
      <div className="detail-top-bar" style={{background: color}}/>
      <button className="detail-back" onClick={onBack}>
        <span className="back-arrow">←</span>
        <span>Zurück zur Liste</span>
      </button>
      <div className="detail-scroll">
        <div className="detail-body">
          <div className="popout-meta-row">
            <span className="popout-eyebrow">
              <span className="dot" style={{background:color}}/>
              {country.flag} · {route.region}
            </span>
            <span className="popout-type" style={{color}}>
              {route.type === 'offroad' ? 'Offroad' : 'Touring'}
            </span>
          </div>

          <h3 className="popout-title">{route.name}</h3>

          <div className="popout-rating">
            <Stars_sb rating={route.rating}/>
            <span className="rating-num">{route.rating.toFixed(1)}</span>
          </div>

          {route.review && <p className="popout-desc">{route.review}</p>}

          <div className="popout-stats">
            <div className="stat-cell">
              <div className="stat-num">{route.distance_km}</div>
              <div className="stat-key">km</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num">{route.elevation_gain_m.toLocaleString('de')}</div>
              <div className="stat-key">Hm</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num">{route.duration_h}<span className="stat-unit">h</span></div>
              <div className="stat-key">Fahrt</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num">{route.offroad_pct}<span className="stat-unit">%</span></div>
              <div className="stat-key">Offroad</div>
            </div>
          </div>

          <div className="popout-section">
            <div className="section-tag">Höhenprofil</div>
            <ElevationProfile_sb route={route} color={color}/>
          </div>

          <div className="popout-section">
            <div className="image-row">
              {route.images.slice(0, 3).map((cap, i) =>
                <StripePlaceholder_sb key={i} caption={cap} color={color}/>
              )}
            </div>
          </div>

          <div className="popout-detail-rows">
            <div className="detail-row">
              <span className="detail-key">Schwierigkeit</span>
              <span className="detail-val">
                <span className="diff-pips">
                  {Array.from({length:5}).map((_, i) =>
                    <span key={i} className={`pip ${i < route.difficulty ? 'on' : ''}`}
                      style={i < route.difficulty ? {background:color} : {}}/>
                  )}
                </span>
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Belag</span>
              <span className="detail-val">{route.surface}</span>
            </div>
          </div>

          <div className="popout-footer">
            {route.gpx_url ? (
              <>
                <a className="popout-btn primary" href={'/'+route.gpx_url} download rel="noopener">↓ GPX</a>
                {(() => {
                  const absUrl = window.location.origin + '/' + route.gpx_url;
                  const scenicUrl = 'https://scenicapp.space/Scenic/api/import/gpxurl?gpxurl=' + encodeURIComponent(absUrl) + '&source=MotoAtlas';
                  return <a className="popout-btn" href={scenicUrl} target="_blank" rel="noopener">→ Scenic</a>;
                })()}
              </>
            ) : (
              // gpx_redistribution === 'link_only': nicht-redistributable Quelle → User zur Originalquelle leiten
              <a className="popout-btn primary" href={route.source_url} target="_blank" rel="noopener">
                ↗ Bei {route.source_name || 'Originalquelle'} herunterladen
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ routes, hoveredId, selectedId, onHover, onSelect, filters, setFilters, allRoutesCount, mobileOpen, setMobileOpen }) {
  const filtered = useMemo_sb(() => window.applyFilters(routes, filters), [routes, filters]);
  const totalKm = filtered.reduce((s, r) => s + r.distance_km, 0);
  const avgRating = filtered.length ? (filtered.reduce((s, r) => s + r.rating, 0) / filtered.length) : 0;
  const selectedRoute = routes.find(r => r.id === selectedId);

  useEffect_sb(() => { if (selectedRoute && setMobileOpen) setMobileOpen(true); }, [selectedRoute]);

  return (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''} ${selectedRoute ? 'has-detail' : ''}`}>
      <div className="sheet-handle" onClick={() => setMobileOpen && setMobileOpen(!mobileOpen)}>
        <div className="sheet-grip"/>
      </div>

      {selectedRoute ? (
        <RouteDetailPane route={selectedRoute} onBack={() => onSelect(null)}/>
      ) : (
        <>
          <div className="sidebar-header">
            <div className="sidebar-title">
              <div className="title-tag">Index</div>
              <h2>Alle Routen</h2>
            </div>
            <div className="sidebar-stats">
              <div className="ss-cell"><span className="ss-num">{filtered.length}</span><span className="ss-key">Routen</span></div>
              <div className="ss-cell"><span className="ss-num">{totalKm.toLocaleString('de')}</span><span className="ss-key">km gesamt</span></div>
              <div className="ss-cell"><span className="ss-num">{avgRating.toFixed(1)}</span><span className="ss-key">Ø Bewertung</span></div>
            </div>
          </div>

          <div className="filter-block">
            <div className="filter-label">Land</div>
            <div className="filter-row">
              <button className={`f-chip ${filters.country === 'all' ? 'on' : ''}`}
                onClick={() => setFilters({...filters, country:'all'})}>Alle · {allRoutesCount}</button>
              {Object.entries(window.COUNTRIES).map(([code, c]) => {
                const n = routes.filter(r => r.country === code).length;
                if (!n) return null;
                return (
                  <button key={code} className={`f-chip ${filters.country === code ? 'on' : ''}`}
                    onClick={() => setFilters({...filters, country:code})}>
                    {c.flag} <span className="cc">·{n}</span>
                  </button>
                );
              })}
            </div>

            <div className="filter-label">Typ</div>
            <div className="filter-row">
              {['all','touring','offroad'].map(t => (
                <button key={t} className={`f-chip ${filters.type === t ? 'on' : ''}`}
                  onClick={() => setFilters({...filters, type:t})}>
                  {t === 'all' ? 'Alle' : t === 'touring' ? 'Touring' : 'Offroad'}
                </button>
              ))}
            </div>

            <div className="filter-label">Schwierigkeit</div>
            <div className="filter-row">
              <button className={`f-chip ${filters.difficulty === 'all' ? 'on' : ''}`}
                onClick={() => setFilters({...filters, difficulty:'all'})}>Alle</button>
              {[1,2,3,4,5].map(d => (
                <button key={d} className={`f-chip ${filters.difficulty === d ? 'on' : ''}`}
                  onClick={() => setFilters({...filters, difficulty:d})}>
                  {Array.from({length:d}).map((_, i) => <span key={i}>●</span>)}
                </button>
              ))}
            </div>
          </div>

          <div className="route-list">
            {!filtered.length && <div className="empty-msg">Keine Routen für diesen Filter.</div>}
            {filtered.map((r, i) => {
              const color = window.TYPE_COLOR[r.type] || '#9b8b6e';
              const c = window.COUNTRIES[r.country] || { flag: (r.country||'').toUpperCase() };
              return (
                <div key={r.id}
                  className={`route-row ${hoveredId === r.id ? 'hover' : ''} ${selectedId === r.id ? 'sel' : ''}`}
                  onMouseEnter={() => onHover(r.id)}
                  onMouseLeave={() => onHover(null)}
                  onClick={() => onSelect(r.id)}
                  style={{animationDelay: `${i * 30}ms`}}>
                  <div className="row-num">{String(i+1).padStart(2,'0')}</div>
                  <div className="row-color-bar" style={{background: color}}/>
                  <div className="row-body">
                    <div className="row-meta">
                      <span style={{color}}>{c.flag}</span>
                      <span className="row-region">{r.region}</span>
                      <span className="row-type">{r.type === 'offroad' ? 'Offroad' : 'Touring'}</span>
                    </div>
                    <div className="row-name">{r.name}</div>
                    <div className="row-stats">
                      <span><strong>{r.distance_km}</strong>km</span>
                      <span><strong>{r.elevation_gain_m.toLocaleString('de')}</strong>hm</span>
                      <span><strong>{r.duration_h}</strong>h</span>
                      <span className="row-rating">★ {r.rating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
}

window.Sidebar = Sidebar;

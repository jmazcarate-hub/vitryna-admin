let chartPubsDia    = null;
let chartRegistros  = null;
let chartEngagement = null;
let chartRetencion  = null;
let chartChurn      = null;
let periodoPubsActual = 'dia';
let periodoEngagementActual = 'dia';

async function loadEstadisticas() {
  const cargas = [
    ['KPIs de engagement',        cargarKpisEngagement()],
    ['Publicaciones',             cargarGraficaPubsDia(periodoPubsActual)],
    ['Nuevos registros',          cargarGraficaRegistros()],
    ['Vistas y clics',            cargarGraficaEngagement(periodoEngagementActual)],
    ['Top comercios',             cargarTopComercios()],
    ['Top publicaciones',         cargarTopPublicaciones()],
    ['Ranking de actividad',      cargarRankingActividad()],
    ['Retención semanal',         cargarGraficaRetencion()],
    ['Churn mensual',             cargarGraficaChurn()],
    ['Funnel de conversión',      cargarFunnelConversion()],
    ['Comercios por barrio',      cargarComerciosPorBarrio()],
    ['Comercios por categoría',   cargarComerciosPorCategoria()],
    ['Activación (2ª publicación)', cargarActivacionSegundaPublicacion()],
    ['Cuentas con amigo',         cargarKpiCuentasConAmigo()],
  ];
  const resultados = await Promise.allSettled(cargas.map(([, p]) => p));
  const fallidos = [];
  resultados.forEach((r, i) => {
    if (r.status === 'rejected') {
      const [nombre] = cargas[i];
      console.error(`[Estadísticas] Error cargando "${nombre}":`, r.reason);
      fallidos.push(nombre);
    }
  });
  bindFiltrosPeriodoPubs();
  bindFiltrosPeriodoEngagement();
  if (fallidos.length) {
    toast(`No se pudo cargar: ${fallidos.join(', ')} (ver consola)`, 'error');
  }
}

function bindFiltrosPeriodoPubs() {
  const cont = document.getElementById('filtros-pubs-periodo');
  if (!cont || cont._bound) return;
  cont.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      cont.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      periodoPubsActual = chip.dataset.periodo;
      cargarGraficaPubsDia(periodoPubsActual);
    });
  });
  cont._bound = true;
}

function bindFiltrosPeriodoEngagement() {
  const cont = document.getElementById('filtros-engagement-periodo');
  if (!cont || cont._bound) return;
  cont.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      cont.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      periodoEngagementActual = chip.dataset.periodo;
      cargarGraficaEngagement(periodoEngagementActual);
    });
  });
  cont._bound = true;
}

// ── KPIs GLOBALES ──
async function cargarKpisEngagement() {
  const snap = await db.collection('Publicaciones').get();
  const pubs = snap.docs.map(d => d.data());
  const totalVistas = pubs.reduce((s, p) => s + (p.vistas || 0), 0);
  const totalClics  = pubs.reduce((s, p) => s + (p.clics  || 0), 0);
  const ctr = totalVistas > 0 ? ((totalClics / totalVistas) * 100).toFixed(1) + '%' : '0%';
  document.getElementById('est-vistas').textContent     = totalVistas.toLocaleString('es-ES');
  document.getElementById('est-vistas-sub').textContent = 'En todas las publicaciones';
  document.getElementById('est-clics').textContent      = totalClics.toLocaleString('es-ES');
  document.getElementById('est-clics-sub').textContent  = 'En todas las publicaciones';
  document.getElementById('est-ctr').textContent        = ctr;
  document.getElementById('est-pubs').textContent       = pubs.length;
  document.getElementById('est-pubs-sub').textContent   = 'Publicaciones registradas';
}

// ── PUBLICACIONES POR DÍA / SEMANA / MES ──
async function cargarGraficaPubsDia(periodo = 'dia') {
  const snap = await db.collection('Publicaciones').get();
  const pubs = snap.docs.map(d => d.data()).filter(p => p.timestamp);

  let labels, valores, subLabel;
  if (periodo === 'semana') {
    const { labels: labelsSemana, semanas } = generarEjesSemanas(12);
    const datos = new Array(12).fill(0);
    pubs.forEach(p => {
      const idx = semanaIndex(p.timestamp.toDate(), semanas);
      if (idx >= 0) datos[idx]++;
    });
    labels = labelsSemana;
    valores = datos;
    subLabel = 'Últimas 12 semanas';
  } else if (periodo === 'mes') {
    const hoy = new Date();
    const meses = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      meses.push({ anio: d.getFullYear(), mes: d.getMonth(), label: d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }), valor: 0 });
    }
    pubs.forEach(p => {
      const fecha = p.timestamp.toDate();
      const bucket = meses.find(m => m.anio === fecha.getFullYear() && m.mes === fecha.getMonth());
      if (bucket) bucket.valor++;
    });
    labels = meses.map(m => m.label);
    valores = meses.map(m => m.valor);
    subLabel = 'Últimos 12 meses';
  } else {
    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);
    const mapa = {};
    pubs.forEach(p => {
      const d = p.timestamp.toDate();
      if (d < hace30) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      mapa[key] = (mapa[key] || 0) + 1;
    });
    ({ labels, valores } = generarEjesDias(30, mapa));
    subLabel = 'Últimos 30 días';
  }

  const subEl = document.getElementById('pubs-periodo-sub');
  if (subEl) subEl.textContent = subLabel;

  const ctx = document.getElementById('chart-pubs-dia').getContext('2d');
  if (chartPubsDia) chartPubsDia.destroy();
  chartPubsDia = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Publicaciones', data: valores, borderColor: '#1A6BFF', backgroundColor: 'rgba(26,107,255,0.08)', borderWidth: 2, pointRadius: 3, tension: 0.3, fill: true },
    ]},
    options: opcionesBase()
  });
}

// ── NUEVOS REGISTROS POR SEMANA (últimas 8 semanas) ──
async function cargarGraficaRegistros() {
  const hace8sem = new Date();
  hace8sem.setDate(hace8sem.getDate() - 56);
  const [comSnap, usuSnap] = await Promise.all([
    db.collection('comercios').get(),
    db.collection('usuarios').get(),
  ]);
  const { labels, semanas } = generarEjesSemanas(8);
  const dataCom = new Array(8).fill(0);
  const dataVec = new Array(8).fill(0);
  comSnap.docs.forEach(doc => {
    const ts = doc.data().creado_en;
    if (!ts) return;
    const fecha = ts.toDate();
    if (fecha < hace8sem) return;
    const idx = semanaIndex(fecha, semanas);
    if (idx >= 0) dataCom[idx]++;
  });
  usuSnap.docs.forEach(doc => {
    const d = doc.data();
    if (d.rol && d.rol !== 'vecino') return;
    const ts = d.creado_en;
    if (!ts) return;
    const fecha = ts.toDate();
    if (fecha < hace8sem) return;
    const idx = semanaIndex(fecha, semanas);
    if (idx >= 0) dataVec[idx]++;
  });
  const ctx = document.getElementById('chart-registros').getContext('2d');
  if (chartRegistros) chartRegistros.destroy();
  chartRegistros = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Comercios', data: dataCom, backgroundColor: 'rgba(26,107,255,0.7)', borderRadius: 4 },
      { label: 'Vecinos',   data: dataVec, backgroundColor: 'rgba(255,170,0,0.7)',  borderRadius: 4 },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 11 }, padding: 12 } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 } } },
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'DM Sans', size: 10 } }, grid: { color: 'rgba(0,0,0,0.04)' } }
      }
    }
  });
}

// ── VISTAS Y CLICS POR DÍA / SEMANA / MES — IDs de stats_diarias: YYYY-MM-DD ──
async function cargarGraficaEngagement(periodo = 'dia') {
  // Una sola collectionGroup query (sin filtro de fecha) en lugar de N+1 queries
  // por publicación — sirve igual para día, semana o mes, solo cambia cómo se
  // agrupan luego los mismos datos.
  const statsSnap = await db.collectionGroup('stats_diarias').get();
  const mapaVistas = {};
  const mapaClics  = {};
  statsSnap.docs.forEach(s => {
    const d = s.data();
    mapaVistas[s.id] = (mapaVistas[s.id] || 0) + (d.vistas || 0);
    mapaClics[s.id]  = (mapaClics[s.id]  || 0) + (d.clics  || 0);
  });

  const parseFechaId = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  let labels, vistas, clics, subLabel;

  if (periodo === 'semana') {
    const { labels: labelsSemana, semanas } = generarEjesSemanas(12);
    const datosVistas = new Array(12).fill(0);
    const datosClics  = new Array(12).fill(0);
    Object.keys(mapaVistas).forEach(key => {
      const idx = semanaIndex(parseFechaId(key), semanas);
      if (idx >= 0) datosVistas[idx] += mapaVistas[key];
    });
    Object.keys(mapaClics).forEach(key => {
      const idx = semanaIndex(parseFechaId(key), semanas);
      if (idx >= 0) datosClics[idx] += mapaClics[key];
    });
    labels = labelsSemana; vistas = datosVistas; clics = datosClics;
    subLabel = 'Últimas 12 semanas · suma de todas las publicaciones';
  } else if (periodo === 'mes') {
    const hoy = new Date();
    const meses = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      meses.push({ anio: d.getFullYear(), mes: d.getMonth(), label: d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }), vistas: 0, clics: 0 });
    }
    Object.keys(mapaVistas).forEach(key => {
      const fecha = parseFechaId(key);
      const bucket = meses.find(m => m.anio === fecha.getFullYear() && m.mes === fecha.getMonth());
      if (bucket) bucket.vistas += mapaVistas[key];
    });
    Object.keys(mapaClics).forEach(key => {
      const fecha = parseFechaId(key);
      const bucket = meses.find(m => m.anio === fecha.getFullYear() && m.mes === fecha.getMonth());
      if (bucket) bucket.clics += mapaClics[key];
    });
    labels = meses.map(m => m.label);
    vistas = meses.map(m => m.vistas);
    clics  = meses.map(m => m.clics);
    subLabel = 'Últimos 12 meses · suma de todas las publicaciones';
  } else {
    const fechas = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      fechas.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    }
    labels = fechas.map(f => `${f.slice(8)}/${f.slice(5,7)}`);  // DD/MM
    vistas = fechas.map(f => mapaVistas[f] || 0);
    clics  = fechas.map(f => mapaClics[f]  || 0);
    subLabel = 'Últimos 30 días · suma de todas las publicaciones';
  }

  const subEl = document.getElementById('engagement-periodo-sub');
  if (subEl) subEl.textContent = subLabel;

  const ctx = document.getElementById('chart-engagement').getContext('2d');
  if (chartEngagement) chartEngagement.destroy();
  chartEngagement = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Vistas', data: vistas, borderColor: '#1A6BFF', backgroundColor: 'rgba(26,107,255,0.08)', borderWidth: 2, pointRadius: 3, tension: 0.3, fill: true },
      { label: 'Clics',  data: clics,  borderColor: '#FFAA00', backgroundColor: 'rgba(255,170,0,0.08)',  borderWidth: 2, pointRadius: 3, tension: 0.3, fill: true },
    ]},
    options: opcionesBase()
  });
}

// ── TOP 5 COMERCIOS POR VISTAS ──
async function cargarTopComercios() {
  const snap = await db.collection('Publicaciones').get();
  const porComercio = {};
  snap.docs.forEach(doc => {
    const d = doc.data();
    const id = d.comercio_id || '?';
    if (!porComercio[id]) porComercio[id] = { nombre: d.nombre_comercio || '—', vistas: 0, clics: 0 };
    porComercio[id].vistas += d.vistas || 0;
    porComercio[id].clics  += d.clics  || 0;
  });
  const top = Object.values(porComercio).sort((a, b) => b.vistas - a.vistas).slice(0, 5);
  const el = document.getElementById('top-comercios');
  if (!top.length) { el.innerHTML = '<div class="empty">Sin datos todavía</div>'; return; }
  const maxV = top[0].vistas || 1;
  el.innerHTML = top.map((c, i) => `
    <div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;">
      <div style="width:22px;height:22px;border-radius:6px;background:var(--blue-light);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;color:var(--blue);flex-shrink:0;">${i+1}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.85rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.nombre)}</div>
        <div style="margin-top:4px;height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${Math.round(c.vistas/maxV*100)}%;background:var(--blue);border-radius:2px;"></div>
        </div>
      </div>
      <div style="font-size:0.8rem;font-family:'DM Mono',monospace;color:var(--blue);font-weight:600;flex-shrink:0;">${c.vistas.toLocaleString('es-ES')}</div>
    </div>`).join('');
}

// ── TOP 5 PUBLICACIONES POR CLICS ──
async function cargarTopPublicaciones() {
  const snap = await db.collection('Publicaciones').orderBy('clics', 'desc').limit(5).get();
  const el = document.getElementById('top-publicaciones');
  const pubs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (!pubs.length) { el.innerHTML = '<div class="empty">Sin datos todavía</div>'; return; }
  const maxC = pubs[0].clics || 1;
  el.innerHTML = pubs.map((p, i) => `
    <div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;">
      <div style="width:22px;height:22px;border-radius:6px;background:var(--orange-light);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;color:var(--orange);flex-shrink:0;">${i+1}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.85rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.titulo) || '—'}</div>
        <div style="font-size:0.72rem;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.nombre_comercio)}</div>
        <div style="margin-top:4px;height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${Math.round((p.clics||0)/maxC*100)}%;background:var(--orange);border-radius:2px;"></div>
        </div>
      </div>
      <div style="font-size:0.8rem;font-family:'DM Mono',monospace;color:var(--orange);font-weight:600;flex-shrink:0;">${(p.clics||0).toLocaleString('es-ES')}</div>
    </div>`).join('');
}

// ── RANKING DE ACTIVIDAD ──
async function cargarRankingActividad() {
  const [pubsSnap, comSnap] = await Promise.all([
    db.collection('Publicaciones').get(),
    db.collection('comercios').get(),
  ]);

  const hace30 = new Date();
  hace30.setDate(hace30.getDate() - 30);

  const mapa = {};
  comSnap.docs.forEach(doc => {
    const d = doc.data();
    mapa[doc.id] = {
      nombre: d.nombre_comercio || '—', pubs30: 0, ultimaPub: null,
      rec15: d.recordatorio_15d_enviado?.toDate?.() || null,
      rec30: d.recordatorio_30d_enviado?.toDate?.() || null,
    };
  });

  pubsSnap.docs.forEach(doc => {
    const d = doc.data();
    const id = d.comercio_id;
    if (!id || !mapa[id]) return;
    const ts = d.timestamp?.toDate();
    if (!ts) return;
    if (ts > hace30) mapa[id].pubs30++;
    if (!mapa[id].ultimaPub || ts > mapa[id].ultimaPub) mapa[id].ultimaPub = ts;
  });

  const lista = Object.values(mapa);

  const masActivos = lista.filter(c => c.pubs30 > 0)
    .sort((a, b) => b.pubs30 - a.pubs30).slice(0, 10);

  const inactivos = lista.filter(c => c.pubs30 === 0)
    .sort((a, b) => {
      if (!a.ultimaPub && !b.ultimaPub) return 0;
      if (!a.ultimaPub) return -1;
      if (!b.ultimaPub) return 1;
      return a.ultimaPub - b.ultimaPub;
    }).slice(0, 10);

  const elActivos = document.getElementById('ranking-activos');
  if (!masActivos.length) {
    elActivos.innerHTML = '<div class="empty">Sin publicaciones en los últimos 30 días</div>';
  } else {
    const maxPubs = masActivos[0].pubs30 || 1;
    elActivos.innerHTML = masActivos.map((c, i) => `
      <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;">
        <div style="width:22px;height:22px;border-radius:6px;background:var(--blue-light);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;color:var(--blue);flex-shrink:0;">${i+1}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.85rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.nombre)}</div>
          <div style="margin-top:4px;height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${Math.round(c.pubs30/maxPubs*100)}%;background:var(--blue);border-radius:2px;"></div>
          </div>
        </div>
        <div style="font-size:0.8rem;font-family:'DM Mono',monospace;color:var(--blue);font-weight:600;flex-shrink:0;">${c.pubs30} pub${c.pubs30 !== 1 ? 's' : ''}</div>
      </div>`).join('');
  }

  const elInactivos = document.getElementById('ranking-inactivos');
  if (!inactivos.length) {
    elInactivos.innerHTML = '<div class="empty">Todos los comercios han publicado recientemente</div>';
  } else {
    elInactivos.innerHTML = inactivos.map(c => {
      const dias = c.ultimaPub
        ? Math.floor((Date.now() - c.ultimaPub.getTime()) / 86400000)
        : null;
      const etiqueta = dias === null ? 'Nunca' : `hace ${dias}d`;
      const color = dias === null || dias > 30 ? 'var(--red)' : 'var(--orange)';
      const colorLight = dias === null || dias > 30 ? 'var(--red-light)' : 'var(--orange-light)';
      const ultimoRecordatorio = [c.rec15, c.rec30].filter(Boolean).sort((a, b) => b - a)[0] || null;
      return `
      <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.85rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.nombre)}</div>
          <div style="font-size:0.72rem;color:var(--text-3);margin-top:2px;">${ultimoRecordatorio ? 'Recordatorio enviado: ' + formatDate(ultimoRecordatorio) : 'Sin recordatorio enviado'}</div>
        </div>
        <div style="font-size:0.75rem;padding:2px 8px;border-radius:12px;background:${colorLight};color:${color};font-weight:600;flex-shrink:0;">${etiqueta}</div>
      </div>`;
    }).join('');
  }
}

// ── RETENCIÓN SEMANAL — % de comercios que publican cada semana ──
async function cargarGraficaRetencion() {
  const [pubsSnap, comSnap] = await Promise.all([
    db.collection('Publicaciones').get(),
    db.collection('comercios').get(),
  ]);
  const totalComercios = comSnap.size;
  const { labels, semanas } = generarEjesSemanas(8);
  const setsPorSemana = semanas.map(() => new Set());

  pubsSnap.docs.forEach(doc => {
    const d = doc.data();
    if (!d.timestamp || !d.comercio_id) return;
    const idx = semanaIndex(d.timestamp.toDate(), semanas);
    if (idx >= 0) setsPorSemana[idx].add(d.comercio_id);
  });

  const conteos = setsPorSemana.map(s => s.size);
  const porcentajes = conteos.map(c => totalComercios > 0 ? Math.round((c / totalComercios) * 1000) / 10 : 0);

  const ctx = document.getElementById('chart-retencion').getContext('2d');
  if (chartRetencion) chartRetencion.destroy();
  chartRetencion = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: '% de comercios que publican', data: porcentajes, backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y}% (${conteos[ctx.dataIndex]} de ${totalComercios})` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 } } },
        y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%', font: { family: 'DM Sans', size: 10 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
      },
    },
  });
}

// ── CHURN MENSUAL — cancelaciones (envios_retencion.enviado_en) últimos 6 meses ──
// Aproximación: no existe un snapshot histórico de la base de comercios de pago
// por mes, así que el % se calcula contra la base de pago actual + las
// cancelaciones de este mes (la base "antes" de esas bajas).
async function cargarGraficaChurn() {
  const hoy = new Date();
  const inicioVentana = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1);

  const [envSnap, comSnap] = await Promise.all([
    db.collection('envios_retencion')
      .where('enviado_en', '>=', firebase.firestore.Timestamp.fromDate(inicioVentana))
      .get(),
    db.collection('comercios').get(),
  ]);
  const comerciosPago = comSnap.docs.filter(d => {
    const plan = d.data().plan_suscripcion;
    return plan === 'pro' || plan === 'multi';
  }).length;

  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({ anio: d.getFullYear(), mes: d.getMonth(), label: d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }), valor: 0 });
  }
  envSnap.docs.forEach(doc => {
    const ts = doc.data().enviado_en;
    if (!ts) return;
    const fecha = ts.toDate();
    const bucket = meses.find(m => m.anio === fecha.getFullYear() && m.mes === fecha.getMonth());
    if (bucket) bucket.valor++;
  });

  const ctx = document.getElementById('chart-churn').getContext('2d');
  if (chartChurn) chartChurn.destroy();
  chartChurn = new Chart(ctx, {
    type: 'bar',
    data: { labels: meses.map(m => m.label), datasets: [{ label: 'Cancelaciones', data: meses.map(m => m.valor), backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 } } },
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'DM Sans', size: 10 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
      },
    },
  });

  const cancelacionesMes = meses[meses.length - 1].valor;
  const basePago = comerciosPago + cancelacionesMes;
  const churnPct = basePago > 0 ? ((cancelacionesMes / basePago) * 100).toFixed(1) : '0.0';
  const resumenEl = document.getElementById('churn-resumen');
  if (resumenEl) {
    resumenEl.textContent = `${cancelacionesMes} cancelación${cancelacionesMes !== 1 ? 'es' : ''} este mes · churn aprox. ${churnPct}% sobre ${basePago} comercios de pago`;
  }
}

// ── FUNNEL DE CONVERSIÓN — registro > primer amigo > primer boost ──
// Sin el paso "descarga": no es medible sin datos de la store/Analytics.
async function cargarFunnelConversion() {
  const [comSnap, facSnap] = await Promise.all([
    db.collection('comercios').get(),
    db.collection('facturas').where('tipo', '==', 'boost').get(),
  ]);

  const totalRegistro = comSnap.size;
  const conAmigo = comSnap.docs.filter(d => (d.data().seguidores_count || 0) > 0).length;
  const comerciosConBoost = new Set(facSnap.docs.map(d => d.data().comercio_id).filter(Boolean));
  const conBoost = comerciosConBoost.size;

  const pasos = [
    { label: 'Registro',      valor: totalRegistro },
    { label: 'Primer amigo',  valor: conAmigo },
    { label: 'Primer boost',  valor: conBoost },
  ];

  const el = document.getElementById('funnel-conversion');
  if (!el) return;
  if (!totalRegistro) { el.innerHTML = '<div class="empty">Sin comercios todavía</div>'; return; }

  const base = pasos[0].valor;
  el.innerHTML = pasos.map((p, i) => {
    const pct = Math.round((p.valor / base) * 1000) / 10;
    const pctPrevio = i > 0 && pasos[i - 1].valor > 0 ? Math.round((p.valor / pasos[i - 1].valor) * 1000) / 10 : null;
    return `
      <div style="padding:12px 0;${i > 0 ? 'border-top:1px solid var(--border);' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
          <div style="font-size:0.85rem;font-weight:500;">${p.label}</div>
          <div style="font-size:0.8rem;font-family:'DM Mono',monospace;color:var(--blue);font-weight:600;">${p.valor}</div>
        </div>
        <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:var(--blue);border-radius:4px;"></div>
        </div>
        <div style="font-size:0.72rem;color:var(--text-2);margin-top:4px;">${pct}% del total${pctPrevio !== null ? ` · ${pctPrevio}% del paso anterior` : ''}</div>
      </div>`;
  }).join('');
}

// ── COMERCIOS POR BARRIO ──
async function cargarComerciosPorBarrio() {
  const snap = await db.collection('comercios').get();
  const mapa = {};
  snap.docs.forEach(doc => {
    const barrio = doc.data().barrio || 'Sin barrio';
    mapa[barrio] = (mapa[barrio] || 0) + 1;
  });
  const lista = Object.entries(mapa)
    .map(([barrio, count]) => ({ barrio, count }))
    .sort((a, b) => b.count - a.count);

  const el = document.getElementById('comercios-por-barrio');
  if (!lista.length) { el.innerHTML = '<div class="empty">Sin datos todavía</div>'; return; }
  const maxC = lista[0].count || 1;
  el.innerHTML = lista.map(b => `
    <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.85rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(b.barrio)}</div>
        <div style="margin-top:4px;height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${Math.round(b.count/maxC*100)}%;background:var(--blue);border-radius:2px;"></div>
        </div>
      </div>
      <div style="font-size:0.8rem;font-family:'DM Mono',monospace;color:var(--blue);font-weight:600;flex-shrink:0;">${b.count}</div>
    </div>`).join('');
}

// ── COMERCIOS POR CATEGORÍA ──
async function cargarComerciosPorCategoria() {
  const snap = await db.collection('comercios').get();
  const mapa = {};
  snap.docs.forEach(doc => {
    const categoria = doc.data().categoria || 'Sin categoría';
    mapa[categoria] = (mapa[categoria] || 0) + 1;
  });
  const lista = Object.entries(mapa)
    .map(([categoria, count]) => ({ categoria, count }))
    .sort((a, b) => b.count - a.count);

  const el = document.getElementById('comercios-por-categoria');
  if (!lista.length) { el.innerHTML = '<div class="empty">Sin datos todavía</div>'; return; }
  const maxC = lista[0].count || 1;
  el.innerHTML = lista.map(c => `
    <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.85rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.categoria)}</div>
        <div style="margin-top:4px;height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${Math.round(c.count/maxC*100)}%;background:var(--orange);border-radius:2px;"></div>
        </div>
      </div>
      <div style="font-size:0.8rem;font-family:'DM Mono',monospace;color:var(--orange);font-weight:600;flex-shrink:0;">${c.count}</div>
    </div>`).join('');
}

// ── ACTIVACIÓN — tiempo desde el registro hasta la 2ª publicación ──
// La 1ª publicación de cada comercio suele ser la de bienvenida automática
// (crearPublicacionPresentacion), así que la señal real de activación es la 2ª.
async function cargarActivacionSegundaPublicacion() {
  const [comSnap, pubsSnap] = await Promise.all([
    db.collection('comercios').get(),
    db.collection('Publicaciones').get(),
  ]);

  const porComercio = {};
  pubsSnap.docs.forEach(doc => {
    const d = doc.data();
    if (!d.comercio_id || !d.timestamp) return;
    (porComercio[d.comercio_id] = porComercio[d.comercio_id] || []).push(d.timestamp.toDate());
  });

  const dias = [];
  comSnap.docs.forEach(doc => {
    const c = doc.data();
    if (!c.creado_en) return;
    const lista = (porComercio[doc.id] || []).sort((a, b) => a - b);
    if (lista.length < 2) return;
    const diffDias = (lista[1] - c.creado_en.toDate()) / 86400000;
    if (diffDias >= 0) dias.push(diffDias);
  });

  const el = document.getElementById('activacion-resumen');
  if (!el) return;
  if (!dias.length) {
    el.innerHTML = '<div class="empty">Sin comercios con 2ª publicación todavía</div>';
    return;
  }
  const media = dias.reduce((a, b) => a + b, 0) / dias.length;
  el.innerHTML = `
    <div style="font-size:1.7rem;font-weight:700;color:var(--text);">${media.toFixed(1)} días</div>
    <div style="font-size:0.72rem;color:var(--text-2);margin-top:4px;">Media desde el registro hasta la 2ª publicación</div>
    <div style="font-size:0.72rem;color:var(--text-3);margin-top:8px;">${dias.length} de ${comSnap.size} comercios han llegado a su 2ª publicación</div>
  `;
}

// ── KPI: CUENTAS (VECINOS + COMERCIOS) CON AL MENOS UN AMIGO AÑADIDO ──
// toggleAmigo es válido tanto para vecinos como para comercios que siguen a
// otros comercios (un comercio también tiene su propio doc en usuarios/{uid}
// con su lista de amigos) — así que aquí no se distingue entre unos y otros.
// El admin ya no tiene ningún doc en usuarios (su autoridad es el custom
// claim de Firebase Auth), así que no hace falta excluirlo aquí.
async function cargarKpiCuentasConAmigo() {
  const snap = await db.collection('usuarios').get();
  const cuentas = snap.docs;
  const total = cuentas.length;

  const comercios = cuentas.filter(doc => doc.data().rol === 'comercio');
  const vecinos   = cuentas.filter(doc => doc.data().rol !== 'comercio');
  const comerciosConAmigo = comercios.filter(doc => (doc.data().amigos || []).length > 0).length;
  const vecinosConAmigo   = vecinos.filter(doc => (doc.data().amigos || []).length > 0).length;
  const conAmigo = comerciosConAmigo + vecinosConAmigo;
  const pct = total > 0 ? ((conAmigo / total) * 100).toFixed(1) : '0.0';
  const pctComercios = total > 0 ? ((comerciosConAmigo / total) * 100).toFixed(1) : '0.0';
  const pctVecinos   = total > 0 ? ((vecinosConAmigo / total) * 100).toFixed(1) : '0.0';

  const valEl = document.getElementById('est-cuentas-amigo');
  const subEl = document.getElementById('est-cuentas-amigo-sub');
  if (valEl) valEl.textContent = `${pct}%`;
  if (subEl) subEl.textContent = `${comerciosConAmigo} com. (${pctComercios}%) · ${vecinosConAmigo} vec. (${pctVecinos}%)`;
}

// ── HELPERS ──
function opcionesBase() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 11 }, padding: 12 } } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 }, maxRotation: 45 } },
      y: { beginAtZero: true, ticks: { font: { family: 'DM Sans', size: 10 } }, grid: { color: 'rgba(0,0,0,0.04)' } }
    }
  };
}
function generarEjesDias(n, mapa) {
  const labels = [], valores = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    labels.push(`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`);
    valores.push(mapa[key] || 0);
  }
  return { labels, valores };
}
function generarEjesSemanas(n) {
  const semanas = [], labels = [];
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);
  for (let i = n - 1; i >= 0; i--) {
    const fin = new Date(hoy);
    fin.setDate(hoy.getDate() - i * 7);
    const ini = new Date(fin);
    ini.setDate(fin.getDate() - 6);
    ini.setHours(0, 0, 0, 0);
    semanas.push({ ini, fin });
    labels.push(`${String(ini.getDate()).padStart(2,'0')}/${String(ini.getMonth()+1).padStart(2,'0')}`);
  }
  return { labels, semanas };
}
function semanaIndex(fecha, semanas) {
  return semanas.findIndex(s => fecha >= s.ini && fecha <= s.fin);
}

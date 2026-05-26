// Instancias de gráficas para poder destruirlas al recargar
let chartPubsDia    = null;
let chartRegistros  = null;
let chartEngagement = null;

async function loadEstadisticas() {
  try {
    await Promise.all([
      cargarKpisEngagement(),
      cargarGraficaPubsDia(),
      cargarGraficaRegistros(),
      cargarGraficaEngagement(),
      cargarTopComercios(),
      cargarTopPublicaciones(),
    ]);
  } catch (e) {
    console.error('Error cargando estadísticas:', e);
    toast('Error cargando estadísticas', 'error');
  }
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

// ── PUBLICACIONES POR DÍA (últimos 30 días) ──
async function cargarGraficaPubsDia() {
  // Traer todas y filtrar en cliente — evita índices compuestos
  const snap = await db.collection('Publicaciones').get();
  const hace30 = new Date();
  hace30.setDate(hace30.getDate() - 30);

  const mapa = {};
  snap.docs.forEach(doc => {
    const ts = doc.data().timestamp;
    if (!ts) return;
    const d = ts.toDate();
    if (d < hace30) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    mapa[key] = (mapa[key] || 0) + 1;
  });

  const { labels, valores } = generarEjesDias(30, mapa);

  const ctx = document.getElementById('chart-pubs-dia').getContext('2d');
  if (chartPubsDia) chartPubsDia.destroy();
  chartPubsDia = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Publicaciones',
        data: valores,
        backgroundColor: 'rgba(26,107,255,0.15)',
        borderColor: '#1A6BFF',
        borderWidth: 2,
        borderRadius: 4,
      }]
    },
    options: opcionesBase()
  });
}

// ── NUEVOS REGISTROS POR SEMANA (últimas 8 semanas) ──
// Sin filtros en query para evitar necesidad de índices compuestos
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
    // Solo vecinos (rol vecino o sin rol comercio/admin)
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
    data: {
      labels,
      datasets: [
        { label: 'Comercios', data: dataCom, backgroundColor: 'rgba(26,107,255,0.7)', borderRadius: 4 },
        { label: 'Vecinos',   data: dataVec, backgroundColor: 'rgba(255,170,0,0.7)',  borderRadius: 4 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 11 }, padding: 12 } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 } } },
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'DM Sans', size: 10 } }, grid: { color: 'rgba(0,0,0,0.04)' } }
      }
    }
  });
}

// ── VISTAS Y CLICS POR DÍA (últimos 30 días desde stats_diarias) ──
async function cargarGraficaEngagement() {
  const fechas = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    fechas.push(`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`);
  }

  const pubsSnap = await db.collection('Publicaciones').get();
  const mapaVistas = {};
  const mapaClics  = {};

  // Leer stats_diarias de cada publicación sin filtro para evitar índices
  await Promise.all(pubsSnap.docs.map(async pubDoc => {
    const statsSnap = await db.collection('Publicaciones').doc(pubDoc.id)
      .collection('stats_diarias').get();
    statsSnap.docs.forEach(s => {
      if (!fechas.includes(s.id)) return;
      const d = s.data();
      mapaVistas[s.id] = (mapaVistas[s.id] || 0) + (d.vistas || 0);
      mapaClics[s.id]  = (mapaClics[s.id]  || 0) + (d.clics  || 0);
    });
  }));

  const labels = fechas.map(f => `${f.slice(6)}/${f.slice(4,6)}`);
  const vistas = fechas.map(f => mapaVistas[f] || 0);
  const clics  = fechas.map(f => mapaClics[f]  || 0);

  const ctx = document.getElementById('chart-engagement').getContext('2d');
  if (chartEngagement) chartEngagement.destroy();
  chartEngagement = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Vistas', data: vistas, borderColor: '#1A6BFF', backgroundColor: 'rgba(26,107,255,0.08)', borderWidth: 2, pointRadius: 3, tension: 0.3, fill: true },
        { label: 'Clics',  data: clics,  borderColor: '#FFAA00', backgroundColor: 'rgba(255,170,0,0.08)',  borderWidth: 2, pointRadius: 3, tension: 0.3, fill: true },
      ]
    },
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
        <div style="font-size:0.85rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.nombre}</div>
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
        <div style="font-size:0.85rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.titulo || '—'}</div>
        <div style="font-size:0.72rem;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.nombre_comercio || ''}</div>
        <div style="margin-top:4px;height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${Math.round((p.clics||0)/maxC*100)}%;background:var(--orange);border-radius:2px;"></div>
        </div>
      </div>
      <div style="font-size:0.8rem;font-family:'DM Mono',monospace;color:var(--orange);font-weight:600;flex-shrink:0;">${(p.clics||0).toLocaleString('es-ES')}</div>
    </div>`).join('');
}

// ── HELPERS ──
function opcionesBase() {
  return {
    responsive: true,
    maintainAspectRatio: false,
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
  // Normalizar a inicio del día para comparaciones limpias
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

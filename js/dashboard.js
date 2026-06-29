let chartPlanes = null;

async function loadDashboard() {
  try {
    const [comSnap, vecSnap, pubSnap, paramSnap] = await Promise.all([
      db.collection('comercios').get(),
      db.collection('usuarios').where('rol', '==', 'vecino').get(),
      db.collection('Publicaciones').get(),
      db.collection('config').doc('parametros').get(),
    ]);
    const paramData   = paramSnap.data() || {};
    const precioPro   = paramData.precio_plan_pro   || 19.90;
    const precioMulti = paramData.precio_plan_multi  || 15.98;
    const comercios = comSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const free  = comercios.filter(c => (c.plan_suscripcion || 'free') === 'free').length;
    const pro   = comercios.filter(c => c.plan_suscripcion === 'pro').length;
    const multi = comercios.filter(c => c.plan_suscripcion === 'multi').length;

    const ahora = new Date();
    const hace24h = new Date(ahora - 86400000);
    const hace7d  = new Date(ahora - 7 * 86400000);
    const hace30d = new Date(ahora - 30 * 86400000);
    const en7d    = new Date(ahora.getTime() + 7 * 86400000);

    const pubs = pubSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const pubs24h = pubs.filter(p => p.timestamp?.toDate() > hace24h).length;

    const comNuevos7d = comercios.filter(c => c.creado_en?.toDate() > hace7d).length;
    const vecNuevos7d = vecSnap.docs.filter(d => d.data().creado_en?.toDate() > hace7d).length;

    const vencen7d = comercios.filter(c => {
      if (!c.plan_hasta || (c.plan_suscripcion || 'free') === 'free') return false;
      const d = c.plan_hasta.toDate();
      return d > ahora && d <= en7d;
    }).length;

    const activos30dIds = new Set(pubs.filter(p => p.timestamp?.toDate() > hace30d).map(p => p.comercio_id));
    const inactivos30d = comercios.filter(c => !activos30dIds.has(c.id)).length;

    document.getElementById('kpi-comercios').textContent     = comercios.length;
    document.getElementById('kpi-comercios-sub').textContent = `${pro} Pro · ${multi} Multi · ${free} Free`;
    document.getElementById('kpi-vecinos').textContent       = vecSnap.size;
    document.getElementById('kpi-vecinos-sub').textContent   = 'Con cuenta registrada';
    document.getElementById('kpi-pubs').textContent          = pubSnap.size;
    document.getElementById('kpi-pubs-sub').textContent      = 'Total publicaciones';
    document.getElementById('kpi-planes').textContent        = pro + multi;
    document.getElementById('kpi-planes-sub').textContent    = `${pro} Pro · ${multi} Multi-Barrio`;

    document.getElementById('kpi-pubs24h').textContent        = pubs24h;
    document.getElementById('kpi-pubs24h-sub').textContent    = 'Últimas 24 horas';
    document.getElementById('kpi-nuevos7d').textContent       = comNuevos7d + vecNuevos7d;
    document.getElementById('kpi-nuevos7d-sub').textContent   = `${comNuevos7d} comercios · ${vecNuevos7d} vecinos`;
    document.getElementById('kpi-vencen7d').textContent       = vencen7d;
    document.getElementById('kpi-vencen7d-sub').textContent   = vencen7d > 0 ? 'Revisar en finanzas' : 'Sin vencimientos próximos';
    document.getElementById('kpi-inactivos30d').textContent   = inactivos30d;
    document.getElementById('kpi-inactivos30d-sub').textContent = 'Sin publicar en 30+ días';

    // Gráfica dona
    const ctx = document.getElementById('chart-planes').getContext('2d');
    if (chartPlanes) chartPlanes.destroy();
    chartPlanes = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Free', 'Pro', 'Multi-Barrio'],
        datasets: [{ data: [free, pro, multi], backgroundColor: ['#E8ECF4', '#1A6BFF', '#FFAA00'], borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 12 }, padding: 16 } } },
        cutout: '65%'
      }
    });

    // Detalle planes + MRR
    const mrr = (pro * precioPro + multi * precioMulti).toFixed(2);
    document.getElementById('planes-detalle').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--blue-light);border-radius:10px;">
          <span style="font-size:0.85rem;font-weight:500;color:var(--blue)">Escaparate Pro</span>
          <span style="font-size:0.85rem;font-weight:700;color:var(--blue)">${pro} comercios</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--orange-light);border-radius:10px;">
          <span style="font-size:0.85rem;font-weight:500;color:var(--orange)">Multi-Barrio</span>
          <span style="font-size:0.85rem;font-weight:700;color:var(--orange)">${multi} comercios</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--green-light);border-radius:10px;">
          <span style="font-size:0.85rem;font-weight:600;color:var(--green)">MRR estimado</span>
          <span style="font-size:1rem;font-weight:700;color:var(--green)">${mrr} €</span>
        </div>
      </div>`;

    // Recientes comercios
    const recCom = [...comercios].sort((a, b) => (b.creado_en?.seconds || 0) - (a.creado_en?.seconds || 0)).slice(0, 5);
    document.getElementById('recientes-comercios').innerHTML = recCom.map(c => `
      <div class="recent-item">
        <div class="recent-avatar">${(c.nombre_comercio || '?')[0].toUpperCase()}</div>
        <div><div class="recent-name">${c.nombre_comercio || '—'}</div><div class="recent-meta">${c.categoria || ''} · ${c.barrio || ''}</div></div>
        <span class="recent-time">${timeAgo(c.creado_en)}</span>
      </div>`).join('') || '<div class="empty">Sin comercios</div>';

    // Recientes publicaciones
    const pubsRecientes = [...pubs]
      .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)).slice(0, 5);
    document.getElementById('recientes-pubs').innerHTML = pubsRecientes.map(p => `
      <div class="recent-item">
        <div class="recent-avatar" style="background:var(--green-light);color:var(--green)">${(p.nombre_comercio || '?')[0].toUpperCase()}</div>
        <div><div class="recent-name">${p.titulo || '—'}</div><div class="recent-meta">${p.nombre_comercio || ''}</div></div>
        <span class="recent-time">${timeAgo(p.timestamp)}</span>
      </div>`).join('') || '<div class="empty">Sin publicaciones</div>';

  } catch (e) {
    console.error(e);
    toast('Error cargando datos', 'error');
  }
}

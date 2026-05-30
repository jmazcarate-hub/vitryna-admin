let todasPubs   = [];
let diasVidaPub = 7;
let filtroPubs  = 'todas';
let filtroTemporal = 'todas';

async function loadPublicaciones() {
  const el = document.getElementById('tabla-publicaciones');
  el.innerHTML = '<div class="spinner"></div>';
  try {
    const configDoc = await db.collection('config').doc('parametros').get();
    diasVidaPub = configDoc.exists ? (configDoc.data().dias_vida_publicacion || 7) : 7;

    const snap = await db.collection('Publicaciones').orderBy('timestamp', 'desc').limit(500).get();
    todasPubs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPubs();

    if (!document.getElementById('search-pubs')._bound) {
      document.getElementById('search-pubs').addEventListener('input', renderPubs);
      document.getElementById('search-pubs')._bound = true;
      document.querySelectorAll('#filtros-pubs .filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          document.querySelectorAll('#filtros-pubs .filter-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          filtroPubs = chip.dataset.filter;
          renderPubs();
        });
      });
    }
  } catch (e) { el.innerHTML = '<div class="empty">Error cargando publicaciones</div>'; }
}

function esVigente(pub) {
  if (!pub.timestamp) return false;
  const ts = pub.timestamp.toDate ? pub.timestamp.toDate() : new Date(pub.timestamp);
  return (new Date() - ts) / 86400000 < diasVidaPub;
}

function tiempoRelativo(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60)    return 'ahora';
  if (diff < 3600)  return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} días`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400 / 7)} sem`;
  if (diff < 86400 * 365) return `${Math.floor(diff / 86400 / 30)} meses`;
  return `${Math.floor(diff / 86400 / 365)} años`;
}

function renderPubs() {
  const q = document.getElementById('search-pubs').value.toLowerCase();
  const ahora = new Date();
  const hoy   = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const semana = new Date(ahora.getTime() - 7 * 86400000);
  const mes    = new Date(ahora.getTime() - 30 * 86400000);

  const lista = todasPubs.filter(p => {
    const vigente = esVigente(p);
    if (filtroPubs === 'activas'   && !vigente) return false;
    if (filtroPubs === 'caducadas' &&  vigente) return false;
    if (q && !`${p.titulo} ${p.nombre_comercio}`.toLowerCase().includes(q)) return false;

    // Filtro temporal
    if (filtroTemporal !== 'todas') {
      const ts = p.timestamp ? (p.timestamp.toDate ? p.timestamp.toDate() : new Date(p.timestamp)) : null;
      if (!ts) return false;
      if (filtroTemporal === 'hoy'   && ts < hoy)   return false;
      if (filtroTemporal === 'semana' && ts < semana) return false;
      if (filtroTemporal === 'mes'   && ts < mes)   return false;
    }
    return true;
  });

  const el = document.getElementById('tabla-publicaciones');
  if (!lista.length) { el.innerHTML = '<div class="empty">Sin publicaciones con este filtro</div>'; return; }

  const activas   = lista.filter(p => esVigente(p)).length;
  const caducadas = lista.length - activas;

  el.innerHTML = `
    <div style="padding:8px 20px;font-size:0.78rem;color:var(--text-2);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      <span>${lista.length} publicación${lista.length !== 1 ? 'es' : ''}</span>
      <span style="color:var(--green)">● ${activas} activa${activas !== 1 ? 's' : ''}</span>
      <span style="color:var(--text-3)">● ${caducadas} caducada${caducadas !== 1 ? 's' : ''}</span>
      <div style="margin-left:auto;display:flex;gap:6px;">
        ${['todas','hoy','semana','mes'].map(f => `
          <span onclick="setFiltroTemporal('${f}')" id="ft-${f}"
            style="cursor:pointer;padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:500;
            background:${filtroTemporal===f ? 'var(--blue)' : 'var(--bg)'};
            color:${filtroTemporal===f ? 'white' : 'var(--text-2)'};
            border:1px solid ${filtroTemporal===f ? 'var(--blue)' : 'var(--border)'};">
            ${{todas:'Todas',hoy:'Hoy',semana:'7 días',mes:'30 días'}[f]}
          </span>`).join('')}
      </div>
    </div>
    <table>
      <thead><tr><th>Publicación</th><th>Comercio</th><th>Estado</th><th>Publicada</th><th>Vistas</th><th>Clics</th><th></th></tr></thead>
      <tbody>${lista.map(p => {
        const vigente = esVigente(p);
        const badge = vigente
          ? '<span class="badge activo">Activa</span>'
          : '<span class="badge inactivo">Caducada</span>';
        const tiempo = tiempoRelativo(p.timestamp);
        const fechaCompleta = formatDate(p.timestamp);
        return `<tr>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500">${p.titulo || '—'}</td>
          <td style="font-size:0.83rem;color:var(--text-2)">${p.nombre_comercio || '—'}</td>
          <td>${badge}</td>
          <td style="font-size:0.8rem;" title="${fechaCompleta}">${tiempo}</td>
          <td style="font-family:'DM Mono',monospace;font-size:0.8rem">${p.vistas || 0}</td>
          <td style="font-family:'DM Mono',monospace;font-size:0.8rem">${p.clics || 0}</td>
          <td><button class="btn-sm danger" onclick="eliminarPub('${p.id}')">Eliminar</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

function setFiltroTemporal(f) {
  filtroTemporal = f;
  renderPubs();
}

async function eliminarPub(id) {
  if (!confirm('¿Eliminar esta publicación?\n\nSe eliminará la publicación, sus estadísticas y la foto. Esta acción no se puede deshacer.')) return;
  try {
    const fn = firebase.functions();
    fn.region = 'europe-west1';
    const eliminar = firebase.app().functions('europe-west1').httpsCallable('eliminarPublicacionCompleta');
    await eliminar({ publicacionId: id });
    todasPubs = todasPubs.filter(p => p.id !== id);
    renderPubs();
    toast('Publicación eliminada completamente', 'success');
  } catch (e) {
    console.error('Error eliminando publicación:', e);
    toast('Error al eliminar: ' + (e.message || e), 'error');
  }
}

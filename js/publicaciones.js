let todasPubs   = [];
let diasVidaPub = 7;
let filtroPubs  = 'todas';

async function loadPublicaciones() {
  const el = document.getElementById('tabla-publicaciones');
  el.innerHTML = '<div class="spinner"></div>';
  try {
    const configDoc = await db.collection('config').doc('parametros').get();
    diasVidaPub = configDoc.exists ? (configDoc.data().dias_vida_publicacion || 7) : 7;

    const snap = await db.collection('Publicaciones').orderBy('timestamp', 'desc').limit(100).get();
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

function renderPubs() {
  const q = document.getElementById('search-pubs').value.toLowerCase();
  const lista = todasPubs.filter(p => {
    const vigente = esVigente(p);
    if (filtroPubs === 'activas'   && !vigente) return false;
    if (filtroPubs === 'caducadas' &&  vigente) return false;
    if (q && !`${p.titulo} ${p.nombre_comercio}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const el = document.getElementById('tabla-publicaciones');
  if (!lista.length) { el.innerHTML = '<div class="empty">Sin publicaciones con este filtro</div>'; return; }

  const activas   = lista.filter(p => esVigente(p)).length;
  const caducadas = lista.length - activas;

  el.innerHTML = `
    <div style="padding:8px 20px;font-size:0.78rem;color:var(--text-2);border-bottom:1px solid var(--border);display:flex;gap:16px;">
      <span>${lista.length} publicación${lista.length !== 1 ? 'es' : ''}</span>
      <span style="color:var(--green)">● ${activas} activa${activas !== 1 ? 's' : ''}</span>
      <span style="color:var(--text-3)">● ${caducadas} caducada${caducadas !== 1 ? 's' : ''}</span>
    </div>
    <table>
      <thead><tr><th>Publicación</th><th>Comercio</th><th>Estado</th><th>Vistas</th><th>Clics</th><th>Fecha</th><th></th></tr></thead>
      <tbody>${lista.map(p => {
        const vigente = esVigente(p);
        const badge = vigente
          ? '<span class="badge activo">Activa</span>'
          : '<span class="badge inactivo">Caducada</span>';
        return `<tr>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500">${p.titulo || '—'}</td>
          <td style="font-size:0.83rem;color:var(--text-2)">${p.nombre_comercio || '—'}</td>
          <td>${badge}</td>
          <td style="font-family:'DM Mono',monospace;font-size:0.8rem">${p.vistas || 0}</td>
          <td style="font-family:'DM Mono',monospace;font-size:0.8rem">${p.clics || 0}</td>
          <td style="font-size:0.8rem;color:var(--text-2)">${formatDate(p.timestamp)}</td>
          <td><button class="btn-sm danger" onclick="eliminarPub('${p.id}')">Eliminar</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

async function eliminarPub(id) {
  if (!confirm('¿Eliminar esta publicación?')) return;
  try {
    await db.collection('Publicaciones').doc(id).delete();
    todasPubs = todasPubs.filter(p => p.id !== id);
    renderPubs();
    toast('Publicación eliminada', 'success');
  } catch (e) { toast('Error al eliminar', 'error'); }
}

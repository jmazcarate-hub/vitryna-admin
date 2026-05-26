let todasPubs = [];

async function loadPublicaciones() {
  const el = document.getElementById('tabla-publicaciones');
  el.innerHTML = '<div class="spinner"></div>';
  try {
    const snap = await db.collection('Publicaciones').orderBy('timestamp', 'desc').limit(100).get();
    todasPubs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPubs(todasPubs);
    if (!document.getElementById('search-pubs')._bound) {
      document.getElementById('search-pubs').addEventListener('input', function () {
        const q = this.value.toLowerCase();
        renderPubs(q ? todasPubs.filter(p => `${p.titulo} ${p.nombre_comercio}`.toLowerCase().includes(q)) : todasPubs);
      });
      document.getElementById('search-pubs')._bound = true;
    }
  } catch (e) { el.innerHTML = '<div class="empty">Error cargando publicaciones</div>'; }
}

function renderPubs(lista) {
  const el = document.getElementById('tabla-publicaciones');
  if (!lista.length) { el.innerHTML = '<div class="empty">Sin publicaciones</div>'; return; }
  el.innerHTML = `<table>
    <thead><tr><th>Publicación</th><th>Comercio</th><th>Vistas</th><th>Clics</th><th>Fecha</th><th></th></tr></thead>
    <tbody>${lista.map(p => `<tr>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500">${p.titulo || '—'}</td>
      <td style="font-size:0.83rem;color:var(--text-2)">${p.nombre_comercio || '—'}</td>
      <td style="font-family:'DM Mono',monospace;font-size:0.8rem">${p.vistas || 0}</td>
      <td style="font-family:'DM Mono',monospace;font-size:0.8rem">${p.clics || 0}</td>
      <td style="font-size:0.8rem;color:var(--text-2)">${formatDate(p.timestamp)}</td>
      <td><button class="btn-sm danger" onclick="eliminarPub('${p.id}')">Eliminar</button></td>
    </tr>`).join('')}</tbody>
  </table>`;
}

async function eliminarPub(id) {
  if (!confirm('¿Eliminar esta publicación?')) return;
  try {
    await db.collection('Publicaciones').doc(id).delete();
    todasPubs = todasPubs.filter(p => p.id !== id);
    renderPubs(todasPubs);
    toast('Publicación eliminada', 'success');
  } catch (e) { toast('Error al eliminar', 'error'); }
}

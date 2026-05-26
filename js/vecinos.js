async function loadVecinos() {
  const el = document.getElementById('tabla-vecinos');
  el.innerHTML = '<div class="spinner"></div>';
  try {
    const snap = await db.collection('usuarios').where('rol', '==', 'vecino').orderBy('creado_en', 'desc').get();
    const vecinos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!vecinos.length) { el.innerHTML = '<div class="empty">Sin vecinos registrados</div>'; return; }
    el.innerHTML = `<table>
      <thead><tr><th>Email</th><th>Amigos</th><th>Notificaciones</th><th>Registro</th></tr></thead>
      <tbody>${vecinos.map(v => `<tr>
        <td>${v.email || '—'}</td>
        <td>${(v.amigos || []).length}</td>
        <td><span class="badge ${v.fcm_token ? 'activo' : 'inactivo'}">${v.fcm_token ? 'Activo' : 'Sin token'}</span></td>
        <td style="font-size:0.8rem;color:var(--text-2)">${formatDate(v.creado_en)}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  } catch (e) { el.innerHTML = '<div class="empty">Error cargando vecinos</div>'; }
}

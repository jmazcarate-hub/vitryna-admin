async function loadVecinos() {
  const el = document.getElementById('tabla-vecinos');
  el.innerHTML = '<div class="spinner"></div>';
  try {
    // Sin filtros en query para evitar índices compuestos
    // Filtramos en cliente: excluimos comercios y admins
    const snap = await db.collection('usuarios').get();
    const vecinos = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(v => v.rol !== 'comercio' && v.rol !== 'admin')
      .sort((a, b) => (b.creado_en?.seconds || 0) - (a.creado_en?.seconds || 0));

    if (!vecinos.length) { el.innerHTML = '<div class="empty">Sin vecinos registrados</div>'; return; }

    el.innerHTML = `
      <div style="padding:8px 20px;font-size:0.78rem;color:var(--text-2);border-bottom:1px solid var(--border);">
        ${vecinos.length} vecino${vecinos.length !== 1 ? 's' : ''} registrado${vecinos.length !== 1 ? 's' : ''}
      </div>
      <table>
        <thead><tr><th>Email</th><th>Amigos</th><th>Notificaciones</th><th>Registro</th></tr></thead>
        <tbody>${vecinos.map(v => `<tr>
          <td>${v.email || '—'}</td>
          <td>${(v.amigos || []).length}</td>
          <td><span class="badge ${v.fcm_token ? 'activo' : 'inactivo'}">${v.fcm_token ? 'Activo' : 'Sin token'}</span></td>
          <td style="font-size:0.8rem;color:var(--text-2)">${formatDate(v.creado_en)}</td>
        </tr>`).join('')}</tbody>
      </table>`;
  } catch (e) {
    console.error('Error vecinos:', e);
    el.innerHTML = '<div class="empty">Error cargando vecinos</div>';
  }
}

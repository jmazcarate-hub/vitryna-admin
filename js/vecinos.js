async function loadVecinos() {
  const el = document.getElementById('tabla-vecinos');
  el.innerHTML = '<div class="spinner"></div>';
  try {
    const snap = await db.collection('usuarios').get();
    const vecinos = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(v => v.rol !== 'comercio' && v.rol !== 'admin')
      .sort((a, b) => (b.creado_en?.seconds || 0) - (a.creado_en?.seconds || 0));

    if (!vecinos.length) { el.innerHTML = '<div class="empty">Sin vecinos registrados</div>'; return; }

    const conToken = vecinos.filter(v => v.fcm_token).length;

    el.innerHTML = `
      <div style="padding:8px 20px;font-size:0.78rem;color:var(--text-2);border-bottom:1px solid var(--border);display:flex;gap:16px;">
        <span>${vecinos.length} vecino${vecinos.length !== 1 ? 's' : ''} registrado${vecinos.length !== 1 ? 's' : ''}</span>
        <span style="color:var(--green)">● ${conToken} con notificaciones activas</span>
      </div>
      <table>
        <thead><tr><th>Email</th><th>Amigos</th><th>Notificaciones push</th><th>Registro</th></tr></thead>
        <tbody>${vecinos.map(v => `<tr>
          <td>${v.email || '—'}</td>
          <td>${(v.amigos || []).length}</td>
          <td>${v.fcm_token
            ? '<span class="badge activo">Activas</span>'
            : '<span class="badge free">Sin token</span>'
          }</td>
          <td style="font-size:0.8rem;color:var(--text-2)">${formatDate(v.creado_en)}</td>
        </tr>`).join('')}</tbody>
      </table>`;
  } catch (e) {
    console.error('Error vecinos:', e);
    el.innerHTML = '<div class="empty">Error cargando vecinos</div>';
  }
}

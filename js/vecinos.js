const VECINOS_LIMITE = 500;

async function loadVecinos() {
  const el = document.getElementById('tabla-vecinos');
  el.innerHTML = '<div class="spinner"></div>';
  try {
    // Índice compuesto requerido en Firestore: usuarios → rol ASC + creado_en DESC
    const snap = await db.collection('usuarios')
      .where('rol', '==', 'vecino')
      .orderBy('creado_en', 'desc')
      .limit(VECINOS_LIMITE)
      .get();

    const registrados = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(v => v.email);

    const hayMas = snap.size === VECINOS_LIMITE;

    el.innerHTML = `
      <div style="padding:8px 20px;font-size:0.78rem;color:var(--text-2);border-bottom:1px solid var(--border);">
        <span>${registrados.length} vecino${registrados.length !== 1 ? 's' : ''}${hayMas ? ` (mostrando los ${VECINOS_LIMITE} más recientes)` : ''}</span>
      </div>
      ${registrados.length === 0 ? '<div class="empty">Sin vecinos registrados</div>' : `
      <table>
        <thead><tr><th>Email</th><th>Amigos</th><th>Notificaciones push</th><th>Registro</th><th></th></tr></thead>
        <tbody>${registrados.map(v => `<tr>
          <td>${v.email}</td>
          <td>${(v.amigos || []).length}</td>
          <td>${v.fcm_token
            ? '<span class="badge activo">Activas</span>'
            : '<span class="badge free">Sin token</span>'
          }</td>
          <td style="font-size:0.8rem;color:var(--text-2)">${formatDate(v.creado_en)}</td>
          <td><button class="btn-sm danger" onclick="eliminarVecino('${v.id}','${v.email}')">Eliminar</button></td>
        </tr>`).join('')}</tbody>
      </table>`}`;
  } catch (e) {
    console.error('Error vecinos:', e);
    el.innerHTML = '<div class="empty">Error cargando vecinos</div>';
  }
}

async function eliminarVecino(uid, email) {
  if (!confirm(`¿Eliminar el vecino "${email}"?\n\nSe eliminará su cuenta, sus datos y se quitará de la lista de amigos de los comercios que seguía. Esta acción no se puede deshacer.`)) return;
  try {
    const fn = firebase.app().functions('europe-west1').httpsCallable('eliminarVecinoCompleto');
    await fn({ vecinoId: uid });
    toast('Vecino eliminado correctamente', 'success');
    loadVecinos();
  } catch (e) {
    console.error('Error eliminando vecino:', e);
    toast('Error al eliminar: ' + (e.message || e), 'error');
  }
}

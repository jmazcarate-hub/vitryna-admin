const VECINOS_POR_PAGINA = 50;

// Pila de cursores: [undefined, doc1, doc2, ...] donde undefined = primera página
let _vecinosCursores = [undefined];
let _vecinosPagina   = 0;

async function loadVecinos(pagina = 0) {
  _vecinosPagina = pagina;
  const el = document.getElementById('tabla-vecinos');
  el.innerHTML = '<div class="spinner"></div>';
  try {
    // Índice compuesto en Firestore: usuarios → rol ASC + creado_en DESC
    let query = db.collection('usuarios')
      .where('rol', '==', 'vecino')
      .orderBy('creado_en', 'desc')
      .limit(VECINOS_POR_PAGINA + 1); // +1 para detectar si hay página siguiente

    const cursor = _vecinosCursores[pagina];
    if (cursor) query = query.startAfter(cursor);

    const snap = await query.get();
    const haysiguiente = snap.size > VECINOS_POR_PAGINA;
    const docs = haysiguiente ? snap.docs.slice(0, VECINOS_POR_PAGINA) : snap.docs;

    // Guardar cursor de la siguiente página
    if (haysiguiente) {
      _vecinosCursores[pagina + 1] = docs[docs.length - 1];
    } else {
      _vecinosCursores = _vecinosCursores.slice(0, pagina + 1); // descartar páginas inválidas
    }

    const vecinos = docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(v => v.email);

    const desde = pagina * VECINOS_POR_PAGINA + 1;
    const hasta = desde + vecinos.length - 1;

    el.innerHTML = `
      <div style="padding:8px 20px;display:flex;justify-content:space-between;align-items:center;font-size:0.78rem;color:var(--text-2);border-bottom:1px solid var(--border);">
        <span>${vecinos.length === 0 ? 'Sin vecinos' : `Vecinos ${desde}–${hasta}`}</span>
        <div style="display:flex;gap:8px;">
          <button class="btn-sm" onclick="loadVecinos(${pagina - 1})" ${pagina === 0 ? 'disabled' : ''}>← Anterior</button>
          <button class="btn-sm" onclick="loadVecinos(${pagina + 1})" ${!haysiguiente ? 'disabled' : ''}>Siguiente →</button>
        </div>
      </div>
      ${vecinos.length === 0
        ? '<div class="empty">Sin vecinos registrados</div>'
        : `<table>
        <thead><tr><th>Email</th><th>Amigos</th><th>Notificaciones push</th><th>Registro</th><th></th></tr></thead>
        <tbody>${vecinos.map(v => `<tr>
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
    // Resetear cursores y volver a la primera página
    _vecinosCursores = [undefined];
    loadVecinos(0);
  } catch (e) {
    console.error('Error eliminando vecino:', e);
    toast('Error al eliminar: ' + (e.message || e), 'error');
  }
}

const VECINOS_POR_PAGINA = 50;

// Pila de cursores: [undefined, doc1, doc2, ...] donde undefined = primera página
let _vecinosCursores = [undefined];
let _vecinosPagina   = 0;
let _vecinosActuales = []; // cache de la página actual, para no meter el email en el onclick
let filtroVec = 'todos';

function badgeSinVerificar(v) {
  if (v.email_verificado !== false) return '';
  return `<div style="margin-top:4px;"><span style="font-size:0.7rem;padding:2px 6px;border-radius:4px;background:var(--red-light);color:var(--red);font-weight:600;">Sin verificar · ${timeAgo(v.verificacion_email_enviado_en || v.creado_en)}</span></div>`;
}

async function loadVecinos(pagina = 0) {
  if (filtroVec === 'sin-verificar') return loadVecinosSinVerificar();

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
    _vecinosActuales = vecinos;

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
          <td>${escapeHtml(v.email)}${badgeSinVerificar(v)}</td>
          <td>${(v.amigos || []).length}</td>
          <td>${v.fcm_token
            ? '<span class="badge activo">Activas</span>'
            : '<span class="badge free">Sin token</span>'
          }</td>
          <td style="font-size:0.8rem;color:var(--text-2)">${formatDate(v.creado_en)}</td>
          <td><button class="btn-sm danger" onclick="eliminarVecino('${v.id}')">Eliminar</button></td>
        </tr>`).join('')}</tbody>
      </table>`}`;
  } catch (e) {
    console.error('Error vecinos:', e);
    el.innerHTML = '<div class="empty">Error cargando vecinos</div>';
  }

  if (!document.getElementById('filtros-vecinos')._bound) {
    document.getElementById('filtros-vecinos')._bound = true;
    document.querySelectorAll('#filtros-vecinos .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#filtros-vecinos .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        filtroVec = chip.dataset.filter;
        if (filtroVec === 'sin-verificar') {
          loadVecinosSinVerificar();
        } else {
          _vecinosCursores = [undefined];
          loadVecinos(0);
        }
      });
    });
  }
}

// Vista dedicada, sin paginación (volumen bajo esperado): dos filtros de
// igualdad (rol + email_verificado) no necesitan índice compuesto en
// Firestore -- solo orderBy combinado con un where en otro campo lo
// exigiría, así que se ordena en JS tras traer el resultado.
async function loadVecinosSinVerificar() {
  const el = document.getElementById('tabla-vecinos');
  el.innerHTML = '<div class="spinner"></div>';
  try {
    const snap = await db.collection('usuarios')
      .where('rol', '==', 'vecino')
      .where('email_verificado', '==', false)
      .get();

    const vecinos = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(v => v.email)
      .sort((a, b) => (b.creado_en?.toMillis?.() || 0) - (a.creado_en?.toMillis?.() || 0));
    _vecinosActuales = vecinos;

    el.innerHTML = `
      <div style="padding:8px 20px;font-size:0.78rem;color:var(--text-2);border-bottom:1px solid var(--border);">
        ${vecinos.length} vecino${vecinos.length !== 1 ? 's' : ''} sin verificar
      </div>
      ${vecinos.length === 0
        ? '<div class="empty">Ningún vecino pendiente de verificar</div>'
        : `<table>
        <thead><tr><th>Email</th><th>Amigos</th><th>Email enviado hace</th><th>Registro</th><th></th></tr></thead>
        <tbody>${vecinos.map(v => `<tr>
          <td>${escapeHtml(v.email)}</td>
          <td>${(v.amigos || []).length}</td>
          <td style="color:var(--red);font-weight:600;">${timeAgo(v.verificacion_email_enviado_en || v.creado_en)}</td>
          <td style="font-size:0.8rem;color:var(--text-2)">${formatDate(v.creado_en)}</td>
          <td><button class="btn-sm danger" onclick="eliminarVecino('${v.id}')">Eliminar</button></td>
        </tr>`).join('')}</tbody>
      </table>`}`;
  } catch (e) {
    console.error('Error vecinos sin verificar:', e);
    el.innerHTML = '<div class="empty">Error cargando vecinos</div>';
  }
}

async function eliminarVecino(uid) {
  const email = _vecinosActuales.find(v => v.id === uid)?.email || '';
  if (!confirm(`¿Eliminar el vecino "${email}"?\n\nSe eliminará su cuenta, sus datos y se quitará de la lista de amigos de los comercios que seguía. Esta acción no se puede deshacer.`)) return;
  try {
    const fn = firebase.app().functions('europe-west1').httpsCallable('eliminarVecinoCompleto');
    await fn({ vecinoId: uid });
    toast('Vecino eliminado correctamente', 'success');
    if (filtroVec === 'sin-verificar') {
      loadVecinosSinVerificar();
    } else {
      // Resetear cursores y volver a la primera página
      _vecinosCursores = [undefined];
      loadVecinos(0);
    }
  } catch (e) {
    console.error('Error eliminando vecino:', e);
    toast('Error al eliminar: ' + (e.message || e), 'error');
  }
}

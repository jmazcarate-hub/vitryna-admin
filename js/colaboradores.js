let todosColabs = [];
let colabEditId = null;
const nivelNombre = { 1: 'Institucional', 2: 'Asociativo', 3: 'Vecinal', 4: 'Privado' };

async function loadColaboradores() {
  document.getElementById('contenedor-colaboradores').innerHTML = '<div class="spinner"></div>';
  try {
    const snap = await db.collection('colaboradores').orderBy('nivel').get();
    todosColabs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderColabs();
    if (!document.getElementById('btn-nuevo-colaborador')._bound) {
      document.getElementById('btn-nuevo-colaborador').addEventListener('click', abrirModalColabNuevo);
      document.getElementById('btn-nuevo-colaborador')._bound = true;
    }
  } catch (e) {
    document.getElementById('contenedor-colaboradores').innerHTML = '<div class="empty">Error cargando colaboradores</div>';
  }
}

function renderColabs() {
  const el = document.getElementById('contenedor-colaboradores');
  if (!todosColabs.length) {
    el.innerHTML = '<div class="empty">Sin colaboradores todavía.<br>Añade el primero con el botón de arriba.</div>';
    return;
  }
  el.innerHTML = `<div class="colab-grid">${todosColabs.map(c => {
    const nivel  = parseInt(c.nivel) || 1;
    const activo = c.activo !== false;
    return `<div class="colab-card">
      <div class="colab-header">
        <div class="colab-logo-box">
          ${c.logo_url ? `<img src="${c.logo_url}" alt="${c.nombre}" onerror="this.parentElement.textContent='🏢'">` : '🏢'}
        </div>
        <div>
          <div class="colab-name">${c.nombre || '—'}</div>
          <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;">
            <span class="badge nivel-${nivel}">Nivel ${nivel} · ${nivelNombre[nivel] || ''}</span>
            <span class="badge ${activo ? 'activo' : 'inactivo'}">${activo ? 'Activo' : 'Inactivo'}</span>
          </div>
        </div>
      </div>
      ${c.descripcion ? `<div class="colab-desc">${c.descripcion}</div>` : ''}
      ${c.web ? `<a href="${c.web}" target="_blank" rel="noopener" style="font-size:0.75rem;color:var(--blue);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block">${c.web}</a>` : ''}
      <div style="font-size:0.72rem;color:var(--text-3)">Alta: ${formatDate(c.creado_en)}</div>
      <div class="colab-actions">
        <button class="btn-sm" style="flex:1" onclick="abrirModalColabEditar('${c.id}')">Editar</button>
        <button class="btn-sm danger" onclick="eliminarColab('${c.id}','${(c.nombre || '').replace(/'/g, "\\'")}')">Eliminar</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function abrirModalColabNuevo() {
  colabEditId = null;
  document.getElementById('modal-colab-titulo').textContent = 'Nuevo colaborador';
  ['colab-nombre', 'colab-logo', 'colab-desc', 'colab-web'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('colab-nivel').value  = '1';
  document.getElementById('colab-activo').value = 'true';
  document.getElementById('modal-colaborador').classList.add('open');
}

function abrirModalColabEditar(id) {
  const c = todosColabs.find(x => x.id === id);
  if (!c) return;
  colabEditId = id;
  document.getElementById('modal-colab-titulo').textContent = 'Editar colaborador';
  document.getElementById('colab-nombre').value = c.nombre || '';
  document.getElementById('colab-nivel').value  = String(c.nivel || 1);
  document.getElementById('colab-activo').value = String(c.activo !== false);
  document.getElementById('colab-logo').value   = c.logo_url || '';
  document.getElementById('colab-desc').value   = c.descripcion || '';
  document.getElementById('colab-web').value    = c.web || '';
  document.getElementById('modal-colaborador').classList.add('open');
}

function cerrarModalColab() {
  document.getElementById('modal-colaborador').classList.remove('open');
  colabEditId = null;
}

async function guardarColaborador() {
  const nombre = document.getElementById('colab-nombre').value.trim();
  if (!nombre) { toast('El nombre es obligatorio', 'error'); return; }
  const btn = document.getElementById('btn-guardar-colab');
  btn.textContent = 'Guardando...'; btn.disabled = true;
  try {
    const datos = {
      nombre,
      nivel:       parseInt(document.getElementById('colab-nivel').value),
      activo:      document.getElementById('colab-activo').value === 'true',
      logo_url:    document.getElementById('colab-logo').value.trim(),
      descripcion: document.getElementById('colab-desc').value.trim(),
      web:         document.getElementById('colab-web').value.trim(),
    };
    if (colabEditId) {
      await db.collection('colaboradores').doc(colabEditId).update(datos);
      const idx = todosColabs.findIndex(c => c.id === colabEditId);
      if (idx >= 0) todosColabs[idx] = { ...todosColabs[idx], ...datos };
      toast('Colaborador actualizado', 'success');
    } else {
      datos.creado_en = firebase.firestore.FieldValue.serverTimestamp();
      const ref = await db.collection('colaboradores').add(datos);
      todosColabs.push({ id: ref.id, ...datos, creado_en: null });
      toast('Colaborador creado', 'success');
    }
    cerrarModalColab();
    renderColabs();
  } catch (e) { toast('Error al guardar', 'error'); }
  finally { btn.textContent = 'Guardar'; btn.disabled = false; }
}

async function eliminarColab(id, nombre) {
  if (!confirm(`¿Eliminar el colaborador "${nombre}"?`)) return;
  try {
    await db.collection('colaboradores').doc(id).delete();
    todosColabs = todosColabs.filter(c => c.id !== id);
    renderColabs();
    toast('Colaborador eliminado', 'success');
  } catch (e) { toast('Error al eliminar', 'error'); }
}

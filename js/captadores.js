let todosCaptadores = [];
let todasCaptaciones = [];
let filtroCaptaciones = 'todos';
let captadorEditId = null;

async function loadCaptadores() {
  await Promise.all([cargarRosterCaptadores(), cargarCaptaciones(), cargarConfigCaptadores()]);

  if (!document.getElementById('search-captaciones')._bound) {
    document.getElementById('search-captaciones')._bound = true;
    document.getElementById('search-captaciones').addEventListener('input', renderCaptaciones);
    document.querySelectorAll('#filtros-captaciones .filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#filtros-captaciones .filter-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        filtroCaptaciones = chip.dataset.filter;
        renderCaptaciones();
      });
    });
    document.getElementById('btn-nuevo-captador').addEventListener('click', () => abrirModalCaptador(null));
    document.getElementById('btn-guardar-captador').addEventListener('click', guardarCaptador);
    document.getElementById('btn-sortear').addEventListener('click', ejecutarSorteo);
  }
}

// ── ROSTER DE CAPTADORES ──────────────────────────────────────────────────
async function cargarRosterCaptadores() {
  const el = document.getElementById('tabla-captadores');
  try {
    const snap = await db.collection('captadores').orderBy('creado_en', 'desc').get();
    // pin_hash/pin_salt existen en el doc (el admin tiene acceso vía la regla
    // comodín) pero nunca se leen aquí -- no hace falta mostrarlos ni tiene
    // sentido exponerlos en el DOM.
    todosCaptadores = snap.docs.map((d) => ({
      id: d.id, nombre: d.data().nombre, puesto: d.data().puesto,
      activo: d.data().activo, resumen_hoy: d.data().resumen_hoy,
    }));
    renderRosterCaptadores();
  } catch (e) {
    el.innerHTML = '<div class="empty">Error cargando captadores</div>';
  }
}

function renderRosterCaptadores() {
  const el = document.getElementById('tabla-captadores');
  if (!todosCaptadores.length) { el.innerHTML = '<div class="empty">Sin captadores dados de alta todavía</div>'; return; }
  el.innerHTML = `
    <table>
      <thead><tr><th>Nombre</th><th>Puesto</th><th style="text-align:center;">Estado</th><th style="text-align:center;">Hoy</th><th>Acciones</th></tr></thead>
      <tbody>${todosCaptadores.map((c) => `<tr>
        <td style="font-weight:500">${escapeHtml(c.nombre)}</td>
        <td style="color:var(--text-2);font-size:0.85rem">${escapeHtml(c.puesto) || '—'}</td>
        <td style="text-align:center;">
          <span class="badge ${c.activo ? 'activo' : 'free'}" style="cursor:pointer;" onclick="toggleActivoCaptador('${c.id}', ${!c.activo})">
            ${c.activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td style="text-align:center;font-size:0.85rem;">${c.resumen_hoy?.emails_hoy ?? 0} emails · ${c.resumen_hoy?.vecinos_confirmados_hoy ?? 0} conf.</td>
        <td>
          <button class="btn-sm" onclick="abrirModalCaptador('${c.id}')">Editar</button>
          <button class="btn-sm" onclick="resetPinCaptadorUI('${c.id}')">Resetear PIN</button>
        </td>
      </tr>`).join('')}</tbody>
    </table>`;
}

async function toggleActivoCaptador(id, nuevoValor) {
  try {
    await db.collection('captadores').doc(id).update({ activo: nuevoValor });
    toast(nuevoValor ? 'Captador activado' : 'Captador desactivado', 'success');
    cargarRosterCaptadores();
  } catch (e) {
    toast('Error al cambiar el estado: ' + (e.message || e), 'error');
  }
}

function abrirModalCaptador(id) {
  captadorEditId = id;
  const c = id ? todosCaptadores.find((x) => x.id === id) : null;
  document.getElementById('modal-captador-titulo').textContent = c ? 'Editar captador' : 'Nuevo captador';
  document.getElementById('mc-nombre').value = c?.nombre || '';
  document.getElementById('mc-puesto').value = c?.puesto || '';
  document.getElementById('mc-pin').value = '';
  document.getElementById('mc-pin-label').textContent = c ? 'Nuevo PIN (4 dígitos, opcional)' : 'PIN (4 dígitos) *';
  document.getElementById('mc-pin-nota').textContent = c ? 'Déjalo en blanco para no cambiar el PIN actual.' : '';
  document.getElementById('modal-captador').classList.add('open');
}
function cerrarModalCaptador() {
  document.getElementById('modal-captador').classList.remove('open');
  captadorEditId = null;
}

async function guardarCaptador() {
  const nombre = document.getElementById('mc-nombre').value.trim();
  const puesto = document.getElementById('mc-puesto').value.trim();
  const pin = document.getElementById('mc-pin').value.trim();

  if (!nombre) { toast('El nombre es obligatorio', 'error'); return; }

  try {
    if (captadorEditId) {
      // Nombre/puesto se editan directamente (el admin ya tiene acceso vía
      // la regla comodín); el PIN, si se rellena, pasa siempre por la Cloud
      // Function -- el hash nunca se calcula en el cliente.
      await db.collection('captadores').doc(captadorEditId).update({ nombre, puesto });
      if (pin) {
        if (!/^\d{4}$/.test(pin)) { toast('El PIN debe tener 4 dígitos', 'error'); return; }
        const fn = firebase.app().functions('europe-west1').httpsCallable('resetPinCaptador');
        await fn({ captadorId: captadorEditId, pin });
      }
      toast('Captador actualizado', 'success');
    } else {
      if (!/^\d{4}$/.test(pin)) { toast('El PIN debe tener 4 dígitos', 'error'); return; }
      const fn = firebase.app().functions('europe-west1').httpsCallable('crearCaptador');
      await fn({ nombre, puesto, pin });
      toast('Captador creado', 'success');
    }
    cerrarModalCaptador();
    cargarRosterCaptadores();
  } catch (e) {
    toast('Error al guardar: ' + (e.message || e), 'error');
  }
}

async function resetPinCaptadorUI(id) {
  const pin = prompt('Nuevo PIN de 4 dígitos:');
  if (pin === null) return;
  if (!/^\d{4}$/.test(pin)) { toast('El PIN debe tener 4 dígitos', 'error'); return; }
  try {
    const fn = firebase.app().functions('europe-west1').httpsCallable('resetPinCaptador');
    await fn({ captadorId: id, pin });
    toast('PIN reiniciado', 'success');
  } catch (e) {
    toast('Error al resetear el PIN: ' + (e.message || e), 'error');
  }
}

// ── CAPTACIONES (emails recogidos) ────────────────────────────────────────
async function cargarCaptaciones() {
  const el = document.getElementById('tabla-captaciones');
  try {
    const snap = await db.collection('captaciones').orderBy('fecha_registro', 'desc').limit(500).get();
    todasCaptaciones = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCaptaciones();
  } catch (e) {
    el.innerHTML = '<div class="empty">Error cargando captaciones</div>';
  }
}

function nombreCaptador(id) {
  return todosCaptadores.find((c) => c.id === id)?.nombre || id;
}

const MOTIVOS_SOSPECHA_TEXTO = {
  distancia_alta: 'Distancia captador↔alta alta',
  fuera_de_horario: 'Alta fuera del horario del turno',
  cuenta_previa_a_captacion: 'La cuenta ya existía antes de la captación',
};
function motivosSospechaHtml(match) {
  const motivos = match?.motivos_sospecha || [];
  if (motivos.length === 0) return '';
  const texto = motivos.map((m) => MOTIVOS_SOSPECHA_TEXTO[m] || m).join(' · ');
  return `<span style="font-size:0.72rem;padding:2px 6px;border-radius:4px;background:var(--red-light);color:var(--red);font-weight:600;" title="${escapeHtml(texto)}">${escapeHtml(texto)}</span>`;
}

function renderCaptaciones() {
  const q = (document.getElementById('search-captaciones').value || '').toLowerCase();
  const lista = todasCaptaciones.filter((c) => {
    const match = c.vitryna_match;
    if (filtroCaptaciones === 'confirmados' && !(match && match.amigos_count >= 1)) return false;
    if (filtroCaptaciones === 'pendientes' && match) return false;
    if (filtroCaptaciones === 'sospechoso' && !match?.sospechoso) return false;
    if (q && !c.email.toLowerCase().includes(q)) return false;
    return true;
  });

  const el = document.getElementById('tabla-captaciones');
  if (!lista.length) { el.innerHTML = '<div class="empty">Sin resultados</div>'; return; }

  el.innerHTML = `
    <div style="padding:8px 20px;font-size:0.78rem;color:var(--text-2);border-bottom:1px solid var(--border);">
      ${lista.length} de ${todasCaptaciones.length} captaciones (últimas 500)
    </div>
    <table>
      <thead><tr><th>Email</th><th>Captador</th><th>Registrado</th><th>Vecino real</th><th style="text-align:center;">Amigos</th><th>Aviso</th></tr></thead>
      <tbody>${lista.map((c) => {
        const m = c.vitryna_match;
        const estado = !m
          ? '<span class="badge free">Sin cuenta todavía</span>'
          : m.email_verificado
            ? '<span class="badge activo">Confirmado</span>'
            : '<span class="badge free">Sin verificar email</span>';
        return `<tr>
          <td>${escapeHtml(c.email)}</td>
          <td style="font-size:0.85rem;">${escapeHtml(nombreCaptador(c.captador_id))}</td>
          <td style="font-size:0.8rem;color:var(--text-2)">${formatDate(c.fecha_registro)}</td>
          <td>${estado}</td>
          <td style="text-align:center;">${m ? m.amigos_count : '—'}</td>
          <td>${motivosSospechaHtml(m)}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

// ── PARÁMETROS DE LA CAMPAÑA ───────────────────────────────────────────────
async function cargarConfigCaptadores() {
  const el = document.getElementById('captadores-config');
  try {
    // config/captadores, NUNCA la colección suelta 'parametros' (huérfana,
    // ver CLAUDE.md) -- la configuración real vive bajo config/{doc}.
    const doc = await db.collection('config').doc('captadores').get();
    const d = doc.data() || {};
    el.innerHTML = `
      <div style="font-size:0.78rem;color:var(--text-3);margin-bottom:14px;">
        El aviso de "fuera de horario" se calcula contra el turno real de cada captador (hora a la que abrió/cerró sesión), no contra un horario fijo aquí.
      </div>
      <div class="field-row">
        <div class="field-group"><label>Distancia sospechosa (metros)</label><input type="number" id="cc-distancia" value="${d.distancia_sospechosa_m ?? 2000}"></div>
        <div class="field-group"><label>Tarifa por hora (€)</label><input type="number" step="0.01" id="cc-tarifa-hora" value="${d.tarifa_hora ?? 0}"></div>
      </div>
      <div class="field-row">
        <div class="field-group"><label>Prima por vecino con 1+ amigo (€)</label><input type="number" step="0.01" id="cc-variable" value="${d.comision_variable_1_amigo ?? 0}"></div>
        <div class="field-group"><label>Bono por 2+ amigos (€)</label><input type="number" step="0.01" id="cc-bono" value="${d.bono_2_amigos ?? 0}"></div>
      </div>
      <button class="btn-primary" id="btn-guardar-config-captadores" style="margin-top:8px;">Guardar parámetros</button>
    `;
    document.getElementById('btn-guardar-config-captadores').addEventListener('click', guardarConfigCaptadores);
  } catch (e) {
    el.innerHTML = '<div class="empty">Error cargando parámetros</div>';
  }
}

async function guardarConfigCaptadores() {
  try {
    await db.collection('config').doc('captadores').set({
      distancia_sospechosa_m: Number(document.getElementById('cc-distancia').value) || 0,
      tarifa_hora: Number(document.getElementById('cc-tarifa-hora').value) || 0,
      comision_variable_1_amigo: Number(document.getElementById('cc-variable').value) || 0,
      bono_2_amigos: Number(document.getElementById('cc-bono').value) || 0,
    }, { merge: true });
    toast('Parámetros guardados', 'success');
  } catch (e) {
    toast('Error al guardar: ' + (e.message || e), 'error');
  }
}

// ── SORTEO ─────────────────────────────────────────────────────────────────
async function ejecutarSorteo() {
  if (!confirm('¿Ejecutar el sorteo ahora? Se elegirá un ganador entre todos los emails registrados.')) return;
  const el = document.getElementById('sorteo-resultado');
  el.textContent = 'Sorteando...';
  try {
    const fn = firebase.app().functions('europe-west1').httpsCallable('sortearGanador');
    const res = await fn({ numGanadores: 1 });
    const ganador = res.data.ganadores[0];
    el.innerHTML = `Ganador: <strong>${escapeHtml(ganador.email)}</strong> (captado por ${escapeHtml(nombreCaptador(ganador.captador_id))}) — de ${res.data.total_participantes} participantes.`;
  } catch (e) {
    el.textContent = 'Error al sortear: ' + (e.message || e);
  }
}

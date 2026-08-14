let todosCaptadores = [];
let todasCaptaciones = [];
let filtroCaptaciones = 'todos';
let filtroCaptadorId = '';
let captadorEditId = null;

async function loadCaptadores() {
  // El roster tiene que estar cargado ANTES de que cargarCaptaciones()
  // pinte la tabla (nombreCaptador() lee todosCaptadores) -- si se lanzan
  // los tres en paralelo con Promise.all, cargarCaptaciones() puede
  // terminar y renderizar antes de que el roster esté listo, y la columna
  // Captador muestra el id en bruto en vez del nombre. Bug real detectado
  // el 14/08/2026 probando con un captador recién creado.
  await cargarRosterCaptadores();
  await Promise.all([cargarCaptaciones(), cargarConfigCaptadores()]);
  renderFiltroCaptadorSelect();

  if (!document.getElementById('search-captaciones')._bound) {
    document.getElementById('search-captaciones')._bound = true;
    document.getElementById('search-captaciones').addEventListener('input', renderCaptaciones);
    document.getElementById('filtro-captador-captaciones').addEventListener('change', (e) => {
      filtroCaptadorId = e.target.value;
      renderCaptaciones();
    });
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
    document.getElementById('btn-recalcular-captaciones').addEventListener('click', recalcularCaptacionesUI);
  }
}

// Repoblar en cada loadCaptadores (no solo la primera vez) -- captadores
// nuevos dados de alta deben aparecer en el selector sin recargar la página.
function renderFiltroCaptadorSelect() {
  const select = document.getElementById('filtro-captador-captaciones');
  const valorPrevio = select.value;
  select.innerHTML = '<option value="">Todos los captadores</option>' +
    todosCaptadores.map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
  if (todosCaptadores.some((c) => c.id === valorPrevio)) select.value = valorPrevio;
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
        <td style="font-weight:500">${c.nombre ? escapeHtml(c.nombre) : '<span style="color:var(--text-2);font-style:italic;">(sin nombre — id ' + escapeHtml(c.id) + ')</span>'}</td>
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
          <button class="btn-sm" onclick="eliminarCaptadorUI('${c.id}', '${escapeHtml(c.nombre || c.id)}')">Eliminar</button>
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
  const btn = document.getElementById('btn-guardar-captador');
  // Guarda contra doble-click: sin esto, un doble-click antes de que la
  // primera llamada resuelva dispara crearCaptador() dos veces (dos
  // captadores duplicados en el roster, cada uno con su propio id).
  if (btn.disabled) return;
  const nombre = document.getElementById('mc-nombre').value.trim();
  const puesto = document.getElementById('mc-puesto').value.trim();
  const pin = document.getElementById('mc-pin').value.trim();

  if (!nombre) { toast('El nombre es obligatorio', 'error'); return; }

  btn.disabled = true;
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
  } finally {
    btn.disabled = false;
  }
}

async function eliminarCaptadorUI(id, nombre) {
  if (!confirm(`¿Borrar al captador "${nombre}"? Esto no afecta a los emails que ya haya captado, solo elimina su acceso y su sesión de turno.`)) return;
  try {
    const fn = firebase.app().functions('europe-west1').httpsCallable('eliminarCaptador');
    await fn({ captadorId: id });
    toast('Captador eliminado', 'success');
    cargarRosterCaptadores();
  } catch (e) {
    toast('Error al eliminar: ' + (e.message || e), 'error');
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

// El cruce con los vecinos reales (procesarCaptaciones) solo corre cada 15
// min por defecto -- sin esto, tras dar de alta datos de prueba habría que
// esperar hasta un cuarto de hora para ver el resultado en el panel. Como
// admin, recalcularAhora() procesa TODAS las captaciones (no solo las de
// un captador), a diferencia de cómo la llama la propia web de captadores.
async function recalcularCaptacionesUI() {
  const btn = document.getElementById('btn-recalcular-captaciones');
  btn.disabled = true;
  btn.textContent = 'Recalculando...';
  try {
    const fn = firebase.app().functions('europe-west1').httpsCallable('recalcularAhora');
    await fn();
    await cargarCaptaciones();
    await cargarRosterCaptadores();
    toast('Recalculado', 'success');
  } catch (e) {
    toast('Error al recalcular: ' + (e.message || e), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Recalcular ahora';
  }
}

// firestore.rules bloquea delete de captaciones para cualquier cliente
// (allow update, delete: if false), pero el admin tiene acceso total vía la
// regla comodín (match /{document=**}) -- ambas reglas se evalúan con OR,
// así que no hace falta una Cloud Function para esto, igual que
// toggleActivoCaptador() ya escribe directo con el SDK del cliente.
async function eliminarCaptacionUI(id, email) {
  if (!confirm(`¿Borrar la captación de "${email}"? No se puede deshacer.`)) return;
  try {
    await db.collection('captaciones').doc(id).delete();
    toast('Captación eliminada', 'success');
    cargarCaptaciones();
  } catch (e) {
    toast('Error al eliminar: ' + (e.message || e), 'error');
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
  const c = todosCaptadores.find((x) => x.id === id);
  if (!c) return '(captador eliminado)';
  return c.nombre || '(sin nombre)';
}

const MOTIVOS_SOSPECHA_TEXTO = {
  distancia_alta: 'Distancia captador↔alta alta',
  fuera_de_horario: 'Alta fuera del horario del turno',
  cuenta_previa_a_captacion: 'La cuenta ya existía antes de la captación',
  ubicacion_compartida: 'Ubicación compartida con otro(s) vecino(s) fuera del área',
};
// Toma el registro de captación COMPLETO (no solo vitryna_match) -- el
// ritmo de captación es una señal sobre el propio registro (independiente
// de si llegó a convertirse en vecino real), vive en un campo propio del
// doc, no dentro de vitryna_match.
function motivosSospechaHtml(c) {
  const match = c.vitryna_match;
  const motivos = [...(match?.motivos_sospecha || [])];
  const textos = motivos.map((m) => {
    if (m === 'ubicacion_compartida' && match.otros_en_misma_ubicacion) {
      return `${MOTIVOS_SOSPECHA_TEXTO[m]} (${match.otros_en_misma_ubicacion})`;
    }
    return MOTIVOS_SOSPECHA_TEXTO[m] || m;
  });
  if (c.ritmo_sospechoso) {
    textos.push(`Ritmo de captación imposible (${c.intervalo_anterior_segundos}s desde el anterior)`);
  }
  // El comercio no genera vitryna_match (no es un vecino captado), pero
  // "¿ya existía antes de la captación?" es igual de relevante ahí.
  if (c.es_comercio_existente && c.comercio_cuenta_previa) {
    textos.push('La cuenta de comercio ya existía antes de la captación');
  }
  if (textos.length === 0) return '';
  const texto = textos.join(' · ');
  return `<span style="font-size:0.72rem;padding:2px 6px;border-radius:4px;background:var(--red-light);color:var(--red);font-weight:600;" title="${escapeHtml(texto)}">${escapeHtml(texto)}</span>`;
}

function renderCaptaciones() {
  const q = (document.getElementById('search-captaciones').value || '').toLowerCase();
  const lista = todasCaptaciones.filter((c) => {
    const match = c.vitryna_match;
    if (filtroCaptaciones === 'confirmados' && !(match && match.amigos_count >= 1)) return false;
    if (filtroCaptaciones === 'pendientes' && (match || c.es_comercio_existente)) return false;
    if (filtroCaptaciones === 'sospechoso' && !match?.sospechoso && !c.ritmo_sospechoso) return false;
    if (filtroCaptadorId && c.captador_id !== filtroCaptadorId) return false;
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
      <thead><tr><th>Email</th><th>Captador</th><th>Registrado</th><th>Vecino real</th><th style="text-align:center;">Amigos</th><th>Aviso</th><th></th></tr></thead>
      <tbody>${lista.map((c) => {
        const m = c.vitryna_match;
        // es_comercio_existente: el email SÍ tiene cuenta, solo que es de
        // comercio -- "Sin cuenta todavía" sería falso para este caso.
        const estado = c.es_comercio_existente
          ? '<span class="badge pro">Cuenta de Comercio</span>'
          : !m
            ? '<span class="badge free">Sin cuenta todavía</span>'
            : m.email_verificado
              ? '<span class="badge activo">Confirmado</span>'
              : '<span class="badge free">Sin verificar email</span>';
        const amigos = c.es_comercio_existente ? c.comercio_amigos_count : (m ? m.amigos_count : null);
        return `<tr>
          <td>${escapeHtml(c.email)}</td>
          <td style="font-size:0.85rem;">${escapeHtml(nombreCaptador(c.captador_id))}</td>
          <td style="font-size:0.8rem;color:var(--text-2)">${formatDate(c.fecha_registro)}</td>
          <td>${estado}${c.es_comercio_existente && c.comercio_nombre ? `<div style="font-size:0.72rem;color:var(--text-2);margin-top:2px;">${escapeHtml(c.comercio_nombre)}</div>` : ''}</td>
          <td style="text-align:center;">${amigos ?? '—'}</td>
          <td>${motivosSospechaHtml(c)}</td>
          <td><button class="btn-sm" onclick="eliminarCaptacionUI('${c.id}', '${escapeHtml(c.email)}')">Eliminar</button></td>
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
    const ayuda = (texto) => `<div style="font-size:0.73rem;color:var(--text-3);margin-top:4px;">${texto}</div>`;
    el.innerHTML = `
      <div class="field-row">
        <div class="field-group">
          <label>Distancia sospechosa / área de captación (metros)</label>
          <input type="number" id="cc-distancia" value="${d.distancia_sospechosa_m ?? 2000}">
          ${ayuda('Si el vecino se dio de alta más lejos de aquí del captador que lo captó, se marca "Distancia captador↔alta alta". También define qué cuenta como "fuera del área" para el resto de señales.')}
        </div>
        <div class="field-group">
          <label>Radio "misma ubicación" (metros)</label>
          <input type="number" id="cc-radio-ubicacion" value="${d.radio_misma_ubicacion_m ?? 2}">
          ${ayuda('Entre vecinos ya marcados "fuera del área": si dos o más se dieron de alta a menos de este radio entre sí, se marca "Ubicación compartida" (posibles altas fake creadas en bloque desde un mismo punto).')}
        </div>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label>Intervalo mínimo entre capturas (segundos)</label>
          <input type="number" id="cc-intervalo" value="${d.intervalo_minimo_segundos ?? 20}">
          ${ayuda('Si el mismo captador registra dos emails con menos tiempo que este entre uno y otro, se marca "Ritmo de captación imposible". No depende de si el email llega a convertirse en vecino real.')}
        </div>
        <div class="field-group">
          <label>Tarifa por hora (€)</label>
          <input type="number" step="0.01" id="cc-tarifa-hora" value="${d.tarifa_hora ?? 0}">
          ${ayuda('Referencia informativa del sueldo por hora del captador -- no se usa todavía en ningún cálculo automático de este panel.')}
        </div>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label>Prima por vecino con 1+ amigo (€)</label>
          <input type="number" step="0.01" id="cc-variable" value="${d.comision_variable_1_amigo ?? 0}">
          ${ayuda('Se suma a la "Prima estimada de hoy" (Mi cuenta del captador) por cada vecino de HOY que ya aparece confirmado (verificado y con 1 o más amigos).')}
        </div>
        <div class="field-group">
          <label>Bono por 2+ amigos (€)</label>
          <input type="number" step="0.01" id="cc-bono" value="${d.bono_2_amigos ?? 0}">
          ${ayuda('Pendiente de conectar al cálculo automático -- de momento es solo un valor de referencia guardado aquí.')}
        </div>
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
      radio_misma_ubicacion_m: Number(document.getElementById('cc-radio-ubicacion').value) || 0,
      intervalo_minimo_segundos: Number(document.getElementById('cc-intervalo').value) || 0,
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
let ultimoSorteoId = null;

async function ejecutarSorteo() {
  if (!confirm('¿Ejecutar el sorteo ahora? Se elegirá un ganador entre todos los emails registrados.')) return;
  const el = document.getElementById('sorteo-resultado');
  el.textContent = 'Sorteando...';
  try {
    const fn = firebase.app().functions('europe-west1').httpsCallable('sortearGanador');
    const res = await fn({ numGanadores: 1 });
    const ganador = res.data.ganadores[0];
    ultimoSorteoId = res.data.id;
    el.innerHTML = `
      Ganador: <strong>${escapeHtml(ganador.email)}</strong> (captado por ${escapeHtml(nombreCaptador(ganador.captador_id))}) — de ${res.data.total_participantes} participantes.
      <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-primary" id="btn-email-ganador">Enviar email al ganador</button>
        <button class="btn-sm" id="btn-email-no-ganadores">Avisar al resto de participantes</button>
      </div>
    `;
    document.getElementById('btn-email-ganador').addEventListener('click', enviarEmailGanadorUI);
    document.getElementById('btn-email-no-ganadores').addEventListener('click', enviarEmailNoGanadoresUI);
  } catch (e) {
    el.textContent = 'Error al sortear: ' + (e.message || e);
  }
}

// El lugar de recogida del premio todavía no está decidido -- se pide aquí
// como texto libre en vez de una plantilla fija, para no mandar nunca un
// email real con un hueco a medio rellenar (p.ej. "recógelo en .........").
async function enviarEmailGanadorUI() {
  if (!ultimoSorteoId) return;
  const lugarRecogida = prompt('¿Dónde puede recoger el premio el ganador? (se incluirá tal cual en el email)');
  if (lugarRecogida === null) return;
  if (!lugarRecogida.trim()) { toast('El lugar de recogida no puede estar vacío', 'error'); return; }

  const btn = document.getElementById('btn-email-ganador');
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  try {
    const fn = firebase.app().functions('europe-west1').httpsCallable('enviarEmailGanador');
    const res = await fn({ sorteoId: ultimoSorteoId, lugarRecogida });
    toast(`Email enviado (${res.data.enviados}/${res.data.total})`, 'success');
    btn.textContent = 'Email enviado ✓';
  } catch (e) {
    toast('Error al enviar: ' + (e.message || e), 'error');
    btn.disabled = false;
    btn.textContent = 'Enviar email al ganador';
  }
}

async function enviarEmailNoGanadoresUI() {
  if (!ultimoSorteoId) return;
  if (!confirm('¿Avisar por email a todos los demás participantes de que el sorteo ya tiene ganador? Puede ser una lista larga.')) return;

  const btn = document.getElementById('btn-email-no-ganadores');
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  try {
    const fn = firebase.app().functions('europe-west1').httpsCallable('enviarEmailNoGanadores');
    const res = await fn({ sorteoId: ultimoSorteoId });
    toast(`Aviso enviado (${res.data.enviados}/${res.data.total})`, 'success');
    btn.textContent = 'Aviso enviado ✓';
  } catch (e) {
    toast('Error al enviar: ' + (e.message || e), 'error');
    btn.disabled = false;
    btn.textContent = 'Avisar al resto de participantes';
  }
}

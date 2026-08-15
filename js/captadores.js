let todosCaptadores = [];
let todasCaptaciones = [];
let filtroCaptaciones = 'todos';
let filtroCaptadorId = '';
let filtroFechaDesde = '';
let filtroFechaHasta = '';
let captadorEditId = null;
// Parámetros de config/captadores ya cargados, reutilizados por el modal de
// detalle para mostrar "valor real (umbral: X)" sin releer Firestore por
// cada fila -- se repueblan cada vez que se guarda o se recarga la sección.
let configCaptadores = {};
let detalleCaptacionId = null;

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

  if (!document.getElementById('filtro-captador-captaciones')._bound) {
    document.getElementById('filtro-captador-captaciones')._bound = true;
    document.getElementById('filtro-captador-captaciones').addEventListener('change', (e) => {
      filtroCaptadorId = e.target.value;
      renderCaptaciones();
    });
    document.getElementById('filtro-fecha-desde').addEventListener('change', (e) => {
      filtroFechaDesde = e.target.value;
      renderCaptaciones();
    });
    document.getElementById('filtro-fecha-hasta').addEventListener('change', (e) => {
      filtroFechaHasta = e.target.value;
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
    document.getElementById('btn-generar-liquidacion').addEventListener('click', abrirLiquidacionUI);
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
    <div style="overflow-x:auto;">
    <table style="min-width:640px;">
      <thead><tr><th>Nombre</th><th>Puesto</th><th style="text-align:center;">Estado</th><th style="text-align:center;">Hoy</th><th>Acciones</th></tr></thead>
      <tbody>${todosCaptadores.map((c) => `<tr>
        <td style="font-weight:500">${c.nombre ? escapeHtml(c.nombre) : '<span style="color:var(--text-2);font-style:italic;">(sin nombre — id ' + escapeHtml(c.id) + ')</span>'}</td>
        <td style="color:var(--text-2);font-size:0.85rem">${escapeHtml(c.puesto) || '—'}</td>
        <td style="text-align:center;">
          <span class="badge ${c.activo ? 'activo' : 'free'}" style="cursor:pointer;" onclick="toggleActivoCaptador('${c.id}', ${!c.activo})">
            ${c.activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td style="text-align:center;font-size:0.85rem;white-space:nowrap;">${c.resumen_hoy?.emails_hoy ?? 0} emails · ${c.resumen_hoy?.vecinos_confirmados_hoy ?? 0} conf.</td>
        <td style="white-space:nowrap;">
          <button class="btn-sm" onclick="abrirModalCaptador('${c.id}')">Editar</button>
          <button class="btn-sm" onclick="resetPinCaptadorUI('${c.id}')">Resetear PIN</button>
          <button class="btn-sm" onclick="eliminarCaptadorUI('${c.id}', '${escapeHtml(c.nombre || c.id)}')">Eliminar</button>
        </td>
      </tr>`).join('')}</tbody>
    </table>
    </div>`;
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

// El admin nunca teclea un importe -- solo decide Sí/No/Automático, y el
// importe en sí siempre lo recalcula el backend a partir de los parámetros
// vivos de config/captadores (así una fila marcada "Sí" se actualiza sola
// si más adelante se cambia una tarifa, en vez de quedarse con un número
// congelado del día que se decidió).
async function decidirPrimaUI(id, decision) {
  try {
    await db.collection('captaciones').doc(id).update({ prima_decision: decision });
    toast(decision === 'si' ? 'Prima marcada como Sí' : decision === 'no' ? 'Prima marcada como No' : 'Vuelta a automático', 'success');
    // El importe final (prima) solo se recalcula en el próximo cruce
    // (procesarCaptaciones cada 15 min, o Recalcular ahora) -- no aquí en
    // el cliente, para no duplicar la fórmula en dos sitios.
    const c = todasCaptaciones.find((x) => x.id === id);
    if (c) c.prima_decision = decision;
    if (detalleCaptacionId === id) renderDetalleCaptacion(id);
    renderCaptaciones();
  } catch (e) {
    toast('Error al guardar la decisión: ' + (e.message || e), 'error');
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

function formatFechaHora(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}
function formatHora(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// Único punto que decide el texto/badge de "Vecino real" -- lo usan tanto
// la fila de la tabla como el modal de detalle, para que nunca diverjan.
function estadoCaptacionHtml(c) {
  const m = c.vitryna_match;
  if (c.es_comercio_existente) return '<span class="badge pro">Cuenta de Comercio</span>';
  if (!m) return '<span class="badge free">Sin cuenta todavía</span>';
  if (m.email_verificado) return '<span class="badge activo">Confirmado</span>';
  return '<span class="badge free">Sin verificar email</span>';
}

// ── DETALLE DE UNA CAPTACIÓN (valor real + umbral de cada señal, y decisión de prima) ──
function abrirDetalleCaptacion(id) {
  detalleCaptacionId = id;
  renderDetalleCaptacion(id);
  document.getElementById('modal-detalle-captacion').classList.add('open');
}
function cerrarDetalleCaptacion() {
  document.getElementById('modal-detalle-captacion').classList.remove('open');
  detalleCaptacionId = null;
}

function filaDetalle(etiqueta, valor) {
  return `<div style="display:flex;justify-content:space-between;gap:16px;padding:7px 0;border-bottom:1px solid var(--border);font-size:0.85rem;">
    <span style="color:var(--text-2);">${etiqueta}</span><span style="text-align:right;font-weight:500;">${valor}</span>
  </div>`;
}
function bloqueSenal(titulo, activa, detalle) {
  const color = activa ? 'var(--red)' : 'var(--text-2)';
  const icono = activa ? '⚠' : '✓';
  return `<div style="padding:10px 12px;border-radius:10px;background:${activa ? 'var(--red-light)' : 'var(--bg)'};margin-bottom:8px;">
    <div style="font-size:0.85rem;font-weight:600;color:${color};">${icono} ${titulo}</div>
    <div style="font-size:0.8rem;color:var(--text-2);margin-top:2px;">${detalle}</div>
  </div>`;
}

function renderDetalleCaptacion(id) {
  const c = todasCaptaciones.find((x) => x.id === id);
  const cuerpo = document.getElementById('dc-cuerpo');
  if (!c) { cuerpo.innerHTML = '<div class="empty">No se encontró la captación</div>'; return; }
  const m = c.vitryna_match;
  const cfg = configCaptadores;
  document.getElementById('dc-titulo').textContent = c.email;

  let html = '';
  html += filaDetalle('Captador', escapeHtml(nombreCaptador(c.captador_id)));
  html += filaDetalle('Registrado', formatFechaHora(c.fecha_registro));
  html += filaDetalle('Estado', estadoCaptacionHtml(c));
  if (c.es_comercio_existente && c.comercio_nombre) html += filaDetalle('Comercio', escapeHtml(c.comercio_nombre));
  const amigos = c.es_comercio_existente ? c.comercio_amigos_count : (m ? m.amigos_count : null);
  html += filaDetalle('Amigos (comercios que sigue)', amigos ?? '—');

  html += `<div style="margin-top:16px;margin-bottom:8px;font-size:0.8rem;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:0.02em;">Señales, con su valor real y el umbral configurado</div>`;

  let huboSenal = false;
  if (m) {
    const dist = m.distancia_captador_alta_m;
    const umbralDist = cfg.distancia_sospechosa_m ?? 2000;
    if (dist !== null && dist !== undefined) {
      const activa = dist > umbralDist;
      huboSenal = huboSenal || activa;
      html += bloqueSenal('Distancia captador ↔ alta del vecino', activa,
        `${Math.round(dist).toLocaleString('es-ES')} m (umbral: ${umbralDist.toLocaleString('es-ES')} m)`);
    }

    if (m.dentro_horario_turno !== null && m.dentro_horario_turno !== undefined) {
      const activa = m.dentro_horario_turno === false;
      huboSenal = huboSenal || activa;
      const rangoTurno = `${formatHora(m.turno_inicio)} - ${m.turno_abierto ? 'sigue abierto' : formatHora(m.turno_fin)}`;
      html += bloqueSenal('Alta dentro del turno del captador', activa,
        `Turno: ${rangoTurno} · Alta del vecino: ${formatHora(m.creado_en)}`);
    }

    if (m.cuenta_previa_a_captacion) {
      huboSenal = true;
      html += bloqueSenal('Cuenta ya existía antes de la captación', true,
        `Cuenta creada: ${formatFechaHora(m.creado_en)} · Captación registrada: ${formatFechaHora(c.fecha_registro)}`);
    }

    if (m.otros_en_misma_ubicacion) {
      huboSenal = true;
      const umbralRadio = cfg.radio_misma_ubicacion_m ?? 2;
      html += bloqueSenal('Ubicación compartida con otros vecinos fuera del área', true,
        `Coincide (±${umbralRadio} m) con otros ${m.otros_en_misma_ubicacion} vecino(s) también fuera del área de captación`);
    }
  }

  if (c.ritmo_sospechoso) {
    huboSenal = true;
    const umbralIntervalo = cfg.intervalo_minimo_segundos ?? 20;
    html += bloqueSenal('Ritmo de captación imposible', true,
      `${c.intervalo_anterior_segundos} s desde la captación anterior de este mismo captador (mínimo esperado: ${umbralIntervalo} s)`);
  }

  if (c.es_comercio_existente && c.comercio_cuenta_previa) {
    huboSenal = true;
    html += bloqueSenal('La cuenta de comercio ya existía antes de la captación', true, 'Ese negocio ya estaba registrado en Vitryna antes de que este captador recogiera el email en la calle.');
  }

  if (!huboSenal) html += `<div style="font-size:0.85rem;color:var(--text-2);padding:8px 0;">Sin ninguna señal de aviso.</div>`;

  const tarifaBase = cfg.comision_variable_1_amigo ?? 0;
  const bono = cfg.bono_2_amigos ?? 0;
  html += `<div style="margin-top:16px;margin-bottom:8px;font-size:0.8rem;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:0.02em;">Prima</div>`;
  html += filaDetalle('Importe si se paga (según parámetros actuales)',
    `${(c.prima_calculada ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}` +
    ((amigos ?? 0) >= 2 ? ` <span style="color:var(--text-2);font-weight:400;">(${tarifaBase.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} + ${bono.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} bono)</span>` : ''));
  html += filaDetalle('Sugerencia automática', c.prima_sugerida === null || c.prima_sugerida === undefined ? 'Pendiente, sin resolver todavía' : c.prima_sugerida.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }));
  const decisionTexto = c.prima_decision === 'si' ? 'Sí, pagar (decisión manual)' : c.prima_decision === 'no' ? 'No pagar (decisión manual)' : 'Sin decidir — manda la sugerencia automática';
  html += filaDetalle('Decisión del admin', decisionTexto);
  html += `<div style="margin-top:10px;padding:12px;border-radius:10px;background:var(--blue-light);display:flex;justify-content:space-between;align-items:center;">
    <span style="font-weight:600;">Prima final</span>
    <span style="font-weight:800;font-size:1.15rem;color:var(--blue);">${(c.prima ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
  </div>`;

  cuerpo.innerHTML = html;

  document.getElementById('dc-btn-si').onclick = () => decidirPrimaUI(id, 'si');
  document.getElementById('dc-btn-no').onclick = () => decidirPrimaUI(id, 'no');
  document.getElementById('dc-btn-auto').onclick = () => decidirPrimaUI(id, null);
}

function renderCaptaciones() {
  const lista = todasCaptaciones.filter((c) => {
    const match = c.vitryna_match;
    if (filtroCaptaciones === 'confirmados' && !(match && match.amigos_count >= 1)) return false;
    if (filtroCaptaciones === 'pendientes' && (match || c.es_comercio_existente)) return false;
    if (filtroCaptaciones === 'sospechoso' && !match?.sospechoso && !c.ritmo_sospechoso) return false;
    if (filtroCaptadorId && c.captador_id !== filtroCaptadorId) return false;
    if (filtroFechaDesde || filtroFechaHasta) {
      const fecha = c.fecha_registro?.toDate?.();
      if (!fecha) return false;
      if (filtroFechaDesde && fecha < new Date(filtroFechaDesde + 'T00:00:00')) return false;
      if (filtroFechaHasta && fecha > new Date(filtroFechaHasta + 'T23:59:59')) return false;
    }
    return true;
  });

  const el = document.getElementById('tabla-captaciones');
  if (!lista.length) { el.innerHTML = '<div class="empty">Sin resultados</div>'; return; }

  el.innerHTML = `
    <div style="padding:8px 20px;font-size:0.78rem;color:var(--text-2);border-bottom:1px solid var(--border);">
      ${lista.length} de ${todasCaptaciones.length} captaciones (últimas 500)
    </div>
    <div style="overflow-x:auto;">
    <table style="min-width:840px;">
      <thead><tr><th>Email</th><th>Captador</th><th>Registrado</th><th>Vecino real</th><th style="text-align:center;">Amigos</th><th>Aviso</th><th>Prima</th><th></th></tr></thead>
      <tbody>${lista.map((c) => {
        const m = c.vitryna_match;
        const amigos = c.es_comercio_existente ? c.comercio_amigos_count : (m ? m.amigos_count : null);
        const primaTexto = c.prima_sugerida === null && c.prima_decision !== 'si' && c.prima_decision !== 'no'
          ? 'Pendiente'
          : (c.prima ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
        const decisionTag = c.prima_decision === 'si'
          ? '<span style="font-size:0.68rem;color:var(--green,#10B981);font-weight:600;">Sí</span>'
          : c.prima_decision === 'no'
            ? '<span style="font-size:0.68rem;color:var(--red);font-weight:600;">No</span>'
            : '<span style="font-size:0.68rem;color:var(--text-3);">auto</span>';
        return `<tr>
          <td>${escapeHtml(c.email)}</td>
          <td style="font-size:0.85rem;">${escapeHtml(nombreCaptador(c.captador_id))}</td>
          <td style="font-size:0.8rem;color:var(--text-2);white-space:nowrap;">${formatFechaHora(c.fecha_registro)}</td>
          <td>${estadoCaptacionHtml(c)}${c.es_comercio_existente && c.comercio_nombre ? `<div style="font-size:0.72rem;color:var(--text-2);margin-top:2px;">${escapeHtml(c.comercio_nombre)}</div>` : ''}</td>
          <td style="text-align:center;">${amigos ?? '—'}</td>
          <td>${motivosSospechaHtml(c)}</td>
          <td style="font-size:0.85rem;">${primaTexto} ${decisionTag}</td>
          <td style="white-space:nowrap;">
            <button class="btn-sm" onclick="abrirDetalleCaptacion('${c.id}')">Detalle</button>
            <button class="btn-sm" onclick="eliminarCaptacionUI('${c.id}', '${escapeHtml(c.email)}')">Eliminar</button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>
    </div>`;
}

// Texto en lenguaje llano de por qué una captación no cuenta (o está en
// revisión) -- pensado para que lo entienda el captador, no para depurar el
// sistema. Distinto de motivosSospechaHtml(), que es la versión técnica
// para el admin.
function textoAvisoPlano(c) {
  const m = c.vitryna_match;
  if (c.prima_decision === 'no') return 'No cuenta (revisado por el equipo)';
  if (c.prima_decision === 'si') return 'Cuenta (revisado por el equipo)';
  if (c.es_comercio_existente) return 'Ese email ya era una cuenta de comercio, no de vecino';
  if (!m) return 'Todavía sin confirmar como vecino real';
  if (m.sospechoso || c.ritmo_sospechoso) {
    const motivos = [];
    if (m.motivos_sospecha?.includes('distancia_alta')) motivos.push('te dio de alta lejos de tu ubicación');
    if (m.motivos_sospecha?.includes('fuera_de_horario')) motivos.push('fuera de tu turno');
    if (m.motivos_sospecha?.includes('cuenta_previa_a_captacion')) motivos.push('la cuenta ya existía antes de captarlo');
    if (m.motivos_sospecha?.includes('ubicacion_compartida')) motivos.push('ubicación compartida con otros captados');
    if (c.ritmo_sospechoso) motivos.push('demasiado seguida de la anterior');
    return 'En revisión: ' + motivos.join(', ');
  }
  if ((m.amigos_count ?? 0) < 1) return 'Registrado, todavía sin seguir a ningún comercio';
  return '';
}

function formatDateInput(str) {
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

// ── LIQUIDACIÓN (listado claro para enviar a un captador) ──────────────────
// Reutiliza el filtro de captador + fechas que ya está en pantalla, pero
// ignora los chips de estado (Confirmados/Sospechosos/...) -- el captador
// necesita ver TODAS sus captaciones del período, incluidas las que no se
// pagan, para entender de un vistazo por qué.
function abrirLiquidacionUI() {
  if (!filtroCaptadorId) {
    toast('Selecciona primero un captador en el filtro de arriba', 'error');
    return;
  }
  const nombreCap = nombreCaptador(filtroCaptadorId);
  const lista = todasCaptaciones.filter((c) => {
    if (c.captador_id !== filtroCaptadorId) return false;
    if (filtroFechaDesde || filtroFechaHasta) {
      const fecha = c.fecha_registro?.toDate?.();
      if (!fecha) return false;
      if (filtroFechaDesde && fecha < new Date(filtroFechaDesde + 'T00:00:00')) return false;
      if (filtroFechaHasta && fecha > new Date(filtroFechaHasta + 'T23:59:59')) return false;
    }
    return true;
  }).sort((a, b) => (a.fecha_registro?.toMillis?.() ?? 0) - (b.fecha_registro?.toMillis?.() ?? 0));

  if (!lista.length) {
    toast('Este captador no tiene captaciones en el rango de fechas seleccionado', 'error');
    return;
  }

  const rango = (filtroFechaDesde || filtroFechaHasta)
    ? `${filtroFechaDesde ? formatDateInput(filtroFechaDesde) : 'siempre'} a ${filtroFechaHasta ? formatDateInput(filtroFechaHasta) : 'hoy'}`
    : 'todas las fechas';
  const total = lista.reduce((sum, c) => sum + (c.prima ?? 0), 0);

  document.getElementById('liq-titulo').textContent = `Liquidación de ${nombreCap}`;

  let html = `<div style="font-size:0.85rem;color:var(--text-2);margin-bottom:14px;">Período: ${escapeHtml(rango)} · ${lista.length} captación${lista.length !== 1 ? 'es' : ''}</div>`;
  html += `<div style="overflow-x:auto;"><table style="width:100%;font-size:0.82rem;border-collapse:collapse;">
    <thead><tr>
      <th style="text-align:left;padding:6px 8px;">Email</th>
      <th style="text-align:left;padding:6px 8px;">Fecha y hora</th>
      <th style="text-align:right;padding:6px 8px;">Prima</th>
      <th style="text-align:left;padding:6px 8px;">Aviso</th>
    </tr></thead>
    <tbody>${lista.map((c) => {
      const aviso = textoAvisoPlano(c);
      return `<tr style="border-top:1px solid var(--border);">
        <td style="padding:6px 8px;">${escapeHtml(c.email)}</td>
        <td style="padding:6px 8px;white-space:nowrap;">${formatFechaHora(c.fecha_registro)}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:600;">${(c.prima ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
        <td style="padding:6px 8px;color:var(--text-2);">${aviso ? escapeHtml(aviso) : '—'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
  html += `<div style="margin-top:14px;padding:14px;border-radius:10px;background:var(--blue-light);display:flex;justify-content:space-between;align-items:center;">
    <span style="font-weight:700;">Total a pagar</span>
    <span style="font-weight:800;font-size:1.3rem;color:var(--blue);">${total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
  </div>`;

  document.getElementById('liq-cuerpo').innerHTML = html;
  document.getElementById('liq-btn-copiar').onclick = () => copiarLiquidacionTexto(nombreCap, rango, lista, total);
  document.getElementById('liq-btn-pdf').onclick = () => descargarLiquidacionPDF(nombreCap, rango, lista, total);
  document.getElementById('modal-liquidacion').classList.add('open');
}
function cerrarLiquidacion() {
  document.getElementById('modal-liquidacion').classList.remove('open');
}

async function copiarLiquidacionTexto(nombreCap, rango, lista, total) {
  let texto = `Liquidación de ${nombreCap}\nPeríodo: ${rango}\n\n`;
  lista.forEach((c) => {
    const aviso = textoAvisoPlano(c);
    texto += `${formatFechaHora(c.fecha_registro)} · ${c.email} · ${(c.prima ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`;
    if (aviso) texto += ` · ${aviso}`;
    texto += '\n';
  });
  texto += `\nTOTAL A PAGAR: ${total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}\n`;
  try {
    await navigator.clipboard.writeText(texto);
    toast('Copiado al portapapeles', 'success');
  } catch (e) {
    toast('No se pudo copiar automáticamente -- selecciona el texto a mano', 'error');
  }
}

// Sin librería de PDF nueva -- abre una pestaña aparte con un documento
// minimalista propio (no hereda el CSS/sidebar del panel) y dispara el
// diálogo de impresión nativo del navegador, donde "Guardar como PDF" ya
// es una opción de destino en todos los navegadores modernos. Evita meter
// una dependencia (jsPDF y similares) solo para un documento tan simple.
function descargarLiquidacionPDF(nombreCap, rango, lista, total) {
  const ventana = window.open('', '_blank');
  if (!ventana) { toast('El navegador ha bloqueado la ventana -- permite pop-ups para este sitio', 'error'); return; }

  const filas = lista.map((c) => {
    const aviso = textoAvisoPlano(c);
    return `<tr>
      <td>${escapeHtml(c.email)}</td>
      <td style="white-space:nowrap;">${formatFechaHora(c.fecha_registro)}</td>
      <td style="text-align:right;font-weight:600;">${(c.prima ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
      <td style="color:#6B7280;">${aviso ? escapeHtml(aviso) : '—'}</td>
    </tr>`;
  }).join('');

  ventana.document.write(`<!doctype html>
<html lang="es"><head><meta charset="UTF-8">
<title>Liquidación ${escapeHtml(nombreCap)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111827; padding: 40px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #6B7280; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #E8ECF4; }
  th { color: #6B7280; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.02em; }
  .total { margin-top: 20px; padding: 14px 18px; background: #EEF4FF; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 16px; }
  .total span:last-child { color: #1A6BFF; }
  @media print { body { padding: 0; } }
</style></head>
<body>
  <h1>Vitryna — Liquidación de ${escapeHtml(nombreCap)}</h1>
  <div class="sub">Período: ${escapeHtml(rango)} · ${lista.length} captación${lista.length !== 1 ? 'es' : ''}</div>
  <table>
    <thead><tr><th>Email</th><th>Fecha y hora</th><th style="text-align:right;">Prima</th><th>Aviso</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
  <div class="total"><span>Total a pagar</span><span>${total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></div>
</body></html>`);
  ventana.document.close();
  ventana.focus();
  // Pequeño margen para que la pestaña nueva termine de pintar antes de
  // abrir el diálogo de impresión -- sin esto, algunos navegadores lo
  // disparan sobre una página todavía en blanco.
  setTimeout(() => ventana.print(), 300);
}

// ── PARÁMETROS DE LA CAMPAÑA ───────────────────────────────────────────────
async function cargarConfigCaptadores() {
  const el = document.getElementById('captadores-config');
  try {
    // config/captadores, NUNCA la colección suelta 'parametros' (huérfana,
    // ver CLAUDE.md) -- la configuración real vive bajo config/{doc}.
    const doc = await db.collection('config').doc('captadores').get();
    const d = doc.data() || {};
    configCaptadores = d;
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
          ${ayuda('Importe sugerido en la columna "Prima" de cada captación confirmada (vecino real, verificado, sin ningún motivo de sospecha) -- editable a mano fila por fila. Se suma también a "Prima estimada de hoy" en Mi cuenta del captador.')}
        </div>
        <div class="field-group">
          <label>Bono por 2+ amigos (€)</label>
          <input type="number" step="0.01" id="cc-bono" value="${d.bono_2_amigos ?? 0}">
          ${ayuda('Se añade a la prima por vecino (arriba) cuando ese vecino confirmado ya sigue a 2 o más comercios, no solo 1.')}
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
    configCaptadores = {
      distancia_sospechosa_m: Number(document.getElementById('cc-distancia').value) || 0,
      radio_misma_ubicacion_m: Number(document.getElementById('cc-radio-ubicacion').value) || 0,
      intervalo_minimo_segundos: Number(document.getElementById('cc-intervalo').value) || 0,
      tarifa_hora: Number(document.getElementById('cc-tarifa-hora').value) || 0,
      comision_variable_1_amigo: Number(document.getElementById('cc-variable').value) || 0,
      bono_2_amigos: Number(document.getElementById('cc-bono').value) || 0,
    };
    await db.collection('config').doc('captadores').set(configCaptadores, { merge: true });
    toast('Parámetros guardados', 'success');
  } catch (e) {
    toast('Error al guardar: ' + (e.message || e), 'error');
  }
}

// ── SORTEO ─────────────────────────────────────────────────────────────────
let ultimoSorteoId = null;

async function ejecutarSorteo() {
  const numGanadores = Math.max(1, Number(document.getElementById('sorteo-num-ganadores').value) || 1);
  if (!confirm(`¿Ejecutar el sorteo ahora? Se elegirá${numGanadores > 1 ? `n ${numGanadores} ganadores` : ' un ganador'} entre todos los emails registrados.`)) return;
  const el = document.getElementById('sorteo-resultado');
  el.textContent = 'Sorteando...';
  try {
    const fn = firebase.app().functions('europe-west1').httpsCallable('sortearGanador');
    const res = await fn({ numGanadores });
    ultimoSorteoId = res.data.id;
    const fechaSorteo = formatFechaHora(res.data.fechaISO || new Date());
    const listaGanadores = res.data.ganadores.map((g) =>
      `<li><strong>${escapeHtml(g.email)}</strong> (captado por ${escapeHtml(nombreCaptador(g.captador_id))})</li>`
    ).join('');
    el.innerHTML = `
      <div style="font-size:0.78rem;color:var(--text-3);margin-bottom:4px;">Sorteo del ${fechaSorteo}</div>
      ${res.data.ganadores.length > 1 ? 'Ganadores' : 'Ganador'} de ${res.data.total_participantes} participantes:
      <ul style="margin:6px 0 0 20px;padding:0;">${listaGanadores}</ul>
      <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-primary" id="btn-email-ganador">${res.data.ganadores.length > 1 ? 'Enviar email a los ganadores' : 'Enviar email al ganador'}</button>
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
// El lugar de recogida es texto libre multilínea (dirección completa,
// horario...) -- un prompt() del navegador solo admite una línea, así que
// va en un textarea dentro de un modal propio. El \n que teclee el admin
// se convierte en <br> en el email (ver captadores.js del backend), así
// que los saltos de línea que ponga aquí se ven igual en el correo.
function enviarEmailGanadorUI() {
  if (!ultimoSorteoId) return;
  document.getElementById('lr-texto').value = '';
  document.getElementById('modal-lugar-recogida').classList.add('open');
  document.getElementById('lr-btn-enviar').onclick = confirmarEnvioEmailGanador;
}
function cerrarLugarRecogida() {
  document.getElementById('modal-lugar-recogida').classList.remove('open');
}

async function confirmarEnvioEmailGanador() {
  const lugarRecogida = document.getElementById('lr-texto').value;
  if (!lugarRecogida.trim()) { toast('El lugar de recogida no puede estar vacío', 'error'); return; }

  const btnModal = document.getElementById('lr-btn-enviar');
  const btnFila = document.getElementById('btn-email-ganador');
  const textoOriginal = btnFila.textContent;
  btnModal.disabled = true;
  btnFila.disabled = true;
  btnFila.textContent = 'Enviando...';
  try {
    const fn = firebase.app().functions('europe-west1').httpsCallable('enviarEmailGanador');
    const res = await fn({ sorteoId: ultimoSorteoId, lugarRecogida });
    toast(`Email enviado (${res.data.enviados}/${res.data.total})`, 'success');
    btnFila.textContent = 'Email enviado ✓';
    cerrarLugarRecogida();
  } catch (e) {
    toast('Error al enviar: ' + (e.message || e), 'error');
    btnFila.disabled = false;
    btnFila.textContent = textoOriginal;
  } finally {
    btnModal.disabled = false;
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

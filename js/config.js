async function loadConfig() {
  const el = document.getElementById('config-content');
  el.innerHTML = '<div class="spinner"></div>';
  try {
    const [parDoc, emDoc] = await Promise.all([
      db.collection('config').doc('parametros').get(),
      db.collection('config').doc('emisor').get(),
    ]);
    const p = parDoc.data() || {};
    const e = emDoc.data() || {};

    el.innerHTML = `
      <div class="config-section">
        <div class="config-section-title">Parámetros de la app</div>
        <div class="config-section-desc">Afectan al comportamiento en tiempo real. Los cambios se reflejan en la app de forma inmediata.</div>
        <div class="config-block">
          <div class="config-field">
            <div class="config-field-info"><div class="config-field-label">Límite publicaciones plan Free</div><div class="config-field-desc">Máximo de publicaciones activas simultáneas para usuarios gratuitos</div></div>
            <input type="number" class="config-input" id="cfg-limite-free" value="${p.limite_pubs_free ?? 2}" min="1" max="20">
          </div>
          <div class="config-field">
            <div class="config-field-info"><div class="config-field-label">Días de vida de publicaciones</div><div class="config-field-desc">Una publicación desaparece del feed pasados estos días</div></div>
            <input type="number" class="config-input" id="cfg-dias-vida" value="${p.dias_vida_publicacion ?? 7}" min="1" max="60">
          </div>
          <div class="config-field">
            <div class="config-field-info"><div class="config-field-label">Radio máximo del feed (km)</div><div class="config-field-desc">Distancia máxima que puede seleccionar un vecino en el slider</div></div>
            <input type="number" class="config-input" id="cfg-radio" value="${p.radio_max_km ?? 3}" min="0.5" max="20" step="0.5">
          </div>
          <div class="config-field">
            <div class="config-field-info"><div class="config-field-label">Borrado automático de publicaciones (días)</div><div class="config-field-desc">Publicaciones caducadas hace más de estos días se borran cada noche consolidando sus stats</div></div>
            <input type="number" class="config-input" id="cfg-dias-limpieza" value="${p.dias_limpieza_publicaciones ?? 60}" min="1" max="365">
          </div>
        </div>
      </div>

      <div class="config-section">
        <div class="config-section-title">Precios de planes</div>
        <div class="config-section-desc">Importes que se muestran en la app y se usan para generar facturas (IVA incluido)</div>
        <div class="config-block">
          <div class="config-field"><div class="config-field-info"><div class="config-field-label">Escaparate Pro (€/mes)</div></div><input type="number" class="config-input" id="cfg-precio-pro" value="${p.precio_plan_pro ?? 19.90}" step="0.01" min="0"></div>
          <div class="config-field"><div class="config-field-info"><div class="config-field-label">Multi-Barrio (€/comercio/mes)</div></div><input type="number" class="config-input" id="cfg-precio-multi" value="${p.precio_plan_multi ?? 15.98}" step="0.01" min="0"></div>
        </div>
      </div>

      <div class="config-section">
        <div class="config-section-title">Precios boosts 4h</div>
        <div class="config-section-desc">Packs Super-Escaparate (4 horas)</div>
        <div class="config-block">
          <div class="config-field"><div class="config-field-info"><div class="config-field-label">Pack 5 boosts</div></div><input type="number" class="config-input" id="cfg-b4h-5" value="${p.precio_boost4h_5 ?? 5.90}" step="0.01" min="0"></div>
          <div class="config-field"><div class="config-field-info"><div class="config-field-label">Pack 10 boosts</div></div><input type="number" class="config-input" id="cfg-b4h-10" value="${p.precio_boost4h_10 ?? 9.90}" step="0.01" min="0"></div>
          <div class="config-field"><div class="config-field-info"><div class="config-field-label">Pack 30 boosts</div></div><input type="number" class="config-input" id="cfg-b4h-30" value="${p.precio_boost4h_30 ?? 28.90}" step="0.01" min="0"></div>
        </div>
      </div>

      <div class="config-section">
        <div class="config-section-title">Precios boosts 24h</div>
        <div class="config-section-desc">Packs Super-Escaparate Plus (24 horas)</div>
        <div class="config-block">
          <div class="config-field"><div class="config-field-info"><div class="config-field-label">Pack 5 boosts</div></div><input type="number" class="config-input" id="cfg-b24h-5" value="${p.precio_boost24h_5 ?? 9.90}" step="0.01" min="0"></div>
          <div class="config-field"><div class="config-field-info"><div class="config-field-label">Pack 10 boosts</div></div><input type="number" class="config-input" id="cfg-b24h-10" value="${p.precio_boost24h_10 ?? 16.90}" step="0.01" min="0"></div>
          <div class="config-field"><div class="config-field-info"><div class="config-field-label">Pack 30 boosts</div></div><input type="number" class="config-input" id="cfg-b24h-30" value="${p.precio_boost24h_30 ?? 47.90}" step="0.01" min="0"></div>
        </div>
      </div>

      <div class="config-section">
        <div class="config-section-title">Datos del emisor (Vitryna)</div>
        <div class="config-section-desc">Aparecen como emisor en todas las facturas generadas</div>
        <div class="config-block">
          <div class="config-field"><div class="config-field-info"><div class="config-field-label">Razón social</div></div><input type="text" class="config-input wide" id="cfg-razon-social" value="${e.razon_social || ''}"></div>
          <div class="config-field"><div class="config-field-info"><div class="config-field-label">CIF</div></div><input type="text" class="config-input" id="cfg-cif" value="${e.cif || ''}"></div>
          <div class="config-field"><div class="config-field-info"><div class="config-field-label">Dirección fiscal</div></div><input type="text" class="config-input wide" id="cfg-direccion" value="${e.direccion || ''}"></div>
          <div class="config-field"><div class="config-field-info"><div class="config-field-label">Código postal</div></div><input type="text" class="config-input" id="cfg-cp" value="${e.cod_postal || ''}"></div>
          <div class="config-field"><div class="config-field-info"><div class="config-field-label">Población</div></div><input type="text" class="config-input wide" id="cfg-poblacion" value="${e.poblacion || ''}"></div>
          <div class="config-field"><div class="config-field-info"><div class="config-field-label">Provincia</div></div><input type="text" class="config-input wide" id="cfg-provincia" value="${e.provincia || ''}"></div>
          <div class="config-field"><div class="config-field-info"><div class="config-field-label">IVA (%)</div><div class="config-field-desc">Ej: 21, 10, 13.5</div></div><input type="number" class="config-input" id="cfg-iva" value="${e.iva ?? 21}" step="0.1" min="0"></div>
          <div class="config-field" style="flex-direction:column;align-items:flex-start;gap:8px;">
            <div class="config-field-info"><div class="config-field-label">Registro mercantil</div><div class="config-field-desc">Texto al pie de cada factura</div></div>
            <textarea class="config-input full" id="cfg-reg-mercantil">${e.registro_mercantil || ''}</textarea>
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;margin-top:8px;padding-bottom:24px;">
        <button class="btn-primary" style="padding:12px 32px;font-size:0.95rem;" onclick="guardarConfig()">Guardar configuración</button>
      </div>

      <div class="config-section" style="margin-bottom:32px;">
        <div class="config-section-title">Poblaciones y barrios</div>
        <div class="config-section-desc">
          Los barrios están organizados por población. Selecciona una población para ver y editar sus barrios.
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px;">
          <select id="cfg-poblacion-sel" onchange="cambiarPoblacion()"
            style="padding:7px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:0.9rem;background:var(--surface);min-width:180px;">
          </select>
          <input type="text" id="cfg-poblacion-nueva" placeholder="Nueva población..."
            style="padding:7px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:0.88rem;background:var(--surface);width:180px;"
            onkeydown="if(event.key==='Enter') añadirPoblacion()">
          <button class="btn-secondary" onclick="añadirPoblacion()" style="padding:7px 14px;">+ Añadir población</button>
        </div>
        <div id="barrios-chips" style="display:flex;flex-wrap:wrap;gap:8px;min-height:38px;margin-bottom:14px;"></div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <input type="text" id="cfg-barrio-nuevo" placeholder="Ej: Las Delicias"
            style="padding:7px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:0.88rem;background:var(--surface);width:220px;"
            onkeydown="if(event.key==='Enter') añadirBarrio()">
          <button class="btn-secondary" onclick="añadirBarrio()" style="padding:7px 16px;">+ Añadir barrio</button>
        </div>
        <div id="cfg-barrios-msg" style="font-size:0.82rem;margin-top:8px;"></div>
      </div>

      <div class="config-section" style="margin-bottom:40px;">
        <div class="config-section-title">NIFs Premium — Plan Pionero</div>
        <div class="config-section-desc">
          Lista de NIFs con acceso gratuito hasta el 31 de diciembre de 2026 (Volveremos, HORECA, convenios).
          El CSV debe tener dos columnas: <strong>NIF</strong> y <strong>Nombre del comercio</strong>, con o sin cabecera.
        </div>
        <div id="pioneros-lista" style="margin-bottom:16px;"><div class="spinner"></div></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px;">
          <div>
            <label style="font-size:0.78rem;color:var(--text-2);display:block;margin-bottom:3px;">NIF</label>
            <input type="text" id="cfg-nif-nuevo" placeholder="Ej: B50123456"
              style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:0.88rem;background:var(--surface);width:140px;">
          </div>
          <div>
            <label style="font-size:0.78rem;color:var(--text-2);display:block;margin-bottom:3px;">Nombre del comercio</label>
            <input type="text" id="cfg-nif-nombre" placeholder="Ej: Panadería López"
              style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:0.88rem;background:var(--surface);width:220px;"
              onkeydown="if(event.key==='Enter') añadirNifPionero()">
          </div>
          <button class="btn-secondary" onclick="añadirNifPionero()" style="padding:7px 16px;">+ Añadir</button>
        </div>
        <div style="margin-bottom:8px;">
          <label style="font-size:0.78rem;color:var(--text-2);display:block;margin-bottom:6px;">Importar desde CSV (columnas: NIF, Nombre)</label>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <input type="file" id="cfg-csv-input" accept=".csv,.txt" style="font-size:0.82rem;color:var(--text-2);">
            <button class="btn-secondary" onclick="importarNifsCsv()">Importar CSV</button>
            <button class="btn-secondary" onclick="exportarNifsCsv()" style="color:var(--blue);">⬇ Exportar CSV</button>
          </div>
          <div style="font-size:0.72rem;color:var(--text-3);margin-top:5px;">
            Separador: coma o punto y coma. Primera columna: NIF. Segunda columna: nombre del comercio. Se ignoran duplicados.
          </div>
        </div>
        <div id="cfg-pioneros-msg" style="font-size:0.82rem;margin-top:8px;"></div>
      </div>`;
  } catch (e) { el.innerHTML = '<div class="empty">Error cargando configuración</div>'; }
  cargarBarrios();
  cargarNifsPioneros();
}

async function guardarConfig() {
  try {
    const params = {
      limite_pubs_free:      parseInt(document.getElementById('cfg-limite-free').value) || 2,
      dias_vida_publicacion: parseInt(document.getElementById('cfg-dias-vida').value) || 7,
      radio_max_km:          parseFloat(document.getElementById('cfg-radio').value) || 3,
      dias_limpieza_publicaciones: parseInt(document.getElementById('cfg-dias-limpieza').value) || 60,
      precio_plan_pro:       parseFloat(document.getElementById('cfg-precio-pro').value) || 19.90,
      precio_plan_multi:     parseFloat(document.getElementById('cfg-precio-multi').value) || 15.98,
      precio_boost4h_5:      parseFloat(document.getElementById('cfg-b4h-5').value) || 5.90,
      precio_boost4h_10:     parseFloat(document.getElementById('cfg-b4h-10').value) || 9.90,
      precio_boost4h_30:     parseFloat(document.getElementById('cfg-b4h-30').value) || 28.90,
      precio_boost24h_5:     parseFloat(document.getElementById('cfg-b24h-5').value) || 9.90,
      precio_boost24h_10:    parseFloat(document.getElementById('cfg-b24h-10').value) || 16.90,
      precio_boost24h_30:    parseFloat(document.getElementById('cfg-b24h-30').value) || 47.90,
    };
    const emisor = {
      razon_social:       document.getElementById('cfg-razon-social').value.trim(),
      cif:                document.getElementById('cfg-cif').value.trim(),
      direccion:          document.getElementById('cfg-direccion').value.trim(),
      cod_postal:         document.getElementById('cfg-cp').value.trim(),
      poblacion:          document.getElementById('cfg-poblacion').value.trim(),
      provincia:          document.getElementById('cfg-provincia').value.trim(),
      iva:                parseFloat(document.getElementById('cfg-iva').value) || 21,
      registro_mercantil: document.getElementById('cfg-reg-mercantil').value.trim(),
    };
    await Promise.all([
      db.collection('config').doc('parametros').set(params, { merge: true }),
      db.collection('config').doc('emisor').set(emisor, { merge: true }),
    ]);
    toast('Configuración guardada', 'success');
  } catch (e) { toast('Error guardando configuración', 'error'); }
}

// ── POBLACIONES Y BARRIOS ────────────────────────────────────────────────────

let _barrios = [];
let _poblaciones = [];
let _poblacionActual = '';

async function cargarBarrios() {
  try {
    const doc = await db.collection('config').doc('parametros').get();
    _poblaciones = [...(doc.data()?.poblaciones_activas || [])].sort((a, b) => a.localeCompare(b, 'es'));
    const sel = document.getElementById('cfg-poblacion-sel');
    if (!sel) return;
    sel.innerHTML = _poblaciones.length === 0
      ? '<option value="">Sin poblaciones</option>'
      : _poblaciones.map(p => `<option value="${p}">${p}</option>`).join('');
    _poblacionActual = _poblaciones[0] || '';
    await _cargarBarriosDePoblacion(_poblacionActual);
  } catch(e) {
    const el = document.getElementById('barrios-chips');
    if (el) el.innerHTML = '<span style="color:var(--red);font-size:0.82rem;">Error cargando barrios</span>';
  }
}

async function cambiarPoblacion() {
  const sel = document.getElementById('cfg-poblacion-sel');
  _poblacionActual = sel?.value || '';
  await _cargarBarriosDePoblacion(_poblacionActual);
}

async function _cargarBarriosDePoblacion(poblacion) {
  const el = document.getElementById('barrios-chips');
  if (!el) return;
  if (!poblacion) { _barrios = []; renderBarrios(); return; }
  try {
    const doc = await db.collection('config').doc(poblacion).get();
    _barrios = [...(doc.data()?.barrios || [])].sort((a, b) => a.localeCompare(b, 'es'));
    renderBarrios();
  } catch(e) {
    el.innerHTML = '<span style="color:var(--red);font-size:0.82rem;">Error cargando barrios</span>';
  }
}

function renderBarrios() {
  const el = document.getElementById('barrios-chips');
  if (!el) return;
  if (_barrios.length === 0) {
    el.innerHTML = '<span style="font-size:0.83rem;color:var(--text-3);">Sin barrios para esta población todavía.</span>';
    return;
  }
  el.innerHTML = _barrios.map(b => `
    <span style="display:inline-flex;align-items:center;gap:6px;background:var(--blue-light,#e8f0ff);color:var(--blue);
      border:1.5px solid var(--blue);border-radius:20px;padding:4px 12px;font-size:0.83rem;font-weight:500;">
      ${b}
      <span onclick="eliminarBarrio('${b.replace(/'/g, "\\'")}')"
        style="cursor:pointer;font-size:1rem;line-height:1;color:var(--blue);opacity:0.6;"
        title="Eliminar ${b}">×</span>
    </span>`).join('');
}

async function añadirPoblacion() {
  const input = document.getElementById('cfg-poblacion-nueva');
  const poblacion = input.value.trim();
  if (!poblacion) { toast('Escribe el nombre de la población', 'error'); return; }
  if (_poblaciones.some(p => p.toLowerCase() === poblacion.toLowerCase())) {
    toast('Esa población ya existe', 'error'); return;
  }
  try {
    await db.collection('config').doc('parametros').update({
      poblaciones_activas: firebase.firestore.FieldValue.arrayUnion(poblacion),
    });
    await db.collection('config').doc(poblacion).set({ barrios: [] }, { merge: true });
    _poblaciones = [..._poblaciones, poblacion].sort((a, b) => a.localeCompare(b, 'es'));
    input.value = '';
    const sel = document.getElementById('cfg-poblacion-sel');
    sel.innerHTML = _poblaciones.map(p => `<option value="${p}"${p===poblacion?' selected':''}>${p}</option>`).join('');
    _poblacionActual = poblacion;
    _barrios = [];
    renderBarrios();
    toast(`Población "${poblacion}" añadida`, 'success');
  } catch(e) { toast('Error al guardar', 'error'); }
}

async function añadirBarrio() {
  if (!_poblacionActual) { toast('Selecciona una población primero', 'error'); return; }
  const input = document.getElementById('cfg-barrio-nuevo');
  const barrio = input.value.trim();
  if (!barrio) { toast('Escribe el nombre del barrio', 'error'); return; }
  if (_barrios.some(b => b.toLowerCase() === barrio.toLowerCase())) {
    toast('Ese barrio ya está en la lista', 'error'); return;
  }
  try {
    await db.collection('config').doc(_poblacionActual).update({
      barrios: firebase.firestore.FieldValue.arrayUnion(barrio),
    });
    _barrios = [..._barrios, barrio].sort((a, b) => a.localeCompare(b, 'es'));
    input.value = '';
    renderBarrios();
    toast(`Barrio "${barrio}" añadido a ${_poblacionActual}`, 'success');
  } catch(e) { toast('Error al guardar', 'error'); }
}

async function eliminarBarrio(barrio) {
  if (!confirm(`¿Eliminar "${barrio}" de ${_poblacionActual}?`)) return;
  try {
    await db.collection('config').doc(_poblacionActual).update({
      barrios: firebase.firestore.FieldValue.arrayRemove(barrio),
    });
    _barrios = _barrios.filter(b => b !== barrio);
    renderBarrios();
    toast(`Barrio "${barrio}" eliminado`, 'success');
  } catch(e) { toast('Error al guardar', 'error'); }
}

// ── NIFs PREMIUM — Plan Pionero ─────────────────────────────────────────────
// Estructura: { nif: string, nombre: string }[]

let _nifsPioneros = [];

async function cargarNifsPioneros() {
  const el = document.getElementById('pioneros-lista');
  if (!el) return;
  try {
    const doc = await db.collection('config').doc('pioneros').get();
    const data = doc.exists ? doc.data() : {};
    // Soportar formato antiguo (array de strings) y nuevo (array de objetos)
    const raw = data.nifs_premium || [];
    _nifsPioneros = raw.map(item =>
      typeof item === 'string' ? { nif: item, nombre: '' } : item
    );
    renderNifsPioneros();
  } catch(e) { el.innerHTML = '<div class="empty">Error cargando NIFs</div>'; }
}

function renderNifsPioneros() {
  const el = document.getElementById('pioneros-lista');
  if (!el) return;
  if (_nifsPioneros.length === 0) {
    el.innerHTML = '<div style="font-size:0.83rem;color:var(--text-3);padding:8px 0;">Sin NIFs registrados todavía.</div>';
    return;
  }
  el.innerHTML = `
    <div style="font-size:0.78rem;color:var(--text-2);margin-bottom:10px;">${_nifsPioneros.length} NIF${_nifsPioneros.length !== 1 ? 's' : ''} registrado${_nifsPioneros.length !== 1 ? 's' : ''}</div>
    <table style="width:100%;border-collapse:collapse;font-size:0.83rem;">
      <thead><tr style="border-bottom:2px solid var(--border);color:var(--text-2);font-size:0.75rem;">
        <th style="text-align:left;padding:6px 10px;">NIF</th>
        <th style="text-align:left;padding:6px 10px;">Nombre del comercio</th>
        <th style="padding:6px 10px;"></th>
      </tr></thead>
      <tbody>${_nifsPioneros.map((item, i) => `
        <tr style="${i % 2 === 0 ? 'background:var(--bg);' : ''}border-bottom:1px solid var(--border);">
          <td style="padding:7px 10px;font-family:'DM Mono',monospace;font-size:0.8rem;color:var(--blue);">${item.nif}</td>
          <td style="padding:7px 10px;color:var(--text-1);">${item.nombre || '<span style="color:var(--text-3)">—</span>'}</td>
          <td style="padding:7px 10px;text-align:right;">
            <span onclick="eliminarNifPionero('${item.nif}')" style="cursor:pointer;color:var(--red);font-size:0.8rem;font-weight:600;">Eliminar</span>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

async function guardarNifsPioneros() {
  await db.collection('config').doc('pioneros').set({
    nifs_premium: _nifsPioneros,
  }, { merge: true });
}

async function añadirNifPionero() {
  const nifInput = document.getElementById('cfg-nif-nuevo');
  const nombreInput = document.getElementById('cfg-nif-nombre');
  const nif = nifInput.value.trim().toUpperCase();
  const nombre = nombreInput.value.trim();
  if (!nif) { toast('Introduce un NIF', 'error'); return; }
  if (_nifsPioneros.some(i => i.nif === nif)) { toast('Este NIF ya está en la lista', 'error'); return; }
  _nifsPioneros.push({ nif, nombre });
  _nifsPioneros.sort((a, b) => a.nif.localeCompare(b.nif));
  try {
    await guardarNifsPioneros();
    nifInput.value = ''; nombreInput.value = '';
    renderNifsPioneros();
    toast('NIF añadido', 'success');
  } catch(e) { toast('Error al guardar', 'error'); }
}

async function eliminarNifPionero(nif) {
  if (!confirm(`¿Eliminar el NIF ${nif} de la lista premium?`)) return;
  _nifsPioneros = _nifsPioneros.filter(i => i.nif !== nif);
  try {
    await guardarNifsPioneros();
    renderNifsPioneros();
    toast('NIF eliminado', 'success');
  } catch(e) { toast('Error al guardar', 'error'); }
}

async function importarNifsCsv() {
  const input = document.getElementById('cfg-csv-input');
  const msg = document.getElementById('cfg-pioneros-msg');
  if (!input.files.length) { toast('Selecciona un fichero CSV', 'error'); return; }
  const text = await input.files[0].text();
  const lineas = text.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);
  let nuevos = 0, duplicados = 0, ignorados = 0;
  for (const linea of lineas) {
    const cols = linea.split(/[,;]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
    const nif = cols[0]?.toUpperCase() || '';
    const nombre = cols[1] || '';
    if (!nif || nif.toLowerCase() === 'nif') continue; // cabecera o vacío
    if (!/^[A-Z0-9]{7,10}$/.test(nif)) { ignorados++; continue; }
    if (_nifsPioneros.some(i => i.nif === nif)) { duplicados++; continue; }
    _nifsPioneros.push({ nif, nombre });
    nuevos++;
  }
  if (nuevos === 0) {
    msg.innerHTML = `<span style="color:var(--text-2);">No se encontraron NIFs nuevos.${duplicados > 0 ? ' ' + duplicados + ' ya estaban en la lista.' : ''}${ignorados > 0 ? ' ' + ignorados + ' líneas ignoradas (formato incorrecto).' : ''}</span>`;
    return;
  }
  _nifsPioneros.sort((a, b) => a.nif.localeCompare(b.nif));
  try {
    await guardarNifsPioneros();
    renderNifsPioneros();
    input.value = '';
    msg.innerHTML = `<span style="color:var(--green);">✓ ${nuevos} NIF${nuevos !== 1 ? 's' : ''} importado${nuevos !== 1 ? 's' : ''}${duplicados > 0 ? ' · ' + duplicados + ' duplicados ignorados' : ''}${ignorados > 0 ? ' · ' + ignorados + ' líneas ignoradas' : ''}.</span>`;
    toast(`${nuevos} NIFs importados`, 'success');
  } catch(e) { toast('Error al guardar', 'error'); }
}

function exportarNifsCsv() {
  if (_nifsPioneros.length === 0) { toast('No hay NIFs para exportar', 'error'); return; }
  const csv = 'NIF,Nombre\n' + _nifsPioneros.map(i => `${i.nif},${i.nombre}`).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'nifs_premium_vitryna.csv';
  a.click(); URL.revokeObjectURL(url);
}

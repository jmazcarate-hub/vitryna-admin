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
            <div class="config-field-info"><div class="config-field-label">Modo arranque</div><div class="config-field-desc">Muestra contenido antiguo para que el feed no aparezca vacío en el lanzamiento</div></div>
            <label class="toggle"><input type="checkbox" id="cfg-modo-arranque" ${p.modo_arranque ? 'checked' : ''}><span class="toggle-slider"></span></label>
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

      <div style="display:flex;justify-content:flex-end;margin-top:8px;padding-bottom:40px;">
        <button class="btn-primary" style="padding:12px 32px;font-size:0.95rem;" onclick="guardarConfig()">Guardar configuración</button>
      </div>`;
  } catch (e) { el.innerHTML = '<div class="empty">Error cargando configuración</div>'; }
}

async function guardarConfig() {
  try {
    const params = {
      limite_pubs_free:      parseInt(document.getElementById('cfg-limite-free').value) || 2,
      dias_vida_publicacion: parseInt(document.getElementById('cfg-dias-vida').value) || 7,
      radio_max_km:          parseFloat(document.getElementById('cfg-radio').value) || 3,
      modo_arranque:         document.getElementById('cfg-modo-arranque').checked,
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

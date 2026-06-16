let todosComercios = [];
let filtroCom = 'todos';

async function loadComercios() {
  document.getElementById('tabla-comercios').innerHTML = '<div class="spinner"></div>';
  try {
    const snap = await db.collection('comercios').orderBy('creado_en', 'desc').get();
    todosComercios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const usuariosSnaps = await Promise.all(
      todosComercios.map(c => db.collection('usuarios').doc(c.id).get())
    );
    usuariosSnaps.forEach((uSnap, i) => {
      todosComercios[i].seguidos_count = (uSnap.data()?.amigos || []).length;
    });
    renderComercios();
    if (!document.getElementById('search-comercios')._bound) {
      document.getElementById('search-comercios').addEventListener('input', renderComercios);
      document.getElementById('search-comercios')._bound = true;
      document.querySelectorAll('#filtros-comercios .filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          document.querySelectorAll('#filtros-comercios .filter-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          filtroCom = chip.dataset.filter;
          if (filtroCom === 'bajas') {
            bajasData = [];
            cargarBajas();
          } else {
            renderComercios();
          }
        });
      });
    }
  } catch (e) {
    document.getElementById('tabla-comercios').innerHTML = '<div class="empty">Error cargando comercios</div>';
  }
}

function badgeBoost(val, color) {
  const n = val || 0;
  if (n > 0) return '<span style="background:var(--' + color + '-light);color:var(--' + color + ');padding:2px 8px;border-radius:12px;font-size:0.78rem;font-weight:700;">' + n + '</span>';
  return '<span style="color:var(--text-3);font-size:0.78rem;">—</span>';
}

function renderComercios() {
  const q = document.getElementById('search-comercios').value.toLowerCase();
  const ahora = new Date();
  const lista = todosComercios.filter(c => {
    const plan = c.plan_suscripcion || 'free';
    const ph = c.plan_hasta ? (c.plan_hasta.toDate ? c.plan_hasta.toDate() : new Date(c.plan_hasta)) : null;
    const dias = ph ? Math.ceil((ph - ahora) / 86400000) : null;
    if (filtroCom === 'free'         && plan !== 'free') return false;
    if (filtroCom === 'pro'          && plan !== 'pro') return false;
    if (filtroCom === 'multi'        && plan !== 'multi') return false;
    if (filtroCom === 'caducado'     && !(dias !== null && dias < 0)) return false;
    if (filtroCom === 'vence-pronto' && !(dias !== null && dias >= 0 && dias <= 7)) return false;
    if (filtroCom === 'con-boosts4h'  && !((c.boosts_4h  || 0) > 0)) return false;
    if (filtroCom === 'con-boosts24h' && !((c.boosts_24h || 0) > 0)) return false;
    if (q && !`${c.nombre_comercio} ${c.cif_nif} ${c.email}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const el = document.getElementById('tabla-comercios');
  if (!lista.length) { el.innerHTML = '<div class="empty">No se encontraron comercios</div>'; return; }

  el.innerHTML = `
    <div style="padding:8px 20px;font-size:0.78rem;color:var(--text-2);border-bottom:1px solid var(--border);">
      ${lista.length} comercio${lista.length !== 1 ? 's' : ''}
      ${filtroCom !== 'todos' ? ` · filtro: <strong>${filtroCom}</strong>` : ''}
    </div>
    <table>
      <thead><tr><th>Comercio</th><th>Categoría</th><th>Plan</th><th>Vencimiento</th><th>Stripe</th><th style="text-align:center;">Boosts 4h</th><th style="text-align:center;">Boosts 24h</th><th style="text-align:center;">Seguidores</th><th style="text-align:center;">Siguiendo</th><th>Registro</th><th>Acciones</th></tr></thead>
      <tbody>${lista.map(c => {
        const plan = c.plan_suscripcion || 'free';
        const vi = plan !== 'free' ? vencInfo(c.plan_hasta) : { texto: '—', clase: '' };
        const tieneStripe = !!c.ultimo_pago_stripe;
        const cancelada = !!c.subscription_cancelada;
        const stripeTag = tieneStripe
          ? `<span style="font-size:0.72rem;padding:2px 6px;border-radius:4px;background:${cancelada ? 'var(--red-light)' : 'var(--green-light)'};color:${cancelada ? 'var(--red)' : 'var(--green)'};">${cancelada ? 'Cancelada' : 'Activa'}</span>`
          : '<span style="font-size:0.72rem;color:var(--text-3);">Manual</span>';
        return `<tr>
          <td><div style="font-weight:500">${c.nombre_comercio || '—'}</div><div style="font-size:0.75rem;color:var(--text-2)">${c.email || '—'}</div><div style="font-size:0.75rem;color:var(--text-3)">${c.telefono || '—'}</div></td>
          <td style="color:var(--text-2);font-size:0.83rem">${c.categoria || '—'}</td>
          <td><span class="badge ${plan}">${plan.toUpperCase()}</span></td>
          <td><span class="${vi.clase}">${vi.texto}</span></td>
          <td>${stripeTag}</td>
          <td style="text-align:center;">${badgeBoost(c.boosts_4h, 'orange')}</td>
          <td style="text-align:center;">${badgeBoost(c.boosts_24h, 'blue')}</td>
          <td style="text-align:center;font-size:0.85rem;">${c.seguidores_count || 0}</td>
          <td style="text-align:center;font-size:0.85rem;">${c.seguidos_count || 0}</td>
          <td style="font-size:0.8rem;color:var(--text-2)">${formatDate(c.creado_en)}</td>
          <td><button class="btn-sm" onclick="abrirModalComercio('${c.id}')">Gestionar</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

// ── MODAL COMERCIO ──
let comercioModalId = null;

async function abrirModalComercio(id) {
  const c = todosComercios.find(x => x.id === id);
  if (!c) return;
  comercioModalId = id;

  document.getElementById('modal-comercio-nombre').textContent = c.nombre_comercio || '—';
  document.getElementById('modal-comercio-cat').textContent    = c.categoria || '';
  document.getElementById('mc-cif').textContent    = c.cif_nif || '—';
  document.getElementById('mc-tel').textContent    = c.telefono || '—';
  document.getElementById('mc-email').textContent  = c.email || '—';
  document.getElementById('mc-barrio').textContent = c.barrio || '—';
  document.getElementById('mc-dir').textContent    = c.direccion || '—';
  document.getElementById('mc-reg').textContent        = formatDate(c.creado_en);
  document.getElementById('mc-seguidores').textContent = c.seguidores_count || 0;
  document.getElementById('mc-siguiendo').textContent  = c.seguidos_count   || 0;

  const plan = c.plan_suscripcion || 'free';
  const tieneStripe = !!c.ultimo_pago_stripe;
  const cancelada = !!c.subscription_cancelada;
  document.getElementById('mc-plan').textContent = plan.toUpperCase() +
    (tieneStripe ? (cancelada ? ' · Stripe cancelada' : ' · Stripe activa') : ' · Manual');
  const vi = plan !== 'free' ? vencInfo(c.plan_hasta) : { texto: '—', clase: '' };
  const mcVence = document.getElementById('mc-vence');
  mcVence.textContent = vi.texto;
  mcVence.className   = vi.clase;

  // Stats de publicaciones
  try {
    const pubsSnap = await db.collection('Publicaciones')
      .where('comercio_id', '==', id).get();
    let vistas = 0, clics = 0;
    pubsSnap.docs.forEach(d => {
      vistas += d.data().vistas || 0;
      clics  += d.data().clics  || 0;
    });
    const statsEl = document.getElementById('mc-stats');
    if (statsEl) {
      statsEl.innerHTML = `<span style="font-size:0.8rem;color:var(--text-2)">${pubsSnap.size} pubs · ${vistas} vistas · ${clics} clics</span>`;
    }
  } catch (_) {}

  // Mostrar/ocultar botones según si tiene Stripe activo
  const btnCambiarPlan = document.getElementById('mc-btns-plan');
  if (btnCambiarPlan) {
    if (tieneStripe && (plan === 'pro' || plan === 'multi')) {
      btnCambiarPlan.innerHTML = `
        <div style="padding:10px 12px;background:var(--orange-light);border-radius:8px;font-size:0.82rem;color:var(--orange);">
          ⚠️ Este comercio está en el ciclo de Stripe. El plan se gestiona automáticamente.<br>
          <span style="font-size:0.78rem;color:var(--text-2);">Usa el dashboard de Stripe para modificar la suscripción.</span>
        </div>`;
    } else {
      btnCambiarPlan.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn-secondary" style="width:100%;text-align:left;padding:11px 16px;display:flex;align-items:center;gap:10px;" onclick="cambiarPlanComercio('free')">
            <span style="width:10px;height:10px;border-radius:50%;background:var(--text-3);flex-shrink:0;"></span>Cambiar a <strong>Free</strong>
          </button>
          <button class="btn-secondary" style="width:100%;text-align:left;padding:11px 16px;display:flex;align-items:center;gap:10px;" onclick="cambiarPlanComercio('pro')">
            <span style="width:10px;height:10px;border-radius:50%;background:var(--blue);flex-shrink:0;"></span>Activar <strong>Escaparate Pro</strong> (+30 días)
          </button>
          <button class="btn-secondary" style="width:100%;text-align:left;padding:11px 16px;display:flex;align-items:center;gap:10px;" onclick="cambiarPlanComercio('multi')">
            <span style="width:10px;height:10px;border-radius:50%;background:var(--orange);flex-shrink:0;"></span>Activar <strong>Multi-Barrio</strong> (+30 días)
          </button>
          ${plan !== 'free' ? `
          <button class="btn-secondary" style="width:100%;text-align:left;padding:11px 16px;display:flex;align-items:center;gap:10px;" onclick="renovarPlanComercio()">
            <span style="font-size:1rem;line-height:1;">🔄</span>
            <span style="font-weight:500;">+30 días al plan actual</span>
          </button>` : ''}
          <button class="btn-secondary" style="width:100%;text-align:left;padding:11px 16px;display:flex;align-items:center;gap:10px;border-color:var(--orange);" onclick="activarPilotoComercio()">
            <span style="font-size:1rem;line-height:1;">🚀</span>
            <span style="color:var(--orange);font-weight:500;">Piloto — hasta <strong>31 Dic 2026</strong></span>
          </button>
        </div>`;
    }
  }

  // Sección monedero de boosts
  const mcBoosts = document.getElementById('mc-btns-boosts');
  if (mcBoosts) {
    const b4h  = c.boosts_4h  || 0;
    const b24h = c.boosts_24h || 0;
    mcBoosts.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div style="padding:12px;background:var(--orange-light);border-radius:10px;text-align:center;">
          <div style="font-size:0.72rem;color:var(--orange);font-weight:500;margin-bottom:2px;">Boosts 4h</div>
          <div style="font-size:1.6rem;font-weight:700;color:var(--orange);" id="mc-b4h-val">${b4h}</div>
        </div>
        <div style="padding:12px;background:var(--blue-light);border-radius:10px;text-align:center;">
          <div style="font-size:0.72rem;color:var(--blue);font-weight:500;margin-bottom:2px;">Boosts 24h</div>
          <div style="font-size:1.6rem;font-weight:700;color:var(--blue);" id="mc-b24h-val">${b24h}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <select id="mc-boost-tipo" style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:0.85rem;background:var(--surface);">
          <option value="4h">Boosts 4h</option>
          <option value="24h">Boosts 24h</option>
        </select>
        <input type="number" id="mc-boost-cantidad" value="5" min="1" max="100"
          style="width:70px;padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:0.85rem;background:var(--surface);">
        <button class="btn-secondary" onclick="ajustarBoosts(1)" style="padding:7px 14px;">
          <span style="color:var(--green);font-weight:700;">+ Añadir</span>
        </button>
        <button class="btn-secondary" onclick="ajustarBoosts(-1)" style="padding:7px 14px;">
          <span style="color:var(--red);font-weight:700;">− Restar</span>
        </button>
      </div>`;
  }

  document.getElementById('modal-comercio').classList.add('open');
}

function cerrarModalComercio() {
  document.getElementById('modal-comercio').classList.remove('open');
  comercioModalId = null;
}

async function ajustarBoosts(signo) {
  if (!comercioModalId) return;
  const tipo = document.getElementById('mc-boost-tipo').value;
  const cantidad = parseInt(document.getElementById('mc-boost-cantidad').value) || 1;
  const delta = signo * cantidad;
  const field = tipo === '4h' ? 'boosts_4h' : 'boosts_24h';
  const label = tipo === '4h' ? 'boosts 4h' : 'boosts 24h';
  const accion = signo > 0 ? 'añadir' : 'restar';

  // Verificar que no quede negativo al restar
  const c = todosComercios.find(x => x.id === comercioModalId);
  if (signo < 0) {
    const actual = (tipo === '4h' ? c?.boosts_4h : c?.boosts_24h) || 0;
    if (actual + delta < 0) {
      toast(`No se puede restar más de los ${actual} ${label} disponibles`, 'error');
      return;
    }
  }

  if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} ${cantidad} ${label} al monedero de ${c?.nombre_comercio}?`)) return;

  try {
    await db.collection('comercios').doc(comercioModalId).update({
      [field]: firebase.firestore.FieldValue.increment(delta),
    });
    // Actualizar cache local
    const idx = todosComercios.findIndex(x => x.id === comercioModalId);
    if (idx >= 0) todosComercios[idx][field] = (todosComercios[idx][field] || 0) + delta;

    // Actualizar contadores en el modal
    const nuevoValor = ((tipo === '4h' ? todosComercios[idx]?.boosts_4h : todosComercios[idx]?.boosts_24h) || 0);
    const elVal = document.getElementById(tipo === '4h' ? 'mc-b4h-val' : 'mc-b24h-val');
    if (elVal) elVal.textContent = nuevoValor;

    toast(`${signo > 0 ? '+' : ''}${delta} ${label} ${signo > 0 ? 'añadidos' : 'restados'}`, 'success');
  } catch(e) { toast('Error al ajustar boosts: ' + e.message, 'error'); }
}

async function cambiarPlanComercio(plan) {
  if (!comercioModalId || !confirm(`¿Cambiar el plan a ${plan.toUpperCase()}?`)) return;
  const c = todosComercios.find(x => x.id === comercioModalId);
  // Bloquear si tiene Stripe activo
  if (c && c.ultimo_pago_stripe && (c.plan_suscripcion === 'pro' || c.plan_suscripcion === 'multi')) {
    toast('Comercio en ciclo Stripe — usa el dashboard de Stripe', 'error');
    return;
  }
  try {
    const hasta = plan === 'free' ? null : new Date(Date.now() + 30 * 86400000);
    await db.collection('comercios').doc(comercioModalId).update({
      plan_suscripcion: plan,
      estado_pago: plan !== 'free',
      plan_hasta: hasta ? firebase.firestore.Timestamp.fromDate(hasta) : null,
    });
    const idx = todosComercios.findIndex(c => c.id === comercioModalId);
    if (idx >= 0) {
      todosComercios[idx].plan_suscripcion = plan;
      todosComercios[idx].plan_hasta = hasta ? firebase.firestore.Timestamp.fromDate(hasta) : null;
    }
    toast('Plan actualizado', 'success');
    cerrarModalComercio();
    renderComercios();
  } catch (e) { toast('Error al cambiar plan', 'error'); }
}

async function renovarPlanComercio() {
  if (!comercioModalId) return;
  const c = todosComercios.find(x => x.id === comercioModalId);
  if (!c) return;

  // Bloquear si tiene Stripe activo
  if (c.ultimo_pago_stripe && (c.plan_suscripcion === 'pro' || c.plan_suscripcion === 'multi')) {
    toast('Comercio en ciclo Stripe — usa el dashboard de Stripe', 'error');
    return;
  }

  const precioDefault = c.plan_suscripcion === 'pro' ? '19.90' : '15.98';
  const planNombre = c.plan_suscripcion === 'pro' ? 'Escaparate Pro' : 'Multi-Barrio';

  // Mostrar opciones de renovación inline
  const opcion = await new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:var(--surface);border-radius:16px;padding:24px;width:360px;max-width:90vw;">
        <div style="font-size:1rem;font-weight:600;margin-bottom:4px;">Renovar plan</div>
        <div style="font-size:0.83rem;color:var(--text-2);margin-bottom:16px;">${c.nombre_comercio} · ${planNombre}</div>
        <div style="margin-bottom:12px;">
          <label style="font-size:0.82rem;font-weight:500;">Importe (€)</label>
          <input type="number" id="renovar-importe" value="${precioDefault}" step="0.01" min="0"
            style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:0.9rem;background:var(--bg);">
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button onclick="this.closest('div[style]').dataset.res='con'" class="btn-primary" style="padding:11px;">Renovar con factura</button>
          <button onclick="this.closest('div[style]').dataset.res='sin'" class="btn-secondary" style="padding:11px;">Renovar sin factura</button>
          <button onclick="this.closest('div[style]').dataset.res='piloto'" class="btn-secondary" style="padding:11px;border-color:var(--orange);color:var(--orange);">🚀 Piloto hasta 31 Dic 2026</button>
          <button onclick="this.closest('div[style]').dataset.res='cancel'" class="btn-secondary" style="padding:11px;">Cancelar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('div[style]').addEventListener('click', e => {
      const res = overlay.querySelector('div[style]').dataset.res;
      if (!res) return;
      const importe = parseFloat(document.getElementById('renovar-importe')?.value) || 0;
      document.body.removeChild(overlay);
      resolve({ opcion: res, importe });
    });
  });

  if (!opcion || opcion.opcion === 'cancel') return;

  try {
    if (opcion.opcion === 'piloto') {
      const hasta = new Date('2026-12-31T23:59:59Z');
      await db.collection('comercios').doc(comercioModalId).update({
        plan_hasta: firebase.firestore.Timestamp.fromDate(hasta),
        estado_pago: true,
        piloto: true,
      });
      const idx = todosComercios.findIndex(x => x.id === comercioModalId);
      if (idx >= 0) todosComercios[idx].plan_hasta = firebase.firestore.Timestamp.fromDate(hasta);
      toast('Piloto activo hasta el 31 de Diciembre de 2026', 'success');
    } else {
      // +30 días desde hoy o desde plan_hasta si está vigente
      const ph = c.plan_hasta ? (c.plan_hasta.toDate ? c.plan_hasta.toDate() : new Date(c.plan_hasta)) : new Date();
      const base = ph > new Date() ? ph : new Date();
      const nuevaHasta = new Date(base.getTime() + 30 * 86400000);
      await db.collection('comercios').doc(comercioModalId).update({
        plan_hasta: firebase.firestore.Timestamp.fromDate(nuevaHasta),
        estado_pago: true,
      });
      const idx = todosComercios.findIndex(x => x.id === comercioModalId);
      if (idx >= 0) todosComercios[idx].plan_hasta = firebase.firestore.Timestamp.fromDate(nuevaHasta);

      if (opcion.opcion === 'con' && opcion.importe > 0) {
        await generarFacturaAdmin(comercioModalId, c, `Renovación Plan ${planNombre} — 1 mes`, opcion.importe);
      }
      toast(opcion.opcion === 'con' ? '+30 días añadidos y factura generada' : '+30 días añadidos al plan', 'success');
    }
    cerrarModalComercio();
    renderComercios();
  } catch (e) { toast('Error al renovar plan', 'error'); }
}

async function activarPilotoComercio() {
  if (!comercioModalId || !confirm('¿Activar plan piloto hasta el 31 de Diciembre de 2026?')) return;
  try {
    const hasta = new Date('2026-12-31T23:59:59Z');
    await db.collection('comercios').doc(comercioModalId).update({
      plan_hasta: firebase.firestore.Timestamp.fromDate(hasta),
      estado_pago: true,
      piloto: true,
    });
    const idx = todosComercios.findIndex(c => c.id === comercioModalId);
    if (idx >= 0) todosComercios[idx].plan_hasta = firebase.firestore.Timestamp.fromDate(hasta);
    toast('Piloto activo hasta el 31 de Diciembre de 2026', 'success');
    cerrarModalComercio();
    renderComercios();
  } catch (e) { toast('Error al activar piloto', 'error'); }
}

// ── BAJAS ─────────────────────────────────────────────────────────────────────
let bajasData = [];

async function cargarBajas() {
  const el = document.getElementById('tabla-comercios');
  el.innerHTML = '<div class="spinner"></div>';
  try {
    const snap = await db.collection('stats_comercio').where('activo', '==', false).get();
    bajasData = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.fecha_baja?.seconds || 0) - (a.fecha_baja?.seconds || 0));
    renderBajas();
  } catch(e) {
    el.innerHTML = '<div class="empty">Error cargando bajas</div>';
  }
}

function renderBajas() {
  const el = document.getElementById('tabla-comercios');
  if (!bajasData.length) { el.innerHTML = '<div class="empty">No hay comercios dados de baja</div>'; return; }
  el.innerHTML = `
    <div style="padding:8px 20px;font-size:0.78rem;color:var(--text-2);border-bottom:1px solid var(--border);">
      ${bajasData.length} baja${bajasData.length !== 1 ? 's' : ''}
    </div>
    <table>
      <thead><tr>
        <th>Comercio</th><th>Plan tenía</th><th>Barrio</th>
        <th>Fecha baja</th><th>Motivo</th><th>Email enviado</th><th>Acción</th>
      </tr></thead>
      <tbody>${bajasData.map(c => {
        const plan = c.plan_suscripcion || 'free';
        const yaEnviado = !!c.retencion_enviado;
        const motivoLabels = {
          precio: 'Precio alto', resultados: 'Sin resultados',
          tiempo: 'Sin tiempo', canal: 'Otro canal', otro: 'Otro',
        };
        const motivoTexto = c.motivo_baja ? (motivoLabels[c.motivo_baja] || c.motivo_baja) : '—';
        return `<tr>
          <td>
            <div style="font-weight:500">${c.nombre_comercio || '—'}</div>
            <div style="font-size:0.75rem;color:var(--text-2)">${c.email || '—'}</div>
            <div style="font-size:0.75rem;color:var(--text-3)">${c.telefono || '—'}</div>
          </td>
          <td><span class="badge ${plan}">${plan.toUpperCase()}</span></td>
          <td style="font-size:0.83rem;color:var(--text-2)">${c.barrio || '—'}</td>
          <td style="font-size:0.8rem;color:var(--text-2)">${formatDate(c.fecha_baja)}</td>
          <td style="font-size:0.8rem;${c.motivo_baja ? 'color:var(--orange);font-weight:500' : 'color:var(--text-3)'}">
            ${motivoTexto}
          </td>
          <td style="font-size:0.8rem;${yaEnviado ? 'color:var(--green)' : 'color:var(--text-3)'}">
            ${yaEnviado ? '✓ ' + formatDate(c.retencion_enviado) : '—'}
          </td>
          <td>
            <button class="btn-sm" id="btn-ret-${c.id}" onclick="enviarEmailRetencion('${c.id}', this)">
              ${yaEnviado ? 'Reenviar' : 'Enviar email'}
            </button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

async function enviarEmailRetencion(id, btn) {
  const c = bajasData.find(x => x.id === id);
  if (!c?.email) { toast('Este comercio no tiene email', 'error'); return; }
  if (!confirm(`¿Enviar email de retención a ${c.nombre_comercio} (${c.email})?`)) return;
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  try {
    const fn = firebase.app().functions('europe-west1').httpsCallable('enviarEmailRetencion');
    await fn({ comercioId: id });
    const idx = bajasData.findIndex(x => x.id === id);
    if (idx >= 0) bajasData[idx].retencion_enviado = firebase.firestore.Timestamp.now();
    toast('Email de retención enviado', 'success');
    renderBajas();
  } catch(e) {
    btn.disabled = false;
    btn.textContent = 'Enviar email';
    toast('Error al enviar: ' + (e.message || e), 'error');
  }
}

async function generarFacturaAdmin(comercioId, comercio, concepto, importeTotal) {
  // Leer datos del emisor y contador de facturas
  const [emisorDoc, facturacionDoc, paramsDoc] = await Promise.all([
    db.collection('config').doc('emisor').get(),
    db.collection('config').doc('facturacion').get(),
    db.collection('config').doc('parametros').get(),
  ]);
  const emisor   = emisorDoc.data() || {};
  const facData  = facturacionDoc.data() || {};
  const params   = paramsDoc.data() || {};
  const ivaPct   = emisor.iva || params.iva || 21;
  const anio     = new Date().getFullYear();
  const contador = (facData.anio === anio ? (facData.contador || 0) : 0) + 1;
  const numero   = `${anio}-${String(contador).padStart(4, '0')}`;

  await db.collection('config').doc('facturacion').set({ anio, contador }, { merge: true });

  await db.collection('facturas').add({
    numero,
    fecha: firebase.firestore.Timestamp.fromDate(new Date()),
    comercio_id: comercioId,
    nombre_comercio: comercio.nombre_comercio || '',
    concepto,
    importe_total: importeTotal,
    iva_pct: ivaPct,
    url_pdf: null,
    creado_en: firebase.firestore.FieldValue.serverTimestamp(),
    origen: 'admin_web',
  });
}

async function eliminarComercioModal() {
  if (!comercioModalId) return;
  const c = todosComercios.find(x => x.id === comercioModalId);
  if (!confirm(`¿Eliminar el comercio "${c?.nombre_comercio}"?\n\nSe eliminarán:\n• Todas sus publicaciones, estadísticas y fotos\n• Su fachada\n• Sus solicitudes\n• Su cuenta de usuario y Auth\n• Se eliminará de la lista de amigos de todos los vecinos\n\nLas facturas se conservan. Esta acción no se puede deshacer.`)) return;
  try {
    const eliminar = firebase.app().functions('europe-west1').httpsCallable('eliminarComercioCompleto');
    await eliminar({ comercioId: comercioModalId });
    todosComercios = todosComercios.filter(x => x.id !== comercioModalId);
    cerrarModalComercio();
    renderComercios();
    toast('Comercio eliminado completamente', 'success');
  } catch (e) {
    console.error('Error eliminando comercio:', e);
    toast('Error al eliminar: ' + (e.message || e), 'error');
  }
}

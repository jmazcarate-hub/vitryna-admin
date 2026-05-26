let todosComercios = [];
let filtroCom = 'todos';

async function loadComercios() {
  document.getElementById('tabla-comercios').innerHTML = '<div class="spinner"></div>';
  try {
    const snap = await db.collection('comercios').orderBy('creado_en', 'desc').get();
    todosComercios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderComercios();
    if (!document.getElementById('search-comercios')._bound) {
      document.getElementById('search-comercios').addEventListener('input', renderComercios);
      document.getElementById('search-comercios')._bound = true;
      document.querySelectorAll('#filtros-comercios .filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          document.querySelectorAll('#filtros-comercios .filter-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          filtroCom = chip.dataset.filter;
          renderComercios();
        });
      });
    }
  } catch (e) {
    document.getElementById('tabla-comercios').innerHTML = '<div class="empty">Error cargando comercios</div>';
  }
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
      <thead><tr><th>Comercio</th><th>Categoría</th><th>Plan</th><th>Vencimiento</th><th>Registro</th><th>Acciones</th></tr></thead>
      <tbody>${lista.map(c => {
        const plan = c.plan_suscripcion || 'free';
        const vi = plan !== 'free' ? vencInfo(c.plan_hasta) : { texto: '—', clase: '' };
        return `<tr>
          <td><div style="font-weight:500">${c.nombre_comercio || '—'}</div><div style="font-size:0.75rem;color:var(--text-2)">${c.email || c.telefono || ''}</div></td>
          <td style="color:var(--text-2);font-size:0.83rem">${c.categoria || '—'}</td>
          <td><span class="badge ${plan}">${plan.toUpperCase()}</span></td>
          <td><span class="${vi.clase}">${vi.texto}</span></td>
          <td style="font-size:0.8rem;color:var(--text-2)">${formatDate(c.creado_en)}</td>
          <td><button class="btn-sm" onclick="abrirModalComercio('${c.id}')">Gestionar</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

// ── MODAL COMERCIO ──
let comercioModalId = null;

function abrirModalComercio(id) {
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
  document.getElementById('mc-reg').textContent    = formatDate(c.creado_en);
  const plan = c.plan_suscripcion || 'free';
  document.getElementById('mc-plan').textContent   = plan.toUpperCase();
  const vi = plan !== 'free' ? vencInfo(c.plan_hasta) : { texto: '—', clase: '' };
  const mcVence = document.getElementById('mc-vence');
  mcVence.textContent = vi.texto;
  mcVence.className   = vi.clase;
  document.getElementById('modal-comercio').classList.add('open');
}
function cerrarModalComercio() {
  document.getElementById('modal-comercio').classList.remove('open');
  comercioModalId = null;
}
async function cambiarPlanComercio(plan) {
  if (!comercioModalId || !confirm(`¿Cambiar el plan a ${plan.toUpperCase()}?`)) return;
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
async function eliminarComercioModal() {
  if (!comercioModalId) return;
  const c = todosComercios.find(x => x.id === comercioModalId);
  if (!confirm(`¿Eliminar el comercio "${c?.nombre_comercio}"?\n\nEsta acción no se puede deshacer.`)) return;
  try {
    await db.collection('comercios').doc(comercioModalId).delete();
    await db.collection('usuarios').doc(comercioModalId).delete();
    todosComercios = todosComercios.filter(x => x.id !== comercioModalId);
    cerrarModalComercio();
    renderComercios();
    toast('Comercio eliminado', 'success');
  } catch (e) { toast('Error al eliminar', 'error'); }
}

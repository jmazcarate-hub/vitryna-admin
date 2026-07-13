let todasPubsSpam = [];
let comerciosSpamCache = {}; // comercioId -> datos del comercio (email, aviso_spam_enviado)
let umbralMinutosSpam = 30;
let umbralSimilitudSpam = 0.7;
const VENTANA_COMPARACION_SPAM = 5; // comparar cada pub contra las N anteriores del mismo comercio

async function loadSpam() {
  const el = document.getElementById('tabla-spam');
  el.innerHTML = '<div class="spinner"></div>';
  try {
    const snap = await db.collection('Publicaciones').orderBy('timestamp', 'desc').limit(1000).get();
    todasPubsSpam = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    await renderSpam();

    if (!document.getElementById('filtros-spam-tiempo')._bound) {
      document.querySelectorAll('#filtros-spam-tiempo .filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          document.querySelectorAll('#filtros-spam-tiempo .filter-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          umbralMinutosSpam = Number(chip.dataset.minutos);
          renderSpam();
        });
      });
      document.querySelectorAll('#filtros-spam-similitud .filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          document.querySelectorAll('#filtros-spam-similitud .filter-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          umbralSimilitudSpam = Number(chip.dataset.similitud);
          renderSpam();
        });
      });
      document.getElementById('filtros-spam-tiempo')._bound = true;
    }
  } catch (e) {
    console.error('Error cargando publicaciones para spam:', e);
    el.innerHTML = '<div class="empty">Error cargando publicaciones</div>';
  }
}

// ── Normalización y similitud de texto ──────────────────────────────────────
function normalizarTextoSpam(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similitudJaccard(a, b) {
  const wordsA = new Set(normalizarTextoSpam(a).split(' ').filter(Boolean));
  const wordsB = new Set(normalizarTextoSpam(b).split(' ').filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let interseccion = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) interseccion++; });
  const union = wordsA.size + wordsB.size - interseccion;
  return union === 0 ? 0 : interseccion / union;
}

function tsToMsSpam(ts) {
  if (!ts) return 0;
  return (ts.toDate ? ts.toDate() : new Date(ts)).getTime();
}

// ── Detección de incidencias ─────────────────────────────────────────────────
// Compara cada publicación con las N anteriores del mismo comercio (ordenadas
// cronológicamente) y marca una incidencia solo si se cumplen AMBAS condiciones
// a la vez: están dentro de la ventana de tiempo Y su texto (título+descripción)
// supera el umbral de similitud. Con OR, una ventana amplia (24h) marcaba
// como spam cualquier par de publicaciones sin relación entre sí solo por
// coincidir el mismo día — actividad normal de un comercio activo.
function detectarIncidenciasSpam() {
  const porComercio = {};
  todasPubsSpam.forEach(p => {
    if (!p.comercio_id) return;
    (porComercio[p.comercio_id] = porComercio[p.comercio_id] || []).push(p);
  });

  const incidencias = [];
  Object.values(porComercio).forEach(pubs => {
    const ordenadas = [...pubs].sort((a, b) => tsToMsSpam(a.timestamp) - tsToMsSpam(b.timestamp));
    for (let i = 1; i < ordenadas.length; i++) {
      const actual = ordenadas[i];
      const inicio = Math.max(0, i - VENTANA_COMPARACION_SPAM);
      for (let j = inicio; j < i; j++) {
        const anterior = ordenadas[j];
        const diffMin = (tsToMsSpam(actual.timestamp) - tsToMsSpam(anterior.timestamp)) / 60000;
        const similitud = similitudJaccard(
          `${anterior.titulo} ${anterior.descripcion}`,
          `${actual.titulo} ${actual.descripcion}`
        );
        const porTiempo = diffMin <= umbralMinutosSpam;
        const porSimilitud = similitud >= umbralSimilitudSpam;
        if (porTiempo && porSimilitud) {
          incidencias.push({ anterior, actual, diffMin, similitud, porTiempo, porSimilitud });
        }
      }
    }
  });
  incidencias.sort((a, b) => tsToMsSpam(b.actual.timestamp) - tsToMsSpam(a.actual.timestamp));
  return incidencias;
}

// ── Render ────────────────────────────────────────────────────────────────
async function renderSpam() {
  const el = document.getElementById('tabla-spam');
  const incidencias = detectarIncidenciasSpam();

  if (!incidencias.length) {
    el.innerHTML = '<div class="empty">No se han detectado publicaciones sospechosas con estos filtros</div>';
    return;
  }

  const comercioIds = [...new Set(incidencias.map(i => i.actual.comercio_id))];
  await cargarComerciosSpam(comercioIds);

  const porComercioGrupo = {};
  incidencias.forEach(inc => {
    (porComercioGrupo[inc.actual.comercio_id] = porComercioGrupo[inc.actual.comercio_id] || []).push(inc);
  });

  el.innerHTML = `
    <div style="padding:8px 20px;font-size:0.78rem;color:var(--text-2);border-bottom:1px solid var(--border);">
      ${incidencias.length} incidencia${incidencias.length !== 1 ? 's' : ''} en ${comercioIds.length} comercio${comercioIds.length !== 1 ? 's' : ''}
    </div>
    ${Object.entries(porComercioGrupo).map(([comercioId, grupo]) => renderGrupoComercioSpam(comercioId, grupo)).join('')}
  `;
}

async function cargarComerciosSpam(comercioIds) {
  const faltan = comercioIds.filter(id => !comerciosSpamCache[id]);
  if (!faltan.length) return;
  const docs = await Promise.all(faltan.map(id => db.collection('comercios').doc(id).get()));
  docs.forEach((doc, i) => {
    comerciosSpamCache[faltan[i]] = doc.exists ? doc.data() : null;
  });
}

function renderGrupoComercioSpam(comercioId, grupo) {
  const nombreComercio = grupo[0].actual.nombre_comercio || 'Comercio';
  const comercio = comerciosSpamCache[comercioId];
  const yaEnviado = comercio?.aviso_spam_enviado;
  const tieneEmail = !!comercio?.email;

  return `
    <div style="border-bottom:1px solid var(--border);">
      <div style="padding:12px 20px;background:var(--bg);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:8px;">
          <strong style="font-size:0.88rem;">${nombreComercio}</strong>
          <span class="badge inactivo">${grupo.length} incidencia${grupo.length !== 1 ? 's' : ''}</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          ${yaEnviado ? `<span style="font-size:0.75rem;color:var(--green)">✓ Aviso enviado ${formatDate(yaEnviado)}</span>` : ''}
          <button class="btn-sm" ${tieneEmail ? '' : 'disabled title="Sin email registrado"'}
            onclick="enviarAvisoSpam('${comercioId}', this)">
            ${yaEnviado ? 'Reenviar aviso' : 'Enviar aviso'}
          </button>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table>
          <thead><tr><th></th><th>Publicación anterior</th><th></th><th>Publicación nueva</th><th>Motivo</th><th></th></tr></thead>
          <tbody>${grupo.map(inc => renderFilaIncidenciaSpam(inc)).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

function fotoThumbSpam(pub) {
  const src = pub.foto_url || pub.fachada_url || '';
  if (!src) {
    return `<div style="width:44px;height:44px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;color:var(--text-3);font-size:0.7rem;">—</div>`;
  }
  return `<img src="${src}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;border:1px solid var(--border);">`;
}

function formatearDiffSpam(min) {
  if (min < 1) return '<1 min';
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 1440) return `${(min / 60).toFixed(1)} h`;
  return `${(min / 1440).toFixed(1)} d`;
}

function renderFilaIncidenciaSpam(inc) {
  const { anterior, actual, diffMin, similitud, porTiempo, porSimilitud } = inc;
  const motivos = [
    porTiempo ? `<span class="badge inactivo">⏱ ${formatearDiffSpam(diffMin)}</span>` : '',
    porSimilitud ? `<span class="badge inactivo">🔁 ${Math.round(similitud * 100)}% similar</span>` : '',
  ].join(' ');

  return `<tr>
    <td>${fotoThumbSpam(anterior)}</td>
    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.83rem;">
      ${anterior.titulo || '—'}<br><span style="font-size:0.72rem;color:var(--text-3)">${formatDate(anterior.timestamp)}</span>
    </td>
    <td>${fotoThumbSpam(actual)}</td>
    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.83rem;">
      ${actual.titulo || '—'}<br><span style="font-size:0.72rem;color:var(--text-3)">${formatDate(actual.timestamp)}</span>
    </td>
    <td>${motivos}</td>
    <td><button class="btn-sm danger" onclick="eliminarPubSpam('${actual.id}', this)">Eliminar nueva</button></td>
  </tr>`;
}

// ── Acciones ──────────────────────────────────────────────────────────────
async function enviarAvisoSpam(comercioId, btn) {
  const comercio = comerciosSpamCache[comercioId];
  if (!comercio?.email) { toast('Este comercio no tiene email', 'error'); return; }
  if (!confirm(`¿Enviar aviso de posible spam a ${comercio.nombre_comercio} (${comercio.email})?`)) return;
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  try {
    const fn = firebase.app().functions('europe-west1').httpsCallable('enviarAvisoSpam');
    await fn({ comercioId });
    comerciosSpamCache[comercioId] = { ...comercio, aviso_spam_enviado: new Date() };
    toast('Aviso enviado', 'success');
    renderSpam();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Enviar aviso';
    toast('Error al enviar: ' + (e.message || e), 'error');
  }
}

async function eliminarPubSpam(id, btn) {
  if (!confirm('¿Eliminar esta publicación?\n\nSe eliminará la publicación, sus estadísticas y la foto. Esta acción no se puede deshacer.')) return;
  btn.disabled = true;
  btn.textContent = 'Eliminando...';
  try {
    const eliminar = firebase.app().functions('europe-west1').httpsCallable('eliminarPublicacionCompleta');
    await eliminar({ publicacionId: id });
    todasPubsSpam = todasPubsSpam.filter(p => p.id !== id);
    toast('Publicación eliminada', 'success');
    renderSpam();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Eliminar nueva';
    toast('Error al eliminar: ' + (e.message || e), 'error');
  }
}

async function loadFinanzas() {
  const el = document.getElementById('finanzas-content');
  try {
    const hoy = new Date();
    const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioVentana6m = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1);

    const [snap, paramSnap, facturacionDoc, facVentanaSnap] = await Promise.all([
      db.collection('comercios').get(),
      db.collection('config').doc('parametros').get(),
      db.collection('config').doc('facturacion').get(),
      db.collection('facturas')
        .where('fecha', '>=', firebase.firestore.Timestamp.fromDate(inicioVentana6m))
        .orderBy('fecha', 'asc')
        .get(),
    ]);
    const paramData   = paramSnap.data() || {};
    const precioPro   = paramData.precio_plan_pro   || 19.90;
    const precioMulti = paramData.precio_plan_multi  || 15.98;
    const coms  = snap.docs.map(d => d.data());
    const pro   = coms.filter(c => c.plan_suscripcion === 'pro').length;
    const multi = coms.filter(c => c.plan_suscripcion === 'multi').length;
    const contribPro   = pro * precioPro;
    const contribMulti = multi * precioMulti;
    const mrr   = (contribPro + contribMulti).toFixed(2);
    const arr   = (mrr * 12).toFixed(2);

    // Leer contador de facturas
    const facData = facturacionDoc.data() || {};
    const anioActual = hoy.getFullYear();
    const contadorActual = facData.anio === anioActual ? (facData.contador || 0) : 0;

    // Facturas de los últimos 6 meses, para boosts del mes y evolución del MRR
    const facturasVentana = facVentanaSnap.docs.map(d => d.data());
    const fechaDe = f => (f.fecha?.toDate ? f.fecha.toDate() : new Date(f.fecha));

    const boostsMes = facturasVentana.filter(f =>
      fechaDe(f) >= inicioMesActual && f.tipo === 'boost'
    );
    const boostsMesCount   = boostsMes.length;
    const boostsMesImporte = boostsMes.reduce((s, f) => s + (Number(f.importe_total) || 0), 0);
    const boostsMes4h  = boostsMes.filter(f => f.duracion === '4h').length;
    const boostsMes24h = boostsMes.filter(f => f.duracion === '24h').length;

    // Evolución del MRR — suma de facturas de planes (Pro/Multi) por mes, últimos 6 meses.
    // Aproximación a partir de facturas emitidas (no hay snapshot histórico de MRR real);
    // post-Stripe en vivo esto se sustituirá por el MRR reportado por el propio Dashboard.
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      meses.push({ anio: d.getFullYear(), mes: d.getMonth(), label: d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }), valor: 0 });
    }
    facturasVentana.forEach(f => {
      if (f.tipo !== 'plan') return;
      const fecha = fechaDe(f);
      const bucket = meses.find(m => m.anio === fecha.getFullYear() && m.mes === fecha.getMonth());
      if (bucket) bucket.valor += Number(f.importe_total) || 0;
    });

    // Proyección a 12 meses — tasa de crecimiento medio mensual sobre los tramos con datos
    const tasas = [];
    for (let i = 1; i < meses.length; i++) {
      if (meses[i - 1].valor > 0 && meses[i].valor > 0) {
        tasas.push((meses[i].valor - meses[i - 1].valor) / meses[i - 1].valor);
      }
    }
    let proyeccion = null;
    if (tasas.length > 0) {
      const tasaMedia = tasas.reduce((a, b) => a + b, 0) / tasas.length;
      proyeccion = { tasaMedia, proyectado: parseFloat(mrr) * Math.pow(1 + tasaMedia, 12) };
    }

    const maxMes = Math.max(...meses.map(m => m.valor), 1);
    const barrasHtml = meses.map(m => {
      const alto = Math.max(Math.round((m.valor / maxMes) * 100), m.valor > 0 ? 4 : 2);
      return `
        <div style="flex:1;min-width:56px;display:flex;flex-direction:column;align-items:center;gap:6px;" title="${m.label}: ${m.valor.toFixed(2)}€">
          <div style="font-size:0.7rem;color:var(--text-2);white-space:nowrap;">${m.valor > 0 ? m.valor.toFixed(0) + '€' : '—'}</div>
          <div style="width:100%;max-width:34px;height:${alto}px;background:var(--blue);border-radius:6px 6px 2px 2px;"></div>
          <div style="font-size:0.7rem;color:var(--text-2);white-space:nowrap;">${m.label}</div>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:16px;">
        <div style="padding:20px;background:var(--blue-light);border-radius:12px;text-align:center">
          <div style="font-size:0.78rem;color:var(--blue);font-weight:500;margin-bottom:6px">MRR Estimado</div>
          <div style="font-size:2rem;font-weight:700;color:var(--blue)">${mrr}€</div>
          <div style="font-size:0.72rem;color:var(--text-2);margin-top:4px">Ingresos mensuales recurrentes</div>
        </div>
        <div style="padding:20px;background:var(--orange-light);border-radius:12px;text-align:center">
          <div style="font-size:0.78rem;color:var(--orange);font-weight:500;margin-bottom:6px">ARR Proyectado</div>
          <div style="font-size:2rem;font-weight:700;color:var(--orange)">${arr}€</div>
          <div style="font-size:0.72rem;color:var(--text-2);margin-top:4px">Ingresos anuales recurrentes</div>
        </div>
        <div style="padding:20px;background:var(--green-light);border-radius:12px;text-align:center">
          <div style="font-size:0.78rem;color:var(--green);font-weight:500;margin-bottom:6px">Comercios de pago</div>
          <div style="font-size:2rem;font-weight:700;color:var(--green)">${pro + multi}</div>
          <div style="font-size:0.72rem;color:var(--text-2);margin-top:4px">${pro} Pro · ${multi} Multi</div>
        </div>
      </div>
      <div style="padding:16px;background:var(--bg);border-radius:10px;font-size:0.83rem;color:var(--text-2);margin-bottom:24px;">
        💡 Los ingresos reales se gestionan desde Stripe. Estos valores son estimados a partir de los planes activos en Firestore.
      </div>

      <!-- Comercios por plan y su contribución al MRR -->
      <div style="margin-bottom:24px;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px;">
        <div style="font-size:0.95rem;font-weight:600;margin-bottom:12px;">Comercios por plan</div>
        <div style="overflow-x:auto;">
        <table style="width:100%;min-width:420px;border-collapse:collapse;font-size:0.84rem;">
          <thead>
            <tr style="border-bottom:2px solid var(--border);color:var(--text-2);font-size:0.78rem;font-weight:500;">
              <th style="text-align:left;padding:6px 10px;">Plan</th>
              <th style="text-align:right;padding:6px 10px;">Comercios</th>
              <th style="text-align:right;padding:6px 10px;">Precio</th>
              <th style="text-align:right;padding:6px 10px;">Contribución MRR</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:8px 10px;">Escaparate Pro</td>
              <td style="padding:8px 10px;text-align:right;">${pro}</td>
              <td style="padding:8px 10px;text-align:right;">${precioPro.toFixed(2)}€</td>
              <td style="padding:8px 10px;text-align:right;font-weight:600;color:var(--blue);">${contribPro.toFixed(2)}€</td>
            </tr>
            <tr>
              <td style="padding:8px 10px;">Multi-Barrio</td>
              <td style="padding:8px 10px;text-align:right;">${multi}</td>
              <td style="padding:8px 10px;text-align:right;">${precioMulti.toFixed(2)}€</td>
              <td style="padding:8px 10px;text-align:right;font-weight:600;color:var(--blue);">${contribMulti.toFixed(2)}€</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      <!-- Boosts del mes + Proyección 12 meses -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:24px;">
        <div style="padding:20px;background:var(--surface);border:1px solid var(--border);border-radius:12px;">
          <div style="font-size:0.78rem;color:var(--text-2);font-weight:500;margin-bottom:6px">Boosts vendidos este mes</div>
          <div style="font-size:1.7rem;font-weight:700;color:var(--text)">${boostsMesCount}</div>
          <div style="font-size:0.72rem;color:var(--text-2);margin-top:4px">${boostsMesImporte.toFixed(2)}€ en ventas · ${boostsMes4h} de 4h · ${boostsMes24h} de 24h</div>
        </div>
        <div style="padding:20px;background:var(--surface);border:1px solid var(--border);border-radius:12px;">
          <div style="font-size:0.78rem;color:var(--text-2);font-weight:500;margin-bottom:6px">Proyección a 12 meses</div>
          ${proyeccion ? `
            <div style="font-size:1.7rem;font-weight:700;color:var(--text)">${proyeccion.proyectado.toFixed(2)}€</div>
            <div style="font-size:0.72rem;color:var(--text-2);margin-top:4px">Si se mantiene el ritmo actual (${(proyeccion.tasaMedia * 100).toFixed(1)}% mensual)</div>
          ` : `
            <div style="font-size:1rem;color:var(--text-2);">Datos insuficientes</div>
            <div style="font-size:0.72rem;color:var(--text-3);margin-top:4px">Hace falta histórico de al menos 2 meses con facturación de planes</div>
          `}
        </div>
      </div>

      <!-- Evolución del MRR — últimos 6 meses -->
      <div style="margin-bottom:24px;padding:16px 20px 20px;background:var(--surface);border:1px solid var(--border);border-radius:12px;">
        <div style="font-size:0.95rem;font-weight:600;margin-bottom:14px;">Evolución del MRR — últimos 6 meses</div>
        <div style="overflow-x:auto;">
          <div style="display:flex;align-items:flex-end;gap:10px;height:140px;min-width:380px;padding:0 4px;">
            ${barrasHtml}
          </div>
        </div>
        <div style="font-size:0.72rem;color:var(--text-3);margin-top:12px;">Aproximado a partir de las facturas de planes emitidas cada mes.</div>
      </div>

      <!-- Acceso a Stripe -->
      <div style="margin-bottom:24px;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
          <div style="font-size:0.95rem;font-weight:600;">Acceso a Stripe</div>
          <a href="https://dashboard.stripe.com/payments" target="_blank" rel="noopener" class="btn-secondary" style="text-decoration:none;">Abrir panel de Stripe ↗</a>
        </div>
        <div id="fin-stripe-resumen"><div class="spinner"></div></div>
      </div>

      <!-- Contador de facturas -->
      <div style="margin-bottom:28px;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px;">
        <div style="font-size:0.95rem;font-weight:600;margin-bottom:4px;">Contador de facturas</div>
        <div style="font-size:0.82rem;color:var(--text-2);margin-bottom:12px;">
          Año en curso: <strong>${anioActual}</strong> · Última factura emitida: <strong>${anioActual}-${String(contadorActual).padStart(4,'0')}</strong>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <div>
            <label style="font-size:0.78rem;color:var(--text-2);display:block;margin-bottom:3px;">Último número emitido</label>
            <input type="number" id="fin-contador" value="${contadorActual}" min="0"
              style="width:100px;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:0.9rem;background:var(--bg);">
          </div>
          <div style="padding-top:18px;">
            <button class="btn-secondary" onclick="guardarContadorFacturas(${anioActual})">Guardar contador</button>
          </div>
          <div style="padding-top:18px;">
            <button class="btn-secondary" style="border-color:var(--orange);color:var(--orange);" onclick="resetContadorAnio()">↺ Reset para nuevo año</button>
          </div>
        </div>
        <div style="font-size:0.75rem;color:var(--text-3);margin-top:8px;">
          ⚠️ Modifica solo si necesitas corregir un error o iniciar un nuevo ejercicio fiscal. La próxima factura usará el número siguiente al que establezcas aquí.
        </div>
      </div>

      <div style="font-size:0.95rem;font-weight:600;color:var(--text);margin-bottom:14px;">Facturas emitidas</div>
      <div id="tabla-facturas-fin"><div class="spinner"></div></div>`;

    loadResumenStripe();

    // Cargar facturas
    const facSnap = await db.collection('facturas')
      .orderBy('fecha', 'desc')
      .limit(200)
      .get();

    const tfEl = document.getElementById('tabla-facturas-fin');
    if (facSnap.empty) {
      tfEl.innerHTML = '<div class="empty">No hay facturas todavía</div>';
    } else {
      const rows = facSnap.docs.map(d => {
        const f = d.data();
        const fecha = f.fecha ? formatDate(f.fecha) : '—';
        const importe = f.importe_total != null
          ? Number(f.importe_total).toFixed(2).replace('.', ',') + ' €'
          : '—';
        // Facturas nuevas: enlace estable (facturaId+token) que resuelve una signed URL
        // al vuelo en descargarFactura — el PDF ya no es público en Storage.
        // Facturas antiguas (sin download_token) conservan su url_pdf pública original.
        const pdfUrl = f.download_token
          ? `https://europe-west1-mi-barrio-vivo-ba557.cloudfunctions.net/descargarFactura?facturaId=${d.id}&token=${f.download_token}`
          : f.url_pdf;
        const pdf = pdfUrl
          ? `<a href="${pdfUrl}" target="_blank" style="color:var(--blue);font-size:0.82rem;display:inline-flex;align-items:center;gap:4px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>PDF</a>`
          : '—';
        return `<tr>
          <td style="font-weight:500;color:var(--blue)">${f.numero || '—'}</td>
          <td>${fecha}</td>
          <td>${escapeHtml(f.nombre_comercio) || '—'}</td>
          <td style="color:var(--text-2);font-size:0.82rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(f.concepto) || '—'}</td>
          <td style="font-weight:600">${importe}</td>
          <td>${pdf}</td>
        </tr>`;
      }).join('');

      tfEl.innerHTML = `
        <div style="overflow-x:auto;">
        <table style="width:100%;min-width:640px;border-collapse:collapse;font-size:0.84rem;">
          <thead>
            <tr style="border-bottom:2px solid var(--border);color:var(--text-2);font-size:0.78rem;font-weight:500;">
              <th style="text-align:left;padding:8px 10px;">Nº Factura</th>
              <th style="text-align:left;padding:8px 10px;">Fecha</th>
              <th style="text-align:left;padding:8px 10px;">Comercio</th>
              <th style="text-align:left;padding:8px 10px;">Concepto</th>
              <th style="text-align:left;padding:8px 10px;">Importe</th>
              <th style="text-align:left;padding:8px 10px;">PDF</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        </div>`;

      tfEl.querySelectorAll('tbody tr').forEach((tr, i) => {
        tr.style.borderBottom = '1px solid var(--border)';
        if (i % 2 === 0) tr.style.background = 'var(--bg)';
      });
    }

  } catch (e) {
    el.innerHTML = '<div class="empty">Error cargando finanzas</div>';
    console.error('loadFinanzas error:', e);
  }
}

async function loadResumenStripe() {
  const el = document.getElementById('fin-stripe-resumen');
  if (!el) return;
  try {
    const fn = firebase.app().functions('europe-west1').httpsCallable('obtenerResumenStripe');
    const { data } = await fn();
    const pagos    = data.pagos    || [];
    const disputas = data.disputas || [];

    const filaPago = p => `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:7px 10px;font-size:0.82rem;">${new Date(p.fecha).toLocaleDateString('es-ES')}</td>
      <td style="padding:7px 10px;font-size:0.82rem;color:var(--text-2);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(p.descripcion) || '—'}</td>
      <td style="padding:7px 10px;font-size:0.82rem;text-align:right;font-weight:600;">${p.importe.toFixed(2)} ${p.moneda.toUpperCase()}</td>
      <td style="padding:7px 10px;font-size:0.78rem;color:${p.estado === 'succeeded' ? 'var(--green)' : 'var(--text-2)'};">${p.estado}</td>
    </tr>`;

    const filaDisputa = d => `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:7px 10px;font-size:0.82rem;">${new Date(d.fecha).toLocaleDateString('es-ES')}</td>
      <td style="padding:7px 10px;font-size:0.82rem;text-align:right;font-weight:600;">${d.importe.toFixed(2)} ${d.moneda.toUpperCase()}</td>
      <td style="padding:7px 10px;font-size:0.78rem;color:var(--orange);">${escapeHtml(d.motivo) || '—'}</td>
      <td style="padding:7px 10px;font-size:0.78rem;color:var(--text-2);">${d.estado}</td>
    </tr>`;

    el.innerHTML = `
      <div style="font-size:0.8rem;font-weight:600;color:var(--text-2);margin-bottom:6px;">Últimos pagos</div>
      ${pagos.length
        ? `<div style="overflow-x:auto;margin-bottom:18px;"><table style="width:100%;min-width:420px;border-collapse:collapse;">${pagos.map(filaPago).join('')}</table></div>`
        : '<div class="empty" style="padding:10px 0;margin-bottom:18px;">Sin pagos recientes</div>'}
      <div style="font-size:0.8rem;font-weight:600;color:var(--text-2);margin-bottom:6px;">Disputas</div>
      ${disputas.length
        ? `<div style="overflow-x:auto;"><table style="width:100%;min-width:380px;border-collapse:collapse;">${disputas.map(filaDisputa).join('')}</table></div>`
        : '<div class="empty" style="padding:10px 0;">Sin disputas</div>'}
    `;
  } catch (e) {
    el.innerHTML = '<div class="empty">No se pudo cargar el resumen de Stripe</div>';
    console.error('loadResumenStripe error:', e);
  }
}

async function guardarContadorFacturas(anio) {
  const val = parseInt(document.getElementById('fin-contador').value) || 0;
  if (!confirm(`¿Establecer el contador de facturas a ${val} para el año ${anio}?\nLa próxima factura será ${anio}-${String(val + 1).padStart(4,'0')}`)) return;
  try {
    await db.collection('config').doc('facturacion').set({ anio, contador: val }, { merge: true });
    toast('Contador actualizado', 'success');
  } catch (e) { toast('Error al guardar contador', 'error'); }
}

async function resetContadorAnio() {
  const anioNuevo = new Date().getFullYear();
  if (!confirm(`¿Resetear el contador para el año ${anioNuevo}?\nLa próxima factura será ${anioNuevo}-0001`)) return;
  try {
    await db.collection('config').doc('facturacion').set({ anio: anioNuevo, contador: 0 });
    toast(`Contador reseteado para ${anioNuevo}`, 'success');
    loadFinanzas();
  } catch (e) { toast('Error al resetear contador', 'error'); }
}

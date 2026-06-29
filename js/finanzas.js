async function loadFinanzas() {
  const el = document.getElementById('finanzas-content');
  try {
    const [snap, paramSnap] = await Promise.all([
      db.collection('comercios').get(),
      db.collection('config').doc('parametros').get(),
    ]);
    const paramData   = paramSnap.data() || {};
    const precioPro   = paramData.precio_plan_pro   || 19.90;
    const precioMulti = paramData.precio_plan_multi  || 15.98;
    const coms  = snap.docs.map(d => d.data());
    const pro   = coms.filter(c => c.plan_suscripcion === 'pro').length;
    const multi = coms.filter(c => c.plan_suscripcion === 'multi').length;
    const mrr   = (pro * precioPro + multi * precioMulti).toFixed(2);
    const arr   = (mrr * 12).toFixed(2);

    // Leer contador de facturas
    const facturacionDoc = await db.collection('config').doc('facturacion').get();
    const facData = facturacionDoc.data() || {};
    const anioActual = new Date().getFullYear();
    const contadorActual = facData.anio === anioActual ? (facData.contador || 0) : 0;

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
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

      <div style="font-size:0.95rem;font-weight:600;color:var(--text-1);margin-bottom:14px;">Facturas emitidas</div>
      <div id="tabla-facturas-fin"><div class="spinner"></div></div>`;

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
        const pdf = f.url_pdf
          ? `<a href="${f.url_pdf}" target="_blank" style="color:var(--blue);font-size:0.82rem;display:inline-flex;align-items:center;gap:4px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>PDF</a>`
          : '—';
        return `<tr>
          <td style="font-weight:500;color:var(--blue)">${f.numero || '—'}</td>
          <td>${fecha}</td>
          <td>${f.nombre_comercio || '—'}</td>
          <td style="color:var(--text-2);font-size:0.82rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.concepto || '—'}</td>
          <td style="font-weight:600">${importe}</td>
          <td>${pdf}</td>
        </tr>`;
      }).join('');

      tfEl.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:0.84rem;">
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
        </table>`;

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

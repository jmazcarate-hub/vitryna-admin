async function loadFinanzas() {
  const el = document.getElementById('finanzas-content');
  try {
    const snap = await db.collection('comercios').get();
    const coms  = snap.docs.map(d => d.data());
    const pro   = coms.filter(c => c.plan_suscripcion === 'pro').length;
    const multi = coms.filter(c => c.plan_suscripcion === 'multi').length;
    const mrr   = (pro * 19.90 + multi * 15.98).toFixed(2);
    const arr   = (mrr * 12).toFixed(2);
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
      <div style="padding:16px;background:var(--bg);border-radius:10px;font-size:0.83rem;color:var(--text-2)">
        💡 Los ingresos reales se gestionarán desde Stripe cuando esté integrado. Estos valores son estimados a partir de los planes activos en Firestore.
      </div>`;
  } catch (e) { el.innerHTML = '<div class="empty">Error cargando finanzas</div>'; }
}

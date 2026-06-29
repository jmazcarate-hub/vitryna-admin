// ── FIREBASE CONFIG ──
const firebaseConfig = {
  apiKey: "AIzaSyAKCMY1rYNzqFGoqDprOiMC2MyCNYILQsw",
  authDomain: "mi-barrio-vivo-ba557.firebaseapp.com",
  projectId: "mi-barrio-vivo-ba557",
  storageBucket: "mi-barrio-vivo-ba557.firebasestorage.app",
  messagingSenderId: "610698988883",
  appId: "1:610698988883:web:mibarriovivo"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);

// ── UTILS (globales para todos los módulos) ──
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  setTimeout(() => t.className = '', 3200);
}
function timeAgo(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  return Math.floor(diff / 86400) + 'd';
}
function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function vencInfo(ts) {
  if (!ts) return { texto: '—', clase: '' };
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const dias = Math.ceil((d - new Date()) / 86400000);
  if (dias < 0) return { texto: 'Caducado ' + formatDate(ts), clase: 'vence-caducado' };
  if (dias <= 7) return { texto: `Vence en ${dias}d (${formatDate(ts)})`, clase: 'vence-pronto' };
  return { texto: formatDate(ts), clase: 'vence-ok' };
}

// ── LOGIN ──
document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const err   = document.getElementById('login-error');
  const btn   = document.getElementById('btn-login');
  err.style.display = 'none';
  btn.textContent = 'Entrando...'; btn.disabled = true;
  try {
    const cred = await auth.signInWithEmailAndPassword(email, pass);
    const doc  = await db.collection('usuarios').doc(cred.user.uid).get();
    if (!doc.exists || doc.data().rol !== 'admin') {
      await auth.signOut();
      throw new Error('Esta cuenta no tiene permisos de administrador.');
    }
  } catch (e) {
    const esCredenciales = e.code && (
      e.code.includes('wrong-password') ||
      e.code.includes('user-not-found') ||
      e.code.includes('invalid-credential') ||
      e.code.includes('invalid-email')
    );
    err.textContent = e.message.includes('permisos')
      ? e.message
      : esCredenciales
        ? 'Email o contraseña incorrectos.'
        : 'Error de conexión. Comprueba tu red e inténtalo de nuevo.';
    err.style.display = 'block';
    btn.textContent = 'Entrar'; btn.disabled = false;
  }
});
document.getElementById('login-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-login').click();
});
document.getElementById('btn-logout').addEventListener('click', () => auth.signOut());

auth.onAuthStateChanged(user => {
  if (user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main').style.display = 'block';
    document.getElementById('admin-email-display').textContent = user.email;
    document.getElementById('admin-initial').textContent = user.email[0].toUpperCase();
    cargarModulo('dashboard');
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('main').style.display = 'none';
  }
});

// ── CARGA DINÁMICA DE MÓDULOS ──
const modulosCargados = {};
function cargarModulo(nombre) {
  if (modulosCargados[nombre]) {
    // Ya cargado — ejecutar directamente la función de carga
    ejecutarSeccion(nombre);
    return;
  }
  const s = document.createElement('script');
  s.src = `js/${nombre}.js`;
  s.onload = () => {
    modulosCargados[nombre] = true;
    ejecutarSeccion(nombre);
  };
  document.head.appendChild(s);
}
function ejecutarSeccion(nombre) {
  const fnMap = {
    dashboard:     () => typeof loadDashboard     === 'function' && loadDashboard(),
    comercios:     () => typeof loadComercios     === 'function' && loadComercios(),
    vecinos:       () => typeof loadVecinos       === 'function' && loadVecinos(),
    publicaciones: () => typeof loadPublicaciones === 'function' && loadPublicaciones(),
    colaboradores: () => typeof loadColaboradores === 'function' && loadColaboradores(),
    finanzas:      () => typeof loadFinanzas      === 'function' && loadFinanzas(),
    estadisticas:  () => typeof loadEstadisticas === 'function' && loadEstadisticas(),
    config:        () => typeof loadConfig        === 'function' && loadConfig(),
  };
  if (fnMap[nombre]) fnMap[nombre]();
}

// ── NAVEGACIÓN ──
const seccionMeta = {
  dashboard:     { title: 'Dashboard',       sub: 'Resumen general de la plataforma' },
  comercios:     { title: 'Comercios',        sub: 'Gestión de comercios registrados' },
  vecinos:       { title: 'Vecinos',          sub: 'Usuarios de la plataforma' },
  publicaciones: { title: 'Publicaciones',    sub: 'Moderación de contenido' },
  colaboradores: { title: 'Colaboradores',    sub: 'Entidades institucionales del barrio' },
  finanzas:      { title: 'Finanzas',         sub: 'Ingresos y facturación' },
  estadisticas:  { title: 'Estadísticas',     sub: 'Métricas de uso detalladas' },
  mantenimiento: { title: 'Mantenimiento',    sub: 'Limpieza y gestión de datos' },
  config:        { title: 'Configuración',    sub: 'Parámetros de la aplicación' },
};
function cerrarSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

document.getElementById('btn-hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('visible');
});

document.getElementById('sidebar-overlay').addEventListener('click', cerrarSidebar);

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const sec = item.dataset.section;
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('section-' + sec).classList.add('active');
    document.getElementById('topbar-title').textContent = seccionMeta[sec].title;
    document.getElementById('topbar-sub').textContent   = seccionMeta[sec].sub;
    cargarModulo(sec);
    cerrarSidebar();
  });
});

// Cerrar modales al click fuera
document.getElementById('modal-comercio').addEventListener('click', e => {
  if (e.target === e.currentTarget) cerrarModalComercio();
});
document.getElementById('modal-colaborador').addEventListener('click', e => {
  if (e.target === e.currentTarget) cerrarModalColab();
});

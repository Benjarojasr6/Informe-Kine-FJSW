/* Modo en línea (Firebase): inicio de sesión, datos compartidos entre kinesiólogos, fotos/íconos en la nube
   y link de invitación (vence a los 30 días) para el cuerpo técnico.
   Si js/firebase-config.js no está completo, la app funciona como siempre, solo en el dispositivo. */
(function () {
  const K = window.K;
  const e = K.esc;
  const CFG = window.K_FIREBASE || {};
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const GRANDES = ['jugadores', 'partidos', 'casos', 'atenciones', 'eventos', 'asistencias', 'seguros', 'segEventos']; // cada elemento es su propio documento
  const PRIVADOS = ['seguros', 'segEventos']; // datos del seguro (RUT, etc.): solo administradores, en la subcolección 'privado'
  const coleccionDe = (kind) => (PRIVADOS.includes(kind) ? 'privado' : 'items');
  let privBloq = false;
  const DIAS_INVITACION = 30;

  K.rol = 'local'; // local (sin nube) · admin · tecnico
  K.nubeActiva = () => !!(CFG.apiKey && !window.K_ARTEFACTO);
  K.puedeEditar = () => K.rol !== 'tecnico';

  let auth, db, FV, TS;
  let listoFlag = false, primerRender = false, sembrado = false;
  const esperando = new Set();
  const crudo = new Map();      // ruta -> documento tal como está en la nube
  const ultimo = new Map();     // ruta -> texto estable de lo último sincronizado
  const mediaCache = new Map(); // hash -> data URL
  const mediaConocida = new Set();
  const pendMedia = new Map();  // hash -> rutas que esperan esa imagen
  const unsubItems = new Map();
  let secuencia = 0, enVuelo = 0, tPush = null, tRender = null;
  let fallos = 0; // intentos fallidos seguidos (para esperar más entre reintentos)
  let ultimaSync = 0; // momento de la última subida confirmada por la nube

  /* ---------- utilidades ---------- */
  const estable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
    ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x));
  const memo = new Map();
  function hash(s) {
    let h = memo.get(s); if (h) return h;
    let a = 0xdeadbeef, b = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
    a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
    b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
    h = (4294967296 * (2097151 & b) + (a >>> 0)).toString(36) + s.length.toString(36);
    memo.set(s, h); return h;
  }
  // Imágenes (data:) → referencia "@m:hash" y documento aparte en /media
  function aRaw(v, med) {
    if (typeof v === 'string') { if (v.startsWith('data:')) { const h = hash(v); med.set(h, v); return '@m:' + h; } return v; }
    if (Array.isArray(v)) return v.map((x) => aRaw(x, med));
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach((k) => { if (v[k] !== undefined) o[k] = aRaw(v[k], med); }); return o; }
    return v;
  }
  function desde(v, ruta) {
    if (typeof v === 'string') {
      if (v.startsWith('@m:')) {
        const h = v.slice(3);
        if (mediaCache.has(h)) return mediaCache.get(h);
        if (!pendMedia.has(h)) pendMedia.set(h, new Set());
        pendMedia.get(h).add(ruta); return '';
      }
      return v;
    }
    if (Array.isArray(v)) return v.map((x) => desde(x, ruta));
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach((k) => { o[k] = desde(v[k], ruta); }); return o; }
    return v;
  }
  const tokenAleatorio = () => {
    const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = new Uint8Array(32);
    crypto.getRandomValues(a); return Array.from(a, (x) => abc[x % abc.length]).join('');
  };
  const leerToken = () => { const t = new URLSearchParams(location.search).get('i'); return t && /^[A-Za-z0-9]{20,64}$/.test(t) ? t : null; };

  /* ---------- ajustes que se quedan en cada dispositivo ---------- */
  const LOC = 'kine-sw-local';
  function leerLocal() { try { return JSON.parse(localStorage.getItem(LOC)) || {}; } catch (x) { return {}; } }
  function guardarLocal() {
    try { const s = K.state; localStorage.setItem(LOC, JSON.stringify({ activo: s.activo, periodo: s.periodo, ultimoRespaldo: s.ultimoRespaldo, cambios: s.cambios })); } catch (x) { /* sin almacenamiento */ }
  }

  /* ---------- pantallas de acceso ---------- */
  function pantalla(html) {
    document.body.classList.add('acceso');
    document.getElementById('view').innerHTML = `<div class="acceso-caja"><img src="img/insignia-512.png" alt=""><h1>Kinesiología Fútbol Joven</h1><p class="suave">Santiago Wanderers · Área kinésica</p>${html}</div>`;
  }
  const pantallaCarga = (msg) => pantalla(`<p class="acceso-msg">${e(msg || 'Conectando…')}</p>`);
  function pantallaLogin(err, correo) {
    let c = correo || ''; if (!c) { try { c = localStorage.getItem('kine-sw-correo') || ''; } catch (x) { /* nada */ } }
    pantalla(`<form data-login>
      <label class="campo"><span>Correo</span><input type="email" name="correo" autocomplete="username" required value="${e(c)}"></label>
      <label class="campo"><span>Contraseña</span><input type="password" name="clave" autocomplete="current-password" required></label>
      ${err ? `<div class="acceso-err">${e(err)}</div>` : ''}
      <button class="btn" type="submit">Entrar</button></form>
      <p class="suave acceso-pie"><b>Cuerpo técnico:</b> entra abriendo el link de invitación que te enviaron los administradores.</p>`);
  }
  function pantallaVencido(msg) {
    pantalla(`<div class="acceso-err">${e(msg || 'Tu acceso venció o el link ya no es válido.')}</div>
      <p class="suave acceso-pie">Pide un link nuevo a los administradores del área kinésica y ábrelo en este dispositivo.</p>
      <button class="btn sec" type="button" data-reintentar>Reintentar</button>`);
  }
  const msgAuth = (c) => ({
    'auth/invalid-credential': 'Correo o contraseña incorrectos.', 'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'Correo o contraseña incorrectos.', 'auth/invalid-email': 'El correo no es válido.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    'auth/network-request-failed': 'Sin conexión. Para iniciar sesión necesitas internet.'
  })[c] || ('No se pudo entrar (' + c + ').');

  document.addEventListener('submit', async (ev) => {
    const f = ev.target.closest && ev.target.closest('[data-login]'); if (!f) return;
    ev.preventDefault();
    const correo = f.correo.value.trim(), clave = f.clave.value;
    const btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Entrando…';
    try { localStorage.setItem('kine-sw-correo', correo); } catch (x) { /* nada */ }
    try { await auth.signInWithEmailAndPassword(correo, clave); } catch (x) { pantallaLogin(msgAuth(x.code), correo); }
  });
  document.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-reintentar]')) location.reload();
    if (ev.target.closest('[data-salir]')) K.acciones.cerrarSesion();
  });

  /* ---------- estado de sincronización (chip en la barra superior) ---------- */
  const estadoNube = () => (!navigator.onLine ? 'off' : enVuelo > 0 ? 'pend' : 'ok');
  K.chipNube = () => {
    if (K.rol === 'tecnico') return '<button type="button" class="btn ghost chico salir" data-salir>Salir</button>';
    if (K.rol !== 'admin') return '';
    const s = estadoNube();
    return `<span class="nube-chip ${s}" data-nube>${s === 'ok' ? 'Sincronizado' : s === 'pend' ? 'Guardando…' : 'Sin conexión'}</span>`;
  };
  function actualizarChip() {
    const c = document.querySelector('[data-nube]'); if (!c) return;
    const s = estadoNube(); c.className = 'nube-chip ' + s;
    c.textContent = s === 'ok' ? 'Sincronizado' : s === 'pend' ? 'Guardando…' : (enVuelo > 0 ? 'Sin conexión · se subirá al volver' : 'Sin conexión');
  }
  window.addEventListener('online', actualizarChip); window.addEventListener('offline', actualizarChip);

  /* ---------- aplicar documentos de la nube al estado local (en el mismo objeto, para no perder formularios abiertos) ---------- */
  const sucios = new Set();
  function infDe(id) {
    let inf = K.state.informes.find((i) => i.id === id);
    if (!inf) { inf = { id }; GRANDES.forEach((k) => { inf[k] = []; }); K.state.informes.push(inf); }
    return inf;
  }
  function aplicar(ruta, raw) {
    const p = ruta.split('/');
    if (ruta === 'config/general') {
      if (!raw) return;
      const r = desde(raw, ruta); K.state.packIconos = r.packIconos || 'linea'; K.state.iconosPropios = r.iconosPropios || {}; K.state.fuente = r.fuente || 'clasica'; return;
    }
    if (p.length === 2) {
      if (!raw) { const i = K.state.informes.findIndex((x) => x.id === p[1]); if (i >= 0) K.state.informes.splice(i, 1); return; }
      const inf = infDe(p[1]), r = desde(raw, ruta);
      Object.keys(inf).forEach((k) => { if (!GRANDES.includes(k) && !(k in r)) delete inf[k]; });
      Object.assign(inf, r); K.normalizar(inf); return;
    }
    if (p.length === 4 && (p[2] === 'items' || p[2] === 'privado')) {
      const [kind, iid] = p[3].split('~');
      const inf = infDe(p[1]); const arr = inf[kind] || (inf[kind] = []);
      const idx = arr.findIndex((x) => x.id === iid);
      if (!raw) { if (idx >= 0) arr.splice(idx, 1); return; }
      const r = desde(raw, ruta);
      if (idx >= 0) { const o = arr[idx]; Object.keys(o).forEach((k) => delete o[k]); Object.assign(o, r); } else arr.push(r);
      sucios.add(p[1] + '|' + kind);
    }
  }
  function ordenar() {
    sucios.forEach((k) => { const [id, kind] = k.split('|'); const inf = K.state.informes.find((i) => i.id === id); if (inf && inf[kind]) inf[kind].sort((a, b) => (a._o || 0) - (b._o || 0)); });
    sucios.clear();
    if (!K.state.informes.some((i) => i.id === K.state.activo) && K.state.informes[0]) K.state.activo = K.state.informes[0].id;
    if (K.rol === 'tecnico') { // el cuerpo técnico solo ve lo que existe en la nube
      for (let i = K.state.informes.length - 1; i >= 0; i--) if (!crudo.has('informes/' + K.state.informes[i].id)) K.state.informes.splice(i, 1);
    }
  }
  function alCambio(c) {
    const ruta = c.doc.ref.path;
    if (c.type === 'removed') { crudo.delete(ruta); ultimo.delete(ruta); aplicar(ruta, null); return; }
    const raw = c.doc.data(), s = estable(raw);
    crudo.set(ruta, raw);
    if (ultimo.get(ruta) === s) return; // es lo que acabamos de subir nosotros
    ultimo.set(ruta, s); aplicar(ruta, raw);
  }

  /* ---------- render diferido (no interrumpe un formulario abierto) ---------- */
  const ocupado = () => !!document.querySelector('#modal-root .hoja') || (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName));
  function pedirRender() {
    if (!primerRender) return;
    clearTimeout(tRender);
    tRender = setTimeout(function intento() { if (ocupado()) { tRender = setTimeout(intento, 1500); return; } K.render(); }, 300);
  }

  /* ---------- subir cambios ---------- */
  function serializar() {
    const out = new Map(), med = new Map();
    out.set('config/general', aRaw({ packIconos: K.state.packIconos || 'linea', iconosPropios: K.state.iconosPropios || {}, fuente: K.state.fuente || 'clasica' }, med));
    K.state.informes.forEach((inf) => {
      const meta = {};
      Object.keys(inf).forEach((k) => { if (!GRANDES.includes(k)) meta[k] = inf[k]; });
      out.set('informes/' + inf.id, aRaw(meta, med));
      GRANDES.forEach((kind) => (inf[kind] || []).forEach((it, i) => {
        if (kind === 'partidos' || kind === 'jugadores') it._o = i; else if (it._o === undefined) it._o = Date.now() * 1000 + (secuencia++ % 1000);
        out.set('informes/' + inf.id + '/' + coleccionDe(kind) + '/' + kind + '~' + it.id, aRaw(it, med));
      }));
    });
    return { out, med };
  }
  function programarPush() { clearTimeout(tPush); tPush = setTimeout(empujar, Math.min(60000, 400 * Math.pow(2, Math.min(fallos, 8)))); } // tras un fallo, espera cada vez más
  async function empujar() {
    if (K.rol !== 'admin' || !listoFlag || !db) return;
    if (!K.state.informes.length && [...ultimo.keys()].some((k) => k.split('/').length === 2 && k.startsWith('informes/'))) return; // protección
    const { out, med } = serializar();
    const ops = [], nuevos = new Map(), borrados = [], nuevaMedia = [];
    med.forEach((data, h) => {
      if (mediaConocida.has(h)) return;
      if (data.length > 950000) { K.aviso('Una imagen es demasiado grande y no se sincronizó', true); return; }
      ops.push(['set', 'media/' + h, { d: data }]); nuevaMedia.push(h);
    });
    out.forEach((raw, ruta) => { const s = estable(raw); if (ultimo.get(ruta) !== s) { ops.push(['set', ruta, raw]); nuevos.set(ruta, s); crudo.set(ruta, raw); } });
    ultimo.forEach((_, ruta) => { if (!out.has(ruta)) { ops.push(['del', ruta]); borrados.push(ruta); } });
    if (!ops.length) return;
    nuevaMedia.forEach((h) => { mediaConocida.add(h); mediaCache.set(h, med.get(h)); });
    nuevos.forEach((s, r) => ultimo.set(r, s));
    borrados.forEach((r) => { ultimo.delete(r); crudo.delete(r); });
    // Los datos del seguro van en lotes aparte: si las reglas de Firebase aún no los permiten, no bloquean el resto.
    const esPriv = (o) => /^informes\/[^/]+\/privado\//.test(o[1]);
    const privOps = ops.filter(esPriv), todas = ops.filter((o) => !esPriv(o));
    if (privOps.length && privBloq) { privOps.forEach((o) => { if (o[0] === 'set') { ultimo.delete(o[1]); } }); privOps.length = 0; }
    // Se parte en lotes por cantidad (400) y por tamaño (~8 MB; Firestore acepta hasta 10 MB por envío).
    const trocear = (lista) => {
      const r = []; let cur = [], bytes = 0;
      lista.forEach((o) => {
        const tam = o[0] === 'set' ? JSON.stringify(o[2]).length + 200 : 200;
        if (cur.length && (cur.length >= 400 || bytes + tam > 8000000)) { r.push(cur); cur = []; bytes = 0; }
        cur.push(o); bytes += tam;
      });
      if (cur.length) r.push(cur);
      return r;
    };
    const lotes = trocear(todas).concat(trocear(privOps));
    // Si algo sale mal, lo que no se pudo enviar vuelve a quedar “pendiente” para el próximo intento.
    const reintentar = (trozo) => trozo.forEach((o) => {
      if (o[0] === 'del') ultimo.set(o[1], '#borrar'); else ultimo.delete(o[1]);
      if (o[0] === 'set' && o[1].startsWith('media/')) mediaConocida.delete(o[1].slice(6));
    });
    for (const trozo of lotes) {
      let b;
      try {
        b = db.batch();
        trozo.forEach((o) => (o[0] === 'set' ? b.set(db.doc(o[1]), o[2]) : b.delete(db.doc(o[1]))));
      } catch (err) {
        reintentar(trozo); fallos++;
        K.aviso('Un dato no se pudo guardar en la nube (' + ((err && err.message) || 'error') + '). Descarga un respaldo y avísame.', true);
        continue;
      }
      enVuelo++; actualizarChip();
      b.commit().then(() => { enVuelo--; fallos = 0; ultimaSync = Date.now(); actualizarChip(); }).catch((err) => {
        enVuelo--; actualizarChip();
        if (err && err.code === 'permission-denied' && trozo.every(esPriv)) {
          privBloq = true; trozo.forEach((o) => ultimo.delete(o[1]));
          K.aviso('Los datos del seguro NO se están guardando: faltan actualizar las reglas de Firebase (ver CONFIGURAR-NUBE.md). Se perderán al cerrar la app. Descarga un respaldo mientras tanto.', true);
          return;
        }
        reintentar(trozo);
        K.aviso(err && err.code === 'permission-denied' ? 'Sin permiso para guardar en la nube' : 'No se pudo guardar en la nube. Se reintentará.', true);
        fallos++; programarPush();
      });
    }
  }
  function guardarNube() {
    K.state.cambios = (K.state.cambios || 0) + 1;
    guardarLocal();
    if (K.rol === 'admin') programarPush();
  }

  /* ---------- escuchar la nube ---------- */
  const listaPara = (snap) => snap.metadata.fromCache === false || !snap.empty; // una caché vacía no cuenta
  function listo() {
    if (esperando.size || primerRender) return;
    primerRender = true; listoFlag = true; document.body.classList.remove('acceso'); K.render();
  }
  function marcar(clave, snap) { if (esperando.has(clave) && (listaPara(snap) || listoFlag)) { esperando.delete(clave); listo(); } }
  function falloLectura(err) {
    if (err && err.code === 'permission-denied') {
      if (K.rol === 'tecnico') {
        pantallaVencido('Tu acceso venció o el link ya no es válido.');
        (async () => { try { await db.terminate(); await db.clearPersistence(); } catch (x) { /* nada */ } try { await auth.signOut(); } catch (x) { /* nada */ } })();
      } else pantalla('<div class="acceso-err">Esta cuenta no tiene permiso para ver los datos.</div><button class="btn sec" type="button" data-salir>Cerrar sesión</button>');
    }
  }
  function escucharItems(id) {
    if (unsubItems.has(id)) return;
    const clave = 'items:' + id; esperando.add(clave);
    unsubItems.set(id, db.collection('informes').doc(id).collection('items').onSnapshot((snap) => {
      snap.docChanges().forEach(alCambio); ordenar(); marcar(clave, snap); pedirRender();
    }, falloLectura));
    if (K.rol === 'admin') {
      unsubItems.set(id + '#priv', db.collection('informes').doc(id).collection('privado').onSnapshot((snap) => {
        snap.docChanges().forEach(alCambio); ordenar(); pedirRender();
      }, () => { /* sin reglas para 'privado' todavía: se ignora */ }));
    }
  }
  function escuchar() {
    ['informes', 'config', 'media'].forEach((k) => esperando.add(k));
    db.collection('media').onSnapshot((snap) => {
      snap.docChanges().forEach((c) => {
        const h = c.doc.id;
        if (c.type === 'removed') { mediaCache.delete(h); mediaConocida.delete(h); return; }
        mediaCache.set(h, c.doc.data().d); mediaConocida.add(h);
        const ps = pendMedia.get(h);
        if (ps) { ps.forEach((p) => { const raw = crudo.get(p); if (raw) aplicar(p, raw); }); pendMedia.delete(h); }
      });
      ordenar(); marcar('media', snap); pedirRender();
    }, falloLectura);
    db.collection('config').onSnapshot((snap) => { snap.docChanges().forEach(alCambio); marcar('config', snap); pedirRender(); }, falloLectura);
    db.collection('informes').onSnapshot((snap) => {
      snap.docChanges().forEach((c) => {
        alCambio(c);
        if (c.type === 'added') escucharItems(c.doc.id);
        if (c.type === 'removed') { const u = unsubItems.get(c.doc.id); if (u) u(); unsubItems.delete(c.doc.id); const u2 = unsubItems.get(c.doc.id + '#priv'); if (u2) u2(); unsubItems.delete(c.doc.id + '#priv'); }
      });
      ordenar();
      if (K.rol === 'admin' && snap.empty && snap.metadata.fromCache === false && !sembrado) { sembrado = true; sembrar(); return; }
      marcar('informes', snap); pedirRender();
    }, falloLectura);
    setTimeout(() => {
      if (primerRender) return;
      if (K.state.informes.length) { esperando.clear(); listo(); }
      else pantalla('<div class="acceso-err">No se pudieron cargar los datos. Revisa tu conexión.</div><button class="btn sec" type="button" data-reintentar>Reintentar</button>');
    }, 9000);
  }
  // Primera vez: la nube está vacía → se suben los datos de este dispositivo (si los hay) o los de partida.
  async function sembrar() {
    let st = null; try { st = await K.cargar(); } catch (x) { /* nada */ }
    if (st && Array.isArray(st.informes) && st.informes.length) {
      K.state.informes = st.informes.map(K.normalizar); K.state.packIconos = st.packIconos || 'linea'; K.state.iconosPropios = st.iconosPropios || {}; K.state.fuente = st.fuente || 'clasica';
    } else K.state.informes = K.estadoInicial().informes;
    K.state.activo = K.state.informes[0].id;
    listoFlag = true; esperando.delete('informes');
    await empujar(); listo();
  }

  /* ---------- link de invitación del cuerpo técnico ---------- */
  async function invitaciones() {
    const snap = await db.collection('invitaciones').get({ source: 'server' });
    let mejor = null;
    snap.forEach((d) => { const x = d.data(), ms = x.expira && x.expira.toMillis ? x.expira.toMillis() : 0; if (ms > Date.now() && (!mejor || ms > mejor.ms)) mejor = { token: d.id, ms }; });
    let dispositivos = 0; try { dispositivos = (await db.collection('accesos').get({ source: 'server' })).size; } catch (x) { /* nada */ }
    return { vigente: mejor, dispositivos };
  }
  async function generarInvitacion() {
    const tok = tokenAleatorio();
    const [a, b2] = await Promise.all([db.collection('invitaciones').get({ source: 'server' }), db.collection('accesos').get({ source: 'server' })]);
    const b = db.batch();
    a.forEach((d) => b.delete(d.ref)); b2.forEach((d) => b.delete(d.ref));
    b.set(db.doc('invitaciones/' + tok), { creado: FV.serverTimestamp(), expira: TS.fromMillis(Date.now() + DIAS_INVITACION * 864e5) });
    await b.commit(); return tok;
  }
  const urlInvitacion = (t) => location.origin + location.pathname.replace(/[^/]*$/, '') + '?i=' + t;
  const diasPara = (ms) => Math.max(0, Math.ceil((ms - Date.now()) / 864e5));
  const fechaDe = (ms) => { const d = new Date(ms); return `${K.pad(d.getDate())}-${K.pad(d.getMonth() + 1)}-${d.getFullYear()}`; };
  let invCache = null;
  K.tarjetaAcceso = () => (K.rol === 'admin' ? `<div class="card" data-invit><h2>Acceso del cuerpo técnico</h2><p class="suave">Cargando…</p></div>` : '');
  K.tarjetaCuenta = () => (K.rol === 'admin' ? `<div class="card"><h2>Cuenta</h2><p class="sub">Sesión de administrador (compartida por ambos kinesiólogos). Al cerrar sesión se borran los datos guardados en este dispositivo; siguen en la nube.</p>
      <button class="btn sec chico" data-acc="cerrarSesion">Cerrar sesión</button></div>` : '');
  async function pintarInvitacion() {
    const caja = document.querySelector('[data-invit]'); if (!caja) return;
    const html = (cuerpo) => { const c = document.querySelector('[data-invit]'); if (c) c.innerHTML = `<h2>Acceso del cuerpo técnico</h2><p class="sub">Entran sin correo ni contraseña, solo con este link. Ven únicamente el informe por categoría. El link vence a los ${DIAS_INVITACION} días.</p>${cuerpo}`; };
    try {
      let { vigente, dispositivos } = await invitaciones();
      if (!vigente) { await generarInvitacion(); ({ vigente, dispositivos } = await invitaciones()); }
      invCache = vigente;
      const url = urlInvitacion(vigente.token), d = diasPara(vigente.ms);
      html(`<div class="link-caja"><code data-link>${e(url)}</code></div>
        <p class="suave" style="margin:6px 0 10px">Vence el <b>${fechaDe(vigente.ms)}</b> (${d} día${d === 1 ? '' : 's'}) · ${dispositivos} dispositivo${dispositivos === 1 ? '' : 's'} conectado${dispositivos === 1 ? '' : 's'}.${d <= 5 ? ' <b style="color:var(--rojo,#b3261e)">Está por vencer: genera uno nuevo.</b>' : ''}</p>
        <div class="fila wrap gap"><button class="btn chico" data-acc="copiarLink">Copiar link</button>
        <button class="btn sec chico" data-acc="compartirLink">Compartir (WhatsApp)</button>
        <button class="btn peligro chico" data-acc="renovarLink">Generar link nuevo</button></div>
        <p class="suave" style="margin-top:8px">“Generar link nuevo” invalida el anterior de inmediato y desconecta a quienes lo usaban; úsalo también si el link se filtra.</p>`);
    } catch (x) {
      html('<p class="suave">No se pudo cargar el link. Necesitas conexión a internet.</p>');
    }
  }
  K.postRender = () => { if (K.rol === 'admin' && K.ui.pantalla === 'ajustes') pintarInvitacion(); };
  Object.assign(K.acciones, {
    copiarLink() {
      if (!invCache) return; const url = urlInvitacion(invCache.token);
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => K.aviso('Link copiado'), () => K.aviso('No se pudo copiar; selecciónalo manualmente', true));
    },
    compartirLink() {
      if (!invCache) return;
      const msg = `Acceso al informe del área kinésica de Santiago Wanderers (vence el ${fechaDe(invCache.ms)}): ${urlInvitacion(invCache.token)}`;
      if (navigator.share) navigator.share({ text: msg }).catch(() => {});
      else window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    },
    renovarLink() {
      K.confirmar('Se invalida el link actual y se desconecta a todo el cuerpo técnico. ¿Generar uno nuevo?', 'Generar nuevo', async () => {
        try { await generarInvitacion(); K.aviso('Link nuevo generado'); pintarInvitacion(); } catch (x) { K.aviso('No se pudo generar el link. Revisa tu conexión.', true); }
      });
    },
    cerrarSesion() {
      const msg = enVuelo > 0 && K.rol === 'admin' ? 'Hay cambios que aún no se han subido (sin conexión). Si cierras sesión se perderán. ¿Cerrar sesión de todos modos?' : '¿Cerrar sesión en este dispositivo?';
      K.confirmar(msg, 'Cerrar sesión', async () => {
        try { await db.terminate(); await db.clearPersistence(); } catch (x) { /* nada */ }
        try { await auth.signOut(); } catch (x) { /* nada */ }
        try { localStorage.removeItem(LOC); } catch (x) { /* nada */ }
        location.replace(location.pathname);
      });
    }
  });

  /* ---------- arranque ---------- */
  const cargarScript = (src) => new Promise((ok, mal) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar ' + src)); document.head.appendChild(s); });
  async function cargarSDK() {
    if (window.firebase && window.firebase.firestore) return;
    await cargarScript(SDK + 'firebase-app-compat.js');
    await Promise.all([cargarScript(SDK + 'firebase-auth-compat.js'), cargarScript(SDK + 'firebase-firestore-compat.js')]);
  }
  function iniciarDatos(rol) {
    if (K.rol !== 'local') return;
    K.rol = rol; document.body.classList.add('rol-' + rol);
    const l = leerLocal();
    K.state = { v: 1, informes: [], activo: l.activo || '', periodo: l.periodo || { tipo: 'anual', anio: new Date().getFullYear(), desde: '', hasta: '' }, ultimoRespaldo: l.ultimoRespaldo || null, cambios: l.cambios || 0, packIconos: 'linea', iconosPropios: {}, fuente: 'clasica' };
    K.guardar = guardarNube; K.guardarYa = guardarNube;
    const alOcultar = () => { if (document.visibilityState === 'hidden' && K.rol === 'admin') { try { empujar().catch(() => {}); } catch (x) { /* sigue */ } } };
    document.addEventListener('visibilitychange', alOcultar); window.addEventListener('pagehide', () => { try { empujar().catch(() => {}); } catch (x) { /* sigue */ } });
    pantallaCarga('Cargando datos…');
    escuchar();
  }
  async function alUsuario(u) {
    const token = leerToken();
    if (u && !u.isAnonymous) { iniciarDatos('admin'); return; }
    if (u && u.isAnonymous) {
      if (token) {
        pantallaCarga('Verificando invitación…');
        try {
          await Promise.race([db.doc('accesos/' + u.uid).set({ token, creado: FV.serverTimestamp() }), new Promise((_, mal) => setTimeout(() => mal({ code: 'timeout' }), 12000))]);
          history.replaceState(null, '', location.pathname);
        } catch (x) {
          pantallaVencido(x.code === 'timeout' ? 'Sin conexión: para abrir el link por primera vez necesitas internet.' : 'El link venció o no es válido.');
          if (x.code !== 'timeout') { try { await auth.signOut(); } catch (y) { /* nada */ } }
          return;
        }
      }
      iniciarDatos('tecnico'); return;
    }
    if (token) { pantallaCarga('Verificando invitación…'); try { await auth.signInAnonymously(); } catch (x) { pantallaVencido('No se pudo abrir el link. Revisa tu conexión.'); } return; }
    pantallaLogin();
  }
  K.nube = {
    // Para el chequeo de salud de Ajustes
    // Pregunta a Firebase si este administrador puede usar la zona privada (seguros). 'ok' | 'bloqueado' | 'error' | 'na'
    probarPrivado: async () => {
      if (K.rol !== 'admin' || !db || !K.state.informes.length) return 'na';
      try { await db.collection('informes').doc(K.state.informes[0].id).collection('privado').limit(1).get(); if (privBloq) { privBloq = false; programarPush(); } return 'ok'; } // si ya pegó las reglas nuevas, vuelve a intentar subir los seguros
      catch (x) { if (x && x.code === 'permission-denied') { privBloq = true; return 'bloqueado'; } return 'error'; }
    },
    // Sube ya lo pendiente (sin esperar el retraso normal). Se usa al cerrar/ocultar la app y antes de actualizarla.
    vaciar: () => { clearTimeout(tPush); return empujar().catch(() => {}); },
    estado: () => ({ online: navigator.onLine, pendientes: enVuelo, listo: listoFlag, segBloq: privBloq, ultimaSync }),
    async arrancar() {
      pantallaCarga('Conectando…');
      try { await cargarSDK(); } catch (x) { pantalla('<div class="acceso-err">No se pudo cargar la conexión. Revisa tu internet.</div><button class="btn sec" type="button" data-reintentar>Reintentar</button>'); return; }
      firebase.initializeApp(CFG);
      auth = firebase.auth(); db = firebase.firestore(); FV = firebase.firestore.FieldValue; TS = firebase.firestore.Timestamp;
      try { db.settings({ experimentalAutoDetectLongPolling: true, merge: true }); } catch (x) { /* nada */ }
      try { await db.enablePersistence({ synchronizeTabs: true }); } catch (x) { /* sigue sin caché local */ }
      let primera = true;
      auth.onAuthStateChanged((u) => {
        if (!primera) { location.reload(); return; } // cambio de usuario: se reinicia limpio
        primera = false; alUsuario(u);
      });
    }
  };
})();

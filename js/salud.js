/* Chequeo de salud (Ajustes) e importación segura de respaldos.
   - El chequeo solo MIRA: no cambia ni borra ningún dato.
   - Importar un respaldo muestra primero qué contiene; "Reemplazar" descarga antes una copia de lo actual. */
(function () {
  const K = window.K;
  const e = K.esc;
  const ICO = { ok: '✓', aviso: '!', mal: '✕', info: 'i' };
  const FECHA_OK = /^\d{4}-\d{2}-\d{2}$/;

  const num = (n) => new Intl.NumberFormat('es-CL').format(n);
  const pl = (n, uno, otros) => num(n) + ' ' + (n === 1 ? uno : otros);
  const mb = (b) => (b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(b < 10485760 ? 1 : 0).replace('.', ',') + ' MB');
  const hace = (ms) => {
    const m = Math.round((Date.now() - ms) / 60000);
    if (m < 1) return 'hace un momento';
    if (m < 60) return 'hace ' + m + ' min';
    const h = Math.round(m / 60);
    return h < 24 ? 'hace ' + h + ' h' : 'hace ' + Math.round(h / 24) + ' días';
  };

  /* ---------- revisión de datos (huérfanos, fechas, fotos) ---------- */
  K.revisarIntegridad = function (state) {
    const prob = [];
    const todos = (state || K.state).informes;
    // un jugador de otra categoría (invitado) tiene sus minutos en el partido de este informe pero vive en el otro: se busca en todos
    const jugTodos = new Set([].concat(...todos.map((i) => (i.jugadores || []).map((j) => j.id))));
    todos.forEach((inf) => {
      const jug = jugTodos;
      const casos = new Set((inf.casos || []).map((c) => c.id));
      const segs = new Set((inf.seguros || []).map((s) => s.id));
      const nom = todos.length > 1 ? ' (' + inf.nombre + ')' : '';
      const cuenta = (lista, malo) => lista.filter(malo).length;
      const add = (n, txt) => { if (n) prob.push(num(n) + ' ' + txt + nom); };
      add(cuenta(inf.casos || [], (c) => !jug.has(c.jugadorId)), 'caso(s) de un jugador que ya no existe');
      add(cuenta(inf.atenciones || [], (a) => !jug.has(a.jugadorId)), 'atención(es) de un jugador que ya no existe');
      add(cuenta(inf.atenciones || [], (a) => a.casoId && !casos.has(a.casoId)), 'atención(es) ligada(s) a un caso que ya no existe');
      add(cuenta(inf.seguros || [], (s) => !jug.has(s.jugadorId)), 'activación(es) de seguro de un jugador que ya no existe');
      add(cuenta(inf.segEventos || [], (x) => x.seguroId && !segs.has(x.seguroId)), 'evento(s) de seguro sin su activación');
      let minHuerf = 0, incHuerf = 0;
      (inf.partidos || []).forEach((p) => {
        Object.keys(p.minutos || {}).forEach((id) => { if (!jug.has(id)) minHuerf++; });
        (p.incidencias || []).forEach((i) => { if (!jug.has(i.jugadorId)) incHuerf++; });
      });
      add(minHuerf, 'minuto(s) de partido de un jugador que ya no existe');
      add(incHuerf, 'incidencia(s) de partido de un jugador que ya no existe');
      const malaFecha = (f) => f && !FECHA_OK.test(String(f).slice(0, 10));
      add(cuenta(inf.casos || [], (c) => malaFecha(c.inicio)) + cuenta(inf.atenciones || [], (a) => malaFecha(a.fecha)) + cuenta(inf.partidos || [], (p) => malaFecha(p.fecha)), 'registro(s) con una fecha que no se entiende');
      add(cuenta(inf.jugadores || [], (j) => j.foto && String(j.foto).length > 950000), 'foto(s) demasiado grande(s) para la nube');
    });
    return prob;
  };

  /* ---------- armado del chequeo ---------- */
  // Cada ítem: { e: ok|aviso|mal|info, t: título, d: detalle, btn?: { acc, txt } }
  K.chequeoSalud = function () {
    const it = [];
    const nubeOn = K.rol !== 'local';
    // 1) Dónde se guardan los datos
    if (nubeOn) {
      const n = K.nube && K.nube.estado ? K.nube.estado() : null;
      if (K.rol === 'tecnico') it.push({ e: 'info', t: 'Acceso del cuerpo técnico', d: 'Solo puedes ver el informe. Los datos vienen de la nube.' });
      else if (n) {
        if (!n.online) it.push({ e: 'aviso', t: 'Sin conexión', d: n.pendientes ? 'Hay cambios esperando subir; se enviarán solos al volver internet.' : 'Puedes seguir trabajando; todo se sincroniza al volver internet.' });
        else if (!n.listo) it.push({ e: 'info', t: 'Conectando con la nube…', d: 'Espera unos segundos y vuelve a revisar.' });
        else if (n.pendientes) it.push({ e: 'aviso', t: 'Guardando en la nube…', d: 'Espera unos segundos y vuelve a revisar.' });
        else it.push({ e: 'ok', t: 'Conectada a la nube', d: n.ultimaSync ? 'Última subida desde este equipo ' + hace(n.ultimaSync) + '.' : 'No hay nada pendiente de subir desde este equipo.' });
        if (n.segBloq) it.push({ e: 'mal', t: 'Reglas de Firebase sin actualizar', d: 'Los datos del seguro (RUT, diagnóstico) NO se están guardando: se pierden al cerrar la app. Pega el archivo firestore.rules en Firebase (Firestore → Reglas → Publicar) y descarga un respaldo mientras tanto.' });
        else if (n.online) it.push({ e: 'info', t: 'Datos del seguro', d: 'Comprobando que la nube permita guardarlos…', id: 'seg' });
      }
    } else it.push({ e: 'aviso', t: 'Datos solo en este dispositivo', d: 'No hay nube conectada: si se borran los datos del navegador, se pierde todo. Descarga respaldos seguido.' });

    // 2) Respaldo
    const ult = K.state.ultimoRespaldo;
    if (!ult) it.push({ e: 'aviso', t: 'Aún no hay respaldo descargado', d: 'Descarga uno ahora: es tu copia de seguridad en tu propio equipo.', btn: { acc: 'exportarTodo', txt: 'Descargar respaldo' } });
    else {
      const dias = FECHA_OK.test(ult) ? Math.floor((Date.now() - new Date(ult + 'T12:00:00')) / 864e5) : NaN;
      const camb = Math.max(0, K.state.cambios || 0);
      if (isNaN(dias)) it.push({ e: 'aviso', t: 'Fecha del último respaldo ilegible', d: 'Descarga un respaldo nuevo para dejarla en orden.', btn: { acc: 'exportarTodo', txt: 'Descargar respaldo' } });
      else it.push({ e: dias > 31 ? 'aviso' : 'ok', t: 'Último respaldo: ' + K.fechaCorta(ult), d: (dias <= 0 ? 'Es de hoy.' : 'Hace ' + pl(dias, 'día', 'días') + '.') + (camb ? ' Desde entonces: ' + pl(camb, 'cambio', 'cambios') + '.' : ' Sin cambios desde entonces.'), btn: dias > 31 ? { acc: 'exportarTodo', txt: 'Descargar respaldo' } : null });
    }

    // 3) Datos
    const res = K.resumenDatos(K.state.informes);
    let kb = 0; try { kb = JSON.stringify(K.state).length; } catch (x) { /* nada */ }
    it.push({ e: 'info', t: 'Contenido guardado', d: `${pl(res.informes, 'informe', 'informes')} · ${pl(res.jugadores, 'jugador', 'jugadores')} · ${pl(res.casos, 'caso', 'casos')} · ${pl(res.atenciones, 'atención', 'atenciones')} · ${pl(res.partidos, 'partido', 'partidos')} · ${pl(res.seguros, 'activación de seguro', 'activaciones de seguro')} · ${mb(kb)}` });
    const prob = K.revisarIntegridad();
    if (prob.length) it.push({ e: 'aviso', t: 'Hay registros que revisar', d: prob.slice(0, 4).join(' · ') + (prob.length > 4 ? ' · …' : '') + '. No se borró nada; son datos sueltos que no aparecen en el informe.' });
    else it.push({ e: 'ok', t: 'Datos consistentes', d: 'Ningún registro suelto, ni fechas ilegibles, ni fotos demasiado pesadas.' });

    // 4) Este dispositivo (se completa en segundo plano)
    it.push({ e: 'info', t: 'Este dispositivo', d: 'Revisando…', id: 'disp' });
    const sw = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol);
    it.push({ e: sw && navigator.serviceWorker.controller ? 'ok' : 'aviso', t: sw && navigator.serviceWorker.controller ? 'Funciona sin internet' : 'Aún no está lista para usarse sin internet', d: sw && navigator.serviceWorker.controller ? 'La app quedó guardada en este equipo.' : 'Abre la app una vez con internet y vuelve a revisar.' });
    const inst = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    it.push({ e: inst ? 'ok' : 'info', t: inst ? 'Instalada como aplicación' : 'Abierta desde el navegador', d: inst ? 'Se abre como una app más.' : 'Puedes instalarla desde el menú del navegador (Instalar aplicación / Agregar a pantalla de inicio).' });
    it.push({ e: 'info', t: 'Versión de la app: ' + K.version, d: 'Es la que está instalada en este equipo.' });
    return it;
  };

  const fila = (x) => `<li class="salud-f s-${x.e}"${x.id ? ` data-salud-id="${x.id}"` : ''}><i>${ICO[x.e]}</i><div><b>${e(x.t)}</b><span>${e(x.d)}</span>${x.btn ? `<button type="button" class="btn sec chico" data-acc="${x.btn.acc}">${e(x.btn.txt)}</button>` : ''}</div></li>`;
  const resumenTxt = (it) => {
    const mal = it.filter((x) => x.e === 'mal').length, av = it.filter((x) => x.e === 'aviso').length;
    return mal ? `<span class="salud-res s-mal">${mal === 1 ? '1 problema importante' : mal + ' problemas importantes'}</span>` : av ? `<span class="salud-res s-aviso">${av === 1 ? '1 cosa por revisar' : av + ' cosas por revisar'}</span>` : '<span class="salud-res s-ok">Todo en orden</span>';
  };
  K.tarjetaSalud = function () {
    const it = K.chequeoSalud();
    return `<div class="card" data-salud><div class="fila sb"><h2 style="margin:0">Chequeo de salud</h2><span data-salud-res>${resumenTxt(it)}</span></div>
      <p class="sub">Un vistazo a si tus datos están a salvo. Solo revisa: no cambia ni borra nada.</p>
      <ul class="salud-l" data-salud-lista>${it.map(fila).join('')}</ul>
      <div class="fila wrap gap"><button type="button" class="btn sec chico" data-acc="revisarSalud">Volver a revisar</button></div></div>`;
  };

  /* ---------- partes que necesitan esperar (espacio del dispositivo, reglas del seguro en la nube) ---------- */
  const pintar = (li, est, titulo, detalle) => {
    if (!li) return;
    li.className = 'salud-f s-' + est;
    li.querySelector('i').textContent = ICO[est];
    li.querySelector('b').textContent = titulo;
    li.querySelector('span').textContent = detalle;
  };
  const actualizarResumen = () => {
    const c = document.querySelector('[data-salud]'); if (!c) return;
    const filas = [...c.querySelectorAll('.salud-f')].map((l) => ({ e: /s-(ok|aviso|mal|info)/.exec(l.className)[1] }));
    c.querySelector('[data-salud-res]').innerHTML = resumenTxt(filas);
  };
  async function dispositivo() {
    const li = document.querySelector('[data-salud-id="disp"]'); if (!li) return;
    let txt = [], est = 'info', falta = false;
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const s = await navigator.storage.estimate();
        txt.push('Usa ' + mb(s.usage || 0) + (s.quota ? ' de ' + mb(s.quota) + ' disponibles' : ''));
        if (s.quota && s.usage / s.quota > 0.8) est = 'aviso';
      }
      if (navigator.storage && navigator.storage.persisted) {
        const p = await navigator.storage.persisted();
        txt.push(p ? 'protegido contra borrado automático' : 'el navegador podría borrarlo si le falta espacio');
        if (!p) { falta = true; if (K.rol === 'local') est = 'aviso'; }
      }
    } catch (x) { /* sin datos */ }
    pintar(li, est, 'Este dispositivo', txt.length ? txt.join(' · ') + '.' : 'El navegador no informa el espacio usado.');
    if (falta && navigator.storage.persist && !li.querySelector('button')) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sec chico'; b.textContent = 'Proteger mis datos'; b.dataset.acc = 'protegerDatos';
      li.querySelector('div').appendChild(b);
    }
    actualizarResumen();
  }
  async function seguroNube() {
    const li = document.querySelector('[data-salud-id="seg"]'); if (!li || !K.nube || !K.nube.probarPrivado) return;
    const r = await K.nube.probarPrivado();
    if (r === 'ok') pintar(li, 'ok', 'Datos del seguro protegidos', 'La nube permite guardarlos en la zona privada (solo administradores).');
    else if (r === 'bloqueado') pintar(li, 'mal', 'Reglas de Firebase sin actualizar', 'Los datos del seguro (RUT, diagnóstico) NO se están guardando: se pierden al cerrar la app. Pega el archivo firestore.rules en Firebase (Firestore → Reglas → Publicar) y descarga un respaldo mientras tanto.');
    else pintar(li, 'aviso', 'No pude comprobar los datos del seguro', 'Sin conexión estable con la nube. Vuelve a revisar en un momento.');
    actualizarResumen();
  }
  const prevPost = K.postRender;
  K.postRender = function () { if (prevPost) prevPost(); if (K.ui.pantalla === 'ajustes') { dispositivo(); seguroNube(); } };

  Object.assign(K.acciones, {
    revisarSalud(el, ev, silencioso) {
      const c = document.querySelector('[data-salud]'); if (!c) return;
      const it = K.chequeoSalud();
      c.querySelector('[data-salud-lista]').innerHTML = it.map(fila).join('');
      c.querySelector('[data-salud-res]').innerHTML = resumenTxt(it);
      dispositivo(); seguroNube();
      if (silencioso !== true) K.aviso('Revisado');
    },
    async protegerDatos() {
      let ok = false;
      try { ok = await navigator.storage.persist(); } catch (x) { /* nada */ }
      K.acciones.revisarSalud(null, null, true);
      K.aviso(ok ? 'Datos protegidos en este dispositivo' : 'El navegador no lo permitió. Si instalas la app suele aceptarlo.', !ok);
    }
  });

  /* ---------- importar respaldo (vista previa + copia de seguridad antes de reemplazar) ---------- */
  const lineas = (r) => `<li><b>${num(r.informes)}</b> ${r.informes === 1 ? 'informe' : 'informes'}</li><li><b>${num(r.jugadores)}</b> ${r.jugadores === 1 ? 'jugador' : 'jugadores'}</li><li><b>${num(r.casos)}</b> ${r.casos === 1 ? 'caso' : 'casos'} · <b>${num(r.atenciones)}</b> ${r.atenciones === 1 ? 'atención' : 'atenciones'}</li><li><b>${num(r.partidos)}</b> ${r.partidos === 1 ? 'partido' : 'partidos'}</li><li><b>${num(r.seguros)}</b> ${r.seguros === 1 ? 'activación' : 'activaciones'} de seguro · <b>${num(r.segEventos)}</b> ${r.segEventos === 1 ? 'evento' : 'eventos'}</li>`;
  K.importarArchivo = function (txt, despues) {
    let rev;
    try { rev = K.revisarRespaldo(txt); } catch (x) { K.aviso(x.message, true); return; }
    const aviso = rev.avisos.length ? `<div class="aviso">${rev.avisos.map(e).join('<br>')}</div>` : '';
    const cuando = rev.fecha ? ` Respaldo del <b>${e(K.fechaCorta(rev.fecha.slice(0, 10)))}</b>${rev.app ? ' (app ' + e(rev.app) + ')' : ''}.` : '';
    const actual = K.resumenDatos(K.state.informes);
    // qué pasaría con cada informe del archivo
    const plan = rev.informes.map((inf) => { const g = K.grupoDeInforme(inf), ex = g && K.buscarInformeGrupo(g); return { nombre: inf.nombre, existe: !!ex }; });
    const nuevos = plan.filter((x) => !x.existe).length;
    const listaPlan = `<ul class="imp-l">${plan.map((x) => `<li><b>${e(x.nombre)}</b>: ${x.existe ? 'ya tienes un informe de esa categoría' : 'se puede agregar'}</li>`).join('')}</ul>`;
    const ok = (modo) => () => {
      if (modo === 'reemplazar') K.exportar(false, { nombre: 'copia-antes-de-reemplazar', copiaSeguridad: true });
      let r;
      try { r = K.importar(txt, modo); } catch (x) { K.aviso(x.message, true); return; }
      let msg = modo === 'reemplazar' ? 'Respaldo restaurado' : 'Agregado: ' + r.agregados.join(', ');
      if (modo === 'agregar' && r.omitidos.length) msg += ' (se omitió ' + r.omitidos.join(', ') + ', que ya existe)';
      despues(msg);
    };
    const nubeAviso = K.rol === 'admin' ? ' <u>y también cambia lo guardado en la nube para ambos kinesiólogos</u>' : '';
    if (rev.tipo === 'informe') {
      const existe = plan[0].existe;
      K.modal({
        titulo: 'Importar informe',
        cuerpo: `${aviso}<p>Este archivo trae un informe:${cuando}</p><ul class="imp-l">${lineas(rev.resumen)}</ul>` + (existe
          ? `<p><b>Ya tienes un informe de esa categoría</b> (${pl(actual.jugadores, 'jugador', 'jugadores')} en total). <b>Reemplazar</b> deja el informe del archivo en su lugar${nubeAviso}. Antes se descarga una copia de lo actual, por si te arrepientes.</p>`
          : '<p class="suave">Se agrega como un informe nuevo; no se toca lo que ya tienes.</p>'),
        botones: rev.nueva ? [] : [existe ? { txt: 'Reemplazar', cls: 'peligro', fn: ok('reemplazar') } : { txt: 'Agregar', fn: ok('agregar') }]
      });
      return;
    }
    const botones = [];
    if (!rev.nueva) { if (nuevos) botones.push({ txt: 'Agregar', cls: 'sec', fn: ok('agregar') }); botones.push({ txt: 'Reemplazar', cls: 'peligro', fn: ok('reemplazar') }); }
    K.modal({
      titulo: 'Importar respaldo completo',
      cuerpo: `${aviso}<p>Este archivo contiene:${cuando}</p><ul class="imp-l">${lineas(rev.resumen)}</ul>${listaPlan}
        <p class="suave">Ahora tienes: ${pl(actual.informes, 'informe', 'informes')}, ${pl(actual.jugadores, 'jugador', 'jugadores')}, ${pl(actual.casos, 'caso', 'casos')}, ${pl(actual.atenciones, 'atención', 'atenciones')}.</p>
        <p><b>Agregar</b> suma solo los informes de categorías que aún no tienes (no se duplica nada).<br><b>Reemplazar</b> deja solo lo del archivo${nubeAviso}. Antes se descarga una copia de lo actual, por si te arrepientes.</p>`,
      botones
    });
  };
})();

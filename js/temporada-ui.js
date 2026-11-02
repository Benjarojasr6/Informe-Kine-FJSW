/* Pantallas de temporadas: Archivo, bajas, cambio de categoría, volver a inscribir, eliminar definitivamente
   y el asistente “Iniciar temporada AAAA”. Usa la capa de datos de temporadas.js. */
(function () {
  const K = window.K;
  const e = K.esc;
  const CATS = [15, 16, 18, 20];
  const SIG = { 15: 16, 16: 18, 18: 20 }; // a dónde sube cada categoría (la Sub 20 se queda)
  const SALIDAS = K.ESTADOS.filter((x) => x[0] !== 'inscrito');
  const anioCal = () => new Date().getFullYear();
  const fechaOk = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 1990;
  const optsCat = (sel) => '<option value="">— elegir —</option>' + CATS.map((c) => `<option${'Sub ' + c === sel ? ' selected' : ''}>Sub ${c}</option>`).join('');
  const nCat = (txt) => Number((/\d+/.exec(String(txt || '')) || [])[0]) || null;
  const refrescar = () => K.render();
  const guardar = (msg) => { K.guardar(); if (msg) K.aviso(msg); K.render(); };

  /* ---------- Textos de cada estado (una línea cada uno) ---------- */
  K.ESTADO_TEXTO = {
    inscrito: ['Inscrito', 'Juega o entrena en el club este año. Aparece en las listas del día a día (Jugadores, Registrar, Kine, partidos).'],
    liberado: ['Liberado', 'El club terminó su vínculo con él. Pasa al Archivo, con su ficha y su historial intactos.'],
    cedido: ['Cedido', 'Juega en otro club a préstamo. Pasa al Archivo; si vuelve, se puede volver a inscribir.'],
    promovido: ['Promovido al primer equipo', 'Subió al primer equipo del club. Pasa al Archivo con todo su historial.'],
    retirado: ['Retirado', 'Dejó de jugar (lesión, estudios, decisión propia…). Pasa al Archivo con todo su historial.']
  };
  K.estadoLargo = (v) => (K.ESTADO_TEXTO[v] || K.ESTADO_TEXTO.inscrito)[0];
  const ayudaEstados = () => `<details class="est-ayuda"><summary>¿Qué significa cada estado?</summary><ul>${Object.keys(K.ESTADO_TEXTO).map((k) => `<li><b>${e(K.ESTADO_TEXTO[k][0])}:</b> ${e(K.ESTADO_TEXTO[k][1])}</li>`).join('')}</ul></details>`;
  K.ayudaEstados = ayudaEstados;

  /* ---------- Nombre en tres partes ---------- */
  // “Juan Carlos de la Fuente Soto” → nombres “Juan Carlos”, apellidos “de la Fuente” y “Soto”. null si hay menos de 3 palabras.
  const PART = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'san', 'santa', 'van', 'von', 'da', 'di', 'le', 'mac', 'mc']);
  K.partirNombre = (txt) => {
    const w = String(txt || '').trim().split(/\s+/).filter(Boolean);
    if (w.length < 3) return null;
    const inicio = (fin) => { let i = fin; while (i > 0 && PART.has(K.norm(w[i - 1]))) i--; return i; };
    let i2 = inicio(w.length - 1), i1 = i2 - 1 >= 1 ? inicio(i2 - 1) : 0;
    if (i1 < 1) { i2 = w.length - 1; i1 = w.length - 2; }
    return { nombres: w.slice(0, i1).join(' '), apellido1: w.slice(i1, i2).join(' '), apellido2: w.slice(i2).join(' ') };
  };
  K.sinApellidos = (j) => !j.apellido1 && !j.apellido2;

  /* ---------- Duplicado: aviso dentro del formulario, con botón para ir a la ficha ---------- */
  K.avisoDuplicado = (dup) => {
    const j = dup.j, cat = j.categoria || 'sin categoría';
    const donde = dup.archivado ? `está en el <b>Archivo</b> (${e(K.estadoLargo(j.estado))} el ${K.fechaCorta(K.salidaDe(j))})` : 'ya está <b>inscrito</b>';
    return `<div class="aviso dup" data-dup><b>Este jugador ya existe.</b> ${e(j.nombre)} (${e(cat)}${j.nacimiento ? ' · ' + e(j.nacimiento) : ''}) ${donde}. No se crea otro igual.
      <div class="fila gap wrap" style="margin-top:8px"><button type="button" class="btn chico" data-dup-abrir="${e(j.id)}">Abrir su ficha</button>${dup.archivado ? `<button type="button" class="btn sec chico" data-dup-reinscribir="${e(j.id)}">Volver a inscribirlo</button>` : ''}</div></div>`;
  };
  // Muestra (o reemplaza) el aviso de duplicado arriba del formulario y conecta sus botones.
  K.mostrarDuplicado = (hoja, dup) => {
    const cuerpo = hoja.querySelector('.cuerpo'); const previo = cuerpo.querySelector('[data-dup]'); if (previo) previo.remove();
    cuerpo.insertAdjacentHTML('afterbegin', K.avisoDuplicado(dup));
    cuerpo.scrollTop = 0;
    cuerpo.querySelector('[data-dup]').addEventListener('click', (ev) => {
      const a = ev.target.closest('[data-dup-abrir]'), r = ev.target.closest('[data-dup-reinscribir]');
      if (!a && !r) return;
      const id = (a || r).dataset.dupAbrir || (a || r).dataset.dupReinscribir;
      K.cerrarModales(); K.abrirFicha(id);
      if (r) { const gl = K.jugadorGlobal(id); if (gl) K.formReinscribir(gl.j); }
    });
  };

  // “Se parece”: mismo año de nacimiento y todas las palabras del nombre más corto están en el más largo
  // (típico de un jugador antiguo guardado sin apellidos: “Sergio Salida” vs “Sergio Salida Gómez”). Solo avisa, no bloquea.
  K.buscarParecido = (nombre, anioNac, ignorarId) => {
    const toks = (x) => K.norm(x).split(' ').filter(Boolean), a = toks(nombre), anio = String(anioNac || '').slice(0, 4);
    if (!/^\d{4}$/.test(anio) || a.length < 2) return null;
    for (const inf of K.state.informes) {
      for (const j of inf.jugadores || []) {
        if (j.id === ignorarId || String(j.nacimiento || '').slice(0, 4) !== anio || K.norm(j.nombre) === K.norm(nombre)) continue;
        const b = toks(j.nombre), c = a.length <= b.length ? a : b, l = a.length <= b.length ? b : a;
        if (c.length >= 2 && c.every((t) => l.includes(t))) return { j, inf, archivado: !K.inscrito(j) };
      }
    }
    return null;
  };
  K.mostrarParecido = (hoja, par) => {
    const cuerpo = hoja.querySelector('.cuerpo'); const previo = cuerpo.querySelector('[data-dup]'); if (previo) previo.remove();
    const j = par.j;
    cuerpo.insertAdjacentHTML('afterbegin', `<div class="aviso" data-dup><b>Se parece a otro jugador.</b> ${e(j.nombre)} (${e(j.categoria || 'sin categoría')} · ${e(j.nacimiento)})${par.archivado ? ' está en el Archivo' : ''}. Si es la misma persona, abre su ficha y completa sus apellidos. Si es otro jugador, toca <b>Guardar</b> otra vez.
      <div class="fila gap wrap" style="margin-top:8px"><button type="button" class="btn chico" data-dup-abrir="${e(j.id)}">Abrir su ficha</button></div></div>`);
    cuerpo.scrollTop = 0;
    cuerpo.querySelector('[data-dup]').addEventListener('click', (ev) => { const a = ev.target.closest('[data-dup-abrir]'); if (a) { K.cerrarModales(); K.abrirFicha(a.dataset.dupAbrir); } });
  };

  /* ---------- Abrir la ficha de cualquier jugador (cambia de informe y categoría si hace falta) ---------- */
  K.abrirFicha = (jid) => {
    const gl = K.jugadorGlobal(jid); if (!gl) return false;
    const g = K.grupoDeInforme(gl.inf), n = K.catNum(gl.j);
    K.state.activo = gl.inf.id;
    if (!K.ui.cat || (g && !g.cats.includes(K.ui.cat))) K.ui.cat = g ? (g.cats.includes(n) ? n : g.cats[0]) : n || 16;
    K.ui.alcance = 'comb'; K.ui.pantalla = 'jugadores'; K.ui.jugadorId = jid; K.ui.jtab = K.inscrito(gl.j) ? 'inscritos' : 'archivo';
    K.render(); window.scrollTo(0, 0); return true;
  };
  // Deja la app en la categoría n, mostrando la ficha del jugador.
  const irAFicha = (jid, n) => {
    K.seleccionarCat(n || K.catNum((K.jugadorGlobal(jid) || {}).j) || 16, true);
    K.ui.pantalla = 'jugadores'; K.ui.jugadorId = jid; K.ui.jtab = 'inscritos'; K.render(); window.scrollTo(0, 0);
  };

  /* ======================= ARCHIVO ======================= */
  const archivados = () => { const out = []; K.state.informes.forEach((inf) => (inf.jugadores || []).forEach((j) => { if (!K.inscrito(j)) out.push({ j, inf }); })); return out; };
  K.archivados = archivados;
  const catQueTenia = (j) => { const n = K.catEn(j, K.salidaDe(j)); return n ? 'Sub ' + n : j.categoria || ''; };
  K.archivoHTML = () => {
    const f = (K.ui.arch = K.ui.arch || { q: '', estado: '', anio: '' });
    const todos = archivados();
    const anios = Array.from(new Set(todos.map(({ j }) => K.salidaDe(j).slice(0, 4)))).sort().reverse();
    const q = K.norm(f.q);
    const lista = todos.filter(({ j }) => (!q || K.norm(j.nombre).includes(q)) && (!f.estado || j.estado === f.estado) && (!f.anio || K.salidaDe(j).slice(0, 4) === f.anio))
      .sort((a, b) => K.salidaDe(b.j).localeCompare(K.salidaDe(a.j)) || a.j.nombre.localeCompare(b.j.nombre, 'es'));
    const ini = (n) => (n || '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
    return `<p class="suave" style="margin:0 2px 8px">Los jugadores dados de baja (liberados, cedidos, promovidos o retirados) quedan aquí con su ficha y su historial. No aparecen en las listas del día a día, pero sí en los informes de los años en que estuvieron.</p>
      <div class="filtros-arch">
        <input type="search" placeholder="Buscar en el archivo…" value="${e(f.q)}" data-acc-input="buscarArch" aria-label="Buscar en el archivo">
        <select data-acc-change="archFiltro" data-k="estado" aria-label="Filtrar por estado"><option value="">Todos los estados</option>${SALIDAS.map(([v, t]) => `<option value="${v}"${f.estado === v ? ' selected' : ''}>${e(t)}</option>`).join('')}</select>
        <select data-acc-change="archFiltro" data-k="anio" aria-label="Filtrar por año de salida"><option value="">Todos los años</option>${anios.map((a) => `<option${f.anio === a ? ' selected' : ''}>${e(a)}</option>`).join('')}</select>
      </div>
      <div class="card" style="padding:6px 12px">${lista.length ? `<div class="lista">${lista.map(({ j }) => `<div class="item" data-acc="abrirArchivado" data-id="${e(j.id)}"><span class="avatar">${j.foto ? `<img src="${e(j.foto)}" alt="">` : e(ini(j.nombre))}</span>
        <div class="txt"><b>${e(j.nombre)}</b><span>${e([catQueTenia(j), j.nacimiento].filter(Boolean).join(' · '))}</span></div>
        <div class="arch-est"><i class="chip est-${e(j.estado)}">${e(K.nombreEstado(j.estado))}</i><small>${K.fechaCorta(K.salidaDe(j))}</small></div></div>`).join('')}</div>`
        : `<p class="vacio-msg">${todos.length ? 'Nadie coincide con los filtros.' : 'El archivo está vacío. Cuando des de baja a un jugador, aparecerá aquí con todo su historial.'}</p>`}</div>`;
  };
  Object.assign(K.acciones, {
    jtab(el) { K.ui.jtab = el.dataset.v === 'archivo' ? 'archivo' : 'inscritos'; K.ui.jugadorId = null; K.render(); },
    abrirArchivado(el) { K.abrirFicha(el.dataset.id); },
    archFiltro(el) { K.ui.arch[el.dataset.k] = el.value; K.render(); },
    buscarArch(el) { K.ui.arch.q = el.value; const pos = el.selectionStart; K.render(); const n = document.querySelector('[data-acc-input=buscarArch]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { /* nada */ } } },
    bajaJugador() { const gl = K.jugadorGlobal(K.ui.jugadorId); if (gl) K.formBaja(gl.j); },
    catJugador() { const gl = K.jugadorGlobal(K.ui.jugadorId); if (gl) K.formCambiarCat(gl.j); },
    reinscribirJugador() { const gl = K.jugadorGlobal(K.ui.jugadorId); if (gl) K.formReinscribir(gl.j); },
    eliminarDefinitivo() { const gl = K.jugadorGlobal(K.ui.jugadorId); if (gl) K.formEliminarDef(gl.j); }
  });

  /* ---------- Cintillo y tarjeta de estado (los usa la ficha) ---------- */
  K.cintilloArchivado = (j) => (K.inscrito(j) ? '' : `<div class="cintillo-arch"><b>Archivado</b><span>${e(K.estadoLargo(j.estado))} el ${K.fechaCorta(K.salidaDe(j))}${j.motivoSalida ? ' · ' + e(j.motivoSalida) : ''}</span></div>`);
  K.tarjetaEstado = (j) => {
    const ins = K.inscrito(j), t = K.ESTADO_TEXTO[ins ? 'inscrito' : j.estado] || K.ESTADO_TEXTO.inscrito;
    return `<div class="card"><h2>Estado en el club</h2>
      <p class="sub"><b>${e(t[0])}</b>${ins ? '' : ' · ' + K.fechaCorta(K.salidaDe(j))}. ${e(t[1])}</p>
      <div class="fila gap wrap">${ins
        ? '<button class="btn sec chico" data-acc="catJugador">Cambiar de categoría</button><button class="btn peligro chico" data-acc="bajaJugador">Dar de baja</button>'
        : '<button class="btn chico" data-acc="reinscribirJugador">Volver a inscribir</button><button class="btn peligro chico" data-acc="eliminarDefinitivo">Eliminar definitivamente</button>'}</div>
      ${ayudaEstados()}</div>`;
  };

  /* ======================= DAR DE BAJA ======================= */
  K.formBaja = function (j) {
    const gl = K.jugadorGlobal(j.id), inf = gl ? gl.inf : K.inf();
    const abierta = inf.casos.some((c) => c.jugadorId === j.id && c.tipo === 'lesion' && !c.alta);
    K.modal({
      titulo: 'Dar de baja',
      cuerpo: `<p class="suave" style="margin:0 0 10px"><b>${e(j.nombre)}</b> pasará al <b>Archivo</b>. No se borra nada: su ficha y sus registros se conservan y siguen saliendo en los informes de los años en que estuvo inscrito.</p>
        ${abierta ? '<div class="aviso">Tiene una lesión sin alta. Seguirá en su ficha, pero dejará de aparecer en la pestaña Kine.</div>' : ''}
        <label class="campo"><span>Estado</span><select name="estado"><option value="">— elegir —</option>${SALIDAS.map(([v]) => `<option value="${v}">${e(K.estadoLargo(v))}</option>`).join('')}</select></label>
        <p class="suave" data-est-txt style="margin:-4px 0 10px">Elige por qué sale.</p>
        <label class="campo"><span>Fecha de salida</span><input type="date" name="salida" value="${K.hoy()}"></label>
        <label class="campo"><span>Motivo (opcional)</span><input type="text" name="motivo" placeholder="Ej. término de contrato" autocomplete="off"></label>`,
      botones: [{ txt: 'Cancelar', cls: 'sec' }, { txt: 'Dar de baja', cls: 'peligro', fn: (m, hoja) => {
        const d = K.datos(hoja);
        if (!d.estado) { K.aviso('Elige el estado (liberado, cedido, promovido o retirado)', true); return false; }
        if (!fechaOk(d.salida)) { K.aviso('Elige la fecha de salida', true); return false; }
        if (!K.darDeBaja(j, d.estado, d.salida, d.motivo.trim())) { K.aviso('No se pudo dar de baja', true); return false; }
        K.ui.jugadorId = null; K.ui.jtab = 'inscritos';
        guardar(`${j.nombre} pasó al Archivo (${K.estadoLargo(d.estado)})`);
      } }],
      alMontar: (m, hoja) => {
        const sel = hoja.querySelector('[name=estado]'), txt = hoja.querySelector('[data-est-txt]');
        sel.addEventListener('change', () => { txt.textContent = sel.value ? K.ESTADO_TEXTO[sel.value][1] : 'Elige por qué sale.'; });
      }
    });
  };

  /* ======================= CAMBIAR DE CATEGORÍA ======================= */
  K.cambiarCategoriaUI = (j, n, desde, alTerminar) => {
    const gl = K.jugadorGlobal(j.id); if (!gl) return;
    const r = K.cambiarCategoria(gl.inf, gl.j, n, desde);
    if (!r.ok) { K.aviso('No se pudo cambiar la categoría' + (r.error ? ': ' + r.error : ''), true); return; }
    K.guardar();
    if (alTerminar) alTerminar();
    irAFicha(j.id, n);
    K.aviso(`${j.nombre} ahora está en Sub ${n}${r.movido ? ' (informe ' + K.grupoDe(n).nombre + ')' : ''}`);
  };
  // ¿Cambiar a esta categoría lo mueve de informe? Si es así pide confirmar.
  const confirmarCambio = (j, n, fn) => {
    const gl = K.jugadorGlobal(j.id), g = K.grupoDe(n), gA = gl && K.grupoDeInforme(gl.inf);
    if (g && gA && g.id !== gA.id) K.confirmar(`Su ficha y todo su historial pasarán al informe <b>${e(g.nombre)}</b>. Lo ya registrado se conserva y los informes de años anteriores lo siguen mostrando como estaba.`, 'Cambiar de categoría', fn, false);
    else fn();
  };
  K.formCambiarCat = function (j) {
    const act = nCat(j.categoria);
    K.modal({
      titulo: 'Cambiar de categoría',
      cuerpo: `<p class="suave" style="margin:0 0 10px"><b>${e(j.nombre)}</b> pertenece a <b>${e(j.categoria || 'ninguna categoría')}</b>${(j.tambien || []).length ? ` y también juega en ${e(j.tambien.join(', '))}` : ''}.</p>
        <div class="cat-bloque cat-base">
          <span class="cat-tit">Categoría a la que pertenece</span>
          <label class="campo"><span>Nueva categoría</span><select name="cat">${optsCat(j.categoria)}</select></label>
          <label class="campo"><span>Cambia desde</span><input type="date" name="desde" value="${K.hoy()}"></label>
          <p class="ayuda-cat">Cambia su categoría base: desde esa fecha aparece en las listas, los informes y la ficha de la nueva categoría. Lo anterior queda como estaba en los informes de años pasados. Si la nueva es del otro informe (Sub 15-16 ↔ Sub 18-20), su ficha y todo su historial se mueven allí.</p>
        </div>
        <div class="cat-bloque cat-extra">
          <span class="cat-tit">¿Solo juega a veces en otra categoría?</span>
          <p class="ayuda-cat" style="margin-top:0">No cambies su categoría: marca <b>También juega en</b> (solo para partidos). Su ficha no cambia. <i>Ejemplo: un Sub 16 que también juega en la Sub 20.</i></p>
          ${K.jugador(K.inf(), j.id) ? '<button type="button" class="btn sec chico" data-ir-tambien>Marcar “También juega en”</button>' : ''}
        </div>`,
      botones: [{ txt: 'Cancelar', cls: 'sec' }, { txt: 'Cambiar', fn: (m, hoja) => {
        const d = K.datos(hoja), n = nCat(d.cat);
        if (!n) { K.aviso('Elige la nueva categoría', true); return false; }
        if (n === act) { K.aviso(`Ya está en Sub ${n}`, true); return false; }
        if (!fechaOk(d.desde)) { K.aviso('Elige desde cuándo cambia', true); return false; }
        confirmarCambio(j, n, () => K.cambiarCategoriaUI(j, n, d.desde));
      } }],
      alMontar: (m, hoja) => {
        const b = hoja.querySelector('[data-ir-tambien]');
        if (b) b.addEventListener('click', () => { m.cerrar(); const r = K.jugador(K.inf(), j.id); if (r) setTimeout(() => K.formJugador(r), 220); });
      }
    });
  };

  /* ======================= VOLVER A INSCRIBIR ======================= */
  K.formReinscribir = function (j) {
    const act = j.categoria || '';
    K.modal({
      titulo: 'Volver a inscribir',
      cuerpo: `<p class="suave" style="margin:0 0 10px"><b>${e(j.nombre)}</b> volverá a la lista de <b>Inscritos</b> con su ficha y todo su historial. Elige en qué categoría.</p>
        <label class="campo"><span>Categoría</span><select name="cat">${optsCat(act)}</select></label>`,
      botones: [{ txt: 'Cancelar', cls: 'sec' }, { txt: 'Volver a inscribir', fn: (m, hoja) => {
        const n = nCat(K.datos(hoja).cat);
        if (!n) { K.aviso('Elige la categoría', true); return false; }
        const fin = () => { K.reinscribir(j); if (n !== nCat(j.categoria)) { const gl = K.jugadorGlobal(j.id); K.cambiarCategoria(gl.inf, gl.j, n, K.hoy()); } K.guardar(); irAFicha(j.id, n); K.aviso(`${j.nombre} volvió a estar inscrito en Sub ${n}`); };
        if (n !== nCat(j.categoria)) confirmarCambio(j, n, fin); else fin();
      } }]
    });
  };

  /* ======================= ELIMINAR DEFINITIVAMENTE ======================= */
  K.formEliminarDef = function (j) {
    K.modal({
      titulo: 'Eliminar definitivamente',
      cuerpo: `<div class="aviso" style="background:#fdeceb;border-color:#e8b4b0;color:#7a1a14"><b>Esto no se puede deshacer.</b> Se borrará a <b>${e(j.nombre)}</b> con su ficha y TODOS sus registros: lesiones, atenciones, controles, exámenes, asistencias, datos del seguro y sus minutos e incidencias en partidos. Los informes de años anteriores dejarán de incluirlo.</div>
        <p class="suave">Si solo salió del club, lo mejor es dejarlo en el Archivo: así su historial se conserva.</p>
        <label class="campo"><span>Para confirmar, escribe ELIMINAR</span><input type="text" name="conf" autocomplete="off" autocapitalize="characters"></label>`,
      botones: [{ txt: 'Cancelar', cls: 'sec' }, { txt: 'Eliminar definitivamente', cls: 'peligro', fn: (m, hoja) => {
        if (K.norm(hoja.querySelector('[name=conf]').value) !== 'eliminar') { K.aviso('Escribe ELIMINAR para confirmar', true); return false; }
        K.quitarJugador(j.id); K.ui.jugadorId = null; K.ui.jtab = 'archivo';
        guardar('Jugador eliminado definitivamente');
      } }]
    });
  };

  /* ======================= ASISTENTE “INICIAR TEMPORADA” ======================= */
  const vigente = () => Math.max(0, ...K.state.informes.map((i) => Number(i.tempIniciada) || K.anioTexto(i))); // última temporada iniciada con el asistente
  K.temporadaVigente = vigente;
  // Año calendario mayor que la temporada vigente → hay que iniciar la nueva (0 si no).
  K.temporadaPendiente = () => (K.state && K.state.informes.length && anioCal() > vigente() ? anioCal() : 0);
  const inscritos = () => { const out = []; K.state.informes.forEach((inf) => K.vivos(inf).forEach((j) => out.push({ j, inf }))); return out; };
  const sugiereSalir = (j, anio) => { const edad = K.edadEn(j, anio); return K.catNum(j) === 20 && edad !== null && edad >= 20; };
  const planBase = (anio) => {
    const plan = {};
    inscritos().forEach(({ j }) => { const n = K.catNum(j); plan[j.id] = sugiereSalir(j, anio) ? { a: 'sale', estado: 'liberado', motivo: '' } : SIG[n] ? { a: 'sube' } : { a: 'queda' }; });
    return plan;
  };
  // Conteo de todo lo que no se debe perder (jugadores y registros de todos los informes).
  const CLAVES = ['jugadores', 'casos', 'atenciones', 'eventos', 'asistencias', 'seguros', 'segEventos', 'antecedentes', 'documentos', 'partidos', 'manuales'];
  const contarTodo = () => { const r = {}; CLAVES.forEach((k) => { r[k] = K.state.informes.reduce((a, i) => a + (Array.isArray(i[k]) ? i[k].length : 0), 0); }); r.total = CLAVES.reduce((a, k) => a + r[k], 0); return r; };
  K.contarTodo = contarTodo;

  // Aplica el plan en un solo guardado. acciones: [{ jid, a: 'sube'|'queda'|'sale', estado, motivo }]. Si algo falla, deja todo como estaba.
  K.iniciarTemporada = (anio, acciones) => {
    anio = Number(anio);
    if (!anio || vigente() >= anio) return { ok: false, ya: true, anio };
    const snap = JSON.stringify(K.state.informes), periodo0 = JSON.stringify(K.state.periodo), antes = contarTodo();
    const guardarOrig = K.guardar; K.guardar = () => {}; // un solo guardado al final
    const res = { ok: true, anio, sube: 0, queda: 0, sale: 0, cambianInforme: 0, porCat: {}, salen: [], antes, despues: null };
    const suma = (cat, k) => { const c = (res.porCat[cat] = res.porCat[cat] || { sube: 0, queda: 0, sale: 0 }); c[k]++; };
    try {
      const desde = anio + '-01-01', salida = (anio - 1) + '-12-31';
      (acciones || []).forEach((ac) => {
        const gl = K.jugadorGlobal(ac.jid); if (!gl || !K.inscrito(gl.j)) return;
        const n = K.catNum(gl.j), etq = n ? 'Sub ' + n : 'Sin categoría';
        if (ac.a === 'sale') {
          if (!K.darDeBaja(gl.j, ac.estado, salida, ac.motivo || '')) throw new Error('estado de salida no válido para ' + gl.j.nombre);
          res.sale++; suma(etq, 'sale'); res.salen.push({ id: gl.j.id, nombre: gl.j.nombre, cat: etq, estado: ac.estado });
        } else if (ac.a === 'sube' && SIG[n]) {
          const r = K.cambiarCategoria(gl.inf, gl.j, SIG[n], desde);
          if (!r.ok) throw new Error('no se pudo subir a ' + gl.j.nombre);
          if (r.movido) res.cambianInforme++;
          res.sube++; suma(etq, 'sube');
        } else { res.queda++; suma(etq, 'queda'); }
      });
      // textos del informe y comentarios de cada jugador: lo del año que termina queda archivado en su año
      K.state.informes.forEach((inf) => {
        const cierra = Number(inf.tempIniciada) || K.anioTexto(inf);
        (inf.partidos || []).forEach((p) => { if (!p.fecha && !p.anio) p.anio = cierra; }); // un partido sin fecha se queda en el año que cierra
        K.rotarTextos(inf, anio); inf.tempIniciada = anio;
        if (anio >= K.ATEN_PARTIDOS_DESDE && typeof inf.atencionesPartidos !== 'boolean') inf.atencionesPartidos = true; // desde el 2027 los datos de partidos van en el informe general
      });
      K.state.informes.forEach((inf) => (inf.jugadores || []).forEach((j) => { if (K.inscrito(j)) K.rotarJugador(inf, j, anio); }));
      K.state.periodo = K.state.periodo || { tipo: 'anual', desde: '', hasta: '' };
      K.state.periodo.anio = anio;
      res.despues = contarTodo();
      CLAVES.forEach((k) => { if (res.despues[k] !== antes[k]) throw new Error('el conteo de ' + k + ' no coincide (' + antes[k] + ' → ' + res.despues[k] + ')'); });
    } catch (err) {
      K.guardar = guardarOrig;
      K.state.informes.splice(0, K.state.informes.length, ...JSON.parse(snap)); K.state.periodo = JSON.parse(periodo0);
      return { ok: false, error: String((err && err.message) || err) };
    }
    K.guardar = guardarOrig;
    K.guardar();
    return res;
  };

  K.irTemporada = (anio) => {
    if (!K.ui.cat) { K.ui.cat = 16; K.state.activo = K.informeGrupo(K.grupoDe(16)).id; }
    const v = vigente(), cal = anioCal();
    K.ui.temp = { anio: Number(anio) || cal, paso: 1, plan: null, q: '', resultado: null, respaldo: false };
    K.ui.pantalla = 'temporada'; K.ui.jugadorId = null; K.render(); window.scrollTo(0, 0);
  };
  const T = () => K.ui.temp;
  const pasosHTML = (p) => `<div class="tp-pasos">${['Respaldo', 'Jugadores', 'Resumen'].map((t, i) => `<span class="${i + 1 === p ? 'act' : i + 1 < p ? 'hecho' : ''}"><i>${i + 1}</i>${t}</span>`).join('')}</div>`;

  K.pTemporada = function () {
    const t = T(); if (!t) { K.ui.pantalla = 'ajustes'; return ''; }
    const cab = (sub) => `<div class="titulo-vista"><h1>Iniciar temporada ${t.anio}</h1><button class="btn ghost chico" data-acc="tempSalir">Cerrar</button></div>${sub || ''}`;
    if (t.resultado) return cab() + resultadoHTML(t);
    const v = vigente();
    if (t.paso === 1) {
      const ya = v >= t.anio, sugerido = v + 1;
      const años = Array.from(new Set([anioCal(), anioCal() + 1, sugerido, t.anio])).sort();
      const resp = K.state.ultimoRespaldo === K.hoy();
      return cab(pasosHTML(1)) + `<div class="card"><h2>Qué hace esta guía</h2>
          <ol class="tp-lista"><li>Sube de categoría a los jugadores que tú elijas (Sub 15 → 16 → 18 → 20) y da de baja a los que salen. <b>No se borra a nadie</b>: quien sale pasa al Archivo.</li>
          <li>Deja el informe de ${t.anio} listo y en blanco (conclusiones, objetivos y comentarios), con el mismo cuerpo técnico. Lo escrito el año anterior queda guardado en su año.</li>
          <li>El informe del año anterior se sigue viendo <b>tal cual quedó</b>: cada jugador aparece con la categoría que tenía entonces.</li></ol>
          <label class="campo" style="max-width:220px"><span>Temporada que vas a iniciar</span><select data-acc-change="tempAnio">${años.map((a) => `<option${a === t.anio ? ' selected' : ''}>${a}</option>`).join('')}</select></label>
          ${ya ? `<div class="aviso ok"><b>La temporada ${t.anio} ya está iniciada.</b> No hay nada que hacer aquí. ${v + 1 !== t.anio ? `<a href="#" data-acc="tempAnioSug" data-a="${sugerido}">Preparar la temporada ${sugerido}</a>` : ''}</div>` : `<div class="aviso">Primero se descarga un <b>respaldo</b> de todos tus datos, por seguridad. ${resp ? 'Ya descargaste uno hoy: puedes seguir sin descargar otro.' : ''}</div>
          <div class="fila gap wrap"><button class="btn" data-acc="tempRespaldo">${K.uiIco('descargar', 18)} Descargar respaldo y continuar</button>${resp ? '<button class="btn sec" data-acc="tempSeguir">Ya tengo el respaldo de hoy</button>' : ''}</div>`}
        </div>`;
    }
    if (!t.plan) t.plan = planBase(t.anio);
    if (t.paso === 2) return cab(pasosHTML(2)) + pasoJugadores(t);
    return cab(pasosHTML(3)) + pasoResumen(t);
  };

  const opcionesFila = (n, a, estado) => {
    const val = a === 'sale' ? 'sale:' + estado : a;
    return (SIG[n] ? `<option value="sube"${val === 'sube' ? ' selected' : ''}>Sube a Sub ${SIG[n]}</option>` : '')
      + `<option value="queda"${val === 'queda' ? ' selected' : ''}>Se queda${n ? ' en Sub ' + n : ''}</option>`
      + SALIDAS.map(([v, tx]) => `<option value="sale:${v}"${val === 'sale:' + v ? ' selected' : ''}>Sale: ${e(tx)}</option>`).join('');
  };
  function pasoJugadores(t) {
    const todos = inscritos(), q = K.norm(t.q);
    const grupos = CATS.concat([null]).map((c) => ({ c, js: todos.filter(({ j }) => (K.catNum(j) || null) === c).sort((a, b) => a.j.nombre.localeCompare(b.j.nombre, 'es')) })).filter((g) => g.js.length);
    const filas = (g) => g.js.map(({ j }) => {
      const p = t.plan[j.id] || { a: 'queda' }, edad = K.edadEn(j, t.anio), sug = sugiereSalir(j, t.anio), n = g.c;
      return `<div class="tp-fila${sug ? ' sug' : ''}${p.a === 'sale' ? ' sale' : ''}" data-tj="${e(j.id)}" data-n="${e(K.norm(j.nombre))}"${q && !K.norm(j.nombre).includes(q) ? ' hidden' : ''}>
        <div class="tp-nom"><b>${e(j.nombre)}</b><span>${j.nacimiento ? e(j.nacimiento) + (edad !== null ? ` · ${edad} años en ${t.anio}` : '') : 'Sin año de nacimiento'}${sug ? ' <i class="chip g-moderada">Cumple 20: se sugiere que salga</i>' : ''}</span></div>
        <select data-acc-change="tempElegir" data-id="${e(j.id)}" aria-label="Qué pasa con ${e(j.nombre)}">${opcionesFila(n, p.a, p.estado)}</select>
        ${p.a === 'sale' ? `<input type="text" class="tp-motivo" placeholder="Motivo (opcional)" value="${e(p.motivo || '')}" data-acc-change="tempMotivo" data-id="${e(j.id)}" aria-label="Motivo de salida">` : ''}</div>`;
    }).join('');
    return `<div class="card"><h2>¿Qué pasa con cada jugador en ${t.anio}?</h2>
        <p class="sub">Por defecto cada uno sube a la categoría siguiente (la Sub 20 se queda). Cambia lo que haga falta o usa los atajos de cada categoría.</p>
        ${todos.length > 8 ? `<input type="search" placeholder="Buscar jugador…" value="${e(t.q)}" data-acc-input="tempBuscar" aria-label="Buscar jugador" style="margin-bottom:6px">` : ''}</div>
      ${grupos.length ? grupos.map((g) => `<div class="card tp-grupo" data-g="${g.c || 0}"><div class="tp-cab"><h3>${g.c ? 'Sub ' + g.c : 'Sin categoría'} <span class="suave" style="font-weight:400">· ${g.js.length}</span></h3>
          <div class="fila gap wrap">${SIG[g.c] ? `<button class="btn sec chico" data-acc="tempTodos" data-c="${g.c}" data-v="sube">Todos suben</button>` : ''}<button class="btn sec chico" data-acc="tempTodos" data-c="${g.c || 0}" data-v="queda">Todos se quedan</button><button class="btn sec chico" data-acc="tempTodos" data-c="${g.c || 0}" data-v="sale">Todos salen</button></div></div>
          <div class="tp-filas">${filas(g)}</div></div>`).join('') : '<div class="card"><p class="vacio-msg">No hay jugadores inscritos.</p></div>'}
      <div class="tp-pie"><button class="btn sec" data-acc="tempAtras">Atrás</button><button class="btn" data-acc="tempSiguiente">Ver resumen</button></div>`;
  }
  function resumen(t) {
    const todos = inscritos(), r = { sube: 0, queda: 0, sale: 0, porCat: {}, salen: [], cambian: 0 };
    todos.forEach(({ j }) => {
      const p = t.plan[j.id] || { a: 'queda' }, n = K.catNum(j), etq = n ? 'Sub ' + n : 'Sin categoría';
      const a = p.a === 'sube' && !SIG[n] ? 'queda' : p.a;
      const c = (r.porCat[etq] = r.porCat[etq] || { sube: 0, queda: 0, sale: 0 });
      c[a]++; r[a]++;
      if (a === 'sale') r.salen.push({ nombre: j.nombre, cat: etq, estado: p.estado, sug: sugiereSalir(j, t.anio), motivo: p.motivo });
      if (a === 'sube' && K.grupoDe(SIG[n]) !== K.grupoDe(n)) r.cambian++;
    });
    return r;
  }
  function pasoResumen(t) {
    const r = resumen(t), cats = CATS.map((c) => 'Sub ' + c).concat(['Sin categoría']).filter((c) => r.porCat[c]);
    return `<div class="card"><h2>Resumen</h2>
        <div class="tp-kpis"><div><b>${r.sube}</b><span>suben</span></div><div><b>${r.queda}</b><span>se quedan</span></div><div><b>${r.sale}</b><span>salen</span></div></div>
        <div class="tp-tabla"><table class="kt"><thead><tr><th>Categoría hoy</th><th>Suben</th><th>Se quedan</th><th>Salen</th></tr></thead><tbody>${cats.map((c) => `<tr><td>${e(c)}</td><td>${r.porCat[c].sube}</td><td>${r.porCat[c].queda}</td><td>${r.porCat[c].sale}</td></tr>`).join('')}</tbody></table></div>
        ${r.cambian ? `<p class="suave">${r.cambian} jugador${r.cambian === 1 ? '' : 'es'} pasa${r.cambian === 1 ? '' : 'n'} del informe Sub 15-16 al informe Sub 18-20, con toda su ficha y su historial.</p>` : ''}</div>
      ${r.salen.length ? `<div class="card"><h3>Salen del club (pasan al Archivo, con fecha de salida 31-12-${t.anio - 1})</h3><div class="lista">${r.salen.map((s) => `<div class="item" style="cursor:default"><div class="txt"><b>${e(s.nombre)}</b><span>${e(s.cat)} · ${e(K.estadoLargo(s.estado))}${s.sug ? ' · sugerido por edad' : ''}${s.motivo ? ' · ' + e(s.motivo) : ''}</span></div></div>`).join('')}</div></div>` : ''}
      <div class="aviso">Al confirmar: los jugadores cambian de categoría desde el 1 de enero de ${t.anio}, el informe de ${t.anio} parte en blanco y todo lo escrito en ${t.anio - 1} queda guardado en su año. Nadie se borra. Puedes revisar el informe de ${t.anio - 1} cuando quieras cambiando el año en la pestaña Informe.</div>
      <div class="tp-pie"><button class="btn sec" data-acc="tempAtras">Atrás</button><button class="btn" data-acc="tempConfirmar">Confirmar e iniciar temporada ${t.anio}</button></div>`;
  }
  function resultadoHTML(t) {
    const r = t.resultado;
    if (!r.ok) return `<div class="card"><div class="aviso" style="background:#fdeceb;border-color:#e8b4b0;color:#7a1a14"><b>No se aplicó ningún cambio.</b> ${r.ya ? `La temporada ${t.anio} ya estaba iniciada.` : `Algo falló y todo quedó como estaba: ${e(r.error || '')}`}</div><button class="btn sec" data-acc="tempSalir">Volver</button></div>`;
    return `<div class="card"><div class="aviso ok"><b>Temporada ${r.anio} iniciada.</b> No se perdió ningún registro.</div>
      <ul class="tp-lista"><li><b>${r.sube}</b> jugador${r.sube === 1 ? '' : 'es'} subió de categoría${r.cambianInforme ? ` (${r.cambianInforme} cambió de informe)` : ''}.</li>
        <li><b>${r.queda}</b> se quedó en su categoría.</li>
        <li><b>${r.sale}</b> pasó${r.sale === 1 ? '' : 'ron'} al Archivo${r.sale ? ' (con fecha de salida 31-12-' + (r.anio - 1) + ')' : ''}.</li>
        <li>Conclusiones, objetivos y comentarios de ${r.anio - 1} quedaron guardados en su año; ${r.anio} parte en blanco.</li>
        <li>Registros antes y después: <b>${r.antes.total}</b> y <b>${r.despues.total}</b> (jugadores, atenciones, lesiones, partidos…).</li></ul>
      <p class="suave">¿Llegan jugadores nuevos? Cárgalos ahora (Sub 15 ya viene elegida).</p>
      <div class="fila gap wrap"><button class="btn" data-acc="tempNuevos">Cargar jugadores nuevos</button><button class="btn sec" data-acc="tempIrInforme">Ir al informe ${r.anio}</button></div></div>`;
  }

  Object.assign(K.acciones, {
    iniciarTemporada() { K.irTemporada(K.temporadaPendiente() || undefined); },
    tempSalir() { K.ui.temp = null; K.ui.pantalla = 'ajustes'; K.render(); window.scrollTo(0, 0); },
    tempAnio(el) { const t = T(); t.anio = Number(el.value); t.plan = null; K.render(); },
    tempAnioSug(el, ev) { if (ev) ev.preventDefault(); const t = T(); t.anio = Number(el.dataset.a); t.plan = null; K.render(); },
    tempRespaldo() { try { K.exportar(false); } catch (err) { K.aviso('No se pudo descargar el respaldo: no se sigue', true); return; } T().respaldo = true; T().paso = 2; K.render(); window.scrollTo(0, 0); },
    tempSeguir() { T().paso = 2; K.render(); window.scrollTo(0, 0); },
    tempElegir(el) {
      const p = T().plan[el.dataset.id] || (T().plan[el.dataset.id] = {}), v = el.value;
      if (v.startsWith('sale:')) { p.a = 'sale'; p.estado = v.slice(5); p.motivo = p.motivo || ''; } else { p.a = v; delete p.estado; }
      K.render();
    },
    tempMotivo(el) { const p = T().plan[el.dataset.id]; if (p) p.motivo = el.value.trim(); },
    tempTodos(el) {
      const t = T(), c = Number(el.dataset.c) || null, v = el.dataset.v;
      inscritos().filter(({ j }) => (K.catNum(j) || null) === c).forEach(({ j }) => { t.plan[j.id] = v === 'sale' ? { a: 'sale', estado: 'liberado', motivo: '' } : { a: v }; });
      K.render();
    },
    tempBuscar(el) {
      const t = T(); t.q = el.value; const q = K.norm(t.q);
      document.querySelectorAll('[data-tj]').forEach((f) => { f.hidden = !!q && !f.dataset.n.includes(q); });
      document.querySelectorAll('.tp-grupo').forEach((g) => { g.hidden = !!q && ![...g.querySelectorAll('[data-tj]')].some((f) => !f.hidden); });
    },
    tempAtras() { const t = T(); t.paso = Math.max(1, t.paso - 1); K.render(); window.scrollTo(0, 0); },
    tempSiguiente() { T().paso = 3; K.render(); window.scrollTo(0, 0); },
    tempConfirmar() {
      const t = T(), acc = inscritos().map(({ j }) => { const p = t.plan[j.id] || { a: 'queda' }; return { jid: j.id, a: p.a, estado: p.estado, motivo: p.motivo }; });
      t.resultado = K.iniciarTemporada(t.anio, acc);
      K.render(); window.scrollTo(0, 0);
    },
    tempNuevos() { K.formLista({ cat: 'Sub 15', ingreso: T().anio + '-01-01' }); },
    tempIrInforme() { K.ui.temp = null; K.ui.pantalla = 'informe'; K.render(); window.scrollTo(0, 0); }
  });

  /* ---------- Tarjeta en Ajustes y aviso en Inicio ---------- */
  K.tarjetaTemporada = () => {
    const v = vigente(), pend = K.temporadaPendiente(), prox = pend || v + 1;
    return `<div class="card"><h2>Nueva temporada</h2>
      <p class="sub">Temporada vigente: <b>${v}</b>. Al empezar un año nuevo, esta guía sube de categoría a los jugadores, da de baja a quienes salen y deja el informe del año nuevo en blanco, sin perder nada del año anterior.</p>
      ${pend ? `<div class="aviso">Ya empezó ${pend}: falta iniciar la temporada.</div>` : ''}
      <button class="btn${pend ? '' : ' sec'}" data-acc="iniciarTemporada">Iniciar temporada ${prox}</button></div>`;
  };
  K.avisoTemporada = () => {
    const a = K.temporadaPendiente(); if (!a || !K.puedeEditar()) return '';
    return `<div class="aviso aviso-temp"><div><b>Empezó ${a}.</b> Falta iniciar la temporada: subir de categoría a los jugadores y dejar el informe nuevo listo. El informe de ${a - 1} no se pierde.</div><button class="btn chico" data-iniciar-temp="${a}">Iniciar temporada ${a}</button></div>`;
  };
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-iniciar-temp]');
    if (b) K.irTemporada(Number(b.dataset.iniciarTemp));
  });
})();

/* Pestaña Kine · Seguro (ingreso, eventos con N.º de asistencia, estadísticas de uso) y calendario anual de asistencia.
   Los datos del seguro (RUT, etc.) son privados: en la nube solo los ven los administradores. */
(function () {
  const K = window.K;
  const e = K.esc;
  const { D, dif, suma, MESES } = K.kineFechas;
  const fc = (iso) => K.fechaCorta(iso);

  const TIPOS = [['control', 'Control médico'], ['examen', 'Examen'], ['procedimiento', 'Procedimiento'], ['kinesiologia', 'Kinesiología'], ['cirugia', 'Cirugía'], ['hosp', 'Hospitalización']];
  const TIPO_TXT = Object.fromEntries(TIPOS);
  const TIPO_COL = { control: '#7b4fb8', examen: '#f08a24', procedimiento: '#c2479b', kinesiologia: '#14a3a3', cirugia: '#1f2937', hosp: '#b3202a' };
  const PROC_BASE = ['Infiltración', 'Punción', 'Sutura', 'Yeso / inmovilización', 'Curación', 'Retiro de puntos', 'Artroscopía'];
  const CLINICAS_BASE = [];

  const todos = (arr) => K.kineInfs().reduce((a, inf) => a.concat((inf[arr] || []).map((x) => ({ inf, x }))), []);
  const segPorId = (sid) => { for (const inf of K.kineInfs()) { const s = (inf.seguros || []).find((x) => x.id === sid); if (s) return { inf, s }; } return null; };
  // Un jugador puede tener varias activaciones del seguro (cada una con su diagnóstico, clínica y N.º de asistencia).
  const activacionesDe = (inf, jid) => (inf.seguros || []).filter((x) => x.jugadorId === jid);
  const evsDe = (inf, s) => { const primera = activacionesDe(inf, s.jugadorId)[0]; return (inf.segEventos || []).filter((x) => x.jugadorId === s.jugadorId && (x.seguroId ? x.seguroId === s.id : primera && primera.id === s.id)); };
  const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
  const frec = (arr) => { const m = {}; arr.filter(Boolean).forEach((v) => { m[v] = (m[v] || 0) + 1; }); return Object.keys(m).sort((a, b) => m[b] - m[a] || a.localeCompare(b, 'es')); };
  const procGuardados = () => uniq(frec(todos('segEventos').filter((r) => r.x.tipo === 'procedimiento').map((r) => (r.x.detalle || '').trim())).concat(PROC_BASE));
  const clinicasGuardadas = () => uniq(frec(todos('seguros').map((r) => (r.x.clinica || '').trim())).concat(CLINICAS_BASE));
  // RUT con formato fijo NN.NNN.NNN-N (puntos y guion automáticos).
  const fmtRut = (v) => {
    const t = String(v || '').replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9); if (t.length < 2) return t;
    return t.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + t.slice(-1);
  };
  K.formatoRut = fmtRut;
  const ss = () => { const s = K.kineEstado(); if (s.segAnio === undefined) s.segAnio = 'todo'; return s; };

  /* ---------- Ingreso al seguro ---------- */
  function formIngreso(sid) {
    const ya = sid ? segPorId(sid) : null, js = K.kineJugadores();
    if (!js.length) { K.aviso('Primero agrega jugadores en la pestaña Jugadores', true); return; }
    const s = ya ? ya.s : {}, jid = ya ? s.jugadorId : '';
    const opcJ = js.filter((x) => !ya || x.j.id === jid).map((x) => `<option value="${x.inf.id}|${x.j.id}"${x.j.id === jid ? ' selected' : ''}>${e(x.j.nombre)} · ${e(x.j.categoria || 'Sub ' + x.cat)}</option>`).join('');
    K.modal({
      titulo: ya ? 'Datos de la activación del seguro' : 'Nueva activación del seguro',
      cuerpo: `
        <label class="campo"><span>Jugador (nombre completo y categoría)</span><select name="jid" ${ya ? 'disabled' : ''}>${ya ? '' : '<option value="">— elegir —</option>'}${opcJ}</select></label>
        <p class="suave" data-prev style="margin:-4px 0 8px"></p>
        <label class="campo"><span>Diagnóstico o motivo de esta activación (ej. Esguince de tobillo)</span><input type="text" name="diagnostico" list="dl-segdx" value="${e(s.diagnostico || '')}" autocomplete="off"><datalist id="dl-segdx"></datalist></label>
        <div class="grid2">
          <label class="campo"><span>RUT</span><input type="text" name="rut" value="${e(fmtRut(s.rut))}" placeholder="12.345.678-9" inputmode="text" maxlength="12" autocomplete="off"></label>
          <label class="campo"><span>Fecha de nacimiento</span><input type="date" name="fechaNac" value="${e(s.fechaNac || '')}"></label>
        </div>
        <div class="grid2">
          <label class="campo"><span>Comuna donde vive</span><input type="text" name="comuna" value="${e(s.comuna || '')}" autocomplete="off"></label>
          <label class="campo"><span>Fecha de activación del seguro</span><input type="date" name="activacion" value="${e(s.activacion || '')}"></label>
        </div>
        <div class="grid2">
          <label class="campo"><span>Clínica a la que asiste</span><input type="text" name="clinica" list="dl-clin" value="${e(s.clinica || '')}" autocomplete="off"><datalist id="dl-clin">${clinicasGuardadas().map((c) => `<option value="${e(c)}">`).join('')}</datalist></label>
          <label class="campo"><span>N.º de asistencia de la clínica</span><input type="text" name="nClinica" value="${e(s.nClinica || '')}" autocomplete="off"></label>
        </div>
        <p class="suave">Estos datos son privados: solo los ven los administradores y no salen en el informe.</p>`,
      botones: [
        ya ? { txt: 'Quitar', cls: 'peligro', fn: () => { K.confirmar('¿Quitar esta activación del seguro? También se borran sus eventos.', 'Quitar', () => { const evs = evsDe(ya.inf, s).map((x) => x.id); ya.inf.seguros = ya.inf.seguros.filter((x) => x.id !== s.id); ya.inf.segEventos = (ya.inf.segEventos || []).filter((x) => !evs.includes(x.id)); K.guardar(); K.aviso('Quitado'); K.render(); }); return true; } } : { txt: 'Cancelar', cls: 'sec' },
        {
          txt: 'Guardar',
          fn: (m, hoja) => {
            const d = K.datos(hoja);
            const campos = { diagnostico: (d.diagnostico || '').trim(), rut: fmtRut(d.rut), fechaNac: d.fechaNac || '', comuna: (d.comuna || '').trim(), activacion: d.activacion || '', clinica: (d.clinica || '').trim(), nClinica: (d.nClinica || '').trim() };
            if (!campos.diagnostico) { K.aviso('Escribe el diagnóstico o motivo de esta activación', true); return false; }
            if (ya) Object.assign(s, campos);
            else {
              if (!d.jid) { K.aviso('Elige un jugador', true); return false; }
              const [iid, id] = d.jid.split('|'), inf = K.state.informes.find((i) => i.id === iid);
              inf.seguros = inf.seguros || []; inf.seguros.push(Object.assign({ id: K.uid(), jugadorId: id }, campos));
            }
            K.guardar(); K.aviso('Guardado'); K.render();
          }
        }
      ],
      alMontar: (m, hoja) => {
        const r = hoja.querySelector('[name=rut]'); r.addEventListener('input', () => { r.value = fmtRut(r.value); });
        const sel = hoja.querySelector('[name=jid]'), dl = hoja.querySelector('#dl-segdx'), prev = hoja.querySelector('[data-prev]');
        const alElegir = () => {
          const [iid, id] = (sel.value || '').split('|'), inf = K.state.informes.find((i) => i.id === iid); if (!inf || !id) { prev.textContent = ''; return; }
          dl.innerHTML = inf.casos.filter((c) => c.jugadorId === id && c.tipo === 'lesion').map((c) => `<option value="${e(c.titulo)}">`).join('');
          const antes = activacionesDe(inf, id).filter((x) => !ya || x.id !== s.id);
          prev.textContent = antes.length ? `Ya tiene ${antes.length} activaci${antes.length === 1 ? 'ón' : 'ones'} anterior${antes.length === 1 ? '' : 'es'}; esta es una nueva.` : '';
          if (!ya && antes.length) { const u = antes[antes.length - 1]; [['rut', fmtRut(u.rut)], ['fechaNac', u.fechaNac], ['comuna', u.comuna]].forEach(([n, v]) => { const el = hoja.querySelector(`[name=${n}]`); if (el && !el.value && v) el.value = v; }); }
        };
        sel.addEventListener('change', alElegir); alElegir();
      }
    });
  }

  /* ---------- Eventos del seguro ---------- */
  function formEvento(sid, rec) {
    const r = segPorId(sid); if (!r) return;
    const inf = r.inf, jid = r.s.jugadorId, j = K.jugador(inf, jid);
    const tipo0 = rec ? rec.tipo : 'control';
    const exSug = K.EV.examen.sug, exEsta = rec && rec.tipo === 'examen' && exSug.includes(rec.detalle);
    const casos = inf.casos.filter((c) => c.jugadorId === jid).sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''));
    K.modal({
      titulo: (rec ? 'Editar evento' : 'Nuevo evento') + ' · ' + (j ? j.nombre : '') + (r.s.diagnostico ? ' · ' + r.s.diagnostico : ''),
      cuerpo: `
        <div class="grid2">
          <label class="campo"><span>Tipo de evento</span><select name="tipo">${K.opts(TIPOS, tipo0)}</select></label>
          <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${rec ? e(rec.fecha) : K.hoy()}"></label>
        </div>
        <div data-blq="examen" class="${tipo0 === 'examen' ? '' : 'oculto'}">
          <label class="campo"><span>Examen</span><select name="exSel">${K.opts(exSug.map((x) => [x, x]).concat([['__otro', 'Otro (escribir)…']]), rec && rec.tipo === 'examen' ? (exEsta ? rec.detalle : '__otro') : exSug[0])}</select></label>
        </div>
        <label class="campo" data-blq="detalle"><span data-lbl>Detalle</span><input type="text" name="detalle" list="dl-segdet" value="${e(rec && !(rec.tipo === 'examen' && exEsta) ? rec.detalle || '' : '')}" autocomplete="off"><datalist id="dl-segdet"></datalist></label>
        <div class="grid2">
          <label class="campo"><span>N.º de asistencia del seguro</span><input type="text" name="nAsist" value="${e(rec ? rec.nAsist || '' : '')}" autocomplete="off"></label>
          <label class="campo" data-blq="cantidad"><span>Cantidad de sesiones</span><input type="number" inputmode="numeric" min="1" name="cantidad" value="${e(rec ? rec.cantidad || 1 : 1)}"></label>
        </div>
        <label class="campo oculto" data-blq="hasta"><span>Hasta (si fueron varios días)</span><input type="date" name="hasta" value="${rec ? e(rec.hasta || '') : ''}"></label>
        <label class="campo"><span>Lesión asociada (opcional)</span><select name="casoId"><option value="">—</option>${casos.map((c) => `<option value="${c.id}"${rec && rec.casoId === c.id ? ' selected' : ''}>${e(c.titulo)}${c.inicio ? ' · ' + e(fc(c.inicio)) : ''}</option>`).join('')}</select></label>
        <label class="campo"><span>Notas (opcional)</span><textarea name="notas">${e(rec ? rec.notas || '' : '')}</textarea></label>`,
      botones: [
        rec ? { txt: 'Eliminar', cls: 'peligro', fn: () => { K.confirmar('¿Eliminar este evento?', 'Eliminar', () => { inf.segEventos = inf.segEventos.filter((x) => x.id !== rec.id); K.guardar(); K.aviso('Eliminado'); K.render(); }); return true; } } : { txt: 'Cancelar', cls: 'sec' },
        {
          txt: 'Guardar',
          fn: (m, hoja) => {
            const d = K.datos(hoja), tipo = d.tipo;
            const detalle = tipo === 'examen' && d.exSel !== '__otro' ? d.exSel : (d.detalle || '').trim();
            const campos = { jugadorId: jid, seguroId: sid, tipo, fecha: d.fecha, detalle, nAsist: (d.nAsist || '').trim(), cantidad: tipo === 'kinesiologia' ? Math.max(1, Number(d.cantidad) || 1) : 1, hasta: tipo === 'hosp' ? d.hasta || '' : '', casoId: d.casoId || '', notas: d.notas };
            if (!campos.fecha) { K.aviso('Pon la fecha', true); return false; }
            inf.segEventos = inf.segEventos || [];
            if (rec) Object.assign(inf.segEventos.find((x) => x.id === rec.id), campos); else inf.segEventos.push(Object.assign({ id: K.uid() }, campos));
            K.guardar(); K.aviso('Guardado'); K.render();
          }
        }
      ],
      alMontar: (m, hoja) => {
        const sel = hoja.querySelector('[name=tipo]'), q = (n) => hoja.querySelector(`[data-blq=${n}]`), exSel = hoja.querySelector('[name=exSel]');
        const lbl = hoja.querySelector('[data-lbl]'), dl = hoja.querySelector('#dl-segdet');
        const ajustar = () => {
          const t = sel.value;
          q('examen').classList.toggle('oculto', t !== 'examen');
          q('detalle').classList.toggle('oculto', t === 'examen' && exSel.value !== '__otro');
          q('cantidad').classList.toggle('oculto', t !== 'kinesiologia');
          q('hasta').classList.toggle('oculto', t !== 'hosp');
          lbl.textContent = t === 'control' ? 'Con quién (especialidad)' : t === 'examen' ? 'Nombre del examen' : t === 'procedimiento' ? 'Procedimiento (se guarda para sugerirlo la próxima vez)' : t === 'cirugia' ? 'Cirugía' : t === 'hosp' ? 'Motivo' : 'Detalle (opcional)';
          const sug = t === 'procedimiento' ? procGuardados() : t === 'control' ? K.EV.control.sug : [];
          dl.innerHTML = sug.map((x) => `<option value="${e(x)}">`).join('');
        };
        sel.addEventListener('change', ajustar); exSel.addEventListener('change', ajustar); ajustar();
      }
    });
  }

  /* ---------- Pantalla Seguro ---------- */
  function tarjetaSeg(inf, s) {
    const j = K.jugador(inf, s.jugadorId); if (!j) return '';
    const evs = evsDe(inf, s).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    const abierto = !!(ss().segAbierto || {})[s.id], cat = e(j.categoria || 'Sub ' + K.kineCatDe(j, inf));
    if (!abierto) return `<button type="button" class="seg-mini" data-acc="segToggle" data-sid="${s.id}" aria-expanded="false"><span class="txt"><b>${e(j.nombre)}</b><span>${cat} · ${e(s.diagnostico || 'sin diagnóstico')}</span></span><em>${evs.length} evento${evs.length === 1 ? '' : 's'}</em><i class="seg-flecha">${K.uiIco('abajo', 18)}</i></button>`;
    return `<div class="seg-card abierta">
      <div class="seg-cab seg-cab-t" data-acc="segToggle" data-sid="${s.id}" role="button" tabindex="0" aria-expanded="true"><div class="txt"><b>${e(j.nombre)}</b><span>${cat} · ${e(s.diagnostico || 'sin diagnóstico')}</span></div>
        <button class="btn ghost chico" data-acc="segEditar" data-sid="${s.id}">${K.uiIco('editar', 16)} Datos</button><i class="seg-flecha">${K.uiIco('arriba', 18)}</i></div>
      <dl class="seg-datos"><div style="grid-column:1/-1"><dt>Diagnóstico</dt><dd>${e(s.diagnostico || '—')}</dd></div><div><dt>RUT</dt><dd>${e(fmtRut(s.rut) || '—')}</dd></div><div><dt>Nacimiento</dt><dd>${s.fechaNac ? e(fc(s.fechaNac)) : '—'}</dd></div><div><dt>Comuna</dt><dd>${e(s.comuna || '—')}</dd></div>
        <div><dt>Activación</dt><dd>${s.activacion ? e(fc(s.activacion)) : '—'}</dd></div><div><dt>Clínica</dt><dd>${e(s.clinica || '—')}${s.nClinica ? ' · N.º ' + e(s.nClinica) : ''}</dd></div></dl>
      <div class="fila sb" style="margin:8px 0 2px"><b style="font-size:13.5px">Eventos (${evs.length})</b><button class="btn chico" data-acc="segEvento" data-sid="${s.id}">${K.uiIco('mas', 16)} Evento</button></div>
      ${evs.length ? `<div class="lista">${evs.map((x) => `<div class="item seg-ev" data-acc="segEvEditar" data-id="${x.id}" data-sid="${s.id}"><span class="kc-pto" style="background:${TIPO_COL[x.tipo]}"></span><div class="txt"><b>${e(TIPO_TXT[x.tipo] || x.tipo)}${x.detalle ? ' · ' + e(x.detalle) : ''}${x.tipo === 'kinesiologia' && (Number(x.cantidad) || 1) > 1 ? ' (' + x.cantidad + ' sesiones)' : ''}</b><span>${e(fc(x.fecha))}${x.hasta ? ' al ' + e(fc(x.hasta)) : ''} · ${x.nAsist ? 'N.º asistencia ' + e(x.nAsist) : 'sin N.º de asistencia'}</span></div></div>`).join('')}</div>` : '<p class="suave" style="margin:4px 0 0">Sin eventos todavía.</p>'}
    </div>`;
  }

  function estadisticas() {
    const { hbar, donut, panel, top, sumar, mensual } = K.bd;
    const s = ss(), anios = uniq(todos('segEventos').map((r) => (r.x.fecha || '').slice(0, 4))).sort();
    const f = (x) => s.segAnio === 'todo' || (x.fecha || '').slice(0, 4) === s.segAnio;
    const evs = todos('segEventos').filter((r) => f(r.x)).map((r) => r.x);
    const segs = todos('seguros'), nombre = (jid) => (K.kineBuscarJ(jid) || { j: { nombre: '—' } }).j.nombre;
    const sel = `<label class="campo" style="max-width:240px"><span>Período</span><select data-acc-change="segAnio"><option value="todo">Todo el historial</option>${anios.map((a) => `<option value="${a}"${s.segAnio === a ? ' selected' : ''}>Año ${a}</option>`).join('')}</select></label>`;
    if (!segs.length && !evs.length) return `<div class="card"><h2>Uso del seguro</h2><p class="vacio-msg">Cuando registres activaciones y eventos del seguro, aquí aparecerán las estadísticas.</p></div>`;
    const c = {}; evs.forEach((x) => sumar(c, x.tipo));
    const ses = evs.filter((x) => x.tipo === 'kinesiologia').reduce((a, x) => a + (Number(x.cantidad) || 1), 0);
    const ex = {}; evs.filter((x) => x.tipo === 'examen').forEach((x) => sumar(ex, x.detalle || 'Sin nombre'));
    const pr = {}; evs.filter((x) => x.tipo === 'procedimiento').forEach((x) => sumar(pr, x.detalle || 'Sin nombre'));
    const cl = {}; segs.forEach((r) => sumar(cl, r.x.clinica || 'Sin clínica'));
    const cat = {}; evs.forEach((x) => { const q = K.kineBuscarJ(x.jugadorId); sumar(cat, q ? 'Sub ' + q.cat : 'Sin categoría'); });
    const porJ = {}; evs.forEach((x) => sumar(porJ, nombre(x.jugadorId)));
    const sesJ = {}; evs.filter((x) => x.tipo === 'kinesiologia').forEach((x) => sumar(sesJ, nombre(x.jugadorId), Number(x.cantidad) || 1));
    const conAsist = evs.filter((x) => x.nAsist).length;
    const ini = segs.filter((r) => s.segAnio === 'todo' || (r.x.activacion || '').slice(0, 4) === s.segAnio).length; // activaciones iniciales del período
    const kpi = (n, t) => `<div class="bd-k"><b>${n}</b><span>${t}</span></div>`;
    const partes = TIPOS.map(([k, t]) => [t, c[k] || 0, TIPO_COL[k]]);
    return `<div class="card"><div class="fila sb wrap gap"><h2 style="margin:0">Uso del seguro</h2>${sel}</div>
      <div class="bd-kpis">${kpi(ini, 'Activaciones iniciales de seguro (Sala de urgencias)')}${kpi(ini + evs.length, 'Activaciones + continuidad')}${kpi(evs.length, 'eventos de continuidad')}${kpi(c.control || 0, 'controles')}${kpi(c.examen || 0, 'exámenes')}${kpi(c.procedimiento || 0, 'procedimientos')}${kpi(ses, 'sesiones de kine')}${kpi(c.cirugia || 0, 'cirugías')}${kpi(c.hosp || 0, 'hospitalizaciones')}</div>
      <div class="bd-g">
        ${panel('Eventos por mes', mensual(evs.map((x) => ({ f: x.fecha, cls: 'ev' }))), true)}
        ${panel('Tipo de evento', donut(partes))}
        ${panel('Por categoría', hbar(top(cat, 6), '#3b5bb5'))}
        ${panel('Exámenes más frecuentes', hbar(top(ex, 6), '#f08a24'))}
        ${panel('Procedimientos más frecuentes', hbar(top(pr, 6), '#c2479b'))}
        ${panel('Clínicas (jugadores atendidos)', hbar(top(cl, 6), '#2f7a4a'))}
        ${panel('Jugadores con más eventos', hbar(top(porJ, 8), '#2f7a4a'))}
        ${panel('Sesiones de kinesiología por jugador', hbar(top(sesJ, 8), '#14a3a3'))}
      </div>
      <p class="bd-nota">${conAsist} de ${evs.length} eventos tienen N.º de asistencia registrado.</p></div>`;
  }

  K.kineSeguroHTML = function () {
    const lista = todos('seguros').map((r) => ({ inf: r.inf, s: r.x, cat: (K.kineBuscarJ(r.x.jugadorId) || { cat: 0 }).cat }))
      .sort((a, b) => b.cat - a.cat || ((K.jugador(a.inf, a.s.jugadorId) || { nombre: '' }).nombre).localeCompare((K.jugador(b.inf, b.s.jugadorId) || { nombre: '' }).nombre, 'es') || (a.s.activacion || '').localeCompare(b.s.activacion || ''));
    return `<div class="card"><div class="fila sb wrap gap"><h2 style="margin:0">Activaciones del seguro <span class="suave" style="font-weight:400">(${lista.length})</span></h2><button class="btn chico" data-acc="segNuevo">${K.uiIco('mas', 16)} Nueva activación</button></div>
      <p class="sub" style="margin-top:6px">Cada vez que se activa el seguro de un jugador es una <b>activación</b> (con su diagnóstico, clínica y N.º de asistencia); un mismo jugador puede tener varias. Aquí van los datos que pide el seguro y los eventos (controles, exámenes, procedimientos, sesiones de kinesiología…) con su N.º de asistencia. Son privados: solo los administradores los ven.</p>
      ${lista.length ? lista.map((x) => tarjetaSeg(x.inf, x.s)).join('') : '<p class="vacio-msg">Aún no hay activaciones del seguro.</p>'}</div>
      ${estadisticas()}`;
  };

  /* ---------- Calendario anual de asistencia ---------- */
  const AC = {
    cirugia: ['Cirugía', '#1f2937'], hosp: ['Hospitalización', '#b3202a'], examen: ['Examen', '#f08a24'], control: ['Control', '#7b4fb8'], proc: ['Otro procedimiento', '#c2479b'],
    kineext: ['Kinesiología externa', '#14a3a3'], enf: ['Enfermedad', '#b08a5a'], rd: ['Reintegro deportivo (RD)', '#3b82e0'], sk: ['Kinesiología (SK)', '#2f9e5a'], no: ['No asistió', '#6b7570'], pauta: ['Pauta en casa', '#aeb7b2'], descanso: ['Descanso', '#dde2df']
  };
  const PRIO = ['cirugia', 'hosp', 'examen', 'control', 'proc', 'kineext', 'rd', 'sk', 'enf', 'no', 'pauta', 'descanso'];
  const LESION_COL = '#f6c4c8';
  function diasDe(inf, j, anio) {
    const m = {}, hoy = K.hoy();
    const mk = (iso) => (m[iso] = m[iso] || { k: new Set(), les: false, tx: [] });
    const en = (iso) => iso && iso.slice(0, 4) === String(anio);
    const poner = (iso, k, tx) => { if (!en(iso)) return; const d = mk(iso); d.k.add(k); if (tx) d.tx.push(tx); };
    inf.casos.forEach((c) => {
      if (c.jugadorId !== j.id || c.tipo !== 'lesion' || !c.inicio) return;
      const fin = c.alta || hoy;
      for (let d = c.inicio, n = 0; d <= fin && n < 800; d = suma(d, 1), n++) if (en(d)) { const x = mk(d); x.les = true; if (d === c.inicio) { x.L = true; x.tx.push('Lesión: ' + c.titulo); } }
    });
    (inf.asistencias || []).forEach((a) => {
      if (a.jugadorId !== j.id) return;
      const k = a.v === 'si' ? (a.t === 'RD' ? 'rd' : 'sk') : ({ pauta: 'pauta', descanso: 'descanso', control: 'control', examen: 'examen', procedimiento: 'proc', enfermedad: 'enf' }[a.no] || 'no');
      poner(a.fecha, k, K.kineAsisTxt(a));
    });
    inf.eventos.forEach((x) => { if (x.jugadorId === j.id && K.evRealizado(x)) { if (x.tipo === 'control') poner(x.fecha, 'control', 'Control: ' + (x.nombre || '')); if (x.tipo === 'examen') poner(x.fecha, 'examen', 'Examen: ' + (x.nombre || '')); if (x.tipo === 'cirugia') poner(x.fecha, 'cirugia', 'Cirugía: ' + (x.nombre || '')); } });
    (inf.segEventos || []).forEach((x) => {
      if (x.jugadorId !== j.id) return;
      const k = { control: 'control', examen: 'examen', procedimiento: 'proc', kinesiologia: 'kineext', cirugia: 'cirugia', hosp: 'hosp' }[x.tipo];
      const tx = (TIPO_TXT[x.tipo] || '') + (x.detalle ? ': ' + x.detalle : '') + ' (seguro)';
      if (x.tipo === 'hosp' && x.hasta && x.hasta > x.fecha) { for (let d = x.fecha, n = 0; d <= x.hasta && n < 120; d = suma(d, 1), n++) poner(d, k, tx); } else poner(x.fecha, k, tx);
    });
    return m;
  }
  K.kineAnualHTML = function () {
    const s = K.kineEstado(), js = K.kineJugadores();
    if (!js.length) return '<div class="card"><p class="vacio-msg">Agrega jugadores para ver su calendario de asistencia.</p></div>';
    const anioAct = String(new Date().getFullYear());
    if (!s.anualAnio) s.anualAnio = (K.state.periodo && K.state.periodo.anio ? String(K.state.periodo.anio) : anioAct);
    const les = K.kineLesionados();
    if (!s.anualJ || !js.some((x) => x.j.id === s.anualJ)) s.anualJ = (les[0] || js[0]).j.id;
    const sel = js.find((x) => x.j.id === s.anualJ), anio = s.anualAnio;
    const aniosOp = uniq([anioAct, String(Number(anioAct) - 1), anio]).sort().reverse();
    const mapa = diasDe(sel.inf, sel.j, anio), cuenta = {}; let diasLes = 0;
    Object.keys(mapa).forEach((iso) => { const d = mapa[iso]; if (d.les) diasLes++; const k = PRIO.find((p) => d.k.has(p)); if (k) cuenta[k] = (cuenta[k] || 0) + 1; });
    const hoy = K.hoy();
    let filas = '';
    for (let mes = 1; mes <= 12; mes++) {
      const nd = new Date(Number(anio), mes, 0).getDate();
      let celdas = '';
      for (let d = 1; d <= 31; d++) {
        if (d > nd) { celdas += '<i class="ac fuera"></i>'; continue; }
        const iso = `${anio}-${K.pad(mes)}-${K.pad(d)}`, x = mapa[iso], k = x && PRIO.find((p) => x.k.has(p));
        const fondo = x && x.L ? '#d62839' : k ? AC[k][1] : x && x.les ? LESION_COL : '';
        const tit = `${d} ${MESES[mes - 1].toLowerCase()}${x ? ': ' + (x.tx.length ? x.tx.join('; ') : x.les ? 'lesionado' : '') : ''}${x && x.les && k ? ' · lesionado' : ''}`;
        celdas += `<i class="ac${iso === hoy ? ' hoy' : ''}${k && x.les && !x.L ? ' con-les' : ''}${x && x.L ? ' dia-L' : ''}"${fondo ? ` style="background:${fondo}"` : ''} title="${e(tit)}">${x && x.L ? 'L' : ''}</i>`;
      }
      filas += `<div class="ac-fila"><span>${MESES[mes - 1].slice(0, 3)}</span>${celdas}</div>`;
    }
    const ley = PRIO.map((k) => `<span><i style="background:${AC[k][1]}"></i>${AC[k][0]}${cuenta[k] ? ` <b>${cuenta[k]}</b>` : ''}</span>`).join('') + `<span><i style="background:#d62839;color:#fff;font-size:8px;font-style:normal;text-align:center;line-height:11px">L</i>Día de la lesión</span><span><i style="background:${LESION_COL}"></i>Lesionado <b>${diasLes}</b></span>`;
    return `<div class="card"><h2>Calendario de asistencia anual</h2>
      <div class="grid2"><label class="campo"><span>Jugador</span><select data-acc-change="anualJ">${js.map((x) => `<option value="${x.j.id}"${x.j.id === s.anualJ ? ' selected' : ''}>${e(x.j.nombre)} · ${e(x.j.categoria || 'Sub ' + x.cat)}</option>`).join('')}</select></label>
        <label class="campo"><span>Año</span><select data-acc-change="anualAnio">${aniosOp.map((a) => `<option value="${a}"${a === anio ? ' selected' : ''}>${a}</option>`).join('')}</select></label></div>
      <div class="ac-grid"><div class="ac-fila ac-dias"><span></span>${Array.from({ length: 31 }, (_, i) => `<em>${i + 1}</em>`).join('')}</div>${filas}</div>
      <div class="ac-ley">${ley}</div>
      <p class="sub" style="margin:8px 0 0">Cada cuadro es un día. Un cuadro de color con borde rojo abajo = ese día estaba lesionado. Los cuadros vacíos son días sin registro (no se entrena). Toca o mantén sobre un cuadro para ver el detalle.</p></div>`;
  };

  Object.assign(K.acciones, {
    segNuevo() { formIngreso(''); },
    segToggle(el, ev) { if (ev && ev.target.closest('[data-acc=segEditar]')) return; const st = ss(); st.segAbierto = st.segAbierto || {}; st.segAbierto[el.dataset.sid] = !st.segAbierto[el.dataset.sid]; K.render(); },
    segEditar(el, ev) { if (ev) ev.stopPropagation(); formIngreso(el.dataset.sid); },
    segEvento(el) { formEvento(el.dataset.sid); },
    segEvEditar(el) { const r = todos('segEventos').find((q) => q.x.id === el.dataset.id); if (r) formEvento(el.dataset.sid, r.x); },
    segAnio(el) { ss().segAnio = el.value; K.render(); },
    anualJ(el) { K.kineEstado().anualJ = el.value; K.render(); },
    anualAnio(el) { K.kineEstado().anualAnio = el.value; K.render(); }
  });
})();

/* Pestaña Kine: seguimiento diario de lesionados (todas las categorías), calendario de fechas importantes,
   informe semanal, y —en seguro.js— ingreso al seguro, estadísticas y calendario anual de asistencia. */
(function () {
  const K = window.K;
  const e = K.esc;

  /* ---------- Fechas ---------- */
  const D = (iso) => new Date(iso + 'T12:00:00');
  const dif = (a, b) => Math.round((D(b) - D(a)) / 864e5);
  const suma = (iso, n) => { const d = D(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const lunesDe = (iso) => suma(iso, -((D(iso).getDay() + 6) % 7));
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const DIAS_SEM = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const fc = (iso) => K.fechaCorta(iso);
  K.kineFechas = { D, dif, suma, lunesDe, MESES, DIAS_SEM };

  /* ---------- Estado de pantalla ---------- */
  const ks = () => {
    const h = K.hoy();
    const s = (K.ui.kine = K.ui.kine || {});
    if (!s.sec) s.sec = 'seg';
    if (!s.cal) s.cal = 'todo'; // 'todo' = histórico · 'prox' = solo desde hoy en adelante
    if (!s.fecha) s.fecha = h;
    if (!s.mes) s.mes = h.slice(0, 7);
    if (!s.semana) s.semana = h;
    return s;
  };
  K.kineEstado = ks;

  /* ---------- Datos de todas las categorías ---------- */
  K.kineInfs = () => {
    const vistos = new Set(), out = [];
    K.GRUPOS.forEach((g) => { const i = K.buscarInformeGrupo(g); if (i && !vistos.has(i.id)) { vistos.add(i.id); out.push(i); } });
    return out.length ? out : K.state.informes.slice();
  };
  const catDe = (j, inf) => {
    const n = K.catNum(j); if (n) return n;
    const g = K.GRUPOS.find((x) => x.id === inf.grupo) || K.GRUPOS.find((x) => K.buscarInformeGrupo(x) === inf) || K.GRUPOS[0];
    return g.cats[0];
  };
  K.kineCatDe = catDe;
  // Categoría que tenía el jugador en una fecha (el informe semanal de una semana pasada muestra la de esa semana, no la de hoy).
  K.kineCatEn = (j, inf, fecha) => (K.tieneHistorial(j) ? K.catEn(j, fecha) : null) || catDe(j, inf);
  K.kineJugadores = (conArchivados) => {
    const out = [];
    K.kineInfs().forEach((inf) => (conArchivados ? inf.jugadores : K.vivos(inf)).forEach((j) => out.push({ inf, j, cat: catDe(j, inf) })));
    out.sort((a, b) => b.cat - a.cat || a.j.nombre.localeCompare(b.j.nombre, 'es'));
    return out;
  };
  K.kineBuscarJ = (jid) => { for (const inf of K.kineInfs()) { const j = K.jugador(inf, jid); if (j) return { inf, j, cat: catDe(j, inf) }; } return null; };
  // Sin fecha: todos los que siguen sin alta. Con fecha: los lesionados ese día (lesión iniciada hasta ese día y sin alta antes de él).
  K.kineLesionados = (fecha) => {
    const out = [];
    K.kineInfs().forEach((inf) => inf.casos.forEach((c) => {
      if (c.tipo !== 'lesion') return;
      if (fecha ? ((c.inicio || '') > fecha || (c.alta && c.alta < fecha)) : c.alta) return;
      const j = K.jugador(inf, c.jugadorId); if (!j || j.activo === false || !K.inscrito(j)) return;
      out.push({ inf, c, j, cat: catDe(j, inf) });
    }));
    out.sort((a, b) => b.cat - a.cat || a.j.nombre.localeCompare(b.j.nombre, 'es') || (a.c.inicio || '').localeCompare(b.c.inicio || ''));
    return out;
  };
  const item = (casoId) => K.kineLesionados().find((x) => x.c.id === casoId) || (() => {
    for (const inf of K.kineInfs()) { const c = inf.casos.find((x) => x.id === casoId); if (c) { const j = K.jugador(inf, c.jugadorId); return { inf, c, j, cat: j ? catDe(j, inf) : 0 }; } }
    return null;
  })();

  // Ejecuta una acción (abrir un formulario) dentro del informe al que pertenece el jugador y, al cerrar la ventana, deja todo como estaba.
  K.enInforme = function (inf, j, fn) {
    const prev = { activo: K.state.activo, cat: K.ui.cat, alc: K.ui.alcance };
    K.state.activo = inf.id; K.ui.cat = catDe(j, inf); K.ui.alcance = 'comb';
    K._modalAlCerrar = () => { K.state.activo = prev.activo; K.ui.cat = prev.cat; K.ui.alcance = prev.alc; };
    try { fn(); } finally {
      if (K._modalAlCerrar) { const r = K._modalAlCerrar; K._modalAlCerrar = null; r(); } // no se abrió ventana: restaurar de inmediato
    }
  };

  /* ---------- Estados ---------- */
  const ESTADOS = [['rehab', 'En rehabilitación'], ['reintegro', 'En reintegro deportivo'], ['espera', 'En espera']];
  const ESTADO_COL = { rehab: '#2f7a4a', reintegro: '#3b5bb5', espera: '#c98f00' };
  const estadoTxt = (c) => (ESTADOS.find((x) => x[0] === (c.estado || 'rehab')) || ESTADOS[0])[1];
  K.kineEstadoTxt = estadoTxt;
  // Inicio del reintegro deportivo de una lesión = la fecha en que pasó al estado “En reintegro deportivo” (c.reintegroDesde, editable en la ficha del lesionado).
  // Datos antiguos que ya estaban en ese estado sin fecha: se usa la primera sesión de reintegro (RD) anotada desde la lesión. Si no hay nada, no hay marca.
  K.inicioReintegro = (inf, c) => {
    if (!c) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(c.reintegroDesde || '')) return c.reintegroDesde;
    if (c.estado !== 'reintegro') return '';
    const f = (inf.asistencias || []).filter((a) => a.jugadorId === c.jugadorId && a.v === 'si' && a.t === 'RD' && a.fecha && (!c.inicio || a.fecha >= c.inicio) && (!c.alta || a.fecha <= c.alta)).map((a) => a.fecha).sort()[0];
    return f || '';
  };
  K.kineItem = (casoId) => item(casoId);
  const diasBaja = (c) => (c.inicio ? Math.max(1, dif(c.inicio, K.hoy())) : 0);
  const semaforo = (p) => (p == null ? '' : p < 80 ? 'rojo' : p < 90 ? 'amarillo' : 'verde');
  K.kineSemaforo = semaforo;
  const avatar = (j) => `<span class="avatar">${j.foto ? `<img src="${j.foto}" alt="">` : e((j.nombre || '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase())}</span>`;

  // Estado actual de un jugador (para su ficha real).
  K.kineEstadoJugador = (inf, j) => inf.casos.filter((c) => c.jugadorId === j.id && c.tipo === 'lesion' && !c.alta)
    .map((c) => ({ titulo: c.titulo, estado: estadoTxt(c), nota: c.estadoNota || '', desde: c.inicio }));
  K.kineEstadoHTML = (inf, j) => {
    const l = K.kineEstadoJugador(inf, j); if (!l.length) return '';
    return `<div class="card kine-est"><h2>Estado actual (Kine)</h2>${l.map((x) => `<p><b>${e(x.titulo)}</b> · ${e(x.estado)}${x.desde ? ' · desde ' + e(fc(x.desde)) : ''}${x.nota ? `<br><span class="suave">${e(x.nota)}</span>` : ''}</p>`).join('')}</div>`;
  };

  /* ---------- Asistencia diaria ---------- */
  const asisDia = (inf, jid, fecha) => (inf.asistencias || []).find((a) => a.jugadorId === jid && a.fecha === fecha);
  K.kineAsisDia = asisDia;
  const RD_OPC = [['K', 'K'], ['KPF', 'K+PF'], ['KPA', 'K+PA']];
  const selAsis = (it, a, fecha) => {
    const id = `data-caso="${it.c.id}"${fecha ? ` data-fecha="${fecha}"` : ''}`;
    if (!a) return '<span class="suave kf-no">No se entrena</span>';
    if (a.v === 'si') {
      return `<select ${id} data-f="t" data-acc-change="kineAsisSel" aria-label="Tipo de sesión"><option value="">Tipo…</option>${K.opts([['SK', 'SK'], ['RD', 'RD']], a.t || '')}</select>` +
        (a.t === 'RD' ? `<select ${id} data-f="sub" data-acc-change="kineAsisSel" aria-label="RD">${K.opts(RD_OPC, a.sub || 'K')}</select>` : '');
    }
    if (a.no === 'pauta') return '<span class="suave kf-no">Pauta para hacer en casa</span>';
    return `<select ${id} data-f="no" data-acc-change="kineAsisSel" aria-label="Motivo"><option value="">Motivo…</option>${K.opts(K.MOTIVOS_NO, a.no || '')}</select>`;
  };
  K.kineSelAsis = selAsis;
  K.kineAsisTxt = (a) => {
    if (!a) return '';
    if (a.v === 'si') return a.t === 'RD' ? 'RD' + (a.sub === 'KPF' ? ' · K+PF' : a.sub === 'KPA' ? ' · K+PA' : ' · K') : a.t === 'SK' ? 'SK' : 'Asistió';
    return K.MOTIVOS_NO_CORTO[a.no] || 'No asistió';
  };

  /* ---------- Fila de lesionado (compacta, ≈72 px: jugador, zona, día N, próximo control y asistencia en un toque) ---------- */
  // Próximo control de un lesionado: el más cercano desde hoy; si el que anotó ya pasó y no se registró un control desde entonces, está vencido.
  K.kineProxControl = function (it) {
    const hoy = K.hoy(), c = it.c, fut = [];
    if (c.proxControl && c.proxControl >= hoy) fut.push(c.proxControl);
    it.inf.eventos.forEach((v) => { if (v.jugadorId === it.j.id && v.tipo === 'control' && v.fecha && v.fecha >= hoy) fut.push(v.fecha); });
    fut.sort();
    if (fut[0]) return { f: fut[0], vencido: false };
    if (c.proxControl && c.proxControl < hoy && !it.inf.eventos.some((v) => v.jugadorId === it.j.id && v.tipo === 'control' && v.fecha && v.fecha >= c.proxControl && v.fecha <= hoy)) return { f: c.proxControl, vencido: true };
    return null;
  };
  const cuandoTxt = (f) => { const d = dif(K.hoy(), f); return d === 0 ? 'hoy' : d === 1 ? 'mañana' : d > 0 ? `en ${d} días` : d === -1 ? 'ayer' : `hace ${-d} días`; };
  const zonasTxt = (c) => (c.zonas || []).map((z) => (K.nombreZonaLimpia ? K.nombreZonaLimpia(z) : K.nombreZona(z))).filter(Boolean).join(', ');
  function filaKine(it) {
    const { inf, c, j } = it, f = ks().fecha, a = asisDia(inf, j.id, f), px = K.kineProxControl(it), zn = zonasTxt(c);
    const dia = c.inicio ? Math.max(1, dif(c.inicio, f)) : 0;
    const titulo = c.titulo || 'Lesión';
    const l2 = zn && !K.norm(titulo).includes(K.norm(zn)) ? `${titulo} · ${zn}` : titulo;
    return `<div class="kfila kf-compacta${px && px.vencido ? ' venc' : ''}" data-caso="${c.id}">
      <div class="kf-top" data-acc="kineFicha" data-caso="${c.id}" role="button" tabindex="0" aria-label="Abrir la ficha de ${e(j.nombre)}">
        <div class="txt"><b>${e(j.nombre)}</b><span class="kf-l2">${e(l2)}</span><span class="kf-l3">Día ${dia}${px ? ` · <i class="kf-ctl${px.vencido ? ' venc' : ''}">Control ${e(fc(px.f))}${px.vencido ? ' vencido' : ' (' + cuandoTxt(px.f) + ')'}</i>` : ''}</span></div></div>
      <div class="kf-asis">${c.inicio === f
        ? `<span class="as-L" title="Día de la lesión" aria-label="Día de la lesión">L</span>`
        : `<div class="kf-btns"><button type="button" class="as-btn si${a && a.v === 'si' ? ' on' : ''}" data-acc="kineAsis" data-caso="${c.id}" data-v="si" aria-label="Asistió: ${e(j.nombre)}" aria-pressed="${!!(a && a.v === 'si')}" title="Asistió">${K.uiIco('ok', 22)}</button><button type="button" class="as-btn no${a && a.v === 'no' && a.no !== 'pauta' ? ' on' : ''}" data-acc="kineAsis" data-caso="${c.id}" data-v="no" aria-label="No asistió: ${e(j.nombre)}" aria-pressed="${!!(a && a.v === 'no' && a.no !== 'pauta')}" title="No asistió">${K.uiIco('cerrar', 22)}</button><button type="button" class="as-btn pauta${a && a.v === 'no' && a.no === 'pauta' ? ' on' : ''}" data-acc="kineAsis" data-caso="${c.id}" data-v="pauta" aria-label="Pauta en casa: ${e(j.nombre)}" aria-pressed="${!!(a && a.v === 'no' && a.no === 'pauta')}" title="Pauta en casa">${K.uiIco('casa', 22)}</button></div>`}
      </div>
      ${c.inicio !== f && a ? `<div class="kf-sel">${selAsis(it, a)}</div>` : ''}
    </div>`;
  }

  /* ---------- Calendario de fechas importantes ---------- */
  const IDEAS_PROC = ['Ondas de choque', 'Láser terapéutico', 'Diatermia / tecarterapia', 'Infiltración', 'Retiro de puntos', 'Curación de heridas'];
  const IDEAS_PROC_ANTES = ['Ondas de choque', 'Punción seca', 'Electroestimulación (TENS / EMS)', 'Ultrasonido terapéutico', 'Láser terapéutico', 'Diatermia / tecarterapia', 'Infiltración (PRP, ácido hialurónico u otra)', 'Terapia manual', 'Masoterapia', 'Ventosas', 'Vendaje funcional / kinesiotape', 'Crioterapia / baños de contraste', 'Presoterapia', 'Hidroterapia / piscina', 'Entrenamiento con restricción de flujo (BFR)', 'Evaluación isocinética', 'Test funcional / de saltos', 'Retiro de puntos', 'Curación de herida', 'Evaluación en cancha'];
  K.IDEAS_PROC = IDEAS_PROC;
  function fechasImportantes(les) {
    const out = [], hoy = K.hoy();
    // Día de la lesión (todas las lesiones con fecha de inicio)
    K.kineInfs().forEach((inf) => inf.casos.forEach((c) => {
      if (c.tipo !== 'lesion' || !c.inicio) return;
      const j = K.jugador(inf, c.jugadorId); if (!j || j.activo === false || !K.inscrito(j)) return;
      const it0 = { inf, c, j, cat: catDe(j, inf) };
      out.push({ f: c.inicio, t: 'lesion', txt: 'Lesión · ' + c.titulo, it: it0 });
      const rd = K.inicioReintegro(inf, c);
      if (rd) out.push({ f: rd, t: 'reint', txt: 'Inicio del reintegro deportivo · ' + c.titulo, it: it0 });
      if (c.alta) out.push({ f: c.alta, t: 'alta', txt: 'Alta · ' + c.titulo, it: it0 });
      if (c.altaMedica && c.altaMedica !== c.alta) out.push({ f: c.altaMedica, t: 'alta', txt: 'Alta médica · ' + c.titulo, it: it0 });
    }));
    les.forEach((it) => {
      if (it.c.proxControl) out.push({ f: it.c.proxControl, t: 'control', txt: 'Control médico', it });
      if (it.c.proxExamen) out.push({ f: it.c.proxExamen, t: 'examen', txt: 'Examen' + (it.c.proxExamenTipo ? ' · ' + it.c.proxExamenTipo : ''), it });
      if (it.c.proxProc) out.push({ f: it.c.proxProc, t: 'proc', txt: 'Procedimiento' + (it.c.proxProcTipo ? ' · ' + it.c.proxProcTipo : ''), it });
      if (it.c.proxHito) out.push({ f: it.c.proxHito, t: 'hito', txt: it.c.proxHitoTxt || 'Hito', it });
    });
    // Controles, exámenes y cirugías ya registrados con fecha futura (no han ocurrido): aparecen aunque el jugador no tenga lesión.
    K.kineInfs().forEach((inf) => inf.eventos.forEach((ev) => {
      if (!['control', 'examen', 'cirugia'].includes(ev.tipo) || K.evRealizado(ev)) return;
      const j = K.jugador(inf, ev.jugadorId); if (!j || j.activo === false || !K.inscrito(j)) return;
      const t = ev.tipo === 'control' ? 'Control médico' : ev.tipo === 'examen' ? 'Examen' : 'Cirugía';
      out.push({ f: ev.fecha, t: ev.tipo === 'cirugia' ? 'cirugia' : ev.tipo, txt: t + (ev.nombre ? ' · ' + ev.nombre : ''), it: { inf, c: null, ev, j, cat: catDe(j, inf) } });
    }));
    // Controles, exámenes y cirugías ya realizados (para ver el histórico).
    K.kineInfs().forEach((inf) => inf.eventos.forEach((ev) => {
      if (!['control', 'examen', 'cirugia'].includes(ev.tipo) || !K.evRealizado(ev) || !ev.fecha) return;
      const j = K.jugador(inf, ev.jugadorId); if (!j || j.activo === false || !K.inscrito(j)) return;
      const t = ev.tipo === 'control' ? 'Control médico' : ev.tipo === 'examen' ? 'Examen' : 'Cirugía';
      out.push({ f: ev.fecha, t: ev.tipo === 'cirugia' ? 'cirugia' : ev.tipo, txt: t + (ev.nombre ? ' · ' + ev.nombre : '') + (ev.tipo === 'examen' && ev.resultado ? ' — ' + ev.resultado : '') + ' (realizado)', it: { inf, c: null, ev, j, cat: catDe(j, inf) } });
    }));
    const vistos = new Set();
    const soloProx = ks().cal === 'prox';
    const unicos = out.filter((x) => (!soloProx || x.f >= hoy)).filter((x) => { const k = [x.f, x.t, x.it.j.id, x.txt].join('|'); if (vistos.has(k)) return false; vistos.add(k); return true; });
    unicos.sort((a, b) => a.f.localeCompare(b.f) || b.it.cat - a.it.cat);
    return unicos;
  }
  K.kineFechasImportantes = fechasImportantes;
  function calendarioKine(les) {
    const s = ks(), [y, m] = s.mes.split('-').map(Number), hoy = K.hoy();
    const ev = fechasImportantes(les), por = {};
    ev.forEach((x) => { (por[x.f] = por[x.f] || []).push(x); });
    const off = (new Date(y, m - 1, 1).getDay() + 6) % 7, nd = new Date(y, m, 0).getDate();
    let celdas = '';
    for (let i = 0; i < off; i++) celdas += '<span class="kc vacia"></span>';
    for (let d = 1; d <= nd; d++) {
      const iso = `${y}-${K.pad(m)}-${K.pad(d)}`, xs = por[iso] || [];
      const hay = (t) => xs.some((x) => x.t === t);
      const letras = ['lesion', 'reint', 'alta'].filter(hay), pos = (t) => { const k = letras.indexOf(t); return k > 0 ? ` style="right:${2 + 15 * k}px"` : ''; };
      celdas += `<button type="button" class="kc${iso === hoy ? ' hoy' : ''}${xs.length ? ' tiene' : ''}${s.dia === iso ? ' sel' : ''}" data-acc="kineDia" data-f="${iso}" aria-label="${d} de ${MESES[m - 1]}">${d}${hay('lesion') ? '<b class="kc-L">L</b>' : ''}${hay('reint') ? `<b class="kc-R" title="Inicio del reintegro deportivo"${pos('reint')}>R</b>` : ''}${hay('alta') ? `<b class="kc-A" title="Alta"${pos('alta')}>A</b>` : ''}<i>${hay('control') ? '<u class="c"></u>' : ''}${hay('examen') ? '<u class="x"></u>' : ''}${hay('proc') ? '<u class="p"></u>' : ''}${hay('hito') ? '<u class="h"></u>' : ''}${hay('cirugia') ? '<u class="q"></u>' : ''}</i></button>`;
    }
    const lista = s.dia ? ev.filter((x) => x.f === s.dia) : ev.filter((x) => s.cal === 'prox' ? x.f >= hoy : x.f >= suma(hoy, -14)).slice(0, 14);
    const filas = lista.map((x) => {
      const dd = dif(hoy, x.f), cuando = dd === 0 ? 'hoy' : dd > 0 ? `en ${dd} día${dd === 1 ? '' : 's'}` : `hace ${-dd} día${dd === -1 ? '' : 's'}`;
      const clic = x.it.c ? `data-acc="kineFicha" data-caso="${x.it.c.id}"` : `data-acc="kineEv" data-ev="${x.it.ev.id}"`;
      return `<div class="kc-it${dd < 0 ? ' pasado' : ''}" ${clic}>${x.t === 'lesion' ? '<span class="kc-pto L">L</span>' : x.t === 'reint' ? '<span class="kc-pto R">R</span>' : x.t === 'alta' ? '<span class="kc-pto A">A</span>' : `<span class="kc-pto ${({ control: 'c', examen: 'x', proc: 'p', cirugia: 'q', hito: 'h' })[x.t]}"></span>`}<div class="txt"><b>${e(x.it.j.nombre)} <small>Sub ${x.it.cat}</small></b><span>${e(x.txt)} · ${e(fc(x.f))} (${cuando})</span></div></div>`;
    }).join('');
    return `<div class="fila sb wrap gap"><b class="kc-tit">Calendario del mes</b>
        <div class="fila gap"><button class="btn ghost chico" data-acc="kineMes" data-d="-1" aria-label="Mes anterior">${K.uiIco('atras', 18)}</button><b class="kc-mes">${MESES[m - 1]} ${y}</b><button class="btn ghost chico" data-acc="kineMes" data-d="1" aria-label="Mes siguiente" style="transform:scaleX(-1)">${K.uiIco('atras', 18)}</button></div></div>
      <div class="kc-modo"><button type="button" class="kc-switch${s.cal === 'prox' ? ' on' : ''}" role="switch" aria-label="Mostrar solo las próximas fechas" aria-checked="${s.cal === 'prox'}" data-acc="kineCalModo"><i></i></button><span>${s.cal === 'prox' ? '<b>Solo próximas fechas</b> (desde hoy en adelante)' : '<b>Todo el histórico</b> (incluye lo ya ocurrido)'}</span></div>
      <div class="kc-grid">${DIAS_SEM.map((d) => `<em>${d}</em>`).join('')}${celdas}</div>
      <div class="kc-ley"><span><u class="c"></u>Próximo control</span><span><u class="x"></u>Próximo examen</span><span><u class="p"></u>Próximo procedimiento</span><span><u class="q"></u>Cirugía</span><span><b class="kc-L inl">L</b>Día de lesión</span><span><b class="kc-R inl">R</b>Inicio del reintegro deportivo</span><span><b class="kc-A inl">A</b>Alta</span></div>
      <h3 class="kc-sub">${s.dia ? 'Fechas del ' + e(fc(s.dia)) + ' <a href="#" data-acc="kineDia" data-f="">ver todas</a>' : s.cal === 'prox' ? 'Próximas fechas' : 'Fechas recientes y próximas'}</h3>
      ${filas || `<p class="vacio-msg" style="padding:10px">${s.dia ? 'No hay fechas ese día.' : s.cal === 'prox' ? 'Sin fechas próximas por ahora.' : 'Sin fechas por ahora. Se agregan desde la ficha de cada lesionado (toca su nombre) o al registrar un control, examen o cirugía con fecha futura.'}</p>`}`;
  }
  // El calendario va plegado (lo diario es la lista de lesionados); se abre con un toque y se acuerda si quedó abierto.
  function calendarioPlegable(les) {
    const s = ks(), hoy = K.hoy(), prox = fechasImportantes(les).filter((x) => x.f >= hoy).length;
    return `<details class="card kc-det" data-kc-det${s.calAbierto ? ' open' : ''}><summary><span><b>Fechas importantes</b> <small class="suave">${prox ? prox + ' próxima' + (prox === 1 ? '' : 's') : 'sin próximas'}</small></span></summary>${calendarioKine(les)}</details>`;
  }

  /* ---------- Seguimiento (lista + calendario) ---------- */
  function pSeguimiento() {
    const s = ks(), hoy = K.hoy(), les = K.kineLesionados(s.fecha), todos = K.kineLesionados(), ed = K.puedeEditar();
    const marcados = les.filter((it) => it.c.inicio !== s.fecha).map((it) => asisDia(it.inf, it.j.id, s.fecha)).filter(Boolean);
    const nSi = marcados.filter((a) => a.v === 'si').length, nPa = marcados.filter((a) => a.v === 'no' && a.no === 'pauta').length, nNo = marcados.filter((a) => a.v === 'no' && a.no !== 'pauta').length, nL = les.filter((it) => it.c.inicio === s.fecha).length;
    const sinMarcar = les.length - nSi - nNo - nPa - nL;
    // controles vencidos (hoy, sin importar el día que se esté mirando)
    const venc = todos.map((it) => ({ it, px: K.kineProxControl(it) })).filter((x) => x.px && x.px.vencido).sort((a, b) => a.px.f.localeCompare(b.px.f) || a.it.j.nombre.localeCompare(b.it.j.nombre, 'es'));
    const alerta = venc.length ? `<div class="aviso aviso-venc" data-venc role="alert"><b>${venc.length === 1 ? '1 control vencido' : venc.length + ' controles vencidos'}</b> <span class="suave">(la fecha ya pasó y no hay un control registrado desde entonces)</span>
        <div class="venc-chips">${venc.slice(0, 8).map((x) => `<button type="button" class="th-chip venc-chip" data-acc="kineFicha" data-caso="${x.it.c.id}">${e(x.it.j.nombre)} · ${e(fc(x.px.f))}</button>`).join('')}${venc.length > 8 ? `<span class="suave">y ${venc.length - 8} más</span>` : ''}</div></div>` : '';
    let cat = null, filas = '';
    les.forEach((it) => {
      if (it.cat !== cat) { cat = it.cat; filas += `<h3 class="kf-cat">Sub ${cat}</h3>`; }
      filas += filaKine(it);
    });
    return `${alerta}
      <div class="card" data-kine-les><div class="fila sb wrap gap"><h2 style="margin:0">Lesionados <span class="suave" style="font-weight:400">(${les.length})</span></h2>
        <div class="fila gap kf-dia"><button class="btn ghost chico" data-acc="kineFechaMas" data-d="-1" aria-label="Día anterior">${K.uiIco('atras', 18)}</button>
          <input type="date" value="${e(s.fecha)}" data-acc-change="kineFecha" aria-label="Día de asistencia">
          <button class="btn ghost chico" data-acc="kineFechaMas" data-d="1" aria-label="Día siguiente" style="transform:scaleX(-1)">${K.uiIco('atras', 18)}</button>
          ${s.fecha !== hoy ? '<button class="btn sec chico" data-acc="kineFechaMas" data-d="0">Hoy</button>' : ''}</div></div>
        ${les.length && ed ? `<div class="fila sb wrap gap kf-todos"><button type="button" class="btn" data-acc="kineTodosAsisten"${sinMarcar > 0 ? '' : ' disabled'}>${K.uiIco('ok', 18)} Todos asistieron${sinMarcar > 0 ? ` (${sinMarcar})` : ''}</button><span class="suave" data-kf-res>${e(fc(s.fecha))} · ${nSi} asistieron · ${nNo} no · ${nPa} pauta en casa · ${sinMarcar} sin marcar</span></div>` : ''}
        <details class="kf-ayuda"><summary>¿Qué significan los íconos?</summary><p class="sub" style="margin-top:6px">${nL ? `${nL} con <b class="as-Lt">L</b> (día de la lesión). ` : ''}✓ asistió · ✗ no asistió · <i class="as-casa">🏠</i> pauta en casa · <b class="as-Lt">L</b> día de la lesión. <b>SK</b> sesión de kinesiología, <b>RD</b> reintegro deportivo (<b>K</b> kine, <b>K+PF</b> kine + preparación física o <b>K+PA</b> kine + preparador de arqueros). Un toque marca; tocar de nuevo lo quita. “Todos asistieron” marca solo a quienes aún no tienen marca ese día.</p></details>
        ${les.length ? filas : '<p class="vacio-msg">No hay lesionados. Cuando registres una lesión (Registrar → Registrar lesión) aparecerá aquí hasta que le des el alta.</p>'}</div>
      ${calendarioPlegable(todos)}`;
  }

  /* ---------- Informe semanal ---------- */
  /* Categorías del informe semanal: una sola, de a 2 (Sub 15-16 o Sub 18-20) o todas. Por defecto todas (como siempre). */
  const CATS_TODAS = () => [].concat(...K.GRUPOS.map((g) => g.cats));
  const semCats = () => { const s = ks(), t = CATS_TODAS(), v = Array.isArray(s.semCats) ? t.filter((c) => s.semCats.includes(c)) : []; return v.length ? v : t; };
  const claveCats = (cats) => cats.slice().sort((a, b) => a - b).join('-');
  const catsTxt = (cats) => { const n = cats.slice().sort((a, b) => a - b).map((c) => 'Sub ' + c); return n.length > 1 ? n.slice(0, -1).join(', ') + ' y ' + n[n.length - 1] : n[0] || ''; };
  const OPC_CATS = [['15-16-18-20', 'Todas las categorías (Sub 15 a Sub 20)'], ['15-16', 'Sub 15 y Sub 16'], ['18-20', 'Sub 18 y Sub 20'], ['20', 'Solo Sub 20'], ['18', 'Solo Sub 18'], ['16', 'Solo Sub 16'], ['15', 'Solo Sub 15']];
  K.kineSemCats = semCats;
  function datosSemana() {
    const s = ks(), lun = lunesDe(s.semana), dom = suma(lun, 6), per = { desde: lun, hasta: dom }, cats = semCats();
    const filas = [];
    K.kineInfs().forEach((inf) => inf.casos.forEach((c) => {
      if (c.tipo !== 'lesion' || !c.inicio || c.inicio > dom) return;
      if (c.alta && c.alta < lun) return;
      const j = K.jugador(inf, c.jugadorId); if (!j || j.activo === false || !K.estaEn(j, lun, dom)) return; // el informe de una semana incluye a quienes estaban inscritos esa semana
      const fin = c.alta && c.alta < dom ? c.alta : (dom < K.hoy() ? dom : K.hoy());
      const sem = K.asistenciaKine(inf, j.id, per), acum = K.asistenciaKine(inf, j.id, { desde: c.inicio, hasta: '2100-01-01' });
      const cat = K.kineCatEn(j, inf, dom); if (!cats.includes(cat)) return; // solo las categorías elegidas
      filas.push({ inf, c, j, cat, dias: Math.max(1, dif(c.inicio, fin < c.inicio ? c.inicio : fin)), sem, acum });
    }));
    filas.sort((a, b) => b.cat - a.cat || a.j.nombre.localeCompare(b.j.nombre, 'es'));
    return { lun, dom, filas, cats };
  }
  const pctHTML = (x) => (x.acum.pct == null ? '<span class="suave">—</span>' : `<b class="pct ${semaforo(x.acum.pct)}">${x.acum.pct}%</b>`) + `<small>${x.sem.pct == null ? 'sin sesiones esta semana' : 'esta semana ' + x.sem.pct + '%'}${x.sem.enf ? ` · ${x.sem.enf} ${x.sem.enf === 1 ? 'día' : 'días'} por enfermedad` : ''}</small>`;
  // Comentarios de la semana: por lesionado (en la lesión) y general (en el primer informe).
  const infGen = () => K.informeGrupo(K.GRUPOS[0]);
  const comGeneral = (lun) => ((infGen().semGeneral || {})[lun]) || '';
  const comCaso = (c, lun) => ((c.semCom || {})[lun]) || '';
  // Próximos controles y exámenes: desde el lunes de la semana hasta 14 días después del domingo.
  function proximos(d) {
    const out = [], hasta = suma(d.dom, 14);
    K.kineLesionados().filter((it) => !d.cats || d.cats.includes(it.cat)).forEach((it) => {
      if (it.c.proxControl && it.c.proxControl >= d.lun && it.c.proxControl <= hasta) out.push({ f: it.c.proxControl, t: 'Control médico', it });
      if (it.c.proxExamen && it.c.proxExamen >= d.lun && it.c.proxExamen <= hasta) out.push({ f: it.c.proxExamen, t: 'Examen' + (it.c.proxExamenTipo ? ' · ' + it.c.proxExamenTipo : ''), it });
      if (it.c.proxProc && it.c.proxProc >= d.lun && it.c.proxProc <= hasta) out.push({ f: it.c.proxProc, t: 'Procedimiento' + (it.c.proxProcTipo ? ' · ' + it.c.proxProcTipo : ''), it });
      if (it.c.proxHito && it.c.proxHito >= d.lun && it.c.proxHito <= hasta) out.push({ f: it.c.proxHito, t: it.c.proxHitoTxt || 'Hito', it });
    });
    // Controles, exámenes y cirugías futuros registrados aparte (incluye jugadores sin lesión).
    fechasImportantes([]).forEach((x) => { if (!x.it.c && x.f >= d.lun && x.f <= hasta && (!d.cats || d.cats.includes(x.it.cat))) out.push({ f: x.f, t: x.txt, it: x.it }); });
    return out.sort((a, b) => a.f.localeCompare(b.f));
  }
  // Próximo hito de un lesionado: lo más cercano (desde hoy) entre control, examen, procedimiento, otro hito y eventos futuros registrados.
  function proximoHito(it) {
    const hoy = K.hoy(), c = it.c, ops = [];
    if (c.proxControl) ops.push([c.proxControl, 'Control médico']);
    if (c.proxExamen) ops.push([c.proxExamen, 'Examen' + (c.proxExamenTipo ? ' · ' + c.proxExamenTipo : '')]);
    if (c.proxProc) ops.push([c.proxProc, 'Procedimiento' + (c.proxProcTipo ? ' · ' + c.proxProcTipo : '')]);
    if (c.proxHito) ops.push([c.proxHito, c.proxHitoTxt || 'Hito']);
    it.inf.eventos.forEach((ev) => { if (ev.jugadorId === it.j.id && ev.fecha && ['control', 'examen', 'cirugia'].includes(ev.tipo) && !K.evRealizado(ev)) ops.push([ev.fecha, (ev.tipo === 'control' ? 'Control médico' : ev.tipo === 'examen' ? 'Examen' : 'Cirugía') + (ev.nombre ? ' · ' + ev.nombre : '')]); });
    const fut = ops.filter((o) => o[0] >= hoy).sort((a, b) => a[0].localeCompare(b[0]));
    return fut[0] || null;
  }
  function tablaSemanal(d, editable) {
    let cat = null, cuerpo = '';
    d.filas.forEach((x) => {
      if (x.cat !== cat) { cat = x.cat; cuerpo += `<tr class="gr"><td colspan="8">Sub ${cat}</td></tr>`; }
      const c = x.c, sem = comCaso(c, d.lun);
      const celdaSem = editable
        ? `<textarea rows="2" data-acc-change="semComCaso" data-caso="${c.id}" placeholder="Comentario de esta semana…" aria-label="Comentario de la semana de ${e(x.j.nombre)}">${e(sem)}</textarea>`
        : (sem ? e(sem).replace(/\n/g, '<br>') : '—');
      cuerpo += `<tr><td data-l="Categoría">Sub ${x.cat}</td><td data-l="Jugador"><b>${e(x.j.nombre)}</b></td><td data-l="Diagnóstico y fecha de lesión">${e(c.titulo)}${e(K.ladoCaso ? (K.ladoCaso(c) && !/derech|izquierd/i.test(c.titulo) ? ' · ' + K.ladoCaso(c) : '') : '')}<small>${e(fc(c.inicio))}${c.alta ? ' · alta ' + e(fc(c.alta)) : ''}</small></td><td class="n" data-l="Días de baja">${x.dias}</td><td class="n" data-l="% asistencia a kinesiología">${pctHTML(x)}</td><td data-l="Estado">${c.alta ? '<b>Alta</b>' : `<b>${e(estadoTxt(c))}</b>`}${c.estadoNota ? '<br>' + e(c.estadoNota) : ''}${c.proxControl ? `<small>Próx. control ${e(fc(c.proxControl))}</small>` : ''}${c.proxExamen ? `<small>Próx. examen ${e(fc(c.proxExamen))}</small>` : ''}</td><td data-l="Próximo hito">${(() => { const h = proximoHito(x); return h ? `<b>${e(h[1])}</b><small>${e(fc(h[0]))}</small>` : '<span class="suave">—</span>'; })()}</td><td data-l="Comentarios de la semana">${celdaSem}</td></tr>`;
    });
    return `<table class="kt"><thead><tr><th>Categoría</th><th>Jugador</th><th>Diagnóstico y fecha de lesión</th><th>Días de baja</th><th>% asistencia a kinesiología</th><th>Estado</th><th>Próximo hito</th><th>Comentarios de la semana</th></tr></thead><tbody>${cuerpo}</tbody></table>`;
  }
  const proximosHTML = (d) => {
    const p = proximos(d);
    return p.length ? `<ul class="vin">${p.map((x) => `<li><b>${e(fc(x.f))}</b> · ${e(x.t)} · ${e(x.it.j.nombre)} <span class="suave">(Sub ${x.it.cat})</span></li>`).join('')}</ul>` : '<p class="suave">Sin controles, exámenes ni procedimientos agendados para estas fechas.</p>';
  };
  const sinLesionados = (d) => (d.cats.length < CATS_TODAS().length ? `No hubo lesionados de ${e(catsTxt(d.cats))} en esta semana.` : 'No hubo lesionados en esta semana.');
  // Qué categorías incluir: lista con las opciones (una sola, de a 2 o todas) y casillas por categoría. Las dos se mantienen sincronizadas.
  const selCatsSemanal = (d) => {
    const clave = claveCats(d.cats), esOpc = OPC_CATS.some((o) => o[0] === clave);
    return `<div class="sem-cats" data-sem-cats><label class="campo"><span>Categorías del informe</span><select data-acc-change="semCatSel" aria-label="Categorías del informe semanal" style="width:auto;min-width:230px">${K.opts(OPC_CATS.concat(esOpc ? [] : [['otra', 'Elegidas con las casillas']]), esOpc ? clave : 'otra')}</select></label>
      <div class="fila gap wrap" role="group" aria-label="Categorías incluidas">${CATS_TODAS().map((c) => `<label class="check" style="padding:0"><input type="checkbox" data-acc-change="semCatChk" data-scat="${c}"${d.cats.includes(c) ? ' checked' : ''}><span>Sub ${c}</span></label>`).join('')}</div>
      <p class="suave" style="margin:4px 0 8px">La vista, los próximos controles y el PDF incluyen solo las categorías marcadas. El comentario general de la semana es el mismo.</p></div>`;
  };
  function pSemanal() {
    const d = datosSemana(), ed = K.puedeEditar();
    return `<div class="card"><div class="fila sb wrap gap"><h2 style="margin:0">Informe semanal</h2><button class="btn chico" data-acc="kineSemPdf">${K.uiIco('pdf', 16)} Descargar PDF</button></div>
      <div class="fila gap kf-dia" style="margin:8px 0 10px"><button class="btn ghost chico" data-acc="kineSemana" data-d="-1" aria-label="Semana anterior">${K.uiIco('atras', 18)}</button><b>Semana del ${e(fc(d.lun))} al ${e(fc(d.dom))}</b><button class="btn ghost chico" data-acc="kineSemana" data-d="1" aria-label="Semana siguiente" style="transform:scaleX(-1)">${K.uiIco('atras', 18)}</button><button class="btn sec chico" data-acc="kineSemana" data-d="0">Esta semana</button></div>
      <p class="sub">Todo el informe de la semana se arma y se completa aquí: lesionados de la Sub 20 a la Sub 15 con su asistencia (acumulada desde la lesión: verde ≥ 90 %, amarillo 80–89 %, rojo &lt; 80 %), comentarios de la semana por jugador y comentario general.</p>
      ${selCatsSemanal(d)}
      <label class="campo"><span>Comentario general de la semana</span><textarea rows="3" ${ed ? '' : 'disabled'} data-acc-change="semComGeneral" placeholder="Ej. Semana de partidos, balance general de lesionados, cargas, etc.">${e(comGeneral(d.lun))}</textarea></label>
      ${d.filas.length ? `<div class="kt-scroll kt-sem">${tablaSemanal(d, ed)}</div>` : `<p class="vacio-msg">${sinLesionados(d)}</p>`}
      <h3 class="kc-sub">Próximos controles, exámenes y procedimientos</h3>${proximosHTML(d)}</div>`;
  }
  function semanalPDF() {
    const d = datosSemana(), g = comGeneral(d.lun);
    K.pdf.documento(`<div class="bit-print kine-print"><header><img class="sw-vs" src="img/escudo-sw-vs.png" alt=""><div><h1>Informe semanal de kinesiología</h1><p>Santiago Wanderers · Fútbol Joven · semana del ${e(fc(d.lun))} al ${e(fc(d.dom))} · ${d.filas.length} lesionado${d.filas.length === 1 ? '' : 's'}${d.cats.length < CATS_TODAS().length ? ' · ' + e(catsTxt(d.cats)) : ''}</p></div></header>
      ${g ? `<h2 class="bit-h2">Comentario general</h2>${/\n/.test(g) ? `<ul class="vin">${g.split(/\r?\n/).map((x) => x.replace(/^\s*[-•*·]+\s*/, '').trim()).filter(Boolean).map((x) => `<li>${e(x)}</li>`).join('')}</ul>` : `<p>${e(g)}</p>`}` : ''}
      <h2 class="bit-h2">Lesionados de la semana</h2>${d.filas.length ? tablaSemanal(d, false) : `<p>${sinLesionados(d)}</p>`}
      <h2 class="bit-h2">Próximos controles, exámenes y procedimientos</h2>${proximosHTML(d)}</div>`, `Informe semanal kine ${d.cats.length < CATS_TODAS().length ? 'Sub ' + d.cats.slice().sort((a, b) => a - b).join('-') + ' ' : ''}${d.lun}`);
  }

  /* ---------- Ficha del lesionado (ventana) ---------- */
  function fichaKine(casoId) {
    const it = item(casoId); if (!it || !it.j) return;
    K.enInforme(it.inf, it.j, () => {
      const { inf, c, j } = it;
      const asis = K.asistenciaKine(inf, j.id, { desde: c.inicio || '1900-01-01', hasta: '2100-01-01' });
      const cir0 = c.cirugia === true || inf.eventos.some((x) => x.tipo === 'cirugia' && x.casoId === c.id);
      const previas = K.casosPrevios(inf, c);
      const rec0 = c.recidiva === true;
      const transc = c.inicio ? dif(c.inicio, K.hoy()) : 0;
      const fin = c.inicio && c.semanas !== '' && c.semanas != null && !isNaN(Number(c.semanas)) ? suma(c.inicio, Math.round(Number(c.semanas) * 7)) : '';
      K.modal({
        titulo: j.nombre,
        cuerpo: `
          <p class="suave" style="margin:-4px 0 10px">${e([j.categoria, j.posicion].filter(Boolean).join(' · '))}</p>
          <div class="kf-res"><div><small>Lesión</small><b>${e(c.titulo)}</b></div><div><small>Desde</small><b>${c.inicio ? e(fc(c.inicio)) : '—'}</b></div><div><small>Días de baja</small><b>${diasBaja(c)}</b></div>
            <div class="as-sem ${semaforo(asis.pct)}"><small>Asistencia a kinesiología</small><b>${asis.pct == null ? '—' : asis.pct + '%'}</b><span>${asis.esp ? asis.si + ' de ' + asis.esp + ' sesiones' : 'sin sesiones'}${asis.enf ? ' · ' + asis.enf + (asis.enf === 1 ? ' día' : ' días') + ' por enfermedad' : ''}</span></div></div>
          <div class="campo"><span class="lbl">Estado</span>${K.seg('estado', ESTADOS.map(([v, t]) => [v, t]), c.estado || 'rehab', 'est')}</div>
          <label class="campo"><span>Inicio del reintegro deportivo (fecha en que pasó a “En reintegro deportivo”; sale en los calendarios)</span><input type="date" name="reintegroDesde" value="${e(K.inicioReintegro(inf, c) || '')}"></label>
          <label class="campo"><span>Comentarios (aparecen en la ficha del jugador y en el informe semanal)</span><textarea name="estadoNota" placeholder="Ej. En espera porque aún no tiene control médico">${e(c.estadoNota || '')}</textarea></label>
          <div class="grid2">
            <label class="campo"><span>Próximo control</span><input type="date" name="proxControl" value="${e(c.proxControl || '')}"></label>
            <label class="campo"><span>Próximo examen</span><input type="date" name="proxExamen" value="${e(c.proxExamen || '')}"></label>
          </div>
          <label class="campo"><span>Tipo de examen (opcional)</span><input type="text" name="proxExamenTipo" list="dl-kex" value="${e(c.proxExamenTipo || '')}" placeholder="Ej. RNM" autocomplete="off"><datalist id="dl-kex">${K.EV.examen.sug.map((x) => `<option value="${e(x)}">`).join('')}</datalist></label>
          <div class="grid2">
            <label class="campo"><span>Próximo procedimiento</span><input type="date" name="proxProc" value="${e(c.proxProc || '')}"></label>
            <label class="campo"><span>Cuál (elige o escribe)</span><input type="text" name="proxProcTipo" list="dl-kproc" value="${e(c.proxProcTipo || '')}" placeholder="Ej. Ondas de choque" autocomplete="off"><datalist id="dl-kproc">${IDEAS_PROC.map((x) => `<option value="${e(x)}">`).join('')}</datalist></label>
          </div>
          <div class="grid2">
            <label class="campo"><span>Otro hito: fecha</span><input type="date" name="proxHito" value="${e(c.proxHito || '')}"></label>
            <label class="campo"><span>Cuál (evaluación, test, reintegro…)</span><input type="text" name="proxHitoTxt" value="${e(c.proxHitoTxt || '')}" placeholder="Ej. Evaluación funcional" autocomplete="off"></label>
          </div>
          <div class="grid2">
            <label class="campo"><span>Semanas estimadas fuera (hasta el alta)</span><input type="number" inputmode="decimal" min="0" step="0.5" name="semanas" value="${c.semanas !== '' && c.semanas != null ? e(c.semanas) : ''}"></label>
            <label class="campo"><span>Alta kinésica</span><input type="date" name="alta" value="${e(c.alta || '')}"></label>
          </div>
          <p class="suave" style="margin:-4px 0 10px">${c.inicio ? `Van ${Math.floor(transc / 7)} sem. y ${transc % 7} d desde la lesión.` : ''}${fin ? ` Alta estimada: ${e(fc(fin))}.` : ''} Al poner la fecha de alta el jugador sale de esta lista.</p>
          <div class="grid2">
            <div class="campo"><span class="lbl">¿Cirugía?</span>${K.seg('cirugia', [['no', 'No'], ['si', 'Sí']], cir0 ? 'si' : 'no')}</div>
            <div class="campo"><span class="lbl">¿Es recidiva?</span>${K.seg('recidiva', [['no', 'No'], ['si', 'Sí']], rec0 ? 'si' : 'no')}</div>
          </div>
          ${previas.length && !rec0 ? `<p class="aviso" style="margin:0 0 10px">${e(K.avisoRecidiva(previas, false))}</p>` : ''}
          ${K.clinico.html(c, { sinRecidiva: true })}
          ${c.conmocion && K.conmocion ? K.conmocion.rtpHTML(c) : ''}
          ${c.conmocion && K.scat5 ? `<div class="sc-casobtn">${K.scat5.botonAbrirHTML(c)}${K.scat5.botonPdfHTML(c)}</div>` : ''}
          <div class="fila gap wrap"><button type="button" class="btn sec chico" data-kf="editar">${K.uiIco('editar', 16)} Editar lesión</button><button type="button" class="btn sec chico" data-kf="control">Registrar control</button><button type="button" class="btn sec chico" data-kf="examen">Registrar examen</button><button type="button" class="btn sec chico" data-kf="atencion">Registrar atención</button></div>`,
        botones: [{ txt: 'Cancelar', cls: 'sec' }, {
          txt: 'Guardar',
          fn: (m, hoja) => {
            const d = K.datos(hoja);
            Object.assign(c, {
              estado: K.segValor(hoja, 'estado') || 'rehab', estadoNota: (d.estadoNota || '').trim(), proxControl: d.proxControl || '', proxExamen: d.proxExamen || '',
              proxExamenTipo: (d.proxExamenTipo || '').trim(), proxProc: d.proxProc || '', proxProcTipo: (d.proxProcTipo || '').trim(), proxHito: d.proxHito || '', proxHitoTxt: (d.proxHitoTxt || '').trim(), semanas: d.semanas === '' ? '' : Number(d.semanas), alta: d.alta || '',
              cirugia: K.segValor(hoja, 'cirugia') === 'si', recidiva: K.segValor(hoja, 'recidiva') === 'si'
            });
            if (d.reintegroDesde) c.reintegroDesde = d.reintegroDesde; else if (c.estado === 'reintegro') c.reintegroDesde = K.hoy(); else delete c.reintegroDesde; // al pasar a “En reintegro deportivo” sin fecha, queda la de hoy (editable)
            K.clinico.aplicar(c, K.clinico.leer(hoja));
            if (c.conmocion && K.conmocion && hoja.querySelector('[data-cm-rtp]')) K.conmocion.rtpAplicar(c, K.conmocion.rtpLeer(hoja));
            K.guardar(); K.aviso(c.alta ? 'Alta registrada: sale de la lista de lesionados' : 'Guardado'); K.render();
          }
        }],
        alMontar: (m, hoja) => {
          K.clinico.montar(hoja, () => ({ tipo: 'lesion', inicio: c.inicio || '', alta: hoja.querySelector('[name=alta]').value, semanas: hoja.querySelector('[name=semanas]').value }));
          hoja.addEventListener('seg', (ev) => { if (ev.target.dataset.seg !== 'estado' || ev.detail !== 'reintegro') return; const r = hoja.querySelector('[name=reintegroDesde]'); if (r && !r.value) r.value = K.hoy(); }); // al elegir “En reintegro deportivo” se propone la fecha de hoy
          if (K.conmocion && hoja.querySelector('[data-cm-rtp]')) K.conmocion.rtpMontar(hoja);
          if (K.scat5 && c.conmocion) K.scat5.montarCaso(hoja, c);
          hoja.addEventListener('click', (ev) => {
            const b = ev.target.closest('[data-kf]'); if (!b) return;
            const q = b.dataset.kf;
            if (q === 'editar') K.formCaso({ rec: c });
            else if (q === 'control') K.formEvento('control', { jugadorId: j.id });
            else if (q === 'examen') K.formEvento('examen', { jugadorId: j.id });
            else K.formAtencion({ jugadorId: j.id, casoId: c.id });
          });
        }
      });
    });
  }

  function agregar() {
    const js = K.kineJugadores();
    if (!js.length) { K.aviso('Primero agrega jugadores en la pestaña Jugadores', true); return; }
    K.modal({
      titulo: 'Agregar lesionado',
      cuerpo: `<p class="suave" style="margin-top:0">Elige al jugador y registra su lesión: aparecerá en esta lista hasta que le des el alta.</p>
        <div class="campo"><span class="lbl-j">Jugador</span>${K.selJugador('jid', { lista: K.itemsSelJ(js.map((x) => ({ j: x.j, value: x.inf.id + '|' + x.j.id, sub: x.j.categoria || 'Sub ' + x.cat }))), sel: '' })}</div>`,
      botones: [{ txt: 'Cancelar', cls: 'sec' }, {
        txt: 'Continuar',
        fn: (m, hoja) => {
          const v = K.datos(hoja).jid; if (!v) { K.aviso('Elige un jugador', true); return false; }
          const [iid, jid] = v.split('|'), inf = K.state.informes.find((i) => i.id === iid), j = inf && K.jugador(inf, jid);
          if (!j) return false;
          K.enInforme(inf, j, () => K.formCaso({ jugadorId: jid, tipo: 'lesion' }));
        }
      }]
    });
  }

  /* ---------- Pantalla ---------- */
  const SECS = [['seg', 'Seguimiento'], ['sem', 'Informe semanal'], ['seguro', 'Seguro'], ['anual', 'Asistencia anual']];
  K.pKine = function () {
    const s = ks();
    const cuerpo = s.sec === 'sem' ? pSemanal() : s.sec === 'seguro' ? (K.kineSeguroHTML ? K.kineSeguroHTML() : '') : s.sec === 'anual' ? (K.kineAnualHTML ? K.kineAnualHTML() : '') : pSeguimiento();
    return `<div class="titulo-vista"><h1>Kine</h1><button class="btn" data-acc="kineAgregar">${K.uiIco('mas', 18)} Agregar</button></div>
      <div class="tabs kine-secs">${SECS.map(([id, t]) => `<button class="${s.sec === id ? 'act' : ''}" data-acc="kineSec" data-sec="${id}">${t}</button>`).join('')}</div>
      ${cuerpo}`;
  };
  K.PANTALLAS.splice(3, 0, ['kine', 'Kine', K.pKine]);

  // Marca la asistencia de un lesionado en una fecha (v: 'si' | 'no' | 'pauta'). La usan la pestaña Kine y la pantalla Hoy.
  // Tocar de nuevo lo mismo deja el día en blanco (no se entrena) y ofrece “Deshacer”.
  K.kineMarcarAsis = function (casoId, v, fecha) {
    const it = item(casoId); if (!it) return;
    const inf = it.inf;
    inf.asistencias = inf.asistencias || [];
    const a = asisDia(inf, it.j.id, fecha), pauta = v === 'pauta', vv = pauta ? 'no' : v, no = pauta ? 'pauta' : '';
    const igual = a && a.v === vv && (pauta ? a.no === 'pauta' : a.no !== 'pauta');
    if (igual) { K.conDeshacer('Asistencia quitada', () => { inf.asistencias.splice(inf.asistencias.indexOf(a), 1); }); return; }
    if (a) { a.v = vv; a.t = ''; a.sub = ''; a.no = no; } else inf.asistencias.push({ id: K.uid(), jugadorId: it.j.id, fecha, v: vv, t: '', sub: '', no });
    K.guardar(); K.render();
  };

  document.addEventListener('toggle', (ev) => { const d = ev.target; if (d && d.matches && d.matches('details[data-kc-det]')) ks().calAbierto = d.open; }, true);

  /* ---------- Acciones ---------- */
  Object.assign(K.acciones, {
    kineAgregar() { agregar(); },
    kineSec(el) { ks().sec = el.dataset.sec; K.render(); window.scrollTo(0, 0); },
    kineFicha(el) { fichaKine(el.dataset.caso); },
    kineFecha(el) { if (el.value) { ks().fecha = el.value; K.render(); } },
    kineFechaMas(el) { const s = ks(); const d = Number(el.dataset.d); s.fecha = d === 0 ? K.hoy() : suma(s.fecha, d); K.render(); },
    kineMes(el) { const s = ks(); let [y, m] = s.mes.split('-').map(Number); m += Number(el.dataset.d); if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } s.mes = `${y}-${K.pad(m)}`; s.dia = ''; K.render(); },
    kineDia(el, ev) { if (ev) ev.preventDefault(); const s = ks(); s.dia = s.dia === el.dataset.f ? '' : el.dataset.f; K.render(); },
    kineSemana(el) { const s = ks(); const d = Number(el.dataset.d); s.semana = d === 0 ? K.hoy() : suma(s.semana, 7 * d); K.render(); },
    kineCalModo() { const st = ks(); st.cal = st.cal === 'prox' ? 'todo' : 'prox'; K.render(); },
    kineSemPdf() { semanalPDF(); },
    semCatSel(el) { if (el.value === 'otra') return; ks().semCats = el.value.split('-').map(Number).filter((c) => CATS_TODAS().includes(c)); K.render(); },
    semCatChk(el) {
      const s = ks(), c = Number(el.dataset.scat); let v = semCats();
      v = el.checked ? CATS_TODAS().filter((x) => x === c || v.includes(x)) : v.filter((x) => x !== c);
      if (!v.length) { K.aviso('Deja al menos una categoría marcada', true); K.render(); return; }
      s.semCats = v; K.render();
    },
    kineEv(el) { for (const inf of K.kineInfs()) { const ev = inf.eventos.find((x) => x.id === el.dataset.ev); if (ev) { const j = K.jugador(inf, ev.jugadorId); if (j) K.enInforme(inf, j, () => K.formEvento(ev.tipo, { rec: ev })); return; } } },
    semComCaso(el) { const it = item(el.dataset.caso); if (!it) return; const lun = lunesDe(ks().semana); it.c.semCom = Object.assign({}, it.c.semCom); if (el.value.trim()) it.c.semCom[lun] = el.value.trim(); else delete it.c.semCom[lun]; K.guardar(); K.aviso('Guardado'); },
    semComGeneral(el) { const lun = lunesDe(ks().semana), inf = infGen(); inf.semGeneral = Object.assign({}, inf.semGeneral); if (el.value.trim()) inf.semGeneral[lun] = el.value.trim(); else delete inf.semGeneral[lun]; K.guardar(); K.aviso('Guardado'); },
    kineTodosAsisten() {
      const f = ks().fecha, vistos = new Set();
      const l = K.kineLesionados(f).filter((it) => { if (it.c.inicio === f || asisDia(it.inf, it.j.id, f) || vistos.has(it.j.id)) return false; vistos.add(it.j.id); return true; });
      if (!l.length) { K.aviso('Ya están todos marcados'); return; }
      K.confirmar(`¿Marcar que ${l.length === 1 ? '1 lesionado sin marcar asistió' : l.length + ' lesionados sin marcar asistieron'} el ${e(fc(f))}? Quien ya tenga marca no cambia.`, 'Sí, todos asistieron', () => {
        K.conDeshacer(l.length === 1 ? 'Asistencia marcada (1)' : `Asistencia marcada (${l.length})`, () => { l.forEach((it) => { (it.inf.asistencias = it.inf.asistencias || []).push({ id: K.uid(), jugadorId: it.j.id, fecha: f, v: 'si', t: '', sub: '', no: '' }); }); }, { quitarNuevos: true, restaurado: 'Asistencias quitadas' });
      }, false);
    },
    kineAsis(el) { K.kineMarcarAsis(el.dataset.caso, el.dataset.v, el.dataset.fecha || ks().fecha); },
    kineAsisSel(el) {
      const it = item(el.dataset.caso); if (!it) return;
      const a = asisDia(it.inf, it.j.id, el.dataset.fecha || ks().fecha); if (!a) return;
      a[el.dataset.f] = el.value;
      if (el.dataset.f === 't') a.sub = el.value === 'RD' ? (a.sub || 'K') : '';
      K.guardar(); K.render();
    }
  });
})();

/* Pestaña Partidos: calendario, jornadas (cada rival con su Sub 20 y Sub 18, o Sub 16 y Sub 15), informe de partido
   (atenciones, minutos, observaciones), informe combinado e informe general de todos los partidos. */
(function () {
  const K = window.K;
  const e = K.esc;
  const fc = (iso) => K.fechaCorta(iso);
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const DIA_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MOMENTOS = [['pre', 'Pre partido'], ['t1', '1.er tiempo'], ['et', 'Entretiempo'], ['t2', '2.º tiempo'], ['post', 'Post partido']];
  const MOM_ORD = { pre: 0, t1: 1, et: 2, t2: 3, post: 4 };
  const MOM_TXT = Object.fromEntries(MOMENTOS);
  const MOM_COL = { pre: '#8a9a90', t1: '#2f7a4a', et: '#c98f00', t2: '#3b5bb5', post: '#7b4fb8' };
  const MECANISMOS = [['contacto', 'Con contacto'], ['sin', 'Sin contacto'], ['na', 'No aplica']];
  K.MOMENTOS_PARTIDO = MOMENTOS;
  const jugando = (m) => m === 't1' || m === 't2';
  const incs = (p) => p.incidencias || (p.incidencias = []);
  const estado = () => (K.ui.partCal = K.ui.partCal || { sem: 'anio' });
  const anioPer = () => Number(K.state.periodo && K.state.periodo.anio) || new Date().getFullYear();
  const dia = (iso) => DIA_LARGO[new Date(iso + 'T12:00:00').getDay()];
  const nomJ = (id) => K.nombreJugadorGlobal(id);
  const logoSrc = (p) => (p.logoData ? p.logoData : p.logo ? `img/rivales/${p.logo}.png` : '');
  const logo = (p) => (logoSrc(p) ? `<img src="${e(logoSrc(p))}" alt="">` : '');
  const catTxt = (p) => (p.cat ? 'Sub ' + p.cat : 'Sin categoría');
  // El minuto se anota "del tiempo" (0-45). En el 2.º tiempo se muestra también el minuto corrido del partido: 2.º tiempo · min 38' (83' del partido).
  const mitad = (p) => ((p && Number(p.duracion)) || 90) / 2;
  const minCorrido = (i, p) => (i.momento === 't2' && i.minuto !== '' && i.minuto != null ? mitad(p || i._p) + Number(i.minuto) : null);
  const momTxt = (i, p) => { const mc = minCorrido(i, p); return (MOM_TXT[i.momento] || '') + (jugando(i.momento) && i.minuto !== '' && i.minuto != null ? ` · min ${i.minuto}'` + (mc != null ? ` (${mc}' del partido)` : '') : ''); };
  const tratTxt = (inf, i) => Object.keys(i.trat || {}).filter((id) => i.trat[id] > 0).map((id) => `${(K.trat(inf, id) || { nombre: id }).nombre}${i.trat[id] > 1 ? ' ×' + i.trat[id] : ''}`).join(', ');
  const ordenInc = (a, b) => (MOM_ORD[a.momento] - MOM_ORD[b.momento]) || ((Number(a.minuto) || 0) - (Number(b.minuto) || 0));
  const lineas = (t) => String(t || '').split(/\r?\n/).map((x) => x.replace(/^\s*[-•*·]+\s*/, '').trim()).filter(Boolean);
  const vinetas = (t) => { const l = lineas(t); return l.length ? `<ul class="vin">${l.map((x) => `<li>${e(x)}</li>`).join('')}</ul>` : ''; };
  const zonaTxt = (z) => (K.nombreZonaLimpia ? K.nombreZonaLimpia(z) : K.nombreZona(z));

  /* ---------- Resumen de uno o varios partidos ---------- */
  function resumen(inf, ps) {
    const l = [];
    ps.forEach((p) => incs(p).forEach((i) => { if (K.jugadorGlobal(i.jugadorId)) l.push(Object.assign({}, i, { _cat: p.cat, _p: p })); }));
    const cnt = (f) => l.filter(f).length;
    const porMom = MOMENTOS.map(([k, t]) => [t, cnt((i) => i.momento === k), MOM_COL[k]]);
    const porClase = K.CLASES_ATENCION.map(([k, t]) => [t, cnt((i) => i.clase === k)]);
    const interv = {}; l.forEach((i) => Object.keys(i.trat || {}).forEach((id) => { if (i.trat[id] > 0) interv[id] = (interv[id] || 0) + Number(i.trat[id]); }));
    return {
      lista: l.slice().sort((a, b) => ((Number(b._cat) || 0) - (Number(a._cat) || 0)) || ordenInc(a, b)), n: l.length, jugadores: new Set(l.map((i) => i.jugadorId)).size, enCancha: cnt((i) => i.enCancha === true),
      retiros: cnt((i) => i.retiro === true), porMom, porClase, interv
    };
  }
  K.resumenPartido = (inf, p) => resumen(inf, [p]);
  K.resumenPartidos = resumen;

  /* ---------- Citados (v1.6): p.citados = arreglo de ids; sin esa lista el partido cuenta con todos los de la categoría ---------- */
  const citadosDe = (p) => (Array.isArray(p.citados) ? p.citados : null);
  const jugaronDe = (p) => Object.keys(p.minutos || {}).filter((id) => Number(p.minutos[id]) > 0 && K.jugadorGlobal(id));
  const citTxt = (p) => { const c = citadosDe(p); return c ? `${c.length} citado${c.length === 1 ? '' : 's'} · ${jugaronDe(p).length} jugaron` : ''; };
  K.citadosPartido = citadosDe; K.jugaronPartido = jugaronDe; K.citadosTexto = citTxt;
  // Fila de la lista de partidos: “N citados · M jugaron” (por categoría si el día tiene más de una)
  const citFila = (jn) => { const l = jn.ps.filter((p) => citadosDe(p)); return l.length ? `<span class="pl-cit" data-citados>${l.map((p) => (jn.ps.length > 1 ? `<b>${e(catTxt(p))}</b>: ` : '') + citTxt(p)).join(' · ')}</span>` : ''; };
  // Jugadores de la lista de minutos: con citados, los citados + quienes jugaron sin estar citados + los agregados a mano; sin citados, todos los de la categoría (como siempre).
  function listaMin(inf, p) {
    const cand = K.jugadoresDePartido(inf, p), cit = citadosDe(p);
    if (!cit) return cand;
    const ids = new Set(cit), ext = (K.ui.partExtra && K.ui.partExtra[p.id]) || [], out = [], vistos = new Set();
    const add = (id, noCit) => {
      if (vistos.has(id)) return;
      const c = cand.find((x) => x.j.id === id);
      if (c) { vistos.add(id); out.push(Object.assign({}, c, { noCitado: noCit })); return; }
      const g = K.jugadorGlobal(id); if (g) { vistos.add(id); out.push({ j: g.j, inf: g.inf, visitante: false, noCitado: noCit }); }
    };
    cit.forEach((id) => add(id, false));
    jugaronDe(p).forEach((id) => { if (!ids.has(id)) add(id, true); });
    ext.forEach((id) => { if (!ids.has(id)) add(id, true); });
    return out.sort((a, b) => a.j.nombre.localeCompare(b.j.nombre, 'es'));
  }
  K.listaMinutosPartido = listaMin;

  /* ---------- Calendario (año / semestre) ---------- */
  function mesHTML(m, anio, porFecha) {
    const off = (new Date(anio, m - 1, 1).getDay() + 6) % 7, nd = new Date(anio, m, 0).getDate(), hoy = K.hoy();
    let c = '';
    for (let i = 0; i < off; i++) c += '<span class="pc vacia"></span>';
    for (let d = 1; d <= nd; d++) {
      const iso = `${anio}-${K.pad(m)}-${K.pad(d)}`, js = porFecha[iso];
      c += js ? `<button type="button" class="pc pj${js[0].jugado ? ' jug' : ''}" data-acc="partInforme" data-id="${js[0].p0.id}" title="${e(js.map((x) => x.rival).join(' / '))}">${d}</button>` : `<span class="pc${iso === hoy ? ' hoy' : ''}">${d}</span>`;
    }
    const n = Object.keys(porFecha).filter((f) => f.startsWith(`${anio}-${K.pad(m)}`)).reduce((a, f) => a + porFecha[f].length, 0);
    return `<div class="pmes${n ? '' : ' sin'}"><h4>${MESES[m - 1]}${n ? ` <small>${n} partido${n === 1 ? '' : 's'}</small>` : ''}</h4><div class="pgrid">${DIAS.map((d) => `<em>${d}</em>`).join('')}${c}</div></div>`;
  }
  const resChips = (jn) => `<em class="pj-chips">${jn.ps.map((p) => `<i class="chip">${e(p.cat ? 'Sub ' + p.cat : 'Sin cat.')}${p.res ? ' · ' + e(p.res) : ''}</i>`).join('')}</em>`;
  K.partidosCalendarioHTML = function (inf) {
    const s = estado(), anio = anioPer();
    const meses = s.sem === '1' ? [1, 2, 3, 4, 5, 6] : s.sem === '2' ? [7, 8, 9, 10, 11, 12] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const js = K.jornadas(inf).filter((j) => j.fecha && j.fecha.slice(0, 4) === String(anio) && meses.includes(Number(j.fecha.slice(5, 7)))).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const porFecha = {}; js.forEach((j) => { (porFecha[j.fecha] = porFecha[j.fecha] || []).push(j); });
    const seg = K.seg('partSem', [['anio', 'Año ' + anio], ['1', '1.er semestre'], ['2', '2.º semestre']], s.sem);
    const sin = K.jornadas(inf).filter((j) => !j.fecha).length;
    return `<div class="card"><div class="fila sb wrap gap"><h2 style="margin:0">Calendario de partidos</h2><button class="btn sec chico" data-acc="nuevoPartido">${K.uiIco('mas', 16)} Agregar partido</button></div>
      <div style="margin:8px 0 10px">${seg}</div>
      <div class="pcal">${meses.map((m) => mesHTML(m, anio, porFecha)).join('')}</div>
      ${(() => { const v = meses.filter((m) => !Object.keys(porFecha).some((f) => f.startsWith(`${anio}-${K.pad(m)}`))); return v.length && v.length < meses.length ? `<p class="suave pmes-sin">Meses sin partidos: ${v.map((m) => MESES[m - 1]).join(', ')}.</p>` : ''; })()}
      <div class="kc-ley" style="margin-top:8px"><span><u class="pj-u jug"></u>Jugado</span><span><u class="pj-u"></u>Por jugar</span></div>
      <h3 class="kc-sub">${js.length} partido${js.length === 1 ? '' : 's'} (rival) · ${s.sem === 'anio' ? 'año ' + anio : s.sem === '1' ? '1.er semestre ' + anio : '2.º semestre ' + anio}</h3>
      ${js.length ? js.map((j) => { const r = resumen(inf, j.ps); return `<div class="item pl-it" data-acc="partInforme" data-id="${j.p0.id}"><span class="mini-ico">${logo(j)}</span><div class="txt"><b>${e(j.rival)}</b><span>${e(dia(j.fecha))} ${e(fc(j.fecha))} · ${j.local ? 'Local' : 'Visita'}${j.jugado ? '' : ' · por jugar'}</span>${resChips(j)}${citFila(j)}</div>${r.n ? `<span class="chip">${r.n} atenc.</span>` : ''}<span class="btn ghost chico">Informe</span></div>`; }).join('') : '<p class="vacio-msg" style="padding:10px">No hay partidos con fecha en este período.</p>'}
      ${sin ? `<p class="suave" style="margin:8px 0 0">${sin} partido(s) sin fecha no aparecen en el calendario: ponles fecha en la lista de abajo.</p>` : ''}</div>`;
  };
  // Lista “Orden y fechas”: una fila por rival, con todas sus categorías.
  K.partidosListaHTML = function (inf) {
    const todos = K.jornadas(inf), ed = K.puedeEditar();
    const tk = K.norm(K.ui.partQ || '').split(' ').filter(Boolean); // buscador sin tildes (rival, torneo, fecha)
    const js = tk.length ? todos.filter((j) => { const h = K.norm([j.rival, j.torneo, j.fecha ? fc(j.fecha) : '', j.ps.map((p) => catTxt(p) + ' ' + (p.res || '')).join(' ')].join(' ')); return tk.every((t) => h.includes(t)); }) : todos;
    const puedeOrdenar = ed && !tk.length && todos.length > 1, ordenando = puedeOrdenar && !!K.ui.ordenarP;
    return `<div class="card"><div class="fila sb wrap gap"><h2 style="margin:0">Orden y fechas (${todos.length})</h2><div class="fila gap">${puedeOrdenar ? `<button class="btn ${ordenando ? '' : 'sec '}chico" data-acc="ordenarP" aria-pressed="${ordenando}">${ordenando ? 'Listo' : 'Ordenar'}</button>` : ''}<button class="btn sec chico" data-acc="nuevoPartido">${K.uiIco('mas', 16)} Agregar</button></div></div>
      <p class="sub">Un partido por rival: ahí eliges qué categorías juegan (por ejemplo Sub 20 y Sub 18 el mismo día). Este es el orden del calendario en el informe${inf.ordenPartidos ? ' (manual)' : ' (por fecha)'}.${ordenando ? ' Arrastra <b>⠿</b> o usa las flechas para cambiarlo.' : puedeOrdenar ? ' Toca <b>Ordenar</b> para cambiarlo.' : ''}${inf.ordenPartidos ? ' <a href="#" data-acc="ordenFecha">Volver al orden por fecha</a>' : ''}</p>
      <p class="sub">Cambia la fecha directamente en la fila. Toca el rival para editar el resto (local/visita, resultado de cada categoría, si ya se jugó).</p>
      ${todos.length > 5 ? `<input type="search" placeholder="Buscar rival, torneo o categoría…" value="${e(K.ui.partQ || '')}" data-acc-input="partBuscar" aria-label="Buscar partido" style="margin-bottom:10px">` : ''}
      ${todos.length && ed ? `<p style="margin:0 0 8px"><a href="#" data-acc="vaciarPartidos">Vaciar el calendario de ${e(inf.nombre)}</a> <span class="suave">(borra todos sus partidos y las atenciones registradas en ellos)</span></p>` : ''}
      ${js.length ? `<div class="lista pl-lista"${ordenando ? ' data-arr="partidos"' : ''}>${js.map((j) => `<div class="item" data-arr-item data-id="${e(j.jid)}">${ordenando ? `<button class="grip" data-grip aria-label="Arrastrar para cambiar el orden" title="Arrastra para cambiar el orden">${K.uiIco('arrastrar', 20)}</button>` : ''}<span class="mini-ico" data-acc="editPartido" data-id="${e(j.jid)}">${logo(j)}</span>
        <div class="txt" data-acc="editPartido" data-id="${e(j.jid)}"><b>${e(j.rival)}</b><span>${j.local ? 'Local' : 'Visita'}${j.jugado ? '' : ' · pendiente'}</span>${j.torneo ? `<span class="tag-torneo">${e(((K.torneoDePartido && K.torneoDePartido(inf, j.p0)) || {}).txt || j.torneo)}</span>` : ''}${resChips(j)}${citFila(j)}</div>
        <input type="date" class="fecha-inline" min="2000-01-01" max="2100-12-31" value="${e(j.fecha || '')}" data-acc-change="fechaP" data-id="${e(j.jid)}" aria-label="Fecha del partido contra ${e(j.rival)}">
        ${ordenando ? `<button class="btn ghost chico" data-acc="subirP" data-id="${e(j.jid)}" aria-label="Subir">${K.uiIco('arriba', 18)}</button><button class="btn ghost chico" data-acc="bajarP" data-id="${e(j.jid)}" aria-label="Bajar">${K.uiIco('abajo', 18)}</button>` : ''}</div>`).join('')}</div>` : todos.length ? '<p class="vacio-msg">Ningún partido coincide con la búsqueda.</p>' : '<p class="vacio-msg">Aún no hay partidos. Toca <b>Agregar</b> para cargar el primero.</p>'}</div>`;
  };

  /* ---------- Informe de todos los partidos (por categoría o general) ---------- */
  const ALCANCES = [['todas', 'Todas las categorías (Sub 15 a Sub 20)', [15, 16, 18, 20]], ['15', 'Solo Sub 15', [15]], ['16', 'Solo Sub 16', [16]], ['15-16', 'Sub 15 y Sub 16 juntas', [15, 16]], ['18', 'Solo Sub 18', [18]], ['20', 'Solo Sub 20', [20]], ['18-20', 'Sub 18 y Sub 20 juntas', [18, 20]]];
  K.partidosGeneralHTML = function () {
    const sel = estado().general || 'todas', per = K.resolverPeriodo(K.state.periodo);
    return `<div class="card"><h2>Informe de todos los partidos</h2>
      <p class="sub">Un solo documento con todos los partidos del período (<b>${e(per.completo)}</b>): resultados, atenciones, intervenciones, minutos jugados y lesiones por jugador. Elige la categoría o el informe general.</p>
      <div class="fila gap wrap"><select data-acc-change="partGenSel" style="width:auto;min-width:220px;flex:1">${K.opts(ALCANCES.map((a) => [a[0], a[1]]), sel)}</select><button class="btn" data-acc="partGenPdf">${K.uiIco('pdf', 16)} Descargar PDF</button></div>
      ${(() => { const pl = contratados(); return pl.length ? `<h3 class="kc-sub" style="margin-top:14px">Jugadores de plantel</h3><p class="sub">Informe general de todos los jugadores de plantel (resumen y partidos de cada uno).</p>
        <button class="btn sec" data-acc="contratoPdf">${K.uiIco('pdf', 16)} Informe de todos los jugadores de plantel</button>
        ${(() => { const js = jornadasJugadas(); if (!js.length) return ''; const v = estado().plPartido || (js[0].inf.id + '|' + js[0].jn.jid); return `<p class="sub" style="margin-top:12px">Informe de un partido con todos los jugadores de plantel que jugaron en él.</p>
        <div class="fila gap wrap"><select data-acc-change="plPartidoSel" style="width:auto;min-width:220px;flex:1">${K.opts(js.map(({ inf, jn }) => [inf.id + '|' + jn.jid, `${jn.rival} · ${jn.fecha ? fc(jn.fecha) : 'sin fecha'} · ${jn.ps.map((p) => (p.cat ? 'Sub ' + p.cat : 'Sin cat.')).join(' / ')}`]), v)}</select><button class="btn sec" data-acc="contratoPartidoPdf">${K.uiIco('pdf', 16)} Informe del partido</button></div>`; })()}
        ${seleccionPlantelHTML()}` : ''; })()}</div>`;
  };
  // Lista con casillas para sacar el informe de jugadores de plantel solo de los partidos elegidos.
  const selPlantel = () => { const e0 = estado(); if (!Array.isArray(e0.plSel)) e0.plSel = []; return e0.plSel; };
  function seleccionPlantelHTML() {
    const lista = jornadasPlantel(), validas = new Set(lista.map(({ inf, jn }) => claveJ(inf, jn))), sel = selPlantel().filter((c) => validas.has(c));
    estado().plSel = sel;
    if (!lista.length) return '<h4 class="kc-sub pl-tit">Elegir partidos</h4><p class="sub">Aún no hay partidos del período con jugadores de plantel que hayan jugado o recibido atención.</p>';
    return `<h4 class="kc-sub pl-tit" style="margin-top:14px">Elegir partidos</h4><p class="sub">Marca uno, varios o todos los partidos y descarga el informe solo de ellos: resumen de los jugadores de plantel y, por partido, una tabla con minutos, atenciones, intervenciones y si se retiraron.</p>
      <div class="pl-sel" data-pl-sel><label class="check pl-todos"><input type="checkbox" data-acc-change="plSelTodos" data-pl-todos${sel.length === lista.length ? ' checked' : ''}><span><b>Todos los partidos</b> (${lista.length})</span></label>
        <div class="pl-sel-lista">${lista.map(({ inf, jn }) => `<label class="check pl-fila"><input type="checkbox" data-acc-change="plSel" data-k="${e(claveJ(inf, jn))}"${sel.includes(claveJ(inf, jn)) ? ' checked' : ''}><span><b>${e(jn.rival)}</b> <small>${jn.fecha ? e(fc(jn.fecha)) : 'sin fecha'} · ${jn.ps.map((p) => e(catTxt(p)) + (p.res ? ' ' + e(p.res) : '')).join(' / ')}${jn.torneo ? ' · ' + e(jn.torneo) : ''}</small></span></label>`).join('')}</div></div>
      <div class="fila gap wrap" style="margin-top:8px"><button class="btn" data-acc="plantelPartidosPdf" data-pl-btn${sel.length ? '' : ' disabled'}>${K.uiIco('pdf', 16)} <span data-pl-btn-t>${btnPlantelTxt(sel.length)}</span></button></div>`;
  }
  function refrescarSelPlantel(raiz) {
    if (!raiz) return;
    const sel = selPlantel(), cbs = Array.from(raiz.querySelectorAll('input[data-k]')), todos = raiz.querySelector('[data-pl-todos]'), b = raiz.querySelector('[data-pl-btn]');
    cbs.forEach((cb) => { cb.checked = sel.includes(cb.dataset.k); });
    if (todos) { todos.checked = cbs.length > 0 && cbs.every((cb) => cb.checked); todos.indeterminate = sel.length > 0 && !todos.checked; }
    if (b) { b.disabled = !sel.length; const t = b.querySelector('[data-pl-btn-t]'); if (t) t.textContent = btnPlantelTxt(sel.length); }
  }
  const btnPlantelTxt = (n) => (n ? `Descargar informe de ${n} partido${n === 1 ? '' : 's'}` : 'Marca al menos un partido');
  const contratados = (per) => { per = per || K.resolverPeriodo(K.state.periodo); const out = []; K.state.informes.forEach((i) => i.jugadores.forEach((j) => { if (j.contrato && K.estaEn(j, per.desde, per.hasta)) out.push({ j, inf: i }); })); return out.sort((a, b) => a.j.nombre.localeCompare(b.j.nombre, 'es')); };
  /* ---------- Informes de jugadores con contrato ---------- */
  const cabecera = (tit, sub) => `<header><img class="sw-vs" src="img/escudo-sw-vs.png" alt=""><div><h1>${tit}</h1><p>${sub}</p></div></header>`;
  const detalleInc = (inf, l) => l.map((i) => `${e(momTxt(i))}: ${e(K.nombreClase(i.clase))}${i.zona ? ' · ' + e(zonaTxt(i.zona)) : ''}${i.enCancha ? ' · atendido en cancha' : ''}${tratTxt(inf, i) ? ' · ' + e(tratTxt(inf, i)) : ''}${i.retiro ? ' · <b>se retiró</b>' : ''}${i.scat5 ? ' · <b>sospecha de conmoción cerebral</b>' : ''}${i.notas ? '<small>' + e(i.notas) + '</small>' : ''}`).join('<br>');
  // Todos los jugadores con contrato: resumen y partidos de cada uno.
  // Categoría del jugador al terminar el período del informe (un jugador que subió después sigue figurando en la de ese año).
  const catJ = (j, per) => { if (!K.tieneHistorial(j)) return j.categoria || ''; const n = K.catPeriodo(j, per.desde, per.hasta); return n ? 'Sub ' + n : j.categoria || ''; };
  K.contratoGeneralHTML = function () {
    const per = K.resolverPeriodo(K.state.periodo), pl = contratados(per), kpi = (n, t) => `<div class="bd-k"><b>${n}</b><span>${t}</span></div>`;
    const datos = pl.map(({ j, inf: i0 }) => {
      const filas = [];
      K.state.informes.forEach((inf) => { K.jornadas(inf); inf.partidos.forEach((p) => {
        const min = Number((p.minutos || {})[j.id]) || 0, inc = incs(p).filter((i) => i.jugadorId === j.id);
        if (K.partidoEnPeriodo(p, per, inf) && (min || inc.length)) filas.push({ p, min, inc, inf });
      }); });
      filas.sort((a, b) => (a.p.fecha || '9999').localeCompare(b.p.fecha || '9999'));
      const les = i0.casos.filter((c) => c.jugadorId === j.id && c.tipo === 'lesion' && K.enPeriodo(c.inicio, per)).length;
      return { j, filas, min: filas.reduce((a, x) => a + x.min, 0), at: filas.reduce((a, x) => a + x.inc.length, 0), les };
    });
    const tot = (f) => datos.reduce((a, d) => a + f(d), 0);
    const resumenT = datos.length ? `<h2 class="bit-h2">Resumen por jugador</h2><table class="kt"><thead><tr><th>Jugador</th><th>Categoría</th><th>Partidos</th><th>Minutos</th><th>Atenciones</th><th>Lesiones</th></tr></thead><tbody>${datos.map((d) => `<tr><td><b>${e(d.j.nombre)}</b></td><td>${e(catJ(d.j, per))}</td><td class="n">${d.filas.filter((x) => x.min).length}</td><td class="n">${d.min || '—'}</td><td class="n">${d.at}</td><td class="n">${d.les}</td></tr>`).join('')}</tbody></table>` : '<p>No hay jugadores de plantel.</p>';
    const porJ = datos.filter((d) => d.filas.length).map((d) => `<div class="nobr"><h2 class="bit-h2">${e(d.j.nombre)} <small>${e(catJ(d.j, per))}</small></h2><table class="kt"><thead><tr><th>Fecha</th><th>Rival</th><th>Categoría</th><th>Res.</th><th>Min</th><th>Atenciones</th></tr></thead><tbody>${d.filas.map((x) => `<tr><td>${x.p.fecha ? e(fc(x.p.fecha)) : '—'}</td><td><b>${e(x.p.rival)}</b></td><td>${e(catTxt(x.p))}</td><td class="n">${e(x.p.res || '—')}</td><td class="n">${x.min || '—'}</td><td>${x.inc.length ? detalleInc(x.inf, x.inc) : '—'}</td></tr>`).join('')}</tbody></table></div>`).join('');
    return `<div class="bit-print kine-print">${cabecera('Informe kinésico · Jugadores de plantel', 'Santiago Wanderers · ' + e(per.completo) + ' · ' + datos.length + ' jugador' + (datos.length === 1 ? '' : 'es'))}
      <div class="bd-kpis">${kpi(datos.length, 'jugadores')}${kpi(tot((d) => d.filas.filter((x) => x.min).length), 'participaciones en partidos')}${kpi(tot((d) => d.min), 'minutos jugados')}${kpi(tot((d) => d.at), 'atenciones en partidos')}</div>
      ${resumenT}${porJ}</div>`;
  };
  // Un partido (por ejemplo contra Recoleta): todos los jugadores con contrato que jugaron en él (con minutos o atenciones).
  const jornadasJugadas = () => { const out = []; K.state.informes.forEach((inf) => K.jornadas(inf).forEach((jn) => { if (jn.jugado || jn.ps.some((p) => incs(p).length)) out.push({ inf, jn }); })); return out.sort((a, b) => (b.jn.fecha || '').localeCompare(a.jn.fecha || '')); };
  K.contratoPartidoHTML = function (clave) {
    const [iid, jid] = String(clave || '').split('|'), inf = K.state.informes.find((i) => i.id === iid), jn = inf && K.jornadas(inf).find((x) => x.jid === jid);
    if (!jn) return '<div class="bit-print kine-print"><p>Elige un partido.</p></div>';
    const filas = [];
    jn.ps.forEach((p) => {
      const ids = new Set(Object.keys(p.minutos || {}).filter((id) => Number(p.minutos[id]) > 0).concat(incs(p).map((i) => i.jugadorId)));
      ids.forEach((id) => {
        const g = K.jugadorGlobal(id); if (!g || !g.j.contrato) return;
        const inc = incs(p).filter((i) => i.jugadorId === id).map((i) => Object.assign({}, i, { _p: p })), min = Number((p.minutos || {})[id]) || 0;
        filas.push({ g, p, min, inc });
      });
    });
    filas.sort((a, b) => a.g.j.nombre.localeCompare(b.g.j.nombre, 'es'));
    const res = jn.ps.map((p) => (p.res ? (p.cat ? 'Sub ' + p.cat + ' ' : '') + p.res : '')).filter(Boolean).join(' · ');
    const kpi = (n, t) => `<div class="bd-k"><b>${n}</b><span>${t}</span></div>`;
    const src = logoSrc(jn);
    const conm = K.conmocion ? K.conmocion.filas([]) : [];
    if (K.conmocion) jn.ps.forEach((p) => { const ids = new Set(filas.filter((x) => x.p === p).map((x) => x.g.j.id)); K.conmocion.filas([p]).forEach((r) => { if (ids.has(r.inc.jugadorId)) conm.push(r); }); });
    const cab = `<header><div class="vs-logos"><img class="sw-vs" src="img/escudo-sw-vs.png" alt=""><b class="vs-t">vs</b>${src ? `<img class="rv-logo" src="${e(src)}" alt="">` : `<span class="rv-ini">${e((jn.rival || '?').slice(0, 1))}</span>`}</div><div style="flex:1"><h1>Informe kinésico · Jugadores de plantel · vs ${e(jn.rival)}</h1><p>Santiago Wanderers · ${jn.fecha ? e(dia(jn.fecha)) + ' ' + e(fc(jn.fecha)) : 'sin fecha'} · ${jn.local ? 'Local' : 'Visita'}${res ? ' · ' + e(res) : ''}</p></div></header>`;
    return `<div class="bit-print kine-print">${cab}
      <div class="bd-kpis">${kpi(filas.length, 'jugadores de plantel')}${kpi(filas.reduce((a, x) => a + x.min, 0), 'minutos jugados')}${kpi(filas.reduce((a, x) => a + x.inc.length, 0), 'atenciones')}${kpi(filas.filter((x) => x.inc.some((i) => i.retiro)).length, 'se retiraron')}${K.conmocion ? K.conmocion.kpiHTML(conm.length) : ''}</div>
      ${filas.length ? `<h2 class="bit-h2">Jugadores de plantel</h2><table class="kt"><thead><tr><th>Jugador</th><th>Categoría</th><th>Min</th><th>Atenciones</th></tr></thead><tbody>${filas.map((x) => `<tr><td><b>${e(x.g.j.nombre)}</b></td><td>${e(catTxt(x.p))}</td><td class="n">${x.min || '—'}</td><td>${x.inc.length ? detalleInc(x.g.inf, x.inc) : 'Sin atención'}</td></tr>`).join('')}</tbody></table>` : '<p>Ningún jugador de plantel jugó en este partido.</p>'}${K.conmocion ? K.conmocion.seccionHTML(conm) : ''}</div>`;
  };
  /* ---------- Informe de jugadores de plantel de partidos elegidos ----------
     El usuario marca uno, varios o todos los partidos; sale un documento con un mini resumen (solo jugadores de plantel) y, por cada partido,
     una tabla: Nombre · Categoría · Minutos jugados · Atenciones · Intervención y comentarios · Se retiró. Las páginas se arman midiendo el alto real
     de cada bloque (una tabla grande se parte en trozos de filas completas; el encabezado del partido se repite) para no cortar filas ni desbordar. */
  const esPlantel = (id) => { const g = K.jugadorGlobal(id); return !!(g && g.j.contrato); };
  const plantelEnJornada = (jn) => jn.ps.some((p) => Object.keys(p.minutos || {}).some((id) => Number(p.minutos[id]) > 0 && esPlantel(id)) || incs(p).some((i) => esPlantel(i.jugadorId)));
  // Partidos entre los que se puede elegir: los del período en que jugó o fue atendido algún jugador de plantel (más reciente primero).
  const jornadasPlantel = (per) => { per = per || K.resolverPeriodo(K.state.periodo); return jornadasJugadas().filter(({ inf, jn }) => jn.ps.some((p) => K.partidoEnPeriodo(p, per, inf)) && plantelEnJornada(jn)); };
  const claveJ = (inf, jn) => inf.id + '|' + jn.jid;
  const nIntervenciones = (inc) => inc.reduce((a, i) => a + Object.keys(i.trat || {}).reduce((b, id) => b + (Number(i.trat[id]) > 0 ? Number(i.trat[id]) : 0), 0), 0);
  K.plantelPartidosDatos = function (claves) {
    const vistos = new Set(), items = [];
    (claves || []).forEach((c) => {
      if (vistos.has(c)) return; vistos.add(c);
      const [iid, jid] = String(c).split('|'), inf = K.state.informes.find((i) => i.id === iid), jn = inf && K.jornadas(inf).find((x) => x.jid === jid);
      if (!jn) return;
      const filas = [];
      jn.ps.forEach((p) => {
        const ids = new Set(Object.keys(p.minutos || {}).filter((id) => Number(p.minutos[id]) > 0).concat(incs(p).map((i) => i.jugadorId)));
        ids.forEach((id) => {
          const g = K.jugadorGlobal(id); if (!g || !g.j.contrato) return;
          filas.push({ g, p, min: Number((p.minutos || {})[id]) || 0, inc: incs(p).filter((i) => i.jugadorId === id) });
        });
      });
      filas.sort((a, b) => a.g.j.nombre.localeCompare(b.g.j.nombre, 'es') || (Number(b.p.cat) || 0) - (Number(a.p.cat) || 0));
      items.push({ inf, jn, filas });
    });
    items.sort((a, b) => (a.jn.fecha || '9999').localeCompare(b.jn.fecha || '9999') || a.jn.rival.localeCompare(b.jn.rival, 'es'));
    const todas = [].concat(...items.map((x) => x.filas)), pids = new Set(items.map((x) => x.jn.ps.map((p) => p.id)).reduce((a, l) => a.concat(l), [])), plantel = new Set(todas.map((r) => r.g.j.id));
    const nuevos = new Set(); K.state.informes.forEach((i) => (i.casos || []).forEach((c) => { if (c.partidoId && pids.has(c.partidoId) && plantel.has(c.jugadorId)) nuevos.add(c.id); }));
    const resumen = { jugaron: new Set(todas.filter((r) => r.min > 0).map((r) => r.g.j.id)).size, minutos: todas.reduce((a, r) => a + r.min, 0), atenciones: todas.reduce((a, r) => a + r.inc.length, 0), intervenciones: todas.reduce((a, r) => a + nIntervenciones(r.inc), 0), retiraron: todas.filter((r) => r.inc.some((i) => i.retiro)).length, nuevas: nuevos.size };
    return { items, resumen };
  };
  const tituloPlantel = (items) => (items.length === 1 ? 'vs ' + items[0].jn.rival : items.length + ' partidos');
  const celdaIntervencion = (r) => (r.inc.length ? r.inc.map((i) => `<div class="pl-iv">${e(tratTxt(r.g.inf, i)) || '—'}${i.notas ? '<small>' + e(i.notas) + '</small>' : ''}</div>`).join('') : '—');
  const filaPlantel = (r) => `<tr><td><b>${e(r.g.j.nombre)}</b></td><td>${e(catTxt(r.p))}</td><td class="n">${r.min || '—'}</td><td class="n">${r.inc.length ? '<b>Sí</b>' : 'No'}</td><td>${celdaIntervencion(r)}</td><td class="n">${r.inc.some((i) => i.retiro) ? '<b>Sí</b>' : 'No'}</td></tr>`;
  const THEAD_PL = '<thead><tr><th>Nombre</th><th>Categoría</th><th class="n">Minutos jugados</th><th class="n">Atenciones</th><th>Intervención y comentarios</th><th class="n">Se retiró</th></tr></thead>';
  function cabPartidoPl(x, cont) {
    const jn = x.jn, src = logoSrc(jn), td = K.torneoDePartido && K.torneoDePartido(x.inf, jn.p0), res = resultadosTxt(jn);
    const sub = [jn.fecha ? dia(jn.fecha) + ' ' + fc(jn.fecha) : 'sin fecha', jn.local ? 'Local' : 'Visita', td ? td.txt : jn.torneo, res].filter(Boolean);
    return `<div class="pl-ph"><div class="vs-logos"><img class="sw-vs" src="img/escudo-sw-vs.png" alt=""><b class="vs-t">vs</b>${src ? `<img class="rv-logo" src="${e(src)}" alt="">` : `<span class="rv-ini">${e((jn.rival || '?').slice(0, 1))}</span>`}</div><div class="pl-pt"><h3>${e(jn.rival)}${cont ? ' <small>(continuación)</small>' : ''}</h3><p>${sub.map(e).join(' · ')}</p></div></div>`;
  }
  // Bloques: el resumen y los encabezados son indivisibles ({ html }); la tabla de cada partido ({ x }) se parte solo entre filas completas.
  function bloquesPlantel(d) {
    const r = d.resumen, kpi = (n, t) => `<div class="eq-kpi"><b>${n}</b><span>${t}</span></div>`, out = [];
    out.push({ html: `<div class="eq-kpis">${kpi(r.jugaron, 'jugadores de plantel que jugaron')}${kpi(r.minutos, 'minutos jugados')}${kpi(r.atenciones, 'atenciones')}${kpi(r.intervenciones, 'intervenciones')}</div><div class="eq-kpis eq-kpis-2">${kpi(r.retiraron, 'se retiraron')}${kpi(r.nuevas, 'lesiones o molestias nuevas')}</div>` });
    if (!d.items.length) out.push({ html: '<p class="fj-nota">No hay partidos elegidos.</p>' });
    d.items.forEach((x) => out.push(x.filas.length ? { x } : { html: cabPartidoPl(x, false) + '<p class="fj-nota">Ningún jugador de plantel jugó ni fue atendido en este partido.</p>' }));
    return out;
  }
  const trozoPl = (x, filas, cont) => cabPartidoPl(x, cont) + `<table class="kn-t pl-t">${THEAD_PL}<tbody>${filas.map(filaPlantel).join('')}</tbody></table>`;
  const envolverPl = (b) => `<div class="fj-blq">${b}</div>`;
  // Reparte los bloques en páginas carta midiendo el alto real de cada bloque y de cada fila (nada se corta ni desborda).
  // La primera página lleva el encabezado grande (primer bloque); las demás, uno corto.
  function repartirPl(bloques, cabCorta) {
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;left:-99999px;top:0;width:816px;visibility:hidden;pointer-events:none';
    host.innerHTML = K.rep.pagina('p-resumen p-equipo fj pl', '<h2>Jugadores de plantel</h2><div class="fj-cuerpo"></div>');
    document.body.appendChild(host);
    try {
      const sec = host.firstElementChild, panel = sec.querySelector('.panel'), cuerpo = sec.querySelector('.fj-cuerpo');
      const padB = parseFloat(getComputedStyle(panel).paddingBottom) || 63, top = cuerpo.getBoundingClientRect().top - sec.getBoundingClientRect().top;
      const cap = Math.floor(sec.getBoundingClientRect().height - padB - top) - 10;
      const alto = (n) => Math.ceil(n.getBoundingClientRect().height + (parseFloat(getComputedStyle(n).marginBottom) || 0));
      cuerpo.innerHTML = [{ html: cabCorta }].concat(bloques).map((b) => envolverPl(b.x ? trozoPl(b.x, b.x.filas, false) : b.html)).join('');
      const nodos = Array.from(cuerpo.children), hCab = alto(nodos[0]);
      const med = bloques.map((b, i) => {
        const nodo = nodos[i + 1], m = { h: alto(nodo) };
        if (b.x) {
          const ph = nodo.querySelector('.pl-ph'), th = nodo.querySelector('thead'), filas = Array.from(nodo.querySelectorAll('tbody tr'));
          m.cab = alto(ph) + 1; m.th = Math.ceil(th.getBoundingClientRect().height); m.filas = filas.map((f) => Math.ceil(f.getBoundingClientRect().height) + 1);
          m.extra = m.h - m.cab - m.th - m.filas.reduce((a, v) => a + v, 0); // márgenes y bordes del bloque
        }
        return m;
      });
      const paginas = []; let cur = [], h = 0, primera = true;
      const lim = () => (primera ? cap : cap - hCab);
      const nueva = () => { paginas.push(cur); cur = []; h = 0; primera = false; };
      bloques.forEach((b, i) => {
        const m = med[i];
        if (!b.x) {
          let bh = m.h, html = b.html;
          if (bh > lim()) { html = `<div style="max-height:${lim() - 10}px;overflow:hidden">${b.html}</div>`; bh = lim(); } // más alto que una página (no debería pasar)
          if (cur.length && h + bh > lim()) nueva();
          cur.push(html); h += bh; return;
        }
        let ini = 0; const n = b.x.filas.length;
        while (ini < n) {
          const base = m.cab + m.th + Math.max(0, m.extra);
          let libre = lim() - h - base, fin = ini, acum = 0;
          while (fin < n && acum + m.filas[fin] <= libre) { acum += m.filas[fin]; fin++; }
          const faltan = n - ini, tomadas = fin - ini;
          // al menos 2 filas por trozo (salvo que el partido termine), o se pasa a la página siguiente
          if (cur.length && (tomadas === 0 || (tomadas < Math.min(2, faltan)))) { nueva(); continue; }
          if (!tomadas) fin = ini + 1, acum = m.filas[ini]; // página vacía y ni una fila cabe (no debería pasar)
          cur.push(trozoPl(b.x, b.x.filas.slice(ini, fin), ini > 0)); h += base + acum; ini = fin;
          if (ini < n) nueva();
        }
      });
      if (cur.length || !paginas.length) paginas.push(cur);
      return paginas;
    } finally { host.remove(); }
  }
  // Páginas (textos HTML <section class="pagina">) del informe de los partidos elegidos (claves “idInforme|idJornada”).
  K.plantelPartidosPaginas = function (claves) {
    const d = K.plantelPartidosDatos(claves), per = K.resolverPeriodo(K.state.periodo), n = d.items.length;
    const fechas = d.items.map((x) => x.jn.fecha).filter(Boolean).sort(), rango = fechas.length ? (fechas[0] === fechas[fechas.length - 1] ? fc(fechas[0]) : fc(fechas[0]) + ' al ' + fc(fechas[fechas.length - 1])) : 'sin fecha';
    const ESC = '<img class="sw-vs" src="img/escudo-sw-vs.png" alt="">';
    const titulo = `Informe kinésico · Jugadores de plantel · ${n ? tituloPlantel(d.items) : 'sin partidos'}`;
    const cabGrande = `<div class="fj-cab">${ESC}<div class="fj-cab-t"><h1>${e(titulo)}</h1><p>Santiago Wanderers · ${e(rango)} · ${n} partido${n === 1 ? '' : 's'} · ${e(per.completo)}</p></div></div>`;
    const cabCorta = `<div class="fj-cab fj-cab-c">${ESC}<div class="fj-cab-t"><h1>Informe kinésico · Jugadores de plantel</h1><p>${e(n ? tituloPlantel(d.items) : 'sin partidos')} · ${e(rango)}</p></div></div>`;
    const rp = repartirPl([{ html: cabGrande }].concat(bloquesPlantel(d)), cabCorta), total = rp.length;
    // el encabezado grande es el primer bloque de la primera página; en las demás va el corto
    return rp.map((blqs, i) => K.rep.pagina('p-resumen p-equipo fj pl', `<h2>Jugadores de plantel${i ? ' <small>(continuación)</small>' : ''}</h2><div class="fj-cuerpo">${i ? envolverPl(cabCorta) : ''}${blqs.map(envolverPl).join('')}</div>`)
      .replace('<!--PIE-->', K.rep.PIE(`Jugadores de plantel · ${i + 1} / ${total}`)));
  };
  K.plantelPartidosTitulo = (claves) => { const d = K.plantelPartidosDatos(claves); return `Informe kinésico Jugadores de plantel ${d.items.length === 1 ? 'vs ' + d.items[0].jn.rival : d.items.length + ' partidos'} ${K.resolverPeriodo(K.state.periodo).completo}`; };
  function juntarPartidos(cats, todos, per) {
    const out = [];
    K.state.informes.forEach((inf) => {
      K.jornadas(inf);
      inf.partidos.forEach((p) => {
        const dentro = todos ? true : !!p.cat && cats.includes(Number(p.cat));
        if (dentro && K.partidoEnPeriodo(p, per, inf) && (p.jugado || incs(p).length)) out.push({ inf, p });
      });
    });
    return out.sort((a, b) => (a.p.fecha || '9999').localeCompare(b.p.fecha || '9999') || ((Number(b.p.cat) || 0) - (Number(a.p.cat) || 0)));
  }
  function htmlGeneral(clave) {
    const al = ALCANCES.find((a) => a[0] === clave) || ALCANCES[0], per = K.resolverPeriodo(K.state.periodo), { hbar } = K.bd;
    const lista = juntarPartidos(al[2], clave === 'todas', per), infRef = lista.length ? lista[0].inf : K.inf();
    const r = resumen(infRef, lista.map((x) => x.p));
    const kpi = (n, t) => `<div class="bd-k"><b>${n}</b><span>${t}</span></div>`;
    const resumenDe = (ps) => resumen(infRef, ps);
    const filas = lista.map(({ p }) => { const q = resumenDe([p]); return `<tr><td>${p.fecha ? e(fc(p.fecha)) : '—'}</td><td><b>${e(p.rival)}</b><small>${p.local ? 'Local' : 'Visita'}</small></td><td>${e(catTxt(p))}</td><td class="n">${e(p.res || '—')}</td><td class="n">${q.n}</td><td class="n">${q.jugadores}</td><td class="n">${q.retiros}</td></tr>`; }).join('');
    const cats = Array.from(new Set(lista.map((x) => x.p.cat || 0))).sort((a, b) => b - a);
    const porCat = cats.length > 1 ? `<h2 class="bit-h2">Por categoría</h2><table class="kt"><thead><tr><th>Categoría</th><th>Partidos</th><th>Atenciones</th><th>Jugadores atendidos</th><th>Atendidos en cancha</th><th>Se retiraron</th></tr></thead><tbody>${cats.map((c) => { const ps = lista.filter((x) => (x.p.cat || 0) === c).map((x) => x.p), q = resumenDe(ps); return `<tr><td><b>${c ? 'Sub ' + c : 'Sin categoría'}</b></td><td class="n">${ps.length}</td><td class="n">${q.n}</td><td class="n">${q.jugadores}</td><td class="n">${q.enCancha}</td><td class="n">${q.retiros}</td></tr>`; }).join('')}</tbody></table>` : '';
    const jug = {};
    const get = (id) => jug[id] || (jug[id] = { id, partidos: 0, min: 0, at: 0, ret: 0, cats: new Set() });
    lista.forEach(({ p }) => {
      Object.keys(p.minutos || {}).forEach((id) => { const m = Number(p.minutos[id]) || 0; if (m > 0 && K.jugadorGlobal(id)) { const o = get(id); o.partidos++; o.min += m; if (p.cat) o.cats.add(p.cat); } });
      incs(p).forEach((i) => { if (!K.jugadorGlobal(i.jugadorId)) return; const o = get(i.jugadorId); o.at++; if (i.retiro) o.ret++; if (p.cat) o.cats.add(p.cat); });
    });
    const jf = Object.keys(jug).map((id) => { const g = K.jugadorGlobal(id), o = jug[id]; o.nombre = g.j.nombre; o.cat = catJ(g.j, per); o.les = g.inf.casos.filter((c) => c.jugadorId === id && c.tipo === 'lesion' && K.enPeriodo(c.inicio, per)).length; return o; }).sort((a, b) => (b.min - a.min) || a.nombre.localeCompare(b.nombre, 'es'));
    const tablaJ = jf.length ? `<h2 class="bit-h2">Minutos jugados y lesiones por jugador</h2><table class="kt"><thead><tr><th>Jugador</th><th>Categoría</th><th>Partidos</th><th>Minutos</th><th>Atenc. en partido</th><th>Se retiró</th><th>Lesiones del período</th></tr></thead><tbody>${jf.map((o) => `<tr><td><b>${e(o.nombre)}</b>${o.cats.size > 1 ? `<small>Jugó en ${Array.from(o.cats).sort().map((c) => 'Sub ' + c).join(' y ')}</small>` : ''}</td><td>${e(o.cat)}</td><td class="n">${o.partidos}</td><td class="n">${o.min}</td><td class="n">${o.at}</td><td class="n">${o.ret}</td><td class="n">${o.les}</td></tr>`).join('')}</tbody></table>` : '';
    const nombresInterv = Object.keys(r.interv).map((id) => [(K.trat(infRef, id) || { nombre: id }).nombre, r.interv[id]]).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const zonas = {}; r.lista.forEach((i) => { if (i.zona) { const z = zonaTxt(i.zona); zonas[z] = (zonas[z] || 0) + 1; } });
    const topZ = Object.keys(zonas).map((z) => [z, zonas[z]]).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const obs = lista.filter((x) => lineas(x.p.observaciones).length);
    const conm = K.conmocion ? K.conmocion.filas(lista.map((x) => x.p)) : [];
    const bloqueObs = obs.length ? `<h2 class="bit-h2">Observaciones de los partidos</h2>${obs.map(({ p }) => `<div class="nobr"><p class="pg-obs-t"><b>${e(p.rival)}</b> · ${e(catTxt(p))}${p.fecha ? ' · ' + e(fc(p.fecha)) : ''}</p>${vinetas(p.observaciones)}</div>`).join('')}` : '';
    return `<div class="bit-print kine-print"><header><img class="sw-vs" src="img/escudo-sw-vs.png" alt=""><div><h1>Informe kinésico · Partidos · ${e(al[1])}</h1><p>Santiago Wanderers · ${e(per.completo)} · ${lista.length} partido${lista.length === 1 ? '' : 's'}</p></div></header>
      <div class="bd-kpis">${kpi(lista.length, 'partidos')}${kpi(r.n, 'atenciones')}${kpi(r.jugadores, 'jugadores atendidos')}${kpi(r.retiros, 'se retiraron')}${K.conmocion ? K.conmocion.kpiHTML(conm.length) : ''}</div>
      ${lista.length ? `<div class="bd-g" style="margin-top:10px"><section class="bd-p"><h4>Cuándo ocurrió</h4>${hbar(r.porMom)}</section><section class="bd-p"><h4>Tipo de atención</h4>${hbar(r.porClase, '#2f7a4a')}</section></div>
      <div class="bd-g" style="margin-top:8px"><section class="bd-p"><h4>Intervenciones realizadas</h4>${nombresInterv.length ? hbar(nombresInterv, '#3b5bb5') : '<p class="suave">Sin intervenciones.</p>'}</section><section class="bd-p"><h4>Zonas más frecuentes</h4>${topZ.length ? hbar(topZ, '#e9a93b') : '<p class="suave">Sin zonas registradas.</p>'}</section></div>
      ${porCat}
      <h2 class="bit-h2">Partidos</h2><table class="kt"><thead><tr><th>Fecha</th><th>Rival</th><th>Categoría</th><th>Resultado</th><th>Atenciones</th><th>Jugadores</th><th>Se retiraron</th></tr></thead><tbody>${filas}</tbody></table>
      ${tablaJ}${K.conmocion ? K.conmocion.seccionHTML(conm, { partido: true, breve: true }) : ''}${bloqueObs}` : '<p>No hay partidos jugados en este período.</p>'}</div>`;
  }

  /* ---------- Vista: informe de partido ---------- */
  const jornadaDe = (inf, p) => K.jornadas(inf).find((j) => j.ps.some((x) => x.id === p.id)) || { jid: p.id, ps: [p], p0: p, rival: p.rival, local: p.local, fecha: p.fecha || '', logo: p.logo, logoData: p.logoData, jugado: p.jugado };
  function vistaDe(jn) {
    const v = K.ui.partVista, cats = jn.ps.map((p) => String(p.cat || ''));
    if (v === 'comb' && jn.ps.length > 1) return 'comb';
    if (v && cats.includes(String(v))) return String(v);
    if (jn.ps.length === 1) return cats[0];
    const c = K.ui.cat ? String(K.ui.cat) : '';
    return cats.includes(c) ? c : 'comb';
  }
  const resultadosTxt = (jn) => jn.ps.map((p) => (p.res ? (p.cat ? 'Sub ' + p.cat + ' ' : '') + p.res : '')).filter(Boolean).join(' · ');
  // Paso previo del partido: quiénes están citados + atajo de “Evaluación en cancha rápida”.
  function citadosCard(p, ed) {
    const cit = citadosDe(p), n = cit ? cit.length : 0;
    return `${ed ? `<button type="button" class="hoy-grande pt-eval" data-acc="partEvalRapida" data-id="${e(p.id)}"><span class="mini-ico">${K.ico('svg:atenciones')}</span><span>Evaluación en cancha rápida</span></button>` : ''}
      <div class="card pt-cit" data-citados-card><div class="fila sb wrap gap"><h2 style="margin:0">Citados${cit ? ` <span class="suave" style="font-weight:400">(${n})</span>` : ''}</h2>${ed ? `<button type="button" class="btn${cit ? ' sec' : ''}" data-acc="partCitados" data-id="${e(p.id)}">${cit ? 'Editar citados' : 'Elegir citados'}</button>` : ''}</div>
        <p class="sub" style="margin:6px 0 0" data-cit-res>${cit ? e(citTxt(p)) + '. Los minutos y las atenciones se anotan primero para ellos.' : 'Aún no hay citados definidos: cuentan todos los jugadores de la categoría. Elige los citados para anotar minutos y atenciones más rápido.'}</p></div>`;
  }
  K.pPartidoInforme = function (p0) {
    const inf = K.inf(), jn = jornadaDe(inf, p0), vista = vistaDe(jn);
    const ps = vista === 'comb' ? jn.ps : jn.ps.filter((p) => String(p.cat || '') === vista), p = ps[0];
    const r = resumen(inf, ps), { hbar, panel } = K.bd, ed = K.puedeEditar();
    const nombresInterv = Object.keys(r.interv).map((id) => [(K.trat(inf, id) || { nombre: id }).nombre, r.interv[id]]).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const kpi = (n, t) => `<div class="bd-k"><b>${n}</b><span>${t}</span></div>`;
    const tabs = jn.ps.length > 1 ? `<div style="margin:0 0 12px">${K.seg('partVista', jn.ps.map((x) => [String(x.cat || ''), x.cat ? 'Sub ' + x.cat : 'Partido']).concat([['comb', 'Combinado']]), vista)}</div>` : '';
    const fila = (i) => `<div class="item"${ed ? ` data-acc="partIncEditar" data-id="${i._p.id}" data-inc="${i.id}"` : ''}><span class="pm-tag" style="background:${MOM_COL[i.momento] || '#8a9a90'}">${e(MOM_TXT[i.momento] || '')}${jugando(i.momento) && i.minuto !== '' && i.minuto != null ? `<b>${e(i.minuto)}'</b>` : ''}</span>
          <div class="txt"><b>${e(nomJ(i.jugadorId))}${vista === 'comb' && i._cat ? ` <span class="suave">· Sub ${i._cat}</span>` : ''}</b><span>${minCorrido(i) != null ? `${e(minCorrido(i))}' del partido · ` : ''}${e(K.nombreClase(i.clase))}${i.zona ? ' · ' + e(zonaTxt(i.zona)) : ''} · ${i.enCancha ? 'atendido en cancha' : 'atendido fuera de la cancha'}${tratTxt(inf, i) ? ' · ' + e(tratTxt(inf, i)) : ''}</span>${i.scat5 ? `<div class="cm-chips"><span class="chip g-grave" data-conmocion>Conmoción</span>${i.retiro ? '<span class="chip g-grave">Se retiró</span>' : ''}</div>` : ''}${!i.scat5 && i.reemplazo && i.reemplazo.hecho ? '<div class="cm-chips"><span class="chip g-moderada" data-reemplazo-chip>Reemplazo por lesión</span></div>' : ''}</div>${i.scat5 ? '' : i.retiro ? '<span class="chip g-grave">Se retiró</span>' : ''}</div>`;
    const conm = K.conmocion ? K.conmocion.filas(ps) : [];
    const minutos = vista !== 'comb' ? (() => {
      const cit = citadosDe(p), js = listaMin(inf, p), dur = p.duracion || 90;
      return `<div class="card" data-min-card><div class="fila sb wrap gap"><h2 style="margin:0">Minutos jugados · ${e(catTxt(p))}</h2>${ed ? `<button class="btn sec chico" data-acc="partMinTodos" data-id="${e(p.id)}">Completar con ${dur} a los citados sin minutos</button>` : ''}</div>
        <p class="sub">${cit ? 'Anota los minutos de los citados (déjalo vacío si no jugó). Si jugó alguien que no estaba citado, agrégalo abajo.' : 'Anota los minutos de cada jugador (déjalo vacío si no jugó).'} Sirven para el informe de partidos; no salen en la ficha del jugador.${cit ? '' : ' Este partido no tiene citados definidos: cuentan todos los jugadores de la categoría.'}</p>
        ${js.length ? `<div class="lista">${js.map(({ j, visitante, noCitado }) => `<div class="contador"><span>${e(j.nombre)}${visitante ? ` <small class="suave">(${e(j.categoria || '')}, juega también aquí)</small>` : ''}${noCitado ? ' <small class="suave">(no estaba citado)</small>' : ''}</span><div class="step"><input type="number" inputmode="numeric" min="0" max="130" ${ed ? '' : 'disabled'} data-acc-change="partMin" data-id="${e(p.id)}" data-j="${e(j.id)}" aria-label="Minutos de ${e(j.nombre)}" value="${e((p.minutos || {})[j.id] != null ? p.minutos[j.id] : '')}" placeholder="0"><span class="suave">min</span></div></div>`).join('')}</div>` : cit ? `<p class="vacio-msg">No hay citados en este partido.${ed ? ' Elige los citados arriba.' : ''}</p>` : '<p class="vacio-msg">No hay jugadores de esta categoría. Agrégalos en la pestaña Jugadores.</p>'}
        ${ed && cit ? `<button type="button" class="btn sec" style="margin-top:10px" data-acc="partMinExtra" data-id="${e(p.id)}">+ Agregar jugador que no estaba citado</button>` : ''}</div>`;
    })() : (() => {
      const conMin = ps.map((x) => [x, Object.keys(x.minutos || {}).filter((id) => Number(x.minutos[id]) > 0 && K.jugadorGlobal(id)).sort((a, b) => nomJ(a).localeCompare(nomJ(b), 'es'))]).filter(([, l]) => l.length);
      return conMin.length ? `<div class="card"><h2>Minutos jugados</h2>${conMin.map(([x, l]) => `<p class="sub" style="margin:8px 0 4px"><b>${e(catTxt(x))}</b></p><div class="min-grid">${l.map((id) => `<span>${e(nomJ(id))}</span><b>${x.minutos[id]}'</b>`).join('')}</div>`).join('')}</div>` : '';
    })();
    const obs = vista !== 'comb'
      ? `<div class="card" style="margin-top:12px"><h2>Observaciones del partido</h2><label class="campo"><span>Una por línea; en el PDF salen como viñetas (cancha, clima, jugadores sin molestias, etc.)</span><textarea rows="5" ${ed ? '' : 'disabled'} data-acc-change="partObs" data-id="${e(p.id)}" placeholder="Ej.&#10;Jugador 1er equipo&#10;Sin molestias post partido: Diego Molina">${e(p.observaciones || '')}</textarea></label></div>`
      : `<div class="card" style="margin-top:12px"><h2>Observaciones del partido</h2>${ps.map((x) => `<p class="sub" style="margin:8px 0 4px"><b>${e(catTxt(x))}</b></p>${lineas(x.observaciones).length ? vinetas(x.observaciones) : '<p class="suave">Sin observaciones.</p>'}`).join('')}</div>`;
    return `<div class="titulo-vista"><div class="fila gap"><button class="btn sec chico" data-acc="partVolver">${K.uiIco('atras', 16)} ${K.ui.torneoId ? 'Torneo' : 'Partidos'}</button></div>
        <div class="fila gap wrap"><button class="btn sec chico" data-acc="partPdf" data-id="${e(p.id)}">${K.uiIco('pdf', 16)} PDF</button>${ed && vista !== 'comb' && K.conmocion ? `<button class="btn cm-btn" data-acc="partConmocion" data-id="${e(p.id)}">${K.uiIco('alerta', 18)} Sospecha de conmoción</button>` : ''}${ed && vista !== 'comb' ? `<button class="btn" data-acc="partIncNueva" data-id="${e(p.id)}">${K.uiIco('mas', 18)} Agregar atención</button>` : ''}</div></div>
      <div class="fila gap" style="margin-bottom:10px"><span class="vs-logos"><span class="mini-ico" style="width:52px;height:52px"><img src="img/escudo-sw-vs.png" alt=""></span><b class="vs-t">vs</b><span class="mini-ico" style="width:52px;height:52px">${logo(jn) || `<span class="sin-logo">${e((jn.rival || '?').slice(0, 1))}</span>`}</span></span><div><h1 style="font-family:Caladea,serif;font-size:23px;color:var(--verde-2)">Informe kinésico · Partido · vs ${e(jn.rival)}</h1><div class="suave">${jn.fecha ? e(dia(jn.fecha)) + ' ' + e(fc(jn.fecha)) + ' · ' : ''}${jn.local ? 'Local' : 'Visita'}${resultadosTxt(jn) ? ' · ' + e(resultadosTxt(jn)) : ''}${jn.jugado ? '' : ' · por jugar'}${(() => { const td = K.torneoDePartido && K.torneoDePartido(inf, jn.p0); return td ? ` · <a href="#" data-acc="torneoAbrir" data-id="${e(td.t.id)}">${e(td.txt)}</a>` : jn.torneo ? ' · ' + e(jn.torneo) : ''; })()}</div></div></div>
      ${tabs}
      ${vista === 'comb' ? '<p class="suave" style="margin:0 0 10px">Informe combinado: todas las categorías de este día juntas. Para agregar atenciones, minutos u observaciones elige una categoría arriba.</p>' : ''}
      ${vista !== 'comb' ? citadosCard(p, ed) : ''}
      <div class="bd-kpis">${kpi(r.n, 'atenciones')}${kpi(r.jugadores, 'jugadores atendidos')}${kpi(r.enCancha, 'atendidos en cancha')}${kpi(r.retiros, 'se retiraron del partido')}${conm.length ? kpi(conm.length, 'conmociones') : ''}</div>
      <div class="card"><h2>Atenciones del partido</h2>
        ${r.lista.length ? `<div class="lista">${r.lista.map(fila).join('')}</div>` : `<p class="vacio-msg">Aún no hay atenciones en este partido.${ed && vista !== 'comb' ? ' Toca <b>Agregar atención</b> para registrar la primera.' : ''}</p>`}</div>
      ${conm.length ? `<div class="card cm-card" data-conm-card><div class="fila sb wrap gap"><h2 style="margin:0">Conmociones cerebrales (SCAT5)</h2>${K.conmocion.botonTodasHTML(conm, 'Informe SCAT5 vs ' + jn.rival + (jn.fecha ? ' ' + jn.fecha : ''))}</div><p class="sub">${e(K.conmocion.AVISO)} Aquí va el resumen; cada jugador tiene su informe SCAT5 completo.</p><div class="kt-scroll">${K.conmocion.tablaHTML(conm, { partido: vista === 'comb', breve: true, botones: true })}</div></div>` : ''}
      ${r.n ? `<div class="bd-g">${panel('Cuándo ocurrió', hbar(r.porMom))}${panel('Tipo de atención', hbar(r.porClase, '#2f7a4a'))}${panel('Intervenciones realizadas', hbar(nombresInterv, '#3b5bb5'))}</div>` : ''}
      ${K.torneos && K.torneos.antidopajeHTML ? (vista !== 'comb' ? K.torneos.antidopajeHTML(inf, p, ed) : K.torneos.antidopajeResumen(ps)) : ''}${minutos}
      ${obs}
      <div class="card" style="margin-top:12px"><h2>Datos del informe</h2><label class="campo"><span>Informe realizado por / partido cubierto por</span><input type="text" ${ed ? '' : 'disabled'} value="${e(p.realizadoPor || '')}" placeholder="${e(K.state.ultimoInformante || 'Ej. Benjamín Rojas')}" data-acc-change="partPor" data-id="${e(p.id)}"></label>
        <div class="fila gap wrap">${ed ? `<button class="btn sec chico" data-acc="editPartido" data-id="${e(jn.jid)}">Editar datos del partido</button>` : ''}</div></div>`;
  };

  /* ---------- Formulario de una incidencia ---------- */
  function formInc(p, rec) {
    const inf = K.inf();
    const cand = K.jugadoresDePartido(inf, p);
    if (!cand.length) { K.aviso('Primero agrega jugadores de esta categoría', true); return; }
    const trat = rec ? rec.trat || {} : {}, mom0 = rec ? rec.momento : 't1';
    const citP = citadosDe(p), principal = citP ? Array.from(new Set(citP.concat(jugaronDe(p)))) : null; // con citados, el selector muestra primero a los citados y a quienes jugaron
    const lbl = (t) => `<span class="lbl">${t}</span>`;
    const casosDe = (jid, sel) => { const g = K.jugadorGlobal(jid); return '<option value="">—</option>' + (g ? g.inf.casos.filter((c) => c.jugadorId === jid).sort((a, b) => (b.inicio || '').localeCompare(a.inicio || '')).map((c) => `<option value="${c.id}"${sel === c.id ? ' selected' : ''}>${e(c.titulo)} · ${e(fc(c.inicio))}</option>`).join('') : ''); };
    K.modal({
      titulo: (rec ? 'Editar atención' : 'Atención en partido') + ' · ' + p.rival + (p.cat ? ' · Sub ' + p.cat : ''),
      cuerpo: `
        ${!rec && K.conmocion ? `<button type="button" class="btn cm-btn" data-cm-abrir>${K.uiIco('alerta', 20)} Sospecha de conmoción cerebral</button>` : ''}
        <div class="campo"><span class="lbl-j">Jugador</span>${K.selJugador('jugadorId', { lista: K.itemsSelJ(cand.map(({ j, visitante }) => ({ j, sub: [j.categoria, j.posicion].filter(Boolean).join(' · ') + (visitante ? ' (juega también aquí)' : '') })).concat(rec && !cand.some((c) => c.j.id === rec.jugadorId) && K.jugadorGlobal(rec.jugadorId) ? [{ j: K.jugadorGlobal(rec.jugadorId).j }] : [])), sel: rec ? rec.jugadorId : '', principal, principalTxt: 'citados' })}</div>
        <div class="campo">${lbl('¿Cuándo ocurrió?')}${K.seg('momento', MOMENTOS, mom0)}</div>
        <label class="campo ${jugando(mom0) ? '' : 'oculto'}" data-blq="min"><span>Minuto del tiempo (0 a ${mitad(p) + 15})</span><input type="number" inputmode="numeric" min="0" max="${mitad(p) + 15}" name="minuto" value="${rec && rec.minuto != null ? e(rec.minuto) : ''}" placeholder="Ej. 38"><small class="suave" data-conv></small></label>
        <div class="grid2">
          <label class="campo"><span>Tipo de atención</span><select name="clase">${K.opts(K.CLASES_ATENCION, rec ? rec.clase : 'molestia')}</select></label>
          <div class="campo">${lbl('¿Atendido en cancha?')}${K.seg('enCancha', [['si', 'Sí'], ['no', 'No']], rec ? (rec.enCancha ? 'si' : 'no') : jugando(mom0) ? 'si' : 'no')}</div>
        </div>
        <div class="grid2">
          <div class="campo">${lbl('Mecanismo')}${K.seg('mec', MECANISMOS, rec ? rec.mec || 'na' : 'contacto')}</div>
          <label class="campo"><span>Zona del cuerpo (opcional)</span><select name="zona"><option value="">—</option>${Object.keys(K.ZONAS).map((z) => `<option value="${z}"${rec && rec.zona === z ? ' selected' : ''}>${e(zonaTxt(z))}</option>`).join('')}</select></label>
        </div>
        <div class="campo ${jugando(mom0) ? '' : 'oculto'}" data-blq="retiro">${lbl('¿Tuvo que retirarse del partido?')}${K.seg('retiro', [['no', 'No'], ['si', 'Sí']], rec && rec.retiro ? 'si' : 'no')}</div>
        <h3 style="margin:6px 0 4px;font-size:15px">Intervención realizada</h3>
        <p class="suave" style="margin:0 0 6px">Si solo entraste a evaluarlo y siguió jugando, usa <b>Evaluación en cancha</b>.</p>
        <div>${inf.tratamientos.map((t) => K.contador(t.id, t.nombre, t.icono, trat[t.id] || 0)).join('')}</div>
        <label class="campo" style="margin-top:10px"><span>Lesión o molestia asociada (opcional)</span><select name="casoId">${rec ? casosDe(rec.jugadorId, rec.casoId) : '<option value="">—</option>'}</select></label>
        <label class="campo"><span>Comentarios</span><textarea name="notas">${e(rec ? rec.notas || '' : '')}</textarea></label>
        ${p.torneoId && K.torneos && K.torneos.reemplazoCampos && !(rec && rec.scat5) ? K.torneos.reemplazoCampos(rec) : ''}
        <p class="suave">Esto cuenta también como una atención del jugador en los totales del informe y, si es una molestia, queda registrada como molestia del partido (en el informe de la categoría donde se juega el partido).</p>`,
      botones: [
        rec ? { txt: 'Eliminar', cls: 'peligro', fn: () => { K.conDeshacer('Atención del partido eliminada', () => { quitar(p, rec); }); } } : { txt: 'Cancelar', cls: 'sec' },
        {
          txt: 'Guardar',
          fn: (m, hoja) => {
            const d = K.datos(hoja), momento = K.segValor(hoja, 'momento') || 't1';
            if (!d.jugadorId) { K.aviso('Elige un jugador', true); return false; }
            const tr = {}; hoja.querySelectorAll('.contador').forEach((c) => { const n = Number(c.querySelector('[data-n]').value) || 0; if (n > 0) tr[c.dataset.cont] = n; });
            const campos = {
              jugadorId: d.jugadorId, momento, minuto: jugando(momento) && d.minuto !== '' ? Number(d.minuto) : '', clase: d.clase, enCancha: K.segValor(hoja, 'enCancha') === 'si',
              mec: K.segValor(hoja, 'mec') || 'na', zona: d.zona || '', retiro: jugando(momento) && K.segValor(hoja, 'retiro') === 'si', trat: tr, casoId: d.clase === 'molestia' ? d.casoId || '' : '', notas: (d.notas || '').trim()
            };
            let inc = rec;
            if (rec) Object.assign(rec, campos); else { inc = Object.assign({ id: K.uid() }, campos); incs(p).push(inc); }
            if (!inc.scat5 && K.torneos && K.torneos.reemplazoLeer) K.torneos.reemplazoLeer(hoja, inc); // reemplazo por lesión (solo partidos de un torneo)
            sincronizar(p, inc);
            K.guardar(); K.aviso('Guardado'); K.render();
          }
        }
      ],
      alMontar: (m, hoja) => {
        const sel = hoja.querySelector('[name=jugadorId]'), cas = hoja.querySelector('[name=casoId]');
        const conv = hoja.querySelector('[data-conv]'), inMin = hoja.querySelector('[name=minuto]');
        const actConv = () => { const m = K.segValor(hoja, 'momento'); conv.textContent = m === 't2' && inMin.value !== '' ? `= minuto ${mitad(p) + Number(inMin.value)}' del partido` : m === 't2' ? `El minuto se cuenta desde el inicio del 2.º tiempo (el 83' del partido = minuto 38 del 2.º tiempo).` : ''; };
        inMin.addEventListener('input', actConv); hoja.addEventListener('seg', actConv);
        const ajustar = () => { actConv(); const j = jugando(K.segValor(hoja, 'momento')); hoja.querySelector('[data-blq=min]').classList.toggle('oculto', !j); hoja.querySelector('[data-blq=retiro]').classList.toggle('oculto', !j); };
        hoja.addEventListener('seg', (ev) => {
          if (ev.target.dataset.seg !== 'momento') return;
          ajustar();
          if (!rec) K.segSet(hoja, 'enCancha', jugando(ev.detail) ? 'si' : 'no');
        });
        sel.addEventListener('change', () => { cas.innerHTML = casosDe(sel.value); });
        const bc = hoja.querySelector('[data-cm-abrir]');
        if (bc) bc.addEventListener('click', () => { // lo ya anotado (jugador, cuándo y minuto) pasa al formulario de conmoción
          const momento = K.segValor(hoja, 'momento') || 't1', mn = inMin.value;
          m.cerrar(); K.conmocion.form(p, null, { jugadorId: sel.value, momento, minuto: jugando(momento) && mn !== '' ? Number(mn) : '' });
        });
      }
    });
  }
  /* ---------- Citados del partido ---------- */
  // Partido anterior de la misma categoría que tenga citados (el más reciente antes de la fecha de este).
  function partidoPrevioConCitados(p) {
    const inf = K.inf();
    const l = inf.partidos.filter((x) => x !== p && Number(x.cat) === Number(p.cat) && citadosDe(x) && (!p.fecha || !x.fecha || x.fecha < p.fecha));
    l.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    return l[0] || null;
  }
  K.partidoPrevioConCitados = partidoPrevioConCitados;
  function formCitados(p) {
    const inf = K.inf(), cand = K.jugadoresDePartido(inf, p), cit0 = new Set(citadosDe(p) || []);
    if (!cand.length) { K.aviso('Primero agrega jugadores de esta categoría', true); return; }
    const est = K.estadoJugadores ? K.estadoJugadores() : null, lesionado = (j) => !!(est && K.esLesionado && K.esLesionado(est, j));
    const filas = cand.map(({ j, visitante }) => ({ j, id: j.id, les: lesionado(j), sub: [j.categoria, j.posicion].filter(Boolean).join(' · ') + (visitante ? ' (juega también aquí)' : '') }));
    const previo = partidoPrevioConCitados(p);
    K.modal({
      titulo: 'Citados · ' + p.rival + (p.cat ? ' · Sub ' + p.cat : ''),
      cuerpo: `<div class="vj-barra"><b class="vj-cont" data-ct-cont aria-live="polite">0 citados</b>
          <input type="search" data-ct-q placeholder="Buscar jugador…" autocomplete="off" aria-label="Buscar entre los jugadores">
          <div class="vj-atajos"><button type="button" class="th-chip" data-ct="todos">Marcar todos</button><button type="button" class="th-chip" data-ct="ninguno">Ninguno</button><button type="button" class="th-chip" data-ct="sinles">Quitar lesionados</button><button type="button" class="th-chip" data-ct="previo">Copiar citados del partido anterior</button></div></div>
        <div class="vj-lista" data-ct-lista>${filas.map((x) => `<label class="vj-fila" data-n="${e(K.norm(x.j.nombre))}" data-les="${x.les ? 1 : 0}"><span class="vj-caja"><input type="checkbox" data-ct-j value="${e(x.id)}"${cit0.has(x.id) ? ' checked' : ''}></span><span class="txt"><b>${e(x.j.nombre)}</b>${x.sub ? `<small>${e(x.sub)}</small>` : ''}</span>${x.les ? '<i class="chip g-grave etq">Lesionado</i>' : ''}</label>`).join('')}</div>
        <p class="vacio-msg oculto" data-ct-nada>Nadie coincide con la búsqueda.</p>
        ${citadosDe(p) ? '<p style="margin:12px 0 0"><button type="button" class="btn ghost chico" data-ct="quitar">Quitar la lista de citados (volver a contar con todos)</button></p>' : ''}`,
      botones: [{ txt: 'Cancelar', cls: 'sec' }, {
        txt: 'Guardar citados',
        fn: (m, hoja) => {
          const ids = Array.from(hoja.querySelectorAll('[data-ct-j]:checked')).map((x) => x.value);
          p.citados = ids; K.guardar(); K.aviso(ids.length === 1 ? '1 citado guardado' : ids.length + ' citados guardados'); K.render();
        }
      }],
      alMontar: (m, hoja) => {
        const caja = hoja.querySelector('[data-ct-lista]'), fs = () => Array.from(caja.querySelectorAll('.vj-fila')), vis = (f) => !f.classList.contains('oculto');
        const poner = (f, on) => { f.querySelector('[data-ct-j]').checked = on; };
        const contar = () => { const n = caja.querySelectorAll('[data-ct-j]:checked').length; hoja.querySelector('[data-ct-cont]').textContent = n === 1 ? '1 citado' : n + ' citados'; };
        caja.addEventListener('change', (ev) => { if (ev.target.matches('[data-ct-j]')) contar(); });
        hoja.querySelector('[data-ct-q]').addEventListener('input', (ev) => {
          const tk = K.norm(ev.target.value).split(' ').filter(Boolean);
          fs().forEach((f) => f.classList.toggle('oculto', !tk.every((t) => f.dataset.n.includes(t))));
          hoja.querySelector('[data-ct-nada]').classList.toggle('oculto', fs().some(vis));
        });
        hoja.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-ct]'); if (!b) return;
          const a = b.dataset.ct;
          if (a === 'quitar') { m.cerrar(); K.conDeshacer('Lista de citados quitada', () => { delete p.citados; }); return; }
          if (a === 'ninguno') fs().forEach((f) => poner(f, false));
          else if (a === 'todos') fs().filter(vis).forEach((f) => poner(f, true));
          else if (a === 'sinles') fs().forEach((f) => { if (f.dataset.les === '1') poner(f, false); });
          else if (a === 'previo') {
            if (!previo) { K.aviso('Todavía no hay un partido anterior de esta categoría con citados', true); return; }
            const ids = new Set(previo.citados);
            let n = 0; fs().forEach((f) => { const on = ids.has(f.querySelector('[data-ct-j]').value); poner(f, on); if (on) n++; });
            K.aviso(`Copiados ${n} citados de ${previo.rival}${previo.fecha ? ' (' + fc(previo.fecha) + ')' : ''}`);
          }
          contar();
        });
        contar();
      }
    });
  }

  /* ---------- Evaluación en cancha rápida: partido → jugador → minuto → “Siguió” / “Se retiró” (4 toques) ---------- */
  function formEvalRapida(p) {
    const inf = K.inf(), cit = citadosDe(p), cand = K.jugadoresDePartido(inf, p);
    if (!cand.length && !(cit && cit.length)) { K.aviso('Primero agrega jugadores de esta categoría', true); return; }
    const principal = cit ? new Set(cit.concat(jugaronDe(p))) : null;
    const todos = K.itemsSelJ(cand.map(({ j, visitante }) => ({ j, sub: [j.categoria, j.posicion].filter(Boolean).join(' · ') + (visitante ? ' (juega también aquí)' : '') })));
    (principal ? Array.from(principal) : []).forEach((id) => { if (!todos.some((x) => x.jid === id)) { const g = K.jugadorGlobal(id); if (g) todos.push(K.itemsSelJ([g.j])[0]); } });
    todos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const hayPri = !!principal && todos.some((x) => principal.has(x.jid)) && todos.some((x) => !principal.has(x.jid));
    const mt = mitad(p);
    K.modal({
      titulo: 'Evaluación en cancha · ' + p.rival + (p.cat ? ' · Sub ' + p.cat : ''),
      cuerpo: `<input type="hidden" data-ev-j>
        <div class="selj-top"><input type="search" class="selj-q" data-ev-q placeholder="Buscar jugador…" autocomplete="off" aria-label="Buscar jugador">
          ${hayPri ? `<div class="selj-chips"><button type="button" class="th-chip" data-ev-todos aria-pressed="false">Ver toda la categoría <small>${todos.length}</small></button><span class="suave">Mostrando citados y quienes jugaron</span></div>` : ''}</div>
        <div class="selj-lista ev-lista" data-ev-lista></div>
        <div class="grid2" style="margin-top:10px"><label class="campo"><span>Minuto del partido (opcional)</span><input type="number" inputmode="numeric" min="0" max="${Math.round(mt * 2) + 30}" data-ev-min placeholder="Ej. 63"></label>
          <div class="campo"><span class="lbl">Se registra como</span><small class="suave" data-ev-conv style="display:block;min-height:42px;padding-top:10px">1.er tiempo</small></div></div>
        <label class="campo"><span>Nota (opcional)</span><input type="text" data-ev-nota placeholder="Ej. golpe en el muslo, siguió sin molestias" autocomplete="off" maxlength="200"></label>
        <div class="ev-res"><button type="button" class="btn ev-sigue" data-ev-res="sigue">${K.uiIco('ok', 22)} Siguió jugando</button><button type="button" class="btn peligro ev-retiro" data-ev-res="retiro">${K.uiIco('cerrar', 22)} Se retiró</button></div>
        ${K.conmocion ? `<button type="button" class="btn cm-btn ev-conm" data-ev-conm>${K.uiIco('alerta', 20)} Sospecha de conmoción cerebral</button>` : ''}
        <p class="suave" style="margin:10px 0 0">Registra la evaluación en cancha del jugador (intervención “Evaluación en cancha”), igual que al agregar una atención. Podrás deshacerlo por unos segundos.</p>`,
      botones: [{ txt: 'Cancelar', cls: 'sec' }],
      alMontar: (m, hoja) => {
        let q = '', ver = !hayPri, sel = '';
        const lista = hoja.querySelector('[data-ev-lista]'), inMin = hoja.querySelector('[data-ev-min]'), conv = hoja.querySelector('[data-ev-conv]');
        const base = () => (ver ? todos : todos.filter((x) => principal.has(x.jid) || x.jid === sel));
        const pintar = () => {
          const tk = K.norm(q).split(' ').filter(Boolean), v = base().filter((x) => { const n = x._n || (x._n = K.norm(x.nombre + ' ' + (x.sub || ''))); return tk.every((t) => n.includes(t)); });
          lista.innerHTML = v.length ? v.map((x) => `<button type="button" class="selj-fila${x.jid === sel ? ' on' : ''}" data-ev-pick="${e(x.jid)}" aria-pressed="${x.jid === sel}"><span class="avatar">${e((x.nombre || '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase())}</span><span class="txt"><b>${e(x.nombre)}</b>${x.sub ? `<small>${e(x.sub)}</small>` : ''}</span>${x.les ? '<i class="chip g-grave etq">Lesionado</i>' : ''}</button>`).join('')
            : `<p class="vacio-msg">Nadie coincide con la búsqueda.${hayPri && !ver ? ' <button type="button" class="btn sec chico" data-ev-todos>Buscar en toda la categoría</button>' : ''}</p>`;
        };
        const dividir = () => { const v = inMin.value.trim(); if (v === '' || isNaN(Number(v))) return { momento: 't1', minuto: '' }; const n = Math.max(0, Math.floor(Number(v))); return n > mt ? { momento: 't2', minuto: n - mt } : { momento: 't1', minuto: n }; };
        const actConv = () => { const d = dividir(); conv.textContent = d.minuto === '' ? '1.er tiempo (sin minuto)' : `${d.momento === 't1' ? '1.er' : '2.º'} tiempo · min ${d.minuto}'`; };
        pintar(); actConv();
        inMin.addEventListener('input', actConv);
        hoja.querySelector('[data-ev-q]').addEventListener('input', (ev) => { q = ev.target.value; pintar(); });
        hoja.addEventListener('click', (ev) => {
          const pk = ev.target.closest('[data-ev-pick]');
          if (pk) { sel = pk.dataset.evPick; pintar(); try { inMin.focus({ preventScroll: true }); } catch (x) { /* nada */ } return; }
          const tg = ev.target.closest('[data-ev-todos]');
          if (tg) { ver = true; const b = hoja.querySelector('.selj-chips'); if (b) b.remove(); pintar(); return; }
          const cm = ev.target.closest('[data-ev-conm]');
          if (cm) { if (!sel) { K.aviso('Elige un jugador', true); return; } const d0 = dividir(); m.cerrar(); K.conmocion.form(p, null, { jugadorId: sel, momento: d0.momento, minuto: d0.minuto }); return; }
          const r = ev.target.closest('[data-ev-res]'); if (!r) return;
          if (!sel) { K.aviso('Elige un jugador', true); return; }
          const d = dividir(), retiro = r.dataset.evRes === 'retiro', nota = hoja.querySelector('[data-ev-nota]').value.trim();
          m.cerrar();
          K.conDeshacer('Evaluación en cancha registrada', () => {
            const inc = {
              id: K.uid(), jugadorId: sel, momento: d.momento, minuto: d.minuto, clase: 'molestia', enCancha: true, mec: 'na', zona: '', retiro,
              trat: inf.tratamientos.some((t) => t.id === 'evalcancha') ? { evalcancha: 1 } : {}, casoId: '', notas: nota
            };
            incs(p).push(inc); sincronizar(p, inc);
          }, { quitarNuevos: true, restaurado: 'Evaluación deshecha' });
        });
      }
    });
  }

  // Cada incidencia queda también como una atención del jugador y, si es una molestia, como molestia (con la categoría del partido:
  // si el jugador es de otra categoría, cuenta en el informe de la categoría donde jugó, no en el de la suya).
  const MOM_CASO = { pre: 'pre', t1: 'durante', et: 'entretiempo', t2: 'durante', post: 'post' };
  function quitarAuto(inc) {
    if (!inc.casoAutoId) return;
    K.state.informes.forEach((i) => { i.casos = i.casos.filter((c) => c.id !== inc.casoAutoId); });
    inc.casoAutoId = '';
  }
  function sincronizar(p, inc) {
    let previa = null;
    if (inc.atencionId) K.state.informes.forEach((i) => { const k = i.atenciones.findIndex((x) => x.id === inc.atencionId); if (k >= 0) { previa = i.atenciones[k]; i.atenciones.splice(k, 1); } });
    const g = K.jugadorGlobal(inc.jugadorId); if (!g) return;
    const fecha = p.fecha || K.hoy();
    const tor = p.torneoId ? K.state.informes.map((i) => (i.torneos || []).find((t) => t.id === p.torneoId)).find(Boolean) || null : null; // torneo del partido: si es de viaje, la atención nace “En gira”
    // Molestia del partido (si no se eligió una ya existente, se crea sola y se actualiza al editar)
    let casoId = inc.casoId || '';
    const conm = !!(inc.scat5 && K.conmocion); // sospecha de conmoción cerebral (SCAT5): queda como lesión “Conmoción cerebral (sospecha)” en la cabeza
    if (inc.clase === 'molestia' && !inc.casoId) {
      let c = inc.casoAutoId && K.buscarCaso(inc.casoAutoId);
      if (c && K.jugadorGlobal(c.jugadorId) && c.jugadorId !== inc.jugadorId) { quitarAuto(inc); c = null; }
      const campos = {
        jugadorId: inc.jugadorId, tipo: conm ? 'lesion' : 'molestia', titulo: conm ? K.conmocion.TITULO : inc.zona ? 'Molestia ' + zonaTxt(inc.zona).toLowerCase() : 'Molestia en partido',
        contexto: `partido vs ${p.rival}`, gravedad: (c && c.gravedad) || 'pordefinir', zonas: conm ? ['cabeza'] : inc.zona ? [inc.zona] : [], inicio: fecha,
        mecanismo: 'partido', momento: MOM_CASO[inc.momento] || '', abandono: jugando(inc.momento) ? (inc.retiro ? 'si' : 'no') : '',
        limita: conm ? '' : 'no', catJuego: p.cat ? Number(p.cat) : null, partidoId: p.id, incId: inc.id, auto: true
      };
      if (conm) campos.conmocion = true;
      campos.tituloAuto = campos.titulo;
      if (c && c.titulo && c.tituloAuto && c.titulo !== c.tituloAuto) campos.titulo = c.titulo; // el nombre que le diste se respeta
      if (tor) campos.torneoId = tor.id;
      if (c) { Object.assign(c, campos); if (!tor) delete c.torneoId; } else { c = Object.assign({ id: K.uid(), alta: '', semanas: '', notas: '' }, campos); g.inf.casos.push(c); inc.casoAutoId = c.id; }
      if (conm) K.conmocion.rtpIniciar(c, inc.scat5.rtpInicio); // la fecha del plan de retorno gradual va en la etapa 1
      casoId = c.id;
    } else quitarAuto(inc);
    const a = Object.assign({ id: inc.atencionId || K.uid() }, previa || {}, {
      fecha, jugadorId: inc.jugadorId, casoId, trat: Object.assign({}, inc.trat), origen: tor && tor.viaje ? 'gira' : 'ssw', clase: inc.clase, partidoId: p.id, incId: inc.id, catJuego: p.cat ? Number(p.cat) : null,
      temporada: (previa && previa.temporada) || K.ui.ultTemporada || (Number(fecha.slice(5, 7)) <= 6 ? 'camp1' : 'camp2'),
      notas: `Partido vs ${p.rival}${p.cat ? ' (Sub ' + p.cat + ')' : ''} · ${momTxt(inc, p)}${inc.enCancha ? ' · en cancha' : ''}${inc.retiro ? ' · se retiró del partido' : ''}${conm ? ' · sospecha de conmoción cerebral' : ''}${inc.notas ? ' · ' + inc.notas : ''}`
    });
    if (tor) a.torneoId = tor.id; else delete a.torneoId;
    g.inf.atenciones.push(a); inc.atencionId = a.id;
  }
  function quitar(p, inc) {
    p.incidencias = incs(p).filter((x) => x.id !== inc.id);
    quitarAuto(inc);
    if (inc.atencionId) K.state.informes.forEach((i) => { i.atenciones = i.atenciones.filter((a) => a.id !== inc.atencionId); });
  }
  K.part = { logo, resChips, catTxt, incs, sincronizar, quitar, mitad, jugando, citadosDe, jugaronDe, MOMENTOS, momTxt };
  K.quitarPartidoYAtenciones = (inf, p) => {
    K.state.informes.forEach((i) => { i.atenciones = i.atenciones.filter((a) => a.partidoId !== p.id); i.casos = i.casos.filter((c) => !(c.auto && c.partidoId === p.id)); });
    inf.partidos = inf.partidos.filter((x) => x.id !== p.id);
  };

  /* ---------- Formulario del partido (un rival + las categorías que juegan) ---------- */
  const LOGOS = K.CALENDARIO_BASE.map((p) => [p[1], p[0]]);
  // Torneos especiales ya usados (para sugerirlos al cargar otro partido del mismo torneo).
  const torneosGuardados = () => { const s = new Set(); K.state.informes.forEach((i) => (i.partidos || []).forEach((p) => { if (p.torneo) s.add(p.torneo); })); return [...s].sort((a, b) => a.localeCompare(b, 'es')); };
  K.torneosGuardados = torneosGuardados;
  const puedeCrearTorneo = () => !!K.formTorneo;
  K.formPartido = function (jn, opt) {
    opt = opt || {};
    const inf = K.inf(), g = K.grupoDe(K.ui.cat), cats = (g ? g.cats : [15, 16, 18, 20]).slice().sort((a, b) => b - a), rec = jn ? jn.p0 : null;
    const tors = () => { const ord = { 'En curso': 0, Planificado: 1, Terminado: 2 }; return (inf.torneos || []).slice().sort((a, b) => ord[K.torneos.estado(a)] - ord[K.torneos.estado(b)] || a.nombre.localeCompare(b.nombre, 'es')); };
    const tor0 = K.torneos.buscar(inf, rec ? rec.torneoId : opt.torneoId), fase0 = rec ? rec.fase || '' : opt.fase || '';
    const textoSolo = !!(rec && rec.torneo && !K.torneos.buscar(inf, rec.torneoId)); // torneo escrito a mano sin ficha (caso raro): se conserva si no lo cambias
    const hoyISO = K.hoy(), delTorneo = !jn && !!tor0; // en el torneo, los partidos nuevos nacen “por jugar” (se marcan jugados si la fecha ya pasó)
    const catTor = tor0 && !jn ? new Set(K.torneos.catsDe(tor0, inf)) : null;
    let logoData = rec ? rec.logoData || '' : '';
    const por = (c) => (jn ? jn.ps.find((p) => Number(p.cat) === c) : null);
    const legacy = jn ? jn.ps.filter((p) => !p.cat) : [];
    const fechaOk = (v) => v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 1990);
    const guardarForm = (hoja, otro) => {
            const d = K.datos(hoja);
            if (!d.rival.trim()) { K.aviso('Escribe el nombre del rival', true); return false; }
            if (d.fecha && !fechaOk(d.fecha)) { K.aviso('Revisa el año de la fecha', true); return false; }
            const marcadas = cats.filter((c) => d['c' + c]);
            if (!marcadas.length && !legacy.length) { K.aviso('Marca al menos una categoría', true); return false; }
            const tSel = d.torneoId === '__texto' ? null : K.torneos.buscar(inf, d.torneoId), conservaTexto = d.torneoId === '__texto';
            const comunes = { rival: d.rival.trim(), logo: d.logo, logoData, local: K.segValor(hoja, 'local') === '1', fecha: d.fecha, duracion: Number(d.duracion) || 90 };
            if (conservaTexto) comunes.torneo = rec.torneo; // el torneo escrito a mano (sin ficha) no se toca
            const jid = jn ? jn.jid : K.uid(); let bloqueo = '';
            legacy.forEach((p) => { const c = Number(d['lg' + p.id]); if (c) p.cat = c; });
            const existentes = jn ? jn.ps.slice() : [], nuevos = [];
            existentes.forEach((p) => {
              Object.assign(p, comunes);
              if (!p.cat) return;
              if (!d['c' + p.cat]) {
                if (incs(p).length || Object.keys(p.minutos || {}).length || p.observaciones) { bloqueo = `Sub ${p.cat} tiene datos; no se quitó.`; return; }
                K.quitarPartidoYAtenciones(inf, p); return;
              }
              p.res = (d['r' + p.cat] || '').trim(); p.jugado = !!d['j' + p.cat];
            });
            marcadas.forEach((c) => {
              if (existentes.some((p) => Number(p.cat) === c)) return;
              const np = Object.assign({ id: K.uid(), jid, cat: c, minutos: {}, notas: '', incidencias: [], observaciones: '', res: (d['r' + c] || '').trim(), jugado: !!d['j' + c], torneo: '' }, comunes);
              inf.partidos.push(np); nuevos.push(np);
            });
            if (!conservaTexto) inf.partidos.filter((p) => p.jid === jid || existentes.includes(p) || nuevos.includes(p)).forEach((p) => K.torneos.aplicarAPartido(inf, p, tSel ? tSel.id : '', tSel ? d.fase || '' : ''));
            const fuera = tSel && d.fecha && ((tSel.desde && d.fecha < tSel.desde) || (tSel.hasta && d.fecha > tSel.hasta));
            K.guardar(); K.aviso((bloqueo || 'Partido guardado') + (fuera ? ' · ojo: la fecha está fuera de las fechas del torneo' : '')); K.render();
            if (otro) K.ui.partidoId = null;
            return true;
    };
    K.modal({
      titulo: jn ? 'Partido' : 'Nuevo partido',
      cuerpo: `
        <label class="campo"><span>Rival</span><input type="text" name="rival" value="${e(rec ? rec.rival : '')}" autocomplete="off"></label>
        <div class="grid2">
          <label class="campo"><span>Escudo</span><select name="logo"><option value="">Sin escudo</option>${K.opts(LOGOS, rec ? rec.logo : '')}</select></label>
          <div class="campo"><span style="display:block;font-size:13px;font-weight:600;color:var(--suave);margin-bottom:4px">…o sube uno propio</span><label class="btn sec chico" style="cursor:pointer">${K.uiIco('subir', 16)} Elegir imagen<input type="file" accept="image/*" hidden data-logo></label><span class="suave" data-logo-ok>${logoData ? ' ✓ cargado' : ''}</span></div>
        </div>
        <div class="grid2" data-torneo-campos>
          <label class="campo"><span>Torneo</span><select name="torneoId"><option value="">Sin torneo · campeonato normal</option>${textoSolo ? `<option value="__texto" selected>${e(rec.torneo)} (sin ficha)</option>` : ''}${tors().map((t) => `<option value="${e(t.id)}"${!textoSolo && tor0 && tor0.id === t.id ? ' selected' : ''}>${e(t.nombre)}${K.torneos.estado(t) === 'Terminado' ? ' (terminado)' : ''}</option>`).join('')}</select></label>
          <label class="campo oculto" data-bloque-fase><span>Fase</span><select name="fase"></select></label>
        </div>
        ${puedeCrearTorneo() ? '<p style="margin:-6px 0 10px"><button type="button" class="btn ghost chico" data-torneo-nuevo>＋ Crear un torneo nuevo</button></p>' : ''}
        <div class="fila gap wrap" style="margin-bottom:10px">${K.seg('local', [['1', 'Local'], ['0', 'Visita']], rec ? (rec.local ? '1' : '0') : '1')}</div>
        <div class="grid2">
          <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${e(rec ? rec.fecha || '' : '')}"></label>
          <label class="campo"><span>Duración (minutos)</span><input type="number" inputmode="numeric" name="duracion" value="${e(rec ? rec.duracion || 90 : 90)}"></label>
        </div>
        <h3 style="margin:8px 0 4px;font-size:15px">Categorías que juegan contra este rival</h3>
        <p class="suave" style="margin:0 0 6px">Normalmente juegan una tras otra (Sub 20 y Sub 18, o Sub 16 y Sub 15). Marca las que corresponden y anota el resultado de cada una.</p>
        ${cats.map((c) => { const p = por(c); return `<div class="pj-cat"><label class="check"><input type="checkbox" name="c${c}" ${p || (!jn && (!catTor || catTor.has(c))) ? 'checked' : ''}><span><b>Sub ${c}</b></span></label><input type="text" name="r${c}" value="${e(p ? p.res || '' : '')}" placeholder="Resultado (2-1)" aria-label="Resultado Sub ${c}"><label class="check"><input type="checkbox" name="j${c}" ${p ? (p.jugado ? 'checked' : '') : !jn && !delTorneo ? 'checked' : ''}><span>Ya se jugó</span></label></div>`; }).join('')}
        ${legacy.map((p) => `<div class="pj-cat"><span class="suave">Este partido no tenía categoría:</span><select name="lg${p.id}"><option value="">— elegir —</option>${cats.map((c) => `<option value="${c}">Sub ${c}</option>`).join('')}</select></div>`).join('')}`,
      botones: [
        jn ? { txt: 'Eliminar', cls: 'peligro', fn: () => { K.confirmar('¿Eliminar este partido (todas sus categorías) y sus atenciones registradas? Podrás deshacerlo por unos segundos.', 'Eliminar', () => { K.conDeshacer('Partido eliminado', () => { jn.ps.slice().forEach((p) => K.quitarPartidoYAtenciones(inf, p)); K.ui.partidoId = null; }); }); return true; } } : { txt: 'Cancelar', cls: 'sec' },
        ...(!jn && opt.torneoId ? [{ txt: 'Guardar y agregar otro', cls: 'sec otro', fn: (m, hoja) => { if (guardarForm(hoja, true)) hoja._otro(); return false; } }] : []),
        {
          txt: 'Guardar',
          fn: (m, hoja) => (guardarForm(hoja, false) ? undefined : false)
        }
      ],
      alMontar: (m, hoja) => {
        hoja.querySelector('[data-logo]').addEventListener('change', async (ev) => {
          const f = ev.target.files[0]; if (!f) return;
          try { logoData = await K.fotoADataURL(f, 220, true); hoja.querySelector('[data-logo-ok]').textContent = ' ✓ cargado'; } catch (x) { K.aviso('No se pudo leer la imagen', true); }
        });
        const selT = hoja.querySelector('[name=torneoId]'), selF = hoja.querySelector('[name=fase]'), bFase = hoja.querySelector('[data-bloque-fase]');
        const pintarFases = (faseSel) => {
          const t = K.torneos.buscar(inf, selT.value);
          bFase.classList.toggle('oculto', !t || !(t.fases || []).length);
          selF.innerHTML = t ? '<option value="">Sin fase</option>' + t.fases.map((f) => `<option value="${e(f.id)}"${f.id === faseSel ? ' selected' : ''}>${e(f.nombre)}</option>`).join('') : '';
        };
        selT.addEventListener('change', () => pintarFases(''));
        pintarFases(fase0);
        const nt = hoja.querySelector('[data-torneo-nuevo]');
        if (nt) nt.addEventListener('click', () => K.formTorneo(null, { alGuardar: (t) => {
          selT.insertAdjacentHTML('beforeend', `<option value="${e(t.id)}">${e(t.nombre)}</option>`); selT.value = t.id; pintarFases('');
        } }));
        // en un partido nuevo, la fecha decide si ya se jugó (hoy o antes) o está por jugar (futura)
        const fe = hoja.querySelector('[name=fecha]');
        if (!jn) fe.addEventListener('change', () => { if (!fe.value) return; hoja.querySelectorAll('input[type=checkbox][name^=j]').forEach((c) => { c.checked = fe.value <= hoyISO; }); });
        hoja._otro = () => {
          hoja.querySelector('[name=rival]').value = ''; hoja.querySelector('[name=logo]').value = ''; logoData = ''; hoja.querySelector('[data-logo-ok]').textContent = '';
          hoja.querySelectorAll('input[type=text][name^=r]').forEach((i) => { i.value = ''; });
          hoja.querySelector('.cuerpo').scrollTop = 0; setTimeout(() => hoja.querySelector('[name=rival]').focus(), 60);
        };
      }
    });
  };

  /* ---------- PDF del informe de partido ---------- */
  function htmlPartido(jn, vista) {
    const inf = K.inf(), ps = vista === 'comb' ? jn.ps : jn.ps.filter((p) => String(p.cat || '') === vista), { hbar } = K.bd;
    const rTodo = resumen(inf, ps), kpi = (n, t) => `<div class="bd-k"><b>${n}</b><span>${t}</span></div>`, conm = K.conmocion ? K.conmocion.filas(ps) : [];
    const por = ps.map((x) => x.realizadoPor).find(Boolean) || '';
    const secciones = ps.map((p) => {
      const r = resumen(inf, [p]);
      const filas = r.lista.map((i) => `<tr><td>${e(momTxt(i))}</td><td><b>${e(nomJ(i.jugadorId))}</b></td><td>${e(K.nombreClase(i.clase))}${i.zona ? '<small>' + e(zonaTxt(i.zona)) + '</small>' : ''}</td><td class="n">${i.enCancha ? 'Sí' : 'No'}</td><td>${e(tratTxt(inf, i)) || '—'}${i.notas ? '<small>' + e(i.notas) + '</small>' : ''}</td><td class="n">${i.retiro ? '<b>Sí</b>' : 'No'}</td></tr>`).join('');
      const conMin = Object.keys(p.minutos || {}).filter((id) => Number(p.minutos[id]) > 0 && K.jugadorGlobal(id)).sort((a, b) => nomJ(a).localeCompare(nomJ(b), 'es'));
      const pares = []; for (let k = 0; k < conMin.length; k += 2) pares.push([conMin[k], conMin[k + 1]]);
      const cel = (id) => (id ? `<td>${e(nomJ(id))}</td><td class="n">${p.minutos[id]}'</td>` : '<td></td><td></td>');
      return `<div class="pt-sec">${ps.length > 1 ? `<h2 class="bit-h2">${e(catTxt(p))}${p.res ? ' · Resultado ' + e(p.res) : ''}</h2>` : ''}
        ${ps.length > 1 ? `<p class="pt-kp"><b>${r.n}</b> atenciones · <b>${r.jugadores}</b> jugadores atendidos · <b>${r.enCancha}</b> atendidos en cancha · <b>${r.retiros}</b> se retiraron${citadosDe(p) ? ' · ' + e(citTxt(p)) : ''}</p>` : citadosDe(p) ? `<p class="pt-kp">${e(citTxt(p))}</p>` : ''}
        ${r.n ? `<table class="kt"><thead><tr><th>Momento</th><th>Jugador</th><th>Tipo</th><th>Atendido en cancha</th><th>Intervención y comentarios</th><th>Se retiró</th></tr></thead><tbody>${filas}</tbody></table>` : '<p>Sin atenciones registradas en este partido.</p>'}
        ${conMin.length ? `<h2 class="bit-h2">Minutos jugados${ps.length > 1 ? ' · ' + e(catTxt(p)) : ''}</h2><table class="kt kt-min"><thead><tr><th>Jugador</th><th>Min</th><th>Jugador</th><th>Min</th></tr></thead><tbody>${pares.map(([a, b]) => `<tr>${cel(a)}${cel(b)}</tr>`).join('')}</tbody></table>` : ''}
        ${lineas(p.observaciones).length ? `<h2 class="bit-h2">Observaciones${ps.length > 1 ? ' · ' + e(catTxt(p)) : ''}</h2>${vinetas(p.observaciones)}` : ''}</div>`;
    }).join('');
    const sub = [ps.length > 1 ? ps.map((p) => 'Sub ' + p.cat).join(' y ') : (ps[0].cat ? 'Sub ' + ps[0].cat : inf.nombre), jn.fecha ? fc(jn.fecha) : '', jn.local ? 'Local' : 'Visita', ps.length === 1 && ps[0].res ? 'Resultado ' + ps[0].res : ''].filter(Boolean);
    const src = logoSrc(jn);
    return `<div class="bit-print kine-print"><header><div class="vs-logos"><img class="sw-vs" src="img/escudo-sw-vs.png" alt=""><b class="vs-t">vs</b>${src ? `<img class="rv-logo" src="${e(src)}" alt="">` : `<span class="rv-ini">${e((jn.rival || '?').slice(0, 1))}</span>`}</div><div style="flex:1"><h1>Informe kinésico · Partido · vs ${e(jn.rival)}</h1><p>Santiago Wanderers · ${e(sub.join(' · '))}</p>${por ? `<p>Informe realizado por: <b>${e(por)}</b></p>` : ''}</div></header>
      ${ps.length > 1 ? `<p style="margin:0 0 6px">${ps.map((p) => `<b>${e(catTxt(p))}</b>${p.res ? ' ' + e(p.res) : ''}`).join(' · ')}</p>` : ''}
      <div class="bd-kpis">${kpi(rTodo.n, 'atenciones')}${kpi(rTodo.jugadores, 'jugadores atendidos')}${kpi(rTodo.enCancha, 'atendidos en cancha')}${kpi(rTodo.retiros, 'se retiraron del partido')}${K.conmocion ? K.conmocion.kpiHTML(conm.length) : ''}</div>
      ${rTodo.n ? `<div class="bd-g" style="margin:10px 0"><section class="bd-p"><h4>Cuándo ocurrió</h4>${hbar(rTodo.porMom)}</section><section class="bd-p"><h4>Tipo de atención</h4>${hbar(rTodo.porClase, '#2f7a4a')}</section></div>` : ''}
      ${secciones}${K.conmocion ? K.conmocion.seccionHTML(conm, { partido: ps.length > 1, breve: true }) : ''}</div>`;
  }
  K.htmlPartido = htmlPartido; K.htmlGeneral = htmlGeneral; K.vistaDeJornada = vistaDe; K.jornadaDe = jornadaDe; // (usados por las pruebas)
  const nombrePdfPartido = (jn, vista) => `Informe kinésico partido ${jn.rival}${vista === 'comb' ? ' ' + jn.ps.map((p) => 'Sub ' + p.cat).join('-') : vista ? ' Sub ' + vista : ''}${jn.fecha ? ' ' + jn.fecha : ''}`;

  /* ---------- Acciones ---------- */
  const buscar = (id) => K.inf().partidos.find((x) => x.id === id);
  const jornadaPorId = (id) => K.jornadas(K.inf()).find((j) => j.jid === id || j.ps.some((p) => p.id === id));
  const aTodos = (p, f) => { const jn = jornadaPorId(p.id); (jn ? jn.ps : [p]).forEach(f); };
  Object.assign(K.acciones, {
    partInforme(el) { K.ui.partidoId = el.dataset.id; K.ui.partVista = null; K.render(); window.scrollTo(0, 0); },
    partVolver() { K.ui.partidoId = null; K.render(); },
    partIncNueva(el) { const p = buscar(el.dataset.id); if (p) formInc(p); },
    partIncEditar(el) { const p = buscar(el.dataset.id); const i = p && incs(p).find((x) => x.id === el.dataset.inc); if (i) { if (i.scat5 && K.conmocion) K.conmocion.form(p, i); else formInc(p, i); } },
    partConmocion(el) { const p = buscar(el.dataset.id); if (p && K.conmocion) K.conmocion.form(p, null); },
    partObs(el) { const p = buscar(el.dataset.id); if (p) { p.observaciones = el.value; K.guardar(); K.aviso('Guardado'); } },
    partPor(el) { const p = buscar(el.dataset.id); if (p) { const v = el.value.trim(); aTodos(p, (x) => { x.realizadoPor = v; }); if (v) K.state.ultimoInformante = v; K.guardar(); K.aviso('Guardado'); } },
    partMin(el) { const p = buscar(el.dataset.id); if (!p) return; p.minutos = p.minutos || {}; if (el.value === '') delete p.minutos[el.dataset.j]; else p.minutos[el.dataset.j] = Math.max(0, Math.min(130, Number(el.value) || 0)); K.guardar(); K.aviso('Guardado'); },
    // Con citados definidos, solo a los citados que aún no tienen minutos (nunca a quien no fue citado). Sin citados, como siempre: a todos los de la categoría.
    partMinTodos(el) {
      const p = buscar(el.dataset.id); if (!p) return; p.minutos = p.minutos || {};
      const cit = citadosDe(p), ids = cit ? cit.filter((id) => K.jugadorGlobal(id)) : K.jugadoresDePartido(K.inf(), p).map(({ j }) => j.id);
      let n = 0; ids.forEach((id) => { if (p.minutos[id] == null || p.minutos[id] === '') { p.minutos[id] = p.duracion || 90; n++; } });
      K.guardar(); K.aviso(n ? 'Minutos completados' + (cit ? ' para ' + n + (n === 1 ? ' citado' : ' citados') : '') : 'Todos los citados ya tienen minutos'); K.render();
    },
    partCitados(el) { const p = buscar(el.dataset.id); if (p) formCitados(p); },
    partEvalRapida(el) { const p = buscar(el.dataset.id); if (p) formEvalRapida(p); },
    partMinExtra(el) {
      const p = buscar(el.dataset.id); if (!p) return;
      const inf = K.inf(), ya = new Set(listaMin(inf, p).map((x) => x.j.id));
      const lista = K.itemsSelJ(K.jugadoresDePartido(inf, p).filter((x) => !ya.has(x.j.id)).map(({ j, visitante }) => ({ j, sub: [j.categoria, j.posicion].filter(Boolean).join(' · ') + (visitante ? ' (juega también aquí)' : '') })));
      if (!lista.length) { K.aviso('No quedan más jugadores de la categoría', true); return; }
      const w = document.createElement('div'); w.innerHTML = K.selJugador('x', { lista, titulo: 'Jugador que no estaba citado', etiqueta: 'Jugador que no estaba citado', reciente: false });
      const cont = w.firstElementChild;
      cont.addEventListener('change', (ev) => { const v = ev.target.value; if (!v) return; const ex = (K.ui.partExtra = K.ui.partExtra || {}); ex[p.id] = (ex[p.id] || []).concat([v]); K.render(); });
      K.selJugadorAbrir(cont);
    },
    partPdf(el) {
      const p = buscar(el.dataset.id); if (!p) return;
      const jn = jornadaDe(K.inf(), p), vista = vistaDe(jn);
      K.pdf.documento(htmlPartido(jn, vista), nombrePdfPartido(jn, vista));
    },
    plPartidoSel(el) { estado().plPartido = el.value; },
    // Partidos elegidos para el informe de jugadores de plantel: se actualiza la lista y el botón sin volver a dibujar la pantalla.
    plSel(el) {
      const sel = selPlantel(), k = el.dataset.k, i = sel.indexOf(k);
      if (el.checked && i < 0) sel.push(k); else if (!el.checked && i >= 0) sel.splice(i, 1);
      refrescarSelPlantel(el.closest('.card'));
    },
    plSelTodos(el) {
      const card = el.closest('.card');
      estado().plSel = el.checked ? Array.from(card.querySelectorAll('input[data-k]')).map((c) => c.dataset.k) : [];
      refrescarSelPlantel(card);
    },
    async plantelPartidosPdf() {
      const keys = selPlantel();
      if (!keys.length) { K.aviso('Marca al menos un partido', true); return; }
      try { await document.fonts.ready; } catch (x) { /* sigue */ }
      K.pdf.paginas(K.plantelPartidosPaginas(keys), K.plantelPartidosTitulo(keys));
    },
    contratoPdf() { K.pdf.documento(K.contratoGeneralHTML(), `Informe kinésico Jugadores de plantel ${K.resolverPeriodo(K.state.periodo).completo}`); },
    contratoPartidoPdf() { const js = jornadasJugadas(); if (!js.length) return; const v = estado().plPartido || (js[0].inf.id + '|' + js[0].jn.jid), x = js.find((q) => q.inf.id + '|' + q.jn.jid === v) || js[0]; K.pdf.documento(K.contratoPartidoHTML(x.inf.id + '|' + x.jn.jid), `Informe kinésico Jugadores de plantel vs ${x.jn.rival}`); },
    partGenSel(el) { estado().general = el.value; },
    partGenPdf() { const c = estado().general || 'todas', al = ALCANCES.find((a) => a[0] === c) || ALCANCES[0]; K.pdf.documento(htmlGeneral(c), `Informe kinésico partidos ${al[1]} ${K.resolverPeriodo(K.state.periodo).completo}`); },
    vaciarPartidos(el, ev) {
      if (ev) ev.preventDefault();
      const inf = K.inf(), n = K.jornadas(inf).length;
      K.confirmar(`¿Borrar los ${n} partidos de ${K.esc(inf.nombre)} y las atenciones registradas en ellos? Podrás deshacerlo por unos segundos.`, 'Vaciar calendario', () => { K.conDeshacer('Calendario vaciado', () => { inf.partidos.slice().forEach((p) => K.quitarPartidoYAtenciones(inf, p)); K.ui.partidoId = null; }); });
    },
    nuevoPartido() { K.formPartido(); },
    editPartido(el) { const jn = jornadaPorId(el.dataset.id); if (jn) K.formPartido(jn); },
    ordenarP() { K.ui.ordenarP = !K.ui.ordenarP; K.render(); },
    partBuscar(el) { K.ui.partQ = el.value; const pos = el.selectionStart; clearTimeout(K._partT); K._partT = setTimeout(() => { K.render(); const n = document.querySelector('[data-acc-input=partBuscar]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { /* nada */ } } }, 200); },
    fechaP(el) {
      const v = el.value, ok = v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 1990); if (!ok) return;
      const jn = jornadaPorId(el.dataset.id); if (jn) { jn.ps.forEach((p) => { p.fecha = v; }); K.guardar(); K.aviso('Fecha guardada'); }
    }
  });
  document.addEventListener('seg', (ev) => {
    const d = ev.target && ev.target.dataset && ev.target.dataset.seg;
    if (d === 'partSem' && ev.target.closest('#view')) { estado().sem = ev.detail; K.render(); }
    if (d === 'partVista' && ev.target.closest('#view')) { K.ui.partVista = ev.detail; K.render(); }
  });
})();

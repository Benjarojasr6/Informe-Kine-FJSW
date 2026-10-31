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
    return `<div class="pmes"><h4>${MESES[m - 1]}${n ? ` <small>${n} partido${n === 1 ? '' : 's'}</small>` : ''}</h4><div class="pgrid">${DIAS.map((d) => `<em>${d}</em>`).join('')}${c}</div></div>`;
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
      <div class="kc-ley" style="margin-top:8px"><span><u class="pj-u jug"></u>Jugado</span><span><u class="pj-u"></u>Por jugar</span></div>
      <h3 class="kc-sub">${js.length} partido${js.length === 1 ? '' : 's'} (rival) · ${s.sem === 'anio' ? 'año ' + anio : s.sem === '1' ? '1.er semestre ' + anio : '2.º semestre ' + anio}</h3>
      ${js.length ? js.map((j) => { const r = resumen(inf, j.ps); return `<div class="item pl-it" data-acc="partInforme" data-id="${j.p0.id}"><span class="mini-ico">${logo(j)}</span><div class="txt"><b>${e(j.rival)}</b><span>${e(dia(j.fecha))} ${e(fc(j.fecha))} · ${j.local ? 'Local' : 'Visita'}${j.jugado ? '' : ' · por jugar'}</span>${resChips(j)}</div>${r.n ? `<span class="chip">${r.n} atenc.</span>` : ''}<span class="btn ghost chico">Informe</span></div>`; }).join('') : '<p class="vacio-msg" style="padding:10px">No hay partidos con fecha en este período.</p>'}
      ${sin ? `<p class="suave" style="margin:8px 0 0">${sin} partido(s) sin fecha no aparecen en el calendario: ponles fecha en la lista de abajo.</p>` : ''}</div>`;
  };
  // Lista “Orden y fechas”: una fila por rival, con todas sus categorías.
  K.partidosListaHTML = function (inf) {
    const js = K.jornadas(inf);
    return `<div class="card"><div class="fila sb"><h2 style="margin:0">Orden y fechas (${js.length})</h2><button class="btn sec chico" data-acc="nuevoPartido">${K.uiIco('mas', 16)} Agregar</button></div>
      <p class="sub">Un partido por rival: ahí eliges qué categorías juegan (por ejemplo Sub 20 y Sub 18 el mismo día). Este es el orden del calendario en el informe${inf.ordenPartidos ? ' (manual)' : ' (por fecha)'}: arrastra <b>⠿</b> o usa las flechas para cambiarlo.${inf.ordenPartidos ? ' <a href="#" data-acc="ordenFecha">Volver al orden por fecha</a>' : ''}</p>
      <p class="sub">Cambia la fecha directamente en la fila. Toca el rival para editar el resto (local/visita, resultado de cada categoría, si ya se jugó).</p>
      ${js.length && K.puedeEditar() ? `<p style="margin:0 0 8px"><a href="#" data-acc="vaciarPartidos">Vaciar el calendario de ${e(inf.nombre)}</a> <span class="suave">(borra todos sus partidos y las atenciones registradas en ellos)</span></p>` : ''}
      ${js.length ? `<div class="lista" data-arr="partidos">${js.map((j) => `<div class="item" data-arr-item data-id="${e(j.jid)}"><button class="grip" data-grip aria-label="Arrastrar para cambiar el orden" title="Arrastra para cambiar el orden">${K.uiIco('arrastrar', 20)}</button><span class="mini-ico" data-acc="editPartido" data-id="${e(j.jid)}">${logo(j)}</span>
        <div class="txt" data-acc="editPartido" data-id="${e(j.jid)}"><b>${e(j.rival)}</b><span>${j.local ? 'Local' : 'Visita'}${j.jugado ? '' : ' · pendiente'}</span>${j.torneo ? `<span class="tag-torneo">${e(j.torneo)}</span>` : ''}${resChips(j)}</div>
        <input type="date" class="fecha-inline" min="2000-01-01" max="2100-12-31" value="${e(j.fecha || '')}" data-acc-change="fechaP" data-id="${e(j.jid)}" aria-label="Fecha del partido contra ${e(j.rival)}">
        <button class="btn ghost chico" data-acc="subirP" data-id="${e(j.jid)}" aria-label="Subir">${K.uiIco('arriba', 18)}</button><button class="btn ghost chico" data-acc="bajarP" data-id="${e(j.jid)}" aria-label="Bajar">${K.uiIco('abajo', 18)}</button></div>`).join('')}</div>` : '<p class="vacio-msg">Aún no hay partidos. Toca <b>Agregar</b> para cargar el primero.</p>'}</div>`;
  };

  /* ---------- Informe de todos los partidos (por categoría o general) ---------- */
  const ALCANCES = [['todas', 'Todas las categorías (Sub 15 a Sub 20)', [15, 16, 18, 20]], ['15', 'Solo Sub 15', [15]], ['16', 'Solo Sub 16', [16]], ['15-16', 'Sub 15 y Sub 16 juntas', [15, 16]], ['18', 'Solo Sub 18', [18]], ['20', 'Solo Sub 20', [20]], ['18-20', 'Sub 18 y Sub 20 juntas', [18, 20]]];
  K.partidosGeneralHTML = function () {
    const sel = estado().general || 'todas', per = K.resolverPeriodo(K.state.periodo);
    return `<div class="card"><h2>Informe de todos los partidos</h2>
      <p class="sub">Un solo documento con todos los partidos del período (<b>${e(per.completo)}</b>): resultados, atenciones, intervenciones, minutos jugados y lesiones por jugador. Elige la categoría o el informe general.</p>
      <div class="fila gap wrap"><select data-acc-change="partGenSel" style="width:auto;min-width:220px;flex:1">${K.opts(ALCANCES.map((a) => [a[0], a[1]]), sel)}</select><button class="btn" data-acc="partGenPdf">${K.uiIco('pdf', 16)} Descargar PDF</button></div>
      ${(() => { const pl = contratados(); return pl.length ? `<h3 class="kc-sub" style="margin-top:14px">Jugadores con contrato / plantel profesional</h3><p class="sub">Informe de partidos individual del jugador: minutos, partidos y atenciones.</p>
        <div class="fila gap wrap"><select data-acc-change="partJugSel" style="width:auto;min-width:220px;flex:1">${K.opts(pl.map((x) => [x.j.id, x.j.nombre + (x.j.categoria ? ' · ' + x.j.categoria : '')]), estado().jug || pl[0].j.id)}</select><button class="btn sec" data-acc="partJugPdf">${K.uiIco('pdf', 16)} Informe del jugador</button></div>
        <p class="sub" style="margin-top:12px">Informe general de todos los jugadores con contrato / plantel (resumen y partidos de cada uno).</p>
        <button class="btn sec" data-acc="plantelPdf">${K.uiIco('pdf', 16)} Informe de todos los jugadores con contrato / plantel</button>
        ${(() => { const js = jornadasJugadas(); if (!js.length) return ''; const v = estado().plPartido || (js[0].inf.id + '|' + js[0].jn.jid); return `<p class="sub" style="margin-top:12px">Informe de un partido solo con los jugadores con contrato / plantel que participaron y recibieron atención.</p>
        <div class="fila gap wrap"><select data-acc-change="plPartidoSel" style="width:auto;min-width:220px;flex:1">${K.opts(js.map(({ inf, jn }) => [inf.id + '|' + jn.jid, `${jn.rival} · ${jn.fecha ? fc(jn.fecha) : 'sin fecha'} · ${jn.ps.map((p) => (p.cat ? 'Sub ' + p.cat : 'Sin cat.')).join(' / ')}`]), v)}</select><button class="btn sec" data-acc="plantelPartidoPdf">${K.uiIco('pdf', 16)} Informe del partido</button></div>`; })()}` : ''; })()}</div>`;
  };
  const contratados = () => { const out = []; K.state.informes.forEach((i) => i.jugadores.forEach((j) => { if (j.contrato || j.plantel) out.push({ j, inf: i }); })); return out.sort((a, b) => a.j.nombre.localeCompare(b.j.nombre, 'es')); };
  /* Informe de partidos de UN jugador (por ejemplo, el que juega en el plantel profesional). */
  K.jugadorPartidosHTML = function (jid) {
    const g = K.jugadorGlobal(jid); if (!g) return '';
    const per = K.resolverPeriodo(K.state.periodo), j = g.j;
    const filas = [];
    K.state.informes.forEach((inf) => { K.jornadas(inf); inf.partidos.forEach((p) => {
      const min = Number((p.minutos || {})[jid]) || 0, inc = incs(p).filter((i) => i.jugadorId === jid);
      if (!K.partidoEnPeriodo(p, per) || (!min && !inc.length)) return;
      filas.push({ p, min, inc, inf });
    }); });
    filas.sort((a, b) => (a.p.fecha || '9999').localeCompare(b.p.fecha || '9999'));
    const tot = filas.reduce((a, x) => a + x.min, 0), nAt = filas.reduce((a, x) => a + x.inc.length, 0);
    const kpi = (n, t) => `<div class="bd-k"><b>${n}</b><span>${t}</span></div>`;
    const detalle = (x) => x.inc.length ? x.inc.map((i) => `${e(momTxt(i))}: ${e(K.nombreClase(i.clase))}${i.zona ? ' · ' + e(zonaTxt(i.zona)) : ''}${i.enCancha ? ' · atendido en cancha' : ''}${tratTxt(x.inf, i) ? ' · ' + e(tratTxt(x.inf, i)) : ''}${i.retiro ? ' · <b>se retiró</b>' : ''}${i.notas ? '<small>' + e(i.notas) + '</small>' : ''}`).join('<br>') : '—';
    return `<div class="bit-print kine-print"><header><img src="img/insignia-512.png" alt=""><div style="flex:1"><h1>Informe de partidos · ${e(j.nombre)}</h1><p>Santiago Wanderers · ${e(j.categoria || '')}${j.posicion ? ' · ' + e(j.posicion) : ''} · ${e(per.completo)}</p></div>${j.foto ? `<img class="rv-logo" style="border-radius:50%;object-fit:cover" src="${e(j.foto)}" alt="">` : ''}</header>
      <div class="bd-kpis">${kpi(filas.filter((x) => x.min).length, 'partidos jugados')}${kpi(tot, 'minutos jugados')}${kpi(nAt, 'atenciones en partidos')}${kpi(filas.reduce((a, x) => a + x.inc.filter((i) => i.retiro).length, 0), 'veces que se retiró')}</div>
      ${filas.length ? `<h2 class="bit-h2">Partidos</h2><table class="kt"><thead><tr><th>Fecha</th><th>Rival</th><th>Categoría</th><th>Resultado</th><th>Min</th><th>Atenciones</th></tr></thead><tbody>${filas.map((x) => `<tr><td>${x.p.fecha ? e(fc(x.p.fecha)) : '—'}</td><td><b>${e(x.p.rival)}</b><small>${x.p.local ? 'Local' : 'Visita'}</small></td><td>${e(catTxt(x.p))}</td><td class="n">${e(x.p.res || '—')}</td><td class="n">${x.min || '—'}</td><td>${detalle(x)}</td></tr>`).join('')}</tbody></table>` : '<p>Este jugador no tiene partidos ni atenciones en partidos en el período.</p>'}</div>`;
  };
  /* ---------- Informes de jugadores con contrato / plantel profesional ---------- */
  const cabecera = (tit, sub) => `<header><img src="img/insignia-512.png" alt=""><div><h1>${tit}</h1><p>${sub}</p></div></header>`;
  const detalleInc = (inf, l) => l.map((i) => `${e(momTxt(i))}: ${e(K.nombreClase(i.clase))}${i.zona ? ' · ' + e(zonaTxt(i.zona)) : ''}${i.enCancha ? ' · atendido en cancha' : ''}${tratTxt(inf, i) ? ' · ' + e(tratTxt(inf, i)) : ''}${i.retiro ? ' · <b>se retiró</b>' : ''}${i.notas ? '<small>' + e(i.notas) + '</small>' : ''}`).join('<br>');
  const etqTxt = (j) => [j.contrato ? 'Contrato' : '', j.plantel ? 'Plantel' : ''].filter(Boolean).join(' y ');
  // Todos los jugadores con contrato / plantel: resumen y partidos de cada uno.
  K.plantelGeneralHTML = function () {
    const per = K.resolverPeriodo(K.state.periodo), pl = contratados(), kpi = (n, t) => `<div class="bd-k"><b>${n}</b><span>${t}</span></div>`;
    const datos = pl.map(({ j, inf: i0 }) => {
      const filas = [];
      K.state.informes.forEach((inf) => { K.jornadas(inf); inf.partidos.forEach((p) => {
        const min = Number((p.minutos || {})[j.id]) || 0, inc = incs(p).filter((i) => i.jugadorId === j.id);
        if (K.partidoEnPeriodo(p, per) && (min || inc.length)) filas.push({ p, min, inc, inf });
      }); });
      filas.sort((a, b) => (a.p.fecha || '9999').localeCompare(b.p.fecha || '9999'));
      const les = i0.casos.filter((c) => c.jugadorId === j.id && c.tipo === 'lesion' && K.enPeriodo(c.inicio, per)).length;
      return { j, filas, min: filas.reduce((a, x) => a + x.min, 0), at: filas.reduce((a, x) => a + x.inc.length, 0), les };
    });
    const tot = (f) => datos.reduce((a, d) => a + f(d), 0);
    const resumenT = datos.length ? `<h2 class="bit-h2">Resumen por jugador</h2><table class="kt"><thead><tr><th>Jugador</th><th>Categoría</th><th>Etiqueta</th><th>Partidos</th><th>Minutos</th><th>Atenciones</th><th>Lesiones</th></tr></thead><tbody>${datos.map((d) => `<tr><td><b>${e(d.j.nombre)}</b></td><td>${e(d.j.categoria || '')}</td><td>${e(etqTxt(d.j))}</td><td class="n">${d.filas.filter((x) => x.min).length}</td><td class="n">${d.min || '—'}</td><td class="n">${d.at}</td><td class="n">${d.les}</td></tr>`).join('')}</tbody></table>` : '<p>No hay jugadores con etiqueta Contrato o Plantel.</p>';
    const porJ = datos.filter((d) => d.filas.length).map((d) => `<div class="nobr"><h2 class="bit-h2">${e(d.j.nombre)} <small>${e(etqTxt(d.j))} · ${e(d.j.categoria || '')}</small></h2><table class="kt"><thead><tr><th>Fecha</th><th>Rival</th><th>Categoría</th><th>Res.</th><th>Min</th><th>Atenciones</th></tr></thead><tbody>${d.filas.map((x) => `<tr><td>${x.p.fecha ? e(fc(x.p.fecha)) : '—'}</td><td><b>${e(x.p.rival)}</b></td><td>${e(catTxt(x.p))}</td><td class="n">${e(x.p.res || '—')}</td><td class="n">${x.min || '—'}</td><td>${x.inc.length ? detalleInc(x.inf, x.inc) : '—'}</td></tr>`).join('')}</tbody></table></div>`).join('');
    return `<div class="bit-print kine-print">${cabecera('Informe de jugadores con contrato / plantel', 'Santiago Wanderers · ' + e(per.completo) + ' · ' + datos.length + ' jugador' + (datos.length === 1 ? '' : 'es'))}
      <div class="bd-kpis">${kpi(datos.length, 'jugadores')}${kpi(tot((d) => d.filas.filter((x) => x.min).length), 'participaciones en partidos')}${kpi(tot((d) => d.min), 'minutos jugados')}${kpi(tot((d) => d.at), 'atenciones en partidos')}</div>
      ${resumenT}${porJ}</div>`;
  };
  // Un partido (por ejemplo contra Recoleta): solo jugadores con contrato / plantel que participaron y recibieron atención.
  const jornadasJugadas = () => { const out = []; K.state.informes.forEach((inf) => K.jornadas(inf).forEach((jn) => { if (jn.jugado || jn.ps.some((p) => incs(p).length)) out.push({ inf, jn }); })); return out.sort((a, b) => (b.jn.fecha || '').localeCompare(a.jn.fecha || '')); };
  K.plantelPartidoHTML = function (clave) {
    const [iid, jid] = String(clave || '').split('|'), inf = K.state.informes.find((i) => i.id === iid), jn = inf && K.jornadas(inf).find((x) => x.jid === jid);
    if (!jn) return '<div class="bit-print kine-print"><p>Elige un partido.</p></div>';
    const filas = [], sinAt = [];
    jn.ps.forEach((p) => {
      const ids = new Set(Object.keys(p.minutos || {}).filter((id) => Number(p.minutos[id]) > 0).concat(incs(p).map((i) => i.jugadorId)));
      ids.forEach((id) => {
        const g = K.jugadorGlobal(id); if (!g || !(g.j.contrato || g.j.plantel)) return;
        const inc = incs(p).filter((i) => i.jugadorId === id).map((i) => Object.assign({}, i, { _p: p })), min = Number((p.minutos || {})[id]) || 0;
        if (inc.length) filas.push({ g, p, min, inc }); else sinAt.push(g.j.nombre);
      });
    });
    filas.sort((a, b) => a.g.j.nombre.localeCompare(b.g.j.nombre, 'es'));
    const res = jn.ps.map((p) => (p.res ? (p.cat ? 'Sub ' + p.cat + ' ' : '') + p.res : '')).filter(Boolean).join(' · ');
    const kpi = (n, t) => `<div class="bd-k"><b>${n}</b><span>${t}</span></div>`;
    return `<div class="bit-print kine-print">${cabecera('Informe de partido · jugadores con contrato / plantel', `Santiago Wanderers vs ${e(jn.rival)} · ${jn.fecha ? e(dia(jn.fecha)) + ' ' + e(fc(jn.fecha)) : 'sin fecha'} · ${jn.local ? 'Local' : 'Visita'}${res ? ' · ' + e(res) : ''}`)}
      <div class="bd-kpis">${kpi(filas.length, 'jugadores atendidos')}${kpi(filas.reduce((a, x) => a + x.inc.length, 0), 'atenciones')}${kpi(filas.filter((x) => x.inc.some((i) => i.retiro)).length, 'se retiraron')}${kpi(sinAt.length, 'participaron sin atención')}</div>
      ${filas.length ? `<h2 class="bit-h2">Jugadores atendidos</h2><table class="kt"><thead><tr><th>Jugador</th><th>Etiqueta</th><th>Categoría</th><th>Min</th><th>Atenciones</th></tr></thead><tbody>${filas.map((x) => `<tr><td><b>${e(x.g.j.nombre)}</b></td><td>${e(etqTxt(x.g.j))}</td><td>${e(catTxt(x.p))}</td><td class="n">${x.min || '—'}</td><td>${detalleInc(x.g.inf, x.inc)}</td></tr>`).join('')}</tbody></table>` : '<p>Ningún jugador con contrato o plantel recibió atención en este partido.</p>'}
      ${sinAt.length ? `<p class="suave">Participaron sin atención: ${e(sinAt.join(', '))}.</p>` : ''}</div>`;
  };
  function juntarPartidos(cats, todos, per) {
    const out = [];
    K.state.informes.forEach((inf) => {
      K.jornadas(inf);
      inf.partidos.forEach((p) => {
        const dentro = todos ? true : !!p.cat && cats.includes(Number(p.cat));
        if (dentro && K.partidoEnPeriodo(p, per) && (p.jugado || incs(p).length)) out.push({ inf, p });
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
    const jf = Object.keys(jug).map((id) => { const g = K.jugadorGlobal(id), o = jug[id]; o.nombre = g.j.nombre; o.cat = g.j.categoria || ''; o.les = g.inf.casos.filter((c) => c.jugadorId === id && c.tipo === 'lesion' && K.enPeriodo(c.inicio, per)).length; return o; }).sort((a, b) => (b.min - a.min) || a.nombre.localeCompare(b.nombre, 'es'));
    const tablaJ = jf.length ? `<h2 class="bit-h2">Minutos jugados y lesiones por jugador</h2><table class="kt"><thead><tr><th>Jugador</th><th>Categoría</th><th>Partidos</th><th>Minutos</th><th>Atenc. en partido</th><th>Se retiró</th><th>Lesiones del período</th></tr></thead><tbody>${jf.map((o) => `<tr><td><b>${e(o.nombre)}</b>${o.cats.size > 1 ? `<small>Jugó en ${Array.from(o.cats).sort().map((c) => 'Sub ' + c).join(' y ')}</small>` : ''}</td><td>${e(o.cat)}</td><td class="n">${o.partidos}</td><td class="n">${o.min}</td><td class="n">${o.at}</td><td class="n">${o.ret}</td><td class="n">${o.les}</td></tr>`).join('')}</tbody></table>` : '';
    const nombresInterv = Object.keys(r.interv).map((id) => [(K.trat(infRef, id) || { nombre: id }).nombre, r.interv[id]]).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const zonas = {}; r.lista.forEach((i) => { if (i.zona) { const z = zonaTxt(i.zona); zonas[z] = (zonas[z] || 0) + 1; } });
    const topZ = Object.keys(zonas).map((z) => [z, zonas[z]]).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const obs = lista.filter((x) => lineas(x.p.observaciones).length);
    const bloqueObs = obs.length ? `<h2 class="bit-h2">Observaciones de los partidos</h2>${obs.map(({ p }) => `<div class="nobr"><p class="pg-obs-t"><b>${e(p.rival)}</b> · ${e(catTxt(p))}${p.fecha ? ' · ' + e(fc(p.fecha)) : ''}</p>${vinetas(p.observaciones)}</div>`).join('')}` : '';
    return `<div class="bit-print kine-print"><header><img src="img/insignia-512.png" alt=""><div><h1>Informe de partidos · ${e(al[1])}</h1><p>Santiago Wanderers · ${e(per.completo)} · ${lista.length} partido${lista.length === 1 ? '' : 's'}</p></div></header>
      <div class="bd-kpis">${kpi(lista.length, 'partidos')}${kpi(r.n, 'atenciones')}${kpi(r.jugadores, 'jugadores atendidos')}${kpi(r.retiros, 'se retiraron')}</div>
      ${lista.length ? `<div class="bd-g" style="margin-top:10px"><section class="bd-p"><h4>Cuándo ocurrió</h4>${hbar(r.porMom)}</section><section class="bd-p"><h4>Tipo de atención</h4>${hbar(r.porClase, '#2f7a4a')}</section></div>
      <div class="bd-g" style="margin-top:8px"><section class="bd-p"><h4>Intervenciones realizadas</h4>${nombresInterv.length ? hbar(nombresInterv, '#3b5bb5') : '<p class="suave">Sin intervenciones.</p>'}</section><section class="bd-p"><h4>Zonas más frecuentes</h4>${topZ.length ? hbar(topZ, '#e9a93b') : '<p class="suave">Sin zonas registradas.</p>'}</section></div>
      ${porCat}
      <h2 class="bit-h2">Partidos</h2><table class="kt"><thead><tr><th>Fecha</th><th>Rival</th><th>Categoría</th><th>Resultado</th><th>Atenciones</th><th>Jugadores</th><th>Se retiraron</th></tr></thead><tbody>${filas}</tbody></table>
      ${tablaJ}${bloqueObs}` : '<p>No hay partidos jugados en este período.</p>'}</div>`;
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
  K.pPartidoInforme = function (p0) {
    const inf = K.inf(), jn = jornadaDe(inf, p0), vista = vistaDe(jn);
    const ps = vista === 'comb' ? jn.ps : jn.ps.filter((p) => String(p.cat || '') === vista), p = ps[0];
    const r = resumen(inf, ps), { hbar, panel } = K.bd, ed = K.puedeEditar();
    const nombresInterv = Object.keys(r.interv).map((id) => [(K.trat(inf, id) || { nombre: id }).nombre, r.interv[id]]).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const kpi = (n, t) => `<div class="bd-k"><b>${n}</b><span>${t}</span></div>`;
    const tabs = jn.ps.length > 1 ? `<div style="margin:0 0 12px">${K.seg('partVista', jn.ps.map((x) => [String(x.cat || ''), x.cat ? 'Sub ' + x.cat : 'Partido']).concat([['comb', 'Combinado']]), vista)}</div>` : '';
    const fila = (i) => `<div class="item"${ed ? ` data-acc="partIncEditar" data-id="${i._p.id}" data-inc="${i.id}"` : ''}><span class="pm-tag" style="background:${MOM_COL[i.momento] || '#8a9a90'}">${e(MOM_TXT[i.momento] || '')}${jugando(i.momento) && i.minuto !== '' && i.minuto != null ? `<b>${e(i.minuto)}'</b>` : ''}</span>
          <div class="txt"><b>${e(nomJ(i.jugadorId))}${vista === 'comb' && i._cat ? ` <span class="suave">· Sub ${i._cat}</span>` : ''}</b><span>${minCorrido(i) != null ? `${e(minCorrido(i))}' del partido · ` : ''}${e(K.nombreClase(i.clase))}${i.zona ? ' · ' + e(zonaTxt(i.zona)) : ''} · ${i.enCancha ? 'atendido en cancha' : 'atendido fuera de la cancha'}${tratTxt(inf, i) ? ' · ' + e(tratTxt(inf, i)) : ''}</span></div>${i.retiro ? '<span class="chip g-grave">Se retiró</span>' : ''}</div>`;
    const minutos = vista !== 'comb' ? (() => {
      const js = K.jugadoresDePartido(inf, p);
      return `<div class="card"><div class="fila sb wrap gap"><h2 style="margin:0">Minutos jugados · ${e(catTxt(p))}</h2>${ed ? `<button class="btn sec chico" data-acc="partMinTodos" data-id="${e(p.id)}">Completar vacíos con ${p.duracion || 90}</button>` : ''}</div>
        <p class="sub">Anota los minutos de cada jugador (déjalo vacío si no jugó). Sirven para el informe de partidos; no salen en la ficha del jugador.</p>
        ${js.length ? `<div class="lista">${js.map(({ j, visitante }) => `<div class="contador"><span>${e(j.nombre)}${visitante ? ` <small class="suave">(${e(j.categoria || '')}, juega también aquí)</small>` : ''}</span><div class="step"><input type="number" inputmode="numeric" min="0" max="130" ${ed ? '' : 'disabled'} data-acc-change="partMin" data-id="${e(p.id)}" data-j="${e(j.id)}" value="${e((p.minutos || {})[j.id] != null ? p.minutos[j.id] : '')}" placeholder="0"><span class="suave">min</span></div></div>`).join('')}</div>` : '<p class="vacio-msg">No hay jugadores de esta categoría. Agrégalos en la pestaña Jugadores.</p>'}</div>`;
    })() : (() => {
      const conMin = ps.map((x) => [x, Object.keys(x.minutos || {}).filter((id) => Number(x.minutos[id]) > 0 && K.jugadorGlobal(id)).sort((a, b) => nomJ(a).localeCompare(nomJ(b), 'es'))]).filter(([, l]) => l.length);
      return conMin.length ? `<div class="card"><h2>Minutos jugados</h2>${conMin.map(([x, l]) => `<p class="sub" style="margin:8px 0 4px"><b>${e(catTxt(x))}</b></p><div class="min-grid">${l.map((id) => `<span>${e(nomJ(id))}</span><b>${x.minutos[id]}'</b>`).join('')}</div>`).join('')}</div>` : '';
    })();
    const obs = vista !== 'comb'
      ? `<div class="card" style="margin-top:12px"><h2>Observaciones del partido</h2><label class="campo"><span>Una por línea; en el PDF salen como viñetas (cancha, clima, jugadores sin molestias, etc.)</span><textarea rows="5" ${ed ? '' : 'disabled'} data-acc-change="partObs" data-id="${e(p.id)}" placeholder="Ej.&#10;Jugador 1er equipo&#10;Sin molestias post partido: Diego Molina">${e(p.observaciones || '')}</textarea></label></div>`
      : `<div class="card" style="margin-top:12px"><h2>Observaciones del partido</h2>${ps.map((x) => `<p class="sub" style="margin:8px 0 4px"><b>${e(catTxt(x))}</b></p>${lineas(x.observaciones).length ? vinetas(x.observaciones) : '<p class="suave">Sin observaciones.</p>'}`).join('')}</div>`;
    return `<div class="titulo-vista"><div class="fila gap"><button class="btn sec chico" data-acc="partVolver">${K.uiIco('atras', 16)} Partidos</button></div>
        <div class="fila gap wrap"><button class="btn sec chico" data-acc="partPdf" data-id="${e(p.id)}">${K.uiIco('pdf', 16)} PDF</button>${ed && vista !== 'comb' ? `<button class="btn" data-acc="partIncNueva" data-id="${e(p.id)}">${K.uiIco('mas', 18)} Agregar atención</button>` : ''}</div></div>
      <div class="fila gap" style="margin-bottom:10px"><span class="vs-logos"><span class="mini-ico" style="width:52px;height:52px"><img src="img/insignia-512.png" alt=""></span><b class="vs-t">vs</b><span class="mini-ico" style="width:52px;height:52px">${logo(jn) || `<span class="sin-logo">${e((jn.rival || '?').slice(0, 1))}</span>`}</span></span><div><h1 style="font-family:Caladea,serif;font-size:23px;color:var(--verde-2)">Informe de partido · vs ${e(jn.rival)}</h1><div class="suave">${jn.fecha ? e(dia(jn.fecha)) + ' ' + e(fc(jn.fecha)) + ' · ' : ''}${jn.local ? 'Local' : 'Visita'}${resultadosTxt(jn) ? ' · ' + e(resultadosTxt(jn)) : ''}${jn.jugado ? '' : ' · por jugar'}</div></div></div>
      ${tabs}
      ${vista === 'comb' ? '<p class="suave" style="margin:0 0 10px">Informe combinado: todas las categorías de este día juntas. Para agregar atenciones, minutos u observaciones elige una categoría arriba.</p>' : ''}
      <div class="bd-kpis">${kpi(r.n, 'atenciones')}${kpi(r.jugadores, 'jugadores atendidos')}${kpi(r.enCancha, 'atendidos en cancha')}${kpi(r.retiros, 'se retiraron del partido')}</div>
      <div class="card"><h2>Atenciones del partido</h2>
        ${r.lista.length ? `<div class="lista">${r.lista.map(fila).join('')}</div>` : `<p class="vacio-msg">Aún no hay atenciones en este partido.${ed && vista !== 'comb' ? ' Toca <b>Agregar atención</b> para registrar la primera.' : ''}</p>`}</div>
      ${r.n ? `<div class="bd-g">${panel('Cuándo ocurrió', hbar(r.porMom))}${panel('Tipo de atención', hbar(r.porClase, '#2f7a4a'))}${panel('Intervenciones realizadas', hbar(nombresInterv, '#3b5bb5'))}</div>` : ''}
      ${minutos}
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
    const lbl = (t) => `<span class="lbl">${t}</span>`;
    const casosDe = (jid, sel) => { const g = K.jugadorGlobal(jid); return '<option value="">—</option>' + (g ? g.inf.casos.filter((c) => c.jugadorId === jid).sort((a, b) => (b.inicio || '').localeCompare(a.inicio || '')).map((c) => `<option value="${c.id}"${sel === c.id ? ' selected' : ''}>${e(c.titulo)} · ${e(fc(c.inicio))}</option>`).join('') : ''); };
    K.modal({
      titulo: (rec ? 'Editar atención' : 'Atención en partido') + ' · ' + p.rival + (p.cat ? ' · Sub ' + p.cat : ''),
      cuerpo: `
        <label class="campo"><span>Jugador</span><select name="jugadorId"><option value="">— elegir —</option>${cand.map(({ j, visitante }) => `<option value="${j.id}"${rec && rec.jugadorId === j.id ? ' selected' : ''}>${e(j.nombre)}${visitante ? ' · ' + e(j.categoria || '') + ' (juega también aquí)' : ''}</option>`).join('')}</select></label>
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
        <p class="suave">Esto cuenta también como una atención del jugador en los totales del informe y, si es una molestia, queda registrada como molestia del partido (en el informe de la categoría donde se juega el partido).</p>`,
      botones: [
        rec ? { txt: 'Eliminar', cls: 'peligro', fn: () => { K.confirmar('¿Eliminar esta atención del partido? También se quita de los totales.', 'Eliminar', () => { quitar(p, rec); K.guardar(); K.aviso('Eliminada'); K.render(); }); return true; } } : { txt: 'Cancelar', cls: 'sec' },
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
    // Molestia del partido (si no se eligió una ya existente, se crea sola y se actualiza al editar)
    let casoId = inc.casoId || '';
    if (inc.clase === 'molestia' && !inc.casoId) {
      let c = inc.casoAutoId && K.buscarCaso(inc.casoAutoId);
      if (c && K.jugadorGlobal(c.jugadorId) && c.jugadorId !== inc.jugadorId) { quitarAuto(inc); c = null; }
      const campos = {
        jugadorId: inc.jugadorId, tipo: 'molestia', titulo: inc.zona ? 'Molestia ' + zonaTxt(inc.zona).toLowerCase() : 'Molestia en partido',
        contexto: `partido vs ${p.rival}`, gravedad: (c && c.gravedad) || 'pordefinir', zonas: inc.zona ? [inc.zona] : [], inicio: fecha,
        mecanismo: 'partido', momento: MOM_CASO[inc.momento] || '', abandono: jugando(inc.momento) ? (inc.retiro ? 'si' : 'no') : '',
        limita: 'no', catJuego: p.cat ? Number(p.cat) : null, partidoId: p.id, incId: inc.id, auto: true
      };
      campos.tituloAuto = campos.titulo;
      if (c && c.titulo && c.tituloAuto && c.titulo !== c.tituloAuto) campos.titulo = c.titulo; // el nombre que le diste se respeta
      if (c) Object.assign(c, campos); else { c = Object.assign({ id: K.uid(), alta: '', semanas: '', notas: '' }, campos); g.inf.casos.push(c); inc.casoAutoId = c.id; }
      casoId = c.id;
    } else quitarAuto(inc);
    const a = Object.assign({ id: inc.atencionId || K.uid() }, previa || {}, {
      fecha, jugadorId: inc.jugadorId, casoId, trat: Object.assign({}, inc.trat), origen: 'ssw', clase: inc.clase, partidoId: p.id, incId: inc.id, catJuego: p.cat ? Number(p.cat) : null,
      temporada: (previa && previa.temporada) || K.ui.ultTemporada || (Number(fecha.slice(5, 7)) <= 6 ? 'camp1' : 'camp2'),
      notas: `Partido vs ${p.rival}${p.cat ? ' (Sub ' + p.cat + ')' : ''} · ${momTxt(inc, p)}${inc.enCancha ? ' · en cancha' : ''}${inc.retiro ? ' · se retiró del partido' : ''}${inc.notas ? ' · ' + inc.notas : ''}`
    });
    g.inf.atenciones.push(a); inc.atencionId = a.id;
  }
  function quitar(p, inc) {
    p.incidencias = incs(p).filter((x) => x.id !== inc.id);
    quitarAuto(inc);
    if (inc.atencionId) K.state.informes.forEach((i) => { i.atenciones = i.atenciones.filter((a) => a.id !== inc.atencionId); });
  }
  K.quitarPartidoYAtenciones = (inf, p) => {
    K.state.informes.forEach((i) => { i.atenciones = i.atenciones.filter((a) => a.partidoId !== p.id); i.casos = i.casos.filter((c) => !(c.auto && c.partidoId === p.id)); });
    inf.partidos = inf.partidos.filter((x) => x.id !== p.id);
  };

  /* ---------- Formulario del partido (un rival + las categorías que juegan) ---------- */
  const LOGOS = K.CALENDARIO_BASE.map((p) => [p[1], p[0]]);
  // Torneos especiales ya usados (para sugerirlos al cargar otro partido del mismo torneo).
  const torneosGuardados = () => { const s = new Set(); K.state.informes.forEach((i) => (i.partidos || []).forEach((p) => { if (p.torneo) s.add(p.torneo); })); return [...s].sort((a, b) => a.localeCompare(b, 'es')); };
  K.torneosGuardados = torneosGuardados;
  K.formPartido = function (jn) {
    const inf = K.inf(), g = K.grupoDe(K.ui.cat), cats = (g ? g.cats : [15, 16, 18, 20]).slice().sort((a, b) => b - a), rec = jn ? jn.p0 : null;
    let logoData = rec ? rec.logoData || '' : '';
    const por = (c) => (jn ? jn.ps.find((p) => Number(p.cat) === c) : null);
    const legacy = jn ? jn.ps.filter((p) => !p.cat) : [];
    const fechaOk = (v) => v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 1990);
    K.modal({
      titulo: jn ? 'Partido' : 'Nuevo partido',
      cuerpo: `
        <label class="campo"><span>Rival</span><input type="text" name="rival" value="${e(rec ? rec.rival : '')}" autocomplete="off"></label>
        <div class="grid2">
          <label class="campo"><span>Escudo</span><select name="logo"><option value="">Sin escudo</option>${K.opts(LOGOS, rec ? rec.logo : '')}</select></label>
          <div class="campo"><span style="display:block;font-size:12.5px;font-weight:600;color:var(--suave);margin-bottom:4px">…o sube uno propio</span><label class="btn sec chico" style="cursor:pointer">${K.uiIco('subir', 16)} Elegir imagen<input type="file" accept="image/*" hidden data-logo></label><span class="suave" data-logo-ok>${logoData ? ' ✓ cargado' : ''}</span></div>
        </div>
        <label class="campo"><span>Torneo especial (opcional: Libertadores, copa, amistoso…; vacío = campeonato normal)</span><input type="text" name="torneo" list="dl-torneos" value="${e(rec ? rec.torneo || '' : '')}" placeholder="Campeonato normal" autocomplete="off"><datalist id="dl-torneos">${torneosGuardados().map((t) => `<option value="${e(t)}">`).join('')}</datalist></label>
        <div class="fila gap wrap" style="margin-bottom:10px">${K.seg('local', [['1', 'Local'], ['0', 'Visita']], rec ? (rec.local ? '1' : '0') : '1')}</div>
        <div class="grid2">
          <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${e(rec ? rec.fecha || '' : '')}"></label>
          <label class="campo"><span>Duración (minutos)</span><input type="number" inputmode="numeric" name="duracion" value="${e(rec ? rec.duracion || 90 : 90)}"></label>
        </div>
        <h3 style="margin:8px 0 4px;font-size:15px">Categorías que juegan contra este rival</h3>
        <p class="suave" style="margin:0 0 6px">Normalmente juegan una tras otra (Sub 20 y Sub 18, o Sub 16 y Sub 15). Marca las que corresponden y anota el resultado de cada una.</p>
        ${cats.map((c) => { const p = por(c); return `<div class="pj-cat"><label class="check"><input type="checkbox" name="c${c}" ${p || !jn ? 'checked' : ''}><span><b>Sub ${c}</b></span></label><input type="text" name="r${c}" value="${e(p ? p.res || '' : '')}" placeholder="Resultado (2-1)" aria-label="Resultado Sub ${c}"><label class="check"><input type="checkbox" name="j${c}" ${p ? (p.jugado ? 'checked' : '') : !jn ? 'checked' : ''}><span>Ya se jugó</span></label></div>`; }).join('')}
        ${legacy.map((p) => `<div class="pj-cat"><span class="suave">Este partido no tenía categoría:</span><select name="lg${p.id}"><option value="">— elegir —</option>${cats.map((c) => `<option value="${c}">Sub ${c}</option>`).join('')}</select></div>`).join('')}`,
      botones: [
        jn ? { txt: 'Eliminar', cls: 'peligro', fn: () => { K.confirmar('¿Eliminar este partido (todas sus categorías) y sus atenciones registradas?', 'Eliminar', () => { jn.ps.slice().forEach((p) => K.quitarPartidoYAtenciones(inf, p)); K.ui.partidoId = null; K.guardar(); K.aviso('Partido eliminado'); K.render(); }); return true; } } : { txt: 'Cancelar', cls: 'sec' },
        {
          txt: 'Guardar',
          fn: (m, hoja) => {
            const d = K.datos(hoja);
            if (!d.rival.trim()) { K.aviso('Escribe el nombre del rival', true); return false; }
            if (d.fecha && !fechaOk(d.fecha)) { K.aviso('Revisa el año de la fecha', true); return false; }
            const marcadas = cats.filter((c) => d['c' + c]);
            if (!marcadas.length && !legacy.length) { K.aviso('Marca al menos una categoría', true); return false; }
            const comunes = { rival: d.rival.trim(), torneo: (d.torneo || '').trim(), logo: d.logo, logoData, local: K.segValor(hoja, 'local') === '1', fecha: d.fecha, duracion: Number(d.duracion) || 90 };
            const jid = jn ? jn.jid : K.uid(); let bloqueo = '';
            legacy.forEach((p) => { const c = Number(d['lg' + p.id]); if (c) p.cat = c; });
            const existentes = jn ? jn.ps.slice() : [];
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
              inf.partidos.push(Object.assign({ id: K.uid(), jid, cat: c, minutos: {}, notas: '', incidencias: [], observaciones: '', res: (d['r' + c] || '').trim(), jugado: !!d['j' + c] }, comunes));
            });
            K.guardar(); K.aviso(bloqueo || 'Partido guardado'); K.render();
          }
        }
      ],
      alMontar: (m, hoja) => hoja.querySelector('[data-logo]').addEventListener('change', async (ev) => {
        const f = ev.target.files[0]; if (!f) return;
        try { logoData = await K.fotoADataURL(f, 220, true); hoja.querySelector('[data-logo-ok]').textContent = ' ✓ cargado'; } catch (x) { K.aviso('No se pudo leer la imagen', true); }
      })
    });
  };

  /* ---------- PDF del informe de partido ---------- */
  function htmlPartido(jn, vista) {
    const inf = K.inf(), ps = vista === 'comb' ? jn.ps : jn.ps.filter((p) => String(p.cat || '') === vista), { hbar } = K.bd;
    const rTodo = resumen(inf, ps), kpi = (n, t) => `<div class="bd-k"><b>${n}</b><span>${t}</span></div>`;
    const por = ps.map((x) => x.realizadoPor).find(Boolean) || '';
    const secciones = ps.map((p) => {
      const r = resumen(inf, [p]);
      const filas = r.lista.map((i) => `<tr><td>${e(momTxt(i))}</td><td><b>${e(nomJ(i.jugadorId))}</b></td><td>${e(K.nombreClase(i.clase))}${i.zona ? '<small>' + e(zonaTxt(i.zona)) + '</small>' : ''}</td><td class="n">${i.enCancha ? 'Sí' : 'No'}</td><td>${e(tratTxt(inf, i)) || '—'}${i.notas ? '<small>' + e(i.notas) + '</small>' : ''}</td><td class="n">${i.retiro ? '<b>Sí</b>' : 'No'}</td></tr>`).join('');
      const conMin = Object.keys(p.minutos || {}).filter((id) => Number(p.minutos[id]) > 0 && K.jugadorGlobal(id)).sort((a, b) => nomJ(a).localeCompare(nomJ(b), 'es'));
      const pares = []; for (let k = 0; k < conMin.length; k += 2) pares.push([conMin[k], conMin[k + 1]]);
      const cel = (id) => (id ? `<td>${e(nomJ(id))}</td><td class="n">${p.minutos[id]}'</td>` : '<td></td><td></td>');
      return `<div class="pt-sec">${ps.length > 1 ? `<h2 class="bit-h2">${e(catTxt(p))}${p.res ? ' · Resultado ' + e(p.res) : ''}</h2>` : ''}
        ${ps.length > 1 ? `<p class="pt-kp"><b>${r.n}</b> atenciones · <b>${r.jugadores}</b> jugadores atendidos · <b>${r.enCancha}</b> atendidos en cancha · <b>${r.retiros}</b> se retiraron</p>` : ''}
        ${r.n ? `<table class="kt"><thead><tr><th>Momento</th><th>Jugador</th><th>Tipo</th><th>Atendido en cancha</th><th>Intervención y comentarios</th><th>Se retiró</th></tr></thead><tbody>${filas}</tbody></table>` : '<p>Sin atenciones registradas en este partido.</p>'}
        ${conMin.length ? `<h2 class="bit-h2">Minutos jugados${ps.length > 1 ? ' · ' + e(catTxt(p)) : ''}</h2><table class="kt kt-min"><thead><tr><th>Jugador</th><th>Min</th><th>Jugador</th><th>Min</th></tr></thead><tbody>${pares.map(([a, b]) => `<tr>${cel(a)}${cel(b)}</tr>`).join('')}</tbody></table>` : ''}
        ${lineas(p.observaciones).length ? `<h2 class="bit-h2">Observaciones${ps.length > 1 ? ' · ' + e(catTxt(p)) : ''}</h2>${vinetas(p.observaciones)}` : ''}</div>`;
    }).join('');
    const sub = [ps.length > 1 ? ps.map((p) => 'Sub ' + p.cat).join(' y ') : (ps[0].cat ? 'Sub ' + ps[0].cat : inf.nombre), jn.fecha ? fc(jn.fecha) : '', jn.local ? 'Local' : 'Visita', ps.length === 1 && ps[0].res ? 'Resultado ' + ps[0].res : ''].filter(Boolean);
    const src = logoSrc(jn);
    return `<div class="bit-print kine-print"><header><div class="vs-logos"><img src="img/insignia-512.png" alt=""><b class="vs-t">vs</b>${src ? `<img class="rv-logo" src="${e(src)}" alt="">` : `<span class="rv-ini">${e((jn.rival || '?').slice(0, 1))}</span>`}</div><div style="flex:1"><h1>Informe de partido · vs ${e(jn.rival)}</h1><p>Santiago Wanderers · ${e(sub.join(' · '))}</p>${por ? `<p>Informe realizado por: <b>${e(por)}</b></p>` : ''}</div></header>
      ${ps.length > 1 ? `<p style="margin:0 0 6px">${ps.map((p) => `<b>${e(catTxt(p))}</b>${p.res ? ' ' + e(p.res) : ''}`).join(' · ')}</p>` : ''}
      <div class="bd-kpis">${kpi(rTodo.n, 'atenciones')}${kpi(rTodo.jugadores, 'jugadores atendidos')}${kpi(rTodo.enCancha, 'atendidos en cancha')}${kpi(rTodo.retiros, 'se retiraron del partido')}</div>
      ${rTodo.n ? `<div class="bd-g" style="margin:10px 0"><section class="bd-p"><h4>Cuándo ocurrió</h4>${hbar(rTodo.porMom)}</section><section class="bd-p"><h4>Tipo de atención</h4>${hbar(rTodo.porClase, '#2f7a4a')}</section></div>` : ''}
      ${secciones}</div>`;
  }
  const nombrePdfPartido = (jn, vista) => `Informe de partido ${jn.rival}${vista === 'comb' ? ' ' + jn.ps.map((p) => 'Sub ' + p.cat).join('-') : vista ? ' Sub ' + vista : ''}${jn.fecha ? ' ' + jn.fecha : ''}`;

  /* ---------- Acciones ---------- */
  const buscar = (id) => K.inf().partidos.find((x) => x.id === id);
  const jornadaPorId = (id) => K.jornadas(K.inf()).find((j) => j.jid === id || j.ps.some((p) => p.id === id));
  const aTodos = (p, f) => { const jn = jornadaPorId(p.id); (jn ? jn.ps : [p]).forEach(f); };
  Object.assign(K.acciones, {
    partInforme(el) { K.ui.partidoId = el.dataset.id; K.ui.partVista = null; K.render(); window.scrollTo(0, 0); },
    partVolver() { K.ui.partidoId = null; K.render(); },
    partIncNueva(el) { const p = buscar(el.dataset.id); if (p) formInc(p); },
    partIncEditar(el) { const p = buscar(el.dataset.id); const i = p && incs(p).find((x) => x.id === el.dataset.inc); if (i) formInc(p, i); },
    partObs(el) { const p = buscar(el.dataset.id); if (p) { p.observaciones = el.value; K.guardar(); K.aviso('Guardado'); } },
    partPor(el) { const p = buscar(el.dataset.id); if (p) { const v = el.value.trim(); aTodos(p, (x) => { x.realizadoPor = v; }); if (v) K.state.ultimoInformante = v; K.guardar(); K.aviso('Guardado'); } },
    partMin(el) { const p = buscar(el.dataset.id); if (!p) return; p.minutos = p.minutos || {}; if (el.value === '') delete p.minutos[el.dataset.j]; else p.minutos[el.dataset.j] = Math.max(0, Math.min(130, Number(el.value) || 0)); K.guardar(); K.aviso('Guardado'); },
    partMinTodos(el) { const p = buscar(el.dataset.id); if (!p) return; p.minutos = p.minutos || {}; K.jugadoresDePartido(K.inf(), p).forEach(({ j }) => { if (p.minutos[j.id] == null || p.minutos[j.id] === '') p.minutos[j.id] = p.duracion || 90; }); K.guardar(); K.aviso('Minutos completados'); K.render(); },
    partPdf(el) {
      const p = buscar(el.dataset.id); if (!p) return;
      const jn = jornadaDe(K.inf(), p), vista = vistaDe(jn);
      K.pdf.documento(htmlPartido(jn, vista), nombrePdfPartido(jn, vista));
    },
    plPartidoSel(el) { estado().plPartido = el.value; },
    plantelPdf() { K.pdf.documento(K.plantelGeneralHTML(), `Informe jugadores contrato y plantel ${K.resolverPeriodo(K.state.periodo).completo}`); },
    plantelPartidoPdf() { const js = jornadasJugadas(); if (!js.length) return; const v = estado().plPartido || (js[0].inf.id + '|' + js[0].jn.jid), x = js.find((q) => q.inf.id + '|' + q.jn.jid === v) || js[0]; K.pdf.documento(K.plantelPartidoHTML(x.inf.id + '|' + x.jn.jid), `Informe de partido ${x.jn.rival} contrato y plantel`); },
    partGenSel(el) { estado().general = el.value; },
    partJugSel(el) { estado().jug = el.value; },
    partJugPdf(el) { const id = estado().jug || (contratados()[0] || { j: {} }).j.id; const g = id && K.jugadorGlobal(id); if (!g) return; K.pdf.documento(K.jugadorPartidosHTML(id), `Informe de partidos ${g.j.nombre} ${K.resolverPeriodo(K.state.periodo).completo}`); },
    jugPartidosPdf(el) { const id = el.dataset.id, g = K.jugadorGlobal(id); if (g) K.pdf.documento(K.jugadorPartidosHTML(id), `Informe de partidos ${g.j.nombre} ${K.resolverPeriodo(K.state.periodo).completo}`); },
    partGenPdf() { const c = estado().general || 'todas', al = ALCANCES.find((a) => a[0] === c) || ALCANCES[0]; K.pdf.documento(htmlGeneral(c), `Informe de partidos ${al[1]} ${K.resolverPeriodo(K.state.periodo).completo}`); },
    vaciarPartidos(el, ev) {
      if (ev) ev.preventDefault();
      const inf = K.inf(), n = K.jornadas(inf).length;
      K.confirmar(`¿Borrar los ${n} partidos de ${K.esc(inf.nombre)} y las atenciones registradas en ellos? No se puede deshacer.`, 'Vaciar calendario', () => { inf.partidos.slice().forEach((p) => K.quitarPartidoYAtenciones(inf, p)); K.ui.partidoId = null; K.guardar(); K.aviso('Calendario vaciado'); K.render(); });
    },
    nuevoPartido() { K.formPartido(); },
    editPartido(el) { const jn = jornadaPorId(el.dataset.id); if (jn) K.formPartido(jn); },
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

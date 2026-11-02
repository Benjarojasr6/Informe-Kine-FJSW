/* Informe PDF del torneo (v1.6, fase 5B). Páginas tamaño carta con el mismo estilo de la ficha del jugador (franja verde, tarjetas blancas,
   escudo del club en la cabecera). La portada es una página propia; el resto son bloques (tarjetas y trozos de tabla) que se reparten en
   páginas midiendo su alto real, así nada se corta ni se desborda. Funciona con torneos de un solo partido, sin partidos, sin inscritos y con muchos inscritos. */
(function () {
  const K = window.K, T = K.torneos, e = K.esc;
  const fc = (iso) => K.fechaCorta(iso);
  const corto = (iso) => (iso ? fc(iso).slice(0, 5) : '');
  const ESC = '<img class="sw-vs" src="img/escudo-sw-vs.png" alt="" width="35" height="56">';
  const num1 = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');
  const anioDe = (t) => Number((t.desde || t.hasta || '').slice(0, 4)) || Number(K.state && K.state.periodo && K.state.periodo.anio) || new Date().getFullYear();
  const lista = (a, n) => (a.length > n ? a.slice(0, n).join(', ') + ' y ' + (a.length - n) + ' más' : a.join(', '));
  const cortar = (txt, n) => (String(txt).length > n ? String(txt).slice(0, n - 1).trimEnd() + '…' : String(txt));

  /* ---------- Bloques ---------- */
  const tabla = (cab, filas, cls) => `<table class="kn-t tj-t${cls ? ' ' + cls : ''}"><thead><tr>${cab.map(([t, n]) => `<th${n ? ' class="n"' : ''}>${e(t)}</th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table>`;
  const trozos = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
  // Sección: título pegado al primer bloque (el título nunca queda solo al final de una página)
  function seccion(titulo, nota, bloques, vacio) {
    const cab = `<h3 class="fj-sec">${e(titulo)}</h3>${nota ? `<p class="fj-nota" style="margin:0 0 6px">${nota}</p>` : ''}`;
    if (!bloques.length) return [cab + `<p class="fj-nota tj-vacio">${e(vacio || 'Sin registros.')}</p>`];
    const out = bloques.slice(); out[0] = cab + out[0]; return out;
  }
  const filaTxt = (...c) => `<tr>${c.join('')}</tr>`;
  const td = (v, o) => `<td${o && o.n ? ' class="n"' : ''}>${v}</td>`;

  function bloqueResumen(inf, t) {
    const r = T.resumenTorneo(inf, t), kpi = (n, x) => `<div class="fj-k"><b>${n}</b><span>${x}</span></div>`;
    return seccion('Resumen del torneo', '', [`<div class="fj-card"><div class="fj-kpis tj-kpis" data-tj-kpis>${kpi(r.jugados, 'partidos jugados')}${kpi(r.conRes ? `${r.g}-${r.e}-${r.p}` : '—', 'resultado G-E-P')}${kpi(r.atenciones, 'atenciones')}${kpi(r.lesionesNuevas, 'lesiones nuevas')}
      ${kpi(r.conmociones, 'conmociones')}${kpi(r.atendidos, 'jugadores atendidos')}${kpi(r.minutos, 'minutos totales')}${kpi(r.enGira, 'atenciones en gira')}</div>
      <p class="fj-nota">${r.partidos} partido${r.partidos === 1 ? '' : 's'} en el torneo (${r.jugados} jugado${r.jugados === 1 ? '' : 's'}) · ${r.inscritos} jugador${r.inscritos === 1 ? '' : 'es'} inscrito${r.inscritos === 1 ? '' : 's'} · ${r.molestias} molestia${r.molestias === 1 ? '' : 's'} · ${r.retiros} retiro${r.retiros === 1 ? '' : 's'} por lesión. El marcador se lee Wanderers – rival. Atenciones y lesiones: las marcadas con este torneo, las de sus partidos y las de sus inscritos dentro de las fechas del torneo.</p></div>`]);
  }

  function bloquesPartidos(inf, t) {
    const orden = T.ordenados(inf, t), P = K.part;
    const fila = (x) => {
      const jn = x.jn, rs = K.resumenPartidos(inf, jn.ps), jug = jn.ps.some((p) => p.jugado);
      const res = jn.ps.map((p) => (p.res ? (jn.ps.length > 1 && p.cat ? 'Sub ' + p.cat + ' ' : '') + p.res : '')).filter(Boolean).join(' · ') || (jug ? '—' : 'Por jugar');
      const ad = jn.ps.filter((p) => p.antidopaje && p.antidopaje.hubo);
      return filaTxt(td(x.fecha ? e(corto(x.fecha)) : 'Sin fecha'), td(`<b>${e(jn.rival)}</b><small>${jn.local ? 'Local' : 'Visita'}${jn.ps.length > 1 ? ' · ' + jn.ps.map((p) => 'Sub ' + p.cat).join(' y ') : jn.ps[0].cat ? ' · Sub ' + jn.ps[0].cat : ''}</small>`), td(e(res)),
        td(x.dias == null ? '—' : x.dias === 0 ? 'Mismo día' : x.dias, { n: true }), td(rs.n, { n: true }), td(rs.retiros, { n: true }), td(ad.length ? 'Sí' : '—', { n: true }));
    };
    const CAB = [['Fecha'], ['Rival'], ['Resultado'], ['Días desde el anterior', 1], ['Atenc.', 1], ['Retiros', 1], ['Antidopaje', 1]];
    const grupos = [];
    (t.fases || []).forEach((f) => grupos.push([f.nombre, orden.filter((x) => x.jn.p0.fase === f.id)]));
    const conocidas = new Set((t.fases || []).map((f) => f.id));
    grupos.push(['Sin fase', orden.filter((x) => !x.jn.p0.fase || !conocidas.has(x.jn.p0.fase))]);
    const bloques = [];
    grupos.filter(([, a]) => a.length).forEach(([nombre, arr]) => trozos(arr, 9).forEach((ch, i) => bloques.push(`<h4 class="fj-mes">${e(nombre)} <small class="suave">(${arr.length})${i ? ' · continuación' : ''}</small></h4>${tabla(CAB, ch.map(fila))}`)));
    void P;
    return seccion('Partidos por fase', 'Resultado Wanderers – rival, atenciones y retiros de cada partido. “Días desde el anterior” cuenta días de calendario entre partidos con fecha.', bloques, 'Este torneo aún no tiene partidos.');
  }

  function bloquesJugadores(inf, t) {
    const c = T.carga(inf, t), reg = T.registros(inf, t), at = {}, ret = {};
    reg.atenciones.forEach((a) => { at[a.jugadorId] = (at[a.jugadorId] || 0) + 1; });
    T.partidosDe(inf, t).forEach((p) => (p.incidencias || []).forEach((i) => { if (i.retiro === true) ret[i.jugadorId] = (ret[i.jugadorId] || 0) + 1; }));
    const filas = c.filas.slice(), vistos = new Set(filas.map((r) => r.id));
    Object.keys(at).filter((id) => !vistos.has(id) && K.jugadorGlobal(id)).map((id) => K.jugadorGlobal(id).j).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .forEach((j) => filas.push({ id: j.id, j, num: null, inscrito: false, pj: 0, min: 0, descansos: [], descansoCorto: false, cargaAlta: false }));
    const fila = (r) => {
      const al = [r.descansoCorto ? `Descanso corto: ${r.descansos.map((d) => `${corto(d.a)} y ${corto(d.b)}`).join(', ')}` : '', r.cargaAlta ? 'Carga alta' : ''].filter(Boolean);
      return filaTxt(td(`<b>${e(r.j.nombre)}</b>${r.inscrito ? '' : '<small>no inscrito</small>'}`), td(r.num || '—', { n: true }), td(e(r.j.categoria || '—')), td(r.pj, { n: true }), td(r.min, { n: true }), td(at[r.id] || 0, { n: true }), td(ret[r.id] || 0, { n: true }),
        td(al.length ? `<b class="tj-al">${al.map(e).join('<br>')}</b>` : '—'));
    };
    const CAB = [['Jugador'], ['N.º', 1], ['Categoría'], ['Partidos', 1], ['Minutos', 1], ['Atenc.', 1], ['Retiros', 1], ['Alertas']];
    const nD = c.filas.filter((r) => r.descansoCorto).length, nA = c.filas.filter((r) => r.cargaAlta).length;
    const nota = `${e(T.REGLA_DESCANSO)}<br>${e(T.REGLA_CARGA)}${filas.length ? `<br><b>${nD}</b> con descanso corto · <b>${nA}</b> con carga alta.` : ''}`;
    return seccion('Jugadores: minutos, atenciones y alertas', nota, trozos(filas, 12).map((ch) => tabla(CAB, ch.map(fila))), 'Sin jugadores inscritos ni minutos registrados.');
  }

  function bloquesLesiones(inf, t) {
    const l = T.lesionesDurante(inf, t);
    const fila = (x) => { const es = T.estadoCaso(x.c); return filaTxt(td(`<b>${e(x.j.nombre)}</b>`), td(`${e(x.c.titulo || '—')}<small>${x.c.tipo === 'lesion' ? 'Lesión' : 'Molestia'}${x.nueva ? '' : ' · anterior al torneo'}</small>`), td(e(x.zona || '—')), td(e(K.GRAVEDADES[x.c.gravedad] || '—')),
      td(x.c.inicio ? e(corto(x.c.inicio)) : '—', { n: true }), td(e(x.retiro || '—')), td(e(es.txt))); };
    const CAB = [['Jugador'], ['Lesión o molestia'], ['Zona'], ['Gravedad'], ['Inicio', 1], ['¿Siguió o se retiró?'], ['Estado hoy']];
    const nA = l.filter((x) => T.estadoCaso(x.c).k === 'alta').length, nR = l.filter((x) => T.estadoCaso(x.c).k === 'retorno').length, nB = l.length - nA - nR;
    return seccion('Lesiones y molestias durante el torneo', l.length ? `${l.length} caso${l.length === 1 ? '' : 's'}: <b>${nA}</b> con alta · <b>${nR}</b> ya volvieron a entrenar o jugar · <b>${nB}</b> siguen en baja o en seguimiento.` : '', trozos(l, 8).map((ch) => tabla(CAB, ch.map(fila))), 'Sin lesiones ni molestias registradas en este torneo.');
  }

  function bloquesChequeos(inf, t) {
    const ri = T.chequeoResumen(t, 'inicio'), rf = T.chequeoResumen(t, 'fin');
    const hay = ri.total && (ri.total - ri.sin || rf.total - rf.sin);
    const resumen = `<div class="fj-card">${tabla([['Estado'], ['Al inicio', 1], ['Al final', 1]], [['Apto', 'apto'], ['Limitado', 'limitado'], ['Baja', 'baja'], ['Sin chequear', 'sin']].map(([n, k]) => filaTxt(td(`<b>${n}</b>`), td(ri[k], { n: true }), td(rf[k], { n: true }))))}
      <p class="fj-nota">${ri.total} jugador${ri.total === 1 ? '' : 'es'} inscrito${ri.total === 1 ? '' : 's'}.</p></div>`;
    const no = [];
    T.inscritosOrdenados(t).forEach(({ x, g }) => ['inicio', 'fin'].forEach((k) => { const c = T.chequeoDe(t, k, x.id); if (c && c.estado !== 'apto') no.push({ g, k, c }); }));
    const fila = (x) => filaTxt(td(`<b>${e(x.g.j.nombre)}</b>`), td(x.k === 'inicio' ? 'Al inicio' : 'Al final'), td(e(T.ESTADOS.find((s) => s[0] === x.c.estado)[1])), td(e(x.c.nota || '—')));
    const bl = [resumen];
    if (no.length) trozos(no, 12).forEach((ch, i) => bl.push(`${i ? '' : '<h4 class="fj-mes">Jugadores que no estaban aptos</h4>'}${tabla([['Jugador'], ['Momento'], ['Estado'], ['Nota']], ch.map(fila))}`));
    else if (hay) bl.push('<p class="fj-nota">Todos los chequeos registrados están en estado Apto.</p>');
    else bl.push('<p class="fj-nota tj-vacio">Aún no se registraron chequeos de salud de inicio ni de fin.</p>');
    return seccion('Chequeos de salud de inicio y de fin', '', bl);
  }

  function bloqueIntervenciones(inf, t) {
    const top = T.intervenciones(inf, t).slice(0, 10), max = top.length ? top[0][1] : 1;
    const cuerpo = top.length ? `<div class="fj-card tj-barras">${top.map(([n, v]) => `<div class="tj-fila"><span>${e(cortar(n, 34))}</span><span class="tj-barra"><i style="width:${Math.max(3, Math.round(100 * v / max))}%"></i></span><b>${v}</b></div>`).join('')}</div>` : '';
    return seccion('Atenciones por intervención', top.length ? 'Las 10 intervenciones más usadas en las atenciones del torneo (suma de unidades).' : '', top.length ? [cuerpo] : [], 'No hay atenciones con intervenciones en este torneo.');
  }

  function bloquesMedicamentos(inf, t) {
    const m = T.medicamentos(inf, t), ctl = T.antidopaje(inf, t);
    const leyenda = `<p class="fj-aviso tj-leyenda" data-leyenda-antidopaje><b>${e(T.LEYENDA_ANTIDOPAJE)}</b></p>`;
    const fila = (x) => filaTxt(td(e(corto(x.fecha)), { n: true }), td(`<b>${e(x.j.nombre)}</b>`), td(e(x.nombre)), td(e(x.dosis)));
    const bl = m.length ? trozos(m, 12).map((ch) => tabla([['Fecha', 1], ['Jugador'], ['Medicamento'], ['Dosis']], ch.map(fila))) : [`<p class="fj-nota tj-vacio">${t.desde || t.hasta ? 'No hay medicamentos entregados dentro de las fechas del torneo.' : 'El torneo no tiene fechas: no se pueden buscar medicamentos.'}</p>`];
    bl[0] = leyenda + bl[0];
    if (ctl.length) {
      const filaC = (p) => { const ns = (p.antidopaje.jugadores || []).filter((id) => K.jugadorGlobal(id)).map((id) => K.jugadorGlobal(id).j.nombre); return filaTxt(td(`<b>${e(p.rival)}</b><small>${p.cat ? 'Sub ' + p.cat : ''}</small>`), td(p.fecha ? e(corto(p.fecha)) : '—', { n: true }), td(ns.length ? e(lista(ns, 8)) : '—'), td(e(cortar(p.antidopaje.nota || '—', 160)))); };
      trozos(ctl, 8).forEach((ch, i) => bl.push(`${i ? '' : '<h4 class="fj-mes">Controles antidopaje en los partidos</h4>'}${tabla([['Partido'], ['Fecha', 1], ['Jugadores controlados'], ['Nota']], ch.map(filaC))}`));
    }
    return seccion('Medicamentos y antidopaje', m.length ? `${m.length} medicamento${m.length === 1 ? '' : 's'} entregado${m.length === 1 ? '' : 's'} durante el torneo.` : '', bl);
  }

  function bloquesConmociones(inf, t) {
    const c = T.conmociones(inf, t); if (!c.length) return [];
    return seccion('Conmociones cerebrales (SCAT5)', e(K.conmocion.AVISO), trozos(c, 3).map((ch) => `<div class="tj-cm">${K.conmocion.tablaHTML(ch, { cls: 'kn-t', partido: true })}</div>`));
  }

  function bloquesReemplazos(inf, t) {
    const r = T.reemplazos(inf, t);
    const bl = r.map((x) => `<div class="fj-card tj-reemp" data-tj-reemp><h3>${e(x.j.nombre)} <small>${e(x.p.rival)}${x.p.cat ? ' · Sub ' + x.p.cat : ''}${x.p.fecha ? ' · ' + e(corto(x.p.fecha)) : ''}${x.conm ? ' · conmoción cerebral' : ''}</small></h3>
      <p class="fj-crit"><b>${x.hecho ? 'Reemplazo realizado' : 'Reemplazo no confirmado'}</b></p>${x.informe ? `<p class="fj-crit" style="white-space:pre-line">${e(x.informe)}</p>` : '<p class="fj-nota">Sin informe médico escrito.</p>'}</div>`);
    return seccion('Reemplazos por lesión · informe médico', r.length ? 'El informe de las conmociones sale de su propio registro.' : '', bl, 'Sin reemplazos por lesión registrados.');
  }

  function bloquesLogistica(inf, t) {
    const L = t.logistica || {}, dd = (tit, v, x) => `<div${x ? ' class="x"' : ''}><dt>${e(tit)}</dt><dd>${v ? e(v) : '<span class="suave">—</span>'}</dd></div>`;
    const huso = L.huso === '' || L.huso == null ? '' : Number(L.huso);
    const card = `<div class="fj-card"><dl class="fj-dl">${dd('País', t.pais)}${dd('Sede', t.sede)}${dd('Se juega fuera de la ciudad base', t.viaje ? 'Sí (viaje)' : 'No')}${dd('Altitud', L.altitud !== '' && L.altitud != null ? L.altitud + ' msnm' : '')}${dd('Diferencia horaria', huso === '' ? '' : (huso > 0 ? '+' : '') + huso + ' h respecto a la ciudad base')}${dd('Clima', L.clima)}${dd('Hotel', L.hotel, 1)}${dd('Vuelos', L.vuelos, 1)}${dd('Notas del viaje', L.notas, 1)}</dl></div>`;
    const bl = [card];
    if (K.verPrivado && K.verPrivado()) {
      const sg = T.segurosDe(inf, t);
      if (sg.length) {
        const fila = (s) => { const g = K.jugadorGlobal(s.jugadorId); return filaTxt(td(`<b>${e(g ? g.j.nombre : '—')}</b>`), td(e(s.diagnostico || 'sin diagnóstico')), td(s.activacion ? e(corto(s.activacion)) : '—', { n: true }), td(e(s.pais || '—')), td(e(s.cobertura || '—')), td(e(s.poliza || '—'))); };
        trozos(sg, 10).forEach((ch, i) => bl.push(`${i ? '' : '<h4 class="fj-mes">Seguro en el exterior</h4>'}${tabla([['Jugador'], ['Motivo'], ['Fecha', 1], ['País'], ['Cobertura'], ['Póliza']], ch.map(fila))}${i === trozos(sg, 10).length - 1 ? '<p class="fj-nota">Datos del seguro: uso interno del área kinésica, no compartir fuera de ella.</p>' : ''}`));
      } else bl.push('<p class="fj-nota tj-vacio">Sin activaciones del seguro en este torneo.</p>');
    }
    if (t.notas) bl.push(`<div class="fj-card"><h3>Notas del torneo</h3><p class="fj-crit" style="white-space:pre-line">${e(t.notas)}</p></div>`);
    return seccion('Logística y seguro en el exterior', '', bl);
  }

  /* ---------- Portada ---------- */
  function portada(inf, t, total) {
    const r = T.resumenTorneo(inf, t), anio = anioDe(t), dd = (tit, v, x) => `<div${x ? ' class="x"' : ''}><dt>${e(tit)}</dt><dd>${v ? v : '<span class="suave">—</span>'}</dd></div>`;
    let staff = []; try { staff = (K.textosAnio(inf, anio).staff || []).filter((s) => s && (s.personas || []).length); } catch (x) { staff = []; }
    const filaS = (s) => `<div class="tj-staff"><b>${e(cortar(s.cargo || '', 40))}</b><span>${e(cortar(s.personas.map((p) => p.nombre + (p.ocasional ? ' (apoyo)' : '')).filter(Boolean).join(', '), 150))}</span></div>`;
    const cuerpoS = staff.length ? staff.slice(0, 12).map(filaS).join('') + (staff.length > 12 ? `<p class="fj-nota">y ${staff.length - 12} cargo${staff.length - 12 === 1 ? '' : 's'} más</p>` : '') : '<p class="fj-nota">El cuerpo técnico de este año aún no está cargado (Partidos → Cuerpo técnico).</p>';
    return K.rep.pagina('p-resumen p-equipo fj tj tj-portada', `<h2>Informe del torneo</h2><div class="fj-cuerpo">
      <div class="fj-cab tj-cab-g">${ESC}<div class="fj-cab-t"><h1>${e(t.nombre)}</h1><p>Informe del torneo · Santiago Wanderers · Kinesiología Fútbol Joven</p><p>Emitido el ${e(fc(K.hoy()))}</p></div></div>
      <div class="fj-card"><h3>Datos del torneo</h3><dl class="fj-dl">${dd('Tipo', e(t.tipo))}${dd('Estado', e(T.estado(t)))}${dd('Sede y país', e(T.dondeTxt(t)))}${dd('Fechas', e(T.fechasTxt(t)))}${dd('Categorías', e(T.catsTxt(t, inf)))}${dd('Se juega fuera de la ciudad base', t.viaje ? 'Sí (viaje)' : 'No')}
        ${dd('Partidos', `${r.partidos} (${r.jugados} jugado${r.jugados === 1 ? '' : 's'})`)}${dd('Jugadores inscritos', String(r.inscritos))}</dl></div>
      <div class="fj-card"><h3>Cuerpo técnico ${anio}</h3>${cuerpoS}</div></div>`)
      .replace('<!--PIE-->', K.rep.PIE(`${cortar(t.nombre, 40)} · 1 / ${total}`));
  }

  /* ---------- Reparto en páginas (midiendo el alto real de cada bloque) ---------- */
  const envolver = (b) => `<div class="${/^<(h4 class="fj-mes"|div class="fj-it")/.test(b) ? 'fj-blq fj-blq-s' : 'fj-blq'}">${b}</div>`;
  function repartir(bloques, cab) {
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;left:-99999px;top:0;width:816px;visibility:hidden;pointer-events:none';
    host.innerHTML = K.rep.pagina('p-resumen p-equipo fj tj', '<h2>Informe del torneo</h2><div class="fj-cuerpo"></div>');
    document.body.appendChild(host);
    try {
      const sec = host.firstElementChild, panel = sec.querySelector('.panel'), cuerpo = sec.querySelector('.fj-cuerpo');
      const padB = parseFloat(getComputedStyle(panel).paddingBottom) || 63, top = cuerpo.getBoundingClientRect().top - sec.getBoundingClientRect().top;
      const cap = Math.floor(sec.getBoundingClientRect().height - padB - top) - 10;
      cuerpo.innerHTML = [cab].concat(bloques).map(envolver).join('');
      const hs = Array.from(cuerpo.children).map((n) => Math.ceil(n.getBoundingClientRect().height + (parseFloat(getComputedStyle(n).marginBottom) || 0)));
      const lim = cap - hs[0], paginas = []; let cur = [], h = 0;
      bloques.forEach((b, i) => {
        let bh = hs[i + 1], html = b;
        if (bh > lim) { html = `<div style="max-height:${lim - 10}px;overflow:hidden">${b}</div>`; bh = lim; } // un bloque más alto que una página (no debería pasar): se recorta
        if (cur.length && h + bh > lim) { paginas.push(cur); cur = []; h = 0; }
        cur.push(html); h += bh;
      });
      if (cur.length || !paginas.length) paginas.push(cur);
      return paginas;
    } finally { host.remove(); }
  }

  // Páginas del informe del torneo (lista de textos HTML <section class="pagina">)
  function paginas(inf, t) {
    const blqs = [].concat(bloqueResumen(inf, t), bloquesPartidos(inf, t), bloquesJugadores(inf, t), bloquesLesiones(inf, t), bloquesChequeos(inf, t), bloqueIntervenciones(inf, t), bloquesMedicamentos(inf, t), bloquesConmociones(inf, t), bloquesReemplazos(inf, t), bloquesLogistica(inf, t));
    // un título de sección (h3) nunca queda solo: ya viene pegado a su primer bloque (ver seccion)
    const cab = `<div class="fj-cab fj-cab-c">${ESC}<div class="fj-cab-t"><h1>${e(cortar(t.nombre, 60))}</h1><p>Informe del torneo · ${e(T.fechasTxt(t))}</p></div></div>`;
    const rp = repartir(blqs, cab), total = rp.length + 1;
    return [portada(inf, t, total)].concat(rp.map((b, i) => K.rep.pagina('p-resumen p-equipo fj tj', `<h2>Informe del torneo${i ? ' <small>(continuación)</small>' : ''}</h2><div class="fj-cuerpo">${envolver(cab)}${b.map(envolver).join('')}</div>`)
      .replace('<!--PIE-->', K.rep.PIE(`${cortar(t.nombre, 40)} · ${i + 2} / ${total}`))));
  }
  // Nombre del archivo: “Informe torneo - Nombre - AAAA” (el nombre se acorta para que el año nunca se corte)
  const tituloPdf = (t) => { const fin = ' - ' + anioDe(t), base = 'Informe torneo - '; const nom = String(t.nombre).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim(); return base + nom.slice(0, Math.max(10, 84 - base.length - fin.length)).trim() + fin; };
  async function informePdf(t) {
    if (!t) return;
    try { await document.fonts.ready; } catch (x) { /* sigue */ }
    return K.pdf.paginas(paginas(K.inf(), t), tituloPdf(t));
  }
  Object.assign(T, { paginasInforme: paginas, informePdf, tituloPdf });

  /* ---------- Menú de PDF (pantalla Informe) y acciones ---------- */
  T.menuPdfHTML = (inf) => (T.puedeEd() ? `<button class="btn sec" data-acc="pdfTorneo" data-pdf-torneo>${K.uiIco('pdf', 18)} <span>Informe del torneo<small>${T.lista(inf).length ? 'Elige el torneo: partidos, carga, salud, antidopaje y logística' : 'Aún no hay torneos (se crean en Partidos → Torneos)'}</small></span></button>` : '');
  Object.assign(K.acciones, {
    torneoInforme(el) { const t = T.buscar(K.inf(), el.dataset.id); if (t) informePdf(t); },
    pdfTorneo() {
      const inf = K.inf(), ts = T.lista(inf).slice().sort((a, b) => (b.desde || '').localeCompare(a.desde || '') || a.nombre.localeCompare(b.nombre, 'es'));
      if (!ts.length) { K.aviso('Primero crea un torneo en Partidos → Torneos', true); return; }
      if (ts.length === 1) { informePdf(ts[0]); return; }
      K.modal({
        titulo: 'Informe del torneo',
        cuerpo: `<label class="campo"><span>Torneo</span><select name="torneoId">${ts.map((t) => `<option value="${e(t.id)}"${K.ui.torneoId === t.id ? ' selected' : ''}>${e(t.nombre)}${T.fechasTxt(t) !== 'Sin fechas' ? ' · ' + e(T.fechasTxt(t)) : ''}</option>`).join('')}</select></label><p class="suave" style="margin:0">PDF tamaño carta con el resumen, los partidos, la carga de los jugadores, la salud, el antidopaje y la logística del torneo.</p>`,
        botones: [{ txt: 'Cancelar', cls: 'sec' }, { txt: 'Descargar PDF', fn: (m, hoja) => { const t = T.buscar(inf, K.datos(hoja).torneoId); setTimeout(() => informePdf(t), 60); } }]
      });
    }
  });
})();

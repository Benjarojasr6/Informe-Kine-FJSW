/* Categorías (Sub 15, 16, 18, 20): inicio, selector superior y filtros. Cada categoría ve sus jugadores y registros;
   el informe es combinado por pareja (Sub 15-16 y Sub 18-20). */
(function () {
  const K = window.K;
  const e = K.esc;
  K.GRUPOS = [
    { id: '15-16', nombre: 'Sub 15-16', cats: [15, 16] },
    { id: '18-20', nombre: 'Sub 18-20', cats: [18, 20] }
  ];
  K.grupoDe = (cat) => K.GRUPOS.find((g) => g.cats.includes(Number(cat)));
  K.catNum = (j) => { const m = /\d+/.exec((j && j.categoria) || ''); return m ? Number(m[0]) : null; };
  // Jugadores de la categoría elegida (los que no tienen categoría se muestran en todas).
  K.jugadoresCat = (inf) => {
    const c = K.ui && K.ui.cat;
    return c ? inf.jugadores.filter((j) => { const n = K.catNum(j); return n === null || n === c; }) : inf.jugadores;
  };
  // Orden de los jugadores: manual (flechas en Jugadores) o por categoría y nombre.
  K.ordenJugadores = (inf, arr) => (inf.ordenManual ? arr.slice() : arr.slice().sort((a, b) => (a.categoria || '').localeCompare(b.categoria || '', 'es') || a.nombre.localeCompare(b.nombre, 'es')));
  K.enCat = (inf, jid) => {
    if (!K.ui.cat) return true;
    const j = K.jugador(inf, jid); if (!j) return true;
    const n = K.catNum(j); return n === null || n === K.ui.cat;
  };
  K.categoriaNueva = (inf) => {
    if (K.ui.cat) return 'Sub ' + K.ui.cat;
    const n = (inf.categorias.match(/\d+/g) || []); return n.length ? 'Sub ' + n[n.length - 1] : '';
  };

  /* ---------- Partidos por categoría (cada partido es de una categoría; una “jornada” junta los partidos del mismo rival y día) ---------- */
  K.CATS_ORDEN = [20, 18, 16, 15]; // se juegan en este orden: Sub 20 y Sub 18; Sub 16 y Sub 15
  K.catPartido = (p) => (p && p.cat ? Number(p.cat) : null);
  K.jugadorGlobal = (id) => { for (const inf of K.state.informes) { const j = inf.jugadores.find((x) => x.id === id); if (j) return { j, inf }; } return null; };
  K.nombreJugadorGlobal = (id) => { const g = K.jugadorGlobal(id); return g ? g.j.nombre : '—'; };
  // Ordena categorías de mayor a menor.
  const porCatDesc = (a, b) => (K.catPartido(b) || 0) - (K.catPartido(a) || 0);
  // Arregla partidos antiguos: asigna jid y, si el rival decía “Sub 18”, lo pasa a la categoría; quita el calendario de ejemplo sin tocar.
  K.migrarPartidos = (inf) => {
    let cambio = false;
    const base = new Map((K.CALENDARIO_BASE || []).map((x) => [x[0], x[1]]));
    const intactos = (p) => p.cat === undefined && base.has(p.rival) && p.logo === base.get(p.rival) && !p.fecha && !p.res && !(p.incidencias || []).length && !Object.keys(p.minutos || {}).length && !p.observaciones && !p.notas;
    if (K.puedeEditar && K.puedeEditar() && inf.partidos.length && inf.partidos.every(intactos)) { inf.partidos.length = 0; return true; }
    inf.partidos.forEach((p) => {
      if (p.cat === undefined) {
        const m = /\b(?:sub\.?\s*)(15|16|18|20)\b/i.exec(p.rival || '');
        if (m) { p.cat = Number(m[1]); p.rival = p.rival.replace(m[0], '').replace(/[-–·()]+\s*$/, '').replace(/\s{2,}/g, ' ').trim(); } else p.cat = null;
        cambio = true;
      }
      if (!p.jid) { p.jid = p.id; cambio = true; }
    });
    // Mismo rival y misma fecha en categorías distintas = una sola jornada.
    const vistos = new Map();
    inf.partidos.forEach((p) => {
      if (!p.cat || !p.fecha) return;
      const k = (p.rival || '').trim().toLowerCase() + '|' + p.fecha;
      const o = vistos.get(k);
      if (!o) vistos.set(k, p);
      else if (o.cat !== p.cat && o.jid !== p.jid && !inf.partidos.some((q) => q !== p && q.jid === p.jid)) { p.jid = o.jid; cambio = true; }
    });
    return cambio;
  };
  K.jornadas = (inf, cat) => {
    if (K.migrarPartidos(inf)) K.guardar();
    const mapa = new Map(), out = [];
    inf.partidos.forEach((p) => {
      if (cat && p.cat && Number(p.cat) !== Number(cat)) return;
      let j = mapa.get(p.jid || p.id);
      if (!j) { j = { jid: p.jid || p.id, ps: [] }; mapa.set(j.jid, j); out.push(j); }
      j.ps.push(p);
    });
    out.forEach((j) => { j.ps.sort(porCatDesc); const p0 = j.ps[0]; Object.assign(j, { p0, rival: p0.rival, torneo: p0.torneo || '', logo: p0.logo, logoData: p0.logoData, local: p0.local, fecha: p0.fecha || '', jugado: j.ps.some((p) => p.jugado) }); });
    return out;
  };
  K.etiquetaCatPartido = (p) => (p.cat ? 'Sub ' + p.cat : 'Sin categoría');
  // Jugadores que pueden participar en un partido: los de esa categoría y los que “también juegan” en ella (aunque estén en otro informe).
  K.jugadoresDePartido = (inf, p) => {
    const c = K.catPartido(p), out = [];
    K.state.informes.forEach((i) => i.jugadores.forEach((j) => {
      if (j.activo === false) return;
      const n = K.catNum(j), tb = (j.tambien || []).map((x) => Number((/\d+/.exec(x) || [])[0]));
      const propio = i === inf && (!c || n === null || n === c), visitante = c && n !== c && tb.includes(c);
      if (propio || visitante) out.push({ j, inf: i, visitante: !!visitante });
    }));
    return out.sort((a, b) => a.j.nombre.localeCompare(b.j.nombre, 'es'));
  };
  // Categorías en las que un jugador ha jugado o recibido atención dentro del período.
  K.catsJugadas = (j, per) => {
    const r = {};
    K.state.informes.forEach((i) => i.partidos.forEach((p) => {
      if (!p.cat || !K.partidoEnPeriodo(p, per)) return;
      if ((Number((p.minutos || {})[j.id]) || 0) > 0 || (p.incidencias || []).some((x) => x.jugadorId === j.id)) r[p.cat] = (r[p.cat] || 0) + 1;
    }));
    return r;
  };

  const digitos = (inf) => ((inf.nombre + ' ' + (inf.categorias || '')).match(/\d+/g) || []).map(Number);
  K.buscarInformeGrupo = (g) => K.state.informes.find((i) => i.grupo === g.id) ||
    K.state.informes.find((i) => { const d = digitos(i); return g.cats.every((c) => d.includes(c)); });
  K.informeGrupo = (g) => {
    let inf = K.buscarInformeGrupo(g);
    if (!inf) {
      inf = K.nuevoInforme({ nombre: g.nombre, categorias: g.nombre, anio: K.state.periodo.anio });
      K.state.informes.push(inf);
    }
    inf.grupo = g.id;
    return inf;
  };
  K.seleccionarCat = (cat, conservar) => {
    const g = K.grupoDe(cat);
    K.state.activo = K.informeGrupo(g).id;
    K.ui.alcance = 'comb'; K.ui.cat = Number(cat); if (!conservar) K.ui.pantalla = 'informe'; K.ui.jugadorId = null; K.ui.filtroJ = '';
    K.guardar(); K.render(); window.scrollTo(0, 0);
  };
  // Vista del informe: combinado (toda la pareja) o único de una categoría.
  // Informe general Sub 15 a Sub 20 (para el cuerpo técnico): junta los dos informes en uno virtual (solo lectura).
  K.informeTodas = () => {
    const infs = K.GRUPOS.map((g) => K.buscarInformeGrupo(g)).filter(Boolean);
    const base = infs[0] || K.inf();
    const unir = (k) => [].concat(...infs.map((i) => i[k] || []));
    const trat = [], ind = [];
    infs.forEach((i) => { i.tratamientos.forEach((t) => { if (!trat.some((x) => x.id === t.id)) trat.push(t); }); i.indicadores.forEach((x) => { if (!ind.some((y) => y.id === x.id)) ind.push(x); }); });
    const v = Object.assign({}, base, { id: 'todas', nombre: 'Sub 15-20', categorias: 'Sub 15 a Sub 20', jugadores: unir('jugadores'), casos: unir('casos'), atenciones: unir('atenciones'), eventos: unir('eventos'),
      asistencias: unir('asistencias'), seguros: unir('seguros'), segEventos: unir('segEventos'), partidos: unir('partidos'), manuales: [], camposExtra: base.camposExtra || [], tratamientos: trat, indicadores: ind,
      conclusiones: base.conclusionesTodas || '', objetivos: base.objetivosTodas || '', firmante: base.firmante || '', ordenManual: false, ordenPartidos: false, _unico: true, _todas: true });
    return v;
  };
  // Categoría en la que ocurrió un registro (atención o molestia de partido): la del partido; sin partido, vale la del jugador.
  K.catRegistro = (r) => {
    if (r.catJuego) return Number(r.catJuego);
    if (r.partidoId) for (const i of K.state.informes) { const p = i.partidos.find((x) => x.id === r.partidoId); if (p) return p.cat ? Number(p.cat) : null; }
    return null;
  };
  // Vista del informe para las categorías S: los registros de partido cuentan en la categoría donde se jugó el partido.
  // Los jugadores de otras categorías que jugaron aquí quedan como “invitados” (se marcan con _inv y van al final del informe).
  K.vistaCategorias = (inf, S, propios) => {
    const ids = new Set(propios.map((j) => j.id)), inv = new Map(), out = { casos: [], atenciones: [] };
    K.state.informes.forEach((i) => ['casos', 'atenciones'].forEach((k) => i[k].forEach((r) => {
      const g = K.catRegistro(r);
      if (ids.has(r.jugadorId)) { if (g === null || S.includes(g)) out[k].push(r); }
      else if (g !== null && S.includes(g)) { const gl = K.jugadorGlobal(r.jugadorId); if (gl && gl.j.activo !== false) { out[k].push(r); inv.set(r.jugadorId, gl.j); } }
    })));
    const partidos = inf.partidos.filter((p) => !p.cat || S.includes(Number(p.cat)));
    partidos.forEach((p) => Object.keys(p.minutos || {}).forEach((id) => {
      if (ids.has(id) || inv.has(id) || !(Number(p.minutos[id]) > 0)) return;
      const gl = K.jugadorGlobal(id); if (gl && gl.j.activo !== false && !S.includes(K.catNum(gl.j))) inv.set(id, gl.j);
    }));
    // Para las fichas de los jugadores propios: TODO lo suyo (también lo ocurrido en otras categorías), que se marca con (Sub X).
    const fAll = { casos: [], atenciones: [] };
    K.state.informes.forEach((i) => ['casos', 'atenciones'].forEach((k) => i[k].forEach((r) => { if (ids.has(r.jugadorId)) fAll[k].push(r); })));
    const invitados = Array.from(inv.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((j) => Object.assign({}, j, { _inv: true, _catOrigen: j.categoria || '' }));
    return Object.assign({}, inf, { jugadores: propios.concat(invitados), casos: out.casos, atenciones: out.atenciones, eventos: inf.eventos.filter((x) => ids.has(x.jugadorId)), partidos, _invitados: invitados.length, _fichaCasos: fAll.casos, _fichaAtenciones: fAll.atenciones });
  };
  K.informeVista = (inf) => {
    const a = K.ui.alcance;
    if (K.ui.cat && a === 'todas') return K.informeTodas();
    if (!K.ui.cat) return inf;
    const g = K.grupoDe(K.ui.cat);
    if (!a || a === 'comb') return Object.assign(K.vistaCategorias(inf, g ? g.cats : [K.ui.cat], inf.jugadores), {});
    const c = Number(a);
    return Object.assign(K.vistaCategorias(inf, [c], inf.jugadores.filter((j) => K.catNum(j) === c)), { nombre: 'Sub ' + c, categorias: 'Sub ' + c, manuales: [], _unico: true });
  };
  K.selectorAlcance = () => {
    const g = K.grupoDe(K.ui.cat); if (!g) return '';
    const ops = [['comb', 'Informe combinado ' + g.nombre]].concat(g.cats.map((c) => [String(c), 'Informe único Sub ' + c]), [['todas', 'Informe general Sub 15 a Sub 20']]);
    return `<select data-acc-change="alcance" style="width:auto;min-width:200px" aria-label="Alcance del informe">${K.opts(ops, K.ui.alcance || 'comb')}</select>`;
  };
  // Qué informe se está viendo (siempre visible, para no confundir combinado con único).
  K.vistaTexto = () => {
    const g = K.grupoDe(K.ui.cat); if (!g) return '';
    const a = K.ui.alcance || 'comb';
    return a === 'comb' ? `Informe combinado ${g.nombre}` : a === 'todas' ? 'Informe general Sub 15 a Sub 20' : `Informe solo Sub ${a}`;
  };
  K.elegirVista = (cat, alc) => {
    const g = K.grupoDe(cat);
    K.state.activo = K.informeGrupo(g).id;
    K.ui.cat = Number(cat); K.ui.alcance = alc; K.ui.pantalla = 'informe'; K.ui.jugadorId = null;
    K.render(); window.scrollTo(0, 0);
  };
  // Cuerpo técnico: debe elegir explícitamente qué informe ve.
  K.opcionesVista = () => K.GRUPOS.map((g) => ({ g, ops: g.cats.map((c) => [`${c}|${c}`, `Solo Sub ${c}`]).concat([[`${g.cats[0]}|comb`, `Combinado ${g.nombre}`]]) })).concat([{ g: { nombre: 'Todas las categorías' }, ops: [['16|todas', 'Informe general Sub 15 a Sub 20']] }]);
  K.selectorVista = () => {
    const g0 = K.grupoDe(K.ui.cat), al = K.ui.alcance || 'comb';
    const actual = g0 ? (al === 'comb' ? `${g0.cats[0]}|comb` : al === 'todas' ? '16|todas' : `${al}|${al}`) : '';
    return `<select class="sel-cat" data-vista-sel aria-label="Elegir informe"><option value=""${actual ? '' : ' selected'}>Elegir informe…</option>
      ${K.opcionesVista().map(({ g, ops }) => `<optgroup label="${e(g.nombre)}">${ops.map(([v, t]) => `<option value="${v}"${v === actual ? ' selected' : ''}>${e(t)}</option>`).join('')}</optgroup>`).join('')}</select>`;
  };
  K.inicioTecnico = () => `<div class="inicio">
      <div class="inicio-cab"><img src="img/insignia-512.png" alt=""><div><h1>Informe del área kinésica</h1><p>Santiago Wanderers · Fútbol joven</p></div></div>
      <p class="inicio-ayuda"><b>¿Qué informe quieres ver?</b> Elige uno: puedes ver una sola categoría o el informe combinado de la pareja.</p>
      ${K.opcionesVista().map(({ g, ops }) => `<section class="inicio-grupo"><header><span>Informe</span><b>${e(g.nombre)}</b></header>
        <div class="inicio-cats">${ops.map(([v, t]) => `<button class="inicio-cat${v.endsWith('comb') || v.endsWith('todas') ? ' comb' : ''}" data-ver="${v}"><b>${e(t)}</b><small>${v.endsWith('comb') ? 'Las dos categorías juntas' : v.endsWith('todas') ? 'Sub 15, 16, 18 y 20 en un solo informe' : 'Solo jugadores de esta categoría'}</small></button>`).join('')}</div></section>`).join('')}
    </div>`;
  K.irInicio = () => { K.ui.cat = null; K.ui.jugadorId = null; K.render(); window.scrollTo(0, 0); };

  K.selectorCat = () => `<select class="sel-cat" data-cat-sel aria-label="Cambiar de categoría">
    <option value=""${K.ui.cat ? '' : ' selected'}>Inicio</option>
    ${K.GRUPOS.map((g) => g.cats.map((c) => `<option value="${c}"${K.ui.cat === c ? ' selected' : ''}>Sub ${c}</option>`).join('')).join('')}</select>`;

  K.inicioHTML = () => {
    const resumen = (g, c) => {
      const inf = K.buscarInformeGrupo(g);
      if (!inf) return 'Sin datos todavía';
      const js = inf.jugadores.filter((j) => { const n = K.catNum(j); return n === null || n === c; });
      const ids = new Set(js.map((j) => j.id));
      const regs = inf.casos.filter((x) => ids.has(x.jugadorId)).length + inf.atenciones.filter((x) => ids.has(x.jugadorId)).length;
      return `${js.length} jugador${js.length === 1 ? '' : 'es'} · ${regs} registro${regs === 1 ? '' : 's'}`;
    };
    return `<div class="inicio">
      <div class="inicio-cab"><img src="img/insignia-512.png" alt=""><div><h1>Kinesiología Fútbol Joven</h1><p>Santiago Wanderers · Informe del área kinésica</p></div></div>
      <p class="inicio-ayuda">Elige la categoría con la que vas a trabajar. Cada una tiene sus jugadores y sus registros; el informe se presenta combinado por pareja de categorías.</p>
      ${K.GRUPOS.map((g) => `<section class="inicio-grupo">
        <header><span>Informe combinado</span><b>${e(g.nombre)}</b></header>
        <div class="inicio-cats">${g.cats.map((c) => `<button class="inicio-cat" data-cat="${c}"><b>Sub ${c}</b><small>${e(resumen(g, c))}</small></button>`).join('')}</div>
      </section>`).join('')}
    </div>`;
  };

  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t && t.dataset && t.dataset.catSel !== undefined) { t.value ? K.seleccionarCat(t.value, !!K.ui.cat) : K.irInicio(); }
  });
  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t && t.dataset && t.dataset.vistaSel !== undefined) { if (!t.value) return K.irInicio(); const [c, a] = t.value.split('|'); K.elegirVista(c, a); }
  });
  document.addEventListener('click', (ev) => {
    const v = ev.target.closest('[data-ver]');
    if (v) { const [c, a] = v.dataset.ver.split('|'); K.elegirVista(c, a); return; }
    const b = ev.target.closest('[data-cat]');
    if (b) K.seleccionarCat(b.dataset.cat);
  });
})();

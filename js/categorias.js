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
    const v = K.vivos(inf);
    return c ? v.filter((j) => { const n = K.catNum(j); return n === null || n === c; }) : v;
  };
  // Orden de los jugadores: manual (flechas en Jugadores) o por categoría y nombre.
  // Orden de los informes con más de una categoría: primero la categoría más grande (Sub 20 antes que Sub 18) y dentro de ella alfabético.
  K.numCat = (c) => Number((/\d+/.exec(String(c == null ? '' : c)) || [])[0]) || 0;
  K.cmpCatNombre = (catA, nomA, catB, nomB) => (K.numCat(catB) - K.numCat(catA)) || String(nomA || '').localeCompare(String(nomB || ''), 'es');
  // Cómo se ordena la lista de jugadores (y las fichas del informe): nombre, apellido, posición o manual. Se guarda en inf.ordenJ.
  // inf.ordenManual dice si hay un orden manual guardado en el arreglo (se conserva aunque se mire por otro criterio).
  K.ORDENES_J = [['nombre', 'Nombre'], ['apellido', 'Apellido'], ['posicion', 'Posición'], ['manual', 'Manual']];
  K.modoOrdenJ = (inf) => (K.ORDENES_J.some((o) => o[0] === inf.ordenJ) ? inf.ordenJ : inf.ordenManual ? 'manual' : 'nombre');
  // Apellidos del jugador: los campos apellido1/apellido2 si existen; si no, las dos últimas palabras del nombre (o la última si son dos)
  K.apellidoDe = (j) => {
    if (j.apellido1) return [j.apellido1, j.apellido2, j.nombres].filter(Boolean).join(' ').trim();
    const w = String(j.nombre || '').trim().split(/\s+/).filter(Boolean);
    return w.length >= 3 ? w.slice(-2).concat(w.slice(0, -2)).join(' ') : w.length === 2 ? w[1] + ' ' + w[0] : w[0] || '';
  };
  // v1.6.10: con el orden por apellido, la lista muestra “Luna Isaías” en vez de “Isaías Luna”
  K.nombreVisto = (inf, j) => (K.modoOrdenJ(inf) === 'apellido' ? K.apellidoDe(j) || j.nombre : j.nombre);
  const POS_ORDEN = ['portero', 'defensa', 'volante', 'delantero'];
  const posRango = (j) => { const i = POS_ORDEN.indexOf(K.norm(j.posicion || '')); return i >= 0 ? i : j.posicion ? POS_ORDEN.length : POS_ORDEN.length + 1; };
  K.ordenJugadores = (inf, arr) => {
    const m = K.modoOrdenJ(inf); if (m === 'manual') return arr.slice();
    const cat = (a, b) => (a.categoria || '').localeCompare(b.categoria || '', 'es'), nom = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
    const cmp = m === 'apellido' ? (a, b) => cat(a, b) || K.apellidoDe(a).localeCompare(K.apellidoDe(b), 'es') || nom(a, b)
      : m === 'posicion' ? (a, b) => cat(a, b) || (posRango(a) - posRango(b)) || nom(a, b)
        : (a, b) => cat(a, b) || nom(a, b);
    return arr.slice().sort(cmp);
  };
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
    if (K.torneos && K.puedeEditar && K.puedeEditar() && K.torneos.migrar(inf)) K.guardar(); // partidos con torneo solo en texto (p. ej. llegaron de la nube): se enlazan a su ficha
    const mapa = new Map(), out = [];
    inf.partidos.forEach((p) => {
      if (cat && K.catsPartido(p).length && !K.catsPartido(p).includes(Number(cat))) return;
      let j = mapa.get(p.jid || p.id);
      if (!j) { j = { jid: p.jid || p.id, ps: [] }; mapa.set(j.jid, j); out.push(j); }
      j.ps.push(p);
    });
    out.forEach((j) => { if (j.ps.length > 1) j.ps = j.ps.filter((p) => !K.partidoHuerfano(p)); j.ps.sort(porCatDesc); const p0 = j.ps[0]; Object.assign(j, { p0, rival: p0.rival, torneo: p0.torneo || '', logo: p0.logo, logoData: p0.logoData, local: p0.local, fecha: p0.fecha || '', jugado: j.ps.some((p) => p.jugado) }); });
    return out;
  };
  // v1.9.0: un partido «combinado» (p.cats) juega con varias categorías y tiene un solo marcador, citados y minutos. Sin categoría ni lista = partido sin categoría.
  K.catsPartido = (p) => (p && Array.isArray(p.cats) && p.cats.length ? p.cats.map(Number).filter(Boolean).sort((a, b) => b - a) : p && p.cat ? [Number(p.cat)] : []);
  // Texto de la categoría: «Sub 18», «Sub 16-18-20» (combinado) o vacío (sin categoría: no se muestra como si fuera una categoría).
  K.etiquetaCatPartido = (p) => { const c = K.catsPartido(p); return c.length ? 'Sub ' + c.slice().reverse().join('-') : ''; };
  // Registro sin categoría que no tiene ningún dato: no aporta nada y no se muestra.
  K.partidoHuerfano = (p) => !!p && !p.cat && !(Array.isArray(p.cats) && p.cats.length) && !p.res && !(p.incidencias || []).length && !Object.values(p.minutos || {}).some((m) => Number(m) > 0) && !p.observaciones && !p.notas && !(Array.isArray(p.citados) && p.citados.length);
  // Jugadores que pueden participar en un partido: los de esa categoría y los que “también juegan” en ella (aunque estén en otro informe).
  K.jugadoresDePartido = (inf, p) => {
    const c = K.catPartido(p), out = [], gH = K.grupoDeInforme(inf), cs = Array.isArray(p.cats) && p.cats.length ? p.cats.map(Number) : null;
    K.state.informes.forEach((i) => i.jugadores.forEach((j) => {
      if (j.activo === false) return;
      if (p.fecha ? !K.estaEn(j, p.fecha, p.fecha) : !K.inscrito(j)) return; // un partido con fecha cuenta con quienes estaban inscritos ese día
      // con fecha, vale la categoría que el jugador tenía ese día (aunque hoy esté en otra categoría u otro informe)
      const hist = !!p.fecha && K.tieneHistorial(j), n = hist ? K.catEn(j, p.fecha) : K.catNum(j), tb = (j.tambien || []).map((x) => Number((/\d+/.exec(x) || [])[0]));
      const delInforme = i === inf || (hist && n !== null && !!gH && gH.cats.includes(n)); // del informe del partido: hoy lo es, o ese día estaba en una de sus categorías
      const propio = cs ? n !== null && cs.includes(n) : delInforme && (!c || n === null || n === c), visitante = !cs && c && n !== c && tb.includes(c);
      if (propio || visitante) out.push({ j, inf: i, visitante: !!visitante });
    }));
    return out.sort((a, b) => a.j.nombre.localeCompare(b.j.nombre, 'es'));
  };
  // Categorías en las que un jugador ha jugado o recibido atención dentro del período.
  K.catsJugadas = (j, per) => {
    const r = {};
    K.state.informes.forEach((i) => i.partidos.forEach((p) => {
      if (!p.cat || !K.partidoEnPeriodo(p, per, i)) return;
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
    K.ui.alcance = 'comb'; K.ui.cat = Number(cat); if (!conservar) K.ui.pantalla = K.puedeEditar && !K.puedeEditar() ? 'informe' : 'hoy'; K.ui.jugadorId = null; K.ui.filtroJ = '';
    if (K.recordarCat) K.recordarCat(Number(cat)); // la próxima vez que se abra la app en este dispositivo se va directo a esta categoría
    K.guardar(); K.render(); window.scrollTo(0, 0);
  };
  // Vista del informe: combinado (toda la pareja) o único de una categoría.
  // Informe general Sub 15 a Sub 20 (para el cuerpo técnico): junta los dos informes en uno virtual (solo lectura).
  K.informeTodas = (per) => {
    per = per || K.resolverPeriodo(K.state.periodo);
    const infs = K.GRUPOS.map((g) => K.buscarInformeGrupo(g)).filter(Boolean);
    const base = infs[0] || K.inf(), anio = K.anioDePeriodo(per);
    const fuera = new Set(); // archivados que no estaban inscritos en el período
    const jugadores = [].concat(...infs.map((i) => (i.jugadores || []).filter((j) => { if (K.estaEn(j, per.desde, per.hasta)) return true; fuera.add(j.id); return false; }).map((j) => conCatPeriodo(copiaAnio(i, j, anio), j, per))));
    const unir = (k) => [].concat(...infs.map((i) => i[k] || [])).filter((x) => !fuera.has(x.jugadorId));
    const trat = [], ind = [];
    infs.forEach((i) => { i.tratamientos.forEach((t) => { if (!trat.some((x) => x.id === t.id)) trat.push(t); }); i.indicadores.forEach((x) => { if (!ind.some((y) => y.id === x.id)) ind.push(x); }); });
    const T = K.textosAnio(base, anio);
    const v = Object.assign({}, base, { id: 'todas', nombre: 'Sub 15-20', categorias: 'Sub 15 a Sub 20', jugadores, casos: unir('casos'), atenciones: unir('atenciones'), eventos: unir('eventos'),
      asistencias: unir('asistencias'), seguros: unir('seguros'), segEventos: unir('segEventos'), partidos: [].concat(...infs.map((i) => i.partidos || [])), manuales: [], camposExtra: base.camposExtra || [], tratamientos: trat, indicadores: ind,
      conclusiones: T.conclusionesTodas || '', objetivos: T.objetivosTodas || '', staff: T.staff || [], firmante: T.firmante || '', atencionesPartidos: K.atencionesPartidos(base, anio), regLesionados: K.opcInforme(base, anio, 'regLesionados'), lesActuales: K.opcInforme(base, anio, 'lesActuales'), bloques: K.bloquesAnio(base, anio), ordenManual: false, ordenPartidos: false, _unico: true, _todas: true, _anio: anio });
    return v;
  };
  // Categoría en la que ocurrió un registro (atención o molestia de partido): la del partido; sin partido, vale la del jugador.
  K.catRegistro = (r) => {
    if (r.catJuego) return Number(r.catJuego);
    if (r.partidoId) for (const i of K.state.informes) { const p = i.partidos.find((x) => x.id === r.partidoId); if (p) return p.cat ? Number(p.cat) : null; }
    return null;
  };
  // En un informe de un período, la categoría del jugador es la que tenía al terminar ese período (no la de hoy).
  const conCatPeriodo = (copia, j, per) => { if (K.tieneHistorial(j)) { const n = K.catPeriodo(j, per.desde, per.hasta); if (n) copia.categoria = 'Sub ' + n; } return copia; };
  // Copia de un jugador para un informe del año `anio`: sus comentarios (y campos adicionales) son los de ese año.
  const copiaAnio = (i, j, anio) => {
    const t = K.textosJugador(i, j, anio);
    return Object.assign({}, j, { comentarios: t.comentarios || '', extras: t.extras || j.extras || {}, _real: j });
  };
  // Vista del informe de las categorías S para el período `per`. Junta, de TODOS los informes, a los jugadores inscritos en el período que
  // estuvieron en esas categorías (por su historial de categoría) y sus registros según la categoría que tenían en la fecha de cada uno.
  // Los registros de partido cuentan en la categoría donde se jugó el partido. Los jugadores de otras categorías que jugaron aquí quedan
  // como “invitados” (se marcan con _inv y van al final; con soloPropios no se incluyen y cuenta todo lo de los propios). comb = informe combinado de la pareja (incluye a todos los de este informe sin historial).
  K.vistaPeriodo = (inf, S, per, comb, soloPropios) => {
    const anio = K.anioDePeriodo(per), informes = K.state.informes, primero = informes.slice().sort((a, b) => (b.id === inf.id) - (a.id === inf.id));
    const elig = new Map(), propios = [], otros = new Map(); // otros = de la misma pareja pero de la otra categoría: su asistencia y seguro cuentan “como siempre”
    primero.forEach((i) => (i.jugadores || []).forEach((j) => {
      const tr = K.catsEnRango(j, per.desde, per.hasta), legacy = !K.tieneHistorial(j);
      if (!tr.length) { if (legacy && i.id === inf.id) otros.set(j.id, { j, legacy: true }); return; } // no estaba inscrito en el período
      let copia;
      if (legacy) {
        if (i.id !== inf.id || !(comb || S.includes(K.catNum(j)))) { if (i.id === inf.id) otros.set(j.id, { j, legacy: true }); return; } // sin historial: pertenece al informe donde está
        copia = copiaAnio(i, j, anio);
      } else {
        const m = tr.filter((t) => S.includes(t.cat));
        if (!m.length) { otros.set(j.id, { j, legacy: false }); return; }
        copia = Object.assign(copiaAnio(i, j, anio), { categoria: 'Sub ' + m[m.length - 1].cat });
      }
      elig.set(j.id, { j, legacy });
      propios.push(copia);
    }));
    const fe = (r) => r.fecha || r.inicio || r.activacion || '', G = K.grupoDe(S[0]);
    const dentro = (e, r) => e.legacy || S.includes(K.catEn(e.j, fe(r)));
    const out = { casos: [], atenciones: [], eventos: [], asistencias: [], seguros: [], segEventos: [] }, inv = new Map();
    const hay = (id, j) => K.estaEn(j, per.desde, per.hasta);
    informes.forEach((i) => {
      ['casos', 'atenciones'].forEach((k) => (i[k] || []).forEach((r) => {
        const g = K.catRegistro(r), e = elig.get(r.jugadorId);
        if (e) { if (soloPropios ? dentro(e, r) : g !== null ? S.includes(g) : dentro(e, r)) out[k].push(r); }
        else if (!soloPropios && g !== null && S.includes(g)) { const gl = K.jugadorGlobal(r.jugadorId); if (gl && gl.j.activo !== false && hay(r.jugadorId, gl.j)) { out[k].push(r); inv.set(r.jugadorId, gl); } }
      }));
      ['eventos', 'asistencias', 'seguros', 'segEventos'].forEach((k) => (i[k] || []).forEach((r) => {
        const e = elig.get(r.jugadorId);
        if (e) { if (dentro(e, r)) out[k].push(r); }
        else if (!soloPropios && k !== 'eventos' && (otros.has(r.jugadorId) ? (otros.get(r.jugadorId).legacy || (G && G.cats.includes(K.catEn(otros.get(r.jugadorId).j, fe(r))))) : i.id === inf.id && !K.jugadorGlobal(r.jugadorId))) out[k].push(r); // como siempre: asistencia y seguro de la pareja (también los de la otra categoría) cuentan en el informe de una sola categoría
      }));
    });
    const partidos = (inf.partidos || []).filter((p) => !p.cat || S.includes(Number(p.cat)));
    if (!soloPropios) partidos.forEach((p) => Object.keys(p.minutos || {}).forEach((id) => {
      if (elig.has(id) || inv.has(id) || !(Number(p.minutos[id]) > 0)) return;
      const gl = K.jugadorGlobal(id); if (gl && gl.j.activo !== false && hay(id, gl.j) && !S.includes(K.catEn(gl.j, p.fecha))) inv.set(id, gl);
    }));
    // Para las fichas de los jugadores propios: TODO lo suyo (también lo ocurrido en otras categorías), que se marca con (Sub X).
    const fAll = { casos: [], atenciones: [] };
    informes.forEach((i) => ['casos', 'atenciones'].forEach((k) => (i[k] || []).forEach((r) => { if (elig.has(r.jugadorId)) fAll[k].push(r); })));
    const invitados = Array.from(inv.values()).sort((a, b) => a.j.nombre.localeCompare(b.j.nombre, 'es')).map((gl) => {
      const c = K.tieneHistorial(gl.j) ? K.catEn(gl.j, per.hasta < K.hoy() ? per.hasta : K.hoy()) : null;
      return Object.assign(copiaAnio(gl.inf, gl.j, anio), { _inv: true, _catOrigen: c ? 'Sub ' + c : gl.j.categoria || '' }, c ? { categoria: 'Sub ' + c } : {});
    });
    return Object.assign({}, inf, { jugadores: propios.concat(invitados), casos: out.casos, atenciones: out.atenciones, eventos: out.eventos, asistencias: out.asistencias, seguros: out.seguros, segEventos: out.segEventos,
      partidos, _invitados: invitados.length, _fichaCasos: fAll.casos, _fichaAtenciones: fAll.atenciones });
  };
  // Pone en la vista los textos del año del período (conclusiones, objetivos, cuerpo técnico y firma).
  const conTextos = (v, host, anio) => {
    const T = K.textosAnio(host, anio);
    return Object.assign(v, { conclusiones: T.conclusiones || '', objetivos: T.objetivos || '', staff: T.staff || [], firmante: T.firmante, atencionesPartidos: K.atencionesPartidos(host, anio), regLesionados: K.opcInforme(host, anio, 'regLesionados'), lesActuales: K.opcInforme(host, anio, 'lesActuales'), bloques: K.bloquesAnio(host, anio), _anio: anio });
  };
  K.informeVista = (inf, per) => {
    per = per || K.resolverPeriodo(K.state.periodo);
    const a = K.ui.alcance, anio = K.anioDePeriodo(per);
    if (K.ui.cat && (a === 'todas' || a === 'todasRes')) return Object.assign(K.informeTodas(per), a === 'todasRes' ? { _sinFichas: true } : {}); // “todasRes” = mismo informe general, sin las fichas individuales
    if (!K.ui.cat) return conTextos(Object.assign({}, inf), inf, anio);
    const g = K.grupoDe(K.ui.cat);
    if (!a || a === 'comb') return conTextos(K.vistaPeriodo(inf, g ? g.cats : [K.ui.cat], per, true), inf, anio);
    const c = Number(a);
    return Object.assign(conTextos(K.vistaPeriodo(inf, [c], per, false), inf, anio), { nombre: 'Sub ' + c, categorias: 'Sub ' + c, manuales: [], _unico: true });
  };
  K.selectorAlcance = () => {
    const g = K.grupoDe(K.ui.cat); if (!g) return '';
    const ops = [['comb', 'Informe combinado ' + g.nombre]].concat(g.cats.map((c) => [String(c), 'Informe único Sub ' + c]), [['todas', 'Informe general Sub 15 a Sub 20 · con fichas de cada jugador'], ['todasRes', 'Informe general Sub 15 a Sub 20 · resumen sin fichas']]);
    return `<select data-acc-change="alcance" style="width:auto;min-width:200px" aria-label="Alcance del informe">${K.opts(ops, K.ui.alcance || 'comb')}</select>`;
  };
  // Qué informe se está viendo (siempre visible, para no confundir combinado con único).
  K.vistaTexto = () => {
    const g = K.grupoDe(K.ui.cat); if (!g) return '';
    const a = K.ui.alcance || 'comb';
    return a === 'comb' ? `Informe combinado ${g.nombre}` : a === 'todas' ? 'Informe general Sub 15 a Sub 20 (con fichas)' : a === 'todasRes' ? 'Informe general Sub 15 a Sub 20 (resumen sin fichas)' : `Informe solo Sub ${a}`;
  };
  K.elegirVista = (cat, alc) => {
    const g = K.grupoDe(cat);
    K.state.activo = K.informeGrupo(g).id;
    K.ui.cat = Number(cat); K.ui.alcance = alc; K.ui.pantalla = 'informe'; K.ui.jugadorId = null;
    K.render(); window.scrollTo(0, 0);
  };
  // Cuerpo técnico: debe elegir explícitamente qué informe ve.
  K.opcionesVista = () => K.GRUPOS.map((g) => ({ g, ops: g.cats.map((c) => [`${c}|${c}`, `Solo Sub ${c}`]).concat([[`${g.cats[0]}|comb`, `Combinado ${g.nombre}`]]) })).concat([{ g: { nombre: 'Todas las categorías' }, ops: [['16|todas', 'General Sub 15 a Sub 20 · con fichas'], ['16|todasRes', 'General Sub 15 a Sub 20 · resumen sin fichas']] }]);
  K.selectorVista = () => {
    const g0 = K.grupoDe(K.ui.cat), al = K.ui.alcance || 'comb';
    const actual = g0 ? (al === 'comb' ? `${g0.cats[0]}|comb` : al === 'todas' ? '16|todas' : al === 'todasRes' ? '16|todasRes' : `${al}|${al}`) : '';
    return `<select class="sel-cat" data-vista-sel aria-label="Elegir informe"><option value=""${actual ? '' : ' selected'}>Elegir informe…</option>
      ${K.opcionesVista().map(({ g, ops }) => `<optgroup label="${e(g.nombre)}">${ops.map(([v, t]) => `<option value="${v}"${v === actual ? ' selected' : ''}>${e(t)}</option>`).join('')}</optgroup>`).join('')}</select>`;
  };
  K.inicioTecnico = () => `<div class="inicio">
      <div class="inicio-cab"><img src="img/insignia-512.png" alt=""><div><h1>Informe del área kinésica</h1><p>Santiago Wanderers · Fútbol joven</p></div></div>
      <p class="inicio-ayuda"><b>¿Qué informe quieres ver?</b> Elige uno: puedes ver una sola categoría o el informe combinado de la pareja.</p>
      ${K.opcionesVista().map(({ g, ops }) => `<section class="inicio-grupo"><header><span>Informe</span><b>${e(g.nombre)}</b></header>
        <div class="inicio-cats">${ops.map(([v, t]) => `<button class="inicio-cat${v.endsWith('comb') || v.endsWith('todas') || v.endsWith('todasRes') ? ' comb' : ''}" data-ver="${v}"><b>${e(t)}</b><small>${v.endsWith('comb') ? 'Las dos categorías juntas' : v.endsWith('todas') ? 'Sub 15, 16, 18 y 20 en un solo informe, con la ficha de cada jugador' : v.endsWith('todasRes') ? 'Solo el resumen de todas las categorías, sin fichas individuales' : 'Solo jugadores de esta categoría'}</small></button>`).join('')}</div></section>`).join('')}
    </div>`;
  K.irInicio = () => { K.ui.cat = null; K.ui.jugadorId = null; K.render(); window.scrollTo(0, 0); };

  K.selectorCat = () => `<select class="sel-cat" data-cat-sel aria-label="Cambiar de categoría">
    <option value=""${K.ui.cat ? '' : ' selected'}>Inicio</option>
    ${K.GRUPOS.map((g) => g.cats.map((c) => `<option value="${c}"${K.ui.cat === c ? ' selected' : ''}>Sub ${c}</option>`).join('')).join('')}</select>`;

  K.inicioHTML = () => {
    const resumen = (g, c) => {
      const inf = K.buscarInformeGrupo(g);
      if (!inf) return 'Sin datos todavía';
      const js = K.vivos(inf).filter((j) => { const n = K.catNum(j); return n === null || n === c; });
      const ids = new Set(js.map((j) => j.id));
      const regs = inf.casos.filter((x) => ids.has(x.jugadorId)).length + inf.atenciones.filter((x) => ids.has(x.jugadorId)).length;
      return `${js.length} jugador${js.length === 1 ? '' : 'es'} · ${regs} registro${regs === 1 ? '' : 's'}`;
    };
    return `<div class="inicio">
      <div class="inicio-cab"><img src="img/insignia-512.png" alt=""><div><h1>Kinesiología Fútbol Joven</h1><p>Santiago Wanderers · Informe del área kinésica</p></div></div>
      ${K.avisoTemporada ? K.avisoTemporada() : ''}
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

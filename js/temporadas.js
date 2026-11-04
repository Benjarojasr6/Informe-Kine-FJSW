/* Temporadas: categoría de cada jugador en el tiempo, archivo (bajas), mover entre informes, textos por año y duplicados.
   Es solo la capa de datos; las pantallas la usan desde screens.js, categorias.js y report.js. */
(function () {
  const K = window.K;
  const FECHA = /^\d{4}-\d{2}-\d{2}$/;
  const iso = (v) => (typeof v === 'string' && FECHA.test(v) ? v : '');
  const clon = (x) => JSON.parse(JSON.stringify(x));
  const MIN = '0000-01-01', MAX = '9999-12-31';

  /* ---------- Texto ---------- */
  // Minúsculas, sin tildes y con espacios colapsados: sirve para comparar nombres y para buscar.
  K.norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  /* ---------- Estado del jugador (inscrito / archivo) ---------- */
  K.ESTADOS = [['inscrito', 'Inscrito'], ['liberado', 'Liberado'], ['cedido', 'Cedido'], ['promovido', 'Promovido'], ['retirado', 'Retirado']];
  K.nombreEstado = (v) => (K.ESTADOS.find((x) => x[0] === v) || [0, 'Inscrito'])[1];
  K.inscrito = (j) => !!j && (!j.estado || j.estado === 'inscrito');
  // Jugadores “vivos” de un informe: los inscritos (los archivados no salen en el día a día).
  K.vivos = (inf) => ((inf && inf.jugadores) || []).filter(K.inscrito);
  // Fecha de salida de un archivado (si falta, hoy). Un inscrito no tiene salida.
  K.salidaDe = (j) => (K.inscrito(j) ? '' : iso(j.salida) || K.hoy());
  // Suma/resta días a una fecha ISO.
  const dia = (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  // Tramos [a, b] (ISO, inclusivos) en que estuvo inscrito: desde su ingreso hasta su salida, menos los huecos
  // (j.huecos = lapsos en que estuvo dado de baja y después volvió: así el informe de un año anterior sigue mostrándolo).
  const tramosInsc = (j) => {
    let out = [[iso(j.ingreso) || MIN, K.salidaDe(j) || MAX]];
    (Array.isArray(j.huecos) ? j.huecos : []).filter((h) => h && iso(h.desde) && iso(h.hasta) && h.desde <= h.hasta).forEach((h) => {
      const nuevo = [];
      out.forEach(([a, b]) => {
        if (h.hasta < a || h.desde > b) { nuevo.push([a, b]); return; }
        if (h.desde > a) nuevo.push([a, dia(h.desde, -1)]);
        if (h.hasta < b) nuevo.push([dia(h.hasta, 1), b]);
      });
      out = nuevo;
    });
    return out.filter(([a, b]) => a <= b);
  };
  // ¿Su inscripción se superpone con el rango? (algún tramo de inscripción toca [desde, hasta])
  K.estaEn = (j, desdeISO, hastaISO) => {
    const d = iso(desdeISO) || MIN, h = iso(hastaISO) || MAX;
    return tramosInsc(j).some(([a, b]) => a <= h && b >= d);
  };
  // Da de baja (archiva): conserva ficha y registros.
  K.darDeBaja = (j, estado, salidaISO, motivo) => {
    if (!K.ESTADOS.some((x) => x[0] === estado && x[0] !== 'inscrito')) return false;
    j.estado = estado; j.salida = iso(salidaISO) || K.hoy(); j.motivoSalida = String(motivo || '');
    return true;
  };
  // Vuelve a inscribir. Si estaba archivado, el lapso entre su salida y su vuelta queda como “hueco” (no estuvo inscrito esos días).
  K.reinscribir = (j, ingresoISO) => {
    const vuelta = iso(ingresoISO) || K.hoy(), sal = iso(j.salida);
    if (!K.inscrito(j) && sal) {
      if (dia(sal, 1) <= dia(vuelta, -1)) j.huecos = (Array.isArray(j.huecos) ? j.huecos : []).concat([{ desde: dia(sal, 1), hasta: dia(vuelta, -1) }]);
    } else if (iso(ingresoISO)) j.ingreso = ingresoISO;
    j.estado = 'inscrito'; delete j.salida; delete j.motivoSalida;
  };

  // Jugador nuevo con todos los campos de base (así un jugador recién creado ya está normalizado).
  K.nuevoJugador = (o) => Object.assign({ id: K.uid(), nombre: '', categoria: '', nacimiento: '', posicion: '', comentarios: '', extras: {}, activo: true, estado: 'inscrito', anios: {} }, o);

  /* ---------- Categoría en el tiempo ---------- */
  const hist = (j) => (Array.isArray(j && j.catHist) ? j.catHist : [])
    .filter((x) => x && Number.isFinite(Number(x.cat)) && (x.desde === '' || x.desde == null || FECHA.test(x.desde)))
    .map((x) => ({ cat: Number(x.cat), desde: x.desde || '' }))
    .sort((a, b) => (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0));
  K.tieneHistorial = (j) => hist(j).length > 0;
  // Categoría (número) vigente en una fecha: última entrada con desde <= fecha. Sin historial vale la de su ficha.
  K.catEn = (j, fechaISO) => {
    const h = hist(j);
    if (!h.length) return K.catNum(j);
    const f = iso(fechaISO);
    if (!f) { const n = K.catNum(j); return n != null ? n : h[h.length - 1].cat; }
    let r = h[0].cat;
    for (const x of h) { if (x.desde <= f) r = x.cat; else break; }
    return r;
  };
  // Tramos de categoría del jugador dentro de [desde, hasta] acotado a su inscripción: [{ cat, ini, fin }] (vacío si no estuvo inscrito).
  K.catsEnRango = (j, desdeISO, hastaISO) => {
    const d0 = iso(desdeISO) || MIN, h0 = iso(hastaISO) || MAX, h = hist(j), out = [];
    tramosInsc(j).forEach(([ti, tf]) => {
      const a = ti > d0 ? ti : d0, b = tf < h0 ? tf : h0;
      if (a > b) return;
      if (!h.length) { out.push({ cat: K.catNum(j), ini: a, fin: b }); return; }
      h.forEach((x, i) => {
        const ini = i === 0 ? MIN : x.desde, sig = i + 1 < h.length ? h[i + 1].desde : null; // tramo = [ini, sig)
        if (ini <= b && (sig === null || sig > a)) out.push({ cat: x.cat, ini: ini > a ? ini : a, fin: sig === null || sig > b ? b : sig });
      });
    });
    return out;
  };
  // Categoría (número) con la que terminó el período [desde, hasta]; null si no estuvo inscrito o no tiene categoría.
  K.catPeriodo = (j, desdeISO, hastaISO) => {
    const tr = K.catsEnRango(j, desdeISO, hastaISO);
    return tr.length ? tr[tr.length - 1].cat : K.catNum(j);
  };
  // Cambia la categoría desde una fecha. Si el grupo (15-16 / 18-20) cambia, mueve al jugador al otro informe.
  // Devuelve { ok, movido, hacia } (hacia = id del informe de destino).
  K.cambiarCategoria = (inf, j, cat, desdeISO) => {
    const n = Number((/\d+/.exec(String(cat)) || [])[0]);
    if (!j || !K.grupoDe(n)) return { ok: false, movido: false };
    const desde = iso(desdeISO) || K.hoy();
    let h = hist(j);
    if (!h.length) { const act = K.catNum(j); h = act != null ? [{ cat: act, desde: '' }] : []; }
    h = h.filter((x) => x.desde < desde); // lo posterior queda reemplazado por este cambio
    if (!h.length || h[h.length - 1].cat !== n) h.push({ cat: n, desde });
    j.catHist = h;
    j.categoria = 'Sub ' + n;
    const gNuevo = K.grupoDe(n), gActual = K.grupoDeInforme(inf);
    if (gNuevo && gActual && gNuevo.id !== gActual.id) {
      const r = K.moverJugador(j.id, gNuevo.id);
      return { ok: true, movido: !!r.ok, hacia: r.hacia };
    }
    return { ok: true, movido: false };
  };

  /* ---------- Mover un jugador (y todos sus registros) a otro informe ---------- */
  const NO_MOVER = ['jugadores', 'partidos'];
  // Quita al jugador y todo lo suyo de TODOS los informes (partidos incluidos: minutos e incidencias). Para “Eliminar definitivamente”.
  K.quitarJugador = (jid) => {
    K.state.informes.forEach((i) => {
      Object.keys(i).forEach((k) => {
        if (!Array.isArray(i[k])) return;
        if (k === 'jugadores') i[k] = i[k].filter((x) => x.id !== jid);
        else if (k !== 'partidos' && i[k].some((x) => x && x.jugadorId === jid)) i[k] = i[k].filter((x) => !(x && x.jugadorId === jid));
      });
      (i.partidos || []).forEach((p) => { if (p.minutos) delete p.minutos[jid]; if (Array.isArray(p.citados)) p.citados = p.citados.filter((x) => x !== jid); p.incidencias = (p.incidencias || []).filter((x) => x.jugadorId !== jid); });
      (i.torneos || []).forEach((t) => { if (Array.isArray(t.inscritos)) t.inscritos = t.inscritos.filter((x) => x.id !== jid); });
    });
  };
  // Mueve al jugador y sus registros (mismos ids, sin duplicar) al informe del grupo destino. Un solo K.guardar(). Los partidos no se mueven.
  K.moverJugador = (jid, grupoDestino) => {
    const g = typeof grupoDestino === 'string' ? K.GRUPOS.find((x) => x.id === grupoDestino) : grupoDestino;
    const gl = K.jugadorGlobal(jid);
    if (!g || !gl) return { ok: false };
    const orig = gl.inf, dest = K.informeGrupo(g);
    if (orig === dest) return { ok: true, hacia: dest.id, n: 0, igual: true };
    const j = gl.j;
    // 1) se calcula todo sin tocar nada
    const llaves = Object.keys(orig).filter((k) => Array.isArray(orig[k]) && !NO_MOVER.includes(k) && orig[k].some((x) => x && x.jugadorId === jid));
    const plan = llaves.map((k) => {
      const suyos = orig[k].filter((x) => x && x.jugadorId === jid), ya = new Set((dest[k] || []).map((x) => x.id));
      return { k, quedan: orig[k].filter((x) => !(x && x.jugadorId === jid)), nuevos: suyos.filter((x) => !ya.has(x.id)), total: suyos.length };
    });
    const ya = new Set((dest.jugadores || []).map((x) => x.id));
    const guardado = {};
    ['jugadores'].concat(llaves, ['camposExtra', 'tratamientos', 'indicadores']).forEach((k) => { guardado[k] = [orig[k], dest[k]]; });
    // 2) se aplica; si algo falla se deja todo como estaba
    try {
      if (!j.anioTexto) j.anioTexto = K.anioTexto(orig);
      orig.jugadores = orig.jugadores.filter((x) => x.id !== jid);
      dest.jugadores = (dest.jugadores || []).concat(ya.has(jid) ? [] : [j]);
      plan.forEach((p) => { orig[p.k] = p.quedan; dest[p.k] = (dest[p.k] || []).concat(p.nuevos); });
      // los campos adicionales y tratamientos propios que usa el jugador viajan con él
      const extras = Object.keys(j.extras || {}).concat(...Object.keys(j.anios || {}).map((y) => Object.keys((j.anios[y] || {}).extras || {})));
      extras.forEach((id) => { const c = (orig.camposExtra || []).find((x) => x.id === id); if (c && !(dest.camposExtra || []).some((x) => x.id === id)) dest.camposExtra = (dest.camposExtra || []).concat([clon(c)]); });
      (dest.atenciones || []).filter((a) => a.jugadorId === jid).forEach((a) => Object.keys(a.trat || {}).forEach((tid) => {
        const t = (orig.tratamientos || []).find((x) => x.id === tid);
        if (t && !(dest.tratamientos || []).some((x) => x.id === tid)) { dest.tratamientos = (dest.tratamientos || []).concat([clon(t)]); if (!(dest.indicadores || []).some((i) => i.fuente === 'trat:' + tid)) dest.indicadores = (dest.indicadores || []).concat([{ id: 'i-t-' + tid, nombre: t.nombre, fuente: 'trat:' + tid, icono: t.icono, grupo: 'tratamiento', visible: true }]); }
      }));
    } catch (err) {
      Object.keys(guardado).forEach((k) => { const poner = (o, v) => { try { if (v === undefined) delete o[k]; else o[k] = v; } catch (x) { /* sigue con el resto */ } }; poner(orig, guardado[k][0]); poner(dest, guardado[k][1]); });
      return { ok: false, error: String(err && err.message || err) };
    }
    K.guardar();
    return { ok: true, desde: orig.id, hacia: dest.id, n: plan.reduce((a, p) => a + p.total, 0) };
  };

  /* ---------- Edad ---------- */
  // Edad en un año (el del informe, no el actual). null si no hay año de nacimiento.
  K.edadEn = (j, anio) => {
    const nac = String((j && j.nacimiento) || '').slice(0, 4);
    return /^\d{4}$/.test(nac) && anio ? Number(anio) - Number(nac) : null;
  };

  /* ---------- Período y año ---------- */
  K.anioDePeriodo = (per) => Number(String(per.desde || '').slice(0, 4)) || new Date().getFullYear();
  K.periodoActual = () => K.resolverPeriodo(K.state.periodo);
  K.anioVista = () => K.anioDePeriodo(K.periodoActual());
  // El período por defecto es el año calendario actual, salvo que se haya fijado a mano en este dispositivo.
  K.periodoPorDefecto = () => {
    const p = K.state && K.state.periodo; if (!p) return;
    if (!p.fijado) p.anio = new Date().getFullYear();
  };

  /* ---------- Textos por año ---------- */
  // “Vivos” = los de siempre en el informe (pertenecen a inf.anioTexto); los otros años viven en inf.anios[año].
  K.CAMPOS_ANIO = ['conclusiones', 'objetivos', 'conclusionesTodas', 'objetivosTodas', 'firmante', 'staff', 'atencionesPartidos', 'regLesionados', 'lesActuales', 'bloques'];
  // “Incluir los datos de partidos en el informe general” (atencionesPartidos, true/false por año): sin valor guardado, apagada hasta el 2026 y encendida desde el 2027.
  K.ATEN_PARTIDOS_DESDE = 2027;
  // v1.7.0: “Incluir el registro de lesionados / los lesionados actuales en el informe” (true/false por año; sin valor guardado = incluidos)
  K.opcInforme = (host, anio, campo) => { const T = K.textosAnio(host, anio); return typeof T[campo] === 'boolean' ? T[campo] : true; };
  K.bloquesAnio = (host, anio) => { const T = K.textosAnio(host, anio); return T.bloques && typeof T.bloques === 'object' ? T.bloques : {}; };
  K.atencionesPartidos = (host, anio) => { const T = K.textosAnio(host, anio); return typeof T.atencionesPartidos === 'boolean' ? T.atencionesPartidos : Number(anio) >= K.ATEN_PARTIDOS_DESDE; };
  const VACIAR = ['conclusiones', 'objetivos', 'conclusionesTodas', 'objetivosTodas']; // al rotar se vacían; staff y firmante se mantienen
  K.anioTexto = (inf) => Number(inf.anioTexto) || Number(inf.anio) || new Date().getFullYear();
  const aniosConocidos = (inf) => Object.keys(inf.anios || {}).map(Number).concat(K.anioTexto(inf));
  // Cuerpo técnico y firma del año vigente más cercano anterior (si no hay anterior, el más cercano posterior).
  const vecino = (inf, anio) => {
    const ys = Array.from(new Set(aniosConocidos(inf))).filter((y) => y !== anio && (y === K.anioTexto(inf) || ((inf.anios || {})[y] && Array.isArray(inf.anios[y].staff))));
    const ant = ys.filter((y) => y < anio).sort((a, b) => b - a)[0], pos = ys.filter((y) => y > anio).sort((a, b) => a - b)[0];
    const y = ant !== undefined ? ant : pos;
    return y === undefined ? null : (y === K.anioTexto(inf) ? inf : inf.anios[y]);
  };
  K.rotarTextos = (inf, anio) => {
    anio = Number(anio);
    const viejo = K.anioTexto(inf);
    if (!anio || anio === viejo || anio < viejo) return inf;
    inf.anios = inf.anios && typeof inf.anios === 'object' ? inf.anios : {};
    const arch = {};
    K.CAMPOS_ANIO.forEach((c) => { if (inf[c] !== undefined) arch[c] = clon(inf[c]); });
    inf.anios[viejo] = arch;
    (inf.jugadores || []).forEach((j) => { if (!j.anioTexto) j.anioTexto = viejo; }); // cada jugador conserva el año de sus comentarios
    const previo = inf.anios[anio]; // si ya había algo archivado de ese año, vuelve a ser lo vivo
    VACIAR.forEach((c) => { inf[c] = previo && typeof previo[c] === 'string' ? previo[c] : ''; });
    if (typeof (previo && previo.atencionesPartidos) === 'boolean') inf.atencionesPartidos = previo.atencionesPartidos; else delete inf.atencionesPartidos; // la casilla es de cada año
    ['regLesionados', 'lesActuales'].forEach((c) => { if (typeof (previo && previo[c]) === 'boolean') inf[c] = previo[c]; else delete inf[c]; });
    if (previo && previo.bloques && typeof previo.bloques === 'object') inf.bloques = clon(previo.bloques); else delete inf.bloques; // los botones on/off del informe son de cada año
    if (previo) { if (Array.isArray(previo.staff)) inf.staff = previo.staff; if (typeof previo.firmante === 'string') inf.firmante = previo.firmante; delete inf.anios[anio]; }
    inf.anioTexto = anio;
    return inf;
  };
  // Devuelve el objeto que tiene los textos de ese año (conclusiones, objetivos, staff, firmante…).
  // paraEditar = true: lo crea (y rota si el año es posterior al vivo). Para leer, un año sin textos da un objeto virtual vacío.
  K.textosAnio = (inf, anio, paraEditar) => {
    anio = Number(anio) || K.anioTexto(inf);
    const vivo = K.anioTexto(inf);
    if (anio === vivo) return inf;
    if (inf.anios && inf.anios[anio] && typeof inf.anios[anio] === 'object') {
      if (paraEditar && anio > vivo) { K.rotarTextos(inf, anio); return inf; }
      return inf.anios[anio];
    }
    const v = vecino(inf, anio);
    if (!paraEditar) return { conclusiones: '', objetivos: '', conclusionesTodas: '', objetivosTodas: '', firmante: v ? v.firmante || '' : '', staff: v ? v.staff || [] : [], _virtual: true };
    if (anio > vivo) return K.rotarTextos(inf, anio);
    inf.anios = inf.anios && typeof inf.anios === 'object' ? inf.anios : {};
    return (inf.anios[anio] = { conclusiones: '', objetivos: '', conclusionesTodas: '', objetivosTodas: '', firmante: v ? v.firmante || '' : '', staff: v ? clon(v.staff || []) : [] });
  };
  // Comentarios del jugador por año: los vivos pertenecen a j.anioTexto (o al del informe); el resto, en j.anios[año].
  K.anioTextoJ = (inf, j) => Number(j.anioTexto) || K.anioTexto(inf);
  K.rotarJugador = (inf, j, anio) => {
    anio = Number(anio);
    const viejo = K.anioTextoJ(inf, j);
    if (!anio || anio <= viejo) return j;
    j.anios = j.anios && typeof j.anios === 'object' ? j.anios : {};
    j.anios[viejo] = { comentarios: j.comentarios || '', extras: clon(j.extras || {}) };
    const previo = j.anios[anio];
    j.comentarios = previo && typeof previo.comentarios === 'string' ? previo.comentarios : '';
    if (previo) delete j.anios[anio];
    j.anioTexto = anio;
    return j;
  };
  K.textosJugador = (inf, j, anio, paraEditar) => {
    anio = Number(anio) || K.anioTextoJ(inf, j);
    const vivo = K.anioTextoJ(inf, j);
    if (anio === vivo) return j;
    if (j.anios && j.anios[anio] && typeof j.anios[anio] === 'object') {
      if (paraEditar && anio > vivo) { K.rotarJugador(inf, j, anio); return j; }
      return j.anios[anio];
    }
    if (!paraEditar) return { comentarios: '', extras: j.extras || {}, _virtual: true };
    if (anio > vivo) return K.rotarJugador(inf, j, anio);
    j.anios = j.anios && typeof j.anios === 'object' ? j.anios : {};
    return (j.anios[anio] = { comentarios: '', extras: clon(j.extras || {}) });
  };

  /* ---------- Duplicados ---------- */
  // Busca en TODOS los informes (archivados incluidos) a alguien con el mismo nombre. Devuelve null o
  // { j, inf, archivado, bloquea }: bloquea = mismo año de nacimiento (o alguno sin año); si no, es un homónimo y solo se avisa.
  K.buscarDuplicado = (nombreCompleto, anioNac, ignorarId) => {
    const clave = K.norm(nombreCompleto);
    if (!clave) return null;
    const anio = /^\d{4}$/.test(String(anioNac || '').slice(0, 4)) ? String(anioNac).slice(0, 4) : '';
    let homonimo = null;
    for (const inf of K.state.informes) {
      for (const j of inf.jugadores || []) {
        if (j.id === ignorarId || K.norm(j.nombre) !== clave) continue;
        const ja = /^\d{4}$/.test(String(j.nacimiento || '').slice(0, 4)) ? String(j.nacimiento).slice(0, 4) : '';
        const r = { j, inf, archivado: !K.inscrito(j), bloquea: !anio || !ja || anio === ja };
        if (r.bloquea) return r;
        homonimo = homonimo || r;
      }
    }
    return homonimo;
  };
})();

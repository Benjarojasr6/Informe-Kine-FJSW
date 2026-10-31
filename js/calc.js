/* Períodos y cálculo automático de totales a partir de los registros. */
(function () {
  const K = window.K;

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const ORD = ['1.er', '2.º', '3.er', '4.º'];

  K.TIPOS_PERIODO = [
    ['anual', 'Anual'],
    ['semestre1', '1.er semestre'],
    ['semestre2', '2.º semestre'],
    ['trimestre1', '1.er trimestre'],
    ['trimestre2', '2.º trimestre'],
    ['trimestre3', '3.er trimestre'],
    ['trimestre4', '4.º trimestre'],
    ['libre', 'Personalizado']
  ];

  K.resolverPeriodo = function (p) {
    const y = Number(p.anio) || new Date().getFullYear();
    const fin = (m) => new Date(y, m, 0).getDate(); // último día del mes m (1-12)
    const iso = (yy, m, d) => `${yy}-${K.pad(m)}-${K.pad(d)}`;
    let desde, hasta, etiqueta, nombre;
    switch (p.tipo) {
      case 'semestre1': desde = iso(y, 1, 1); hasta = iso(y, 6, 30); nombre = 'Informe semestral'; etiqueta = `1.er semestre ${y}`; break;
      case 'semestre2': desde = iso(y, 7, 1); hasta = iso(y, 12, 31); nombre = 'Informe semestral'; etiqueta = `2.º semestre ${y}`; break;
      case 'trimestre1': case 'trimestre2': case 'trimestre3': case 'trimestre4': {
        const q = Number(p.tipo.slice(-1));
        const m1 = (q - 1) * 3 + 1, m2 = q * 3;
        desde = iso(y, m1, 1); hasta = iso(y, m2, fin(m2));
        nombre = 'Informe trimestral'; etiqueta = `${ORD[q - 1]} trimestre ${y}`;
        break;
      }
      case 'libre':
        desde = p.desde || iso(y, 1, 1); hasta = p.hasta || iso(y, 12, 31);
        nombre = 'Informe de período';
        etiqueta = `${K.fechaCorta(desde)} al ${K.fechaCorta(hasta)}`;
        break;
      default:
        desde = iso(y, 1, 1); hasta = iso(y, 12, 31); nombre = 'Informe anual'; etiqueta = String(y);
    }
    return { desde, hasta, nombre, etiqueta, completo: `${nombre} ${etiqueta}`, tipo: p.tipo || 'anual' };
  };

  K.enPeriodo = (fecha, per) => !!fecha && fecha >= per.desde && fecha <= per.hasta;
  // Un partido sin fecha se considera dentro de cualquier período (hasta que se le asigne fecha).
  K.partidoEnPeriodo = (p, per) => !p.fecha || K.enPeriodo(p.fecha, per);

  K.partidosJugados = (inf, per) => inf.partidos.filter((p) => p.jugado && K.partidoEnPeriodo(p, per));

  /* ---------- Totales ---------- */
  // Devuelve { porFuente: {fuente: n}, trat: {id: n} } filtrando por período y, si se pide, por jugador.
  K.contar = function (inf, per, jugadorId) {
    const okJ = (x) => !jugadorId || x.jugadorId === jugadorId;
    const r = { lesiones: 0, molestias: 0, atenciones: 0, intervenciones: 0, controles: 0, examenes: 0, medicamentos: 0, cirugias: 0 };
    const trat = {};
    inf.casos.forEach((c) => {
      if (!okJ(c) || !K.enPeriodo(c.inicio, per)) return;
      if (c.tipo === 'lesion') r.lesiones++; else r.molestias++;
    });
    inf.atenciones.forEach((a) => {
      if (!okJ(a) || !K.enPeriodo(a.fecha, per)) return;
      r.atenciones++;
      Object.keys(a.trat || {}).forEach((tid) => {
        const n = Number(a.trat[tid]) || 0;
        if (!n) return;
        trat[tid] = (trat[tid] || 0) + n;
        const t = K.trat(inf, tid);
        if (t && t.intervencion) r.intervenciones += n;
      });
    });
    inf.eventos.forEach((e) => {
      if (!okJ(e) || !K.enPeriodo(e.fecha, per) || !K.evRealizado(e)) return;
      const n = Number(e.cantidad) || 1;
      if (e.tipo === 'control') r.controles += n;
      else if (e.tipo === 'examen') r.examenes += n;
      else if (e.tipo === 'medicamento') r.medicamentos += n;
      else if (e.tipo === 'cirugia') r.cirugias += n;
    });
    return { porFuente: r, trat };
  };

  // Valor de un indicador = calculado + ajustes manuales del período.
  K.valorIndicador = function (inf, per, ind, cont) {
    cont = cont || K.contar(inf, per);
    let calc = 0;
    if (ind.fuente.startsWith('trat:')) calc = cont.trat[ind.fuente.slice(5)] || 0;
    else if (ind.fuente !== 'manual') calc = cont.porFuente[ind.fuente] || 0;
    const manual = inf.manuales
      .filter((m) => m.indId === ind.id && K.enPeriodo(m.fecha, per))
      .reduce((s, m) => s + (Number(m.cantidad) || 0), 0);
    return { calc, manual, total: calc + manual };
  };

  /* ---------- Estadísticas por jugador ---------- */
  K.statsJugador = function (inf, per, j) {
    const jugados = K.partidosJugados(inf, per);
    const conMin = jugados.filter((p) => (Number(p.minutos[j.id]) || 0) > 0);
    const minutos = jugados.reduce((s, p) => s + (Number(p.minutos[j.id]) || 0), 0);
    const maxMin = jugados.reduce((s, p) => s + (Number(p.duracion) || 90), 0);
    return { partidos: conMin.length, totalPartidos: jugados.length, minutos, maxMin };
  };

  // Casos del jugador dentro del período (por fecha de inicio o por estar activos en él).
  K.casosJugador = function (inf, per, j) {
    return inf.casos.filter((c) => c.jugadorId === j.id && K.enPeriodo(c.inicio, per));
  };

  K.duracionCaso = function (c) {
    if (c.semanas !== '' && c.semanas != null && !isNaN(Number(c.semanas))) {
      const s = Number(c.semanas);
      return s === 1 ? '1 semana' : `${s} semanas`;
    }
    if (c.inicio && c.alta) {
      const dias = Math.max(1, Math.round((new Date(c.alta) - new Date(c.inicio)) / 86400000));
      if (dias < 14) return dias === 1 ? '1 día' : `${dias} días`;
      const s = Math.round(dias / 7);
      return `${s} semanas`;
    }
    if (c.inicio && !c.alta && c.tipo === 'lesion') return 'en curso';
    return '';
  };

  // Agrupa controles y exámenes por nombre: [{nombre, n}]
  K.controlesJugador = function (inf, per, j) {
    const m = {};
    inf.eventos.forEach((e) => {
      if (e.jugadorId !== j.id || !K.enPeriodo(e.fecha, per) || !K.evRealizado(e)) return;
      if (e.tipo !== 'control' && e.tipo !== 'examen') return;
      const k = (e.nombre || (e.tipo === 'control' ? 'Control médico' : 'Examen')).trim();
      m[k] = (m[k] || 0) + (Number(e.cantidad) || 1);
    });
    return Object.keys(m).map((k) => ({ nombre: k, n: m[k] }));
  };

  // Mapa corporal: zona -> gravedad máxima del jugador en el período.
  K.zonasJugador = function (inf, per, j) {
    const peso = { pordefinir: 0, minima: 1, leve: 2, moderada: 3, grave: 4 };
    const z = {};
    K.casosJugador(inf, per, j).forEach((c) => {
      (c.zonas || []).forEach((id) => {
        const g = K.gravClave(c.gravedad);
        if (!z[id] || peso[g] > peso[z[id]]) z[id] = g;
      });
    });
    return z;
  };

  // Intervenciones del jugador por tratamiento (para el gráfico).
  K.intervencionesJugador = function (inf, per, j) {
    const c = K.contar(inf, per, j.id);
    const lista = inf.tratamientos
      .filter((t) => t.intervencion && c.trat[t.id])
      .map((t) => ({ id: t.id, nombre: t.nombre, n: c.trat[t.id] }));
    return { lista, total: c.porFuente.intervenciones, atenciones: c.porFuente.atenciones };
  };


  /* ---------- Disponibilidad, retorno y análisis del equipo ---------- */
  K.TERRENOS = ['Pasto natural', 'Pasto sintético', 'Cemento', 'Tierra', 'Otro'];
  K.MECANISMOS = [['partido', 'Partido'], ['amistoso', 'Partido amistoso'], ['entrenamiento', 'Entrenamiento'], ['gimnasio', 'Gimnasio'], ['otro', 'Otro']];
  K.nombreMecanismo = (v) => (K.MECANISMOS.find((m) => m[0] === v) || [0, ''])[1];
  K.PARTES_LIMITE = [['fisica', 'Solo parte física'], ['tecnica', 'Solo parte técnica'], ['completo', 'Entrenamiento completo']];
  // Molestia que limita el entrenamiento: "1 día · solo parte física" (vacío si no limita).
  // Molestia que terminó siendo lesión: la molestia se conserva y la lesión guarda de cuál viene.
  K.buscarCaso = (id) => { for (const i of K.state.informes) { const c = i.casos.find((x) => x.id === id); if (c) return c; } return null; };
  K.origenCasoTxt = (c) => {
    if (!c) return '';
    if (c.convertidaA) { const l = K.buscarCaso(c.convertidaA); if (l) return `terminó siendo la lesión: ${l.titulo}`; }
    if (c.origenId) { const m = K.buscarCaso(c.origenId); if (m) return `comenzó como molestia: ${m.titulo}`; }
    return '';
  };
  K.FASES_ENTRENO = [['calentamiento', 'Calentamiento'], ['gimnasio', 'Parte física · gimnasio'], ['cancha', 'Parte física · cancha'], ['tecnica', 'Parte técnica']];
  K.MOMENTOS_PARTIDO = [['pre', 'Pre partido'], ['durante', 'Durante el partido'], ['entretiempo', 'Entretiempo'], ['post', 'Post partido']];
  K.esMecPartido = (m) => m === 'partido' || m === 'amistoso';
  // "Entrenamiento · calentamiento" / "Partido · durante el partido · salió del campo"
  K.ocurrioTxt = (c) => {
    if (!c || !c.mecanismo) return '';
    const p = [K.nombreMecanismo(c.mecanismo)], bus = (L, v) => (L.find((x) => x[0] === v) || [0, ''])[1];
    if (c.mecanismo === 'entrenamiento' && c.entFase) p.push(bus(K.FASES_ENTRENO, c.entFase).toLowerCase());
    if (K.esMecPartido(c.mecanismo)) {
      if (c.momento) p.push(bus(K.MOMENTOS_PARTIDO, c.momento).toLowerCase());
      if (c.abandono === 'si') p.push('salió del campo'); else if (c.abandono === 'no' && c.momento === 'durante') p.push('siguió jugando');
    }
    return p.filter(Boolean).join(' · ');
  };
  K.limitaTxt = (c) => {
    if (!c || c.tipo === 'lesion' || c.limita !== 'si' || K.esMecPartido(c.mecanismo)) return '';
    const parte = (K.PARTES_LIMITE.find((p) => p[0] === c.limitaParte) || [0, ''])[1], pt = parte ? ' · ' + parte.charAt(0).toLowerCase() + parte.slice(1) : '';
    if (c.limitaDias === 'indef') return `días aún por definir${pt}`;
    const n = Number(c.limitaDias) || 1;
    return `${n} ${n === 1 ? 'día' : 'días'}${pt}`;
  };
  K.medicamentosJugador = function (inf, per, j) {
    const m = {};
    inf.eventos.forEach((e) => {
      if (e.tipo !== 'medicamento' || e.jugadorId !== j.id || !K.enPeriodo(e.fecha, per)) return;
      const k = (e.nombre || 'Medicamento').trim(); m[k] = (m[k] || 0) + (Number(e.cantidad) || 1);
    });
    return Object.keys(m).map((k) => ({ nombre: k, n: m[k] }));
  };
  const D = (iso) => new Date(iso + 'T12:00:00');
  const dif = (a, b) => Math.round((D(b) - D(a)) / 864e5);
  const sumaDias = (iso, n) => { const d = D(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  K.hastaPer = (per) => { const h = K.hoy(); return per.hasta < h ? per.hasta : h; };
  K.diasPeriodo = (per) => Math.max(1, dif(per.desde, K.hastaPer(per)) + 1);
  // Días de baja de una lesión dentro del período (alta real; si no, semanas estimadas; si no, hasta hoy).
  K.diasBajaCaso = (c, per) => {
    if (c.tipo !== 'lesion' || !c.inicio) return 0;
    let fin = c.alta || null;
    if (!fin && c.semanas !== '' && c.semanas != null && !isNaN(Number(c.semanas))) fin = sumaDias(c.inicio, Math.round(Number(c.semanas) * 7));
    if (!fin) fin = K.hoy();
    const ini = c.inicio > per.desde ? c.inicio : per.desde, tope = K.hastaPer(per), f = fin < tope ? fin : tope;
    return f >= ini ? Math.max(1, dif(ini, f)) : 0;
  };
  K.bajaJugador = (inf, per, j) => {
    const dias = inf.casos.filter((c) => c.jugadorId === j.id).reduce((s, c) => s + K.diasBajaCaso(c, per), 0);
    const dp = K.diasPeriodo(per);
    return { dias, pct: Math.max(0, Math.round(100 * (1 - Math.min(dias, dp) / dp))) };
  };
  K.mesesPeriodo = (per) => {
    const out = []; let y = Number(per.desde.slice(0, 4)), m = Number(per.desde.slice(5, 7));
    const yf = Number(per.hasta.slice(0, 4)), mf = Number(per.hasta.slice(5, 7));
    while ((y < yf || (y === yf && m <= mf)) && out.length < 24) { out.push({ y, m, clave: `${y}-${String(m).padStart(2, '0')}` }); m++; if (m > 12) { m = 1; y++; } }
    return out;
  };
  const NOMBRE_MES = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  K.etiquetaMes = (mm) => NOMBRE_MES[mm.m - 1];
  K.estadisticasEquipo = function (inf, per) {
    const casos = inf.casos.filter((c) => K.enPeriodo(c.inicio, per) && inf.jugadores.some((j) => j.id === c.jugadorId));
    const meses = K.mesesPeriodo(per);
    const r = { casos: casos.length, lesiones: 0, molestias: 0, diasBaja: 0, retorno: null, meses, mesLes: meses.map(() => 0), mesMol: meses.map(() => 0),
      grav: { minima: 0, leve: 0, moderada: 0, grave: 0, pordefinir: 0 }, mec: { partido: 0, amistoso: 0, entrenamiento: 0, gimnasio: 0, otro: 0, sin: 0 }, terreno: {}, zonas: {}, top: [], recurrentes: [], limCasos: 0, limDias: 0, meds: [] };
    K.TERRENOS.concat(['sin']).forEach((t) => { r.terreno[t] = 0; });
    const dr = [];
    casos.forEach((c) => {
      const les = c.tipo === 'lesion';
      if (les) r.lesiones++; else r.molestias++;
      const i = meses.findIndex((m) => m.clave === c.inicio.slice(0, 7));
      if (i >= 0) (les ? r.mesLes : r.mesMol)[i]++;
      r.grav[K.gravClave(c.gravedad)]++;
      r.mec[r.mec[c.mecanismo || 'sin'] === undefined ? 'sin' : (c.mecanismo || 'sin')]++;
      if (!les && c.limita === 'si' && !K.esMecPartido(c.mecanismo)) { r.limCasos++; r.limDias += c.limitaDias === 'indef' ? 0 : Number(c.limitaDias) || 1; }
      r.terreno[K.TERRENOS.includes(c.terreno) ? c.terreno : 'sin']++;
      (c.zonas || []).forEach((z) => { r.zonas[z] = (r.zonas[z] || 0) + 1; });
      if (les) { r.diasBaja += K.diasBajaCaso(c, per); if (c.alta) dr.push(dif(c.inicio, c.alta)); else if (c.semanas !== '' && c.semanas != null && !isNaN(Number(c.semanas))) dr.push(Math.round(Number(c.semanas) * 7)); }
    });
    if (dr.length) r.retorno = Math.round(dr.reduce((a, b) => a + b, 0) / dr.length);
    // ranking de zonas (agrupando lado derecho e izquierdo bajo su nombre)
    r.top = Object.keys(r.zonas).map((id) => [K.nombreZona(id), r.zonas[id]]).sort((a, b) => b[1] - a[1]).slice(0, 8);
    // medicamentos entregados (total por nombre)
    const md = {};
    inf.eventos.forEach((ev) => { if (ev.tipo === 'medicamento' && K.enPeriodo(ev.fecha, per) && inf.jugadores.some((j) => j.id === ev.jugadorId)) { const k = (ev.nombre || 'Medicamento').trim(); md[k] = (md[k] || 0) + (Number(ev.cantidad) || 1); } });
    r.meds = Object.keys(md).map((k) => [k, md[k]]).sort((a, b) => b[1] - a[1]).slice(0, 6);
    // jugadores con más atenciones
    const at = {};
    inf.atenciones.forEach((a) => { if (K.enPeriodo(a.fecha, per)) at[a.jugadorId] = (at[a.jugadorId] || 0) + 1; });
    r.topAt = Object.keys(at).map((id) => [(K.jugador(inf, id) || { nombre: '—' }).nombre, at[id]]).sort((a, b) => b[1] - a[1]).slice(0, 5);
    // recurrencias: mismo jugador y misma zona en 2 o más casos
    const rec = {};
    casos.forEach((c) => (c.zonas || []).forEach((z) => { const k = c.jugadorId + '|' + z; rec[k] = (rec[k] || 0) + 1; }));
    r.recurrentes = Object.keys(rec).filter((k) => rec[k] >= 2).map((k) => { const [jid, z] = k.split('|'); return [(K.jugador(inf, jid) || { nombre: '—' }).nombre, K.nombreZona(z), rec[k]]; }).slice(0, 6);
    return r;
  };
  K.edadAnios = (nac) => (/^\d{4}$/.test(String(nac || '')) ? new Date().getFullYear() - Number(nac) : null);

  K.edad = (nac) => (nac ? String(nac).slice(0, 4) : '');

  /* ---------- Asistencia a kinesiología (pestaña Kine) ---------- */
  // Cada registro diario: v 'si' (asistió) o 'no' (no asistió: pauta en casa, descanso o no asiste). Sin registro = no se entrena.
  // Sesiones esperadas = días marcados, sin contar los de descanso.
  // Motivos de "no asistió". Descanso, pauta en casa y las citas en el mismo horario del entrenamiento (control, examen, procedimiento) no se cuentan como sesión esperada. La enfermedad sí cuenta como no asistida (se informan sus días).
  K.MOTIVOS_NO = [['noasiste', 'No asiste'], ['descanso', 'Descanso'], ['control', 'Control médico · mismo horario del entrenamiento'], ['examen', 'Examen · mismo horario del entrenamiento'], ['procedimiento', 'Procedimiento · mismo horario del entrenamiento'], ['enfermedad', 'Enfermedad (fiebre, virus…)']];
  K.MOTIVOS_NO_CORTO = { pauta: 'Pauta en casa', noasiste: 'No asiste', descanso: 'Descanso', control: 'Control médico', examen: 'Examen', procedimiento: 'Procedimiento', enfermedad: 'Enfermedad' };
  K.NO_EXCLUYE = ['descanso', 'control', 'examen', 'procedimiento', 'pauta']; // la pauta en casa no penaliza
  K.asisEsperada = (a) => a.v === 'si' || (a.v === 'no' && !K.NO_EXCLUYE.includes(a.no));
  // Controles, exámenes y cirugías con fecha posterior a hoy todavía no ocurrieron: no cuentan en totales.
  K.evRealizado = (e) => !['control', 'examen', 'cirugia'].includes(e.tipo) || !e.fecha || e.fecha <= K.hoy();
  K.asistenciaKine = function (inf, jugadorId, per) {
    const rs = (inf.asistencias || []).filter((a) => a.jugadorId === jugadorId && (!per || K.enPeriodo(a.fecha, per)));
    const si = rs.filter((a) => a.v === 'si').length;
    const esp = rs.filter(K.asisEsperada).length;
    const enf = rs.filter((a) => a.v === 'no' && a.no === 'enfermedad').length;
    return { si, esp, pct: esp ? Math.round((100 * si) / esp) : null, dias: rs.length, enf };
  };
  // Historial de lesiones / cirugías de un jugador: histórico, del año del período y del período.
  K.historialJugador = function (inf, j, per) {
    const anio = per.desde.slice(0, 4);
    const lesiones = inf.casos.filter((c) => c.jugadorId === j.id && c.tipo === 'lesion').sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));
    const cirugias = inf.eventos.filter((x) => x.jugadorId === j.id && x.tipo === 'cirugia' && K.evRealizado(x)).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
    const cuenta = (arr, f) => ({ hist: arr.length, anio: arr.filter((x) => (x[f] || '').slice(0, 4) === anio).length, per: arr.filter((x) => K.enPeriodo(x[f], per)).length, anioTxt: anio, lista: arr });
    return { lesiones: cuenta(lesiones, 'inicio'), cirugias: cuenta(cirugias, 'fecha') };
  };
})();

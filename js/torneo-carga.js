/* Torneos, fase 5B: carga y descanso por jugador, estado de salud antes / durante / después, antidopaje y medicamentos,
   reemplazo por lesión y comparación entre torneos. Todo se calcula a partir de lo que ya está registrado (minutos de los partidos,
   atenciones, lesiones, eventos); solo los chequeos de inicio y fin, el control antidopaje y el informe de reemplazo se anotan a mano.
   Datos nuevos (todos opcionales):
   - torneo.chequeos = { inicio: { jugadorId: { estado: 'apto'|'limitado'|'baja', nota } }, fin: { … } }
   - partido.antidopaje = { hubo: bool, jugadores: [ids], nota }
   - incidencia.reemplazo = { hecho: bool, informe: texto }  (la conmoción cerebral trae su propio texto de reemplazo dentro de scat5) */
(function () {
  const K = window.K, T = K.torneos, e = K.esc;
  const fc = (iso) => K.fechaCorta(iso);
  const corto = (iso) => (iso ? fc(iso).slice(0, 5) : '');
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const diaN = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
  const difDias = (a, b) => Math.round(diaN(b) - diaN(a)); // días de calendario entre dos fechas ISO
  const num1 = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');
  const DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const diaTxt = (iso) => DIA[new Date(iso + 'T12:00:00').getDay()];

  // Reglas (se explican en pantalla y en el informe)
  const MIN_DESC = 45, DIAS_DESC = 2, MIN_GRUPO = 4;
  const REGLA_DESCANSO = `Descanso corto: jugó ${MIN_DESC} minutos o más en dos partidos con ${DIAS_DESC} días o menos de diferencia (días de calendario, no horas).`;
  const REGLA_CARGA = `Carga alta: minutos totales iguales o mayores a la mediana del grupo más un desvío estándar (solo si ${MIN_GRUPO} o más jugadores tienen minutos).`;
  const LEYENDA_ANTIDOPAJE = 'Verificar en la lista de sustancias prohibidas vigente (AMA/WADA) antes de administrar';
  const ESTADOS = [['apto', 'Apto'], ['limitado', 'Limitado'], ['baja', 'Baja']];
  const EST_TXT = Object.fromEntries(ESTADOS);

  /* ---------- Cálculos ---------- */
  const isoOk = (f) => (ISO.test(f || '') ? f : '');
  const minDe = (p, id) => Number((p.minutos || {})[id]) || 0;
  const mediana = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const desvio = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / a.length); };

  // Partidos del torneo en orden de fecha (los sin fecha al final) con los días desde el partido anterior.
  function ordenados(inf, t) {
    const js = T.jornadasDe(inf, t).map((jn, i) => ({ jn, i, fecha: isoOk(jn.fecha) }));
    js.sort((a, b) => (a.fecha && b.fecha ? a.fecha.localeCompare(b.fecha) || a.i - b.i : a.fecha ? -1 : b.fecha ? 1 : a.i - b.i));
    let prev = '';
    js.forEach((x) => { x.dias = x.fecha && prev ? difDias(prev, x.fecha) : null; if (x.fecha) prev = x.fecha; });
    return js;
  }
  const jugoJornada = (jn) => jn.ps.some((p) => p.jugado === true || Object.keys(p.minutos || {}).some((id) => minDe(p, id) > 0));

  // Carga por jugador: partidos jugados, minutos, minutos por partido, partidos seguidos, descansos cortos y carga alta.
  function carga(inf, t) {
    const orden = ordenados(inf, t), jugadas = orden.filter((x) => jugoJornada(x.jn)), ps = T.partidosDe(inf, t);
    const mapa = new Map(), tomar = (id) => { if (!mapa.has(id)) { const g = K.jugadorGlobal(id); if (!g) return null; mapa.set(id, { id, j: g.j, num: null, inscrito: false, pj: 0, min: 0, porPartido: [], entradas: [], seguidos: 0, descansos: [], descansoCorto: false, cargaAlta: false }); } return mapa.get(id); };
    (t.inscritos || []).forEach((x) => { const r = tomar(x.id); if (r) { r.inscrito = true; r.num = x.num || null; } });
    ps.forEach((p) => Object.keys(p.minutos || {}).forEach((id) => { const m = minDe(p, id); if (m > 0) { const r = tomar(id); if (r) { r.pj++; r.min += m; r.entradas.push({ fecha: isoOk(p.fecha), min: m }); } } }));
    mapa.forEach((r) => {
      r.porPartido = jugadas.map((x) => x.jn.ps.reduce((a, p) => a + minDe(p, r.id), 0));
      let run = 0; r.porPartido.forEach((m) => { run = m > 0 ? run + 1 : 0; if (run > r.seguidos) r.seguidos = run; });
      const largos = r.entradas.filter((q) => q.fecha && q.min >= MIN_DESC).sort((a, b) => a.fecha.localeCompare(b.fecha));
      for (let i = 1; i < largos.length; i++) { const d = difDias(largos[i - 1].fecha, largos[i].fecha); if (d <= DIAS_DESC) r.descansos.push({ a: largos[i - 1].fecha, b: largos[i].fecha, dias: d }); }
      r.descansoCorto = r.descansos.length > 0;
      r.minPorPartido = r.pj ? r.min / r.pj : 0;
    });
    const con = Array.from(mapa.values()).filter((r) => r.min > 0), mins = con.map((r) => r.min);
    const stats = { n: con.length, aplica: con.length >= MIN_GRUPO, mediana: mins.length ? mediana(mins) : 0, desvio: mins.length ? desvio(mins) : 0, umbral: 0 };
    stats.umbral = stats.mediana + stats.desvio;
    if (stats.aplica && stats.desvio > 0) con.forEach((r) => { r.cargaAlta = r.min >= stats.umbral; });
    const orde = (a, b) => ((a.num || 999) - (b.num || 999)) || a.j.nombre.localeCompare(b.j.nombre, 'es');
    const filas = Array.from(mapa.values()).sort((a, b) => (a.inscrito === b.inscrito ? orde(a, b) : a.inscrito ? -1 : 1));
    return { orden, jugadas, filas, stats, minutos: mins.reduce((a, b) => a + b, 0) };
  }

  const aviso = (c) => (c && c.abandono === 'si' ? 'Se retiró' : c && c.abandono === 'no' ? 'Siguió jugando' : '');
  // Lesiones y molestias “durante el torneo”: las nuevas (del torneo, de sus partidos o de sus inscritos dentro de las fechas) y las anteriores que se atendieron en el torneo.
  function lesionesDurante(inf, t) {
    const r = T.registros(inf, t), nuevas = new Set(r.casos.map((c) => c.id)), ids = new Set(nuevas);
    r.atenciones.forEach((a) => { if (a.casoId) ids.add(a.casoId); });
    const out = [];
    K.state.informes.forEach((i) => (i.casos || []).forEach((c) => {
      if (!ids.has(c.id)) return;
      const g = K.jugadorGlobal(c.jugadorId); if (!g) return;
      let ret = aviso(c);
      if (!ret && c.partidoId && c.incId) { const p = K.state.informes.map((x) => (x.partidos || []).find((q) => q.id === c.partidoId)).find(Boolean), inc = p && (p.incidencias || []).find((q) => q.id === c.incId); if (inc && K.part.jugando(inc.momento)) ret = inc.retiro ? 'Se retiró' : 'Siguió jugando'; }
      out.push({ c, j: g.j, nueva: nuevas.has(c.id), retiro: ret, zona: (c.zonas || []).map((z) => (K.nombreZonaLimpia || K.nombreZona)(z)).join(', ') });
    }));
    return out.sort((a, b) => K.cmpCatNombre(a.j.categoria, a.j.nombre, b.j.categoria, b.j.nombre) || (a.c.inicio || '').localeCompare(b.c.inicio || ''));
  }
  // Estado de un caso (alta, retorno o sigue en baja)
  function estadoCaso(c) {
    const les = c.tipo === 'lesion', rt = K.conmocion && c.conmocion ? K.conmocion.rtpHechas(c) : 0;
    let k = 'baja', txt = les ? 'Sigue en baja' : 'En seguimiento';
    if (c.alta) { k = 'alta'; txt = 'Alta ' + fc(c.alta); } else if (c.altaMedica) { k = 'alta'; txt = 'Alta médica ' + fc(c.altaMedica); } else if (c.retornoPartido) { k = 'retorno'; txt = 'Retornó a partido ' + fc(c.retornoPartido); } else if (c.retornoEntreno) { k = 'retorno'; txt = 'Retornó a entrenar ' + fc(c.retornoEntreno); }
    if (rt && k === 'baja') txt += ` · retorno gradual ${rt} de ${K.conmocion.ETAPAS.length} etapas`;
    return { k, txt };
  }
  const reemplazos = (inf, t) => {
    const out = [];
    T.partidosDe(inf, t).forEach((p) => (p.incidencias || []).forEach((i) => {
      const g = K.jugadorGlobal(i.jugadorId); if (!g) return;
      if (i.scat5) { const sc = K.conmocion ? K.conmocion.limpiar(i.scat5) : null; if (sc && (sc.reemplazo || sc.informeReemplazo)) out.push({ p, i, j: g.j, conm: true, hecho: !!sc.reemplazo, informe: sc.informeReemplazo || '' }); return; }
      const r = i.reemplazo; if (r && typeof r === 'object' && (r.hecho === true || r.informe)) out.push({ p, i, j: g.j, conm: false, hecho: r.hecho === true, informe: String(r.informe || '') });
    }));
    return out.sort((a, b) => (a.p.fecha || '9999').localeCompare(b.p.fecha || '9999') || a.j.nombre.localeCompare(b.j.nombre, 'es'));
  };
  const conmociones = (inf, t) => (K.conmocion ? K.conmocion.filas(T.partidosDe(inf, t)) : []);
  const antidopaje = (inf, t) => T.partidosDe(inf, t).filter((p) => p.antidopaje && p.antidopaje.hubo === true)
    .sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999') || (Number(b.cat) || 0) - (Number(a.cat) || 0));
  // Medicamentos entregados dentro de las fechas del torneo (a los inscritos y a quienes jugaron)
  function medicamentos(inf, t) {
    const ids = new Set((t.inscritos || []).map((x) => x.id));
    T.partidosDe(inf, t).forEach((p) => Object.keys(p.minutos || {}).forEach((id) => { if (minDe(p, id) > 0) ids.add(id); }));
    const out = [];
    K.state.informes.forEach((i) => (i.eventos || []).forEach((v) => {
      if (v.tipo !== 'medicamento' || !ids.has(v.jugadorId) || !T.enRango(t, v.fecha)) return;
      const g = K.jugadorGlobal(v.jugadorId); if (!g) return;
      const n = Number(v.cantidad) || 1;
      out.push({ v, j: g.j, fecha: v.fecha, nombre: v.nombre || 'Medicamento', dosis: `${n} ${n === 1 ? 'unidad' : 'unidades'}${v.notas ? ' · ' + v.notas : ''}` });
    }));
    return out.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || a.j.nombre.localeCompare(b.j.nombre, 'es'));
  }
  const chequeoDe = (t, k, id) => { const x = t.chequeos && t.chequeos[k] && t.chequeos[k][id]; return x && EST_TXT[x.estado] ? x : null; };
  function chequeoResumen(t, k) {
    const r = { apto: 0, limitado: 0, baja: 0, sin: 0, total: (t.inscritos || []).length };
    (t.inscritos || []).forEach((x) => { const c = chequeoDe(t, k, x.id); if (c) r[c.estado]++; else r.sin++; });
    return r;
  }
  const ATENCIONES = (inf, t) => T.registros(inf, t).atenciones;
  // Atenciones por intervención (suma de unidades de cada intervención en las atenciones del torneo)
  function intervenciones(inf, t) {
    const cuenta = {}, nombre = {};
    K.state.informes.forEach((i) => (i.tratamientos || []).forEach((x) => { if (!nombre[x.id]) nombre[x.id] = x.nombre; }));
    ATENCIONES(inf, t).forEach((a) => Object.keys(a.trat || {}).forEach((id) => { const n = Number(a.trat[id]) || 0; if (n > 0) cuenta[id] = (cuenta[id] || 0) + n; }));
    return Object.keys(cuenta).map((id) => [nombre[id] || id, cuenta[id]]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
  }
  // Resumen general del torneo (KPIs del informe)
  function resumenTorneo(inf, t) {
    const k = T.kpis(inf, t), reg = T.registros(inf, t), c = carga(inf, t), ps = T.partidosDe(inf, t).filter((p) => p.jugado);
    const atendidos = new Set(reg.atenciones.map((a) => a.jugadorId).filter((id) => K.jugadorGlobal(id)));
    const ld = lesionesDurante(inf, t);
    return {
      k, partidos: k.partidos, jugados: ps.length, g: k.g, e: k.e, p: k.p, conRes: k.conRes, atenciones: k.atenciones, lesionesNuevas: k.lesiones, molestias: k.molestias,
      conmociones: conmociones(inf, t).length, atendidos: atendidos.size, minutos: c.minutos, enGira: reg.atenciones.filter((a) => a.origen === 'gira').length, inscritos: k.inscritos,
      retiros: ld.filter((x) => x.retiro === 'Se retiró').length
    };
  }
  // Por 1000 minutos jugados
  const tasa = (n, min) => (min > 0 ? Math.round((n * 10000) / min) / 10 : null);
  function comparar(inf) {
    return T.lista(inf).filter((t) => T.partidosDe(inf, t).length > 0).map((t) => {
      const k = T.kpis(inf, t), min = carga(inf, t).minutos;
      return { t, partidos: k.partidos, jugados: k.jugados, minutos: min, atenciones: k.atenciones, lesiones: k.lesiones, atencionesM: tasa(k.atenciones, min), lesionesM: tasa(k.lesiones, min) };
    }).sort((a, b) => (b.t.desde || '').localeCompare(a.t.desde || '') || a.t.nombre.localeCompare(b.t.nombre, 'es'));
  }
  Object.assign(T, { ordenados, carga, lesionesDurante, estadoCaso, reemplazos, conmociones, antidopaje, medicamentos, chequeoDe, chequeoResumen, intervenciones, resumenTorneo, comparar, difDias, tasa,
    REGLA_DESCANSO, REGLA_CARGA, LEYENDA_ANTIDOPAJE, ESTADOS, MIN_DESC, DIAS_DESC, MIN_GRUPO });

  /* ---------- Pestaña Jugadores: partidos y días de descanso, y carga por jugador ---------- */
  const faseDe = (t, jn) => T.faseNombre(t, jn.p0.fase);
  function barras(vals, orden) {
    const max = Math.max(90, ...vals);
    return `<span class="tn-bars" role="img" aria-label="Minutos por partido: ${e(vals.join(', '))}">${vals.map((m, i) => `<i class="${m > 0 ? '' : 'cero'}" style="height:${m > 0 ? Math.max(8, Math.round(100 * m / max)) : 4}%" title="${e((orden[i].jn.rival || '') + ': ' + m + ' min')}"></i>`).join('')}</span>`;
  }
  function cargaHTML(inf, t) {
    const c = carga(inf, t);
    const partidos = c.orden.length ? `<div class="lista tn-dd">${c.orden.map((x) => `<div class="item tn-dd-it"><div class="txt"><b>${e(x.jn.rival)}</b><span>${x.fecha ? e(diaTxt(x.fecha) + ' ' + fc(x.fecha)) : 'Sin fecha'}${faseDe(t, x.jn) ? ' · ' + e(faseDe(t, x.jn)) : ''} · ${x.jn.local ? 'Local' : 'Visita'}${jugoJornada(x.jn) ? '' : ' · por jugar'}</span></div>
        <span class="chip tn-dias${x.dias != null && x.dias <= DIAS_DESC ? ' corto' : ''}">${x.dias == null ? (x.fecha ? 'Primer partido' : 'Sin fecha') : x.dias === 0 ? 'Mismo día' : x.dias + (x.dias === 1 ? ' día' : ' días') + ' después'}</span></div>`).join('')}</div>`
      : '<p class="vacio-msg">Aún no hay partidos en este torneo. Agrégalos en <b>Partidos por fase</b>.</p>';
    const nDesc = c.filas.filter((r) => r.descansoCorto).length, nAlta = c.filas.filter((r) => r.cargaAlta).length;
    const filas = c.filas.length ? c.filas.map((r) => `<div class="tn-car${r.descansoCorto || r.cargaAlta ? ' alerta' : ''}" data-car data-j="${e(r.id)}"><div class="tn-car-h"><b>${e(r.j.nombre)}</b><small>${r.num ? '#' + r.num + ' · ' : ''}${e(r.j.categoria || '')}${r.inscrito ? '' : ' · no inscrito'}</small>
        ${r.descansoCorto ? `<i class="chip g-moderada etq" data-alerta="descanso">Descanso corto${r.descansos.length > 1 ? ' ×' + r.descansos.length : ''}</i>` : ''}${r.cargaAlta ? '<i class="chip g-grave etq" data-alerta="carga">Carga alta</i>' : ''}</div>
        <div class="tn-car-n"><span><b>${r.pj}</b> partido${r.pj === 1 ? '' : 's'}</span><span><b>${r.min}</b> min</span><span><b>${r.pj ? num1(r.minPorPartido) : '0'}</b> min por partido</span><span><b>${r.seguidos}</b> seguido${r.seguidos === 1 ? '' : 's'}</span></div>
        ${c.jugadas.length ? barras(r.porPartido, c.jugadas) : ''}
        ${r.descansoCorto ? `<p class="tn-car-d">${r.descansos.map((d) => `${e(corto(d.a))} y ${e(corto(d.b))} (${d.dias === 0 ? 'mismo día' : d.dias + (d.dias === 1 ? ' día' : ' días')})`).join(' · ')}</p>` : ''}</div>`).join('')
      : '<p class="vacio-msg">Cuando anotes minutos en los partidos del torneo aparecen aquí.</p>';
    return `<div class="card" data-tn-descanso><h2>Partidos y días de descanso</h2>
        <p class="sub">Los partidos del torneo en orden, con los días que pasaron desde el anterior.</p>${partidos}</div>
      <div class="card" data-tn-carga><h2>Carga y descanso por jugador</h2>
        <p class="sub" style="margin-bottom:4px">${e(REGLA_DESCANSO)}</p><p class="sub">${e(REGLA_CARGA)}${c.stats.aplica && c.stats.desvio > 0 ? ` Hoy: mediana ${num1(c.stats.mediana)} min, desvío ${num1(c.stats.desvio)}, desde ${num1(c.stats.umbral)} min.` : ''}</p>
        ${c.filas.length ? `<p class="tn-res" data-tn-alertas><b>${nDesc}</b> con descanso corto · <b>${nAlta}</b> con carga alta · ${c.filas.filter((r) => r.pj).length} jugaron</p>` : ''}
        <div class="tn-cars">${filas}</div></div>`;
  }

  /* ---------- Pestaña Salud ---------- */
  const tabChq = () => (K.ui.torneoChq === 'fin' ? 'fin' : 'inicio');
  const ed = () => T.puedeEd();
  function chequeoHTML(inf, t) {
    const k = tabChq(), ins = T.inscritosOrdenados(t), r = chequeoResumen(t, k), puede = ed();
    const filas = ins.map(({ x, g }) => { const c = chequeoDe(t, k, x.id);
      return `<div class="item tn-chq" data-chq-fila data-j="${e(x.id)}"><div class="txt"><b>${e(g.j.nombre)}</b><span>${x.num ? '#' + x.num + ' · ' : ''}${e(g.j.categoria || '')}</span></div>
        <select data-acc-change="torneoChq" data-id="${e(t.id)}" data-j="${e(x.id)}" data-k="${k}" aria-label="Estado de salud de ${e(g.j.nombre)}" ${puede ? '' : 'disabled'}><option value="">Sin chequear</option>${ESTADOS.map(([v, tx]) => `<option value="${v}"${c && c.estado === v ? ' selected' : ''}>${tx}</option>`).join('')}</select>
        <input type="text" maxlength="120" value="${e(c ? c.nota || '' : '')}" placeholder="Nota corta" autocomplete="off" data-acc-change="torneoChqNota" data-id="${e(t.id)}" data-j="${e(x.id)}" data-k="${k}" aria-label="Nota de ${e(g.j.nombre)}" ${puede ? '' : 'disabled'}></div>`; }).join('');
    return `<div class="card" data-tn-chequeo><div class="fila sb wrap gap"><h2 style="margin:0">Chequeo de salud</h2>${puede && ins.length ? '<button class="btn sec chico" data-acc="torneoTodosAptos">Marcar todos aptos</button>' : ''}</div>
      <p class="sub">Estado de cada inscrito al comenzar y al terminar el torneo. “Marcar todos aptos” solo completa a los que aún no tienen chequeo.</p>
      <div style="margin:0 0 10px">${K.seg('torneoChq', [['inicio', 'Al inicio'], ['fin', 'Al final']], k)}</div>
      <p class="tn-res" data-chq-res>${chequeoResTxt(r)}</p>
      ${ins.length ? `<div class="lista tn-chqs">${filas}</div>` : '<p class="vacio-msg">Aún no hay jugadores inscritos. Agrégalos en la pestaña <b>Jugadores</b>.</p>'}</div>`;
  }
  const chequeoResTxt = (r) => `<b>${r.apto}</b> aptos · <b>${r.limitado}</b> limitados · <b>${r.baja}</b> en baja · <b>${r.sin}</b> sin chequear`;
  function lesionesHTML(inf, t) {
    const l = lesionesDurante(inf, t);
    const fila = (x) => `<tr data-les><td data-l="Jugador"><b>${e(x.j.nombre)}</b></td><td data-l="Lesión o molestia">${e(x.c.titulo || '—')}<small>${x.c.tipo === 'lesion' ? 'Lesión' : 'Molestia'}${x.nueva ? '' : ' · anterior al torneo'}</small></td><td data-l="Zona">${e(x.zona || '—')}</td><td data-l="Gravedad">${e(K.GRAVEDADES[x.c.gravedad] || '—')}</td><td data-l="Inicio">${x.c.inicio ? e(fc(x.c.inicio)) : '—'}</td><td data-l="¿Siguió o se retiró?">${e(x.retiro || '—')}</td></tr>`;
    return `<div class="card" data-tn-lesiones><h2>Lesiones y molestias durante el torneo <span class="suave" style="font-weight:400">(${l.length})</span></h2>
      <p class="sub">Salen solas: las que empezaron durante el torneo (o en sus partidos) y las anteriores que se atendieron en él.</p>
      ${l.length ? `<div class="kt-scroll"><table class="kt"><thead><tr><th>Jugador</th><th>Lesión o molestia</th><th>Zona</th><th>Gravedad</th><th>Inicio</th><th>¿Siguió o se retiró?</th></tr></thead><tbody>${l.map(fila).join('')}</tbody></table></div>` : '<p class="vacio-msg">Sin lesiones ni molestias registradas en este torneo.</p>'}</div>`;
  }
  function retornosHTML(inf, t) {
    const l = lesionesDurante(inf, t).map((x) => Object.assign({ est: estadoCaso(x.c) }, x)), n = (k) => l.filter((x) => x.est.k === k).length;
    return `<div class="card" data-tn-retornos><h2>Retornos y altas</h2>
      <p class="sub">Cómo está hoy cada caso del torneo: quién ya tuvo alta o volvió a jugar y quién sigue en baja.</p>
      ${l.length ? `<p class="tn-res"><b>${n('alta')}</b> altas · <b>${n('retorno')}</b> retornos · <b>${n('baja')}</b> siguen en baja o en seguimiento</p><div class="lista">${l.map((x) => `<div class="item" data-ret><div class="txt"><b>${e(x.j.nombre)}</b><span>${e(x.c.titulo || '')}</span></div><i class="chip ${x.est.k === 'baja' ? 'g-grave' : x.est.k === 'retorno' ? 'g-moderada' : 'g-leve'} etq">${e(x.est.txt)}</i></div>`).join('')}</div>` : '<p class="vacio-msg">Nada que mostrar todavía.</p>'}</div>`;
  }
  function conmocionesHTML(inf, t) {
    const c = conmociones(inf, t); if (!c.length) return '';
    return `<div class="card cm-card" data-tn-conm><h2>Conmociones cerebrales (SCAT5) <span class="suave" style="font-weight:400">(${c.length})</span></h2><p class="sub">${e(K.conmocion.AVISO)}</p><div class="kt-scroll">${K.conmocion.tablaHTML(c, { partido: true, botones: true })}</div></div>`;
  }
  function medicamentosHTML(inf, t) {
    const m = medicamentos(inf, t), ctl = antidopaje(inf, t);
    const tabla = m.length ? `<div class="kt-scroll"><table class="kt"><thead><tr><th>Fecha</th><th>Jugador</th><th>Medicamento</th><th>Dosis</th></tr></thead><tbody>${m.map((x) => `<tr data-med><td data-l="Fecha">${e(fc(x.fecha))}</td><td data-l="Jugador"><b>${e(x.j.nombre)}</b></td><td data-l="Medicamento">${e(x.nombre)}</td><td data-l="Dosis">${e(x.dosis)}</td></tr>`).join('')}</tbody></table></div>`
      : `<p class="vacio-msg">${t.desde || t.hasta ? 'No hay medicamentos entregados dentro de las fechas del torneo.' : 'Define las fechas del torneo para ver los medicamentos entregados.'}</p>`;
    const puede = ed() && K.formEvento;
    return `<div class="card" data-tn-meds><div class="fila sb wrap gap"><h2 style="margin:0">Antidopaje y medicamentos</h2>${puede ? '<button class="btn sec chico" data-acc="torneoMed">Registrar medicamento</button>' : ''}</div>
      <p class="tn-leyenda" data-leyenda-antidopaje><b>${e(LEYENDA_ANTIDOPAJE)}</b></p>
      <h3 class="kc-sub">Medicamentos entregados <span class="suave" style="font-weight:400">(${m.length})</span></h3>${tabla}
      <h3 class="kc-sub" style="margin-top:12px">Controles antidopaje en los partidos <span class="suave" style="font-weight:400">(${ctl.length})</span></h3>
      ${ctl.length ? `<div class="lista">${ctl.map((p) => `<div class="item" data-ctl><div class="txt"><b>${e(p.rival)}${p.cat ? ' · Sub ' + p.cat : ''}</b><span>${p.fecha ? e(fc(p.fecha)) : 'Sin fecha'} · ${p.antidopaje.jugadores.length} jugador${p.antidopaje.jugadores.length === 1 ? '' : 'es'} controlado${p.antidopaje.jugadores.length === 1 ? '' : 's'}${p.antidopaje.nota ? ' · ' + e(p.antidopaje.nota) : ''}</span></div></div>`).join('')}</div>` : '<p class="vacio-msg">Se anota en cada partido, en el bloque “Control antidopaje”.</p>'}</div>`;
  }
  function reemplazosHTML(inf, t) {
    const r = reemplazos(inf, t);
    return `<div class="card" data-tn-reemp><h2>Reemplazos por lesión <span class="suave" style="font-weight:400">(${r.length})</span></h2>
      <p class="sub">Se anotan en la atención del partido (“Reemplazo por lesión: informe médico”). En una conmoción el texto sale de su propio registro.</p>
      ${r.length ? `<div class="lista">${r.map((x) => `<div class="item tn-reemp" data-reemp><div class="txt"><b>${e(x.j.nombre)}</b><span>${e(x.p.rival)}${x.p.cat ? ' · Sub ' + x.p.cat : ''} · ${x.p.fecha ? e(fc(x.p.fecha)) : 'sin fecha'}${x.conm ? ' · conmoción cerebral' : ''} · ${x.hecho ? 'reemplazo hecho' : 'reemplazo no confirmado'}</span>${x.informe ? `<span class="tn-inf">${e(x.informe)}</span>` : ''}</div></div>`).join('')}</div>` : '<p class="vacio-msg">Sin reemplazos por lesión registrados.</p>'}</div>`;
  }
  function saludHTML(inf, t) {
    return chequeoHTML(inf, t) + lesionesHTML(inf, t) + retornosHTML(inf, t) + conmocionesHTML(inf, t) + medicamentosHTML(inf, t) + reemplazosHTML(inf, t);
  }

  /* ---------- Comparación entre torneos (lista) ---------- */
  function comparacionHTML(inf) {
    const c = comparar(inf); if (c.length < 2) return '';
    const f = (v) => (v == null ? '—' : num1(v));
    return `<div class="card" data-tn-comparar><h2>Comparación entre torneos</h2>
      <p class="sub">Atenciones y lesiones por cada 1000 minutos jugados, para comparar torneos de distinto largo.</p>
      <div class="kt-scroll"><table class="kt"><thead><tr><th>Torneo</th><th class="n">Partidos</th><th class="n">Minutos</th><th class="n">Atenciones</th><th class="n">Atenciones por 1000 min</th><th class="n">Lesiones</th><th class="n">Lesiones por 1000 min</th></tr></thead>
        <tbody>${c.map((x) => `<tr data-cmp="${e(x.t.id)}"><td data-l="Torneo"><b>${e(x.t.nombre)}</b></td><td class="n" data-l="Partidos">${x.partidos}</td><td class="n" data-l="Minutos">${x.minutos}</td><td class="n" data-l="Atenciones">${x.atenciones}</td><td class="n" data-l="Atenciones por 1000 min">${f(x.atencionesM)}</td><td class="n" data-l="Lesiones">${x.lesiones}</td><td class="n" data-l="Lesiones por 1000 min">${f(x.lesionesM)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  Object.assign(T, { cargaHTML, saludHTML, comparacionHTML });

  /* ---------- Control antidopaje por partido (bloque plegable en el informe del partido) ---------- */
  const adAbierto = () => (K.ui.adAbierto = K.ui.adAbierto || {});
  function antidopajeHTML(inf, p, puede) {
    if (!p || !p.torneoId) return '';
    const a = p.antidopaje && typeof p.antidopaje === 'object' ? p.antidopaje : { hubo: false, jugadores: [], nota: '' }, sel = new Set(a.jugadores || []);
    const ids = new Set(Object.keys(p.minutos || {}).filter((id) => minDe(p, id) > 0 && K.jugadorGlobal(id)).concat(Array.isArray(p.citados) ? p.citados.filter((id) => K.jugadorGlobal(id)) : [], (a.jugadores || []).filter((id) => K.jugadorGlobal(id))));
    const lista = Array.from(ids).map((id) => K.jugadorGlobal(id).j).sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
    return `<details class="mas-clin tn-ad" data-ad="${e(p.id)}"${adAbierto()[p.id] ? ' open' : ''}><summary>Control antidopaje${a.hubo ? ` <small class="suave">· sí hubo${sel.size ? ' · ' + sel.size + ' jugador' + (sel.size === 1 ? '' : 'es') : ''}</small>` : ''}</summary><div class="mas-cuerpo">
      <p class="tn-leyenda"><b>${e(LEYENDA_ANTIDOPAJE)}</b></p>
      <div class="campo"><span class="lbl">¿Hubo control antidopaje en este partido?</span>${K.seg('adHubo', [['si', 'Sí'], ['no', 'No']], a.hubo ? 'si' : 'no')}</div>
      <div class="${a.hubo ? '' : 'oculto'}" data-ad-det>
        <span class="lbl">Jugadores controlados</span>
        ${lista.length ? `<div class="tn-ad-lista">${lista.map((j) => `<label class="check"><input type="checkbox" data-acc-change="adJugador" data-id="${e(p.id)}" data-j="${e(j.id)}"${sel.has(j.id) ? ' checked' : ''} ${puede ? '' : 'disabled'}><span>${e(j.nombre)}</span></label>`).join('')}</div>` : '<p class="suave" style="margin:4px 0 8px">Anota los minutos o los citados del partido para elegir a los jugadores.</p>'}
        <label class="campo"><span>Nota (opcional)</span><textarea rows="2" maxlength="2000" data-acc-change="adNota" data-id="${e(p.id)}" ${puede ? '' : 'disabled'} placeholder="Ej. sorteo de 2 jugadores por equipo">${e(a.nota || '')}</textarea></label></div></div></details>`;
  }
  function antidopajeResumen(ps) { // vista combinada: solo lectura
    const l = ps.filter((p) => p.torneoId && p.antidopaje && p.antidopaje.hubo);
    return l.length ? `<p class="suave" style="margin:0 0 10px" data-ad-resumen>Control antidopaje: ${l.map((p) => `${p.cat ? 'Sub ' + p.cat : 'partido'} (${p.antidopaje.jugadores.length} jugador${p.antidopaje.jugadores.length === 1 ? '' : 'es'})`).map(e).join(' · ')}</p>` : '';
  }
  // Campos del reemplazo en el formulario de una atención de partido con torneo
  function reemplazoCampos(rec) {
    const r = rec && rec.reemplazo && typeof rec.reemplazo === 'object' ? rec.reemplazo : { hecho: false, informe: '' };
    return `<details class="mas-clin tn-reemp-f" data-reemplazo${r.hecho || r.informe ? ' open' : ''}><summary>Reemplazo por lesión: informe médico</summary><div class="mas-cuerpo">
      <div class="campo"><span class="lbl">¿Se hizo el reemplazo por esta lesión?</span>${K.seg('reemplazoHecho', [['no', 'No'], ['si', 'Sí']], r.hecho ? 'si' : 'no')}</div>
      <label class="campo"><span>Informe médico (opcional)</span><textarea name="informeReemplazo" rows="3" maxlength="3000" placeholder="Diagnóstico, por qué no puede continuar, a quién se informó…">${e(r.informe || '')}</textarea></label>
      <p class="suave" style="margin:0;font-size:13px">Sale en el informe del torneo. Para una conmoción cerebral usa su propio registro (ya trae este texto).</p></div></details>`;
  }
  function reemplazoLeer(hoja, inc) {
    if (!hoja.querySelector('[data-reemplazo]')) return;
    const hecho = K.segValor(hoja, 'reemplazoHecho') === 'si', informe = (K.datos(hoja).informeReemplazo || '').trim().slice(0, 3000);
    if (hecho || informe) inc.reemplazo = { hecho, informe }; else delete inc.reemplazo;
  }
  Object.assign(T, { antidopajeHTML, antidopajeResumen, reemplazoCampos, reemplazoLeer });

  /* ---------- Acciones ---------- */
  const buscarT = (el) => T.buscar(K.inf(), el.dataset.id);
  const buscarP = (id) => K.inf().partidos.find((x) => x.id === id);
  const recalcular = (hoja) => { // actualiza el resumen de aptos/limitados sin volver a dibujar la pantalla
    const t = T.buscar(K.inf(), K.ui.torneoId), el = document.querySelector('[data-chq-res]'); if (t && el) el.innerHTML = chequeoResTxt(chequeoResumen(t, tabChq()));
  };
  Object.assign(K.acciones, {
    torneoChq(el) {
      const t = buscarT(el); if (!t || !ed()) return; const k = el.dataset.k === 'fin' ? 'fin' : 'inicio', id = el.dataset.j;
      if (!(t.inscritos || []).some((x) => x.id === id)) return;
      t.chequeos = t.chequeos || { inicio: {}, fin: {} }; t.chequeos[k] = t.chequeos[k] || {};
      if (!EST_TXT[el.value]) delete t.chequeos[k][id]; else t.chequeos[k][id] = { estado: el.value, nota: (t.chequeos[k][id] && t.chequeos[k][id].nota) || '' };
      K.guardar(); recalcular(); K.aviso('Guardado');
    },
    torneoChqNota(el) {
      const t = buscarT(el); if (!t || !ed()) return; const k = el.dataset.k === 'fin' ? 'fin' : 'inicio', id = el.dataset.j, nota = el.value.replace(/\s+/g, ' ').trim().slice(0, 120);
      t.chequeos = t.chequeos || { inicio: {}, fin: {} }; t.chequeos[k] = t.chequeos[k] || {};
      const c = t.chequeos[k][id];
      if (!c) { if (!nota) return; K.aviso('Elige primero el estado de salud de este jugador', true); el.value = ''; return; }
      c.nota = nota; K.guardar(); K.aviso('Guardado');
    },
    torneoTodosAptos(el) {
      const t = T.buscar(K.inf(), K.ui.torneoId); if (!t || !ed()) return; const k = tabChq();
      t.chequeos = t.chequeos || { inicio: {}, fin: {} }; t.chequeos[k] = t.chequeos[k] || {};
      let n = 0; (t.inscritos || []).forEach((x) => { if (!K.jugadorGlobal(x.id) || t.chequeos[k][x.id]) return; t.chequeos[k][x.id] = { estado: 'apto', nota: '' }; n++; });
      K.guardar(); K.aviso(n ? `${n} jugador${n === 1 ? '' : 'es'} marcado${n === 1 ? '' : 's'} como apto${n === 1 ? '' : 's'}` : 'Todos ya tienen chequeo'); K.render();
    },
    torneoMed() { if (ed() && K.formEvento) K.formEvento('medicamento', {}); },
    adJugador(el) {
      const p = buscarP(el.dataset.id); if (!p || !ed()) return; const a = (p.antidopaje = p.antidopaje || { hubo: true, jugadores: [], nota: '' }), id = el.dataset.j;
      const s = new Set(a.jugadores || []); if (el.checked) s.add(id); else s.delete(id); a.jugadores = Array.from(s); K.guardar(); K.aviso('Guardado');
    },
    adNota(el) { const p = buscarP(el.dataset.id); if (!p || !ed()) return; const a = (p.antidopaje = p.antidopaje || { hubo: true, jugadores: [], nota: '' }); a.nota = el.value.trim().slice(0, 2000); K.guardar(); K.aviso('Guardado'); }
  });
  document.addEventListener('seg', (ev) => {
    const d = ev.target && ev.target.dataset && ev.target.dataset.seg;
    if (!ev.target.closest || !ev.target.closest('#view')) return;
    if (d === 'torneoChq') { K.ui.torneoChq = ev.detail; K.render(); }
    if (d === 'adHubo') {
      const box = ev.target.closest('[data-ad]'), p = box && buscarP(box.dataset.ad); if (!p || !ed()) return;
      const a = (p.antidopaje = p.antidopaje && typeof p.antidopaje === 'object' ? p.antidopaje : { hubo: false, jugadores: [], nota: '' });
      a.hubo = ev.detail === 'si'; K.guardar(); K.aviso('Guardado');
      const det = box.querySelector('[data-ad-det]'); if (det) det.classList.toggle('oculto', !a.hubo);
    }
  });
  // El bloque plegable recuerda si estaba abierto cuando la pantalla se vuelve a dibujar.
  document.addEventListener('toggle', (ev) => { const d = ev.target; if (d && d.matches && d.matches('details[data-ad]')) adAbierto()[d.dataset.ad] = d.open; }, true);
})();

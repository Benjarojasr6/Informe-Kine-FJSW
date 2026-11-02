/* Registro SCAT5 en tres momentos (v1.6.2): en cancha, en camarín y seguimiento.
   Es un registro de apoyo inspirado en la estructura de la evaluación SCAT5 (Concussion in Sport Group, 2017): no es el SCAT5 oficial ni lo reemplaza.
   Textos y listas propios, todos en js/scat5-datos.js (K.SCAT5_TEXTOS).
   Datos: incidencia.scat5.evals = [{ id, momento: 'cancha'|'camarin'|'seguimiento', fecha, hora, estado, paso, hechos, ...campos del momento }].
   Los puntajes de resumen de scat5 (sintomas, severidad, sacOri, sacMem, sacConc, sacDif, equilibrio, coord) son los de la evaluación MÁS RECIENTE
   que midió cada cosa; scat5.eval (“Evaluación realizada”) sale de las evaluaciones hechas. Un scat5.det de la v1.6.1 se migra solo a evals.
   Todo es opcional: un registro sin evals se ve igual que antes. Funciona sin internet. */
(function () {
  const K = window.K;
  const e = K.esc;
  const C = K.conmocion;
  const T = K.SCAT5_TEXTOS;
  const plano = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const fc = (iso) => (iso ? K.fechaCorta(iso) : '');

  /* ---------- Catálogos ---------- */
  const AVISO_RESULTADO = T.avisoResultado, AVISO_HERRAMIENTA = T.leyenda, AVISO_EDAD = T.avisoEdad;
  const MOMS = T.momentos;
  const MOM = (k) => MOMS.find((m) => m.k === k);
  const MADDOCKS = T.maddocks, GCS = T.gcs, SINTOMAS = T.sintomas, ORIENT = T.orientacion, LISTAS = T.listas, DIGITOS = T.digitos, BESS = T.bess, MESES_REVES = T.mesesReves;
  const SEG_MBESS = 30, ESPERA_DIF = 5 * 60 * 1000, MAX_EVALS = 40;
  const HECHOS = { cancha: ['ban', 'sig', 'mad', 'exa', 'dec'], camarin: ['ant', 'sint', 'cog', 'exa', 'dif', 'dec'], seguimiento: ['sint', 'cog', 'exa', 'opc', 'res'] };
  const ISO = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 1900;
  const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
  const hora = (ms) => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /* ---------- Datos ---------- */
  const ceros = (n) => new Array(n).fill(0);
  const antVacio = () => ({ previas: '', ultima: '', migrana: '', tdah: '', aprend: '', ansDep: '', medic: '' });
  // Evaluación nueva de un momento (con la fecha y la hora de ahora)
  function evalVacia(momento, o) {
    const r = { id: K.uid(), momento, fecha: K.hoy(), hora: hora(Date.now()), estado: 'borrador', paso: 0, hechos: {} };
    if (momento === 'cancha') Object.assign(r, { mad: ['', '', '', '', ''], gcs: { o: 0, v: 0, m: 0 }, cuello: { rom: '', dolor: '', extr: '' } });
    else {
      Object.assign(r, { sint: ceros(22), esfFis: '', esfMen: '', pct: '', ori: ceros(5), lista: 'A', mem: [ceros(10), ceros(10), ceros(10)], tMem: 0, dig: ['', '', '', ''], meses: '', bess: ['', '', ''], superficie: '', calzado: '' });
      if (momento === 'camarin') Object.assign(r, { ant: antVacio(), cuello: { rom: '', dolor: '', extr: '' }, coordDN: '', dif: ceros(10) });
    }
    return Object.assign(r, o || {});
  }
  // Deja la evaluación válida (enums, números en su rango, largos fijos, fecha y hora). Idempotente.
  function limpiarEval(d) {
    if (!plano(d) || !MOM(d.momento)) return null;
    const m = d.momento, M = MOM(m);
    const ent = (x, a, b, def) => { const n = Number(x); return x === '' || x == null || typeof x === 'boolean' || typeof x === 'object' || !Number.isFinite(n) || n < a || n > b ? def : Math.round(n); };
    const enu = (x, l) => (l.includes(x) ? x : l[0]);
    const arr = (x, n, f) => { const a = Array.isArray(x) ? x : []; return Array.from({ length: n }, (_, i) => f(a[i])); };
    const bin = (x) => (x === 1 || x === true ? 1 : 0);
    const str = (x, n) => (typeof x === 'string' ? x : '').replace(/[<>]/g, '').slice(0, n);
    const r = { id: typeof d.id === 'string' && /^[\w-]{1,40}$/.test(d.id) ? d.id : K.uid(), momento: m, fecha: ISO(d.fecha) ? d.fecha : '', hora: HORA.test(d.hora) ? d.hora : '',
      estado: d.estado === 'final' ? 'final' : 'borrador', paso: ent(d.paso, 0, M.pasos.length - 1, 0), hechos: {} };
    if (plano(d.hechos)) HECHOS[m].forEach((k) => { if (d.hechos[k] === true) r.hechos[k] = true; });
    const cu = plano(d.cuello) ? d.cuello : {};
    if (m === 'cancha') {
      const g = plano(d.gcs) ? d.gcs : {};
      r.mad = arr(d.mad, 5, (x) => enu(x, ['', 'ok', 'no']));
      r.gcs = { o: ent(g.o, 0, 4, 0), v: ent(g.v, 0, 5, 0), m: ent(g.m, 0, 6, 0) };
      r.cuello = { rom: enu(cu.rom, ['', 'normal', 'alterado']), dolor: enu(cu.dolor, ['', 'no', 'si']), extr: '' };
      return r;
    }
    r.sint = arr(d.sint, 22, (x) => ent(x, 0, 6, 0)); r.esfFis = enu(d.esfFis, ['', 'si', 'no']); r.esfMen = enu(d.esfMen, ['', 'si', 'no']); r.pct = ent(d.pct, 0, 100, '');
    r.ori = arr(d.ori, 5, bin); r.lista = enu(d.lista, ['A', 'B', 'C']); r.mem = [0, 1, 2].map((k) => arr(Array.isArray(d.mem) ? d.mem[k] : [], 10, bin));
    r.tMem = Number.isFinite(Number(d.tMem)) && Number(d.tMem) > 0 && Number(d.tMem) < 4e12 ? Math.round(Number(d.tMem)) : 0;
    r.dig = arr(d.dig, 4, (x) => enu(x, ['', 'ok', 'no'])); r.meses = enu(d.meses, ['', 'ok', 'no']);
    r.bess = arr(d.bess, 3, (x) => ent(x, 0, 10, '')); r.superficie = enu(d.superficie, ['', 'firme', 'cesped']); r.calzado = enu(d.calzado, ['', 'con', 'sin']);
    if (m === 'camarin') {
      const a = plano(d.ant) ? d.ant : {};
      r.ant = { previas: enu(a.previas, ['', '0', '1', '2', '3']), ultima: str(a.ultima, 40), migrana: enu(a.migrana, ['', 'si', 'no']), tdah: enu(a.tdah, ['', 'si', 'no']), aprend: enu(a.aprend, ['', 'si', 'no']), ansDep: enu(a.ansDep, ['', 'si', 'no']), medic: str(a.medic, 120) };
      r.cuello = { rom: enu(cu.rom, ['', 'normal', 'alterado']), dolor: enu(cu.dolor, ['', 'no', 'si']), extr: enu(cu.extr, ['', 'normal', 'alterado']) };
      r.coordDN = enu(d.coordDN, ['', 'normal', 'alterada']); r.dif = arr(d.dif, 10, bin);
    }
    return r;
  }
  function limpiarEvals(a) {
    if (!Array.isArray(a)) return [];
    const vistos = new Set(), out = [];
    a.forEach((x) => {
      if (out.length >= MAX_EVALS) return;
      const r = limpiarEval(x); if (!r) return;
      if (vistos.has(r.id)) r.id = K.uid();
      vistos.add(r.id); out.push(r);
    });
    return out;
  }
  // Migración: el detalle de la v1.6.1 (scat5.det) pasa a una evaluación en cancha y otra en camarín
  function desdeDet(det) {
    if (!plano(det)) return [];
    const h = plano(det.hechos) ? det.hechos : {}, out = [];
    const cu = plano(det.cuello) ? det.cuello : {};
    const madAlgo = Array.isArray(det.mad) && det.mad.some((x) => x === 'ok' || x === 'no'), g = plano(det.gcs) ? det.gcs : {};
    if (h.a === true || madAlgo || g.o || g.v || g.m) {
      const f = h.a === true;
      out.push({ id: 'mig-cancha', momento: 'cancha', estado: f ? 'final' : 'borrador', paso: f ? 4 : 0, hechos: f ? { ban: true, sig: true, mad: true, exa: true, dec: true } : {}, mad: det.mad, gcs: det.gcs, cuello: {} });
    }
    const alguna = h.b || h.c || h.d || h.e || (Array.isArray(det.sint) && det.sint.some((x) => Number(x) > 0)) || det.esfFis || det.esfMen || (det.pct !== '' && det.pct != null) || (Array.isArray(det.ori) && det.ori.some(Boolean))
      || (Array.isArray(det.mem) && det.mem.some((m) => Array.isArray(m) && m.some(Boolean))) || (Array.isArray(det.dig) && det.dig.some(Boolean)) || det.meses || cu.rom || cu.dolor || cu.extr || det.coordDN
      || (Array.isArray(det.bess) && det.bess.some((x) => x !== '' && x != null)) || (Array.isArray(det.dif) && det.dif.some(Boolean));
    if (alguna) {
      const fin = det.estado === 'final', hc = { sint: h.b === true, cog: h.c === true, exa: h.d === true, dif: h.e === true, dec: fin };
      const orden = ['sint', 'cog', 'exa', 'dif', 'dec'], sig = orden.findIndex((k) => !hc[k]);
      out.push(Object.assign({}, det, { id: 'mig-camarin', momento: 'camarin', estado: fin ? 'final' : 'borrador', hechos: hc, paso: sig < 0 ? 5 : sig + 1 }));
    }
    return out;
  }
  // Evaluaciones de un registro scat5 (también migra el detalle antiguo)
  function evalsDe(v) {
    if (!plano(v)) return [];
    if (Array.isArray(v.evals)) return limpiarEvals(v.evals);
    return limpiarEvals(desdeDet(v.det));
  }
  // Orden cronológico estable
  function ordenadas(evs) {
    return (evs || []).map((x, i) => [x, i]).sort((a, b) => ((a[0].fecha || '') + ' ' + (a[0].hora || '')).localeCompare((b[0].fecha || '') + ' ' + (b[0].hora || '')) || a[1] - b[1]).map((x) => x[0]);
  }

  /* ---------- Puntajes (se calculan de cada evaluación; no se guardan aparte) ---------- */
  const suma = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
  function puntajes(ev) {
    if (ev.momento === 'cancha') {
      return { mad: ev.mad.filter((x) => x === 'ok').length, gcs: ev.gcs.o && ev.gcs.v && ev.gcs.m ? ev.gcs.o + ev.gcs.v + ev.gcs.m : null };
    }
    const memInt = ev.mem.map(suma);
    return { sint: ev.sint.filter((x) => x > 0).length, sev: suma(ev.sint), ori: suma(ev.ori), memInt, mem: suma(memInt), conc: ev.dig.filter((x) => x === 'ok').length + (ev.meses === 'ok' ? 1 : 0), eq: suma(ev.bess), dif: ev.dif ? suma(ev.dif) : 0 };
  }
  // ¿Qué partes ya tienen datos? (así un borrador a medias no muestra ceros que nadie midió)
  function tiene(ev) {
    const h = ev.hechos || {};
    if (ev.momento === 'cancha') {
      const mad = !!h.mad || ev.mad.some(Boolean), gcs = !!(ev.gcs.o || ev.gcs.v || ev.gcs.m), cu = !!(ev.cuello.rom || ev.cuello.dolor);
      return { a: !!(h.ban || h.sig || h.mad || h.exa || h.dec) || mad || gcs || cu, mad, gcs, cuello: !!h.exa || cu };
    }
    const cam = ev.momento === 'camarin';
    return {
      sint: !!h.sint || ev.sint.some((x) => x > 0) || !!ev.esfFis || !!ev.esfMen || ev.pct !== '',
      ori: !!h.cog || ev.ori.some(Boolean), mem: !!h.cog || ev.mem.some((m) => m.some(Boolean)), conc: !!h.cog || ev.dig.some(Boolean) || !!ev.meses,
      eq: !!h.exa || ev.bess.some((x) => x !== ''), coord: cam && !!ev.coordDN, cuello: cam && (!!ev.cuello.rom || !!ev.cuello.dolor || !!ev.cuello.extr),
      dif: cam && (!!h.dif || ev.dif.some(Boolean)), ant: cam && (!!h.ant || Object.keys(ev.ant).some((k) => ev.ant[k] !== ''))
    };
  }
  const sacDe = (ev) => { const p = puntajes(ev); return p.ori + p.mem + p.conc; };
  // Campos de resumen del scat5: el valor de la evaluación más reciente que midió cada cosa
  function resumen(sc) {
    const r = {};
    ordenadas(sc.evals).forEach((ev) => {
      if (ev.momento === 'cancha') return;
      const p = puntajes(ev), t = tiene(ev);
      if (t.sint) { r.sintomas = p.sint; r.severidad = p.sev; }
      if (t.ori) r.sacOri = p.ori;
      if (t.mem) r.sacMem = p.mem;
      if (t.conc) r.sacConc = p.conc;
      if (t.dif) r.sacDif = p.dif;
      if (t.eq) r.equilibrio = p.eq;
      if (t.coord) r.coord = ev.coordDN;
    });
    return r;
  }
  const RANGO = { no: 0, cancha: 1, camarin: 2, completo: 3 };
  // “Evaluación realizada” que corresponde a las evaluaciones (nunca baja una ya marcada a mano)
  function evalDe(actual, evs) {
    const canch = evs.some((x) => x.momento === 'cancha' && tiene(x).a);
    const cams = evs.filter((x) => x.momento === 'camarin');
    const alguna = cams.some((x) => { const t = tiene(x); return Object.keys(x.hechos).length || t.sint || t.ori || t.mem || t.conc || t.eq || t.coord || t.cuello || t.dif || t.ant; });
    const todo = cams.some((x) => x.estado === 'final' && ['sint', 'cog', 'exa', 'dif'].every((k) => x.hechos[k]));
    const der = canch && todo ? 'completo' : alguna ? 'camarin' : canch ? 'cancha' : 'no';
    const a = RANGO[actual] === undefined ? 'no' : actual;
    return RANGO[der] > RANGO[a] ? der : a;
  }
  // Pone en el scat5 los puntajes de las evaluaciones y la evaluación realizada
  function aplicar(sc) {
    if (!Array.isArray(sc.evals) || !sc.evals.length) return sc;
    const r = resumen(sc);
    Object.keys(r).forEach((k) => { sc[k] = r[k]; });
    sc.eval = evalDe(sc.eval, sc.evals);
    return sc;
  }
  const completa = (sc) => (sc.evals || []).length > 0 && evalDe('no', sc.evals) === 'completo';
  const delMom = (sc, k) => ordenadas(sc.evals).filter((x) => x.momento === k);
  function estadoTxt(sc) {
    const ev = plano(sc) ? sc.evals || [] : [];
    if (!ev.length) return 'Sin hacer en la app';
    const f = (k) => { const L = delMom(sc, k), fin = L.filter((x) => x.estado === 'final'); return fin.length ? (k === 'seguimiento' ? `${fin.length} ${fin.length === 1 ? 'evaluación' : 'evaluaciones'}` : `hecha${fin[fin.length - 1].hora ? ' ' + fin[fin.length - 1].hora : ''}`) : L.length ? 'borrador' : 'pendiente'; };
    return `En cancha: ${f('cancha')} · En camarín: ${f('camarin')} · Seguimiento: ${f('seguimiento')}`;
  }
  const hayRoja = (sc) => C.hayBandera(sc);

  /* ---------- Textos de cada evaluación y comparación ---------- */
  function resumenEvalTxt(ev) {
    const p = puntajes(ev), t = tiene(ev), r = [];
    if (ev.momento === 'cancha') {
      if (t.mad) r.push(`Maddocks ${p.mad}/5`);
      if (p.gcs != null) r.push(`Glasgow ${p.gcs}/15`);
      if (ev.cuello.dolor || ev.cuello.rom) r.push(`cuello: ${ev.cuello.dolor === 'si' ? 'con dolor' : ev.cuello.dolor === 'no' ? 'sin dolor' : 'dolor —'}, movimiento ${ev.cuello.rom === 'normal' ? 'normal' : ev.cuello.rom === 'alterado' ? 'alterado' : '—'}`);
      return r.join(' · ');
    }
    if (t.sint) r.push(`síntomas ${p.sint}/22`, `severidad ${p.sev}/132`);
    if (t.ori && t.mem && t.conc) r.push(`cognitivo ${p.ori + p.mem + p.conc}/40`);
    else { if (t.ori) r.push(`orientación ${p.ori}/5`); if (t.mem) r.push(`memoria inmediata ${p.mem}/30`); if (t.conc) r.push(`concentración ${p.conc}/5`); }
    if (t.dif) r.push(`memoria diferida ${p.dif}/10`);
    if (t.eq) r.push(`mBESS ${p.eq} ${p.eq === 1 ? 'error' : 'errores'}`);
    return r.join(' · ');
  }
  const cuando = (ev) => [fc(ev.fecha), ev.hora].filter(Boolean).join(' ');
  // Una línea por evaluación (informes y línea de tiempo)
  function lineasEvals(sc) {
    return ordenadas(sc.evals).map((ev) => `${MOM(ev.momento).t}${cuando(ev) ? ' · ' + cuando(ev) : ''} · ${resumenEvalTxt(ev) || 'sin datos'}${ev.estado === 'final' ? '' : ' (borrador)'}`);
  }
  // Serie para comparar: camarín y seguimientos, con la tendencia de cada medida respecto de la anterior
  function serie(sc) {
    const prev = {};
    return ordenadas(sc.evals).filter((x) => x.momento !== 'cancha').map((ev) => {
      const t = tiene(ev), p = puntajes(ev);
      const r = { ev, sint: t.sint ? p.sint : null, sev: t.sint ? p.sev : null, sac: t.ori && t.mem && t.conc ? p.ori + p.mem + p.conc : null, eq: t.eq ? p.eq : null, tend: {} };
      ['sint', 'sev', 'sac', 'eq'].forEach((k) => {
        if (r[k] == null) return;
        if (prev[k] != null) { const d = Math.sign(r[k] - prev[k]), mejor = k === 'sac' ? d > 0 : d < 0; r.tend[k] = d === 0 ? ['=', 'igual', 'ig'] : [d > 0 ? '↑' : '↓', mejor ? 'mejora' : 'empeora', mejor ? 'mej' : 'emp']; }
        prev[k] = r[k];
      });
      return r;
    }).filter((r) => r.sint != null || r.sac != null || r.eq != null);
  }
  function filaSerie(r) {
    const c = (k) => (r[k] == null ? '—' : `${r[k]}${r.tend[k] ? `<small class="sc-t ${r.tend[k][2]}">${r.tend[k][0]} ${r.tend[k][1]}</small>` : ''}`);
    return `<tr><td data-l="Fecha">${e(cuando(r.ev) || '—')}<small class="sc-mo">${e(MOM(r.ev.momento).t)}</small></td><td class="n" data-l="Síntomas (de 22)">${c('sint')}</td><td class="n" data-l="Severidad (de 132)">${c('sev')}</td><td class="n" data-l="SAC cognitivo (de 40)">${c('sac')}</td><td class="n" data-l="mBESS (errores, de 30)">${c('eq')}</td></tr>`;
  }
  const CAB_SERIE = '<th>Fecha</th><th class="n">Síntomas<small>de 22</small></th><th class="n">Severidad<small>de 132</small></th><th class="n">SAC cognitivo<small>de 40</small></th><th class="n">mBESS<small>errores, de 30</small></th>';
  // Tabla comparativa por fecha. Vacía si hay menos de “min” mediciones.
  function compHTML(sc, o) {
    o = o || {};
    const rows = serie(sc); if (rows.length < (o.min || 2)) return '';
    const cls = o.cls || 'sc-tab';
    return `<div class="sc-comp"><h3 class="${cls === 'kn-t' ? 'fj-sub' : 'sc-h'}">Evolución por fecha</h3><div class="kt-scroll"><table class="${cls} sc-comp-t"><thead><tr>${CAB_SERIE}</tr></thead><tbody>${rows.map(filaSerie).join('')}</tbody></table></div>
      <p class="sc-nota">Las flechas muestran hacia dónde cambió el número; la palabra dice si es mejor o peor. SAC cognitivo = orientación + memoria inmediata + concentración.</p></div>`;
  }

  /* ---------- Avisos: SCAT5 pendiente (pantalla Hoy) ---------- */
  const deCaso = (c) => { const x = C.incDeCaso(c); return x ? { p: x.p, inc: x.inc } : null; };
  // { tipo: 'camarin'|'seguimiento', txt } o null. Solo conmociones recientes, sin alta de conmoción ni retorno gradual completo.
  function pendiente(c, ahora) {
    if (!c || c.conmocion !== true || c.alta || ISO(c.conmocionAlta) || C.rtpHechas(c) >= C.ETAPAS.length) return null;
    const x = deCaso(c); if (!x) return null;
    ahora = ahora || new Date();
    const ini = ISO(c.inicio) ? new Date(c.inicio + 'T00:00:00') : null;
    if (ini && (ahora - ini) / 864e5 > 60) return null;
    const sc = C.limpiar(x.inc.scat5); if (!sc) return null;
    const evs = sc.evals || [];
    const cam = evs.some((v) => v.momento === 'camarin' && v.estado === 'final') || (!evs.length && ['camarin', 'completo'].includes(sc.eval));
    if (!cam) return { tipo: 'camarin', txt: 'Falta la evaluación en camarín' };
    const fin = ordenadas(evs).filter((v) => v.momento !== 'cancha' && v.estado === 'final' && v.fecha);
    if (!fin.length) return null;
    const u = fin[fin.length - 1], ms = new Date(u.fecha + 'T' + (u.hora || '00:00') + ':00').getTime();
    const h = (ahora.getTime() - ms) / 36e5;
    if (!(h > 24)) return null;
    return { tipo: 'seguimiento', txt: h < 48 ? 'Más de 24 h sin seguimiento' : `${Math.floor(h / 24)} días sin seguimiento` };
  }

  /* ---------- Descarga del SCAT5 oficial (copia sin modificar, en docs/) ---------- */
  const hayOficial = () => !window.K_ARTEFACTO;
  const LEY_OFICIAL = 'SCAT5 © Concussion in Sport Group 2017 · para uso de profesionales de la salud';
  function enlaceOficialHTML(cls) {
    if (!hayOficial()) return '';
    return `<a class="btn sec ${cls || 'chico'} sc-oficial" href="docs/scat5-es.pdf" download="SCAT5-es.pdf" data-sc-oficial>${K.uiIco('descargar', 16)} Descargar el SCAT5 oficial (PDF)</a>`;
  }
  function tarjetaDocumentos() {
    if (!hayOficial()) return '';
    return `<div class="card" data-card-docs-ajustes><h2>Documentos</h2><p class="sub">El formulario oficial del SCAT5 en español, tal cual, para tenerlo a mano y imprimirlo.</p>
      <div class="fila wrap gap">${enlaceOficialHTML('chico')}</div><p class="suave" style="margin:8px 0 0">${e(LEY_OFICIAL)}</p></div>`;
  }

  /* ---------- Asistente ---------- */
  const rotulo = (s) => `<h3 class="sc-h">${s}</h3>`;
  const seg = (name, ops, sel, ex) => K.seg(name, ops, sel, 'sc-seg' + (ex ? ' ' + ex : ''));
  const chk = (att, i, txt, on) => `<label class="check sc-chk"><input type="checkbox" ${att}="${i}"${on ? ' checked' : ''}><span>${e(txt)}</span></label>`;
  const val = (k, extra) => `<b data-sc-v="${k}"${extra || ''}></b>`;
  const sn2 = [['si', 'Sí'], ['no', 'No']];
  const rapido = (k, txt) => `<button type="button" class="btn sc-b sc-rapido" data-sc-rapido="${k}">${e(txt)}</button>`;

  /* --- Momento 1 · en cancha --- */
  function pBan(ev, sc) {
    return `${rotulo('Banderas rojas')}
      <p class="suave sc-ay">Marca las que veas. Con cualquiera: saca al jugador de la cancha y deriva a urgencia. Si no hay ninguna, toca Siguiente.</p>
      <div class="cm-urg oculto" data-sc-urg role="alert"><b>Derivación urgente a servicio de urgencia</b><span>Hay al menos una bandera roja. Se dejó marcada la derivación.</span>
        <button type="button" class="btn sc-b sc-fin-ya" data-sc-fin-ya>Terminar aquí y derivar</button></div>
      <div class="sc-chks">${C.BANDERAS.map(([k, t]) => chk('data-sc-ban', k, t, sc.banderas[k])).join('')}</div>`;
  }
  function pSig(ev, sc) {
    return `${rotulo('Signos que ves')}<p class="suave sc-ay">Marca lo que notaste en el jugador. Si no ves ninguno, toca Siguiente.</p>
      <div class="sc-chks">${C.SIGNOS.map(([k, t]) => chk('data-sc-sg', k, t, sc.signos[k])).join('')}</div>`;
  }
  function pMad(ev) {
    return `${rotulo('Preguntas de memoria')}<p class="suave sc-ay">Hazle las 5 preguntas y marca si respondió bien. <span class="sc-tot">Aciertos: ${val('mad')} de 5</span></p>
      ${rapido('mad', 'Respondió bien las 5 · seguir')}
      ${MADDOCKS.map((q, i) => `<div class="sc-preg"><span>${i + 1}. ${e(q)}</span>${seg('m' + i, [['ok', 'Correcta'], ['no', 'Incorrecta']], ev.mad[i])}</div>`).join('')}`;
  }
  function pExaC(ev) {
    const sg = (n, t, ops, s) => `<div class="sc-preg"><span>${t}</span>${seg(n, ops, s)}</div>`;
    return `${rotulo('Glasgow y cuello')}${rapido('exa', 'Glasgow 15 y cuello normal · seguir')}
      <p class="suave sc-ay">O elige a mano la mejor respuesta de cada parte.</p>
      ${Object.keys(GCS).map((k) => `<div class="sc-preg"><span>${GCS[k][0]}</span>${seg('g' + k, GCS[k][1].map(([n, t]) => [n, n + ' · ' + t]), ev.gcs[k] || '', 'v')}</div>`).join('')}
      <details class="sc-det"><summary>Ver el total del Glasgow</summary><p class="sc-tot">Total: ${val('gcs')} (de 3 a 15)</p></details>
      ${rotulo('Cuello')}${sg('cd', '¿Le duele el cuello?', [['no', 'No'], ['si', 'Sí']], ev.cuello.dolor)}${sg('cr', 'Movimiento del cuello', [['normal', 'Normal'], ['alterado', 'Alterado']], ev.cuello.rom)}`;
  }
  function pDecC(ev, sc) {
    const rj = hayRoja(sc);
    return `${rotulo('Decisión')}
      <div class="cm-nota sc-aviso">${e(T.avisoDia)} ${e(T.avisoTiempo)}</div>
      ${rj ? '<div class="cm-urg" role="alert"><b>Derivación urgente a servicio de urgencia</b><span>Hay banderas rojas marcadas.</span></div>' : ''}
      <label class="check sc-chk"><input type="checkbox" data-sc-ret${sc.retirado ? ' checked' : ''}><span><b>Retirar del partido</b></span></label>
      <p class="suave sc-ay">Con sospecha de conmoción el jugador no vuelve a jugar ese día.</p>
      <label class="campo"><span>Derivación</span><select data-sc-der>${K.opts(C.DERIVA, sc.deriva)}</select></label>
      <p class="suave sc-ay">Al terminar queda anotada la hora. El resto (síntomas, cognitivo y equilibrio) se hace después, en camarín.</p>`;
  }

  /* --- Momento 2 · en camarín (y partes que reutiliza el seguimiento) --- */
  function pAnt(ev) {
    const a = ev.ant, A = T.antecedentes;
    return `${rotulo('Antecedentes (opcional)')}<p class="suave sc-ay">Rápido y todo opcional. Si no lo sabes, deja en blanco y sigue.</p>
      <div class="sc-preg"><span>Conmociones anteriores</span>${seg('apr', A.previas, a.previas)}</div>
      <label class="campo ${a.previas && a.previas !== '0' ? '' : 'oculto'}" data-sc-ult-caja><span>Fecha aproximada de la última</span><input type="text" data-sc-ult maxlength="40" value="${e(a.ultima)}" placeholder="Ej. marzo 2025" autocomplete="off"></label>
      ${A.preguntas.map(([k, t]) => `<div class="sc-preg"><span>${e(t)}</span>${seg('a_' + k, sn2, a[k])}</div>`).join('')}
      <label class="campo"><span>Medicación que usa</span><input type="text" data-sc-med maxlength="120" value="${e(a.medic)}" placeholder="Opcional" autocomplete="off"></label>`;
  }
  function pSint(ev, ctx) {
    const pr = ctx && ctx.previo;
    return `${rotulo('Síntomas')}
      ${ev.momento === 'seguimiento' ? `<label class="campo"><span>Fecha del seguimiento</span><input type="date" data-sc-fecha value="${e(ev.fecha)}"></label>` : ''}
      <p class="suave sc-ay">Pregúntale cómo se siente ahora. 0 = nada, 6 = lo más intenso.${pr ? ` Abajo ves lo que respondió el ${e(fc(pr.fecha))}.` : ''}</p>
      ${pr ? `<button type="button" class="btn sec sc-b" data-sc-copiar>Copiar respuestas del ${e(fc(pr.fecha))} y ajustar</button>` : ''}
      <div class="sc-sticky" data-sc-sticky>Síntomas: ${val('sint')} de 22 · Severidad: ${val('sev')} de 132</div>
      ${SINTOMAS.map((t, i) => `<div class="sc-preg sc-sint"><span>${i + 1}. ${e(t)}${pr ? ` <small class="sc-prev">antes: ${pr.sint[i]}</small>` : ''}</span>${seg('s' + i, [0, 1, 2, 3, 4, 5, 6].map((n) => [n, String(n)]), ev.sint[i])}</div>`).join('')}
      <div class="sc-preg"><span>¿Los síntomas empeoran con el esfuerzo físico?</span>${seg('ef', sn2, ev.esfFis)}</div>
      <div class="sc-preg"><span>¿Empeoran con el esfuerzo mental?</span>${seg('em', sn2, ev.esfMen)}</div>
      <label class="campo"><span>¿Qué porcentaje se siente normal? (0 a 100)</span><input type="number" inputmode="numeric" min="0" max="100" step="1" data-sc-pct value="${e(ev.pct)}" placeholder="Ej. 80"></label>`;
  }
  const horaFin = (ms) => hora(ms);
  function pCogCuerpo(ev) {
    const L = LISTAS[ev.lista], D = DIGITOS[ev.lista];
    const intento = (n) => `<div class="sc-card"><div class="sc-fila"><b>Intento ${n + 1}</b><span class="sc-tot">${val('mem' + n)} de 10</span></div><div class="sc-pal">${L.map((w, i) => `<label class="check sc-chk sc-w"><input type="checkbox" data-sc-mem="${n}.${i}"${ev.mem[n][i] ? ' checked' : ''}><span>${e(w)}</span></label>`).join('')}</div>${n === 2 ? `<button type="button" class="btn sec sc-b" data-sc-memfin>${ev.tMem ? '✓ Memoria inmediata terminada' : 'Terminé la memoria inmediata'}</button><p class="suave sc-ay" data-sc-memfin-t>${ev.tMem ? 'Terminada a las ' + e(horaFin(ev.tMem)) + '. La memoria diferida se toma pasados 5 minutos.' : 'Al tocarlo empiezan a contar los 5 minutos para la memoria diferida.'}</p>` : ''}</div>`;
    return `${rotulo('Orientación')}<p class="suave sc-ay">Marca las que respondió bien. <span class="sc-tot">Puntaje: ${val('ori')} de 5</span></p>
      <div class="sc-chks">${ORIENT.map((q, i) => chk('data-sc-ori', i, q, ev.ori[i])).join('')}</div>
      ${rotulo('Memoria inmediata')}<p class="suave sc-ay">Lee en voz alta las 10 palabras, una por segundo. El jugador las repite en cualquier orden. Repítelo 3 veces con la misma lista y marca las que recordó. <span class="sc-tot">Total: ${val('mem')} de 30</span></p>
      <div class="sc-preg"><span>Lista de palabras</span>${seg('lista', [['A', 'Lista A'], ['B', 'Lista B'], ['C', 'Lista C']], ev.lista)}</div>
      <div class="sc-leer"><b>Lee estas palabras:</b> ${L.map(e).join(' · ')}</div>
      ${[0, 1, 2].map(intento).join('')}
      ${rotulo('Concentración')}<p class="suave sc-ay">Dígitos al revés: lee la serie (un dígito por segundo) y el jugador la repite de atrás hacia adelante. <span class="sc-tot">Puntaje: ${val('conc')} de 5</span></p>
      ${D.map((s, i) => `<div class="sc-preg"><span>Serie de ${s.length} dígitos: <b class="sc-ser">${s.join(' · ')}</b> <small>(correcto: ${s.slice().reverse().join(' · ')})</small></span>${seg('dg' + i, [['ok', 'Acierta'], ['no', 'Falla']], ev.dig[i])}</div>`).join('')}
      <div class="sc-preg"><span>Meses del año al revés, desde diciembre <small>(${e(MESES_REVES)})</small></span>${seg('meses', [['ok', 'Acierta'], ['no', 'Falla']], ev.meses)}</div>`;
  }
  function pEqCuerpo(ev) {
    const sg = (n, t, ops, s) => `<div class="sc-preg"><span>${t}</span>${seg(n, ops, s)}</div>`;
    return `${rotulo('Equilibrio (mBESS)')}<p class="suave sc-ay">Cada postura dura 30 segundos con los ojos cerrados. Cuenta los errores (máximo 10 por postura). <span class="sc-tot">Total: ${val('eq')} de 30</span></p>
      <label class="check sc-chk"><input type="checkbox" data-sc-aviso${K.ui.scatAviso === false ? '' : ' checked'}><span>Avisar con vibración y sonido al terminar los 30 s</span></label>
      ${sg('sup', 'Superficie', [['firme', 'Firme'], ['cesped', 'Césped']], ev.superficie)}${sg('cal', 'Calzado', [['con', 'Con calzado'], ['sin', 'Sin calzado']], ev.calzado)}
      ${BESS.map(([t, ay], i) => `<div class="sc-card"><div class="sc-fila"><b>${i + 1}. ${e(t)}</b></div><p class="suave sc-ay">${e(ay)}</p>
        <button type="button" class="btn sc-b sc-timer" data-sc-timer="${i}"><span data-sc-tl="${i}">Iniciar ${SEG_MBESS} s</span></button>
        <div class="sc-err"><span>Errores</span><button type="button" class="sc-mm" data-sc-err="${i}:-1" aria-label="Un error menos">−</button><b data-sc-ev="${i}">${ev.bess[i] === '' ? 0 : ev.bess[i]}</b><button type="button" class="sc-mm" data-sc-err="${i}:1" aria-label="Un error más">+</button></div></div>`).join('')}`;
  }
  function pExaCam(ev) {
    const sg = (n, t, ops, s) => `<div class="sc-preg"><span>${t}</span>${seg(n, ops, s)}</div>`;
    return `${rotulo('Cuello')}
      ${sg('cr', 'Rango de movimiento del cuello', [['normal', 'Normal'], ['alterado', 'Alterado']], ev.cuello.rom)}
      ${sg('cd', 'Dolor a la palpación del cuello', [['no', 'Sin dolor'], ['si', 'Con dolor']], ev.cuello.dolor)}
      ${sg('ce', 'Fuerza y sensibilidad de brazos y piernas', [['normal', 'Normal'], ['alterado', 'Alterado']], ev.cuello.extr)}
      ${rotulo('Coordinación')}${sg('cdn', 'Dedo–nariz', [['normal', 'Normal'], ['alterada', 'Alterada']], ev.coordDN)}${pEqCuerpo(ev)}`;
  }
  function pDif(ev) {
    const L = LISTAS[ev.lista];
    return `${rotulo('Memoria diferida')}
      <div class="sc-espera" data-sc-espera role="status"></div>
      <p class="suave sc-ay">Va al final, al menos 5 minutos después de la memoria inmediata. Pídele que diga todas las palabras que recuerde de la lista y marca las que dijo. <span class="sc-tot">Puntaje: ${val('dif')} de 10</span></p>
      <div class="sc-leer"><b>Lista usada (${e(ev.lista)}):</b> ${L.map(e).join(' · ')}</div>
      <div class="sc-card"><div class="sc-pal">${L.map((w, i) => `<label class="check sc-chk sc-w"><input type="checkbox" data-sc-dif="${i}"${ev.dif[i] ? ' checked' : ''}><span>${e(w)}</span></label>`).join('')}</div></div>`;
  }
  function pDecCam(ev, sc) {
    return `${rotulo('Decisión')}
      ${hayRoja(sc) ? '<div class="cm-urg" role="alert"><b>Derivación urgente a servicio de urgencia</b><span>Hay banderas rojas marcadas.</span></div>' : ''}
      <label class="check sc-chk"><input type="checkbox" data-sc-ret${sc.retirado ? ' checked' : ''}><span><b>Retirado del partido</b></span></label>
      <div class="sc-preg"><span>¿Se hizo el reemplazo?</span>${seg('rem', [['no', 'No'], ['si', 'Sí']], sc.reemplazo ? 'si' : 'no')}</div>
      <label class="campo"><span>Derivación</span><select data-sc-der>${K.opts(C.DERIVA, sc.deriva)}</select></label>
      <label class="campo"><span>Inicio del plan de retorno gradual (fecha, opcional)</span><input type="date" data-sc-rtp value="${e(sc.rtpInicio)}"></label>
      <label class="campo"><span>Notas (opcional)</span><textarea data-sc-notas rows="3" maxlength="2000">${e(sc.notas)}</textarea></label>
      <div class="cm-nota sc-aviso">${e(T.avisoDia)}</div>`;
  }

  /* --- Momento 3 · seguimiento --- */
  function pOpc(ev) {
    const h = ev.hechos;
    return `${rotulo('Opcionales')}<p class="suave sc-ay">Si hoy también tomaste el cribado cognitivo o el equilibrio, márcalo y anota. Si no, sigue.</p>
      <details class="mas-clin sc-opt"${h.cog ? ' open' : ''}><summary><span>Cognitivo (opcional)</span></summary><div class="mas-cuerpo">
        <label class="check sc-chk"><input type="checkbox" data-sc-opt="cog"${h.cog ? ' checked' : ''}><span>Lo hice hoy</span></label>${pCogCuerpo(ev)}</div></details>
      <details class="mas-clin sc-opt"${h.exa ? ' open' : ''}><summary><span>Equilibrio (opcional)</span></summary><div class="mas-cuerpo">
        <label class="check sc-chk"><input type="checkbox" data-sc-opt="exa"${h.exa ? ' checked' : ''}><span>Lo hice hoy</span></label>${pEqCuerpo(ev)}</div></details>`;
  }

  /* --- Resumen de una evaluación (pantalla “Ver” y último paso) --- */
  const NOHECHO = '<span class="sc-nh">no realizado</span>';
  const sn = (x) => (x === 'si' ? 'Sí' : x === 'no' ? 'No' : '—');
  const nor = (x, a) => (x === a ? 'Normal' : x ? 'Alterado' : '—');
  function resultadoEval(ev, sc) {
    const p = puntajes(ev), t = tiene(ev), fila = (a, v) => `<tr><th>${a}</th><td>${v}</td></tr>`;
    const cab = `${fila('Momento', e(MOM(ev.momento).t))}${fila('Fecha y hora', e(cuando(ev) || '—'))}`;
    if (ev.momento === 'cancha') {
      const ban = C.nombres(C.BANDERAS, sc.banderas), sig = C.nombres(C.SIGNOS, sc.signos);
      return `<table class="sc-res"><tbody>${cab}
        ${fila('Banderas rojas', ban.length ? `<b class="cm-rj">${e(ban.join(', '))}</b>` : t.a ? 'Ninguna' : NOHECHO)}${fila('Signos que viste', sig.length ? e(sig.join(', ')) : t.a ? 'Ninguno' : NOHECHO)}
        ${fila('Preguntas de memoria', t.mad ? `${p.mad} de 5` : NOHECHO)}${fila('Glasgow', p.gcs != null ? `${p.gcs} de 15` : NOHECHO)}
        ${fila('Cuello', ev.cuello.dolor || ev.cuello.rom ? `dolor: ${sn(ev.cuello.dolor).toLowerCase()} · movimiento ${nor(ev.cuello.rom, 'normal').toLowerCase()}` : NOHECHO)}
        ${fila('Decisión', `${sc.retirado ? 'Retirado del partido' : 'No se retiró'} · derivación: ${e((C.DERIVA.find((d) => d[0] === sc.deriva) || [0, ''])[1].toLowerCase())}`)}</tbody></table>`;
    }
    const ant = ev.ant && t.ant ? [ev.ant.previas ? `conmociones previas: ${ev.ant.previas === '0' ? 'ninguna' : ev.ant.previas === '3' ? '3 o más' : ev.ant.previas}${ev.ant.ultima ? ' (última: ' + ev.ant.ultima + ')' : ''}` : '', ...T.antecedentes.preguntas.filter(([k]) => ev.ant[k]).map(([k, n]) => `${n.toLowerCase()}: ${sn(ev.ant[k]).toLowerCase()}`), ev.ant.medic ? 'medicación: ' + ev.ant.medic : ''].filter(Boolean).join(' · ') : '';
    return `<table class="sc-res"><tbody>${cab}
      ${ev.momento === 'camarin' ? fila('Antecedentes', ant ? e(ant) : NOHECHO) : ''}
      ${fila('Síntomas', t.sint ? `${p.sint} de 22 · severidad ${p.sev} de 132` : NOHECHO)}
      ${t.sint ? fila('Empeoran con esfuerzo', `físico: ${sn(ev.esfFis)} · mental: ${sn(ev.esfMen)} · se siente normal: ${ev.pct === '' ? '—' : ev.pct + ' %'}`) : ''}
      ${fila('Orientación', t.ori ? `${p.ori} de 5` : NOHECHO)}${fila('Memoria inmediata', t.mem ? `${p.mem} de 30 (${p.memInt.join(' + ')}) · lista ${e(ev.lista)}` : NOHECHO)}
      ${fila('Concentración', t.conc ? `${p.conc} de 5` : NOHECHO)}
      ${ev.momento === 'camarin' ? fila('Cuello', t.cuello ? `rango ${nor(ev.cuello.rom, 'normal').toLowerCase()} · dolor ${ev.cuello.dolor === 'si' ? 'sí' : ev.cuello.dolor === 'no' ? 'no' : '—'} · brazos y piernas ${nor(ev.cuello.extr, 'normal').toLowerCase()}` : NOHECHO) + fila('Coordinación', ev.coordDN ? nor(ev.coordDN, 'normal') : NOHECHO) : ''}
      ${fila('Equilibrio (mBESS)', t.eq ? `${p.eq} errores de 30 (${ev.bess.map((x) => (x === '' ? 0 : x)).join(' + ')})${ev.superficie ? ' · ' + (ev.superficie === 'firme' ? 'superficie firme' : 'césped') : ''}${ev.calzado ? ' · ' + (ev.calzado === 'con' ? 'con calzado' : 'sin calzado') : ''}` : NOHECHO)}
      ${ev.momento === 'camarin' ? fila('Memoria diferida', t.dif ? `${p.dif} de 10` : NOHECHO) : ''}</tbody></table>`;
  }

  /* --- Pantalla de entrada: tres tarjetas --- */
  function tarjeta(m, sc, caso) {
    const L = delMom(sc, m.k), fin = L.filter((x) => x.estado === 'final'), bor = L.filter((x) => x.estado !== 'final').pop(), ult = fin[fin.length - 1];
    let chip, cls;
    if (!L.length) { chip = 'Pendiente'; cls = 'pen'; }
    else if (!fin.length) { chip = 'Borrador'; cls = 'bor'; }
    else if (m.k === 'seguimiento') { chip = fin.length === 1 ? `Hecho el ${fc(ult.fecha)}` : `${fin.length} evaluaciones`; cls = 'ok'; }
    else { chip = ult.hora ? `Hecha a las ${ult.hora}` : `Hecha el ${fc(ult.fecha)}`; cls = 'ok'; }
    let resumenTxt = ult ? resumenEvalTxt(ult) : '', extra = '';
    if (m.k === 'camarin' && !fin.length) {
      const c1 = delMom(sc, 'cancha').filter((x) => x.estado === 'final').pop();
      if (c1 && c1.hora) { const d = new Date(`${c1.fecha || K.hoy()}T${c1.hora}:00`); d.setMinutes(d.getMinutes() + 10); extra = `<p class="suave sc-ay">Conviene hacerla desde las ${hora(d.getTime())} (10 min después de la cancha).</p>`; }
      else extra = '<p class="suave sc-ay">Conviene hacerla al menos 10 min después de la evaluación en cancha.</p>';
    }
    if (m.k === 'seguimiento' && fin.length > 1) { const s = serie(sc); const u = s[s.length - 1]; if (u && u.tend.sev) resumenTxt += ` · ${u.tend.sev[0]} ${u.tend.sev[1]} (severidad)`; }
    const lista = m.k === 'seguimiento' && fin.length ? `<div class="sc-fechas">${fin.map((x) => `<button type="button" class="th-chip" data-sc-ver="${e(x.id)}">${e(fc(x.fecha))}</button>`).join('')}</div>` : '';
    const btnIni = bor ? 'Continuar' : fin.length ? (m.k === 'seguimiento' ? 'Nuevo seguimiento' : 'Repetir') : 'Iniciar';
    return `<section class="sc-mom ${cls}" data-sc-mom="${m.k}"><div class="sc-mom-t"><i class="sc-mom-n">${m.n}</i><div><b>${m.n} · ${e(m.t)} · ${e(m.dur)}</b><span>${e(m.cuando)}</span></div><em class="sc-chip ${cls}" data-sc-est>${e(chip)}</em></div>
      ${resumenTxt ? `<p class="sc-mom-r">${e(resumenTxt)}</p>` : ''}${extra}${lista}
      <div class="sc-mom-b"><button type="button" class="btn sc-go2" data-sc-ini="${m.k}">${btnIni}</button>${ult && m.k !== 'seguimiento' ? `<button type="button" class="btn sec" data-sc-ver="${e(ult.id)}">Ver</button>` : ''}${ult && m.k === 'seguimiento' ? `<button type="button" class="btn sec" data-sc-ver="${e(ult.id)}">Ver evolución</button>` : ''}</div></section>`;
  }
  function vistaEntrada(sc, caso) {
    const rt = caso ? C.rtpHechas(caso) : 0;
    return `${hayRoja(sc) ? '<div class="cm-urg" role="alert"><b>Derivación urgente a servicio de urgencia</b><span>Hay banderas rojas marcadas en este caso.</span></div>' : ''}
      <p class="suave sc-ay sc-intro">Se hace en tres momentos. Puedes hacer solo el 1 ahora y los demás después: la app guarda cada parte.</p>
      ${MOMS.map((m) => tarjeta(m, sc, caso)).join('')}
      ${caso ? `<section class="sc-mom sc-rt"><div class="sc-mom-t"><div><b>Retorno gradual</b><span>${rt} de ${C.ETAPAS.length} etapas cumplidas</span></div></div>
        <div class="sc-mom-b"><button type="button" class="btn sec" data-sc-rtp-abrir>Abrir retorno gradual</button></div>
        <label class="check sc-chk"><input type="checkbox" data-sc-alta${ISO(caso.conmocionAlta) ? ' checked' : ''}><span>Alta de conmoción${ISO(caso.conmocionAlta) ? ' (' + e(fc(caso.conmocionAlta)) + ')' : ''}: ya no avisar “SCAT5 pendiente”</span></label></section>` : ''}
      <div class="sc-extra"><button type="button" class="btn sec" data-sc-pdf>${K.uiIco('pdf', 18)} Ficha SCAT5 (PDF)</button>${enlaceOficialHTML('')}</div>
      <div class="cm-nota sc-aviso" data-sc-aviso-res>${e(AVISO_RESULTADO)}</div>
      <p class="suave sc-ay">${e(AVISO_HERRAMIENTA)}</p>`;
  }
  function vistaAyuda() {
    const A = T.ayuda;
    return `<h3 class="sc-h">${e(A.titulo)}</h3><p class="sc-ay">${e(A.intro)}</p>
      ${A.momentos.map(([t, tx]) => `<section class="sc-mom"><div class="sc-mom-t"><div><b>${e(t)}</b></div></div><p class="sc-mom-r">${e(tx)}</p></section>`).join('')}
      <div class="cm-nota sc-aviso"><b>Ten presente</b><ul class="sc-ul">${A.avisos.map((x) => `<li>${e(x)}</li>`).join('')}</ul></div>
      <p class="suave sc-ay">${e(AVISO_EDAD)}</p><p class="suave sc-ay"><b>${e(AVISO_HERRAMIENTA)}</b></p>
      <div class="sc-extra">${enlaceOficialHTML('')}</div>${hayOficial() ? `<p class="suave sc-ay">${e(LEY_OFICIAL)}</p>` : ''}`;
  }

  function beep() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = new AC(), o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.value = 0.15; o.start(); o.stop(c.currentTime + 0.25);
      setTimeout(() => { try { c.close(); } catch (x) { /* nada */ } }, 500);
    } catch (x) { /* sin sonido */ }
  }
  function avisarFin() {
    if (K.ui.scatAviso === false) return;
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (x) { /* nada */ }
    beep();
  }

  // Abre el asistente para una incidencia con scat5. o: { volver: true } reabre el formulario al salir.
  function abrir(p, inc, o) {
    o = o || {};
    if (!K.puedeEditar() || !p || !inc || !plano(inc.scat5)) return null;
    const g = K.jugadorGlobal(inc.jugadorId); if (!g) { K.aviso('No se encontró al jugador', true); return null; }
    inc.scat5 = C.limpiar(inc.scat5) || inc.scat5;
    let evs = limpiarEvals(inc.scat5.evals);
    let vista = { t: 'entrada' };
    let timer = null, relojDif = null;
    const nombre = g.j.nombre;
    const caso = () => (inc.casoAutoId ? K.buscarCaso(inc.casoAutoId) : null);
    const cur = () => evs.find((x) => x.id === vista.id) || null;
    const clave = (ev) => MOM(ev.momento).pasos[ev.paso][0];

    const persistir = (sinc) => {
      const base = Object.assign({}, inc.scat5);
      base.banderas = Object.assign({}, inc.scat5.banderas); base.signos = Object.assign({}, inc.scat5.signos);
      base.evals = evs;
      aplicar(base);
      inc.scat5 = C.limpiar(base);
      if (sinc) { inc.retiro = K.part.jugando(inc.momento) && inc.scat5.retirado; K.part.sincronizar(p, inc); }
      K.guardar();
    };
    const vivo = (raiz) => {
      const ev = vista.t === 'mom' ? cur() : null;
      if (ev) {
        const p0 = puntajes(ev), pon = (k, v) => raiz.querySelectorAll(`[data-sc-v="${k}"]`).forEach((n) => { n.textContent = v; });
        if (ev.momento === 'cancha') { pon('mad', p0.mad); pon('gcs', p0.gcs != null ? p0.gcs : '—'); } else {
          pon('sint', p0.sint); pon('sev', p0.sev); pon('ori', p0.ori); pon('mem', p0.mem); pon('conc', p0.conc); pon('eq', p0.eq); pon('dif', p0.dif);
          p0.memInt.forEach((v, i) => pon('mem' + i, v));
        }
      }
      const u = raiz.querySelector('[data-sc-urg]'); if (u) u.classList.toggle('oculto', !hayRoja(inc.scat5));
    };
    const parar = () => { if (timer) { clearInterval(timer.id); timer = null; } if (relojDif) { clearInterval(relojDif); relojDif = null; } };

    const api = K.modal({
      titulo: 'Evaluación SCAT5 · ' + nombre,
      cuerpo: '<div data-sc-cuerpo></div>',
      botones: [],
      alCerrar: parar,
      alMontar: (m, hoja) => {
        hoja.classList.add('hoja-scat');
        const cuerpoEl = hoja.querySelector('.cuerpo'), raiz = hoja.querySelector('[data-sc-cuerpo]');
        const prog = document.createElement('div'); prog.className = 'sc-prog'; prog.setAttribute('data-sc-prog', '');
        hoja.insertBefore(prog, cuerpoEl);
        const pie = document.createElement('footer'); pie.className = 'sc-pie'; hoja.appendChild(pie);

        const previoDe = (ev) => { const o2 = ordenadas(evs).filter((x) => x.momento !== 'cancha' && x !== ev && tiene(x).sint && ((x.fecha || '') + (x.hora || '')) <= ((ev.fecha || '') + (ev.hora || ''))); return o2[o2.length - 1] || null; };
        const progHTML = () => {
          if (vista.t === 'mom') {
            const ev = cur(), M = MOM(ev.momento), n = M.pasos.length;
            return `<div class="sc-prog-t"><b data-sc-ptxt>${e(M.t)} · Paso ${ev.paso + 1} de ${n} · ${e(M.pasos[ev.paso][1])}</b>
              <span><button type="button" class="btn ghost chico" data-sc-ayuda-ir>Ayuda</button><button type="button" class="btn ghost chico" data-sc-salir>Guardar y salir</button></span></div>
              <div class="sc-pasos" style="grid-template-columns:repeat(${n},1fr)" role="tablist" aria-label="Pasos de la evaluación">${M.pasos.map(([k, t], i) => `<button type="button" class="sc-pt${i === ev.paso ? ' act' : ''}${ev.hechos[k] ? ' ok' : ''}" data-sc-ir="${i}" aria-label="Paso ${i + 1}: ${e(t)}" aria-current="${i === ev.paso ? 'step' : 'false'}"><i>${ev.hechos[k] ? '✓' : i + 1}</i></button>`).join('')}</div>`;
          }
          if (vista.t === 'ayuda') return '<div class="sc-prog-t"><b data-sc-ptxt>Ayuda</b></div>';
          if (vista.t === 'ver') return '<div class="sc-prog-t"><b data-sc-ptxt>Resultado</b></div>';
          return `<div class="sc-prog-t"><b data-sc-ptxt>Los tres momentos</b><span><button type="button" class="btn ghost chico" data-sc-ayuda-ir>¿Cómo uso el SCAT5?</button></span></div>`;
        };
        const pieHTML = () => {
          if (vista.t === 'mom') {
            const ev = cur(), M = MOM(ev.momento), ult = ev.paso === M.pasos.length - 1;
            return `<button type="button" class="btn sec sc-nav" data-sc-atras>${ev.paso === 0 ? 'Salir' : 'Atrás'}</button>
              <button type="button" class="btn sc-nav" data-sc-sig>${ult ? (ev.momento === 'cancha' ? 'Terminar en cancha' : ev.momento === 'camarin' ? 'Terminar evaluación' : 'Terminar seguimiento') : 'Siguiente'}</button>`;
          }
          if (vista.t === 'entrada') return '<button type="button" class="btn sc-nav" data-sc-cerrar>Cerrar</button>';
          return '<button type="button" class="btn sc-nav" data-sc-volver>Volver</button>';
        };
        const cuerpoHTML = () => {
          const sc = inc.scat5;
          if (vista.t === 'entrada') return vistaEntrada(sc, caso());
          if (vista.t === 'ayuda') return vistaAyuda();
          if (vista.t === 'ver') {
            const ev = evs.find((x) => x.id === vista.id); if (!ev) { vista = { t: 'entrada' }; return vistaEntrada(sc, caso()); }
            return `${vista.recien ? `<div class="sc-estado"><span class="chip g-leve">Evaluación guardada</span><span class="suave">${e(MOM(ev.momento).t)}${ev.hora ? ' a las ' + e(ev.hora) : ''}</span></div>` : ''}
              ${hayRoja(sc) ? '<div class="cm-urg" role="alert"><b>Derivación urgente a servicio de urgencia</b><span>Hay banderas rojas marcadas en este caso.</span></div>' : ''}
              ${resultadoEval(ev, sc)}${ev.momento === 'seguimiento' ? compHTML(sc, { min: 1 }) : ''}
              <div class="cm-nota sc-aviso" data-sc-aviso-res>${e(AVISO_RESULTADO)}</div>
              <p class="suave sc-ay">${e(AVISO_HERRAMIENTA)}</p>
              <div class="sc-extra"><button type="button" class="btn sec" data-sc-pdf>${K.uiIco('pdf', 18)} Ficha SCAT5 (PDF)</button><button type="button" class="btn sec" data-sc-edit="${e(ev.id)}">Corregir esta evaluación</button><button type="button" class="btn sec peligro" data-sc-del="${e(ev.id)}">Eliminar</button></div>`;
          }
          const ev = cur(), k = clave(ev), previo = ev.momento === 'seguimiento' ? previoDe(ev) : null;
          if (ev.momento === 'cancha') return { ban: pBan, sig: pSig, mad: pMad, exa: pExaC, dec: pDecC }[k](ev, sc);
          if (k === 'ant') return pAnt(ev, sc);
          if (k === 'sint') return pSint(ev, { previo });
          if (k === 'cog') return pCogCuerpo(ev);
          if (k === 'exa') return pExaCam(ev);
          if (k === 'dif') return pDif(ev);
          if (k === 'opc') return pOpc(ev);
          if (k === 'res') return `${rotulo('Resultado del seguimiento')}${resultadoEval(ev, sc)}${compHTML(sc, { min: 1 })}${caso() ? `<p class="suave sc-ay">Retorno gradual: ${C.rtpHechas(caso())} de ${C.ETAPAS.length} etapas.</p>` : ''}`;
          return pDecCam(ev, sc);
        };
        const pintar = (tope) => {
          parar();
          raiz.innerHTML = cuerpoHTML(); prog.innerHTML = progHTML(); pie.innerHTML = pieHTML();
          vivo(raiz);
          const ev = vista.t === 'mom' ? cur() : null;
          if (ev && ev.momento === 'camarin' && clave(ev) === 'dif') montarEspera(ev);
          if (tope !== false) cuerpoEl.scrollTop = 0;
        };
        const montarEspera = (ev) => {
          const caja = raiz.querySelector('[data-sc-espera]'); if (!caja) return;
          const act = () => {
            if (!ev.tMem) { caja.innerHTML = '<b>Aún no marcaste el fin de la memoria inmediata.</b> <button type="button" class="btn sec chico" data-sc-contar>Contar 5 minutos desde ahora</button>'; caja.className = 'sc-espera'; return; }
            const falta = ev.tMem + ESPERA_DIF - Date.now();
            if (falta > 0) { caja.className = 'sc-espera espera'; caja.innerHTML = `Disponible en <b data-sc-falta>${mmss(falta)}</b> (5 minutos desde la memoria inmediata). Puedes esperar o tomarla igual.`; }
            else { caja.className = 'sc-espera lista'; caja.innerHTML = '<b>Disponible ahora.</b> Ya pasaron los 5 minutos: puedes tomar la memoria diferida.'; }
          };
          act(); relojDif = setInterval(act, 1000);
        };
        const ir = (n, tope) => { const ev = cur(), M = MOM(ev.momento); ev.paso = Math.max(0, Math.min(M.pasos.length - 1, n)); persistir(); pintar(tope !== false); };
        const entrada = () => { parar(); persistir(); vista = { t: 'entrada' }; pintar(); };
        const terminar = (ev) => {
          ev.estado = 'final'; ev.paso = MOM(ev.momento).pasos.length - 1;
          if (ev.momento === 'cancha') { ev.fecha = K.hoy(); ev.hora = hora(Date.now()); ev.hechos.dec = true; }
          persistir(true);
          K.aviso(ev.momento === 'cancha' ? `Evaluación en cancha guardada · ${ev.hora}` : ev.momento === 'camarin' ? 'Evaluación en camarín guardada' : 'Seguimiento guardado');
          vista = { t: 'ver', id: ev.id, recien: true }; pintar();
        };
        const siguiente = () => {
          const ev = cur(), M = MOM(ev.momento), k = M.pasos[ev.paso][0], ult = ev.paso === M.pasos.length - 1;
          ev.hechos[k] = true;
          if (k === 'cog' && ev.momento === 'camarin' && !ev.tMem) ev.tMem = Date.now();
          if (k === 'exa' && ev.momento === 'camarin') ev.bess = ev.bess.map((x) => (x === '' ? 0 : x));
          if (k === 'opc') { if (ev.hechos.exa) ev.bess = ev.bess.map((x) => (x === '' ? 0 : x)); if (ev.hechos.cog && !ev.tMem) ev.tMem = Date.now(); }
          if (!ult) { ir(ev.paso + 1); return; }
          terminar(ev);
        };
        // Evaluación nueva (o la que quedó en borrador)
        const iniciar = (k) => {
          let ev = ordenadas(evs).filter((x) => x.momento === k && x.estado !== 'final').pop();
          if (!ev) {
            const listaSig = ['A', 'B', 'C'][ordenadas(evs).filter((x) => x.momento !== 'cancha' && tiene(x).mem && x.estado === 'final').length % 3];
            ev = evalVacia(k, k === 'seguimiento' ? { lista: listaSig } : null);
            evs.push(ev); persistir(k === 'cancha');
          }
          vista = { t: 'mom', id: ev.id }; pintar();
        };
        const salir = () => {
          persistir(); parar(); m.cerrar();
          if (o.volver) setTimeout(() => C.form(p, inc), 230);
          K.render();
        };

        hoja.addEventListener('click', (ev0) => {
          const t = ev0.target;
          let b;
          if (t.closest('[data-sc-oficial]')) return;
          if ((b = t.closest('[data-sc-ini]'))) { iniciar(b.dataset.scIni); return; }
          if ((b = t.closest('[data-sc-ver]'))) { vista = { t: 'ver', id: b.dataset.scVer }; pintar(); return; }
          if ((b = t.closest('[data-sc-edit]'))) { const x = evs.find((y) => y.id === b.dataset.scEdit); if (x) { x.estado = 'borrador'; x.paso = 0; vista = { t: 'mom', id: x.id }; persistir(); pintar(); } return; }
          if ((b = t.closest('[data-sc-del]'))) {
            const id = b.dataset.scDel;
            K.confirmar('¿Eliminar esta evaluación? No se puede deshacer.', 'Eliminar', () => { evs = evs.filter((x) => x.id !== id); persistir(true); vista = { t: 'entrada' }; pintar(); K.aviso('Evaluación eliminada'); });
            return;
          }
          if (t.closest('[data-sc-volver]')) { vista = vista.volverA || { t: 'entrada' }; pintar(); return; }
          if (t.closest('[data-sc-cerrar]')) { salir(); return; }
          if (t.closest('[data-sc-ayuda-ir]')) { vista = Object.assign({ t: 'ayuda' }, { volverA: vista.t === 'mom' ? Object.assign({}, vista) : { t: 'entrada' } }); pintar(); return; }
          if ((b = t.closest('[data-sc-ir]'))) { ir(Number(b.dataset.scIr)); return; }
          if (t.closest('[data-sc-sig]')) { siguiente(); return; }
          if (t.closest('[data-sc-atras]')) { const ev = cur(); if (ev.paso === 0) entrada(); else ir(ev.paso - 1); return; }
          if (t.closest('[data-sc-salir]')) { entrada(); return; }
          if (t.closest('[data-sc-pdf]')) { persistir(); pdf(p, inc); return; }
          if (t.closest('[data-sc-rtp-abrir]')) { const c = caso(); if (c) { persistir(); parar(); m.cerrar(); setTimeout(() => K.formCaso({ rec: c }), 230); } return; }
          if ((b = t.closest('[data-sc-rapido]'))) {
            const ev = cur(), k = b.dataset.scRapido;
            if (k === 'mad') { ev.mad = ['ok', 'ok', 'ok', 'ok', 'ok']; ev.hechos.mad = true; }
            else if (k === 'exa') { ev.gcs = { o: 4, v: 5, m: 6 }; ev.cuello.dolor = 'no'; ev.cuello.rom = 'normal'; ev.hechos.exa = true; }
            ir(ev.paso + 1); return;
          }
          if (t.closest('[data-sc-fin-ya]')) { const ev = cur(); ev.hechos.ban = true; terminar(ev); return; }
          if (t.closest('[data-sc-copiar]')) {
            const ev = cur(), pr = previoDe(ev); if (!pr) return;
            const antes = ev.sint.slice(); ev.sint = pr.sint.slice(); persistir(); pintar(false);
            K.avisoAccion(`Copiadas las respuestas del ${fc(pr.fecha)}`, 'Deshacer', () => { ev.sint = antes; persistir(); pintar(false); });
            return;
          }
          if (t.closest('[data-sc-memfin]')) { const ev = cur(); ev.tMem = Date.now(); persistir(); const bt = raiz.querySelector('[data-sc-memfin]'), tx = raiz.querySelector('[data-sc-memfin-t]'); bt.textContent = '✓ Memoria inmediata terminada'; tx.textContent = `Terminada a las ${hora(ev.tMem)}. La memoria diferida se toma pasados 5 minutos.`; return; }
          if (t.closest('[data-sc-contar]')) { const ev = cur(); ev.tMem = Date.now(); persistir(); montarEspera(ev); return; }
          if ((b = t.closest('[data-sc-err]'))) {
            const ev = cur(), [i, d] = b.dataset.scErr.split(':').map(Number);
            ev.bess[i] = Math.max(0, Math.min(10, (ev.bess[i] === '' ? 0 : ev.bess[i]) + d));
            raiz.querySelector(`[data-sc-ev="${i}"]`).textContent = ev.bess[i]; persistir(); vivo(raiz); return;
          }
          if ((b = t.closest('[data-sc-timer]'))) { cronometro(Number(b.dataset.scTimer)); return; }
        });
        hoja.addEventListener('change', (ev0) => {
          const t = ev0.target; if (!t.matches || !t.matches('input, select')) return;
          const d = t.dataset, ev = vista.t === 'mom' ? cur() : null;
          if (d.scAlta !== undefined) { const c = caso(); if (c) { if (t.checked) c.conmocionAlta = K.hoy(); else delete c.conmocionAlta; persistir(); pintar(false); K.aviso(t.checked ? 'Alta de conmoción registrada' : 'Alta de conmoción quitada'); } return; }
          if (d.scBan !== undefined) {
            const s = inc.scat5;
            if (t.checked) s.banderas[d.scBan] = true; else delete s.banderas[d.scBan];
            if (hayRoja(s) && s.deriva === 'ninguna') s.deriva = 'urgencia';
          } else if (d.scSg !== undefined) { if (t.checked) inc.scat5.signos[d.scSg] = true; else delete inc.scat5.signos[d.scSg]; }
          else if (d.scRet !== undefined) { inc.scat5.retirado = t.checked; persistir(true); return; }
          else if (d.scDer !== undefined) { inc.scat5.deriva = t.value; }
          else if (d.scRtp !== undefined) { inc.scat5.rtpInicio = ISO(t.value) ? t.value : ''; persistir(true); return; }
          else if (d.scFecha !== undefined) { if (ev && ISO(t.value)) ev.fecha = t.value; }
          else if (d.scOpt !== undefined) { if (ev) { if (t.checked) ev.hechos[d.scOpt] = true; else delete ev.hechos[d.scOpt]; } }
          else if (d.scAviso !== undefined) { K.ui.scatAviso = t.checked; return; }
          else if (!ev) return;
          else if (d.scOri !== undefined) ev.ori[Number(d.scOri)] = t.checked ? 1 : 0;
          else if (d.scMem !== undefined) { const [n, i] = d.scMem.split('.').map(Number); ev.mem[n][i] = t.checked ? 1 : 0; }
          else if (d.scDif !== undefined) ev.dif[Number(d.scDif)] = t.checked ? 1 : 0;
          else return;
          persistir(); vivo(raiz);
        });
        hoja.addEventListener('input', (ev0) => {
          const t = ev0.target; if (!t.matches) return;
          const ev = vista.t === 'mom' ? cur() : null; if (!ev) return;
          if (t.matches('[data-sc-pct]')) { const n = Number(t.value); ev.pct = t.value === '' || !Number.isFinite(n) ? '' : Math.max(0, Math.min(100, Math.round(n))); persistir(); }
          else if (t.matches('[data-sc-ult]')) { ev.ant.ultima = t.value.slice(0, 40); persistir(); }
          else if (t.matches('[data-sc-med]')) { ev.ant.medic = t.value.slice(0, 120); persistir(); }
          else if (t.matches('[data-sc-notas]')) { inc.scat5.notas = t.value.slice(0, 2000); persistir(); }
        });
        hoja.addEventListener('seg', (ev0) => {
          const n = ev0.target.dataset.seg, v = ev0.detail; if (!n) return;
          const ev = cur(); if (!ev) return;
          let m1;
          if ((m1 = /^m(\d)$/.exec(n))) ev.mad[Number(m1[1])] = v;
          else if ((m1 = /^g([ovm])$/.exec(n))) ev.gcs[m1[1]] = Number(v);
          else if ((m1 = /^s(\d+)$/.exec(n))) ev.sint[Number(m1[1])] = Number(v);
          else if (n === 'ef') ev.esfFis = v; else if (n === 'em') ev.esfMen = v;
          else if (n === 'rem') { inc.scat5.reemplazo = v === 'si'; persistir(true); return; }
          else if (n === 'apr') { ev.ant.previas = v; const cj = raiz.querySelector('[data-sc-ult-caja]'); if (cj) cj.classList.toggle('oculto', !v || v === '0'); }
          else if ((m1 = /^a_(\w+)$/.exec(n))) ev.ant[m1[1]] = v;
          else if (n === 'lista') {
            if (ev.mem.some((a) => a.some(Boolean)) || (ev.dif && ev.dif.some(Boolean))) { K.aviso('Ya marcaste palabras: no se puede cambiar la lista', true); ev0.target.querySelectorAll('button').forEach((x) => x.classList.toggle('act', x.dataset.v === ev.lista)); return; }
            ev.lista = v; persistir(); pintar(false); return;
          } else if ((m1 = /^dg(\d)$/.exec(n))) ev.dig[Number(m1[1])] = v;
          else if (n === 'meses') ev.meses = v;
          else if (n === 'cr') ev.cuello.rom = v;
          else if (n === 'cd') { ev.cuello.dolor = v; if (v === 'si' && ev.momento === 'cancha') { const s = inc.scat5; s.banderas.cuello = true; if (s.deriva === 'ninguna') s.deriva = 'urgencia'; } }
          else if (n === 'ce') ev.cuello.extr = v;
          else if (n === 'cdn') ev.coordDN = v; else if (n === 'sup') ev.superficie = v; else if (n === 'cal') ev.calzado = v;
          else return;
          persistir(); vivo(raiz);
        });
        // cronómetro de 30 s del mBESS
        const cronometro = (i) => {
          const etiqueta = (n) => raiz.querySelector(`[data-sc-tl="${n}"]`), btn = (n) => raiz.querySelector(`[data-sc-timer="${n}"]`);
          if (timer) { const ant = timer.i; clearInterval(timer.id); timer = null; const l = etiqueta(ant); if (l) l.textContent = `Iniciar ${SEG_MBESS} s`; const bb = btn(ant); if (bb) bb.classList.remove('corriendo'); if (ant === i) return; }
          const t0 = Date.now();
          const act = () => {
            const rest = Math.ceil((t0 + SEG_MBESS * 1000 - Date.now()) / 1000), l = etiqueta(i); if (!l) { parar(); return; }
            if (rest > 0) { l.textContent = String(rest); return; }
            clearInterval(timer.id); timer = null; l.textContent = '¡Tiempo! Cuenta los errores'; const bb = btn(i); if (bb) { bb.classList.remove('corriendo'); bb.classList.add('fin'); }
            avisarFin();
          };
          btn(i).classList.remove('fin'); btn(i).classList.add('corriendo');
          timer = { i, id: setInterval(act, 250) };
          act();
        };
        if (o.momento && MOM(o.momento)) iniciar(o.momento); else pintar(false);
      }
    });
    return api;
  }
  // Abre el asistente desde un caso de conmoción (Hoy, ficha, Kine)
  function abrirCaso(casoId) {
    const c = K.buscarCaso(casoId), x = c && deCaso(c); if (!x) return null;
    return abrir(x.p, x.inc);
  }

  /* ---------- Ficha SCAT5 (PDF, Carta con escudo: 2 páginas + seguimiento) ---------- */
  const ESC = '<img class="sw-vs" src="img/escudo-sw-vs.png" alt="" width="35" height="56">';
  const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const FILAS_SEG = 22;
  function paginas(p, inc) {
    const g = K.jugadorGlobal(inc.jugadorId); if (!g || !plano(inc.scat5)) return [];
    const sc = C.limpiar(inc.scat5);
    const L = (k) => delMom(sc, k), ultimo = (k) => { const l = L(k).filter((x) => x.estado === 'final'); return l[l.length - 1] || L(k).pop() || null; };
    const evC = ultimo('cancha') || evalVacia('cancha', { fecha: '', hora: '' }), evK = ultimo('camarin') || evalVacia('camarin', { fecha: '', hora: '' });
    const segs = L('seguimiento');
    const pc = puntajes(evC), pk = puntajes(evK), tc = tiene(evC), tk = tiene(evK);
    const full = g.j.nombre;
    const campo = (l, v, c) => (v === '' || v == null ? '' : `<div${c ? ` class="${c}"` : ''}><dt>${e(l)}</dt><dd>${v}</dd></div>`);
    const mom = (K.part && K.part.MOMENTOS.find((x) => x[0] === inc.momento)) || [0, ''];
    const ban = C.nombres(C.BANDERAS, sc.banderas), sig = C.nombres(C.SIGNOS, sc.signos);
    const rot = (lista, v) => (lista.find((x) => x[0] === v) || [0, ''])[1];
    const partido = p ? `vs ${e(p.rival || '—')}${p.cat ? ' · Sub ' + e(p.cat) : ''}${p.fecha ? ' · ' + e(K.fechaCorta(p.fecha)) : ''}` : '';
    const ser = serie(sc), filasSeg = ser.length ? ser : [];
    const trozos = []; for (let i = 0; i < filasSeg.length; i += FILAS_SEG) trozos.push(filasSeg.slice(i, i + FILAS_SEG));
    const hayPag3 = segs.length > 0 || ser.length > 2;
    const total = 2 + (hayPag3 ? Math.max(1, trozos.length) : 0);
    const pie = (n) => K.rep.PIE(`${full} · Ficha SCAT5 · ${n} / ${total}`);
    const OKX = (b) => (b ? '<span class="sc5-ok">✓</span>' : '<span class="sc5-no">·</span>');
    const cab = `<div class="fj-cab">${ESC}<div class="fj-cab-t"><h1>Ficha SCAT5</h1><p>${e(full)} · Santiago Wanderers · Kinesiología Fútbol Joven</p><p>Emitida el ${e(K.fechaCorta(K.hoy()))} · ${e(estadoTxt(sc))}</p></div></div>`;
    const sintFila = (i) => `<tr><td>${i + 1}. ${e(SINTOMAS[i])}</td><td class="n">${tk.sint ? evK.sint[i] : '—'}</td></tr>`;
    const mitad = (a, b) => `<table class="kn-t sc5-s"><thead><tr><th>Síntoma</th><th class="n">0–6</th></tr></thead><tbody>${Array.from({ length: b - a }, (_, k) => sintFila(a + k)).join('')}</tbody></table>`;
    const LP = LISTAS[evK.lista];
    const pal = (n) => `<tr><td>Intento ${n + 1}</td><td>${LP.map((w, i) => `<span class="sc5-w${evK.mem[n][i] ? ' on' : ''}">${e(w)}</span>`).join(' ')}</td><td class="n">${tk.mem ? pk.memInt[n] + ' / 10' : '—'}</td></tr>`;
    // tabla de evaluaciones registradas (cancha y camarín una fila cada una; los seguimientos, resumidos)
    const filasEv = ordenadas(sc.evals).filter((x) => x.momento !== 'seguimiento').map((x) => `<tr><td>${e(MOM(x.momento).t)}</td><td>${e(fc(x.fecha) || '—')}</td><td>${e(x.hora || '—')}</td><td>${x.estado === 'final' ? 'Terminada' : 'Borrador'}</td></tr>`).join('')
      + (segs.length ? `<tr><td>Seguimiento</td><td>${e(fc(segs[0].fecha) || '—')}${segs.length > 1 ? ' a ' + e(fc(segs[segs.length - 1].fecha)) : ''}</td><td>—</td><td>${segs.length} ${segs.length === 1 ? 'evaluación' : 'evaluaciones'}</td></tr>` : '');
    const a = evK.ant, antTxt = tk.ant ? [a.previas ? `conmociones previas: ${a.previas === '0' ? 'ninguna' : a.previas === '3' ? '3 o más' : a.previas}${a.ultima ? ' (última: ' + a.ultima + ')' : ''}` : '', ...T.antecedentes.preguntas.filter(([k]) => a[k]).map(([k, n]) => `${n.toLowerCase()}: ${sn(a[k]).toLowerCase()}`), a.medic ? 'medicación: ' + a.medic : ''].filter(Boolean).join(' · ') : '';
    const p1 = K.rep.pagina('p-resumen p-equipo fj sc5', `<h2>Ficha SCAT5 <small>(1 de ${total})</small></h2><div class="fj-cuerpo">${cab}
      <div class="fj-card"><h3>Datos de la evaluación</h3><dl class="fj-dl">
        ${campo('Jugador', e(full))}${campo('Categoría', e(g.j.categoria || ''))}${campo('Partido', partido)}${campo('Fecha del partido', p && p.fecha ? e(K.fechaCorta(p.fecha)) : '')}
        ${campo('Momento', e(mom[1] + (sc.minuto !== '' ? ` · min ${sc.minuto}'` : '')))}${campo('Mecanismo', e(rot(C.MEC, sc.mec)))}
        ${campo('Signos observados', e(sig.join(', ')), 'x')}${campo('Evaluación realizada', e(rot(C.EVALS, sc.eval)))}${campo('Retirado del partido', sc.retirado ? 'Sí' : 'No')}${campo('Derivación', e(rot(C.DERIVA, sc.deriva)))}</dl>
        ${filasEv ? `<table class="kn-t sc5-m sc5-evs"><thead><tr><th>Evaluación</th><th>Fecha</th><th>Hora</th><th>Estado</th></tr></thead><tbody>${filasEv}</tbody></table>` : ''}</div>
      <div class="fj-card sc5-rojo"><h3>1 · En cancha ${evC.fecha ? `<small>${e(cuando(evC))}</small>` : ''}</h3>${ban.length ? `<p class="fj-alerta">Banderas rojas: <b>${e(ban.join(', '))}</b>. Derivación urgente.</p>` : '<p class="fj-nota" style="margin:0 0 6px">Sin banderas rojas.</p>'}
        <dl class="fj-dl"><div><dt>Preguntas de memoria</dt><dd>${tc.mad ? pc.mad + ' de 5' : '—'}</dd></div><div><dt>Glasgow</dt><dd>${pc.gcs != null ? pc.gcs + ' de 15' + ` (ojos ${evC.gcs.o}, verbal ${evC.gcs.v}, motor ${evC.gcs.m})` : '—'}</dd></div>
          <div><dt>Cuello</dt><dd>${evC.cuello.dolor || evC.cuello.rom ? `dolor: ${sn(evC.cuello.dolor).toLowerCase()} · movimiento ${nor(evC.cuello.rom, 'normal').toLowerCase()}` : '—'}</dd></div></dl>
        <p class="fj-nota">${MADDOCKS.map((q, i) => `${OKX(evC.mad[i] === 'ok')} ${e(q.replace(/^¿/, '').replace(/\?$/, ''))}`).join(' · ')}</p></div>
      <div class="fj-card"><h3>2 · En camarín · síntomas <small>${tk.sint ? `${pk.sint} de 22 · severidad ${pk.sev} de 132` : 'sin datos'}${evK.fecha ? ' · ' + e(cuando(evK)) : ''}</small></h3>
        <div class="sc5-2c">${mitad(0, 11)}${mitad(11, 22)}</div>
        <p class="fj-nota">Empeoran con esfuerzo físico: ${sn(evK.esfFis)} · con esfuerzo mental: ${sn(evK.esfMen)} · se siente normal: ${evK.pct === '' ? '—' : evK.pct + ' %'}${antTxt ? ' · Antecedentes: ' + e(antTxt) : ''}</p></div></div>`).replace('<!--PIE-->', pie(1));
    const p2 = K.rep.pagina('p-resumen p-equipo fj sc5', `<h2>Ficha SCAT5 <small>(2 de ${total})</small></h2><div class="fj-cuerpo">
      <div class="fj-card"><h3>2 · En camarín · cognitivo <small>${e(full)}</small></h3>
        <dl class="fj-dl"><div><dt>Orientación</dt><dd>${tk.ori ? pk.ori + ' de 5' : '—'}</dd></div><div><dt>Concentración</dt><dd>${tk.conc ? pk.conc + ' de 5' : '—'}</dd></div></dl>
        <table class="kn-t sc5-m"><thead><tr><th>Memoria inmediata (lista ${e(evK.lista)})</th><th>Palabras (marcadas las recordadas)</th><th class="n">Recordó</th></tr></thead><tbody>${[0, 1, 2].map(pal).join('')}
          <tr><td><b>Total</b></td><td></td><td class="n"><b>${tk.mem ? pk.mem + ' / 30' : '—'}</b></td></tr></tbody></table>
        <p class="fj-nota">Orientación: ${ORIENT.map((q, i) => `${OKX(evK.ori[i])} ${e(q.replace(/^¿/, '').replace(/\?.*$/, ''))}`).join(' · ')}</p>
        <p class="fj-nota">Dígitos al revés: ${DIGITOS[evK.lista].map((s, i) => `${s.length} dígitos: ${evK.dig[i] === 'ok' ? 'acierta' : evK.dig[i] === 'no' ? 'falla' : '—'}`).join(' · ')} · Meses al revés: ${evK.meses === 'ok' ? 'acierta' : evK.meses === 'no' ? 'falla' : '—'}</p></div>
      <div class="fj-card"><h3>Examen</h3><dl class="fj-dl">
        ${campo('Cuello · rango de movimiento', evK.cuello.rom ? nor(evK.cuello.rom, 'normal') : '—')}${campo('Cuello · dolor a la palpación', evK.cuello.dolor ? (evK.cuello.dolor === 'si' ? 'Con dolor' : 'Sin dolor') : '—')}
        ${campo('Fuerza y sensibilidad de brazos y piernas', evK.cuello.extr ? nor(evK.cuello.extr, 'normal') : '—')}${campo('Coordinación dedo–nariz', evK.coordDN ? nor(evK.coordDN, 'normal') : '—')}
        ${campo('Superficie', evK.superficie ? (evK.superficie === 'firme' ? 'Firme' : 'Césped') : '—')}${campo('Calzado', evK.calzado ? (evK.calzado === 'con' ? 'Con calzado' : 'Sin calzado') : '—')}</dl>
        <table class="kn-t sc5-m"><thead><tr><th>Equilibrio mBESS (30 s, ojos cerrados)</th><th class="n">Errores (máx. 10)</th></tr></thead><tbody>${BESS.map(([tt], i) => `<tr><td>${i + 1}. ${e(tt)}</td><td class="n">${tk.eq ? (evK.bess[i] === '' ? 0 : evK.bess[i]) : '—'}</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="n"><b>${tk.eq ? pk.eq + ' / 30' : '—'}</b></td></tr></tbody></table></div>
      <div class="fj-card"><h3>Memoria diferida</h3><p class="fj-nota" style="margin:0 0 4px">Se toma al menos 5 minutos después de la memoria inmediata${evK.tMem ? ` (memoria inmediata terminada a las ${e(hora(evK.tMem))})` : ''}.</p>
        <p style="margin:0 0 4px">${LP.map((w, i) => `<span class="sc5-w${evK.dif[i] ? ' on' : ''}">${e(w)}</span>`).join(' ')}</p><dl class="fj-dl"><div><dt>Recordó</dt><dd>${tk.dif ? pk.dif + ' de 10' : '—'}</dd></div></dl></div>
      <div class="fj-card"><h3>Resumen de puntajes <small>(la evaluación más reciente de cada tipo)</small></h3><table class="kn-t sc5-m"><tbody>
        <tr><td>Síntomas / severidad</td><td class="n">${sc.sintomas !== '' ? sc.sintomas + ' / 22 · ' + sc.severidad + ' / 132' : '—'}</td><td>Orientación</td><td class="n">${sc.sacOri !== '' ? sc.sacOri + ' / 5' : '—'}</td></tr>
        <tr><td>Memoria inmediata</td><td class="n">${sc.sacMem !== '' ? sc.sacMem + ' / 30' : '—'}</td><td>Concentración</td><td class="n">${sc.sacConc !== undefined && sc.sacConc !== '' ? sc.sacConc + ' / 5' : '—'}</td></tr>
        <tr><td>Equilibrio (errores)</td><td class="n">${sc.equilibrio !== '' ? sc.equilibrio + ' / 30' : '—'}</td><td>Memoria diferida</td><td class="n">${sc.sacDif !== undefined && sc.sacDif !== '' ? sc.sacDif + ' / 10' : '—'}</td></tr></tbody></table></div>
      ${sc.notas ? `<div class="fj-card"><h3>Notas</h3><p style="margin:0;white-space:pre-line">${e(sc.notas)}</p></div>` : ''}
      <p class="fj-aviso"><b>${e(AVISO_RESULTADO)}</b></p>
      <p class="fj-nota">${e(AVISO_HERRAMIENTA)}</p></div>`).replace('<!--PIE-->', pie(2));
    const out = [p1, p2];
    if (hayPag3) {
      const rt = (() => { const c = inc.casoAutoId ? K.buscarCaso(inc.casoAutoId) : null; return c ? C.rtpHechas(c) : 0; })();
      (trozos.length ? trozos : [[]]).forEach((tr, i) => {
        out.push(K.rep.pagina('p-resumen p-equipo fj sc5', `<h2>Ficha SCAT5 <small>(${3 + i} de ${total})</small></h2><div class="fj-cuerpo">
          <div class="fj-card"><h3>3 · Seguimiento y evolución${i ? ' <small>(cont.)</small>' : ''}</h3>
            ${tr.length ? `<table class="kn-t sc-comp-t"><thead><tr>${CAB_SERIE}</tr></thead><tbody>${tr.map(filaSerie).join('')}</tbody></table>` : '<p class="fj-nota">Aún no hay mediciones para comparar.</p>'}
            <p class="fj-nota">Las flechas muestran hacia dónde cambió el número; la palabra dice si es mejor o peor. SAC cognitivo = orientación + memoria inmediata + concentración.</p>
            ${i === 0 ? `<p class="fj-nota">Retorno gradual: ${rt} de ${C.ETAPAS.length} etapas cumplidas.</p>` : ''}</div>
          ${i === 0 ? `<p class="fj-aviso"><b>${e(AVISO_RESULTADO)}</b></p><p class="fj-nota">${e(AVISO_HERRAMIENTA)}</p>` : ''}</div>`).replace('<!--PIE-->', pie(3 + i)));
      });
    }
    return out;
  }
  async function pdf(p, inc) {
    const g = K.jugadorGlobal(inc.jugadorId); if (!g) return;
    try { await document.fonts.ready; } catch (x) { /* sigue */ }
    return K.pdf.paginas(paginas(p, inc), `Ficha SCAT5 - ${sinTildes(K.nombreCorto ? K.nombreCorto(g.j) : g.j.nombre)} - ${(p && p.fecha) || K.hoy()}`);
  }
  // Informe solo de SCAT5: las fichas completas de varias conmociones (p. ej. todas las de un partido) en un solo PDF
  async function pdfVarias(rs, nombre) {
    const lista = (rs || []).filter((r) => r && r.inc && K.jugadorGlobal(r.inc.jugadorId)); if (!lista.length) return;
    try { await document.fonts.ready; } catch (x) { /* sigue */ }
    const htmls = []; lista.forEach((r) => paginas(r.p, r.inc).forEach((h) => htmls.push(h)));
    return K.pdf.paginas(htmls, nombre || 'Informe SCAT5');
  }
  function buscarInc(pid, iid) {
    for (const inf of K.state.informes) { const p = (inf.partidos || []).find((x) => x.id === pid), inc = p && (p.incidencias || []).find((x) => x.id === iid); if (inc) return { p, inc }; }
    return null;
  }
  function botonPdfHTML(c) {
    if (!c || c.conmocion !== true || !deCaso(c)) return '';
    return `<button type="button" class="btn sec chico sc-pdf-btn" data-scat-pdf="${e(c.id)}">${K.uiIco('pdf', 16)} Ficha SCAT5 (PDF)</button>`;
  }
  function montarCaso(hoja, c) {
    hoja.querySelectorAll('[data-scat-pdf]').forEach((b) => b.addEventListener('click', () => { const x = deCaso(c); if (x) pdf(x.p, x.inc); }));
    hoja.querySelectorAll('[data-scat-abrir]').forEach((b) => b.addEventListener('click', () => { const x = deCaso(c); if (x) { K.cerrarModales(); setTimeout(() => abrir(x.p, x.inc), 230); } }));
  }
  const botonAbrirHTML = (c) => (K.puedeEditar() && c && c.conmocion === true && deCaso(c) ? `<button type="button" class="btn sec chico sc-pdf-btn" data-scat-abrir="${e(c.id)}">Continuar evaluación SCAT5</button>` : '');

  K.scat5 = {
    MOMENTOS: MOMS, MADDOCKS, GCS, SINTOMAS, ORIENT, LISTAS, DIGITOS, BESS, AVISO_RESULTADO, AVISO_HERRAMIENTA, AVISO_EDAD, LEY_OFICIAL,
    evalVacia, limpiarEval, limpiarEvals, evalsDe, ordenadas, puntajes, tiene, resumen, aplicar, evalDe, completa, estadoTxt, resumenEvalTxt, lineasEvals, serie, compHTML, pendiente,
    enlaceOficialHTML, tarjetaDocumentos, hayOficial,
    abrir, abrirCaso, paginas, pdf, pdfVarias, deCaso, botonPdfHTML, botonAbrirHTML, montarCaso
  };
  // Botones de las tablas SCAT5 de los partidos: ficha completa de una conmoción, o informe SCAT5 de todas las de la tabla
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-scat-ficha]'); if (b) { const x = buscarInc(b.dataset.scatFicha, b.dataset.scatInc); if (x) pdf(x.p, x.inc); return; }
    const t = ev.target.closest && ev.target.closest('[data-scat-todas]'); if (!t) return;
    const rs = String(t.dataset.scatTodas).split(',').map((s) => s.split(':')).map(([pid, iid]) => buscarInc(pid, iid)).filter(Boolean).map((x) => ({ p: x.p, inc: x.inc }));
    pdfVarias(rs, t.dataset.scatNombre || 'Informe SCAT5');
  });
  // Un clic en la línea de tiempo de la ficha del jugador
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-scat-pdf-tl]'); if (!b) return;
    const c = K.state.informes.map((i) => (i.casos || []).find((x) => x.id === b.dataset.scatPdfTl)).find(Boolean), x = c && deCaso(c);
    if (x) pdf(x.p, x.inc);
  });
})();

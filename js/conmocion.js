/* Conmoción cerebral (SCAT5), v1.6 fase 4.
   Es un REGISTRO de lo que hizo el kinesiólogo en el partido (no un diagnóstico ni el formulario oficial SCAT5).
   Datos: incidencia.scat5 (dentro del partido; scat5.evals = evaluaciones en cancha / camarín / seguimiento hechas en la app, ver scat5.js), caso.conmocion (true), caso.conmocionAlta (fecha, opcional) y caso.rtpConmocion (6 etapas del retorno gradual).
   Todo es opcional: un respaldo anterior sin estos campos se ve igual que antes. */
(function () {
  const K = window.K;
  const e = K.esc;
  const fc = (iso) => K.fechaCorta(iso);
  const ISO = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 1900;
  const plano = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

  const MEC = [['codo', 'Golpe con codo u hombro'], ['cabezas', 'Choque de cabezas'], ['balon', 'Golpe de balón'], ['suelo', 'Caída o golpe contra el suelo'], ['otro', 'Otro']];
  const SIGNOS = [['perdidaConciencia', 'Pérdida de conciencia'], ['amnesia', 'Amnesia'], ['desorientacion', 'Desorientación o confusión'], ['miradaVacia', 'Mirada vacía'], ['perdidaEquilibrio', 'Pérdida del equilibrio'], ['convulsion', 'Convulsión'], ['lentoLevantarse', 'Lento en levantarse']];
  const BANDERAS = [['cuello', 'Dolor de cuello'], ['visionDoble', 'Visión doble'], ['debilidad', 'Debilidad u hormigueo en brazos o piernas'], ['cefalea', 'Dolor de cabeza intenso o creciente'], ['convulsion', 'Convulsión'], ['vomitos', 'Vómitos repetidos'], ['agitacion', 'Agitación o combatividad'], ['somnolencia', 'Somnolencia creciente'], ['perdidaConciencia', 'Pérdida de conciencia']];
  const EVALS = [['no', 'No realizada'], ['cancha', 'En cancha'], ['camarin', 'En camarín'], ['completo', 'SCAT5 completo']];
  const DERIVA = [['ninguna', 'Ninguna'], ['club', 'Médico del club'], ['urgencia', 'Servicio de urgencia']];
  const COORD = [['', '—'], ['normal', 'Normal'], ['alterada', 'Alterada']];
  const ETAPAS = ['Reposo relativo', 'Actividad aeróbica ligera', 'Ejercicio específico del fútbol, sin contacto', 'Entrenamiento sin contacto con progresión', 'Entrenamiento con contacto completo (tras el alta médica)', 'Vuelta al juego'];
  const TITULO = 'Conmoción cerebral (sospecha)';
  const rot = (lista, v) => (lista.find((x) => x[0] === v) || [0, ''])[1];

  /* ---------- Datos ---------- */
  const vacio = () => ({ minuto: '', mec: '', signos: {}, banderas: {}, eval: 'no', sintomas: '', severidad: '', sacOri: '', sacMem: '', equilibrio: '', coord: '', retirado: true, reemplazo: false, deriva: 'ninguna', rtpInicio: '', informoOrg: false, informeReemplazo: '', notas: '' });
  // Deja el registro válido: enums, números dentro de su rango, fechas ISO y textos. Es idempotente (limpiar(limpiar(x)) = limpiar(x)).
  function limpiar(v) {
    if (!plano(v)) return null;
    const num = (x, a, b) => (x === '' || x == null || typeof x === 'boolean' || typeof x === 'object' ? '' : Number.isFinite(Number(x)) && Number(x) >= a && Number(x) <= b ? Math.round(Number(x)) : '');
    const en = (x, lista, def) => (lista.some((l) => l[0] === x) ? x : def);
    const marc = (o, lista) => { const r = {}; if (plano(o)) lista.forEach(([k]) => { if (o[k] === true) r[k] = true; }); return r; };
    const str = (x, n) => (typeof x === 'string' ? x : x == null || typeof x === 'object' ? '' : String(x)).slice(0, n);
    const r = {
      minuto: num(v.minuto, 0, 200), mec: en(v.mec, MEC, ''), signos: marc(v.signos, SIGNOS), banderas: marc(v.banderas, BANDERAS), eval: en(v.eval, EVALS, 'no'),
      sintomas: num(v.sintomas, 0, 22), severidad: num(v.severidad, 0, 132), sacOri: num(v.sacOri, 0, 5), sacMem: num(v.sacMem, 0, 30), equilibrio: num(v.equilibrio, 0, 30), coord: en(v.coord, COORD, ''),
      retirado: v.retirado !== false, reemplazo: v.reemplazo === true, deriva: en(v.deriva, DERIVA, 'ninguna'), rtpInicio: ISO(v.rtpInicio) ? v.rtpInicio : '', informoOrg: v.informoOrg === true,
      informeReemplazo: str(v.informeReemplazo, 3000), notas: str(v.notas, 2000)
    };
    // v1.6.1: concentración (0–5) y memoria diferida (0–10); v1.6.2: evaluaciones (cancha, camarín, seguimiento). Solo existen si alguien las llenó.
    const c5 = num(v.sacConc, 0, 5), d10 = num(v.sacDif, 0, 10);
    if (c5 !== '') r.sacConc = c5;
    if (d10 !== '') r.sacDif = d10;
    const evs = K.scat5 ? K.scat5.evalsDe(v) : [];   // también migra el detalle de la v1.6.1 (scat5.det)
    if (evs.length) r.evals = evs;
    return r;
  }
  // Retorno gradual: siempre 6 etapas { fecha, hecho }
  const rtpNorm = (v) => { const a = Array.isArray(v) ? v : []; return ETAPAS.map((_, i) => { const x = plano(a[i]) ? a[i] : {}; return { fecha: ISO(x.fecha) ? x.fecha : '', hecho: x.hecho === true }; }); };
  const rtpVacio = (a) => a.every((x) => !x.fecha && !x.hecho);
  const rtpHechas = (c) => rtpNorm(c && c.rtpConmocion).filter((x) => x.hecho).length;
  const hayBandera = (sc) => !!sc && Object.keys(sc.banderas || {}).length > 0;
  const nombres = (lista, obj) => lista.filter(([k]) => (obj || {})[k]).map((x) => x[1]);

  // Arregla (en el estado, sin tocar lo válido) lo que venga mal en incidencias y casos de un informe.
  function normalizarInforme(inf) {
    (inf.partidos || []).forEach((p) => (Array.isArray(p.incidencias) ? p.incidencias : []).forEach((i) => {
      if (!i || typeof i !== 'object' || i.scat5 === undefined) return;
      const l = limpiar(i.scat5);
      if (l && l.evals) l.evals.forEach((x) => { if (!x.fecha && ISO(p.fecha)) x.fecha = p.fecha; }); // evaluaciones migradas: toman la fecha del partido
      if (l) { if (JSON.stringify(l) !== JSON.stringify(i.scat5)) i.scat5 = l; } else delete i.scat5;
    }));
    (inf.casos || []).forEach((c) => {
      if (c.conmocion !== undefined && c.conmocion !== true) delete c.conmocion;
      if (c.conmocionAlta !== undefined && (c.conmocion !== true || !ISO(c.conmocionAlta))) delete c.conmocionAlta;
      if (c.rtpConmocion !== undefined) { const a = rtpNorm(c.rtpConmocion); if (!c.conmocion || rtpVacio(a)) delete c.rtpConmocion; else if (JSON.stringify(a) !== JSON.stringify(c.rtpConmocion)) c.rtpConmocion = a; }
    });
    return inf;
  }

  /* ---------- Textos ---------- */
  const okv = (x) => x !== undefined && x !== '';
  const puntajes = (sc) => {
    const ec = K.scat5 && sc.evals ? K.scat5.ordenadas(sc.evals).filter((x) => x.momento === 'cancha').pop() : null;
    const pt = ec ? K.scat5.puntajes(ec) : null, t = ec ? K.scat5.tiene(ec) : {};
    return [t.mad && pt ? `Maddocks ${pt.mad}/5` : '', pt && pt.gcs != null ? `Glasgow ${pt.gcs}/15` : '',
      sc.sintomas !== '' ? `síntomas ${sc.sintomas}/22` : '', sc.severidad !== '' ? `severidad ${sc.severidad}/132` : '', sc.sacOri !== '' ? `orientación ${sc.sacOri}/5` : '', sc.sacMem !== '' ? `memoria inmediata ${sc.sacMem}/30` : '',
      okv(sc.sacConc) ? `concentración ${sc.sacConc}/5` : '', okv(sc.sacDif) ? `memoria diferida ${sc.sacDif}/10` : '',
      sc.equilibrio !== '' ? `equilibrio ${sc.equilibrio} ${sc.equilibrio === 1 ? 'error' : 'errores'} de 30` : '', sc.coord ? `coordinación ${rot(COORD, sc.coord).toLowerCase()}` : ''].filter(Boolean);
  };
  const SI = (b) => (b ? 'Sí' : 'No');
  // Una línea con lo esencial (línea de tiempo de la ficha)
  function resumenTxt(v) {
    const sc = limpiar(v); if (!sc) return '';
    const ban = nombres(BANDERAS, sc.banderas);
    return [sc.minuto !== '' ? `min ${sc.minuto}'` : '', sc.mec ? rot(MEC, sc.mec).toLowerCase() : '', ban.length ? `banderas rojas: ${ban.length}` : 'sin banderas rojas', `evaluación: ${rot(EVALS, sc.eval).toLowerCase()}`,
      sc.retirado ? 'retirado del partido' : 'no se retiró', sc.deriva !== 'ninguna' ? `derivación: ${rot(DERIVA, sc.deriva).toLowerCase()}` : ''].filter(Boolean).join(' · ');
  }
  // Partido e incidencia que originaron un caso
  function incDeCaso(c) {
    if (!c || !c.partidoId || !c.incId) return null;
    for (const inf of K.state.informes) { const p = (inf.partidos || []).find((x) => x.id === c.partidoId); if (p) { const i = (p.incidencias || []).find((x) => x.id === c.incId); if (i && i.scat5) return { p, inc: i, sc: limpiar(i.scat5) }; } }
    return null;
  }
  // Filas [rótulo, valor] para el registro clínico de la lesión (bitácora, CSV, línea de tiempo, PDF)
  function detalleCaso(c) {
    const r = [['Conmoción cerebral', 'Sospecha registrada en un partido (SCAT5)']], x = incDeCaso(c);
    if (x && x.sc) {
      const sc = x.sc, ban = nombres(BANDERAS, sc.banderas), sig = nombres(SIGNOS, sc.signos), pt = puntajes(sc);
      if (sc.mec) r.push(['Conmoción · mecanismo', rot(MEC, sc.mec)]);
      if (sig.length) r.push(['Conmoción · signos observados', sig.join(', ')]);
      r.push(['Conmoción · banderas rojas', ban.length ? ban.join(', ') : 'Ninguna']);
      r.push(['Conmoción · evaluación', rot(EVALS, sc.eval) + (pt.length ? ' · ' + pt.join(' · ') : '')]);
      if (sc.evals && K.scat5) {
        r.push(['Conmoción · evaluación SCAT5 en la app', K.scat5.estadoTxt(sc)]);
        K.scat5.ordenadas(sc.evals).forEach((ev) => r.push([`Conmoción · SCAT5 ${K.scat5.MOMENTOS.find((m) => m.k === ev.momento).t.toLowerCase()}${ev.fecha ? ' · ' + fc(ev.fecha) : ''}${ev.hora ? ' ' + ev.hora : ''}`, K.scat5.resumenEvalTxt(ev) || 'sin datos']));
      }
      r.push(['Conmoción · resultado', `Retirado: ${SI(sc.retirado)} · Reemplazo: ${SI(sc.reemplazo)} · Derivación: ${rot(DERIVA, sc.deriva)}${sc.informoOrg ? ' · Se informó a la organización del torneo' : ''}`]);
      if (sc.informeReemplazo) r.push(['Conmoción · informe médico del reemplazo', sc.informeReemplazo]);
    }
    rtpNorm(c.rtpConmocion).forEach((s, i) => { if (s.fecha || s.hecho) r.push([`Retorno gradual · etapa ${i + 1}`, `${ETAPAS[i]}${s.fecha ? ' · ' + fc(s.fecha) : ''}${s.hecho ? ' · cumplida' : ''}`]); });
    return r;
  }
  // Una etapa pasa a “cumplida” solo con su casilla; la fecha de inicio del plan va en la etapa 1
  function rtpIniciar(c, fecha) { if (!ISO(fecha)) return; const a = rtpNorm(c.rtpConmocion); if (!a[0].fecha) a[0].fecha = fecha; c.rtpConmocion = a; }

  /* ---------- Informe: filas, tabla y sección ---------- */
  const ORD_MOM = { pre: 0, t1: 1, et: 2, t2: 3, post: 4 };
  function filas(ps) {
    const out = [];
    (ps || []).forEach((p) => (p.incidencias || []).forEach((i) => { if (i && plano(i.scat5) && K.jugadorGlobal(i.jugadorId)) out.push({ p, inc: i, sc: limpiar(i.scat5) }); }));
    return out.sort((a, b) => (a.p.fecha || '9999').localeCompare(b.p.fecha || '9999') || ((Number(b.p.cat) || 0) - (Number(a.p.cat) || 0)) || ((ORD_MOM[a.inc.momento] || 0) - (ORD_MOM[b.inc.momento] || 0)) || ((Number(a.inc.minuto) || 0) - (Number(b.inc.minuto) || 0)));
  }
  const momTxt = (m) => (K.MOMENTOS_PARTIDO.find((x) => x[0] === m) || [0, ''])[1];
  function rtpTxt(r) {
    const c = r.inc.casoAutoId ? K.buscarCaso(r.inc.casoAutoId) : null, a = c ? rtpNorm(c.rtpConmocion) : null;
    const ini = (a && a[0].fecha) || r.sc.rtpInicio, n = a ? a.filter((x) => x.hecho).length : 0;
    return { ini, n };
  }
  const filaTabla = (r, o) => {
    const sc = r.sc, evl = K.scat5 && sc.evals ? K.scat5.lineasEvals(sc) : [], g = K.jugadorGlobal(r.inc.jugadorId), ban = nombres(BANDERAS, sc.banderas), sig = nombres(SIGNOS, sc.signos), pt = puntajes(sc), rt = rtpTxt(r);
    const ctx = o && o.partido ? `<small>${e([r.p.cat ? 'Sub ' + r.p.cat : '', 'vs ' + (r.p.rival || '—'), r.p.fecha ? fc(r.p.fecha) : ''].filter(Boolean).join(' · '))}</small>` : '';
    return `<tr data-conmocion><td data-l="Jugador"><b>${e(g ? g.j.nombre : '—')}</b>${ctx}</td><td class="n" data-l="Minuto">${sc.minuto !== '' ? e(sc.minuto) + "'" : e(momTxt(r.inc.momento)) || '—'}</td>
      <td data-l="Mecanismo y signos">${e(rot(MEC, sc.mec)) || '—'}${sig.length ? `<small>Signos: ${e(sig.join(', '))}</small>` : ''}</td>
      <td data-l="Banderas rojas">${ban.length ? `<b class="cm-rj">${e(ban.join(', '))}</b>` : 'Ninguna'}</td>
      <td data-l="Evaluación realizada y puntajes">${e(rot(EVALS, sc.eval))}${pt.length ? `<small>${e(pt.join(' · '))}</small>` : ''}${evl.length ? `<small class="cm-evs">${evl.map(e).join('<br>')}</small>` : ''}</td>
      <td class="n" data-l="Retirado">${SI(sc.retirado)}</td><td class="n" data-l="Reemplazo">${SI(sc.reemplazo)}${sc.informeReemplazo ? '<small>con informe médico</small>' : ''}</td>
      <td data-l="Derivación">${e(rot(DERIVA, sc.deriva))}${sc.informoOrg ? '<small>Informado a la organización</small>' : ''}</td>
      <td data-l="Retorno gradual">${rt.ini ? 'Iniciado ' + e(fc(rt.ini)) : '—'}${rt.n ? `<small>${rt.n} de ${ETAPAS.length} etapas</small>` : ''}</td></tr>`;
  };
  const CAB = '<th>Jugador</th><th>Min</th><th>Mecanismo y signos</th><th>Banderas rojas</th><th>Evaluación realizada y puntajes</th><th>Retirado</th><th>Reemplazo</th><th>Derivación</th><th>Retorno gradual</th>';
  /* Versión breve (informes de partido): jugador, minuto, banderas rojas, qué evaluaciones se hicieron con sus puntajes, retiro y derivación.
     El detalle completo está en la Ficha SCAT5; en pantalla cada fila trae el botón para abrirla (o.botones). */
  const hechasTxt = (sc) => {
    const ev = sc.evals || [], n = (m) => ev.filter((x) => x.momento === m).length;
    if (!ev.length) return rot(EVALS, sc.eval);
    return [n('cancha') ? 'En cancha' : '', n('camarin') ? 'En camarín' : '', n('seguimiento') ? 'Seguimiento' + (n('seguimiento') > 1 ? ' ×' + n('seguimiento') : '') : ''].filter(Boolean).join(' · ') || rot(EVALS, sc.eval);
  };
  const filaBreve = (r, o) => {
    const sc = r.sc, g = K.jugadorGlobal(r.inc.jugadorId), ban = nombres(BANDERAS, sc.banderas), pt = puntajes(sc);
    const ctx = o && o.partido ? `<small>${e([r.p.cat ? 'Sub ' + r.p.cat : '', 'vs ' + (r.p.rival || '—'), r.p.fecha ? fc(r.p.fecha) : ''].filter(Boolean).join(' · '))}</small>` : '';
    return `<tr data-conmocion><td data-l="Jugador"><b>${e(g ? g.j.nombre : '—')}</b>${ctx}</td><td class="n" data-l="Minuto">${sc.minuto !== '' ? e(sc.minuto) + "'" : e(momTxt(r.inc.momento)) || '—'}</td>
      <td data-l="Banderas rojas">${ban.length ? `<b class="cm-rj">${e(ban.join(', '))}</b>` : 'Ninguna'}</td>
      <td data-l="Evaluación SCAT5">${e(hechasTxt(sc)) || '—'}${pt.length ? `<small>${e(pt.join(' · '))}</small>` : ''}</td>
      <td class="n" data-l="Retirado">${SI(sc.retirado)}</td><td data-l="Derivación">${e(rot(DERIVA, sc.deriva))}</td>${o && o.botones ? `<td class="cm-ficha-td"><button type="button" class="btn sec chico" data-scat-ficha="${e(r.p.id)}" data-scat-inc="${e(r.inc.id)}">Ver informe SCAT5 completo</button></td>` : ''}</tr>`;
  };
  const CAB_BREVE = '<th>Jugador</th><th>Min</th><th>Banderas rojas</th><th>Evaluación SCAT5</th><th>Retirado</th><th>Derivación</th>';
  const tablaHTML = (rs, o) => (o && o.breve
    ? `<table class="${(o && o.cls) || 'kt'} cm-t cm-t-breve"><thead><tr>${CAB_BREVE}${o.botones ? '<th></th>' : ''}</tr></thead><tbody>${rs.map((r) => filaBreve(r, o)).join('')}</tbody></table>`
    : `<table class="${(o && o.cls) || 'kt'} cm-t"><thead><tr>${CAB}${o && o.botones ? '<th></th>' : ''}</tr></thead><tbody>${rs.map((r) => filaTabla(r, o)).join('')}</tbody></table>`);
  const NOTA_BREVE = 'Resumen. El detalle completo (síntomas, cognitivo, equilibrio y seguimiento) está en la Ficha SCAT5 de cada jugador, disponible en la app.';
  const AVISO = 'Registro de lo realizado por el kinesiólogo en el partido. No es un diagnóstico ni reemplaza el formulario oficial SCAT5.';
  // Sección del informe de partido: vacía (cadena vacía) si no hay conmociones, para que el informe quede idéntico al de antes.
  // Evolución por fecha de cada conmoción con seguimiento (tabla comparativa); vacía si ninguna tiene al menos 2 mediciones
  const compSeccion = (rs, o) => (K.scat5 ? rs.map((r) => { const h = r.sc.evals ? K.scat5.compHTML(r.sc, { cls: (o && o.cls) || 'kt' }) : ''; const g = K.jugadorGlobal(r.inc.jugadorId); return h ? `<div class="cm-comp"><p class="pt-kp"><b>${e(g ? g.j.nombre : '—')}</b></p>${h}</div>` : ''; }).join('') : '');
  const seccionHTML = (rs, o) => (rs.length ? `<div class="cm-sec-inf"><h2 class="bit-h2">Conmociones cerebrales (SCAT5)</h2><p class="pt-kp">${AVISO}</p>${tablaHTML(rs, o)}${o && o.breve ? `<p class="pt-kp cm-nota-breve">${NOTA_BREVE}</p>` : compSeccion(rs, o)}</div>` : '');
  const botonTodasHTML = (rs, nombre) => (K.scat5 && rs.length ? `<button type="button" class="btn sec chico" data-scat-todas="${rs.map((r) => e(r.p.id) + ':' + e(r.inc.id)).join(',')}" data-scat-nombre="${e(nombre || 'Informe SCAT5')}">${K.uiIco('pdf', 16)} Informe SCAT5 (PDF)</button>` : '');
  const kpiHTML = (n) => (n ? `<div class="bd-k cm-kpi"><b>${n}</b><span>conmociones</span></div>` : '');

  /* ---------- Retorno gradual (bloque para el seguimiento de Kine y el formulario de la lesión) ---------- */
  function rtpHTML(c) {
    const a = rtpNorm(c.rtpConmocion);
    return `<div class="cm-rtp" data-cm-rtp><h3 class="clin-h">Retorno gradual por conmoción</h3>
      <p class="suave" style="margin:0 0 8px;font-size:13px">Marca cada etapa cuando se cumpla y anota su fecha. La etapa 5 es después del alta médica.</p>
      ${ETAPAS.map((t, i) => `<div class="cm-rtp-fila"><label class="check"><input type="checkbox" data-rtp-ok="${i}"${a[i].hecho ? ' checked' : ''}><span><b>${i + 1}.</b> ${e(t)}</span></label>
        <input type="date" data-rtp-f="${i}" value="${e(a[i].fecha)}" aria-label="Fecha de la etapa ${i + 1}: ${e(t)}"></div>`).join('')}
      <p class="suave" data-rtp-n style="margin:4px 0 0">${a.filter((x) => x.hecho).length} de ${ETAPAS.length} etapas cumplidas.</p></div>`;
  }
  function rtpMontar(hoja) {
    const n = () => { const el = hoja.querySelector('[data-rtp-n]'); if (el) el.textContent = `${hoja.querySelectorAll('[data-rtp-ok]:checked').length} de ${ETAPAS.length} etapas cumplidas.`; };
    hoja.addEventListener('change', (ev) => {
      const t = ev.target; if (!t.matches || !t.matches('[data-rtp-ok]')) return;
      const f = hoja.querySelector(`[data-rtp-f="${t.dataset.rtpOk}"]`); if (t.checked && f && !f.value) f.value = K.hoy();
      n();
    });
  }
  const rtpLeer = (hoja) => ETAPAS.map((_, i) => { const ok = hoja.querySelector(`[data-rtp-ok="${i}"]`), f = hoja.querySelector(`[data-rtp-f="${i}"]`); return { fecha: f && ISO(f.value) ? f.value : '', hecho: !!(ok && ok.checked) }; });
  function rtpAplicar(c, a) { if (!c.conmocion) return; if (rtpVacio(a)) delete c.rtpConmocion; else c.rtpConmocion = a; }

  /* ---------- Formulario “Sospecha de conmoción cerebral” (en la incidencia de un partido) ---------- */
  // pre: { jugadorId, momento, minuto } para no repetir lo que ya se anotó en la evaluación rápida o en la atención
  function form(p, rec, pre) {
    const P = K.part, inf = K.inf();
    pre = pre || {};
    const cand = K.jugadoresDePartido(inf, p);
    if (!cand.length && !rec && !pre.jugadorId) { K.aviso('Primero agrega jugadores de esta categoría', true); return; }
    const sc0 = rec && rec.scat5 ? limpiar(rec.scat5) || vacio() : vacio();
    const mom0 = rec ? rec.momento : pre.momento || 't1', min0 = rec ? rec.minuto : pre.minuto, jsel = rec ? rec.jugadorId : pre.jugadorId || '';
    const citP = P.citadosDe(p), principal = citP ? Array.from(new Set(citP.concat(P.jugaronDe(p)))) : null;
    const filasJ = cand.map(({ j, visitante }) => ({ j, sub: [j.categoria, j.posicion].filter(Boolean).join(' · ') + (visitante ? ' (juega también aquí)' : '') }));
    if (jsel && !cand.some((x) => x.j.id === jsel) && K.jugadorGlobal(jsel)) filasJ.push({ j: K.jugadorGlobal(jsel).j });
    const lbl = (t) => `<span class="lbl">${t}</span>`;
    const checks = (lista, obj, att) => `<div class="cm-grid">${lista.map(([k, t]) => `<label class="check cm-chk"><input type="checkbox" data-cm-${att}="${k}"${obj[k] ? ' checked' : ''}><span>${e(t)}</span></label>`).join('')}</div>`;
    const sec = (tit, cuerpo, o) => `<details class="mas-clin cm-sec${o && o.cls ? ' ' + o.cls : ''}"${o && o.open ? ' open' : ''} data-cm-sec="${e(o && o.id || '')}"><summary><span>${tit}</span></summary><div class="mas-cuerpo">${cuerpo}</div></details>`;
    const cubre = sc0.evals && K.scat5 ? K.scat5.resumen(sc0) : {};   // campos que la evaluación hecha en la app ya calcula sola
    const num = (name, rotulo, max, v) => `<label class="campo"><span>${rotulo}${cubre[name] !== undefined ? ' <small class="suave">(calculado)</small>' : ''}</span><input type="number" inputmode="numeric" min="0" max="${max}" step="1" name="${name}" value="${e(v)}" placeholder="0–${max}"${cubre[name] !== undefined ? ' readonly' : ''}></label>`;
    const hayEv = !!(sc0.evals && sc0.evals.length);
    const bloqueScat = K.scat5 && K.puedeEditar() ? `<div class="sc-hacer" data-cm-scat-caja>
          <button type="button" class="btn sc-go" data-cm-scat><span>${hayEv ? 'Continuar evaluación SCAT5' : 'Evaluación SCAT5 (cancha, camarín y seguimiento)'}</span></button>
          <p class="suave" data-cm-scat-est>${e(K.scat5.estadoTxt(sc0))}. Se hace en tres momentos: en cancha (2–3 min), en camarín (10–15 min) y seguimiento. Puedes hacer solo el primero ahora.</p>
          <div class="fila wrap gap">${hayEv ? `<button type="button" class="btn sec chico" data-cm-scat-pdf>${K.uiIco('pdf', 16)} Ficha SCAT5 (PDF)</button>` : ''}${K.scat5.enlaceOficialHTML('chico')}</div>
        </div>` : '';
    const jugando = P.jugando;
    // Guarda el formulario (incidencia + atención + lesión). Devuelve la incidencia o null si falta algo (la ventana queda abierta con el aviso).
    function guardarForm(hoja, silencioso) {
          const d = K.datos(hoja), momento = K.segValor(hoja, 'momento') || 't1';
          if (!d.jugadorId) { K.aviso('Elige un jugador', true); return null; }
          const rango = [['sintomas', 'El puntaje de síntomas', 22], ['severidad', 'La severidad', 132], ['sacOri', 'La orientación', 5], ['sacMem', 'La memoria inmediata', 30], ['sacConc', 'La concentración', 5], ['sacDif', 'La memoria diferida', 10], ['equilibrio', 'Los errores de equilibrio', 30]];
          for (const [k, t, mx] of rango) { if (d[k] !== '' && !(Number.isFinite(Number(d[k])) && Number(d[k]) >= 0 && Number(d[k]) <= mx)) { K.aviso(`${t} va de 0 a ${mx}`, true); return null; } }
          const minT = jugando(momento) && d.minuto !== '' ? Math.max(0, Math.round(Number(d.minuto))) : '';
          const mark = (att) => { const o = {}; hoja.querySelectorAll(`[data-cm-${att}]:checked`).forEach((x) => { o[x.dataset['cm' + att[0].toUpperCase() + att.slice(1)]] = true; }); return o; };
          let sc = limpiar({
            minuto: minT === '' ? '' : momento === 't2' ? P.mitad(p) + minT : minT, mec: d.mec, signos: mark('sig'), banderas: mark('ban'), eval: d.eval, sintomas: d.sintomas, severidad: d.severidad, sacOri: d.sacOri, sacMem: d.sacMem, sacConc: d.sacConc, sacDif: d.sacDif, evals: rec && rec.scat5 ? rec.scat5.evals : undefined, equilibrio: d.equilibrio, coord: d.coord,
            retirado: !!d.retirado, reemplazo: K.segValor(hoja, 'reemplazo') === 'si', deriva: d.deriva, rtpInicio: d.rtpInicio, informoOrg: !!d.informoOrg, informeReemplazo: (d.informeReemplazo || '').trim(), notas: (d.notas || '').trim()
          });
          if (sc.evals && K.scat5) { const t0 = Object.assign({}, sc); K.scat5.aplicar(t0); sc = limpiar(t0); } // los puntajes y la evaluación realizada salen de las evaluaciones
          const base = { jugadorId: d.jugadorId, momento, minuto: minT, clase: 'molestia', enCancha: jugando(momento), mec: sc.mec && sc.mec !== 'otro' ? 'contacto' : 'na', zona: 'cabeza', retiro: jugando(momento) && sc.retirado, casoId: '', notas: sc.notas, scat5: sc };
          let inc = rec;
          if (rec) Object.assign(rec, base);
          else { inc = Object.assign({ id: K.uid(), trat: inf.tratamientos.some((t) => t.id === 'evalcancha') ? { evalcancha: 1 } : {} }, base); P.incs(p).push(inc); }
          P.sincronizar(p, inc);
          K.recienteJugador && K.recienteJugador(d.jugadorId);
          K.guardar(); if (!silencioso) K.aviso(hayBandera(sc) ? 'Guardado. Hay banderas rojas: derivación urgente' : 'Sospecha de conmoción registrada'); K.render();
          return inc;
    }
    K.modal({
      titulo: 'Sospecha de conmoción cerebral · ' + p.rival + (p.cat ? ' · Sub ' + p.cat : ''),
      cuerpo: `
        <p class="cm-nota" data-cm-nota>Registro de lo que hiciste en el partido. No es un diagnóstico ni reemplaza el formulario oficial SCAT5.</p>
        <div class="cm-urg oculto" data-cm-urg role="alert"><b>Derivación urgente a servicio de urgencia</b><span>Hay al menos una bandera roja. Se dejó marcada la derivación; puedes cambiarla abajo.</span></div>
        <div class="campo"><span class="lbl-j">Jugador</span>${K.selJugador('jugadorId', { lista: K.itemsSelJ(filasJ), sel: jsel, principal, principalTxt: 'citados' })}</div>
        ${bloqueScat}
        ${sec('¿Qué pasó?', `
          <div class="campo">${lbl('¿Cuándo ocurrió?')}${K.seg('momento', P.MOMENTOS, mom0)}</div>
          <label class="campo ${jugando(mom0) ? '' : 'oculto'}" data-blq="min"><span>Minuto del tiempo (0 a ${P.mitad(p) + 15})</span><input type="number" inputmode="numeric" min="0" max="${P.mitad(p) + 15}" name="minuto" value="${min0 != null && min0 !== '' ? e(min0) : ''}" placeholder="Ej. 38"><small class="suave" data-conv></small></label>
          <label class="campo"><span>Mecanismo</span><select name="mec"><option value="">— elegir —</option>${K.opts(MEC, sc0.mec)}</select></label>`, { open: true, id: 'que' })}
        ${sec('Signos observados <small class="suave" data-cm-nsig></small>', checks(SIGNOS, sc0.signos, 'sig'), { open: true, id: 'signos' })}
        ${sec('Banderas rojas <small class="suave" data-cm-nban></small>', `<p class="suave" style="margin:0 0 6px;font-size:13px">Si marcas cualquiera, se recomienda derivación urgente.</p>${checks(BANDERAS, sc0.banderas, 'ban')}`, { open: true, id: 'banderas', cls: 'cm-rojo' })}
        ${sec('Evaluación realizada', `
          <label class="campo"><span>¿Qué evaluación se hizo?</span><select name="eval">${K.opts(EVALS, sc0.eval)}</select></label>
          <div data-cm-res class="${sc0.eval === 'no' ? 'oculto' : ''}"><p class="suave" style="margin:0 0 6px;font-size:13px">Resultados (todos opcionales)</p>
            <div class="grid2">${num('sintomas', 'Puntaje de síntomas (0–22)', 22, sc0.sintomas)}${num('severidad', 'Severidad de síntomas (0–132)', 132, sc0.severidad)}</div>
            <div class="grid2">${num('sacOri', 'Orientación (0–5)', 5, sc0.sacOri)}${num('sacMem', 'Memoria inmediata (0–30)', 30, sc0.sacMem)}</div>
            <div class="grid2">${num('sacConc', 'Concentración (0–5)', 5, sc0.sacConc === undefined ? '' : sc0.sacConc)}${num('sacDif', 'Memoria diferida (0–10)', 10, sc0.sacDif === undefined ? '' : sc0.sacDif)}</div>
            <div class="grid2">${num('equilibrio', 'Equilibrio: errores (0–30)', 30, sc0.equilibrio)}<label class="campo"><span>Coordinación${cubre.coord !== undefined ? ' <small class="suave">(calculado)</small>' : ''}</span><select name="coord"${cubre.coord !== undefined ? ' disabled' : ''}>${K.opts(COORD, sc0.coord)}</select></label></div></div>`, { id: 'eval' })}
        ${sec('Resultado', `
          <label class="check cm-chk"><input type="checkbox" name="retirado"${sc0.retirado ? ' checked' : ''}><span><b>Retirado del partido</b></span></label>
          <p class="suave" style="margin:0 0 8px;font-size:13px">Con sospecha de conmoción el jugador no vuelve a jugar ese día.</p>
          <div class="campo">${lbl('¿Se hizo el reemplazo?')}${K.seg('reemplazo', [['no', 'No'], ['si', 'Sí']], sc0.reemplazo ? 'si' : 'no')}</div>
          <label class="campo"><span>Derivación</span><select name="deriva">${K.opts(DERIVA, sc0.deriva)}</select></label>
          <label class="campo"><span>Plan de retorno gradual iniciado (fecha, opcional)</span><input type="date" name="rtpInicio" value="${e(sc0.rtpInicio)}"></label>
          <label class="check cm-chk"><input type="checkbox" name="informoOrg"${sc0.informoOrg ? ' checked' : ''}><span>Se informó a la organización del torneo (≤24 h, p. ej. CONMEBOL)</span></label>
          <label class="campo"><span>Informe médico del reemplazo (opcional)</span><textarea name="informeReemplazo" rows="3">${e(sc0.informeReemplazo)}</textarea></label>
          <label class="campo"><span>Notas (opcional)</span><textarea name="notas" rows="3">${e(sc0.notas)}</textarea></label>`, { open: true, id: 'resultado' })}`,
      botones: [
        rec ? { txt: 'Eliminar', cls: 'peligro', fn: () => { K.conDeshacer('Registro de conmoción eliminado', () => { P.quitar(p, rec); }); } } : { txt: 'Cancelar', cls: 'sec' },
        { txt: 'Guardar', fn: (m, hoja) => (guardarForm(hoja, false) ? undefined : false) }
      ],
      alMontar: (m, hoja) => {
        const urg = hoja.querySelector('[data-cm-urg]'), der = hoja.querySelector('[name=deriva]'), inMin = hoja.querySelector('[name=minuto]'), conv = hoja.querySelector('[data-conv]');
        let derTocada = false, auto = false;
        const previo = sc0.deriva;
        der.addEventListener('change', () => { derTocada = true; auto = false; });
        const contar = () => {
          const nb = hoja.querySelectorAll('[data-cm-ban]:checked').length, ns = hoja.querySelectorAll('[data-cm-sig]:checked').length;
          hoja.querySelector('[data-cm-nban]').textContent = nb ? `(${nb})` : '';
          hoja.querySelector('[data-cm-nsig]').textContent = ns ? `(${ns})` : '';
          urg.classList.toggle('oculto', !nb);
          if (nb && !derTocada && der.value !== 'urgencia') { der.value = 'urgencia'; auto = true; }
          else if (!nb && auto && !derTocada) { der.value = previo === 'urgencia' ? 'ninguna' : previo; auto = false; }
        };
        hoja.addEventListener('change', (ev) => { if (ev.target.matches('[data-cm-ban], [data-cm-sig]')) contar(); });
        const actConv = () => { const mo = K.segValor(hoja, 'momento'); conv.textContent = mo === 't2' && inMin.value !== '' ? `= minuto ${P.mitad(p) + Number(inMin.value)}' del partido` : mo === 't2' ? 'El minuto se cuenta desde el inicio del 2.º tiempo.' : ''; };
        inMin.addEventListener('input', actConv);
        hoja.addEventListener('seg', (ev) => { if (ev.target.dataset.seg !== 'momento') return; actConv(); hoja.querySelector('[data-blq=min]').classList.toggle('oculto', !jugando(K.segValor(hoja, 'momento'))); });
        hoja.querySelector('[name=eval]').addEventListener('change', (ev) => hoja.querySelector('[data-cm-res]').classList.toggle('oculto', ev.target.value === 'no'));
        contar(); actConv();
        const bs = hoja.querySelector('[data-cm-scat]');
        if (bs) bs.addEventListener('click', () => { const inc = guardarForm(hoja, true); if (!inc) return; m.cerrar(); setTimeout(() => K.scat5.abrir(p, inc, { volver: true }), 230); });
        const bp = hoja.querySelector('[data-cm-scat-pdf]');
        if (bp) bp.addEventListener('click', () => { if (rec) K.scat5.pdf(p, rec); });
      }
    });
  }

  K.conmocion = {
    MEC, SIGNOS, BANDERAS, EVALS, DERIVA, COORD, ETAPAS, TITULO, AVISO,
    vacio, limpiar, hayBandera, normalizarInforme, resumenTxt, incDeCaso, detalleCaso, puntajes, nombres,
    filas, tablaHTML, seccionHTML, compSeccion, kpiHTML, NOTA_BREVE, botonTodasHTML,
    rtp: rtpNorm, rtpHechas, rtpIniciar, rtpHTML, rtpMontar, rtpLeer, rtpAplicar,
    form
  };
})();

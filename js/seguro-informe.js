/* v1.9.7 · «Informe del seguro»: PDF aparte con los totales (activaciones, controles, exámenes, kinesiología externa, hospitalizaciones…),
   gráficos y, por jugador, sus activaciones y eventos con fecha, centro y N.º de asistencia.
   El RUT, la fecha de nacimiento y la previsión salen solo si se marca la casilla. El valor en pesos (para estimar el dinero ahorrado) también es opcional. */
(function () {
  const K = window.K;
  const e = K.esc;
  const fc = (iso) => K.fechaCorta(iso);
  const clp = (n) => '$' + new Intl.NumberFormat('es-CL').format(Math.round(n || 0));
  const TIPO_TXT = { control: 'Control médico', examen: 'Examen', procedimiento: 'Procedimiento', kinesiologia: 'Kinesiología externa', cirugia: 'Cirugía', hosp: 'Hospitalización' };
  const TIPO_COL = { urgencia: '#e0245e', control: '#7b4fb8', examen: '#f08a24', procedimiento: '#c2479b', kinesiologia: '#14a3a3', cirugia: '#1f2937', hosp: '#b3202a' };
  const VAL_TIPOS = [['urgencia', 'Urgencia (por activación)'], ['control', 'Control médico'], ['examen', 'Examen (valor general)'], ['procedimiento', 'Procedimiento'], ['kinesiologia', 'Sesión de kinesiología externa'], ['cirugia', 'Cirugía'], ['hosp', 'Hospitalización (por día)']];
  const VAL_NOMBRE = Object.fromEntries(VAL_TIPOS);
  const dias = (a, b) => Math.max(1, K.kineFechas.dif(a, b) + 1);

  K.seguroValores = () => { const inf = K.kineInfs()[0]; return (inf && inf.seguroValores) || {}; };

  // Junta todo lo del seguro del período, por jugador.
  K.seguroInformeDatos = (o) => {
    o = o || {};
    const anio = o.anio && o.anio !== 'todo' ? String(o.anio) : '';
    const en = (iso) => !anio || (iso || '').slice(0, 4) === anio;
    const porJ = new Map(), vals = o.vals || {};
    const get = (inf, jid) => { let r = porJ.get(jid); if (!r) { const q = K.kineBuscarJ(jid) || { inf, j: { nombre: '—' }, cat: 0 }; r = { inf: q.inf || inf, j: q.j, cat: q.cat, acts: [], solas: [] }; porJ.set(jid, r); } return r; };
    const valor = (ev) => {
      if (ev.k === 'urgencia') return vals.urgencia || 0;
      if (ev.k === 'examen') return (vals.examenes && vals.examenes[ev.detalle]) || vals.examen || 0;
      if (ev.k === 'kinesiologia') return (vals.kinesiologia || 0) * (ev.cant || 1);
      if (ev.k === 'hosp') return (vals.hosp || 0) * (ev.dias || 1);
      return vals[ev.k] || 0;
    };
    K.kineInfs().forEach((inf) => {
      const segs = inf.seguros || [], evs = inf.segEventos || [];
      segs.forEach((s) => {
        const mios = evs.filter((x) => x.jugadorId === s.jugadorId && !x.sinAct && x.seguroId === s.id && en(x.fecha));
        const urgEn = en(s.activacion);
        if (!urgEn && !mios.length) return;
        const r = get(inf, s.jugadorId);
        const fila = [];
        if (urgEn) fila.push({ k: 'urgencia', fecha: s.activacion || '', titulo: 'Urgencia · activación del seguro', detalle: '', centro: s.clinica || '', medico: '', nAsist: s.nClinica || '', cant: 1 });
        mios.forEach((x) => fila.push({ k: x.tipo, fecha: x.fecha, hasta: x.hasta || '', titulo: (TIPO_TXT[x.tipo] || x.tipo) + (x.urg ? ' (urgencia)' : ''), detalle: x.detalle || '', resultado: x.tipo === 'examen' ? x.resultado || '' : '', centro: x.centro || x.centroKine || '', medico: x.medico || '', nAsist: x.nAsist || '', cant: x.tipo === 'kinesiologia' ? Number(x.cantidad) || 1 : 1, dias: x.tipo === 'hosp' ? dias(x.fecha, x.hasta || x.fecha) : 1 }));
        fila.forEach((f) => { f.valor = valor(f); });
        fila.sort((a, b) => (a.k === 'urgencia' ? -1 : b.k === 'urgencia' ? 1 : 0) || (a.fecha || '').localeCompare(b.fecha || ''));
        r.acts.push({ s, filas: fila });
      });
      evs.filter((x) => x.sinAct && x.tipo === 'hosp' && en(x.fecha)).forEach((x) => {
        const r = get(inf, x.jugadorId), f = { k: 'hosp', fecha: x.fecha, hasta: x.hasta || '', titulo: 'Hospitalización (sin activación)', detalle: x.detalle || '', centro: x.centro || '', medico: '', nAsist: x.nAsist || '', cant: 1, dias: dias(x.fecha, x.hasta || x.fecha) };
        f.valor = valor(f); r.solas.push(f);
      });
    });
    const jugadores = Array.from(porJ.values()).sort((a, b) => b.cat - a.cat || (a.j.nombre || '').localeCompare(b.j.nombre || '', 'es'));
    const todas = []; jugadores.forEach((r) => { r.acts.forEach((a) => a.filas.forEach((f) => todas.push(Object.assign({ jid: r.j.id, cat: r.cat }, f)))); r.solas.forEach((f) => todas.push(Object.assign({ jid: r.j.id, cat: r.cat }, f))); });
    const c = {}; todas.forEach((f) => { c[f.k] = (c[f.k] || 0) + 1; });
    const sesiones = todas.filter((f) => f.k === 'kinesiologia').reduce((a, f) => a + f.cant, 0);
    const diasHosp = todas.filter((f) => f.k === 'hosp').reduce((a, f) => a + f.dias, 0);
    const porTipo = {}; // dinero por tipo
    todas.forEach((f) => { porTipo[f.k] = (porTipo[f.k] || 0) + f.valor; });
    const total = Object.keys(porTipo).reduce((a, k) => a + porTipo[k], 0);
    return { anio: anio || 'todo', jugadores, todas, c, sesiones, diasHosp, porTipo, total, activaciones: c.urgencia || 0 };
  };

  const hbarM = (filas, color) => {
    const max = Math.max(1, ...filas.map((r) => r[1]));
    return filas.length ? `<div class="bd-h">${filas.map(([l, v]) => `<div class="bd-r bd-m"><span class="bd-l" title="${e(l)}">${e(l)}</span><span class="bd-t"><i style="width:${Math.max(v ? 3 : 0, (v / max) * 100)}%;background:${color}"></i></span><b>${e(clp(v))}</b></div>`).join('')}</div>` : '<p class="bd-vacio">Sin datos.</p>';
  };

  K.seguroInformeHTML = (o) => {
    o = o || {};
    const d = K.seguroInformeDatos(o), { hbar, donut, panel, top, sumar, mensual } = K.bd;
    const conValor = !!o.valor;
    const kpi = (n, t) => `<div class="bd-k"><b>${n}</b><span>${t}</span></div>`;
    const c = d.c, tp = [['Urgencia', c.urgencia || 0, TIPO_COL.urgencia]].concat(Object.keys(TIPO_TXT).map((k) => [TIPO_TXT[k], c[k] || 0, TIPO_COL[k]]));
    const ex = {}, cen = {}, porJ = {}, cat = {};
    d.todas.forEach((f) => { if (f.k === 'examen') sumar(ex, f.detalle || 'Sin nombre'); if (f.centro) sumar(cen, f.centro); const q = K.kineBuscarJ(f.jid); sumar(porJ, q ? q.j.nombre : '—'); sumar(cat, 'Sub ' + f.cat); });
    const periodo = d.anio === 'todo' ? 'Todo el historial' : 'Año ' + d.anio;
    const priv = (r) => {
      if (!(o.rut || o.fechaNac || o.prevision)) return '';
      const a = K.antecedentesDe && K.antecedentesDe(r.inf, r.j.id) || {}, sg = (r.acts[r.acts.length - 1] || {}).s || {};
      const p = [];
      if (o.rut) { const v = K.formatoRut(a.rut || sg.rut); if (v) p.push('RUT ' + e(v)); }
      if (o.fechaNac) { const v = a.fechaNac || sg.fechaNac; if (v) p.push('Nacimiento ' + e(fc(v))); }
      if (o.prevision) { const v = K.previsionTxt ? K.previsionTxt(a.prevision ? a : sg) : ''; if (v) p.push('Previsión ' + e(v)); }
      return p.length ? `<p class="sp-priv">${p.join(' · ')}</p>` : '';
    };
    const tabla = (filas) => `<table class="kn-t sp-t"><thead><tr><th>Fecha</th><th>Evento</th><th>Detalle</th><th>Centro · médico</th><th>N.º asistencia</th>${conValor ? '<th class="der">Valor</th>' : ''}</tr></thead><tbody>${filas.map((f) => `<tr><td>${f.fecha ? e(fc(f.fecha)) : '—'}${f.hasta && f.hasta !== f.fecha ? `<small>al ${e(fc(f.hasta))}</small>` : ''}</td><td><i class="sp-pto" style="background:${TIPO_COL[f.k]}"></i>${e(f.titulo)}${f.k === 'kinesiologia' && f.cant > 1 ? ` <small>${f.cant} sesiones</small>` : ''}</td><td>${e(f.detalle || '—')}${f.resultado ? `<small>Resultado: ${e(f.resultado)}</small>` : ''}</td><td>${e([f.centro, f.medico].filter(Boolean).join(' · ') || '—')}</td><td>${f.nAsist ? e(f.nAsist) : '—'}</td>${conValor ? `<td class="der">${f.valor ? e(clp(f.valor)) : '—'}</td>` : ''}</tr>`).join('')}</tbody></table>`;
    const bloquesJ = d.jugadores.map((r) => `<section class="sp-j"><h3>${e(r.j.nombre)} <small>Sub ${r.cat}</small></h3>${priv(r)}
      ${r.acts.map((a) => `<div class="sp-a"><p class="sp-ad"><b>${e(a.s.diagnostico || 'Sin diagnóstico')}</b>${a.s.activacion ? ` · activado el ${e(fc(a.s.activacion))}` : ''}${a.s.clinica ? ' · ' + e(a.s.clinica) : ''}${a.s.nClinica ? ' · N.º ' + e(a.s.nClinica) : ''}${a.s.pais ? ' · ' + e(a.s.pais) : ''}</p>${tabla(a.filas)}</div>`).join('')}
      ${r.solas.length ? `<div class="sp-a"><p class="sp-ad"><b>Hospitalizaciones sin activación</b></p>${tabla(r.solas)}</div>` : ''}</section>`).join('');
    const ahorro = conValor ? `<h2 class="bit-h2">Dinero ahorrado (estimado)</h2>
      <p class="sp-nota">Estimación con los valores que ingresó el kinesiólogo; no es un cobro real ni un dato del seguro.</p>
      <table class="kn-t sp-t"><thead><tr><th>Concepto</th><th class="der">Cantidad</th><th class="der">Valor unitario</th><th class="der">Subtotal</th></tr></thead><tbody>
      ${VAL_TIPOS.map(([k, t]) => { const n = k === 'urgencia' ? c.urgencia || 0 : k === 'kinesiologia' ? d.sesiones : k === 'hosp' ? d.diasHosp : c[k] || 0; if (!n && !d.porTipo[k]) return ''; const v = (o.vals || {})[k]; return `<tr><td>${e(t)}</td><td class="der">${n}</td><td class="der">${v ? e(clp(v)) : '—'}</td><td class="der">${e(clp(d.porTipo[k] || 0))}</td></tr>`; }).join('')}
      <tr class="sp-tot"><td colspan="3"><b>Total estimado</b></td><td class="der"><b>${e(clp(d.total))}</b></td></tr></tbody></table>` : '';
    return `<div class="bit-print seg-print"><header><img class="sw-vs" src="img/escudo-sw-vs.png" alt=""><div><h1>Informe del seguro</h1><p>Santiago Wanderers · Fútbol Joven · ${e(periodo)} · generado el ${e(fc(K.hoy()))}</p></div></header>
      <div class="bd-kpis">${kpi(d.activaciones, 'activaciones (urgencias)')}${kpi(d.todas.length, 'eventos en total')}${kpi(c.control || 0, 'controles')}${kpi(c.examen || 0, 'exámenes')}${kpi(d.sesiones, 'sesiones de kine externa')}${kpi(c.hosp || 0, 'hospitalizaciones')}${kpi(c.procedimiento || 0, 'procedimientos')}${kpi(c.cirugia || 0, 'cirugías')}${conValor ? kpi(clp(d.total), 'ahorro estimado') : ''}</div>
      <h2 class="bit-h2">Estadísticas</h2>
      <div class="bd-g">
        ${panel('Eventos por mes', mensual(d.todas.map((f) => ({ f: f.fecha, cls: 'ev' }))).replace(/<div class="bd-leyenda">.*?<\/div>/s, ''), true)}
        ${panel('Tipo de evento', donut(tp))}
        ${panel('Por categoría', hbar(top(cat, 6), '#3b5bb5'))}
        ${panel('Exámenes más frecuentes', hbar(top(ex, 6), '#f08a24'))}
        ${panel('Centros médicos', hbar(top(cen, 6), '#2f7a4a'))}
        ${panel('Jugadores con más eventos', hbar(top(porJ, 8), '#2f7a4a'))}
        ${conValor ? panel('Dinero ahorrado por tipo (estimado)', hbarM(VAL_TIPOS.map(([k]) => [VAL_NOMBRE[k], d.porTipo[k] || 0]).filter((x) => x[1] > 0), '#0e7c7c'), true) : ''}
      </div>
      ${ahorro}
      <h2 class="bit-h2">Detalle por jugador <small>(${d.jugadores.length})</small></h2>
      ${d.jugadores.length ? bloquesJ : '<p class="sp-nota">No hay activaciones ni eventos del seguro en este período.</p>'}
      <p class="sp-nota">${o.rut || o.fechaNac || o.prevision ? 'Incluye datos personales de los jugadores: no lo compartas fuera del área kinésica.' : 'No incluye datos personales de los jugadores (RUT, fecha de nacimiento, previsión).'}</p></div>`;
  };

  K.seguroInformePdf = async (o) => {
    if (!K.verPrivado()) return;
    try { await document.fonts.ready; } catch (x) { /* sigue */ }
    const d = K.seguroInformeDatos(o);
    if (!d.todas.length) { K.aviso('No hay activaciones ni eventos del seguro en ese período', true); return; }
    return K.pdf.documento(K.seguroInformeHTML(o), `Informe del seguro - ${d.anio === 'todo' ? 'todo el historial' : d.anio} - ${K.hoy()}`);
  };

  /* ---------- Ventana de opciones ---------- */
  const soloDigitos = (v) => String(v || '').replace(/\D/g, '');
  const miles = (v) => { const t = soloDigitos(v).replace(/^0+/, ''); return t ? t.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''; };
  K.formInformeSeguro = () => {
    if (!K.verPrivado()) return;
    const infs = K.kineInfs(), vals = K.seguroValores();
    const anios = Array.from(new Set(infs.reduce((a, inf) => a.concat((inf.segEventos || []).map((x) => (x.fecha || '').slice(0, 4)), (inf.seguros || []).map((x) => (x.activacion || '').slice(0, 4))), []).filter(Boolean))).sort().reverse();
    const exNombres = Array.from(new Set(infs.reduce((a, inf) => a.concat((inf.segEventos || []).filter((x) => x.tipo === 'examen' && x.detalle).map((x) => x.detalle)), []))).sort((a, b) => a.localeCompare(b, 'es'));
    K.modal({
      titulo: 'Informe del seguro (PDF)',
      cuerpo: `<p class="suave" style="margin:0 0 8px">Un PDF aparte con los totales, los gráficos y, por jugador, sus activaciones y eventos con fecha, centro y N.º de asistencia.</p>
        <label class="campo"><span>Período</span><select name="anio"><option value="todo">Todo el historial</option>${anios.map((a) => `<option value="${a}">Año ${a}</option>`).join('')}</select></label>
        <fieldset class="sp-fs"><legend>Datos personales (no salen si no los marcas)</legend>
          <label class="check"><input type="checkbox" name="rut"><span>Incluir el RUT</span></label>
          <label class="check"><input type="checkbox" name="fechaNac"><span>Incluir la fecha de nacimiento</span></label>
          <label class="check"><input type="checkbox" name="prevision"><span>Incluir la previsión de salud</span></label></fieldset>
        <fieldset class="sp-fs"><legend>Dinero ahorrado (opcional)</legend>
          <label class="check"><input type="checkbox" name="valor" data-sp-valor><span>Calcular un estimado del dinero ahorrado</span></label>
          <div data-sp-vals class="oculto"><p class="suave" style="margin:4px 0 8px">Pon cuánto costaría cada cosa en pesos. Lo que dejes vacío no suma. Los valores quedan guardados para la próxima vez.</p>
            ${VAL_TIPOS.map(([k, t]) => `<label class="campo"><span>${e(t)}</span><input type="text" inputmode="numeric" data-val="${k}" value="${vals[k] ? miles(vals[k]) : ''}" placeholder="$" autocomplete="off"></label>`).join('')}
            ${exNombres.length ? `<p class="suave" style="margin:8px 0 4px"><b>Valor por tipo de examen</b> (si lo dejas vacío se usa el valor general de examen)</p>${exNombres.map((n) => `<label class="campo"><span>${e(n)}</span><input type="text" inputmode="numeric" data-valex="${e(n)}" value="${vals.examenes && vals.examenes[n] ? miles(vals.examenes[n]) : ''}" placeholder="$" autocomplete="off"></label>`).join('')}` : ''}
          </div></fieldset>`,
      botones: [{ txt: 'Cancelar', cls: 'sec' }, { txt: 'Descargar PDF', fn: (m, hoja) => {
        const d = K.datos(hoja), nuevos = {};
        hoja.querySelectorAll('[data-val]').forEach((i) => { const n = Number(soloDigitos(i.value)); if (n > 0) nuevos[i.dataset.val] = n; });
        const ex = {}; hoja.querySelectorAll('[data-valex]').forEach((i) => { const n = Number(soloDigitos(i.value)); if (n > 0) ex[i.dataset.valex] = n; });
        if (Object.keys(ex).length) nuevos.examenes = ex;
        const o = { anio: d.anio || 'todo', rut: !!d.rut, fechaNac: !!d.fechaNac, prevision: !!d.prevision, valor: !!d.valor, vals: d.valor ? nuevos : {} };
        if (d.valor && infs[0]) { infs[0].seguroValores = nuevos; K.guardar(); } // los valores se guardan solo cuando se usan
        setTimeout(() => K.seguroInformePdf(o), 250);
      } }],
      alMontar: (m, hoja) => {
        const ch = hoja.querySelector('[data-sp-valor]'), bl = hoja.querySelector('[data-sp-vals]');
        ch.addEventListener('change', () => bl.classList.toggle('oculto', !ch.checked));
        hoja.addEventListener('input', (ev) => { const i = ev.target.closest && ev.target.closest('[data-val],[data-valex]'); if (i) i.value = miles(i.value); });
      }
    });
  };
  Object.assign(K.acciones, { segInforme() { K.formInformeSeguro(); } });
})();

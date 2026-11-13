/* Pestaña Kine · Seguro (ingreso, eventos con N.º de asistencia, estadísticas de uso) y calendario anual de asistencia.
   Los datos del seguro (RUT, etc.) son privados: en la nube solo los ven los administradores. */
(function () {
  const K = window.K;
  const e = K.esc;
  const { D, dif, suma, MESES } = K.kineFechas;
  const fc = (iso) => K.fechaCorta(iso);

  const TIPOS = [['control', 'Control médico'], ['examen', 'Examen'], ['procedimiento', 'Procedimiento'], ['kinesiologia', 'Kinesiología'], ['cirugia', 'Cirugía'], ['hosp', 'Hospitalización']];
  const TIPO_TXT = Object.fromEntries(TIPOS);
  const TIPO_COL = { control: '#7b4fb8', examen: '#f08a24', procedimiento: '#c2479b', kinesiologia: '#14a3a3', cirugia: '#1f2937', hosp: '#b3202a', urgencia: '#e0245e' };
  const PROC_BASE = ['Infiltración', 'Punción', 'Sutura', 'Yeso / inmovilización', 'Curación', 'Retiro de puntos', 'Artroscopía'];
  const CLINICAS_BASE = [];

  const todos = (arr) => K.kineInfs().reduce((a, inf) => a.concat((inf[arr] || []).map((x) => ({ inf, x }))), []);
  const segPorId = (sid) => { for (const inf of K.kineInfs()) { const s = (inf.seguros || []).find((x) => x.id === sid); if (s) return { inf, s }; } return null; };
  // Un jugador puede tener varias activaciones del seguro (cada una con su diagnóstico, clínica y N.º de asistencia).
  const activacionesDe = (inf, jid) => (inf.seguros || []).filter((x) => x.jugadorId === jid);
  const evsDe = (inf, s) => { const primera = activacionesDe(inf, s.jugadorId)[0]; return (inf.segEventos || []).filter((x) => x.jugadorId === s.jugadorId && !x.sinAct && (x.seguroId ? x.seguroId === s.id : primera && primera.id === s.id)); };
  const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
  const frec = (arr) => { const m = {}; arr.filter(Boolean).forEach((v) => { m[v] = (m[v] || 0) + 1; }); return Object.keys(m).sort((a, b) => m[b] - m[a] || a.localeCompare(b, 'es')); };
  const procGuardados = () => uniq(frec(todos('segEventos').filter((r) => r.x.tipo === 'procedimiento').map((r) => (r.x.detalle || '').trim())).concat(PROC_BASE));
  const clinicasGuardadas = () => uniq(frec(todos('seguros').map((r) => (r.x.clinica || '').trim())).concat(CLINICAS_BASE));
  // RUT con formato fijo NN.NNN.NNN-N (puntos y guion automáticos).
  const fmtRut = (v) => {
    const t = String(v || '').replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9); if (t.length < 2) return t;
    return t.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + t.slice(-1);
  };
  K.formatoRut = fmtRut;
  const ss = () => { const s = K.kineEstado(); if (s.segAnio === undefined) s.segAnio = 'todo'; return s; };

  /* ---------- Ingreso al seguro ---------- */
  function formIngreso(sid, pre) {
    pre = pre || {};
    const ya = sid ? segPorId(sid) : null, js = K.kineJugadores(!!ya); // al editar una activación vale también un jugador archivado
    if (!js.length) { K.aviso('Primero agrega jugadores en la pestaña Jugadores', true); return; }
    const s = ya ? ya.s : {}, jid = ya ? s.jugadorId : '';
    const exUrg = ya ? (ya.inf.segEventos || []).filter((x) => x.urg && x.seguroId === s.id && x.tipo === 'examen').sort((a, b) => (a.detalle || '').localeCompare(b.detalle || '', 'es')) : [];
    const exSug = K.EV.examen.sug;
    const filaUex = (x) => { x = x || {}; const esta = !x.detalle || exSug.includes(x.detalle);
      return `<div class="grid2 uex-fila" data-uex-fila data-id="${e(x.id || '')}" style="align-items:start"><div><label class="campo"><span>Examen</span><select data-uex-sel><option value="">Elige un examen…</option>${exSug.map((n) => `<option value="${e(n)}"${x.detalle === n ? ' selected' : ''}>${e(n)}</option>`).join('')}<option value="__otro"${x.detalle && !esta ? ' selected' : ''}>Otro (escribir)…</option></select></label>
        <input type="text" data-uex-otro class="${x.detalle && !esta ? '' : 'oculto'}" maxlength="80" placeholder="Nombre del examen" aria-label="Nombre del examen" value="${e(x.detalle && !esta ? x.detalle : '')}" autocomplete="off"></div>
        <div><label class="campo"><span>Resultado (opcional)</span><input type="text" data-uex-res maxlength="160" value="${e(x.resultado || '')}" placeholder="Ej. Sin fractura" autocomplete="off"></label>
        <button type="button" class="btn ghost chico" data-uex-quitar>Quitar este examen</button></div></div>`; };
    const opcJ = js.filter((x) => !ya || x.j.id === jid).map((x) => `<option value="${x.inf.id}|${x.j.id}"${x.j.id === jid ? ' selected' : ''}>${e(x.j.nombre)} · ${e(x.j.categoria || 'Sub ' + x.cat)}</option>`).join('');
    K.modal({
      titulo: ya ? 'Datos de la activación del seguro' : 'Nueva activación del seguro',
      cuerpo: `
        <div class="campo"><span class="lbl-j">Jugador (nombre completo y categoría)</span>${K.selJugador('jid', { lista: K.itemsSelJ(js.filter((x) => !ya || x.j.id === jid).map((x) => ({ j: x.j, value: x.inf.id + '|' + x.j.id, sub: x.j.categoria || 'Sub ' + x.cat }))), sel: ya ? (js.find((x) => x.j.id === jid) ? js.find((x) => x.j.id === jid).inf.id + '|' + jid : '') : pre.jid || '', disabled: !!ya })}</div>
        <p class="suave" data-prev style="margin:-4px 0 8px"></p>
        <label class="campo"><span>Diagnóstico o motivo de esta activación (ej. Esguince de tobillo)</span><input type="text" name="diagnostico" list="dl-segdx" value="${e(s.diagnostico || '')}" autocomplete="off"><datalist id="dl-segdx"></datalist></label>
        <div class="grid2">
          <label class="campo"><span>RUT</span><input type="text" name="rut" value="${e(fmtRut(s.rut))}" placeholder="12.345.678-9" inputmode="text" maxlength="12" autocomplete="off"></label>
          <label class="campo"><span>Fecha de nacimiento</span><input type="date" name="fechaNac" value="${e(s.fechaNac || '')}"></label>
        </div>
        <div class="grid2">
          <label class="campo"><span>Previsión de salud</span><select name="prevision"><option value="">—</option>${K.opts(K.PREVISIONES.map((g) => [g, g]), s.prevision || '')}</select></label>
          <label class="campo"><span>Isapre u otro detalle</span><input type="text" name="previsionDetalle" maxlength="80" value="${e(s.previsionDetalle || '')}" autocomplete="off"></label>
        </div>
        <div class="grid2">
          <label class="campo"><span>Comuna donde vive</span><input type="text" name="comuna" value="${e(s.comuna || '')}" autocomplete="off"></label>
          <label class="campo"><span>Fecha de activación del seguro</span><input type="date" name="activacion" value="${e(s.activacion || pre.activacion || '')}"></label>
        </div>
        <div class="grid2">
          <label class="campo"><span>Clínica a la que asiste</span><input type="text" name="clinica" list="dl-clin" value="${e(s.clinica || '')}" autocomplete="off"><datalist id="dl-clin">${clinicasGuardadas().map((c) => `<option value="${e(c)}">`).join('')}</datalist></label>
          <label class="campo"><span>N.º de asistencia de la clínica</span><input type="text" name="nClinica" value="${e(s.nClinica || '')}" autocomplete="off"></label>
        </div>
        <div class="grid2">
          <label class="campo"><span>Ciudad o país donde ocurrió (opcional)</span><input type="text" name="pais" maxlength="80" value="${e(s.pais || pre.pais || '')}" placeholder="Ej. Viña del Mar, Chile · Asunción, Paraguay" autocomplete="off"></label>
          <label class="campo"><span>Cobertura (opcional)</span><select name="cobertura"><option value="">—</option>${K.opts(K.COBERTURAS_SEGURO.map((x) => [x, x === 'Club' ? 'Seguro del club' : 'Seguro de viaje']), s.cobertura || pre.cobertura || '')}</select></label>
        </div>
        <label class="campo"><span>N.º de póliza (opcional)</span><input type="text" name="poliza" maxlength="60" value="${e(s.poliza || '')}" autocomplete="off"></label>
        <div class="campo" data-uex><span>Exámenes que se hicieron en la urgencia (puedes agregar más de uno)</span>
          <div data-uex-filas>${exUrg.map((x) => filaUex(x)).join('')}</div>
          <button type="button" class="btn sec chico" data-uex-mas>${K.uiIco('mas', 16)} Agregar examen</button>
          <p class="suave" style="margin:4px 0 0">Cada examen queda como un evento de examen en la fecha de la activación y se cuenta en las estadísticas.</p></div>
        <p class="suave">Estos datos son privados: solo los ven los administradores y no salen en el informe.</p>`,
      botones: [
        ya ? { txt: 'Quitar', cls: 'peligro', fn: () => { K.confirmar('¿Quitar esta activación del seguro? También se borran sus eventos.', 'Quitar', () => { const evs = evsDe(ya.inf, s).map((x) => x.id); ya.inf.seguros = ya.inf.seguros.filter((x) => x.id !== s.id); ya.inf.segEventos = (ya.inf.segEventos || []).filter((x) => !evs.includes(x.id)); K.guardar(); K.aviso('Quitado'); K.render(); }); return true; } } : { txt: 'Cancelar', cls: 'sec' },
        {
          txt: 'Guardar',
          fn: (m, hoja) => {
            const d = K.datos(hoja);
            const campos = { diagnostico: (d.diagnostico || '').trim(), rut: fmtRut(d.rut), fechaNac: d.fechaNac || '', comuna: (d.comuna || '').trim(), activacion: d.activacion || '', clinica: (d.clinica || '').trim(), nClinica: (d.nClinica || '').trim(), prevision: d.prevision || '', previsionDetalle: d.prevision ? (d.previsionDetalle || '').trim() : '' };
            { const pa = (d.pais || '').trim().slice(0, 80), po = (d.poliza || '').trim().slice(0, 60); if (pa) campos.pais = pa; if (K.COBERTURAS_SEGURO.includes(d.cobertura)) campos.cobertura = d.cobertura; if (po) campos.poliza = po; }
            if (!campos.diagnostico) { K.aviso('Escribe el diagnóstico o motivo de esta activación', true); return false; }
            let act = ya ? s : null;
            if (ya) { ['pais', 'cobertura', 'poliza'].forEach((k) => { if (!(k in campos)) delete s[k]; }); Object.assign(s, campos); }
            else {
              if (!d.jid) { K.aviso('Elige un jugador', true); return false; }
              const [iid, id] = d.jid.split('|'), inf = K.state.informes.find((i) => i.id === iid);
              inf.seguros = inf.seguros || []; act = Object.assign({ id: K.uid(), jugadorId: id }, campos); inf.seguros.push(act);
            }
            // exámenes de la urgencia: uno por fila (los que ya existían se actualizan, los quitados se borran)
            { const infA = ya ? ya.inf : K.state.informes.find((i) => i.id === d.jid.split('|')[0]), fechaU = campos.activacion || K.hoy();
              infA.segEventos = infA.segEventos || [];
              const filas = Array.from(hoja.querySelectorAll('[data-uex-fila]')).map((fl) => { const v = fl.querySelector('[data-uex-sel]').value; return { id: fl.dataset.id, detalle: (v === '__otro' ? fl.querySelector('[data-uex-otro]').value : v).trim().slice(0, 80), resultado: fl.querySelector('[data-uex-res]').value.trim().slice(0, 160) }; }).filter((x) => x.detalle);
              const conservar = new Set(filas.map((x) => x.id).filter(Boolean));
              infA.segEventos = infA.segEventos.filter((x) => !(x.urg && x.seguroId === act.id && x.tipo === 'examen' && !conservar.has(x.id)));
              filas.forEach((x) => {
                const reg = x.id ? infA.segEventos.find((q) => q.id === x.id) : null;
                const base = { jugadorId: act.jugadorId, seguroId: act.id, tipo: 'examen', fecha: fechaU, detalle: x.detalle, urg: true };
                if (reg) { Object.assign(reg, base); } else infA.segEventos.push(Object.assign({ id: K.uid(), nAsist: '', cantidad: 1, hasta: '', casoId: '', notas: '' }, base, {}));
                const r2 = reg || infA.segEventos[infA.segEventos.length - 1]; if (x.resultado) r2.resultado = x.resultado; else delete r2.resultado;
              }); }
            // si la ficha del jugador no tiene estos datos, quedan guardados ahí (se escriben una sola vez)
            { const jid2 = ya ? s.jugadorId : d.jid.split('|')[1], inf2 = ya ? ya.inf : K.state.informes.find((i) => i.id === d.jid.split('|')[0]);
              if (inf2 && (campos.rut || campos.fechaNac || campos.prevision)) {
                inf2.antecedentes = inf2.antecedentes || []; let a2 = K.antecedentesDe(inf2, jid2);
                if (!a2) { a2 = { id: K.uid(), jugadorId: jid2 }; inf2.antecedentes.push(a2); }
                if (!a2.rut && campos.rut) a2.rut = campos.rut;
                if (!a2.fechaNac && campos.fechaNac) a2.fechaNac = campos.fechaNac;
                if (!a2.prevision && campos.prevision) { a2.prevision = campos.prevision; if (campos.previsionDetalle) a2.previsionDetalle = campos.previsionDetalle; }
              } }
            K.guardar(); K.aviso('Guardado'); K.render();
          }
        }
      ],
      alMontar: (m, hoja) => {
        const r = hoja.querySelector('[name=rut]'); r.addEventListener('input', () => { r.value = fmtRut(r.value); });
        const sel = hoja.querySelector('[name=jid]'), dl = hoja.querySelector('#dl-segdx'), prev = hoja.querySelector('[data-prev]');
        const alElegir = () => {
          const [iid, id] = (sel.value || '').split('|'), inf = K.state.informes.find((i) => i.id === iid); if (!inf || !id) { prev.textContent = ''; return; }
          dl.innerHTML = inf.casos.filter((c) => c.jugadorId === id && c.tipo === 'lesion').map((c) => `<option value="${e(c.titulo)}">`).join('');
          const antes = activacionesDe(inf, id).filter((x) => !ya || x.id !== s.id);
          prev.textContent = antes.length ? `Ya tiene ${antes.length} activaci${antes.length === 1 ? 'ón' : 'ones'} anterior${antes.length === 1 ? '' : 'es'}; esta es una nueva.` : '';
          if (!ya) {
            const fa = K.antecedentesDe(inf, id) || {}, u = antes.length ? antes[antes.length - 1] : {}; // primero lo de la ficha del jugador y luego la activación anterior
            const quedo = [];
            [['rut', fmtRut(fa.rut) || fmtRut(u.rut)], ['fechaNac', fa.fechaNac || u.fechaNac], ['comuna', u.comuna], ['prevision', fa.prevision || u.prevision], ['previsionDetalle', fa.prevision ? fa.previsionDetalle : u.previsionDetalle]].forEach(([n, v]) => { const el = hoja.querySelector(`[name=${n}]`); if (el && !el.value && v) { el.value = v; if (fa[n] || (n === 'rut' && fa.rut)) quedo.push(n); } });
            if (quedo.length) prev.textContent = (prev.textContent ? prev.textContent + ' ' : '') + 'RUT, nacimiento y previsión se llenaron desde la ficha del jugador.';
          }
        };
        sel.addEventListener('change', alElegir); alElegir();
        const cont = hoja.querySelector('[data-uex-filas]');
        hoja.querySelector('[data-uex-mas]').addEventListener('click', () => { cont.insertAdjacentHTML('beforeend', filaUex()); const f = cont.lastElementChild; f.querySelector('[data-uex-sel]').focus(); });
        cont.addEventListener('change', (ev) => { const x = ev.target.closest('[data-uex-sel]'); if (x) x.closest('[data-uex-fila]').querySelector('[data-uex-otro]').classList.toggle('oculto', x.value !== '__otro'); });
        cont.addEventListener('click', (ev) => { const b = ev.target.closest('[data-uex-quitar]'); if (b) b.closest('[data-uex-fila]').remove(); });
      }
    });
  }

  /* ---------- Eventos del seguro ---------- */
  function formEvento(sid, rec) {
    const r = segPorId(sid); if (!r) return;
    const inf = r.inf, jid = r.s.jugadorId, j = K.jugador(inf, jid);
    const tipo0 = rec ? rec.tipo : 'control';
    const exSug = K.EV.examen.sug, exEsta = rec && rec.tipo === 'examen' && exSug.includes(rec.detalle);
    const casos = inf.casos.filter((c) => c.jugadorId === jid).sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''));
    K.modal({
      titulo: (rec ? 'Editar evento' : 'Nuevo evento') + ' · ' + (j ? j.nombre : '') + (r.s.diagnostico ? ' · ' + r.s.diagnostico : ''),
      cuerpo: `
        <div class="grid2">
          <label class="campo"><span>Tipo de evento</span><select name="tipo">${K.opts(TIPOS, tipo0)}</select></label>
          <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${rec ? e(rec.fecha) : K.hoy()}"></label>
        </div>
        <div data-blq="examen" class="${tipo0 === 'examen' ? '' : 'oculto'}">
          <label class="campo"><span>Examen</span><select name="exSel">${K.opts(exSug.map((x) => [x, x]).concat([['__otro', 'Otro (escribir)…']]), rec && rec.tipo === 'examen' ? (exEsta ? rec.detalle : '__otro') : exSug[0])}</select></label>
          <label class="campo"><span>Resultado (opcional)</span><input type="text" name="resultado" maxlength="160" value="${e(rec ? rec.resultado || '' : '')}" placeholder="Ej. Rotura parcial de fibras, grado II" autocomplete="off"></label>
        </div>
        <div data-blq="centro" class="${tipo0 === 'control' || tipo0 === 'examen' ? '' : 'oculto'}">${K.campoLista('centro', 'Centro médico donde fue', 'centro', rec ? rec.centro : '')}${K.campoLista('medico', 'Médico con quien se vio', 'medico', rec ? rec.medico : '')}</div>
        <div data-blq="centroKine" class="${tipo0 === 'kinesiologia' ? '' : 'oculto'}">${K.campoLista('centroKine', 'Centro kinésico', 'centroKine', rec ? rec.centroKine : '')}</div>
        <label class="campo" data-blq="detalle"><span data-lbl>Detalle</span><input type="text" name="detalle" list="dl-segdet" value="${e(rec && !(rec.tipo === 'examen' && exEsta) ? rec.detalle || '' : '')}" autocomplete="off"><datalist id="dl-segdet"></datalist></label>
        <div class="grid2">
          <label class="campo"><span>N.º de asistencia del seguro</span><input type="text" name="nAsist" value="${e(rec ? rec.nAsist || '' : '')}" autocomplete="off"></label>
          <label class="campo" data-blq="cantidad"><span>Cantidad de sesiones</span><input type="number" inputmode="numeric" min="1" name="cantidad" value="${e(rec ? rec.cantidad || 1 : 1)}"></label>
        </div>
        <label class="campo oculto" data-blq="hasta"><span>Hasta (si fueron varios días)</span><input type="date" name="hasta" value="${rec ? e(rec.hasta || '') : ''}"></label>
        <label class="campo"><span>Lesión asociada (opcional)</span><select name="casoId"><option value="">—</option>${casos.map((c) => `<option value="${c.id}"${rec && rec.casoId === c.id ? ' selected' : ''}>${e(c.titulo)}${c.inicio ? ' · ' + e(fc(c.inicio)) : ''}</option>`).join('')}</select></label>
        <label class="campo"><span>Notas (opcional)</span><textarea name="notas">${e(rec ? rec.notas || '' : '')}</textarea></label>`,
      botones: [
        rec ? { txt: 'Eliminar', cls: 'peligro', fn: () => { K.confirmar('¿Eliminar este evento?', 'Eliminar', () => { inf.segEventos = inf.segEventos.filter((x) => x.id !== rec.id); K.guardar(); K.aviso('Eliminado'); K.render(); }); return true; } } : { txt: 'Cancelar', cls: 'sec' },
        {
          txt: 'Guardar',
          fn: (m, hoja) => {
            const d = K.datos(hoja), tipo = d.tipo;
            const detalle = tipo === 'examen' && d.exSel !== '__otro' ? d.exSel : (d.detalle || '').trim();
            const campos = { jugadorId: jid, seguroId: sid, tipo, fecha: d.fecha, detalle, nAsist: (d.nAsist || '').trim(), cantidad: tipo === 'kinesiologia' ? Math.max(1, Number(d.cantidad) || 1) : 1, hasta: tipo === 'hosp' ? d.hasta || '' : '', casoId: d.casoId || '', notas: d.notas };
            if (!campos.fecha) { K.aviso('Pon la fecha', true); return false; }
            inf.segEventos = inf.segEventos || [];
            const resultado = tipo === 'examen' ? (d.resultado || '').trim() : '';
            const reg = rec ? inf.segEventos.find((x) => x.id === rec.id) : Object.assign({ id: K.uid() }, campos);
            if (rec) Object.assign(reg, campos); else inf.segEventos.push(reg);
            if (resultado) reg.resultado = resultado; else delete reg.resultado;
            const dv = { centro: tipo === 'control' || tipo === 'examen' ? K.valorLista(d, 'centro') : '', medico: tipo === 'control' || tipo === 'examen' ? K.valorLista(d, 'medico') : '', centroKine: tipo === 'kinesiologia' ? K.valorLista(d, 'centroKine') : '' };
            Object.keys(dv).forEach((k) => { if (dv[k]) reg[k] = dv[k]; else delete reg[k]; });
            K.guardar(); K.aviso('Guardado'); K.render();
          }
        }
      ],
      alMontar: (m, hoja) => {
        const sel = hoja.querySelector('[name=tipo]'), q = (n) => hoja.querySelector(`[data-blq=${n}]`), exSel = hoja.querySelector('[name=exSel]');
        const lbl = hoja.querySelector('[data-lbl]'), dl = hoja.querySelector('#dl-segdet');
        const ajustar = () => {
          const t = sel.value;
          q('examen').classList.toggle('oculto', t !== 'examen');
          q('detalle').classList.toggle('oculto', t === 'examen' && exSel.value !== '__otro');
          q('cantidad').classList.toggle('oculto', t !== 'kinesiologia');
          q('centro').classList.toggle('oculto', t !== 'control' && t !== 'examen');
          q('centroKine').classList.toggle('oculto', t !== 'kinesiologia');
          q('hasta').classList.toggle('oculto', t !== 'hosp');
          lbl.textContent = t === 'control' ? 'Con quién (especialidad)' : t === 'examen' ? 'Nombre del examen' : t === 'procedimiento' ? 'Procedimiento (se guarda para sugerirlo la próxima vez)' : t === 'cirugia' ? 'Cirugía' : t === 'hosp' ? 'Motivo' : 'Detalle (opcional)';
          const sug = t === 'procedimiento' ? procGuardados() : t === 'control' ? K.EV.control.sug : [];
          dl.innerHTML = sug.map((x) => `<option value="${e(x)}">`).join('');
        };
        sel.addEventListener('change', ajustar); exSel.addEventListener('change', ajustar); ajustar();
      }
    });
  }

  /* ---------- Hospitalización sin activación del seguro (v1.9.7) ---------- */
  const hospSolas = () => todos('segEventos').filter((r) => r.x.sinAct && r.x.tipo === 'hosp');
  function formHosp(id) {
    const ya = id ? hospSolas().find((r) => r.x.id === id) : null, rec = ya ? ya.x : null;
    const js = K.kineJugadores(!!ya);
    if (!js.length) { K.aviso('Primero agrega jugadores en la pestaña Jugadores', true); return; }
    const jid = rec ? rec.jugadorId : '';
    const lista = K.itemsSelJ(js.filter((x) => !ya || x.j.id === jid).map((x) => ({ j: x.j, value: x.inf.id + '|' + x.j.id, sub: x.j.categoria || 'Sub ' + x.cat })));
    const selv = ya ? ya.inf.id + '|' + jid : '';
    K.modal({
      titulo: ya ? 'Editar hospitalización' : 'Nueva hospitalización',
      cuerpo: `
        <div class="campo"><span class="lbl-j">Jugador (nombre completo y categoría)</span>${K.selJugador('jid', { lista, sel: selv, disabled: !!ya })}</div>
        <div class="grid2">
          <label class="campo"><span>Fecha de ingreso</span><input type="date" name="fecha" value="${rec ? e(rec.fecha) : K.hoy()}"></label>
          <label class="campo"><span>Fecha de alta (si ya salió)</span><input type="date" name="hasta" value="${rec ? e(rec.hasta || '') : ''}"></label>
        </div>
        ${K.campoLista('centro', 'Centro médico donde estuvo hospitalizado', 'centro', rec ? rec.centro : '')}
        <label class="campo"><span>Diagnóstico o motivo</span><input type="text" name="detalle" maxlength="160" value="${e(rec ? rec.detalle || '' : '')}" placeholder="Ej. Fractura de tibia" autocomplete="off"></label>
        <label class="campo"><span>N.º de asistencia (opcional)</span><input type="text" name="nAsist" value="${e(rec ? rec.nAsist || '' : '')}" autocomplete="off"></label>
        <p class="suave">No necesita una activación del seguro: cuenta en los totales, en el calendario anual y en el informe del seguro.</p>`,
      botones: [
        ya ? { txt: 'Eliminar', cls: 'peligro', fn: () => { K.confirmar('¿Eliminar esta hospitalización?', 'Eliminar', () => { ya.inf.segEventos = ya.inf.segEventos.filter((x) => x.id !== rec.id); K.guardar(); K.aviso('Eliminada'); K.render(); }); return true; } } : { txt: 'Cancelar', cls: 'sec' },
        {
          txt: 'Guardar',
          fn: (m, hoja) => {
            const d = K.datos(hoja);
            if (!ya && !d.jid) { K.aviso('Elige un jugador', true); return false; }
            if (!d.fecha) { K.aviso('Pon la fecha de ingreso', true); return false; }
            if (d.hasta && d.hasta < d.fecha) { K.aviso('El alta no puede ser antes del ingreso', true); return false; }
            const campos = { tipo: 'hosp', sinAct: true, seguroId: '', fecha: d.fecha, hasta: d.hasta || '', detalle: (d.detalle || '').trim(), nAsist: (d.nAsist || '').trim(), cantidad: 1, casoId: '', notas: rec ? rec.notas || '' : '' };
            const centro = K.valorLista(d, 'centro');
            if (ya) { Object.assign(rec, campos); if (centro) rec.centro = centro; else delete rec.centro; }
            else {
              const [iid, jj] = d.jid.split('|'), inf = K.state.informes.find((i) => i.id === iid);
              const reg = Object.assign({ id: K.uid(), jugadorId: jj }, campos); if (centro) reg.centro = centro;
              inf.segEventos = inf.segEventos || []; inf.segEventos.push(reg);
            }
            K.guardar(); K.aviso('Guardado'); K.render();
          }
        }
      ]
    });
  }
  function tarjetaHosp() {
    const lista = hospSolas().sort((a, b) => (b.x.fecha || '').localeCompare(a.x.fecha || ''));
    return `<div class="card"><div class="fila sb wrap gap"><h2 style="margin:0">Hospitalizaciones sin activación <span class="suave" style="font-weight:400">(${lista.length})</span></h2><button class="btn chico" data-acc="hospNueva">${K.uiIco('mas', 16)} Nueva hospitalización</button></div>
      <p class="sub" style="margin-top:6px">Una hospitalización no necesita una activación del seguro: se registra directo (jugador, ingreso, alta, centro y diagnóstico). Cuenta en los totales, el calendario anual y el informe del seguro.</p>
      ${lista.length ? `<div class="lista">${lista.map((r) => { const x = r.x, j = K.jugador(r.inf, x.jugadorId); return `<div class="item seg-ev" data-acc="hospEditar" data-id="${x.id}"><span class="kc-pto" style="background:${TIPO_COL.hosp}"></span><div class="txt"><b>${e(j ? j.nombre : '—')}${x.detalle ? ' · ' + e(x.detalle) : ''}</b><span>${e(fc(x.fecha))}${x.hasta ? ' al ' + e(fc(x.hasta)) : ' · sin alta registrada'}${x.centro ? ' · ' + e(x.centro) : ''} · ${x.nAsist ? 'N.º asistencia ' + e(x.nAsist) : 'sin N.º de asistencia'}</span></div></div>`; }).join('')}</div>` : '<p class="vacio-msg">Aún no hay hospitalizaciones registradas aquí.</p>'}</div>`;
  }

  /* ---------- Pantalla Seguro ---------- */
  // La urgencia (la activación misma) es el primer evento de cada activación.
  const urgFila = (s) => `<div class="item seg-ev" data-acc="segEditar" data-sid="${s.id}"><span class="kc-pto" style="background:${TIPO_COL.urgencia}"></span><div class="txt"><b>Urgencia · activación del seguro${s.clinica ? ' · ' + e(s.clinica) : ''}</b><span>${s.activacion ? e(fc(s.activacion)) : 'sin fecha'} · ${s.nClinica ? 'N.º asistencia ' + e(s.nClinica) : 'sin N.º de asistencia'}</span></div></div>`;
  function tarjetaSeg(inf, s) {
    const j = K.jugador(inf, s.jugadorId); if (!j) return '';
    const evs = evsDe(inf, s).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    const abierto = !!(ss().segAbierto || {})[s.id], cat = e(j.categoria || 'Sub ' + K.kineCatDe(j, inf));
    const nEv = evs.length + 1; // la urgencia (la activación) también es un evento
    if (!abierto) return `<button type="button" class="seg-mini" data-acc="segToggle" data-sid="${s.id}" aria-expanded="false"><span class="txt"><b>${e(j.nombre)}</b><span>${cat} · ${e(s.diagnostico || 'sin diagnóstico')}</span></span><em>${nEv} evento${nEv === 1 ? '' : 's'}</em><i class="seg-flecha">${K.uiIco('abajo', 18)}</i></button>`;
    return `<div class="seg-card abierta">
      <div class="seg-cab seg-cab-t" data-acc="segToggle" data-sid="${s.id}" role="button" tabindex="0" aria-expanded="true"><div class="txt"><b>${e(j.nombre)}</b><span>${cat} · ${e(s.diagnostico || 'sin diagnóstico')}</span></div>
        <button class="btn ghost chico" data-acc="segEditar" data-sid="${s.id}">${K.uiIco('editar', 16)} Datos</button><i class="seg-flecha">${K.uiIco('arriba', 18)}</i></div>
      <dl class="seg-datos"><div style="grid-column:1/-1"><dt>Diagnóstico</dt><dd>${e(s.diagnostico || '—')}</dd></div><div><dt>RUT</dt><dd>${e(fmtRut(s.rut) || '—')}</dd></div><div><dt>Nacimiento</dt><dd>${s.fechaNac ? e(fc(s.fechaNac)) : '—'}</dd></div><div><dt>Comuna</dt><dd>${e(s.comuna || '—')}</dd></div>
        <div><dt>Activación</dt><dd>${s.activacion ? e(fc(s.activacion)) : '—'}</dd></div><div><dt>Clínica</dt><dd>${e(s.clinica || '—')}${s.nClinica ? ' · N.º ' + e(s.nClinica) : ''}</dd></div>${s.pais ? `<div><dt>País</dt><dd>${e(s.pais)}</dd></div>` : ''}${s.cobertura ? `<div><dt>Cobertura</dt><dd>${e(s.cobertura === 'Club' ? 'Seguro del club' : 'Seguro de viaje')}</dd></div>` : ''}${s.poliza ? `<div><dt>Póliza</dt><dd>${e(s.poliza)}</dd></div>` : ''}</dl>
      <div class="fila sb" style="margin:8px 0 2px"><b style="font-size:13.5px">Eventos (${nEv})</b><button class="btn chico" data-acc="segEvento" data-sid="${s.id}">${K.uiIco('mas', 16)} Evento</button></div>
      <div class="lista">${evs.map((x) => `<div class="item seg-ev" data-acc="segEvEditar" data-id="${x.id}" data-sid="${s.id}"><span class="kc-pto" style="background:${TIPO_COL[x.tipo]}"></span><div class="txt"><b>${e(TIPO_TXT[x.tipo] || x.tipo)}${x.detalle ? ' · ' + e(x.detalle) : ''}${x.tipo === 'examen' && x.resultado ? ' — ' + e(x.resultado) : ''}${x.tipo === 'kinesiologia' && (Number(x.cantidad) || 1) > 1 ? ' (' + x.cantidad + ' sesiones)' : ''}</b><span>${e(fc(x.fecha))}${x.hasta ? ' al ' + e(fc(x.hasta)) : ''}${x.centro || x.centroKine ? ' · ' + e(x.centro || x.centroKine) : ''}${x.medico ? ' · ' + e(x.medico) : ''} · ${x.nAsist ? 'N.º asistencia ' + e(x.nAsist) : 'sin N.º de asistencia'}</span></div></div>`).join('')}${urgFila(s)}</div>
    </div>`;
  }

  function estadisticas() {
    const { hbar, donut, panel, top, sumar, mensual } = K.bd;
    const s = ss(), anios = uniq(todos('segEventos').map((r) => (r.x.fecha || '').slice(0, 4))).sort();
    const f = (x) => s.segAnio === 'todo' || (x.fecha || '').slice(0, 4) === s.segAnio;
    const evs = todos('segEventos').filter((r) => f(r.x)).map((r) => r.x);
    const segs = todos('seguros'), nombre = (jid) => (K.kineBuscarJ(jid) || { j: { nombre: '—' } }).j.nombre;
    const sel = `<label class="campo" style="max-width:240px"><span>Período</span><select data-acc-change="segAnio"><option value="todo">Todo el historial</option>${anios.map((a) => `<option value="${a}"${s.segAnio === a ? ' selected' : ''}>Año ${a}</option>`).join('')}</select></label>`;
    if (!segs.length && !evs.length) return `<div class="card"><h2>Uso del seguro</h2><p class="vacio-msg">Cuando registres activaciones y eventos del seguro, aquí aparecerán las estadísticas.</p></div>`;
    const segsP = segs.filter((r) => s.segAnio === 'todo' || (r.x.activacion || '').slice(0, 4) === s.segAnio), ini = segsP.length; // urgencias (activaciones) del período
    const pool = evs.concat(segsP.map((r) => ({ tipo: 'urgencia', jugadorId: r.x.jugadorId, fecha: r.x.activacion, nAsist: r.x.nClinica }))); // la urgencia también es un evento
    const c = {}; evs.forEach((x) => sumar(c, x.tipo));
    const ses = evs.filter((x) => x.tipo === 'kinesiologia').reduce((a, x) => a + (Number(x.cantidad) || 1), 0);
    const ex = {}; evs.filter((x) => x.tipo === 'examen').forEach((x) => sumar(ex, x.detalle || 'Sin nombre'));
    const pr = {}; evs.filter((x) => x.tipo === 'procedimiento').forEach((x) => sumar(pr, x.detalle || 'Sin nombre'));
    const cl = {}; segs.forEach((r) => sumar(cl, r.x.clinica || 'Sin clínica'));
    const cat = {}; pool.forEach((x) => { const q = K.kineBuscarJ(x.jugadorId); sumar(cat, q ? 'Sub ' + q.cat : 'Sin categoría'); });
    const porJ = {}; pool.forEach((x) => sumar(porJ, nombre(x.jugadorId)));
    const sesJ = {}; evs.filter((x) => x.tipo === 'kinesiologia').forEach((x) => sumar(sesJ, nombre(x.jugadorId), Number(x.cantidad) || 1));
    const conAsist = pool.filter((x) => x.nAsist).length;
    const kpi = (n, t) => `<div class="bd-k"><b>${n}</b><span>${t}</span></div>`;
    const partes = [['Urgencia', ini, TIPO_COL.urgencia]].concat(TIPOS.map(([k, t]) => [t, c[k] || 0, TIPO_COL[k]]));
    return `<div class="card"><div class="fila sb wrap gap"><h2 style="margin:0">Uso del seguro</h2>${sel}</div>
      <div class="bd-kpis">${kpi(ini, 'Urgencias (activaciones del seguro)')}${kpi(pool.length, 'Eventos en total (urgencias incluidas)')}${kpi(evs.length, 'eventos de continuidad')}${kpi(c.control || 0, 'controles')}${kpi(c.examen || 0, 'exámenes')}${kpi(c.procedimiento || 0, 'procedimientos')}${kpi(ses, 'sesiones de kinesiología')}${kpi(c.cirugia || 0, 'cirugías')}${kpi(c.hosp || 0, 'hospitalizaciones')}</div>
      <div class="bd-g">
        ${panel('Eventos por mes', mensual(pool.map((x) => ({ f: x.fecha, cls: 'ev' }))), true)}
        ${panel('Tipo de evento', donut(partes))}
        ${panel('Por categoría', hbar(top(cat, 6), '#3b5bb5'))}
        ${panel('Exámenes más frecuentes', hbar(top(ex, 6), '#f08a24'))}
        ${panel('Procedimientos más frecuentes', hbar(top(pr, 6), '#c2479b'))}
        ${panel('Clínicas (jugadores atendidos)', hbar(top(cl, 6), '#2f7a4a'))}
        ${panel('Jugadores con más eventos', hbar(top(porJ, 8), '#2f7a4a'))}
        ${panel('Sesiones de kinesiología por jugador', hbar(top(sesJ, 8), '#14a3a3'))}
      </div>
      <p class="bd-nota">${conAsist} de ${pool.length} eventos tienen N.º de asistencia registrado.</p></div>`;
  }

  K.seguroNuevo = (pre) => formIngreso('', pre); // desde la ficha de un torneo: país, cobertura y fecha ya puestos
  K.kineSeguroHTML = function () {
    const lista = todos('seguros').map((r) => ({ inf: r.inf, s: r.x, cat: (K.kineBuscarJ(r.x.jugadorId) || { cat: 0 }).cat }))
      .sort((a, b) => b.cat - a.cat || ((K.jugador(a.inf, a.s.jugadorId) || { nombre: '' }).nombre).localeCompare((K.jugador(b.inf, b.s.jugadorId) || { nombre: '' }).nombre, 'es') || (a.s.activacion || '').localeCompare(b.s.activacion || ''));
    return `<div class="card"><div class="fila sb wrap gap"><h2 style="margin:0">Activaciones del seguro <span class="suave" style="font-weight:400">(${lista.length})</span></h2><div class="fila gap wrap"><button class="btn sec chico" data-acc="segInforme">${K.uiIco('pdf', 16)} Informe del seguro (PDF)</button><button class="btn chico" data-acc="segNuevo">${K.uiIco('mas', 16)} Nueva activación</button></div></div>
      <p class="sub" style="margin-top:6px">Cada vez que se activa el seguro de un jugador es una <b>activación</b> (con su diagnóstico, clínica y N.º de asistencia); un mismo jugador puede tener varias. Aquí van los datos que pide el seguro y los eventos (controles, exámenes, procedimientos, sesiones de kinesiología…) con su N.º de asistencia. Son privados: solo los administradores los ven.</p>
      ${lista.length ? lista.map((x) => tarjetaSeg(x.inf, x.s)).join('') : '<p class="vacio-msg">Aún no hay activaciones del seguro.</p>'}</div>
      ${tarjetaHosp()}
      ${estadisticas()}`;
  };

  /* ---------- Calendario anual de asistencia ---------- */
  const AC = {
    cirugia: ['Cirugía', '#1f2937'], hosp: ['Hospitalización', '#b3202a'], urg: ['Urgencia (seguro)', '#e0245e'], examen: ['Examen', '#f08a24'], control: ['Control', '#7b4fb8'], proc: ['Otro procedimiento', '#c2479b'],
    kineext: ['Kinesiología externa', '#14a3a3'], enf: ['Enfermedad', '#b08a5a'], rd: ['Reintegro deportivo (RD)', '#3b82e0'], sk: ['Kinesiología (SK)', '#2f9e5a'], no: ['No asistió', '#6b7570'], pauta: ['Pauta en casa', '#aeb7b2'], descanso: ['Descanso', '#dde2df'], ec: ['Entrenamiento completo', '#9ccfae']
  };
  const PRIO = ['cirugia', 'hosp', 'urg', 'examen', 'control', 'proc', 'kineext', 'rd', 'sk', 'enf', 'no', 'pauta', 'ec', 'descanso'];
  const LESION_COL = '#f6c4c8';
  function diasDe(inf, j, anio) {
    const m = {}, hoy = K.hoy();
    const mk = (iso) => (m[iso] = m[iso] || { k: new Set(), les: false, tx: [] });
    const en = (iso) => iso && iso.slice(0, 4) === String(anio);
    const poner = (iso, k, tx) => { if (!en(iso)) return; const d = mk(iso); d.k.add(k); if (tx) d.tx.push(tx); };
    inf.casos.forEach((c) => {
      if (c.jugadorId !== j.id || c.tipo !== 'lesion' || !c.inicio) return;
      const fin = c.alta || hoy;
      for (let d = c.inicio, n = 0; d <= fin && n < 800; d = suma(d, 1), n++) if (en(d)) { const x = mk(d); x.les = true; if (d === c.inicio) { x.L = true; x.tx.push('Lesión: ' + c.titulo); } }
      // Inicio del reintegro deportivo (R) y alta (A) de la lesión
      const rd = K.inicioReintegro(inf, c);
      if (rd && en(rd)) { const x = mk(rd); x.R = true; x.tx.push('Inicio del reintegro deportivo: ' + c.titulo); }
      if (c.alta && en(c.alta)) { const x = mk(c.alta); x.A = true; x.tx.push('Alta: ' + c.titulo); }
      if (c.altaMedica && c.altaMedica !== c.alta && en(c.altaMedica)) { const x = mk(c.altaMedica); x.A = true; x.tx.push('Alta médica: ' + c.titulo); }
    });
    (inf.asistencias || []).forEach((a) => {
      if (a.jugadorId !== j.id) return;
      const k = a.v === 'si' ? (a.t === 'RD' ? 'rd' : 'sk') : ({ pauta: 'pauta', descanso: 'descanso', control: 'control', examen: 'examen', procedimiento: 'proc', enfermedad: 'enf', kineparticular: 'kineext', kineseguro: 'kineext', entrenocompleto: 'ec' }[a.no] || 'no');
      poner(a.fecha, k, K.kineAsisTxt(a) + (a.centroKine ? ' · ' + a.centroKine : ''));
    });
    inf.eventos.forEach((x) => { if (x.jugadorId === j.id && K.evRealizado(x)) { if (x.tipo === 'control') poner(x.fecha, 'control', 'Control: ' + (x.nombre || '')); if (x.tipo === 'examen') poner(x.fecha, 'examen', 'Examen: ' + (x.nombre || '')); if (x.tipo === 'cirugia') poner(x.fecha, 'cirugia', 'Cirugía: ' + (x.nombre || '')); } });
    (inf.seguros || []).forEach((s) => { if (s.jugadorId === j.id && s.activacion) poner(s.activacion, 'urg', 'Urgencia: activación del seguro' + (s.diagnostico ? ' · ' + s.diagnostico : '')); });
    (inf.segEventos || []).forEach((x) => {
      if (x.jugadorId !== j.id) return;
      const k = { control: 'control', examen: 'examen', procedimiento: 'proc', kinesiologia: 'kineext', cirugia: 'cirugia', hosp: 'hosp' }[x.tipo];
      const tx = (TIPO_TXT[x.tipo] || '') + (x.detalle ? ': ' + x.detalle : '') + ' (seguro)';
      if (x.tipo === 'hosp' && x.hasta && x.hasta > x.fecha) { for (let d = x.fecha, n = 0; d <= x.hasta && n < 120; d = suma(d, 1), n++) poner(d, k, tx); } else poner(x.fecha, k, tx);
    });
    return m;
  }
  K.kineAnualHTML = function () {
    const s = K.kineEstado(), js = K.kineJugadores();
    if (!js.length) return '<div class="card"><p class="vacio-msg">Agrega jugadores para ver su calendario de asistencia.</p></div>';
    const anioAct = String(new Date().getFullYear());
    if (!s.anualAnio) s.anualAnio = (K.state.periodo && K.state.periodo.anio ? String(K.state.periodo.anio) : anioAct);
    const anio = s.anualAnio;
    // v1.9.0: el selector solo muestra a los jugadores que tuvieron alguna lesión durante el año elegido.
    const ini = anio + '-01-01', fin = anio + '-12-31';
    const conLes = js.filter((x) => x.inf.casos.some((c) => c.tipo === 'lesion' && c.jugadorId === x.j.id && c.inicio && c.inicio <= fin && (!c.alta || c.alta >= ini)));
    const aniosOp = uniq([anioAct, String(Number(anioAct) - 1), anio]).sort().reverse();
    const selAnio = `<label class="campo"><span>Año</span><select data-acc-change="anualAnio">${aniosOp.map((a) => `<option value="${a}"${a === anio ? ' selected' : ''}>${a}</option>`).join('')}</select></label>`;
    if (!conLes.length) return `<div class="card"><h2>Calendario de asistencia anual</h2><div class="grid2">${selAnio}</div><p class="vacio-msg">Ningún jugador tuvo lesiones en ${e(anio)}.</p></div>`;
    const les = K.kineLesionados().filter((it) => conLes.some((x) => x.j.id === it.j.id));
    if (!s.anualJ || !conLes.some((x) => x.j.id === s.anualJ)) s.anualJ = (les[0] ? conLes.find((x) => x.j.id === les[0].j.id) || conLes[0] : conLes[0]).j.id;
    const sel = conLes.find((x) => x.j.id === s.anualJ);
    const mapa = diasDe(sel.inf, sel.j, anio), cuenta = {}; let diasLes = 0;
    Object.keys(mapa).forEach((iso) => { const d = mapa[iso]; if (d.les) diasLes++; const k = PRIO.find((p) => d.k.has(p)); if (k) cuenta[k] = (cuenta[k] || 0) + 1; });
    const hoy = K.hoy();
    let filas = '';
    for (let mes = 1; mes <= 12; mes++) {
      const nd = new Date(Number(anio), mes, 0).getDate();
      let celdas = '';
      for (let d = 1; d <= 31; d++) {
        if (d > nd) { celdas += '<i class="ac fuera"></i>'; continue; }
        const iso = `${anio}-${K.pad(mes)}-${K.pad(d)}`, x = mapa[iso], k = x && PRIO.find((p) => x.k.has(p));
        const letra = x ? (x.L ? 'L' : x.A ? 'A' : x.R ? 'R' : '') : '';
        const fondo = letra === 'L' ? '#d62839' : letra === 'A' ? '#0b7a43' : letra === 'R' ? '#1f5fbf' : k ? AC[k][1] : x && x.les ? LESION_COL : '';
        const tit = `${K.fechaCorta(iso)}${x ? ': ' + (x.tx.length ? x.tx.join('; ') : x.les ? 'lesionado' : '') : ''}${x && x.les && k ? ' · lesionado' : ''}`;
        celdas += `<i data-adia data-j="${sel.j.id}" data-f="${iso}" class="ac${iso === hoy ? ' hoy' : ''}${k && x.les && !x.L ? ' con-les' : ''}${letra ? ' dia-' + letra : ''}"${fondo ? ` style="background:${fondo}"` : ''} title="${e(tit)}">${letra}</i>`;
      }
      filas += `<div class="ac-fila"><span>${MESES[mes - 1].slice(0, 3)}</span>${celdas}</div>`;
    }
    const ley = PRIO.map((k) => `<span><i style="background:${AC[k][1]}"></i>${AC[k][0]}${cuenta[k] ? ` <b>${cuenta[k]}</b>` : ''}</span>`).join('') + `<span><i style="background:#d62839;color:#fff;font-size:8px;font-style:normal;text-align:center;line-height:11px">L</i>Día de la lesión</span><span><i style="background:#1f5fbf;color:#fff;font-size:8px;font-style:normal;text-align:center;line-height:11px">R</i>Inicio del reintegro deportivo</span><span><i style="background:#0b7a43;color:#fff;font-size:8px;font-style:normal;text-align:center;line-height:11px">A</i>Alta</span><span><i style="background:${LESION_COL}"></i>Lesionado <b>${diasLes}</b></span>`;
    return `<div class="card"><h2>Calendario de asistencia anual</h2>
      <div class="grid2"><label class="campo"><span>Jugador</span><select data-acc-change="anualJ">${conLes.map((x) => `<option value="${x.j.id}"${x.j.id === s.anualJ ? ' selected' : ''}>${e(x.j.nombre)} · ${e(x.j.categoria || 'Sub ' + x.cat)}</option>`).join('')}</select></label>
        ${selAnio}</div>
      <label class="campo"><span>Ver o cambiar un día</span><input type="date" min="${ini}" max="${fin}" value="" data-acc-change="anualDiaSel" data-j="${sel.j.id}" aria-label="Elegir un día para ver qué pasó y cambiar la asistencia"></label>
      <div class="ac-grid"><div class="ac-fila ac-dias"><span></span>${Array.from({ length: 31 }, (_, i) => `<em>${i + 1}</em>`).join('')}</div>${filas}</div>
      <div class="ac-ley">${ley}</div>
      <p class="sub" style="margin:8px 0 0">Cada cuadro es un día. Un cuadro de color con borde rojo abajo = ese día estaba lesionado. Los cuadros vacíos son días sin registro (no se entrena). Para ver qué pasó un día y cambiar la asistencia de este jugador, <b>elige la fecha arriba</b> (en «Ver o cambiar un día») o toca su cuadro.</p></div>`;
  };

  // v1.9.6: detalle de un día del calendario anual (qué pasó) y cambio rápido de la asistencia de ese jugador
  const ASIS_OPC = () => [['', 'Sin registro (no se entrena)'], ['si:', 'Asistió (sin tipo de sesión)'], ['si:SK', 'Asistió · SK (sesión de kinesiología)'], ['si:RD:K', 'Asistió · RD (K)'], ['si:RD:KPF', 'Asistió · RD (K+PF)'], ['si:RD:KPA', 'Asistió · RD (K+PA)']]
    .concat(K.MOTIVOS_NO.map(([k, t]) => ['no:' + k, 'No asistió · ' + t]), [['no:pauta', 'Pauta para hacer en casa']]);
  const asisValor = (a) => (!a ? '' : a.v === 'si' ? 'si:' + (a.t === 'RD' ? 'RD:' + (a.sub || 'K') : a.t || '') : 'no:' + (a.no || 'noasiste'));
  function queHizo(inf, j, iso, cat) {
    const L = [], hoy = K.hoy(), nom = (id) => (K.trat(inf, id) || { nombre: id }).nombre;
    inf.casos.forEach((c) => {
      if (c.jugadorId !== j.id || !c.inicio) return;
      const tp = c.tipo === 'lesion' ? 'lesión' : 'molestia';
      if (c.inicio === iso) L.push(['Inicio de ' + tp, c.titulo]);
      else if (c.tipo === 'lesion' && c.inicio < iso && iso <= (c.alta || hoy)) L.push(['Lesionado', c.titulo]);
      if (c.alta === iso) L.push(['Alta kinésica', c.titulo]);
      if (c.altaMedica === iso && c.altaMedica !== c.alta) L.push(['Alta médica', c.titulo]);
      if (c.tipo === 'lesion' && K.inicioReintegro && K.inicioReintegro(inf, c) === iso) L.push(['Inicio del reintegro deportivo', c.titulo]);
    });
    (inf.atenciones || []).forEach((a) => {
      if (a.jugadorId !== j.id || a.fecha !== iso) return;
      const tr = Object.keys(a.trat || {}).filter((id) => a.trat[id] > 0).map((id) => `${nom(id)} ×${a.trat[id]}`).join(', ');
      const ms = (a.motSeguro || []).map((k) => (K.MOTIVOS_SEGURO.find((m) => m[0] === k) || [0, k])[1]).join(', ');
      L.push(['Atención kinésica', [K.nombreClase(a.clase), tr, ms ? 'seguro: ' + ms : ''].filter(Boolean).join(' · ') || 'sin intervenciones anotadas']);
    });
    inf.eventos.forEach((x) => { if (x.jugadorId === j.id && x.fecha === iso && K.evRealizado(x)) L.push([(K.EV[x.tipo] || { t: x.tipo }).t, (x.nombre || '') + (Number(x.cantidad) > 1 ? ' ×' + x.cantidad : '')]); });
    (inf.segEventos || []).forEach((x) => { if (x.jugadorId === j.id && (x.fecha === iso || (x.tipo === 'hosp' && x.hasta && x.fecha < iso && iso <= x.hasta))) L.push(['Seguro · ' + (TIPO_TXT[x.tipo] || x.tipo), x.detalle || '']); });
    (inf.partidos || []).forEach((p) => { if (p.fecha === iso && (p.cat === undefined || p.cat === null || String(p.cat) === String(cat) || (p.minutos && p.minutos[j.id] !== undefined))) L.push(['Partido', 'vs ' + (p.rival || '') + (p.minutos && p.minutos[j.id] ? ` · ${p.minutos[j.id]} min` : '')]); });
    return L;
  }
  function formDia(jid, iso) {
    const r = K.kineJugadores().find((x) => x.j.id === jid); if (!r) return;
    const inf = r.inf, j = r.j;
    const a = (inf.asistencias || []).find((q) => q.jugadorId === jid && q.fecha === iso), val = asisValor(a);
    const lista = queHizo(inf, j, iso, r.cat);
    K.modal({
      titulo: 'Detalle del día ' + K.fechaCorta(iso),
      cuerpo: `<p style="margin:0 0 8px"><b>${e(j.nombre)}</b></p>
        <h3 style="margin:6px 0 4px;font-size:15px">Qué pasó este día</h3>
        ${lista.length ? `<ul class="denso">${lista.map(([t, d]) => `<li><b>${e(t)}</b>${d ? ': ' + e(d) : ''}</li>`).join('')}</ul>` : '<p class="suave" style="margin:0 0 8px">Sin atenciones, controles ni eventos anotados ese día.</p>'}
        <label class="campo" style="margin-top:10px"><span>Asistencia a kinesiología ese día</span><select name="asis">${K.opts(ASIS_OPC(), val)}</select></label>
        <div data-bloque-ck class="${/^no:kine(particular|seguro)$/.test(val) ? '' : 'oculto'}">${K.campoLista('centroKine', 'Centro kinésico donde fue', 'centroKine', a ? a.centroKine : '')}</div>
        <p class="suave" style="margin:0;font-size:13px">Por ejemplo, si figura «No asiste» pero tuvo kinesiología externa, elige «No asistió · Kinesiología externa…». Los cambios se calculan solos en el informe.</p>`,
      botones: [
        { txt: '‹ Día anterior', cls: 'sec', fn: (m) => { m.cerrar(); setTimeout(() => formDia(jid, suma(iso, -1)), 230); return false; } },
        { txt: 'Día siguiente ›', cls: 'sec', fn: (m) => { m.cerrar(); setTimeout(() => formDia(jid, suma(iso, 1)), 230); return false; } },
        { txt: 'Guardar', fn: (m, hoja) => {
          const nuevo = hoja.querySelector('[name=asis]').value, ext = /^no:kine(particular|seguro)$/.test(nuevo), centro = ext ? K.valorLista(K.datos(hoja), 'centroKine') : '';
          if (nuevo === val && centro === ((a && a.centroKine) || '')) return;
          K.conDeshacer('Asistencia del ' + K.fechaCorta(iso) + ' cambiada', () => {
            inf.asistencias = inf.asistencias || [];
            const ex = inf.asistencias.find((q) => q.jugadorId === jid && q.fecha === iso);
            if (!nuevo) { if (ex) inf.asistencias.splice(inf.asistencias.indexOf(ex), 1); return; }
            const [v, t, sb] = nuevo.split(':');
            const reg = v === 'si' ? { v: 'si', t: t || '', sub: t === 'RD' ? sb || 'K' : '', no: '' } : { v: 'no', t: '', sub: '', no: t };
            if (centro) reg.centroKine = K.mayus(centro);
            if (ex) { Object.assign(ex, reg); if (!centro) delete ex.centroKine; } else inf.asistencias.push(Object.assign({ id: K.uid(), jugadorId: jid, fecha: iso }, reg));
          });
        } }
      ],
      alMontar: (m, hoja) => { const s = hoja.querySelector('[name=asis]'), b = hoja.querySelector('[data-bloque-ck]'); s.addEventListener('change', () => b.classList.toggle('oculto', !/^no:kine(particular|seguro)$/.test(s.value))); }
    });
  }
  K.diaAsistencia = formDia;
  // los cuadritos del calendario no son botones (miden 8 px y no cumplirían los 44 px táctiles): se tocan, pero lo accesible es el selector de fecha
  document.addEventListener('click', (ev) => { const c = ev.target.closest && ev.target.closest('[data-adia]'); if (c) formDia(c.dataset.j, c.dataset.f); });

  Object.assign(K.acciones, {
    anualDiaSel(el) { if (el.value) { formDia(el.dataset.j, el.value); el.value = ''; } },
    segNuevo() { formIngreso(''); },
    hospNueva() { formHosp(''); },
    hospEditar(el) { formHosp(el.dataset.id); },
    segToggle(el, ev) { if (ev && ev.target.closest('[data-acc=segEditar]')) return; const st = ss(); st.segAbierto = st.segAbierto || {}; st.segAbierto[el.dataset.sid] = !st.segAbierto[el.dataset.sid]; K.render(); },
    segEditar(el, ev) { if (ev) ev.stopPropagation(); formIngreso(el.dataset.sid); },
    segEvento(el) { formEvento(el.dataset.sid); },
    segEvEditar(el) { const r = todos('segEventos').find((q) => q.x.id === el.dataset.id); if (r) formEvento(el.dataset.sid, r.x); },
    segAnio(el) { ss().segAnio = el.value; K.render(); },
    anualJ(el) { K.kineEstado().anualJ = el.value; K.render(); },
    anualAnio(el) { K.kineEstado().anualAnio = el.value; K.render(); }
  });
})();

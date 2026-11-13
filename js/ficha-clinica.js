/* Ficha clínica del jugador (v1.6): datos clínicos de cada lesión (tejido, contacto, dolor, altas y retornos),
   antecedentes del jugador, documentos adjuntos y bloque del seguro. Antecedentes, documentos y seguro son datos privados:
   solo se ven y se editan si K.rol !== 'tecnico' (mismo criterio que el seguro). */
(function () {
  const K = window.K;
  const e = K.esc;
  const fc = (iso) => K.fechaCorta(iso);
  const D = (iso) => new Date(iso + 'T12:00:00');
  const FECHA = /^\d{4}-\d{2}-\d{2}$/;
  const dif = (a, b) => (FECHA.test(a || '') && FECHA.test(b || '') ? Math.round((D(b) - D(a)) / 864e5) : null);
  const num = (v) => (v === '' || v == null ? '' : Number(v));
  const coma = (n) => String(n).replace('.', ',');
  const mas = (arr, fn) => (arr || []).map(fn).join('');

  K.verPrivado = () => K.rol !== 'tecnico'; // antecedentes, documentos y seguro
  K.DOC_MAX = 700000;                         // largo máximo (caracteres) de la imagen ya comprimida

  // Días desde el inicio de la lesión hasta una fecha (retornoEntreno, retornoPartido…). null si falta algo.
  K.diasHasta = (c, campo) => { const n = dif(c && c.inicio, c && c[campo]); return n != null && n >= 0 ? n : null; };
  const dias = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;

  // v1.6.9: el tejido afectado puede ser más de uno. Se guarda en c.tejido como texto con las claves separadas por coma
  // ("muscular,tendon"); un solo tejido queda igual que antes.
  K.tejidosDe = (c) => String((c && c.tejido) || '').split(',').map((x) => x.trim()).filter(Boolean);
  K.tejidosTxt = (c, minus) => {
    const t = K.tejidosDe(c).map((k) => (K.TEJIDOS.find((x) => x[0] === k) || [0, k])[1]).map((x) => (minus ? x.toLowerCase() : x));
    return t.join(', ');
  };

  /* ---------- Bloque “Más detalles clínicos” (lesión) ---------- */
  const tieneClin = (c) => !!(c.tejido || c.contacto || (c.eva != null && c.eva !== '') || c.altaMedica || c.retornoEntreno || c.retornoPartido);
  K.clinico = {
    // c: la lesión (o {} si es nueva). o.sinFechas: molestia que ya pasó a lesión (esos datos viven en la lesión)
    html(c, o) {
      o = o || {}; c = c || {};
      const eva = [[0, '0 · sin dolor']].concat([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [n, String(n)]), [[10, '10 · el peor dolor']]);
      return `<details class="mas-clin" data-mas-clin${tieneClin(c) ? ' open' : ''}><summary>Más detalles clínicos</summary><div class="mas-cuerpo">
        <div class="grid2">
          <label class="campo"><span>Contacto</span><select name="contacto"><option value="">—</option>${K.opts(K.CONTACTOS, c.contacto || '')}</select></label>
          <label class="campo"><span>Dolor al inicio (EVA de 0 a 10)</span><select name="eva"><option value="">—</option>${K.opts(eva, c.eva == null ? '' : c.eva)}</select></label>
        </div>
        <div class="campo" data-tejidos><span class="lbl">Tejido afectado <span class="suave" style="font-weight:400">(puedes marcar más de uno)</span></span>
          <div class="fila wrap gap" style="gap:4px 14px">${K.TEJIDOS.map(([k, t]) => `<label class="check" style="padding:2px 0"><input type="checkbox" data-tejido="${k}"${K.tejidosDe(c).includes(k) ? ' checked' : ''}><span>${e(t)}</span></label>`).join('')}</div></div>
        ${o.sinFechas ? '' : `
        <h3 class="clin-h">Altas y retornos</h3>
        <div class="grid2">
          <label class="campo"><span>Alta médica</span><input type="date" name="altaMedica" value="${e(c.altaMedica || '')}"></label>
          <label class="campo"><span>Retorno a entrenar con el grupo</span><input type="date" name="retornoEntreno" value="${e(c.retornoEntreno || '')}"></label>
        </div>
        <label class="campo"><span>Retorno a partido</span><input type="date" name="retornoPartido" value="${e(c.retornoPartido || '')}"></label>
        <p class="calc-clin" data-calc-clin></p>`}
      </div></details>`;
    },
    // Conecta el bloque: base() devuelve { tipo, inicio, alta, semanas } con lo que hay en el formulario en ese momento.
    montar(hoja, base) {
      hoja._clinBase = base;
      if (!hoja.querySelector('[data-calc-clin]')) return;
      const alCambiar = () => K.clinico.recalcular(hoja);
      hoja.addEventListener('input', alCambiar); hoja.addEventListener('change', alCambiar);
      K.clinico.recalcular(hoja);
    },
    // Días de baja, días hasta volver a entrenar y hasta el partido.
    recalcular(hoja) {
      const out = hoja.querySelector('[data-calc-clin]');
      if (!out || !hoja._clinBase) return;
      const b = hoja._clinBase(), v = (n) => (hoja.querySelector(`[name=${n}]`) || { value: '' }).value;
      const l = [];
      if (b.tipo === 'lesion' && b.inicio) {
        const sem = b.semanas === '' || b.semanas == null ? '' : Number(b.semanas);
        const d = K.diasBajaCaso({ tipo: 'lesion', inicio: b.inicio, alta: b.alta || '', semanas: sem }, { desde: b.inicio, hasta: '2100-01-01' });
        l.push(`<b>Días de baja:</b> ${d}${b.alta ? '' : sem !== '' && !isNaN(sem) ? ' (estimados por las semanas)' : ' (en curso, hasta hoy)'}`);
      }
      const ent = dif(b.inicio, v('retornoEntreno')), par = dif(b.inicio, v('retornoPartido'));
      if (ent != null && ent >= 0) l.push(`<b>Días hasta volver a entrenar con el grupo:</b> ${ent}`);
      if (par != null && par >= 0) l.push(`<b>Días hasta el retorno a partido:</b> ${par}`);
      if ((ent != null && ent < 0) || (par != null && par < 0)) l.push('<span class="avisa">Revisa las fechas: un retorno quedó antes del inicio de la lesión.</span>');
      out.innerHTML = l.join('<br>');
      out.classList.toggle('oculto', !l.length);
    },
    // Lee el bloque. Si el formulario no tiene fechas (molestia convertida) esa parte no viene.
    leer(hoja) {
      const v = (n) => { const el = hoja.querySelector(`[name=${n}]`); return el ? el.value : ''; };
      const d = { tejido: Array.from(hoja.querySelectorAll('[data-tejido]:checked')).map((x) => x.dataset.tejido).join(','), contacto: v('contacto'), eva: v('eva'), fechas: !!hoja.querySelector('[name=altaMedica]') };
      if (d.fechas) {
        d.altaMedica = v('altaMedica'); d.retornoEntreno = v('retornoEntreno'); d.retornoPartido = v('retornoPartido');
      }
      return d;
    },
    // Pone lo leído en la lesión; lo vacío se quita (así un caso sin datos nuevos queda exactamente como antes).
    aplicar(c, d) {
      ['tejido', 'contacto'].forEach((k) => { if (d[k]) c[k] = d[k]; else delete c[k]; });
      delete c.tests; delete c.criterios; // v1.6.1: ya no existen
      if (d.eva === '' || d.eva == null) delete c.eva; else c.eva = Math.max(0, Math.min(10, Math.round(Number(d.eva))));
      if (!d.fechas) return c;
      ['altaMedica', 'retornoEntreno', 'retornoPartido'].forEach((k) => { if (d[k]) c[k] = d[k]; else delete c[k]; });
      return c;
    },
    // Filas [rótulo, valor] para el registro clínico completo (bitácora y CSV). Vacío si la lesión no tiene datos clínicos nuevos.
    detalle(c) {
      const r = [], f = (iso) => (iso ? fc(iso) : '');
      if (c.conmocion === true && K.conmocion) K.conmocion.detalleCaso(c).forEach((x) => r.push(x));
      if (c.recidiva === true) r.push(['Recidiva', 'Sí']);
      if (c.tejido) r.push([K.tejidosDe(c).length > 1 ? 'Tejidos' : 'Tejido', K.tejidosTxt(c)]);
      if (c.contacto) r.push(['Contacto', (K.CONTACTOS.find((x) => x[0] === c.contacto) || [0, c.contacto])[1]]);
      if (c.eva != null && c.eva !== '') r.push(['Dolor al inicio (EVA)', c.eva + ' / 10']);
      if (c.reintegroDesde) r.push(['Inicio del reintegro deportivo', f(c.reintegroDesde)]);
      if (c.altaMedica) r.push(['Alta médica', f(c.altaMedica)]);
      if (c.retornoEntreno) { const n = K.diasHasta(c, 'retornoEntreno'); r.push(['Retorno a entrenar con el grupo', f(c.retornoEntreno) + (n != null ? ` (${dias(n)} desde el inicio)` : '')]); }
      if (c.retornoPartido) { const n = K.diasHasta(c, 'retornoPartido'); r.push(['Retorno a partido', f(c.retornoPartido) + (n != null ? ` (${dias(n)} desde el inicio)` : '')]); }
      return r;
    },
    // Texto corto para la lista de la ficha del jugador
    resumen(c) {
      const l = [];
      if (c.conmocion === true && K.conmocion) l.push(`retorno gradual ${K.conmocion.rtpHechas(c)}/${K.conmocion.ETAPAS.length}`);
      if (c.recidiva === true) l.push('recidiva');
      const n = K.diasHasta(c, 'retornoPartido'); if (n != null) l.push(`retorno a partido en ${dias(n)}`);
      return l.join(' · ');
    }
  };

  /* ---------- Antecedentes del jugador (privado) ---------- */
  const jinf = (jid) => { const g = K.jugadorGlobal ? K.jugadorGlobal(jid) : null; return g ? g.inf : K.inf(); };
  K.antecedentesDe = (inf, jid) => (inf.antecedentes || []).find((a) => a.jugadorId === jid) || null;
  const imc = (talla, peso) => (talla > 0 && peso > 0 ? Math.round((peso / Math.pow(talla / 100, 2)) * 10) / 10 : null);
  const CAMPOS_TXT = [['alergias', 'Alergias'], ['enfermedades', 'Enfermedades'], ['medicacionHabitual', 'Medicación habitual'], ['lesionesPrevias', 'Lesiones previas (otros clubes)'], ['cirugiasPrevias', 'Cirugías previas']];
  const telHref = (t) => 'tel:' + String(t || '').replace(/[^\d+]/g, '');
  const telHTML = (t) => (t ? `<a href="${e(telHref(t))}">${e(t)}</a>` : '');
  const antVacio = (a) => !a || (!a.rut && !a.fechaNac && !a.prevision && !a.previsionRevisada && !a.grupoSanguineo && !a.apoderado && !a.telefonoApoderado && !a.contactoEmergencia && !a.telefonoEmergencia && CAMPOS_TXT.every(([k]) => !String(a[k] || '').trim()) && !(a.antropometria || []).length);
  // v1.9.7: previsión de salud. Los certificados de afiliación valen unos 2 meses: si la última revisión pasó de 60 días, se avisa.
  K.previsionTxt = (a) => (a && a.prevision ? a.prevision + (a.previsionDetalle ? ' · ' + a.previsionDetalle : '') : '');
  K.previsionEstado = function (a, hoy) {
    if (!a || !a.prevision) return null;
    hoy = hoy || K.hoy();
    if (!a.previsionRevisada) return { vencida: true, dias: null, txt: 'Previsión sin fecha de revisión: revisa el certificado de afiliación' };
    const dias = K.kineFechas.dif(a.previsionRevisada, hoy);
    return dias > 60 ? { vencida: true, dias, txt: `Previsión de salud sin revisar hace más de 2 meses (${dias} días): los certificados de afiliación vencen` } : { vencida: false, dias, txt: `Previsión revisada el ${fc(a.previsionRevisada)}` };
  };
  K.fichaClinica = {
    antecedentes(inf, j) {
      if (!K.verPrivado()) return '';
      const a = K.antecedentesDe(inf, j.id), dato = (t, v, cls) => (v ? `<div${cls ? ` class="${cls}"` : ''}><dt>${t}</dt><dd>${v}</dd></div>` : '');
      let cuerpo = '<p class="vacio-msg" style="margin:6px 0 0">Sin antecedentes registrados.</p>';
      if (!antVacio(a)) {
        const an = (a.antropometria || []).slice().sort((x, y) => (x.fecha || '').localeCompare(y.fecha || '')), u = an[an.length - 1];
        const m = u ? imc(u.talla, u.peso) : null;
        cuerpo = `<dl class="ant-datos">
          ${dato('RUT', a.rut ? e(K.formatoRut ? K.formatoRut(a.rut) : a.rut) : '')}
          ${dato('Fecha de nacimiento', a.fechaNac ? e(fc(a.fechaNac)) : '')}
          ${dato('Previsión de salud', a.prevision ? `<b>${e(K.previsionTxt(a))}</b>${(() => { const p = K.previsionEstado(a); return p ? `<br><small class="${p.vencida ? 'prev-aviso' : 'suave'}">${e(p.txt)}</small> <button type="button" class="btn ghost chico" data-acc="prevRevisada" data-id="${j.id}">Marcar como revisada hoy</button>` : ''; })()}` : '')}
          ${dato('Grupo sanguíneo', a.grupoSanguineo ? `<b>${e(a.grupoSanguineo)}</b>` : '')}
          ${dato('Alergias', String(a.alergias || '').trim() ? e(a.alergias).replace(/\n/g, '<br>') : '', 'ant-alerta')}
          ${CAMPOS_TXT.slice(1).map(([k, t]) => dato(t, String(a[k] || '').trim() ? e(a[k]).replace(/\n/g, '<br>') : '')).join('')}
          ${dato('Última medición', u ? `${u.talla !== '' ? 'Talla ' + coma(u.talla) + ' cm' : ''}${u.talla !== '' && u.peso !== '' ? ' · ' : ''}${u.peso !== '' ? 'Peso ' + coma(u.peso) + ' kg' : ''}${m ? ' · IMC ' + coma(m) : ''}${u.fecha ? ' <span class="suave">(' + fc(u.fecha) + ')</span>' : ''}${an.length > 1 ? ` <span class="suave">· ${an.length} mediciones</span>` : ''}` : '')}
          ${dato('Apoderado', a.apoderado || a.telefonoApoderado ? `${e(a.apoderado || '')}${a.apoderado && a.telefonoApoderado ? ' · ' : ''}${telHTML(a.telefonoApoderado)}` : '')}
          ${dato('Contacto de emergencia', a.contactoEmergencia || a.telefonoEmergencia ? `${e(a.contactoEmergencia || '')}${a.contactoEmergencia && a.telefonoEmergencia ? ' · ' : ''}${telHTML(a.telefonoEmergencia)}` : '')}
        </dl>`;
      }
      return `<div class="card" data-card-ant><div class="fila sb wrap gap"><h2 style="margin:0">Antecedentes</h2><button class="btn sec chico" data-acc="antEditar" data-id="${j.id}">${K.uiIco('editar', 16)} Editar</button></div>
        <p class="sub" style="margin:2px 0 6px">Datos sensibles: solo los ven los administradores. No salen en el informe.</p>${cuerpo}</div>`;
    },
    documentos(inf, j) {
      if (!K.verPrivado()) return '';
      const ds = (inf.documentos || []).filter((d) => d.jugadorId === j.id).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
      return `<div class="card" data-card-docs><div class="fila sb wrap gap"><h2 style="margin:0">Documentos <span class="suave" style="font-weight:400">(${ds.length})</span></h2><button class="btn chico" data-acc="docNuevo" data-id="${j.id}">${K.uiIco('mas', 16)} Agregar</button></div>
        <p class="sub" style="margin:2px 0 8px">Fotos de exámenes, informes médicos o consentimientos. Solo las ven los administradores.</p>
        ${ds.length ? `<div class="doc-grid">${ds.map((d) => `<button type="button" class="doc-mini" data-acc="docVer" data-id="${d.id}" aria-label="Ver ${e(d.titulo || d.tipo)}"><img src="${d.img}" alt="" loading="lazy"><b>${e(d.titulo || d.tipo)}</b><span>${e(d.tipo)}${d.fecha ? ' · ' + fc(d.fecha) : ''}</span></button>`).join('')}</div>` : '<p class="vacio-msg" style="margin:6px 0 0">Sin documentos adjuntos.</p>'}</div>`;
    },
    seguro(inf, j) {
      if (!K.verPrivado()) return '';
      const segs = (inf.seguros || []).filter((s) => s.jugadorId === j.id).sort((a, b) => (b.activacion || '').localeCompare(a.activacion || ''));
      const evs = (s) => (inf.segEventos || []).filter((x) => x.jugadorId === j.id && !x.sinAct && (x.seguroId ? x.seguroId === s.id : segs[segs.length - 1] === s)).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
      const TIPO = { control: 'Control médico', examen: 'Examen', procedimiento: 'Procedimiento', kinesiologia: 'Kinesiología', cirugia: 'Cirugía', hosp: 'Hospitalización' };
      const hs = (inf.segEventos || []).filter((x) => x.jugadorId === j.id && x.sinAct).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
      return `<div class="card" data-card-seg><div class="fila sb wrap gap"><h2 style="margin:0">Seguro <span class="suave" style="font-weight:400">(${segs.length} ${segs.length === 1 ? 'activación' : 'activaciones'})</span></h2><button class="btn sec chico" data-acc="irSeguro" data-id="${j.id}">Ir a Kine → Seguro</button></div>
        ${segs.length ? segs.map((s) => { const ev = evs(s); return `<div class="seg-fila"><b>${e(s.diagnostico || 'Sin diagnóstico')}</b><span class="suave"> · ${s.activacion ? 'activado el ' + fc(s.activacion) : 'sin fecha de activación'}${s.clinica ? ' · ' + e(s.clinica) : ''}${s.nClinica ? ' · N.º ' + e(s.nClinica) : ''}</span>
          ${ev.length ? `<ul class="vin">${ev.slice(0, 6).map((x) => `<li>${e(fc(x.fecha))} · ${e(TIPO[x.tipo] || x.tipo)}${x.detalle ? ' · ' + e(x.detalle) : ''}${x.tipo === 'examen' && x.resultado ? ' — ' + e(x.resultado) : ''}${x.nAsist ? ' <span class="suave">(N.º ' + e(x.nAsist) + ')</span>' : ''}</li>`).join('')}${ev.length > 6 ? `<li class="suave">y ${ev.length - 6} más…</li>` : ''}</ul>` : '<p class="suave" style="margin:2px 0 0">Sin eventos.</p>'}</div>`; }).join('') : '<p class="vacio-msg" style="margin:6px 0 0">Sin activaciones del seguro.</p>'}${hs.length ? `<div class="seg-fila"><b>Hospitalizaciones sin activación</b><ul class="vin">${hs.map((x) => `<li>${e(fc(x.fecha))}${x.hasta ? ' al ' + e(fc(x.hasta)) : ''}${x.detalle ? ' · ' + e(x.detalle) : ''}${x.centro ? ' · ' + e(x.centro) : ''}</li>`).join('')}</ul></div>` : ''}</div>`;
    }
  };

  /* ---------- Formulario de antecedentes ---------- */
  const filaAntro = (x) => `<div class="antro-fila"><label class="campo"><span>Fecha</span><input type="date" data-a="fecha" value="${e(x.fecha || '')}"></label>
    <label class="campo"><span>Talla (cm)</span><input type="number" inputmode="decimal" step="any" min="0" data-a="talla" value="${e(x.talla == null ? '' : x.talla)}"></label>
    <label class="campo"><span>Peso (kg)</span><input type="number" inputmode="decimal" step="any" min="0" data-a="peso" value="${e(x.peso == null ? '' : x.peso)}"></label>
    <button type="button" class="btn ghost chico" data-antro-quitar aria-label="Quitar esta medición" title="Quitar esta medición">${K.uiIco('cerrar', 16)}</button></div>`;
  K.formAntecedentes = function (jid) {
    if (!K.verPrivado()) return;
    const inf = jinf(jid), j = K.jugador(inf, jid); if (!j) return;
    const a = K.antecedentesDe(inf, jid) || {};
    K.modal({
      titulo: 'Antecedentes · ' + j.nombre,
      cuerpo: `<p class="suave" style="margin-top:0">Todo es opcional. Son datos sensibles: solo los ven los administradores.</p>
        <h3 class="clin-h">Identificación y previsión</h3>
        <div class="grid2"><label class="campo"><span>RUT</span><input type="text" name="rut" maxlength="12" value="${e(K.formatoRut ? K.formatoRut(a.rut) : a.rut || '')}" placeholder="12.345.678-9" autocomplete="off"></label>
          <label class="campo"><span>Fecha de nacimiento</span><input type="date" name="fechaNac" value="${e(a.fechaNac || '')}"></label></div>
        <div class="grid2"><label class="campo"><span>Previsión de salud</span><select name="prevision"><option value="">—</option>${K.opts(K.PREVISIONES.map((g) => [g, g]), a.prevision || '')}</select></label>
          <label class="campo"><span>Isapre u otro detalle</span><input type="text" name="previsionDetalle" maxlength="80" value="${e(a.previsionDetalle || '')}" placeholder="Ej. Colmena" autocomplete="off"></label></div>
        <label class="campo"><span>Última revisión de la previsión (certificado de afiliación)</span><input type="date" name="previsionRevisada" value="${e(a.previsionRevisada || '')}"></label>
        <p class="suave" style="margin:-4px 0 8px;font-size:13px">Si pasan más de 2 meses sin revisarla, la app avisa en la ficha del jugador. Estos datos se usan solos al activar el seguro.</p>
        <label class="campo"><span>Grupo sanguíneo</span><select name="grupoSanguineo"><option value="">—</option>${K.opts(K.GRUPOS_SANGRE.map((g) => [g, g]), a.grupoSanguineo || '')}</select></label>
        ${CAMPOS_TXT.map(([k, t]) => `<label class="campo"><span>${t}</span><textarea name="${k}" rows="2">${e(a[k] || '')}</textarea></label>`).join('')}
        <h3 class="clin-h">Apoderado y contacto</h3>
        <div class="grid2"><label class="campo"><span>Apoderado</span><input type="text" name="apoderado" maxlength="120" value="${e(a.apoderado || '')}" autocomplete="off"></label>
          <label class="campo"><span>Teléfono del apoderado</span><input type="tel" name="telefonoApoderado" maxlength="40" value="${e(a.telefonoApoderado || '')}" autocomplete="off"></label></div>
        <div class="grid2"><label class="campo"><span>Contacto de emergencia</span><input type="text" name="contactoEmergencia" maxlength="120" value="${e(a.contactoEmergencia || '')}" autocomplete="off"></label>
          <label class="campo"><span>Teléfono de emergencia</span><input type="tel" name="telefonoEmergencia" maxlength="40" value="${e(a.telefonoEmergencia || '')}" autocomplete="off"></label></div>
        <h3 class="clin-h">Talla y peso</h3>
        <div data-antro>${mas(a.antropometria, filaAntro)}</div>
        <button type="button" class="btn sec chico" data-antro-add>${K.uiIco('mas', 16)} Agregar medición</button>`,
      botones: [{ txt: 'Cancelar', cls: 'sec' }, {
        txt: 'Guardar',
        fn: (m, hoja) => {
          const d = K.datos(hoja);
          const antro = Array.from(hoja.querySelectorAll('.antro-fila')).map((f) => { const g = (n) => f.querySelector(`[data-a=${n}]`).value; return { fecha: g('fecha'), talla: num(g('talla')), peso: num(g('peso')) }; }).filter((x) => x.talla !== '' || x.peso !== '');
          const campos = { rut: K.formatoRut ? K.formatoRut(d.rut) : String(d.rut || '').trim(), fechaNac: d.fechaNac || '', prevision: d.prevision || '', previsionDetalle: d.prevision ? (d.previsionDetalle || '').trim() : '', previsionRevisada: d.prevision ? d.previsionRevisada || '' : '', grupoSanguineo: d.grupoSanguineo || '', apoderado: (d.apoderado || '').trim(), telefonoApoderado: (d.telefonoApoderado || '').trim(), contactoEmergencia: (d.contactoEmergencia || '').trim(), telefonoEmergencia: (d.telefonoEmergencia || '').trim(), antropometria: antro };
          CAMPOS_TXT.forEach(([k]) => { campos[k] = (d[k] || '').trim(); });
          inf.antecedentes = inf.antecedentes || [];
          const ya = K.antecedentesDe(inf, jid);
          if (antVacio(campos)) { if (ya) inf.antecedentes = inf.antecedentes.filter((x) => x !== ya); }
          else if (ya) Object.assign(ya, campos); else inf.antecedentes.push(Object.assign({ id: K.uid(), jugadorId: jid }, campos));
          K.guardar(); K.aviso('Antecedentes guardados'); K.render();
        }
      }],
      alMontar: (m, hoja) => {
        const rt = hoja.querySelector('[name=rut]'); if (rt && K.formatoRut) rt.addEventListener('input', () => { rt.value = K.formatoRut(rt.value); });
        hoja.addEventListener('click', (ev) => {
          if (ev.target.closest('[data-antro-add]')) { hoja.querySelector('[data-antro]').insertAdjacentHTML('beforeend', filaAntro({ fecha: K.hoy() })); }
          const q = ev.target.closest('[data-antro-quitar]'); if (q) q.closest('.antro-fila').remove();
        });
      }
    });
  };

  /* ---------- Documentos adjuntos (fotos) ---------- */
  // Reduce la imagen a un JPEG de hasta 1400 px de lado y calidad 0,72. Devuelve el data URL.
  K.docADataURL = function (file) {
    return new Promise((ok, mal) => {
      const r = new FileReader();
      r.onerror = () => mal(new Error('No se pudo leer el archivo.'));
      r.onload = () => {
        const img = new Image();
        img.onerror = () => mal(new Error('Ese archivo no es una imagen válida.'));
        img.onload = () => {
          const s = Math.min(1, 1400 / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h); // fondo blanco: un PNG transparente no queda negro
          ok(c.toDataURL('image/jpeg', 0.72));
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  };
  const casosDe = (inf, jid) => inf.casos.filter((c) => c.jugadorId === jid).sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''));
  K.formDocumento = function (jid) {
    if (!K.verPrivado()) return;
    const inf = jinf(jid), j = K.jugador(inf, jid); if (!j) return;
    let img = '';
    K.modal({
      titulo: 'Nuevo documento · ' + j.nombre,
      cuerpo: `<label class="campo"><span>Título</span><input type="text" name="titulo" maxlength="120" placeholder="Ej. RNM rodilla derecha" autocomplete="off"></label>
        <div class="grid2"><label class="campo"><span>Tipo</span><select name="tipo">${K.opts(K.TIPOS_DOC.map((t) => [t, t]), 'Examen')}</select></label>
          <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${e(K.hoy())}"></label></div>
        <label class="campo"><span>Lesión asociada (opcional)</span><select name="casoId"><option value="">— sin asociar —</option>${casosDe(inf, jid).map((c) => `<option value="${c.id}">${e(c.titulo)} (${c.tipo === 'lesion' ? 'lesión' : 'molestia'})</option>`).join('')}</select></label>
        <div class="campo"><span class="lbl">Foto o imagen del documento</span>
          <div class="fila gap wrap"><button type="button" class="btn sec chico" data-doc-cam>Tomar foto</button><button type="button" class="btn sec chico" data-doc-gal>Elegir imagen</button></div>
          <input type="file" accept="image/*" capture="environment" class="oculto" data-doc-file="cam"><input type="file" accept="image/*" class="oculto" data-doc-file="gal">
          <p class="suave" style="margin:6px 0 0;font-size:13px">Se reduce sola a un tamaño liviano (hasta 1400 px).</p>
          <div data-doc-prev></div></div>`,
      botones: [{ txt: 'Cancelar', cls: 'sec' }, {
        txt: 'Guardar',
        fn: (m, hoja) => {
          const d = K.datos(hoja);
          if (!img) { K.aviso('Primero elige o toma la foto del documento', true); return false; }
          const reg = { id: K.uid(), jugadorId: jid, fecha: d.fecha || K.hoy(), titulo: (d.titulo || '').trim() || d.tipo, tipo: d.tipo, img };
          if (d.casoId) reg.casoId = d.casoId;
          inf.documentos = inf.documentos || []; inf.documentos.push(reg);
          K.guardar(); K.aviso('Documento guardado'); K.render();
        }
      }],
      alMontar: (m, hoja) => {
        const prev = hoja.querySelector('[data-doc-prev]');
        const recibir = async (ev) => {
          const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (!f) return;
          prev.innerHTML = '<p class="suave">Preparando la imagen…</p>'; img = '';
          try {
            const url = await K.docADataURL(f);
            if (url.length > K.DOC_MAX) { prev.innerHTML = ''; K.aviso(`La imagen sigue siendo muy pesada (${Math.round(url.length / 1024)} KB, máximo ${Math.round(K.DOC_MAX / 1000)} KB). Prueba con una foto más simple o recortada.`, true); return; }
            img = url; prev.innerHTML = `<img class="doc-prev" src="${url}" alt="Vista previa"><p class="suave" style="margin:4px 0 0;font-size:13px">${Math.round(url.length / 1024)} KB</p>`;
          } catch (err) { prev.innerHTML = ''; K.aviso(err.message || 'No se pudo leer la imagen', true); }
        };
        hoja.querySelectorAll('[data-doc-file]').forEach((i) => i.addEventListener('change', recibir));
        hoja.querySelector('[data-doc-cam]').addEventListener('click', () => hoja.querySelector('[data-doc-file=cam]').click());
        hoja.querySelector('[data-doc-gal]').addEventListener('click', () => hoja.querySelector('[data-doc-file=gal]').click());
      }
    });
  };
  function verDocumento(id) {
    if (!K.verPrivado()) return;
    let inf = null, d = null;
    K.state.informes.forEach((i) => { const x = (i.documentos || []).find((q) => q.id === id); if (x) { inf = i; d = x; } });
    if (!d) return;
    const caso = d.casoId ? inf.casos.find((c) => c.id === d.casoId) : null;
    K.modal({
      titulo: d.titulo || d.tipo,
      cuerpo: `<p class="suave" style="margin:-4px 0 8px">${e(d.tipo)}${d.fecha ? ' · ' + e(fc(d.fecha)) : ''}${caso ? ' · ' + e(caso.titulo) : ''}</p><img class="doc-grande" src="${d.img}" alt="${e(d.titulo || d.tipo)}">`,
      botones: [{ txt: 'Eliminar', cls: 'peligro', fn: () => { K.confirmar('¿Eliminar este documento? No se puede deshacer.', 'Eliminar', () => { inf.documentos = inf.documentos.filter((x) => x.id !== id); K.guardar(); K.aviso('Documento eliminado'); K.render(); }); return true; } }, { txt: 'Cerrar', cls: 'sec' }]
    });
  }

  /* ---------- Acciones ---------- */
  Object.assign(K.acciones, {
    antEditar(el) { K.formAntecedentes(el.dataset.id); },
    prevRevisada(el) {
      const inf = jinf(el.dataset.id), a = inf && K.antecedentesDe(inf, el.dataset.id); if (!a) return;
      K.conDeshacer('Previsión marcada como revisada', () => { a.previsionRevisada = K.hoy(); });
    },
    docNuevo(el) { K.formDocumento(el.dataset.id); },
    docVer(el) { verDocumento(el.dataset.id); },
    irSeguro(el) {
      if (!K.verPrivado() || !K.kineEstado) return;
      const inf = jinf(el.dataset.id), s = K.kineEstado();
      s.sec = 'seguro'; s.segAbierto = s.segAbierto || {};
      (inf.seguros || []).filter((x) => x.jugadorId === el.dataset.id).forEach((x) => { s.segAbierto[x.id] = true; });
      K.ui.pantalla = 'kine'; K.render(); window.scrollTo(0, 0);
    }
  });
})();

/* Formularios de registro: atenciones, lesiones/molestias, controles, medicamentos, cirugías y ajustes manuales. */
(function () {
  const K = window.K;
  const e = K.esc;
  const hecho = (msg) => { K.guardar(); K.aviso(msg); K.refrescar && K.refrescar(); };
  const casosOpts = (inf, jid, sel) =>
    '<option value="">— sin asociar —</option>' +
    inf.casos.filter((c) => c.jugadorId === jid).sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''))
      .map((c) => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${e(c.titulo)} (${c.tipo === 'lesion' ? 'lesión' : 'molestia'})</option>`).join('');
  /* v1.9.7 · Listas que se van aprendiendo (centros médicos, médicos, centros kinésicos): una lista desplegable con lo ya usado + «Agregar nuevo…».
     K.valoresUsados(campo) junta lo escrito en todos los registros (eventos, eventos del seguro, asistencias, activaciones); K.campoLista arma el campo; K.valorLista lo lee. */
  const FUENTES_LISTA = {
    centro: [['eventos', 'centro'], ['segEventos', 'centro'], ['seguros', 'clinica']],
    medico: [['eventos', 'medico'], ['segEventos', 'medico']],
    centroKine: [['asistencias', 'centroKine'], ['segEventos', 'centroKine']]
  };
  K.valoresUsados = (campo) => {
    const m = {};
    (K.state.informes || []).forEach((inf) => (FUENTES_LISTA[campo] || []).forEach(([arr, c]) => (inf[arr] || []).forEach((x) => {
      const v = String((x && x[c]) || '').trim().replace(/\s+/g, ' '); if (!v) return;
      const k = v.toLowerCase(); m[k] = m[k] || { v, n: 0 }; m[k].n++;
    })));
    return Object.keys(m).map((k) => m[k]).sort((a, b) => b.n - a.n || a.v.localeCompare(b.v, 'es')).map((x) => x.v);
  };
  K.campoLista = (name, titulo, campo, actual, extra) => {
    const lista = K.valoresUsados(campo), act = String(actual || '').trim(), esta = !act || lista.some((x) => x.toLowerCase() === act.toLowerCase());
    const lis = esta || !act ? lista : [act].concat(lista);
    const sel = act ? (lis.find((x) => x.toLowerCase() === act.toLowerCase()) || act) : '';
    return `<div class="campo" data-lista="${name}"><label for="ls-${name}"><span>${e(titulo)}</span></label><select id="ls-${name}" name="${name}" data-lista-sel${extra ? ' ' + extra : ''}><option value="">—</option>${lis.map((x) => `<option value="${e(x)}"${x === sel ? ' selected' : ''}>${e(x)}</option>`).join('')}<option value="__otro">+ Agregar nuevo…</option></select>
      <input type="text" name="${name}__nuevo" class="oculto" maxlength="80" placeholder="Escribe el nombre y se guardará en la lista" aria-label="${e(titulo)}: nuevo" autocomplete="off" data-lista-nuevo></div>`;
  };
  K.valorLista = (d, name) => (d[name] === '__otro' ? String(d[name + '__nuevo'] || '') : String(d[name] || '')).trim().replace(/\s+/g, ' ').slice(0, 80);
  document.addEventListener('change', (ev) => {
    const s = ev.target && ev.target.closest && ev.target.closest('[data-lista-sel]'); if (!s) return;
    const n = s.closest('[data-lista]').querySelector('[data-lista-nuevo]'); n.classList.toggle('oculto', s.value !== '__otro'); if (s.value === '__otro') n.focus();
  });
  // Lesiones anteriores del mismo jugador en la misma zona (o con el mismo nombre): sirven para sugerir «recidiva».
  K.casosPrevios = (inf, c) => (inf.casos || []).filter((x) => x.id !== c.id && x.jugadorId === c.jugadorId && x.tipo === 'lesion' && (x.inicio || '') < (c.inicio || '9999')
    && ((x.zonas || []).some((z) => (c.zonas || []).includes(z)) || (x.titulo || '').trim().toLowerCase() === (c.titulo || '').trim().toLowerCase()));
  // Lesiones del jugador a las que puede estar relacionada una molestia (las que tuvo o tiene; no la que nació de esta molestia)
  K.lesionesRelacionables = (inf, c) => (inf.casos || []).filter((x) => x.tipo === 'lesion' && x.jugadorId === c.jugadorId && x.id !== c.id && x.origenId !== c.id)
    .sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''));
  // La que más se parece (misma zona o mismo nombre) y que empezó antes o el mismo día
  K.relacionSugerida = (inf, c) => K.lesionesRelacionables(inf, c).find((x) => (!c.inicio || !x.inicio || x.inicio <= c.inicio)
    && ((x.zonas || []).some((z) => (c.zonas || []).includes(z)) || (x.titulo || '').trim().toLowerCase() === (c.titulo || '').trim().toLowerCase())) || null;
  const optsRelacion = (lista, sel) => `<option value="">No, ninguna</option>` + lista.map((x) => `<option value="${e(x.id)}"${x.id === sel ? ' selected' : ''}>${e(x.titulo)} · ${e(K.fechaCorta(x.inicio))}${x.alta ? ' · alta ' + e(K.fechaCorta(x.alta)) : ' · en curso'}</option>`).join('');
  K.avisoRecidiva = (previas, marcada) => (previas.length ? `Este jugador ya tuvo ${previas.length === 1 ? 'una lesión parecida' : previas.length + ' lesiones parecidas'} (${previas.map((x) => x.titulo + ' · ' + K.fechaCorta(x.inicio)).join('; ')}). ${marcada ? 'Quedó marcada como recidiva; desmárcala si no lo es.' : '¿Es una recidiva?'}` : '');
  const quitar = (arr, id) => { const i = arr.findIndex((x) => x.id === id); if (i >= 0) arr.splice(i, 1); };
  const sinJugadores = () => { K.aviso('Primero agrega jugadores a la lista.', true); K.formLista && K.formLista(); };

  /* ---------- Atención (una sola ficha: origen, período, tipo, intervención, medicamento y comentarios) ---------- */
  K.ORIGENES = [['ssw', 'En Santiago Wanderers (entrenamiento, partido, gimnasio…)'], ['externo', 'Fuera de Santiago Wanderers (en su casa, con amigos, etc.)'], ['gira', 'En gira / torneo fuera de sede']];
  K.TEMPORADAS = [['pre', 'Pretemporada'], ['camp1', 'Campeonato · 1.er semestre'], ['camp2', 'Campeonato · 2.º semestre'], ['inter', 'Intertemporada'], ['playoff', 'Playoff']];
  K.CLASES_ATENCION = [['molestia', 'Molestia'], ['enfermedad', 'Enfermedad'], ['primeros', 'Primeros auxilios'], ['otras', 'Otras']];
  K.nombreTemporada = (v) => (K.TEMPORADAS.find((t) => t[0] === v) || [0, ''])[1];
  K.nombreClase = (v) => (K.CLASES_ATENCION.find((t) => t[0] === v) || [0, ''])[1];
  // Decisión (fase 5): lo hecho “En gira” cuenta como atención del club igual que “En Santiago Wanderers” (ningún total filtra por origen); solo va etiquetado y se separa en el Registro clínico (filtro Origen) y en la ficha del torneo.
  K.nombreOrigen = (v) => (v === 'externo' ? 'Fuera de Santiago Wanderers' : v === 'ssw' ? 'En Santiago Wanderers' : v === 'gira' ? 'En gira / torneo fuera de sede' : '');
  // Selector opcional de torneo (solo si el informe tiene torneos): para atenciones y lesiones ocurridas en un torneo.
  K.selTorneoHTML = (inf, sel, rotulo) => ((inf.torneos || []).length ? `<label class="campo"><span>${rotulo || 'Torneo (opcional)'}</span><select name="torneoId"><option value="">Ninguno</option>${(inf.torneos || []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((t) => `<option value="${K.esc(t.id)}"${t.id === sel ? ' selected' : ''}>${K.esc(t.nombre)}</option>`).join('')}</select></label>` : '');
  const temporadaPorDefecto = (fecha) => K.ui.ultTemporada || (Number((fecha || K.hoy()).slice(5, 7)) <= 6 ? 'camp1' : 'camp2');
  /* v1.9.1 · «¿En qué categoría pasó?»: solo aparece si el jugador tiene marcada alguna categoría en la que también juega.
     Sirve para entrenamientos y atenciones fuera de partido (en un partido la categoría es la del partido). Si pasó en la suya, se deja en blanco. */
  K.catJuegoCampo = () => '<label class="campo oculto" data-cat-juego><span>¿En qué categoría pasó?</span><select name="catJuego"></select><small class="suave" style="display:block;margin-top:4px">Solo aparece porque juega también en otra categoría. Si pasó en la suya, déjalo como está.</small></label>';
  // jid = jugador elegido; actual = valor guardado (al editar); oculto = true para esconderlo (varios jugadores, o un registro que viene de un partido)
  K.catJuegoSync = (hoja, jid, actual, oculto) => {
    const lab = hoja.querySelector('[data-cat-juego]'); if (!lab) return;
    const sel = lab.querySelector('select'), gl = jid && !oculto ? K.jugadorGlobal(jid) : null;
    const own = gl ? K.catNum(gl.j) : null, cur = Number(actual) || 0;
    const extras = gl ? (gl.j.tambien || []).map((x) => Number((/\d+/.exec(String(x)) || [])[0])).filter((n) => n && n !== own) : [];
    if (gl && cur && cur !== own && !extras.includes(cur)) extras.push(cur);
    const clave = (gl ? jid : '') + '|' + extras.join(',');
    if (lab.dataset.k !== clave) {
      const primera = lab.dataset.k === undefined;
      lab.dataset.k = clave;
      sel.innerHTML = extras.length ? `<option value="">${own ? 'Sub ' + own + ' (su categoría)' : 'Su categoría'}</option>` + extras.map((n) => `<option value="${n}">Sub ${n}</option>`).join('') : '';
      sel.value = primera && cur && extras.includes(cur) ? String(cur) : '';
    }
    lab.classList.toggle('oculto', !extras.length);
  };
  // undefined = el campo no está disponible (no tocar lo guardado); 0 = su categoría; N = la categoría en que pasó
  K.catJuegoValor = (hoja) => {
    const lab = hoja.querySelector('[data-cat-juego]');
    return !lab || lab.classList.contains('oculto') ? undefined : Number(lab.querySelector('select').value) || 0;
  };
  K.catJuegoAplicar = (reg, v) => { if (v === undefined) return; if (v) reg.catJuego = v; else delete reg.catJuego; };
  K.formAtencion = function (o) {
    o = o || {};
    const inf = K.inf(); const rec = o.rec;
    if (!K.vivos(inf).length) return sinJugadores();
    const jid = rec ? rec.jugadorId : o.jugadorId || '';
    // “Repetir última atención”: copia las intervenciones y el caso de la última atención de ese jugador (la fecha es la de hoy)
    let previa = null;
    if (!rec && o.repetir && jid) { previa = K.ultimaAtencion(jid); if (!previa) K.aviso('Este jugador aún no tiene atenciones para repetir', true); }
    const trat = rec ? rec.trat || {} : previa ? previa.trat || {} : o.trat || {};
    const origen = rec ? rec.origen || 'ssw' : previa ? previa.origen || 'ssw' : K.ui.ultOrigen || 'ssw';
    const clase = rec ? rec.clase || 'molestia' : previa ? previa.clase || 'molestia' : 'molestia';
    const casoActivoDe = (id) => ((id && K.casoActivo(id)) || {}).id || '';
    const casoIni = rec ? rec.casoId : o.casoId || (previa && previa.casoId && inf.casos.some((c) => c.id === previa.casoId) ? previa.casoId : '') || casoActivoDe(jid); // si el jugador tiene una lesión o molestia abierta, queda elegida (se puede cambiar)
    const usadas = K.masUsadas(inf, 5), resto = inf.tratamientos.filter((t) => !usadas.includes(t.id));
    const cont = (t) => K.contador(t.id, t.nombre, t.icono, trat[t.id] || 0);
    const lbl = (t) => `<span style="display:block;font-size:13px;font-weight:600;color:var(--suave);margin-bottom:4px">${t}</span>`;
    const masAbierto = !!rec || !!K.ui.atMas;
    const api = K.modal({
      titulo: rec ? 'Editar atención' : 'Registrar atención',
      cuerpo: `
        <div class="campo" data-bloque-j><span class="lbl-j">Jugador</span>${K.selJugador('jugadorId', { inf, sel: jid, nuevo: true, etiqueta: 'Elegir jugador' })}</div>
        <div class="grid2 fecha-varios">
          <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${e(rec ? rec.fecha : K.hoy())}"></label>
          ${rec ? '<span></span>' : '<div class="campo"><span>&nbsp;</span><button type="button" class="btn sec" data-varios>Aplicar a varios jugadores</button></div>'}
        </div>
        ${K.catJuegoCampo()}
        ${rec ? '' : K.variosHTML(inf)}
        ${rec ? '' : '<button type="button" class="btn sec oculto" data-repetir style="width:100%;margin-bottom:10px"></button>'}
        <h3 style="margin:6px 0 4px;font-size:15px">Intervención realizada</h3>
        <p class="suave" style="margin:0 0 6px">Una atención es una visita del jugador; cada intervención suma a los totales.</p>
        <div class="plant" data-plant-caja><span class="selj-et">Plantillas</span><span data-plantillas class="plant-chips"></span><button type="button" class="btn sec chico" data-plant-nueva>${K.uiIco('mas', 14)} Guardar como plantilla</button></div>
        <div class="fila gap oculto plant-form" data-plant-form><input type="text" class="grow" maxlength="40" placeholder="Nombre (ej. Post partido)" data-plant-nombre autocomplete="off"><button type="button" class="btn chico" data-plant-ok>Guardar</button><button type="button" class="btn ghost chico" data-plant-x aria-label="Cancelar">${K.uiIco('cerrar', 16)}</button></div>
        <div data-intervenciones>${usadas.length ? `<h4 class="int-tit">Más usadas</h4>${usadas.map((id) => cont(K.trat(inf, id))).join('')}<h4 class="int-tit">Otras intervenciones</h4>${resto.map(cont).join('')}` : inf.tratamientos.map(cont).join('')}</div>
        <div data-bloque-caso class="${clase === 'molestia' ? '' : 'oculto'}" style="margin-top:10px">
          <label class="campo"><span>Lesión o molestia asociada (opcional)</span><select name="casoId">${casosOpts(inf, jid, casoIni)}</select></label>
          <button type="button" class="btn sec chico" data-nuevo-caso style="margin:-4px 0 10px">${K.uiIco('mas', 16)} Registrar una lesión o molestia nueva</button>
        </div>
        ${rec ? '' : `<div class="oculto" data-bloque-med><h3 style="margin:6px 0 4px;font-size:15px">Medicamentos entregados</h3>
            <p class="suave" style="margin:0 0 6px;font-size:13px">Sale una fila por cada unidad de Farmacología (1, 2 o 3). La lista se arma con los medicamentos que ya has anotado; si es uno nuevo, elige «Otro».</p>
            <div data-med-filas></div></div>`}
        <div class="oculto" data-bloque-seg><h3 style="margin:6px 0 4px;font-size:15px">Derivaciones al seguro</h3>
          <p class="suave" style="margin:0 0 6px;font-size:13px">Una fila por cada derivación: elige el motivo (urgencia, control de continuidad, examen…).</p>
          <div data-seg-filas></div></div>
        <details class="mas-clin mas-det" data-mas${masAbierto ? ' open' : ''}><summary>Más detalles <small class="suave">(dónde se originó, período, tipo, comentarios)</small></summary><div class="mas-cuerpo">
          <div class="campo">${lbl('¿Dónde se originó lo que se atiende?')}
            ${K.seg('origen', K.ORIGENES, origen, 'v')}</div>
          ${K.selTorneoHTML(inf, rec ? rec.torneoId || '' : '')}
          <div class="grid2">
            <label class="campo"><span>Período de la temporada</span><select name="temporada">${K.opts(K.TEMPORADAS, rec ? rec.temporada || temporadaPorDefecto(rec.fecha) : temporadaPorDefecto())}</select></label>
            <label class="campo"><span>Tipo de atención</span><select name="clase">${K.opts(K.CLASES_ATENCION, clase)}</select></label>
          </div>
          <label class="campo" style="margin-top:6px"><span>Comentarios de la intervención</span><textarea name="notas">${e(rec ? rec.notas || '' : '')}</textarea></label>
        </div></details>`,
      botones: rec ? [
        { txt: 'Eliminar', cls: 'peligro', fn: () => { K.conDeshacer('Atención eliminada', () => quitar(inf.atenciones, rec.id)); } },
        { txt: 'Guardar', fn: (m, hoja) => (guardarAt(hoja, false) ? undefined : false) }
      ] : [
        { txt: 'Cancelar', cls: 'sec' },
        { txt: 'Guardar y registrar otro', cls: 'sec otro', fn: (m, hoja) => { if (guardarAt(hoja, true)) hoja._otro(); return false; } },
        { txt: 'Guardar', fn: (m, hoja) => (guardarAt(hoja, false) ? undefined : false) }
      ],
      alMontar: (m, hoja) => {
        const selj = hoja.querySelector('[data-selj]'), hid = hoja.querySelector('[name=jugadorId]'), selC = hoja.querySelector('[name=casoId]');
        const bloqueCaso = hoja.querySelector('[data-bloque-caso]'), selClase = hoja.querySelector('[name=clase]');
        const bRep = hoja.querySelector('[data-repetir]'), bv = hoja.querySelector('[data-varios]'), det = hoja.querySelector('[data-mas]');
        let enVarios = false, pendienteRepetir = !!o.repetir && !jid && !rec;
        const vm = K.variosMontar(hoja);
        hoja._vm = vm; hoja._enVarios = () => enVarios;
        det.addEventListener('toggle', () => { K.ui.atMas = det.open; });
        // lista de medicamentos: primero los que ya se han anotado, luego las sugerencias; una fila por cada unidad de Farmacología
        const listaMed = () => {
          const v = [], vis = new Set(), add = (x) => { const t = String(x || '').trim(), k = K.norm(t); if (t && !vis.has(k)) { vis.add(k); v.push(t); } };
          (inf.eventos || []).filter((x) => x.tipo === 'medicamento').map((x) => x.nombre).sort((x, y) => String(x).localeCompare(String(y), 'es')).forEach(add);
          EV.medicamento.sug.forEach(add);
          return v;
        };
        const filaMed = (n) => `<div class="grid2" data-med-fila style="align-items:start"><label class="campo"><span>Medicamento ${n}</span><select data-med-sel><option value="">Elige de la lista…</option>${listaMed().map((x) => `<option value="${e(x)}">${e(x)}</option>`).join('')}<option value="__otro">Otro (escribir)…</option></select><input type="text" data-med-otro class="oculto" placeholder="Nombre del medicamento" autocomplete="off" style="margin-top:6px"></label>
          <label class="campo"><span>Unidades / dosis</span><input type="number" inputmode="numeric" min="1" data-med-cant value="1"></label></div>`;
        const motIni = rec ? (rec.motSeguro || []) : [];
        const filaSeg = (n) => `<label class="campo" data-seg-fila><span>Motivo de la derivación ${n}</span><select data-seg-sel><option value="">Sin especificar</option>${K.MOTIVOS_SEGURO.map(([k, t]) => `<option value="${k}"${motIni[n - 1] === k ? ' selected' : ''}>${e(t)}</option>`).join('')}</select></label>`;
        const sync = () => {
          { const bs = hoja.querySelector('[data-bloque-seg]'), fs = hoja.querySelector('.contador[data-cont="seguro"] [data-n]'), n = Math.min(10, Math.max(0, Number(fs && fs.value) || 0)), cont = bs.querySelector('[data-seg-filas]');
            bs.classList.toggle('oculto', n <= 0);
            while (cont.children.length > n) cont.lastElementChild.remove();
            while (cont.children.length < n) cont.insertAdjacentHTML('beforeend', filaSeg(cont.children.length + 1)); }
          bloqueCaso.classList.toggle('oculto', selClase.value !== 'molestia' || enVarios);
          const med = hoja.querySelector('[data-bloque-med]');
          if (med) {
            const f = hoja.querySelector('.contador[data-cont="farmaco"] [data-n]'), n = Math.min(10, Math.max(0, Number(f && f.value) || 0)), cont = med.querySelector('[data-med-filas]');
            med.classList.toggle('oculto', n <= 0);
            while (cont.children.length > n) cont.lastElementChild.remove();
            while (cont.children.length < n) cont.insertAdjacentHTML('beforeend', filaMed(cont.children.length + 1));
            cont.querySelectorAll('[data-med-fila]').forEach((fl) => fl.querySelector('[data-med-otro]').classList.toggle('oculto', fl.querySelector('[data-med-sel]').value !== '__otro'));
          }
        };
        selClase.addEventListener('change', sync);
        hoja.addEventListener('click', () => setTimeout(sync, 0)); hoja.addEventListener('input', sync); hoja.addEventListener('change', sync);
        // --- contadores, repetir última y plantillas
        const poner = (t) => hoja.querySelectorAll('.contador').forEach((c) => { const n = Number(t[c.dataset.cont]) || 0; c.querySelector('[data-n]').value = n; c.classList.toggle('activo', n > 0); });
        const leer = () => { const tr = {}; hoja.querySelectorAll('.contador').forEach((c) => { const n = Number(c.querySelector('[data-n]').value) || 0; if (n > 0) tr[c.dataset.cont] = n; }); return tr; };
        const resumen = (u) => Object.keys(u.trat || {}).map((id) => { const t = K.trat(inf, id); return t ? t.nombre : ''; }).filter(Boolean).slice(0, 3).join(', ') || 'sin intervenciones';
        const actualizarRepetir = () => {
          if (!bRep) return;
          const u = hid.value && !enVarios ? K.ultimaAtencion(hid.value) : null;
          bRep.classList.toggle('oculto', !u);
          if (u) bRep.innerHTML = `${K.uiIco('copiar', 18)} <span>Repetir última atención <small>(${e(K.fechaCorta(u.fecha))} · ${e(resumen(u))})</small></span>`;
        };
        const aplicarRepetir = (u) => {
          poner(u.trat || {});
          if (u.clase) selClase.value = u.clase;
          if (u.origen) K.segSet(hoja, 'origen', u.origen);
          if (u.casoId && Array.from(selC.options).some((op) => op.value === u.casoId)) selC.value = u.casoId;
          sync(); K.aviso('Intervenciones copiadas');
        };
        if (bRep) bRep.addEventListener('click', () => { const u = K.ultimaAtencion(hid.value); if (u) aplicarRepetir(u); });
        const catJ = () => K.catJuegoSync(hoja, enVarios ? '' : hid.value, rec ? rec.catJuego : '', !!(rec && rec.partidoId));
        hid.addEventListener('change', catJ);
        hid.addEventListener('change', () => {
          selC.innerHTML = casosOpts(inf, hid.value, rec ? '' : casoActivoDe(hid.value));
          actualizarRepetir();
          if (pendienteRepetir && hid.value) { pendienteRepetir = false; const u = K.ultimaAtencion(hid.value); if (u) aplicarRepetir(u); else K.aviso('Este jugador aún no tiene atenciones para repetir', true); }
        });
        actualizarRepetir();
        const pChips = hoja.querySelector('[data-plantillas]'), pForm = hoja.querySelector('[data-plant-form]'), pNom = hoja.querySelector('[data-plant-nombre]');
        const pintarPlantillas = () => {
          const l = K.plantillas(inf);
          pChips.innerHTML = l.length ? l.map((p) => `<span class="plant-chip"><button type="button" class="plant-uso" data-plant="${e(p.id)}" title="${e(Object.keys(p.trat).map((id) => (K.trat(inf, id) || { nombre: id }).nombre + ' ×' + p.trat[id]).join(', '))}">${e(p.nombre)}</button><button type="button" class="plant-del" data-plant-del="${e(p.id)}" aria-label="Eliminar la plantilla ${e(p.nombre)}">×</button></span>`).join('') : '<span class="suave">aún no tienes</span>';
        };
        pintarPlantillas();
        hoja.addEventListener('click', (ev) => {
          const u = ev.target.closest('[data-plant]');
          if (u) { const p = K.plantillas(inf).find((x) => x.id === u.dataset.plant); if (p) { poner(p.trat); sync(); } return; }
          const d = ev.target.closest('[data-plant-del]');
          if (d) { const id = d.dataset.plantDel; K.quitarPlantilla(inf, id); pintarPlantillas(); return; }
          if (ev.target.closest('[data-plant-nueva]')) { pForm.classList.toggle('oculto'); if (!pForm.classList.contains('oculto')) pNom.focus(); return; }
          if (ev.target.closest('[data-plant-x]')) { pForm.classList.add('oculto'); return; }
          if (ev.target.closest('[data-plant-ok]')) {
            const r = K.guardarPlantilla(inf, pNom.value, leer());
            if (r.error) { K.aviso(r.error, true); return; }
            pNom.value = ''; pForm.classList.add('oculto'); pintarPlantillas(); K.aviso(r.actualizada ? 'Plantilla actualizada' : 'Plantilla guardada: aparece arriba para usarla en un toque');
          }
        });
        // --- lesión o molestia nueva
        const bn = hoja.querySelector('[data-nuevo-caso]');
        bn.addEventListener('click', () => {
          if (!hid.value) { K.aviso('Primero elige el jugador', true); return; }
          K.formCaso({ jugadorId: hid.value, tipo: 'molestia', alGuardar: (c) => { selC.innerHTML = casosOpts(inf, hid.value, c.id); } });
        });
        // --- varios jugadores
        if (bv) bv.addEventListener('click', () => {
          const l = hoja.querySelector('[data-lista-varios]'); l.classList.toggle('oculto');
          const on = !l.classList.contains('oculto'); enVarios = on;
          hoja.querySelector('[data-bloque-j]').classList.toggle('oculto', on);
          bv.textContent = on ? 'Volver a un solo jugador' : 'Aplicar a varios jugadores';
          if (!on) vm.limpiar();
          actualizarRepetir(); sync(); catJ();
        });
        // después de “Guardar y registrar otro”: queda lo que se repite (intervenciones, fecha, tipo, origen) y se limpia lo de cada jugador
        hoja._otro = () => {
          hoja.querySelector('[name=notas]').value = '';
          const mf = hoja.querySelector('[data-med-filas]'); if (mf) mf.innerHTML = '';
          const sf = hoja.querySelector('[data-seg-filas]'); if (sf) sf.innerHTML = '';
          if (enVarios) { vm.limpiar(); hoja.querySelector('.cuerpo').scrollTop = 0; } else { K.selJugadorSet(selj, '', false); selC.innerHTML = casosOpts(inf, '', ''); actualizarRepetir(); catJ(); setTimeout(() => K.selJugadorAbrir(selj), 120); }
          sync();
        };
        sync(); catJ();
        if (o.varios && bv) bv.click();
        else if (o.abrirSel && !jid && !rec) setTimeout(() => K.selJugadorAbrir(selj), 200);
      }
    });
    // Guarda la atención (uno o varios jugadores). Devuelve false si falta algo (la ventana queda abierta con el aviso).
    function guardarAt(hoja, otro) {
      const d = K.datos(hoja);
      const tr = {};
      hoja.querySelectorAll('.contador').forEach((c) => { const n = Number(c.querySelector('[data-n]').value) || 0; if (n > 0) tr[c.dataset.cont] = n; });
      const extra = hoja._vm ? hoja._vm.marcados() : [];
      const ids = extra.length ? extra : d.jugadorId ? [d.jugadorId] : [];
      if (!ids.length) { K.aviso(hoja._enVarios && hoja._enVarios() ? 'Marca al menos un jugador' : 'Elige al menos un jugador', true); return false; }
      if (!d.fecha) { K.aviso('Falta la fecha', true); return false; }
      if (!Object.keys(tr).length && !(d.notas || '').trim()) { K.aviso('Agrega al menos una intervención o escribe una nota: no se guarda una atención vacía', true); return false; }
      const meta = { origen: K.segValor(hoja, 'origen') || 'ssw', temporada: d.temporada, clase: d.clase };
      if (d.torneoId) meta.torneoId = d.torneoId; else if (rec) delete rec.torneoId;
      const cj = K.catJuegoValor(hoja); if (cj) meta.catJuego = cj; else if (cj === 0 && rec) delete rec.catJuego;
      K.ui.ultTemporada = d.temporada; K.ui.ultOrigen = meta.origen;
      const caso = () => (d.clase === 'molestia' && ids.length === 1 ? d.casoId || '' : '');
      const motSeg = tr.seguro ? Array.from(hoja.querySelectorAll('[data-seg-sel]')).map((x) => x.value).filter(Boolean).slice(0, tr.seguro) : [];
      if (motSeg.length) meta.motSeguro = motSeg; else if (rec) delete rec.motSeguro;
      const meds = tr.farmaco ? Array.from(hoja.querySelectorAll('[data-med-fila]')).map((fl) => { const s = fl.querySelector('[data-med-sel]').value; return { nombre: (s === '__otro' ? fl.querySelector('[data-med-otro]').value : s).trim(), cantidad: Math.max(1, Number(fl.querySelector('[data-med-cant]').value) || 1) }; }).filter((m) => m.nombre) : [];
      if (rec) { Object.assign(rec, meta, { fecha: d.fecha, jugadorId: ids[0], casoId: caso(), trat: tr, notas: d.notas }); delete rec.soap; }
      else {
        ids.forEach((id) => {
          inf.atenciones.push(Object.assign({ id: K.uid(), fecha: d.fecha, jugadorId: id, casoId: caso(), trat: Object.assign({}, tr), notas: d.notas }, meta));
          if (tr.farmaco) meds.forEach((m) => inf.eventos.push({ id: K.uid(), tipo: 'medicamento', fecha: d.fecha, jugadorId: id, nombre: m.nombre, cantidad: m.cantidad, casoId: caso(), notas: '' }));
        });
      }
      ids.slice().reverse().forEach((id) => K.recienteJugador(id));
      if (ids.length > 1) K.ultimoGrupo(ids);
      hecho(ids.length > 1 ? `Atención guardada para ${ids.length} jugadores` : otro ? 'Atención guardada · elige al siguiente jugador' : 'Atención guardada');
      return true;
    }
    return api;
  };

  /* ---------- Lesión / molestia ---------- */
  K.formCaso = function (o) {
    o = o || {};
    const inf = K.inf(); const rec = o.rec;
    if (!K.vivos(inf).length) return sinJugadores();
    const sel = new Set(rec ? rec.zonas || [] : []);
    let tipo = rec ? rec.tipo : o.tipo || 'lesion';
    const conv = !!(rec && rec.convertidaA); // molestia que ya pasó a lesión: esos datos viven en la lesión
    let grav = rec ? rec.gravedad || 'moderada' : 'pordefinir';
    K.modal({
      titulo: rec ? 'Editar lesión / molestia' : 'Nueva lesión o molestia',
      cuerpo: `
        <div class="fila gap wrap" style="margin-bottom:10px"><span class="${rec ? 'oculto' : ''}">${K.seg('tipo', [['lesion', 'Lesión'], ['molestia', 'Molestia']], tipo)}</span>
          ${rec ? `<b class="chip">${tipo === 'lesion' ? 'Lesión' : 'Molestia'}</b>` : ''}
          ${rec && tipo === 'molestia' && !rec.convertidaA ? '<button type="button" class="btn sec chico" data-convertir>Convertir en lesión</button>' : ''}</div>
        ${rec && rec.convertidaA && K.origenCasoTxt(rec) ? `<p class="aviso" style="margin:0 0 10px">Esta molestia ${e(K.origenCasoTxt(rec))}. Se conserva en el registro y en el informe.</p>` : ''}
        ${rec && rec.origenId && K.origenCasoTxt(rec) ? `<p class="aviso" style="margin:0 0 10px">Esta lesión ${e(K.origenCasoTxt(rec))}.</p>` : ''}
        <div class="campo"><span class="lbl-j">Jugador</span>${K.selJugador('jugadorId', { inf, sel: rec ? rec.jugadorId : o.jugadorId || '', nuevo: true })}</div>
        <label class="campo"><span>Qué es (ej. Desgarro psoas derecho)</span><input type="text" name="titulo" value="${e(rec ? rec.titulo : '')}" autocomplete="off"></label>
        <div class="campo ${conv ? 'oculto' : ''}"><span style="display:block;font-size:13px;font-weight:600;color:var(--suave);margin-bottom:4px">Gravedad (define el color en el mapa)</span>
          ${K.seg('gravedad', K.GRAV_ORDEN.map((g) => [g, K.GRAVEDADES[g]]), grav, 'g')}
          <p class="suave" style="margin:6px 0 0;font-size:13px">No limitante: duele pero no limita entrenamiento ni partido (0 días fuera) · Mínima: 1-3 días fuera · Leve: 4-7 · Moderada: 8-28 · Grave: más de 28.<span data-grav-sug></span></p></div>
        <div class="campo"><span style="display:block;font-size:13px;font-weight:600;color:var(--suave);margin-bottom:4px">Zona del cuerpo (toca una o varias)</span>
          <div class="mapa-form" data-mapa>${K.mapaCorporal({ interactivo: true })}${K.leyendaGravedad()}</div>
          <p class="suave" data-zonas-txt style="margin:6px 0 14px"></p></div>
        <label class="campo"><span>Inicio</span><input type="date" name="inicio" value="${e(rec ? rec.inicio || '' : K.hoy())}"></label>
        ${K.catJuegoCampo()}
        ${rec && rec.conmocion && K.conmocion ? K.conmocion.rtpHTML(rec) : ''}
        ${rec && rec.conmocion && K.scat5 ? `<div class="sc-casobtn">${K.scat5.botonAbrirHTML(rec)}${K.scat5.botonPdfHTML(rec)}</div>` : ''}
        <details class="mas-clin mas-det" data-mas${rec || K.ui.casoMas ? ' open' : ''}><summary>Más detalles <small class="suave">(contexto, alta, mecanismo, recidiva, notas y datos clínicos)</small></summary><div class="mas-cuerpo">
        <label class="campo"><span>Contexto (opcional, ej. post partido, golpe de balón)</span><input type="text" name="contexto" value="${e(rec ? rec.contexto || '' : '')}"></label>
        <div class="grid2">
          <label class="campo ${conv ? 'oculto' : ''}"><span>Alta kinésica (si ya volvió)</span><input type="date" name="alta" value="${e(rec ? rec.alta || '' : '')}"></label>
          <label class="campo ${conv ? 'oculto' : ''}"><span>Semanas de baja (opcional)</span><input type="number" inputmode="decimal" min="0" step="0.5" name="semanas" value="${e(rec && rec.semanas !== '' && rec.semanas != null ? rec.semanas : '')}" placeholder="auto"></label>
        </div>
        <label class="campo"><span>Ocurrió en</span><select name="mecanismo">${K.opts([['', '—']].concat(K.MECANISMOS), rec ? rec.mecanismo || '' : '')}</select></label>
        <div data-bloque-entreno class="${rec && rec.mecanismo === 'entrenamiento' ? '' : 'oculto'}">
          <label class="campo"><span>¿En qué parte del entrenamiento?</span><select name="entFase"><option value="">— elegir —</option>${K.opts(K.FASES_ENTRENO, rec ? rec.entFase || '' : '')}</select></label>
        </div>
        <div data-bloque-partido class="${rec && K.esMecPartido(rec.mecanismo) ? '' : 'oculto'}">
          <div class="grid2">
            <label class="campo"><span>Momento</span><select name="momento"><option value="">— elegir —</option>${K.opts(K.MOMENTOS_PARTIDO, rec ? rec.momento || '' : '')}</select></label>
            <label class="campo"><span>¿Tuvo que abandonar el terreno?</span><select name="abandono"><option value="">— elegir —</option>${K.opts([['si', 'Sí, salió del campo'], ['no', 'No, siguió']], rec ? rec.abandono || '' : '')}</select></label>
          </div>
        </div>
        <div data-bloque-limita class="${tipo === 'molestia' && !conv && !(rec && K.esMecPartido(rec.mecanismo)) ? '' : 'oculto'}">
          <label class="campo"><span>¿Limita el entrenamiento?</span><select name="limita">${K.opts([['no', 'No'], ['si', 'Sí']], rec && rec.limita === 'si' ? 'si' : 'no')}</select></label>
          <div class="grid2 ${rec && rec.limita === 'si' ? '' : 'oculto'}" data-limita-det>
            <label class="campo"><span>Por cuántos días</span><select name="limitaDias">${K.opts([['indef', 'Aún no definido']].concat([1, 2, 3, 4, 5, 6, 7].map((n) => [n, n === 1 ? '1 día' : n + ' días'])), rec ? (rec.limitaDias === 'indef' ? 'indef' : rec.limitaDias || 1) : 'indef')}</select></label>
            <label class="campo"><span>Qué parte limita</span><select name="limitaParte">${K.opts(K.PARTES_LIMITE, rec ? rec.limitaParte || 'fisica' : 'fisica')}</select></label>
          </div>
        </div>
        <div class="campo ${tipo === 'molestia' && !conv ? '' : 'oculto'}" data-bloque-rel><label class="campo" style="margin:0"><span>¿Está relacionada con una lesión que tuvo o tiene?</span><select name="relacionadaA" data-rel-sel>${optsRelacion(K.lesionesRelacionables(inf, { id: rec ? rec.id : '', jugadorId: rec ? rec.jugadorId : '' }), rec ? rec.relacionadaA || '' : '')}</select></label>
          <p class="aviso oculto" data-aviso-rel style="margin:4px 0 0"></p></div>
        <div class="campo" data-bloque-recidiva><label class="check" style="padding:2px 0"><input type="checkbox" name="recidiva"${rec && rec.recidiva === true ? ' checked' : ''}><span>Es una recidiva (vuelve a lesionarse en la misma zona)</span></label>
          <p class="aviso oculto" data-aviso-rec style="margin:4px 0 0"></p></div>
        ${K.selTorneoHTML(inf, rec ? rec.torneoId || '' : o.torneoId || '', 'Torneo en que ocurrió (opcional)')}
        <label class="campo"><span>Terreno de juego</span><select name="terreno"><option value="">— elegir —</option>${K.opts(K.TERRENOS.map((x) => [x, x]), rec ? rec.terreno || '' : '')}</select></label>
        <label class="campo"><span>Notas (opcional)</span><textarea name="notas">${e(rec ? rec.notas || '' : '')}</textarea></label>
        ${K.clinico.html(rec || {}, { sinFechas: conv })}
        </div></details>`,
      botones: [
        rec ? { txt: 'Eliminar', cls: 'peligro', fn: () => { K.conDeshacer('Registro eliminado (las atenciones asociadas se conservan)', () => { quitar(inf.casos, rec.id); K.state.informes.forEach((i) => i.casos.forEach((c) => { if (c.convertidaA === rec.id) delete c.convertidaA; })); inf.atenciones.forEach((a) => { if (a.casoId === rec.id) a.casoId = ''; }); }); } } : { txt: 'Cancelar', cls: 'sec' },
        {
          txt: 'Guardar',
          fn: (m, hoja) => {
            const d = K.datos(hoja);
            if (!d.jugadorId) { K.aviso('Elige un jugador', true); return false; }
            if (!d.titulo.trim()) { K.aviso('Escribe qué lesión o molestia es', true); return false; }
            const campos = {
              tipo: K.segValor(hoja, 'tipo'), jugadorId: d.jugadorId, titulo: d.titulo.trim(), contexto: d.contexto.trim(),
              gravedad: K.segValor(hoja, 'gravedad'), zonas: Array.from(sel), inicio: d.inicio, alta: d.alta,
              semanas: d.semanas === '' ? '' : Number(d.semanas), mecanismo: d.mecanismo, terreno: d.terreno, notas: d.notas,
              entFase: d.mecanismo === 'entrenamiento' ? d.entFase : '', momento: K.esMecPartido(d.mecanismo) ? d.momento : '', abandono: K.esMecPartido(d.mecanismo) ? d.abandono : ''
            };
            const esMol = campos.tipo === 'molestia' && d.limita === 'si' && !K.esMecPartido(d.mecanismo);
            campos.limita = campos.tipo === 'molestia' ? (esMol ? 'si' : 'no') : '';
            campos.limitaDias = esMol ? (d.limitaDias === 'indef' ? 'indef' : Number(d.limitaDias) || 1) : '';
            campos.limitaParte = esMol ? d.limitaParte : '';
            if (conv) Object.assign(campos, { gravedad: 'pordefinir', alta: '', semanas: '', limita: 'no', limitaDias: '', limitaParte: '' });
            let reg = rec;
            if (d.torneoId) campos.torneoId = d.torneoId;
            const cj = K.catJuegoValor(hoja); if (cj) campos.catJuego = cj;
            if (rec) { if (cj === 0) delete rec.catJuego; Object.assign(rec, campos); if (!d.torneoId) delete rec.torneoId; } else { reg = Object.assign({ id: K.uid() }, campos); inf.casos.push(reg); }
            if (campos.tipo === 'molestia' && !conv && d.relacionadaA) reg.relacionadaA = d.relacionadaA; else delete reg.relacionadaA;
            if (d.recidiva || (rec && rec.recidiva !== undefined)) reg.recidiva = !!d.recidiva; // un caso viejo sin el dato se queda igual
            K.clinico.aplicar(reg, K.clinico.leer(hoja), { sinFechas: conv });
            if (reg.conmocion && K.conmocion && hoja.querySelector('[data-cm-rtp]')) K.conmocion.rtpAplicar(reg, K.conmocion.rtpLeer(hoja));
            K.recienteJugador(d.jugadorId);
            hecho('Guardado');
            if (o.alGuardar) o.alGuardar(reg);
          }
        }
      ],
      alMontar: (m, hoja) => {
        const detC = hoja.querySelector('[data-mas]'); detC.addEventListener('toggle', () => { K.ui.casoMas = detC.open; });
        const mapa = hoja.querySelector('[data-mapa]');
        const txt = hoja.querySelector('[data-zonas-txt]');
        const pintar = () => {
          const brillo = K.COLORES_GRAVEDAD[K.segValor(hoja, 'gravedad') || 'moderada'];
          mapa.querySelectorAll('[data-zona]').forEach((p) => {
            const on = sel.has(p.dataset.zona);
            p.classList.toggle('sel', on);
            p.style.fill = on ? brillo : ''; p.style.fillOpacity = on ? '.93' : '';
          });
          txt.textContent = sel.size ? Array.from(sel).map(K.nombreZona).join(' · ') : 'Ninguna zona elegida (opcional).';
        };
        mapa.addEventListener('click', (ev) => {
          const p = ev.target.closest('[data-zona]'); if (!p) return;
          const id = p.dataset.zona;
          sel.has(id) ? sel.delete(id) : sel.add(id);
          pintar();
        });
        const bl = hoja.querySelector('[data-bloque-limita]'), det = hoja.querySelector('[data-limita-det]');
        const bEnt = hoja.querySelector('[data-bloque-entreno]'), bPar = hoja.querySelector('[data-bloque-partido]'), btnConv = hoja.querySelector('[data-convertir]');
        const sug = hoja.querySelector('[data-grav-sug]'), fi = hoja.querySelector('[name=inicio]'), fa = hoja.querySelector('[name=alta]');
        const refrescar = () => {
          const esMol = K.segValor(hoja, 'tipo') === 'molestia', mec = hoja.querySelector('[name=mecanismo]').value;
          bl.classList.toggle('oculto', !esMol || conv || K.esMecPartido(mec));
          const bRel = hoja.querySelector('[data-bloque-rel]'); if (bRel) bRel.classList.toggle('oculto', !esMol || conv);
          bEnt.classList.toggle('oculto', mec !== 'entrenamiento');
          bPar.classList.toggle('oculto', !K.esMecPartido(mec));
          const n = fi.value && fa.value ? Math.round((new Date(fa.value) - new Date(fi.value)) / 864e5) : 0;
          sug.textContent = n > 0 ? ` Con ${n} ${n === 1 ? 'día' : 'días'} fuera correspondería: ${K.GRAVEDADES[K.gravPorDias(n)]}.` : '';
        };
        hoja.addEventListener('seg', (ev) => {
          if (ev.target.dataset.seg === 'tipo' && !rec) K.segSet(hoja, 'gravedad', 'pordefinir');
          refrescar(); pintar();
        });
        hoja.querySelector('[name=mecanismo]').addEventListener('change', refrescar);
        fi.addEventListener('change', refrescar); fa.addEventListener('change', refrescar);
        if (btnConv) btnConv.addEventListener('click', () => { K.cerrarUltimoModal(); setTimeout(() => K.convertirALesion(rec, o, inf), 60); });
        // recidiva: se sugiere (y en una lesión nueva se marca sola) si ya hubo una lesión parecida del mismo jugador
        const chkRec = hoja.querySelector('[name=recidiva]'), avRec = hoja.querySelector('[data-aviso-rec]'), selJug = hoja.querySelector('[name=jugadorId]'), inTit = hoja.querySelector('[name=titulo]');
        let tocada = false; chkRec.addEventListener('change', () => { tocada = true; avisarRec(); });
        const previasAhora = () => K.casosPrevios(inf, { id: rec ? rec.id : '', jugadorId: selJug.value, inicio: fi.value, zonas: Array.from(sel), titulo: inTit.value });
        function avisarRec() { const pv = previasAhora(); avRec.textContent = K.avisoRecidiva(pv, chkRec.checked); avRec.classList.toggle('oculto', !pv.length); return pv; }
        const sugerirRec = () => { const pv = previasAhora(); if (!rec && !tocada) chkRec.checked = pv.length > 0; avisarRec(); };
        [selJug, inTit, fi].forEach((x) => { x.addEventListener('change', sugerirRec); x.addEventListener('input', sugerirRec); });
        const catJ = () => K.catJuegoSync(hoja, selJug.value, rec ? rec.catJuego : o.catJuego || '', !!(rec && rec.partidoId));
        selJug.addEventListener('change', catJ); catJ();
        mapa.addEventListener('click', () => setTimeout(sugerirRec, 0));
        // relación con una lesión: se llenan las lesiones del jugador elegido y, en una molestia nueva, se sugiere la parecida
        const selRel = hoja.querySelector('[data-rel-sel]'), avRel = hoja.querySelector('[data-aviso-rel]');
        let relTocada = false; selRel.addEventListener('change', () => { relTocada = true; avisarRel(); });
        const datosAhora = () => ({ id: rec ? rec.id : '', jugadorId: selJug.value, inicio: fi.value, zonas: Array.from(sel), titulo: inTit.value });
        function avisarRel() {
          const sg = K.relacionSugerida(inf, datosAhora());
          avRel.textContent = sg && selRel.value === sg.id ? `Parece relacionada con «${sg.titulo}» (${K.fechaCorta(sg.inicio)}): misma zona o mismo nombre. Cámbiala si no lo está.` : '';
          avRel.classList.toggle('oculto', !avRel.textContent);
        }
        const llenarRel = () => {
          const d0 = datosAhora(), lista = K.lesionesRelacionables(inf, d0), sg = K.relacionSugerida(inf, d0);
          // molestia nueva sin tocar: sigue a la sugerida; molestia guardada o ya tocada: conserva lo elegido mientras siga siendo del jugador
          const quiere = !rec && !relTocada ? (sg ? sg.id : '') : selRel.value;
          selRel.innerHTML = optsRelacion(lista, lista.some((x) => x.id === quiere) ? quiere : '');
          avisarRel();
        };
        [selJug, inTit, fi].forEach((x) => { x.addEventListener('change', llenarRel); });
        mapa.addEventListener('click', () => setTimeout(llenarRel, 0));
        llenarRel();
        sugerirRec();
        K.clinico.montar(hoja, () => ({ tipo: K.segValor(hoja, 'tipo') || 'lesion', inicio: fi.value, alta: fa.value, semanas: hoja.querySelector('[name=semanas]').value }));
        if (K.conmocion && hoja.querySelector('[data-cm-rtp]')) K.conmocion.rtpMontar(hoja);
        if (K.scat5 && rec && rec.conmocion) K.scat5.montarCaso(hoja, rec);
        hoja.addEventListener('seg', () => K.clinico.recalcular(hoja));
        refrescar();
        hoja.querySelector('[name=limita]').addEventListener('change', (ev) => det.classList.toggle('oculto', ev.target.value !== 'si'));
        pintar();
      }
    });
  };
  // Molestia → lesión: la molestia se conserva (con lo que se hizo ese día) y se crea una lesión con el diagnóstico.
  K.convertirALesion = function (m, o, inf0) {
    const inf = inf0 || K.inf();
    K.modal({
      titulo: 'Convertir en lesión',
      cuerpo: `<p class="suave" style="margin-top:0">La molestia <b>${e(m.titulo)}</b> se queda registrada tal como está. Se crea una lesión nueva con los mismos datos y el diagnóstico que escribas; en el informe se verá que la molestia terminó siendo esa lesión.</p>
        <label class="campo"><span>Diagnóstico de la lesión (ej. Esguince acromioclavicular)</span><input type="text" name="titulo" autocomplete="off"></label>
        <div class="campo"><span style="display:block;font-size:13px;font-weight:600;color:var(--suave);margin-bottom:4px">Gravedad</span>${K.seg('gravedad', K.GRAV_ORDEN.map((g) => [g, K.GRAVEDADES[g]]), 'pordefinir', 'g')}</div>
        <div class="grid2"><label class="campo"><span>Inicio de la lesión</span><input type="date" name="inicio" value="${e(m.inicio || K.hoy())}"></label>
          <label class="campo"><span>Semanas de baja (opcional)</span><input type="number" inputmode="decimal" min="0" step="0.5" name="semanas" placeholder="auto"></label></div>`,
      botones: [{ txt: 'Cancelar', cls: 'sec' }, {
        txt: 'Crear lesión',
        fn: (mm, hoja) => {
          const d = K.datos(hoja);
          if (!d.titulo.trim()) { K.aviso('Escribe el diagnóstico', true); return false; }
          const l = {
            id: K.uid(), jugadorId: m.jugadorId, tipo: 'lesion', titulo: d.titulo.trim(), contexto: m.contexto || '', gravedad: K.segValor(hoja, 'gravedad') || 'pordefinir',
            zonas: (m.zonas || []).slice(), inicio: d.inicio || m.inicio || K.hoy(), alta: '', semanas: d.semanas === '' ? '' : Number(d.semanas), mecanismo: m.mecanismo || '', terreno: m.terreno || '',
            entFase: m.entFase || '', momento: m.momento || '', abandono: m.abandono || '', notas: m.notas || '', limita: '', limitaDias: '', limitaParte: '', origenId: m.id
          };
          if (m.catJuego) l.catJuego = m.catJuego;
          if (m.partidoId) l.partidoId = m.partidoId;
          inf.casos.push(l); m.convertidaA = l.id;
          Object.assign(m, { gravedad: 'pordefinir', alta: '', semanas: '', limita: 'no', limitaDias: '', limitaParte: '' }); // esos datos pasan a la lesión
          K.guardar(); K.aviso('Lesión creada. La molestia se conserva'); K.render();
          if (o && o.alGuardar) o.alGuardar(l);
        }
      }]
    });
  };
  K.segSet = (raiz, name, v) => raiz.querySelectorAll(`[data-seg="${name}"] button`).forEach((b) => b.classList.toggle('act', b.dataset.v === v));

  /* ---------- Controles, exámenes, medicamentos, cirugías ---------- */
  const EV = {
    control: { t: 'Control', sug: ['Traumatólogo', 'Médico del club', 'Nutricionista', 'Psicólogo', 'Kinesiología externa', 'Fisiatra', 'Cardiólogo', 'Neurólogo', 'Podólogo'], ph: 'Ej. Traumatólogo' },
    examen: { t: 'Examen', sug: ['Radiografía', 'RNM', 'Ecografía', 'TAC', 'Examen de sangre'], ph: 'Ej. Radiografía' },
    procedimiento: { t: 'Procedimiento', sug: ['Ondas de choque', 'Plasma rico en plaquetas (PRP)', 'Infiltración', 'Ácido hialurónico', 'Láser de alta potencia'], ph: 'Ej. Ondas de choque' },
    medicamento: { t: 'Medicamento', sug: ['Ibuprofeno', 'Paracetamol', 'Diclofenaco', 'Naproxeno'], ph: 'Ej. Ibuprofeno' },
    cirugia: { t: 'Cirugía', sug: [], ph: 'Ej. Meniscectomía' }
  };
  K.EV = EV;
  // v1.9.4: la etiqueta de un control en el historial es el tipo de control elegido (Nutricionista, Kinesiología externa…); sin tipo dice «Control».
  K.ctlEtiqueta = function (nombre) {
    const n = String(nombre || '').trim().replace(/\s+/g, ' ');
    if (!n) return 'Control';
    if (/^kinesi[oó]logo[s]? externo[s]?$/i.test(n)) return 'Kinesiología externa';
    return n.charAt(0).toUpperCase() + n.slice(1);
  };
  K.formEvento = function (tipo, o) {
    o = o || {};
    const inf = K.inf(); const rec = o.rec; tipo = rec ? rec.tipo : tipo;
    if (!K.vivos(inf).length) return sinJugadores();
    const def = EV[tipo];
    const jid = rec ? rec.jugadorId : o.jugadorId || '';
    K.modal({
      titulo: (rec ? 'Editar ' : 'Nuevo registro: ') + def.t.toLowerCase(),
      cuerpo: `
        <div class="grid2">
          <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${e(rec ? rec.fecha : K.hoy())}"></label>
          <div class="campo"><span class="lbl-j">Jugador</span>${K.selJugador('jugadorId', { inf, sel: jid, nuevo: true })}</div>
        </div>
        <label class="campo"><span>${tipo === 'control' ? 'Tipo de control (con quién)' : tipo === 'examen' ? 'Tipo de examen' : tipo === 'procedimiento' ? 'Procedimiento' : tipo === 'medicamento' ? 'Medicamento' : 'Cirugía'}</span>
          <input type="text" name="nombre" list="dl-ev" value="${e(rec ? rec.nombre || '' : '')}" placeholder="${def.ph}" autocomplete="off">
          <datalist id="dl-ev">${def.sug.map((s) => `<option value="${e(s)}">`).join('')}</datalist></label>
        ${tipo === 'examen' ? `<label class="campo"><span>Resultado (opcional)</span><input type="text" name="resultado" maxlength="160" value="${e(rec ? rec.resultado || '' : '')}" placeholder="Ej. Rotura parcial de fibras, grado II" autocomplete="off"></label>` : ''}
        ${tipo === 'control' || tipo === 'examen' ? K.campoLista('centro', 'Centro médico donde fue', 'centro', rec ? rec.centro : '') + K.campoLista('medico', tipo === 'control' ? 'Médico con quien se vio' : 'Médico que lo vio o lo pidió', 'medico', rec ? rec.medico : '') : ''}
        ${tipo === 'cirugia' ? '' : `<label class="campo"><span>${tipo === 'medicamento' ? 'Unidades / dosis entregadas' : tipo === 'procedimiento' ? 'Sesiones' : 'Cantidad'}</span><input type="number" inputmode="numeric" min="1" name="cantidad" value="${e(rec ? rec.cantidad || 1 : 1)}"></label>`}
        <label class="campo"><span>Lesión o molestia asociada (opcional)</span><select name="casoId">${casosOpts(inf, jid, rec ? rec.casoId : o.casoId || ((K.casoActivo(jid) || {}).id || ''))}</select></label>
        ${tipo === 'medicamento' && !rec ? '<p class="suave" style="font-size:13px;margin:0 0 8px">Al guardar, cuenta también como 1 atención con Farmacología (1 intervención).</p>' : ''}
        <label class="campo"><span>Notas (opcional)</span><textarea name="notas">${e(rec ? rec.notas || '' : '')}</textarea></label>`,
      botones: [
        rec ? { txt: 'Eliminar', cls: 'peligro', fn: () => { K.conDeshacer('Registro eliminado', () => { quitar(inf.eventos, rec.id); inf.atenciones.filter((a) => a.evMed === rec.id).forEach((a) => quitar(inf.atenciones, a.id)); }); } } : { txt: 'Cancelar', cls: 'sec' },
        {
          txt: 'Guardar',
          fn: (m, hoja) => {
            const d = K.datos(hoja);
            if (!d.jugadorId) { K.aviso('Elige un jugador', true); return false; }
            const campos = { tipo, fecha: d.fecha, jugadorId: d.jugadorId, nombre: (d.nombre || '').trim(), cantidad: tipo === 'cirugia' ? 1 : Math.max(1, Number(d.cantidad) || 1), casoId: d.casoId || '', notas: d.notas };
            const resultado = tipo === 'examen' ? (d.resultado || '').trim() : '';
            const centro = tipo === 'control' || tipo === 'examen' ? K.valorLista(d, 'centro') : '', medico = tipo === 'control' || tipo === 'examen' ? K.valorLista(d, 'medico') : '';
            const reg = rec || Object.assign({ id: K.uid() }, campos);
            if (rec) Object.assign(rec, campos); else inf.eventos.push(reg);
            // v1.9.6: un medicamento registrado solo cuenta también como 1 atención con Farmacología (así suma igual que desde «Atención»)
            if (tipo === 'medicamento') {
              const lig = inf.atenciones.find((a) => a.evMed === reg.id);
              if (lig) Object.assign(lig, { fecha: d.fecha, jugadorId: d.jugadorId, casoId: d.casoId || '' });
              else if (!rec) inf.atenciones.push({ id: K.uid(), fecha: d.fecha, jugadorId: d.jugadorId, casoId: d.casoId || '', trat: { farmaco: 1 }, notas: '', clase: 'otras', origen: 'ssw', temporada: temporadaPorDefecto(d.fecha), evMed: reg.id });
            }
            K.recienteJugador(d.jugadorId);
            if (resultado) reg.resultado = resultado; else delete reg.resultado;
            if (centro) reg.centro = centro; else delete reg.centro;
            if (medico) reg.medico = medico; else delete reg.medico;
            hecho('Guardado');
          }
        }
      ],
      alMontar: (m, hoja) => {
        const selJ = hoja.querySelector('[name=jugadorId]'), selC = hoja.querySelector('[name=casoId]');
        selJ.addEventListener('change', () => { selC.innerHTML = casosOpts(inf, selJ.value, rec ? '' : (K.casoActivo(selJ.value) || {}).id || ''); });
      }
    });
  };

  /* ---------- Ajuste manual de un indicador ---------- */
  K.formManual = function (o) {
    o = o || {};
    const inf = K.inf(); const rec = o.rec;
    K.modal({
      titulo: rec ? 'Editar ajuste manual' : 'Ajuste manual',
      cuerpo: `
        <p class="suave">Suma (o resta, con número negativo) al total que se calcula solo. Úsalo para datos que no registraste atención por atención.</p>
        <label class="campo"><span>Indicador</span><select name="indId">${K.opts(inf.indicadores.map((i) => [i.id, i.nombre]), rec ? rec.indId : o.indId || '')}</select></label>
        <div class="grid2">
          <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${e(rec ? rec.fecha : o.fecha || K.hoy())}"></label>
          <label class="campo"><span>Cantidad</span><input type="number" inputmode="numeric" name="cantidad" value="${e(rec ? rec.cantidad : 1)}"></label>
        </div>
        <label class="campo"><span>Nota (opcional)</span><input type="text" name="nota" value="${e(rec ? rec.nota || '' : '')}"></label>`,
      botones: [
        rec ? { txt: 'Eliminar', cls: 'peligro', fn: () => { quitar(inf.manuales, rec.id); hecho('Ajuste eliminado'); } } : { txt: 'Cancelar', cls: 'sec' },
        {
          txt: 'Guardar',
          fn: (m, hoja) => {
            const d = K.datos(hoja);
            const campos = { indId: d.indId, fecha: d.fecha, cantidad: Number(d.cantidad) || 0, nota: d.nota };
            if (rec) Object.assign(rec, campos); else inf.manuales.push(Object.assign({ id: K.uid() }, campos));
            hecho('Ajuste guardado');
          }
        }
      ]
    });
  };

  /* ---------- Lista de registros (recientes) ---------- */
  K.registros = function (inf, jugadorId) {
    const out = [];
    const nom = (id) => (K.jugador(inf, id) || { nombre: '—' }).nombre;
    const ok = (x) => (jugadorId ? x.jugadorId === jugadorId : K.enCat(inf, x.jugadorId));
    inf.atenciones.filter(ok).forEach((a) => {
      const partes = Object.keys(a.trat || {}).map((id) => { const t = K.trat(inf, id); return t ? `${t.nombre} ×${a.trat[id]}` : ''; }).filter(Boolean);
      out.push({ k: 'atencion', jid: a.jugadorId, fecha: a.fecha, icono: 'img:atenciones', t: 'Atención', j: nom(a.jugadorId), d: [K.nombreClase(a.clase), partes.join(' · ') || 'Sin intervenciones', a.origen === 'externo' ? 'fuera de SW' : a.origen === 'gira' ? 'en gira' : ''].filter(Boolean).join(' · '), abrir: () => K.formAtencion({ rec: a }) });
    });
    inf.casos.filter(ok).forEach((c) => out.push({ k: c.tipo === 'lesion' ? 'lesion' : 'molestia', jid: c.jugadorId, fecha: c.inicio, icono: c.tipo === 'lesion' ? 'svg:lesion' : 'svg:molestia', t: c.tipo === 'lesion' ? 'Lesión' : 'Molestia', j: nom(c.jugadorId), d: c.titulo, g: c.gravedad, abrir: () => K.formCaso({ rec: c }) }));
    inf.eventos.filter(ok).forEach((v) => out.push({ k: v.tipo, jid: v.jugadorId, fecha: v.fecha, icono: { control: 'svg:control', examen: 'svg:examen', procedimiento: 'svg:jeringa', medicamento: 'svg:medicamento', cirugia: 'svg:cirugia' }[v.tipo], t: v.tipo === 'control' ? K.ctlEtiqueta(v.nombre) : EV[v.tipo].t, j: nom(v.jugadorId), d: `${v.tipo === 'control' ? '' : v.nombre || ''}${v.cantidad > 1 ? ' ×' + v.cantidad : ''}${v.tipo === 'examen' && v.resultado ? ' · resultado: ' + v.resultado : ''}${K.evRealizado(v) ? '' : ' · programado (aún no ocurre)'}`, abrir: () => K.formEvento(v.tipo, { rec: v }) }));
    return out.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  };
  K.listaRegistros = function (regs, limite) {
    if (!regs.length) return '<p class="vacio-msg">Aún no hay registros.</p>';
    return `<div class="lista">${regs.slice(0, limite || 30).map((r, i) => `<div class="item" data-reg="${i}"><span class="mini-ico">${K.ico(r.icono)}</span>
      <div class="txt"><b>${e(r.t)} · ${e(r.j)}</b><span>${e(K.fechaCorta(r.fecha))} — ${e(r.d)}</span></div>${r.g && K.GRAVEDADES[r.g] ? `<span class="chip g-${r.g}">${K.GRAVEDADES[r.g]}</span>` : ''}</div>`).join('')}</div>`;
  };
})();

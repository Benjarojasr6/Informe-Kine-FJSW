/* Formularios de registro: atenciones, lesiones/molestias, controles, medicamentos, cirugías y ajustes manuales. */
(function () {
  const K = window.K;
  const e = K.esc;
  const hecho = (msg) => { K.guardar(); K.aviso(msg); K.refrescar && K.refrescar(); };
  const casosOpts = (inf, jid, sel) =>
    '<option value="">— sin asociar —</option>' +
    inf.casos.filter((c) => c.jugadorId === jid).sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''))
      .map((c) => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${e(c.titulo)} (${c.tipo === 'lesion' ? 'lesión' : 'molestia'})</option>`).join('');
  const quitar = (arr, id) => { const i = arr.findIndex((x) => x.id === id); if (i >= 0) arr.splice(i, 1); };
  const sinJugadores = () => { K.aviso('Primero agrega a tu plantel de jugadores.', true); K.formPlantel && K.formPlantel(); };

  /* ---------- Atención (una sola ficha: origen, período, tipo, intervención, medicamento y comentarios) ---------- */
  K.ORIGENES = [['ssw', 'En Santiago Wanderers (entrenamiento, partido, gimnasio…)'], ['externo', 'Fuera de Santiago Wanderers (en su casa, con amigos, etc.)']];
  K.TEMPORADAS = [['pre', 'Pretemporada'], ['camp1', 'Campeonato · 1.er semestre'], ['camp2', 'Campeonato · 2.º semestre'], ['inter', 'Intertemporada'], ['playoff', 'Playoff']];
  K.CLASES_ATENCION = [['molestia', 'Molestia'], ['enfermedad', 'Enfermedad'], ['primeros', 'Primeros auxilios'], ['otras', 'Otras']];
  K.nombreTemporada = (v) => (K.TEMPORADAS.find((t) => t[0] === v) || [0, ''])[1];
  K.nombreClase = (v) => (K.CLASES_ATENCION.find((t) => t[0] === v) || [0, ''])[1];
  K.nombreOrigen = (v) => (v === 'externo' ? 'Fuera de Santiago Wanderers' : v === 'ssw' ? 'En Santiago Wanderers' : '');
  const temporadaPorDefecto = (fecha) => K.ui.ultTemporada || (Number((fecha || K.hoy()).slice(5, 7)) <= 6 ? 'camp1' : 'camp2');
  K.formAtencion = function (o) {
    o = o || {};
    const inf = K.inf(); const rec = o.rec;
    if (!inf.jugadores.length) return sinJugadores();
    const jid = rec ? rec.jugadorId : o.jugadorId || '';
    const trat = rec ? rec.trat || {} : {};
    const origen = rec ? rec.origen || 'ssw' : K.ui.ultOrigen || 'ssw';
    const clase = rec ? rec.clase || 'molestia' : 'molestia';
    const varios = !rec ? `
      <button type="button" class="btn sec chico" data-varios>Aplicar a varios jugadores</button>
      <div class="oculto" data-lista-varios style="margin:8px 0 12px">${K.jugadoresCat(inf).slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .map((j) => `<label class="check"><input type="checkbox" data-vj value="${j.id}"><span>${e(j.nombre)} <span class="suave">${e(j.categoria || '')}</span></span></label>`).join('')}</div>` : '';
    const lbl = (t) => `<span style="display:block;font-size:12.5px;font-weight:600;color:var(--suave);margin-bottom:4px">${t}</span>`;
    const api = K.modal({
      titulo: rec ? 'Editar atención' : 'Registrar atención',
      cuerpo: `
        <div class="campo">${lbl('¿Dónde se originó lo que se atiende?')}
          ${K.seg('origen', K.ORIGENES, origen, 'v')}</div>
        <div class="grid2">
          <label class="campo"><span>Período de la temporada</span><select name="temporada">${K.opts(K.TEMPORADAS, rec ? rec.temporada || temporadaPorDefecto(rec.fecha) : temporadaPorDefecto())}</select></label>
          <label class="campo"><span>Tipo de atención</span><select name="clase">${K.opts(K.CLASES_ATENCION, clase)}</select></label>
        </div>
        <div class="grid2">
          <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${e(rec ? rec.fecha : K.hoy())}"></label>
          <label class="campo" data-bloque-j><span>Jugador</span><select name="jugadorId">${K.optsJugadores(inf, jid, true)}</select></label>
        </div>
        ${varios}
        <div data-bloque-caso class="${clase === 'molestia' ? '' : 'oculto'}">
          <label class="campo"><span>Lesión o molestia asociada (opcional)</span><select name="casoId">${casosOpts(inf, jid, rec ? rec.casoId : o.casoId)}</select></label>
          <button type="button" class="btn sec chico" data-nuevo-caso style="margin:-4px 0 10px">${K.uiIco('mas', 16)} Registrar una lesión o molestia nueva</button>
        </div>
        <h3 style="margin:6px 0 4px;font-size:15px">Intervención realizada</h3>
        <p class="suave" style="margin:0 0 6px">Una atención es una visita del jugador; cada intervención suma a los totales.</p>
        <div>${inf.tratamientos.map((t) => K.contador(t.id, t.nombre, t.icono, trat[t.id] || 0)).join('')}</div>
        ${rec ? '' : `<div class="oculto" data-bloque-med style="margin-top:8px"><h3 style="margin:6px 0 4px;font-size:15px">Medicamento entregado</h3>
          <div class="grid2"><label class="campo"><span>Medicamento</span><input type="text" name="medNombre" list="dl-med" placeholder="Ej. Ibuprofeno" autocomplete="off"><datalist id="dl-med">${EV.medicamento.sug.map((x) => `<option value="${e(x)}">`).join('')}</datalist></label>
          <label class="campo"><span>Unidades / dosis</span><input type="number" inputmode="numeric" min="1" name="medCant" value="1"></label></div></div>`}
        <label class="campo" style="margin-top:10px"><span>Comentarios de la intervención</span><textarea name="notas">${e(rec ? rec.notas || '' : '')}</textarea></label>`,
      botones: [
        rec ? { txt: 'Eliminar', cls: 'peligro', fn: (m) => { K.confirmar('¿Eliminar esta atención?', 'Eliminar', () => { quitar(inf.atenciones, rec.id); hecho('Atención eliminada'); }); return true; } } : { txt: 'Cancelar', cls: 'sec' },
        {
          txt: 'Guardar',
          fn: (m, hoja) => {
            const d = K.datos(hoja);
            const tr = {};
            hoja.querySelectorAll('.contador').forEach((c) => { const n = Number(c.querySelector('[data-n]').value) || 0; if (n > 0) tr[c.dataset.cont] = n; });
            const extra = Array.from(hoja.querySelectorAll('[data-vj]:checked')).map((x) => x.value);
            const ids = extra.length ? extra : d.jugadorId ? [d.jugadorId] : [];
            if (!ids.length) { K.aviso('Elige al menos un jugador', true); return false; }
            if (!d.fecha) { K.aviso('Falta la fecha', true); return false; }
            const meta = { origen: K.segValor(hoja, 'origen') || 'ssw', temporada: d.temporada, clase: d.clase };
            K.ui.ultTemporada = d.temporada; K.ui.ultOrigen = meta.origen;
            const caso = (id) => (d.clase === 'molestia' && ids.length === 1 ? d.casoId || '' : '');
            if (rec) { Object.assign(rec, meta, { fecha: d.fecha, jugadorId: ids[0], casoId: caso(), trat: tr, notas: d.notas }); }
            else {
              ids.forEach((id) => {
                inf.atenciones.push(Object.assign({ id: K.uid(), fecha: d.fecha, jugadorId: id, casoId: caso(), trat: Object.assign({}, tr), notas: d.notas }, meta));
                if (tr.farmaco && (d.medNombre || '').trim()) inf.eventos.push({ id: K.uid(), tipo: 'medicamento', fecha: d.fecha, jugadorId: id, nombre: d.medNombre.trim(), cantidad: Math.max(1, Number(d.medCant) || 1), casoId: caso(), notas: '' });
              });
            }
            hecho(ids.length > 1 ? `Atención guardada para ${ids.length} jugadores` : 'Atención guardada');
          }
        }
      ],
      alMontar: (m, hoja) => {
        const selJ = hoja.querySelector('[name=jugadorId]'), selC = hoja.querySelector('[name=casoId]');
        selJ.addEventListener('change', () => { selC.innerHTML = casosOpts(inf, selJ.value, ''); });
        const bloqueCaso = hoja.querySelector('[data-bloque-caso]'), selClase = hoja.querySelector('[name=clase]');
        let enVarios = false;
        const sync = () => {
          bloqueCaso.classList.toggle('oculto', selClase.value !== 'molestia' || enVarios);
          const med = hoja.querySelector('[data-bloque-med]');
          if (med) { const f = hoja.querySelector('.contador[data-cont="farmaco"] [data-n]'); med.classList.toggle('oculto', !(f && Number(f.value) > 0)); }
        };
        selClase.addEventListener('change', sync);
        hoja.addEventListener('click', () => setTimeout(sync, 0)); hoja.addEventListener('input', sync); hoja.addEventListener('change', sync);
        const bn = hoja.querySelector('[data-nuevo-caso]');
        bn.addEventListener('click', () => {
          if (!selJ.value) { K.aviso('Primero elige el jugador', true); return; }
          K.formCaso({ jugadorId: selJ.value, tipo: 'molestia', alGuardar: (c) => { selC.innerHTML = casosOpts(inf, selJ.value, c.id); } });
        });
        const bv = hoja.querySelector('[data-varios]');
        if (bv) bv.addEventListener('click', () => {
          const l = hoja.querySelector('[data-lista-varios]'); l.classList.toggle('oculto');
          const on = !l.classList.contains('oculto'); enVarios = on;
          hoja.querySelector('[data-bloque-j]').classList.toggle('oculto', on);
          bv.textContent = on ? 'Volver a un solo jugador' : 'Aplicar a varios jugadores';
          if (!on) hoja.querySelectorAll('[data-vj]').forEach((c) => (c.checked = false));
          sync();
        });
        sync();
      }
    });
    return api;
  };

  /* ---------- Lesión / molestia ---------- */
  K.formCaso = function (o) {
    o = o || {};
    const inf = K.inf(); const rec = o.rec;
    if (!inf.jugadores.length) return sinJugadores();
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
        <label class="campo"><span>Jugador</span><select name="jugadorId">${K.optsJugadores(inf, rec ? rec.jugadorId : o.jugadorId || '', true)}</select></label>
        <label class="campo"><span>Qué es (ej. Desgarro psoas derecho)</span><input type="text" name="titulo" value="${e(rec ? rec.titulo : '')}" autocomplete="off"></label>
        <label class="campo"><span>Contexto (opcional, ej. post partido, golpe de balón)</span><input type="text" name="contexto" value="${e(rec ? rec.contexto || '' : '')}"></label>
        <div class="campo ${conv ? 'oculto' : ''}"><span style="display:block;font-size:12.5px;font-weight:600;color:var(--suave);margin-bottom:4px">Gravedad (define el color en el mapa)</span>
          ${K.seg('gravedad', K.GRAV_ORDEN.map((g) => [g, K.GRAVEDADES[g]]), grav, 'g')}
          <p class="suave" style="margin:6px 0 0;font-size:12.5px">Mínima: 1-3 días fuera · Leve: 4-7 · Moderada: 8-28 · Grave: más de 28.<span data-grav-sug></span></p></div>
        <div class="campo"><span style="display:block;font-size:12.5px;font-weight:600;color:var(--suave);margin-bottom:4px">Zona del cuerpo (toca una o varias)</span>
          <div class="mapa-form" data-mapa>${K.mapaCorporal({ interactivo: true })}${K.leyendaGravedad()}</div>
          <p class="suave" data-zonas-txt style="margin:6px 0 14px"></p></div>
        <div class="grid2">
          <label class="campo"><span>Inicio</span><input type="date" name="inicio" value="${e(rec ? rec.inicio || '' : K.hoy())}"></label>
          <label class="campo ${conv ? 'oculto' : ''}"><span>Alta (si ya volvió)</span><input type="date" name="alta" value="${e(rec ? rec.alta || '' : '')}"></label>
        </div>
        <div class="grid2">
          <label class="campo ${conv ? 'oculto' : ''}"><span>Semanas de baja (opcional)</span><input type="number" inputmode="decimal" min="0" step="0.5" name="semanas" value="${e(rec && rec.semanas !== '' && rec.semanas != null ? rec.semanas : '')}" placeholder="auto"></label>
          <label class="campo"><span>Ocurrió en</span><select name="mecanismo">${K.opts([['', '—']].concat(K.MECANISMOS), rec ? rec.mecanismo || '' : '')}</select></label>
        </div>
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
        <label class="campo"><span>Terreno de juego</span><select name="terreno"><option value="">— elegir —</option>${K.opts(K.TERRENOS.map((x) => [x, x]), rec ? rec.terreno || '' : '')}</select></label>
        <label class="campo"><span>Notas (opcional)</span><textarea name="notas">${e(rec ? rec.notas || '' : '')}</textarea></label>`,
      botones: [
        rec ? { txt: 'Eliminar', cls: 'peligro', fn: () => { K.confirmar('¿Eliminar este registro? Las atenciones asociadas se conservan.', 'Eliminar', () => { quitar(inf.casos, rec.id); K.state.informes.forEach((i) => i.casos.forEach((c) => { if (c.convertidaA === rec.id) delete c.convertidaA; })); inf.atenciones.forEach((a) => { if (a.casoId === rec.id) a.casoId = ''; }); hecho('Registro eliminado'); }); return true; } } : { txt: 'Cancelar', cls: 'sec' },
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
            if (rec) Object.assign(rec, campos); else { reg = Object.assign({ id: K.uid() }, campos); inf.casos.push(reg); }
            hecho('Guardado');
            if (o.alGuardar) o.alGuardar(reg);
          }
        }
      ],
      alMontar: (m, hoja) => {
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
        <div class="campo"><span style="display:block;font-size:12.5px;font-weight:600;color:var(--suave);margin-bottom:4px">Gravedad</span>${K.seg('gravedad', K.GRAV_ORDEN.map((g) => [g, K.GRAVEDADES[g]]), 'pordefinir', 'g')}</div>
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
    control: { t: 'Control médico', sug: ['Traumatólogo', 'Médico del club', 'Nutricionista', 'Psicólogo', 'Kinesiólogo externo'], ph: 'Ej. Traumatólogo' },
    examen: { t: 'Examen', sug: ['Radiografía', 'RNM', 'Ecografía', 'TAC', 'Examen de sangre'], ph: 'Ej. Radiografía' },
    medicamento: { t: 'Medicamento', sug: ['Ibuprofeno', 'Paracetamol', 'Diclofenaco', 'Naproxeno'], ph: 'Ej. Ibuprofeno' },
    cirugia: { t: 'Cirugía', sug: [], ph: 'Ej. Meniscectomía' }
  };
  K.EV = EV;
  K.formEvento = function (tipo, o) {
    o = o || {};
    const inf = K.inf(); const rec = o.rec; tipo = rec ? rec.tipo : tipo;
    if (!inf.jugadores.length) return sinJugadores();
    const def = EV[tipo];
    const jid = rec ? rec.jugadorId : o.jugadorId || '';
    K.modal({
      titulo: (rec ? 'Editar ' : 'Nuevo registro: ') + def.t.toLowerCase(),
      cuerpo: `
        <div class="grid2">
          <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${e(rec ? rec.fecha : K.hoy())}"></label>
          <label class="campo"><span>Jugador</span><select name="jugadorId">${K.optsJugadores(inf, jid, true)}</select></label>
        </div>
        <label class="campo"><span>${tipo === 'control' ? 'Con quién' : tipo === 'examen' ? 'Tipo de examen' : tipo === 'medicamento' ? 'Medicamento' : 'Cirugía'}</span>
          <input type="text" name="nombre" list="dl-ev" value="${e(rec ? rec.nombre || '' : '')}" placeholder="${def.ph}" autocomplete="off">
          <datalist id="dl-ev">${def.sug.map((s) => `<option value="${e(s)}">`).join('')}</datalist></label>
        ${tipo === 'cirugia' ? '' : `<label class="campo"><span>${tipo === 'medicamento' ? 'Unidades / dosis entregadas' : 'Cantidad'}</span><input type="number" inputmode="numeric" min="1" name="cantidad" value="${e(rec ? rec.cantidad || 1 : 1)}"></label>`}
        <label class="campo"><span>Lesión o molestia asociada (opcional)</span><select name="casoId">${casosOpts(inf, jid, rec && rec.casoId)}</select></label>
        <label class="campo"><span>Notas (opcional)</span><textarea name="notas">${e(rec ? rec.notas || '' : '')}</textarea></label>`,
      botones: [
        rec ? { txt: 'Eliminar', cls: 'peligro', fn: () => { K.confirmar('¿Eliminar este registro?', 'Eliminar', () => { quitar(inf.eventos, rec.id); hecho('Registro eliminado'); }); return true; } } : { txt: 'Cancelar', cls: 'sec' },
        {
          txt: 'Guardar',
          fn: (m, hoja) => {
            const d = K.datos(hoja);
            if (!d.jugadorId) { K.aviso('Elige un jugador', true); return false; }
            const campos = { tipo, fecha: d.fecha, jugadorId: d.jugadorId, nombre: (d.nombre || '').trim(), cantidad: tipo === 'cirugia' ? 1 : Math.max(1, Number(d.cantidad) || 1), casoId: d.casoId || '', notas: d.notas };
            if (rec) Object.assign(rec, campos); else inf.eventos.push(Object.assign({ id: K.uid() }, campos));
            hecho('Guardado');
          }
        }
      ],
      alMontar: (m, hoja) => {
        const selJ = hoja.querySelector('[name=jugadorId]'), selC = hoja.querySelector('[name=casoId]');
        selJ.addEventListener('change', () => { selC.innerHTML = casosOpts(inf, selJ.value, ''); });
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
      out.push({ k: 'atencion', jid: a.jugadorId, fecha: a.fecha, icono: 'img:atenciones', t: 'Atención', j: nom(a.jugadorId), d: [K.nombreClase(a.clase), partes.join(' · ') || 'Sin intervenciones', a.origen === 'externo' ? 'fuera de SW' : ''].filter(Boolean).join(' · '), abrir: () => K.formAtencion({ rec: a }) });
    });
    inf.casos.filter(ok).forEach((c) => out.push({ k: c.tipo === 'lesion' ? 'lesion' : 'molestia', jid: c.jugadorId, fecha: c.inicio, icono: c.tipo === 'lesion' ? 'svg:lesion' : 'svg:molestia', t: c.tipo === 'lesion' ? 'Lesión' : 'Molestia', j: nom(c.jugadorId), d: c.titulo, g: c.gravedad, abrir: () => K.formCaso({ rec: c }) }));
    inf.eventos.filter(ok).forEach((v) => out.push({ k: v.tipo, jid: v.jugadorId, fecha: v.fecha, icono: { control: 'svg:control', examen: 'svg:examen', medicamento: 'svg:medicamento', cirugia: 'svg:cirugia' }[v.tipo], t: EV[v.tipo].t, j: nom(v.jugadorId), d: `${v.nombre || ''}${v.cantidad > 1 ? ' ×' + v.cantidad : ''}${K.evRealizado(v) ? '' : ' · programado (aún no ocurre)'}`, abrir: () => K.formEvento(v.tipo, { rec: v }) }));
    return out.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  };
  K.listaRegistros = function (regs, limite) {
    if (!regs.length) return '<p class="vacio-msg">Aún no hay registros.</p>';
    return `<div class="lista">${regs.slice(0, limite || 30).map((r, i) => `<div class="item" data-reg="${i}"><span class="mini-ico">${K.ico(r.icono)}</span>
      <div class="txt"><b>${e(r.t)} · ${e(r.j)}</b><span>${e(K.fechaCorta(r.fecha))} — ${e(r.d)}</span></div>${r.g && K.GRAVEDADES[r.g] ? `<span class="chip g-${r.g}">${K.GRAVEDADES[r.g]}</span>` : ''}</div>`).join('')}</div>`;
  };
})();

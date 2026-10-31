/* Pantallas: Informe, Registrar, Jugadores, Partidos y Ajustes. */
(function () {
  const K = window.K;
  const e = K.esc;
  K.ui = { pantalla: 'informe', jugadorId: null, cat: null };
  K.acciones = {};
  const guardar = (msg) => { K.guardar(); if (msg) K.aviso(msg); K.render(); };
  const quitar = (arr, id) => { const i = arr.findIndex((x) => x.id === id); if (i >= 0) arr.splice(i, 1); };
  const mover = (arr, id, d) => {
    const i = arr.findIndex((x) => x.id === id), j = i + d;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  };
  /* Una fecha se acepta vacía o con año completo; así no se interrumpe mientras se escribe (ej. 2 → 0002 → … → 2026). */
  const fechaOk = (v) => v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 1990);
  const periodo = () => K.resolverPeriodo(K.state.periodo);
  const iniciales = (n) => (n || '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  const avatar = (j, c) => `<span class="avatar ${c || ''}">${j.foto ? `<img src="${e(j.foto)}" alt="">` : e(iniciales(j.nombre))}</span>`;

  /* ======================= INFORME ======================= */
  function pInforme() {
    const inf0 = K.inf(), inf = K.informeVista(inf0), per = periodo(), p = K.state.periodo;
    const cont = K.contar(inf, per);
    const vis = inf.indicadores.filter((i) => i.visible !== false);
    const sinFecha = inf.partidos.filter((x) => !x.fecha).length;
    const dias = K.state.ultimoRespaldo ? Math.floor((Date.now() - new Date(K.state.ultimoRespaldo + 'T12:00:00')) / 864e5) : null;
    const ed = K.puedeEditar();
    const avisoResp = K.rol === 'local' && (K.state.cambios >= 15 && (dias === null || dias > 7)) || (dias !== null && dias > 30)
      ? `<div class="aviso">Tus datos solo viven en este dispositivo. Haz un respaldo en <b>Ajustes → Datos</b>${dias === null ? ' (aún no has hecho ninguno)' : ` (el último fue hace ${dias} días)`}.</div>` : '';
    const paginas = K.paginas(inf, per);
    return `
      <div class="titulo-vista"><h1>Informe</h1><div class="fila gap wrap">${ed ? `<button class="btn sec" data-acc="abrirBitacora">${K.uiIco('registrar', 20)} Registro clínico completo</button>` : ''}<button class="btn" data-acc="imprimir">${K.uiIco('pdf', 20)} Descargar PDF</button></div></div>
      ${avisoResp}
      <div class="vista-banner"><span>Estás viendo</span><b>${e(K.vistaTexto())}</b></div>
      <div class="card">
        <div class="fila wrap gap">
          ${ed ? K.selectorAlcance() : ''}
          <select data-acc-change="tipoPeriodo" style="width:auto;min-width:150px">${K.opts(K.TIPOS_PERIODO, p.tipo)}</select>
          <input type="number" inputmode="numeric" style="width:92px" value="${e(p.anio)}" data-acc-change="anio" aria-label="Año">
          ${p.tipo === 'libre' ? `<input type="date" style="width:auto" value="${e(p.desde || '')}" data-acc-change="desde"><span class="suave">a</span><input type="date" style="width:auto" value="${e(p.hasta || '')}" data-acc-change="hasta">` : ''}
        </div>
        ${inf._unico ? '<p class="suave" style="margin:8px 0 0">Informe único: solo jugadores con la categoría asignada. Los ajustes manuales no se incluyen.</p>' : ''}
        <p class="suave" style="margin:8px 0 0">${e(per.completo)} · ${K.fechaCorta(per.desde)} al ${K.fechaCorta(per.hasta)}</p>
      </div>
      ${ed ? `<div class="card"><h2>Textos del informe${inf._todas ? ' general (Sub 15 a 20)' : ''}</h2>
        <p class="sub">Aparecen en la última página del informe (Conclusiones y objetivos). Si el texto es largo, la letra se achica sola para que quepa (≈ 25 líneas por cuadro).${inf._todas ? ' Este texto es solo del informe general.' : ''}</p>
        <label class="campo"><span>Conclusiones del área kinésica</span><textarea ${inf._todas ? 'data-inf-g="conclusionesTodas"' : 'data-inf="conclusiones"'} rows="4">${e(inf._todas ? inf.conclusiones : inf0.conclusiones || '')}</textarea><small class="cap-aviso" ${K.textoCabe(inf._todas ? inf.conclusiones : inf0.conclusiones) ? 'hidden' : ''} style="color:#b3261e;margin-top:4px">Este texto es demasiado largo: en el informe se cortará al final. Acórtalo un poco.</small></label>
        <label class="campo"><span>Objetivos y proyecciones para el próximo año</span><textarea ${inf._todas ? 'data-inf-g="objetivosTodas"' : 'data-inf="objetivos"'} rows="4">${e(inf._todas ? inf.objetivos : inf0.objetivos || '')}</textarea><small class="cap-aviso" ${K.textoCabe(inf._todas ? inf.objetivos : inf0.objetivos) ? 'hidden' : ''} style="color:#b3261e;margin-top:4px">Este texto es demasiado largo: en el informe se cortará al final. Acórtalo un poco.</small></label></div>` : ''}
      ${ed ? `<div class="card"><h2>Firma del informe</h2><label class="campo"><span>Kinesiólogo(a) responsable (aparece sobre la línea de firma)</span><select ${inf._todas ? 'data-inf-g="firmante"' : 'data-inf="firmante"'}>${(() => { const nom = []; (inf0.staff || []).forEach((s) => { if (/kinesi/i.test(s.cargo)) s.personas.forEach((p) => { if (p.nombre && !nom.includes(p.nombre)) nom.push(p.nombre); }); }); const act = inf._todas ? inf.firmante : inf0.firmante; if (act && !nom.includes(act)) nom.push(act); return '<option value="">— sin nombre —</option>' + nom.map((n) => `<option${n === act ? ' selected' : ''}>${e(n)}</option>`).join(''); })()}</select></label>
        <p class="suave" style="margin:0">La lista sale del cargo <b>Kinesiólogo</b> del cuerpo técnico (Partidos → Cuerpo técnico): agrega o quita personas allí.</p></div>` : ''}
      <div class="card"><h2>Descargar PDF</h2><p class="sub">Elige cuál informe quieres descargar. No importa lo que estés viendo arriba.</p>
        <div class="pdf-opc">${(() => { const g = K.grupoDe(K.ui.cat); if (!g) return ''; const b = (alc, t, s) => `<button class="btn sec" data-acc="pdfAlcance" data-alc="${alc}">${K.uiIco('pdf', 18)} <span>${e(t)}<small>${e(s)}</small></span></button>`; return g.cats.map((c) => b(String(c), 'Informe único Sub ' + c, 'Solo jugadores de la Sub ' + c)).join('') + b('comb', 'Informe combinado ' + g.nombre, 'Las dos categorías juntas') + b('todas', 'Informe general Sub 15 a 20', 'Todas las categorías (cuerpo técnico)'); })()}</div>
        <p class="suave" style="margin:8px 0 0">El informe de partidos (por jornada, por categoría o general) se descarga en la pestaña <b>Partidos</b>.</p></div>
      ${ed && sinFecha ? `<div class="aviso">${sinFecha} partido(s) no tienen fecha, por eso aparecen en todos los períodos. Asígnales fecha en <b>Partidos</b> para que semestres y trimestres se calculen bien.</div>` : ''}
      <div class="card">
        <div class="fila sb"><h2 style="margin:0">Totales del período</h2>${inf._unico || !ed ? '' : `<button class="btn sec chico" data-acc="ajusteManual">${K.uiIco('mas', 16)} Ajuste manual</button>`}</div>
        <p class="sub">${ed ? 'Se calculan solos desde tus registros. Toca un número para ver el detalle o sumarle un ajuste manual.' : 'Totales calculados desde los registros del área kinésica.'}</p>
        <div class="kpis">${vis.map((i) => { const v = K.valorIndicador(inf, per, i, cont); return `<div class="kpi"${ed ? ` data-acc="kpi" data-id="${i.id}"` : ''}><span class="mini-ico">${K.ico(i.icono)}</span><div><b>${v.total}</b><span>${e(i.nombre.replace(/^Total de /, ''))}</span>${v.manual ? `<small>incluye ${v.manual > 0 ? '+' : ''}${v.manual} manual</small>` : ''}</div></div>`; }).join('')}</div>
      </div>
      <h2 style="font-family:Caladea,serif;font-size:19px;color:var(--verde-2);margin:16px 2px 8px">Vista previa del informe <span class="suave" style="font-family:Inter;font-weight:400">(${paginas.length} páginas, tamaño carta)</span></h2>
      <div class="vista-wrap"><div class="vista-paginas">${paginas.join('')}</div></div>`;
  }
  Object.assign(K.acciones, {
    imprimir() { K.imprimir(); },
    pdfAlcance(el) { K.imprimir(el.dataset.alc); },
    ajusteManual() { K.formManual({}); },
    kpi(el) { if (K.puedeEditar()) kpiDetalle(el.dataset.id); }
  });
  function kpiDetalle(id) {
    const inf = K.informeVista(K.inf()), per = periodo();
    const ind = inf.indicadores.find((i) => i.id === id); if (!ind) return;
    const v = K.valorIndicador(inf, per, ind);
    const man = inf.manuales.filter((m) => m.indId === id && K.enPeriodo(m.fecha, per)).sort((a, b) => b.fecha.localeCompare(a.fecha));
    K.modal({
      titulo: ind.nombre,
      cuerpo: `<div class="fila gap" style="margin-bottom:10px"><span class="mini-ico" style="width:46px;height:46px">${K.ico(ind.icono)}</span><div><b style="font-size:28px">${v.total}</b><div class="suave">${e(per.completo)}</div></div></div>
        <div class="card" style="box-shadow:none;border:1px solid var(--linea)"><div class="fila sb"><span>Calculado desde registros</span><b>${v.calc}</b></div>
        <div class="fila sb" style="margin-top:6px"><span>Ajustes manuales</span><b>${v.manual > 0 ? '+' : ''}${v.manual}</b></div></div>
        ${man.length ? `<div class="lista">${man.map((m) => `<div class="item" data-manual="${m.id}"><div class="txt"><b>${m.cantidad > 0 ? '+' : ''}${m.cantidad} · ${K.fechaCorta(m.fecha)}</b><span>${e(m.nota || 'Sin nota')}</span></div>${K.uiIco('editar', 18)}</div>`).join('')}</div>` : ''}`,
      botones: [{ txt: 'Cerrar', cls: 'sec' }, { txt: 'Agregar ajuste', fn: () => { K.formManual({ indId: id }); } }],
      alMontar: (m, hoja) => hoja.addEventListener('click', (ev) => {
        const it = ev.target.closest('[data-manual]'); if (!it) return;
        const rec = inf.manuales.find((x) => x.id === it.dataset.manual); m.cerrar(); K.formManual({ rec });
      })
    });
  }
  Object.assign(K.acciones, {
    informe(el) { K.state.activo = el.value; K.guardar(); K.render(); },
    alcance(el) { K.ui.alcance = el.value; K.render(); },
    pack(el) { K.state.packIconos = el.value; K.guardar(); K.render(); },
    tipoPeriodo(el) { K.state.periodo.tipo = el.value; K.guardar(); K.render(); },
    anio(el) { K.state.periodo.anio = Number(el.value) || new Date().getFullYear(); K.guardar(); K.render(); },
    desde(el) { if (!fechaOk(el.value)) return; K.state.periodo.desde = el.value; K.guardar(); K.render(); },
    hasta(el) { if (!fechaOk(el.value)) return; K.state.periodo.hasta = el.value; K.guardar(); K.render(); }
  });

  /* ======================= REGISTRAR ======================= */
  const TIPOS_REG = [['', 'Todos los tipos'], ['atencion', 'Atenciones'], ['lesion', 'Lesiones'], ['molestia', 'Molestias'], ['control', 'Controles médicos'], ['examen', 'Exámenes'], ['medicamento', 'Medicamentos'], ['cirugia', 'Cirugías']];
  function pRegistrar() {
    const inf = K.inf();
    const f = (K.ui.regF = K.ui.regF || { tipo: '', jugador: '', q: '' });
    let regs = K.registros(inf);
    const filtrando = !!(f.tipo || f.jugador || f.q);
    if (f.tipo) regs = regs.filter((r) => r.k === f.tipo);
    if (f.jugador) regs = regs.filter((r) => r.jid === f.jugador);
    const q = (f.q || '').trim().toLowerCase();
    if (q) regs = regs.filter((r) => [r.t, r.j, r.d, K.fechaCorta(r.fecha)].join(' ').toLowerCase().includes(q));
    K._regs = regs;
    const js = K.jugadoresCat(inf).slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return `
      <div class="titulo-vista"><h1>Registrar</h1></div>
      ${!inf.jugadores.length ? `<div class="aviso">Aún no hay jugadores en este informe. Agrégalos en la pestaña <b>Jugadores</b> y vuelve aquí.</div>` : ''}
      <div class="tiles tiles-reg">
        <button class="tile prin" data-acc="nuevaAtencion"><span class="mini-ico">${K.ico('svg:atenciones')}</span>Registrar atención</button>
        <button class="tile" data-acc="nuevoCaso"><span class="mini-ico">${K.ico('svg:lesion')}</span>Registrar lesión</button>
        <button class="tile" data-acc="nuevoControl"><span class="mini-ico">${K.ico('svg:control')}</span>Control médico</button>
        <button class="tile" data-acc="nuevoExamen"><span class="mini-ico">${K.ico('svg:examen')}</span>Examen</button>
        <button class="tile" data-acc="nuevaCirugia"><span class="mini-ico">${K.ico('svg:cirugia')}</span>Cirugía</button>
      </div>
      <div class="card"><div class="fila sb"><h2 style="margin:0">Últimos registros</h2><button class="btn sec chico" data-acc="abrirBitacora">Ver registro clínico completo</button></div>
        <div class="filtros-reg">
          <select data-acc-change="regFiltro" data-k="tipo" aria-label="Filtrar por tipo">${K.opts(TIPOS_REG, f.tipo)}</select>
          <select data-acc-change="regFiltro" data-k="jugador" aria-label="Filtrar por jugador"><option value="">Todos los jugadores</option>${js.map((j) => `<option value="${j.id}"${f.jugador === j.id ? ' selected' : ''}>${e(j.nombre)}</option>`).join('')}</select>
          <input type="search" value="${e(f.q || '')}" placeholder="Buscar (ej. RNM, ibuprofeno, rodilla…)" data-acc-input="regTexto" aria-label="Buscar en los registros">
        </div>
        ${filtrando ? `<p class="suave" style="margin:6px 2px" data-reg-n>${regs.length} registro${regs.length === 1 ? '' : 's'} · <a href="#" data-acc="regLimpiar">Quitar filtros</a></p>` : ''}
        <div id="reg-lista">${K.listaRegistros(regs, filtrando ? 300 : 30)}</div></div>`;
  }
  Object.assign(K.acciones, {
    nuevaAtencion() { K.formAtencion(); }, nuevoCaso() { K.formCaso(); },
    nuevoControl() { K.formEvento('control'); }, nuevoExamen() { K.formEvento('examen'); },
    nuevoMedicamento() { K.formEvento('medicamento'); }, nuevaCirugia() { K.formEvento('cirugia'); },
    regFiltro(el) { K.ui.regF[el.dataset.k] = el.value; K.render(); },
    regTexto(el) {
      K.ui.regF.q = el.value; clearTimeout(K._regT);
      K._regT = setTimeout(() => { const pos = el.selectionStart; K.render(); const n = document.querySelector('[data-acc-input=regTexto]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { /* nada */ } } }, 250);
    },
    regLimpiar(el, ev) { if (ev) ev.preventDefault(); K.ui.regF = { tipo: '', jugador: '', q: '' }; K.render(); },
    reg(el) { const r = K._regs[Number(el.dataset.reg)]; r && r.abrir(); }
  });

  /* ======================= JUGADORES ======================= */
  const POSICIONES = ['Portero', 'Defensa', 'Volante', 'Delantero'];
  K.etiquetasJugador = (j) => (j.contrato ? '<i class="chip g-leve etq">Contrato</i>' : '') + (j.plantel ? '<i class="chip g-leve etq">Plantel</i>' : '');
  // Solo ofrece las categorías de este informe (cambiar a una de la otra pareja dejaría al jugador fuera de vista).
  const selCat = (name, val) => { const gi = K.grupoDeInforme(K.inf()); const l = (gi ? [gi] : K.GRUPOS).reduce((a, g) => a.concat(g.cats.map((c) => 'Sub ' + c)), []); if (val && !l.includes(val)) l.push(val); return `<select name="${name}"><option value="">— elegir —</option>${l.map((c) => `<option${c === val ? ' selected' : ''}>${e(c)}</option>`).join('')}</select>`; };
  const selPos = (val) => { const l = POSICIONES.slice(); if (val && !l.includes(val)) l.push(val); return `<select name="posicion"><option value="">— elegir —</option>${l.map((c) => `<option${c === val ? ' selected' : ''}>${e(c)}</option>`).join('')}</select>`; };
  const selAnio = (val) => { const y = new Date().getFullYear(), l = []; for (let a = y - 11; a >= y - 22; a--) l.push(String(a)); if (val && !l.includes(String(val))) l.push(String(val)); return `<select name="nacimiento"><option value="">— elegir —</option>${l.map((c) => `<option${c === String(val) ? ' selected' : ''}>${e(c)}</option>`).join('')}</select>`; };
  K.formJugador = function (rec) {
    const inf = K.inf();
    let foto = rec ? rec.foto || '' : '';
    const catSug = (inf.categorias.match(/\d+/g) || []).map((n) => 'Sub ' + n);
    const catDef = rec ? rec.categoria || '' : K.categoriaNueva(inf);
    K.modal({
      titulo: rec ? 'Datos del jugador' : 'Nuevo jugador',
      cuerpo: `
        <div class="fila gap" style="margin-bottom:12px"><span class="avatar" style="width:64px;height:64px" data-prev>${foto ? `<img src="${foto}" alt="">` : e(iniciales(rec ? rec.nombre : '+'))}</span>
          <div><label class="btn sec chico" style="cursor:pointer">${K.uiIco('camara', 16)} Subir foto<input type="file" accept="image/*" hidden data-foto></label>
          <button type="button" class="btn ghost chico" data-sinfoto>Quitar</button><div class="suave">${K.rol === 'admin' ? 'Se guarda en la nube y la ve el otro kinesiólogo.' : 'Se guarda solo en este dispositivo.'}</div></div></div>
        <label class="campo"><span>Nombre completo</span><input type="text" name="nombre" value="${e(rec ? rec.nombre : '')}" autocomplete="off"></label>
        <div class="grid2">
          <label class="campo"><span>Categoría</span>${selCat('categoria', catDef)}</label>
          <label class="campo"><span>Año de nacimiento</span>${selAnio(rec ? rec.nacimiento || '' : '')}</label>
        </div>
        <div class="grid2">
          <label class="campo"><span>Posición</span>${selPos(rec ? rec.posicion || '' : '')}</label>
          <label class="campo"><span>Pierna dominante</span><select name="pierna"><option value="">— elegir —</option>${K.opts(['Derecha', 'Izquierda', 'Ambas'].map((x) => [x, x]), rec ? rec.pierna || '' : '')}</select></label>
        </div>
        <div class="campo" data-cats><span style="display:block;font-size:12.5px;font-weight:600;color:var(--suave);margin-bottom:4px">Categorías en las que juega</span>
          <div class="fila gap wrap">${[15, 16, 18, 20].map((c) => `<label class="check" style="padding:0"><input type="checkbox" name="tb${c}" ${(rec && (rec.tambien || []).includes('Sub ' + c)) ? 'checked' : ''}><span>Sub ${c}</span></label>`).join('')}</div>
          <p class="suave" style="margin:4px 0 0">Queda marcada la categoría principal (la de arriba). Marca otras si también juega ahí (por ejemplo un Sub 16 subido a la Sub 18): su ficha no se duplica, pero podrás anotarle minutos y atenciones en los partidos de esas categorías.</p></div>
        <div class="campo"><span style="display:block;font-size:12.5px;font-weight:600;color:var(--suave);margin-bottom:4px">Etiqueta (opcional)</span>
          <div class="fila gap wrap"><label class="check" style="padding:0"><input type="checkbox" name="contrato" ${rec && rec.contrato ? 'checked' : ''}><span>Contrato</span></label><label class="check" style="padding:0"><input type="checkbox" name="plantel" ${rec && rec.plantel ? 'checked' : ''}><span>Plantel profesional</span></label></div>
          <p class="suave" style="margin:4px 0 0">Los jugadores con etiqueta tienen su informe de partidos individual y entran al informe de plantel.</p></div>
        <label class="check"><input type="checkbox" name="activo" ${!rec || rec.activo !== false ? 'checked' : ''}><span>Incluir su ficha en el informe</span></label>`,
      botones: [
        rec ? { txt: 'Eliminar', cls: 'peligro', fn: () => { K.confirmar(`¿Eliminar a ${e(rec.nombre)} y TODOS sus registros? No se puede deshacer.`, 'Eliminar', () => { eliminarJugador(rec.id); }); return true; } } : { txt: 'Cancelar', cls: 'sec' },
        {
          txt: 'Guardar',
          fn: (m, hoja) => {
            const d = K.datos(hoja);
            if (!d.nombre.trim()) { K.aviso('Escribe el nombre', true); return false; }
            const propia = d.categoria.trim();
            const nPropia = Number((propia.match(/\d+/) || [])[0]), gi = K.grupoDeInforme(inf);
            if (nPropia && gi && !gi.cats.includes(nPropia) && K.grupoDe(nPropia) && (!rec || rec.categoria !== propia)) {
              K.aviso(`Sub ${nPropia} es del informe ${K.grupoDe(nPropia).nombre}: crea al jugador allí (elige esa categoría arriba). Si solo juega ahí a veces, deja su categoría y marca “Sub ${nPropia}” en “Categorías en las que juega”.`, true); return false;
            }
            const tambien = [15, 16, 18, 20].filter((c) => d['tb' + c] && 'Sub ' + c !== propia).map((c) => 'Sub ' + c);
            const campos = { nombre: d.nombre.trim(), categoria: propia, nacimiento: d.nacimiento, posicion: d.posicion.trim(), pierna: d.pierna, foto, activo: d.activo, tambien, contrato: !!d.contrato, plantel: !!d.plantel };
            if (rec) Object.assign(rec, campos);
            else { const nj = Object.assign({ id: K.uid(), comentarios: '', extras: {} }, campos); inf.jugadores.push(nj); K.ui.jugadorId = nj.id; }
            guardar('Jugador guardado');
          }
        }
      ],
      alMontar: (m, hoja) => {
        const prev = hoja.querySelector('[data-prev]');
        const selC = hoja.querySelector('[name=categoria]');
        const marcar = () => [15, 16, 18, 20].forEach((c) => { const cb = hoja.querySelector(`[name=tb${c}]`), propia = selC.value === 'Sub ' + c; if (propia) cb.checked = true; cb.disabled = propia; });
        selC.addEventListener('change', () => { [15, 16, 18, 20].forEach((c) => { const cb = hoja.querySelector(`[name=tb${c}]`); if (cb.disabled) { cb.disabled = false; cb.checked = false; } }); marcar(); });
        marcar();
        hoja.querySelector('[data-foto]').addEventListener('change', async (ev) => {
          const f = ev.target.files[0]; if (!f) return;
          try { foto = await K.fotoADataURL(f, 420); prev.innerHTML = `<img src="${foto}" alt="">`; } catch (x) { K.aviso('No se pudo leer la imagen', true); }
        });
        hoja.querySelector('[data-sinfoto]').addEventListener('click', () => { foto = ''; prev.textContent = iniciales(hoja.querySelector('[name=nombre]').value || '+'); });
      }
    });
  };
  /* Pegar la lista del plantel: una línea por jugador → "Nombre; año; posición" (año y posición opcionales). */
  K.formPlantel = function () {
    const inf = K.inf();
    const inc = [];
    K.modal({
      titulo: 'Cargar plantel',
      cuerpo: `<p class="suave" style="margin:0 0 8px">Pega la lista de jugadores, <b>uno por línea</b>. Opcional: <i>Nombre; año de nacimiento; posición</i>. Puedes copiarla directo desde Excel.</p>
        <label class="campo"><span>Categoría</span>${selCat('cat', K.categoriaNueva(inf))}</label>
        <label class="campo"><span>Lista</span><textarea name="lista" rows="10" placeholder="Nombre Apellido; 2010; Volante&#10;Nombre Apellido; 2011"></textarea></label>
        <p class="suave" data-cuenta style="margin:0">Ya hay ${inf.jugadores.length} jugador(es). Los nombres repetidos no se duplican.</p>`,
      botones: [{ txt: 'Cancelar', cls: 'sec' }, { txt: 'Agregar jugadores', fn: (m, hoja) => {
        const d = K.datos(hoja); let n = 0;
        const ya = new Set(inf.jugadores.map((j) => j.nombre.trim().toLowerCase()));
        d.lista.split('\n').forEach((l) => {
          const [nombre, nac, pos] = l.split(/\t|;/).map((x) => (x || '').trim());
          if (!nombre || ya.has(nombre.toLowerCase())) return;
          ya.add(nombre.toLowerCase());
          inf.jugadores.push({ id: K.uid(), nombre, categoria: d.cat.trim(), nacimiento: /^\d{4}$/.test(nac || '') ? nac : '', posicion: pos || '', comentarios: '', extras: {}, activo: true });
          n++;
        });
        if (!n) { K.aviso('No se agregó ninguno (lista vacía o repetidos)', true); return false; }
        guardar(n + ' jugador(es) agregados');
      } }]
    });
  };
  function eliminarJugador(id) {
    const inf = K.inf();
    quitar(inf.jugadores, id);
    ['casos', 'atenciones', 'eventos'].forEach((k) => { inf[k] = inf[k].filter((x) => x.jugadorId !== id); });
    K.state.informes.forEach((i) => {
      i.atenciones = i.atenciones.filter((x) => x.jugadorId !== id);
      i.partidos.forEach((p) => { delete (p.minutos || {})[id]; p.incidencias = (p.incidencias || []).filter((x) => x.jugadorId !== id); });
    });
    K.ui.jugadorId = null;
    guardar('Jugador eliminado');
  }

  // Mueve un jugador entre los visibles (misma categoría elegida) dentro del orden global.
  function moverJ(id, d) {
    const inf = K.inf();
    if (!inf.ordenManual) { inf.jugadores = K.ordenJugadores(inf, inf.jugadores); inf.ordenManual = true; }
    const vis = K.jugadoresCat(inf), i = vis.findIndex((j) => j.id === id), k = i + d;
    if (i < 0 || k < 0 || k >= vis.length) return;
    const a = inf.jugadores.indexOf(vis[i]), b = inf.jugadores.indexOf(vis[k]);
    [inf.jugadores[a], inf.jugadores[b]] = [inf.jugadores[b], inf.jugadores[a]];
    guardar();
  }
  function moverP(jid, d) {
    const inf = K.inf(), js = K.jornadas(inf), i = js.findIndex((j) => j.jid === jid), k = i + d;
    if (i < 0 || k < 0 || k >= js.length) return;
    [js[i], js[k]] = [js[k], js[i]];
    inf.partidos = [].concat(...js.map((j) => j.ps)).concat(inf.partidos.filter((p) => !js.some((j) => j.ps.includes(p))));
    inf.ordenPartidos = true; guardar();
  }
  /* Arrastrar y soltar: se agarra el asa ⠿ de una fila y se suelta en su nuevo lugar (mouse o dedo). */
  const reordenar = {
    jugadores(ids) {
      const inf = K.inf();
      if (!inf.ordenManual) { inf.jugadores = K.ordenJugadores(inf, inf.jugadores); inf.ordenManual = true; }
      const set = new Set(ids), slots = [];
      inf.jugadores.forEach((j, i) => { if (set.has(j.id)) slots.push(i); });
      const por = new Map(inf.jugadores.map((j) => [j.id, j]));
      ids.forEach((id, n) => { inf.jugadores[slots[n]] = por.get(id); });
    },
    partidos(ids) {
      const inf = K.inf(), js = K.jornadas(inf), por = new Map(js.map((j) => [j.jid, j]));
      const orden = ids.map((id) => por.get(id)).filter(Boolean), resto = js.filter((j) => !ids.includes(j.jid));
      inf.partidos = [].concat(...orden.concat(resto).map((j) => j.ps)).concat(inf.partidos.filter((p) => !js.some((j) => j.ps.includes(p))));
      inf.ordenPartidos = true;
    }
  };
  document.addEventListener('click', (ev) => { if (ev.target.closest && ev.target.closest('[data-grip]')) { ev.stopPropagation(); ev.preventDefault(); } }, true);
  document.addEventListener('pointerdown', (ev) => {
    const g = ev.target.closest && ev.target.closest('[data-grip]'); if (!g || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    const item = g.closest('[data-arr-item]'), cont = item && item.parentElement; if (!cont || !reordenar[cont.dataset.arr]) return;
    ev.preventDefault(); ev.stopPropagation();
    const antes = [...cont.children].map((x) => x.dataset.id).join(',');
    item.classList.add('arrastrando'); document.body.classList.add('arrastrando');
    let y = ev.clientY, raf = 0;
    const colocar = () => {
      const hermanos = [...cont.children].filter((x) => x !== item);
      for (const h of hermanos) {
        const r = h.getBoundingClientRect(), mid = r.top + r.height / 2;
        if (y < mid) { if (h.previousElementSibling !== item) cont.insertBefore(item, h); return; }
      }
      if (cont.lastElementChild !== item) cont.appendChild(item);
    };
    const bucle = () => { // desplaza la pantalla si se acerca a un borde
      const h = window.innerHeight; if (y < 70) window.scrollBy(0, -12); else if (y > h - 70) window.scrollBy(0, 12);
      colocar(); raf = requestAnimationFrame(bucle);
    };
    raf = requestAnimationFrame(bucle);
    const mov = (e2) => { y = e2.clientY; e2.preventDefault(); };
    const fin = () => {
      cancelAnimationFrame(raf); window.removeEventListener('pointermove', mov); window.removeEventListener('pointerup', fin); window.removeEventListener('pointercancel', fin);
      item.classList.remove('arrastrando'); document.body.classList.remove('arrastrando');
      const ids = [...cont.children].map((x) => x.dataset.id);
      if (ids.join(',') !== antes) { reordenar[cont.dataset.arr](ids); K.guardar(); K.aviso('Orden guardado'); }
      K.render();
    };
    window.addEventListener('pointermove', mov, { passive: false }); window.addEventListener('pointerup', fin); window.addEventListener('pointercancel', fin);
  });
  function pJugadores() {
    const inf = K.inf();
    if (K.ui.jugadorId && K.jugador(inf, K.ui.jugadorId)) return pFicha(K.jugador(inf, K.ui.jugadorId));
    const per = periodo();
    const q = (K.ui.filtroJ || '').toLowerCase();
    const js = K.ordenJugadores(inf, K.jugadoresCat(inf).filter((j) => !q || j.nombre.toLowerCase().includes(q)));
    const mueve = K.puedeEditar() && !q && js.length > 1;
    return `
      <div class="titulo-vista"><h1>Jugadores <span class="suave" style="font-family:Inter;font-size:15px;font-weight:400">${K.ui.cat ? 'Sub ' + K.ui.cat + ' · ' : ''}(${K.jugadoresCat(inf).length})</span></h1><div class="fila gap"><button class="btn sec" data-acc="plantel">Pegar lista</button><button class="btn" data-acc="nuevoJugador">${K.uiIco('mas', 18)} Agregar</button></div></div>
      ${K.jugadoresCat(inf).length > 6 ? `<input type="search" placeholder="Buscar jugador…" value="${e(K.ui.filtroJ || '')}" data-acc-input="buscarJ" style="margin-bottom:10px">` : ''}
      ${js.length > 1 && K.puedeEditar() ? `<p class="suave" style="margin:0 2px 8px;font-size:13px">Este es el orden de las fichas en el informe (${inf.ordenManual ? 'manual' : 'por categoría y nombre'}). Arrastra <b>⠿</b> o usa las flechas para cambiarlo.${inf.ordenManual ? ' <a href="#" data-acc="ordenAZ">Volver al orden por nombre</a>' : ''}</p>` : ''}
      <div class="card" style="padding:6px 12px">${js.length ? `<div class="lista"${mueve ? ' data-arr="jugadores"' : ''}>${js.map((j) => {
        const c = K.contar(inf, per, j.id).porFuente, z = K.casosJugador(inf, per, j).length;
        return `<div class="item" data-acc="abrirJugador" data-id="${j.id}"${mueve ? ' data-arr-item' : ''}>${mueve ? `<button class="grip" data-grip aria-label="Arrastrar para cambiar el orden" title="Arrastra para cambiar el orden">${K.uiIco('arrastrar', 20)}</button>` : ''}${avatar(j)}<div class="txt"><b>${e(j.nombre)}${j.activo === false ? ' <span class="suave">(fuera del informe)</span>' : ''} ${K.etiquetasJugador(j)}</b><span>${e([j.categoria, j.posicion, j.nacimiento].filter(Boolean).join(' · ') || 'Sin datos')}</span></div>
          <div style="text-align:right;font-size:12px;color:var(--suave)"><b style="color:var(--verde-2);font-size:15px">${c.atenciones}</b> atenc.${z ? `<br>${z} caso(s)` : ''}</div>${mueve ? `<button class="btn ghost chico" data-acc="subirJ" data-id="${j.id}" aria-label="Subir">${K.uiIco('arriba', 18)}</button><button class="btn ghost chico" data-acc="bajarJ" data-id="${j.id}" aria-label="Bajar">${K.uiIco('abajo', 18)}</button>` : ''}</div>`;
      }).join('')}</div>` : `<p class="vacio-msg">${inf.jugadores.length ? 'Nadie coincide con la búsqueda.' : 'Agrega a tus jugadores para empezar a registrar atenciones y armar sus fichas.'}</p>`}</div>`;
  }
  Object.assign(K.acciones, {
    nuevoJugador() { K.formJugador(); },
    plantel() { K.formPlantel(); },
    abrirJugador(el) { K.ui.jugadorId = el.dataset.id; K.render(); window.scrollTo(0, 0); },
    volverJugadores() { K.ui.jugadorId = null; K.render(); },
    buscarJ(el) { K.ui.filtroJ = el.value; const pos = el.selectionStart; K.render(); const n = document.querySelector('[data-acc-input=buscarJ]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } },
    subirJ(el, ev) { ev.stopPropagation(); moverJ(el.dataset.id, -1); },
    bajarJ(el, ev) { ev.stopPropagation(); moverJ(el.dataset.id, 1); },
    ordenAZ(el, ev) { if (ev) ev.preventDefault(); const inf = K.inf(); inf.jugadores = K.ordenJugadores(Object.assign({}, inf, { ordenManual: false }), inf.jugadores); inf.ordenManual = false; guardar('Orden por nombre restablecido'); },
    editarJugador() { K.formJugador(K.jugador(K.inf(), K.ui.jugadorId)); }
  });

  function pFicha(j) {
    const inf = K.inf(), per = periodo();
    const regs = K.registros(inf, j.id); K._regs = regs;
    const casos = inf.casos.filter((c) => c.jugadorId === j.id).sort((a, b) => (b.inicio || '').localeCompare(a.inicio || ''));
    const extras = inf.camposExtra.map((c) => {
      const v = (j.extras || {})[c.id];
      let ctl;
      if (c.tipo === 'si-no') ctl = `<label class="check"><input type="checkbox" data-extra="${c.id}" ${v === true ? 'checked' : ''}><span>${e(c.titulo)}</span></label>`;
      else if (c.tipo === 'numero') ctl = `<label class="campo"><span>${e(c.titulo)}</span><input type="number" inputmode="decimal" data-extra="${c.id}" value="${e(v == null ? '' : v)}"></label>`;
      else ctl = `<label class="campo"><span>${e(c.titulo)}${c.tipo === 'lista' ? ' (una por línea)' : ''}</span><textarea data-extra="${c.id}">${e(v == null ? '' : v)}</textarea></label>`;
      return ctl;
    }).join('');
    return `
      <div class="titulo-vista"><div class="fila gap"><button class="btn sec chico" data-acc="volverJugadores">${K.uiIco('atras', 16)} Jugadores</button></div><div class="fila gap wrap">${j.contrato || j.plantel ? `<button class="btn sec chico" data-acc="jugPartidosPdf" data-id="${j.id}">${K.uiIco('pdf', 16)} Informe de partidos</button>` : ''}<button class="btn sec chico" data-acc="editarJugador">${K.uiIco('editar', 16)} Datos y foto</button></div></div>
      <div class="fila gap" style="margin-bottom:12px">${avatar(j, 'grande')}<div><h1 style="font-family:Caladea,serif;font-size:23px;color:var(--verde-2)">${e(j.nombre)} ${K.etiquetasJugador(j)}</h1><div class="suave">${e([j.categoria, j.posicion, j.nacimiento].filter(Boolean).join(' · '))}</div>${(() => { const cj = K.catsJugadas(j, per), ck = Object.keys(cj).sort((a, b) => b - a), otras = (j.tambien || []).filter((x) => !ck.includes(String((/\d+/.exec(x) || [])[0]))); return ck.length || (j.tambien || []).length ? `<div class="suave">Categorías en que ha jugado${ck.length ? ': ' + ck.map((c) => `Sub ${c} (${cj[c]} partido${cj[c] === 1 ? '' : 's'})`).join(', ') : ''}${!ck.length ? ': aún sin partidos' : ''}${(j.tambien || []).length ? ' · También juega en ' + e((j.tambien || []).join(', ')) : ''}</div>` : ''; })()}</div></div>
      <div class="tiles compactos">
        <button class="tile prin" data-acc="jAtencion"><span class="mini-ico">${K.ico('img:atenciones')}</span>Atención</button>
        <button class="tile" data-acc="jCaso"><span class="mini-ico">${K.ico('svg:lesion')}</span>Lesión / molestia</button>
        <button class="tile" data-acc="jControl"><span class="mini-ico">${K.ico('svg:control')}</span>Control</button>
        <button class="tile" data-acc="jExamen"><span class="mini-ico">${K.ico('svg:examen')}</span>Examen</button>
        <button class="tile" data-acc="jMed"><span class="mini-ico">${K.ico('svg:medicamento')}</span>Medicamento</button>
        <button class="tile" data-acc="jCiru"><span class="mini-ico">${K.ico('svg:cirugia')}</span>Cirugía</button>
      </div>
      ${K.kineEstadoHTML ? K.kineEstadoHTML(inf, j) : ''}
      <div class="card"><h2>Ficha en el informe</h2><p class="sub">${e(per.completo)}. Se actualiza sola con cada registro.</p>
        <div class="vista-wrap"><div class="vista-paginas"><section class="pagina p-ficha"><div class="panel">${K.fichaHTML(inf, per, j)}</div></section></div></div></div>
      <div class="card"><h2>Comentarios</h2>
        <label class="campo"><span>Comentarios (aparecen en la ficha)</span><textarea data-campo="comentarios">${e(j.comentarios || '')}</textarea></label></div>
      ${extras ? `<div class="card"><h2>Información adicional</h2>${extras}</div>` : ''}
      <div class="card"><h2>Lesiones y molestias</h2>${casos.length ? `<div class="lista">${casos.map((c) => `<div class="item" data-acc="editCaso" data-id="${c.id}"><span class="mini-ico">${K.ico(c.tipo === 'lesion' ? 'svg:lesion' : 'svg:molestia')}</span><div class="txt"><b>${e(c.titulo)}</b><span>${c.tipo === 'lesion' ? 'Lesión' : 'Molestia'} · ${K.fechaCorta(c.inicio)}${K.duracionCaso(c) ? ' · ' + K.duracionCaso(c) : ''}${c.zonas && c.zonas.length ? ' · ' + e(c.zonas.map(K.nombreZona).join(', ')) : ''}</span></div><span class="chip g-${c.gravedad || 'leve'}">${K.GRAVEDADES[K.gravClave(c.gravedad)]}</span></div>`).join('')}</div>` : '<p class="vacio-msg">Sin lesiones ni molestias registradas.</p>'}</div>
      <div class="card"><h2>Registros del jugador</h2>${K.listaRegistros(regs, 40)}</div>`;
  }
  const cj = () => K.ui.jugadorId;
  Object.assign(K.acciones, {
    jAtencion() { K.formAtencion({ jugadorId: cj() }); }, jCaso() { K.formCaso({ jugadorId: cj() }); },
    jControl() { K.formEvento('control', { jugadorId: cj() }); }, jExamen() { K.formEvento('examen', { jugadorId: cj() }); },
    jMed() { K.formEvento('medicamento', { jugadorId: cj() }); }, jCiru() { K.formEvento('cirugia', { jugadorId: cj() }); },
    editCaso(el) { K.formCaso({ rec: K.inf().casos.find((c) => c.id === el.dataset.id) }); }
  });

  /* ======================= CALENDARIO ======================= */
  K.formCargo = function (rec) {
    const inf = K.inf();
    const filas = (rec ? rec.personas : [{ nombre: '', ocasional: false }]);
    const fila = (p) => `<div class="fila gap" style="margin-bottom:8px" data-persona><input type="text" class="grow" placeholder="Nombre" value="${e(p.nombre)}" data-pn><label class="check" style="padding:0;white-space:nowrap"><input type="checkbox" data-po ${p.ocasional ? 'checked' : ''}><span>Apoyo</span></label><button type="button" class="btn ghost chico" data-quitar aria-label="Quitar">${K.uiIco('cerrar', 16)}</button></div>`;
    K.modal({
      titulo: rec ? 'Editar cargo' : 'Nuevo cargo',
      cuerpo: `<label class="campo"><span>Cargo</span><input type="text" name="cargo" value="${e(rec ? rec.cargo : '')}" placeholder="Ej. Kinesiólogo"></label>
        <p class="suave" style="margin:0 0 6px">Personas en este cargo. Marca <b>Apoyo</b> para quienes ayudaron solo de vez en cuando.</p>
        <div data-personas>${filas.map(fila).join('')}</div>
        <button type="button" class="btn sec chico" data-mas>${K.uiIco('mas', 16)} Agregar persona</button>`,
      botones: [
        rec ? { txt: 'Eliminar', cls: 'peligro', fn: () => { K.confirmar('¿Eliminar este cargo?', 'Eliminar', () => { quitar(inf.staff, rec.id); guardar('Cargo eliminado'); }); return true; } } : { txt: 'Cancelar', cls: 'sec' },
        {
          txt: 'Guardar',
          fn: (m, hoja) => {
            const cargo = hoja.querySelector('[name=cargo]').value.trim();
            if (!cargo) { K.aviso('Escribe el cargo', true); return false; }
            const personas = Array.from(hoja.querySelectorAll('[data-persona]')).map((r) => ({ nombre: r.querySelector('[data-pn]').value.trim(), ocasional: r.querySelector('[data-po]').checked })).filter((p) => p.nombre);
            if (rec) { rec.cargo = cargo; rec.personas = personas; } else inf.staff.push({ id: K.uid(), cargo, personas });
            guardar('Cuerpo técnico guardado');
          }
        }
      ],
      alMontar: (m, hoja) => {
        const cont = hoja.querySelector('[data-personas]');
        hoja.querySelector('[data-mas]').addEventListener('click', () => { cont.insertAdjacentHTML('beforeend', fila({ nombre: '', ocasional: false })); cont.lastElementChild.querySelector('input').focus(); });
        cont.addEventListener('click', (ev) => { const q = ev.target.closest('[data-quitar]'); if (q) q.closest('[data-persona]').remove(); });
      }
    });
  };
  function pCalendario() {
    const inf = K.inf();
    K.migrarPartidos(inf);
    if (K.ui.partidoId) { const pp = inf.partidos.find((x) => x.id === K.ui.partidoId); if (pp && K.pPartidoInforme) return K.pPartidoInforme(pp); K.ui.partidoId = null; }
    return `
      <div class="titulo-vista"><h1>Partidos</h1></div>
      ${K.partidosCalendarioHTML(inf)}
      ${(() => { const per = periodo(), fuera = inf.partidos.filter((x) => !K.partidoEnPeriodo(x, per)); return fuera.length ? `<div class="aviso">${fuera.length} partido(s) tienen fecha fuera del período del informe (<b>${e(per.completo)}</b>), por eso no aparecen en el informe: ${fuera.map((x) => e(x.rival || 'Partido') + ' (' + e(K.fechaCorta(x.fecha)) + ')').join(', ')}. Revisa la fecha o cambia el período en Informe.</div>` : ''; })()}
      ${K.partidosListaHTML(inf)}
      ${K.partidosGeneralHTML()}
      <div class="card"><div class="fila sb"><h2 style="margin:0">Cuerpo técnico</h2><button class="btn sec chico" data-acc="nuevoCargo">${K.uiIco('mas', 16)} Agregar cargo</button></div>
        <p class="sub">Puedes poner varias personas por cargo y marcar a quienes colaboraron solo de vez en cuando.</p>
        ${inf.staff.length ? `<div class="lista">${inf.staff.map((s) => `<div class="item" data-acc="editCargo" data-id="${s.id}"><div class="txt"><b>${e(s.cargo)}</b><span>${s.personas.map((p) => e(p.nombre) + (p.ocasional ? ' (apoyo)' : '')).join(' · ') || 'Sin personas'}</span></div>
          <button class="btn ghost chico" data-acc="subirC" data-id="${s.id}" aria-label="Subir">${K.uiIco('arriba', 18)}</button><button class="btn ghost chico" data-acc="bajarC" data-id="${s.id}" aria-label="Bajar">${K.uiIco('abajo', 18)}</button></div>`).join('')}</div>` : '<p class="vacio-msg">Sin cargos todavía.</p>'}</div>`;
  }
  Object.assign(K.acciones, {
    subirP(el, ev) { ev.stopPropagation(); moverP(el.dataset.id, -1); },
    bajarP(el, ev) { ev.stopPropagation(); moverP(el.dataset.id, 1); },
    ordenFecha(el, ev) { if (ev) ev.preventDefault(); const inf = K.inf(); const orden = K.jornadas(inf).sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999')); inf.partidos = [].concat(...orden.map((j) => j.ps)).concat(inf.partidos.filter((p) => !orden.some((j) => j.ps.includes(p)))); inf.ordenPartidos = false; guardar('Orden por fecha restablecido'); },
    nuevoCargo() { K.formCargo(); },
    editCargo(el) { K.formCargo(K.inf().staff.find((s) => s.id === el.dataset.id)); },
    subirC(el, ev) { ev.stopPropagation(); mover(K.inf().staff, el.dataset.id, -1); guardar(); },
    bajarC(el, ev) { ev.stopPropagation(); mover(K.inf().staff, el.dataset.id, 1); guardar(); }
  });

  /* ======================= AJUSTES ======================= */
  const botonIcono = (i, sel) => `<span class="ico-opt"><button type="button" class="btn sec chico" data-ico="${e(i)}" style="padding:4px;width:46px;height:46px;${i === sel ? 'border-width:3px' : 'border-color:var(--linea)'}"><span class="mini-ico" style="width:32px;height:32px">${K.ico(i)}</span></button>${i.startsWith('custom:') ? `<button type="button" class="ico-del" data-ico-del="${e(i.slice(7))}" aria-label="Quitar ícono">×</button>` : ''}</span>`;
  const botonesPack = () => K.PACKS.map(([id, t]) => `<button type="button" class="btn chico${K.packIconos() === id ? '' : ' sec'}" data-pack="${id}">${t}</button>`).join('');
  const gridIconos = (sel) => K.iconosPack(K.packIconos()).map((i) => botonIcono(i, sel)).join('');
  const pickerIcono = (sel) => `<div class="campo"><span style="display:block;font-size:12.5px;font-weight:600;color:var(--suave);margin-bottom:4px">Ícono (<span data-n-iconos>${K.iconosPack(K.packIconos()).length}</span> disponibles en este estilo)</span>
    <div class="fila gap wrap" style="margin-bottom:8px" data-packs><span class="suave" style="font-size:12.5px">Estilo:</span>${botonesPack()}</div>
    <input type="hidden" data-icono-val value="${e(sel)}"><div class="fila wrap" style="gap:6px" data-iconos>${gridIconos(sel)}</div>
    <label class="btn sec chico" style="cursor:pointer;margin-top:8px">${K.uiIco('subir', 16)} Agregar ícono propio a este estilo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden data-ico-subir></label>
    <div class="suave" style="font-size:12px;margin-top:4px">Sube una imagen cuadrada (PNG o SVG). Quedará disponible en el estilo que tengas elegido.</div></div>`;
  const bindPicker = (hoja) => {
    const refrescar = () => {
      const sel = hoja.querySelector('[data-icono-val]').value;
      hoja.querySelector('[data-iconos]').innerHTML = gridIconos(sel);
      hoja.querySelector('[data-n-iconos]').textContent = K.iconosPack(K.packIconos()).length;
    };
    hoja.addEventListener('click', (ev) => {
      const pk = ev.target.closest('[data-pack]');
      if (pk) {
        K.state.packIconos = pk.dataset.pack; K.guardar();
        hoja.querySelectorAll('[data-pack]').forEach((x) => x.classList.toggle('sec', x !== pk));
        refrescar(); return;
      }
      const del = ev.target.closest('[data-ico-del]');
      if (del) { K.quitarIconoPropio(del.dataset.icoDel); refrescar(); K.aviso('Ícono quitado'); return; }
      const b = ev.target.closest('[data-ico]'); if (!b) return;
      hoja.querySelector('[data-icono-val]').value = b.dataset.ico;
      hoja.querySelectorAll('[data-ico]').forEach((x) => { x.style.borderWidth = x === b ? '3px' : '1.5px'; x.style.borderColor = x === b ? '' : 'var(--linea)'; });
    });
    hoja.addEventListener('change', async (ev) => {
      const inp = ev.target.closest('[data-ico-subir]'); if (!inp || !inp.files[0]) return;
      const f = inp.files[0];
      try {
        const data = /svg/.test(f.type) ? await new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = mal; r.readAsDataURL(f); }) : await K.fotoADataURL(f, 160, true);
        K.agregarIconoPropio(K.packIconos(), f.name.replace(/\.[^.]+$/, ''), data);
        refrescar(); K.aviso('Ícono agregado');
      } catch (x) { K.aviso('No se pudo leer la imagen', true); }
      inp.value = '';
    });
  };
  const valIcono = (hoja) => hoja.querySelector('[data-icono-val]').value;

  K.formIndicador = function (rec) {
    const inf = K.inf();
    const auto = rec && rec.fuente !== 'manual';
    K.modal({
      titulo: rec ? 'Indicador' : 'Nuevo indicador',
      cuerpo: `<label class="campo"><span>Nombre</span><input type="text" name="nombre" value="${e(rec ? rec.nombre : '')}" placeholder="Ej. Total de evaluaciones"></label>
        <div class="campo"><span style="display:block;font-size:12.5px;font-weight:600;color:var(--suave);margin-bottom:4px">Dónde aparece</span>${K.seg('grupo', [['general', 'Resumen general'], ['tratamiento', 'Tratamientos']], rec ? rec.grupo : 'general')}</div>
        ${pickerIcono(rec ? rec.icono : 'svg:estrella')}
        <p class="aviso">${auto ? 'Este indicador se calcula solo desde tus registros. Puedes sumarle ajustes manuales desde la pestaña Informe.' : 'Este indicador es manual: se llena con “Ajuste manual” (en Informe o Registrar) y suma por fecha, así respeta los períodos.'}</p>
        <label class="check"><input type="checkbox" name="visible" ${!rec || rec.visible !== false ? 'checked' : ''}><span>Mostrar en el informe</span></label>`,
      botones: [
        rec && rec.fuente === 'manual' ? { txt: 'Eliminar', cls: 'peligro', fn: () => { K.confirmar('¿Eliminar este indicador y sus ajustes?', 'Eliminar', () => { quitar(inf.indicadores, rec.id); inf.manuales = inf.manuales.filter((m) => m.indId !== rec.id); guardar('Indicador eliminado'); }); return true; } } : { txt: 'Cancelar', cls: 'sec' },
        {
          txt: 'Guardar',
          fn: (m, hoja) => {
            const d = K.datos(hoja);
            if (!d.nombre.trim()) { K.aviso('Escribe un nombre', true); return false; }
            const campos = { nombre: d.nombre.trim(), grupo: K.segValor(hoja, 'grupo'), icono: valIcono(hoja), visible: d.visible };
            if (rec) Object.assign(rec, campos); else inf.indicadores.push(Object.assign({ id: 'i-' + K.uid(), fuente: 'manual' }, campos));
            guardar('Indicador guardado');
          }
        }
      ],
      alMontar: (m, hoja) => bindPicker(hoja)
    });
  };
  K.formTratamiento = function (rec) {
    const inf = K.inf();
    K.modal({
      titulo: rec ? 'Tratamiento' : 'Nuevo tratamiento',
      cuerpo: `<label class="campo"><span>Nombre</span><input type="text" name="nombre" value="${e(rec ? rec.nombre : '')}" placeholder="Ej. Ultrasonido"></label>
        ${pickerIcono(rec ? rec.icono : 'svg:estrella')}
        <label class="check"><input type="checkbox" name="intervencion" ${!rec || rec.intervencion ? 'checked' : ''}><span>Cuenta como intervención en los totales</span></label>
        <p class="suave">Si lo desmarcas (por ejemplo, derivaciones al seguro), se registra y se cuenta aparte pero no suma a “Total de intervenciones”.</p>`,
      botones: [
        rec ? { txt: 'Eliminar', cls: 'peligro', fn: () => { K.confirmar('¿Eliminar este tratamiento? Las atenciones ya registradas dejarán de sumarlo.', 'Eliminar', () => { quitar(inf.tratamientos, rec.id); inf.indicadores = inf.indicadores.filter((i) => i.fuente !== 'trat:' + rec.id); guardar('Tratamiento eliminado'); }); return true; } } : { txt: 'Cancelar', cls: 'sec' },
        {
          txt: 'Guardar',
          fn: (m, hoja) => {
            const d = K.datos(hoja);
            if (!d.nombre.trim()) { K.aviso('Escribe un nombre', true); return false; }
            const campos = { nombre: d.nombre.trim(), icono: valIcono(hoja), intervencion: d.intervencion };
            if (rec) {
              Object.assign(rec, campos);
              inf.indicadores.filter((i) => i.fuente === 'trat:' + rec.id).forEach((i) => { i.nombre = campos.nombre; i.icono = campos.icono; });
            } else {
              const id = 't' + K.uid();
              inf.tratamientos.push(Object.assign({ id }, campos));
              inf.indicadores.push({ id: 'i-t-' + id, nombre: campos.nombre, fuente: 'trat:' + id, icono: campos.icono, grupo: 'tratamiento', visible: true });
            }
            guardar('Tratamiento guardado');
          }
        }
      ],
      alMontar: (m, hoja) => bindPicker(hoja)
    });
  };
  K.formCampoExtra = function (rec) {
    const inf = K.inf();
    K.modal({
      titulo: rec ? 'Campo de la ficha' : 'Nuevo campo en la ficha',
      cuerpo: `<p class="suave">Los campos nuevos aparecen en la ficha de cada jugador y, si tienen contenido, en una página adicional del informe.</p>
        <label class="campo"><span>Título</span><input type="text" name="titulo" value="${e(rec ? rec.titulo : '')}" placeholder="Ej. Antecedentes, Rehabilitación, Altura…"></label>
        <label class="campo"><span>Tipo</span><select name="tipo">${K.opts([['texto', 'Texto libre'], ['lista', 'Lista (una por línea)'], ['numero', 'Número'], ['si-no', 'Sí / No']], rec ? rec.tipo : 'texto')}</select></label>`,
      botones: [
        rec ? { txt: 'Eliminar', cls: 'peligro', fn: () => { K.confirmar('¿Eliminar este campo de todas las fichas?', 'Eliminar', () => { quitar(inf.camposExtra, rec.id); inf.jugadores.forEach((j) => { if (j.extras) delete j.extras[rec.id]; }); guardar('Campo eliminado'); }); return true; } } : { txt: 'Cancelar', cls: 'sec' },
        {
          txt: 'Guardar',
          fn: (m, hoja) => {
            const d = K.datos(hoja);
            if (!d.titulo.trim()) { K.aviso('Escribe un título', true); return false; }
            if (rec) { rec.titulo = d.titulo.trim(); rec.tipo = d.tipo; } else inf.camposExtra.push({ id: 'c' + K.uid(), titulo: d.titulo.trim(), tipo: d.tipo });
            guardar('Campo guardado');
          }
        }
      ]
    });
  };

  function pManual() { return `<div class="titulo-vista"><h1>Manual de uso</h1></div>${K.manualHTML()}`; }

  function pAjustes() {
    const inf = K.inf();
    const dias = K.state.ultimoRespaldo ? K.fechaCorta(K.state.ultimoRespaldo) : 'nunca';
    const demo = inf.jugadores.some((j) => j.demo);
    const fila = (i, lista, accSubir, accBajar, accEd, ico, tit, sub) => `<div class="item" data-acc="${accEd}" data-id="${i.id}"><span class="mini-ico">${K.ico(ico)}</span><div class="txt"><b>${e(tit)}</b><span>${e(sub)}</span></div>
      <button class="btn ghost chico" data-acc="${accSubir}" data-id="${i.id}" aria-label="Subir">${K.uiIco('arriba', 18)}</button><button class="btn ghost chico" data-acc="${accBajar}" data-id="${i.id}" aria-label="Bajar">${K.uiIco('abajo', 18)}</button></div>`;
    return `
      <div class="titulo-vista"><h1>Ajustes</h1></div>
      <div class="card"><h2>Este informe</h2>
        <label class="campo"><span>Nombre (para elegirlo en la app)</span><input type="text" data-inf="nombre" value="${e(inf.nombre)}"></label>
        <label class="campo"><span>Categorías que aparecen en la portada</span><input type="text" data-inf="categorias" value="${e(inf.categorias)}" placeholder="Sub 15-16"></label>
        <label class="campo"><span>Título de la portada</span><input type="text" data-inf="titulo" value="${e(inf.titulo)}"></label>
      </div>
      <div class="card"><div class="fila sb"><h2 style="margin:0">Indicadores del resumen</h2><button class="btn sec chico" data-acc="nuevoInd">${K.uiIco('mas', 16)} Nuevo</button></div>
        <p class="sub">Qué aparece en las páginas de “Resumen final”, y en qué orden. El ojo oculta o muestra.</p>
        <div class="lista">${inf.indicadores.map((i) => `<div class="item" data-acc="editInd" data-id="${i.id}"><span class="mini-ico" style="${i.visible === false ? 'opacity:.35' : ''}">${K.ico(i.icono)}</span><div class="txt"><b style="${i.visible === false ? 'opacity:.5' : ''}">${e(i.nombre)}</b><span>${i.grupo === 'general' ? 'Resumen general' : 'Tratamientos'} · ${i.fuente === 'manual' ? 'manual' : 'automático'}</span></div>
          <button class="btn ghost chico" data-acc="ojoInd" data-id="${i.id}" aria-label="Mostrar u ocultar">${K.uiIco('ojo', 18)}</button><button class="btn ghost chico" data-acc="subirI" data-id="${i.id}" aria-label="Subir">${K.uiIco('arriba', 18)}</button><button class="btn ghost chico" data-acc="bajarI" data-id="${i.id}" aria-label="Bajar">${K.uiIco('abajo', 18)}</button></div>`).join('')}</div></div>
      <div class="card"><div class="fila sb"><h2 style="margin:0">Tratamientos</h2><button class="btn sec chico" data-acc="nuevoTrat">${K.uiIco('mas', 16)} Nuevo</button></div>
        <p class="sub">Lo que aparece al registrar una atención. Cada uno genera su propio total.</p>
        <div class="lista">${inf.tratamientos.map((t) => `<div class="item" data-acc="editTrat" data-id="${t.id}"><span class="mini-ico">${K.ico(t.icono)}</span><div class="txt"><b>${e(t.nombre)}</b><span>${t.intervencion ? 'Cuenta como intervención' : 'No suma a intervenciones'}</span></div></div>`).join('')}</div></div>
      <div class="card"><h2>Tipografía</h2>
        <p class="sub">Cambia la letra de toda la app y del informe en PDF. Se guarda para los dos kinesiólogos.</p>
        ${K.selectorFuentes()}</div>
      <div class="card"><h2>Estilo de íconos</h2>
        <p class="sub">Se aplica en toda la app y en el informe. También puedes cambiarlo al elegir un ícono en “Nuevo”.</p>
        <select data-acc-change="pack" style="max-width:260px">${K.opts(K.PACKS, K.packIconos())}</select></div>
      <div class="card"><div class="fila sb"><h2 style="margin:0">Campos adicionales de la ficha</h2><button class="btn sec chico" data-acc="nuevoExtra">${K.uiIco('mas', 16)} Nuevo</button></div>
        <p class="sub">Para cualquier dato extra que quieran sumar a cada jugador (lo iremos definiendo).</p>
        ${inf.camposExtra.length ? `<div class="lista">${inf.camposExtra.map((c) => `<div class="item" data-acc="editExtra" data-id="${c.id}"><div class="txt"><b>${e(c.titulo)}</b><span>${({ texto: 'Texto libre', lista: 'Lista', numero: 'Número', 'si-no': 'Sí / No' })[c.tipo]}</span></div></div>`).join('')}</div>` : '<p class="vacio-msg" style="padding:8px">Aún no hay campos adicionales.</p>'}</div>
      <div class="card"><h2>Datos y respaldo</h2>
        <p class="sub">${K.rol === 'admin' ? 'La información está en la nube y se comparte con el otro kinesiólogo. Descargar un respaldo es opcional (una copia de seguridad en tu equipo).' : 'La información se guarda solo en este dispositivo.'} Respaldo más reciente: <b>${dias}</b>.</p>
        <div class="fila wrap gap"><button class="btn chico" data-acc="exportarTodo">${K.uiIco('descargar', 16)} Respaldo completo</button>
          <button class="btn sec chico" data-acc="exportarInforme">${K.uiIco('descargar', 16)} Solo este informe</button>
          <label class="btn sec chico" style="cursor:pointer">${K.uiIco('subir', 16)} Importar<input type="file" accept="application/json,.json" hidden data-importar></label></div>
        <hr class="sep">
        <div class="fila wrap gap">${demo ? `<button class="btn peligro chico" data-acc="quitarDemo">Quitar datos de ejemplo</button>` : `<button class="btn sec chico" data-acc="cargarDemo">Cargar datos de ejemplo</button>`}</div>
        <p class="suave" style="margin-top:8px">Los datos de ejemplo sirven para ver cómo queda el informe; se pueden quitar con un toque.</p></div>
      ${K.tarjetaSalud ? K.tarjetaSalud() : ''}
      ${K.tarjetaAcceso ? K.tarjetaAcceso() : ''}
      ${K.tarjetaCuenta ? K.tarjetaCuenta() : ''}
      <div class="card ayuda"><h2>Instalar la app</h2>
        <ol><li>Sube estos archivos a un repositorio de GitHub y activa <b>GitHub Pages</b>.</li><li>Abre la dirección en <b>Chrome</b>.</li><li>Menú ⋮ → <b>Instalar aplicación</b> (o “Agregar a pantalla de inicio”).</li></ol>
        <p style="margin:8px 0 0">Para actualizar: reemplaza los archivos en GitHub y cambia el número de versión en <code>sw.js</code>.</p></div>
      ${K.versionHTML ? K.versionHTML() : ''}`;
  }
  Object.assign(K.acciones, {
    nuevoInd() { K.formIndicador(); }, editInd(el) { K.formIndicador(K.inf().indicadores.find((i) => i.id === el.dataset.id)); },
    ojoInd(el, ev) { ev.stopPropagation(); const i = K.inf().indicadores.find((x) => x.id === el.dataset.id); i.visible = i.visible === false; guardar(); },
    subirI(el, ev) { ev.stopPropagation(); mover(K.inf().indicadores, el.dataset.id, -1); guardar(); },
    bajarI(el, ev) { ev.stopPropagation(); mover(K.inf().indicadores, el.dataset.id, 1); guardar(); },
    nuevoTrat() { K.formTratamiento(); }, editTrat(el) { K.formTratamiento(K.inf().tratamientos.find((t) => t.id === el.dataset.id)); },
    nuevoExtra() { K.formCampoExtra(); }, editExtra(el) { K.formCampoExtra(K.inf().camposExtra.find((c) => c.id === el.dataset.id)); },
    exportarTodo() { K.exportar(false); K.aviso('Respaldo descargado'); K.render(); },
    exportarInforme() { K.exportar(true); K.aviso('Informe descargado'); K.render(); },
    cargarDemo() { K.cargarDemo(); guardar('Datos de ejemplo cargados'); },
    quitarDemo() { K.quitarDemo(); guardar('Datos de ejemplo quitados'); }
  });

  /* ======================= Enrutador y eventos ======================= */
  K.PANTALLAS = [['informe', 'Informe', pInforme], ['registrar', 'Registrar', pRegistrar], ['jugadores', 'Jugadores', pJugadores], ['calendario', 'Partidos', pCalendario], ['manual', 'Manual', pManual], ['ajustes', 'Ajustes', pAjustes]];
  K.render = function () {
    const inf = K.inf();
    if (!inf) { document.body.classList.remove('inicio'); document.getElementById('top').innerHTML = `<img src="img/insignia-512.png" alt=""><div class="tit"><b>Kinesiología Fútbol Joven SW</b><span>Sin informes</span></div>${K.chipNube ? K.chipNube() : ''}`; document.getElementById('view').innerHTML = '<div class="card"><p class="vacio-msg">Todavía no hay informes publicados.</p></div>'; return; }
    const per = periodo();
    const top = document.getElementById('top');
    document.body.classList.toggle('inicio', !K.ui.cat);
    top.innerHTML = `<img src="img/insignia-512.png" alt=""><div class="tit"><b>Kinesiología Fútbol Joven SW</b><span>${K.ui.cat ? (K.rol === 'tecnico' ? e(K.vistaTexto()) : 'Sub ' + K.ui.cat + ' · informe ' + e(inf.nombre)) + ' · ' + e(per.completo) : 'Inicio'}</span></div>${K.chipNube ? K.chipNube() : ''}${K.rol === 'tecnico' ? K.selectorVista() : K.selectorCat()}`;
    document.getElementById('nav').innerHTML = K.PANTALLAS.map(([id, t]) => `<button data-nav="${id}" class="${(K.ui.pantalla === 'bitacora' ? 'informe' : K.ui.pantalla) === id ? 'act' : ''}" aria-label="${t}">${K.uiIco(id, 24)}<span>${t}</span></button>`).join('');
    if (!K.puedeEditar()) K.ui.pantalla = 'informe';
    const pant = K.ui.pantalla === 'bitacora' && K.pBitacora ? ['bitacora', 'Registro clínico', K.pBitacora] : K.PANTALLAS.find((p) => p[0] === K.ui.pantalla) || K.PANTALLAS[0];
    const y = window.scrollY;
    document.getElementById('view').innerHTML = K.ui.cat ? pant[2]() : K.rol === 'tecnico' ? K.inicioTecnico() : K.inicioHTML();
    K.escalar();
    window.scrollTo(0, y);
    if (K.postRender) K.postRender();
  };
  K.refrescar = () => K.render();
  K.escalar = function () {
    document.querySelectorAll('.vista-wrap').forEach((w) => {
      const c = w.querySelector('.vista-paginas');
      const s = Math.min(1, (w.clientWidth - 16) / 816);
      c.style.zoom = s > 0 ? s : 1;
    });
  };
  window.addEventListener('resize', () => K.escalar());

  document.addEventListener('click', (ev) => {
    const nav = ev.target.closest('[data-nav]');
    if (nav) { K.ui.pantalla = nav.dataset.nav; if (K.ui.pantalla !== 'jugadores') K.ui.jugadorId = null; if (K.ui.pantalla !== 'calendario') K.ui.partidoId = null; K.render(); window.scrollTo(0, 0); return; }
    const reg = ev.target.closest('[data-reg]');
    if (reg && !ev.target.closest('[data-acc]')) { K.acciones.reg(reg); return; }
    const a = ev.target.closest('#view [data-acc]');
    if (a && K.acciones[a.dataset.acc]) K.acciones[a.dataset.acc](a, ev);
  });
  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (!K.state || !t.closest('#view')) return;
    if (t.dataset.accChange && K.acciones[t.dataset.accChange]) return K.acciones[t.dataset.accChange](t, ev);
    const inf = K.inf();
    if (t.dataset.inf) { inf[t.dataset.inf] = t.value; K.guardar(); K.render(); return; }
    if (t.dataset.infG) { K.informeGrupo(K.GRUPOS[0])[t.dataset.infG] = t.value; K.guardar(); K.render(); return; }
    if (t.dataset.campo) { const j = K.jugador(inf, K.ui.jugadorId); j[t.dataset.campo] = t.value; K.guardar(); K.render(); return; }
    if (t.dataset.extra) { const j = K.jugador(inf, K.ui.jugadorId); j.extras = j.extras || {}; j.extras[t.dataset.extra] = t.type === 'checkbox' ? t.checked : t.value; K.guardar(); K.render(); return; }
    if (t.dataset.importar !== undefined && t.files && t.files[0]) {
      const f = t.files[0];
      f.text().then((txt) => K.importarArchivo(txt, (msg) => guardar(msg)));
      t.value = '';
    }
  });
  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.matches && t.matches('textarea[data-inf="conclusiones"],textarea[data-inf="objetivos"],textarea[data-inf-g="conclusionesTodas"],textarea[data-inf-g="objetivosTodas"]')) { const av = t.parentNode.querySelector('.cap-aviso'); if (av) av.hidden = K.textoCabe(t.value); }
    if (t.dataset && t.dataset.accInput && K.acciones[t.dataset.accInput]) K.acciones[t.dataset.accInput](t, ev);
  });
})();

/* Arranque, impresión/PDF y datos de ejemplo. */
(function () {
  const K = window.K;

  K.normalizar = function (inf) {
    ['partidos', 'staff', 'jugadores', 'camposExtra', 'casos', 'atenciones', 'eventos', 'manuales', 'tratamientos', 'indicadores', 'asistencias', 'seguros', 'segEventos', 'torneos', 'antecedentes', 'documentos']
      .forEach((k) => { if (!Array.isArray(inf[k])) inf[k] = []; });
    inf.conclusiones = inf.conclusiones || ''; inf.objetivos = inf.objetivos || '';
    // v1.6.1: ya no existen la evolución (SOAP) ni los tests y criterios de retorno: se borran si vienen de un respaldo anterior
    inf.atenciones.forEach((a) => { if (a && typeof a === 'object') delete a.soap; });
    inf.casos.forEach((c) => { if (c && typeof c === 'object') { delete c.tests; delete c.criterios; } });
    if (!Array.isArray(inf.plantillas)) inf.plantillas = []; // plantillas de intervenciones (v1.6, uso diario)
    if (K.conmocion) K.conmocion.normalizarInforme(inf); // conmoción cerebral (v1.6): deja válidos scat5, conmocion y rtpConmocion si existen
    if (K.torneos) K.torneos.normalizar(inf); // torneos como ficha propia (v1.6): deja válidos los campos y enlaza los partidos que solo tenían el texto del torneo
    inf.partidos.forEach((p) => {
      p.minutos = p.minutos || {}; if (!Array.isArray(p.incidencias)) p.incidencias = [];
      // citados (v1.6): solo existe si alguien lo definió; un partido sin esta lista cuenta con todos los de la categoría
      if (p.citados !== undefined) { if (Array.isArray(p.citados)) { const v = Array.from(new Set(p.citados.filter((x) => typeof x === 'string' && x))); if (v.length !== p.citados.length) p.citados = v; } else delete p.citados; }
    });
    // Intervenciones nuevas (manejo de carga, farmacología, derivación externa, sangrado, ortopedia, inmovilización)
    K.TRATAMIENTOS_BASE.filter((t) => K.TRAT_NUEVOS.includes(t.id)).forEach((t) => {
      if (!inf.tratamientos.some((x) => x.id === t.id)) inf.tratamientos.push(Object.assign({}, t));
      if (!inf.indicadores.some((i) => i.fuente === 'trat:' + t.id)) inf.indicadores.push({ id: 'i-t-' + t.id, nombre: t.nombre, fuente: 'trat:' + t.id, icono: t.icono, grupo: 'tratamiento', visible: true });
    });
    // Temporadas: los textos de siempre pertenecen al año vigente (nunca anterior al año actual, para que lo ya escrito se siga viendo en el informe de este año)
    if (!Number.isInteger(inf.anioTexto)) inf.anioTexto = Math.max(Number(inf.anio) || 0, new Date().getFullYear());
    if (!Number.isInteger(inf.tempIniciada)) inf.tempIniciada = inf.anioTexto;
    if (!inf.anios || typeof inf.anios !== 'object' || Array.isArray(inf.anios)) inf.anios = {};
    inf.jugadores.forEach((j) => {
      j.extras = j.extras || {}; if (j.plantel) j.contrato = true; delete j.plantel; // campo antiguo j.plantel: pasa a j.contrato (el campo interno se llama contrato; en pantalla es “Jugador de plantel”)
      if (!j.estado) j.estado = 'inscrito';
      if (j.estado !== 'inscrito' && !/^\d{4}-\d{2}-\d{2}$/.test(j.salida || '')) j.salida = K.hoy(); // un archivado siempre tiene fecha de salida
      if (!j.anios || typeof j.anios !== 'object' || Array.isArray(j.anios)) j.anios = {};
    });
    K.mayusInforme(inf); // datos viejos: primera letra en mayúscula y nombres de personas con mayúscula en cada palabra
    return inf;
  };

  /* ---------- Descargar PDF: se genera el archivo aquí mismo (sirve en iPhone) y se abre “Compartir” o se descarga ---------- */
  K.imprimir = function (alcance) {
    const previo = K.ui.alcance;
    if (alcance) K.ui.alcance = alcance;
    let inf, per;
    try { per = K.resolverPeriodo(K.state.periodo); inf = K.informeVista(K.inf(), per); } finally { K.ui.alcance = previo; }
    K._paraPdf = true; // en el PDF no se imprimen los textos de ayuda de la pantalla
    let pag; try { pag = K.paginas(inf, per); } finally { K._paraPdf = false; }
    return K.pdf.paginas(pag, `Informe kinésico ${inf.nombre}${K.sinFichas(inf) ? ' (resumen sin fichas)' : ''} - ${per.completo}`);
  };

  /* ---------- Datos de ejemplo ---------- */
  K.cargarDemo = function () {
    const inf = K.inf(), anio = Number(K.state.periodo.anio) || new Date().getFullYear();
    const d = (m, dia) => `${anio}-${K.pad(m)}-${K.pad(dia)}`;
    const mk = (nombre, cat, nac, pos) => K.nuevoJugador({ nombre, categoria: cat, nacimiento: nac, posicion: pos, demo: true });
    const m = mk('Jugador de ejemplo 1', 'Sub 16', '2010', 'Portero');
    const j2 = mk('Jugador de ejemplo 2', 'Sub 15', '2011', 'Volante');
    const j3 = mk('Jugador de ejemplo 3', 'Sub 16', '2010', 'Delantero');
    inf.jugadores.push(m, j2, j3);
    inf.partidos.forEach((p, i) => {
      if (!p.jugado) return;
      p.minutos[m.id] = 90;
      if (i % 2 === 0) p.minutos[j2.id] = 90; else p.minutos[j3.id] = i % 3 === 0 ? 45 : 90;
    });
    const caso = (j, tipo, titulo, contexto, grav, zonas, ini, alta, sem) => inf.casos.push({ id: K.uid(), jugadorId: j.id, tipo, titulo, contexto, gravedad: grav, zonas, inicio: ini, alta: alta || '', semanas: sem === undefined ? '' : sem, mecanismo: '', notas: '', demo: true });
    caso(m, 'lesion', 'Desgarro psoas derecho', '', 'moderada', ['F-cadera-d'], d(8, 12), d(9, 16), 5);
    caso(m, 'molestia', 'Tendón de Aquiles', 'post partido', 'leve', ['E-aquiles-d'], d(9, 3), '');
    caso(m, 'molestia', 'Muñeca', 'golpe de balón', 'leve', ['F-mano-i'], d(10, 5), '');
    caso(j2, 'lesion', 'Esguince de tobillo grado II', '', 'grave', ['F-tobillo-d'], d(8, 20), d(9, 30));
    caso(j2, 'molestia', 'Sobrecarga de isquiotibiales', 'post entrenamiento', 'moderada', ['E-isquios-i'], d(10, 10), '');
    caso(j3, 'molestia', 'Dolor de rodilla', '', 'leve', ['F-rodilla-d'], d(9, 25), '');
    const at = (j, f, trat) => inf.atenciones.push({ id: K.uid(), fecha: f, jugadorId: j.id, casoId: '', trat, notas: '', demo: true });
    at(m, d(8, 13), { vendaje: 1, crio: 1 }); at(m, d(8, 20), { vendaje: 1 }); at(m, d(9, 2), { vendaje: 1, masaje: 1 });
    at(m, d(9, 10), { crio: 1 }); at(m, d(9, 14), { ejercicio: 1 }); at(m, d(10, 8), {});
    at(j2, d(8, 21), { hielo: 1, vendaje: 1 }); at(j2, d(8, 28), { ejercicio: 2, electro: 1 }); at(j2, d(9, 9), { ejercicio: 1, preso: 1 });
    at(j2, d(10, 11), { masaje: 1, termo: 1 }); at(j2, d(10, 18), { masaje: 1, seguro: 1 });
    at(j3, d(9, 26), { crio: 1 }); at(j3, d(10, 2), { vendaje: 1, heridas: 1 }); at(j3, d(10, 15), { hielo: 1 });
    const ev = (j, tipo, f, nombre, cant) => inf.eventos.push({ id: K.uid(), tipo, fecha: f, jugadorId: j.id, nombre, cantidad: cant, casoId: '', notas: '', demo: true });
    ev(m, 'control', d(8, 18), 'Traumatólogo', 3); ev(m, 'examen', d(8, 14), 'Radiografía', 1); ev(m, 'examen', d(8, 25), 'RNM', 2);
    ev(j2, 'control', d(8, 24), 'Traumatólogo', 2); ev(j2, 'examen', d(8, 22), 'Radiografía', 1); ev(j2, 'medicamento', d(8, 21), 'Ibuprofeno', 4);
    ev(j3, 'medicamento', d(9, 26), 'Paracetamol', 2);
  };
  function quitarJugadorYRegistros(inf, id) { K.quitarJugador(id); }
  K.quitarDemo = function () {
    const inf = K.inf();
    inf.jugadores.filter((j) => j.demo).map((j) => j.id).forEach((id) => quitarJugadorYRegistros(inf, id));
    K.ui.jugadorId = null;
  };

  /* ---------- Actualizaciones: aviso cuando hay una versión nueva ---------- */
  K.registrarSW = function () {
    const puede = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol);
    if (!puede) return;
    let recargando = false;
    const avisar = (reg) => {
      if (document.getElementById('update-banner')) return;
      const b = document.createElement('div');
      b.id = 'update-banner'; b.setAttribute('role', 'status');
      b.innerHTML = '<span><b>Hay una nueva versión disponible.</b> Actualiza para tener las últimas mejoras.</span><button type="button" class="btn chico" data-actualizar>Actualizar</button><button type="button" class="btn ghost chico" data-despues aria-label="Después">×</button>';
      document.body.appendChild(b);
      b.querySelector('[data-actualizar]').onclick = async () => {
        b.querySelector('[data-actualizar]').textContent = 'Actualizando…';
        try { K.guardarYa && K.guardarYa(); if (K.nube && K.nube.vaciar) await Promise.race([K.nube.vaciar(), new Promise((r) => setTimeout(r, 3000))]); } catch (x) { /* sigue */ }
        if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING'); else location.reload();
      };
      b.querySelector('[data-despues]').onclick = () => b.remove();
    };
    const teniaControl = !!navigator.serviceWorker.controller; // en la primera visita no hace falta recargar
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (recargando || !teniaControl) return; recargando = true; location.reload(); });
    navigator.serviceWorker.register('sw.js').then((reg) => {
      const vigilar = (w) => w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) avisar(reg); });
      if (reg.waiting && navigator.serviceWorker.controller) avisar(reg);
      reg.addEventListener('updatefound', () => reg.installing && vigilar(reg.installing));
      const buscar = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (!document.hidden) buscar(); });
      setInterval(buscar, 30 * 60 * 1000);
    }).catch(() => {});
  };

  /* ---------- Arranque ---------- */
  (async function iniciar() {
    if (K.nubeActiva && K.nubeActiva()) { K.registrarSW(); K.nube.arrancar(); return; } // modo en línea
    let st = null;
    try { st = await K.cargar(); } catch (x) { /* inicia vacío */ }
    if (st && Array.isArray(st.informes) && st.informes.length) {
      K.state = st;
      K.state.informes.forEach(K.normalizar);
      if (!K.state.informes.some((i) => i.id === K.state.activo)) K.state.activo = K.state.informes[0].id;
      K.state.periodo = K.state.periodo || { tipo: 'anual', anio: new Date().getFullYear(), desde: '', hasta: '' };
      K.periodoPorDefecto();
    } else {
      K.state = K.estadoInicial();
      K.guardarYa();
    }
    K.render();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) K.registrarSW();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  })();
})();

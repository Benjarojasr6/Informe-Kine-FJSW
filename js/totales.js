/* Informe → «Totales del período» (v1.9.0): al tocar un total se ve, además del detalle y los ajustes manuales, una estadística de ESE total:
   por jugador, por mes y por categoría, dónde ocurrió (partido / consulta kine / entrenamiento… y la zona del cuerpo) y el listado con fechas. */
(function () {
  const K = window.K, e = K.esc;
  const MES3 = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const EV = { controles: 'control', examenes: 'examen', procedimientos: 'procedimiento', medicamentos: 'medicamento', cirugias: 'cirugia' };
  const zonaTxt = (z) => K.nombreZonaLimpia ? K.nombreZonaLimpia(z) : K.nombreZona(z);

  // Registros que suman al total (sin los ajustes manuales). Cada uno: { f, jid, cant, donde, zonas[], txt }
  K.totalRegistros = function (inf, per, ind) {
    const src = ind.fuente, out = [];
    const casoDe = (id) => (id ? inf.casos.find((c) => c.id === id) : null);
    const enP = (f) => K.enPeriodo(f, per);
    if (src === 'lesiones' || src === 'molestias') {
      const tipo = src === 'lesiones' ? 'lesion' : 'molestia';
      inf.casos.forEach((c) => {
        if ((tipo === 'lesion') !== (c.tipo === 'lesion') || !enP(c.inicio)) return;
        out.push({ f: c.inicio, jid: c.jugadorId, cant: 1, donde: (K.nombreMecanismo(c.mecanismo) || 'Sin dato'), zonas: (c.zonas || []).slice(), txt: c.titulo || '' });
      });
    } else if (src === 'atenciones' || src === 'intervenciones' || src.startsWith('trat:')) {
      const tid = src.startsWith('trat:') ? src.slice(5) : '';
      inf.atenciones.forEach((a) => {
        if (!enP(a.fecha)) return;
        let cant = 1;
        if (src === 'intervenciones') { cant = Object.keys(a.trat || {}).reduce((s, id) => { const t = K.trat(inf, id); return s + (t && t.intervencion ? Number(a.trat[id]) || 0 : 0); }, 0); }
        else if (tid) cant = Number((a.trat || {})[tid]) || 0;
        if (!cant) return;
        const c = casoDe(a.casoId); let zonas = c ? (c.zonas || []).slice() : [];
        let donde = a.partidoId ? 'Partido' : 'Consulta en sala de kine';
        if (a.partidoId) {
          const p = inf.partidos.find((x) => x.id === a.partidoId), inc = p && (p.incidencias || []).find((x) => x.id === a.incId);
          if (inc && inc.zona && !zonas.length) zonas = [inc.zona];
        }
        const nt = Object.keys(a.trat || {}).filter((id) => a.trat[id] > 0).map((id) => (K.trat(inf, id) || { nombre: id }).nombre);
        out.push({ f: a.fecha, jid: a.jugadorId, cant, donde, zonas, txt: tid ? '' : nt.join(', ') });
      });
    } else if (EV[src]) {
      inf.eventos.forEach((v) => {
        if (v.tipo !== EV[src] || !enP(v.fecha) || !K.evRealizado(v)) return;
        const c = casoDe(v.casoId);
        out.push({ f: v.fecha, jid: v.jugadorId, cant: Number(v.cantidad) || 1, donde: '', zonas: c ? (c.zonas || []).slice() : [], txt: v.nombre || '' });
      });
    }
    return out;
  };

  const catDe = (inf, per, jid) => {
    const j = inf.jugadores.find((x) => x.id === jid); if (!j) return 'Sin categoría';
    if (K.tieneHistorial && K.tieneHistorial(j)) { const n = K.catPeriodo(j, per.desde, per.hasta); if (n) return 'Sub ' + n; }
    return j.categoria || 'Sin categoría';
  };
  const nombre = (inf, jid) => { const j = inf.jugadores.find((x) => x.id === jid); return j ? j.nombre : (K.nombreJugadorGlobal ? K.nombreJugadorGlobal(jid) : '—'); };

  K.totalEstadHTML = function (inf, per, ind) {
    if (ind.fuente === 'manual') return '<p class="suave">Este total solo tiene ajustes manuales: no hay registros para mostrar una estadística.</p>';
    const reg = K.totalRegistros(inf, per, ind), hbar = K.bd.hbar;
    if (!reg.length) return '<p class="suave">Todavía no hay registros de esto en el período.</p>';
    const suma = (o, k, v) => { o[k] = (o[k] || 0) + v; };
    const total = reg.reduce((s, r) => s + r.cant, 0);
    const lista = (o, n) => Object.keys(o).map((k) => [k, o[k]]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).slice(0, n || 99);
    // por jugador
    const pj = {}; reg.forEach((r) => suma(pj, nombre(inf, r.jid), r.cant));
    const filasJ = lista(pj), nJ = filasJ.length;
    const porJugador = `<p class="suave" style="margin:0 0 6px">${nJ} jugador${nJ === 1 ? '' : 'es'} · ${total} en total</p>${hbar(filasJ.slice(0, 12))}${nJ > 12 ? `<p class="suave" style="margin:4px 0 0">y ${nJ - 12} jugador${nJ - 12 === 1 ? '' : 'es'} más con menos registros.</p>` : ''}`;
    // por mes y por categoría
    const meses = K.mesesPeriodo(per), pm = meses.map((m) => reg.filter((r) => (r.f || '').slice(0, 7) === m.clave).reduce((s, r) => s + r.cant, 0));
    const pc = {}; reg.forEach((r) => suma(pc, catDe(inf, per, r.jid), r.cant));
    const porMes = `<div class="tot-meses">${meses.map((m, i) => `<div class="tot-m"><b>${pm[i]}</b><i style="height:${Math.max(pm[i] ? 4 : 0, Math.round(60 * pm[i] / Math.max(1, ...pm)))}px"></i><span>${MES3[m.m - 1]}</span></div>`).join('')}</div>
      <h4 class="tot-h">Por categoría</h4>${hbar(lista(pc).sort((a, b) => b[0].localeCompare(a[0], 'es', { numeric: true })), '#3b5bb5')}`;
    // dónde ocurrió
    const pd = {}, pz = {}; let conDonde = false;
    reg.forEach((r) => { if (r.donde) { conDonde = true; suma(pd, r.donde, r.cant); } (r.zonas || []).forEach((z) => suma(pz, zonaTxt(z), r.cant)); });
    const donde = (conDonde ? `<h4 class="tot-h" style="margin-top:0">Dónde ocurrió</h4>${hbar(lista(pd), '#2f7a4a')}` : '')
      + (Object.keys(pz).length ? `<h4 class="tot-h"${conDonde ? '' : ' style="margin-top:0"'}>Zona del cuerpo</h4>${hbar(lista(pz, 8), '#c98f00')}<p class="suave" style="margin:4px 0 0;font-size:12px">Una zona se cuenta cuando el registro está asociado a una lesión, molestia o incidencia con zona.</p>` : '')
      || '<p class="suave">Estos registros no tienen dato de dónde ocurrieron.</p>';
    // listado con fechas
    const ord = reg.slice().sort((a, b) => (b.f || '').localeCompare(a.f || '') || nombre(inf, a.jid).localeCompare(nombre(inf, b.jid), 'es'));
    const CAP = 60;
    const listado = `<div class="tot-lista">${ord.slice(0, CAP).map((r) => `<div class="tot-fila"><b>${e(K.fechaCorta(r.f))}</b><span>${e(nombre(inf, r.jid))}${r.cant > 1 ? ` <em>×${r.cant}</em>` : ''}<small>${e([r.donde, r.txt, r.zonas.map(zonaTxt).join(', ')].filter(Boolean).join(' · '))}</small></span></div>`).join('')}</div>${ord.length > CAP ? `<p class="suave" style="margin:4px 0 0">Se muestran los ${CAP} más recientes de ${ord.length}.</p>` : ''}`;
    const det = (t, cuerpo, abierto) => `<details class="tot-det"${abierto ? ' open' : ''}><summary>${e(t)}</summary><div class="tot-cuerpo">${cuerpo}</div></details>`;
    return `<h3 class="tot-t">Estadística de este total</h3>${det('Por jugador', porJugador, true)}${det('Por mes y por categoría', porMes)}${det('Dónde ocurrió', donde)}${det('Listado con fechas', listado)}`;
  };
})();

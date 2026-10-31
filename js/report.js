/* Generación de las páginas del informe (tamaño carta). Se usan igual en pantalla y al imprimir. */
(function () {
  const K = window.K;
  const e = K.esc;

  const PIE = (n) => `<div class="pie"><span>Santiago Wanderers · Kinesiología Fútbol Joven SW</span><span>${n}</span></div>`;
  const pagina = (cls, inner) => `<section class="pagina ${cls}"><div class="panel">${inner}<!--PIE--></div></section>`;
  const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out.length ? out : [[]];
  };
  // Reparte filas de tabla en páginas por ALTO estimado (no solo por cantidad): si una fila se alarga por un texto largo, caben menos por página.
  const lin = (t, ancho) => Math.max(1, Math.ceil(String(t || '').length / ancho));
  const chunkH = (arr, costo, max, cap) => {
    const out = []; let act = [], h = 0;
    arr.forEach((x) => { const c = costo(x); if (act.length && (act.length >= max || h + c > cap)) { out.push(act); act = []; h = 0; } act.push(x); h += c; });
    if (act.length) out.push(act);
    return out.length ? out : [[]];
  };
  // ¿Cabe el texto de Conclusiones/Objetivos en su caja aun con la letra más chica? (≈100 caracteres por línea a 12,5 px)
  const lineasTxt = (txt, f) => String(txt).split('\n').reduce((t, l) => t + Math.max(1, Math.ceil(l.length / (100 * 12.5 / f))), 0);
  K.textoCabe = (txt) => lineasTxt(txt || '', 9.5) * 9.5 * 1.3 <= 300;
  const subtitulo = (inf, per) => `<p class="sub-periodo">${e(per.completo)} · ${e(inf.categorias)}</p>`;

  /* ---------- Portada ---------- */
  function portada(inf, per) {
    return pagina('portada', `
      <img class="p-marca" src="img/escudo-sw-verde.png" alt="">
      <div class="p-titulo">
        <p class="p-club">Santiago Wanderers · Fútbol Joven</p>
        <h1>${e(inf.titulo).replace(/ (\S+)$/, '<br>$1')}</h1>
      </div>
      <div class="p-pie">
        <p class="p-cat">Categorías ${e(inf.categorias.replace(/^Categor[ií]as?\s*/i, ''))}</p>
        <p class="p-per">${e(per.completo)}</p>
      </div>`);
  }

  /* ---------- Calendario y cuerpo técnico ---------- */
  function tarjetaPartido(j) {
    const logo = j.logoData ? `<img src="${e(j.logoData)}" alt="">` : j.logo ? `<img src="img/rivales/${e(j.logo)}.png" alt="">` : `<span class="sin-logo">${e((j.rival || '?').slice(0, 1))}</span>`;
    const fecha = j.fecha ? K.fechaCorta(j.fecha).slice(0, 5) : '';
    const res = j.ps.filter((p) => p.res || j.ps.length > 1).map((p) => `<small>${p.cat ? 'Sub ' + p.cat + ' · ' : ''}${e(p.res || '—')}</small>`).join('');
    return `<div class="partido${j.jugado ? '' : ' pendiente'}">${logo}<div class="p-txt"><b>${e(j.rival)}</b><span>${j.local ? 'LOCAL' : 'VISITA'}${fecha ? ' · ' + fecha : ''}</span>${res}</div></div>`;
  }
  function filaStaff(s) {
    const nombres = s.personas.length
      ? s.personas.map((p) => `<span class="pers${p.ocasional ? ' ocasional' : ''}">${e(p.nombre)}${p.ocasional ? ' <em>(apoyo)</em>' : ''}</span>`).join('')
      : '<span class="pers vacio">&nbsp;</span>';
    return `<div class="staff-fila"><div class="staff-cargo">${e(s.cargo)}</div><div class="staff-nombres">${nombres}</div></div>`;
  }
  function calendarioPaginas(inf, per) {
    const enPer = K.jornadas(inf).filter((j) => K.partidoEnPeriodo(j.p0, per));
    const partidos = enPer.slice().sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999') || 0);
    // Orden manual (flechas o arrastrar en Partidos) o por fecha; sin fechas se respeta el orden original.
    const lista = inf.ordenPartidos ? enPer : partidos.some((j) => j.fecha) ? partidos : enPer;
    // Campeonato normal y, aparte, cada torneo especial (Libertadores, copas…) con su propio título.
    const regulares = lista.filter((j) => !j.torneo), nombresT = []; lista.forEach((j) => { if (j.torneo && !nombresT.includes(j.torneo)) nombresT.push(j.torneo); });
    const grupos = [['Partidos jugados', regulares]].concat(nombresT.map((t) => ['Torneo · ' + t, lista.filter((j) => j.torneo === t)]));
    const gruposVisibles = grupos.filter(([, arr], i) => arr.length || (i === 0 && !nombresT.length));
    const TIT = 'Cuerpo Técnico y Calendario de partidos';
    const calGrupo = ([tit, arr]) => `<h3 class="sec">${e(tit)}</h3>${arr.length ? `<div class="cal">${arr.map(tarjetaPartido).join('')}</div>` : '<p class="cal-vacio">Aún no hay partidos cargados en este período.</p>'}`;
    const staffHTML = (arr) => `<h3 class="sec">Cuerpo técnico</h3><div class="staff">${arr.map(filaStaff).join('')}</div>`;
    // Alturas medidas en páginas reales (px): título 30 · encabezado de bloque 45 · cargo 54 (+18 por cada persona sobre 3) · fila de 5 partidos 138.
    // Los bloques se acomodan en páginas hasta llenarlas (antes quedaban páginas casi vacías).
    const CAP = 975;
    const pags = []; let cur = null;
    const nueva = () => { cur = { h: 30, partes: [] }; pags.push(cur); };
    const poner = (h, html) => { if (!cur || (cur.partes.length && cur.h + h > CAP)) nueva(); cur.partes.push(html); cur.h += h; };
    (inf.staff.length ? chunk(inf.staff, 8) : []).forEach((arr) => poner(45 + 11 + arr.reduce((t, x) => t + 54 + Math.max(0, x.personas.length - 3) * 18, 0), staffHTML(arr)));
    gruposVisibles.forEach(([tit, arr]) => {
      if (!arr.length) { poner(85, calGrupo([tit, []])); return; }
      let resto = arr.slice();
      while (resto.length) {
        if (!cur || CAP - cur.h < 45 + 138) nueva();                // no cabe ni una fila: página nueva
        const filas = Math.max(1, Math.min(Math.ceil(resto.length / 5), Math.floor((CAP - cur.h - 45) / 138)));
        const parte = resto.splice(0, filas * 5);
        cur.partes.push(calGrupo([tit, parte])); cur.h += 45 + filas * 138;
      }
    });
    if (!pags.length) pags.push({ partes: [] });
    return pags.map((pg, i) => pagina('p-cal', `<h2>${TIT}${i ? ' <small>(cont.)</small>' : ''}</h2>${pg.partes.join('')}`));
  }

  /* ---------- Resumen ---------- */
  function resumenPaginas(inf, per) {
    const cont = K.contar(inf, per);
    const vis = inf.indicadores.filter((i) => i.visible !== false);
    const val = (i) => K.valorIndicador(inf, per, i, cont).total;
    const gen = vis.filter((i) => i.grupo === 'general' && i.fuente !== 'atenciones');
    const tra = vis.filter((i) => i.grupo !== 'general');
    const out = [];
    // Lo primero y más grande: total de atenciones realizadas (del período y, siempre, del año)
    const indAt = inf.indicadores.find((i) => i.fuente === 'atenciones') || { id: 'i-atenciones', fuente: 'atenciones' };
    const anioPer = per.desde.slice(0, 4), perAnio = K.resolverPeriodo({ tipo: 'anual', anio: anioPer });
    const totPer = K.valorIndicador(inf, per, indAt, cont).total, totAnio = K.valorIndicador(inf, perAnio, indAt).total;
    const hero = per.tipo === 'anual'
      ? `<div class="hero-at"><div class="ha-card ha-solo"><span>Total de atenciones realizadas · año ${e(anioPer)}</span><b>${totAnio}</b></div></div>`
      : `<div class="hero-at"><div class="ha-card ha-grande"><span>Total de atenciones realizadas · ${e(per.etiqueta)}</span><b>${totPer}</b></div><div class="ha-card"><span>Total de atenciones del año ${e(anioPer)}</span><b>${totAnio}</b></div></div>`;
    const grupos = chunk(gen, 8);
    if (!grupos.length) grupos.push([]);
    grupos.forEach((arr, k) => {
      out.push(pagina('p-resumen', `<h2>Resumen final${k ? ' <small>(cont.)</small>' : ''}</h2>${subtitulo(inf, per)}${k ? '' : hero}
        <div class="ind-lista">${arr.map((i) => `<div class="ind-fila">${K.ico(i.icono, 'ico-l')}<span class="et">${e(i.nombre)}</span><b>${val(i)}</b></div>`).join('')}</div>`));
    });
    chunk(tra, 12).forEach((arr, k) => {
      out.push(pagina('p-resumen', `<h2>Resumen final${gen.length || k ? ' <small>(tratamientos)</small>' : ''}</h2>${subtitulo(inf, per)}
        <div class="trat-grid">${arr.map((i, n) => `<div class="trat-celda${n % 2 ? ' der' : ''}">${K.ico(i.icono, 'ico-t')}<div class="trat-txt"><b>${val(i)}</b><span>${e(i.nombre)}</span></div></div>`).join('')}</div>`));
    });
    return out;
  }

  /* ---------- Ficha individual ---------- */
  const PALETA = ['#154c2b', '#e0a82e', '#5f9a77', '#7c868b', '#b5d3c0', '#b98b2e', '#2f7a4a', '#aab4ae', '#d9bb73', '#3f7d5a'];
  function donut(lista, total) {
    const cx = 170, cy = 130, R = 78, r = 46;
    if (!lista.length) {
      return `<svg class="donut" viewBox="0 0 340 260"><circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="#dfe8e2" stroke-width="${R - r}"/><text x="${cx}" y="${cy + 12}" text-anchor="middle" class="d-total">0</text><text x="${cx}" y="${cy + 120}" text-anchor="middle" class="d-vacio">Sin intervenciones registradas</text></svg>`;
    }
    const suma = lista.reduce((s, x) => s + x.n, 0);
    let a0 = -Math.PI / 2;
    let segs = '', rot = '';
    lista.forEach((x, i) => {
      const frac = x.n / suma;
      const a1 = a0 + frac * Math.PI * 2;
      const col = PALETA[i % PALETA.length];
      if (lista.length === 1) {
        segs += `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${col}" stroke-width="${R - r}"/>`;
      } else {
        const p = (rad, a) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
        const [x0, y0] = p(R, a0), [x1, y1] = p(R, a1), [x2, y2] = p(r, a1), [x3, y3] = p(r, a0);
        const lg = frac > 0.5 ? 1 : 0;
        segs += `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 ${lg} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} A${r} ${r} 0 ${lg} 0 ${x3.toFixed(1)} ${y3.toFixed(1)} Z" fill="${col}"/>`;
      }
      const am = (a0 + a1) / 2;
      const lx = cx + (R + 12) * Math.cos(am), ly = cy + (R + 12) * Math.sin(am);
      const der = Math.cos(am) >= 0;
      // la etiqueta no puede salirse del dibujo (340 px de ancho): se acorta según el espacio que hay hacia su lado (≈5,6 px por letra, con 6 px de margen que el dibujo admite)
      const ancla = Math.abs(Math.cos(am)) < 0.2 ? 'm' : der ? 's' : 'e';
      const espacio = 28 + (ancla === 'e' ? lx : ancla === 's' ? 340 - lx : 2 * Math.min(lx, 340 - lx));
      const ancho = (t) => [...t].reduce((w, ch) => w + (/[MW@%]/.test(ch) ? 10 : /[mw]/.test(ch) ? 9.8 : /[A-ZÑÁÉÍÓÚÜ]/.test(ch) ? 8 : /[ilItfjr.,;:·'() ]/.test(ch) ? 3.8 : 6.8), 0);
      let nombre = x.nombre.length > 24 ? x.nombre.slice(0, 23) + '…' : x.nombre;
      if (ancho(nombre) > espacio) { let t = nombre.replace(/…$/, ''); while (t.length > 3 && ancho(t) + 6 > espacio) t = t.slice(0, -1); nombre = t.replace(/\s+$/, '') + '…'; }
      rot += `<text x="${lx.toFixed(1)}" y="${(ly - 2).toFixed(1)}" text-anchor="${Math.abs(Math.cos(am)) < 0.2 ? 'middle' : der ? 'start' : 'end'}" class="d-et">${e(nombre)}</text><text x="${lx.toFixed(1)}" y="${(ly + 11).toFixed(1)}" text-anchor="${Math.abs(Math.cos(am)) < 0.2 ? 'middle' : der ? 'start' : 'end'}" class="d-n">${x.n}</text>`;
      a0 = a1;
    });
    return `<svg class="donut" viewBox="0 0 340 260">${segs}<text x="${cx}" y="${cy + 12}" text-anchor="middle" class="d-total">${total}</text>${rot}</svg>`;
  }
  K.donut = donut;

  const fmt = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');
  const lista = (items, vacio) => {
    if (!items.length) return `<p class="vacio">${vacio}</p>`;
    const cls = items.length > 6 ? ' muy-denso' : items.length > 3 ? ' denso' : '';
    return `<ul class="${cls}">${items.join('')}</ul>`;
  };
  const li = (txt, g) => `<li>${g ? `<i class="dot g-${K.gravClave(g)}"></i>` : ''}${e(txt)}</li>`;

  K.MAX_CASOS_FICHA = 12;
  // Lado de la lesión (según las zonas marcadas): "lado derecho", "lado izquierdo" o "ambos lados".
  K.ladoCaso = (c) => {
    const n = (c.zonas || []).map((z) => K.nombreZona(z).toLowerCase());
    const d = n.some((x) => /derech/.test(x)), i = n.some((x) => /izquierd/.test(x));
    return d && i ? 'ambos lados' : d ? 'lado derecho' : i ? 'lado izquierdo' : '';
  };
  // Si el registro ocurrió con otra categoría (ej. un Sub 16 que jugó por la Sub 18), se anota entre paréntesis.
  const tagCat = (c, j) => { const g = K.catRegistro ? K.catRegistro(c) : null, h = K.catNum(j); return g && h && g !== h ? ` (Sub ${g})` : ''; };
  const conLado = (c) => { const l = K.ladoCaso(c); return l && !/derech|izquierd/i.test(c.titulo) ? ` · ${l}` : ''; };
  K.fichaHTML = function (inf, per, j) {
    const st = K.statsJugador(inf, per, j);
    const casos = K.casosJugador(inf, per, j).sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));
    const pf = K.fichaPlan(inf, per, j, casos);
    const molestias = pf.mol.map((x) => (x.mas ? `<li class="mas">${e(x.t)}</li>` : li(x.t, x.g)));
    const lesiones = pf.les.map((x) => (x.mas ? `<li class="mas">${e(x.t)}</li>` : li(x.t, x.g)));
    const nEv = (tipo) => inf.eventos.filter((x) => x.jugadorId === j.id && x.tipo === tipo && K.enPeriodo(x.fecha, per) && K.evRealizado(x)).reduce((a, x) => a + (Number(x.cantidad) || 1), 0);
    const nCtrl = nEv('control'), nExa = nEv('examen');
    const iv = K.intervencionesJugador(inf, per, j);
    const foto = j.foto ? `<img src="${e(j.foto)}" alt="">` : `<span>${e((j.nombre || '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase())}</span>`;
    const edad = K.edadAnios(j.nacimiento);
    const sub = [j._inv ? `Jugador de ${j._catOrigen || 'otra categoría'} (invitado)` : '', j.categoria && !j._inv ? `Categoría ${j.categoria}` : '', j.nacimiento ? `${j.nacimiento}${edad ? ` (${edad} años)` : ''}` : ''].filter(Boolean).join(' | ');
    const pos = [j.posicion || '', j.pierna ? `Pierna dominante ${j.pierna.toLowerCase()}` : ''].filter(Boolean).join(' · ');
    const cj = K.catsJugadas ? K.catsJugadas(j, per) : {}, ck = Object.keys(cj).sort((a, b) => b - a);
    const haJug = ck.length > 1 || (ck.length === 1 && K.catNum(j) && Number(ck[0]) !== K.catNum(j)) ? `Ha jugado en: ${ck.map((c) => `Sub ${c} (${cj[c]})`).join(', ')}` : '';
    const zonas = K.zonasJugador(inf, per, j);
    const nMol = casos.filter((c) => c.tipo !== 'lesion').length, nLes = casos.filter((c) => c.tipo === 'lesion').length;
    const baja = K.bajaJugador(inf, per, j);
    const meses = K.mesesPeriodo(per);
    const atMes = meses.map((m) => inf.atenciones.filter((a) => a.jugadorId === j.id && (a.fecha || '').slice(0, 7) === m.clave).length);
    const asis = K.asistenciaKine(inf, j.id, per), hh = K.historialJugador(inf, j, per);
    const semaf = asis.pct == null ? '' : asis.pct < 80 ? ' rojo' : asis.pct < 90 ? ' amarillo' : ' verde';
    const histo = (tit, h, nombre, campo) => {
      const enP = h.lista.filter((x) => K.enPeriodo(x[campo], per)), ant = h.lista.filter((x) => !K.enPeriodo(x[campo], per)).slice(-3);
      return `<div class="tarjeta hist"><h3>${tit}</h3>
      <div class="hs-nums"><div><b>${h.hist}</b><span>histórico</span></div><div><b>${h.anio}</b><span>año ${e(h.anioTxt)}</span></div><div><b>${h.per}</b><span>este período</span></div></div>
      ${enP.length ? `<ul class="denso hist-per">${enP.slice(-4).map((x) => `<li>${e(nombre(x))}</li>`).join('')}</ul>` : ''}
      ${ant.length ? `<div class="hist-ant"><small>Anteriores</small><ul class="denso">${ant.map((x) => `<li>${e(nombre(x))}</li>`).join('')}</ul></div>` : ''}</div>`;
    };
    const pc = K.fichaComentario(inf, j);
    const estadoAct = pc.estado.join('<br>');
    const tri = (col) => `<svg class="tri" viewBox="0 0 64 64"><path d="M32 6 L61 57 H3 Z" fill="${col}" stroke="${col}" stroke-width="4" stroke-linejoin="round"/><rect x="29" y="23" width="6" height="19" rx="2" fill="#fff"/><circle cx="32" cy="48.5" r="3.4" fill="#fff"/></svg>`;
    const conNum = (tit, items, vacio, n, col) => `<div class="tarjeta flex con-num"><div class="cn-izq"><h3>${tit}</h3>${lista(items, vacio)}</div><div class="cn-der">${tri(col)}<b>${n || '--'}</b></div></div>`;
    return `
      <div class="f-cab">
        <div class="f-id"><h2>${e(j.nombre)}</h2><p class="f-sub">${e(sub)}</p><p class="f-pos">${e(pos)}</p>${haJug ? `<p class="f-hj">${e(haJug)}</p>` : ''}</div>
        <div class="f-foto">${foto}</div>
      </div>
      <hr class="f-linea">
      <div class="f-cols">
        <div class="f-col">
          ${conNum('Molestias', molestias, 'Sin molestias en este período.', nMol, '#e8a900')}
          ${conNum('Lesiones', lesiones, 'Sin lesiones en este período.', nLes, '#d9363e')}
          ${histo('Historial de lesiones', hh.lesiones, (c) => `${c.titulo}${tagCat(c, j)}${conLado(c)}${c.inicio ? ' · ' + c.inicio.slice(0, 4) : ''}`, 'inicio')}
          ${histo('Historial de cirugías', hh.cirugias, (x) => `${x.nombre || 'Cirugía'}${x.fecha ? ' · ' + K.fechaCorta(x.fecha) : ''}`, 'fecha')}
        </div>
        <div class="f-col">
          <div class="tarjeta carga"><h3>Disponibilidad</h3>
            <div class="cg-nums"><div><b>${baja.dias}</b><span>días de baja</span></div><div><b>${baja.pct}%</b><span>disponibilidad</span></div><div><b>${iv.atenciones}</b><span>atenciones</span></div></div>
            ${K.barrasMini(atMes, meses.map(K.etiquetaMes), 34)}<div class="mb-tit mb-abajo">Atenciones por mes</div></div>
          <div class="tarjeta asis${semaf}"><h3>Asistencia a kinesiología</h3>${asis.esp ? `<div class="as-fila"><b>${asis.pct}%</b><span>${asis.si} de ${asis.esp} sesiones</span></div>${asis.enf ? `<p class="vacio" style="font-style:normal">${asis.enf} ${asis.enf === 1 ? 'día' : 'días'} por enfermedad</p>` : ''}` : '<p class="vacio">Sin sesiones de kinesiología registradas.</p>'}</div>
          <div class="tarjeta flex ctrl"><h3>Controles y exámenes</h3><div class="cg-nums"><div><b>${nCtrl}</b><span>controles médicos</span></div><div><b>${nExa}</b><span>exámenes</span></div></div></div>
        </div>
      </div>
      <div class="f-pie">
        <div class="f-mapa"><div class="f-tot">Total atenciones <b>${iv.atenciones}</b></div>${K.mapaCorporal({ zonas, pagina: true })}${K.leyendaGravedad()}</div>
        <div class="f-donut"><div class="f-tot">Total intervenciones</div>${donut(iv.lista, iv.total)}</div>
      </div>
      <div class="f-coment"><h3>Comentarios área kinésica</h3>${estadoAct ? `<p class="f-estado">${estadoAct}</p>` : ''}${pc.txt ? `<p>${e(pc.txt).replace(/\n/g, '<br>')}</p>` : (estadoAct || pc.cortado ? '' : '<p class="vacio">Sin comentarios.</p>')}${pc.cortado ? '<p><em>… (continúa en la página siguiente)</em></p>' : ''}</div>`;
  };

  /* Los cuadros de la ficha tienen alto fijo: se calcula cuántos ítems caben; lo que no cabe va en una página de detalle (nada se pierde). */
  const lineasDe = (t, ancho) => Math.max(1, Math.ceil(String(t).length / ancho));
  K.fichaPlan = function (inf, per, j, casosIn) {
    const casos = casosIn || K.casosJugador(inf, per, j).sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));
    const mol = casos.filter((c) => c.tipo !== 'lesion').map((c) => ({ g: c.gravedad || 'leve', t: c.titulo + tagCat(c, j) + conLado(c) + (c.contexto ? ` (${c.contexto})` : '') + (K.limitaTxt(c) ? ` · limita entrenamiento: ${K.limitaTxt(c)}` : '') + (K.origenCasoTxt(c) ? ` · ${K.origenCasoTxt(c)}` : '') }));
    const les = casos.filter((c) => c.tipo === 'lesion').map((c) => { const d = K.duracionCaso(c); return { g: c.gravedad || 'moderada', t: c.titulo + tagCat(c, j) + conLado(c) + (c.contexto ? ` – ${c.contexto}` : '') + (d ? ` (${d})` : '') + (K.origenCasoTxt(c) ? ` · ${K.origenCasoTxt(c)}` : '') }; });
    const hh = K.historialJugador(inf, j, per);
    const altoHist = (h, campo) => { const enP = h.lista.filter((x) => K.enPeriodo(x[campo], per)).slice(-4).length, ant = h.lista.filter((x) => !K.enPeriodo(x[campo], per)).slice(-3).length; return 76 + (enP + ant) * 15.5 + (ant ? 22 : 0); };
    // alto libre para los dos cuadros (columna 403 px, separaciones 23 px) y lo que ocupa cada ítem (≈48 caracteres por línea, 15,5 px por línea)
    const libre0 = 403 - 23 - altoHist(hh.lesiones, 'inicio') - altoHist(hh.cirugias, 'fecha') - 2 * 46;
    // al recortar cada ítem queda en 2 líneas (≈80 caracteres) o, si el espacio es muy poco, en 1 línea (≈40)
    const maxCar = (libre0 - 37) / 2 < 34 ? 40 : 80;
    const corta = (t) => (t.length > maxCar ? t.slice(0, maxCar).replace(/\s+\S*$/, '') + '…' : t);
    const elegir = (acortar) => {
      let libre = libre0 - (acortar ? 37 : 0); // al recortar se reserva el renglón “+ N más” de cada cuadro
      const costo = (x) => lineasDe(acortar ? corta(x.t) : x.t, 48) * 15.5 + 3;
      const sale = { mol: [], les: [] }, resto = { mol: mol.slice(), les: les.slice() };
      let cual = les.length >= mol.length ? 'les' : 'mol', fallos = 0, n = 0;
      while ((resto.mol.length || resto.les.length) && fallos < 2) {
        const lis = resto[cual];
        if (lis.length) {
          const x = lis[0], obligado = !sale[cual].length; // siempre se muestra al menos uno de cada cuadro con datos
          if (obligado || libre - costo(x) >= 0) { libre -= costo(x); sale[cual].push(lis.shift()); n++; fallos = 0; } else fallos++;
        } else fallos++;
        cual = cual === 'les' ? 'mol' : 'les';
      }
      return { sale, resto, n };
    };
    let r = elegir(false);
    const total = mol.length + les.length;
    const recortado = r.n < total;
    const sale = r.sale;
    if (recortado) { r = elegir(true); r.sale.mol.forEach((x) => { x.t = corta(x.t); }); r.sale.les.forEach((x) => { x.t = corta(x.t); }); }
    const sale2 = recortado ? r.sale : sale, resto2 = r.resto;
    if (recortado) ['mol', 'les'].forEach((k) => { if (resto2[k].length) sale2[k].push({ mas: true, t: '+ ' + resto2[k].length + ' más (ver detalle en la página siguiente)' }); });
    return { mol: sale2.mol, les: sale2.les, recortado };
  };
  // Cuadro “Comentarios”: caben ≈60 px de texto (el “Estado actual” va en letra chica: 13,5 px por línea, 122 caracteres; el comentario 15,5 px, 108 caracteres).
  // Lo que no cabe (estados o texto) se completa en una página siguiente.
  K.fichaComentario = function (inf, j) {
    const estado = (K.kineEstadoJugador ? K.kineEstadoJugador(inf, j) : []).map((x) => { const plano = `Estado actual: ${x.titulo} · ${x.estado}${x.nota ? ' — ' + x.nota : ''}`; return { px: lineasDe(plano, 122) * 13.5, html: `<b>Estado actual:</b> ${e(x.titulo)} · ${e(x.estado)}${x.nota ? ' — ' + e(x.nota) : ''}` }; });
    const txt = j.comentarios || '', DISP = 52;
    const pxTxt = txt ? txt.split('\n').reduce((t, l) => t + lineasDe(l, 108), 0) * 15.5 : 0;
    const pxEst = estado.reduce((t, x) => t + x.px, 0) + (estado.length ? 3 : 0);
    const todos = estado.map((x) => x.html);
    if (pxEst + pxTxt <= DISP) return { estado: todos, estadoTodos: todos, txt, cortado: false };
    let libre = DISP - 15.5; // una línea queda para “continúa en la página siguiente”
    const sale = [];
    for (const x of estado) { if (sale.length && libre < x.px) break; sale.push(x.html); libre -= x.px; if (libre < 0) break; }
    libre -= sale.length ? 3 : 0;
    let corte = '';
    if (sale.length === estado.length && txt && libre >= 15.5) corte = txt.slice(0, Math.floor(libre / 15.5) * 100).replace(/\s+\S*$/, '').trim();
    return { estado: sale, estadoTodos: todos, txt: corte, cortado: true };
  };

  /* Barras pequeñas (ficha): valores y etiquetas del mismo largo. */
  K.barrasMini = (vals, etiq, alto, suf, sinValor) => {
    const max = Math.max(1, ...vals);
    return `<div class="mb" style="height:${alto}px">${vals.map((v, i) => `<div class="mb-c"><em>${v && !sinValor ? v + (suf || '') : ''}</em><div class="mb-b" style="height:${Math.round(100 * v / max)}%"></div><span>${e(etiq[i])}</span></div>`).join('')}</div>`;
  };

  function extrasJugador(inf, j) {
    return inf.camposExtra
      .map((c) => ({ c, v: (j.extras || {})[c.id] }))
      .filter((x) => x.v !== undefined && x.v !== null && String(x.v).trim() !== '');
  }
  function fichaExtraHTML(inf, j, items) {
    const card = ({ c, v }) => {
      let cuerpo;
      if (c.tipo === 'lista') cuerpo = `<ul>${String(v).split('\n').filter(Boolean).map((x) => `<li>${e(x)}</li>`).join('')}</ul>`;
      else if (c.tipo === 'numero') cuerpo = `<p class="grande">${e(v)}</p>`;
      else if (c.tipo === 'si-no') cuerpo = `<p class="grande">${v === true || v === 'si' ? 'Sí' : 'No'}</p>`;
      else cuerpo = `<p>${e(v).replace(/\n/g, '<br>')}</p>`;
      return `<div class="tarjeta"><h3>${e(c.titulo)}</h3>${cuerpo}</div>`;
    };
    return `<h2>${e(j.nombre)} <small>(información adicional)</small></h2><div class="extra-grid">${items.map(card).join('')}</div>`;
  }

  function detalleCasos(inf, per, j) {
    const casos = K.casosJugador(inf, per, j).sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));
    return chunk(casos, 14).map((arr, k) => pagina('p-ficha p-extra', `<h2>${e(j.nombre)} <small>(lesiones y molestias${k ? ', cont.' : ''})</small></h2>
      <div class="detalle-casos">${arr.map((c) => {
        const d = K.duracionCaso(c);
        const z = (c.zonas || []).map(K.nombreZona).join(', ');
        return `<div class="tarjeta caso"><i class="dot g-${K.gravClave(c.gravedad)}"></i><div><b>${e(c.titulo)}${e(tagCat(c, j))}</b>
          <span>${c.tipo === 'lesion' ? 'Lesión' : 'Molestia'} · ${K.GRAVEDADES[K.gravClave(c.gravedad)]}${c.contexto ? ' · ' + e(c.contexto) : ''}${c.mecanismo ? ' · ' + e(K.ocurrioTxt(c)) : ''}</span>
          ${K.limitaTxt(c) ? `<span>Limita entrenamiento: ${e(K.limitaTxt(c))}</span>` : ''}${K.origenCasoTxt(c) ? `<span>${e(K.origenCasoTxt(c))}</span>` : ''}
          <span>${e(K.fechaCorta(c.inicio))}${d ? ' · ' + e(d) : ''}${z ? ' · ' + e(z) : ''}</span></div></div>`;
      }).join('')}</div>`));
  }

  function paginaComentario(inf, j) {
    const pc = K.fichaComentario(inf, j);
    return pagina('p-ficha p-extra', `<h2>${e(j.nombre)} <small>(comentarios área kinésica)</small></h2>
      <div class="tarjeta"><h3>Comentarios área kinésica</h3>${pc.estadoTodos.length ? `<p>${pc.estadoTodos.join('<br>')}</p>${j.comentarios ? '<br>' : ''}` : ''}${j.comentarios ? `<p>${e(j.comentarios).replace(/\n/g, '<br>')}</p>` : ''}</div>`);
  }

  function fichas(inf, per) {
    const todos = K.ordenJugadores(inf, inf.jugadores.filter((j) => j.activo !== false));
    const propios = todos.filter((j) => !j._inv), inv = todos.filter((j) => j._inv);
    const out = [];
    // Ficha del jugador propio: usa todos sus registros (de cualquier categoría); el resto del informe sigue por categoría.
    const una = (j) => {
      const infj = !j._inv && inf._fichaCasos ? Object.assign({}, inf, { casos: inf._fichaCasos, atenciones: inf._fichaAtenciones }) : inf;
      out.push(pagina('p-ficha', K.fichaHTML(infj, per, j)));
      if (K.fichaPlan(infj, per, j).recortado) detalleCasos(infj, per, j).forEach((h) => out.push(h));
      if (K.fichaComentario(infj, j).cortado) out.push(paginaComentario(infj, j));
      const ex = extrasJugador(infj, j);
      if (ex.length) chunk(ex, 8).forEach((arr) => out.push(pagina('p-ficha p-extra', fichaExtraHTML(infj, j, arr))));
    };
    propios.forEach(una);
    // Jugadores de otras categorías que jugaron en esta: apartado al final, claramente distinguido.
    if (inv.length) {
      // Si todo estuvo bien (sin atenciones ni casos), solo consta que jugó: va en la tabla y no tiene ficha.
      const conFicha = inv.filter((j) => K.casosJugador(inf, per, j).length || inf.atenciones.some((x) => x.jugadorId === j.id && K.enPeriodo(x.fecha, per)));
      const fila = (j) => {
        const mins = K.statsJugador(inf, per, j), c = K.casosJugador(inf, per, j), at = inf.atenciones.filter((x) => x.jugadorId === j.id && K.enPeriodo(x.fecha, per)).length;
        return `<tr><td><b>${e(j.nombre)}</b></td><td>${e(j._catOrigen || '—')}</td><td class="n">${mins.partidos}</td><td class="n">${mins.minutos || '—'}</td><td class="n">${at}</td><td class="n">${c.filter((x) => x.tipo !== 'lesion').length}</td><td class="n">${c.filter((x) => x.tipo === 'lesion').length}</td></tr>`;
      };
      chunkH(inv, (j) => 30 + 13 * (lin(j.nombre, 26) - 1), 20, 700).forEach((arr, k) => out.push(pagina('p-resumen p-equipo', `<h2>Jugadores de otras categorías${k ? ' <small>(cont.)</small>' : ''}</h2>${subtitulo(inf, per)}
        ${k ? '' : `<p class="sub">Jugadores que pertenecen a otra categoría y participaron en partidos de ${e(inf.nombre)}. Lo que ocurrió en esos partidos cuenta en este informe y <b>no</b> en el de su categoría. ${conFicha.length ? 'Solo los que tuvieron atenciones, molestias o lesiones tienen ficha a continuación.' : 'Ninguno tuvo atenciones: aquí solo consta que jugaron.'}</p>`}
        <table class="kn-t"><thead><tr><th>Jugador</th><th>Su categoría</th><th>Partidos</th><th>Minutos</th><th>Atenciones</th><th>Molestias</th><th>Lesiones</th></tr></thead><tbody>${arr.map(fila).join('')}</tbody></table>`)));
      conFicha.forEach(una);
    }
    return out;
  }

  /* ---------- Análisis del equipo ---------- */
  const barrasH = (items, max, color) => {
    const m = Math.max(1, max || Math.max(1, ...items.map((x) => x[1])));
    return `<div class="bh">${items.map(([n, v, c]) => `<div class="bh-f"><span class="bh-n">${e(n)}</span><div class="bh-t"><i style="width:${Math.round(100 * v / m)}%;background:${c || color || '#2f7a4a'}"></i></div><b>${v}</b></div>`).join('')}</div>`;
  };
  const panelEq = (tit, cuerpo, cls) => `<div class="eq-panel ${cls || ''}"><h3>${e(tit)}</h3>${cuerpo}</div>`;
  function equipoPaginas(inf, per) {
    const r = K.estadisticasEquipo(inf, per);
    const sub = subtitulo(inf, per);
    // Página 1: análisis de lesiones
    const maxMes = Math.max(1, ...r.mesLes, ...r.mesMol);
    const meses = `<div class="mes-graf">${r.meses.map((m, i) => `<div class="mes-c"><div class="mes-bs"><div class="mes-b les" style="height:${Math.round(100 * r.mesLes[i] / maxMes)}%" title="Lesiones"><em>${r.mesLes[i] || ''}</em></div><div class="mes-b mol" style="height:${Math.round(100 * r.mesMol[i] / maxMes)}%" title="Molestias"><em>${r.mesMol[i] || ''}</em></div></div><span>${e(K.etiquetaMes(m))}</span></div>`).join('')}</div>
      <div class="mes-leyenda"><span><i class="les"></i>Lesiones</span><span><i class="mol"></i>Molestias</span></div>`;
    const kpi = (v, t) => `<div class="eq-kpi"><b>${v}</b><span>${t}</span></div>`;
    const g = r.grav, mc = r.mec, tr = r.terreno;
    const p1 = pagina('p-resumen p-equipo', `<h2>Análisis de lesiones</h2>${sub}
      <div class="eq-kpis">${kpi(r.lesiones, 'lesiones')}${kpi(r.molestias, 'molestias')}${kpi(r.diasBaja, 'días de baja')}${kpi(r.retorno == null ? '--' : r.retorno + ' d', 'retorno promedio')}</div>
      <div class="eq-kpis eq-kpis-2">${kpi(r.limCasos, 'molestias que limitaron el entrenamiento')}${kpi(r.limDias, 'días de entrenamiento limitado')}</div>
      ${panelEq('Casos por mes', meses)}
      <div class="eq-2">
        ${panelEq('Por gravedad', barrasH(K.GRAV_ORDEN.filter((k) => k !== 'pordefinir' || g.pordefinir).map((k) => [K.GRAVEDADES[k], g[k], K.COLORES_GRAV[k]]), 0) + '<p class="nota-grav">Días fuera: mínima 1-3 · leve 4-7 · moderada 8-28 · grave más de 28.</p>')}
        ${panelEq('Dónde ocurrió', barrasH(K.MECANISMOS.map(([k, n]) => [n, mc[k]]).concat([['Sin dato', mc.sin, '#8a9a90']])))}
      </div>
      <div class="eq-2">
        ${panelEq('Terreno de juego', barrasH(K.TERRENOS.map((t) => [t, tr[t]]).concat([['Sin dato', tr.sin, '#8a9a90']])))}
        ${panelEq('Medicamentos entregados', r.meds.length ? barrasH(r.meds, 0, '#e9b95f') : '<p class="vacio-eq">Sin medicamentos registrados.</p>')}
      </div>`);
    // Página 2: zonas del cuerpo
    const max = Math.max(1, ...Object.keys(r.zonas).map((k) => r.zonas[k]));
    const mapa = K.mapaCorporal({ calor: r.zonas, calorMax: max, pagina: true });
    const escala = `<div class="calor-leyenda"><span>Menos casos</span><i style="background:linear-gradient(90deg,${K.colorCalor(0)},${K.colorCalor(.5)},${K.colorCalor(1)})"></i><span>Más casos</span></div>`;
    const lista2 = (arr, vacio, f) => arr.length ? `<ul class="eq-lista">${arr.map(f).join('')}</ul>` : `<p class="vacio-eq">${vacio}</p>`;
    const p2 = pagina('p-resumen p-equipo', `<h2>Zonas del cuerpo</h2>${sub}
      ${panelEq('Mapa acumulado del equipo', `<div class="eq-mapa-fig">${mapa}</div>${escala}`)}
      <div class="eq-2">
        ${panelEq('Zonas más frecuentes', r.top.length ? barrasH(r.top.slice(0, 6).map(([n, v]) => [n, v]), max, '#e9b95f') : '<p class="vacio-eq">Sin lesiones ni molestias con zona registrada.</p>')}
        <div class="eq-col">
          ${panelEq('Jugadores con más atenciones', lista2(r.topAt, 'Sin atenciones registradas.', ([n, v]) => `<li><span>${e(n)}</span><b>${v}</b></li>`))}
          ${panelEq('Recurrencias (misma zona, 2 o más casos)', lista2(r.recurrentes, 'Sin recurrencias.', ([n, z, v]) => `<li><span>${e(n)} · ${e(z)}</span><b>${v}×</b></li>`))}
        </div>
      </div>`);
    // Página 3: conclusiones y objetivos
    // La caja tiene alto fijo (≈321 px de texto): si el texto es largo, la letra se achica en tramos para que NUNCA se corte.
    const tamano = (txt) => { const lin = (f) => String(txt).split('\n').reduce((t, l) => t + Math.max(1, Math.ceil(l.length / (100 * 12.5 / f))), 0); for (const [f, lh] of [[12.5, 1.5], [11.5, 1.4], [10.5, 1.35], [9.5, 1.3]]) if (lin(f) * f * lh <= 300) return f === 12.5 ? '' : ` style="font-size:${f}px;line-height:${lh}"`; return ' style="font-size:9.5px;line-height:1.3"'; };
    // Lo que no cabe ni con la letra más chica se corta con “[…]” (y el editor avisa antes: ver K.textoCabe)
    const ajustar = (txt) => { if (K.textoCabe(txt)) return txt; let lo = 0, hi = txt.length; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (K.textoCabe(txt.slice(0, m) + ' […]')) lo = m; else hi = m - 1; } return txt.slice(0, lo).trimEnd() + ' […]'; };
    const caja = (tit, txt) => `<div class="eq-texto"><h3>${e(tit)}</h3><div class="eq-papel">${txt ? `<p${tamano(ajustar(txt))}>${e(ajustar(txt)).replace(/\n/g, '<br>')}</p>` : `<p class="vacio-eq">${K._paraPdf ? '&nbsp;' : K.puedeEditar && !K.puedeEditar() ? 'Sin texto registrado.' : 'Escribe este texto en la app (pestaña Informe → Textos del informe).'}</p>`}</div></div>`;
    const p3 = pagina('p-resumen p-equipo', `<h2>Conclusiones y objetivos</h2>${sub}${caja('Conclusiones del área kinésica', inf.conclusiones)}${caja('Objetivos y proyecciones para el próximo año', inf.objetivos)}
      <div class="eq-firma"><div></div>${inf.firmante ? `<b>${e(inf.firmante)}</b>` : ''}<span>Kinesiólogo(a) responsable · Santiago Wanderers</span></div>`);
    return [p1, p2, p3];
  }


  /* ---------- Seguimiento kinésico y uso del seguro (todo lo que se anota en la pestaña Kine) ---------- */
  function kinePaginas(inf, per) {
    const sub = subtitulo(inf, per), out = [];
    const ids = new Set(inf.jugadores.filter((j) => j.activo !== false).map((j) => j.id));
    const lesiones = inf.casos.filter((c) => c.tipo === 'lesion' && ids.has(c.jugadorId) && c.inicio && c.inicio <= per.hasta && (!c.alta || c.alta >= per.desde))
      .sort((a, b) => { const ja = K.jugador(inf, a.jugadorId), jb = K.jugador(inf, b.jugadorId); return ja.nombre.localeCompare(jb.nombre, 'es') || a.inicio.localeCompare(b.inicio); });
    const asis = (inf.asistencias || []).filter((a) => ids.has(a.jugadorId) && K.enPeriodo(a.fecha, per));
    const kpi = (v, t) => `<div class="eq-kpi"><b>${v}</b><span>${t}</span></div>`;
    if (lesiones.length || asis.length) {
      const si = asis.filter((a) => a.v === 'si').length, esp = asis.filter(K.asisEsperada).length;
      const pct = esp ? Math.round(100 * si / esp) : null;
      const cnt = { SK: 0, 'RD · K': 0, 'RD · K+PF': 0, 'RD · K+PA': 0, RD: 0, 'No asistió': 0, 'Pauta en casa': 0, Descanso: 0, 'Control / examen / procedimiento': 0, Enfermedad: 0 };
      asis.forEach((a) => {
        if (a.v === 'si') { if (a.t === 'RD') cnt[a.sub === 'K' ? 'RD · K' : a.sub === 'KPF' ? 'RD · K+PF' : a.sub === 'KPA' ? 'RD · K+PA' : 'RD']++; else cnt.SK++; }
        else cnt[a.no === 'pauta' ? 'Pauta en casa' : a.no === 'descanso' ? 'Descanso' : ['control', 'examen', 'procedimiento'].includes(a.no) ? 'Control / examen / procedimiento' : a.no === 'enfermedad' ? 'Enfermedad' : 'No asistió']++;
      });
      const col = { SK: '#2f9e5a', 'RD · K': '#3b82e0', 'RD · K+PF': '#1f5fbf', 'RD · K+PA': '#13438f', RD: '#3b82e0', 'No asistió': '#6b7570', 'Pauta en casa': '#aeb7b2', Descanso: '#cfd6d2', 'Control / examen / procedimiento': '#8d6fc4', Enfermedad: '#b08a5a' };
      const meses = K.mesesPeriodo(per);
      const porMes = meses.map((m) => asis.filter((a) => a.v === 'si' && a.fecha.slice(0, 7) === m.clave).length);
      const altas = lesiones.filter((c) => c.alta && K.enPeriodo(c.alta, per)).length;
      const curso = lesiones.filter((c) => !c.alta).length;
      out.push(pagina('p-resumen p-equipo', `<h2>Seguimiento kinésico</h2>${sub}
        <div class="eq-kpis">${kpi(lesiones.length, 'lesiones en seguimiento')}${kpi(curso, 'aún en baja')}${kpi(altas, 'altas en el período')}${kpi(pct == null ? '--' : pct + '%', 'asistencia a kinesiología')}</div>
        <div class="eq-kpis eq-kpis-2">${kpi(si, 'sesiones realizadas')}${kpi(esp, 'sesiones esperadas')}</div>
        ${panelEq('Sesiones y asistencia por tipo', barrasH(Object.keys(cnt).filter((k) => cnt[k] || ['SK', 'No asistió'].includes(k)).map((k) => [k, cnt[k], col[k]]), 0))}
        ${panelEq('Sesiones realizadas por mes', K.barrasMini(porMes, meses.map(K.etiquetaMes), 90))}
        <p class="kn-nota">SK: sesión de kinesiología · RD: reintegro deportivo (K: kinesiología, K+PF: + preparación física, K+PA: + preparador de arqueros). El porcentaje no cuenta los días de descanso.</p>`));
      const fila = (c) => {
        const j = K.jugador(inf, c.jugadorId), a = K.asistenciaKine(inf, j.id, { desde: c.inicio > per.desde ? c.inicio : per.desde, hasta: per.hasta });
        const est = c.alta ? 'Alta ' + K.fechaCorta(c.alta) : K.kineEstadoTxt(c);
        const cir = c.cirugia === true || inf.eventos.some((x) => x.tipo === 'cirugia' && x.casoId === c.id);
        return `<tr><td><b>${e(j.nombre)}</b><small>${e(j.categoria || '')}</small></td><td>${e(c.titulo)}${e(conLado(c))}<small>${e(K.fechaCorta(c.inicio))}</small></td><td class="n">${K.diasBajaCaso(c, per)}</td>
          <td>${e(est)}${c.estadoNota ? `<small>${e(c.estadoNota)}</small>` : ''}</td><td class="n">${a.pct == null ? '--' : `<span class="kn-pct ${K.kineSemaforo(a.pct)}">${a.pct}%</span>`}</td><td class="n">${cir ? 'Sí' : 'No'}</td><td class="n">${c.recidiva === true ? 'Sí' : 'No'}</td></tr>`;
      };
      chunkH(lesiones, (c) => { const j = K.jugador(inf, c.jugadorId) || {}; const est = (c.alta ? 'Alta 00-00-0000' : K.kineEstadoTxt(c)) + (c.estadoNota ? ' ' + c.estadoNota : ''); return 40 + 13 * (Math.max(lin(j.nombre, 18), lin((c.titulo || '') + conLado(c), 24), lin(est, 38)) - 1); }, 10, 780).forEach((arr, i) => { if (!arr.length) return;
        out.push(pagina('p-resumen p-equipo', `<h2>Lesionados en seguimiento${i ? ' <small>(cont.)</small>' : ''}</h2>${sub}
          <table class="kn-t"><thead><tr><th>Jugador</th><th>Diagnóstico y fecha</th><th>Días de baja</th><th>Estado y comentarios</th><th>% asist.</th><th>Cirugía</th><th>Recidiva</th></tr></thead><tbody>${arr.map(fila).join('')}</tbody></table>`)); });
    }
    // Atenciones durante los partidos (informe de partido de la pestaña Partidos)
    const conInc = inf.partidos.filter((p) => p.fecha && K.enPeriodo(p.fecha, per) && K.resumenPartido(inf, p).n).sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (conInc.length) {
      const res = conInc.map((p) => ({ p, r: K.resumenPartido(inf, p) }));
      const sum = (f) => res.reduce((a, x) => a + f(x.r), 0);
      const mom = K.MOMENTOS_PARTIDO.map(([k, tt], i) => [tt, res.reduce((a, x) => a + x.r.lista.filter((q) => q.momento === k).length, 0), ['#8a9a90', '#2f7a4a', '#c98f00', '#3b5bb5', '#7b4fb8'][i]]);
      const cl = K.CLASES_ATENCION.map(([k, tt]) => [tt, res.reduce((a, x) => a + x.r.lista.filter((q) => q.clase === k).length, 0)]);
      const tabla = (arr) => `<table class="kn-t"><thead><tr><th>Partido</th><th>Fecha</th><th>Atenciones</th><th>Jugadores</th><th>En cancha</th><th>Se retiraron</th></tr></thead><tbody>${arr.map(({ p, r }) => `<tr><td><b>${e(p.rival)}</b><small>${p.torneo ? e(p.torneo) + ' · ' : ''}${p.cat ? 'Sub ' + p.cat + ' · ' : ''}${p.local ? 'Local' : 'Visita'}${p.res ? ' · ' + e(p.res) : ''}</small></td><td>${e(K.fechaCorta(p.fecha))}</td><td class="n">${r.n}</td><td class="n">${r.jugadores}</td><td class="n">${r.enCancha}</td><td class="n">${r.retiros}</td></tr>`).join('')}</tbody></table>`;
      const corto = res.length <= 9;
      out.push(pagina('p-resumen p-equipo', `<h2>Atenciones en partidos</h2>${sub}
        <div class="eq-kpis">${kpi(conInc.length, 'partidos con atenciones')}${kpi(sum((r) => r.n), 'atenciones')}${kpi(sum((r) => r.enCancha), 'atenciones en cancha')}${kpi(sum((r) => r.retiros), 'jugadores que se retiraron')}</div>
        <div class="eq-2">${panelEq('Cuándo ocurrió', barrasH(mom, 0))}${panelEq('Tipo de atención', barrasH(cl, 0))}</div>${corto ? tabla(res) : ''}`));
      if (!corto) chunkH(res, ({ p }) => 40 + 13 * (Math.max(lin(p.rival, 30), lin((p.torneo || '') + ' · Sub 16 · Visita · ' + (p.res || ''), 45)) - 1), 14, 780).forEach((arr, i) => out.push(pagina('p-resumen p-equipo', `<h2>Detalle por partido${i ? ' <small>(cont.)</small>' : ''}</h2>${sub}${tabla(arr)}`)));
    }
    // Uso del seguro (sin datos personales). Solo si hay eventos en el período (los ven únicamente los administradores).
    const sev = (inf.segEventos || []).filter((x) => ids.has(x.jugadorId) && K.enPeriodo(x.fecha, per));
    const sini = (inf.seguros || []).filter((x) => ids.has(x.jugadorId) && x.activacion && K.enPeriodo(x.activacion, per)).length; // activaciones iniciales (sin datos personales)
    if (sev.length || sini) {
      const c = {}, ex = {}, pr = {};
      sev.forEach((x) => { c[x.tipo] = (c[x.tipo] || 0) + 1; if (x.tipo === 'examen') ex[x.detalle || 'Sin nombre'] = (ex[x.detalle || 'Sin nombre'] || 0) + 1; if (x.tipo === 'procedimiento') pr[x.detalle || 'Sin nombre'] = (pr[x.detalle || 'Sin nombre'] || 0) + 1; });
      const ses = sev.filter((x) => x.tipo === 'kinesiologia').reduce((a, x) => a + (Number(x.cantidad) || 1), 0);
      const top = (o) => Object.keys(o).map((k) => [k, o[k]]).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const lista = (arr, col) => (arr.length ? barrasH(arr, 0, col) : '<p class="vacio-eq">Sin registros.</p>');
      const tp = [['Control médico', c.control || 0, '#7b4fb8'], ['Examen', c.examen || 0, '#f08a24'], ['Procedimiento', c.procedimiento || 0, '#c2479b'], ['Kinesiología', c.kinesiologia || 0, '#14a3a3'], ['Cirugía', c.cirugia || 0, '#1f2937'], ['Hospitalización', c.hosp || 0, '#b3202a']];
      out.push(pagina('p-resumen p-equipo', `<h2>Uso del seguro</h2>${sub}
        <div class="eq-kpis">${kpi(sini, 'activaciones iniciales (urgencias)')}${kpi(sini + sev.length, 'activaciones + continuidad')}${kpi(c.examen || 0, 'exámenes')}${kpi(ses, 'sesiones de kinesiología')}</div>
        ${panelEq('Eventos por tipo', barrasH(tp, 0))}
        <div class="eq-2">${panelEq('Exámenes más frecuentes', lista(top(ex), '#f08a24'))}${panelEq('Procedimientos más frecuentes', lista(top(pr), '#c2479b'))}</div>`));
    }
    return out;
  }

  K.paginas = function (inf, per) {
    const eq = equipoPaginas(inf, per); // análisis (2 páginas) · seguimiento kinésico y seguro · conclusiones
    const todas = [portada(inf, per)].concat(calendarioPaginas(inf, per), resumenPaginas(inf, per), eq.slice(0, 2), kinePaginas(inf, per), eq.slice(2), fichas(inf, per));
    return todas.map((h, i) => h.replace('<!--PIE-->', i === 0 ? '' : PIE(i + 1)));
  };
})();

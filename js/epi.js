/* Estadísticas de lesiones al estilo del “Epidemiología anual” (v1.8.0).
   Solo cuentan las LESIONES (no las molestias). Páginas: resumen (jugadores lesionados + cirugías + curva semanal), por categoría
   (barras por semana, torta y barras), tipos y zonas, y una página por categoría con su curva semanal y la tabla Semana · Jugador · Lesión.
   Los gráficos son SVG en línea (se ven igual en pantalla y en el PDF). */
(function () {
  const K = window.K, e = K.esc;
  const D = (s) => new Date(s + 'T12:00:00');
  const dif = (a, b) => Math.round((D(b) - D(a)) / 864e5);
  const suma = (s, n) => { const d = D(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const lunes = (s) => { const d = D(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  const corta = (s) => K.fechaCorta(s); // dd-mm-aaaa
  const COL = { 15: '#d99a0b', 16: '#7a8791', 17: '#7b4fb8', 18: '#e9731a', 19: '#14a3a3', 20: '#2f6fd0' };
  const colorCat = (n) => COL[n] || '#2f7a4a';
  const may = (t) => { t = String(t || '').trim(); return t.charAt(0).toUpperCase() + t.slice(1); };
  const TIPOS = [['oseo', 'Ósea'], ['ligamento', 'Ligamentosa'], ['muscular', 'Muscular'], ['tendon', 'Tendinosa']];
  const ladoTxt = (c) => { const l = K.ladoCaso ? K.ladoCaso(c) : ''; return l && !/derech|izquierd/i.test(c.titulo || '') ? ' · ' + l : ''; };

  /* ---------- Datos ---------- */
  K.estadisticasEPI = function (inf, per) {
    const jug = (id) => inf.jugadores.find((j) => j.id === id);
    const catDe = (jid) => { const j = jug(jid); if (!j) return ''; if (K.tieneHistorial && K.tieneHistorial(j)) { const n = K.catPeriodo(j, per.desde, per.hasta); if (n) return 'Sub ' + n; } return j.categoria || ''; };
    const les = inf.casos.filter((c) => c.tipo === 'lesion' && c.inicio && K.enPeriodo(c.inicio, per) && jug(c.jugadorId)).sort((a, b) => a.inicio.localeCompare(b.inicio) || String(jug(a.jugadorId).nombre).localeCompare(String(jug(b.jugadorId).nombre), 'es'));
    const ini0 = lunes(per.desde);
    let nSem = Math.min(110, Math.max(1, Math.floor(dif(ini0, K.hastaPer(per)) / 7) + 1));
    les.forEach((c) => { nSem = Math.max(nSem, Math.min(110, Math.floor(dif(ini0, c.inicio) / 7) + 1)); });
    const r = { lesiones: les.length, jugadores: new Set(les.map((c) => c.jugadorId)).size, ini0, nSem, total: new Array(nSem).fill(0), cats: [], cirugias: [], tipos: [], zonas: [], muscular: [], ligamentosa: [] };
    const veces = {}; les.forEach((c) => { veces[c.jugadorId] = (veces[c.jugadorId] || 0) + 1; });
    const cats = {};
    les.forEach((c) => {
      const num = K.numCat(catDe(c.jugadorId));
      const o = (cats[num] = cats[num] || { num, label: num ? 'Sub ' + num : 'Sin categoría', color: colorCat(num), n: 0, jug: new Set(), sem: new Array(nSem).fill(0), porSem: {} });
      const w = Math.floor(dif(ini0, c.inicio) / 7);
      o.n++; o.jug.add(c.jugadorId);
      if (w >= 0 && w < nSem) { o.sem[w]++; r.total[w]++; (o.porSem[w] = o.porSem[w] || []).push({ nombre: jug(c.jugadorId).nombre, titulo: may(c.titulo || 'Sin diagnóstico') + ladoTxt(c), rep: veces[c.jugadorId] > 1 }); }
    });
    r.cats = Object.keys(cats).map((k) => cats[k]).sort((a, b) => b.num - a.num);
    // cirugías: las registradas como evento y las lesiones marcadas con cirugía que no tienen evento
    const ids = new Set(inf.eventos.filter((x) => x.tipo === 'cirugia' && x.casoId).map((x) => x.casoId));
    inf.eventos.forEach((x) => { if (x.tipo === 'cirugia' && K.evRealizado(x) && x.fecha && K.enPeriodo(x.fecha, per) && jug(x.jugadorId)) { const c = inf.casos.find((q) => q.id === x.casoId); r.cirugias.push({ fecha: x.fecha, nombre: jug(x.jugadorId).nombre, det: may((c && c.titulo) || x.nombre || 'Cirugía') }); } });
    les.forEach((c) => { if (c.cirugia === true && !ids.has(c.id)) r.cirugias.push({ fecha: c.inicio, nombre: jug(c.jugadorId).nombre, det: may(c.titulo) }); });
    r.cirugias.sort((a, b) => a.fecha.localeCompare(b.fecha));
    // tipo de lesión (tejido); una lesión con dos tejidos cuenta en ambos; los demás tejidos van a “Otras”
    const tp = { oseo: 0, ligamento: 0, muscular: 0, otras: 0, tendon: 0, sin: 0 };
    const sub = { muscular: {}, ligamento: {} };
    les.forEach((c) => {
      const tj = K.tejidosDe ? K.tejidosDe(c) : [];
      if (!tj.length) { tp.sin++; return; }
      const b = new Set(tj.map((k) => (tp[k] !== undefined && k !== 'otras' && k !== 'sin' ? k : 'otras')));
      b.forEach((k) => { tp[k]++; });
      ['muscular', 'ligamento'].forEach((k) => { if (tj.includes(k)) { const t = may(String(c.titulo || 'Sin diagnóstico').replace(/\s*[·,-]?\s*\b(derech[oa]s?|izquierd[oa]s?|bilateral|ambos lados)\b/gi, '').replace(/\s+(y|e)\s*$/i, '').trim() || 'Sin diagnóstico'), kk = K.norm(t); const x = (sub[k][kk] = sub[k][kk] || { t, n: 0 }); x.n++; } });
    });
    r.tipos = TIPOS.map(([k, n]) => [n, tp[k]]).concat([['Otras', tp.otras]]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
    if (tp.sin) r.tipos.push(['Sin clasificar', tp.sin]);
    const top = (o) => Object.keys(o).map((k) => [o[k].t, o[k].n]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).slice(0, 8);
    r.muscular = top(sub.muscular); r.ligamentosa = top(sub.ligamento);
    const z = {}; let sinZ = 0;
    les.forEach((c) => { const zs = Array.from(new Set((c.zonas || []).map((id) => K.nombreZona(id).replace(/\s+(derech[oa]|izquierd[oa])\b/i, '')))); if (!zs.length) sinZ++; zs.forEach((n) => { z[n] = (z[n] || 0) + 1; }); });
    r.zonas = Object.keys(z).map((n) => [n, z[n]]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).slice(0, 10);
    r.sinZona = sinZ;
    return r;
  };

  /* ---------- Gráficos (SVG) ---------- */
  const pasoEje = (n) => (n <= 14 ? 1 : n <= 28 ? 2 : n <= 56 ? 4 : 8);
  const ejeX = (n, x, y, ini0) => { const p = pasoEje(n); let s = ''; for (let i = 0; i < n; i += p) s += `<text x="${x(i).toFixed(1)}" y="${y + 10}" text-anchor="middle" font-size="8" font-weight="700" fill="#44504a">S${i + 1}</text><text x="${x(i).toFixed(1)}" y="${y + 20}" text-anchor="middle" font-size="7" fill="#6b7570">${e(corta(suma(ini0, 7 * i)))}</text>`; return s; };
  const lineaSemanas = (vals, ini0, color, h) => {
    const W = 700, H = h || 170, l = 24, rr = 12, t = 20, b = 34, n = vals.length;
    const max = Math.max(2, ...vals), paso = Math.ceil(max / 4), top = paso * Math.ceil(max / paso);
    const x = (i) => (n === 1 ? (l + W - rr) / 2 : l + i * (W - l - rr) / (n - 1)), y = (v) => t + (H - t - b) * (1 - v / top);
    let g = ''; for (let v = 0; v <= top; v += paso) g += `<line x1="${l}" x2="${W - rr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#dfe5e1" stroke-width="1"/><text x="${l - 5}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" font-size="8" fill="#6b7570">${v}</text>`;
    const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const area = `${x(0).toFixed(1)},${y(0).toFixed(1)} ${pts} ${x(n - 1).toFixed(1)},${y(0).toFixed(1)}`;
    const marc = vals.map((v, i) => (v ? `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" fill="${color}"/><text x="${x(i).toFixed(1)}" y="${(y(v) - 6).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="#26302b">${v}</text>` : '')).join('');
    return `<svg class="epi-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">${g}<polygon points="${area}" fill="${color}" fill-opacity=".14"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>${marc}${ejeX(n, x, H - b + 4, ini0)}</svg>`;
  };
  const apiladas = (r) => {
    const W = 700, H = 200, l = 24, rr = 12, t = 18, b = 34, n = r.nSem, tot = r.total, max = Math.max(2, ...tot), paso = Math.ceil(max / 4), top = paso * Math.ceil(max / paso);
    const bw = Math.max(3, Math.min(16, (W - l - rr) / n * .68)), x = (i) => l + (i + .5) * (W - l - rr) / n, y = (v) => t + (H - t - b) * (1 - v / top);
    let g = ''; for (let v = 0; v <= top; v += paso) g += `<line x1="${l}" x2="${W - rr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#dfe5e1"/><text x="${l - 5}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" font-size="8" fill="#6b7570">${v}</text>`;
    let barras = '';
    for (let i = 0; i < n; i++) { let acc = 0; r.cats.slice().reverse().forEach((c) => { const v = c.sem[i]; if (!v) return; const y1 = y(acc + v), y0 = y(acc); barras += `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${(y0 - y1).toFixed(1)}" fill="${c.color}"/>`; acc += v; }); if (acc) barras += `<text x="${x(i).toFixed(1)}" y="${(y(acc) - 3).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="700" fill="#26302b">${acc}</text>`; }
    return `<svg class="epi-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">${g}${barras}${ejeX(n, (i) => x(i), H - b + 4, r.ini0)}</svg>`;
  };
  const leyenda = (items) => `<div class="epi-ley">${items.map(([n, c]) => `<span><i style="background:${c}"></i>${e(n)}</span>`).join('')}</div>`;
  const torta = (cats, total) => {
    const cx = 105, cy = 105, R = 92; let a0 = -Math.PI / 2, s = '';
    const pt = (rad, a) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
    cats.forEach((c) => {
      const f = c.n / total, a1 = a0 + f * Math.PI * 2, am = (a0 + a1) / 2;
      if (cats.length === 1) s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${c.color}"/>`;
      else { const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1); s += `<path d="M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 ${f > .5 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z" fill="${c.color}" stroke="#fff" stroke-width="1.5"/>`; }
      if (f >= .05) { const [lx, ly] = pt(R * (cats.length === 1 ? 0 : .62), am); s += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${Math.round(100 * f)}%</text>`; }
      a0 = a1;
    });
    return `<svg class="epi-svg epi-torta" viewBox="0 0 210 210" xmlns="http://www.w3.org/2000/svg" role="img">${s}</svg>`;
  };
  const barrasV = (items, color) => {
    const W = 340, H = 190, l = 8, rr = 8, t = 24, b = 30, n = items.length, max = Math.max(1, ...items.map((x) => x[1])), bw = Math.min(46, (W - l - rr) / n * .6);
    const cw = (W - l - rr) / n; let s = `<line x1="${l}" x2="${W - rr}" y1="${H - b}" y2="${H - b}" stroke="#aab4ae"/>`;
    items.forEach(([nom, v, c], i) => { const h = (H - t - b) * v / max, x = l + i * cw + cw / 2; s += `<rect x="${(x - bw / 2).toFixed(1)}" y="${(H - b - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${c || color}"/><text x="${x.toFixed(1)}" y="${(H - b - h - 5).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#26302b">${v}</text><text x="${x.toFixed(1)}" y="${H - b + 14}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#44504a">${e(nom)}</text>`; });
    return `<svg class="epi-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">${s}</svg>`;
  };
  const barrasH = (items, color) => { const m = Math.max(1, ...items.map((x) => x[1])); return `<div class="epi-bh">${items.map(([n, v]) => `<div><span>${e(n)}</span><div class="epi-bt"><i style="width:${Math.max(6, Math.round(100 * v / m))}%;background:${color}"><b>${v}</b></i></div></div>`).join('')}</div>`; };
  const lista = (arr, vacio) => (arr.length ? `<ul class="epi-lista">${arr.map(([t, n]) => `<li><b>${n}</b> ${e(t)}</li>`).join('')}</ul>` : `<p class="epi-vacio">${vacio}</p>`);
  const hoja = (tit, cuerpo, cls) => `<div class="epi-hoja ${cls || ''}">${tit ? `<h3>${e(tit)}</h3>` : ''}${cuerpo}</div>`;

  // Reparte filas por alto estimado: la primera página tiene menos espacio (lleva el gráfico)
  const repartir = (arr, costo, cap1, cap2) => {
    const out = []; let act = [], h = 0, cap = cap1;
    arr.forEach((x) => { const c = costo(x); if (act.length && h + c > cap) { out.push(act); act = []; h = 0; cap = cap2; } act.push(x); h += c; });
    if (act.length) out.push(act);
    return out.length ? out : [[]];
  };

  /* ---------- Páginas ---------- */
  K.epiPaginas = function (inf, per) {
    const R = K.rep, pagina = R.pagina, lin = R.lin, sub = R.subtitulo(inf, per), out = [];
    const r = K.estadisticasEPI(inf, per), N = r.lesiones;
    const nota = '<p class="epi-nota">Solo lesiones (las molestias no se cuentan aquí). Semana 1 = la semana (lunes a domingo) que parte el lunes indicado.</p>';
    // 1) Resumen
    const kpi = `<table class="epi-kpi"><tbody><tr><th>Jugadores lesionados</th><td>${r.jugadores}</td></tr><tr><th>Lesiones</th><td>${N}</td></tr></tbody></table>`;
    const cirTabla = (arr) => `<table class="epi-t epi-cir"><thead><tr><th>Fecha</th><th>Jugador</th><th>Lesión</th></tr></thead><tbody>${arr.map((c) => `<tr><td>${e(K.fechaCorta(c.fecha))}</td><td>${e(c.nombre)}</td><td>${e(c.det)}</td></tr>`).join('')}</tbody></table>`;
    const cirAparte = r.cirugias.length > 8;
    const cirBloque = `<div class="epi-cirugias"><div class="epi-cir-n"><span>Cirugías</span><b>${r.cirugias.length}</b></div>${r.cirugias.length && !cirAparte ? cirTabla(r.cirugias) : `<p class="epi-vacio">${r.cirugias.length ? 'El detalle está en la página siguiente.' : 'Sin cirugías en el período.'}</p>`}</div>`;
    out.push(pagina('p-resumen p-equipo', `<h2>Estadísticas de lesiones</h2>${sub}
      <div class="epi-top">${kpi}${cirBloque}</div>
      ${N ? hoja('Lesionados por semana durante el período', lineaSemanas(r.total, r.ini0, '#2f7a4a', 300)) + nota : hoja('', '<p class="epi-vacio">Sin lesiones registradas en el período.</p>')}`));
    if (cirAparte) repartir(r.cirugias, () => 24, 700, 700).forEach((arr, k) => out.push(pagina('p-resumen p-equipo', `<h2>Cirugías${k ? ' <small>(cont.)</small>' : ''}</h2>${sub}${hoja('', cirTabla(arr))}`)));
    if (!N) return out;
    // 2) Por categoría (solo si hay más de una)
    if (r.cats.length > 1) {
      out.push(pagina('p-resumen p-equipo', `<h2>Lesionados por categoría</h2>${sub}
        ${hoja('Lesionados por semana según categoría', apiladas(r) + leyenda(r.cats.map((c) => [c.label, c.color])))}
        <div class="eq-2">${hoja('Lesionados por categoría (%)', `<div class="epi-torta-w">${torta(r.cats, N)}</div>` + leyenda(r.cats.map((c) => [`${c.label} · ${c.n} (${Math.round(100 * c.n / N)}%)`, c.color])))}
        ${hoja('Lesiones por categoría', barrasV(r.cats.map((c) => [c.label, c.n, c.color])))}</div>`));
    }
    // 3) Tipos y zonas
    out.push(pagina('p-resumen p-equipo', `<h2>Tipos y zonas de lesión</h2>${sub}
      <div class="eq-2">${hoja('Tipos de lesión durante el período', r.tipos.length ? barrasV(r.tipos, '#3b82e0') : '<p class="epi-vacio">Sin tipo de lesión registrado.</p>')}
      ${hoja('Lesiones por zona', r.zonas.length ? barrasH(r.zonas, '#2f7a4a') + (r.sinZona ? `<p class="epi-nota">${r.sinZona} sin zona registrada.</p>` : '') : '<p class="epi-vacio">Sin zonas registradas.</p>')}</div>
      <div class="eq-2">${hoja('Lesiones musculares', lista(r.muscular, 'Sin lesiones musculares.'))}${hoja('Lesiones ligamentosas', lista(r.ligamentosa, 'Sin lesiones ligamentosas.'))}</div>
      <p class="epi-nota epi-nota-b">El tipo sale del tejido marcado en cada lesión; una lesión con dos tejidos cuenta en ambos. Tendón, ligamento, hueso, etc. se agrupan como en el EPI: «Otras» reúne articular, nervioso, piel y otro.</p>`));
    // 4) Una página por categoría: curva semanal + tabla Semana · Jugador · Lesión
    r.cats.forEach((c) => {
      const filas = Object.keys(c.porSem).map(Number).sort((a, b) => a - b).map((w) => ({ w, items: c.porSem[w] }));
      const costo = (f) => 14 + 15 * f.items.reduce((t, x) => t + Math.max(lin(x.nombre, 34), lin(x.titulo, 44)), 0);
      repartir(filas, costo, 580, 840).forEach((arr, k) => {
        const fila = (f) => {
          const sem = `<td><b>Semana ${f.w + 1}</b><small>${e(corta(suma(r.ini0, 7 * f.w)))}</small></td>`, nom = (x) => (x.rep ? `<mark class="epi-rep">${e(x.nombre)}</mark>` : e(x.nombre));
          return f.items.length === 1 ? `<tr>${sem}<td>${nom(f.items[0])}</td><td>${e(f.items[0].titulo)}</td></tr>` : `<tr>${sem}<td><ul>${f.items.map((x) => `<li>${nom(x)}</li>`).join('')}</ul></td><td><ul>${f.items.map((x) => `<li>${e(x.titulo)}</li>`).join('')}</ul></td></tr>`;
        };
        out.push(pagina('p-resumen p-equipo', `<h2>${e(c.label)} <small>${c.n} lesion${c.n === 1 ? '' : 'es'} · ${c.jug.size} jugador${c.jug.size === 1 ? '' : 'es'}${k ? ' · cont.' : ''}</small></h2>${sub}
          ${k ? '' : hoja(`${c.label} · lesionados por semana`, lineaSemanas(c.sem, r.ini0, c.color, 170))}
          <div class="epi-hoja epi-tabla" style="--cc:${c.color}"><table class="epi-t"><thead><tr><th>Semana</th><th>Jugador</th><th>Lesión</th></tr></thead><tbody>${arr.map(fila).join('')}</tbody></table></div>
          <p class="epi-nota"><mark class="epi-rep">Amarillo</mark>: jugador con más de una lesión en el período.</p>`));
      });
    });
    return out;
  };
})();

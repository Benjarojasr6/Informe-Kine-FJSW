/* Mapa corporal: silueta anatómica suave (frente y espalda) con brillos de color por zona.
   Verde claro = mínima · verde = leve · amarillo = moderada · rojo = grave · gris = por definir.
   Mantiene los mismos ids de zona (F-… frente, E-… espalda) para que los registros guardados sigan funcionando. */
(function () {
  const K = window.K;

  /* ---------- Silueta atlética (mitad izquierda, lienzo 200 × 452) ---------- */
  const TRAMO_A = [ // cabeza → cuello → hombro → brazo → mano → axila
    [100, 4], [91, 6], [86.5, 14], [85.5, 26], [88, 38], [93, 45], [94, 52], [93, 60],
    [82, 63], [64, 67], [50, 73], [41, 84], [38, 98], [36, 120], [34, 145], [32, 160],
    [28, 180], [24, 200], [20, 214], [14, 224], [9, 233], [10, 240], [16, 238], [22, 232], [26, 236], [29, 230], [32, 222],
    [37, 205], [42, 185], [46, 162], [49, 145], [50, 125], [54, 106], [58, 98]
  ];
  const TRAMO_B = [ // axila → cintura → cadera → pierna → pie → entrepierna
    [58, 98], [60, 115], [63, 135], [66, 155], [66, 172], [62, 190], [61, 205],
    [62, 225], [63, 250], [66, 275], [67, 295], [64, 320], [66, 345], [69, 370], [72, 392],
    [70, 405], [64, 420], [58, 432], [60, 442], [72, 446], [82, 441], [86, 426],
    [86, 405], [85, 390], [86, 365], [88, 340], [90, 315], [90, 298], [92, 275], [95, 248], [98, 225], [100, 212]
  ];
  const f = (n) => +n.toFixed(1);
  // Curva suave (Catmull-Rom → Bézier) a través de los puntos.
  function curva(p, primero) {
    let d = primero ? `M${p[0][0]} ${p[0][1]}` : '';
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || (i === 0 && primero ? [200 - p[1][0], p[1][1]] : p[i]);
      const p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${p2[0]} ${p2[1]}`;
    }
    return d;
  }
  const espejar = (p) => p.map(([x, y]) => [200 - x, y]).reverse();
  const SILUETA = curva(TRAMO_A, true) + curva(TRAMO_B, false) +
    curva(espejar(TRAMO_B), false) + curva(espejar(TRAMO_A), false) + ' Z';

  /* ---------- Zonas: regiones poligonales (mitad izquierda) recortadas con la silueta ---------- */
  const poly = (pts, espejo) => 'M' + pts.map(([x, y]) => `${espejo ? 200 - x : x} ${y}`).join(' L') + ' Z';
  // Contorno de la región sin el borde que cae sobre el eje central (para no dibujar una línea vertical al medio).
  const bordes = (pts, espejo) => {
    const P = pts.map(([x, y]) => [espejo ? 200 - x : x, y]); let d = '';
    P.forEach((a, i) => { const b = P[(i + 1) % P.length]; if (a[0] === 100 && b[0] === 100) return; d += `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`; });
    return d;
  };
  const HOMBRO = [[20, 61], [84, 61], [70, 80], [60, 98], [20, 98]];
  const BRAZO = [[10, 98], [57, 98], [57, 152], [10, 152]];
  const CODO = [[10, 152], [57, 152], [57, 172], [10, 172]];
  const ANTEBRAZO = [[10, 172], [57, 172], [57, 212], [10, 212]];
  const MANO = [[0, 212], [57, 212], [57, 234], [0, 234]];
  const DEDOS = [[0, 234], [57, 234], [57, 255], [0, 255]];
  const RODILLA = [[50, 284], [100, 284], [100, 314], [50, 314]];
  const MUSLO = [[50, 200], [58, 202], [100, 214], [100, 284], [50, 284]];
  const ISQUIOS = [[50, 202], [58, 208], [100, 214], [100, 284], [50, 284]];
  // [clave, nombre, género, polígono]
  const FRENTE = [
    ['hombro', 'Hombro', 'm', HOMBRO],
    ['pecho', 'Pecho', 'm', [[84, 61], [100, 61], [100, 118], [57, 118], [57, 98], [60, 98]]],
    ['abdomen', 'Abdomen', 'm', [[57, 118], [100, 118], [100, 162], [57, 162]]],
    ['cadera', 'Cadera', 'f', [[57, 162], [100, 162], [100, 186], [80, 186], [80, 208], [58, 202]]],
    ['ingle', 'Ingle', 'f', [[80, 186], [100, 186], [100, 214], [80, 208]]],
    ['brazo', 'Brazo', 'm', BRAZO], ['codo', 'Codo', 'm', CODO], ['antebrazo', 'Antebrazo', 'm', ANTEBRAZO], ['mano', 'Mano', 'f', MANO], ['dedos', 'Dedos', 'mp', DEDOS],
    ['muslo', 'Muslo {l} anterior', 'm', MUSLO],
    ['rodilla', 'Rodilla', 'f', RODILLA],
    ['pierna', 'Pierna {l} anterior', 'f', [[50, 314], [100, 314], [100, 390], [50, 390]]],
    ['tobillo', 'Tobillo', 'm', [[50, 390], [100, 390], [100, 412], [50, 412]]],
    ['pie', 'Pie', 'm', [[40, 412], [100, 412], [100, 436], [40, 436]]],
    ['ortejos', 'Ortejos', 'mp', [[40, 436], [100, 436], [100, 452], [40, 452]]]
  ];
  const CENTRO = [
    ['cabeza', 'Cabeza / cara', [[70, 0], [130, 0], [130, 46], [70, 46]]],
    ['cuello', 'Cuello', [[80, 46], [120, 46], [120, 61], [80, 61]]]
  ];
  const ESPALDA = [
    ['hombro-p', 'Hombro (posterior)', 'm', HOMBRO],
    ['espalda', 'Espalda alta', 'f', [[84, 61], [100, 61], [100, 118], [57, 118], [57, 98], [60, 98]]],
    ['lumbar', 'Zona lumbar', 'f', [[57, 118], [100, 118], [100, 162], [57, 162]]],
    ['gluteo', 'Glúteo', 'm', [[57, 162], [100, 162], [100, 214], [58, 208]]],
    ['brazo-p', 'Brazo (posterior)', 'm', BRAZO], ['codo-p', 'Codo (posterior)', 'm', CODO], ['antebrazo-p', 'Antebrazo (posterior)', 'm', ANTEBRAZO], ['mano-p', 'Mano (dorso)', 'f', MANO], ['dedos-p', 'Dedos (dorso)', 'mp', DEDOS],
    ['isquios', 'Muslo {l} posterior', 'm', ISQUIOS],
    ['poplitea', 'Rodilla (posterior)', 'f', RODILLA],
    ['pantorrilla', 'Pierna {l} posterior', 'f', [[50, 314], [100, 314], [100, 386], [50, 386]]],
    ['aquiles', 'Tendón de Aquiles', 'm', [[50, 386], [100, 386], [100, 412], [50, 412]]],
    ['talon', 'Talón / planta', 'm', [[40, 412], [100, 412], [100, 452], [40, 452]]]
  ];
  const CENTRO_P = [
    ['cabeza-p', 'Cabeza (posterior)', CENTRO[0][2]],
    ['nuca', 'Cuello (posterior)', CENTRO[1][2]]
  ];

  const zonas = []; // [{id, vista, d}]
  K.ZONAS = {};
  function lado(g, l) {
    if (g === 'f') return l === 'd' ? 'derecha' : 'izquierda';
    if (g === 'mp') return l === 'd' ? 'derechos' : 'izquierdos';
    return l === 'd' ? 'derecho' : 'izquierdo';
  }
  // Nombres sin paréntesis; "{l}" marca dónde va el lado (muslo derecho anterior).
  const limpio = (n) => {
    return n.replace(/\s*\(([^)]*)\)/g, ' $1').replace(/\s+/g, ' ').trim();
  };
  function agrega(vista, lista, centros, ladoIzqImagen) {
    const ladoDerImagen = ladoIzqImagen === 'd' ? 'i' : 'd';
    lista.forEach(([k, n, g, pts]) => {
      const idA = `${vista}-${k}-${ladoIzqImagen}`, idB = `${vista}-${k}-${ladoDerImagen}`;
      zonas.push({ id: idA, vista, d: poly(pts, false), b: bordes(pts, false) });
      zonas.push({ id: idB, vista, d: poly(pts, true), b: bordes(pts, true) });
      const nom = (l) => (n.includes('{l}') ? n.replace('{l}', lado(g, l)) : `${n} ${lado(g, l)}`);
      K.ZONAS[idA] = limpio(nom(ladoIzqImagen));
      K.ZONAS[idB] = limpio(nom(ladoDerImagen));
    });
    centros.forEach(([k, n, pts]) => {
      const id = `${vista}-${k}`;
      zonas.push({ id, vista, d: poly(pts, false), b: bordes(pts, false) });
      K.ZONAS[id] = limpio(n);
    });
  }
  agrega('F', FRENTE, CENTRO, 'd'); // en el frente, la izquierda de la imagen es el lado derecho del paciente
  agrega('E', ESPALDA, CENTRO_P, 'i'); // en la espalda es al revés

  K.nombreZona = (id) => K.ZONAS[id] || id;
  K.nombreZonaLimpia = K.nombreZona;
  K.COLORES_GRAVEDAD = { minima: '#8fd3a8', leve: '#3fbf6a', moderada: '#f5b400', grave: '#e8353d', pordefinir: '#9aa4a9' };

  // Escala de calor (menos → más casos): amarillo claro → naranja → rojo.
  K.colorCalor = (t) => {
    const stops = [[243, 227, 160], [240, 160, 48], [192, 57, 43]];
    t = Math.max(0, Math.min(1, t)) * 2; const i = Math.min(1, Math.floor(t)), u = t - i;
    const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * u));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  };
  let _n = 0;
  /* opts: { zonas:{id:gravedad}, seleccion:[ids], interactivo:bool, oscuro:bool } */
  K.mapaCorporal = function (opts) {
    opts = opts || {};
    const uid = 'bm' + ++_n;
    const z = opts.zonas || {};
    const sel = new Set(opts.seleccion || []);
    const claro = !opts.oscuro;
    const c1 = opts.pagina ? '#d4dcd7' : claro ? '#8b8b8b' : '#d3d7d4', c2 = opts.pagina ? '#b3beb7' : claro ? '#6c6c6c' : '#a6ada9';
    const linea = opts.pagina ? 'rgba(255,255,255,.9)' : claro ? 'rgba(255,255,255,.55)' : 'rgba(30,45,38,.35)';
    const contorno = opts.pagina ? 'rgba(21,76,43,.55)' : claro ? 'rgba(40,40,40,.55)' : 'rgba(255,255,255,.55)';
    const figura = (vista, dx) => {
      const segs = zonas.filter((x) => x.vista === vista).map((x) => {
        const g = z[x.id];
        const cls = 'zona' + (g ? ' con-caso g-' + g : '') + (sel.has(x.id) ? ' sel' : '');
        const cal = opts.calor && opts.calor[x.id] ? opts.calor[x.id] / (opts.calorMax || 1) : 0;
        const fill = g ? K.COLORES_GRAVEDAD[g] : cal ? K.colorCalor(cal) : 'transparent';
        return `<path class="${cls}" data-zona="${x.id}" d="${x.d}" fill="${fill}" fill-opacity="${g || cal ? .93 : 1}" stroke="none"><title>${K.esc(K.ZONAS[x.id])}</title></path>`;
      }).join('');
      return `<g transform="translate(${dx},0)">
<ellipse cx="100" cy="448" rx="84" ry="12" fill="url(#${uid}-sombra)"/>
<path d="${SILUETA}" fill="url(#${uid}-cuerpo)"/>
<g clip-path="url(#${uid}-sil)">${segs}<path d="${zonas.filter((x) => x.vista === vista).map((x) => x.b).join('')}" fill="none" stroke="${linea}" stroke-width="1.1" pointer-events="none"/></g>
<path d="${SILUETA}" fill="none" stroke="${contorno}" stroke-width="1" stroke-linejoin="round" pointer-events="none"/>
</g>`;
    };
    const izq = (v) => (v === 'F' ? 'Derecha' : 'Izquierda'), der = (v) => (v === 'F' ? 'Izquierda' : 'Derecha');
    return `<svg class="mapa-corporal${opts.interactivo ? ' interactivo' : ''}" data-uid="${uid}" viewBox="0 0 440 486" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mapa corporal">
<defs>
<clipPath id="${uid}-sil"><path d="${SILUETA}"/></clipPath>
<linearGradient id="${uid}-cuerpo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
<radialGradient id="${uid}-sombra"><stop offset="0" stop-color="#000" stop-opacity=".4"/><stop offset=".6" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
</defs>
${figura('F', 10)}${figura('E', 230)}
<text x="14" y="52" class="mapa-lado">${izq('F')}</text><text x="206" y="52" text-anchor="end" class="mapa-lado">${der('F')}</text>
<text x="234" y="52" class="mapa-lado">${izq('E')}</text><text x="426" y="52" text-anchor="end" class="mapa-lado">${der('E')}</text>
<text x="110" y="480" text-anchor="middle" class="mapa-rotulo">Frente</text>
<text x="330" y="480" text-anchor="middle" class="mapa-rotulo">Espalda</text>
</svg>`;
  };

  K.leyendaGravedad = () =>
    `<div class="leyenda-grav">${K.GRAV_ORDEN.map((g) => `<span><i style="background:${K.COLORES_GRAVEDAD[g]}"></i>${K.GRAVEDADES[g]}${g === 'pordefinir' ? '' : ' <small>' + K.GRAV_DIAS[g].replace(' fuera', '') + '</small>'}</span>`).join('')}</div>`;

  /* Tarjetas con el detalle (como en el ejemplo): etiquetas = [{tipo, titulo, gravedad}] */
  K.callouts = function (etiquetas, max) {
    max = max || 4;
    if (!etiquetas.length) return '';
    const sh = etiquetas.slice(0, max);
    const html = sh.map((t) => `<div class="callout"><i style="background:${K.COLORES_GRAVEDAD[t.gravedad] || K.COLORES_GRAVEDAD.leve}"></i><span><b>${K.esc(t.tipo)}</b> – ${K.esc(t.titulo)}</span></div>`).join('');
    return `<div class="callouts">${html}${etiquetas.length > max ? `<div class="callout mas">+ ${etiquetas.length - max} más</div>` : ''}</div>`;
  };
})();

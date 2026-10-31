/* PDF real, sin ventana de impresión: cada página se dibuja como imagen (JPEG) y se arma el archivo PDF aquí mismo.
   Funciona igual en iPhone, Android y computador; al terminar se abre “Compartir” (WhatsApp, Archivos…) o se descarga. */
(function () {
  const K = window.K;
  const e = K.esc;
  const PX = 96;                       // 1 pulgada = 96 px de CSS
  const LW = 8.5 * PX, LH = 11 * PX;   // carta: 816 × 1056 px
  const MARGEN = 0.55 * PX;            // márgenes de los documentos de flujo (partido, semanal, registro clínico)
  const ESCALA = 1.8, CALIDAD = 0.86;  // nitidez y peso del archivo
  const cache = { css: null, datos: new Map() };
  let cancelado = false;

  /* ---------- Recursos incrustados (el dibujo no puede cargar archivos externos) ---------- */
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf' };
  const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  function aDataURL(url) {
    if (/^data:/i.test(url)) return Promise.resolve(url);
    if (cache.datos.has(url)) return cache.datos.get(url);
    const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
    const p = fetch(url).then((r) => { if (!r.ok) throw new Error('sin archivo'); return r.blob(); })
      .then((b) => new Promise((ok, mal) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = () => mal(f.error); f.readAsDataURL(b); }))
      .then((d) => (MIME[ext] ? d.replace(/^data:[^;,]*/, 'data:' + MIME[ext]) : d))
      .catch(() => { cache.datos.delete(url); return PIXEL; });
    cache.datos.set(url, p);
    return p;
  }
  // El PDF siempre usa el diseño de pantalla grande: se quitan las reglas para celular y las de impresión.
  function sinMedia(t) {
    let out = '', i = 0;
    while (i < t.length) {
      const k = t.indexOf('@media', i);
      if (k < 0) { out += t.slice(i); break; }
      out += t.slice(i, k);
      const a = t.indexOf('{', k); let prof = 1, j = a + 1;
      while (j < t.length && prof) { const c = t[j++]; if (c === '{') prof++; else if (c === '}') prof--; }
      const cond = t.slice(k, a), cuerpo = t.slice(a + 1, j - 1);
      if (/min-width/.test(cond) && !/print|max-width/.test(cond)) out += cuerpo;
      i = j;
    }
    return out;
  }
  async function cssEmbebido() {
    if (cache.css) return cache.css;
    let out = '';
    for (const h of ['css/app.css', 'css/report.css']) {
      let t = '';
      try { t = await (await fetch(h)).text(); } catch (x) { continue; }
      const base = new URL(h, document.baseURI);
      const urls = Array.from(new Set(Array.from(t.matchAll(/url\(\s*['"]?([^)'"]+?)['"]?\s*\)/g)).map((m) => m[1]))).filter((u) => !/^(data:|#)/i.test(u));
      for (const u of urls) { const d = await aDataURL(new URL(u, base).href); t = t.split(u).join(d); }
      out += sinMedia(t) + '\n';
    }
    if (!out.trim()) out = Array.from(document.querySelectorAll('style')).map((x) => sinMedia(x.textContent)).join('\n'); // versión de una sola página (vista previa)
    // Tipografía elegida en Ajustes (los archivos de fuente se incrustan como datos, igual que las imágenes).
    if (K.fuentesCSS && !window.K_ARTEFACTO) {
      let t = K.fuentesCSS();
      if (t) {
        const base = new URL('index.html', document.baseURI);
        const urls = Array.from(new Set(Array.from(t.matchAll(/url\(\s*['"]?([^)'"]+?)['"]?\s*\)/g)).map((m) => m[1])));
        for (const u of urls) { const d = await aDataURL(new URL(u, base).href); t = t.split(u).join(d); }
        out += t + '\n';
      }
    }
    cache.css = out.replace(/\]\]>/g, ']] >');
    return cache.css;
  }
  async function incrustarImagenes(raiz) {
    const imgs = Array.from(raiz.querySelectorAll('img'));
    await Promise.all(imgs.map(async (im) => {
      const s = im.getAttribute('src'); if (!s) return;
      if (window.K_ASSETS && window.K_ASSETS[s]) { im.setAttribute('src', window.K_ASSETS[s]); return; }
      im.setAttribute('src', await aDataURL(new URL(s, document.baseURI).href));
    }));
  }
  const aXHTML = (nodo) => new XMLSerializer().serializeToString(nodo);
  const analizar = (html) => { const d = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html'); return d.body; };

  /* ---------- Dibujo de un trozo de HTML ---------- */
  function svgURL(css, inner, w, h, esc, desplazo, estiloBase) {
    const s = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * esc)}" height="${Math.round(h * esc)}" viewBox="0 0 ${w} ${h}"><foreignObject x="0" y="0" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;overflow:hidden;position:relative;${estiloBase || ''}"><style>/*<![CDATA[*/${css}/*]]>*/</style><div style="width:${w}px;margin-top:${-(desplazo || 0)}px">${inner}</div></div></foreignObject></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }
  function cargarImagen(src) {
    return new Promise((ok, mal) => {
      const im = new Image();
      im.onload = () => ok(im); im.onerror = () => mal(new Error('No se pudo dibujar la página'));
      im.src = src;
    });
  }
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms || 0));
  async function dibujar(ctx, src, x, y, w, h) {
    // Primera pasada: deja que el navegador cargue tipografías e imágenes del dibujo; la segunda es la que se usa.
    let im = await cargarImagen(src);
    try { if (im.decode) await im.decode(); } catch (x2) { /* sigue */ }
    ctx.drawImage(im, x, y, w, h);
    await pausa(30);
    ctx.clearRect(x, y, w, h); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h);
    ctx.drawImage(im, x, y, w, h);
    im.src = ''; im = null;
  }
  async function aJPEG(canvas) {
    const blob = await new Promise((ok, mal) => { try { canvas.toBlob((b) => (b ? ok(b) : mal(new Error('lienzo bloqueado'))), 'image/jpeg', CALIDAD); } catch (x) { mal(x); } });
    return new Uint8Array(await blob.arrayBuffer());
  }
  const nuevoLienzo = (w, h) => { const c = document.createElement('canvas'); c.width = Math.round(w * ESCALA); c.height = Math.round(h * ESCALA); const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); return [c, ctx]; };

  /* ---------- Documentos de flujo: se cortan en páginas sin partir filas ni títulos ---------- */
  function cortes(raiz, alto) {
    const top0 = raiz.getBoundingClientRect().top, total = Math.ceil(raiz.getBoundingClientRect().height);
    const rel = (n) => { const r = n.getBoundingClientRect(); return [r.top - top0, r.bottom - top0]; };
    const bloques = Array.from(raiz.querySelectorAll('tr, li, p, h1, h2, h3, h4, img, svg, .nobr, .bit-it, .bd-p, .bd-k, .bd-r, .bd-leyenda')).map(rel).filter(([t, b]) => b - t > 2);
    const cand = [];
    raiz.querySelectorAll('*').forEach((n) => {
      if (/^(H1|H2|H3|H4)$/.test(n.tagName) || /bit-h2|bit-mes/.test(n.className || '')) return;
      const b = rel(n)[1]; if (b > 4 && b < total) cand.push(b);
    });
    const validos = Array.from(new Set(cand.map(Math.round))).filter((y) => !bloques.some(([t, b]) => t + 1 < y && y < b - 1)).sort((a, b) => a - b);
    const out = []; let ini = 0;
    while (ini < total - 1) {
      const lim = ini + alto;
      if (total <= lim) { out.push([ini, total]); break; }
      let fin = 0;
      for (let i = validos.length - 1; i >= 0; i--) if (validos[i] <= lim && validos[i] > ini + alto * 0.3) { fin = validos[i]; break; }
      if (!fin) fin = lim;
      out.push([ini, fin]); ini = fin;
    }
    return out.length ? out : [[0, Math.max(total, 1)]];
  }

  /* ---------- Escritura del PDF ---------- */
  function armarPDF(paginas, titulo) {
    const enc = new TextEncoder(), partes = [], offs = [];
    let largo = 0;
    const emitir = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; partes.push(b); largo += b.length; };
    const obj = (n, cuerpo) => { offs[n] = largo; emitir(n + ' 0 obj\n'); emitir(cuerpo); emitir('\nendobj\n'); };
    const n = paginas.length, info = 3 + 3 * n;
    emitir('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Count ${n} /Kids [${paginas.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] >>`);
    paginas.forEach((p, i) => {
      const pg = 3 + 3 * i, ct = pg + 1, im = pg + 2;
      obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
      const flujo = 'q 612 0 0 792 0 0 cm /Im0 Do Q';
      obj(ct, `<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`);
      offs[im] = largo;
      emitir(`${im} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`);
      emitir(p.jpg); emitir('\nendstream\nendobj\n');
    });
    const hex = Array.from(String(titulo || 'Informe')).map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
    obj(info, `<< /Title <FEFF${hex}> /Producer (Kine SW) /Creator (Informe del area kinesica · Santiago Wanderers) >>`);
    const xref = largo;
    emitir(`xref\n0 ${info + 1}\n0000000000 65535 f \n`);
    for (let i = 1; i <= info; i++) emitir(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
    emitir(`trailer\n<< /Size ${info + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(partes, { type: 'application/pdf' });
  }

  /* ---------- Avance y entrega ---------- */
  let velo = null;
  function progreso(txt, frac) {
    if (!velo) {
      velo = document.createElement('div'); velo.className = 'pdf-prog'; velo.setAttribute('role', 'status');
      velo.innerHTML = '<div class="pdf-caja"><div class="pdf-rueda"></div><b data-t></b><div class="pdf-barra"><i data-b></i></div><p>No cierres la app mientras se prepara el archivo.</p><button type="button" class="btn sec chico" data-x>Cancelar</button></div>';
      velo.querySelector('[data-x]').onclick = () => { cancelado = true; };
      document.body.appendChild(velo);
    }
    velo.querySelector('[data-t]').textContent = txt;
    velo.querySelector('[data-b]').style.width = Math.round(100 * Math.max(0, Math.min(1, frac || 0))) + '%';
  }
  function quitarProgreso() { if (velo) { velo.remove(); velo = null; } }
  const nombreArchivo = (s) => (String(s || 'Informe').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Informe') + '.pdf';
  function descargar(blob, nombre) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }
  function entregar(blob, nombre) {
    const file = new File([blob], nombre, { type: 'application/pdf' });
    let puede = false;
    try { puede = !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch (x) { puede = false; }
    const tactil = window.matchMedia && matchMedia('(pointer:coarse)').matches;
    if (!puede && !tactil) { descargar(blob, nombre); K.aviso('PDF descargado'); return; }
    const url = URL.createObjectURL(blob), mb = (blob.size / 1048576).toFixed(1).replace('.', ',');
    K.modal({
      titulo: 'PDF listo',
      cuerpo: `<p style="margin:0 0 6px"><b>${e(nombre)}</b></p><p class="suave" style="margin:0 0 10px">${mb} MB</p>
        <p style="margin:0">${puede ? 'Toca <b>Compartir o guardar</b> para mandarlo por WhatsApp, correo o guardarlo en Archivos.' : 'Toca <b>Ver PDF</b> para abrirlo o <b>Descargar</b> para guardarlo.'}</p>`,
      botones: [
        { txt: 'Descargar', cls: 'sec', cerrar: false, fn: () => { descargar(blob, nombre); } },
        { txt: 'Ver PDF', cls: 'sec', cerrar: false, fn: () => { window.open(url, '_blank'); } }
      ].concat(puede ? [{
        txt: 'Compartir o guardar', cerrar: false,
        fn: () => { navigator.share({ files: [file], title: nombre.replace(/\.pdf$/, '') }).catch(() => { /* la persona cerró el menú */ }); }
      }] : []),
      alCerrar: () => setTimeout(() => URL.revokeObjectURL(url), 120000)
    });
  }

  /* ---------- API ---------- */
  async function preparar() {
    if (!window.XMLSerializer || !window.TextEncoder || !window.Blob) throw new Error('Este navegador no puede generar PDF');
    await cssEmbebido();
    try { await document.fonts.ready; } catch (x) { /* sigue */ }
  }
  function respaldoImprimir(html, titulo) {
    const root = document.getElementById('print-root'), t = document.title;
    root.innerHTML = html; document.title = titulo;
    const limpiar = () => { root.innerHTML = ''; document.title = t; window.removeEventListener('afterprint', limpiar); };
    window.addEventListener('afterprint', limpiar);
    K.aviso('En la ventana de impresión elige “Guardar como PDF”');
    setTimeout(() => window.print(), 250);
  }
  async function generar(titulo, trabajo, htmlRespaldo) {
    if (generar.ocupado) return;
    generar.ocupado = true; cancelado = false;
    progreso('Preparando el PDF…', 0);
    try {
      await preparar();
      const paginas = await trabajo();
      if (cancelado) { K.aviso('Cancelado'); return; }
      progreso('Armando el archivo…', 1);
      await pausa(20);
      const blob = armarPDF(paginas, titulo);
      quitarProgreso();
      entregar(blob, nombreArchivo(titulo));
    } catch (x) {
      if (window.console) console.warn('PDF:', x && x.message);
      quitarProgreso();
      if (htmlRespaldo) { respaldoImprimir(htmlRespaldo, titulo); }
      else K.aviso('No se pudo generar el PDF en este dispositivo', true);
    } finally { quitarProgreso(); generar.ocupado = false; }
  }

  K.pdf = {
    limpiarCache() { cache.css = null; },
    // Páginas ya diseñadas en tamaño carta (cada texto HTML es una <section class="pagina">).
    paginas(htmls, titulo) {
      return generar(titulo, async () => {
        const css = await cssEmbebido(), out = [];
        for (let i = 0; i < htmls.length; i++) {
          if (cancelado) return out;
          progreso(`Página ${i + 1} de ${htmls.length}`, i / htmls.length);
          const body = analizar(htmls[i]); await incrustarImagenes(body);
          const [c, ctx] = nuevoLienzo(LW, LH);
          await dibujar(ctx, svgURL(css, aXHTML(body.firstElementChild), LW, LH, ESCALA, 0, ''), 0, 0, c.width, c.height);
          out.push({ jpg: await aJPEG(c), w: c.width, h: c.height });
          c.width = c.height = 1; await pausa(0);
        }
        return out;
      }, htmls.join(''));
    },
    // Documento largo (informe de partido, informe semanal, registro clínico): se corta en páginas con márgenes.
    documento(html, titulo) {
      return generar(titulo, async () => {
        const css = await cssEmbebido(), out = [];
        const fuente = getComputedStyle(document.body).font.replace(/"/g, "'");
        const ancho = Math.round(LW - 2 * MARGEN), alto = Math.round(LH - 2 * MARGEN - 14);
        const body = analizar(html); await incrustarImagenes(body);
        const inner = aXHTML(body.firstElementChild);
        const base0 = `font:${fuente};color:#1c2420;background:#fff;`;
        // Se mide en un marco aparte con el mismo CSS del dibujo, para que los cortes de página calcen exacto.
        const marco = document.createElement('iframe');
        marco.setAttribute('aria-hidden', 'true');
        marco.style.cssText = `position:absolute;left:-99999px;top:0;width:${ancho * ESCALA}px;height:2000px;border:0;visibility:hidden`;
        document.body.appendChild(marco);
        let tramos;
        try {
          await new Promise((ok) => { marco.onload = ok; marco.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body style="margin:0"><div style="width:${ancho}px;${base0}"><div id="raiz" style="width:${ancho}px">${inner}</div></div></body></html>`; });
          const dd = marco.contentDocument;
          try { await dd.fonts.ready; } catch (x) { /* sigue */ }
          await Promise.all(Array.from(dd.images).map((i) => (i.complete ? 0 : new Promise((ok) => { i.onload = i.onerror = ok; }))));
          tramos = cortes(dd.getElementById('raiz').firstElementChild, alto);
        } finally { marco.remove(); }
        const base = base0;
        for (let i = 0; i < tramos.length; i++) {
          if (cancelado) return out;
          progreso(`Página ${i + 1} de ${tramos.length}`, i / tramos.length);
          const [t, b] = tramos[i], h = Math.max(1, b - t);
          const [c, ctx] = nuevoLienzo(LW, LH);
          const fx = MARGEN * ESCALA, fy = MARGEN * ESCALA;
          await dibujar(ctx, svgURL(css, inner, ancho, h, ESCALA, t, base), fx, fy, ancho * ESCALA, h * ESCALA);
          ctx.fillStyle = '#6b776f'; ctx.font = `${8.5 * ESCALA}px Inter, Arial, sans-serif`; ctx.textBaseline = 'alphabetic';
          ctx.textAlign = 'left'; ctx.fillText('Santiago Wanderers · Kinesiología Fútbol Joven SW', fx, (LH - 0.3 * PX) * ESCALA);
          ctx.textAlign = 'right'; ctx.fillText(`${i + 1} / ${tramos.length}`, (LW - MARGEN) * ESCALA, (LH - 0.3 * PX) * ESCALA);
          out.push({ jpg: await aJPEG(c), w: c.width, h: c.height });
          c.width = c.height = 1; await pausa(0);
        }
        return out;
      }, html);
    },
    armar: armarPDF,
    // Vista previa en pantalla de lo que saldría en el PDF (las mismas páginas, sin generar el archivo).
    // htmls: lista de páginas (esDoc=false) o un solo texto de documento de flujo (esDoc=true).
    async vistaPrevia(htmls, titulo, esDoc, alDescargar) {
      const previo = document.getElementById('vista-previa-cubierta'); if (previo) previo.remove();
      const velo = document.createElement('div');
      velo.id = 'vista-previa-cubierta';
      velo.innerHTML = `<div class="vp-barra"><b>${e(titulo || 'Vista previa')}</b><span class="vp-nota">Así se verá el PDF</span>${alDescargar ? '<button type="button" class="btn chico" data-vp-pdf>Descargar PDF</button>' : ''}<button type="button" class="btn sec chico" data-vp-x>Cerrar</button></div><div class="vp-cuerpo"><p class="vp-carga">Preparando vista previa…</p></div>`;
      document.body.appendChild(velo);
      velo.querySelector('[data-vp-x]').onclick = () => velo.remove();
      const bp = velo.querySelector('[data-vp-pdf]'); if (bp) bp.onclick = () => { velo.remove(); alDescargar(); };
      try {
        const css = await cssEmbebido(); try { await document.fonts.ready; } catch (x) { /* sigue */ }
        const lista = esDoc ? [htmls] : htmls, partes = [];
        for (const h of lista) { const body = analizar(h); await incrustarImagenes(body); partes.push(aXHTML(body.firstElementChild)); }
        const fuente = getComputedStyle(document.body).font.replace(/"/g, "'");
        const ancho = esDoc ? Math.round(LW - 2 * MARGEN) : LW;
        const cuerpo = esDoc
          ? `<div class="vp-hoja" style="width:${LW}px;padding:${MARGEN}px;box-sizing:border-box;background:#fff;margin:0 auto 14px;box-shadow:0 2px 10px rgba(0,0,0,.35);font:${fuente};color:#1c2420"><div style="width:${ancho}px">${partes[0]}</div></div>`
          : partes.map((x) => `<div style="width:${LW}px;margin:0 auto 14px;box-shadow:0 2px 10px rgba(0,0,0,.35);background:#fff">${x}</div>`).join('');
        const zona = velo.querySelector('.vp-cuerpo');
        const marco = document.createElement('iframe');
        marco.className = 'vp-marco'; marco.setAttribute('title', 'Vista previa del PDF');
        marco.style.cssText = `width:${LW}px;height:400px;border:0;transform-origin:0 0`;
        const caja = document.createElement('div'); caja.style.cssText = 'width:100%;overflow:hidden'; caja.appendChild(marco); zona.innerHTML = ''; zona.appendChild(caja);
        const ajustar = () => {
          const dd = marco.contentDocument; if (!dd || !dd.body) return;
          const disp = Math.max(240, zona.clientWidth - 8), k = Math.min(1, disp / LW);
          marco.style.height = (dd.documentElement.scrollHeight + 4) + 'px';
          marco.style.transform = `scale(${k})`;
          caja.style.height = Math.round((dd.documentElement.scrollHeight + 4) * k) + 'px';
        };
        marco.onload = () => { setTimeout(ajustar, 60); setTimeout(ajustar, 400); };
        marco.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style><style>html,body{margin:0;background:#6f7a74}body{padding:10px 0}</style></head><body>${cuerpo}</body></html>`;
        window.addEventListener('resize', ajustar, { once: true });
      } catch (x) {
        const z = velo.querySelector('.vp-cuerpo'); if (z) z.innerHTML = '<p class="vp-carga">No se pudo armar la vista previa.</p>';
      }
    }
  };
})();

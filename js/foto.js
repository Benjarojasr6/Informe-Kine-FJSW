/* Editor de la foto del jugador (v1.9.10): después de subirla se puede mover, hacer zoom y dejar el fondo en blanco,
   para que todas las fotos queden parecidas. Todo ocurre en este dispositivo: la foto no sale a ningún servicio externo.
   K.editarFoto(urlOriginal, (urlNueva) => …) abre el editor; devuelve una foto cuadrada de 420 px (JPEG) con el fondo blanco. */
(function () {
  const K = window.K;
  const SALIDA = 420;      // lado de la foto que se guarda
  const TRABAJO = 520;     // lado mayor con el que se calcula el fondo (más pequeño = más rápido)

  const cargarImagen = (url) => new Promise((ok, mal) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => mal(new Error('imagen no válida')); im.src = url; });

  /* Fondo a blanco: se toma como «fondo» lo que se parece al color de los bordes de la foto y está conectado a ellos.
     Funciona bien con fondos parejos (pared, cielo, telón); con fondos muy cargados se puede subir la sensibilidad o ajustar a mano. */
  K.fotoFondoBlanco = function (im, tol) {
    const s = Math.min(1, TRABAJO / Math.max(im.width, im.height)), w = Math.max(1, Math.round(im.width * s)), h = Math.max(1, Math.round(im.height * s));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0, w, h);
    const dato = cx.getImageData(0, 0, w, h), px = dato.data, N = w * h;
    // color de referencia: promedio de la franja del borde (arriba, izquierda y derecha; abajo suele ser el cuerpo)
    let r0 = 0, g0 = 0, b0 = 0, n0 = 0; const franja = Math.max(2, Math.round(Math.min(w, h) * 0.03));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!(y < franja || ((x < franja || x >= w - franja) && y < h * 0.7))) continue;
      const i = (y * w + x) * 4; r0 += px[i]; g0 += px[i + 1]; b0 += px[i + 2]; n0++;
    }
    r0 /= n0; g0 /= n0; b0 /= n0;
    const lim = tol * tol * 3, dist = (i) => { const dr = px[i] - r0, dg = px[i + 1] - g0, db = px[i + 2] - b0; return dr * dr + dg * dg + db * db; };
    const fondo = new Uint8Array(N), cola = new Int32Array(N); let a = 0, z = 0;
    const meter = (p) => { if (fondo[p]) return; if (dist(p * 4) <= lim) { fondo[p] = 1; cola[z++] = p; } };
    for (let x = 0; x < w; x++) { meter(x); meter((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { meter(y * w); meter(y * w + w - 1); }
    while (a < z) { const p = cola[a++], x = p % w, y = (p / w) | 0; if (x > 0) meter(p - 1); if (x < w - 1) meter(p + 1); if (y > 0) meter(p - w); if (y < h - 1) meter(p + w); }
    // bordes suaves: se agranda 1 px el fondo (para quitar el halo) y se difumina la máscara
    let m = new Float32Array(N); for (let p = 0; p < N; p++) m[p] = fondo[p];
    const dil = new Float32Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = m[y * w + x]; if (v < 1) { for (let dy = -1; dy <= 1 && v < 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && m[yy * w + xx] === 1) { v = 1; break; } } } dil[y * w + x] = v; }
    const sua = new Float32Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let t = 0, k = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { t += dil[yy * w + xx]; k++; } } sua[y * w + x] = t / k; }
    let quitado = 0;
    for (let p = 0; p < N; p++) { const al = sua[p], i = p * 4; if (al > 0.5) quitado++; px[i] = px[i] * (1 - al) + 255 * al; px[i + 1] = px[i + 1] * (1 - al) + 255 * al; px[i + 2] = px[i + 2] * (1 - al) + 255 * al; px[i + 3] = 255; }
    cx.putImageData(dato, 0, 0);
    c._quitado = quitado / N; // fracción de la foto que se pasó a blanco
    return c;
  };

  K.editarFoto = async function (url, alListo) {
    // (devuelve la foto nueva por alListo; si se cancela no pasa nada y la foto anterior se mantiene)
    let im;
    try { im = await cargarImagen(url); } catch (x) { K.aviso('No se pudo leer la imagen', true); return; }
    const st = { z: 1, ox: 0, oy: 0, blanco: false, tol: 40 }; let sinFondo = null, ocupado = 0;
    const cover = () => Math.max(SALIDA / im.width, SALIDA / im.height);
    K.modal({
      titulo: 'Ajustar la foto',
      cuerpo: `<p class="suave" style="margin:0 0 8px">Arrastra la foto con el dedo (o usa las flechas) y cambia el zoom. Se guarda dentro del círculo.</p>
        <div class="fe-marco"><canvas class="fe-canvas" width="${SALIDA}" height="${SALIDA}" data-fe-canvas aria-label="Vista previa de la foto"></canvas><span class="fe-aro" aria-hidden="true"></span></div>
        <div class="fe-mov" role="group" aria-label="Mover la foto">
          <button type="button" class="btn sec" data-fe-mv="-1,0" aria-label="Mover a la izquierda">◀</button>
          <button type="button" class="btn sec" data-fe-mv="0,-1" aria-label="Mover hacia arriba">▲</button>
          <button type="button" class="btn sec" data-fe-mv="0,1" aria-label="Mover hacia abajo">▼</button>
          <button type="button" class="btn sec" data-fe-mv="1,0" aria-label="Mover a la derecha">▶</button>
          <button type="button" class="btn ghost" data-fe-centrar>Centrar</button></div>
        <label class="campo"><span>Zoom</span><input type="range" min="0.5" max="4" step="0.02" value="1" data-fe-zoom aria-label="Zoom"></label>
        <label class="check"><input type="checkbox" data-fe-blanco><span>Dejar el fondo en blanco</span></label>
        <div class="oculto" data-fe-sens><label class="campo"><span>Sensibilidad del fondo <small class="suave" data-fe-info></small></span><input type="range" min="12" max="110" step="1" value="40" data-fe-tol aria-label="Sensibilidad del fondo"></label>
          <p class="suave" style="margin:0 0 4px">Funciona mejor con fondos parejos. Si queda parte del fondo, sube la sensibilidad; si se borra parte del jugador, bájala. La foto se procesa solo en este dispositivo.</p></div>`,
      botones: [{ txt: 'Cancelar', cls: 'sec' }, { txt: 'Usar esta foto', fn: (m, hoja) => { const cv = document.createElement('canvas'); cv.width = cv.height = SALIDA; pintar(cv, false); alListo(cv.toDataURL('image/jpeg', 0.9)); } }],
      alMontar: (m, hoja) => {
        const cv = hoja.querySelector('[data-fe-canvas]'), zoom = hoja.querySelector('[data-fe-zoom]'), chk = hoja.querySelector('[data-fe-blanco]'), sens = hoja.querySelector('[data-fe-sens]'), tol = hoja.querySelector('[data-fe-tol]'), info = hoja.querySelector('[data-fe-info]');
        window.__fe = { st, pintarEn: (c) => pintar(c, false) }; // para pruebas
        const dibujar = () => pintar(cv, true);
        const limitar = () => { st.ox = Math.max(-SALIDA, Math.min(SALIDA, st.ox)); st.oy = Math.max(-SALIDA, Math.min(SALIDA, st.oy)); };
        const calcularFondo = () => { const id = ++ocupado; info.textContent = '(calculando…)'; setTimeout(() => { if (id !== ocupado) return; sinFondo = K.fotoFondoBlanco(im, st.tol); const q = Math.round(sinFondo._quitado * 100); info.textContent = `(se quitó el ${q} % de la foto)`; dibujar(); }, 30); };
        zoom.addEventListener('input', () => { st.z = Number(zoom.value); dibujar(); });
        chk.addEventListener('change', () => { st.blanco = chk.checked; sens.classList.toggle('oculto', !st.blanco); if (st.blanco) calcularFondo(); else dibujar(); });
        tol.addEventListener('input', () => { st.tol = Number(tol.value); if (st.blanco) calcularFondo(); });
        hoja.querySelectorAll('[data-fe-mv]').forEach((b) => b.addEventListener('click', () => { const [dx, dy] = b.dataset.feMv.split(',').map(Number); st.ox += dx * 14; st.oy += dy * 14; limitar(); dibujar(); }));
        hoja.querySelector('[data-fe-centrar]').addEventListener('click', () => { st.ox = st.oy = 0; st.z = 1; zoom.value = 1; dibujar(); });
        // arrastrar con el dedo (y pellizcar para el zoom)
        const ptr = new Map(); let d0 = 0, z0 = 1;
        const k = () => SALIDA / cv.getBoundingClientRect().width;
        cv.addEventListener('pointerdown', (ev) => { cv.setPointerCapture(ev.pointerId); ptr.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); if (ptr.size === 2) { const [a, b] = Array.from(ptr.values()); d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1; z0 = st.z; } });
        cv.addEventListener('pointermove', (ev) => {
          const p = ptr.get(ev.pointerId); if (!p) return;
          if (ptr.size === 1) { st.ox += (ev.clientX - p.x) * k(); st.oy += (ev.clientY - p.y) * k(); limitar(); }
          p.x = ev.clientX; p.y = ev.clientY;
          if (ptr.size === 2) { const [a, b] = Array.from(ptr.values()); st.z = Math.max(0.5, Math.min(4, z0 * (Math.hypot(a.x - b.x, a.y - b.y) / d0))); zoom.value = st.z; }
          dibujar();
        });
        const soltar = (ev) => { ptr.delete(ev.pointerId); };
        cv.addEventListener('pointerup', soltar); cv.addEventListener('pointercancel', soltar);
        cv.addEventListener('wheel', (ev) => { ev.preventDefault(); st.z = Math.max(0.5, Math.min(4, st.z * (ev.deltaY < 0 ? 1.06 : 0.94))); zoom.value = st.z; dibujar(); }, { passive: false });
        dibujar();
      }
    });
    function pintar(cv, guia) {
      const cx = cv.getContext('2d'); cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, SALIDA, SALIDA);
      const fuente = st.blanco && sinFondo ? sinFondo : im, sw = fuente.width, sh = fuente.height;
      const esc = cover() * st.z * (im.width / sw);          // la versión sin fondo tiene otra resolución: se escala igual
      const dw = sw * esc, dh = sh * esc;
      cx.imageSmoothingQuality = 'high'; cx.drawImage(fuente, SALIDA / 2 + st.ox - dw / 2, SALIDA / 2 + st.oy - dh / 2, dw, dh);
    }
  };
})();

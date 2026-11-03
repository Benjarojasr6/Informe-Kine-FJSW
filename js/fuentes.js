/* Tipografías del informe y de la app. La elegida se aplica en toda la app y también en el PDF.
   Cada opción redefine las dos familias que usa el diseño (“Caladea” = títulos, “Inter” = textos). */
(function () {
  const K = window.K;
  const cara = (fam, arch, peso, estilo) => `@font-face{font-family:${fam};font-weight:${peso};font-style:${estilo || 'normal'};src:url(fonts/${arch}.woff) format('woff');font-display:swap}`;
  // t = [regular, negrita, cursiva|null] de títulos · c = [regular, negrita] de textos
  const def = (id, nombre, desc, t, c) => ({ id, nombre, desc, t, c });
  K.FUENTES = [
    def('clasica', 'Clásica', 'Caladea y Inter (la de siempre)', null, null),
    def('editorial', 'Editorial', 'Lora y Carlito: serif cálida con textos suaves', ['Lora-Regular', 'Lora-Bold', 'Lora-Italic'], ['Carlito-Regular', 'Carlito-Bold']),
    def('elegante', 'Elegante', 'Pagella (estilo Palatino) con Inter', ['Pagella-Regular', 'Pagella-Bold', 'Pagella-Italic'], null),
    def('moderna', 'Moderna', 'Poppins en títulos con Inter en textos', ['Poppins-Regular', 'Poppins-Bold', null], null),
    def('sobria', 'Sobria', 'Inter Display en títulos y Inter en textos', ['InterDisplay-Regular', 'InterDisplay-Bold', null], null),
    def('comfortaa', 'Comfortaa', 'Redondeada y amable, en títulos y textos (se descarga la primera vez)', 'comfortaa', 'comfortaa'),
    def('yahei', 'Microsoft YaHei Light', 'Sans liviana y limpia, en títulos y textos', 'yahei', 'yahei'),
    def('comfortaa-yahei', 'Comfortaa + YaHei Light', 'Títulos en Comfortaa y textos en Microsoft YaHei Light', 'comfortaa', 'yahei')
  ];
  // Comfortaa viene de Google Fonts: se descarga una vez y queda guardada en el equipo para usarla sin conexión.
  // Microsoft YaHei Light es una fuente con licencia de Microsoft: se usa la instalada en el equipo (Windows la trae)
  // y, si no está, una parecida (Noto Sans) incluida en la app.
  const WEB = { comfortaa: { url: 'https://fonts.googleapis.com/css2?family=Comfortaa:wght@300..700&display=swap', clave: 'k-fw-comfortaa', local: ['Comfortaa', 'Comfortaa Regular'] } };
  const leerWeb = (id) => { try { return localStorage.getItem(WEB[id].clave) || ''; } catch (e) { return ''; } };
  const web = (fam, id) => {
    const css = leerWeb(id);
    if (css) return css.split('{FAM}').join(fam); // la descargada (variable 300–700)
    const loc = WEB[id].local.map((n) => `local('${n}')`).join(','); // sin descarga: la instalada en el equipo, o la de siempre
    return `@font-face{font-family:${fam};font-weight:300 500;src:${loc}}@font-face{font-family:${fam};font-weight:600 800;src:${loc}}`;
  };
  const yahei = (fam) => {
    const loc = (...n) => n.map((x) => `local('${x}')`).join(',');
    return `@font-face{font-family:${fam};font-weight:300 500;font-style:normal;src:${loc('Microsoft YaHei Light', 'MicrosoftYaHeiLight', 'Microsoft YaHei UI Light', 'MicrosoftYaHeiUILight')},url(fonts/YaHeiLight-Stand.woff) format('woff');font-display:swap}`
      + `@font-face{font-family:${fam};font-weight:600 800;font-style:normal;src:${loc('Microsoft YaHei Bold', 'MicrosoftYaHei-Bold', 'Microsoft YaHei UI Bold', 'MicrosoftYaHeiUI-Bold')},url(fonts/YaHeiBold-Stand.woff) format('woff');font-display:swap}`
      + `@font-face{font-family:${fam};font-weight:300 500;font-style:italic;src:${loc('Microsoft YaHei Light', 'MicrosoftYaHeiLight')},url(fonts/YaHeiLight-Stand.woff) format('woff');font-display:swap}`;
  };
  const especial = (v, fam) => (v === 'comfortaa' ? web(fam, 'comfortaa') : v === 'yahei' ? yahei(fam) : '');
  K.fuenteWebLista = (id) => !!leerWeb(id);
  let bajando = {};
  K.descargarFuenteWeb = async (id) => {
    const w = WEB[id]; if (!w || leerWeb(id) || bajando[id]) return;
    bajando[id] = true;
    try {
      const css = await (await fetch(w.url)).text();
      const bloques = css.split('@font-face').slice(1);
      let out = '';
      for (const b of bloques) {
        const i = css.indexOf('@font-face' + b);
        const ant = css.slice(Math.max(0, i - 40), i);
        if (!/\/\*\s*latin\s*\*\/\s*$/.test(ant)) continue; // solo el alfabeto latino (incluye tildes y ñ)
        const u = (b.match(/url\(([^)]+)\)/) || [])[1]; if (!u) continue;
        const blob = await (await fetch(u.replace(/['"]/g, ''))).blob();
        const d = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });
        const peso = (b.match(/font-weight:\s*([^;]+);/) || [])[1] || '300 700';
        out += `@font-face{font-family:{FAM};font-weight:${peso};font-style:normal;src:url(${d}) format('woff2');font-display:swap}`;
      }
      if (out) { localStorage.setItem(w.clave, out); puesta = null; K.aplicarFuentes(); if (K.render) K.render(); K.aviso && K.aviso('Comfortaa descargada: ya funciona sin conexión'); }
    } catch (e) { /* sin internet: se reintenta la próxima vez */ }
    bajando[id] = false;
  };
  K.fuenteActual = () => (K.FUENTES.find((f) => f.id === (K.state && K.state.fuente)) || K.FUENTES[0]);
  // CSS con las caras de la fuente elegida (vacío para la clásica, que ya viene en app.css).
  K.fuentesCSS = () => {
    const f = K.fuenteActual(); let css = '';
    if (typeof f.t === 'string' || typeof f.c === 'string') {
      if (f.t) css += especial(f.t, 'Caladea');
      if (f.c) css += especial(f.c, 'Inter');
      return css;
    }
    if (f.t) css += cara('Caladea', f.t[0], 400) + cara('Caladea', f.t[1], 700) + cara('Caladea', f.t[2] || f.t[0], 400, 'italic');
    if (f.c) css += cara('Inter', f.c[0], 400) + cara('Inter', f.c[1], 600) + cara('Inter', f.c[1], '700 800');
    return css;
  };
  let puesta = null;
  K.aplicarFuentes = () => {
    const f = K.fuenteActual(); if (puesta === f.id) return;
    let st = document.getElementById('k-fuentes');
    if (!st) { st = document.createElement('style'); st.id = 'k-fuentes'; document.head.appendChild(st); }
    st.textContent = K.fuentesCSS(); puesta = f.id;
    if ((f.t === 'comfortaa' || f.c === 'comfortaa') && !K.fuenteWebLista('comfortaa') && navigator.onLine !== false) K.descargarFuenteWeb('comfortaa');
    if (K.pdf && K.pdf.limpiarCache) K.pdf.limpiarCache();
  };
  K.selectorFuentes = () => {
    const act = K.fuenteActual().id;
    return `<div class="fuentes-op">${K.FUENTES.map((f) => {
      const tf = f.t ? '' : '';
      return `<button type="button" class="fuente-op${f.id === act ? ' act' : ''}" data-acc="fuente" data-id="${f.id}" data-fam="${f.id}"><span class="fo-t">${f.nombre}</span><small>${f.desc}</small></button>`;
    }).join('')}</div>`;
  };
  Object.assign(K.acciones, { fuente(el) { K.state.fuente = el.dataset.id; K.guardar(); K.aplicarFuentes(); K.render(); K.aviso('Tipografía: ' + K.fuenteActual().nombre); } });
  const r0 = K.render;
  K.render = function () { K.aplicarFuentes(); return r0.apply(this, arguments); };
})();

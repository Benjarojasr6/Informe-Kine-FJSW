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
    def('sobria', 'Sobria', 'Inter Display en títulos y Inter en textos', ['InterDisplay-Regular', 'InterDisplay-Bold', null], null)
  ];
  K.fuenteActual = () => (K.FUENTES.find((f) => f.id === (K.state && K.state.fuente)) || K.FUENTES[0]);
  // CSS con las caras de la fuente elegida (vacío para la clásica, que ya viene en app.css).
  K.fuentesCSS = () => {
    const f = K.fuenteActual(); let css = '';
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

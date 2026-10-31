/* Íconos: ilustraciones del informe (img:/svg:/emoji) e íconos de la interfaz. */
(function () {
  const K = window.K;

  /* Íconos de línea (estilo único y sobrio). Se dibujan con el color del texto. */
  const LINE = {
    lesion: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.4"/>',
    molestia: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.4v.4"/>',
    atenciones: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
    intervencion: '<g transform="rotate(-40 12 12)"><rect x="2" y="8" width="20" height="8" rx="4"/><path d="M9 8v8M15 8v8"/></g>',
    control: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4"/>',
    examen: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
    medicamento: '<g transform="rotate(-45 12 12)"><rect x="3" y="8" width="18" height="8" rx="4"/><path d="M12 8v8"/></g>',
    cirugia: '<path d="M3 21l9-9M12 12l8-8-2-1-8 6z"/>',
    hielo: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 2 3-2M9 20l3-2 3 2"/>',
    heridas: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 12h6M12 9v6"/>',
    electro: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    ejercicio: '<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/>',
    termoterapia: '<path d="M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4 0-7 1-10z"/>',
    vendaje: '<circle cx="9" cy="12" r="6"/><circle cx="9" cy="12" r="2"/><path d="M15 12h6v4h-9"/>',
    crioterapia: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><circle cx="12" cy="12" r="2.6"/>',
    presoterapia: '<path d="M8 3h8v8l3 3v7H5v-7l3-3z"/><path d="M5 17h14M9 7h6"/>',
    puncion: '<path d="M3 21l11-11M12 6l6 6M15 3l6 6M10 8l6 6"/>',
    masaje: '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2 7-6 7-3 0-4-2-6-5l-1-3c-.5-1 .5-2 1.5-1.5L8 13z"/>',
    mok: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 8v7M8.5 11.5h7"/>',
    estrella: '<path d="M12 3l2.7 6 6.3.6-4.8 4.3 1.5 6.3L12 17l-5.7 3.2 1.5-6.3L3 9.6 9.3 9z"/>',
    /* nuevos */
    estetoscopio: '<path d="M6 3v6a4 4 0 0 0 8 0V3M10 13v2a5 5 0 0 0 10 0v-1"/><circle cx="20" cy="12" r="2"/>',
    jeringa: '<path d="M15 4l5 5M13 6l5 5M4 20l1-4 9-9 4 4-9 9zM8 12l4 4M2 22l3-3"/>',
    frasco: '<rect x="7" y="9" width="10" height="12" rx="2"/><path d="M8 5h8v4H8zM7 14h10"/>',
    hueso: '<path d="M5.5 8.5a2 2 0 1 1 3-2.6l9.6 9.6a2 2 0 1 1 2.6 3 2 2 0 1 1-3 2.6L8.1 11.5a2 2 0 0 1-2.6-3z"/>',
    muleta: '<path d="M7 3h6M10 3l4 18M9.5 12l6-1.5"/>',
    termometro: '<path d="M14 14.5V5a2 2 0 0 0-4 0v9.5a4 4 0 1 0 4 0z"/><path d="M12 9v7"/>',
    pulso: '<path d="M2 12h4l2-6 4 12 3-9 2 3h5"/>',
    cronometro: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 2v3"/>',
    balon: '<circle cx="12" cy="12" r="9"/><path d="M12 8l4 3-1.5 5h-5L8 11zM12 3v5M16 11l5-2M14.5 16l3 4M9.5 16l-3 4M8 11L3 9"/>',
    zapatilla: '<path d="M3 16V8l5 2 3-3 3 3 4 2c2 .8 3 2 3 4v2H3z"/><path d="M3 19h18M9 13l2 1M12 12l2 1"/>',
    ultrasonido: '<path d="M4 8c2-3 4-3 6 0s4 3 6 0 3-2 4 0M4 14c2-3 4-3 6 0s4 3 6 0 3-2 4 0M4 20h16"/>',
    banda: '<path d="M3 7c3-3 6 3 9 0s6 3 9 0M3 13c3-3 6 3 9 0s6 3 9 0M3 19c3-3 6 3 9 0s6 3 9 0"/>',
    columna: '<rect x="9" y="3" width="6" height="3.5" rx="1"/><rect x="8.5" y="8" width="7" height="3.5" rx="1"/><rect x="8" y="13" width="8" height="3.5" rx="1"/><rect x="8.5" y="18" width="7" height="3" rx="1"/>',
    articulacion: '<path d="M9 2v8M15 2v8M9 14v8M15 14v8"/><circle cx="12" cy="12" r="3"/>',
    camilla: '<path d="M3 12h18v4H3zM6 16v4M18 16v4M5 12V8h6v4"/>',
    cruz: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
    gota: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    estiramiento: '<circle cx="12" cy="4.5" r="2"/><path d="M12 7v7M5 10l7-1 7 1M12 14l-4 7M12 14l4 7"/>',
    bicicleta: '<circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="M6 16l4-8h5l3 8M10 8H8M15 8l-3 8"/>',
    tens: '<rect x="3" y="7" width="7" height="10" rx="2"/><rect x="14" y="7" width="7" height="10" rx="2"/><path d="M10 10c1.5-1 2.5 1 4 0M10 14c1.5-1 2.5 1 4 0"/>',
    laser: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>',
    ondachoque: '<path d="M4 12h3M10 7c3 3 3 7 0 10M14 4c5 5 5 11 0 16M18 2c7 7 7 13 0 20"/>'
    ,corazon: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
    pesarusa: '<path d="M8 9.5a4 4 0 0 1 8 0"/><circle cx="12" cy="15" r="6"/>',
    cuerda: '<path d="M5 20V8a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v12"/><path d="M3 20h4M17 20h4"/>',
    pelotaterapia: '<circle cx="12" cy="12" r="9"/><path d="M5 8c4 2 10 2 14 0M5 16c4-2 10-2 14 0"/>',
    escalera: '<path d="M7 3v18M17 3v18M7 8h10M7 13h10M7 18h10"/>',
    balanza: '<path d="M12 4v16M5 20h14M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
    documento: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/>',
    lupa: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
    bolsahielo: '<rect x="6" y="3" width="12" height="18" rx="3"/><path d="M9 3V1.5M15 3V1.5M12 9v6M9.4 10.5l5.2 3M9.4 13.5l5.2-3"/>',
    tijeras: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 7.5L20 18M8.5 16.5L20 6"/>'
  };
  /* Pack "Color": las ilustraciones originales (cuando existen) y, para el resto, una insignia de color. */
  const COLOR_SVG = {
    lesion: '<svg viewBox="0 0 64 64"><path d="M32 6 L61 57 H3 Z" fill="#e8202b" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><rect x="29" y="23" width="6" height="19" rx="2" fill="#fff"/><circle cx="32" cy="48" r="3.4" fill="#fff"/></svg>',
    molestia: '<svg viewBox="0 0 64 64"><path d="M32 6 L61 57 H3 Z" fill="#f6c224" stroke="#e0a800" stroke-width="3" stroke-linejoin="round"/><rect x="29" y="23" width="6" height="19" rx="2" fill="#1a1a1a"/><circle cx="32" cy="48" r="3.4" fill="#1a1a1a"/></svg>',
    intervencion: '<svg viewBox="0 0 64 64"><g transform="rotate(45 32 32)"><rect x="4" y="21" width="56" height="22" rx="11" fill="#c98b5f"/><rect x="23" y="21" width="18" height="22" fill="#e6b995"/></g><g transform="rotate(-45 32 32)"><rect x="4" y="21" width="56" height="22" rx="11" fill="#b87b50" opacity=".92"/><rect x="23" y="21" width="18" height="22" fill="#dca67e"/></g><g fill="#8a5a38" opacity=".55"><circle cx="14" cy="14" r="1.3"/><circle cx="20" cy="9" r="1.3"/><circle cx="50" cy="50" r="1.3"/><circle cx="44" cy="55" r="1.3"/><circle cx="50" cy="14" r="1.3"/><circle cx="14" cy="50" r="1.3"/></g></svg>',
    control: '<svg viewBox="0 0 64 64"><rect x="10" y="10" width="38" height="48" rx="3" fill="#f7f1e6" stroke="#8b5a2b" stroke-width="3"/><rect x="21" y="5" width="16" height="9" rx="3" fill="#f2b705" stroke="#8b5a2b" stroke-width="2"/><g stroke="#38475a" stroke-width="2.6" stroke-linecap="round"><path d="M24 24h18M24 33h10M24 42h8"/></g><g fill="none" stroke="#1d9b58" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 24l2 2 3-4M15 33l2 2 3-4M15 42l2 2 3-4"/></g><path d="M48 38c0-4 5-5 6.5-1.5C56 33 61 34 61 38c0 5-6.5 9-6.5 9S48 43 48 38z" fill="#e8202b"/><path d="M30 41h8l2-5 3 10 2-5h6" fill="none" stroke="#38475a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    examen: '<svg viewBox="0 0 64 64"><rect x="8" y="5" width="48" height="54" rx="4" fill="#12202f" stroke="#f2a31c" stroke-width="4"/><g fill="none" stroke="#2f8fe0" stroke-width="3" stroke-linecap="round"><path d="M32 12v40"/><path d="M32 20c-8 0-13 3-14 9M32 20c8 0 13 3 14 9M32 28c-8 0-14 3-15 10M32 28c8 0 14 3 15 10M32 36c-6 0-11 3-12 9M32 36c6 0 11 3 12 9"/></g></svg>',
    medicamento: '<svg viewBox="0 0 64 64"><g transform="rotate(-28 24 28)"><rect x="3" y="18" width="42" height="20" rx="10" fill="#eeeeee"/><path d="M24 18h11a10 10 0 0 1 0 20H24z" fill="#eeeeee"/><rect x="3" y="18" width="42" height="20" rx="10" fill="none" stroke="#c9c9c9" stroke-width="1.5"/></g><g transform="rotate(-28 40 40)"><path d="M32 33h22a8.5 8.5 0 0 1 0 17H32a8.5 8.5 0 0 1 0-17z" fill="#f05d5e"/><path d="M32 33h11v17H32a8.5 8.5 0 0 1 0-17z" fill="#d9d9d9"/></g></svg>',
    cirugia: '<svg viewBox="0 0 64 64"><circle cx="22" cy="20" r="14" fill="#f48aa0" stroke="#111" stroke-width="3"/><rect x="19.5" y="11" width="5" height="18" rx="1.5" fill="#fff" stroke="#111" stroke-width="1.5"/><rect x="13" y="17.5" width="18" height="5" rx="1.5" fill="#fff" stroke="#111" stroke-width="1.5"/><path d="M32 30L58 6l3 3-24 26z" fill="#4fc3f7" stroke="#111" stroke-width="2.4" stroke-linejoin="round"/><path d="M37 35L8 58c-2 1-3-1-1-3l9-13z" fill="#eaeaea" stroke="#111" stroke-width="2.4" stroke-linejoin="round"/></svg>',
    hielo: '<svg viewBox="0 0 64 64"><path d="M14 22h36l-3 38H17z" fill="#6f8da3" stroke="#586f81" stroke-width="2" stroke-linejoin="round"/><ellipse cx="32" cy="22" rx="18" ry="5" fill="#8aa6ba"/><circle cx="32" cy="10" r="7" fill="#f3d3b8"/><path d="M21 22a11 11 0 0 1 22 0z" fill="#2f77b5"/><g stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M32 33v20M23.3 38l17.4 10M23.3 48l17.4-10"/></g><circle cx="32" cy="43" r="2.4" fill="#6f8da3" stroke="#fff" stroke-width="2"/></svg>',
    heridas: '<svg viewBox="0 0 64 64"><path d="M20 58c-6-8-10-17-13-24-1-3 2-5 4-3l7 8V9c0-3 4-3 4 0v22V6c0-3 4-3 4 0v25V8c0-3 4-3 4 0v23V13c0-3 4-3 4 0v27c2-3 6-9 9-8 3 1 1 5-1 9-3 6-7 12-10 18z" fill="#f6c9a6" stroke="#d99b6c" stroke-width="1.6" stroke-linejoin="round"/><rect x="21" y="26" width="24" height="9" rx="4.5" fill="#e9b184" stroke="#c98b5f" stroke-width="1.4" transform="rotate(-8 33 30)"/><rect x="28" y="27" width="10" height="7" rx="1.5" fill="#fff" transform="rotate(-8 33 30)"/><circle cx="33" cy="30.5" r="1.6" fill="#e8202b"/></svg>',
    electro: '<svg viewBox="0 0 64 64"><g stroke="#4a4f58" stroke-width="2.2" fill="none" stroke-linecap="round"><path d="M26 30c-4-6-8-9-14-9M32 28c0-7-1-13-4-19M38 30c4-6 8-9 14-9M32 28c2-7 6-12 12-14"/></g><g fill="#7f8896"><circle cx="11" cy="21" r="6"/><circle cx="27" cy="8" r="6"/><circle cx="53" cy="21" r="6"/><circle cx="45" cy="13" r="5"/></g><rect x="19" y="30" width="26" height="30" rx="5" fill="#d9dde3" stroke="#aeb4bd" stroke-width="2"/><rect x="23" y="34" width="18" height="12" rx="2" fill="#26323f"/><circle cx="32" cy="53" r="3.4" fill="#aeb4bd"/><path d="M26 41l3-3 3 4 3-5 3 4" fill="none" stroke="#4fe3a1" stroke-width="1.5" stroke-linecap="round"/></svg>',
    estrella: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="#f6c224" stroke="#e0a800" stroke-width="3"/><path d="M32 16l4.9 10 11 1.6-8 7.7 1.9 11L32 41.2 22.2 46.3l1.9-11-8-7.7 11-1.6z" fill="#fff"/></svg>'
  };
  const COLOR_PNG = ['atenciones', 'ejercicio', 'vendaje', 'termoterapia', 'crioterapia', 'presoterapia', 'masaje', 'puncion', 'mok'];
  const TONOS = ['#d9363e', '#e29a00', '#2e9e5b', '#2f7fc4', '#1f9a98', '#7a5bc7', '#a8693f', '#5b6b7a', '#d4557f', '#e2742a'];
  const tono = (n) => { let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0; return TONOS[h % TONOS.length]; };
  const glifo = (n, estilo) => `<g transform="translate(3.8 3.8) scale(.68)" fill="none" ${estilo} stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${LINE[n]}</g>`;
  const lineSVG = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LINE[n]}</svg>`;
  const colorBadge = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="${tono(n)}"/>${glifo(n, 'stroke="#fff"')}</svg>`;
  const insignia = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11.5" style="fill:var(--ib,#154c2b)"/>${glifo(n, 'style="stroke:var(--ig,#fff)"')}</svg>`;

  K.PACKS = [['linea', 'Línea'], ['color', 'Color'], ['insignia', 'Insignia']];
  K.packIconos = () => (K.state && K.state.packIconos) || 'linea';
  const ORIGINALES = Object.keys(COLOR_SVG).concat(COLOR_PNG);
  const propios = (pack) => ((K.state && K.state.iconosPropios) || {})[pack] || [];
  K.iconoPropio = (id) => { const t = (K.state && K.state.iconosPropios) || {}; for (const p of Object.keys(t)) { const f = t[p].find((x) => x.id === id); if (f) return f; } return null; };

  // Ícono del informe. spec: 'svg:nombre' | 'img:nombre' (el dibujo depende del pack elegido) | 'custom:id' (subido por ti) | emoji/texto
  K.ico = function (spec, cls) {
    cls = cls || '';
    if (!spec) spec = 'svg:estrella';
    const c = /^custom:(.+)$/.exec(spec);
    if (c) { const f = K.iconoPropio(c[1]); return f ? `<img class="ico ${cls}" src="${K.esc(f.data)}" alt="">` : K.ico('svg:estrella', cls); }
    const m = /^(?:svg|img):(.+)$/.exec(spec);
    if (!m) return `<span class="ico emoji ${cls}">${K.esc(spec)}</span>`;
    const n = LINE[m[1]] ? m[1] : 'estrella', pack = K.packIconos();
    if (pack === 'color') {
      if (COLOR_SVG[n]) return `<span class="ico ${cls}">${COLOR_SVG[n]}</span>`;
      if (COLOR_PNG.includes(n)) return `<img class="ico ${cls}" src="img/iconos/${n}.png" alt="">`;
      return `<span class="ico ico-pack ${cls}">${colorBadge(n)}</span>`;
    }
    if (pack === 'insignia') return `<span class="ico ico-pack ${cls}">${insignia(n)}</span>`;
    return `<span class="ico ico-linea ${cls}">${lineSVG(n)}</span>`;
  };
  // Íconos que se pueden elegir en cada pack: Color = solo los originales; Línea e Insignia = todos. Más los propios subidos.
  K.iconosPack = (pack) => (pack === 'color' ? ORIGINALES : Object.keys(LINE)).map((n) => 'svg:' + n).concat(propios(pack).map((x) => 'custom:' + x.id));
  K.agregarIconoPropio = (pack, nombre, data) => {
    K.state.iconosPropios = K.state.iconosPropios || {};
    (K.state.iconosPropios[pack] = K.state.iconosPropios[pack] || []).push({ id: K.uid(), nombre, data });
    K.guardar();
  };
  K.quitarIconoPropio = (id) => { const t = K.state.iconosPropios || {}; Object.keys(t).forEach((p) => { t[p] = t[p].filter((x) => x.id !== id); }); K.guardar(); };

  /* ---------- Íconos de la interfaz (trazo, usan currentColor) ---------- */
  const UI = {
    informe: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/>',
    registrar: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    jugadores: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M16.5 14.2c3 .2 4.9 2.2 4.9 5.2"/>',
    kine: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/><path d="M7 12.5h3l1.2-2.4 1.8 4.2 1.2-1.8H17"/>',
    calendario: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    manual: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M4.2 7.5l2.2 1.3M17.6 15.2l2.2 1.3M4.2 16.5l2.2-1.3M17.6 8.8l2.2-1.3"/>',
    pdf: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 14h4M12 11v6M10 17l2 2 2-2"/>',
    borrar: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
    ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    menos: '<path d="M5 12h14"/>',
    arriba: '<path d="M6 14l6-6 6 6"/>',
    arrastrar: '<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>',
    abajo: '<path d="M6 10l6 6 6-6"/>',
    ojo: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    camara: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    descargar: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    subir: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
    copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    casa: '<path d="M3.5 11.5L12 4l8.5 7.5"/><path d="M6 10v10h12V10"/><path d="M10 20v-5.5h4V20"/>',
    atras: '<path d="M15 5l-7 7 7 7"/>'
  };
  K.uiIco = (n, s) =>
    `<svg class="ui-ico" width="${s || 22}" height="${s || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${UI[n] || ''}</svg>`;
})();

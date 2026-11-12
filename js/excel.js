/* Excel (.xlsx) con los datos de todos los jugadores (v1.9.6).
   Escribe el archivo .xlsx directamente (un .zip sin comprimir con las hojas en XML): no necesita internet ni librerías externas.
   Fechas como fechas reales de Excel (se ven dd-mm-aaaa y se pueden ordenar), textos sin riesgo de fórmulas. */
(function () {
  'use strict';
  const K = window.K;
  const enc = new TextEncoder();

  /* ---------- ZIP (sin compresión) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(archivos) { // archivos: [{ nombre, datos: Uint8Array }]
    const partes = [], central = []; let pos = 0;
    const u16 = (v) => [v & 255, (v >>> 8) & 255], u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    archivos.forEach((a) => {
      const nom = enc.encode(a.nombre), crc = crc32(a.datos), n = a.datos.length;
      const cab = Uint8Array.from([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(n), ...u32(n), ...u16(nom.length), ...u16(0)]);
      partes.push(cab, nom, a.datos);
      central.push(Uint8Array.from([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(n), ...u32(n), ...u16(nom.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(pos)]), nom);
      pos += cab.length + nom.length + n;
    });
    const tamCentral = central.reduce((s, x) => s + x.length, 0);
    const fin = Uint8Array.from([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(archivos.length), ...u16(archivos.length), ...u32(tamCentral), ...u32(pos), ...u16(0)]);
    return new Blob(partes.concat(central, [fin]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* ---------- XLSX ---------- */
  const xml = (s) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const col = (i) => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
  const serie = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000) : null; };
  const nombreHoja = (n, usados) => { let b = String(n).replace(/[\[\]:*?\/\\]/g, ' ').trim().slice(0, 31) || 'Hoja', x = b, i = 2; while (usados.has(x.toLowerCase())) x = b.slice(0, 28) + ' ' + i++; usados.add(x.toLowerCase()); return x; };
  // celda: texto, número, { d: 'aaaa-mm-dd' } (fecha) o vacío
  function hojaXML(filas) {
    const anchos = [];
    filas.forEach((f) => f.forEach((v, i) => { const t = v && typeof v === 'object' ? (v.d ? 'dd-mm-aaaa' : '') : String(v == null ? '' : v); const l = Math.min(60, Math.max(...String(t).split('\n').map((x) => x.length), 0)); anchos[i] = Math.max(anchos[i] || 10, Math.min(60, l + 2)); }));
    const cols = anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
    const filasXML = filas.map((f, r) => `<row r="${r + 1}"${r === 0 ? ' ht="32" customHeight="1"' : ''}>${f.map((v, i) => {
      const ref = col(i) + (r + 1);
      if (v == null || v === '') return '';
      if (r === 0) return `<c r="${ref}" s="1" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
      if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
      if (typeof v === 'object' && v.d) { const n = serie(v.d); return n == null ? '' : `<c r="${ref}" s="2"><v>${n}</v></c>`; }
      const t = String(v); return `<c r="${ref}"${t.length > 40 ? ' s="3"' : ''} t="inlineStr"><is><t xml:space="preserve">${xml(t)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const nc = Math.max(1, ...filas.map((f) => f.length)), ref = `A1:${col(nc - 1)}${Math.max(1, filas.length)}`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${filasXML}</sheetData>${filas.length > 1 ? `<autoFilter ref="${ref}"/>` : ''}</worksheet>`;
  }
  const ESTILOS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd\\-mm\\-yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1B4D2E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  // hojas: [{ nombre, filas: [[encabezados], [fila]...] }]  → Blob .xlsx
  K.xlsx = function (hojas) {
    const usados = new Set(), hs = hojas.map((h) => ({ nombre: nombreHoja(h.nombre, usados), filas: h.filas }));
    const A = (nombre, txt) => ({ nombre, datos: enc.encode(txt) });
    const cab = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const arch = [
      A('[Content_Types].xml', `${cab}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${hs.map((h, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
      A('_rels/.rels', `${cab}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
      A('xl/workbook.xml', `${cab}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${hs.map((h, i) => `<sheet name="${xml(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`),
      A('xl/_rels/workbook.xml.rels', `${cab}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hs.map((h, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${hs.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
      A('xl/styles.xml', ESTILOS)
    ].concat(hs.map((h, i) => A(`xl/worksheets/sheet${i + 1}.xml`, hojaXML(h.filas))));
    return zip(arch);
  };
  K.descargarBlob = (blob, nombre) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  /* ---------- Los datos de todos los jugadores ---------- */
  // inf: vista con jugadores, casos, atenciones, eventos, asistencias y partidos; per: período del resumen; det: período de las hojas de detalle (o todo el historial)
  K.excelHojas = function (inf, per, det, info) {
    const D = (iso) => (iso ? { d: iso } : '');
    const nj = new Map(inf.jugadores.map((j) => [j.id, j]));
    const jn = (id) => (nj.get(id) || {}).nombre || '';
    const jc = (id) => (nj.get(id) || {}).categoria || '';
    const orden = (a, b) => String(a[0] && a[0].d || '').localeCompare(String(b[0] && b[0].d || '')) || String(a[1]).localeCompare(String(b[1]), 'es');
    const en = (f) => K.enPeriodo(f, det);
    const casoTit = (id) => { const c = id && inf.casos.find((x) => x.id === id); return c ? c.titulo : ''; };
    const jugs = inf.jugadores.slice().sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
    const infA = Object.assign({}, inf, { asistencias: (inf.asistencias || []).filter((a) => nj.has(a.jugadorId)) });

    // 1) resumen por jugador (del período elegido)
    const resumen = [['Jugador', 'Categoría', 'Nacimiento', 'Posición', 'Pierna dominante', 'Lesiones', 'Molestias', 'Días de baja por lesión', 'Días sin entrenar por molestias', 'Disponibilidad (%)', 'Atenciones', 'Intervenciones', 'Controles médicos', 'Exámenes', 'Procedimientos', 'Medicamentos entregados', 'Sesiones de kinesiología asistidas', 'Sesiones de kinesiología esperadas', 'Asistencia a kinesiología (%)', 'Partidos jugados', 'Minutos jugados']];
    jugs.forEach((j) => {
      const c = K.contar(infA, per, j.id).porFuente, b = K.bajaJugador(infA, per, j), a = K.asistenciaKine(infA, j.id, per), s = K.statsJugador(infA, per, j);
      const nac = /^\d{4}$/.test(String(j.nacimiento || '')) ? Number(j.nacimiento) : /^\d{4}-\d{2}-\d{2}$/.test(String(j.nacimiento || '')) ? D(j.nacimiento) : j.nacimiento || '';
      resumen.push([j.nombre, j.categoria || '', nac, j.posicion || '', j.pierna || '', c.lesiones, c.molestias, b.dias, b.sinEntrenar, b.pct, c.atenciones, c.intervenciones, c.controles, c.examenes, c.procedimientos, c.medicamentos, a.si, a.esp, a.pct == null ? '' : a.pct, s.partidos, s.minutos]);
    });

    // 2) lesiones y molestias
    const FIJAS = ['Gravedad', 'Zona', 'Ocurrió en', 'Contexto', 'Terreno', 'Inicio', 'Alta', 'Alta kinésica', 'Duración', 'Días de baja', 'Limita entrenamiento'];
    const les = inf.casos.filter((c) => nj.has(c.jugadorId) && en(c.inicio)).map((c) => {
      const ent = K.bit.entCaso(c), clin = ent.det.filter(([l]) => !FIJAS.includes(l)).map(([l, v]) => `${l}: ${v}`).join(' | ');
      const dias = c.tipo === 'lesion' && c.inicio ? K.diasBajaCaso(c, { desde: c.inicio, hasta: '2100-01-01' }) : '';
      return [D(c.inicio), jn(c.jugadorId), jc(c.jugadorId), c.conmocion === true ? 'Conmoción' : c.tipo === 'lesion' ? 'Lesión' : 'Molestia', c.titulo || '', c.lado || '', (c.zonas || []).map(K.nombreZona).join(', '), K.GRAVEDADES[K.gravClave(c.gravedad)], c.mecanismo ? K.ocurrioTxt(c) : '', c.contexto || '', c.terreno || '', D(c.alta), K.duracionCaso(c), dias, K.limitaTxt(c) || '', c.recidiva === true ? 'Sí' : '', clin, c.notas || ''];
    }).sort(orden);
    les.unshift(['Inicio', 'Jugador', 'Categoría', 'Tipo', 'Lesión o molestia', 'Lado', 'Zonas', 'Gravedad', 'Ocurrió en', 'Contexto', 'Terreno', 'Alta kinésica', 'Duración', 'Días de baja', 'Limita entrenamiento', 'Recidiva', 'Datos clínicos', 'Notas']);

    // 3) atenciones
    const ate = inf.atenciones.filter((a) => nj.has(a.jugadorId) && en(a.fecha)).map((a) => {
      const tr = Object.keys(a.trat || {}).filter((id) => a.trat[id] > 0), nom = (id) => (K.trat(inf, id) || { nombre: id }).nombre;
      const nInt = tr.reduce((s, id) => s + ((K.trat(inf, id) || {}).intervencion ? Number(a.trat[id]) : 0), 0);
      return [D(a.fecha), jn(a.jugadorId), jc(a.jugadorId), K.nombreClase(a.clase), K.nombreOrigen(a.origen), K.nombreTemporada(a.temporada), tr.map((id) => `${nom(id)} ×${a.trat[id]}`).join(', '), nInt, (a.motSeguro || []).map((k) => (K.MOTIVOS_SEGURO.find((m) => m[0] === k) || [0, k])[1]).join(', '), casoTit(a.casoId), a.notas || ''];
    }).sort(orden);
    ate.unshift(['Fecha', 'Jugador', 'Categoría', 'Tipo de atención', 'Origen', 'Período de la temporada', 'Intervenciones', 'N.º de intervenciones', 'Motivo de la derivación al seguro', 'Lesión o molestia asociada', 'Notas']);

    // 4) controles, exámenes, procedimientos y cirugías
    const ctl = inf.eventos.filter((x) => ['control', 'examen', 'procedimiento', 'cirugia'].includes(x.tipo) && nj.has(x.jugadorId) && en(x.fecha)).map((x) => [D(x.fecha), jn(x.jugadorId), jc(x.jugadorId), (K.EV[x.tipo] || { t: x.tipo }).t, x.tipo === 'control' && K.ctlEtiqueta ? K.ctlEtiqueta(x.nombre) : x.nombre || '', x.tipo === 'cirugia' ? '' : Number(x.cantidad) || 1, x.resultado || '', K.evRealizado(x) ? 'Realizado' : 'Programado', casoTit(x.casoId), x.notas || '']).sort(orden);
    ctl.unshift(['Fecha', 'Jugador', 'Categoría', 'Tipo', 'Detalle', 'Cantidad', 'Resultado', 'Estado', 'Lesión o molestia asociada', 'Notas']);

    // 5) medicamentos
    const med = inf.eventos.filter((x) => x.tipo === 'medicamento' && nj.has(x.jugadorId) && en(x.fecha)).map((x) => [D(x.fecha), jn(x.jugadorId), jc(x.jugadorId), x.nombre || '', Number(x.cantidad) || 1, casoTit(x.casoId), x.notas || '']).sort(orden);
    med.unshift(['Fecha', 'Jugador', 'Categoría', 'Medicamento', 'Unidades', 'Lesión o molestia asociada', 'Notas']);

    // 6) asistencia a kinesiología (día por día)
    const asi = infA.asistencias.filter((a) => en(a.fecha)).map((a) => [D(a.fecha), jn(a.jugadorId), jc(a.jugadorId), a.v === 'si' ? 'Asistió' : 'No asistió', a.v === 'si' ? (a.t === 'RD' ? 'RD · ' + (a.sub === 'KPF' ? 'K+PF' : a.sub === 'KPA' ? 'K+PA' : 'K') : a.t || '') : '', a.v === 'no' ? (K.MOTIVOS_NO_CORTO[a.no || 'noasiste'] || 'No asiste') : '']).sort(orden);
    asi.unshift(['Fecha', 'Jugador', 'Categoría', 'Asistencia', 'Tipo de sesión', 'Motivo de la inasistencia']);

    const inf2 = [['Dato', 'Valor'], ['Informe', info.nombre], ['Período del resumen por jugador', info.periodo], ['Período de las hojas de detalle', info.detalle], ['Jugadores', jugs.length], ['Descargado el', D(K.hoy())], ['Versión de la app', K.version], ['Nota', 'Las fechas son fechas de Excel (se ven dd-mm-aaaa y se pueden ordenar y filtrar). Usa los filtros de cada hoja para seleccionar jugadores o fechas.']];
    return [{ nombre: 'Resumen por jugador', filas: resumen }, { nombre: 'Lesiones y molestias', filas: les }, { nombre: 'Atenciones', filas: ate }, { nombre: 'Controles y exámenes', filas: ctl }, { nombre: 'Medicamentos', filas: med }, { nombre: 'Asistencia a kinesiología', filas: asi }, { nombre: 'Información', filas: inf2 }];
  };

  Object.assign(K.acciones, {
    bitXlsx() {
      const f = K.bit.estado(), inf = K.bit.vista(f), per = K.resolverPeriodo(K.state.periodo);
      if (!inf.jugadores.length) { K.aviso('No hay jugadores para exportar', true); return; }
      const det = f.periodo === 'periodo' ? per : { desde: '0000-01-01', hasta: '9999-12-31' };
      const hojas = K.excelHojas(inf, per, det, { nombre: inf.nombre, periodo: per.completo, detalle: f.periodo === 'periodo' ? per.completo : 'Todo el historial' });
      K.descargarBlob(K.xlsx(hojas), `Datos jugadores - ${String(inf.nombre).replace(/[^\w-]+/g, '-')} - ${K.hoy()}.xlsx`);
      K.aviso('Excel descargado con las hojas: resumen, lesiones, atenciones, controles, medicamentos y asistencia a kinesiología');
    }
  });
})();

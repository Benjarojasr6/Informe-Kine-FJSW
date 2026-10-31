/* Estado, almacenamiento en el dispositivo (IndexedDB) y valores por defecto. */
(function () {
  const K = (window.K = window.K || {});
  K.version = '1.5.0';

  K.uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  K.pad = (n) => String(n).padStart(2, '0');
  K.hoy = () => {
    const d = new Date();
    return d.getFullYear() + '-' + K.pad(d.getMonth() + 1) + '-' + K.pad(d.getDate());
  };
  K.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  K.fechaCorta = (iso) => {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('-');
    return K.esc(`${d}-${m}-${y}`);
  };

  /* ---------- Catálogos por defecto ---------- */
  K.TRATAMIENTOS_BASE = [
    { id: 'ejercicio', nombre: 'Ejercicio terapéutico', icono: 'img:ejercicio', intervencion: true },
    { id: 'hielo', nombre: 'Inmersión en hielo', icono: 'svg:hielo', intervencion: true },
    { id: 'termo', nombre: 'Termoterapia', icono: 'img:termoterapia', intervencion: true },
    { id: 'vendaje', nombre: 'Vendajes', icono: 'img:vendaje', intervencion: true },
    { id: 'crio', nombre: 'Crioterapia', icono: 'img:crioterapia', intervencion: true },
    { id: 'heridas', nombre: 'Limpieza de heridas', icono: 'svg:heridas', intervencion: true },
    { id: 'electro', nombre: 'Electroterapia', icono: 'svg:electro', intervencion: true },
    { id: 'preso', nombre: 'Presoterapia', icono: 'img:presoterapia', intervencion: true },
    { id: 'puncion', nombre: 'Punción seca', icono: 'img:puncion', intervencion: true },
    { id: 'masaje', nombre: 'Masajes', icono: 'img:masaje', intervencion: true },
    { id: 'seguro', nombre: 'Derivaciones al seguro', icono: 'img:mok', intervencion: false },
    { id: 'carga', nombre: 'Manejo de carga', icono: 'svg:balanza', intervencion: true },
    { id: 'farmaco', nombre: 'Farmacología', icono: 'svg:medicamento', intervencion: true },
    { id: 'deriv', nombre: 'Derivación externa', icono: 'svg:estetoscopio', intervencion: false },
    { id: 'sangrado', nombre: 'Manejo de sangrado', icono: 'svg:gota', intervencion: true },
    { id: 'evalcancha', nombre: 'Evaluación en cancha', icono: 'svg:atenciones', intervencion: true },
    { id: 'ortopedia', nombre: 'Ortopedia', icono: 'svg:muleta', intervencion: true },
    { id: 'inmov', nombre: 'Inmovilización', icono: 'svg:hueso', intervencion: true }
  ];
  K.TRAT_NUEVOS = ['carga', 'farmaco', 'deriv', 'sangrado', 'ortopedia', 'inmov', 'evalcancha'];
  K.INDICADORES_GENERALES = [
    { id: 'i-lesiones', nombre: 'Total de lesiones', fuente: 'lesiones', icono: 'svg:lesion' },
    { id: 'i-molestias', nombre: 'Total de molestias', fuente: 'molestias', icono: 'svg:molestia' },
    { id: 'i-atenciones', nombre: 'Total de atenciones', fuente: 'atenciones', icono: 'img:atenciones' },
    { id: 'i-intervenciones', nombre: 'Total de intervenciones', fuente: 'intervenciones', icono: 'svg:intervencion' },
    { id: 'i-controles', nombre: 'Total de controles médicos', fuente: 'controles', icono: 'svg:control' },
    { id: 'i-examenes', nombre: 'Total de exámenes', fuente: 'examenes', icono: 'svg:examen' },
    { id: 'i-medicamentos', nombre: 'Total de medicamentos', fuente: 'medicamentos', icono: 'svg:medicamento' },
    { id: 'i-cirugias', nombre: 'Total de cirugías', fuente: 'cirugias', icono: 'svg:cirugia' }
  ];
  K.STAFF_BASE = [
    { cargo: 'Técnico', personas: ['Sebastián Méndez', 'Domingo Sorace'] },
    { cargo: 'Preparador físico', personas: ['Carlos Márquez'] },
    { cargo: 'Preparador de arqueros', personas: ['Fernando Guerrero', 'Benjamín Aguilera'] },
    { cargo: 'Utilero', personas: ['Manuel Munizaga'] },
    { cargo: 'Kinesiólogo', personas: ['Benjamín Rojas', 'Nicolás Aravena', 'Fernando'] }
  ];
  // Calendario real del semestre (Sub 15-16): [rival, archivo del escudo, local]
  K.CALENDARIO_BASE = [
    ['Palestino', 'palestino', false], ['Audax', 'audax', true], ['Everton', 'everton', false],
    ['Coquimbo', 'coquimbo', true], ['Iquique', 'iquique', false], ['U. de Chile', 'u-de-chile', true],
    ['Temuco', 'temuco', true], ['Cobreloa', 'cobreloa', true], ["O'Higgins", 'ohiggins', true],
    ['Colo-Colo', 'colo-colo', false], ['Unión Española', 'union-espanola', true],
    ['U. de Concepción', 'u-de-concepcion', false], ['Recoleta', 'recoleta', false],
    ['U. Católica', 'u-catolica', true], ['Huachipato', 'huachipato', true]
  ];
  K.GRAVEDADES = { minima: 'Mínima', leve: 'Leve', moderada: 'Moderada', grave: 'Grave', pordefinir: 'Por definir' };
  // Gravedad según días fuera: mínima 1-3 · leve 4-7 · moderada 8-28 · grave más de 28.
  K.GRAV_DIAS = { minima: '1-3 días fuera', leve: '4-7 días fuera', moderada: '8-28 días fuera', grave: 'más de 28 días fuera', pordefinir: 'aún sin definir' };
  K.GRAV_ORDEN = ['minima', 'leve', 'moderada', 'grave', 'pordefinir'];
  K.COLORES_GRAV = { minima: '#8fd3a8', leve: '#3fbf6a', moderada: '#f5b400', grave: '#e8353d', pordefinir: '#9aa4a9' };
  K.gravClave = (g) => (K.GRAVEDADES[g] ? g : 'leve');
  K.gravRotulo = (g, dias) => { g = K.gravClave(g); return dias ? `${K.GRAVEDADES[g]} (${K.GRAV_DIAS[g]})` : K.GRAVEDADES[g]; };
  // Gravedad sugerida a partir de los días fuera.
  K.gravPorDias = (n) => (n >= 29 ? 'grave' : n >= 8 ? 'moderada' : n >= 4 ? 'leve' : n >= 1 ? 'minima' : 'pordefinir');

  /* ---------- Fábrica de informes ---------- */
  K.nuevoInforme = function (o) {
    o = o || {};
    const anio = o.anio || new Date().getFullYear();
    const inf = {
      id: K.uid(),
      nombre: o.nombre || 'Sub 15-16',
      categorias: o.categorias || o.nombre || 'Sub 15-16',
      titulo: 'Reporte área Kinésica',
      anio,
      partidos: [],
      staff: [],
      jugadores: [],
      camposExtra: [],
      casos: [],
      atenciones: [],
      eventos: [],
      manuales: [],
      asistencias: [],
      seguros: [],
      segEventos: [],
      tratamientos: K.TRATAMIENTOS_BASE.map((t) => Object.assign({}, t)),
      indicadores: []
    };
    K.TRATAMIENTOS_BASE.forEach(() => {});
    inf.indicadores = K.INDICADORES_GENERALES.map((i) => Object.assign({ grupo: 'general', visible: true }, i)).concat(
      K.TRATAMIENTOS_BASE.map((t) => ({
        id: 'i-t-' + t.id, nombre: t.nombre, fuente: 'trat:' + t.id, icono: t.icono, grupo: 'tratamiento', visible: true
      }))
    );
    if (o.conCalendario) {
      inf.partidos = K.CALENDARIO_BASE.map((p) => ({
        id: K.uid(), rival: p[0], logo: p[1], local: p[2], fecha: '', jugado: true, duracion: 90, minutos: {}, notas: ''
      }));
    }
    if (o.conStaff) {
      inf.staff = K.STAFF_BASE.map((s) => ({
        id: K.uid(), cargo: s.cargo, personas: s.personas.map((n) => ({ nombre: n, ocasional: false }))
      }));
    }
    return inf;
  };

  K.estadoInicial = function () {
    const inf = K.nuevoInforme({ nombre: 'Sub 15-16', conStaff: true });
    return {
      v: 1,
      informes: [inf],
      activo: inf.id,
      periodo: { tipo: 'anual', anio: new Date().getFullYear(), desde: '', hasta: '' },
      ultimoRespaldo: null,
      cambios: 0
    };
  };

  /* ---------- Almacenamiento (IndexedDB con respaldo en localStorage) ---------- */
  const DB = 'informe-kine-sw', ST = 'kv';
  function abrir() {
    return new Promise((ok, mal) => {
      if (!window.indexedDB) return mal(new Error('sin indexedDB'));
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(ST);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
  }
  K.cargar = async function () {
    let a = null, b = null;
    try {
      const db = await abrir();
      a = await new Promise((ok, mal) => {
        const t = db.transaction(ST).objectStore(ST).get('estado');
        t.onsuccess = () => ok(t.result);
        t.onerror = () => mal(t.error);
      }) || null;
    } catch (e) { /* intenta localStorage */ }
    try {
      const s = localStorage.getItem('kine-sw-estado');
      if (s) b = JSON.parse(s);
    } catch (e) { /* nada */ }
    // Si IndexedDB falló alguna vez y se guardó en localStorage, vale la copia más reciente.
    if (a && b) return (b._guardado || 0) > (a._guardado || 0) ? b : a;
    return a || b;
  };
  let tmr = null;
  K.guardarYa = async function () {
    const copia = K.state;
    copia._guardado = Date.now();
    try {
      const db = await abrir();
      await new Promise((ok, mal) => {
        const t = db.transaction(ST, 'readwrite');
        t.objectStore(ST).put(copia, 'estado');
        t.oncomplete = ok; t.onerror = () => mal(t.error);
      });
    } catch (e) {
      try { localStorage.setItem('kine-sw-estado', JSON.stringify(copia)); } catch (e2) { K.aviso && K.aviso('No se pudo guardar en este dispositivo', true); }
    }
  };
  K.guardar = function () {
    K.state.cambios = (K.state.cambios || 0) + 1;
    clearTimeout(tmr);
    tmr = setTimeout(K.guardarYa, 250);
  };

  /* ---------- Accesos rápidos ---------- */
  K.inf = () => K.state.informes.find((i) => i.id === K.state.activo) || K.state.informes[0];
  K.jugador = (inf, id) => inf.jugadores.find((j) => j.id === id);
  K.trat = (inf, id) => inf.tratamientos.find((t) => t.id === id);

  /* ---------- Respaldo ---------- */
  // Resumen de lo que contiene un estado (o un informe suelto): sirve para el archivo de respaldo y para mostrar qué se va a importar.
  K.resumenDatos = function (informes) {
    const r = { informes: informes.length, jugadores: 0, casos: 0, atenciones: 0, partidos: 0, seguros: 0, segEventos: 0 };
    informes.forEach((inf) => { ['jugadores', 'casos', 'atenciones', 'partidos', 'seguros', 'segEventos'].forEach((k) => { r[k] += Array.isArray(inf && inf[k]) ? inf[k].length : 0; }); });
    return r;
  };
  // opts: { nombre: prefijo del archivo, copiaSeguridad: true = no cuenta como “último respaldo” }
  K.exportar = function (soloActivo, opts) {
    opts = opts || {};
    const infs = soloActivo ? [K.inf()] : K.state.informes;
    const meta = { app: K.version, fecha: new Date().toISOString(), resumen: K.resumenDatos(infs) };
    const data = soloActivo
      ? { tipo: 'informe', v: 1, meta, informe: K.inf() }
      : { tipo: 'todo', v: 1, meta, estado: K.state };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    const nombre = opts.nombre || (soloActivo ? 'informe-' + K.inf().nombre.replace(/[^\w-]+/g, '-') : 'respaldo-informes-kine');
    a.href = URL.createObjectURL(blob);
    a.download = `${nombre}-${K.hoy()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    if (opts.copiaSeguridad || soloActivo) return; // solo el respaldo completo cuenta como “último respaldo”
    K.state.ultimoRespaldo = K.hoy();
    K.state.cambios = -1; // K.guardar() suma 1: queda en 0
    K.guardar();
  };
  /* ---------- Validación y limpieza de lo que se importa (un archivo puede venir dañado o manipulado) ---------- */
  const ID_OK = (v) => typeof v === 'string' && /^[\w.-]{1,64}$/.test(v) && !/^\.+$/.test(v) && !/^__.*__$/.test(v) && !/^(constructor|prototype)$/.test(v); // Firestore no admite ids tipo __x__
  const FECHA_OK = /^\d{4}-\d{2}-\d{2}$/;
  const IMG_OK = (v) => typeof v === 'string' && (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v) || /^img\/[\w./-]+$/.test(v) || /^@m:[\w-]+$/.test(v));
  const ARR_ID = ['jugadores', 'partidos', 'casos', 'atenciones', 'eventos', 'asistencias', 'seguros', 'segEventos', 'staff', 'manuales', 'camposExtra', 'tratamientos', 'indicadores'];
  const REMAPEAR = ['jugadores', 'partidos', 'casos', 'atenciones', 'eventos', 'asistencias', 'seguros', 'segEventos'];
  const NUM_VERSION = (v) => String(v).split('.').map((x) => parseInt(x, 10) || 0);
  const masNueva = (x, y) => { const A = NUM_VERSION(x), B = NUM_VERSION(y); for (let i = 0; i < 3; i++) { if ((A[i] || 0) !== (B[i] || 0)) return (A[i] || 0) > (B[i] || 0); } return false; };

  K.sanearInforme = function (inf) {
    const malo = (m) => { throw new Error(m || 'El respaldo está dañado o tiene datos que la app no reconoce.'); };
    if (!inf || typeof inf !== 'object' || !ID_OK(inf.id)) malo();
    ARR_ID.forEach((k) => {
      if (inf[k] === undefined) return;
      if (!Array.isArray(inf[k])) malo();
      const vistos = new Set();
      inf[k].forEach((it) => {
        if (!it || typeof it !== 'object' || !ID_OK(it.id)) malo();
        if (vistos.has(it.id)) malo('El respaldo tiene registros repetidos (mismo identificador dos veces): está dañado y no se puede importar.');
        vistos.add(it.id);
        // lo que va dentro de formularios y atributos HTML: solo fechas y números con forma de fecha/número
        ['fecha', 'inicio', 'alta', 'desde', 'hasta', 'nacimiento', 'fechaNac', 'activacion'].forEach((f) => { if (it[f] != null && !(typeof it[f] === 'string' && /^[\d\-:T.Z+ ]{0,40}$/.test(it[f]))) it[f] = ''; });
        ['cantidad', 'semanas', 'duracion'].forEach((f) => { if (it[f] != null && it[f] !== '' && !Number.isFinite(Number(it[f]))) it[f] = ''; });
      });
    });
    // textos: si vienen con otro tipo (número, objeto, nulo) se convierten, para que ninguna pantalla se rompa
    const TEXTOS = ['nombre', 'categoria', 'posicion', 'titulo', 'rival', 'torneo', 'cargo', 'res', 'comentarios', 'nota', 'estadoNota', 'estado', 'contexto', 'fuente', 'icono', 'lado', 'origen', 'clase', 'tipo'];
    const arrObj = (v) => (Array.isArray(v) ? v : []);
    ARR_ID.forEach((k) => (inf[k] || []).forEach((it) => {
      TEXTOS.forEach((f) => { if (it[f] != null && typeof it[f] !== 'string') it[f] = typeof it[f] === 'number' ? String(it[f]) : ''; });
    }));
    (inf.jugadores || []).forEach((j) => { if (!j.nombre) j.nombre = 'Sin nombre'; if (j.tambien !== undefined) j.tambien = arrObj(j.tambien).filter((x) => typeof x === 'string' || typeof x === 'number'); if (j.extras !== undefined && (!j.extras || typeof j.extras !== 'object' || Array.isArray(j.extras))) j.extras = {}; });
    if (Array.isArray(inf.indicadores)) inf.indicadores = inf.indicadores.filter((i) => typeof i.fuente === 'string' && i.fuente); // un indicador sin su fuente de datos no se puede calcular
    (inf.casos || []).forEach((c) => { if (c.zonas !== undefined) c.zonas = arrObj(c.zonas).filter((x) => typeof x === 'string'); });
    (inf.staff || []).forEach((st) => { st.personas = arrObj(st.personas).filter((x) => x && typeof x === 'object').map((x) => Object.assign(x, { nombre: typeof x.nombre === 'string' ? x.nombre : '' })); });
    (inf.casos || []).forEach((c) => { if (c.gravedad && !K.GRAVEDADES[c.gravedad]) c.gravedad = 'pordefinir'; });
    (inf.jugadores || []).forEach((j) => { if (j.foto && !IMG_OK(j.foto)) j.foto = ''; });
    (inf.partidos || []).forEach((p) => {
      if (p.logo && !(IMG_OK(p.logo) || /^[\w-]+$/.test(p.logo))) p.logo = '';
      if (p.logoData && !IMG_OK(p.logoData)) p.logoData = '';
      if (p.jid !== undefined && !ID_OK(p.jid)) p.jid = p.id;
      if (p.minutos && typeof p.minutos !== 'object') p.minutos = {};
    });
    (inf.atenciones || []).forEach((a) => {
      if (a.trat && typeof a.trat === 'object') Object.keys(a.trat).forEach((k) => { if (!/^[\w-]+$/.test(k)) delete a.trat[k]; });
    });
    return inf;
  };
  K.sanearEstado = function (st) {
    if (typeof st.ultimoRespaldo !== 'string' || !FECHA_OK.test(st.ultimoRespaldo)) st.ultimoRespaldo = null;
    if (st.fuente && !(K.FUENTES || []).some((f) => f.id === st.fuente)) delete st.fuente;
    if (st.packIconos && !(K.PACKS || []).some((p) => p[0] === st.packIconos)) delete st.packIconos;
    // íconos propios: { estilo: [ { id, nombre, data } ] }; en <img> una imagen (incluso SVG) no puede ejecutar código
    if (st.iconosPropios && typeof st.iconosPropios === 'object' && !Array.isArray(st.iconosPropios)) {
      Object.keys(st.iconosPropios).forEach((k) => {
        const l = st.iconosPropios[k];
        st.iconosPropios[k] = Array.isArray(l) ? l.filter((x) => x && ID_OK(x.id) && typeof x.data === 'string' && /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+\/=]+$/.test(x.data)).map((x) => ({ id: x.id, nombre: String(x.nombre || ''), data: x.data })) : [];
      });
    } else if (st.iconosPropios !== undefined) delete st.iconosPropios;
    delete st.periodo; // el período que se está mirando es de cada dispositivo, no parte de los datos
    return st;
  };
  // Cada informe pertenece a un grupo de categorías (Sub 15-16 o Sub 18-20); solo puede haber uno de cada grupo.
  K.grupoDeInforme = function (inf) {
    const dig = ((inf.nombre + ' ' + (inf.categorias || '')).match(/\d+/g) || []).map(Number);
    return (K.GRUPOS || []).find((g) => g.id === inf.grupo) || (K.GRUPOS || []).find((g) => g.cats.every((c) => dig.includes(c))) || null;
  };
  // Da ids nuevos a todo lo que pueda chocar con lo que ya hay (jugadores, partidos, casos, atenciones, seguros…) y arregla las referencias.
  function renovarIds(inf) {
    const mapa = new Map();
    const nuevo = (v) => { if (typeof v === 'string' && !mapa.has(v)) mapa.set(v, K.uid() + mapa.size.toString(36)); };
    nuevo(inf.id);
    REMAPEAR.forEach((k) => (inf[k] || []).forEach((it) => nuevo(it.id)));
    (inf.partidos || []).forEach((p) => nuevo(p.jid));
    const rec = (v) => {
      if (typeof v === 'string') return mapa.has(v) ? mapa.get(v) : v;
      if (Array.isArray(v)) return v.map(rec);
      if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach((k) => { o[mapa.has(k) ? mapa.get(k) : k] = rec(v[k]); }); return o; }
      return v;
    };
    // los catálogos compartidos (tratamientos, indicadores) conservan sus ids
    const fijos = { tratamientos: inf.tratamientos, indicadores: inf.indicadores };
    const r = rec(Object.assign({}, inf, { tratamientos: undefined, indicadores: undefined }));
    r.tratamientos = fijos.tratamientos; r.indicadores = fijos.indicadores;
    return r;
  }

  // Lee y valida un archivo de respaldo SIN tocar nada. Devuelve { tipo, informes, resumen, app, fecha, avisos } o lanza un error con el motivo.
  K.revisarRespaldo = function (texto) {
    let d;
    try { d = JSON.parse(texto); } catch (x) { throw new Error('El archivo no es un respaldo de esta app (no se pudo leer).'); }
    let informes;
    if (d && d.tipo === 'todo' && d.estado && Array.isArray(d.estado.informes)) informes = d.estado.informes;
    else if (d && d.tipo === 'informe' && d.informe && typeof d.informe === 'object') informes = [d.informe];
    else throw new Error('El archivo no es un respaldo de esta app.');
    if (!informes.length) throw new Error('El respaldo no tiene ningún informe.');
    informes.forEach((inf) => {
      if (!inf || typeof inf !== 'object' || !inf.id || !Array.isArray(inf.jugadores)) throw new Error('El respaldo está dañado o incompleto (un informe no se puede leer).');
      K.sanearInforme(inf);
    });
    const avisos = [];
    const mio = d.meta && typeof d.meta.app === 'string' ? d.meta.app : '';
    const fecha = d.meta && typeof d.meta.fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d.meta.fecha) ? d.meta.fecha : '';
    let nueva = false;
    if (mio && masNueva(mio, K.version)) { nueva = true; avisos.push('Este respaldo viene de una versión más nueva de la app (' + mio + '). Actualiza la app antes de importarlo.'); }
    if (!d.meta) avisos.push('Es un respaldo de una versión anterior: se revisará y completará al importarlo.');
    return { tipo: d.tipo, datos: d, informes, resumen: K.resumenDatos(informes), app: mio, fecha, avisos, nueva };
  };
  // Devuelve { agregados: [nombres], omitidos: [nombres], reemplazados: [nombres] }. Lanza un error si no se puede.
  K.importar = function (texto, modo) {
    const rev = K.revisarRespaldo(texto), d = rev.datos;
    if (rev.nueva) throw new Error('Este respaldo es de una versión más nueva de la app. Actualiza la app antes de importarlo.');
    const res = { agregados: [], omitidos: [], reemplazados: [] };
    if (d.tipo === 'todo' && modo === 'reemplazar') {
      const ant = K.state;
      d.estado.informes.forEach((inf) => K.normalizar(inf));
      K.sanearEstado(d.estado);
      K.state = d.estado;
      K.state.periodo = ant.periodo;
      if (!K.state.informes.some((i) => i.id === K.state.activo)) K.state.activo = K.state.informes[0].id;
      ['packIconos', 'iconosPropios', 'fuente'].forEach((k) => { if (K.state[k] === undefined && ant[k] !== undefined) K.state[k] = ant[k]; });
      K.state.ultimoRespaldo = K.state.ultimoRespaldo || ant.ultimoRespaldo || null;
      K.state.informes.forEach((i) => res.reemplazados.push(i.nombre));
    } else {
      rev.informes.forEach((orig) => {
        const g = K.grupoDeInforme(orig), existente = g && K.buscarInformeGrupo(g);
        if (existente && d.tipo === 'informe' && modo === 'reemplazar') {
          // cambia el informe de esa categoría por el del archivo (mismo id, así la nube lo actualiza en su sitio)
          const inf = K.normalizar(orig); inf.id = existente.id; if (g) inf.grupo = g.id;
          K.state.informes[K.state.informes.indexOf(existente)] = inf;
          res.reemplazados.push(inf.nombre); return;
        }
        if (existente) { res.omitidos.push(orig.nombre); return; } // ya hay un informe de esa categoría: no se duplica
        const inf = K.normalizar(renovarIds(orig));
        if (g) inf.grupo = g.id;
        K.state.informes.push(inf); res.agregados.push(inf.nombre);
      });
      if (!res.agregados.length && !res.reemplazados.length) throw new Error('No se agregó nada: ya tienes un informe de esas categorías. Si quieres quedarte con lo del archivo, usa Reemplazar.');
    }
    K.ui.cat = null; K.ui.jugadorId = null; // se vuelve al inicio para elegir la categoría con el informe correcto
    K.guardar();
    return res;
  };
})();

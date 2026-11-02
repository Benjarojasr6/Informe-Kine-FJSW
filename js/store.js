/* Estado, almacenamiento en el dispositivo (IndexedDB) y valores por defecto. */
(function () {
  const K = (window.K = window.K || {});
  K.version = '1.6.3';

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

  /* ---------- Mayúsculas ----------
     K.mayus(s): primera letra en mayúscula (el resto queda igual; si empieza con número o símbolo no se toca, salvo “(” “¿” “¡” o comillas seguidos de una letra).
     K.nombrePropio(s): nombres de personas, mayúscula en cada palabra salvo partículas (de, del, la, las, los, y, van, von) que no abren el texto.
     Una palabra que ya trae alguna mayúscula (McDonald, DiCaprio, PÉREZ) no se toca. Respeta tildes, guiones y apóstrofes (Pérez-Castro, O'Higgins). */
  K.mayus = (s) => {
    if (typeof s !== 'string' || !s) return s;
    const m = /^(\s*[(¿¡"«“'‘\[]?)(\p{Ll})/u.exec(s);
    if (!m) return s;
    const up = m[2].toLocaleUpperCase('es');
    return up.length === 1 ? m[1] + up + s.slice(m[0].length) : s;
  };
  const PARTICULAS = ['de', 'del', 'la', 'las', 'los', 'y', 'van', 'von'];
  const capPalabra = (w) => w.replace(/(^|[-'’])(\p{Ll})/gu, (x, a, b) => a + b.toLocaleUpperCase('es'));
  K.nombrePropio = (s, enMedio) => {
    if (typeof s !== 'string' || !s) return s;
    let k = enMedio ? 1 : 0; // enMedio: el texto es un apellido que va después de otras palabras (el nombre completo lo arma como “Pérez de la Fuente”)
    return s.replace(/\S+/g, (w) => {
      const i = k++;
      if (/\p{Lu}/u.test(w)) return w;
      if (i > 0 && PARTICULAS.includes(w)) return w;
      return capPalabra(w);
    });
  };
  // Aplica las mayúsculas a los textos de registros y a los nombres de personas de un informe. Idempotente.
  K.mayusInforme = (inf) => {
    if (!inf || typeof inf !== 'object') return inf;
    const lista = (k) => (Array.isArray(inf[k]) ? inf[k].filter((x) => x && typeof x === 'object') : []);
    const campos = (o, ks, f) => ks.forEach((c) => { if (typeof o[c] === 'string') { const v = (f || K.mayus)(o[c]); if (v !== o[c]) o[c] = v; } });
    lista('casos').forEach((c) => campos(c, ['titulo', 'proxExamenTipo', 'proxProcTipo', 'proxHitoTxt']));
    lista('eventos').forEach((x) => campos(x, ['nombre']));
    lista('segEventos').forEach((x) => campos(x, ['detalle']));
    lista('seguros').forEach((x) => campos(x, ['diagnostico', 'clinica']));
    lista('camposExtra').forEach((x) => campos(x, ['titulo']));
    lista('documentos').forEach((x) => campos(x, ['titulo']));
    lista('partidos').forEach((p) => { campos(p, ['rival', 'torneo']); campos(p, ['realizadoPor'], K.nombrePropio); });
    lista('torneos').forEach((t) => { campos(t, ['nombre', 'sede', 'pais']); (Array.isArray(t.fases) ? t.fases : []).forEach((f) => { if (f && typeof f === 'object') campos(f, ['nombre']); }); });
    lista('jugadores').forEach((j) => {
      const u = (v) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
      const partes = () => ['nombres', 'apellido1', 'apellido2'].map((c) => u(j[c])).filter(Boolean).join(' ');
      const compuesto = !!partes() && typeof j.nombre === 'string' && u(j.nombre).toLowerCase() === partes().toLowerCase(); // el nombre completo es la unión de sus tres partes
      campos(j, ['nombres'], K.nombrePropio); campos(j, ['apellido1', 'apellido2'], (v) => K.nombrePropio(v, true));
      if (compuesto) { const v = partes(); if (v !== j.nombre) j.nombre = v; } else campos(j, ['nombre'], K.nombrePropio);
    });
    lista('staff').forEach((s) => (Array.isArray(s.personas) ? s.personas : []).forEach((p) => { if (p && typeof p === 'object') campos(p, ['nombre'], K.nombrePropio); }));
    campos(inf, ['firmante'], K.nombrePropio);
    if (inf.anios && typeof inf.anios === 'object') Object.keys(inf.anios).forEach((y) => { const a = inf.anios[y]; if (a && typeof a === 'object') { campos(a, ['firmante'], K.nombrePropio); (Array.isArray(a.staff) ? a.staff : []).forEach((s) => (Array.isArray(s && s.personas) ? s.personas : []).forEach((p) => { if (p && typeof p === 'object') campos(p, ['nombre'], K.nombrePropio); })); } });
    return inf;
  };
  K.mayusEstado = () => { if (K.state && Array.isArray(K.state.informes)) K.state.informes.forEach(K.mayusInforme); };

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

  /* ---------- Ficha clínica (v1.6): catálogos de los datos clínicos nuevos ---------- */
  K.TEJIDOS = [['muscular', 'Muscular'], ['tendon', 'Tendón'], ['ligamento', 'Ligamento'], ['oseo', 'Óseo'], ['articular', 'Articular'], ['nervioso', 'Nervioso'], ['piel', 'Piel'], ['otro', 'Otro']];
  K.CONTACTOS = [['contacto', 'Con contacto'], ['sin', 'Sin contacto']];
  K.GRUPOS_SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Desconocido'];
  K.TIPOS_DOC = ['Examen', 'Informe médico', 'Consentimiento', 'Otro'];
  // Torneos (v1.6, fase 5): entidad propia por informe. Tipos y fases por defecto (los ids de las fases base son fijos y legibles).
  K.TORNEO_TIPOS = ['Internacional', 'Nacional', 'Amistoso', 'Gira'];
  K.FASES_BASE = [['f-grupos', 'Fase de grupos'], ['f-octavos', 'Octavos'], ['f-cuartos', 'Cuartos'], ['f-semi', 'Semifinal'], ['f-tercer', 'Tercer lugar'], ['f-final', 'Final']];
  K.COBERTURAS_SEGURO = ['Club', 'Viaje'];

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
      anioTexto: anio,
      tempIniciada: anio, // última temporada iniciada con el asistente (aparte de dónde viven los textos: escribir en el año nuevo no la da por iniciada)
      anios: {},
      conclusiones: '',
      objetivos: '',
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
      torneos: [],      // torneos como ficha propia (v1.6): { id, nombre, tipo, pais, sede, desde, hasta, cats, fases, viaje, logistica, inscritos, notas }
      antecedentes: [], // privado: antecedentes médicos de cada jugador (uno por jugador)
      documentos: [],   // privado: fotos de documentos adjuntos
      plantillas: [],   // plantillas de intervenciones del uso diario: [{ id, nombre, trat }] (pocas; viajan en el documento “meta”)
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
    K.mayusEstado(); // primera letra en mayúscula en los textos de registros y nombres de personas
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
    const r = { informes: informes.length, jugadores: 0, casos: 0, atenciones: 0, partidos: 0, seguros: 0, segEventos: 0, torneos: 0, antecedentes: 0, documentos: 0 };
    informes.forEach((inf) => { ['jugadores', 'casos', 'atenciones', 'partidos', 'seguros', 'segEventos', 'torneos', 'antecedentes', 'documentos'].forEach((k) => { r[k] += Array.isArray(inf && inf[k]) ? inf[k].length : 0; }); });
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
  const ARR_ID = ['jugadores', 'partidos', 'casos', 'atenciones', 'eventos', 'asistencias', 'seguros', 'segEventos', 'torneos', 'antecedentes', 'documentos', 'staff', 'manuales', 'camposExtra', 'tratamientos', 'indicadores'];
  const REMAPEAR = ['jugadores', 'partidos', 'casos', 'atenciones', 'eventos', 'asistencias', 'seguros', 'segEventos', 'torneos', 'antecedentes', 'documentos'];
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
        ['fecha', 'inicio', 'alta', 'desde', 'hasta', 'nacimiento', 'fechaNac', 'activacion', 'altaMedica', 'retornoEntreno', 'retornoPartido', 'reintegroDesde'].forEach((f) => { if (it[f] != null && !(typeof it[f] === 'string' && /^[\d\-:T.Z+ ]{0,40}$/.test(it[f]))) it[f] = ''; });
        ['cantidad', 'semanas', 'duracion'].forEach((f) => { if (it[f] != null && it[f] !== '' && !Number.isFinite(Number(it[f]))) it[f] = ''; });
      });
    });
    // textos: si vienen con otro tipo (número, objeto, nulo) se convierten, para que ninguna pantalla se rompa
    const TEXTOS = ['nombre', 'categoria', 'posicion', 'titulo', 'rival', 'torneo', 'cargo', 'res', 'comentarios', 'nota', 'estadoNota', 'estado', 'contexto', 'fuente', 'icono', 'lado', 'origen', 'clase', 'tipo', 'motivoSalida', 'nombres', 'apellido1', 'apellido2', 'tejido', 'contacto', 'resultado', 'alergias', 'enfermedades', 'medicacionHabitual', 'lesionesPrevias', 'cirugiasPrevias', 'grupoSanguineo', 'apoderado', 'telefonoApoderado', 'contactoEmergencia', 'telefonoEmergencia'];
    const arrObj = (v) => (Array.isArray(v) ? v : []);
    ARR_ID.forEach((k) => (inf[k] || []).forEach((it) => {
      TEXTOS.forEach((f) => { if (it[f] != null && typeof it[f] !== 'string') it[f] = typeof it[f] === 'number' ? String(it[f]) : ''; });
    }));
    (inf.jugadores || []).forEach((j) => { if (!j.nombre) j.nombre = 'Sin nombre'; if (j.tambien !== undefined) j.tambien = arrObj(j.tambien).filter((x) => typeof x === 'string' || typeof x === 'number'); if (j.extras !== undefined && (!j.extras || typeof j.extras !== 'object' || Array.isArray(j.extras))) j.extras = {}; });
    // --- temporadas, archivo y categoría en el tiempo (todo opcional; lo inválido se descarta o se corrige) ---
    const ANIO_OK = (v) => Number.isInteger(v) && v >= 1990 && v <= 2200;
    const ISO_OK = (v) => typeof v === 'string' && FECHA_OK.test(v) && Number(v.slice(0, 4)) >= 1900;
    const str = (v) => (typeof v === 'string' ? v : v == null || typeof v === 'object' ? '' : String(v));
    const plano = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
    ['conclusiones', 'objetivos', 'conclusionesTodas', 'objetivosTodas', 'firmante'].forEach((c) => { if (inf[c] !== undefined && typeof inf[c] !== 'string') inf[c] = str(inf[c]); });
    if (inf.atencionesPartidos !== undefined && typeof inf.atencionesPartidos !== 'boolean') delete inf.atencionesPartidos;
    ['anioTexto', 'tempIniciada'].forEach((c) => { if (inf[c] !== undefined) { inf[c] = Number(inf[c]); if (!ANIO_OK(inf[c])) delete inf[c]; } });
    const limpiarStaff = (st) => arrObj(st).filter((x) => x && typeof x === 'object' && ID_OK(x.id)).map((x) => ({ id: x.id, cargo: str(x.cargo), personas: arrObj(x.personas).filter((p) => p && typeof p === 'object').map((p) => ({ nombre: str(p.nombre), ocasional: p.ocasional === true })) }));
    if (inf.anios !== undefined) {
      const out = {};
      if (plano(inf.anios)) Object.keys(inf.anios).forEach((y) => {
        const a = inf.anios[y]; if (!/^\d{4}$/.test(y) || !plano(a)) return;
        const o = {};
        ['conclusiones', 'objetivos', 'conclusionesTodas', 'objetivosTodas', 'firmante'].forEach((c) => { if (a[c] !== undefined) o[c] = str(a[c]); });
        if (a.staff !== undefined) o.staff = limpiarStaff(a.staff);
        if (typeof a.atencionesPartidos === 'boolean') o.atencionesPartidos = a.atencionesPartidos;
        out[y] = o;
      });
      inf.anios = out;
    }
    const ESTADOS_OK = ['inscrito', 'liberado', 'cedido', 'promovido', 'retirado'], CATS_OK = [15, 16, 18, 20];
    (inf.jugadores || []).forEach((j) => {
      ['nombres', 'apellido1', 'apellido2', 'motivoSalida'].forEach((c) => { if (j[c] !== undefined && typeof j[c] !== 'string') j[c] = str(j[c]); });
      if (j.estado !== undefined && !ESTADOS_OK.includes(j.estado)) j.estado = 'inscrito';
      ['ingreso', 'salida'].forEach((c) => { if (j[c] !== undefined && !ISO_OK(j[c])) delete j[c]; });
      if (j.catHist !== undefined) {
        j.catHist = arrObj(j.catHist).filter((x) => x && typeof x === 'object' && CATS_OK.includes(Number(x.cat)) && (x.desde === '' || ISO_OK(x.desde))).slice(0, 40)
          .map((x) => ({ cat: Number(x.cat), desde: x.desde })).sort((a, b) => (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0));
        if (!j.catHist.length) delete j.catHist;
      }
      if (j.huecos !== undefined) { j.huecos = arrObj(j.huecos).filter((x) => x && typeof x === 'object' && ISO_OK(x.desde) && ISO_OK(x.hasta) && x.desde <= x.hasta).slice(0, 40).map((x) => ({ desde: x.desde, hasta: x.hasta })); if (!j.huecos.length) delete j.huecos; }
      if (j.anioTexto !== undefined) { j.anioTexto = Number(j.anioTexto); if (!ANIO_OK(j.anioTexto)) delete j.anioTexto; }
      if (j.anios !== undefined) {
        const out = {};
        if (plano(j.anios)) Object.keys(j.anios).forEach((y) => { const a = j.anios[y]; if (/^\d{4}$/.test(y) && plano(a)) out[y] = { comentarios: str(a.comentarios), extras: plano(a.extras) ? a.extras : {} }; });
        j.anios = out;
      }
    });
    // --- ficha clínica: campos nuevos de lesiones, exámenes, atenciones; antecedentes y documentos (todo opcional) ---
    const NUM_OK = (v, a, b) => v !== '' && v !== null && typeof v !== 'boolean' && Number.isFinite(Number(v)) && Number(v) >= a && Number(v) <= b;
    (inf.casos || []).forEach((c) => {
      if (c.tejido !== undefined && !K.TEJIDOS.some((x) => x[0] === c.tejido)) c.tejido = '';
      if (c.contacto !== undefined && !K.CONTACTOS.some((x) => x[0] === c.contacto)) c.contacto = '';
      if (c.eva !== undefined) { if (NUM_OK(c.eva, 0, 10)) c.eva = Math.round(Number(c.eva)); else delete c.eva; }
      if (c.recidiva !== undefined && typeof c.recidiva !== 'boolean') c.recidiva = c.recidiva === 'si' || c.recidiva === 1;
      delete c.tests; delete c.criterios; // v1.6.1: los tests y criterios de retorno ya no existen
    });
    (inf.atenciones || []).forEach((a) => { delete a.soap; }); // v1.6.1: la evolución (SOAP) ya no existe
    // --- torneos (v1.6, fase 5): entidad propia; partidos, atenciones y lesiones pueden apuntar a ella con torneoId (todo opcional) ---
    {
      const txt = (v, n) => str(v).replace(/\s+/g, ' ').trim().slice(0, n);
      (inf.torneos || []).forEach((t) => {
        t.nombre = txt(t.nombre, 120) || 'Torneo';
        if (!K.TORNEO_TIPOS.includes(t.tipo)) t.tipo = 'Nacional';
        t.pais = txt(t.pais, 80); t.sede = txt(t.sede, 120);
        ['desde', 'hasta'].forEach((c) => { if (!ISO_OK(t[c])) t[c] = ''; });
        if (t.desde && t.hasta && t.desde > t.hasta) t.hasta = t.desde;
        t.cats = Array.from(new Set(arrObj(t.cats).map(Number).filter((c) => CATS_OK.includes(c)))).sort((a, b) => a - b);
        const vf = new Set();
        t.fases = arrObj(t.fases).filter((x) => x && typeof x === 'object' && !Array.isArray(x)).slice(0, 30).map((x) => {
          const id = ID_OK(x.id) && !vf.has(x.id) ? x.id : 'f' + K.uid() + vf.size; vf.add(id);
          return { id, nombre: txt(x.nombre, 60) };
        }).filter((x) => x.nombre);
        t.viaje = t.viaje === true;
        const L = plano(t.logistica) ? t.logistica : {};
        t.logistica = {
          altitud: NUM_OK(L.altitud, 0, 9000) ? Math.round(Number(L.altitud)) : '', huso: NUM_OK(L.huso, -14, 14) ? Number(L.huso) : '',
          clima: txt(L.clima, 200), vuelos: txt(L.vuelos, 600), hotel: txt(L.hotel, 300), notas: str(L.notas).slice(0, 2000)
        };
        const vi = new Set();
        t.inscritos = arrObj(t.inscritos).filter((x) => x && typeof x === 'object' && !Array.isArray(x) && ID_OK(x.id) && !vi.has(x.id) && vi.add(x.id)).slice(0, 400)
          .map((x) => (NUM_OK(x.num, 1, 99) ? { id: x.id, num: Math.round(Number(x.num)) } : { id: x.id }));
        t.notas = str(t.notas).slice(0, 4000);
      });
      // chequeos de salud del torneo (5B): { inicio: { jugadorId: { estado, nota } }, fin: {…} }
      (inf.torneos || []).forEach((t) => {
        if (t.chequeos === undefined) return;
        if (!plano(t.chequeos)) { delete t.chequeos; return; }
        const out = { inicio: {}, fin: {} };
        ['inicio', 'fin'].forEach((k) => {
          const src = plano(t.chequeos[k]) ? t.chequeos[k] : {};
          Object.keys(src).slice(0, 400).forEach((id) => { const x = src[id]; if (ID_OK(id) && plano(x) && ['apto', 'limitado', 'baja'].includes(x.estado)) out[k][id] = { estado: x.estado, nota: txt(x.nota, 120) }; });
        });
        t.chequeos = out;
      });
      (inf.partidos || []).forEach((p) => {
        if (p.torneoId !== undefined && !ID_OK(p.torneoId)) delete p.torneoId;
        if (p.fase !== undefined && !ID_OK(p.fase)) delete p.fase;
        // control antidopaje del partido (5B): { hubo, jugadores: [ids], nota }
        if (p.antidopaje !== undefined) {
          if (!plano(p.antidopaje)) delete p.antidopaje;
          else p.antidopaje = { hubo: p.antidopaje.hubo === true, jugadores: Array.from(new Set(arrObj(p.antidopaje.jugadores).filter((x) => ID_OK(x)))).slice(0, 120), nota: str(p.antidopaje.nota).slice(0, 2000) };
        }
        // reemplazo por lesión de una atención (5B): { hecho, informe }
        if (Array.isArray(p.incidencias)) p.incidencias.forEach((i) => {
          if (!i || typeof i !== 'object' || i.reemplazo === undefined) return;
          if (!plano(i.reemplazo)) delete i.reemplazo; else i.reemplazo = { hecho: i.reemplazo.hecho === true, informe: str(i.reemplazo.informe).slice(0, 3000) };
        });
      });
      ['atenciones', 'casos'].forEach((k) => (inf[k] || []).forEach((r) => { if (r.torneoId !== undefined && !ID_OK(r.torneoId)) delete r.torneoId; }));
      // seguro en el exterior: país, cobertura (Club / Viaje) y póliza, opcionales
      (inf.seguros || []).forEach((s) => {
        if (s.pais !== undefined) { s.pais = txt(s.pais, 80); if (!s.pais) delete s.pais; }
        if (s.cobertura !== undefined && !K.COBERTURAS_SEGURO.includes(s.cobertura)) delete s.cobertura;
        if (s.poliza !== undefined) { s.poliza = txt(s.poliza, 60); if (!s.poliza) delete s.poliza; }
      });
    }
    // plantillas de intervenciones (uso diario): [{ id, nombre, trat: { idTratamiento: cantidad } }]
    if (inf.plantillas !== undefined) {
      const vistosP = new Set();
      inf.plantillas = arrObj(inf.plantillas).filter((x) => x && typeof x === 'object' && !Array.isArray(x) && ID_OK(x.id) && !vistosP.has(x.id) && vistosP.add(x.id)).slice(0, 30).map((x) => {
        const trat = {}; if (plano(x.trat)) Object.keys(x.trat).slice(0, 40).forEach((k) => { const n = Math.floor(Number(x.trat[k])); if (/^[\w-]{1,40}$/.test(k) && Number.isFinite(n) && n > 0 && n <= 999) trat[k] = n; });
        return { id: x.id, nombre: str(x.nombre).trim().slice(0, 40), trat };
      }).filter((x) => x.nombre && Object.keys(x.trat).length);
    }
    ['antecedentes', 'documentos'].forEach((k) => {
      if (inf[k] === undefined) return;
      inf[k] = inf[k].filter((x) => ID_OK(x.jugadorId)); // sin jugador no se puede mostrar en ninguna parte
    });
    (inf.antecedentes || []).forEach((a) => {
      if (!['', ...K.GRUPOS_SANGRE].includes(a.grupoSanguineo || '')) a.grupoSanguineo = '';
      ['alergias', 'enfermedades', 'medicacionHabitual', 'lesionesPrevias', 'cirugiasPrevias'].forEach((c) => { if (a[c] !== undefined) a[c] = str(a[c]).slice(0, 4000); });
      ['apoderado', 'telefonoApoderado', 'contactoEmergencia', 'telefonoEmergencia'].forEach((c) => { if (a[c] !== undefined) a[c] = str(a[c]).slice(0, 120); });
      a.antropometria = arrObj(a.antropometria).filter((x) => x && typeof x === 'object').slice(0, 300)
        .map((x) => ({ fecha: ISO_OK(x.fecha) ? x.fecha : '', talla: NUM_OK(x.talla, 30, 260) ? Number(x.talla) : '', peso: NUM_OK(x.peso, 2, 400) ? Number(x.peso) : '' }))
        .filter((x) => x.talla !== '' || x.peso !== '');
    });
    (inf.documentos || []).forEach((d) => {
      if (!IMG_OK(d.img) || !/^data:image\//.test(d.img)) d.img = ''; // solo fotos incluidas en el archivo (data:), nunca una ruta ni una referencia de la nube
      if (!K.TIPOS_DOC.includes(d.tipo)) d.tipo = 'Otro';
      if (d.casoId !== undefined && !ID_OK(d.casoId)) d.casoId = '';
      d.titulo = str(d.titulo).slice(0, 120);
    });
    if (inf.documentos) inf.documentos = inf.documentos.filter((d) => d.img);
    if (Array.isArray(inf.indicadores)) inf.indicadores = inf.indicadores.filter((i) => typeof i.fuente === 'string' && i.fuente); // un indicador sin su fuente de datos no se puede calcular
    if (Array.isArray(inf.eventos)) inf.eventos = inf.eventos.filter((v) => ['control', 'examen', 'medicamento', 'cirugia'].includes(v.tipo)); // un tipo desconocido no se puede mostrar ni editar
    (inf.casos || []).forEach((c) => { if (c.zonas !== undefined) c.zonas = arrObj(c.zonas).filter((x) => typeof x === 'string'); });
    (inf.staff || []).forEach((st) => { st.personas = arrObj(st.personas).filter((x) => x && typeof x === 'object').map((x) => Object.assign(x, { nombre: typeof x.nombre === 'string' ? x.nombre : '' })); });
    (inf.casos || []).forEach((c) => { if (c.gravedad && !K.GRAVEDADES[c.gravedad]) c.gravedad = 'pordefinir'; });
    (inf.jugadores || []).forEach((j) => { if (j.foto && !IMG_OK(j.foto)) j.foto = ''; });
    (inf.partidos || []).forEach((p) => {
      if (p.logo && !(IMG_OK(p.logo) || /^[\w-]+$/.test(p.logo))) p.logo = '';
      if (p.logoData && !IMG_OK(p.logoData)) p.logoData = '';
      if (p.jid !== undefined && !ID_OK(p.jid)) p.jid = p.id;
      if (p.cat !== undefined && p.cat !== null && p.cat !== '') { const cn = Number(p.cat); if (CATS_OK.includes(cn)) p.cat = cn; else delete p.cat; } // categoría del partido: solo 15, 16, 18 o 20
      if (p.anio !== undefined) { p.anio = Number(p.anio); if (!ANIO_OK(p.anio)) delete p.anio; }
      if (p.minutos && typeof p.minutos !== 'object') p.minutos = {};
      // citados del partido (v1.6): arreglo de ids de jugador, sin repetidos; si no es válido se quita (el partido vuelve a contar con todos los de la categoría)
      if (p.citados !== undefined) { if (Array.isArray(p.citados)) p.citados = Array.from(new Set(p.citados.filter((x) => ID_OK(x)))).slice(0, 300); else delete p.citados; }
    });
    (inf.atenciones || []).forEach((a) => {
      if (a.trat && typeof a.trat === 'object') Object.keys(a.trat).forEach((k) => { if (!/^[\w-]+$/.test(k)) delete a.trat[k]; });
    });
    // conmoción cerebral (SCAT5, v1.6): incidencia.scat5 (enums, números en su rango, fecha ISO, textos) y caso.conmocion / caso.rtpConmocion (6 etapas). Todo opcional.
    if (K.conmocion) K.conmocion.normalizarInforme(inf);
    else {
      (inf.partidos || []).forEach((p) => { if (Array.isArray(p.incidencias)) p.incidencias.forEach((i) => { if (i && typeof i === 'object') delete i.scat5; }); });
      (inf.casos || []).forEach((c) => { delete c.conmocion; delete c.rtpConmocion; });
    }
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
    // un respaldo anterior a las temporadas no dice a qué año pertenecen sus textos: vale el año en que se hizo el respaldo (no el de hoy)
    const anioResp = Number(fecha.slice(0, 4));
    if (anioResp) informes.forEach((inf) => { if (!Number.isInteger(inf.anioTexto)) inf.anioTexto = Math.max(Number(inf.anio) || 0, anioResp); });
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
          // Un jugador que después del respaldo cambió a otro informe ya vive allá con todos sus registros (más nuevos): no se repite aquí.
          const enOtro = new Set(); K.state.informes.forEach((i) => { if (i !== existente) (i.jugadores || []).forEach((j) => enOtro.add(j.id)); });
          const repetidos = new Set((inf.jugadores || []).filter((j) => enOtro.has(j.id)).map((j) => j.id));
          if (repetidos.size) {
            inf.jugadores = inf.jugadores.filter((j) => !repetidos.has(j.id));
            Object.keys(inf).forEach((k) => { if (Array.isArray(inf[k]) && k !== 'partidos' && k !== 'jugadores') inf[k] = inf[k].filter((x) => !(x && repetidos.has(x.jugadorId))); });
            res.enOtroInforme = repetidos.size;
          }
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

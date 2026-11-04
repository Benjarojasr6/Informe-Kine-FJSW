/* Qué incluye el informe (v1.8.0): un botón on/off por cada parte del informe.
   Los tres que ya existían (registro de lesionados, lesionados actuales, datos de partidos) siguen guardándose como antes;
   los demás se guardan en `bloques` (por año, igual que los textos). Sin valor guardado = incluido. */
(function () {
  const K = window.K, e = K.esc;
  // legacy = el valor vive en un campo propio del informe (así se guardaba antes)
  K.BLOQUES = [
    { id: 'calendario', t: 'Calendario de partidos y cuerpo técnico', grupo: 'Inicio' },
    { id: 'resumen', t: 'Resumen final (totales y tratamientos)', grupo: 'Inicio' },
    { id: 'analisis', t: 'Análisis de lesiones', d: 'indicadores, casos por mes, gravedad, dónde ocurrió, terreno y tejido', grupo: 'Estadísticas' },
    { id: 'epi', t: 'Estadísticas de lesiones (como el EPI anual)', d: 'jugadores lesionados y cirugías, lesiones por semana y por categoría, tipos, zonas y la tabla Semana · Jugador · Lesión de cada categoría', grupo: 'Estadísticas' },
    { id: 'zonas', t: 'Zonas del cuerpo', d: 'mapa, zonas más frecuentes y recurrencias', grupo: 'Estadísticas' },
    { id: 'kine', t: 'Seguimiento kinésico', d: 'sesiones y asistencia a kinesiología', grupo: 'Kinesiología' },
    { id: 'regLesionados', t: 'Registro de lesionados del período', legacy: true, grupo: 'Kinesiología' },
    { id: 'lesActuales', t: 'Lesionados actuales', d: 'los que aún no tienen alta', legacy: true, grupo: 'Kinesiología' },
    { id: 'atencionesPartidos', t: 'Los datos de partidos', d: 'páginas «Atenciones en partidos» y «Detalle por partido»', legacy: true, grupo: 'Kinesiología' },
    { id: 'conmociones', t: 'Conmociones cerebrales (SCAT5)', d: 'solo aparece si hubo alguna', grupo: 'Kinesiología' },
    { id: 'seguro', t: 'Uso del seguro', d: 'solo aparece si hubo eventos', grupo: 'Kinesiología' },
    { id: 'conclusiones', t: 'Conclusiones y objetivos', grupo: 'Cierre' },
    { id: 'fichas', t: 'Fichas individuales de los jugadores', d: 'una o más páginas por jugador', grupo: 'Cierre' }
  ];
  const def = (id) => K.BLOQUES.find((b) => b.id === id);
  // ¿Va esta parte en el informe? (los tres antiguos conservan su regla de siempre)
  K.bloqueOn = (inf, id) => {
    const b = def(id);
    if (b && b.legacy) return id === 'atencionesPartidos' ? inf.atencionesPartidos !== false : inf[id] !== false;
    return !(inf.bloques && inf.bloques[id] === false);
  };
  K.sinFichas = (inf) => !!inf._sinFichas || !K.bloqueOn(inf, 'fichas');

  K.panelBloques = function (inf, anioV) {
    const filas = (g) => K.BLOQUES.filter((b) => b.grupo === g).map((b) => {
      const on = K.bloqueOn(inf, b.id);
      const attrs = b.id === 'atencionesPartidos' ? 'data-atenpartidos data-acc-change="atenPartidos"' : b.legacy ? `data-acc-change="opcInf" data-opc="${b.id}"` : `data-acc-change="bloque" data-bl="${b.id}"`;
      const ayuda = b.id === 'atencionesPartidos' ? `Muestra u oculta las páginas «Atenciones en partidos» y «Detalle por partido» del informe de ${anioV}. Los totales del resumen no cambian y los informes de cada partido tampoco. ${on ? 'Ahora están incluidas.' : 'Ahora están ocultas.'}` : (b.d ? b.d.charAt(0).toUpperCase() + b.d.slice(1) + '.' : '');
      const txt = b.id === 'atencionesPartidos' ? 'Incluir los datos de partidos en el informe general' : `Incluir «${b.t}»`;
      return `<label class="check bl-fila${on ? ' on' : ''}"><input type="checkbox" class="bl-sw" ${attrs} ${on ? 'checked' : ''}><span class="bl-t"><b>${e(txt)}</b>${ayuda ? `<small>${e(ayuda)}</small>` : ''}</span><em class="bl-est" aria-hidden="true">${on ? 'Sí' : 'No'}</em></label>`;
    }).join('');
    const grupos = ['Inicio', 'Estadísticas', 'Kinesiología', 'Cierre'];
    return `<div class="card" data-bloques><div class="fila sb wrap gap"><h2 style="margin:0">Qué incluir en el informe ${e(anioV)}</h2>
      <div class="fila gap"><button class="btn sec chico" data-acc="bloquesTodos" data-on="1">Todo</button><button class="btn sec chico" data-acc="bloquesTodos" data-on="0">Nada</button></div></div>
      <p class="sub">Enciende o apaga cada parte del informe: la vista previa de abajo y el PDF cambian al tiro. Con «Nada» queda solo la portada. Los totales y los informes de cada partido no cambian.</p>
      ${grupos.map((g) => `<h3 class="bl-g">${g}</h3>${filas(g)}`).join('')}</div>`;
  };

  const hostActual = () => (K.ui.cat && (K.ui.alcance === 'todas' || K.ui.alcance === 'todasRes') ? K.informeGrupo(K.GRUPOS[0]) : K.inf());
  const poner = (T, id, v) => { const b = def(id); if (b && b.legacy) T[id] = v; else { T.bloques = T.bloques && typeof T.bloques === 'object' ? T.bloques : {}; T.bloques[id] = v; } };
  Object.assign(K.acciones, {
    bloque(el) { poner(K.textosAnio(hostActual(), K.anioVista(), true), el.dataset.bl, !!el.checked); K.guardar(); K.render(); },
    bloquesTodos(el) { const T = K.textosAnio(hostActual(), K.anioVista(), true), v = el.dataset.on === '1'; K.BLOQUES.forEach((b) => poner(T, b.id, v)); K.guardar(); K.render(); }
  });
})();

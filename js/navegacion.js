/* Navegación: el gesto o botón "atrás" del celular vuelve a la sección anterior (o a Informe) en vez de cerrar la app. */
(function () {
  const K = window.K;
  const pila = [];
  let previo = null, armado = true, tAviso = null;

  const render0 = K.render;
  K.render = function () {
    const cur = { p: K.ui.pantalla, j: K.ui.jugadorId || null, m: K.ui.partidoId || null, c: K.ui.cat || null };
    if (previo && previo.c !== cur.c) pila.length = 0;
    else if (previo && !K._volviendo && (previo.p !== cur.p || previo.j !== cur.j || previo.m !== cur.m) && cur.c) { pila.push(previo); if (pila.length > 25) pila.shift(); }
    previo = cur; K._volviendo = false;
    return render0.apply(this, arguments);
  };

  /* Devuelve true si "atrás" se resolvió dentro de la app. */
  K.atras = function () {
    if (K.hayModal && K.hayModal()) { K.cerrarUltimoModal(); return true; }
    const cubierta = document.getElementById('vista-previa-cubierta'); if (cubierta) { cubierta.remove(); return true; }
    if (!K.state || !K.ui.cat) return false;
    const v = pila.pop();
    if (v && v.c === K.ui.cat) { K._volviendo = true; K.ui.pantalla = v.p; K.ui.jugadorId = v.j; K.ui.partidoId = v.m; K.render(); window.scrollTo(0, 0); return true; }
    if (K.ui.pantalla !== 'informe' || K.ui.jugadorId || K.ui.partidoId) { K._volviendo = true; K.ui.pantalla = 'informe'; K.ui.jugadorId = null; K.ui.partidoId = null; K.render(); window.scrollTo(0, 0); return true; }
    return false;
  };

  try {
    history.replaceState({ kine: 0 }, '');
    history.pushState({ kine: 1 }, '');
  } catch (x) { /* sin historial */ }

  window.addEventListener('popstate', (ev) => {
    const s = ev.state;
    if (s && s.kine === 1) return; // avance sobre el guardia: nada
    // el usuario retrocedió sobre el guardia
    if (K.atras()) { try { history.pushState({ kine: 1 }, ''); } catch (x) { /* nada */ } return; }
    // ya estamos en Informe (o en el inicio): un segundo gesto seguido sale de la app
    if (K.aviso) K.aviso('Desliza otra vez para salir');
    clearTimeout(tAviso);
    tAviso = setTimeout(() => { try { history.pushState({ kine: 1 }, ''); } catch (x) { /* nada */ } }, 2500);
  });
})();

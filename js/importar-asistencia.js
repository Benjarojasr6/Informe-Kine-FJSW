/* Importar asistencia a Kine desde un archivo preparado (v1.7.1).
   A diferencia de “Importar” respaldo (que agrega o reemplaza informes completos), esto SOLO SUMA registros de asistencia:
   lo que ya está en la app nunca se cambia. Las diferencias se muestran antes de agregar. Formato del archivo:
   { tipo: 'asistencias', v: 1, origen: 'texto', registros: [{ inf, j, nombre, f, v, t, sub, no, cambiar? }], quitar?: [{ inf, j, nombre, f }] }
   v1.7.2: solo si el archivo lo pide expresamente, un registro con `cambiar: true` reemplaza el que ya está en la app para ese jugador y día, y la lista `quitar`
   borra los registros de esos días. Ambas cosas se muestran una por una en el resumen y antes de aplicar se descarga una copia de seguridad. */
(function () {
  const K = window.K, e = K.esc;
  const MOTIVOS = () => K.MOTIVOS_NO.map((m) => m[0]).concat(['pauta']);
  const FECHA = /^\d{4}-\d{2}-\d{2}$/;

  const valido = (r) => {
    if (!r || typeof r !== 'object' || !FECHA.test(r.f || '') || !r.j) return false;
    if (r.v === 'si') return r.t === 'SK' || (r.t === 'RD' && ['K', 'KPF', 'KPA'].includes(r.sub));
    if (r.v === 'no') return MOTIVOS().includes(r.no);
    return false;
  };
  const texto = (a) => K.kineAsisTxt(a);
  const forma = (r) => (r.v === 'si' ? { v: 'si', t: r.t, sub: r.t === 'RD' ? r.sub : '', no: '' } : { v: 'no', t: '', sub: '', no: r.no });
  const igual = (a, f) => a.v === f.v && (a.t || '') === f.t && (a.sub || '') === f.sub && (a.no || '') === f.no;

  // Revisa el archivo contra los datos actuales. No cambia nada.
  K.revisarAsistencias = function (txt) {
    let d; try { d = JSON.parse(txt); } catch (x) { throw new Error('El archivo no se pudo leer.'); }
    if (!d || d.tipo !== 'asistencias' || !Array.isArray(d.registros)) throw new Error('Este archivo no es de asistencias. Para un respaldo usa “Importar”.');
    const plan = { origen: d.origen || '', total: d.registros.length, nuevos: [], iguales: 0, distintos: [], cambios: [], quitar: [], quitarNada: 0, sinJugador: new Map(), invalidos: 0, repetidos: 0 };
    const visto = new Set();
    d.registros.forEach((r) => {
      if (!valido(r)) { plan.invalidos++; return; }
      const clave = r.j + '|' + r.f; if (visto.has(clave)) { plan.repetidos++; return; } visto.add(clave);
      let inf = K.state.informes.find((i) => i.id === r.inf && (i.jugadores || []).some((j) => j.id === r.j));
      if (!inf) inf = K.state.informes.find((i) => (i.jugadores || []).some((j) => j.id === r.j));
      if (!inf) { plan.sinJugador.set(r.j, r.nombre || r.j); return; }
      const j = inf.jugadores.find((x) => x.id === r.j), f = forma(r);
      const ex = (inf.asistencias || []).find((a) => a.jugadorId === r.j && a.fecha === r.f);
      if (!ex) plan.nuevos.push({ inf, j, r, f });
      else if (igual(ex, f)) plan.iguales++;
      else if (r.cambiar === true) plan.cambios.push({ ex, j, fecha: r.f, f, enApp: texto(ex), enArchivo: texto(Object.assign({}, f)) });
      else plan.distintos.push({ j, fecha: r.f, enApp: texto(ex), enArchivo: texto(Object.assign({}, f)) });
    });
    (Array.isArray(d.quitar) ? d.quitar : []).forEach((q) => {
      if (!q || !q.j || !FECHA.test(q.f || '')) { plan.invalidos++; return; }
      const inf = K.state.informes.find((i) => (i.jugadores || []).some((j) => j.id === q.j));
      if (!inf) { plan.sinJugador.set(q.j, q.nombre || q.j); return; }
      const ex = (inf.asistencias || []).find((a) => a.jugadorId === q.j && a.fecha === q.f);
      if (!ex) { plan.quitarNada++; return; }
      plan.quitar.push({ inf, ex, j: inf.jugadores.find((x) => x.id === q.j), fecha: q.f, enApp: texto(ex) });
    });
    return plan;
  };

  K.aplicarAsistencias = function (plan) {
    plan.nuevos.forEach(({ inf, j, r, f }) => { inf.asistencias = inf.asistencias || []; inf.asistencias.push(Object.assign({ id: K.uid(), jugadorId: j.id, fecha: r.f }, f)); });
    plan.cambios.forEach(({ ex, f }) => { ex.v = f.v; ex.t = f.t; ex.sub = f.sub; ex.no = f.no; });
    plan.quitar.forEach(({ inf, ex }) => { const i = inf.asistencias.indexOf(ex); if (i >= 0) inf.asistencias.splice(i, 1); });
    K.guardar();
    return plan.nuevos.length;
  };

  const fc = (f) => (K.fechaCorta ? K.fechaCorta(f) : f);
  const resumenModal = (plan) => {
    const li = (n, t) => `<li><b>${n}</b> ${t}</li>`;
    const dist = plan.distintos.length ? `<details class="kf-ayuda" open><summary>Diferencias con lo que ya tienes (se mantiene lo de la app)</summary><ul class="imp-l">${plan.distintos.slice(0, 40).map((x) => `<li>${e(x.j.nombre)} · ${e(fc(x.fecha))}: en la app <b>${e(x.enApp)}</b> · en el archivo ${e(x.enArchivo)}</li>`).join('')}${plan.distintos.length > 40 ? `<li class="suave">… y ${plan.distintos.length - 40} más</li>` : ''}</ul></details>` : '';
    const lista = (arr, f) => `<ul class="imp-l">${arr.slice(0, 40).map(f).join('')}${arr.length > 40 ? `<li class="suave">… y ${arr.length - 40} más</li>` : ''}</ul>`;
    const camb = plan.cambios.length ? `<details class="kf-ayuda" open><summary>Se cambiarán por indicación del archivo (${plan.cambios.length})</summary>${lista(plan.cambios, (x) => `<li>${e(x.j.nombre)} · ${e(fc(x.fecha))}: de <b>${e(x.enApp)}</b> a <b>${e(x.enArchivo)}</b></li>`)}</details>` : '';
    const quit = plan.quitar.length ? `<details class="kf-ayuda" open><summary>Se quitarán por indicación del archivo (${plan.quitar.length})</summary>${lista(plan.quitar, (x) => `<li>${e(x.j.nombre)} · ${e(fc(x.fecha))}: se quita <b>${e(x.enApp)}</b> (ese día no hubo entrenamiento)</li>`)}</details>` : '';
    const sin = plan.sinJugador.size ? `<details class="kf-ayuda"><summary>Jugadores que no están en la app (no se importan)</summary><ul class="imp-l">${Array.from(plan.sinJugador.values()).map((n) => `<li>${e(n)}</li>`).join('')}</ul></details>` : '';
    return `<p>${plan.origen ? 'Origen: <b>' + e(plan.origen) + '</b>. ' : ''}El archivo trae <b>${plan.total}</b> registros.</p>
      <ul class="imp-l">${li(plan.nuevos.length, 'se agregarían (días sin registro en la app)')}${li(plan.iguales, 'ya están igual en la app')}${plan.cambios.length ? li(plan.cambios.length, 'se cambiarán (lo pide el archivo)') : ''}${plan.quitar.length ? li(plan.quitar.length, 'se quitarán (lo pide el archivo)') : ''}${li(plan.distintos.length, 'son distintos a lo que hay en la app: <u>no se cambian</u>')}${plan.sinJugador.size ? li(plan.sinJugador.size, 'jugadores no existen en la app') : ''}${plan.invalidos ? li(plan.invalidos, 'registros inválidos (se ignoran)') : ''}${plan.repetidos ? li(plan.repetidos, 'repetidos dentro del archivo (se ignoran)') : ''}</ul>${camb}${quit}${dist}${sin}
      <p class="suave">${plan.cambios.length || plan.quitar.length ? 'Solo se cambia o quita lo que aparece arriba, uno por uno; el resto de lo que ya está en la app no se toca.' : 'Esto solo suma registros nuevos; nunca modifica ni borra lo que ya está en la app.'} Antes de aplicar se descarga una copia de seguridad.</p>`;
  };

  K.importarAsistenciasArchivo = function (txt) {
    let plan; try { plan = K.revisarAsistencias(txt); } catch (x) { K.aviso(x.message, true); return; }
    K.modal({
      titulo: 'Importar asistencia', cuerpo: resumenModal(plan),
      botones: plan.nuevos.length || plan.cambios.length || plan.quitar.length ? [{ txt: plan.cambios.length || plan.quitar.length ? 'Aplicar (' + plan.nuevos.length + ' nuevos, ' + plan.cambios.length + ' cambios, ' + plan.quitar.length + ' quitados)' : 'Agregar ' + plan.nuevos.length + ' registros', fn: () => {
        try { K.exportar(false, { nombre: 'copia-antes-de-importar-asistencia', copiaSeguridad: true }); } catch (x) { /* sigue */ }
        const n = K.aplicarAsistencias(plan); K.render(); K.aviso('Se agregaron ' + n + ' registros de asistencia' + (plan.cambios.length || plan.quitar.length ? ', se cambiaron ' + plan.cambios.length + ' y se quitaron ' + plan.quitar.length : ''));
      } }] : []
    });
  };

  K.tarjetaImportAsis = () => (K.puedeEditar && K.puedeEditar() ? `<div class="card" data-imp-asis-card><h2>Importar asistencia</h2>
    <p class="sub">Para cargar de una vez la asistencia a Kine desde un archivo preparado (por ejemplo, desde tu Excel). Suma los días que no tienen registro; lo que ya está en la app no se cambia salvo que el archivo lo pida expresamente, y siempre ves un resumen antes de aplicar.</p>
    <label class="btn sec chico" style="cursor:pointer">${K.uiIco('subir', 16)} Elegir archivo de asistencia<input type="file" accept="application/json,.json" data-imp-asis hidden></label></div>` : '');

  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t && t.matches && t.matches('input[data-imp-asis]') && t.files && t.files[0]) { t.files[0].text().then((txt) => K.importarAsistenciasArchivo(txt)); t.value = ''; }
  });
})();

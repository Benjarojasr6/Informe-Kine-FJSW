/* Aviso de examen un día antes (v1.7.1): “Mañana hay examen: llama hoy al seguro”.
   Se muestra al abrir la app (una vez al día por lista de exámenes) y, si el dispositivo lo permitió, también como
   notificación del sistema. Limitación: una app instalada no puede avisar sola cuando está cerrada (eso necesita un
   servidor aparte); el aviso aparece cuando se abre o se vuelve a ella. */
(function () {
  const K = window.K, e = K.esc;
  const LS_ON = 'kine_aviso_examen', LS_VISTO = 'kine_aviso_examen_visto';
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (x) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (x) { /* sin almacenamiento */ } }
  };
  const activo = () => ls.get(LS_ON, '1') !== '0';
  const sumaDias = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${K.pad(t.getMonth() + 1)}-${K.pad(t.getDate())}`; };

  // Exámenes agendados para mañana: { f, txt, it:{ j, cat, inf, c|ev } }
  K.examenesManana = function () {
    if (!K.kineFechasImportantes || !K.kineLesionados || !K.state || !K.state.informes || !K.state.informes.length) return [];
    const manana = sumaDias(K.hoy(), 1);
    let les = []; try { les = K.kineLesionados(); } catch (x) { les = []; }
    return K.kineFechasImportantes(les).filter((x) => x.t === 'examen' && x.f === manana && !/\(realizado\)/.test(x.txt));
  };
  const clave = (xs) => K.hoy() + '|' + xs.map((x) => x.it.j.id + ':' + x.txt).sort().join(',');
  const cuerpo = (xs) => `<p>Mañana hay <b>${xs.length === 1 ? '1 examen' : xs.length + ' exámenes'}</b>. <b>Recuerda llamar hoy al seguro</b>: hay que avisar un día antes.</p>
    <ul class="imp-l">${xs.map((x) => `<li><b>${e(x.it.j.nombre)}</b> · Sub ${e(String(x.it.cat || ''))} — ${e(x.txt)}</li>`).join('')}</ul>`;

  function notificar(xs) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const titulo = xs.length === 1 ? 'Mañana hay un examen: llama hoy al seguro' : `Mañana hay ${xs.length} exámenes: llama hoy al seguro`;
      const opciones = { body: xs.map((x) => x.it.j.nombre + ' · ' + x.txt).join('\n'), tag: 'examen-' + K.hoy(), icon: 'icon-192.png' };
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then((reg) => { if (reg && reg.showNotification) reg.showNotification(titulo, opciones); else new Notification(titulo, opciones); }).catch(() => { /* nada */ });
      else new Notification(titulo, opciones);
    } catch (x) { /* nunca rompe la app */ }
  }

  let t = null, intentos = 0;
  function revisar(forzar) {
    clearTimeout(t);
    if (K.rol === 'tecnico' || (K.puedeEditar && !K.puedeEditar()) || !activo()) return;
    const xs = K.examenesManana(); if (!xs.length) return;
    if (!forzar && ls.get(LS_VISTO, '') === clave(xs)) return;
    if (document.querySelector('#modal-root .hoja') && intentos++ < 8) { t = setTimeout(() => revisar(forzar), 3000); return; } // espera a que se cierre otro aviso (por ejemplo, el del respaldo)
    intentos = 0; ls.set(LS_VISTO, clave(xs));
    notificar(xs);
    K.modal({ titulo: 'Mañana hay examen', cuerpo: cuerpo(xs), botones: [{ txt: 'Entendido' }] });
  }
  K.avisoExamenes = revisar;

  K.tarjetaAvisos = () => {
    if (K.rol === 'tecnico') return '';
    const perm = ('Notification' in window) ? Notification.permission : 'no';
    const estado = perm === 'granted' ? 'Notificaciones del dispositivo: <b>activadas</b>.' : perm === 'denied' ? 'Notificaciones del dispositivo: <b>bloqueadas</b> en este navegador (se cambian desde la configuración del sitio).' : perm === 'no' ? 'Este navegador no permite notificaciones del dispositivo; igual verás el aviso al abrir la app.' : 'Notificaciones del dispositivo: <b>sin activar</b>.';
    return `<div class="card" data-avisos><h2>Avisos de examen</h2>
      <p class="sub">Un día antes de cada examen agendado la app te avisa: <b>“Mañana hay examen: llama hoy al seguro”</b>. Sale al abrir la app (una vez al día) y, si activas las notificaciones, también como notificación del dispositivo.</p>
      <label class="check"><input type="checkbox" data-aviso-examen ${activo() ? 'checked' : ''}><span>Avisarme un día antes de cada examen</span></label>
      <p class="suave" style="margin:8px 0">${estado}</p>
      <div class="fila wrap gap">${perm === 'default' ? '<button class="btn chico" data-acc="avisoPermiso">Activar notificaciones</button>' : ''}<button class="btn sec chico" data-acc="avisoProbar">Probar aviso</button></div>
      <p class="suave" style="margin-top:8px">Importante: la app no puede avisar sola cuando está cerrada; el aviso aparece apenas la abres o vuelves a ella.</p></div>`;
  };

  Object.assign(K.acciones, {
    avisoPermiso() { try { Notification.requestPermission().then(() => K.render()); } catch (x) { K.aviso('Este navegador no permite notificaciones', true); } },
    avisoProbar() {
      const xs = K.examenesManana();
      if (xs.length) { revisar(true); return; }
      K.modal({ titulo: 'Así se vería el aviso', cuerpo: '<p>Mañana hay <b>1 examen</b>. <b>Recuerda llamar hoy al seguro</b>: hay que avisar un día antes.</p><ul class="imp-l"><li><b>Nombre del jugador</b> · Sub 16 — Examen · Resonancia</li></ul><p class="suave">Hoy no hay exámenes para mañana; este es solo un ejemplo.</p>', botones: [{ txt: 'Entendido' }] });
    }
  });
  document.addEventListener('change', (ev) => { const x = ev.target; if (x && x.matches && x.matches('input[data-aviso-examen]')) { ls.set(LS_ON, x.checked ? '1' : '0'); if (x.checked) revisar(false); } });

  const r0 = K.render;
  K.render = function () { const o = r0.apply(this, arguments); if (!t) t = setTimeout(() => { t = null; try { revisar(false); } catch (x) { /* nada */ } }, 2800); return o; };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { clearTimeout(t); t = setTimeout(() => { t = null; try { revisar(false); } catch (x) { /* nada */ } }, 1500); } });
})();

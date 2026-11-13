/* Selector de fecha propio: el calendario empieza el LUNES (el del navegador depende del idioma del aparato y en Chile confunde).
   Funciona con todos los <input type="date">: al tocarlos se abre este calendario; el valor se guarda igual (AAAA-MM-DD). */
(function () {
  'use strict';
  const K = window.K;
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const SEM = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let cierre = null;

  function cerrar() { if (cierre) { cierre(); cierre = null; } }

  function abrir(input) {
    cerrar();
    const min = /^\d{4}-\d{2}-\d{2}$/.test(input.min || '') ? input.min : '2000-01-01';
    const max = /^\d{4}-\d{2}-\d{2}$/.test(input.max || '') ? input.max : '2100-12-31';
    const hoy = new Date(), hoyIso = iso(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const actual = /^\d{4}-\d{2}-\d{2}$/.test(input.value) ? input.value : '';
    const base = actual || (hoyIso < min ? min : hoyIso > max ? max : hoyIso);
    let y = Number(base.slice(0, 4)), m = Number(base.slice(5, 7)) - 1;
    const y0 = Number(min.slice(0, 4)), y1 = Number(max.slice(0, 4));
    const fondo = document.createElement('div');
    fondo.className = 'kd-fondo';
    fondo.innerHTML = `<div class="kd" role="dialog" aria-modal="true" aria-label="Elegir fecha"><div data-cal></div>
      <div class="kd-esc"><label for="kd-txt">O escribe la fecha (dd-mm-aaaa)</label>
        <div class="kd-esc-fila"><input id="kd-txt" type="text" inputmode="numeric" autocomplete="off" maxlength="10" placeholder="dd-mm-aaaa" value="${actual ? esc(actual.slice(8, 10) + '-' + actual.slice(5, 7) + '-' + actual.slice(0, 4)) : ''}"><button type="button" class="btn chico" data-aceptar>Aceptar</button></div>
        <p class="kd-err" data-err role="alert"></p></div></div>`;
    document.body.appendChild(fondo);
    const caja = fondo.firstChild, cal = caja.querySelector('[data-cal]'), txt = caja.querySelector('#kd-txt'), err = caja.querySelector('[data-err]');

    function dibujar() {
      const primero = (new Date(y, m, 1).getDay() + 6) % 7; // lunes = 0
      const dias = new Date(y, m + 1, 0).getDate();
      let celdas = '';
      for (let i = 0; i < primero; i++) celdas += '<span></span>';
      for (let d = 1; d <= dias; d++) {
        const f = iso(y, m, d), fuera = f < min || f > max;
        celdas += `<button type="button" class="kd-d${f === actual ? ' sel' : ''}${f === hoyIso ? ' hoy' : ''}" data-f="${f}"${fuera ? ' disabled' : ''}>${d}</button>`;
      }
      let anios = '';
      for (let a = y0; a <= y1; a++) anios += `<option value="${a}"${a === y ? ' selected' : ''}>${a}</option>`;
      cal.innerHTML = `<div class="kd-cab"><button type="button" class="kd-nav" data-mov="-1" aria-label="Mes anterior">‹</button>
          <span class="kd-sel"><select data-mes aria-label="Mes">${MESES.map((n, i) => `<option value="${i}"${i === m ? ' selected' : ''}>${n}</option>`).join('')}</select><select data-anio aria-label="Año">${anios}</select></span>
          <button type="button" class="kd-nav" data-mov="1" aria-label="Mes siguiente">›</button></div>
        <div class="kd-sem">${SEM.map((s) => `<i>${s}</i>`).join('')}</div>
        <div class="kd-dias">${celdas}</div>
        <div class="kd-pie"><button type="button" class="btn sec chico" data-hoy${hoyIso < min || hoyIso > max ? ' disabled' : ''}>Hoy</button>${input.required ? '' : '<button type="button" class="btn sec chico" data-borrar>Borrar</button>'}<button type="button" class="btn chico" data-cerrar>Cerrar</button></div>`;
    }
    function poner(v) {
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      cerrar();
      try { input.focus({ preventScroll: true }); } catch (x) { /* sigue */ }
    }
    // fecha escrita: solo números, los guiones se ponen solos (dd-mm-aaaa)
    const fmt = (v) => { const d = String(v || '').replace(/\D/g, '').slice(0, 8); return d.length > 4 ? `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}-${d.slice(2)}` : d; };
    const leer = () => {
      const m2 = /^(\d{2})-(\d{2})-(\d{4})$/.exec(txt.value.trim());
      if (!m2) return { e: 'Escribe la fecha completa: día, mes y año (por ejemplo 05-03-2026).' };
      const f = `${m2[3]}-${m2[2]}-${m2[1]}`, dt = new Date(+m2[3], +m2[2] - 1, +m2[1]);
      if (dt.getFullYear() !== +m2[3] || dt.getMonth() !== +m2[2] - 1 || dt.getDate() !== +m2[1]) return { e: 'Esa fecha no existe. Revisa el día y el mes.' };
      if (f < min || f > max) return { e: `La fecha debe estar entre ${min.slice(8, 10)}-${min.slice(5, 7)}-${min.slice(0, 4)} y ${max.slice(8, 10)}-${max.slice(5, 7)}-${max.slice(0, 4)}.` };
      return { f };
    };
    const aceptar = () => { const r = leer(); if (r.e) { err.textContent = r.e; txt.focus(); return; } poner(r.f); };
    txt.addEventListener('input', () => { const a = fmt(txt.value); if (a !== txt.value) txt.value = a; err.textContent = ''; });
    txt.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); aceptar(); } });
    caja.addEventListener('click', (ev) => {
      const t = ev.target.closest('button'); if (!t) return;
      ev.stopPropagation();
      if (t.hasAttribute('data-aceptar')) return aceptar();
      if (t.dataset.f) return poner(t.dataset.f);
      if (t.dataset.mov) { m += Number(t.dataset.mov); if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } y = Math.max(y0, Math.min(y1, y)); return dibujar(); }
      if (t.hasAttribute('data-hoy')) return poner(hoyIso);
      if (t.hasAttribute('data-borrar')) return poner('');
      if (t.hasAttribute('data-cerrar')) return cerrar();
    });
    caja.addEventListener('change', (ev) => { ev.stopPropagation(); if (ev.target.matches('[data-mes]')) m = Number(ev.target.value); if (ev.target.matches('[data-anio]')) y = Number(ev.target.value); dibujar(); });
    fondo.addEventListener('click', (ev) => { if (ev.target === fondo) cerrar(); });
    const tecla = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); cerrar(); } };
    document.addEventListener('keydown', tecla, true);
    dibujar();
    cierre = () => { document.removeEventListener('keydown', tecla, true); fondo.remove(); };
    const sel = cal.querySelector('.kd-d.sel') || cal.querySelector('.kd-d.hoy') || cal.querySelector('.kd-d:not([disabled])');
    if (sel) sel.focus({ preventScroll: true });
  }
  K.abrirFecha = abrir;

  // Los campos de fecha pasan a “solo lectura” para que el navegador no abra su calendario propio (el nuestro empieza en lunes).
  function marcar(raiz) {
    (raiz.querySelectorAll ? raiz.querySelectorAll('input[type=date]:not([data-kd])') : []).forEach((i) => { i.setAttribute('data-kd', '1'); i.setAttribute('readonly', ''); i.setAttribute('inputmode', 'none'); });
  }
  document.addEventListener('click', (ev) => {
    const i = ev.target.closest && ev.target.closest('input[type=date]');
    if (!i || i.disabled) return;
    ev.preventDefault();
    if (!i.hasAttribute('data-kd')) marcar(i.parentNode || document);
    abrir(i);
  }, true);
  document.addEventListener('keydown', (ev) => {
    const i = ev.target && ev.target.matches && ev.target.matches('input[type=date]') ? ev.target : null;
    if (!i || i.disabled) return;
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrir(i); }
  }, true);
  marcar(document);
  new MutationObserver((muts) => { muts.forEach((mu) => mu.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches && n.matches('input[type=date]')) marcar(n.parentNode); else marcar(n); } })); }).observe(document.documentElement, { childList: true, subtree: true });
})();

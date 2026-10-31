/* Recordatorios de respaldo: el último día de cada mes (aviso grande) y, desde 2027, al cumplirse un trimestre,
   semestre o año (respaldo + descargar el informe del período). Se repite al abrir la app hasta hacer el respaldo (máx. 7 días). */
(function () {
  const K = window.K;
  const e = K.esc;
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DESDE_ANIO_INFORME = 2027;
  const LS = 'kine_inf_ult';
  const ls = {
    get() { try { return localStorage.getItem(LS) || ''; } catch (x) { return ''; } },
    set(v) { try { localStorage.setItem(LS, v); } catch (x) { /* sin almacenamiento */ } }
  };
  const iso = (d) => `${d.getFullYear()}-${K.pad(d.getMonth() + 1)}-${K.pad(d.getDate())}`;
  const ultimoDia = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() === d.getDate();

  // Qué corresponde avisar en una fecha (solo si es el último día de un mes).
  K.recordatorioDe = function (d) {
    if (!ultimoDia(d)) return null;
    const y = d.getFullYear(), m = d.getMonth() + 1, f = iso(d);
    const conInforme = y >= DESDE_ANIO_INFORME;
    if (!conInforme) return { f, y, nivel: 'mes', informe: false, tipo: '', titulo: `Último día de ${MESES[m - 1]}: hora del respaldo`, periodo: `el mes de ${MESES[m - 1]}` };
    if (m === 12) return { f, y, nivel: 'anio', informe: conInforme, tipo: 'anual', titulo: `Se cumplió el año ${y}`, periodo: `el año ${y}` };
    if (m === 6) return { f, y, nivel: 'semestre', informe: conInforme, tipo: 'semestre1', titulo: `Se cumplió el 1.er semestre ${y}`, periodo: `el 1.er semestre ${y} (y el 2.º trimestre)` };
    if (m === 3 || m === 9) return { f, y, nivel: 'trimestre', informe: conInforme, tipo: 'trimestre' + (m / 3 === 1 ? 1 : 3), titulo: `Se cumplió el ${m === 3 ? '1.er' : '3.er'} trimestre ${y}`, periodo: `el ${m === 3 ? '1.er' : '3.er'} trimestre ${y}` };
    return { f, y, nivel: 'mes', informe: false, tipo: '', titulo: `Último día de ${MESES[m - 1]}: hora del respaldo`, periodo: `el mes de ${MESES[m - 1]}` };
  };
  // El aviso pendiente más reciente (hoy o en los últimos 6 días) que todavía no tiene respaldo hecho.
  K.recordatorioPendiente = function (hoy) {
    hoy = hoy || new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
      const r = K.recordatorioDe(d);
      if (!r) continue;
      const ult = (K.state && K.state.ultimoRespaldo) || '';
      const respaldoHecho = ult && ult >= r.f;
      const informeHecho = !r.informe || (ls.get() && ls.get() >= r.f);
      if (respaldoHecho && informeHecho) return null; // el más reciente ya está al día
      return Object.assign({ hace: i, respaldoHecho, informeHecho }, r);
    }
    return null;
  };

  let mostrado = false;
  function avisar() {
    if (mostrado || !K.state || !K.state.informes || !K.puedeEditar || !K.puedeEditar()) return;
    if (K.hayModal && K.hayModal()) return;
    const r = K.recordatorioPendiente();
    if (!r) return;
    mostrado = true;
    const cuando = r.hace === 0 ? 'Hoy' : `El ${K.fechaCorta(r.f)}`;
    const pasos = [
      `<li class="${r.respaldoHecho ? 'hecho' : ''}"><b>${r.respaldoHecho ? '✓' : '1.'} Descargar el respaldo completo</b><span>Es tu copia de seguridad: un archivo con todo lo registrado. Guárdalo en tu correo o en Drive.</span></li>`,
      r.informe ? `<li class="${r.informeHecho ? 'hecho' : ''}"><b>${r.informeHecho ? '✓' : '2.'} Descargar el informe ${e(r.periodo.replace(/^el /, 'del '))}</b><span>En Informe → “Descargar PDF”, con el período elegido.</span></li>` : ''
    ].join('');
    const botones = [{ txt: 'Más tarde', cls: 'sec' }];
    if (r.informe && !r.informeHecho) botones.push({
      txt: 'Ir al informe', cls: 'sec',
      fn: () => {
        K.state.periodo = { tipo: r.tipo, anio: r.y, desde: '', hasta: '' }; K.guardar();
        if (K.ui.cat) { K.ui.pantalla = 'informe'; K.ui.jugadorId = null; K.render(); window.scrollTo(0, 0); K.aviso('Período elegido: descarga el PDF con “Descargar PDF”'); }
        else K.aviso('Elige una categoría y descarga el PDF del informe');
      }
    });
    if (!r.respaldoHecho) botones.push({ txt: 'Descargar respaldo', fn: () => { K.exportar(false); K.aviso('Respaldo descargado'); K.render(); } });
    K.modal({
      titulo: r.titulo,
      cuerpo: `<div class="rec-grande"><div class="rec-ico">${K.uiIco('descargar', 44)}</div>
        <p class="rec-txt">${cuando} corresponde cerrar ${e(r.periodo)}. Antes de seguir:</p><ul class="rec-pasos">${pasos}</ul>
        <p class="suave">Si algo pasa con la cuenta o con el celular, este archivo es lo que permite recuperar todo.</p></div>`,
      botones
    });
  }

  // El informe en PDF cuenta como descargado.
  const imp = K.imprimir;
  if (imp) K.imprimir = function () { ls.set(K.hoy()); return imp.apply(this, arguments); };

  // Se revisa al abrir la app y cuando vuelve a primer plano (por si quedó abierta de un día para otro).
  const r0 = K.render;
  let t = null;
  K.render = function () {
    const out = r0.apply(this, arguments);
    if (!mostrado) { clearTimeout(t); t = setTimeout(avisar, 1200); }
    return out;
  };
  // por si la primera pantalla se dibujó antes de que este archivo se cargara
  window.addEventListener('load', () => { clearTimeout(t); t = setTimeout(avisar, 1500); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { mostrado = false; clearTimeout(t); t = setTimeout(avisar, 800); } });
})();

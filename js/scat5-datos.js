/* Textos y listas del registro SCAT5 (v1.6.2). TODO el contenido de esta tabla es propio (redacción, palabras y números de la app);
   está separado en un solo lugar para poder cambiarlo fácilmente sin tocar la lógica (scat5.js).
   Es un registro de apoyo inspirado en la estructura de la evaluación SCAT5 (Concussion in Sport Group, 2017): no es el SCAT5 oficial ni lo reemplaza. */
(function () {
  const K = window.K;
  K.SCAT5_TEXTOS = {
    // Leyenda fija (ayuda, Manual y ficha PDF) y avisos
    leyenda: 'Registro de apoyo inspirado en la estructura de la evaluación SCAT5 (Concussion in Sport Group, 2017). No es el SCAT5 oficial ni lo reemplaza. Textos y listas propios. Para el formulario oficial, use el documento original.',
    avisoResultado: 'Un resultado normal no descarta una conmoción; la decisión es clínica. Con sospecha de conmoción el jugador no vuelve a jugar ese día.',
    avisoDia: 'Nadie vuelve a jugar el mismo día de la lesión.',
    avisoTiempo: 'La evaluación completa no se puede hacer bien en menos de 10 minutos: por eso en la cancha solo se hace la parte inmediata.',
    avisoEdad: 'Pensado para personas de 13 años o más (de la Sub 15 en adelante, sin problema).',

    // Momentos: clave, número, título, duración, cuándo y pasos [clave, título]
    momentos: [
      { k: 'cancha', n: 1, t: 'En cancha', dur: '2–3 min', cuando: 'Ahora, con el jugador en el campo',
        pasos: [['ban', 'Banderas rojas'], ['sig', 'Signos que ves'], ['mad', 'Preguntas de memoria'], ['exa', 'Glasgow y cuello'], ['dec', 'Decisión']] },
      { k: 'camarin', n: 2, t: 'En camarín', dur: '10–15 min', cuando: 'Al menos 10 min después, con el jugador tranquilo',
        pasos: [['ant', 'Antecedentes'], ['sint', 'Síntomas'], ['cog', 'Cognitivo'], ['exa', 'Examen'], ['dif', 'Memoria diferida'], ['dec', 'Decisión']] },
      { k: 'seguimiento', n: 3, t: 'Seguimiento', dur: '5–10 min', cuando: 'El día siguiente y los días que siguen',
        pasos: [['sint', 'Síntomas'], ['opc', 'Opcionales'], ['res', 'Resultado']] }
    ],

    // Preguntas de memoria en la cancha (adaptadas al fútbol)
    maddocks: ['¿En qué cancha estamos jugando hoy?', '¿Estamos en el primer o en el segundo tiempo?', '¿Quién hizo el último gol de este partido?', '¿Con qué equipo jugamos la fecha pasada?', '¿Ganamos o perdimos ese partido?'],
    gcs: {
      o: ['Ojos', [[4, 'Abre los ojos solo'], [3, 'Abre los ojos si le hablas'], [2, 'Abre los ojos solo con dolor'], [1, 'No abre los ojos']]],
      v: ['Verbal', [[5, 'Orientado'], [4, 'Confuso'], [3, 'Palabras sueltas'], [2, 'Solo sonidos'], [1, 'Sin respuesta']]],
      m: ['Motor', [[6, 'Obedece órdenes'], [5, 'Localiza el dolor'], [4, 'Se aparta del dolor'], [3, 'Flexión anormal'], [2, 'Extensión anormal'], [1, 'Sin respuesta']]]
    },
    sintomas: ['Dolor de cabeza', 'Presión en la cabeza', 'Dolor de cuello', 'Náuseas o vómitos', 'Mareo', 'Visión borrosa', 'Problemas de equilibrio', 'Sensibilidad a la luz', 'Sensibilidad al ruido', 'Sensación de lentitud',
      'Sensación de “estar en una nebulosa”', '“No me siento bien”', 'Dificultad para concentrarse', 'Dificultad para recordar', 'Fatiga o poca energía', 'Confusión', 'Somnolencia', 'Más emocional', 'Irritabilidad', 'Tristeza', 'Nervioso o ansioso', 'Dificultad para conciliar el sueño'],
    orientacion: ['¿En qué mes estamos?', '¿Qué día del mes es hoy?', '¿Qué día de la semana es?', '¿En qué año estamos?', '¿Qué hora es, más o menos? (vale una hora de diferencia)'],
    // 10 palabras cotidianas por lista (A, B y C)
    listas: {
      A: ['Mesa', 'Pan', 'Cerro', 'Lápiz', 'Vaso', 'Perro', 'Camisa', 'Puente', 'Lluvia', 'Zapato'],
      B: ['Silla', 'Queso', 'Playa', 'Llave', 'Plato', 'Gato', 'Chaleco', 'Camino', 'Viento', 'Calcetín'],
      C: ['Puerta', 'Naranja', 'Río', 'Reloj', 'Taza', 'Caballo', 'Bufanda', 'Techo', 'Nube', 'Guitarra']
    },
    // Series de 3, 4, 5 y 6 dígitos (el jugador las repite al revés)
    digitos: {
      A: [[5, 2, 8], [7, 1, 6, 3], [4, 9, 2, 8, 5], [3, 8, 1, 6, 9, 2]],
      B: [[6, 3, 9], [2, 7, 4, 1], [8, 5, 3, 9, 6], [1, 6, 2, 9, 4, 7]],
      C: [[4, 7, 2], [9, 3, 8, 6], [2, 6, 1, 7, 4], [5, 9, 3, 8, 2, 7]]
    },
    mesesReves: 'Diciembre, noviembre, octubre, septiembre, agosto, julio, junio, mayo, abril, marzo, febrero, enero',
    bess: [['Pies juntos', 'De pie, con los pies juntos, manos en la cintura y ojos cerrados.'], ['Un solo pie', 'Apoyado en el pie que no usa para patear, manos en la cintura y ojos cerrados.'], ['Un pie delante del otro (tándem)', 'El pie que no usa para patear va atrás, talón con punta, manos en la cintura y ojos cerrados.']],
    // Antecedentes (camarín): conmociones previas y preguntas sí/no
    antecedentes: {
      previas: [['0', 'Ninguna'], ['1', '1'], ['2', '2'], ['3', '3 o más']],
      preguntas: [['migrana', 'Migraña'], ['tdah', 'TDAH'], ['aprend', 'Dificultades de aprendizaje'], ['ansDep', 'Ansiedad o depresión']]
    },
    // Pantalla “¿Cómo uso el SCAT5 en la app?”
    ayuda: {
      titulo: '¿Cómo uso el SCAT5 en la app?',
      intro: 'No tienes que hacer todo en la cancha. La app lo separa en tres momentos y guarda cada parte para que la retomes después.',
      momentos: [
        ['1 · En cancha (2–3 min)', 'Entras al campo a ver al jugador. Marcas banderas rojas y lo que ves, haces 5 preguntas de memoria, Glasgow y cuello, y decides si sale del partido. Con una bandera roja: urgencia, y puedes terminar ahí. Si todo es normal, son unos 6 toques.'],
        ['2 · En camarín (10–15 min)', 'Al menos 10 minutos después, con el jugador tranquilo: antecedentes (opcional), los 22 síntomas, cognitivo, examen y equilibrio, la memoria diferida al final y la decisión (retiro, reemplazo, derivación y plan de retorno).'],
        ['3 · Seguimiento (día siguiente y siguientes)', 'Repites los síntomas (y, si quieres, cognitivo y equilibrio). La app te muestra lo del día anterior, compara y marca si mejora, sigue igual o empeora. Se conecta con el retorno gradual de 6 etapas.']
      ],
      avisos: ['Un resultado normal no descarta una conmoción: la decisión es clínica.', 'Nadie vuelve a jugar el mismo día de la lesión.', 'La evaluación completa no se puede hacer bien en menos de 10 minutos: por eso en la cancha solo se hace la parte inmediata.', 'En Hoy aparece “SCAT5 pendiente” si falta la parte de camarín o si pasó más de un día sin seguimiento.']
    }
  };
})();

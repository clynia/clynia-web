/* Clynia — esquema del cuestionario de SALUD CAPILAR (caída del cabello).
   Mismo motor (form-engine.js) y estilo que el cuestionario de peso.
   Bloque de paciente con campos REMPE. Cribado de seguridad para finasterida/dutasterida y minoxidil:
   las contraindicaciones absolutas (embarazo/lactancia, cáncer de próstata o mama, hígado grave,
   alergia) llevan a ending_rojo. Envía las respuestas al webhook de n8n.
   Categoría próximamente: la página NO está vinculada todavía.
   Contenido clínico pendiente de revisión por el equipo médico/legal. */
window.CLYNIA_FORM = {
  product: "Salud capilar",
  storeKey: "clynia_capilar_v1",
  webhook: "https://n8n-ixwg.srv1722506.hstgr.cloud/webhook/capilar-intake",

  steps: [
    { id: "welcome", type: "statement", q: "Cuéntanos tu caso", body: "Te haremos unas preguntas para que un médico colegiado valore si un tratamiento médico es adecuado para ti. Tardarás unos minutos. Es gratis y todo lo que nos cuentes es confidencial.", cta: "Empezar" },

    // ---------- BLOQUE PACIENTE (REMPE) ----------
    { id: "mayor_edad", section: "Sobre ti", type: "yesno", key: "mayor_edad", q: "Antes de empezar: ¿tienes 18 años o más?", next: function (a) { return a.mayor_edad === false ? "ending_menor" : null; } },
    { id: "nombre", section: "Sobre ti", type: "text", key: "nombre", q: "¿Cómo te llamas?", help: "Solo el nombre.", autocomplete: "given-name", placeholder: "Tu nombre" },
    { id: "primer_apellido", section: "Sobre ti", type: "text", key: "primer_apellido", q: "¿Cuál es tu primer apellido?", autocomplete: "family-name", placeholder: "Tu primer apellido" },
    { id: "segundo_apellido", section: "Sobre ti", type: "text", key: "segundo_apellido", q: "¿Y tu segundo apellido?", help: "Si solo tienes un apellido, deja este campo en blanco y continúa.", autocomplete: "off", placeholder: "Tu segundo apellido (opcional)", required: false },
    { id: "fecha_nacimiento", section: "Sobre ti", type: "date", key: "fecha_nacimiento", q: "¿Cuál es tu fecha de nacimiento?", next: function (a) { if (!a.fecha_nacimiento) return null; var d = new Date(a.fecha_nacimiento), t = new Date(), age = t.getFullYear() - d.getFullYear(), m = t.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--; return age < 18 ? "ending_menor" : null; } },
    { id: "sexo_biologico", section: "Sobre ti", type: "single", key: "sexo_biologico", q: "¿Cuál es tu sexo biológico?", help: "Lo necesita el médico para valorar el tratamiento y sus contraindicaciones.", options: [{ label: "Hombre", value: "Hombre" }, { label: "Mujer", value: "Mujer" }] },
    { id: "tipo_documento", section: "Sobre ti", type: "single", key: "tipo_documento", q: "¿Qué documento de identidad usarás?", help: "Pedimos estos datos para que un médico colegiado pueda emitir tu receta, solo si valora que el tratamiento es adecuado para ti.", options: [{ label: "DNI", value: "DNI" }, { label: "NIE", value: "NIE" }, { label: "Pasaporte", value: "Pasaporte" }] },
    { id: "num_documento", section: "Sobre ti", type: "text", key: "num_documento", q: "Número de tu documento", autocomplete: "off", placeholder: "Número de DNI/NIE/Pasaporte" },
    { id: "nacionalidad", section: "Sobre ti", type: "text", key: "nacionalidad", q: "¿Cuál es tu nacionalidad?", placeholder: "Tu nacionalidad" },
    { id: "email", section: "Sobre ti", type: "email", key: "email", q: "¿Cuál es tu correo electrónico?", help: "Te enviaremos aquí la confirmación y las indicaciones." },
    { id: "telefono", section: "Sobre ti", type: "tel", key: "telefono", q: "¿Y tu número de teléfono?", help: "El médico te llamará por aquí si necesita ampliar algún dato." },
    { id: "direccion", section: "Sobre ti", type: "text", key: "direccion", q: "¿Cuál es tu dirección postal?", help: "La necesitamos para poder emitir la receta médica, si el médico lo considera oportuno.", autocomplete: "address-line1", placeholder: "Tu calle y número" },
    { id: "codigo_postal", section: "Sobre ti", type: "text", key: "codigo_postal", q: "Código postal", autocomplete: "postal-code", placeholder: "Tu código postal" },
    { id: "localidad", section: "Sobre ti", type: "text", key: "localidad", q: "Localidad", autocomplete: "address-level2", placeholder: "Tu ciudad o población" },
    { id: "provincia", section: "Sobre ti", type: "text", key: "provincia", q: "Provincia", autocomplete: "address-level1", placeholder: "Tu provincia" },

    // ---------- TU CASO ----------
    { id: "patron", section: "Tu caso", type: "single", key: "patron", q: "¿Cómo es tu pérdida de cabello?", options: [
      { label: "Entradas o retroceso de la línea frontal" },
      { label: "Coronilla" },
      { label: "Entradas y coronilla" },
      { label: "Pérdida difusa por todo el cuero cabelludo" },
      { label: "Por zonas o placas" },
      { label: "No estoy seguro" }
    ] },
    { id: "tiempo", section: "Tu caso", type: "single", key: "tiempo", q: "¿Desde cuándo notas que se te cae el pelo?", options: [{ label: "Menos de 6 meses" }, { label: "Entre 6 meses y 1 año" }, { label: "Entre 1 y 3 años" }, { label: "Más de 3 años" }] },
    { id: "velocidad", section: "Tu caso", type: "single", key: "velocidad", q: "¿Cómo ha sido la caída?", options: [{ label: "Lenta y progresiva" }, { label: "Rápida o repentina", score: 1 }] },
    { id: "antecedentes", section: "Tu caso", type: "yesno", key: "antecedentes", q: "¿Hay antecedentes de calvicie en tu familia?" },
    { id: "desencadenante", section: "Tu caso", type: "multi", key: "desencadenante", required: false, q: "¿Ha pasado algo de esto en los últimos meses?", help: "Puede influir en la caída.", options: [
      { label: "Enfermedad o fiebre alta" }, { label: "Operación o anestesia" }, { label: "Pérdida de peso brusca" }, { label: "Mucho estrés" }, { label: "Parto reciente" }, { label: "Cambio o suspensión de medicación" }, { label: "Nada de lo anterior", exclusive: true }
    ] },
    { id: "cuero", section: "Tu caso", type: "multi", key: "cuero", q: "¿Notas algo en el cuero cabelludo?", options: [
      { label: "Picor o descamación" }, { label: "Enrojecimiento" }, { label: "Granos o pústulas" },
      { label: "Dolor o quemazón" }, { label: "Zonas con cicatriz, sin pelo y con piel brillante", crit: true },
      { label: "Nada, la piel está bien", exclusive: true }
    ] },
    { id: "foto", section: "Tu caso", type: "file", key: "foto", required: false, q: "¿Quieres adjuntar una foto de la zona?", help: "Opcional, pero ayuda mucho al médico a valorar tu caso. Si puedes, una foto de la coronilla y otra de frente, con buena luz.", cta2: "Subir foto" },

    // ---------- SEGURIDAD ----------
    { id: "intro_seguridad", type: "statement", q: "Ahora, unas preguntas de seguridad", body: "Sirven para valorar si un tratamiento para la caída del cabello (como finasterida oral o minoxidil) es adecuado y seguro en tu caso. Responde con tranquilidad.", cta: "Continuar" },
    { id: "embarazo", section: "Tu seguridad", type: "multi", key: "embarazo", showIf: function (a) { return a.sexo_biologico === "Mujer"; }, q: "¿Alguna de estas situaciones te aplica?", help: "Es importante: algunos tratamientos para el cabello no pueden usarse durante el embarazo, la lactancia ni si buscas quedarte embarazada.", options: [
      { label: "Estoy embarazada o podría estarlo", crit: true },
      { label: "Estoy buscando quedarme embarazada", crit: true },
      { label: "Estoy dando el pecho", crit: true },
      { label: "Ninguna de las anteriores", exclusive: true }
    ] },
    { id: "condiciones", section: "Tu seguridad", type: "multi", key: "condiciones", q: "¿Tienes o has tenido alguna de estas condiciones?", help: "Marca todas las que apliquen.", options: [
      { label: "Enfermedad del hígado grave", crit: true },
      { label: "Cáncer de próstata", crit: true },
      { label: "Cáncer de mama", crit: true },
      { label: "Depresión o ansiedad", score: 1 },
      { label: "Enfermedad del corazón o tensión muy baja", score: 1 },
      { label: "Problemas de tiroides", score: 1 },
      { label: "Alteraciones de la próstata (no cáncer)", score: 1 },
      { label: "Ninguna", exclusive: true }
    ] },
    { id: "alergia_tratamiento", section: "Tu seguridad", type: "yesno", key: "alergia_tratamiento", q: "¿Eres alérgico a la finasterida, la dutasterida o el minoxidil?", next: function (a) { return a.alergia_tratamiento === true ? "ending_rojo" : null; } },
    { id: "preocupa_sexual", section: "Tu seguridad", type: "yesno", key: "preocupa_sexual", required: false, q: "¿Te preocupan los posibles efectos sobre la libido o la función sexual?", help: "Algunos tratamientos orales pueden tener este tipo de efectos, poco frecuentes. Tu médico lo tendrá en cuenta al elegir el tratamiento." },
    { id: "tratamiento_previo", section: "Tu seguridad", type: "multi", key: "tratamiento_previo", required: false, q: "¿Has usado antes algún tratamiento para el pelo?", options: [
      { label: "Minoxidil (espuma o líquido)" }, { label: "Finasterida o dutasterida" }, { label: "Champús o lociones anticaída" }, { label: "Injerto capilar" }, { label: "Ninguno", exclusive: true }
    ] },
    { id: "tratamiento_previo_detalle", section: "Tu seguridad", type: "longtext", key: "tratamiento_previo_detalle", required: false, q: "Cuéntanos cuál y cómo te fue", showIf: function (a) { return Array.isArray(a.tratamiento_previo) && a.tratamiento_previo.length > 0 && a.tratamiento_previo.indexOf("Ninguno") === -1; } },
    { id: "medicamentos_actuales", section: "Tu seguridad", type: "yesno", key: "medicamentos_actuales", q: "¿Tomas algún medicamento con receta de forma habitual?" },
    { id: "lista_medicamentos", section: "Tu seguridad", type: "longtext", key: "lista_medicamentos", q: "¿Cuáles?", help: "Indica nombre y dosis si los conoces.", showIf: function (a) { return a.medicamentos_actuales === true; } },
    { id: "alergias_otras", section: "Tu seguridad", type: "yesno", key: "alergias_otras", q: "¿Tienes alguna otra alergia a medicamentos?" },
    { id: "lista_alergias", section: "Tu seguridad", type: "longtext", key: "lista_alergias", q: "¿A cuáles?", showIf: function (a) { return a.alergias_otras === true; } },

    // ---------- PREFERENCIAS ----------
    { id: "preferencia", section: "Casi listo", type: "single", key: "preferencia", required: false, q: "¿Tienes preferencia por algún tipo de tratamiento?", options: [{ label: "Prefiero comprimidos (oral)" }, { label: "Prefiero aplicación en el cuero cabelludo (tópico)" }, { label: "Me da igual, lo que recomiende el médico" }] },
    { id: "objetivo", section: "Casi listo", type: "single", key: "objetivo", required: false, q: "¿Qué te gustaría conseguir?", options: [{ label: "Frenar la caída" }, { label: "Recuperar densidad" }, { label: "Las dos cosas" }] },
    { id: "algo_mas", section: "Casi listo", type: "yesno", key: "algo_mas", q: "¿Hay algo más que quieras decirle al equipo médico?" },
    { id: "mensaje_equipo", section: "Casi listo", type: "longtext", key: "mensaje_equipo", q: "Cuéntanoslo", showIf: function (a) { return a.algo_mas === true; } },

    // ---------- CRIBADO + CONSENTIMIENTO ----------
    { id: "gate_triage", type: "gate", route: function (a, v) { return v.flag_rojo >= 1 ? "ending_rojo" : "consent"; } },
    { id: "consent", section: "Casi listo", type: "consent", key: "consent", q: "Tus datos, protegidos", cta: "Acepto y envío", submit: true, items: [
      { key: "acepta_privacidad", required: true, label: 'He leído y acepto la <a href="privacidad" target="_blank">Política de Privacidad</a> de Clynia.' },
      { key: "acepta_datos_salud", required: true, label: "Doy mi consentimiento explícito al tratamiento de mis datos de salud con fines asistenciales." },
      { key: "acepta_comercial", required: false, label: "Quiero recibir comunicaciones de Clynia sobre mi tratamiento y novedades." }
    ] },

    // ---------- FINALES ----------
    { id: "ending_ok", type: "ending", variant: "ok", q: "¡Gracias! Hemos recibido tu solicitud", body: "Un médico colegiado revisará tu caso y te contactará para los siguientes pasos. Si el tratamiento es adecuado para ti, te indicará cómo continuar. No tienes que hacer nada más por ahora." },
    { id: "ending_menor", type: "ending", variant: "stop", q: "Este servicio es solo para mayores de 18 años", body: "Por ahora solo podemos atender a personas mayores de edad. Si te has equivocado con la fecha, vuelve atrás y corrígela.", cta: "Volver a Clynia", href: "/" },
    { id: "ending_rojo", type: "ending", variant: "stop", q: "Por tu seguridad, esto debe valorarlo un médico en persona", body: "Según lo que nos has contado, un tratamiento online no es lo más adecuado para ti ahora mismo. Lo mejor es que un médico o un dermatólogo te valore de forma presencial. Si quieres que te orientemos, escríbenos a clynia@clynia.es.", cta: "Volver a Clynia", href: "/" }
  ],

  computeVars: function (a) {
    var steps = window.CLYNIA_FORM.steps, score = 0, flag = 0;
    steps.forEach(function (s) {
      var v = a[s.key];
      if (s.type === "multi" && Array.isArray(v)) {
        (s.options || []).forEach(function (o) { var val = ("value" in o) ? o.value : o.label; if (v.indexOf(val) > -1) { if (o.score) score += o.score; if (o.crit) flag++; } });
      } else if (s.type === "single" && v != null) {
        var o = (s.options || []).filter(function (z) { return (("value" in z) ? z.value : z.label) === v; })[0];
        if (o) { if (o.score) score += o.score; if (o.crit) flag++; }
      } else if (s.type === "yesno" && v === true && s.scoreIfYes) { score += s.scoreIfYes; }
    });
    return { flag_rojo: flag, riesgo_score: score, cribado: flag >= 1 ? "Rojo" : (score >= 6 ? "Amarillo" : "Verde"), elegible: flag < 1 };
  }
};

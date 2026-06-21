/* Clynia — esquema del cuestionario de SALUD SEXUAL (masculina: disfunción eréctil y eyaculación precoz).
   Mismo motor (form-engine.js) y estilo que el cuestionario de peso.
   Bloque de paciente con campos REMPE. Cribado de seguridad para inhibidores de la PDE5
   (sildenafilo, tadalafilo): las contraindicaciones absolutas llevan a ending_rojo.
   Envía las respuestas al webhook de n8n. Categoría próximamente: la página NO está vinculada todavía.
   Contenido clínico pendiente de revisión por el equipo médico/legal. */
window.CLYNIA_FORM = {
  product: "Salud sexual",
  storeKey: "clynia_sexual_v1",
  webhook: "https://n8n-ixwg.srv1722506.hstgr.cloud/webhook/sexual-intake",

  steps: [
    { id: "welcome", type: "statement", q: "Cuéntanos tu caso", body: "Te haremos unas preguntas para que un médico colegiado valore si un tratamiento médico es adecuado para ti. Tardarás unos minutos. Es gratis y todo lo que nos cuentes es confidencial.", cta: "Empezar" },

    // ---------- BLOQUE PACIENTE (REMPE) ----------
    { id: "mayor_edad", section: "Sobre ti", type: "yesno", key: "mayor_edad", q: "Antes de empezar: ¿tienes 18 años o más?", next: function (a) { return a.mayor_edad === false ? "ending_menor" : null; } },
    { id: "nombre", section: "Sobre ti", type: "text", key: "nombre", q: "¿Cómo te llamas?", help: "Solo el nombre.", autocomplete: "given-name", placeholder: "Tu nombre" },
    { id: "primer_apellido", section: "Sobre ti", type: "text", key: "primer_apellido", q: "¿Cuál es tu primer apellido?", autocomplete: "family-name", placeholder: "Tu primer apellido" },
    { id: "segundo_apellido", section: "Sobre ti", type: "text", key: "segundo_apellido", q: "¿Y tu segundo apellido?", help: "Si solo tienes un apellido, deja este campo en blanco y continúa.", autocomplete: "off", placeholder: "Tu segundo apellido (opcional)", required: false },
    { id: "fecha_nacimiento", section: "Sobre ti", type: "date", key: "fecha_nacimiento", q: "¿Cuál es tu fecha de nacimiento?", next: function (a) { if (!a.fecha_nacimiento) return null; var d = new Date(a.fecha_nacimiento), t = new Date(), age = t.getFullYear() - d.getFullYear(), m = t.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--; return age < 18 ? "ending_menor" : null; } },
    { id: "sexo_biologico", section: "Sobre ti", type: "single", key: "sexo_biologico", q: "¿Cuál es tu sexo biológico?", help: "Lo necesita el médico para valorar el tratamiento y sus contraindicaciones.", options: [{ label: "Hombre", value: "Hombre" }, { label: "Mujer", value: "Mujer" }], next: function (a) { return a.sexo_biologico === "Mujer" ? "ending_sexo" : null; } },
    { id: "tipo_documento", section: "Sobre ti", type: "single", key: "tipo_documento", q: "¿Qué documento de identidad usarás?", help: "Pedimos estos datos para que un médico colegiado pueda emitir tu receta, solo si valora que el tratamiento es adecuado para ti.", options: [{ label: "DNI", value: "DNI" }, { label: "NIE", value: "NIE" }, { label: "Pasaporte", value: "Pasaporte" }] },
    { id: "num_documento", section: "Sobre ti", type: "text", key: "num_documento", q: "Número de tu documento", autocomplete: "off", placeholder: "Número de DNI/NIE/Pasaporte" },
    { id: "nacionalidad", section: "Sobre ti", type: "text", key: "nacionalidad", q: "¿Cuál es tu nacionalidad?", placeholder: "Tu nacionalidad" },
    { id: "email", section: "Sobre ti", type: "email", key: "email", q: "¿Cuál es tu correo electrónico?", help: "Te enviaremos aquí la confirmación y las indicaciones." },
    { id: "telefono", section: "Sobre ti", type: "tel", key: "telefono", q: "¿Y tu número de teléfono?", help: "El médico te llamará por aquí si necesita ampliar algún dato." },
    { id: "direccion", section: "Sobre ti", type: "text", key: "direccion", q: "¿Cuál es tu dirección postal?", help: "La necesitamos para poder emitir la receta médica, si el médico lo considera oportuno.", autocomplete: "address-line1", placeholder: "Tu calle y número" },
    { id: "codigo_postal", section: "Sobre ti", type: "text", key: "codigo_postal", q: "Código postal", autocomplete: "postal-code", placeholder: "Tu código postal" },
    { id: "localidad", section: "Sobre ti", type: "text", key: "localidad", q: "Localidad", autocomplete: "address-level2", placeholder: "Tu ciudad o población" },
    { id: "provincia", section: "Sobre ti", type: "text", key: "provincia", q: "Provincia", autocomplete: "address-level1", placeholder: "Tu provincia" },

    // ---------- MOTIVO DE CONSULTA ----------
    { id: "motivo", section: "Tu consulta", type: "single", key: "motivo", q: "¿Cuál es tu principal motivo de consulta?", options: [
      { label: "Dificultad para conseguir o mantener la erección" },
      { label: "Eyaculación precoz" },
      { label: "Falta de deseo sexual" },
      { label: "Varias de las anteriores" },
      { label: "Otra" }
    ] },
    { id: "motivo_otra", section: "Tu consulta", type: "longtext", key: "motivo_otra", q: "Cuéntanos un poco más", showIf: function (a) { return a.motivo === "Otra"; } },
    { id: "ed_duracion", section: "Tu consulta", type: "single", key: "ed_duracion", q: "¿Desde cuándo notas estas dificultades?", options: [{ label: "Menos de 3 meses" }, { label: "Entre 3 y 12 meses" }, { label: "Más de un año" }] },
    { id: "ed_frecuencia", section: "Tu consulta", type: "single", key: "ed_frecuencia", q: "En los últimos 6 meses, ¿con qué frecuencia has podido mantener una erección suficiente para la relación?", options: [{ label: "Casi siempre" }, { label: "La mayoría de las veces" }, { label: "Aproximadamente la mitad de las veces" }, { label: "Pocas veces" }, { label: "Casi nunca o nunca" }] },
    { id: "ed_inicio", section: "Tu consulta", type: "single", key: "ed_inicio", q: "¿Cómo empezó?", options: [{ label: "De forma gradual" }, { label: "De forma repentina" }] },
    { id: "ed_matutinas", section: "Tu consulta", type: "yesno", key: "ed_matutinas", q: "¿Tienes erecciones espontáneas, por ejemplo al despertar?" },

    // ---------- SEGURIDAD ----------
    { id: "intro_seguridad", type: "statement", q: "Ahora, unas preguntas de seguridad", body: "Sirven para valorar si un tratamiento para la erección (los llamados inhibidores de la PDE5, como sildenafilo o tadalafilo) es seguro en tu caso. Responde con tranquilidad.", cta: "Continuar" },
    { id: "nitratos", section: "Tu seguridad", type: "yesno", key: "nitratos", q: "¿Tomas nitratos o medicación para el corazón como nitroglicerina o mononitrato/dinitrato de isosorbida, o usas «poppers» (nitritos)?", help: "Importante: combinarlos con estos tratamientos puede ser peligroso.", next: function (a) { return a.nitratos === true ? "ending_rojo" : null; } },
    { id: "riociguat", section: "Tu seguridad", type: "yesno", key: "riociguat", q: "¿Tomas riociguat (Adempas) u otro medicamento para la hipertensión pulmonar?", next: function (a) { return a.riociguat === true ? "ending_rojo" : null; } },
    { id: "corazon", section: "Tu seguridad", type: "multi", key: "corazon", q: "¿Tienes o has tenido alguna de estas situaciones del corazón o la circulación?", help: "Marca todas las que apliquen.", options: [
      { label: "Infarto en los últimos 6 meses", crit: true },
      { label: "Ictus en los últimos 6 meses", crit: true },
      { label: "Angina inestable o dolor en el pecho al esfuerzo o durante el sexo", crit: true },
      { label: "Insuficiencia cardíaca grave", crit: true },
      { label: "Arritmia grave no controlada", crit: true },
      { label: "Tensión muy baja (hipotensión)", crit: true },
      { label: "Hipertensión", score: 1 },
      { label: "Angina estable controlada", score: 2 },
      { label: "Arritmia controlada", score: 1 },
      { label: "Ninguna de las anteriores", exclusive: true }
    ] },
    { id: "vista", section: "Tu seguridad", type: "multi", key: "vista", q: "¿Tienes o has tenido algún problema serio de visión?", options: [
      { label: "Pérdida brusca de visión en un ojo (neuropatía óptica)", crit: true },
      { label: "Retinitis pigmentosa", crit: true },
      { label: "Ninguno", exclusive: true }
    ] },
    { id: "otras_condiciones", section: "Tu seguridad", type: "multi", key: "otras_condiciones", q: "¿Alguna de estas condiciones de salud?", options: [
      { label: "Enfermedad del hígado grave (cirrosis)", crit: true },
      { label: "Enfermedad renal grave", score: 2 },
      { label: "Diabetes", score: 1 },
      { label: "Colesterol alto", score: 1 },
      { label: "Enfermedad de Peyronie o deformidad del pene", score: 1 },
      { label: "Priapismo previo (erección dolorosa de más de 4 horas)", score: 2 },
      { label: "Úlcera de estómago activa", score: 1 },
      { label: "Ninguna", exclusive: true }
    ] },
    { id: "tension", section: "Tu seguridad", type: "single", key: "tension", q: "¿Cuál es tu rango de tensión arterial?", options: [{ label: "Normal", value: "Normal" }, { label: "Algo elevada", value: "Elevada", score: 1 }, { label: "Alta y en tratamiento", value: "Alta tratada", score: 1 }, { label: "Alta sin controlar", value: "Alta sin controlar", score: 3 }, { label: "No lo sé", value: "NS" }] },
    { id: "alfa_bloqueantes", section: "Tu seguridad", type: "yesno", key: "alfa_bloqueantes", q: "¿Tomas alfa-bloqueantes para la próstata o la tensión (tamsulosina, doxazosina...)?", scoreIfYes: 2 },
    { id: "medicamentos_actuales", section: "Tu seguridad", type: "yesno", key: "medicamentos_actuales", q: "¿Tomas algún otro medicamento con receta de forma habitual?" },
    { id: "lista_medicamentos", section: "Tu seguridad", type: "longtext", key: "lista_medicamentos", q: "¿Cuáles?", help: "Indica nombre y dosis si los conoces.", showIf: function (a) { return a.medicamentos_actuales === true; } },
    { id: "alergia_tratamiento", section: "Tu seguridad", type: "yesno", key: "alergia_tratamiento", q: "¿Eres alérgico al sildenafilo, tadalafilo, vardenafilo o avanafilo?", next: function (a) { return a.alergia_tratamiento === true ? "ending_rojo" : null; } },
    { id: "tratamiento_previo", section: "Tu seguridad", type: "single", key: "tratamiento_previo", q: "¿Has tomado antes algún tratamiento para la erección?", options: [{ label: "Sí, y me fue bien", value: "Sí, bien" }, { label: "Sí, pero no me fue bien o tuve efectos", value: "Sí, con problemas" }, { label: "No, nunca", value: "No" }] },
    { id: "tratamiento_previo_detalle", section: "Tu seguridad", type: "longtext", key: "tratamiento_previo_detalle", q: "Cuéntanos cuál y cómo te fue", showIf: function (a) { return a.tratamiento_previo && a.tratamiento_previo.indexOf("Sí") === 0; } },

    // ---------- ESTILO DE VIDA ----------
    { id: "tabaquismo", section: "Estilo de vida", type: "single", key: "tabaquismo", q: "¿Fumas?", options: [{ label: "No fumo ni he fumado", value: "No" }, { label: "Exfumador", value: "Ex" }, { label: "Fumador", value: "Fumador", score: 1 }] },
    { id: "alcohol", section: "Estilo de vida", type: "single", key: "alcohol", q: "¿Consumes alcohol?", options: [{ label: "No consumo", value: "No" }, { label: "Ocasional", value: "Ocasional" }, { label: "Habitual (semanal)", value: "Habitual", score: 1 }, { label: "Diario", value: "Diario", score: 2 }] },
    { id: "drogas", section: "Estilo de vida", type: "yesno", key: "drogas", q: "¿Consumes drogas recreativas?", help: "Es relevante por posibles interacciones, y es confidencial.", scoreIfYes: 1 },
    { id: "estado_animo", section: "Estilo de vida", type: "single", key: "estado_animo", q: "¿Cómo dirías que están tu ánimo y tu nivel de estrés últimamente?", options: [{ label: "Bien" }, { label: "Algo estresado o decaído" }, { label: "Bastante ansioso o deprimido" }] },
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
    { id: "ending_sexo", type: "ending", variant: "stop", q: "De momento, este servicio está enfocado en la salud sexual masculina", body: "Estamos preparando la atención de salud sexual femenina. Si quieres que te avisemos cuando esté disponible, escríbenos a clynia@clynia.es. Gracias por tu interés.", cta: "Volver a Clynia", href: "/" },
    { id: "ending_rojo", type: "ending", variant: "stop", q: "Por tu seguridad, esto debe valorarlo un médico en persona", body: "Según lo que nos has contado, un tratamiento online no es lo más adecuado para ti ahora mismo. Te recomendamos acudir a tu médico de cabecera o a un especialista de forma presencial. Si quieres que te orientemos, escríbenos a clynia@clynia.es.", cta: "Volver a Clynia", href: "/" }
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

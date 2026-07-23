/* Clynia — esquema del cuestionario de PÉRDIDA DE PESO.
   Modelo CONSULTA GRATIS PRIMERO (2026-07-22): la parte 1 es una consulta médica gratuita
   (datos mínimos + cribado de seguridad + la pregunta libre del paciente). Se envía a
   consulta-intake, que crea el Caso Tipo=Consulta y un médico colegiado lo revisa sin coste.
   NO hay pago en la web pública. El cuestionario clínico profundo + REMPE se conserva como
   PARTE 2 (modo ?p2=<intakeId>), al que solo llega el apto tras el OK del médico (enlace del
   email/portal). El motor (form-engine.js) decide el modo; el corte es el paso con id F.p2StartId.
   La parte 1 va al webhook (consulta-intake, fase='parte1') y la parte 2 a part2Webhook
   (peso-intake-parte2), que funde por intakeId y pasa el Tipo de Consulta a Intake. */
window.CLYNIA_FORM = {
  product: "Pérdida de peso",
  storeKey: "clynia_peso_v1",
  // CONSULTA GRATIS (parte 1, flujo por defecto): las respuestas van a consulta-intake, que crea el
  // Caso Tipo=Consulta (Estado pago=Pendiente, Importe 0, sin médico) y dispara el Lead de Meta. NO
  // hay pago aquí: la primera consulta es gratuita; el pago del plan llega después, ya como apto.
  webhook: "https://n8n-ixwg.srv1722506.hstgr.cloud/webhook/consulta-intake",

  // Captura temprana de contacto: en cuanto tenemos email + consentimiento, guardamos un lead
  // parcial (webhook n8n -> Airtable "Leads parciales (peso)") para no perder a quien empieza y
  // no termina. No bloquea ni sustituye el intake final. Ver assets/js/form-engine.js (sendPartial).
  leadWebhook: "https://n8n-ixwg.srv1722506.hstgr.cloud/webhook/peso-lead-parcial",

  // Cuando el cribado sale rojo (o resulta no apto: menor de edad), avisamos a n8n para marcar
  // ese lead parcial como "Descartado". Así sale del drip de recuperación (que solo escribe a
  // Estado='Parcial') y deja de contar como lead no convertido en el embudo. Mismo Airtable,
  // upsert por email, sin CAPI. Ver assets/js/form-engine.js (sendDiscard).
  discardWebhook: "https://n8n-ixwg.srv1722506.hstgr.cloud/webhook/peso-lead-descartar",

  // FORMULARIO PROFUNDO (parte 2, modo ?p2=<intakeId>): el apto, tras el OK del médico, completa su
  // cuestionario clínico + REMPE. Se envía aquí y n8n lo funde con el MISMO caso (merge por intakeId),
  // pasa el Tipo de Consulta a Intake y prepara la receta. Solo se entra con ?p2= (enlace del email o
  // portal del apto) o con el marker de pagado. Ver form-engine.js (finishP2). part2Webhook y p2StartId
  // habilitan ese modo profundo; el flujo de consulta (parte 1) NUNCA los recorre.
  part2Webhook: "https://n8n-ixwg.srv1722506.hstgr.cloud/webhook/peso-intake-parte2",
  p2StartId: "p2_welcome",

  // PAGO DEL APTO (modo ?pay=<casoId>): tras el OK del médico, el apto elige plan y paga ANTES de
  // la parte 2. El motor entra en modo pago por ?pay=, arranca en payStartId (paso de planes) con el
  // casoId sembrado, y finish() postea {casoId, email, tipo_caso} a checkoutEndpoint (crear-checkout),
  // que devuelve la URL de Stripe. La PARTE 1 (consulta gratis) NUNCA fija answers.plan, así que
  // finish() cae en payViaLink sin plan -> ending_ok, sin cobrar: checkoutEndpoint/plans solo se
  // activan cuando hay plan elegido, y al paso 'plans' solo se llega en modo pago.
  checkoutEndpoint: "https://n8n-ixwg.srv1722506.hstgr.cloud/webhook/crear-checkout",
  payStartId: "plans",
  // pago = Payment Link de Stripe (respaldo si crear-checkout falla). id = clave que 'Mapear plan a
  // price' (n8n · Crear Checkout Session) mapea a priceId: valoracion|plan4|plan12. No renombrar los
  // id sin tocar ese nodo. (nombre/precio/desc son solo presentación y se pueden cambiar libremente.)
  plans: [
    { id: "valoracion", nombre: "Plan 1 mes", precio: 99, meta: "1 mes de seguimiento", pago: "https://buy.stripe.com/fZueVf0Jb18m2u459XfEk02", desc: "Valoración por un médico colegiado y acompañamiento durante tu primer mes de tratamiento." },
    { id: "plan4", nombre: "Plan 4 meses", precio: 299, meta: "menos de 75 €/mes", tag: "Más popular · Ahorras 25%", featured: true, pago: "https://buy.stripe.com/fZueVffE518m2u4fOBfEk03", desc: "Valoración + seguimiento y comunicación con tu equipo médico durante 4 meses." },
    { id: "plan12", nombre: "Plan 12 meses", precio: 890, meta: "menos de 75 €/mes · Ahorras 25%", pago: "https://buy.stripe.com/aFa7sN0JbaIW7Oo45TfEk04", desc: "Acompañamiento médico completo durante todo el año." }
  ],

  steps: [
    // ═══════════ PARTE 1 (pre-pago, mínima) ═══════════
    { id: "welcome", type: "statement", q: "Cuéntale tu caso al médico", body: "Unas preguntas rápidas (2 minutos). Con tus respuestas, un médico colegiado en España valorará tu caso de forma gratuita. La primera consulta no tiene coste: solo si el médico te considera candidato te propondrá un plan de tratamiento.", cta: "Empezar" },
    { id: "nacimiento", section: "Sobre ti", type: "date", key: "fecha_nacimiento", q: "¿Cuál es tu fecha de nacimiento?", help: "El médico la necesita para valorar tu caso con seguridad. Este servicio es solo para mayores de 18 años.", next: function (a) { if (!a.fecha_nacimiento) return null; var d = new Date(a.fecha_nacimiento), t = new Date(), age = t.getFullYear() - d.getFullYear(), m = t.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--; return age < 18 ? "ending_menor" : null; } },
    { id: "nombre", section: "Sobre ti", type: "text", key: "nombre", q: "¿Cómo te llamas?", help: "Solo el nombre.", autocomplete: "given-name", placeholder: "Tu nombre" },
    // Email + consentimiento PRONTO: así, aunque no termines, podemos guardar tu solicitud y
    // retomarla contigo (lead parcial). El consentimiento va antes de pedirte datos de salud.
    { id: "email", section: "Sobre ti", type: "email", key: "email", q: "¿Cuál es tu correo electrónico?", help: "Aquí te enviamos la confirmación y guardamos tu solicitud, para que puedas retomarla si no la terminas ahora." },
    { id: "consent", section: "Sobre ti", type: "consent", key: "consent", q: "Antes de seguir: tus datos, protegidos", help: "Con tu permiso guardamos tu solicitud para que un médico colegiado pueda valorarla, y podrás retomarla cuando quieras.", cta: "Acepto y continúo", items: [
      { key: "acepta_privacidad", required: true, label: 'He leído y acepto la <a href="privacidad" target="_blank">Política de Privacidad</a> de Clynia.' },
      { key: "acepta_datos_salud", required: true, label: "Doy mi consentimiento explícito al tratamiento de mis datos de salud con fines asistenciales." },
      { key: "acepta_acto_medico", required: true, label: "Consiento que un médico colegiado valore mi caso por telemedicina (comunicación no presencial), como acto médico individualizado." },
      { key: "acepta_comercial", required: false, label: "Quiero recibir comunicaciones de Clynia sobre mi solicitud y novedades." }
    ] },
    { id: "altura", section: "Tu objetivo", type: "number", key: "altura", q: "¿Cuál es tu altura?", unit: "cm", min: 100, max: 250 },
    { id: "peso_actual", section: "Tu objetivo", type: "number", key: "peso_actual", q: "¿Cuál es tu peso actual?", unit: "kg", min: 30, max: 400 },
    { id: "peso_objetivo", section: "Tu objetivo", type: "number", key: "peso_objetivo", q: "¿Cuál es tu peso objetivo?", unit: "kg", min: 30, max: 400 },
    {
      id: "ritmo", section: "Tu objetivo", type: "single", key: "ritmo",
      q: "Tu punto de partida",
      visual: function (a, v) {
        var imc = v.imc;
        var z = !imc ? { t: "", c: "#4f9e7f" } : imc < 18.5 ? { t: "Bajo peso", c: "#5b8fb0" } : imc < 25 ? { t: "Normopeso", c: "#4f9e7f" } : imc < 30 ? { t: "Sobrepeso", c: "#c89b4a" } : imc < 35 ? { t: "Obesidad grado I", c: "#cf8a4e" } : imc < 40 ? { t: "Obesidad grado II", c: "#cf6a5e" } : { t: "Obesidad grado III", c: "#c0524a" };
        var pos = imc ? Math.max(3, Math.min(97, (imc - 15) / 25 * 100)) : 50;
        var imcCard = imc ? (''
          + '<div class="cq__card">'
          + '<div class="cq__imc-top"><span class="cq__imc-label">Tu IMC</span><span class="cq__badge" style="background:' + z.c + '1f;color:' + z.c + '">' + z.t + '</span></div>'
          + '<div class="cq__imc-num">' + String(imc).replace(".", ",") + '</div>'
          + '<div class="cq__gauge"><i style="left:' + pos + '%"></i></div>'
          + '<div class="cq__gauge-scale"><span>18,5</span><span>25</span><span>30</span><span>40</span></div>'
          + '</div>') : "";
        return '<div class="cq__viz">' + imcCard + '<p class="cq__weeks">El IMC es solo una referencia orientativa. Un médico colegiado valorará tu caso completo y decidirá contigo el enfoque adecuado a tu ritmo.</p><p class="cq__ratehead">¿A qué ritmo te gustaría enfocarlo?</p></div>';
      },
      options: [{ label: "Un ritmo saludable y sostenible", value: "Bien" }, { label: "Cuanto antes, si es seguro", value: "Más rápido" }, { label: "Con calma, sin prisa", value: "Más lento" }]
    },

    // Cribado de seguridad (las ÚNICAS preguntas que descartan): siempre ANTES del pago,
    // para que un rojo no pueda pagar jamás. Una crítica marcada corta en el acto (next).
    { id: "sexo_biologico", section: "Seguridad", type: "single", key: "sexo_biologico", q: "¿Cuál es tu sexo biológico?", help: "Lo necesita el médico para valorar dosis y contraindicaciones.", options: [{ label: "Hombre", value: "Hombre" }, { label: "Mujer", value: "Mujer" }, { label: "Prefiero no decirlo", value: "Prefiero no decirlo" }] },
    { id: "embarazo", section: "Seguridad", type: "multi", key: "embarazo", next: function (a, v) { return v.flag_rojo >= 1 ? "ending_rojo" : null; }, q: "¿Alguna de estas situaciones te aplica?", showIf: function (a) { return a.sexo_biologico === "Mujer" || a.sexo_biologico === "Prefiero no decirlo"; }, options: [{ label: "Estoy embarazada o podría estarlo", crit: true }, { label: "Estoy dando el pecho", crit: true }, { label: "He dado a luz en los últimos 6 meses" }, { label: "Ninguna de las anteriores", exclusive: true }] },
    { id: "contraindicaciones", section: "Seguridad", type: "multi", key: "contraindicaciones", next: function (a, v) { return v.flag_rojo >= 1 ? "ending_rojo" : null; }, q: "¿Tienes o has tenido alguna de estas condiciones?", help: "Marca todas las que apliquen.", options: [
      { label: "Cáncer medular de tiroides o MEN2", crit: true },
      { label: "Pancreatitis (aguda o crónica)", crit: true },
      { label: "Gastroparesia", crit: true },
      { label: "Enfermedad gastrointestinal grave", crit: true },
      { label: "Enfermedad renal terminal (diálisis)", crit: true },
      { label: "Enfermedad hepática terminal (cirrosis)", crit: true },
      { label: "Cáncer activo en tratamiento", crit: true },
      { label: "Trastorno de la conducta alimentaria", crit: true },
      { label: "Dependencia de alcohol u opiáceos", crit: true },
      { label: "Pensamientos suicidas o intentos previos", crit: true },
      { label: "Reacción alérgica a medicación inyectable para el peso", crit: true },
      { label: "Ninguna de las anteriores", exclusive: true }
    ] },

    // ---------- CRIBADO + CONSULTA (cierre de la consulta gratis) ----------
    // gate_triage: última malla de seguridad (redundante con los next de embarazo/contraindicaciones).
    // Un rojo corta a ending_rojo; si no, pasa a la pregunta libre y de ahí al envío (consulta-intake).
    { id: "gate_triage", type: "gate", route: function (a, v) { return v.flag_rojo >= 1 ? "ending_rojo" : "consulta"; } },
    { id: "consulta", section: "Tu consulta", type: "longtext", key: "consulta", submit: true, q: "¿Qué quieres consultar al médico?", help: "Cuéntanos solo lo relevante para tu caso: tu objetivo, desde cuándo te preocupa, qué has probado antes y cualquier duda para el médico. No hace falta que incluyas datos que no vengan al caso.", placeholder: "Escribe aquí tu consulta para el médico", cta: "Enviar mi consulta" },

    // ---------- PLANES (solo modo pago ?pay=): el apto elige plan -> finish() -> checkoutEndpoint ----------
    // La parte 1 NUNCA llega aquí: el paso 'consulta' cierra con submit (finish -> ending_ok). A este
    // paso solo se entra por payStartId en modo pago. Sin claim de garantía de devolución (pendiente
    // de revisión legal farma); reactivar el bloque de garantía solo con el OK del abogado.
    { id: "plans", section: "Elige tu plan", type: "plans", key: "plan", q: "Elige tu plan para empezar tu tratamiento", help: "<span style=\"display:block;color:var(--muted);font-size:.9em;text-align:left;line-height:1.4\">No pagas el medicamento aquí; si el médico te lo receta, lo compras en tu farmacia con tu receta.<br>Médicos colegiados en España · Pago seguro con Stripe · Datos cifrados.</span>", cta: "Continuar al pago" },

    // ═══════════ PARTE 2 (post-pago: el resto del cuestionario) ═══════════
    { id: "p2_welcome", type: "statement", q: "El médico ha revisado tu consulta. Ahora, tu cuestionario clínico", body: "Estas respuestas son las que usará tu médico para preparar, si procede, tu tratamiento y tu receta. Tardarás unos 5 minutos y puedes retomarlo cuando quieras: guardamos tu progreso en este dispositivo y tienes el enlace en tu correo.", cta: "Empezar" },

    // ---------- BLOQUE CLÍNICO (resto) ----------
    { id: "peso_maximo", section: "Cuestionario clínico", type: "number", key: "peso_maximo", q: "¿Cuál ha sido tu peso máximo en la edad adulta?", unit: "kg", min: 30, max: 400 },
    { id: "anos_peso_maximo", section: "Cuestionario clínico", type: "number", key: "anos_peso_maximo", q: "¿Hace cuántos años?", unit: "años", min: 0, max: 80 },
    { id: "puede_cintura", section: "Cuestionario clínico", type: "yesno", key: "puede_cintura", q: "¿Puedes medirte ahora el perímetro de cintura?", help: "Mídela a la altura del ombligo, sin apretar." },
    { id: "cintura", section: "Cuestionario clínico", type: "number", key: "cintura", q: "¿Cuánto mide tu cintura?", unit: "cm", min: 40, max: 250, showIf: function (a) { return a.puede_cintura === true; } },
    { id: "metodos_previos", section: "Cuestionario clínico", type: "longtext", key: "metodos_previos", q: "¿Qué has intentado antes para perder peso?", help: "Cuéntanoslo con tus palabras." },
    { id: "historia_familiar", section: "Tu historia clínica", type: "multi", key: "historia_familiar", q: "Historia familiar de enfermedades metabólicas", help: "Marca lo que aplique a familiares directos.", options: [{ label: "Sobrepeso u obesidad" }, { label: "Diabetes tipo 2" }, { label: "Hipertensión arterial" }, { label: "Colesterol alto" }, { label: "Cardiopatía (infarto, angina)" }, { label: "Ictus" }, { label: "Hígado graso" }, { label: "SOP" }, { label: "Hipotiroidismo" }, { label: "Otras" }, { label: "Ninguna", exclusive: true }] },
    { id: "historia_familiar_otras", section: "Tu historia clínica", type: "longtext", key: "historia_familiar_otras", q: "Especifica cuáles", showIf: function (a) { return (a.historia_familiar || []).indexOf("Otras") > -1; } },
    { id: "cardiometabolicas", section: "Tu historia clínica", type: "multi", key: "cardiometabolicas", q: "¿Alguna condición cardiometabólica?", options: [
      { label: "Hipertensión arterial" },
      { label: "Diabetes tipo 1", score: 2 },
      { label: "Diabetes tipo 2", score: 1 },
      { label: "Colesterol o triglicéridos altos", score: 2 },
      { label: "Infarto o ictus en los últimos 2 años", score: 4 },
      { label: "Insuficiencia cardíaca", score: 3 },
      { label: "Arritmia", score: 2 },
      { label: "Taquicardia", score: 2 },
      { label: "Apnea del sueño", score: 1 },
      { label: "Hígado graso (no cirrosis)", score: 1 },
      { label: "Enfermedad renal (no terminal)", score: 1 },
      { label: "Enfermedad hepática (no terminal)", score: 1 },
      { label: "SOP" }, { label: "Hipotiroidismo no tratado" }, { label: "Otra" },
      { label: "Ninguna", exclusive: true }
    ] },
    { id: "usa_insulina", section: "Tu historia clínica", type: "single", key: "usa_insulina", q: "¿Usas insulina actualmente?", showIf: function (a) { return (a.cardiometabolicas || []).some(function (x) { return x.indexOf("Diabetes") > -1; }); }, options: [{ label: "Sí", value: "Sí" }, { label: "No", value: "No" }] },
    { id: "otra_cardiometabolica", section: "Tu historia clínica", type: "longtext", key: "otra_cardiometabolica", q: "¿Qué otra condición cardiometabólica?", showIf: function (a) { return (a.cardiometabolicas || []).indexOf("Otra") > -1; } },
    { id: "otras_condiciones", section: "Tu historia clínica", type: "multi", key: "otras_condiciones", q: "¿Otras condiciones de salud?", options: [
      { label: "Vesícula biliar", score: 1 }, { label: "Reflujo" }, { label: "Estreñimiento crónico" }, { label: "Asma" },
      { label: "Epilepsia", score: 3 }, { label: "Traumatismo craneal", score: 3 }, { label: "Tumor o infección cerebral", score: 3 },
      { label: "Glaucoma", score: 1 }, { label: "Hiponatremia", score: 3 }, { label: "Depresión", score: 1 },
      { label: "Artrosis" }, { label: "Incontinencia urinaria" }, { label: "VIH" }, { label: "Ninguna", exclusive: true }
    ] },
    { id: "anticoagulantes", section: "Tu historia clínica", type: "yesno", key: "anticoagulantes", q: "¿Tomas algún anticoagulante?", help: "Sintrom, Eliquis, Xarelto, Pradaxa...", scoreIfYes: 2 },
    { id: "alergia_medicamentos", section: "Tu historia clínica", type: "yesno", key: "alergia_medicamentos", q: "¿Tienes alergia a algún medicamento?", scoreIfYes: 1 },
    { id: "lista_alergias", section: "Tu historia clínica", type: "longtext", key: "lista_alergias", q: "¿A cuál o cuáles?", showIf: function (a) { return a.alergia_medicamentos === true; } },
    { id: "hospitalizacion", section: "Tu historia clínica", type: "yesno", key: "hospitalizacion", q: "¿Has estado hospitalizado/a en el último año?", scoreIfYes: 2 },
    { id: "motivo_hospitalizacion", section: "Tu historia clínica", type: "longtext", key: "motivo_hospitalizacion", q: "¿Por qué motivo?", showIf: function (a) { return a.hospitalizacion === true; } },

    { id: "tabaquismo", section: "Estilo de vida", type: "single", key: "tabaquismo", q: "¿Fumas?", options: [{ label: "No fumo ni he fumado", value: "No" }, { label: "Exfumador/a", value: "Ex" }, { label: "Fumador/a", value: "Fumador", score: 1 }] },
    { id: "alcohol", section: "Estilo de vida", type: "single", key: "alcohol", q: "¿Consumes alcohol?", options: [{ label: "No consumo", value: "No" }, { label: "Ocasional (eventos sociales)", value: "Ocasional" }, { label: "Habitual (semanal)", value: "Habitual", score: 1 }, { label: "Diario", value: "Diario", score: 2 }] },
    { id: "opioides", section: "Estilo de vida", type: "yesno", key: "opioides", q: "¿Has tomado opioides recetados en los últimos 3 meses?", scoreIfYes: 2 },
    { id: "cirugia_bariatrica", section: "Estilo de vida", type: "yesno", key: "cirugia_bariatrica", q: "¿Te han hecho una cirugía bariátrica?", scoreIfYes: 2 },
    { id: "tiempo_cirugia", section: "Estilo de vida", type: "single", key: "tiempo_cirugia", q: "¿Hace cuánto fue la cirugía?", showIf: function (a) { return a.cirugia_bariatrica === true; }, options: [{ label: "Menos de 6 meses", value: "<6m" }, { label: "Entre 6 meses y 2 años", value: "6m-2a" }, { label: "Entre 2 y 5 años", value: "2-5a" }, { label: "Más de 5 años", value: ">5a" }] },
    { id: "medicamentos_receta", section: "Estilo de vida", type: "yesno", key: "medicamentos_receta", q: "¿Tomas medicamentos con receta actualmente?" },
    { id: "lista_medicamentos", section: "Estilo de vida", type: "longtext", key: "lista_medicamentos", q: "¿Cuáles?", showIf: function (a) { return a.medicamentos_receta === true; } },
    { id: "suplementos", section: "Estilo de vida", type: "yesno", key: "suplementos", q: "¿Tomas suplementos de farmacia o parafarmacia?" },
    { id: "lista_suplementos", section: "Estilo de vida", type: "longtext", key: "lista_suplementos", q: "¿Cuáles?", showIf: function (a) { return a.suplementos === true; } },
    { id: "presion", section: "Estilo de vida", type: "single", key: "presion", q: "¿Cuál es tu rango de presión arterial?", options: [{ label: "Normal (menos de 120/80)", value: "Normal" }, { label: "Elevada (120-129 / menos de 80)", value: "Elevada" }, { label: "HTA grado 1 (130-139 / 80-89)", value: "HTA1", score: 2 }, { label: "HTA grado 2 (140/90 o más)", value: "HTA2", score: 4 }, { label: "No lo sé", value: "NS", score: 1 }] },
    { id: "frecuencia_cardiaca", section: "Estilo de vida", type: "single", key: "frecuencia_cardiaca", q: "¿Cuál es tu frecuencia cardíaca en reposo?", options: [{ label: "Baja (menos de 60)", value: "Baja" }, { label: "Normal (60-100)", value: "Normal" }, { label: "Ligeramente elevada (101-110)", value: "Lig", score: 1 }, { label: "Alta (más de 110)", value: "Alta", score: 3 }, { label: "No lo sé", value: "NS" }] },
    { id: "medicacion_previa", section: "Estilo de vida", type: "single", key: "medicacion_previa", q: "¿Has tomado medicación para adelgazar antes?", options: [{ label: "Sí, GLP-1 (Ozempic, Wegovy, Saxenda...)", value: "GLP1" }, { label: "Sí, otra medicación", value: "Otra" }, { label: "No", value: "No" }] },
    { id: "nombre_dosis_previa", section: "Estilo de vida", type: "longtext", key: "nombre_dosis_previa", q: "Indica el nombre, dosis y frecuencia", showIf: function (a) { return a.medicacion_previa && a.medicacion_previa !== "No"; } },
    { id: "ultima_dosis", section: "Estilo de vida", type: "single", key: "ultima_dosis", q: "¿Cuándo fue tu última dosis?", showIf: function (a) { return a.medicacion_previa && a.medicacion_previa !== "No"; }, options: [{ label: "Hace 0-5 días" }, { label: "6-10 días" }, { label: "11-14 días" }, { label: "Entre 2 y 4 semanas" }, { label: "Más de 4 semanas" }] },
    { id: "nauseas", section: "Estilo de vida", type: "yesno", key: "nauseas", q: "¿Sufres habitualmente náuseas, acidez o estreñimiento?" },
    { id: "fuerza", section: "Estilo de vida", type: "single", key: "fuerza", q: "¿Cuántos días a la semana entrenas fuerza?", options: [{ label: "Ninguno" }, { label: "De 1 a 3" }, { label: "4 o más" }] },
    { id: "proteinas", section: "Estilo de vida", type: "single", key: "proteinas", q: "¿Cómo es tu consumo de proteínas?", options: [{ label: "Bajo" }, { label: "Medio" }, { label: "Alto" }] },
    { id: "programa_previo", section: "Estilo de vida", type: "yesno", key: "programa_previo", q: "¿Has participado en algún programa de control de peso?", help: "PronoKal, WeightWatchers, Naturhouse..." },
    { id: "nombre_programa", section: "Estilo de vida", type: "longtext", key: "nombre_programa", q: "¿Cuál?", showIf: function (a) { return a.programa_previo === true; } },
    { id: "analitica", section: "Estilo de vida", type: "file", key: "analitica", q: "¿Tienes una analítica de sangre reciente?", help: "Opcional. Si la tienes (últimos 3-6 meses), súbela y ayudarás al médico.", cta2: "Subir analítica", required: false },
    { id: "objetivo", section: "Casi listo", type: "single", key: "objetivo", q: "¿Qué quieres conseguir con Clynia?", options: [{ label: "Mejorar mi composición corporal" }, { label: "Mejorar mi metabolismo" }, { label: "Reducir dolor articular" }, { label: "Tener más energía" }, { label: "Dormir mejor" }, { label: "Longevidad" }, { label: "No lo sé, me gustaría consultarlo" }] },
    { id: "preferencia", section: "Casi listo", type: "single", key: "preferencia", q: "¿Tienes preferencia de tratamiento?", options: [{ label: "Prefiero no inyectarme" }, { label: "Me da igual" }] },
    { id: "algo_mas", section: "Casi listo", type: "yesno", key: "algo_mas", q: "¿Hay algo más que quieras decirle al equipo médico?" },
    { id: "mensaje_equipo", section: "Casi listo", type: "longtext", key: "mensaje_equipo", q: "Cuéntanoslo", showIf: function (a) { return a.algo_mas === true; } },

    // ---------- DATOS PARA LA RECETA (REMPE) ----------
    { id: "p2_identidad", type: "statement", q: "Últimos datos: para tu receta", body: "Si el médico valora que el tratamiento es adecuado, estos datos son obligatorios para poder emitir tu receta médica (sistema REMPE). Son los últimos.", cta: "Continuar" },
    { id: "primer_apellido", section: "Para tu receta", type: "text", key: "primer_apellido", q: "¿Cuál es tu primer apellido?", autocomplete: "family-name", placeholder: "Tu primer apellido", errMsg: "Necesitamos tu primer apellido." },
    { id: "segundo_apellido", section: "Para tu receta", type: "text", key: "segundo_apellido", q: "¿Y tu segundo apellido?", help: "Si solo tienes un apellido, deja este campo en blanco y continúa.", autocomplete: "off", placeholder: "Tu segundo apellido (opcional)", required: false },
    { id: "fecha_nacimiento", section: "Para tu receta", type: "date", key: "fecha_nacimiento", showIf: function (a) { return !a.fecha_nacimiento; }, q: "¿Cuál es tu fecha de nacimiento?", next: function (a) { if (!a.fecha_nacimiento) return null; var d = new Date(a.fecha_nacimiento), t = new Date(), age = t.getFullYear() - d.getFullYear(), m = t.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--; return age < 18 ? "ending_menor" : null; } },
    { id: "tipo_documento", section: "Para tu receta", type: "single", key: "tipo_documento", q: "¿Qué documento de identidad usarás?", help: "Lo exige el sistema de receta médica (REMPE).", options: [{ label: "DNI", value: "DNI" }, { label: "NIE", value: "NIE" }, { label: "Pasaporte", value: "Pasaporte" }] },
    { id: "num_documento", section: "Para tu receta", type: "text", key: "num_documento", q: "Número de tu documento", autocomplete: "off", placeholder: "Número de DNI/NIE/Pasaporte" },
    { id: "nacionalidad", section: "Para tu receta", type: "text", key: "nacionalidad", q: "¿Cuál es tu nacionalidad?", placeholder: "Tu nacionalidad" },
    { id: "telefono", section: "Para tu receta", type: "tel", key: "telefono", q: "¿Y tu número de teléfono?", help: "El médico te llamará por aquí si necesita ampliar algún dato." },
    { id: "direccion", section: "Para tu receta", type: "text", key: "direccion", q: "¿Cuál es tu dirección postal?", autocomplete: "address-line1", placeholder: "Tu calle y número" },
    { id: "codigo_postal", section: "Para tu receta", type: "text", key: "codigo_postal", q: "Código postal", autocomplete: "postal-code", placeholder: "Tu código postal" },
    { id: "localidad", section: "Para tu receta", type: "text", key: "localidad", q: "Localidad", autocomplete: "address-level2", placeholder: "Tu ciudad o población" },
    { id: "provincia", section: "Para tu receta", type: "text", key: "provincia", q: "Provincia", autocomplete: "address-level1", placeholder: "Tu provincia" },
    { id: "p2_send", type: "statement", submitP2: true, q: "Todo listo para tu médico", body: "Al enviar, tu cuestionario completo pasa a un médico colegiado para su valoración. Te escribiremos por email con los siguientes pasos.", cta: "Enviar mi cuestionario" },

    // ---------- FINALES ----------
    { id: "ending_ok", type: "ending", variant: "ok", q: "¡Gracias! Tu consulta ya está con un médico", badge: "No tienes que hacer nada más", body: "Te contactamos nosotros. Esto es lo que pasa a partir de ahora:", steps: [{ t: "Consulta recibida", d: "Ya la tenemos guardada y en la cola de revisión médica.", done: true }, { t: "Un médico colegiado la revisa", d: "Mira tu caso con calma, sin cita previa y sin salas de espera.", icon: "medico" }, { t: "Te escribe por email", d: "Normalmente en menos de 24 horas. Si un tratamiento es adecuado para ti, te lo indicará y decides entonces si quieres continuar.", icon: "email" }], ctaNote: "Mientras tanto, en nuestro blog contamos cómo cuidar tu peso con criterio médico, sin milagros ni atajos.", cta: "Ver artículos del blog", href: "/blog" },
    { id: "ending_p2_ok", type: "ending", variant: "ok", q: "Cuestionario enviado. Ya está todo en marcha", body: "Un médico colegiado revisará tu caso y te contactará por email. Es muy probable que te llame por teléfono para conocerte mejor: mantén el móvil a mano estos días. Puedes seguir tu caso desde tu portal.", cta: "Ir a mi portal", href: "https://portal.clynia.es" },
    { id: "ending_menor", type: "ending", variant: "stop", q: "Este servicio es solo para mayores de 18 años", body: "Por ahora solo podemos atender a personas mayores de edad. Si te has equivocado con la fecha, vuelve atrás y corrígela.", href: "perdida-de-peso" },
    { id: "ending_rojo", type: "ending", variant: "stop", q: "Por tu seguridad, esto debe valorarlo un médico en persona", body: "Según lo que nos has contado, el tratamiento online no es lo más adecuado para ti ahora mismo. Te recomendamos acudir a tu médico de cabecera o a un centro de forma presencial para una valoración. Hemos guardado tus respuestas: si quieres que te orientemos, escríbenos a clynia@clynia.es.", cta: "Volver a Clynia", href: "perdida-de-peso" }
  ],

  // Valida el número de documento contra el tipo elegido. Suave: solo bloquea lo claramente
  // inválido. Devuelve { ok: bool }. NUNCA aplica el dígito de control del DNI/NIE a un
  // pasaporte ni a tipos desconocidos: los documentos extranjeros no tienen ese control.
  validarDocumento: function (tipo, num) {
    // Si aún no hay tipo, no bloqueamos (el paso de tipo va antes; por si acaso).
    if (!tipo) return { ok: true };
    var n = String(num == null ? "" : num).toUpperCase().replace(/[\s-]/g, "").trim();
    if (n === "") return { ok: true }; // el "requerido" ya lo cubre la validación base
    var CONTROL = "TRWAGMYFPDXBNJZSQVHLCKE";
    if (tipo === "DNI") {
      if (!/^[0-9]{8}[A-Z]$/.test(n)) return { ok: false };
      return { ok: n.charAt(8) === CONTROL.charAt(parseInt(n.substring(0, 8), 10) % 23) };
    }
    if (tipo === "NIE") {
      if (!/^[XYZ][0-9]{7}[A-Z]$/.test(n)) return { ok: false };
      var pre = { X: "0", Y: "1", Z: "2" }[n.charAt(0)];
      var num8 = parseInt(pre + n.substring(1, 8), 10);
      return { ok: n.charAt(8) === CONTROL.charAt(num8 % 23) };
    }
    // Pasaporte y cualquier otro tipo desconocido: solo plausibilidad, sin dígito de control.
    return { ok: /^[A-Z0-9]{5,20}$/.test(n) };
  },

  // Cribado del CLIENTE (UX): decide el corte por crítica (flag_rojo) y el color orientativo.
  // SET CRÍTICO CANÓNICO (corta a ending_rojo con flag_rojo>=1): embarazo/lactancia +
  //   las 11 contraindicaciones GLP-1 (cáncer medular de tiroides/MEN2, pancreatitis, gastroparesia,
  //   enf. GI grave, ERC terminal/diálisis, hepatopatía terminal/cirrosis, cáncer activo, TCA,
  //   dependencia alcohol/opiáceos, ideación/intentos suicidas, alergia a GLP-1). Todas van con crit:true.
  // SINCRONIZAR SIEMPRE LAS 3 COPIAS del set crítico y de los pesos (score) en la MISMA sesión:
  //   1) aquí (computeVars) + los crit:true de los pasos embarazo/contraindicaciones,
  //   2) n8n: 'Clynia · Consulta gratis' (webhook consulta-intake) recalcula el cribado de la consulta
  //      gratis y marca Descartado en rojo; 'Intake Peso — Parte 2' > Merge recalcula el del profundo,
  //   3) el portal re-criba en intake/nuevo.
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
    var alt = +a.altura, cin = +a.cintura, pa = +a.peso_actual, po = +a.peso_objetivo;
    if (alt && cin && (cin / alt) > 0.6) score += 1;
    var kg = Math.max(0, (pa || 0) - (po || 0));
    var imc = (alt && pa) ? Math.round(pa / Math.pow(alt / 100, 2) * 10) / 10 : null;
    var sem_min = (pa && kg) ? Math.ceil(kg / (pa * 0.02)) : null;
    var sem_max = (pa && kg) ? Math.ceil(kg / (pa / 200)) : null;
    return {
      flag_rojo: flag, riesgo_score: score, imc: imc,
      kg_a_perder: Math.round(kg * 10) / 10, semanas_min: sem_min, semanas_max: sem_max,
      cribado: flag >= 1 ? "Rojo" : (score >= 6 ? "Amarillo" : "Verde"),
      elegible: flag < 1
    };
  }
};

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
    // Las DOS se enseñan como precio MENSUAL, que es lo único comparable de un vistazo: 89 al mes,
    // y 74,17 al mes con los 89 tachados al lado. El servicio no es "anual": es el mismo mes de
    // seguimiento, pagado de una vez. El importe total del año (890 € en un solo pago) va en su
    // `desc`, que es donde tiene que estar para que nadie llegue a Stripe sin haber visto lo que se
    // le va a cargar. Mismo criterio que el selector mensual/anual de perdida-de-peso.html, que es
    // la página de la que viene el paciente.
    // OJO: `precio` es SIEMPRE el importe real que se cobra y el que viaja a Meta y GA4 (89 y 890);
    // `precioUI` es solo lo que se pinta grande. Meter 74,17 en `precio` haría que las analíticas
    // registraran 74 € por una venta de 890.
    // MISMOS nombres, misma forma del precio y mismo orden que el correo del apto (planesPeso de
    // clynia-portal/lib/email.ts) y que el drip (filasPlan de api/recuperar-valoracion). El
    // paciente llega aquí desde esos correos: si allí lee 89 y 890 y aquí ve otra cosa, cree que
    // le han cambiado el precio al pinchar. Se cambian los tres a la vez o ninguno.
    // `icono` es SVG en crudo (fichero nuestro, no entrada de usuario) y es OPCIONAL en el motor:
    // calendario simple para el mes a mes, y el mismo calendario con un check para el año entero.
    // Mismo trazo y grosor que el resto del sitio.
    { id: "sub_mensual", nombre: "Pagando mes a mes", precio: 89, unidad: "al mes", tag: "Más popular", featured: true, desc: "Se cobra cada mes. Sin permanencia.", icono: '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/></svg>', pago: "https://buy.stripe.com/fZu8wR77zdV89WwdGtfEk06" },
    { id: "sub_anual", nombre: "Pagando el año entero", precio: 890, precioUI: "74,17", unidad: "al mes", antes: 89, desc: "890 € en un solo pago. Ahorras 178 € al año.", icono: '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/><path d="M8.8 15.4l2.1 2.1 4.3-4.3"/></svg>', pago: "https://buy.stripe.com/00w9AVdvXcR41q01XLfEk07" }
  ],

  steps: [
    // ═══════════ PARTE 1 (pre-pago, mínima) ═══════════
    // Sin pantalla de bienvenida a propósito: aquí se llega desde "Empezar mi consulta gratis",
    // así que un segundo "Empezar" solo restaba conversión. Lo que aportaba (duración, gratuidad y
    // que el plan solo llega si el médico te considera candidato) vive en el help de esta primera
    // pregunta. Abre por el nombre, el arranque más amable; la fecha va justo después y corta a los
    // menores antes de pedir email, consentimiento o cualquier dato de salud.
    { id: "nombre", section: "Sobre ti", type: "text", key: "nombre", q: "Te damos la bienvenida. ¿Cómo te llamas?", help: "Son unos 2 minutos. Un médico colegiado valora tu caso sin coste; solo si te considera candidato te propondrá un plan.", autocomplete: "given-name", placeholder: "Tu nombre" },
    { id: "nacimiento", section: "Sobre ti", type: "date", key: "fecha_nacimiento", q: "¿Cuál es tu fecha de nacimiento?", help: "El médico la necesita para valorar tu caso con seguridad. Este servicio es solo para mayores de 18 años.", next: function (a) { if (!a.fecha_nacimiento) return null; var d = new Date(a.fecha_nacimiento), t = new Date(), age = t.getFullYear() - d.getFullYear(), m = t.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--; return age < 18 ? "ending_menor" : null; } },
    // Email + consentimiento PRONTO: así, aunque no termines, podemos guardar tu solicitud y
    // retomarla contigo (lead parcial). El consentimiento va antes de pedirte datos de salud.
    { id: "email", section: "Sobre ti", type: "email", key: "email", q: "¿Cuál es tu correo electrónico?", help: "Aquí te enviamos la confirmación y guardamos tu solicitud, para que puedas retomarla si no la terminas ahora." },
    // Teléfono en la PARTE 1: antes solo se pedía en la parte 2 (REMPE), así que de las consultas
    // gratis no quedaba ni un teléfono y no había forma de llamar a quien un médico ya había
    // declarado apto. Va aquí, detrás del email, para que sendPartial() lo mande con el lead parcial
    // (ya viaja en su payload) y para que 'Upsert Paciente' (n8n · Consulta gratis) lo escriba en
    // Pacientes > Teléfono, que ya lo mapea.
    // OBLIGATORIO desde el 27 jul 2026 (decisión de Alfonso): nació opcional para no tocar el 64%
    // de conversión de la parte 1, pero si la consulta médica se regala, poder localizar al paciente
    // es parte del trato. El motor exige 9 dígitos, que es lo que tiene un número español.
    { id: "telefono1", section: "Sobre ti", type: "tel", key: "telefono", q: "¿Y tu teléfono?", help: "Es la vía rápida si el médico necesita aclarar algo antes de valorar tu caso. Lo usa solo el médico que la revise.", errMsg: "Necesitamos un teléfono donde poder localizarte: escríbelo con sus nueve dígitos." },
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
    // paso solo se entra por payStartId en modo pago.
    // La GARANTÍA sale del todo de este paso (17 ago 2026, Alfonso). Ya había bajado a la letra
    // pequeña el 29 jul; ahora se va, por el mismo motivo llevado hasta el final: a este paso solo
    // se llega si un médico YA ha dicho que la persona es candidata, y hablarle de una devolución
    // le hace pensar en una segunda criba justo cuando lo único que falta es suscribirse. La
    // promesa NO desaparece (cláusula 8 de terminos.html, que hay que sostener) y si algún día pasa
    // se avisa por correo personal, pero no se vende de antemano. Lo que SÍ se queda es que la
    // pauta y la dosis las decide el especialista: es lo que impide leer esto como una promesa de
    // tratamiento, y dicho así habla de cómo se personaliza, no de si te dejan entrar.
    // El coste del medicamento se declara SIN cifra a propósito: no hay fuente oficial de precio de
    // venta en farmacia que citar y una horquilla inventada es justo lo que no se puede publicar.
    // section:false = sin pretítulo en mayúsculas. El paso ya tiene titular, tarjetas y botón.
    { id: "plans", section: false, type: "plans", key: "plan", q: "Ya puedes empezar. Elige cómo prefieres pagarlo", help: "El seguimiento médico es el mismo, solo cambia cada cuánto se te cobra. Al terminar completas tu cuestionario clínico y tu especialista prepara tu tratamiento.", note: "Se renueva automáticamente hasta que la canceles: te das de baja desde tu portal cuando quieras, sin permanencia ni penalización. El medicamento no está incluido en la cuota: lo compras en tu farmacia con tu receta electrónica. La pauta y la dosis las decide tu especialista según tu caso. Médicos colegiados en España. Pago seguro con Stripe.", cta: "Continuar al pago" },

    // ═══════════ PARTE 2 (post-pago: el resto del cuestionario) ═══════════
    { id: "p2_welcome", type: "statement", q: "Te damos la bienvenida a tu plan", badge: "Pago confirmado", body: "Para que tu especialista lo ajuste a ti de la mejor manera, necesita conocerte un poco mejor. Son unos 5 minutos y puedes retomarlo cuando quieras.", steps: [{ t: "Tu plan ya está activo", d: "Pago confirmado. De eso ya no tienes que preocuparte.", done: true }, { t: "Nos cuentas tu historia clínica", d: "Unos 5 minutos. Guardamos tu progreso, así que puedes parar y seguir cuando te venga bien.", icon: "ficha" }, { t: "Tu especialista prepara tu tratamiento", d: "Con tus respuestas ajusta la pauta y la dosis a tu caso y emite tu receta electrónica.", icon: "medico" }], cta: "Empezar" },

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
    { id: "analitica", section: "Estilo de vida", type: "file", key: "analitica", q: "¿Tienes una analítica de sangre reciente?", help: "Opcional. Si la tienes (últimos 3-6 meses), súbela y ayudarás al médico. PDF o foto, máximo 3,5 MB.", cta2: "Subir analítica", required: false },
    { id: "objetivo", section: "Casi listo", type: "single", key: "objetivo", q: "¿Qué quieres conseguir con Clynia?", options: [{ label: "Mejorar mi composición corporal" }, { label: "Mejorar mi metabolismo" }, { label: "Reducir dolor articular" }, { label: "Tener más energía" }, { label: "Dormir mejor" }, { label: "Longevidad" }, { label: "No lo sé, me gustaría consultarlo" }] },
    { id: "preferencia", section: "Casi listo", type: "single", key: "preferencia", q: "¿Tienes preferencia de tratamiento?", options: [{ label: "Prefiero no inyectarme" }, { label: "Me da igual" }] },
    { id: "algo_mas", section: "Casi listo", type: "yesno", key: "algo_mas", q: "¿Hay algo más que quieras decirle al equipo médico?" },
    { id: "mensaje_equipo", section: "Casi listo", type: "longtext", key: "mensaje_equipo", q: "Cuéntanoslo", showIf: function (a) { return a.algo_mas === true; } },

    // ---------- DATOS PARA LA RECETA (REMPE) ----------
    { id: "p2_identidad", type: "statement", q: "Últimos datos: para tu receta", body: "Si el médico valora que el tratamiento es adecuado, estos datos son obligatorios para poder emitir tu receta médica (sistema REMPE). Son los últimos.", cta: "Continuar" },
    { id: "primer_apellido", section: "Para tu receta", type: "text", key: "primer_apellido", q: "¿Cuál es tu primer apellido?", autocomplete: "family-name", placeholder: "Tu primer apellido", errMsg: "Necesitamos tu primer apellido." },
    { id: "segundo_apellido", section: "Para tu receta", type: "text", key: "segundo_apellido", q: "¿Y tu segundo apellido?", help: "Si solo tienes un apellido, deja este campo en blanco y continúa.", autocomplete: "off", placeholder: "Tu segundo apellido (opcional)", required: false },
    { id: "tipo_documento", section: "Para tu receta", type: "single", key: "tipo_documento", q: "¿Qué documento de identidad usarás?", help: "Lo exige el sistema de receta médica (REMPE).", options: [{ label: "DNI", value: "DNI" }, { label: "NIE", value: "NIE" }, { label: "Pasaporte", value: "Pasaporte" }] },
    { id: "num_documento", section: "Para tu receta", type: "text", key: "num_documento", q: "Número de tu documento", autocomplete: "off", placeholder: "Número de DNI/NIE/Pasaporte" },
    { id: "nacionalidad", section: "Para tu receta", type: "text", key: "nacionalidad", q: "¿Cuál es tu nacionalidad?", placeholder: "Tu nacionalidad" },
    // Solo se pregunta si NO lo dio ya en la parte 1 (paso 'telefono1', opcional). Misma key, así que
    // en el mismo dispositivo el motor ya lo tiene y no se repite la pregunta; en otro dispositivo (o
    // si lo saltó) se vuelve a pedir, que REMPE lo exige. Al ser condicional (showIf) el motor lo deja
    // fuera del tracking de pasos, que es la dirección segura.
    { id: "telefono", section: "Para tu receta", type: "tel", key: "telefono", q: "¿Y tu número de teléfono?", help: "El médico puede llamarte aquí si necesita ampliar algún dato.", showIf: function (a) { return !String(a.telefono || "").trim(); } },
    { id: "direccion", section: "Para tu receta", type: "text", key: "direccion", q: "¿Cuál es tu dirección postal?", autocomplete: "address-line1", placeholder: "Tu calle y número" },
    { id: "codigo_postal", section: "Para tu receta", type: "text", key: "codigo_postal", q: "Código postal", autocomplete: "postal-code", placeholder: "Tu código postal" },
    { id: "localidad", section: "Para tu receta", type: "text", key: "localidad", q: "Localidad", autocomplete: "address-level2", placeholder: "Tu ciudad o población" },
    { id: "provincia", section: "Para tu receta", type: "text", key: "provincia", q: "Provincia", autocomplete: "address-level1", placeholder: "Tu provincia" },
    { id: "p2_send", type: "statement", submitP2: true, q: "Todo listo para tu médico", body: "Al enviar, tu cuestionario completo pasa a un médico colegiado para su valoración. Te escribiremos por email con los siguientes pasos.", cta: "Enviar mi cuestionario" },

    // ---------- FINALES ----------
    { id: "ending_ok", type: "ending", variant: "ok", q: "¡Gracias! Tu consulta ya está con un médico", marca: true, icono: false, badge: "No tienes que hacer nada más", body: "Te contactamos nosotros. Esto es lo que pasa a partir de ahora:", steps: [{ t: "Consulta recibida", d: "Ya la tenemos guardada y en la cola de revisión médica.", done: true }, { t: "Un médico colegiado la revisa", d: "Mira tu caso con calma, sin cita previa y sin salas de espera.", icon: "medico" }, { t: "Te escribe por email", d: "Normalmente en menos de 24 horas. Si un tratamiento es adecuado para ti, te lo indicará y decides entonces si quieres continuar.", icon: "email" }], ctaNote: "Mientras tanto, en nuestro blog contamos cómo cuidar tu peso con criterio médico.", cta: "Ver artículos del blog", href: "/blog" },
    // PROMESA DE CANAL (canónica, 1 ago 2026). El sistema solo garantiza EMAIL: el médico resuelve en
    // el portal y eso dispara sendConsultaAptoEmail/sendConsultaNoAptoEmail; no hay telefonía en
    // ningún repo (ni Twilio ni SMS ni click-to-call), así que la llamada es un extra que el médico
    // PUEDE hacer, nunca una promesa. Antes esto decía "es muy probable que te llame" y contradecía
    // al resto de la web. Sin build no hay constante compartida: las copias de esta promesa viven en
    // saludsexual-schema.js (ending_p2_ok), gracias.html, index.html, perdida-de-peso.html,
    // menopausia.html, salud-capilar.html y longevidad.html. Si cambia, cambiarlas TODAS.
    { id: "ending_p2_ok", type: "ending", variant: "ok", q: "Cuestionario enviado. Ya está todo en marcha", body: "Un médico colegiado revisará tu caso y te responderá por email, así que lo tendrás todo por escrito. Si necesita aclarar algún dato, puede llamarte. Puedes seguir tu caso desde tu portal.", cta: "Ir a mi portal", href: "https://portal.clynia.es" },
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

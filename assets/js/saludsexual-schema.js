/* Clynia — esquema del cuestionario de SALUD SEXUAL MASCULINA (disfunción eréctil y rendimiento).
   Modelo CONSULTA GRATIS PRIMERO (clonado del peso, 2026-07-23): la parte 1 es una consulta médica
   gratuita (datos mínimos + motivo + medicación previa que le funcionó + cribado de seguridad PDE5
   + la pregunta libre del paciente). Se envía a consulta-intake-sexual, que crea el Caso
   Producto='Salud sexual', Tipo=Consulta, y Diego (médico colegiado con el flag "Aprueba consultas")
   lo revisa sin coste. NO hay pago en la web pública. El cuestionario clínico profundo + REMPE se
   conserva como PARTE 2 (modo ?p2=<intakeId>), al que solo llega el apto tras el OK del médico y el
   pago (enlace del email/portal). El motor (form-engine.js) decide el modo; el corte es el paso con
   id F.p2StartId. La parte 1 va al webhook (consulta-intake-sexual, fase='parte1') y la parte 2 a
   part2Webhook (sexual-intake-parte2), que funde por intakeId y pasa el Tipo de Consulta a Intake.

   EN MARCHA desde el 27 jul 2026: página enlazada desde la portada, indexable y con precios
   decididos (ver `plans`). La pregunta de medicación previa se responde EN ABIERTO a propósito: el
   nombre del fármaco lo escribe el paciente en el campo de texto de detalle, no lo mostramos
   nosotros. Este fichero se sirve público, así que aquí tampoco se nombran marcas de medicamentos
   de receta, ni siquiera en comentarios.
   PENDIENTE: revisión clínica y legal del cribado PDE5, y sacar el píxel de Meta de esta página
   (hallazgo abierto de la auditoría del 27 jul: la URL revela interés en salud sexual). */
window.CLYNIA_FORM = {
  product: "Salud sexual",
  storeKey: "clynia_sexual_v1",
  // CONSULTA GRATIS (parte 1, flujo por defecto): las respuestas van a consulta-intake-sexual, que crea
  // el Caso Producto='Salud sexual', Tipo=Consulta (Estado pago=Pendiente, Importe 0, sin médico) y
  // dispara el Lead de Meta. NO hay pago aquí: la primera consulta es gratuita; el pago del plan llega
  // después, ya como apto. (Workflow n8n clonado del de peso, cribado PDE5 propio.)
  webhook: "https://n8n-ixwg.srv1722506.hstgr.cloud/webhook/consulta-intake-sexual",

  // FORMULARIO PROFUNDO (parte 2, modo ?p2=<intakeId>): el apto, tras el OK del médico y el pago,
  // completa su cuestionario clínico + REMPE. Se envía aquí y n8n lo funde con el MISMO caso (merge por
  // intakeId), pasa el Tipo de Consulta a Intake y prepara la receta. Solo se entra con ?p2= (enlace del
  // email o portal del apto) o con el marker de pagado.
  part2Webhook: "https://n8n-ixwg.srv1722506.hstgr.cloud/webhook/sexual-intake-parte2",
  p2StartId: "p2_welcome",

  // PAGO DEL APTO (modo ?pay=<casoId>): tras el OK del médico, el apto elige plan y paga ANTES de la
  // parte 2. El motor entra en modo pago por ?pay=, arranca en payStartId (paso de planes) con el casoId
  // sembrado, y finish() postea {casoId, email, tipo_caso} a checkoutEndpoint (crear-checkout), que
  // devuelve la URL de Stripe. La PARTE 1 (consulta gratis) NUNCA fija answers.plan.
  // Checkout UNIFICADO de sexual (n8n `crear-checkout-sexual`, id 4peozw8uOKcWFz0D): ramifica por el id
  // del plan → suscripción (mode=subscription) o pago único (mode=payment, descriptor CLYNIA). NO toca
  // el `crear-checkout` de peso.
  checkoutEndpoint: "https://n8n-ixwg.srv1722506.hstgr.cloud/webhook/crear-checkout-sexual",
  payStartId: "plans",
  // TRES OPCIONES tras el apto. Precios verificados en Stripe LIVE el 27 jul:
  //   sub_mensual      39 €/mes   price_1TxpinRqcE5hSPKXJm4EAs4U   prod_UwVqEfp3fakjLi
  //   sub_anual       390 €/año   price_1TxqXKRqcE5hSPKXDbahsnfY   prod_UwVqEfp3fakjLi
  //   consulta_sexual  99 € único price_1TxqUPRqcE5hSPKXwHHCTwsk   prod_UwXKHPZalnPs6x
  // El mensual subio de 29 a 39 para dejar margen a los descuentos y la consulta puntual de 39 a 99
  // para que el recurrente no pareciera peor trato. Los prices viejos (price_1TwcpF... del mensual y
  // price_1TweFv... de la consulta) siguen activos en Stripe SOLO como vuelta atras y no los usa nadie.
  // DESCRIPTOR DE BANCO "CLYNIA" en los dos, verificado el 27 jul: la suscripción lo hereda del
  // producto y el pago único lo manda por cobro el checkout (payment_intent_data). Si se cambia uno,
  // cambiar el otro Y el copy: la web PROMETE ese texto exacto en el paso de pago, y dejaría de
  // coincidir con lo que ve el paciente en su banco.
  // El id del plan ('sub_mensual' | 'consulta_sexual') lo mapea el checkout unificado a su price y su
  // modo. La consulta puntual reusa el flujo apto de peso (flujo=consulta-apto, 30 días tipo
  // valoración); la suscripción va por su webhook propio.
  plans: [
    // ORDEN Y FORMA DEL PRECIO. El anual va primero y se enseña por su EQUIVALENTE MENSUAL
    // (32,50 €/mes, con el mensual de 39 € tachado al lado y "facturado una vez al año" debajo).
    // Es como lo hace cualquier SaaS y es lo que evita que 390 € se lea como "mas caro" cuando en
    // realidad es la opcion barata: el cliente compara en meses aunque pague de golpe.
    //   precio    = lo que se COBRA de verdad; es lo que va a Stripe, a las analiticas y al ticket.
    //   precioUI  = solo lo que se pinta grande. NO tocar `precio` para cuadrar el escaparate.
    //   antes     = precio de referencia tachado (el mensual), para que se vea el ahorro.
    // Sin etiqueta "Mas elegido" a proposito: el producto se lanzo hoy y no hay ni una compra, asi
    // que decir que es el mas elegido seria inventarse una prueba social que no existe.
    { id: "sub_anual", nombre: "Seguimiento anual", precio: 390, precioUI: "32,50", unidad: "/mes", antes: 39, meta: "Facturado una vez al año: 390 €", featured: true, tag: "2 meses gratis · ahorras 78 €", stripePrice: "price_1TxqXKRqcE5hSPKXDbahsnfY", desc: "Lo mismo que el mensual pagando el año de una vez: pagas 10 meses y tienes 12. Son 390 € en lugar de 468 €." },
    { id: "sub_mensual", nombre: "Seguimiento mensual", precio: 39, unidad: "/mes", meta: "Facturado cada mes · sin permanencia", tag: "Mes a mes", stripePrice: "price_1TxpinRqcE5hSPKXJm4EAs4U", desc: "Acceso a tu médico colegiado y seguimiento continuado, mes a mes. Cancelas cuando quieras, desde tu portal." },
    { id: "consulta_sexual", nombre: "Consulta puntual", precio: 99, meta: "Pago único · incluye 30 días con tu médico", sep: "¿Prefieres no suscribirte?", stripePrice: "price_1TxqUPRqcE5hSPKXwHHCTwsk", desc: "Una consulta con un médico colegiado que valora tu caso y te dice qué procede. Incluye 30 días para hablar con él. Sin compromisos ni cobros recurrentes." }
  ],

  steps: [
    // ═══════════ PARTE 1 (consulta gratis, mínima) ═══════════
    // Sin pantalla de bienvenida: se llega desde "Empezar mi consulta gratis". La duración, la
    // gratuidad y el trato discreto viven en el help de la primera pregunta.
    { id: "nombre", section: "Sobre ti", type: "text", key: "nombre", q: "Te damos la bienvenida. ¿Cómo te llamas?", help: "Son unos 2 minutos y es privado. Un médico colegiado valora tu caso sin coste; solo si lo considera adecuado para ti te propondrá continuar.", autocomplete: "given-name", placeholder: "Tu nombre" },
    { id: "nacimiento", section: "Sobre ti", type: "date", key: "fecha_nacimiento", q: "¿Cuál es tu fecha de nacimiento?", help: "El médico la necesita para valorar tu caso con seguridad. Este servicio es solo para mayores de 18 años.", next: function (a) { if (!a.fecha_nacimiento) return null; var d = new Date(a.fecha_nacimiento), t = new Date(), age = t.getFullYear() - d.getFullYear(), m = t.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--; return age < 18 ? "ending_menor" : null; } },
    { id: "email", section: "Sobre ti", type: "email", key: "email", q: "¿Cuál es tu correo electrónico?", help: "Aquí te enviamos la confirmación y la respuesta del médico, en privado." },
    { id: "consent", section: "Sobre ti", type: "consent", key: "consent", q: "Antes de seguir: tus datos, protegidos", help: "Con tu permiso guardamos tu solicitud para que un médico colegiado pueda valorarla. Todo es confidencial.", cta: "Acepto y continúo", items: [
      { key: "acepta_privacidad", required: true, label: 'He leído y acepto la <a href="privacidad" target="_blank">Política de Privacidad</a> de Clynia.' },
      { key: "acepta_datos_salud", required: true, label: "Doy mi consentimiento explícito al tratamiento de mis datos de salud con fines asistenciales." },
      { key: "acepta_acto_medico", required: true, label: "Consiento que un médico colegiado valore mi caso por telemedicina (comunicación no presencial), como acto médico individualizado." },
      { key: "acepta_comercial", required: false, label: "Quiero recibir comunicaciones de Clynia sobre mi solicitud y novedades." }
    ] },
    { id: "sexo_biologico", section: "Sobre ti", type: "single", key: "sexo_biologico", q: "¿Cuál es tu sexo biológico?", help: "Lo necesita el médico para valorar el tratamiento y sus contraindicaciones.", options: [{ label: "Hombre", value: "Hombre" }, { label: "Mujer", value: "Mujer" }], next: function (a) { return a.sexo_biologico === "Mujer" ? "ending_sexo" : null; } },

    // ---------- MOTIVO DE CONSULTA ----------
    { id: "motivo", section: "Tu consulta", type: "single", key: "motivo", q: "¿Cuál es tu principal motivo de consulta?", options: [
      { label: "Dificultad para conseguir o mantener la erección" },
      { label: "Eyaculación precoz" },
      { label: "Falta de deseo sexual" },
      { label: "Varias de las anteriores" },
      { label: "Otra" }
    ] },
    { id: "motivo_otra", section: "Tu consulta", type: "longtext", key: "motivo_otra", q: "Cuéntanos un poco más", showIf: function (a) { return a.motivo === "Otra"; } },

    // Medicación previa que le funcionó (petición de Alfonso). ANAMNESIS, no reclamo: la pregunta es
    // neutra y las marcas van en las opciones junto al principio activo, para que el médico sepa qué le
    // fue bien. ⚠ compliance: verificar el render antes de publicar (nombres de marca en parte 1).
    { id: "medicacion_previa", section: "Tu consulta", type: "single", key: "medicacion_previa", q: "¿Has probado antes alguna medicación para la erección? ¿Qué tal te fue?", help: "Nos ayuda a saber qué ha funcionado ya en tu caso. Si no lo sabes con seguridad, no pasa nada.", options: [
      { label: "Sí, y me fue bien", value: "Previa bien" },
      { label: "La probé, pero no me funcionó o me sentó mal", value: "Probada con problemas" },
      { label: "No he probado ninguna", value: "Ninguna" }
    ] },
    { id: "medicacion_previa_detalle", section: "Tu consulta", type: "longtext", key: "medicacion_previa_detalle", q: "Cuéntanos cuál y cómo te fue (nombre, dosis si la recuerdas)", showIf: function (a) { return a.medicacion_previa && a.medicacion_previa !== "Ninguna"; }, required: false },

    // ---------- CRIBADO DE SEGURIDAD (las preguntas que descartan; SIEMPRE antes de la consulta) ----------
    // Sirven para valorar si un tratamiento de la erección (inhibidores de la PDE5: sildenafilo,
    // tadalafilo…) es seguro. Las contraindicaciones absolutas cortan en el acto (next -> ending_rojo).
    { id: "intro_seguridad", type: "statement", q: "Ahora, unas preguntas de seguridad", body: "Son rápidas y sirven para descartar situaciones en las que un tratamiento de la erección no sería seguro. Respóndelas con tranquilidad.", cta: "Continuar" },
    { id: "nitratos", section: "Seguridad", type: "yesno", key: "nitratos", q: "¿Tomas nitratos o medicación para el corazón como nitroglicerina o mononitrato/dinitrato de isosorbida, o usas «poppers» (nitritos)?", help: "Importante: combinarlos con estos tratamientos puede ser peligroso.", next: function (a) { return a.nitratos === true ? "ending_rojo" : null; } },
    { id: "riociguat", section: "Seguridad", type: "yesno", key: "riociguat", q: "¿Tomas riociguat (Adempas) u otro medicamento para la hipertensión pulmonar?", next: function (a) { return a.riociguat === true ? "ending_rojo" : null; } },
    { id: "corazon", section: "Seguridad", type: "multi", key: "corazon", next: function (a, v) { return v.flag_rojo >= 1 ? "ending_rojo" : null; }, q: "¿Tienes o has tenido alguna de estas situaciones del corazón o la circulación?", help: "Marca todas las que apliquen.", options: [
      { label: "Infarto en los últimos 6 meses", crit: true },
      { label: "Ictus en los últimos 6 meses", crit: true },
      { label: "Angina inestable o dolor en el pecho al esfuerzo o durante el sexo", crit: true },
      { label: "Insuficiencia cardíaca grave", crit: true },
      { label: "Arritmia grave no controlada", crit: true },
      { label: "Tensión muy baja (hipotensión)", crit: true },
      { label: "Ninguna de las anteriores", exclusive: true }
    ] },
    { id: "vista", section: "Seguridad", type: "multi", key: "vista", next: function (a, v) { return v.flag_rojo >= 1 ? "ending_rojo" : null; }, q: "¿Tienes o has tenido algún problema serio de visión?", options: [
      { label: "Pérdida brusca de visión en un ojo (neuropatía óptica)", crit: true },
      { label: "Retinitis pigmentosa", crit: true },
      { label: "Ninguno", exclusive: true }
    ] },
    { id: "alergia_pde5", section: "Seguridad", type: "yesno", key: "alergia_pde5", q: "¿Eres alérgico al sildenafilo, tadalafilo, vardenafilo o avanafilo?", next: function (a) { return a.alergia_pde5 === true ? "ending_rojo" : null; } },

    // ---------- CRIBADO + CONSULTA (cierre de la consulta gratis) ----------
    { id: "gate_triage", type: "gate", route: function (a, v) { return v.flag_rojo >= 1 ? "ending_rojo" : "consulta"; } },
    { id: "consulta", section: "Tu consulta", type: "longtext", key: "consulta", submit: true, q: "¿Qué quieres consultar al médico?", help: "Cuéntanos solo lo relevante: desde cuándo lo notas, en qué situaciones, cómo te afecta y cualquier duda para el médico. Es confidencial.", placeholder: "Escribe aquí tu consulta para el médico", cta: "Enviar mi consulta" },

    // ---------- PLANES (solo modo pago ?pay=): el apto elige plan -> finish() -> checkoutEndpoint ----------
    // El "desde 32,50 €/mes" tiene que coincidir con el equivalente mensual del plan mas barato de
    // plans[] (el anual): si cambia un precio, cambiar tambien esta linea.
    // La ayuda ya NO es un parrafo de avisos: son cuatro titulares con icono, para que se lea de
    // un vistazo justo antes de pagar. Va todo con <span> porque el motor pinta el help dentro de
    // un <p> y una lista lo partiria en dos.
    {
      id: "plans", section: "Elige tu plan", type: "plans", key: "plan",
      q: "Estás a un paso. Empieza hoy desde 32,50 €/mes",
      help:
        "<span class=\"cq__trust\">"
        + "<span class=\"ti\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"10.5\" width=\"16\" height=\"10\" rx=\"2\"/><path d=\"M8 10.5V7a4 4 0 0 1 8 0v3.5\"/></svg>"
        + "<span><b>En tu banco aparece solo CLYNIA</b>Nada que mencione el motivo de tu consulta ni qué has contratado.</span></span>"
        + "<span class=\"ti\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path d=\"m9 12 2 2 4-4\"/></svg>"
        + "<span><b>Médicos colegiados en España</b>Tu caso ya lo ha valorado uno de ellos.</span></span>"
        + "<span class=\"ti\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2.5\" y=\"5\" width=\"19\" height=\"14\" rx=\"2\"/><path d=\"M2.5 10h19\"/></svg>"
        + "<span><b>Pago seguro con Stripe</b>¿Tienes un código de descuento? Lo aplicas en el paso siguiente.</span></span>"
        + "<span class=\"ti\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m10.5 20.5 10-10a5 5 0 0 0-7-7l-10 10a5 5 0 0 0 7 7Z\"/><path d=\"m8.5 8.5 7 7\"/></svg>"
        + "<span><b>El medicamento se compra aparte</b>Si el médico te lo receta, lo consigues en tu farmacia.</span></span>"
        + "</span>",
      cta: "Continuar al pago"
    },

    // ═══════════ PARTE 2 (post-pago: el resto del cuestionario) ═══════════
    { id: "p2_welcome", type: "statement", q: "Te damos la bienvenida", badge: "Pago confirmado", body: "Para que tu médico ajuste todo a ti, necesita conocer tu caso con más detalle. Son unos 5 minutos y puedes retomarlo cuando quieras.", steps: [{ t: "Tu plan ya está activo", d: "Pago confirmado. De eso ya no tienes que preocuparte.", done: true }, { t: "Nos cuentas tu caso con detalle", d: "Unos 5 minutos. Guardamos tu progreso, así que puedes parar y seguir cuando te venga bien.", icon: "ficha" }, { t: "Tu médico prepara tu tratamiento", d: "Con tus respuestas ajusta la pauta a tu caso y, si procede, emite tu receta.", icon: "medico" }], cta: "Empezar" },

    // ---------- BLOQUE CLÍNICO (resto) ----------
    { id: "ed_duracion", section: "Cuestionario clínico", type: "single", key: "ed_duracion", q: "¿Desde cuándo notas estas dificultades?", options: [{ label: "Menos de 3 meses" }, { label: "Entre 3 y 12 meses" }, { label: "Más de un año" }] },
    { id: "ed_frecuencia", section: "Cuestionario clínico", type: "single", key: "ed_frecuencia", q: "En los últimos 6 meses, ¿con qué frecuencia has podido mantener una erección suficiente para la relación?", options: [{ label: "Casi siempre" }, { label: "La mayoría de las veces" }, { label: "Aproximadamente la mitad de las veces" }, { label: "Pocas veces" }, { label: "Casi nunca o nunca" }] },
    { id: "ed_inicio", section: "Cuestionario clínico", type: "single", key: "ed_inicio", q: "¿Cómo empezó?", options: [{ label: "De forma gradual" }, { label: "De forma repentina" }] },
    { id: "ed_matutinas", section: "Cuestionario clínico", type: "yesno", key: "ed_matutinas", q: "¿Tienes erecciones espontáneas, por ejemplo al despertar?" },
    { id: "otras_condiciones", section: "Tu historia clínica", type: "multi", key: "otras_condiciones", q: "¿Alguna de estas condiciones de salud?", options: [
      { label: "Enfermedad del hígado grave (cirrosis)", crit: true },
      { label: "Enfermedad renal grave", score: 2 },
      { label: "Diabetes", score: 1 },
      { label: "Colesterol alto", score: 1 },
      { label: "Hipertensión", score: 1 },
      { label: "Enfermedad de Peyronie o deformidad del pene", score: 1 },
      { label: "Priapismo previo (erección dolorosa de más de 4 horas)", score: 2 },
      { label: "Úlcera de estómago activa", score: 1 },
      { label: "Ninguna", exclusive: true }
    ] },
    { id: "tension", section: "Tu historia clínica", type: "single", key: "tension", q: "¿Cuál es tu rango de tensión arterial?", options: [{ label: "Normal", value: "Normal" }, { label: "Algo elevada", value: "Elevada", score: 1 }, { label: "Alta y en tratamiento", value: "Alta tratada", score: 1 }, { label: "Alta sin controlar", value: "Alta sin controlar", score: 3 }, { label: "No lo sé", value: "NS" }] },
    { id: "alfa_bloqueantes", section: "Tu historia clínica", type: "yesno", key: "alfa_bloqueantes", q: "¿Tomas alfa-bloqueantes para la próstata o la tensión (tamsulosina, doxazosina...)?", scoreIfYes: 2 },
    { id: "medicamentos_actuales", section: "Tu historia clínica", type: "yesno", key: "medicamentos_actuales", q: "¿Tomas algún otro medicamento con receta de forma habitual?" },
    { id: "lista_medicamentos", section: "Tu historia clínica", type: "longtext", key: "lista_medicamentos", q: "¿Cuáles?", help: "Indica nombre y dosis si los conoces.", showIf: function (a) { return a.medicamentos_actuales === true; } },
    { id: "alergia_medicamentos", section: "Tu historia clínica", type: "yesno", key: "alergia_medicamentos", q: "¿Tienes alergia a algún otro medicamento?", scoreIfYes: 1 },
    { id: "lista_alergias", section: "Tu historia clínica", type: "longtext", key: "lista_alergias", q: "¿A cuál o cuáles?", showIf: function (a) { return a.alergia_medicamentos === true; } },

    { id: "tabaquismo", section: "Estilo de vida", type: "single", key: "tabaquismo", q: "¿Fumas?", options: [{ label: "No fumo ni he fumado", value: "No" }, { label: "Exfumador", value: "Ex" }, { label: "Fumador", value: "Fumador", score: 1 }] },
    { id: "alcohol", section: "Estilo de vida", type: "single", key: "alcohol", q: "¿Consumes alcohol?", options: [{ label: "No consumo", value: "No" }, { label: "Ocasional", value: "Ocasional" }, { label: "Habitual (semanal)", value: "Habitual", score: 1 }, { label: "Diario", value: "Diario", score: 2 }] },
    { id: "drogas", section: "Estilo de vida", type: "yesno", key: "drogas", q: "¿Consumes drogas recreativas?", help: "Es relevante por posibles interacciones, y es confidencial.", scoreIfYes: 1 },
    { id: "estado_animo", section: "Estilo de vida", type: "single", key: "estado_animo", q: "¿Cómo dirías que están tu ánimo y tu nivel de estrés últimamente?", options: [{ label: "Bien" }, { label: "Algo estresado o decaído" }, { label: "Bastante ansioso o deprimido" }] },
    { id: "algo_mas", section: "Casi listo", type: "yesno", key: "algo_mas", q: "¿Hay algo más que quieras decirle al equipo médico?" },
    { id: "mensaje_equipo", section: "Casi listo", type: "longtext", key: "mensaje_equipo", q: "Cuéntanoslo", showIf: function (a) { return a.algo_mas === true; } },

    // ---------- DATOS PARA LA RECETA (REMPE) ----------
    { id: "p2_identidad", type: "statement", q: "Últimos datos: para tu receta", body: "Si el médico valora que el tratamiento es adecuado, estos datos son obligatorios para poder emitir tu receta médica (sistema REMPE). Son los últimos.", cta: "Continuar" },
    { id: "primer_apellido", section: "Para tu receta", type: "text", key: "primer_apellido", q: "¿Cuál es tu primer apellido?", autocomplete: "family-name", placeholder: "Tu primer apellido", errMsg: "Necesitamos tu primer apellido." },
    { id: "segundo_apellido", section: "Para tu receta", type: "text", key: "segundo_apellido", q: "¿Y tu segundo apellido?", help: "Si solo tienes un apellido, deja este campo en blanco y continúa.", autocomplete: "off", placeholder: "Tu segundo apellido (opcional)", required: false },
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
    { id: "ending_ok", type: "ending", variant: "ok", q: "¡Gracias! Tu consulta ya está con un médico", marca: true, icono: false, badge: "No tienes que hacer nada más", body: "Te contactamos nosotros, en privado. Esto es lo que pasa a partir de ahora:", steps: [{ t: "Consulta recibida", d: "Ya la tenemos guardada y en la cola de revisión médica.", done: true }, { t: "Un médico colegiado la revisa", d: "Mira tu caso con calma, sin cita previa y sin salas de espera.", icon: "medico" }, { t: "Te escribe por email", d: "Normalmente en menos de 24 horas. Si un tratamiento es adecuado para ti, te lo indicará y decides entonces si quieres continuar.", icon: "email" }], ctaNote: "Mientras tanto, en nuestro blog contamos cómo cuidar tu salud con criterio médico.", cta: "Ver artículos del blog", href: "/blog" },
    { id: "ending_p2_ok", type: "ending", variant: "ok", q: "Cuestionario enviado. Ya está todo en marcha", body: "Un médico colegiado revisará tu caso y te contactará por email. Es muy probable que te llame por teléfono para conocerte mejor: mantén el móvil a mano estos días. Puedes seguir tu caso desde tu portal.", cta: "Ir a mi portal", href: "https://portal.clynia.es" },
    { id: "ending_menor", type: "ending", variant: "stop", q: "Este servicio es solo para mayores de 18 años", body: "Por ahora solo podemos atender a personas mayores de edad. Si te has equivocado con la fecha, vuelve atrás y corrígela.", href: "salud-sexual" },
    { id: "ending_sexo", type: "ending", variant: "stop", q: "De momento, este servicio está enfocado en la salud sexual masculina", body: "Estamos preparando la atención de salud sexual femenina. Si quieres que te avisemos cuando esté disponible, escríbenos a clynia@clynia.es. Gracias por tu interés.", cta: "Volver a Clynia", href: "salud-sexual" },
    { id: "ending_rojo", type: "ending", variant: "stop", q: "Por tu seguridad, esto debe valorarlo un médico en persona", body: "Según lo que nos has contado, un tratamiento online no es lo más adecuado para ti ahora mismo. Te recomendamos acudir a tu médico de cabecera o a un especialista de forma presencial. Hemos guardado tus respuestas: si quieres que te orientemos, escríbenos a clynia@clynia.es.", cta: "Volver a Clynia", href: "salud-sexual" }
  ],

  // Valida el número de documento contra el tipo elegido (idéntico al de peso). Suave: solo bloquea lo
  // claramente inválido. NUNCA aplica el dígito de control del DNI/NIE a un pasaporte.
  validarDocumento: function (tipo, num) {
    if (!tipo) return { ok: true };
    var n = String(num == null ? "" : num).toUpperCase().replace(/[\s-]/g, "").trim();
    if (n === "") return { ok: true };
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
    return { ok: /^[A-Z0-9]{5,20}$/.test(n) };
  },

  // Cribado del CLIENTE (UX): decide el corte por crítica (flag_rojo) y el color orientativo.
  // SET CRÍTICO (corta a ending_rojo con flag_rojo>=1): nitratos, riociguat, alergia PDE5 (los tres
  //   yesno de arriba cortan además en el acto con su next), + las críticas de 'corazon', 'vista' y
  //   'otras_condiciones' (cirrosis). Todas las de tipo multi/single van con crit:true.
  // SINCRONIZAR SIEMPRE con el backstop server del workflow n8n 'Clynia · Consulta gratis — Salud sexual'
  //   (nodo 'Preparar datos') y con la Parte 2. Si cambian críticas o pesos, cambiar ambas copias.
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
    // Contraindicaciones absolutas por yesno (cortan también en el acto vía next; aquí para que
    // gate_triage y 'Elegible' queden correctos si se llegara por otro camino).
    if (a.nitratos === true) flag++;
    if (a.riociguat === true) flag++;
    if (a.alergia_pde5 === true) flag++;
    return { flag_rojo: flag, riesgo_score: score, cribado: flag >= 1 ? "Rojo" : (score >= 6 ? "Amarillo" : "Verde"), elegible: flag < 1 };
  }
};

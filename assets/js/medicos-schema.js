/* Clynia — esquema del formulario de ALTA DE MÉDICOS colaboradores.
   Reconstruido del Typeform v0NRC8CC (36 campos + lógica KO y bloque de sociedad).
   Vuelca la candidatura a la tabla Médicos de Airtable (Estado=Pendiente) vía
   webhook de n8n. Mismo motor (form-engine.js) y estilo que el formulario de peso.
   Los valores de los desplegables coinciden EXACTO con las opciones de Airtable. */
window.CLYNIA_FORM = {
  product: "Médico colaborador",
  storeKey: "clynia_medico_v1",
  webhook: "https://n8n-ixwg.srv1722506.hstgr.cloud/webhook/medico-intake",

  steps: [
    { id: "welcome", type: "statement", q: "Únete a Clynia como médico colaborador",
      body: "Este formulario es el primer paso para colaborar con Clynia. Al completarlo presentas tu candidatura: verificaremos tu colegiación y documentación y, si todo encaja, te enviaremos el contrato para firma electrónica. Ten a mano tu número de colegiado y los datos de tu seguro de responsabilidad civil. Te llevará unos minutos.",
      cta: "Empezar" },

    // ---------- SOBRE TI ----------
    { id: "nombre", section: "Sobre ti", type: "text", key: "nombre", q: "¿Cómo te llamas?", help: "Solo el nombre.", autocomplete: "given-name", placeholder: "Tu nombre" },
    { id: "apellidos", section: "Sobre ti", type: "text", key: "apellidos", q: "¿Y tus apellidos?", autocomplete: "family-name", placeholder: "Tus apellidos" },
    { id: "email_prof", section: "Sobre ti", type: "email", key: "email_prof", q: "¿Cuál es tu email profesional?", help: "Aquí te escribiremos sobre tu candidatura." },
    { id: "telefono_movil", section: "Sobre ti", type: "tel", key: "telefono_movil", q: "¿Y tu teléfono móvil?" },
    { id: "dni_nie", section: "Sobre ti", type: "text", key: "dni_nie", q: "Tu DNI o NIE", autocomplete: "off", placeholder: "Número de DNI o NIE" },
    { id: "domicilio", section: "Sobre ti", type: "text", key: "domicilio", q: "Tu domicilio profesional", help: "Calle, número, código postal y localidad. Lo necesitamos para tu contrato.", placeholder: "Calle, nº, CP y localidad" },

    // ---------- TU COLEGIACIÓN ----------
    { id: "especialidad", section: "Tu colegiación", type: "single", key: "especialidad", q: "¿Cuál es tu especialidad médica?", options: [
      { label: "Endocrinología y nutrición" }, { label: "Medicina familiar" }, { label: "Medicina interna" }, { label: "Medicina general" }, { label: "Cardiología" }, { label: "Otra" }
    ] },
    { id: "otra_especialidad", section: "Tu colegiación", type: "text", key: "otra_especialidad", q: "Especifica tu especialidad", showIf: function (a) { return a.especialidad === "Otra"; } },
    { id: "num_colegiacion", section: "Tu colegiación", type: "text", key: "num_colegiacion", q: "Tu número de colegiación", autocomplete: "off", placeholder: "Nº de colegiado" },
    { id: "colegio_medicos", section: "Tu colegiación", type: "select", key: "colegio_medicos", q: "¿En qué Colegio Oficial de Médicos estás colegiado?", placeholder: "Selecciona tu provincia", options: [
      { label: "A Coruña" }, { label: "Álava" }, { label: "Albacete" }, { label: "Alicante" }, { label: "Almería" }, { label: "Asturias" }, { label: "Ávila" }, { label: "Badajoz" }, { label: "Barcelona" }, { label: "Burgos" }, { label: "Cáceres" }, { label: "Cádiz" }, { label: "Cantabria" }, { label: "Castellón" }, { label: "Ceuta" }, { label: "Ciudad Real" }, { label: "Córdoba" }, { label: "Cuenca" }, { label: "Girona" }, { label: "Granada" }, { label: "Guadalajara" }, { label: "Guipúzcoa" }, { label: "Huelva" }, { label: "Huesca" }, { label: "Illes Balears" }, { label: "Jaén" }, { label: "La Rioja" }, { label: "Las Palmas" }, { label: "León" }, { label: "Lleida" }, { label: "Lugo" }, { label: "Madrid" }, { label: "Málaga" }, { label: "Melilla" }, { label: "Murcia" }, { label: "Navarra" }, { label: "Ourense" }, { label: "Palencia" }, { label: "Pontevedra" }, { label: "Salamanca" }, { label: "Santa Cruz de Tenerife" }, { label: "Segovia" }, { label: "Sevilla" }, { label: "Soria" }, { label: "Tarragona" }, { label: "Teruel" }, { label: "Toledo" }, { label: "Valencia" }, { label: "Valladolid" }, { label: "Vizcaya" }, { label: "Zamora" }, { label: "Zaragoza" }
    ] },
    { id: "rempe", section: "Tu colegiación", type: "yesno", key: "rempe", q: "¿Estás dado de alta como prescriptor en un sistema de receta médica privada electrónica (REMPE u otro)?", help: "Es necesario para poder emitir recetas a los pacientes de Clynia." },

    // ---------- REQUISITOS (con KO) ----------
    { id: "seguro_rc", section: "Requisitos", type: "yesno", key: "seguro_rc", q: "¿Tienes seguro de responsabilidad civil profesional, vigente, que cubra la telemedicina y la prescripción online?", next: function (a) { return a.seguro_rc === false ? "ending_ko_seguro" : null; } },

    // ---------- TU EXPERIENCIA ----------
    { id: "experiencia_anos", section: "Tu experiencia", type: "number", key: "experiencia_anos", q: "¿Cuántos años de experiencia clínica tienes?", unit: "años", min: 0, max: 60 },
    { id: "horas_semana", section: "Tu experiencia", type: "single", key: "horas_semana", required: false, q: "¿Cuántas horas semanales te gustaría dedicar a Clynia?", help: "Orientativo, sin ningún compromiso.", options: [
      { label: "Menos de 5h" }, { label: "Entre 5 y 10h" }, { label: "Entre 10 y 20h" }, { label: "Más de 20h" }
    ] },
    { id: "franja_preferida", section: "Tu experiencia", type: "multi", key: "franja_preferida", required: false, q: "¿Qué franjas horarias prefieres para atender consultas?", help: "Orientativo: podrás cambiar tu disponibilidad cuando quieras.", options: [
      { label: "Mañanas entre semana" }, { label: "Tardes entre semana" }, { label: "Noches entre semana" }, { label: "Fines de semana" }
    ] },
    { id: "actividad_fuera", section: "Tu experiencia", type: "yesno", key: "actividad_fuera", q: "¿Mantienes actividad clínica fuera de Clynia (consulta privada, hospital, otra plataforma)?" },

    // ---------- FACTURACIÓN Y CONTRATO ----------
    { id: "statement_contrato", section: "Facturación y contrato", type: "statement", q: "Datos para tu contrato", body: "Los siguientes datos son necesarios para elaborar tu contrato de colaboración. Asegúrate de que sean exactos: figurarán en el documento que firmarás.", cta: "Continuar" },
    { id: "iban", section: "Facturación y contrato", type: "text", key: "iban", q: "Tu IBAN", help: "Si facturas como autónomo, indica tu IBAN personal. Si facturas a través de una sociedad, el IBAN de la sociedad.", placeholder: "ES00 0000 0000 0000 0000 0000" },
    { id: "facturacion_forma", section: "Facturación y contrato", type: "single", key: "facturacion_forma", q: "¿Cómo vas a facturar tus servicios a Clynia?", help: "Lo necesitamos para prepararte el contrato adecuado.", options: [
      { label: "Como autónomo (alta en RETA)", value: "Autónomo" },
      { label: "A través de mi sociedad profesional", value: "Sociedad profesional" },
      { label: "Ninguna de las dos / no lo tengo resuelto", value: "Sin resolver" }
    ], next: function (a) { return a.facturacion_forma === "Sin resolver" ? "ending_ko_facturacion" : null; } },

    // Bloque sociedad (solo si factura como sociedad)
    { id: "nombre_sociedad", section: "Facturación y contrato", type: "text", key: "nombre_sociedad", q: "Denominación social de tu sociedad profesional", showIf: function (a) { return a.facturacion_forma === "Sociedad profesional"; } },
    { id: "cif_sociedad", section: "Facturación y contrato", type: "text", key: "cif_sociedad", q: "CIF de la sociedad", autocomplete: "off", showIf: function (a) { return a.facturacion_forma === "Sociedad profesional"; } },
    { id: "dom_sociedad", section: "Facturación y contrato", type: "text", key: "dom_sociedad", q: "Domicilio social de la sociedad", showIf: function (a) { return a.facturacion_forma === "Sociedad profesional"; } },
    { id: "cargo_firmante", section: "Facturación y contrato", type: "single", key: "cargo_firmante", q: "Cargo de quien firmará el contrato por la sociedad", help: "El cargo de la persona apoderada para firmar.", showIf: function (a) { return a.facturacion_forma === "Sociedad profesional"; }, options: [
      { label: "Administrador único" }, { label: "Administrador solidario" }, { label: "Consejero delegado" }, { label: "Apoderado" }, { label: "Administrador mancomunado" }
    ] },
    { id: "firmante_es_tu", section: "Facturación y contrato", type: "yesno", key: "firmante_es_tu", q: "¿Eres tú quien tiene poder para firmar el contrato en nombre de la sociedad?", showIf: function (a) { return a.facturacion_forma === "Sociedad profesional"; } },
    { id: "nombre_firmante", section: "Facturación y contrato", type: "text", key: "nombre_firmante", q: "Nombre y apellidos de quien firmará por la sociedad", showIf: function (a) { return a.facturacion_forma === "Sociedad profesional" && a.firmante_es_tu === false; } },
    { id: "dni_firmante", section: "Facturación y contrato", type: "text", key: "dni_firmante", q: "DNI o NIE del firmante", autocomplete: "off", showIf: function (a) { return a.facturacion_forma === "Sociedad profesional" && a.firmante_es_tu === false; } },
    { id: "email_firmante", section: "Facturación y contrato", type: "email", key: "email_firmante", q: "Email del firmante", help: "Lo necesitamos para enviarle el contrato a firmar.", showIf: function (a) { return a.facturacion_forma === "Sociedad profesional" && a.firmante_es_tu === false; } },

    // ---------- DECLARACIONES ----------
    { id: "declaraciones", section: "Declaraciones", type: "consent", q: "Tus declaraciones", cta: "Acepto y continúo", items: [
      { key: "legal_no_inhabilitado", required: true, label: "Declaro que no estoy inhabilitado, suspendido ni incurso en expediente o sanción deontológica, disciplinaria o profesional que me impida o limite el ejercicio de la Medicina." },
      { key: "legal_privacidad", required: true, label: 'He leído y acepto la <a href="privacidad" target="_blank">política de privacidad</a> y el acuerdo de tratamiento de datos.' },
      { key: "legal_verificacion", required: true, label: "Consiento que Clynia verifique mi número de colegiación contra los registros públicos del Consejo General de Colegios Oficiales de Médicos." }
    ] },

    // ---------- CASI LISTO ----------
    { id: "conociste", section: "Casi listo", type: "single", key: "conociste", required: false, q: "¿Cómo nos conociste?", options: [
      { label: "Otro médico me lo recomendó" }, { label: "Redes sociales" }, { label: "Búsqueda en Google" }, { label: "Evento o congreso" }, { label: "Otro" }
    ] },
    { id: "comentarios", section: "Casi listo", type: "longtext", key: "comentarios", required: false, q: "Si quieres añadir algo, este es el momento", help: "Opcional.", submit: true, cta: "Enviar mi candidatura" },

    // ---------- FINALES ----------
    { id: "ending_ok", type: "ending", variant: "ok", q: "Gracias, hemos recibido tu candidatura", body: "En las próximas 48 h verificaremos tu colegiación. Te escribiremos a tu email con los siguientes pasos: el contrato para firma electrónica y la documentación que necesitamos (póliza de RC, certificado de colegiación y tu DNI/NIE por ambas caras). Si tienes cualquier duda, escríbenos a medicos@clynia.es.", cta: "Volver a Clynia", href: "/" },
    { id: "ending_ko_seguro", type: "ending", variant: "stop", q: "Necesitas seguro de RC profesional que cubra la telemedicina", body: "Para colaborar con Clynia es imprescindible un seguro de responsabilidad civil que cubra expresamente la práctica online. Cuando lo tengas, vuelve a aplicar. Si tienes dudas sobre qué pólizas lo cubren, escríbenos a medicos@clynia.es y te orientamos.", cta: "Salir a Clynia", href: "medicos" },
    { id: "ending_ko_facturacion", type: "ending", variant: "stop", q: "Necesitas poder facturarnos como autónomo o como sociedad", body: "El modelo de Clynia requiere que cada médico facture sus consultas, ya sea como autónomo o a través de una sociedad profesional. Cuando tengas resuelta una de las dos vías, vuelve a aplicar. Si necesitas orientación, escríbenos a medicos@clynia.es.", cta: "Salir a Clynia", href: "medicos" }
  ]
};

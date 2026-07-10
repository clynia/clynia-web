/* Clynia - esquema del formulario de ALTA DE COLABORADORES (creadores/influencers).
   Vuelca la solicitud a la tabla Colaboradores de Airtable (Estado=Pendiente) vía
   webhook de n8n (colaborador-intake). Mismo motor (form-engine.js) y estilo que el
   formulario de médicos. Sin plans ni checkoutEndpoint: no es un checkout.
   Compliance: aquí no se anuncia; el consentimiento final es la aceptación clickwrap
   (LSSI) de los Términos de colaboración y las Normas de publicidad. */
window.CLYNIA_FORM = {
  product: "Colaborador",
  category: "Colaboradores",
  storeKey: "clynia_colaborador_v1",
  webhook: "https://n8n-ixwg.srv1722506.hstgr.cloud/webhook/colaborador-intake",

  steps: [
    { id: "welcome", type: "statement", q: "Colabora con Clynia",
      body: "Este formulario es el primer paso para colaborar con Clynia. Cuéntanos quién eres, dónde publicas y qué temática tratas. Revisaremos tu solicitud y, si encaja, activaremos tu código de colaborador con su descuento asociado. Te llevará solo un par de minutos.",
      cta: "Empezar" },

    // ---------- SOBRE TI ----------
    { id: "nombre", section: "Sobre ti", type: "text", key: "nombre", q: "¿Cómo te llamas?", help: "Tu nombre y apellidos.", autocomplete: "name", placeholder: "Tu nombre y apellidos" },
    { id: "email", section: "Sobre ti", type: "email", key: "email", q: "¿Cuál es tu email?", help: "Aquí te escribiremos sobre tu solicitud." },

    // ---------- CONSENTIMIENTO RGPD AL INICIO ----------
    { id: "consent_privacidad", section: "Privacidad", type: "consent", q: "Antes de seguir", cta: "Acepto y continúo", items: [
      { key: "acepta_privacidad", required: true, label: 'He leído y acepto la <a href="/privacidad" target="_blank" rel="noopener">política de privacidad</a> y el tratamiento de mis datos para gestionar esta solicitud de colaboración.' }
    ] },

    // ---------- TUS PERFILES ----------
    { id: "perfiles_intro", section: "Tus perfiles", type: "statement", q: "Cuéntanos dónde publicas", body: "Indícanos tus perfiles en las redes donde tienes comunidad. Son todos opcionales, pero necesitamos al menos uno para valorar tu solicitud.", cta: "Continuar" },
    { id: "instagram", section: "Tus perfiles", type: "text", key: "instagram", required: false, q: "Tu perfil de Instagram", help: "Opcional. Pega el enlace o tu usuario (@).", autocomplete: "off", placeholder: "@tuusuario o https://instagram.com/tuusuario" },
    { id: "tiktok", section: "Tus perfiles", type: "text", key: "tiktok", required: false, q: "Tu perfil de TikTok", help: "Opcional. Pega el enlace o tu usuario (@).", autocomplete: "off", placeholder: "@tuusuario o https://tiktok.com/@tuusuario" },
    { id: "youtube", section: "Tus perfiles", type: "text", key: "youtube", required: false, q: "Tu canal de YouTube", help: "Opcional. Pega el enlace o el nombre del canal.", autocomplete: "off", placeholder: "https://youtube.com/@tucanal" },

    { id: "plataforma_principal", section: "Tus perfiles", type: "single", key: "plataforma_principal", q: "¿Cuál es tu plataforma principal?", help: "Aquella donde tienes más comunidad.", options: [
      { label: "Instagram" }, { label: "TikTok" }, { label: "YouTube" }, { label: "Otra" }
    ] },
    { id: "perfil_principal", section: "Tus perfiles", type: "text", key: "perfil_principal", q: "Enlace de tu perfil principal", help: "El perfil donde tienes más seguidores. Así confirmamos que tienes al menos un perfil activo.", autocomplete: "off", placeholder: "https://..." },
    { id: "seguidores", section: "Tus perfiles", type: "number", key: "seguidores", q: "¿Cuántos seguidores tiene tu perfil principal?", help: "Un número aproximado nos vale.", unit: "seguidores", min: 0 },

    // ---------- TU CONTENIDO ----------
    { id: "nicho", section: "Tu contenido", type: "single", key: "nicho", q: "¿Cuál es tu temática principal?", options: [
      { label: "Salud y bienestar" }, { label: "Fitness y ejercicio" }, { label: "Nutrición y cocina" }, { label: "Estilo de vida" }, { label: "Maternidad y familia" }, { label: "Belleza y cuidado personal" }, { label: "Otra" }
    ] },
    { id: "nicho_otra", section: "Tu contenido", type: "text", key: "nicho_otra", required: false, q: "Especifica tu temática", showIf: function (a) { return a.nicho === "Otra"; }, placeholder: "Tu temática" },
    { id: "muestra", section: "Tu contenido", type: "text", key: "muestra", q: "Enlace a una publicación representativa", help: "Pega el enlace de una publicación tuya que refleje bien tu estilo.", autocomplete: "off", placeholder: "https://..." },

    // ---------- ACEPTACIÓN (CLICKWRAP) ----------
    { id: "consent_final", section: "Últimos detalles", type: "consent", q: "Términos de la colaboración", cta: "Enviar mi solicitud", submit: true, items: [
      { key: "acepta_terminos_colab", required: true, label: 'He leído y acepto los <a href="/terminos-colaboracion" target="_blank" rel="noopener">Términos de colaboración</a>.' },
      { key: "acepta_normas_publicidad", required: true, label: 'He leído y me comprometo a cumplir las <a href="/normas-publicidad" target="_blank" rel="noopener">Normas de publicidad</a> de Clynia.' }
    ] },

    // ---------- FINAL ----------
    { id: "ending_ok", type: "ending", variant: "ok", q: "Gracias, hemos recibido tu solicitud", body: "Revisaremos tu perfil y te escribiremos a tu email. Si encaja con Clynia, te enviaremos tu código de colaborador, el kit de marca y las normas de publicidad para que empieces a recomendarnos. Si tienes cualquier duda, escríbenos a clynia@clynia.es.", cta: "Volver a Clynia", href: "/" }
  ]
};

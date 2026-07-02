/* Clynia — motor de formulario multipaso, dirigido por esquema.
   Lee window.CLYNIA_FORM = { storeKey, webhook, plans, steps[], computeVars(answers) }.
   Tipos de paso: statement | text | longtext | email | tel | number | date |
                  single | multi | yesno | file | consent | plans | gate | ending */
(function () {
  "use strict";
  var F = window.CLYNIA_FORM;
  var root = document.getElementById("cq");
  if (!F || !root) return;

  var answers = load();
  var vars = {};
  var history = [];
  var current = null;
  // --- Meta Pixel: evento de INICIO del cuestionario (se dispara una sola vez, al primer
  // avance). Sirve para etiquetar a quien empieza y no termina (retargeting) y medir el embudo. ---
  var started = false;
  function px(ev, params) { try { if (window.fbq) fbq("trackCustom", ev, params || {}); } catch (e) {} }
  // --- Meta Pixel: un evento por paso ALCANZADO (solo avance, una vez por paso y sesión).
  // Permite ver en qué pregunta abandona la gente. Envía el id del paso, nunca respuestas. ---
  var seenSteps = {};
  function pxStep(step) {
    if (!step || !step.id || seenSteps[step.id]) return;
    seenSteps[step.id] = true;
    px("QStep", { step: step.id, step_index: idx(step.id) + 1, content_name: F.product, content_category: F.category || F.product });
  }

  // Los datos de salud del intake NO deben quedar indefinidamente en localStorage
  // (equipos compartidos/públicos). Se purgan pasadas 24h desde la última edición.
  var TTL_MS = 24 * 60 * 60 * 1000;
  function clearStore() {
    try {
      localStorage.removeItem(F.storeKey);
      localStorage.removeItem(F.storeKey + "_ts");
      localStorage.removeItem(F.storeKey + "_pending");
    } catch (e) {}
  }
  function load() {
    try {
      var ts = parseInt(localStorage.getItem(F.storeKey + "_ts") || "0", 10);
      if (ts && (Date.now() - ts) > TTL_MS) { clearStore(); return {}; }
      return JSON.parse(localStorage.getItem(F.storeKey)) || {};
    } catch (e) { return {}; }
  }
  function save() {
    try {
      localStorage.setItem(F.storeKey, JSON.stringify(answers));
      localStorage.setItem(F.storeKey + "_ts", String(Date.now()));
    } catch (e) {}
  }
  function byId(id) { for (var i = 0; i < F.steps.length; i++) if (F.steps[i].id === id) return F.steps[i]; return null; }
  function idx(id) { for (var i = 0; i < F.steps.length; i++) if (F.steps[i].id === id) return i; return -1; }
  function visible(s) { return !s.showIf || s.showIf(answers, vars) !== false; }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function interp(t) {
    return String(t || "").replace(/\{\{(\w+)\}\}/g, function (_, k) {
      return (vars[k] != null ? vars[k] : (answers[k] != null ? answers[k] : ""));
    });
  }

  // Resuelve a partir de un id el siguiente paso renderizable (saltando ocultos y gates)
  function resolveFrom(startIdx) {
    for (var i = startIdx; i < F.steps.length; i++) {
      var s = F.steps[i];
      if (!visible(s)) continue;
      if (s.type === "gate") { var t = s.route(answers, vars); if (t) return byId(t); else continue; }
      return s;
    }
    return null;
  }
  function nextOf(step) {
    if (step.next) { var nid = step.next(answers, vars); if (nid) { var t = byId(nid); if (t && t.type === "gate") return resolveFrom(idx(nid)); return t; } }
    return resolveFrom(idx(step.id) + 1);
  }

  function go(step, push) {
    if (!step) return;
    if (push && current) history.push(current.id);
    if (push && !started) { started = true; px("StartQuestionnaire", { content_name: F.product, content_category: F.category || F.product }); }
    if (push) pxStep(step);
    current = step;
    vars = F.computeVars ? F.computeVars(answers) : {};
    render();
    window.scrollTo(0, 0);
  }
  function back() {
    if (!history.length) return;
    var id = history.pop();
    current = byId(id);
    vars = F.computeVars ? F.computeVars(answers) : {};
    render();
    window.scrollTo(0, 0);
  }

  // Marca que salimos al pago, para reanudar en ese paso al volver (botón atrás / bfcache).
  function markReturn() {
    try { sessionStorage.setItem(F.storeKey + "_return", current && current.id ? current.id : "plans"); } catch (e) {}
  }

  // Reanuda el formulario. Si volvemos del pago, aterriza en el paso guardado y reconstruye
  // el historial para que "Atrás" recorra las respuestas; si no, arranca por el principio.
  function resume() {
    var target = null;
    try { target = sessionStorage.getItem(F.storeKey + "_return"); } catch (e) {}
    if (!target || !byId(target)) { history = []; go(resolveFrom(0), false); return; }
    vars = F.computeVars ? F.computeVars(answers) : {};
    history = [];
    var step = resolveFrom(0), guard = 0;
    while (step && step.id !== target && guard++ < F.steps.length + 5) {
      history.push(step.id);
      var nx = nextOf(step);
      if (!nx) break;
      step = nx;
    }
    current = (step && step.id === target) ? step : byId(target);
    vars = F.computeVars ? F.computeVars(answers) : {};
    render();
    window.scrollTo(0, 0);
  }

  function progress() {
    var done = idx(current.id), total = F.steps.length;
    return Math.max(6, Math.min(96, Math.round((done / total) * 100)));
  }

  function render() {
    vars = F.computeVars ? F.computeVars(answers) : {};
    var s = current;
    if (s.type === "ending") return renderEnding(s);
    if (s.type === "statement") return renderStatement(s);

    var h = '<header class="cq__bar">';
    h += '<button class="cq__back" type="button" aria-label="Atrás"' + (history.length ? "" : " disabled") + ">&#8592;</button>";
    h += '<div class="cq__progress"><i style="width:' + progress() + '%"></i></div>';
    h += '<img class="cq__brand" src="assets/logos/clynia-wordmark.png" alt="Clynia"></header>';
    h += '<main class="cq__stage"><div class="cq__step">';
    h += '<p class="cq__eyebrow">' + esc(s.section || "Tu valoración") + "</p>";
    h += '<h1 class="cq__q">' + interp(s.q) + "</h1>";
    if (s.help) h += '<p class="cq__help">' + interp(s.help) + "</p>";
    if (s.visual) h += s.visual(answers, vars);
    h += '<div class="cq__field" id="cqField">' + fieldHTML(s) + "</div>";
    h += '<div class="cq__err" id="cqErr" style="display:none"></div>';
    h += "</div></main>";
    h += '<footer class="cq__foot"><div class="in"><button class="cq__next" type="button" id="cqNext">' + esc(s.cta || "Continuar") + "</button>" + (history.length ? '<button class="cq__backlow" type="button" id="cqBackLow">&#8592; Atrás</button>' : "") + "</div></footer>";
    root.innerHTML = h;

    var backBtn = root.querySelector(".cq__back");
    if (backBtn) backBtn.onclick = back;
    bind(s);
    document.getElementById("cqNext").onclick = function () { submitStep(s); };
    var bl = document.getElementById("cqBackLow"); if (bl) bl.onclick = back;
  }

  function fieldHTML(s) {
    var v = answers[s.key];
    switch (s.type) {
      case "text": return '<input class="cq__input" id="cqIn" type="text" autocomplete="' + (s.autocomplete || "on") + '" value="' + esc(v || "") + '" placeholder="' + esc(s.placeholder || "") + '">';
      case "select": return '<select class="cq__input" id="cqIn"><option value="" disabled' + (v ? "" : " selected") + ">" + esc(s.placeholder || "Selecciona una opción") + "</option>" + (s.options || []).map(function (o) { var val = ("value" in o) ? o.value : o.label; return '<option value="' + esc(val) + '"' + (v === val ? " selected" : "") + ">" + esc(o.label) + "</option>"; }).join("") + "</select>";
      case "longtext": return '<textarea class="cq__input" id="cqIn" placeholder="' + esc(s.placeholder || "") + '">' + esc(v || "") + "</textarea>";
      case "email": return '<input class="cq__input" id="cqIn" type="email" inputmode="email" autocomplete="email" value="' + esc(v || "") + '" placeholder="tucorreo@email.com">';
      case "tel": return '<input class="cq__input" id="cqIn" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(v || "") + '" placeholder="600 000 000">';
      case "number": return '<div class="cq__suffix"><input class="cq__input" id="cqIn" type="number" inputmode="decimal" value="' + esc(v == null ? "" : v) + '" placeholder="' + esc(s.placeholder || "") + '"' + (s.min != null ? ' min="' + s.min + '"' : "") + (s.max != null ? ' max="' + s.max + '"' : "") + ">" + (s.unit ? "<span>" + esc(s.unit) + "</span>" : "") + "</div>";
      case "date": return '<input class="cq__input" id="cqIn" type="date" value="' + esc(v || "") + '">';
      case "file": return '<div class="cq__file"><label for="cqIn">&#128206; ' + esc(s.cta2 || "Subir archivo") + '</label><input id="cqIn" type="file" accept="' + esc(s.accept || "image/*,.pdf") + '"><span class="name" id="cqFileName">' + esc(v ? v.name || "Archivo adjunto" : "Opcional") + "</span></div>";
      case "yesno": return optBtns(s, [{ label: "Sí", value: true }, { label: "No", value: false }], false);
      case "single": return optBtns(s, s.options, false);
      case "multi": return optBtns(s, s.options, true);
      case "consent": return s.items.map(function (it) {
        var ck = (answers[it.key] === true) ? " checked" : "";
        return '<label class="cq__consent"><input type="checkbox" data-ck="' + esc(it.key) + '"' + ck + ">" + '<span>' + it.label + (it.required ? "" : ' <em style="color:var(--muted)">(opcional)</em>') + "</span></label>";
      }).join("");
      case "plans": return F.plans.map(function (p, i) {
        var sel = (v === p.id) ? " is-sel" : "";
        return '<button type="button" class="cq__plan' + (p.featured ? " feat" : "") + sel + '" data-plan="' + esc(p.id) + '">' +
          (p.tag ? '<span class="tag">' + esc(p.tag) + "</span>" : "") +
          '<div class="name">' + esc(p.nombre) + "</div>" +
          '<div class="price">' + esc(p.precio) + '€ <small>' + esc(p.meta || "") + "</small></div>" +
          (p.desc ? '<div class="desc">' + esc(p.desc) + "</div>" : "") + "</button>";
      }).join("");
    }
    return "";
  }
  function optBtns(s, opts, multi) {
    var v = answers[s.key];
    return opts.map(function (o, i) {
      var val = ("value" in o) ? o.value : o.label;
      var sel = multi ? (Array.isArray(v) && v.indexOf(val) > -1) : (v === val);
      return '<button type="button" class="cq__opt' + (multi ? " multi" : "") + (sel ? " is-sel" : "") + '" data-i="' + i + '">' +
        "<span>" + esc(o.label) + '</span><span class="tick"></span></button>';
    }).join("");
  }

  function bind(s) {
    var field = document.getElementById("cqField");
    if (!field) return;
    if (s.type === "single" || s.type === "yesno" || s.type === "multi") {
      var opts = (s.type === "yesno") ? [{ label: "Sí", value: true }, { label: "No", value: false }] : s.options;
      var multi = s.type === "multi";
      field.querySelectorAll(".cq__opt").forEach(function (btn) {
        btn.onclick = function () {
          var o = opts[+btn.getAttribute("data-i")];
          var val = ("value" in o) ? o.value : o.label;
          if (multi) {
            var arr = Array.isArray(answers[s.key]) ? answers[s.key].slice() : [];
            // "ninguna/exclusiva" deselecciona el resto y viceversa
            if (o.exclusive) { arr = (arr.indexOf(val) > -1) ? [] : [val]; }
            else {
              var p = arr.indexOf(val); if (p > -1) arr.splice(p, 1); else arr.push(val);
              arr = arr.filter(function (x) { var oo = opts.filter(function (z) { return (("value" in z) ? z.value : z.label) === x; })[0]; return !(oo && oo.exclusive); });
            }
            answers[s.key] = arr; save(); render();
          } else {
            answers[s.key] = val; save();
            if (s.autoNext !== false) submitStep(s); else render();
          }
        };
      });
    } else if (s.type === "plans") {
      field.querySelectorAll(".cq__plan").forEach(function (btn) {
        btn.onclick = function () { answers[s.key] = btn.getAttribute("data-plan"); save(); render(); };
      });
    } else if (s.type === "file") {
      var inp = document.getElementById("cqIn");
      inp.onchange = function () { var f = inp.files[0]; if (f) { answers[s.key] = { name: f.name, size: f.size }; save(); document.getElementById("cqFileName").textContent = f.name; } };
    } else if (s.type === "consent") {
      field.querySelectorAll("input[data-ck]").forEach(function (c) {
        c.onchange = function () { answers[c.getAttribute("data-ck")] = c.checked; save(); };
      });
    } else {
      var el = document.getElementById("cqIn");
      if (el) {
        var setv = function () { answers[s.key] = (s.type === "number") ? (el.value === "" ? null : +el.value) : el.value; save(); };
        el.oninput = setv;
        el.onchange = setv;
        if (s.type !== "longtext") {
          el.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); setv(); submitStep(s); } };
          setTimeout(function () { try { el.focus(); } catch (e) {} }, 40);
        }
      }
    }
  }

  function err(msg) { var e = document.getElementById("cqErr"); if (e) { e.textContent = msg; e.style.display = "block"; } }

  function validate(s) {
    var v = answers[s.key];
    if (s.required === false) return true;
    switch (s.type) {
      case "multi": return Array.isArray(v) && v.length > 0;
      case "yesno": return v === true || v === false;
      case "file": return true;
      case "plans": return !!v;
      case "consent": return s.items.every(function (it) { return !it.required || answers[it.key] === true; });
      case "email": return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      case "number": return v != null && v !== "" && !isNaN(v);
      default: return v != null && String(v).trim() !== "";
    }
  }

  function submitStep(s) {
    if (!validate(s)) { err(s.errMsg || "Responde para continuar."); return; }
    if (s.id === "plans" || s.submit) return finish();
    go(nextOf(s), true);
  }

  function renderStatement(s) {
    var h = '<header class="cq__bar"><button class="cq__back" type="button"' + (history.length ? "" : " disabled") + ">&#8592;</button>";
    h += '<div class="cq__progress"><i style="width:' + progress() + '%"></i></div><img class="cq__brand" src="assets/logos/clynia-wordmark.png" alt="Clynia"></header>';
    h += '<main class="cq__stage"><div class="cq__step"><h1 class="cq__q">' + interp(s.q) + "</h1>";
    if (s.body) h += '<p class="cq__help">' + interp(s.body) + "</p></div></main>";
    h += '<footer class="cq__foot"><div class="in"><button class="cq__next" type="button" id="cqNext">' + esc(s.cta || "Continuar") + "</button>" + (history.length ? '<button class="cq__backlow" type="button" id="cqBackLow">&#8592; Atrás</button>' : "") + "</div></footer>";
    root.innerHTML = h;
    var b = root.querySelector(".cq__back"); if (b) b.onclick = back;
    document.getElementById("cqNext").onclick = function () { go(nextOf(s), true); };
    var bl = document.getElementById("cqBackLow"); if (bl) bl.onclick = back;
  }

  function renderEnding(s) {
    var stop = s.variant === "stop";
    var ico = stop
      ? '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    var h = '<div class="cq__center ' + (stop ? "stop" : "") + '"><div class="ico">' + ico + "</div>";
    h += "<h1>" + interp(s.q) + "</h1>";
    if (s.body) h += "<p>" + interp(s.body) + "</p>";
    if (stop && history.length) {
      h += '<button class="btn" type="button" id="cqEndBack">&#8592; Volver y corregir</button>';
      if (s.href) h += '<a class="cq__endlink" href="' + esc(s.href) + '">Salir a Clynia</a>';
    } else if (s.cta && s.href) {
      h += '<a class="btn" href="' + esc(s.href) + '">' + esc(s.cta) + "</a>";
    }
    h += "</div>";
    root.innerHTML = h;
    var eb = document.getElementById("cqEndBack"); if (eb) eb.onclick = back;
  }

  function finish() {
    vars = F.computeVars ? F.computeVars(answers) : {};
    root.innerHTML = '<div class="cq__center"><div class="cq__loading"><span class="cq__spin"></span> Enviando tu información de forma segura...</div></div>';
    var payload = { product: F.product, intakeId: answers._intakeId, answers: answers, triage: vars, submittedAt: new Date().toISOString() };
    var plan = (F.plans || []).filter(function (p) { return p.id === answers.plan; })[0];
    var redirected = false;
    // --- Meta Pixel: eventos de conversión. eventID = clave compartida con la CAPI (n8n) para deduplicar. ---
    var leadFired = false;
    function mTrack(ev, params, eid) { try { if (window.fbq) fbq("track", ev, params || {}, eid ? { eventID: eid } : undefined); } catch (e) {} }
    function fireLead(casoId) {
      if (leadFired) return; leadFired = true;
      mTrack("Lead", { content_name: F.product, content_category: F.category || F.product, value: plan ? plan.precio : undefined, currency: "EUR" }, "lead_" + (casoId || ("anon_" + new Date().getTime())));
    }
    function fireCheckout(casoId) {
      if (!plan) return;
      mTrack("InitiateCheckout", { content_name: plan.nombre, content_ids: [plan.id], value: plan.precio, currency: "EUR", num_items: 1 }, "ic_" + (casoId || ("anon_" + new Date().getTime())));
      // Guardamos el ticket para que gracias.html dispare Purchase con valor y el mismo eventID (dedup con la CAPI).
      try { localStorage.setItem("clynia_pending_purchase", JSON.stringify({ value: plan.precio, currency: "EUR", content_name: plan.nombre, content_ids: [plan.id], store: F.storeKey, eid: "purchase_" + (casoId || ("anon_" + new Date().getTime())) })); } catch (e) {}
    }
    // Ruta por defecto y fallback: Payment Link estático. casoId -> client_reference_id (emparejamiento del pago).
    function payViaLink(casoId) {
      if (redirected) return; redirected = true;
      if (plan && plan.pago) {
        fireCheckout(casoId);
        var url = plan.pago + (plan.pago.indexOf("?") > -1 ? "&" : "?") + "prefilled_email=" + encodeURIComponent(answers.email || "");
        if (casoId) url += "&client_reference_id=" + encodeURIComponent(casoId);
        markReturn();
        window.location.href = url;
      } else { go(byId("ending_ok"), false); }
    }
    // Ruta preferida si está configurada: Stripe Checkout Session creada en servidor (n8n) con el email BLOQUEADO.
    function proceedToPayment(casoId) {
      fireLead(casoId);
      if (!F.checkoutEndpoint || !casoId || !plan) { payViaLink(casoId); return; }
      var settled = false;
      var t = setTimeout(function () { if (settled) return; settled = true; payViaLink(casoId); }, 6000);
      fetch(F.checkoutEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ casoId: casoId, email: answers.email || "", tipo_caso: answers.plan }) })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) {
          if (settled) return; settled = true; clearTimeout(t);
          if (d && d.url) { if (redirected) return; redirected = true; fireCheckout(casoId); markReturn(); window.location.href = d.url; }
          else { payViaLink(casoId); }
        })
        .catch(function () { if (settled) return; settled = true; clearTimeout(t); payViaLink(casoId); });
    }
    if (!F.webhook) { proceedToPayment(null); return; }
    // Si ya creamos el caso en este intake, no lo recreamos: evita duplicados al volver atrás y reintentar.
    if (answers._caso) { proceedToPayment(answers._caso); return; }
    // Si el intake tarda demasiado, no bloqueamos al paciente: seguimos al pago igualmente.
    var failsafe = setTimeout(function () { proceedToPayment(null); }, 9000);
    fetch(F.webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (data) { clearTimeout(failsafe); var cid = data && data.casoId ? data.casoId : null; if (cid) { answers._caso = cid; save(); } proceedToPayment(cid); })
      .catch(function () { clearTimeout(failsafe); try { localStorage.setItem(F.storeKey + "_pending", JSON.stringify(payload)); } catch (e) {} proceedToPayment(null); });
  }

  document.body.classList.add("cq-body");
  // Identificador estable de este intake: permite volver atrás y reintentar sin duplicar el caso.
  if (!answers._intakeId) {
    try { answers._intakeId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10)); }
    catch (e) { answers._intakeId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10); }
    save();
  }
  // Reanudar: si volvemos del pago, al paso de planes; si no, al primer paso (respuestas ya guardadas).
  resume();
  // Volver atrás desde el pago restaura la página desde la bfcache con el spinner congelado:
  // repintamos la vista (paso de planes) para que el usuario pueda cambiar de plan o revisar.
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    var fromPay = false;
    try { fromPay = !!sessionStorage.getItem(F.storeKey + "_return"); } catch (ex) {}
    if (fromPay) resume();
  });
})();

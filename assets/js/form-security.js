(() => {
  "use strict";

  const SITE_KEY = "0x4AAAAAAE4-F43E-viFsKat";
  const states = new WeakMap();

  function safeAction(value) {
    return String(value || "public_form")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .slice(0, 32) || "public_form";
  }

  function setStatus(form, message, type = "") {
    const state = states.get(form);
    const status = state?.status;
    if (!status) return;
    status.textContent = message || "";
    status.className = "s4u-security-status" + (type ? " is-" + type : "");
  }

  function addHoneypot(form) {
    let input = form.querySelector('input[name="website_trap"]');
    if (input) return input;

    const wrap = document.createElement("div");
    wrap.className = "s4u-honeypot";
    wrap.setAttribute("aria-hidden", "true");

    const label = document.createElement("label");
    label.textContent = "Leave this field blank";
    label.htmlFor = "s4u_website_trap_" + Math.random().toString(36).slice(2);

    input = document.createElement("input");
    input.type = "text";
    input.name = "website_trap";
    input.id = label.htmlFor;
    input.tabIndex = -1;
    input.autocomplete = "off";
    input.setAttribute("aria-hidden", "true");

    wrap.append(label, input);
    form.appendChild(wrap);
    return input;
  }

  function addStartedAt(form) {
    let input = form.querySelector('input[name="form_started_at"]');
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = "form_started_at";
      form.appendChild(input);
    }
    input.value = String(Date.now());
    return input;
  }

  function createSecurityBox(form) {
    let box = form.querySelector(".s4u-form-security");
    if (box) return box;

    box = document.createElement("section");
    box.className = "s4u-form-security";
    box.setAttribute("aria-label", "Form security verification");
    box.innerHTML = `
      <div class="s4u-security-copy">
        <strong>Secure form verification</strong>
        <span>Protected by Cloudflare Turnstile. Automated, abusive, and repeated submissions may be blocked and security events may be logged.</span>
      </div>
      <div class="s4u-turnstile-host"></div>
      <div class="s4u-security-status" role="status" aria-live="polite"></div>
    `;

    const submit = form.querySelector('[type="submit"]');
    const anchor = submit?.closest(".actions,.form-footer") || submit;

    if (anchor?.parentNode) {
      anchor.parentNode.insertBefore(box, anchor);
    } else {
      form.appendChild(box);
    }

    return box;
  }

  function render(form) {
    const state = states.get(form);
    if (!state || state.widgetId !== null) return;

    if (!window.turnstile || typeof window.turnstile.render !== "function") {
      setTimeout(() => render(form), 120);
      return;
    }

    const host = state.box.querySelector(".s4u-turnstile-host");
    if (!host) return;

    try {
      state.widgetId = window.turnstile.render(host, {
        sitekey: SITE_KEY,
        action: safeAction(state.formKey),
        theme: "light",
        size: "normal",
        appearance: "always",
        callback(token) {
          state.token = String(token || "");
          setStatus(form, "Security verification complete.", "success");
        },
        "expired-callback"() {
          state.token = "";
          setStatus(form, "Security verification expired. Please verify again.", "error");
        },
        "timeout-callback"() {
          state.token = "";
          setStatus(form, "Security verification timed out. Please try again.", "error");
        },
        "error-callback"() {
          state.token = "";
          setStatus(form, "Security verification could not load. Refresh the page and try again.", "error");
        }
      });
    } catch (error) {
      console.error("Turnstile render failed:", error);
      setStatus(form, "Security verification could not load. Refresh the page and try again.", "error");
    }
  }

  function payload(form) {
    const state = states.get(form);
    const token =
      state?.token ||
      (state?.widgetId !== null &&
       window.turnstile &&
       typeof window.turnstile.getResponse === "function"
        ? window.turnstile.getResponse(state.widgetId)
        : "") ||
      "";

    return {
      turnstileToken: String(token || ""),
      formStartedAt: Number(state?.startedAt?.value || 0),
      websiteTrap: String(state?.honeypot?.value || "")
    };
  }

  function reset(form) {
    const state = states.get(form);
    if (!state) return;
    state.token = "";
    state.startedAt.value = String(Date.now());
    if (
      state.widgetId !== null &&
      window.turnstile &&
      typeof window.turnstile.reset === "function"
    ) {
      try {
        window.turnstile.reset(state.widgetId);
      } catch (error) {
        console.warn("Turnstile reset failed:", error);
      }
    }
    setStatus(form, "Please complete security verification.", "");
  }

  function initializeForm(form) {
    if (states.has(form)) return;

    const formKey = safeAction(form.dataset.s4uFormKey || form.id || "public_form");
    const honeypot = addHoneypot(form);
    const startedAt = addStartedAt(form);
    const box = createSecurityBox(form);
    const status = box.querySelector(".s4u-security-status");

    states.set(form, {
      formKey,
      honeypot,
      startedAt,
      box,
      status,
      widgetId: null,
      token: ""
    });

    form.addEventListener(
      "submit",
      (event) => {
        const security = payload(form);

        if (!security.turnstileToken) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setStatus(
            form,
            "Complete the Cloudflare security verification before submitting.",
            "error"
          );
          box.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }

        if (security.websiteTrap) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setStatus(form, "Submission could not be verified.", "error");
        }
      },
      true
    );

    render(form);
  }

  function initialize() {
    document
      .querySelectorAll("form[data-s4u-protected]")
      .forEach(initializeForm);
  }

  window.Screenings4uFormSecurity = {
    payload,
    reset,
    initializeForm
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();

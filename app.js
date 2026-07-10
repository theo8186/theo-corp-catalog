/* ============================================================
   THE-O CORPORATION — Export Catalog logic
   ============================================================ */

(function () {
  "use strict";

  var SESSION_KEY = "theo_buyer_session";
  var state = { species: "ALL", type: "ALL", origin: "ALL", query: "" };
  var grid, emptyState, resultCount;
  var gridBuilt = false;

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- SHA-256 hashing (Web Crypto) ---------- */
  function sha256Hex(text) {
    if (!window.crypto || !window.crypto.subtle) {
      return Promise.resolve(null); // not available (e.g. non-HTTPS context)
    }
    var enc = new TextEncoder().encode(text);
    return window.crypto.subtle.digest("SHA-256", enc).then(function (buf) {
      return Array.prototype.map
        .call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, "0"); })
        .join("");
    });
  }

  /* ---------- session (per-browser-session only; cleared when the tab/window closes) ---------- */
  function saveSession(email) {
    try { sessionStorage.setItem(SESSION_KEY, email); } catch (e) { /* ignore */ }
  }
  function readSession() {
    try { return sessionStorage.getItem(SESSION_KEY); } catch (e) { return null; }
  }
  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }

  /* ---------- product cards ---------- */
  function snackCard(p) {
    var qtyLabel = /\d/.test(String(p.qty)) && !/[a-zA-Z]/.test(String(p.qty)) ? p.qty + "g" : p.qty;
    return (
      '<a class="card-photo" href="' + escapeHtml(p.photoUrl) + '" target="_blank" rel="noopener">' +
        '<span class="species-tag ' + escapeHtml(p.species) + '">' + escapeHtml(p.species) + '</span>' +
        '<img src="' + p.image + '" alt="' + escapeHtml(p.description) + '" loading="lazy">' +
        '<span class="zoom-tag">View product page &#8599;</span>' +
      '</a>' +
      '<div class="card-body">' +
        '<div class="card-brand">' + escapeHtml(p.brand) + ' &nbsp;·&nbsp; <span class="origin-tag">' + escapeHtml(p.origin) + '</span></div>' +
        '<div class="card-title">' + escapeHtml(p.description) + '</div>' +
        '<div class="card-meta">' +
          '<span class="barcode-num">' + escapeHtml(p.barcode) + '</span>' +
          '<span class="qty">' + escapeHtml(qtyLabel) + '</span>' +
        '</div>' +
        '<div class="card-actions">' +
          (p.detailsUrl ? '<a class="btn-ghost" href="' + escapeHtml(p.detailsUrl) + '" target="_blank" rel="noopener">Details</a>' : '') +
          (p.photoUrl ? '<a class="btn-solid" href="' + escapeHtml(p.photoUrl) + '" target="_blank" rel="noopener">Product page</a>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function dryfoodCard(p) {
    var rows = (p.variants || []).map(function (v) {
      return (
        '<tr>' +
          '<td>' + escapeHtml(v.weight) + '</td>' +
          '<td>' + escapeHtml(v.innerPackage || "—") + '</td>' +
          '<td>' + escapeHtml(v.unitsInBox || "—") + '</td>' +
        '</tr>'
      );
    }).join("");

    return (
      (p.image
        ? '<a class="card-photo" href="' + escapeHtml(p.photoUrl || "#") + '" target="_blank" rel="noopener">' +
            '<span class="species-tag ' + escapeHtml(p.species) + '">' + escapeHtml(p.species) + '</span>' +
            '<img src="' + p.image + '" alt="' + escapeHtml(p.description) + '" loading="lazy">' +
            '<span class="zoom-tag">View product page &#8599;</span>' +
          '</a>'
        : '<div class="card-photo"><span class="species-tag ' + escapeHtml(p.species) + '">' + escapeHtml(p.species) + '</span></div>') +
      '<div class="card-body">' +
        '<div class="card-brand">' + escapeHtml(p.brand) + ' &nbsp;·&nbsp; <span class="origin-tag">' + escapeHtml(p.origin) + '</span></div>' +
        '<div class="card-title">' + escapeHtml(p.description) + '</div>' +
        '<table class="variant-table">' +
          '<thead><tr><th>Weight</th><th>Package</th><th>Units/box</th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
        '<div class="card-actions">' +
          (p.detailsUrl ? '<a class="btn-ghost" href="' + escapeHtml(p.detailsUrl) + '" target="_blank" rel="noopener">Details</a>' : '') +
          (p.photoUrl ? '<a class="btn-solid" href="' + escapeHtml(p.photoUrl) + '" target="_blank" rel="noopener">Product page</a>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function cardTemplate(p) {
    var isDry = p.type === "dryfood";
    var searchBlob = [
      p.description, p.brand,
      isDry ? (p.variants || []).map(function (v) { return v.barcode; }).join(" ") : p.barcode
    ].join(" ").toLowerCase();

    return (
      '<article class="card ' + (isDry ? "dryfood" : "snack") + ' reveal" ' +
        'data-species="' + escapeHtml(p.species) + '" ' +
        'data-type="' + escapeHtml(p.type) + '" ' +
        'data-origin="' + escapeHtml(p.origin) + '" ' +
        'data-search="' + escapeHtml(searchBlob) + '">' +
        (isDry ? dryfoodCard(p) : snackCard(p)) +
      '</article>'
    );
  }

  function render() {
    if (!grid) return;
    var q = state.query.trim().toLowerCase();
    var visible = 0;
    Array.prototype.forEach.call(grid.children, function (card) {
      var matchesSpecies = state.species === "ALL" || card.getAttribute("data-species") === state.species;
      var matchesType = state.type === "ALL" || card.getAttribute("data-type") === state.type;
      var matchesOrigin = state.origin === "ALL" || card.getAttribute("data-origin") === state.origin;
      var matchesQuery = !q || card.getAttribute("data-search").indexOf(q) !== -1;
      var show = matchesSpecies && matchesType && matchesOrigin && matchesQuery;
      card.style.display = show ? "" : "none";
      if (show) visible++;
    });
    if (resultCount) resultCount.textContent = visible + " of " + PRODUCTS.length + " products";
    if (emptyState) emptyState.classList.toggle("show", visible === 0);
  }

  function buildGrid() {
    if (gridBuilt || !grid) return;
    grid.innerHTML = PRODUCTS.map(cardTemplate).join("");
    gridBuilt = true;
    render();
    initReveal();
  }

  function initFilters() {
    function wirePillGroup(attr) {
      var pills = document.querySelectorAll(".pill[data-" + attr + "]");
      pills.forEach(function (pill) {
        pill.addEventListener("click", function () {
          pills.forEach(function (p) { p.classList.remove("active"); });
          pill.classList.add("active");
          state[attr] = pill.getAttribute("data-" + attr);
          render();
        });
      });
    }
    wirePillGroup("species");
    wirePillGroup("type");
    wirePillGroup("origin");

    var search = document.getElementById("searchInput");
    if (search) {
      search.addEventListener("input", function () {
        state.query = search.value;
        render();
      });
    }
  }

  function initReveal() {
    var items = document.querySelectorAll(".reveal:not(.in)");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------- nav toggle ---------- */
  function initNav() {
    var toggle = document.getElementById("navToggle");
    var nav = document.getElementById("mainNav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function () { nav.classList.toggle("open"); });
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { nav.classList.remove("open"); });
    });
  }

  /* ---------- stats ---------- */
  function initFacts() {
    var dogCount = PRODUCTS.filter(function (p) { return p.species === "DOG"; }).length;
    var catCount = PRODUCTS.filter(function (p) { return p.species === "CAT"; }).length;
    var setEl = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
    setEl("factTotal", PRODUCTS.length);
    setEl("factDog", dogCount);
    setEl("factCat", catCount);
  }

  /* ---------- gate: tabs ---------- */
  function initGateTabs() {
    var tabs = document.querySelectorAll(".gate-tab");
    var panels = { login: document.getElementById("panelLogin"), register: document.getElementById("panelRegister") };
    function activate(name) {
      tabs.forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-tab") === name); });
      Object.keys(panels).forEach(function (key) { panels[key].classList.toggle("active", key === name); });
    }
    tabs.forEach(function (t) {
      t.addEventListener("click", function () { activate(t.getAttribute("data-tab")); });
    });
    document.querySelectorAll(".gate-switch [data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () { activate(btn.getAttribute("data-tab")); });
    });
  }

  /* ---------- unlock / lock catalog ---------- */
  function unlockCatalog() {
    var locked = document.getElementById("lockedState");
    var unlocked = document.getElementById("catalogUnlocked");
    if (locked) locked.hidden = true;
    if (unlocked) unlocked.hidden = false;
    buildGrid();
  }
  function lockCatalog() {
    var locked = document.getElementById("lockedState");
    var unlocked = document.getElementById("catalogUnlocked");
    if (locked) locked.hidden = false;
    if (unlocked) unlocked.hidden = true;
  }

  function initLogout() {
    var btn = document.getElementById("logoutBtn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      clearSession();
      lockCatalog();
      var gate = document.getElementById("gate");
      if (gate) gate.scrollIntoView({ behavior: "smooth" });
    });
  }

  /* ---------- login form ---------- */
  function initLoginForm() {
    var form = document.getElementById("loginForm");
    if (!form) return;
    var msg = document.getElementById("loginMsg");
    var btn = document.getElementById("loginBtn");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var endpoint = window.APPS_SCRIPT_URL;
      var email = form.loginEmail.value.trim().toLowerCase();
      var password = form.loginPassword.value;

      msg.className = "form-msg";
      btn.disabled = true;
      btn.textContent = "Logging in…";

      if (!endpoint || endpoint.indexOf("PASTE_YOUR") !== -1) {
        setTimeout(function () {
          msg.classList.add("show", "err");
          msg.innerHTML = "<strong>Backend not connected yet.</strong> Add the Apps Script URL in <code>config.js</code> to enable login.";
          btn.disabled = false;
          btn.textContent = "Log in";
        }, 400);
        return;
      }

      sha256Hex(password).then(function (hash) {
        return fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ type: "login", email: email, passwordHash: hash })
        });
      })
        .then(function (res) { return res.json(); })
        .then(function (result) {
          if (result.ok) {
            saveSession(email);
            msg.classList.add("show", "ok");
            msg.innerHTML = "<strong>Login successful.</strong> Loading catalog…";
            setTimeout(function () {
              unlockCatalog();
              document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
            }, 400);
          } else {
            msg.classList.add("show", "err");
            msg.innerHTML = "<strong>" + escapeHtml(result.error || "Invalid email or password.") + "</strong>";
          }
        })
        .catch(function () {
          msg.classList.add("show", "err");
          msg.innerHTML = "<strong>Something went wrong.</strong> Please try again.";
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = "Log in";
        });
    });
  }

  /* ---------- registration form ---------- */
  function initRegisterForm() {
    var form = document.getElementById("registerForm");
    if (!form) return;
    var msg = document.getElementById("formMsg");
    var btn = document.getElementById("submitBtn");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var endpoint = window.APPS_SCRIPT_URL;

      if (form.password.value !== form.passwordConfirm.value) {
        msg.className = "form-msg show err";
        msg.innerHTML = "<strong>Passwords don't match.</strong> Please re-enter them.";
        return;
      }
      if (form.password.value.length < 8) {
        msg.className = "form-msg show err";
        msg.innerHTML = "<strong>Password must be at least 8 characters.</strong>";
        return;
      }

      msg.className = "form-msg";
      btn.disabled = true;
      btn.textContent = "Submitting…";

      if (!endpoint || endpoint.indexOf("PASTE_YOUR") !== -1) {
        setTimeout(function () {
          msg.classList.add("show", "err");
          msg.innerHTML = "<strong>Backend not connected yet.</strong> Once the Google Apps Script URL is added in <code>config.js</code>, submissions here will email ychung0426@gmail.com for approval automatically. Your form data was not sent anywhere.";
          btn.disabled = false;
          btn.textContent = "Submit application";
        }, 500);
        return;
      }

      sha256Hex(form.password.value).then(function (hash) {
        var data = {
          type: "register",
          company: form.company.value.trim(),
          contact: form.contact.value.trim(),
          country: form.country.value.trim(),
          email: form.email.value.trim(),
          phone: form.phone.value.trim(),
          message: form.message.value.trim(),
          passwordHash: hash,
          submittedAt: new Date().toISOString()
        };
        return fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(data)
        });
      })
        .then(function (res) { return res.json(); })
        .then(function () {
          msg.classList.add("show", "ok");
          msg.innerHTML = "<strong>Application received.</strong> We've sent your details for review — once approved, log in above with this email and password.";
          form.reset();
        })
        .catch(function () {
          msg.classList.add("show", "err");
          msg.innerHTML = "<strong>Something went wrong.</strong> Please try again, or email us directly at ychung0426@gmail.com.";
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = "Submit application";
        });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    grid = document.getElementById("productGrid");
    emptyState = document.getElementById("emptyState");
    resultCount = document.getElementById("resultCount");

    initFilters();
    initNav();
    initFacts();
    initGateTabs();
    initLoginForm();
    initRegisterForm();
    initLogout();
    initReveal();

    if (readSession()) {
      unlockCatalog();
    }
  });
})();

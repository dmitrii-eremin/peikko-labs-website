/* Castlefolk site behaviour. Every feature here is an enhancement: with JS disabled the
   page is still fully readable, the nav opens via a CSS checkbox, and the language
   picker is a plain <details> full of real links. */
(function () {
  "use strict";

  var LANG_KEY = "castlefolk:lang";
  var BANNER_KEY = "castlefolk:langBannerDismissed";
  var html = document.documentElement;
  var pageLang = html.lang;

  function store(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* private mode, blocked storage - nothing here is essential */
    }
  }

  function load(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  /* ---------- mobile nav ---------- */

  var toggle = document.getElementById("navToggle");
  var burger = document.querySelector(".nav__burger");

  if (toggle && burger) {
    var syncBurger = function () {
      burger.setAttribute("aria-expanded", String(toggle.checked));
    };
    toggle.addEventListener("change", syncBurger);
    syncBurger();

    // A <label> is not a button: give it Enter/Space like one.
    burger.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle.checked = !toggle.checked;
        syncBurger();
      }
    });

    // Close the panel after jumping to a section.
    document.querySelectorAll(".nav__links a").forEach(function (a) {
      a.addEventListener("click", function () {
        toggle.checked = false;
        syncBurger();
      });
    });
  }

  /* ---------- language picker ---------- */

  var picker = document.querySelector("[data-lang-picker]");

  if (picker) {
    // Remember an explicit choice, and carry the current section across.
    picker.querySelectorAll("a[hreflang]").forEach(function (a) {
      a.addEventListener("click", function () {
        store(LANG_KEY, a.getAttribute("hreflang"));
        if (location.hash) a.href = a.getAttribute("href") + location.hash;
      });
    });

    document.addEventListener("click", function (e) {
      if (picker.open && !picker.contains(e.target)) picker.open = false;
    });
    picker.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && picker.open) {
        picker.open = false;
        picker.querySelector("summary").focus();
      }
    });
  }

  /* ---------- first-visit language suggestion ---------- */

  // Never redirect automatically: offer, and let the reader decide.
  (function suggestLanguage() {
    var tpl = document.getElementById("langBannerTemplate");
    if (!tpl || !picker || load(LANG_KEY) || load(BANNER_KEY)) return;

    var available = {};
    picker.querySelectorAll("a[hreflang]").forEach(function (a) {
      available[a.getAttribute("hreflang")] = a;
    });

    var preferred = null;
    var navLangs = navigator.languages || [navigator.language || ""];
    for (var i = 0; i < navLangs.length; i++) {
      var code = String(navLangs[i]).toLowerCase().split("-")[0];
      if (available[code]) {
        preferred = code;
        break;
      }
    }
    if (!preferred || preferred === pageLang) return;

    var target = available[preferred];
    var node = tpl.content.cloneNode(true);
    var banner = node.querySelector(".banner");
    var link = node.querySelector(".banner__switch");

    banner.lang = preferred;
    node.querySelector(".banner__text").textContent = target.dataset.bannerText;
    link.textContent = target.dataset.switchLabel;
    link.href = target.getAttribute("href") + location.hash;
    link.addEventListener("click", function () {
      store(LANG_KEY, preferred);
    });
    node.querySelector(".banner__dismiss").addEventListener("click", function () {
      store(BANNER_KEY, "1");
      banner.remove();
    });

    document.body.appendChild(node);
  })();

  /* ---------- screenshot lightbox ---------- */

  (function lightbox() {
    var dialog = document.getElementById("lightbox");
    var gallery = document.querySelector("[data-gallery]");
    if (!dialog || !gallery || typeof dialog.showModal !== "function") return;

    var buttons = Array.prototype.slice.call(gallery.querySelectorAll(".shots__btn"));
    if (!buttons.length) return;

    var img = dialog.querySelector(".lb__img");
    var caption = dialog.querySelector(".lb__caption");
    var counter = dialog.querySelector(".lb__counter");
    var counterTpl = counter.dataset.counterTemplate || "";
    var index = 0;
    var opener = null;

    function show(i) {
      index = (i + buttons.length) % buttons.length;
      var btn = buttons[index];
      img.src = btn.dataset.full;
      img.alt = btn.dataset.caption;
      caption.textContent = btn.dataset.caption;
      counter.textContent = counterTpl
        .replace("{current}", String(index + 1))
        .replace("{total}", String(buttons.length));
    }

    buttons.forEach(function (btn, i) {
      btn.addEventListener("click", function () {
        opener = btn;
        show(i);
        dialog.showModal();
      });
    });

    dialog.querySelector(".lb__prev").addEventListener("click", function () {
      show(index - 1);
    });
    dialog.querySelector(".lb__next").addEventListener("click", function () {
      show(index + 1);
    });
    dialog.querySelector(".lb__close").addEventListener("click", function () {
      dialog.close();
    });

    dialog.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        show(index - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        show(index + 1);
      }
      // Esc is handled natively by <dialog>.
    });

    // Click the backdrop (outside .lb__inner) to dismiss.
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) dialog.close();
    });

    dialog.addEventListener("close", function () {
      img.removeAttribute("src");
      if (opener) opener.focus();
    });

    // Swipe between shots on touch.
    var startX = null;
    dialog.addEventListener(
      "touchstart",
      function (e) {
        startX = e.changedTouches[0].clientX;
      },
      { passive: true }
    );
    dialog.addEventListener(
      "touchend",
      function (e) {
        if (startX === null) return;
        var dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 45) show(index + (dx < 0 ? 1 : -1));
        startX = null;
      },
      { passive: true }
    );
  })();

  /* ---------- lazy YouTube ---------- */

  document.querySelectorAll("[data-video]").forEach(function (facade) {
    facade.addEventListener("click", function () {
      var frame = document.createElement("iframe");
      frame.src =
        "https://www.youtube-nocookie.com/embed/" +
        encodeURIComponent(facade.dataset.video) +
        "?autoplay=1&rel=0";
      frame.title = facade.getAttribute("aria-label") || "";
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture";
      frame.allowFullscreen = true;
      frame.loading = "lazy";
      facade.replaceWith(frame);
      frame.focus();
    });
  });

  /* ---------- section reveals ---------- */

  (function reveals() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches || !("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    items.forEach(function (el) {
      io.observe(el);
    });
  })();
})();

// ==UserScript==
// @name         Bfilter
// @namespace    https://github.com/mr-yifeiwang/bfilter
// @version      0.1.0
// @description  Open the Bfilter dashboard on Bilibili
// @match        https://bilibili.com/*
// @match        https://*.bilibili.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const style = document.createElement("style");
  style.textContent = `
    .bfilter-entry {
      position: fixed; z-index: 10000;
      padding: 6px 12px; border: 1px solid #d9e2e8; border-radius: 6px;
      background: #fff !important; color: #18191c; font: 500 14px/1.4 sans-serif;
      cursor: pointer; box-shadow: 0 2px 8px #0002;
    }
    .bfilter-entry:hover { color: #00aeec; }
    .bfilter-entry:focus-visible, .bfilter-close:focus-visible { outline: 2px solid #00aeec; outline-offset: 2px; }
    .bfilter-dashboard {
      box-sizing: border-box; width: min(440px, calc(100vw - 32px));
      min-height: 150px; padding: 20px 24px; border: 0; border-radius: 12px;
      background: #fff; color: #18191c; box-shadow: 0 12px 48px #0003;
      font: 14px/1.5 sans-serif;
    }
    .bfilter-dashboard::backdrop { background: #0006; }
    .bfilter-heading { display: flex; align-items: center; justify-content: space-between; }
    .bfilter-heading h2 { margin: 0; font-size: 20px; }
    .bfilter-close { border: 0; background: transparent; color: #61666d; font: inherit; cursor: pointer; }
  `;
  document.head.append(style);

  const dashboard = document.createElement("dialog");
  dashboard.className = "bfilter-dashboard";
  dashboard.setAttribute("aria-labelledby", "bfilter-title");
  dashboard.innerHTML =
    '<div class="bfilter-heading"><h2 id="bfilter-title">Bfilter</h2><button class="bfilter-close" type="button" aria-label="Close">×</button></div>';
  document.body.append(dashboard);
  dashboard
    .querySelector(".bfilter-close")
    .addEventListener("click", () => dashboard.close());

  const button = document.createElement("button");
  button.type = "button";
  button.className = "bfilter-entry";
  button.textContent = "Bfilter";
  button.hidden = true;
  button.addEventListener("click", () => dashboard.showModal());
  document.body.append(button);

  // Position the entry without modifying Bilibili's navigation
  function placeButton() {
    const home = Array.from(document.querySelectorAll("a")).find(
      (link) =>
        link.textContent.trim() === "首页" &&
        link.hostname === "www.bilibili.com",
    );
    if (!home) {
      button.hidden = true;
      return;
    }
    const rect = home.getBoundingClientRect();
    button.hidden = rect.width === 0 || rect.height === 0 || rect.bottom <= 0;
    button.style.left = `${rect.left}px`;
    button.style.top = `${rect.bottom}px`;
  }

  placeButton();
  window.addEventListener("scroll", placeButton, { passive: true });
  window.addEventListener("resize", placeButton);
  new MutationObserver(placeButton).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();

// ==UserScript==
// @name         Bfilter
// @namespace    https://github.com/mr-yifeiwang/bfilter
// @version      0.1.0
// @description  Filter Bilibili comments and video recommendations by user UID
// @match        https://bilibili.com/*
// @match        https://*.bilibili.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
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
    .bfilter-dashboard:not([open]) { display: none; }
    .bfilter-dashboard::backdrop { background: #0006; }
    .bfilter-heading { display: flex; align-items: center; justify-content: space-between; }
    .bfilter-heading h2 { margin: 0; font-size: 20px; }
    .bfilter-close { border: 0; background: transparent; color: #61666d; font: inherit; cursor: pointer; }
    .bfilter-tabs { display: flex; margin-top: 16px; border-bottom: 1px solid #d9e2e8; }
    .bfilter-tab { padding: 8px 12px; border: 0; border-bottom: 2px solid #00aeec; background: transparent; color: #00aeec; font: inherit; cursor: pointer; }
    .bfilter-users { display: block; margin-top: 16px; }
    .bfilter-users textarea { box-sizing: border-box; width: 100%; min-height: 150px; margin-top: 8px; padding: 8px; border: 1px solid #d9e2e8; border-radius: 6px; font: inherit; resize: vertical; }
  `;
  document.head.append(style);

  const dashboard = document.createElement("dialog");
  dashboard.className = "bfilter-dashboard";
  dashboard.setAttribute("aria-labelledby", "bfilter-title");
  dashboard.innerHTML = `
    <div class="bfilter-heading"><h2 id="bfilter-title">Bfilter</h2><button class="bfilter-close" type="button" aria-label="Close">×</button></div>
    <div class="bfilter-tabs" role="tablist" aria-label="Dashboard">
      <button class="bfilter-tab" type="button" role="tab" aria-selected="true" aria-controls="bfilter-users-panel" id="bfilter-users-tab">Users</button>
    </div>
    <div id="bfilter-users-panel" role="tabpanel" aria-labelledby="bfilter-users-tab">
      <label class="bfilter-users">User UIDs, one per line<textarea spellcheck="false"></textarea></label>
    </div>`;
  document.body.append(dashboard);
  dashboard
    .querySelector(".bfilter-close")
    .addEventListener("click", () => dashboard.close());

  const users = dashboard.querySelector("textarea");
  const storageKey = "bfilter.users";
  users.value = GM_getValue(storageKey, "");
  let blockedUsers = new Set();
  const comments = new Set();
  const hiddenDisplays = new WeakMap();
  const recommendationSelector =
    ".rec-list .video-page-card-small, .rec-list .video-page-operator-card-small, .next-play .video-page-card-small";

  // Preserve an element's original display while it is filtered
  function setFiltered(element, filtered) {
    if (filtered) {
      if (!hiddenDisplays.has(element)) {
        hiddenDisplays.set(element, [
          element.style.getPropertyValue("display"),
          element.style.getPropertyPriority("display"),
        ]);
      }
      element.style.setProperty("display", "none", "important");
    } else if (hiddenDisplays.has(element)) {
      const [value, priority] = hiddenDisplays.get(element);
      if (value) element.style.setProperty("display", value, priority);
      else element.style.removeProperty("display");
      hiddenDisplays.delete(element);
    }
  }

  // Filter a recommendation using the uploader's profile link
  function updateRecommendation(card) {
    const href = card.querySelector(".upname a")?.getAttribute("href") || "";
    const uid = href.match(
      /^(?:https?:)?\/\/space\.bilibili\.com\/(\d+)(?:[/?#]|$)/,
    )?.[1];
    setFiltered(card, blockedUsers.has(uid));
  }

  // Find recommendation cards in a changed part of the page
  function scanRecommendations(root) {
    if (!location.pathname.startsWith("/video/") || !(root instanceof Element))
      return;
    const card = root.closest(recommendationSelector);
    if (card) updateRecommendation(card);
    for (const recommendation of root.querySelectorAll(
      recommendationSelector,
    )) {
      updateRecommendation(recommendation);
    }
  }

  // Hide a blocked parent with its thread, or a blocked reply on its own
  function updateComment(comment) {
    const uid = comment.shadowRoot
      ?.querySelector("#user-avatar")
      ?.getAttribute("data-user-profile-id");
    const root = comment.getRootNode();
    const thread =
      comment.localName === "bili-comment-renderer" &&
      root.host?.localName === "bili-comment-thread-renderer"
        ? root.host
        : comment;
    setFiltered(thread, blockedUsers.has(uid));
  }

  // Apply the current UID list to already loaded comments
  function updateUsers() {
    blockedUsers = new Set(
      users.value.split(/[\s,]+/).filter((uid) => /^\d+$/.test(uid)),
    );
    for (const comment of comments) {
      if (comment.isConnected) updateComment(comment);
      else comments.delete(comment);
    }
    scanRecommendations(document.body);
  }

  users.addEventListener("input", () => {
    GM_setValue(storageKey, users.value);
    updateUsers();
  });
  GM_addValueChangeListener(storageKey, (_key, _oldValue, newValue, remote) => {
    if (remote) {
      users.value = newValue || "";
      updateUsers();
    }
  });
  updateUsers();

  if (location.pathname.startsWith("/video/")) {
    const selector =
      "bili-comments, bili-comment-thread-renderer, bili-comment-replies-renderer, bili-comment-renderer, bili-comment-reply-renderer";
    const observed = new WeakSet();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        scan(mutation.target);
        scanRecommendations(mutation.target);
      }
    });

    // Follow the comment component's shadow roots as Bilibili loads content
    function scan(root) {
      const host =
        root instanceof ShadowRoot ? root.host : root.getRootNode().host;
      if (host?.matches("bili-comment-renderer, bili-comment-reply-renderer")) {
        comments.add(host);
        updateComment(host);
      }
      for (const element of root.querySelectorAll(selector)) {
        if (!element.shadowRoot) continue;
        if (!observed.has(element.shadowRoot)) {
          observed.add(element.shadowRoot);
          observer.observe(element.shadowRoot, {
            childList: true,
            subtree: true,
          });
        }
        scan(element.shadowRoot);
      }
    }

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href"],
    });
    scan(document.body);
    scanRecommendations(document.body);
    for (const name of selector.split(", ")) {
      customElements.whenDefined(name).then(() => scan(document.body));
    }
  }

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

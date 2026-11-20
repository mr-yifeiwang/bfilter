// ==UserScript==
// @name         Bfilter
// @namespace    https://github.com/mr-yifeiwang/bfilter
// @version      0.1.0
// @description  Filter Bilibili comments and videos by user UID and video duration
// @match        https://bilibili.com/*
// @match        https://*.bilibili.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        unsafeWindow
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
      margin: auto;
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
    .bfilter-tab { padding: 8px 12px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #61666d; font: inherit; cursor: pointer; }
    .bfilter-tab[aria-selected="true"] { border-bottom-color: #00aeec; color: #00aeec; }
    .bfilter-dashboard [role="tabpanel"][hidden] { display: none; }
    .bfilter-users { display: block; margin-top: 16px; }
    .bfilter-users textarea { box-sizing: border-box; width: 100%; min-height: 150px; margin-top: 8px; padding: 8px; border: 1px solid #d9e2e8; border-radius: 6px; font: inherit; resize: vertical; }
    .bfilter-duration { display: block; margin-top: 16px; }
    .bfilter-duration input { box-sizing: border-box; width: 4em; padding: 4px; border: 1px solid #d9e2e8; border-radius: 6px; background: #fff; color: #18191c; font: inherit; }
    .bfilter-preview { margin-top: 12px; padding: 6px 12px; border: 1px solid #d9e2e8; border-radius: 6px; background: #fff; color: #18191c; font: inherit; cursor: pointer; }
    .bfilter-preview[aria-pressed="true"] { background: #ffc0cb; border-color: #e58a9a; }
  `;
  document.head.append(style);

  const dashboard = document.createElement("dialog");
  dashboard.className = "bfilter-dashboard";
  dashboard.setAttribute("aria-labelledby", "bfilter-title");
  dashboard.innerHTML = `
    <div class="bfilter-heading"><h2 id="bfilter-title">Bfilter</h2><button class="bfilter-close" type="button" aria-label="Close">×</button></div>
    <div class="bfilter-tabs" role="tablist" aria-label="Dashboard">
      <button class="bfilter-tab" type="button" role="tab" aria-selected="true" aria-controls="bfilter-users-panel" id="bfilter-users-tab">Users</button>
      <button class="bfilter-tab" type="button" role="tab" aria-selected="false" aria-controls="bfilter-videos-panel" id="bfilter-videos-tab">Videos</button>
    </div>
    <div id="bfilter-users-panel" role="tabpanel" aria-labelledby="bfilter-users-tab">
      <label class="bfilter-users">User UIDs, one per line<textarea spellcheck="false"></textarea></label>
      <button class="bfilter-preview" type="button" aria-pressed="false">Preview</button>
    </div>
    <div id="bfilter-videos-panel" role="tabpanel" aria-labelledby="bfilter-videos-tab" hidden>
      <label class="bfilter-duration">Hide videos by duration: &lt; <input type="number" min="0" step="any"> minutes</label>
    </div>`;
  document.body.append(dashboard);
  dashboard
    .querySelector(".bfilter-close")
    .addEventListener("click", () => dashboard.close());

  for (const tab of dashboard.querySelectorAll('[role="tab"]')) {
    tab.addEventListener("click", () => {
      for (const item of dashboard.querySelectorAll('[role="tab"]')) {
        const selected = item === tab;
        item.setAttribute("aria-selected", String(selected));
        dashboard.querySelector(
          `#${item.getAttribute("aria-controls")}`,
        ).hidden = !selected;
      }
    });
  }

  const users = dashboard.querySelector("textarea");
  const storageKey = "bfilter.users";
  users.value = GM_getValue(storageKey, "");
  const durationInput = dashboard.querySelector(".bfilter-duration input");
  const durationKey = "bfilter.duration";
  durationInput.value = GM_getValue(durationKey, "3");
  let blockedUsers = new Set();
  let previewing = false;
  const comments = new Set();
  const hiddenDisplays = new WeakMap();
  const rankingPage = location.pathname.startsWith("/v/popular/rank/");
  const searchPage = location.hostname === "search.bilibili.com";
  const homePage =
    (location.hostname === "www.bilibili.com" ||
      location.hostname === "bilibili.com") &&
    location.pathname === "/";
  const recommendationSelector =
    searchPage || homePage
      ? homePage
        ? ".feed-card .bili-video-card"
        : ".bili-video-card"
      : rankingPage
        ? ".rank-list .rank-item"
        : ".rec-list .video-page-card-small, .rec-list .video-page-operator-card-small, .next-play .video-page-card-small";

  // Preserve original styles while hiding or previewing a filtered element
  function setFiltered(element, filtered) {
    if (filtered && !hiddenDisplays.has(element)) {
      hiddenDisplays.set(
        element,
        ["display", "background-color"].map((property) => [
          element.style.getPropertyValue(property),
          element.style.getPropertyPriority(property),
        ]),
      );
    }
    const original = hiddenDisplays.get(element);
    if (!original) return;
    for (const [index, property] of ["display", "background-color"].entries()) {
      const [value, priority] = original[index];
      if (filtered && !previewing && property === "display") {
        element.style.setProperty(property, "none", "important");
      } else if (
        filtered &&
        previewing &&
        property === "display" &&
        (element.localName === "bili-comment-thread-renderer" ||
          element.localName === "bili-comment-reply-renderer")
      ) {
        element.style.setProperty(property, "block", "important");
      } else if (filtered && previewing && property === "background-color") {
        element.style.setProperty(property, "#ffc0cb", "important");
      } else if (value) {
        element.style.setProperty(property, value, priority);
      } else {
        element.style.removeProperty(property);
      }
    }
    if (!filtered) hiddenDisplays.delete(element);
  }

  // Filter a recommendation using the uploader's profile link
  function updateRecommendation(card) {
    const href =
      card
        .querySelector(
          searchPage || homePage
            ? ".bili-video-card__info--owner"
            : rankingPage
              ? ".detail a"
              : ".upname a",
        )
        ?.getAttribute("href") || "";
    const uid = href.match(
      /^(?:https?:)?\/\/space\.bilibili\.com\/(\d+)(?:[/?#]|$)/,
    )?.[1];
    const video =
      !(searchPage || homePage) ||
      !!card.querySelector(
        'a[href^="//www.bilibili.com/video/"], a[href^="https://www.bilibili.com/video/"]',
      );
    const durationText = card
      .querySelector(
        searchPage || homePage
          ? ".bili-video-card__stats__duration"
          : ".duration",
      )
      ?.textContent.trim();
    let duration;
    if (rankingPage) {
      const pageDocument =
        typeof unsafeWindow === "undefined" ? document : unsafeWindow.document;
      const list =
        pageDocument.querySelector(".rank-list-wrap")?.__vue__?.$props?.list ??
        pageDocument.querySelector(".rank-list")?.parentElement?.__vue__?.$props
          ?.list;
      duration = list?.find(
        (item) => String(item.aid) === card.getAttribute("data-id"),
      )?.duration;
    } else if (/^\d+:\d{2}(?::\d{2})?$/.test(durationText || "")) {
      duration = durationText
        .split(":")
        .reduce((seconds, part) => seconds * 60 + Number(part), 0);
    }
    const minutes = Number(durationInput.value);
    const durationVideo =
      video ||
      (homePage &&
        !!card.querySelector(
          'a[data-target-url^="https://www.bilibili.com/video/"]',
        ));
    const shortVideo =
      durationVideo &&
      durationInput.value !== "" &&
      Number.isFinite(minutes) &&
      minutes > 0 &&
      Number.isFinite(duration) &&
      duration < minutes * 60;
    const filtered = (video && blockedUsers.has(uid)) || shortVideo;
    setFiltered(card, filtered);
    if (searchPage || homePage) {
      const wrapper = card.querySelector(".bili-video-card__wrap");
      if (wrapper) setFiltered(wrapper, filtered);
    }
    if (searchPage && card.parentElement?.classList.contains("col_3")) {
      setFiltered(card.parentElement, filtered);
    }
    if (homePage) {
      const slot = card.closest(".feed-card");
      if (slot) setFiltered(slot, filtered);
    }
  }

  // Find recommendation cards in a changed part of the page
  function scanRecommendations(root) {
    if (
      (!searchPage &&
        !homePage &&
        !rankingPage &&
        !location.pathname.startsWith("/video/")) ||
      !(root instanceof Element)
    )
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

  dashboard
    .querySelector(".bfilter-preview")
    .addEventListener("click", (event) => {
      previewing = !previewing;
      event.currentTarget.setAttribute("aria-pressed", String(previewing));
      updateUsers();
    });

  durationInput.addEventListener("input", () => {
    GM_setValue(durationKey, durationInput.value);
    scanRecommendations(document.body);
  });
  GM_addValueChangeListener(
    durationKey,
    (_key, _oldValue, newValue, remote) => {
      if (remote) {
        durationInput.value = newValue ?? "3";
        scanRecommendations(document.body);
      }
    },
  );

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
        const target =
          mutation.target instanceof Element ||
          mutation.target instanceof ShadowRoot
            ? mutation.target
            : mutation.target.parentElement;
        if (!target) continue;
        scan(target);
        scanRecommendations(target);
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
      characterData: true,
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
  if (rankingPage || searchPage || homePage) {
    new MutationObserver((mutations) => {
      for (const mutation of mutations)
        scanRecommendations(
          mutation.target instanceof Element
            ? mutation.target
            : mutation.target.parentElement,
        );
    }).observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href"],
    });
    scanRecommendations(document.body);
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

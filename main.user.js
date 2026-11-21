// ==UserScript==
// @name         Bfilter
// @namespace    https://github.com/mr-yifeiwang/bfilter
// @version      2.2.0
// @description  Content filter for Bilibili
// @icon         https://raw.githubusercontent.com/mr-yifeiwang/bfilter/refs/heads/master/favicons/favicon-96x96.png
// @downloadURL  https://raw.githubusercontent.com/mr-yifeiwang/bfilter/refs/heads/master/main.user.js
// @updateURL    https://raw.githubusercontent.com/mr-yifeiwang/bfilter/refs/heads/master/main.user.js
// @match        https://*.bilibili.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_info
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  "use strict";

  const rankingPage = location.pathname.startsWith("/v/popular/rank/");
  const searchPage = location.hostname === "search.bilibili.com";
  const homePage =
    (location.hostname === "www.bilibili.com" ||
      location.hostname === "bilibili.com") &&
    location.pathname === "/";
  const videoPage = location.pathname.startsWith("/video/");
  const spaceUid =
    location.hostname === "space.bilibili.com"
      ? location.pathname.match(/^\/(\d+)(?:\/|$)/)?.[1]
      : null;
  if (!(homePage || searchPage || rankingPage || videoPage || spaceUid)) return;

  const style = document.createElement("style");
  style.textContent = `
    .bfilter-entry, .bfilter-dashboard {
      --bfilter-red: #a51f35; --bfilter-soft: #f9edef;
      --bfilter-ink: #292124; --bfilter-muted: #65585c; --bfilter-border: #a99a9e;
      --bfilter-titlebar: #f3edef;
      --bfilter-paper: #fffdfd; --bfilter-white: #fff;
      --bfilter-shadow: #21121630; --bfilter-font: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .bfilter-dashboard {
      --bfilter-border: #eadbdf; --bfilter-titlebar: #fff;
      --bfilter-paper: #fff; --bfilter-shadow: #4b222c26;
    }
    .bfilter-entry {
      position: fixed; display: flex; align-items: center; z-index: 10000; left: 0; top: 5.4vh; min-height: 28px;
      padding: 0 12px; border: 1px solid #a10425; border-radius: 0 6px 6px 0;
      background: #a10425 !important; color: var(--bfilter-white);
      font: 600 14px/1 var(--bfilter-font); cursor: pointer; touch-action: none;
      box-shadow: 0 3px 10px var(--bfilter-shadow);
    }
    .bfilter-entry svg { width: 22px; height: 20px; flex: none; margin-right: 6px; transform: translateY(-1px); }
    .bfilter-dashboard {
      position: fixed; z-index: 10001; left: 0; right: auto; bottom: auto;
      box-sizing: border-box; width: min(300px, calc(100% - 16px));
      max-height: calc(100dvh - var(--bfilter-popup-top) - 8px); overflow-y: auto; margin: 0;
      padding: 0; border: 1px solid var(--bfilter-border); border-radius: 16px;
      background: var(--bfilter-paper); color: var(--bfilter-ink);
      box-shadow: 0 12px 32px var(--bfilter-shadow); font: 14px/1.5 var(--bfilter-font);
      accent-color: var(--bfilter-red);
    }
    .bfilter-dashboard:not([open]) { display: none; }
    .bfilter-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--bfilter-border); background: var(--bfilter-titlebar); }
    .bfilter-heading h2 { margin: 0; color: var(--bfilter-ink); font-size: 16px; font-weight: 700; line-height: 1.25; }
    .bfilter-heading h2 a { color: inherit; text-decoration: none; }
    .bfilter-heading h2 a:hover { text-decoration: underline; }
    .bfilter-brand { display: flex; align-items: center; gap: 10px; white-space: nowrap; }
    .bfilter-mark { display: grid; place-items: center; flex: none; width: 38px; height: 38px; border-radius: 11px; background: #a10425; color: #fff; }
    .bfilter-mark svg { width: 29px; height: 25px; }
    .bfilter-version { display: block; color: var(--bfilter-muted); font-size: 11px; font-weight: 400; }
    .bfilter-actions { display: flex; align-items: center; gap: 8px; }
    .bfilter-close { display: grid; place-items: center; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--bfilter-muted); font: 24px/1 var(--bfilter-font); cursor: pointer; }
    .bfilter-close:hover { background: var(--bfilter-soft); color: var(--bfilter-red); }
    .bfilter-entry:focus-visible, .bfilter-dashboard :is(a, button, input, select, textarea):focus-visible { outline: 2px solid var(--bfilter-red); outline-offset: 3px; }
    .bfilter-section { padding: 18px; }
    .bfilter-section + .bfilter-section { border-top: 1px solid var(--bfilter-border); }
    .bfilter-section h3 { margin: 0 0 14px; color: var(--bfilter-ink); font-size: 15px; font-weight: 700; }
    .bfilter-registration { display: flex; align-items: center; gap: 8px; }
    .bfilter-registration label { flex: 1; min-width: 0; }
    .bfilter-registration input, .bfilter-section input[type="checkbox"] { appearance: auto; }
    .bfilter-filter-name { position: relative; }
    .bfilter-filter-name::after { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: currentColor; transform: scaleX(0); transform-origin: left; transition: transform 180ms ease; pointer-events: none; }
    input:not(:checked) + .bfilter-filter-name::after { transform: scaleX(1); }
    @media (prefers-reduced-motion: reduce) { .bfilter-filter-name::after { transition: none; } }
    .bfilter-dashboard :is(select, input[type="number"], .bfilter-types-toggle):disabled { opacity: 0.5; cursor: default; }
    .bfilter-registration select { flex: none; width: 70px; min-height: 34px; padding: 4px; border: 1px solid var(--bfilter-border); border-radius: 8px; background: var(--bfilter-paper); color: var(--bfilter-ink); font: inherit; appearance: auto; }
    .bfilter-users { display: block; margin-top: 14px; font-weight: 600; }
    .bfilter-users textarea { display: block; box-sizing: border-box; width: 100%; min-height: 88px; margin-top: 4px; padding: 10px; border: 1px solid var(--bfilter-border); border-radius: 8px; background: var(--bfilter-paper); color: var(--bfilter-ink); font: 400 14px/1.4 var(--bfilter-font); resize: vertical; }
    .bfilter-users-count { margin: 4px 0 0; color: var(--bfilter-muted); font-size: 11px; font-weight: 400; }
    .bfilter-duration, .bfilter-views { display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 10px; }
    .bfilter-value { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
    .bfilter-duration input[type="number"], .bfilter-views input[type="number"] { box-sizing: border-box; width: 70px; min-height: 34px; padding: 4px; border: 1px solid var(--bfilter-border); border-radius: 8px; background: var(--bfilter-paper); color: var(--bfilter-ink); font: inherit; text-align: center; appearance: textfield; }
    .bfilter-dashboard input[type="number"]::-webkit-inner-spin-button, .bfilter-dashboard input[type="number"]::-webkit-outer-spin-button { appearance: none; margin: 0; }
    .bfilter-types { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
    .bfilter-types-toggle { min-height: 34px; min-width: 70px; padding: 4px 8px; border: 1px solid var(--bfilter-border); border-radius: 8px; background: var(--bfilter-paper); color: var(--bfilter-ink); font: inherit; cursor: pointer; }
    .bfilter-types-menu { position: fixed; inset: auto; margin: 0; padding: 6px 10px; min-width: 140px; border: 1px solid var(--bfilter-border); border-radius: 8px; background: var(--bfilter-paper); color: var(--bfilter-ink); box-shadow: 0 4px 12px var(--bfilter-shadow); font: inherit; }
    .bfilter-types-menu label { display: flex; align-items: center; min-height: 28px; }
    .bfilter-types-menu input { appearance: auto; margin-right: 7px; }
    .bfilter-preview { min-height: 34px; padding: 0 12px; border: 1px solid var(--bfilter-red); border-radius: 8px; background: var(--bfilter-paper); color: var(--bfilter-red); font: 600 12px/1 var(--bfilter-font); cursor: pointer; }
    .bfilter-preview:hover { border-color: var(--bfilter-red); color: var(--bfilter-red); }
    .bfilter-preview[aria-pressed="true"] { background: var(--bfilter-red); border-color: var(--bfilter-red); color: var(--bfilter-white); }
    .bfilter-entry-space { border-radius: 0 6px 0 0; }
    .bfilter-space-block { position: fixed; z-index: 10000; left: 0; box-sizing: border-box; min-height: 28px; padding: 0 2px; border: 1px solid #a10425; border-top: 1px solid #ffffff66; border-radius: 0 0 6px 0; background: #a10425; color: #fff; font: 600 13px/1 sans-serif; white-space: nowrap; cursor: pointer; }
    .bfilter-space-block[aria-pressed="true"] { background: #666; border-color: #666; border-top-color: #ffffff66; }
    .bfilter-space-block:focus-visible { outline: 2px solid #a10425; outline-offset: 3px; }
    .recommended-container_floor-aside .container > :is(.feed-card, .bili-feed-card, .floor-single-card) { margin-top: 0 !important; }
  `;
  document.head.append(style);

  const dashboard = document.createElement("dialog");
  dashboard.className = "bfilter-dashboard";
  dashboard.setAttribute("aria-labelledby", "bfilter-title");
  dashboard.innerHTML = `
    <div class="bfilter-heading"><div class="bfilter-brand"><span class="bfilter-mark" aria-hidden="true"><svg viewBox="0 0 96 80" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M37 5l11 12L59 5M7 40h82M29 67l-5 8m43-8 5 8"/><rect x="20" y="20" width="56" height="47" rx="6"/></svg></span><div><h2 id="bfilter-title"><a href="https://github.com/mr-yifeiwang/bfilter" target="_blank" rel="noopener noreferrer">Bfilter</a></h2><span class="bfilter-version"></span></div></div><div class="bfilter-actions"><button class="bfilter-preview" type="button" aria-pressed="false">Preview</button><button class="bfilter-close" type="button" aria-label="Close">×</button></div></div>
    <section class="bfilter-section" aria-labelledby="bfilter-users-heading">
      <h3 id="bfilter-users-heading">Hide Users</h3>
      <div class="bfilter-registration"><label><input type="checkbox"> <span class="bfilter-filter-name">Registered in &amp; after</span></label><select aria-label="Registration time threshold"><option value="8">2015</option><option value="9">2017</option><option value="10">2020</option><option value="15">2022</option><option value="2025">2025</option></select></div>
      <label class="bfilter-users"><textarea aria-label="UIDs, one per line" placeholder="UIDs, one per line" spellcheck="false"></textarea></label>
      <p class="bfilter-users-count" aria-live="polite"></p>
    </section>
    <section class="bfilter-section" aria-labelledby="bfilter-videos-heading">
      <h3 id="bfilter-videos-heading">Hide Videos</h3>
      <div class="bfilter-duration"><label><input type="checkbox"> <span class="bfilter-filter-name">Duration (min.)</span></label><span class="bfilter-value">&lt; <input type="number" aria-label="Duration (min.)" min="0" step="any"></span></div>
      <div class="bfilter-views"><label><input type="checkbox"> <span class="bfilter-filter-name">Views</span></label><span class="bfilter-value">&lt; <input type="number" aria-label="Views" min="0" step="1"></span></div>
      <div class="bfilter-types"><label><input type="checkbox"> <span class="bfilter-filter-name">Types</span></label><button class="bfilter-types-toggle" type="button" popovertarget="bfilter-types-menu" aria-label="Types"><span class="bfilter-types-count">0</span> ▾</button><div id="bfilter-types-menu" class="bfilter-types-menu" popover><label><input type="checkbox" value="promotional">Promo</label><label><input type="checkbox" value="live">Live</label><label><input type="checkbox" value="bangumi">Bangumi</label><label><input type="checkbox" value="classroom">Classroom</label><label><input type="checkbox" value="manga">Manga</label></div></div>
    </section>`;
  document.body.append(dashboard);
  dashboard.querySelector(".bfilter-version").textContent =
    typeof GM_info === "undefined" ? "" : GM_info.script.version;
  const typesMenu = dashboard.querySelector(".bfilter-types-menu");
  dashboard
    .querySelector(".bfilter-types-toggle")
    .addEventListener("click", (event) => {
      const button = event.currentTarget.getBoundingClientRect();
      typesMenu.style.left = `${Math.max(0, button.right - 140)}px`;
      typesMenu.style.top = `${button.bottom + 4}px`;
    });
  typesMenu.addEventListener("toggle", (event) => {
    if (event.newState !== "open") return;
    const button = dashboard
      .querySelector(".bfilter-types-toggle")
      .getBoundingClientRect();
    if (button.bottom + 4 + typesMenu.offsetHeight > window.innerHeight) {
      typesMenu.style.top = `${Math.max(0, button.top - typesMenu.offsetHeight - 4)}px`;
    }
  });
  dashboard.addEventListener("close", () => {
    if (typesMenu.matches(":popover-open")) typesMenu.hidePopover();
  });
  dashboard
    .querySelector(".bfilter-close")
    .addEventListener("click", () => dashboard.close());

  const users = dashboard.querySelector("textarea");
  const storageKey = "bfilter.users";
  users.value = GM_getValue(storageKey, "");
  const registrationInput = dashboard.querySelector(
    ".bfilter-registration input",
  );
  const registrationThreshold = dashboard.querySelector(
    ".bfilter-registration select",
  );
  const registrationKey = "bfilter.registration";
  const registrationThresholdKey = "bfilter.registrationThreshold";
  registrationInput.checked = GM_getValue(registrationKey, "0") === "1";
  registrationThreshold.value = GM_getValue(registrationThresholdKey, "2025");
  registrationThreshold.disabled = !registrationInput.checked;
  const durationInput = dashboard.querySelector(
    '.bfilter-duration input[type="number"]',
  );
  const durationKey = "bfilter.duration";
  durationInput.value = GM_getValue(durationKey, "3");
  const viewsInput = dashboard.querySelector(
    '.bfilter-views input[type="number"]',
  );
  const viewsKey = "bfilter.views";
  viewsInput.value = GM_getValue(viewsKey, "5000");
  const durationEnabled = dashboard.querySelector(
    '.bfilter-duration input[type="checkbox"]',
  );
  const viewsEnabled = dashboard.querySelector(
    '.bfilter-views input[type="checkbox"]',
  );
  const typesEnabled = dashboard.querySelector(
    '.bfilter-types > label input[type="checkbox"]',
  );
  for (const [input, key, control] of [
    [durationEnabled, "bfilter.durationEnabled", durationInput],
    [viewsEnabled, "bfilter.viewsEnabled", viewsInput],
    [
      typesEnabled,
      "bfilter.typesEnabled",
      dashboard.querySelector(".bfilter-types-toggle"),
    ],
  ]) {
    const syncControl = () => {
      control.disabled = !input.checked;
      if (
        input === typesEnabled &&
        control.disabled &&
        typesMenu.matches(":popover-open")
      ) {
        typesMenu.hidePopover();
      }
    };
    input.checked = GM_getValue(key, "0") === "1";
    syncControl();
    input.addEventListener("change", () => {
      syncControl();
      GM_setValue(key, input.checked ? "1" : "0");
      scanRecommendations(document.body);
    });
    GM_addValueChangeListener(key, (_key, _oldValue, value, remote) => {
      if (remote) {
        input.checked = value === "1";
        syncControl();
        scanRecommendations(document.body);
      }
    });
  }
  const promotionalInput = dashboard.querySelector(
    '.bfilter-types input[value="promotional"]',
  );
  const promotionalKey = "bfilter.promotional";
  promotionalInput.checked = GM_getValue(promotionalKey, "0") === "1";
  const liveInput = dashboard.querySelector(
    '.bfilter-types input[value="live"]',
  );
  const liveKey = "bfilter.live";
  liveInput.checked = GM_getValue(liveKey, "0") === "1";
  const bangumiInput = dashboard.querySelector(
    '.bfilter-types input[value="bangumi"]',
  );
  const bangumiKey = "bfilter.bangumi";
  bangumiInput.checked = GM_getValue(bangumiKey, "0") === "1";
  const classroomInput = dashboard.querySelector(
    '.bfilter-types input[value="classroom"]',
  );
  const classroomKey = "bfilter.classroom";
  classroomInput.checked = GM_getValue(classroomKey, "0") === "1";
  const mangaInput = dashboard.querySelector(
    '.bfilter-types input[value="manga"]',
  );
  const mangaKey = "bfilter.manga";
  mangaInput.checked = GM_getValue(mangaKey, "0") === "1";

  // Keep the dropdown count in sync with the selected types
  function updateTypeCount() {
    dashboard.querySelector(".bfilter-types-count").textContent =
      typesMenu.querySelectorAll("input:checked").length;
  }
  typesMenu.addEventListener("change", updateTypeCount);
  updateTypeCount();
  let blockedUsers = new Set();
  const spaceButton = spaceUid ? document.createElement("button") : null;
  let previewing = false;
  const comments = new Set();
  const hiddenDisplays = new WeakMap();
  const recommendationSelector =
    searchPage || homePage
      ? homePage
        ? ".feed-card .bili-video-card, .floor-single-card, .bili-feed-card > .bili-video-card, .bili-feed-card > .bili-live-card"
        : ".bili-video-card, .bili-live-card, .bangumi-pgc-list .media-card, .search-page-bangumi .media-card, .activity-card"
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
      durationEnabled.checked &&
      durationVideo &&
      durationInput.value !== "" &&
      Number.isFinite(minutes) &&
      minutes > 0 &&
      Number.isFinite(duration) &&
      duration < minutes * 60;
    const viewsText = (
      searchPage || homePage
        ? card.querySelector(
            ".bili-video-card__stats--left .bili-video-card__stats--item",
          )
        : rankingPage
          ? card.querySelector(".detail-state .data-box")
          : card.querySelector(".playinfo .play")?.nextSibling
    )?.textContent
      .trim()
      .replaceAll(",", "");
    const viewsMatch = viewsText?.match(/^(\d+(?:\.\d+)?)\s*([万亿])?$/);
    const views = viewsMatch
      ? Number(viewsMatch[1]) *
        (viewsMatch[2] === "万"
          ? 10000
          : viewsMatch[2] === "亿"
            ? 100000000
            : 1)
      : NaN;
    const minimumViews = Number(viewsInput.value);
    const fewViews =
      durationVideo &&
      viewsEnabled.checked &&
      viewsInput.value !== "" &&
      Number.isFinite(minimumViews) &&
      minimumViews > 0 &&
      Number.isFinite(views) &&
      views < minimumViews;
    const promotional =
      promotionalInput.checked &&
      !!card.querySelector(
        'a[href^="//cm.bilibili.com/"][data-target-url^="https://www.bilibili.com/video/"], a[href^="https://cm.bilibili.com/"][data-target-url^="https://www.bilibili.com/video/"]',
      );
    const live =
      liveInput.checked &&
      !!card.querySelector(
        'a[href^="//live.bilibili.com/"], a[href^="https://live.bilibili.com/"]',
      );
    const bangumi =
      bangumiInput.checked &&
      (card.matches(
        ".bangumi-pgc-list .media-card, .search-page-bangumi .media-card",
      ) ||
        (homePage &&
          !!card.querySelector(
            'a[href^="//www.bilibili.com/bangumi/"], a[href^="https://www.bilibili.com/bangumi/"]',
          )));
    const classroom =
      classroomInput.checked &&
      !!card.querySelector(
        'a[href^="//www.bilibili.com/cheese/"], a[href^="https://www.bilibili.com/cheese/"], a[href^="//m.bilibili.com/cheese/"], a[href^="https://m.bilibili.com/cheese/"]',
      );
    const manga =
      mangaInput.checked &&
      !!card.querySelector(
        'a[href^="//manga.bilibili.com/"], a[href^="https://manga.bilibili.com/"]',
      );
    const filtered =
      (video && matchesUser(uid)) ||
      shortVideo ||
      fewViews ||
      (typesEnabled.checked &&
        (promotional || live || bangumi || classroom || manga));
    setFiltered(card, filtered);
    if (searchPage || homePage) {
      const wrapper = card.querySelector(
        ".bili-video-card__wrap, .bili-live-card__wrap, .floor-card-inner",
      );
      if (wrapper) setFiltered(wrapper, filtered);
    }
    if (searchPage && card.parentElement?.classList.contains("col_3")) {
      setFiltered(card.parentElement, filtered);
    }
    if (
      searchPage &&
      card.matches(".media-card, .activity-card") &&
      card.parentElement?.classList.contains("col_6")
    ) {
      setFiltered(card.parentElement, filtered);
    }
    if (homePage) {
      const slot =
        card.closest(".feed-card") || card.closest(".bili-feed-card");
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

  // Match a blocked UID or the selected registration-time heuristic
  function matchesUser(uid) {
    return (
      blockedUsers.has(uid) ||
      (registrationInput.checked &&
        /^\d+$/.test(uid || "") &&
        (registrationThreshold.value === "2025"
          ? /^35468\d{11,}$/.test(uid)
          : uid.length >= Number(registrationThreshold.value)))
    );
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
    setFiltered(thread, matchesUser(uid));
  }

  // Apply the current UID list to already loaded comments
  function updateUsers() {
    blockedUsers = new Set(
      users.value.split(/[\s,]+/).filter((uid) => /^\d+$/.test(uid)),
    );
    dashboard.querySelector(".bfilter-users-count").textContent =
      `${blockedUsers.size} UID(s) in the blocklist`;
    if (spaceButton) {
      const blocked = blockedUsers.has(spaceUid);
      spaceButton.textContent = blocked ? "Unblock User" : "Block User";
      spaceButton.setAttribute("aria-pressed", String(blocked));
    }
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

  promotionalInput.addEventListener("change", () => {
    GM_setValue(promotionalKey, promotionalInput.checked ? "1" : "0");
    scanRecommendations(document.body);
  });
  GM_addValueChangeListener(
    promotionalKey,
    (_key, _oldValue, newValue, remote) => {
      if (remote) {
        promotionalInput.checked = newValue === "1";
        updateTypeCount();
        scanRecommendations(document.body);
      }
    },
  );

  liveInput.addEventListener("change", () => {
    GM_setValue(liveKey, liveInput.checked ? "1" : "0");
    scanRecommendations(document.body);
  });
  GM_addValueChangeListener(liveKey, (_key, _oldValue, newValue, remote) => {
    if (remote) {
      liveInput.checked = newValue === "1";
      updateTypeCount();
      scanRecommendations(document.body);
    }
  });

  bangumiInput.addEventListener("change", () => {
    GM_setValue(bangumiKey, bangumiInput.checked ? "1" : "0");
    scanRecommendations(document.body);
  });
  GM_addValueChangeListener(bangumiKey, (_key, _oldValue, newValue, remote) => {
    if (remote) {
      bangumiInput.checked = newValue === "1";
      updateTypeCount();
      scanRecommendations(document.body);
    }
  });

  classroomInput.addEventListener("change", () => {
    GM_setValue(classroomKey, classroomInput.checked ? "1" : "0");
    scanRecommendations(document.body);
  });
  GM_addValueChangeListener(
    classroomKey,
    (_key, _oldValue, newValue, remote) => {
      if (remote) {
        classroomInput.checked = newValue === "1";
        updateTypeCount();
        scanRecommendations(document.body);
      }
    },
  );

  mangaInput.addEventListener("change", () => {
    GM_setValue(mangaKey, mangaInput.checked ? "1" : "0");
    scanRecommendations(document.body);
  });
  GM_addValueChangeListener(mangaKey, (_key, _oldValue, newValue, remote) => {
    if (remote) {
      mangaInput.checked = newValue === "1";
      updateTypeCount();
      scanRecommendations(document.body);
    }
  });

  viewsInput.addEventListener("input", () => {
    GM_setValue(viewsKey, viewsInput.value);
    scanRecommendations(document.body);
  });
  GM_addValueChangeListener(viewsKey, (_key, _oldValue, newValue, remote) => {
    if (remote) {
      viewsInput.value = newValue ?? "5000";
      scanRecommendations(document.body);
    }
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

  registrationInput.addEventListener("change", () => {
    registrationThreshold.disabled = !registrationInput.checked;
    GM_setValue(registrationKey, registrationInput.checked ? "1" : "0");
    updateUsers();
  });
  registrationThreshold.addEventListener("change", () => {
    GM_setValue(registrationThresholdKey, registrationThreshold.value);
    updateUsers();
  });
  GM_addValueChangeListener(
    registrationKey,
    (_key, _oldValue, newValue, remote) => {
      if (remote) {
        registrationInput.checked = newValue === "1";
        registrationThreshold.disabled = !registrationInput.checked;
        updateUsers();
      }
    },
  );
  GM_addValueChangeListener(
    registrationThresholdKey,
    (_key, _oldValue, newValue, remote) => {
      if (remote) {
        registrationThreshold.value = newValue ?? "2025";
        updateUsers();
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

  if (spaceButton) {
    spaceButton.type = "button";
    spaceButton.className = "bfilter-space-block";
    spaceButton.addEventListener("click", () => {
      if (blockedUsers.has(spaceUid)) {
        const uid = new RegExp(`(^|[\\s,])${spaceUid}(?=$|[\\s,])`, "g");
        users.value = users.value
          .replace(uid, "$1")
          .replace(/^[\s,]+|[\s,]+$/g, "");
      } else {
        users.value += `${users.value && !users.value.endsWith("\n") ? "\n" : ""}${spaceUid}`;
      }
      users.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  if (videoPage) {
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
  if (spaceButton) button.classList.add("bfilter-entry-space");
  button.innerHTML = `<svg viewBox="0 0 96 80" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M37 5l11 12L59 5M7 40h82M29 67l-5 8m43-8 5 8"/>
    <rect x="20" y="20" width="56" height="47" rx="6"/>
  </svg>Bfilter`;
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");
  let dragStart = null;
  let dragged = false;
  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    dragStart = { y: event.clientY, top: button.getBoundingClientRect().top };
    dragged = false;
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener("pointermove", (event) => {
    if (!dragStart) return;
    const distance = event.clientY - dragStart.y;
    if (!dragged && Math.abs(distance) < 4) return;
    dragged = true;
    button.style.top = `${Math.max(0, Math.min(window.innerHeight - button.offsetHeight - (spaceButton?.offsetHeight || 0), dragStart.top + distance))}px`;
    placeButton();
  });
  button.addEventListener("pointerup", () => {
    dragStart = null;
  });
  button.addEventListener("pointercancel", () => {
    dragStart = null;
    dragged = false;
  });
  button.addEventListener("click", (event) => {
    if (dragged && event.detail !== 0) {
      dragged = false;
      return;
    }
    if (dashboard.open) dashboard.close();
    else {
      dashboard.show();
      users.scrollTop = users.scrollHeight;
      button.setAttribute("aria-expanded", "true");
    }
  });
  dashboard.addEventListener("close", () =>
    button.setAttribute("aria-expanded", "false"),
  );
  dashboard.addEventListener("keydown", (event) => {
    if (event.key === "Escape") dashboard.close();
  });
  document.body.append(button);
  if (spaceButton) document.body.append(spaceButton);

  // Keep the Space action and popup below the fixed launcher
  function placeButton() {
    if (spaceButton) {
      spaceButton.style.top = `${button.getBoundingClientRect().bottom}px`;
      spaceButton.style.width = `${button.getBoundingClientRect().width}px`;
    }
    const top = Math.min(
      (spaceButton || button).getBoundingClientRect().bottom + 4,
      Math.max(8, window.innerHeight - 120),
    );
    dashboard.style.top = `${top}px`;
    dashboard.style.setProperty("--bfilter-popup-top", `${top}px`);
  }

  placeButton();
  window.addEventListener("resize", placeButton);
})();

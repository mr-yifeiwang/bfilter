// ==UserScript==
// @name         Bfilter
// @namespace    https://github.com/mr-yifeiwang/bfilter
// @version      0.30.0
// @description  Manage in-browser Bilibili blocked and followed user lists
// @author       mr-yifeiwang
// @icon         https://raw.githubusercontent.com/mr-yifeiwang/bfilter/master/assets/logo-128x128.png
// @match        https://www.bilibili.com/*
// @match        https://search.bilibili.com/*
// @match        https://space.bilibili.com/*
// @match        https://t.bilibili.com/*
// @run-at       document-start
// @grant        GM_info
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @downloadURL  https://raw.githubusercontent.com/mr-yifeiwang/bfilter/master/main.user.js
// @updateURL    https://raw.githubusercontent.com/mr-yifeiwang/bfilter/master/main.user.js
// ==/UserScript==

(function () {
  "use strict";

  const HIDDEN_ATTR = "data-bfilter-hidden";
  const PREVIEW_ATTR = "data-bfilter-previewed";
  const FOLLOWED_USER_UID_ATTR = "data-bfilter-followed-user-uid";
  const HIDDEN_UID_ATTR = "data-bfilter-hidden-uid";

  const BLOCKED_USER_UIDS_STORAGE_KEY = "bfilter:blocked-user-uids";
  const FOLLOWED_USER_UIDS_STORAGE_KEY = "bfilter:followed-user-uids";
  const HIDE_VIDEOS_BY_KEYWORD_STORAGE_KEY = "bfilter:hide-videos-by-keyword";
  const HIDE_COMMENTS_BY_KEYWORD_STORAGE_KEY =
    "bfilter:hide-comments-by-keyword";
  const HIDE_DANMAKUS_BY_KEYWORD_STORAGE_KEY =
    "bfilter:hide-danmakus-by-keyword";
  const UNIFIED_KEYWORDS_STORAGE_KEY = "bfilter:unified-keywords";
  const ACTIVE_MANAGER_TAB_STORAGE_KEY = "bfilter:active-manager-tab";
  const SETTING_KEYS = {
    hideUsersByRegistrationTime: "bfilter:hide-users-by-registration-time",
    hideUsersByRegistrationTimeThreshold:
      "bfilter:hide-users-by-registration-time-threshold",
    hideCommentsByMentionsOnly: "bfilter:hide-comments-by-mentions-only",
    hideCommentsByImagesAttached: "bfilter:hide-comments-by-images-attached",
    hideCommentsByCommenterLevel: "bfilter:hide-comments-by-commenter-level",
    hideCommentsByCommenterLevelThreshold:
      "bfilter:hide-comments-by-commenter-level-threshold",
    previewMode: "bfilter:preview-mode",
    hideVideosByDuration: "bfilter:hide-videos-by-duration",
    hideVideosByDurationThreshold: "bfilter:hide-videos-by-duration-threshold",
    hideVideosByViews: "bfilter:hide-videos-by-views",
    hideVideosByViewsThreshold: "bfilter:hide-videos-by-views-threshold",
    hideVideosByType: "bfilter:hide-videos-by-type",
    hideVideosByTypeLive: "bfilter:hide-videos-by-type-live",
    hideVideosByTypeManga: "bfilter:hide-videos-by-type-manga",
    hideVideosByTypeCourse: "bfilter:hide-videos-by-type-course",
    hideVideosByTypeBangumi: "bfilter:hide-videos-by-type-bangumi",
    addUsernamesToFollowedUserUids:
      "bfilter:add-usernames-to-followed-user-uids",
    showStatisticsOverlay: "bfilter:show-statistics-overlay",
    unifiedKeywordsMode: "bfilter:unified-keywords-mode",
  };

  const BLOCK_BUTTON_ID = "bfilter-block-button";
  const FOLLOW_BUTTON_ID = "bfilter-follow-button";
  const MANAGER_BUTTON_ID = "bfilter-manager-button";
  const STYLE_ID = "bfilter-style";
  const FLOATING_BUTTON_CLASS = "bfilter-floating-button";
  const PROFILE_BUTTON_CLASS = "bfilter-profile-button";
  const MANAGER_PANEL_ID = "bfilter-manager-panel";
  const STATISTICS_OVERLAY_ID = "bfilter-statistics-overlay";
  const SCRIPT_VERSION =
    typeof GM_info !== "undefined" && GM_info.script && GM_info.script.version;
  const MANAGER_BLOCKED_USER_UIDS_TEXTAREA_ID =
    "bfilter-manager-blocked-user-uids-textarea";
  const MANAGER_FOLLOWED_USER_UIDS_TEXTAREA_ID =
    "bfilter-manager-followed-user-uids-textarea";
  const MANAGER_HIDE_VIDEOS_BY_KEYWORD_TEXTAREA_ID =
    "bfilter-manager-hide-videos-by-keyword-textarea";
  const MANAGER_HIDE_COMMENTS_BY_KEYWORD_TEXTAREA_ID =
    "bfilter-manager-hide-comments-by-keyword-textarea";
  const MANAGER_HIDE_DANMAKUS_BY_KEYWORD_TEXTAREA_ID =
    "bfilter-manager-hide-danmakus-by-keyword-textarea";
  const MANAGER_UNIFIED_KEYWORDS_TEXTAREA_ID =
    "bfilter-manager-unified-keywords-textarea";

  const COMMENT_BLOCK_BUTTON_CLASS = "bfilter-comment-block-button";
  const BLOCK_ALL_COMMENTERS_BUTTON_CLASS =
    "bfilter-block-all-commenters-button";

  const MAX_ANCESTOR_STEPS = 8;
  const MAX_CARD_AREA_RATIO = 0.75;
  const VIDEO_PATH_RE = /\/video\//i;
  const OPUS_PATH_RE = /^\/opus\//i;
  const UID_ATTRS = ["data-usercard-mid", "data-mid", "mid"];

  const CARD_SELECTOR = [
    ".bili-video-card",
    ".bili-video-card__wrap",
    ".video-card",
    ".video-card-common",
    ".video-card-reco",
    ".feed-card",
    ".bili-feed-card",
    ".floor-single-card",
    ".floor-card",
    ".floor-card-inner",
    ".rank-item",
    ".rank-list-item",
    ".small-item",
    ".card-box",
    ".video-list-item",
    ".list-item",
    ".video-item",
    ".result-item",
    ".search-result-item",
    ".search-card",
    ".search-video-card",
    ".bili-video-item",
    '[class*="video-card"]',
    '[class*="VideoCard"]',
    '[class*="video-item"]',
    '[class*="VideoItem"]',
    '[class*="result-item"]',
    '[class*="ResultItem"]',
  ].join(",");
  const BILI_VIDEO_CARD_INFO_SELECTOR = ".bili-video-card__info";
  const BILI_VIDEO_CARD_CONTAINER_SELECTOR =
    ".bili-video-card__wrap, .bili-video-card";
  const BILI_VIDEO_CARD_VIEW_STAT_SELECTOR =
    ".bili-video-card__stats--left > .bili-video-card__stats--item";

  const VIDEO_LINK_SELECTOR = [
    'a[href*="/video/"]',
    'a[href*="bilibili.com/video/"]',
    'a[href*="/bangumi/play/"]',
  ].join(",");

  const TYPE_VIDEO_LINK_SELECTORS = {
    live: 'a[href*="live.bilibili.com/"]',
    manga: 'a[href*="manga.bilibili.com/"]',
    course: 'a[href*="bilibili.com/cheese/"]',
    bangumi: 'a[href*="bilibili.com/bangumi/"]',
  };
  const TYPE_VIDEO_LINK_SELECTOR = Object.values(
    TYPE_VIDEO_LINK_SELECTORS,
  ).join(",");

  const UPLOADER_SELECTOR = [
    'a[href*="space.bilibili.com/"]',
    "[data-usercard-mid]",
    "[data-mid]",
    "[mid]",
  ].join(",");

  const TITLE_SELECTOR =
    '[title], h1, h2, h3, [class*="title"], [class*="Title"]';
  const VISUAL_SELECTOR =
    'img, picture, svg, [class*="cover"], [class*="thumb"], [class*="pic"]';
  const DURATION_SELECTOR = '[class*="duration"], [class*="Duration"]';
  const STAT_SELECTOR =
    '[class*="play"], [class*="Play"], [class*="view"], [class*="View"], [class*="stat"], [class*="Stat"]';

  const RECOMMENDATION_AREA_SELECTOR = [
    ".recommend-list",
    ".recommend-container",
    ".right-container",
    ".video-card-reco",
    ".video-page-card-small",
    '[class*="recommend"]',
    '[class*="Recommend"]',
    '[class*="reco"]',
    '[class*="Reco"]',
  ].join(",");
  const RECOMMENDATION_CARD_CONTAINER_SELECTOR = [
    ".video-page-card-small",
    '[class*="col_"][class*="mb_"]',
  ].join(",");
  const SEARCH_PROTECTED_VIDEO_CARD_SELECTOR = ".b-user-video-card";
  const VIDEO_OWNER_SELECTOR = [
    '.up-info-container .up-name[href*="space.bilibili.com/"]',
    '.up-info .up-name[href*="space.bilibili.com/"]',
    '.up-info-right a[href*="space.bilibili.com/"]',
    '.video-owner a[href*="space.bilibili.com/"]',
    '.owner a[href*="space.bilibili.com/"]',
    '.members-info a[href*="space.bilibili.com/"]',
    '.staff-info a[href*="space.bilibili.com/"]',
    '[class*="up-info"] a[href*="space.bilibili.com/"]',
    '[class*="UpInfo"] a[href*="space.bilibili.com/"]',
    '[class*="owner"] a[href*="space.bilibili.com/"]',
    '[class*="Owner"] a[href*="space.bilibili.com/"]',
  ].join(",");

  const COMMENT_ITEM_SELECTOR = ".reply-item, .sub-reply-item";
  const COMMENT_USER_LINK_SELECTOR =
    'a.user-name[href*="space.bilibili.com/"], a.sub-user-name[href*="space.bilibili.com/"]';
  const COMMENT_TEXT_SELECTOR =
    ".reply-content, .reply-text, .sub-reply-content";
  const COMMENT_MENTION_LINK_SELECTOR =
    'a.jump-link.user[href*="space.bilibili.com/"]';
  const COMMENT_ATTACHMENT_SELECTOR = ".image-exhibition img";

  const DANMAKU_SELECTOR = [
    ".bpx-player-row-dm-wrap .bili-danmaku-x-dm",
    ".bpx-player-dm li.bui-long-list-item",
  ].join(",");
  const DANMAKU_TEXT_SELECTOR = ".dm-info-dm";

  const REGISTRATION_TIME_THRESHOLD_OPTIONS = [
    { label: "> 2015", minDigits: 8 },
    { label: "> 2017", minDigits: 9 },
    { label: "> 2020", minDigits: 10 },
    { label: "> 2022", minDigits: 15 },
  ];
  const DEFAULT_REGISTRATION_TIME_THRESHOLD = "> 2022";

  const VIDEO_DURATION_THRESHOLD_OPTIONS = [
    { label: "< 1 min", seconds: 60 },
    { label: "< 3 min", seconds: 3 * 60 },
    { label: "< 5 min", seconds: 5 * 60 },
    { label: "< 10 min", seconds: 10 * 60 },
    { label: "< 20 min", seconds: 20 * 60 },
  ];
  const DEFAULT_VIDEO_DURATION_THRESHOLD = "< 1 min";

  const VIDEO_VIEWS_THRESHOLD_OPTIONS = [
    { label: "< 1k", displayLabel: "< 1k", views: 1000 },
    { label: "< 5k", displayLabel: "< 5k", views: 5000 },
    { label: "< 10k", displayLabel: "< 10k", views: 10000 },
    { label: "< 50k", displayLabel: "< 50k", views: 50000 },
    { label: "< 100k", displayLabel: "< 100k", views: 100000 },
  ];
  const DEFAULT_VIDEO_VIEWS_THRESHOLD = "< 1k";

  const COMMENTER_LEVEL_THRESHOLD_OPTIONS = [
    { label: "≤ 1", maxLevel: 1 },
    { label: "≤ 2", maxLevel: 2 },
    { label: "≤ 3", maxLevel: 3 },
    { label: "≤ 4", maxLevel: 4 },
    { label: "≤ 5", maxLevel: 5 },
  ];
  const DEFAULT_COMMENTER_LEVEL_THRESHOLD = "≤ 2";

  const BOOLEAN_CONTROLS = [
    {
      name: "unifiedKeywordsMode",
      id: "bfilter-manager-unified-keywords-mode",
      label: "Enable Unified Keywords mode",
      settingsOption: true,
      toggle: true,
    },
    {
      name: "hideUsersByRegistrationTime",
      id: "bfilter-manager-hide-users-by-registration-time",
      label: "Hide by registration time",
      threshold: {
        setting: "hideUsersByRegistrationTimeThreshold",
        key: SETTING_KEYS.hideUsersByRegistrationTimeThreshold,
        id: "bfilter-manager-hide-users-by-registration-time-threshold",
        options: REGISTRATION_TIME_THRESHOLD_OPTIONS,
        defaultValue: DEFAULT_REGISTRATION_TIME_THRESHOLD,
        fallbackIndex: REGISTRATION_TIME_THRESHOLD_OPTIONS.length - 1,
      },
    },
    {
      name: "hideVideosByDuration",
      id: "bfilter-manager-hide-videos-by-duration",
      label: "Hide by duration",
      threshold: {
        setting: "hideVideosByDurationThreshold",
        key: SETTING_KEYS.hideVideosByDurationThreshold,
        id: "bfilter-manager-hide-videos-by-duration-threshold",
        options: VIDEO_DURATION_THRESHOLD_OPTIONS,
        defaultValue: DEFAULT_VIDEO_DURATION_THRESHOLD,
        fallbackIndex: 2,
      },
    },
    {
      name: "hideVideosByViews",
      id: "bfilter-manager-hide-videos-by-views",
      label: "Hide by views",
      threshold: {
        setting: "hideVideosByViewsThreshold",
        key: SETTING_KEYS.hideVideosByViewsThreshold,
        id: "bfilter-manager-hide-videos-by-views-threshold",
        options: VIDEO_VIEWS_THRESHOLD_OPTIONS,
        defaultValue: DEFAULT_VIDEO_VIEWS_THRESHOLD,
        fallbackIndex: 2,
      },
    },
    {
      name: "hideVideosByType",
      id: "bfilter-manager-hide-videos-by-type",
      label: "Hide by type",
    },
    {
      name: "hideVideosByTypeLive",
      id: "bfilter-manager-hide-videos-by-type-live",
      label: "Live",
      defaultValue: false,
      childOf: "hideVideosByType",
    },
    {
      name: "hideVideosByTypeManga",
      id: "bfilter-manager-hide-videos-by-type-manga",
      label: "Manga",
      defaultValue: false,
      childOf: "hideVideosByType",
    },
    {
      name: "hideVideosByTypeCourse",
      id: "bfilter-manager-hide-videos-by-type-course",
      label: "Course",
      defaultValue: false,
      childOf: "hideVideosByType",
    },
    {
      name: "hideVideosByTypeBangumi",
      id: "bfilter-manager-hide-videos-by-type-bangumi",
      label: "Bangumi",
      defaultValue: false,
      childOf: "hideVideosByType",
    },
    {
      name: "hideCommentsByMentionsOnly",
      id: "bfilter-manager-hide-comments-by-mentions-only",
      label: "Hide by mentions only",
      commentOption: true,
    },
    {
      name: "hideCommentsByImagesAttached",
      id: "bfilter-manager-hide-comments-by-images-attached",
      label: "Hide by images attached",
      commentOption: true,
    },
    {
      name: "hideCommentsByCommenterLevel",
      id: "bfilter-manager-hide-comments-by-commenter-level",
      label: "Hide by commenter level",
      commentOption: true,
      threshold: {
        setting: "hideCommentsByCommenterLevelThreshold",
        key: SETTING_KEYS.hideCommentsByCommenterLevelThreshold,
        id: "bfilter-manager-hide-comments-by-commenter-level-threshold",
        options: COMMENTER_LEVEL_THRESHOLD_OPTIONS,
        defaultValue: DEFAULT_COMMENTER_LEVEL_THRESHOLD,
        fallbackIndex: 1,
      },
    },
    {
      name: "previewMode",
      id: "bfilter-manager-preview-mode",
      label: "Preview",
      previewToggle: true,
    },
    {
      name: "addUsernamesToFollowedUserUids",
      id: "bfilter-manager-add-usernames-to-followed-user-uids",
      label: "Add usernames by default",
      defaultValue: true,
      followedUserUidsOption: true,
    },
  ];

  const DEFAULT_SETTINGS = getDefaultSettings();
  const BLOCKED_USER_UIDS = new Set();
  const FOLLOWED_USER_UIDS = new Set();
  const HIDDEN_VIDEOS_BY_KEYWORD = new Set();
  const HIDDEN_COMMENTS_BY_KEYWORD = new Set();
  const HIDDEN_DANMAKUS_BY_KEYWORD = new Set();
  const HIDDEN_UNIFIED_KEYWORDS = new Set();
  const settings = { ...DEFAULT_SETTINGS };
  let managerTextareaStates = {};

  let scheduled = false;
  let scanEpoch = 0;
  let observerStarted = false;
  const pendingRoots = new Set();
  let statistics = createStatistics();

  addStyle();
  boot();

  function boot() {
    replaceRuntimeBlockedUserUids(
      parseBlockedUserUidsListText(readSavedBlockedUserUidsListText()),
    );
    replaceRuntimeFollowedUserUids(
      parseFollowedUserUidsListText(readSavedFollowedUserUidsListText()),
    );
    replaceRuntimeHiddenVideosByKeyword(
      parseHideVideosByKeywordListText(readSavedHideVideosByKeywordListText()),
    );
    replaceRuntimeHiddenCommentsByKeyword(
      parseHideCommentsByKeywordListText(
        readSavedHideCommentsByKeywordListText(),
      ),
    );
    replaceRuntimeHiddenDanmakusByKeyword(
      parseHideDanmakusByKeywordListText(
        readSavedHideDanmakusByKeywordListText(),
      ),
    );
    replaceRuntimeUnifiedKeywords(
      parseUnifiedKeywordsListText(readSavedUnifiedKeywordsListText()),
    );
    for (const { name } of BOOLEAN_CONTROLS) {
      settings[name] = readBooleanSetting(
        SETTING_KEYS[name],
        DEFAULT_SETTINGS[name],
      );
    }
    for (const control of getThresholdControls()) {
      settings[control.threshold.setting] = readLabelSetting(
        control.threshold.key,
        control.threshold.defaultValue,
        control.threshold.options,
      );
    }
    settings.showStatisticsOverlay = readBooleanSetting(
      SETTING_KEYS.showStatisticsOverlay,
      DEFAULT_SETTINGS.showStatisticsOverlay,
    );

    setupStorageSync();
    renderUserPageActionButtons();
    renderBfilterManager();

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }

    window.addEventListener("pageshow", refreshChromeAndScan);
    patchHistory("pushState");
    patchHistory("replaceState");
    window.addEventListener("popstate", () =>
      setTimeout(refreshChromeAndScan, 0),
    );
  }

  function start() {
    refreshChromeAndScan();
    if (observerStarted || !document.documentElement) return;
    observerStarted = true;

    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const node of mutation.addedNodes) scheduleScan(node);
        } else if (mutation.type === "characterData") {
          scheduleScan(mutation.target.parentElement);
        } else {
          scheduleScan(mutation.target);
        }
      }
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["href", "class", "title", "alt", ...UID_ATTRS],
    });
  }

  function refreshChromeAndScan() {
    resetStatistics();
    resetScanQueue();
    renderUserPageActionButtons();
    renderBfilterManager();
    renderStatisticsOverlay();
    renderBlockAllCommentersButton();
    scheduleScan(document.documentElement, { force: true });
  }

  function patchHistory(methodName) {
    const original = history[methodName];
    history[methodName] = function patchedHistoryMethod(...args) {
      const result = original.apply(this, args);
      setTimeout(refreshChromeAndScan, 0);
      return result;
    };
  }

  function isContentScanningPage() {
    // Deliberately exclude space.bilibili.com from card/comment scanning.
    return !isUserPage() && isBfilterManagerPage();
  }

  function isBfilterManagerPage() {
    return (
      isBilibiliHomePage() ||
      isPopularPage() ||
      isSearchPage() ||
      isDirectVideoPage() ||
      isUserPage() ||
      isOpusPage() ||
      isTPage()
    );
  }

  function isBilibiliHomePage() {
    return (
      location.hostname === "www.bilibili.com" && location.pathname === "/"
    );
  }

  function isSearchPage() {
    return location.hostname === "search.bilibili.com";
  }

  function isPopularPage() {
    return (
      location.hostname === "www.bilibili.com" &&
      /^\/v\/popular(?:\/|$)/.test(location.pathname)
    );
  }

  function isDirectVideoPage() {
    return (
      location.hostname === "www.bilibili.com" &&
      VIDEO_PATH_RE.test(location.pathname)
    );
  }

  function isOpusPage() {
    return (
      location.hostname === "www.bilibili.com" &&
      OPUS_PATH_RE.test(location.pathname)
    );
  }

  function isTPage() {
    return location.hostname === "t.bilibili.com";
  }

  function getCurrentUserPageUid() {
    if (!isUserPage()) return "";
    const match = location.pathname.match(/^\/(\d+)(?:\/|$)/);
    return match ? normalizeUid(match[1]) : "";
  }

  function getCurrentUserPageUsername() {
    if (!isUserPage()) return "";
    const element = document.querySelector(".nickname");
    return element ? String(element.textContent || "").trim() : "";
  }

  function isUserPage() {
    if (location.hostname !== "space.bilibili.com") return false;
    return /^\/\d+(?:\/|$)/.test(location.pathname);
  }

  function setupStorageSync() {
    if (typeof GM_addValueChangeListener === "function") {
      GM_addValueChangeListener(
        BLOCKED_USER_UIDS_STORAGE_KEY,
        (_key, _oldValue, value, remote) => {
          if (remote) syncBlockedUserUids(value);
        },
      );
      GM_addValueChangeListener(
        FOLLOWED_USER_UIDS_STORAGE_KEY,
        (_key, _oldValue, value, remote) => {
          if (remote) syncFollowedUserUids(value);
        },
      );
      GM_addValueChangeListener(
        HIDE_VIDEOS_BY_KEYWORD_STORAGE_KEY,
        (_key, _oldValue, value, remote) => {
          if (remote) syncHiddenVideosByKeyword(value);
        },
      );
      GM_addValueChangeListener(
        HIDE_COMMENTS_BY_KEYWORD_STORAGE_KEY,
        (_key, _oldValue, value, remote) => {
          if (remote) syncHiddenCommentsByKeyword(value);
        },
      );
      GM_addValueChangeListener(
        HIDE_DANMAKUS_BY_KEYWORD_STORAGE_KEY,
        (_key, _oldValue, value, remote) => {
          if (remote) syncHiddenDanmakusByKeyword(value);
        },
      );
      GM_addValueChangeListener(
        UNIFIED_KEYWORDS_STORAGE_KEY,
        (_key, _oldValue, value, remote) => {
          if (remote) syncUnifiedKeywords(value);
        },
      );
      for (const { name } of BOOLEAN_CONTROLS) {
        GM_addValueChangeListener(
          SETTING_KEYS[name],
          (_key, _oldValue, value, remote) => {
            if (remote) syncBooleanSetting(name, value);
          },
        );
      }
      GM_addValueChangeListener(
        SETTING_KEYS.showStatisticsOverlay,
        (_key, _oldValue, value, remote) => {
          if (remote) syncShowStatisticsOverlay(value);
        },
      );
      for (const control of getThresholdControls()) {
        GM_addValueChangeListener(
          control.threshold.key,
          (_key, _oldValue, value, remote) => {
            if (remote) syncThresholdSetting(control, value);
          },
        );
      }
      return;
    }

    window.addEventListener("storage", (event) => {
      if (event.key === BLOCKED_USER_UIDS_STORAGE_KEY)
        syncBlockedUserUids(event.newValue);
      if (event.key === FOLLOWED_USER_UIDS_STORAGE_KEY)
        syncFollowedUserUids(event.newValue);
      if (event.key === HIDE_VIDEOS_BY_KEYWORD_STORAGE_KEY)
        syncHiddenVideosByKeyword(event.newValue);
      if (event.key === HIDE_COMMENTS_BY_KEYWORD_STORAGE_KEY)
        syncHiddenCommentsByKeyword(event.newValue);
      if (event.key === HIDE_DANMAKUS_BY_KEYWORD_STORAGE_KEY)
        syncHiddenDanmakusByKeyword(event.newValue);
      if (event.key === UNIFIED_KEYWORDS_STORAGE_KEY)
        syncUnifiedKeywords(event.newValue);
      for (const { name } of BOOLEAN_CONTROLS) {
        if (event.key === SETTING_KEYS[name])
          syncBooleanSetting(name, event.newValue);
      }
      if (event.key === SETTING_KEYS.showStatisticsOverlay)
        syncShowStatisticsOverlay(event.newValue);
      for (const control of getThresholdControls()) {
        if (event.key === control.threshold.key)
          syncThresholdSetting(control, event.newValue);
      }
    });
  }

  function syncBlockedUserUids(savedValue) {
    replaceRuntimeBlockedUserUids(
      parseBlockedUserUidsListText(savedValue || ""),
    );
    refreshConsequences();
    refreshBfilterManagerPanel();
    renderUserPageActionButtons();
  }

  function syncFollowedUserUids(savedValue) {
    replaceRuntimeFollowedUserUids(
      parseFollowedUserUidsListText(savedValue || ""),
    );
    refreshConsequences();
    refreshBfilterManagerPanel();
    renderUserPageActionButtons();
  }

  function syncHiddenVideosByKeyword(savedValue) {
    replaceRuntimeHiddenVideosByKeyword(
      parseHideVideosByKeywordListText(savedValue || ""),
    );
    refreshConsequences();
    refreshBfilterManagerPanel();
  }

  function syncHiddenCommentsByKeyword(savedValue) {
    replaceRuntimeHiddenCommentsByKeyword(
      parseHideCommentsByKeywordListText(savedValue || ""),
    );
    refreshConsequences();
    refreshBfilterManagerPanel();
  }

  function syncHiddenDanmakusByKeyword(savedValue) {
    replaceRuntimeHiddenDanmakusByKeyword(
      parseHideDanmakusByKeywordListText(savedValue || ""),
    );
    refreshConsequences();
    refreshBfilterManagerPanel();
  }

  function syncUnifiedKeywords(savedValue) {
    delete managerTextareaStates[MANAGER_UNIFIED_KEYWORDS_TEXTAREA_ID];
    replaceRuntimeUnifiedKeywords(
      parseUnifiedKeywordsListText(savedValue || ""),
    );
    refreshConsequences();
    refreshBfilterManagerPanel();
  }

  function syncBooleanSetting(name, savedValue) {
    settings[name] = parseBooleanSetting(savedValue, DEFAULT_SETTINGS[name]);
    refreshConsequences();
    refreshBooleanControls();
    if (name === "unifiedKeywordsMode") rerenderBfilterManagerPanel();
    renderUserPageActionButtons();
  }

  function syncShowStatisticsOverlay(savedValue) {
    settings.showStatisticsOverlay = parseBooleanSetting(
      savedValue,
      DEFAULT_SETTINGS.showStatisticsOverlay,
    );
    refreshStatisticsOverlayToggle();
    renderStatisticsOverlay();
  }

  function syncThresholdSetting(control, savedValue) {
    const { setting, defaultValue, options } = control.threshold;
    settings[setting] = parseLabelSetting(savedValue, defaultValue, options);
    refreshConsequences();
    refreshThresholdControls();
    renderUserPageActionButtons();
  }

  function readSavedBlockedUserUidsListText() {
    try {
      const saved =
        typeof GM_getValue === "function"
          ? GM_getValue(BLOCKED_USER_UIDS_STORAGE_KEY, null)
          : localStorage.getItem(BLOCKED_USER_UIDS_STORAGE_KEY);
      return String(saved || "");
    } catch (_error) {
      return "";
    }
  }

  function readSavedFollowedUserUidsListText() {
    try {
      const saved =
        typeof GM_getValue === "function"
          ? GM_getValue(FOLLOWED_USER_UIDS_STORAGE_KEY, null)
          : localStorage.getItem(FOLLOWED_USER_UIDS_STORAGE_KEY);
      return String(saved || "");
    } catch (_error) {
      return "";
    }
  }

  function readSavedHideVideosByKeywordListText() {
    try {
      const saved =
        typeof GM_getValue === "function"
          ? GM_getValue(HIDE_VIDEOS_BY_KEYWORD_STORAGE_KEY, null)
          : localStorage.getItem(HIDE_VIDEOS_BY_KEYWORD_STORAGE_KEY);
      return String(saved || "");
    } catch (_error) {
      return "";
    }
  }

  function readSavedHideCommentsByKeywordListText() {
    try {
      const saved =
        typeof GM_getValue === "function"
          ? GM_getValue(HIDE_COMMENTS_BY_KEYWORD_STORAGE_KEY, null)
          : localStorage.getItem(HIDE_COMMENTS_BY_KEYWORD_STORAGE_KEY);
      return String(saved || "");
    } catch (_error) {
      return "";
    }
  }

  function readSavedHideDanmakusByKeywordListText() {
    try {
      const saved =
        typeof GM_getValue === "function"
          ? GM_getValue(HIDE_DANMAKUS_BY_KEYWORD_STORAGE_KEY, null)
          : localStorage.getItem(HIDE_DANMAKUS_BY_KEYWORD_STORAGE_KEY);
      return String(saved || "");
    } catch (_error) {
      return "";
    }
  }

  function readSavedUnifiedKeywordsListText() {
    try {
      const saved =
        typeof GM_getValue === "function"
          ? GM_getValue(UNIFIED_KEYWORDS_STORAGE_KEY, null)
          : localStorage.getItem(UNIFIED_KEYWORDS_STORAGE_KEY);
      return String(saved || "");
    } catch (_error) {
      return "";
    }
  }

  function readBooleanSetting(key, defaultValue) {
    try {
      const saved =
        typeof GM_getValue === "function"
          ? GM_getValue(key, defaultValue)
          : localStorage.getItem(key);
      return parseBooleanSetting(saved, defaultValue);
    } catch (_error) {
      return defaultValue;
    }
  }

  function parseBooleanSetting(saved, defaultValue) {
    if (saved == null) return defaultValue;
    if (saved === true || saved === "true") return true;
    if (saved === false || saved === "false") return false;
    try {
      return JSON.parse(saved) === true;
    } catch (_error) {
      return defaultValue;
    }
  }

  function saveBooleanSetting(key, value) {
    try {
      if (typeof GM_setValue === "function") GM_setValue(key, Boolean(value));
      else localStorage.setItem(key, String(Boolean(value)));
    } catch (_error) {
      // Keep runtime setting even if persistence fails.
    }
  }

  function readLabelSetting(key, defaultValue, options) {
    try {
      const saved =
        typeof GM_getValue === "function"
          ? GM_getValue(key, defaultValue)
          : localStorage.getItem(key);
      return parseLabelSetting(saved, defaultValue, options);
    } catch (_error) {
      return defaultValue;
    }
  }

  function parseLabelSetting(saved, defaultValue, options) {
    if (saved == null) return defaultValue;
    const value = String(saved).trim();
    return options.some((option) => option.label === value)
      ? value
      : defaultValue;
  }

  function saveLabelSetting(key, value) {
    try {
      if (typeof GM_setValue === "function") GM_setValue(key, value);
      else localStorage.setItem(key, value);
    } catch (_error) {
      // Keep runtime setting even if persistence fails.
    }
  }

  function replaceRuntimeBlockedUserUids(nextUids) {
    const next = new Set(nextUids.map(normalizeUid).filter(Boolean));
    for (const uid of [...BLOCKED_USER_UIDS]) {
      if (!next.has(uid)) {
        BLOCKED_USER_UIDS.delete(uid);
        clearConsequencesForUid(uid);
      }
    }
    for (const uid of next) BLOCKED_USER_UIDS.add(uid);
  }

  function replaceRuntimeFollowedUserUids(nextUids) {
    FOLLOWED_USER_UIDS.clear();
    for (const uid of nextUids.map(normalizeUid).filter(Boolean))
      FOLLOWED_USER_UIDS.add(uid);
  }

  function replaceRuntimeHiddenVideosByKeyword(nextKeywords) {
    HIDDEN_VIDEOS_BY_KEYWORD.clear();
    for (const keyword of dedupeKeywords(nextKeywords)) {
      HIDDEN_VIDEOS_BY_KEYWORD.add(keyword);
    }
  }

  function replaceRuntimeHiddenCommentsByKeyword(nextKeywords) {
    HIDDEN_COMMENTS_BY_KEYWORD.clear();
    for (const keyword of dedupeKeywords(nextKeywords)) {
      HIDDEN_COMMENTS_BY_KEYWORD.add(keyword);
    }
  }

  function replaceRuntimeHiddenDanmakusByKeyword(nextKeywords) {
    HIDDEN_DANMAKUS_BY_KEYWORD.clear();
    for (const keyword of dedupeKeywords(nextKeywords)) {
      HIDDEN_DANMAKUS_BY_KEYWORD.add(keyword);
    }
  }

  function replaceRuntimeUnifiedKeywords(nextKeywords) {
    HIDDEN_UNIFIED_KEYWORDS.clear();
    for (const keyword of dedupeKeywords(nextKeywords))
      HIDDEN_UNIFIED_KEYWORDS.add(keyword);
  }

  function saveBlockedUserUidsListText(textValue) {
    try {
      const value =
        textValue == null ? getBlockedUserUidsList().join("\n") : textValue;
      if (typeof GM_setValue === "function")
        GM_setValue(BLOCKED_USER_UIDS_STORAGE_KEY, value);
      else localStorage.setItem(BLOCKED_USER_UIDS_STORAGE_KEY, value);
    } catch (_error) {
      // Keep the runtime blocked user list even if persistence fails.
    }
  }

  function saveFollowedUserUidsListText(textValue) {
    try {
      const value =
        textValue == null ? getFollowedUserUidsList().join("\n") : textValue;
      if (typeof GM_setValue === "function")
        GM_setValue(FOLLOWED_USER_UIDS_STORAGE_KEY, value);
      else localStorage.setItem(FOLLOWED_USER_UIDS_STORAGE_KEY, value);
    } catch (_error) {
      // Keep the runtime followed user list even if persistence fails.
    }
  }

  function saveHideVideosByKeywordListText(textValue) {
    try {
      const value =
        textValue == null
          ? getHideVideosByKeywordList().join("\n")
          : normalizeKeywordListText(textValue);
      if (typeof GM_setValue === "function")
        GM_setValue(HIDE_VIDEOS_BY_KEYWORD_STORAGE_KEY, value);
      else localStorage.setItem(HIDE_VIDEOS_BY_KEYWORD_STORAGE_KEY, value);
    } catch (_error) {
      // Keep runtime video keywords even if persistence fails.
    }
  }

  function saveHideCommentsByKeywordListText(textValue) {
    try {
      const value =
        textValue == null
          ? getHideCommentsByKeywordList().join("\n")
          : normalizeKeywordListText(textValue);
      if (typeof GM_setValue === "function")
        GM_setValue(HIDE_COMMENTS_BY_KEYWORD_STORAGE_KEY, value);
      else localStorage.setItem(HIDE_COMMENTS_BY_KEYWORD_STORAGE_KEY, value);
    } catch (_error) {
      // Keep runtime comment keywords even if persistence fails.
    }
  }

  function saveHideDanmakusByKeywordListText(textValue) {
    try {
      const value =
        textValue == null
          ? getHideDanmakusByKeywordList().join("\n")
          : normalizeKeywordListText(textValue);
      if (typeof GM_setValue === "function")
        GM_setValue(HIDE_DANMAKUS_BY_KEYWORD_STORAGE_KEY, value);
      else localStorage.setItem(HIDE_DANMAKUS_BY_KEYWORD_STORAGE_KEY, value);
    } catch (_error) {
      // Keep runtime danmaku keywords even if persistence fails.
    }
  }

  function saveUnifiedKeywordsListText(textValue) {
    try {
      const value =
        textValue == null
          ? getUnifiedKeywordsList().join("\n")
          : normalizeKeywordListText(textValue);
      if (typeof GM_setValue === "function")
        GM_setValue(UNIFIED_KEYWORDS_STORAGE_KEY, value);
      else localStorage.setItem(UNIFIED_KEYWORDS_STORAGE_KEY, value);
    } catch (_error) {
      // Keep runtime unified keywords even if persistence fails.
    }
  }

  function setBooleanSetting(name, value) {
    settings[name] = Boolean(value);
    saveBooleanSetting(SETTING_KEYS[name], settings[name]);
    refreshConsequences();
    if (name === "unifiedKeywordsMode") rerenderBfilterManagerPanel();
    renderUserPageActionButtons();
  }

  function setShowStatisticsOverlay(value) {
    settings.showStatisticsOverlay = Boolean(value);
    saveBooleanSetting(
      SETTING_KEYS.showStatisticsOverlay,
      settings.showStatisticsOverlay,
    );
    refreshStatisticsOverlayToggle();
    renderStatisticsOverlay();
  }

  function setVideoType(selectedOptions) {
    const selected = new Set(
      [...selectedOptions].map((option) => option.value).filter(Boolean),
    );
    for (const control of BOOLEAN_CONTROLS.filter(
      (child) => child.childOf === "hideVideosByType",
    )) {
      settings[control.name] = selected.has(control.name);
      saveBooleanSetting(SETTING_KEYS[control.name], settings[control.name]);
    }
    refreshConsequences();
  }

  function setThresholdIndex(control, index) {
    const { setting, key, options } = control.threshold;
    const option = options[Number(index)];
    if (!option || settings[setting] === option.label) return;
    settings[setting] = option.label;
    saveLabelSetting(key, settings[setting]);
    refreshConsequences();
    renderUserPageActionButtons();
  }

  function getBlockedUserUidsList() {
    return [...BLOCKED_USER_UIDS];
  }

  function getFollowedUserUidsList() {
    return [...FOLLOWED_USER_UIDS];
  }

  function getBlockedUserUidsListTextValue() {
    return (
      readSavedBlockedUserUidsListText() || getBlockedUserUidsList().join("\n")
    );
  }

  function getFollowedUserUidsListTextValue() {
    return (
      readSavedFollowedUserUidsListText() ||
      getFollowedUserUidsList().join("\n")
    );
  }

  function getHideVideosByKeywordList() {
    return [...HIDDEN_VIDEOS_BY_KEYWORD];
  }

  function getHideVideosByKeywordListTextValue() {
    return (
      readSavedHideVideosByKeywordListText() ||
      getHideVideosByKeywordList().join("\n")
    );
  }

  function getHideCommentsByKeywordList() {
    return [...HIDDEN_COMMENTS_BY_KEYWORD];
  }

  function getHideCommentsByKeywordListTextValue() {
    return (
      readSavedHideCommentsByKeywordListText() ||
      getHideCommentsByKeywordList().join("\n")
    );
  }

  function getHideDanmakusByKeywordList() {
    return [...HIDDEN_DANMAKUS_BY_KEYWORD];
  }

  function getHideDanmakusByKeywordListTextValue() {
    return (
      readSavedHideDanmakusByKeywordListText() ||
      getHideDanmakusByKeywordList().join("\n")
    );
  }

  function getUnifiedKeywordsList() {
    return [...HIDDEN_UNIFIED_KEYWORDS];
  }

  function getUnifiedKeywordsListTextValue() {
    return (
      readSavedUnifiedKeywordsListText() || getUnifiedKeywordsList().join("\n")
    );
  }

  function parseBlockedUserUidsListText(text) {
    return [
      ...new Set(
        text
          .split(/\r?\n/)
          .map(stripLineComment)
          .map(normalizeUid)
          .filter(Boolean),
      ),
    ];
  }

  function parseFollowedUserUidsListText(text) {
    return parseBlockedUserUidsListText(text);
  }

  function parseKeywordListText(text) {
    return dedupeKeywords(
      String(text || "")
        .split(/\r?\n/)
        .map(stripLineComment),
    );
  }

  function normalizeKeywordListText(text) {
    const value = String(text || "");
    const newline = value.includes("\r\n") ? "\r\n" : "\n";
    const seen = new Set();
    return value
      .split(/\r?\n/)
      .filter((line) => {
        const key = normalizeKeywordSearchText(stripLineComment(line));
        if (!key || !seen.has(key)) {
          seen.add(key);
          return true;
        }
        return false;
      })
      .map(normalizeKeywordLine)
      .join(newline);
  }

  function normalizeKeywordLine(line) {
    const value = String(line || "");
    const commentStart = value.indexOf("#");
    if (commentStart < 0) return normalizeKeywordSearchText(value);
    return `${normalizeKeywordSearchText(value.slice(0, commentStart))}${value.slice(
      commentStart,
    )}`;
  }

  function updateFollowedUserUidsText(text, uid, shouldFollow, username = "") {
    const normalizedUid = normalizeUid(uid);
    if (!normalizedUid) return text || "";
    const lines = String(text || "").split(/\r?\n/);
    const nextLines = lines.filter(
      (line) => normalizeUid(stripLineComment(line)) !== normalizedUid,
    );
    if (shouldFollow) {
      const name = String(username || "").trim();
      nextLines.push(name ? `${normalizedUid} # ${name}` : normalizedUid);
    }
    return nextLines.filter((line) => String(line || "").trim()).join("\n");
  }

  function parseHideVideosByKeywordListText(text) {
    return parseKeywordListText(text);
  }

  function parseHideCommentsByKeywordListText(text) {
    return parseKeywordListText(text);
  }

  function parseHideDanmakusByKeywordListText(text) {
    return parseKeywordListText(text);
  }

  function parseUnifiedKeywordsListText(text) {
    return parseKeywordListText(text);
  }

  function stripLineComment(line) {
    return String(line || "")
      .split("#")[0]
      .trim();
  }

  function dedupeKeywords(keywords) {
    const seen = new Set();
    const values = [];
    for (const keyword of keywords
      .map((value) => String(value || ""))
      .filter(Boolean)) {
      const key = normalizeKeywordSearchText(keyword);
      if (seen.has(key)) continue;
      seen.add(key);
      values.push(keyword);
    }
    return values;
  }

  function getControl(name) {
    return BOOLEAN_CONTROLS.find((control) => control.name === name);
  }

  function getThresholdControls() {
    return BOOLEAN_CONTROLS.filter((control) => control.threshold);
  }

  function getThresholdControlBySelect(element) {
    return getThresholdControls().find(
      (control) => element && element.id === control.threshold.id,
    );
  }

  function getOptionIndex(
    control,
    value = settings[control.threshold.setting],
  ) {
    const { options, fallbackIndex } = control.threshold;
    const index = options.findIndex((option) => option.label === value);
    return index < 0 ? fallbackIndex : index;
  }

  function scheduleScan(root, options = {}) {
    if (!isContentScanningPage() || !isElement(root)) return;
    if (isInsideBfilterUi(root)) return;
    pendingRoots.add(root);
    if (options.force) pendingRoots.add(document.documentElement);
    if (scheduled) return;

    scheduled = true;
    const epoch = scanEpoch;
    requestAnimationFrame(() => {
      if (epoch !== scanEpoch) return;
      scheduled = false;
      const roots = [...pendingRoots];
      pendingRoots.clear();
      for (const pendingRoot of roots) {
        if (!pendingRoot.isConnected) continue;
        scan(pendingRoot, options);
      }
    });
  }

  function resetScanQueue() {
    scanEpoch += 1;
    pendingRoots.clear();
    scheduled = false;
  }

  function isInsideBfilterUi(element) {
    return (
      element.id === MANAGER_PANEL_ID ||
      element.id === STATISTICS_OVERLAY_ID ||
      Boolean(
        element.closest(`#${MANAGER_PANEL_ID}, #${STATISTICS_OVERLAY_ID}`),
      )
    );
  }

  function scan(root) {
    if (!isContentScanningPage() || !isElement(root) || !root.isConnected)
      return;

    for (const candidate of collectCandidates(root)) {
      const comment = resolveCommentItem(candidate);
      if (comment) {
        observeStatistic("comments", comment);
        if (followedCommentAuthorUidReason(comment)) {
          applyFollowedUserUids(comment);
          continue;
        }
        const reason = evaluateComment(comment);
        if (reason) applyConsequence(comment, reason, "comments", comment);
        else clearConsequence(comment);
        continue;
      }

      const danmaku = resolveDanmaku(candidate);
      if (danmaku) {
        observeStatistic("danmakus", danmaku);
        const reason = evaluateDanmaku(danmaku);
        if (reason) applyConsequence(danmaku, reason, "danmakus", danmaku);
        else clearConsequence(danmaku);
        continue;
      }

      const card = resolveVideoCard(candidate);
      if (!card) continue;
      observeStatistic("videos", card);

      const followedUserUid = followedUserUidReason(card);
      if (followedUserUid) {
        clearStatisticConsequence("videos", card);
        const target = resolveConsequenceTarget(card, {
          type: "followed-user-uids",
          uid: followedUserUid,
        });
        if (isValidConsequenceTarget(target, card, { uid: followedUserUid }))
          applyFollowedUserUids(target);
        else clearVideoConsequence(card);
        continue;
      }

      const reason = evaluateCard(card);
      if (!reason) {
        clearVideoConsequence(card);
        continue;
      }

      const target = resolveConsequenceTarget(card, reason);
      if (isValidConsequenceTarget(target, card, reason)) {
        applyConsequence(target, reason, "videos", card);
      } else clearVideoConsequence(card);
    }
    renderCommentBlockButtons();
    renderBlockAllCommentersButton();
    refreshStatisticsDisplays();
  }

  function createStatistics() {
    return {
      videos: createCategoryStatistics(),
      comments: createCategoryStatistics(),
      danmakus: createCategoryStatistics(),
    };
  }

  function createCategoryStatistics() {
    return {
      seen: new WeakSet(),
      sourceTargets: new WeakMap(),
      targetSources: new WeakMap(),
      observed: 0,
      count: 0,
    };
  }

  function resetStatistics() {
    statistics = createStatistics();
    refreshStatisticsDisplays();
  }

  function observeStatistic(category, source) {
    const statistic = statistics[category];
    if (statistic.seen.has(source)) return;
    statistic.seen.add(source);
    statistic.observed += 1;
  }

  function recordFilteredStatistic(category, source, target) {
    const statistic = statistics[category];
    const previousTarget = statistic.sourceTargets.get(source);
    if (previousTarget === target) return;
    if (previousTarget) clearFilteredStatistic(category, source);
    statistic.sourceTargets.set(source, target);
    let sources = statistic.targetSources.get(target);
    if (!sources) {
      sources = new Set();
      statistic.targetSources.set(target, sources);
    }
    sources.add(source);
    statistic.count += 1;
  }

  function clearFilteredStatistic(category, source) {
    const statistic = statistics[category];
    const target = statistic.sourceTargets.get(source);
    if (!target) return;
    statistic.sourceTargets.delete(source);
    const sources = statistic.targetSources.get(target);
    if (sources) {
      sources.delete(source);
      if (!sources.size) statistic.targetSources.delete(target);
    }
    statistic.count = Math.max(0, statistic.count - 1);
  }

  function clearFilteredStatisticsForTarget(target) {
    for (const category of Object.keys(statistics)) {
      const statistic = statistics[category];
      const sources = statistic.targetSources.get(target);
      if (!sources) continue;
      for (const source of [...sources])
        clearFilteredStatistic(category, source);
    }
  }

  function clearStatisticConsequence(category, source) {
    const target = statistics[category].sourceTargets.get(source);
    if (target) clearConsequence(target);
  }

  function clearVideoConsequence(card) {
    clearStatisticConsequence("videos", card);
    clearConsequence(
      resolveConsequenceTarget(card, { type: "followed-user-uids", uid: "" }),
    );
  }

  function collectCandidates(root) {
    const candidates = new Set();
    addIfMatches(root, CARD_SELECTOR, candidates);
    addIfMatches(root, COMMENT_ITEM_SELECTOR, candidates);
    addIfMatches(root, DANMAKU_SELECTOR, candidates);
    addIfMatches(root, DANMAKU_TEXT_SELECTOR, candidates);
    addIfMatches(root, UPLOADER_SELECTOR, candidates);
    addIfMatches(root, COMMENT_USER_LINK_SELECTOR, candidates);
    addIfMatches(root, VIDEO_LINK_SELECTOR, candidates);
    addIfMatches(root, TYPE_VIDEO_LINK_SELECTOR, candidates);
    for (const selector of [
      CARD_SELECTOR,
      COMMENT_ITEM_SELECTOR,
      DANMAKU_SELECTOR,
      DANMAKU_TEXT_SELECTOR,
      UPLOADER_SELECTOR,
      COMMENT_USER_LINK_SELECTOR,
      VIDEO_LINK_SELECTOR,
      TYPE_VIDEO_LINK_SELECTOR,
    ]) {
      for (const element of root.querySelectorAll(selector))
        candidates.add(element);
    }
    return candidates;
  }

  function addIfMatches(element, selector, set) {
    if (matches(element, selector)) set.add(element);
  }

  function hasInOrSelf(element, selector) {
    return (
      matches(element, selector) || Boolean(element.querySelector(selector))
    );
  }

  function matches(element, selector) {
    return isElement(element) && element.matches(selector);
  }

  function isElement(value) {
    return value instanceof Element;
  }

  function appendToPage(element) {
    if (!element.isConnected)
      (document.body || document.documentElement).appendChild(element);
  }

  function resolveCommentItem(candidate) {
    if (!isElement(candidate)) return null;
    return matches(candidate, COMMENT_ITEM_SELECTOR)
      ? candidate
      : candidate.closest(COMMENT_ITEM_SELECTOR);
  }

  function resolveDanmaku(candidate) {
    if (!isDirectVideoPage() || !isElement(candidate)) return null;
    return matches(candidate, DANMAKU_SELECTOR)
      ? candidate
      : candidate.closest(DANMAKU_SELECTOR);
  }

  function resolveVideoCard(candidate) {
    if (!isElement(candidate) || isProtectedSearchVideoCard(candidate))
      return null;

    const info = candidate.closest(BILI_VIDEO_CARD_INFO_SELECTOR);
    if (info) {
      const card = info.parentElement?.closest(
        BILI_VIDEO_CARD_CONTAINER_SELECTOR,
      );
      return card &&
        !isProtectedSearchVideoCard(card) &&
        isPotentialVideoCard(card)
        ? card
        : null;
    }

    if (isPotentialVideoCard(candidate)) return candidate;

    let best = null;
    for (
      let element = candidate, depth = 0;
      element && depth <= MAX_ANCESTOR_STEPS;
      element = element.parentElement, depth += 1
    ) {
      if (isUnsafePageContainer(element)) break;
      if (matches(element, CARD_SELECTOR) && isPotentialVideoCard(element))
        return element;
      if (isPotentialVideoCard(element) && !isTooLargeToHide(element))
        best = element;
    }
    return best;
  }

  function isPotentialVideoCard(element) {
    if (!isElement(element) || isUnsafePageContainer(element)) return false;
    if (matches(element, ".video-card__content")) return false;
    if (isPotentialTypeCard(element)) return true;
    if (!hasInOrSelf(element, VIDEO_LINK_SELECTOR)) return false;
    if (matches(element, CARD_SELECTOR)) return true;
    return (
      hasInOrSelf(element, UPLOADER_SELECTOR) &&
      (hasInOrSelf(element, VISUAL_SELECTOR) ||
        hasInOrSelf(element, TITLE_SELECTOR))
    );
  }

  function isPotentialTypeCard(element) {
    return Boolean(
      settings.hideVideosByType &&
      matches(element, CARD_SELECTOR) &&
      hasTypeVideoLinkInside(element),
    );
  }

  function hasTypeVideoLinkInside(card) {
    const selector = getActiveTypeVideoLinkSelector();
    if (!selector) return false;
    return [...card.querySelectorAll(selector)].some((link) =>
      link.closest(CARD_SELECTOR),
    );
  }

  function getActiveTypeVideoLinkSelector() {
    if (!settings.hideVideosByType) return "";
    return [
      settings.hideVideosByTypeLive && TYPE_VIDEO_LINK_SELECTORS.live,
      settings.hideVideosByTypeManga && TYPE_VIDEO_LINK_SELECTORS.manga,
      settings.hideVideosByTypeCourse && TYPE_VIDEO_LINK_SELECTORS.course,
      settings.hideVideosByTypeBangumi && TYPE_VIDEO_LINK_SELECTORS.bangumi,
    ]
      .filter(Boolean)
      .join(",");
  }

  function getUploaderUidsInside(container) {
    const uids = new Set();
    if (matches(container, UPLOADER_SELECTOR)) addUploaderUids(container, uids);
    for (const element of container.querySelectorAll(UPLOADER_SELECTOR)) {
      addUploaderUids(element, uids);
    }
    return [...uids];
  }

  function getCommentAuthorUidsInside(comment) {
    const uids = new Set();
    for (const link of comment.querySelectorAll(COMMENT_USER_LINK_SELECTOR)) {
      if (link.closest(COMMENT_ITEM_SELECTOR) !== comment) continue;
      addUidFromHref(link.getAttribute("href"), uids);
    }
    return [...uids];
  }

  function addUploaderUids(element, uids) {
    if (element instanceof HTMLAnchorElement)
      addUidFromHref(element.getAttribute("href"), uids);
    for (const attr of UID_ATTRS) addUid(element.getAttribute(attr), uids);
    if (element.dataset) {
      addUid(element.dataset.usercardMid, uids);
      addUid(element.dataset.mid, uids);
    }
  }

  function addUidFromHref(href, uids) {
    if (!href) return;
    const match =
      href.match(/space\.bilibili\.com\/(\d+)/i) ||
      href.match(/^\/\/(?:space\.)?bilibili\.com\/(\d+)/i);
    if (match) addUid(match[1], uids);
  }

  function addUid(value, uids) {
    const uid = normalizeUid(value);
    if (uid) uids.add(uid);
  }

  function normalizeUid(value) {
    const match = value == null ? null : String(value).trim().match(/^\d+$/);
    return match ? match[0] : "";
  }

  function containsMultipleVideos(element) {
    if (isPopularPage() && matches(element, ".rank-item")) return false;

    const hrefs = new Set();
    if (matches(element, VIDEO_LINK_SELECTOR)) addVideoHref(element, hrefs);
    for (const link of element.querySelectorAll(VIDEO_LINK_SELECTOR))
      addVideoHref(link, hrefs);
    return hrefs.size > 1;
  }

  function addVideoHref(link, hrefs) {
    const href = link.getAttribute("href");
    if (!href) return;
    try {
      hrefs.add(new URL(href, location.href).pathname.replace(/\/$/, ""));
    } catch (_error) {
      hrefs.add(href.split(/[?#]/)[0].replace(/\/$/, ""));
    }
  }

  function evaluateCard(card) {
    return (
      blockedUserUidReason(card) ||
      hiddenVideosByKeywordReason(card) ||
      registrationTimeReason(card) ||
      videoDurationReason(card) ||
      videoViewsReason(card) ||
      videoTypeReason(card)
    );
  }

  function evaluateComment(comment) {
    return (
      blockedCommentAuthorUidReason(comment) ||
      hiddenCommentsByKeywordReason(comment) ||
      mentionsOnlyCommentReason(comment) ||
      imageCommentReason(comment) ||
      commenterLevelReason(comment) ||
      registrationTimeCommentAuthorReason(comment)
    );
  }

  function evaluateDanmaku(danmaku) {
    const keyword = getMatchedHideDanmakusByKeyword(getDanmakuText(danmaku));
    return keyword
      ? { type: "hide-danmakus-by-keyword", uid: "", keyword }
      : null;
  }

  function followedUserUidReason(card) {
    return getUploaderUidsInside(card).find((uid) =>
      FOLLOWED_USER_UIDS.has(uid),
    );
  }

  function followedCommentAuthorUidReason(comment) {
    return getCommentAuthorUidsInside(comment).find((uid) =>
      FOLLOWED_USER_UIDS.has(uid),
    );
  }

  function blockedUserUidReason(card) {
    const uid = getUploaderUidsInside(card).find((value) =>
      BLOCKED_USER_UIDS.has(value),
    );
    return uid ? { type: "blocked-user-uids", uid } : null;
  }

  function blockedCommentAuthorUidReason(comment) {
    const uid = getCommentAuthorUidsInside(comment).find((value) =>
      BLOCKED_USER_UIDS.has(value),
    );
    return uid ? { type: "blocked-user-uids", uid } : null;
  }

  function registrationTimeReason(card) {
    if (!settings.hideUsersByRegistrationTime) return null;
    const uid = getUploaderUidsInside(card).find(
      matchesRegistrationTimeHeuristic,
    );
    return uid ? { type: "hide-users-by-registration-time", uid } : null;
  }

  function registrationTimeCommentAuthorReason(comment) {
    if (!settings.hideUsersByRegistrationTime) return null;
    const uid = getCommentAuthorUidsInside(comment).find(
      matchesRegistrationTimeHeuristic,
    );
    return uid ? { type: "hide-users-by-registration-time", uid } : null;
  }

  function matchesRegistrationTimeHeuristic(uid) {
    return /^\d+$/.test(uid) && uid.length >= getRegistrationTimeThreshold();
  }

  function getRegistrationTimeThreshold() {
    return getRegistrationTimeThresholdOption().minDigits;
  }

  function getRegistrationTimeThresholdOption(
    value = settings.hideUsersByRegistrationTimeThreshold,
  ) {
    return (
      REGISTRATION_TIME_THRESHOLD_OPTIONS.find(
        (option) => option.label === value,
      ) ||
      REGISTRATION_TIME_THRESHOLD_OPTIONS[
        REGISTRATION_TIME_THRESHOLD_OPTIONS.length - 1
      ]
    );
  }

  function hiddenVideosByKeywordReason(card) {
    const keyword = getMatchedHideVideosByKeyword(getVideoTitleText(card));
    return keyword
      ? { type: "hide-videos-by-keyword", uid: "", keyword }
      : null;
  }

  function videoDurationReason(card) {
    if (!settings.hideVideosByDuration || !canUseMetadataFilter(card))
      return null;
    const seconds = getVideoDurationSeconds(card);
    return seconds > 0 && seconds < getVideoDurationThresholdSeconds()
      ? { type: "hide-videos-by-duration", uid: "" }
      : null;
  }

  function videoViewsReason(card) {
    if (!settings.hideVideosByViews || !canUseMetadataFilter(card)) return null;
    const views = getVideoViewCount(card);
    return views != null && views < getVideoViewsThreshold()
      ? { type: "hide-videos-by-views", uid: "" }
      : null;
  }

  function videoTypeReason(card) {
    if (!settings.hideVideosByType || !canUseMetadataFilter(card)) return null;
    return hasTypeVideoLinkInside(card)
      ? { type: "hide-videos-by-type", uid: "" }
      : null;
  }

  function canUseMetadataFilter(card) {
    return !isDirectVideoPage() || isInsideRecommendationArea(card);
  }

  function getMatchedHideVideosByKeyword(text) {
    return getMatchedKeyword(
      text,
      settings.unifiedKeywordsMode
        ? HIDDEN_UNIFIED_KEYWORDS
        : HIDDEN_VIDEOS_BY_KEYWORD,
    );
  }

  function getVideoTitleText(card) {
    if (!isElement(card)) return "";
    const values = [];
    for (const element of getVideoTitleElements(card)) {
      values.push(
        element.textContent || "",
        element.getAttribute("title") || "",
      );
    }
    return values.join(" ");
  }

  function getVideoTitleElements(card) {
    const elements = new Set();
    for (const element of card.querySelectorAll(
      [
        ".bili-video-card__info--tit",
        ".video-name",
        ".video-title",
        ".title-text",
        // Direct-video right-panel recommendations put the title on a
        // nested element such as <a href="/video/..."><p class="title">...</p></a>.
        'a[href*="/video/"] .title',
        'a[href*="bilibili.com/video/"] .title',
        'a[href*="/bangumi/play/"] .title',
        'a[href*="/video/"] [title]',
        'a[href*="bilibili.com/video/"] [title]',
        'a[href*="/bangumi/play/"] [title]',
        'a[href*="/video/"][title]',
        'a[href*="bilibili.com/video/"][title]',
        'a[href*="/bangumi/play/"][title]',
      ].join(","),
    )) {
      elements.add(element);
    }
    return elements;
  }

  function getVideoDurationThresholdSeconds() {
    return getVideoDurationThresholdOption().seconds;
  }

  function getVideoDurationThresholdOption(
    value = settings.hideVideosByDurationThreshold,
  ) {
    return (
      VIDEO_DURATION_THRESHOLD_OPTIONS.find(
        (option) => option.label === value,
      ) || VIDEO_DURATION_THRESHOLD_OPTIONS[2]
    );
  }

  function getVideoViewsThreshold() {
    return getVideoViewsThresholdOption().views;
  }

  function getVideoViewsThresholdOption(
    value = settings.hideVideosByViewsThreshold,
  ) {
    return (
      VIDEO_VIEWS_THRESHOLD_OPTIONS.find((option) => option.label === value) ||
      VIDEO_VIEWS_THRESHOLD_OPTIONS[2]
    );
  }

  function getVideoDurationSeconds(card) {
    for (const element of getDurationElements(card)) {
      const seconds = parseDurationSeconds(element.textContent || "");
      if (seconds > 0) return seconds;
    }
    return 0;
  }

  function getDurationElements(card) {
    const elements = new Set(card.querySelectorAll(DURATION_SELECTOR));
    if (matches(card, DURATION_SELECTOR)) elements.add(card);
    for (const element of card.querySelectorAll("*")) {
      if (
        !element.children.length &&
        /^\s*\d{1,2}:\d{2}(?::\d{2})?\s*$/.test(element.textContent || "")
      ) {
        elements.add(element);
      }
    }
    return elements;
  }

  function parseDurationSeconds(text) {
    const match = String(text || "")
      .trim()
      .match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return 0;
    return match[3] == null
      ? Number(match[1]) * 60 + Number(match[2])
      : Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  }

  function getVideoViewCount(card) {
    const biliVideoCardViewStat = card.querySelector(
      BILI_VIDEO_CARD_VIEW_STAT_SELECTOR,
    );
    const biliVideoCardViewCount = parseViewCount(
      biliVideoCardViewStat?.textContent || "",
    );
    if (biliVideoCardViewCount != null) return biliVideoCardViewCount;

    const preferred = [...card.querySelectorAll(STAT_SELECTOR)].filter(
      isViewCountElement,
    );
    const fallback = [...card.querySelectorAll(STAT_SELECTOR)].filter(
      isLikelyViewCountFallbackElement,
    );
    for (const element of [...preferred, ...fallback]) {
      const count = parseViewCount(
        element.innerText || element.textContent || "",
      );
      if (count != null) return count;
    }
    return null;
  }

  function isViewCountElement(element) {
    if (matches(element, DURATION_SELECTOR)) return false;
    return /play|view|播放|观看/i.test(getClueText(element, true));
  }

  function isLikelyViewCountFallbackElement(element) {
    const text = element.textContent || "";
    if (text.includes(":")) return false;
    if (parseViewCount(text) == null) return false;
    return /stat|播放|观看|play|view/i.test(getClueText(element, false));
  }

  function getClueText(element, includeText) {
    return `${element.className || ""} ${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""} ${includeText ? element.textContent || "" : ""}`;
  }

  function parseViewCount(text) {
    const normalized = String(text || "")
      .replace(/,/g, "")
      .trim();
    if (!normalized || normalized.includes(":")) return null;
    const match = normalized.match(/(\d+(?:\.\d+)?)\s*([万亿]?)/);
    if (!match) return null;
    const value = Number(match[1]);
    if (!Number.isFinite(value)) return null;
    if (match[2] === "万") return value * 10000;
    if (match[2] === "亿") return value * 100000000;
    return value;
  }

  function hiddenCommentsByKeywordReason(comment) {
    if (
      !(
        settings.unifiedKeywordsMode
          ? HIDDEN_UNIFIED_KEYWORDS
          : HIDDEN_COMMENTS_BY_KEYWORD
      ).size
    )
      return null;
    const keyword = getMatchedHideCommentsByKeyword(getCommentText(comment));
    return keyword
      ? { type: "hide-comments-by-keyword", uid: "", keyword }
      : null;
  }

  function mentionsOnlyCommentReason(comment) {
    if (!settings.hideCommentsByMentionsOnly || !isMentionsOnlyComment(comment))
      return null;
    return { type: "hide-comments-by-mentions-only", uid: "" };
  }

  function imageCommentReason(comment) {
    if (!settings.hideCommentsByImagesAttached) return null;
    return hasCommentImageAttachment(comment)
      ? { type: "hide-comments-by-images-attached", uid: "" }
      : null;
  }

  function commenterLevelReason(comment) {
    if (!settings.hideCommentsByCommenterLevel) return null;
    const level = getCommentLevel(comment);
    return level !== null && level <= getCommenterLevelThreshold()
      ? { type: "hide-comments-by-commenter-level", uid: "" }
      : null;
  }

  function getCommentLevel(comment) {
    for (const info of comment.querySelectorAll(".user-info, .sub-user-info")) {
      if (info.closest(COMMENT_ITEM_SELECTOR) !== comment) continue;
      for (const child of info.children) {
        if (child.tagName !== "SPAN") continue;
        const match = String(child.textContent || "")
          .trim()
          .match(/^LV([0-6])$/);
        if (match) return Number(match[1]);
      }
    }
    return null;
  }

  function getCommenterLevelThreshold() {
    return getCommenterLevelThresholdOption().maxLevel;
  }

  function getCommenterLevelThresholdOption(
    value = settings.hideCommentsByCommenterLevelThreshold,
  ) {
    return (
      COMMENTER_LEVEL_THRESHOLD_OPTIONS.find(
        (option) => option.label === value,
      ) || COMMENTER_LEVEL_THRESHOLD_OPTIONS[1]
    );
  }

  function hasCommentImageAttachment(comment) {
    return [...comment.querySelectorAll(COMMENT_ATTACHMENT_SELECTOR)].some(
      (image) => image.closest(COMMENT_ITEM_SELECTOR) === comment,
    );
  }

  function getMatchedHideCommentsByKeyword(text) {
    return getMatchedKeyword(
      text,
      settings.unifiedKeywordsMode
        ? HIDDEN_UNIFIED_KEYWORDS
        : HIDDEN_COMMENTS_BY_KEYWORD,
    );
  }

  function getCommentText(comment) {
    const text = getCommentTextElement(comment);
    if (!text) return "";
    const walker = document.createTreeWalker(
      text,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "A")
            return NodeFilter.FILTER_REJECT;
          return node.nodeType === Node.TEXT_NODE
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        },
      },
    );
    const values = [];
    let node;
    while ((node = walker.nextNode())) {
      values.push(node.nodeValue || "");
    }
    return values.join("");
  }

  function isMentionsOnlyComment(comment) {
    const text = getCommentTextElement(comment);
    if (!text || !text.querySelector(COMMENT_MENTION_LINK_SELECTOR))
      return false;
    const clone = text.cloneNode(true);
    for (const link of clone.querySelectorAll(COMMENT_MENTION_LINK_SELECTOR)) {
      if (
        String(link.textContent || "")
          .trim()
          .startsWith("@")
      )
        link.remove();
    }
    return !String(clone.textContent || "").trim();
  }

  function getCommentTextElement(comment) {
    return comment.querySelector(COMMENT_TEXT_SELECTOR);
  }

  function getMatchedHideDanmakusByKeyword(text) {
    return getMatchedKeyword(
      text,
      settings.unifiedKeywordsMode
        ? HIDDEN_UNIFIED_KEYWORDS
        : HIDDEN_DANMAKUS_BY_KEYWORD,
    );
  }

  function getDanmakuText(danmaku) {
    const text = danmaku.querySelector(DANMAKU_TEXT_SELECTOR);
    return text ? text.textContent || "" : danmaku.textContent || "";
  }

  function getMatchedKeyword(text, keywords) {
    if (!keywords.size) return "";
    const haystack = normalizeKeywordSearchText(text);
    if (!haystack) return "";
    return [...keywords].find((keyword) => {
      const needle = normalizeKeywordSearchText(keyword);
      return needle && haystack.includes(needle);
    });
  }

  function normalizeKeywordSearchText(value) {
    return String(value || "")
      .normalize("NFC")
      .replace(/[\uFE0E\uFE0F]/g, "")
      .toLowerCase();
  }

  function isUnsafePageContainer(element) {
    return (
      !element ||
      ["HTML", "BODY", "HEAD"].includes(element.tagName) ||
      element === document.documentElement ||
      element === document.body
    );
  }

  function isTooLargeToHide(element) {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    return (
      (rect.width * rect.height) /
        Math.max(1, window.innerWidth * window.innerHeight) >
      MAX_CARD_AREA_RATIO
    );
  }

  function resolveConsequenceTarget(card, reason) {
    if (isVideoTypeReason(reason)) {
      const searchResultCard = card.closest(".video-list-item");
      if (isSearchPage() && isSafeTargetShape(searchResultCard))
        return searchResultCard;

      const floorCard = card.closest(".floor-single-card");
      if (isSafeTargetShape(floorCard)) return floorCard;
    }

    const recommendationContainer = card.closest(
      RECOMMENDATION_CARD_CONTAINER_SELECTOR,
    );
    return isSafeTargetShape(recommendationContainer)
      ? recommendationContainer
      : card;
  }

  function isVideoTypeReason(reason) {
    return reason && reason.type === "hide-videos-by-type";
  }

  function isValidConsequenceTarget(target, card, reason) {
    if (!isSafeTargetShape(target)) return false;
    if (isProtectedSearchVideoCard(card) || isProtectedSearchVideoCard(target))
      return false;
    if (isDirectVideoOwnerCard(target, reason.uid)) return false;
    return true;
  }

  function isSafeTargetShape(element) {
    return Boolean(
      element &&
      !isUnsafePageContainer(element) &&
      !isTooLargeToHide(element) &&
      isPotentialVideoCard(element) &&
      !containsMultipleVideos(element),
    );
  }

  function applyConsequence(
    target,
    reason,
    statisticsCategory,
    source = target,
  ) {
    if (statisticsCategory) {
      const previousTarget =
        statistics[statisticsCategory].sourceTargets.get(source);
      if (previousTarget && previousTarget !== target)
        clearStatisticConsequence(statisticsCategory, source);
    }
    clearFilteredStatisticsForTarget(target);
    target.removeAttribute(FOLLOWED_USER_UID_ATTR);
    clearNestedConsequences(target);
    target.removeAttribute(settings.previewMode ? HIDDEN_ATTR : PREVIEW_ATTR);

    const activeAttr = settings.previewMode ? PREVIEW_ATTR : HIDDEN_ATTR;
    if (
      target.parentElement &&
      target.parentElement.closest(`[${activeAttr}]`)
    ) {
      clearConsequence(target);
      return false;
    }

    target.setAttribute(activeAttr, "true");
    target.setAttribute(HIDDEN_UID_ATTR, reason.uid || "");
    if (statisticsCategory)
      recordFilteredStatistic(statisticsCategory, source, target);
    return true;
  }

  function applyFollowedUserUids(target) {
    clearNestedConsequences(target);
    clearConsequence(target);
    target.setAttribute(FOLLOWED_USER_UID_ATTR, "true");
  }

  function refreshConsequences() {
    resetStatistics();
    resetScanQueue();
    for (const element of document.querySelectorAll(
      `[${HIDDEN_ATTR}], [${PREVIEW_ATTR}], [${FOLLOWED_USER_UID_ATTR}]`,
    )) {
      clearConsequence(element);
    }
    scan(document.documentElement);
  }

  function clearNestedConsequences(target) {
    for (const nested of target.querySelectorAll(
      `[${HIDDEN_ATTR}], [${PREVIEW_ATTR}], [${FOLLOWED_USER_UID_ATTR}]`,
    )) {
      clearConsequence(nested);
    }
  }

  function clearConsequence(element) {
    clearFilteredStatisticsForTarget(element);
    element.removeAttribute(HIDDEN_ATTR);
    element.removeAttribute(PREVIEW_ATTR);
    element.removeAttribute(FOLLOWED_USER_UID_ATTR);
    element.removeAttribute(HIDDEN_UID_ATTR);
  }

  function clearConsequencesForUid(uid) {
    for (const element of document.querySelectorAll(
      `[${HIDDEN_UID_ATTR}="${uid}"]`,
    )) {
      clearConsequence(element);
    }
  }

  function isDirectVideoOwnerCard(card, uid) {
    return Boolean(
      uid &&
      isDirectVideoPage() &&
      uid === findDirectPageUploaderUid() &&
      !matches(card, RECOMMENDATION_AREA_SELECTOR) &&
      !isInsideRecommendationArea(card),
    );
  }

  function isInsideRecommendationArea(element) {
    return Boolean(element && element.closest(RECOMMENDATION_AREA_SELECTOR));
  }

  function isProtectedSearchVideoCard(element) {
    return Boolean(
      isSearchPage() &&
      element &&
      // Search user results use a wrapper around `.b-user-video-card`; protect
      // both the card and its wrapper so preview mode does not paint the area red.
      (element.closest(SEARCH_PROTECTED_VIDEO_CARD_SELECTOR) ||
        element.querySelector(SEARCH_PROTECTED_VIDEO_CARD_SELECTOR)),
    );
  }

  function findDirectPageUploaderUid() {
    const fromState = findUidInInitialState();
    if (fromState) return fromState;

    const ownerLink = document.querySelector(VIDEO_OWNER_SELECTOR);
    if (ownerLink && !isInsideRecommendationArea(ownerLink)) {
      const uids = new Set();
      addUploaderUids(ownerLink, uids);
      if ([...uids][0]) return [...uids][0];
    }

    const spaceLink = document.querySelector('a[href*="space.bilibili.com/"]');
    if (spaceLink && !isInsideRecommendationArea(spaceLink)) {
      const uids = new Set();
      addUploaderUids(spaceLink, uids);
      if ([...uids][0]) return [...uids][0];
    }

    return "";
  }

  function findUidInInitialState() {
    for (const script of document.scripts || []) {
      const text = script.textContent || "";
      if (!text.includes("mid")) continue;
      const ownerMid = text.match(/"owner"\s*:\s*\{[^}]*"mid"\s*:\s*(\d+)/);
      if (ownerMid) return ownerMid[1];
      const upMid = text.match(/"upData"\s*:\s*\{[^}]*"mid"\s*:\s*(\d+)/);
      if (upMid) return upMid[1];
    }
    return "";
  }

  function escapeHtml(text) {
    return String(text).replace(
      /[&<>"]/g,
      (char) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char],
    );
  }

  function renderBfilterManager() {
    const shouldShow = isBfilterManagerPage();
    let button = document.getElementById(MANAGER_BUTTON_ID);
    let panel = document.getElementById(MANAGER_PANEL_ID);

    if (!shouldShow) {
      if (button) button.remove();
      if (panel) panel.remove();
      return;
    }

    if (!button) {
      button = document.createElement("button");
      button.id = MANAGER_BUTTON_ID;
      button.className = FLOATING_BUTTON_CLASS;
      button.type = "button";
      button.textContent = "Open Bfilter";
      button.title = "View and edit blocked user UIDs";
      button.addEventListener("click", () => {
        const currentPanel = ensureBfilterManagerPanel();
        currentPanel.hidden = !currentPanel.hidden;
        if (!currentPanel.hidden) {
          refreshBfilterManagerPanel(currentPanel);
          getActiveManagerTextarea(currentPanel)?.focus();
        }
      });
    }

    appendToPage(button);
    appendToPage(ensureBfilterManagerPanel());
  }

  function ensureBfilterManagerPanel() {
    let panel = document.getElementById(MANAGER_PANEL_ID);
    if (panel) return panel;

    panel = document.createElement("section");
    panel.id = MANAGER_PANEL_ID;
    panel.hidden = true;
    const activeTab = readActiveManagerTabName();
    panel.innerHTML = `
      <div class="bfilter-manager-header">
        <div class="bfilter-manager-title">Bfilter Manager <span class="bfilter-manager-version">${SCRIPT_VERSION}</span></div>
        <button class="bfilter-manager-close" type="button" title="Close">×</button>
      </div>
      <section class="bfilter-manager-section">
        <div class="bfilter-manager-tabs" role="tablist">
          <button class="bfilter-manager-tab" type="button" role="tab" aria-selected="${String(activeTab === "blocked-user-uids")}" data-tab="blocked-user-uids">Users</button>
          <button class="bfilter-manager-tab" type="button" role="tab" aria-selected="${String(activeTab === "followed-user-uids")}" data-tab="followed-user-uids">Following</button>
          <button class="bfilter-manager-tab" type="button" role="tab" aria-selected="${String(activeTab === "hide-videos-by-keyword")}" data-tab="hide-videos-by-keyword">Videos</button>
          <button class="bfilter-manager-tab" type="button" role="tab" aria-selected="${String(activeTab === "hide-comments-by-keyword")}" data-tab="hide-comments-by-keyword">Comments</button>
          <button class="bfilter-manager-tab" type="button" role="tab" aria-selected="${String(activeTab === "hide-danmakus-by-keyword")}" data-tab="hide-danmakus-by-keyword">Danmakus</button>
          ${
            settings.unifiedKeywordsMode
              ? `<button class="bfilter-manager-tab" type="button" role="tab" aria-selected="${String(activeTab === "unified-keywords")}" data-tab="unified-keywords">Keywords</button>`
              : ""
          }
          <button class="bfilter-manager-tab" type="button" role="tab" aria-selected="${String(activeTab === "settings")}" data-tab="settings">Settings</button>
        </div>
        <div class="bfilter-manager-tab-panel" role="tabpanel" data-tab-panel="blocked-user-uids" ${activeTab === "blocked-user-uids" ? "" : "hidden"}>
          ${BOOLEAN_CONTROLS.filter(
            (control) => control.name === "hideUsersByRegistrationTime",
          )
            .map(renderManagerOption)
            .join("")}
          ${renderManagerTextarea(MANAGER_BLOCKED_USER_UIDS_TEXTAREA_ID)}
          <div class="bfilter-manager-help" data-help="blocked-user-uids"></div>
        </div>
        <div class="bfilter-manager-tab-panel" role="tabpanel" data-tab-panel="followed-user-uids" ${activeTab === "followed-user-uids" ? "" : "hidden"}>
          ${BOOLEAN_CONTROLS.filter((control) => control.followedUserUidsOption)
            .map(renderManagerOption)
            .join("")}
          ${renderManagerTextarea(MANAGER_FOLLOWED_USER_UIDS_TEXTAREA_ID)}
          <div class="bfilter-manager-help" data-help="followed-user-uids"></div>
        </div>
        <div class="bfilter-manager-tab-panel" role="tabpanel" data-tab-panel="hide-videos-by-keyword" ${activeTab === "hide-videos-by-keyword" ? "" : "hidden"}>
          ${BOOLEAN_CONTROLS.filter((control) =>
            [
              "hideVideosByDuration",
              "hideVideosByViews",
              "hideVideosByType",
            ].includes(control.name),
          )
            .map(renderManagerOption)
            .join("")}
          ${renderManagerTextarea(
            MANAGER_HIDE_VIDEOS_BY_KEYWORD_TEXTAREA_ID,
            settings.unifiedKeywordsMode,
          )}
          <div class="bfilter-manager-help" data-help="hide-videos-by-keyword"></div>
        </div>
        <div class="bfilter-manager-tab-panel" role="tabpanel" data-tab-panel="hide-comments-by-keyword" ${activeTab === "hide-comments-by-keyword" ? "" : "hidden"}>
          ${BOOLEAN_CONTROLS.filter((control) => control.commentOption)
            .map(renderManagerOption)
            .join("")}
          ${renderManagerTextarea(
            MANAGER_HIDE_COMMENTS_BY_KEYWORD_TEXTAREA_ID,
            settings.unifiedKeywordsMode,
          )}
          <div class="bfilter-manager-help" data-help="hide-comments-by-keyword"></div>
        </div>
        <div class="bfilter-manager-tab-panel" role="tabpanel" data-tab-panel="hide-danmakus-by-keyword" ${activeTab === "hide-danmakus-by-keyword" ? "" : "hidden"}>
          ${renderManagerTextarea(
            MANAGER_HIDE_DANMAKUS_BY_KEYWORD_TEXTAREA_ID,
            settings.unifiedKeywordsMode,
          )}
          <div class="bfilter-manager-help" data-help="hide-danmakus-by-keyword"></div>
        </div>
        ${
          settings.unifiedKeywordsMode
            ? `<div class="bfilter-manager-tab-panel" role="tabpanel" data-tab-panel="unified-keywords" ${activeTab === "unified-keywords" ? "" : "hidden"}>
          ${renderManagerTextarea(MANAGER_UNIFIED_KEYWORDS_TEXTAREA_ID)}
          <div class="bfilter-manager-help" data-help="unified-keywords"></div>
        </div>`
            : ""
        }
        <div class="bfilter-manager-tab-panel bfilter-manager-settings-panel" role="tabpanel" data-tab-panel="settings" ${activeTab === "settings" ? "" : "hidden"}>
          <section class="bfilter-manager-settings-section bfilter-manager-statistics" data-statistics aria-labelledby="bfilter-manager-statistics-heading">
            <div class="bfilter-manager-statistics-header">
              <div id="bfilter-manager-statistics-heading" class="bfilter-manager-settings-heading">Statistics</div>
              <label class="bfilter-manager-statistics-toggle" for="bfilter-manager-show-statistics-overlay">
                <span>Hide</span>
                <input id="bfilter-manager-show-statistics-overlay" type="checkbox" data-show-statistics-overlay aria-label="Show Statistics overlay">
                <span class="bfilter-manager-toggle-track" aria-hidden="true"></span>
                <span>Show</span>
              </label>
            </div>
            <div class="bfilter-manager-statistics-list">
              <div class="bfilter-manager-statistic" data-statistic="videos"><span id="bfilter-manager-statistic-videos">Videos</span><output aria-labelledby="bfilter-manager-statistic-videos" aria-live="off" data-statistic-value>0 (0%)</output></div>
              <div class="bfilter-manager-statistic" data-statistic="comments"><span id="bfilter-manager-statistic-comments">Comments</span><output aria-labelledby="bfilter-manager-statistic-comments" aria-live="off" data-statistic-value>0 (0%)</output></div>
              <div class="bfilter-manager-statistic" data-statistic="danmakus"><span id="bfilter-manager-statistic-danmakus">Danmakus</span><output aria-labelledby="bfilter-manager-statistic-danmakus" aria-live="off" data-statistic-value>0 (0%)</output></div>
            </div>
            <div class="bfilter-manager-statistics-help">... have been blocked on the current page. The statistics may be inaccurate due to lazy loading.</div>
          </section>
          <div class="bfilter-manager-settings-section">
            <div class="bfilter-manager-settings-heading">Keyword Unification</div>
            ${BOOLEAN_CONTROLS.filter((control) => control.settingsOption)
              .map(renderManagerOption)
              .join("")}
          </div>
          <div class="bfilter-manager-settings-section">
            <div class="bfilter-manager-settings-heading">Migration</div>
            <div class="bfilter-manager-settings-actions">
              <button class="bfilter-manager-action bfilter-manager-action-primary" type="button" data-action="import" title="Import Bfilter data and settings">Import</button>
              <button class="bfilter-manager-action bfilter-manager-action-primary" type="button" data-action="export" title="Export Bfilter data and settings">Export</button>
            </div>
          </div>
          <div class="bfilter-manager-settings-section">
            <div class="bfilter-manager-settings-heading">Reset</div>
            <div class="bfilter-manager-settings-actions">
              <button class="bfilter-manager-action bfilter-manager-action-primary" type="button" data-action="reset" title="Clear all Bfilter data and reset default settings">Reset</button>
            </div>
          </div>
          <input class="bfilter-manager-import-input" type="file" accept="application/json,.json" hidden>
        </div>
        <div class="bfilter-manager-actions">
          <label class="bfilter-manager-preview-toggle" for="${getControl("previewMode").id}">
            <input id="${getControl("previewMode").id}" type="checkbox" data-setting="previewMode">
            <span class="bfilter-manager-toggle-track" aria-hidden="true"></span>
            <span>Preview</span>
          </label>
          <div class="bfilter-manager-action-buttons">
            <button class="bfilter-manager-action bfilter-manager-action-primary" type="button" data-action="go-followed-user-uids" title="Open selected user space" hidden>Go</button>
            <button class="bfilter-manager-action bfilter-manager-action-primary" type="button" data-action="sort" title="Sort all Manager lists">Sort</button>
            <button class="bfilter-manager-action bfilter-manager-action-primary" type="button" data-action="save" disabled>Save</button>
          </div>
        </div>
      </section>
    `;

    panel.addEventListener("click", (event) => {
      const target = event.target;
      if (!isElement(target)) return;
      if (target.classList.contains("bfilter-manager-close"))
        panel.hidden = true;
      if (target.matches(".bfilter-manager-tab[data-tab]")) {
        setActiveManagerTab(panel, target.getAttribute("data-tab"));
      }
      if (target.getAttribute("data-action") === "go-followed-user-uids") {
        openSelectedFollowedUserUidsDynamic(panel);
      }
      if (target.getAttribute("data-action") === "sort") {
        if (
          !confirm(
            "WARNING: This action will sort all Manager lists, and remove duplicate, comment-only, and empty-line entries. Continue?",
          )
        )
          return;
        sortManagerTextareas(panel);
      }
      if (target.getAttribute("data-action") === "save") {
        saveManagerTextareas(panel);
      }
      if (target.getAttribute("data-action") === "import") {
        openManagerImportPicker(panel);
      }
      if (target.getAttribute("data-action") === "export") {
        exportManagerData();
      }
      if (target.getAttribute("data-action") === "reset") {
        resetManagerData(panel);
      }
    });

    panel.addEventListener("input", (event) => {
      const target = event.target;
      if (
        target &&
        (target.id === MANAGER_BLOCKED_USER_UIDS_TEXTAREA_ID ||
          target.id === MANAGER_FOLLOWED_USER_UIDS_TEXTAREA_ID ||
          target.id === MANAGER_HIDE_VIDEOS_BY_KEYWORD_TEXTAREA_ID ||
          target.id === MANAGER_HIDE_COMMENTS_BY_KEYWORD_TEXTAREA_ID ||
          target.id === MANAGER_HIDE_DANMAKUS_BY_KEYWORD_TEXTAREA_ID ||
          target.id === MANAGER_UNIFIED_KEYWORDS_TEXTAREA_ID)
      )
        updateManagerSaveButtonState(panel);
    });

    panel.addEventListener("change", (event) => {
      const target = event.target;
      if (target && target.matches(".bfilter-manager-import-input")) {
        importManagerDataFromInput(target, panel);
        return;
      }
      const thresholdControl = getThresholdControlBySelect(target);
      if (thresholdControl) {
        setThresholdIndex(thresholdControl, target.value);
        refreshThresholdControls(panel);
        return;
      }
      if (target && target.matches("[data-hide-videos-by-type]")) {
        setVideoType(target.selectedOptions);
        refreshBooleanControls(panel);
        return;
      }
      if (target && target.matches("[data-show-statistics-overlay]")) {
        setShowStatisticsOverlay(target.checked);
        return;
      }
      const name = target && target.getAttribute("data-setting");
      if (!name || !(name in settings)) return;
      setBooleanSetting(name, target.checked);
      refreshBooleanControls(panel);
    });

    refreshBfilterManagerPanel(panel);
    return panel;
  }

  function renderManagerTextarea(id, disabled = false) {
    return `<textarea id="${id}" class="bfilter-manager-textarea" spellcheck="false"${
      disabled ? " disabled" : ""
    }></textarea>`;
  }

  function renderManagerOption(control) {
    const checkbox = `<label class="bfilter-manager-option${control.toggle ? " bfilter-manager-setting-toggle" : ""}" for="${control.id}"><input id="${control.id}" type="checkbox" data-setting="${control.name}">${control.toggle ? '<span class="bfilter-manager-toggle-track" aria-hidden="true"></span>' : ""}<span>${escapeHtml(control.label)}</span></label>`;
    const children = BOOLEAN_CONTROLS.filter(
      (child) => child.childOf === control.name,
    );
    if (children.length) {
      return `<div class="bfilter-manager-video-types-control">${checkbox}${renderVideoTypeSelect(children)}</div>`;
    }
    return control.threshold
      ? `<div class="bfilter-manager-threshold-control">${checkbox}${renderThresholdSelect(control)}</div>`
      : checkbox;
  }

  function renderThresholdSelect(control) {
    return `<select id="${control.threshold.id}" class="bfilter-manager-threshold">${control.threshold.options
      .map(
        (option, index) =>
          `<option value="${index}">${escapeHtml(option.displayLabel || option.label)}</option>`,
      )
      .join("")}</select>`;
  }

  function renderVideoTypeSelect(controls) {
    return `<select class="bfilter-manager-video-types" data-hide-videos-by-type multiple size="1">${controls
      .map(
        (control) =>
          `<option value="${control.name}">${escapeHtml(control.label)}</option>`,
      )
      .join("")}</select>`;
  }

  function refreshBfilterManagerPanel(
    panel = document.getElementById(MANAGER_PANEL_ID),
    textValues = {},
  ) {
    if (!panel) return;
    const uids = getBlockedUserUidsList();
    const blockedUserUidsText = getBlockedUserUidsListTextValue();
    const followedUserUids = getFollowedUserUidsList();
    const followedUserUidsText = getFollowedUserUidsListTextValue();
    const hideVideosByKeyword = getHideVideosByKeywordList();
    const videoKeywordText = getHideVideosByKeywordListTextValue();
    const hideCommentsByKeyword = getHideCommentsByKeywordList();
    const commentKeywordText = getHideCommentsByKeywordListTextValue();
    const hideDanmakusByKeyword = getHideDanmakusByKeywordList();
    const danmakuKeywordText = getHideDanmakusByKeywordListTextValue();
    const unifiedKeywords = getUnifiedKeywordsList();
    const unifiedKeywordText = getUnifiedKeywordsListTextValue();
    const textarea = panel.querySelector(
      `#${MANAGER_BLOCKED_USER_UIDS_TEXTAREA_ID}`,
    );
    const followedUserUidsTextarea = panel.querySelector(
      `#${MANAGER_FOLLOWED_USER_UIDS_TEXTAREA_ID}`,
    );
    const hideVideosByKeywordTextarea = panel.querySelector(
      `#${MANAGER_HIDE_VIDEOS_BY_KEYWORD_TEXTAREA_ID}`,
    );
    const hideCommentsByKeywordTextarea = panel.querySelector(
      `#${MANAGER_HIDE_COMMENTS_BY_KEYWORD_TEXTAREA_ID}`,
    );
    const help = panel.querySelector('[data-help="blocked-user-uids"]');
    const followedUserUidsHelp = panel.querySelector(
      '[data-help="followed-user-uids"]',
    );
    const hideVideosByKeywordHelp = panel.querySelector(
      '[data-help="hide-videos-by-keyword"]',
    );
    const hideCommentsByKeywordHelp = panel.querySelector(
      '[data-help="hide-comments-by-keyword"]',
    );
    const hideDanmakusByKeywordTextarea = panel.querySelector(
      `#${MANAGER_HIDE_DANMAKUS_BY_KEYWORD_TEXTAREA_ID}`,
    );
    const hideDanmakusByKeywordHelp = panel.querySelector(
      '[data-help="hide-danmakus-by-keyword"]',
    );
    const unifiedKeywordsTextarea = panel.querySelector(
      `#${MANAGER_UNIFIED_KEYWORDS_TEXTAREA_ID}`,
    );
    const unifiedKeywordsHelp = panel.querySelector(
      '[data-help="unified-keywords"]',
    );
    if (textarea) {
      textarea.value = getManagerTextValue(
        textValues,
        "blockedUserUids",
        blockedUserUidsText,
      );
      textarea.dataset.cleanValue = textarea.value;
    }
    if (followedUserUidsTextarea) {
      followedUserUidsTextarea.value = getManagerTextValue(
        textValues,
        "followedUserUids",
        followedUserUidsText,
      );
      followedUserUidsTextarea.dataset.cleanValue =
        followedUserUidsTextarea.value;
    }
    if (hideVideosByKeywordTextarea) {
      hideVideosByKeywordTextarea.value = getManagerTextValue(
        textValues,
        "hideVideosByKeyword",
        videoKeywordText,
      );
      hideVideosByKeywordTextarea.dataset.cleanValue =
        hideVideosByKeywordTextarea.value;
    }
    if (hideCommentsByKeywordTextarea) {
      hideCommentsByKeywordTextarea.value = getManagerTextValue(
        textValues,
        "hideCommentsByKeyword",
        commentKeywordText,
      );
      hideCommentsByKeywordTextarea.dataset.cleanValue =
        hideCommentsByKeywordTextarea.value;
    }
    if (hideDanmakusByKeywordTextarea) {
      hideDanmakusByKeywordTextarea.value = getManagerTextValue(
        textValues,
        "hideDanmakusByKeyword",
        danmakuKeywordText,
      );
      hideDanmakusByKeywordTextarea.dataset.cleanValue =
        hideDanmakusByKeywordTextarea.value;
    }
    if (unifiedKeywordsTextarea) {
      unifiedKeywordsTextarea.value = getManagerTextValue(
        textValues,
        "unifiedKeywords",
        unifiedKeywordText,
      );
      unifiedKeywordsTextarea.dataset.cleanValue =
        unifiedKeywordsTextarea.value;
    }
    if (help)
      help.innerHTML = `<strong>${uids.length}</strong> user(s) have been blocked.\nEnter one UID per line to block users.`;
    if (followedUserUidsHelp)
      followedUserUidsHelp.innerHTML = `<strong>${followedUserUids.length}</strong> user(s) are followed.\nEnter one UID per line to highlight users.`;
    if (hideVideosByKeywordHelp)
      hideVideosByKeywordHelp.innerHTML = `<strong>${hideVideosByKeyword.length}</strong> keyword(s) have been blocked.\nEnter one keyword per line to hide videos containing it in their titles.`;
    if (hideCommentsByKeywordHelp)
      hideCommentsByKeywordHelp.innerHTML = `<strong>${hideCommentsByKeyword.length}</strong> keyword(s) have been blocked.\nEnter one keyword per line to hide comments containing it.`;
    if (hideDanmakusByKeywordHelp)
      hideDanmakusByKeywordHelp.innerHTML = `<strong>${hideDanmakusByKeyword.length}</strong> keyword(s) have been blocked.\nEnter one keyword per line to hide danmakus containing it.`;
    if (unifiedKeywordsHelp)
      unifiedKeywordsHelp.innerHTML =
        `<strong>${unifiedKeywords.length}</strong> keyword(s) have been blocked.\n` +
        "Enter one keyword per line to hide videos, comments, and danmakus containing it.";
    refreshBooleanControls(panel);
    refreshStatisticsOverlayToggle(panel);
    refreshManagerGoButton(panel);
    updateManagerSaveButtonState(panel);
    refreshStatisticsDisplays(panel);
  }

  function refreshStatisticsDisplays(
    panel = document.getElementById(MANAGER_PANEL_ID),
  ) {
    if (panel && !panel.hidden) refreshStatisticsValues(panel);
    renderStatisticsOverlay();
  }

  function refreshStatisticsValues(container) {
    for (const row of container.querySelectorAll("[data-statistic]")) {
      const statistic = statistics[row.getAttribute("data-statistic")];
      if (!statistic) continue;
      const percentage = statistic.observed
        ? Math.round((statistic.count / statistic.observed) * 100)
        : 0;
      const level =
        percentage <= 20 ? "low" : percentage <= 40 ? "medium" : "high";
      const value = row.querySelector("[data-statistic-value]");
      const text = `${statistic.count} (${percentage}%)`;
      if (value && value.textContent !== text) value.textContent = text;
      if (row.dataset.statisticsLevel !== level)
        row.dataset.statisticsLevel = level;
    }
  }

  function refreshStatisticsOverlayToggle(
    panel = document.getElementById(MANAGER_PANEL_ID),
  ) {
    if (!panel) return;
    const input = panel.querySelector("[data-show-statistics-overlay]");
    if (input) input.checked = settings.showStatisticsOverlay;
  }

  function renderStatisticsOverlay() {
    let overlay = document.getElementById(STATISTICS_OVERLAY_ID);
    if (!settings.showStatisticsOverlay || !isBfilterManagerPage()) {
      if (overlay) overlay.remove();
      return;
    }
    if (!overlay) {
      overlay = document.createElement("aside");
      overlay.id = STATISTICS_OVERLAY_ID;
      overlay.setAttribute("aria-label", "Bfilter Statistics");
      overlay.innerHTML = `
        <div class="bfilter-statistics-overlay-list">
          <div data-statistic="videos"><span aria-hidden="true">V</span><output aria-label="Videos statistics" aria-live="off" data-statistic-value>0 (0%)</output></div>
          <div data-statistic="comments"><span aria-hidden="true">C</span><output aria-label="Comments statistics" aria-live="off" data-statistic-value>0 (0%)</output></div>
          <div data-statistic="danmakus"><span aria-hidden="true">D</span><output aria-label="Danmakus statistics" aria-live="off" data-statistic-value>0 (0%)</output></div>
        </div>
        <button class="bfilter-statistics-overlay-close" type="button" data-action="close-statistics-overlay" aria-label="Close statistics overlay" title="Close statistics overlay">×</button>
      `;
      overlay.addEventListener("click", (event) => {
        const target = event.target;
        if (
          isElement(target) &&
          target.matches('[data-action="close-statistics-overlay"]')
        )
          setShowStatisticsOverlay(false);
      });
    }
    appendToPage(overlay);
    refreshStatisticsValues(overlay);
  }

  function getManagerTextValue(textValues, name, fallback) {
    return Object.prototype.hasOwnProperty.call(textValues, name)
      ? textValues[name]
      : fallback;
  }

  function setActiveManagerTab(panel, tabName) {
    const nextTab = getValidManagerTabName(tabName);
    saveActiveManagerTabName(nextTab);
    for (const tab of panel.querySelectorAll(
      ".bfilter-manager-tab[data-tab]",
    )) {
      tab.setAttribute(
        "aria-selected",
        String(tab.getAttribute("data-tab") === nextTab),
      );
    }
    for (const tabPanel of panel.querySelectorAll("[data-tab-panel]")) {
      tabPanel.hidden = tabPanel.getAttribute("data-tab-panel") !== nextTab;
    }
    refreshManagerGoButton(panel);
    getActiveManagerTextarea(panel)?.focus();
  }

  function getValidManagerTabName(tabName) {
    return [
      "blocked-user-uids",
      "hide-videos-by-keyword",
      "hide-comments-by-keyword",
      "hide-danmakus-by-keyword",
      ...(settings.unifiedKeywordsMode ? ["unified-keywords"] : []),
      "followed-user-uids",
      "settings",
    ].includes(tabName)
      ? tabName
      : "blocked-user-uids";
  }

  function readActiveManagerTabName() {
    try {
      const saved =
        typeof GM_getValue === "function"
          ? GM_getValue(ACTIVE_MANAGER_TAB_STORAGE_KEY, "blocked-user-uids")
          : localStorage.getItem(ACTIVE_MANAGER_TAB_STORAGE_KEY);
      return getValidManagerTabName(saved);
    } catch (_error) {
      return "blocked-user-uids";
    }
  }

  function saveActiveManagerTabName(tabName) {
    try {
      if (typeof GM_setValue === "function")
        GM_setValue(ACTIVE_MANAGER_TAB_STORAGE_KEY, tabName);
      else localStorage.setItem(ACTIVE_MANAGER_TAB_STORAGE_KEY, tabName);
    } catch (_error) {
      // Keep the visible tab even if persistence fails.
    }
  }

  function openManagerImportPicker(panel) {
    const input = panel.querySelector(".bfilter-manager-import-input");
    if (!input) return;
    input.value = "";
    input.click();
  }

  function exportManagerData() {
    const data = JSON.stringify(getManagerExportData(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bfilter-backup-${getDateStamp()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function getManagerExportData() {
    const exportedSettings = {};
    for (const { name } of BOOLEAN_CONTROLS) {
      exportedSettings[name] = settings[name];
    }
    for (const control of getThresholdControls()) {
      exportedSettings[control.threshold.setting] =
        settings[control.threshold.setting];
    }
    exportedSettings.showStatisticsOverlay = settings.showStatisticsOverlay;
    return {
      app: "Bfilter",
      version: SCRIPT_VERSION || "",
      exportedAt: new Date().toISOString(),
      lists: {
        blockedUserUids: readSavedBlockedUserUidsListText(),
        followedUserUids: readSavedFollowedUserUidsListText(),
        hideVideosByKeyword: readSavedHideVideosByKeywordListText(),
        hideCommentsByKeyword: readSavedHideCommentsByKeywordListText(),
        hideDanmakusByKeyword: readSavedHideDanmakusByKeywordListText(),
        unifiedKeywords: readSavedUnifiedKeywordsListText(),
      },
      settings: exportedSettings,
    };
  }

  function getDefaultSettings() {
    const defaults = { showStatisticsOverlay: false };
    for (const control of BOOLEAN_CONTROLS) {
      defaults[control.name] = Boolean(control.defaultValue);
    }
    for (const control of getThresholdControls()) {
      defaults[control.threshold.setting] = control.threshold.defaultValue;
    }
    return defaults;
  }

  function getDateStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function importManagerDataFromInput(input, panel) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (
      !confirm(
        "WARNING: Imported data will overwrite the existing data and settings. Continue?",
      )
    )
      return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        importManagerData(JSON.parse(String(reader.result || "")));
        alert("Bfilter data and settings imported.");
      } catch (_error) {
        alert("Import failed. Select a valid Bfilter JSON export file.");
      }
    });
    reader.addEventListener("error", () => {
      alert("Import failed. The selected file could not be read.");
    });
    reader.readAsText(file);
  }

  function importManagerData(data) {
    if (!data || typeof data !== "object") throw new Error("Invalid data");
    const lists = data.lists;
    const importedSettings = data.settings;
    if (!lists || typeof lists !== "object") throw new Error("Invalid lists");
    if (!importedSettings || typeof importedSettings !== "object")
      throw new Error("Invalid settings");

    const blockedUserUids = String(lists.blockedUserUids || "");
    const followedUserUidsText = String(lists.followedUserUids || "");
    const hideVideosByKeyword = String(lists.hideVideosByKeyword || "");
    const hideCommentsByKeyword = String(lists.hideCommentsByKeyword || "");
    const hideDanmakusByKeyword = String(lists.hideDanmakusByKeyword || "");
    const unifiedKeywords = String(lists.unifiedKeywords || "");

    replaceRuntimeBlockedUserUids(
      parseBlockedUserUidsListText(blockedUserUids),
    );
    replaceRuntimeFollowedUserUids(
      parseFollowedUserUidsListText(followedUserUidsText),
    );
    replaceRuntimeHiddenVideosByKeyword(
      parseHideVideosByKeywordListText(hideVideosByKeyword),
    );
    replaceRuntimeHiddenCommentsByKeyword(
      parseHideCommentsByKeywordListText(hideCommentsByKeyword),
    );
    replaceRuntimeHiddenDanmakusByKeyword(
      parseHideDanmakusByKeywordListText(hideDanmakusByKeyword),
    );
    replaceRuntimeUnifiedKeywords(
      parseUnifiedKeywordsListText(unifiedKeywords),
    );
    saveBlockedUserUidsListText(blockedUserUids);
    saveFollowedUserUidsListText(followedUserUidsText);
    saveHideVideosByKeywordListText(hideVideosByKeyword);
    saveHideCommentsByKeywordListText(hideCommentsByKeyword);
    saveHideDanmakusByKeywordListText(hideDanmakusByKeyword);
    saveUnifiedKeywordsListText(unifiedKeywords);

    for (const { name } of BOOLEAN_CONTROLS) {
      settings[name] = parseBooleanSetting(
        importedSettings[name],
        DEFAULT_SETTINGS[name],
      );
      saveBooleanSetting(SETTING_KEYS[name], settings[name]);
    }
    for (const control of getThresholdControls()) {
      const { setting, key, defaultValue, options } = control.threshold;
      settings[setting] = parseLabelSetting(
        importedSettings[setting],
        defaultValue,
        options,
      );
      saveLabelSetting(key, settings[setting]);
    }
    settings.showStatisticsOverlay = parseBooleanSetting(
      importedSettings.showStatisticsOverlay,
      DEFAULT_SETTINGS.showStatisticsOverlay,
    );
    saveBooleanSetting(
      SETTING_KEYS.showStatisticsOverlay,
      settings.showStatisticsOverlay,
    );

    refreshConsequences();
    refreshStatisticsOverlayToggle();
    renderStatisticsOverlay();
    renderUserPageActionButtons();
    rerenderBfilterManagerPanel(false);
  }

  function resetManagerData(panel) {
    if (
      !confirm(
        "WARNING: This will clear all Manager lists and reset every filter setting to its default. Continue?",
      )
    )
      return;

    replaceRuntimeBlockedUserUids([]);
    replaceRuntimeFollowedUserUids([]);
    replaceRuntimeHiddenVideosByKeyword([]);
    replaceRuntimeHiddenCommentsByKeyword([]);
    replaceRuntimeHiddenDanmakusByKeyword([]);
    replaceRuntimeUnifiedKeywords([]);
    saveBlockedUserUidsListText("");
    saveFollowedUserUidsListText("");
    saveHideVideosByKeywordListText("");
    saveHideCommentsByKeywordListText("");
    saveHideDanmakusByKeywordListText("");
    saveUnifiedKeywordsListText("");

    for (const { name } of BOOLEAN_CONTROLS) {
      settings[name] = DEFAULT_SETTINGS[name];
      saveBooleanSetting(SETTING_KEYS[name], settings[name]);
    }
    for (const control of getThresholdControls()) {
      const { setting, key } = control.threshold;
      settings[setting] = DEFAULT_SETTINGS[setting];
      saveLabelSetting(key, settings[setting]);
    }
    settings.showStatisticsOverlay = DEFAULT_SETTINGS.showStatisticsOverlay;
    saveBooleanSetting(
      SETTING_KEYS.showStatisticsOverlay,
      settings.showStatisticsOverlay,
    );

    refreshConsequences();
    rerenderBfilterManagerPanel(false);
    renderUserPageActionButtons();
  }

  function refreshManagerGoButton(panel) {
    const goButton = panel.querySelector(
      '[data-action="go-followed-user-uids"]',
    );
    if (!goButton) return;
    goButton.hidden = getActiveManagerTabName(panel) !== "followed-user-uids";
  }

  function getActiveManagerTabName(panel) {
    const activeTab = panel.querySelector(
      '.bfilter-manager-tab[data-tab][aria-selected="true"]',
    );
    return activeTab ? activeTab.getAttribute("data-tab") : "blocked-user-uids";
  }

  function getActiveManagerTextarea(panel) {
    const activePanel = panel.querySelector("[data-tab-panel]:not([hidden])");
    return activePanel ? activePanel.querySelector("textarea") : null;
  }

  function rerenderBfilterManagerPanel(preserveTextareaStates = true) {
    const panel = document.getElementById(MANAGER_PANEL_ID);
    if (!panel) return;
    const hidden = panel.hidden;
    if (preserveTextareaStates) {
      for (const textarea of getManagerTextareas(panel)) {
        managerTextareaStates[textarea.id] = {
          value: textarea.value,
          cleanValue: textarea.dataset.cleanValue,
        };
      }
    } else {
      managerTextareaStates = {};
    }
    if (
      getActiveManagerTabName(panel) === "unified-keywords" &&
      !settings.unifiedKeywordsMode
    )
      saveActiveManagerTabName("blocked-user-uids");
    panel.remove();
    renderBfilterManager();
    const nextPanel = document.getElementById(MANAGER_PANEL_ID);
    if (!nextPanel) return;
    for (const textarea of getManagerTextareas(nextPanel)) {
      const state = managerTextareaStates[textarea.id];
      if (!state) continue;
      textarea.value = state.value;
      textarea.dataset.cleanValue = state.cleanValue;
    }
    updateManagerSaveButtonState(nextPanel);
    nextPanel.hidden = hidden;
  }

  function openSelectedFollowedUserUidsDynamic(panel) {
    const textarea = panel.querySelector(
      `#${MANAGER_FOLLOWED_USER_UIDS_TEXTAREA_ID}`,
    );
    const uid = getSelectedFollowedUserUids(textarea);
    if (!uid) {
      alert(
        "1. Select one numeric UID in the Following list. Do not include spaces, comments, or multiple lines in the selection.\n2. Click Go to visit the user space.",
      );
      return;
    }
    window.open(`https://space.bilibili.com/${uid}/upload`, "_blank");
  }

  function getSelectedFollowedUserUids(textarea) {
    if (!textarea) return "";
    const selectedText = textarea.value.slice(
      textarea.selectionStart,
      textarea.selectionEnd,
    );
    return normalizeUid(selectedText);
  }

  function sortManagerTextareas(panel) {
    for (const textarea of getManagerTextareas(panel)) {
      const sorted = sortManagerListText(textarea.value);
      if (sorted === textarea.value) continue;
      textarea.value = sorted;
    }
    saveManagerTextareas(panel);
    getActiveManagerTextarea(panel)?.focus();
  }

  function getManagerTextareas(panel) {
    return [
      MANAGER_BLOCKED_USER_UIDS_TEXTAREA_ID,
      MANAGER_FOLLOWED_USER_UIDS_TEXTAREA_ID,
      MANAGER_HIDE_VIDEOS_BY_KEYWORD_TEXTAREA_ID,
      MANAGER_HIDE_COMMENTS_BY_KEYWORD_TEXTAREA_ID,
      MANAGER_HIDE_DANMAKUS_BY_KEYWORD_TEXTAREA_ID,
      MANAGER_UNIFIED_KEYWORDS_TEXTAREA_ID,
    ]
      .map((id) => panel.querySelector(`#${id}`))
      .filter(Boolean);
  }

  function sortManagerListText(text) {
    const value = String(text || "");
    const newline = value.includes("\r\n") ? "\r\n" : "\n";
    const entries = [];
    const seenKeys = new Set();
    value.split(/\r?\n/).forEach((line, index) => {
      const key = stripLineComment(line);
      if (!key) return;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      entries.push({ line, key, index });
    });
    entries.sort(compareManagerListEntries);
    return entries.map((item) => item.line).join(newline);
  }

  function compareManagerListEntries(a, b) {
    const keyCompare = a.key.localeCompare(b.key, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    return keyCompare || a.index - b.index;
  }

  function saveManagerTextareas(panel) {
    const textarea = panel.querySelector(
      `#${MANAGER_BLOCKED_USER_UIDS_TEXTAREA_ID}`,
    );
    const followedUserUidsTextarea = panel.querySelector(
      `#${MANAGER_FOLLOWED_USER_UIDS_TEXTAREA_ID}`,
    );
    const hideVideosByKeywordTextarea = panel.querySelector(
      `#${MANAGER_HIDE_VIDEOS_BY_KEYWORD_TEXTAREA_ID}`,
    );
    const hideCommentsByKeywordTextarea = panel.querySelector(
      `#${MANAGER_HIDE_COMMENTS_BY_KEYWORD_TEXTAREA_ID}`,
    );
    const hideDanmakusByKeywordTextarea = panel.querySelector(
      `#${MANAGER_HIDE_DANMAKUS_BY_KEYWORD_TEXTAREA_ID}`,
    );
    const unifiedKeywordsTextarea = panel.querySelector(
      `#${MANAGER_UNIFIED_KEYWORDS_TEXTAREA_ID}`,
    );
    const textValues = {
      blockedUserUids: textarea ? textarea.value : "",
      followedUserUids: followedUserUidsTextarea
        ? followedUserUidsTextarea.value
        : "",
      hideVideosByKeyword: hideVideosByKeywordTextarea
        ? normalizeKeywordListText(hideVideosByKeywordTextarea.value)
        : "",
      hideCommentsByKeyword: hideCommentsByKeywordTextarea
        ? normalizeKeywordListText(hideCommentsByKeywordTextarea.value)
        : "",
      hideDanmakusByKeyword: hideDanmakusByKeywordTextarea
        ? normalizeKeywordListText(hideDanmakusByKeywordTextarea.value)
        : "",
      unifiedKeywords: unifiedKeywordsTextarea
        ? normalizeKeywordListText(unifiedKeywordsTextarea.value)
        : "",
    };
    if (textarea)
      replaceRuntimeBlockedUserUids(
        parseBlockedUserUidsListText(textarea.value),
      );
    if (followedUserUidsTextarea)
      replaceRuntimeFollowedUserUids(
        parseFollowedUserUidsListText(followedUserUidsTextarea.value),
      );
    if (hideVideosByKeywordTextarea)
      replaceRuntimeHiddenVideosByKeyword(
        parseHideVideosByKeywordListText(textValues.hideVideosByKeyword),
      );
    if (hideCommentsByKeywordTextarea)
      replaceRuntimeHiddenCommentsByKeyword(
        parseHideCommentsByKeywordListText(textValues.hideCommentsByKeyword),
      );
    if (hideDanmakusByKeywordTextarea)
      replaceRuntimeHiddenDanmakusByKeyword(
        parseHideDanmakusByKeywordListText(textValues.hideDanmakusByKeyword),
      );
    if (unifiedKeywordsTextarea)
      replaceRuntimeUnifiedKeywords(
        parseUnifiedKeywordsListText(textValues.unifiedKeywords),
      );
    saveBlockedUserUidsListText(textarea ? textarea.value : undefined);
    saveFollowedUserUidsListText(
      followedUserUidsTextarea ? followedUserUidsTextarea.value : undefined,
    );
    saveHideVideosByKeywordListText(
      hideVideosByKeywordTextarea ? textValues.hideVideosByKeyword : undefined,
    );
    saveHideCommentsByKeywordListText(
      hideCommentsByKeywordTextarea
        ? textValues.hideCommentsByKeyword
        : undefined,
    );
    saveHideDanmakusByKeywordListText(
      hideDanmakusByKeywordTextarea
        ? textValues.hideDanmakusByKeyword
        : undefined,
    );
    if (unifiedKeywordsTextarea)
      saveUnifiedKeywordsListText(textValues.unifiedKeywords);
    refreshConsequences();
    refreshBfilterManagerPanel(panel, textValues);
  }

  function refreshBooleanControls(
    panel = document.getElementById(MANAGER_PANEL_ID),
  ) {
    if (!panel) return;
    for (const control of BOOLEAN_CONTROLS) {
      const input = panel.querySelector(`#${control.id}`);
      if (!input) continue;
      input.checked = settings[control.name];
      input.disabled = Boolean(control.childOf && !settings[control.childOf]);
    }
    const videoType = panel.querySelector("[data-hide-videos-by-type]");
    if (videoType) {
      videoType.disabled = !settings.hideVideosByType;
      for (const option of videoType.options) {
        option.selected = settings[option.value];
      }
    }
    refreshThresholdControls(panel);
  }

  function refreshThresholdControls(
    panel = document.getElementById(MANAGER_PANEL_ID),
  ) {
    if (!panel) return;
    for (const control of getThresholdControls()) {
      const select = panel.querySelector(`#${control.threshold.id}`);
      if (!select) continue;
      select.value = String(getOptionIndex(control));
      select.disabled = !settings[control.name];
      select.classList.toggle(
        "bfilter-manager-threshold-disabled",
        !settings[control.name],
      );
    }
  }

  function updateManagerSaveButtonState(panel) {
    const textarea = panel.querySelector(
      `#${MANAGER_BLOCKED_USER_UIDS_TEXTAREA_ID}`,
    );
    const followedUserUidsTextarea = panel.querySelector(
      `#${MANAGER_FOLLOWED_USER_UIDS_TEXTAREA_ID}`,
    );
    const hideVideosByKeywordTextarea = panel.querySelector(
      `#${MANAGER_HIDE_VIDEOS_BY_KEYWORD_TEXTAREA_ID}`,
    );
    const hideCommentsByKeywordTextarea = panel.querySelector(
      `#${MANAGER_HIDE_COMMENTS_BY_KEYWORD_TEXTAREA_ID}`,
    );
    const hideDanmakusByKeywordTextarea = panel.querySelector(
      `#${MANAGER_HIDE_DANMAKUS_BY_KEYWORD_TEXTAREA_ID}`,
    );
    const unifiedKeywordsTextarea = panel.querySelector(
      `#${MANAGER_UNIFIED_KEYWORDS_TEXTAREA_ID}`,
    );
    const saveButton = panel.querySelector('[data-action="save"]');
    if (saveButton)
      saveButton.disabled = ![
        textarea,
        followedUserUidsTextarea,
        hideVideosByKeywordTextarea,
        hideCommentsByKeywordTextarea,
        hideDanmakusByKeywordTextarea,
        unifiedKeywordsTextarea,
      ].some(
        (input) => input && input.value !== (input.dataset.cleanValue || ""),
      );
  }

  function setUidBlocked(uid, blocked) {
    replaceRuntimeBlockedUserUids(
      parseBlockedUserUidsListText(readSavedBlockedUserUidsListText()),
    );
    if (blocked) BLOCKED_USER_UIDS.add(uid);
    else {
      BLOCKED_USER_UIDS.delete(uid);
      clearConsequencesForUid(uid);
    }
    saveBlockedUserUidsListText();
    refreshConsequences();
    refreshBfilterManagerPanel();
  }

  function setUidFollowedUserUids(uid, shouldFollow, username = "") {
    const followedUserUidsText = updateFollowedUserUidsText(
      readSavedFollowedUserUidsListText(),
      uid,
      shouldFollow,
      settings.addUsernamesToFollowedUserUids ? username : "",
    );
    replaceRuntimeFollowedUserUids(
      parseFollowedUserUidsListText(followedUserUidsText),
    );
    if (shouldFollow) FOLLOWED_USER_UIDS.add(uid);
    else FOLLOWED_USER_UIDS.delete(uid);
    saveFollowedUserUidsListText(followedUserUidsText);
    refreshConsequences();
    refreshBfilterManagerPanel();
  }

  function renderUserPageActionButtons() {
    const uid = getCurrentUserPageUid();
    let button = document.getElementById(BLOCK_BUTTON_ID);
    let followButton = document.getElementById(FOLLOW_BUTTON_ID);
    if (!uid) {
      if (button) button.remove();
      if (followButton) followButton.remove();
      return;
    }

    if (!followButton) {
      followButton = document.createElement("button");
      followButton.id = FOLLOW_BUTTON_ID;
      followButton.className = PROFILE_BUTTON_CLASS;
      followButton.type = "button";
      followButton.addEventListener("click", () => {
        const currentUid = followButton.getAttribute("data-uid");
        if (!currentUid) return;
        setUidFollowedUserUids(
          currentUid,
          !FOLLOWED_USER_UIDS.has(currentUid),
          getCurrentUserPageUsername(),
        );
        updateUserPageFollowedUserUidsButton(followButton, currentUid);
        if (button) updateUserPageBlockButton(button, currentUid);
      });
    }

    if (!button) {
      button = document.createElement("button");
      button.id = BLOCK_BUTTON_ID;
      button.className = PROFILE_BUTTON_CLASS;
      button.type = "button";
      button.addEventListener("click", () => {
        const currentUid = button.getAttribute("data-uid");
        if (!currentUid) return;
        setUidBlocked(currentUid, !BLOCKED_USER_UIDS.has(currentUid));
        updateUserPageBlockButton(button, currentUid);
      });
    }
    updateUserPageFollowedUserUidsButton(followButton, uid);
    updateUserPageBlockButton(button, uid);
    appendUserPageActionButtons(followButton, button);
  }

  function appendUserPageActionButtons(followButton, button) {
    const statistics = document.querySelector(".nav-statistics");
    if (statistics) {
      statistics.insertAdjacentElement("beforebegin", followButton);
      followButton.insertAdjacentElement("afterend", button);
    } else {
      appendToPage(followButton);
      followButton.insertAdjacentElement("afterend", button);
    }
  }

  function updateUserPageFollowedUserUidsButton(button, uid) {
    const isFollowed = FOLLOWED_USER_UIDS.has(uid);
    button.setAttribute("data-uid", uid);
    button.setAttribute("data-followed-user-uid", String(isFollowed));
    button.textContent = isFollowed ? "FOLLOWING" : "FOLLOW";
    button.title = `${isFollowed ? "Unfollow" : "Follow"} Bilibili user UID ${uid}`;
  }

  function updateUserPageBlockButton(button, uid) {
    const blocked = BLOCKED_USER_UIDS.has(uid);
    const isFollowed = FOLLOWED_USER_UIDS.has(uid);
    const hiddenByRegistrationTimeFilter =
      !blocked &&
      settings.hideUsersByRegistrationTime &&
      matchesRegistrationTimeHeuristic(uid);
    button.setAttribute("data-uid", uid);
    button.setAttribute("data-blocked", String(blocked));
    button.disabled = isFollowed;
    button.textContent = blocked ? "BLOCKED" : "BLOCK";
    if (hiddenByRegistrationTimeFilter) {
      const hint = document.createElement("span");
      hint.textContent = "Already hidden by registration time";
      button.appendChild(hint);
    }
    button.title = isFollowed
      ? `Followed Bilibili user UID ${uid} cannot be blocked here`
      : `${blocked ? "Unblock" : "Block"} Bilibili user UID ${uid}`;
  }

  function blockAllCommenters() {
    replaceRuntimeBlockedUserUids(
      parseBlockedUserUidsListText(readSavedBlockedUserUidsListText()),
    );
    for (const item of document.querySelectorAll(COMMENT_ITEM_SELECTOR)) {
      for (const uid of getCommentAuthorUidsInside(item))
        BLOCKED_USER_UIDS.add(uid);
    }
    saveBlockedUserUidsListText();
    refreshConsequences();
    refreshBfilterManagerPanel();
  }

  function renderCommentBlockButtons() {
    if (!isOpusPage() && !isDirectVideoPage() && !isTPage()) return;
    for (const item of document.querySelectorAll(COMMENT_ITEM_SELECTOR)) {
      if (item.hasAttribute(HIDDEN_ATTR)) continue;
      const userLink = item.querySelector(COMMENT_USER_LINK_SELECTOR);
      if (!userLink) continue;
      const href = userLink.getAttribute("href");
      const match = href && href.match(/space\.bilibili\.com\/(\d+)/i);
      if (!match) continue;
      const uid = match[1];
      let btn = item.querySelector(`.${COMMENT_BLOCK_BUTTON_CLASS}`);
      if (!btn) {
        btn = document.createElement("button");
        btn.className = COMMENT_BLOCK_BUTTON_CLASS;
        btn.type = "button";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          const currentUid = btn.dataset.uid;
          if (currentUid)
            setUidBlocked(currentUid, !BLOCKED_USER_UIDS.has(currentUid));
        });
        userLink.insertAdjacentElement("afterend", btn);
      }
      const blocked = BLOCKED_USER_UIDS.has(uid);
      btn.textContent = blocked ? "Unblock" : "Block";
      btn.dataset.blocked = String(blocked);
      btn.dataset.uid = uid;
    }
  }

  function renderBlockAllCommentersButton() {
    if (!isOpusPage() && !isDirectVideoPage() && !isTPage()) {
      for (const btn of document.querySelectorAll(
        `.${BLOCK_ALL_COMMENTERS_BUTTON_CLASS}`,
      ))
        btn.remove();
      return;
    }
    if (!document.querySelector(COMMENT_ITEM_SELECTOR)) return;

    const navBar = document.querySelector(".reply-header .nav-bar");
    if (!navBar) return;

    if (document.querySelector(`.${BLOCK_ALL_COMMENTERS_BUTTON_CLASS}`)) return;

    const btn = document.createElement("button");
    btn.className = BLOCK_ALL_COMMENTERS_BUTTON_CLASS;
    btn.type = "button";
    btn.textContent = "Block All Commenters";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (
        !confirm(
          "WARNING: This action will add all currently loaded commenters' UIDs to your Blocklist. Continue?",
        )
      )
        return;
      blockAllCommenters();
    });
    navBar.appendChild(btn);
  }

  function getStyleVariables() {
    return `
      :root {
        --bfilter-button-color: #e53935;
        --bfilter-button-hover-color: #f04f4b;
        --bfilter-followed-color: #18a058;
        --bfilter-followed-background-color: #d2f0dc;
        --bfilter-followed-outline-color: rgba(24, 160, 88, 0.65);
        --bfilter-button-muted-color: #e3e5e7;
        --bfilter-preview-background-color: #ffe8e8;
        --bfilter-preview-outline-color: rgba(229, 57, 53, 0.55);
      }
  `;
  }

  function getStyleVisibility() {
    return `
      [${HIDDEN_ATTR}="true"] { display: none !important; }
      .video-list.row > [class*="col_"][class*="mb_"]:has([${HIDDEN_ATTR}="true"]) { display: none !important; }
      [${PREVIEW_ATTR}="true"] {
        background-color: var(--bfilter-preview-background-color) !important;
        outline: 2px solid var(--bfilter-preview-outline-color) !important;
        outline-offset: -2px;
      }
      /* Search cards cover the marked target. Paint the visible inner surface. */
      [${PREVIEW_ATTR}="true"] .bili-video-card__wrap {
        background-color: var(--bfilter-preview-background-color) !important;
      }
      [${PREVIEW_ATTR}="true"] .bili-video-card__wrap[${PREVIEW_ATTR}="true"] {
        outline: none !important;
      }
      [${FOLLOWED_USER_UID_ATTR}="true"], [${FOLLOWED_USER_UID_ATTR}="true"] .bili-video-card__wrap {
        background-color: var(--bfilter-followed-background-color) !important;
      }
      [${FOLLOWED_USER_UID_ATTR}="true"] {
        outline: 2px solid var(--bfilter-followed-outline-color) !important;
        outline-offset: -2px;
      }
      [${FOLLOWED_USER_UID_ATTR}="true"] .bili-video-card__wrap[${FOLLOWED_USER_UID_ATTR}="true"] {
        outline: none !important;
      }
  `;
  }

  function getStyleButtons() {
    return `
      .${FLOATING_BUTTON_CLASS} {
        position: fixed; top: 10px; right: 24px; z-index: 999999; border: 0;
        border-radius: 18px; min-width: 120px; padding: 8px 16px;
        appearance: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px; font-weight: 700; line-height: 20px; white-space: pre-line;
        text-align: center; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,.18);
      }
      .${PROFILE_BUTTON_CLASS} {
        display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
        width: 120px; height: 64px; margin-right: 8px;
        border: 1px solid var(--bfilter-button-color); border-radius: 0;
        font-size: 17px; font-weight: 700; line-height: 20px;
        cursor: pointer; font-family: inherit;
      }
      .${PROFILE_BUTTON_CLASS} span { font-size: 11px; font-weight: 500; line-height: 14px; }
      .nav-bar__main-right:has(> .${PROFILE_BUTTON_CLASS}) { display: flex; align-items: center; }
      .${FLOATING_BUTTON_CLASS}, #${MANAGER_PANEL_ID} .bfilter-manager-action-primary {
        color: #fff; background: var(--bfilter-button-color);
      }
      .${FLOATING_BUTTON_CLASS}:hover, #${MANAGER_PANEL_ID} .bfilter-manager-action-primary:hover {
        background: var(--bfilter-button-hover-color);
      }
      .${PROFILE_BUTTON_CLASS} {
        color: var(--bfilter-button-color); background: #fff;
      }
      .${PROFILE_BUTTON_CLASS}:hover, .${PROFILE_BUTTON_CLASS}[data-blocked="true"] {
        color: #fff; background: var(--bfilter-button-color);
      }
      .${PROFILE_BUTTON_CLASS}[data-blocked="true"]:hover { background: var(--bfilter-button-hover-color); }
      .${PROFILE_BUTTON_CLASS}[data-followed-user-uid] { color: var(--bfilter-followed-color); border-color: var(--bfilter-followed-color); }
      .${PROFILE_BUTTON_CLASS}[data-followed-user-uid]:hover, .${PROFILE_BUTTON_CLASS}[data-followed-user-uid="true"] { color: #fff; background: var(--bfilter-followed-color); }
      .${PROFILE_BUTTON_CLASS}:disabled, .${PROFILE_BUTTON_CLASS}:disabled:hover {
        color: #9499a0; background: #f1f2f3; border-color: #c9ccd0; cursor: not-allowed;
        text-decoration: line-through;
      }
  `;
  }

  function getStyleManagerPanel() {
    return `
      #${MANAGER_PANEL_ID} {
        position: fixed; top: 62px; right: 24px; z-index: 999999;
        box-sizing: border-box;
        width: 450px; max-width: calc(100vw - 48px); overflow: auto; border: 1px solid rgba(0,0,0,.08);
        border-radius: 14px; padding: 16px; color: #18191c; background: #fff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 12px 32px rgba(0,0,0,.22);
      }
      #${MANAGER_PANEL_ID} *, #${MANAGER_PANEL_ID}::before, #${MANAGER_PANEL_ID}::after { box-sizing: border-box; }
      #${MANAGER_PANEL_ID}[hidden] { display: none !important; }
      #${MANAGER_PANEL_ID} button { font-weight: 700; }
      #${MANAGER_PANEL_ID} .bfilter-manager-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
      #${MANAGER_PANEL_ID} .bfilter-manager-title { font-size: 16px; font-weight: 700; }
      #${MANAGER_PANEL_ID} .bfilter-manager-version { margin-left: 2px; color: #9499a0; font-size: 12px; font-weight: 500; }
      #${MANAGER_PANEL_ID} .bfilter-manager-section { display: grid; grid-template-columns: max-content minmax(0, 1fr); column-gap: 12px; align-items: start; margin-top: 12px; }
      #${MANAGER_PANEL_ID} .bfilter-manager-section:first-of-type { margin-top: 0; }
      #${MANAGER_PANEL_ID} .bfilter-manager-section + .bfilter-manager-section { padding-top: 4px; }
      #${MANAGER_PANEL_ID} .bfilter-manager-option { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; color: #18191c; font-size: 13px; cursor: pointer; }
      #${MANAGER_PANEL_ID} .bfilter-manager-option:last-child { margin-bottom: 0; }
      #${MANAGER_PANEL_ID} .bfilter-manager-option input { margin: 0; }
      #${MANAGER_PANEL_ID} .bfilter-manager-setting-toggle input { position: absolute; opacity: 0; pointer-events: none; }
      #${MANAGER_PANEL_ID} .bfilter-manager-setting-toggle input:checked + .bfilter-manager-toggle-track { background: var(--bfilter-button-color); }
      #${MANAGER_PANEL_ID} .bfilter-manager-setting-toggle input:checked + .bfilter-manager-toggle-track::before { transform: translateX(16px); }
      #${MANAGER_PANEL_ID} .bfilter-manager-setting-toggle input:focus-visible + .bfilter-manager-toggle-track { outline: 2px solid #18191c; outline-offset: 2px; }
      #${MANAGER_PANEL_ID} .bfilter-manager-option:has(input:disabled) { color: #9499a0; cursor: not-allowed; }
      #${MANAGER_PANEL_ID} .bfilter-manager-video-types-control { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
      #${MANAGER_PANEL_ID} .bfilter-manager-video-types-control .bfilter-manager-option { margin-bottom: 0; }
      #${MANAGER_PANEL_ID} .bfilter-manager-video-types,
      #${MANAGER_PANEL_ID} .bfilter-manager-threshold { box-sizing: border-box; width: 105px; height: 20px; border: 1px solid #c9ccd0; border-radius: 6px; padding: 0 4px; background: #fff; color: #18191c; font-size: 13px; appearance: auto; -webkit-appearance: auto; }
      #${MANAGER_PANEL_ID} .bfilter-manager-video-types:disabled { opacity: .42; }
      #${MANAGER_PANEL_ID} .bfilter-manager-threshold-control { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
      #${MANAGER_PANEL_ID} .bfilter-manager-threshold-control .bfilter-manager-option { margin-bottom: 0; }
      #${MANAGER_PANEL_ID} .bfilter-manager-threshold { transition: opacity .2s ease; }
      #${MANAGER_PANEL_ID} .bfilter-manager-threshold-disabled { opacity: .42; }
      #${MANAGER_PANEL_ID} .bfilter-manager-tabs { display: flex; flex-direction: column; align-items: stretch; gap: 2px; border-right: 1px solid #e3e5e7; }
      #${MANAGER_PANEL_ID} .bfilter-manager-tab { position: relative; border: 1px solid transparent; border-right: 0; border-radius: 8px 0 0 8px; padding: 5px 9px; color: #61666d; background: transparent; font-size: 14px; text-align: left; cursor: pointer; }
      #${MANAGER_PANEL_ID} .bfilter-manager-tab[aria-selected="true"] { border-color: #e3e5e7; color: var(--bfilter-button-color); background: #fff; cursor: default; }
      #${MANAGER_PANEL_ID} .bfilter-manager-tab[data-tab="followed-user-uids"][aria-selected="true"] { color: var(--bfilter-followed-color); }
      #${MANAGER_PANEL_ID} .bfilter-manager-tab[aria-selected="true"]::after { content: ""; position: absolute; top: 0; right: -1px; bottom: 0; width: 1px; background: #fff; }
      #${MANAGER_PANEL_ID} .bfilter-manager-tab-panel { grid-column: 2; grid-row: 1; min-height: 290px; }
      #${MANAGER_PANEL_ID} .bfilter-manager-tab-panel[hidden] { display: none !important; }
      #${MANAGER_PANEL_ID} .bfilter-manager-settings-panel { display: grid; align-content: start; gap: 14px; }
      #${MANAGER_PANEL_ID} .bfilter-manager-settings-section { display: grid; gap: 8px; }
      #${MANAGER_PANEL_ID} .bfilter-manager-settings-heading { color: #18191c; font-size: 13px; font-weight: 700; }
      #${MANAGER_PANEL_ID} .bfilter-manager-settings-actions { display: flex; align-items: center; gap: 8px; }
      #${MANAGER_PANEL_ID} .bfilter-manager-statistics-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      #${MANAGER_PANEL_ID} .bfilter-manager-statistics { margin-bottom: 0; padding: 12px; border: 1px solid #e3e5e7; border-radius: 10px; background: linear-gradient(135deg, #f6f7f8, #fff); }
      #${MANAGER_PANEL_ID} .bfilter-manager-statistics-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
      #${MANAGER_PANEL_ID} .bfilter-manager-statistic { display: grid; gap: 3px; min-width: 0; padding: 8px; border-radius: 7px; background: rgba(255,255,255,.8); color: #61666d; font-size: 12px; font-weight: 400; line-height: 1.35; }
      #${MANAGER_PANEL_ID} .bfilter-manager-statistic[data-statistics-level="low"], #${STATISTICS_OVERLAY_ID} .bfilter-statistics-overlay-list > div[data-statistics-level="low"] { background: #ccebd4; }
      #${MANAGER_PANEL_ID} .bfilter-manager-statistic[data-statistics-level="medium"], #${STATISTICS_OVERLAY_ID} .bfilter-statistics-overlay-list > div[data-statistics-level="medium"] { background: #ffe0b2; }
      #${MANAGER_PANEL_ID} .bfilter-manager-statistic[data-statistics-level="high"], #${STATISTICS_OVERLAY_ID} .bfilter-statistics-overlay-list > div[data-statistics-level="high"] { background: #ffc9c9; }
      #${MANAGER_PANEL_ID} .bfilter-manager-statistic output { overflow: hidden; margin: 0; color: #4b4f55; font-size: 13px; font-weight: 400; text-overflow: ellipsis; white-space: nowrap; }
      #${MANAGER_PANEL_ID} .bfilter-manager-statistics-help { color: #61666d; font-size: 12px; line-height: 1.45; }
      #${MANAGER_PANEL_ID} .bfilter-manager-textarea { box-sizing: border-box; display: block; width: 100%; min-height: 160px; border: 1px solid #c9ccd0; border-radius: 10px; padding: 10px; color: #18191c; background: #f6f7f8; font-size: 14px; line-height: 1.5; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important; white-space: pre-wrap; overflow-wrap: anywhere; caret-color: #18191c; resize: vertical; }
      #${MANAGER_PANEL_ID} .bfilter-manager-help { margin: 8px 0 12px; color: #9499a0; font-size: 12px; white-space: pre-line; }
      #${MANAGER_PANEL_ID} .bfilter-manager-actions { display: flex; grid-column: 1 / -1; align-items: center; justify-content: space-between; gap: 8px; }
      #${MANAGER_PANEL_ID} .bfilter-manager-action-buttons { display: inline-flex; align-items: center; gap: 8px; }
      #${MANAGER_PANEL_ID} .bfilter-manager-preview-toggle, #${MANAGER_PANEL_ID} .bfilter-manager-statistics-toggle { display: inline-flex; align-items: center; gap: 8px; color: #61666d; font-size: 13px; font-weight: 700; cursor: pointer; user-select: none; }
      #${MANAGER_PANEL_ID} .bfilter-manager-preview-toggle input, #${MANAGER_PANEL_ID} .bfilter-manager-statistics-toggle input { position: absolute; opacity: 0; pointer-events: none; }
      #${MANAGER_PANEL_ID} .bfilter-manager-toggle-track { position: relative; width: 36px; height: 20px; border-radius: 999px; background: #c9ccd0; transition: background .2s ease; }
      #${MANAGER_PANEL_ID} .bfilter-manager-toggle-track::before { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .2s ease; }
      #${MANAGER_PANEL_ID} .bfilter-manager-preview-toggle input:checked + .bfilter-manager-toggle-track, #${MANAGER_PANEL_ID} .bfilter-manager-statistics-toggle input:checked + .bfilter-manager-toggle-track { background: var(--bfilter-button-color); }
      #${MANAGER_PANEL_ID} .bfilter-manager-preview-toggle input:checked + .bfilter-manager-toggle-track::before, #${MANAGER_PANEL_ID} .bfilter-manager-statistics-toggle input:checked + .bfilter-manager-toggle-track::before { transform: translateX(16px); }
      #${MANAGER_PANEL_ID} .bfilter-manager-statistics-toggle input:focus-visible + .bfilter-manager-toggle-track { outline: 2px solid #18191c; outline-offset: 2px; }
      #${MANAGER_PANEL_ID} .bfilter-manager-action { border: 0; border-radius: 8px; padding: 7px 12px; color: #18191c; background: var(--bfilter-button-muted-color); font-size: 13px; cursor: pointer; }
      #${MANAGER_PANEL_ID} .bfilter-manager-action:not(:disabled):active { transform: translateY(1px); }
      #${MANAGER_PANEL_ID} .bfilter-manager-action:disabled { color: #9499a0; background: var(--bfilter-button-muted-color); cursor: not-allowed; }
      #${MANAGER_PANEL_ID} .bfilter-manager-close { border: 0; border-radius: 50%; width: 28px; height: 28px; color: #61666d; background: #f1f2f3; font-size: 18px; line-height: 28px; cursor: pointer; }
      #${STATISTICS_OVERLAY_ID} { position: fixed; top: 54px; right: 24px; z-index: 999998; display: inline-flex; align-items: center; gap: 3px; width: max-content; max-width: calc(100vw - 48px); padding: 3px; border: 1px solid rgba(0,0,0,.08); border-radius: 12px; color: #18191c; background: rgba(255,255,255,.96); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; box-shadow: 0 10px 28px rgba(0,0,0,.18); }
      #${STATISTICS_OVERLAY_ID} .bfilter-statistics-overlay-list { display: flex; flex-wrap: nowrap; gap: 1px; }
      #${STATISTICS_OVERLAY_ID} .bfilter-statistics-overlay-list > div { display: inline-flex; align-items: baseline; gap: 1px; min-width: 0; padding: 1px 1px; border-radius: 7px; background: #f6f7f8; color: #8f949a; font-size: 14px; font-weight: 400; line-height: 1; }
      #${STATISTICS_OVERLAY_ID} output { overflow: hidden; margin: 0; color: #4b4f55; font-size: 16px; font-weight: 400; text-overflow: ellipsis; white-space: nowrap; }
      #${STATISTICS_OVERLAY_ID} .bfilter-statistics-overlay-close { width: 18px; height: 18px; flex: 0 0 18px; border: 0; border-radius: 50%; padding: 0; color: #61666d; background: #e3e5e7; font-size: 15px; font-weight: 400; line-height: 18px; cursor: pointer; transition: background .15s ease; }
      #${STATISTICS_OVERLAY_ID} .bfilter-statistics-overlay-close:hover { background: #c9ccd0; }
      #${STATISTICS_OVERLAY_ID} .bfilter-statistics-overlay-close:focus-visible { outline: 2px solid #18191c; outline-offset: 2px; }
      @media (max-width: 460px) {
        #${MANAGER_PANEL_ID} .bfilter-manager-statistics-list { grid-template-columns: 1fr; }
        #${MANAGER_PANEL_ID} .bfilter-manager-statistic { grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; }
        #${MANAGER_PANEL_ID} .bfilter-manager-statistic output { grid-column: 1 / -1; }
      }
  `;
  }

  function getStyleCommentButtons() {
    return `
      .${COMMENT_BLOCK_BUTTON_CLASS} {
        display: inline-flex; align-items: center; justify-content: center;
        margin-left: 6px; padding: 0 6px; height: 18px;
        border: 1px solid var(--bfilter-button-color); border-radius: 4px;
        color: var(--bfilter-button-color); background: #fff;
        font-size: 11px; line-height: 1; cursor: pointer;
        vertical-align: middle; font-family: inherit;
        transition: background .15s, color .15s;
      }
      .${COMMENT_BLOCK_BUTTON_CLASS}:hover {
        color: #fff; background: var(--bfilter-button-color);
      }
      .${COMMENT_BLOCK_BUTTON_CLASS}[data-blocked="true"] {
        color: #fff; background: var(--bfilter-button-color);
      }
      .${COMMENT_BLOCK_BUTTON_CLASS}[data-blocked="true"]:hover { background: var(--bfilter-button-hover-color); }
      .${BLOCK_ALL_COMMENTERS_BUTTON_CLASS} {
        margin-left: 12px; padding: 4px 10px; border: 1px solid var(--bfilter-button-color);
        border-radius: 6px; color: var(--bfilter-button-color); background: #fff;
        font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit;
      }
      .${BLOCK_ALL_COMMENTERS_BUTTON_CLASS}:hover { color: #fff; background: var(--bfilter-button-color); }
  `;
  }

  function getStyleText() {
    return [
      getStyleVariables(),
      getStyleVisibility(),
      getStyleButtons(),
      getStyleManagerPanel(),
      getStyleCommentButtons(),
    ].join("\n");
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = getStyleText();

    const appendStyle = () => {
      if (document.getElementById(STYLE_ID)) return;

      const parent = document.head || document.documentElement;
      if (!parent) return;

      parent.appendChild(style);
    };

    appendStyle();
    if (!style.isConnected)
      document.addEventListener("DOMContentLoaded", appendStyle, {
        once: true,
      });
  }
})();

// ==UserScript==
// @name         Bfilter
// @namespace    https://github.com/mr-yifeiwang/bfilter
// @version      0.17.0
// @description  Manage in-browser Bilibili followlist and blocklist
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

  const BLOCK_ATTR = "data-bfilter-blocked";
  const PREVIEW_ATTR = "data-bfilter-previewed";
  const FOLLOW_ATTR = "data-bfilter-followed";
  const BLOCKED_UID_ATTR = "data-bfilter-blocked-uid";

  const BLOCKLIST_STORAGE_KEY = "bfilter:blocklist";
  const FOLLOWING_STORAGE_KEY = "bfilter:following";
  const VIDEO_KEYWORD_BLOCKLIST_STORAGE_KEY = "bfilter:video-keyword-blocklist";
  const COMMENT_KEYWORD_BLOCKLIST_STORAGE_KEY =
    "bfilter:comment-keyword-blocklist";
  const DANMAKU_KEYWORD_BLOCKLIST_STORAGE_KEY =
    "bfilter:danmaku-keyword-blocklist";
  const SETTING_KEYS = {
    blockNewUsers: "bfilter:block-new-users",
    registrationTimeThreshold: "bfilter:registration-time-threshold",
    previewMode: "bfilter:preview-mode",
    hideShortVideos: "bfilter:hide-short-videos",
    shortVideoThreshold: "bfilter:short-video-threshold",
    hideUnpopularVideos: "bfilter:hide-unpopular-videos",
    unpopularVideoThreshold: "bfilter:unpopular-video-threshold",
    hideBadgedVideos: "bfilter:hide-badged-videos",
    hideLiveVideos: "bfilter:hide-live-videos",
    hideMangaVideos: "bfilter:hide-manga-videos",
    hideCourseVideos: "bfilter:hide-course-videos",
    hideBangumiVideos: "bfilter:hide-bangumi-videos",
    addUsernamesToFollowing: "bfilter:add-usernames-to-following",
  };

  const USER_BUTTON_ID = "bfilter-user-button";
  const FOLLOW_BUTTON_ID = "bfilter-follow-button";
  const MANAGER_BUTTON_ID = "bfilter-manager-button";
  const FLOATING_BUTTON_CLASS = "bfilter-floating-button";
  const PROFILE_BUTTON_CLASS = "bfilter-profile-button";
  const MANAGER_PANEL_ID = "bfilter-manager-panel";
  const SCRIPT_VERSION =
    typeof GM_info !== "undefined" && GM_info.script && GM_info.script.version;
  const MANAGER_TEXTAREA_ID = "bfilter-manager-textarea";
  const MANAGER_FOLLOWING_TEXTAREA_ID = "bfilter-manager-following-textarea";
  const MANAGER_VIDEO_KEYWORDS_TEXTAREA_ID =
    "bfilter-manager-video-keywords-textarea";
  const MANAGER_COMMENT_KEYWORDS_TEXTAREA_ID =
    "bfilter-manager-comment-keywords-textarea";
  const MANAGER_DANMAKU_KEYWORDS_TEXTAREA_ID =
    "bfilter-manager-danmaku-keywords-textarea";

  const COMMENT_BLOCK_BTN_CLASS = "bfilter-comment-block-button";
  const BLOCK_ALL_COMMENTERS_BTN_CLASS = "bfilter-block-all-commenters-button";

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

  const VIDEO_LINK_SELECTOR = [
    'a[href*="/video/"]',
    'a[href*="bilibili.com/video/"]',
    'a[href*="/bangumi/play/"]',
  ].join(",");

  const BADGED_VIDEO_LINK_SELECTORS = {
    live: 'a[href*="live.bilibili.com/"]',
    manga: 'a[href*="manga.bilibili.com/"]',
    course: 'a[href*="bilibili.com/cheese/"]',
    bangumi: 'a[href*="bilibili.com/bangumi/"]',
  };
  const BADGED_VIDEO_LINK_SELECTOR = Object.values(
    BADGED_VIDEO_LINK_SELECTORS,
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

  const SHORT_VIDEO_THRESHOLD_OPTIONS = [
    { label: "< 1 min", seconds: 60 },
    { label: "< 3 min", seconds: 3 * 60 },
    { label: "< 5 min", seconds: 5 * 60 },
    { label: "< 10 min", seconds: 10 * 60 },
    { label: "< 20 min", seconds: 20 * 60 },
  ];
  const DEFAULT_SHORT_VIDEO_THRESHOLD = "< 1 min";

  const UNPOPULAR_VIDEO_THRESHOLD_OPTIONS = [
    { label: "< 1k views", views: 1000 },
    { label: "< 5k views", views: 5000 },
    { label: "< 10k views", views: 10000 },
    { label: "< 50k views", views: 50000 },
    { label: "< 100k views", views: 100000 },
  ];
  const DEFAULT_UNPOPULAR_VIDEO_THRESHOLD = "< 1k views";

  const BOOLEAN_CONTROLS = [
    {
      name: "blockNewUsers",
      id: "bfilter-manager-block-new-users",
      label: "Block new users",
      threshold: {
        setting: "registrationTimeThreshold",
        key: SETTING_KEYS.registrationTimeThreshold,
        id: "bfilter-manager-registration-threshold",
        options: REGISTRATION_TIME_THRESHOLD_OPTIONS,
        defaultValue: DEFAULT_REGISTRATION_TIME_THRESHOLD,
        fallbackIndex: REGISTRATION_TIME_THRESHOLD_OPTIONS.length - 1,
      },
    },
    {
      name: "hideShortVideos",
      id: "bfilter-manager-hide-short-videos",
      label: "Hide short videos",
      threshold: {
        setting: "shortVideoThreshold",
        key: SETTING_KEYS.shortVideoThreshold,
        id: "bfilter-manager-short-video-threshold",
        options: SHORT_VIDEO_THRESHOLD_OPTIONS,
        defaultValue: DEFAULT_SHORT_VIDEO_THRESHOLD,
        fallbackIndex: 2,
      },
    },
    {
      name: "hideUnpopularVideos",
      id: "bfilter-manager-hide-unpopular-videos",
      label: "Hide unpopular videos",
      threshold: {
        setting: "unpopularVideoThreshold",
        key: SETTING_KEYS.unpopularVideoThreshold,
        id: "bfilter-manager-unpopular-video-threshold",
        options: UNPOPULAR_VIDEO_THRESHOLD_OPTIONS,
        defaultValue: DEFAULT_UNPOPULAR_VIDEO_THRESHOLD,
        fallbackIndex: 2,
      },
    },
    {
      name: "hideBadgedVideos",
      id: "bfilter-manager-hide-badged-videos",
      label: "Hide badged videos",
    },
    {
      name: "hideLiveVideos",
      id: "bfilter-manager-hide-live-videos",
      label: "Live",
      defaultValue: false,
      childOf: "hideBadgedVideos",
    },
    {
      name: "hideMangaVideos",
      id: "bfilter-manager-hide-manga-videos",
      label: "Manga",
      defaultValue: false,
      childOf: "hideBadgedVideos",
    },
    {
      name: "hideCourseVideos",
      id: "bfilter-manager-hide-course-videos",
      label: "Course",
      defaultValue: false,
      childOf: "hideBadgedVideos",
    },
    {
      name: "hideBangumiVideos",
      id: "bfilter-manager-hide-bangumi-videos",
      label: "Bangumi",
      defaultValue: false,
      childOf: "hideBadgedVideos",
    },
    {
      name: "previewMode",
      id: "bfilter-manager-preview-mode",
      label: "Preview",
      previewToggle: true,
    },
    {
      name: "addUsernamesToFollowing",
      id: "bfilter-manager-add-usernames-to-following",
      label: "Add usernames by default",
      defaultValue: true,
      followingOption: true,
    },
  ];

  const BLOCKED_UIDS = new Set();
  const FOLLOWING_UIDS = new Set();
  const BLOCKED_VIDEO_KEYWORDS = new Set();
  const BLOCKED_COMMENT_KEYWORDS = new Set();
  const BLOCKED_DANMAKU_KEYWORDS = new Set();
  const settings = {
    blockNewUsers: false,
    previewMode: false,
    hideShortVideos: false,
    hideUnpopularVideos: false,
    hideBadgedVideos: false,
    hideLiveVideos: false,
    hideMangaVideos: false,
    hideCourseVideos: false,
    hideBangumiVideos: false,
    addUsernamesToFollowing: true,
    registrationTimeThreshold: DEFAULT_REGISTRATION_TIME_THRESHOLD,
    shortVideoThreshold: DEFAULT_SHORT_VIDEO_THRESHOLD,
    unpopularVideoThreshold: DEFAULT_UNPOPULAR_VIDEO_THRESHOLD,
  };

  let scheduled = false;
  let observerStarted = false;
  const pendingRoots = new Set();

  addStyle();
  boot();

  function boot() {
    replaceRuntimeBlockedUids(
      parseBlockedUserListText(readSavedBlockedUserListText()),
    );
    replaceRuntimeFollowingUids(
      parseFollowingUserListText(readSavedFollowingUserListText()),
    );
    replaceRuntimeBlockedVideoKeywords(
      parseVideoKeywordListText(readSavedVideoKeywordListText()),
    );
    replaceRuntimeBlockedCommentKeywords(
      parseCommentKeywordListText(readSavedCommentKeywordListText()),
    );
    replaceRuntimeBlockedDanmakuKeywords(
      parseDanmakuKeywordListText(readSavedDanmakuKeywordListText()),
    );
    for (const { name } of BOOLEAN_CONTROLS) {
      const control = getControl(name);
      settings[name] = readBooleanSetting(
        SETTING_KEYS[name],
        control.defaultValue || false,
      );
    }
    for (const control of getThresholdControls()) {
      settings[control.threshold.setting] = readLabelSetting(
        control.threshold.key,
        control.threshold.defaultValue,
        control.threshold.options,
      );
    }

    setupStorageSync();
    renderUserPageBlockButton();
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
    renderUserPageBlockButton();
    renderBfilterManager();
    renderBlockAllCommentersButton();
    scheduleScan(document.documentElement, { force: true });
  }

  function scheduleScan(root, options = {}) {
    if (!isCardBlockingPage() || !isElement(root)) return;
    pendingRoots.add(root);
    if (options.force) pendingRoots.add(document.documentElement);
    if (scheduled) return;

    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const roots = [...pendingRoots];
      pendingRoots.clear();
      for (const pendingRoot of roots) scan(pendingRoot, options);
    });
  }

  function scan(root) {
    if (!isCardBlockingPage() || !isElement(root)) return;

    for (const candidate of collectCandidates(root)) {
      const comment = resolveCommentItem(candidate);
      if (comment) {
        if (followedCommentAuthorReason(comment)) {
          applyFollow(comment);
          continue;
        }
        const reason = evaluateComment(comment);
        if (reason) applyConsequence(comment, reason);
        continue;
      }

      const danmaku = resolveDanmaku(candidate);
      if (danmaku) {
        const reason = evaluateDanmaku(danmaku);
        if (reason) applyConsequence(danmaku, reason);
        else clearConsequence(danmaku);
        continue;
      }

      const card = resolveVideoCard(candidate);
      if (!card) continue;

      const followedUid = followedUidReason(card);
      if (followedUid) {
        const target = resolveConsequenceTarget(card, {
          type: "uid",
          uid: followedUid,
        });
        if (isValidConsequenceTarget(target, card, { uid: followedUid }))
          applyFollow(target);
        continue;
      }

      const reason = evaluateCard(card);
      if (!reason) continue;

      const target = resolveConsequenceTarget(card, reason);
      if (isValidConsequenceTarget(target, card, reason)) {
        applyConsequence(target, reason);
      }
    }
    renderCommentBlockButtons();
    renderBlockAllCommentersButton();
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
    addIfMatches(root, BADGED_VIDEO_LINK_SELECTOR, candidates);
    for (const selector of [
      CARD_SELECTOR,
      COMMENT_ITEM_SELECTOR,
      DANMAKU_SELECTOR,
      DANMAKU_TEXT_SELECTOR,
      UPLOADER_SELECTOR,
      COMMENT_USER_LINK_SELECTOR,
      VIDEO_LINK_SELECTOR,
      BADGED_VIDEO_LINK_SELECTOR,
    ]) {
      for (const element of root.querySelectorAll(selector))
        candidates.add(element);
    }
    return candidates;
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

  function evaluateCard(card) {
    return (
      blockedUidReason(card) ||
      blockedVideoKeywordReason(card) ||
      newUserReason(card) ||
      shortVideoReason(card) ||
      unpopularVideoReason(card) ||
      badgedVideoReason(card)
    );
  }

  function evaluateComment(comment) {
    return (
      blockedCommentAuthorReason(comment) ||
      blockedCommentKeywordReason(comment) ||
      newCommentAuthorReason(comment)
    );
  }

  function evaluateDanmaku(danmaku) {
    const keyword = getMatchedDanmakuKeyword(getDanmakuText(danmaku));
    return keyword ? { type: "danmaku-keyword", uid: "", keyword } : null;
  }

  function blockedUidReason(card) {
    const uid = getUploaderUidsInside(card).find((value) =>
      BLOCKED_UIDS.has(value),
    );
    return uid ? { type: "uid", uid } : null;
  }

  function blockedCommentAuthorReason(comment) {
    const uid = getCommentAuthorUidsInside(comment).find((value) =>
      BLOCKED_UIDS.has(value),
    );
    return uid ? { type: "uid", uid } : null;
  }

  function blockedCommentKeywordReason(comment) {
    const keyword = getMatchedCommentKeyword(getCommentText(comment));
    return keyword ? { type: "comment-keyword", uid: "", keyword } : null;
  }

  function followedUidReason(card) {
    return getUploaderUidsInside(card).find((uid) => FOLLOWING_UIDS.has(uid));
  }

  function followedCommentAuthorReason(comment) {
    return getCommentAuthorUidsInside(comment).find((uid) =>
      FOLLOWING_UIDS.has(uid),
    );
  }

  function blockedVideoKeywordReason(card) {
    const keyword = getMatchedVideoKeyword(getVideoTitleText(card));
    return keyword ? { type: "video-keyword", uid: "", keyword } : null;
  }

  function newCommentAuthorReason(comment) {
    if (!settings.blockNewUsers) return null;
    const uid = getCommentAuthorUidsInside(comment).find(isNewUserUid);
    return uid ? { type: "new-user", uid } : null;
  }

  function newUserReason(card) {
    if (!settings.blockNewUsers) return null;
    const uid = getUploaderUidsInside(card).find(isNewUserUid);
    return uid ? { type: "new-user", uid } : null;
  }

  function shortVideoReason(card) {
    if (!settings.hideShortVideos || !canUseMetadataFilter(card)) return null;
    const seconds = getVideoDurationSeconds(card);
    return seconds > 0 && seconds < getShortVideoThresholdSeconds()
      ? { type: "short-video", uid: "" }
      : null;
  }

  function unpopularVideoReason(card) {
    if (!settings.hideUnpopularVideos || !canUseMetadataFilter(card))
      return null;
    const views = getVideoViewCount(card);
    return views != null && views < getUnpopularVideoThresholdViews()
      ? { type: "unpopular-video", uid: "" }
      : null;
  }

  function badgedVideoReason(card) {
    if (!settings.hideBadgedVideos || !canUseMetadataFilter(card)) return null;
    return hasBadgedVideoLinkInside(card)
      ? { type: "badged-video", uid: "" }
      : null;
  }

  function canUseMetadataFilter(card) {
    return !isDirectVideoPage() || isInsideRecommendationArea(card);
  }

  function getMatchedVideoKeyword(text) {
    if (!BLOCKED_VIDEO_KEYWORDS.size) return "";
    const haystack = String(text || "");
    if (!haystack) return "";
    return [...BLOCKED_VIDEO_KEYWORDS].find((keyword) =>
      haystack.includes(keyword),
    );
  }

  function getMatchedCommentKeyword(text) {
    if (!BLOCKED_COMMENT_KEYWORDS.size) return "";
    const haystack = String(text || "");
    if (!haystack) return "";
    return [...BLOCKED_COMMENT_KEYWORDS].find((keyword) =>
      haystack.includes(keyword),
    );
  }

  function getMatchedDanmakuKeyword(text) {
    if (!BLOCKED_DANMAKU_KEYWORDS.size) return "";
    const haystack = String(text || "");
    if (!haystack) return "";
    return [...BLOCKED_DANMAKU_KEYWORDS].find((keyword) =>
      haystack.includes(keyword),
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

  function getDanmakuText(danmaku) {
    const text = danmaku.querySelector(DANMAKU_TEXT_SELECTOR);
    return text ? text.textContent || "" : danmaku.textContent || "";
  }

  function getCommentText(comment) {
    const text = comment.querySelector(COMMENT_TEXT_SELECTOR);
    return text ? text.textContent || "" : comment.textContent || "";
  }

  function isNewUserUid(uid) {
    return /^\d+$/.test(uid) && uid.length >= getRegistrationTimeThreshold();
  }

  function getRegistrationTimeThreshold() {
    return getRegistrationTimeThresholdOption().minDigits;
  }

  function getRegistrationTimeThresholdOption(
    value = settings.registrationTimeThreshold,
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

  function getShortVideoThresholdSeconds() {
    return getShortVideoThresholdOption().seconds;
  }

  function getShortVideoThresholdOption(value = settings.shortVideoThreshold) {
    return (
      SHORT_VIDEO_THRESHOLD_OPTIONS.find((option) => option.label === value) ||
      SHORT_VIDEO_THRESHOLD_OPTIONS[2]
    );
  }

  function getUnpopularVideoThresholdViews() {
    return getUnpopularVideoThresholdOption().views;
  }

  function getUnpopularVideoThresholdOption(
    value = settings.unpopularVideoThreshold,
  ) {
    return (
      UNPOPULAR_VIDEO_THRESHOLD_OPTIONS.find(
        (option) => option.label === value,
      ) || UNPOPULAR_VIDEO_THRESHOLD_OPTIONS[2]
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

  function resolveConsequenceTarget(card, reason) {
    if (isBadgedVideoReason(reason)) {
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

  function isBadgedVideoReason(reason) {
    return reason && reason.type === "badged-video";
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

  function applyConsequence(target, reason) {
    target.removeAttribute(FOLLOW_ATTR);
    clearNestedConsequences(target);
    target.removeAttribute(settings.previewMode ? BLOCK_ATTR : PREVIEW_ATTR);

    const activeAttr = settings.previewMode ? PREVIEW_ATTR : BLOCK_ATTR;
    if (
      target.parentElement &&
      target.parentElement.closest(`[${activeAttr}]`)
    ) {
      clearConsequence(target);
      return;
    }

    target.setAttribute(activeAttr, "true");
    target.setAttribute(BLOCKED_UID_ATTR, reason.uid || "");
  }

  function applyFollow(target) {
    clearNestedConsequences(target);
    clearConsequence(target);
    target.setAttribute(FOLLOW_ATTR, "true");
  }

  function refreshConsequences() {
    for (const element of document.querySelectorAll(
      `[${BLOCK_ATTR}], [${PREVIEW_ATTR}], [${FOLLOW_ATTR}]`,
    )) {
      clearConsequence(element);
    }
    scan(document.documentElement);
  }

  function clearNestedConsequences(target) {
    for (const nested of target.querySelectorAll(
      `[${BLOCK_ATTR}], [${PREVIEW_ATTR}], [${FOLLOW_ATTR}]`,
    )) {
      clearConsequence(nested);
    }
  }

  function clearConsequence(element) {
    element.removeAttribute(BLOCK_ATTR);
    element.removeAttribute(PREVIEW_ATTR);
    element.removeAttribute(FOLLOW_ATTR);
    element.removeAttribute(BLOCKED_UID_ATTR);
  }

  function unhideCardsForUid(uid) {
    for (const element of document.querySelectorAll(
      `[${BLOCKED_UID_ATTR}="${uid}"]`,
    )) {
      clearConsequence(element);
    }
  }

  function isPotentialVideoCard(element) {
    if (!isElement(element) || isUnsafePageContainer(element)) return false;
    if (matches(element, ".video-card__content")) return false;
    if (isPotentialBadgedCard(element)) return true;
    if (!hasInOrSelf(element, VIDEO_LINK_SELECTOR)) return false;
    if (matches(element, CARD_SELECTOR)) return true;
    return (
      hasInOrSelf(element, UPLOADER_SELECTOR) &&
      (hasInOrSelf(element, VISUAL_SELECTOR) ||
        hasInOrSelf(element, TITLE_SELECTOR))
    );
  }

  function isPotentialBadgedCard(element) {
    return Boolean(
      settings.hideBadgedVideos &&
      matches(element, CARD_SELECTOR) &&
      hasBadgedVideoLinkInside(element),
    );
  }

  function hasBadgedVideoLinkInside(card) {
    const selector = getActiveBadgedVideoLinkSelector();
    if (!selector) return false;
    return [...card.querySelectorAll(selector)].some((link) =>
      link.closest(CARD_SELECTOR),
    );
  }

  function getActiveBadgedVideoLinkSelector() {
    if (!settings.hideBadgedVideos) return "";
    return [
      settings.hideLiveVideos && BADGED_VIDEO_LINK_SELECTORS.live,
      settings.hideMangaVideos && BADGED_VIDEO_LINK_SELECTORS.manga,
      settings.hideCourseVideos && BADGED_VIDEO_LINK_SELECTORS.course,
      settings.hideBangumiVideos && BADGED_VIDEO_LINK_SELECTORS.bangumi,
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

  function setupStorageSync() {
    if (typeof GM_addValueChangeListener === "function") {
      GM_addValueChangeListener(
        BLOCKLIST_STORAGE_KEY,
        (_key, _oldValue, value, remote) => {
          if (remote) syncBlockedUids(value);
        },
      );
      GM_addValueChangeListener(
        FOLLOWING_STORAGE_KEY,
        (_key, _oldValue, value, remote) => {
          if (remote) syncFollowingUids(value);
        },
      );
      GM_addValueChangeListener(
        VIDEO_KEYWORD_BLOCKLIST_STORAGE_KEY,
        (_key, _oldValue, value, remote) => {
          if (remote) syncBlockedVideoKeywords(value);
        },
      );
      GM_addValueChangeListener(
        COMMENT_KEYWORD_BLOCKLIST_STORAGE_KEY,
        (_key, _oldValue, value, remote) => {
          if (remote) syncBlockedCommentKeywords(value);
        },
      );
      GM_addValueChangeListener(
        DANMAKU_KEYWORD_BLOCKLIST_STORAGE_KEY,
        (_key, _oldValue, value, remote) => {
          if (remote) syncBlockedDanmakuKeywords(value);
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
      if (event.key === BLOCKLIST_STORAGE_KEY) syncBlockedUids(event.newValue);
      if (event.key === FOLLOWING_STORAGE_KEY)
        syncFollowingUids(event.newValue);
      if (event.key === VIDEO_KEYWORD_BLOCKLIST_STORAGE_KEY)
        syncBlockedVideoKeywords(event.newValue);
      if (event.key === COMMENT_KEYWORD_BLOCKLIST_STORAGE_KEY)
        syncBlockedCommentKeywords(event.newValue);
      if (event.key === DANMAKU_KEYWORD_BLOCKLIST_STORAGE_KEY)
        syncBlockedDanmakuKeywords(event.newValue);
      for (const { name } of BOOLEAN_CONTROLS) {
        if (event.key === SETTING_KEYS[name])
          syncBooleanSetting(name, event.newValue);
      }
      for (const control of getThresholdControls()) {
        if (event.key === control.threshold.key)
          syncThresholdSetting(control, event.newValue);
      }
    });
  }

  function syncBlockedUids(savedValue) {
    replaceRuntimeBlockedUids(parseBlockedUserListText(savedValue || ""));
    refreshConsequences();
    refreshBfilterManagerPanel();
    renderUserPageBlockButton();
  }

  function syncFollowingUids(savedValue) {
    replaceRuntimeFollowingUids(parseFollowingUserListText(savedValue || ""));
    refreshConsequences();
    refreshBfilterManagerPanel();
    renderUserPageBlockButton();
  }

  function syncBlockedVideoKeywords(savedValue) {
    replaceRuntimeBlockedVideoKeywords(
      parseVideoKeywordListText(savedValue || ""),
    );
    refreshConsequences();
    refreshBfilterManagerPanel();
  }

  function syncBlockedCommentKeywords(savedValue) {
    replaceRuntimeBlockedCommentKeywords(
      parseCommentKeywordListText(savedValue || ""),
    );
    refreshConsequences();
    refreshBfilterManagerPanel();
  }

  function syncBlockedDanmakuKeywords(savedValue) {
    replaceRuntimeBlockedDanmakuKeywords(
      parseDanmakuKeywordListText(savedValue || ""),
    );
    refreshConsequences();
    refreshBfilterManagerPanel();
  }

  function syncBooleanSetting(name, savedValue) {
    settings[name] = parseBooleanSetting(savedValue, false);
    refreshConsequences();
    refreshBooleanControls();
    renderUserPageBlockButton();
  }

  function syncThresholdSetting(control, savedValue) {
    const { setting, defaultValue, options } = control.threshold;
    settings[setting] = parseLabelSetting(savedValue, defaultValue, options);
    refreshConsequences();
    refreshThresholdControls();
    renderUserPageBlockButton();
  }

  function readSavedBlockedUserListText() {
    try {
      const saved =
        typeof GM_getValue === "function"
          ? GM_getValue(BLOCKLIST_STORAGE_KEY, null)
          : localStorage.getItem(BLOCKLIST_STORAGE_KEY);
      return String(saved || "");
    } catch (_error) {
      return "";
    }
  }

  function readSavedFollowingUserListText() {
    try {
      const saved =
        typeof GM_getValue === "function"
          ? GM_getValue(FOLLOWING_STORAGE_KEY, null)
          : localStorage.getItem(FOLLOWING_STORAGE_KEY);
      return String(saved || "");
    } catch (_error) {
      return "";
    }
  }

  function readSavedVideoKeywordListText() {
    try {
      const saved =
        typeof GM_getValue === "function"
          ? GM_getValue(VIDEO_KEYWORD_BLOCKLIST_STORAGE_KEY, null)
          : localStorage.getItem(VIDEO_KEYWORD_BLOCKLIST_STORAGE_KEY);
      return String(saved || "");
    } catch (_error) {
      return "";
    }
  }

  function readSavedCommentKeywordListText() {
    try {
      const saved =
        typeof GM_getValue === "function"
          ? GM_getValue(COMMENT_KEYWORD_BLOCKLIST_STORAGE_KEY, null)
          : localStorage.getItem(COMMENT_KEYWORD_BLOCKLIST_STORAGE_KEY);
      return String(saved || "");
    } catch (_error) {
      return "";
    }
  }

  function readSavedDanmakuKeywordListText() {
    try {
      const saved =
        typeof GM_getValue === "function"
          ? GM_getValue(DANMAKU_KEYWORD_BLOCKLIST_STORAGE_KEY, null)
          : localStorage.getItem(DANMAKU_KEYWORD_BLOCKLIST_STORAGE_KEY);
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

  function replaceRuntimeBlockedUids(nextUids) {
    const next = new Set(nextUids.map(normalizeUid).filter(Boolean));
    for (const uid of [...BLOCKED_UIDS]) {
      if (!next.has(uid)) {
        BLOCKED_UIDS.delete(uid);
        unhideCardsForUid(uid);
      }
    }
    for (const uid of next) BLOCKED_UIDS.add(uid);
  }

  function replaceRuntimeFollowingUids(nextUids) {
    FOLLOWING_UIDS.clear();
    for (const uid of nextUids.map(normalizeUid).filter(Boolean))
      FOLLOWING_UIDS.add(uid);
  }

  function replaceRuntimeBlockedVideoKeywords(nextKeywords) {
    BLOCKED_VIDEO_KEYWORDS.clear();
    for (const keyword of dedupeKeywords(nextKeywords)) {
      BLOCKED_VIDEO_KEYWORDS.add(keyword);
    }
  }

  function replaceRuntimeBlockedCommentKeywords(nextKeywords) {
    BLOCKED_COMMENT_KEYWORDS.clear();
    for (const keyword of dedupeKeywords(nextKeywords)) {
      BLOCKED_COMMENT_KEYWORDS.add(keyword);
    }
  }

  function replaceRuntimeBlockedDanmakuKeywords(nextKeywords) {
    BLOCKED_DANMAKU_KEYWORDS.clear();
    for (const keyword of dedupeKeywords(nextKeywords)) {
      BLOCKED_DANMAKU_KEYWORDS.add(keyword);
    }
  }

  function saveBlockedUserListText(textValue) {
    try {
      const value =
        textValue == null ? getBlockedUidList().join("\n") : textValue;
      if (typeof GM_setValue === "function")
        GM_setValue(BLOCKLIST_STORAGE_KEY, value);
      else localStorage.setItem(BLOCKLIST_STORAGE_KEY, value);
    } catch (_error) {
      // Keep runtime blocklist even if persistence fails.
    }
  }

  function saveFollowingUserListText(textValue) {
    try {
      const value =
        textValue == null ? getFollowingUidList().join("\n") : textValue;
      if (typeof GM_setValue === "function")
        GM_setValue(FOLLOWING_STORAGE_KEY, value);
      else localStorage.setItem(FOLLOWING_STORAGE_KEY, value);
    } catch (_error) {
      // Keep runtime following list even if persistence fails.
    }
  }

  function saveVideoKeywordListText(textValue) {
    try {
      const value =
        textValue == null ? getBlockedVideoKeywordList().join("\n") : textValue;
      if (typeof GM_setValue === "function")
        GM_setValue(VIDEO_KEYWORD_BLOCKLIST_STORAGE_KEY, value);
      else localStorage.setItem(VIDEO_KEYWORD_BLOCKLIST_STORAGE_KEY, value);
    } catch (_error) {
      // Keep runtime video keywords even if persistence fails.
    }
  }

  function saveCommentKeywordListText(textValue) {
    try {
      const value =
        textValue == null
          ? getBlockedCommentKeywordList().join("\n")
          : textValue;
      if (typeof GM_setValue === "function")
        GM_setValue(COMMENT_KEYWORD_BLOCKLIST_STORAGE_KEY, value);
      else localStorage.setItem(COMMENT_KEYWORD_BLOCKLIST_STORAGE_KEY, value);
    } catch (_error) {
      // Keep runtime comment keywords even if persistence fails.
    }
  }

  function saveDanmakuKeywordListText(textValue) {
    try {
      const value =
        textValue == null
          ? getBlockedDanmakuKeywordList().join("\n")
          : textValue;
      if (typeof GM_setValue === "function")
        GM_setValue(DANMAKU_KEYWORD_BLOCKLIST_STORAGE_KEY, value);
      else localStorage.setItem(DANMAKU_KEYWORD_BLOCKLIST_STORAGE_KEY, value);
    } catch (_error) {
      // Keep runtime danmaku keywords even if persistence fails.
    }
  }

  function setBooleanSetting(name, value) {
    settings[name] = Boolean(value);
    saveBooleanSetting(SETTING_KEYS[name], settings[name]);
    refreshConsequences();
    renderUserPageBlockButton();
  }

  function setBadgedVideoTypes(selectedOptions) {
    const selected = new Set(
      [...selectedOptions].map((option) => option.value).filter(Boolean),
    );
    for (const control of BOOLEAN_CONTROLS.filter(
      (child) => child.childOf === "hideBadgedVideos",
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
    renderUserPageBlockButton();
  }

  function getBlockedUidList() {
    return [...BLOCKED_UIDS];
  }

  function getFollowingUidList() {
    return [...FOLLOWING_UIDS];
  }

  function getBlockedUserListTextValue() {
    return readSavedBlockedUserListText() || getBlockedUidList().join("\n");
  }

  function getFollowingUserListTextValue() {
    return readSavedFollowingUserListText() || getFollowingUidList().join("\n");
  }

  function getBlockedVideoKeywordList() {
    return [...BLOCKED_VIDEO_KEYWORDS];
  }

  function getVideoKeywordListTextValue() {
    return (
      readSavedVideoKeywordListText() || getBlockedVideoKeywordList().join("\n")
    );
  }

  function getBlockedCommentKeywordList() {
    return [...BLOCKED_COMMENT_KEYWORDS];
  }

  function getCommentKeywordListTextValue() {
    return (
      readSavedCommentKeywordListText() ||
      getBlockedCommentKeywordList().join("\n")
    );
  }

  function getBlockedDanmakuKeywordList() {
    return [...BLOCKED_DANMAKU_KEYWORDS];
  }

  function getDanmakuKeywordListTextValue() {
    return (
      readSavedDanmakuKeywordListText() ||
      getBlockedDanmakuKeywordList().join("\n")
    );
  }

  function parseBlockedUserListText(text) {
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

  function parseFollowingUserListText(text) {
    return parseBlockedUserListText(text);
  }

  function parseKeywordListText(text) {
    return dedupeKeywords(
      String(text || "")
        .split(/\r?\n/)
        .map(stripLineComment),
    );
  }

  function updateFollowingText(text, uid, following, username = "") {
    const normalizedUid = normalizeUid(uid);
    if (!normalizedUid) return text || "";
    const lines = String(text || "").split(/\r?\n/);
    const nextLines = lines.filter(
      (line) => normalizeUid(stripLineComment(line)) !== normalizedUid,
    );
    if (following) {
      const name = String(username || "").trim();
      nextLines.push(name ? `${normalizedUid} # ${name}` : normalizedUid);
    }
    return nextLines.filter((line) => String(line || "").trim()).join("\n");
  }

  function parseVideoKeywordListText(text) {
    return parseKeywordListText(text);
  }

  function parseCommentKeywordListText(text) {
    return parseKeywordListText(text);
  }

  function parseDanmakuKeywordListText(text) {
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
      if (seen.has(keyword)) continue;
      seen.add(keyword);
      values.push(keyword);
    }
    return values;
  }

  function setUidBlocked(uid, blocked) {
    replaceRuntimeBlockedUids(
      parseBlockedUserListText(readSavedBlockedUserListText()),
    );
    if (blocked) BLOCKED_UIDS.add(uid);
    else {
      BLOCKED_UIDS.delete(uid);
      unhideCardsForUid(uid);
    }
    saveBlockedUserListText();
    refreshConsequences();
    refreshBfilterManagerPanel();
  }

  function setUidFollowing(uid, following, username = "") {
    const followingText = updateFollowingText(
      readSavedFollowingUserListText(),
      uid,
      following,
      settings.addUsernamesToFollowing ? username : "",
    );
    replaceRuntimeFollowingUids(parseFollowingUserListText(followingText));
    if (following) FOLLOWING_UIDS.add(uid);
    else FOLLOWING_UIDS.delete(uid);
    saveFollowingUserListText(followingText);
    refreshConsequences();
    refreshBfilterManagerPanel();
  }

  function blockAllCommenters() {
    replaceRuntimeBlockedUids(
      parseBlockedUserListText(readSavedBlockedUserListText()),
    );
    for (const item of document.querySelectorAll(COMMENT_ITEM_SELECTOR)) {
      for (const uid of getCommentAuthorUidsInside(item)) BLOCKED_UIDS.add(uid);
    }
    saveBlockedUserListText();
    refreshConsequences();
    refreshBfilterManagerPanel();
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
    panel.innerHTML = `
      <div class="bfilter-manager-header">
        <div class="bfilter-manager-title">Bfilter Manager <span class="bfilter-manager-version">${SCRIPT_VERSION}</span></div>
        <button class="bfilter-manager-close" type="button" title="Close">×</button>
      </div>
      <section class="bfilter-manager-section">
        <div class="bfilter-manager-tabs" role="tablist">
          <button class="bfilter-manager-tab" type="button" role="tab" aria-selected="true" data-tab="users">Users</button>
          <button class="bfilter-manager-tab" type="button" role="tab" aria-selected="false" data-tab="video-keywords">Videos</button>
          <button class="bfilter-manager-tab" type="button" role="tab" aria-selected="false" data-tab="comment-keywords">Comments</button>
          <button class="bfilter-manager-tab" type="button" role="tab" aria-selected="false" data-tab="danmaku-keywords">Danmakus</button>
          <button class="bfilter-manager-tab" type="button" role="tab" aria-selected="false" data-tab="following">Following</button>
        </div>
        <div class="bfilter-manager-tab-panel" role="tabpanel" data-tab-panel="users">
          ${BOOLEAN_CONTROLS.filter(
            (control) => control.name === "blockNewUsers",
          )
            .map(renderManagerOption)
            .join("")}
          ${renderManagerTextarea(MANAGER_TEXTAREA_ID)}
          <div class="bfilter-manager-help" data-help="users"></div>
        </div>
        <div class="bfilter-manager-tab-panel" role="tabpanel" data-tab-panel="video-keywords" hidden>
          ${BOOLEAN_CONTROLS.filter((control) =>
            [
              "hideShortVideos",
              "hideUnpopularVideos",
              "hideBadgedVideos",
            ].includes(control.name),
          )
            .map(renderManagerOption)
            .join("")}
          ${renderManagerTextarea(MANAGER_VIDEO_KEYWORDS_TEXTAREA_ID)}
          <div class="bfilter-manager-help" data-help="video-keywords"></div>
        </div>
        <div class="bfilter-manager-tab-panel" role="tabpanel" data-tab-panel="comment-keywords" hidden>
          ${renderManagerTextarea(MANAGER_COMMENT_KEYWORDS_TEXTAREA_ID)}
          <div class="bfilter-manager-help" data-help="comment-keywords"></div>
        </div>
        <div class="bfilter-manager-tab-panel" role="tabpanel" data-tab-panel="danmaku-keywords" hidden>
          ${renderManagerTextarea(MANAGER_DANMAKU_KEYWORDS_TEXTAREA_ID)}
          <div class="bfilter-manager-help" data-help="danmaku-keywords"></div>
        </div>
        <div class="bfilter-manager-tab-panel" role="tabpanel" data-tab-panel="following" hidden>
          ${BOOLEAN_CONTROLS.filter((control) => control.followingOption)
            .map(renderManagerOption)
            .join("")}
          ${renderManagerTextarea(MANAGER_FOLLOWING_TEXTAREA_ID)}
          <div class="bfilter-manager-help" data-help="following"></div>
        </div>
        <div class="bfilter-manager-actions">
          <label class="bfilter-manager-preview-toggle" for="${getControl("previewMode").id}">
            <input id="${getControl("previewMode").id}" type="checkbox" data-setting="previewMode">
            <span class="bfilter-manager-preview-slider" aria-hidden="true"></span>
            <span>Preview</span>
          </label>
          <button class="bfilter-manager-action bfilter-manager-action-primary" type="button" data-action="save" disabled>Save</button>
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
      if (target.getAttribute("data-action") === "save") {
        saveManagerTextareas(panel);
      }
    });

    panel.addEventListener("input", (event) => {
      const target = event.target;
      if (
        target &&
        (target.id === MANAGER_TEXTAREA_ID ||
          target.id === MANAGER_FOLLOWING_TEXTAREA_ID ||
          target.id === MANAGER_VIDEO_KEYWORDS_TEXTAREA_ID ||
          target.id === MANAGER_COMMENT_KEYWORDS_TEXTAREA_ID ||
          target.id === MANAGER_DANMAKU_KEYWORDS_TEXTAREA_ID)
      ) {
        updateManagerCommentHighlight(target);
        updateManagerSaveButtonState(panel);
      }
    });

    panel.addEventListener(
      "scroll",
      (event) => {
        const target = event.target;
        if (target && target.matches(".bfilter-manager-textarea"))
          syncManagerCommentHighlightScroll(target);
      },
      true,
    );

    panel.addEventListener("change", (event) => {
      const target = event.target;
      const thresholdControl = getThresholdControlBySlider(target);
      if (thresholdControl) {
        setThresholdIndex(thresholdControl, target.value);
        refreshThresholdControls(panel);
        return;
      }
      if (target && target.matches("[data-badged-video-types]")) {
        setBadgedVideoTypes(target.selectedOptions);
        refreshBooleanControls(panel);
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

  function renderManagerTextarea(id) {
    return `<div class="bfilter-manager-textarea-wrap"><pre class="bfilter-manager-textarea-highlight" aria-hidden="true"></pre><textarea id="${id}" class="bfilter-manager-textarea" spellcheck="false"></textarea></div>`;
  }

  function renderManagerOption(control) {
    const checkbox = `<label class="bfilter-manager-option" for="${control.id}"><input id="${control.id}" type="checkbox" data-setting="${control.name}"><span>${escapeHtml(control.label)}</span></label>`;
    const children = BOOLEAN_CONTROLS.filter(
      (child) => child.childOf === control.name,
    );
    if (children.length) {
      return `<div class="bfilter-manager-badged-video-control">${checkbox}${renderBadgedVideoTypeSelect(children)}</div>`;
    }
    return control.threshold
      ? `<div class="bfilter-manager-registration-time-control">${checkbox}${renderThresholdSelect(control)}</div>`
      : checkbox;
  }

  function renderThresholdSelect(control) {
    return `<select id="${control.threshold.id}" class="bfilter-manager-registration-threshold">${control.threshold.options
      .map(
        (option, index) =>
          `<option value="${index}">${escapeHtml(option.label)}</option>`,
      )
      .join("")}</select>`;
  }

  function renderBadgedVideoTypeSelect(controls) {
    return `<select class="bfilter-manager-badged-types" data-badged-video-types multiple size="1">${controls
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
    const uids = getBlockedUidList();
    const blockedUserText = getBlockedUserListTextValue();
    const followingUids = getFollowingUidList();
    const followingText = getFollowingUserListTextValue();
    const videoKeywords = getBlockedVideoKeywordList();
    const videoKeywordText = getVideoKeywordListTextValue();
    const commentKeywords = getBlockedCommentKeywordList();
    const commentKeywordText = getCommentKeywordListTextValue();
    const danmakuKeywords = getBlockedDanmakuKeywordList();
    const danmakuKeywordText = getDanmakuKeywordListTextValue();
    const textarea = panel.querySelector(`#${MANAGER_TEXTAREA_ID}`);
    const followingTextarea = panel.querySelector(
      `#${MANAGER_FOLLOWING_TEXTAREA_ID}`,
    );
    const videoKeywordsTextarea = panel.querySelector(
      `#${MANAGER_VIDEO_KEYWORDS_TEXTAREA_ID}`,
    );
    const commentKeywordsTextarea = panel.querySelector(
      `#${MANAGER_COMMENT_KEYWORDS_TEXTAREA_ID}`,
    );
    const help = panel.querySelector('[data-help="users"]');
    const followingHelp = panel.querySelector('[data-help="following"]');
    const videoKeywordsHelp = panel.querySelector(
      '[data-help="video-keywords"]',
    );
    const commentKeywordsHelp = panel.querySelector(
      '[data-help="comment-keywords"]',
    );
    const danmakuKeywordsTextarea = panel.querySelector(
      `#${MANAGER_DANMAKU_KEYWORDS_TEXTAREA_ID}`,
    );
    const danmakuKeywordsHelp = panel.querySelector(
      '[data-help="danmaku-keywords"]',
    );
    if (textarea) {
      textarea.value = getManagerTextValue(
        textValues,
        "users",
        blockedUserText,
      );
      textarea.dataset.cleanValue = textarea.value;
      updateManagerCommentHighlight(textarea);
    }
    if (followingTextarea) {
      followingTextarea.value = getManagerTextValue(
        textValues,
        "following",
        followingText,
      );
      followingTextarea.dataset.cleanValue = followingTextarea.value;
      updateManagerCommentHighlight(followingTextarea);
    }
    if (videoKeywordsTextarea) {
      videoKeywordsTextarea.value = getManagerTextValue(
        textValues,
        "videoKeywords",
        videoKeywordText,
      );
      videoKeywordsTextarea.dataset.cleanValue = videoKeywordsTextarea.value;
      updateManagerCommentHighlight(videoKeywordsTextarea);
    }
    if (commentKeywordsTextarea) {
      commentKeywordsTextarea.value = getManagerTextValue(
        textValues,
        "commentKeywords",
        commentKeywordText,
      );
      commentKeywordsTextarea.dataset.cleanValue =
        commentKeywordsTextarea.value;
      updateManagerCommentHighlight(commentKeywordsTextarea);
    }
    if (danmakuKeywordsTextarea) {
      danmakuKeywordsTextarea.value = getManagerTextValue(
        textValues,
        "danmakuKeywords",
        danmakuKeywordText,
      );
      danmakuKeywordsTextarea.dataset.cleanValue =
        danmakuKeywordsTextarea.value;
      updateManagerCommentHighlight(danmakuKeywordsTextarea);
    }
    if (help)
      help.innerHTML = `<strong>${uids.length}</strong> user(s) have been blocked.\nEnter one UID per line to block users.`;
    if (followingHelp)
      followingHelp.innerHTML = `<strong>${followingUids.length}</strong> user(s) are followed.\nEnter one UID per line to highlight users.`;
    if (videoKeywordsHelp)
      videoKeywordsHelp.innerHTML = `<strong>${videoKeywords.length}</strong> keyword(s) have been blocked.\nEnter one keyword per line to block videos containing it in their titles.`;
    if (commentKeywordsHelp)
      commentKeywordsHelp.innerHTML = `<strong>${commentKeywords.length}</strong> keyword(s) have been blocked.\nEnter one keyword per line to block comments containing it.`;
    if (danmakuKeywordsHelp)
      danmakuKeywordsHelp.innerHTML = `<strong>${danmakuKeywords.length}</strong> keyword(s) have been blocked.\nEnter one keyword per line to block danmakus containing it.`;
    refreshBooleanControls(panel);
    updateManagerSaveButtonState(panel);
  }

  function getManagerTextValue(textValues, name, fallback) {
    return Object.prototype.hasOwnProperty.call(textValues, name)
      ? textValues[name]
      : fallback;
  }

  function updateManagerCommentHighlight(textarea) {
    const highlight = getManagerCommentHighlight(textarea);
    if (!highlight) return;
    highlight.innerHTML = renderManagerCommentHighlight(textarea.value);
    syncManagerCommentHighlightScroll(textarea);
  }

  function syncManagerCommentHighlightScroll(textarea) {
    const highlight = getManagerCommentHighlight(textarea);
    if (!highlight) return;
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
  }

  function getManagerCommentHighlight(textarea) {
    return textarea.parentElement
      ? textarea.parentElement.querySelector(
          ".bfilter-manager-textarea-highlight",
        )
      : null;
  }

  function renderManagerCommentHighlight(text) {
    return String(text || "")
      .split(/(\r?\n)/)
      .map((part) =>
        /\r?\n/.test(part) ? part : renderManagerCommentHighlightLine(part),
      )
      .join("");
  }

  function renderManagerCommentHighlightLine(line) {
    const commentIndex = line.indexOf("#");
    if (commentIndex < 0) return escapeHtml(line);
    return `${escapeHtml(line.slice(0, commentIndex))}<span class="bfilter-manager-comment">${escapeHtml(line.slice(commentIndex))}</span>`;
  }

  function setActiveManagerTab(panel, tabName) {
    const nextTab = [
      "users",
      "video-keywords",
      "comment-keywords",
      "danmaku-keywords",
      "following",
    ].includes(tabName)
      ? tabName
      : "users";
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
    getActiveManagerTextarea(panel)?.focus();
  }

  function getActiveManagerTextarea(panel) {
    const activePanel = panel.querySelector("[data-tab-panel]:not([hidden])");
    return activePanel ? activePanel.querySelector("textarea") : null;
  }

  function saveManagerTextareas(panel) {
    const textarea = panel.querySelector(`#${MANAGER_TEXTAREA_ID}`);
    const followingTextarea = panel.querySelector(
      `#${MANAGER_FOLLOWING_TEXTAREA_ID}`,
    );
    const videoKeywordsTextarea = panel.querySelector(
      `#${MANAGER_VIDEO_KEYWORDS_TEXTAREA_ID}`,
    );
    const commentKeywordsTextarea = panel.querySelector(
      `#${MANAGER_COMMENT_KEYWORDS_TEXTAREA_ID}`,
    );
    const danmakuKeywordsTextarea = panel.querySelector(
      `#${MANAGER_DANMAKU_KEYWORDS_TEXTAREA_ID}`,
    );
    const textValues = {
      users: textarea ? textarea.value : "",
      following: followingTextarea ? followingTextarea.value : "",
      videoKeywords: videoKeywordsTextarea ? videoKeywordsTextarea.value : "",
      commentKeywords: commentKeywordsTextarea
        ? commentKeywordsTextarea.value
        : "",
      danmakuKeywords: danmakuKeywordsTextarea
        ? danmakuKeywordsTextarea.value
        : "",
    };
    if (textarea)
      replaceRuntimeBlockedUids(parseBlockedUserListText(textarea.value));
    if (followingTextarea)
      replaceRuntimeFollowingUids(
        parseFollowingUserListText(followingTextarea.value),
      );
    if (videoKeywordsTextarea)
      replaceRuntimeBlockedVideoKeywords(
        parseVideoKeywordListText(videoKeywordsTextarea.value),
      );
    if (commentKeywordsTextarea)
      replaceRuntimeBlockedCommentKeywords(
        parseCommentKeywordListText(commentKeywordsTextarea.value),
      );
    if (danmakuKeywordsTextarea)
      replaceRuntimeBlockedDanmakuKeywords(
        parseDanmakuKeywordListText(danmakuKeywordsTextarea.value),
      );
    saveBlockedUserListText(textarea ? textarea.value : undefined);
    saveFollowingUserListText(
      followingTextarea ? followingTextarea.value : undefined,
    );
    saveVideoKeywordListText(
      videoKeywordsTextarea ? videoKeywordsTextarea.value : undefined,
    );
    saveCommentKeywordListText(
      commentKeywordsTextarea ? commentKeywordsTextarea.value : undefined,
    );
    saveDanmakuKeywordListText(
      danmakuKeywordsTextarea ? danmakuKeywordsTextarea.value : undefined,
    );
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
    const badgedTypes = panel.querySelector("[data-badged-video-types]");
    if (badgedTypes) {
      badgedTypes.disabled = !settings.hideBadgedVideos;
      for (const option of badgedTypes.options) {
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
        "bfilter-manager-registration-threshold-disabled",
        !settings[control.name],
      );
    }
  }

  function updateManagerSaveButtonState(panel) {
    const textarea = panel.querySelector(`#${MANAGER_TEXTAREA_ID}`);
    const followingTextarea = panel.querySelector(
      `#${MANAGER_FOLLOWING_TEXTAREA_ID}`,
    );
    const videoKeywordsTextarea = panel.querySelector(
      `#${MANAGER_VIDEO_KEYWORDS_TEXTAREA_ID}`,
    );
    const commentKeywordsTextarea = panel.querySelector(
      `#${MANAGER_COMMENT_KEYWORDS_TEXTAREA_ID}`,
    );
    const danmakuKeywordsTextarea = panel.querySelector(
      `#${MANAGER_DANMAKU_KEYWORDS_TEXTAREA_ID}`,
    );
    const saveButton = panel.querySelector('[data-action="save"]');
    if (saveButton)
      saveButton.disabled = ![
        textarea,
        followingTextarea,
        videoKeywordsTextarea,
        commentKeywordsTextarea,
        danmakuKeywordsTextarea,
      ].some(
        (input) => input && input.value !== (input.dataset.cleanValue || ""),
      );
  }

  function renderUserPageBlockButton() {
    const uid = getCurrentUserPageUid();
    let button = document.getElementById(USER_BUTTON_ID);
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
        setUidFollowing(
          currentUid,
          !FOLLOWING_UIDS.has(currentUid),
          getCurrentUserPageUsername(),
        );
        updateUserPageFollowButton(followButton, currentUid);
        if (button) updateUserPageBlockButton(button, currentUid);
      });
    }

    if (!button) {
      button = document.createElement("button");
      button.id = USER_BUTTON_ID;
      button.className = PROFILE_BUTTON_CLASS;
      button.type = "button";
      button.addEventListener("click", () => {
        const currentUid = button.getAttribute("data-uid");
        if (!currentUid) return;
        setUidBlocked(currentUid, !BLOCKED_UIDS.has(currentUid));
        updateUserPageBlockButton(button, currentUid);
      });
    }
    updateUserPageFollowButton(followButton, uid);
    updateUserPageBlockButton(button, uid);
    appendUserPageBlockButton(followButton, button);
  }

  function appendUserPageBlockButton(followButton, button) {
    const statistics = document.querySelector(".nav-statistics");
    if (statistics) {
      statistics.insertAdjacentElement("beforebegin", followButton);
      followButton.insertAdjacentElement("afterend", button);
    } else {
      appendToPage(followButton);
      followButton.insertAdjacentElement("afterend", button);
    }
  }

  function updateUserPageFollowButton(button, uid) {
    const following = FOLLOWING_UIDS.has(uid);
    button.setAttribute("data-uid", uid);
    button.setAttribute("data-following", String(following));
    button.textContent = following ? "FOLLOWING" : "FOLLOW";
    button.title = `${following ? "Unfollow" : "Follow"} Bilibili user UID ${uid}`;
  }

  function updateUserPageBlockButton(button, uid) {
    const blocked = BLOCKED_UIDS.has(uid);
    const following = FOLLOWING_UIDS.has(uid);
    const blockedByNewUserFilter =
      !blocked && settings.blockNewUsers && isNewUserUid(uid);
    button.setAttribute("data-uid", uid);
    button.setAttribute("data-blocked", String(blocked));
    button.disabled = following;
    button.textContent = blocked ? "BLOCKED" : "BLOCK";
    if (blockedByNewUserFilter) {
      const hint = document.createElement("span");
      hint.textContent = "Already blocked as New Users";
      button.appendChild(hint);
    }
    button.title = following
      ? `Followed Bilibili user UID ${uid} cannot be blocked here`
      : `${blocked ? "Unblock" : "Block"} Bilibili user UID ${uid}`;
  }

  function renderCommentBlockButtons() {
    if (!isOpusPage() && !isDirectVideoPage() && !isTPage()) return;
    for (const item of document.querySelectorAll(COMMENT_ITEM_SELECTOR)) {
      if (item.hasAttribute(BLOCK_ATTR)) continue;
      const userLink = item.querySelector(COMMENT_USER_LINK_SELECTOR);
      if (!userLink) continue;
      const href = userLink.getAttribute("href");
      const match = href && href.match(/space\.bilibili\.com\/(\d+)/i);
      if (!match) continue;
      const uid = match[1];
      let btn = item.querySelector(`.${COMMENT_BLOCK_BTN_CLASS}`);
      if (!btn) {
        btn = document.createElement("button");
        btn.className = COMMENT_BLOCK_BTN_CLASS;
        btn.type = "button";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          const currentUid = btn.dataset.uid;
          if (currentUid)
            setUidBlocked(currentUid, !BLOCKED_UIDS.has(currentUid));
        });
        userLink.insertAdjacentElement("afterend", btn);
      }
      const blocked = BLOCKED_UIDS.has(uid);
      btn.textContent = blocked ? "Unblock" : "Block";
      btn.dataset.blocked = String(blocked);
      btn.dataset.uid = uid;
    }
  }

  function renderBlockAllCommentersButton() {
    if (!isOpusPage() && !isDirectVideoPage() && !isTPage()) {
      for (const btn of document.querySelectorAll(
        `.${BLOCK_ALL_COMMENTERS_BTN_CLASS}`,
      ))
        btn.remove();
      return;
    }
    if (!document.querySelector(COMMENT_ITEM_SELECTOR)) return;

    const navBar = document.querySelector(".reply-header .nav-bar");
    if (!navBar) return;

    if (document.querySelector(`.${BLOCK_ALL_COMMENTERS_BTN_CLASS}`)) return;

    const btn = document.createElement("button");
    btn.className = BLOCK_ALL_COMMENTERS_BTN_CLASS;
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

  function getControl(name) {
    return BOOLEAN_CONTROLS.find((control) => control.name === name);
  }

  function getThresholdControls() {
    return BOOLEAN_CONTROLS.filter((control) => control.threshold);
  }

  function getThresholdControlBySlider(element) {
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

  function escapeHtml(text) {
    return String(text).replace(
      /[&<>"]/g,
      (char) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char],
    );
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

  function isCardBlockingPage() {
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

  function patchHistory(methodName) {
    const original = history[methodName];
    history[methodName] = function patchedHistoryMethod(...args) {
      const result = original.apply(this, args);
      setTimeout(refreshChromeAndScan, 0);
      return result;
    };
  }

  function addStyle() {
    const style = document.createElement("style");
    style.id = "bfilter-style";
    style.textContent = `
      :root {
        --bfilter-button-color: #e53935;
        --bfilter-button-hover-color: #f04f4b;
        --bfilter-follow-color: #18a058;
        --bfilter-follow-background-color: #d2f0dc;
        --bfilter-follow-outline-color: rgba(24, 160, 88, 0.65);
        --bfilter-button-muted-color: #e3e5e7;
        --bfilter-preview-background-color: #ffe8e8;
        --bfilter-preview-outline-color: rgba(229, 57, 53, 0.55);
      }
      [${BLOCK_ATTR}="true"] { display: none !important; }
      .video-list.row > [class*="col_"][class*="mb_"]:has([${BLOCK_ATTR}="true"]) { display: none !important; }
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
      [${FOLLOW_ATTR}="true"], [${FOLLOW_ATTR}="true"] .bili-video-card__wrap {
        background-color: var(--bfilter-follow-background-color) !important;
      }
      [${FOLLOW_ATTR}="true"] {
        outline: 2px solid var(--bfilter-follow-outline-color) !important;
        outline-offset: -2px;
      }
      [${FOLLOW_ATTR}="true"] .bili-video-card__wrap[${FOLLOW_ATTR}="true"] {
        outline: none !important;
      }
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
      .${PROFILE_BUTTON_CLASS}[data-following] { color: var(--bfilter-follow-color); border-color: var(--bfilter-follow-color); }
      .${PROFILE_BUTTON_CLASS}[data-following]:hover, .${PROFILE_BUTTON_CLASS}[data-following="true"] { color: #fff; background: var(--bfilter-follow-color); }
      .${PROFILE_BUTTON_CLASS}:disabled, .${PROFILE_BUTTON_CLASS}:disabled:hover {
        color: #9499a0; background: #f1f2f3; border-color: #c9ccd0; cursor: not-allowed;
        text-decoration: line-through;
      }
      #${MANAGER_PANEL_ID} {
        position: fixed; top: 62px; right: 24px; z-index: 999999;
        box-sizing: border-box;
        width: 420px; max-width: calc(100vw - 48px); overflow: auto; border: 1px solid rgba(0,0,0,.08);
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
      #${MANAGER_PANEL_ID} .bfilter-manager-option:has(input:disabled) { color: #9499a0; cursor: not-allowed; }
      #${MANAGER_PANEL_ID} .bfilter-manager-badged-video-control { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
      #${MANAGER_PANEL_ID} .bfilter-manager-badged-video-control .bfilter-manager-option { margin-bottom: 0; }
      #${MANAGER_PANEL_ID} .bfilter-manager-badged-types,
      #${MANAGER_PANEL_ID} .bfilter-manager-registration-threshold { box-sizing: border-box; width: 105px; height: 20px; border: 1px solid #c9ccd0; border-radius: 6px; padding: 0 4px; background: #fff; color: #18191c; font-size: 13px; appearance: auto; -webkit-appearance: auto; }
      #${MANAGER_PANEL_ID} .bfilter-manager-badged-types:disabled { opacity: .42; }
      #${MANAGER_PANEL_ID} .bfilter-manager-registration-time-control { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
      #${MANAGER_PANEL_ID} .bfilter-manager-registration-time-control .bfilter-manager-option { margin-bottom: 0; }
      #${MANAGER_PANEL_ID} .bfilter-manager-registration-threshold { transition: opacity .2s ease; }
      #${MANAGER_PANEL_ID} .bfilter-manager-registration-threshold-disabled { opacity: .42; }
      #${MANAGER_PANEL_ID} .bfilter-manager-tabs { display: flex; flex-direction: column; align-items: stretch; gap: 2px; border-right: 1px solid #e3e5e7; }
      #${MANAGER_PANEL_ID} .bfilter-manager-tab { position: relative; border: 1px solid transparent; border-right: 0; border-radius: 8px 0 0 8px; padding: 5px 9px; color: #61666d; background: transparent; font-size: 14px; text-align: left; cursor: pointer; }
      #${MANAGER_PANEL_ID} .bfilter-manager-tab[aria-selected="true"] { border-color: #e3e5e7; color: var(--bfilter-button-color); background: #fff; cursor: default; }
      #${MANAGER_PANEL_ID} .bfilter-manager-tab[data-tab="following"][aria-selected="true"] { color: var(--bfilter-follow-color); }
      #${MANAGER_PANEL_ID} .bfilter-manager-tab[aria-selected="true"]::after { content: ""; position: absolute; top: 0; right: -1px; bottom: 0; width: 1px; background: #fff; }
      #${MANAGER_PANEL_ID} .bfilter-manager-tab-panel { grid-column: 2; grid-row: 1; }
      #${MANAGER_PANEL_ID} .bfilter-manager-tab-panel[hidden] { display: none !important; }
      #${MANAGER_PANEL_ID} .bfilter-manager-textarea-wrap { position: relative; }
      #${MANAGER_PANEL_ID} .bfilter-manager-textarea-highlight,
      #${MANAGER_PANEL_ID} .bfilter-manager-textarea { box-sizing: border-box; width: 100%; min-height: 160px; border: 1px solid #c9ccd0; border-radius: 10px; padding: 10px; font-size: 14px; line-height: 1.5; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important; white-space: pre-wrap; overflow-wrap: anywhere; }
      #${MANAGER_PANEL_ID} .bfilter-manager-textarea-highlight { position: absolute; inset: 0; margin: 0; overflow: hidden; color: #18191c; background: #f6f7f8; pointer-events: none; }
      #${MANAGER_PANEL_ID} .bfilter-manager-textarea { position: relative; display: block; color: transparent; -webkit-text-fill-color: transparent; background: transparent; caret-color: #18191c; resize: vertical; }
      #${MANAGER_PANEL_ID} .bfilter-manager-comment { color: #9499a0; }
      #${MANAGER_PANEL_ID} .bfilter-manager-help { margin: 8px 0 12px; color: #9499a0; font-size: 12px; white-space: pre-line; }
      #${MANAGER_PANEL_ID} .bfilter-manager-actions { display: flex; grid-column: 1 / -1; align-items: center; justify-content: space-between; gap: 8px; }
      #${MANAGER_PANEL_ID} .bfilter-manager-preview-toggle { display: inline-flex; align-items: center; gap: 8px; color: #61666d; font-size: 13px; font-weight: 700; cursor: pointer; user-select: none; }
      #${MANAGER_PANEL_ID} .bfilter-manager-preview-toggle input { position: absolute; opacity: 0; pointer-events: none; }
      #${MANAGER_PANEL_ID} .bfilter-manager-preview-slider { position: relative; width: 36px; height: 20px; border-radius: 999px; background: #c9ccd0; transition: background .2s ease; }
      #${MANAGER_PANEL_ID} .bfilter-manager-preview-slider::before { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .2s ease; }
      #${MANAGER_PANEL_ID} .bfilter-manager-preview-toggle input:checked + .bfilter-manager-preview-slider { background: var(--bfilter-button-color); }
      #${MANAGER_PANEL_ID} .bfilter-manager-preview-toggle input:checked + .bfilter-manager-preview-slider::before { transform: translateX(16px); }
      #${MANAGER_PANEL_ID} .bfilter-manager-action { border: 0; border-radius: 8px; padding: 7px 12px; color: #18191c; background: var(--bfilter-button-muted-color); font-size: 13px; cursor: pointer; }
      #${MANAGER_PANEL_ID} .bfilter-manager-action:disabled { color: #9499a0; background: var(--bfilter-button-muted-color); cursor: not-allowed; }
      #${MANAGER_PANEL_ID} .bfilter-manager-close { border: 0; border-radius: 50%; width: 28px; height: 28px; color: #61666d; background: #f1f2f3; font-size: 18px; line-height: 28px; cursor: pointer; }
      .${COMMENT_BLOCK_BTN_CLASS} {
        display: inline-flex; align-items: center; justify-content: center;
        margin-left: 6px; padding: 0 6px; height: 18px;
        border: 1px solid var(--bfilter-button-color); border-radius: 4px;
        color: var(--bfilter-button-color); background: #fff;
        font-size: 11px; line-height: 1; cursor: pointer;
        vertical-align: middle; font-family: inherit;
        transition: background .15s, color .15s;
      }
      .${COMMENT_BLOCK_BTN_CLASS}:hover {
        color: #fff; background: var(--bfilter-button-color);
      }
      .${COMMENT_BLOCK_BTN_CLASS}[data-blocked="true"] {
        color: #fff; background: var(--bfilter-button-color);
      }
      .${COMMENT_BLOCK_BTN_CLASS}[data-blocked="true"]:hover { background: var(--bfilter-button-hover-color); }
      .${BLOCK_ALL_COMMENTERS_BTN_CLASS} {
        margin-left: 12px; padding: 4px 10px; border: 1px solid var(--bfilter-button-color);
        border-radius: 6px; color: var(--bfilter-button-color); background: #fff;
        font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit;
      }
      .${BLOCK_ALL_COMMENTERS_BTN_CLASS}:hover { color: #fff; background: var(--bfilter-button-color); }
    `;

    const append = () => {
      const parent = document.head || document.documentElement;
      if (parent && !document.getElementById(style.id))
        parent.appendChild(style);
    };
    append();
    if (!style.isConnected)
      document.addEventListener("DOMContentLoaded", append, { once: true });
  }
})();

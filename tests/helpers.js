const path = require("path");
const { readFileSync } = require("fs");

const SCRIPT_PATH = path.resolve(__dirname, "..", "main.user.js");
const SCRIPT = readFileSync(SCRIPT_PATH, "utf8");

const keys = {
  blocked: "bfilter:blocked-user-uids",
  followed: "bfilter:followed-user-uids",
  videos: "bfilter:hide-videos-by-keyword",
  comments: "bfilter:hide-comments-by-keyword",
  danmakus: "bfilter:hide-danmakus-by-keyword",
  unified: "bfilter:unified-keywords",
  preview: "bfilter:preview-mode",
  unifiedMode: "bfilter:unified-keywords-mode",
};

function bool(value) {
  return String(Boolean(value));
}

async function loadBfilter(page, options = {}) {
  const {
    url = "https://www.bilibili.com/",
    html = '<main id="fixture"></main>',
    storage = {},
    gm = false,
  } = options;

  await page.route("**/*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><head></head><body></body></html>",
    }),
  );
  await page.goto(url);
  await page.evaluate((entries) => {
    for (const [key, value] of Object.entries(entries))
      localStorage.setItem(key, String(value));
  }, storage);
  await page.evaluate((markup) => {
    document.body.innerHTML = markup;
  }, html);
  if (gm) {
    await page.evaluate(() => {
      const values = Object.fromEntries(
        Object.entries(localStorage).map(([key, value]) => [key, value]),
      );
      const listeners = new Map();
      window.GM_info = { script: { version: "test" } };
      window.GM_getValue = (key, fallback) =>
        Object.prototype.hasOwnProperty.call(values, key)
          ? values[key]
          : fallback;
      window.GM_setValue = (key, value) => {
        values[key] = value;
        localStorage.setItem(key, String(value));
        for (const callback of listeners.get(key) || [])
          callback(key, undefined, value, true);
      };
      window.GM_addValueChangeListener = (key, callback) => {
        const callbacks = listeners.get(key) || [];
        callbacks.push(callback);
        listeners.set(key, callbacks);
        return callbacks.length;
      };
      window.__gmListeners = listeners;
      window.__gmSetRemote = (key, value, remote = true) => {
        for (const callback of listeners.get(key) || [])
          callback(key, undefined, value, remote);
      };
    });
  }
  await page.addScriptTag({ content: SCRIPT });
  await settle(page);
  return page;
}

async function settle(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}

function card({
  id,
  uid = "999",
  title = "ordinary",
  href = `/video/${id}`,
  extra = "",
}) {
  return `<article class="bili-video-card" id="${id}">
    <a class="uploader" href="https://space.bilibili.com/${uid}">${uid}</a>
    <a class="video-link" href="${href}"><span class="bili-video-card__info--tit">${title}</span></a>
    ${extra}
  </article>`;
}

function comment({ id, uid = "999", text = "ordinary", extra = "" }) {
  return `<article class="reply-item" id="${id}">
    <div class="user-info"><a class="user-name" href="https://space.bilibili.com/${uid}">${uid}</a></div>
    <div class="reply-content">${text}</div>${extra}
  </article>`;
}

function danmaku({ id, text }) {
  return `<div class="bpx-player-row-dm-wrap"><div class="bili-danmaku-x-dm" id="${id}"><span class="dm-info-dm">${text}</span></div></div>`;
}

async function append(page, markup) {
  await page.evaluate(
    (value) => document.body.insertAdjacentHTML("beforeend", value),
    markup,
  );
  await settle(page);
}

async function setStorage(page, entries) {
  await page.evaluate((values) => {
    for (const [key, value] of Object.entries(values)) {
      localStorage.setItem(key, String(value));
      window.dispatchEvent(
        new StorageEvent("storage", { key, newValue: String(value) }),
      );
    }
  }, entries);
  await settle(page);
}

module.exports = {
  append,
  bool,
  card,
  comment,
  danmaku,
  keys,
  loadBfilter,
  setStorage,
  settle,
};

const { test, expect } = require("@playwright/test");
const path = require("node:path");

// Serve a synthetic video page with a real origin for persistent settings
async function openVideo(page, body, pathname = "/video/BVsynthetic") {
  await page.addInitScript(() => {
    window.GM_getValue = (key, fallback) =>
      localStorage.getItem(key) ?? fallback;
    window.GM_setValue = (key, value) => localStorage.setItem(key, value);
    window.GM_addValueChangeListener = () => {};
  });
  await page.route("https://www.bilibili.com/**", (route) =>
    route.fulfill({ contentType: "text/html; charset=utf-8", body }),
  );
  await page.goto(`https://www.bilibili.com${pathname}`);
}

// Add synthetic comments using Bilibili's nested shadow DOM structure
async function addComments(page) {
  await page.evaluate(() => {
    const comments = document.createElement("bili-comments");
    const feed = comments.attachShadow({ mode: "open" });
    for (const [tag, uid, text] of [
      ["bili-comment-renderer", "1001", "Blocked comment"],
      ["bili-comment-renderer", "1002", "Visible comment"],
      ["bili-comment-reply-renderer", "1001", "Blocked reply"],
    ]) {
      const thread = document.createElement("bili-comment-thread-renderer");
      const root = thread.attachShadow({ mode: "open" });
      const comment = document.createElement(tag);
      comment.attachShadow({ mode: "open" }).innerHTML =
        `<a id="user-avatar" data-user-profile-id="${uid}"></a><span>${text}</span>`;
      root.append(comment);
      if (tag === "bili-comment-renderer" && uid === "1001") {
        const replies = document.createElement("bili-comment-replies-renderer");
        const reply = document.createElement("bili-comment-reply-renderer");
        reply.attachShadow({ mode: "open" }).innerHTML =
          '<a id="user-avatar" data-user-profile-id="1002"></a><span>Reply under blocked parent</span>';
        replies.attachShadow({ mode: "open" }).append(reply);
        root.append(replies);
      }
      if (tag === "bili-comment-renderer") {
        const divider = document.createElement("div");
        divider.id = "div";
        divider.style.cssText = "height: 1px; border-bottom: 1px solid";
        root.append(divider);
      }
      feed.append(thread);
    }
    document.body.append(comments);
  });
}

// Verify the entry opens a dismissible dashboard below the home navigation item
test("opens and closes the dashboard from the home navigation", async ({
  page,
}) => {
  await openVideo(
    page,
    '<style>dialog { display: block; }</style><nav><div class="home-page-entry"><a href="https://www.bilibili.com/">首页</a></div></nav>',
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });

  const home = page.getByRole("link", { name: "首页" });
  const button = page.getByRole("button", { name: "Bfilter", exact: true });
  await expect(button).toBeVisible();
  expect((await button.boundingBox()).y).toBeGreaterThanOrEqual(
    (await home.boundingBox()).y + (await home.boundingBox()).height,
  );
  await button.click();
  const dashboard = page.getByRole("dialog", { name: "Bfilter" });
  await expect(dashboard).toBeVisible();
  await dashboard.getByRole("button", { name: "Close" }).click();
  await expect(page.locator("dialog.bfilter-dashboard")).not.toBeVisible();
});

// Switch between dashboard tabs without losing the UID list
test("switches between Users and Videos tabs", async ({ page }) => {
  await openVideo(
    page,
    '<nav><a href="https://www.bilibili.com/">首页</a></nav>',
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  const dashboard = page.getByRole("dialog", { name: "Bfilter" });
  const users = dashboard.getByRole("tab", { name: "Users" });
  const videos = dashboard.getByRole("tab", { name: "Videos" });
  const uidList = dashboard.getByRole("textbox");
  await uidList.fill("1001");
  await videos.click();
  await expect(videos).toHaveAttribute("aria-selected", "true");
  await expect(users).toHaveAttribute("aria-selected", "false");
  await expect(uidList).not.toBeVisible();
  await users.click();
  await expect(uidList).toBeVisible();
  await expect(uidList).toHaveValue("1001");
});

// Keep the modal centered when the host page resets element margins
test("centers the dashboard despite a page-wide margin reset", async ({
  page,
}) => {
  await openVideo(
    page,
    '<style>* { margin: 0; }</style><nav><a href="https://www.bilibili.com/">首页</a></nav>',
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  const box = await page.getByRole("dialog", { name: "Bfilter" }).boundingBox();
  const viewport = page.viewportSize();
  expect(box.x + box.width / 2).toBeCloseTo(viewport.width / 2, 0);
  expect(box.y + box.height / 2).toBeCloseTo(viewport.height / 2, 0);
});

// Preserve the site's navigation when it is rendered after the userscript starts
test("keeps a dynamically rendered home navigation intact", async ({
  page,
}) => {
  await openVideo(page, '<nav id="site-nav"></nav>');
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.evaluate(async () => {
    const nav = document.querySelector("#site-nav");
    nav.innerHTML =
      '<div class="home-page-entry"><a href="https://www.bilibili.com/">首页</a></div>';
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (nav.firstElementChild.children.length !== 1) nav.replaceChildren();
  });
  await expect(page.getByRole("link", { name: "首页" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bfilter", exact: true }),
  ).toBeVisible();
});

// Filter matching comments and replies, restore them on removal, and persist UIDs
test("filters saved users in current and later comments", async ({ page }) => {
  await openVideo(
    page,
    '<nav><a href="https://www.bilibili.com/">首页</a></nav>',
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await addComments(page);
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  await page.getByRole("tab", { name: "Users" }).click();
  const users = page.getByRole("textbox", { name: /uid/i });
  await users.fill("1001");
  const dividers = page.locator("bili-comment-thread-renderer #div");
  await expect(dividers.nth(0)).toBeHidden();
  await expect(dividers.nth(1)).toBeVisible();
  await expect(page.getByText("Blocked comment")).toBeHidden();
  await expect(page.getByText("Reply under blocked parent")).toBeHidden();
  await expect(page.getByText("Blocked reply")).toBeHidden();
  await expect(page.getByText("Visible comment")).toBeVisible();
  await users.fill("");
  await expect(dividers.nth(0)).toBeVisible();
  await expect(page.getByText("Blocked comment")).toBeVisible();
  await expect(page.getByText("Reply under blocked parent")).toBeVisible();
  await users.fill("1002");
  await expect(page.getByText("Blocked comment")).toBeVisible();
  await expect(page.getByText("Reply under blocked parent")).toBeHidden();
  await expect(page.getByText("Blocked reply")).toBeVisible();
  await users.fill("1001");
  await page.reload();
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await addComments(page);
  await expect(page.getByText("Blocked comment")).toBeHidden();
  await expect(page.getByText("Blocked reply")).toBeHidden();
  await expect(page.getByText("Visible comment")).toBeVisible();
});

// Preview filtered comments and videos without changing the saved UID list
test("previews filtered items and restores filtering", async ({ page }) => {
  await openVideo(
    page,
    `
    <nav><a href="https://www.bilibili.com/">首页</a></nav>
    <div class="rec-list">
      <div class="video-page-card-small" style="background-color: rgb(1, 2, 3)"><div class="upname"><a href="//space.bilibili.com/1001">Filtered video</a></div></div>
      <div class="video-page-card-small"><div class="upname"><a href="//space.bilibili.com/1002">Other video</a></div></div>
    </div>
  `,
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await addComments(page);
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  const users = page.getByRole("textbox", { name: /uid/i });
  const preview = page.getByRole("button", { name: "Preview" });
  await users.fill("1001");
  await expect(page.getByText("Blocked comment")).toBeHidden();
  await preview.click({ timeout: 1500 });
  await expect(preview).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Blocked comment")).toBeVisible();
  await expect(page.getByText("Blocked reply")).toBeVisible();
  await expect(page.getByText("Reply under blocked parent")).toBeVisible();
  await expect(page.getByText("Filtered video")).toBeVisible();
  const card = page.locator(".video-page-card-small").first();
  const thread = page.locator("bili-comment-thread-renderer").first();
  await expect(card).toHaveCSS("background-color", "rgb(255, 192, 203)");
  await expect(thread).toHaveCSS("background-color", "rgb(255, 192, 203)");
  await expect(thread).toHaveCSS("display", "block");
  await expect(page.locator("bili-comment-reply-renderer").last()).toHaveCSS(
    "display",
    "block",
  );
  await users.fill("");
  await expect(card).toHaveCSS("background-color", "rgb(1, 2, 3)");
  await users.fill("1001");
  await expect(page.getByText("Filtered video")).toBeVisible();
  await preview.click();
  await expect(preview).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Filtered video")).toBeHidden();
  await expect(page.getByText("Blocked comment")).toBeHidden();
  await users.fill("");
  await expect(card).toHaveCSS("background-color", "rgb(1, 2, 3)");
});

// Filter recommendations by uploader and restore them when the UID is removed
test("filters recommendations from blocked users", async ({ page }) => {
  await openVideo(
    page,
    `
    <nav><a href="https://www.bilibili.com/">首页</a></nav>
    <div class="rec-list">
      <div class="video-page-card-small"><div class="upname"><a href="//space.bilibili.com/1001/">Blocked recommendation</a></div></div>
      <div class="video-page-operator-card-small"><div class="upname"><a href="//space.bilibili.com/1001/">Blocked operator recommendation</a></div></div>
      <div class="video-page-card-small"><div class="upname"><a href="//space.bilibili.com/1002/">Visible recommendation</a></div></div>
    </div>
    <div class="next-play"><div class="video-page-card-small"><div class="upname"><a href="//space.bilibili.com/1001/">Blocked next video</a></div></div></div>
    <a href="//space.bilibili.com/1001/">Outside recommendations</a>
  `,
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  const users = page.getByRole("textbox", { name: /uid/i });
  await users.fill("1001");
  await expect(page.getByText("Blocked recommendation")).toBeHidden();
  await expect(page.getByText("Blocked operator recommendation")).toBeHidden();
  await expect(page.getByText("Blocked next video")).toBeHidden();
  await expect(page.getByText("Visible recommendation")).toBeVisible();
  await expect(page.getByText("Outside recommendations")).toBeVisible();
  await page.evaluate(() => {
    document
      .querySelector(".rec-list")
      .insertAdjacentHTML(
        "beforeend",
        '<div class="video-page-card-small"><div class="upname"><a href="//space.bilibili.com/1001/">Later recommendation</a></div></div>',
      );
  });
  await expect(page.getByText("Later recommendation")).toBeHidden();
  await users.fill("");
  await expect(page.getByText("Blocked recommendation")).toBeVisible();
  await expect(page.getByText("Blocked operator recommendation")).toBeVisible();
  await expect(page.getByText("Blocked next video")).toBeVisible();
  await expect(page.getByText("Later recommendation")).toBeVisible();
});

// Hide ranked videos by listed uploaders and restore them when removed
test("filters ranked videos by user UID", async ({ page }) => {
  await openVideo(
    page,
    `
    <nav><a href="https://www.bilibili.com/">首页</a></nav>
    <ul class="rank-list">
      <li class="rank-item"><div class="info"><a class="title">Blocked ranked video</a><div class="detail"><a href="//space.bilibili.com/1001">Uploader</a></div></div></li>
      <li class="rank-item"><div class="info"><a class="title">Visible ranked video</a><div class="detail"><a href="//space.bilibili.com/1002">Uploader</a></div></div></li>
    </ul>
  `,
    "/v/popular/rank/all",
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  const users = page.getByRole("textbox", { name: /uid/i });
  await users.fill("1001");
  await expect(page.getByText("Blocked ranked video")).toBeHidden();
  await expect(page.getByText("Visible ranked video")).toBeVisible();
  await page.evaluate(() => {
    document
      .querySelector(".rank-list")
      .insertAdjacentHTML(
        "beforeend",
        '<li class="rank-item"><div class="detail"><a href="//space.bilibili.com/1001">Later ranked video</a></div></li>',
      );
  });
  await expect(page.getByText("Later ranked video")).toBeHidden();
  await users.fill("");
  await expect(page.getByText("Blocked ranked video")).toBeVisible();
  await expect(page.getByText("Later ranked video")).toBeVisible();
});

// Filter video search results without hiding unrelated result types
test("filters video search results by uploader", async ({ page }) => {
  await page.addInitScript(() => {
    window.GM_getValue = (_key, fallback) => fallback;
    window.GM_setValue = () => {};
    window.GM_addValueChangeListener = () => {};
  });
  await page.route("https://search.bilibili.com/**", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<nav><a href="https://www.bilibili.com/">首页</a></nav>
      <div class="results">
        <div class="col_3"><div class="bili-video-card"><div class="bili-video-card__wrap" style="background-color: white"><a href="//www.bilibili.com/video/BV1">Blocked video</a><a class="bili-video-card__info--owner" href="//space.bilibili.com/1001">Uploader</a></div></div></div>
        <div class="col_3"><div class="bili-video-card"><a href="//www.bilibili.com/video/BV2">Other video</a><a class="bili-video-card__info--owner" href="//space.bilibili.com/1002">Other uploader</a></div></div>
        <div class="col_3"><div class="bili-video-card"><a href="https://www.bilibili.com/cheese/play/ss1">Course</a><a class="bili-video-card__info--owner" href="//space.bilibili.com/1001">Course author</a></div></div>
      </div>`,
    }),
  );
  await page.goto("https://search.bilibili.com/all?keyword=test");
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  const users = page.getByRole("textbox", { name: /uid/i });
  await users.fill("1001");
  await expect(page.getByText("Blocked video")).toBeHidden();
  await expect(page.getByText("Other video")).toBeVisible();
  await expect(page.getByText("Course", { exact: true })).toBeVisible();
  await page.evaluate(() =>
    document
      .querySelector(".results")
      .insertAdjacentHTML(
        "beforeend",
        '<div class="col_3"><div class="bili-video-card"><a href="//www.bilibili.com/video/BV3">Later video</a><a class="bili-video-card__info--owner" href="//space.bilibili.com/1001">Uploader</a></div></div>',
      ),
  );
  await expect(page.getByText("Later video")).toBeHidden();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("Blocked video")).toBeVisible();
  await expect(page.getByText("Blocked video").locator("..")).toHaveCSS(
    "background-color",
    "rgb(255, 192, 203)",
  );
  await users.fill("");
  await expect(page.getByText("Blocked video").locator("..")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.getByText("Later video")).toBeVisible();
});

// Filter home feed videos and let the grid fill the removed slots
test("filters home feed videos by uploader", async ({ page }) => {
  await openVideo(
    page,
    `
    <nav><a href="https://www.bilibili.com/">首页</a></nav>
    <div class="container">
      <div class="feed-card"><div class="bili-feed-card"><div class="bili-video-card"><div class="bili-video-card__wrap" style="background-color: white"><a href="https://www.bilibili.com/video/BV1">Blocked home video</a><a class="bili-video-card__info--owner" href="//space.bilibili.com/1001">Uploader</a></div></div></div></div>
      <div class="feed-card"><div class="bili-feed-card"><div class="bili-video-card"><a href="https://www.bilibili.com/video/BV2">Visible home video</a><a class="bili-video-card__info--owner" href="//space.bilibili.com/1002">Other uploader</a></div></div></div>
    </div>`,
    "/",
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  const users = page.getByRole("textbox", { name: /uid/i });
  await users.fill("1001");
  await expect(page.getByText("Blocked home video")).toBeHidden();
  await expect(page.locator(".feed-card").first()).toBeHidden();
  await expect(page.getByText("Visible home video")).toBeVisible();
  await page.evaluate(() =>
    document
      .querySelector(".container")
      .insertAdjacentHTML(
        "beforeend",
        '<div class="feed-card"><div class="bili-feed-card"><div class="bili-video-card"><a href="https://www.bilibili.com/video/BV3">Later home video</a><a class="bili-video-card__info--owner" href="//space.bilibili.com/1001">Uploader</a></div></div></div>',
      ),
  );
  await expect(page.getByText("Later home video")).toBeHidden();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("Blocked home video")).toBeVisible();
  await expect(page.getByText("Blocked home video").locator("..")).toHaveCSS(
    "background-color",
    "rgb(255, 192, 203)",
  );
  await users.fill("");
  await expect(page.getByText("Blocked home video").locator("..")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.getByText("Later home video")).toBeVisible();
});

// Filter video durations on each supported page and preserve the threshold
for (const kind of ["home", "search", "ranking", "video"]) {
  test(`filters ${kind} videos shorter than the configured duration`, async ({
    page,
  }) => {
    const rank = kind === "ranking";
    const video = kind === "video";
    const card = (title, duration, id) =>
      rank
        ? `<li class="rank-item" data-id="${id}"><a href="/video/BV${id}">${title}</a></li>`
        : video
          ? `<div class="video-page-card-small">${title}<span class="duration">${duration}</span></div>`
          : `<div class="${kind === "home" ? "feed-card" : "col_3"}"><div class="bili-video-card"><div class="bili-video-card__wrap"><a href="//www.bilibili.com/video/BV${id}">${title}</a><span class="bili-video-card__stats__duration">${duration}</span></div></div></div>`;
    const wrapper = rank ? "ul" : "div";
    const cls = rank ? "rank-list" : video ? "rec-list" : "results";
    const body = `<nav><a href="https://www.bilibili.com/">首页</a></nav><${wrapper} class="${cls}">${card("Short video", "02:59", 1)}${card("Boundary video", "03:00", 2)}${card("Long video", "01:03:00", 3)}</${wrapper}>`;
    const pathname =
      kind === "home"
        ? "/"
        : rank
          ? "/v/popular/rank/all"
          : "/video/BVsynthetic";
    if (kind === "search") {
      await page.route("https://search.bilibili.com/**", (route) =>
        route.fulfill({ contentType: "text/html; charset=utf-8", body }),
      );
      await page.addInitScript(() => {
        window.GM_getValue = (key, fallback) =>
          localStorage.getItem(key) ?? fallback;
        window.GM_setValue = (key, value) => localStorage.setItem(key, value);
        window.GM_addValueChangeListener = () => {};
      });
      await page.goto("https://search.bilibili.com/all?keyword=synthetic");
    } else {
      await openVideo(page, body, pathname);
    }
    if (rank)
      await page.evaluate(() => {
        document.querySelector(".rank-list").parentElement.__vue__ = {
          $props: {
            list: [
              { aid: 1, duration: 179 },
              { aid: 2, duration: 180 },
              { aid: 3, duration: 3780 },
            ],
          },
        };
      });
    await page.addScriptTag({
      path: path.join(__dirname, "..", "main.user.js"),
    });
    await expect(page.getByText("Short video")).toBeHidden();
    await expect(page.getByText("Boundary video")).toBeVisible();
    await expect(page.getByText("Long video")).toBeVisible();
    await page.getByRole("button", { name: "Bfilter", exact: true }).click();
    await page.getByRole("tab", { name: "Videos" }).click();
    const threshold = page.getByRole("spinbutton", {
      name: /hide videos by duration/i,
    });
    await expect(threshold).toHaveValue("3");
    await threshold.fill("2");
    await expect(page.getByText("Short video")).toBeVisible();
    await threshold.fill("4");
    await expect(page.getByText("Boundary video")).toBeHidden();
    await page.getByRole("tab", { name: "Users" }).click();
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByText("Boundary video")).toBeVisible();
    await page.getByRole("button", { name: "Preview" }).click();
    await page.reload();
    if (rank)
      await page.evaluate(() => {
        document.querySelector(".rank-list").parentElement.__vue__ = {
          $props: {
            list: [
              { aid: 1, duration: 179 },
              { aid: 2, duration: 180 },
              { aid: 3, duration: 3780 },
            ],
          },
        };
      });
    await page.addScriptTag({
      path: path.join(__dirname, "..", "main.user.js"),
    });
    await expect(page.getByText("Boundary video")).toBeHidden();
  });
}

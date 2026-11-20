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

// Verify the independent entry opens a dismissible dashboard
test("opens and closes the dashboard from the launcher", async ({ page }) => {
  await openVideo(
    page,
    '<style>dialog { display: block; }</style><nav><div class="home-page-entry"><a href="https://www.bilibili.com/">首页</a></div></nav>',
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });

  const button = page.getByRole("button", { name: "Bfilter", exact: true });
  await expect(button).toBeVisible();
  expect((await button.boundingBox()).y).toBeCloseTo(
    page.viewportSize().height * 0.054,
    0,
  );
  expect((await button.boundingBox()).height).toBeLessThan(40);
  await button.click();
  const dashboard = page.getByRole("dialog", { name: "Bfilter" });
  await expect(dashboard).toBeVisible();
  await dashboard.getByRole("button", { name: "Close" }).click();
  await expect(page.locator("dialog.bfilter-dashboard")).not.toBeVisible();
});

// Keep both sets of filters accessible in one popup
test("shows user and video sections together", async ({ page }) => {
  await openVideo(
    page,
    '<nav><a href="https://www.bilibili.com/">首页</a></nav>',
  );
  await page.evaluate(() => {
    window.GM_info = { script: { version: "7.8.9" } };
  });
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  const popup = page.getByRole("dialog", { name: "Bfilter" });
  await expect(popup.getByText("7.8.9")).toBeVisible();
  await expect(
    popup.getByRole("heading", { name: "Hide Users" }),
  ).toBeVisible();
  await expect(
    popup.getByRole("heading", { name: "Hide Videos" }),
  ).toBeVisible();
  await expect(
    popup.getByRole("textbox", { name: "User UIDs, one per line" }),
  ).toHaveAttribute("placeholder", "User UIDs, one per line");
  await expect(
    popup.getByRole("spinbutton", { name: /duration/i }),
  ).toBeVisible();
  expect((await popup.boundingBox()).width).toBe(270);
});

// Keep multiple type selections when the dropdown is closed and reopened
test("selects multiple video types from the dropdown", async ({ page }) => {
  await openVideo(
    page,
    '<nav><a href="https://www.bilibili.com/">首页</a></nav>',
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  await expect(page.getByRole("button", { name: "Types" })).toHaveText(/0/);
  const types = page.getByRole("button", { name: "Types" });
  const popup = page.getByRole("dialog", { name: "Bfilter" });
  const height = (await popup.boundingBox()).height;
  await types.click();
  expect((await popup.boundingBox()).height).toBe(height);
  await page.getByRole("checkbox", { name: "Live" }).check();
  await expect(types).toHaveText(/1/);
  await page.getByRole("checkbox", { name: "Manga" }).check();
  await expect(types).toHaveText(/2/);
  await types.click();
  await expect(page.locator('input[value="live"]')).not.toBeVisible();
  await types.click();
  await expect(page.getByRole("checkbox", { name: "Live" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Manga" })).toBeChecked();
});

// Keep the popup beside its launcher without blocking the page
test("anchors the popup to the left-edge launcher", async ({ page }) => {
  await openVideo(
    page,
    '<style>body { height: 2000px; }</style><button id="site-button">Site action</button>',
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  const button = page.getByRole("button", { name: "Bfilter", exact: true });
  const launcher = await button.boundingBox();
  expect(launcher.x).toBe(0);
  expect(launcher.y).toBeCloseTo(page.viewportSize().height * 0.054, 0);
  await page.evaluate(() => window.scrollTo(0, 500));
  expect((await button.boundingBox()).y).toBeCloseTo(launcher.y, 0);
  await button.click();
  const popup = page.getByRole("dialog", { name: "Bfilter" });
  const box = await popup.boundingBox();
  expect(box.x).toBe(0);
  expect(box.y - (launcher.y + launcher.height)).toBeGreaterThanOrEqual(0);
  expect(box.y - (launcher.y + launcher.height)).toBeLessThanOrEqual(8);
  await expect(page.locator("#site-button")).toBeEnabled();
  await button.click();
  await expect(popup).not.toBeVisible();
});

// Drag the launcher vertically without triggering its popup
test("moves the launcher vertically and keeps click behavior", async ({
  page,
}) => {
  await openVideo(page, "");
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  const button = page.getByRole("button", { name: "Bfilter", exact: true });
  const start = await button.boundingBox();
  await page.mouse.move(start.x + 15, start.y + 10);
  await page.mouse.down();
  await page.mouse.move(start.x + 80, start.y + 130, { steps: 5 });
  await page.mouse.up();
  const moved = await button.boundingBox();
  expect(moved.x).toBe(0);
  expect(moved.y).toBeCloseTo(start.y + 120, 0);
  await expect(page.getByRole("dialog", { name: "Bfilter" })).not.toBeVisible();
  await button.click();
  const popup = page.getByRole("dialog", { name: "Bfilter" });
  await expect(popup).toBeVisible();
  expect((await popup.boundingBox()).y).toBeCloseTo(
    moved.y + moved.height + 4,
    0,
  );
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

// Apply the registration heuristic to video uploaders and comment authors
test("filters users by registration threshold", async ({ page }) => {
  await openVideo(
    page,
    `
    <nav><a href="https://www.bilibili.com/">首页</a></nav>
    <div class="rec-list">
      <div class="video-page-card-small"><span>Recent video</span><div class="upname"><a href="//space.bilibili.com/123456789012345">Uploader</a></div></div>
      <div class="video-page-card-small"><span>Older video</span><div class="upname"><a href="//space.bilibili.com/1234567">Uploader</a></div></div>
    </div>`,
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.evaluate(() => {
    const comments = document.createElement("bili-comments");
    const feed = comments.attachShadow({ mode: "open" });
    for (const [uid, text] of [
      ["123456789012345", "Recent comment"],
      ["1234567", "Older comment"],
    ]) {
      const thread = document.createElement("bili-comment-thread-renderer");
      const comment = document.createElement("bili-comment-renderer");
      comment.attachShadow({ mode: "open" }).innerHTML =
        `<a id="user-avatar" data-user-profile-id="${uid}"></a><span>${text}</span>`;
      thread.attachShadow({ mode: "open" }).append(comment);
      feed.append(thread);
    }
    document.body.append(comments);
  });
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  const filter = page.getByRole("checkbox", {
    name: /registered in & after/i,
  });
  const threshold = page.getByRole("combobox", { name: /registration time/i });
  await expect(filter).not.toBeChecked();
  await expect(threshold).toHaveValue("15");
  await expect(page.getByText("Recent video")).toBeVisible();
  await filter.check();
  await expect(page.getByText("Recent video")).toBeHidden();
  await expect(page.getByText("Recent comment")).toBeHidden();
  await expect(page.getByText("Older video")).toBeVisible();
  await expect(page.getByText("Older comment")).toBeVisible();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("Recent comment")).toBeVisible();
  await page.getByRole("button", { name: "Preview" }).click();
  await threshold.selectOption("8");
  await page.reload();
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  await expect(filter).toBeChecked();
  await expect(threshold).toHaveValue("8");
  await filter.uncheck();
  await expect(page.getByText("Recent video")).toBeVisible();
});

// Match the 2025 heuristic only for numeric UIDs with the required prefix and length
test("filters the 2025 registration threshold", async ({ page }) => {
  const uids = [
    "354680000000000",
    "3546800000000000",
    "35468000000000000",
    "3546900000000000",
  ];
  const cards = uids
    .map(
      (uid) =>
        `<div class="video-page-card-small"><span>UID ${uid}</span><div class="upname"><a href="//space.bilibili.com/${uid}">Uploader</a></div></div>`,
    )
    .join("");
  await openVideo(
    page,
    `<nav><a href="https://www.bilibili.com/">首页</a></nav><div class="rec-list">${cards}</div>`,
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  await page.getByRole("checkbox", { name: /registered in & after/i }).check();
  const threshold = page.getByRole("combobox", { name: /registration time/i });
  await threshold.selectOption({ label: "2025" });
  await expect(page.getByText(`UID ${uids[0]}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`UID ${uids[1]}`, { exact: true })).toBeHidden();
  await expect(page.getByText(`UID ${uids[2]}`, { exact: true })).toBeHidden();
  await expect(page.getByText(`UID ${uids[3]}`, { exact: true })).toBeVisible();
  await page.reload();
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await expect(page.getByText(`UID ${uids[1]}`, { exact: true })).toBeHidden();
  await expect(page.getByText(`UID ${uids[3]}`, { exact: true })).toBeVisible();
});

// Respect each legacy UID-length boundary
test("uses the registration threshold boundaries", async ({ page }) => {
  const cards = [
    "1234567",
    "12345678",
    "123456789",
    "1234567890",
    "123456789012345",
  ]
    .map(
      (uid) =>
        `<div class="video-page-card-small"><span>UID ${uid}</span><div class="upname"><a href="//space.bilibili.com/${uid}">Uploader</a></div></div>`,
    )
    .join("");
  await openVideo(
    page,
    `<nav><a href="https://www.bilibili.com/">首页</a></nav><div class="rec-list">${cards}</div>`,
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  await page.getByRole("checkbox", { name: /registered in & after/i }).check();
  const threshold = page.getByRole("combobox", { name: /registration time/i });
  for (const digits of [8, 9, 10, 15]) {
    await threshold.selectOption(String(digits));
    for (const uid of [
      "1234567",
      "12345678",
      "123456789",
      "1234567890",
      "123456789012345",
    ]) {
      if (uid.length >= digits)
        await expect(
          page.getByText(`UID ${uid}`, { exact: true }),
        ).toBeHidden();
      else
        await expect(
          page.getByText(`UID ${uid}`, { exact: true }),
        ).toBeVisible();
    }
  }
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

// Keep visible home cards aligned when filtering shifts later cards into earlier rows
test("aligns home feed cards after filtering", async ({ page }) => {
  const card = (id) =>
    `<div class="feed-card"><div class="bili-feed-card"><div class="bili-video-card"><a href="https://www.bilibili.com/video/BV${id}">Video ${id}</a><a class="bili-video-card__info--owner" href="//space.bilibili.com/${id}">Uploader</a></div></div></div>`;
  await openVideo(
    page,
    `
    <style>
      .recommended-container_floor-aside .container { display: grid; grid-template-columns: repeat(5, 100px); gap: 20px; }
      .recommended-swipe { grid-area: 1 / 1 / 3 / 3; }
      .recommended-container_floor-aside .container > :nth-of-type(n+8) { margin-top: 40px; }
    </style>
    <nav><a href="https://www.bilibili.com/">首页</a></nav>
    <div class="recommended-container_floor-aside"><div class="container">
      <div class="recommended-swipe">Carousel</div>${[1, 2, 3, 4, 5, 6, 7].map(card).join("")}
    </div></div>`,
    "/",
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  await page.getByRole("textbox", { name: /uid/i }).fill("4");
  const left = await page.getByText("Video 5").boundingBox();
  const right = await page.getByText("Video 7").boundingBox();
  expect(right.y).toBe(left.y);
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
    const threshold = page.getByRole("spinbutton", {
      name: /duration \(min\.\)/i,
    });
    await expect(threshold).toHaveValue("3");
    await threshold.fill("2");
    await expect(page.getByText("Short video")).toBeVisible();
    await threshold.fill("4");
    await expect(page.getByText("Boundary video")).toBeHidden();
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

// Filter by the displayed view count on each supported page
for (const kind of ["home", "search", "ranking", "video"]) {
  test(`filters ${kind} videos by views`, async ({ page }) => {
    const rank = kind === "ranking";
    const video = kind === "video";
    const card = (title, count, id) =>
      rank
        ? `<li class="rank-item" data-id="${id}">${title}<div class="detail-state"><span class="data-box">${count}</span></div></li>`
        : video
          ? `<div class="video-page-card-small">${title}<div class="playinfo"><svg class="play"></svg>${count}<svg class="dm"></svg>12</div></div>`
          : `<div class="${kind === "home" ? "feed-card" : "col_3"}"><div class="bili-video-card"><div class="bili-video-card__wrap"><a href="//www.bilibili.com/video/BV${id}">${title}</a><div class="bili-video-card__stats--left"><span class="bili-video-card__stats--item">${count}</span></div></div></div></div>`;
    const body = `<nav><a href="https://www.bilibili.com/">首页</a></nav><div class="${rank ? "rank-list" : video ? "rec-list" : "results"}">${card("Few views", "4,999", 1)}${card("Boundary views", "5000", 2)}${card("Many views", "1.2万", 3)}${card("Unknown views", "--", 4)}</div>`;
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
      await openVideo(
        page,
        body,
        kind === "home"
          ? "/"
          : rank
            ? "/v/popular/rank/all"
            : "/video/BVsynthetic",
      );
    }
    await page.addScriptTag({
      path: path.join(__dirname, "..", "main.user.js"),
    });
    await expect(page.getByText("Few views")).toBeHidden();
    await expect(page.getByText("Boundary views")).toBeVisible();
    await expect(page.getByText("Many views")).toBeVisible();
    await expect(page.getByText("Unknown views")).toBeVisible();
    await page.getByRole("button", { name: "Bfilter", exact: true }).click();
    const threshold = page.getByRole("spinbutton", {
      name: /views/i,
    });
    await expect(threshold).toHaveValue("5000");
    await threshold.fill("10000");
    await expect(page.getByText("Boundary views")).toBeHidden();
    await threshold.fill("0");
    await expect(page.getByText("Few views")).toBeVisible();
    await threshold.fill("5000");
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByText("Few views")).toBeVisible();
    await page.getByRole("button", { name: "Preview" }).click();
    await page.reload();
    await page.addScriptTag({
      path: path.join(__dirname, "..", "main.user.js"),
    });
    await expect(page.getByText("Few views")).toBeHidden();
  });
}

// Hide tracked promotional videos without hiding ordinary videos or non-video ads
test("filters promotional videos when selected", async ({ page }) => {
  const promoted =
    '<div class="feed-card"><div class="bili-video-card"><div class="bili-video-card__wrap"><a href="//cm.bilibili.com/cm/api/fees" data-target-url="https://www.bilibili.com/video/BVsynthetic">Promoted video</a></div></div></div>';
  await openVideo(
    page,
    `<nav><a href="https://www.bilibili.com/">首页</a></nav><div class="feed">${promoted}<div class="feed-card"><div class="bili-video-card"><a href="https://www.bilibili.com/video/BVordinary">Ordinary video</a></div></div><div class="feed-card"><div class="bili-video-card"><a href="//cm.bilibili.com/cm/api/fees" data-target-url="https://example.test/">Non-video promotion</a></div></div></div>`,
    "/",
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  await page.getByRole("button", { name: "Types" }).click();
  const option = page.getByRole("checkbox", { name: "Promo" });
  await expect(option).not.toBeChecked();
  await expect(page.getByText("Promoted video", { exact: true })).toBeVisible();
  await option.check();
  await expect(page.getByText("Promoted video", { exact: true })).toBeHidden();
  await expect(page.getByText("Ordinary video")).toBeVisible();
  await expect(page.getByText("Non-video promotion")).toBeVisible();
  await page.evaluate(
    (html) =>
      document
        .querySelector(".feed")
        .insertAdjacentHTML(
          "beforeend",
          html.replace("Promoted video", "Later promotion"),
        ),
    promoted,
  );
  await expect(page.getByText("Later promotion")).toBeHidden();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("Promoted video", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Preview" }).click();
  await page.reload();
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await expect(page.getByText("Promoted video", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  await page.getByRole("button", { name: "Types" }).click();
  await page.getByRole("checkbox", { name: "Promo" }).uncheck();
  await expect(page.getByText("Promoted video", { exact: true })).toBeVisible();
});

// Filter promotional videos in the current home feed layout
test("filters promoted videos in bili-feed-card", async ({ page }) => {
  const promoted = (title) =>
    `<div class="bili-feed-card"><div class="bili-video-card is-rcmd"><div class="bili-video-card__wrap"><a href="https://cm.bilibili.com/cm/api/fees" data-target-url="https://www.bilibili.com/video/BVsynthetic">${title}</a></div></div></div>`;
  await openVideo(
    page,
    `<nav><a href="https://www.bilibili.com/">首页</a></nav><div class="feed">${promoted("Promoted video")}<div class="bili-feed-card"><div class="bili-video-card is-rcmd"><a href="https://www.bilibili.com/video/BVordinary">Ordinary video</a></div></div></div>`,
    "/",
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  await page.getByRole("button", { name: "Types" }).click();
  const option = page.getByRole("checkbox", { name: "Promo" });
  await option.check();
  const slot = page.locator(".bili-feed-card").first();
  await expect(slot).toBeHidden();
  await expect(page.getByText("Ordinary video")).toBeVisible();
  await page.evaluate(
    (html) =>
      document.querySelector(".feed").insertAdjacentHTML("beforeend", html),
    promoted("Later promotion"),
  );
  await expect(page.getByText("Later promotion")).toBeHidden();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(slot).toBeVisible();
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByRole("button", { name: "Types" }).click();
  await option.uncheck();
  await expect(slot).toBeVisible();
});

// Filter live stream cards without affecting ordinary videos
for (const kind of ["home", "search"]) {
  test(`filters live streams on ${kind}`, async ({ page }) => {
    const card = (title, live) =>
      kind === "home"
        ? live
          ? `<div class="floor-single-card"><div class="floor-card-inner"><a href="https://live.bilibili.com/123">${title}</a></div></div>`
          : `<div class="feed-card"><div class="bili-video-card"><a href="https://www.bilibili.com/video/BVnormal">${title}</a></div></div>`
        : `<div class="col_3"><div class="bili-video-card"><div class="bili-video-card__wrap"><a href="${live ? "//live.bilibili.com/123" : "//www.bilibili.com/video/BVnormal"}">${title}</a></div></div></div>`;
    const body = `<nav><a href="https://www.bilibili.com/">首页</a></nav><div class="feed">${card("Live stream", true)}${card("Ordinary video", false)}</div>`;
    if (kind === "search") {
      await page.addInitScript(() => {
        window.GM_getValue = (key, fallback) =>
          localStorage.getItem(key) ?? fallback;
        window.GM_setValue = (key, value) => localStorage.setItem(key, value);
        window.GM_addValueChangeListener = () => {};
      });
      await page.route("https://search.bilibili.com/**", (route) =>
        route.fulfill({ contentType: "text/html; charset=utf-8", body }),
      );
      await page.goto("https://search.bilibili.com/all?keyword=synthetic");
    } else await openVideo(page, body, "/");
    await page.addScriptTag({
      path: path.join(__dirname, "..", "main.user.js"),
    });
    await page.getByRole("button", { name: "Bfilter", exact: true }).click();
    await page.getByRole("button", { name: "Types" }).click();
    const option = page.getByRole("checkbox", { name: "Live" });
    await expect(option).not.toBeChecked();
    await option.check();
    await expect(page.getByText("Live stream")).toBeHidden();
    await expect(page.getByText("Ordinary video")).toBeVisible();
    await page.evaluate(
      (html) =>
        document.querySelector(".feed").insertAdjacentHTML("beforeend", html),
      card("Later live stream", true),
    );
    await expect(page.getByText("Later live stream")).toBeHidden();
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByText("Live stream", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Preview" }).click();
    await page.reload();
    await page.addScriptTag({
      path: path.join(__dirname, "..", "main.user.js"),
    });
    await expect(page.getByText("Live stream")).toBeHidden();
    await page.getByRole("button", { name: "Bfilter", exact: true }).click();
    await page.getByRole("button", { name: "Types" }).click();
    await page.getByRole("checkbox", { name: "Live" }).uncheck();
    await expect(page.getByText("Live stream")).toBeVisible();
  });
}

// Filter live cards in the current home feed layout
test("filters home live recommendation cards", async ({ page }) => {
  const card = (title) =>
    `<div class="bili-feed-card"><div class="bili-live-card is-rcmd"><div class="bili-live-card__wrap"><div class="bili-live-card__info"><h3><a href="https://live.bilibili.com/123">${title}</a></h3></div></div></div></div>`;
  await openVideo(
    page,
    `<nav><a href="https://www.bilibili.com/">首页</a></nav><div class="feed">${card("Live recommendation")}<div class="feed-card"><div class="bili-video-card"><a href="https://www.bilibili.com/video/BVnormal">Ordinary video</a></div></div></div>`,
    "/",
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  await page.getByRole("button", { name: "Types" }).click();
  const option = page.getByRole("checkbox", { name: "Live" });
  await option.check();
  const liveCard = page.locator(".bili-feed-card").first();
  await expect(liveCard).toBeHidden();
  await expect(page.getByText("Ordinary video")).toBeVisible();
  await page.evaluate(
    (html) =>
      document.querySelector(".feed").insertAdjacentHTML("beforeend", html),
    card("Later recommendation"),
  );
  await expect(page.getByText("Later recommendation")).toBeHidden();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(liveCard).toBeVisible();
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByRole("button", { name: "Types" }).click();
  await option.uncheck();
  await expect(liveCard).toBeVisible();
});

// Filter live-room search cards and restore them when disabled
test("filters live-room search results", async ({ page }) => {
  const body = `<nav><a href="https://www.bilibili.com/">首页</a></nav><div class="row"><div class="video-list-item col_3"><div class="bili-live-card"><div class="bili-live-card__wrap"><a href="//live.bilibili.com/123">Live room</a></div></div></div><div class="col_3"><div class="bili-video-card"><a href="//www.bilibili.com/video/BVnormal">Ordinary video</a></div></div></div>`;
  await page.addInitScript(() => {
    window.GM_getValue = (_key, fallback) => fallback;
    window.GM_setValue = () => {};
    window.GM_addValueChangeListener = () => {};
  });
  await page.route("https://search.bilibili.com/**", (route) =>
    route.fulfill({ contentType: "text/html; charset=utf-8", body }),
  );
  await page.goto("https://search.bilibili.com/live?keyword=synthetic");
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  await page.getByRole("button", { name: "Types" }).click();
  const option = page.getByRole("checkbox", { name: "Live" });
  await option.check();
  await expect(page.getByText("Live room")).toBeHidden();
  await expect(page.getByText("Ordinary video")).toBeVisible();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("Live room")).toBeVisible();
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByRole("button", { name: "Types" }).click();
  await option.uncheck();
  await expect(page.getByText("Live room")).toBeVisible();
});

// Hide bangumi search results without hiding other PGC or ordinary videos
for (const kind of ["all", "bangumi"]) {
  test(`filters bangumi on ${kind} search`, async ({ page }) => {
    const card = (title) =>
      `<div class="col_6"><div class="media-card"><a href="https://www.bilibili.com/bangumi/play/ss123">${title}</a></div></div>`;
    const scope = kind === "all" ? "bangumi-pgc-list" : "search-page-bangumi";
    const body = `<nav><a href="https://www.bilibili.com/">首页</a></nav><div class="${scope}"><div class="row">${card("Anime result")}</div></div><div class="movie-pgc-list"><div class="col_6"><div class="media-card"><a href="https://www.bilibili.com/bangumi/play/ss456">Movie result</a></div></div></div>`;
    await page.addInitScript(() => {
      window.GM_getValue = (key, fallback) =>
        localStorage.getItem(key) ?? fallback;
      window.GM_setValue = (key, value) => localStorage.setItem(key, value);
      window.GM_addValueChangeListener = () => {};
    });
    await page.route("https://search.bilibili.com/**", (route) =>
      route.fulfill({ contentType: "text/html; charset=utf-8", body }),
    );
    await page.goto(`https://search.bilibili.com/${kind}?keyword=synthetic`);
    await page.addScriptTag({
      path: path.join(__dirname, "..", "main.user.js"),
    });
    await page.getByRole("button", { name: "Bfilter", exact: true }).click();
    await page.getByRole("button", { name: "Types" }).click();
    const option = page.getByRole("checkbox", { name: "Bangumi" });
    await expect(option).not.toBeChecked();
    await option.check();
    await expect(page.getByText("Anime result", { exact: true })).toBeHidden();
    await expect(page.getByText("Movie result")).toBeVisible();
    await page.evaluate(
      (html) =>
        document.querySelector(".row").insertAdjacentHTML("beforeend", html),
      card("Later anime"),
    );
    await expect(page.getByText("Later anime")).toBeHidden();
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByText("Anime result", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Preview" }).click();
    await page.reload();
    await page.addScriptTag({
      path: path.join(__dirname, "..", "main.user.js"),
    });
    await expect(page.getByText("Anime result", { exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Bfilter", exact: true }).click();
    await page.getByRole("button", { name: "Types" }).click();
    await page.getByRole("checkbox", { name: "Bangumi" }).uncheck();
    await expect(page.getByText("Anime result", { exact: true })).toBeVisible();
  });
}

// Filter home feed cards linking to Bangumi without affecting ordinary videos
test("filters bangumi home recommendations", async ({ page }) => {
  const anime =
    '<div class="feed-card"><div class="bili-video-card"><div class="bili-video-card__wrap"><a href="https://www.bilibili.com/bangumi/play/ep123">Anime recommendation</a></div></div></div>';
  await openVideo(
    page,
    `<nav><a href="https://www.bilibili.com/">首页</a></nav><div class="feed">${anime}<div class="feed-card"><div class="bili-video-card"><a href="https://www.bilibili.com/video/BVnormal">Ordinary recommendation</a></div></div></div>`,
    "/",
  );
  await page.addScriptTag({ path: path.join(__dirname, "..", "main.user.js") });
  await page.getByRole("button", { name: "Bfilter", exact: true }).click();
  await page.getByRole("button", { name: "Types" }).click();
  const option = page.getByRole("checkbox", { name: "Bangumi" });
  await option.check();
  await expect(
    page.getByText("Anime recommendation", { exact: true }),
  ).toBeHidden();
  await expect(page.getByText("Ordinary recommendation")).toBeVisible();
  await page.evaluate(
    (html) =>
      document.querySelector(".feed").insertAdjacentHTML("beforeend", html),
    anime.replace("Anime recommendation", "Later anime"),
  );
  await expect(page.getByText("Later anime")).toBeHidden();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(
    page.getByText("Anime recommendation", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByRole("button", { name: "Types" }).click();
  await option.uncheck();
  await expect(
    page.getByText("Anime recommendation", { exact: true }),
  ).toBeVisible();
});

// Hide Classroom cards while preserving unrelated results
for (const kind of ["home", "search"]) {
  test(`filters Classroom on ${kind}`, async ({ page }) => {
    const card = (title) =>
      `<div class="${kind === "home" ? "feed-card" : "col_3"}"><div class="bili-video-card"><div class="bili-video-card__wrap"><a href="//www.bilibili.com/cheese/play/ss123">${title}</a></div></div></div>`;
    const body = `<nav><a href="https://www.bilibili.com/">首页</a></nav><div class="feed">${card("Classroom result")}<div class="${kind === "home" ? "feed-card" : "col_3"}"><div class="bili-video-card"><a href="https://m.bilibili.com/cheese/play/ss789">Mobile classroom</a></div></div><div class="col_6"><div class="activity-card"><a href="https://www.bilibili.com/cheese/play/ss456">Featured course</a></div></div><div class="col_6"><div class="activity-card"><a href="https://example.test/">Other activity</a></div></div><div class="${kind === "home" ? "feed-card" : "col_3"}"><div class="bili-video-card"><a href="https://www.bilibili.com/video/BVnormal">Ordinary result</a></div></div></div>`;
    if (kind === "search") {
      await page.addInitScript(() => {
        window.GM_getValue = (key, fallback) =>
          localStorage.getItem(key) ?? fallback;
        window.GM_setValue = (key, value) => localStorage.setItem(key, value);
        window.GM_addValueChangeListener = () => {};
      });
      await page.route("https://search.bilibili.com/**", (route) =>
        route.fulfill({ contentType: "text/html; charset=utf-8", body }),
      );
      await page.goto("https://search.bilibili.com/all?keyword=synthetic");
    } else await openVideo(page, body, "/");
    await page.addScriptTag({
      path: path.join(__dirname, "..", "main.user.js"),
    });
    await page.getByRole("button", { name: "Bfilter", exact: true }).click();
    await page.getByRole("button", { name: "Types" }).click();
    const option = page.getByRole("checkbox", { name: "Classroom" });
    await expect(option).not.toBeChecked();
    await option.check();
    await expect(
      page.getByText("Classroom result", { exact: true }),
    ).toBeHidden();
    await expect(page.getByText("Mobile classroom")).toBeHidden();
    if (kind === "search")
      await expect(page.getByText("Featured course")).toBeHidden();
    await expect(page.getByText("Other activity")).toBeVisible();
    await expect(page.getByText("Ordinary result")).toBeVisible();
    await page.evaluate(
      (html) =>
        document.querySelector(".feed").insertAdjacentHTML("beforeend", html),
      card("Later course"),
    );
    await expect(page.getByText("Later course")).toBeHidden();
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(
      page.getByText("Classroom result", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Preview" }).click();
    await page.reload();
    await page.addScriptTag({
      path: path.join(__dirname, "..", "main.user.js"),
    });
    await expect(
      page.getByText("Classroom result", { exact: true }),
    ).toBeHidden();
    await page.getByRole("button", { name: "Bfilter", exact: true }).click();
    await page.getByRole("button", { name: "Types" }).click();
    await page.getByRole("checkbox", { name: "Classroom" }).uncheck();
    await expect(
      page.getByText("Classroom result", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Mobile classroom")).toBeVisible();
  });
}

// Hide manga recommendations without hiding unrelated videos
for (const kind of ["home", "search"]) {
  test(`filters manga on ${kind}`, async ({ page }) => {
    const card = (title, url) =>
      `<div class="${kind === "home" ? "feed-card" : "col_3"}"><div class="bili-video-card"><div class="bili-video-card__wrap"><a href="${url}">${title}</a></div></div></div>`;
    const body = `<nav><a href="https://www.bilibili.com/">首页</a></nav><div class="feed">${card("Manga result", "//manga.bilibili.com/detail/mc123")}${card("Ordinary result", "https://www.bilibili.com/video/BVnormal")}</div>`;
    if (kind === "search") {
      await page.addInitScript(() => {
        window.GM_getValue = (key, fallback) =>
          localStorage.getItem(key) ?? fallback;
        window.GM_setValue = (key, value) => localStorage.setItem(key, value);
        window.GM_addValueChangeListener = () => {};
      });
      await page.route("https://search.bilibili.com/**", (route) =>
        route.fulfill({ contentType: "text/html; charset=utf-8", body }),
      );
      await page.goto("https://search.bilibili.com/all?keyword=synthetic");
    } else await openVideo(page, body, "/");
    await page.addScriptTag({
      path: path.join(__dirname, "..", "main.user.js"),
    });
    await page.getByRole("button", { name: "Bfilter", exact: true }).click();
    await page.getByRole("button", { name: "Types" }).click();
    const option = page.getByRole("checkbox", { name: "Manga" });
    await expect(option).not.toBeChecked();
    await option.check();
    await expect(page.getByText("Manga result")).toBeHidden();
    await expect(page.getByText("Ordinary result")).toBeVisible();
    await page.evaluate(
      (html) =>
        document.querySelector(".feed").insertAdjacentHTML("beforeend", html),
      card("Later manga", "https://manga.bilibili.com/detail/mc456"),
    );
    await expect(page.getByText("Later manga")).toBeHidden();
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByText("Manga result")).toBeVisible();
    await page.getByRole("button", { name: "Preview" }).click();
    await page.reload();
    await page.addScriptTag({
      path: path.join(__dirname, "..", "main.user.js"),
    });
    await expect(page.getByText("Manga result")).toBeHidden();
    await page.getByRole("button", { name: "Bfilter", exact: true }).click();
    await page.getByRole("button", { name: "Types" }).click();
    await option.uncheck();
    await expect(page.getByText("Manga result")).toBeVisible();
  });
}

const { test, expect } = require("@playwright/test");
const { card, keys, loadBfilter, settle } = require("./helpers");

test.describe("manager and persistence contracts", () => {
  async function openManager(page) {
    await page.locator("#bfilter-manager-button").click();
    await expect(page.locator("#bfilter-manager-panel")).toBeVisible();
  }

  test("opens, closes, exposes documented tabs, and remembers the active tab", async ({
    page,
  }) => {
    await loadBfilter(page);
    await openManager(page);
    await expect(page.locator(".bfilter-manager-tab")).toHaveCount(6);
    await expect(
      page.locator('[data-tab="blocked-user-uids"]'),
    ).toHaveAttribute("aria-selected", "true");
    await page.locator('[data-tab="settings"]').click();
    await expect(page.locator('[data-tab="settings"]')).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.evaluate(() => localStorage.getItem("bfilter:active-manager-tab")),
    ).resolves.toBe("settings");
    await page.locator(".bfilter-manager-close").click();
    await expect(page.locator("#bfilter-manager-panel")).toBeHidden();
  });

  test("saves normalized lists and immediately rescans matching cards", async ({
    page,
  }) => {
    await loadBfilter(page, {
      html: `<main>${card({ id: "target", title: "spoiler" })}</main>`,
    });
    await openManager(page);
    await page.locator('[data-tab="blocked-user-uids"]').click();
    await page
      .locator("#bfilter-manager-blocked-user-uids-textarea")
      .fill("123 # note\n123\n\n456");
    await page.locator('[data-tab="hide-videos-by-keyword"]').click();
    await page
      .locator("#bfilter-manager-hide-videos-by-keyword-textarea")
      .fill("Spoiler\nspoiler # kept comment");
    await expect(page.locator('[data-action="save"]')).toBeEnabled();
    await page.locator('[data-action="save"]').click();
    await expect(page.locator("#target")).toHaveAttribute(
      "data-bfilter-hidden",
      "true",
    );
    await expect(page.locator('[data-action="save"]')).toBeDisabled();
    await expect(
      page.evaluate(() =>
        localStorage.getItem("bfilter:hide-videos-by-keyword"),
      ),
    ).resolves.toBe("spoiler");
    await expect(
      page.evaluate(() => localStorage.getItem("bfilter:blocked-user-uids")),
    ).resolves.toBe("123 # note\n123\n\n456");
  });

  test("checkbox and threshold settings persist immediately and child type controls stay disabled until enabled", async ({
    page,
  }) => {
    await loadBfilter(page);
    await openManager(page);
    await page.locator('[data-tab="hide-videos-by-keyword"]').click();
    const typeSelect = page.locator("[data-hide-videos-by-type]");
    await expect(typeSelect).toBeDisabled();
    await page.locator("#bfilter-manager-hide-videos-by-type").check();
    await expect(typeSelect).toBeEnabled();
    await page.locator("#bfilter-manager-hide-videos-by-duration").check();
    await page
      .locator("#bfilter-manager-hide-videos-by-duration-threshold")
      .selectOption({ label: "< 5 min" });
    await expect(
      page.evaluate(() =>
        localStorage.getItem("bfilter:hide-videos-by-duration"),
      ),
    ).resolves.toBe("true");
    await expect(
      page.evaluate(() =>
        localStorage.getItem("bfilter:hide-videos-by-duration-threshold"),
      ),
    ).resolves.toBe("< 5 min");
  });

  test("sort confirmation cancel preserves text and confirmation removes duplicates and empties", async ({
    page,
  }) => {
    await loadBfilter(page);
    await openManager(page);
    const area = page.locator("#bfilter-manager-blocked-user-uids-textarea");
    await area.fill("20 # second\n\n10 # first\n10 # duplicate");
    await page.evaluate(() => {
      window.confirm = () => false;
    });
    await page.locator('[data-action="sort"]').click();
    await expect(area).toHaveValue("20 # second\n\n10 # first\n10 # duplicate");
    await page.evaluate(() => {
      window.confirm = () => true;
    });
    await page.locator('[data-action="sort"]').click();
    await expect(area).toHaveValue("10 # first\n20 # second");
    await expect(
      page.evaluate(() => localStorage.getItem("bfilter:blocked-user-uids")),
    ).resolves.toBe("10 # first\n20 # second");
  });

  test("Following Go opens the selected UID upload page", async ({ page }) => {
    await loadBfilter(page, { storage: { [keys.followed]: "123 # user" } });
    await openManager(page);
    await page.locator('[data-tab="followed-user-uids"]').click();
    await page
      .locator("#bfilter-manager-followed-user-uids-textarea")
      .evaluate((textarea) => {
        textarea.focus();
        textarea.setSelectionRange(0, 3);
      });
    await page.evaluate(() => {
      window.open = (url) => {
        window.__opened = url;
      };
    });
    await page.locator('[data-action="go-followed-user-uids"]').click();
    await expect(page.evaluate(() => window.__opened)).resolves.toBe(
      "https://space.bilibili.com/123/upload",
    );
  });

  test("statistics count unique observed and filtered items and reset after setting changes", async ({
    page,
  }) => {
    await loadBfilter(page, {
      storage: { [keys.videos]: "hide" },
      html: `<main>${card({ id: "hidden", title: "hide" })}${card({ id: "shown", title: "shown" })}</main>`,
    });
    await openManager(page);
    await page.locator('[data-tab="settings"]').click();
    await expect(
      page.locator('[data-statistic="videos"] [data-statistic-value]'),
    ).toHaveText("1 (50%)");
    await page.locator("#bfilter-manager-hide-videos-by-keyword").count();
    await page.locator('[data-tab="hide-videos-by-keyword"]').click();
    await page
      .locator("#bfilter-manager-hide-videos-by-keyword-textarea")
      .fill("");
    await page.locator('[data-action="save"]').click();
    await page.locator('[data-tab="settings"]').click();
    await expect(
      page.locator('[data-statistic="videos"] [data-statistic-value]'),
    ).toHaveText("0 (0%)");
  });

  test("statistics overlay remains after manager closes and close persists the preference", async ({
    page,
  }) => {
    await loadBfilter(page);
    await openManager(page);
    await page.locator('[data-tab="settings"]').click();
    await page.locator("[data-show-statistics-overlay]").check({ force: true });
    await expect(page.locator("#bfilter-statistics-overlay")).toBeVisible();
    await page.locator(".bfilter-manager-close").click();
    await expect(page.locator("#bfilter-statistics-overlay")).toBeVisible();
    await page.locator('[data-action="close-statistics-overlay"]').click();
    await expect(page.locator("#bfilter-statistics-overlay")).toHaveCount(0);
    await expect(
      page.evaluate(() =>
        localStorage.getItem("bfilter:show-statistics-overlay"),
      ),
    ).resolves.toBe("false");
  });

  test("unified mode shows one independent Keywords list and disables separate editors", async ({
    page,
  }) => {
    await loadBfilter(page);
    await openManager(page);
    await page.locator('[data-tab="settings"]').click();
    await page
      .locator("#bfilter-manager-unified-keywords-mode")
      .check({ force: true });
    await expect(page.locator('[data-tab="unified-keywords"]')).toBeVisible();
    for (const id of [
      "hide-videos-by-keyword",
      "hide-comments-by-keyword",
      "hide-danmakus-by-keyword",
    ])
      await expect(
        page.locator(`#bfilter-manager-${id}-textarea`),
      ).toBeDisabled();
    await page.locator('[data-tab="unified-keywords"]').click();
    await page
      .locator("#bfilter-manager-unified-keywords-textarea")
      .fill("one");
    await page.locator('[data-action="save"]').click();
    await expect(
      page.evaluate(() => localStorage.getItem("bfilter:unified-keywords")),
    ).resolves.toBe("one");
    await page.locator('[data-tab="settings"]').click();
    await page
      .locator("#bfilter-manager-unified-keywords-mode")
      .uncheck({ force: true });
    await expect(page.locator('[data-tab="unified-keywords"]')).toHaveCount(0);
    await expect(
      page.locator("#bfilter-manager-hide-videos-by-keyword-textarea"),
    ).toBeEnabled();
  });

  test("reset cancel leaves data intact and confirmed reset restores defaults", async ({
    page,
  }) => {
    await loadBfilter(page, {
      storage: {
        [keys.blocked]: "123",
        [keys.videos]: "hide",
        "bfilter:preview-mode": "true",
      },
    });
    await openManager(page);
    await page.locator('[data-tab="settings"]').click();
    await page.evaluate(() => {
      window.confirm = () => false;
    });
    await page.locator('[data-action="reset"]').click();
    await expect(
      page.evaluate(() => localStorage.getItem("bfilter:blocked-user-uids")),
    ).resolves.toBe("123");
    await page.evaluate(() => {
      window.confirm = () => true;
    });
    await page.locator('[data-action="reset"]').click();
    await expect(
      page.evaluate(() => localStorage.getItem("bfilter:blocked-user-uids")),
    ).resolves.toBe("");
    await expect(
      page.evaluate(() => localStorage.getItem("bfilter:preview-mode")),
    ).resolves.toBe("false");
  });

  test("exports a JSON backup with all lists and settings", async ({
    page,
  }) => {
    await loadBfilter(page, {
      storage: {
        [keys.blocked]: "123",
        [keys.unified]: "word",
        [keys.unifiedMode]: "true",
      },
    });
    await openManager(page);
    await page.locator('[data-tab="settings"]').click();
    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-action="export"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^bfilter-backup-\d{4}-\d{2}-\d{2}\.json$/,
    );
    const content = await require("fs").promises.readFile(
      await download.path(),
      "utf8",
    );
    const data = JSON.parse(content);
    expect(data.app).toBe("Bfilter");
    expect(data.lists).toMatchObject({
      blockedUserUids: "123",
      unifiedKeywords: "word",
    });
    expect(data.settings.unifiedKeywordsMode).toBe(true);
  });

  test("GM storage listeners refresh remote values and ignore local notifications", async ({
    page,
  }) => {
    await loadBfilter(page, {
      gm: true,
      html: `<main>${card({ id: "target", title: "remote" })}</main>`,
    });
    await page.evaluate(() =>
      window.__gmSetRemote("bfilter:hide-videos-by-keyword", "remote", false),
    );
    await expect(page.locator("#target")).not.toHaveAttribute(
      "data-bfilter-hidden",
    );
    await page.evaluate(() =>
      window.__gmSetRemote("bfilter:hide-videos-by-keyword", "remote", true),
    );
    await expect(page.locator("#target")).toHaveAttribute(
      "data-bfilter-hidden",
      "true",
    );
  });

  test("imports valid JSON after confirmation and rejects malformed JSON without partial replacement", async ({
    page,
  }) => {
    await loadBfilter(page, { storage: { [keys.blocked]: "123" } });
    await openManager(page);
    await page.locator('[data-tab="settings"]').click();
    await page.evaluate(() => {
      window.confirm = () => true;
      window.__alerts = [];
      window.alert = (message) => window.__alerts.push(message);
    });
    const input = page.locator(".bfilter-manager-import-input");
    await input.setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          app: "Bfilter",
          lists: {
            blockedUserUids: "456",
            followedUserUids: "",
            hideVideosByKeyword: "",
            hideCommentsByKeyword: "",
            hideDanmakusByKeyword: "",
            unifiedKeywords: "",
          },
          settings: {},
        }),
      ),
    });
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("bfilter:blocked-user-uids")),
      )
      .toBe("456");
    await expect
      .poll(() => page.evaluate(() => window.__alerts))
      .toContain("Bfilter data and settings imported.");
    await input.setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{not valid"),
    });
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("bfilter:blocked-user-uids")),
      )
      .toBe("456");
    await expect
      .poll(() => page.evaluate(() => window.__alerts))
      .toContain("Import failed. Select a valid Bfilter JSON export file.");
  });
});

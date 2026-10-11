const { test, expect } = require("@playwright/test");
const { card, keys, loadBfilter, settle } = require("./helpers");

test.describe("manager and persistence contracts", () => {
  async function openManager(page) {
    await page.locator("#bfilter-manager-button").click();
    await expect(page.locator("#bfilter-manager-panel")).toBeVisible();
  }

  for (const unifiedMode of [false, true]) {
    for (const viewportWidth of [1280, 420]) {
      test(`Manager minimum dimensions and bottom layout hold across tabs at ${viewportWidth}px with unified mode ${unifiedMode}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewportWidth, height: 800 });
        await loadBfilter(page, {
          storage: { [keys.unifiedMode]: String(unifiedMode) },
        });
        await openManager(page);
        const panel = page.locator("#bfilter-manager-panel");
        const tabs = page.locator(".bfilter-manager-tab");
        await expect(tabs).toHaveCount(unifiedMode ? 7 : 6);
        for (let index = 0; index < (await tabs.count()); index += 1) {
          await tabs.nth(index).click();
          const bounds = await panel.boundingBox();
          expect(bounds.width).toBe(Math.min(450, viewportWidth - 48));
          expect(bounds.height).toBeGreaterThanOrEqual(600);
          if (viewportWidth === 1280) expect(bounds.height).toBe(600);
          await expect(panel).toHaveCSS("min-height", "600px");
          const footer = await panel
            .locator(".bfilter-manager-actions")
            .boundingBox();
          expect(
            bounds.y + bounds.height - footer.y - footer.height,
          ).toBeCloseTo(17, 0);
          const editor = panel.locator(
            "[data-tab-panel]:not([hidden]) textarea",
          );
          if (await editor.count()) {
            const editorBounds = await editor.boundingBox();
            const help = await panel
              .locator("[data-tab-panel]:not([hidden]) .bfilter-manager-help")
              .boundingBox();
            expect(editorBounds.height).toBeGreaterThan(160);
            expect(
              help.y - editorBounds.y - editorBounds.height,
            ).toBeCloseTo(8, 0);
            expect(footer.y - help.y - help.height).toBeCloseTo(12, 0);
          }
        }
      });
    }
  }

  test("Manager grows beyond its minimum dimensions for oversized content", async ({
    page,
  }) => {
    await loadBfilter(page);
    await openManager(page);
    await page
      .locator("#bfilter-manager-blocked-user-uids-textarea")
      .evaluate((textarea) => {
        textarea.style.height = "900px";
      });
    const panel = page.locator("#bfilter-manager-panel");
    const bounds = await panel.boundingBox();
    expect(bounds.width).toBe(450);
    expect(bounds.height).toBeGreaterThan(900);
    const footer = await panel
      .locator(".bfilter-manager-actions")
      .boundingBox();
    expect(
      bounds.y + bounds.height - footer.y - footer.height,
    ).toBeCloseTo(17, 0);
    await expect(panel).toHaveCSS("min-height", "600px");
    await page
      .locator("#bfilter-manager-blocked-user-uids-textarea")
      .evaluate((textarea) => {
        textarea.style.height = "160px";
      });
    expect((await panel.boundingBox()).height).toBe(600);
  });

  for (const viewportWidth of [1280, 420]) {
    test(`textarea resize keeps the footer below the editor at ${viewportWidth}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewportWidth, height: 1000 });
      await loadBfilter(page);
      await openManager(page);
      const editor = page.locator(
        "#bfilter-manager-blocked-user-uids-textarea",
      );
      const before = await editor.boundingBox();
      const x = before.x + before.width - 3;
      const y = before.y + before.height - 3;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + 60, { steps: 5 });
      await page.mouse.up();
      const after = await editor.boundingBox();
      expect(after.height).toBeGreaterThan(before.height + 50);
      const panel = page.locator("#bfilter-manager-panel");
      const bounds = await panel.boundingBox();
      const footer = await panel
        .locator(".bfilter-manager-actions")
        .boundingBox();
      expect(bounds.height).toBeGreaterThan(650);
      expect(footer.y).toBeGreaterThan(after.y + after.height);
      expect(
        bounds.y + bounds.height - footer.y - footer.height,
      ).toBeCloseTo(17, 0);
    });
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

  for (const username of ["xxx", "用户 名&?+#/%❤️", "  username  "]) {
    test(`Following Go searches the selected username ${JSON.stringify(username)}`, async ({
      page,
    }) => {
      const entry = `123 # ${username}`;
      await loadBfilter(page, { storage: { [keys.followed]: entry } });
      await openManager(page);
      const go = page.locator('[data-action="go-followed-user-uids"]');
      await expect(go).toBeHidden();
      await page.locator('[data-tab="followed-user-uids"]').click();
      await expect(go).toBeVisible();
      await expect(go).toHaveAttribute("title", "Search selected username");
      await page
        .locator("#bfilter-manager-followed-user-uids-textarea")
        .evaluate((textarea) => {
          textarea.focus();
          textarea.setSelectionRange("123 # ".length, textarea.value.length);
        });
      await page.evaluate(() => {
        window.open = (url, target) => {
          window.__opened = { url, target };
        };
      });
      await go.click();
      await expect(page.evaluate(() => window.__opened)).resolves.toEqual({
        url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(username.trim())}`,
        target: "_blank",
      });
      await expect(
        page.evaluate(() => localStorage.getItem("bfilter:followed-user-uids")),
      ).resolves.toBe(entry);
      await page.locator('[data-tab="settings"]').click();
      await expect(go).toBeHidden();
    });
  }

  for (const selection of ["", "   "]) {
    test(`Following Go rejects an empty username selection ${JSON.stringify(selection)}`, async ({
      page,
    }) => {
      await loadBfilter(page, {
        storage: { [keys.followed]: `123 # ${selection}` },
      });
      await openManager(page);
      await page.locator('[data-tab="followed-user-uids"]').click();
      await page
        .locator("#bfilter-manager-followed-user-uids-textarea")
        .evaluate((textarea) => {
          textarea.focus();
          textarea.setSelectionRange("123 # ".length, textarea.value.length);
        });
      await page.evaluate(() => {
        window.open = () => {
          window.__opened = true;
        };
        window.alert = (message) => {
          window.__alert = message;
        };
      });
      await page.locator('[data-action="go-followed-user-uids"]').click();
      await expect(
        page.evaluate(() => window.__opened),
      ).resolves.toBeUndefined();
      await expect(page.evaluate(() => window.__alert)).resolves.toContain(
        "Select a username",
      );
    });
  }

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

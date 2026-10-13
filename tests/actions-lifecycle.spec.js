const { test, expect } = require("@playwright/test");
const {
  append,
  card,
  comment,
  danmaku,
  keys,
  loadBfilter,
  settle,
  setStorage,
} = require("./helpers");

test.describe("actions, guards, and lifecycle contracts", () => {
  test("user-space actions toggle follow and block, preserve username comments, and disable conflicting block", async ({
    page,
  }) => {
    await loadBfilter(page, {
      url: "https://space.bilibili.com/123/",
      html: '<main><div class="nickname">Alice</div><div class="nav-statistics"></div></main>',
    });
    await expect(page.locator("#bfilter-follow-button")).toHaveText("FOLLOW");
    await expect(page.locator("#bfilter-block-button")).toHaveText("BLOCK");
    await page.locator("#bfilter-follow-button").click({ force: true });
    await expect(page.locator("#bfilter-follow-button")).toHaveText(
      "FOLLOWING",
    );
    await expect(page.locator("#bfilter-block-button")).toBeDisabled();
    await expect(
      page.evaluate(() => localStorage.getItem("bfilter:followed-user-uids")),
    ).resolves.toBe("123 # Alice");
    await page.locator("#bfilter-follow-button").click({ force: true });
    await page.locator("#bfilter-block-button").click({ force: true });
    await expect(page.locator("#bfilter-block-button")).toHaveText("BLOCKED");
    await page.locator("#bfilter-block-button").click({ force: true });
    await expect(page.locator("#bfilter-block-button")).toHaveText("BLOCK");
  });

  test("registration hint appears on an eligible user-space profile without scanning its content", async ({
    page,
  }) => {
    await loadBfilter(page, {
      url: "https://space.bilibili.com/123456789012345/",
      storage: { "bfilter:hide-users-by-registration-time": "true" },
      html: `<main><div class="nickname">New User</div><div class="nav-statistics"></div>${card({ id: "space-card", uid: "123456789012345" })}${comment({ id: "space-comment", uid: "123456789012345" })}</main>`,
    });
    await expect(page.locator("#bfilter-block-button")).toContainText(
      "Already hidden by registration time",
    );
    await expect(page.locator("#space-card")).not.toHaveAttribute(
      "data-bfilter-hidden",
    );
    await expect(page.locator("#space-comment")).not.toHaveAttribute(
      "data-bfilter-hidden",
    );
    await expect(page.locator("[data-statistic-value]")).toHaveCount(3);
    await expect(page.locator("[data-statistic-value]").first()).toHaveText(
      "0 (0%)",
    );
  });

  for (const url of [
    "https://www.bilibili.com/video/BV1",
    "https://www.bilibili.com/opus/1",
    "https://t.bilibili.com/1",
  ]) {
    test(`per-comment block controls work on ${new URL(url).pathname.split("/")[1]} pages`, async ({
      page,
    }) => {
      await loadBfilter(page, {
        url,
        html: `<main>${comment({ id: "comment", uid: "123" })}</main>`,
      });
      await expect(
        page.locator("#comment .bfilter-comment-block-button"),
      ).toHaveText("Block");
      await page.locator("#comment .bfilter-comment-block-button").click();
      await expect(page.locator("#comment")).toHaveAttribute(
        "data-bfilter-hidden",
        "true",
      );
      await expect(
        page.evaluate(() => localStorage.getItem("bfilter:blocked-user-uids")),
      ).resolves.toBe("123");
      await expect(
        page.locator("#comment .bfilter-comment-block-button"),
      ).toBeHidden();
      // Clearing the list through the public storage event makes the control eligible again.
      await setStorage(page, { [keys.blocked]: "" });
      await expect(
        page.locator("#comment .bfilter-comment-block-button"),
      ).toHaveText("Block");
    });
  }

  for (const url of [
    "https://www.bilibili.com/video/BV1",
    "https://www.bilibili.com/opus/1",
    "https://t.bilibili.com/1",
  ]) {
    test(`Preview gives a blocked top-level comment its own control on ${new URL(url).hostname}${new URL(url).pathname}`, async ({
      page,
    }) => {
      const replies = ["222", "333"]
        .map((uid) =>
          comment({ id: `reply-${uid}`, uid })
            .replace('class="reply-item"', 'class="sub-reply-item"')
            .replace('class="user-info"', 'class="sub-user-info"')
            .replace('class="user-name"', 'class="sub-user-name"'),
        )
        .join("");
      await loadBfilter(page, {
        url,
        storage: { [keys.blocked]: "111" },
        html: `<main>${comment({ id: "parent", uid: "111", extra: replies })}</main>`,
      });
      const parentButton = page.locator(
        "#parent > .user-info > .bfilter-comment-block-button",
      );
      await expect(page.locator("#parent")).toHaveAttribute(
        "data-bfilter-hidden",
        "true",
      );
      await expect(parentButton).toHaveCount(0);
      await expect(page.locator(".bfilter-comment-block-button")).toHaveCount(
        2,
      );
      await page.locator("#bfilter-manager-button").click();
      await page
        .locator("#bfilter-manager-preview-mode")
        .check({ force: true });
      await expect(page.locator("#parent")).toHaveAttribute(
        "data-bfilter-previewed",
        "true",
      );
      await expect(parentButton).toHaveCount(1);
      await expect(parentButton).toBeVisible();
      await expect(parentButton).toHaveText("Unblock");
      await expect(parentButton).toHaveAttribute("data-uid", "111");
      for (const uid of ["222", "333"]) {
        const button = page.locator(
          `#reply-${uid} .bfilter-comment-block-button`,
        );
        await expect(button).toHaveCount(1);
        await expect(button).toHaveText("Block");
        await expect(button).toHaveAttribute("data-uid", uid);
      }
      await page.locator("#reply-222 .bfilter-comment-block-button").click();
      await expect(
        page.evaluate(() => localStorage.getItem("bfilter:blocked-user-uids")),
      ).resolves.toBe("111\n222");
      await expect(parentButton).toHaveText("Unblock");
      await parentButton.click();
      await expect(
        page.evaluate(() => localStorage.getItem("bfilter:blocked-user-uids")),
      ).resolves.toBe("222");
      await expect(parentButton).toHaveText("Block");
      await expect(page.locator("#parent")).not.toHaveAttribute(
        "data-bfilter-previewed",
      );
      await expect(page.locator("#reply-222")).toHaveAttribute(
        "data-bfilter-previewed",
        "true",
      );
      await expect(
        page.locator("#reply-222 .bfilter-comment-block-button"),
      ).toHaveText("Unblock");
      await expect(page.locator(".bfilter-comment-block-button")).toHaveCount(
        3,
      );
    });
  }

  test("unchanged comment Block and Unblock labels do not generate DOM mutations", async ({
    page,
  }) => {
    await loadBfilter(page, {
      url: "https://www.bilibili.com/video/BV1",
      storage: { [keys.preview]: "true" },
      html: `<main>${comment({ id: "comment", uid: "123" })}</main>`,
    });

    for (const blocked of [false, true]) {
      await setStorage(page, { [keys.blocked]: blocked ? "123" : "" });
      const result = await page.evaluate(async () => {
        const button = document.querySelector(
          "#comment .bfilter-comment-block-button",
        );
        const textNode = button.firstChild;
        let mutations = 0;
        const observer = new MutationObserver((records) => {
          mutations += records.length;
        });
        observer.observe(button, {
          childList: true,
          characterData: true,
          subtree: true,
        });
        // Trigger a scan, then allow any self-triggered scans to run too.
        document.body.appendChild(document.createElement("div"));
        for (let frame = 0; frame < 3; frame += 1)
          await new Promise(requestAnimationFrame);
        observer.disconnect();
        return {
          mutations,
          sameTextNode: button.firstChild === textNode,
          label: button.textContent,
        };
      });
      expect(result.label).toBe(blocked ? "Unblock" : "Block");
      expect(result.mutations).toBe(0);
      expect(result.sameTextNode).toBe(true);
    }
  });

  test("comment controls use their own author even when a nested reply appears first", async ({
    page,
  }) => {
    const nested = comment({ id: "nested", uid: "222" }).replace(
      'class="reply-item"',
      'class="sub-reply-item"',
    );
    await loadBfilter(page, {
      url: "https://www.bilibili.com/video/BV1",
      storage: { [keys.blocked]: "111", [keys.preview]: "true" },
      html: `<main><article class="reply-item" id="parent">
        ${nested}
        <div class="user-info"><a class="user-name" href="https://space.bilibili.com/111">Parent</a></div>
        <div class="reply-content">ordinary</div>
      </article></main>`,
    });
    const parentButton = page.locator(
      "#parent > .user-info > .bfilter-comment-block-button",
    );
    const nestedButton = page.locator("#nested .bfilter-comment-block-button");
    await expect(parentButton).toHaveText("Unblock");
    await expect(parentButton).toHaveAttribute("data-uid", "111");
    await expect(nestedButton).toHaveText("Block");
    await expect(nestedButton).toHaveAttribute("data-uid", "222");
    await page.locator("#nested .user-name").evaluate((link) => {
      link.href = "https://space.bilibili.com/444";
    });
    await settle(page);
    await expect(parentButton).toHaveAttribute("data-uid", "111");
    await expect(nestedButton).toHaveAttribute("data-uid", "444");
    await expect(page.locator(".bfilter-comment-block-button")).toHaveCount(2);
    await nestedButton.click();
    await expect(
      page.evaluate(() => localStorage.getItem("bfilter:blocked-user-uids")),
    ).resolves.toBe("111\n444");
  });

  test("bulk commenter action honors confirmation and only includes currently loaded comments", async ({
    page,
  }) => {
    await loadBfilter(page, {
      url: "https://www.bilibili.com/video/BV1",
      storage: { [keys.blocked]: "" },
      html: `<main><div class="reply-header"><div class="nav-bar"></div></div>${comment({ id: "one", uid: "111" })}${comment({ id: "two", uid: "222" })}</main>`,
    });
    await expect(
      page.locator(".bfilter-block-all-commenters-button"),
    ).toHaveCount(1);
    await page.evaluate(() => {
      window.confirm = () => false;
    });
    await page.locator(".bfilter-block-all-commenters-button").click();
    await expect(
      page.evaluate(() => localStorage.getItem("bfilter:blocked-user-uids")),
    ).resolves.toBe("");
    await page.evaluate(() => {
      window.confirm = () => true;
    });
    await page.locator(".bfilter-block-all-commenters-button").click();
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("bfilter:blocked-user-uids")),
      )
      .toBe("111\n222");
  });

  test("mutation scanning handles lazy cards, changed titles, comments, and danmakus", async ({
    page,
  }) => {
    await loadBfilter(page, {
      url: "https://www.bilibili.com/video/BV1",
      storage: {
        [keys.videos]: "late",
        [keys.comments]: "late",
        [keys.danmakus]: "late",
      },
    });
    await append(
      page,
      card({ id: "late-card", title: "late video" }) +
        comment({ id: "late-comment", text: "late comment" }) +
        danmaku({ id: "late-dm", text: "late dm" }),
    );
    for (const id of ["late-card", "late-comment", "late-dm"])
      await expect(page.locator(`#${id}`)).toHaveAttribute(
        "data-bfilter-hidden",
        "true",
      );
    await page
      .locator("#late-card .bili-video-card__info--tit")
      .evaluate((node) => {
        node.textContent = "ordinary";
      });
    await settle(page);
    await expect(page.locator("#late-card")).not.toHaveAttribute(
      "data-bfilter-hidden",
    );
  });

  test("storage events refresh consequences and settings", async ({ page }) => {
    await loadBfilter(page, {
      html: `<main>${card({ id: "target", title: "ordinary" })}</main>`,
    });
    await setStorage(page, { [keys.videos]: "ordinary" });
    await expect(page.locator("#target")).toHaveAttribute(
      "data-bfilter-hidden",
      "true",
    );
    await setStorage(page, { [keys.videos]: "" });
    await expect(page.locator("#target")).not.toHaveAttribute(
      "data-bfilter-hidden",
    );
  });

  test("direct-video owner is protected while recommendation cards remain filterable", async ({
    page,
  }) => {
    await loadBfilter(page, {
      url: "https://www.bilibili.com/video/BV1",
      storage: { [keys.blocked]: "123" },
      html: `<main><div class="up-info"><a class="up-name" href="https://space.bilibili.com/123">Owner</a></div>${card({ id: "primary", uid: "123" })}<div class="recommend-list">${card({ id: "recommendation", uid: "123" })}</div></main>`,
    });
    await expect(page.locator("#primary")).not.toHaveAttribute(
      "data-bfilter-hidden",
    );
    await expect(page.locator("#recommendation")).toHaveAttribute(
      "data-bfilter-hidden",
      "true",
    );
  });

  test("safety guards reject unsafe multi-video and protected search targets", async ({
    page,
  }) => {
    await loadBfilter(page, {
      url: "https://search.bilibili.com/all",
      storage: { [keys.blocked]: "123" },
      html: `<main><article class="bili-video-card" id="multi"><a href="https://space.bilibili.com/123">user</a><a href="/video/A">A</a><a href="/video/B">B</a></article><article class="bili-video-card b-user-video-card" id="protected"><a href="https://space.bilibili.com/123">user</a><a href="/video/C">C</a></article></main>`,
    });
    await expect(page.locator("#multi")).not.toHaveAttribute(
      "data-bfilter-hidden",
    );
    await expect(page.locator("#protected")).not.toHaveAttribute(
      "data-bfilter-hidden",
    );
  });

  test("SPA history navigation replaces page chrome and scans the new route", async ({
    page,
  }) => {
    await loadBfilter(page, {
      storage: { [keys.blocked]: "123" },
      html: `<main>${card({ id: "old", uid: "123" })}</main>`,
    });
    await expect(page.locator("#old")).toHaveAttribute(
      "data-bfilter-hidden",
      "true",
    );
    await page.evaluate(() => {
      history.pushState({}, "", "/video/BV2");
      document.body.innerHTML =
        '<main><div class="reply-item" id="new"><a class="user-name" href="https://space.bilibili.com/123">123</a><div class="reply-content">new</div></div></main>';
    });
    await page.dispatchEvent("body", "popstate");
    await settle(page);
    await expect(page.locator("#new")).toHaveAttribute(
      "data-bfilter-hidden",
      "true",
    );
    await expect(page.locator("#bfilter-manager-button")).toHaveCount(1);
  });

  for (const url of [
    "https://www.bilibili.com/v/popular/rank",
    "https://search.bilibili.com/all",
  ]) {
    test(`renders manager chrome on supported route ${new URL(url).hostname}${new URL(url).pathname}`, async ({
      page,
    }) => {
      await loadBfilter(page, { url });
      await expect(page.locator("#bfilter-manager-button")).toHaveCount(1);
      await expect(page.locator("#bfilter-style")).toHaveCount(1);
    });
  }

  test("style installation is idempotent and unsupported routes have no manager", async ({
    page,
  }) => {
    await loadBfilter(page);
    await expect(page.locator("#bfilter-style")).toHaveCount(1);
    await page.evaluate(() =>
      document.dispatchEvent(new Event("DOMContentLoaded")),
    );
    await expect(page.locator("#bfilter-style")).toHaveCount(1);
    await loadBfilter(page, {
      url: "https://example.com/",
      html: "<main>unsupported</main>",
    });
    await expect(page.locator("#bfilter-manager-button")).toHaveCount(0);
    await expect(page.locator("#bfilter-style")).toHaveCount(1);
  });
});

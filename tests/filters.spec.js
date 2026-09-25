const { test, expect } = require("@playwright/test");
const {
  card,
  comment,
  danmaku,
  keys,
  loadBfilter,
  settle,
} = require("./helpers");

test.describe("filtering contracts", () => {
  test("hides blocked cards and comments but leaves unmatched content visible", async ({
    page,
  }) => {
    await loadBfilter(page, {
      storage: { [keys.blocked]: "123" },
      html: `<main>${card({ id: "blocked", uid: "123" })}${card({ id: "kept" })}${comment({ id: "blocked-comment", uid: "123" })}${comment({ id: "kept-comment" })}</main>`,
    });
    await expect(page.locator("#blocked")).toHaveAttribute(
      "data-bfilter-hidden",
      "true",
    );
    await expect(page.locator("#blocked")).toHaveCSS("display", "none");
    await expect(page.locator("#kept")).not.toHaveAttribute(
      "data-bfilter-hidden",
    );
    await expect(page.locator("#blocked-comment")).toHaveAttribute(
      "data-bfilter-hidden",
      "true",
    );
    await expect(page.locator("#kept-comment")).not.toHaveAttribute(
      "data-bfilter-hidden",
    );
  });

  test("followed users win over blocked and keyword rules for cards and comments", async ({
    page,
  }) => {
    await loadBfilter(page, {
      storage: {
        [keys.blocked]: "123",
        [keys.followed]: "123",
        [keys.videos]: "spoiler",
        [keys.comments]: "spoiler",
      },
      html: `<main>${card({ id: "followed-card", uid: "123", title: "spoiler" })}${comment({ id: "followed-comment", uid: "123", text: "spoiler" })}</main>`,
    });
    for (const id of ["followed-card", "followed-comment"]) {
      await expect(page.locator(`#${id}`)).toHaveAttribute(
        "data-bfilter-followed-user-uid",
        "true",
      );
      await expect(page.locator(`#${id}`)).not.toHaveAttribute(
        "data-bfilter-hidden",
      );
    }
  });

  test("extracts numeric UIDs from href and supported UID attributes only", async ({
    page,
  }) => {
    const variants = [
      '<a href="https://space.bilibili.com/123">user</a>',
      '<span data-usercard-mid="123">user</span>',
      '<span data-mid="123">user</span>',
      '<span mid="123">user</span>',
    ];
    const html =
      variants
        .map(
          (uploader, i) =>
            `<article class="bili-video-card" id="uid-${i}">${uploader}<a href="/video/BV${i}">title</a></article>`,
        )
        .join("") +
      `<article class="bili-video-card" id="malformed"><span data-mid="abc">user</span><a href="/video/BVbad">title</a></article>`;
    await loadBfilter(page, {
      storage: { [keys.blocked]: "123" },
      html: `<main>${html}</main>`,
    });
    for (let i = 0; i < variants.length; i++)
      await expect(page.locator(`#uid-${i}`)).toHaveAttribute(
        "data-bfilter-hidden",
        "true",
      );
    await expect(page.locator("#malformed")).not.toHaveAttribute(
      "data-bfilter-hidden",
    );
  });

  for (const [label, at, below] of [
    ["> 2015", 8, 7],
    ["> 2017", 9, 8],
    ["> 2020", 10, 9],
    ["> 2022", 15, 14],
  ]) {
    test(`registration filter uses the ${label} UID digit boundary`, async ({
      page,
    }) => {
      const eligible = "9".repeat(at);
      const ineligible = "8".repeat(below);
      await loadBfilter(page, {
        storage: {
          "bfilter:hide-users-by-registration-time": "true",
          "bfilter:hide-users-by-registration-time-threshold": label,
        },
        html: `<main>${card({ id: "eligible", uid: eligible })}${card({ id: "ineligible", uid: ineligible })}${comment({ id: "eligible-comment", uid: eligible })}</main>`,
      });
      await expect(page.locator("#eligible")).toHaveAttribute(
        "data-bfilter-hidden",
        "true",
      );
      await expect(page.locator("#eligible-comment")).toHaveAttribute(
        "data-bfilter-hidden",
        "true",
      );
      await expect(page.locator("#ineligible")).not.toHaveAttribute(
        "data-bfilter-hidden",
      );
    });
  }

  test("video keyword matching is case-insensitive, substring based, and normalizes emoji variants", async ({
    page,
  }) => {
    await loadBfilter(page, {
      storage: { [keys.videos]: "Spoiler\n❤️ # note\nspoiler" },
      html: `<main>${card({ id: "mixed", title: "A SPOILER title" })}${card({ id: "emoji", title: "heart ❤️" })}${card({ id: "kept", title: "ordinary" })}</main>`,
    });
    await expect(page.locator("#mixed")).toHaveAttribute(
      "data-bfilter-hidden",
      "true",
    );
    await expect(page.locator("#emoji")).toHaveAttribute(
      "data-bfilter-hidden",
      "true",
    );
    await expect(page.locator("#kept")).not.toHaveAttribute(
      "data-bfilter-hidden",
    );
  });

  test("duration filter is strict, accepts long durations, and ignores zero or malformed values", async ({
    page,
  }) => {
    await loadBfilter(page, {
      storage: {
        "bfilter:hide-videos-by-duration": "true",
        "bfilter:hide-videos-by-duration-threshold": "< 3 min",
      },
      html: `<main>${card({ id: "short", extra: '<span class="duration">02:59</span>' })}${card({ id: "boundary", extra: '<span class="duration">03:00</span>' })}${card({ id: "long", extra: '<span class="duration">01:02:30</span>' })}${card({ id: "zero", extra: '<span class="duration">00:00</span>' })}${card({ id: "bad", extra: '<span class="duration">unknown</span>' })}</main>`,
    });
    await expect(page.locator("#short")).toHaveAttribute(
      "data-bfilter-hidden",
      "true",
    );
    for (const id of ["boundary", "long", "zero", "bad"])
      await expect(page.locator(`#${id}`)).not.toHaveAttribute(
        "data-bfilter-hidden",
      );
  });

  test("views filter parses units and prefers the dedicated first stat", async ({
    page,
  }) => {
    await loadBfilter(page, {
      storage: {
        "bfilter:hide-videos-by-views": "true",
        "bfilter:hide-videos-by-views-threshold": "< 10k",
      },
      html: `<main>${card({ id: "low", extra: '<div class="bili-video-card__stats--left"><span class="bili-video-card__stats--item">999</span></div>' })}${card({ id: "unit", extra: '<div class="bili-video-card__stats--left"><span class="bili-video-card__stats--item">1.2万</span></div>' })}${card({ id: "high", extra: '<div class="bili-video-card__stats--left"><span class="bili-video-card__stats--item">1亿</span></div>' })}${card({ id: "dedicated", extra: '<div class="bili-video-card__stats--left"><span class="bili-video-card__stats--item">2万</span></div><span class="views">1</span>' })}</main>`,
    });
    await expect(page.locator("#low")).toHaveAttribute(
      "data-bfilter-hidden",
      "true",
    );
    await expect(page.locator("#unit")).not.toHaveAttribute(
      "data-bfilter-hidden",
    );
    await expect(page.locator("#high")).not.toHaveAttribute(
      "data-bfilter-hidden",
    );
    await expect(page.locator("#dedicated")).not.toHaveAttribute(
      "data-bfilter-hidden",
    );
  });

  for (const [name, href] of [
    ["live", "https://live.bilibili.com/1"],
    ["manga", "https://manga.bilibili.com/1"],
    ["course", "https://www.bilibili.com/cheese/1"],
    ["bangumi", "https://www.bilibili.com/bangumi/play/1"],
  ]) {
    test(`type filter recognizes ${name} links`, async ({ page }) => {
      await loadBfilter(page, {
        storage: {
          "bfilter:hide-videos-by-type": "true",
          [`bfilter:hide-videos-by-type-${name}`]: "true",
        },
        html: `<main>${card({ id: "selected", href })}${card({ id: "ordinary" })}</main>`,
      });
      await expect(page.locator("#selected")).toHaveAttribute(
        "data-bfilter-hidden",
        "true",
      );
      await expect(page.locator("#ordinary")).not.toHaveAttribute(
        "data-bfilter-hidden",
      );
    });
  }

  test("preview mode marks matches without hiding them", async ({ page }) => {
    await loadBfilter(page, {
      storage: { [keys.videos]: "match", [keys.preview]: "true" },
      html: `<main>${card({ id: "preview", title: "match" })}</main>`,
    });
    await expect(page.locator("#preview")).toHaveAttribute(
      "data-bfilter-previewed",
      "true",
    );
    await expect(page.locator("#preview")).not.toHaveAttribute(
      "data-bfilter-hidden",
    );
    await expect(page.locator("#preview")).toHaveCSS("outline-style", "solid");
  });

  test("comments support keyword, mentions-only, image, and level rules", async ({
    page,
  }) => {
    await loadBfilter(page, {
      storage: {
        [keys.comments]: "bad",
        "bfilter:hide-comments-by-mentions-only": "true",
        "bfilter:hide-comments-by-images-attached": "true",
        "bfilter:hide-comments-by-commenter-level": "true",
        "bfilter:hide-comments-by-commenter-level-threshold": "≤ 2",
      },
      html: `<main>
        ${comment({ id: "keyword", text: "very bad" })}
        ${comment({ id: "mention", text: '<a class="jump-link user" href="https://space.bilibili.com/8">@user</a>' })}
        ${comment({ id: "mention-plus-text", text: '<a class="jump-link user" href="https://space.bilibili.com/8">@user</a> hello' })}
        ${comment({ id: "image", text: "ordinary", extra: '<div class="image-exhibition"><img src="attached.png"></div>' })}
        ${comment({ id: "emoji", text: 'ordinary <img src="emoji.png">' })}
        ${comment({ id: "level", text: "ordinary", extra: '<div class="user-info"><span>LV2</span></div>' })}
        ${comment({ id: "level-high", text: "ordinary", extra: '<div class="user-info"><span>LV3</span></div>' })}
      </main>`,
    });
    for (const id of ["keyword", "mention", "image", "level"])
      await expect(page.locator(`#${id}`)).toHaveAttribute(
        "data-bfilter-hidden",
        "true",
      );
    for (const id of ["mention-plus-text", "emoji", "level-high"])
      await expect(page.locator(`#${id}`)).not.toHaveAttribute(
        "data-bfilter-hidden",
      );
  });

  test("danmaku keyword filtering is limited to direct video pages", async ({
    page,
  }) => {
    await loadBfilter(page, {
      url: "https://www.bilibili.com/video/BV1",
      storage: { [keys.danmakus]: "spoiler" },
      html: `<main>${danmaku({ id: "dm", text: "spoiler here" })}${danmaku({ id: "dm-kept", text: "ordinary" })}</main>`,
    });
    await expect(page.locator("#dm")).toHaveAttribute(
      "data-bfilter-hidden",
      "true",
    );
    await expect(page.locator("#dm-kept")).not.toHaveAttribute(
      "data-bfilter-hidden",
    );
  });

  test("unified keywords replace the three separate keyword lists", async ({
    page,
  }) => {
    await loadBfilter(page, {
      url: "https://www.bilibili.com/video/BV1",
      storage: {
        [keys.unified]: "unified",
        [keys.unifiedMode]: "true",
        [keys.videos]: "separate",
        [keys.comments]: "separate",
        [keys.danmakus]: "separate",
      },
      html: `<main>${card({ id: "unified-card", title: "unified" })}${card({ id: "separate-card", title: "separate" })}${comment({ id: "unified-comment", text: "unified" })}${danmaku({ id: "unified-dm", text: "unified" })}</main>`,
    });
    for (const id of ["unified-card", "unified-comment", "unified-dm"])
      await expect(page.locator(`#${id}`)).toHaveAttribute(
        "data-bfilter-hidden",
        "true",
      );
    await expect(page.locator("#separate-card")).not.toHaveAttribute(
      "data-bfilter-hidden",
    );
    await page.locator("#bfilter-manager-button").click();
    await expect(page.locator('[data-tab="unified-keywords"]')).toBeVisible();
    await expect(
      page.locator("#bfilter-manager-hide-videos-by-keyword-textarea"),
    ).toBeDisabled();
  });
});

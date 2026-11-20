const { test, expect } = require("@playwright/test");
const path = require("node:path");

// Verify the entry opens a dismissible dashboard below the home navigation item
test("opens and closes the dashboard from the home navigation", async ({
  page,
}) => {
  await page.setContent(
    '<nav><div class="home-page-entry"><a href="https://www.bilibili.com/">首页</a></div></nav>',
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
  await expect(dashboard).not.toBeVisible();
});

// Preserve the site's navigation when it is rendered after the userscript starts
test("keeps a dynamically rendered home navigation intact", async ({
  page,
}) => {
  await page.setContent('<nav id="site-nav"></nav>');
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

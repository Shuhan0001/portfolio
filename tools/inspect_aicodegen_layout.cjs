const { chromium } = require("C:/Users/zhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const { pathToFileURL } = require("url");
const path = require("path");

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await page.goto(pathToFileURL(path.resolve(__dirname, "..", "AICodeGen_Profilo.html")).href);
    await page.evaluate(() => document.body.classList.add("aicodegen-full-portfolio"));
    await page.emulateMedia({ media: "print" });
    const rows = await page.evaluate(() => [...document.querySelectorAll(".aicodegen-full-page")].map((section, index) => {
      const sr = section.getBoundingClientRect();
      const content = section.querySelector(".aic-content");
      const cr = content?.getBoundingClientRect();
      return {
        page: index + 1,
        sectionTop: Math.round(sr.top),
        sectionHeight: Math.round(sr.height),
        contentTop: cr && Math.round(cr.top - sr.top),
        contentHeight: cr && Math.round(cr.height),
        contentBottom: cr && Math.round(cr.bottom - sr.top),
        scrollHeight: section.scrollHeight,
      };
    }));
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const { chromium } = require("C:/Users/zhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const { pathToFileURL } = require("url");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = path.join(root, "MiniQuest_Profilo.html");
const output = path.join(root, "tmp", "pdfs", "edinburgh_refresh", "MiniQuest_Application_8p.pdf");

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await page.goto(pathToFileURL(html).href, { waitUntil: "load", timeout: 30000 });
    await page.evaluate(() => document.body.classList.add("miniquest-application-portfolio"));
    await page.emulateMedia({ media: "print" });
    await page.addStyleTag({ content: `@media print {
      body.miniquest-application-portfolio .application-index { display: none !important; }
      body.miniquest-application-portfolio .application-page-header { align-items: center !important; }
      body.miniquest-application-portfolio .application-model-grid,
      body.miniquest-application-portfolio .application-model-visuals { height: 405px !important; min-height: 0 !important; }
      body.miniquest-application-portfolio .application-model-visuals figure { height: 405px !important; min-height: 0 !important; grid-template-rows: minmax(0, 1fr) auto !important; }
      body.miniquest-application-portfolio .application-model-visuals img { min-height: 0 !important; }
      body.miniquest-application-portfolio .application-research-evidence {
        display: grid; grid-template-columns: 0.55fr 1.7fr; gap: 8px 22px;
        margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(159, 209, 91, 0.22);
        font: 12px/1.42 Arial, sans-serif; color: #b8bcb5;
      }
      body.miniquest-application-portfolio .application-research-evidence strong { color: #e9eee6; font-size: 15px; }
      body.miniquest-application-portfolio .application-research-evidence p { margin: 0; }
      body.miniquest-application-portfolio .application-research-evidence small { grid-column: 2; font-size: 10px; color: #90988c; }
      body.miniquest-application-portfolio .application-reflection-detail {
        display: grid; grid-template-columns: 1fr 1fr; gap: 28px;
        margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(159, 209, 91, 0.22);
        font: 12px/1.45 Arial, sans-serif; color: #b8bcb5;
      }
      body.miniquest-application-portfolio .application-reflection-detail strong { color: #e9eee6; font-size: 15px; }
      body.miniquest-application-portfolio .application-reflection-detail p { margin: 8px 0 0; }
    }` });
    await page.evaluate(async () => {
      await document.fonts.ready;
      for (const image of document.images) image.loading = "eager";
      await Promise.race([
        Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    });
    const pages = await page.evaluate(() => [...document.querySelectorAll(".application-page")].map((el) => ({
      height: Math.round(el.getBoundingClientRect().height),
      bottom: Math.round(Math.max(...[...el.children].map((child) => child.getBoundingClientRect().bottom - el.getBoundingClientRect().top))),
    })));
    if (pages.length !== 8 || pages.some(({ height, bottom }) => height !== 720 || bottom > 690)) {
      throw new Error(`MiniQuest page overflow: ${JSON.stringify(pages)}`);
    }
    console.log(JSON.stringify(pages));
    await page.pdf({ path: output, printBackground: true, preferCSSPageSize: true, tagged: true });
    console.log(output);
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

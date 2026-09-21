const { chromium } = require("C:/Users/zhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const { pathToFileURL } = require("url");
const path = require("path");
const fs = require("fs");

const cases = [
  { input: "Supermarket_Simulator_Profilo.html", output: "Lets_Supermarket_Full_Portfolio.pdf", theme: "theme-market", pages: 6 },
];

async function renderCase(browser, root, spec) {
  const inputPath = path.join(root, spec.input);
  const outputPath = path.join(root, "output", "pdf", spec.output);
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(pathToFileURL(inputPath).href, { waitUntil: "load", timeout: 30000 });
    const screen = await page.evaluate(() => ({
      originalVisible: !!document.querySelector("main > section:not(.case-page)") &&
        getComputedStyle(document.querySelector("main > section:not(.case-page)")).display !== "none",
      printHidden: [...document.querySelectorAll(".case-page")].every((el) => getComputedStyle(el).display === "none"),
    }));
    if (!screen.originalVisible || !screen.printHidden) throw new Error(`${spec.input}: screen state ${JSON.stringify(screen)}`);
    await page.evaluate((theme) => document.body.classList.add("case-print", theme), spec.theme);
    await page.emulateMedia({ media: "print" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      for (const img of document.images) img.loading = "eager";
      await Promise.race([
        Promise.all([...document.images].map((img) => img.decode().catch(() => undefined))),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    });
    const layout = await page.evaluate(() => [...document.querySelectorAll(".case-page")].map((el, index) => {
      const rect = el.getBoundingClientRect();
      return {
        index: index + 1,
        width: rect.width,
        height: rect.height,
        scrollHeight: el.scrollHeight,
        children: [...el.children].map((child) => ({ className: child.className, bottom: Math.round(child.getBoundingClientRect().bottom - rect.top) })),
      };
    }));
    if (layout.length !== spec.pages || layout.some((item) => item.width !== 1280 || item.height !== 720 || item.scrollHeight > 720)) {
      throw new Error(`${spec.input}: layout ${JSON.stringify(layout)}`);
    }
    // The pre-existing screen page loads Tailwind from a CDN. In an offline
    // renderer that one script can fail, while the opt-in PDF stylesheet is local.
    const unexpectedErrors = errors.filter((message) => !message.includes("tailwind is not defined"));
    if (unexpectedErrors.length) throw new Error(`${spec.input}: page errors ${unexpectedErrors.join(" | ")}`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await page.pdf({ path: outputPath, printBackground: true, preferCSSPageSize: true, tagged: true });
    return { outputPath, screen, layout };
  } finally {
    await page.close();
  }
}

async function main() {
  const root = path.resolve(__dirname, "..");
  const browser = await chromium.launch({
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  try {
    for (const spec of cases) console.log(JSON.stringify(await renderCase(browser, root, spec), null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

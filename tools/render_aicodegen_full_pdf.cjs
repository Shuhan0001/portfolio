const { chromium } = require("C:/Users/zhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const { pathToFileURL } = require("url");
const path = require("path");
const fs = require("fs");

async function main() {
  const root = path.resolve(__dirname, "..");
  const inputPath = path.join(root, "AICodeGen_Profilo.html");
  const outputPath = process.argv[2] || path.join(root, "output", "pdf", "AICodeGen_Full_Portfolio.pdf");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const browser = await chromium.launch({
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await page.goto(pathToFileURL(inputPath).href, { waitUntil: "load" });
    await page.evaluate(() => document.body.classList.add("aicodegen-full-portfolio"));
    await page.emulateMedia({ media: "print" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      for (const img of document.images) img.loading = "eager";
      await Promise.race([
        Promise.all([...document.images].map((img) => img.decode().catch(() => undefined))),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    });
    await page.pdf({
      path: outputPath,
      printBackground: true,
      preferCSSPageSize: true,
      tagged: true,
    });
    console.log(outputPath);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

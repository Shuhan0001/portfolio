const { chromium } = require("C:/Users/zhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const { pathToFileURL } = require("url");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "tmp", "pdfs", "edinburgh_refresh");
const cleanTitles = path.join(__dirname, "clean_pdf_titles.css");
const thresholdPrint = path.join(__dirname, "threshold_web_print.css");

const specs = [
  { html: "CogniStream_Profilo.html", pdf: "CogniStream_Portfolio.pdf" },
  { html: "Revive_Profilo.html", pdf: "Revive_Portfolio.pdf" },
  { html: "MiniQuest_Profilo.html", pdf: "MiniQuest_Full_Portfolio.pdf", className: "miniquest-full-portfolio" },
  { html: "AICodeGen_Profilo.html", pdf: "AICodeGen_Full_Portfolio.pdf", className: "aicodegen-full-portfolio" },
  { html: "HauntedSchool_Profilo.html", pdf: "HauntedSchool_Full_Portfolio.pdf", className: "haunted-full-portfolio" },
  { html: "Supermarket_Simulator_Profilo.html", pdf: "Lets_Supermarket_Full_Portfolio.pdf", className: "case-print theme-market" },
  { html: "Threshold_Profilo.html", pdf: "Threshold_Full_Portfolio.pdf", threshold: true },
];

async function render(browser, spec) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  try {
    const htmlPath = path.join(root, spec.html);
    const pdfPath = path.join(outputDir, spec.pdf);
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load", timeout: 30000 });
    if (spec.className) {
      await page.evaluate((className) => document.body.classList.add(...className.split(" ")), spec.className);
    }
    if (spec.threshold) {
      await page.evaluate(() => {
        const main = document.querySelector("main");
        const sections = [...main.querySelectorAll(":scope > section:not(.case-page)")];
        if (sections.length !== 6) throw new Error(`Expected six original website sections, got ${sections.length}`);
        const groups = [[sections[0], sections[1]], [sections[2], sections[3]], [sections[4]], [sections[5]]];
        for (const [index, group] of groups.entries()) {
          const sheet = document.createElement("div");
          sheet.className = `threshold-print-page threshold-print-page-${index + 1}`;
          sheet.dataset.folio = String(index + 1).padStart(2, "0");
          group.forEach((section) => sheet.appendChild(section));
          main.appendChild(sheet);
        }
        document.body.classList.add("threshold-web-print");
      });
      await page.addStyleTag({ path: thresholdPrint });
    } else {
      await page.addStyleTag({ path: cleanTitles });
    }
    await page.emulateMedia({ media: "print" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      for (const image of document.images) image.loading = "eager";
      await Promise.race([
        Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    });
    if (spec.threshold) {
      const layout = await page.evaluate(() => [...document.querySelectorAll(".threshold-print-page")].map((el) => ({
        height: el.getBoundingClientRect().height,
        sectionBottoms: [...el.children].map((child) => Math.round(child.getBoundingClientRect().bottom - el.getBoundingClientRect().top)),
      })));
      if (layout.length !== 4 || layout.some((item) => item.height !== 720 || item.sectionBottoms.some((bottom) => bottom > 680))) {
        throw new Error(`Threshold overflow: ${JSON.stringify(layout)}`);
      }
      console.log("Threshold website layout:", JSON.stringify(layout));
    }
    await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true, tagged: true });
    console.log(pdfPath);
  } finally {
    await page.close();
  }
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  try {
    for (const spec of specs) await render(browser, spec);
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

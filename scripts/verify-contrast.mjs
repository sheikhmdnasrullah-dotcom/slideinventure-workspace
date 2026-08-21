/**
 * Contrast verification — checks all text color pairs meet WCAG 2.1 AA (4.5:1)
 * Run after dev server is running: node scripts/verify-contrast.mjs
 */

const { chromium } = await import("playwright");
import { readFileSync } from "fs";

const THEMES = ["day", "night"];
const PAGES = ["/", "/knowledge", "/chat", "/agents", "/prospects", "/research", "/insights", "/activity", "/strategy", "/automations", "/cold-outreach", "/cold-outreach", "/login"];

function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg, bg) {
  const L1 = luminance(fg);
  const L2 = luminance(bg);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

function parseRgb(str) {
  const match = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [0, 0, 0];
}

async function checkPage(page, theme) {
  const violations = [];

  // Get all visible text elements
  const elements = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const texts = [];
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent) continue;
      const style = getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (parent.offsetWidth === 0 && parent.offsetHeight === 0) continue;

      const text = node.textContent?.trim();
      if (!text || text.length < 2) continue;

      const color = style.color;
      const bg = style.backgroundColor;
      const fontSize = parseFloat(style.fontSize);

      texts.push({ text, color, bg, fontSize, tag: parent.tagName, class: parent.className });
    }
    return texts;
  });

  for (const { text, color, bg, fontSize, tag, class: cls } of elements) {
    const fg = parseRgb(color);
    const bgrgb = parseRgb(bg);
    const ratio = contrastRatio(fg, bgrgb);
    const required = fontSize >= 24 ? 3 : 4.5; // Large text: 3:1, normal: 4.5:1

    if (ratio < required) {
      violations.push({
        text: text.slice(0, 80),
        ratio: ratio.toFixed(2),
        required,
        color: `rgb(${fg.join(",")})`,
        bg: `rgb(${bgrgb.join(",")})`,
        selector: `${tag}.${cls.split(" ").join(".")}`,
      });
    }
  }

  return violations;
}

async function main() {
  let allViolations = [];

  for (const [theme, colorScheme] of [["day", "light"], ["night", "dark"]]) {
    console.log(`\n=== Theme: ${theme} ===`);
    const browser = await chromium.launch();
    const page = await browser.newPage({ colorScheme: colorScheme });

    await page.addInitScript((t) => {
      try { localStorage.setItem("theme", t); } catch {}
    }, theme);

    for (const pagePath of ["/", "/knowledge", "/chat", "/agents", "/prospects", "/research", "/insights", "/activity", "/strategy", "/automations", "/cold-outreach", "/login"]) {
      try {
        await page.goto(`http://localhost:3000${pagePath}`, { waitUntil: "networkidle", timeout: 15000 });
        await new Promise(r => setTimeout(r, 500));

        const violations = await checkPage(page, theme);
        if (violations.length > 0) {
          console.log(`\n❌ ${theme} — ${pagePath} (${violations.length} violations):`);
          for (const v of violations) {
            console.log(`  ${v.ratio}:1 vs ${v.required}:1 — "${v.text}" (${v.selector})`);
            console.log(`    fg: ${v.color}  bg: ${v.bg}`);
          }
          allViolations.push(...violations.map(v => ({ theme, page: pagePath, ...v })));
        } else {
          console.log(`✅ ${theme} — ${pagePath}`);
        }
      } catch (err) {
        console.log(`⚠️ ${theme} — ${pagePath}: ${err.message}`);
      }
    }
  }

    await browser.close();
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total violations: ${allViolations.length}`);
  if (allViolations.length > 0) {
    process.exit(1);
  }
}

main().catch(console.error).finally(() => process.exit());
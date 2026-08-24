import { chromium } from "playwright"

const DEPLOY = "https://slideinventure-workspace-d7fsk2qg2.vercel.app"
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(DEPLOY + "/login", { waitUntil: "load", timeout: 30000 })
await page.waitForSelector('input[type="email"]', { timeout: 15000 })
await page.fill('input[type="email"]', "test@example.com")
await page.keyboard.press("Enter")
await page.waitForTimeout(2500)
const info = await page.evaluate(() => {
  const form = document.querySelector("form")
  const inputs = Array.from(document.querySelectorAll("input")).map((i) => ({ id: i.id, type: i.type, name: i.name }))
  return {
    inputs,
    formHTML: form ? form.outerHTML.slice(0, 1500) : "NO FORM",
    bodyText: document.body.innerText.slice(0, 400),
  }
})
console.log(JSON.stringify(info, null, 2))
await browser.close()

"""
Email Crawler microservice.
Wraps the requested open-source repos so the Node dashboard can call them over HTTP:
  - unclecode/crawl4ai        -> async web crawl -> markdown + extracted links/emails
  - microsoft/playwright-python + AtuboDad/playwright_stealth -> stealth page fetch
  - 2captcha/2captcha-python  -> CAPTCHA solving
  - Reacher (reacherhq/backend) -> email verification via the VPS Reacher endpoint

Run (VPS):
  pip install -r requirements.txt
  playwright install chromium
  uvicorn main:app --host 0.0.0.0 --port 8000
"""
import os
import re
import asyncio
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

app = FastAPI(title="Email Crawler Service")

# Reacher email verification (https://reacher.email). Mirrors the VPS
# verify_leads.py contract: POST {REACHER_URL}/v0/check_email with x-reacher-secret.
REACHER_URL = os.environ.get("REACHER_URL", "https://mailtest.nasrullahtanim.me").rstrip("/")
REACHER_SECRET = os.environ.get("REACHER_SECRET", "")
TWOCAPTCHA_KEY = os.environ.get("TWOCAPTCHA_API_KEY", "")


class CrawlRequest(BaseModel):
    url: str
    query: Optional[str] = None
    max_pages: int = 5


class SolveRequest(BaseModel):
    site_key: str
    page_url: str
    api_key: Optional[str] = None


class StealthRequest(BaseModel):
    url: str


class VerifyRequest(BaseModel):
    email: str


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/crawl")
async def crawl(req: CrawlRequest):
    """crawl4ai: fetch a page (and follow internal links) -> markdown + emails + links."""
    try:
        from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
    except Exception as e:  # pragma: no cover
        raise HTTPException(500, f"crawl4ai unavailable: {e}")

    emails: set[str] = set()
    links: set[str] = set()
    markdown_chunks: list[str] = []

    config = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, stream=False)
    browser_cfg = BrowserConfig(headless=True)

    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        result = await crawler.arun(url=req.url, config=config)
        if result and result.success:
            md = result.markdown or ""
            markdown_chunks.append(md)
            for em in EMAIL_RE.findall(md):
                emails.add(em.lower())
            for lk in (getattr(result, "links", {}) or {}).get("internal", []):
                links.add(lk)
        # follow a few internal links for richer discovery
        follow = list(links)[: max(0, req.max_pages - 1)]
        for link in follow:
            try:
                r2 = await crawler.arun(url=link, config=config)
                if r2 and r2.success:
                    md2 = r2.markdown or ""
                    markdown_chunks.append(md2)
                    for em in EMAIL_RE.findall(md2):
                        emails.add(em.lower())
            except Exception:
                continue

    return {"url": req.url, "emails": sorted(emails), "links": sorted(links), "markdown": "\n\n".join(markdown_chunks)[:20000]}


@app.post("/stealth_fetch")
async def stealth_fetch(req: StealthRequest):
    """playwright + playwright_stealth: load a page evading bot detection -> HTML + emails."""
    try:
        from playwright.async_api import async_playwright
        from playwright_stealth import stealth_async
    except Exception as e:  # pragma: no cover
        raise HTTPException(500, f"playwright/stealth unavailable: {e}")

    emails: set[str] = set()
    html = ""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        await stealth_async(page)
        await page.goto(req.url, wait_until="networkidle", timeout=30000)
        html = await page.content()
        await browser.close()
    for em in EMAIL_RE.findall(html):
        emails.add(em.lower())
    return {"url": req.url, "emails": sorted(emails), "html_len": len(html)}


@app.post("/solve_captcha")
async def solve_captcha(req: SolveRequest):
    """2captcha-python: solve a reCAPTCHA and return the token."""
    try:
        from twocaptcha import TwoCaptcha
    except Exception as e:  # pragma: no cover
        raise HTTPException(500, f"2captcha-python unavailable: {e}")

    api_key = req.api_key or TWOCAPTCHA_KEY
    if not api_key:
        raise HTTPException(400, "no 2captcha api key configured")
    solver = TwoCaptcha(api_key)
    try:
        result = solver.recaptcha(sitekey=req.site_key, url=req.page_url)
        return {"token": result.get("code") if isinstance(result, dict) else result}
    except Exception as e:
        raise HTTPException(502, f"2captcha failed: {e}")


@app.post("/verify")
async def verify(req: VerifyRequest):
    """Reacher: verify an email via the VPS Reacher endpoint."""
    import httpx

    if not REACHER_SECRET:
        return {"email": req.email, "status": "error", "detail": "REACHER_SECRET not set"}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{REACHER_URL}/v0/check_email",
                headers={"content-type": "application/json", "x-reacher-secret": REACHER_SECRET},
                json={"to_email": req.email},
            )
            if r.status_code != 200:
                return {"email": req.email, "status": "error", "detail": f"HTTP {r.status_code}"}
            data = r.json()
            reach = str(data.get("is_reachable", "")).lower()
            status = "valid" if reach in ("safe", "valid", "risky") else "invalid" if reach == "invalid" else "unknown"
            return {"email": req.email, "status": status, "raw": data}
    except Exception as e:
        return {"email": req.email, "status": "error", "detail": str(e)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))

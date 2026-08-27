import "server-only";

// Pluggable CAPTCHA solver. Reads credentials from the environment (never
// hardcoded) and is gated by ENABLE_CAPTCHA_SOLVING. Currently supports the
// 2Captcha API. The browse agent invokes solveCaptcha() only when enabled,
// then injects the returned token into the page and resumes.

const TWOCAPTCHA_BASE = "https://2captcha.com";

export function isCaptchaSolvingEnabled(): boolean {
  return process.env.ENABLE_CAPTCHA_SOLVING === "true";
}

export function captchaProviderAvailable(): boolean {
  return Boolean(process.env.TWOCAPTCHA_API_KEY);
}

export type CaptchaRequest = {
  // reCAPTCHA site key (googlekey): for userrecaptcha method
  siteKey: string;
  pageUrl: string;
  // Optional: proxy/cookies not handled here; extend as needed.
  type?: "recaptcha" | "hcaptcha";
};

export type CaptchaResult = {
  ok: boolean;
  token?: string;
  error?: string;
};

async function postIn(base: string, params: Record<string, string>): Promise<any> {
  const usp = new URLSearchParams(params);
  const res = await fetch(`${base}/in.php?${usp.toString()}`, { method: "GET" });
  return res.json();
}

async function getRes(base: string, key: string, id: string): Promise<any> {
  const res = await fetch(
    `${base}/res.php?key=${encodeURIComponent(key)}&action=get&id=${encodeURIComponent(id)}&json=1`
  );
  return res.json();
}

export async function solveCaptcha(req: CaptchaRequest): Promise<CaptchaResult> {
  const key = process.env.TWOCAPTCHA_API_KEY;
  if (!key) return { ok: false, error: "TWOCAPTCHA_API_KEY not set" };
  if (!isCaptchaSolvingEnabled()) return { ok: false, error: "captcha solving disabled" };

  const method = req.type === "hcaptcha" ? "hcaptcha" : "userrecaptcha";
  try {
    const inResp = await postIn(TWOCAPTCHA_BASE, {
      key,
      method,
      googlekey: req.siteKey,
      pageurl: req.pageUrl,
      json: "1",
    });
    if (inResp.status !== 1) {
      return { ok: false, error: inResp.request || "2captcha in.php failed" };
    }
    const captchaId = String(inResp.request);

    // Poll for the result (up to ~120s).
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const out = await getRes(TWOCAPTCHA_BASE, key, captchaId);
      if (out.status === 1) {
        return { ok: true, token: out.request };
      }
      if (out.request !== "CAPCHA_NOT_READY") {
        return { ok: false, error: out.request || "2captcha res.php failed" };
      }
    }
    return { ok: false, error: "captcha solving timed out" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "captcha solving error" };
  }
}

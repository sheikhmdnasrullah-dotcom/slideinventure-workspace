import "server-only";

// Optional Python microservice (server/email-crawler-service) that wraps
// crawl4ai, playwright+stealth, 2captcha-python and Reacher. Used only when
// EMAIL_CRAWLER_SERVICE_URL is configured. Graceful: failures are ignored and
// the Node browse agent remains the source of truth.

export type PythonServiceResult = {
  emails: string[];
  links: string[];
  markdown?: string;
};

export function emailCrawlerServiceConfigured(): boolean {
  return Boolean(process.env.EMAIL_CRAWLER_SERVICE_URL);
}

export async function enrichWithPythonService(
  link: string,
  details: string
): Promise<PythonServiceResult | null> {
  const base = process.env.EMAIL_CRAWLER_SERVICE_URL;
  if (!base) return null;
  try {
    const target = link || `https://www.google.com/search?q=${encodeURIComponent(details || "prospect email")}`;
    const res = await fetch(`${base.replace(/\/$/, "")}/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: target, query: details, max_pages: 6 }),
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PythonServiceResult;
    return { emails: data.emails || [], links: data.links || [], markdown: data.markdown };
  } catch {
    return null;
  }
}

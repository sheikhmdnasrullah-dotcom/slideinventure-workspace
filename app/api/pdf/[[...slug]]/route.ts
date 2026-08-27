import { NextRequest } from "next/server";

const TARGET = process.env.STIRLING_PDF_URL || "https://pdf.slideinventure.com";

type Ctx = { params: Promise<{ slug?: string[] }> };

function rewriteHtml(html: string, prefix: string): string {
  // Rewrite root-absolute asset/action URLs to go through the proxy so the
  // embedded Stirling-PDF app can load its JS/CSS/images.
  return html.replace(
    /(src|href|action|content)=("|')\/(?!api\/pdf)([^"']*)/gi,
    (_m, attr, q, rest) => `${attr}=${q}${prefix}/${rest}`,
  );
}

function cleanHeaders(upstream: Response): Headers {
  const headers = new Headers();
  for (const [k, v] of upstream.headers.entries()) {
    if (/x-frame-options|content-security-policy|content-security-policy-report-only|cross-origin-opener-policy/i.test(k))
      continue;
    headers.set(k, v);
  }
  headers.set("content-security-policy", "frame-ancestors 'self'");
  headers.delete("content-encoding");
  return headers;
}

async function proxy(req: NextRequest, ctx: Ctx) {
  const { slug: slugArr } = await ctx.params;
  const slug = (slugArr || []).join("/").replace(/^\/+/, "");
  const target = `${TARGET}/${slug}${req.nextUrl.search}`;
  const init: RequestInit = {
    method: req.method,
    headers: { "user-agent": req.headers.get("user-agent") || "Mozilla/5.0" },
    redirect: "follow",
  };
  if (req.method === "POST") init.body = await req.arrayBuffer();
  const upstream = await fetch(target, init);
  const contentType = upstream.headers.get("content-type") || "";
  const headers = cleanHeaders(upstream);

  if (contentType.includes("text/html")) {
    const text = await upstream.text();
    return new Response(rewriteHtml(text, "/api/pdf"), { status: upstream.status, headers });
  }
  const buf = await upstream.arrayBuffer();
  return new Response(buf, { status: upstream.status, headers });
}

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx);
}

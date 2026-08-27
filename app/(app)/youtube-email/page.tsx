"use client";

import * as React from "react";

type Result = {
  channel: string;
  email: string | null;
  emails?: string[];
  websites?: string[];
  method: string | null;
  error?: string | null;
};

export default function YoutubeEmailPage() {
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<Result[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    const channels = input
      .split("\n")
      .map((c) => c.trim())
      .filter(Boolean);
    if (!channels.length || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/youtube-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channels }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "request failed");
      } else {
        setResults(data.results || []);
      }
    } catch (e: any) {
      setError(e?.message ?? "request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="font-label text-lg font-semibold text-ink-strong">YouTube Email Extractor</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Paste YouTube channel URLs (one per line). The headless browser opens each channel's
          About page, clicks <b>View email address</b>, and solves the CAPTCHA via 2Captcha to
          reveal the business email.
        </p>
      </div>

      <div className="rounded-xl border border-rule bg-card/60 p-4">
        <label className="block text-xs font-medium text-ink-muted">
          Channel URLs (https://youtube.com/@handle)
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"https://www.youtube.com/@MrBeast/about\nhttps://www.youtube.com/@Vercel/about"}
          rows={6}
          className="mt-2 w-full rounded-md border border-rule bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="mt-3">
          <button
            onClick={run}
            disabled={loading || !input.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Extracting" : "Extract emails"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-rose-500">{error}</p>}

      {results.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-card/60">
                <th className="px-3 py-2 text-left font-label text-ink-muted">Channel</th>
                <th className="px-3 py-2 text-left font-label text-ink-muted">Emails</th>
                <th className="px-3 py-2 text-left font-label text-ink-muted">Websites</th>
                <th className="px-3 py-2 text-left font-label text-ink-muted">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {results.map((r, i) => {
                const emails = r.emails && r.emails.length ? r.emails : r.email ? [r.email] : [];
                return (
                  <tr key={i} className="hover:bg-card/40">
                    <td className="px-3 py-2 font-mono text-xs text-ink-muted break-all">{r.channel}</td>
                    <td className="px-3 py-2">
                      {emails.length ? (
                        <div className="space-y-1">
                          {emails.map((e) => (
                            <div key={e} className="font-medium text-emerald-500 break-all">
                              {e}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-ink-faint"></span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.websites && r.websites.length ? (
                        <div className="space-y-1">
                          {r.websites.map((w) => (
                            <div key={w} className="text-xs text-sky-400 break-all">
                              {w}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-ink-faint"></span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-muted">{r.method ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { test as base, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { Client, Users, Query } from "node-appwrite";

// Playwright does not auto-load .env.local the way `next dev` and
// `tsx --env-file` do, so the Appwrite key would otherwise be undefined here.
try {
  process.loadEnvFile(".env.local");
} catch {
  // already loaded, or running where .env.local does not exist
}

const PROJECT_ID = process.env.APPWRITE_PROJECT_ID ?? "";
export const SESSION_COOKIE = `a_session_${PROJECT_ID}`;

type SavedSession = { name: string; value: string };

/**
 * Reads a session cookie written by the interactive `scripts/mint-session.ts`
 * (default /tmp/kilo/session.txt). Returns the exact cookie name and value, or
 * null when no saved session exists.
 */
function readSavedSession(): SavedSession | null {
  const candidates = [
    process.env.KILO_SESSION_FILE,
    "/tmp/kilo/session.txt",
    `${process.env.HOME}/.kilo/session.txt`,
  ];
  for (const path of candidates) {
    if (!path) continue;
    try {
      const raw = readFileSync(path, "utf8").trim();
      const match = raw.match(/^(a_session_[a-f0-9]+)=(.*)$/);
      if (match) return { name: match[1], value: match[2] };
      if (raw) return { name: SESSION_COOKIE, value: raw };
    } catch {
      // file not present; try the next candidate
    }
  }
  return null;
}

/**
 * Resolves a real Appwrite session to inject as a cookie. No password is typed
 * into the browser and no credential is stored in the test files.
 *
 * Prefers a saved interactive session (the server-side `users.createSession`
 * path needs users.read/write on the API key, which the project key may lack),
 * and falls back to minting one only when no saved session is available.
 */
export async function resolveSession(): Promise<SavedSession> {
  const saved = readSavedSession();
  if (saved) return saved;

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1")
    .setProject(PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY || "");

  const users = new Users(client);
  const list = await users.list([Query.limit(1)]);
  const user = list.users[0];
  if (!user) throw new Error("No Appwrite user found to mint a test session for");
  const session = await users.createSession(user.$id);
  return { name: SESSION_COOKIE, value: session.secret };
}

export async function authenticate(context: BrowserContext, baseURL: string) {
  const { name, value } = await resolveSession();
  await context.addCookies([
    { name, value, url: baseURL, httpOnly: true, sameSite: "Lax" },
  ]);
}

/**
 * Collects console errors and uncaught exceptions for every test, so a run can
 * assert the implementation did not introduce runtime noise.
 *
 * Ignored: network noise from third-party telemetry (Datadog RUM) and expected
 * 401/403 probes, which are not defects in the app under test.
 */
const IGNORED_CONSOLE = [
  /datadoghq/i,
  /dd-rum/i,
  /favicon/i,
  /Failed to load resource.*40[13]/i,
  /ResizeObserver loop/i,
  // React dev-only hydration hints from third-party editor bundles
  /Extra attributes from the server/i,
];

export type Diagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
};

export const test = base.extend<{ diagnostics: Diagnostics }>({
  diagnostics: async ({ page, context }, use) => {
    await authenticate(context, base.info().project.use.baseURL as string);

    const diagnostics: Diagnostics = { consoleErrors: [], pageErrors: [] };

    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
      diagnostics.consoleErrors.push(text);
    });
    page.on("pageerror", (err) => {
      if (IGNORED_CONSOLE.some((re) => re.test(err.message))) return;
      diagnostics.pageErrors.push(err.message);
    });

    await use(diagnostics);
  },
});

export { expect } from "@playwright/test";

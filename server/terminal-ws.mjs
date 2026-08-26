// Standalone sandboxed PTY → WebSocket bridge for the Terminal "Live shell".
//
// Security model (see master spec: Terminal = xterm.js, must be sandboxed):
//  - Connection requires a valid Appwrite session cookie (`a_session`). Unauth
//    connections are closed immediately.
//  - The shell runs inside a restricted working directory (SANDBOX_DIR, default
//    ./sandbox) and, when the server is started as root (VPS), drops privileges
//    to a non-root `sandbox` user if it exists.
//  - Input is capped per message and sessions are killed after an idle timeout.
//
// Run (dev):  node server/terminal-ws.mjs
// Deploy:    pm2 start server/terminal-ws.mjs --name terminal-ws
//            Caddy proxies /ws/terminal -> localhost:<PORT>

import pty from "node-pty";
import { WebSocketServer } from "ws";
import http from "http";
import fs from "fs";
import os from "os";
import path from "path";

const PORT = Number(process.env.TERMINAL_WS_PORT || 3001);
const HOST = process.env.TERMINAL_WS_HOST || "0.0.0.0";
const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const APPWRITE_PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT || "";
const SANDBOX_DIR = process.env.SANDBOX_DIR || path.join(process.cwd(), "sandbox");
const IDLE_TIMEOUT_MS = Number(process.env.TERMINAL_IDLE_MS || 30 * 60 * 1000);
const MAX_MSG_BYTES = 64 * 1024;

if (!fs.existsSync(SANDBOX_DIR)) {
  fs.mkdirSync(SANDBOX_DIR, { recursive: true });
}

// Resolve a non-root drop user when running as root.
function dropUser() {
  if (process.getuid && process.getuid() !== 0) return null;
  try {
    const passwd = fs.readFileSync("/etc/passwd", "utf-8");
    for (const line of passwd.split("\n")) {
      const [name, , uid, gid] = line.split(":");
      if (name === "sandbox" && Number(uid) > 0) {
        return { uid: Number(uid), gid: Number(gid) };
      }
    }
  } catch {
    /* ignore */
  }
  console.warn("[terminal-ws] running as root with no 'sandbox' user — refusing privileged shell.");
  return "refuse";
}

// Validate the Appwrite session cookie by calling /v1/account.
async function authenticate(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)a_session=([^;]+)/);
  const session = match && decodeURIComponent(match[1]);
  if (!session) return false;
  try {
    const res = await fetch(`${APPWRITE_ENDPOINT}/account`, {
      headers: {
        "X-Appwrite-Project": APPWRITE_PROJECT,
        "X-Appwrite-Session": session,
      },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

const server = http.createServer((_req, res) => {
  res.writeHead(426);
  res.end("Upgrade Required");
});

const wss = new WebSocketServer({ server, path: "/ws/terminal" });

wss.on("connection", async (ws, req) => {
  const ok = await authenticate(req);
  if (!ok) {
    ws.close(1008, "unauthorized");
    return;
  }

  const drop = dropUser();
  if (drop === "refuse") {
    ws.close(1008, "server misconfigured");
    return;
  }

  const shell = process.env.SHELL || (os.platform() === "win32" ? "powershell.exe" : "bash");
  const cols = Number(new URL(req.url, "http://x").searchParams.get("cols")) || 80;
  const rows = Number(new URL(req.url, "http://x").searchParams.get("rows")) || 24;

  const spawnOpts = {
    name: "xterm-color",
    cols,
    rows,
    cwd: SANDBOX_DIR,
    env: {
      TERM: "xterm-256color",
      HOME: SANDBOX_DIR,
      PATH: process.env.PATH,
      USER: "sandbox",
      LANG: "en_US.UTF-8",
      LC_ALL: "en_US.UTF-8",
    },
  };
  if (drop) {
    spawnOpts.uid = drop.uid;
    spawnOpts.gid = drop.gid;
  }

  let term;
  try {
    term = pty.spawn(shell, [], spawnOpts);
  } catch (err) {
    ws.close(1011, "failed to start shell");
    console.error("[terminal-ws] spawn error:", err.message);
    return;
  }

  let idle = setTimeout(() => {
    term.kill();
    ws.close(1000, "idle timeout");
  }, IDLE_TIMEOUT_MS);

  term.onData((data) => {
    if (ws.readyState === ws.OPEN) ws.send(data);
  });
  term.onExit(() => ws.close(1000, "shell exited"));

  ws.on("message", (msg) => {
    clearTimeout(idle);
    idle = setTimeout(() => {
      term.kill();
      ws.close(1000, "idle timeout");
    }, IDLE_TIMEOUT_MS);
    const buf = Buffer.isBuffer(msg) ? msg : Buffer.from(msg);
    if (buf.length > MAX_MSG_BYTES) return; // drop oversized input

    // JSON control message (e.g. resize) vs raw keystrokes.
    const text = buf.toString("utf-8");
    if (text.startsWith("{")) {
      try {
        const ctrl = JSON.parse(text);
        if (ctrl.type === "resize" && ctrl.cols && ctrl.rows) {
          term.resize(Number(ctrl.cols), Number(ctrl.rows));
        }
      } catch {
        /* ignore malformed control frames */
      }
      return;
    }
    term.write(text);
  });

  ws.on("close", () => {
    clearTimeout(idle);
    try {
      term.kill();
    } catch {
      /* ignore */
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[terminal-ws] listening on ${HOST}:${PORT} (sandbox: ${SANDBOX_DIR})`);
});

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
// Mirrors the AI Venture workspace sections (ai-venture-workspace.tsx).
const TOOLS = [
    { id: "research", title: "Research Lab", color: "#ff79c6" },
    { id: "playground", title: "Playground", color: "#bd93f9" },
    { id: "files", title: "Files", color: "#8be9fd" },
    { id: "useful-links", title: "Useful Links", color: "#ffb86c" },
    { id: "query", title: "AI Query", color: "#50fa7b" },
    { id: "brainstorm", title: "Brainstorm", color: "#ff5555" },
    { id: "notepad", title: "Notepad (Foam)", color: "#f1fa8c" },
    { id: "connected", title: "Connected Ideas", color: "#ffb86c" },
    { id: "agents", title: "Agents", color: "#6272a4" },
    { id: "activity", title: "Agents Activity", color: "#8be9fd" },
];
function getNonce() {
    let text = "";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}
function dashboardBase() {
    const cfg = vscode.workspace.getConfiguration("toolbox");
    const raw = (cfg.get("dashboardUrl") || "http://localhost:3000/ai-venture").trim();
    return raw.replace(/\/+$/, "");
}
function toolUrl(tool) {
    const base = dashboardBase();
    return tool.id ? `${base}?tab=${tool.id}` : base;
}
function openTool(tool) {
    const panel = vscode.window.createWebviewPanel(`toolbox.${tool.id || "home"}`, `AI Venture · ${tool.title}`, vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true,
    });
    // The webview simply frames the live dashboard tool. Because it IS the
    // dashboard app, every edit lands on the same backend and shows up in the
    // dashboard UI and project activity logs.
    panel.webview.html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http: https:; img-src http: https: data: blob:; style-src 'unsafe-inline'; font-src http: https: data:;" />
    <style>
      html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #1e1e1e; }
      iframe { display: block; width: 100%; height: 100%; border: 0; }
    </style>
  </head>
  <body>
    <iframe src="${toolUrl(tool)}" allow="clipboard-read; clipboard-write; fullscreen; camera; microphone"></iframe>
  </body>
</html>`;
}
class LauncherViewProvider {
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
    }
    resolveWebviewView(webviewView) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
        };
        webviewView.webview.html = this.getHtml(webviewView.webview);
        webviewView.webview.onDidReceiveMessage((msg) => {
            const tool = TOOLS.find((t) => t.id === msg.tool);
            if (tool)
                openTool(tool);
        });
    }
    getHtml(webview) {
        const nonce = getNonce();
        const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`;
        const tiles = TOOLS.map((t) => `
      <button class="tile" data-tool="${t.id}">
        <span class="dot" style="background:${t.color}"></span>
        <span class="label">${t.title}</span>
      </button>`).join("");
        return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0; padding: 12px;
        font-family: var(--vscode-font-family, sans-serif);
        background: var(--vscode-sideBar-background, #1e1e1e);
        color: var(--vscode-foreground, #ddd);
      }
      h1 {
        font-size: 13px; font-weight: 600; text-transform: uppercase;
        letter-spacing: .08em; opacity: .7; margin: 4px 2px 12px;
      }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .tile {
        display: flex; align-items: center; gap: 8px;
        padding: 12px 10px; border: 1px solid var(--vscode-panel-border, #333);
        border-radius: 10px; background: var(--vscode-editor-background, #252526);
        color: inherit; cursor: pointer; text-align: left;
        transition: transform .08s ease, border-color .15s ease;
      }
      .tile:hover { border-color: var(--vscode-focusBorder, #4ea1ff); transform: translateY(-2px); }
      .tile:active { transform: translateY(0); }
      .dot { width: 14px; height: 14px; border-radius: 4px; flex: 0 0 auto; }
      .label { font-size: 12px; font-weight: 600; line-height: 1.1; }
      .hint { margin: 12px 2px 0; font-size: 11px; opacity: .6; line-height: 1.4; }
    </style>
  </head>
  <body>
    <h1>AI Venture Tools</h1>
    <div class="grid">${tiles}</div>
    <div class="hint">Opens the live dashboard tool. Log in once inside the panel; edits sync to the dashboard and project logs.</div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      document.querySelectorAll('.tile').forEach((el) => {
        el.addEventListener('click', () => vscode.postMessage({ tool: el.getAttribute('data-tool') }));
      });
    </script>
  </body>
</html>`;
    }
}
function activate(context) {
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("toolbox.launcher", new LauncherViewProvider(context.extensionUri)));
    const openById = (id) => {
        const tool = TOOLS.find((t) => t.id === id);
        if (tool)
            openTool(tool);
    };
    context.subscriptions.push(vscode.commands.registerCommand("toolbox.openResearch", () => openById("research")), vscode.commands.registerCommand("toolbox.openPlayground", () => openById("playground")), vscode.commands.registerCommand("toolbox.openFiles", () => openById("files")), vscode.commands.registerCommand("toolbox.openUsefulLinks", () => openById("useful-links")), vscode.commands.registerCommand("toolbox.openQuery", () => openById("query")), vscode.commands.registerCommand("toolbox.openBrainstorm", () => openById("brainstorm")), vscode.commands.registerCommand("toolbox.openNotepad", () => openById("notepad")), vscode.commands.registerCommand("toolbox.openConnected", () => openById("connected")), vscode.commands.registerCommand("toolbox.openAgents", () => openById("agents")), vscode.commands.registerCommand("toolbox.openActivity", () => openById("activity")));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map
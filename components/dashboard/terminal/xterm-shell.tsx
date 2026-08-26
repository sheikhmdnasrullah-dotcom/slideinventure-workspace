"use client";

import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export function XTermShell() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const lineBuf = useRef("");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
      theme: {
        background: "#0b0b0f",
        foreground: "#e6e6e6",
        cursor: "#e6e6e6",
      },
      convertEol: true,
    });
    termRef.current = term;
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${proto}://${window.location.host}/ws/terminal?cols=${term.cols}&rows=${term.rows}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      term.write("\x1b[2mconnected to live shell — sandboxed\x1b[0m\r\n");
    };
    ws.onmessage = (ev) => term.write(ev.data as string);
    ws.onclose = () => term.write("\r\n\x1b[31m[connection closed]\x1b[0m\r\n");
    ws.onerror = () => term.write("\r\n\x1b[31m[connection error]\x1b[0m\r\n");

    const sendCommand = (line: string) => {
      if (!line.trim()) return;
      fetch("/api/terminal/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command: line }),
      }).catch(() => {});
    };

    term.onData((data) => {
      // Capture completed command lines for audit logging.
      if (data === "\r") {
        sendCommand(lineBuf.current);
        lineBuf.current = "";
      } else if (data === "\x7f") {
        lineBuf.current = lineBuf.current.slice(0, -1);
      } else if (data >= " " || data === "\t") {
        lineBuf.current += data;
      }
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    const onResize = () => {
      fit.fit();
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      term.dispose();
    };
  }, []);

  return <div ref={containerRef} className="h-[60vh] w-full rounded-md bg-[#0b0b0f] p-2" />;
}

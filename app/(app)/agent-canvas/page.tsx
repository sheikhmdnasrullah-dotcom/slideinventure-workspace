import { AgentCanvasWorkspace } from "@/components/canvas/agent-canvas-workspace";

export default function AgentCanvasPage() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Agent Canvas</h1>
        <p className="text-sm text-muted-foreground">
          Visual orchestration of the autonomous pipeline — browser navigation,
          CAPTCHA solving, deep crawling, and TrueMail validation — driven by the
          AG-UI event protocol and powered by DeepSeek.
        </p>
      </header>
      <AgentCanvasWorkspace />
    </div>
  );
}

import { AgentCanvasWorkspace } from "@/components/canvas/agent-canvas-workspace";

export default function AgentCanvasPage() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Agent Canvas</h1>
      </header>
      <AgentCanvasWorkspace />
    </div>
  );
}

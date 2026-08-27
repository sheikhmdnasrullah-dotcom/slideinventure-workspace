import { AiChat } from "@/components/chat/ai-chat";

export default function AiChatPage() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">AI SDK Chat</h1>
        <p className="text-sm text-muted-foreground">
          A live <code>useChat</code> widget from the Vercel AI SDK, streaming
          through <code>streamText</code> on DeepSeek. This is the official
          frontend protocol layer for all agents.
        </p>
      </header>
      <AiChat />
    </div>
  );
}

import { AiChat } from "@/components/chat/ai-chat";

export default function AiChatPage() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">AI SDK Chat</h1>
      </header>
      <AiChat />
    </div>
  );
}

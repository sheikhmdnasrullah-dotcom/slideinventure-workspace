import { AiChat } from "@/components/chat/ai-chat";

export default function AiChatPage() {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-5 md:px-10 md:py-10">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">AI SDK Chat</h1>
      </header>
      <AiChat />
    </div>
  );
}

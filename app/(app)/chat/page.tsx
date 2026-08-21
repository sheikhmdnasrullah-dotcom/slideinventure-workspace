import { requireUser } from "@/lib/supabase/server";
import { ChatInterface } from "@/components/chat/chat-interface";

export default async function ChatPage() {
  await requireUser();
  return <ChatInterface />;
}
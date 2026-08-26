import "server-only";
import { chatCompletion, NVIDIA_DEFAULT_MODEL } from "./gateway";

export { NVIDIA_DEFAULT_MODEL };

export async function nvidiaComplete(
  messages: Array<{ role: string; content: string }>,
  options: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  return chatCompletion(messages, options);
}

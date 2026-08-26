import { requireUser } from "@/lib/supabase/server";
import { EvalConsole } from "@/components/dashboard/eval/eval-console";

export default async function EvalPage() {
  await requireUser();
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-sm font-medium tracking-wide text-foreground/60 uppercase">Eval</h1>
        <p className="text-xs text-foreground/40">
          Internal RAG evaluation (Ragas-style, LLM-as-judge): faithfulness, answer relevancy,
          context relevancy. Not user-facing.
        </p>
      </div>
      <EvalConsole />
    </div>
  );
}

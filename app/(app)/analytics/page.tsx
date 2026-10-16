import { BentoDashboard } from "@/components/dashboard/bento-dashboard";

export default function AnalyticsPage() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 py-5 md:px-10 md:py-10">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Live throughput, provider token usage, and execution distribution
          across every agent run (Tremor + MagicUI).
        </p>
      </header>
      <BentoDashboard />
    </div>
  );
}

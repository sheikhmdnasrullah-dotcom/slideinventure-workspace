import { BentoDashboard } from "@/components/dashboard/bento-dashboard";

export default function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-6xl p-6">
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

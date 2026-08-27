"use client";

import * as React from "react";
import { Card, Metric, Text, AreaChart, BarList, Title, Flex, Grid } from "@tremor/react";
import { BentoCard, BentoGrid } from "@/components/ui/magicui/bento-grid";
import { AnimatedBeam } from "@/components/ui/magicui/animated-beam";
import { AGENT_STAGES } from "@/lib/agui/bus";

type Usage = Record<
  string,
  { model: string; inputTokens: number; outputTokens: number; calls: number; errors: number }
>;

export function BentoDashboard() {
  const [usage, setUsage] = React.useState<Usage>({});
  const [beamA, beamB] = [React.useRef<HTMLDivElement>(null), React.useRef<HTMLDivElement>(null)];
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/metrics");
        const data = await res.json();
        if (active) setUsage(data.usage ?? {});
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const providers = Object.entries(usage);
  const totalIn = providers.reduce((s, [, v]) => s + v.inputTokens, 0);
  const totalOut = providers.reduce((s, [, v]) => s + v.outputTokens, 0);
  const totalCalls = providers.reduce((s, [, v]) => s + v.calls, 0);
  const totalErrors = providers.reduce((s, [, v]) => s + v.errors, 0);

  const chartData = providers.map(([name, v]) => ({
    provider: name,
    "Input Tokens": v.inputTokens,
    "Output Tokens": v.outputTokens,
  }));

  const providerList = providers.map(([name, v]) => ({
    name: `${name} (${v.model})`,
    value: v.calls,
  }));

  return (
    <div ref={containerRef} className="relative">
      <BentoGrid>
        <BentoCard>
          <Text>Total Tokens</Text>
          <Metric>{(totalIn + totalOut).toLocaleString()}</Metric>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span>In: {totalIn.toLocaleString()}</span>
            <span>Out: {totalOut.toLocaleString()}</span>
          </div>
        </BentoCard>

        <BentoCard>
          <Text>Calls / Errors</Text>
          <Metric>
            {totalCalls}
            <span className="ml-2 text-sm font-normal text-rose-400">err {totalErrors}</span>
          </Metric>
          <div ref={beamA} className="mt-3 h-1 w-full rounded bg-primary/30" />
        </BentoCard>

        <BentoCard>
          <Title>Pipeline Stages</Title>
          <div ref={beamB} className="mt-3 flex flex-wrap gap-2">
            {AGENT_STAGES.map((s) => (
              <span key={s} className="rounded-full border px-2 py-0.5 text-[10px] uppercase">
                {s}
              </span>
            ))}
          </div>
        </BentoCard>

        <BentoCard className="sm:col-span-2">
          <Title>Token Usage by Provider</Title>
          <AreaChart
            className="mt-4 h-48"
            data={chartData}
            index="provider"
            categories={["Input Tokens", "Output Tokens"]}
            colors={["blue", "emerald"]}
            yAxisWidth={48}
          />
        </BentoCard>

        <BentoCard>
          <Title>Calls per Provider</Title>
          <BarList className="mt-4" data={providerList} color="blue" />
        </BentoCard>
      </BentoGrid>

      <AnimatedBeam
        className="opacity-60"
        containerRef={containerRef}
        fromRef={beamA}
        toRef={beamB}
        curvature={80}
      />
    </div>
  );
}

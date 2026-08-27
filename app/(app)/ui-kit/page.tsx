import { UiKit } from "@/components/shadcn/ui-kit";

export default function UiKitPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">UI Kit</h1>
        <p className="text-sm text-muted-foreground">
          The dashboard&apos;s accessible primitive layer is built on
          shadcn/ui (Radix + cva). This page showcases the integrated
          components, including the cmdk-powered Command palette.
        </p>
      </header>
      <UiKit />
    </div>
  );
}

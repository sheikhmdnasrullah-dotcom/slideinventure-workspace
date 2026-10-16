import { UiKit } from "@/components/shadcn/ui-kit";

export default function UiKitPage() {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-5 md:px-10 md:py-10">
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

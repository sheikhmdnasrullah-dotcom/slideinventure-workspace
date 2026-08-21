import { SiteHeader } from "@/components/dashboard/site-header";
import { PageHeader, Surface, EmptyState } from "@/components/system";

/**
 * ComingSoon — the "not built yet" surface. Rendered by stub routes the new
 * sidebar IA exposes (activity, prospects, research, insights, agents) so
 * navigation never 404s. Upgraded from a Card to the new primitives: a
 * Surface (flat, not boxed) carrying an EmptyState. The structure is right
 * even before the data is.
 */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <>
      <SiteHeader title={title} />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <PageHeader eyebrow="System" title={title} />
        <Surface variant="inset">
          <EmptyState
            eyebrow="Not built yet"
            title="This surface is scaffolded"
            description={description}
          />
        </Surface>
      </div>
    </>
  );
}

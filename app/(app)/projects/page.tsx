import { requireUser } from "@/lib/supabase/server";
import { ProjectsList } from "@/components/projects/projects-list";
import { SiteHeader } from "@/components/dashboard/site-header";

export default async function ProjectsPage() {
  await requireUser();

  return (
    <>
      <SiteHeader crumbs={[{ label: "Projects" }]} subtitle="Project workspaces" />
      <div className="h-[calc(100vh-var(--header-height))] overflow-auto">
        <ProjectsList />
      </div>
    </>
  );
}

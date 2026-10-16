import { requireUser } from "@/lib/supabase/server";
import { ProjectWorkspaceView } from "@/components/projects/project-workspace";
import { SiteHeader } from "@/components/dashboard/site-header";

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  return (
    <>
      <SiteHeader
        crumbs={[{ label: "Projects", href: "/projects" }, { label: "Workspace" }]}
        subtitle="Project workspace"
      />
      <div className="h-[calc(100vh-var(--header-height))] overflow-hidden">
        <ProjectWorkspaceView projectId={id} />
      </div>
    </>
  );
}

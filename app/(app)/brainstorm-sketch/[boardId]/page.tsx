import { BrainstormWorkspace } from "@/components/dashboard/v3/brainstorm/BrainstormWorkspace"

export default async function BrainstormBoardPage(props: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await props.params
  return <BrainstormWorkspace boardId={boardId} />
}

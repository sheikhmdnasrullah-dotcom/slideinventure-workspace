import { NextRequest } from "next/server";
import { checkUpcomingDeadlines } from "@/lib/todoist/reminders";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await checkUpcomingDeadlines();
    return Response.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Cron todoist-reminders failed:", error);
    return Response.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

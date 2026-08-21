"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail } from "lucide-react";

export function ColdEmailPanel() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [running, setRunning] = useState(false);

  const send = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast.error("Fill in all fields");
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/tasks/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_type: "cold_email",
          command: `send_email to=${to} subject=${subject}`,
          triggered_by: "dashboard",
          metadata: { to, subject, body },
        }),
      });

      if (!res.ok) {
        toast.error("Failed to queue email");
        return;
      }

      toast.success("Email queued — check activity feed");
      setTo("");
      setSubject("");
      setBody("");
    } catch {
      toast.error("Email failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-foreground/10 bg-background/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Mail className="size-4" />
          Cold Outreach
        </div>
        <Badge variant="outline" className="text-xs">
          {running ? "Sending..." : "Ready"}
        </Badge>
      </div>

      <Input
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="recipient@example.com"
        className="text-sm"
        disabled={running}
      />
      <Input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject line"
        className="text-sm"
        disabled={running}
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your cold email..."
        className="min-h-[100px] text-sm"
        disabled={running}
      />
      <Button onClick={send} disabled={running || !to.trim() || !subject.trim() || !body.trim()} className="self-end">
        {running ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
        Send Email
      </Button>
    </div>
  );
}

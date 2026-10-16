"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { GlossTile } from "@/components/system/gloss-tile";

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({} as { error?: string }));
      setError(data.error || "Signup failed");
      setLoading(false);
      return;
    }

    window.location.assign("/");
  }

  return (
    <div className={cn("flex flex-col items-center gap-6", className)} {...props}>
      <GlossTile size={64} float={false} />
      <Card className="w-full text-center">
        <CardHeader>
          <CardTitle className="text-ink-strong">Create an account</CardTitle>
          <CardDescription className="text-ink-muted">
            Create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="w-full text-left">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name" >
                  Name
                </FieldLabel>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="email" >
                  Email
                </FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password" >
                  Password
                </FieldLabel>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  
                />
              </Field>
              {error && (
                <p className="text-sm text-status-danger">{error}</p>
              )}
              <Field>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Creating account..." : "Sign up"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

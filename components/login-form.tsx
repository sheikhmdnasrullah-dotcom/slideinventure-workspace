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
import Link from "next/link";
import { GlossTile } from "@/components/system/gloss-tile";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        setError(data.error || "Invalid email or password");
        setLoading(false);
        return;
      }

      window.location.assign("/");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className={cn("flex flex-col items-center gap-6", className)} {...props}>
      <GlossTile size={64} float={false} />
      <Card className="w-full text-center">
        <CardHeader>
          <CardTitle className="text-ink-strong">Login to your account</CardTitle>
          <CardDescription className="text-ink-muted">
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="w-full text-left">
            <FieldGroup>
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
                  {loading ? "Logging in..." : "Login"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-ink-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-ink-strong underline underline-offset-4">
          Sign up
        </Link>
      </p>
    </div>
  );
}

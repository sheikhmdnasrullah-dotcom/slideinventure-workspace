"use client";

import { ExternalLink, Pencil } from "lucide-react";
import { STIRLING_PDF_URL } from "@/lib/pdf-editor";
import { Button } from "@/components/ui/button";

export function PdfEditorLink({
  label = "PDF Editor",
  variant = "outline",
  size = "sm",
  className,
}: {
  label?: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "sm" | "xs" | "default" | "icon-sm";
  className?: string;
}) {
  return (
    <a href={STIRLING_PDF_URL} target="_blank" rel="noopener noreferrer" className={className}>
      <Button size={size} variant={variant} title="Open Stirling-PDF editor">
        <Pencil className="size-3.5" /> {label}
        <ExternalLink className="size-3" />
      </Button>
    </a>
  );
}

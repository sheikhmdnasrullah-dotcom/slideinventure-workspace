import { jsPDF } from "jspdf";

export type ExportFormat = "txt" | "md" | "pdf" | "all";

export type InlineStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  textColor?: string;
  backgroundColor?: string;
};

export type InlineContent =
  | {
      type: "text";
      text: string;
      styles?: InlineStyle;
    }
  | {
      type: "link";
      href: string;
      content: Array<{ type: "text"; text: string; styles?: InlineStyle }>;
    }
  | string;

export type Block = {
  id?: string;
  type?: string;
  props?: Record<string, any>;
  content?: InlineContent[] | string;
  children?: Block[];
};

/**
 * Format inline content array to Markdown
 */
function inlineToMarkdown(inline: InlineContent[] | string | undefined): string {
  if (!inline) return "";
  if (typeof inline === "string") return inline;
  if (!Array.isArray(inline)) return String(inline);

  return inline
    .map((item) => {
      if (typeof item === "string") return item;
      if (item.type === "link") {
        const text = inlineToMarkdown(item.content) || item.href;
        return `[${text}](${item.href})`;
      }
      if (item.type === "text") {
        let text = item.text || "";
        if (!text) return "";
        const s = item.styles || {};
        if (s.code) text = `\`${text}\``;
        if (s.bold) text = `**${text}**`;
        if (s.italic) text = `*${text}*`;
        if (s.strike) text = `~~${text}~~`;
        if (s.underline) text = `<u>${text}</u>`;
        return text;
      }
      return "";
    })
    .join("");
}

/**
 * Format inline content array to Plain Text
 */
function inlineToPlainText(inline: InlineContent[] | string | undefined): string {
  if (!inline) return "";
  if (typeof inline === "string") return inline;
  if (!Array.isArray(inline)) return String(inline);

  return inline
    .map((item) => {
      if (typeof item === "string") return item;
      if (item.type === "link") {
        const text = inlineToPlainText(item.content);
        return text ? `${text} (${item.href})` : item.href;
      }
      if (item.type === "text") {
        return item.text || "";
      }
      return "";
    })
    .join("");
}

/**
 * Parses note content string into an array of blocks or returns raw string
 */
export function parseBlocks(content: string | undefined | null): Block[] | string {
  if (!content || content.trim() === "" || content === "[]") return [];
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed as Block[];
    if (typeof parsed === "string") return parsed;
    return [parsed as Block];
  } catch {
    return content;
  }
}

/**
 * Converts note content (BlockNote JSON or raw text) into Markdown
 */
export function noteToMarkdown(title: string, content: string | undefined | null): string {
  const blocks = parseBlocks(content);
  const out: string[] = [];

  const cleanTitle = (title || "").trim();
  if (cleanTitle && cleanTitle.toLowerCase() !== "untitled" && cleanTitle.toLowerCase() !== "untitled note") {
    out.push(`# ${cleanTitle}\n`);
  }

  if (typeof blocks === "string") {
    out.push(blocks);
    return out.join("\n").trim();
  }

  let listIndex = 1;

  function processBlocks(items: Block[], depth = 0) {
    const indent = "  ".repeat(depth);

    for (let i = 0; i < items.length; i++) {
      const b = items[i];
      const type = b.type || "paragraph";
      const props = b.props || {};
      const text = inlineToMarkdown(b.content);

      if (type !== "numberedListItem") {
        listIndex = 1;
      }

      switch (type) {
        case "heading": {
          const level = Math.min(Math.max(Number(props.level) || 1, 1), 6);
          const hashes = "#".repeat(level);
          out.push(`${hashes} ${text}\n`);
          break;
        }
        case "bulletListItem": {
          out.push(`${indent}- ${text}`);
          break;
        }
        case "numberedListItem": {
          out.push(`${indent}${listIndex}. ${text}`);
          listIndex++;
          break;
        }
        case "checkListItem": {
          const check = props.checked ? "[x]" : "[ ]";
          out.push(`${indent}- ${check} ${text}`);
          break;
        }
        case "codeBlock": {
          const lang = props.language || "";
          out.push(`\`\`\`${lang}\n${text}\n\`\`\`\n`);
          break;
        }
        case "quote":
        case "callout": {
          out.push(`> ${text}\n`);
          break;
        }
        case "image": {
          const url = props.url || "";
          const caption = props.caption || props.alt || "image";
          out.push(`![${caption}](${url})\n`);
          break;
        }
        case "table": {
          if (Array.isArray(props.rows)) {
            props.rows.forEach((row: any, rIdx: number) => {
              if (Array.isArray(row)) {
                out.push(`| ${row.map((cell: any) => inlineToMarkdown(cell)).join(" | ")} |`);
                if (rIdx === 0) {
                  out.push(`| ${row.map(() => "---").join(" | ")} |`);
                }
              }
            });
            out.push("");
          }
          break;
        }
        case "divider": {
          out.push("---\n");
          break;
        }
        case "paragraph":
        default: {
          if (text.trim()) {
            out.push(`${indent}${text}\n`);
          } else {
            out.push("");
          }
          break;
        }
      }

      if (b.children && Array.isArray(b.children) && b.children.length > 0) {
        processBlocks(b.children, depth + 1);
      }
    }
  }

  processBlocks(blocks);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Converts note content into clean Plain Text
 */
export function noteToPlainText(title: string, content: string | undefined | null): string {
  const blocks = parseBlocks(content);
  const out: string[] = [];

  const cleanTitle = (title || "").trim();
  if (cleanTitle && cleanTitle.toLowerCase() !== "untitled" && cleanTitle.toLowerCase() !== "untitled note") {
    out.push(`${cleanTitle.toUpperCase()}\n${"=".repeat(Math.max(cleanTitle.length, 10))}\n`);
  }

  if (typeof blocks === "string") {
    out.push(blocks);
    return out.join("\n").trim();
  }

  let listIndex = 1;

  function processBlocks(items: Block[], depth = 0) {
    const indent = "  ".repeat(depth);

    for (let i = 0; i < items.length; i++) {
      const b = items[i];
      const type = b.type || "paragraph";
      const props = b.props || {};
      const text = inlineToPlainText(b.content);

      if (type !== "numberedListItem") {
        listIndex = 1;
      }

      switch (type) {
        case "heading": {
          out.push(`\n${text}\n${"-".repeat(Math.min(text.length, 40))}`);
          break;
        }
        case "bulletListItem": {
          out.push(`${indent}• ${text}`);
          break;
        }
        case "numberedListItem": {
          out.push(`${indent}${listIndex}. ${text}`);
          listIndex++;
          break;
        }
        case "checkListItem": {
          const check = props.checked ? "[✓]" : "[ ]";
          out.push(`${indent}${check} ${text}`);
          break;
        }
        case "codeBlock": {
          out.push(`\n--- CODE SNIPPET (${props.language || "text"}) ---\n${text}\n-----------------------------\n`);
          break;
        }
        case "quote":
        case "callout": {
          out.push(`${indent}| ${text}`);
          break;
        }
        case "divider": {
          out.push("\n----------------------------------------\n");
          break;
        }
        case "paragraph":
        default: {
          if (text.trim()) {
            out.push(`${indent}${text}`);
          }
          break;
        }
      }

      if (b.children && Array.isArray(b.children) && b.children.length > 0) {
        processBlocks(b.children, depth + 1);
      }
    }
  }

  processBlocks(blocks);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Generates a clean, professional PDF document from note content using jsPDF
 */
export async function noteToPdfBlob(title: string, content: string | undefined | null): Promise<Blob> {
  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin + 15;

  const checkPageBreak = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - margin) {
      doc.addPage();
      cursorY = margin + 15;
    }
  };

  // Header Title
  const cleanTitle = (title || "Untitled Note").trim();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(24, 24, 27); // slate-900
  const titleLines = doc.splitTextToSize(cleanTitle, contentWidth);
  doc.text(titleLines, margin, cursorY);
  cursorY += titleLines.length * 26 + 6;

  // Metadata Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(113, 113, 122); // slate-500
  const dateStr = `Exported from AI Venture Notepad • ${new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  doc.text(dateStr, margin, cursorY);
  cursorY += 16;

  // Divider rule
  doc.setDrawColor(228, 228, 231); // zinc-200
  doc.setLineWidth(1);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 24;

  const blocks = parseBlocks(content);

  if (typeof blocks === "string") {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(39, 39, 42);
    const lines = doc.splitTextToSize(blocks, contentWidth);
    for (const line of lines) {
      checkPageBreak(16);
      doc.text(line, margin, cursorY);
      cursorY += 16;
    }
  } else {
    let listCounter = 1;

    const renderBlocks = (items: Block[], depth = 0) => {
      const leftMargin = margin + depth * 16;
      const blockWidth = contentWidth - depth * 16;

      for (const b of items) {
        const type = b.type || "paragraph";
        const props = b.props || {};
        const text = inlineToPlainText(b.content);

        if (type !== "numberedListItem") {
          listCounter = 1;
        }

        switch (type) {
          case "heading": {
            const level = Number(props.level) || 1;
            const fontSize = level === 1 ? 16 : level === 2 ? 13.5 : 12;
            const lineHeight = fontSize + 8;
            cursorY += 10;
            checkPageBreak(lineHeight + 12);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(fontSize);
            doc.setTextColor(15, 23, 42); // slate-900
            const lines = doc.splitTextToSize(text, blockWidth);
            doc.text(lines, leftMargin, cursorY);
            cursorY += lines.length * lineHeight;
            break;
          }
          case "bulletListItem": {
            checkPageBreak(18);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10.5);
            doc.setTextColor(39, 39, 42);
            doc.circle(leftMargin + 3, cursorY - 3.5, 2, "F");
            const lines = doc.splitTextToSize(text, blockWidth - 14);
            doc.text(lines, leftMargin + 14, cursorY);
            cursorY += Math.max(lines.length * 15, 18);
            break;
          }
          case "numberedListItem": {
            checkPageBreak(18);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10.5);
            doc.setTextColor(39, 39, 42);
            const numStr = `${listCounter}.`;
            listCounter++;
            doc.text(numStr, leftMargin, cursorY);
            const lines = doc.splitTextToSize(text, blockWidth - 18);
            doc.text(lines, leftMargin + 18, cursorY);
            cursorY += Math.max(lines.length * 15, 18);
            break;
          }
          case "checkListItem": {
            checkPageBreak(18);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10.5);
            doc.setTextColor(39, 39, 42);
            const boxStr = props.checked ? "[✓]" : "[  ]";
            doc.text(boxStr, leftMargin, cursorY);
            const lines = doc.splitTextToSize(text, blockWidth - 20);
            doc.text(lines, leftMargin + 20, cursorY);
            cursorY += Math.max(lines.length * 15, 18);
            break;
          }
          case "codeBlock": {
            const lines = doc.splitTextToSize(text, blockWidth - 16);
            const boxHeight = lines.length * 14 + 14;
            checkPageBreak(boxHeight + 8);
            doc.setFillColor(244, 244, 245); // zinc-100
            doc.setDrawColor(228, 228, 231);
            doc.roundedRect(leftMargin, cursorY - 10, blockWidth, boxHeight, 4, 4, "FD");
            doc.setFont("courier", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(24, 24, 27);
            doc.text(lines, leftMargin + 8, cursorY + 4);
            cursorY += boxHeight + 8;
            break;
          }
          case "quote":
          case "callout": {
            const lines = doc.splitTextToSize(text, blockWidth - 18);
            const quoteHeight = lines.length * 15 + 4;
            checkPageBreak(quoteHeight);
            doc.setDrawColor(99, 102, 241); // indigo-500
            doc.setLineWidth(3);
            doc.line(leftMargin, cursorY - 8, leftMargin, cursorY - 8 + quoteHeight);
            doc.setFont("helvetica", "italic");
            doc.setFontSize(10);
            doc.setTextColor(71, 85, 105);
            doc.text(lines, leftMargin + 10, cursorY + 2);
            cursorY += quoteHeight + 8;
            break;
          }
          case "divider": {
            checkPageBreak(16);
            doc.setDrawColor(228, 228, 231);
            doc.setLineWidth(1);
            doc.line(leftMargin, cursorY, leftMargin + blockWidth, cursorY);
            cursorY += 16;
            break;
          }
          case "paragraph":
          default: {
            if (text.trim()) {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(10.5);
              doc.setTextColor(39, 39, 42);
              const lines = doc.splitTextToSize(text, blockWidth);
              checkPageBreak(lines.length * 15 + 6);
              doc.text(lines, leftMargin, cursorY);
              cursorY += lines.length * 15 + 6;
            } else {
              cursorY += 8;
            }
            break;
          }
        }

        if (b.children && Array.isArray(b.children) && b.children.length > 0) {
          renderBlocks(b.children, depth + 1);
        }
      }
    };

    renderBlocks(blocks);
  }

  // Page numbering footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(161, 161, 170); // zinc-400
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 24,
      { align: "center" }
    );
  }

  return doc.output("blob");
}

/**
 * Triggers a browser download of a Blob or string
 */
export function downloadFile(content: Blob | string, filename: string, mimeType = "text/plain;charset=utf-8") {
  const blob = typeof content === "string" ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Helper to sanitize filenames
 */
export function sanitizeFilename(name: string): string {
  const cleaned = (name || "Untitled Note")
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return cleaned || "Untitled Note";
}

/**
 * Saves a file to AI Venture Files section via the API
 */
export async function saveToAiVentureFiles(
  folderPath: string,
  filename: string,
  content: string | Blob,
  isBase64 = false
): Promise<boolean> {
  const path = folderPath ? `${folderPath}/${filename}` : filename;

  if (typeof content === "string" && !isBase64) {
    const res = await fetch("/api/ai-venture/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content, encoding: "utf-8" }),
    });
    return res.ok;
  }

  if (typeof content === "string" && isBase64) {
    const res = await fetch("/api/ai-venture/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content, encoding: "base64" }),
    });
    return res.ok;
  }

  // Blob upload via multipart form data
  const form = new FormData();
  const file = new File([content], filename, { type: (content as Blob).type });
  form.append("file", file);
  form.append("folder", folderPath);
  const res = await fetch("/api/ai-venture/upload", { method: "POST", body: form });
  return res.ok;
}

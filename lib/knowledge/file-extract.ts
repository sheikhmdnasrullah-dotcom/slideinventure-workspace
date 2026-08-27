const TEXT_EXTENSIONS = ["md", "markdown", "txt", "text", "json", "csv", "tsv", "log", "yml", "yaml", "env"]
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]

export type ExtractedFile = {
  text: string
  title?: string
  contentType: string
}

export async function extractFileText(file: File): Promise<ExtractedFile> {
  const name = file.name || "upload"
  const ext = name.split(".").pop()?.toLowerCase() || ""
  const buffer = Buffer.from(await file.arrayBuffer())

  if (ext === "pdf") {
    try {
      // pdf-parse 2.x replaced the old callable-function API with a class;
      // `new PDFParse({ data }).getText()` is the current shape. Requires
      // pdf-parse/pdfjs-dist to stay in next.config.ts's
      // serverExternalPackages. Bundling them breaks the worker script's
      // self-relative import at runtime.
      const { PDFParse } = await import("pdf-parse")
      const parser = new PDFParse({ data: buffer })
      const parsed = await parser.getText()
      return {
        text: parsed.text || "",
        title: name.replace(/\.pdf$/i, ""),
        contentType: "pdf",
      }
    } catch (err) {
      console.error("PDF extraction failed:", err)
      return {
        text: "[Uploaded PDF: " + name + "] - text extraction failed.",
        title: name.replace(/\.pdf$/i, ""),
        contentType: "pdf",
      }
    }
  }

  if (ext === "docx") {
    try {
      const mammoth = await import("mammoth")
      const { value } = await mammoth.extractRawText({ buffer })
      return {
        text: value || "",
        title: name.replace(/\.docx$/i, ""),
        contentType: "docx",
      }
    } catch (err) {
      console.error("DOCX extraction failed:", err)
      return {
        text: "[Uploaded DOCX: " + name + "] - text extraction failed.",
        title: name.replace(/\.docx$/i, ""),
        contentType: "docx",
      }
    }
  }

  if (TEXT_EXTENSIONS.includes(ext)) {
    const text = buffer.toString("utf-8")
    return { text, title: name, contentType: ext }
  }

  if (IMAGE_EXTENSIONS.includes(ext)) {
    return {
      text:
        "[Uploaded image file: " +
        name +
        "]\n\nThis is an image (" +
        (file.type || ext) +
        "). Its visual content is stored in the knowledge base but is not text-searchable.",
      title: name,
      contentType: ext,
    }
  }

  const asText = buffer.toString("utf-8")
  if (asText && !asText.includes("�")) {
    return { text: asText, title: name, contentType: ext || "binary" }
  }

  return {
    text: "[Uploaded file: " + name + "] (type: " + (file.type || ext || "unknown") + ")",
    title: name,
    contentType: ext || "binary",
  }
}

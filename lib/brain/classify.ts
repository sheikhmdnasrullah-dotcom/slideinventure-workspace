/**
 * Where a captured piece of research should land inside AI Venture.
 *
 * Deliberately rule-based, not an LLM call: routing has to be predictable and
 * free, and it runs on every save from VS Code / the terminal. The LLM is only
 * used later, by captureResearchInsight, to write the bullet summary.
 *
 * The Brain always receives the summary (that is the whole point of the
 * section). The other destinations are additive.
 */

export type BrainDestination = "brain" | "files" | "notepad" | "agents";

export type ClassifyInput = {
  /** Human title, usually a filename or the first heading. */
  title: string;
  /** Raw captured text. */
  text: string;
  /** Where the capture came from. */
  source: "editor" | "terminal" | "external" | "chat" | "agent";
  /** Original path on disk, when the capture is a file. */
  path?: string | null;
  /** Caller-forced destinations; skips the rules entirely. */
  force?: BrainDestination[];
};

export type Classification = {
  destinations: BrainDestination[];
  /** One short line per destination explaining why it was chosen. */
  reasons: string[];
};

// Extensions worth keeping as a real file in the Files section rather than only
// as a summary. Matches the set AI Venture's own file system accepts.
const FILE_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".csv",
  ".tsv",
  ".json",
  ".pdf",
  ".docx",
]);

// A note is prose the user is thinking in, not a document they produced.
const NOTE_PATH_HINT = /(^|\/)(notes?|journal|scratch|ideas?)(\/|$)/i;
const NOTE_TITLE_HINT = /^(note|idea|scratch|journal|thought)s?\b/i;

// Something an agent should execute, not just something to remember. Anchored
// at the start of a line so prose that merely mentions "todo" doesn't qualify.
const AGENT_DIRECTIVE = /^\s*(?:[-*+]\s*)?(?:\[ \]\s*)?(?:TODO|ACTION|NEXT|AGENT|RUN|DO)\s*[::-]/im;
const AGENT_MENTION = /(^|\s)@agent\b/i;

function extensionOf(nameOrPath: string): string {
  const base = nameOrPath.split("/").pop() ?? nameOrPath;
  const i = base.lastIndexOf(".");
  return i > 0 ? base.slice(i).toLowerCase() : "";
}

export function classifyCapture(input: ClassifyInput): Classification {
  if (input.force?.length) {
    const forced = Array.from(new Set<BrainDestination>(["brain", ...input.force]));
    return { destinations: forced, reasons: ["Destination set explicitly by the caller."] };
  }

  const destinations = new Set<BrainDestination>(["brain"]);
  const reasons: string[] = ["Every capture is summarized into the Brain."];

  const path = input.path ?? "";
  const ext = extensionOf(path || input.title);
  const isNotePath = NOTE_PATH_HINT.test(path) || NOTE_TITLE_HINT.test(input.title);

  if (isNotePath) {
    destinations.add("notepad");
    reasons.push("Reads as a personal note (note-like path or title), so it also goes to Notepad.");
  } else if (path && FILE_EXTENSIONS.has(ext)) {
    destinations.add("files");
    reasons.push(`Came from a real ${ext} file, so the file itself is kept in Files.`);
  }

  if (AGENT_DIRECTIVE.test(input.text) || AGENT_MENTION.test(input.text)) {
    destinations.add("agents");
    reasons.push("Contains an explicit directive (TODO/ACTION/@agent), so an agent task is queued.");
  }

  return { destinations: Array.from(destinations), reasons };
}

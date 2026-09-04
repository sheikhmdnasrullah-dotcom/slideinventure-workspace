import "server-only";

const TRACKING_PLACEHOLDER = "{{.TrackingURL}}";

export class GophishError extends Error {
  public readonly status?: number;
  public readonly endpoint?: string;
  constructor(message: string, status?: number, endpoint?: string) {
    super(message);
    this.name = "GophishError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

function getConfig() {
  const apiUrl = process.env.GOPHISH_API_URL;
  const apiKey = process.env.GOPHISH_API_KEY;
  if (!apiUrl || !apiKey) {
    throw new GophishError(
      "Gophish is not configured. Set GOPHISH_API_URL and GOPHISH_API_KEY in the server environment."
    );
  }
  return { apiUrl: apiUrl.replace(/\/+$/, ""), apiKey };
}

type GophishFetchOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  endpoint: string;
};

async function gophishFetch<T>({ method = "GET", body, endpoint }: GophishFetchOptions): Promise<T> {
  const { apiUrl, apiKey } = getConfig();
  const url = `${apiUrl}/api/${endpoint.replace(/^\/+/, "")}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (cause) {
    // Never include the API key (it is only ever sent via header, never logged).
    throw new GophishError(
      `Network error contacting Gophish at ${endpoint}`,
      undefined,
      endpoint
    );
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : null) ?? `Gophish request to ${endpoint} failed with status ${res.status}`;
    throw new GophishError(message, res.status, endpoint);
  }

  return data as T;
}

export interface GophishTarget {
  email: string;
  first_name?: string;
  last_name?: string;
  position?: string;
}

export interface GophishGroup {
  id?: number;
  name: string;
  targets: GophishTarget[];
  modified_date?: string;
}

export interface GophishTemplate {
  id?: number;
  name: string;
  subject: string;
  text?: string;
  html?: string;
  modified_date?: string;
}

export interface GophishSimpleListItem {
  id?: number;
  name: string;
}

export interface GophishCampaign {
  id?: string;
  name: string;
  created_date?: string;
  status?: string;
  template?: GophishSimpleListItem;
  sending_profile?: GophishSimpleListItem;
  url?: string;
}

export interface GophishCreateCampaignInput {
  name: string;
  templateName: string;
  groupName: string;
  sendingProfileName: string;
  landingPageName: string;
  url: string;
  launchDate?: string;
}

export async function createGroup(name: string, targets: GophishTarget[]): Promise<GophishGroup> {
  return gophishFetch<GophishGroup>({
    method: "POST",
    endpoint: "groups/",
    body: { name, targets },
  });
}

export async function createTemplate(
  name: string,
  subject: string,
  text?: string,
  html?: string
): Promise<GophishTemplate> {
  return gophishFetch<GophishTemplate>({
    method: "POST",
    endpoint: "templates/",
    body: { name, subject, text: text ?? "", html: html ?? "" },
  });
}

export async function createAndLaunchCampaign(
  input: GophishCreateCampaignInput
): Promise<GophishCampaign> {
  const body: Record<string, unknown> = {
    name: input.name,
    template: { name: input.templateName },
    url: input.url,
    smtp: { name: input.sendingProfileName },
    page: { name: input.landingPageName },
    groups: [{ name: input.groupName }],
  };
  if (input.launchDate) {
    body.launch_date = input.launchDate;
  }
  return gophishFetch<GophishCampaign>({
    method: "POST",
    endpoint: "campaigns/",
    body,
  });
}

export async function listCampaigns(): Promise<GophishCampaign[]> {
  return gophishFetch<GophishCampaign[]>({ endpoint: "campaigns/" });
}

export async function listSendingProfiles(): Promise<GophishSimpleListItem[]> {
  return gophishFetch<GophishSimpleListItem[]>({ endpoint: "smtp/" });
}

export async function listLandingPages(): Promise<GophishSimpleListItem[]> {
  return gophishFetch<GophishSimpleListItem[]>({ endpoint: "pages/" });
}

export function ensureTrackingLink(body: string): string {
  if (body.includes(TRACKING_PLACEHOLDER)) return body;
  const sep = body.trimEnd().length === 0 ? "" : "\n\n";
  return `${body.trimEnd()}${sep}${TRACKING_PLACEHOLDER}`;
}

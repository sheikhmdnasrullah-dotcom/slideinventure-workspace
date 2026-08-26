// Self-hosted Stirling-PDF (https://github.com/Stirling-Tools/Stirling-PDF),
// deployed on our own VPS — see /opt/PORT_MAP.md there. It sends
// X-Frame-Options: DENY (its own default), so it can't be embedded in an
// iframe; every "edit" entry point opens it in a new tab instead.
export const STIRLING_PDF_URL = "https://pdf.slideinventure.com"

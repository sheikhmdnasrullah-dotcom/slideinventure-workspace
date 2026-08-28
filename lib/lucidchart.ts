// Lucidchart is a hosted SaaS (requires the user's own login session) and does
// not permit being embedded in an iframe (it sets X-Frame-Options / CSP
// frame-ancestors). So it is integrated as a launcher that opens the user's
// already-authenticated Lucidchart session in a new tab, sitting alongside the
// self-hosted Excalidraw and AFFiNE engines.
export const LUCIDCHART_URL = "https://lucid.app/documents#/home?folder_id=recent";

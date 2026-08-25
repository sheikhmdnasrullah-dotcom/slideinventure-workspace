"use client";

import { useEffect } from "react";
import { pingAppwrite } from "@/lib/appwrite";

// Runs once when the app opens in the browser to verify the Appwrite
// backend connection (calls client.ping()).
export function AppwritePing() {
  useEffect(() => {
    pingAppwrite()
      .then(() => console.info("[appwrite] backend reachable"))
      .catch((err) => console.warn("[appwrite] ping failed", err));
  }, []);

  return null;
}

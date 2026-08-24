"use client";

import { useEffect } from "react";
import { datadogRum } from "@datadog/browser-rum";

export default function DatadogInit() {
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_DD_RUM_APP_ID;
    const clientToken = process.env.NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN;

    if (!appId || !clientToken) return;

    datadogRum.init({
      applicationId: appId,
      clientToken,
      site: "datadoghq.com",
      service: "slidein-venture-os",
      env: process.env.NODE_ENV,
      version: "1.0.0",
      trackUserInteractions: true,
    });
  }, []);

  return null;
}

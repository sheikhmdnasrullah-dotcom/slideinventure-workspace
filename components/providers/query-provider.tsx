"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider, isServer } from "@tanstack/react-query"

/**
 * Client-side cache for dashboard reads.
 *
 * Sections used to re-fetch from scratch on every mount, so revisiting a
 * section you had already opened showed a spinner or an empty list again. With a
 * 5-minute `staleTime` the second visit renders straight from cache and only
 * revalidates in the background, which is what makes a repeat section switch
 * feel instant.
 *
 * `refetchOnWindowFocus` is off deliberately: this dashboard already has a
 * push-based freshness layer (the SSE `EventStreamProvider` / `useLiveRefresh`),
 * so refetching everything on every tab focus would be duplicate work.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        // Keep an unmounted section's data around well past its stale time so
        // navigating away and back is a cache hit rather than a cold fetch.
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

/**
 * One client per browser tab, created lazily. This must be a module-level
 * singleton rather than component state: the cache is the whole point, and it
 * has to outlive any remount of the provider's parents.
 */
function getQueryClient() {
  if (isServer) return makeQueryClient()
  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

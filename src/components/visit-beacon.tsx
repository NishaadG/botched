"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const FIRST_SOURCE = "botched_src";

/** The link tag that brought this visitor here (?ref=reel1, ?utm_source=yt, ?source=android), if any. */
function tagFromUrl() {
  const q = new URLSearchParams(window.location.search);
  return q.get("ref") || q.get("utm_source") || q.get("source") || "";
}

/** Site that linked here, e.g. "instagram.com", when there's no tag. */
function referrerHost() {
  try {
    const host = new URL(document.referrer).hostname.toLowerCase();
    if (!host || host === window.location.hostname) return "";
    return host.replace(/^(www|m|l|lm|out)\./, "");
  } catch {
    return "";
  }
}

/** First tag this browser arrived with, so a nickname picked later is credited to the right post. */
export function firstSource() {
  try {
    return localStorage.getItem(FIRST_SOURCE) ?? "";
  } catch {
    return "";
  }
}

/** Counts a page view (anonymously, server side) on every navigation. */
export function VisitBeacon() {
  const path = usePathname();
  useEffect(() => {
    const tag = tagFromUrl();
    const from = tag || referrerHost();
    try {
      if (from && !localStorage.getItem(FIRST_SOURCE)) localStorage.setItem(FIRST_SOURCE, from.slice(0, 40));
    } catch {}
    const body = JSON.stringify({ path, source: tag, referrer: document.referrer });
    fetch("/api/hit", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  }, [path]);
  return null;
}

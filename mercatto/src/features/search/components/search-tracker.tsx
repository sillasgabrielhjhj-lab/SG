"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export function SearchTracker({ term, results }: { term: string; results: number }) {
  useEffect(() => {
    if (term) trackEvent("search", { search_term: term, results });
  }, [term, results]);
  return null;
}

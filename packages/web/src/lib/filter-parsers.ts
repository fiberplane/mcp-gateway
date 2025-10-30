/**
 * Custom nuqs parsers for filter state management
 *
 * These parsers bridge nuqs URL state management with our existing
 * filter parsing/serialization logic from filter-utils.ts
 */

import type { Filter, FilterField } from "@fiberplane/mcp-gateway-types";
import { createParser } from "nuqs";
import { parseFiltersFromUrl, serializeFiltersToUrl } from "./filter-utils";

/**
 * Parser for search query parameter (deprecated - use parseAsSearchArray)
 *
 * URL format: ?q=search+term
 * Default: empty string
 */
export const parseAsSearch = createParser({
  parse: (value: string) => {
    // nuqs handles URL decoding automatically
    return value.trim();
  },
  serialize: (value: string) => {
    // nuqs handles URL encoding automatically
    return value.trim();
  },
}).withDefault("");

/**
 * Parser for array of search terms in URL
 *
 * URL format: ?search=error,warning
 * Default: empty array
 */
export const parseAsSearchArray = createParser({
  parse: (value: string) => {
    // Split by comma for multiple search terms in single param
    return value ? value.split(",").filter((s) => s.trim().length > 0) : [];
  },
  serialize: (value: string[]) => {
    // Join with comma
    return value.length > 0 ? value.join(",") : "";
  },
}).withDefault([]);

/**
 * Parser for individual filter field parameters
 *
 * URL format per field: field=operator:value or field=operator:value1,value2
 * Example: client=is:claude-code or method=is:tools/call,prompts/get
 */
export const parseAsFilterParam = createParser({
  parse: (value: string) => {
    return value; // Return raw value, will be parsed into Filter objects later
  },
  serialize: (value: string | null) => {
    return value ?? ""; // nuqs expects empty string for null
  },
}).withOptions({ history: "replace" }); // Use replaceState to avoid cluttering history

/**
 * Convert URL filter params to Filter array
 */
export function filterParamsToFilters(params: {
  client?: string | null;
  method?: string | null;
  session?: string | null;
  server?: string | null;
  duration?: string | null;
  tokens?: string | null;
}): Filter[] {
  const urlParams = new URLSearchParams();

  // Add non-null params to URLSearchParams for parsing
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      urlParams.set(key, value);
    }
  }

  return parseFiltersFromUrl(urlParams);
}

/**
 * Convert Filter array to URL filter params
 */
export function filtersToFilterParams(
  filters: Filter[],
): Record<FilterField, string | null> {
  const params = serializeFiltersToUrl(filters);

  // Convert URLSearchParams to object with null for missing fields
  const result: Record<FilterField, string | null> = {
    client: params.get("client"),
    method: params.get("method"),
    session: params.get("session"),
    server: params.get("server"),
    duration: params.get("duration"),
    tokens: params.get("tokens"),
  };

  return result;
}

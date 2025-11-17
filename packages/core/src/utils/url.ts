/**
 * URL utility functions for MCP Gateway
 */

import { getErrorMessage } from "./error.js";

/**
 * Normalize URL for consistent storage and comparison
 *
 * Applies the following transformations:
 * - Lowercases hostname (per RFC 3986)
 * - Removes default ports (80 for http, 443 for https)
 * - Removes trailing slash from pathname (unless it's just "/")
 *
 * @param url - The URL to normalize
 * @returns Normalized URL string
 * @throws Error if URL format is invalid
 *
 * @example
 * normalizeUrl("HTTP://Example.COM:80/path/") // => "http://example.com/path"
 * normalizeUrl("https://example.com:443/") // => "https://example.com/"
 * normalizeUrl("http://example.com/api/") // => "http://example.com/api"
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Lowercase hostname (RFC 3986)
    parsed.hostname = parsed.hostname.toLowerCase();

    // Remove default ports
    if (
      (parsed.protocol === "http:" && parsed.port === "80") ||
      (parsed.protocol === "https:" && parsed.port === "443")
    ) {
      parsed.port = "";
    }

    // Remove trailing slash from pathname (unless it's just "/")
    if (parsed.pathname.endsWith("/") && parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch (error) {
    throw new Error(`Invalid URL format: ${getErrorMessage(error)}`);
  }
}

/**
 * Validate URL format and protocol
 *
 * @param url - The URL to validate
 * @returns true if URL is valid and uses HTTP or HTTPS protocol
 *
 * @example
 * isValidUrl("http://example.com") // => true
 * isValidUrl("ftp://example.com") // => false
 * isValidUrl("not a url") // => false
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

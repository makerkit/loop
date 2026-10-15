/**
 * The document view links only http(s) URLs, so the editor keeps only those.
 * Returns the URL to store, or null when it can't be a link.
 */
export function toSafeLinkUrl(raw: string): string | null {
  const url = raw.trim();

  // Control characters can hide a scheme from simple checks
  // oxlint-disable-next-line no-control-regex
  if (url === "" || /[\u0000-\u001f\u007f]/.test(url)) {
    return null;
  }

  if (!/^https?:\/\//i.test(url)) {
    return null;
  }

  try {
    const parsed = new URL(url);

    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname) {
      return null;
    }
  } catch {
    return null;
  }

  // Keep the URL as written (no normalising), but never with raw spaces
  return url.replace(/\s/g, "%20");
}

/**
 * What the user typed in the link field, as a URL to store. A bare domain
 * (`example.com/page`) gets `https://`; any other scheme is rejected.
 */
export function parseLinkInput(input: string): string | null {
  const value = input.trim();

  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return toSafeLinkUrl(value);
  }

  if (/^[\w-]+(\.[\w-]+)+(?:[/?#].*)?$/.test(value)) {
    return toSafeLinkUrl(`https://${value}`);
  }

  return null;
}

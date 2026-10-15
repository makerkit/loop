/**
 * Makes command output safe to show in the UI: no absolute project path and
 * no secrets. Secret patterns ported from the desktop app's error-sanitizer.
 */

const KEY_VALUE_SECRET_PATTERN =
  /\b(github[_-]?token|token|api[_-]?key|secret|password|authorization)\b(\s*[:=]\s*)(["']?)[^"',\s]+(\3)/gi;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._-]+\b/gi;
const GITHUB_TOKEN_PATTERN = /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g;
const PRIVATE_KEY_BLOCK_PATTERN = /-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g;

export function sanitizeOutput(text: string, projectRoot: string) {
  const withoutRoot = projectRoot ? text.split(projectRoot).join(".") : text;

  return withoutRoot
    .replace(PRIVATE_KEY_BLOCK_PATTERN, "[REDACTED_PRIVATE_KEY]")
    .replace(GITHUB_TOKEN_PATTERN, "[REDACTED_TOKEN]")
    .replace(BEARER_TOKEN_PATTERN, "Bearer [REDACTED_TOKEN]")
    .replace(
      KEY_VALUE_SECRET_PATTERN,
      (_match, key: string, separator: string) => `${key}${separator}[REDACTED_TOKEN]`,
    );
}

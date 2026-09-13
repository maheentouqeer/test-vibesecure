// Canonical published URL — used for auth email redirects so verification
// links always land on the live Lovable deployment, never localhost.
export const PUBLISHED_URL = "https://dacadb19-d671-4c79-b248-0e2e0ea9215d.lovable.app";

export function getRedirectOrigin(): string {
  return PUBLISHED_URL;
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter";
  if (!/[0-9]/.test(password)) return "Password must include at least one number";
  return null;
}

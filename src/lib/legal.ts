// Terms, Privacy Policy and account deletion requests (v1.0.3)

/** Shown in the Terms and Privacy Policy, and where "Delete my account" requests go. Public. */
export const CONTACT_EMAIL = "CHANGE-ME@example.com";

/** When the Terms and Privacy Policy last changed. Bump both when editing src/components/legal/legal-text.tsx. */
export const LEGAL_UPDATED = "October 26, 2026";
/** Saved on the account at sign-up (user metadata terms_version), so we know which version they agreed to */
export const LEGAL_VERSION = "2026-10-26";

/** Opens the user's mail app with the deletion request filled in */
export function deleteAccountMailto(accountEmail: string) {
  const subject = "Delete my Kalupi account";
  const body = `Please delete my Kalupi account and all of its data.\n\nAccount email: ${accountEmail}`;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

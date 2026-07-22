/**
 * Avatar utilities for Meterly.
 *
 * Uses DiceBear or Gravatar for user profile pictures.
 */


/**
 * Generates a Gravatar URL using native SubtleCrypto with SHA-256.
 * @param email - User's email address.
 */
export async function getGravatarUrl(email: string): Promise<string> {
  // ponytail: use native SubtleCrypto to hash email with SHA-256 (fully standard)
  const trimmedEmail = email.trim().toLowerCase();
  const msgBuffer = new TextEncoder().encode(trimmedEmail);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `https://gravatar.com/avatar/${hashHex}?d=mp`;
}


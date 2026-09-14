/**
 * Checks whether the current input in the decrypt page represents
 * a cleartext signed message or a detached signature without uploaded files,
 * which indicates verification mode rather than decryption.
 */
export function isVerificationInput(
  inputMessage?: string | null,
  files?: Array<unknown> | null
): boolean {
  if (files && files.length > 0) {
    return false;
  }

  const trimmed = (inputMessage || "").trim();
  return (
    trimmed.startsWith("-----BEGIN PGP SIGNED MESSAGE-----") ||
    trimmed.startsWith("-----BEGIN PGP SIGNATURE-----")
  );
}

/** Why AR can't start here, in words a student can act on. */
export function arUnavailableReason(secureContext: boolean): string {
  if (!secureContext) {
    return "AR needs a secure (HTTPS) page. Open ExoScope through the HTTPS link described in docs/ar.md.";
  }
  return "This device or browser can't start AR. Use Chrome on an ARCore-capable Android phone, or Safari on an iPhone or iPad.";
}

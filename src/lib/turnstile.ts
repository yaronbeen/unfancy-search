const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileResult {
  success: boolean;
  error?: string;
}

/**
 * Verify a Turnstile token server-side.
 * Returns { success: true } if valid, { success: false, error } if not.
 *
 * Gracefully passes if TURNSTILE_SECRET_KEY is not set,
 * allowing local dev and gradual rollout.
 */
export async function verifyTurnstile(
  token: string | undefined,
  ip: string,
): Promise<TurnstileResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // If Turnstile is not configured, pass through
  if (!secretKey) {
    return { success: true };
  }

  if (!token) {
    return { success: false, error: "Missing verification token" };
  }

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
        remoteip: ip,
      }),
    });

    const data = (await res.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };

    if (data.success) {
      return { success: true };
    }

    return {
      success: false,
      error: data["error-codes"]?.includes("timeout-or-duplicate")
        ? "Verification expired. Please try again."
        : "Verification failed. Please try again.",
    };
  } catch {
    // On verification service failure, pass through to avoid blocking users
    return { success: true };
  }
}

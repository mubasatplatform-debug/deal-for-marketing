/**
 * The two-step sign-in gate lives in the /app layout. Pages outside it (the
 * printable invoice, the consultation call) send the person there and back.
 */
const OTP_RETURN_KEY = "deal-otp-return";
export function rememberOtpReturn(path: string) {
  try {
    sessionStorage.setItem(OTP_RETURN_KEY, path);
  } catch {
    /* storage blocked: the gate just opens the dashboard */
  }
}
/** The in-app path to go back to after the gate, if one was remembered. */
export function takeOtpReturn(): string | null {
  try {
    const path = sessionStorage.getItem(OTP_RETURN_KEY);
    sessionStorage.removeItem(OTP_RETURN_KEY);
    return path && /^\/app[/_]/.test(path) ? path : null;
  } catch {
    return null;
  }
}

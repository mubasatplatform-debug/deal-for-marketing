/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * On when the build sets `VITE_SIGNIN_MODE=password`: a deploy outside the
 * Grok platform (e.g. the team's own Vercel project), where the Grok broker
 * does not accept the OAuth callback. The sign-in UI then shows the email
 * form instead of the Google / X buttons (see `passwordSignIn` in `./client`).
 */
export const emailAndPasswordEnabled = import.meta.env.VITE_SIGNIN_MODE === "password";

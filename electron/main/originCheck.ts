import type { NextFunction, Request, Response } from 'express';

/**
 * Whether a request's `Origin` header is one this server should answer.
 *
 * The server has no auth — it relies on nothing but its own local port for
 * protection, which any process, or any webpage open in any browser tab on
 * the machine, can also reach. Only same-origin `fetch`/XHR and cross-origin
 * form POSTs are a forgery risk, and both of those reliably carry `Origin`;
 * a request without one (a plain navigation, a non-browser client) isn't the
 * thing this guards against, so it's let through rather than broken.
 */
export function isAllowedOrigin(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  return origin === undefined || allowedOrigins.includes(origin);
}

/** Express middleware built from {@link isAllowedOrigin}. */
export function requireAllowedOrigin(allowedOrigins: readonly string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isAllowedOrigin(req.headers.origin, allowedOrigins)) {
      next();
      return;
    }
    res.status(403).json({ error: 'forbidden_origin' });
  };
}

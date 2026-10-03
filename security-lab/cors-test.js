// VibeSecure security test fixture.
// Intentionally insecure: wildcard CORS allows every origin.

import cors from "cors";

export function configureSecurityTest(app) {
  app.use(cors({ origin: "*" }));
  return app;
}

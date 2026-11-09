import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./src/worker.ts" with { type: "cf-worker" };

export default defineConfig({
  accountId: "fc2a4154a7d11c36eaa409a7c7235230",
  worker: {
    name: "jhdev",
    compatibilityDate: "2026-11-01",
    entrypoint,
    workersDev: false,
    previewUrls: false,
    domains: ["joaohenriquecosta.dev", "www.joaohenriquecosta.dev"],
    assets: {
      htmlHandling: "auto-trailing-slash",
      notFoundHandling: "404-page",
      runWorkerFirst: true,
    },
    env: {
      ASSETS: bindings.assets(),
      // Email Routing send binding. Delivers only to verified destination addresses.
      MAILER: bindings.sendEmail(),
      MAIL_FROM: bindings.text("site@joaohenriquecosta.dev"),
      MAIL_TO_HEADER: bindings.text("contato@joaohenriquecosta.dev"),
      // Verified inbox behind contato@ (kept out of the public repo).
      MAIL_DEST: bindings.secret(),
    },
  },
});

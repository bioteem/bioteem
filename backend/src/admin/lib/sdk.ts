// src/admin/lib/sdk.ts
import Medusa from "@medusajs/js-sdk"

export const sdk = new Medusa({
  baseUrl: process.env.VITE_BACKEND_URL || "/", // backend URL
  debug: process.env.NODE_ENV === "development",
  auth: {
    type: "session", // admin uses cookie session auth
  },
})
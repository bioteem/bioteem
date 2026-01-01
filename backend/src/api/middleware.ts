// src/api/middlewares.ts
import { defineMiddlewares } from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    {
      method: ["POST"],
      matcher: "/stripe/webhook", // default Medusa Stripe payment provider
      bodyParser: {
        preserveRawBody: true,
      },
    },
    {
      method: ["POST"],
      matcher: "/hooks/stripe/subscriptions", // our custom subscription webhook
      bodyParser: {
        preserveRawBody: true,
      },
    },
  ],
})
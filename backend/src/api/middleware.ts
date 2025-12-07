// src/api/middlewares.ts
import { defineMiddlewares } from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    {
      method: ["POST"],
      matcher: "/hooks/stripe/subscriptions",
      bodyParser: {
        preserveRawBody: true, // 👈 this is what populates req.rawBody
      },
    },
  ],
})
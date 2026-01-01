// src/api/middlewares.ts
import { defineMiddlewares, authenticate,
  validateAndTransformBody,validateAndTransformQuery, } from "@medusajs/framework/http"

import { PostStoreReviewSchema } from "./store/reviews/route"
import { GetAdminReviewsSchema } from "./admin/reviews/route"
import { PostAdminUpdateReviewsStatusSchema } from "./admin/reviews/status/route"

import { GetStoreReviewsSchema } from "./store/products/[id]/reviews/route"
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
    {
      method: ["POST"], 
      matcher: "/store/reviews",
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(PostStoreReviewSchema),
      ],
    },{
      matcher: "/admin/reviews",
      method: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetAdminReviewsSchema, {
          isList: true,
          defaults: [
            "id",
            "title",
            "content",
            "rating",
            "product_id",
            "customer_id",
            "status",
            "created_at",
            "updated_at",
            "product.*",
          ],
        }),
      ],
    },
    {
      matcher: "/admin/reviews/status",
      method: ["POST"],
      middlewares: [
        validateAndTransformBody(PostAdminUpdateReviewsStatusSchema),
      ],
    },
    {
      matcher: "/store/products/:id/reviews",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetStoreReviewsSchema, {
          isList: true,
          defaults: [
            "id", 
            "rating", 
            "title", 
            "first_name", 
            "last_name", 
            "content", 
            "created_at",
          ],
        }),
      ],
    },
  ],
})
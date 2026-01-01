import {
  createWorkflow,
  WorkflowData,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { updateReviewsStep } from "./steps/update-review"

export type UpdateReviewInput = Array<{
  id: string
  status: "pending" | "approved" | "rejected"
}>

// ✅ Add explicit annotation to avoid “not portable” inferred types
export const updateReviewWorkflow: ReturnType<typeof createWorkflow> = createWorkflow(
  "update-review",
  (input: WorkflowData<UpdateReviewInput>) => {
    // ✅ `input` is WorkflowData<UpdateReviewInput> now.
    // Most steps accept the workflow data wrapper directly:
    const reviews = updateReviewsStep(input)

    return new WorkflowResponse({ reviews })
  }
)
"use client"

import { getProductReviews } from "../../../../lib/data/products"
import { Star, StarSolid } from "@medusajs/icons"
import { StoreProductReview } from "../../../../types/global"
import { Button } from "@medusajs/ui"
import { useState, useEffect } from "react"
import ProductReviewsForm from "./form"
type ProductReviewsProps = {
  productId: string
}

export default function ProductReviews({
  productId,
}: ProductReviewsProps) {
  const [page, setPage] = useState(1)
  const defaultLimit = 10
  const [reviews, setReviews] = useState<StoreProductReview[]>([])
  const [rating, setRating] = useState(0)
  const [hasMoreReviews, setHasMoreReviews] = useState(false)
  const [count, setCount] = useState(0)

  useEffect(() => {
    getProductReviews({
      productId,
      limit: defaultLimit,
      offset: (page - 1) * defaultLimit,
    }).then(({ reviews: paginatedReviews, average_rating, count, limit }) => {
      setReviews((prev) => {
        const newReviews = paginatedReviews.filter(
          (review) => !prev.some((r) => r.id === review.id)
        )
        return [...prev, ...newReviews]
      })
      setRating(Math.round(average_rating))
      console.log(count, limit, page, count > limit * page)
      setHasMoreReviews(count > limit * page)
      setCount(count)
    })
  }, [page])

return (
  <div className="product-page-constraint">
    <div className="flex flex-col items-center text-center mb-16">
      <span className="text-base-regular text-gray-600 mb-6">
        Product Reviews
      </span>
      <p className="text-2xl-regular text-ui-fg-base max-w-lg">
        See what our customers are saying about this product.
      </p>
      <div className="flex gap-x-2 justify-center items-center">
        <div className="flex gap-x-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <span key={index}>
              {!rating || index > rating ? (
                <Star />
              ) : (
                <StarSolid className="text-ui-tag-orange-icon" />
              )}
            </span>
          ))}
        </div>
        <span className="text-base-regular text-gray-600">
          {count} reviews
        </span>
      </div>
    </div>

    <div className="grid grid-cols-1 small:grid-cols-2 gap-x-6 gap-y-8">
      {reviews.map((review) => (
        <Review key={review.id} review={review} />
      ))}
    </div>

    {hasMoreReviews && (
      <div className="flex justify-center mt-8">
        <Button variant="secondary" onClick={() => setPage(page + 1)}>
          Load more reviews
        </Button>
      </div>
    )}

    <ProductReviewsForm productId={productId} />
  </div>
)
}

function Review({ review }: { review: StoreProductReview }) {
  return (
    <div className="flex flex-col gap-y-2 text-base-regular text-ui-fg-base">
      <div className="flex gap-x-2 items-center">
        {review.title && <strong>{review.title}</strong>}
        <div className="flex gap-x-1">
          {Array.from({ length: 5 }).map((_, index) => (
            <span key={index}>
              {index <= review.rating ? (
                <StarSolid className="text-ui-tag-orange-icon" />
              ) : (
                <Star />
              )}
            </span>
          ))}
        </div>
      </div>
      <div>{review.content}</div>
      <div className="border-t border-ui-border-base pt-4 text-sm-regular">
        {review.first_name} {review.last_name}
      </div>
    </div>
  )
}
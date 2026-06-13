"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { twMerge } from "tailwind-merge"

/**
 * Pagination component
 * @param {number} currentPage - trang hiện tại (1-indexed)
 * @param {number} totalPages   - tổng số trang
 * @param {function} onPageChange - callback(page: number)
 * @param {string}  className
 */
export function Pagination({ currentPage, totalPages, onPageChange, className = "" }) {
  if (!totalPages || totalPages <= 1) return null

  // Tính dải trang hiển thị (tối đa 5 nút số)
  const getPageNumbers = () => {
    const delta = 2
    const range = []
    const rangeWithDots = []

    const left = Math.max(2, currentPage - delta)
    const right = Math.min(totalPages - 1, currentPage + delta)

    range.push(1)
    for (let i = left; i <= right; i++) range.push(i)
    if (!range.includes(totalPages)) range.push(totalPages)

    let prev = null
    for (const page of range) {
      if (prev !== null) {
        if (page - prev === 2) {
          rangeWithDots.push(prev + 1)
        } else if (page - prev > 2) {
          rangeWithDots.push("...")
        }
      }
      rangeWithDots.push(page)
      prev = page
    }

    return rangeWithDots
  }

  const pages = getPageNumbers()

  const btnBase =
    "min-w-[36px] h-[36px] px-2 flex items-center justify-center rounded-lg text-[14px] font-medium transition-all duration-200 select-none"

  return (
    <div className={twMerge("flex items-center gap-1", className)}>
      {/* Prev */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={twMerge(
          btnBase,
          "text-gray-500 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        )}
        aria-label="Trang trước"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Page numbers */}
      {pages.map((page, i) =>
        page === "..." ? (
          <span key={`dot-${i}`} className={twMerge(btnBase, "text-gray-400 cursor-default")}>
            …
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={twMerge(
              btnBase,
              "cursor-pointer",
              page === currentPage
                ? "bg-[#4066FF] text-white shadow-md shadow-blue-200"
                : "text-gray-600 hover:bg-blue-50 hover:text-[#4066FF]"
            )}
          >
            {page}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={twMerge(
          btnBase,
          "text-gray-500 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        )}
        aria-label="Trang sau"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

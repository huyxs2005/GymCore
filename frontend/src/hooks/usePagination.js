import { useEffect, useMemo, useState } from 'react'

export function usePagination(items, pageSize = 10) {
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil((items?.length || 0) / pageSize))

  useEffect(() => {
    setCurrentPage((prev) => Math.min(Math.max(prev, 1), totalPages))
  }, [totalPages])

  const paginatedItems = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : []
    const start = (currentPage - 1) * pageSize
    return safeItems.slice(start, start + pageSize)
  }, [currentPage, items, pageSize])

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems,
    totalItems: Array.isArray(items) ? items.length : 0,
    pageSize,
  }
}

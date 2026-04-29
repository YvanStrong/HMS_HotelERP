/** 1-based page */
export function paginateSlice<T>(items: T[], page: number, pageSize: number): { slice: T[]; total: number; totalPages: number } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    slice: items.slice(start, start + pageSize),
    total,
    totalPages,
  };
}

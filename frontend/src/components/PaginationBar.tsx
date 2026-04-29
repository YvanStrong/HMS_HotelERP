"use client";

type Props = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
  /** Optional label, e.g. "rooms" */
  noun?: string;
};

export function PaginationBar({ page, totalPages, totalItems, pageSize, onPageChange, noun = "rows" }: Props) {
  if (totalItems === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return (
    <div className="hms-pagination">
      <span className="hms-pagination-meta">
        {start}–{end} of {totalItems} {noun}
      </span>
      <div className="hms-pagination-actions">
        <button type="button" className="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </button>
        <span className="hms-pagination-page">
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          className="secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

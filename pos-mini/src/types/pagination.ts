export const DEFAULT_PAGE_SIZE = 25;

export type ListQuery = {
  offset?: number;
  limit?: number;
  search?: string;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  hasMore: boolean;
};

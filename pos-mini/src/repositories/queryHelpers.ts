import { DEFAULT_PAGE_SIZE } from '../types/pagination';

export function clampLimit(limit?: number): number {
  const n = limit ?? DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(n, 1), 100);
}

export function clampOffset(offset?: number): number {
  return Math.max(offset ?? 0, 0);
}

export function likePattern(query: string): string {
  return `%${query.trim()}%`;
}

export function buildWhere(conditions: string[]): string {
  return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
}

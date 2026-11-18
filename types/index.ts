export type ApiSuccess<T> = { data: T };
export type ApiFailure = { error: { code: string; message: string; details?: unknown } };
export type PageMeta = { page: number; pageSize: number; total: number; totalPages: number };

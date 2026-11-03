export interface Category { id: number; name: string; slug: string }
export interface Product { id: number; name: string; slug: string; sku: string; price: number; imageUrl: string | null; category: Category; isFeatured: boolean }
export interface ProductPage { items: Product[]; page: number; pageSize: number; totalCount: number }
export interface Variant { id: number; sku: string; name: string; price: number; imageUrl: string | null; isActive: boolean }
export interface ProductDetail { id: number; name: string; slug: string; description: string; imageUrl: string | null; category: Category; variants: Variant[] }
export class ApiError extends Error { constructor(public status: number) { super('Không thể tải dữ liệu. Vui lòng thử lại.') } }
export async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const response = await fetch(`${base}${path}`, { signal })
  if (!response.ok) throw new ApiError(response.status)
  return response.json() as Promise<T>
}

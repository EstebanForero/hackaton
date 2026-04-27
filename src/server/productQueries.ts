import { queryOptions } from '@tanstack/react-query'
import { listProducts, searchProducts } from './products'

export const productsQueryOptions = () =>
  queryOptions({
    queryKey: ['products'],
    queryFn: () => listProducts(),
  })

export const productSearchQueryOptions = (query: string, category?: string) =>
  queryOptions({
    queryKey: ['products', 'search', query, category],
    queryFn: () => searchProducts({ data: { query, category } }),
  })

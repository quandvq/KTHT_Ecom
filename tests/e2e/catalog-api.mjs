import assert from 'node:assert/strict'

const base = (process.argv[2] || 'http://127.0.0.1:5080').replace(/\/$/, '')
let requests = 0
async function get(path, status = 200) {
  const response = await fetch(`${base}/api${path}`)
  requests++
  assert.equal(response.status, status, `${path}: HTTP status`)
  if (status !== 200) return
  const body = await response.json()
  const serialized = JSON.stringify(body)
  assert.doesNotMatch(serialized, /"(?:stock|inventory|reservation|quota|password|token|physical|quarantined|safetyStock|availableQuantity)"\s*:/i, 'Public response must not leak internal values')
  return body
}
const categories = await get('/categories')
assert(categories.length > 0, 'Seeded categories required')
assert.equal(new Set(categories.map(x => x.slug)).size, categories.length)
const all = await get('/products?pageSize=100')
assert(all.items.length > 2, 'Demo must exercise pagination and variants')
assert(all.totalCount >= all.items.length, 'Total count should be at least page items count')
for (const item of all.items) {
  const detail = await get(`/products/${item.slug}`)
  assert.equal(detail.id, item.id)
  assert(detail.variants.length > 0)
  assert(detail.variants.every(v => v.isActive && v.price >= 0))
  const cheapest = [...detail.variants].sort((a, b) => a.price - b.price || a.id - b.id)[0]
  assert.equal(item.price, cheapest.price, `${item.slug}: minimum active variant price`)
  assert.equal(item.sku, cheapest.sku, `${item.slug}: SKU and price belong to same variant`)
  assert(categories.some(c => c.id === detail.category.id))
  const searched = await get(`/products?q=${encodeURIComponent(cheapest.sku)}`)
  assert(searched.items.some(x => x.id === item.id), 'Search by active SKU')
}
for (const category of categories) {
  const result = await get(`/products?category=${category.slug}&pageSize=100`)
  assert(result.items.every(x => x.category.slug === category.slug))
  assert(result.totalCount >= result.items.length)
}
for (const direction of ['asc', 'desc']) {
  const result = await get(`/products?sort=price-${direction}&pageSize=100`)
  const prices = result.items.map(x => x.price)
  const sortedPrices = [...prices].sort((a, b) => direction === 'asc' ? a - b : b - a)
  assert.deepEqual(prices, sortedPrices, `Sorted prices must be strictly ordered ${direction}`)
}
const featured = await get('/products?featured=true&pageSize=100')
assert(featured.items.length > 0 && featured.items.every(x => x.isFeatured))
const first = await get('/products?pageSize=2&page=1')
const second = await get('/products?pageSize=2&page=2')
assert.equal(first.items.length, 2)
assert(second.items.length > 0)
assert(!first.items.some(a => second.items.some(b => a.id === b.id)))
assert.equal((await get('/products?page=999&pageSize=100')).items.length, 0)
assert.equal((await get('/products?q=unfindable-qa-catalog-fixture')).totalCount, 0)
assert.equal((await get('/products?category=unfindable-qa-category')).totalCount, 0)
const price = all.items[0].price
const exactPrice = await get(`/products?minPrice=${price}&maxPrice=${price}`)
assert(exactPrice.items.length > 0 && exactPrice.items.every(x => x.price === price))
await get('/products/unfindable-qa-product', 404)
for (const slug of ['demo-unpublished', 'demo-no-active-sku']) {
  assert(!all.items.some(x => x.slug === slug), 'Hidden products excluded from listing')
  await get(`/products/${slug}`, 404)
}
assert.equal((await get('/products?q=KTHT-DEMO-01-INACTIVE')).totalCount, 0)
const demo = await get('/products/demo-san-pham-01')
assert.equal(demo.variants.length, 2, 'Inactive fixture excluded')
assert.deepEqual(demo.variants.map(v => v.price), [25000, 45000], 'Known fixture prices independent of implementation')
for (const query of ['page=0', 'pageSize=101', 'page=2147483647&pageSize=100', 'sort=bad', 'minPrice=-1', 'minPrice=20&maxPrice=10', 'q=' + 'x'.repeat(201), 'page=abc', 'featured=bad']) await get(`/products?${query}`, 400)
console.log(JSON.stringify({ result: 'PASS', base, requests, categories: categories.length, products: all.items.length, checks: 'categories, SKU search, category, prices, featured, paging, detail, no-leak, validation, not-found' }))

import assert from 'node:assert/strict'

if (process.env.KTHT_ALLOW_MUTATING_E2E !== '1') {
  throw new Error('Refusing to create orders. Set KTHT_ALLOW_MUTATING_E2E=1 only for an isolated KTHT_Ecom_Test database.')
}

const base = (process.argv[2] || 'http://127.0.0.1:5080').replace(/\/$/, '') + '/api'
let passed = 0
function check(name, value) {
  assert(value, name)
  console.log(`PASS: ${name}`)
  passed++
}
async function request(path, init = {}) {
  const response = await fetch(base + path, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init.headers || {}) }
  })
  const text = await response.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: response.status, body }
}

const removedChannelList = await request('/admin/channels')
check('old channel list endpoint is removed', removedChannelList.status === 404)
const removedChannelIngest = await request('/integrations/channel-orders', {
  method: 'POST', body: JSON.stringify({ channelCode: 'SHOPEE', externalOrderId: 'must-not-exist', sku: 'x', quantity: 1, unitPrice: 1 })
})
check('old channel ingestion endpoint is removed', removedChannelIngest.status === 404)

const products = await request('/products?sort=price-desc&pageSize=1')
assert.equal(products.status, 200)
assert.equal(products.body.items.length, 1)
const product = await request(`/products/${products.body.items[0].slug}`)
assert.equal(product.status, 200)
const variant = product.body.variants[0]
const quantity = Math.max(1, Math.ceil(100000 / variant.price))
const items = [{ sku: variant.sku, quantity }]

const unknown = await request('/promotions/validate', { method: 'POST', body: JSON.stringify({ code: 'KHONG-TON-TAI', items }) })
check('unknown promotion is rejected', unknown.status === 404)
const negative = await request('/promotions/validate', { method: 'POST', body: JSON.stringify({ code: 'SALE10-01', items: [{ sku: variant.sku, quantity: 0 }] }) })
check('non-positive quantity is rejected', negative.status === 400)
const cheapestPage = await request('/products?sort=price-asc&pageSize=1')
assert.equal(cheapestPage.status, 200)
const cheapestProduct = await request(`/products/${cheapestPage.body.items[0].slug}`)
const cheapestVariant = cheapestProduct.body.variants[0]
assert(cheapestVariant.price < 500000, 'Test fixture needs one product below GIAM50K minimum')
const belowMinimum = await request('/promotions/validate', { method: 'POST', body: JSON.stringify({ code: 'GIAM50K-01', items: [{ sku: cheapestVariant.sku, quantity: 1 }] }) })
check('minimum order amount is enforced', belowMinimum.status === 400)

const validation = await request('/promotions/validate', { method: 'POST', body: JSON.stringify({ code: ' sale10-01 ', items }) })
check('valid promotion is normalized and accepted', validation.status === 200 && validation.body.code === 'SALE10-01')
const expectedSubtotal = variant.price * quantity
const expectedDiscount = Math.round(Math.min(expectedSubtotal * 0.1, 50000))
check('server recalculates percent discount', validation.body.subtotal === expectedSubtotal && validation.body.discountAmount === expectedDiscount && validation.body.totalAmount === expectedSubtotal - expectedDiscount)

const unique = Date.now().toString(36)
const registration = await request('/auth/register', {
  method: 'POST', body: JSON.stringify({ email: `promo_${unique}@ktht.test`, password: 'Password@123', fullName: 'Promo QA', phoneNumber: '0900000000' })
})
assert.equal(registration.status, 200)
const token = registration.body.token
const key = `promo-idem-${unique}`
const payload = {
  customerName: 'Promo QA', customerEmail: `promo_${unique}@ktht.test`, customerPhone: '0900000000',
  shippingAddress: 'Test database only', paymentMethod: 'COD', promotionCode: 'SALE10-01', items
}
const first = await request('/orders', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': key }, body: JSON.stringify(payload) })
check('order stores one promotion snapshot and server totals', first.status === 200 && first.body.order.promotionCode === 'SALE10-01' && first.body.order.subtotalAmount === expectedSubtotal && first.body.order.discountAmount === expectedDiscount && first.body.order.totalAmount === expectedSubtotal - expectedDiscount)
const replay = await request('/orders', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': key }, body: JSON.stringify(payload) })
check('same idempotency key and payload returns same order', replay.status === 200 && replay.body.order.id === first.body.order.id)
const changed = await request('/orders', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': key }, body: JSON.stringify({ ...payload, promotionCode: 'SALE10-02' }) })
check('same idempotency key with another promotion is rejected', changed.status === 409)

console.log(`Promotion integration checks passed: ${passed}`)

// TASK-010: kiểm thử tích hợp API trên SQL Server test riêng (có ghi dữ liệu, có request đồng thời).
//
// Chạy:  KTHT_TEST_DB=KTHT_Ecom_Test node tests/e2e/task010-api.mjs http://127.0.0.1:5081
// API phải đang chạy với ConnectionStrings__DefaultConnection trỏ tới đúng database KTHT_TEST_DB,
// đã migrate + --import-pharmacity + --seed-demo. Script từ chối chạy nếu tên database không kết thúc bằng "_Test".
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const base = (process.argv[2] || 'http://127.0.0.1:5081').replace(/\/$/, '')
const testDb = process.env.KTHT_TEST_DB || ''
if (!/_Test$/.test(testDb)) {
  console.error('Từ chối chạy: đặt KTHT_TEST_DB=<tên database test kết thúc bằng _Test>. Script này ghi dữ liệu.')
  process.exit(2)
}
const sqlServer = process.env.KTHT_TEST_SQL_SERVER || '(localdb)\\mssqllocaldb'
const sql = query => execFileSync('sqlcmd', ['-S', sqlServer, '-E', '-d', testDb, '-h', '-1', '-W', '-b', '-Q', `SET NOCOUNT ON; ${query}`], { encoding: 'utf8' }).trim()

let passed = 0
function check(name, condition, detail = '') {
  assert(condition, `[FAIL] ${name} ${detail}`)
  passed++
  console.log(`✓ ${name}`)
}

async function api(path, { method = 'GET', body, token, headers = {} } = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const json = await response.json().catch(() => null)
  return { status: response.status, json }
}

const login = async email => {
  const res = await api('/auth/login', { method: 'POST', body: { email, password: 'Ktht@2026' } })
  assert.equal(res.status, 200, `login ${email}`)
  return res.json.token
}

const statuses = results => results.map(r => r.status).sort((a, b) => a - b)

// ---------- Chuẩn bị ----------
const admin = await login('admin@ktht.local')
const sales = await login('sales@ktht.local')
const warehouse = await login('warehouse@ktht.local')
const support = await login('support@ktht.local')
const customerA = await login('customer@ktht.local')
const emailB = `task010-${randomUUID().slice(0, 8)}@ktht.local`
const registerB = await api('/auth/register', { method: 'POST', body: { email: emailB, password: 'Ktht@2026', fullName: 'Khách B (TASK-010)', phoneNumber: '0909000010' } })
assert.equal(registerB.status, 200, 'register customer B')
const customerB = registerB.json.token

const catalog = await api('/products?page=1&pageSize=40')
const inStock = catalog.json.items.filter(p => p.availability === 'InStock').map(p => p.sku)
assert(inStock.length >= 3, 'cần ít nhất 3 SKU còn hàng')
const [skuMain, skuSecond, skuNoBalance] = inStock

const balanceOf = async sku => (await api('/admin/inventory', { token: admin })).json.find(b => b.sku === sku)

async function placeOrder(token, items) {
  return api('/orders', {
    method: 'POST', token, headers: { 'Idempotency-Key': `T010-${randomUUID()}` },
    body: { customerName: 'Khách TASK-010', customerPhone: '0909000010', shippingAddress: '1 Đường Kiểm Thử', paymentMethod: 'COD', items }
  })
}

async function deliveredOrder(items) {
  const created = await placeOrder(customerA, items)
  assert.equal(created.status, 200, `tạo đơn: ${JSON.stringify(created.json)}`)
  const id = created.json.order.id
  for (const [step, token] of [['confirm', sales], ['fulfill', warehouse], ['deliver', warehouse]]) {
    const res = await api(`/admin/orders/${id}/${step}`, { method: 'POST', token })
    assert.equal(res.status, 200, `${step}: ${JSON.stringify(res.json)}`)
  }
  return (await api(`/orders/${id}`, { token: customerA })).json
}

const fullReturn = order => ({ orderId: order.id, reason: 'Kiểm thử TASK-010', items: order.items.map(i => ({ orderItemId: i.id, quantity: i.quantity, note: '' })) })

// ---------- F-001: quyền xem đơn ----------
const pending = await placeOrder(customerA, [{ sku: skuMain, quantity: 1 }])
check('Khách đăng nhập đặt được đơn', pending.status === 200)
const pendingId = pending.json.order.id
check('F-001 xem đơn không token -> 401', (await api(`/orders/${pendingId}`)).status === 401)
check('F-001 khách B xem đơn khách A -> 404', (await api(`/orders/${pendingId}`, { token: customerB })).status === 404)
check('F-001 khách A xem đơn của mình -> 200', (await api(`/orders/${pendingId}`, { token: customerA })).status === 200)
check('F-001 nhân viên CSKH xem đơn -> 200', (await api(`/orders/${pendingId}`, { token: support })).status === 200)
check('Đặt hàng không đăng nhập -> 401', (await api('/orders', { method: 'POST', body: { customerName: 'X', customerPhone: '0900000000', shippingAddress: 'Y', items: [{ sku: skuMain, quantity: 1 }] } })).status === 401)

const reusedKey = `T010-${randomUUID()}`
const orderBody = { customerName: 'Khách TASK-010', customerPhone: '0909000010', shippingAddress: '1 Đường Kiểm Thử', paymentMethod: 'COD', items: [{ sku: skuSecond, quantity: 1 }] }
const firstUse = await api('/orders', { method: 'POST', token: customerA, headers: { 'Idempotency-Key': reusedKey }, body: orderBody })
const replayA = await api('/orders', { method: 'POST', token: customerA, headers: { 'Idempotency-Key': reusedKey }, body: orderBody })
const replayB = await api('/orders', { method: 'POST', token: customerB, headers: { 'Idempotency-Key': reusedKey }, body: orderBody })
check('Idempotency: cùng chủ, cùng key/payload trả cùng đơn', firstUse.status === 200 && replayA.status === 200 && replayA.json.order.id === firstUse.json.order.id)
check('Idempotency: người khác dùng lại key -> 409, không lộ đơn', replayB.status === 409 && !replayB.json?.order)
await api(`/orders/${firstUse.json.order.id}/cancel`, { method: 'POST', token: customerA, body: { reason: 'dọn dữ liệu test' } })

// ---------- F-002: quyền hủy + hủy đồng thời ----------
const rBefore = (await balanceOf(skuMain)).r
check('F-002 khách B hủy đơn khách A -> 404', (await api(`/orders/${pendingId}/cancel`, { method: 'POST', token: customerB, body: {} })).status === 404)
check('F-002 thủ kho hủy đơn -> 403', (await api(`/orders/${pendingId}/cancel`, { method: 'POST', token: warehouse, body: {} })).status === 403)
const cancelRace = await Promise.all([
  api(`/orders/${pendingId}/cancel`, { method: 'POST', token: customerA, body: { reason: 'đua hủy 1' } }),
  api(`/orders/${pendingId}/cancel`, { method: 'POST', token: sales, body: { reason: 'đua hủy 2' } })
])
const cancelOk = cancelRace.filter(r => r.status === 200).length
check('F-002 hai request hủy đồng thời: đúng một thành công, bên thua 400/409 (không 500)',
  cancelOk === 1 && cancelRace.every(r => [200, 400, 409].includes(r.status)), JSON.stringify(statuses(cancelRace)))
check('F-002 R chỉ giảm đúng 1 lần', (await balanceOf(skuMain)).r === rBefore - 1, `R trước=${rBefore}`)

// AGENTS §7.3: hủy cạnh tranh xuất kho — chỉ một chuyển trạng thái thắng, không vừa xuất vừa giải phóng.
for (let round = 1; round <= 3; round++) {
  const contested = await placeOrder(customerA, [{ sku: skuSecond, quantity: 1 }])
  const contestedId = contested.json.order.id
  await api(`/admin/orders/${contestedId}/confirm`, { method: 'POST', token: sales })
  const before = await balanceOf(skuSecond)
  const race = await Promise.all([
    api(`/orders/${contestedId}/cancel`, { method: 'POST', token: customerA, body: { reason: 'đua với xuất kho' } }),
    api(`/admin/orders/${contestedId}/fulfill`, { method: 'POST', token: warehouse })
  ])
  const after = await balanceOf(skuSecond)
  const finalStatus = (await api(`/orders/${contestedId}`, { token: customerA })).json.status
  const winners = race.filter(r => r.status === 200).length
  const expectedP = finalStatus === 'Shipped' ? before.p - 1 : before.p
  check(`Hủy vs xuất kho vòng ${round}: đúng 1 bên thắng, không 500 (${finalStatus})`,
    winners === 1 && race.every(r => [200, 400, 409].includes(r.status)) && ['Cancelled', 'Shipped'].includes(finalStatus), JSON.stringify(statuses(race)))
  check(`Hủy vs xuất kho vòng ${round}: R giảm đúng 1, P khớp kết quả`, after.r === before.r - 1 && after.p === expectedP,
    `R ${before.r}->${after.r}, P ${before.p}->${after.p}`)
}

// Xác nhận cạnh tranh hủy: đơn đã hủy không bị ghi đè thành Confirmed.
for (let round = 1; round <= 3; round++) {
  const contested = await placeOrder(customerA, [{ sku: skuSecond, quantity: 1 }])
  const contestedId = contested.json.order.id
  const race = await Promise.all([
    api(`/orders/${contestedId}/cancel`, { method: 'POST', token: customerA, body: { reason: 'đua với xác nhận' } }),
    api(`/admin/orders/${contestedId}/confirm`, { method: 'POST', token: sales })
  ])
  const finalStatus = (await api(`/orders/${contestedId}`, { token: customerA })).json.status
  const cancelWon = race[0].status === 200
  check(`Xác nhận vs hủy vòng ${round}: trạng thái cuối nhất quán, không 500`,
    race.every(r => [200, 400, 409].includes(r.status)) && (cancelWon ? finalStatus === 'Cancelled' : finalStatus === 'Confirmed'),
    `${JSON.stringify(race.map(r => r.status))} -> ${finalStatus}`)
  if (finalStatus !== 'Cancelled') await api(`/orders/${contestedId}/cancel`, { method: 'POST', token: customerA, body: { reason: 'dọn dữ liệu test' } })
}

// ---------- F-003: SKU chưa có bản ghi tồn ----------
const savedBalance = sql(`SELECT CONCAT(P, ',', Q, ',', B, ',', R, ',', A) FROM InventoryBalances WHERE Sku = N'${skuNoBalance}'`)
sql(`DELETE FROM InventoryBalances WHERE Sku = N'${skuNoBalance}'`)
try {
  const noBalance = await placeOrder(customerA, [{ sku: skuNoBalance, quantity: 1 }])
  check('F-003 đặt SKU chưa có tồn -> 409', noBalance.status === 409, JSON.stringify(noBalance.json))
  check('F-003 không tự sinh bản ghi tồn', sql(`SELECT COUNT(*) FROM InventoryBalances WHERE Sku = N'${skuNoBalance}'`) === '0')
  const detail = catalog.json.items.find(p => p.sku === skuNoBalance)
  const listed = (await api(`/products/${detail.slug}`)).json.variants.find(v => v.sku === skuNoBalance)
  check('F-003 storefront không hiển thị mức tồn cho SKU này', listed.availability === null)
} finally {
  const [p, q, b, r, a] = savedBalance.split(',').map(Number)
  sql(`INSERT INTO InventoryBalances (Sku, WarehouseCode, P, Q, B, R, A) VALUES (N'${skuNoBalance}', 'WH-CENTRAL', ${p}, ${q}, ${b}, ${r}, ${a})`)
}

// ---------- F-004: giao hàng không tự thành đã thanh toán; đối soát một lần ----------
const orderPay = await deliveredOrder([{ sku: skuMain, quantity: 1 }])
check('F-004 giao COD xong vẫn PaymentStatus=Pending', orderPay.status === 'Delivered' && orderPay.paymentStatus === 'Pending')
check('F-004 thủ kho không được đối soát -> 403', (await api(`/admin/orders/${orderPay.id}/confirm-payment`, { method: 'POST', token: warehouse })).status === 403)
const payRace = await Promise.all([1, 2].map(() => api(`/admin/orders/${orderPay.id}/confirm-payment`, { method: 'POST', token: sales })))
check('F-004 hai request đối soát đồng thời: đúng 1 x 200, 1 x 409', JSON.stringify(statuses(payRace)) === '[200,409]', JSON.stringify(statuses(payRace)))
check('F-004 sau đối soát PaymentStatus=Paid', (await api(`/orders/${orderPay.id}`, { token: customerA })).json.paymentStatus === 'Paid')

// ---------- RMA: chính sách trả toàn bộ, quyền, đồng thời ----------
const orderTwoUnits = await deliveredOrder([{ sku: skuMain, quantity: 2 }])
const line = orderTwoUnits.items[0]
const dupLines = await api('/me/returns', { method: 'POST', token: customerA, body: { orderId: orderTwoUnits.id, reason: 'dòng trùng', items: [{ orderItemId: line.id, quantity: 1 }, { orderItemId: line.id, quantity: 1 }] } })
check('R-001 RMA dòng trùng -> 400', dupLines.status === 400, JSON.stringify(dupLines.json))
const partial = await api('/me/returns', { method: 'POST', token: customerA, body: { orderId: orderTwoUnits.id, reason: 'trả một phần', items: [{ orderItemId: line.id, quantity: 1 }] } })
check('R-001 RMA trả một phần -> 400 (MVP chỉ trả toàn bộ)', partial.status === 400)
check('F-005 khách B tạo RMA cho đơn khách A -> 404', (await api('/me/returns', { method: 'POST', token: customerB, body: fullReturn(orderTwoUnits) })).status === 404)

for (let round = 1; round <= 3; round++) {
  const order = round === 1 ? orderTwoUnits : await deliveredOrder([{ sku: skuSecond, quantity: 1 }])
  const race = await Promise.all([1, 2, 3].map(() => api('/me/returns', { method: 'POST', token: customerA, body: fullReturn(order) })))
  const ok = race.filter(r => r.status === 200).length
  const others = race.filter(r => r.status !== 200).map(r => r.status)
  check(`F-005 vòng ${round}: 3 RMA đồng thời -> đúng 1 thành công, còn lại 409`, ok === 1 && others.every(s => s === 409), JSON.stringify(statuses(race)))
  check(`F-005 vòng ${round}: DB chỉ có 1 RMA cho đơn`, sql(`SELECT COUNT(*) FROM ReturnRequests WHERE OrderId = ${order.id}`) === '1')
}

// ---------- RMA admin: approve/receive/qc/refund đúng một lần ----------
const rmaOrder = orderTwoUnits
const rmaId = Number(sql(`SELECT Id FROM ReturnRequests WHERE OrderId = ${rmaOrder.id}`))
check('Duyệt RMA -> 200', (await api(`/admin/returns/${rmaId}/approve`, { method: 'POST', token: support })).status === 200)
check('Duyệt lại RMA -> 409', (await api(`/admin/returns/${rmaId}/approve`, { method: 'POST', token: support })).status === 409)
const beforeReceive = await balanceOf(skuMain)
const receiveRace = await Promise.all([1, 2].map(() => api(`/admin/returns/${rmaId}/receive`, { method: 'POST', token: warehouse })))
const afterReceive = await balanceOf(skuMain)
check('Nhận hàng hoàn đồng thời: đúng 1 x 200, 1 x 409', JSON.stringify(statuses(receiveRace)) === '[200,409]', JSON.stringify(statuses(receiveRace)))
check('Nhận hàng hoàn chỉ cộng P, Q đúng một lần (+2)', afterReceive.p === beforeReceive.p + 2 && afterReceive.q === beforeReceive.q + 2,
  `P ${beforeReceive.p}->${afterReceive.p}, Q ${beforeReceive.q}->${afterReceive.q}`)
check('Nhận hàng hoàn không làm tăng U', afterReceive.availableStock === beforeReceive.availableStock)
const qcRace = await Promise.all([1, 2].map(() => api(`/admin/returns/${rmaId}/qc`, { method: 'POST', token: warehouse, body: { isPassed: true, note: 'đạt' } })))
const afterQc = await balanceOf(skuMain)
check('QC đồng thời: đúng 1 x 200, 1 x 409', JSON.stringify(statuses(qcRace)) === '[200,409]', JSON.stringify(statuses(qcRace)))
check('QC đạt chỉ trừ Q đúng một lần (U tăng 2)', afterQc.q === afterReceive.q - 2 && afterQc.availableStock === afterReceive.availableStock + 2)
const refundUnpaid = await api(`/admin/returns/${rmaId}/refund`, { method: 'POST', token: admin })
check('Hoàn tiền khi đơn chưa đối soát thanh toán -> 409', refundUnpaid.status === 409, JSON.stringify(refundUnpaid.json))
await api(`/admin/orders/${rmaOrder.id}/confirm-payment`, { method: 'POST', token: sales })
const refundRace = await Promise.all([1, 2].map(() => api(`/admin/returns/${rmaId}/refund`, { method: 'POST', token: admin })))
check('Hoàn tiền đồng thời: đúng 1 x 200, 1 x 409', JSON.stringify(statuses(refundRace)) === '[200,409]', JSON.stringify(statuses(refundRace)))
const refundedOrder = (await api(`/orders/${rmaOrder.id}`, { token: customerA })).json
check('Sau hoàn tiền: PaymentStatus=Refunded, RMA=Refunded', refundedOrder.paymentStatus === 'Refunded' && refundedOrder.latestReturn?.status === 'Refunded')

console.log(`\nTASK-010: ${passed} kiểm tra PASS trên ${testDb} (${base}).`)

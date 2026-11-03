import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { connectBrowser } from './browser-cdp.mjs'

const base = process.argv[2] || 'http://127.0.0.1:5173'
const browser = await connectBrowser(Number(process.argv[3] || 9222))
const { send, evaluate, until } = browser
const artifacts = process.argv[4] || 'tests/e2e/artifacts'
await mkdir(artifacts, { recursive: true })
const results = []
async function open(path, ready) {
  await send('Page.navigate', { url: base + path })
  await until(`location.pathname === ${JSON.stringify(path.split('?')[0])} && ${ready}`)
}
async function layout(name, width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 })
  await new Promise(r => setTimeout(r, 150))
  const sizes = await evaluate('({width: innerWidth, content: document.documentElement.scrollWidth})')
  assert(sizes.content <= sizes.width, `${name}: horizontal overflow ${JSON.stringify(sizes)}`)
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await writeFile(`${artifacts}/${name}.png`, Buffer.from(screenshot.data, 'base64'))
  results.push(`${name}: no horizontal overflow`)
}
try {
  await send('Page.enable')
  await open('/', "document.querySelectorAll('.shop-product-card').length > 0")
  assert(await evaluate("document.body.innerText.includes('Cửa hàng demo')"))
  await layout('home-desktop', 1440, 900)
  await layout('home-mobile', 375, 812)
  await open('/products', "document.querySelectorAll('.shop-product-card').length === 12")
  await layout('products-mobile', 375, 812)
  await evaluate("[...document.querySelectorAll('button')].find(x=>x.textContent==='Trang sau').click()")
  await until("location.search.includes('page=2') && document.querySelector('.shop-pagination')?.innerText.includes('Trang 2')")
  results.push('pagination updates query and content')
  await open('/products?category=cham-soc-ca-nhan&sort=price-desc', "document.querySelectorAll('.shop-product-card').length > 0")
  assert.equal(await evaluate("document.querySelector('[name=category]').value"), 'cham-soc-ca-nhan')
  assert.equal(await evaluate("document.querySelector('[name=sort]').value"), 'price-desc')
  results.push('query restores category and sort controls')
  await evaluate("document.querySelector('.shop-product-card a').click()")
  await until("document.querySelector('.shop-detail select')?.options.length > 2")
  const initial = await evaluate("document.querySelector('.shop-detail-price').textContent")
  await evaluate("(()=>{const el=document.querySelector('.shop-detail select'); el.value=el.options[2].value; el.dispatchEvent(new Event('change',{bubbles:true}));})()")
  await until("location.search.includes('sku=')")
  assert.notEqual(await evaluate("document.querySelector('.shop-detail-price').textContent"), initial)
  results.push('SKU selection changes URL and displayed price')
  await layout('detail-mobile', 375, 812)
  await layout('detail-desktop', 1440, 900)
  const detailPath = await evaluate('location.pathname')
  await open(detailPath + '?sku=UNKNOWN-QA-SKU', "document.querySelector('.shop-detail [role=alert]')")
  assert.equal(await evaluate("document.querySelector('.shop-detail-price') === null"), true)
  results.push('unknown SKU shows validation and no price')
  await open('/products?q=unfindable-qa-catalog-fixture', "document.body.innerText.includes('Không có sản phẩm phù hợp')")
  results.push('empty search state')
  await open('/products/unfindable-qa-product', "document.body.innerText.includes('404')")
  results.push('unknown product 404')
  await open('/admin', "document.querySelector('.admin-shell')")
  await layout('admin-mobile', 375, 812)
  assert(await evaluate("document.body.innerText.includes('Chưa có dữ liệu nghiệp vụ')"))
  results.push('admin shell has no fabricated metrics')
  await send('Network.enable')
  await send('Network.setBlockedURLs', { urls: ['*/api/products*'] })
  await open('/products', "document.querySelector('[role=alert]')")
  await send('Network.setBlockedURLs', { urls: [] })
  await evaluate("[...document.querySelectorAll('button')].find(x=>x.textContent==='Thử lại').click()")
  await until("document.querySelectorAll('.shop-product-card').length > 0")
  results.push('API failure and retry recovery')
  console.log(JSON.stringify({ result: 'PASS', base, checks: results, artifacts }))
} finally { browser.close() }

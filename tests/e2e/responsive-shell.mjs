import assert from 'node:assert/strict'
import { connectBrowser } from './browser-cdp.mjs'

const base = process.argv[2] || 'http://localhost:5173'
const browser = await connectBrowser(Number(process.argv[3] || 9222))
const { send, evaluate, until } = browser

const viewports = [
  ['desktop', 1440, 900],
  ['tablet', 768, 1024],
  ['mobile', 375, 812],
]

try {
  await send('Page.enable')
  await send('Page.navigate', { url: `${base}/` })
  await until("document.querySelector('.shop-header') && document.querySelector('.shop-main') && document.querySelector('.shop-footer')")

  const results = []
  for (const [name, width, height] of viewports) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 })
    await new Promise(resolve => setTimeout(resolve, 200))
    const layout = await evaluate(`(() => {
      const box = selector => {
        const rect = document.querySelector(selector).getBoundingClientRect()
        return { left: rect.left, right: rect.right, width: rect.width, height: rect.height }
      }
      return {
        viewport: innerWidth,
        content: document.documentElement.scrollWidth,
        header: box('.shop-header'),
        main: box('.shop-main'),
        footer: box('.shop-footer'),
        searchWidth: box('.shop-search').width
      }
    })()`)
    assert(layout.content <= layout.viewport, `${name}: tràn ngang ${JSON.stringify(layout)}`)
    assert(layout.header.left >= 0 && layout.header.right <= layout.viewport, `${name}: header vượt viewport`)
    assert(layout.main.left >= 0 && layout.main.right <= layout.viewport, `${name}: body vượt viewport`)
    assert(layout.footer.width <= layout.viewport, `${name}: footer vượt viewport`)
    assert(layout.searchWidth >= 250, `${name}: ô tìm kiếm quá hẹp`)
    results.push({ name, width, contentWidth: layout.content, headerHeight: Math.round(layout.header.height) })
  }

  console.log(JSON.stringify({ result: 'PASS', results }))
} finally {
  browser.close()
}

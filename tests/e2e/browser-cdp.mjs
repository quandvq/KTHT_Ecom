// Uses an existing local Chromium CDP endpoint; no browser dependency is installed.
export async function connectBrowser(port = 9222) {
  const targets = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json())
  const target = targets.find(t => t.type === 'page')
  if (!target) throw new Error('No browser page target')
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let nextId = 0
  const pending = new Map()
  ws.onmessage = event => {
    const message = JSON.parse(event.data)
    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    clearTimeout(request.timer)
    if (message.error) request.reject(new Error(JSON.stringify(message.error)))
    else request.resolve(message.result)
  }
  function send(method, params = {}) {
    const id = ++nextId
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 15000)
      pending.set(id, { resolve, reject, timer })
      ws.send(JSON.stringify({ id, method, params }))
    })
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  async function until(expression, timeout = 15000) {
    const end = Date.now() + timeout
    do {
      if (await evaluate(expression)) return
      await new Promise(r => setTimeout(r, 100))
    } while (Date.now() < end)
    throw new Error(`Browser condition timed out: ${expression}`)
  }
  return { send, evaluate, until, close: () => ws.close() }
}

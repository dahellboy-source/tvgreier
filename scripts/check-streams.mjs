import { readFile, writeFile } from 'node:fs/promises'

const input = new URL('../src/data/channels.json', import.meta.url)
const output = process.argv[2] || '/tmp/tvgreier-stream-health.json'
const concurrency = Number.parseInt(process.env.TVGREIER_CHECK_CONCURRENCY || '6', 10)
const timeoutMs = Number.parseInt(process.env.TVGREIER_CHECK_TIMEOUT || '12000', 10)
const catalog = JSON.parse(await readFile(input, 'utf8'))
const results = []
let cursor = 0

function absoluteUrl(value, base) {
  try {
    return new URL(value, base).href
  } catch {
    return null
  }
}

async function request(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'TVgreier stream health checker/1.0',
        origin: 'https://tvgreier.vercel.app',
        ...options.headers,
      },
      ...options,
    })
    return response
  } finally {
    clearTimeout(timer)
  }
}

function cors(response) {
  const value = response.headers.get('access-control-allow-origin') || ''
  return value === '*' || value.includes('vercel.app') || value.includes('tvgreier')
}

async function checkHls(channel) {
  try {
    const manifestResponse = await request(channel.url)
    const manifest = await manifestResponse.text()
    const firstMedia = manifest
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('#'))
    const mediaUrl = firstMedia ? absoluteUrl(firstMedia, manifestResponse.url) : null
    const manifestOk = manifestResponse.ok && manifest.startsWith('#EXTM3U') && cors(manifestResponse)

    if (!manifestOk || !mediaUrl) {
      return {
        id: channel.id,
        format: channel.format,
        ok: false,
        stage: 'manifest',
        status: manifestResponse.status,
        contentType: manifestResponse.headers.get('content-type'),
        cors: cors(manifestResponse),
      }
    }

    const mediaResponse = await request(mediaUrl, { headers: { range: 'bytes=0-1' } })
    await mediaResponse.body?.cancel()
    return {
      id: channel.id,
      format: channel.format,
      ok: mediaResponse.ok && cors(mediaResponse),
      stage: 'segment',
      status: mediaResponse.status,
      contentType: mediaResponse.headers.get('content-type'),
      cors: cors(mediaResponse),
    }
  } catch (error) {
    return { id: channel.id, format: channel.format, ok: false, stage: 'network', error: error.name }
  }
}

async function checkExternal(channel) {
  try {
    let response = await request(channel.url, { method: 'HEAD' })
    if (response.status === 405 || response.status === 501) response = await request(channel.url)
    await response.body?.cancel()
    return { id: channel.id, format: channel.format, ok: response.ok, stage: 'link', status: response.status }
  } catch (error) {
    return { id: channel.id, format: channel.format, ok: false, stage: 'network', error: error.name }
  }
}

async function worker() {
  while (true) {
    const index = cursor++
    const channel = catalog.channels[index]
    if (!channel) return
    const result = channel.format === 'hls' ? await checkHls(channel) : await checkExternal(channel)
    results.push(result)
    if ((index + 1) % 25 === 0 || index + 1 === catalog.channels.length) {
      console.log(`checked ${index + 1}/${catalog.channels.length}`)
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker))
results.sort((a, b) => a.id.localeCompare(b.id))
const summary = {
  checkedAt: new Date().toISOString(),
  sourceSha: catalog.sourceSha,
  total: results.length,
  healthy: results.filter((result) => result.ok).length,
  unhealthy: results.filter((result) => !result.ok).length,
  results,
}
await writeFile(output, `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify({ output, total: summary.total, healthy: summary.healthy, unhealthy: summary.unhealthy }))

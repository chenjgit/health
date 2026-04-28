const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const CACHE_TTL_MS = 30 * 60 * 1000

function decodeHtml(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function makeRemoteId(link) {
  const b64 = Buffer.from(String(link || ''), 'utf8')
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return `remote_${b64}`
}

function httpGet(url, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? require('https') : require('http')
    const req = lib.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          resolve(httpGet(res.headers.location, timeoutMs))
          return
        }
        if (res.statusCode && res.statusCode >= 400) {
          res.resume()
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        res.setEncoding('utf8')
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => resolve(data))
      }
    )
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Request timeout')))
  })
}

async function getCache(cacheKey) {
  try {
    const res = await db.collection('runtime_cache').doc(cacheKey).get()
    const doc = res && res.data
    if (!doc || !doc.data || !doc.updatedAtMs) return null
    if (Date.now() - doc.updatedAtMs > CACHE_TTL_MS) return null
    return doc.data
  } catch (e) {
    return null
  }
}

async function setCache(cacheKey, data) {
  const payload = { data, updatedAtMs: Date.now() }
  try {
    await db.collection('runtime_cache').doc(cacheKey).set({ data: payload })
  } catch (e) {
    try {
      await db.collection('runtime_cache').doc(cacheKey).update({ data: payload })
    } catch (err) {}
  }
}

function parseXiachufangSearch(html, size) {
  const out = []
  const re = /<a[^>]+href="(\/recipe\/\d+\/)"[^>]*title="([^"]+)"[^>]*>/gi
  let m
  while ((m = re.exec(html)) && out.length < size) {
    const path = m[1]
    const title = decodeHtml(m[2])
    const link = `https://www.xiachufang.com${path}`
    out.push({
      _id: makeRemoteId(link),
      name: title,
      summary: '',
      source: '下厨房',
      link
    })
  }
  return out
}

exports.main = async (event, context) => {
  const { page = 0, size = 10, q, category, effect, constitution } = event

  const keyword = String(q || '').trim() || '养生'
  const extra = [category, effect, constitution].filter((x) => x && x !== '全部').join(' ')
  const combined = extra ? `${keyword} ${extra}` : keyword
  const cacheKey = `recipe_list_v1_${Buffer.from(combined, 'utf8').toString('base64').replace(/=+$/g, '')}_${page}_${size}`

  const cached = await getCache(cacheKey)
  if (cached && cached.list) {
    return { success: true, data: cached }
  }

  const url = `https://www.xiachufang.com/search/?keyword=${encodeURIComponent(combined)}&page=${page + 1}`
  const html = await httpGet(url)
  const list = parseXiachufangSearch(html, size)
  const hasMore = list.length === size
  const data = { list, hasMore }
  await setCache(cacheKey, data)
  return { success: true, data }
}

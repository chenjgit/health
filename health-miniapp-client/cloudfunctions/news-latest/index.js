const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

const CACHE_DOC_ID = 'news_latest_v2'
const CACHE_TTL_MS = 5 * 60 * 1000

function formatDate(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function httpGetJson(url, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? require('https') : require('http')
    const req = lib.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json,text/plain,*/*'
        }
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          resolve(httpGetJson(res.headers.location, timeoutMs))
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
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(e)
          }
        })
      }
    )
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Request timeout')))
  })
}

async function getCache() {
  try {
    const res = await db.collection('runtime_cache').doc(CACHE_DOC_ID).get()
    const doc = res && res.data
    if (!doc || !doc.data || !doc.updatedAtMs) return null
    if (Date.now() - doc.updatedAtMs > CACHE_TTL_MS) return null
    return doc.data
  } catch (e) {
    return null
  }
}

async function setCache(data) {
  const payload = { data, updatedAtMs: Date.now() }
  try {
    await db.collection('runtime_cache').doc(CACHE_DOC_ID).set({ data: payload })
  } catch (e) {
    try {
      await db.collection('runtime_cache').doc(CACHE_DOC_ID).update({ data: payload })
    } catch (err) {}
  }
}

exports.main = async (event, context) => {
  const { limit = 6 } = event

  const cached = await getCache()
  if (cached && Array.isArray(cached) && cached.length) {
    return { success: true, data: cached.slice(0, limit) }
  }

  const today = formatDate(new Date())
  const url = `https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=${encodeURIComponent(
    limit
  )}&desktop=true`

  const json = await httpGetJson(url)
  const items = (json && json.data) || []
  const list = items
    .map((it) => it && it.target)
    .filter(Boolean)
    .map((t) => ({
      _id: `zhihu_${t.id}`,
      title: t.title,
      summary: (t.excerpt || '').slice(0, 120),
      content: t.excerpt || '',
      source: '知乎热榜',
      category: '热点',
      link: t.url || '',
      publishedAt: today,
      createdAt: today
    }))

  await setCache(list)
  return { success: true, data: list.slice(0, limit) }
}

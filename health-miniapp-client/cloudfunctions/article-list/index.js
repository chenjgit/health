const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const CACHE_DOC_ID = 'article_list_v2'
const CACHE_TTL_MS = 10 * 60 * 1000

function formatDate(date) {
  if (!date) return ''
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
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Request timeout'))
    })
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
  const payload = {
    data,
    updatedAtMs: Date.now()
  }
  try {
    await db.collection('runtime_cache').doc(CACHE_DOC_ID).set({ data: payload })
  } catch (e) {
    try {
      await db.collection('runtime_cache').doc(CACHE_DOC_ID).update({ data: payload })
    } catch (err) {}
  }
}

function normalizeZhihuDailyStories(stories, dateStr) {
  const createdAt = dateStr && /^\d{8}$/.test(dateStr)
    ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    : formatDate(new Date())
  return (stories || []).map((s) => {
    const id = s && s.id
    const cover = Array.isArray(s.images) && s.images.length ? s.images[0] : ''
    return {
      _id: `zhihudaily_${id}`,
      title: s.title || '',
      summary: s.hint || '',
      content: '',
      category: '知乎日报',
      source: '知乎日报',
      link: id ? `https://daily.zhihu.com/story/${id}` : '',
      coverUrl: cover,
      createdAt
    }
  }).filter((it) => it._id && it.title)
}

async function fetchZhihuDailyArticles(limit) {
  const out = []
  let dateStr = ''
  let guard = 0

  const first = await httpGetJson('https://news-at.zhihu.com/api/4/news/latest', 1500)
  dateStr = first && first.date ? String(first.date) : ''
  out.push(...normalizeZhihuDailyStories(first && first.stories, dateStr))
  guard += 1

  while (out.length < limit && dateStr && guard < 3) {
    const next = await httpGetJson(`https://news-at.zhihu.com/api/4/news/before/${dateStr}`, 1500)
    dateStr = next && next.date ? String(next.date) : ''
    out.push(...normalizeZhihuDailyStories(next && next.stories, dateStr))
    guard += 1
  }
  return out.slice(0, limit)
}

exports.main = async (event, context) => {
  const { page = 0, size = 10, q = '' } = event
  
  const cached = await getCache()
  let list = Array.isArray(cached) ? cached : null
  if (!list || !list.length) {
    const want = Math.min(80, (page + 1) * size + 20)
    list = await fetchZhihuDailyArticles(want)
    if (list && list.length) await setCache(list)
  } else if (list.length < (page + 1) * size) {
    const want = Math.min(80, (page + 1) * size + 20)
    const refreshed = await fetchZhihuDailyArticles(want)
    if (refreshed && refreshed.length) {
      list = refreshed
      await setCache(list)
    }
  }
  if (!list) {
    return {
      success: true,
      data: { list: [], total: 0, page, size }
    }
  }

  const keyword = String(q || '').trim().toLowerCase()
  let filtered = list
  if (keyword) {
    filtered = list.filter((it) => {
      const hay = `${it.title || ''} ${it.summary || ''}`.toLowerCase()
      return hay.includes(keyword)
    })
  }

  const total = filtered.length
  const sliced = filtered.slice(page * size, page * size + size)
  const hasMore = total > (page + 1) * size

  return {
    success: true,
    data: {
      list: sliced,
      total,
      hasMore,
      page,
      size
    }
  }
}

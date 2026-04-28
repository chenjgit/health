const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

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

function stripHtml(html) {
  return decodeHtml(String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
}

function decodeRemoteId(id) {
  const raw = String(id || '')
  if (!raw.startsWith('remote_')) return null
  const b64 = raw.slice('remote_'.length).replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  try {
    return Buffer.from(b64 + pad, 'base64').toString('utf8')
  } catch (e) {
    return null
  }
}

function httpGet(url, timeoutMs = 2500) {
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

function parseXiachufangDetail(html, link, id) {
  const titleMatch = html.match(/<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([\s\S]*?)<\/title>/i)
  const title = stripHtml(titleMatch ? titleMatch[1] : '')

  const ingBlockMatch = html.match(/<div[^>]*class="[^"]*ings[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
  let ingredients = ''
  if (ingBlockMatch) {
    const li = ingBlockMatch[1].match(/<li[\s\S]*?<\/li>/gi) || []
    ingredients = li.map(stripHtml).filter(Boolean).slice(0, 30).join('\n')
  }

  const stepBlockMatch = html.match(/<div[^>]*class="[^"]*steps[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
  let steps = ''
  if (stepBlockMatch) {
    const ps = stepBlockMatch[1].match(/<p[^>]*class="[^"]*text[^"]*"[^>]*>([\s\S]*?)<\/p>/gi) || []
    const lines = ps.map(stripHtml).filter(Boolean).slice(0, 30)
    steps = lines.map((t, i) => `${i + 1}. ${t}`).join('\n')
  }

  return {
    _id: id,
    name: title || '养生食谱',
    summary: '',
    ingredients,
    steps,
    source: '下厨房',
    link
  }
}

exports.main = async (event, context) => {
  const { id } = event
  
  try {
    if (!id) {
      return { success: false, message: '食谱ID不能为空' }
    }

    const cacheKey = `recipe_detail_v1_${id}`
    const cached = await getCache(cacheKey)
    if (cached) return { success: true, data: cached }

    const link = decodeRemoteId(id)
    if (!link) return { success: false, message: '食谱不存在' }

    const html = await httpGet(link)
    const data = parseXiachufangDetail(html, link, id)
    await setCache(cacheKey, data)
    return { success: true, data }
  } catch (err) {
    console.error('Recipe detail error:', err)
    return { success: false, message: '获取食谱详情失败' }
  }
}

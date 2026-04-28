const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

const CACHE_TTL_MS = 10 * 60 * 1000

function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

async function getCachedList(docId) {
  try {
    const res = await db.collection('runtime_cache').doc(docId).get()
    const doc = res && res.data
    if (!doc || !doc.data || !doc.updatedAtMs) return null
    if (Date.now() - doc.updatedAtMs > CACHE_TTL_MS) return null
    return Array.isArray(doc.data) ? doc.data : null
  } catch (e) {
    return null
  }
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function httpGetJson(url, timeoutMs = 1800) {
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

exports.main = async (event, context) => {
  const { id } = event
  
  if (!id) {
    return { success: false, message: '文章ID不能为空' }
  }

  if (String(id).startsWith('zhihudaily_')) {
    const rawId = String(id).slice('zhihudaily_'.length)
    const numericId = Number(rawId)
    if (!Number.isFinite(numericId)) {
      return { success: false, message: '文章ID不合法' }
    }
    const detail = await httpGetJson(`https://news-at.zhihu.com/api/4/news/${numericId}`, 1800)
    const content = stripHtml(detail && detail.body)
    const link = (detail && (detail.share_url || detail.url)) || `https://daily.zhihu.com/story/${numericId}`
    return {
      success: true,
      data: {
        _id: id,
        title: (detail && detail.title) || '知乎日报',
        summary: '',
        content,
        category: '知乎日报',
        source: '知乎日报',
        link,
        coverUrl: (detail && detail.image) || '',
        createdAt: formatDate(new Date())
      }
    }
  }
  
  const remoteLink = decodeRemoteId(id)
  if (remoteLink) {
    const [a] = await Promise.all([getCachedList('article_list_v2')])
    const pools = []
    if (Array.isArray(a)) pools.push(a)
    for (const pool of pools) {
      const hit = pool.find((it) => it && (it._id === id || it.link === remoteLink))
      if (hit) {
        return {
          success: true,
          data: {
            _id: hit._id || id,
            title: hit.title || '健康资讯',
            summary: hit.summary || '',
            content: hit.content || hit.summary || '',
            category: hit.category || '资讯',
            source: hit.source || '',
            link: hit.link || remoteLink,
            createdAt: hit.createdAt || hit.publishedAt || formatDate(new Date())
          }
        }
      }
    }
    return {
      success: true,
      data: {
        _id: id,
        title: '健康资讯',
        summary: '',
        content: '',
        category: '资讯',
        link: remoteLink,
        createdAt: formatDate(new Date())
      }
    }
  }

  if (String(id).startsWith('zhihu_')) {
    const list = await getCachedList('news_latest_v2')
    const hit = Array.isArray(list) ? list.find((it) => it && it._id === id) : null
    if (hit) return { success: true, data: hit }
  }

  return { success: false, message: '文章不存在或已过期' }
}

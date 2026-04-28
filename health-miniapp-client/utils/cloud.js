/**
 * 云开发工具类
 */
let _inited = false
let _shownCloudErrorHelp = false
const DEFAULT_ENV_ID = 'cloud1-d3gw8242lcf851198'
let _currentEnvId = DEFAULT_ENV_ID
const LOCAL_ONLY_KEY = 'local_only_mode_v1'
const LOCAL_ONLY_TTL_MS = 30 * 60 * 1000

function isLocalOnlyActive() {
  try {
    const v = wx.getStorageSync(LOCAL_ONLY_KEY)
    if (!v || !v.updatedAtMs) return false
    return Date.now() - Number(v.updatedAtMs || 0) < LOCAL_ONLY_TTL_MS
  } catch (e) {
    return false
  }
}

function markLocalOnly(msg) {
  try {
    wx.setStorageSync(LOCAL_ONLY_KEY, { updatedAtMs: Date.now(), msg: String(msg || '') })
  } catch (e) {}
}

function ensureCloudReady() {
  if (!wx.cloud) {
    throw new Error('当前基础库不支持云开发')
  }
  if (_inited) return
  const envId = String(wx.getStorageSync('CLOUDBASE_ENV_ID') || '').trim()
  const finalEnvId = envId || DEFAULT_ENV_ID
  _currentEnvId = finalEnvId
  try {
    wx.cloud.init({ env: finalEnvId, traceUser: true })
  } catch (e) {}
  _inited = true
}

function getCloudEnvId() {
  return String(wx.getStorageSync('CLOUDBASE_ENV_ID') || '').trim() || DEFAULT_ENV_ID
}

function setCloudEnvId(envId) {
  const v = String(envId || '').trim()
  if (v) {
    wx.setStorageSync('CLOUDBASE_ENV_ID', v)
  } else {
    wx.removeStorageSync('CLOUDBASE_ENV_ID')
  }
  _currentEnvId = v || DEFAULT_ENV_ID
  _inited = false
  _shownCloudErrorHelp = false
}

function getMiniProgramAppId() {
  try {
    const info = wx.getAccountInfoSync && wx.getAccountInfoSync()
    return (info && info.miniProgram && info.miniProgram.appId) || ''
  } catch (e) {
    return ''
  }
}

function showCloudHelpOnce(msg) {
  if (_shownCloudErrorHelp) return
  _shownCloudErrorHelp = true
  const appId = getMiniProgramAppId()
  const envId = _currentEnvId || getCloudEnvId()
  wx.showModal({
    title: '云开发未就绪',
    content:
      `云函数调用失败：\n${msg}\n\n当前 AppID：${appId || '未知'}\n当前环境ID：${envId || '未设置'}\n\n请检查：\n1) 开发者工具已开通并选择云环境\n2) 云函数已部署到该环境\n3) 数据库已创建：user/daily_checkin/health_plan/favorite/runtime_cache\n\n你也可以在“我的 → 云环境设置”填写环境ID，或在控制台执行：\nwx.setStorageSync('CLOUDBASE_ENV_ID','你的环境ID')`,
    showCancel: false,
    confirmText: '知道了'
  })
}

function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      success: (res) => resolve(res),
      fail: (err) => reject(err)
    })
  })
}

async function requestJson(url, timeoutMs = 2500) {
  const res = await request({
    url,
    method: 'GET',
    timeout: timeoutMs,
    header: {
      Accept: 'application/json,text/plain,*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile'
    }
  })
  return res && res.data
}

async function requestText(url, timeoutMs = 4000) {
  const res = await request({
    url,
    method: 'GET',
    timeout: timeoutMs,
    header: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile'
    }
  })
  return typeof (res && res.data) === 'string' ? res.data : ''
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

function localNowDateStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getLocalCache(key, ttlMs) {
  const obj = wx.getStorageSync(key)
  if (!obj || !obj.updatedAtMs) return null
  if (Date.now() - obj.updatedAtMs > ttlMs) return null
  return obj.data
}

function setLocalCache(key, data) {
  wx.setStorageSync(key, { updatedAtMs: Date.now(), data })
}

function ensureArray(v) {
  return Array.isArray(v) ? v : []
}

function parseXiachufangSearch(html, size) {
  const out = []
  const re = /<a[^>]+href="(\/recipe\/\d+\/)"[^>]*title="([^"]+)"[^>]*>/gi
  let m
  while ((m = re.exec(html)) && out.length < size) {
    const path = m[1]
    const title = stripHtml(m[2])
    const link = `https://www.xiachufang.com${path}`
    out.push({
      _id: `remote_${encodeURIComponent(link)}`,
      name: title,
      summary: '',
      source: '下厨房',
      category: '食谱',
      link
    })
  }
  if (out.length < size) {
    const re2 = /<a[^>]+href="(\/recipe\/\d+\/)"[^>]*>/gi
    while ((m = re2.exec(html)) && out.length < size) {
      const path = m[1]
      const start = Math.max(0, m.index)
      const seg = html.slice(start, start + 500)
      const t1 = seg.match(/title="([^"]+)"/i)
      const t2 = seg.match(/alt="([^"]+)"/i)
      const t3 = seg.match(/class="[^"]*name[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i)
      const title = stripHtml((t1 && t1[1]) || (t2 && t2[1]) || (t3 && t3[1]) || '')
      if (!title) continue
      const link = `https://www.xiachufang.com${path}`
      if (out.some((x) => x && x.link === link)) continue
      out.push({
        _id: `remote_${encodeURIComponent(link)}`,
        name: title,
        summary: '',
        source: '下厨房',
        category: '食谱',
        link
      })
    }
  }
  return out
}

function decodeRecipeRemoteId(id) {
  const raw = String(id || '')
  if (raw.startsWith('remote_')) {
    try {
      return decodeURIComponent(raw.slice('remote_'.length))
    } catch (e) {
      return null
    }
  }
  return null
}

function parseXiachufangDetail(html, link, id) {
  const titleMatch =
    html.match(/<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/<title>([\s\S]*?)<\/title>/i)
  const title = stripHtml(titleMatch ? titleMatch[1] : '')

  let ingredients = ''
  const ingBlockMatch = html.match(/<div[^>]*class="[^"]*ings[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
  if (ingBlockMatch) {
    const li = ingBlockMatch[1].match(/<li[\s\S]*?<\/li>/gi) || []
    ingredients = li.map(stripHtml).filter(Boolean).slice(0, 40).join('\n')
  }

  let steps = ''
  const stepBlockMatch = html.match(/<div[^>]*class="[^"]*steps[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
  if (stepBlockMatch) {
    const ps = stepBlockMatch[1].match(/<p[^>]*class="[^"]*text[^"]*"[^>]*>([\s\S]*?)<\/p>/gi) || []
    const lines = ps.map(stripHtml).filter(Boolean).slice(0, 40)
    steps = lines.map((t, i) => `${i + 1}. ${t}`).join('\n')
  }

  return {
    _id: id,
    name: title || '养生食谱',
    summary: '',
    ingredients,
    steps,
    source: '下厨房',
    category: '食谱',
    link
  }
}

function shouldFallbackToHttp(msg) {
  const s = String(msg || '')
  return (
    s.includes('-504002') ||
    s.includes('-501000') ||
    s.includes('Cannot find module') ||
    s.includes('wx-server-sdk') ||
    s.includes('HTTP 401') ||
    s.includes(' 401 ') ||
    s.includes('Unauthorized')
  )
}

async function localInvoke(name, data) {
  if (name === 'news-latest') {
    const limit = Math.max(1, Math.min(Number((data && data.limit) || 6) || 6, 20))
    const key = `local_news_latest_v1_${limit}`
    const cached = getLocalCache(key, 3 * 60 * 1000)
    if (cached) return cached

    const json = await requestJson('https://news-at.zhihu.com/api/4/news/latest', 2000)
    const today = localNowDateStr()
    const merged = ensureArray(json && json.top_stories).concat(ensureArray(json && json.stories))
    const list = merged
      .slice(0, limit)
      .map((s) => ({
        _id: `zhihudaily_${s && s.id}`,
        title: (s && s.title) || '',
        summary: (s && s.hint) || '',
        content: '',
        source: '知乎日报',
        category: '健康资讯',
        link: s && s.id ? `https://daily.zhihu.com/story/${s.id}` : '',
        coverUrl: (s && (s.image || (Array.isArray(s.images) ? s.images[0] : ''))) || '',
        publishedAt: today,
        createdAt: today
      }))
      .filter((it) => it._id && it.title)

    setLocalCache(key, list)
    const map = wx.getStorageSync('news_cache_map') || {}
    for (const it of list) map[it._id] = it
    wx.setStorageSync('news_cache_map', map)
    wx.setStorageSync('news_cache_list', list)
    return list
  }

  if (name === 'article-list') {
    const page = Math.max(0, Number((data && data.page) || 0) || 0)
    const size = Math.max(1, Math.min(Number((data && data.size) || 10) || 10, 30))
    const q = String((data && data.q) || '').trim()
    const sort = String((data && data.sort) || 'latest')
    const platform = String((data && data.platform) || '全部')
    const from = String((data && data.from) || '').trim()
    const to = String((data && data.to) || '').trim()
    const want = (page + 1) * size + 10

    const cacheKey = 'local_zhihudaily_pool_v1'
    const cached = wx.getStorageSync(cacheKey) || {}
    let pool = ensureArray(cached.list)
    let cursor = String(cached.cursor || '')
    let updatedAtMs = Number(cached.updatedAtMs || 0)
    if (!pool.length || !updatedAtMs || Date.now() - updatedAtMs > 30 * 60 * 1000) {
      const latest = await requestJson('https://news-at.zhihu.com/api/4/news/latest', 2200)
      cursor = String((latest && latest.date) || '')
      const baseDate = cursor && /^\d{8}$/.test(cursor)
        ? `${cursor.slice(0, 4)}-${cursor.slice(4, 6)}-${cursor.slice(6, 8)}`
        : localNowDateStr()
      const zhihuStories = ensureArray(latest && latest.stories).map((s) => ({
        _id: `zhihudaily_${s.id}`,
        title: s.title || '',
        summary: s.hint || '',
        content: '',
        category: '文章',
        source: '知乎日报',
        link: s.id ? `https://daily.zhihu.com/story/${s.id}` : '',
        coverUrl: (Array.isArray(s.images) && s.images[0]) || '',
        createdAt: baseDate,
        createdAtTs: Date.parse(`${baseDate}T00:00:00+08:00`) || Date.now()
      })).filter((it) => it._id && it.title)

      const parseRss = (xml, source, limit = 30) => {
        const out = []
        const items = String(xml || '').match(/<item[\s\S]*?<\/item>/gi) || []
        for (const it of items) {
          if (out.length >= limit) break
          const t = it.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) || it.match(/<title>([\s\S]*?)<\/title>/i)
          const l = it.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/i) || it.match(/<link>([\s\S]*?)<\/link>/i)
          const p = it.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || it.match(/<updated>([\s\S]*?)<\/updated>/i)
          const title = stripHtml(t ? t[1] : '')
          const link = stripHtml(l ? l[1] : '')
          if (!title || !link) continue
          const ts = Date.parse(stripHtml(p ? p[1] : '')) || Date.now()
          const d = new Date(ts)
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          const id = `rss_${encodeURIComponent(link).slice(0, 180)}`
          out.push({
            _id: id,
            title,
            summary: '',
            content: '',
            category: '文章',
            source,
            link,
            coverUrl: '',
            createdAt: dateStr,
            createdAtTs: ts
          })
        }
        return out
      }

      const rssTasks = [
        requestText('https://sspai.com/feed', 2800).then((xml) => parseRss(xml, '少数派', 30)).catch(() => []),
        requestText('https://www.huxiu.com/rss/0.xml', 2800).then((xml) => parseRss(xml, '虎嗅', 30)).catch(() => []),
        requestText('https://36kr.com/feed', 2800).then((xml) => parseRss(xml, '36氪', 30)).catch(() => []),
        requestText('https://juejin.cn/rss', 2800).then((xml) => parseRss(xml, '掘金', 30)).catch(() => [])
      ]
      const rssLists = await Promise.all(rssTasks)
      const rssMerged = rssLists.reduce((acc, cur) => acc.concat(cur || []), [])

      pool = zhihuStories.concat(rssMerged)
      updatedAtMs = Date.now()
    }

    let rounds = 0
    const maxRounds = 30
    while (sort !== 'rank' && pool.length < want && cursor && rounds < maxRounds) {
      const more = await requestJson(`https://news-at.zhihu.com/api/4/news/before/${cursor}`, 2000)
      const nextCursor = String((more && more.date) || '')
      if (!nextCursor || nextCursor === cursor) {
        cursor = nextCursor
        break
      }
      cursor = nextCursor
      const baseDate = cursor && /^\d{8}$/.test(cursor)
        ? `${cursor.slice(0, 4)}-${cursor.slice(4, 6)}-${cursor.slice(6, 8)}`
        : localNowDateStr()
      const list = ensureArray(more && more.stories).map((s) => ({
        _id: `zhihudaily_${s.id}`,
        title: s.title || '',
        summary: s.hint || '',
        content: '',
        category: '文章',
        source: '知乎日报',
        link: s.id ? `https://daily.zhihu.com/story/${s.id}` : '',
        coverUrl: (Array.isArray(s.images) && s.images[0]) || '',
        createdAt: baseDate,
        createdAtTs: Date.parse(`${baseDate}T00:00:00+08:00`) || Date.now()
      })).filter((it) => it._id && it.title)
      pool = pool.concat(list)
      rounds += 1
      if (!list.length) break
    }

    wx.setStorageSync(cacheKey, { updatedAtMs, cursor, list: pool.slice(0, 2000) })

    const keyword = q.toLowerCase()
    let filtered = pool.slice()
    if (platform && platform !== '全部') {
      filtered = filtered.filter((it) => String(it && it.source) === platform)
    }
    if (from) {
      filtered = filtered.filter((it) => String(it && it.createdAt) >= from)
    }
    if (to) {
      filtered = filtered.filter((it) => String(it && it.createdAt) <= to)
    }
    if (keyword) {
      filtered = filtered.filter((it) => `${it.title || ''} ${it.summary || ''}`.toLowerCase().includes(keyword))
    }

    if (sort === 'hot') {
      const stats = wx.getStorageSync('article_stats_v1') || {}
      filtered.sort((a, b) => {
        const av = stats[a._id] ? Number(stats[a._id].views || 0) : 0
        const bv = stats[b._id] ? Number(stats[b._id].views || 0) : 0
        if (bv !== av) return bv - av
        return Number(b.createdAtTs || 0) - Number(a.createdAtTs || 0)
      })
    } else if (sort === 'rank') {
      const top = filtered.filter((it) => String(it && it.source) === '知乎日报').slice(0, 30)
      const rest = filtered.filter((it) => String(it && it.source) !== '知乎日报')
      filtered = top.concat(rest)
    } else {
      filtered.sort((a, b) => Number(b.createdAtTs || 0) - Number(a.createdAtTs || 0))
    }

    const total = filtered.length
    const sliced = filtered.slice(page * size, page * size + size)
    const hasMore = Boolean(cursor) || total > (page + 1) * size

    const map = wx.getStorageSync('article_cache_map') || {}
    for (const it of sliced) map[it._id] = it
    wx.setStorageSync('article_cache_map', map)
    wx.setStorageSync('article_cache_list', filtered.slice(0, 30))

    return { list: sliced, total, page, size, hasMore }
  }

  if (name === 'article-detail') {
    const id = String((data && data.id) || '').trim()
    if (!id) throw new Error('文章ID不能为空')

    if (id.startsWith('zhihudaily_')) {
      const raw = id.slice('zhihudaily_'.length)
      const n = Number(raw)
      if (!Number.isFinite(n)) throw new Error('文章ID不合法')
      const detail = await requestJson(`https://news-at.zhihu.com/api/4/news/${n}`, 2500)
      const link = (detail && (detail.share_url || detail.url)) || `https://daily.zhihu.com/story/${n}`
      return {
        _id: id,
        title: (detail && detail.title) || '知乎日报',
        summary: '',
        content: stripHtml(detail && detail.body),
        category: '知乎日报',
        source: '知乎日报',
        link,
        coverUrl: (detail && detail.image) || '',
        createdAt: localNowDateStr()
      }
    }

    const a = wx.getStorageSync('article_cache_map') || {}
    const n = wx.getStorageSync('news_cache_map') || {}
    const cached = a[id] || n[id]
    if (cached) return cached
    throw new Error('文章不存在')
  }

  if (name === 'tip-today') {
    const pool = getLocalCache('local_tip_pool_v1', 10 * 60 * 1000) || []
    if (pool && pool.title) return pool
    const a = wx.getStorageSync('article_cache_list') || []
    const n = wx.getStorageSync('news_cache_list') || []
    const merged = ensureArray(a).concat(ensureArray(n))
    const idx = Math.floor(Date.now() / 86400000) % Math.max(1, merged.length)
    const item = merged[idx] || {}
    const tip = {
      title: item.title || '今日健康小贴士',
      content: item.summary || item.content || ''
    }
    setLocalCache('local_tip_pool_v1', tip)
    return tip
  }

  if (name === 'tip-list') {
    const limit = Math.max(1, Math.min(Number((data && data.limit) || 6) || 6, 20))
    const key = `local_tip_list_v1_${limit}`
    const cached = getLocalCache(key, 5 * 60 * 1000)
    if (cached) return cached
    const json = await requestJson('https://news-at.zhihu.com/api/4/news/latest', 2000)
    const list = ensureArray(json && json.stories)
      .slice(0, limit)
      .map((s) => ({
        _id: `tip_${s && s.id}`,
        title: (s && s.title) || '',
        content: (s && s.hint) || '',
        source: '知乎日报',
        link: s && s.id ? `https://daily.zhihu.com/story/${s.id}` : ''
      }))
      .filter((it) => it.title)
    setLocalCache(key, list)
    return list
  }

  if (name === 'recipe-list') {
    const page = Math.max(0, Number((data && data.page) || 0) || 0)
    const size = Math.max(1, Math.min(Number((data && data.size) || 10) || 10, 20))
    const qRaw = String((data && data.q) || '').trim()
    const q = qRaw
    const extra = [data && data.category, data && data.effect, data && data.constitution]
      .filter((x) => x && x !== '全部')
      .join(' ')
    const keyword = extra ? `${q} ${extra}`.trim() : q
    const useExplore = !keyword
    const cacheKey = useExplore
      ? `local_recipe_explore_v1_${page}_${size}`
      : `local_recipe_list_v1_${encodeURIComponent(keyword)}_${page}_${size}`
    const cached = getLocalCache(cacheKey, 20 * 60 * 1000)
    if (cached) return cached

    const url = useExplore
      ? `https://www.xiachufang.com/explore/?page=${page + 1}`
      : `https://www.xiachufang.com/search/?keyword=${encodeURIComponent(keyword)}&page=${page + 1}`
    const html = await requestText(url, 4500)
    const list = parseXiachufangSearch(html, size)
    const res = { list, hasMore: list.length === size }
    setLocalCache(cacheKey, res)

    const map = wx.getStorageSync('recipe_cache_map') || {}
    for (const it of list) map[it._id] = it
    wx.setStorageSync('recipe_cache_map', map)
    wx.setStorageSync('recipe_cache_list', list)

    return res
  }

  if (name === 'recipe-detail') {
    const id = String((data && data.id) || '').trim()
    if (!id) throw new Error('食谱ID不能为空')
    const cacheKey = `local_recipe_detail_v1_${id}`
    const cached = getLocalCache(cacheKey, 24 * 60 * 60 * 1000)
    if (cached) return cached

    const link = decodeRecipeRemoteId(id)
    if (!link) throw new Error('食谱不存在')
    const html = await requestText(link, 4500)
    const recipe = parseXiachufangDetail(html, link, id)
    setLocalCache(cacheKey, recipe)
    const map = wx.getStorageSync('recipe_cache_map') || {}
    map[id] = recipe
    wx.setStorageSync('recipe_cache_map', map)
    return recipe
  }

  if (name === 'plan-list') {
    const list = wx.getStorageSync('local_plan_v1') || []
    const mine = ensureArray(list)
    const recommended = mine.filter((p) => p && p.isRecommended)
    return { recommended, mine }
  }

  if (name === 'plan-create') {
    const list = wx.getStorageSync('local_plan_v1') || []
    const mine = ensureArray(list)
    const id = `plan_${Date.now()}`
    const item = {
      _id: id,
      ownerId: 'local',
      name: String((data && data.name) || '').trim(),
      summary: String((data && data.summary) || ''),
      content: String((data && data.content) || ''),
      days: data && data.days != null ? Number(data.days) : null,
      level: String((data && data.level) || ''),
      isRecommended: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    mine.unshift(item)
    wx.setStorageSync('local_plan_v1', mine)
    return item
  }

  if (name === 'plan-update') {
    const list = wx.getStorageSync('local_plan_v1') || []
    const mine = ensureArray(list)
    const id = String((data && (data.id || data._id)) || '')
    const next = mine.map((p) => {
      if (!p || p._id !== id) return p
      return {
        ...p,
        name: data && data.name != null ? String(data.name) : p.name,
        summary: data && data.summary != null ? String(data.summary) : p.summary,
        content: data && data.content != null ? String(data.content) : p.content,
        days: data && data.days !== undefined ? (data.days == null ? null : Number(data.days)) : p.days,
        level: data && data.level != null ? String(data.level) : p.level,
        isRecommended: data && data.isRecommended !== undefined ? !!data.isRecommended : p.isRecommended,
        updatedAt: Date.now()
      }
    })
    wx.setStorageSync('local_plan_v1', next)
    const updated = next.find((p) => p && p._id === id)
    return updated || null
  }

  if (name === 'plan-delete') {
    const list = wx.getStorageSync('local_plan_v1') || []
    const mine = ensureArray(list)
    const id = String((data && data.id) || '')
    const next = mine.filter((p) => p && p._id !== id)
    wx.setStorageSync('local_plan_v1', next)
    return { removed: true }
  }

  if (name === 'plan-recommend-toggle') {
    const list = wx.getStorageSync('local_plan_v1') || []
    const mine = ensureArray(list)
    const id = String((data && data.id) || '')
    let isRecommended = false
    const next = mine.map((p) => {
      if (!p || p._id !== id) return p
      isRecommended = !p.isRecommended
      return { ...p, isRecommended, updatedAt: Date.now() }
    })
    wx.setStorageSync('local_plan_v1', next)
    return { isRecommended }
  }

  if (name === 'favorite-check') {
    const type = String((data && data.type) || 'article')
    const targetIds = ensureArray(data && data.targetIds)
    const store = wx.getStorageSync(`local_favorite_${type}_v1`) || {}
    const map = {}
    for (const id of targetIds) {
      map[id] = !!store[id]
    }
    return map
  }

  if (name === 'favorite-toggle') {
    const type = String((data && data.type) || 'article')
    const targetId = String((data && data.targetId) || '')
    if (!targetId) throw new Error('缺少目标ID')
    const storeKey = `local_favorite_${type}_v1`
    const store = wx.getStorageSync(storeKey) || {}
    const next = !store[targetId]
    if (next) store[targetId] = 1
    else delete store[targetId]
    wx.setStorageSync(storeKey, store)
    return { collected: next }
  }

  if (name === 'favorite-list') {
    const type = String((data && data.type) || 'article')
    const store = wx.getStorageSync(`local_favorite_${type}_v1`) || {}
    const ids = Object.keys(store)
    const map = wx.getStorageSync('article_cache_map') || {}
    const list = ids
      .map((id) => map[id] || { targetId: id, title: id, link: '' })
      .map((it) => ({
        _id: it._id || it.targetId || it.id || '',
        type,
        targetId: it._id || it.targetId || it.id || '',
        title: it.title || '',
        link: it.link || '',
        coverUrl: it.coverUrl || ''
      }))
    return { list, page: 0, size: list.length }
  }

  throw new Error('不支持的本地调用')
}

function callCloudFunction(name, data = {}) {
  const forceCloud = !!(data && data.__forceCloud)
  const tryLocalFirst = !forceCloud && isLocalOnlyActive()
  if (tryLocalFirst) {
    return localInvoke(name, data).catch(() => callCloudFunction(name, { ...data, __forceCloud: true }))
  }

  return new Promise((resolve, reject) => {
    try {
      ensureCloudReady()
    } catch (e) {
      reject(e)
      return
    }

    const actualData = data && data.__forceCloud ? { ...data } : data
    if (actualData && actualData.__forceCloud) delete actualData.__forceCloud

    wx.cloud.callFunction({
      name: name,
      data: actualData,
      success: (res) => {
        const result = res && res.result
        if (result && result.success === true) {
          if (result && Object.prototype.hasOwnProperty.call(result, 'data')) {
            resolve(result.data)
          } else {
            resolve(result)
          }
          return
        }
        const message =
          (result && (result.message || result.errMsg)) ||
          (result ? JSON.stringify(result) : '') ||
          '云函数返回异常'
        showCloudHelpOnce(message)
        reject(new Error(`[${name}] ${message}`))
      },
      fail: (err) => {
        const msg = (err && (err.errMsg || err.message)) ? (err.errMsg || err.message) : String(err || '')
        if (shouldFallbackToHttp(msg)) {
          markLocalOnly(msg)
          console.warn(`Cloud function ${name} failed, fallback to http/local:`, err)
          localInvoke(name, actualData)
            .then(resolve)
            .catch(() => {
              showCloudHelpOnce(msg)
              reject(new Error(`[${name}] ${msg || '云函数调用失败'}`))
            })
          return
        }
        console.error(`Cloud function ${name} failed:`, err)
        showCloudHelpOnce(msg)
        reject(new Error(`[${name}] ${msg || '云函数调用失败'}`))
      }
    })
  })
}

/**
 * 格式化日期
 */
function formatDate(date) {
  if (!date) return ''
  const raw = (date && typeof date === 'object' && ('$date' in date)) ? date.$date : date
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 格式化时间
 */
function formatTime(date) {
  if (!date) return ''
  const raw = (date && typeof date === 'object' && ('$date' in date)) ? date.$date : date
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${hour}:${minute}`
}

module.exports = {
  callCloudFunction,
  formatDate,
  formatTime,
  getCloudEnvId,
  setCloudEnvId
}

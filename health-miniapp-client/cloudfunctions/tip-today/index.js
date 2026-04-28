const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const CACHE_TTL_MS = 10 * 60 * 1000

async function getCache(docId) {
  try {
    const res = await db.collection('runtime_cache').doc(docId).get()
    const doc = res && res.data
    if (!doc || !doc.data || !doc.updatedAtMs) return null
    if (Date.now() - doc.updatedAtMs > CACHE_TTL_MS) return null
    return doc.data
  } catch (e) {
    return null
  }
}

exports.main = async (event, context) => {
  const dayIndex = Math.floor(Date.now() / 86400000)
  const pools = ['article_list_v2', 'news_latest_v2']
  for (const id of pools) {
    const list = await getCache(id)
    if (Array.isArray(list) && list.length) {
      const item = list[dayIndex % list.length]
      if (item && item.title) {
        return {
          success: true,
          data: {
            title: item.title,
            content: item.summary || item.content || ''
          }
        }
      }
    }
  }
  return { success: true, data: null }
}

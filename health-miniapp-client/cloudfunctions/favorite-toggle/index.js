const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

function makeDocId(userId, type, targetId) {
  const raw = `${userId}|${type}|${targetId}`
  return (
    'fav_' +
    Buffer.from(raw, 'utf8')
      .toString('base64')
      .replace(/=+$/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
  )
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const userId = wxContext.OPENID

  const { type = 'article', targetId, title = '', link = '', coverUrl = '' } = event || {}
  if (!userId) return { success: false, message: '未登录' }
  if (!targetId) return { success: false, message: '缺少目标ID' }

  const _id = makeDocId(userId, type, targetId)
  try {
    const existing = await db.collection('favorite').doc(_id).get()
    if (existing && existing.data) {
      await db.collection('favorite').doc(_id).remove()
      return { success: true, data: { collected: false } }
    }
  } catch (e) {}

  const data = {
    _id,
    userId,
    type,
    targetId,
    title,
    link,
    coverUrl,
    createdAt: db.serverDate()
  }

  await db.collection('favorite').doc(_id).set({ data })
  return { success: true, data: { collected: true } }
}


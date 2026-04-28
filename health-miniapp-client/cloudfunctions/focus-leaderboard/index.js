const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function clamp(n, a, b) {
  const x = Number(n)
  if (!Number.isFinite(x)) return a
  return Math.max(a, Math.min(b, x))
}

function pickNickname(nickname, openid) {
  const n = String(nickname || '').trim()
  if (n) return n.slice(0, 30)
  const o = String(openid || '')
  if (o.length >= 6) return `用户${o.slice(-6)}`
  return '用户'
}

exports.main = async (event, context) => {
  const size = event && event.size != null ? clamp(event.size, 3, 10) : null
  const limit = clamp(event && event.limit, 1, 50)

  try {
    const where = {}
    if (size) where.size = size

    const res = await db
      .collection('focus_score')
      .where(where)
      .orderBy('score', 'desc')
      .orderBy('elapsedMs', 'asc')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    const list = (res && res.data) || []
    const out = list.map((it) => ({
      _id: it._id,
      nickname: pickNickname(it.nickname, it.openid),
      size: it.size,
      elapsedMs: it.elapsedMs,
      score: it.score,
      difficulty: it.difficulty,
      playMode: it.playMode,
      orderMode: it.orderMode,
      createdAt: it.createdAt
    }))

    return { success: true, data: { list: out } }
  } catch (e) {
    return { success: false, message: '查询失败' }
  }
}

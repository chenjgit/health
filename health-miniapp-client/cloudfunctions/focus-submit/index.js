const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function clamp(n, a, b) {
  const x = Number(n)
  if (!Number.isFinite(x)) return a
  return Math.max(a, Math.min(b, x))
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return { success: false, message: '缺少用户标识' }

  const size = clamp(event && event.size, 3, 10)
  const elapsedMs = clamp(event && event.elapsedMs, 1, 60 * 60 * 1000)
  const score = clamp(event && event.score, 0, 100)
  const difficulty = String((event && event.difficulty) || '普通').slice(0, 20)
  const playMode = String((event && event.playMode) || '练习').slice(0, 20)
  const orderMode = String((event && event.orderMode) || '顺序').slice(0, 20)
  const ageGroupKey = String((event && event.ageGroupKey) || '').slice(0, 20)
  const nickname = String((event && event.nickname) || '').slice(0, 30)

  try {
    const doc = {
      openid,
      size,
      elapsedMs,
      score,
      difficulty,
      playMode,
      orderMode,
      ageGroupKey,
      nickname,
      createdAt: db.serverDate()
    }
    const res = await db.collection('focus_score').add({ data: doc })
    return { success: true, data: { _id: res && res._id } }
  } catch (e) {
    return { success: false, message: '提交失败' }
  }
}


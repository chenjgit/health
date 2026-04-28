const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const userId = wxContext.OPENID

  const { type = 'article', targetIds = [] } = event || {}
  if (!userId) return { success: false, message: '未登录' }
  if (!Array.isArray(targetIds) || targetIds.length === 0) return { success: true, data: {} }

  let res
  try {
    res = await db
      .collection('favorite')
      .where({
        userId,
        type,
        targetId: _.in(targetIds)
      })
      .get()
  } catch (e) {
    res = { data: [] }
  }

  const map = {}
  for (const it of res.data || []) {
    map[it.targetId] = true
  }
  return { success: true, data: map }
}

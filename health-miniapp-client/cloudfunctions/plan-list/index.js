const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const ownerId = wxContext.OPENID
  if (!ownerId) return { success: false, message: '未登录' }

  let recommendedRes
  let mineRes
  try {
    recommendedRes = await db
      .collection('health_plan')
      .where({ isRecommended: true })
      .orderBy('updatedAt', 'desc')
      .limit(50)
      .get()
  } catch (e) {
    recommendedRes = { data: [] }
  }

  try {
    mineRes = await db
      .collection('health_plan')
      .where({ ownerId })
      .orderBy('updatedAt', 'desc')
      .limit(50)
      .get()
  } catch (e) {
    mineRes = { data: [] }
  }

  const mine = mineRes.data || []
  const recommended = (recommendedRes.data || []).filter((p) => p && p.ownerId !== ownerId)

  return {
    success: true,
    data: {
      recommended,
      mine
    }
  }
}

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const ownerId = wxContext.OPENID
  if (!ownerId) return { success: false, message: '未登录' }

  const { id } = event || {}
  if (!id) return { success: false, message: '缺少计划ID' }

  const doc = await db.collection('health_plan').doc(id).get()
  if (!doc.data) return { success: false, message: '计划不存在' }
  if (doc.data.ownerId !== ownerId) return { success: false, message: '无权限' }

  await db.collection('health_plan').doc(id).remove()
  return { success: true, data: { removed: true } }
}


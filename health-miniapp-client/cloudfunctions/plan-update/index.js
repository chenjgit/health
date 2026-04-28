const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const ownerId = wxContext.OPENID
  if (!ownerId) return { success: false, message: '未登录' }

  const { id, name, summary, content, days, level, isRecommended } = event || {}
  if (!id) return { success: false, message: '缺少计划ID' }

  const doc = await db.collection('health_plan').doc(id).get()
  if (!doc.data) return { success: false, message: '计划不存在' }
  if (doc.data.ownerId !== ownerId) return { success: false, message: '无权限' }

  const patch = {
    updatedAt: db.serverDate()
  }
  if (name != null) patch.name = name
  if (summary != null) patch.summary = summary
  if (content != null) patch.content = content
  if (days !== undefined) patch.days = days == null ? null : Number(days)
  if (level != null) patch.level = level
  if (isRecommended !== undefined) patch.isRecommended = !!isRecommended

  await db.collection('health_plan').doc(id).update({ data: patch })
  return { success: true, data: { _id: id, ...doc.data, ...patch } }
}


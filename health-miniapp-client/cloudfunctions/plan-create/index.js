const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const ownerId = wxContext.OPENID
  if (!ownerId) return { success: false, message: '未登录' }

  const { name, summary = '', content = '', days = null, level = '' } = event || {}
  if (!name) return { success: false, message: '计划名称不能为空' }

  const data = {
    ownerId,
    name,
    summary,
    content,
    days: days == null ? null : Number(days),
    level,
    isRecommended: false,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  }

  const res = await db.collection('health_plan').add({ data })
  return { success: true, data: { _id: res._id, ...data } }
}


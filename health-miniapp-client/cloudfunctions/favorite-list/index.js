const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const userId = wxContext.OPENID

  const { type = 'article', page = 0, size = 20 } = event || {}
  if (!userId) return { success: false, message: '未登录' }

  let res
  try {
    res = await db
      .collection('favorite')
      .where({ userId, type })
      .orderBy('createdAt', 'desc')
      .skip(page * size)
      .limit(size)
      .get()
  } catch (e) {
    res = { data: [] }
  }

  return {
    success: true,
    data: {
      list: res.data || [],
      page,
      size
    }
  }
}

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  // 直接从云函数上下文获取 openid，无需传递 code
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const unionid = wxContext.UNIONID || ''
  
  if (!openid) {
    return { success: false, message: '无法获取用户标识' }
  }

  try {
    // 查询或创建用户
    let userQuery
    try {
      userQuery = await db.collection('user').where({ openId: openid }).get()
    } catch (e) {
      userQuery = { data: [] }
    }
    
    let user
    if (userQuery.data.length === 0) {
      // 新用户
      const newUser = {
        openId: openid,
        unionId: unionid,
        nickname: event.nickname || '微信用户',
        avatarUrl: event.avatarUrl || '',
        memberLevel: '普通',
        points: 0,
        lastLoginAt: db.serverDate(),
        createdAt: db.serverDate()
      }
      const addRes = await db.collection('user').add({ data: newUser })
      user = { _id: addRes._id, ...newUser }
    } else {
      // 老用户，更新登录时间
      user = userQuery.data[0]
      const patch = { lastLoginAt: db.serverDate() }
      if (event.nickname && (!user.nickname || user.nickname === '微信用户')) {
        patch.nickname = event.nickname
      }
      if (event.avatarUrl && !user.avatarUrl) {
        patch.avatarUrl = event.avatarUrl
      }
      await db.collection('user').doc(user._id).update({ data: patch })
      user = { ...user, ...patch }
    }
    
    return {
      success: true,
      data: {
        openid: openid,
        userId: user._id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        memberLevel: user.memberLevel,
        points: user.points
      }
    }
  } catch (err) {
    console.error('Login error:', err)
    return { success: false, message: '系统异常，请稍后重试' }
  }
}

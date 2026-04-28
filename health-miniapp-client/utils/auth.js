/**
 * 认证工具类
 */
const app = getApp()
const { callCloudFunction } = require('./cloud')

/**
 * 确保用户已登录
 * 云函数通过 getWXContext() 自动获取 openid，无需传递 code
 */
async function ensureLogin(profile = {}) {
  // 如果已有 openid，直接返回
  if (app.globalData.openid) {
    return app.globalData.openid
  }

  // 尝试从缓存读取
  const cached = wx.getStorageSync('openid')
  if (cached) {
    app.globalData.openid = cached
    app.globalData.userId = wx.getStorageSync('userId')
    app.globalData.userInfo = wx.getStorageSync('userInfo') || {}
    return cached
  }

  let result
  try {
    result = await callCloudFunction('auth-login', {
      nickname: profile.nickName || profile.nickname || '',
      avatarUrl: profile.avatarUrl || ''
    })
  } catch (e) {
    const openid = `local_${Date.now()}`
    app.globalData.openid = openid
    app.globalData.userId = openid
    app.globalData.userInfo = {
      nickName: profile.nickName || profile.nickname || '离线用户',
      avatarUrl: profile.avatarUrl || ''
    }
    wx.setStorageSync('openid', openid)
    wx.setStorageSync('userId', openid)
    wx.setStorageSync('userInfo', app.globalData.userInfo)
    return openid
  }

  // result 是 cloud.js 封装后的 data 层，即 { openid, userId, nickname, avatarUrl, ... }
  app.globalData.openid = result.openid
  app.globalData.userId = result.userId
  app.globalData.userInfo = {
    nickName: result.nickname,
    avatarUrl: result.avatarUrl
  }
  
  wx.setStorageSync('openid', result.openid)
  wx.setStorageSync('userId', result.userId)
  wx.setStorageSync('userInfo', app.globalData.userInfo)

  return result.openid
}

/**
 * 获取用户信息
 */
function getUserInfo() {
  return app.globalData.userInfo || {}
}

/**
 * 清除登录信息
 */
function clearLoginInfo() {
  app.globalData.openid = null
  app.globalData.userId = null
  app.globalData.userInfo = {}
  wx.removeStorageSync('openid')
  wx.removeStorageSync('userId')
  wx.removeStorageSync('userInfo')
}

module.exports = {
  ensureLogin,
  getUserInfo,
  clearLoginInfo
}

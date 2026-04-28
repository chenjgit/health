App({
  globalData: {
    openid: null,
    userId: null,
    userInfo: {}
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    }

    // 检查登录状态
    const openid = wx.getStorageSync('openid')
    if (openid) {
      this.globalData.openid = openid
      this.globalData.userId = wx.getStorageSync('userId')
      this.globalData.userInfo = wx.getStorageSync('userInfo') || {}
    }
  }
})

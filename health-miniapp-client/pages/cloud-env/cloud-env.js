const { getCloudEnvId, setCloudEnvId } = require('../../utils/cloud')

Page({
  data: {
    appId: 'wxfe95ffbe75dc31e9',
    currentEnvId: 'cloud1-d3gw8242lcf851198',
    envIdInput: ''
  },

  onLoad() {
    let appId = ''
    try {
      const info = wx.getAccountInfoSync && wx.getAccountInfoSync()
      appId = (info && info.miniProgram && info.miniProgram.appId) || ''
    } catch (e) {}

    const currentEnvId = getCloudEnvId()
    this.setData({
      appId,
      currentEnvId,
      envIdInput: currentEnvId
    })
  },

  onInput(e) {
    this.setData({ envIdInput: e.detail.value })
  },

  clearEnv() {
    this.setData({ envIdInput: '' })
  },

  saveEnv() {
    setCloudEnvId(this.data.envIdInput)
    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => {
      wx.reLaunch({ url: '/pages/index/index' })
    }, 300)
  }
})


Page({
  data: {
    url: '',
    title: ''
  },

  onLoad(options) {
    const url = decodeURIComponent(options.url || '')
    const title = decodeURIComponent(options.title || '健康资讯')
    this.setData({ url, title })
    wx.setNavigationBarTitle({ title })
  }
})

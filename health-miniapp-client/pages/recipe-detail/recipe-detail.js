const { callCloudFunction } = require("../../utils/cloud")

Page({
  data: {
    id: 1,
    loading: false,
    recipe: null
  },

  onLoad(options) {
    this.setData({ id: options.id })
    this.load()
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },

  async load() {
    if (!this.data.id) return
    this.setData({ loading: true })
    try {
      const recipe = await callCloudFunction('recipe-detail', { id: this.data.id })
      this.setData({ recipe })
      if (recipe && recipe._id) {
        const map = wx.getStorageSync('recipe_cache_map') || {}
        map[recipe._id] = recipe
        wx.setStorageSync('recipe_cache_map', map)
      }
    } catch (e) {
      const id = this.data.id
      const map = wx.getStorageSync('recipe_cache_map') || {}
      const cached = map[id]
      if (cached) {
        this.setData({ recipe: cached })
      } else {
        wx.showToast({ title: "加载失败", icon: "none" })
      }
    } finally {
      this.setData({ loading: false })
    }
  },

  onOpenLink() {
    const link = this.data.recipe && this.data.recipe.link
    if (!link) return
    wx.navigateTo({
      url: `/pages/news-webview/news-webview?url=${encodeURIComponent(link)}&title=${encodeURIComponent(this.data.recipe.name || '养生食谱')}`
    })
  },

  onCopyLink() {
    const link = this.data.recipe && this.data.recipe.link
    if (!link) return
    wx.setClipboardData({ data: link })
  }
})


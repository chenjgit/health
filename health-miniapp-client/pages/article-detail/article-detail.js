const { callCloudFunction } = require("../../utils/cloud")

function getStatsMap() {
  return wx.getStorageSync('article_stats_v1') || {}
}

function setStatsMap(map) {
  wx.setStorageSync('article_stats_v1', map || {})
}

function ensureStats(id) {
  const map = getStatsMap()
  const cur = map[id] || { views: 0, likes: 0, liked: false, comments: [] }
  if (!Array.isArray(cur.comments)) cur.comments = []
  map[id] = cur
  setStatsMap(map)
  return cur
}

function getFavoriteMap() {
  return wx.getStorageSync('favorite_article_v1') || {}
}

function setFavoriteMap(map) {
  wx.setStorageSync('favorite_article_v1', map || {})
}

Page({
  data: {
    id: null,
    loading: false,
    article: null,
    collected: false,
    views: 0,
    likes: 0,
    liked: false,
    comments: [],
    commentInput: ""
  },

  onLoad(options) {
    this.setData({ id: options.id })
    const stat = ensureStats(options.id)
    const nextViews = Number(stat.views || 0) + 1
    stat.views = nextViews
    const map = getStatsMap()
    map[options.id] = stat
    setStatsMap(map)

    const fav = getFavoriteMap()
    const collected = !!fav[options.id]
    this.setData({
      views: nextViews,
      likes: Number(stat.likes || 0),
      liked: !!stat.liked,
      comments: stat.comments || [],
      collected
    })
    this.load()
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },

  async load() {
    if (!this.data.id) return
    this.setData({ loading: true })
    try {
      const article = await callCloudFunction('article-detail', { id: this.data.id })
      this.setData({ article })
      if (article && article._id) {
        const map = wx.getStorageSync('article_cache_map') || {}
        map[article._id] = article
        wx.setStorageSync('article_cache_map', map)
      }
    } catch (e) {
      const id = this.data.id
      const a = wx.getStorageSync('article_cache_map') || {}
      const n = wx.getStorageSync('news_cache_map') || {}
      const cached = a[id] || n[id]
      if (cached) {
        this.setData({ article: cached })
      } else {
        wx.showToast({ title: "加载失败", icon: "none" })
      }
    } finally {
      this.setData({ loading: false })
    }

    try {
      const map = await callCloudFunction('favorite-check', { type: 'article', targetIds: [this.data.id] })
      this.setData({ collected: !!(map && map[this.data.id]) })
    } catch (e) {}
  },

  onOpenLink() {
    const link = this.data.article && this.data.article.link
    if (!link) return
    wx.navigateTo({
      url: `/pages/news-webview/news-webview?url=${encodeURIComponent(link)}&title=${encodeURIComponent(this.data.article.title || '健康资讯')}`
    })
  },

  onCopyLink() {
    const link = this.data.article && this.data.article.link
    if (!link) return
    wx.setClipboardData({ data: link })
  },

  async onToggleFavorite() {
    try {
      const article = this.data.article || {}
      const res = await callCloudFunction('favorite-toggle', {
        type: 'article',
        targetId: this.data.id,
        title: article.title || '',
        link: article.link || '',
        coverUrl: article.coverUrl || ''
      })
      this.setData({ collected: !!(res && res.collected) })
    } catch (e) {
      const fav = getFavoriteMap()
      const next = !fav[this.data.id]
      if (next) fav[this.data.id] = 1
      else delete fav[this.data.id]
      setFavoriteMap(fav)
      this.setData({ collected: next })
    }
  },

  onToggleLike() {
    const id = this.data.id
    const map = getStatsMap()
    const cur = ensureStats(id)
    const nextLiked = !cur.liked
    cur.liked = nextLiked
    cur.likes = Math.max(0, Number(cur.likes || 0) + (nextLiked ? 1 : -1))
    map[id] = cur
    setStatsMap(map)
    this.setData({ liked: nextLiked, likes: cur.likes })
  },

  onCommentInput(e) {
    this.setData({ commentInput: e.detail.value })
  },

  onSubmitComment() {
    const content = String(this.data.commentInput || '').trim()
    if (!content) return
    const id = this.data.id
    const map = getStatsMap()
    const cur = ensureStats(id)
    const item = {
      id: `c_${Date.now()}`,
      content,
      createdAt: new Date().toLocaleString()
    }
    cur.comments = [item].concat(cur.comments || [])
    map[id] = cur
    setStatsMap(map)
    this.setData({ comments: cur.comments, commentInput: "" })
  }
})


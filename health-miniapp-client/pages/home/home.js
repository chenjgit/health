const { callCloudFunction, formatDate } = require("../../utils/cloud")
const { ensureLogin } = require("../../utils/auth")
const { ENABLE_LOCAL_FALLBACK } = require("../../utils/config")

Page({
  data: {
    q: "",
    loading: false,
    loadingMore: false,
    page: 0,
    size: 10,
    hasMore: true,
    articles: [],
    sortOptions: ["最新", "最热", "榜单"],
    sortIndex: 0,
    platformOptions: ["全部", "知乎日报", "少数派", "虎嗅", "36氪", "掘金"],
    platformIndex: 0,
    fromDate: "",
    toDate: "",
    tips: [],
    news: []
  },

  async onLoad() {
    const cachedNews = wx.getStorageSync('news_cache_list') || []
    const cachedArticles = wx.getStorageSync('article_cache_list') || []
    const cachedTips = wx.getStorageSync('tip_cache_list') || []
    if (cachedNews.length || cachedArticles.length || cachedTips.length) {
      this.setData({
        news: cachedNews,
        articles: cachedArticles,
        tips: cachedTips
      })
    }
    ensureLogin().catch(() => {})
    await Promise.all([this.loadNews(), this.loadTips(), this.loadArticles(true)])
  },

  onPullDownRefresh() {
    Promise.all([this.loadTips(), this.loadNews(), this.loadArticles(true)]).finally(() => wx.stopPullDownRefresh());
  },

  onInput(e) {
    this.setData({ q: e.detail.value });
  },

  async onSearch() {
    await this.loadArticles(true);
  },

  onSortChange(e) {
    this.setData({ sortIndex: Number(e.detail.value) || 0 })
    this.loadArticles(true)
  },

  onPlatformChange(e) {
    this.setData({ platformIndex: Number(e.detail.value) || 0 })
    this.loadArticles(true)
  },

  onFromDateChange(e) {
    this.setData({ fromDate: e.detail.value || "" })
    this.loadArticles(true)
  },

  onToDateChange(e) {
    this.setData({ toDate: e.detail.value || "" })
    this.loadArticles(true)
  },

  onReachBottom() {
    if (this.data.loadingMore || this.data.loading) return
    if (!this.data.hasMore) return
    this.loadArticles(false)
  },

  async loadArticles(reset) {
    if (reset) {
      this.setData({ page: 0, hasMore: true, articles: [] })
    }
    const pageNo = reset ? 0 : this.data.page
    const size = this.data.size
    this.setData(reset ? { loading: true } : { loadingMore: true })
    try {
      const sortKey = this.data.sortIndex === 1 ? "hot" : (this.data.sortIndex === 2 ? "rank" : "latest")
      const platform = this.data.platformOptions[this.data.platformIndex] || "全部"
      const pageRes = await callCloudFunction('article-list', {
        page: pageNo,
        size,
        q: this.data.q,
        sort: sortKey,
        platform,
        from: this.data.fromDate,
        to: this.data.toDate
      })
      const list = (pageRes && pageRes.list) || []
      const total = (pageRes && pageRes.total) || 0
      const hasMoreFromServer = pageRes && typeof pageRes.hasMore === 'boolean' ? pageRes.hasMore : null
      const normalized = (list || []).map((a) => ({
        ...a,
        createdAt: formatDate(a.createdAt)
      }))
      const stats = wx.getStorageSync('article_stats_v1') || {}
      for (const it of normalized) {
        const st = stats[it._id]
        it.viewCount = st ? Number(st.views || 0) : 0
      }
      const map = wx.getStorageSync('article_cache_map') || {}
      for (const it of normalized) map[it._id] = it
      wx.setStorageSync('article_cache_map', map)

      const merged = reset ? normalized : (this.data.articles || []).concat(normalized)
      const mergedWithViews = merged.map((it) => {
        const st = stats[it._id]
        return { ...it, viewCount: st ? Number(st.views || 0) : (it.viewCount || 0) }
      })
      const hasMore = hasMoreFromServer == null ? (merged.length < total) : hasMoreFromServer
      this.setData({
        articles: mergedWithViews,
        hasMore,
        page: pageNo + 1
      })
      wx.setStorageSync('article_cache_list', mergedWithViews.slice(0, 30))
    } catch (e) {
      if (!ENABLE_LOCAL_FALLBACK) {
        if (reset) this.setData({ hasMore: false })
        wx.showToast({ title: "加载失败", icon: "none" })
      }
    } finally {
      this.setData(reset ? { loading: false } : { loadingMore: false })
    }
  },

  async loadTips() {
    try {
      const tips = await callCloudFunction('tip-list', { limit: 6 })
      const list = (tips || []).map((t, idx) => ({ ...t, _id: t._id || `tip_${idx}` }))
      this.setData({ tips: list })
      wx.setStorageSync('tip_cache_list', list)
    } catch (e) {
      if (!ENABLE_LOCAL_FALLBACK) this.setData({ tips: [] })
    }
  },

  onTapTip(e) {
    const title = e.currentTarget.dataset.title
    const content = e.currentTarget.dataset.content
    const link = e.currentTarget.dataset.link
    if (link) {
      wx.navigateTo({
        url: `/pages/news-webview/news-webview?url=${encodeURIComponent(link)}&title=${encodeURIComponent(title || '每日养生知识')}`
      })
      return
    }
    wx.showModal({
      title: title || '每日养生知识',
      content: String(content || '').slice(0, 1200) || '暂无内容',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  async loadNews() {
    try {
      const news = await callCloudFunction('news-latest', { limit: 6 })
      const normalized = (news || []).map((n) => ({
        ...n,
        publishedAt: formatDate(n.publishedAt)
      }))
      const map = wx.getStorageSync('news_cache_map') || {}
      for (const it of normalized) map[it._id] = it
      wx.setStorageSync('news_cache_map', map)
      wx.setStorageSync('news_cache_list', normalized)
      this.setData({ news: normalized })
    } catch (e) {
      if (!ENABLE_LOCAL_FALLBACK) this.setData({ news: [] })
    }
  },

  onTapNews(e) {
    const id = e.currentTarget.dataset.id
    const link = e.currentTarget.dataset.link
    const title = e.currentTarget.dataset.title
    if (link) {
      wx.navigateTo({
        url: `/pages/news-webview/news-webview?url=${encodeURIComponent(link)}&title=${encodeURIComponent(title || '健康资讯')}`
      })
      return
    }
    wx.navigateTo({ url: `/pages/article-detail/article-detail?id=${id}` })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/article-detail/article-detail?id=${id}` });
  },

  goCheckin() {
    wx.switchTab({ url: "/pages/checkin/checkin" });
  },

  goRecipes() {
    wx.switchTab({ url: "/pages/recipes/recipes" });
  },

  goPlan() {
    wx.navigateTo({ url: "/pages/plan/plan" });
  },

  goFocus() {
    wx.navigateTo({ url: "/pages/focus/focus" })
  },

  goMemo() {
    wx.navigateTo({ url: "/pages/memo/memo" })
  }
});


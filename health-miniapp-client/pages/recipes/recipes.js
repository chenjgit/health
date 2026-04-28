const { callCloudFunction } = require("../../utils/cloud");
const { ENABLE_LOCAL_FALLBACK } = require("../../utils/config")

Page({
  data: {
    q: "",
    loading: false,
    loadingMore: false,
    page: 0,
    size: 10,
    hasMore: true,
    recipes: [],

    categories: ["全部", "养生茶饮", "日常正餐"],
    effects: ["全部", "安神助眠", "控制体重"],
    constitutions: ["全部", "通用", "偏寒", "气虚"],

    categoryIndex: 0,
    effectIndex: 0,
    constitutionIndex: 0
  },

  get categoryLabel() {
    return this.data.categories[this.data.categoryIndex] || "全部";
  },

  get effectLabel() {
    return this.data.effects[this.data.effectIndex] || "全部";
  },

  get constitutionLabel() {
    return this.data.constitutions[this.data.constitutionIndex] || "全部";
  },

  onLoad() {
    const cached = wx.getStorageSync('recipe_cache_list') || []
    if (cached.length) this.setData({ recipes: cached })
    this.loadRecipes(true);
  },

  onShow() {
    // 保持数据即可
  },

  onPullDownRefresh() {
    this.loadRecipes(true).finally(() => wx.stopPullDownRefresh());
  },

  onInput(e) {
    this.setData({ q: e.detail.value });
  },

  onCategoryChange(e) {
    const index = Number(e.detail.value);
    this.setData({ categoryIndex: index });
    this.loadRecipes(true);
  },

  onEffectChange(e) {
    const index = Number(e.detail.value);
    this.setData({ effectIndex: index });
    this.loadRecipes(true);
  },

  onConstitutionChange(e) {
    const index = Number(e.detail.value);
    this.setData({ constitutionIndex: index });
    this.loadRecipes(true);
  },

  async onSearch() {
    await this.loadRecipes(true);
  },

  onReachBottom() {
    if (this.data.loading || this.data.loadingMore) return
    if (!this.data.hasMore) return
    this.loadRecipes(false)
  },

  async loadRecipes(reset) {
    if (reset) {
      this.setData({ page: 0, hasMore: true, recipes: [] })
    }
    const pageNo = reset ? 0 : this.data.page
    const size = this.data.size
    this.setData(reset ? { loading: true } : { loadingMore: true })
    try {
      const params = {};
      if (this.data.q) {
        params.q = this.data.q;
      }
      params.page = pageNo
      params.size = size
      const category = this.data.categories[this.data.categoryIndex];
      if (category && category !== "全部") {
        params.category = category;
      }
      const effect = this.data.effects[this.data.effectIndex];
      if (effect && effect !== "全部") {
        params.effect = effect;
      }
      const constitution = this.data.constitutions[this.data.constitutionIndex];
      if (constitution && constitution !== "全部") {
        params.constitution = constitution;
      }

      const result = await callCloudFunction('recipe-list', params);
      const list = (result && result.list) || []
      const hasMore = !!(result && result.hasMore)
      const map = wx.getStorageSync('recipe_cache_map') || {}
      for (const it of list) map[it._id] = it
      wx.setStorageSync('recipe_cache_map', map)

      const merged = reset ? list : (this.data.recipes || []).concat(list)
      this.setData({
        recipes: merged,
        hasMore,
        page: pageNo + 1
      })
      wx.setStorageSync('recipe_cache_list', merged.slice(0, 30))
    } catch (e) {
      if (!ENABLE_LOCAL_FALLBACK) {
        if (reset) this.setData({ hasMore: false })
        wx.showToast({ title: "加载失败", icon: "none" });
      }
    } finally {
      this.setData(reset ? { loading: false } : { loadingMore: false })
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/recipe-detail/recipe-detail?id=${id}` });
  }
});


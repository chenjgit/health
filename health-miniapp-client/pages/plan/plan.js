const { callCloudFunction } = require("../../utils/cloud")
const { ensureLogin } = require("../../utils/auth")
const { ENABLE_LOCAL_FALLBACK } = require("../../utils/config")

const DEFAULT_TEMPLATES = [
  {
    _id: 'template_sleep_7',
    name: '7天睡眠改善计划',
    summary: '调整作息，改善入睡困难与睡眠质量',
    days: 7,
    level: '入门',
    isRecommended: true,
    content: '第1天：记录入睡与起床时间，不晚于23:30\n第2天：睡前1小时远离屏幕，喝杯温牛奶\n第3天：固定起床时间（含周末），午睡≤30分钟\n第4天：睡前做10分钟腹式呼吸\n第5天：卧室遮光降温（18-22°C最佳）\n第6天：白天户外活动30分钟以上\n第7天：回顾睡眠日志，评估改善效果\n\n长期建议：保持规律作息，避免睡前咖啡因与酒精。',
    createdAt: Date.now()
  },
  {
    _id: 'template_water_21',
    name: '21天饮水习惯养成',
    summary: '科学饮水计划，改善代谢与皮肤状态',
    days: 21,
    level: '入门',
    isRecommended: true,
    content: '第1-3天：每天饮水量达到1500ml\n第4-7天：每天饮水量提升至1800ml\n第8-14天：每天2000ml（晨起空腹300ml）\n第15-21天：巩固习惯，加入柠檬/蜂蜜水\n\n提示：用手机设置整点提醒，每次喝200ml左右。',
    createdAt: Date.now()
  },
  {
    _id: 'template_exercise_30',
    name: '30天综合健康提升',
    summary: '运动+饮食+作息全面改善计划',
    days: 30,
    level: '进阶',
    isRecommended: true,
    content: '第1-7天（适应期）：每天步行6000步+早睡30分钟\n第8-14天（提升期）：每天快走30分钟+深蹲3组×15次\n第15-21天（强化期）：慢跑20分钟+平板支撑1分钟×3组\n第22-30天（巩固期）：HIIT 15分钟+拉伸10分钟\n\n饮食建议：每餐先吃蔬菜，减少精制碳水，蛋白质摄入每公斤体重1.2g。',
    createdAt: Date.now()
  },
  {
    _id: 'template_meditation_14',
    name: '14天正念冥想计划',
    summary: '缓解焦虑与压力，提升专注力与情绪管理',
    days: 14,
    level: '入门',
    isRecommended: true,
    content: '第1-2天：每天5分钟专注呼吸\n第3-5天：每天8分钟身体扫描\n第6-8天：每天10分钟正念步行\n第9-11天：每天12分钟情绪觉察\n第12-14天：每天15分钟正念冥想\n\n建议：选择安静环境，固定时间段练习，使用引导音频辅助。',
    createdAt: Date.now()
  }
]

function ensureTemplates() {
  const key = 'plan_templates_loaded_v1'
  if (wx.getStorageSync(key)) return
  const existing = wx.getStorageSync('local_plan_v1') || []
  if (!Array.isArray(existing)) return
  const merged = [...DEFAULT_TEMPLATES, ...existing]
  wx.setStorageSync('local_plan_v1', merged)
  wx.setStorageSync(key, true)
}

Page({
  data: {
    loading: false,
    recommended: [],
    mine: [],
    currentPlan: null,
    editing: false,
    saving: false,
    editForm: {
      _id: "",
      name: "",
      days: "",
      level: "",
      summary: "",
      content: ""
    },
    reminders: []
  },

  async onLoad() {
    ensureTemplates()
    const reminders = wx.getStorageSync('plan_reminders_v1') || []
    this.setData({ reminders })
    await this.loadPlans();
  },

  onPullDownRefresh() {
    this.loadPlans().finally(() => wx.stopPullDownRefresh());
  },

  async loadPlans() {
    this.setData({ loading: true });
    try {
      await ensureLogin();
      const result = await callCloudFunction('plan-list');
      const recommended = (result && result.recommended) || []
      const mine = (result && result.mine) || []
      const currentPlan = recommended[0] || mine[0] || null
      this.setData({
        recommended,
        mine,
        currentPlan
      });
    } catch (e) {
      if (!ENABLE_LOCAL_FALLBACK) {
        this.setData({ recommended: [], mine: [], currentPlan: null })
        wx.showToast({ title: "加载失败", icon: "none" })
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    const plan = (this.data.recommended || []).concat(this.data.mine || []).find(p => p._id === id || p.id === id);
    if (plan) {
      this.setData({ currentPlan: plan });
    }
  },

  openCreate() {
    this.setData({
      editing: true,
      editForm: { _id: "", name: "", days: "", level: "", summary: "", content: "" }
    })
  },

  openEdit(e) {
    const id = e.currentTarget.dataset.id
    const plan = (this.data.recommended || []).concat(this.data.mine || []).find(p => p._id === id)
    if (!plan) return
    this.setData({
      editing: true,
      editForm: {
        _id: plan._id,
        name: plan.name || "",
        days: plan.days == null ? "" : String(plan.days),
        level: plan.level || "",
        summary: plan.summary || "",
        content: plan.content || ""
      }
    })
  },

  cancelEdit() {
    this.setData({ editing: false })
  },

  onName(e) {
    this.setData({ "editForm.name": e.detail.value })
  },
  onDays(e) {
    this.setData({ "editForm.days": e.detail.value })
  },
  onLevel(e) {
    this.setData({ "editForm.level": e.detail.value })
  },
  onSummary(e) {
    this.setData({ "editForm.summary": e.detail.value })
  },
  onContent(e) {
    this.setData({ "editForm.content": e.detail.value })
  },

  async savePlan() {
    const f = this.data.editForm || {}
    if (!f.name) {
      wx.showToast({ title: "请输入计划名称", icon: "none" })
      return
    }
    this.setData({ saving: true })
    try {
      if (f._id) {
        await callCloudFunction('plan-update', {
          id: f._id,
          name: f.name,
          days: f.days ? Number(f.days) : null,
          level: f.level,
          summary: f.summary,
          content: f.content
        })
      } else {
        await callCloudFunction('plan-create', {
          name: f.name,
          days: f.days ? Number(f.days) : null,
          level: f.level,
          summary: f.summary,
          content: f.content
        })
      }
      this.setData({ editing: false })
      await this.loadPlans()
      wx.showToast({ title: "已保存", icon: "success" })
    } catch (e) {
      wx.showToast({ title: "保存失败", icon: "none" })
    } finally {
      this.setData({ saving: false })
    }
  },

  async deletePlan(e) {
    const id = e.currentTarget.dataset.id
    const res = await new Promise((resolve) => {
      wx.showModal({
        title: '删除计划',
        content: '确定删除该计划吗？',
        confirmText: '删除',
        cancelText: '取消',
        success: resolve,
        fail: () => resolve({ confirm: false })
      })
    })
    if (!res || !res.confirm) return
    try {
      await callCloudFunction('plan-delete', { id })
      await this.loadPlans()
      wx.showToast({ title: "已删除", icon: "success" })
    } catch (e) {
      wx.showToast({ title: "删除失败", icon: "none" })
    }
  },

  async toggleRecommend(e) {
    const id = e.currentTarget.dataset.id
    try {
      await callCloudFunction('plan-recommend-toggle', { id })
      await this.loadPlans()
    } catch (e) {
      wx.showToast({ title: "操作失败", icon: "none" })
    }
  },

  async subscribeReminder() {
    try {
      const res = await wx.requestSubscribeMessage({
        tmplIds: []
      })
      console.log('subscribe result:', res)
    } catch (e) {
      console.log('subscribe not supported')
    }
  },

  async setReminder(e) {
    const id = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id
    const plan = (this.data.recommended || []).concat(this.data.mine || []).find(p => p._id === id)
    if (!plan) return

    const picker = await new Promise((resolve) => {
      wx.showModal({
        title: '设置每日提醒',
        content: `开启后将在每日 08:00 提醒您执行计划「${plan.name}」。\n提醒时间可在列表中修改。`,
        confirmText: '开启提醒',
        cancelText: '取消',
        success: resolve,
        fail: () => resolve({ confirm: false })
      })
    })
    if (!picker || !picker.confirm) return

    const reminder = { planId: id, planName: plan.name, time: '08:00', days: plan.days || 0, enabled: true, createdAt: Date.now() }
    const reminders = wx.getStorageSync('plan_reminders_v1') || []
    const existing = reminders.findIndex(r => r.planId === id)
    if (existing >= 0) {
      reminders[existing] = reminder
    } else {
      reminders.push(reminder)
    }
    wx.setStorageSync('plan_reminders_v1', reminders)
    this.setData({ reminders })

    this.subscribeReminder()
    wx.showToast({ title: `已设置每日 08:00 提醒`, icon: 'success' })
  },

  onReminderTimeChange(e) {
    const id = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id
    const time = String(e.detail && e.detail.value || '08:00')
    if (!id) return
    const reminders = wx.getStorageSync('plan_reminders_v1') || []
    const idx = reminders.findIndex(r => r.planId === id)
    if (idx >= 0) {
      reminders[idx].time = time
      wx.setStorageSync('plan_reminders_v1', reminders)
      this.setData({ reminders })
      wx.showToast({ title: `提醒时间已改为 ${time}`, icon: 'success' })
    }
  },

  removeReminder(e) {
    const id = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id
    if (!id) return
    const reminders = (wx.getStorageSync('plan_reminders_v1') || []).filter(r => r.planId !== id)
    wx.setStorageSync('plan_reminders_v1', reminders)
    this.setData({ reminders })
    wx.showToast({ title: '已取消提醒', icon: 'none' })
  }
});

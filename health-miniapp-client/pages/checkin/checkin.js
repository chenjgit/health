const { callCloudFunction } = require("../../utils/cloud")
const { ensureLogin } = require("../../utils/auth")

Page({
  data: {
    moods: ["开心", "平静", "一般", "疲惫", "焦虑"],
    weekDays: ["一", "二", "三", "四", "五", "六", "日"],
    moodIndex: 0,
    loading: false,
    saving: false,
    streakDays: 0,
    totalDays: 0,
    todayChecked: false,
    history: [],
    calendarMonth: "",
    calendarDays: [],
    lastSavedAt: "",
    _fullHistory: [],
    form: {
      waterMl: "",
      steps: "",
      sleepHours: "",
      mood: "",
      note: ""
    }
  },

  async onLoad() {
    await this.init();
  },

  onPullDownRefresh() {
    this.init().finally(() => wx.stopPullDownRefresh());
  },

  // 计算连续签到天数
  calcStreakDays(history) {
    if (!history.length) return 0
    let streak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // 检查今天是否签到
    const todayStr = this.formatDate(today)
    const todayRecord = history.find(h => h.dateStr === todayStr)
    if (!todayRecord) return 0
    
    streak = 1
    let checkDate = new Date(today)
    checkDate.setDate(checkDate.getDate() - 1)
    
    for (let i = 0; i < 365; i++) {
      const dateStr = this.formatDate(checkDate)
      if (history.find(h => h.dateStr === dateStr)) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }
    return streak
  },

  formatDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  },

  getLocalMap() {
    return wx.getStorageSync('local_checkin_map_v1') || {}
  },

  setLocalMap(map) {
    wx.setStorageSync('local_checkin_map_v1', map || {})
  },

  getLocalHistory(days) {
    const todayStr = this.formatDate(new Date())
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    from.setDate(from.getDate() - days)
    const fromStr = this.formatDate(from)
    const map = this.getLocalMap()
    const list = Object.keys(map)
      .filter((k) => k >= fromStr && k <= todayStr)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((k) => map[k])
    return list
  },

  getLocalToday() {
    const todayStr = this.formatDate(new Date())
    const map = this.getLocalMap()
    return map[todayStr] || null
  },

  buildCalendar(monthDate, checkedSet) {
    const y = monthDate.getFullYear()
    const m = monthDate.getMonth()
    const first = new Date(y, m, 1)
    const firstWeekday = (first.getDay() + 6) % 7
    const start = new Date(y, m, 1 - firstWeekday)
    const todayStr = this.formatDate(new Date())
    const days = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const dateStr = this.formatDate(d)
      days.push({
        dateStr,
        day: d.getDate(),
        isCurrentMonth: d.getMonth() === m,
        isToday: dateStr === todayStr,
        checked: checkedSet.has(dateStr)
      })
    }
    return days
  },

  updateCalendar(monthDate, history) {
    const checkedSet = new Set((history || []).map(h => h.dateStr).filter(Boolean))
    const calendarDays = this.buildCalendar(monthDate, checkedSet)
    const calendarMonth = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
    this.setData({ calendarMonth, calendarDays })
  },

  onPrevMonth() {
    const [y, m] = (this.data.calendarMonth || this.formatDate(new Date())).split('-')
    const base = new Date(Number(y), Number(m) - 1, 1)
    base.setMonth(base.getMonth() - 1)
    this.updateCalendar(base, this.data._fullHistory || [])
  },

  onNextMonth() {
    const [y, m] = (this.data.calendarMonth || this.formatDate(new Date())).split('-')
    const base = new Date(Number(y), Number(m) - 1, 1)
    base.setMonth(base.getMonth() + 1)
    this.updateCalendar(base, this.data._fullHistory || [])
  },

  async init() {
    this.setData({ loading: true });
    try {
      await ensureLogin().catch(() => {})

      let today = null
      let historyRaw = []
      try {
        today = await callCloudFunction('checkin-today')
        const historyResult = await callCloudFunction('checkin-history', { days: 180 })
        historyRaw = historyResult || []
      } catch (e) {
        today = this.getLocalToday()
        historyRaw = this.getLocalHistory(180)
      }
      
      // 格式化日期
      const formattedHistory = historyRaw.map(h => ({
        ...h,
        dateStr: h.dateStr || (h.date ? this.formatDate(new Date(h.date)) : '')
      }))
      const uniqueByDate = []
      const seen = new Set()
      for (const h of formattedHistory) {
        if (!h.dateStr || seen.has(h.dateStr)) continue
        seen.add(h.dateStr)
        uniqueByDate.push(h)
      }

      if (today) {
        const mood = today.mood || "";
        const moodIndex = Math.max(this.data.moods.indexOf(mood), 0);
        this.setData({
          moodIndex,
          todayChecked: true,
          lastSavedAt: today.updatedAtMs ? new Date(today.updatedAtMs).toLocaleString() : "",
          form: {
            waterMl: today.waterMl == null ? "" : String(today.waterMl),
            steps: today.steps == null ? "" : String(today.steps),
            sleepHours: today.sleepHours == null ? "" : String(today.sleepHours),
            mood,
            note: today.note || ""
          }
        });
      } else {
        this.setData({ todayChecked: false, lastSavedAt: "" })
      }

      this.setData({
        history: uniqueByDate.slice(0, 7),
        totalDays: uniqueByDate.length,
        streakDays: this.calcStreakDays(uniqueByDate),
        _fullHistory: uniqueByDate
      })
      this.updateCalendar(new Date(), uniqueByDate)
    } catch (e) {
      console.error('打卡加载失败', e)
    } finally {
      this.setData({ loading: false });
    }
  },

  onWater(e) {
    this.setData({ "form.waterMl": e.detail.value });
  },
  onSteps(e) {
    this.setData({ "form.steps": e.detail.value });
  },
  onSleep(e) {
    this.setData({ "form.sleepHours": e.detail.value });
  },
  onMood(e) {
    const idx = Number(e.detail.value);
    this.setData({ moodIndex: idx, "form.mood": this.data.moods[idx] });
  },
  onNote(e) {
    this.setData({ "form.note": e.detail.value });
  },

  async onSave() {
    this.setData({ saving: true })
    try {
      const form = this.data.form
      const payload = {
        waterMl: form.waterMl ? parseInt(form.waterMl) : null,
        steps: form.steps ? parseInt(form.steps) : null,
        sleepHours: form.sleepHours ? parseFloat(form.sleepHours) : null,
        mood: form.mood,
        note: form.note
      }
      try {
        await callCloudFunction('checkin-upsert', payload)
      } catch (e) {
        const todayStr = this.formatDate(new Date())
        const map = this.getLocalMap()
        map[todayStr] = {
          _id: `local_checkin_${todayStr}`,
          dateStr: todayStr,
          ...payload,
          updatedAtMs: Date.now()
        }
        this.setLocalMap(map)
      }
      this.setData({ lastSavedAt: new Date().toLocaleString() })
      wx.showToast({ title: "已保存", icon: "success" })
      this.init()
    } catch (e) {
      wx.showToast({ title: "保存失败", icon: "none" })
    } finally {
      this.setData({ saving: false })
    }
  }
});


function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatDateTime(ts) {
  const d = new Date(Number(ts) || Date.now())
  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const mm = pad2(d.getMinutes())
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function formatRemain(ms) {
  const t = Math.max(0, Number(ms) || 0)
  const sec = Math.floor(t / 1000)
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (d > 0) return `${d}天 ${pad2(h)}:${pad2(m)}:${pad2(s)}`
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`
}

function getStorage(key, fallback) {
  try {
    const v = wx.getStorageSync(key)
    return v == null || v === '' ? fallback : v
  } catch (e) {
    return fallback
  }
}

function setStorage(key, value) {
  try {
    wx.setStorageSync(key, value)
  } catch (e) {}
}

const KEY_MEMO = 'memo_items_v1'
const KEY_TIMER = 'countdown_items_v1'
const KEY_TIMER_HISTORY = 'countdown_history_v1'

Page({
  data: {
    tabIndex: 0,
    tabs: ['备忘录', '倒计时'],

    memoTitle: '',
    memoContent: '',
    memoList: [],

    timerTitle: '',
    timerTargetDate: '',
    timerTargetTime: '',
    timerList: [],
    timerHistory: []
  },

  onLoad() {
    this.refreshAll()
    this.startTicker()
  },

  onUnload() {
    this.stopTicker()
  },

  startTicker() {
    if (this._ticker) return
    this._ticker = setInterval(() => {
      if (this.data.tabIndex !== 1) return
      const now = Date.now()
      const next = (this.data.timerList || []).map((t) => ({
        ...t,
        remainMs: Math.max(0, Number(t.targetTs) - now),
        remainText: formatRemain(Math.max(0, Number(t.targetTs) - now))
      }))
      this.setData({ timerList: next })
    }, 1000)
  },

  stopTicker() {
    if (this._ticker) {
      clearInterval(this._ticker)
      this._ticker = null
    }
  },

  refreshAll() {
    const memoList = (getStorage(KEY_MEMO, []) || []).slice().sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    const now = Date.now()
    const timerList = (getStorage(KEY_TIMER, []) || [])
      .slice()
      .sort((a, b) => Number(a.targetTs || 0) - Number(b.targetTs || 0))
      .map((t) => ({
        ...t,
        remainMs: Math.max(0, Number(t.targetTs) - now),
        remainText: formatRemain(Math.max(0, Number(t.targetTs) - now))
      }))
    const timerHistory = (getStorage(KEY_TIMER_HISTORY, []) || []).slice().sort((a, b) => Number(b.doneAt || 0) - Number(a.doneAt || 0))
    this.setData({ memoList, timerList, timerHistory })
  },

  onTabChange(e) {
    this.setData({ tabIndex: Number(e.currentTarget.dataset.idx) || 0 })
  },

  onMemoTitle(e) {
    this.setData({ memoTitle: String(e.detail.value || '') })
  },

  onMemoContent(e) {
    this.setData({ memoContent: String(e.detail.value || '') })
  },

  addMemo() {
    const title = String(this.data.memoTitle || '').trim()
    const content = String(this.data.memoContent || '').trim()
    if (!title && !content) {
      wx.showToast({ title: '请输入内容', icon: 'none' })
      return
    }
    const list = getStorage(KEY_MEMO, []) || []
    const ts = Date.now()
    const item = {
      id: `memo_${ts}_${Math.floor(Math.random() * 100000)}`,
      title: title || '未命名',
      content,
      createdAt: ts,
      updatedAt: ts
    }
    list.unshift(item)
    setStorage(KEY_MEMO, list.slice(0, 300))
    this.setData({ memoTitle: '', memoContent: '' })
    this.refreshAll()
    wx.showToast({ title: '已添加', icon: 'success' })
  },

  deleteMemo(e) {
    const id = e.currentTarget.dataset.id
    const list = (getStorage(KEY_MEMO, []) || []).filter((x) => x && x.id !== id)
    setStorage(KEY_MEMO, list)
    this.refreshAll()
  },

  viewMemo(e) {
    const id = e.currentTarget.dataset.id
    const list = getStorage(KEY_MEMO, []) || []
    const item = (list || []).find((x) => x && x.id === id)
    if (!item) return
    wx.showModal({
      title: item.title || '备忘录',
      content: String(item.content || '').slice(0, 1200) || '暂无内容',
      showCancel: false
    })
  },

  onTimerTitle(e) {
    this.setData({ timerTitle: String(e.detail.value || '') })
  },

  onTimerDate(e) {
    this.setData({ timerTargetDate: e.detail.value || '' })
  },

  onTimerTime(e) {
    this.setData({ timerTargetTime: e.detail.value || '' })
  },

  addTimer() {
    const title = String(this.data.timerTitle || '').trim()
    const dateStr = String(this.data.timerTargetDate || '').trim()
    const timeStr = String(this.data.timerTargetTime || '').trim()
    if (!title) {
      wx.showToast({ title: '请输入标题', icon: 'none' })
      return
    }
    if (!dateStr || !timeStr) {
      wx.showToast({ title: '请选择日期和时间', icon: 'none' })
      return
    }
    const targetTs = Date.parse(`${dateStr}T${timeStr}:00+08:00`)
    if (!Number.isFinite(targetTs)) {
      wx.showToast({ title: '时间不合法', icon: 'none' })
      return
    }
    const ts = Date.now()
    const list = getStorage(KEY_TIMER, []) || []
    list.push({
      id: `timer_${ts}_${Math.floor(Math.random() * 100000)}`,
      title,
      targetTs,
      createdAt: ts
    })
    setStorage(KEY_TIMER, list.slice(0, 200))
    this.setData({ timerTitle: '', timerTargetDate: '', timerTargetTime: '' })
    this.refreshAll()
    wx.showToast({ title: '已添加', icon: 'success' })
  },

  finishTimer(e) {
    const id = e.currentTarget.dataset.id
    const list = getStorage(KEY_TIMER, []) || []
    const item = (list || []).find((x) => x && x.id === id)
    const next = (list || []).filter((x) => x && x.id !== id)
    setStorage(KEY_TIMER, next)
    if (item) {
      const history = getStorage(KEY_TIMER_HISTORY, []) || []
      history.unshift({
        ...item,
        doneAt: Date.now()
      })
      setStorage(KEY_TIMER_HISTORY, history.slice(0, 300))
    }
    this.refreshAll()
  },

  deleteTimer(e) {
    const id = e.currentTarget.dataset.id
    const list = (getStorage(KEY_TIMER, []) || []).filter((x) => x && x.id !== id)
    setStorage(KEY_TIMER, list)
    this.refreshAll()
  },

  clearTimerHistory() {
    setStorage(KEY_TIMER_HISTORY, [])
    this.refreshAll()
  },

  formatDateTime(ts) {
    return formatDateTime(ts)
  }
})


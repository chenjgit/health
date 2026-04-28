function shuffleArray(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}

const { callCloudFunction } = require("../../utils/cloud")

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatMs(ms) {
  const t = Math.max(0, Number(ms) || 0)
  const sec = Math.floor(t / 1000)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${pad2(m)}:${pad2(s)}`
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

function clamp(n, a, b) {
  const x = Number(n)
  if (!Number.isFinite(x)) return a
  return Math.max(a, Math.min(b, x))
}

function buildOrder(total, orderMode) {
  const nums = []
  for (let i = 1; i <= total; i++) nums.push(i)
  if (orderMode === 'reverse') return nums.reverse()
  if (orderMode === 'random') return shuffleArray(nums)
  return nums
}

function getAgeGroups() {
  return [
    { key: '7-12', label: '7-12岁' },
    { key: '13-17', label: '13-17岁' },
    { key: '18+', label: '18岁及以上' }
  ]
}

function getDifficultyFactor(difficultyKey) {
  if (difficultyKey === 'easy') return 1.25
  if (difficultyKey === 'hard') return 0.85
  return 1.0
}

function buildReferenceByTable(size, ageKey, difficultyFactor) {
  const sizeNum = Number(size)
  const df = Number(difficultyFactor) || 1.0
  if (sizeNum === 4) {
    const excellent = 16
    const avg = 26
    const bad = 50
    return {
      excellentMs: Math.round(excellent * 1000 * df),
      goodMs: Math.round(avg * 1000 * df),
      passMs: Math.round(avg * 1000 * df),
      display: {
        excellentText: `${excellent}秒内`,
        goodText: `${avg}秒（平均）`,
        passText: `${bad}秒（问题）`
      },
      source: 'toolshu'
    }
  }
  if (sizeNum === 5) {
    const map = {
      '7-12': { excellent: 26, avg: 42, bad: 50 },
      '13-17': { excellent: 16, avg: 26, bad: 36 },
      '18+': { excellent: 8, avg: 20, bad: null }
    }
    const row = map[String(ageKey)] || map['18+']
    const excellent = row.excellent
    const avg = row.avg
    const bad = row.bad
    return {
      excellentMs: Math.round(excellent * 1000 * df),
      goodMs: Math.round(avg * 1000 * df),
      passMs: Math.round(avg * 1000 * df),
      display: {
        excellentText: `${excellent}秒内`,
        goodText: `${avg}秒（平均）`,
        passText: bad == null ? '未提供' : `${bad}秒（问题）`
      },
      source: 'toolshu'
    }
  }
  return null
}

function scoreByTime(elapsedMs, ref, size) {
  const t = Math.max(0, Number(elapsedMs) || 0)
  const sizeNum = Number(size) || 5
  const total = Math.max(1, sizeNum * sizeNum)
  if (!ref || !ref.excellentMs || !ref.goodMs) {
    const sec = Math.max(0.1, t / 1000)
    const cps = total / sec
    const score = Math.round(clamp((cps / 2.8) * 100, 0, 100))
    return score
  }

  const excellent = Number(ref && ref.excellentMs) || 0
  const good = Number(ref && ref.goodMs) || 1
  if (t <= excellent) return 100
  if (t <= good) {
    const p = (t - excellent) / Math.max(1, good - excellent)
    return Math.round(100 - 25 * clamp(p, 0, 1))
  }
  const p2 = (t - good) / Math.max(1, good)
  return Math.round(Math.max(0, 75 - 75 * clamp(p2, 0, 1)))
}

function getPenaltyMsByDifficulty(difficultyKey) {
  if (difficultyKey === 'hard') return 1500
  if (difficultyKey === 'normal') return 700
  return 0
}

function getMaxMistakesByDifficulty(difficultyKey) {
  if (difficultyKey === 'hard') return 3
  if (difficultyKey === 'normal') return 5
  return 999
}

function getStageTimeLimitMs(size, difficultyKey) {
  const s = Number(size) || 5
  const total = Math.max(1, s * s)
  const perCellSec = difficultyKey === 'hard' ? 0.85 : (difficultyKey === 'easy' ? 1.35 : 1.05)
  return Math.round(total * perCellSec * 1000)
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

const STORAGE_PROFILE = 'focus_profile_v1'
const STORAGE_HISTORY = 'focus_history_v1'

Page({
  data: {
    activeTab: 'train',

    sizes: [3, 4, 5, 6, 7, 8, 9, 10],
    sizeIndex: 0,
    cells: [],
    orderModes: ['顺序', '倒序', '乱序闯关'],
    orderModeIndex: 0,
    difficultyLabels: ['简单', '普通', '困难'],
    difficultyIndex: 1,
    playModes: ['练习', '闯关'],
    playModeIndex: 0,

    order: [],
    progressIndex: 0,
    nextNumber: 1,

    startedAt: 0,
    elapsedMs: 0,
    elapsedText: '00:00',
    finished: false,
    cellSize: 120,
    fontSize: 32,

    extraPenaltyMs: 0,
    penaltyText: '',
    penaltySecondsText: '0.0',

    mistakeCount: 0,
    maxMistakes: 999,

    profileName: '',
    ageGroups: [],
    ageGroupIndex: 2,

    reference: null,
    refExcellentText: '',
    refGoodText: '',
    refPassText: '',
    score: 0,
    lastResult: null,

    history: [],
    historyCount: 0,
    leaderboardOverall: [],
    leaderboardBySize: [],
    leaderboardCurrent: [],
    cloudLeaderboardOverall: [],
    cloudLeaderboardCurrent: [],
    classicReferenceSections: [],

    challengeStages: [],
    stageIndex: 0,
    stageTargetText: '',
    stageResultText: '',
    stageTimeLimitMs: 0,
    stageTimeLimitText: '',
    remainingMs: 0,
    remainingText: '',

    prepared: null
  },

  onLoad() {
    const ageGroups = getAgeGroups()
    const profile = getStorage(STORAGE_PROFILE, null) || {}
    const profileName = String(profile.name || '').trim()
    const ageGroupIndex = clamp(profile.ageGroupIndex, 0, ageGroups.length - 1)
    const history = this.loadHistory()
    const classicReferenceSections = this.buildClassicReferenceSections()
    const boards = this.computeLeaderboards(history)
    const size = Number(this.data.sizes[this.data.sizeIndex]) || 3
    const currentBoard = boards.bySize.find((x) => x && x.size === size)
    this.setData({
      ageGroups,
      profileName,
      ageGroupIndex,
      history,
      historyCount: history.length,
      classicReferenceSections,
      leaderboardOverall: boards.overall,
      leaderboardBySize: boards.bySize,
      leaderboardCurrent: (currentBoard && currentBoard.list) || []
    })
    this.reset()
    this.loadCloudLeaderboards().catch(() => {})
  },

  async loadCloudLeaderboards() {
    try {
      const size = Number(this.data.sizes[this.data.sizeIndex]) || 5
      const overall = await callCloudFunction('focus-leaderboard', { limit: 20 })
      const current = await callCloudFunction('focus-leaderboard', { size, limit: 10 })
      const normalize = (list) =>
        (list || []).map((it) => ({
          ...it,
          timeText: formatMs(it && it.elapsedMs)
        }))
      this.setData({
        cloudLeaderboardOverall: normalize((overall && overall.list) || []),
        cloudLeaderboardCurrent: normalize((current && current.list) || [])
      })
    } catch (e) {
      this.setData({ cloudLeaderboardOverall: [], cloudLeaderboardCurrent: [] })
    }
  },

  onUnload() {
    this.stopTimer()
  },

  stopTimer() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  },

  startTimer() {
    if (this._timer) return
    this._timer = setInterval(() => {
      if (!this.data.startedAt) return
      const elapsedMs = Date.now() - this.data.startedAt + (Number(this.data.extraPenaltyMs) || 0)
      const stageTimeLimitMs = Number(this.data.stageTimeLimitMs) || 0
      if (stageTimeLimitMs > 0) {
        const remainingMs = Math.max(0, stageTimeLimitMs - elapsedMs)
        this.setData({
          elapsedMs,
          elapsedText: formatMs(elapsedMs),
          remainingMs,
          remainingText: formatMs(remainingMs)
        })
        if (remainingMs === 0 && !this.data.finished) {
          this.finishFailure('超时失败')
        }
        return
      }
      this.setData({ elapsedMs, elapsedText: formatMs(elapsedMs) })
    }, 200)
  },

  buildCells(size) {
    const total = size * size
    const nums = []
    for (let i = 1; i <= total; i++) nums.push(i)
    const shuffled = shuffleArray(nums)
    return shuffled.map((n) => ({ n, state: '' }))
  },

  applyLayout(size) {
    const maxWidth = 660
    const gap = 12
    const cellSize = Math.floor((maxWidth - gap * (size - 1)) / size)
    const fontSize = Math.max(22, Math.min(40, Math.floor(cellSize * 0.32)))
    this.setData({ cellSize, fontSize })
  },

  loadHistory() {
    const list = getStorage(STORAGE_HISTORY, []) || []
    const arr = Array.isArray(list) ? list : []
    return arr.sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0)).slice(0, 200)
  },

  saveHistory(list) {
    const arr = Array.isArray(list) ? list : []
    setStorage(STORAGE_HISTORY, arr.slice(0, 200))
    const boards = this.computeLeaderboards(arr)
    const size = Number(this.data.sizes[this.data.sizeIndex]) || 3
    const currentBoard = boards.bySize.find((x) => x && x.size === size)
    this.setData({
      history: arr.slice(0, 50),
      historyCount: arr.length,
      leaderboardOverall: boards.overall,
      leaderboardBySize: boards.bySize,
      leaderboardCurrent: (currentBoard && currentBoard.list) || []
    })
  },

  getOrderModeKey() {
    const i = Number(this.data.orderModeIndex) || 0
    if (i === 1) return 'reverse'
    if (i === 2) return 'random'
    return 'seq'
  },

  getDifficultyKey() {
    const i = Number(this.data.difficultyIndex) || 0
    if (i === 0) return 'easy'
    if (i === 2) return 'hard'
    return 'normal'
  },

  computeReference(size, difficultyKey) {
    const ageGroups = this.data.ageGroups || getAgeGroups()
    const ageGroup = ageGroups[this.data.ageGroupIndex] || ageGroups[ageGroups.length - 1]
    return buildReferenceByTable(size, String(ageGroup.key || '18+'), getDifficultyFactor(difficultyKey))
  },

  setReferenceToData(ref) {
    if (!ref) {
      this.setData({ reference: null, refExcellentText: '', refGoodText: '', refPassText: '' })
      return
    }
    const display = ref.display || null
    this.setData({
      reference: ref,
      refExcellentText: display && display.excellentText ? display.excellentText : formatMs(ref.excellentMs),
      refGoodText: display && display.goodText ? display.goodText : formatMs(ref.goodMs),
      refPassText: display && display.passText ? display.passText : formatMs(ref.passMs)
    })
  },

  buildClassicReferenceSections() {
    const ageGroups = getAgeGroups()
    const sizes = [4, 5]
    return sizes.map((size, idx) => {
      const rows = ageGroups.map((ag) => {
        const ref = buildReferenceByTable(size, ag.key, 1.0)
        const display = (ref && ref.display) || {}
        return {
          ageLabel: ag.label,
          excellent: display.excellentText || '',
          good: display.goodText || '',
          pass: display.passText || ''
        }
      })
      return {
        id: `ref_${size}`,
        size,
        title: `${size}x${size}`,
        tone: idx % 3,
        rows
      }
    })
  },

  computeLeaderboards(history) {
    const list = Array.isArray(history) ? history.slice() : []
    const normalized = list
      .map((it) => ({
        ...it,
        score: Number(it && it.score) || 0,
        elapsedMs: Number(it && it.elapsedMs) || 0,
        size: Number(it && it.size) || 0,
        playerName: String((it && it.playerName) || '') || '未绑定',
        result: String((it && it.result) || '完成')
      }))
      .filter((it) => it.result === '完成' && it.size > 0 && it.elapsedMs > 0)

    const sorter = (a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (a.elapsedMs !== b.elapsedMs) return a.elapsedMs - b.elapsedMs
      return Number(b.ts || 0) - Number(a.ts || 0)
    }

    const overall = normalized.slice().sort(sorter).slice(0, 20)
    const bySizeMap = {}
    for (const it of normalized) {
      const key = String(it.size)
      if (!bySizeMap[key]) bySizeMap[key] = []
      bySizeMap[key].push(it)
    }
    const bySize = Object.keys(bySizeMap)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
      .map((size) => ({
        size,
        title: `${size}x${size}`,
        list: bySizeMap[String(size)].sort(sorter).slice(0, 10)
      }))
    return { overall, bySize }
  },

  finishFailure(reason) {
    if (this.data.finished) return
    this.stopTimer()
    const elapsedMs = Number(this.data.elapsedMs) || (this.data.startedAt ? (Date.now() - this.data.startedAt + (Number(this.data.extraPenaltyMs) || 0)) : 0)
    const ts = Date.now()
    const size = this.data.sizes[this.data.sizeIndex]
    const modeLabel = (this.data.orderModes || [])[this.data.orderModeIndex] || '顺序'
    const diffLabel = (this.data.difficultyLabels || [])[this.data.difficultyIndex] || '普通'
    const playLabel = (this.data.playModes || [])[this.data.playModeIndex] || '练习'
    const playerName = String(this.data.profileName || '').trim()
    const record = {
      id: `focus_${ts}_${Math.floor(Math.random() * 100000)}`,
      ts,
      whenText: formatDateTime(ts),
      timeText: formatMs(elapsedMs),
      elapsedMs,
      size,
      playMode: playLabel,
      orderMode: modeLabel,
      difficulty: diffLabel,
      score: 0,
      playerName,
      result: '失败'
    }
    const history = this.loadHistory()
    history.unshift(record)
    this.saveHistory(history)
    this.setData({
      finished: true,
      stageResultText: reason || '失败',
      score: 0,
      lastResult: {
        ts,
        timeText: formatMs(elapsedMs),
        score: 0,
        size,
        playMode: playLabel,
        orderMode: modeLabel,
        difficulty: diffLabel,
        whenText: formatDateTime(ts)
      }
    })
  },

  buildPrepared(size, orderModeKey) {
    const cells = this.buildCells(size)
    const total = size * size
    const order = buildOrder(total, orderModeKey)
    return { cells, order }
  },

  resetRuntimeState(next) {
    this.stopTimer()
    this.setData({
      startedAt: 0,
      elapsedMs: 0,
      elapsedText: '00:00',
      finished: false,
      extraPenaltyMs: 0,
      penaltyText: '',
      penaltySecondsText: '0.0',
      mistakeCount: 0,
      progressIndex: 0,
      nextNumber: 1,
      score: 0,
      lastResult: null,
      stageResultText: '',
      stageTimeLimitMs: 0,
      stageTimeLimitText: '',
      remainingMs: 0,
      remainingText: '',
      ...(next || {})
    })
  },

  reset() {
    const size = this.data.sizes[this.data.sizeIndex]
    this.applyLayout(size)
    const orderModeKey = this.getOrderModeKey()
    const prepared = this.buildPrepared(size, orderModeKey)
    const ref = this.computeReference(size, this.getDifficultyKey())
    this.setReferenceToData(ref)
    this.resetRuntimeState({
      cells: prepared.cells,
      order: prepared.order,
      nextNumber: Number(prepared.order[0]) || 1,
      prepared: this.buildPrepared(size, orderModeKey)
    })
  },

  shuffle() {
    const size = this.data.sizes[this.data.sizeIndex]
    this.applyLayout(size)
    const orderModeKey = this.getOrderModeKey()
    const prepared = this.buildPrepared(size, orderModeKey)
    const ref = this.computeReference(size, this.getDifficultyKey())
    this.setReferenceToData(ref)
    this.resetRuntimeState({
      cells: prepared.cells,
      order: prepared.order,
      nextNumber: Number(prepared.order[0]) || 1,
      prepared: this.buildPrepared(size, orderModeKey)
    })
  },

  onSizeChange(e) {
    this.setData({ sizeIndex: Number(e.detail.value) || 0 })
    this.reset()
    this.loadCloudLeaderboards().catch(() => {})
  },

  onOrderModeChange(e) {
    this.setData({ orderModeIndex: Number(e.detail.value) || 0 })
    this.reset()
  },

  onDifficultyChange(e) {
    this.setData({ difficultyIndex: Number(e.detail.value) || 0 })
    this.reset()
  },

  onPlayModeChange(e) {
    const idx = Number(e.detail.value) || 0
    this.setData({ playModeIndex: idx, stageIndex: 0 })
    this.reset()
  },

  onSwitchTab(e) {
    const tab = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.tab : ''
    if (tab === 'train' || tab === 'history') {
      const history = this.loadHistory()
      this.setData({ activeTab: tab, history: history.slice(0, 50), historyCount: history.length })
      return
    }
    const next = this.data.activeTab === 'train' ? 'history' : 'train'
    const history = this.loadHistory()
    this.setData({ activeTab: next, history: history.slice(0, 50), historyCount: history.length })
  },

  onNameInput(e) {
    this.setData({ profileName: String(e.detail.value || '') })
  },

  onAgeGroupChange(e) {
    const idx = clamp(Number(e.detail.value) || 0, 0, (this.data.ageGroups || []).length - 1)
    this.setData({ ageGroupIndex: idx })
    setStorage(STORAGE_PROFILE, { name: String(this.data.profileName || '').trim(), ageGroupIndex: idx })
    this.reset()
  },

  onSaveProfile() {
    const name = String(this.data.profileName || '').trim()
    setStorage(STORAGE_PROFILE, { name, ageGroupIndex: this.data.ageGroupIndex })
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  buildChallengeStages() {
    const difficultyKey = this.getDifficultyKey()
    if (difficultyKey === 'easy') {
      const seq = [3, 3, 4, 4, 5, 5, 6, 6, 7]
      return seq.map((s, i) => ({ index: i, size: s, orderModeKey: 'seq' }))
    }
    if (difficultyKey === 'hard') {
      const seq = [3, 4, 5, 6, 7, 8, 9, 10]
      return seq.map((s, i) => ({ index: i, size: s, orderModeKey: i < 2 ? 'reverse' : 'random' }))
    }
    const seq = [3, 4, 5, 6, 7, 8, 9, 10]
    return seq.map((s, i) => ({
      index: i,
      size: s,
      orderModeKey: i < 2 ? 'seq' : (i < 5 ? 'reverse' : 'random')
    }))
  },

  startChallenge() {
    const stages = this.buildChallengeStages()
    this.setData({ challengeStages: stages, stageIndex: 0 })
    this.loadStage(0, stages)
  },

  loadStage(idx, stages) {
    const list = stages || this.data.challengeStages || []
    const stage = list[idx]
    if (!stage) return
    const sizeIndex = Math.max(0, (this.data.sizes || []).indexOf(stage.size))
    const difficultyKey = this.getDifficultyKey()
    const ref = this.computeReference(stage.size, difficultyKey)
    this.setReferenceToData(ref)
    const timeLimitMs = ref && ref.passMs ? Math.max(1, Number(ref.passMs) || 1) : getStageTimeLimitMs(stage.size, difficultyKey)
    const timeLimitText = `限时：${formatMs(timeLimitMs)}`
    const targetText = `目标：≤ ${this.data.refPassText || formatMs(timeLimitMs)}`
    const prepared = this.buildPrepared(stage.size, stage.orderModeKey)
    this.applyLayout(stage.size)
    this.resetRuntimeState({
      sizeIndex,
      orderModeIndex: stage.orderModeKey === 'reverse' ? 1 : (stage.orderModeKey === 'random' ? 2 : 0),
      cells: prepared.cells,
      order: prepared.order,
      nextNumber: Number(prepared.order[0]) || 1,
      stageTargetText: targetText,
      stageTimeLimitMs: timeLimitMs,
      stageTimeLimitText: timeLimitText,
      remainingMs: timeLimitMs,
      remainingText: formatMs(timeLimitMs),
      maxMistakes: getMaxMistakesByDifficulty(this.getDifficultyKey()),
      prepared: this.buildPrepared(stage.size, stage.orderModeKey)
    })
  },

  clearHistory() {
    setStorage(STORAGE_HISTORY, [])
    this.setData({
      history: [],
      historyCount: 0,
      leaderboardOverall: [],
      leaderboardBySize: [],
      leaderboardCurrent: []
    })
    wx.showToast({ title: '已清空', icon: 'success' })
  },

  nextRound() {
    const prepared = this.data.prepared
    const size = this.data.sizes[this.data.sizeIndex]
    const orderModeKey = this.getOrderModeKey()
    const ref = this.computeReference(size, this.getDifficultyKey())
    this.setReferenceToData(ref)
    if (prepared && prepared.cells && prepared.order) {
      this.applyLayout(size)
      this.resetRuntimeState({
        cells: prepared.cells,
        order: prepared.order,
        nextNumber: Number(prepared.order[0]) || 1,
        maxMistakes: this.data.playModeIndex === 1 ? getMaxMistakesByDifficulty(this.getDifficultyKey()) : 999,
        prepared: this.buildPrepared(size, orderModeKey)
      })
      return
    }
    this.shuffle()
  },

  onTapCell(e) {
    if (this.data.finished) return
    const n = Number(e.currentTarget.dataset.n)
    if (!n) return

    if (!this.data.startedAt) {
      this.setData({ startedAt: Date.now() })
      this.startTimer()
    }

    const order = Array.isArray(this.data.order) ? this.data.order : []
    const expect = Number(order[this.data.progressIndex]) || this.data.nextNumber
    const size = this.data.sizes[this.data.sizeIndex]
    const total = size * size

    const cells = (this.data.cells || []).map((c) => {
      if (c.n !== n) return c
      return { ...c, state: n === expect ? 'correct' : 'wrong' }
    })

    if (n !== expect) {
      const penalty = getPenaltyMsByDifficulty(this.getDifficultyKey())
      const extraPenaltyMs = (Number(this.data.extraPenaltyMs) || 0) + penalty
      const mistakeCount = (Number(this.data.mistakeCount) || 0) + 1
      this.setData({ cells })
      if (penalty) {
        this.setData({
          extraPenaltyMs,
          penaltySecondsText: (extraPenaltyMs / 1000).toFixed(1),
          penaltyText: `失误 +${Math.round(penalty / 100) / 10}s`
        })
        setTimeout(() => this.setData({ penaltyText: '' }), 600)
      }
      if (this.data.playModeIndex === 1) {
        this.setData({ mistakeCount })
        const maxMistakes = Number(this.data.maxMistakes) || 999
        if (mistakeCount > maxMistakes) {
          this.finishFailure('失误过多')
          return
        }
      }
      setTimeout(() => {
        const cleared = (this.data.cells || []).map((c) => (c.n === n ? { ...c, state: '' } : c))
        this.setData({ cells: cleared })
      }, 250)
      return
    }

    const nextProgress = (Number(this.data.progressIndex) || 0) + 1
    const finished = nextProgress >= total
    if (finished) {
      const elapsedMs = Date.now() - this.data.startedAt + (Number(this.data.extraPenaltyMs) || 0)
      this.stopTimer()
      const difficultyKey = this.getDifficultyKey()
      const ref = this.computeReference(size, difficultyKey)
      this.setReferenceToData(ref)
      const score = scoreByTime(elapsedMs, ref, size)
      const ts = Date.now()

      const orderModeKey = this.getOrderModeKey()
      const modeLabel = (this.data.orderModes || [])[this.data.orderModeIndex] || '顺序'
      const diffLabel = (this.data.difficultyLabels || [])[this.data.difficultyIndex] || '普通'
      const playLabel = (this.data.playModes || [])[this.data.playModeIndex] || '练习'
      const playerName = String(this.data.profileName || '').trim()

      const record = {
        id: `focus_${ts}_${Math.floor(Math.random() * 100000)}`,
        ts,
        whenText: formatDateTime(ts),
        timeText: formatMs(elapsedMs),
        elapsedMs,
        size,
        playMode: playLabel,
        orderMode: modeLabel,
        difficulty: diffLabel,
        score,
        playerName,
        result: '完成'
      }
      const history = this.loadHistory()
      history.unshift(record)
      this.saveHistory(history)
      try {
        const ag = (this.data.ageGroups || [])[this.data.ageGroupIndex] || {}
        this.callCloudFunction('focus-submit', {
          size,
          elapsedMs,
          score,
          difficulty: diffLabel,
          playMode: playLabel,
          orderMode: modeLabel,
          ageGroupKey: ag.key || '',
          nickname: playerName || ''
        })
        this.loadCloudLeaderboards().catch(() => {})
      } catch (e) {}

      const lastResult = {
        ts,
        timeText: formatMs(elapsedMs),
        score,
        size,
        playMode: playLabel,
        orderMode: modeLabel,
        difficulty: diffLabel,
        whenText: formatDateTime(ts)
      }

      const prepared = this.buildPrepared(size, orderModeKey)

      let stageResultText = ''
      if (this.data.playModeIndex === 1) {
        const limitMs = Number(this.data.stageTimeLimitMs) || (ref && ref.passMs) || 0
        const pass = limitMs ? elapsedMs <= limitMs : true
        stageResultText = pass ? '本关通过' : '本关未通过'
        if (pass) {
          const nextStageIndex = (Number(this.data.stageIndex) || 0) + 1
          const stages = this.data.challengeStages || this.buildChallengeStages()
          if (nextStageIndex < stages.length) {
            this.setData({ stageIndex: nextStageIndex })
            setTimeout(() => this.loadStage(nextStageIndex, stages), 450)
          } else {
            stageResultText = '闯关完成'
          }
        }
      }

      this.setData({
        cells,
        finished: true,
        elapsedMs,
        elapsedText: formatMs(elapsedMs),
        progressIndex: nextProgress,
        nextNumber: expect,
        reference: ref,
        score,
        lastResult,
        prepared,
        stageResultText
      })
      return
    }

    const nextExpect = Number(order[nextProgress]) || (expect + 1)
    this.setData({ cells, progressIndex: nextProgress, nextNumber: nextExpect })
  }
})

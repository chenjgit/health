const app = getApp()
const { ensureLogin, getUserInfo, clearLoginInfo } = require("../../utils/auth")

function getProfileKey(userId) {
  return `user_profile_v1_${String(userId || '').trim()}`
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

function normalizeGender(v) {
  const s = String(v || '')
  if (s === '男' || s === '1') return '男'
  if (s === '女' || s === '2') return '女'
  return '未知'
}

Page({
  data: {
    userId: "",
    userInfo: {},
    loginLoading: false,
    editing: false,
    form: {
      nickname: '',
      gender: '未知',
      age: '',
      avatarUrl: ''
    },
    genderOptions: ['未知', '男', '女']
  },

  async onShow() {
    const cachedOpenid = app.globalData.openid || wx.getStorageSync('openid')
    if (cachedOpenid) {
      const userInfo = getUserInfo()
      const profileKey = getProfileKey(wx.getStorageSync('userId') || cachedOpenid)
      const saved = getStorage(profileKey, null) || {}
      const merged = {
        ...userInfo,
        nickName: saved.nickname || userInfo.nickName || '',
        avatarUrl: saved.avatarUrl || userInfo.avatarUrl || '',
        gender: normalizeGender(saved.gender || userInfo.gender),
        age: saved.age != null ? String(saved.age) : (userInfo.age != null ? String(userInfo.age) : '')
      }
      this.setData({
        userId: cachedOpenid,
        userInfo: merged,
        form: {
          nickname: merged.nickName || '',
          gender: normalizeGender(merged.gender),
          age: merged.age || '',
          avatarUrl: merged.avatarUrl || ''
        }
      })
    } else {
      this.setData({ userId: "", userInfo: {} })
    }
  },

  async ensureConsent() {
    const key = 'privacy_consent_v1'
    if (wx.getStorageSync(key)) return true
    const res = await new Promise((resolve) => {
      wx.showModal({
        title: '隐私与权限提示',
        content: '登录后将用于展示昵称头像、同步打卡记录与个性化推荐。你可以在“我的”随时退出登录。是否同意继续？',
        confirmText: '同意',
        cancelText: '暂不',
        success: resolve,
        fail: () => resolve({ confirm: false })
      })
    })
    if (res && res.confirm) {
      wx.setStorageSync(key, 1)
      return true
    }
    return false
  },

  async onLoginTap() {
    const ok = await this.ensureConsent()
    if (!ok) return

    this.setData({ loginLoading: true })
    try {
      const profile = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善账号资料',
          success: resolve,
          fail: reject
        })
      })
      const userInfo = (profile && profile.userInfo) || {}
      const openid = await ensureLogin(userInfo)
      const merged = { ...getUserInfo(), gender: normalizeGender(userInfo.gender), age: '' }
      this.setData({
        userId: openid,
        userInfo: merged,
        editing: false,
        form: {
          nickname: merged.nickName || '',
          gender: normalizeGender(merged.gender),
          age: merged.age || '',
          avatarUrl: merged.avatarUrl || ''
        }
      })
      wx.showToast({ title: '登录成功', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    } finally {
      this.setData({ loginLoading: false })
    }
  },

  toggleEdit() {
    if (!this.data.userId) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    this.setData({ editing: !this.data.editing })
  },

  onNicknameInput(e) {
    this.setData({ form: { ...this.data.form, nickname: String(e.detail.value || '') } })
  },

  onAgeInput(e) {
    const v = String(e.detail.value || '').replace(/[^\d]/g, '').slice(0, 3)
    this.setData({ form: { ...this.data.form, age: v } })
  },

  onGenderChange(e) {
    const idx = Number(e.detail.value) || 0
    const gender = this.data.genderOptions[idx] || '未知'
    this.setData({ form: { ...this.data.form, gender } })
  },

  async chooseAvatar() {
    if (!this.data.userId) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    try {
      const res = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          sizeType: ['compressed'],
          success: resolve,
          fail: reject
        })
      })
      const file = res && res.tempFiles && res.tempFiles[0]
      const tempFilePath = file && file.tempFilePath
      if (!tempFilePath) throw new Error('未选择图片')
      let finalPath = tempFilePath
      try {
        const saved = await new Promise((resolve, reject) => {
          wx.saveFile({
            tempFilePath,
            success: resolve,
            fail: reject
          })
        })
        if (saved && saved.savedFilePath) finalPath = saved.savedFilePath
      } catch (e) {}
      this.setData({ form: { ...this.data.form, avatarUrl: finalPath } })
    } catch (e) {
      wx.showToast({ title: '选择头像失败', icon: 'none' })
    }
  },

  async saveProfile() {
    if (!this.data.userId) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    const userId = wx.getStorageSync('userId') || this.data.userId
    const key = getProfileKey(userId)
    const nickname = String((this.data.form && this.data.form.nickname) || '').trim()
    const gender = normalizeGender(this.data.form && this.data.form.gender)
    const age = String((this.data.form && this.data.form.age) || '').trim()
    const avatarUrl = String((this.data.form && this.data.form.avatarUrl) || '').trim()

    const patch = { nickname, gender, age: age ? Number(age) : null, avatarUrl }
    setStorage(key, patch)

    const nextUserInfo = {
      ...this.data.userInfo,
      nickName: nickname || this.data.userInfo.nickName || '健康用户',
      avatarUrl: avatarUrl || this.data.userInfo.avatarUrl || '',
      gender,
      age
    }
    app.globalData.userInfo = nextUserInfo
    wx.setStorageSync('userInfo', nextUserInfo)
    this.setData({ userInfo: nextUserInfo, editing: false })

    try {
      if (wx.cloud && wx.cloud.database) {
        const db = wx.cloud.database()
        await db.collection('user').doc(userId).update({
          data: {
            nickname: nickname || db.command.remove(),
            avatarUrl: avatarUrl || db.command.remove(),
            gender: gender || db.command.remove(),
            age: age ? Number(age) : db.command.remove(),
            updatedAt: db.serverDate()
          }
        })
      }
    } catch (e) {}

    wx.showToast({ title: '已保存', icon: 'success' })
  },

  async logout() {
    const res = await new Promise((resolve) => {
      wx.showModal({
        title: '退出登录',
        content: '确定退出当前账号吗？',
        confirmText: '退出',
        cancelText: '取消',
        success: resolve,
        fail: () => resolve({ confirm: false })
      })
    })
    if (!res || !res.confirm) return
    clearLoginInfo()
    this.setData({
      userId: '',
      userInfo: {},
      editing: false,
      form: { nickname: '', gender: '未知', age: '', avatarUrl: '' }
    })
    wx.showToast({ title: '已退出登录', icon: 'success' })
  },

  goRecipes() {
    if (!this.data.userId) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    wx.switchTab({ url: "/pages/recipes/recipes" })
  },

  goPlan() {
    if (!this.data.userId) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    wx.navigateTo({ url: "/pages/plan/plan" })
  },

  goMemo() {
    wx.navigateTo({ url: "/pages/memo/memo" })
  },

  goCloudEnv() {
    wx.navigateTo({ url: "/pages/cloud-env/cloud-env" })
  }
})

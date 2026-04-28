# 健康养生小程序 CloudBase 完整实现指南

## 📦 已完成的工作

### ✅ 1. 云函数代码 (12个)
所有云函数已创建在 `cloudfunctions/` 目录下：

- ✅ `auth-login` - 微信登录
- ✅ `article-list` - 文章列表(分页+搜索)
- ✅ `article-detail` - 文章详情
- ✅ `checkin-today` - 今日打卡查询
- ✅ `checkin-upsert` - 保存/更新打卡
- ✅ `checkin-history` - 打卡历史
- ✅ `recipe-list` - 食谱列表(筛选)
- ✅ `recipe-detail` - 食谱详情
- ✅ `plan-list` - 计划列表
- ✅ `plan-detail` - 计划详情
- ✅ `tip-today` - 今日养生知识
- ✅ `news-latest` - 健康资讯

### ✅ 2. 小程序工具类
- ✅ `utils/cloud.js` - 云函数调用封装
- ✅ `utils/auth.js` - 认证管理

---

## 🚀 接下来需要完成的步骤

### 步骤 1: 修改 app.js (启用云开发)

**文件**: `health-miniapp-client/app.js`

```javascript
App({
  globalData: {
    openid: null,
    userId: null,
    userInfo: {}
  },

  onLaunch() {
    // 初始化云开发 - ⚠️重要: 替换为你的环境ID
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'health-xxx', // ← 替换为你的云环境ID
        traceUser: true
      })
    }

    // 检查登录状态
    const openid = wx.getStorageSync('openid')
    if (openid) {
      this.globalData.openid = openid
      this.globalData.userId = wx.getStorageSync('userId')
      this.globalData.userInfo = wx.getStorageSync('userInfo') || {}
    }
  }
})
```

**⚠️ 重要**: 将 `'health-xxx'` 替换为你在腾讯云控制台创建的云环境ID

---

### 步骤 2: 修改 app.json (添加云开发配置)

**文件**: `health-miniapp-client/app.json`

```json
{
  "pages": [
    "pages/home/home",
    "pages/article-detail/article-detail",
    "pages/recipes/recipes",
    "pages/recipe-detail/recipe-detail",
    "pages/plan/plan",
    "pages/checkin/checkin",
    "pages/mine/mine"
  ],
  "window": {
    "navigationBarTitleText": "健康养生",
    "navigationBarBackgroundColor": "#22C55E",
    "navigationBarTextStyle": "white",
    "backgroundTextStyle": "light"
  },
  "sitemapLocation": "sitemap.json",
  "cloud": true
}
```

**新增**: `"cloud": true` 启用云开发

---

### 步骤 3: 修改 project.config.json

**文件**: `health-miniapp-client/project.config.json`

```json
{
  "description": "项目配置文件",
  "packOptions": {
    "ignore": [],
    "include": []
  },
  "miniprogramRoot": "./",
  "cloudfunctionRoot": "../cloudfunctions/",
  "setting": {
    "urlCheck": true,
    "es6": true,
    "enhance": true,
    "postcss": true,
    "preloadBackgroundData": false,
    "minified": true,
    "newFeature": false,
    "coverView": true,
    "nodeModules": false,
    "autoAudits": false,
    "showShadowRootInWxmlPanel": true,
    "scopeDataCheck": false,
    "uglifyFileName": false,
    "checkInvalidKey": true,
    "checkSiteMap": true,
    "uploadWithSourceMap": true,
    "compileHotReLoad": false,
    "lazyloadPlaceholderEnable": false,
    "useMultiFrameRuntime": true,
    "useApiHook": true,
    "useApiHostProcess": true,
    "babelSetting": {
      "ignore": [],
      "disablePlugins": [],
      "outputPath": ""
    },
    "enableEngineNative": false,
    "useIsolateContext": true,
    "userConfirmedBundleSwitch": false,
    "packNpmManually": false,
    "packNpmRelationList": [],
    "minifyWXSS": true,
    "showES6CompileOption": false,
    "compileWorklet": false,
    "minifyWXML": true,
    "localPlugins": false,
    "disableUseStrict": false,
    "useCompilerPlugins": false,
    "swc": false,
    "disableSWC": true
  },
  "compileType": "miniprogram",
  "libVersion": "latest",
  "appid": "wxYOUR_APPID",
  "projectname": "health-miniapp",
  "isGameTourist": false,
  "condition": {},
  "editorSetting": {}
}
```

**关键配置**:
- `"cloudfunctionRoot": "../cloudfunctions/"` - 指向云函数目录
- `"appid": "wxYOUR_APPID"` - 替换为你的小程序AppID

---

### 步骤 4: 改造页面 - home.js

**文件**: `health-miniapp-client/pages/home/home.js`

```javascript
const { callCloudFunction } = require("../../utils/cloud")
const { ensureLogin } = require("../../utils/auth")

Page({
  data: {
    q: "",
    loading: false,
    articles: [],
    tip: null,
    news: []
  },

  async onLoad() {
    try {
      await ensureLogin()
      await Promise.all([this.loadTip(), this.loadNews(), this.loadArticles()])
    } catch (e) {
      wx.showToast({ title: "初始化失败", icon: "none" })
    }
  },

  onPullDownRefresh() {
    Promise.all([this.loadTip(), this.loadNews(), this.loadArticles()])
      .finally(() => wx.stopPullDownRefresh())
  },

  onInput(e) {
    this.setData({ q: e.detail.value })
  },

  async onSearch() {
    await this.loadArticles()
  },

  async loadArticles() {
    this.setData({ loading: true })
    try {
      const page = await callCloudFunction('article-list', {
        page: 0,
        size: 20,
        q: this.data.q
      })
      this.setData({ articles: (page && page.content) || [] })
    } catch (e) {
      wx.showToast({ title: "加载失败", icon: "none" })
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadTip() {
    try {
      const tip = await callCloudFunction('tip-today')
      this.setData({ tip })
    } catch (e) {
      // ignore
    }
  },

  async loadNews() {
    try {
      const news = await callCloudFunction('news-latest', { limit: 8 })
      this.setData({ news })
    } catch (e) {
      // ignore
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/article-detail/article-detail?id=${id}` })
  },

  goCheckin() {
    wx.navigateTo({ url: "/pages/checkin/checkin" })
  },

  goRecipes() {
    wx.navigateTo({ url: "/pages/recipes/recipes" })
  },

  goPlan() {
    wx.navigateTo({ url: "/pages/plan/plan" })
  },

  onTapNews(e) {
    const link = e.currentTarget.dataset.link
    wx.setClipboardData({
      data: link,
      success: () => wx.showToast({ title: "链接已复制", icon: "success" })
    })
  }
})
```

---

### 步骤 5: 改造页面 - checkin.js

**文件**: `health-miniapp-client/pages/checkin/checkin.js`

```javascript
const { callCloudFunction } = require("../../utils/cloud")
const { ensureLogin } = require("../../utils/auth")

Page({
  data: {
    moods: ["开心", "平静", "一般", "疲惫", "焦虑"],
    moodIndex: 0,
    loading: false,
    saving: false,
    lastSavedAt: "",
    form: {
      waterMl: "",
      steps: "",
      sleepHours: "",
      mood: "",
      note: ""
    }
  },

  async onLoad() {
    await this.init()
  },

  onPullDownRefresh() {
    this.init().finally(() => wx.stopPullDownRefresh())
  },

  async init() {
    this.setData({ loading: true })
    try {
      await ensureLogin()
      const today = await callCloudFunction('checkin-today')
      if (today) {
        const mood = today.mood || ""
        const moodIndex = Math.max(this.data.moods.indexOf(mood), 0)
        this.setData({
          moodIndex,
          lastSavedAt: today.updatedAt ? new Date(today.updatedAt).toLocaleString() : "",
          form: {
            waterMl: today.waterMl == null ? "" : String(today.waterMl),
            steps: today.steps == null ? "" : String(today.steps),
            sleepHours: today.sleepHours == null ? "" : String(today.sleepHours),
            mood,
            note: today.note || ""
          }
        })
      }
    } catch (e) {
      wx.showToast({ title: "加载失败", icon: "none" })
    } finally {
      this.setData({ loading: false })
    }
  },

  onWater(e) {
    this.setData({ "form.waterMl": e.detail.value })
  },

  onSteps(e) {
    this.setData({ "form.steps": e.detail.value })
  },

  onSleep(e) {
    this.setData({ "form.sleepHours": e.detail.value })
  },

  onNote(e) {
    this.setData({ "form.note": e.detail.value })
  },

  onMood(e) {
    const index = Number(e.detail.value)
    const mood = this.data.moods[index]
    this.setData({
      moodIndex: index,
      "form.mood": mood
    })
  },

  async onSave() {
    this.setData({ saving: true })
    try {
      const form = this.data.form
      await callCloudFunction('checkin-upsert', {
        waterMl: form.waterMl ? parseInt(form.waterMl) : null,
        steps: form.steps ? parseInt(form.steps) : null,
        sleepHours: form.sleepHours ? parseFloat(form.sleepHours) : null,
        mood: form.mood,
        note: form.note
      })
      wx.showToast({ title: "保存成功", icon: "success" })
      this.init()
    } catch (e) {
      wx.showToast({ title: "保存失败", icon: "none" })
    } finally {
      this.setData({ saving: false })
    }
  }
})
```

---

### 步骤 6: 改造页面 - recipes.js

**文件**: `health-miniapp-client/pages/recipes/recipes.js`

```javascript
const { callCloudFunction } = require("../../utils/cloud")

Page({
  data: {
    q: "",
    loading: false,
    recipes: [],

    categories: ["全部", "养生茶饮", "日常正餐"],
    effects: ["全部", "安神助眠", "控制体重"],
    constitutions: ["全部", "通用", "偏寒", "气虚"],

    categoryIndex: 0,
    effectIndex: 0,
    constitutionIndex: 0
  },

  onLoad() {
    this.loadRecipes()
  },

  onPullDownRefresh() {
    this.loadRecipes().finally(() => wx.stopPullDownRefresh())
  },

  onInput(e) {
    this.setData({ q: e.detail.value })
  },

  onSearch() {
    this.loadRecipes()
  },

  onCategoryChange(e) {
    const index = Number(e.detail.value)
    this.setData({ categoryIndex: index })
    this.loadRecipes()
  },

  onEffectChange(e) {
    const index = Number(e.detail.value)
    this.setData({ effectIndex: index })
    this.loadRecipes()
  },

  onConstitutionChange(e) {
    const index = Number(e.detail.value)
    this.setData({ constitutionIndex: index })
    this.loadRecipes()
  },

  async loadRecipes() {
    this.setData({ loading: true })
    try {
      const category = this.data.categories[this.data.categoryIndex]
      const effect = this.data.effects[this.data.effectIndex]
      const constitution = this.data.constitutions[this.data.constitutionIndex]

      const page = await callCloudFunction('recipe-list', {
        page: 0,
        size: 20,
        q: this.data.q,
        category: category !== "全部" ? category : "",
        effect: effect !== "全部" ? effect : "",
        constitution: constitution !== "全部" ? constitution : ""
      })

      this.setData({ recipes: (page && page.content) || [] })
    } catch (e) {
      wx.showToast({ title: "加载失败", icon: "none" })
    } finally {
      this.setData({ loading: false })
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/recipe-detail/recipe-detail?id=${id}` })
  }
})
```

---

### 步骤 7: 改造页面 - plan.js

**文件**: `health-miniapp-client/pages/plan/plan.js`

```javascript
const { callCloudFunction } = require("../../utils/cloud")

Page({
  data: {
    loading: false,
    plans: [],
    currentPlan: null
  },

  onLoad() {
    this.loadPlans()
  },

  onPullDownRefresh() {
    this.loadPlans().finally(() => wx.stopPullDownRefresh())
  },

  async loadPlans() {
    this.setData({ loading: true })
    try {
      const list = await callCloudFunction('plan-list')
      this.setData({
        plans: list || [],
        currentPlan: (list && list.length > 0) ? list[0] : null
      })
    } catch (e) {
      wx.showToast({ title: "加载失败", icon: "none" })
    } finally {
      this.setData({ loading: false })
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    const plan = (this.data.plans || []).find(p => p._id === id)
    if (plan) {
      this.setData({ currentPlan: plan })
    }
  }
})
```

---

### 步骤 8: 改造页面 - article-detail.js

**文件**: `health-miniapp-client/pages/article-detail/article-detail.js`

```javascript
const { callCloudFunction } = require("../../utils/cloud")

Page({
  data: {
    article: null,
    loading: true
  },

  async onLoad(options) {
    if (options.id) {
      await this.loadArticle(options.id)
    }
  },

  onPullDownRefresh() {
    if (this.data.article && this.data.article._id) {
      this.loadArticle(this.data.article._id).finally(() => wx.stopPullDownRefresh())
    }
  },

  async loadArticle(id) {
    this.setData({ loading: true })
    try {
      const article = await callCloudFunction('article-detail', { id })
      this.setData({ article })
    } catch (e) {
      wx.showToast({ title: "加载失败", icon: "none" })
    } finally {
      this.setData({ loading: false })
    }
  }
})
```

---

### 步骤 9: 改造页面 - recipe-detail.js

**文件**: `health-miniapp-client/pages/recipe-detail/recipe-detail.js`

```javascript
const { callCloudFunction } = require("../../utils/cloud")

Page({
  data: {
    recipe: null,
    loading: true
  },

  async onLoad(options) {
    if (options.id) {
      await this.loadRecipe(options.id)
    }
  },

  async loadRecipe(id) {
    this.setData({ loading: true })
    try {
      const recipe = await callCloudFunction('recipe-detail', { id })
      this.setData({ recipe })
    } catch (e) {
      wx.showToast({ title: "加载失败", icon: "none" })
    } finally {
      this.setData({ loading: false })
    }
  }
})
```

---

### 步骤 10: 改造页面 - mine.js

**文件**: `health-miniapp-client/pages/mine/mine.js`

```javascript
const { callCloudFunction } = require("../../utils/cloud")
const { ensureLogin, getUserInfo, clearLoginInfo } = require("../../utils/auth")

Page({
  data: {
    userId: "",
    userInfo: {},
    baseUrl: "CloudBase云开发"
  },

  async onLoad() {
    await this.init()
  },

  async init() {
    try {
      await ensureLogin()
      const userInfo = getUserInfo()
      this.setData({
        userId: getApp().globalData.userId || "",
        userInfo: userInfo
      })
    } catch (e) {
      wx.showToast({ title: "加载失败", icon: "none" })
    }
  },

  async resetUser() {
    clearLoginInfo()
    await ensureLogin()
    this.setData({ userId: getApp().globalData.userId })
    wx.showToast({ title: "已重置", icon: "success" })
  },

  goRecipes() {
    wx.navigateTo({ url: "/pages/recipes/recipes" })
  },

  goPlan() {
    wx.navigateTo({ url: "/pages/plan/plan" })
  }
})
```

---

## 📝 数据库初始化脚本

在云开发控制台执行以下脚本初始化数据：

### 1. 初始化文章数据
```javascript
db.collection('article').add({
  data: [
    {
      title: "春季养生：作息与饮食的 3 个关键",
      summary: "从起居、饮食与运动三个维度，给出可落地的春季调养建议。",
      content: "春季是养生的好时节...\n(完整内容)",
      category: "四季养生",
      tags: ["春季", "作息", "饮食", "运动"],
      coverUrl: "https://images.unsplash.com/photo-1513639725746-c5d3e861f32a?auto=format&fit=crop&w=1200&q=60",
      createdAt: new Date()
    },
    {
      title: "每天喝多少水才够？",
      summary: "科学饮水指南：分时段、分人群、分场景的饮水建议。",
      content: "饮水是维持健康的基础...\n(完整内容)",
      category: "饮食养生",
      tags: ["饮水", "健康", "科普"],
      coverUrl: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=1200&q=60",
      createdAt: new Date()
    }
  ]
})
```

### 2. 初始化食谱数据
```javascript
db.collection('recipe').add({
  data: [
    {
      name: "温润红枣桂圆茶",
      summary: "暖胃安神，适合体质偏寒、易疲劳的人群。",
      category: "养生茶饮",
      effect: "安神助眠,暖胃",
      constitution: "偏寒,气虚",
      coverUrl: "https://images.unsplash.com/photo-1513639725746-c5d3e861f32a?auto=format&fit=crop&w=1200&q=60",
      ingredients: "红枣 6-8 枚（去核更好）\n桂圆肉 4-6 颗\n枸杞 一小把\n温水 400-500ml",
      steps: "1）红枣洗净、剪开或去核；桂圆肉与枸杞冲洗备用。\n2）将红枣、桂圆肉放入养生壶...\n3）加水煮沸后小火煮10分钟..."
    },
    {
      name: "轻体鸡胸肉蔬菜沙拉",
      summary: "高蛋白低脂肪，适合控制体重的人群。",
      category: "日常正餐",
      effect: "控制体重,增肌",
      constitution: "通用",
      coverUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=60",
      ingredients: "鸡胸肉 200g\n生菜 适量\n番茄 1个\n黄瓜 半根",
      steps: "1）鸡胸肉煮熟切块。\n2）蔬菜洗净切好。\n3）混合后加入低脂沙拉酱。"
    }
  ]
})
```

### 3. 初始化健康计划
```javascript
db.collection('health_plan').add({
  data: [
    {
      name: "7 天睡眠改善计划",
      summary: "通过调整作息习惯，一周内改善睡眠质量。",
      days: 7,
      level: "入门",
      content: "每日行动计划：\n- 第1-2天：固定作息时间，晚上11点前入睡\n- 第3-4天：睡前1小时远离手机\n- 第5-7天：增加睡前放松活动（冥想、深呼吸）"
    },
    {
      name: "30 天综合生活习惯养成计划",
      summary: "从作息、饮食、运动与情绪四个维度综合调整。",
      days: 30,
      level: "进阶",
      content: "周目标拆分：\n- 第 1 周：固定作息 + 稍微增加活动量。\n- 第 2 周：优化饮食结构，减少油炸与高糖饮料。\n- 第 3 周：每周至少 3 次中等强度运动。\n- 第 4 周：增加情绪管理与放松练习。"
    }
  ]
})
```

### 4. 初始化每日养生知识
```javascript
const tips = [
  { title: "每日养生：喝水分段更容易坚持", content: "把目标拆成 4-5 次小目标（例如每次 300ml），比一次猛灌更舒服也更可持续。" },
  { title: "每日养生：晚饭七分饱", content: "晚餐少一点、慢一点，留出 2-3 小时再睡觉，睡眠质量通常会更好。" },
  { title: "每日养生：每天 10 分钟拉伸", content: "久坐后做颈肩、髋部和腘绳肌拉伸，配合深呼吸，缓解疲劳。" },
  { title: "每日养生：晒太阳与作息", content: "上午适度日光有助于生物钟稳定，晚上更容易入睡。" },
  { title: "每日养生：蔬菜优先", content: "每餐先吃蔬菜，再吃蛋白和主食，有助于控制总摄入与血糖波动。" }
]

const today = new Date()
tips.forEach((tip, index) => {
  const date = new Date(today)
  date.setDate(date.getDate() + index)
  date.setHours(0, 0, 0, 0)
  
  db.collection('daily_tip').add({
    data: {
      date: date,
      title: tip.title,
      content: tip.content
    }
  })
})
```

---

## 🎯 完整部署检查清单

### 云函数部署
```bash
# 1. 安装所有云函数依赖
cd d:\nancal\code\health\cloudfunctions
Get-ChildItem -Directory | ForEach-Object {
  Set-Location $_.FullName
  npm install
}

# 2. 部署所有云函数
cd d:\nancal\code\health
Get-ChildItem -Path cloudfunctions -Directory | ForEach-Object {
  tcb fn deploy $($_.Name)
}
```

### 小程序测试
1. 打开微信开发者工具
2. 导入项目: `d:\nancal\code\health\health-miniapp-client`
3. 填写 AppID (或选择测试号)
4. 等待编译完成
5. 测试所有功能

### 上线发布
1. 点击「上传」按钮
2. 填写版本号 (如 1.0.0) 和备注
3. 登录微信公众平台提交审核
4. 审核通过后发布上线

---

## 📌 重要提醒

1. **替换环境ID**: 在 `app.js` 中将 `'health-xxx'` 替换为你的云环境ID
2. **替换AppID**: 在 `project.config.json` 中填入你的小程序AppID
3. **数据库权限**: 在云开发控制台设置数据库权限为「所有用户可读，仅创建者可读写」
4. **隐私协议**: 上线前必须配置用户隐私保护指引

---

## ✨ 总结

现在你已经拥有：
- ✅ 12个完整的云函数 (可直接部署)
- ✅ 小程序工具类 (cloud.js, auth.js)
- ✅ 10个页面的完整改造代码
- ✅ 数据库初始化脚本
- ✅ 完整的部署检查清单

**下一步**: 
1. 按照上述步骤修改配置文件
2. 部署云函数
3. 初始化数据库
4. 本地测试
5. 上传审核上线

祝你上线顺利！🚀

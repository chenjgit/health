# 🚀 健康养生小程序 CloudBase 部署快速指南

## ✅ 已完成的工作

### 1. 云函数代码 ✅
云函数位于 `health-miniapp-client/cloudfunctions/`，并包含：
- auth-login
- news-latest / article-list / article-detail / tip-today
- recipe-list / recipe-detail
- checkin-today / checkin-upsert / checkin-history
- plan-list / plan-create / plan-update / plan-delete / plan-recommend-toggle
- favorite-toggle / favorite-check / favorite-list

### 2. 小程序工具类 ✅
- `utils/cloud.js` - 云函数调用封装
- `utils/auth.js` - 认证管理

### 3. 页面改造 ✅
已改造的页面：
- ✅ pages/home/home.js
- ✅ pages/checkin/checkin.js  
- ✅ pages/article-detail/article-detail.js
- ✅ pages/recipe-detail/recipe-detail.js
- ✅ pages/mine/mine.js

---

## 📝 接下来需要手动完成的步骤

### 步骤 1: 修改 app.js (必需)

**文件**: `health-miniapp-client/app.js`

**完整替换为**:
```javascript
App({
  globalData: {
    openid: null,
    userId: null,
    userInfo: {}
  },

  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'health-xxx', // ⚠️ 替换为你的云环境ID
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

**⚠️ 重要**: 将 `'health-xxx'` 替换为你的云环境ID

---

### 步骤 2: 修改 app.json (必需)

**文件**: `health-miniapp-client/app.json`

**添加** `"cloud": true`:
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

---

### 步骤 3: 工程导入方式（二选一）

1) 推荐：微信开发者工具直接导入仓库根目录 `d:\nancal\code\health`  
已在根目录 [project.config.json](file:///d:/nancal/code/health/project.config.json) 配好：
- `miniprogramRoot: health-miniapp-client/`
- `cloudfunctionRoot: health-miniapp-client/cloudfunctions/`

2) 也可以导入 `health-miniapp-client/`（但需要自行维护对应 project.config 配置）

---

### 步骤 4: 改造剩余页面 (需完成)

还需要改造以下3个页面，参考 `CLOUDBASE_IMPLEMENTATION_GUIDE.md` 中的完整代码：

#### 4.1 pages/recipes/recipes.js
**修改点**:
- 将 `request` 改为 `callCloudFunction`
- 将 `ensureUserId` 改为 `ensureLogin` (如果需要)
- 调用 `recipe-list` 云函数

#### 4.2 pages/plan/plan.js  
**修改点**:
- 将 `request` 改为 `callCloudFunction`
- 调用 `plan-list` 云函数

#### 4.3 pages/recipe-detail/recipe-detail.js
**修改点**:
- 已改造完成 ✅

---

### 步骤 5: 部署云函数

**PowerShell 批量部署脚本**:
```powershell
# 1. 安装所有云函数依赖
cd d:\nancal\code\health\cloudfunctions
Get-ChildItem -Directory | ForEach-Object {
  Set-Location $_.FullName
  Write-Host "Installing $($_.Name)..."
  npm install
}

# 2. 部署所有云函数
cd d:\nancal\code\health
Get-ChildItem -Path cloudfunctions -Directory | ForEach-Object {
  Write-Host "Deploying $($_.Name)..."
  tcb fn deploy $($_.Name)
}
```

**验证**: 在云开发控制台看到12个云函数状态为"已部署" ✅

---

### 步骤 6: 初始化数据库/索引

数据库集合、索引、缓存表与收藏表的创建方式统一写在 [CLOUDBASE_SETUP.md](file:///d:/nancal/code/health/CLOUDBASE_SETUP.md)。

---

### 步骤 7: 本地测试

1. 打开微信开发者工具
2. 导入项目: `d:\nancal\code\health\health-miniapp-client`
3. 填写 AppID (或选择测试号)
4. 等待编译完成
5. 测试功能：
   - ✅ 首页加载
   - ✅ 微信登录
   - ✅ 打卡保存
   - ✅ 文章浏览
   - ✅ 食谱筛选

---

### 步骤 8: 上传发布

1. 点击「上传」按钮
2. 填写版本号: `1.0.0`
3. 填写备注: `首次上传，CloudBase版本`
4. 登录微信公众平台
5. 提交审核
6. 审核通过后发布上线

---

## 🎯 快速检查清单

### 配置检查
- [ ] app.js 中 env 已替换为真实环境ID
- [ ] app.json 中添加了 `"cloud": true`
- [ ] project.config.json 中 appid 已填写
- [ ] project.config.json 中 cloudfunctionRoot 路径正确

### 云函数检查  
- [ ] 12个云函数都已安装依赖 (npm install)
- [ ] 12个云函数都已部署 (tcb fn deploy)
- [ ] 云开发控制台显示所有云函数状态正常

### 数据库检查
- [ ] 6个集合已创建
- [ ] 索引已配置
- [ ] 种子数据已导入

### 功能检查
- [ ] 首页能正常加载文章和养生知识
- [ ] 微信登录正常
- [ ] 打卡能正常保存
- [ ] 食谱能筛选和查看详情
- [ ] 计划能正常显示

---

## 📚 参考文档

- **完整实现指南**: `CLOUDBASE_IMPLEMENTATION_GUIDE.md`
- **产品需求文档**: `PRD.md`
- **CloudBase 官方文档**: https://docs.cloudbase.net/

---

## 🆘 常见问题

### Q1: 云函数调用失败
**解决**: 
1. 检查 envId 是否正确
2. 检查云函数是否已部署
3. 查看云函数日志

### Q2: 数据库权限错误
**解决**:
云开发控制台 → 数据库 → 权限设置 → 设置为「所有用户可读，仅创建者可读写」

### Q3: 本地测试正常，真机失败
**解决**:
1. 确认 app.js 中云开发初始化在最前面
2. 删除小程序重新添加
3. 检查基础库版本 >= 2.2.3

---

## ✨ 总结

你现在拥有：
- ✅ 12个完整的云函数 (已创建)
- ✅ 5个已改造的页面
- ✅ 完整的工具类
- ✅ 详细的部署指南

**下一步**:
1. 按照上述8个步骤完成配置
2. 部署云函数
3. 初始化数据库
4. 本地测试
5. 上传审核上线

**预计耗时**: 2-3小时 (首次部署)

祝你上线顺利！🚀

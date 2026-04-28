# 健康养生小程序 - 产品需求文档 (PRD)

## 一、项目概述

### 1.1 项目名称
健康养生小程序 (Health Wellness MiniApp)

### 1.2 项目定位
一款面向大众用户的健康养生管理微信小程序，提供健康资讯阅读、日常健康打卡、养生食谱推荐、健康计划管理等功能，帮助用户养成健康生活习惯。

### 1.3 目标用户
- 关注健康养生的普通用户
- 需要日常健康管理的亚健康人群
- 希望改善生活习惯的用户群体

### 1.4 技术架构
**前端**: 微信小程序原生开发 (WXML/WXSS/JavaScript)
**后端**: 云开发 CloudBase 云函数 (Node.js)
**数据库**: 云开发 NoSQL 数据库
**认证方式**: 云函数 `getWXContext()` 获取 openid，按 openid 做数据隔离

**离线/降级（云函数不可用时仍可运行）**
- 当云函数报错（例如 `-504002` 依赖缺失、`-501000` 资源不存在、`HTTP 401/Unauthorized` 等），客户端会自动切换为“本地直连公开中文站点接口/页面抓取 + 本地缓存”以确保首页/文章/食谱可用
- 需要在微信公众平台配置请求合法域名（详见 `REQUEST_DOMAIN_SETUP.md`）

**外部数据来源（实时抓取 + 缓存）**
- 健康资讯轮播：知乎日报 top_stories / stories（用于“健康资讯”滚动展示）
- 最新文章：知乎日报（支持排序：最新/最热/榜单，平台筛选：知乎日报/少数派/虎嗅/36氪/掘金，时间范围搜索）
- 养生食谱：下厨房搜索/explore 页面抓取（无关键词时展示推荐热门食谱）
- 每日养生知识：轮播多条，数据来自知乎日报最新资讯

---

## 二、核心功能模块

### 2.1 用户认证模块

#### 功能描述
提供微信授权登录能力，支持用户身份识别与数据隔离。

#### 功能点
1. **微信登录**
   - 调用 `wx.getUserProfile` 获取昵称/头像（用户授权）
   - 调用云函数 `auth-login`，在云函数内使用 `getWXContext()` 获取 openid，并在 `user` 集合中创建/更新用户
   - 本地会缓存 openid 与基础资料用于快速启动

2. **Token 管理**
   - 本项目不使用 JWT Token；以 openid 为身份标识并在云函数侧做数据隔离

3. **用户信息**
   - 支持获取当前登录用户信息
   - 包含昵称、头像、会员等级、积分等
   - “我的”页支持编辑：昵称/性别/年龄/头像（默认展示微信头像；离线状态下本地存储生效，云端可用时同步到 `user` 集合）

#### 数据模型
```
User {
  id: String (UUID)
  nickname: String
  avatarUrl: String
  openId: String (微信唯一标识)
  unionId: String
  memberLevel: String (会员等级)
  points: Integer (积分)
  vipUntil: LocalDate (VIP到期时间)
  lastLoginAt: LocalDateTime
  createdAt: LocalDateTime
}
```

#### API 接口
- `POST /api/auth/wechat-login` - 微信登录
- `GET /api/me` - 获取当前用户信息

---

### 2.2 健康资讯模块

#### 功能描述
提供健康养生相关的文章浏览、搜索功能，以及实时健康资讯聚合展示。

#### 功能点
1. **文章列表**
   - 分页展示最新文章（外部来源抓取 + 缓存）
   - 支持按标题/摘要关键词搜索
   - 支持触底加载更多（无限下拉，缓存池最大 2000 条）
   - 支持排序：最新 / 最热 / 榜单
   - 支持平台筛选：全部 / 知乎日报 / 少数派 / 虎嗅 / 36氪 / 掘金
   - 支持按时间范围搜索（起始/结束日期）
   - 文章卡片展示阅读量（本地统计）

2. **文章详情**
   - 展示摘要/正文（若抓取不到正文则提供原文链接打开 WebView）
   - 支持收藏/取消收藏
   - 支持阅读量展示、点赞与评论（离线本地存储，云端可用时可扩展为云端存储）

3. **每日养生知识**
   - 以轮播方式展示多条（来源：知乎日报最新资讯）
   - 点击可查看详情或跳转原文 WebView

#### 数据模型
```
Article {
  id: Long
  title: String (文章标题)
  summary: String (摘要)
  content: String (正文内容)
  category: String (分类)
  tags: String (标签，逗号分隔)
  coverUrl: String (封面图链接)
  createdAt: LocalDateTime
}

NewsItem {
  title: String
  link: String
  publishedAt: String
  source: String
}
```

#### API 接口
- `GET /api/articles?page=0&size=10&q=关键词` - 文章列表(分页)
- `GET /api/articles/{id}` - 文章详情
- `GET /api/news/latest?limit=8` - 最新健康资讯

---

### 2.3 每日打卡模块

#### 功能描述
支持用户每日记录健康数据，追踪饮水、步数、睡眠、心情等关键指标。

#### 功能点
1. **打卡记录**
   - 饮水量记录 (ml)
   - 步数记录
   - 睡眠时长记录 (小时)
   - 心情选择 (开心/平静/一般/疲惫/焦虑)
   - 备注信息

2. **数据管理**
   - 支持每日更新 (Upsert)
   - 查看今日打卡记录
   - 查看历史打卡记录 (日期范围查询)
   - 显示最后保存时间

3. **交互体验**
   - 下拉刷新
   - 保存成功提示
   - 表单数据回显

#### 数据模型
```
DailyCheckIn {
  id: Long
  userId: String
  date: LocalDate
  waterMl: Integer (饮水量)
  steps: Integer (步数)
  sleepHours: Double (睡眠时长)
  mood: String (心情)
  note: String (备注)
  updatedAt: LocalDateTime
}
```

#### API 接口
（云函数）
- `checkin-today` - 查询今日打卡
- `checkin-upsert` - 保存/更新今日打卡
- `checkin-history` - 历史记录

---

### 2.4 养生食谱模块

#### 功能描述
提供养生食谱库，支持按分类、功效、体质等多维度筛选。

#### 功能点
1. **食谱列表**
   - 外部来源实时抓取列表（支持分页与触底加载）
   - 支持关键词搜索
   - 支持筛选参数透传（分类/功效/体质）

2. **食谱详情**
   - 食谱名称
   - 食材清单与步骤（抓取解析，失败则提供原文链接）

3. **筛选能力**
   - 分类: 养生茶饮、日常正餐等
   - 功效: 安神助眠、控制体重等
   - 体质: 通用、偏寒、气虚等

#### 数据模型
```
Recipe {
  id: Long
  name: String (食谱名称)
  summary: String (简介)
  category: String (分类)
  effect: String (功效，逗号分隔)
  constitution: String (适用体质，逗号分隔)
  coverUrl: String (封面图)
  ingredients: String (食材清单)
  steps: String (制作步骤)
}
```

#### API 接口
（云函数）
- `recipe-list` - 食谱列表（分页）
- `recipe-detail` - 食谱详情

---

### 2.5 健康计划模块

#### 功能描述
支持用户创建自己的健康计划，并可将计划设为推荐供其他用户查看。

#### 功能点
1. **计划列表**
   - 推荐计划列表
   - 我的计划列表
2. **计划 CRUD**
   - 新增/编辑/删除（仅本人可操作）
3. **推荐功能**
   - 本人计划可设为推荐/取消推荐

### 2.6 收藏模块

#### 功能描述
支持用户对外部抓取的文章进行收藏与管理。

#### 功能点
1. **文章收藏**
   - 文章详情页收藏/取消收藏
2. **收藏列表**
   - 查看我的收藏列表

---

### 2.7 专注力工具（舒尔特表格）

#### 功能描述
提供舒尔特表格训练，支持练习/闯关、多难度、成绩对照表与本地榜单。

#### 功能点
1. **练习模式**
   - 规格：3x3 至 10x10（最大 100）
   - 玩法：顺序 / 倒序 / 乱序闯关（按提示数字点击）
   - 难度：简单/普通/困难（困难模式失误会叠加时间惩罚）
   - 完成后自动重排，支持“下一局”
2. **闯关模式**
   - 多关卡：按难度生成关卡序列（含顺序/倒序/乱序）
   - 规则：限时倒计时、失误次数上限（普通 5 次、困难 3 次）
   - 过关：达标自动进入下一关；超时/失误过多则失败
3. **参考表**
   - 内置经典成绩对照表（示例图同款样式）：按 3x3、4x4 的年龄段（3-5 / 6-10 / 11-17 / 18+）展示优秀/良好/合格
   - 其他规格（5x5~10x10）按启发式规则生成参考阈值
4. **历史与榜单（本机 + 全网）**
   - 历史测试数据自动保存（昵称/规格/模式/难度/用时/评分/时间）
   - 本机综合榜 Top 20
   - 云端 `focus_score` 集合存储全用户成绩（云函数 `focus-submit`/`focus-leaderboard`）
   - 综合榜 Top 20（按评分优先，其次用时）

---

## 三、云函数与数据（部署说明）

### 3.1 云函数清单
- 认证：`auth-login`
- 首页：`news-latest`、`tip-today`、`article-list`、`article-detail`
- 打卡：`checkin-today`、`checkin-upsert`、`checkin-history`
- 食谱：`recipe-list`、`recipe-detail`
- 计划：`plan-list`、`plan-create`、`plan-update`、`plan-delete`、`plan-recommend-toggle`
- 收藏：`favorite-check`、`favorite-toggle`、`favorite-list`
- 专注力：`focus-submit`、`focus-leaderboard`

### 3.2 数据库集合
- `user`：用户资料（登录创建/更新；我的页可同步 nickname/avatar/gender/age）
- `daily_checkin`：每日打卡数据
- `health_plan`：健康计划
- `favorite`：收藏记录
- `runtime_cache`：抓取结果缓存
- `focus_score`：舒尔特表格成绩（云函数提交/榜单查询）

#### 数据模型
```
HealthPlan {
  id: Long
  name: String (计划名称)
  summary: String (简介)
  days: Integer (天数)
  level: String (难度等级)
  content: String (详细内容)
}
```

#### API 接口
- `GET /api/plans` - 计划列表
- `GET /api/plans/{id}` - 计划详情

---

### 2.6 每日养生知识模块

#### 功能描述
每日推送一条养生小贴士，提供简单易行的健康建议。

#### 功能点
1. **每日推送**
   - 按日期自动匹配今日养生知识
   - 标题 + 内容形式
   - 内容简短实用 (1000字符以内)

2. **知识内容**
   - 饮水建议
   - 饮食技巧
   - 运动提醒
   - 作息指导

#### 数据模型
```
DailyTip {
  id: Long
  date: LocalDate (唯一)
  title: String (标题)
  content: String (内容)
}
```

#### API 接口
- `GET /api/tips/today` - 获取今日养生知识

---

### 2.7 管理员功能模块

#### 功能描述
提供基础的管理员能力，用于会员数据查询和管理。

#### 功能点
1. **会员查询**
   - 按管理员 Key 认证
   - 查询会员列表
   - 查看会员详情

#### API 接口
- `GET /api/admin/members?adminKey=xxx` - 查询会员列表 (需管理员Key)

---

## 三、页面结构

### 3.1 页面清单

| 页面路径 | 页面名称 | 功能说明 |
|---------|---------|---------|
| pages/home/home | 首页 | 资讯轮播、每日养生知识轮播、文章列表（排序/平台/日期搜索）、快捷入口 |
| pages/article-detail/article-detail | 文章详情 | 文章完整内容展示 |
| pages/recipes/recipes | 食谱列表 | 食谱搜索、筛选、列表展示（含推荐热门） |
| pages/recipe-detail/recipe-detail | 食谱详情 | 食谱详细信息展示 |
| pages/plan/plan | 健康计划 | 默认模板计划、计划列表与详情、每日提醒 |
| pages/checkin/checkin | 每日打卡 | 健康数据记录与查看 |
| pages/focus/focus | 专注力工具 | 舒尔特表格（3x3 到 10x10=100），练习/闯关/参考表/全网榜单 |
| pages/memo/memo | 备忘录+倒计时 | 备忘录增删改、倒计时设置与历史 |
| pages/mine/mine | 我的 | 用户信息、个人资料编辑（昵称/性别/年龄/头像）、健康工具入口 |

### 3.2 导航结构
```
首页 (Tab)
  ├─ 健康资讯轮播
  ├─ 每日养生知识轮播
  ├─ 快捷入口 (打卡/食谱/计划/专注力工具/备忘录)
  ├─ 搜索/排序/平台/日期过滤器
  └─ 文章列表（支持无限下拉）

养生食谱 (Tab / 从首页/我的进入)
  ├─ 搜索框
  ├─ 筛选器 (分类/功效/体质)
  └─ 食谱列表（支持无限下拉）→ 食谱详情

健康计划 (从首页/我的进入)
  ├─ 推荐计划（含默认模板）
  ├─ 我的计划（增删改 + 推荐开关）
  ├─ 每日提醒设置
  └─ 计划详情

专注力工具 (从首页进入)
  ├─ 练习模式 / 闯关模式
  ├─ 规格/难度/玩法选择
  ├─ 实时计时与成绩参考表
  └─ 历史记录 / 全网榜单

备忘录+倒计时 (从首页/我的进入)
  ├─ 备忘录列表（时间逆序）
  ├─ 新增/删除备忘录
  ├─ 倒计时设置（选日期时间）
  └─ 倒计时历史记录

每日打卡 (Tab)
  ├─ 今日打卡表单
  ├─ 日历视图
  └─ 连续签到 / 历史记录

我的 (Tab)
  ├─ 登录/退出
  ├─ 个人资料编辑（头像/昵称/性别/年龄）
  └─ 健康工具入口 / 云环境设置
```

---

## 四、技术实现

### 4.1 后端技术栈

| 技术 | 用途 |
|-----|------|
| 云开发 CloudBase 云函数 (Node.js) | 服务端逻辑、外部数据抓取、鉴权 |
| 云开发数据库 (NoSQL) | 用户、打卡、计划、收藏、缓存 |
| 云开发存储/日志 | 运行日志、问题排查（可选） |

### 4.2 前端技术栈

| 技术 | 用途 |
|-----|------|
| 微信小程序原生 | 前端框架 |
| WXML | 页面结构 |
| WXSS | 样式表 |
| JavaScript | 业务逻辑 |

### 4.3 项目结构

```
health/
├── health-miniapp-client/          # 微信小程序前端
│   ├── pages/                      # 页面目录
│   │   ├── home/                   # 首页
│   │   ├── article-detail/         # 文章详情
│   │   ├── recipes/                # 食谱列表
│   │   ├── recipe-detail/          # 食谱详情
│   │   ├── plan/                   # 健康计划
│   │   ├── checkin/                # 每日打卡
│   │   └── mine/                   # 我的
│   ├── utils/                      # 工具类
│   │   ├── auth.js                 # 认证相关
│   │   └── request.js              # HTTP请求封装
│   ├── app.js                      # 应用入口
│   ├── app.json                    # 应用配置
│   └── app.wxss                    # 全局样式
│
├── cloudbaserc.json                # CloudBase CLI 部署清单（可选）
```

### 4.4 数据库设计

#### 云开发集合清单（本项目实际使用）

- `user`：用户信息（由 `auth-login` 自动创建/更新）
- `daily_checkin`：每日打卡记录（今日/历史/连续签到计算）
- `health_plan`：健康计划（我的计划 CRUD + 推荐计划）
- `favorite`：收藏（文章收藏/取消/列表）
- `runtime_cache`：运行缓存（外部抓取结果、分页列表、详情缓存）

#### 集合字段（摘要）

```
user {
  openId: String
  unionId: String
  nickname: String
  avatarUrl: String
  memberLevel: String
  points: Number
  lastLoginAt: Date
  createdAt: Date
}

daily_checkin {
  userId: String (openid)
  dateStr: String (YYYY-MM-DD)
  date: Date
  waterMl: Number
  steps: Number
  sleepHours: Number
  mood: String
  note: String
  updatedAt: Date
  updatedAtMs: Number
}

health_plan {
  ownerId: String (openid)
  name: String
  summary: String
  content: String
  days: Number|null
  level: String
  isRecommended: Boolean
  createdAt: Date
  updatedAt: Date
}

favorite {
  userId: String (openid)
  type: String (article)
  targetId: String
  title: String
  link: String
  coverUrl: String
  createdAt: Date
}

runtime_cache {
  _id: String
  data: Any
  updatedAtMs: Number
}
```

#### 索引建议

- `user`
  - `openId`：唯一索引
- `daily_checkin`
  - `userId + dateStr`：复合索引（用于按日期字符串查询/排序）
  - `userId + date`：复合索引（兼容历史数据）
- `health_plan`
  - `ownerId + updatedAt`：复合索引（我的计划列表）
  - `isRecommended + updatedAt`：复合索引（推荐计划列表）
- `favorite`
  - `userId + type + targetId`：复合索引（收藏状态）
  - `userId + type + createdAt`：复合索引（收藏列表）
- `runtime_cache`
  - 默认 `_id` 主键即可

### 4.5 安全设计

#### 认证流程
1. 前端调用 `wx.getUserProfile` 获取昵称/头像（用户确认后）
2. 前端调用云函数 `auth-login`
3. 云函数通过 `getWXContext()` 获取 openid
4. 根据 openid 查找或创建用户信息（写入 `user` 集合）
5. 后续所有数据以 openid 为隔离维度（云函数内自行校验）

#### 安全机制
- Token 内存存储，7天过期
- 每次请求通过 `AuthFilter` 解析 Token
- 使用 `ThreadLocal` 存储当前用户ID
- 请求结束后清理上下文

### 4.6 配置管理

#### 环境配置
- **开发环境**: H2 内存数据库，自动建表
- **生产环境**: MySQL 数据库

#### 关键配置项
```yaml
server.port: 18082
wechat.appid: 微信公众号AppID
wechat.secret: 微信公众号AppSecret
admin.key: 管理员密钥
news.cacheSeconds: 600 (资讯缓存时间)
news.rss: RSS源列表
```

---

## 五、API 接口清单
（本项目使用云开发云函数，不提供独立 REST API。）

### 5.1 云函数清单
| 云函数 | 说明 |
|------|------|
| auth-login | 微信登录/创建用户 |
| news-latest | 热点榜单（健康资讯滚动） |
| article-list | 最新文章列表（分页/搜索） |
| article-detail | 文章详情 |
| tip-today | 每日养生知识（从缓存生成） |
| checkin-today | 今日打卡查询 |
| checkin-upsert | 今日打卡保存/更新 |
| checkin-history | 打卡历史 |
| recipe-list | 养生食谱列表（分页/搜索/筛选） |
| recipe-detail | 养生食谱详情 |
| plan-list | 推荐计划 + 我的计划 |
| plan-create | 新增计划 |
| plan-update | 编辑计划 |
| plan-delete | 删除计划 |
| plan-recommend-toggle | 推荐/取消推荐 |
| favorite-toggle | 收藏/取消收藏 |
| favorite-check | 批量查询收藏状态 |
| favorite-list | 收藏列表 |

### 5.6 计划相关
| 方法 | 路径 | 说明 | 认证 |
|-----|------|------|------|
| GET | /api/plans | 计划列表 | 否 |
| GET | /api/plans/{id} | 计划详情 | 否 |

### 5.7 养生知识
| 方法 | 路径 | 说明 | 认证 |
|-----|------|------|------|
| GET | /api/tips/today | 今日养生知识 | 否 |

### 5.8 健康资讯
| 方法 | 路径 | 说明 | 认证 |
|-----|------|------|------|
| GET | /api/news/latest | 最新健康资讯 | 否 |

### 5.9 管理员
| 方法 | 路径 | 说明 | 认证 |
|-----|------|------|------|
| GET | /api/admin/members | 会员列表 | 是 (adminKey) |

### 5.10 系统
| 方法 | 路径 | 说明 | 认证 |
|-----|------|------|------|
| GET | /api/ping | 服务健康检查 | 否 |

---

## 六、非功能性需求

### 6.1 性能要求
- 首页加载时间 < 2秒
- API 响应时间 < 500ms
- 资讯缓存 10 分钟，减少外部请求
- 分页查询单次最多 50 条记录

### 6.2 可用性要求
- 支持微信登录降级方案
- 数据库自动初始化种子数据
- H2 内存数据库支持开发环境快速启动

### 6.3 兼容性要求
- 微信小程序基础库 2.0+
- Java 17+
- Spring Boot 3.2.4+

### 6.4 安全性要求
- Token 机制保护用户数据
- 微信 openid 作为唯一身份标识
- 管理员接口需要 Key 认证
- CORS 跨域配置

---

## 七、数据初始化

### 7.1 种子数据
系统启动时自动初始化以下数据 (如数据库为空):

#### 文章数据
- 春季养生：作息与饮食的 3 个关键
- 每天喝多少水才够？

#### 食谱数据
- 温润红枣桂圆茶 (养生茶饮)
- 轻体鸡胸肉蔬菜沙拉 (日常正餐)

#### 健康计划
- 7 天睡眠改善计划
- 30 天综合生活习惯养成计划

#### 每日养生知识
- 5 条预设养生小贴士 (按日期生成)

---

## 八、未来规划

### 8.1 短期规划 (V1.1)
- [ ] 打卡数据统计与可视化 (图表展示)
- [ ] 连续打卡天数统计
- [ ] 打卡提醒功能 (微信订阅消息)
- [ ] 文章收藏功能
- [ ] 食谱收藏功能

### 8.2 中期规划 (V1.2)
- [ ] 用户健康报告生成 (周报/月报)
- [ ] 社交分享功能
- [ ] 健康目标设定与追踪
- [ ] 积分体系完善
- [ ] VIP 会员功能

### 8.3 长期规划 (V2.0)
- [ ] AI 健康顾问 (智能问答)
- [ ] 个性化推荐引擎
- [ ] 健康社区 (用户互动)
- [ ] 智能设备对接 (手环/手表)
- [ ] 多语言支持

---

## 九、腾讯云 CloudBase 无服务器部署方案

### 9.1 架构调整说明

#### 原架构问题
- 需要单独部署 Spring Boot 服务器
- 需要单独管理 MySQL 数据库
- 运维成本高，不适合小程序快速迭代

#### CloudBase 架构优势
- **零运维**: 无需管理服务器，自动扩缩容
- **一体化**: 云函数 + 云数据库 + 云存储完整生态
- **低成本**: 按量付费，免费额度充足
- **快速部署**: CLI 工具一键部署
- **天然适配**: 微信小程序深度集成

### 9.2 CloudBase 架构设计

```
微信小程序客户端
    ↓ (微信云开发 SDK)
CloudBase 云开发环境
    ├─ 云函数 (Node.js)
    │   ├─ auth-login (微信登录)
    │   ├─ article-list (文章列表)
    │   ├─ article-detail (文章详情)
    │   ├─ checkin-upsert (打卡保存)
    │   ├─ checkin-today (今日打卡)
    │   ├─ checkin-history (历史记录)
    │   ├─ recipe-list (食谱列表)
    │   ├─ recipe-detail (食谱详情)
    │   ├─ plan-list (计划列表)
    │   ├─ plan-detail (计划详情)
    │   ├─ tip-today (今日养生)
    │   └─ news-latest (健康资讯)
    │
    ├─ 云数据库 (MongoDB)
    │   ├─ user (用户表)
    │   ├─ article (文章表)
    │   ├─ daily_checkin (打卡表)
    │   ├─ recipe (食谱表)
    │   ├─ health_plan (计划表)
    │   └─ daily_tip (养生知识表)
    │
    └─ 云存储
        ├─ article-covers (文章封面)
        ├─ recipe-covers (食谱封面)
        └─ user-avatars (用户头像)
```

### 9.3 云函数改造方案 (Java → Node.js)

#### 为什么改用 Node.js
1. CloudBase 云函数原生支持 Node.js，启动速度快 (冷启动 < 100ms)
2. Java 在云函数中冷启动慢 (2-5秒)，内存占用高
3. Node.js 与微信小程序 SDK 天然兼容
4. 无需额外打包，部署更简单

#### 云函数目录结构
```
cloudfunctions/
├── auth-login/
│   ├── index.js
│   └── package.json
├── article-list/
│   ├── index.js
│   └── package.json
├── article-detail/
│   ├── index.js
│   └── package.json
├── checkin-upsert/
│   ├── index.js
│   └── package.json
├── recipe-list/
│   ├── index.js
│   └── package.json
└── ... (其他云函数)
```

#### 示例云函数: auth-login
```javascript
// cloudfunctions/auth-login/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { code, nickname, avatarUrl } = event;
  
  // 调用微信登录凭证校验
  const res = await cloud.openapi.auth.code2Session({
    js_code: code
  });
  
  if (res.errcode !== 0) {
    return { success: false, message: '登录失败' };
  }
  
  const { openid, unionid } = res;
  
  // 查询或创建用户
  const userQuery = await db.collection('user').where({ openId: openid }).get();
  
  let user;
  if (userQuery.data.length === 0) {
    // 新用户
    const newUser = {
      openId: openid,
      unionId: unionid || '',
      nickname: nickname || '',
      avatarUrl: avatarUrl || '',
      memberLevel: '普通',
      points: 0,
      vipUntil: null,
      lastLoginAt: db.serverDate(),
      createdAt: db.serverDate()
    };
    const addRes = await db.collection('user').add({ data: newUser });
    user = { id: addRes._id, ...newUser };
  } else {
    // 老用户，更新登录时间
    user = userQuery.data[0];
    await db.collection('user').doc(user._id).update({
      data: {
        lastLoginAt: db.serverDate(),
        nickname: nickname || user.nickname,
        avatarUrl: avatarUrl || user.avatarUrl
      }
    });
  }
  
  // 生成自定义登录态 (使用 cloud.getWXContext)
  const wxContext = cloud.getWXContext();
  
  return {
    success: true,
    token: wxContext.OPENID, // 简化方案，实际可用 JWT
    user: {
      id: user._id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      memberLevel: user.memberLevel,
      points: user.points
    }
  };
};
```

#### 示例云函数: checkin-upsert
```javascript
// cloudfunctions/checkin-upsert/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const userId = wxContext.OPENID;
  
  const { waterMl, steps, sleepHours, mood, note } = event;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 查询今日打卡记录
  const todayQuery = await db.collection('daily_checkin')
    .where({
      userId: userId,
      date: today
    })
    .get();
  
  const checkinData = {
    waterMl: waterMl || null,
    steps: steps || null,
    sleepHours: sleepHours || null,
    mood: mood || '',
    note: note || '',
    updatedAt: db.serverDate()
  };
  
  if (todayQuery.data.length === 0) {
    // 新增
    checkinData.userId = userId;
    checkinData.date = today;
    const res = await db.collection('daily_checkin').add({
      data: checkinData
    });
    checkinData.id = res._id;
  } else {
    // 更新
    const id = todayQuery.data[0]._id;
    await db.collection('daily_checkin').doc(id).update({
      data: checkinData
    });
    checkinData.id = id;
  }
  
  return {
    success: true,
    data: checkinData
  };
};
```

### 9.4 云数据库设计 (MongoDB)

#### 集合 (表) 结构

**user (用户表)**
```json
{
  "_id": "自动生成",
  "openId": "oXXXXX", (唯一索引)
  "unionId": "",
  "nickname": "张三",
  "avatarUrl": "https://...",
  "memberLevel": "普通",
  "points": 0,
  "vipUntil": null,
  "lastLoginAt": ISODate("2024-01-01T00:00:00Z"),
  "createdAt": ISODate("2024-01-01T00:00:00Z")
}
```

**article (文章表)**
```json
{
  "_id": "自动生成",
  "title": "春季养生：作息与饮食的 3 个关键",
  "summary": "从起居、饮食与运动三个维度...",
  "content": "详细内容...",
  "category": "四季养生",
  "tags": ["春季", "作息", "饮食"],
  "coverUrl": "https://...",
  "createdAt": ISODate("2024-01-01T00:00:00Z")
}
```

**daily_checkin (打卡表)**
```json
{
  "_id": "自动生成",
  "userId": "oXXXXX", (复合索引: userId + date)
  "date": ISODate("2024-01-01T00:00:00Z"),
  "waterMl": 1500,
  "steps": 8000,
  "sleepHours": 7.5,
  "mood": "开心",
  "note": "今天感觉很好",
  "updatedAt": ISODate("2024-01-01T12:00:00Z")
}
```

**recipe (食谱表)**
```json
{
  "_id": "自动生成",
  "name": "温润红枣桂圆茶",
  "summary": "暖胃安神...",
  "category": "养生茶饮",
  "effect": ["安神助眠", "暖胃"],
  "constitution": ["偏寒", "气虚"],
  "coverUrl": "https://...",
  "ingredients": "红枣 6-8 枚\n桂圆肉 4-6 颗...",
  "steps": "1）红枣洗净..."
}
```

**health_plan (计划表)**
```json
{
  "_id": "自动生成",
  "name": "7 天睡眠改善计划",
  "summary": "通过调整作息习惯改善睡眠质量",
  "days": 7,
  "level": "入门",
  "content": "周目标拆分：..."
}
```

**daily_tip (养生知识表)**
```json
{
  "_id": "自动生成",
  "date": ISODate("2024-01-01T00:00:00Z"), (唯一索引)
  "title": "每日养生：喝水分段更容易坚持",
  "content": "把目标拆成 4-5 次小目标..."
}
```

#### 数据库索引配置
```javascript
// 在云数据库控制台执行
db.collection('user').createIndex({ openId: 1 }, { unique: true });
db.collection('daily_checkin').createIndex({ userId: 1, date: 1 }, { unique: true });
db.collection('daily_tip').createIndex({ date: 1 }, { unique: true });
db.collection('article').createIndex({ createdAt: -1 });
db.collection('recipe').createIndex({ category: 1, effect: 1, constitution: 1 });
```

### 9.5 前端改造 (适配云开发)

#### 1. 修改 app.json 启用云开发
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
  "cloud": true  // 启用云开发
}
```

#### 2. 修改 app.js 初始化云开发
```javascript
App({
  globalData: {
    userId: null,
    openid: null
  },

  onLaunch() {
    // 初始化云开发
    wx.cloud.init({
      env: 'your-env-id', // 替换为你的云环境ID
      traceUser: true
    });

    // 检查登录状态
    const openid = wx.getStorageSync('openid');
    if (openid) {
      this.globalData.openid = openid;
      this.globalData.userId = wx.getStorageSync('userId');
    }
  }
});
```

#### 3. 改造 request 工具为云函数调用
```javascript
// utils/cloud.js
function callCloudFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: name,
      data: data,
      success: (res) => {
        if (res.result && res.result.success) {
          resolve(res.result.data || res.result);
        } else {
          reject(new Error(res.result && res.result.message || '调用失败'));
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

module.exports = {
  callCloudFunction
};
```

#### 4. 改造 auth.js
```javascript
// utils/auth.js
const app = getApp();
const { callCloudFunction } = require('./cloud');

async function ensureLogin() {
  if (app.globalData.openid) return app.globalData.openid;

  // 调用云函数登录
  const result = await callCloudFunction('auth-login', {
    code: await getWxLoginCode()
  });

  app.globalData.openid = result.user.id;
  app.globalData.userId = result.user.id;
  wx.setStorageSync('openid', result.user.id);
  wx.setStorageSync('userId', result.user.id);

  return result.user.id;
}

function getWxLoginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (res.code) resolve(res.code);
        else reject(new Error('wx.login failed'));
      },
      fail: () => reject(new Error('wx.login failed'))
    });
  });
}

module.exports = {
  ensureLogin
};
```

#### 5. 改造页面调用示例 (checkin.js)
```javascript
// pages/checkin/checkin.js
const { callCloudFunction } = require("../../utils/cloud");
const { ensureLogin } = require("../../utils/auth");

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
    await this.init();
  },

  async init() {
    this.setData({ loading: true });
    try {
      await ensureLogin();
      // 调用云函数查询今日打卡
      const today = await callCloudFunction('checkin-today');
      if (today) {
        const mood = today.mood || "";
        const moodIndex = Math.max(this.data.moods.indexOf(mood), 0);
        this.setData({
          moodIndex,
          lastSavedAt: today.updatedAt || "",
          form: {
            waterMl: today.waterMl == null ? "" : String(today.waterMl),
            steps: today.steps == null ? "" : String(today.steps),
            sleepHours: today.sleepHours == null ? "" : String(today.sleepHours),
            mood,
            note: today.note || ""
          }
        });
      }
    } catch (e) {
      wx.showToast({ title: "加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  async onSave() {
    this.setData({ saving: true });
    try {
      const form = this.data.form;
      await callCloudFunction('checkin-upsert', {
        waterMl: form.waterMl ? parseInt(form.waterMl) : null,
        steps: form.steps ? parseInt(form.steps) : null,
        sleepHours: form.sleepHours ? parseFloat(form.sleepHours) : null,
        mood: form.mood,
        note: form.note
      });
      wx.showToast({ title: "保存成功", icon: "success" });
      this.init();
    } catch (e) {
      wx.showToast({ title: "保存失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  }
});
```

### 9.6 数据库初始化脚本

在云数据库控制台导入种子数据:

```javascript
// 初始化文章数据
db.collection('article').add({
  data: [
    {
      title: "春季养生：作息与饮食的 3 个关键",
      summary: "从起居、饮食与运动三个维度，给出可落地的春季调养建议。",
      content: "详细内容...",
      category: "四季养生",
      tags: ["春季", "作息", "饮食", "运动"],
      coverUrl: "https://...",
      createdAt: new Date()
    },
    {
      title: "每天喝多少水才够？",
      summary: "科学饮水指南：分时段、分人群、分场景的饮水建议。",
      content: "详细内容...",
      category: "饮食养生",
      tags: ["饮水", "健康", "科普"],
      coverUrl: "https://...",
      createdAt: new Date()
    }
  ]
});

// 初始化食谱数据
db.collection('recipe').add({
  data: [
    {
      name: "温润红枣桂圆茶",
      summary: "暖胃安神，适合体质偏寒、易疲劳的人群。",
      category: "养生茶饮",
      effect: ["安神助眠", "暖胃"],
      constitution: ["偏寒", "气虚"],
      coverUrl: "https://...",
      ingredients: "红枣 6-8 枚\n桂圆肉 4-6 颗\n枸杞 一小把\n温水 400-500ml",
      steps: "1）红枣洗净、剪开或去核；桂圆肉与枸杞冲洗备用。\n2）将红枣、桂圆肉放入养生壶..."
    }
  ]
});

// 初始化健康计划
db.collection('health_plan').add({
  data: [
    {
      name: "7 天睡眠改善计划",
      summary: "通过调整作息习惯，一周内改善睡眠质量。",
      days: 7,
      level: "入门",
      content: "每日行动计划：..."
    },
    {
      name: "30 天综合生活习惯养成计划",
      summary: "从作息、饮食、运动与情绪四个维度综合调整。",
      days: 30,
      level: "进阶",
      content: "周目标拆分：..."
    }
  ]
});

// 初始化每日养生知识 (未来30天)
const tips = [
  { title: "每日养生：喝水分段更容易坚持", content: "把目标拆成 4-5 次小目标..." },
  { title: "每日养生：晚饭七分饱", content: "晚餐少一点、慢一点..." },
  // ... 更多数据
];

const today = new Date();
tips.forEach((tip, index) => {
  const date = new Date(today);
  date.setDate(date.getDate() + index);
  date.setHours(0, 0, 0, 0);
  
  db.collection('daily_tip').add({
    data: {
      date: date,
      title: tip.title,
      content: tip.content
    }
  });
});
```

### 9.7 成本估算 (按量付费)

#### 免费额度 (每月)
- **云函数**: 40 万次调用，40 万 GBs 资源使用
- **云数据库**: 2 GB 存储，5 万次读操作，5 万次写操作
- **云存储**: 5 GB 存储，10 GB 下载流量，50 万次读操作，10 万次写操作
- **CDN**: 5 GB 流量

#### 小程序初期 (1000 用户)
- 月活用户: 1000 人
- 日均调用: 5000 次
- 月调用量: 15 万次 (免费额度内)
- 存储: 约 500 MB (免费额度内)
- **月费用: 0 元** (完全免费)

#### 小程序成长期 (10000 用户)
- 月活用户: 10000 人
- 日均调用: 50000 次
- 月调用量: 150 万次 (超出免费额度)
- **月费用: 约 50-100 元**

### 9.8 部署工具准备

#### 安装 CloudBase CLI
```bash
# 安装 Node.js (如未安装)
# 下载地址: https://nodejs.org/

# 安装 CloudBase CLI
npm install -g @cloudbase/cli

# 登录腾讯云
tcb login
# 会打开浏览器，使用微信扫码登录
```

#### 创建配置文件
```json
// cloudbaserc.json
{
  "envId": "your-env-id",
  "$comments": "envId 替换为你的云环境ID",
  "functionRoot": "cloudfunctions",
  "functions": [
    {
      "name": "auth-login",
      "timeout": 10,
      "runtime": "Nodejs16.13",
      "memorySize": 256
    },
    {
      "name": "checkin-upsert",
      "timeout": 10,
      "runtime": "Nodejs16.13",
      "memorySize": 256
    }
    // ... 其他云函数配置
  ]
}
```

---

## 十、微信小程序上线部署完整步骤 (一步到位)

### 阶段一: 腾讯云 CloudBase 环境准备 (预计 30 分钟)

#### 步骤 1: 注册腾讯云账号并开通云开发
1. 访问 [腾讯云官网](https://cloud.tencent.com/)
2. 点击右上角「免费注册」，使用微信扫码注册
3. 注册完成后，访问 [云开发 CloudBase 控制台](https://console.cloud.tencent.com/tcb)
4. 点击「新建环境」
5. 填写环境信息:
   - **环境名称**: health-miniapp
   - **环境 ID**: 系统自动生成 (如: health-xxx)，记下这个 ID
   - **计费方式**: 选择「按量付费」
6. 点击「确定」，等待 2-3 分钟环境创建完成
7. 环境状态变为「正常」后，点击进入环境详情

**验证**: 看到环境详情页面，包含「云函数」「数据库」「云存储」等菜单项 ✅

#### 步骤 2: 安装 CloudBase CLI 并登录
1. 打开命令行工具 (Windows: PowerShell / Mac: Terminal)
2. 检查 Node.js 是否安装:
   ```bash
   node -v
   ```
   - 如果提示命令不存在，访问 [https://nodejs.org/](https://nodejs.org/) 下载 LTS 版本并安装
   - 安装完成后重新打开命令行，再次执行 `node -v` 确认版本号 (如: v18.17.0)

3. 安装 CloudBase CLI:
   ```bash
   npm install -g @cloudbase/cli
   ```
   - 等待安装完成，看到 `added xxx packages` 提示
   
4. 登录腾讯云:
   ```bash
   tcb login
   ```
   - 命令行会显示: "Opening browser to login..."
   - 自动打开浏览器，使用微信扫码授权登录
   - 登录成功后，命令行显示: "Login successful"

**验证**: 执行 `tcb --version` 能看到版本号 ✅

#### 步骤 3: 配置云环境
1. 在项目根目录创建 `cloudbaserc.json`:
   ```json
   {
     "envId": "health-xxx",
     "functionRoot": "cloudfunctions",
     "functions": [
       {
         "name": "auth-login",
         "timeout": 10,
         "runtime": "Nodejs16.13",
         "memorySize": 256
       },
       {
         "name": "article-list",
         "timeout": 10,
         "runtime": "Nodejs16.13",
         "memorySize": 256
       },
       {
         "name": "article-detail",
         "timeout": 10,
         "runtime": "Nodejs16.13",
         "memorySize": 256
       },
       {
         "name": "checkin-today",
         "timeout": 10,
         "runtime": "Nodejs16.13",
         "memorySize": 256
       },
       {
         "name": "checkin-upsert",
         "timeout": 10,
         "runtime": "Nodejs16.13",
         "memorySize": 256
       },
       {
         "name": "checkin-history",
         "timeout": 10,
         "runtime": "Nodejs16.13",
         "memorySize": 256
       },
       {
         "name": "recipe-list",
         "timeout": 10,
         "runtime": "Nodejs16.13",
         "memorySize": 256
       },
       {
         "name": "recipe-detail",
         "timeout": 10,
         "runtime": "Nodejs16.13",
         "memorySize": 256
       },
       {
         "name": "plan-list",
         "timeout": 10,
         "runtime": "Nodejs16.13",
         "memorySize": 256
       },
       {
         "name": "plan-detail",
         "timeout": 10,
         "runtime": "Nodejs16.13",
         "memorySize": 256
       },
       {
         "name": "tip-today",
         "timeout": 10,
         "runtime": "Nodejs16.13",
         "memorySize": 256
       },
       {
         "name": "news-latest",
         "timeout": 30,
         "runtime": "Nodejs16.13",
         "memorySize": 512
       }
     ]
   }
   ```
2. **重要**: 将 `"envId": "health-xxx"` 替换为你在步骤 1 中创建的环境 ID

**验证**: 执行 `tcb env:list` 能看到你的环境信息 ✅

---

### 阶段二: 云函数开发与部署 (预计 2 小时)

#### 步骤 4: 创建云函数目录结构
1. 在项目根目录创建 `cloudfunctions` 文件夹
2. 为每个云函数创建独立文件夹:
   ```
   cloudfunctions/
   ├── auth-login/
   ├── article-list/
   ├── article-detail/
   ├── checkin-today/
   ├── checkin-upsert/
   ├── checkin-history/
   ├── recipe-list/
   ├── recipe-detail/
   ├── plan-list/
   ├── plan-detail/
   ├── tip-today/
   └── news-latest/
   ```

**命令行快速创建**:
```bash
cd d:\nancal\code\health
mkdir cloudfunctions
cd cloudfunctions
mkdir auth-login article-list article-detail checkin-today checkin-upsert checkin-history recipe-list recipe-detail plan-list plan-detail tip-today news-latest
```

**验证**: 执行 `ls cloudfunctions` (或 `dir cloudfunctions`) 看到 12 个文件夹 ✅

#### 步骤 5: 编写云函数代码 (以 auth-login 为例)
1. 在 `cloudfunctions/auth-login/` 目录下创建 `index.js`:
   ```javascript
   const cloud = require('wx-server-sdk');
   cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
   
   const db = cloud.database();
   
   exports.main = async (event, context) => {
     const { code, nickname, avatarUrl } = event;
     
     try {
       // 调用微信登录凭证校验
       const res = await cloud.openapi.auth.code2Session({
         js_code: code
       });
       
       if (res.errcode !== 0) {
         return { 
           success: false, 
           message: res.errmsg || '登录失败' 
         };
       }
       
       const { openid, unionid } = res;
       
       // 查询或创建用户
       const userQuery = await db.collection('user').where({ openId: openid }).get();
       
       let user;
       if (userQuery.data.length === 0) {
         // 新用户
         const newUser = {
           openId: openid,
           unionId: unionid || '',
           nickname: nickname || '微信用户',
           avatarUrl: avatarUrl || '',
           memberLevel: '普通',
           points: 0,
           vipUntil: null,
           lastLoginAt: db.serverDate(),
           createdAt: db.serverDate()
         };
         const addRes = await db.collection('user').add({ data: newUser });
         user = { _id: addRes._id, ...newUser };
       } else {
         // 老用户，更新登录时间
         user = userQuery.data[0];
         await db.collection('user').doc(user._id).update({
           data: {
             lastLoginAt: db.serverDate(),
             nickname: nickname || user.nickname,
             avatarUrl: avatarUrl || user.avatarUrl
           }
         });
       }
       
       return {
         success: true,
         user: {
           id: user._id,
           nickname: user.nickname,
           avatarUrl: user.avatarUrl,
           memberLevel: user.memberLevel,
           points: user.points
         }
       };
     } catch (err) {
       console.error('Login error:', err);
       return { 
         success: false, 
         message: '系统异常，请稍后重试' 
       };
     }
   };
   ```

2. 创建 `package.json`:
   ```json
   {
     "name": "auth-login",
     "version": "1.0.0",
     "description": "",
     "main": "index.js",
     "dependencies": {
       "wx-server-sdk": "~2.6.3"
     }
   }
   ```

**验证**: 文件结构如下 ✅
```
cloudfunctions/auth-login/
├── index.js
└── package.json
```

#### 步骤 6: 编写其余云函数代码
按照步骤 5 的模板，编写其他 11 个云函数。

**核心逻辑参考**:
- **article-list**: `db.collection('article').skip(page*size).limit(size).orderBy('createdAt','desc').get()`
- **article-detail**: `db.collection('article').doc(id).get()`
- **checkin-upsert**: 先查询今日记录，存在则 update，不存在则 add
- **recipe-list**: 使用 `db.command` 实现多条件筛选
- **tip-today**: `db.collection('daily_tip').where({date: today}).get()`

**提示**: 可以先完成核心云函数 (auth-login, checkin-upsert, article-list)，其他后续补充。

#### 步骤 7: 安装云函数依赖并部署
1. 为每个云函数安装依赖:
   ```bash
   cd cloudfunctions/auth-login
   npm install
   cd ../article-list
   npm install
   # ... 依次对所有云函数执行
   ```

   **批量安装脚本 (PowerShell)**:
   ```powershell
   cd d:\nancal\code\health\cloudfunctions
   Get-ChildItem -Directory | ForEach-Object {
     Set-Location $_.FullName
     Write-Host "Installing dependencies for $($_.Name)..."
     npm install
   }
   ```

2. 部署单个云函数:
   ```bash
   cd d:\nancal\code\health
   tcb fn deploy auth-login
   ```
   - 等待部署完成，看到 "Function deploy success" 提示
   
3. 批量部署所有云函数:
   ```powershell
   cd d:\nancal\code\health
   Get-ChildItem -Path cloudfunctions -Directory | ForEach-Object {
     Write-Host "Deploying $($_.Name)..."
     tcb fn deploy $($_.Name)
   }
   ```

**验证**: 
- 访问 [云开发控制台](https://console.cloud.tencent.com/tcb)
- 进入「云函数」菜单，看到 12 个云函数，状态均为「已部署」✅
- 点击任一云函数，查看「运行日志」，确认无报错 ✅

---

### 阶段三: 云数据库初始化 (预计 30 分钟)

#### 步骤 8: 创建数据库集合
1. 访问 [云开发控制台](https://console.cloud.tencent.com/tcb)
2. 进入你的环境 → 「数据库」
3. 点击「+ 添加集合」，创建以下 6 个集合:
   - `user`
   - `article`
   - `daily_checkin`
   - `recipe`
   - `health_plan`
   - `daily_tip`

**验证**: 数据库列表中显示 6 个集合 ✅

#### 步骤 9: 创建数据库索引
1. 点击 `user` 集合 → 「索引管理」→ 「新建索引」
   - 索引名称: `idx_openid`
   - 索引字段: `openId`
   - 索引类型: 单字段索引
   - 是否唯一: ✅ 是
   - 点击「确定」

2. 点击 `daily_checkin` 集合 → 「索引管理」→ 「新建索引」
   - 索引名称: `idx_user_date`
   - 索引字段: 添加两个字段 `userId` 和 `date`
   - 索引类型: 复合索引
   - 是否唯一: ✅ 是
   - 点击「确定」

3. 点击 `daily_tip` 集合 → 「索引管理」→ 「新建索引」
   - 索引名称: `idx_date`
   - 索引字段: `date`
   - 索引类型: 单字段索引
   - 是否唯一: ✅ 是
   - 点击「确定」

4. 为 `article` 集合创建索引:
   - 索引名称: `idx_createdAt`
   - 索引字段: `createdAt`
   - 索引类型: 单字段索引，降序 (-1)

5. 为 `recipe` 集合创建索引:
   - 索引名称: `idx_category`
   - 索引字段: `category`
   - 索引类型: 单字段索引
   
   - 再创建 `idx_effect` (字段: `effect`)
   - 再创建 `idx_constitution` (字段: `constitution`)

**验证**: 每个集合的索引管理页面显示对应索引 ✅

#### 步骤 10: 导入种子数据 (两种方式选其一)

**方式 A: 使用控制台手动导入 (推荐新手)**
1. 在云开发控制台，点击 `article` 集合 → 「导入」
2. 选择 JSON 格式，上传以下数据:
   ```json
   [
     {
       "title": "春季养生：作息与饮食的 3 个关键",
       "summary": "从起居、饮食与运动三个维度，给出可落地的春季调养建议。",
       "content": "春季是养生的好时节...（完整内容）",
       "category": "四季养生",
       "tags": ["春季", "作息", "饮食", "运动"],
       "coverUrl": "https://images.unsplash.com/photo-1513639725746-c5d3e861f32a?auto=format&fit=crop&w=1200&q=60",
       "createdAt": { "$date": "2024-01-01T00:00:00Z" }
     },
     {
       "title": "每天喝多少水才够？",
       "summary": "科学饮水指南：分时段、分人群、分场景的饮水建议。",
       "content": "饮水是维持健康的基础...（完整内容）",
       "category": "饮食养生",
       "tags": ["饮水", "健康", "科普"],
       "coverUrl": "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=1200&q=60",
       "createdAt": { "$date": "2024-01-02T00:00:00Z" }
     }
   ]
   ```
3. 点击「确定」，等待导入完成

4. 依次对 `recipe`、`health_plan`、`daily_tip` 集合重复上述步骤，导入对应数据。

**方式 B: 使用云函数批量初始化 (推荐)**
1. 创建临时云函数 `init-data`:
   ```bash
   cd cloudfunctions
   mkdir init-data
   cd init-data
   ```

2. 创建 `index.js`:
   ```javascript
   const cloud = require('wx-server-sdk');
   cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
   const db = cloud.database();
   
   exports.main = async (event, context) => {
     try {
       // 初始化文章
       await db.collection('article').add({
         data: [
           {
             title: "春季养生：作息与饮食的 3 个关键",
             summary: "从起居、饮食与运动三个维度...",
             content: "详细内容...",
             category: "四季养生",
             tags: ["春季", "作息", "饮食", "运动"],
             coverUrl: "https://...",
             createdAt: new Date()
           }
         ]
       });
       
       // 初始化其他数据...
       
       return { success: true, message: '数据初始化成功' };
     } catch (err) {
       return { success: false, message: err.message };
     }
   };
   ```

3. 部署并执行:
   ```bash
   cd d:\nancal\code\health\cloudfunctions\init-data
   npm install
   cd d:\nancal\code\health
   tcb fn deploy init-data
   tcb fn run init-data
   ```

**验证**: 
- 在云开发控制台查看各集合数据条数:
  - `article`: 2 条 ✅
  - `recipe`: 2 条 ✅
  - `health_plan`: 2 条 ✅
  - `daily_tip`: 5-30 条 ✅

---

### 阶段四: 小程序前端改造 (预计 2 小时)

#### 步骤 11: 安装微信开发者工具
1. 访问 [微信开放平台](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 下载 Windows 稳定版 (Stable)
3. 运行安装程序，使用默认配置即可
4. 安装完成后，打开微信开发者工具
5. 使用微信扫码登录

**验证**: 微信开发者工具主界面正常显示 ✅

#### 步骤 12: 修改小程序项目配置启用云开发
1. 用任意代码编辑器打开 `d:\nancal\code\health\health-miniapp-client\app.json`
2. 添加 `"cloud": true` 配置:
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

**验证**: JSON 格式正确，无语法错误 ✅

#### 步骤 13: 修改 app.js 初始化云开发
1. 打开 `health-miniapp-client/app.js`
2. 替换为以下内容:
   ```javascript
   App({
     globalData: {
       userId: null,
       openid: null
     },
   
     onLaunch() {
       // 初始化云开发 - 重要: 替换为你的环境ID
       wx.cloud.init({
         env: 'health-xxx', // ← 替换为步骤 1 中的环境ID
         traceUser: true
       });
   
       // 检查登录状态
       const openid = wx.getStorageSync('openid');
       if (openid) {
         this.globalData.openid = openid;
         this.globalData.userId = wx.getStorageSync('userId');
       }
     }
   });
   ```
3. **重要**: 将 `'health-xxx'` 替换为你的云环境 ID

**验证**: 无语法错误 ✅

#### 步骤 14: 创建云开发工具类
1. 在 `health-miniapp-client/utils/` 目录下创建 `cloud.js`:
   ```javascript
   function callCloudFunction(name, data = {}) {
     return new Promise((resolve, reject) => {
       wx.cloud.callFunction({
         name: name,
         data: data,
         success: (res) => {
           if (res.result && res.result.success) {
             resolve(res.result.data || res.result);
           } else {
             reject(new Error(res.result && res.result.message || '调用失败'));
           }
         },
         fail: (err) => {
           reject(err);
         }
       });
     });
   }
   
   module.exports = {
     callCloudFunction
   };
   ```

2. 修改 `health-miniapp-client/utils/auth.js`:
   ```javascript
   const app = getApp();
   const { callCloudFunction } = require('./cloud');
   
   async function ensureLogin() {
     if (app.globalData.openid) return app.globalData.openid;
   
     const cached = wx.getStorageSync('openid');
     if (cached) {
       app.globalData.openid = cached;
       app.globalData.userId = wx.getStorageSync('userId');
       return cached;
     }
   
     // 调用云函数登录
     const code = await getWxLoginCode();
     const result = await callCloudFunction('auth-login', {
       code: code
     });
   
     app.globalData.openid = result.user.id;
     app.globalData.userId = result.user.id;
     wx.setStorageSync('openid', result.user.id);
     wx.setStorageSync('userId', result.user.id);
   
     return result.user.id;
   }
   
   function getWxLoginCode() {
     return new Promise((resolve, reject) => {
       wx.login({
         success: (res) => {
           if (res.code) resolve(res.code);
           else reject(new Error('wx.login failed'));
         },
         fail: () => reject(new Error('wx.login failed'))
       });
     });
   }
   
   module.exports = {
     ensureLogin
   };
   ```

**验证**: 文件保存成功，无语法错误 ✅

#### 步骤 15: 改造页面调用云函数 (以 checkin 为例)
1. 打开 `health-miniapp-client/pages/checkin/checkin.js`
2. 替换顶部引用:
   ```javascript
   // 原代码
   // const { request } = require("../../utils/request");
   // const { ensureUserId } = require("../../utils/auth");
   
   // 新代码
   const { callCloudFunction } = require("../../utils/cloud");
   const { ensureLogin } = require("../../utils/auth");
   ```

3. 修改 `init()` 方法:
   ```javascript
   async init() {
     this.setData({ loading: true });
     try {
       await ensureLogin();
       // 调用云函数查询今日打卡 (无需传 userId)
       const today = await callCloudFunction('checkin-today');
       if (today) {
         const mood = today.mood || "";
         const moodIndex = Math.max(this.data.moods.indexOf(mood), 0);
         this.setData({
           moodIndex,
           lastSavedAt: today.updatedAt || "",
           form: {
             waterMl: today.waterMl == null ? "" : String(today.waterMl),
             steps: today.steps == null ? "" : String(today.steps),
             sleepHours: today.sleepHours == null ? "" : String(today.sleepHours),
             mood,
             note: today.note || ""
           }
         });
       }
     } catch (e) {
       wx.showToast({ title: "加载失败", icon: "none" });
     } finally {
       this.setData({ loading: false });
     }
   }
   ```

4. 修改 `onSave()` 方法:
   ```javascript
   async onSave() {
     this.setData({ saving: true });
     try {
       const form = this.data.form;
       await callCloudFunction('checkin-upsert', {
         waterMl: form.waterMl ? parseInt(form.waterMl) : null,
         steps: form.steps ? parseInt(form.steps) : null,
         sleepHours: form.sleepHours ? parseFloat(form.sleepHours) : null,
         mood: form.mood,
         note: form.note
       });
       wx.showToast({ title: "保存成功", icon: "success" });
       this.init();
     } catch (e) {
       wx.showToast({ title: "保存失败", icon: "none" });
     } finally {
       this.setData({ saving: false });
     }
   }
   ```

5. 按照相同模式改造其他页面:
   - `pages/home/home.js` - 调用 `article-list`, `tip-today`, `news-latest`
   - `pages/article-detail/article-detail.js` - 调用 `article-detail`
   - `pages/recipes/recipes.js` - 调用 `recipe-list`
   - `pages/recipe-detail/recipe-detail.js` - 调用 `recipe-detail`
   - `pages/plan/plan.js` - 调用 `plan-list`, `plan-detail`

**验证**: 所有页面改造完成，无语法错误 ✅

#### 步骤 16: 本地测试云开发功能
1. 打开微信开发者工具
2. 点击「+」→ 导入项目
3. 选择目录: `d:\nancal\code\health\health-miniapp-client`
4. AppID 填写:
   - 如果已有小程序 AppID，填写你的 AppID
   - 如果没有，点击「测试号」使用测试号开发
5. 点击「确定」，项目导入成功
6. 等待编译完成，查看模拟器
7. 点击「去打卡」按钮，测试登录和打卡功能
8. 打开「调试器」→ 「Console」，查看日志输出
9. 确认云函数调用成功，数据正常显示

**验证**: 
- 模拟器正常显示首页 ✅
- 点击打卡能正常加载和保存数据 ✅
- 调试器 Console 无红色报错 ✅

---

### 阶段五: 小程序注册与上线 (预计 1 小时)

#### 步骤 17: 注册微信小程序账号 (如未注册)
1. 访问 [微信公众平台](https://mp.weixin.qq.com/)
2. 点击「立即注册」
3. 选择「小程序」
4. 填写账号信息:
   - 邮箱 (未注册过公众平台的邮箱)
   - 密码 (8-20位，包含字母和数字)
   - 确认密码
5. 点击「注册」
6. 邮箱激活: 登录邮箱点击激活链接
7. 选择主体类型:
   - 个人: 身份证信息 + 人脸识别 (免费，功能受限)
   - 企业: 营业执照 + 对公账户 (300元/年认证费)
8. 填写主体信息并完成验证
9. 填写小程序信息:
   - 小程序名称: 健康养生助手 (可自定义)
   - 小程序头像: 上传 logo
   - 小程序简介: 每日健康打卡，养生食谱推荐，助您养成健康生活习惯。
   - 服务类目: 医疗 > 健康管理 (或 工具 > 效率)
10. 完成注册，进入小程序管理后台
11. 记下 **AppID** (开发设置 > 开发者ID > AppID(小程序ID))

**验证**: 
- 能成功登录 [微信公众平台](https://mp.weixin.qq.com/) ✅
- 在「开发管理」>「开发设置」中看到 AppID ✅

#### 步骤 18: 配置小程序 AppID 和云环境
1. 打开 `d:\nancal\code\health\health-miniapp-client\project.config.json`
2. 修改 `appid` 字段:
   ```json
   {
     "appid": "wxYOUR_APPID_HERE",
     "projectname": "health-miniapp-client",
     ...
   }
   ```
3. 将 `"wxYOUR_APPID_HERE"` 替换为步骤 17 中的 AppID

4. 再次确认 `app.js` 中的云环境 ID 正确:
   ```javascript
   wx.cloud.init({
     env: 'health-xxx', // ← 确保这里正确
     traceUser: true
   });
   ```

**验证**: 
- `project.config.json` 中 appid 已更新 ✅
- `app.js` 中云环境 ID 已更新 ✅

#### 步骤 19: 配置服务器域名 (云开发无需配置)
**重要**: 使用云开发后，**无需**配置 request 合法域名，因为:
- 云函数调用走微信内部通道，不经过公网
- 云数据库访问也是内部通道
- 只有调用外部 API (如 RSS 新闻) 才需要配置

**如果需要外部 API** (可选):
1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入「开发管理」>「开发设置」
3. 找到「服务器域名」
4. 点击「修改」
5. 在「request合法域名」中添加:
   ```
   https://www.who.int
   https://tools.cdc.gov
   ```
6. 点击「保存并提交」

**验证**: 使用云开发可跳过此步骤 ✅

#### 步骤 20: 小程序代码上传与版本管理
1. 打开微信开发者工具，确保项目已打开
2. 点击右上角「上传」按钮 (或工具栏「上传」)
3. 填写版本信息:
   - **版本号**: 1.0.0 (语义化版本)
   - **项目备注**: 首次上传，包含首页、打卡、食谱、计划等核心功能
4. 点击「上传」
5. 等待上传完成 (显示「上传成功」)
6. 关闭开发者工具 (或保持打开)

**验证**: 
- 上传成功提示 ✅
- 可在「管理后台」>「版本管理」>「开发版本」中看到刚上传的版本 ✅

#### 步骤 21: 提交审核与发布上线 (关键步骤)
1. 访问 [微信公众平台](https://mp.weixin.qq.com/)
2. 登录你的小程序账号
3. 进入「版本管理」页面 (左侧菜单)
4. 在「开发版本」列表中，找到刚才上传的版本 (1.0.0)
5. 点击右侧「提交审核」按钮 (或「提交审核并反馈」)

6. **填写审核信息** (重要):
   - **功能页面**: 添加所有需要审核的页面:
     - `pages/home/home` (首页)
     - `pages/checkin/checkin` (每日打卡)
     - `pages/recipes/recipes` (养生食谱)
     - `pages/plan/plan` (健康计划)
     - `pages/mine/mine` (我的)
   
   - **测试账号**: 
     - 账号: (留空，如果无需登录)
     - 密码: (留空)
     - 说明: "小程序支持微信自动登录，无需输入账号密码"
   
   - **版本描述**: 
     ```
     健康养生助手小程序，提供以下功能:
     1. 健康资讯浏览与搜索
     2. 每日健康打卡 (饮水、步数、睡眠、心情)
     3. 养生食谱推荐与筛选
     4. 健康计划管理 (7天/30天计划)
     5. 每日养生知识推送
     
     技术架构: 微信小程序云开发 (无需外部服务器)
     ```

7. **隐私协议配置** (2024年起必须):
   - 进入「设置」>「基本设置」>「用户隐私保护指引」
   - 点击「更新」或「创建」
   - 选择采集的用户信息:
     - ✅ 微信登录 (用于用户身份识别)
     - ✅ 用户头像 (用于显示个人信息)
     - ✅ 用户昵称 (用于显示个人信息)
   - 填写隐私协议内容:
     ```
     本小程序会收集以下信息用于提供服务:
     1. 微信 OpenID: 用于用户身份识别和数据隔离，不会用于其他用途。
     2. 用户头像和昵称: 用于在"我的"页面展示个人信息，您可以随时修改。
     3. 健康数据 (饮水、步数、睡眠、心情): 仅存储在您的个人空间中，用于健康趋势分析，不会分享给第三方。
     
     我们承诺:
     - 所有数据存储在腾讯云服务器，采用加密传输。
     - 不会将您的数据用于商业目的或分享给第三方。
     - 您可以随时通过"我的"页面清除数据。
     ```
   - 点击「提交审核」
   
8. 返回「版本管理」，再次点击「提交审核」
9. 确认信息无误，点击「确认提交」
10. 等待审核结果:
    - 通常 1-7 个工作日 (实际往往 1-2 天)
    - 审核结果会通过「微信公众平台」站内信和服务通知告知
    - 也可在「版本管理」页面查看审核状态 (审核中/审核通过/审核不通过)
11. **审核通过后发布上线**:
    - 在「版本管理」>「审核版本」中，点击「发布」
    - 可选择「全量发布」或「灰度发布」(先放 10% 用户)
    - 点击「确认发布」
    - 小程序正式上线，所有用户可搜索和使用!

**验证**: 
- 提交审核成功 ✅
- 审核状态显示「审核中」✅
- (等待) 审核通过后状态变为「审核通过」✅
- 发布后状态变为「已上线」✅
- 手机微信搜索小程序名称，能正常打开和使用 ✅

---

### 阶段六: 上线后验证与维护 (持续)

#### 步骤 22: 上线后功能验证清单
1. **核心功能测试**:
   - ✅ 微信授权登录正常，能获取用户信息
   - ✅ 首页文章列表加载正常，能搜索和查看详情
   - ✅ 每日养生知识正常显示今日内容
   - ✅ 健康资讯轮播正常显示 (如有)
   - ✅ 快捷入口 (去打卡/养生食谱/健康计划) 跳转正常
   - ✅ 打卡页面能正常保存饮水、步数、睡眠、心情数据
   - ✅ 食谱列表能按分类/功效/体质筛选，能查看详情
   - ✅ 健康计划列表正常，能查看详情内容
   - ✅ "我的"页面显示用户信息和会员信息 (如有)
   
2. **性能测试**:
   - ✅ 首页加载时间 < 2 秒 (在 4G 网络下)
   - ✅ 打卡保存响应 < 1 秒
   - ✅ 列表滑动流畅，无明显卡顿
   
3. **兼容性测试**:
   - ✅ iOS 设备正常 (至少测试 iPhone 12+)
   - ✅ Android 设备正常 (至少测试华为/小米/OPPO 各一台)
   - ✅ 不同屏幕尺寸适配正常 (全面屏/非全面屏)

**验证方法**: 使用微信开发者工具的「真机调试」功能，扫码在真实手机上测试。

#### 步骤 23: 配置数据监控与告警 (可选)
1. 访问 [云开发控制台](https://console.cloud.tencent.com/tcb)
2. 进入你的环境 → 「统计监控」
3. 查看以下指标:
   - 云函数调用次数与成功率
   - 云数据库读写操作量
   - 云存储使用量与流量
   - 慢查询日志 (数据库查询 > 100ms)

4. 设置告警 (可选):
   - 进入「云监控」>「告警策略」
   - 创建告警策略:
     - 指标: 云函数错误率 > 5%
     - 通知方式: 短信/邮件/微信 (绑定你的账号)
   - 保存策略，确保异常时能收到通知

#### 步骤 24: 日常维护与迭代更新流程
**日常维护**:
- 每周登录云开发控制台，查看资源使用量和费用 (避免超额)
- 定期检查云函数日志，发现并修复异常 (云函数 → 日志)
- 每月备份云数据库数据 (数据库 → 备份与回档)
- 关注微信官方公告，了解小程序政策变化和 API 更新

**版本迭代更新流程**:
1. 在本地修改代码 (前端或云函数)
2. 云函数更新:
   ```bash
   tcb fn deploy 云函数名称
   ```
3. 前端更新:
   - 在微信开发者工具中测试修改内容 ✅
   - 点击右上角「上传」
   - 填写新版本号 (如: 1.0.1, 1.1.0, 2.0.0)
   - 填写更新说明 (如: 修复打卡页面数据显示问题)
4. 登录微信公众平台 → 版本管理 → 提交审核 → 发布上线 (同步骤 21)
5. 用户端会自动更新 (微信会缓存旧版本，通常 24 小时内全量更新)

---

## 十一、快速部署检查清单 (Checklist)

### 部署前准备 □
- [ ] 已注册腾讯云账号
- [ ] 已创建 CloudBase 环境，记下环境 ID (health-xxx)
- [ ] 已安装 Node.js 和 CloudBase CLI (`npm install -g @cloudbase/cli`)
- [ ] 已执行 `tcb login` 登录成功
- [ ] 已注册微信小程序账号，记下 AppID (如未注册)
- [ ] 已安装微信开发者工具并登录
- [ ] 已创建 `cloudbaserc.json` 并配置正确的 envId
- [ ] 已创建 12 个云函数目录结构 (`cloudfunctions/`)

### 云函数开发 □
- [ ] 已编写所有 12 个云函数的 `index.js` 和 `package.json`
- [ ] 已为每个云函数执行 `npm install` 安装依赖
- [ ] 已批量部署所有云函数 (`tcb fn deploy`)
- [ ] 已在云开发控制台确认所有云函数状态为「已部署」
- [ ] 已测试核心云函数运行正常 (auth-login, checkin-upsert)

### 云数据库初始化 □
- [ ] 已创建 6 个数据库集合 (user, article, daily_checkin, recipe, health_plan, daily_tip)
- [ ] 已为 user 集合创建 openId 唯一索引
- [ ] 已为 daily_checkin 集合创建 userId+date 复合唯一索引
- [ ] 已为 daily_tip 集合创建 date 唯一索引
- [ ] 已导入文章种子数据 (至少 2 条)
- [ ] 已导入食谱种子数据 (至少 2 条)
- [ ] 已导入健康计划种子数据 (至少 2 条)
- [ ] 已导入每日养生知识数据 (至少 5 条)

### 前端改造 □
- [ ] 已修改 `app.json` 添加 `"cloud": true`
- [ ] 已修改 `app.js` 初始化云开发 (填入正确的 envId)
- [ ] 已创建 `utils/cloud.js` 云函数调用工具
- [ ] 已修改 `utils/auth.js` 使用云函数登录
- [ ] 已改造所有页面调用云函数 (home, checkin, recipes, plan 等)
- [ ] 已在微信开发者工具本地测试通过 (无报错，功能正常)
- [ ] 已修改 `project.config.json` 填入正确的 AppID

### 上线审核 □
- [ ] 已在微信开发者工具上传代码 (版本号 1.0.0)
- [ ] 已配置用户隐私保护指引 (必须)
- [ ] 已在微信公众平台提交审核 (填写功能页面和版本描述)
- [ ] (等待) 审核通过 (1-7 个工作日)
- [ ] 审核通过后点击「发布」上线 ✅
- [ ] 手机微信搜索小程序名称验证功能正常 ✅
- [ ] 在多台设备 (iOS/Android) 测试兼容性 ✅

---

## 十二、常见问题排查 (FAQ)

### Q1: 云函数调用失败 "FunctionName parameter could not be found"
**原因**: 云函数未正确部署或环境 ID 不匹配  
**解决**: 
1. 确认云函数已部署: `tcb fn list`
2. 确认 `app.js` 中的 envId 与云开发控制台一致
3. 重新部署云函数: `tcb fn deploy 函数名`

### Q2: 数据库操作失败 "permission denied"
**原因**: 数据库权限未开放  
**解决**:
1. 访问云开发控制台 → 数据库 → 权限设置
2. 设置为「所有用户可读，仅创建者可读写」或「所有用户可读写」(开发阶段)
3. 生产环境建议设置为「仅创建者可读写」+ 云函数代理操作

### Q3: 小程序审核不通过 "类目不符"
**原因**: 选择的类目与实际功能不匹配  
**解决**:
1. 进入微信公众平台 → 设置 → 基本设置 → 服务类目
2. 修改为合适的类目:
   - 健康管理 → 医疗 > 健康管理 (需要资质)
   - 工具类 → 工具 > 效率 (无特殊要求，推荐)
3. 重新提交审核，在版本描述中说明 "本小程序为健康养生工具类应用，不提供医疗服务"

### Q4: 云函数冷启动慢 (首次调用 2-3 秒)
**原因**: Node.js 云函数冷启动正常现象  
**优化**:
1. 云函数内存设置为 256MB 或 512MB (越大启动越快)
2. 减少 `require` 的模块数量，避免引入不必要的依赖
3. 使用「定时触发器」保持云函数活跃 (每 5 分钟调用一次)
4. 实际使用中，用户连续操作不会有冷启动问题

### Q5: 本地测试正常，真机调试失败 "云开发未初始化"
**原因**: 真机调试时需要重新初始化云开发  
**解决**:
1. 确认 `app.js` 中 `wx.cloud.init` 在 `onLaunch` 最前面执行
2. 确认 envId 正确，且该环境已开通云函数和数据库权限
3. 在真机调试模式下，打开调试器查看 Console 是否有报错
4. 尝试删除小程序重新添加 (长按小程序图标 → 删除)

---

## 十三、项目总结与下一步行动
```bash
# 后端启动
cd health-miniapp-server
mvn spring-boot:run

# 前端开发
使用微信开发者工具打开 health-miniapp-client 目录
```

### 9.2 生产环境
```bash
# 打包
mvn clean package -DskipTests

# 运行
java -jar target/health-miniapp-server.jar --spring.profiles.active=prod
```

### 9.3 数据库切换
- 开发环境: `spring.profiles.active=dev` (H2)
- 生产环境: `spring.profiles.active=prod` (MySQL)

---

## 十、已知问题与优化建议

### 10.1 当前问题
1. **Token 存储**: 使用内存存储，服务重启会丢失，建议改为 Redis
2. **打卡接口**: 未使用 Token 认证，直接传 userId 存在安全隐患
3. **资讯源**: RSS 源为英文，不符合中文用户习惯
4. **数据校验**: 部分接口缺少完善的参数校验
5. **异常处理**: 全局异常处理不够完善

### 13.4 后续优化建议 (优先级排序)
**高优先级 (上线后立即做)**:
1. 增加云函数错误监控和告警 (云开发控制台 → 统计监控)
2. 添加云函数日志分析，排查慢查询和异常调用
**中优先级 (1-2 个月内)**:
3. 完善前端加载状态 (骨架屏、loading 动画)
4. 增加用户反馈入口 (意见反馈表单)
5. 优化健康资讯源，替换为中文权威来源 (如丁香医生、健康中国)
**低优先级 (3-6 个月)**:
6. 实现打卡数据统计与可视化 (使用图表库展示趋势)
7. 增加连续打卡天数统计和成就系统
---

---

## 十三、项目总结与下一步行动

### 13.1 项目亮点 (CloudBase 架构)
- ✅ **零服务器运维**: 无需购买和管理云服务器，完全由腾讯云托管
- ✅ **按量付费**: 初期 1000 用户完全免费，成长期月费仅 50-100 元
- ✅ **自动扩缩容**: 高并发时自动扩容，无需手动干预
- ✅ **微信生态深度集成**: 云开发 SDK 原生支持，一键调用微信能力
- ✅ **快速迭代**: 云函数部署秒级完成，支持敏捷开发
- ✅ 架构清晰，前后端分离设计
- ✅ 微信登录集成，用户体验流畅
- ✅ 种子数据自动初始化，开箱即用
- ✅ 支持 RSS 资讯聚合，内容实时更新

### 13.2 技术架构对比
- Spring Boot 3.2.4 最新稳定版本
- JPA + Hibernate 简化数据访问
- 微信小程序原生开发，性能优秀
- Token 认证机制保证安全性
- 多环境配置支持 (H2/MySQL)

### 13.3 适用场景
- 健康管理类应用快速原型开发
- 微信小程序开发学习项目
- Spring Boot 实战案例
- 个人健康追踪工具

---

**文档版本**: V1.0  
**创建日期**: 2026-04-24  
**最后更新**: 2026-04-24

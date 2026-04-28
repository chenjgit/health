# CloudBase 数据库与云函数部署说明

## 1. 云函数清单

在 `health-miniapp-client/cloudfunctions/` 下部署以下云函数：

- 登录与用户
  - `auth-login`
- 首页与文章（外部抓取 + 缓存）
  - `news-latest`（热点榜单）
  - `article-list`（最新文章列表，支持分页/搜索）
  - `article-detail`（文章详情，返回摘要与原文链接）
  - `tip-today`（每日知识，从缓存内容生成）
- 打卡
  - `checkin-today`
  - `checkin-upsert`
  - `checkin-history`
- 食谱（外部抓取 + 缓存）
  - `recipe-list`（支持分页/搜索/筛选参数）
  - `recipe-detail`（抓取详情页解析）
- 计划（CRUD + 推荐）
  - `plan-list`
  - `plan-create`
  - `plan-update`
  - `plan-delete`
  - `plan-recommend-toggle`
- 收藏
  - `favorite-toggle`
  - `favorite-check`
  - `favorite-list`

## 2. 数据库集合（需要手动创建）

在云开发控制台 → 数据库 → 新建集合：

- `user`
- `daily_checkin`
- `health_plan`
- `favorite`
- `runtime_cache`（外部抓取缓存、列表分页缓存、详情缓存）

## 3. 推荐索引

- `user`
  - `openId`（唯一索引）
- `daily_checkin`
  - `userId + dateStr`（复合索引）
  - `userId + date`（如历史数据仍使用 Date 字段）
- `health_plan`
  - `ownerId + updatedAt`（复合索引）
  - `isRecommended + updatedAt`（复合索引）
- `favorite`
  - `userId + type + targetId`（复合索引）
  - `userId + type + createdAt`（复合索引）
- `runtime_cache`
  - 默认 `_id` 主键即可

## 4. 部署云函数

建议在微信开发者工具的「云开发」面板中逐个上传，或使用 CloudBase CLI 批量部署。

注意点：
- 若控制台报错 `-504002 functions execute fail` 且包含 `Cannot find module 'wx-server-sdk'`，说明云端缺少依赖包，需要先安装依赖再重新上传云函数。
- 新增云函数目录后，需要先为该函数目录执行一次 `npm install`（依赖为 `wx-server-sdk`），或在开发者工具上传时勾选“云端安装依赖”。
- 外部抓取依赖云函数出网能力；若云环境禁用出网或目标站点不可达，会导致对应列表为空。

### 4.1 一键安装所有云函数依赖（Windows）

在项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-cloudfunction-deps.ps1
```

执行完成后，在微信开发者工具中对 `health-miniapp-client/cloudfunctions/` 重新“上传并部署”全部云函数。

## 5. 性能策略

- 云函数侧：
  - 热点榜单/文章列表/食谱列表等均写入 `runtime_cache`，设置 TTL，减少重复抓取。
  - 请求超时控制在 1.5–2.5s 范围内，避免拖慢首屏。
- 小程序侧：
  - 首页/食谱列表优先读取本地缓存（上一轮成功结果），再异步刷新。
  - 列表统一采用分页 + 触底加载，避免一次性拉取大数据。

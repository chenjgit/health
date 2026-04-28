# 小程序合法域名配置（无需云函数也可运行）

当云函数不可用时，项目会自动改为由小程序端直接请求公开接口/站点以获取中文热门内容与食谱数据。此时需要在微信公众平台配置请求合法域名，否则会出现 `request:fail url not in domain list` 等错误。

## 需要添加的域名

在微信公众平台 → 开发 → 开发管理 → 开发设置 → 服务器域名：

### request 合法域名
- https://news-at.zhihu.com
- https://www.xiachufang.com
- https://sspai.com
- https://www.huxiu.com
- https://36kr.com
- https://juejin.cn

### webview 业务域名
用于“查看原文”打开 WebView：
- https://daily.zhihu.com
- https://www.xiachufang.com
- https://sspai.com
- https://www.huxiu.com
- https://36kr.com
- https://juejin.cn

## 验证

- 首页“健康资讯/最新文章”能正常加载中文内容
- 点击文章可进入详情页并显示正文（知乎日报）
- 食谱列表可搜索并无限下拉加载

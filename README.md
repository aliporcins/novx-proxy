# novx-proxy

NOVX 播放器自用 Emby 反代：一个极简 Cloudflare Worker，把请求转发到你自己的 Emby 服务器。

## 一键部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/aliporcins/novx-proxy)

点按钮 → 用你自己的 Cloudflare 账号登录授权 → Cloudflare 从 GitHub 拉取代码并部署到你的账号下。部署不需要交出你的 Cloudflare 账号密码（走 OAuth 授权）。

## 部署后设置（两步）

### 1. 设置上游地址

到 Cloudflare 面板 → Workers 和 Pages → 找到 `novx-proxy` → Settings → Variables，添加一个变量：

- 变量名：`UPSTREAM_URL`
- 变量值：你自己的 Emby 服务器地址，例如 `https://你的Emby服务器:8096`（Emby 装在子路径下也可以把路径带上）

保存后重新部署一次（或等下一次部署）即生效。

### 2. 播放器里填反代地址

在 NOVX 播放器里添加 Emby 服务器时，在反代地址一栏填你自己的 Worker 地址，例如 `https://novx-proxy.你的子域名.workers.dev`。播放器此后经这个反代访问你的 Emby。

## 工作原理（极简）

- 只转发到 `UPSTREAM_URL` 这一个上游：请求的方法、路径、查询、请求头（除 Host 外）、请求体原样透传，响应的状态、头、体原样返回；Range 分段请求原样透传，视频拖动（206）正常工作。
- 防开放中继：目标主机只认 `UPSTREAM_URL`，绝不从请求参数、请求头、路径里取目标，别人没法拿你的反代去转别人的站。
- 本版不代理 WebSocket；不带管理面板、不带机器人、不需要 D1/KV。

## 警告

- 只供个人自用，不要公开分发你自己的反代地址。
- 不要把 `UPSTREAM_URL` 指向别人的服务器，只指向你自己的 Emby。

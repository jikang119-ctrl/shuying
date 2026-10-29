# 部署到阿里云 ECS（给接手的 AI / 康康自己）

纯静态站，nginx 直接发文件，服务器上不需要 Node / Python。整个过程大约 5 分钟。

## 服务器

| 项 | 值 |
|---|---|
| 实例 | launch-advisor-20261027，华南 3（广州），2 核 2G，Ubuntu 26.04 |
| 公网 IP | 8.163.12.169 |
| 带宽 | 峰值 100 Mbps，**按流量计费** |
| 登录 | `ssh root@8.163.12.169`（密码登录；公钥还没装） |

⚠️ 公司网络（genscript Wi-Fi）拦了外网 SSH，**要在家里网络或手机热点下操作**。

## 步骤

### 1. 登上服务器

```bash
ssh root@8.163.12.169
```

可选但建议：顺手把本机公钥装上，以后免密码。

```bash
# 在本机（不是服务器）执行
ssh-copy-id root@8.163.12.169
```

### 2. 拿到代码

仓库是私有的（里面有照片），服务器 clone 要带凭据。三选一：

**A. 用 GitHub token（最省事）**

```bash
apt-get update -y && apt-get install -y git
git clone https://github.com/jikang119-ctrl/shuying.git ~/shuying
# 提示 Username 填 jikang119-ctrl，Password 填一个 GitHub token（不是登录密码）
# token 在 https://github.com/settings/tokens 生成：fine-grained，只勾这个仓库的 Contents: Read-only
```

**B. 本机打包再传上去（服务器不碰 GitHub）**

```bash
# 本机
git clone https://github.com/jikang119-ctrl/shuying.git && cd shuying
tar czf shuying.tgz site deploy
scp shuying.tgz root@8.163.12.169:~
# 服务器
mkdir -p ~/shuying && tar xzf ~/shuying.tgz -C ~/shuying
```

**C. 服务器上 `gh auth login`**（装 gh 比较麻烦，不推荐）

### 3. 一键安装

```bash
cd ~/shuying
PASSCODE=0828 bash deploy/install.sh
```

脚本会做：装 nginx → 检查 80 端口有没有被别的程序占 → 把 `site/` 拷到 `/var/www/shuying` → 生成 `/etc/nginx/conf.d/shuying.conf` → `nginx -t` → 重载 → 自检。

最后一行打印「部署好了：http://8.163.12.169/」就成功了。自检三项必须是 `302 / 204 / 200`。

- 80 端口被占（脚本会停下并打印占用的程序）：换端口 `PORT=8080 PASSCODE=0828 bash deploy/install.sh`，安全组也放行 8080。
- `PASSCODE` 是进门的四位数，默认 `0828`（认识那天）。想换就换，只能是 4 位数字。

### 4. 阿里云安全组放行 80

控制台 → 云服务器 ECS → 实例 → launch-advisor-20261027 → 安全组 → 配置规则 → 入方向 → 手动添加：

| 授权策略 | 优先级 | 协议类型 | 端口范围 | 授权对象 |
|---|---|---|---|---|
| 允许 | 1 | 自定义 TCP | 80/80 | 0.0.0.0/0 |

### 5. 手机上验收

用手机浏览器（Safari / Chrome，**不要在微信里直接点**，见下面「风险」）打开 `http://8.163.12.169/`：

1. 先看到深色的密码页，输入 `0828` 自动进去
2. 封面照片像冲洗一样慢慢显出来，手指擦过的地方先显
3. 一路往下翻到「尾声」，横滑的几章都能左右划

## 以后更新内容

本机改完、push 之后，在服务器上：

```bash
cd ~/shuying && git pull && PASSCODE=0828 bash deploy/install.sh
```

（用的是方式 B 就重新打包上传，再跑同一条 install.sh。）

## 撤销

```bash
rm /etc/nginx/conf.d/shuying.conf
cp -a /root/nginx-default-site.bak /etc/nginx/sites-enabled/default   # 脚本停用过 default 站点才有这个备份
nginx -t && systemctl reload nginx
rm -rf /var/www/shuying
```

## 风险和限制

| 风险 | 影响 | 怎么办 |
|---|---|---|
| 没有备案，只能用 IP 访问 | 国内服务器绑域名必须先 ICP 备案，否则阿里云会拦截；直接用 IP 访问一般不拦（置信度：中） | 先用 IP；想要域名就走备案（约 1–3 周） |
| 微信内置浏览器可能拦裸 IP 链接 | 发给她的链接在微信里点开可能提示「无法打开」或「非官方网页」 | 让她长按复制，用 Safari 打开；或者把链接存成手机桌面书签 |
| 只有 HTTP，没有 HTTPS | 进门数字以明文 cookie 传输；这是一扇门不是保险柜 | 有域名并备案后再上 HTTPS（certbot） |
| 按流量计费 | 首次完整看一遍约 6–10 MB（照片都是压过的 WebP，按屏幕大小只取需要的那一档）；乱试密码的请求会被限速 | 控制台设一个费用预警 |
| 密码只有 4 位 | 没进门的 IP 每分钟最多试 10 次（nginx 限速，本机实测连试几次后返回 429，带对密码的请求不受影响），挨个试完要十几个小时 | 想更稳就换成更长的数字串，`lock.html` 里 `maxlength` 和格子数要一起改 |

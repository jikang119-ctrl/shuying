# 部署到阿里云 ECS（给接手的 AI / 康康自己）

网站本身是静态的，nginx 直接发文件；另有一个只用 Python 标准库的小后端收「回信」（Ubuntu 自带 python3，不用装包）。整个过程大约 5 分钟。

## 服务器

| 项 | 值 |
|---|---|
| 实例 | launch-advisor-20261027，华南 3（广州），2 核 2G，Ubuntu 26.04 |
| 公网 IP | 8.163.12.169 |
| 带宽 | 峰值 100 Mbps，**按流量计费** |
| 登录 | `ssh root@8.163.12.169`（密码登录；公钥还没装） |

⚠️ 公司网络（genscript Wi-Fi）拦了外网 SSH，**要在家里网络或手机热点下操作**。

## 从另一台电脑做完整套

给接手的 AI：按顺序做，每步的「要看到」对上了再往下走。下面各节是细节，这里是总清单。

代码在 [jikang119-ctrl/shuying](https://github.com/jikang119-ctrl/shuying)，歌在 [jikang119-ctrl/shuying-music](https://github.com/jikang119-ctrl/shuying-music)（198 个文件 1.81 GB），都是私有仓库。**不用再从飞书下压缩包**，压缩包只在 GitHub 拉不下来时兜底（第 4 步 C）。

**现状（2026-10-30 从外面探的）**：服务器上已经装过一版唱片柜之前的站：`/` 会跳密码页，`/music.html` 是 404。进门数字**不是 0828**（带 `shuying=0828` 还是跳密码页）。现在的 install.sh 不给 `PASSCODE` 就沿用服务器上的，所以**重跑时别写 `PASSCODE=0828`**，不然她手机上存的就失效了。

### 1. 本机要有

| 要什么 | 用来 | 怎么装 / 检查 |
|---|---|---|
| Git + GitHub 权限 | 拉两个私有仓库（账号 jikang119-ctrl） | `git clone https://github.com/jikang119-ctrl/shuying.git` 能拉下来 |
| Python 3.10+ | 核对歌齐不齐（check_music.py 只用标准库） | `python --version` |
| ssh / scp | 登服务器、传东西 | Windows 10/11 自带 |
| 家里网络或热点 | 公司网拦 SSH | 第 4 步走 B 要上传 1.8 GB，热点会吃掉这么多流量 |
| 服务器 root 密码 | 登录 | 找康康要，**别写进任何文件** |
| GitHub token | 服务器上 git pull 代码、直接拉歌 | https://github.com/settings/tokens → Fine-grained → Repository access 选 shuying 和 shuying-music → Contents: Read-only；**别写进任何文件** |

### 2. 拿代码

```powershell
git clone https://github.com/jikang119-ctrl/shuying.git D:\projects\shuying
cd D:\projects\shuying
```

### 3. 服务器：更新站点

```bash
ssh root@8.163.12.169
grep PASSCODE /etc/shuying/letters.env || grep -A3 'map $cookie_shuying' /etc/nginx/conf.d/shuying.conf   # 记下现在的进门数字，验收要用
ls -d ~/shuying/.git 2>/dev/null && echo 方式A || echo 方式B
```

- **方式 A**（服务器上是 git clone 的）：`cd ~/shuying && git pull`（Username 填 jikang119-ctrl，Password 填 GitHub token）
- **方式 B**（当初是打包传的）：本机仓库根目录 `tar czf shuying.tgz site deploy` → `scp shuying.tgz root@8.163.12.169:~` → 服务器 `rm -rf ~/shuying/site ~/shuying/deploy && mkdir -p ~/shuying && tar xzf ~/shuying.tgz -C ~/shuying`（先删旧的，不然删掉的文件会残留）

然后：

```bash
cd ~/shuying && bash deploy/install.sh       # 不写 PASSCODE，沿用现在的
```

**要看到**：自检四项 `302 / 204 / 200 / 200`，最后一行「部署好了……进门数字：xxxx」和上面查到的一样。读信码也会沿用。

### 4. 传歌

先在服务器上 `df -h /`，剩余要大于 6 GB。三种方式，按顺序试：

**A. 服务器直接从 GitHub 拉**（不占家里的上传流量；国内服务器连 GitHub 可能很慢，推断，没实测过）

```bash
git clone --depth 1 https://github.com/jikang119-ctrl/shuying-music.git /root/shuying-music
#   Username 填 jikang119-ctrl，Password 填 GitHub token
#   看 Receiving objects 那行的速度：一直低于 1 MiB/s 就 Ctrl+C、rm -rf /root/shuying-music，改用 B
cp /root/shuying-music/*.mp3 /root/shuying-music/*.m4a /var/www/shuying/music/
chown -R www-data:www-data /var/www/shuying/music && find /var/www/shuying/music -type f -exec chmod 644 {} +
ls /var/www/shuying/music | wc -l      # 要 198
rm -rf /root/shuying-music
```

**B. 本机 clone 再 scp 上去**（家里网络）

```powershell
# --separate-git-dir 把 git 数据放到 D:\shuying-music.git，D:\shuying-music 里只剩歌和三个小文件，scp 不会多传 1.8 GB
git clone --separate-git-dir=D:\shuying-music.git https://github.com/jikang119-ctrl/shuying-music.git D:\shuying-music
python -X utf8 tools/check_music.py --dir D:/shuying-music      # 在 D:\projects\shuying 里跑，要打印「齐了」
scp -r D:\shuying-music root@8.163.12.169:/var/www/shuying/music-upload
```

传完照下面「唱片柜」一节，在服务器上挪进 `music/`。

**C. GitHub 拉不下来：用飞书里的压缩包**

压缩包在康康个人知识库的飞书文档《蔡依林》里，是两个附件。另外要装 ffmpeg（放进 PATH）、7-Zip、`pip install mutagen opencc-python-reimplemented`。先核对是不是同一份：

| 附件 | 字节数 | SHA-256 |
|---|---|---|
| 熊猫无损「蔡依林合集」195 首 rar（原机上叫 `jolin195.rar`） | 1,783,980,082 | `5a1421d28218003f29ca13b1ddb246d9a805aac355ce83d8bb9957b4675ccfd5` |
| 《Pleasure》zip（原机上叫 `pleasure.zip`） | 70,304,535 | `d9272d12868011ad9be4cf5e98ab411e6056ca8f1e510a4dc2edff24d5445a07` |

```powershell
Get-FileHash <rar的路径>, <zip的路径> -Algorithm SHA256
& 'C:\Program Files\7-Zip\7z.exe' x -y -oD:\jolin-raw\x195 <rar的路径>
& 'C:\Program Files\7-Zip\7z.exe' x -y -oD:\jolin-raw\xpl  <zip的路径>
python -X utf8 tools/music.py --src D:/jolin-raw --out D:/shuying-music     # 认歌名、去水印标签、按歌名哈希改名，几分钟
python -X utf8 tools/check_music.py --dir D:/shuying-music                  # 要「齐了」
git status                                                                  # content/music-catalog.json 要没有改动
```

两个都对上，整理出来的 198 个文件和 shuying-music 仓库逐字节一致（2026-10-30 在原机上从空目录重做过）。然后照 B 的 scp 传上去。对不上（压缩包不是同一份、或者缺文件）：照「唱片柜」一节末尾「以后补了新歌」那四条命令重新生成 `music.json`（要装 Node 18+ 和 `pip install fonttools brotli`），check_music 要「齐了」，再提交 push。

**要看到**（哪种方式都一样）：服务器上 `ls /var/www/shuying/music | wc -l` 是 198，`chown -R www-data:www-data /var/www/shuying/music` 做过。

### 5. 验收

本机 PowerShell（`curl.exe`，不是 PowerShell 的 curl 别名）：

```powershell
$c = 'shuying=<进门数字>'; $h = 'http://8.163.12.169'
curl.exe -s -o NUL -w "%{http_code} 首页`n"     -b $c "$h/"
curl.exe -s -o NUL -w "%{http_code} 唱片柜`n"   -b $c "$h/music.html"
curl.exe -s -o NUL -w "%{http_code} 曲库`n"     -b $c "$h/assets/data/music.json"
curl.exe -s -o NUL -w "%{http_code} 一首歌`n"   -b $c -r 0-1023 "$h/music/1085e5d6c4.mp3"
curl.exe -s -o NUL -w "%{http_code} 没进门`n"   "$h/music.html"
```

**要看到**：`200 200 200 206 302`。

手机上（Safari / Chrome，别在微信里点开）：

1. 打开 `http://8.163.12.169/` → 密码页 → 输进门数字
2. 封面右上角有「唱片柜 →」，右下角一张小唱片，旁边写「点一下　放一首你爱听的」
3. 点一下屏幕任意处 → 小唱片转起来，冒出歌名，有声音
4. 点小唱片 → 弹出卡片：暂停 / 换一首 / 唱片柜，都能用
5. 翻到「七 骑士」点歌单里一首 → 右下角那首停下，换成这首
6. 进唱片柜 → 点一本书 → 点一首 → 能放、能拖进度，锁屏能控制
7. 尾声的写信框点进去 → 右下角小唱片让开，不挡输入

全部对上就是部署好了。告诉康康：网址、进门数字（没变）、读信码（install.sh 最后一行）。

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
# token 在 https://github.com/settings/tokens 生成：fine-grained，勾 shuying 和 shuying-music 两个仓库，Contents: Read-only
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
PASSCODE=0828 bash deploy/install.sh      # 全新的服务器才写 PASSCODE；装过的直接 bash deploy/install.sh
```

脚本会做：装 nginx / python3 → 检查 80 端口有没有被别的程序占 → 把 `site/` 拷到 `/var/www/shuying` → 装回信后端（systemd 服务 `shuying-letters`）→ 生成 `/etc/nginx/conf.d/shuying.conf` → `nginx -t` → 重载 → 自检。

最后打印「部署好了：http://8.163.12.169/　进门数字：xxxx」和「收信页 + 读信码」就成功了。自检四项必须是 `302 / 204 / 200 / 200`。

**读信码要记下来**：第一次装会随机生成 6 位数并打印出来，以后重跑脚本会沿用（存在 `/etc/shuying/letters.env`）。想自己定就加 `ADMIN_CODE=xxxxxx`。

- 80 端口被占（脚本会停下并打印占用的程序）：换端口 `PORT=8080 bash deploy/install.sh`，安全组也放行 8080。
- `PASSCODE` 是进门的四位数，第一次装默认 `0828`（认识那天），只能是 4 位数字。以后重跑不写就沿用服务器上现在的；写了就换成新的，她要重新输。

### 4. 阿里云安全组放行 80

控制台 → 云服务器 ECS → 实例 → launch-advisor-20261027 → 安全组 → 配置规则 → 入方向 → 手动添加：

| 授权策略 | 优先级 | 协议类型 | 端口范围 | 授权对象 |
|---|---|---|---|---|
| 允许 | 1 | 自定义 TCP | 80/80 | 0.0.0.0/0 |

### 5. 手机上验收

用手机浏览器（Safari / Chrome，**不要在微信里直接点**，见下面「风险」）打开 `http://8.163.12.169/`：

1. 先看到深色的密码页，输入进门数字自动进去
2. 封面照片像冲洗一样慢慢显出来，手指擦过的地方先显
3. 一路往下翻到「尾声」，横滑的几章都能左右划

## 回信（她写给你的信）

- 她在尾声最下面「给我回一封信」写完点「寄出」，信存到服务器 `/var/lib/shuying/letters.jsonl`（一行一封）
- 你看信：手机打开 `http://8.163.12.169/inbox.html`，输读信码。这台手机要先在首页输过四位数
- 她那边只看得到自己这台手机上寄出过的信；换手机就看不到，别人也看不到
- 想来信时飞书提醒（可选）：飞书里建一个只有你的群 → 设置 → 群机器人 → 添加机器人 → 自定义机器人 → 复制 webhook 地址，然后重跑一次：

  ```bash
  FEISHU_WEBHOOK='https://open.feishu.cn/open-apis/bot/v2/hook/xxxx' bash deploy/install.sh
  ```

- 备份：`cp /var/lib/shuying/letters.jsonl ~/letters-$(date +%F).jsonl`（更新站点不会动这个文件）
- 后端日志：`journalctl -u shuying-letters -n 50 --no-pager`（只记请求和状态码，不记信的内容）

## 唱片柜（蔡依林的歌）

`/music.html` 是唱片柜：书架上 18 本书（16 张录音室专辑 + 精选里的新歌 + 单曲合作原声），点开放歌。页面和歌都要先输进门数字。首页右下角的小唱片（进门随机放一首）用的也是这批歌，**不传歌首页也没有音乐**。

**歌不在这个仓库**（约 1.8 GB，也有版权），在私有仓库 [jikang119-ctrl/shuying-music](https://github.com/jikang119-ctrl/shuying-music)，要单独传到服务器的 `/var/www/shuying/music/`。`install.sh` 更新站点时不会删这个目录。

服务器直接从 GitHub 拉见上面第 4 步 A。从 Windows 传（**家里网络或手机热点**，公司网拦 SSH）：

```powershell
# 康康这台电脑上歌在 D:\projects\shuying-music（shuying-music 仓库的工作区，git 数据在旁边的 shuying-music.git）；
# 另一台电脑照第 4 步 B clone 到 D:\shuying-music，下面的路径换成它。先核对一个不缺：
python -X utf8 tools/check_music.py --dir D:/projects/shuying-music      # 要打印「齐了」
# Windows 的 scp 不认 *，整个目录传到一个临时目录，再在服务器上挪进 music/
scp -r D:\projects\shuying-music root@8.163.12.169:/var/www/shuying/music-upload
```

然后在服务器上：

```bash
cd /var/www/shuying
rm -f music-upload/.git music-upload/.gitattributes music-upload/README.md    # 仓库自带的小文件；mv * 不带点开头的文件，不删 rmdir 会失败
mkdir -p music && mv music-upload/* music/ && rmdir music-upload
chown -R www-data:www-data music && find music -type f -exec chmod 644 {} +
ls music | wc -l      # 应该是 198
```

传断了就重跑 scp（会整个重传）；`music-upload` 已经存在时 scp 会传进 `music-upload/shuying-music/`，先 `rm -rf /var/www/shuying/music-upload` 再传。

第 4 步 A 是服务器自己拉、直接 cp 进 `music/`，不用这一段。

- 传进服务器的流量阿里云不收费；她听歌是出网流量，一首 8–12 MB，每月 20 GB 大约够听 2000 首
- 拖进度条靠 nginx 自带的 Range，不用配
- 以后补了新歌：把音频放进 `D:\projects\jolin\raw`（随便哪层子目录），然后
  ```powershell
  python -X utf8 tools/music.py --src D:/projects/jolin/raw --out D:/projects/shuying-music --prune
  python -X utf8 tools/music_build.py   # 重写 site/assets/data/music.json
  python -X utf8 tools/fonts.py         # 新歌名里的字
  node tools/build.mjs
  ```
  再 push 两个仓库（歌：`cd D:\projects\shuying-music; git add -A; git commit -m "补了 N 首"; git push`），服务器 `cd ~/shuying && git pull && bash deploy/install.sh`，新增的音频照第 4 步传上去（已有的文件名不变，不用重传）
- 还没收到的 28 首在书里是灰的，划掉的样子；补齐以后自动变黑

## 以后更新内容

本机改完、push 之后，在服务器上：

```bash
cd ~/shuying && git pull && bash deploy/install.sh      # 进门数字、读信码都沿用
```

（用的是方式 B 就重新打包上传，再跑同一条 install.sh。）

## 撤销

```bash
rm /etc/nginx/conf.d/shuying.conf
cp -a /root/nginx-default-site.bak /etc/nginx/sites-enabled/default   # 脚本停用过 default 站点才有这个备份
nginx -t && systemctl reload nginx
rm -rf /var/www/shuying
systemctl disable --now shuying-letters
rm -f /etc/systemd/system/shuying-letters.service && systemctl daemon-reload
rm -rf /opt/shuying /etc/shuying          # 信在 /var/lib/shuying，确定不要了再删
```

## 风险和限制

| 风险 | 影响 | 怎么办 |
|---|---|---|
| 没有备案，只能用 IP 访问 | 国内服务器绑域名必须先 ICP 备案，否则阿里云会拦截；直接用 IP 访问一般不拦（置信度：中） | 先用 IP；想要域名就走备案（约 1–3 周） |
| 微信内置浏览器可能拦裸 IP 链接 | 发给她的链接在微信里点开可能提示「无法打开」或「非官方网页」 | 让她长按复制，用 Safari 打开；或者把链接存成手机桌面书签 |
| 只有 HTTP，没有 HTTPS | 进门数字以明文 cookie 传输；这是一扇门不是保险柜 | 有域名并备案后再上 HTTPS（certbot） |
| 按流量计费 | 首次完整看一遍约 6–10 MB（照片都是压过的 WebP，按屏幕大小只取需要的那一档）；乱试密码的请求会被限速 | 控制台设一个费用预警 |
| 信是明文存在服务器上 | 能登服务器的人（root）都能看到 | 服务器密码别外借；定期把 letters.jsonl 备份到本机 |
| 密码只有 4 位 | 没进门的 IP 每分钟最多试 10 次（nginx 限速，本机实测连试几次后返回 429，带对密码的请求不受影响），挨个试完要十几个小时 | 想更稳就换成更长的数字串，`lock.html` 里 `maxlength` 和格子数要一起改 |

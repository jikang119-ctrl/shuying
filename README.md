# 疏影

康康和艺菡的第一个秋天。一本往下翻的相册书：照片、去过的地方、一起吃的饭、她的偶像、我们在一起的时间。

- 手机优先：每章在手机和电脑上是两套交互（手机横滑、轻点；电脑拖拽、鼠标光照）
- 基本是静态：nginx 直接发文件，没有数据库、没有第三方 CDN（国内服务器访问外网资源不稳）；只有「回信」走一个 Python 标准库写的小后端
- 进门要四位数（nginx 按 cookie 放行，不对的 IP 会被限速）

部署见 [DEPLOY.md](DEPLOY.md)。

## 九个部分

| 章 | 内容 | 手机 | 电脑 |
|---|---|---|---|
| 封面 | 地上两个人的影子 | 照片在纸上自己慢慢显影，手指擦过的地方先显 | 鼠标移过的地方先显 |
| 一 遇见 | 08.28 到 10.18 七个日子 | 竖排日期线，逐行显出 | 左边大日期跟着滚动换 |
| 二 在遇见我之前 | 她小时候、一个人旅行、一个人看演唱会 | 35mm 胶片横滑 | 胶片跟着页面滚动横移 |
| 三 高淳的一天 | 中午到黄昏六张照片 | 整屏横滑，底色从白天变成黄昏 | 钉住的横向滚动，底色跟着变 |
| 四 平常的日子 | 南京地图 + 去过的地方 | 地图线条画出来；卡片横滑轮播 | 同上，可拖动、有左右按钮 |
| 五 一起吃饭 | 吃过的、她爱吃的、她不要的 | 一叠卡片，左右甩开 | 同上 + 目录 |
| 六 你 | 21 张她的照片 | 两列画册，点开看大图 | 可以拖的照片墙，三层景深随鼠标错动 |
| 七 骑士 | 她的偶像蔡依林 | 暗场，一束光自己游走，手指按哪照哪 | 光跟着鼠标走；黑胶唱片 + 她的歌单 |
| 八 时间 | 恋爱计时 | 机械表盘 + 第几天 + 倒计时；按住表盘往回拨，拨到哪天就显示那天的事、那天谁先开口、聊了几句、聊到几点 | 同上，左右两栏，也能用方向键拨 |
| 尾声 | 黄昏的背影 + 回信 | 在黑里擦出照片；最下面她可以写信寄给我 | 在黑里移动鼠标 |

## 目录

```
content/story.json        所有文字、日期、照片编号（改内容只改这里）
content/map.json          南京各区轮廓（tools/map.py 从 nanjing.geo.json 生成）
tools/images.py           原图 → site/photos/pNN-{480,960,1600}.webp + manifest.json
tools/build.mjs           story.json → site/index.html
tools/sections/*.mjs      每一章的 HTML 生成器（按 story.json 里的 kind 找）
tools/fonts.py            把思源宋体 / Cormorant 裁成只含用到的字
site/                     要部署的全部文件
site/assets/js/<kind>.js  每一章的交互，进入视口前才加载
content/chat-days.json    每天聊了多少句、谁先开口、聊到几点（tools/chatdays.py 从微信导出算的，只有统计，没有原话）
server/letters.py         回信后端（只听本机 8830，nginx 转发 /api/letters、/api/inbox）
site/inbox.html           收信页（要读信码）
deploy/                   nginx 配置模板 + 一键安装脚本
```

## 加一段新的回忆

1. 原图按编号放进一个文件夹（文件名以两位数开头：`42_xxx.jpg`），编号接着往后排
2. `python tools/images.py <原图文件夹>` → 生成压缩后的 WebP（一张原图约 4 MB → 三档合计约 300 KB）
3. 在 `content/story.json` 对应章节里加一条，照片写 `p42`
   - 想加一个地方：`days` 章的 `cards` 里加 `{ "photo": "p42", "place": "地名", "cap": "一句话" }`；要在地图上打点就往 `map.pins` 加经纬度
   - 想加一个日子：`meet` 章的 `items` 里加 `{ "date": "11.09", "lines": ["……"] }`
   - 想加一顿饭：`food` 章的 `cards` 里加 `{ "type": "photo", "photo": "p42", "cap": "……" }`
   - 想加她的照片：`you` 章的 `photos` 里加 `"p42"`
4. `node tools/build.mjs && python tools/fonts.py`（字体要重裁，否则新出现的字会退回系统宋体）
5. 本地看：`python -m http.server 8810 --directory site`，打开 http://127.0.0.1:8810
6. 提交、push，服务器上 `git pull && PASSCODE=0828 bash deploy/install.sh`

原图（约 64 MB）不进仓库，留在本机 `D:\projects\love-site-src\raw` 和飞书文档里。

## 章节模块（给改代码的人）

- `tools/sections/<kind>.mjs`：`export default function (ch, ctx)`，返回整章 HTML。`ctx` 提供 `img(id, {sizes, cls, alt})`、`section(ch, inner, {theme, cls, module})`、`lines()`、`esc()`、`map`、`mapProject(lng, lat)`
- `site/assets/js/<kind>.js`：`export function init(el)`。main.js 在这一章快进入视口时才 import，所以首屏只加载封面
- `site/assets/css/<kind>.css`：build 时自动链上
- 共用：`util.js`（isDesktop / onScreen / loop 等）、`lightbox.js`（`openLightbox(items, index, originEl)`）
- 规矩：颜色只用 base.css 里的 token；只动画 transform / opacity；rAF 循环离开视口就停；监听器 passive；支持「减少动态效果」

## 设计

- 名字取自林逋「疏影横斜水清浅，暗香浮动月黄昏」和表白信里的「在水边　在黄昏　做一对疏影」
- 纸色底 + 墨色字 + 一点暮色（oklch 56% 0.13 42）；夜章用深褐黑，不用纯黑纯白
- 字：思源宋体（中文）+ Cormorant Garamond（日期和数字），都是开源字体，裁成子集自托管
- 文字用白描：一行一句，不加句号，不抒情

## 待确认的事实

照片没有拍摄时间和地点信息（飞书上传时被抹掉了），下面这些是按画面和聊天记录推的，错了改 `story.json`：

| 位置 | 现在写的 | 依据 | 置信度 |
|---|---|---|---|
| 计时起点 | 08.28（小红书认识那天） | 09-28 他说「早上好老婆，第一个月」 | 中 |
| 三 高淳的一天 | p03–p07、p10 是 10 月去高淳那天拍的 | p03 背景拱门上能认出一个「高」字；同一身衣服从湖边、向日葵地拍到日落 | 中 |
| 一 遇见 10.18 | 「高淳　固城湖　黄昏」 | 10-16 晚到 10-18 他在高淳 | 中 |
| 二 / 七 | p16、p17 是北京鸟巢蔡依林演唱会 | p17 背景是水立方；她说过「除了蔡依林谁的都没看过」 | 中 |
| 二 | p18 在景山、p19 在天安门，是她小时候 | 画面 | 高 |
| 四 | p09、p08 的地点、p13 的夜景在哪 | 不知道，写的是「某个下午」「夜里」 | — |
| 地图 | 百家湖、固城湖两个点 | 手填的大致经纬度 | 高 |

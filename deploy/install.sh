#!/usr/bin/env bash
# 《疏影》一键部署：装 nginx → 拷站点 → 装回信小后端 → 写配置 → 检查 → 重载。可以重复跑（更新时也用它）。
#
# 用法（在服务器上、仓库根目录下，root 身份）：
#   PASSCODE=0828 bash deploy/install.sh      # 第一次装；以后更新直接 bash deploy/install.sh
# 可选环境变量：
#   PASSCODE        进门的四位数；不给就沿用服务器上现在的，第一次装默认 0828
#   ADMIN_CODE      收信页的读信码；不给就沿用上次的，第一次装会随机生成 6 位并打印出来
#   FEISHU_WEBHOOK  飞书群机器人 webhook，来信时推一条；不给就沿用上次的（可以不配）
#   PORT            网站端口，默认 80
#   API_PORT        回信后端端口（只听本机），默认 8830
#   ROOT            站点目录，默认 /var/www/shuying
set -euo pipefail

PORT="${PORT:-80}"
API_PORT="${API_PORT:-8830}"
ROOT="${ROOT:-/var/www/shuying}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CONF=/etc/nginx/conf.d/shuying.conf
ENVF=/etc/shuying/letters.env
UNIT=/etc/systemd/system/shuying-letters.service

# 进门数字、读信码、webhook：命令行没给就沿用上次的
old() { [[ -f "$ENVF" ]] && grep -E "^$1=" "$ENVF" | head -1 | cut -d= -f2- || true; }
# 进门数字先看 letters.env，再看 nginx 配置（更早的版本只写在那里），都没有才用 0828；不然重跑会把她存的数字冲掉
PASSCODE="${PASSCODE:-$(old PASSCODE)}"
PASSCODE="${PASSCODE:-$( [[ -f "$CONF" ]] && grep -oE '^\s*"[0-9]{4}" 1;' "$CONF" | grep -oE '[0-9]{4}' | head -1 || true)}"
PASSCODE="${PASSCODE:-0828}"

[[ "$PASSCODE" =~ ^[0-9]{4}$ ]] || { echo "PASSCODE 必须是 4 位数字"; exit 1; }
[[ $EUID -eq 0 ]] || { echo "请用 root 运行（sudo -i 之后再跑）"; exit 1; }
[[ -f "$HERE/site/index.html" ]] || { echo "找不到 $HERE/site/index.html，请在仓库根目录运行"; exit 1; }

echo "== 1/6 安装 nginx、python3"
need=()
command -v nginx >/dev/null || need+=(nginx)
command -v python3 >/dev/null || need+=(python3)
if ((${#need[@]})); then
  apt-get update -y
  DEBIAN_FRONTEND=noninteractive apt-get install -y "${need[@]}"
fi
nginx -v
python3 --version

echo "== 2/6 检查端口 $PORT 有没有被别的程序占着"
if ss -ltnp "sport = :$PORT" | grep -v nginx | grep -q LISTEN; then
  ss -ltnp "sport = :$PORT"
  echo "端口 $PORT 已被其他程序占用。换个端口再跑：PORT=8080 PASSCODE=$PASSCODE bash deploy/install.sh"
  exit 1
fi

echo "== 3/6 拷贝站点到 $ROOT"
mkdir -p "$ROOT" "$ROOT/music"
# music/ 是单独传上来的歌（在 shuying-music 仓库，不在这里），更新站点时不能删
rsync -a --delete --exclude '/music/' "$HERE/site/" "$ROOT/" 2>/dev/null || {
  find "${ROOT:?}" -mindepth 1 -maxdepth 1 ! -name music -exec rm -rf {} +
  cp -a "$HERE/site/." "$ROOT/"
}
echo "唱片柜里的歌：$(find "$ROOT/music" -type f \( -name '*.mp3' -o -name '*.m4a' \) | wc -l) 个文件（应该是 198；没有的话按 DEPLOY.md「唱片柜」一节传上来）"
chown -R www-data:www-data "$ROOT"
find "$ROOT" -type d -exec chmod 755 {} +
find "$ROOT" -type f -exec chmod 644 {} +

echo "== 4/6 装回信后端（信存在 /var/lib/shuying/letters.jsonl，更新站点不会动它）"
mkdir -p /opt/shuying /var/lib/shuying /etc/shuying
install -m 644 "$HERE/server/letters.py" /opt/shuying/letters.py
chown www-data:www-data /var/lib/shuying
chmod 750 /var/lib/shuying
ADMIN_CODE="${ADMIN_CODE:-$(old ADMIN_CODE)}"
FEISHU_WEBHOOK="${FEISHU_WEBHOOK:-$(old FEISHU_WEBHOOK)}"
NEW_ADMIN=""
if [[ -z "$ADMIN_CODE" ]]; then
  ADMIN_CODE="$(shuf -i 100000-999999 -n 1)"
  NEW_ADMIN=1
fi
[[ "$ADMIN_CODE" =~ ^[0-9A-Za-z_-]{4,}$ ]] || { echo "ADMIN_CODE 只能是字母数字，至少 4 位"; exit 1; }
umask 077
cat > "$ENVF" <<EOF
PASSCODE=$PASSCODE
ADMIN_CODE=$ADMIN_CODE
FEISHU_WEBHOOK=$FEISHU_WEBHOOK
DATA_DIR=/var/lib/shuying
PORT=$API_PORT
EOF
umask 022
cat > "$UNIT" <<EOF
[Unit]
Description=shuying letters (疏影回信)
After=network.target

[Service]
User=www-data
Group=www-data
EnvironmentFile=$ENVF
ExecStart=/usr/bin/env python3 /opt/shuying/letters.py
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/shuying

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable shuying-letters >/dev/null 2>&1
systemctl restart shuying-letters
for i in 1 2 3 4 5; do curl -s -o /dev/null "http://127.0.0.1:$API_PORT/api/health" && break; sleep 1; done

echo "== 5/6 写 nginx 配置 $CONF"
sed -e "s#__PASSCODE__#$PASSCODE#g" -e "s#__ROOT__#$ROOT#g" -e "s#__PORT__#$PORT#g" -e "s#__API_PORT__#$API_PORT#g" \
  "$HERE/deploy/nginx.conf.template" > "$CONF"
# Ubuntu 自带的 default 站点也监听 80，会抢请求；同端口时把它移走（备份在 /root）
if [[ "$PORT" == "80" && -L /etc/nginx/sites-enabled/default ]]; then
  cp -a /etc/nginx/sites-enabled/default /root/nginx-default-site.bak 2>/dev/null || true
  rm /etc/nginx/sites-enabled/default
  echo "已停用 nginx 自带的 default 站点（备份：/root/nginx-default-site.bak）"
fi

echo "== 6/6 检查并重载"
nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
systemctl reload nginx 2>/dev/null || systemctl restart nginx

# 自检：没 cookie 应该被带去密码页；带对的 cookie 应该拿到首页；读信码能打开收信接口
base="http://127.0.0.1:$PORT"
code_lock=$(curl -s -o /dev/null -w '%{http_code}' "$base/")
code_gate=$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: shuying=$PASSCODE" "$base/gate")
code_home=$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: shuying=$PASSCODE" "$base/")
code_inbox=$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: shuying=$PASSCODE; shuying_admin=$ADMIN_CODE" "$base/api/inbox")
echo "自检：无密码访问首页=$code_lock（应为 302）· 验证接口=$code_gate（应为 204）· 带密码首页=$code_home（应为 200）· 收信接口=$code_inbox（应为 200）"
if [[ "$code_lock" != 302 || "$code_gate" != 204 || "$code_home" != 200 || "$code_inbox" != 200 ]]; then
  echo "自检没过。回信后端的日志：journalctl -u shuying-letters -n 30 --no-pager"
  exit 1
fi

IP=$(curl -s --max-time 3 http://100.100.100.200/latest/meta-data/eipv4 2>/dev/null || curl -s --max-time 3 ifconfig.me 2>/dev/null || echo '<公网IP>')
SITE="http://$IP$( [[ "$PORT" == 80 ]] || echo ":$PORT" )"
echo
echo "部署好了：$SITE/      进门数字：$PASSCODE"
echo "收信页：  $SITE/inbox.html   读信码：$ADMIN_CODE$( [[ -n "$NEW_ADMIN" ]] && echo '（新生成的，记下来；以后重跑脚本会沿用）')"
[[ -n "$FEISHU_WEBHOOK" ]] && echo "来信会推到飞书群机器人。" || echo "没配飞书推送（可选：FEISHU_WEBHOOK=... 重跑一次）。"
echo "如果外网打不开，去阿里云控制台 → 安全组 → 入方向放行 TCP $PORT。"

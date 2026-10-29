#!/usr/bin/env bash
# 《疏影》一键部署：装 nginx → 拷站点 → 写配置 → 检查 → 重载。可以重复跑（更新时也用它）。
#
# 用法（在服务器上、仓库根目录下，root 身份）：
#   PASSCODE=0828 bash deploy/install.sh
# 可选环境变量：
#   PASSCODE  进门的四位数，默认 0828
#   PORT      监听端口，默认 80
#   ROOT      站点目录，默认 /var/www/shuying
set -euo pipefail

PASSCODE="${PASSCODE:-0828}"
PORT="${PORT:-80}"
ROOT="${ROOT:-/var/www/shuying}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CONF=/etc/nginx/conf.d/shuying.conf

[[ "$PASSCODE" =~ ^[0-9]{4}$ ]] || { echo "PASSCODE 必须是 4 位数字"; exit 1; }
[[ $EUID -eq 0 ]] || { echo "请用 root 运行（sudo -i 之后再跑）"; exit 1; }
[[ -f "$HERE/site/index.html" ]] || { echo "找不到 $HERE/site/index.html，请在仓库根目录运行"; exit 1; }

echo "== 1/5 安装 nginx"
if ! command -v nginx >/dev/null; then
  apt-get update -y
  DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
fi
nginx -v

echo "== 2/5 检查端口 $PORT 有没有被别的程序占着"
if ss -ltnp "sport = :$PORT" | grep -v nginx | grep -q LISTEN; then
  ss -ltnp "sport = :$PORT"
  echo "端口 $PORT 已被其他程序占用。换个端口再跑：PORT=8080 PASSCODE=$PASSCODE bash deploy/install.sh"
  exit 1
fi

echo "== 3/5 拷贝站点到 $ROOT"
mkdir -p "$ROOT"
rsync -a --delete "$HERE/site/" "$ROOT/" 2>/dev/null || { rm -rf "${ROOT:?}"/*; cp -a "$HERE/site/." "$ROOT/"; }
chown -R www-data:www-data "$ROOT"
find "$ROOT" -type d -exec chmod 755 {} +
find "$ROOT" -type f -exec chmod 644 {} +

echo "== 4/5 写 nginx 配置 $CONF"
sed -e "s#__PASSCODE__#$PASSCODE#g" -e "s#__ROOT__#$ROOT#g" -e "s#__PORT__#$PORT#g" \
  "$HERE/deploy/nginx.conf.template" > "$CONF"
# Ubuntu 自带的 default 站点也监听 80，会抢请求；同端口时把它移走（备份在 /root）
if [[ "$PORT" == "80" && -L /etc/nginx/sites-enabled/default ]]; then
  cp -a /etc/nginx/sites-enabled/default /root/nginx-default-site.bak 2>/dev/null || true
  rm /etc/nginx/sites-enabled/default
  echo "已停用 nginx 自带的 default 站点（备份：/root/nginx-default-site.bak）"
fi

echo "== 5/5 检查并重载"
nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
systemctl reload nginx 2>/dev/null || systemctl restart nginx

# 自检：没 cookie 应该被带去密码页；带对的 cookie 应该拿到首页
code_lock=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/")
code_gate=$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: shuying=$PASSCODE" "http://127.0.0.1:$PORT/gate")
code_home=$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: shuying=$PASSCODE" "http://127.0.0.1:$PORT/")
echo "自检：无密码访问首页=$code_lock（应为 302）· 验证接口=$code_gate（应为 204）· 带密码首页=$code_home（应为 200）"
[[ "$code_lock" == 302 && "$code_gate" == 204 && "$code_home" == 200 ]] || { echo "自检没过，看上面的输出"; exit 1; }

IP=$(curl -s --max-time 3 http://100.100.100.200/latest/meta-data/eipv4 2>/dev/null || curl -s --max-time 3 ifconfig.me 2>/dev/null || echo '<公网IP>')
echo
echo "部署好了：http://$IP$( [[ "$PORT" == 80 ]] || echo ":$PORT" )/   进门数字：$PASSCODE"
echo "如果外网打不开，去阿里云控制台 → 安全组 → 入方向放行 TCP $PORT。"

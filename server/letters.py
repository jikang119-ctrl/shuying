"""《疏影》回信的小后端：她写的信存在服务器上，只有拿着读信码的人能看。

只用 Python 标准库，不用装任何包。只听 127.0.0.1，外面的请求都先经过 nginx：
nginx 已经挡掉了没输四位数的请求并做了限速，这里再核对一遍 cookie。

环境变量（deploy/install.sh 写在 /etc/shuying/letters.env）：
  PASSCODE        进门的四位数，和 nginx 一致
  ADMIN_CODE      读信码，只有康康知道
  DATA_DIR        存信的目录，默认 /var/lib/shuying
  PORT            默认 8830
  FEISHU_WEBHOOK  可选：飞书群机器人的 webhook 地址，来了新信就推一条

接口：
  POST /api/letters  {"text": "..."}       寄一封信（要进门 cookie）
  GET  /api/inbox                           读全部信，新的在前（要读信码 cookie）
  GET  /api/health                          自检
"""
import hmac
import json
import os
import threading
import urllib.request
from datetime import datetime, timedelta, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BJ = timezone(timedelta(hours=8))
PASSCODE = os.environ.get('PASSCODE', '')
ADMIN_CODE = os.environ.get('ADMIN_CODE', '')
DATA_DIR = os.environ.get('DATA_DIR', '/var/lib/shuying')
PORT = int(os.environ.get('PORT', '8830'))
WEBHOOK = os.environ.get('FEISHU_WEBHOOK', '')
FILE = os.path.join(DATA_DIR, 'letters.jsonl')
MAX_CHARS = 2000
MAX_BODY = 16 * 1024
lock = threading.Lock()


def cookie(handler, name):
    jar = SimpleCookie()
    try:
        jar.load(handler.headers.get('Cookie', ''))
    except Exception:
        return ''
    return jar[name].value if name in jar else ''


def same(a, b):
    return bool(a) and bool(b) and hmac.compare_digest(a.encode(), b.encode())


def read_all():
    if not os.path.exists(FILE):
        return []
    out = []
    with open(FILE, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except ValueError:
                pass
    return out


def notify(letter):
    if not WEBHOOK:
        return
    when = letter['time'][5:16].replace('T', ' ')
    body = json.dumps({'msg_type': 'text', 'content': {'text': f'艺菡写了一封信（{when}）\n\n{letter["text"]}'}}).encode()
    try:
        urllib.request.urlopen(urllib.request.Request(WEBHOOK, body, {'Content-Type': 'application/json'}), timeout=8)
    except Exception as e:  # 推送失败不影响存信
        print('飞书推送失败:', e, flush=True)


class Handler(BaseHTTPRequestHandler):
    server_version = 'shuying'
    sys_version = ''

    def reply(self, code, obj=None):
        body = b'' if obj is None else json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # 只记请求行和状态码，不记信的内容
        print('%s %s' % (self.headers.get('X-Real-IP', self.address_string()), fmt % args), flush=True)

    def do_GET(self):
        if self.path == '/api/health':
            return self.reply(200, {'ok': True})
        if self.path == '/api/inbox':
            if not same(cookie(self, 'shuying_admin'), ADMIN_CODE):
                return self.reply(401, {'error': 'code'})
            with lock:
                letters = read_all()
            return self.reply(200, {'letters': letters[::-1]})
        return self.reply(404, {'error': 'not found'})

    def do_POST(self):
        if self.path != '/api/letters':
            return self.reply(404, {'error': 'not found'})
        if not same(cookie(self, 'shuying'), PASSCODE):
            return self.reply(403, {'error': 'gate'})
        try:
            n = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            n = 0
        if n <= 0 or n > MAX_BODY:
            return self.reply(413, {'error': 'size'})
        try:
            text = str(json.loads(self.rfile.read(n)).get('text', '')).strip()
        except Exception:
            return self.reply(400, {'error': 'json'})
        if not text:
            return self.reply(400, {'error': 'empty'})
        if len(text) > MAX_CHARS:
            return self.reply(400, {'error': 'long'})
        letter = {'time': datetime.now(BJ).isoformat(timespec='seconds'), 'text': text}
        with lock:
            os.makedirs(DATA_DIR, exist_ok=True)
            with open(FILE, 'a', encoding='utf-8') as f:
                f.write(json.dumps(letter, ensure_ascii=False) + '\n')
                f.flush()
                os.fsync(f.fileno())
        threading.Thread(target=notify, args=(letter,), daemon=True).start()
        return self.reply(201, {'ok': True, 'time': letter['time']})


if __name__ == '__main__':
    if not PASSCODE or not ADMIN_CODE:
        raise SystemExit('PASSCODE 和 ADMIN_CODE 都要配（见 /etc/shuying/letters.env）')
    print(f'shuying letters on 127.0.0.1:{PORT}, data {FILE}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()

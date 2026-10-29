"""微信聊天导出 -> content/chat-days.json（只留每天的统计，不留任何一句原话）

用法: python tools/chatdays.py <聊天导出.json>
导出格式: {"messages": [{"timestamp": 秒, "sender": "me"|"them", ...}]}
「一天」从早上 5 点算到第二天早上 5 点，这样凌晨聊的算在前一天里。
"""
import json, os, sys
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BJ = timezone(timedelta(hours=8))

msgs = json.load(open(sys.argv[1], encoding='utf-8'))['messages']
days = {}
for m in msgs:
    t = datetime.fromtimestamp(m['timestamp'], BJ)
    key = (t - timedelta(hours=5)).date().isoformat()
    d = days.setdefault(key, {'n': 0, 'first': None, 'last': None})
    d['n'] += 1
    if d['first'] is None or m['timestamp'] < d['first'][0]:
        d['first'] = (m['timestamp'], m['sender'])
    if d['last'] is None or m['timestamp'] > d['last']:
        d['last'] = m['timestamp']

end = max(m['timestamp'] for m in msgs)
out = {'until': datetime.fromtimestamp(end, BJ).date().isoformat(), 'days': {}}
for k, d in sorted(days.items()):
    last = datetime.fromtimestamp(d['last'], BJ)
    out['days'][k] = {'n': d['n'], 'last': last.strftime('%H:%M'), 'by': d['first'][1]}
# 导出截止那天不完整，不写「聊到几点」
out['days'][out['until']].pop('last', None)
json.dump(out, open(os.path.join(ROOT, 'content', 'chat-days.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(out['days']), 'days, until', out['until'], 'total', sum(d['n'] for d in out['days'].values()))

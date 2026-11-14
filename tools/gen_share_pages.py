#!/usr/bin/env python3
"""為每篇已發布的「最新消息」產生分享頁 p/<文章ID>/index.html 與 1200x630 縮圖 cover.jpg。
LINE / Facebook 抓不到網址 # 後面的內容，所以分享連結改指向這些獨立頁面（頁首帶該篇的標題、摘要、封面），
真人點進去會自動跳到官網的文章彈窗（/#p-<文章ID>）。
資料來源：Firestore 公開讀取（news，published==true）。測試時可用環境變數 NEWS_JSON 指向本機 JSON。"""
import base64, hashlib, html, io, json, os, re, shutil, sys, urllib.request
from PIL import Image

KEY = 'AIzaSyD2rqiTQjgYQN4JrLlVFJZbmgLuQvliySk'  # 網頁公開金鑰（同 index.html）
SITE = 'https://hcdrone.org.tw'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'p')
ORG = '新竹市無人機創新科技協會'
DEFAULT_IMG = SITE + '/og-logo.jpg'


def fetch_posts():
    if os.environ.get('NEWS_JSON'):
        return json.load(open(os.environ['NEWS_JSON'], encoding='utf-8'))
    q = {'structuredQuery': {
        'from': [{'collectionId': 'news'}],
        'where': {'fieldFilter': {'field': {'fieldPath': 'published'}, 'op': 'EQUAL', 'value': {'booleanValue': True}}},
        'select': {'fields': [{'fieldPath': f} for f in ('title', 'excerpt', 'category', 'date', 'image')]}}}
    url = 'https://firestore.googleapis.com/v1/projects/hsinchu-drone/databases/(default)/documents:runQuery?key=' + KEY
    req = urllib.request.Request(url, json.dumps(q).encode(), {'Content-Type': 'application/json'})
    rows = json.load(urllib.request.urlopen(req, timeout=90))
    posts = []
    for r in rows:
        d = r.get('document')
        if not d:
            continue
        p = {'id': d['name'].rsplit('/', 1)[1]}
        for k, v in (d.get('fields') or {}).items():
            if 'stringValue' in v:
                p[k] = v['stringValue']
        posts.append(p)
    return posts


def first_body_image(pid):
    """文章沒有封面圖時，改抓內文第一張圖（data URI 或 https 網址）當分享縮圖。"""
    try:
        url = ('https://firestore.googleapis.com/v1/projects/hsinchu-drone/databases/(default)/documents/news/'
               + pid + '?mask.fieldPaths=body&key=' + KEY)
        d = json.load(urllib.request.urlopen(url, timeout=90))
        body = (d.get('fields') or {}).get('body', {}).get('stringValue', '')
        m = re.search(r'<img[^>]+src="(data:image/[a-z+]+;base64,[A-Za-z0-9+/=]+|https?://[^"]+)"', body)
        return m.group(1) if m else None
    except Exception as e:
        print('  內文圖片讀取失敗：', str(e)[:80])
        return None


def load_image(src):
    """回傳 PIL Image，失敗回傳 None。支援 data URI、https 網址、repo 內相對路徑。"""
    if not src:
        return None
    try:
        if src.startswith('data:'):
            return Image.open(io.BytesIO(base64.b64decode(src.split(',', 1)[1])))
        if src.startswith('http'):
            with urllib.request.urlopen(src, timeout=60) as r:
                return Image.open(io.BytesIO(r.read()))
        path = os.path.join(ROOT, src)
        if os.path.exists(path):
            return Image.open(path)
    except Exception as e:
        print('  圖片讀取失敗：', str(e)[:80])
    return None


def make_cover(im, dest):
    im = im.convert('RGB')
    s = max(1200 / im.width, 630 / im.height)
    im = im.resize((max(1200, round(im.width * s)), max(630, round(im.height * s))), Image.LANCZOS)
    left = (im.width - 1200) // 2
    top = int((im.height - 630) * 0.3)  # 直式照片多半人臉在上半部，偏上裁切
    im.crop((left, top, left + 1200, top + 630)).save(dest, 'JPEG', quality=82, optimize=True)


def page(p, img_url):
    pid = p['id']
    title = (p.get('title') or ORG).strip()
    desc = ' '.join((p.get('excerpt') or '').split())[:120] or '新竹市無人機創新科技協會最新消息'
    url = f'{SITE}/p/{pid}/'
    e = lambda t: html.escape(t, quote=True)
    return f'''<!DOCTYPE html>
<html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} | {ORG}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="{ORG}">
<meta property="og:locale" content="zh_TW">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{e(img_url)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(title)}">
<meta name="twitter:description" content="{e(desc)}">
<meta name="twitter:image" content="{e(img_url)}">
<noscript><meta http-equiv="refresh" content="0;url=/#p-{pid}"></noscript>
<script>location.replace('/#p-{pid}');</script>
</head><body style="font-family:sans-serif;text-align:center;padding:48px 16px">
<p>正在前往文章…</p><p><a href="/#p-{pid}">{e(title)}</a></p>
</body></html>
'''


def main():
    posts = fetch_posts()
    os.makedirs(OUT, exist_ok=True)
    mpath = os.path.join(OUT, 'manifest.json')
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {}
    new_manifest, ids = {}, set()
    for p in posts:
        pid = p['id']; ids.add(pid)
        d = os.path.join(OUT, pid)
        # 沒有封面圖：改用內文第一張圖。為省流量，已產生過且標題／摘要／封面沒變的文章不重抓內文。
        src = p.get('image')
        body_cover = False
        h0 = hashlib.sha1('|'.join(p.get(k, '') for k in ('title', 'excerpt', 'image')).encode()).hexdigest()[:10]
        if not src:
            body_cover = True
            if manifest.get(pid) == h0 + 'b' and os.path.exists(os.path.join(d, 'index.html')):
                new_manifest[pid] = h0 + 'b'
                continue
            src = first_body_image(pid)
        h = h0 + ('b' if body_cover else '')
        if not body_cover and manifest.get(pid) == h and os.path.exists(os.path.join(d, 'index.html')):
            new_manifest[pid] = h
            continue
        print('產生', pid, (p.get('title') or '')[:20])
        os.makedirs(d, exist_ok=True)
        im = load_image(src)
        if im is not None:
            make_cover(im, os.path.join(d, 'cover.jpg'))
            img_url = f'{SITE}/p/{pid}/cover.jpg?v={h}'
        else:
            img_url = DEFAULT_IMG
            if os.path.exists(os.path.join(d, 'cover.jpg')):
                os.remove(os.path.join(d, 'cover.jpg'))
        open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(page(p, img_url))
        new_manifest[pid] = h
    for name in os.listdir(OUT):  # 已下架或刪除的文章，移除分享頁
        if name != 'manifest.json' and name not in ids and os.path.isdir(os.path.join(OUT, name)):
            print('移除', name); shutil.rmtree(os.path.join(OUT, name))
    json.dump(new_manifest, open(mpath, 'w'), indent=1, sort_keys=True)
    print('完成，共', len(ids), '篇')


if __name__ == '__main__':
    main()

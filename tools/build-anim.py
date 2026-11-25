#!/usr/bin/env python3
"""Builds client/art/anim/<id>[_back].png sprite-sheets + manifest.json from the MonsterMMO pokemon_ani atlas.
usage: build-anim.py <pokemon_ani dir> <client/art dir>"""
import json, os, sys, math
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
src, art = sys.argv[1], sys.argv[2]
A = json.load(open(os.path.join(src, 'atlas.json')))
out = os.path.join(art, 'anim'); os.makedirs(out, exist_ok=True)
CW, CH, COLS, MAXF = 128, 192, 8, 32
man = {}
ids = sorted({f[:-4].replace('_back', '') for f in os.listdir(os.path.join(art, 'sprites'))})
for id in ids:
    sh = Image.open(os.path.join(src, id + '.png')).convert('RGBA'); a = A[id]
    for key, m in (('', a['front']), ('_back', a.get('back') or a['front'])):
        fw, fh, n, cols = m['w'], m['h'], m['n'], m['cols']
        def frame(i): r, c = divmod(i, cols); x, y = c * fw, m['y'] + r * fh; return sh.crop((x, y, x + fw, y + fh))
        f0 = frame(0); bb = f0.getchannel('A').getbbox()
        if not bb: continue
        s = min(235 / (bb[2] - bb[0]), 219 / (bb[3] - bb[1])) / 2
        step = max(1, math.ceil(n / MAXF)); idx = list(range(0, n, step)); k = len(idx)
        rows = math.ceil(k / COLS); sheet = Image.new('RGBA', (CW * COLS, CH * rows), (0, 0, 0, 0))
        ax, ay = (bb[0] + bb[2]) / 2, bb[3]
        for j, i in enumerate(idx):
            f = frame(i); nw, nh = max(1, round(fw * s)), max(1, round(fh * s))
            f = f.resize((nw, nh), Image.NEAREST if s >= 1 else Image.LANCZOS)
            cell = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); cell.paste(f, (round(CW / 2 - ax * s), round(189 - ay * s)))
            r, c = divmod(j, COLS); sheet.paste(cell, (c * CW, r * CH))
        sheet.save(os.path.join(out, id + key + '.png'), optimize=True)
        man[id + key] = {'cols': COLS, 'rows': rows, 'n': k, 'fps': round(m.get('fps', 11) / step, 2), 'cw': CW, 'ch': CH}
json.dump(man, open(os.path.join(out, 'manifest.json'), 'w'))
print(len(man), 'sheets')

#!/usr/bin/env python3
"""Slice the 32-character source grid into individual transparent sprites.

Input : assets/mbti-characters.png  (992x1586, 4 family rows x 8 figures)
Output: assets/sprites/<TYPE>_<M|F>.png  (RGBA, cream background removed)

Run:   python3 tools/slice_sprites.py [--contact]

The source image is a user-provided, copyright-free asset for this game.
"""
import os
import sys
from collections import deque

from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "mbti-characters.png")
OUT = os.path.join(ROOT, "assets", "sprites")

# Character grid order — must match src/characters.js TYPES order.
TYPES = ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP",
         "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"]

# 4 family bands (generous y-ranges; each cell is bbox-trimmed afterwards).
BANDS = [(60, 310), (480, 735), (900, 1140), (1280, 1505)]
COLS = 8
BG = np.array([250.2, 243.4, 228.7])  # cream background
FG_THRESH = 45   # colour distance: foreground vs background
BG_THRESH = 42   # colour distance: treat as background for flood-fill


def dist(arr):
    return np.sqrt(((arr - BG) ** 2).sum(-1))


def largest_components(opaque, keep_ratio=0.06):
    """Keep the main character blob (+ sizable held props); drop edge slivers."""
    h, w = opaque.shape
    label = np.zeros((h, w), int)
    sizes = {}
    nxt = 0
    for sy in range(h):
        for sx in range(w):
            if opaque[sy, sx] and label[sy, sx] == 0:
                nxt += 1
                cnt = 0
                dq = deque([(sy, sx)])
                label[sy, sx] = nxt
                while dq:
                    y, x = dq.popleft()
                    cnt += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx2 = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx2 < w and opaque[ny, nx2] and label[ny, nx2] == 0:
                            label[ny, nx2] = nxt
                            dq.append((ny, nx2))
                sizes[nxt] = cnt
    if not sizes:
        return opaque
    biggest = max(sizes.values())
    keep = {lid for lid, s in sizes.items() if s >= keep_ratio * biggest}
    return np.isin(label, list(keep))


def carve(crop):
    """Return RGBA: cream background -> transparent, edge slivers removed."""
    h, w, _ = crop.shape
    d = dist(crop)
    bgish = d < BG_THRESH

    # Flood-fill background inward from the borders (keeps interior whites).
    trans = np.zeros((h, w), bool)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if bgish[y, x] and not trans[y, x]:
                trans[y, x] = True
                dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if bgish[y, x] and not trans[y, x]:
                trans[y, x] = True
                dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not trans[ny, nx] and bgish[ny, nx]:
                trans[ny, nx] = True
                dq.append((ny, nx))

    opaque = ~trans
    opaque = largest_components(opaque)
    alpha = np.where(opaque, 255, 0).astype(np.uint8)
    return np.dstack([crop.astype(np.uint8), alpha])


def main():
    im = Image.open(SRC).convert("RGB")
    a = np.asarray(im).astype(int)
    H, W, _ = a.shape
    full_fg = dist(a) > FG_THRESH
    colw = W / COLS
    os.makedirs(OUT, exist_ok=True)

    made = []
    for bi, (y0, y1) in enumerate(BANDS):
        for c in range(COLS):
            x0, x1 = int(round(c * colw)), int(round((c + 1) * colw))
            sub = a[y0:y1, x0:x1]
            m = full_fg[y0:y1, x0:x1]
            ys, xs = np.where(m)
            if len(ys) < 50:
                continue
            pad = 4
            ty0 = max(0, ys.min() - pad)
            ty1 = min(sub.shape[0] - 1, ys.max() + pad)
            tx0 = max(0, xs.min() - pad)
            tx1 = min(sub.shape[1] - 1, xs.max() + pad)
            rgba = carve(sub[ty0:ty1 + 1, tx0:tx1 + 1])
            cid = f"{TYPES[bi * 4 + c // 2]}_{'M' if c % 2 == 0 else 'F'}"
            Image.fromarray(rgba, "RGBA").save(os.path.join(OUT, cid + ".png"))
            made.append(cid)
    print(f"wrote {len(made)} sprites to {OUT}")

    if "--contact" in sys.argv:
        cell = 160
        sheet = Image.new("RGB", (8 * cell, 4 * cell), (88, 88, 100))
        for i, cid in enumerate(made):
            s = Image.open(os.path.join(OUT, cid + ".png")).convert("RGBA")
            s.thumbnail((cell - 10, cell - 10))
            r, c = divmod(i, 8)
            sheet.paste(s, (c * cell + (cell - s.width) // 2, r * cell + (cell - s.height) // 2), s)
        path = os.path.join(ROOT, "assets", "_contact.png")
        sheet.save(path)
        print("contact sheet:", path)


if __name__ == "__main__":
    main()

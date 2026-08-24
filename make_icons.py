#!/usr/bin/env python3
"""Generate PWA icons (pure stdlib): gradient tile + white magnifier."""
import struct, zlib, math, os

def make_icon(size, path):
    px = bytearray()
    c1 = (0x1c, 0x21, 0x40)   # deep blue
    c2 = (0x3b, 0x2a, 0x55)   # purple
    gold1 = (0xff, 0xcf, 0x3f)
    gold2 = (0xff, 0x7a, 0x59)
    white = (0xff, 0xff, 0xff)
    # magnifier geometry (relative)
    cx, cy, r = 0.44, 0.42, 0.20
    ring_w = 0.055
    # handle: from circle edge toward (0.78, 0.76)
    hx1, hy1 = cx + r * math.cos(math.radians(45)), cy + r * math.sin(math.radians(45))
    hx2, hy2 = 0.80, 0.80
    hw = 0.055

    def seg_dist(px_, py_, ax, ay, bx, by):
        dx, dy = bx - ax, by - ay
        t = max(0.0, min(1.0, ((px_ - ax) * dx + (py_ - ay) * dy) / (dx * dx + dy * dy)))
        qx, qy = ax + t * dx, ay + t * dy
        return math.hypot(px_ - qx, py_ - qy)

    for y in range(size):
        row = bytearray()
        for x in range(size):
            u, v = x / (size - 1), y / (size - 1)
            # rounded-square mask
            rad = 0.22
            dx = max(rad - u, u - (1 - rad), 0.0)
            dy = max(rad - v, v - (1 - rad), 0.0)
            inside = (dx * dx + dy * dy) <= rad * rad
            if not inside:
                row += b'\x00\x00\x00\x00'
                continue
            # diagonal gradient
            t = (u + v) / 2
            bg = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
            # magnifier colors (gold gradient)
            gt = (u + v) / 2
            gold = tuple(int(gold1[i] + (gold2[i] - gold1[i]) * gt) for i in range(3))
            col = bg
            d_ring = abs(math.hypot(u - cx, v - cy) - r)
            if d_ring <= ring_w:
                col = gold
            elif d_ring <= r - ring_w:
                col = tuple(int(c + (255 - c) * 0.10) for c in bg)  # glass tint
            if seg_dist(u, v, hx1, hy1, hx2, hy2) <= hw:
                col = gold
            # subtle inner highlight
            h = math.hypot(u - cx + 0.05, v - cy - 0.06)
            if h < 0.05:
                col = tuple(min(255, c + 60) for c in col)
            row += bytes(col) + b'\xff'
        px += bytes(row) + b'\x00'  # filter byte per row

    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(px), 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)
    print(path, len(png), 'bytes')

os.makedirs('/home/hermes/which-ones-real/icons', exist_ok=True)
base = '/home/hermes/which-ones-real/'
make_icon(192, base + 'icon-192.png')
make_icon(180, base + 'icon-180.png')
make_icon(512, base + 'icon-512.png')

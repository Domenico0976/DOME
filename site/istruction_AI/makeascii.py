#!/usr/bin/env python3
"""makeascii — PNG screenshot to ASCII density map in the terminal.

Recovers the quick-look technique used during the Oct-2026 dither sessions:
render an image region as coarse ASCII so shapes (arcs, bands, masks) can be
"seen" as text. Zero dependencies (stdlib only: zlib + struct) — handles
8-bit RGB/RGBA PNGs, which is what Playwright screenshots are.

Usage:
  python makeascii.py shot.png
  python makeascii.py shot.png --width 100 --channel r
  python makeascii.py shot.png --crop 500,300,440,280 --channel lum

Options:
  --width N      output columns (default 80). Rows follow image aspect,
                 corrected for terminal character proportions (~x0.5).
  --channel NAME r | g | b | lum (default lum). Picks which signal becomes
                 density — e.g. --channel r isolates a magenta/red mask.
  --crop X,Y,W,H pixel region before downsampling (default: full image).
  --invert       flip the density ramp (dark on light terminals).
"""
import struct
import sys
import zlib


def read_png(path):
    with open(path, "rb") as f:
        data = f.read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG file")
    pos, w, h, bitd, ctyp, idat = 8, 0, 0, 0, 0, b""
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos : pos + 4])
        ctype = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + length]
        if ctype == b"IHDR":
            w, h, bitd, ctyp, _, _, _ = struct.unpack(">IIBBBBB", chunk)
        elif ctype == b"IDAT":
            idat += chunk
        elif ctype == b"IEND":
            break
        pos += 12 + length
    if bitd != 8 or ctyp not in (2, 6):
        raise ValueError(f"only 8-bit RGB/RGBA PNGs, got bitdepth={bitd} colortype={ctyp}")
    ch = 3 if ctyp == 2 else 4
    raw = zlib.decompress(idat)
    stride = w * ch
    out = bytearray(w * h * ch)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]
        p += 1
        line = bytearray(raw[p : p + stride])
        p += stride
        if f == 1:
            for i in range(ch, stride):
                line[i] = (line[i] + line[i - ch]) & 0xFF
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif f == 3:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 0xFF
        elif f == 4:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                b = prev[i]
                c = prev[i - ch] if i >= ch else 0
                pr = a + b - c
                pa, pb, pc = abs(pr - a), abs(pr - b), abs(pr - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        elif f != 0:
            raise ValueError(f"unknown PNG filter {f}")
        out[y * stride : (y + 1) * stride] = line
        prev = line
    return w, h, ch, bytes(out)


def main(argv):
    args = {"width": 80, "channel": "lum", "crop": None, "invert": False}
    paths = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--width":
            args["width"] = int(argv[i + 1]); i += 2
        elif a == "--channel":
            args["channel"] = argv[i + 1]; i += 2
        elif a == "--crop":
            args["crop"] = [int(v) for v in argv[i + 1].split(",")]; i += 2
        elif a == "--invert":
            args["invert"] = True; i += 1
        else:
            paths.append(a); i += 1
    if not paths:
        print(__doc__)
        return 1
    ramp = " .:-=+*#%@" if not args["invert"] else "@%#*+=-:. "
    for path in paths:
        w, h, ch, px = read_png(path)
        x0, y0, cw, chh = args["crop"] or (0, 0, w, h)
        x0 = max(0, min(w - 1, x0)); y0 = max(0, min(h - 1, y0))
        cw = max(1, min(w - x0, cw)); chh = max(1, min(h - y0, chh))
        cols = max(1, args["width"])
        # Terminal cells are ~2x taller than wide: sample half as many rows.
        rows = max(1, int(cols * chh / cw * 0.5))
        ch_idx = {"r": 0, "g": 1, "b": 2}.get(args["channel"])
        print(f"== {path} [{w}x{h}] crop=({x0},{y0},{cw}x{chh}) -> {cols}x{rows} ch={args['channel']}")
        for r in range(rows):
            line = []
            for c in range(cols):
                x = min(w - 1, x0 + int((c + 0.5) * cw / cols))
                y = min(h - 1, y0 + int((r + 0.5) * chh / rows))
                o = (y * w + x) * ch
                if ch_idx is None:
                    v = (px[o] * 299 + px[o + 1] * 587 + px[o + 2] * 114) // 1000
                else:
                    v = px[o + ch_idx]
                line.append(ramp[v * (len(ramp) - 1) // 255])
            print("".join(line))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

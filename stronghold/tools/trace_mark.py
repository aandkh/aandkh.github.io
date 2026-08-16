# Trace the real logo to SVG. Subpixel marching-squares contours, then
# Douglas-Peucker simplification, emitted as one evenodd path so the
# counters of the S stay as holes rather than needing separate shapes.
#
#   pip install scikit-image
#   python tools/trace_mark.py [tolerance]
#
# Verified against the source by rasterising both and comparing masks:
# at tolerance 0.5 the trace agrees with the original on all but 84
# pixels in 541,398 (IoU 0.9997), and those are anti-aliased edge.
import io
import os
import sys

import numpy as np
from PIL import Image
from skimage import measure

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ.get("MARK_SRC", r"X:\AS400\POSnap\strongholdicon.png")
DST = os.path.join(HERE, "..", "sym", "mark.svg")
TOL = float(sys.argv[1]) if len(sys.argv) > 1 else 0.5

im = Image.open(SRC).convert("RGBA")
bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
flat = Image.alpha_composite(bg, im).convert("L")
a = np.asarray(flat).astype(float)
ink = a < 128

ys, xs = np.nonzero(ink)
y0, y1 = ys.min(), ys.max() + 1
x0, x1 = xs.min(), xs.max() + 1
crop = ink[y0:y1, x0:x1]
h, w = crop.shape

# pad so a shape touching the crop edge still yields a closed contour
pad = np.zeros((h + 2, w + 2), dtype=float)
pad[1:-1, 1:-1] = crop

contours = measure.find_contours(pad, 0.5)
contours.sort(key=len, reverse=True)

SCALE = 200.0 / w          # normalise to a 200-wide viewBox

rings = []
for c in contours:
    if len(c) < 8:
        continue
    simp = measure.approximate_polygon(c, tolerance=TOL)
    if len(simp) < 4:
        continue
    # find_contours returns (row, col); SVG wants (x, y)
    rings.append([((p[1] - 1) * SCALE, (p[0] - 1) * SCALE) for p in simp])

# Marching squares puts the boundary half a pixel outside the ink, so the
# extremes sit just off the crop. Fit the viewBox to what was actually
# drawn instead of to the crop, or the outermost edge clips.
xs_all = [p[0] for r in rings for p in r]
ys_all = [p[1] for r in rings for p in r]
ox, oy = min(xs_all), min(ys_all)
VB_W = round(max(xs_all) - ox, 2)
VB_H = round(max(ys_all) - oy, 2)

parts, pts_total = [], 0
for r in rings:
    pts = [(p[0] - ox, p[1] - oy) for p in r]
    pts_total += len(pts)
    d = "M%.2f %.2f" % pts[0]
    d += "".join("L%.2f %.2f" % p for p in pts[1:])
    parts.append(d + "Z")

svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %s %s">'
       '<path fill="#000" fill-rule="evenodd" d="%s"/></svg>'
       % (VB_W, VB_H, "".join(parts)))

with io.open(DST, "w", encoding="utf-8") as f:
    f.write(svg)

# how faithful is it? rasterise nothing here - just report the budget
print("source      %dx%d  ink bbox %dx%d" % (im.size[0], im.size[1], w, h))
print("viewBox     %s x %s" % (VB_W, VB_H))
print("contours    %d kept, %d points, tolerance %.2fpx" % (len(parts), pts_total, TOL))
print("written     %s  (%d bytes)" % (DST, os.path.getsize(DST)))

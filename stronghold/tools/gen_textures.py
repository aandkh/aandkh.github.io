# Tileable greyscale material textures, generated so the site owns them
# outright. Everything is built in the frequency domain, which is what
# makes it seamless: a field synthesised from a finite set of periodic
# components is periodic, so the tile wraps with no visible seam.
import numpy as np
from PIL import Image, ImageFilter
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                   "tex")
os.makedirs(OUT, exist_ok=True)
N = 256
rng = np.random.default_rng(20260816)


def radial_freq(n):
    fy = np.fft.fftfreq(n)[:, None]
    fx = np.fft.fftfreq(n)[None, :]
    r = np.sqrt(fx ** 2 + fy ** 2)
    r[0, 0] = 1e-6
    return r


def fractal(n, beta=1.8, seed=None):
    """1/f^beta noise. Periodic by construction, so it tiles."""
    g = np.random.default_rng(seed) if seed is not None else rng
    white = g.standard_normal((n, n))
    F = np.fft.fft2(white) / (radial_freq(n) ** beta)
    F[0, 0] = 0
    out = np.real(np.fft.ifft2(F))
    return norm(out)


def norm(a):
    a = a - a.min()
    m = a.max()
    return a / m if m else a


def anisotropic(n, ax=0.35, ay=3.0, beta=1.6, seed=None):
    """Stretched noise - fibres running one way."""
    g = np.random.default_rng(seed) if seed is not None else rng
    fy = np.fft.fftfreq(n)[:, None] * ay
    fx = np.fft.fftfreq(n)[None, :] * ax
    r = np.sqrt(fx ** 2 + fy ** 2)
    r[0, 0] = 1e-6
    F = np.fft.fft2(g.standard_normal((n, n))) / (r ** beta)
    F[0, 0] = 0
    return norm(np.real(np.fft.ifft2(F)))


def emboss(h, strength=1.0):
    """Light from the upper left, the way every relief is lit. The
    differences are taken with roll, not gradient, so the derivative
    wraps too - otherwise the tile carries a seam down one edge."""
    gx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * 0.5
    gy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * 0.5
    lit = 0.5 + strength * (gx * 0.7 + gy * 0.7)
    return np.clip(lit, 0, 1)


def seam_check(a, name):
    """A tile is seamless when the wrap-around step is no worse than a
    typical interior step. Ratios near 1 pass; a hard edge spikes."""
    interior_x = np.abs(np.diff(a, axis=1)).mean()
    wrap_x = np.abs(a[:, 0] - a[:, -1]).mean()
    interior_y = np.abs(np.diff(a, axis=0)).mean()
    wrap_y = np.abs(a[0, :] - a[-1, :]).mean()
    rx, ry = wrap_x / max(interior_x, 1e-9), wrap_y / max(interior_y, 1e-9)
    flag = "ok" if max(rx, ry) < 1.6 else "SEAM"
    print("   seam %-9s x=%.2f y=%.2f  %s" % (name, rx, ry, flag))


def save(arr, name, mode="L"):
    arr = np.clip(arr, 0, 1)
    seam_check(arr, name)
    img = Image.fromarray((arr * 255).astype(np.uint8), "L")
    p = os.path.join(OUT, name)
    img.save(p, optimize=True)
    # WebP is far smaller for smooth greyscale; keep it lossless so a
    # tiling texture never picks up block artefacts at its edges.
    wp = p.rsplit(".", 1)[0] + ".webp"
    img.save(wp, format="WEBP", lossless=True, quality=100, method=6)
    if os.path.getsize(wp) < os.path.getsize(p):
        os.remove(p)
        return wp, os.path.getsize(wp)
    os.remove(wp)
    return p, os.path.getsize(p)


def gentle(a, spread=0.13):
    """These are overlays, not wallpaper. Centre on mid-grey and keep the
    swing small, which also stops a 256px tile announcing where it
    repeats - high contrast is what makes tiling visible."""
    a = norm(a) - 0.5
    a = a / max(np.abs(a).max(), 1e-9) * spread
    return 0.5 + a


# ---- VELLUM: soft cloudy blotching, the faintest fibre, some foxing --
fib = anisotropic(N, ax=0.75, ay=2.1, beta=1.7, seed=11)
blot = fractal(N, beta=2.7, seed=12)
vel = 0.25 * fib + 0.75 * blot
fox = np.zeros((N, N))
g2 = np.random.default_rng(77)
yy, xx = np.ogrid[:N, :N]
for _ in range(18):
    y, x = g2.integers(0, N, 2)
    rr = g2.integers(4, 10)
    d = np.minimum(np.abs(yy - y), N - np.abs(yy - y)) ** 2 + \
        np.minimum(np.abs(xx - x), N - np.abs(xx - x)) ** 2
    fox += np.exp(-d / (2.0 * rr ** 2)) * g2.uniform(.2, .5)
vel = norm(vel) - 0.30 * norm(fox)
print("vellum   ", save(gentle(vel, 0.15), "vellum.png"))

# ---- LEATHER: pebbled grain, tooled and lit ------------------------
cell = fractal(N, beta=1.05, seed=21)
cell = norm(cell ** 1.4)
lea = emboss(cell * 2.2, strength=2.6)
lea = 0.55 * lea + 0.45 * fractal(N, beta=2.2, seed=22)
print("leather  ", save(gentle(lea, 0.14), "leather.png"))

# ---- STONE: granular and softly mottled. No cracks: at tile size a
#      crack network reads as crazed glaze and shows the repeat. -----
gran = fractal(N, beta=1.35, seed=31)
mottle = fractal(N, beta=2.8, seed=32)
grit = fractal(N, beta=0.7, seed=34)
st = 0.5 * gran + 0.34 * mottle + 0.16 * grit
print("stone    ", save(gentle(st, 0.13), "stone.png"))

# ---- OAK: grain running the long way, undulating slowly. Real grain
#      is near-parallel; the earlier warp turned it into contours. ---
yy2, xx2 = np.mgrid[0:N, 0:N]
# Two warps at different scales: the slow one bunches and spreads the
# grain so the spacing is never even, the faster one gives each line its
# own wander. Evenly spaced lines read as corduroy, not timber.
# In anisotropic(), a LARGE ay attenuates high frequencies along y, so
# the field changes slowly down the board - which is what keeps the
# grain running straight. A small ay lets it change fast and the lines
# come out as chevrons.
slow = anisotropic(N, ax=0.45, ay=4.5, beta=2.3, seed=41)
fastw = anisotropic(N, ax=0.9, ay=3.2, beta=2.0, seed=43)
phase = (xx2 / N) * 2 * np.pi * 7.0 + (slow - 0.5) * 5.5 + (fastw - 0.5) * 1.1
rings = 0.5 + 0.5 * np.sin(phase)
rings = rings ** 1.7
# and let some lines be darker than others, as the earlywood is
weight = 0.55 + 0.45 * anisotropic(N, ax=0.45, ay=4.5, beta=2.4, seed=44)
rings = 0.5 + (rings - 0.5) * weight
fine = anisotropic(N, ax=0.3, ay=3.0, beta=1.5, seed=42)
oak = 0.7 * rings + 0.3 * fine
print("oak      ", save(gentle(oak, 0.13), "oak.png"))

print("\ntotal", sum(os.path.getsize(os.path.join(OUT, f))
                     for f in os.listdir(OUT)), "bytes")

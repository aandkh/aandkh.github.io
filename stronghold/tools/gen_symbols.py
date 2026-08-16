# Hand-authored heraldic glyphs. Solid black on transparent so they can
# be used as CSS masks - one file then takes whatever colour the theme
# hands it, instead of needing a copy per colour.
#
# Holes have to be real transparency, not white fill: a mask reads the
# alpha channel, so a white "cutout" would come back solid.
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                   "sym")
os.makedirs(OUT, exist_ok=True)


def svg(solid, holes="", size=24):
    head = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d">'
            % (size, size))
    if not holes:
        return head + '<g fill="#000">%s</g></svg>' % solid
    return (head +
            '<defs><mask id="h"><rect width="%d" height="%d" fill="#fff"/>%s'
            '</mask></defs><g fill="#000" mask="url(#h)">%s</g></svg>'
            % (size, size, holes, solid))


SYM = {}

# The keep itself: crenellated tower, arched door, two loops.
SYM["tower"] = svg(
    solid='<path d="M3 8h3V5h2v3h3V5h2v3h3V5h2v3h3v2h-1v11H4V10H3V8z"/>',
    holes='<path d="M10 21v-5a2 2 0 0 1 4 0v5h-4z" fill="#000"/>'
          '<rect x="7.4" y="12" width="1.8" height="3.4" rx=".9" fill="#000"/>'
          '<rect x="14.8" y="12" width="1.8" height="3.4" rx=".9" fill="#000"/>')

# Court: a crown, three points, pearled.
SYM["crown"] = svg(
    solid='<path d="M3 9l3.6 3.4L9.4 6l2.6 5.2L14.6 6l2.8 6.4L21 9l-1.4 8.6H4.4L3 9z"/>'
          '<rect x="4.2" y="18.4" width="15.6" height="2.4" rx="1"/>'
          '<circle cx="3" cy="8" r="1.6"/><circle cx="21" cy="8" r="1.6"/>'
          '<circle cx="12" cy="4.4" r="1.8"/>')

# Lands: a sheaf, bound.
SYM["sheaf"] = svg(
    solid='<path d="M11.2 3.4c.4 3 .4 6 0 9h1.6c-.4-3-.4-6 0-9h-1.6z"/>'
          '<path d="M7.6 5.2c1 2.8 1.6 5.4 1.8 7.6l1.5-.4C10.5 10 9.7 7.6 8.4 5l-.8.2z"/>'
          '<path d="M16.4 5.2c-1 2.8-1.6 5.4-1.8 7.6l-1.5-.4c.4-2.4 1.2-4.8 2.5-7.4l.8.2z"/>'
          '<path d="M6 20.6c1.4-3.4 3.2-5.6 6-5.6s4.6 2.2 6 5.6l-1.6.6c-1.2-2.8-2.5-4.4-4.4-4.4'
          's-3.2 1.6-4.4 4.4L6 20.6z"/>'
          '<rect x="8.6" y="12.6" width="6.8" height="2.2" rx="1.1"/>')

# Muster: crossed blades.
SYM["swords"] = svg(
    solid='<path d="M5.1 3.6l2.1-.7 9.6 12.9-1.7 1.3L5.1 3.6z"/>'
          '<path d="M18.9 3.6l-2.1-.7-9.6 12.9 1.7 1.3L18.9 3.6z"/>'
          '<rect x="3.4" y="17.2" width="6.2" height="1.9" rx=".9" '
          'transform="rotate(-38 6.5 18.1)"/>'
          '<rect x="14.4" y="17.2" width="6.2" height="1.9" rx=".9" '
          'transform="rotate(38 17.5 18.1)"/>'
          '<circle cx="6.2" cy="21.1" r="1.5"/><circle cx="17.8" cy="21.1" r="1.5"/>')

# Coffers: a struck coin.
SYM["coin"] = svg(
    solid='<circle cx="12" cy="12" r="9.4"/>'
          '<circle cx="12" cy="12" r="1.3"/>',
    holes='<circle cx="12" cy="12" r="7.2" fill="#000"/>'
          '<rect x="11" y="4.4" width="2" height="15.2" fill="#fff"/>'
          '<rect x="4.4" y="11" width="15.2" height="2" fill="#fff"/>'
          '<circle cx="12" cy="12" r="2.7" fill="#000"/>')

# Letters: a folded sheet under a seal.
SYM["scroll"] = svg(
    solid='<path d="M5 3.4h11.4l2.6 2.6v11.2c0 .7-.5 1.2-1.2 1.2H5c-.7 0-1.2-.5-1.2-1.2V4.6'
          'c0-.7.5-1.2 1.2-1.2z"/>'
          '<circle cx="17.4" cy="17.8" r="3.8"/>',
    holes='<path d="M6.6 7h9v1.5h-9zM6.6 10h9v1.5h-9zM6.6 13h6v1.5h-6z" fill="#000"/>'
          '<path d="M17.4 15.6l.8 1.5 1.7.2-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.2z" '
          'fill="#000"/>')

# Chronicle: a bound book, clasped.
SYM["book"] = svg(
    solid='<path d="M5 3.6h11a3 3 0 0 1 3 3v13.8H8a3 3 0 0 1-3-3V3.6z"/>'
          '<rect x="16.4" y="9.6" width="3.4" height="4.2" rx="1"/>',
    holes='<path d="M7.2 5.8h9v10.4h-9z" fill="#000"/>'
          '<path d="M8.8 8h5.8v1.3H8.8zM8.8 10.6h5.8v1.3H8.8zM8.8 13.2h3.8v1.3H8.8z" '
          'fill="#fff"/>')

# A fleuron, for rules and dividers.
SYM["fleuron"] = svg(
    solid='<path d="M12 3.2c1.9 2.6 3 4.7 3 6.6 0 1.6-.9 2.7-3 4.1-2.1-1.4-3-2.5-3-4.1'
          '0-1.9 1.1-4 3-6.6z"/>'
          '<path d="M12 14.6c2.4 1.7 4 2.1 5.6 1.5 1.4-.5 2.1-1.7 2.2-3.3-2.3.2-4 .5-5.3 1.1'
          '-.9.4-1.7.9-2.5 1.5z"/>'
          '<path d="M12 14.6c-2.4 1.7-4 2.1-5.6 1.5-1.4-.5-2.1-1.7-2.2-3.3 2.3.2 4 .5 5.3 1.1'
          '.9.4 1.7.9 2.5 1.5z"/>'
          '<circle cx="12" cy="17.6" r="1.5"/>'
          '<path d="M11.3 19.4h1.4v2.4h-1.4z"/>')

# The great seal: a medallion for the gate. Beaded ring, rays, the keep.
rays = "".join(
    '<rect x="49.2" y="8.5" width="1.6" height="6.5" rx=".8" '
    'transform="rotate(%d 50 50)"/>' % (i * 30) for i in range(12))
beads = "".join(
    '<circle cx="50" cy="4.6" r="1.5" transform="rotate(%d 50 50)"/>' % (i * 12)
    for i in range(30))
SYM["seal"] = svg(
    solid=beads + rays +
    '<circle cx="50" cy="50" r="37.5"/>'
    '<circle cx="50" cy="50" r="31"/>'
    '<path d="M34 44h6v-6h4v6h6v-6h4v6h6v5h-2v20H36V49h-2v-5z"/>',
    holes='<circle cx="50" cy="50" r="34.5" fill="#000"/>'
          '<circle cx="50" cy="50" r="28.4" fill="#fff"/>'
          '<path d="M46 69v-9a4 4 0 0 1 8 0v9h-8z" fill="#000"/>'
          '<rect x="39" y="52" width="3.4" height="6.4" rx="1.7" fill="#000"/>'
          '<rect x="57.6" y="52" width="3.4" height="6.4" rx="1.7" fill="#000"/>',
    size=100)

for name, data in SYM.items():
    p = os.path.join(OUT, name + ".svg")
    with open(p, "w", encoding="utf-8") as f:
        f.write(data)
    print("%-9s %5d bytes" % (name, os.path.getsize(p)))

print("\ntotal", sum(os.path.getsize(os.path.join(OUT, f))
                     for f in os.listdir(OUT)), "bytes")

#!/usr/bin/env python3
"""Build spatial flood-map assets from the committed, checked reference only.
No source download, new simplification, or verification-date renewal occurs.
"""
import gzip
import json
import math
import pathlib
from collections import defaultdict
from PIL import Image, ImageDraw
from shapely.geometry import shape, box, mapping, MultiPolygon
from shapely.strtree import STRtree

ROOT = pathlib.Path(__file__).resolve().parent.parent
COLORS = ['#4b9fff', '#f2ba4b', '#2360ce', '#c08af0', '#8eabb9']
PIXELS = 512
STEP = .25

def polygons(geometry):
    if geometry.is_empty:
        return []
    if geometry.geom_type == 'Polygon':
        return [geometry]
    if geometry.geom_type in ('MultiPolygon', 'GeometryCollection'):
        return [p for part in geometry.geoms for p in polygons(part)]
    return []

def mercator_y(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))

def render_image(features, bounds, path):
    west, south, east, north = bounds
    low, high = mercator_y(south), mercator_y(north)
    image = Image.new('P', (PIXELS, PIXELS), 0)
    palette = [0, 0, 0]
    for color in COLORS:
        palette.extend(int(color[i:i + 2], 16) for i in (1, 3, 5))
    image.putpalette(palette + [0] * (768 - len(palette)))
    for index, feature in enumerate(features):
        if feature is None:
            continue
        mask = Image.new('L', (PIXELS, PIXELS), 0)
        for polygon in feature['geometry']['coordinates']:
            rings = [[((p[0] - west) / (east - west) * PIXELS,
                       (high - mercator_y(p[1])) / (high - low) * PIXELS)
                      for p in ring] for ring in polygon]
            xs, ys = zip(*rings[0])
            left, top = max(0, math.floor(min(xs))), max(0, math.floor(min(ys)))
            right, bottom = min(PIXELS, math.ceil(max(xs)) + 1), min(PIXELS, math.ceil(max(ys)) + 1)
            if right <= left or bottom <= top:
                continue
            part = Image.new('L', (right - left, bottom - top), 0)
            draw = ImageDraw.Draw(part)
            for ring_index, ring in enumerate(rings):
                draw.polygon([(x - left, y - top) for x, y in ring], fill=255 if ring_index == 0 else 0)
            # Holes in one polygon must not erase another polygon beneath it.
            mask.paste(255, (left, top, right, bottom), part)
        image.paste(index + 1, (0, 0, PIXELS, PIXELS), mask)
    image.save(path, transparency=0, optimize=True)

def main():
    source = json.loads(gzip.decompress((ROOT / 'data/floodplains.bin').read_bytes()))
    root = ROOT / 'data/flood-map'
    root.mkdir(exist_ok=True)
    pieces, group_indices = [], []
    groups = [f['properties'] for f in source['features']]
    for index, feature in enumerate(source['features']):
        for polygon in shape(feature['geometry']).geoms:
            if not polygon.is_empty and polygon.area > 0:
                pieces.append(polygon)
                group_indices.append(index)
    tree = STRtree(pieces)
    west, south, east, north = source['bounds']
    tiles = []
    for row in range(math.ceil((north - south) / STEP)):
        for col in range(math.ceil((east - west) / STEP)):
            bounds = [west + STEP * col, south + STEP * row,
                      min(east, west + STEP * (col + 1)), min(north, south + STEP * (row + 1))]
            extent = box(*bounds)
            grouped = defaultdict(list)
            for index in tree.query(extent, predicate='intersects'):
                clipped = pieces[index].intersection(extent)
                grouped[group_indices[index]].extend(p for p in polygons(clipped) if p.area > 0)
            if not grouped:
                continue
            features = [None] * len(groups)
            for index, parts in grouped.items():
                features[index] = {'type': 'Feature', 'properties': groups[index],
                                   'geometry': mapping(MultiPolygon(parts))}
            name = f'{col}-{row}'
            data_path, image_path = root / f'{name}.bin', root / f'{name}.png'
            payload = {'type': 'FeatureCollection', 'bounds': bounds,
                       'features': [f for f in features if f]}
            raw = json.dumps(payload, separators=(',', ':'), ensure_ascii=False).encode()
            data_path.write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
            render_image(features, bounds, image_path)
            vertices = sum(len(ring) for feature in payload['features'] for polygon in feature['geometry']['coordinates'] for ring in polygon)
            tiles.append({'id': name, 'bounds': bounds, 'bytes': data_path.stat().st_size,
                          'imageBytes': image_path.stat().st_size, 'vertices': vertices})
    manifest = {key: value for key, value in source.items() if key != 'features'}
    manifest.update(type='FloodMapManifest', version=1, step=STEP, imagePixels=PIXELS,
                    vectorZoom=12, groups=groups, tiles=tiles)
    (root / 'index.json').write_text(json.dumps(manifest, separators=(',', ':'), ensure_ascii=False) + '\n')
    old = ROOT / 'data/floodplains-map.bin'
    if old.exists():
        old.unlink()
    print(json.dumps({'tiles': len(tiles), 'imageBytes': sum(t['imageBytes'] for t in tiles),
                      'vectorBytes': sum(t['bytes'] for t in tiles), 'vertices': sum(t['vertices'] for t in tiles)}))

if __name__ == '__main__':
    main()

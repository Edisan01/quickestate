# Planbild (WMTS flwbplmzk/rot, Stadt Wien, CC BY 4.0) um Testpunkte holen und zu einem Bild zusammensetzen.
# Aufruf: python3 planbild_holen.py faelle.json ausgabeordner [zoom] [radius_kacheln]
import json, math, sys, os, urllib.request, io
from PIL import Image
F = json.load(open(sys.argv[1])); OUT = sys.argv[2]; Z = int(sys.argv[3]) if len(sys.argv) > 3 else 19; R = int(sys.argv[4]) if len(sys.argv) > 4 else 3
os.makedirs(OUT, exist_ok=True)
def kachel(lon, lat, z):
    n = 2 ** z; la = math.radians(lat); return (lon + 180) / 360 * n, (1 - math.log(math.tan(la) + 1 / math.cos(la)) / math.pi) / 2 * n
for name, kg, gnr, (lon, lat) in F:
    fx, fy = kachel(lon, lat, Z); cx, cy = int(fx), int(fy)
    im = Image.new('RGB', ((2 * R + 1) * 256, (2 * R + 1) * 256), 'white')
    for dx in range(-R, R + 1):
        for dy in range(-R, R + 1):
            u = f'https://maps.wien.gv.at/wmts/flwbplmzk/rot/google3857/{Z}/{cy + dy}/{cx + dx}.jpeg'
            try:
                b = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'quickestate-test'}), timeout=8).read()
                im.paste(Image.open(io.BytesIO(b)).convert('RGB'), ((dx + R) * 256, (dy + R) * 256))
            except Exception as e: print('Fehler', u, e, flush=True)
    key = f'{kg}_{gnr.replace("/", "-")}'
    im.save(f'{OUT}/{key}.png')
    json.dump({'name': name, 'kg': kg, 'gnr': gnr, 'z': Z, 'x0': cx - R, 'y0': cy - R, 'punkt': [lon, lat]}, open(f'{OUT}/{key}.json', 'w'))
    print("ok", name, key, flush=True)

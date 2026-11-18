# Planbild (WMTS flwbplmzk/rot, Stadt Wien, CC BY 4.0) um Testpunkte holen und zu einem Bild zusammensetzen.
# Aufruf: python3 planbild_holen.py faelle.json ausgabeordner [zoom] [radius_kacheln]
import json, math, sys, os, urllib.request, urllib.parse, io, time
from PIL import Image
F = json.load(open(sys.argv[1])); OUT = sys.argv[2]; Z = int(sys.argv[3]) if len(sys.argv) > 3 else 19; R = int(sys.argv[4]) if len(sys.argv) > 4 else 3
os.makedirs(OUT, exist_ok=True)
def kachel(lon, lat, z):
    n = 2 ** z; la = math.radians(lat); return (lon + 180) / 360 * n, (1 - math.log(math.tan(la) + 1 / math.cos(la)) / math.pi) / 2 * n
def geo(adr):
    u = 'https://data.wien.gv.at/daten/OGDAddressService.svc/GetAddressInfo?Address=' + urllib.parse.quote(adr) + '&crs=EPSG:4326'
    return json.load(urllib.request.urlopen(u, timeout=20))['features'][0]['geometry']['coordinates'][:2]
for name, kg, gnr, pt in F:
    key = f'{kg}_{gnr.replace("/", "-")}'
    if os.path.exists(f'{OUT}/{key}.png'): continue
    lon, lat = pt or geo(name)
    fx, fy = kachel(lon, lat, Z); cx, cy = int(fx), int(fy)
    im = Image.new('RGB', ((2 * R + 1) * 256, (2 * R + 1) * 256), 'white')
    for dx in range(-R, R + 1):
        for dy in range(-R, R + 1):
            u = f'https://maps.wien.gv.at/wmts/flwbplmzk/rot/google3857/{Z}/{cy + dy}/{cx + dx}.jpeg'
            for v in range(6):
                try:
                    b = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'quickestate-test'}), timeout=20).read()
                    im.paste(Image.open(io.BytesIO(b)).convert('RGB'), ((dx + R) * 256, (dy + R) * 256)); break
                except Exception as e: print('Fehler', v, u, e, flush=True); time.sleep(30 * (v + 1))
            time.sleep(2)
    im.save(f'{OUT}/{key}.png')
    json.dump({'name': name, 'kg': kg, 'gnr': gnr, 'z': Z, 'x0': cx - R, 'y0': cy - R, 'punkt': [lon, lat]}, open(f'{OUT}/{key}.json', 'w'))
    print("ok", name, key, flush=True)

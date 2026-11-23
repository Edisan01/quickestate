import unittest
import cv2
import numpy as np
from kataster_detail import untersuchen
class TestKatasterDetail(unittest.TestCase):
    def bild(self):return np.full((400,400,3),255,np.uint8)
    def grund(self):return [[[[50,50],[350,50],[350,350],[50,350],[50,50]]]]
    def test_drei_sichtbare_bereiche(self):
        im=self.bild();cv2.line(im,(20,210),(380,210),(230,0,0),2);cv2.line(im,(170,20),(170,210),(230,0,0),2)
        r=untersuchen(im,self.grund(),.2);self.assertEqual(r['anzahl_vorschlaege'],3);self.assertAlmostEqual(r['kontrolle']['summe_m2'],3600);self.assertLess(r['kontrolle']['luecke_m2'],1e-7)
    def test_keine_linie_keine_erfundene_teilung(self):
        r=untersuchen(self.bild(),self.grund(),.2);self.assertEqual(r['anzahl_vorschlaege'],1)
    def test_kurzer_strich_wird_nicht_zur_grenze_verlaengert(self):
        im=self.bild();cv2.line(im,(150,210),(210,210),(230,0,0),2);r=untersuchen(im,self.grund(),.2);self.assertEqual(r['anzahl_vorschlaege'],1)
    def test_grundstuecksgrenze_schwarz_ist_keine_widmungsgrenze(self):
        im=self.bild();cv2.line(im,(20,210),(380,210),(0,0,0),2);self.assertEqual(untersuchen(im,self.grund(),.2)['anzahl_vorschlaege'],1)
    def test_kein_rechteckzwang(self):
        pg=[[[[50,50],[350,50],[350,350],[200,250],[50,350],[50,50]]]];r=untersuchen(self.bild(),pg,.2);self.assertAlmostEqual(r['kontrolle']['summe_m2'],3000)
    def test_massstab_noetig(self):
        with self.assertRaises(ValueError):untersuchen(self.bild(),self.grund(),0)
if __name__=='__main__':unittest.main()

class TestOriginalDarwing(unittest.TestCase):
    def test_originalbild_gegen_separates_soll(self):
        import json
        from pathlib import Path
        from PIL import Image
        from kataster_detail import pixelrahmen
        root=Path(__file__).resolve().parents[2];d=root/'tools/pruefung/kataster_detail_2026-11-22'
        soll=json.loads((root/'tools/pruefung/soll.json').read_text())['kataster_detail_versuch_testfaelle'][0]
        b=json.loads((d/'darwing5_basis.json').read_text());r=untersuchen(np.array(Image.open(d/'darwing5_original.png').convert('RGB')),b['polys_px'],b['mpp'],pixelrahmen(b))
        self.assertEqual(r['anzahl_vorschlaege'],soll['anzahl_bereiche'])
        self.assertLess(r['kontrolle']['luecke_m2'],soll['max_numerische_luecke_m2'])
        self.assertLess(r['kontrolle']['ueberlappung_m2'],soll['max_numerische_ueberlappung_m2'])
        self.assertFalse(r['fachlich_freigegeben']);self.assertTrue(all(t['widmung'] is None for t in r['teilflaechen']))

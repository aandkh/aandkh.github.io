"""Offline regression checks for the EPA versioned hourly gas source."""
import csv
import io
import pathlib
import runpy
from datetime import datetime,timedelta,timezone
import unittest
m=runpy.run_path(str(pathlib.Path(__file__).with_name('build-airnow-gases.py')))
h=datetime(2026,11,18,15,tzinfo=timezone.utc)
now=h+timedelta(hours=1,minutes=42)
row={'AQSID':'840291890016','SiteName':'Rider Trail I-70','Status':'Active','CountryCode':'US',
     'StateName':'MO','ValidDate':'11/18/2026','ValidTime':'15:00','DataSource':'Reporting agency',
     'Latitude':'38.75264','Longitude':'-90.44884','NO2_Measured':'1','NO2':'24.4','NO2_AQI':'23.0',
     'NO2_Unit':'PPB','SO2':'2.1','SO2_Unit':'PPB','CO':'','CO_Unit':''}
def make(rows):
    f=io.StringIO(); w=csv.DictWriter(f,fieldnames=row.keys());w.writeheader();w.writerows(rows)
    return f.getvalue().encode('utf-8')
def parse(*rows,at=now):
    return m['parse_file'](make(rows),h,at)['stations']
class GasSource(unittest.TestCase):
    def test_real_shape(self):
        s,=parse(row);self.assertEqual(s['id'],'291890016')
        self.assertEqual([r['parameter'] for r in s['readings']],['NO2','SO2'])
        self.assertEqual(s['readings'][0]['aqi'],23);self.assertNotIn('aqi',s['readings'][1])
        self.assertEqual(s['readings'][0]['periodEnd'],'2026-11-18T16:00:00Z')
        self.assertTrue(s['sourceUrl'].endswith('2026111815.dat'))
    def test_nulls_units_zeros_sentinels(self):
        s,=parse({**row,'SO2':'0','NO2':'-1','CO':'0.3','CO_Unit':'PPB'})
        self.assertEqual([(r['parameter'],r['value']) for r in s['readings']],[('SO2',0)])
        self.assertFalse(parse({**row,'SO2':'-999','NO2_Measured':'0','CO':'NaN','CO_Unit':'PPM'}))
    def test_dates_geography_missing(self):
        for k,v in [('StateName','CA'),('Longitude','0'),('CountryCode','CA'),('Latitude',''),
                    ('ValidDate','11/17/26'),('ValidTime','13:00'),('Status','Inactive'),('AQSID','0')]:
            self.assertFalse(parse({**row,k:v}))
        for offset in (0,-1,5):
            with self.assertRaises(ValueError): parse(row,at=h+timedelta(hours=offset))
        self.assertTrue(parse({**row,'ValidDate':'11/18/26'}))
    def test_duplicates(self):
        self.assertEqual(len(parse(row,row)),1); self.assertFalse(parse(row,{**row,'SO2':'99'}))
    def test_schema_and_fallback(self):
        with self.assertRaises(ValueError): m['parse_file'](b'<error>\n',h,now)
        def delayed(t):
            if t>h: raise FileNotFoundError('hour not posted')
            return make([row])
        result=m['refresh'](now+timedelta(hours=1),delayed)
        self.assertEqual(result['stations'][0]['observedAt'],'2026-11-18T15:00:00Z')
if __name__=='__main__': unittest.main()

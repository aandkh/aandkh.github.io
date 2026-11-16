#!/usr/bin/env python3
"""Offline geometry edge cases for park measurements, not source-coverage claims."""
import importlib.util,pathlib,unittest
from shapely.geometry import Polygon,LineString,Point,MultiPolygon
from shapely import STRtree
spec=importlib.util.spec_from_file_location('park_metrics',pathlib.Path(__file__).with_name('park-analytics-refresh.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def index(rows):
 geoms=[g for _,g in rows];return geoms,[e for e,_ in rows],STRtree(geoms)
def indexes(**groups):return {name:index(groups.get(name,[])) for name in m.GROUPS}
def record(tags,id=1):return {'type':'way','id':id,'tags':tags}
class ParkMetricsTest(unittest.TestCase):
 def test_holes_clip_paths_and_water_and_prevent_duplicates(self):
  park=Polygon([(0,0),(100,0),(100,100),(0,100)],holes=[[(40,40),(60,40),(60,60),(40,60)]])
  line=LineString([(-20,50),(120,50)])
  allwater=Polygon([(-50,-50),(150,-50),(150,150),(-50,150)])
  d=m.metrics(park,indexes(paths=[(record({'highway':'path'}),line),(record({'highway':'path'},2),line)],water=[(record({'natural':'water','water':'lake'}),allwater)],wood=[(record({'natural':'wood'}),allwater)]))
  self.assertAlmostEqual(d['acres'],9600/m.ACRE,delta=.001)
  self.assertAlmostEqual(d['pathMiles'],round(80/m.MILE,2),'only clipped public paths outside holes count once')
  self.assertEqual(d['waterAcres'],d['acres']);self.assertEqual(d['woodlandPct'],100)
 def test_private_paths_and_paved_share(self):
  park=Polygon([(0,0),(1000,0),(1000,1000),(0,1000)])
  rows=[(record({'highway':'footway','area':'yes'},5),LineString([(0,500),(1000,500)])),(record({'highway':'path','surface':'asphalt'}),LineString([(0,100),(1000,100)])),(record({'highway':'path'},2),LineString([(0,200),(1000,200)])),(record({'highway':'path','access':'private'},3),LineString([(0,300),(1000,300)])),(record({'highway':'cycleway','foot':'no'},4),LineString([(0,400),(1000,400)]))]
  d=m.metrics(park,indexes(paths=rows));self.assertEqual(d['pavedPathPct'],50);self.assertEqual(d['pathMiles'],round(2000/m.MILE,2))
 def test_river_not_counted_as_pond(self):
  park=Polygon([(0,0),(100,0),(100,100),(0,100)])
  for water_type in ['river','basin']:
   d=m.metrics(park,indexes(water=[(record({'natural':'water','water':water_type}),park)]))
   self.assertGreater(d['waterAcres'],0);self.assertEqual(d['pondCount'],0);self.assertEqual(d['largestPondAcres'],0)
 def test_disconnected_park_area_is_sum_and_holes_excluded_from_samples(self):
  a=Polygon([(-90.3,38.6),(-90.29,38.6),(-90.29,38.61),(-90.3,38.61)],holes=[[(-90.298,38.602),(-90.292,38.602),(-90.292,38.608),(-90.298,38.608)]])
  b=Polygon([(-90.28,38.6),(-90.27,38.6),(-90.27,38.61),(-90.28,38.61)])
  geom=MultiPolygon([a,b]);projected=m.transform(m.PROJECT,geom)
  d=m.metrics(projected,indexes());self.assertAlmostEqual(d['acres'],projected.area/m.ACRE,delta=.001);self.assertIsNone(d['pavedPathPct']);self.assertIsNone(d['treeTaxaCount'])
  points=m.sample_points(projected);self.assertGreater(len(points),3)
  self.assertTrue(all(geom.buffer(.000002).covers(Point(*p)) for p in points),'elevation samples stay within actual park including holes')
 def test_duplicate_ponds_and_species_tokens(self):
  park=Polygon([(0,0),(100,0),(100,100),(0,100)])
  pond=Polygon([(10,10),(40,10),(40,40),(10,40)])
  d=m.metrics(park,indexes(water=[(record({'natural':'water','water':'pond'}),pond),(record({'natural':'water','water':'pond'},2),pond)],amenities=[(record({'natural':'tree','species':'Quercus alba; Acer rubrum'}),Point(20,20)),(record({'natural':'tree','species':'quercus alba'},3),Point(30,30))]))
  self.assertEqual(d['pondCount'],1);self.assertEqual(d['treeTaxaCount'],2)
  self.assertEqual(d['treeTaxa'],['Acer rubrum','Quercus alba'])
 def test_relation_members_not_counted_twice(self):
  coords=[{'lon':-90.3,'lat':38.6},{'lon':-90.29,'lat':38.6},{'lon':-90.29,'lat':38.61},{'lon':-90.3,'lat':38.61},{'lon':-90.3,'lat':38.6}]
  tags={'natural':'water','water':'pond'}
  raw={'elements':[{'type':'way','id':12,'tags':tags,'geometry':coords},{'type':'relation','id':13,'tags':tags,'members':[{'type':'way','ref':12,'role':'outer','geometry':coords}]}]}
  geoms,rows,tree=m.build_index(raw);self.assertEqual(len(rows),1);self.assertEqual(rows[0]['type'],'relation')
 def test_relation_hole(self):
  ring=lambda coords:[{'lon':x,'lat':y} for x,y in coords]
  e={'type':'relation','members':[{'role':'outer','geometry':ring([(0,0),(10,0),(10,10),(0,10),(0,0)])},{'role':'inner','geometry':ring([(4,4),(6,4),(6,6),(4,6),(4,4)])}]}
  g=m.element_geometry(e);self.assertEqual(g.area,96);self.assertFalse(g.contains(Point(5,5)))
if __name__=='__main__':unittest.main()

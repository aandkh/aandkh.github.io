#!/usr/bin/env python3
"""Meaningful checks for the geometry/terrain computations, without network."""
import importlib.util, pathlib, unittest
path=pathlib.Path(__file__).with_name('joyrides-refresh.py')
spec=importlib.util.spec_from_file_location('joyrides',path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class MetricsTest(unittest.TestCase):
 def test_straight_has_zero_turning(self):
  line=[[-90,38],[-89.98,38]];result=m.shape_metrics(line)
  self.assertEqual(result['directionChangeCount'],0)
  self.assertEqual(result['directionChangeDegPerMile'],0)
  self.assertAlmostEqual(result['longestStraightMiles'],m.geo.meters(*line)/1609.344,delta=.02)
 def test_right_angle_is_not_one_straight(self):
  line=[[-90,38],[-89.99,38],[-89.99,38.01]];result=m.shape_metrics(line)
  self.assertGreater(result['directionChangeDegPerMile'],40)
  self.assertGreaterEqual(result['directionChangeCount'],1)
  self.assertLess(result['longestStraightMiles'],sum(m.geo.meters(a,b) for a,b in zip(line,line[1:]))/1609.344*.7)
 def test_known_slope_and_missing_samples(self):
  points=m.geo.sample([[-90,38],[-89.98,38]],200);distance=m.cumulative(points);values=[100+d*.05 for d in distance];result=m.terrain_metrics(points,values)
  self.assertAlmostEqual(result['steepestSustainedPct'],5,delta=.1)
  self.assertGreater(result['climbFt'],200)
  self.assertEqual(result['descentFt'],0)
  values[3]=None;partial=m.terrain_metrics(points,values)
  self.assertLess(partial['terrainSampleCoverage'],1)
  self.assertNotIn('steepestSustainedPct',partial)
  self.assertNotIn('climbFt',partial)
 def test_flat_ground_is_genuinely_zero(self):
  points=m.geo.sample([[-90,38],[-89.98,38]],200);result=m.terrain_metrics(points,[100]*len(points))
  self.assertEqual(result['climbFt'],0);self.assertEqual(result['steepestSustainedPct'],0)
if __name__=='__main__':unittest.main()

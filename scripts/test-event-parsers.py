import importlib.util,json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def module(name):
 spec=importlib.util.spec_from_file_location(name,ROOT/('refresh-'+name+'.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
movies=module('movies');sports=module('sports')
class EventParsers(unittest.TestCase):
 def test_fever_correct_date_and_optional_facts(self):
  d={'/countries/united-states/venues/local/':{'name':'Local','latitude':38.6,'longitude':-90.2,'address':'Local St'},'movie_sessions_for_date/2026-11-16/':[{'title':'Film','screenFormatSessions':[{'sessions':[{'sessionId':1,'time':'2026-11-16T19:00:00-06:00'}]}]}]}
  text='<script id="serverapp-state" type="application/json">'+json.dumps(d)+'</script>'
  p=movies.parse_fever(text,'local','2026-11-16')[0]['properties'];self.assertEqual(p['title'],'Film');self.assertNotIn('runtimeMinutes',p);self.assertNotIn('contentRating',p)
  with self.assertRaises(ValueError):movies.parse_fever(text,'local','2026-11-17')
 def test_sidearm_home_only_timezone_and_tba(self):
  def event(venue,time):return {'@type':'SportsEvent','location':{'name':venue},'startDate':time,'awayTeam':{'name':'Visitors'}}
  data=[event('Chaifetz Arena (Basketball)','2027-03-15T19:00:00'),event('Chaifetz Arena (Basketball)','2027-03-16T00:00:00'),event('Away venue','2027-03-17T19:00:00')]
  text='<script type="application/ld+json">'+json.dumps(data)+'</script>';rows=sports.parse_sidearm(text,'slu','SLU','chaifetz','https://example.org')
  self.assertEqual(len(rows),2);self.assertTrue(rows[0]['properties']['start'].endswith('-05:00'));self.assertEqual(rows[1]['properties']['start'],'2027-03-16');self.assertTrue(rows[1]['properties']['timeTBA'])
 def test_slsc_excludes_canceled_recurrence_date(self):
  event={'title':'OMNIMAX: Film','start':'2026-11-16T19:00:00-06:00','permalink':'https://example.org/film','details':'RATING: G RUNTIME: Approx. 45 minutes.','rset':json.dumps([{'type':'EXDATE','EXDATE':{'date':'2026-11-16T00:00:00'}}])}
  self.assertEqual(movies.parse_slsc('eventSources: '+json.dumps([[event]])),[])
  event['rset']='[]';p=movies.parse_slsc('eventSources: '+json.dumps([[event]]))[0]['properties'];self.assertEqual(p['runtimeMinutes'],45);self.assertEqual(p['contentRating'],'G')
if __name__=='__main__':unittest.main()

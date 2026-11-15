#!/usr/bin/env python3
"""Run source refreshes independently; keep successful results and report failures.

This is invoked by the existing 6 a.m. maintenance task, not a second scheduler.
It does not publish. Changed facts still require the documented source review.
"""
import argparse, concurrent.futures, datetime as dt, json, pathlib, subprocess, sys, time
ROOT=pathlib.Path(__file__).resolve().parents[1]
JOBS={
 'venues':['refresh-venue-events.py'],
 'movies':['refresh-movies.py'],
 'sports':['refresh-sports.py'],
 'foodtrucks':['refresh-foodtrucks.py'],
 'local':['local-discovery-maintenance.py','--refresh-unchanged'],
 'incidents':['incident-refresh.py','--days','45'],
 'cycling':['cycling-refresh.py'],
 'joyrides':['joyrides-refresh.py'],
 'rivers':['river-refresh.py'],
 'sky':['sky-lights-refresh.py'],
 'outages':['outages-refresh.py'],
}
def run_job(item):
 name,args=item;start=time.monotonic()
 try:
  p=subprocess.run([sys.executable,str(ROOT/'scripts'/args[0]),*args[1:]],cwd=ROOT,text=True,capture_output=True,timeout=900)
  if name=='incidents':
   city=subprocess.run([sys.executable,str(ROOT/'scripts'/'incident-city-refresh.py'),'--days','30'],cwd=ROOT,text=True,capture_output=True,timeout=900)
   p.stdout+='\nCity refresh:\n'+city.stdout;p.stderr+='\n'+city.stderr;p.returncode=p.returncode or city.returncode
  return {'name':name,'ok':p.returncode==0,'exitCode':p.returncode,'seconds':round(time.monotonic()-start,1),'stdout':p.stdout[-16000:],'stderr':p.stderr[-8000:]}
 except Exception as e:return {'name':name,'ok':False,'error':str(e),'seconds':round(time.monotonic()-start,1)}
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--only',nargs='+',choices=list(JOBS));p.add_argument('--workers',type=int,default=3);p.add_argument('--report',default='/tmp/andymap-refresh-report.json');p.add_argument('--list',action='store_true');a=p.parse_args()
 jobs=[(k,v) for k,v in JOBS.items() if not a.only or k in a.only]
 if a.list:
  for name,args in jobs:print(name+': python scripts/'+' '.join(args))
  return 0
 results=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(3,a.workers))) as pool:
  for result in pool.map(run_job,jobs):
   results.append(result);print(('PASS' if result['ok'] else 'REVIEW')+' '+result['name']+' ('+str(result['seconds'])+'s)',flush=True)
 report={'attemptedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'results':results,'note':'Successful HTTP retrieval does not establish complete coverage. Review source-level warnings and the maintenance guides before publishing.'}
 pathlib.Path(a.report).write_text(json.dumps(report,indent=2)+'\n');print('Report: '+a.report)
 return 0 if all(r['ok'] for r in results) else 1
if __name__=='__main__':raise SystemExit(main())

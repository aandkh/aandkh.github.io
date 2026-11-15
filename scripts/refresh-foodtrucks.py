#!/usr/bin/env python3
"""Refresh factual association schedules and operator links without invented pins.

python scripts/refresh-foodtrucks.py
Optional --calendar-html/--members-html use saved, reviewed source HTML for tests.
"""
import argparse
import datetime as dt
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://stlfta.com'
ZONE = ZoneInfo('America/Chicago')
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
FRANCHISES = {'cousins maine lobster mo','kona ice of st. louis/arnold',"travelin' tom’s coffee",'gelü italian ice'}

class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []
    def find(self, cls):
        return next((n for n in self.walk() if cls in n.attrs.get('class','').split()), None)
    def walk(self):
        yield self
        for n in self.children:
            if isinstance(n, Node): yield from n.walk()
    def text(self):
        return re.sub(r'\s+', ' ', ''.join(c.text()+' ' if isinstance(c,Node) else c for c in self.children)).strip()

class Tree(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.root=Node();self.stack=[self.root];self.feed(text)
    def handle_starttag(self,tag,attrs):
        n=Node(tag,attrs);self.stack[-1].children.append(n)
        if tag not in VOID:self.stack.append(n)
    def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs);self.handle_endtag(tag)
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag==tag:self.stack=self.stack[:i];break
    def handle_data(self,data):self.stack[-1].children.append(data)

def iso(value):return value.astimezone(dt.timezone.utc).isoformat().replace('+00:00','Z')
def text(node,cls):
    n=node.find(cls);return n.text() if n else ''
def feature(identifier,properties,point=None):
    return {'type':'Feature','id':identifier,'geometry':{'type':'Point','coordinates':point} if point else None,'properties':{'id':identifier,'layer':'foodtrucks',**properties}}
def fetch(url):
    request=urllib.request.Request(url,headers={'User-Agent':'Andymap/1.0 public calendar refresh (https://www.andrewhanes.com)','Accept':'text/html'})
    with urllib.request.urlopen(request,timeout=25) as response:return response.read().decode('utf-8',errors='replace')
def event_end(start,label):
    match=re.search(r'[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b',label,re.I)
    if not match:return None
    h=int(match[1])%12+(12 if match[3].lower()=='pm' else 0)
    end=start.replace(hour=h,minute=int(match[2] or 0),second=0,microsecond=0)
    return end+dt.timedelta(days=1) if end<=start else end

def parse_calendar(raw,now):
    result=[]
    for n in Tree(raw).root.walk():
        if 'eve_row' not in n.attrs.get('class','').split():continue
        try:
            start=dt.datetime.fromtimestamp(int(n.attrs['st']),ZONE)
            lat,lng=float(n.attrs['lat']),float(n.attrs['lng'])
            if not (38.1<=lat<=39.2 and -91.2<=lng<=-89.4):continue
        except (KeyError,ValueError,OverflowError):continue
        name=text(n,'eve_name');venue=text(n,'eve_addy');label=text(n,'eve_time')
        if not name or name.casefold() in FRANCHISES or re.search(r'\bprivate\b|\bphotoshoot\b',venue,re.I):continue
        end=event_end(start,label)
        if (end or start)<now:continue
        street=text(n,'eve_st1');city=text(n,'eve_st2');address=', '.join(x for x in [street,city] if x)
        ident='foodtruck-stop-'+n.attrs.get('id','').replace('post_','')
        slug=n.attrs.get('tname','');url=BASE+'/member/'+urllib.parse.quote(slug)
        access='Published scheduled stop, not a live GPS position. Confirm service and public access with the operator.'
        if re.search(r'\bschool|\belementary|\bboeing|\bcorporate|\bcharter|\bspectrum|\bssm|\bbuild.a.bear|\bsafety national',venue,re.I):
            access='Workplace or school stop: access may be restricted. Check with the operator before travelling.'
        props={'title':name,'operator':name,'operatorSlug':slug,'venue':venue,'address':address,'description':venue+' · '+text(n,'eve_cuis'),
               'start':iso(start),'end':iso(end) if end else '', 'displayKind':'scheduled-stop','source':'St. Louis Food Truck Association · operator schedule',
               'sourceUrl':BASE+'/','url':url,'website':url,'calendarUrl':url,'sourceCheckedAt':iso(now),'checkedAt':iso(now),
               'expiresAt':iso(min(end or start+dt.timedelta(hours=6),now+dt.timedelta(hours=48))),
               'locationAccuracy':'Operator-published stop location','accessNote':access,'cuisine':text(n,'eve_cuis')}
        result.append(feature(ident,props,[lng,lat]))
    return sorted(result,key=lambda f:f['properties']['start'])

def parse_members(raw,now):
    result=[];seen=set()
    # Explicit national/franchise operators remain excluded by the owner's destination policy.
    for n in Tree(raw).root.walk():
        if 'blog-thumbnail' not in n.attrs.get('class','').split():continue
        link=n.find('truck_name_link')
        if not link:continue
        name=link.text();href=link.attrs.get('href','')
        if not href.startswith('/member/') or href in seen or name.casefold() in FRANCHISES:continue
        seen.add(href);cuisine=text(n,'category-tag');slug=href.split('/')[-1]
        result.append(feature('foodtruck-operator-'+slug.lower(),{'title':name,'operator':name,'operatorSlug':slug,'displayKind':'operator',
            'description':(cuisine+' · ' if cuisine else '')+'Mobile operator · view the current schedule and booking information.',
            'url':BASE+href,'website':BASE+href,'calendarUrl':BASE+href,'source':'St. Louis Food Truck Association member directory',
            'sourceUrl':BASE+'/members','sourceCheckedAt':iso(now),'checkedAt':iso(now),'expiresAt':iso(now+dt.timedelta(days=30)),
            'accessNote':'This is an operator directory entry. No current location or public stop is implied.','cuisine':cuisine}))
    return sorted(result,key=lambda f:f['properties']['title'].casefold())

def main():
    args=argparse.ArgumentParser();args.add_argument('--calendar-html');args.add_argument('--members-html');args.add_argument('--output',default=str(ROOT/'food-trucks.json'));args.add_argument('--now');a=args.parse_args()
    now=dt.datetime.fromisoformat(a.now.replace('Z','+00:00')) if a.now else dt.datetime.now(dt.timezone.utc)
    calendar=Path(a.calendar_html).read_text() if a.calendar_html else fetch(BASE+'/')
    members=Path(a.members_html).read_text() if a.members_html else fetch(BASE+'/members')
    stops=parse_calendar(calendar,now);operators=parse_members(members,now)
    if len(operators)<20:raise RuntimeError('Member page changed or failed; existing snapshot was not overwritten.')
    if 'eve_row' not in calendar:raise RuntimeError('Calendar response did not include the expected structure; existing snapshot was not overwritten.')
    out={'type':'FeatureCollection','id':'foodtrucks','status':'partial','source':'St. Louis Food Truck Association / operator schedules',
         'checkedAt':iso(now),'note':'Scheduled stops appear first, followed by operator schedules. Map pins are the operator-published stop locations, never invented truck positions. Some workplace stops have restricted access.',
         'features':stops+operators,'coverage':{'scheduledStops':len(stops),'scheduledOperators':len(set(f['properties']['operatorSlug'] for f in stops)),'directoryOperators':len(operators)}}
    Path(a.output).write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps(out['coverage']))

if __name__=='__main__':main()

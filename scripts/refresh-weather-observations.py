"""Fetch one bounded, temperature/wind-only snapshot for Andymap."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
import json
import math
from pathlib import Path
import re
import sys
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

URL = "https://api.wxalerts.org/stations?bbox=-91.2,38.1,-89.4,39.2&units=us&max_age_minutes=45&domain=land"
FINDU_URL = "http://www.findu.com/cgi-bin/wxnear.cgi?lat=38.67&lon=-90.41&limit=150&noold=1"
POSITIONS_URL = "http://www.findu.com/cgi-bin/map-near.cgi?lat=38.67&lon=-90.41&cnt=500&last=2"
MADIS_URL = ("https://madis-data.ncep.noaa.gov/madisPublic1/cgi-bin/madisXmlPublicDir?"
             "time=0&minbck=-45&minfwd=0&recwin=3&timefilter=0&dfltrsel=1&state=MO"
             "&latll=38.1&lonll=-91.2&latur=39.2&lonur=-89.4&stasel=0&pvdrsel=0"
             "&varsel=2&qctype=0&qcsel=1&xml=1&csvmiss=0")
PERMITTED = {"metar", "cwop", "aprs"}
# Fixed amateur weather stations checked against repeated position and weather packets.
FIXED_APRS = {"K0PFX-8", "K9JDN", "KC9UAW", "KMOLAKE37", "W9SDA", "KD9DD-13", "KQ4HDO"}


def number(value, low, high):
    return value if type(value) in (int, float) and math.isfinite(value) and low <= value <= high else None


def parse_time(value):
    try:
        stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return stamp if stamp.tzinfo else None
    except (TypeError, ValueError, AttributeError):
        return None


def station_rows(payload, now):
    units = payload.get("units", {})
    fields = units.get("fields", {})
    expected = {"temperature": "F", "wind_speed": "mph", "wind_direction": "deg", "relative_humidity": "%"}
    if (payload.get("truncated") or units.get("system") != "us"
            or any(fields.get(key, {}).get("unit") != unit for key, unit in expected.items())):
        raise ValueError("Incomplete region or unexpected observation units")
    output = []
    for row in payload["stations"]:
        network, _, code = str(row.get("station_id", "")).partition(":")
        if (network not in PERMITTED or row.get("domain") != "land" or not re.fullmatch(r"[A-Z0-9-]{2,15}", code)
                or number(row.get("lat"), 38.1, 39.2) is None or number(row.get("lon"), -91.2, -89.4) is None):
            continue
        at = parse_time(row.get("observed_at"))
        if not at or not 0 <= (now-at).total_seconds() < 45*60:
            continue
        withheld = set(row.get("withheld") or [])
        def value(key, low, high):
            return None if key in withheld else number(row.get(key), low, high)
        temp, speed = value("temperature",-100,140), value("wind_speed",0,150)
        if temp is None and speed is None:
            continue
        direction = value("wind_direction",0,360)
        raw = row.get("raw") or ""
        rh = value("relative_humidity",0,100)
        rain = value("precip_1h",0,40) if fields.get("precip_1h",{}).get("unit") == "in" else None
        wet = bool(re.search(r"\b[+-]?(?:SH|FZ|TS)?(?:RA|DZ|SN|PL|GR)\b", raw))
        dry = False if wet or (rh is not None and rh>55) or (rain and rain>0) else True if rh is not None and rain==0 else None
        if network == "cwop":
            code = re.sub(r"^([A-Z])W([0-9]{4})$", r"\1\2", code)
        name = row.get("name")
        output.append(dict(id=code, feed="wxalerts-"+network, lat=row["lat"], lng=row["lon"],
                           label=name[:48] if isinstance(name,str) else None,
                           observedAt=at.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00","Z"),
                           temperatureF=temp,windMph=speed,windFromDeg=direction,
                           windVariable=bool(re.search(r"\b(?:VRB\d{2,3}(?:G\d{2,3})?KT|\d{3}V\d{3})\b",raw)),
                           dryWeather=dry))
    return output


MU = {
    "MOA28": ("Science Center", 38.630813, -90.270785, "stlouissciencecenter"),
    "MOA22": ("Moscow Mills", 38.938757, -90.931742, "moscowmills"),
}
COMPASS = "N NNE NE ENE E ESE SE SSE S SSW SW WSW W WNW NW NNW".split()


def missouri_row(id_, page, now):
    label, lat, lng, _ = MU[id_]
    content = " ".join(unescape(re.sub(r"<[^>]+>", " ", page)).split())
    clock = re.search(r"([A-Z][a-z]+ \d{1,2}, \d{4}, \d{1,2}:\d{2} [ap]m) (C[SD]T)", content, re.I)
    if not clock or "Current Conditions:" not in content:
        return []
    offset = -5 if clock[2].upper() == "CDT" else -6
    at = datetime.strptime(clock[1], "%B %d, %Y, %I:%M %p").replace(tzinfo=timezone(timedelta(hours=offset)))
    if not 0 <= (now-at).total_seconds() < 45*60:
        return []
    current = content.split("Current Conditions:",1)[1].split("Today:",1)[0]
    t = re.search(r"Temperature:\s*(-?\d+(?:\.\d+)?)\s*°?F\b",current)
    w = re.search(r"Wind Speed:\s*(\d+(?:\.\d+)?)\s*mph\b",current)
    bearing = re.search(r"Wind Direction:\s*([A-Z]+)\b",current)
    temp = number(float(t[1]),-100,140) if t else None
    speed = number(float(w[1]),0,150) if w else None
    if temp is None and speed is None:
        return []
    return [dict(id=id_, feed="missouri-mesonet", label=label, lat=lat, lng=lng,
                 temperatureF=temp, windMph=speed, windFromDeg=COMPASS.index(bearing[1])*22.5 if bearing and bearing[1] in COMPASS else None,
                 windVariable=False, dryWeather=None,
                 observedAt=at.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))]


def table_rows(page):
    return [[unescape(re.sub(r"<[^>]*>", "", cell)).strip()
             for cell in re.findall(r"<td\b[^>]*>(.*?)</td>", tr, re.I|re.S)]
            for tr in re.findall(r"<tr\b[^>]*>(.*?)</tr>", page, re.I|re.S)]


def decimal(value, low, high):
    return number(float(value), low, high) if re.fullmatch(r"-?\d+(?:\.\d+)?", value) else None


def findu_id(call):
    cwop = re.fullmatch(r"([A-Z])W(\d{4})", call)
    return cwop[1]+cwop[2] if cwop else call if call in FIXED_APRS else None


def findu_positions(page):
    rows = table_rows(page)
    if not rows or [c.lower() for c in rows[0]] != ["call","msg","wx","lat","lon","distance","last position"]:
        raise ValueError("Unknown findU station position format")
    positions = {}
    for row in rows[1:]:
        if len(row) != 7 or row[2] != "**":
            continue
        id_ = findu_id(row[0])
        lat, lng = decimal(row[3],38.1,39.2), decimal(row[4],-91.2,-89.4)
        if id_ and lat is not None and lng is not None:
            positions[id_] = {"lat":lat,"lng":lng}
    return positions


def findu_rows(page, issued, now):
    # Packet ages are relative to the source's actual HTTP date, including cached tables.
    if not issued or not issued.tzinfo or not -60 <= (now-issued).total_seconds() < 45*60:
        return []
    rows = table_rows(page)
    header = ["call","distance","direction","age","temp","speed","gust","direction","rain*","rain 24h","rain midnight","humidity","barometer"]
    if not rows or [c.lower() for c in rows[0]] != header:
        raise ValueError("Unknown findU regional format")
    result = []
    for row in rows[1:]:
        if len(row) != len(header): continue
        id_ = findu_id(row[0].upper())
        duration = re.fullmatch(r"(\d\d):(\d\d):([0-5]\d):([0-5]\d)",row[3])
        if not id_ or not duration: continue
        days, hours, minutes, seconds = map(int, duration.groups())
        at = (issued - timedelta(days=days,hours=hours,minutes=minutes,seconds=seconds)).replace(second=0,microsecond=0)
        if not 0 <= (now-at).total_seconds() < 45*60: continue
        temp,speed = decimal(row[4],-100,140),decimal(row[5],0,150)
        miles,humidity = decimal(row[1],0,90),decimal(row[11],0,100)
        if miles is None or (temp is None and speed is None): continue
        result.append(dict(id=id_,feed="findu-aprs" if id_ in FIXED_APRS else "findu-cwop",distanceMiles=miles,compass=row[2],
                           observedAt=at.strftime("%Y-%m-%dT%H:%M:%SZ"),temperatureF=temp,windMph=speed,
                           windFromDeg=decimal(row[7],0,360),windVariable=False,
                           dryWeather=False if humidity is not None and humidity>55 else None))
    return result


def madis_rows(payload, now):
    fields = {"V-T":"temperatureF", "V-FF":"windMph", "V-DD":"windFromDeg"}
    groups = {}
    for record in ET.fromstring(payload).iter("record"):
        a = record.attrib
        field, id_ = fields.get(a.get("var")), a.get("shef_id","")
        if not field or a.get("QCD") not in {"S","V"} or not re.fullmatch(r"[A-Z0-9-]{2,15}",id_):
            continue
        lat, lng = decimal(a.get("lat",""),38.1,39.2), decimal(a.get("lon",""),-91.2,-89.4)
        at = parse_time(a.get("ObTime","")+"Z")
        val = decimal(a.get("data_value",""),-1000,1000)
        if lat is None or lng is None or val is None or not at or not 0 <= (now-at).total_seconds() < 45*60:
            continue
        if field == "temperatureF": val = number((val-273.15)*1.8+32,-100,140)
        elif field == "windMph": val = number(val*2.236936,0,150)
        else: val = number(val,0,360)
        if val is None: continue
        key = (id_,lat,lng,at)
        if key not in groups:
            groups[key] = dict(id=id_,feed="noaa-madis",lat=lat,lng=lng,temperatureF=None,windMph=None,
                               windFromDeg=None,windVariable=False,dryWeather=None,
                               observedAt=at.strftime("%Y-%m-%dT%H:%M:%SZ"))
        groups[key][field] = round(val,2)
    return [row for row in groups.values() if row["temperatureF"] is not None or row["windMph"] is not None]


def collect(source, now):
    if source in MU:
        address = "https://agebb.missouri.edu/weather/realtime/"+MU[source][3]+".asp"
    else:
        address = {"findu":FINDU_URL,"positions":POSITIONS_URL,"wxalerts":URL,"madis":MADIS_URL}[source]
    req = Request(address, headers={"User-Agent":"Andymap weather observations (www.andrewhanes.com)"})
    try:
        with urlopen(req, timeout=16) as response:
            if source == "wxalerts":
                return station_rows(json.load(response), now)
            if source == "positions":
                return findu_positions(response.read(320000).decode("latin-1"))
            if source == "madis":
                return madis_rows(response.read(1048576), now)
            if source == "findu":
                date = response.headers.get("Date")
                return findu_rows(response.read(120000).decode("latin-1"), parsedate_to_datetime(date) if date else None, now)
            return missouri_row(source, response.read().decode("latin-1"), now)
    except (OSError, ValueError, KeyError, ET.ParseError) as error:
        print(f"{source}: {error}", file=sys.stderr)
        return []


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    now = datetime.now(timezone.utc)
    with ThreadPoolExecutor(max_workers=6) as pool:
        positions, *batches = pool.map(lambda source: collect(source, now), ["positions", "wxalerts", "findu", "madis", *MU])
    rows = [r for batch in batches for r in batch]
    for r in rows:
        if r["feed"] in {"findu-cwop","findu-aprs"} and r["id"] in positions:
            r.update(positions[r["id"]])
    if not rows:
        raise ValueError("No valid observations to publish")
    # Brief feed omissions cannot discard a newer measurement already served.
    old = json.loads(args.output.read_text()) if args.output.exists() else {}
    latest = {}
    for r in [*old.get("readings",[]), *rows]:
        stamp = parse_time(r.get("observedAt"))
        if not stamp or not 0 <= (now-stamp).total_seconds() < 45*60: continue
        key = (r["id"],r["feed"])
        if key not in latest or stamp >= parse_time(latest[key]["observedAt"]):
            latest[key] = r
    snapshot = dict(schema=1, attribution="WxAlerts (wxalerts.org), CWOP/APRS via findU, NOAA MADIS, NOAA aviation and University of Missouri Mesonet.", readings=[latest[k] for k in sorted(latest)])
    args.output.write_text(json.dumps(snapshot, separators=(",",":"),allow_nan=False)+"\n")
    stations = {r["id"] for r in latest.values()}
    print(f"{len(stations)} measured stations. Latest report {max(r['observedAt'] for r in rows)}")


if __name__ == "__main__":
    main()

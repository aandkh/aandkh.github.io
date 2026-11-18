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

URL = "https://api.wxalerts.org/stations?bbox=-91.2,38.1,-89.4,39.2&units=us&max_age_minutes=45&domain=land"
FINDU_URL = "http://www.findu.com/cgi-bin/wxnear.cgi?lat=38.67&lon=-90.41&limit=85&noold=1"
PERMITTED = {"metar", "cwop", "aprs"}


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


def findu_rows(page, issued, now):
    # The table gives elapsed time since the CWOP report, relative to the server's UTC date.
    # A cached copy must keep its original clock. Only registered weather calls are included.
    if not issued or not issued.tzinfo or not -60 <= (now-issued).total_seconds() < 45*60:
        return []
    rows = []
    for tr in re.findall(r"<tr\b[^>]*>(.*?)</tr>", page, re.I|re.S):
        cells = [unescape(re.sub(r"<[^>]*>", "", cell)).strip() for cell in re.findall(r"<td\b[^>]*>(.*?)</td>", tr, re.I|re.S)]
        rows.append(cells)
    header = ["call","distance","direction","age","temp","speed","gust","direction","rain*","rain 24h","rain midnight","humidity","barometer"]
    if not rows or [c.lower() for c in rows[0]] != header:
        raise ValueError("Unknown findU regional format")
    result = []
    def numeric(value, low, high):
        return number(float(value), low, high) if re.fullmatch(r"-?\d+(?:\.\d+)?", value) else None
    for row in rows[1:]:
        if len(row) != len(header): continue
        code = re.fullmatch(r"([A-Z])W(\d{4})", row[0].upper())
        duration = re.fullmatch(r"(\d\d):(\d\d):([0-5]\d):([0-5]\d)",row[3])
        if not code or not duration: continue
        days, hours, minutes, seconds = map(int, duration.groups())
        at = (issued - timedelta(days=days,hours=hours,minutes=minutes,seconds=seconds)).replace(second=0,microsecond=0)
        if not 0 <= (now-at).total_seconds() < 45*60: continue
        temp,speed = numeric(row[4],-100,140),numeric(row[5],0,150)
        miles,humidity = numeric(row[1],0,90),numeric(row[11],0,100)
        if miles is None or (temp is None and speed is None): continue
        result.append(dict(id=code[1]+code[2],feed="findu-cwop",distanceMiles=miles,compass=row[2],
                           observedAt=at.strftime("%Y-%m-%dT%H:%M:%SZ"),temperatureF=temp,windMph=speed,
                           windFromDeg=numeric(row[7],0,360),windVariable=False,
                           dryWeather=False if humidity is not None and humidity>55 else None))
    return result


def collect(source, now):
    if source in MU:
        address = "https://agebb.missouri.edu/weather/realtime/"+MU[source][3]+".asp"
    else:
        address = FINDU_URL if source == "findu" else URL
    req = Request(address, headers={"User-Agent":"Andymap weather observations (www.andrewhanes.com)"})
    try:
        with urlopen(req, timeout=16) as response:
            if source == "wxalerts":
                return station_rows(json.load(response), now)
            if source == "findu":
                date = response.headers.get("Date")
                return findu_rows(response.read(120000).decode("latin-1"), parsedate_to_datetime(date) if date else None, now)
            return missouri_row(source, response.read().decode("latin-1"), now)
    except (OSError, ValueError, KeyError) as error:
        print(f"{source}: {error}", file=sys.stderr)
        return []


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    now = datetime.now(timezone.utc)
    with ThreadPoolExecutor(max_workers=4) as pool:
        rows = [r for batch in pool.map(lambda source: collect(source, now), ["wxalerts", "findu", *MU]) for r in batch]
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
    snapshot = dict(schema=1, attribution="Data: WxAlerts (wxalerts.org), CWOP via findU, NOAA aviation and University of Missouri Mesonet.", readings=[latest[k] for k in sorted(latest)])
    args.output.write_text(json.dumps(snapshot, separators=(",",":"),allow_nan=False)+"\n")
    stations = {r["id"] for r in latest.values()}
    print(f"{len(stations)} measured stations. Latest report {max(r['observedAt'] for r in rows)}")


if __name__ == "__main__":
    main()

import importlib.util
from datetime import datetime, timezone
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("refresh",Path(__file__).with_name("refresh-weather-observations.py"))
refresh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh)


class ObservationTests(unittest.TestCase):
    now = datetime(2026,11,18,19,5,tzinfo=timezone.utc)
    def test_findu_preserves_packet_clock_units_and_identifies_registered_stations(self):
        header = "Call,distance,direction,age,temp,speed,gust,direction,rain*,rain 24h,rain midnight,humidity,barometer".split(",")
        rows = [header,"FW6595,4.9,E,00:00:02:30,67,5,9,164,0,0,0,46,1026".split(","),
                "OTHER,4,E,00:00:01:00,66,5,9,163,0,0,0,40,1026".split(",")]
        html = "".join("<tr>"+"".join("<td>"+value+"</td>" for value in row)+"</tr>" for row in rows)
        obs = refresh.findu_rows(html,self.now,self.now)
        self.assertEqual(len(obs),1)
        self.assertEqual((obs[0]["id"],obs[0]["windMph"],obs[0]["windFromDeg"]),("F6595",5,164))
        self.assertEqual(obs[0]["observedAt"],"2026-11-18T19:02:00Z")
        self.assertIsNone(obs[0]["dryWeather"])
        self.assertEqual(refresh.findu_rows(html,None,self.now),[])
        self.assertEqual(refresh.findu_rows(html,self.now,datetime(2026,11,18,20,tzinfo=timezone.utc)),[])
    def test_withheld_fields_real_observation_clock_and_true_calm(self):
        units = {"system":"us","fields":{k:{"unit":v} for k,v in {"temperature":"F","wind_speed":"mph","wind_direction":"deg","relative_humidity":"%","precip_1h":"in"}.items()}}
        row = {"station_id":"cwop:GW1234","domain":"land","observed_at":"2026-11-18T19:00:00Z","lat":38.66,"lon":-90.4,"temperature":90,"wind_speed":0,"wind_direction":None,"withheld":["temperature"],"relative_humidity":40,"precip_1h":None}
        packet = {"stations":[row],"units":units}
        obs = refresh.station_rows(packet,self.now)[0]
        self.assertEqual(obs["id"],"G1234"); self.assertEqual(obs["windMph"],0)
        self.assertIsNone(obs["temperatureF"]); self.assertIsNone(obs["dryWeather"])
        self.assertIsNone(obs["windFromDeg"]); self.assertEqual(obs["observedAt"],row["observed_at"])
        for at in ["2026-11-18T19:06:00Z","2026-11-18T18:20:00Z",None]:
            self.assertEqual(refresh.station_rows({**packet,"stations":[{**row,"observed_at":at}]},self.now),[])
        with self.assertRaises(ValueError):refresh.station_rows({**packet,"truncated":True},self.now)
    def test_university_standard_and_daylight_time_speed_and_bearing(self):
        def parse(clock,now):
            html = f"<b>{clock}</b> Current Conditions: Temperature: 64.9°F Wind Speed: 4.7 mph Peak Wind Gust: 9.4 mph Wind Direction: SSE Today: Max. Temp.: 79°F"
            return refresh.missouri_row("MOA28",html,now)
        ob = parse("November 18, 2026, 1:00 pm CST",self.now)[0]
        self.assertEqual(ob["observedAt"],"2026-11-18T19:00:00Z")
        self.assertEqual(ob["windMph"],4.7); self.assertEqual(ob["windFromDeg"],157.5)
        self.assertEqual(parse("July 1, 2026, 1:00 pm CDT",datetime(2026,7,1,18,2,tzinfo=timezone.utc))[0]["observedAt"],"2026-07-01T18:00:00Z")
        self.assertEqual(parse("November 18, 2026, 12:00 pm CST",self.now),[])

if __name__=="__main__":unittest.main()

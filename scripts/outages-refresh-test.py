#!/usr/bin/env python3
"""Focused regression checks for the City water outage parser."""
import datetime as dt
import importlib.util
import pathlib


SCRIPT = pathlib.Path(__file__).with_name('outages-refresh.py')
SPEC = importlib.util.spec_from_file_location('outages_refresh', SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def city_page(updated, rows):
    body = ''.join(
        '<tr>' + ''.join(f'<td>{cell}</td>' for cell in row) + '</tr>'
        for row in rows
    )
    return (
        f'Last Updated <strong>{updated.strftime("%I:%M %p, %B %d, %Y")}</strong>'
        '<table><thead><tr><th>Taken Out of Service</th><th>Est. Time Restored</th>'
        '<th>Location</th></tr></thead><tbody>' + body + '</tbody></table>'
    )


def main():
    now = dt.datetime(2026, 11, 25, 12, 0, tzinfo=dt.timezone.utc)
    updated = now.astimezone(MODULE.CENTRAL)
    features = MODULE.city_features(city_page(updated, [
        ('none given', 'none given', 'W Florissant Ave. & Union Blvd.'),
    ]), now)
    assert len(features) == 1
    props = features[0]['properties']
    assert props['estimatedRestoration'] is None
    assert 'time not provided' in props['description']
    assert 'Estimated restoration not provided' in props['description']
    assert '1970' not in props['description']
    print('City water outage parser regression checks passed')


if __name__ == '__main__':
    main()

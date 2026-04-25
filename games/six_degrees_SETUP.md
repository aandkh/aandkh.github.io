# Six Degrees of AndrewHanes.com (Browser-Only TMDB Mode)

No backend server is required.

## Requirements

- `config.js` in repo root with `TMDB_API_KEY` (already present in this project).

## Run locally

```bash
python3 -m http.server 4180
```

Then open:

- `http://127.0.0.1:4180/games/six_degrees_andrewhanes.html`

## How it works

- Actor search: `GET /search/person`
- Actor filmography: `GET /person/{person_id}/movie_credits`
- Movie cast: `GET /movie/{movie_id}/credits`
- Validation and shortest-path search are performed client-side with caching.
- Movie filters are enforced: `vote_count > 300` and `release_date` present.

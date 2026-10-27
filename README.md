# Poolboard

A Pinterest-style way to explore Austria's cultural heritage collections. Pick an artwork, or upload your own photo, and Poolboard shows objects from Austrian museums that are similar by content (metadata) and by image, using the [Kulturpool](https://kulturpool.at) similarity API.

Built at Hack the Pool 2026.

## Features

- Search across more than 3 million objects from Austrian collections
- Masonry grid of results
- Object detail view with two lanes: "similar by content" and "similar by image"
- Upload your own photo (button or drag and drop) to find visually similar artworks
- A trail at the top that shows your path through the collection, so you can jump back to any step

## Getting started

You need Python 3.10 or newer.

```bash
git clone https://github.com/bindleh/poolboard.git
cd poolboard
python3 -m venv .venv
source .venv/bin/activate        # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload
```

Then open http://localhost:8000.

Next time you only need:

```bash
cd poolboard
source .venv/bin/activate
uvicorn app:app --reload
```

Stop the server with Ctrl + C.

## How it works

The browser can't call the Kulturpool API directly, because the API only allows requests from its own domain (CORS). So `app.py` runs a small FastAPI backend that forwards requests to Kulturpool, caches responses for 10 minutes to stay within rate limits, and converts the Typesense results into a simple item format for the frontend.

| Endpoint | Kulturpool endpoint | What it does |
|---|---|---|
| `GET /api/search?q=` | `/v2/search` | Full-text search |
| `GET /api/similar?id=&on=metadata` | `/v2/similar` | Objects similar by description |
| `GET /api/similar?id=&on=image` | `/v2/similar` | Objects similar by image |
| `POST /api/similar/image` | `/v2/similar/image` | Objects similar to an uploaded photo |
| `GET /api/raw` | any | Debug: returns the raw Kulturpool response |

The frontend is a single file, `static/index.html`, with no build step.

## Project structure

```
app.py              FastAPI backend (proxy, cache, normalization)
requirements.txt    Python dependencies
static/index.html   Frontend
```

## Troubleshooting

- `command not found: uvicorn`: the virtual environment isn't active. Run `source .venv/bin/activate`.
- `Address already in use`: the server is already running somewhere. Use another port: `uvicorn app:app --reload --port 8001`.
- `Could not open requirements file`: you're not in the project folder. `cd` into it first; `ls` should show `app.py`.
- Errors from Kulturpool show up in the terminal where the server runs.

## Data and licenses

All objects, metadata, and images come from Kulturpool and the contributing institutions. Each object has its own license (shown in the detail view); objects marked "frei nutzbar" are openly reusable. Check the license before reusing any image.

API documentation: https://api.kulturpool.at/docs

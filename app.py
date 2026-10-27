"""
KulturPin – kleines Backend für ein "Pinterest" auf Basis der Kulturpool API.

Warum ein Backend? Der Browser darf fremde APIs oft nicht direkt aufrufen (CORS),
und hier können wir Antworten cachen (Rate Limits!) und ins gleiche Format bringen.

Start:  pip install -r requirements.txt
        uvicorn app:app --reload
        -> http://localhost:8000
"""
import time
from typing import Any

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

API = "https://api.kulturpool.at"
# In der v2-Doku heißt der Suchendpunkt vermutlich /v2/search, in älteren Doku-Versionen /search.
# Wir probieren beide der Reihe nach. Wenn ihr den richtigen Pfad im Swagger UI seht: nur diesen eintragen.
SEARCH_PATHS = ["/v2/search", "/search"]
SIMILAR_PATH = "/v2/similar"
SIMILAR_IMAGE_PATH = "/v2/similar/image"  # POST, multipart/form-data, Feld "image"

app = FastAPI(title="KulturPin")
client = httpx.AsyncClient(timeout=20, headers={"User-Agent": "KulturPin/0.1 (Hack the Pool)"})

# ---------- Mini-Cache (spart Requests gegen die Anfragegrenzen) ----------
_cache: dict[str, tuple[float, Any]] = {}
CACHE_TTL = 600  # Sekunden


async def get_json(path: str, params: dict) -> Any:
    key = path + "?" + "&".join(f"{k}={v}" for k, v in sorted(params.items()))
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL:
        return hit[1]
    r = await client.get(API + path, params=params)
    if r.status_code == 404:
        raise FileNotFoundError(path)
    if r.status_code == 429:
        raise HTTPException(429, "Kulturpool: zu viele Anfragen, kurz warten.")
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"Kulturpool {r.status_code}: {r.text[:300]}")
    data = r.json()
    _cache[key] = (time.time(), data)
    return data


# ---------- Antworten vereinheitlichen ----------
# Format (geprüft): Typesense – {"found", "hits": [{"document": {...}, "vector_distance": 0.03}], "vector": "..."}


def one(v: Any) -> Any:
    """Listen -> erstes Element (viele Felder kommen als Liste, z.B. creator, date)."""
    if isinstance(v, list):
        return v[0] if v else None
    return v


def extract_items(data: Any) -> list[dict]:
    hits = data.get("hits", []) if isinstance(data, dict) else []
    items = []
    for h in hits:
        doc = h.get("document", {})
        if not doc.get("id"):
            continue
        creator = one(doc.get("creator"))
        if not creator and doc.get("contributor"):  # MAK nutzt oft contributor
            creator = one(doc["contributor"])
        items.append({
            "id": doc["id"],
            "title": doc.get("title") or "Ohne Titel",
            "creator": creator,
            "date": one(doc.get("date")) or one(doc.get("coverage")),
            "provider": doc.get("dataProvider"),
            "image": doc.get("previewImage"),
            "imageLarge": doc.get("previewImage", "").replace("_small.", "_large.") or None,
            "aspect": doc.get("imageAspectRatio"),
            "color": doc.get("imageColor"),
            "rights": one(doc.get("edmRightsName")),
            "open": one(doc.get("edmRightsReusePolicy")) == "OPEN",
            "type": one(doc.get("dcType")),
            "description": one(doc.get("description")),
            "url": doc.get("url") or f"https://kulturpool.at/objekte/{doc['id']}",
            "sourceUrl": doc.get("isShownAt"),
            "distance": h.get("vector_distance"),
        })
    return items


# ---------- Endpunkte für das Frontend ----------
@app.get("/api/search")
async def search(q: str = "*", page: int = 1, per_page: int = Query(40, le=100)):
    params = {"q": q, "page": page, "per_page": per_page}
    for path in SEARCH_PATHS:
        try:
            data = await get_json(path, params)
            return {"items": extract_items(data), "found": data.get("found") if isinstance(data, dict) else None}
        except FileNotFoundError:
            continue
    raise HTTPException(502, "Suchendpunkt nicht gefunden – Pfad in SEARCH_PATHS anpassen.")


@app.get("/api/similar")
async def similar(id: str, on: str = Query("metadata", pattern="^(metadata|image)$"),
                  per_page: int = Query(24, ge=1, le=250), threshold: float | None = None):
    params = {"id": id, "on": on, "per_page": per_page}
    if threshold is not None:
        params["threshold"] = threshold
    try:
        data = await get_json(SIMILAR_PATH, params)
    except FileNotFoundError:
        raise HTTPException(404, "Objekt nicht gefunden oder hat keinen Vektor für on=" + on)
    return {"items": extract_items(data)}


MAX_UPLOAD = 10 * 1024 * 1024  # 10 MB – die genauen Grenzen stehen unter "Grenzen des Uploads"


@app.post("/api/similar/image")
async def similar_image(image: UploadFile = File(...), per_page: int = Form(40),
                        filter_by: str | None = Form(None), threshold: float | None = Form(None)):
    content = await image.read()
    if len(content) > MAX_UPLOAD:
        raise HTTPException(413, "Bild ist zu groß (max. 10 MB).")
    form = {"per_page": str(min(max(per_page, 1), 250))}
    if filter_by:            # leere Felder NICHT mitschicken (siehe Swagger-Falle mit "string")
        form["filter_by"] = filter_by
    if threshold:            # 0 hieße: nur identische Bilder
        form["threshold"] = str(threshold)
    r = await client.post(API + SIMILAR_IMAGE_PATH, data=form,
                          files={"image": (image.filename or "upload.jpg", content, image.content_type or "image/jpeg")})
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"Kulturpool {r.status_code}: {r.text[:300]}")
    data = r.json()
    # "vector" = Embedding des hochgeladenen Bildes, z.B. für "Mit dem Vektor weitersuchen"
    return {"items": extract_items(data), "found": data.get("found"), "vector": data.get("vector")}


@app.get("/api/raw")
async def raw(path: str = "/v2/similar", id: str | None = None, q: str | None = None, on: str | None = None):
    """Debug: rohe Kulturpool-Antwort ansehen, um die Feldnamen oben anzupassen."""
    params = {k: v for k, v in {"id": id, "q": q, "on": on, "per_page": 2}.items() if v}
    return await get_json(path, params)


app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def index():
    return FileResponse("static/index.html")

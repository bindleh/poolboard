# Team setup

Poolboard is a Pinterest-style explorer for Kulturpool: search objects, open one, and see what's similar by content and by image. You can also upload your own photo to find similar artworks.

This guide gets it running on your machine. You need Python 3.10 or newer (check with `python3 --version`).

## 1. Get the code

Either clone the repository:

```bash
git clone https://github.com/bindleh/poolboard.git
cd poolboard
```

Or use the green "Code" button on GitHub → "Download ZIP", unzip it, and `cd` into the folder. Tip: type `cd ` (with a space) in the terminal and drag the folder into the window to fill in the path.

If the repository is private, git will ask you to sign in to GitHub. The easiest way around that is GitHub Desktop → "Clone repository".

## 2. Set up (first time only)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

On Windows use `python` instead of `python3`, and `.venv\Scripts\activate` instead of the `source` line.

## 3. Start the app

```bash
uvicorn app:app --reload
```

Then open http://localhost:8000.

Keep the terminal open while you use the app. Stop the server with Ctrl + C.

## Next time

```bash
cd poolboard
git pull                         # only if you cloned with git: gets the latest changes
source .venv/bin/activate
uvicorn app:app --reload
```

## Troubleshooting

- `Could not open requirements file`: you're not in the project folder. Run `ls`; you should see `app.py` and `requirements.txt`.
- `command not found: uvicorn`: the virtual environment isn't active. Run `source .venv/bin/activate`.
- `Address already in use`: the server is already running somewhere. Close it or use another port: `uvicorn app:app --reload --port 8001`.
- Something else: check the terminal where the server runs for the error message and send it to the team.

More details about how the app works are in the [README](README.md).

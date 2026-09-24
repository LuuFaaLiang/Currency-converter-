# Global Currency Converter
A Flask + vanilla JavaScript currency converter with live rates, a 7-day chart, history and favorites.

## Features
Live conversion, swap, currency search, popular pairs, live KHR rates card, trend arrow, Chart.js chart,
last-10 history (Local Storage), favorite pairs, copy result, dark/light mode, loading + friendly errors, responsive layout.

## Run locally
```bash
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py                 # open http://127.0.0.1:5000
```

## API
Rates: https://open.er-api.com (free, no key). 7-day history: fawazahmed0 currency-api via jsDelivr.
Flask routes: `/`, `/convert?from=USD&to=KHR&amount=100`, `/rates`, `/history?from=usd&to=khr`.

## Screenshots
`![Home](assets/screenshot-home.png)` (add your own)

## Deploy on Render (Flask backend)
1. Push this folder to a GitHub repository.
2. On render.com choose New > Web Service and connect the repo.
3. Build command: `pip install -r requirements.txt`. Start command: `gunicorn app:app`.
4. Click Deploy and open the URL Render gives you.

## GitHub Pages
Pages only hosts static files, so it cannot run Flask. Use Render for the full app.
(A static version would call the rate API directly from script.js.)

"""Global Currency Converter - Flask backend.
Routes: /  /convert  /rates  /history  (all API routes return JSON)."""
import time
from datetime import date, timedelta
import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

RATES_URL = "https://open.er-api.com/v6/latest/USD"  # free, no key, includes KHR
HISTORY_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@{day}/v1/currencies/usd.json"
_cache = {"time": 0, "data": None}  # simple in-memory cache (10 minutes)
_history_cache = {}

def get_rates():
    """Fetch USD-based rates, reusing a cached copy for 10 minutes."""
    if _cache["data"] and time.time() - _cache["time"] < 600:
        return _cache["data"]
    res = requests.get(RATES_URL, timeout=8)
    res.raise_for_status()
    data = res.json()
    _cache.update(time=time.time(), data=data)
    return data

def cross_rate(rates, src, dst):
    """Convert via USD: rate(src->dst) = USD->dst / USD->src."""
    return rates[dst] / rates[src]

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/rates")
def rates():
    try:
        data = get_rates()
        return jsonify(base="USD", rates=data["rates"], updated=data["time_last_update_utc"])
    except requests.RequestException:
        return jsonify(error="Exchange-rate service is unavailable. Try again shortly."), 503

@app.route("/convert")
def convert():
    src = request.args.get("from", "").upper()
    dst = request.args.get("to", "").upper()
    try:
        amount = float(request.args.get("amount", ""))
        if amount < 0:
            raise ValueError
    except ValueError:
        return jsonify(error="Please enter a valid positive amount."), 400
    try:
        data = get_rates()
    except requests.RequestException:
        return jsonify(error="Exchange-rate service is unavailable."), 503
    if src not in data["rates"] or dst not in data["rates"]:
        return jsonify(error="Unsupported currency."), 400
    rate = cross_rate(data["rates"], src, dst)
    return jsonify(**{"from": src, "to": dst}, amount=amount, rate=rate,
                   result=amount * rate, updated=data["time_last_update_utc"])

@app.route("/history")
def history():
    """Last 7 daily rates for a pair (used by the chart and trend arrow)."""
    src = request.args.get("from", "usd").lower()
    dst = request.args.get("to", "khr").lower()
    points = []
    for i in range(6, -1, -1):
        day = (date.today() - timedelta(days=i)).isoformat()
        if day not in _history_cache:
            try:
                r = requests.get(HISTORY_URL.format(day=day), timeout=6)
                r.raise_for_status()
                _history_cache[day] = r.json()["usd"]
            except (requests.RequestException, KeyError, ValueError):
                continue  # skip days that fail
        usd = _history_cache[day]
        if src in usd and dst in usd:
            points.append({"date": day, "rate": usd[dst] / usd[src]})
    if not points:
        return jsonify(error="History is unavailable right now."), 503
    return jsonify(points=points)

if __name__ == "__main__":
    app.run(debug=True)

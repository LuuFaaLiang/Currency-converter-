// ---------- Setup ----------
const CURRENCIES = {
  USD:["us","US Dollar"], EUR:["eu","Euro"], GBP:["gb","British Pound"], JPY:["jp","Japanese Yen"],
  CNY:["cn","Chinese Yuan"], KRW:["kr","South Korean Won"], THB:["th","Thai Baht"], SGD:["sg","Singapore Dollar"],
  VND:["vn","Vietnamese Dong"], KHR:["kh","Cambodian Riel"], MYR:["my","Malaysian Ringgit"],
  AUD:["au","Australian Dollar"], CAD:["ca","Canadian Dollar"], INR:["in","Indian Rupee"]
};
const POPULAR = [["USD","KHR"],["KHR","USD"],["USD","THB"],["USD","EUR"],["EUR","KHR"]];
const $ = id => document.getElementById(id);
const fromSel = $("fromCur"), toSel = $("toCur");
let chart, lastResult = null;

// Safe Local Storage helpers
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function fillSelects() {
  for (const sel of [fromSel, toSel]) {
    for (const [code, [, name]] of Object.entries(CURRENCIES)) sel.add(new Option(`${code} - ${name}`, code));
  }
  fromSel.value = "USD"; toSel.value = "KHR";
  updateFlags();
}
function updateFlags() {
  $("fromFlag").src = `https://flagcdn.com/w40/${CURRENCIES[fromSel.value][0]}.png`;
  $("toFlag").src = `https://flagcdn.com/w40/${CURRENCIES[toSel.value][0]}.png`;
}
// Search box jumps the dropdown to the first matching currency
document.querySelectorAll(".search").forEach(box => {
  box.addEventListener("input", () => {
    const sel = $(box.dataset.target), q = box.value.toLowerCase();
    const match = [...sel.options].find(o => o.text.toLowerCase().includes(q));
    if (match) { sel.value = match.value; updateFlags(); }
  });
});

// ---------- API helpers ----------
async function api(url) {
  let res;
  try { res = await fetch(url); }
  catch { throw new Error("No internet connection. Check your network and try again."); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
const showMessage = t => { $("message").textContent = t; };
const fmt = (n, max = 4) => Number(n).toLocaleString(undefined, { maximumFractionDigits: n > 100 ? 2 : max });

// Number counting animation
function countUp(el, target) {
  const start = performance.now();
  const step = now => {
    const p = Math.min((now - start) / 600, 1);
    el.textContent = fmt(target * p);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- Convert ----------
async function convert() {
  showMessage("");
  const raw = $("amount").value.trim();
  if (raw === "") return showMessage("Enter an amount to convert.");
  if (isNaN(raw) || Number(raw) < 0) return showMessage("Amount must be a positive number.");
  $("spinner").classList.remove("hidden");
  try {
    const d = await api(`/convert?from=${fromSel.value}&to=${toSel.value}&amount=${raw}`);
    lastResult = d;
    $("resultCard").classList.remove("hidden");
    countUp($("resultValue"), d.result);
    $("resultCode").textContent = d.to;
    $("rateLine").textContent = `1 ${d.from} = ${fmt(d.rate)} ${d.to}`;
    $("updated").textContent = `Last updated: ${d.updated}`;
    updateFavButton(); addHistory(d); loadChart();
  } catch (e) { showMessage(e.message); }
  finally { $("spinner").classList.add("hidden"); }
}

// ---------- Chart + trend ----------
async function loadChart() {
  $("chartNote").textContent = "";
  try {
    const { points } = await api(`/history?from=${fromSel.value.toLowerCase()}&to=${toSel.value.toLowerCase()}`);
    const values = points.map(p => p.rate);
    if (chart) chart.destroy();
    chart = new Chart($("chart"), { type: "line",
      data: { labels: points.map(p => p.date.slice(5)), datasets: [{ data: values,
        borderColor: "#8ab4ff", backgroundColor: "rgba(138,180,255,.2)", fill: true, tension: .35 }] },
      options: { plugins: { legend: { display: false } } } });
    // Trend arrow: compare the newest point with the one before it
    if (values.length > 1) {
      const up = values.at(-1) >= values.at(-2);
      $("trend").className = "trend " + (up ? "up" : "down");
      $("trend").innerHTML = `<i class="fa-solid fa-arrow-${up ? "up" : "down"}"></i> ${up ? "Up" : "Down"} vs. yesterday`;
    }
  } catch (e) { $("chartNote").textContent = e.message; }
}

// ---------- Swap ----------
$("swapBtn").addEventListener("click", () => {
  [fromSel.value, toSel.value] = [toSel.value, fromSel.value];
  const b = $("swapBtn"); b.classList.remove("spin"); void b.offsetWidth; b.classList.add("spin");
  updateFlags(); convert();
});

// ---------- Pair chips (popular + favorites share one helper) ----------
function pairChip(a, b) {
  const btn = document.createElement("button");
  btn.className = "chip"; btn.textContent = `${a} → ${b}`;
  btn.onclick = () => { fromSel.value = a; toSel.value = b; updateFlags(); convert(); };
  return btn;
}
async function loadLiveRates() {
  try {
    const r = (await api("/rates")).rates;
    $("liveRates").innerHTML = ["USD", "EUR", "THB"].map(c =>
      `<li><span>1 ${c}</span><strong>${fmt(r.KHR / r[c])} KHR</strong></li>`).join("");
  } catch (e) { $("liveRates").innerHTML = `<li>${e.message}</li>`; }
}

// ---------- History (last 10, Local Storage) ----------
function addHistory(d) {
  const h = load("history", []);
  h.unshift(`${fmt(d.amount)} ${d.from} = ${fmt(d.result)} ${d.to}`);
  save("history", h.slice(0, 10)); renderHistory();
}
function renderHistory() {
  const h = load("history", []);
  $("history").innerHTML = h.length ? h.map(x => `<li>${x}</li>`).join("") : "<li>No conversions yet. Enter an amount and convert.</li>";
}
$("clearHistory").onclick = () => { save("history", []); renderHistory(); };

// ---------- Favorites ----------
const pairKey = () => `${fromSel.value}-${toSel.value}`;
function updateFavButton() {
  $("favBtn").innerHTML = load("favs", []).includes(pairKey())
    ? '<i class="fa-solid fa-star"></i> Saved' : '<i class="fa-regular fa-star"></i> Save pair';
}
$("favBtn").onclick = () => {
  const favs = load("favs", []), k = pairKey();
  save("favs", favs.includes(k) ? favs.filter(f => f !== k) : [...favs, k]);
  updateFavButton(); renderFavorites();
};
function renderFavorites() {
  const favs = load("favs", []), box = $("favorites");
  box.innerHTML = favs.length ? "" : "Save a pair to see it here.";
  favs.forEach(f => box.append(pairChip(...f.split("-"))));
}

// ---------- Copy result, theme ----------
$("copyBtn").onclick = async () => {
  if (!lastResult) return;
  try { await navigator.clipboard.writeText(`${fmt(lastResult.amount)} ${lastResult.from} = ${fmt(lastResult.result)} ${lastResult.to}`); }
  catch { return showMessage("Copy is blocked by your browser."); }
  $("copyBtn").innerHTML = '<i class="fa-solid fa-check"></i> Copied';
  setTimeout(() => $("copyBtn").innerHTML = '<i class="fa-regular fa-copy"></i> Copy result', 1500);
};
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  $("themeToggle").innerHTML = `<i class="fa-solid fa-${t === "dark" ? "moon" : "sun"}"></i>`;
  save("theme", t);
}
$("themeToggle").onclick = () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");

// ---------- Start ----------
$("convertBtn").onclick = convert;
$("amount").addEventListener("keydown", e => e.key === "Enter" && convert());
[fromSel, toSel].forEach(s => s.addEventListener("change", updateFlags));
setTheme(load("theme", "dark"));
fillSelects(); renderHistory(); renderFavorites(); loadLiveRates();
POPULAR.forEach(([a, b]) => $("popular").append(pairChip(a, b)));
setInterval(loadLiveRates, 600000); // refresh live rates every 10 minutes
convert();

// =======================
// Supabase (Magic Link Sync)
// =======================
// Put your values here from Supabase Project Settings → API
const SUPABASE_URL = "https://paupltihpntfyjmxtjfz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdXBsdGlocG50ZnlqbXh0amZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNTcwNzksImV4cCI6MjA4MjYzMzA3OX0.8H4QO3So4SCOBuP6fQr7aSdIDTSQYVMYwiGeWWdcreo";

// Load Supabase SDK (CDN)
async function loadSupabase() {
  if (window.supabase) return window.supabase;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    s.onload = () => resolve(window.supabase);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

let sb = null;
let sbClient = null;

async function initSupabase() {
  sb = await loadSupabase();
  sbClient = sb.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return sbClient;
}

// =======================
// App Helpers
// =======================
const fmtEUR = (n) => {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
};
const isoToday = () => new Date().toISOString().slice(0, 10);

const DEFAULTS = {
  meta: {
    lastModified: Date.now()
  },
  goal: 3500,
  startingSavings: 1486,
  bufferTarget: 1200,
  hourlyRate: 20,
  rent: 500,
  bills: 200,
  food: 250,
  smoking: 150,
  social: 100,
  cash: 0,
  buffer: 0,
  carFund: 0,
  entries: []
};

const KEY = "carFundTracker.v1";

// =======================
// Auth UI helpers
// =======================
function setAuthUI({ loggedIn, email, msg }) {
  const out = document.getElementById("loggedOut");
  const inn = document.getElementById("loggedIn");
  const userEmail = document.getElementById("userEmail");
  const authMsg = document.getElementById("authMsg");

  if (authMsg) authMsg.textContent = msg || "";

  if (!out || !inn) return;
  if (loggedIn) {
    out.style.display = "none";
    inn.style.display = "block";
    if (userEmail) userEmail.textContent = email || "—";
  } else {
    inn.style.display = "none";
    out.style.display = "block";
    if (userEmail) userEmail.textContent = "—";
  }
}

function setSyncStatus(text) {
  const el = document.getElementById("syncStatus");
  if (el) el.textContent = "Sync status: " + text;
}

// =======================
// Local persistence
// =======================
function ensureNumbers(state) {
  const keys = ["goal", "startingSavings", "bufferTarget", "hourlyRate", "rent", "bills", "food", "smoking", "social", "cash", "buffer", "carFund"];
  for (const k of keys) state[k] = Number(state[k] || 0);
}

function normalizeState(state) {
  if (!state || typeof state !== "object") state = structuredClone(DEFAULTS);
  state.meta = state.meta || {};
  state.meta.lastModified = Number(state.meta.lastModified || 0);
  if (!Number.isFinite(state.meta.lastModified) || state.meta.lastModified <= 0) {
    state.meta.lastModified = Date.now();
  }
  state.entries = Array.isArray(state.entries) ? state.entries : [];
  ensureNumbers(state);
  return state;
}

function load() {
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    const init = structuredClone(DEFAULTS);
    init.cash = init.startingSavings;
    save(init);
    return init;
  }
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    localStorage.removeItem(KEY);
    const init = structuredClone(DEFAULTS);
    init.cash = init.startingSavings;
    save(init);
    return init;
  }
}

function save(state) {
  state = normalizeState(state);
  state.meta.lastModified = Date.now();

  localStorage.setItem(KEY, JSON.stringify(state));
  scheduleCloudSync(); // cloud sync when logged in
}

function addEntry(state, { date, type, amount, desc }) {
  const entry = {
    id: crypto.randomUUID(),
    date: date || isoToday(),
    type,
    amount: Number(amount),
    desc: String(desc || "").trim()
  };
  state.entries.unshift(entry);
}

// =======================
// Cloud sync (Supabase)
// =======================
async function pushStateToCloud(state, statusText) {
  if (!sbClient) return;

  const { data: userRes, error: userErr } = await sbClient.auth.getUser();
  if (userErr) {
    setSyncStatus("Auth error: " + userErr.message);
    return;
  }
  const user = userRes?.user;
  if (!user) return;

  setSyncStatus("Saving to cloud…");

  const payload = {
    user_id: user.id,
    state_json: state,
    updated_at: new Date().toISOString()
  };

  const { error } = await sbClient
    .from("user_state")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    setSyncStatus("Save failed: " + error.message);
  } else {
    setSyncStatus(statusText || "Saved ✓");
  }
}

async function pullCloudStateAndMerge() {
  if (!sbClient) return;

  const { data: userRes, error: userErr } = await sbClient.auth.getUser();
  if (userErr) {
    setSyncStatus("Auth error: " + userErr.message);
    return;
  }
  const user = userRes?.user;
  if (!user) return;

  setSyncStatus("Pulling cloud state…");

  const { data, error } = await sbClient
    .from("user_state")
    .select("state_json, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    setSyncStatus("Pull failed: " + error.message);
    return;
  }

  const local = load();
  const localUpdated = local?.meta?.lastModified || 0;
  const cloudState = data?.state_json ? normalizeState(data.state_json) : null;
  const cloudUpdated = cloudState?.meta?.lastModified || 0;

  if (!cloudState) {
    await pushStateToCloud(local, "No cloud state; uploaded local ✓");
    render();
    return;
  }

  if (cloudUpdated > localUpdated) {
    localStorage.setItem(KEY, JSON.stringify(cloudState));
    setSyncStatus("Loaded cloud state ✓");
  } else {
    await pushStateToCloud(local, "Local newer; uploaded ✓");
  }

  render();
}

// Debounced auto-push after local changes
let syncTimer = null;
function scheduleCloudSync() {
  if (!sbClient) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const state = load();
    await pushStateToCloud(state, "Auto-synced ✓");
  }, 800);
}

// =======================
// Calculations + rendering
// =======================
function classifyLabel(type) {
  if (type === "income") return ["Income", "income"];
  if (type === "expense") return ["Expense", "expense"];
  if (type === "debt") return ["Debt", "debt"];
  if (
    type === "move_to_car" ||
    type === "move_to_buffer" ||
    type === "move_buffer_to_car" ||
    type === "move_car_to_buffer"
  ) return ["Move", ""];
  return [type, ""];
}

function computeNetRatePerMonth(state) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 60 * 24 * 3600 * 1000);
  let net = 0;

  for (const e of state.entries) {
    const d = new Date(e.date + "T00:00:00");
    if (d < cutoff) continue;
    if (e.type === "income") net += e.amount;
    if (e.type === "expense" || e.type === "debt") net -= e.amount;
  }
  return net / 2;
}

function estimateBuyDate(state) {
  const remaining = Math.max(0, state.goal - state.carFund);
  let rate = computeNetRatePerMonth(state);
  if (rate <= 0) return { dateText: "—", rateText: fmtEUR(rate) + " / month" };

  if (state.buffer < state.bufferTarget) rate *= 0.75;
  const monthsNeeded = remaining / rate;
  const daysNeeded = Math.ceil(monthsNeeded * 30);

  const dt = new Date();
  dt.setDate(dt.getDate() + daysNeeded);

  const dateText = dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  return { dateText, rateText: fmtEUR(rate) + " / month" };
}

function render() {
  const state = load();

  document.getElementById("today").textContent =
    new Date().toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });

  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = String(v ?? "");
  };

  setVal("goal", state.goal);
  setVal("startingSavings", state.startingSavings);
  setVal("bufferTarget", state.bufferTarget);
  setVal("hourlyRate", state.hourlyRate);
  setVal("rent", state.rent);
  setVal("bills", state.bills);
  setVal("food", state.food);
  setVal("smoking", state.smoking);
  setVal("social", state.social);

  const dateEl = document.getElementById("entryDate");
  if (dateEl) dateEl.value = isoToday();

  document.getElementById("kpiCarFund").textContent = fmtEUR(state.carFund);
  document.getElementById("kpiGoal").textContent = fmtEUR(state.goal);
  document.getElementById("kpiBuffer").textContent = fmtEUR(state.buffer);
  document.getElementById("kpiBufferTarget").textContent = fmtEUR(state.bufferTarget);
  document.getElementById("kpiCash").textContent = fmtEUR(state.cash);

  const remaining = Math.max(0, state.goal - state.carFund);
  document.getElementById("kpiRemaining").textContent = "Remaining: " + fmtEUR(remaining);

  const pct = state.goal > 0 ? Math.min(100, Math.round((state.carFund / state.goal) * 100)) : 0;
  document.getElementById("kpiProgressText").textContent = pct + "%";
  document.getElementById("barFill").style.width = pct + "%";

  const est = estimateBuyDate(state);
  document.getElementById("kpiBuyDate").textContent = est.dateText;
  document.getElementById("kpiRate").textContent = "Rate: " + est.rateText;

  const warnings = [];
  if (state.buffer < state.bufferTarget) {
    warnings.push(`⚠ Buffer below target (${fmtEUR(state.buffer)} / ${fmtEUR(state.bufferTarget)}). Consider topping it up first.`);
  }
  if (state.cash < 0) warnings.push(`⚠ Cash is negative. You allocated more than you actually have.`);
  document.getElementById("warnings").textContent = warnings.join(" ");

  const hint = [];
  hint.push(`Cash: ${fmtEUR(state.cash)} • Buffer: ${fmtEUR(state.buffer)} • Car fund: ${fmtEUR(state.carFund)}`);
  hint.push(
    state.buffer < state.bufferTarget
      ? `Recommendation: prioritize buffer until it reaches ${fmtEUR(state.bufferTarget)}.`
      : `You’re safe: buffer target met. You can push the car fund.`
  );
  document.getElementById("allocationHint").textContent = hint.join(" ");

  // Transfer hint (if you added the new UI)
  const transferHintEl = document.getElementById("transferHint");
  if (transferHintEl) {
    transferHintEl.textContent =
      state.buffer > state.bufferTarget
        ? `Tip: You have ${fmtEUR(state.buffer - state.bufferTarget)} buffer surplus that could safely go to the car fund.`
        : `Tip: Keep buffer at least ${fmtEUR(state.bufferTarget)}.`;
  }

  // Ledger
  const filterEl = document.getElementById("filter");
  const searchEl = document.getElementById("search");
  const filter = filterEl ? filterEl.value : "all";
  const search = (searchEl ? searchEl.value : "").toLowerCase().trim();

  const tbody = document.getElementById("tbody");
  tbody.innerHTML = "";

  let totalIncome = 0, totalExpense = 0, totalDebt = 0;

  const rows = state.entries.filter((e) => {
    if (search && !(e.desc || "").toLowerCase().includes(search)) return false;
    if (filter === "all") return true;
    if (filter === "income") return e.type === "income";
    if (filter === "expense") return e.type === "expense";
    if (filter === "debt") return e.type === "debt";
    if (filter === "move") {
      return (
        e.type === "move_to_car" ||
        e.type === "move_to_buffer" ||
        e.type === "move_buffer_to_car" ||
        e.type === "move_car_to_buffer"
      );
    }
    return true;
  });

  for (const e of rows) {
    const tr = document.createElement("tr");

    const [label, cls] = classifyLabel(e.type);
    const tag = document.createElement("span");
    tag.className = "tag " + cls;
    tag.textContent = label;

    const tdDate = document.createElement("td");
    tdDate.className = "mono";
    tdDate.textContent = e.date;

    const tdType = document.createElement("td");
    tdType.appendChild(tag);

    const tdDesc = document.createElement("td");
    tdDesc.textContent = e.desc || "—";

    const tdAmt = document.createElement("td");
    tdAmt.className = "right mono";
    const sign = e.type === "income" ? "+" : (e.type === "expense" || e.type === "debt") ? "−" : "";
    tdAmt.textContent = sign + fmtEUR(Math.abs(e.amount));

    tr.appendChild(tdDate);
    tr.appendChild(tdType);
    tr.appendChild(tdDesc);
    tr.appendChild(tdAmt);
    tbody.appendChild(tr);

    if (e.type === "income") totalIncome += e.amount;
    if (e.type === "expense") totalExpense += e.amount;
    if (e.type === "debt") totalDebt += e.amount;
  }

  document.getElementById("ledgerSummary").textContent =
    `Totals (visible): Income ${fmtEUR(totalIncome)} • Expenses ${fmtEUR(totalExpense)} • Debt ${fmtEUR(totalDebt)} • Entries ${rows.length}`;
}

function readSettingsFromUI(state) {
  const getNum = (id) => Number(document.getElementById(id).value || 0);
  state.goal = getNum("goal");
  state.startingSavings = getNum("startingSavings");
  state.bufferTarget = getNum("bufferTarget");
  state.hourlyRate = getNum("hourlyRate");
  state.rent = getNum("rent");
  state.bills = getNum("bills");
  state.food = getNum("food");
  state.smoking = getNum("smoking");
  state.social = getNum("social");
}

// =======================
// UI Events (existing app)
// =======================
document.getElementById("saveSettings").addEventListener("click", () => {
  const state = load();
  const prevStarting = Number(state.startingSavings || 0);

  readSettingsFromUI(state);
  ensureNumbers(state);

  if (state.entries.length === 0) {
    const delta = state.startingSavings - prevStarting;
    state.cash += delta;
  }

  save(state);
  document.getElementById("setupStatus").textContent = "Saved ✓";
  render();
});

document.getElementById("resetAll").addEventListener("click", () => {
  if (!confirm("Reset everything? This clears ledger and buckets.")) return;
  localStorage.removeItem(KEY);
  render();
});

document.getElementById("addSalary").addEventListener("click", () => {
  const state = load();
  const amt = Number(document.getElementById("salaryAmount").value || 0);
  if (amt <= 0) return alert("Enter a positive salary amount.");
  state.cash += amt;
  addEntry(state, { type: "income", amount: amt, desc: "Salary deposit", date: isoToday() });
  save(state);
  document.getElementById("salaryAmount").value = "";
  render();
});

document.getElementById("payDebt").addEventListener("click", () => {
  const state = load();
  const amt = Number(document.getElementById("debtAmount").value || 0);
  if (amt <= 0) return alert("Enter a positive debt amount.");
  if (state.cash < amt) return alert("Not enough CASH. Move from buffer/car fund back manually or add income.");
  state.cash -= amt;
  addEntry(state, { type: "debt", amount: amt, desc: "Debt payment (Aunt)", date: isoToday() });
  save(state);
  document.getElementById("debtAmount").value = "";
  render();
});

document.getElementById("addHours").addEventListener("click", () => {
  const state = load();
  const hours = Number(document.getElementById("hours").value || 0);
  if (hours <= 0) return alert("Enter positive hours.");
  const income = Math.round(hours * state.hourlyRate);
  state.cash += income;
  addEntry(state, { type: "income", amount: income, desc: `Freelance (${hours}h @ €${state.hourlyRate}/h)`, date: isoToday() });
  save(state);
  document.getElementById("hours").value = "";
  render();
});

document.getElementById("addMonthly").addEventListener("click", () => {
  const state = load();
  const monthly = state.rent + state.bills + state.food + state.smoking + state.social;
  if (monthly <= 0) return alert("Your monthly costs are 0. Set them in Setup first.");
  if (state.cash < monthly) return alert("Not enough CASH to log monthly costs.");
  state.cash -= monthly;
  addEntry(state, { type: "expense", amount: monthly, desc: "Monthly living costs (rent+bills+food+smoking+social)", date: isoToday() });
  save(state);
  render();
});

document.getElementById("addEntry").addEventListener("click", () => {
  const state = load();

  const type = document.getElementById("entryType").value;
  const amount = Number(document.getElementById("entryAmount").value || 0);
  const date = document.getElementById("entryDate").value || isoToday();
  const desc = document.getElementById("entryDesc").value || "";

  if (amount <= 0) return alert("Enter a positive amount.");

  if (type === "income") {
    state.cash += amount;
  } else if (type === "expense" || type === "debt") {
    if (state.cash < amount) return alert("Not enough CASH.");
    state.cash -= amount;
  } else if (type === "move_to_car") {
    if (state.cash < amount) return alert("Not enough CASH to move.");
    state.cash -= amount;
    state.carFund += amount;
  } else if (type === "move_to_buffer") {
    if (state.cash < amount) return alert("Not enough CASH to move.");
    state.cash -= amount;
    state.buffer += amount;
  }

  addEntry(state, { type, amount, desc, date });
  save(state);

  document.getElementById("entryAmount").value = "";
  document.getElementById("entryDesc").value = "";
  render();
});

document.getElementById("moveToCar").addEventListener("click", () => {
  const state = load();
  const amt = Number(document.getElementById("moveCarAmount").value || 0);
  if (amt <= 0) return alert("Enter a positive amount.");
  if (state.cash < amt) return alert("Not enough CASH.");
  state.cash -= amt;
  state.carFund += amt;
  addEntry(state, { type: "move_to_car", amount: amt, desc: "Allocate to car fund", date: isoToday() });
  save(state);
  document.getElementById("moveCarAmount").value = "";
  render();
});

document.getElementById("moveToBuffer").addEventListener("click", () => {
  const state = load();
  const amt = Number(document.getElementById("moveBufferAmount").value || 0);
  if (amt <= 0) return alert("Enter a positive amount.");
  if (state.cash < amt) return alert("Not enough CASH.");
  state.cash -= amt;
  state.buffer += amt;
  addEntry(state, { type: "move_to_buffer", amount: amt, desc: "Allocate to buffer", date: isoToday() });
  save(state);
  document.getElementById("moveBufferAmount").value = "";
  render();
});

// =======================
// NEW: Direct transfers Buffer ↔ Car fund
// =======================
document.getElementById("bufferToCar")?.addEventListener("click", () => {
  const state = load();
  const amt = Number(document.getElementById("transferAmount").value || 0);
  if (amt <= 0) return alert("Enter a positive amount.");
  if (state.buffer < amt) return alert("Not enough money in BUFFER.");

  const after = state.buffer - amt;
  if (after < state.bufferTarget) {
    const ok = confirm(
      `This will drop your buffer below target.\n\n` +
      `Buffer now: ${fmtEUR(state.buffer)}\n` +
      `Buffer target: ${fmtEUR(state.bufferTarget)}\n` +
      `Buffer after: ${fmtEUR(after)}\n\n` +
      `Are you sure?`
    );
    if (!ok) return;
  }

  state.buffer -= amt;
  state.carFund += amt;

  addEntry(state, {
    type: "move_buffer_to_car",
    amount: amt,
    desc: "Transfer: Buffer → Car fund",
    date: isoToday()
  });

  save(state);
  document.getElementById("transferAmount").value = "";
  render();
});

document.getElementById("carToBuffer")?.addEventListener("click", () => {
  const state = load();
  const amt = Number(document.getElementById("transferAmount").value || 0);
  if (amt <= 0) return alert("Enter a positive amount.");
  if (state.carFund < amt) return alert("Not enough money in CAR FUND.");

  const ok = confirm(
    `Transfer from Car fund → Buffer?\n\n` +
    `This is usually only for emergencies or rebuilding buffer.\n\n` +
    `Car fund now: ${fmtEUR(state.carFund)}\n` +
    `Buffer now: ${fmtEUR(state.buffer)}\n\n` +
    `Proceed?`
  );
  if (!ok) return;

  state.carFund -= amt;
  state.buffer += amt;

  addEntry(state, {
    type: "move_car_to_buffer",
    amount: amt,
    desc: "Transfer: Car fund → Buffer",
    date: isoToday()
  });

  save(state);
  document.getElementById("transferAmount").value = "";
  render();
});

document.getElementById("filter").addEventListener("change", render);
document.getElementById("search").addEventListener("input", render);

// Export / import
document.getElementById("exportJson").addEventListener("click", () => {
  const state = load();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "car-fund-tracker-backup.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importJsonBtn").addEventListener("click", () => {
  document.getElementById("importJson").click();
});

document.getElementById("importJson").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    const data = normalizeState(JSON.parse(text));
    localStorage.setItem(KEY, JSON.stringify(data));
    render();
    scheduleCloudSync();
    alert("Imported ✓");
  } catch {
    alert("Invalid JSON file.");
  } finally {
    e.target.value = "";
  }
});

// =======================
// Auth bootstrap (Magic Link)
// =======================
async function bootstrapAuth() {
  await initSupabase();

  const { data: sessData, error: sessErr } = await sbClient.auth.getSession();
  if (sessErr) {
    setAuthUI({ loggedIn: false, msg: "Auth error: " + sessErr.message });
    setSyncStatus("Auth error");
  } else if (sessData?.session?.user) {
    setAuthUI({ loggedIn: true, email: sessData.session.user.email });
    setSyncStatus("Signed in");
    await pullCloudStateAndMerge();
  } else {
    setAuthUI({ loggedIn: false });
    setSyncStatus("Not signed in");
  }

  sbClient.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      setAuthUI({ loggedIn: true, email: session.user.email });
      setSyncStatus("Signed in");
      await pullCloudStateAndMerge();
    } else {
      setAuthUI({ loggedIn: false });
      setSyncStatus("Signed out");
    }
  });

  document.getElementById("sendMagicLink")?.addEventListener("click", async () => {
    const email = document.getElementById("authEmail").value.trim();
    if (!email) return alert("Enter your email.");

    const redirectTo = window.location.origin + window.location.pathname;

    const { error } = await sbClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    });

    const authMsg = document.getElementById("authMsg");
    if (error) {
      if (authMsg) authMsg.textContent = "Error: " + error.message;
    } else {
      if (authMsg) authMsg.textContent = "Magic link sent. Check your email.";
    }
  });

  document.getElementById("signOut")?.addEventListener("click", async () => {
    await sbClient.auth.signOut();
  });

  document.getElementById("syncNow")?.addEventListener("click", async () => {
    await pullCloudStateAndMerge();
  });
}

// =======================
// Init
// =======================
(async function init() {
  document.getElementById("salaryAmount").value = 1800;
  document.getElementById("debtAmount").value = 314;

  render();
  await bootstrapAuth();
})();

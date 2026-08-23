/* ============ FinTracker — Application Logic ============ */
"use strict";

/* ---------- App State ---------- */
const App = {
  view: "dashboard",
  expView: "list", // 'list' | 'calendar'
  expMonth: null,
  expFilterCat: "all",
  expSearch: "",
  calSelDate: null,
  repMonth: null,
  openSection: null,
};

const PALETTE = [
  "#2dd4a7",
  "#ff6b6b",
  "#a78bfa",
  "#fbbf24",
  "#60a5fa",
  "#f472b6",
  "#34d399",
  "#fb923c",
  "#22d3ee",
  "#e879f9",
];
const DEBT_TYPES = {
  loan: "Loan",
  credit: "Credit Card",
  borrowed: "Borrowed",
  lent: "Lent Out",
};

/* ---------- Aggregations ---------- */
function activeCats() {
  return DB.data.categories.filter((c) => !c.archived);
}
function catById(id) {
  return DB.data.categories.find((c) => c.id === id);
}
function sectionById(id) {
  return DB.data.savingsSections.find((s) => s.id === id);
}

function spentIn(catId, mk) {
  return DB.data.expenses
    .filter((e) => e.catId === catId && monthKey(e.date) === mk)
    .reduce((s, e) => s + Number(e.amount || 0), 0);
}
function monthExpenses(mk) {
  return DB.data.expenses.filter((e) => monthKey(e.date) === mk);
}
function totalSpent(mk) {
  return monthExpenses(mk).reduce((s, e) => s + Number(e.amount || 0), 0);
}
function totalBudget() {
  return activeCats().reduce((s, c) => s + Number(c.budget || 0), 0);
}
function savingsTotal() {
  return DB.data.savingsEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
}
function savingsIn(mk) {
  return DB.data.savingsEntries
    .filter((e) => monthKey(e.date) === mk)
    .reduce((s, e) => s + Number(e.amount || 0), 0);
}
function incomeIn(mk) {
  return DB.data.incomes
    .filter((i) => monthKey(i.date) === mk)
    .reduce((s, i) => s + Number(i.amount || 0), 0);
}
function sectionTotal(id) {
  return DB.data.savingsEntries
    .filter((e) => e.sectionId === id)
    .reduce((s, e) => s + Number(e.amount || 0), 0);
}
function debtTotals() {
  let owed = 0,
    lent = 0;
  for (const d of DB.data.debts) {
    const rem = Math.max(Number(d.amount || 0) - Number(d.paid || 0), 0);
    if (d.type === "lent") lent += rem;
    else owed += rem;
  }
  return { owed, lent };
}
function netWorth() {
  const t = debtTotals();
  return savingsTotal() + t.lent - t.owed;
}

function progressColor(pct) {
  if (pct >= 100) return "var(--danger)";
  if (pct >= 80) return "var(--warn)";
  return "var(--primary)";
}

/* ---------- Health summary ---------- */
function healthLine() {
  const mk = curMonthKey();
  const inc = incomeIn(mk),
    exp = totalSpent(mk),
    sav = savingsIn(mk);
  const bud = totalBudget();
  const rate = inc > 0 ? Math.round((sav / inc) * 100) : null;
  const util = bud > 0 ? Math.round((exp / bud) * 100) : null;
  if (util !== null && util >= 100)
    return (
      "⚠️ Over budget this month (" +
      util +
      "% used). Time to slow down spending!"
    );
  if (util !== null && util >= 80)
    return "⚠️ Careful — you have used " + util + "% of your monthly budget.";
  if (inc > 0 && rate >= 20)
    return (
      "✅ Great! You are within budget" +
      (util !== null ? " (" + util + "% used)" : "") +
      " and saved " +
      rate +
      "% of your income."
    );
  if (rate !== null && rate < 10 && inc > 0)
    return (
      "You saved only " + rate + "% of income this month. Try to bump it up!"
    );
  return util !== null
    ? "You are at " + util + "% of budget. Keep tracking to stay on top!"
    : "Add budgets and expenses to unlock insights.";
}

/* ---------- Recurring expenses ---------- */
function syncRecurring() {
  const cm = curMonthKey();
  const templates = DB.data.expenses.filter((e) => e.recurring);
  let added = false;
  for (const t of templates) {
    let mk = shiftMonth(monthKey(t.date), 1);
    while (mk <= cm) {
      const exists = DB.data.expenses.some(
        (e) => e.recOf === t.id && monthKey(e.date) === mk,
      );
      if (!exists) {
        const [y, m] = mk.split("-").map(Number);
        const dim = new Date(y, m, 0).getDate();
        const day = Math.min(Number(t.date.slice(8, 10)) || 1, dim);
        DB.data.expenses.push({
          id: uid(),
          catId: t.catId,
          amount: t.amount,
          date:
            y +
            "-" +
            String(m).padStart(2, "0") +
            "-" +
            String(day).padStart(2, "0"),
          time: t.time || "08:00",
          note: (t.note ? t.note + " " : "") + "(auto)",
          tags: t.tags || [],
          recurring: false,
          recOf: t.id,
        });
        added = true;
      }
      mk = shiftMonth(mk, 1);
    }
  }
  if (added) DB.save();
}

/* ---------- Notifications ---------- */
function notify(title, body) {
  toast(title + " — " + body);
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch (e) {}
  }
}
function checkBudgetThresholds(catId) {
  const c = catById(catId);
  if (!c || !c.budget) return;
  const mk = curMonthKey();
  const pct = (spentIn(catId, mk) / c.budget) * 100;
  const key = catId + ":" + mk;
  const fired = DB.data.meta.notified[key] || 0;
  let level = 0;
  if (pct >= 100) level = 100;
  else if (pct >= 90) level = 90;
  else if (pct >= 80) level = 80;
  if (level > fired) {
    DB.data.meta.notified[key] = level;
    DB.save();
    if (level === 100)
      notify(
        "Budget exceeded!",
        '"' + c.name + '" is over its ' + fmt(c.budget) + " budget.",
      );
    else
      notify(
        level + "% budget used",
        '"' + c.name + '" has used ' + Math.round(pct) + "% of its budget.",
      );
  }
}
function checkDailyReminder() {
  if (!DB.data.settings.notifications) return;
  const h = new Date().getHours();
  if (h < 20) return;
  const today = todayISO();
  if (DB.data.meta.lastReminder === today) return;
  const hasToday = DB.data.expenses.some((e) => e.date === today);
  if (!hasToday) {
    DB.data.meta.lastReminder = today;
    DB.save();
    notify("Daily reminder", "You have not logged any expenses today.");
  }
}

/* ---------- UI helpers ---------- */
function toast(msg, type) {
  const t = document.createElement("div");
  t.className = "toast " + (type || "");
  t.textContent = msg;
  document.getElementById("toastRoot").appendChild(t);
  setTimeout(() => {
    t.style.transition = "opacity .3s";
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 320);
  }, 2600);
}
function openModal(html) {
  const root = document.getElementById("modalRoot");
  root.innerHTML =
    '<div class="modal-overlay"><div class="modal">' + html + "</div></div>";
  root.querySelector(".modal-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) closeModal();
  });
}
function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
}
function confirmDlg(msg, onYes, yesLabel) {
  openModal(
    '<h2>Are you sure?</h2><p class="muted">' +
      esc(msg) +
      "</p>" +
      '<div class="modal-actions">' +
      '<button class="btn secondary" data-act="close-modal">Cancel</button>' +
      '<button class="btn danger" id="cfYes">' +
      esc(yesLabel || "Delete") +
      "</button></div>",
  );
  document.getElementById("cfYes").onclick = () => {
    closeModal();
    onYes();
  };
}
function colorBar(pct) {
  return (
    '<div class="progress"><div style="width:' +
    Math.min(pct, 100) +
    "%;background:" +
    progressColor(pct) +
    '"></div></div>'
  );
}
function emptyState(icon, msg) {
  return (
    '<div class="empty-state"><div class="es-icon">' +
    icon +
    "</div><p>" +
    esc(msg) +
    "</p></div>"
  );
}

/* ---------- Router ---------- */
const TITLES = {
  dashboard: "Dashboard",
  expenses: "Expenses",
  savings: "Savings & Investments",
  reports: "Reports & Analytics",
  more: "More",
  categories: "Manage Categories",
  income: "Income",
  debts: "Debts & Loans",
  goals: "Financial Goals",
  wishlist: "Wishlist",
  search: "Global Search",
  backup: "Backup & Restore",
  settings: "Settings",
};
function navTo(v) {
  App.view = v;
  document
    .querySelectorAll("#bottomNav button")
    .forEach((b) => b.classList.toggle("active", b.dataset.nav === v));
  render();
}
function render() {
  document.getElementById("headerTitle").textContent =
    TITLES[App.view] || "FinTracker";
  const v = document.getElementById("view");
  v.innerHTML = VIEWS[App.view] ? VIEWS[App.view]() : "";
  if (POSTRENDER[App.view]) POSTRENDER[App.view]();
}

/* ================================================================
   VIEWS
================================================================ */
const VIEWS = {};

/* ---------- Dashboard ---------- */
VIEWS.dashboard = () => {
  const mk = curMonthKey();
  const bud = totalBudget(),
    exp = totalSpent(mk),
    rem = bud - exp;
  const util = bud > 0 ? (exp / bud) * 100 : 0;
  const inc = incomeIn(mk),
    sav = savingsIn(mk);
  const cash = inc - exp;
  const nw = netWorth();

  // quick-add: most-used categories this month, fallback to first cats
  const usage = {};
  monthExpenses(mk).forEach(
    (e) => (usage[e.catId] = (usage[e.catId] || 0) + 1),
  );
  let quick = activeCats()
    .sort((a, b) => (usage[b.id] || 0) - (usage[a.id] || 0))
    .slice(0, 6);

  const recent = [...DB.data.expenses]
    .sort(
      (a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time),
    )
    .slice(0, 5);

  let html = '<div class="health">' + esc(healthLine()) + "</div>";

  // Budget hero card with Stitch SVG circular utilization ring
  const ringColor =
    util >= 100 ? "#ef4444" : util >= 80 ? "#fbbf24" : "#2dd4a7";
  html +=
    '<div class="card hero">' +
    '<div class="ring-wrap"><svg class="ring" viewBox="0 0 36 36">' +
    '<path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>' +
    '<path class="ring-fg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke="' +
    ringColor +
    '" stroke-dasharray="' +
    Math.min(util, 100).toFixed(1) +
    ', 100"/></svg>' +
    '<div class="ring-center"><span class="ring-pct">' +
    Math.round(util) +
    '%</span><span class="ring-sub">Spent</span></div></div>' +
    '<div class="hero-info">' +
    '<div class="muted small" style="text-transform:uppercase;letter-spacing:.5px;">Total Budget · ' +
    esc(monthLabel(mk)) +
    "</div>" +
    '<div class="big-num" style="color:var(--primary);margin-top:2px;">' +
    fmt(bud) +
    "</div>" +
    '<div class="hero-stats">' +
    '<div><p class="muted small" style="text-transform:uppercase;letter-spacing:.5px;">Spent</p><p>' +
    fmt(exp) +
    "</p></div>" +
    '<div><p class="muted small" style="text-transform:uppercase;letter-spacing:.5px;">Remaining</p><p class="' +
    (rem < 0 ? "neg" : "") +
    '" style="' +
    (rem < 0 ? "" : "color:var(--primary);") +
    '">' +
    fmt(rem) +
    "</p></div>" +
    "</div></div></div>";

  html +=
    '<div class="stat-grid">' +
    stat("Total Budget", fmt(bud)) +
    stat("Total Expenses", fmt(exp), "neg") +
    stat("Savings", fmt(sav), "pos") +
    stat("Income", fmt(inc), "pos") +
    stat("Remaining Cash", fmt(cash), cash < 0 ? "neg" : "") +
    stat("Net Worth", fmt(nw), nw < 0 ? "neg" : "pos") +
    "</div>";

  if (quick.length) {
    html +=
      '<h3 class="section-title">Quick Add</h3><div class="chips">' +
      quick
        .map(
          (c) =>
            '<button class="chip" data-act="quick-add" data-cat="' +
            c.id +
            '">' +
            esc(c.icon || "💸") +
            " " +
            esc(c.name) +
            "</button>",
        )
        .join("") +
      "</div>";
  }

  html += '<h3 class="section-title">Budgets</h3>';
  const cats = activeCats();
  if (!cats.length)
    html += emptyState(
      "🗂️",
      "No categories yet. Create one from More → Categories.",
    );
  else {
    html += '<div class="card">';
    for (const c of cats) {
      const sp = spentIn(c.id, mk);
      const r = c.budget - sp;
      const p = c.budget > 0 ? (sp / c.budget) * 100 : 0;
      html +=
        '<div class="cat-row" data-act="open-cat" data-cat="' +
        c.id +
        '">' +
        '<div class="cat-icon" style="background:' +
        (c.color || "#2dd4a7") +
        "22;color:" +
        (c.color || "#2dd4a7") +
        ';">' +
        esc(c.icon || "💸") +
        "</div>" +
        '<div class="cat-info"><div class="row spread"><span class="cat-name">' +
        esc(c.name) +
        '</span><span class="' +
        (r < 0 ? "neg" : "") +
        '" style="font-weight:600;">' +
        fmt(r) +
        "</span></div>" +
        '<div class="muted small">Spent ' +
        fmt(sp) +
        " of " +
        fmt(c.budget) +
        " · " +
        (c.budget > 0 ? p.toFixed(1) : "0") +
        "% used</div>" +
        colorBar(p) +
        "</div></div>";
    }
    html += "</div>";
  }

  html += '<h3 class="section-title">Recent Expenses</h3><div class="card">';
  html += recent.length
    ? recent.map(expRow).join("")
    : emptyState("🧾", "No expenses yet. Tap + to add one.");
  html += "</div>";
  return html;

  function stat(label, value, cls) {
    return (
      '<div class="stat"><div class="label">' +
      label +
      '</div><div class="value ' +
      (cls || "") +
      '">' +
      value +
      "</div></div>"
    );
  }
};

/* ---------- Expense row ---------- */
function expRow(e) {
  const c = catById(e.catId);
  const tags = (e.tags || [])
    .map((t) => '<span class="tag">' + esc(t) + "</span>")
    .join("");
  return (
    '<div class="cat-row">' +
    '<div class="cat-icon" style="background:' +
    ((c && c.color) || "#888") +
    "22;color:" +
    ((c && c.color) || "#888") +
    ';">' +
    esc((c && c.icon) || "💸") +
    "</div>" +
    '<div class="cat-info"><div class="cat-name">' +
    esc(e.note || (c && c.name) || "Expense") +
    (e.recurring ? " 🔁" : "") +
    "</div>" +
    '<div class="muted small">' +
    esc((c && c.name) || "Uncategorized") +
    " · " +
    esc(e.date) +
    " " +
    esc(e.time || "") +
    (tags ? " · " + tags : "") +
    "</div>" +
    (e.receipt
      ? '<img class="receipt-thumb" src="' +
        e.receipt +
        '" style="max-height:120px;" alt="receipt"/>'
      : "") +
    "</div>" +
    '<div style="text-align:right;"><div class="neg" style="font-weight:700;">−' +
    fmt(e.amount) +
    "</div>" +
    '<div class="list-actions" style="justify-content:flex-end;margin-top:4px;">' +
    '<button class="mini-btn" data-act="edit-expense" data-id="' +
    e.id +
    '">✏️</button>' +
    '<button class="mini-btn" data-act="del-expense" data-id="' +
    e.id +
    '">🗑️</button>' +
    "</div></div></div>"
  );
}

/* ---------- Expenses ---------- */
VIEWS.expenses = () => {
  if (!App.expMonth) App.expMonth = curMonthKey();
  const cats = activeCats();
  let html =
    '<div class="card"><input id="expSearch" type="search" placeholder="Search notes, tags, amounts…" value="' +
    esc(App.expSearch) +
    '"/></div>';

  html +=
    '<div class="chips">' +
    '<button class="chip" data-act="exp-prev-month">‹</button>' +
    '<button class="chip active">' +
    esc(monthLabel(App.expMonth)) +
    "</button>" +
    '<button class="chip" data-act="exp-next-month">›</button>' +
    '<button class="chip" data-act="exp-toggle-view">' +
    (App.expView === "list" ? "📅 Calendar" : "📋 List") +
    "</button>" +
    "</div>";

  html +=
    '<div class="form-group" style="margin-bottom:12px;"><select id="expFilterCat">' +
    '<option value="all">All Categories</option>' +
    cats
      .map(
        (c) =>
          '<option value="' +
          c.id +
          '"' +
          (App.expFilterCat === c.id ? " selected" : "") +
          ">" +
          esc(c.name) +
          "</option>",
      )
      .join("") +
    "</select></div>";

  if (App.expView === "calendar") html += calendarHTML();
  else {
    const list = filteredExpenses();
    if (!list.length)
      html += emptyState("🔍", "No expenses match this month / filter.");
    else {
      let lastDate = "";
      html += '<div class="card">';
      for (const e of list) {
        if (e.date !== lastDate) {
          lastDate = e.date;
          const dayTot = list
            .filter((x) => x.date === e.date)
            .reduce((s, x) => s + Number(x.amount), 0);
          html +=
            '<div class="muted small" style="font-weight:700;margin:8px 0 2px;">' +
            esc(fmtDate(e.date)) +
            " · " +
            fmt(dayTot) +
            "</div>";
        }
        html += expRow(e);
      }
      html += "</div>";
      const tot = list.reduce((s, e) => s + Number(e.amount), 0);
      html +=
        '<p class="muted" style="text-align:center;">' +
        list.length +
        " expenses · Total " +
        fmt(tot) +
        "</p>";
    }
  }
  return html;
};

function filteredExpenses() {
  let list = monthExpenses(App.expMonth);
  if (App.expFilterCat !== "all")
    list = list.filter((e) => e.catId === App.expFilterCat);
  const q = App.expSearch.trim().toLowerCase();
  if (q)
    list = list.filter((e) => {
      const c = catById(e.catId);
      return (
        (e.note || "").toLowerCase().includes(q) ||
        (c ? c.name.toLowerCase().includes(q) : false) ||
        String(e.amount).includes(q) ||
        (e.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  return list.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (b.time || "").localeCompare(a.time || ""),
  );
}

function calendarHTML() {
  const [y, m] = App.expMonth.split("-").map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay();
  const dim = daysInMonth(App.expMonth);
  const spendByDay = {};
  monthExpenses(App.expMonth).forEach((e) => {
    const d = Number(e.date.slice(8, 10));
    spendByDay[d] = (spendByDay[d] || 0) + Number(e.amount);
  });
  if (!App.calSelDate || monthKey(App.calSelDate) !== App.expMonth)
    App.calSelDate = App.expMonth === curMonthKey() ? todayISO() : null;

  let html = '<div class="card"><div class="cal-grid">';
  ["S", "M", "T", "W", "T", "F", "S"].forEach(
    (d) => (html += '<div class="cal-head">' + d + "</div>"),
  );
  for (let i = 0; i < firstDow; i++)
    html += '<div class="cal-day empty"></div>';
  for (let d = 1; d <= dim; d++) {
    const iso = App.expMonth + "-" + String(d).padStart(2, "0");
    html +=
      '<button class="cal-day' +
      (spendByDay[d] ? " has-spend" : "") +
      (iso === todayISO() ? " today" : "") +
      (iso === App.calSelDate ? " chip active" : "") +
      '" data-act="cal-day" data-date="' +
      iso +
      '">' +
      d +
      "</button>";
  }
  html += "</div>";
  if (App.calSelDate) {
    const dayList = DB.data.expenses
      .filter((e) => e.date === App.calSelDate)
      .sort((a, b) => (b.time || "").localeCompare(a.time || ""));
    const tot = dayList.reduce((s, e) => s + Number(e.amount), 0);
    html +=
      '<div class="divider"></div><div class="muted small" style="font-weight:700;margin-bottom:4px;">' +
      esc(fmtDate(App.calSelDate)) +
      " · " +
      fmt(tot) +
      "</div>";
    html += dayList.length
      ? dayList.map(expRow).join("")
      : '<p class="muted">No expenses this day.</p>';
  }
  html += "</div>";
  return html;
}

/* ---------- Savings ---------- */
VIEWS.savings = () => {
  const grand = savingsTotal();
  let html =
    '<div class="card"><div class="muted small">GRAND TOTAL SAVINGS</div>' +
    '<div class="big-num pos">' +
    fmt(grand) +
    "</div>" +
    '<button class="btn sm secondary" style="margin-top:10px;" data-act="add-section">＋ New Section</button></div>';

  const secs = DB.data.savingsSections.filter((s) => !s.archived);
  if (!secs.length)
    html += emptyState("💰", "Create sections like SIP, Emergency Fund, Gold…");

  for (const s of secs) {
    const tot = sectionTotal(s.id);
    const entries = DB.data.savingsEntries
      .filter((e) => e.sectionId === s.id)
      .sort((a, b) => b.date.localeCompare(a.date));
    const open = App.openSection === s.id;
    html +=
      '<div class="card"><div class="row spread">' +
      '<div class="row"><div class="cat-icon" style="background:' +
      (s.color || "#a78bfa") +
      "22;color:" +
      (s.color || "#a78bfa") +
      ';">' +
      esc(s.icon || "🏦") +
      "</div>" +
      '<div><div class="cat-name">' +
      esc(s.name) +
      '</div><div class="muted small">' +
      entries.length +
      " deposits</div></div></div>" +
      '<div style="text-align:right;"><div class="pos" style="font-weight:800;">' +
      fmt(tot) +
      "</div>" +
      '<div class="list-actions" style="justify-content:flex-end;margin-top:4px;">' +
      '<button class="mini-btn" data-act="add-money" data-id="' +
      s.id +
      '">＋</button>' +
      '<button class="mini-btn" data-act="toggle-section" data-id="' +
      s.id +
      '">' +
      (open ? "▲" : "▼") +
      "</button>" +
      '<button class="mini-btn" data-act="edit-section" data-id="' +
      s.id +
      '">✏️</button>' +
      '<button class="mini-btn" data-act="del-section" data-id="' +
      s.id +
      '">🗑️</button>' +
      "</div></div></div>";
    if (open) {
      html += '<div class="divider"></div>';
      html += entries.length
        ? entries
            .map(
              (en) =>
                '<div class="cat-row"><div class="cat-info"><div class="small">' +
                esc(en.note || "Deposit") +
                '</div><div class="muted small">' +
                esc(en.date) +
                " " +
                esc(en.time || "") +
                '</div></div><div style="text-align:right;">' +
                '<div class="pos" style="font-weight:600;">+' +
                fmt(en.amount) +
                "</div>" +
                '<div class="list-actions" style="justify-content:flex-end;">' +
                '<button class="mini-btn" data-act="edit-sentry" data-id="' +
                en.id +
                '">✏️</button>' +
                '<button class="mini-btn" data-act="del-sentry" data-id="' +
                en.id +
                '">🗑️</button>' +
                "</div></div></div>",
            )
            .join("")
        : '<p class="muted">No deposits yet.</p>';
    }
    html += "</div>";
  }

  // Goals
  html += '<h3 class="section-title">Financial Goals</h3>';
  const goals = DB.data.goals;
  if (!goals.length)
    html += emptyState("🎯", "No goals yet. Add one like “Laptop ₹1,00,000”.");
  else {
    html += '<div class="card">';
    for (const g of goals) {
      const p = g.target > 0 ? (g.saved / g.target) * 100 : 0;
      html +=
        '<div class="cat-row"><div class="cat-info"><div class="row spread"><span class="cat-name">' +
        esc(g.name) +
        '</span><span class="muted small">' +
        Math.round(p) +
        "%</span></div>" +
        '<div class="muted small">' +
        fmt(g.saved) +
        " / " +
        fmt(g.target) +
        (g.targetDate ? " · by " + esc(g.targetDate) : "") +
        "</div>" +
        colorBar(p) +
        "</div>" +
        '<div class="list-actions">' +
        '<button class="mini-btn" data-act="fund-goal" data-id="' +
        g.id +
        '">＋</button>' +
        '<button class="mini-btn" data-act="edit-goal" data-id="' +
        g.id +
        '">✏️</button>' +
        '<button class="mini-btn" data-act="del-goal" data-id="' +
        g.id +
        '">🗑️</button>' +
        "</div></div>";
    }
    html += "</div>";
  }
  html +=
    '<button class="btn secondary full" data-act="add-goal">＋ Add Goal</button>';
  return html;
};

/* ---------- Reports ---------- */
VIEWS.reports = () => {
  if (!App.repMonth) App.repMonth = curMonthKey();
  const mk = App.repMonth;
  const inc = incomeIn(mk),
    exp = totalSpent(mk),
    sav = savingsIn(mk);
  const bud = totalBudget();
  const util = bud > 0 ? (exp / bud) * 100 : 0;

  // category-wise
  const rows = activeCats()
    .map((c) => ({ c, sp: spentIn(c.id, mk) }))
    .filter((r) => r.c.budget > 0 || r.sp > 0)
    .sort((a, b) => b.sp - a.sp);
  const withSpend = rows.filter((r) => r.sp > 0);
  const hi = withSpend[0],
    lo = withSpend[withSpend.length - 1];

  // last 6 months series
  const labels = [],
    expSeries = [],
    savCum = [],
    budSeries = [],
    actSeries = [];
  let cum = 0;
  const allSav = {};
  DB.data.savingsEntries.forEach((e) => {
    const k = monthKey(e.date);
    allSav[k] = (allSav[k] || 0) + Number(e.amount);
  });
  for (let i = 5; i >= 0; i--) {
    const k = shiftMonth(curMonthKey(), -i);
    labels.push(
      new Date(
        Number(k.slice(0, 4)),
        Number(k.slice(5, 7)) - 1,
        1,
      ).toLocaleString("en", { month: "short" }),
    );
    const e6 = totalSpent(k);
    expSeries.push(e6);
    cum += allSav[k] || 0;
    savCum.push(cum);
    budSeries.push(totalBudget());
    actSeries.push(e6);
  }

  // analytics
  const mExp = monthExpenses(mk);
  const biggest = mExp.length
    ? mExp.reduce((a, b) => (Number(b.amount) > Number(a.amount) ? b : a))
    : null;
  const useCnt = {};
  mExp.forEach((e) => (useCnt[e.catId] = (useCnt[e.catId] || 0) + 1));
  const mostUsed = Object.keys(useCnt).length
    ? catById(
        Object.keys(useCnt).reduce((a, b) => (useCnt[b] > useCnt[a] ? b : a)),
      )
    : null;
  const [ry, rm] = mk.split("-").map(Number);
  const sd = DB.data.settings.monthStartDay || 1;
  const endDay = mk === curMonthKey() ? new Date().getDate() : daysInMonth(mk);
  const elapsed = Math.max(endDay - sd + 1, 1);
  const avgDaily = exp / elapsed;
  const avgMonthly = expSeries.reduce((s, x) => s + x, 0) / 6;
  const spendDays = new Set(mExp.map((e) => Number(e.date.slice(8, 10))));
  let streak = 0;
  for (let d = endDay; d >= sd; d--) {
    if (spendDays.has(d)) break;
    streak++;
  }
  const accs = rows
    .filter((r) => r.c.budget > 0)
    .map((r) =>
      Math.max(0, 100 - (Math.abs(r.sp - r.c.budget) / r.c.budget) * 100),
    );
  const accuracy = accs.length
    ? accs.reduce((s, x) => s + x, 0) / accs.length
    : null;
  const rate = inc > 0 ? Math.round((sav / inc) * 100) : null;
  const prevExp = totalSpent(shiftMonth(mk, -1));
  const trend =
    prevExp > 0 ? Math.round(((exp - prevExp) / prevExp) * 100) : null;

  let html =
    '<div class="chips">' +
    '<button class="chip" data-act="rep-prev">‹</button>' +
    '<button class="chip active">' +
    esc(monthLabel(mk)) +
    "</button>" +
    '<button class="chip" data-act="rep-next">›</button></div>';

  html += '<div class="health">' + esc(healthLine()) + "</div>";

  html +=
    '<div class="stat-grid">' +
    '<div class="stat"><div class="label">Income</div><div class="value pos">' +
    fmt(inc) +
    "</div></div>" +
    '<div class="stat"><div class="label">Expenses</div><div class="value neg">' +
    fmt(exp) +
    "</div></div>" +
    '<div class="stat"><div class="label">Savings Added</div><div class="value pos">' +
    fmt(sav) +
    "</div></div>" +
    '<div class="stat"><div class="label">Remaining Balance</div><div class="value">' +
    fmt(inc - exp) +
    "</div></div>" +
    '<div class="stat"><div class="label">Budget Utilization</div><div class="value">' +
    Math.round(util) +
    "%</div></div>" +
    '<div class="stat"><div class="label">Savings Rate</div><div class="value">' +
    (rate === null ? "—" : rate + "%") +
    "</div></div>" +
    "</div>";

  if (trend !== null)
    html +=
      '<p class="muted" style="margin-bottom:10px;">📈 Spending is <b class="' +
      (trend > 0 ? "neg" : "pos") +
      '">' +
      (trend > 0 ? "+" : "") +
      trend +
      "%</b> vs previous month.</p>";

  html +=
    '<div class="card"><h3>Expenses by Category</h3><canvas id="pieChart" class="chart"></canvas><div class="legend" id="pieLegend"></div></div>';
  html +=
    '<div class="card"><h3>Monthly Expenses (6 mo)</h3><canvas id="bar6" class="chart"></canvas></div>';
  html +=
    '<div class="card"><h3>Savings Growth (cumulative)</h3><canvas id="savLine" class="chart"></canvas></div>';
  html +=
    '<div class="card"><h3>Budget vs Actual</h3><div class="legend" style="margin:0 0 8px;"><span><i style="background:var(--accent);"></i>Budget</span><span><i style="background:var(--primary);"></i>Actual</span></div><canvas id="bvA" class="chart"></canvas></div>';

  html += '<div class="card"><h3>Category-wise Spending</h3>';
  html += rows.length
    ? '<table class="tbl"><tr><th>Category</th><th>Spent</th><th>Budget</th><th>Left</th></tr>' +
      rows
        .map(
          (r) =>
            "<tr><td>" +
            esc(r.c.name) +
            "</td><td>" +
            fmt(r.sp) +
            "</td><td>" +
            fmt(r.c.budget) +
            '</td><td class="' +
            (r.c.budget - r.sp < 0 ? "neg" : "") +
            '">' +
            fmt(r.c.budget - r.sp) +
            "</td></tr>",
        )
        .join("") +
      "</table>"
    : '<p class="muted">No data.</p>';
  html += "</div>";

  html +=
    '<div class="card"><h3>Highlights</h3><table class="tbl">' +
    "<tr><td>Highest spending category</td><td>" +
    (hi ? esc(hi.c.name) + " (" + fmt(hi.sp) + ")" : "—") +
    "</td></tr>" +
    "<tr><td>Lowest spending category</td><td>" +
    (lo ? esc(lo.c.name) + " (" + fmt(lo.sp) + ")" : "—") +
    "</td></tr>" +
    "<tr><td>Biggest expense</td><td>" +
    (biggest ? fmt(biggest.amount) + " · " + esc(biggest.note || "—") : "—") +
    "</td></tr>" +
    "<tr><td>Most used category</td><td>" +
    (mostUsed ? esc(mostUsed.name) : "—") +
    "</td></tr>" +
    "<tr><td>Average daily spending</td><td>" +
    fmt(avgDaily) +
    "</td></tr>" +
    "<tr><td>Average monthly spending</td><td>" +
    fmt(avgMonthly) +
    "</td></tr>" +
    "<tr><td>No-spend streak</td><td>" +
    streak +
    " day" +
    (streak === 1 ? "" : "s") +
    "</td></tr>" +
    "<tr><td>Budget accuracy</td><td>" +
    (accuracy === null ? "—" : Math.round(accuracy) + "%") +
    "</td></tr>" +
    "</table></div>";
  return html;
};

/* ---------- More ---------- */
VIEWS.more = () => {
  const items = [
    ["🗂️", "Categories", "categories"],
    ["💵", "Income", "income"],
    ["🏦", "Debts & Loans", "debts"],
    ["🎯", "Goals", "goals"],
    ["🛍️", "Wishlist", "wishlist"],
    ["🔍", "Global Search", "search"],
    ["💾", "Backup & Restore", "backup"],
    ["⚙️", "Settings", "settings"],
  ];
  return (
    '<div class="menu-grid">' +
    items
      .map(
        (i) =>
          '<button class="menu-item" data-act="go" data-view="' +
          i[2] +
          '">' +
          '<span class="mi-icon">' +
          i[0] +
          '</span><span class="mi-label">' +
          i[1] +
          "</span></button>",
      )
      .join("") +
    "</div>" +
    '<p class="muted" style="text-align:center;margin-top:16px;">FinTracker · Offline-first · Your data never leaves this device.</p>'
  );
};

/* ---------- Categories ---------- */
VIEWS.categories = () => {
  let html =
    '<button class="btn full" data-act="add-category" style="margin-bottom:12px;">＋ Add Category</button><div class="card">';
  const cats = DB.data.categories;
  if (!cats.length) html += emptyState("🗂️", "No categories yet.");
  for (const c of cats) {
    html +=
      '<div class="cat-row"' +
      (c.archived ? ' style="opacity:.55;"' : "") +
      ">" +
      '<div class="cat-icon" style="background:' +
      (c.color || "#888") +
      "22;color:" +
      (c.color || "#888") +
      ';">' +
      esc(c.icon || "💸") +
      "</div>" +
      '<div class="cat-info"><div class="cat-name">' +
      esc(c.name) +
      (c.archived ? ' <span class="tag">archived</span>' : "") +
      "</div>" +
      '<div class="muted small">Budget ' +
      fmt(c.budget) +
      "</div></div>" +
      '<div class="list-actions">' +
      '<button class="mini-btn" data-act="edit-category" data-id="' +
      c.id +
      '">✏️</button>' +
      '<button class="mini-btn" data-act="' +
      (c.archived ? "unarchive-cat" : "archive-cat") +
      '" data-id="' +
      c.id +
      '">' +
      (c.archived ? "📤" : "📥") +
      "</button>" +
      '<button class="mini-btn" data-act="del-category" data-id="' +
      c.id +
      '">🗑️</button>' +
      "</div></div>";
  }
  html += "</div>";
  return html;
};

/* ---------- Income ---------- */
VIEWS.income = () => {
  const mk = curMonthKey();
  const list = [...DB.data.incomes].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  let html =
    '<div class="card"><div class="muted small">INCOME THIS MONTH</div>' +
    '<div class="big-num pos">' +
    fmt(incomeIn(mk)) +
    "</div></div>" +
    '<button class="btn full" data-act="add-income" style="margin-bottom:12px;">＋ Add Income</button><div class="card">';
  html += list.length
    ? list
        .map(
          (i) =>
            '<div class="cat-row"><div class="cat-icon" style="background:var(--primary-dim);color:var(--primary);">💵</div>' +
            '<div class="cat-info"><div class="cat-name">' +
            esc(i.source) +
            "</div>" +
            '<div class="muted small">' +
            esc(i.date) +
            (i.note ? " · " + esc(i.note) : "") +
            "</div></div>" +
            '<div style="text-align:right;"><div class="pos" style="font-weight:700;">+' +
            fmt(i.amount) +
            "</div>" +
            '<div class="list-actions" style="justify-content:flex-end;">' +
            '<button class="mini-btn" data-act="edit-income" data-id="' +
            i.id +
            '">✏️</button>' +
            '<button class="mini-btn" data-act="del-income" data-id="' +
            i.id +
            '">🗑️</button>' +
            "</div></div></div>",
        )
        .join("")
    : emptyState("💵", "No income recorded yet.");
  html += "</div>";
  return html;
};

/* ---------- Debts ---------- */
VIEWS.debts = () => {
  const t = debtTotals();
  let html =
    '<div class="stat-grid">' +
    '<div class="stat"><div class="label">You Owe</div><div class="value neg">' +
    fmt(t.owed) +
    "</div></div>" +
    '<div class="stat"><div class="label">Lent To Others</div><div class="value pos">' +
    fmt(t.lent) +
    "</div></div>" +
    '<div class="stat"><div class="label">Net Debt Position</div><div class="value">' +
    fmt(t.lent - t.owed) +
    "</div></div>" +
    "</div>" +
    '<button class="btn full" data-act="add-debt" style="margin-bottom:12px;">＋ Add Debt / Loan</button><div class="card">';
  html += DB.data.debts.length
    ? DB.data.debts
        .map((d) => {
          const rem = Number(d.amount) - Number(d.paid || 0);
          return (
            '<div class="cat-row"><div class="cat-icon" style="background:var(--danger-dim);color:var(--danger);">🏦</div>' +
            '<div class="cat-info"><div class="cat-name">' +
            esc(d.name) +
            ' <span class="tag">' +
            DEBT_TYPES[d.type] +
            "</span></div>" +
            '<div class="muted small">Outstanding <b class="' +
            (rem > 0 ? "" : "pos") +
            '">' +
            fmt(rem) +
            "</b> of " +
            fmt(d.amount) +
            (d.note ? " · " + esc(d.note) : "") +
            "</div>" +
            colorBar(
              d.amount > 0 ? (Number(d.paid || 0) / d.amount) * 100 : 0,
            ) +
            "</div>" +
            '<div class="list-actions">' +
            '<button class="mini-btn" data-act="pay-debt" data-id="' +
            d.id +
            '">＋</button>' +
            '<button class="mini-btn" data-act="edit-debt" data-id="' +
            d.id +
            '">✏️</button>' +
            '<button class="mini-btn" data-act="del-debt" data-id="' +
            d.id +
            '">🗑️</button>' +
            "</div></div>"
          );
        })
        .join("")
    : emptyState("🏦", "No debts tracked.");
  html += "</div>";
  return html;
};

/* ---------- Goals ---------- */
VIEWS.goals = () => {
  let html =
    '<button class="btn full" data-act="add-goal" style="margin-bottom:12px;">＋ Add Goal</button><div class="card">';
  html += DB.data.goals.length
    ? DB.data.goals
        .map((g) => {
          const p = g.target > 0 ? (g.saved / g.target) * 100 : 0;
          return (
            '<div class="cat-row"><div class="cat-icon" style="background:var(--accent-dim);color:var(--accent);">🎯</div>' +
            '<div class="cat-info"><div class="row spread"><span class="cat-name">' +
            esc(g.name) +
            '</span><span class="muted small">' +
            Math.round(p) +
            "%</span></div>" +
            '<div class="muted small">' +
            fmt(g.saved) +
            " / " +
            fmt(g.target) +
            (g.targetDate ? " · by " + esc(g.targetDate) : "") +
            "</div>" +
            colorBar(p) +
            "</div>" +
            '<div class="list-actions">' +
            '<button class="mini-btn" data-act="fund-goal" data-id="' +
            g.id +
            '">＋</button>' +
            '<button class="mini-btn" data-act="edit-goal" data-id="' +
            g.id +
            '">✏️</button>' +
            '<button class="mini-btn" data-act="del-goal" data-id="' +
            g.id +
            '">🗑️</button>' +
            "</div></div>"
          );
        })
        .join("")
    : emptyState("🎯", "No goals yet.");
  html += "</div>";
  return html;
};

/* ---------- Wishlist ---------- */
VIEWS.wishlist = () => {
  let html =
    '<button class="btn full" data-act="add-wish" style="margin-bottom:12px;">＋ Add Wish Item</button><div class="card">';
  html += DB.data.wishlist.length
    ? DB.data.wishlist
        .map((w) => {
          const rem = Number(w.price) - Number(w.saved || 0);
          const p = w.price > 0 ? (w.saved / w.price) * 100 : 0;
          return (
            '<div class="cat-row"><div class="cat-icon" style="background:var(--accent-dim);color:var(--accent);">🛍️</div>' +
            '<div class="cat-info"><div class="cat-name">' +
            esc(w.item) +
            "</div>" +
            '<div class="muted small">' +
            fmt(w.price) +
            (w.targetDate ? " · want by " + esc(w.targetDate) : "") +
            " · saved " +
            fmt(w.saved || 0) +
            " · left " +
            fmt(Math.max(rem, 0)) +
            "</div>" +
            colorBar(p) +
            "</div>" +
            '<div class="list-actions">' +
            '<button class="mini-btn" data-act="fund-wish" data-id="' +
            w.id +
            '">＋</button>' +
            '<button class="mini-btn" data-act="edit-wish" data-id="' +
            w.id +
            '">✏️</button>' +
            '<button class="mini-btn" data-act="del-wish" data-id="' +
            w.id +
            '">🗑️</button>' +
            "</div></div>"
          );
        })
        .join("")
    : emptyState("🛍️", "Nothing on your wishlist yet.");
  html += "</div>";
  return html;
};

/* ---------- Global Search ---------- */
VIEWS.search = () =>
  '<div class="card"><input id="globalSearch" type="search" placeholder="Search categories, expenses, savings, notes…" value="' +
  esc(App.searchQ || "") +
  '"/></div><div id="searchResults"></div>';

/* ---------- Backup ---------- */
VIEWS.backup = () =>
  '<div class="card"><h3>Export</h3>' +
  '<div class="form-row"><button class="btn secondary" data-act="export-json">⬇️ JSON</button>' +
  '<button class="btn secondary" data-act="export-csv">⬇️ CSV (Expenses)</button></div></div>' +
  '<div class="card"><h3>Import</h3><p class="muted" style="margin-bottom:10px;">Restore from a JSON backup. This replaces current data.</p>' +
  '<button class="btn full" data-act="import-json">⬆️ Import JSON Backup</button></div>' +
  '<div class="card"><h3>Danger Zone</h3><button class="btn danger full" data-act="reset-data">🗑️ Erase All Data</button></div>';

/* ---------- Settings ---------- */
VIEWS.settings = () => {
  const s = DB.data.settings;
  return (
    '<div class="card"><h3>General</h3>' +
    '<div class="form-group"><label>Currency Symbol</label><input id="setCurrency" value="' +
    esc(s.currency) +
    '" maxlength="4"/></div>' +
    '<div class="switch-row"><span>Light Theme</span><label class="toggle"><input type="checkbox" id="setTheme"' +
    (s.theme === "light" ? " checked" : "") +
    '/><span class="track"></span></label></div>' +
    '<div class="form-group" style="margin-top:10px;"><label>Month Starts On (day 1–28)</label>' +
    '<input id="setStartDay" type="number" min="1" max="28" value="' +
    s.monthStartDay +
    '"/></div></div>' +
    '<div class="card"><h3>Notifications</h3>' +
    '<div class="switch-row"><span>Enable Notifications<br/><span class="muted small">Daily reminder + budget alerts</span></span>' +
    '<label class="toggle"><input type="checkbox" id="setNotif"' +
    (s.notifications ? " checked" : "") +
    '/><span class="track"></span></label></div></div>' +
    '<div class="card"><h3>Security</h3><div class="switch-row"><span>PIN Lock</span>' +
    (s.pin
      ? '<button class="btn sm danger" data-act="remove-pin">Remove PIN</button>'
      : '<button class="btn sm secondary" data-act="set-pin">Set PIN</button>') +
    "</div>" +
    (s.pin
      ? '<p class="muted small">🔒 App locks when reopened. (Biometric unlock uses your device browser support where available.)</p>'
      : "") +
    "</div>" +
    '<div class="card"><h3>About</h3><p class="muted small">FinTracker — offline personal finance tracker.<br/>All data is stored locally on this device. No account, no cloud, no tracking.</p></div>'
  );
};

/* ================================================================
   POST-RENDER (charts, listeners)
================================================================ */
const POSTRENDER = {};

POSTRENDER.expenses = () => {
  const si = document.getElementById("expSearch");
  if (si)
    si.addEventListener("input", () => {
      App.expSearch = si.value;
      const pos = si.selectionStart;
      render();
      const nsi = document.getElementById("expSearch");
      if (nsi) {
        nsi.focus();
        nsi.setSelectionRange(pos, pos);
      }
    });
  const fc = document.getElementById("expFilterCat");
  if (fc)
    fc.addEventListener("change", () => {
      App.expFilterCat = fc.value;
      render();
    });
};

POSTRENDER.reports = () => {
  const pieData = activeCats()
    .map((c) => ({
      label: c.name,
      value: spentIn(c.id, App.repMonth),
      color: c.color || "#888",
    }))
    .filter((x) => x.value > 0);
  const pc = document.getElementById("pieChart");
  if (pc) {
    Charts.pie(pc, pieData);
    const lg = document.getElementById("pieLegend");
    if (lg)
      lg.innerHTML = pieData
        .map(
          (x) =>
            '<span><i style="background:' +
            x.color +
            '"></i>' +
            esc(x.label) +
            " · " +
            fmtShort(x.value) +
            "</span>",
        )
        .join("");
  }
  const labels = [],
    expSeries = [],
    budSeries = [];
  for (let i = 5; i >= 0; i--) {
    const k = shiftMonth(curMonthKey(), -i);
    labels.push(
      new Date(
        Number(k.slice(0, 4)),
        Number(k.slice(5, 7)) - 1,
        1,
      ).toLocaleString("en", { month: "short" }),
    );
    expSeries.push(totalSpent(k));
    budSeries.push(totalBudget());
  }
  const b6 = document.getElementById("bar6");
  if (b6) Charts.bar(b6, labels, expSeries, Charts.css("--danger"));
  const sl = document.getElementById("savLine");
  if (sl) {
    let cum = 0;
    const vals = [],
      savLabels = [];
    for (let i = 5; i >= 0; i--) {
      const k = shiftMonth(curMonthKey(), -i);
      cum += savingsIn(k);
      vals.push(cum);
      savLabels.push(labels[5 - i]);
    }
    Charts.line(sl, savLabels, vals, Charts.css("--primary"));
  }
  const bv = document.getElementById("bvA");
  if (bv)
    Charts.groupedBar(
      bv,
      labels,
      budSeries,
      expSeries,
      Charts.css("--accent"),
      Charts.css("--primary"),
    );
};

POSTRENDER.search = () => {
  const gi = document.getElementById("globalSearch");
  if (!gi) return;
  gi.addEventListener("input", () => runSearch(gi.value));
  if (App.searchQ) runSearch(App.searchQ);
  gi.focus();
};

function runSearch(q) {
  App.searchQ = q;
  const box = document.getElementById("searchResults");
  q = q.trim().toLowerCase();
  if (!q) {
    box.innerHTML = "";
    return;
  }
  const cats = DB.data.categories.filter((c) =>
    c.name.toLowerCase().includes(q),
  );
  const exps = DB.data.expenses
    .filter(
      (e) =>
        (e.note || "").toLowerCase().includes(q) ||
        String(e.amount).includes(q) ||
        (e.tags || []).some((t) => t.toLowerCase().includes(q)) ||
        (catById(e.catId) || { name: "" }).name.toLowerCase().includes(q),
    )
    .slice(0, 30);
  const savs = DB.data.savingsEntries
    .filter(
      (e) =>
        (e.note || "").toLowerCase().includes(q) ||
        String(e.amount).includes(q),
    )
    .slice(0, 15);
  const incs = DB.data.incomes
    .filter(
      (i) =>
        (i.source || "").toLowerCase().includes(q) ||
        (i.note || "").toLowerCase().includes(q),
    )
    .slice(0, 15);

  let html = "";
  if (cats.length)
    html +=
      '<div class="card"><h3>Categories</h3>' +
      cats
        .map(
          (c) =>
            '<div class="cat-row"><div class="cat-icon" style="background:' +
            (c.color || "#888") +
            '22;">' +
            esc(c.icon || "💸") +
            '</div><div class="cat-info"><div class="cat-name">' +
            esc(c.name) +
            '</div><div class="muted small">Budget ' +
            fmt(c.budget) +
            "</div></div></div>",
        )
        .join("") +
      "</div>";
  if (exps.length)
    html +=
      '<div class="card"><h3>Expenses (' +
      exps.length +
      ")</h3>" +
      exps.map(expRow).join("") +
      "</div>";
  if (savs.length)
    html +=
      '<div class="card"><h3>Savings Deposits</h3>' +
      savs
        .map(
          (e) =>
            '<div class="cat-row"><div class="cat-info"><div class="small">' +
            esc((sectionById(e.sectionId) || {}).name || "—") +
            " · " +
            esc(e.note || "Deposit") +
            '</div><div class="muted small">' +
            esc(e.date) +
            "</div></div>" +
            '<div class="pos" style="font-weight:600;">+' +
            fmt(e.amount) +
            "</div></div>",
        )
        .join("") +
      "</div>";
  if (incs.length)
    html +=
      '<div class="card"><h3>Income</h3>' +
      incs
        .map(
          (i) =>
            '<div class="cat-row"><div class="cat-info"><div class="small">' +
            esc(i.source) +
            '</div><div class="muted small">' +
            esc(i.date) +
            '</div></div><div class="pos" style="font-weight:600;">+' +
            fmt(i.amount) +
            "</div></div>",
        )
        .join("") +
      "</div>";
  box.innerHTML = html || emptyState("🔍", "No results found.");
}

/* ================================================================
   MODALS & FORMS
================================================================ */
function catOptions(selId) {
  return activeCats()
    .map(
      (c) =>
        '<option value="' +
        c.id +
        '"' +
        (c.id === selId ? " selected" : "") +
        ">" +
        esc(c.name) +
        "</option>",
    )
    .join("");
}

function expenseModal(id) {
  const e = id ? DB.data.expenses.find((x) => x.id === id) : null;
  let receiptData = e ? e.receipt || "" : "";
  openModal(
    "<h2>" +
      (e ? "Edit Expense" : "Add Expense") +
      "</h2>" +
      '<form id="expForm">' +
      '<div class="form-group"><label>Amount *</label><input name="amount" type="number" step="0.01" min="0" required value="' +
      (e ? e.amount : "") +
      '" placeholder="0.00"/></div>' +
      '<div class="form-group"><label>Category *</label><select name="catId" required>' +
      catOptions(e ? e.catId : null) +
      "</select></div>" +
      '<div class="form-row">' +
      '<div class="form-group"><label>Date</label><input name="date" type="date" value="' +
      (e ? e.date : todayISO()) +
      '" required/></div>' +
      '<div class="form-group"><label>Time</label><input name="time" type="time" value="' +
      (e ? e.time || nowTime() : nowTime()) +
      '"/></div></div>' +
      '<div class="form-group"><label>Note</label><input name="note" value="' +
      esc(e ? e.note : "") +
      '" placeholder="Optional note"/></div>' +
      '<div class="form-group"><label>Tags (comma separated)</label><input name="tags" value="' +
      esc(e ? (e.tags || []).join(", ") : "") +
      '" placeholder="office, travel…"/></div>' +
      '<div class="switch-row"><span>🔁 Recurring monthly</span><label class="toggle"><input type="checkbox" name="recurring"' +
      (e && e.recurring ? " checked" : "") +
      '/><span class="track"></span></label></div>' +
      '<div class="form-group"><label>Receipt (optional image)</label><input type="file" id="receiptFile" accept="image/*"/>' +
      '<img id="receiptPrev" class="receipt-thumb" style="display:none;"/></div>' +
      '<div class="modal-actions"><button type="button" class="btn secondary" data-act="close-modal">Cancel</button>' +
      '<button type="submit" class="btn">' +
      (e ? "Update" : "Save") +
      "</button></div></form>",
  );
  const fileEl = document.getElementById("receiptFile");
  fileEl.addEventListener("change", () => {
    const f = fileEl.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const max = 480;
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = img.width * sc;
      cv.height = img.height * sc;
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      receiptData = cv.toDataURL("image/jpeg", 0.65);
      const pv = document.getElementById("receiptPrev");
      pv.src = receiptData;
      pv.style.display = "block";
    };
    img.src = URL.createObjectURL(f);
  });
  if (receiptData) {
    const pv = document.getElementById("receiptPrev");
    pv.src = receiptData;
    pv.style.display = "block";
  }
  document.getElementById("expForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const obj = {
      amount: Number(fd.get("amount")),
      catId: fd.get("catId"),
      date: fd.get("date"),
      time: fd.get("time") || nowTime(),
      note: fd.get("note").trim(),
      tags: fd
        .get("tags")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      recurring: fd.get("recurring") === "on",
      receipt: receiptData,
    };
    if (e) Object.assign(e, obj);
    else DB.data.expenses.push(Object.assign({ id: uid() }, obj));
    DB.save();
    checkBudgetThresholds(obj.catId);
    closeModal();
    render();
    toast(e ? "Expense updated ✓" : "Expense added ✓", "success");
  });
}

function categoryModal(id) {
  const c = id ? catById(id) : null;
  let color = c ? c.color : PALETTE[0];
  openModal(
    "<h2>" +
      (c ? "Edit Category" : "New Category") +
      "</h2>" +
      '<form id="catForm">' +
      '<div class="form-group"><label>Name *</label><input name="name" required value="' +
      esc(c ? c.name : "") +
      '" placeholder="Food, Rent…"/></div>' +
      '<div class="form-group"><label>Monthly Budget *</label><input name="budget" type="number" min="0" step="0.01" required value="' +
      (c ? c.budget : "") +
      '"/></div>' +
      '<div class="form-group"><label>Icon (emoji)</label><input name="icon" maxlength="4" value="' +
      esc(c ? c.icon || "" : "") +
      '" placeholder="🍔"/></div>' +
      '<div class="form-group"><label>Color</label><div class="chips" id="colorChips">' +
      PALETTE.map(
        (p) =>
          '<button type="button" class="chip' +
          (p === color ? " active" : "") +
          '" data-color="' +
          p +
          '" style="background:' +
          p +
          ';width:36px;height:36px;padding:0;border-radius:50%;"></button>',
      ).join("") +
      "</div></div>" +
      '<div class="modal-actions"><button type="button" class="btn secondary" data-act="close-modal">Cancel</button>' +
      '<button type="submit" class="btn">Save</button></div></form>',
  );
  document.querySelectorAll("#colorChips .chip").forEach((b) =>
    b.addEventListener("click", () => {
      color = b.dataset.color;
      document
        .querySelectorAll("#colorChips .chip")
        .forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    }),
  );
  document.getElementById("catForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const obj = {
      name: fd.get("name").trim(),
      budget: Number(fd.get("budget")),
      icon: fd.get("icon").trim(),
      color,
    };
    if (c) Object.assign(c, obj);
    else
      DB.data.categories.push(
        Object.assign({ id: uid(), archived: false }, obj),
      );
    DB.save();
    closeModal();
    render();
    toast("Category saved ✓", "success");
  });
}

function sectionModal(id) {
  const s = id ? sectionById(id) : null;
  let color = s ? s.color : PALETTE[2];
  openModal(
    "<h2>" +
      (s ? "Edit Section" : "New Savings Section") +
      "</h2>" +
      '<form id="secForm">' +
      '<div class="form-group"><label>Name *</label><input name="name" required value="' +
      esc(s ? s.name : "") +
      '" placeholder="Emergency Fund, SIP…"/></div>' +
      '<div class="form-group"><label>Icon (emoji)</label><input name="icon" maxlength="4" value="' +
      esc(s ? s.icon || "" : "") +
      '" placeholder="🏦"/></div>' +
      '<div class="form-group"><label>Color</label><div class="chips" id="secColors">' +
      PALETTE.map(
        (p) =>
          '<button type="button" class="chip' +
          (p === color ? " active" : "") +
          '" data-color="' +
          p +
          '" style="background:' +
          p +
          ';width:36px;height:36px;padding:0;border-radius:50%;"></button>',
      ).join("") +
      "</div></div>" +
      '<div class="modal-actions"><button type="button" class="btn secondary" data-act="close-modal">Cancel</button>' +
      '<button type="submit" class="btn">Save</button></div></form>',
  );
  document.querySelectorAll("#secColors .chip").forEach((b) =>
    b.addEventListener("click", () => {
      color = b.dataset.color;
      document
        .querySelectorAll("#secColors .chip")
        .forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    }),
  );
  document.getElementById("secForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const obj = {
      name: fd.get("name").trim(),
      icon: fd.get("icon").trim(),
      color,
    };
    if (s) Object.assign(s, obj);
    else
      DB.data.savingsSections.push(
        Object.assign({ id: uid(), archived: false }, obj),
      );
    DB.save();
    closeModal();
    render();
    toast("Section saved ✓", "success");
  });
}

function moneyModal(title, onSubmit, fields) {
  openModal(
    "<h2>" +
      title +
      '</h2><form id="moneyForm">' +
      fields +
      '<div class="modal-actions"><button type="button" class="btn secondary" data-act="close-modal">Cancel</button>' +
      '<button type="submit" class="btn">Save</button></div></form>',
  );
  document.getElementById("moneyForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    onSubmit(new FormData(ev.target));
    closeModal();
    render();
  });
}

function pinModal() {
  openModal(
    '<h2>Set PIN Lock</h2><form id="pinForm">' +
      '<div class="form-group"><label>4–6 digit PIN</label><input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" required/></div>' +
      '<div class="modal-actions"><button type="button" class="btn secondary" data-act="close-modal">Cancel</button>' +
      '<button type="submit" class="btn">Save</button></div></form>',
  );
  document.getElementById("pinForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    DB.data.settings.pin = new FormData(ev.target).get("pin");
    DB.save();
    closeModal();
    render();
    toast("PIN enabled 🔒", "success");
  });
}

/* ================================================================
   ACTIONS
================================================================ */
const ACTIONS = {
  "close-modal": closeModal,
  go: (el) => navTo(el.dataset.view),
  "go-search": () => navTo("search"),
  "add-expense": () => expenseModal(null),
  "edit-expense": (el) => expenseModal(el.dataset.id),
  "del-expense": (el) => {
    const e = DB.data.expenses.find((x) => x.id === el.dataset.id);
    confirmDlg("Delete this expense of " + fmt(e.amount) + "?", () => {
      DB.data.expenses = DB.data.expenses.filter((x) => x.id !== el.dataset.id);
      DB.save();
      render();
      toast("Expense deleted");
    });
  },
  "quick-add": (el) => expenseModal(null),
  "open-cat": (el) => {
    App.expFilterCat = el.dataset.cat;
    App.expMonth = curMonthKey();
    App.expView = "list";
    navTo("expenses");
  },
  "exp-prev-month": () => {
    App.expMonth = shiftMonth(App.expMonth, -1);
    render();
  },
  "exp-next-month": () => {
    App.expMonth = shiftMonth(App.expMonth, 1);
    render();
  },
  "exp-toggle-view": () => {
    App.expView = App.expView === "list" ? "calendar" : "list";
    render();
  },
  "cal-day": (el) => {
    App.calSelDate = el.dataset.date;
    render();
  },

  "add-category": () => categoryModal(null),
  "edit-category": (el) => categoryModal(el.dataset.id),
  "archive-cat": (el) => {
    catById(el.dataset.id).archived = true;
    DB.save();
    render();
    toast("Category archived");
  },
  "unarchive-cat": (el) => {
    catById(el.dataset.id).archived = false;
    DB.save();
    render();
    toast("Category restored");
  },
  "del-category": (el) => {
    const c = catById(el.dataset.id);
    const n = DB.data.expenses.filter((e) => e.catId === c.id).length;
    confirmDlg(
      'Delete "' +
        c.name +
        '"?' +
        (n ? " " + n + " expense(s) will also be deleted." : ""),
      () => {
        DB.data.categories = DB.data.categories.filter((x) => x.id !== c.id);
        DB.data.expenses = DB.data.expenses.filter((e) => e.catId !== c.id);
        DB.save();
        render();
        toast("Category deleted");
      },
    );
  },

  "add-section": () => sectionModal(null),
  "edit-section": (el) => sectionModal(el.dataset.id),
  "toggle-section": (el) => {
    App.openSection = App.openSection === el.dataset.id ? null : el.dataset.id;
    render();
  },
  "del-section": (el) => {
    const s = sectionById(el.dataset.id);
    confirmDlg('Delete "' + s.name + '" and all its deposits?', () => {
      DB.data.savingsSections = DB.data.savingsSections.filter(
        (x) => x.id !== s.id,
      );
      DB.data.savingsEntries = DB.data.savingsEntries.filter(
        (e) => e.sectionId !== s.id,
      );
      DB.save();
      render();
      toast("Section deleted");
    });
  },
  "add-money": (el) => {
    const sid = el.dataset.id;
    moneyModal(
      "Add Money → " + sectionById(sid).name,
      (fd) => {
        DB.data.savingsEntries.push({
          id: uid(),
          sectionId: sid,
          amount: Number(fd.get("amount")),
          date: fd.get("date"),
          time: nowTime(),
          note: fd.get("note").trim(),
        });
        DB.save();
        toast("Deposit added ✓", "success");
      },
      '<div class="form-group"><label>Amount *</label><input name="amount" type="number" min="0" step="0.01" required/></div>' +
        '<div class="form-group"><label>Date</label><input name="date" type="date" value="' +
        todayISO() +
        '" required/></div>' +
        '<div class="form-group"><label>Note</label><input name="note" placeholder="Optional"/></div>',
    );
  },
  "edit-sentry": (el) => {
    const en = DB.data.savingsEntries.find((x) => x.id === el.dataset.id);
    moneyModal(
      "Edit Deposit",
      (fd) => {
        en.amount = Number(fd.get("amount"));
        en.date = fd.get("date");
        en.note = fd.get("note").trim();
        DB.save();
        toast("Deposit updated ✓", "success");
      },
      '<div class="form-group"><label>Amount *</label><input name="amount" type="number" min="0" step="0.01" required value="' +
        en.amount +
        '"/></div>' +
        '<div class="form-group"><label>Date</label><input name="date" type="date" value="' +
        en.date +
        '" required/></div>' +
        '<div class="form-group"><label>Note</label><input name="note" value="' +
        esc(en.note) +
        '"/></div>',
    );
  },
  "del-sentry": (el) => {
    confirmDlg("Delete this deposit?", () => {
      DB.data.savingsEntries = DB.data.savingsEntries.filter(
        (x) => x.id !== el.dataset.id,
      );
      DB.save();
      render();
      toast("Deposit deleted");
    });
  },

  "add-income": () => {
    moneyModal(
      "Add Income",
      (fd) => {
        DB.data.incomes.push({
          id: uid(),
          source: fd.get("source").trim(),
          amount: Number(fd.get("amount")),
          date: fd.get("date"),
          note: fd.get("note").trim(),
        });
        DB.save();
        toast("Income added ✓", "success");
      },
      '<div class="form-group"><label>Source *</label><input name="source" required placeholder="Salary, Freelance, Bonus…"/></div>' +
        '<div class="form-group"><label>Amount *</label><input name="amount" type="number" min="0" step="0.01" required/></div>' +
        '<div class="form-group"><label>Date</label><input name="date" type="date" value="' +
        todayISO() +
        '" required/></div>' +
        '<div class="form-group"><label>Note</label><input name="note"/></div>',
    );
  },
  "edit-income": (el) => {
    const i = DB.data.incomes.find((x) => x.id === el.dataset.id);
    moneyModal(
      "Edit Income",
      (fd) => {
        i.source = fd.get("source").trim();
        i.amount = Number(fd.get("amount"));
        i.date = fd.get("date");
        i.note = fd.get("note").trim();
        DB.save();
        toast("Income updated ✓", "success");
      },
      '<div class="form-group"><label>Source *</label><input name="source" required value="' +
        esc(i.source) +
        '"/></div>' +
        '<div class="form-group"><label>Amount *</label><input name="amount" type="number" min="0" step="0.01" required value="' +
        i.amount +
        '"/></div>' +
        '<div class="form-group"><label>Date</label><input name="date" type="date" value="' +
        i.date +
        '" required/></div>' +
        '<div class="form-group"><label>Note</label><input name="note" value="' +
        esc(i.note) +
        '"/></div>',
    );
  },
  "del-income": (el) => {
    confirmDlg("Delete this income entry?", () => {
      DB.data.incomes = DB.data.incomes.filter((x) => x.id !== el.dataset.id);
      DB.save();
      render();
      toast("Income deleted");
    });
  },

  "add-debt": () => {
    moneyModal(
      "Add Debt / Loan",
      (fd) => {
        DB.data.debts.push({
          id: uid(),
          name: fd.get("name").trim(),
          type: fd.get("type"),
          amount: Number(fd.get("amount")),
          paid: Number(fd.get("paid") || 0),
          note: fd.get("note").trim(),
        });
        DB.save();
        toast("Debt added ✓", "success");
      },
      '<div class="form-group"><label>Name *</label><input name="name" required placeholder="Car loan, Ramesh…"/></div>' +
        '<div class="form-group"><label>Type</label><select name="type">' +
        Object.keys(DEBT_TYPES)
          .map(
            (k) => '<option value="' + k + '">' + DEBT_TYPES[k] + "</option>",
          )
          .join("") +
        "</select></div>" +
        '<div class="form-row"><div class="form-group"><label>Total Amount *</label><input name="amount" type="number" min="0" step="0.01" required/></div>' +
        '<div class="form-group"><label>Already Paid</label><input name="paid" type="number" min="0" step="0.01" value="0"/></div></div>' +
        '<div class="form-group"><label>Note</label><input name="note"/></div>',
    );
  },
  "pay-debt": (el) => {
    const d = DB.data.debts.find((x) => x.id === el.dataset.id);
    moneyModal(
      "Record Payment → " + d.name,
      (fd) => {
        d.paid = Number(d.paid || 0) + Number(fd.get("amount"));
        DB.save();
        toast("Payment recorded ✓", "success");
      },
      '<div class="form-group"><label>Payment Amount *</label><input name="amount" type="number" min="0" step="0.01" required/></div>',
    );
  },
  "edit-debt": (el) => {
    const d = DB.data.debts.find((x) => x.id === el.dataset.id);
    moneyModal(
      "Edit Debt",
      (fd) => {
        d.name = fd.get("name").trim();
        d.type = fd.get("type");
        d.amount = Number(fd.get("amount"));
        d.paid = Number(fd.get("paid") || 0);
        d.note = fd.get("note").trim();
        DB.save();
        toast("Debt updated ✓", "success");
      },
      '<div class="form-group"><label>Name *</label><input name="name" required value="' +
        esc(d.name) +
        '"/></div>' +
        '<div class="form-group"><label>Type</label><select name="type">' +
        Object.keys(DEBT_TYPES)
          .map(
            (k) =>
              '<option value="' +
              k +
              '"' +
              (d.type === k ? " selected" : "") +
              ">" +
              DEBT_TYPES[k] +
              "</option>",
          )
          .join("") +
        "</select></div>" +
        '<div class="form-row"><div class="form-group"><label>Total Amount *</label><input name="amount" type="number" min="0" step="0.01" required value="' +
        d.amount +
        '"/></div>' +
        '<div class="form-group"><label>Paid</label><input name="paid" type="number" min="0" step="0.01" value="' +
        (d.paid || 0) +
        '"/></div></div>' +
        '<div class="form-group"><label>Note</label><input name="note" value="' +
        esc(d.note) +
        '"/></div>',
    );
  },
  "del-debt": (el) => {
    confirmDlg("Delete this debt record?", () => {
      DB.data.debts = DB.data.debts.filter((x) => x.id !== el.dataset.id);
      DB.save();
      render();
      toast("Deleted");
    });
  },

  "add-goal": () => {
    moneyModal(
      "Add Financial Goal",
      (fd) => {
        DB.data.goals.push({
          id: uid(),
          name: fd.get("name").trim(),
          target: Number(fd.get("target")),
          saved: Number(fd.get("saved") || 0),
          targetDate: fd.get("targetDate"),
        });
        DB.save();
        toast("Goal added ✓", "success");
      },
      '<div class="form-group"><label>Goal Name *</label><input name="name" required placeholder="Laptop, Vacation…"/></div>' +
        '<div class="form-row"><div class="form-group"><label>Target Amount *</label><input name="target" type="number" min="0" step="0.01" required/></div>' +
        '<div class="form-group"><label>Already Saved</label><input name="saved" type="number" min="0" step="0.01" value="0"/></div></div>' +
        '<div class="form-group"><label>Target Date</label><input name="targetDate" type="date"/></div>',
    );
  },
  "fund-goal": (el) => {
    const g = DB.data.goals.find((x) => x.id === el.dataset.id);
    moneyModal(
      "Add to " + g.name,
      (fd) => {
        g.saved = Number(g.saved || 0) + Number(fd.get("amount"));
        DB.save();
        toast("Goal funded ✓", "success");
      },
      '<div class="form-group"><label>Amount *</label><input name="amount" type="number" min="0" step="0.01" required/></div>',
    );
  },
  "edit-goal": (el) => {
    const g = DB.data.goals.find((x) => x.id === el.dataset.id);
    moneyModal(
      "Edit Goal",
      (fd) => {
        g.name = fd.get("name").trim();
        g.target = Number(fd.get("target"));
        g.saved = Number(fd.get("saved") || 0);
        g.targetDate = fd.get("targetDate");
        DB.save();
        toast("Goal updated ✓", "success");
      },
      '<div class="form-group"><label>Goal Name *</label><input name="name" required value="' +
        esc(g.name) +
        '"/></div>' +
        '<div class="form-row"><div class="form-group"><label>Target *</label><input name="target" type="number" min="0" step="0.01" required value="' +
        g.target +
        '"/></div>' +
        '<div class="form-group"><label>Saved</label><input name="saved" type="number" min="0" step="0.01" value="' +
        (g.saved || 0) +
        '"/></div></div>' +
        '<div class="form-group"><label>Target Date</label><input name="targetDate" type="date" value="' +
        esc(g.targetDate || "") +
        '"/></div>',
    );
  },
  "del-goal": (el) => {
    confirmDlg("Delete this goal?", () => {
      DB.data.goals = DB.data.goals.filter((x) => x.id !== el.dataset.id);
      DB.save();
      render();
      toast("Goal deleted");
    });
  },

  "add-wish": () => {
    moneyModal(
      "Add Wish Item",
      (fd) => {
        DB.data.wishlist.push({
          id: uid(),
          item: fd.get("item").trim(),
          price: Number(fd.get("price")),
          saved: Number(fd.get("saved") || 0),
          targetDate: fd.get("targetDate"),
        });
        DB.save();
        toast("Added to wishlist ✓", "success");
      },
      '<div class="form-group"><label>Item *</label><input name="item" required placeholder="Headphones…"/></div>' +
        '<div class="form-row"><div class="form-group"><label>Price *</label><input name="price" type="number" min="0" step="0.01" required/></div>' +
        '<div class="form-group"><label>Current Savings</label><input name="saved" type="number" min="0" step="0.01" value="0"/></div></div>' +
        '<div class="form-group"><label>Target Date</label><input name="targetDate" type="date"/></div>',
    );
  },
  "fund-wish": (el) => {
    const w = DB.data.wishlist.find((x) => x.id === el.dataset.id);
    moneyModal(
      "Save toward " + w.item,
      (fd) => {
        w.saved = Number(w.saved || 0) + Number(fd.get("amount"));
        DB.save();
        toast("Saved ✓", "success");
      },
      '<div class="form-group"><label>Amount *</label><input name="amount" type="number" min="0" step="0.01" required/></div>',
    );
  },
  "edit-wish": (el) => {
    const w = DB.data.wishlist.find((x) => x.id === el.dataset.id);
    moneyModal(
      "Edit Wish Item",
      (fd) => {
        w.item = fd.get("item").trim();
        w.price = Number(fd.get("price"));
        w.saved = Number(fd.get("saved") || 0);
        w.targetDate = fd.get("targetDate");
        DB.save();
        toast("Updated ✓", "success");
      },
      '<div class="form-group"><label>Item *</label><input name="item" required value="' +
        esc(w.item) +
        '"/></div>' +
        '<div class="form-row"><div class="form-group"><label>Price *</label><input name="price" type="number" min="0" step="0.01" required value="' +
        w.price +
        '"/></div>' +
        '<div class="form-group"><label>Saved</label><input name="saved" type="number" min="0" step="0.01" value="' +
        (w.saved || 0) +
        '"/></div></div>' +
        '<div class="form-group"><label>Target Date</label><input name="targetDate" type="date" value="' +
        esc(w.targetDate || "") +
        '"/></div>',
    );
  },
  "del-wish": (el) => {
    confirmDlg("Remove this wish item?", () => {
      DB.data.wishlist = DB.data.wishlist.filter((x) => x.id !== el.dataset.id);
      DB.save();
      render();
      toast("Removed");
    });
  },

  "rep-prev": () => {
    App.repMonth = shiftMonth(App.repMonth, -1);
    render();
  },
  "rep-next": () => {
    App.repMonth = shiftMonth(App.repMonth, 1);
    render();
  },

  /* ---- Backup ---- */
  "export-json": () => {
    download(
      "fintracker-backup-" + todayISO() + ".json",
      JSON.stringify(DB.data, null, 2),
    );
    toast("JSON exported ✓", "success");
  },
  "export-csv": () => {
    const rows = [["Date", "Time", "Category", "Amount", "Note", "Tags"]];
    [...DB.data.expenses]
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((e) => {
        const c = catById(e.catId);
        rows.push([
          e.date,
          e.time || "",
          (c && c.name) || "",
          e.amount,
          e.note || "",
          (e.tags || []).join("|"),
        ]);
      });
    const csv = rows
      .map((r) =>
        r.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(","),
      )
      .join("\n");
    download("fintracker-expenses-" + todayISO() + ".csv", csv, "text/csv");
    toast("CSV exported ✓", "success");
  },
  "import-json": () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json,application/json";
    inp.onchange = () => {
      const f = inp.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const parsed = JSON.parse(rd.result);
          if (!parsed.settings || !Array.isArray(parsed.categories))
            throw new Error("bad format");
          confirmDlg(
            "Replace ALL current data with this backup?",
            () => {
              DB.data = parsed;
              DB.migrate();
              DB.save();
              render();
              toast("Backup restored ✓", "success");
            },
            "Restore",
          );
        } catch (err) {
          toast("Invalid backup file", "error");
        }
      };
      rd.readAsText(f);
    };
    inp.click();
  },
  "reset-data": () => {
    confirmDlg(
      "This will PERMANENTLY erase all data on this device. Export a backup first!",
      () => {
        DB.reset();
        render();
        toast("All data erased");
      },
      "Erase Everything",
    );
  },

  /* ---- Settings ---- */
  "set-pin": pinModal,
  "remove-pin": () => {
    confirmDlg("Remove PIN lock?", () => {
      DB.data.settings.pin = "";
      DB.save();
      render();
      toast("PIN removed");
    });
  },
};

/* ================================================================
   PIN LOCK
================================================================ */
let pinBuffer = "";
function setupLock() {
  if (!DB.data.settings.pin || sessionStorage.getItem("finUnlocked") === "1")
    return;
  const lock = document.getElementById("lock");
  lock.classList.remove("hidden");
  pinBuffer = "";
  drawPinDots();
  const pad = document.getElementById("pinPad");
  pad.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"]
    .map((k) =>
      k === ""
        ? "<span></span>"
        : '<button data-k="' + k + '">' + k + "</button>",
    )
    .join("");
  pad.onclick = (e) => {
    const b = e.target.closest("button[data-k]");
    if (!b) return;
    const k = b.dataset.k;
    if (k === "⌫") pinBuffer = pinBuffer.slice(0, -1);
    else if (pinBuffer.length < 6) pinBuffer += k;
    drawPinDots();
    if (pinBuffer.length >= 4 && pinBuffer === DB.data.settings.pin) {
      sessionStorage.setItem("finUnlocked", "1");
      lock.classList.add("hidden");
    } else if (pinBuffer.length >= 6 && pinBuffer !== DB.data.settings.pin) {
      document.getElementById("pinErr").textContent = "Wrong PIN, try again";
      pinBuffer = "";
      setTimeout(drawPinDots, 250);
    }
  };
  function drawPinDots() {
    document.getElementById("pinErr").textContent = "";
    document.getElementById("pinDots").innerHTML = [0, 1, 2, 3]
      .map((i) => '<i class="' + (i < pinBuffer.length ? "on" : "") + '"></i>')
      .join("");
  }
}

/* ================================================================
   SETTINGS BINDINGS
================================================================ */
function bindSettings() {
  const cur = document.getElementById("setCurrency");
  if (cur)
    cur.addEventListener("change", () => {
      DB.data.settings.currency = cur.value.trim() || "₹";
      DB.save();
      render();
    });
  const th = document.getElementById("setTheme");
  if (th)
    th.addEventListener("change", () => {
      DB.data.settings.theme = th.checked ? "light" : "dark";
      applyTheme();
      DB.save();
    });
  const sd = document.getElementById("setStartDay");
  if (sd)
    sd.addEventListener("change", () => {
      let v = parseInt(sd.value, 10);
      if (isNaN(v)) v = 1;
      DB.data.settings.monthStartDay = Math.min(Math.max(v, 1), 28);
      DB.save();
      render();
      toast(
        "Month start updated. Months will reset on day " +
          DB.data.settings.monthStartDay +
          ".",
      );
    });
  const nt = document.getElementById("setNotif");
  if (nt)
    nt.addEventListener("change", () => {
      DB.data.settings.notifications = nt.checked;
      DB.save();
      if (
        nt.checked &&
        "Notification" in window &&
        Notification.permission === "default"
      )
        Notification.requestPermission();
      toast(nt.checked ? "Notifications on ✓" : "Notifications off");
    });
}
POSTRENDER.settings = bindSettings;

function applyTheme() {
  document.body.classList.toggle("light", DB.data.settings.theme === "light");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta)
    meta.content = DB.data.settings.theme === "light" ? "#f6f8fb" : "#0f131b";
}

/* ================================================================
   INIT
================================================================ */
function init() {
  DB.load();
  applyTheme();
  syncRecurring();
  setupLock();

  document.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav) {
      navTo(nav.dataset.nav);
      return;
    }
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const fn = ACTIONS[el.dataset.act];
    if (fn) fn(el);
  });

  render();
  setInterval(checkDailyReminder, 15 * 60 * 1000);
  setTimeout(checkDailyReminder, 4000);

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0)
    navigator.serviceWorker.register("sw.js").catch(() => {});
}

init();

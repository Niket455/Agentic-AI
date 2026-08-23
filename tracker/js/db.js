/* ============ FinTracker — Data Layer (localStorage) ============ */
"use strict";

const DB_KEY = "fintracker_v1";

const DB = {
  data: null,

  defaults() {
    return {
      settings: {
        currency: "₹",
        theme: "dark",
        monthStartDay: 1,
        notifications: true,
        pin: "",
      },
      categories: [], // {id,name,budget,color,icon,archived,createdAt}
      expenses: [], // {id,catId,amount,date:'YYYY-MM-DD',time,note,tags:[],recurring,receipt}
      savingsSections: [], // {id,name,color,icon,archived}
      savingsEntries: [], // {id,sectionId,amount,date,note,time}
      incomes: [], // {id,source,amount,date,note}
      debts: [], // {id,name,type,amount,paid,note}  type: loan|credit|borrowed|lent
      goals: [], // {id,name,target,saved,targetDate}
      wishlist: [], // {id,item,price,targetDate,saved}
      meta: {
        lastReminder: "",
        notified: {}, // `${catId}:${monthKey}` -> threshold already fired
      },
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      this.data = raw ? JSON.parse(raw) : this.defaults();
    } catch (e) {
      console.error("DB load failed", e);
      this.data = this.defaults();
    }
    this.migrate();
    return this.data;
  },

  save() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error("DB save failed (storage full?)", e);
      toast("Storage full! Export a backup and remove old receipts.", "error");
    }
  },

  migrate() {
    const d = this.defaults();
    for (const k in d) if (this.data[k] === undefined) this.data[k] = d[k];
    for (const k in d.settings)
      if (this.data.settings[k] === undefined)
        this.data.settings[k] = d.settings[k];
  },

  reset() {
    this.data = this.defaults();
    this.save();
  },
};

/* ---------- Utilities ---------- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "\u0026amp;",
        "<": "\u0026lt;",
        ">": "\u0026gt;",
        '"': "\u0026quot;",
        "'": "\u0026#39;",
      })[c],
  );
}

/** Month key 'YYYY-MM' that a date belongs to, honoring custom month start day. */
function monthKey(dateStr, startDay) {
  const d = new Date(dateStr + "T00:00:00");
  const sd = startDay || DB.data.settings.monthStartDay || 1;
  let y = d.getFullYear(),
    m = d.getMonth();
  if (d.getDate() < sd) {
    m--;
    if (m < 0) {
      m = 11;
      y--;
    }
  }
  return y + "-" + String(m + 1).padStart(2, "0");
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(key, delta) {
  let [y, m] = key.split("-").map(Number);
  m += delta;
  while (m < 1) {
    m += 12;
    y--;
  }
  while (m > 12) {
    m -= 12;
    y++;
  }
  return y + "-" + String(m).padStart(2, "0");
}

function daysInMonth(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function todayISO() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function nowTime() {
  const d = new Date();
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
}

function curMonthKey() {
  return monthKey(todayISO());
}

function fmt(n) {
  const num = Number(n) || 0;
  const s = Math.abs(num).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return (num < 0 ? "−" : "") + DB.data.settings.currency + s;
}

function fmtShort(n) {
  n = Number(n) || 0;
  const c = DB.data.settings.currency;
  if (Math.abs(n) >= 1e7) return c + (n / 1e7).toFixed(2) + "Cr";
  if (Math.abs(n) >= 1e5) return c + (n / 1e5).toFixed(2) + "L";
  if (Math.abs(n) >= 1e3) return c + (n / 1e3).toFixed(1) + "K";
  return c + n.toFixed(0);
}

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime || "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

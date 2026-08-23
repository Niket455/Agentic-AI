/* ============ FinTracker — Lightweight Canvas Charts ============ */
"use strict";

const Charts = {
  prep(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 220;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  },

  css(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  },

  empty(ctx, w, h) {
    ctx.fillStyle = this.css("--text-dim");
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No data yet", w / 2, h / 2);
  },

  /** items: [{label, value, color}] */
  pie(canvas, items) {
    const { ctx, w, h } = this.prep(canvas);
    const total = items.reduce((s, i) => s + i.value, 0);
    if (!total) return this.empty(ctx, w, h);
    const cx = w / 2,
      cy = h / 2;
    const r = Math.min(w, h) / 2 - 14;
    let start = -Math.PI / 2;
    for (const it of items) {
      const ang = (it.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + ang);
      ctx.closePath();
      ctx.fillStyle = it.color;
      ctx.fill();
      ctx.strokeStyle = this.css("--surface");
      ctx.lineWidth = 2;
      ctx.stroke();
      start += ang;
    }
    // donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = this.css("--surface");
    ctx.fill();
    ctx.fillStyle = this.css("--text");
    ctx.font = "700 15px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fmtShort(total), cx, cy);
  },

  /** labels: [], values: [], color */
  bar(canvas, labels, values, color) {
    const { ctx, w, h } = this.prep(canvas);
    const max = Math.max(...values, 1);
    const padB = 24,
      padT = 10;
    const bw = w / labels.length;
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    labels.forEach((lb, i) => {
      const bh = ((h - padB - padT) * values[i]) / max;
      const x = i * bw + bw * 0.18;
      const y = h - padB - bh;
      const bwi = bw * 0.64;
      ctx.beginPath();
      ctx.roundRect(x, y, bwi, Math.max(bh, 2), [6, 6, 0, 0]);
      ctx.fillStyle = color || this.css("--primary");
      ctx.fill();
      ctx.fillStyle = this.css("--text-dim");
      ctx.fillText(lb, i * bw + bw / 2, h - 8);
      if (values[i] > 0) {
        ctx.fillStyle = this.css("--text");
        ctx.fillText(fmtShort(values[i]), i * bw + bw / 2, y - 4);
      }
    });
  },

  /** Budget vs Actual: two series per label */
  groupedBar(canvas, labels, seriesA, seriesB, colA, colB) {
    const { ctx, w, h } = this.prep(canvas);
    const max = Math.max(...seriesA, ...seriesB, 1);
    const padB = 24,
      padT = 10;
    const gw = w / labels.length;
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    labels.forEach((lb, i) => {
      const ha = ((h - padB - padT) * seriesA[i]) / max;
      const hb = ((h - padB - padT) * seriesB[i]) / max;
      const bw = gw * 0.32;
      const x1 = i * gw + gw * 0.12;
      const x2 = x1 + bw + 3;
      ctx.beginPath();
      ctx.roundRect(x1, h - padB - ha, bw, Math.max(ha, 2), [5, 5, 0, 0]);
      ctx.fillStyle = colA;
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x2, h - padB - hb, bw, Math.max(hb, 2), [5, 5, 0, 0]);
      ctx.fillStyle = colB;
      ctx.fill();
      ctx.fillStyle = this.css("--text-dim");
      ctx.fillText(lb, i * gw + gw / 2, h - 8);
    });
  },

  /** Savings growth line */
  line(canvas, labels, values, color) {
    const { ctx, w, h } = this.prep(canvas);
    if (!values.length) return this.empty(ctx, w, h);
    const max = Math.max(...values, 1);
    const padL = 8,
      padR = 8,
      padB = 24,
      padT = 12;
    const iw = w - padL - padR,
      ih = h - padB - padT;
    const pts = values.map((v, i) => ({
      x: padL + (values.length === 1 ? iw / 2 : (i * iw) / (values.length - 1)),
      y: padT + ih - (ih * v) / max,
    }));
    // area fill
    ctx.beginPath();
    ctx.moveTo(pts[0].x, h - padB);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, h - padB);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
    grad.addColorStop(0, color + "55");
    grad.addColorStop(1, color + "00");
    ctx.fillStyle = grad;
    ctx.fill();
    // line
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.stroke();
    // dots
    pts.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
    ctx.font = "11px sans-serif";
    ctx.fillStyle = this.css("--text-dim");
    ctx.textAlign = "center";
    labels.forEach((lb, i) => {
      const x =
        padL + (labels.length === 1 ? iw / 2 : (i * iw) / (labels.length - 1));
      ctx.fillText(lb, x, h - 8);
    });
  },
};

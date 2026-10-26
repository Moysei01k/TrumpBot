// Grok White House · TrumpBot
// One canvas, one continuous camera. Everything is a pure function of t (seconds),
// so `render(t)` draws the same frame every time. The timeline comes from the
// Python director (`python -m trumpbot export`). Original fictional parody.
(() => {
  "use strict";

  const T = window.TIMELINE;
  const RUN = T.run_seconds, ROOM_S = T.room_seconds, WALK = T.walk_seconds;
  const RENDER_MODE = new URLSearchParams(location.search).has("render");

  // ── palette ──────────────────────────────────────────────────────────────
  const C = {
    navy: "#14304f", navy2: "#0f2540", deep: "#0b1c33", line: "#2c557c",
    cream: "#f3ead2", paper: "#f5f2ea", paperEdge: "#d8d2c4", ink: "#1d2b3c", mute: "#6b7684",
    cyan: "#1f8fb3", sky: "#5fc4e0", gold: "#c9a43a", red: "#c8443f", purple: "#7d5aa6",
    green: "#1aa37a", amber: "#e0a526", blue: "#5872b8",
    skin: "#f2c9a0", hair: "#f2c14e", suit: "#22385a", grey: "#c9ccd1",
  };
  const ROOM_COLOR = { oval: C.gold, cabinet: C.cyan, press: C.red, ops: C.blue };
  const ROLE_COLOR = { reader: C.cyan, checker: C.green, router: C.purple, scribe: C.gold };
  const MONO = '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace';
  const SANS = '"Inter", "Helvetica Neue", Arial, sans-serif';

  // ── geometry ─────────────────────────────────────────────────────────────
  const W = 1080, H = 1080;
  const VX = 18, VY = 196, VW = 1044, VH = 508;          // camera viewport on screen
  const WORLD_W = 3040, WORLD_H = 565, WALL = 82;         // the floorplan
  const ROOM_W = 710, roomX0 = i => 40 + i * 750;
  const rooms = T.rooms;
  const roomByKey = Object.fromEntries(rooms.map(r => [r.key, r]));

  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const DPR = RENDER_MODE ? 1 : Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * DPR; canvas.height = H * DPR;

  // ── math ─────────────────────────────────────────────────────────────────
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const lerp = (a, b, u) => a + (b - a) * u;
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  // Same camera as trumpbot/core.py: follow the president, never cut.
  const roomIndexAt = t => clamp(Math.floor(t / ROOM_S), 0, rooms.length - 1);
  function cameraX(t) {
    const r = rooms[roomIndexAt(t)];
    if (r.index === 0) return r.center_x;
    const prev = rooms[r.index - 1].center_x;
    return prev + (r.center_x - prev) * smooth((t - r.start) / WALK);
  }
  const cameraZoom = t => 0.9 - 0.18 * smooth((t - (RUN - 4)) / 4);

  // ── drawing helpers ──────────────────────────────────────────────────────
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function box(x, y, w, h, r, fill, stroke, lw = 1) {
    rr(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function text(s, x, y, size, color, opts = {}) {
    ctx.font = `${opts.weight || 400} ${size}px ${opts.font || MONO}`;
    ctx.fillStyle = color;
    ctx.textAlign = opts.align || "left";
    ctx.textBaseline = opts.base || "alphabetic";
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${opts.spacing || 0}px`;
    if (opts.max) {
      while (s.length > 1 && ctx.measureText(s).width > opts.max) s = s.slice(0, -1);
    }
    ctx.fillText(s, x, y);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  }
  function tag(s, x, y, color, opts = {}) {   // small label box centred on x
    ctx.font = `600 ${opts.size || 8}px ${MONO}`;
    const w = ctx.measureText(s).width + 12, h = (opts.size || 8) + 9;
    box(x - w / 2, y - h / 2, w, h, 3, opts.fill || "#fbf8f0", color, 1.2);
    text(s, x, y + 0.5, opts.size || 8, opts.ink || color, { weight: 600, align: "center", base: "middle" });
  }

  // ── people ───────────────────────────────────────────────────────────────
  function person(g, x, y, o = {}) {
    const s = o.scale || 1, step = o.walk ? Math.sin(o.walk) : 0;
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = "rgba(20,30,45,.22)"; g.beginPath(); g.ellipse(0, 0, 15, 5, 0, 0, 7); g.fill();
    if (!o.seated) {                                   // legs
      g.fillStyle = "#1a2a40";
      g.fillRect(-7 + step * 2, -24, 6, 24); g.fillRect(1 - step * 2, -24, 6, 24);
      g.fillStyle = "#111b29"; g.fillRect(-8 + step * 2, -3, 8, 4); g.fillRect(0 - step * 2, -3, 8, 4);
    }
    const top = o.seated ? -40 : -58;                  // suit
    g.fillStyle = o.suit || C.suit;
    g.beginPath(); g.moveTo(-13, top + 6); g.quadraticCurveTo(-14, top, -8, top - 1); g.lineTo(8, top - 1);
    g.quadraticCurveTo(14, top, 13, top + 6); g.lineTo(11, top + 36); g.lineTo(-11, top + 36); g.closePath(); g.fill();
    g.fillStyle = "#f4f4f2"; g.beginPath(); g.moveTo(-4, top - 1); g.lineTo(4, top - 1); g.lineTo(0, top + 12); g.closePath(); g.fill();
    g.fillStyle = o.tie || "#2c4a77"; g.beginPath(); g.moveTo(-1.6, top + 1); g.lineTo(1.6, top + 1); g.lineTo(2.4, top + 20); g.lineTo(0, top + 23); g.lineTo(-2.4, top + 20); g.closePath(); g.fill();
    g.fillStyle = o.suit || C.suit;                    // arms
    g.fillRect(-17, top + 3, 5, 24 + step); g.fillRect(12, top + 3, 5, 24 - step);
    g.fillStyle = C.skin; g.beginPath(); g.arc(-14.5, top + 29 + step, 2.8, 0, 7); g.arc(14.5, top + 29 - step, 2.8, 0, 7); g.fill();
    if (o.paper) { g.fillStyle = "#fffdf6"; g.fillRect(9, top + 16, 11, 14); g.fillStyle = C.red; g.fillRect(11, top + 19, 6, 1.5); }
    g.fillStyle = C.skin; g.beginPath(); g.arc(0, top - 10, 9.5, 0, 7); g.fill();   // head
    g.fillStyle = o.hair || C.grey;
    g.beginPath(); g.arc(0, top - 13, 9.8, Math.PI * 1.05, Math.PI * 1.95); g.fill();
    if (o.potus) {                                     // the famous swoop, original vector
      g.beginPath(); g.moveTo(-11, top - 12); g.quadraticCurveTo(-6, top - 27, 9, top - 21);
      g.quadraticCurveTo(15, top - 17, 12, top - 9); g.quadraticCurveTo(6, top - 18, -11, top - 12); g.fill();
    }
    g.fillStyle = "#24323f"; g.fillRect(-4, top - 10, 2, 2); g.fillRect(2, top - 10, 2, 2);
    g.restore();
  }

  function grokNode(x, y, color, t, busy, r = 12) {
    if (busy) {                                        // working halo + orbiting dots
      ctx.strokeStyle = color; ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 6);
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r + 7, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      for (let k = 0; k < 3; k++) {
        const a = t * 2.4 + k * 2.09;
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x + Math.cos(a) * (r + 7), y + Math.sin(a) * (r + 7), 2, 0, 7); ctx.fill();
      }
    }
    ctx.fillStyle = "rgba(20,30,45,.25)"; ctx.beginPath(); ctx.ellipse(x, y + r + 10, r * .8, 3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = C.deep; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = "#e9f2f8"; ctx.lineWidth = 2; ctx.lineCap = "round";
    const k = r * 0.42;
    ctx.beginPath(); ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k); ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k); ctx.stroke();
    ctx.lineCap = "butt";
  }

  // ── static world (prerendered once) ──────────────────────────────────────
  const STATIC_SCALE = RENDER_MODE ? 1.5 : 2;
  const world = document.createElement("canvas");
  world.width = WORLD_W * STATIC_SCALE; world.height = WORLD_H * STATIC_SCALE;

  function paintWorld() {
    const g = world.getContext("2d");
    g.scale(STATIC_SCALE, STATIC_SCALE);
    g.fillStyle = "#13263f"; g.fillRect(0, 0, WORLD_W, WORLD_H);

    rooms.forEach((r, i) => {
      const x0 = roomX0(i), ops = r.key === "ops";
      // floor
      g.fillStyle = ops ? "#2a4060" : "#d8c6a3"; g.fillRect(x0, WALL, ROOM_W, WORLD_H - WALL);
      for (let yy = WALL; yy < WORLD_H; yy += 26) {
        for (let xx = x0 + ((yy / 26) % 2) * 22; xx < x0 + ROOM_W; xx += 44) {
          const v = hash(xx * 0.37 + yy);
          g.fillStyle = ops ? `rgba(120,160,200,${0.05 + v * 0.06})` : `rgba(150,120,80,${0.08 + v * 0.1})`;
          g.fillRect(xx + 1, yy + 1, 42, 24);
        }
      }
      // back wall, windows, columns
      g.fillStyle = ops ? "#1d3350" : "#efe6d2"; g.fillRect(x0, 0, ROOM_W, WALL);
      g.fillStyle = ops ? "#152842" : "#d9cdb2"; g.fillRect(x0, WALL - 8, ROOM_W, 8);
      for (let k = 0; k < 6; k++) {
        const wx = x0 + 40 + k * 112;
        if (ops) { g.fillStyle = "#24405f"; g.fillRect(wx, 14, 80, 18); continue; }
        g.fillStyle = "#a7c7c0"; g.fillRect(wx, 12, 78, 48);
        g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(wx + 4, 16, 30, 40);
        g.strokeStyle = "#8a7a58"; g.lineWidth = 2; g.strokeRect(wx, 12, 78, 48);
        g.fillStyle = r.key === "press" ? "#a83a36" : "#2c4f80";   // curtains
        g.fillRect(wx - 7, 6, 6, 62); g.fillRect(wx + 79, 6, 6, 62);
        g.fillStyle = C.gold; g.fillRect(wx - 9, 4, 98, 3);
      }
      furnish[r.key](g, x0, r.center_x);
    });

    // passages between rooms
    for (let i = 0; i <= rooms.length; i++) {
      const x = roomX0(i) - 40;
      g.fillStyle = "#c8b48c"; g.fillRect(x, 0, 40, WORLD_H);
      g.fillStyle = "#e5dcc6"; g.fillRect(x + 6, 0, 28, WALL);
      g.fillStyle = "#8e7a55"; g.fillRect(x + 4, WALL, 4, WORLD_H); g.fillRect(x + 32, WALL, 4, WORLD_H);
      g.fillStyle = "#d8c6a3"; g.fillRect(x, 230, 40, 120);            // door gap
      g.fillStyle = C.gold; g.fillRect(x + 10, 30, 20, 8);
    }
  }

  function plant(g, x, y, s = 1) {
    g.fillStyle = "rgba(20,30,45,.2)"; g.beginPath(); g.ellipse(x, y + 4, 20 * s, 6 * s, 0, 0, 7); g.fill();
    g.fillStyle = "#7a5634"; g.fillRect(x - 12 * s, y - 18 * s, 24 * s, 22 * s);
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.45;
      g.fillStyle = k % 2 ? "#3e8f5a" : "#2f7a4a";
      g.beginPath(); g.ellipse(x + Math.cos(a) * 18 * s, y - 26 * s + Math.sin(a) * 16 * s, 13 * s, 6 * s, a, 0, 7); g.fill();
    }
  }
  function flag(g, x, y, us) {
    g.fillStyle = "#8e7a55"; g.fillRect(x, y - 70, 3, 80);
    g.fillStyle = C.gold; g.beginPath(); g.arc(x + 1.5, y - 72, 3, 0, 7); g.fill();
    if (us) {
      for (let k = 0; k < 7; k++) { g.fillStyle = k % 2 ? "#fff" : "#c23b36"; g.fillRect(x + 3, y - 66 + k * 5, 40, 5); }
      g.fillStyle = "#24427a"; g.fillRect(x + 3, y - 66, 18, 17);
    } else {
      g.fillStyle = "#1f3f78"; g.fillRect(x + 3, y - 66, 38, 34);
      g.fillStyle = C.gold; g.beginPath(); g.arc(x + 22, y - 49, 7, 0, 7); g.fill();
    }
  }
  function desk(g, x, y, w, h, top = "#b07a45", front = "#7e5330") {
    g.fillStyle = "rgba(20,30,45,.22)"; g.fillRect(x - w / 2 + 6, y + h / 2, w, 10);
    g.fillStyle = front; g.fillRect(x - w / 2, y - h / 2 + 14, w, h);
    g.fillStyle = top; g.fillRect(x - w / 2, y - h / 2, w, h - 4);
    g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 1; g.strokeRect(x - w / 2, y - h / 2, w, h - 4);
  }
  function doc(g, x, y) { g.fillStyle = "#fffdf6"; g.fillRect(x, y, 16, 20); g.fillStyle = "#c9c1b0"; for (let k = 0; k < 4; k++) g.fillRect(x + 3, y + 4 + k * 4, 10, 1.5); }
  function monitor(g, x, y, w, h, hue) {
    g.fillStyle = "#0f1d30"; g.fillRect(x, y, w, h);
    g.strokeStyle = "#3d5a7c"; g.lineWidth = 2; g.strokeRect(x, y, w, h);
    for (let k = 0; k < 9; k++) {
      const bh = (0.25 + hash(x + k * 13) * 0.65) * (h - 14);
      g.fillStyle = hue; g.fillRect(x + 6 + k * (w - 12) / 9, y + h - 6 - bh, (w - 12) / 9 - 3, bh);
    }
  }

  const furnish = {
    oval(g, x0, cx) {
      g.fillStyle = "#2c5c95"; g.beginPath(); g.ellipse(cx, 330, 215, 150, 0, 0, 7); g.fill();
      g.strokeStyle = C.gold; g.lineWidth = 4; g.stroke();
      g.strokeStyle = "rgba(201,164,58,.5)"; g.lineWidth = 1.5; g.beginPath(); g.ellipse(cx, 330, 195, 134, 0, 0, 7); g.stroke();
      g.fillStyle = "#24507f"; g.beginPath(); g.arc(cx, 345, 48, 0, 7); g.fill();
      g.strokeStyle = "rgba(201,164,58,.7)"; g.lineWidth = 2; g.stroke();
      g.font = `600 9px ${MONO}`; g.fillStyle = C.cream; g.textAlign = "center"; g.fillText("E PLURIBUS UNUM", cx, 445); g.textAlign = "left";
      desk(g, cx, 196, 230, 70);
      doc(g, cx - 95, 172); doc(g, cx + 70, 170);
      g.fillStyle = "#5a3d2a"; g.fillRect(cx - 18, 140, 36, 26);       // chair
      flag(g, x0 + 130, 175, true); flag(g, x0 + 560, 175, false);
      plant(g, x0 + 70, 150); plant(g, x0 + 640, 160); plant(g, x0 + 640, 500, 0.9);
      g.fillStyle = "#e6e0cf"; rr2(g, x0 + 40, 410, 120, 56, 10); rr2(g, x0 + 550, 410, 120, 56, 10);   // sofas
      g.fillStyle = "#cfc6b0"; g.fillRect(x0 + 52, 422, 44, 22); g.fillRect(x0 + 104, 422, 44, 22); g.fillRect(x0 + 562, 422, 44, 22); g.fillRect(x0 + 614, 422, 44, 22);
      desk(g, cx, 500, 150, 40, "#9c6b3d", "#6f4a2b");
      g.fillStyle = "#2e6fa3"; g.beginPath(); g.arc(x0 + 570, 290, 22, 0, 7); g.fill();          // globe
      g.fillStyle = "#4e9b5e"; g.beginPath(); g.ellipse(x0 + 565, 286, 9, 12, 0.5, 0, 7); g.fill();
      g.fillStyle = "#8e7a55"; g.fillRect(x0 + 566, 312, 8, 22);
      g.fillStyle = "#6c5a3c"; g.fillRect(x0 + 40, 250, 50, 60); g.fillStyle = "#2b2b2b"; g.fillRect(x0 + 48, 258, 34, 18);  // safe
      g.fillStyle = "#3a4f66"; g.fillRect(cx - 40, 20, 80, 52); g.strokeStyle = C.gold; g.lineWidth = 3; g.strokeRect(cx - 40, 20, 80, 52);   // portrait
    },
    cabinet(g, x0, cx) {
      g.fillStyle = "#24607a"; rr2(g, cx - 270, 160, 540, 230, 18);
      g.strokeStyle = "#7cc3d6"; g.lineWidth = 3; g.strokeRect(cx - 255, 172, 510, 206);
      for (let k = 0; k < 6; k++) person(g, cx - 200 + k * 80, 210, { seated: true, scale: 0.9, hair: k % 2 ? "#b9bcc2" : "#8d8f94" });
      g.fillStyle = "#6a3c22"; rr2(g, cx - 220, 225, 440, 95, 40);
      g.fillStyle = "#8a5232"; rr2(g, cx - 210, 228, 420, 80, 36);
      const depts = ["CHIEF", "STATE", "TREASURY", "DEFENSE", "COMMS", "COUNSEL"];
      depts.forEach((d, k) => { doc(g, cx - 205 + k * 80, 240); g.font = `600 7px ${MONO}`; g.fillStyle = "#f3ead2"; g.fillText(d, cx - 210 + k * 80, 300); });
      g.fillStyle = "#3d4d61"; g.fillRect(cx - 160, 330, 40, 36); g.fillRect(cx + 120, 330, 40, 36);
      desk(g, x0 + 120, 470, 150, 50, "#7a5536", "#5a3e27");
      monitor(g, x0 + 80, 420, 70, 44, "#3fa7c9");
      g.fillStyle = "#6b4a2e"; g.fillRect(x0 + 560, 440, 110, 60);
      for (let k = 0; k < 8; k++) { g.fillStyle = ["#c8443f", "#1f8fb3", "#c9a43a", "#2f7a4a"][k % 4]; g.fillRect(x0 + 566 + k * 12, 416, 9, 26); }
      flag(g, x0 + 90, 170, true); flag(g, x0 + 640, 175, false);
      plant(g, x0 + 640, 520, 0.9); plant(g, x0 + 60, 150);
    },
    press(g, x0, cx) {
      g.fillStyle = "#1d4a8c"; g.fillRect(cx - 240, WALL - 4, 480, 140);
      for (let row = 0; row < 3; row++) for (let k = 0; k < 9; k++) {
        const px = cx - 220 + k * 55, py = WALL + 12 + row * 42;
        g.fillStyle = "#6f93c4"; g.beginPath(); g.moveTo(px, py); g.lineTo(px + 14, py + 10); g.lineTo(px + 28, py); g.lineTo(px + 28, py + 14); g.lineTo(px + 14, py + 24); g.lineTo(px, py + 14); g.closePath(); g.fill();
      }
      g.fillStyle = "#183b6e"; rr2(g, cx - 105, WALL + 26, 210, 60, 8);
      g.strokeStyle = "#9fb7d8"; g.lineWidth = 1.5; g.strokeRect(cx - 105, WALL + 26, 210, 60);
      g.font = `800 19px ${SANS}`; g.fillStyle = "#fff"; g.textAlign = "center"; g.fillText("THE WHITE HOUSE", cx, WALL + 58);
      g.font = `600 8px ${MONO}`; g.fillText("WASHINGTON", cx, WALL + 74); g.textAlign = "left";
      g.fillStyle = "#6b4a2e"; g.fillRect(cx - 40, 205, 80, 60); g.fillStyle = "#86603c"; g.fillRect(cx - 44, 200, 88, 14);
      g.fillStyle = "#d9d4c5"; g.fillRect(cx - 18, 186, 36, 16);
      g.fillStyle = "#1e3a6b"; g.beginPath(); g.arc(cx, 236, 13, 0, 7); g.fill(); g.strokeStyle = C.gold; g.lineWidth = 2; g.stroke();
      flag(g, x0 + 140, 200, true);
      g.fillStyle = "#1f3f78"; g.fillRect(x0 + 560, 140, 44, 60); g.fillStyle = C.gold; g.beginPath(); g.arc(x0 + 582, 170, 12, 0, 7); g.fill();
      [cx - 200, cx + 200].forEach(x => {                                 // tv cameras
        g.strokeStyle = "#222"; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 250); g.lineTo(x - 18, 300); g.moveTo(x, 250); g.lineTo(x + 18, 300); g.moveTo(x, 250); g.lineTo(x, 302); g.stroke();
        g.fillStyle = "#1c2633"; g.fillRect(x - 16, 220, 32, 30); g.fillStyle = "#3b4a5c"; g.beginPath(); g.arc(x, 235, 8, 0, 7); g.fill();
      });
      g.fillStyle = "#24477e"; rr2(g, cx - 270, 375, 540, 180, 14);
      for (let row = 0; row < 3; row++) for (let k = 0; k < 7; k++) {
        const px = cx - 225 + k * 75, py = 400 + row * 52;
        g.fillStyle = "#2f5a99"; g.fillRect(px - 16, py - 10, 32, 30);
        if (hash(row * 9 + k) > 0.25) person(g, px, py + 18, { seated: true, scale: 0.72, suit: "#2b3d55", tie: hash(k) > 0.5 ? "#2f7a4a" : "#8a2f2b", hair: hash(row + k * 3) > 0.5 ? "#8b8f96" : "#5a4a3a" });
      }
      plant(g, x0 + 640, 500, 0.9); plant(g, x0 + 70, 520, 0.8);
      g.fillStyle = "#6b4a2e"; g.fillRect(x0 + 40, 460, 80, 50);
      for (let k = 0; k < 6; k++) { g.fillStyle = ["#c8443f", "#1f8fb3", "#c9a43a"][k % 3]; g.fillRect(x0 + 46 + k * 12, 440, 9, 22); }
    },
    ops(g, x0, cx) {
      g.fillStyle = "#18304d"; g.fillRect(cx - 290, WALL + 4, 580, 120);
      g.strokeStyle = "#3d6a93"; g.lineWidth = 2; g.strokeRect(cx - 290, WALL + 4, 580, 120);
      const hues = ["#3fa7c9", "#2fbf7a", "#d6b13e", "#8a6cc4", "#d0524c"];
      const labels = ["GRID / STATUS", "SUPPLY / ROUTES", "SCHEDULE / UTC", "TEAM / LOAD", "SYSTEM / AUDIT"];
      hues.forEach((h, k) => {
        monitor(g, cx - 275 + k * 112, WALL + 14, 100, 66, h);
        g.font = `600 7px ${MONO}`; g.fillStyle = "#b9cde0"; g.fillText(labels[k], cx - 272 + k * 112, WALL + 96);
      });
      g.font = `600 8px ${MONO}`; g.fillStyle = "#cfe0ee"; g.fillText("INTERNAL OPERATIONS / FICTIONAL DATA", cx - 270, WALL + 116);
      [x0 + 30, x0 + 650].forEach(x => {                                 // server racks
        g.fillStyle = "#101d2e"; g.fillRect(x, 130, 34, 380);
        for (let k = 0; k < 22; k++) { g.fillStyle = hash(x + k) > 0.6 ? "#2fbf7a" : "#3d5a7c"; g.fillRect(x + 6, 140 + k * 17, 22, 3); }
      });
      for (let row = 0; row < 2; row++) for (let k = 0; k < 4; k++) {
        const dx = cx - 225 + k * 150, dy = 215 + row * 200;
        g.fillStyle = "#3b4d63"; g.fillRect(dx - 52, dy, 104, 50);
        g.fillStyle = "#4b5f78"; g.fillRect(dx - 52, dy - 4, 104, 10);
        monitor(g, dx - 40, dy - 40, 58, 38, hues[(k + row) % 5]);
        doc(g, dx + 26, dy - 30);
        person(g, dx, dy + 78, { seated: true, scale: 0.85, hair: hash(k + row * 4) > 0.5 ? "#b9bcc2" : "#7d6a55" });
      }
    },
  };
  function rr2(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill();
  }

  // ── agents: where each one is at time t ──────────────────────────────────
  const HOME = {   // offset from home room centre
    reader: [-175, 190], brief: [150, 270], checker: [-215, 330],
    clerk: [-260, 300], chief: [-110, 132], router: [225, 300],
    press: [-140, 235], verify: [165, 215], scribe: [285, 340],
    ops: [-150, 340], audit: [220, 205], queue: [85, 350],
  };
  const SPOTS = [[-245, 250], [245, 255], [-170, 450], [175, 445]];
  const agents = T.agents.map((a, i) => {
    const home = roomByKey[a.home];
    const hx = home.center_x + HOME[a.key][0], hy = HOME[a.key][1];
    const keys = [[-1, hx, hy]];
    const shifts = a.shifts.map(([s, e, id]) => ({ s, e, id, task: T.tasks.find(t => t.id === id) }));
    shifts.forEach((sh, k) => {
      const roomKey = sh.task ? sh.task.room : rooms[roomIndexAt(sh.s)].key;
      const r = roomByKey[roomKey];
      const [px, py] = roomKey === a.home ? [hx, hy] : [r.center_x + SPOTS[i % 4][0], SPOTS[i % 4][1]];
      const last = keys[keys.length - 1];
      keys.push([Math.max(last[0] + 0.01, sh.s - 1.4), last[1], last[2]], [sh.s, px, py], [sh.e, px, py]);
      const next = shifts[k + 1];
      if (!next || next.s - 1.4 > sh.e + 1.6) keys.push([sh.e + 1.6, hx, hy]);
    });
    return { ...a, index: i, keys, shifts, color: ROLE_COLOR[a.role] };
  });
  function agentPos(a, t) {
    const k = a.keys;
    for (let j = k.length - 1; j >= 0; j--) {
      if (t >= k[j][0]) {
        const n = k[j + 1];
        if (!n) return [k[j][1], k[j][2], false];
        const u = smooth((t - k[j][0]) / (n[0] - k[j][0]));
        return [lerp(k[j][1], n[1], u), lerp(k[j][2], n[2], u), n[1] !== k[j][1] || n[2] !== k[j][2]];
      }
    }
    return [k[0][1], k[0][2], false];
  }
  const busyAt = (a, t) => a.shifts.find(sh => t >= sh.s && t < sh.e);

  const AIDES = {
    oval: ["AIDE / BRIEF", -290, 300, -230, 470],
    cabinet: ["CLERK / TASKS", -230, 430, -110, 490],
    press: ["PRESS / NOTES", -300, 300, -300, 420],
    ops: ["OPS / STATUS", -240, 230, -250, 480],
  };

  // ── the frame ────────────────────────────────────────────────────────────
  function render(t) {
    t = clamp(t, 0, RUN);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const room = rooms[roomIndexAt(t)];
    drawChrome(t, room);
    drawViewport(t, room);
    drawDashboard(t, room);
  }

  function drawChrome(t, room) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1a3a5e"); bg.addColorStop(0.18, "#122b49"); bg.addColorStop(1, "#0d2038");
    ctx.fillStyle = "#081426"; ctx.fillRect(0, 0, W, H);
    box(8, 8, W - 16, H - 16, 10, bg, "#2f5a83", 1.5);
    ctx.fillStyle = C.red; ctx.fillRect(25, 16, 343, 3);
    ctx.fillStyle = "#2f5a83"; ctx.fillRect(368, 16, 344, 3);
    ctx.fillStyle = C.gold; ctx.fillRect(712, 16, 343, 3);

    text("GROK", 26, 52, 14, C.sky, { weight: 700, spacing: 9 });
    text("WHITE HOUSE", 24, 87, 31, C.cream, { weight: 800, font: SANS, spacing: 0.5 });
    text("EXECUTIVE ORCHESTRATION", 27, 110, 9.5, "#d6e2ee", { weight: 600, spacing: 0.6 });
    text("ONE PRESIDENT. TWELVE AGENTS.", 27, 128, 8.5, "#b8c8d8", { spacing: 0.6 });
    whiteHouse(540, 24);
    text("TrumpBot", 820, 66, 25, "#ffffff", { weight: 800, font: SANS });
    text("04 ROOMS / 12 AGENTS", 821, 85, 10.5, C.sky, { weight: 700, spacing: 0.6 });
    text("00 CUTS / CONTINUOUS RUN", 821, 106, 9, "#d6e2ee", { spacing: 0.4 });
    box(820, 119, 95, 22, 3, "#fbf3dc", C.gold, 1.5);
    text("FICTIONAL SATIRE", 867.5, 130.5, 8.5, "#7a5f12", { weight: 700, align: "center", base: "middle" });

    ctx.fillStyle = "#2f5a83"; ctx.fillRect(24, 160, 1032, 1.5); ctx.fillRect(24, 165, 1032, 1);
    text(`NOW / ${room.name.toUpperCase()}`, 25, 186, 10.5, ROOM_COLOR[room.key], { weight: 700, spacing: 0.4 });
    text(`RUN ${fmt(t)} / ${fmt(RUN)}`, 983, 186, 9, "#d6e2ee", { align: "right", spacing: 0.4 });
  }

  function whiteHouse(cx, top) {
    ctx.save(); ctx.translate(cx, top);
    // flag
    ctx.fillStyle = "#c9ccd1"; ctx.fillRect(-1, -14, 2, 20);
    for (let k = 0; k < 5; k++) { ctx.fillStyle = k % 2 ? "#fff" : C.red; ctx.fillRect(1, -14 + k * 2.6, 20, 2.6); }
    ctx.fillStyle = "#24427a"; ctx.fillRect(1, -14, 9, 7.8);
    // body
    ctx.fillStyle = "#e9edf1"; ctx.fillRect(-180, 30, 360, 82);
    ctx.fillStyle = "#cdd3da"; ctx.fillRect(-180, 30, 360, 6); ctx.fillRect(-182, 22, 364, 9);
    for (let k = -170; k <= 170; k += 9) { ctx.fillStyle = "#dfe4e9"; ctx.fillRect(k, 14, 4, 9); }
    ctx.fillStyle = "#cdd3da"; ctx.fillRect(-182, 12, 364, 3);
    // windows
    for (let row = 0; row < 2; row++) for (let k = 0; k < 13; k++) {
      const wx = -165 + k * 26; if (Math.abs(wx + 7) < 52) continue;
      ctx.fillStyle = "#c2c9d1"; ctx.fillRect(wx - 2, 44 + row * 34 - 3, 18, 3);
      ctx.fillStyle = "#2d4f78"; ctx.fillRect(wx, 44 + row * 34, 14, 22);
      ctx.fillStyle = "#e9edf1"; ctx.fillRect(wx + 6, 44 + row * 34, 2, 22); ctx.fillRect(wx, 54 + row * 34, 14, 2);
    }
    // portico
    ctx.fillStyle = "#f4f6f8"; ctx.beginPath(); ctx.moveTo(-60, 26); ctx.lineTo(0, 2); ctx.lineTo(60, 26); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#c2c9d1"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "#dfe4e9"; ctx.beginPath(); ctx.arc(0, 18, 5, 0, 7); ctx.fill();
    ctx.fillStyle = "#f4f6f8"; ctx.fillRect(-60, 26, 120, 8);
    for (let k = 0; k < 6; k++) { ctx.fillStyle = "#ffffff"; ctx.fillRect(-54 + k * 21, 34, 7, 72); ctx.fillStyle = "#d3d9df"; ctx.fillRect(-49 + k * 21, 34, 2, 72); }
    ctx.fillStyle = "#2d4f78"; rr(-9, 72, 18, 34, 8); ctx.fill();
    ctx.fillStyle = "#4a7c5a"; ctx.fillRect(-1, 96, 2, 2); ctx.fillRect(3, 96, 2, 2);
    // steps
    for (let k = 0; k < 5; k++) { ctx.fillStyle = k % 2 ? "#dfe4e9" : "#f1f3f5"; ctx.fillRect(-150 + k * 14, 112 + k * 4, 300 - k * 28, 4); }
    ctx.fillStyle = "#cfd5db"; ctx.fillRect(-90, 132, 180, 3);
    ctx.restore();
  }

  function drawViewport(t, room) {
    const zoom = cameraZoom(t), camX = cameraX(t);
    // frame & posts
    ctx.fillStyle = "#0e2036"; ctx.fillRect(VX, VY, VW, VH);
    ctx.save();
    rr(VX, VY, VW, VH, 2); ctx.clip();
    ctx.translate(VX + VW / 2, VY + VH / 2); ctx.scale(zoom, zoom); ctx.translate(-camX, -WORLD_H / 2);
    ctx.drawImage(world, 0, 0, WORLD_W, WORLD_H);
    drawWorldDynamic(t, room, camX);
    ctx.restore();
    ctx.fillStyle = "#e9e1cc"; ctx.fillRect(VX - 4, VY, 5, VH); ctx.fillRect(VX + VW - 1, VY, 5, VH);
    ctx.fillStyle = "#c9b98f"; ctx.fillRect(VX - 6, VY, 9, 4); ctx.fillRect(VX + VW - 3, VY, 9, 4); ctx.fillRect(VX - 6, VY + VH - 4, 9, 4); ctx.fillRect(VX + VW - 3, VY + VH - 4, 9, 4);

    // screen-space overlays
    tag("CAM 01 / CONTINUOUS FOLLOW", VX + 80, VY + 21, C.cyan, { size: 8 });
    tag("TRACK / PRESIDENT", VX + VW - 116, VY + 21, C.gold, { size: 8, ink: "#7a5f12" });
    box(VX + 8, VY + VH - 24, 196, 18, 3, "rgba(10,22,40,.6)");
    box(VX + VW - 172, VY + VH - 24, 164, 18, 3, "rgba(10,22,40,.6)");
    text("WEST WING / FICTIONAL FLOORPLAN", VX + 16, VY + VH - 12, 7.5, "rgba(230,236,242,.75)", { spacing: 0.4 });
    text(`CAM X ${String(Math.round(camX)).padStart(4, "0")}  ·  ZOOM ${zoom.toFixed(2)}`, VX + VW - 16, VY + VH - 12, 7.5, "rgba(230,236,242,.75)", { align: "right", spacing: 0.4 });
    // recording dot
    if (Math.floor(t * 2) % 2 === 0) { ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(VX + 166, VY + 21, 3, 0, 7); ctx.fill(); }
  }

  function drawWorldDynamic(t, room, camX) {
    // room titles + name tags on the floor
    rooms.forEach((r, i) => {
      const s = `0${i + 1} / ${r.name.toUpperCase()}`;
      ctx.font = `600 13px ${MONO}`;
      const w = ctx.measureText(s).width;
      box(roomX0(i) + 22, WALL + 12, w + 16, 22, 3, r.key === "ops" ? "rgba(14,30,52,.85)" : "rgba(239,230,210,.88)");
      text(s, roomX0(i) + 30, WALL + 28, 13, r.key === "ops" ? "#cfe0ee" : "#5a4e3a", { weight: 600 });
    });
    rooms.forEach((r, i) => tag(r.name.toUpperCase(), roomX0(i) + 75, WORLD_H - 22, ROOM_COLOR[r.key], { size: 9 }));
    for (let i = 1; i < rooms.length; i++) tag("PASSAGE", roomX0(i) - 20, 260, C.red, { size: 7, ink: C.red });

    // drifting document chips
    for (let k = 0; k < 28; k++) {
      const x = 80 + hash(k) * (WORLD_W - 160), y = 200 + hash(k + 50) * 320;
      const dy = Math.sin(t * 1.3 + k) * 4;
      ctx.fillStyle = "rgba(170,225,240,.85)"; ctx.fillRect(x, y + dy, 11, 13);
      ctx.strokeStyle = "rgba(31,143,179,.6)"; ctx.lineWidth = 1; ctx.strokeRect(x, y + dy, 11, 13);
    }

    // aides walking their beat
    rooms.forEach((r, i) => {
      const [label, ax, ay, bx, by] = AIDES[r.key];
      const u = (Math.sin(t * 0.55 + i * 1.7) + 1) / 2;
      const x = r.center_x + lerp(ax, bx, u), y = lerp(ay, by, u);
      person(ctx, x, y, { paper: true, walk: t * 8 + i, scale: 0.95 });
      tag(label, x + 10, y + 16, i === 2 ? C.red : C.cyan, { size: 7 });
    });

    // president (always at the camera centre: the camera follows him)
    const px = camX, py = 345;
    const walking = room.index > 0 && t > room.start && t < room.start + WALK;
    const potusLine = T.events.find(e => e.agent === "potus" && e.room === room.key);

    // director ↔ busy agents links
    const dirX = px - 78 + Math.sin(t * 1.4) * 6, dirY = py - 120 + Math.cos(t * 1.1) * 5;
    agents.forEach(a => {
      const sh = busyAt(a, t); if (!sh) return;
      const [ax, ay] = agentPos(a, t);
      ctx.strokeStyle = a.color; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.3; ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -t * 20;
      ctx.beginPath(); ctx.moveTo(dirX, dirY); ctx.quadraticCurveTo((dirX + ax) / 2, Math.min(dirY, ay) - 50, ax, ay); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      const u = ((t - sh.s) * 0.8) % 1, qx = (dirX + ax) / 2, qy = Math.min(dirY, ay) - 50;
      const bx = (1 - u) * (1 - u) * dirX + 2 * (1 - u) * u * qx + u * u * ax, by = (1 - u) * (1 - u) * dirY + 2 * (1 - u) * u * qy + u * u * ay;
      ctx.fillStyle = a.color; ctx.beginPath(); ctx.arc(bx, by, 3, 0, 7); ctx.fill();
    });

    // selection ring + president
    ctx.strokeStyle = ROOM_COLOR[room.key]; ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 3);
    ctx.beginPath(); ctx.ellipse(px, py + 2, 36, 11, 0, 0, 7); ctx.stroke();
    ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.ellipse(px, py + 2, 50, 16, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    person(ctx, px, py + Math.sin(t * 2.2) * (walking ? 0 : 0.8), {
      potus: true, scale: 1.45, hair: C.hair, tie: "#c8312c", suit: "#1f3558",
      walk: walking ? t * 9 : 0, paper: room.key === "oval",
    });
    tag("TRUMP / POTUS", px, py + 30, C.gold, { size: 9, ink: "#7a5f12" });

    // speech bubble, typed in after arrival
    if (potusLine && t >= potusLine.t) {
      const s = potusLine.text.toUpperCase(), n = Math.min(s.length, Math.floor((t - potusLine.t) * 28) + 1);
      ctx.font = `600 9.5px ${MONO}`;
      const w = ctx.measureText(s).width + 22, bx = px + 26, by = py - 150;
      box(bx, by, w, 28, 6, "#fbf6e6", "rgba(0,0,0,.12)");
      ctx.fillStyle = "#fbf6e6"; ctx.beginPath(); ctx.moveTo(bx + 10, by + 27); ctx.lineTo(bx + 4, by + 38); ctx.lineTo(bx + 22, by + 27); ctx.fill();
      text(s.slice(0, n), bx + 11, by + 15, 9.5, C.ink, { weight: 600, base: "middle" });
    }

    // agents
    agents.forEach(a => {
      const [x, y, moving] = agentPos(a, t);
      const sh = busyAt(a, t);
      const bob = Math.sin(t * 2 + a.index) * 2;
      grokNode(x, y + bob, a.color, t, !!sh, 11);
      tag(a.key.toUpperCase(), x, y - 26 + bob, a.color, { size: 7 });
      if (moving) { ctx.fillStyle = a.color; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(x, y + 22, 5, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      // done / held pops
      a.shifts.forEach(s => {
        if (!s.task || t < s.e || t > s.e + 1.6) return;
        const u = (t - s.e) / 1.6, held = s.task.status === "held";
        ctx.globalAlpha = 1 - u * u;
        tag(held ? `HOLD → POTUS #${String(s.id).padStart(2, "0")}` : `✓ DONE #${String(s.id).padStart(2, "0")}`,
          x, y - 46 - u * 26, held ? C.amber : C.green, { size: 8, fill: held ? "#fff5dc" : "#e6f7ef" });
        ctx.globalAlpha = 1;
        if (held) {                                         // paper flies to the president
          const fx = lerp(x, px + 18, smooth(u)), fy = lerp(y, py - 60, smooth(u)) - Math.sin(u * Math.PI) * 50;
          ctx.fillStyle = "#fff8e3"; ctx.fillRect(fx - 6, fy - 8, 12, 15); ctx.strokeStyle = C.amber; ctx.strokeRect(fx - 6, fy - 8, 12, 15);
        }
      });
    });

    // grok director floats over the president's shoulder
    grokNode(dirX, dirY, C.sky, t, true, 15);
    tag("GROK / DIRECTOR", dirX, dirY - 30, C.cyan, { size: 8 });

    // room overlays
    if (room.key === "cabinet" || t > 12) {
      const cx = roomByKey.cabinet.center_x;
      box(cx - 125, 420, 250, 58, 4, "rgba(28,52,82,.92)");
      text("CABINET / TASK ALLOCATION", cx - 112, 438, 8.5, "#f3ead2", { weight: 700 });
      text("BRIEF → REVIEW → DELIVERY", cx - 112, 452, 7, "#c4d4e2");
      text("6 DEPARTMENTS / 12 AGENTS", cx - 112, 463, 7, "#c4d4e2");
      text("CONFLICT CHECK / ACTIVE", cx - 112, 474, 7, "#c4d4e2");
    }
    tag("LIVE / ROOM STATUS", roomByKey.ops.center_x + 15, 480, C.cyan, { size: 7 });
  }

  // ── dashboard ────────────────────────────────────────────────────────────
  const tasksIn = key => T.tasks.filter(x => x.room === key);
  function card(x, y, w, h, title, color, active) {
    box(x, y, w, h, 4, C.paper, active ? color : C.paperEdge, active ? 1.5 : 1);
    ctx.fillStyle = color; ctx.fillRect(x + 1, y + 10, 3, 14);
    if (title) text(title, x + 14, y + 22, 10.5, color, { weight: 700, spacing: 0.3 });
  }

  const tabRects = [];
  function drawDashboard(t, room) {
    const done = T.tasks.filter(x => x.status === "done" && x.t_end <= t).length;
    const held = T.tasks.filter(x => x.status === "held" && x.t_end <= t).length;

    card(24, 714, 336, 58, "SUBJECT / DONALD TRUMP", C.gold);
    text(room.name.toUpperCase(), 38, 760, 13, ROOM_COLOR[room.key], { weight: 700 });
    card(372, 714, 336, 58, "DIRECTOR / 12 GROK AGENTS", C.cyan);
    text("READER · CHECKER · ROUTER · SCRIBE", 386, 758, 9, C.mute, { spacing: 0.3 });
    card(720, 714, 336, 58, "RUN / TASK OWNERSHIP", C.red);
    text(`${T.tasks.length} tasks / ${done} done / ${held} held`, 734, 759, 13, C.ink, { weight: 700 });

    tabRects.length = 0;
    rooms.forEach((r, i) => {
      const x = 24 + i * 261, active = r.index === room.index, col = ROOM_COLOR[r.key];
      box(x, 783, 250, 30, 3, active ? "#1d3555" : "#e9e7e1", active ? col : "#cfccc4", active ? 1.5 : 1);
      ctx.fillStyle = r.index <= room.index ? col : "#c4c1b9"; ctx.beginPath(); ctx.arc(x + 14, 798, 3.5, 0, 7); ctx.fill();
      text(`0${i + 1} / ${r.key === "ops" ? "OPERATIONS" : r.key === "press" ? "PRESS BRIEFING" : r.key === "oval" ? "OVAL OFFICE" : "CABINET"}`,
        x + 26, 802, 9.5, active ? col : C.mute, { weight: 600, spacing: 0.3 });
      if (active) { ctx.fillStyle = col; ctx.fillRect(x + 232, 795, 6, 6); }
      tabRects.push([x, 783, 250, 30, r.start + 0.01]);
    });

    const P = [[24, 827], [285, 827], [546, 827], [807, 827], [24, 938], [285, 938], [546, 938], [807, 938]];
    const PW = 250, PH = 102;

    // 01 agent bus
    card(...P[0], PW, PH, "01 / AGENT BUS", C.cyan);
    const seen = T.events.filter(e => e.t <= t && e.agent !== "potus").slice(-4);
    seen.forEach((e, k) => {
      const last = k === seen.length - 1;
      text(e.line, P[0][0] + 14, P[0][1] + 42 + k * 15, 7.5, last ? C.cyan : "#3b4756", { weight: last ? 700 : 400, max: PW - 26 });
    });

    // 02 department graph
    card(...P[1], PW, PH, "02 / DEPARTMENT GRAPH", C.purple);
    const gx = P[1][0] + 125, gy = P[1][1] + 60;
    // 12 agents on an ellipse, grouped by department pairs around the hub
    const all = agents.map((a, k) => { const ang = -Math.PI / 2 + (k + 0.5) * Math.PI * 2 / 12; return [gx + Math.cos(ang) * 100, gy - 2 + Math.sin(ang) * 24]; });
    ctx.strokeStyle = "rgba(31,143,179,.18)"; ctx.lineWidth = 1;
    ctx.beginPath(); all.forEach(([nx, ny], k) => k ? ctx.lineTo(nx, ny) : ctx.moveTo(nx, ny)); ctx.closePath(); ctx.stroke();
    all.forEach(([nx, ny], k) => {
      const a = agents[k], hot = a && busyAt(a, t);
      ctx.strokeStyle = hot ? a.color : "rgba(31,143,179,.35)"; ctx.lineWidth = hot ? 1.5 : 0.8;
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(nx, ny); ctx.stroke();
      if (hot) { const u = (t * 1.2 + k * 0.2) % 1; ctx.fillStyle = a.color; ctx.beginPath(); ctx.arc(lerp(gx, nx, u), lerp(gy, ny, u), 2.2, 0, 7); ctx.fill(); }
    });
    all.forEach(([nx, ny], k) => { const a = agents[k]; ctx.fillStyle = busyAt(a, t) ? C.red : "#2d7fa8"; ctx.beginPath(); ctx.arc(nx, ny, 3.2, 0, 7); ctx.fill(); });
    ctx.fillStyle = "#e7eef4"; ctx.beginPath(); ctx.arc(gx, gy, 13, 0, 7); ctx.fill();
    text("GROK", gx, gy + 1, 7.5, "#2d5f86", { weight: 700, align: "center", base: "middle" });
    text("6 departments / 12 specialized agents", P[1][0] + 14, P[1][1] + 94, 7, C.mute);

    // 03 source pipeline
    card(...P[2], PW, PH, "03 / SOURCE PIPELINE", C.gold);
    rooms.forEach((r, k) => {
      const list = tasksIn(r.key), prog = list.filter(x => x.t_end <= t).length / list.length;
      const y = P[2][1] + 41 + k * 16, active = r.index === room.index;
      text(r.source, P[2][0] + 14, y, 7.5, active ? (r.key === "oval" ? "#a8861f" : ROOM_COLOR[r.key]) : "#3b4756", { weight: active ? 700 : 400, max: PW - 28 });
      ctx.fillStyle = "#e1ddd3"; ctx.fillRect(P[2][0] + 14, y + 4, PW - 28, 2);
      ctx.fillStyle = C.cyan; ctx.fillRect(P[2][0] + 14, y + 4, (PW - 28) * prog, 2);
    });

    // 04 task checks: 18 columns × 4 checks
    card(...P[3], PW, PH, "04 / TASK CHECKS", C.green);
    T.tasks.forEach((task, k) => {
      for (let row = 0; row < 4; row++) {
        const at = [task.t_start, task.t_start + 0.4, task.t_end, task.t_end + 0.5][row];
        const on = t >= at;
        let col = "#e3e0d8";
        if (on) col = task.status === "held" && row >= 2 ? C.amber : C.green;
        else if (t >= task.t_start && row === 2) col = "#9fd8c3";
        ctx.fillStyle = col; ctx.fillRect(P[3][0] + 14 + k * 12.4, P[3][1] + 36 + row * 11, 9, 7);
      }
    });
    text("OWNERS · SOURCES · STATUS · HANDOFF", P[3][0] + 14, P[3][1] + 94, 7, C.mute);

    // 05 director queue
    card(...P[4], PW, PH, "05 / DIRECTOR QUEUE", C.red);
    tasksIn(room.key).slice(0, 3).forEach((task, k) => {
      const fin = task.t_end <= t, run = t >= task.t_start && !fin;
      const label = `${task.kind.toUpperCase()} / ${task.title}`;
      text(label, P[4][0] + 14, P[4][1] + 42 + k * 15, 7.5, fin ? "#9aa3ad" : run ? C.ink : "#3b4756", { weight: run ? 700 : 400, max: PW - 40 });
      if (fin) text(task.status === "held" ? "◆" : "✓", P[4][0] + PW - 18, P[4][1] + 42 + k * 15, 8, task.status === "held" ? C.amber : C.green, { weight: 700 });
    });
    text(`OWNER / ${room.owner} agent`, P[4][0] + 14, P[4][1] + 87, 7.5, C.red, { weight: 600 });

    // 06 system streams
    card(...P[5], PW, PH, "06 / SYSTEM STREAMS", C.cyan);
    [[C.cyan, 0, 1.0], [C.red, 1.7, 1.3], [C.gold, 3.1, 0.8]].forEach(([col, ph, f], k) => {
      ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.beginPath();
      for (let x = 0; x <= PW - 28; x += 3) {
        const y = P[5][1] + 52 + k * 7 + Math.sin(x * 0.045 * f + t * 2.2 + ph) * 6;
        x ? ctx.lineTo(P[5][0] + 14 + x, y) : ctx.moveTo(P[5][0] + 14 + x, y);
      }
      ctx.stroke();
    });
    text("SOURCE MATCH / LOAD / LATENCY", P[5][0] + 14, P[5][1] + 94, 7, C.mute);

    // 07 handoff ledger
    card(...P[6], PW, PH, "07 / HANDOFF LEDGER", C.purple);
    const links = T.tasks.filter(x => x.t_start <= t).reduce((s, x) => s + x.sources, 0);
    [["ROOMS VISITED", room.index + 1], ["SOURCE LINKS", links], ["PENDING DECISIONS", held]].forEach(([k, v], i) => {
      text(k, P[6][0] + 14, P[6][1] + 42 + i * 15, 7.5, "#3b4756");
      text(String(v), P[6][0] + 150, P[6][1] + 42 + i * 15, 7.5, C.ink, { align: "right", weight: 600 });
    });
    text("RUN LOG / RECORDING", P[6][0] + 14, P[6][1] + 87, 7.5, C.purple, { weight: 600 });
    if (Math.floor(t * 2) % 2 === 0) { ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(P[6][0] + 120, P[6][1] + 84, 2.5, 0, 7); ctx.fill(); }

    // 08 camera / track
    card(...P[7], PW, PH, "08 / CAMERA / TRACK", C.gold);
    text("CONTINUOUS FOLLOW", P[7][0] + 14, P[7][1] + 47, 12, C.ink, { weight: 800, font: SANS });
    text("0 cuts / 4 connected rooms", P[7][0] + 14, P[7][1] + 62, 7.5, C.cyan, { weight: 600 });
    text("TRACK / President Trump", P[7][0] + 14, P[7][1] + 77, 7.5, "#3b4756");
    text("FICTIONAL FLOORPLAN / SATIRE", P[7][0] + 14, P[7][1] + 91, 7, "#a8861f", { weight: 600 });

    // footer: dashed progress line
    const prog = t / RUN;
    for (let x = 24; x < 1056; x += 7) { ctx.fillStyle = (x - 24) / 1032 <= prog ? C.gold : "#5b7896"; ctx.fillRect(x, 1048, 4, 1.5); }
    text("ORIGINAL FICTIONAL PARODY / NOT AN OFFICIAL WHITE HOUSE SYSTEM", 25, 1065, 7, "#d6e2ee", { weight: 600, spacing: 0.3 });
    text("CONTINUOUS CAMERA · 4 ROOMS", 1055, 1065, 7, C.sky, { weight: 600, align: "right", spacing: 0.3 });
  }

  // ── boot ─────────────────────────────────────────────────────────────────
  function boot() {
    paintWorld();
    window.render = render;
    window.ready = true;
    if (RENDER_MODE) { document.body.classList.add("render"); render(0); return; }

    let offset = 0, paused = false, pausedAt = 0;
    const now = () => performance.now() / 1000;
    let t0 = now();
    const clock = () => paused ? pausedAt : ((now() - t0) + offset) % RUN;
    const seek = s => { offset = ((s % RUN) + RUN) % RUN; t0 = now(); if (paused) pausedAt = offset; };
    (function loop() { render(clock()); requestAnimationFrame(loop); })();

    addEventListener("keydown", e => {
      if (e.code === "Space") { e.preventDefault(); if (paused) { paused = false; seek(pausedAt); } else { pausedAt = clock(); paused = true; } }
      if (e.key === "ArrowRight") seek(clock() + 1);
      if (e.key === "ArrowLeft") seek(clock() - 1);
      if (/^[1-4]$/.test(e.key)) seek((+e.key - 1) * ROOM_S + 0.01);
    });
    canvas.addEventListener("click", e => {
      const b = canvas.getBoundingClientRect(), x = (e.clientX - b.left) * W / b.width, y = (e.clientY - b.top) * H / b.height;
      const hit = tabRects.find(([rx, ry, rw, rh]) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh);
      if (hit) seek(hit[4]);
    });
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(boot);
})();

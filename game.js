(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("scoreboard");
  const messageEl = document.getElementById("message");
  const restartBtn = document.getElementById("restart");
  const kickBtn = document.getElementById("kick");
  const joystick = document.getElementById("joystick");
  const stick = document.getElementById("stick");

  const W = canvas.width;
  const H = canvas.height;
  const WALL = 34;
  const TARGET_SPAN = 470;
  const FORBIDDEN_DEPTH = 120;
  const MATCH_SECONDS = 90;

  const teams = [
    { name: "RED",    color: "#ff4e5c", side: "top",    score: 0 },
    { name: "BLUE",   color: "#35a7ff", side: "right",  score: 0 },
    { name: "GREEN",  color: "#40d17a", side: "bottom", score: 0 },
    { name: "YELLOW", color: "#ffd34e", side: "left",   score: 0 }
  ];

  const keys = new Set();
  const joy = { x: 0, y: 0, active: false, pointerId: null };
  let players = [];
  let ball;
  let startedAt = performance.now();
  let gameOver = false;
  let lastFrame = performance.now();
  let messageTimer = 0;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const len = (x, y) => Math.hypot(x, y) || 1;

  function makePlayer(team, x, y, human = false) {
    return {
      team, x, y, vx: 0, vy: 0, r: 24,
      human, speed: human ? 260 : 215,
      kickCooldown: 0,
      faceX: 0, faceY: -1
    };
  }

  function reset() {
    teams.forEach(t => t.score = 0);
    players = [
      makePlayer(0, W * .5, H * .72, true),
      makePlayer(1, W * .72, H * .5),
      makePlayer(2, W * .5, H * .28),
      makePlayer(3, W * .28, H * .5)
    ];
    ball = {
      x: W / 2, y: H / 2,
      vx: 90, vy: -35,
      r: 15,
      lastTouch: null,
      lastScoreAt: -9999
    };
    startedAt = performance.now();
    gameOver = false;
    updateScoreboard();
  }

  function updateScoreboard() {
    scoreEl.innerHTML = teams.map((t, i) => `
      <div class="score" style="--team:${t.color}">
        <small>${i === 0 ? "YOU / " : ""}${t.name}</small>
        <strong>${t.score}</strong>
      </div>
    `).join("");
  }

  function showMessage(text, ms = 750) {
    messageEl.textContent = text;
    messageEl.classList.add("show");
    messageTimer = ms;
  }

  function targetValue(offset) {
    const n = Math.abs(offset) / (TARGET_SPAN / 2);
    if (n <= .12) return 20;
    if (n <= .28) return 10;
    if (n <= .48) return 5;
    return 1;
  }

  function scoreHit(targetTeam, offset, now) {
    if (now - ball.lastScoreAt < 450 || ball.lastTouch == null) return;
    ball.lastScoreAt = now;

    const points = targetValue(offset);
    const attacker = ball.lastTouch;
    const penalty = Math.max(1, Math.ceil(points / 4));

    if (attacker === targetTeam) {
      teams[targetTeam].score = Math.max(0, teams[targetTeam].score - penalty);
      showMessage(`OWN TARGET  −${penalty}`);
    } else {
      teams[attacker].score += points;
      teams[targetTeam].score = Math.max(0, teams[targetTeam].score - penalty);
      showMessage(`${teams[attacker].name} +${points} / ${teams[targetTeam].name} −${penalty}`);
    }
    updateScoreboard();
  }

  function isInsideForbidden(x, y, side, margin = 0) {
    const half = TARGET_SPAN / 2 + 45;
    if (side === "top") {
      return y < WALL + FORBIDDEN_DEPTH + margin && Math.abs(x - W/2) < half + margin;
    }
    if (side === "bottom") {
      return y > H - WALL - FORBIDDEN_DEPTH - margin && Math.abs(x - W/2) < half + margin;
    }
    if (side === "left") {
      return x < WALL + FORBIDDEN_DEPTH + margin && Math.abs(y - H/2) < half + margin;
    }
    return x > W - WALL - FORBIDDEN_DEPTH - margin && Math.abs(y - H/2) < half + margin;
  }

  function keepPlayerLegal(p) {
    p.x = clamp(p.x, WALL + p.r, W - WALL - p.r);
    p.y = clamp(p.y, WALL + p.r, H - WALL - p.r);

    for (const t of teams) {
      if (!isInsideForbidden(p.x, p.y, t.side, p.r)) continue;
      if (t.side === "top") p.y = WALL + FORBIDDEN_DEPTH + p.r;
      if (t.side === "bottom") p.y = H - WALL - FORBIDDEN_DEPTH - p.r;
      if (t.side === "left") p.x = WALL + FORBIDDEN_DEPTH + p.r;
      if (t.side === "right") p.x = W - WALL - FORBIDDEN_DEPTH - p.r;
    }
  }

  function kick(p, strength = 600) {
    if (p.kickCooldown > 0 || gameOver) return;
    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > p.r + ball.r + 35) return;

    const nx = d > 1 ? dx / d : p.faceX;
    const ny = d > 1 ? dy / d : p.faceY;
    ball.vx += nx * strength + p.vx * .35;
    ball.vy += ny * strength + p.vy * .35;
    ball.lastTouch = p.team;
    p.kickCooldown = .32;
  }

  function humanInput(p, dt) {
    let x = joy.x;
    let y = joy.y;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) x -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) x += 1;
    if (keys.has("ArrowUp") || keys.has("KeyW")) y -= 1;
    if (keys.has("ArrowDown") || keys.has("KeyS")) y += 1;

    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    p.vx = x * p.speed;
    p.vy = y * p.speed;
    if (m > .08) { p.faceX = x; p.faceY = y; }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    keepPlayerLegal(p);

    if (keys.has("Space")) kick(p);
  }

  function targetPointFor(team) {
    const side = teams[team].side;
    if (side === "top") return { x: W/2, y: WALL };
    if (side === "right") return { x: W-WALL, y: H/2 };
    if (side === "bottom") return { x: W/2, y: H-WALL };
    return { x: WALL, y: H/2 };
  }

  function aiInput(p, dt) {
    // Top scorer is attacked slightly more often; otherwise avoid own target.
    let targetTeam = 0;
    let best = -Infinity;
    for (let i = 0; i < teams.length; i++) {
      if (i === p.team) continue;
      const desire = teams[i].score + Math.random() * 8;
      if (desire > best) { best = desire; targetTeam = i; }
    }

    const toBallX = ball.x - p.x;
    const toBallY = ball.y - p.y;
    const ballDist = Math.hypot(toBallX, toBallY);
    const own = targetPointFor(p.team);
    const threat = Math.hypot(ball.x - own.x, ball.y - own.y) < 260;

    let tx = ball.x;
    let ty = ball.y;
    if (!threat && ballDist > 330) {
      // Stay between the ball and own target until the ball is worth chasing.
      tx = own.x + (ball.x - own.x) * .42;
      ty = own.y + (ball.y - own.y) * .42;
    }

    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = len(dx, dy);
    p.vx = dx / d * p.speed;
    p.vy = dy / d * p.speed;
    p.faceX = p.vx / p.speed;
    p.faceY = p.vy / p.speed;

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    keepPlayerLegal(p);

    if (ballDist < p.r + ball.r + 40) {
      const aim = targetPointFor(targetTeam);
      const ax = aim.x - ball.x;
      const ay = aim.y - ball.y;
      const ad = len(ax, ay);
      // Reposition the facing direction toward the chosen target before kicking.
      p.faceX = ax / ad;
      p.faceY = ay / ad;
      const originalX = ball.x;
      const originalY = ball.y;
      const desiredX = p.x + p.faceX * (p.r + ball.r + 5);
      const desiredY = p.y + p.faceY * (p.r + ball.r + 5);
      if (Math.hypot(ball.x - desiredX, ball.y - desiredY) < 65) {
        const dx2 = ball.x - p.x;
        const dy2 = ball.y - p.y;
        const dd = len(dx2, dy2);
        ball.vx += (ax/ad * 610) + (dx2/dd * 90);
        ball.vy += (ay/ad * 610) + (dy2/dd * 90);
        ball.lastTouch = p.team;
        p.kickCooldown = .48;
      }
    }
  }

  function resolvePlayerBall(p) {
    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const d = Math.hypot(dx, dy);
    const minD = p.r + ball.r;
    if (d <= 0 || d >= minD) return;

    const nx = dx / d;
    const ny = dy / d;
    const push = minD - d;
    ball.x += nx * push;
    ball.y += ny * push;
    ball.vx += nx * 75 + p.vx * .08;
    ball.vy += ny * 75 + p.vy * .08;
    ball.lastTouch = p.team;
  }

  function updateBall(dt, now) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    const drag = Math.pow(.985, dt * 60);
    ball.vx *= drag;
    ball.vy *= drag;

    const maxSpeed = 980;
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > maxSpeed) {
      ball.vx = ball.vx / speed * maxSpeed;
      ball.vy = ball.vy / speed * maxSpeed;
    }

    // Target walls score and bounce. Other wall sections only bounce.
    if (ball.y - ball.r < WALL) {
      const offset = ball.x - W/2;
      if (Math.abs(offset) <= TARGET_SPAN/2) scoreHit(0, offset, now);
      ball.y = WALL + ball.r;
      ball.vy = Math.abs(ball.vy) * .88;
    }
    if (ball.x + ball.r > W - WALL) {
      const offset = ball.y - H/2;
      if (Math.abs(offset) <= TARGET_SPAN/2) scoreHit(1, offset, now);
      ball.x = W - WALL - ball.r;
      ball.vx = -Math.abs(ball.vx) * .88;
    }
    if (ball.y + ball.r > H - WALL) {
      const offset = ball.x - W/2;
      if (Math.abs(offset) <= TARGET_SPAN/2) scoreHit(2, offset, now);
      ball.y = H - WALL - ball.r;
      ball.vy = -Math.abs(ball.vy) * .88;
    }
    if (ball.x - ball.r < WALL) {
      const offset = ball.y - H/2;
      if (Math.abs(offset) <= TARGET_SPAN/2) scoreHit(3, offset, now);
      ball.x = WALL + ball.r;
      ball.vx = Math.abs(ball.vx) * .88;
    }
  }

  function drawTarget(side, team) {
    const center = W / 2;
    const start = center - TARGET_SPAN / 2;
    const zones = [
      { frac: 1.00, color: "#f7f7f2", label: "1" },
      { frac: .48, color: "#ffe44f", label: "5" },
      { frac: .28, color: "#48df83", label: "10" },
      { frac: .12, color: "#ad64ff", label: "20" }
    ];

    const drawBand = (length, color) => {
      ctx.fillStyle = color;
      if (side === "top") ctx.fillRect(center-length/2, 0, length, WALL);
      if (side === "bottom") ctx.fillRect(center-length/2, H-WALL, length, WALL);
      if (side === "left") ctx.fillRect(0, center-length/2, WALL, length);
      if (side === "right") ctx.fillRect(W-WALL, center-length/2, WALL, length);
    };

    drawBand(TARGET_SPAN, "#f7f7f2");
    zones.slice(1).forEach(z => drawBand(TARGET_SPAN * z.frac * 2, z.color));

    ctx.save();
    ctx.fillStyle = teams[team].color;
    ctx.globalAlpha = .35;
    if (side === "top") ctx.fillRect(start, WALL, TARGET_SPAN, FORBIDDEN_DEPTH);
    if (side === "bottom") ctx.fillRect(start, H-WALL-FORBIDDEN_DEPTH, TARGET_SPAN, FORBIDDEN_DEPTH);
    if (side === "left") ctx.fillRect(WALL, start, FORBIDDEN_DEPTH, TARGET_SPAN);
    if (side === "right") ctx.fillRect(W-WALL-FORBIDDEN_DEPTH, start, FORBIDDEN_DEPTH, TARGET_SPAN);
    ctx.restore();

    ctx.strokeStyle = teams[team].color;
    ctx.lineWidth = 5;
    ctx.setLineDash([14, 10]);
    if (side === "top") ctx.strokeRect(start, WALL, TARGET_SPAN, FORBIDDEN_DEPTH);
    if (side === "bottom") ctx.strokeRect(start, H-WALL-FORBIDDEN_DEPTH, TARGET_SPAN, FORBIDDEN_DEPTH);
    if (side === "left") ctx.strokeRect(WALL, start, FORBIDDEN_DEPTH, TARGET_SPAN);
    if (side === "right") ctx.strokeRect(W-WALL-FORBIDDEN_DEPTH, start, FORBIDDEN_DEPTH, TARGET_SPAN);
    ctx.setLineDash([]);
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#187746";
    ctx.fillRect(0, 0, W, H);

    // Turf pattern
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,.025)" : "rgba(0,0,0,.025)";
      ctx.fillRect(i * W/10, 0, W/10, H);
    }

    ctx.strokeStyle = "rgba(255,255,255,.72)";
    ctx.lineWidth = 5;
    ctx.strokeRect(WALL, WALL, W-WALL*2, H-WALL*2);
    ctx.beginPath();
    ctx.moveTo(W/2, WALL); ctx.lineTo(W/2, H-WALL);
    ctx.moveTo(WALL, H/2); ctx.lineTo(W-WALL, H/2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W/2, H/2, 90, 0, Math.PI*2);
    ctx.stroke();

    drawTarget("top", 0);
    drawTarget("right", 1);
    drawTarget("bottom", 2);
    drawTarget("left", 3);

    for (const p of players) {
      ctx.beginPath();
      ctx.fillStyle = teams[p.team].color;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = p.human ? 6 : 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.faceX * 34, p.y + p.faceY * 34);
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 5;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.fillStyle = "#f4f4f4";
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = "#1b1d22";
    ctx.lineWidth = 4;
    ctx.stroke();

    const elapsed = (now - startedAt) / 1000;
    const remaining = Math.max(0, MATCH_SECONDS - elapsed);
    ctx.fillStyle = "rgba(10,12,16,.70)";
    ctx.fillRect(W/2 - 74, H/2 - 28, 148, 56);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 34px system-ui";
    ctx.fillText(String(Math.ceil(remaining)), W/2, H/2);

    if (remaining <= 0 && !gameOver) {
      gameOver = true;
      const top = Math.max(...teams.map(t => t.score));
      const winners = teams.filter(t => t.score === top).map(t => t.name).join(" & ");
      showMessage(`${winners} WINS!`, 999999);
    }
  }

  function frame(now) {
    const dt = Math.min(.033, (now - lastFrame) / 1000);
    lastFrame = now;

    if (!gameOver) {
      for (const p of players) {
        p.kickCooldown = Math.max(0, p.kickCooldown - dt);
        p.human ? humanInput(p, dt) : aiInput(p, dt);
        resolvePlayerBall(p);
      }
      updateBall(dt, now);
    }

    if (messageTimer > 0 && messageTimer < 999999) {
      messageTimer -= dt * 1000;
      if (messageTimer <= 0) messageEl.classList.remove("show");
    }

    draw(now);
    requestAnimationFrame(frame);
  }

  function updateJoystick(clientX, clientY) {
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const max = rect.width * .30;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    joy.x = dx / max;
    joy.y = dy / max;
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  joystick.addEventListener("pointerdown", e => {
    joy.active = true;
    joy.pointerId = e.pointerId;
    joystick.setPointerCapture(e.pointerId);
    updateJoystick(e.clientX, e.clientY);
  });
  joystick.addEventListener("pointermove", e => {
    if (joy.active && e.pointerId === joy.pointerId) updateJoystick(e.clientX, e.clientY);
  });
  const releaseJoy = e => {
    if (e.pointerId !== joy.pointerId) return;
    joy.active = false;
    joy.pointerId = null;
    joy.x = joy.y = 0;
    stick.style.transform = "translate(0, 0)";
  };
  joystick.addEventListener("pointerup", releaseJoy);
  joystick.addEventListener("pointercancel", releaseJoy);

  kickBtn.addEventListener("pointerdown", e => {
    e.preventDefault();
    kick(players[0]);
  });

  window.addEventListener("keydown", e => {
    keys.add(e.code);
    if (["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault();
  });
  window.addEventListener("keyup", e => keys.delete(e.code));
  restartBtn.addEventListener("click", reset);

  reset();
  requestAnimationFrame(frame);
})();

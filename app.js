(() => {
  const loader = document.getElementById("goldenLoader");
  const body = document.body;
  const ticket = document.getElementById("ticketStage");
  const trailCanvas = document.getElementById("cutTrail");
  const instruction = document.getElementById("cutInstruction");

  if (!loader || !ticket || !trailCanvas) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const ctx = trailCanvas.getContext("2d", { alpha: true });

  const timers = new Set();
  const trail = [];

  let finished = false;
  let ready = false;
  let dragging = false;
  let cutComplete = false;
  let activePointerId = null;
  let startX = 0;
  let direction = 1;
  let ticketRect = null;
  let cutCenterY = 0;
  let cutBand = 0;
  let trailFrame = 0;
  let lastTrailPoint = null;

  const later = (fn, delay) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, delay);
    timers.add(id);
    return id;
  };

  const clearTimers = () => {
    timers.forEach((id) => window.clearTimeout(id));
    timers.clear();
  };

  const setCutProgress = (progress, pointerX) => {
    const clamped = Math.max(0, Math.min(1, progress));
    loader.style.setProperty("--cut-progress", clamped.toFixed(4));

    if (typeof pointerX === "number" && ticketRect) {
      const x = Math.max(0, Math.min(ticketRect.width, pointerX - ticketRect.left));
      loader.style.setProperty("--cut-head-x", `${(x / ticketRect.width) * 100}%`);
    }
  };

  const resizeTrail = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);

    trailCanvas.width = Math.round(width * dpr);
    trailCanvas.height = Math.round(height * dpr);
    trailCanvas.style.width = `${width}px`;
    trailCanvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const pushTrailPoint = (x, y, pressure = 0.5) => {
    const now = performance.now();
    const point = {
      x,
      y,
      pressure: Math.max(0.25, Math.min(1, pressure || 0.5)),
      born: now
    };

    if (lastTrailPoint) {
      const dx = point.x - lastTrailPoint.x;
      const dy = point.y - lastTrailPoint.y;
      if ((dx * dx) + (dy * dy) < 9) return;
    }

    trail.push(point);
    lastTrailPoint = point;

    if (!trailFrame) {
      trailFrame = requestAnimationFrame(drawTrail);
    }
  };

  const drawTrail = (now) => {
    trailFrame = 0;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const lifetime = cutComplete ? 260 : 420;

    while (trail.length && now - trail[0].born > lifetime) {
      trail.shift();
    }

    if (trail.length > 1) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = "lighter";

      for (let i = 1; i < trail.length; i += 1) {
        const a = trail[i - 1];
        const b = trail[i];
        const age = now - b.born;
        const life = Math.max(0, 1 - age / lifetime);
        const position = i / trail.length;
        const width = 1.5 + position * 7 * b.pressure;

        const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        gradient.addColorStop(0, `rgba(255, 183, 49, ${0.08 * life})`);
        gradient.addColorStop(0.48, `rgba(255, 224, 132, ${0.56 * life})`);
        gradient.addColorStop(1, `rgba(255, 250, 218, ${0.92 * life})`);

        ctx.strokeStyle = gradient;
        ctx.shadowColor = `rgba(255, 188, 56, ${0.72 * life})`;
        ctx.shadowBlur = 16 * life;
        ctx.lineWidth = width * life;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);

        if (i < trail.length - 1) {
          const next = trail[i + 1];
          const midX = (b.x + next.x) * 0.5;
          const midY = (b.y + next.y) * 0.5;
          ctx.quadraticCurveTo(b.x, b.y, midX, midY);
        } else {
          ctx.lineTo(b.x, b.y);
        }

        ctx.stroke();
      }

      const head = trail[trail.length - 1];
      const headLife = Math.max(0, 1 - (now - head.born) / lifetime);
      if (headLife > 0 && dragging && !cutComplete) {
        ctx.fillStyle = `rgba(255, 247, 207, ${0.95 * headLife})`;
        ctx.shadowColor = `rgba(255, 188, 56, ${0.9 * headLife})`;
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 4.5 + head.pressure * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    if (trail.length) {
      trailFrame = requestAnimationFrame(drawTrail);
    } else {
      lastTrailPoint = null;
    }
  };

  const clearTrail = () => {
    trail.length = 0;
    lastTrailPoint = null;
    if (trailFrame) {
      cancelAnimationFrame(trailFrame);
      trailFrame = 0;
    }
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimers();
    clearTrail();

    body.classList.remove("is-loading");
    body.classList.add("is-revealed");
    loader.classList.add("is-gone");

    requestAnimationFrame(() => {
      if (loader.isConnected) loader.remove();
    });
  };

  const openTicket = () => {
    if (finished || loader.classList.contains("is-opening")) return;

    dragging = false;
    activePointerId = null;
    loader.classList.remove("is-dragging", "is-cutting");
    loader.classList.add("is-opening");
    body.classList.add("is-revealed");

    const movingHalf = loader.querySelector(".ticket-half--bottom");

    if (!movingHalf) {
      later(finish, 1080);
      return;
    }

    const onOpened = (event) => {
      if (event.animationName !== "openBottom") return;
      movingHalf.removeEventListener("animationend", onOpened);
      finish();
    };

    movingHalf.addEventListener("animationend", onOpened);
    later(finish, 1300);
  };

  const completeCut = () => {
    if (cutComplete) return;

    cutComplete = true;
    dragging = false;
    ready = false;

    loader.classList.remove("is-dragging");
    loader.classList.add("is-cut-complete");
    setCutProgress(1, direction > 0 ? ticketRect.right : ticketRect.left);

    if (instruction) {
      instruction.classList.add("is-hidden");
    }

    later(openTicket, reducedMotion ? 40 : 180);
  };

  const resetCut = () => {
    dragging = false;
    activePointerId = null;
    loader.classList.remove("is-dragging", "is-cutting");
    loader.classList.add("is-resetting");

    setCutProgress(0, direction > 0 ? ticketRect.left : ticketRect.right);

    if (instruction) {
      instruction.classList.add("is-nudge");
      later(() => instruction.classList.remove("is-nudge"), 520);
    }

    later(() => loader.classList.remove("is-resetting"), 260);
  };

  const beginCut = (event) => {
    if (!ready || finished || cutComplete || dragging) return;

    ticketRect = ticket.getBoundingClientRect();
    cutCenterY = ticketRect.top + ticketRect.height * 0.5;
    cutBand = Math.max(70, Math.min(130, ticketRect.height * 0.18));

    if (
      event.clientX < ticketRect.left - 24 ||
      event.clientX > ticketRect.right + 24 ||
      Math.abs(event.clientY - cutCenterY) > cutBand
    ) {
      if (instruction) {
        instruction.classList.remove("is-nudge");
        void instruction.offsetWidth;
        instruction.classList.add("is-nudge");
      }
      return;
    }

    dragging = true;
    activePointerId = event.pointerId;
    startX = event.clientX;
    direction = event.clientX <= ticketRect.left + ticketRect.width * 0.5 ? 1 : -1;

    loader.style.setProperty("--cut-origin", direction > 0 ? "left" : "right");
    loader.classList.add("is-dragging", "is-cutting");
    loader.classList.remove("is-resetting");

    if (instruction) instruction.classList.add("is-active");

    try {
      loader.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional.
    }

    setCutProgress(0, event.clientX);
    pushTrailPoint(event.clientX, event.clientY, event.pressure);
    event.preventDefault();
  };

  const moveCut = (event) => {
    if (!dragging || event.pointerId !== activePointerId || !ticketRect) return;

    const dx = (event.clientX - startX) * direction;
    const availableDistance = direction > 0
      ? ticketRect.right - startX
      : startX - ticketRect.left;
    const requiredDistance = Math.max(ticketRect.width * 0.42, availableDistance * 0.90);
    const horizontalProgress = Math.max(0, Math.min(1, dx / requiredDistance));
    const yDistance = Math.abs(event.clientY - cutCenterY);
    const alignment = Math.max(0, 1 - yDistance / (cutBand * 1.5));
    const progress = horizontalProgress * (0.78 + alignment * 0.22);

    setCutProgress(progress, event.clientX);
    pushTrailPoint(event.clientX, event.clientY, event.pressure);

    if (progress >= 0.94 && yDistance <= cutBand * 1.3) {
      completeCut();
    }

    event.preventDefault();
  };

  const endCut = (event) => {
    if (!dragging || event.pointerId !== activePointerId) return;

    try {
      loader.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released.
    }

    if (cutComplete) return;

    if (instruction) instruction.classList.remove("is-active");
    resetCut();
    event.preventDefault();
  };

  const prepareInteraction = () => {
    if (finished) return;

    loader.classList.remove("is-entering");
    loader.classList.add("is-ready");
    ready = true;

    setCutProgress(0, ticket.getBoundingClientRect().left);

    if (instruction) {
      instruction.classList.toggle("is-touch", coarsePointer);
    }
  };

  const play = () => {
    if (finished) return;

    resizeTrail();

    if (reducedMotion) {
      loader.classList.add("is-ready");
      ready = true;
      return;
    }

    loader.classList.add("is-entering");
    later(prepareInteraction, 900);
  };

  loader.addEventListener("pointerdown", beginCut, { passive: false });
  loader.addEventListener("pointermove", moveCut, { passive: false });
  loader.addEventListener("pointerup", endCut, { passive: false });
  loader.addEventListener("pointercancel", endCut, { passive: false });
  window.addEventListener("resize", resizeTrail, { passive: true });

  window.GoldenTicketLoader = {
    play,
    finish,
    open: completeCut
  };

  if (document.readyState === "complete") {
    requestAnimationFrame(play);
  } else {
    window.addEventListener("load", () => requestAnimationFrame(play), { once: true });
  }
})();

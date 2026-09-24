(() => {
  const loader = document.getElementById("goldenLoader");
  const body = document.body;
  const ticket = document.getElementById("ticketStage");
  const trailCanvas = document.getElementById("cutTrail");
  const instruction = document.getElementById("cutInstruction");
  const cutLine = document.getElementById("cutLine");
  const cutLinePath = document.getElementById("cutLinePath");
  const cutLineShadow = document.getElementById("cutLineShadow");
  const topHalf = loader?.querySelector(".ticket-half--top");
  const bottomHalf = loader?.querySelector(".ticket-half--bottom");
  const topArt = topHalf?.querySelector(".ticket-art");
  const bottomArt = bottomHalf?.querySelector(".ticket-art");

  if (
    !loader ||
    !ticket ||
    !trailCanvas ||
    !cutLine ||
    !cutLinePath ||
    !cutLineShadow ||
    !topHalf ||
    !bottomHalf ||
    !topArt ||
    !bottomArt
  ) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const ctx = trailCanvas.getContext("2d", { alpha: true });

  const timers = new Set();
  const trail = [];
  const cutPoints = [];

  let finished = false;
  let ready = false;
  let dragging = false;
  let cutComplete = false;
  let activePointerId = null;
  let ticketRect = null;
  let cutCenterY = 0;
  let cutBand = 0;
  let trailFrame = 0;
  let lastTrailPoint = null;

  let direction = 1;
  let startX = 0;
  let currentProgress = 0;
  let committedTravel = 0;
  let dragStartTravel = 0;
  let hasStoredCut = false;

  const COMPLETE_THRESHOLD = 0.60;
  const EDGE_TOLERANCE = 14;
  const RESUME_RADIUS = 280;

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

  const setCutProgress = (progress, pointerX, pointerY) => {
    const clamped = Math.max(0, Math.min(1, progress));
    currentProgress = clamped;

    loader.style.setProperty("--cut-progress", clamped.toFixed(4));
    loader.style.setProperty("--gesture-progress", clamped.toFixed(4));

    if (ticketRect && typeof pointerX === "number") {
      const x = Math.max(0, Math.min(ticketRect.width, pointerX - ticketRect.left));
      loader.style.setProperty("--cut-head-x", `${(x / ticketRect.width) * 100}%`);
    }

    if (ticketRect && typeof pointerY === "number") {
      const y = Math.max(0, Math.min(ticketRect.height, pointerY - ticketRect.top));
      loader.style.setProperty("--cut-head-y", `${(y / ticketRect.height) * 100}%`);
    }
  };

  const clearCutPath = () => {
    cutPoints.length = 0;
    cutLinePath.removeAttribute("d");
    cutLineShadow.removeAttribute("d");
    topArt.style.removeProperty("clip-path");
    topArt.style.removeProperty("-webkit-clip-path");
    bottomArt.style.removeProperty("clip-path");
    bottomArt.style.removeProperty("-webkit-clip-path");
  };

  const renderCutPath = () => {
    if (!ticketRect || cutPoints.length < 2) return;

    cutLine.setAttribute("viewBox", `0 0 ${ticketRect.width} ${ticketRect.height}`);

    const local = cutPoints.map((point) => ({
      x: Math.max(0, Math.min(ticketRect.width, point.x - ticketRect.left)),
      y: Math.max(0, Math.min(ticketRect.height, point.y - ticketRect.top))
    }));

    let d = `M ${local[0].x.toFixed(2)} ${local[0].y.toFixed(2)}`;

    if (local.length === 2) {
      d += ` L ${local[1].x.toFixed(2)} ${local[1].y.toFixed(2)}`;
    } else {
      for (let i = 1; i < local.length - 1; i += 1) {
        const point = local[i];
        const next = local[i + 1];
        const midX = (point.x + next.x) * 0.5;
        const midY = (point.y + next.y) * 0.5;
        d += ` Q ${point.x.toFixed(2)} ${point.y.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`;
      }

      const last = local[local.length - 1];
      d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
    }

    cutLinePath.setAttribute("d", d);
    cutLineShadow.setAttribute("d", d);
  };

  const addCutPoint = (x, y) => {
    if (!ticketRect) return;

    const clampedX = Math.max(ticketRect.left, Math.min(ticketRect.right, x));
    const clampedY = Math.max(
      cutCenterY - cutBand * 1.35,
      Math.min(cutCenterY + cutBand * 1.35, y)
    );

    const point = { x: clampedX, y: clampedY };
    const last = cutPoints[cutPoints.length - 1];

    if (last) {
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      if ((dx * dx) + (dy * dy) < 9) return;
    }

    cutPoints.push(point);
    renderCutPath();
  };

  const getMonotonicBoundary = () => {
    if (!ticketRect || cutPoints.length < 2) return null;

    const sorted = cutPoints
      .map((point) => ({
        x: ((point.x - ticketRect.left) / ticketRect.width) * 100,
        y: ((point.y - ticketRect.top) / ticketRect.height) * 100
      }))
      .sort((a, b) => a.x - b.x);

    const compact = [];

    for (const point of sorted) {
      const x = Math.max(0, Math.min(100, point.x));
      const y = Math.max(20, Math.min(80, point.y));
      const previous = compact[compact.length - 1];

      if (!previous || x - previous.x >= 1.35) {
        compact.push({ x, y });
      } else {
        previous.y = (previous.y + y) * 0.5;
        previous.x = Math.max(previous.x, x);
      }
    }

    if (compact.length < 2) return null;

    const first = compact[0];
    const second = compact[1];
    const last = compact[compact.length - 1];
    const beforeLast = compact[compact.length - 2];

    const leftSlope = (second.y - first.y) / Math.max(1, second.x - first.x);
    const rightSlope = (last.y - beforeLast.y) / Math.max(1, last.x - beforeLast.x);

    if (first.x > 0) {
      compact.unshift({
        x: 0,
        y: Math.max(20, Math.min(80, first.y - leftSlope * first.x))
      });
    } else {
      first.x = 0;
    }

    const updatedLast = compact[compact.length - 1];

    if (updatedLast.x < 100) {
      compact.push({
        x: 100,
        y: Math.max(20, Math.min(80, updatedLast.y + rightSlope * (100 - updatedLast.x)))
      });
    } else {
      updatedLast.x = 100;
    }

    return compact;
  };

  const prepareSplitFromCut = () => {
    const boundary = getMonotonicBoundary();
    if (!boundary) return;

    const topEdge = boundary
      .slice()
      .reverse()
      .map((point) => `${point.x.toFixed(2)}% ${point.y.toFixed(2)}%`)
      .join(", ");

    const bottomEdge = boundary
      .map((point) => `${point.x.toFixed(2)}% ${point.y.toFixed(2)}%`)
      .join(", ");

    const left = boundary[0];
    const right = boundary[boundary.length - 1];

    const topClip = `polygon(0% 0%, 100% 0%, 100% ${right.y.toFixed(2)}%, ${topEdge}, 0% ${left.y.toFixed(2)}%)`;
    const bottomClip = `polygon(0% ${left.y.toFixed(2)}%, ${bottomEdge}, 100% ${right.y.toFixed(2)}%, 100% 100%, 0% 100%)`;

    topArt.style.clipPath = topClip;
    topArt.style.webkitClipPath = topClip;
    bottomArt.style.clipPath = bottomClip;
    bottomArt.style.webkitClipPath = bottomClip;

    const averageY = boundary.reduce((sum, point) => sum + point.y, 0) / boundary.length;
    loader.style.setProperty("--cut-axis-y", `${averageY.toFixed(2)}%`);
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

    if (ticketRect && cutPoints.length) {
      ticketRect = ticket.getBoundingClientRect();
      renderCutPath();
    }
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
    loader.classList.remove("is-dragging", "is-cutting", "is-paused");
    loader.classList.add("is-opening");
    body.classList.add("is-revealed");

    const onOpened = (event) => {
      if (event.animationName !== "openBottom") return;
      bottomHalf.removeEventListener("animationend", onOpened);
      finish();
    };

    bottomHalf.addEventListener("animationend", onOpened);
    later(finish, 1300);
  };

  const completeCut = () => {
    if (cutComplete) return;

    cutComplete = true;
    dragging = false;
    ready = false;
    hasStoredCut = true;
    committedTravel = Math.max(committedTravel, currentProgress * ticketRect.width);

    prepareSplitFromCut();

    loader.classList.remove("is-dragging", "is-paused");
    loader.classList.add("is-cut-complete");

    const lastPoint = cutPoints[cutPoints.length - 1];

    if (lastPoint) {
      setCutProgress(currentProgress, lastPoint.x, lastPoint.y);
    }

    if (instruction) {
      instruction.classList.add("is-hidden");
    }

    later(openTicket, reducedMotion ? 40 : 260);
  };

  const pauseCut = () => {
    dragging = false;
    activePointerId = null;
    committedTravel = Math.max(committedTravel, currentProgress * ticketRect.width);
    hasStoredCut = committedTravel > 0;

    loader.classList.remove("is-dragging", "is-cutting");
    loader.classList.add("is-paused");

    const lastPoint = cutPoints[cutPoints.length - 1];

    if (lastPoint) {
      setCutProgress(
        Math.min(1, committedTravel / ticketRect.width),
        lastPoint.x,
        lastPoint.y
      );
    }

    if (instruction) {
      instruction.classList.remove("is-active");
    }
  };

  const nudgeInstruction = () => {
    if (!instruction) return;

    instruction.classList.remove("is-nudge");
    void instruction.offsetWidth;
    instruction.classList.add("is-nudge");
  };

  const beginCut = (event) => {
    if (!ready || finished || cutComplete || dragging) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    ticketRect = ticket.getBoundingClientRect();
    cutCenterY = ticketRect.top + ticketRect.height * 0.5;
    cutBand = Math.max(110, Math.min(220, ticketRect.height * 0.30));

    const hitPad = 56;
    const hitBand = Math.max(cutBand * 1.45, ticketRect.height * 0.38);
    const lastPoint = cutPoints[cutPoints.length - 1];

    if (hasStoredCut && lastPoint) {
      const dx = event.clientX - lastPoint.x;
      const dy = event.clientY - lastPoint.y;

      if ((dx * dx) + (dy * dy) > RESUME_RADIUS * RESUME_RADIUS) {
        nudgeInstruction();
        return;
      }
    } else if (
      event.clientX < ticketRect.left - hitPad ||
      event.clientX > ticketRect.right + hitPad ||
      Math.abs(event.clientY - cutCenterY) > hitBand
    ) {
      nudgeInstruction();
      return;
    }

    dragging = true;
    activePointerId = event.pointerId;
    dragStartTravel = committedTravel;

    if (!hasStoredCut || cutPoints.length === 0) {
      startX = event.clientX;
      direction = event.clientX <= ticketRect.left + ticketRect.width * 0.5 ? 1 : -1;
      committedTravel = 0;
      dragStartTravel = 0;
      currentProgress = 0;
      clearCutPath();
      addCutPoint(event.clientX, event.clientY);
    } else {
      startX = lastPoint.x;
    }

    loader.style.setProperty("--cut-origin", direction > 0 ? "left" : "right");
    loader.classList.remove("is-paused");
    loader.classList.add("is-dragging", "is-cutting");

    if (instruction) {
      instruction.classList.add("is-active");
    }

    try {
      loader.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional.
    }

    setCutProgress(
      Math.min(1, committedTravel / ticketRect.width),
      event.clientX,
      event.clientY
    );

    pushTrailPoint(event.clientX, event.clientY, event.pressure);
    event.preventDefault();
  };

  const moveCut = (event) => {
    if (!dragging || event.pointerId !== activePointerId || !ticketRect) return;

    const directionalDelta = Math.max(0, (event.clientX - startX) * direction);
    const totalTravel = Math.max(
      committedTravel,
      Math.min(ticketRect.width, dragStartTravel + directionalDelta)
    );
    const progress = Math.min(1, totalTravel / ticketRect.width);
    const yDistance = Math.abs(event.clientY - cutCenterY);

    setCutProgress(progress, event.clientX, event.clientY);
    addCutPoint(event.clientX, event.clientY);
    pushTrailPoint(event.clientX, event.clientY, event.pressure);

    committedTravel = Math.max(committedTravel, totalTravel);
    hasStoredCut = committedTravel > 0;

    const edgeReached = direction > 0
      ? event.clientX >= ticketRect.right - EDGE_TOLERANCE
      : event.clientX <= ticketRect.left + EDGE_TOLERANCE;

    if (
      (progress >= COMPLETE_THRESHOLD || edgeReached) &&
      yDistance <= cutBand * 1.65
    ) {
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

    if (instruction) {
      instruction.classList.remove("is-active");
    }

    committedTravel = Math.max(committedTravel, currentProgress * ticketRect.width);
    hasStoredCut = committedTravel > 0;

    if (currentProgress >= COMPLETE_THRESHOLD) {
      completeCut();
    } else {
      pauseCut();
    }

    event.preventDefault();
  };

  const prepareInteraction = () => {
    if (finished) return;

    loader.classList.remove("is-entering");
    loader.classList.add("is-ready");
    loader.style.setProperty("--gesture-progress", "0");

    ready = true;
    currentProgress = 0;
    committedTravel = 0;
    dragStartTravel = 0;
    hasStoredCut = false;

    ticketRect = ticket.getBoundingClientRect();
    cutCenterY = ticketRect.top + ticketRect.height * 0.5;

    setCutProgress(0, ticketRect.left, cutCenterY);

    if (instruction) {
      instruction.classList.toggle("is-touch", coarsePointer);
    }
  };

  const play = () => {
    if (finished) return;

    resizeTrail();
    prepareInteraction();

    if (!reducedMotion) {
      loader.classList.add("is-entering");
      later(() => loader.classList.remove("is-entering"), 900);
    }
  };

  loader.addEventListener("pointerdown", beginCut, { passive: false, capture: true });
  loader.addEventListener("pointermove", moveCut, { passive: false, capture: true });
  loader.addEventListener("pointerup", endCut, { passive: false, capture: true });
  loader.addEventListener("pointercancel", endCut, { passive: false, capture: true });
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

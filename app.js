(() => {
  const loader = document.getElementById("goldenLoader");
  const scene = document.getElementById("envelopeScene");
  const shadow = document.getElementById("envelopeShadow");
  const back = document.getElementById("envelopeBack");
  const front = document.getElementById("envelopeFront");
  const flap = document.getElementById("envelopeFlap");
  const flapFace = document.getElementById("envelopeFlapFace");
  const ticketMotion = document.getElementById("ticketMotion");
  const ticket = document.getElementById("goldenTicket");
  const zoomLetter = document.getElementById("zoomLetter");
  const blackout = document.getElementById("zoomBlackout");
  const body = document.body;

  if (
    !loader ||
    !scene ||
    !shadow ||
    !back ||
    !front ||
    !flap ||
    !flapFace ||
    !ticketMotion ||
    !ticket ||
    !zoomLetter ||
    !blackout
  ) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let finished = false;
  let running = false;

  const nextFrame = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const waitForMotion = (element, kind, name, fallbackMs) => new Promise((resolve) => {
    let settled = false;
    const eventName = kind === "animation" ? "animationend" : "transitionend";

    const finishWait = () => {
      if (settled) return;
      settled = true;
      element.removeEventListener(eventName, onEnd);
      window.clearTimeout(fallback);
      resolve();
    };

    const onEnd = (event) => {
      if (event.target !== element) return;

      if (kind === "animation" && event.animationName !== name) return;
      if (kind === "transition" && event.propertyName !== name) return;

      finishWait();
    };

    const fallback = window.setTimeout(finishWait, fallbackMs);
    element.addEventListener(eventName, onEnd);
  });

  const setMotionMetrics = () => {
    const ticketRect = ticket.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();

    const drop = Math.max(
      window.innerHeight * 0.70,
      sceneRect.height * 0.98
    );

    const rise = Math.min(
      ticketRect.height * 0.30,
      sceneRect.height * 0.14
    );

    scene.style.setProperty("--envelope-drop-y", `${drop.toFixed(2)}px`);
    scene.style.setProperty("--ticket-rise-y", `${(-rise).toFixed(2)}px`);
  };

  const setTicketCenterTarget = () => {
    const rect = ticket.getBoundingClientRect();
    const centerY = rect.top + rect.height * 0.5;
    const correction = window.innerHeight * 0.5 - centerY;
    const rise = parseFloat(getComputedStyle(scene).getPropertyValue("--ticket-rise-y")) || 0;

    scene.style.setProperty("--ticket-center-y", `${(rise + correction).toFixed(2)}px`);
  };

  const setLetterZoomTarget = () => {
    const ticketRect = ticket.getBoundingClientRect();
    const letterRect = zoomLetter.getBoundingClientRect();

    const localX = letterRect.left + letterRect.width * 0.5 - ticketRect.left;
    const localY = letterRect.top + letterRect.height * 0.5 - ticketRect.top;

    const scaleToCover = Math.max(
      window.innerWidth / Math.max(letterRect.width, 1),
      window.innerHeight / Math.max(letterRect.height, 1)
    );

    // The I is solid black. Overscaling guarantees its painted body reaches
    // beyond every viewport edge before the final black frame.
    const scale = Math.max(28, scaleToCover * 3.6);
    const tx = window.innerWidth * 0.5 - ticketRect.left - localX * scale;
    const ty = window.innerHeight * 0.5 - ticketRect.top - localY * scale;

    ticket.style.setProperty("--zoom-scale", scale.toFixed(4));
    ticket.style.setProperty("--zoom-tx", `${tx.toFixed(2)}px`);
    ticket.style.setProperty("--zoom-ty", `${ty.toFixed(2)}px`);
  };

  const finish = () => {
    if (finished) return;
    finished = true;

    body.classList.remove("is-loading");
    body.classList.add("is-revealed", "is-instant-reveal");
    loader.classList.add("is-gone");

    requestAnimationFrame(() => {
      if (loader.isConnected) loader.remove();
    });
  };

  const play = async () => {
    if (running || finished) return;
    running = true;

    if (reducedMotion) {
      finish();
      return;
    }

    setMotionMetrics();

    loader.classList.add("is-arriving");
    await waitForMotion(scene, "animation", "envelopeEnter", 900);

    // 1. Lift only the flap. It drops behind the pocket immediately,
    // matching the reference envelope construction.
    loader.classList.add("is-flap-up");
    await waitForMotion(flapFace, "animation", "flapLift", 900);

    // 2. The envelope pieces move down together. The ticket is a sibling,
    // so it can rise independently instead of counter-transforming a parent.
    setMotionMetrics();
    loader.classList.add("is-envelope-drop");
    await waitForMotion(front, "transition", "transform", 1100);

    // 3. The ticket returns from its small rise to the exact viewport center.
    setTicketCenterTarget();
    loader.classList.add("is-ticket-center");
    await waitForMotion(ticketMotion, "transition", "transform", 900);

    // 4. Measure the glyph only after every previous transform has settled.
    await nextFrame();
    setLetterZoomTarget();
    loader.classList.add("is-zooming");

    // The black frame is the authority for the transition. The web is never
    // revealed from the ticket animation itself.
    await waitForMotion(blackout, "animation", "zoomBlackout", 1800);

    // Keep one fully rendered black frame, then swap immediately to the site.
    await nextFrame();
    finish();
  };

  window.addEventListener("resize", () => {
    if (running || finished) return;
    setMotionMetrics();
  }, { passive: true });

  window.GoldenTicketLoader = { play, finish };

  if (document.readyState === "complete") {
    play();
  } else {
    window.addEventListener("load", play, { once: true });
  }
})();

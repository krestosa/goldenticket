(() => {
  const loader = document.getElementById("goldenLoader");
  const scene = document.getElementById("envelopeScene");
  const shell = document.getElementById("envelopeShell");
  const flap = document.getElementById("envelopeFlap");
  const ticketMotion = document.getElementById("ticketMotion");
  const ticket = document.getElementById("goldenTicket");
  const zoomLetter = document.getElementById("zoomLetter");
  const body = document.body;

  if (!loader || !scene || !shell || !flap || !ticketMotion || !ticket || !zoomLetter) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timers = new Set();
  let finished = false;
  let zoomStarted = false;

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

  const prepareEnvelopeMotion = () => {
    const ticketRect = ticket.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();
    const drop = Math.max(window.innerHeight * 0.72, sceneRect.height * 1.35);
    const rise = Math.min(ticketRect.height * 0.30, 150);

    scene.style.setProperty("--envelope-drop-y", `${drop.toFixed(2)}px`);
    scene.style.setProperty("--ticket-rise-y", `${(-drop - rise).toFixed(2)}px`);
  };

  const prepareTicketCenter = () => {
    const rect = ticket.getBoundingClientRect();
    const correction = window.innerHeight * 0.5 - (rect.top + rect.height * 0.5);
    const current = parseFloat(getComputedStyle(scene).getPropertyValue("--ticket-rise-y")) || 0;
    scene.style.setProperty("--ticket-center-y", `${(current + correction).toFixed(2)}px`);
  };

  const prepareLetterZoom = () => {
    const ticketRect = ticket.getBoundingClientRect();
    const letterRect = zoomLetter.getBoundingClientRect();

    const localX = letterRect.left + letterRect.width * 0.5 - ticketRect.left;
    const localY = letterRect.top + letterRect.height * 0.5 - ticketRect.top;

    const scaleX = window.innerWidth / Math.max(1, letterRect.width);
    const scaleY = window.innerHeight / Math.max(1, letterRect.height);
    const zoomScale = Math.max(scaleX, scaleY) * 3.35;

    const tx = window.innerWidth * 0.5 - ticketRect.left - localX * zoomScale;
    const ty = window.innerHeight * 0.5 - ticketRect.top - localY * zoomScale;

    ticket.style.setProperty("--zoom-scale", zoomScale.toFixed(4));
    ticket.style.setProperty("--zoom-tx", `${tx.toFixed(2)}px`);
    ticket.style.setProperty("--zoom-ty", `${ty.toFixed(2)}px`);
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimers();

    body.classList.remove("is-loading");
    loader.classList.add("is-gone");

    requestAnimationFrame(() => {
      if (loader.isConnected) loader.remove();
    });
  };

  const revealWeb = () => {
    if (finished) return;
    body.classList.add("is-revealed", "is-instant-reveal");
    finish();
  };

  const onZoomEnd = (event) => {
    if (event.animationName !== "ticketLetterZoom") return;
    ticket.removeEventListener("animationend", onZoomEnd);
    revealWeb();
  };

  const startZoom = () => {
    if (zoomStarted || finished) return;
    zoomStarted = true;
    prepareLetterZoom();
    ticket.addEventListener("animationend", onZoomEnd);
    loader.classList.add("is-zooming");
  };

  const openFlap = () => {
    loader.classList.add("is-flap-up");

    flap.addEventListener("animationend", () => {
      loader.classList.add("is-flap-behind");
    }, { once: true });
  };

  const play = () => {
    if (finished) return;

    if (reducedMotion) {
      body.classList.add("is-revealed", "is-instant-reveal");
      finish();
      return;
    }

    prepareEnvelopeMotion();

    requestAnimationFrame(() => {
      loader.classList.add("is-arriving");
    });

    later(openFlap, 760);

    later(() => {
      prepareEnvelopeMotion();
      loader.classList.add("is-envelope-drop");
    }, 1640);

    later(() => {
      prepareTicketCenter();
      loader.classList.add("is-ticket-center");
    }, 2580);

    later(startZoom, 3380);
  };

  window.addEventListener("resize", () => {
    if (finished || zoomStarted) return;
    prepareEnvelopeMotion();
  }, { passive: true });

  window.GoldenTicketLoader = { play, finish };

  if (document.readyState === "complete") {
    play();
  } else {
    window.addEventListener("load", play, { once: true });
  }
})();

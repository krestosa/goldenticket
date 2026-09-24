(() => {
  const loader = document.getElementById("goldenLoader");
  const scene = document.getElementById("envelopeScene");
  const ticket = document.getElementById("goldenTicket");
  const zoomLetter = document.getElementById("zoomLetter");
  const body = document.body;

  if (!loader || !scene || !ticket || !zoomLetter) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timers = new Set();
  let finished = false;

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

  const prepareLetterZoom = () => {
    // Measure only after the ticket has finished returning to center.
    // The end transform uses origin 0/0 and an explicit matrix, so the
    // selected glyph lands exactly at the viewport center at every size.
    const ticketRect = ticket.getBoundingClientRect();
    const letterRect = zoomLetter.getBoundingClientRect();

    const localX = letterRect.left + letterRect.width * 0.5 - ticketRect.left;
    const localY = letterRect.top + letterRect.height * 0.5 - ticketRect.top;

    const scaleToCover = Math.max(
      window.innerWidth / Math.max(1, letterRect.width),
      window.innerHeight / Math.max(1, letterRect.height)
    );

    // Overshoot enough that the solid I fully covers the viewport before
    // the site is allowed to appear.
    const zoomScale = Math.max(22, Math.min(64, scaleToCover * 1.32));
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
    body.classList.add("is-revealed");
    loader.classList.add("is-gone");

    requestAnimationFrame(() => {
      if (loader.isConnected) loader.remove();
    });
  };

  const revealSiteAtZoomLimit = (event) => {
    if (event.animationName !== "ticketLetterZoom" || finished) return;

    ticket.removeEventListener("animationend", revealSiteAtZoomLimit);
    body.classList.add("is-revealed");
    loader.classList.add("is-web-reveal");
    later(finish, 420);
  };

  const startZoom = () => {
    prepareLetterZoom();
    ticket.addEventListener("animationend", revealSiteAtZoomLimit);
    loader.classList.add("is-zooming");
  };

  const play = () => {
    if (finished) return;

    if (reducedMotion) {
      body.classList.add("is-revealed");
      finish();
      return;
    }

    requestAnimationFrame(() => {
      loader.classList.add("is-arriving");
    });

    // 1. Lift only the flap.
    later(() => {
      loader.classList.add("is-flap-up");
    }, 780);

    // 2. Envelope moves down while the ticket rises slightly.
    later(() => {
      loader.classList.add("is-envelope-drop");
    }, 1580);

    // 3. Ticket returns to the exact visual center.
    later(() => {
      loader.classList.add("is-ticket-center");
    }, 2500);

    // 4. Start the glyph zoom only after the centering transition is complete.
    later(startZoom, 3220);
  };

  window.addEventListener("resize", () => {
    if (!loader.classList.contains("is-zooming")) {
      prepareLetterZoom();
    }
  }, { passive: true });

  window.GoldenTicketLoader = {
    play,
    finish
  };

  if (document.readyState === "complete") {
    play();
  } else {
    window.addEventListener("load", play, { once: true });
  }
})();

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
    const ticketRect = ticket.getBoundingClientRect();
    const letterRect = zoomLetter.getBoundingClientRect();

    const localX = letterRect.left + letterRect.width * 0.5 - ticketRect.left;
    const localY = letterRect.top + letterRect.height * 0.5 - ticketRect.top;
    const originX = (localX / ticketRect.width) * 100;
    const originY = (localY / ticketRect.height) * 100;

    const letterCenterX = letterRect.left + letterRect.width * 0.5;
    const letterCenterY = letterRect.top + letterRect.height * 0.5;
    const shiftX = window.innerWidth * 0.5 - letterCenterX;
    const shiftY = window.innerHeight * 0.5 - letterCenterY;

    const scaleToFill = Math.max(
      window.innerWidth / Math.max(1, letterRect.width),
      window.innerHeight / Math.max(1, letterRect.height)
    );
    const zoomScale = Math.max(18, Math.min(42, scaleToFill * 2.15));

    ticket.style.setProperty("--zoom-origin-x", `${originX.toFixed(3)}%`);
    ticket.style.setProperty("--zoom-origin-y", `${originY.toFixed(3)}%`);
    ticket.style.setProperty("--zoom-shift-x", `${shiftX.toFixed(2)}px`);
    ticket.style.setProperty("--zoom-shift-y", `${shiftY.toFixed(2)}px`);
    ticket.style.setProperty("--zoom-scale", zoomScale.toFixed(3));
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

    later(() => {
      loader.classList.add("is-flap-up");
    }, 760);

    later(() => {
      loader.classList.add("is-envelope-drop");
    }, 1510);

    later(() => {
      loader.classList.add("is-ticket-center");
    }, 2250);

    later(() => {
      prepareLetterZoom();
      body.classList.add("is-revealed");
      loader.classList.add("is-zooming");
    }, 2940);

    later(finish, 4350);
  };

  window.addEventListener("resize", () => {
    if (loader.classList.contains("is-zooming")) {
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

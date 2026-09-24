(() => {
  const loader = document.getElementById("goldenLoader");
  const body = document.body;

  if (!loader) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timers = new Set();
  let finished = false;
  let playing = false;

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

  const removeLoader = () => {
    if (!loader.isConnected) return;
    loader.remove();
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimers();

    body.classList.remove("is-loading");
    body.classList.add("is-revealed");
    loader.classList.add("is-gone");

    requestAnimationFrame(removeLoader);
  };

  const openTicket = () => {
    if (finished) return;

    loader.classList.remove("is-cutting");
    loader.classList.add("is-opening");
    body.classList.add("is-revealed");

    const movingHalf = loader.querySelector(".ticket-half--bottom");

    if (!movingHalf) {
      later(finish, 1050);
      return;
    }

    const onOpened = (event) => {
      if (event.animationName !== "openBottom") return;
      movingHalf.removeEventListener("animationend", onOpened);
      finish();
    };

    movingHalf.addEventListener("animationend", onOpened);

    // Fallback in case animation events are suppressed.
    later(finish, 1250);
  };

  const play = () => {
    if (playing || finished) return;
    playing = true;

    if (reducedMotion) {
      finish();
      return;
    }

    loader.classList.add("is-entering");

    later(() => {
      loader.classList.remove("is-entering");
      loader.classList.add("is-cutting");
    }, 900);

    later(() => {
      loader.classList.add("is-cut-complete");
    }, 1760);

    later(openTicket, 1840);
  };

  window.GoldenTicketLoader = { play, finish };

  if (document.readyState === "complete") {
    requestAnimationFrame(play);
  } else {
    window.addEventListener("load", () => requestAnimationFrame(play), { once: true });
  }
})();

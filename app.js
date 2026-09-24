(() => {
  const loader = document.getElementById("goldenLoader");
  const scene = document.getElementById("envelopeScene");
  const body = document.body;

  if (!loader || !scene) return;

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
      loader.classList.add("is-opening-envelope");
    }, 720);

    later(() => {
      loader.classList.add("is-flap-behind");
    }, 1360);

    later(() => {
      loader.classList.add("is-extracting-ticket");
    }, 1460);

    later(() => {
      body.classList.add("is-revealed");
      loader.classList.add("is-revealing-site");
    }, 2720);

    later(finish, 3680);
  };

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

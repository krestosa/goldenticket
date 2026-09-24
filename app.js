(() => {
  const loader = document.getElementById("goldenLoader");
  const body = document.body;

  if (!loader) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const finish = () => {
    body.classList.remove("is-loading");
    body.classList.add("is-revealed");
    loader.classList.add("is-gone");

    window.setTimeout(() => {
      loader.remove();
    }, reducedMotion ? 50 : 1200);
  };

  const play = () => {
    if (reducedMotion) {
      finish();
      return;
    }

    window.setTimeout(() => {
      loader.classList.add("is-cutting");
    }, 700);

    window.setTimeout(() => {
      loader.classList.add("is-opening");
      body.classList.add("is-revealed");
    }, 1750);

    window.setTimeout(() => {
      body.classList.remove("is-loading");
      loader.classList.add("is-gone");
    }, 2600);

    window.setTimeout(() => {
      loader.remove();
    }, 3400);
  };

  window.GoldenTicketLoader = { play, finish };

  if (document.readyState === "complete") {
    play();
  } else {
    window.addEventListener("load", play, { once: true });
  }
})();

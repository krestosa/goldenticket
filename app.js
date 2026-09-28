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

  const LOADER_ENABLED = false;

  if (!LOADER_ENABLED) {
    body.classList.remove("is-loading");
    body.classList.add("is-revealed", "is-instant-reveal");
    loader.remove();
    return;
  }

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
      ticketRect.height * 0.20,
      sceneRect.height * 0.08
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
    const scale = Math.max(24, scaleToCover * 2.85);
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

    // 1. Lift the flap in two physical halves. It stays in front until
    // exactly edge-on, then moves behind the pocket and finishes the rotation.
    loader.classList.add("is-flap-front");
    await waitForMotion(flapFace, "animation", "flapLiftFront", 650);

    loader.classList.add("is-flap-behind", "is-flap-back");
    await waitForMotion(flapFace, "animation", "flapLiftBack", 650);

    // 2. Only now does the envelope body slide down while the ticket rises a
    // small amount independently.
    setMotionMetrics();
    loader.classList.add("is-envelope-drop");
    await waitForMotion(front, "transition", "transform", 1100);

    // 3. Once the envelope is gone, place the ticket at the viewport center.
    setTicketCenterTarget();
    loader.classList.add("is-ticket-center");
    await waitForMotion(ticketMotion, "transition", "transform", 900);

    // 4. Measure the target glyph after every transform is fully settled.
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


/* Hero video: load only the active breakpoint */
(() => {
  const desktopVideo = document.querySelector(".campaign-hero__video--desktop");
  const mobileVideo = document.querySelector(".campaign-hero__video--mobile");
  if (!desktopVideo || !mobileVideo) return;

  const mobileQuery = window.matchMedia("(max-width: 760px)");
  let activeVideo = null;

  const unloadVideo = (video) => {
    video.onloadeddata = null;
    video.classList.remove("is-ready");
    video.pause();
    video.removeAttribute("src");
    video.load();
  };

  const loadVideo = (video) => {
    const src = video.dataset.src;
    if (!src) return;

    video.classList.remove("is-ready");

    const revealAndPlay = () => {
      video.classList.add("is-ready");
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    };

    video.onloadeddata = revealAndPlay;

    if (video.getAttribute("src") !== src) {
      video.setAttribute("src", src);
      video.load();
    }

    if (video.readyState >= 2) {
      revealAndPlay();
    }
  };

  const syncHeroVideo = () => {
    const nextVideo = mobileQuery.matches ? mobileVideo : desktopVideo;
    const previousVideo = nextVideo === mobileVideo ? desktopVideo : mobileVideo;

    if (activeVideo === nextVideo && nextVideo.hasAttribute("src")) return;

    unloadVideo(previousVideo);
    loadVideo(nextVideo);
    activeVideo = nextVideo;
  };

  syncHeroVideo();

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", syncHeroVideo);
  } else {
    mobileQuery.addListener(syncHeroVideo);
  }
})();


/* Pause background videos while offscreen */
(() => {
  if (!("IntersectionObserver" in window)) return;

  const videos = [
    document.querySelector(".campaign-hero__video--desktop"),
    document.querySelector(".campaign-hero__video--mobile"),
    document.querySelector(".anniversary-section__video")
  ].filter(Boolean);

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const video = entry.target;

      if (entry.isIntersecting && entry.intersectionRatio > 0.05) {
        if (video.hasAttribute("src")) {
          const playPromise = video.play();
          if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {});
          }
        }
      } else {
        video.pause();
      }
    }
  }, {
    root: null,
    rootMargin: "120px 0px",
    threshold: [0, 0.05]
  });

  videos.forEach((video) => observer.observe(video));
})();

/* One-shot viewport reveals */
(() => {
  const targets = Array.from(document.querySelectorAll(".reveal-target"));
  if (!targets.length) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion || !("IntersectionObserver" in window)) {
    targets.forEach((target) => target.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }, {
    root: null,
    rootMargin: "0px 0px -8% 0px",
    threshold: 0.08
  });

  targets.forEach((target) => observer.observe(target));
})();


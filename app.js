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


/* Background videos: eager loading + resilient muted autoplay */
(() => {
  const desktopVideo = document.querySelector(".campaign-hero__video--desktop");
  const mobileVideo = document.querySelector(".campaign-hero__video--mobile");
  const anniversaryVideo = document.querySelector(".anniversary-section__video");
  const videos = [desktopVideo, mobileVideo, anniversaryVideo].filter(Boolean);

  if (!videos.length) return;

  const mobileQuery = window.matchMedia("(max-width: 760px)");

  const prepareVideo = (video) => {
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = "auto";

    video.setAttribute("autoplay", "");
    video.setAttribute("loop", "");
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("preload", "auto");
  };

  const isInactiveHero = (video) => {
    if (video === desktopVideo) return mobileQuery.matches;
    if (video === mobileVideo) return !mobileQuery.matches;
    return false;
  };

  const markReady = (video) => {
    if (video === desktopVideo || video === mobileVideo) {
      video.classList.add("is-ready");
    }
  };

  const tryPlay = (video) => {
    if (!video || isInactiveHero(video)) return;

    prepareVideo(video);

    if (video.readyState >= 2) {
      markReady(video);
    }

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // Some embedded browsers only allow playback after the first user gesture.
        // Gesture listeners below retry immediately when that becomes possible.
      });
    }
  };

  const syncHeroVideo = () => {
    const activeVideo = mobileQuery.matches ? mobileVideo : desktopVideo;
    const inactiveVideo = activeVideo === mobileVideo ? desktopVideo : mobileVideo;

    if (inactiveVideo) {
      inactiveVideo.pause();
    }

    tryPlay(activeVideo);
  };

  const retryAll = () => {
    syncHeroVideo();
    tryPlay(anniversaryVideo);
  };

  videos.forEach((video) => {
    prepareVideo(video);

    // Start fetching immediately, even when the video is outside the viewport.
    if (video.readyState === 0) {
      video.load();
    }

    ["loadedmetadata", "loadeddata", "canplay", "playing"].forEach((eventName) => {
      video.addEventListener(eventName, () => {
        markReady(video);
        tryPlay(video);
      }, { passive: true });
    });
  });

  retryAll();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", retryAll, { once: true });
  }

  window.addEventListener("load", retryAll, { once: true });
  window.addEventListener("pageshow", retryAll);
  window.addEventListener("focus", retryAll);
  window.addEventListener("online", retryAll);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) retryAll();
  });

  ["pointerdown", "touchstart", "click", "keydown"].forEach((eventName) => {
    document.addEventListener(eventName, retryAll, {
      passive: true,
      capture: true
    });
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          tryPlay(entry.target);
        }
      }
    }, {
      root: null,
      rootMargin: "240px 0px",
      threshold: 0
    });

    videos.forEach((video) => observer.observe(video));
  }

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", syncHeroVideo);
  } else {
    mobileQuery.addListener(syncHeroVideo);
  }
})();


/* Gold sheen: first sweep 2s after viewport entry, then every 4s */
(() => {
  const targets = Array.from(document.querySelectorAll("[data-gold-sheen]"));
  if (!targets.length) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const basePosition = "-120% 50%, 42% 50%, 50% 50%";
  const states = new WeakMap();

  const runSweep = (target, state) => {
    if (!state || state.animation) return;

    target.style.backgroundPosition = basePosition;

    const animation = target.animate([
      { backgroundPosition: basePosition },
      { backgroundPosition: "-20% 50%, 42% 50%, 50% 50%", offset: .22 },
      { backgroundPosition: "78% 50%, 42% 50%, 50% 50%", offset: .5 },
      { backgroundPosition: "180% 50%, 42% 50%, 50% 50%" }
    ], {
      duration: 1000,
      easing: "ease-in-out",
      fill: "none"
    });

    state.animation = animation;

    const reset = () => {
      if (state.animation === animation) {
        state.animation = null;
      }
      target.style.backgroundPosition = basePosition;
    };

    animation.addEventListener("finish", reset, { once: true });
    animation.addEventListener("cancel", reset, { once: true });
  };

  const stopSheen = (target) => {
    const state = states.get(target);
    if (!state) {
      target.style.backgroundPosition = basePosition;
      return;
    }

    clearTimeout(state.firstTimer);
    clearInterval(state.interval);

    if (state.animation) {
      state.animation.cancel();
    }

    states.delete(target);
    target.style.backgroundPosition = basePosition;
  };

  const startSheen = (target) => {
    if (reducedMotion || states.has(target)) return;

    target.style.backgroundPosition = basePosition;

    const state = {
      firstTimer: null,
      interval: null,
      animation: null
    };

    states.set(target, state);

    state.firstTimer = window.setTimeout(() => {
      if (states.get(target) !== state) return;

      runSweep(target, state);

      state.interval = window.setInterval(() => {
        if (states.get(target) === state) {
          runSweep(target, state);
        }
      }, 4000);
    }, 2000);
  };

  if (reducedMotion) return;

  if (!("IntersectionObserver" in window)) {
    targets.forEach(startSheen);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        startSheen(entry.target);
      } else {
        stopSheen(entry.target);
      }
    }
  }, {
    root: null,
    threshold: 0
  });

  targets.forEach((target) => {
    target.style.backgroundPosition = basePosition;
    observer.observe(target);
  });
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


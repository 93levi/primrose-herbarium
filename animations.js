(() => {
    const imgs = Array.from(document.querySelectorAll(".underlay__img"));
    if (!imgs.length) return;
  
    // Respect reduced motion
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      imgs.forEach((el) => {
        el.style.opacity = "0.12";
      });
      return;
    }
  
    // ====== TUNING ======
    const LOOP_S = 30; // full reset every 30s
    const LOOP_MS = LOOP_S * 1000;
    const BASE_OPACITY = 0.22; // overall intensity
    const N = imgs.length;
  
    // helpers
    const rand = (a, b) => a + Math.random() * (b - a);
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  
    // Create a splatter polygon with K points (percent coords)
    function splatPolygon(K, rMin, rMax, jitter = 0.18) {
      const pts = [];
      const cx = 50,
        cy = 50;
  
      for (let i = 0; i < K; i++) {
        const ang = (i / K) * Math.PI * 2;
        const rr = rand(rMin, rMax);
        const jx = rand(-jitter, jitter) * 20;
        const jy = rand(-jitter, jitter) * 20;
        const x = cx + Math.cos(ang) * rr + jx;
        const y = cy + Math.sin(ang) * rr + jy;
        pts.push(
          `${clamp(x, 0, 100).toFixed(2)}% ${clamp(y, 0, 100).toFixed(2)}%`
        );
      }
      return `polygon(${pts.join(",")})`;
    }
  
    // Rectangle polygon with K points (so interpolation works)
    function rectPolygon(K) {
      // 4 corners repeated to reach K points
      const corners = ["0% 0%", "100% 0%", "100% 100%", "0% 100%"];
      const pts = [];
      for (let i = 0; i < K; i++) pts.push(corners[i % 4]);
      return `polygon(${pts.join(",")})`;
    }
  
    // Per-image parameters (different direction, sizes, drift vectors)
    const items = imgs.map((el, i) => {
      const scale = rand(0.72, 1.05);
      const tx = rand(-18, 18); // vw offset around center
      const ty = rand(-12, 18); // vh offset around center
      const dx = rand(-320, 320); // px drift
      const dy = rand(-320, 320);
      const r0 = rand(-6, 6); // initial rot
      const r1 = r0 + rand(-18, 18); // end rot (slow)
      const u = BASE_OPACITY * rand(0.55, 1.05);
      const delayS = -(i * (LOOP_S / N)); // stagger across the loop
  
      // “2000s ink” vibe: some are sharper, some bloomier
      const bloomType = pick(["wet", "dry", "mist"]);
      const blurStart =
        bloomType === "mist" ? 22 : bloomType === "wet" ? 16 : 12;
      const blurSettle = bloomType === "dry" ? 0.4 : 0.8;
  
      return { el, i, scale, tx, ty, dx, dy, r0, r1, u, delayS, blurStart, blurSettle };
    });
  
    // Kill any prior animations (hot reload safety)
    items.forEach(({ el }) => {
      el.getAnimations?.().forEach((a) => a.cancel());
    });
  
    // Build and run animations
    items.forEach((it) => {
      const K = 12; // polygon points (must match across keyframes)
      const pSmall = splatPolygon(K, 6, 14, 0.26); // tight splat
      const pBig = splatPolygon(K, 28, 44, 0.22); // dramatic splatter
      const pRect = rectPolygon(K); // full reveal
  
      // Base transform pieces
      const base = (xpx, ypx, rotDeg, sc) =>
        `translate3d(-50%, -50%, 0) translate3d(calc(${it.tx}vw + ${xpx}px), calc(${it.ty}vh + ${ypx}px), 0) rotate(${rotDeg}deg) scale(${sc})`;
  
      // Keyframes: dramatic splat → settle → drift → fade → hard reset (invisible)
      const kf = [
        {
          offset: 0,
          opacity: 0,
          filter: `blur(${it.blurStart}px) contrast(1.18)`,
          clipPath: pSmall,
          transform: base(0, 0, it.r0, it.scale * 0.72),
        },
        {
          offset: 0.06,
          opacity: it.u,
          filter: `blur(${Math.max(6, it.blurStart * 0.35)}px) contrast(1.10)`,
          clipPath: pBig,
          transform: base(0, 0, it.r0, it.scale * 1.10), // pop overshoot
        },
        {
          offset: 0.22,
          opacity: it.u,
          filter: `blur(${it.blurSettle}px) contrast(1.06)`,
          clipPath: pRect,
          transform: base(0, 0, it.r0, it.scale * 1.00),
        },
        {
          offset: 0.7,
          opacity: it.u * 0.75,
          filter: `blur(${it.blurSettle}px) contrast(1.06)`,
          clipPath: pRect,
          transform: base(it.dx, it.dy, it.r1, it.scale * 1.00),
        },
        {
          offset: 0.88,
          opacity: 0,
          filter: `blur(${Math.max(10, it.blurStart * 0.45)}px) contrast(1.12)`,
          clipPath: pRect,
          transform: base(it.dx, it.dy, it.r1, it.scale * 1.00),
        },
        {
          offset: 1,
          opacity: 0,
          filter: `blur(${it.blurStart}px) contrast(1.18)`,
          clipPath: pSmall,
          transform: base(0, 0, it.r0, it.scale * 0.72), // reset state
        },
      ];
  
      it.el.animate(kf, {
        duration: LOOP_MS,
        iterations: Infinity,
        delay: it.delayS * 1000, // negative stagger starts them in-progress
        easing: "linear",
        fill: "both",
      });
  
      // Optional micro “float” wobble (cheap + nice, low glitch risk)
      // Separate transform animation can fight with the main one, so we do it as filter-only “shimmer”.
      it.el.animate(
        [
          { filter: `blur(${it.blurSettle}px) contrast(1.06)` },
          { filter: `blur(${it.blurSettle + 0.6}px) contrast(1.08)` },
          { filter: `blur(${it.blurSettle}px) contrast(1.06)` },
        ],
        {
          duration: (8 + Math.random() * 10) * 1000,
          iterations: Infinity,
          delay: -Math.random() * 5000,
          easing: "ease-in-out",
        }
      );
    });
  })();
  
  /* =========================
     MUSIC (UPDATED ONLY)
     Persists across pages by saving time + muted state in localStorage.
     Everything else unchanged.
     ========================= */
  
  document.addEventListener("DOMContentLoaded", () => {
    const bgm = document.getElementById("bgm");
    const toggle = document.querySelector(".audio-toggle");
    const state = document.querySelector(".audio-toggle__state");
    if (!bgm || !toggle || !state) return;
  
    const KEY = "bgm-state-v1";
  
    bgm.loop = true;
    bgm.volume = 0.7;
  
    // restore
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
  
      if (typeof saved.time === "number" && isFinite(saved.time)) {
        // set after metadata if needed
        const setTime = () => {
          try { bgm.currentTime = saved.time; } catch (_) {}
        };
        if (bgm.readyState >= 1) setTime();
        else bgm.addEventListener("loadedmetadata", setTime, { once: true });
      }
  
      if (typeof saved.muted === "boolean") {
        bgm.muted = saved.muted;
      } else {
        bgm.muted = true; // default off until user turns on
      }
    } catch (_) {
      bgm.muted = true;
    }
  
    const update = () => (state.textContent = bgm.muted ? "off" : "on");
    update();
  
    const save = () => {
      try {
        localStorage.setItem(
          KEY,
          JSON.stringify({
            time: bgm.currentTime || 0,
            muted: bgm.muted,
          })
        );
      } catch (_) {}
    };
  
    // try muted autoplay (often allowed)
    bgm.play().catch(() => {});
    save();
  
    const turnOn = async () => {
      bgm.muted = false;
      try {
        await bgm.play();
      } catch (e) {}
      update();
      save();
    };
  
    const turnOff = () => {
      bgm.muted = true;
      update();
      save();
    };
  
    const toggleSound = () => (bgm.muted ? turnOn() : turnOff());
  
    toggle.addEventListener("click", toggleSound);
    toggle.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") toggleSound();
    });
  
    // keep time updated so page changes feel continuous
    bgm.addEventListener("timeupdate", save);
    bgm.addEventListener("pause", save);
    bgm.addEventListener("play", save);
  
    // ensure state is saved right before navigation/refresh
    window.addEventListener("pagehide", save);
    window.addEventListener("beforeunload", save);
  });
  
  /* =========================
     EVERYTHING BELOW UNCHANGED
     (kept exactly as you had it)
     ========================= */
  
  document.addEventListener("DOMContentLoaded", () => {
    const imgs = [...document.querySelectorAll(".underlay__img")];
    if (!imgs.length) return;
  
    const rand = (a, b) => a + Math.random() * (b - a);
    const vw = (n) => `${n.toFixed(2)}vw`;
    const vh = (n) => `${n.toFixed(2)}vh`;
    const px = (n) => `${n.toFixed(0)}px`;
    const deg = (n) => `${n.toFixed(1)}deg`;
    const sec = (n) => `${n.toFixed(2)}s`;
  
    function seed(el, i) {
      const u = rand(0.12, 0.24);
      const lifeDur = rand(18, 42);
      const delay = -rand(0, lifeDur); // start mid-cycle
  
      el.style.setProperty("--u", u.toFixed(3));
      el.style.setProperty("--lifeDur", sec(lifeDur));
      el.style.setProperty("--delay", sec(delay));
  
      el.style.setProperty("--tx", vw(rand(-22, 22)));
      el.style.setProperty("--ty", vh(rand(-18, 18)));
      el.style.setProperty("--dx", px(rand(-340, 340)));
      el.style.setProperty("--dy", px(rand(-340, 340)));
  
      el.style.setProperty("--s", rand(0.74, 0.98).toFixed(3));
      el.style.setProperty("--r", deg(rand(-6, 6)));
  
      el.style.setProperty("--ox", `${rand(10, 90).toFixed(1)}%`);
      el.style.setProperty("--oy", `${rand(10, 90).toFixed(1)}%`);
  
      el.style.setProperty("--dir", Math.random() < 0.5 ? -1 : 1);
      el.style.setProperty("--rotDur", sec(rand(220, 560)));
  
      el.style.zIndex = String(10 + i);
    }
  
    imgs.forEach(seed);
  
    imgs.forEach((img, i) => {
      img.addEventListener("animationiteration", (e) => {
        if (e.animationName !== "underlayLife") return;
        seed(img, i);
  
        // force restart (prevents rare stuck states)
        img.style.animation = "none";
        void img.offsetHeight;
        img.style.animation = "";
      });
    });
  });

  
  /* =========================================================
   PAGE-SPECIFIC LOGIC (INDEX + MAP)
   Moved from inline <script> blocks
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =========================
       INDEX PAGE: "TAKE MAP" BUTTON
       ========================= */
    const openMapBtn = document.getElementById("openMap");
    if (openMapBtn) {
      openMapBtn.addEventListener("click", () => {
        // audio state is already saved by the music system
        window.location.href = "map.html";
      });
    }
  
    /* =========================
       MAP PAGE: BACKGROUND VIDEO
       ========================= */
    const bgVideo = document.getElementById("bgVideo");
    if (bgVideo) {
      bgVideo.addEventListener("error", () => {
        console.log("VIDEO ERROR:", bgVideo.error);
      });
  
      bgVideo.addEventListener("loadedmetadata", async () => {
        bgVideo.currentTime = 54;
        try {
          await bgVideo.play();
        } catch (e) {
          console.log("play blocked:", e);
        }
      });
    }
  
  });
  
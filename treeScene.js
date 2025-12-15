(() => {
    const canvas = document.getElementById("renderCanvas");
    const engine = new BABYLON.Engine(canvas, true, {
      alpha: true,
      preserveDrawingBuffer: true,
      stencil: true,
    });
    const PIXEL_SCALE = 2.8; // start subtle
    engine.setHardwareScalingLevel(PIXEL_SCALE);
    
  
    const scene = new BABYLON.Scene(engine);

    
  
    // No Babylon background (CSS black shows through)
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
    scene.fogMode = BABYLON.Scene.FOGMODE_NONE;
  
    // -----------------------------
    // Camera: orthographic (flat)
    // -----------------------------
    const camera = new BABYLON.FreeCamera("cam", new BABYLON.Vector3(0, 0, -10), scene);
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
  
    function updateOrtho() {
      const aspect = engine.getRenderWidth() / engine.getRenderHeight();
  
      // Optional: CSS-driven scaling via --tree-scale
      const cssScaleRaw = getComputedStyle(document.documentElement)
        .getPropertyValue("--tree-scale")
        .trim();
      const cssScale = parseFloat(cssScaleRaw) || 1;
  
      const baseSize = 10;
      const size = baseSize / cssScale;
  
      camera.orthoLeft = -size * aspect;
      camera.orthoRight = size * aspect;
      camera.orthoTop = size;
      camera.orthoBottom = -size;
    }
    updateOrtho();
  
    // Minimal light (lines don’t need it, but harmless)
    const hemi = new BABYLON.HemisphericLight("h", new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity = 0.02;
  
    // -----------------------------
    // Tree root (anchored base sway)
    // -----------------------------
    const treeRoot = new BABYLON.TransformNode("treeRoot", scene);
    treeRoot.position.y = -2.45;

    const BASE_TREE_Y = -8.5;

function readTreeOffset() {
  const styles = getComputedStyle(document.documentElement);
  const offsetY = parseFloat(styles.getPropertyValue("--tree-offset-y")) || 0;
  treeRoot.position.y = BASE_TREE_Y + offsetY;
}

readTreeOffset();
window.addEventListener("resize", readTreeOffset);


  
    // Rotate around base (bottom stays still)
    treeRoot.setPivotPoint(new BABYLON.Vector3(0, 0, 0));

    // --- Scroll zoom (base stays pinned) ---
const BASE_LOCAL = new BABYLON.Vector3(0, 0, 0); // base point in treeRoot local space (pivot)
let scrollZoom = 1.0;

// Where the base currently is in screen space (we lock to this)
let baseScreenLock = null;

function projectToScreen(worldPos) {
  const vp = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
  const p = BABYLON.Vector3.Project(
    worldPos,
    BABYLON.Matrix.Identity(),
    scene.getTransformMatrix(),
    vp
  );
  return new BABYLON.Vector2(p.x, p.y);
}

function unprojectFromScreen(screenPos, worldZ = 0) {
  const vp = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
  const world = BABYLON.Vector3.Unproject(
    new BABYLON.Vector3(screenPos.x, screenPos.y, 0),
    engine.getRenderWidth(),
    engine.getRenderHeight(),
    BABYLON.Matrix.Identity(),
    scene.getTransformMatrix(),
    vp
  );
  // keep on your z plane
  world.z = worldZ;
  return world;
}

function applyTreeZoomKeepingBasePinned() {
  // compute current base world pos (before changes)
  const baseWorld = treeRoot.getAbsolutePosition(); // because BASE_LOCAL is (0,0,0) at pivot

  // establish lock point once (and re-establish on resize)
  if (!baseScreenLock) baseScreenLock = projectToScreen(baseWorld);

  // apply scale
  treeRoot.scaling.setAll(scrollZoom);

  // after scaling, move treeRoot so base returns to locked screen position
  const desiredWorldAtLock = unprojectFromScreen(baseScreenLock, treeRoot.position.z);

  // since base is at treeRoot origin/pivot, just move the root to that world point
  treeRoot.position.x = desiredWorldAtLock.x;
  treeRoot.position.y = desiredWorldAtLock.y;
}

  
    // -----------------------------
    // Utils
    // -----------------------------
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const hash = (x) => {
      const s = Math.sin(x * 127.1) * 43758.5453;
      return s - Math.floor(s);
    };
    function snapToPixel(v, scale) {
        return new BABYLON.Vector3(
          Math.round(v.x * scale) / scale,
          Math.round(v.y * scale) / scale,
          v.z
        );
      }
  
    // -----------------------------
    // Procedural ornate dead tree (LINES)
    // -----------------------------
    const SETTINGS = {
      depth: 8,
      trunkLen: 3.8,
      baseSplitChance: 0.9,
      sproutAlongChance: 0.86,
      twigSprayChance: 0.96,
      droop: 0.2,
      bend: 0.22,
      chaos: 0.26,
    };
  
    function growBranch({ start, len, angle, depth, seed }) {
      const pts = [start.clone()];
      const steps = 10 + Math.floor(hash(seed + 10.0) * 10);
      let p = start.clone();
  
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const curv = SETTINGS.bend * (t * t);
        const droop = -SETTINGS.droop * (t * t);
        const j = (hash(seed + i * 3.17) - 0.5) * SETTINGS.chaos;
  
        const a = angle + curv + droop + j * 0.35;
        const step = len / steps;
  
        p = p.add(new BABYLON.Vector3(Math.cos(a) * step, Math.sin(a) * step, 0));
        pts.push(p.clone());
      }
  
      const out = [{ pts, depth, seed }];
      if (depth <= 0) return out;
  
      const tip = pts[pts.length - 1];
  
      const splitChance = clamp(
        SETTINGS.baseSplitChance - (SETTINGS.depth - depth) * 0.06,
        0.35,
        0.95
      );
      const doSplit = hash(seed + 200.0) < splitChance;
  
      const childLen = len * (0.54 + hash(seed + 300.0) * 0.2);
      const spread = 0.6 + hash(seed + 400.0) * 0.6;
  
      if (doSplit) {
        out.push(
          ...growBranch({
            start: tip,
            len: childLen,
            angle: angle + spread,
            depth: depth - 1,
            seed: seed + 1.11,
          })
        );
        out.push(
          ...growBranch({
            start: tip,
            len: childLen * (0.86 + hash(seed + 500.0) * 0.18),
            angle: angle - spread * (0.85 + hash(seed + 600.0) * 0.25),
            depth: depth - 1,
            seed: seed + 2.22,
          })
        );
      } else {
        out.push(
          ...growBranch({
            start: tip,
            len: childLen,
            angle: angle + (hash(seed + 700.0) - 0.5) * 0.55,
            depth: depth - 1,
            seed: seed + 3.33,
          })
        );
      }
  
      // Twigs along branches
      const sprayCount = 2 + Math.floor(hash(seed + 800.0) * 5);
      for (let k = 0; k < sprayCount; k++) {
        if (hash(seed + 900.0 + k) < SETTINGS.sproutAlongChance) {
          const idx = Math.floor(pts.length * (0.22 + hash(seed + 1000.0 + k) * 0.62));
          const mid = pts[clamp(idx, 2, pts.length - 2)];
  
          const twigLen = len * (0.16 + hash(seed + 1100.0 + k) * 0.28);
          const twigAng =
            angle +
            (hash(seed + 1200.0 + k) - 0.5) * (1.35 + (SETTINGS.depth - depth) * 0.22) -
            SETTINGS.droop * 0.65;
  
          if (hash(seed + 1300.0 + k) < SETTINGS.twigSprayChance) {
            out.push(
              ...growBranch({
                start: mid,
                len: twigLen,
                angle: twigAng,
                depth: depth - 2,
                seed: seed + 10.0 + k * 0.77,
              })
            );
          }
        }
      }
  
      return out;
    }
  
    const trunkStart = new BABYLON.Vector3(0, 0, 0);
    const branchData = growBranch({
      start: trunkStart,
      len: SETTINGS.trunkLen,
      angle: Math.PI / 2,
      depth: SETTINGS.depth,
      seed: 1.2345,
    });
  
    const baseLines = branchData.map((b) => b.pts.map((p) => p.clone()));
  
    // Weight: 0 at bottom -> 1 at top
    const lineWeights = baseLines.map((line) =>
      line.map((p) => clamp((p.y - trunkStart.y) / SETTINGS.trunkLen, 0, 1))
    );
  
    // Lock base: no per-point motion below this fraction of height
    function anchoredWeight(w) {
      const deadZone = 0.10; // smaller = more motion overall
      if (w < deadZone) return 0;
      const t = (w - deadZone) / (1 - deadZone);
      return t * t; // ease-in
    }
  
    function createInkLineSystem(name, lines, color3, alpha, parent) {
      const mesh = BABYLON.MeshBuilder.CreateLineSystem(name, { lines, updatable: true }, scene);
      mesh.color = color3;
      mesh.alpha = alpha;
      mesh.parent = parent;
      return mesh;
    }
  
    function updateLineSystem(mesh, linesNow) {
      BABYLON.MeshBuilder.CreateLineSystem(null, { lines: linesNow, instance: mesh }, scene);
    }
  
    // White tree (multi-pass)
    const inkMain = createInkLineSystem(
      "inkMain",
      baseLines.map((l) => l.map((p) => p.clone())),
      new BABYLON.Color3(0.95, 0.95, 0.95),
      1.0,
      treeRoot
    );
    const bleed1 = createInkLineSystem(
      "bleed1",
      baseLines.map((l) => l.map((p) => p.clone())),
      new BABYLON.Color3(0.9, 0.9, 0.9),
      0.38,
      treeRoot
    );
    const bleed2 = createInkLineSystem(
      "bleed2",
      baseLines.map((l) => l.map((p) => p.clone())),
      new BABYLON.Color3(0.85, 0.85, 0.85),
      0.18,
      treeRoot
    );
  
    // -----------------------------
    // Bottom WHITE haze (STATIC)
    // - Not parented to treeRoot
    // - Not updated each frame
    // -----------------------------
    const hazeBase = baseLines.map((line, li) =>
      line.map((p, pi) => {
        const w = lineWeights[li][pi];
        const fade = 1.0 - w;
  
        // Place haze in world space near the bottom of the tree
        const yBand = treeRoot.position.y + (-0.12 + p.y * 0.05);
        const xSmear = p.x * 1.05 + 0.22;
  
        return new BABYLON.Vector3(xSmear * (0.85 + fade * 0.15), yBand, 0);
      })
    );
  
    const haze = BABYLON.MeshBuilder.CreateLineSystem(
      "haze",
      { lines: hazeBase.map((l) => l.map((p) => p.clone())), updatable: false },
      scene
    );
    haze.color = new BABYLON.Color3(1.0, 1.0, 1.0);
    haze.alpha = 0.14;
  
    // -----------------------------
    // Crows (super slow + subtle)
    // -----------------------------
    function createCrow() {
      const wingSpan = 0.12;
      const lines = [[
        new BABYLON.Vector3(-wingSpan, 0, 0),
        new BABYLON.Vector3(0, -0.02, 0),
        new BABYLON.Vector3(wingSpan, 0, 0),
      ]];
      const crow = BABYLON.MeshBuilder.CreateLineSystem("crow", { lines, updatable: true }, scene);
      crow.color = new BABYLON.Color3(0.95, 0.95, 0.95);
      crow.alpha = 0.85;
      crow.parent = treeRoot;
      return crow;
    }
  
    const perchPoints = baseLines
      .map((line) => line[Math.floor(line.length * 0.86)])
      .filter((p) => p.y > 1.1);
  
    const crows = [];
    const CROW_COUNT = 50;
  
    function randomPerch() {
      return perchPoints[Math.floor(Math.random() * perchPoints.length)].clone();
    }
  
    for (let i = 0; i < CROW_COUNT; i++) {
      const crow = createCrow();
      crow.scaling.setAll(0.85 + Math.random() * 0.35);
  
      const perch = randomPerch();
      crow.position.copyFrom(perch);
      crow.rotation.z = (Math.random() - 0.5) * 0.25;
  
      crow.userData = {
        state: "perched",
        timer: Math.random() * 9,
        t: 0,
        from: perch.clone(),
        to: perch.clone(),
        phase: Math.random() * Math.PI * 2,
      };
  
      crows.push(crow);
    }
  
    // -----------------------------
    // Animation
    // -----------------------------
    let t = 0;
  
    scene.onBeforeRenderObservable.add(() => {
      const dt = engine.getDeltaTime() * 0.001;
      t += dt;
  
      // Global sway around base (bottom stays fixed)
      treeRoot.rotation.z = Math.sin(t * 0.14) * 0.12;  

  
      // Per-point wind (base locked by anchoredWeight)
      const mainNow = baseLines.map((line, li) =>
        line.map((p0, pi) => {
          const w0 = lineWeights[li][pi];
          const w = anchoredWeight(w0);
  
          const trem = Math.sin(t * 0.9 + li * 0.7 + pi * 0.35) * 0.003 * w;
          const wind = Math.sin(t * 0.18 + p0.y * 1.2) * 0.07 * w;
  
          return new BABYLON.Vector3(p0.x + wind + trem, p0.y, 0);
        })
      );
  
      const b1 = mainNow.map((line, li) =>
        line.map((p, pi) => {
          const o = Math.sin(t * 0.22 + li) * 0.01 + (hash(li * 10 + pi) - 0.5) * 0.006;
          return new BABYLON.Vector3(p.x + o, p.y + o * 0.35, 0);
        })
      );
  
      const b2 = mainNow.map((line, li) =>
        line.map((p, pi) => {
          const o =
            Math.cos(t * 0.19 + li * 0.8) * 0.016 + (hash(li * 20 + pi * 2) - 0.5) * 0.008;
          return new BABYLON.Vector3(p.x - o, p.y + o * 0.2, 0);
        })
      );
  
      updateLineSystem(inkMain, mainNow);
      updateLineSystem(bleed1, b1);
      updateLineSystem(bleed2, b2);
  
      // Crows: rare takeoff + slow glide + land
      crows.forEach((crow) => {
        const d = crow.userData;
        d.timer += dt;
  
        if (d.state === "perched") {
          crow.rotation.z += Math.sin(t * 0.6 + d.phase) * 0.0006;
  
          if (d.timer > 7 + Math.random() * 10) {
            d.state = "flying";
            d.timer = 0;
            d.t = 0;
            d.from = crow.position.clone();
            d.to = randomPerch();
          }
        } else if (d.state === "flying") {
          d.t += dt * 0.12; // ~8–10s flight
          const tt = Math.min(d.t, 1);
  
          const midY = Math.max(d.from.y, d.to.y) + 0.7;
          const x = BABYLON.Scalar.Lerp(d.from.x, d.to.x, tt);
          const y = BABYLON.Scalar.Lerp(
            BABYLON.Scalar.Lerp(d.from.y, midY, tt),
            BABYLON.Scalar.Lerp(midY, d.to.y, tt),
            tt
          );
  
          crow.position.x = x;
          crow.position.y = y;
  
          crow.rotation.z = Math.sin(tt * Math.PI) * 0.35;
          crow.alpha = 0.75 + Math.sin(tt * Math.PI) * 0.10;
  
          if (tt >= 1) {
            d.state = "perched";
            d.timer = 0;
            crow.alpha = 0.85;
            crow.rotation.z = (Math.random() - 0.5) * 0.25;
          }
        }
      });
    });
    
  
    // -----------------------------
    // Render / resize
    // -----------------------------
    engine.runRenderLoop(() => scene.render());
  
    window.addEventListener("resize", () => {
      engine.resize();
      engine.setHardwareScalingLevel(PIXEL_SCALE);
      updateOrtho();
    });
  })();
  
"use strict";

const DATA = {};
const TRACK_AREA = {
  common: "Alles",
  technik: "Technik",
  netzbau: "Netzbau",
  "engineering-akquise": "Engineering/Akquise",
  freileitung: "Netzbau",
  kabelauszug: "Netzbau",
  elektroverteilnetz: "Netzbau",
  leadership: "Führung Allgemein",
  "special-roles": "Funktionsübergreifend"
};
const TRACK_ORDER = ["netzbau", "technik", "engineering-akquise", "leadership", "special-roles"];
const SOURCE_LEVEL = { "Level 1": "L1", "Level 1 (ext)": "L0", "Level 1 / Level 2": "L1", "Level 2": "L2", "Level 3": "L3", "Level3": "L3" };

async function loadData() {
  const files = ["modules", "tracks", "assignments", "connections", "taxonomy"];
  const responses = await Promise.all(files.map(name => fetch(`data/${name}.json`)));
  responses.forEach((response, index) => {
    if (!response.ok) throw new Error(`${files[index]}.json konnte nicht geladen werden.`);
  });
  const values = await Promise.all(responses.map(response => response.json()));
  files.forEach((name, index) => { DATA[name] = values[index]; });
}

function assignmentFor(moduleId, trackId) {
  return DATA.assignments.assignments.find(item => item.moduleId === moduleId && item.trackId === trackId)
    || DATA.assignments.assignments.find(item => item.moduleId === moduleId && item.trackId === "common")
    || null;
}

function decisionGroup(assignment) {
  if (!assignment) return "source";
  return /confirmed/.test(assignment.decisionStatus) ? "confirmed" : "review";
}

function effectiveLevel(module, assignment) {
  return assignment?.level || SOURCE_LEVEL[module.sourceLevel] || "L1";
}

function moduleType(module, assignment) {
  const text = `${module.category} ${module.title} ${(assignment?.owners || []).join(" ")}`.toLowerCase();
  if (text.includes("sga") || text.includes("elektro")) return "sga";
  if (module.draft || text.includes("spezial") || text.includes("rolle")) return "special";
  return "fach";
}

function modulesForTrack(trackId) {
  const area = TRACK_AREA[trackId];
  const canonicalIds = DATA.assignments.assignments.filter(a => a.trackId === trackId || a.trackId === "common").map(a => a.moduleId);
  const trackChildren = DATA.tracks.tracks.filter(t => t.parentTrackId === trackId).map(t => t.id);
  const childIds = DATA.assignments.assignments.filter(a => trackChildren.includes(a.trackId)).map(a => a.moduleId);
  const sourceMatches = DATA.modules.modules.filter(module => {
    if (trackId === "special-roles") return module.category?.toLowerCase().includes("spezialrolle");
    if (trackId === "leadership") return module.subjectAreas.includes("Führung Allgemein") || /Führung|Vorgesetzter/.test(module.title);
    return module.subjectAreas.includes(area) || module.subjectAreas.includes("Alles");
  }).map(module => module.id);
  const ids = new Set([...canonicalIds, ...childIds, ...sourceMatches]);
  return DATA.modules.modules.filter(module => ids.has(module.id));
}

function wrapTitle(title, max = 18) {
  const words = title.split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach(word => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) { lines.push(line); line = word; }
    else line = next;
  });
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function renderControls() {
  const root = document.getElementById("track-controls");
  TRACK_ORDER.forEach((id, index) => {
    const track = DATA.tracks.tracks.find(item => item.id === id);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = track.title;
    button.dataset.track = id;
    button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
    button.addEventListener("click", () => selectTrack(id));
    root.append(button);
  });
}

function selectTrack(trackId) {
  document.querySelectorAll("[data-track]").forEach(button => {
    button.setAttribute("aria-pressed", button.dataset.track === trackId ? "true" : "false");
  });
  renderSkilltree(trackId);
}

function svgElement(name, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function renderSkilltree(trackId) {
  const svg = document.getElementById("skilltree");
  svg.replaceChildren();
  const center = { x: 600, y: 410 };
  const rings = {
    L0: { rx: 135, ry: 65 },
    L1: { rx: 285, ry: 145 },
    L2: { rx: 430, ry: 230 },
    L3: { rx: 550, ry: 315 }
  };
  Object.values(rings).reverse().forEach((ring, index) => {
    svg.append(svgElement("ellipse", { cx: center.x, cy: center.y, rx: ring.rx, ry: ring.ry, class: index === 3 ? "skill-ring glow" : "skill-ring" }));
    svg.append(svgElement("ellipse", { cx: center.x, cy: center.y + 8, rx: ring.rx, ry: ring.ry, class: "skill-ring", opacity: ".38" }));
  });

  const modules = modulesForTrack(trackId);
  const grouped = { L0: [], L1: [], L2: [], L3: [] };
  modules.forEach(module => {
    const assignment = assignmentFor(module.id, trackId);
    grouped[effectiveLevel(module, assignment)].push({ module, assignment });
  });

  const positions = new Map();
  Object.entries(grouped).forEach(([level, items]) => {
    const ring = rings[level];
    const count = items.length;
    items.forEach((item, index) => {
      const start = level === "L0" ? Math.PI * .15 : Math.PI * 1.04;
      const range = level === "L0" ? Math.PI * .7 : Math.PI * 1.92;
      const angle = count === 1 ? -Math.PI / 2 : start + (range * index / Math.max(1, count - 1));
      positions.set(item.module.id, {
        x: center.x + Math.cos(angle) * ring.rx,
        y: center.y + Math.sin(angle) * ring.ry,
        level
      });
    });
  });

  DATA.connections.connections.forEach(connection => {
    const from = positions.get(connection.fromModuleId);
    const to = positions.get(connection.toModuleId);
    if (!from || !to) return;
    const path = svgElement("path", {
      d: `M${from.x},${from.y} Q${center.x},${center.y} ${to.x},${to.y}`,
      class: `skill-link ${/concept/.test(connection.status) ? "draft" : ""}`
    });
    svg.append(path);
  });

  Object.values(grouped).flat().forEach(({ module, assignment }) => {
    const position = positions.get(module.id);
    const group = svgElement("g", {
      class: "skill-node",
      role: "button",
      tabindex: "0",
      transform: `translate(${position.x} ${position.y})`,
      "data-module": module.id,
      "aria-label": module.title
    });
    const type = moduleType(module, assignment);
    const state = decisionGroup(assignment);
    group.classList.add(type, state === "review" ? "review" : "source");
    group.append(svgElement("circle", {
      class: "node-halo",
      r: position.level === "L0" ? "57" : "49"
    }));
    group.append(svgElement("circle", {
      class: "node-core",
      r: position.level === "L0" ? "49" : "42"
    }));
    const title = svgElement("text", {
      class: "node-title",
      "text-anchor": "middle"
    });
    const lines = wrapTitle(module.title, position.level === "L0" ? 19 : 16);
    lines.forEach((line, index) => {
      const tspan = svgElement("tspan", { x: "0", dy: index === 0 ? `${-((lines.length - 1) * 8)}` : "17" });
      tspan.textContent = line;
      title.append(tspan);
    });
    group.append(title);
    const code = svgElement("text", {
      class: "node-code",
      "text-anchor": "middle"
    });
    code.setAttribute("y", `${29 + Math.max(0, lines.length - 2) * 4}`);
    code.textContent = [effectiveLevel(module, assignment), assignment?.requirement, assignment?.deadline].filter(Boolean).join(" · ");
    group.append(code);
    group.addEventListener("click", () => showModule(module, assignment, group));
    group.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); showModule(module, assignment, group); }
    });
    svg.append(group);
  });

  const preferred = grouped.L1[0] || grouped.L0[0] || grouped.L2[0] || grouped.L3[0];
  if (preferred) {
    const group = svg.querySelector(`[data-module="${CSS.escape(preferred.module.id)}"]`);
    showModule(preferred.module, preferred.assignment, group);
  }
}

function taxonomyLabel(group, code, fallback = "Nicht festgelegt") {
  return code ? (DATA.taxonomy[group]?.[code] || code) : fallback;
}

function showModule(module, assignment, group) {
  document.querySelectorAll(".skill-node.selected").forEach(node => node.classList.remove("selected"));
  group?.classList.add("selected");
  const status = decisionGroup(assignment);
  document.getElementById("detail-id").textContent = module.id;
  document.getElementById("detail-name").textContent = module.title;
  document.getElementById("detail-description").textContent = assignment?.decisionNote || assignment?.reviewNote || module.targetGroupSource || module.category;
  document.getElementById("detail-level").textContent = `${effectiveLevel(module, assignment)} · ${taxonomyLabel("levels", effectiveLevel(module, assignment))}`;
  document.getElementById("detail-requirement").textContent = taxonomyLabel("requirements", assignment?.requirement);
  document.getElementById("detail-deadline").textContent = taxonomyLabel("deadlines", assignment?.deadline);
  document.getElementById("detail-restriction").textContent = taxonomyLabel("restrictions", assignment?.restriction);
  document.getElementById("detail-owner").textContent = assignment?.owners?.map(owner => DATA.taxonomy.owners[owner] || owner).join(", ") || "Fachverantwortung noch zu klären";
  document.getElementById("detail-status").textContent = status === "confirmed" ? "Bestätigt" : status === "review" ? "Entwurf / fachlich zu prüfen" : "Aus Rohquelle übernommen";
}

function renderFilters() {
  const select = document.getElementById("area-filter");
  const areas = [...new Set(DATA.modules.modules.flatMap(module => module.subjectAreas))].sort((a, b) => a.localeCompare(b, "de"));
  areas.forEach(area => {
    const option = document.createElement("option");
    option.value = area;
    option.textContent = area;
    select.append(option);
  });
  ["search", "area-filter", "level-filter", "status-filter"].forEach(id => {
    document.getElementById(id).addEventListener("input", renderCatalogue);
    document.getElementById(id).addEventListener("change", renderCatalogue);
  });
}

function renderCatalogue() {
  const query = document.getElementById("search").value.trim().toLowerCase();
  const area = document.getElementById("area-filter").value;
  const level = document.getElementById("level-filter").value;
  const status = document.getElementById("status-filter").value;
  const rows = document.getElementById("module-rows");
  rows.replaceChildren();
  const filtered = DATA.modules.modules.filter(module => {
    const assignments = DATA.assignments.assignments.filter(item => item.moduleId === module.id);
    const canonical = assignments[0] || null;
    const haystack = `${module.id} ${module.title} ${module.category} ${module.subjectAreas.join(" ")}`.toLowerCase();
    const moduleStatus = assignments.some(a => decisionGroup(a) === "confirmed") ? "confirmed" : assignments.length ? "review" : "source";
    return (!query || haystack.includes(query))
      && (!area || module.subjectAreas.includes(area))
      && (!level || effectiveLevel(module, canonical) === level)
      && (!status || moduleStatus === status);
  });
  filtered.forEach(module => {
    const assignments = DATA.assignments.assignments.filter(item => item.moduleId === module.id);
    const canonical = assignments[0] || null;
    const state = assignments.some(a => decisionGroup(a) === "confirmed") ? "confirmed" : assignments.length ? "review" : "source";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(module.id)}</strong></td>
      <td>${escapeHtml(module.title)}${module.draft ? ' <span class="tag review">Entwurf</span>' : ""}</td>
      <td>${escapeHtml(effectiveLevel(module, canonical))}</td>
      <td>${module.subjectAreas.map(item => `<span class="tag">${escapeHtml(item)}</span>`).join("")}</td>
      <td>${module.durationHours ?? "offen"}${module.durationHours ? " h" : ""}</td>
      <td><span class="tag ${state}">${state === "confirmed" ? "bestätigt" : state === "review" ? "Prüfung" : "Rohquelle"}</span></td>`;
    tr.addEventListener("click", () => {
      const track = assignments[0]?.trackId;
      if (track && TRACK_ORDER.includes(track)) {
        selectTrack(track);
        document.getElementById("lernwelt").scrollIntoView({ behavior: "smooth" });
      }
    });
    rows.append(tr);
  });
  document.getElementById("result-count").textContent = `${filtered.length} von ${DATA.modules.modules.length} Modulen`;
}

function renderCodes() {
  const root = document.getElementById("code-legend");
  [
    ...Object.entries(DATA.taxonomy.requirements),
    ...Object.entries(DATA.taxonomy.deadlines),
    ...Object.entries(DATA.taxonomy.restrictions)
  ].forEach(([code, label]) => {
    const span = document.createElement("span");
    span.textContent = `${code} · ${label}`;
    root.append(span);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

async function init() {
  try {
    await loadData();
    renderControls();
    renderFilters();
    renderCodes();
    renderCatalogue();
    selectTrack("netzbau");
  } catch (error) {
    document.querySelector("main").insertAdjacentHTML("afterbegin", `<p class="error">Die Ausbildungsdaten konnten nicht geladen werden: ${escapeHtml(error.message)}</p>`);
  }
}

init();

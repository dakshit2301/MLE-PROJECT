/*
Purpose: Start the local app, route pages, and manage global UI.
Inputs: Page modules, local JSON loading, and user navigation events.
Outputs: The active page, theme state, and shared error feedback.
*/
import { DataLoadError, loadJSON, loadAll } from "./data.js";
import { el, toast } from "./ui.js";
import { applyChartTheme } from "./charts.js";

const routes = {
  home: { title: "Home", module: () => import("./pages/home.js") },
  predict: { title: "Predict", module: () => import("./pages/playground.js") },
  explore: { title: "Explore", module: () => import("./pages/explorer.js") },
  models: { title: "Models", module: () => import("./pages/models.js") },
  importance: { title: "Importance", module: () => import("./pages/importance.js") },
  errors: { title: "Errors", module: () => import("./pages/errors.js") },
  method: { title: "Method", module: () => import("./pages/method.js") },
  viva: { title: "Viva", module: () => import("./pages/viva.js") },
};

const galleryRoute = { title: "Component gallery", module: () => import("./pages/gallery.js") };
const pageCache = new Map();
const main = document.getElementById("main");
const themeToggle = document.getElementById("theme-toggle");
const header = document.getElementById("site-header");
const moreSheet = document.getElementById("more-sheet");
let activePage = null;
let navigationVersion = 0;

function errorCard(error) {
  const message = error instanceof Error ? error.message : String(error);
  const hint = error instanceof DataLoadError
    ? `${error.command} (from the frontend folder)`
    : "Try reloading this page. The original error is shown above.";
  return el("section", { className: "error-card", role: "alert" },
    el("span", { className: "empty-state__icon", text: "!", "aria-hidden": "true" }),
    el("h1", { className: "page-shell__title", text: "This page could not load" }),
    el("p", { className: "page-shell__purpose", text: message }),
    el("code", { className: "error-card__hint", text: hint }),
  );
}

function showError(error) {
  console.error(error);
  if (main) main.replaceChildren(errorCard(error));
  document.title = "Page error — Study Lab";
}

function currentRoute() {
  const name = window.location.hash.replace(/^#\/?/, "").split(/[?&]/, 1)[0];
  if (name === "gallery") {
    return new URLSearchParams(window.location.search).get("dev") === "1"
      ? "gallery"
      : "home";
  }
  return Object.hasOwn(routes, name) ? name : "home";
}

function updateNavigation(route) {
  document.querySelectorAll("[data-route]").forEach((link) => {
    const selected = link.dataset.route === route;
    if (selected) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const moreButton = document.querySelector("[data-open-more]");
  if (moreButton) {
    const isMore = ["importance", "errors", "method", "viva"].includes(route);
    if (isMore) moreButton.setAttribute("aria-current", "page");
    else moreButton.removeAttribute("aria-current");
  }
}

async function getPage(route) {
  if (pageCache.has(route)) return pageCache.get(route);
  const descriptor = route === "gallery" ? galleryRoute : routes[route];
  const promise = descriptor.module();
  pageCache.set(route, promise);
  try {
    return await promise;
  } catch (error) {
    pageCache.delete(route);
    throw error;
  }
}

async function navigate() {
  const version = ++navigationVersion;
  let route = currentRoute();
  if (!window.location.hash || (route === "home" && !window.location.hash.endsWith("/home"))) {
    if (!window.location.hash || !Object.hasOwn(routes, window.location.hash.replace(/^#\/?/, ""))) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/home`);
    }
  }
  if (route === "gallery" && new URLSearchParams(window.location.search).get("dev") !== "1") {
    route = "home";
  }

  try {
    if (activePage?.destroy) activePage.destroy();
    activePage = null;
    updateNavigation(route);
    const page = await getPage(route);
    if (version !== navigationVersion) return;
    activePage = page;
    await page.render(main, { route, loadJSON, loadAll, el, toast });
    const title = route === "gallery" ? galleryRoute.title : routes[route].title;
    document.title = `${title} — Study Lab`;
    window.scrollTo({ top: 0, behavior: "smooth" });
    main.focus({ preventScroll: true });
    if (moreSheet?.open) moreSheet.close();
    main.focus({ preventScroll: true });
  } catch (error) {
    if (version === navigationVersion) showError(error);
  }
}

function setTheme(theme, persist = true) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  themeToggle?.setAttribute(
    "aria-label",
    `Switch to ${next === "dark" ? "light" : "dark"} theme`,
  );
  themeToggle?.setAttribute(
    "title",
    `Switch to ${next === "dark" ? "light" : "dark"} theme`,
  );
  if (persist) {
    try {
      localStorage.setItem("study-lab-theme", next);
    } catch (error) {
      console.warn("Theme preference could not be saved in this browser.", error);
    }
  }
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: next } }));
  applyChartTheme();
}

function wireThemeToggle() {
  themeToggle?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
  });
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (event) => {
    let stored = "";
    try {
      stored = localStorage.getItem("study-lab-theme") ?? "";
    } catch {
      stored = "";
    }
    if (!stored) setTheme(event.matches ? "light" : "dark", false);
  });
}

function wireMobileSheet() {
  document.querySelector("[data-open-more]")?.addEventListener("click", () => {
    moreSheet?.showModal();
    moreSheet?.querySelector("[data-close-more]")?.focus();
  });
  document.querySelector("[data-close-more]")?.addEventListener("click", () => moreSheet?.close());
  moreSheet?.addEventListener("click", (event) => {
    if (event.target === moreSheet) moreSheet.close();
  });
  moreSheet?.addEventListener("close", () => {
    document.querySelector("[data-open-more]")?.focus();
  });
}

function wireHeaderScroll() {
  const update = () => header?.classList.toggle("is-compact", window.scrollY > 24);
  window.addEventListener("scroll", update, { passive: true });
  update();
}

function wireGlobalErrors() {
  window.addEventListener("unhandledrejection", (event) => showError(event.reason));
  window.addEventListener("error", (event) => {
    if (event.error) showError(event.error);
  });
}

function markChartEngineMissing() {
  document.documentElement.classList.add("chart-engine-missing");
  const warning = document.getElementById("chart-engine-warning");
  if (warning) warning.hidden = false;
}

function waitForChartEngine() {
  if (globalThis.Chart) return Promise.resolve();
  const script = document.querySelector("[data-chart-engine]");
  if (!script) return Promise.resolve();
  return new Promise((resolve) => {
    let finished = false;
    const finish = (loaded) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      if (!loaded) markChartEngineMissing();
      resolve();
    };
    const timeout = window.setTimeout(() => finish(Boolean(globalThis.Chart)), 1500);
    script.addEventListener("load", () => finish(Boolean(globalThis.Chart)), { once: true });
    script.addEventListener("error", () => finish(false), { once: true });
  });
}

async function fillFooter() {
  try {
    const meta = await loadJSON("meta.json");
    const credit = document.getElementById("dataset-credit");
    if (credit) {
      credit.textContent = `Dataset: ${meta.dataset.name} · Source: ${meta.dataset.source}`;
    }
  } catch (error) {
    const credit = document.getElementById("dataset-credit");
    if (credit) credit.textContent = "Dataset credit is unavailable; frontend data could not be loaded.";
    console.error(error);
  }
}

async function boot() {
  await waitForChartEngine();
  if (!globalThis.Chart) markChartEngineMissing();
  wireThemeToggle();
  wireMobileSheet();
  wireHeaderScroll();
  wireGlobalErrors();
  window.addEventListener("hashchange", navigate);
  window.addEventListener("popstate", navigate);

  try {
    await loadAll();
    await fillFooter();
    await navigate();
  } catch (error) {
    showError(error);
  }
}

boot();

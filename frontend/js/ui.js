/*
Purpose: Provide shared formatting and accessible UI components.
Inputs: DOM elements, display values, and interaction callbacks.
Outputs: Reusable controls, status messages, and formatted text.
*/
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function formatNumber(value, decimals = 2) {
  if (!Number.isFinite(Number(value))) return "Not available";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(Number(value));
}

export function formatPercent(value, decimals = 1) {
  if (!Number.isFinite(Number(value))) return "Not available";
  return `${formatNumber(Number(value) * 100, decimals)}%`;
}

export function formatMarks(value, decimals = 2) {
  if (!Number.isFinite(Number(value))) return "Not available";
  return `±${formatNumber(Math.abs(Number(value)), decimals)} marks`;
}

export function animateNumber(
  element,
  target,
  { duration = 700, decimals = 0, prefix = "", suffix = "" } = {},
) {
  const end = Number(target);
  if (!element || !Number.isFinite(end)) return () => {};
  const render = (value) => {
    element.textContent = `${prefix}${formatNumber(value, decimals)}${suffix}`;
  };
  if (reducedMotion() || duration <= 0) {
    render(end);
    return () => {};
  }

  const start = performance.now();
  let frame = 0;
  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - progress) ** 3;
    render(end * eased);
    if (progress < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

export function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || (value === false && !name.startsWith("aria-"))) continue;
    if (name === "className") {
      element.className = value;
    } else if (name === "text") {
      element.textContent = String(value);
    } else if (name === "dataset" && typeof value === "object") {
      Object.assign(element.dataset, value);
    } else if (name === "style" && typeof value === "object") {
      for (const [property, propertyValue] of Object.entries(value)) {
        if (property.startsWith("--")) {
          element.style.setProperty(property, String(propertyValue));
        }
      }
    } else if (name.startsWith("on") && typeof value === "function") {
      element.addEventListener(name.slice(2).toLowerCase(), value);
    } else if (name in element && name !== "role" && !name.startsWith("aria-")) {
      element[name] = value;
    } else {
      element.setAttribute(name, value === true && !name.startsWith("aria-") ? "" : String(value));
    }
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

export function createTabs(container, tabs, onSelect = () => {}) {
  const tablist = el("div", {
    className: "tabs",
    role: "tablist",
    "aria-label": "Content sections",
  });
  const buttons = [];
  let activeIndex = 0;
  tabs.forEach((tab, index) => {
    const button = el("button", {
      className: "tabs__tab",
      type: "button",
      role: "tab",
      id: `study-tab-${index}`,
      "aria-selected": index === activeIndex,
      tabindex: index === activeIndex ? "0" : "-1",
      text: tab.label,
    });
    button.addEventListener("click", () => select(index, true));
    button.addEventListener("keydown", (event) => {
      let next = activeIndex;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (activeIndex + 1) % tabs.length;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (activeIndex - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      select(next, true);
    });
    buttons.push(button);
    tablist.append(button);
  });
  container.append(tablist);

  function select(index, focus = false) {
    if (!Number.isInteger(index) || index < 0 || index >= buttons.length) return;
    activeIndex = index;
    buttons.forEach((button, buttonIndex) => {
      const selected = buttonIndex === activeIndex;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    if (focus) buttons[index].focus();
    onSelect(tabs[index], index);
  }

  return { element: tablist, select, destroy: () => tablist.remove() };
}

export function createSegmented(container, options, onSelect = () => {}) {
  const group = el("div", {
    className: "segmented",
    role: "radiogroup",
    "aria-label": options.label ?? "Choose an option",
  });
  const buttons = options.items.map((item, index) => {
    const button = el("button", {
      className: "segmented__option",
      type: "button",
      role: "radio",
      "aria-checked": index === 0,
      tabindex: index === 0 ? "0" : "-1",
      text: item.label,
    });
    button.addEventListener("click", () => select(index, false));
    button.addEventListener("keydown", (event) => {
      let next = currentIndex;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (currentIndex + 1) % buttons.length;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (currentIndex - 1 + buttons.length) % buttons.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = buttons.length - 1;
      else return;
      event.preventDefault();
      select(next, true);
    });
    group.append(button);
    return button;
  });
  let currentIndex = 0;
  container.append(group);

  function select(index, focus) {
    if (!Number.isInteger(index) || index < 0 || index >= buttons.length) return;
    currentIndex = index;
    buttons.forEach((button, buttonIndex) => {
      const selected = buttonIndex === index;
      button.setAttribute("aria-checked", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    if (focus) buttons[index].focus();
    onSelect(options.items[index], index);
  }

  return { element: group, select, destroy: () => group.remove() };
}

export function tooltip(trigger, message) {
  const id = `tooltip-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
  const tip = el("span", {
    id,
    role: "tooltip",
    className: "tooltip",
    text: message,
    hidden: true,
  });
  document.body.append(tip);
  const previousDescription = trigger.getAttribute("aria-describedby");
  trigger.setAttribute("aria-describedby", id);
  const position = () => {
    const bounds = trigger.getBoundingClientRect();
    tip.hidden = false;
    const top = Math.max(8, bounds.top - tip.offsetHeight - 8);
    const left = Math.min(
      Math.max(8, bounds.left + bounds.width / 2 - tip.offsetWidth / 2),
      window.innerWidth - tip.offsetWidth - 8,
    );
    tip.style.setProperty("--tooltip-top", `${top}px`);
    tip.style.setProperty("--tooltip-left", `${left}px`);
  };
  const hide = () => { tip.hidden = true; };
  trigger.addEventListener("mouseenter", position);
  trigger.addEventListener("focus", position);
  trigger.addEventListener("mouseleave", hide);
  trigger.addEventListener("blur", hide);
  return () => {
    trigger.removeEventListener("mouseenter", position);
    trigger.removeEventListener("focus", position);
    trigger.removeEventListener("mouseleave", hide);
    trigger.removeEventListener("blur", hide);
    if (previousDescription) trigger.setAttribute("aria-describedby", previousDescription);
    else trigger.removeAttribute("aria-describedby");
    tip.remove();
  };
}

export function toast(message, { duration = 3000 } = {}) {
  const region = document.getElementById("toast-region");
  if (!region) return;
  const notice = el("div", { className: "toast", role: "status", text: message });
  region.append(notice);
  requestAnimationFrame(() => notice.classList.add("is-visible"));
  window.setTimeout(() => {
    notice.classList.remove("is-visible");
    window.setTimeout(() => notice.remove(), 200);
  }, duration);
}

export async function copyToClipboard(text) {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard access is unavailable in this browser context.");
  }
  await navigator.clipboard.writeText(String(text));
  toast("Copied to clipboard");
}

export function observeInView(element, callback, options = {}) {
  if (!("IntersectionObserver" in window)) {
    callback(element);
    return () => {};
  }
  let observer;
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        callback(entry.target);
        observer.unobserve(entry.target);
      }
    }
  }, options);
  observer.observe(element);
  return () => observer.disconnect();
}

"use strict";

/* ---------- Storage ---------- */

const STORAGE_KEYS = {
  appointments: "termine.appointments",
  todos: "termine.todos",
  notes: "termine.notes",
  notifiedLog: "termine.notifiedLog",
};

function loadList(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Konnte Daten nicht laden:", key, err);
    return [];
  }
}

function saveList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

let appointments = loadList(STORAGE_KEYS.appointments);
let todos = loadList(STORAGE_KEYS.todos);
let notes = loadList(STORAGE_KEYS.notes);
let notifiedLog = new Set(loadList(STORAGE_KEYS.notifiedLog));

function persistNotifiedLog() {
  saveList(STORAGE_KEYS.notifiedLog, Array.from(notifiedLog));
}

/* ---------- Utilities ---------- */

const CATEGORY_LABEL = { privat: "Privat", geschaeftlich: "Geschäftlich" };

function pad2(n) { return String(n).padStart(2, "0"); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDateLabel(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date - today) / 86400000);

  if (diffDays === 0) return "Heute";
  if (diffDays === 1) return "Morgen";
  if (diffDays === -1) return "Gestern";

  return date.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

function appointmentDateTime(a) {
  return new Date(`${a.date}T${a.time || "00:00"}:00`);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* ---------- Rendering: Termine ---------- */

let terminFilter = "alle";

function renderTermine() {
  const list = document.getElementById("terminList");
  const items = appointments
    .filter((a) => terminFilter === "alle" || a.category === terminFilter)
    .slice()
    .sort((a, b) => appointmentDateTime(a) - appointmentDateTime(b));

  if (items.length === 0) {
    list.innerHTML = `<div class="empty-state">Noch keine Termine. Tippe auf "+ Neu", um einen anzulegen.</div>`;
    return;
  }

  list.innerHTML = items.map((a) => `
    <div class="card">
      <div class="accent-bar ${a.category}"></div>
      <div class="card-body">
        <p class="card-title">${escapeHtml(a.title)}</p>
        <div class="card-meta">
          <span>${formatDateLabel(a.date)}${a.time ? " · " + a.time : ""}</span>
          <span class="badge ${a.category}">${CATEGORY_LABEL[a.category]}</span>
          ${a.reminder ? `<span>🔔 ${reminderLabel(a.reminder)}</span>` : ""}
        </div>
        ${a.note ? `<p class="card-note">${escapeHtml(a.note)}</p>` : ""}
      </div>
      <div class="card-actions">
        <button class="icon-btn danger" data-delete-termin="${a.id}" aria-label="Löschen">🗑️</button>
      </div>
    </div>
  `).join("");
}

function reminderLabel(minutes) {
  const m = Number(minutes);
  if (m === 1440) return "1 Tag vorher";
  if (m === 60) return "1 Std. vorher";
  return `${m} Min. vorher`;
}

/* ---------- Rendering: To-Dos ---------- */

function renderTodos() {
  renderTodoGroup("privat", "todoListPrivat");
  renderTodoGroup("geschaeftlich", "todoListGeschaeftlich");
}

function renderTodoGroup(listKey, containerId) {
  const container = document.getElementById(containerId);
  const items = todos
    .filter((t) => t.list === listKey)
    .slice()
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (a.due || "9999").localeCompare(b.due || "9999");
    });

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state">Keine Aufgaben.</div>`;
    return;
  }

  container.innerHTML = items.map((t) => `
    <div class="card">
      <input type="checkbox" class="todo-checkbox" data-toggle-todo="${t.id}" ${t.done ? "checked" : ""} />
      <div class="card-body">
        <p class="card-title todo-text ${t.done ? "done" : ""}">${escapeHtml(t.text)}</p>
        ${t.due ? `<div class="card-meta"><span>Fällig: ${formatDateLabel(t.due)}</span>${t.remind ? " <span>🔔</span>" : ""}</div>` : ""}
      </div>
      <div class="card-actions">
        <button class="icon-btn danger" data-delete-todo="${t.id}" aria-label="Löschen">🗑️</button>
      </div>
    </div>
  `).join("");
}

/* ---------- Rendering: Arbeitsinfos ---------- */

function renderNotes() {
  const container = document.getElementById("noteList");
  const items = notes.slice().sort((a, b) => b.updatedAt - a.updatedAt);

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state">Noch keine Arbeitsinfos hinterlegt.</div>`;
    return;
  }

  container.innerHTML = items.map((n) => `
    <div class="card">
      <div class="card-body">
        <p class="card-title">${escapeHtml(n.title)}</p>
        ${n.body ? `<p class="card-note">${escapeHtml(n.body)}</p>` : ""}
      </div>
      <div class="card-actions">
        <button class="icon-btn danger" data-delete-note="${n.id}" aria-label="Löschen">🗑️</button>
      </div>
    </div>
  `).join("");
}

/* ---------- Rendering: Heute ---------- */

function renderHeute() {
  const today = todayISO();
  const todaysAppointments = appointments
    .filter((a) => a.date === today)
    .sort((a, b) => appointmentDateTime(a) - appointmentDateTime(b));
  const openTodos = todos.filter((t) => !t.done && (!t.due || t.due <= today));
  const overdueAppointments = appointments
    .filter((a) => a.date < today)
    .sort((a, b) => appointmentDateTime(b) - appointmentDateTime(a))
    .slice(0, 3);

  document.getElementById("todaySummary").textContent =
    `${todaysAppointments.length} Termin(e) heute · ${openTodos.length} offene Aufgabe(n)`;

  const list = document.getElementById("todayList");
  const sections = [];

  if (todaysAppointments.length) {
    sections.push(`<h2 class="group-title">Termine heute</h2>`);
    sections.push(todaysAppointments.map((a) => `
      <div class="card">
        <div class="accent-bar ${a.category}"></div>
        <div class="card-body">
          <p class="card-title">${escapeHtml(a.title)}</p>
          <div class="card-meta">
            <span>${a.time || "ganztägig"}</span>
            <span class="badge ${a.category}">${CATEGORY_LABEL[a.category]}</span>
          </div>
        </div>
      </div>
    `).join(""));
  }

  if (openTodos.length) {
    sections.push(`<h2 class="group-title">Offene Aufgaben</h2>`);
    sections.push(openTodos.slice(0, 8).map((t) => `
      <div class="card">
        <input type="checkbox" class="todo-checkbox" data-toggle-todo="${t.id}" />
        <div class="card-body">
          <p class="card-title">${escapeHtml(t.text)}</p>
          <div class="card-meta"><span class="badge ${t.list}">${CATEGORY_LABEL[t.list]}</span></div>
        </div>
      </div>
    `).join(""));
  }

  if (overdueAppointments.length) {
    sections.push(`<h2 class="group-title">Zuletzt vergangen</h2>`);
    sections.push(overdueAppointments.map((a) => `
      <div class="card">
        <div class="accent-bar ${a.category}"></div>
        <div class="card-body">
          <p class="card-title">${escapeHtml(a.title)}</p>
          <div class="card-meta"><span>${formatDateLabel(a.date)}</span></div>
        </div>
      </div>
    `).join(""));
  }

  list.innerHTML = sections.length
    ? sections.join("")
    : `<div class="empty-state">Nichts los heute. Genieß den Tag! 🎉</div>`;
}

function renderAll() {
  renderHeute();
  renderTermine();
  renderTodos();
  renderNotes();
}

/* ---------- Tab / View navigation ---------- */

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.view).classList.add("active");
  });
});

document.querySelectorAll("[data-filter]").forEach((btn) => {
  btn.addEventListener("click", () => {
    terminFilter = btn.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderTermine();
  });
});

/* ---------- Modals ---------- */

function openModal(id) {
  document.getElementById(id).classList.add("open");
}
function closeModal(modalEl) {
  modalEl.classList.remove("open");
  const form = modalEl.querySelector("form");
  if (form) form.reset();
}

document.querySelectorAll("[data-open-modal]").forEach((btn) => {
  btn.addEventListener("click", () => openModal(btn.dataset.openModal));
});
document.querySelectorAll("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.closest(".modal-backdrop")));
});
document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal(backdrop);
  });
});

/* ---------- Forms ---------- */

document.getElementById("formTermin").addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  appointments.push({
    id: uid(),
    title: fd.get("title").trim(),
    date: fd.get("date"),
    time: fd.get("time") || "",
    category: fd.get("category"),
    reminder: fd.get("reminder") || "",
    note: fd.get("note").trim(),
  });
  saveList(STORAGE_KEYS.appointments, appointments);
  closeModal(document.getElementById("modal-termin"));
  renderAll();
});

document.getElementById("formTodo").addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  todos.push({
    id: uid(),
    text: fd.get("text").trim(),
    list: fd.get("list"),
    due: fd.get("due") || "",
    remind: fd.get("remind") === "on",
    done: false,
  });
  saveList(STORAGE_KEYS.todos, todos);
  closeModal(document.getElementById("modal-todo"));
  renderAll();
});

document.getElementById("formNote").addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const now = Date.now();
  notes.push({
    id: uid(),
    title: fd.get("title").trim(),
    body: fd.get("body").trim(),
    createdAt: now,
    updatedAt: now,
  });
  saveList(STORAGE_KEYS.notes, notes);
  closeModal(document.getElementById("modal-note"));
  renderAll();
});

/* ---------- Delegated actions (delete / toggle) ---------- */

document.getElementById("views").addEventListener("click", (e) => {
  const delTermin = e.target.closest("[data-delete-termin]");
  const delTodo = e.target.closest("[data-delete-todo]");
  const delNote = e.target.closest("[data-delete-note]");

  if (delTermin) {
    appointments = appointments.filter((a) => a.id !== delTermin.dataset.deleteTermin);
    saveList(STORAGE_KEYS.appointments, appointments);
    renderAll();
  } else if (delTodo) {
    todos = todos.filter((t) => t.id !== delTodo.dataset.deleteTodo);
    saveList(STORAGE_KEYS.todos, todos);
    renderAll();
  } else if (delNote) {
    notes = notes.filter((n) => n.id !== delNote.dataset.deleteNote);
    saveList(STORAGE_KEYS.notes, notes);
    renderAll();
  }
});

document.getElementById("views").addEventListener("change", (e) => {
  const toggle = e.target.closest("[data-toggle-todo]");
  if (!toggle) return;
  const todo = todos.find((t) => t.id === toggle.dataset.toggleTodo);
  if (todo) {
    todo.done = toggle.checked;
    saveList(STORAGE_KEYS.todos, todos);
    renderAll();
  }
});

/* ---------- Reminders / Notifications ---------- */

function canNotify() {
  return "Notification" in window && Notification.permission === "granted";
}

async function showLocalNotification(title, body, tag) {
  if (!canNotify()) return;
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, { body, tag, icon: "icons/icon-192.png", badge: "icons/icon-192.png" });
      return;
    }
  } catch (err) {
    console.warn("SW notification fehlgeschlagen, Fallback:", err);
  }
  new Notification(title, { body, icon: "icons/icon-192.png" });
}

function checkReminders() {
  const now = new Date();

  for (const a of appointments) {
    if (!a.reminder) continue;
    const key = `apt:${a.id}`;
    if (notifiedLog.has(key)) continue;
    const remindAt = new Date(appointmentDateTime(a).getTime() - Number(a.reminder) * 60000);
    if (now >= remindAt && now <= appointmentDateTime(a)) {
      showLocalNotification(
        "Termin-Erinnerung",
        `${a.title}${a.time ? " um " + a.time : ""}`,
        key
      );
      notifiedLog.add(key);
      persistNotifiedLog();
    }
  }

  const today = todayISO();
  for (const t of todos) {
    if (!t.remind || t.done || !t.due) continue;
    const key = `todo:${t.id}`;
    if (notifiedLog.has(key)) continue;
    const dueAt = new Date(`${t.due}T09:00:00`);
    if (t.due <= today && now >= dueAt) {
      showLocalNotification("Aufgaben-Erinnerung", t.text, key);
      notifiedLog.add(key);
      persistNotifiedLog();
    }
  }
}

const notifyBanner = document.getElementById("notifyBanner");

function updateNotifyBanner() {
  if (!("Notification" in window) || Notification.permission === "granted") {
    notifyBanner.classList.add("hidden");
  } else if (localStorage.getItem("termine.notifyBannerDismissed") !== "1") {
    notifyBanner.classList.remove("hidden");
  }
}

document.getElementById("enableNotify").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert("Dieser Browser unterstützt keine Benachrichtigungen.");
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    showLocalNotification("Erinnerungen aktiv", "Du wirst ab jetzt an Termine und Aufgaben erinnert.", "welcome");
  }
  updateNotifyBanner();
});

document.getElementById("dismissNotify").addEventListener("click", () => {
  localStorage.setItem("termine.notifyBannerDismissed", "1");
  notifyBanner.classList.add("hidden");
});

/* ---------- iOS install hint ---------- */

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

const iosHint = document.getElementById("iosHint");
if (isIos() && !isStandalone() && localStorage.getItem("termine.iosHintDismissed") !== "1") {
  iosHint.classList.remove("hidden");
}
iosHint.querySelector(".hint-close").addEventListener("click", () => {
  localStorage.setItem("termine.iosHintDismissed", "1");
  iosHint.classList.add("hidden");
});

/* ---------- Android/Desktop install prompt ---------- */

let deferredInstallPrompt = null;
const installBtn = document.getElementById("installBtn");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  installBtn.classList.remove("hidden");
});

installBtn.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBtn.classList.add("hidden");
});

window.addEventListener("appinstalled", () => {
  installBtn.classList.add("hidden");
});

/* ---------- Service worker ---------- */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => {
      console.error("Service Worker Registrierung fehlgeschlagen:", err);
    });
  });
}

/* ---------- Init ---------- */

renderAll();
updateNotifyBanner();
checkReminders();
setInterval(checkReminders, 30000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    renderAll();
    checkReminders();
  }
});

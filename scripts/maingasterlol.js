/* =====================================================
   SUPABASE - ТВОИ КЛЮЧИ
===================================================== */

const SUPABASE_URL = "https://wcicdqbetfdydvafbbwd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_9zLs2SW7TKk7nE5nc2SIrQ_p338-6dB";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* =====================================================
   STATE
===================================================== */

let currentUser = null;
let sessionToken = localStorage.getItem("schoolnet_session");

/* =====================================================
   ELEMENTS
===================================================== */

const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authMessage = document.getElementById("authMessage");
const tasksList = document.getElementById("tasksList");
const myTasksList = document.getElementById("myTasksList");

/* =====================================================
   HELPERS
===================================================== */

function escapeHTML(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeJS(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function showAuthMessage(message, type = "error") {
  authMessage.innerHTML = `<div class="${type}">${escapeHTML(message)}</div>`;
}

function clearAuthMessage() {
  authMessage.innerHTML = "";
}

function setLoading(button, loading, text) {
  button.disabled = loading;
  button.textContent = loading ? "Подождите..." : text;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("ru-RU", {
    maximumFractionDigits: 2
  }) + " SNK";
}

function getRoleName(role) {
  switch (role) {
    case "superadmin":
      return "👑 Суперадмин";
    case "admin":
      return "🛡️ Администратор";
    case "senior_moderator":
      return "🔷 Старший модератор";
    case "junior_moderator":
      return "🔹 Младший модератор";
    case "moderator":
      return "🛡️ Модератор";
    default:
      return "👤 Пользователь";
  }
}

/* =====================================================
   AUTH TABS
===================================================== */

loginTab.addEventListener("click", () => {
  loginTab.classList.add("active");
  registerTab.classList.remove("active");
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
  clearAuthMessage();
});

registerTab.addEventListener("click", () => {
  registerTab.classList.add("active");
  loginTab.classList.remove("active");
  registerForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
  clearAuthMessage();
});

/* =====================================================
   LOGIN
===================================================== */

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  clearAuthMessage();

  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  const button = loginForm.querySelector("button");

  setLoading(button, true, "Войти");

  try {
    const { data, error } = await supabaseClient.rpc("login_user", {
      p_username: username,
      p_password: password
    });

    if (error) throw error;
    if (!data || !data.token || !data.user) {
      throw new Error("Сервер вернул неправильный ответ.");
    }

    sessionToken = data.token;
    localStorage.setItem("schoolnet_session", sessionToken);
    currentUser = data.user;
    openApp();
    showToast("Вы успешно вошли.");

  } catch (error) {
    console.error(error);
    showAuthMessage(error.message || "Не удалось выполнить вход.");
  } finally {
    setLoading(button, false, "Войти");
  }
});

/* =====================================================
   REGISTER
===================================================== */

registerForm.addEventListener("submit", async event => {
  event.preventDefault();
  clearAuthMessage();

  const username = document.getElementById("registerUsername").value.trim();
  const password = document.getElementById("registerPassword").value;
  const nickname = document.getElementById("registerNickname").value.trim();
  const city = document.getElementById("registerCity").value;
  const school = document.getElementById("registerSchool").value;
  const button = registerForm.querySelector("button");

  if (username.length < 3) {
    showAuthMessage("Логин должен быть минимум 3 символа.");
    return;
  }
  if (password.length < 6) {
    showAuthMessage("Пароль должен быть минимум 6 символов.");
    return;
  }
  if (!nickname) {
    showAuthMessage("Введите никнейм.");
    return;
  }

  setLoading(button, true, "Создать аккаунт");

  try {
    const { data, error } = await supabaseClient.rpc("register_user", {
      p_username: username,
      p_password: password,
      p_nickname: nickname,
      p_city: city,
      p_school: school
    });

    if (error) throw error;
    if (!data) throw new Error("Аккаунт не был создан.");

    registerForm.reset();
    loginTab.click();
    document.getElementById("loginUsername").value = username;
    showAuthMessage("Аккаунт создан. Теперь войдите.", "success");

  } catch (error) {
    console.error(error);
    showAuthMessage(error.message || "Не удалось создать аккаунт.");
  } finally {
    setLoading(button, false, "Создать аккаунт");
  }
});

/* =====================================================
   SESSION
===================================================== */

async function checkSession() {
  if (!sessionToken) {
    showAuth();
    return;
  }

  try {
    const { data, error } = await supabaseClient.rpc("check_session", {
      p_token: sessionToken
    });

    if (error) throw error;
    if (!data || !data.user) throw new Error("Сессия недействительна.");

    currentUser = data.user;
    openApp();

  } catch (error) {
    console.warn("Session error:", error);
    localStorage.removeItem("schoolnet_session");
    sessionToken = null;
    currentUser = null;
    showAuth();
  }
}

/* =====================================================
   OPEN APP
===================================================== */

function openApp() {
  authScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  renderUser();
  loadTasks();
  loadMyTasks();
  loadMoneyRequests();
}

function showAuth() {
  appScreen.classList.add("hidden");
  authScreen.classList.remove("hidden");
}

/* =====================================================
   USER
===================================================== */

function renderUser() {
  if (!currentUser) return;

  const nickname = currentUser.nickname || "Пользователь";
  const username = currentUser.username || "";
  const role = currentUser.role || "user";
  const balance = Number(currentUser.balance || 0);

  document.getElementById("profileNickname").textContent = nickname;
  document.getElementById("profileUsername").textContent = "@" + username;
  document.getElementById("profileRole").textContent = getRoleName(role);
  document.getElementById("headerBalance").textContent = "Баланс: " + formatMoney(balance);
  document.getElementById("statBalance").textContent = formatMoney(balance);
  document.getElementById("moneyBalance").textContent = formatMoney(balance);
  document.getElementById("statCompleted").textContent = currentUser.completed || 0;
  document.getElementById("statRating").textContent = currentUser.rating || 0;
  document.getElementById("statViolations").textContent = currentUser.violations || 0;
  document.getElementById("profileLogin").textContent = username;
  document.getElementById("profileNick").textContent = nickname;
  document.getElementById("profileCity").textContent = currentUser.city || "—";
  document.getElementById("profileSchool").textContent = currentUser.school || "—";

  const isAdmin = currentUser.is_admin === true || role === "admin" || role === "superadmin";
  if (isAdmin) {
    document.getElementById("adminNav").classList.remove("hidden");
  } else {
    document.getElementById("adminNav").classList.add("hidden");
  }

  const isScratch = username.toLowerCase() === "scratch" && (role === "superadmin" || currentUser.is_admin === true);
  if (isScratch) {
    document.getElementById("superAdminPanel").classList.remove("hidden");
  } else {
    document.getElementById("superAdminPanel").classList.add("hidden");
  }
}

/* =====================================================
   TASKS
===================================================== */

async function loadTasks() {
  if (!sessionToken) return;
  tasksList.innerHTML = `<div class="loading">Загрузка заказов...</div>`;

  try {
    const { data, error } = await supabaseClient.rpc("get_tasks", {
      p_token: sessionToken
    });
    if (error) throw error;
    renderTasks(Array.isArray(data) ? data : [], tasksList, "feed");
  } catch (error) {
    console.error(error);
    tasksList.innerHTML = `
      <div class="empty">
        Не удалось загрузить заказы.<br>
        <small>${escapeHTML(error.message || "")}</small>
      </div>
    `;
  }
}

async function loadMyTasks() {
  if (!sessionToken) return;
  myTasksList.innerHTML = `<div class="loading">Загрузка заказов...</div>`;

  try {
    const { data, error } = await supabaseClient.rpc("get_my_tasks", {
      p_token: sessionToken
    });
    if (error) throw error;
    renderTasks(Array.isArray(data) ? data : [], myTasksList, "mine");
  } catch (error) {
    console.error(error);
    myTasksList.innerHTML = `
      <div class="empty">
        Не удалось загрузить заказы.<br>
        <small>${escapeHTML(error.message || "")}</small>
      </div>
    `;
  }
}

function renderTasks(tasks, container, mode) {
  if (!tasks.length) {
    container.innerHTML = `
      <div class="empty">
        ${mode === "feed" ? "📭 Сейчас нет доступных заказов." : "📦 У тебя пока нет заказов."}
      </div>
    `;
    return;
  }

  container.innerHTML = tasks.map(task => {
    const status = task.status || "open";
    const ownerId = task.owner_id;
    const assignedTo = task.assigned_to;
    const currentId = currentUser?.id || currentUser?.user_id || currentUser?.auth_user_id;

    let action = "";

    if (mode === "feed" && status === "open" && ownerId !== currentId) {
      action = `
        <button class="task-btn take-btn" onclick="takeTask('${escapeJS(task.id)}')">
          ✋ Взять заказ
        </button>
      `;
    }

    if (mode === "mine" && assignedTo === currentId && status === "taken") {
      action = `
        <button class="task-btn complete-btn" onclick="completeTask('${escapeJS(task.id)}')">
          ✅ Завершить
        </button>
      `;
    }

    return `
      <div class="task-card">
        <div class="task-top">
          <div class="task-title">${escapeHTML(task.title)}</div>
          <div class="task-price">${formatMoney(task.price)}</div>
        </div>
        <div class="task-description">${escapeHTML(task.description || "Описание отсутствует.")}</div>
        <div class="task-meta">
          <span class="task-tag">📂 ${escapeHTML(task.category || "other")}</span>
          <span class="task-tag">📌 ${escapeHTML(getStatusName(status))}</span>
        </div>
        ${action ? `<div class="task-actions">${action}</div>` : ""}
      </div>
    `;
  }).join("");
}

function getStatusName(status) {
  switch (status) {
    case "open":
      return "Доступен";
    case "taken":
      return "Выполняется";
    case "done":
      return "Завершён";
    case "cancelled":
      return "Отменён";
    default:
      return status;
  }
}

/* =====================================================
   CREATE TASK
===================================================== */

document.getElementById("createTaskBtn").addEventListener("click", async () => {
  const title = document.getElementById("newOrderTitle").value.trim();
  const description = document.getElementById("newOrderDescription").value.trim();
  const price = Number(document.getElementById("newOrderPrice").value);
  const category = document.getElementById("newOrderCategory").value;
  const button = document.getElementById("createTaskBtn");

  if (!title) {
    showToast("Введите название заказа.");
    return;
  }
  if (!description) {
    showToast("Введите описание заказа.");
    return;
  }
  if (!Number.isFinite(price) || price <= 0) {
    showToast("Введите нормальную стоимость.");
    return;
  }

  setLoading(button, true, "Создать заказ");

  try {
    const { data, error } = await supabaseClient.rpc("create_task", {
      p_token: sessionToken,
      p_title: title,
      p_description: description,
      p_price: price,
      p_category: category
    });

    if (error) throw error;
    if (!data) throw new Error("Заказ не был создан.");

    document.getElementById("newOrderTitle").value = "";
    document.getElementById("newOrderDescription").value = "";
    document.getElementById("newOrderPrice").value = "";
    showToast("Заказ создан.");

    await loadTasks();
    await loadMyTasks();
    document.querySelector('[data-section="orders"]').click();

  } catch (error) {
    console.error(error);
    showToast(error.message || "Не удалось создать заказ.");
  } finally {
    setLoading(button, false, "Создать заказ");
  }
});

/* =====================================================
   TAKE TASK
===================================================== */

async function takeTask(taskId) {
  if (!sessionToken) return;

  try {
    const { data, error } = await supabaseClient.rpc("take_task", {
      p_token: sessionToken,
      p_task_id: taskId
    });

    if (error) throw error;
    if (!data) throw new Error("Не удалось взять заказ.");

    showToast("Заказ взят.");
    await loadTasks();
    await loadMyTasks();

  } catch (error) {
    console.error(error);
    showToast(error.message || "Не удалось взять заказ.");
  }
}

/* =====================================================
   COMPLETE TASK
===================================================== */

async function completeTask(taskId) {
  if (!sessionToken) return;
  if (!confirm("Ты точно выполнил этот заказ?")) return;

  try {
    const { data, error } = await supabaseClient.rpc("complete_task", {
      p_token: sessionToken,
      p_task_id: taskId
    });

    if (error) throw error;
    if (!data) throw new Error("Не удалось завершить заказ.");

    showToast("Заказ завершён.");
    await loadTasks();
    await loadMyTasks();
    await checkSession();

  } catch (error) {
    console.error(error);
    showToast(error.message || "Не удалось завершить заказ.");
  }
}

/* =====================================================
   MONEY FORMS
===================================================== */

function showDepositForm() {
  const panel = document.getElementById("moneyFormPanel");
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <h2>⭐ Пополнение SNKoin</h2>
    <p class="muted" style="margin-bottom:15px">Укажи количество Telegram Stars.</p>
    <div class="field">
      <label>Stars</label>
      <input id="depositStars" type="number" min="1" step="1" placeholder="100">
    </div>
    <div class="field">
      <label>Telegram username</label>
      <input id="depositTelegram" type="text" placeholder="@username">
    </div>
    <button class="main-btn" onclick="createDepositRequest()">Отправить заявку</button>
  `;
}

function showWithdrawalForm() {
  const panel = document.getElementById("moneyFormPanel");
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <h2>🎁 Вывод SNKoin</h2>
    <p class="muted" style="margin-bottom:15px">Выбери подарок для вывода.</p>
    <div class="field">
      <label>Подарок</label>
      <select id="withdrawGift">
        <option value="bear">🧸 Мишка</option>
        <option value="gift">🎁 Подарок</option>
        <option value="cake">🎂 Тортик</option>
        <option value="rocket">🚀 Ракета</option>
        <option value="cup">🏆 Кубок</option>
        <option value="ring">💍 Кольцо</option>
      </select>
    </div>
    <div class="field">
      <label>Количество SNKoin</label>
      <input id="withdrawAmount" type="number" min="1" step="1" placeholder="100">
    </div>
    <div class="field">
      <label>Telegram username</label>
      <input id="withdrawTelegram" type="text" placeholder="@username">
    </div>
    <button class="main-btn" onclick="createWithdrawalRequest()">Отправить заявку</button>
  `;
}

/* =====================================================
   DEPOSIT REQUEST
===================================================== */

async function createDepositRequest() {
  const stars = Number(document.getElementById("depositStars").value);
  const telegram = document.getElementById("depositTelegram").value.trim();

  if (!stars || stars <= 0) {
    showToast("Укажи количество Stars.");
    return;
  }

  try {
    const userId = currentUser?.id || currentUser?.user_id || currentUser?.auth_user_id;
    const snkoin = stars;

    const { error } = await supabaseClient.from("deposit_requests").insert({
      user_id: String(userId),
      telegram_username: telegram || null,
      stars_amount: stars,
      snkoin_amount: snkoin,
      status: "pending"
    });

    if (error) throw error;

    showToast("Заявка на пополнение отправлена.");
    document.getElementById("moneyFormPanel").classList.add("hidden");
    loadMoneyRequests();

  } catch (error) {
    console.error(error);
    showToast(error.message || "Не удалось создать заявку.");
  }
}

/* =====================================================
   WITHDRAW REQUEST
===================================================== */

async function createWithdrawalRequest() {
  const gift = document.getElementById("withdrawGift").value;
  const amount = Number(document.getElementById("withdrawAmount").value);
  const telegram = document.getElementById("withdrawTelegram").value.trim();

  if (!amount || amount <= 0) {
    showToast("Укажи количество SNKoin.");
    return;
  }

  const balance = Number(currentUser?.balance || 0);
  if (amount > balance) {
    showToast("Недостаточно SNKoin.");
    return;
  }

  try {
    const userId = currentUser?.id || currentUser?.user_id || currentUser?.auth_user_id;

    const { error } = await supabaseClient.from("withdrawal_requests").insert({
      user_id: String(userId),
      telegram_username: telegram || null,
      gift_type: gift,
      amount_snkoin: amount,
      status: "pending"
    });

    if (error) throw error;

    showToast("Заявка на вывод отправлена.");
    document.getElementById("moneyFormPanel").classList.add("hidden");
    loadMoneyRequests();

  } catch (error) {
    console.error(error);
    showToast(error.message || "Не удалось создать заявку.");
  }
}

/* =====================================================
   MONEY REQUESTS
===================================================== */

async function loadMoneyRequests() {
  const box = document.getElementById("moneyRequests");
  if (!currentUser) return;
  box.innerHTML = `<div class="loading">Загрузка...</div>`;

  try {
    const userId = currentUser?.id || currentUser?.user_id || currentUser?.auth_user_id;

    const [deposits, withdrawals] = await Promise.all([
      supabaseClient.from("deposit_requests").select("*").eq("user_id", String(userId)).order("created_at", { ascending: false }),
      supabaseClient.from("withdrawal_requests").select("*").eq("user_id", String(userId)).order("created_at", { ascending: false })
    ]);

    if (deposits.error) throw deposits.error;
    if (withdrawals.error) throw withdrawals.error;

    const all = [];

    (deposits.data || []).forEach(item => {
      all.push({
        kind: "deposit",
        date: item.created_at,
        status: item.status,
        text: `⭐ Пополнение: ${item.stars_amount} Stars → ${item.snkoin_amount} SNK`
      });
    });

    (withdrawals.data || []).forEach(item => {
      all.push({
        kind: "withdraw",
        date: item.created_at,
        status: item.status,
        text: `🎁 Вывод: ${item.amount_snkoin} SNK → ${escapeHTML(item.gift_type)}`
      });
    });

    all.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!all.length) {
      box.innerHTML = `<div class="empty">Заявок пока нет.</div>`;
      return;
    }

    box.innerHTML = all.map(item => `
      <div class="request-card">
        <div>${item.text}</div>
        <div style="margin-top:8px">
          <span class="request-status">${escapeHTML(item.status || "pending")}</span>
        </div>
        <div class="muted" style="margin-top:7px;font-size:12px">
          ${new Date(item.date).toLocaleString("ru-RU")}
        </div>
      </div>
    `).join("");

  } catch (error) {
    console.error(error);
    box.innerHTML = `
      <div class="empty">
        Не удалось загрузить заявки.<br>
        <small>${escapeHTML(error.message || "")}</small>
      </div>
    `;
  }
}

/* =====================================================
   NAVIGATION
===================================================== */

document.querySelectorAll(".nav-btn").forEach(button => {
  button.addEventListener("click", async () => {
    const section = button.dataset.section;

    document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");

    document.querySelectorAll(".section").forEach(el => el.classList.remove("active"));

    const target = document.getElementById("section-" + section);
    if (target) target.classList.add("active");

    if (section === "feed") await loadTasks();
    if (section === "orders") await loadMyTasks();
    if (section === "money") await loadMoneyRequests();
  });
});

/* =====================================================
   REFRESH
===================================================== */

document.getElementById("refreshTasksBtn").addEventListener("click", loadTasks);
document.getElementById("refreshMyTasksBtn").addEventListener("click", loadMyTasks);

/* =====================================================
   LOGOUT
===================================================== */

document.getElementById("logoutBtn").addEventListener("click", async () => {
  if (sessionToken) {
    try {
      await supabaseClient.rpc("logout_user", { p_token: sessionToken });
    } catch (error) {
      console.warn(error);
    }
  }

  localStorage.removeItem("schoolnet_session");
  sessionToken = null;
  currentUser = null;
  showAuth();
  loginForm.reset();
  showToast("Вы вышли из аккаунта.");
});

/* =====================================================
   START
===================================================== */

checkSession();

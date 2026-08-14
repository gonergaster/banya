        // =========================================================
        // SUPABASE
        // =========================================================
        const SUPABASE_URL = "https://wcicdqbetfdydvafbbwd.supabase.co";
        const SUPABASE_ANON_KEY = "sb_publishable_9zLs2SW7TKk7nE5nc2SIrQ_p338-6dB";
        const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // =========================================================
        // STATE
        // =========================================================
        let currentUser = null;
        let sessionToken = localStorage.getItem("schoolnet_session");
        let currentChatTaskId = null;
        let cachedTasks = [];
        let cachedMyTasks = [];
        let selectedCategory = 'study';

        // =========================================================
        // HELPERS
        // =========================================================
        function escapeHTML(v) { if (v === null || v === undefined) return ""; return String(v).replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

        function escapeJS(v) { return String(v || "").replaceAll("\\", "\\\\").replaceAll("'", "\\'"); }

        function showToast(m) { const t = document.getElementById("toast");
            t.textContent = m;
            t.classList.add("show");
            clearTimeout(window.__toastTimer);
            window.__toastTimer = setTimeout(() => t.classList.remove("show"), 2800); }

        function showAuthMessage(m, t = "error") { document.getElementById("authMessage").innerHTML =
            `<div class="${t}">${escapeHTML(m)}</div>`; }

        function clearAuthMessage() { document.getElementById("authMessage").innerHTML = ""; }

        function setLoading(b, l, t) { b.disabled = l;
            b.textContent = l ? "Подождите..." : t; }

        function formatMoney(v) { return Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " SNK"; }

        function getUserId() { return currentUser?.id || currentUser?.user_id || currentUser?.auth_user_id || null; }

        function getRoleName(r) { switch (r) { case "superadmin": return "👑 Суперадмин"; case "admin": return "🛡️ Администратор";
                case "moderator": return "🛡️ Модератор"; default: return "👤 Пользователь"; } }

        function isAdmin() { const r = currentUser?.role || "user"; return currentUser?.is_admin === true || ["admin",
                "superadmin", "moderator"
            ].includes(r); }

        function isSuperAdmin() { return currentUser?.role === "superadmin"; }

        // =========================================================
        // CATEGORIES
        // =========================================================
        function selectCategory(category) {
            selectedCategory = category;
            document.querySelectorAll('.category-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.category === category);
            });
            document.getElementById('selectedCategory').value = category;
            updateCreateTotal();
        }

        function updateCategoryGrid() {
            const grid = document.getElementById('categoryGrid');
            if (!grid) return;
            const buttons = grid.querySelectorAll('.category-btn');
            const selected = document.getElementById('selectedCategory')?.value || 'study';
            buttons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.category === selected);
            });
        }

        const categoryMap = {
            study: { icon: '📚', label: 'Учёба' },
            shopping: { icon: '🛒', label: 'Покупки' },
            help: { icon: '🤝', label: 'Помощь' },
            games: { icon: '🎮', label: 'Игры' },
            sport: { icon: '⚽', label: 'Спорт' },
            other: { icon: '📌', label: 'Другое' }
        };

        // =========================================================
        // AUTH
        // =========================================================
        document.getElementById("loginTab").onclick = () => { document.getElementById("loginTab").classList.add("active");
            document.getElementById("registerTab").classList.remove("active");
            document.getElementById("loginForm").classList.remove("hidden");
            document.getElementById("registerForm").classList.add("hidden");
            clearAuthMessage(); };
        document.getElementById("registerTab").onclick = () => { document.getElementById("registerTab").classList.add("active");
            document.getElementById("loginTab").classList.remove("active");
            document.getElementById("registerForm").classList.remove("hidden");
            document.getElementById("loginForm").classList.add("hidden");
            clearAuthMessage(); };

        document.getElementById("loginForm").addEventListener("submit", async e => {
            e.preventDefault();
            clearAuthMessage();
            const username = document.getElementById("loginUsername").value.trim();
            const password = document.getElementById("loginPassword").value;
            const button = document.getElementById("loginForm").querySelector("button");
            setLoading(button, true, "Войти");
            try {
                const { data, error } = await supabaseClient.rpc("login_user", { p_username: username,
                    p_password: password });
                if (error) throw error;
                if (!data || !data.token || !data.user) throw new Error("Сервер вернул неправильный ответ.");
                sessionToken = data.token;
                localStorage.setItem("schoolnet_session", sessionToken);
                currentUser = data.user;
                openApp();
                showToast("Вы успешно вошли.");
            } catch (error) { console.error(error);
                showAuthMessage(error.message || "Не удалось выполнить вход."); } finally { setLoading(button, false,
                    "Войти"); }
        });

        document.getElementById("registerForm").addEventListener("submit", async e => {
            e.preventDefault();
            clearAuthMessage();
            const username = document.getElementById("registerUsername").value.trim();
            const password = document.getElementById("registerPassword").value;
            const nickname = document.getElementById("registerNickname").value.trim();
            const city = document.getElementById("registerCity").value;
            const school = document.getElementById("registerSchool").value;
            const button = document.getElementById("registerForm").querySelector("button");
            if (username.length < 3) return showAuthMessage("Логин должен быть минимум 3 символа.");
            if (password.length < 6) return showAuthMessage("Пароль должен быть минимум 6 символов.");
            if (!nickname) return showAuthMessage("Введите никнейм.");
            setLoading(button, true, "Создать аккаунт");
            try {
                const { data, error } = await supabaseClient.rpc("register_user", { p_username: username,
                    p_password: password, p_nickname: nickname, p_city: city, p_school: school });
                if (error) throw error;
                if (!data) throw new Error("Аккаунт не был создан.");
                document.getElementById("registerForm").reset();
                document.getElementById("loginTab").click();
                document.getElementById("loginUsername").value = username;
                showAuthMessage("Аккаунт создан. Теперь войдите.", "success");
            } catch (error) { console.error(error);
                showAuthMessage(error.message || "Не удалось создать аккаунт."); } finally { setLoading(button, false,
                    "Создать аккаунт"); }
        });

        async function checkSession() {
            if (!sessionToken) { showAuth(); return; }
            try {
                const { data, error } = await supabaseClient.rpc("check_session", { p_token: sessionToken });
                if (error) throw error;
                if (!data || !data.user) throw new Error("Сессия недействительна.");
                currentUser = data.user;
                openApp();
            } catch (error) {
                console.warn(error);
                localStorage.removeItem("schoolnet_session");
                sessionToken = null;
                currentUser = null;
                showAuth();
            }
        }

        function openApp() {
            document.getElementById("authScreen").classList.add("hidden");
            document.getElementById("appScreen").classList.remove("hidden");
            renderUser();
            renderAchievements();
            loadTasks();
            loadMyTasks();
            loadMoneyRequests();
            loadNotifications();
            loadAdminStats();
            loadComplaints();
            loadEmergencyComplaints();
            loadModerationTasks();
            loadSocial();
            loadBanner();
            loadAchievements();
            loadUserManagement();
            loadSavedPosts();
            loadCitiesAndSchools();
            updateCategoryGrid();
            if (isAdmin() || currentUser?.is_moderator === true) {
                showAdminCheck();
            }
        }

        function showAuth() {
            document.getElementById("appScreen").classList.add("hidden");
            document.getElementById("authScreen").classList.remove("hidden");
        }

        function renderUser() {
            if (!currentUser) return;
            const nickname = currentUser.nickname || "Пользователь";
            const username = currentUser.username || "";
            const role = currentUser.role || "user";
            const balance = Number(currentUser.balance || 0);
            const isVerified = currentUser.is_verified === true || role === "superadmin" || role === "admin";

            document.getElementById("profileNickname").textContent = nickname;
            document.getElementById("profileUsername").textContent = "@" + username;
            document.getElementById("profileRole").textContent = getRoleName(role);

            const badge = document.getElementById("verifiedBadge");
            if (isVerified) { badge.style.display = "inline"; } else { badge.style.display = "none"; }

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
            document.getElementById("profileRatingBig").textContent = (Number(currentUser.rating || 0)).toFixed(2) + " ⭐";
            document.getElementById("reputationReliability").textContent = currentUser.reliability !== undefined ?
                currentUser.reliability : "—";
            document.getElementById("reputationQuality").textContent = currentUser.quality !== undefined ? currentUser
                .quality : "—";
            document.getElementById("reputationSpeed").textContent = currentUser.speed !== undefined ? currentUser.speed :
                "—";
            document.getElementById("reputationOrders").textContent = currentUser.completed || 0;

            if (isAdmin()) document.getElementById("adminNav").classList.remove("hidden");
            else document.getElementById("adminNav").classList.add("hidden");

            const adminPanelTitle = document.getElementById("adminPanelTitle");
            if (isSuperAdmin()) {
                adminPanelTitle.textContent = "👑 Суперадмин";
            } else if (isAdmin()) {
                adminPanelTitle.textContent = "🛡️ Администратор";
            }
        }

        // =========================================================
        // TASKS
        // =========================================================
        async function loadTasks() {
            if (!sessionToken) return;
            document.getElementById("tasksList").innerHTML = '<div class="loading">Загрузка заказов...</div>';
            try {
                const { data, error } = await supabaseClient.rpc("get_tasks", { p_token: sessionToken });
                if (error) throw error;
                cachedTasks = Array.isArray(data) ? data : [];
                renderTasks(cachedTasks, document.getElementById("tasksList"), "feed");
            } catch (error) {
                console.error(error);
                document.getElementById("tasksList").innerHTML =
                    `<div class="empty">Не удалось загрузить заказы.<br><small>${escapeHTML(error.message||"")}</small></div>`;
            }
        }

        async function loadMyTasks() {
            if (!sessionToken) return;
            document.getElementById("myTasksList").innerHTML = '<div class="loading">Загрузка...</div>';
            try {
                const { data, error } = await supabaseClient.rpc("get_my_tasks", { p_token: sessionToken });
                if (error) throw error;
                cachedMyTasks = Array.isArray(data) ? data : [];
                renderTasks(cachedMyTasks, document.getElementById("myTasksList"), "mine");
            } catch (error) {
                console.error(error);
                document.getElementById("myTasksList").innerHTML =
                    `<div class="empty">Не удалось загрузить заказы.<br><small>${escapeHTML(error.message||"")}</small></div>`;
            }
        }

        function renderTasks(tasks, container, mode) {
            let result = [...tasks];
            const search = document.getElementById("taskSearch")?.value?.trim().toLowerCase() || "";
            const filter = document.getElementById("taskFilter")?.value || "all";
            if (mode === "feed") {
                if (search) result = result.filter(t => String(t.title || "").toLowerCase().includes(search) || String(t
                    .description || "").toLowerCase().includes(search));
                if (filter !== "all") result = result.filter(t => t.category === filter);
            }
            if (!result.length) { container.innerHTML =
                    `<div class="empty">${mode==="feed" ? "📭 Сейчас нет подходящих заказов." : "📦 У тебя пока нет заказов."}</div>`; return; }
            const currentId = getUserId();
            container.innerHTML = result.map(task => {
                const status = task.status || "open";
                const ownerId = String(task.owner_id || "");
                const assignedTo = String(task.assigned_to || "");
                const urgent = task.is_urgent === true || task.urgent === true;
                const pinned = task.is_pinned === true || task.pinned === true;
                const cat = categoryMap[task.category] || categoryMap.other;
                let deadlineHTML = "";
                const expires = task.expires_at || task.deadline_at || task.created_at;
                if (expires) deadlineHTML =
                    `<span class="task-tag timer" data-expire="${escapeHTML(expires)}">⏱️ <span class="countdown">...</span></span>`;
                let action = "";
                if (mode === "feed" && status === "open" && ownerId !== String(currentId)) action +=
                    `<button class="task-btn take-btn" onclick="takeTask('${escapeJS(task.id)}')">✋ Взять</button>`;
                if (mode === "mine" && assignedTo === String(currentId) && status === "taken") action +=
                    `<button class="task-btn complete-btn" onclick="completeTask('${escapeJS(task.id)}')">✅ Завершить</button><button class="task-btn secondary-btn" onclick="openTaskChat('${escapeJS(task.id)}')">💬 Чат</button>`;
                if (mode === "mine" && ownerId === String(currentId) && status === "open") action +=
                    `<button class="task-btn danger-btn" onclick="cancelTask('${escapeJS(task.id)}')">❌ Отменить</button>`;
                if (mode === "mine" && (assignedTo === String(currentId) || ownerId === String(currentId))) action +=
                    `<button class="task-btn secondary-btn" onclick="openTaskChat('${escapeJS(task.id)}')">💬 Чат</button>`;
                if (status === "done") action +=
                    `<button class="task-btn secondary-btn" onclick="rateTask('${escapeJS(task.id)}')">⭐ Оценить</button>`;
                return `<div class="task-card ${urgent?"urgent":""} ${pinned?"pinned":""}"><div class="task-top"><div><div class="task-title">${pinned?"📌 ":""}${urgent?"🔥 ":""}${escapeHTML(task.title)}</div></div><div class="task-price">${formatMoney(task.price)}</div></div><div class="task-description">${escapeHTML(task.description||"Описание отсутствует.")}</div><div class="task-meta"><span class="task-tag ${task.category}">${cat.icon} ${cat.label}</span><span class="task-tag">📌 ${escapeHTML(getStatusName(status))}</span>${urgent?'<span class="task-tag urgent">🔥 Срочно • 3 SNK</span>':''}${pinned?'<span class="task-tag">📌 Закреплено</span>':''}${deadlineHTML}</div>${action?`<div class="task-actions">${action}</div>`:''}</div>`;
            }).join("");
            updateCountdowns();
        }

        function getStatusName(s) { switch (s) { case "open": return "Доступен"; case "taken": return "Выполняется"; case "done":
                return "Завершён"; case "cancelled": return "Отменён"; case "moderation": return "На модерации"; default: return s; } }

        function updateCountdowns() { document.querySelectorAll("[data-expire]").forEach(el => { const date = new Date(el
                    .dataset.expire).getTime(); const output = el.querySelector(".countdown"); if (!output) return; const diff =
                    date - Date.now(); if (diff <= 0) { output.textContent = "истёк"; return; } const h = Math.floor(diff /
                    3600000); const m = Math.floor((diff % 3600000) / 60000); const s = Math.floor((diff % 60000) / 1000);
                output.textContent =
                `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; }); }
        setInterval(updateCountdowns, 1000);

        document.getElementById("newOrderPrice").addEventListener("keydown", e => { if (["e", "E", "+", "-"].includes(e.key))
                e.preventDefault(); });
        document.getElementById("newOrderPrice").addEventListener("input", e => { e.target.value = e.target.value.replace(
                /[eE+\-]/g, "").replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
            updateCreateTotal(); });

        function updateCreateTotal() { let price = Number(document.getElementById("newOrderPrice").value || 0); if (price < 15)
                price = 15; let total = price; if (document.getElementById("urgentOrder").checked) total += 3; if (document
                .getElementById("pinnedOrder").checked) total += 12; document.getElementById("createTotalPreview")
                .textContent = formatMoney(total); }
        document.getElementById("urgentOrder").onchange = updateCreateTotal;
        document.getElementById("pinnedOrder").onchange = updateCreateTotal;

        document.getElementById("createTaskBtn").onclick = async () => {
            const title = document.getElementById("newOrderTitle").value.trim();
            const description = document.getElementById("newOrderDescription").value.trim();
            const price = Number(document.getElementById("newOrderPrice").value);
            const category = document.getElementById("selectedCategory").value;
            const button = document.getElementById("createTaskBtn");
            if (!title) return showToast("Введите название заказа.");
            if (!description) return showToast("Введите описание заказа.");
            if (!Number.isFinite(price) || price < 15) return showToast("Минимальная стоимость заказа — 15 SNK.");
            const total = price + (document.getElementById("urgentOrder").checked ? 3 : 0) + (document.getElementById(
                "pinnedOrder").checked ? 12 : 0);
            const balance = Number(currentUser?.balance || 0);
            if (balance < total) return showToast(
                `Недостаточно SNK. Нужно ${formatMoney(total)}, у тебя ${formatMoney(balance)}.`);
            setLoading(button, true, "Создать заказ");
            try {
                const { data, error } = await supabaseClient.rpc("create_task", { p_token: sessionToken, p_title: title,
                    p_description: description, p_price: price, p_category: category });
                if (error) throw error;
                if (!data) throw new Error("Заказ не был создан.");
                document.getElementById("newOrderTitle").value = "";
                document.getElementById("newOrderDescription").value = "";
                document.getElementById("newOrderPrice").value = "";
                document.getElementById("urgentOrder").checked = false;
                document.getElementById("pinnedOrder").checked = false;
                document.getElementById("selectedCategory").value = "study";
                document.querySelectorAll('.category-btn').forEach(btn => btn.classList.toggle('active', btn.dataset
                    .category === 'study'));
                showToast("Заказ создан.");
                await loadTasks();
                await loadMyTasks();
                await checkSession();
                loadModerationTasks();
            } catch (error) { console.error(error);
                showToast(error.message || "Не удалось создать заказ."); } finally { setLoading(button, false,
                    "Создать заказ"); }
        };

        async function takeTask(taskId) {
            if (!sessionToken) return;
            try {
                const { data, error } = await supabaseClient.rpc("take_task", { p_token: sessionToken,
                    p_task_id: taskId });
                if (error) throw error;
                if (!data) throw new Error("Не удалось взять заказ.");
                showToast("Заказ взят.");
                await loadTasks();
                await loadMyTasks();
            } catch (error) { console.error(error);
                showToast(error.message || "Не удалось взять заказ."); }
        }

        async function completeTask(taskId) {
            if (!sessionToken) return;
            if (!confirm("Ты точно выполнил этот заказ?")) return;
            try {
                const { data, error } = await supabaseClient.rpc("complete_task", { p_token: sessionToken,
                    p_task_id: taskId });
                if (error) throw error;
                if (!data) throw new Error("Не удалось завершить заказ.");
                showToast("Заказ отмечен выполненным.");
                await loadTasks();
                await loadMyTasks();
                await checkSession();
            } catch (error) { console.error(error);
                showToast(error.message || "Не удалось завершить заказ."); }
        }

        async function cancelTask(taskId) {
            if (!confirm("Точно отменить этот заказ? Заказ будет удалён безвозвратно.")) return;
            try {
                const { data, error } = await supabaseClient.rpc("cancel_task", { p_token: sessionToken,
                    p_task_id: taskId });
                if (error) throw error;
                if (!data) throw new Error("Заказ не отменён.");
                showToast("🗑️ Заказ удалён. Деньги возвращены.");
                await loadTasks();
                await loadMyTasks();
                await checkSession();
            } catch (error) { console.error(error);
                showToast(error.message || "Не удалось отменить заказ."); }
        }

        async function rateTask(taskId) {
            const rating = prompt("Оценка от 1 до 5:");
            if (rating === null) return;
            const value = Number(rating);
            if (!Number.isInteger(value) || value < 1 || value > 5) return showToast("Оценка должна быть от 1 до 5.");
            try {
                const { error } = await supabaseClient.rpc("rate_task", { p_token: sessionToken, p_task_id: taskId,
                    p_rating: value });
                if (error) throw error;
                showToast("Оценка сохранена.");
            } catch (error) { showToast(error.message || "Не удалось сохранить оценку."); }
        }

        // =========================================================
        // CHAT
        // =========================================================
        async function openTaskChat(taskId) {
            currentChatTaskId = taskId;
            document.getElementById("chatPanel").classList.remove("hidden");
            await loadChatMessages();
        }

        async function loadChatMessages() {
            const box = document.getElementById("chatMessages");
            if (!currentChatTaskId) { box.innerHTML = '<div class="empty">Выбери заказ.</div>'; return; }
            try {
                const { data, error } = await supabaseClient.rpc("get_task_messages", { p_token: sessionToken,
                    p_task_id: currentChatTaskId });
                if (error) throw error;
                if (!Array.isArray(data) || !data.length) { box.innerHTML = '<div class="empty">Сообщений пока нет.</div>'; return; }
                const myId = getUserId();
                box.innerHTML = data.map(msg => {
                    const mine = String(msg.sender_id) === String(myId);
                    return `<div class="message ${mine?"mine":""}"><div class="message-bubble">${escapeHTML(msg.message)}</div><div class="muted" style="font-size:11px;margin-top:3px">${new Date(msg.created_at).toLocaleString("ru-RU")}</div></div>`;
                }).join("");
                box.scrollTop = box.scrollHeight;
            } catch (error) {
                box.innerHTML =
                    `<div class="empty">Чат ещё не подключён к SQL-модулю.<br><small>${escapeHTML(error.message||"")}</small></div>`;
            }
        }

        document.getElementById("sendChatBtn").onclick = async () => {
            const input = document.getElementById("chatInput");
            const message = input.value.trim();
            if (!message || !currentChatTaskId) return;
            try {
                const { error } = await supabaseClient.rpc("send_task_message", { p_token: sessionToken,
                    p_task_id: currentChatTaskId, p_message: message });
                if (error) throw error;
                input.value = "";
                await loadChatMessages();
            } catch (error) { showToast(error.message || "Не удалось отправить сообщение."); }
        };

        // =========================================================
        // MONEY
        // =========================================================
        function showDepositForm() {
            const panel = document.getElementById("moneyFormPanel");
            panel.classList.remove("hidden");
            panel.innerHTML = `
            <h2>⭐ Пополнение SNKoin</h2>
            <div style="background:rgba(0,255,204,.08);border:1px solid rgba(0,255,204,.2);border-radius:12px;padding:14px;margin-bottom:15px;text-align:center;font-size:16px;color:var(--cyan);">
              📤 Отправлять в Telegram: <strong>@winogradik</strong>
            </div>
            <p class="muted" style="margin-bottom:15px;">1 Telegram Star = 0.5 SNK.</p>
            <div class="field"><label>Количество Stars</label><input id="depositStars" type="number" min="15" step="1" placeholder="15"></div>
            <div class="field"><label>Telegram username</label><input id="depositTelegram" type="text" placeholder="@username" oninput="this.value = this.value.replace(/[^a-zA-Z0-9_-]/g, '')"></div>
            <div class="panel" style="background:#0b1113;"><div class="muted">Вы получите:</div><strong id="depositPreview" style="font-size:22px;color:var(--green);">0 SNK</strong></div>
            <button class="main-btn" onclick="createDepositRequest()">Отправить заявку</button>
          `;
            document.getElementById("depositStars").oninput = () => {
                const stars = Number(document.getElementById("depositStars").value || 0);
                document.getElementById("depositPreview").textContent = formatMoney(stars * 0.5);
            };
        }

        function showWithdrawalForm() {
            const panel = document.getElementById("moneyFormPanel");
            panel.classList.remove("hidden");
            panel.innerHTML = `
            <h2>🎁 Вывод SNKoin</h2>
            <p class="muted" style="margin-bottom:15px;">Минимальный вывод — 50 Stars стоимости подарков.</p>
            <div class="field"><label>Подарок</label>
              <select id="withdrawGift">
                <option value="bear">🧸 Мишка — 15 Stars</option>
                <option value="gift">🎁 Подарок — 25 Stars</option>
                <option value="cake">🎂 Тортик — 50 Stars</option>
                <option value="rocket">🚀 Ракета — 50 Stars</option>
                <option value="cup">🏆 Кубок — 50 Stars</option>
                <option value="ring">💍 Кольцо — 100 Stars</option>
              </select>
            </div>
            <div class="field"><label>Количество подарков</label><input id="withdrawAmount" type="number" min="1" step="1" value="1"></div>
            <div class="panel" style="background:#0b1113;"><div class="muted">Стоимость:</div><strong id="giftPreview" style="font-size:22px;color:var(--green);">7.5 SNK</strong></div>
            <div class="field"><label>Telegram username для получения</label><input id="withdrawTelegram" type="text" placeholder="@username" oninput="this.value = this.value.replace(/[^a-zA-Z0-9_-]/g, '')"></div>
            <button class="main-btn" onclick="createWithdrawalRequest()">Отправить заявку</button>
          `;
            const update = () => {
                const gift = document.getElementById("withdrawGift").value;
                const amount = Number(document.getElementById("withdrawAmount").value || 0);
                const prices = { bear: 7.5, gift: 12.5, cake: 25, rocket: 25, cup: 25, ring: 50 };
                document.getElementById("giftPreview").textContent = formatMoney((prices[gift] || 0) * amount);
            };
            document.getElementById("withdrawGift").onchange = update;
            document.getElementById("withdrawAmount").oninput = update;
            update();
        }

        async function createDepositRequest() {
            const stars = Number(document.getElementById("depositStars").value);
            const telegram = document.getElementById("depositTelegram").value.trim();
            if (!Number.isInteger(stars) || stars < 15) return showToast(
                "❌ Минимальное пополнение — 15 Stars (целое число)");
            if (!/^[a-zA-Z0-9_-]+$/.test(telegram)) return showToast(
                "❌ Telegram username может содержать только латиницу, цифры, _ и -");
            const snkoin = stars * 0.5;
            try {
                const userId = getUserId();
                const { error } = await supabaseClient.from("deposit_requests").insert({ user_id: String(userId),
                    telegram_username: telegram || null, stars_amount: stars, snkoin_amount: snkoin,
                    status: "pending" });
                if (error) throw error;
                showToast("Заявка на пополнение отправлена.");
                document.getElementById("moneyFormPanel").classList.add("hidden");
                loadMoneyRequests();
            } catch (error) { console.error(error);
                showToast(error.message || "Не удалось создать заявку."); }
        }

        async function createWithdrawalRequest() {
            const gift = document.getElementById("withdrawGift").value;
            const amount = Number(document.getElementById("withdrawAmount").value);
            const telegram = document.getElementById("withdrawTelegram").value.trim();
            if (!/^[a-zA-Z0-9_-]+$/.test(telegram)) return showToast(
                "❌ Telegram username может содержать только латиницу, цифры, _ и -");
            const prices = { bear: 7.5, gift: 12.5, cake: 25, rocket: 25, cup: 25, ring: 50 };
            const starsPerGift = { bear: 15, gift: 25, cake: 50, rocket: 50, cup: 50, ring: 100 };
            if (!amount || amount < 1) return showToast("Укажи количество подарков.");
            const totalSNK = (prices[gift] || 0) * amount;
            const totalStars = (starsPerGift[gift] || 0) * amount;
            if (totalStars < 50) return showToast("Минимальный вывод — 50 Stars стоимости подарков.");
            if (totalSNK > Number(currentUser?.balance || 0)) return showToast("Недостаточно SNKoin.");
            try {
                const { error } = await supabaseClient.from("withdrawal_requests").insert({ user_id: String(
                        getUserId()), telegram_username: telegram || null, gift_type: gift,
                    amount_snkoin: totalSNK, status: "pending" });
                if (error) throw error;
                showToast("Заявка на вывод отправлена.");
                document.getElementById("moneyFormPanel").classList.add("hidden");
                loadMoneyRequests();
            } catch (error) { console.error(error);
                showToast(error.message || "Не удалось создать заявку."); }
        }

        async function loadMoneyRequests() {
            const box = document.getElementById("moneyRequests");
            if (!currentUser) return;
            box.innerHTML = '<div class="loading">Загрузка...</div>';
            try {
                const userId = String(getUserId());
                const [deposits, withdrawals] = await Promise.all([
                    supabaseClient.from("deposit_requests").select("*").eq("user_id", userId).order("created_at", {
                        ascending: false }),
                    supabaseClient.from("withdrawal_requests").select("*").eq("user_id", userId).order("created_at", {
                        ascending: false })
                ]);
                if (deposits.error) throw deposits.error;
                if (withdrawals.error) throw withdrawals.error;
                const all = [];
                (deposits.data || []).forEach(item => { all.push({ date: item.created_at, status: item.status,
                        text: `⭐ Пополнение: ${item.stars_amount} Stars → ${item.snkoin_amount} SNK` }); });
                (withdrawals.data || []).forEach(item => { all.push({ date: item.created_at, status: item.status,
                        text: `🎁 Вывод: ${item.amount_snkoin} SNK → ${item.gift_type}` }); });
                all.sort((a, b) => new Date(b.date) - new Date(a.date));
                if (!all.length) { box.innerHTML = '<div class="empty">Заявок пока нет.</div>'; return; }
                box.innerHTML = all.map(item =>
                    `<div class="request-card"><div>${escapeHTML(item.text)}</div><div style="margin-top:8px;"><span class="request-status">${escapeHTML(item.status||"pending")}</span></div><div class="muted" style="margin-top:7px;font-size:12px;">${new Date(item.date).toLocaleString("ru-RU")}</div></div>`
                ).join("");
            } catch (error) { console.error(error);
                box.innerHTML =
                    `<div class="empty">Не удалось загрузить заявки.<br><small>${escapeHTML(error.message||"")}</small></div>`; }
        }

        // =========================================================
        // NOTIFICATIONS
        // =========================================================
        async function loadNotifications() {
            const list = document.getElementById("notificationList");
            try {
                const { data, error } = await supabaseClient.rpc("get_notifications", { p_token: sessionToken });
                if (error) throw error;
                const notifications = Array.isArray(data) ? data : [];
                const unread = notifications.filter(n => !n.is_read).length;
                const counter = document.getElementById("notificationCount");
                counter.textContent = unread;
                counter.style.display = unread > 0 ? "flex" : "none";
                if (!notifications.length) { list.innerHTML = '<div class="empty">Уведомлений нет.</div>'; return; }
                list.innerHTML = notifications.slice(0, 30).map(n =>
                    `<div class="notification ${n.is_read?"":"unread"}"><div class="notification-title">${escapeHTML(n.title||"Уведомление")}</div><div class="notification-text">${escapeHTML(n.message||"")}</div></div>`
                ).join("");
            } catch (error) { list.innerHTML = '<div class="empty">Уведомления ещё не подключены.</div>'; }
        }
        document.getElementById("notificationsBtn").onclick = () => { document.querySelector('[data-section="social"]')
                .click(); };

        // =========================================================
        // SOCIAL
        // =========================================================
        async function loadSocial() {
            const feed = document.getElementById("socialFeed");
            try {
                const { data: posts, error: postsError } = await supabaseClient
                    .from("schoolnet_posts")
                    .select("*")
                    .order("created_at", { ascending: false });
                if (postsError) throw postsError;
                if (!posts || !posts.length) {
                    feed.innerHTML = '<div class="empty">Лента пуста. Будь первым!</div>';
                    return;
                }
                const userIds = [...new Set(posts.map(p => p.user_id).filter(Boolean))];
                let usersMap = {};
                if (userIds.length) {
                    const { data: users, error: usersError } = await supabaseClient
                        .from("users")
                        .select("id, username")
                        .in("id", userIds);
                    if (!usersError && users) {
                        usersMap = Object.fromEntries(users.map(u => [u.id, u.username]));
                    }
                }
                feed.innerHTML = posts.map(post => {
                    const username = usersMap[post.user_id] || 'unknown';
                    const isMine = post.user_id === getUserId();
                    return `
                <div class="post-card" id="post-${post.id}">
                  <div class="post-head">
                    <div class="avatar">${username?.[0] || 'U'}</div>
                    <div>
                      <div class="post-author">${escapeHTML(username)} ${isMine ? '👤' : ''}</div>
                      <div class="post-date">${new Date(post.created_at).toLocaleString()}</div>
                    </div>
                    ${isMine ? `<button onclick="deletePost('${post.id}')" style="background:transparent;border:1px solid var(--red);color:var(--red);border-radius:8px;padding:4px 10px;font-size:12px;margin-left:auto;">🗑️</button>` : ''}
                  </div>
                  <div class="post-body">${escapeHTML(post.text)}</div>
                  <div class="post-actions">
                    <button onclick="toggleLike('${post.id}')">❤️ <span id="like-${post.id}">${post.likes_count || 0}</span></button>
                    <button onclick="toggleComments('${post.id}')">💬 <span id="comment-count-${post.id}">${post.comments_count || 0}</span></button>
                    <button onclick="toggleRepost('${post.id}')">🔁 <span id="repost-${post.id}">${post.reposts_count || 0}</span></button>
                    <button onclick="savePost('${post.id}')">🔖</button>
                    <button onclick="openReportModal('${post.id}')">🚨</button>
                  </div>
                  <div class="comments-box" id="comments-${post.id}" style="display:none;">
                    <div id="comments-list-${post.id}"><div class="muted">Загрузка...</div></div>
                    <div class="comment-input-row">
                      <input id="comment-input-${post.id}" placeholder="Напиши комментарий...">
                      <button class="secondary-btn" onclick="sendComment('${post.id}')">Отправить</button>
                    </div>
                  </div>
                </div>
              `;
                }).join('');
            } catch (error) {
                console.error(error);
                feed.innerHTML =
                    `<div class="empty">Не удалось загрузить ленту.<br><small>${escapeHTML(error.message||"")}</small></div>`;
            }
        }

        async function toggleLike(postId) {
            if (!sessionToken) return showToast("Авторизуйся");
            try {
                const { data, error } = await supabaseClient.rpc("toggle_post_like", { p_token: sessionToken,
                    p_post_id: postId });
                if (error) throw error;
                const likeEl = document.getElementById(`like-${postId}`);
                if (likeEl) likeEl.textContent = Number(likeEl.textContent || 0) + (data ? 1 : -1);
            } catch (e) { showToast(e.message); }
        }

        function toggleComments(postId) {
            const box = document.getElementById(`comments-${postId}`);
            if (box.style.display === 'none') {
                box.style.display = 'block';
                loadComments(postId);
            } else {
                box.style.display = 'none';
            }
        }

        async function loadComments(postId) {
            const list = document.getElementById(`comments-list-${postId}`);
            if (!list) return;
            list.innerHTML = '<div class="muted">Загрузка...</div>';
            try {
                const { data, error } = await supabaseClient
                    .from("post_comments")
                    .select("*, user:users(username)")
                    .eq("post_id", postId)
                    .order("created_at", { ascending: true });
                if (error) throw error;
                if (!data || !data.length) { list.innerHTML = '<div class="muted">Комментариев пока нет</div>'; return; }
                list.innerHTML = data.map(c =>
                    `<div class="comment-item"><strong>${escapeHTML(c.user?.username || 'unknown')}</strong> <span>${escapeHTML(c.text)}</span></div>`
                ).join('');
            } catch (e) { list.innerHTML = `<div class="muted">Ошибка: ${escapeHTML(e.message)}</div>`; }
        }

        async function sendComment(postId) {
            const input = document.getElementById(`comment-input-${postId}`);
            const text = input.value.trim();
            if (!text) return;
            try {
                const { error } = await supabaseClient.rpc("add_post_comment", { p_token: sessionToken,
                    p_post_id: postId, p_text: text });
                if (error) throw error;
                input.value = '';
                const countEl = document.getElementById(`comment-count-${postId}`);
                if (countEl) countEl.textContent = Number(countEl.textContent || 0) + 1;
                loadComments(postId);
            } catch (e) { showToast(e.message || 'Не удалось отправить комментарий'); }
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.target.id && e.target.id.startsWith('comment-input-')) {
                const postId = e.target.id.replace('comment-input-', '');
                sendComment(postId);
            }
        });

        document.getElementById("publishPostBtn").onclick = async () => {
            const text = document.getElementById("postInput").value.trim();
            if (!text) return showToast("Напиши что-нибудь.");
            try {
                const { error } = await supabaseClient.rpc("create_post", { p_token: sessionToken, p_text: text });
                if (error) throw error;
                document.getElementById("postInput").value = "";
                showToast("📝 Пост опубликован!");
                loadSocial();
            } catch (e) { showToast(e.message || "Не удалось опубликовать."); }
        };

        async function toggleRepost(postId) {
            if (!sessionToken) return showToast("Авторизуйся");
            try {
                const { data, error } = await supabaseClient.rpc("toggle_post_repost", { p_token: sessionToken,
                    p_post_id: postId });
                if (error) throw error;
                const repostEl = document.getElementById(`repost-${postId}`);
                if (repostEl) repostEl.textContent = Number(repostEl.textContent || 0) + (data ? 1 : -1);
            } catch (e) { showToast(e.message); }
        }

        async function savePost(postId) {
            if (!sessionToken) return showToast("Авторизуйся");
            try {
                const { data, error } = await supabaseClient.rpc("save_post", { p_token: sessionToken,
                    p_post_id: postId });
                if (error) throw error;
                showToast(data ? "🔖 Сохранено" : "❌ Не удалось сохранить");
                loadSavedPosts();
            } catch (e) { showToast(e.message); }
        }

        async function deletePost(postId) {
            if (!confirm("Точно удалить этот пост?")) return;
            try {
                const { error } = await supabaseClient
                    .from("schoolnet_posts")
                    .delete()
                    .eq("id", postId)
                    .eq("user_id", getUserId());
                if (error) throw error;
                showToast("🗑️ Пост удалён");
                loadSocial();
            } catch (e) { showToast(e.message || "Не удалось удалить пост"); }
        }

        // =========================================================
        // REPORT MODAL
        // =========================================================
        let reportTarget = null;

        function openReportModal(postId) {
            reportTarget = postId;
            document.getElementById("reportReason")?.value = "";
            document.getElementById("reportCritical")?.checked = false;
            const modal = document.getElementById("reportModal");
            if (modal) modal.classList.remove("hidden");
            else showToast("Модальное окно жалоб ещё не подключено.");
        }

        function closeReportModal() {
            const modal = document.getElementById("reportModal");
            if (modal) modal.classList.add("hidden");
            reportTarget = null;
        }

        async function submitReport() {
            const reason = document.getElementById("reportReason")?.value.trim();
            if (!reason) return showToast("Укажите причину жалобы");
            const isCritical = document.getElementById("reportCritical")?.checked || false;
            if (isCritical && !isSuperAdmin()) {
                return showToast("❌ Только суперадмин может отправлять экстренные жалобы");
            }
            try {
                const { error } = await supabaseClient.rpc("report_post", {
                    p_token: sessionToken,
                    p_post_id: reportTarget,
                    p_reason: reason,
                    p_is_critical: isCritical
                });
                if (error) throw error;
                showToast(isCritical ? "🚨 Экстренная жалоба отправлена" : "✅ Жалоба отправлена");
                closeReportModal();
                loadComplaints();
                loadEmergencyComplaints();
            } catch (e) { showToast(e.message || "Ошибка отправки жалобы"); }
        }

        // =========================================================
        // SAVED POSTS
        // =========================================================
        async function loadSavedPosts() {
            const box = document.getElementById("savedPostsList");
            if (!box) return;
            try {
                const userId = getUserId();
                const { data: saves, error: savesError } = await supabaseClient
                    .from("post_saves")
                    .select("post_id")
                    .eq("user_id", userId)
                    .order("created_at", { ascending: false });
                if (savesError) throw savesError;

                if (!saves || !saves.length) {
                    box.innerHTML = '<div class="empty">У тебя пока нет сохранённых постов.</div>';
                    return;
                }

                const postIds = saves.map(s => s.post_id);
                const { data: posts, error: postsError } = await supabaseClient
                    .from("schoolnet_posts")
                    .select("*")
                    .in("id", postIds)
                    .order("created_at", { ascending: false });
                if (postsError) throw postsError;

                if (!posts || !posts.length) {
                    box.innerHTML = '<div class="empty">Посты не найдены.</div>';
                    return;
                }

                const userIds = [...new Set(posts.map(p => p.user_id).filter(Boolean))];
                let usersMap = {};
                if (userIds.length) {
                    const { data: users, error: usersError } = await supabaseClient
                        .from("users")
                        .select("id, username")
                        .in("id", userIds);
                    if (!usersError && users) {
                        usersMap = Object.fromEntries(users.map(u => [u.id, u.username]));
                    }
                }

                box.innerHTML = posts.map(post => {
                    const username = usersMap[post.user_id] || 'unknown';
                    return `
                <div class="post-card" id="saved-post-${post.id}">
                  <div class="post-head">
                    <div class="avatar">${username?.[0] || 'U'}</div>
                    <div>
                      <div class="post-author">${escapeHTML(username)}</div>
                      <div class="post-date">${new Date(post.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <div class="post-body">${escapeHTML(post.text)}</div>
                  <div class="post-actions">
                    <button onclick="unsavePost('${post.id}')" style="background:rgba(255,77,90,.1);border:1px solid var(--red);color:var(--red);border-radius:9px;padding:7px 10px;">❌ Убрать из сохранённых</button>
                  </div>
                </div>
              `;
                }).join('');
            } catch (e) {
                box.innerHTML = `<div class="empty">Ошибка: ${escapeHTML(e.message)}</div>`;
                console.error(e);
            }
        }

        async function unsavePost(postId) {
            try {
                const { error } = await supabaseClient
                    .from("post_saves")
                    .delete()
                    .eq("post_id", postId)
                    .eq("user_id", getUserId());
                if (error) throw error;
                showToast("❌ Убрано из сохранённых");
                loadSavedPosts();
            } catch (e) { showToast(e.message); }
        }

        // =========================================================
        // SEARCH
        // =========================================================
        document.getElementById("globalSearch").addEventListener("input", async e => {
            const q = e.target.value.trim();
            if (!q) { document.getElementById("searchResults").textContent = "Начни вводить запрос."; return; }
            document.getElementById("searchResults").textContent = "Поиск...";
            try {
                const { data, error } = await supabaseClient.rpc("search_users", { p_token: sessionToken,
                    p_query: q });
                if (error) throw error;
                if (!Array.isArray(data) || !data.length) { document.getElementById("searchResults").textContent =
                        "Ничего не найдено."; return; }
                document.getElementById("searchResults").innerHTML = data.map(user =>
                    `<div class="request-card"><strong>${escapeHTML(user.nickname||user.username)}</strong><div class="muted">@${escapeHTML(user.username||"")}</div><button class="secondary-btn" style="margin-top:8px;" onclick="followUser('${escapeJS(user.id)}')">👥 Подписаться</button></div>`
                ).join("");
            } catch (error) { document.getElementById("searchResults").textContent =
                    "Модуль поиска пользователей ещё не подключён."; }
        });

        async function followUser(userId) {
            try {
                const { error } = await supabaseClient.rpc("follow_user", { p_token: sessionToken,
                    p_user_id: userId });
                if (error) throw error;
                showToast("Подписка оформлена.");
            } catch (error) { showToast(error.message || "Не удалось подписаться."); }
        }

        // =========================================================
        // ACHIEVEMENTS
        // =========================================================
        function renderAchievements() {
            const completed = Number(currentUser?.completed || 0);
            const balance = Number(currentUser?.total_earned || currentUser?.earned || 0);
            const rating = Number(currentUser?.rating || 0);
            const achievements = [
                ["📦", "Первый заказ", "Выполнить первый заказ", completed >= 1],
                ["🔥", "10 заказов", "Выполнить 10 заказов", completed >= 10],
                ["🏆", "50 заказов", "Выполнить 50 заказов", completed >= 50],
                ["💎", "100 заказов", "Выполнить 100 заказов", completed >= 100],
                ["💰", "Первые 100 SNK", "Заработать 100 SNK", balance >= 100],
                ["💰", "1000 SNK", "Заработать 1000 SNK", balance >= 1000],
                ["⭐", "Рейтинг 5.0", "Получить рейтинг 5.0", rating >= 5],
                ["🛡️", "Надёжный", "Высокая репутация", Number(currentUser?.reliability || 0) >= 4.8]
            ];
            document.getElementById("achievementGrid").innerHTML = achievements.map(a =>
                `<div class="achievement ${a[3]?"done":""}"><div class="achievement-icon">${a[0]}</div><div class="achievement-name">${escapeHTML(a[1])}</div><div class="achievement-desc">${escapeHTML(a[2])}</div></div>`
            ).join("");
        }

        // =========================================================
        // ADMIN
        // =========================================================
        async function loadAdminStats() {
            if (!isAdmin()) return;
            const box = document.getElementById("adminContent");
            try {
                const { data, error } = await supabaseClient.rpc("get_admin_stats", { p_token: sessionToken });
                if (error) throw error;
                if (data) {
                    box.innerHTML = `
                <div class="admin-stats">
                  <div class="admin-stat">👥 Пользователи<strong>${data.users || 0}</strong></div>
                  <div class="admin-stat">📦 Заказы<strong>${data.tasks || 0}</strong></div>
                  <div class="admin-stat">🟢 Активные<strong>${data.active_tasks || 0}</strong></div>
                  <div class="admin-stat">🚨 Жалобы<strong>${data.reports || 0}</strong></div>
                </div>
                ${isSuperAdmin() ? `
                  <div style="margin-top:15px;background:#0b1113;padding:15px;border-radius:12px;">
                    <h3>💰 Накрутка баланса</h3>
                    <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:10px;">
                      <input id="adminUserId" placeholder="ID пользователя" style="padding:10px;border-radius:10px;border:1px solid var(--border);background:#0b1113;color:white;">
                      <input id="adminBalanceAmount" type="number" placeholder="Сумма" style="padding:10px;border-radius:10px;border:1px solid var(--border);background:#0b1113;color:white;">
                      <button class="secondary-btn" onclick="addBalance()">➕ Добавить</button>
                    </div>
                  </div>
                  <div style="margin-top:15px;background:#0b1113;padding:15px;border-radius:12px;">
                    <h3>🖼️ Баннер</h3>
                    <div class="field"><label>Текст</label><input id="bannerText" placeholder="Заголовок баннера"></div>
                    <div class="field"><label>Описание</label><input id="bannerDesc" placeholder="Описание"></div>
                    <div class="field"><label>Ссылка</label><input id="bannerLink" placeholder="https://..."></div>
                    <div class="field"><label>Фон</label><input id="bannerBg" placeholder="#00ffcc или https://..."></div>
                    <button class="secondary-btn" onclick="updateBanner()">💾 Сохранить</button>
                  </div>
                  <div style="margin-top:15px;background:#0b1113;padding:15px;border-radius:12px;">
                    <h3>🚨 Жалобы</h3>
                    <div id="complaintsList"><div class="muted">Загрузка...</div></div>
                  </div>
                  <div style="margin-top:15px;background:#0b1113;padding:15px;border-radius:12px;">
                    <h3>🚨⚡ Экстренные жалобы</h3>
                    <div id="emergencyComplaintsList"><div class="muted">Загрузка...</div></div>
                  </div>
                  <div style="margin-top:15px;background:#0b1113;padding:15px;border-radius:12px;">
                    <h3>📋 На модерации</h3>
                    <div id="moderationList"><div class="muted">Загрузка...</div></div>
                  </div>
                  <div style="margin-top:15px;background:#0b1113;padding:15px;border-radius:12px;">
                    <h3>🏆 Управление достижениями</h3>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                      <div class="field"><label>Код</label><input id="newAchievementCode" placeholder="first_order"></div>
                      <div class="field"><label>Название</label><input id="newAchievementTitle" placeholder="Первый заказ"></div>
                      <div class="field"><label>Описание</label><input id="newAchievementDesc" placeholder="Выполнить первый заказ"></div>
                      <div class="field"><label>Иконка</label><input id="newAchievementIcon" placeholder="📦"></div>
                    </div>
                    <button class="secondary-btn" onclick="addAchievement()">➕ Добавить</button>
                    <div id="achievementList" style="margin-top:12px;"><div class="muted">Загрузка...</div></div>
                  </div>
                  <div style="margin-top:15px;background:#0b1113;padding:15px;border-radius:12px;">
                    <h3>🏙️ Управление городами и школами</h3>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                      <div>
                        <div class="field"><label>Название города</label><input id="newCityName" placeholder="Новый город"></div>
                        <button class="secondary-btn" onclick="addCity()">➕ Добавить</button>
                      </div>
                      <div>
                        <div class="field"><label>Название школы</label><input id="newSchoolName" placeholder="Новая школа"></div>
                        <div class="field"><label>Город</label><select id="newSchoolCity"></select></div>
                        <button class="secondary-btn" onclick="addSchool()">➕ Добавить</button>
                      </div>
                    </div>
                    <div id="citySchoolList"><div class="muted">Загрузка...</div></div>
                  </div>
                  <div style="margin-top:15px;background:#0b1113;padding:15px;border-radius:12px;">
                    <h3>👥 Управление пользователями</h3>
                    <div id="userManagementList"><div class="muted">Загрузка...</div></div>
                  </div>
                ` : ''}
              `;
                }
                if (isSuperAdmin()) {
                    loadComplaints();
                    loadEmergencyComplaints();
                    loadModerationTasks();
                    loadAchievements();
                    loadUserManagement();
                    loadCitiesAndSchools();
                }
            } catch (error) {
                console.warn("Admin stats:", error);
                box.innerHTML = `<div class="muted">Ошибка загрузки статистики</div>`;
            }
        }

        async function loadComplaints() {
            if (!isSuperAdmin()) return;
            const box = document.getElementById("complaintsList");
            if (!box) return;
            try {
                const { data, error } = await supabaseClient
                    .from("complaints")
                    .select("*, reporter:users!reporter_id(username), target:users!target_user_id(username)")
                    .order("created_at", { ascending: false });
                if (error) throw error;
                if (!data || !data.length) { box.innerHTML = '<div class="empty">Жалоб пока нет.</div>'; return; }
                box.innerHTML = data.map(c =>
                    `<div class="request-card"><b>${escapeHTML(c.reason)}</b><span style="display:block;margin-top:5px;opacity:.7;">👤 ${escapeHTML(c.reporter?.username || 'unknown')} → 🎯 ${escapeHTML(c.target?.username || 'unknown')}</span><p style="margin-top:8px;">${escapeHTML(c.description || '')}</p><div style="margin-top:8px;"><span class="request-status">${escapeHTML(c.status || 'pending')}</span>${c.is_critical ? ' <span class="request-status" style="background:rgba(255,0,0,.2);color:#ff4d5a;">⚡ Критично</span>' : ''}</div><div class="muted" style="margin-top:7px;font-size:12px;">${new Date(c.created_at).toLocaleString()}</div></div>`
                ).join("");
            } catch (e) { box.innerHTML = `<div class="empty">Ошибка загрузки жалоб: ${escapeHTML(e.message)}</div>`; }
        }

        async function loadEmergencyComplaints() {
            if (!isSuperAdmin()) return;
            const box = document.getElementById("emergencyComplaintsList");
            if (!box) return;
            try {
                const { data, error } = await supabaseClient
                    .from("complaints")
                    .select("*, reporter:users!reporter_id(username), target:users!target_user_id(username)")
                    .eq("is_critical", true)
                    .order("created_at", { ascending: false });
                if (error) throw error;
                if (!data || !data.length) { box.innerHTML = '<div class="empty">Экстренных жалоб нет.</div>'; return; }
                box.innerHTML = data.map(c =>
                    `<div class="request-card" style="border-color:var(--red);"><b style="color:var(--red);">🚨⚡ ${escapeHTML(c.reason)}</b><span style="display:block;margin-top:5px;opacity:.7;">👤 ${escapeHTML(c.reporter?.username || 'unknown')} → 🎯 ${escapeHTML(c.target?.username || 'unknown')}</span><p style="margin-top:8px;">${escapeHTML(c.description || '')}</p><div style="margin-top:8px;"><span class="request-status">${escapeHTML(c.status || 'pending')}</span></div><div class="muted" style="margin-top:7px;font-size:12px;">${new Date(c.created_at).toLocaleString()}</div></div>`
                ).join("");
            } catch (e) { box.innerHTML =
                `<div class="empty">Ошибка загрузки экстренных жалоб: ${escapeHTML(e.message)}</div>`; }
        }

        async function loadModerationTasks() {
            if (!isSuperAdmin()) return;
            const box = document.getElementById("moderationList");
            if (!box) return;
            try {
                const { data, error } = await supabaseClient
                    .from("tasks")
                    .select("*")
                    .eq("status", "moderation")
                    .order("created_at", { ascending: false });
                if (error) throw error;
                if (!data || !data.length) { box.innerHTML = '<div class="empty">Заказов на модерации нет</div>'; return; }
                box.innerHTML = data.map(task => `
              <div class="request-card">
                <b>${escapeHTML(task.title)}</b>
                <p>${escapeHTML(task.description)}</p>
                <div style="display:flex;gap:10px;margin-top:8px;">
                  <button class="secondary-btn" onclick="approveTask('${task.id}')">✅ Одобрить</button>
                  <button class="danger-btn task-btn" onclick="rejectTask('${task.id}')">❌ Отклонить</button>
                </div>
              </div>
            `).join("");
            } catch (e) { box.innerHTML = `<div class="muted">Ошибка: ${escapeHTML(e.message)}</div>`; }
        }

        async function approveTask(taskId) {
            try {
                const { error } = await supabaseClient
                    .from("tasks")
                    .update({ status: "open" })
                    .eq("id", taskId);
                if (error) throw error;
                showToast("✅ Заказ одобрен");
                loadModerationTasks();
                loadTasks();
            } catch (e) { showToast(e.message); }
        }

        async function rejectTask(taskId) {
            try {
                const { error } = await supabaseClient
                    .from("tasks")
                    .delete()
                    .eq("id", taskId);
                if (error) throw error;
                showToast("❌ Заказ отклонён");
                loadModerationTasks();
                loadTasks();
            } catch (e) { showToast(e.message); }
        }

        async function addBalance() {
            const userId = document.getElementById("adminUserId").value.trim();
            const amount = Number(document.getElementById("adminBalanceAmount").value);
            if (!userId || !amount) return showToast("Введите ID и сумму");
            try {
                const { error } = await supabaseClient.rpc("add_balance", { p_user_id: userId, p_amount: amount });
                if (error) throw error;
                showToast(`💰 ${amount} SNK добавлено`);
                document.getElementById("adminUserId").value = "";
                document.getElementById("adminBalanceAmount").value = "";
                loadAdminStats();
                loadUserManagement();
            } catch (e) { showToast(e.message); }
        }

        async function loadBanner() {
            try {
                const { data, error } = await supabaseClient
                    .from("banner_settings")
                    .select("*")
                    .eq("id", true)
                    .single();
                if (error) throw error;
                if (data) {
                    if (data.title) document.getElementById("bannerTitle").textContent = data.title;
                    if (data.description) document.getElementById("bannerDesc").textContent = data.description;
                    if (data.link) document.getElementById("mainBanner").onclick = () => window.open(data.link, '_blank');
                    if (data.background) {
                        if (data.background.startsWith('http') || data.background.startsWith('#')) {
                            document.getElementById("mainBanner").style.backgroundImage = `url('${data.background}')`;
                        } else {
                            document.getElementById("mainBanner").style.background = data.background;
                        }
                    }
                }
            } catch (e) { console.warn("Banner not loaded:", e); }
        }

        async function updateBanner() {
            const title = document.getElementById("bannerText").value.trim();
            const desc = document.getElementById("bannerDesc").value.trim();
            const link = document.getElementById("bannerLink").value.trim();
            const bg = document.getElementById("bannerBg").value.trim();
            try {
                const { error } = await supabaseClient
                    .from("banner_settings")
                    .update({ title, description: desc, link, background: bg, updated_at: new Date().toISOString() })
                    .eq("id", true);
                if (error) throw error;
                showToast("✅ Баннер обновлён");
                loadBanner();
            } catch (e) { showToast(e.message); }
        }

        async function loadAchievements() {
            if (!isSuperAdmin()) return;
            const box = document.getElementById("achievementList");
            if (!box) return;
            try {
                const { data, error } = await supabaseClient
                    .from("achievements")
                    .select("*")
                    .order("created_at", { ascending: false });
                if (error) throw error;
                if (!data || !data.length) { box.innerHTML = '<div class="muted">Достижений пока нет.</div>'; return; }
                box.innerHTML = data.map(a =>
                    `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);"><div><span style="font-size:20px;">${escapeHTML(a.icon || '🏆')}</span> <strong>${escapeHTML(a.title)}</strong> <span class="muted" style="font-size:12px;">${escapeHTML(a.code)}</span><span class="muted" style="font-size:12px;display:block;">${escapeHTML(a.description || '')}</span></div><button class="danger-btn task-btn" onclick="deleteAchievement('${a.id}')" style="padding:5px 10px;font-size:12px;">🗑️</button></div>`
                ).join("");
            } catch (e) { box.innerHTML = `<div class="muted">Ошибка загрузки: ${escapeHTML(e.message)}</div>`; }
        }

        async function addAchievement() {
            const code = document.getElementById("newAchievementCode").value.trim();
            const title = document.getElementById("newAchievementTitle").value.trim();
            const description = document.getElementById("newAchievementDesc").value.trim();
            const icon = document.getElementById("newAchievementIcon").value.trim() || "🏆";
            if (!code || !title) return showToast("Заполните код и название");
            if (code.includes(" ")) return showToast("Код не может содержать пробелы");
            try {
                const { error } = await supabaseClient
                    .from("achievements")
                    .insert({ code, title, description, icon });
                if (error) throw error;
                showToast("✅ Достижение добавлено");
                document.getElementById("newAchievementCode").value = "";
                document.getElementById("newAchievementTitle").value = "";
                document.getElementById("newAchievementDesc").value = "";
                document.getElementById("newAchievementIcon").value = "";
                loadAchievements();
            } catch (e) { showToast(e.message || "Не удалось добавить достижение"); }
        }

        async function deleteAchievement(id) {
            if (!confirm("Точно удалить достижение?")) return;
            try {
                const { error } = await supabaseClient
                    .from("achievements")
                    .delete()
                    .eq("id", id);
                if (error) throw error;
                showToast("🗑️ Достижение удалено");
                loadAchievements();
            } catch (e) { showToast(e.message || "Не удалось удалить"); }
        }

        async function loadUserManagement() {
            if (!isSuperAdmin()) return;
            const box = document.getElementById("userManagementList");
            if (!box) return;
            try {
                const { data, error } = await supabaseClient
                    .from("users")
                    .select("*")
                    .order("created_at", { ascending: false });
                if (error) throw error;
                if (!data || !data.length) { box.innerHTML = '<div class="empty">Пользователей нет.</div>'; return; }
                box.innerHTML = data.map(user => `
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);align-items:center;">
                <div>
                  <strong>${escapeHTML(user.username)}</strong>
                  <span class="muted" style="font-size:12px;display:block;">${escapeHTML(user.nickname || '')}</span>
                </div>
                <div style="font-size:12px;">
                  ${user.is_banned ? '🚫 Забанен' : user.is_frozen ? '❄️ Заморожен' : '🟢 Активен'}
                  ${user.can_post === false ? ' 🚫 Посты запрещены' : ''}
                </div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;">
                  <button class="secondary-btn" style="padding:4px 8px;font-size:11px;" onclick="toggleBan('${user.id}')">${user.is_banned ? '🔓 Разбанить' : '🔒 Забанить'}</button>
                  <button class="secondary-btn" style="padding:4px 8px;font-size:11px;" onclick="toggleFreeze('${user.id}')">${user.is_frozen ? '❄️ Разморозить' : '❄️ Заморозить'}</button>
                  <button class="secondary-btn" style="padding:4px 8px;font-size:11px;" onclick="togglePost('${user.id}')">${user.can_post === false ? '✅ Разрешить посты' : '🚫 Запретить посты'}</button>
                  <button class="secondary-btn" style="padding:4px 8px;font-size:11px;" onclick="toggleVerified('${user.id}')">${user.is_verified ? '✅ Снять галочку' : '🔵 Выдать галочку'}</button>
                </div>
                <button class="danger-btn task-btn" style="padding:4px 8px;font-size:11px;" onclick="fineUser('${user.id}')">💰 Штраф</button>
              </div>
            `).join("");
            } catch (e) { box.innerHTML = `<div class="muted">Ошибка: ${escapeHTML(e.message)}</div>`; }
        }

        async function toggleBan(userId) {
            try {
                const { data, error } = await supabaseClient.rpc("toggle_ban", { p_user_id: userId });
                if (error) throw error;
                showToast(data ? '✅ Статус обновлён' : '❌ Ошибка');
                loadUserManagement();
            } catch (e) { showToast(e.message); }
        }

        async function toggleFreeze(userId) {
            try {
                const { data, error } = await supabaseClient.rpc("toggle_freeze", { p_user_id: userId });
                if (error) throw error;
                showToast(data ? '✅ Статус обновлён' : '❌ Ошибка');
                loadUserManagement();
            } catch (e) { showToast(e.message); }
        }

        async function togglePost(userId) {
            try {
                const { data, error } = await supabaseClient.rpc("toggle_can_post", { p_user_id: userId });
                if (error) throw error;
                showToast(data ? '✅ Статус обновлён' : '❌ Ошибка');
                loadUserManagement();
            } catch (e) { showToast(e.message); }
        }

        async function toggleVerified(userId) {
            try {
                const { data, error } = await supabaseClient.rpc("toggle_verified", { p_user_id: userId });
                if (error) throw error;
                showToast(data ? '✅ Галочка выдана' : '🔵 Галочка снята');
                loadUserManagement();
            } catch (e) { showToast(e.message); }
        }

        async function fineUser(userId) {
            const amount = prompt("Сумма штрафа (SNK):");
            if (!amount) return;
            const reason = prompt("Причина штрафа:");
            if (!reason) return;
            try {
                const { data, error } = await supabaseClient.rpc("fine_user", { p_user_id: userId, p_amount: Number(
                        amount), p_reason: reason });
                if (error) throw error;
                showToast(`💰 Штраф ${amount} SNK выписан`);
                loadUserManagement();
                loadAdminStats();
            } catch (e) { showToast(e.message); }
        }

        // =========================================================
        // CITIES & SCHOOLS
        // =========================================================
        async function loadCitiesAndSchools() {
            if (!isSuperAdmin()) return;
            const box = document.getElementById("citySchoolList");
            if (!box) return;
            try {
                const { data: cities, error: citiesError } = await supabaseClient
                    .from("cities")
                    .select("*, schools(*)")
                    .order("name");
                if (citiesError) throw citiesError;
                const citySelect = document.getElementById("newSchoolCity");
                if (citySelect && cities && cities.length) {
                    citySelect.innerHTML = cities.map(c =>
                        `<option value="${c.id}">${escapeHTML(c.name)}</option>`
                    ).join('');
                }
                if (!cities || !cities.length) {
                    box.innerHTML = '<div class="muted">Городов пока нет.</div>';
                    return;
                }
                box.innerHTML = cities.map(city => `
              <div style="padding:8px 0;border-bottom:1px solid var(--border);">
                <strong>🏙️ ${escapeHTML(city.name)}</strong>
                <div style="margin-left:15px;font-size:13px;color:var(--muted);">
                  ${city.schools && city.schools.length 
                    ? city.schools.map(s => `🏫 ${escapeHTML(s.name)}`).join(' • ')
                    : 'Школ нет'
                  }
                </div>
              </div>
            `).join('');
            } catch (e) { box.innerHTML = `<div class="muted">Ошибка: ${escapeHTML(e.message)}</div>`; }
        }

        async function addCity() {
            const name = document.getElementById("newCityName").value.trim();
            if (!name) return showToast("Введите название города");
            try {
                const { error } = await supabaseClient.from("cities").insert({ name });
                if (error) throw error;
                showToast(`✅ Город "${name}" добавлен`);
                document.getElementById("newCityName").value = "";
                loadCitiesAndSchools();
                loadUserManagement();
            } catch (e) { showToast(e.message); }
        }

        async function addSchool() {
            const name = document.getElementById("newSchoolName").value.trim();
            const cityId = document.getElementById("newSchoolCity").value;
            if (!name) return showToast("Введите название школы");
            if (!cityId) return showToast("Выберите город");
            try {
                const { error } = await supabaseClient.from("schools").insert({ name, city_id: cityId });
                if (error) throw error;
                showToast(`✅ Школа "${name}" добавлена`);
                document.getElementById("newSchoolName").value = "";
                loadCitiesAndSchools();
                loadUserManagement();
            } catch (e) { showToast(e.message); }
        }

        // =========================================================
        // ADMIN CHECK MODAL
        // =========================================================
        function showAdminCheck() {
            const modal = document.getElementById('adminCheckModal');
            if (!modal) return;
            if (!isAdmin() && currentUser?.is_moderator !== true) return;
            if (localStorage.getItem('admin_check_done') === 'true') return;
            modal.classList.remove('hidden');

            const check1 = document.getElementById('adminCheckRecording');
            const check2 = document.getElementById('adminCheckRules');
            const check3 = document.getElementById('adminCheckCredentials');
            const btn = document.getElementById('adminStartBtn');

            function updateCards() {
                const card1 = document.getElementById('adminCheckCard1');
                const card2 = document.getElementById('adminCheckCard2');
                const card3 = document.getElementById('adminCheckCard3');
                if (card1) card1.style.borderColor = check1.checked ? 'var(--cyan)' : 'var(--border)';
                if (card2) card2.style.borderColor = check2.checked ? 'var(--cyan)' : 'var(--border)';
                if (card3) card3.style.borderColor = check3.checked ? 'var(--cyan)' : 'var(--border)';
            }

            function updateButton() {
                const all = check1.checked && check2.checked && check3.checked;
                btn.disabled = !all;
                btn.style.opacity = all ? '1' : '0.4';
                btn.style.cursor = all ? 'pointer' : 'not-allowed';
                btn.textContent = all ? '🚀 Войти в панель управления' : '⏳ Подтвердите все пункты';
                updateCards();
            }

            check1.onchange = updateButton;
            check2.onchange = updateButton;
            check3.onchange = updateButton;

            btn.onclick = function() {
                if (btn.disabled) return;
                localStorage.setItem('admin_check_done', 'true');
                modal.classList.add('hidden');
                document.querySelector('[data-section="admin"]')?.click();
            };
        }

        // =========================================================
        // NAVIGATION
        // =========================================================
        document.querySelectorAll(".nav-btn").forEach(button => {
            button.addEventListener("click", async () => {
                const section = button.dataset.section;
                document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
                button.classList.add("active");
                document.querySelectorAll(".section").forEach(el => el.classList.remove("active"));
                const target = document.getElementById("section-" + section);
                if (target) target.classList.add("active");
                if (section === "feed") await loadTasks();
                if (section === "orders") await loadMyTasks();
                if (section === "money") await loadMoneyRequests();
                if (section === "social") { await loadSocial();
                    await loadNotifications(); }
                if (section === "saved") await loadSavedPosts();
                if (section === "admin") { await loadAdminStats();
                    await loadComplaints();
                    await loadEmergencyComplaints();
                    await loadModerationTasks();
                    await loadAchievements();
                    await loadUserManagement();
                    await loadCitiesAndSchools(); }
            });
        });

        document.getElementById("taskSearch").addEventListener("input", () => renderTasks(cachedTasks, document.getElementById(
            "tasksList"), "feed"));
        document.getElementById("taskFilter").addEventListener("change", () => renderTasks(cachedTasks, document.getElementById(
            "tasksList"), "feed"));
        document.getElementById("refreshTasksBtn").onclick = loadTasks;
        document.getElementById("refreshMyTasksBtn").onclick = loadMyTasks;

        document.getElementById("logoutBtn").onclick = async () => {
            if (sessionToken) { try { await supabaseClient.rpc("logout_user", { p_token: sessionToken }); } catch (e) { console
                        .warn(e); } }
            localStorage.removeItem("schoolnet_session");
            sessionToken = null;
            currentUser = null;
            showAuth();
            document.getElementById("loginForm").reset();
            showToast("Вы вышли из аккаунта.");
        };

        // =========================================================
        // START
        // =========================================================
        window.takeTask = takeTask;
        window.completeTask = completeTask;
        window.cancelTask = cancelTask;
        window.rateTask = rateTask;
        window.openTaskChat = openTaskChat;
        window.openReportModal = openReportModal;
        window.closeReportModal = closeReportModal;
        window.submitReport = submitReport;
        window.savePost = savePost;
        window.unsavePost = unsavePost;
        window.toggleLike = toggleLike;
        window.toggleComments = toggleComments;
        window.sendComment = sendComment;
        window.toggleRepost = toggleRepost;
        window.deletePost = deletePost;
        window.followUser = followUser;
        window.selectCategory = selectCategory;
        window.updateCategoryGrid = updateCategoryGrid;
        window.showDepositForm = showDepositForm;
        window.showWithdrawalForm = showWithdrawalForm;
        window.createDepositRequest = createDepositRequest;
        window.createWithdrawalRequest = createWithdrawalRequest;
        window.addBalance = addBalance;
        window.updateBanner = updateBanner;
        window.addAchievement = addAchievement;
        window.deleteAchievement = deleteAchievement;
        window.toggleBan = toggleBan;
        window.toggleFreeze = toggleFreeze;
        window.togglePost = togglePost;
        window.toggleVerified = toggleVerified;
        window.fineUser = fineUser;
        window.addCity = addCity;
        window.addSchool = addSchool;
        window.approveTask = approveTask;
        window.rejectTask = rejectTask;

        checkSession();

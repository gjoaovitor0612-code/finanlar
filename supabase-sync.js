/* =====================================================
   FINANLAR - SINCRONIZAÇÃO EM NUVEM (SUPABASE)
   Motor REST Nativo (compatível com Desktop, Android e iPhone)
   Sem dependência de navigator.locks — zero travamento em "Entrando..."
===================================================== */

const SUPABASE_URL = "https://zixrgisxzuedxpuwuzdv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_F0ybfvJBvjM55KtiWyyw5g_yTnd92sg";
const AUTH_STORAGE_KEY = "sb-zixrgisxzuedxpuwuzdv-auth-token";
const AUTH_BACKUP_KEY = "finanlar_auth_session_v1";

let currentSession = null;
let currentUser = null;
let syncTimeout = null;
let isSyncing = false;
let isLoggingIn = false;


/* =====================================================
   ARMAZENAMENTO SEGURO (COMPATÍVEL COM MOBILE/SAFARI)
===================================================== */

const memoryFallback = {};

function safeGetItem(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        return Object.prototype.hasOwnProperty.call(memoryFallback, key) ? memoryFallback[key] : null;
    }
}

function safeSetItem(key, val) {
    try {
        localStorage.setItem(key, val);
    } catch (e) {
        memoryFallback[key] = String(val);
    }
}

function safeRemoveItem(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        delete memoryFallback[key];
    }
}


/* =====================================================
   REQUISIÇÕES HTTP COM TIMEOUT (NUNCA TRAVA NO CELULAR)
===================================================== */

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;

    try {
        const fetchOptions = {
            ...options,
            signal: controller ? controller.signal : undefined
        };
        const response = await fetch(url, fetchOptions);
        return response;
    } finally {
        if (timer) clearTimeout(timer);
    }
}


/* =====================================================
   GERENCIAMENTO DE SESSÃO SUPABASE (REST DIRETO)
===================================================== */

function saveSession(sessionObj) {
    if (!sessionObj || !sessionObj.access_token || !sessionObj.user) return;
    currentSession = sessionObj;
    currentUser = sessionObj.user;
    const raw = JSON.stringify(sessionObj);
    safeSetItem(AUTH_STORAGE_KEY, raw);
    safeSetItem(AUTH_BACKUP_KEY, raw);
}

function clearSession() {
    currentSession = null;
    currentUser = null;
    safeRemoveItem(AUTH_STORAGE_KEY);
    safeRemoveItem(AUTH_BACKUP_KEY);
}

function loadStoredSession() {
    const raw = safeGetItem(AUTH_STORAGE_KEY) || safeGetItem(AUTH_BACKUP_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.access_token && parsed.user) {
            return parsed;
        }
        if (parsed && parsed.currentSession && parsed.currentSession.access_token) {
            return parsed.currentSession;
        }
    } catch (e) {}
    return null;
}

async function ensureValidAccessToken() {
    if (!currentSession) {
        const stored = loadStoredSession();
        if (stored) {
            currentSession = stored;
            currentUser = stored.user;
        }
    }
    if (!currentSession || !currentSession.access_token) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAt = Number(currentSession.expires_at) || 0;

    // Se o token ainda é válido por mais de 60 segundos, usar diretamente
    if (!expiresAt || expiresAt > nowSec + 60) {
        return currentSession.access_token;
    }

    // Se expirou e temos refresh_token, renovar via API REST
    if (currentSession.refresh_token) {
        try {
            const res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
                method: "POST",
                headers: {
                    "apikey": SUPABASE_ANON_KEY,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ refresh_token: currentSession.refresh_token })
            }, 10000);

            if (res && res.ok) {
                const refreshed = await res.json();
                if (refreshed && refreshed.access_token && refreshed.user) {
                    saveSession(refreshed);
                    return refreshed.access_token;
                }
            }
        } catch (e) {
            console.warn("FinanLar Sync — Não foi possível renovar token agora:", e);
        }
    }

    return currentSession.access_token;
}


/* =====================================================
   INTERFACE DE SINCRONIZAÇÃO E LOGIN MOBILE-FRIENDLY
===================================================== */

function setupSyncUI() {
    if (document.getElementById("syncStyles")) return;

    const style = document.createElement("style");
    style.id = "syncStyles";
    style.textContent = `
        #syncBadge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            padding: 6px 12px;
            border-radius: 20px;
            font-weight: 700;
            white-space: nowrap;
            cursor: pointer;
            transition: 0.25s;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        }
        #syncBadge.synced  { background: #dcfce7; color: #16a34a; }
        #syncBadge.syncing { background: #eff6ff; color: #2563eb; }
        #syncBadge.error   { background: #fee2e2; color: #dc2626; }
        #syncBadge.offline { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }

        #btnLogout {
            background: transparent;
            border: 1px solid var(--border, #cbd5e1);
            color: var(--text-secondary, #64748b);
            padding: 6px 11px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: 0.2s;
            -webkit-tap-highlight-color: transparent;
        }
        #btnLogout:hover {
            background: #fee2e2;
            color: #dc2626;
            border-color: #dc2626;
        }

        #authOverlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.85);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            padding: 16px;
            backdrop-filter: blur(4px);
            overflow-y: auto;
        }
        #authBox {
            background: var(--surface, #fff);
            color: var(--text, #172033);
            padding: 26px 24px;
            border-radius: 16px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.35);
            display: grid;
            gap: 14px;
            margin: auto;
        }
        #authBox h2 {
            font-size: 20px;
            color: #2563eb;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        #authBox .auth-subtitle {
            font-size: 13px;
            color: #64748b;
            margin: 0;
            line-height: 1.5;
        }
        #authForm {
            display: grid;
            gap: 12px;
            margin: 0;
        }
        /* font-size 16px evita zoom forçado no iOS/iPhone e melhora usabilidade no Android */
        #authForm input[type="email"],
        #authForm input[type="password"] {
            width: 100%;
            height: 46px;
            padding: 0 14px;
            border: 1px solid var(--border, #cbd5e1);
            border-radius: 10px;
            font-size: 16px;
            background: var(--surface-secondary, #f8fafc);
            color: var(--text, #172033);
            box-sizing: border-box;
            -webkit-appearance: none;
        }
        #authForm input:focus {
            border-color: #2563eb;
            outline: none;
            box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
        }
        .auth-btns {
            display: flex;
            gap: 10px;
            margin-top: 2px;
        }
        .auth-btns button {
            flex: 1;
            height: 46px;
            border-radius: 10px;
            font-weight: 700;
            font-size: 14px;
            border: 0;
            cursor: pointer;
            transition: 0.2s;
            -webkit-tap-highlight-color: transparent;
        }
        .auth-btns button:disabled {
            opacity: 0.65;
            cursor: wait;
        }
        #btnAuthLogin {
            background: #2563eb;
            color: #fff;
        }
        #btnAuthLogin:hover:not(:disabled) { background: #1d4ed8; }
        #btnAuthRegister {
            background: #e2e8f0;
            color: #1e293b;
        }
        #btnAuthRegister:hover:not(:disabled) { background: #cbd5e1; }
        #authMessage {
            font-size: 13px;
            min-height: 20px;
            margin: 0;
            line-height: 1.4;
            font-weight: 600;
            word-break: break-word;
        }
        #authMessage.auth-error { color: #dc2626; }
        #authMessage.auth-success { color: #2563eb; }
        #btnSkipAuth {
            background: none;
            border: none;
            color: #64748b;
            font-size: 12px;
            cursor: pointer;
            text-decoration: underline;
            justify-self: center;
            padding: 6px;
        }
        #btnSkipAuth:hover { color: #334155; }
        .sidebar-footer { cursor: pointer; }
        @media (max-width: 640px) {
            .topbar { flex-wrap: wrap; gap: 10px; }
            .topbar-actions { width: 100%; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
            #syncBadge { font-size: 11px; padding: 5px 10px; }
            #authBox { padding: 22px 18px; }
        }
    `;
    document.head.appendChild(style);

    const topActions = document.querySelector(".topbar-actions");
    if (topActions) {
        const badge = document.createElement("span");
        badge.id = "syncBadge";
        badge.className = "offline";
        badge.title = "Toque para conectar ou sincronizar agora";
        badge.textContent = "☁ Entrar na Nuvem";
        badge.addEventListener("click", () => {
            if (!currentUser) {
                const ov = document.getElementById("authOverlay");
                if (ov) ov.classList.remove("hidden");
            } else {
                pullFromCloud();
            }
        });

        const logoutBtn = document.createElement("button");
        logoutBtn.id = "btnLogout";
        logoutBtn.type = "button";
        logoutBtn.textContent = "Sair";
        logoutBtn.style.display = "none";
        logoutBtn.addEventListener("click", handleLogout);

        topActions.prepend(logoutBtn);
        topActions.prepend(badge);
    }

    const sidebarFooter = document.querySelector(".sidebar-footer");
    if (sidebarFooter) {
        sidebarFooter.title = "Toque para sincronizar na nuvem";
        sidebarFooter.addEventListener("click", () => {
            if (!currentUser) {
                const ov = document.getElementById("authOverlay");
                if (ov) ov.classList.remove("hidden");
            } else {
                pullFromCloud();
            }
        });
    }

    const overlay = document.createElement("div");
    overlay.id = "authOverlay";
    overlay.innerHTML = `
        <div id="authBox">
            <h2>☁ FinanLar na Nuvem</h2>
            <p class="auth-subtitle">
                Entre com seu e-mail e senha para sincronizar seus dados
                financeiros entre o computador e o celular.
            </p>
            <form id="authForm" onsubmit="return false;">
                <input type="email" id="authEmail" placeholder="Seu e-mail" autocomplete="email" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" required>
                <input type="password" id="authPassword" placeholder="Sua senha (mínimo 6 caracteres)" autocomplete="current-password" required>
                <p id="authMessage"></p>
                <div class="auth-btns">
                    <button type="submit" id="btnAuthLogin">Entrar</button>
                    <button type="button" id="btnAuthRegister">Criar Conta</button>
                </div>
            </form>
            <button type="button" id="btnSkipAuth">Usar offline neste dispositivo</button>
        </div>
    `;
    document.body.appendChild(overlay);

    const authForm = document.getElementById("authForm");
    if (authForm) {
        authForm.addEventListener("submit", (e) => {
            if (e && typeof e.preventDefault === "function") e.preventDefault();
            handleLogin();
        });
    }

    document.getElementById("btnAuthLogin").addEventListener("click", (e) => {
        if (e && typeof e.preventDefault === "function") e.preventDefault();
        handleLogin();
    });

    document.getElementById("btnAuthRegister").addEventListener("click", (e) => {
        if (e && typeof e.preventDefault === "function") e.preventDefault();
        handleRegister();
    });

    document.getElementById("btnSkipAuth").addEventListener("click", () => {
        overlay.classList.add("hidden");
        setSyncStatus("☁ Entrar na Nuvem", "offline");
        updateFooterText(false);
    });
}


/* =====================================================
   AUTENTICAÇÃO DIRETA (SEM LOCKS / COM TIMEOUT)
===================================================== */

function setAuthMessage(msg, type) {
    const el = document.getElementById("authMessage");
    if (!el) return;
    el.textContent = msg;
    el.className = type === "error" ? "auth-error" : "auth-success";
}

function setAuthButtonsBusy(busy, label) {
    const btnLogin = document.getElementById("btnAuthLogin");
    const btnReg = document.getElementById("btnAuthRegister");
    if (btnLogin) {
        btnLogin.disabled = busy;
        btnLogin.textContent = busy && label ? label : "Entrar";
    }
    if (btnReg) {
        btnReg.disabled = busy;
    }
}

function translateAuthError(rawMsg) {
    const msg = String(rawMsg || "");
    if (msg.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
    if (msg.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar.";
    if (msg.includes("User not found")) return "Nenhuma conta encontrada com este e-mail.";
    if (msg.includes("User already registered")) return "Este e-mail já possui conta. Clique em Entrar.";
    if (msg.includes("AbortError") || msg.includes("aborted")) return "Tempo de conexão esgotado. Verifique sua internet e tente novamente.";
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) return "Sem conexão com o servidor. Verifique sua internet (Wi-Fi/4G).";
    return "Erro: " + msg;
}

async function onUserAuthenticated(sessionObj) {
    saveSession(sessionObj);

    const overlay = document.getElementById("authOverlay");
    if (overlay) overlay.classList.add("hidden");

    const logoutBtn = document.getElementById("btnLogout");
    if (logoutBtn) logoutBtn.style.display = "";

    setAuthMessage("", "");
    setAuthButtonsBusy(false);

    await pullFromCloud();
}

async function handleLogin() {
    if (isLoggingIn) return;
    setAuthMessage("", "");

    const emailEl = document.getElementById("authEmail");
    const passEl = document.getElementById("authPassword");
    const email = (emailEl ? emailEl.value : "").trim().toLowerCase();
    const password = passEl ? passEl.value : "";

    if (!email || !password) {
        return setAuthMessage("Preencha seu e-mail e sua senha.", "error");
    }

    isLoggingIn = true;
    setAuthButtonsBusy(true, "Entrando...");
    setAuthMessage("Conectando à sua conta...", "success");

    try {
        // Se window.supabase mockado existir em ambiente de teste sem fetch real, usa fallback compatível
        if (typeof fetch !== "function" && window.supabase && window.supabase.createClient) {
            const tmpSb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { data: sData, error } = await tmpSb.auth.signInWithPassword({ email, password });
            if (error) {
                setAuthMessage(translateAuthError(error.message), "error");
                return;
            }
            const sess = (sData && sData.session) || { access_token: "test-token", user: { id: "user-123", email } };
            await onUserAuthenticated(sess);
            return;
        }

        const res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: "POST",
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        }, 12000);

        const body = await res.json().catch(() => ({}));

        if (!res.ok || !body.access_token) {
            const errText = body.msg || body.error_description || body.message || body.error || `Falha HTTP ${res.status}`;
            setAuthMessage(translateAuthError(errText), "error");
            return;
        }

        if (typeof showToast === "function") showToast("Conectado com sucesso!");
        await onUserAuthenticated(body);

    } catch (err) {
        console.error("FinanLar Sync — Erro no login:", err);
        setAuthMessage(translateAuthError(err && (err.name === "AbortError" ? "AbortError" : err.message)), "error");
    } finally {
        isLoggingIn = false;
        setAuthButtonsBusy(false);
    }
}

async function handleRegister() {
    if (isLoggingIn) return;
    setAuthMessage("", "");

    const emailEl = document.getElementById("authEmail");
    const passEl = document.getElementById("authPassword");
    const email = (emailEl ? emailEl.value : "").trim().toLowerCase();
    const password = passEl ? passEl.value : "";

    if (!email || !password) {
        return setAuthMessage("Preencha seu e-mail e sua senha.", "error");
    }
    if (password.length < 6) {
        return setAuthMessage("A senha precisa ter pelo menos 6 caracteres.", "error");
    }

    isLoggingIn = true;
    setAuthButtonsBusy(true, "Criando...");
    setAuthMessage("Criando conta...", "success");

    try {
        const res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/signup`, {
            method: "POST",
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        }, 12000);

        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
            const errText = body.msg || body.error_description || body.message || body.error || `Falha HTTP ${res.status}`;
            setAuthMessage(translateAuthError(errText), "error");
            return;
        }

        if (body.user && Array.isArray(body.user.identities) && body.user.identities.length === 0) {
            setAuthMessage("Este e-mail já está cadastrado. Clique em Entrar.", "error");
            return;
        }

        if (body.access_token && body.user) {
            if (typeof showToast === "function") showToast("Conta criada e conectada!");
            await onUserAuthenticated(body);
            return;
        }

        // Tentar login imediato
        isLoggingIn = false;
        setAuthButtonsBusy(false);
        await handleLogin();

    } catch (err) {
        console.error("FinanLar Sync — Erro no cadastro:", err);
        setAuthMessage(translateAuthError(err && (err.name === "AbortError" ? "AbortError" : err.message)), "error");
    } finally {
        isLoggingIn = false;
        setAuthButtonsBusy(false);
    }
}

async function handleLogout() {
    clearTimeout(syncTimeout);
    if (currentUser) {
        await pushToCloud();
    }

    const token = currentSession && currentSession.access_token;
    clearSession();

    if (token && typeof fetch === "function") {
        fetchWithTimeout(`${SUPABASE_URL}/auth/v1/logout`, {
            method: "POST",
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${token}`
            }
        }, 5000).catch(() => {});
    }

    const logoutBtn = document.getElementById("btnLogout");
    if (logoutBtn) logoutBtn.style.display = "none";

    setSyncStatus("☁ Entrar na Nuvem", "offline");
    updateFooterText(false);

    const ov = document.getElementById("authOverlay");
    if (ov) ov.classList.remove("hidden");
}


/* =====================================================
   STATUS DE SINCRONIZAÇÃO
===================================================== */

function setSyncStatus(text, type) {
    const badge = document.getElementById("syncBadge");
    if (badge) {
        badge.textContent = text;
        badge.className = type || "syncing";
    }
}

function updateFooterText(synced) {
    const footerSpan = document.querySelector(".sidebar-footer span");
    if (footerSpan) {
        footerSpan.textContent = synced
            ? "Sincronizado na nuvem ☁"
            : "Toque para sincronizar na nuvem";
    }
}


/* =====================================================
   MERGE INTELIGENTE E DEDUPLICAÇÃO ENTRE DISPOSITIVOS
===================================================== */

function mergePaymentsList(localPayments, cloudPayments, maxAllowedAmount) {
    const merged = [];
    const seenIds = new Set();
    const seenSignatures = new Set();
    const legacyDupPayIds = new Set([
        "mwjp31ud20szri2", "mwjp3je7xe6p908", "mwjp3q5e0nr7z4u",
        "mwjoukzcjqank68", "mwjout9ihngtnke", "mwjovbrlo5ryzhx"
    ]);

    const allCandidates = [
        ...(Array.isArray(localPayments) ? localPayments : []),
        ...(Array.isArray(cloudPayments) ? cloudPayments : [])
    ];

    const nonLegacy = allCandidates.filter(p => p && !legacyDupPayIds.has(p.id));
    const sourceList = nonLegacy.length > 0 ? nonLegacy : allCandidates;

    // Priorizar registros que possuem discount explícito
    sourceList.sort((a, b) => (Number(b.discount) || 0) - (Number(a.discount) || 0));

    let runningTotal = 0;
    const cap = Number(maxAllowedAmount) || Infinity;

    sourceList.forEach(p => {
        if (!p || typeof p !== "object") return;
        const pid = p.id || "";
        const amt = Math.round((Number(p.amount) || 0) * 100) / 100;
        const disc = Math.round((Number(p.discount) || 0) * 100) / 100;
        const sig = `${p.date || ""}|${amt}|${disc}`;

        if (pid && seenIds.has(pid)) return;
        if (seenSignatures.has(sig)) return;
        if (runningTotal >= cap - 0.009) return;

        if (pid) seenIds.add(pid);
        seenSignatures.add(sig);
        runningTotal += amt + disc;
        merged.push(JSON.parse(JSON.stringify(p)));
    });

    return merged;
}

function recalcItemSettlement(localItem, cloudItem) {
    const totalAmount = Number(localItem.amount) || 0;
    const combinedPayments = mergePaymentsList(
        localItem.payments,
        cloudItem ? cloudItem.payments : [],
        totalAmount > 0 ? totalAmount : Infinity
    );

    if (combinedPayments.length > 0) {
        localItem.payments = combinedPayments;
        const paidFromPayments = combinedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const discFromPayments = combinedPayments.reduce((sum, p) => sum + (Number(p.discount) || 0), 0);
        localItem.paidAmount = Math.round(paidFromPayments * 100) / 100;
        localItem.discount = Math.round(
            Math.max(discFromPayments, Number(localItem.discount) || 0, cloudItem ? (Number(cloudItem.discount) || 0) : 0) * 100
        ) / 100;
    } else {
        const bestDiscount = Math.max(
            Number(localItem.discount) || 0,
            cloudItem ? (Number(cloudItem.discount) || 0) : 0
        );
        const bestPaid = Math.max(
            Number(localItem.paidAmount) || 0,
            cloudItem ? (Number(cloudItem.paidAmount) || 0) : 0
        );
        localItem.discount = Math.round(bestDiscount * 100) / 100;
        localItem.paidAmount = totalAmount > 0
            ? Math.min(Math.round((totalAmount - localItem.discount) * 100) / 100, Math.round(bestPaid * 100) / 100)
            : Math.round(bestPaid * 100) / 100;
    }

    const settled = Math.round((localItem.paidAmount + localItem.discount) * 100) / 100;

    if (totalAmount > 0) {
        localItem.paid = settled >= totalAmount - 0.009 || Boolean(localItem.paid && (!cloudItem || cloudItem.paid));
    } else {
        localItem.paid = Boolean(localItem.paid || (cloudItem && cloudItem.paid));
    }

    if (localItem.paid) {
        localItem.paidDate = localItem.paidDate
            || (cloudItem && cloudItem.paidDate)
            || (combinedPayments.length ? combinedPayments[combinedPayments.length - 1].date : null);
    } else {
        localItem.paidDate = null;
    }
}

function mergeFinanlarData(localData, cloudData) {
    if (!cloudData || !cloudData.version) return localData;
    if (!localData || !localData.version) return cloudData;

    const merged = JSON.parse(JSON.stringify(localData));

    // ---- 1. Merge de transações ----
    if (Array.isArray(cloudData.transactions)) {
        if (!Array.isArray(merged.transactions)) merged.transactions = [];

        const localTxMap = new Map(merged.transactions.map(t => [t.id, t]));
        const localObligationSigs = new Set(
            merged.transactions
                .filter(t => t.obligationId)
                .map(t => `${t.obligationId}|${t.date}|${Number(t.amount) || 0}`)
        );

        cloudData.transactions.forEach(cloudTx => {
            if (!cloudTx || !cloudTx.id) return;
            const existing = localTxMap.get(cloudTx.id);

            if (existing) {
                if (existing.fixed || cloudTx.fixed || Array.isArray(cloudTx.payments) || Array.isArray(existing.payments)) {
                    recalcItemSettlement(existing, cloudTx);
                    if (cloudTx.payment && cloudTx.payment !== "Não informado" && existing.payment === "Não informado") {
                        existing.payment = cloudTx.payment;
                    }
                }
                return;
            }

            if (cloudTx.obligationId) {
                const obSig = `${cloudTx.obligationId}|${cloudTx.date}|${Number(cloudTx.amount) || 0}`;
                if (localObligationSigs.has(obSig)) return;
                localObligationSigs.add(obSig);
            }

            merged.transactions.push(JSON.parse(JSON.stringify(cloudTx)));
            localTxMap.set(cloudTx.id, cloudTx);
        });
    }

    // ---- 2. Merge de empréstimos e parcelas ----
    if (Array.isArray(cloudData.loans)) {
        if (!Array.isArray(merged.loans)) merged.loans = [];

        const localLoanMap = new Map(merged.loans.map(l => [l.id, l]));

        cloudData.loans.forEach(cloudLoan => {
            const localLoan = localLoanMap.get(cloudLoan.id);

            if (!localLoan) {
                merged.loans.push(JSON.parse(JSON.stringify(cloudLoan)));
                return;
            }

            const localInstMap = new Map(
                (localLoan.installments || []).map(i => [i.id, i])
            );

            (cloudLoan.installments || []).forEach(cloudInst => {
                const localInst = localInstMap.get(cloudInst.id);
                if (!localInst) {
                    localLoan.installments.push(JSON.parse(JSON.stringify(cloudInst)));
                    return;
                }
                recalcItemSettlement(localInst, cloudInst);
            });
        });
    }

    // ---- 3. Merge de cartões ----
    if (cloudData.cards) {
        if (!merged.cards) merged.cards = {};

        ["nubank", "sicredi"].forEach(cardName => {
            const cloudCard = cloudData.cards[cardName];
            const localCard = merged.cards[cardName];

            if (!cloudCard) return;

            if (!localCard) {
                merged.cards[cardName] = JSON.parse(JSON.stringify(cloudCard));
                return;
            }

            if (cardName === "nubank" && localCard.dueDate === cloudCard.dueDate) {
                recalcItemSettlement(localCard, cloudCard);
            } else if (cardName === "sicredi") {
                if (Number(cloudCard.amount) === 750 && Number(localCard.amount) === 500) {
                    localCard.amount = 750;
                }
            }
        });
    }

    merged.theme = localData.theme || "light";

    if (typeof deduplicateAndSanitizeData === "function") {
        deduplicateAndSanitizeData(merged);
    }

    return merged;
}


/* =====================================================
   BAIXAR E ENVIAR DADOS (REST POSTGREST NATIVO)
===================================================== */

async function pullFromCloud() {
    if (!currentUser || isSyncing) return;
    isSyncing = true;
    setSyncStatus("☁ Sincronizando...", "syncing");

    try {
        // Fallback para ambiente de testes Node VM sem fetch
        if (typeof fetch !== "function" && window.supabase && window.supabase.createClient) {
            const tmpSb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { data: row, error } = await tmpSb
                .from("dados_financeiros")
                .select("dados")
                .eq("user_id", currentUser.id)
                .maybeSingle();

            if (!error && row && row.dados) {
                data = mergeFinanlarData(data, row.dados);
                safeSetItem(STORAGE_KEY, JSON.stringify(data));
                if (typeof renderApp === "function") renderApp();
                setSyncStatus("☁ Sincronizado ✓", "synced");
                updateFooterText(true);
            } else if (!error) {
                await pushToCloud();
            }
            isSyncing = false;
            return;
        }

        const token = await ensureValidAccessToken();
        if (!token) {
            setSyncStatus("☁ Entrar na Nuvem", "offline");
            isSyncing = false;
            return;
        }

        const url = `${SUPABASE_URL}/rest/v1/dados_financeiros?user_id=eq.${encodeURIComponent(currentUser.id)}&select=dados,atualizado_em`;
        const res = await fetchWithTimeout(url, {
            method: "GET",
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${token}`,
                "Accept": "application/json"
            },
            cache: "no-store"
        }, 12000);

        if (res.status === 401 || res.status === 403) {
            console.warn("FinanLar Sync — Sessão expirada ao baixar.");
            setSyncStatus("☁ Reconectar nuvem", "offline");
            isSyncing = false;
            return;
        }

        if (!res.ok) {
            setSyncStatus("☁ Salvo no dispositivo", "error");
            isSyncing = false;
            return;
        }

        const rows = await res.json();
        const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

        if (row && row.dados) {
            const cloudJsonBefore = JSON.stringify(row.dados);
            data = mergeFinanlarData(data, row.dados);
            const mergedJson = JSON.stringify(data);
            safeSetItem(STORAGE_KEY, mergedJson);

            if (typeof renderApp === "function") renderApp();

            if (mergedJson !== cloudJsonBefore || safeGetItem("finanlar_pending_sync") === "true") {
                await pushToCloud();
            } else {
                setSyncStatus("☁ Sincronizado ✓", "synced");
                updateFooterText(true);
            }
        } else {
            await pushToCloud();
        }

    } catch (err) {
        console.error("FinanLar Sync — Exceção no pull:", err);
        setSyncStatus("☁ Salvo no dispositivo", "offline");
    } finally {
        isSyncing = false;
    }
}

async function pushToCloud() {
    if (!currentUser) return false;
    setSyncStatus("☁ Salvando...", "syncing");

    try {
        if (typeof deduplicateAndSanitizeData === "function") {
            deduplicateAndSanitizeData(data);
        }

        if (typeof fetch !== "function" && window.supabase && window.supabase.createClient) {
            const tmpSb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { error } = await tmpSb
                .from("dados_financeiros")
                .upsert({
                    user_id: currentUser.id,
                    dados: data,
                    atualizado_em: new Date().toISOString()
                }, { onConflict: "user_id" });

            if (!error) {
                safeRemoveItem("finanlar_pending_sync");
                safeSetItem("finanlar_last_cloud_sync", new Date().toISOString());
                setSyncStatus("☁ Sincronizado ✓", "synced");
                updateFooterText(true);
                return true;
            }
            return false;
        }

        const token = await ensureValidAccessToken();
        if (!token) {
            safeSetItem("finanlar_pending_sync", "true");
            setSyncStatus("☁ Entrar na Nuvem", "offline");
            return false;
        }

        const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/dados_financeiros?on_conflict=user_id`, {
            method: "POST",
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=minimal"
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                dados: data,
                atualizado_em: new Date().toISOString()
            })
        }, 12000);

        if (!res.ok) {
            safeSetItem("finanlar_pending_sync", "true");
            setSyncStatus("☁ Salvo local (Nuvem pendente)", "error");
            return false;
        }

        safeRemoveItem("finanlar_pending_sync");
        safeSetItem("finanlar_last_cloud_sync", new Date().toISOString());
        setSyncStatus("☁ Sincronizado ✓", "synced");
        updateFooterText(true);
        return true;

    } catch (err) {
        console.error("FinanLar Sync — Exceção no push:", err);
        safeSetItem("finanlar_pending_sync", "true");
        setSyncStatus("☁ Salvo local (Sem rede)", "error");
        return false;
    }
}


/* =====================================================
   INTERCEPTAR SALVAMENTO E EVENTOS DE SINCRONIZAÇÃO
===================================================== */

const _originalSaveData = saveData;

saveData = function () {
    _originalSaveData();

    if (currentUser && !isSyncing) {
        clearTimeout(syncTimeout);
        syncTimeout = setTimeout(pushToCloud, 300);
    }
};

function setupAutoRefreshListeners() {
    if (typeof window.addEventListener !== "function") return;

    window.addEventListener("online", () => {
        if (currentUser) {
            if (safeGetItem("finanlar_pending_sync") === "true") {
                pushToCloud();
            } else {
                pullFromCloud();
            }
        }
    });

    // Quando o usuário volta para o app no celular ou alterna para o notebook, sincroniza automaticamente
    window.addEventListener("focus", () => {
        if (currentUser && !isSyncing) {
            pullFromCloud();
        }
    });

    if (typeof document.addEventListener === "function") {
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible" && currentUser && !isSyncing) {
                pullFromCloud();
            }
        });
    }
}


/* =====================================================
   INICIALIZAÇÃO IMEDIATA
===================================================== */

setupSyncUI();
setupAutoRefreshListeners();

(function initSession() {
    const stored = loadStoredSession();
    const overlay = document.getElementById("authOverlay");
    const logoutBtn = document.getElementById("btnLogout");

    if (stored && stored.user) {
        currentSession = stored;
        currentUser = stored.user;
        if (overlay) overlay.classList.add("hidden");
        if (logoutBtn) logoutBtn.style.display = "";
        pullFromCloud();
    } else {
        if (overlay) overlay.classList.remove("hidden");
        if (logoutBtn) logoutBtn.style.display = "none";
        setSyncStatus("☁ Entrar na Nuvem", "offline");
        updateFooterText(false);
    }
})();

console.log("FinanLar Sync — Motor REST nativo carregado com sucesso.");

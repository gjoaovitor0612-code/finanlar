/* =====================================================
   FINANLAR - SINCRONIZAÇÃO EM NUVEM (SUPABASE)
   Versão corrigida — merge inteligente + preservação
   de dados existentes entre dispositivos.
===================================================== */

// ---- Credenciais do projeto Supabase (chave PÚBLICA) ----
const SUPABASE_URL = "https://zixrgisxzuedxpuwuzdv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_F0ybfvJBvjM55KtiWyyw5g_yTnd92sg";

// ---- Verificação da biblioteca ----
if (!window.supabase || !window.supabase.createClient) {
    console.error("FinanLar Sync: Biblioteca @supabase/supabase-js não carregada.");
} else {

    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    let currentUser = null;
    let syncTimeout = null;
    let isSyncing = false;


    /* =====================================================
       INTERFACE DE SINCRONIZAÇÃO
    ===================================================== */

    function setupSyncUI() {

        const style = document.createElement("style");
        style.id = "syncStyles";
        style.textContent = `
            #syncBadge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                font-size: 11px;
                padding: 5px 12px;
                border-radius: 20px;
                font-weight: 700;
                white-space: nowrap;
                cursor: pointer;
                transition: 0.3s;
            }
            #syncBadge.synced  { background: #dcfce7; color: #16a34a; }
            #syncBadge.syncing { background: #eff6ff; color: #2563eb; }
            #syncBadge.error   { background: #fee2e2; color: #dc2626; }
            #syncBadge.offline { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }

            #btnLogout {
                background: transparent;
                border: 1px solid var(--border, #cbd5e1);
                color: var(--text-secondary, #64748b);
                padding: 5px 11px;
                border-radius: 8px;
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
                transition: 0.2s;
            }
            #btnLogout:hover {
                background: #fee2e2;
                color: #dc2626;
                border-color: #dc2626;
            }

            /* --- Modal de Login --- */
            #authOverlay {
                position: fixed;
                inset: 0;
                background: rgba(15, 23, 42, 0.85);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                padding: 20px;
                backdrop-filter: blur(4px);
            }
            #authBox {
                background: var(--surface, #fff);
                color: var(--text, #172033);
                padding: 30px;
                border-radius: 16px;
                width: 100%;
                max-width: 400px;
                box-shadow: 0 20px 50px rgba(0,0,0,0.3);
                display: grid;
                gap: 14px;
            }
            #authBox h2 {
                font-size: 21px;
                color: #2563eb;
                margin: 0;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            #authBox .auth-subtitle {
                font-size: 13px;
                color: #64748b;
                margin: 0;
                line-height: 1.5;
            }
            #authBox input[type="email"],
            #authBox input[type="password"] {
                width: 100%;
                height: 44px;
                padding: 0 14px;
                border: 1px solid var(--border, #cbd5e1);
                border-radius: 10px;
                font-size: 14px;
                background: var(--surface-secondary, #f8fafc);
                color: var(--text, #172033);
                box-sizing: border-box;
            }
            #authBox input:focus {
                border-color: #2563eb;
                outline: none;
                box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
            }
            .auth-btns {
                display: flex;
                gap: 10px;
                margin-top: 4px;
            }
            .auth-btns button {
                flex: 1;
                height: 44px;
                border-radius: 10px;
                font-weight: 700;
                font-size: 13px;
                border: 0;
                cursor: pointer;
                transition: 0.2s;
            }
            #btnAuthLogin {
                background: #2563eb;
                color: #fff;
            }
            #btnAuthLogin:hover { background: #1d4ed8; }
            #btnAuthRegister {
                background: #e2e8f0;
                color: #1e293b;
            }
            #btnAuthRegister:hover { background: #cbd5e1; }
            #authMessage {
                font-size: 12px;
                min-height: 18px;
                margin: 0;
                transition: 0.2s;
            }
            #authMessage.auth-error { color: #dc2626; }
            #authMessage.auth-success { color: #16a34a; }
            #btnSkipAuth {
                background: none;
                border: none;
                color: #64748b;
                font-size: 12px;
                cursor: pointer;
                text-decoration: underline;
                justify-self: center;
                padding: 4px;
            }
            #btnSkipAuth:hover { color: #334155; }
            .sidebar-footer { cursor: pointer; }
        `;
        document.head.appendChild(style);

        // ---- Badge de status + botão Sair na topbar ----
        const topActions = document.querySelector(".topbar-actions");

        if (topActions) {
            const badge = document.createElement("span");
            badge.id = "syncBadge";
            badge.className = "offline";
            badge.title = "Clique para abrir FinanLar na Nuvem ou sincronizar";
            badge.textContent = "☁ FinanLar na Nuvem";
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
            logoutBtn.textContent = "Sair";
            logoutBtn.style.display = "none";
            logoutBtn.addEventListener("click", async () => {
                clearTimeout(syncTimeout);
                if (currentUser) {
                    await pushToCloud();
                }
                await sb.auth.signOut();
                currentUser = null;
                logoutBtn.style.display = "none";
                setSyncStatus("☁ Entrar na Nuvem", "offline");
                updateFooterText(false);
                const ov = document.getElementById("authOverlay");
                if (ov) ov.classList.remove("hidden");
            });

            topActions.prepend(logoutBtn);
            topActions.prepend(badge);
        }

        // Tornar o rodapé da sidebar clicável para abrir o login da nuvem se desconectado
        const sidebarFooter = document.querySelector(".sidebar-footer");
        if (sidebarFooter) {
            sidebarFooter.title = "Clique para configurar a sincronização na nuvem";
            sidebarFooter.addEventListener("click", () => {
                if (!currentUser) {
                    const ov = document.getElementById("authOverlay");
                    if (ov) ov.classList.remove("hidden");
                } else {
                    pullFromCloud();
                }
            });
        }

        // ---- Overlay de login (visível inicialmente até confirmar sessão) ----
        const overlay = document.createElement("div");
        overlay.id = "authOverlay";
        overlay.innerHTML = `
            <div id="authBox">
                <h2>☁ FinanLar na Nuvem</h2>
                <p class="auth-subtitle">
                    Entre com e-mail e senha para sincronizar seus dados
                    financeiros entre computador e celular.
                </p>
                <input type="email" id="authEmail" placeholder="Seu e-mail" autocomplete="email">
                <input type="password" id="authPassword" placeholder="Senha (mínimo 6 caracteres)" autocomplete="current-password">
                <p id="authMessage"></p>
                <div class="auth-btns">
                    <button type="button" id="btnAuthLogin">Entrar</button>
                    <button type="button" id="btnAuthRegister">Criar Conta</button>
                </div>
                <button type="button" id="btnSkipAuth">Usar offline sem sincronização</button>
            </div>
        `;
        document.body.appendChild(overlay);

        // ---- Eventos de autenticação ----
        document.getElementById("btnAuthLogin").addEventListener("click", handleLogin);
        document.getElementById("btnAuthRegister").addEventListener("click", handleRegister);
        document.getElementById("btnSkipAuth").addEventListener("click", () => {
            overlay.classList.add("hidden");
            setSyncStatus("☁ Entrar na Nuvem", "offline");
            updateFooterText(false);
        });

        // Enter no campo de senha faz login
        document.getElementById("authPassword").addEventListener("keydown", (e) => {
            if (e.key === "Enter") handleLogin();
        });
    }


    /* =====================================================
       AUTENTICAÇÃO
    ===================================================== */

    function setAuthMessage(msg, type) {
        const el = document.getElementById("authMessage");
        if (!el) return;
        el.textContent = msg;
        el.className = type === "error" ? "auth-error" : "auth-success";
    }

    async function handleLogin() {
        setAuthMessage("", "");
        const email = (document.getElementById("authEmail").value || "").trim();
        const password = document.getElementById("authPassword").value || "";

        if (!email || !password) {
            return setAuthMessage("Preencha e-mail e senha.", "error");
        }

        setAuthMessage("Entrando...", "success");

        const { error } = await sb.auth.signInWithPassword({ email, password });

        if (error) {
            const msgs = {
                "Invalid login credentials": "E-mail ou senha incorretos.",
                "Email not confirmed": "Confirme seu e-mail antes de entrar (ou desative Confirm Email no Supabase).",
                "User not found": "Nenhuma conta com este e-mail."
            };
            return setAuthMessage(msgs[error.message] || "Erro: " + error.message, "error");
        }

        document.getElementById("authOverlay").classList.add("hidden");
        if (typeof showToast === "function") showToast("Conectado com sucesso!");
    }

    async function handleRegister() {
        setAuthMessage("", "");
        const email = (document.getElementById("authEmail").value || "").trim();
        const password = document.getElementById("authPassword").value || "";

        if (!email || !password) {
            return setAuthMessage("Preencha e-mail e senha.", "error");
        }
        if (password.length < 6) {
            return setAuthMessage("A senha precisa ter pelo menos 6 caracteres.", "error");
        }

        setAuthMessage("Criando conta...", "success");

        const { data: signUpData, error } = await sb.auth.signUp({ email, password });

        if (error) {
            return setAuthMessage("Erro ao cadastrar: " + error.message, "error");
        }

        if (signUpData && signUpData.user && signUpData.user.identities && signUpData.user.identities.length === 0) {
            return setAuthMessage("Este e-mail já está cadastrado. Clique em Entrar.", "error");
        }

        const { error: loginError } = await sb.auth.signInWithPassword({ email, password });

        if (loginError) {
            setAuthMessage("Conta criada! Verifique seu e-mail para confirmar ou clique em Entrar.", "success");
        } else {
            document.getElementById("authOverlay").classList.add("hidden");
            if (typeof showToast === "function") showToast("Conta criada e conectada!");
        }
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
                : "Clique para sincronizar na nuvem";
        }
    }


    /* =====================================================
       MERGE INTELIGENTE DE DADOS
       Garante que nenhum lançamento, amortização ou perdão
       seja perdido ao sincronizar entre dispositivos.
    ===================================================== */

    function mergePaymentsList(localPayments, cloudPayments) {
        const merged = [];
        const seenIds = new Set();
        const seenSignatures = new Set();

        const addPayment = (p) => {
            if (!p || typeof p !== "object") return;
            const pid = p.id || "";
            const sig = `${p.date || ""}|${Number(p.amount) || 0}|${Number(p.discount) || 0}|${p.method || ""}`;
            if (pid && seenIds.has(pid)) return;
            if (seenSignatures.has(sig)) return;
            if (pid) seenIds.add(pid);
            seenSignatures.add(sig);
            merged.push(JSON.parse(JSON.stringify(p)));
        };

        (Array.isArray(localPayments) ? localPayments : []).forEach(addPayment);
        (Array.isArray(cloudPayments) ? cloudPayments : []).forEach(addPayment);

        return merged;
    }

    function recalcItemSettlement(localItem, cloudItem) {
        const combinedPayments = mergePaymentsList(localItem.payments, cloudItem ? cloudItem.payments : []);
        if (combinedPayments.length > 0) {
            localItem.payments = combinedPayments;
        }

        const paidFromPayments = combinedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const discFromPayments = combinedPayments.reduce((sum, p) => sum + (Number(p.discount) || 0), 0);

        const bestPaid = Math.max(
            Math.round(paidFromPayments * 100) / 100,
            Number(localItem.paidAmount) || 0,
            cloudItem ? (Number(cloudItem.paidAmount) || 0) : 0
        );

        const bestDiscount = Math.max(
            Math.round(discFromPayments * 100) / 100,
            Number(localItem.discount) || 0,
            cloudItem ? (Number(cloudItem.discount) || 0) : 0
        );

        localItem.paidAmount = Math.round(bestPaid * 100) / 100;
        localItem.discount = Math.round(bestDiscount * 100) / 100;

        const totalAmount = Number(localItem.amount) || 0;
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
                    .map(t => `${t.obligationId}|${t.date}|${Number(t.amount) || 0}|${t.payment || ""}`)
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
                    const obSig = `${cloudTx.obligationId}|${cloudTx.date}|${Number(cloudTx.amount) || 0}|${cloudTx.payment || ""}`;
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
                }
            });
        }

        // ---- 4. Manter preferência de tema local ----
        merged.theme = localData.theme || "light";

        return merged;
    }


    /* =====================================================
       BAIXAR DADOS DA NUVEM (PULL)
    ===================================================== */

    async function pullFromCloud() {
        if (!currentUser || isSyncing) return;
        isSyncing = true;
        setSyncStatus("☁ Sincronizando...", "syncing");

        try {
            const { data: row, error } = await sb
                .from("dados_financeiros")
                .select("dados")
                .eq("user_id", currentUser.id)
                .maybeSingle();

            if (error) {
                console.error("FinanLar Sync — Erro ao baixar:", error);
                setSyncStatus("☁ Erro ao baixar", "error");
                isSyncing = false;
                return;
            }

            if (row && row.dados) {
                const cloudJsonBefore = JSON.stringify(row.dados);
                data = mergeFinanlarData(data, row.dados);
                const mergedJson = JSON.stringify(data);
                localStorage.setItem(STORAGE_KEY, mergedJson);

                if (typeof renderApp === "function") renderApp();

                if (mergedJson !== cloudJsonBefore) {
                    await pushToCloud();
                } else {
                    setSyncStatus("☁ Sincronizado ✓", "synced");
                    updateFooterText(true);
                }

                console.log("FinanLar Sync — Dados mesclados com a nuvem.");
            } else {
                console.log("FinanLar Sync — Nuvem vazia, enviando dados locais.");
                await pushToCloud();
            }

        } catch (err) {
            console.error("FinanLar Sync — Exceção no pull:", err);
            setSyncStatus("☁ Erro de conexão", "error");
        }

        isSyncing = false;
    }


    /* =====================================================
       ENVIAR DADOS PARA A NUVEM (PUSH)
    ===================================================== */

    async function pushToCloud() {
        if (!currentUser) return false;
        setSyncStatus("☁ Salvando...", "syncing");

        try {
            const { error } = await sb
                .from("dados_financeiros")
                .upsert({
                    user_id: currentUser.id,
                    dados: data,
                    atualizado_em: new Date().toISOString()
                }, { onConflict: "user_id" });

            if (error) {
                console.error("FinanLar Sync — Erro ao enviar:", error);
                localStorage.setItem("finanlar_pending_sync", "true");
                setSyncStatus("☁ Salvo local (Nuvem pendente)", "error");
                return false;
            } else {
                localStorage.removeItem("finanlar_pending_sync");
                localStorage.setItem("finanlar_last_cloud_sync", new Date().toISOString());
                setSyncStatus("☁ Sincronizado ✓", "synced");
                updateFooterText(true);
                console.log("FinanLar Sync — Dados confirmados e salvos na nuvem.");
                return true;
            }

        } catch (err) {
            console.error("FinanLar Sync — Exceção no push:", err);
            localStorage.setItem("finanlar_pending_sync", "true");
            setSyncStatus("☁ Salvo local (Sem rede)", "error");
            return false;
        }
    }


    /* =====================================================
       INTERCEPTAR SALVAMENTO PARA AUTO-SYNC
    ===================================================== */

    const _originalSaveData = saveData;

    saveData = function () {
        _originalSaveData();

        if (currentUser && !isSyncing) {
            clearTimeout(syncTimeout);
            syncTimeout = setTimeout(pushToCloud, 300);
        }
    };

    if (typeof window.addEventListener === "function") {
        window.addEventListener("online", () => {
            if (currentUser && localStorage.getItem("finanlar_pending_sync") === "true") {
                pushToCloud();
            }
        });
    }


    /* =====================================================
       INICIALIZAÇÃO E SESSÃO (ORDEM GARANTIDA)
    ===================================================== */

    // 1. Primeiro monta a interface (criando #authOverlay e #syncBadge)
    setupSyncUI();

    // 2. Registra o listener de mudanças de sessão
    sb.auth.onAuthStateChange((event, session) => {
        const overlay = document.getElementById("authOverlay");
        const logoutBtn = document.getElementById("btnLogout");

        if (session && session.user) {
            currentUser = session.user;
            if (overlay) overlay.classList.add("hidden");
            if (logoutBtn) logoutBtn.style.display = "";
            pullFromCloud();
        } else {
            currentUser = null;
            if (logoutBtn) logoutBtn.style.display = "none";

            if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
                if (overlay) overlay.classList.remove("hidden");
                setSyncStatus("☁ Entrar na Nuvem", "offline");
                updateFooterText(false);
            }
        }
    });

    // 3. Verifica explicitamente a sessão atual como garantia adicional
    sb.auth.getSession().then(({ data: sessionData }) => {
        const overlay = document.getElementById("authOverlay");
        const logoutBtn = document.getElementById("btnLogout");
        const session = sessionData && sessionData.session;

        if (session && session.user) {
            currentUser = session.user;
            if (overlay) overlay.classList.add("hidden");
            if (logoutBtn) logoutBtn.style.display = "";
            pullFromCloud();
        } else {
            if (overlay) overlay.classList.remove("hidden");
            setSyncStatus("☁ Entrar na Nuvem", "offline");
            updateFooterText(false);
        }
    }).catch(() => {
        const overlay = document.getElementById("authOverlay");
        if (overlay) overlay.classList.remove("hidden");
        setSyncStatus("☁ Entrar na Nuvem", "offline");
    });

    console.log("FinanLar Sync — Módulo de sincronização carregado com sucesso.");

} // fim do if (window.supabase)

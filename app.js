
/* =====================================================
   FINANLAR - CONTROLE FINANCEIRO RESIDENCIAL
   APP.JS
   HTML + CSS + JAVASCRIPT PURO
   Armazenamento automático: localStorage
===================================================== */

"use strict";

/* =====================================================
   CONFIGURAÇÕES E DADOS
===================================================== */

const STORAGE_KEY = "finanlar_dados_v1";
const START_DATE = "2026-09-01";

const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril",
    "Maio", "Junho", "Julho", "Agosto",
    "Setembro", "Outubro", "Novembro", "Dezembro"
];

const money = value => new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
}).format(Number(value) || 0);

const uid = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

function dateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function parseDate(value) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d, 12);
}

function addMonths(date, amount, preferredDay) {
    const target = new Date(
        date.getFullYear(),
        date.getMonth() + amount,
        1,
        12
    );

    const day = preferredDay || date.getDate();
    const lastDay = new Date(
        target.getFullYear(),
        target.getMonth() + 1,
        0
    ).getDate();

    target.setDate(Math.min(day, lastDay));
    return target;
}

function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isSameMonth(date1, date2) {
    return monthKey(date1) === monthKey(date2);
}

function formatDate(value) {
    if (!value) return "-";
    const d = parseDate(value);
    return d.toLocaleDateString("pt-BR");
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function makeDate(year, month, day) {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return dateString(new Date(year, month, Math.min(day, lastDay), 12));
}


/* =====================================================
   DADOS INICIAIS
===================================================== */

function createInitialData() {

    const loans = [
        {
            id: "loan-escritorio",
            name: "Escritório",
            amount: 500,
            count: 8,
            firstDate: "2026-09-30",
            day: 30,
            installments: []
        },
        {
            id: "loan-nubank",
            name: "Empréstimo Nubank",
            amount: 468.66,
            count: 15,
            firstDate: "2026-09-11",
            day: 11,
            installments: []
        },
        {
            id: "loan-becker",
            name: "Becker",
            amount: 75,
            count: 5,
            firstDate: "2026-09-15",
            day: 15,
            installments: []
        },
        {
            id: "loan-becker-celular",
            name: "Becker Celular",
            amount: 95,
            count: 9,
            firstDate: "2026-11-15",
            day: 15,
            installments: []
        }
    ];

    loans.forEach(loan => {
        const first = parseDate(loan.firstDate);

        for (let i = 0; i < loan.count; i++) {
            const due = addMonths(first, i, loan.day);

            loan.installments.push({
                id: `${loan.id}-${i + 1}`,
                number: i + 1,
                date: dateString(due),
                amount: loan.amount,
                paid: false,
                paidAmount: 0,
                discount: 0,
                paidDate: null
            });
        }
    });

    return {
        version: 1,
        transactions: [],
        loans,
        cards: {
            nubank: {
                amount: 700,
                dueDate: "2026-10-10",
                paid: false,
                paidDate: null
            },
            sicredi: {
                amount: 500,
                paid: false,
                paidDate: null
            }
        },
        theme: "light"
    };
}


/* =====================================================
   CARREGAMENTO E SALVAMENTO
===================================================== */

function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) return createInitialData();

        const data = JSON.parse(saved);

        if (!data || data.version !== 1) {
            return createInitialData();
        }

        const initial = createInitialData();

        return {
            ...initial,
            ...data,
            cards: {
                ...initial.cards,
                ...data.cards
            },
            transactions: Array.isArray(data.transactions)
                ? data.transactions : [],
            loans: Array.isArray(data.loans)
                ? data.loans : initial.loans
        };

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        return createInitialData();
    }
}

let data = loadData();

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error("Erro ao salvar:", error);
        showToast("Não foi possível salvar os dados.", "error");
    }
}


/* =====================================================
   ESTADO DA APLICAÇÃO
===================================================== */

let selectedDate = parseDate(START_DATE);
let financeChart = null;
let modalCallback = null;
let editingTransactionId = null;

const $ = id => document.getElementById(id);

const transactionForm = $("transactionForm");
const transactionDate = $("transactionDate");
const transactionValue = $("transactionValue");
const transactionName = $("transactionName");
const transactionType = $("transactionType");
const transactionCategory = $("transactionCategory");
const transactionPayment = $("transactionPayment");


/* =====================================================
   NOTIFICAÇÕES
===================================================== */

function showToast(message, type = "success") {
    const container = $("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3500);
}


/* =====================================================
   ÍCONES
===================================================== */

function refreshIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}


/* =====================================================
   TEMA CLARO E ESCURO
===================================================== */

function applyTheme() {
    const dark = data.theme === "dark";

    document.body.classList.toggle("dark-theme", dark);

    const button = $("themeToggle");

    if (button) {
        button.innerHTML = dark
            ? '<i data-lucide="sun"></i>'
            : '<i data-lucide="moon"></i>';

        button.title = dark ? "Ativar tema claro" : "Ativar tema escuro";
    }

    refreshIcons();
}

$("themeToggle")?.addEventListener("click", () => {
    data.theme = data.theme === "dark" ? "light" : "dark";
    saveData();
    applyTheme();

    if (financeChart) updateChart();
});


/* =====================================================
   DATA ATUAL
===================================================== */

function updateTodayDate() {
    const element = $("todayDate");

    if (element) {
        element.textContent = new Date().toLocaleDateString("pt-BR", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }
}


/* =====================================================
   NAVEGAÇÃO DE MESES
===================================================== */

function updateMonthControls() {
    $("currentMonthTitle").textContent =
        `${MONTH_NAMES[selectedDate.getMonth()]} de ${selectedDate.getFullYear()}`;

    $("monthSelect").value = selectedDate.getMonth();
    $("yearSelect").value = selectedDate.getFullYear();

    if (transactionDate && !transactionDate.dataset.userEdited) {
        transactionDate.value = dateString(
            new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12)
        );
    }
}

$("prevMonth").addEventListener("click", () => {
    selectedDate = addMonths(selectedDate, -1, 1);
    renderApp();
});

$("nextMonth").addEventListener("click", () => {
    selectedDate = addMonths(selectedDate, 1, 1);
    renderApp();
});

$("monthSelect").addEventListener("change", event => {
    selectedDate = new Date(
        selectedDate.getFullYear(),
        Number(event.target.value),
        1,
        12
    );
    renderApp();
});

$("yearSelect").addEventListener("change", event => {
    const year = Number(event.target.value);

    if (year >= 2000 && year <= 2100) {
        selectedDate = new Date(year, selectedDate.getMonth(), 1, 12);
        renderApp();
    }
});


/* =====================================================
   GERAÇÃO AUTOMÁTICA DAS CONTAS FIXAS
===================================================== */

const FIXED_BILLS = [
    {
        id: "claro",
        name: "Plano Claro Celular",
        category: "Moradia",
        amount: 50,
        day: 10
    },
    {
        id: "wifi",
        name: "Wifi",
        category: "Moradia",
        amount: 100,
        day: 10
    }
];

function ensureFixedBills() {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    if (year < 2026 || (year === 2026 && month < 8)) return;

    FIXED_BILLS.forEach(bill => {
        const dueDate = makeDate(year, month, bill.day);

        const id = `fixed-${bill.id}-${monthKey(selectedDate)}`;

        const exists = data.transactions.some(t => t.id === id);

        if (!exists) {
            data.transactions.push({
                id,
                name: bill.name,
                category: bill.category,
                type: "expense",
                amount: bill.amount,
                date: dueDate,
                payment: "Não informado",
                paid: false,
                fixed: true
            });
        }
    });

    saveData();
}


/* =====================================================
   CONSULTA DOS LANÇAMENTOS DO MÊS
===================================================== */

function getMonthlyTransactions() {
    return data.transactions.filter(transaction => {
        const date = parseDate(transaction.date);
        return isSameMonth(date, selectedDate);
    }).sort((a, b) => b.date.localeCompare(a.date));
}

function getMonthlyIncome() {
    return getMonthlyTransactions()
        .filter(t => t.type === "income")
        .reduce((total, t) => total + Number(t.amount), 0);
}

function getMonthlyExpenses() {
    return getMonthlyTransactions()
        .filter(t => t.type === "expense")
        .reduce((total, t) => total + Number(t.amount), 0);
}

function getMonthlyBalance() {
    return getMonthlyIncome() - getMonthlyExpenses();
}


/* =====================================================
   RESUMO FINANCEIRO
===================================================== */

function updateSummary() {
    const income = getMonthlyIncome();
    const expenses = getMonthlyExpenses();
    const balance = income - expenses;

    $("totalIncome").textContent = money(income);
    $("totalExpenses").textContent = money(expenses);
    $("currentBalance").textContent = money(balance);

    $("currentBalance").style.color =
        balance < 0 ? "var(--red)" : "var(--primary)";

    $("totalTransactions").textContent =
        getMonthlyTransactions().length;

    const bills = getMonthlyTransactions().filter(t =>
        t.fixed && !t.paid
    ).length;

    $("pendingBills").textContent = bills;

    let pending = 0;

    data.loans.forEach(loan => {
        loan.installments.forEach(item => {
            if (!item.paid && isSameMonth(parseDate(item.date), selectedDate)) {
                pending++;
            }
        });
    });

    $("pendingInstallments").textContent = pending;

    const percentage = income > 0
        ? (expenses / income) * 100
        : 0;

    $("expensePercentage").textContent =
        `${percentage.toFixed(1).replace(".", ",")}%`;
}


/* =====================================================
   GRÁFICO DE ROSCA
===================================================== */

function updateChart() {
    if (!window.Chart) return;

    const canvas = $("financeChart");
    if (!canvas) return;

    const income = getMonthlyIncome();
    const expenses = getMonthlyExpenses();

    if (financeChart) {
        financeChart.destroy();
    }

    const dark = data.theme === "dark";

    financeChart = new Chart(canvas, {
        type: "doughnut",

        data: {
            labels: ["Entradas", "Despesas"],

            datasets: [{
                data: [income, expenses],

                backgroundColor: [
                    "#16a34a",
                    "#ef4444"
                ],

                borderWidth: 0,
                hoverOffset: 7
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "72%",

            plugins: {
                legend: {
                    display: false
                },

                tooltip: {
                    callbacks: {
                        label: context =>
                            `${context.label}: ${money(context.raw)}`
                    }
                }
            }
        }
    });

    const legend = $("chartLegend");

    legend.innerHTML = `
        <div class="legend-item">
            <span class="legend-dot" style="background:#16a34a"></span>
            Entradas: ${money(income)}
        </div>

        <div class="legend-item">
            <span class="legend-dot" style="background:#ef4444"></span>
            Despesas: ${money(expenses)}
        </div>
    `;
}


/* =====================================================
   FORMULÁRIO DE LANÇAMENTOS
===================================================== */

transactionDate.addEventListener("change", () => {
    transactionDate.dataset.userEdited = "true";
});

transactionForm.addEventListener("reset", () => {
    editingTransactionId = null;

    setTimeout(() => {
        transactionDate.value = dateString(selectedDate);
        delete transactionDate.dataset.userEdited;

        $("isInstallment").checked = false;
        $("installmentFields").classList.add("hidden");
        $("installmentPreview").textContent =
            "As parcelas serão geradas automaticamente.";

        $("transactionType").value = "expense";
    }, 0);
});


/* =====================================================
   ATALHOS DE DESPESAS
===================================================== */

const QUICK_CATEGORIES = {
    "Luz": "Moradia",
    "Farmácia": "Saúde",
    "Mercado": "Alimentação",
    "Combustível": "Transporte"
};

document.querySelectorAll("[data-quick]").forEach(button => {
    button.addEventListener("click", () => {
        const name = button.dataset.quick;

        transactionType.value = "expense";
        transactionName.value = name;
        transactionCategory.value = QUICK_CATEGORIES[name];
        transactionDate.value = dateString(selectedDate);
        transactionValue.value = "";

        $("isInstallment").checked = false;
        $("installmentFields").classList.add("hidden");

        transactionValue.focus();

        showToast(`${name} selecionado. Informe o valor.`);
    });
});


/* =====================================================
   PARCELAMENTO DE NOVOS LANÇAMENTOS
===================================================== */

$("isInstallment").addEventListener("change", event => {
    $("installmentFields").classList.toggle(
        "hidden",
        !event.target.checked
    );

    updateInstallmentPreview();
});

$("installmentCount").addEventListener(
    "input",
    updateInstallmentPreview
);

transactionValue.addEventListener(
    "input",
    updateInstallmentPreview
);

function updateInstallmentPreview() {
    const enabled = $("isInstallment").checked;

    if (!enabled) return;

    const total = Number(transactionValue.value) || 0;
    const count = Math.max(2, Number($("installmentCount").value) || 2);

    const value = Math.floor((total / count) * 100) / 100;
    const lastValue = total - value * (count - 1);

    $("installmentPreview").textContent =
        `${count} parcelas: ${money(value)} ` +
        `e última parcela de ${money(lastValue)}.`;
}


/* =====================================================
   SALVAR LANÇAMENTO
===================================================== */

transactionForm.addEventListener("submit", event => {
    event.preventDefault();

    const name = transactionName.value.trim();
    const amount = Number(transactionValue.value);

    if (!name || !Number.isFinite(amount) || amount <= 0) {
        showToast("Preencha a descrição e um valor válido.", "error");
        return;
    }

    const date = transactionDate.value;

    if (!date) {
        showToast("Informe a data do lançamento.", "error");
        return;
    }

    if (editingTransactionId) {
        const transaction = data.transactions.find(
            t => t.id === editingTransactionId
        );

        if (!transaction) return;

        if (transaction.fixed) {
            showToast("Contas fixas não podem ser editadas por aqui.", "warning");
            return;
        }

        transaction.name = name;
        transaction.amount = amount;
        transaction.date = date;
        transaction.type = transactionType.value;
        transaction.category = transactionCategory.value;
        transaction.payment = transactionPayment.value;

        editingTransactionId = null;
        saveData();
        transactionForm.reset();
        renderApp();

        showToast("Lançamento atualizado!");
        return;
    }

    const installmentEnabled = $("isInstallment").checked;
    const count = installmentEnabled
        ? Number($("installmentCount").value)
        : 1;

    if (!Number.isInteger(count) || count < 1 || count > 120) {
        showToast("Quantidade de parcelas inválida.", "error");
        return;
    }

    const baseDate = parseDate(date);

    const installmentId = installmentEnabled ? uid() : null;

    const baseValue = Math.floor((amount / count) * 100) / 100;

    for (let i = 0; i < count; i++) {
        const installmentDate = addMonths(baseDate, i);

        const installmentAmount = i === count - 1
            ? Math.round((amount - baseValue * (count - 1)) * 100) / 100
            : baseValue;

        data.transactions.push({
            id: uid(),
            name: installmentEnabled
                ? `${name} (${i + 1}/${count})`
                : name,

            category: transactionCategory.value,
            type: transactionType.value,
            amount: installmentAmount,
            date: dateString(installmentDate),
            payment: transactionPayment.value,
            paid: false,
            installmentId,
            installmentNumber: i + 1,
            installmentCount: count
        });
    }

    saveData();
    transactionForm.reset();
    renderApp();

    showToast(
        installmentEnabled
            ? `${count} parcelas cadastradas com sucesso!`
            : "Lançamento salvo com sucesso!"
    );
});


/* =====================================================
   TABELA DE LANÇAMENTOS
===================================================== */

function renderTransactions() {
    const tbody = $("transactionsTableBody");
    const search = $("searchTransactions").value
        .trim().toLowerCase();

    const filter = $("filterTransactions").value;

    let transactions = getMonthlyTransactions();

    if (filter !== "all") {
        transactions = transactions.filter(t => t.type === filter);
    }

    if (search) {
        transactions = transactions.filter(t =>
            t.name.toLowerCase().includes(search) ||
            t.category.toLowerCase().includes(search) ||
            t.payment.toLowerCase().includes(search)
        );
    }

    $("transactionCount").textContent =
        `${transactions.length} lançamento(s)`;

    if (!transactions.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-table">
                    Nenhum lançamento encontrado.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = transactions.map(t => {
        const income = t.type === "income";

        return `
            <tr>
                <td>
                    <span class="transaction-name">
                        ${escapeHTML(t.name)}
                    </span>
                </td>

                <td>${escapeHTML(t.category)}</td>

                <td>${formatDate(t.date)}</td>

                <td>${escapeHTML(t.payment || "-")}</td>

                <td>
                    <span class="transaction-type ${income ? "type-income" : "type-expense"}">
                        ${income ? "Entrada" : "Despesa"}
                    </span>
                </td>

                <td class="${income ? "value-income" : "value-expense"}">
                    ${income ? "+" : "-"} ${money(t.amount)}
                </td>

                <td>
                    <div class="action-buttons">

                        <button
                            type="button"
                            title="Editar"
                            data-edit="${escapeHTML(t.id)}"
                            ${t.fixed ? "disabled" : ""}
                        >
                            <i data-lucide="edit"></i>
                        </button>

                        <button
                            type="button"
                            class="delete"
                            title="Excluir"
                            data-delete="${escapeHTML(t.id)}"
                            ${t.fixed ? "disabled" : ""}
                        >
                            <i data-lucide="trash-2"></i>
                        </button>

                    </div>
                </td>
            </tr>
        `;
    }).join("");

    refreshIcons();
}


/* =====================================================
   BUSCA E FILTRO
===================================================== */

$("searchTransactions").addEventListener("input", renderTransactions);
$("filterTransactions").addEventListener("change", renderTransactions);


/* =====================================================
   EDITAR E EXCLUIR LANÇAMENTOS
===================================================== */

$("transactionsTableBody").addEventListener("click", event => {

    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");

    if (editButton) {
        editTransaction(editButton.dataset.edit);
    }

    if (deleteButton) {
        deleteTransaction(deleteButton.dataset.delete);
    }
});

function editTransaction(id) {
    const t = data.transactions.find(item => item.id === id);

    if (!t || t.fixed) return;

    editingTransactionId = id;

    transactionType.value = t.type;
    transactionName.value = t.name;
    transactionCategory.value = t.category;
    transactionDate.value = t.date;
    transactionValue.value = t.amount;
    transactionPayment.value = t.payment || "Dinheiro";

    delete transactionDate.dataset.userEdited;

    $("isInstallment").checked = false;
    $("installmentFields").classList.add("hidden");

    $("transactionForm").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    showToast("Edite os dados e clique em Salvar Lançamento.");
}

function deleteTransaction(id) {
    const t = data.transactions.find(item => item.id === id);

    if (!t || t.fixed) return;

    openModal(
        "Excluir lançamento",
        `
            <p>Deseja realmente excluir este lançamento?</p>
            <strong>${escapeHTML(t.name)} - ${money(t.amount)}</strong>
        `,
        "Excluir",
        () => {
            data.transactions = data.transactions.filter(
                item => item.id !== id
            );

            saveData();
            renderApp();
            showToast("Lançamento excluído.");
        }
    );
}


/* =====================================================
   EXPORTAÇÃO CSV
===================================================== */

$("exportCSV").addEventListener("click", () => {
    const transactions = getMonthlyTransactions();

    if (!transactions.length) {
        showToast("Não há lançamentos para exportar.", "warning");
        return;
    }

    const header = [
        "Descrição",
        "Categoria",
        "Tipo",
        "Data",
        "Valor",
        "Pagamento",
        "Situação"
    ];

    const rows = transactions.map(t => [
        t.name,
        t.category,
        t.type === "income" ? "Entrada" : "Despesa",
        t.date,
        Number(t.amount).toFixed(2).replace(".", ","),
        t.payment || "",
        t.paid ? "Pago" : "Pendente"
    ]);

    const csv = [header, ...rows]
        .map(row => row.map(value =>
            `"${String(value).replace(/"/g, '""')}"`
        ).join(";"))
        .join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download =
        `FinanLar_${monthKey(selectedDate)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showToast("Arquivo CSV exportado!");
});


/* =====================================================
   MODAL GENÉRICO
===================================================== */

function openModal(title, content, confirmText, callback) {
    $("modalTitle").textContent = title;
    $("modalBody").innerHTML = content;
    $("confirmModal").textContent = confirmText;

    modalCallback = callback;

    $("modalOverlay").classList.remove("hidden");

    refreshIcons();
}

function closeModal() {
    $("modalOverlay").classList.add("hidden");
    modalCallback = null;
}

$("closeModal").addEventListener("click", closeModal);
$("cancelModal").addEventListener("click", closeModal);

$("modalOverlay").addEventListener("click", event => {
    if (event.target === $("modalOverlay")) {
        closeModal();
    }
});

$("confirmModal").addEventListener("click", () => {
    if (typeof modalCallback === "function") {
        const callback = modalCallback;
        closeModal();
        callback();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModal();
});


/* =====================================================
   CARTÃO NUBANK
===================================================== */

function renderNubank() {
    const card = data.cards.nubank;

    $("nubankBill").textContent = money(card.amount);
    $("nubankDueDate").textContent = formatDate(card.dueDate);

    $("payNubank").disabled = card.paid;

    $("payNubank").innerHTML = card.paid
        ? '<i data-lucide="check"></i> Fatura Paga'
        : '<i data-lucide="check-circle"></i> Pagar';

    refreshIcons();
}

$("editNubank").addEventListener("click", () => {
    const card = data.cards.nubank;

    openModal(
        "Atualizar Fatura Nubank",
        `
            <div class="form-group">
                <label for="modalNubankValue">Valor da fatura (R$)</label>
                <input
                    id="modalNubankValue"
                    type="number"
                    min="0"
                    step="0.01"
                    value="${card.amount}"
                >
            </div>

            <div class="form-group">
                <label for="modalNubankDate">Vencimento</label>
                <input
                    id="modalNubankDate"
                    type="date"
                    value="${card.dueDate}"
                >
            </div>
        `,
        "Salvar alterações",
        () => {
            const amount = Number($("modalNubankValue").value);
            const date = $("modalNubankDate").value;

            if (!Number.isFinite(amount) || amount < 0 || !date) {
                showToast("Informe valores válidos.", "error");
                return;
            }

            data.cards.nubank.amount = amount;
            data.cards.nubank.dueDate = date;

            if (amount > 0) {
                data.cards.nubank.paid = false;
                data.cards.nubank.paidDate = null;
            }

            saveData();
            renderApp();

            showToast("Fatura atualizada!");
        }
    );
});

$("payNubank").addEventListener("click", () => {
    const card = data.cards.nubank;

    if (card.paid || card.amount <= 0) return;

    openModal(
        "Pagar Fatura Nubank",
        `
            <p>Valor da fatura:</p>
            <h3>${money(card.amount)}</h3>

            <p>O pagamento será registrado como despesa no mês selecionado e abatido do saldo.</p>
        `,
        "Confirmar pagamento",
        () => {
            const paymentDate = dateString(
                new Date(
                    selectedDate.getFullYear(),
                    selectedDate.getMonth(),
                    Math.min(10, new Date(
                        selectedDate.getFullYear(),
                        selectedDate.getMonth() + 1,
                        0
                    ).getDate()),
                    12
                )
            );

            data.transactions.push({
                id: uid(),
                name: "Pagamento Fatura Nubank",
                category: "Cartão de Crédito",
                type: "expense",
                amount: card.amount,
                date: paymentDate,
                payment: "Pagamento de fatura",
                paid: true
            });

            card.paid = true;
            card.paidDate = paymentDate;

            saveData();
            renderApp();

            showToast("Fatura Nubank paga!");
        }
    );
});


/* =====================================================
   CHEQUE ESPECIAL SICREDI
===================================================== */

function renderSicredi() {
    const card = data.cards.sicredi;

    $("sicrediValue").textContent = money(card.amount);

    $("sicrediStatus").textContent =
        card.amount <= 0 ? "Quitado" : "Em utilização";

    $("paySicredi").disabled = card.amount <= 0;

    $("paySicredi").innerHTML = card.amount <= 0
        ? '<i data-lucide="check"></i> Quitado'
        : '<i data-lucide="check-circle"></i> Pagar / Quitar';

    refreshIcons();
}

$("editSicredi").addEventListener("click", () => {
    const card = data.cards.sicredi;

    openModal(
        "Ajustar Cheque Especial",
        `
            <div class="form-group">
                <label for="modalSicrediValue">Valor utilizado (R$)</label>
                <input
                    id="modalSicrediValue"
                    type="number"
                    min="0"
                    step="0.01"
                    value="${card.amount}"
                >
            </div>
        `,
        "Salvar valor",
        () => {
            const amount = Number($("modalSicrediValue").value);

            if (!Number.isFinite(amount) || amount < 0) {
                showToast("Informe um valor válido.", "error");
                return;
            }

            data.cards.sicredi.amount = amount;

            saveData();
            renderApp();

            showToast("Valor do Sicredi atualizado!");
        }
    );
});

$("paySicredi").addEventListener("click", () => {
    const card = data.cards.sicredi;

    if (card.amount <= 0) return;

    openModal(
        "Quitar Cheque Especial Sicredi",
        `
            <p>Valor utilizado:</p>
            <h3>${money(card.amount)}</h3>
            <p>O valor será registrado como despesa no mês selecionado.</p>
        `,
        "Confirmar quitação",
        () => {
            data.transactions.push({
                id: uid(),
                name: "Quitação Cheque Especial Sicredi",
                category: "Empréstimos e Crédito",
                type: "expense",
                amount: card.amount,
                date: dateString(selectedDate),
                payment: "Quitação",
                paid: true
            });

            card.amount = 0;

            saveData();
            renderApp();

            showToast("Cheque especial quitado!");
        }
    );
});


/* =====================================================
   RESUMO DOS EMPRÉSTIMOS
===================================================== */

function updateLoanSummary() {
    let total = 0;
    let paid = 0;

    data.loans.forEach(loan => {
        loan.installments.forEach(item => {
            total += Number(item.amount);
            if (item.paid) {
                paid += Number(item.paidAmount);
            }
        });
    });

    $("totalLoans").textContent = money(total);
    $("paidLoans").textContent = money(paid);
    $("remainingLoans").textContent = money(total - paid);
}


/* =====================================================
   LISTA DE EMPRÉSTIMOS E PARCELAS
===================================================== */

function renderLoans() {
    const container = $("loanList");

    if (!data.loans.length) {
        container.innerHTML = `
            <p class="empty-table">Nenhum empréstimo cadastrado.</p>
        `;
        return;
    }

    container.innerHTML = data.loans.map(loan => {

        const paidCount = loan.installments.filter(i => i.paid).length;

        const loanTotal = loan.installments.reduce(
            (sum, item) => sum + Number(item.amount), 0
        );

        return `
            <article class="loan-group">

                <div class="loan-group-header">
                    <div>
                        <h4>${escapeHTML(loan.name)}</h4>
                        <p>
                            ${paidCount} de ${loan.count} parcelas pagas
                        </p>
                    </div>

                    <span class="loan-group-total">
                        ${money(loanTotal)}
                    </span>
                </div>

                ${loan.installments.map(item => `
                    <div class="loan-installment ${item.paid ? "paid" : ""}">

                        <div class="loan-installment-info">
                            <strong>
                                Parcela ${item.number}/${loan.count}
                            </strong>

                            <span>
                                Vencimento: ${formatDate(item.date)}
                            </span>

                            <span>
                                ${item.paid
                                    ? `Pago: ${money(item.paidAmount)}`
                                    : `Valor: ${money(item.amount)}`
                                }
                            </span>

                            ${item.discount > 0
                                ? `<span>Economia: ${money(item.discount)}</span>`
                                : ""
                            }
                        </div>

                        <div class="loan-installment-actions">

                            ${item.paid
                                ? `<span class="status-paid">PAGO</span>`
                                : `
                                    <button
                                        type="button"
                                        class="pay-button"
                                        data-loan-pay="${escapeHTML(loan.id)}"
                                        data-installment="${escapeHTML(item.id)}"
                                    >
                                        Pagar
                                    </button>

                                    <button
                                        type="button"
                                        class="amortize-button"
                                        data-loan-amortize="${escapeHTML(loan.id)}"
                                        data-installment="${escapeHTML(item.id)}"
                                    >
                                        Amortizar
                                    </button>
                                `
                            }

                        </div>

                    </div>
                `).join("")}

            </article>
        `;
    }).join("");

    refreshIcons();
}


/* =====================================================
   PAGAMENTO DE PARCELAS
===================================================== */

function findInstallment(loanId, installmentId) {
    const loan = data.loans.find(item => item.id === loanId);

    if (!loan) return null;

    const installment = loan.installments.find(
        item => item.id === installmentId
    );

    if (!installment) return null;

    return { loan, installment };
}

function registerLoanPayment(loanId, installmentId, amount, discount = 0) {
    const result = findInstallment(loanId, installmentId);

    if (!result || result.installment.paid) return;

    const { loan, installment } = result;

    if (!Number.isFinite(amount) || amount < 0) {
        showToast("Valor de pagamento inválido.", "error");
        return;
    }

    if (amount > installment.amount) {
        showToast("O pagamento não pode ultrapassar a parcela.", "error");
        return;
    }

    const paymentDate = dateString(selectedDate);

    installment.paid = true;
    installment.paidAmount = amount;
    installment.discount = discount;
    installment.paidDate = paymentDate;

    data.transactions.push({
        id: uid(),
        name: `${loan.name} - Parcela ${installment.number}/${loan.count}`,
        category: "Empréstimos",
        type: "expense",
        amount,
        date: paymentDate,
        payment: discount > 0 ? "Amortização" : "Pagamento de parcela",
        paid: true
    });

    saveData();
    renderApp();

    showToast(
        discount > 0
            ? `Parcela amortizada! Economia de ${money(discount)}.`
            : "Parcela paga com sucesso!"
    );
}

function payInstallment(loanId, installmentId) {
    const result = findInstallment(loanId, installmentId);

    if (!result || result.installment.paid) return;

    const { loan, installment } = result;

    openModal(
        "Pagar Parcela",
        `
            <p>Empréstimo: <strong>${escapeHTML(loan.name)}</strong></p>
            <p>Parcela: ${installment.number}/${loan.count}</p>
            <h3>${money(installment.amount)}</h3>
            <p>O pagamento será descontado do saldo do mês selecionado.</p>
        `,
        "Confirmar pagamento",
        () => {
            registerLoanPayment(
                loanId,
                installmentId,
                installment.amount,
                0
            );
        }
    );
}


/* =====================================================
   AMORTIZAÇÃO COM DESCONTO
===================================================== */

function amortizeInstallment(loanId, installmentId) {
    const result = findInstallment(loanId, installmentId);

    if (!result || result.installment.paid) return;

    const { loan, installment } = result;

    openModal(
        "Amortizar Parcela",
        `
            <p>Empréstimo: <strong>${escapeHTML(loan.name)}</strong></p>

            <p>Valor original: <strong>${money(installment.amount)}</strong></p>

            <div class="form-group">
                <label for="amortizeDiscount">Desconto concedido (R$)</label>

                <input
                    type="number"
                    id="amortizeDiscount"
                    min="0"
                    max="${installment.amount}"
                    step="0.01"
                    value="0"
                >
            </div>

            <div class="form-group">
                <label>Valor a pagar</label>
                <input
                    type="text"
                    id="amortizeFinal"
                    value="${money(installment.amount)}"
                    readonly
                >
            </div>

            <div class="form-group">
                <label>Economia obtida</label>
                <input
                    type="text"
                    id="amortizeSaving"
                    value="${money(0)}"
                    readonly
                >
            </div>
        `,
        "Confirmar amortização",
        () => {
            const discount = Number($("amortizeDiscount").value);

            if (
                !Number.isFinite(discount) ||
                discount < 0 ||
                discount > installment.amount
            ) {
                showToast("Desconto inválido.", "error");
                return;
            }

            const finalAmount = Math.round(
                (installment.amount - discount) * 100
            ) / 100;

            registerLoanPayment(
                loanId,
                installmentId,
                finalAmount,
                discount
            );
        }
    );

    setTimeout(() => {
        const input = $("amortizeDiscount");

        if (!input) return;

        input.addEventListener("input", () => {
            const discount = Math.max(
                0,
                Math.min(installment.amount, Number(input.value) || 0)
            );

            $("amortizeFinal").value =
                money(installment.amount - discount);

            $("amortizeSaving").value = money(discount);
        });
    }, 0);
}


/* =====================================================
   EVENTOS DOS EMPRÉSTIMOS
===================================================== */

$("loanList").addEventListener("click", event => {

    const payButton = event.target.closest("[data-loan-pay]");
    const amortizeButton = event.target.closest("[data-loan-amortize]");

    if (payButton) {
        payInstallment(
            payButton.dataset.loanPay,
            payButton.dataset.installment
        );
    }

    if (amortizeButton) {
        amortizeInstallment(
            amortizeButton.dataset.loanAmortize,
            amortizeButton.dataset.installment
        );
    }
});


/* =====================================================
   MENU RESPONSIVO
===================================================== */

$("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
});

document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
        document.querySelectorAll(".nav-link").forEach(item => {
            item.classList.remove("active");
        });

        link.classList.add("active");

        $("sidebar").classList.remove("open");
    });
});


/* =====================================================
   RENDERIZAÇÃO GERAL
===================================================== */

function renderApp() {
    ensureFixedBills();

    updateMonthControls();
    updateSummary();
    updateChart();

    renderTransactions();

    renderNubank();
    renderSicredi();

    updateLoanSummary();
    renderLoans();

    applyTheme();
}


/* =====================================================
   INICIALIZAÇÃO
===================================================== */

function initializeApp() {
    updateTodayDate();

    applyTheme();

    transactionDate.value = START_DATE;

    selectedDate = parseDate(START_DATE);

    renderApp();

    refreshIcons();

    console.log("FinanLar iniciado com sucesso!");
    console.log("Dados armazenados em:", STORAGE_KEY);
}

initializeApp();


/* =====================================================
   FIM DO FINANLAR
===================================================== */

/* =====================================================
   FINANLAR - CONTROLE MENSAL DE OBRIGACOES, AMORTIZACAO E RECUPERACAO
   Mantem a competencia original separada da data real de pagamento,
   suporta amortizacao integral/parcial, desconto de ate 100% (perdao
   de saldo sem pagamento ficticio), previa em tempo real e prevencao
   de duplicidade de operacoes.
===================================================== */

var __lastOperationSignature = "";
var __lastOperationTimestamp = 0;

function acquireOperationLock(signature) {
    const now = Date.now();
    if (signature === __lastOperationSignature && (now - __lastOperationTimestamp) < 1500) {
        return false;
    }
    __lastOperationSignature = signature;
    __lastOperationTimestamp = now;
    return true;
}

function dateForToday() {
    return dateString(new Date());
}

function amountPaid(item) {
    if (!item) return 0;
    if (Array.isArray(item.payments) && item.payments.length > 0) {
        const sum = item.payments.reduce((acc, payment) => acc + (Number(payment.amount) || 0), 0);
        return Math.round(sum * 100) / 100;
    }
    const explicitPaid = Number(item.paidAmount) || 0;
    if (explicitPaid > 0) {
        return Math.round(explicitPaid * 100) / 100;
    }
    if (item.paid) {
        const disc = Number(item.discount) || 0;
        return Math.max(0, Math.round(((Number(item.amount) || 0) - disc) * 100) / 100);
    }
    return 0;
}

function amountDiscount(item) {
    if (!item) return 0;
    const fromPayments = Array.isArray(item.payments)
        ? item.payments.reduce((acc, payment) => acc + (Number(payment.discount) || 0), 0)
        : 0;
    const directDiscount = Number(item.discount) || 0;
    return Math.round(Math.max(directDiscount, fromPayments) * 100) / 100;
}

function amountSettled(item) {
    return Math.round((amountPaid(item) + amountDiscount(item)) * 100) / 100;
}

function amountRemaining(item) {
    if (!item) return 0;
    const total = Number(item.amount) || 0;
    return Math.max(0, Math.round((total - amountSettled(item)) * 100) / 100);
}

function isForgivenFull(item) {
    return amountRemaining(item) <= 0.009 && amountDiscount(item) > 0.009 && amountPaid(item) <= 0.009;
}

function obligationStatus(item, dueDate) {
    const remaining = amountRemaining(item);
    const settled = amountSettled(item);
    if (remaining <= 0.009) return "paid";
    if (settled > 0.009) return "partial";
    return dueDate < dateForToday() ? "late" : "pending";
}

function formatPaymentHistorySummary(item) {
    if (!item || !Array.isArray(item.payments) || !item.payments.length) return "";
    return item.payments.map(p => {
        const dt = p.date ? formatDate(p.date) : "-";
        const paidPart = Number(p.amount) > 0 ? `Pago: ${money(p.amount)}` : "";
        const discPart = Number(p.discount) > 0 ? `Desconto: ${money(p.discount)}` : "";
        const details = [paidPart, discPart].filter(Boolean).join(" · ") || "Sem valor";
        return `${dt} — ${escapeHTML(p.method || "Operação")} (${details})`;
    }).join(" | ");
}

function getRecoveredUserSnapshot() {
    return {"version":1,"transactions":[{"id":"fixed-claro-2026-09","name":"Plano Claro Celular","category":"Moradia","type":"expense","amount":50,"date":"2026-09-10","payment":"Pix","paid":true,"paidAmount":50,"discount":0,"payments":[{"id":"mwkp3ei6yruw3em","amount":50,"discount":0,"date":"2026-09-10","method":"Pix","forgiven":false}],"fixed":true,"competence":"2026-09","paidDate":"2026-09-10","updatedAt":"2026-11-17T12:55:17.550Z"},{"id":"fixed-wifi-2026-09","name":"Wifi","category":"Moradia","type":"expense","amount":100,"date":"2026-09-10","payment":"Pix","paid":true,"paidAmount":100,"discount":0,"payments":[{"id":"mwkp3j07r18q9lb","amount":100,"discount":0,"date":"2026-09-10","method":"Pix","forgiven":false}],"fixed":true,"competence":"2026-09","paidDate":"2026-09-10","updatedAt":"2026-11-17T12:55:23.383Z"},{"id":"mwkozucff46uhx6","name":"Escritório - Parcela 1/8","category":"Empréstimos","type":"expense","amount":500,"date":"2026-09-23","payment":"Pagamento de parcela","paid":true,"competence":"2026-09","obligationId":"loan-escritorio-1"},{"id":"mwkp019869fnbf8","name":"Escritório - Parcela 2/8","category":"Empréstimos","type":"expense","amount":500,"date":"2026-10-30","payment":"Pagamento de parcela","paid":true,"competence":"2026-10","obligationId":"loan-escritorio-2"},{"id":"mwkp18r995ps360","name":"Escritório - Parcela 3/8 (Amortização integral)","category":"Empréstimos","type":"expense","amount":416.67,"date":"2026-11-05","payment":"Amortização integral","paid":true,"competence":"2026-11","obligationId":"loan-escritorio-3"},{"id":"mwkp1ifmpe2vqo9","name":"Escritório - Parcela 4/8 (Amortização integral)","category":"Empréstimos","type":"expense","amount":416.67,"date":"2026-11-05","payment":"Amortização integral","paid":true,"competence":"2026-12","obligationId":"loan-escritorio-4"},{"id":"mwkp1quzv5r96nu","name":"Escritório - Parcela 5/8 (Amortização integral)","category":"Empréstimos","type":"expense","amount":416.66,"date":"2026-11-05","payment":"Amortização integral","paid":true,"competence":"2027-01","obligationId":"loan-escritorio-5"},{"id":"mwkp3sym7jocw5x","name":"Becker - Parcela 1/5","category":"Empréstimos","type":"expense","amount":75,"date":"2026-09-10","payment":"Pix","paid":true,"competence":"2026-09","obligationId":"loan-becker-1"},{"id":"mwkp4f6cpcl5455","name":"Combustível","category":"Transporte","type":"expense","amount":400,"date":"2026-09-15","payment":"Dinheiro","paid":false,"installmentId":null,"installmentNumber":1,"installmentCount":1},{"id":"mwkp4mq048v1xzw","name":"Mercado","category":"Alimentação","type":"expense","amount":1000,"date":"2026-09-01","payment":"Dinheiro","paid":false,"installmentId":null,"installmentNumber":1,"installmentCount":1},{"id":"fixed-claro-2026-10","name":"Plano Claro Celular","category":"Moradia","type":"expense","amount":50,"date":"2026-10-10","payment":"Pix","paid":true,"paidAmount":50,"discount":0,"payments":[{"id":"mwkvyycfn3zmvar","amount":50,"discount":0,"date":"2026-11-17","method":"Pix","forgiven":false}],"fixed":true,"competence":"2026-10","paidDate":"2026-11-17","updatedAt":"2026-11-17T16:07:47.295Z"},{"id":"fixed-wifi-2026-10","name":"Wifi","category":"Moradia","type":"expense","amount":100,"date":"2026-10-10","payment":"Não informado","paid":false,"paidAmount":0,"discount":0,"payments":[],"fixed":true,"competence":"2026-10"},{"id":"mwkp87yqhzoh9zc","name":"Empréstimo Nubank - Parcela 1/15","category":"Empréstimos","type":"expense","amount":468.66,"date":"2026-09-11","payment":"Pagamento de parcela","paid":true,"competence":"2026-09","obligationId":"loan-nubank-1"},{"id":"mwkp8u7e7gtnkau","name":"Empréstimo Nubank - Parcela 2/15 (Amortização integral)","category":"Empréstimos","type":"expense","amount":447.72,"date":"2026-10-13","payment":"Amortização integral","paid":true,"competence":"2026-10","obligationId":"loan-nubank-2"},{"id":"mwkp9s9f28i5rdg","name":"Empréstimo Nubank - Parcela 3/15 (Amortização integral)","category":"Empréstimos","type":"expense","amount":418.04,"date":"2026-11-11","payment":"Amortização integral","paid":true,"competence":"2026-11","obligationId":"loan-nubank-3"},{"id":"mwkpaod95tixhj6","name":"Empréstimo Nubank - Parcela 15/15 (Amortização integral)","category":"Empréstimos","type":"expense","amount":142.77,"date":"2026-11-11","payment":"Amortização integral","paid":true,"competence":"2027-11","obligationId":"loan-nubank-15"},{"id":"mwkpb82tz59l72o","name":"Empréstimo Nubank - Parcela 14/15 (Amortização integral)","category":"Empréstimos","type":"expense","amount":155.55,"date":"2026-10-11","payment":"Amortização integral","paid":true,"competence":"2027-10","obligationId":"loan-nubank-14"},{"id":"mwkpbw51906zmj5","name":"Empréstimo Nubank - Parcela 13/15 (Amortização integral)","category":"Empréstimos","type":"expense","amount":177.4,"date":"2026-09-13","payment":"Amortização integral","paid":true,"competence":"2027-09","obligationId":"loan-nubank-13"},{"id":"mwkpc9vo6v8yi67","name":"Becker - Parcela 2/5","category":"Empréstimos","type":"expense","amount":75,"date":"2026-10-15","payment":"Pagamento de parcela","paid":true,"competence":"2026-10","obligationId":"loan-becker-2"},{"id":"mwkpcivlf9voe9t","name":"Becker - Parcela 3/5","category":"Empréstimos","type":"expense","amount":75,"date":"2026-11-15","payment":"Pagamento de parcela","paid":true,"competence":"2026-11","obligationId":"loan-becker-3"},{"id":"mwkpctl9m4xc8xv","name":"Becker Celular - Parcela 1/9","category":"Empréstimos","type":"expense","amount":95,"date":"2026-11-15","payment":"Pagamento de parcela","paid":true,"competence":"2026-11","obligationId":"loan-becker-celular-1"},{"id":"mwkvz8fb30ivdaj","name":"Fatura Nubank","category":"Cartões e Crédito","type":"expense","amount":700,"date":"2026-11-17","payment":"Pix","paid":true,"obligationId":"nubank-monthly-bill","competence":"2026-10"}],"loans":[{"id":"loan-escritorio","name":"Escritório","amount":500,"count":8,"firstDate":"2026-09-30","day":30,"installments":[{"id":"loan-escritorio-1","number":1,"date":"2026-09-30","amount":500,"paid":true,"paidAmount":500,"discount":0,"paidDate":"2026-09-23","payments":[{"id":"mwkozucc5xdcajn","amount":500,"discount":0,"date":"2026-09-23","method":"Pagamento de parcela","forgiven":false}],"updatedAt":"2026-11-17T12:52:31.453Z"},{"id":"loan-escritorio-2","number":2,"date":"2026-10-30","amount":500,"paid":true,"paidAmount":500,"discount":0,"paidDate":"2026-10-30","payments":[{"id":"mwkp01989rdcibi","amount":500,"discount":0,"date":"2026-10-30","method":"Pagamento de parcela","forgiven":false}],"updatedAt":"2026-11-17T12:52:40.412Z"},{"id":"loan-escritorio-3","number":3,"date":"2026-11-30","amount":500,"paid":true,"paidAmount":416.67,"discount":83.33,"paidDate":"2026-11-05","payments":[{"id":"mwkp18r9egdlcog","amount":416.67,"discount":83.33,"date":"2026-11-05","method":"Amortização integral","forgiven":false}],"updatedAt":"2026-11-17T12:53:36.789Z"},{"id":"loan-escritorio-4","number":4,"date":"2026-12-30","amount":500,"paid":true,"paidAmount":416.67,"discount":83.33,"paidDate":"2026-11-05","payments":[{"id":"mwkp1ifmcz3b0jk","amount":416.67,"discount":83.33,"date":"2026-11-05","method":"Amortização integral","forgiven":false}],"updatedAt":"2026-11-17T12:53:49.330Z"},{"id":"loan-escritorio-5","number":5,"date":"2027-01-30","amount":500,"paid":true,"paidAmount":416.66,"discount":83.34,"paidDate":"2026-11-05","payments":[{"id":"mwkp1quzm0i5zbc","amount":416.66,"discount":83.34,"date":"2026-11-05","method":"Amortização integral","forgiven":false}],"updatedAt":"2026-11-17T12:54:00.251Z"},{"id":"loan-escritorio-6","number":6,"date":"2027-02-28","amount":500,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-escritorio-7","number":7,"date":"2027-03-30","amount":500,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-escritorio-8","number":8,"date":"2027-04-30","amount":500,"paid":false,"paidAmount":0,"discount":0,"paidDate":null}]},{"id":"loan-nubank","name":"Empréstimo Nubank","amount":468.66,"count":15,"firstDate":"2026-09-11","day":11,"installments":[{"id":"loan-nubank-1","number":1,"date":"2026-09-11","amount":468.66,"paid":true,"paidAmount":468.66,"discount":0,"paidDate":"2026-09-11","payments":[{"id":"mwkp87yp4nz4me3","amount":468.66,"discount":0,"date":"2026-09-11","method":"Pagamento de parcela","forgiven":false}],"updatedAt":"2026-11-17T12:59:02.354Z"},{"id":"loan-nubank-2","number":2,"date":"2026-10-11","amount":468.66,"paid":true,"paidAmount":447.72,"discount":20.94,"paidDate":"2026-10-13","payments":[{"id":"mwkp8u7exnx8yvi","amount":447.72,"discount":20.94,"date":"2026-10-13","method":"Amortização integral","forgiven":false}],"updatedAt":"2026-11-17T12:59:31.178Z"},{"id":"loan-nubank-3","number":3,"date":"2026-11-11","amount":468.66,"paid":true,"paidAmount":418.04,"discount":50.62,"paidDate":"2026-11-11","payments":[{"id":"mwkp9s9f5v0gj5i","amount":418.04,"discount":50.62,"date":"2026-11-11","method":"Amortização integral","forgiven":false}],"updatedAt":"2026-11-17T13:00:15.315Z"},{"id":"loan-nubank-4","number":4,"date":"2026-12-11","amount":468.66,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-nubank-5","number":5,"date":"2027-01-11","amount":468.66,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-nubank-6","number":6,"date":"2027-02-11","amount":468.66,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-nubank-7","number":7,"date":"2027-03-11","amount":468.66,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-nubank-8","number":8,"date":"2027-04-11","amount":468.66,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-nubank-9","number":9,"date":"2027-05-11","amount":468.66,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-nubank-10","number":10,"date":"2027-06-11","amount":468.66,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-nubank-11","number":11,"date":"2027-07-11","amount":468.66,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-nubank-12","number":12,"date":"2027-08-11","amount":468.66,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-nubank-13","number":13,"date":"2027-09-11","amount":468.66,"paid":true,"paidAmount":177.4,"discount":291.26,"paidDate":"2026-09-13","payments":[{"id":"mwkpbw51399jk7a","amount":177.4,"discount":291.26,"date":"2026-09-13","method":"Amortização integral","forgiven":false}],"updatedAt":"2026-11-17T13:01:53.653Z"},{"id":"loan-nubank-14","number":14,"date":"2027-10-11","amount":468.66,"paid":true,"paidAmount":155.55,"discount":313.11,"paidDate":"2026-10-11","payments":[{"id":"mwkpb82tqmhua2u","amount":155.55,"discount":313.11,"date":"2026-10-11","method":"Amortização integral","forgiven":false}],"updatedAt":"2026-11-17T13:01:22.469Z"},{"id":"loan-nubank-15","number":15,"date":"2027-11-11","amount":468.66,"paid":true,"paidAmount":142.77,"discount":325.89,"paidDate":"2026-11-11","payments":[{"id":"mwkpaod9txb714d","amount":142.77,"discount":325.89,"date":"2026-11-11","method":"Amortização integral","forgiven":false}],"updatedAt":"2026-11-17T13:00:56.925Z"}]},{"id":"loan-becker","name":"Becker","amount":75,"count":5,"firstDate":"2026-09-15","day":15,"installments":[{"id":"loan-becker-1","number":1,"date":"2026-09-15","amount":75,"paid":true,"paidAmount":75,"discount":0,"paidDate":"2026-09-10","payments":[{"id":"mwkp3symp2nlh80","amount":75,"discount":0,"date":"2026-09-10","method":"Pix","forgiven":false}],"updatedAt":"2026-11-17T12:55:36.286Z"},{"id":"loan-becker-2","number":2,"date":"2026-10-15","amount":75,"paid":true,"paidAmount":75,"discount":0,"paidDate":"2026-10-15","payments":[{"id":"mwkpc9vowg4gfzr","amount":75,"discount":0,"date":"2026-10-15","method":"Pagamento de parcela","forgiven":false}],"updatedAt":"2026-11-17T13:02:11.460Z"},{"id":"loan-becker-3","number":3,"date":"2026-11-15","amount":75,"paid":true,"paidAmount":75,"discount":0,"paidDate":"2026-11-15","payments":[{"id":"mwkpcivl42i51y9","amount":75,"discount":0,"date":"2026-11-15","method":"Pagamento de parcela","forgiven":false}],"updatedAt":"2026-11-17T13:02:23.121Z"},{"id":"loan-becker-4","number":4,"date":"2026-12-15","amount":75,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-becker-5","number":5,"date":"2027-01-15","amount":75,"paid":false,"paidAmount":0,"discount":0,"paidDate":null}]},{"id":"loan-becker-celular","name":"Becker Celular","amount":95,"count":9,"firstDate":"2026-11-15","day":15,"installments":[{"id":"loan-becker-celular-1","number":1,"date":"2026-11-15","amount":95,"paid":true,"paidAmount":95,"discount":0,"paidDate":"2026-11-15","payments":[{"id":"mwkpctl9wi5gn9p","amount":95,"discount":0,"date":"2026-11-15","method":"Pagamento de parcela","forgiven":false}],"updatedAt":"2026-11-17T13:02:37.005Z"},{"id":"loan-becker-celular-2","number":2,"date":"2026-12-15","amount":95,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-becker-celular-3","number":3,"date":"2027-01-15","amount":95,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-becker-celular-4","number":4,"date":"2027-02-15","amount":95,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-becker-celular-5","number":5,"date":"2027-03-15","amount":95,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-becker-celular-6","number":6,"date":"2027-04-15","amount":95,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-becker-celular-7","number":7,"date":"2027-05-15","amount":95,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-becker-celular-8","number":8,"date":"2027-06-15","amount":95,"paid":false,"paidAmount":0,"discount":0,"paidDate":null},{"id":"loan-becker-celular-9","number":9,"date":"2027-07-15","amount":95,"paid":false,"paidAmount":0,"discount":0,"paidDate":null}]}],"cards":{"nubank":{"amount":700,"dueDate":"2026-10-10","paid":true,"paidDate":"2026-11-17","paidAmount":700,"discount":0,"payments":[{"id":"mwkvz8fb2qdrn3s","amount":700,"discount":0,"date":"2026-11-17","method":"Pix","forgiven":false}],"updatedAt":"2026-11-17T16:08:00.359Z"},"sicredi":{"amount":750,"paid":false,"paidDate":null}},"theme":"light"};
}

function deduplicateAndSanitizeData(targetData) {
    if (!targetData || typeof targetData !== "object") return false;
    let changed = false;

    const legacyDupTxIds = new Set([
        "mwjordr6cnvcsou", "mwjoucwcb5tuxqr", "mwjoukzcj8vy4mj",
        "mwjout9ia4vtpcs", "mwjovbrl1simjov", "mwjp0ctg4yrz742",
        "mwjp31udkhgpvi0", "mwjp3je7urolpor", "mwjp3q5e70k0d58"
    ]);
    const legacyDupPayIds = new Set([
        "mwjp31ud20szri2", "mwjp3je7xe6p908", "mwjp3q5e0nr7z4u",
        "mwjoukzcjqank68", "mwjout9ihngtnke", "mwjovbrlo5ryzhx"
    ]);

    // 1. Limpar pagamentos duplicados dentro das parcelas de empréstimos
    if (Array.isArray(targetData.loans)) {
        targetData.loans.forEach(loan => {
            (loan.installments || []).forEach(inst => {
                if (Array.isArray(inst.payments) && inst.payments.length > 1) {
                    const beforeLen = inst.payments.length;
                    // Remover IDs de pagamentos legados duplicados se já houver outro pagamento na parcela
                    const filtered = inst.payments.filter(p => !legacyDupPayIds.has(p.id));
                    const candidates = filtered.length > 0 ? filtered : inst.payments;

                    // Ordenar priorizando pagamentos que possuem discount definido
                    const sorted = [...candidates].sort((a, b) => (Number(b.discount) || 0) - (Number(a.discount) || 0));
                    const cleanPayments = [];
                    let runningSettled = 0;
                    const maxTotal = Number(inst.amount) || 0;

                    sorted.forEach(p => {
                        const pAmt = Number(p.amount) || 0;
                        const pDisc = Number(p.discount) || 0;
                        if (runningSettled < maxTotal - 0.009) {
                            cleanPayments.push(p);
                            runningSettled += pAmt + pDisc;
                        }
                    });

                    if (cleanPayments.length !== beforeLen) {
                        inst.payments = cleanPayments;
                        changed = true;
                    }
                }
            });
        });
    }

    // 2. Limpar transações duplicadas por ID ou por obligationId de parcela já quitada
    if (Array.isArray(targetData.transactions)) {
        const beforeTxLen = targetData.transactions.length;
        const hasModernObligationTx = new Set(
            targetData.transactions
                .filter(t => t.obligationId && !legacyDupTxIds.has(t.id))
                .map(t => t.obligationId)
        );

        const seenIds = new Set();
        const seenFullObligations = new Set();
        const cleanTxs = [];

        targetData.transactions.forEach(tx => {
            if (!tx || !tx.id) return;
            if (seenIds.has(tx.id)) return;
            if (legacyDupTxIds.has(tx.id) && tx.obligationId && hasModernObligationTx.has(tx.obligationId)) {
                return;
            }
            seenIds.add(tx.id);
            cleanTxs.push(tx);
        });

        if (cleanTxs.length !== beforeTxLen) {
            targetData.transactions = cleanTxs;
            changed = true;
        }
    }

    return changed;
}

function ensureRecoveredUserData() {
    if (!data || typeof data !== "object") return;
    let changed = false;

    if (!Array.isArray(data.transactions)) {
        data.transactions = [];
        changed = true;
    }

    const snap = getRecoveredUserSnapshot();
    const existingTxIds = new Set(data.transactions.map(t => t.id));
    const existingObIds = new Set(data.transactions.filter(t => t.obligationId).map(t => t.obligationId));

    (snap.transactions || []).forEach(recTx => {
        if (existingTxIds.has(recTx.id)) {
            const localTx = data.transactions.find(t => t.id === recTx.id);
            if (localTx && recTx.paid && !localTx.paid) {
                Object.assign(localTx, JSON.parse(JSON.stringify(recTx)));
                changed = true;
            }
            return;
        }
        if (!data.recoveryAppliedV2) {
            if (recTx.obligationId && existingObIds.has(recTx.obligationId)) return;
            data.transactions.push(JSON.parse(JSON.stringify(recTx)));
            existingTxIds.add(recTx.id);
            if (recTx.obligationId) existingObIds.add(recTx.obligationId);
            changed = true;
        }
    });

    if (Array.isArray(snap.loans) && Array.isArray(data.loans)) {
        snap.loans.forEach(recLoan => {
            const localLoan = data.loans.find(l => l.id === recLoan.id);
            if (!localLoan) return;
            (recLoan.installments || []).forEach(recInst => {
                const localInst = (localLoan.installments || []).find(i => i.id === recInst.id);
                if (!localInst) return;
                const recHasPayment = recInst.paid || (recInst.paidAmount > 0) || (recInst.discount > 0) || (Array.isArray(recInst.payments) && recInst.payments.length > 0);
                const localHasPayment = localInst.paid || (localInst.paidAmount > 0) || (localInst.discount > 0) || (Array.isArray(localInst.payments) && localInst.payments.length > 0);
                if (recHasPayment && !localHasPayment) {
                    Object.assign(localInst, JSON.parse(JSON.stringify(recInst)));
                    changed = true;
                }
            });
        });
    }

    if (snap.cards && data.cards) {
        if (snap.cards.sicredi && data.cards.sicredi && data.cards.sicredi.amount === 500 && snap.cards.sicredi.amount === 750) {
            data.cards.sicredi.amount = 750;
            changed = true;
        }
        if (snap.cards.nubank && snap.cards.nubank.paid && data.cards.nubank && !data.cards.nubank.paid && data.cards.nubank.dueDate === snap.cards.nubank.dueDate) {
            Object.assign(data.cards.nubank, JSON.parse(JSON.stringify(snap.cards.nubank)));
            changed = true;
        }
    }

    if (!data.recoveryAppliedV2) {
        data.recoveryAppliedV2 = true;
        changed = true;
    }

    if (deduplicateAndSanitizeData(data)) {
        changed = true;
    }

    if (changed) {
        saveData();
    }
}

function normalizeFinancialState() {
    ensureRecoveredUserData();
    let changed = deduplicateAndSanitizeData(data);
    if (Array.isArray(data.loans)) {
        data.loans.forEach(loan => {
            (loan.installments || []).forEach(inst => {
                const paidVal = amountPaid(inst);
                const discVal = amountDiscount(inst);
                const remVal = amountRemaining(inst);
                const shouldBePaid = remVal <= 0.009;
                if (inst.paid !== shouldBePaid || inst.paidAmount !== paidVal || inst.discount !== discVal) {
                    inst.paid = shouldBePaid;
                    inst.paidAmount = paidVal;
                    inst.discount = discVal;
                    if (shouldBePaid && !inst.paidDate) {
                        const lastPay = Array.isArray(inst.payments) && inst.payments.length
                            ? inst.payments[inst.payments.length - 1].date
                            : dateForToday();
                        inst.paidDate = lastPay;
                    }
                    changed = true;
                }
            });
        });
    }
    if (data.cards && data.cards.nubank) {
        const card = data.cards.nubank;
        const shouldBePaid = card.amount > 0 ? amountRemaining(card) <= 0.009 : Boolean(card.paid);
        if (card.paid !== shouldBePaid) {
            card.paid = shouldBePaid;
            changed = true;
        }
    }
    if (changed) {
        saveData();
    }
}

function ensureFixedBills() {
    const start = parseDate(START_DATE);
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12);
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12);
    let added = false;

    while (cursor <= end) {
        const key = monthKey(cursor);
        FIXED_BILLS.forEach(bill => {
            const dueDate = makeDate(cursor.getFullYear(), cursor.getMonth(), bill.day);
            const id = `fixed-${bill.id}-${key}`;
            const exists = data.transactions.some(t => t.id === id);
            if (!exists) {
                data.transactions.push({
                    id,
                    name: bill.name,
                    category: bill.category,
                    type: "expense",
                    amount: bill.amount,
                    date: dueDate,
                    payment: "Não informado",
                    paid: false,
                    paidAmount: 0,
                    discount: 0,
                    payments: [],
                    fixed: true,
                    competence: key
                });
                added = true;
            }
        });
        cursor = addMonths(cursor, 1, 1);
    }
    if (added) {
        saveData();
    }
}

function getObligationsForSelectedMonth() {
    const selectedKey = monthKey(selectedDate);
    const obligations = [];

    data.transactions.filter(t => t.fixed && t.type === "expense").forEach(item => {
        const due = item.date;
        const key = item.competence || due.slice(0, 7);
        if (key <= selectedKey && (key === selectedKey || amountRemaining(item) > 0.009)) {
            obligations.push({
                id: item.id,
                kind: "fixed",
                title: item.name,
                dueDate: due,
                amount: Number(item.amount) || 0,
                source: item
            });
        }
    });

    data.loans.forEach(loan => {
        (loan.installments || []).forEach(item => {
            const key = item.competence || item.date.slice(0, 7);
            if (key <= selectedKey && (key === selectedKey || amountRemaining(item) > 0.009)) {
                obligations.push({
                    id: item.id,
                    kind: "loan",
                    loanId: loan.id,
                    title: `${loan.name} - Parcela ${item.number}/${loan.count}`,
                    dueDate: item.date,
                    amount: Number(item.amount) || 0,
                    source: item,
                    loan
                });
            }
        });
    });

    const card = data.cards && data.cards.nubank;
    if (card && card.amount > 0 && card.dueDate) {
        const key = card.dueDate.slice(0, 7);
        if (key <= selectedKey && (key === selectedKey || amountRemaining(card) > 0.009)) {
            obligations.push({
                id: "nubank-monthly-bill",
                kind: "nubank",
                title: "Fatura Nubank",
                dueDate: card.dueDate,
                amount: Number(card.amount) || 0,
                source: card
            });
        }
    }

    return obligations.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function recordObligationPayment(obligation, amount, paymentDate, method, discount = 0) {
    if (!obligation || !obligation.source) return false;

    if (obligation.kind === "loan" && obligation.loan) {
        return registerLoanPayment(
            obligation.loan.id,
            obligation.source.id,
            amount,
            discount,
            paymentDate,
            method
        );
    }

    const item = obligation.source;
    const remaining = amountRemaining(item);
    const cleanAmount = Math.round((Number(amount) || 0) * 100) / 100;
    const cleanDiscount = Math.round((Number(discount) || 0) * 100) / 100;
    const totalAbatement = Math.round((cleanAmount + cleanDiscount) * 100) / 100;

    if (remaining <= 0.009) {
        showToast("Esta obrigação já está quitada.", "warning");
        return false;
    }

    if (cleanAmount < 0 || cleanDiscount < 0 || totalAbatement <= 0 || totalAbatement > remaining + 0.009) {
        showToast("Valores inválidos para a obrigação.", "error");
        return false;
    }

    const lockKey = `ob:${obligation.kind}:${obligation.id}:${cleanAmount}:${cleanDiscount}:${paymentDate}`;
    if (!acquireOperationLock(lockKey)) {
        return false;
    }

    const prevDiscount = amountDiscount(item);
    if (!Array.isArray(item.payments)) item.payments = [];

    const effectiveMethod = cleanAmount === 0 && cleanDiscount > 0
        ? "Quitação por perdão de saldo"
        : (method || "Pagamento");

    item.payments.push({
        id: uid(),
        amount: cleanAmount,
        discount: cleanDiscount,
        date: paymentDate,
        method: effectiveMethod,
        forgiven: cleanAmount === 0 && cleanDiscount > 0
    });

    item.paidAmount = amountPaid(item);
    item.discount = Math.round((prevDiscount + cleanDiscount) * 100) / 100;
    item.paid = amountRemaining(item) <= 0.009;
    item.paidDate = item.paid ? paymentDate : null;
    item.updatedAt = new Date().toISOString();

    if (obligation.kind !== "fixed") {
        if (cleanAmount > 0) {
            data.transactions.push({
                id: uid(),
                name: obligation.title,
                category: "Cartões e Crédito",
                type: "expense",
                amount: cleanAmount,
                date: paymentDate,
                payment: effectiveMethod,
                paid: true,
                obligationId: obligation.id,
                competence: obligation.dueDate.slice(0, 7)
            });
        }
    } else {
        item.payment = effectiveMethod;
    }

    saveData();
    return true;
}

function openObligationPayment(obligation) {
    const remaining = amountRemaining(obligation.source);
    if (remaining <= 0.009) {
        showToast("Esta obrigação já está quitada.", "warning");
        return;
    }
    const paid = amountPaid(obligation.source);
    const disc = amountDiscount(obligation.source);

    openModal(
        "Registrar pagamento",
        `
            <p><strong>${escapeHTML(obligation.title)}</strong></p>
            <p>Competência/vencimento: ${formatDate(obligation.dueDate)}</p>
            <p>Valor original: <strong>${money(obligation.amount)}</strong></p>
            <p>Já pago: <strong>${money(paid)}</strong>${disc > 0 ? ` · Desconto: <strong>${money(disc)}</strong>` : ""}</p>
            <p>Saldo restante: <strong>${money(remaining)}</strong></p>
            <div class="form-group">
                <label for="obligationPaymentAmount">Quanto você pagou agora (R$)</label>
                <input id="obligationPaymentAmount" type="number" min="0.01" max="${remaining.toFixed(2)}" step="0.01" value="${remaining.toFixed(2)}">
            </div>
            <div class="form-group">
                <label for="obligationPaymentDate">Data real do pagamento</label>
                <input id="obligationPaymentDate" type="date" value="${dateForToday()}">
            </div>
            <div class="form-group">
                <label for="obligationPaymentMethod">Forma de pagamento</label>
                <input id="obligationPaymentMethod" type="text" value="Pix" placeholder="Pix, dinheiro, débito...">
            </div>
        `,
        "Salvar pagamento",
        () => {
            const amount = Math.round((Number($("obligationPaymentAmount")?.value) || 0) * 100) / 100;
            const paymentDate = $("obligationPaymentDate")?.value;
            const method = ($("obligationPaymentMethod")?.value || "").trim() || "Não informado";
            if (!Number.isFinite(amount) || amount <= 0 || amount > remaining + 0.009 || !paymentDate) {
                showToast("Confira o valor e a data do pagamento.", "error");
                return;
            }
            const ok = recordObligationPayment(obligation, amount, paymentDate, method, 0);
            if (ok && obligation.kind !== "loan") {
                renderApp();
                showToast(amountRemaining(obligation.source) <= 0.009 ? "Obrigação quitada!" : "Pagamento parcial registrado!");
            }
        }
    );
}

function renderMonthlyObligations() {
    let panel = $("monthlyObligationsPanel");
    if (!panel) {
        panel = document.createElement("section");
        panel.id = "monthlyObligationsPanel";
        panel.className = "panel section-panel monthly-obligations-panel";
        const navigation = document.querySelector(".month-navigation");
        if (navigation) navigation.insertAdjacentElement("afterend", panel);
    }
    const obligations = getObligationsForSelectedMonth();
    const stats = { paid: 0, pending: 0, late: 0, partial: 0 };
    obligations.forEach(o => stats[obligationStatus(o.source, o.dueDate)]++);
    const totalRemaining = obligations.reduce((sum, o) => sum + amountRemaining(o.source), 0);

    panel.innerHTML = `
        <div class="panel-header">
            <div>
                <h3>Contas e parcelas deste mês</h3>
                <p>Pagamentos antecipados, parciais, amortizações e pendências continuam vinculados ao vencimento original.</p>
            </div>
            <i data-lucide="calendar-check"></i>
        </div>
        <div class="monthly-obligation-summary">
            <span><strong>${stats.paid}</strong> pagas</span>
            <span><strong>${stats.pending}</strong> pendentes</span>
            <span><strong>${stats.late}</strong> atrasadas</span>
            <span><strong>${stats.partial}</strong> parciais</span>
            <span class="obligation-open-total">Em aberto: <strong>${money(totalRemaining)}</strong></span>
        </div>
        <div class="monthly-obligation-list">
            ${obligations.length ? obligations.map(o => {
                const status = obligationStatus(o.source, o.dueDate);
                const paid = amountPaid(o.source);
                const discount = amountDiscount(o.source);
                const remaining = amountRemaining(o.source);
                const forgiven = isForgivenFull(o.source);
                const historyText = formatPaymentHistorySummary(o.source);
                const labels = {
                    paid: forgiven ? "QUITADA (PERDÃO)" : "PAGA",
                    pending: "PENDENTE",
                    late: "ATRASADA",
                    partial: "PARCIAL"
                };

                const details = [
                    `Vencimento: ${formatDate(o.dueDate)}`,
                    paid > 0 ? `Pago: ${money(paid)}` : "",
                    discount > 0 ? (forgiven ? `Perdão de saldo: ${money(discount)}` : `Economia: ${money(discount)}`) : ""
                ].filter(Boolean).join(" · ");

                return `<article class="monthly-obligation-row">
                    <div class="monthly-obligation-main">
                        <strong>${escapeHTML(o.title)}</strong>
                        <span>${details}</span>
                        ${historyText ? `<span class="obligation-history-line">Histórico: ${historyText}</span>` : ""}
                    </div>
                    <div class="monthly-obligation-values">
                        <strong>${money(remaining > 0.009 ? remaining : o.amount)}</strong>
                        <span class="obligation-status status-${status}">${labels[status]}</span>
                    </div>
                    ${remaining > 0.009 ? `
                        <div class="monthly-obligation-actions">
                            <button
                                type="button"
                                class="btn-primary obligation-pay-button"
                                data-obligation-pay="true"
                                data-obligation-kind="${o.kind}"
                                data-obligation-id="${escapeHTML(o.id)}"
                            >${(paid > 0 || discount > 0) ? "Pagar restante" : "Registrar pagamento"}</button>
                            ${o.kind === "loan" && o.loan ? `
                                <button
                                    type="button"
                                    class="btn-secondary obligation-amortize-button"
                                    data-obligation-amortize="true"
                                    data-loan-id="${escapeHTML(o.loan.id)}"
                                    data-installment-id="${escapeHTML(o.id)}"
                                >Amortizar</button>
                            ` : ""}
                        </div>
                    ` : `<span class="obligation-paid-date">${forgiven ? "Quitada por perdão" : "Quitada"}</span>`}
                </article>`;
            }).join("") : `<p class="empty-table">Nenhuma obrigação cadastrada para este período.</p>`}
        </div>`;

    refreshIcons();
}

function updateSummary() {
    const income = getMonthlyIncome();
    const expenses = getMonthlyExpenses();
    const balance = income - expenses;
    $("totalIncome").textContent = money(income);
    $("totalExpenses").textContent = money(expenses);
    $("currentBalance").textContent = money(balance);
    $("currentBalance").style.color = balance < 0 ? "var(--red)" : "var(--primary)";
    $("totalTransactions").textContent = getMonthlyTransactions().length;

    const obligations = getObligationsForSelectedMonth();
    $("pendingBills").textContent = obligations.filter(o => (o.kind === "fixed" || o.kind === "nubank") && amountRemaining(o.source) > 0.009).length;
    $("pendingInstallments").textContent = obligations.filter(o => o.kind === "loan" && amountRemaining(o.source) > 0.009).length;
    const percentage = income > 0 ? (expenses / income) * 100 : 0;
    $("expensePercentage").textContent = `${percentage.toFixed(1).replace(".", ",")}%`;
}

function renderNubank() {
    const card = data.cards.nubank;
    $("nubankBill").textContent = money(amountRemaining(card));
    $("nubankDueDate").textContent = formatDate(card.dueDate);
    const paid = amountRemaining(card) <= 0.009;
    $("payNubank").disabled = paid;
    $("payNubank").innerHTML = paid ? '<i data-lucide="check"></i> Fatura Paga' : '<i data-lucide="check-circle"></i> Pagar';
    refreshIcons();
}

function renderLoans() {
    const container = $("loanList");
    if (!data.loans.length) {
        container.innerHTML = `<p class="empty-table">Nenhum empréstimo cadastrado.</p>`;
        return;
    }
    container.innerHTML = data.loans.map(loan => {
        const paidCount = loan.installments.filter(i => amountRemaining(i) <= 0.009).length;
        const loanTotal = loan.installments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const loanRemaining = loan.installments.reduce((sum, item) => sum + amountRemaining(item), 0);
        const loanDiscount = loan.installments.reduce((sum, item) => sum + amountDiscount(item), 0);

        return `<article class="loan-group">
            <div class="loan-group-header">
                <div>
                    <h4>${escapeHTML(loan.name)}</h4>
                    <p>${paidCount} de ${loan.installments.length} parcelas quitadas${loanDiscount > 0 ? ` · Economia acumulada: ${money(loanDiscount)}` : ""}</p>
                </div>
                <span class="loan-group-total" title="Original: ${money(loanTotal)}">${money(loanRemaining > 0.009 ? loanRemaining : loanTotal)}</span>
            </div>
            ${loan.installments.map(item => {
                const remaining = amountRemaining(item);
                const paid = amountPaid(item);
                const discount = amountDiscount(item);
                const forgiven = isForgivenFull(item);
                const isSettled = remaining <= 0.009;
                const historyText = formatPaymentHistorySummary(item);

                return `<div class="loan-installment ${isSettled ? "paid" : ""}">
                    <div class="loan-installment-info">
                        <strong>Parcela ${item.number}/${loan.installments.length}</strong>
                        <span>Vencimento: ${formatDate(item.date)} · Valor original: ${money(item.amount)}</span>
                        <span>${
                            forgiven
                                ? `Quitada por perdão de saldo (${money(discount)})`
                                : isSettled
                                    ? `Pago: ${money(paid)}`
                                    : `Restante: ${money(remaining)}`
                        }</span>
                        ${paid > 0 && !isSettled ? `<span>Pago parcialmente: ${money(paid)}</span>` : ""}
                        ${discount > 0 && !forgiven ? `<span>Economia: ${money(discount)}</span>` : ""}
                        ${historyText ? `<span class="loan-installment-history">Histórico: ${historyText}</span>` : ""}
                    </div>
                    <div class="loan-installment-actions">
                        ${isSettled
                            ? `<span class="status-paid">${forgiven ? "QUITADO (PERDÃO)" : "PAGO"}</span>`
                            : `
                                <button type="button" class="pay-button" data-loan-pay="${escapeHTML(loan.id)}" data-installment="${escapeHTML(item.id)}">${(paid > 0 || discount > 0) ? "Pagar restante" : "Pagar"}</button>
                                <button type="button" class="amortize-button" data-loan-amortize="${escapeHTML(loan.id)}" data-installment="${escapeHTML(item.id)}">Amortizar</button>
                            `
                        }
                    </div>
                </div>`;
            }).join("")}
        </article>`;
    }).join("");
    refreshIcons();
}

function updateLoanSummary() {
    let total = 0;
    let paid = 0;
    let remaining = 0;

    data.loans.forEach(loan => {
        (loan.installments || []).forEach(item => {
            total += Number(item.amount) || 0;
            paid += amountPaid(item);
            remaining += amountRemaining(item);
        });
    });

    $("totalLoans").textContent = money(total);
    $("paidLoans").textContent = money(paid);
    $("remainingLoans").textContent = money(Math.max(0, Math.round(remaining * 100) / 100));
}

function registerLoanPayment(loanId, installmentId, amount, discount = 0, paymentDate = dateForToday(), customMethod = null) {
    const result = findInstallment(loanId, installmentId);
    if (!result) return false;
    const { loan, installment } = result;
    const remaining = amountRemaining(installment);

    if (remaining <= 0.009) {
        showToast("Esta parcela já está quitada.", "warning");
        return false;
    }

    const cleanAmount = Math.round((Number(amount) || 0) * 100) / 100;
    const cleanDiscount = Math.round((Number(discount) || 0) * 100) / 100;
    const totalAbatement = Math.round((cleanAmount + cleanDiscount) * 100) / 100;

    if (
        !Number.isFinite(cleanAmount) ||
        !Number.isFinite(cleanDiscount) ||
        cleanAmount < 0 ||
        cleanDiscount < 0 ||
        totalAbatement <= 0 ||
        totalAbatement > remaining + 0.009
    ) {
        showToast("Valores de pagamento/amortização inválidos.", "error");
        return false;
    }

    if (!paymentDate) {
        showToast("Informe a data da operação.", "error");
        return false;
    }

    const lockKey = `loan:${loanId}:${installmentId}:${cleanAmount}:${cleanDiscount}:${paymentDate}`;
    if (!acquireOperationLock(lockKey)) {
        return false;
    }

    const isFullSettlement = totalAbatement >= remaining - 0.009;
    const isForgiveness = cleanAmount <= 0.009 && cleanDiscount > 0;

    let method = customMethod;
    if (!method) {
        if (isForgiveness && isFullSettlement) {
            method = "Quitação por perdão de saldo";
        } else if (isForgiveness) {
            method = "Perdão parcial de saldo";
        } else if (cleanDiscount > 0 && isFullSettlement) {
            method = "Amortização integral";
        } else if (cleanDiscount > 0) {
            method = "Amortização parcial";
        } else if (isFullSettlement) {
            method = "Pagamento de parcela";
        } else {
            method = "Pagamento parcial";
        }
    }

    const previousDiscount = amountDiscount(installment);
    if (!Array.isArray(installment.payments)) installment.payments = [];

    installment.payments.push({
        id: uid(),
        amount: cleanAmount,
        discount: cleanDiscount,
        date: paymentDate,
        method,
        forgiven: isForgiveness
    });

    installment.paidAmount = amountPaid(installment);
    installment.discount = Math.round((previousDiscount + cleanDiscount) * 100) / 100;
    installment.paid = amountRemaining(installment) <= 0.009;
    installment.paidDate = installment.paid ? paymentDate : null;
    installment.updatedAt = new Date().toISOString();

    if (cleanAmount > 0) {
        const txLabel = cleanDiscount > 0
            ? `${loan.name} - Parcela ${installment.number}/${loan.count} (${method})`
            : `${loan.name} - Parcela ${installment.number}/${loan.count}`;

        data.transactions.push({
            id: uid(),
            name: txLabel,
            category: "Empréstimos",
            type: "expense",
            amount: cleanAmount,
            date: paymentDate,
            payment: method,
            paid: true,
            competence: installment.date.slice(0, 7),
            obligationId: installment.id
        });
    }

    saveData();
    renderApp();

    if (isForgiveness && installment.paid) {
        showToast(`Parcela quitada por perdão de saldo! Economia de ${money(cleanDiscount)}.`);
    } else if (cleanDiscount > 0 && installment.paid) {
        showToast(`Parcela quitada com amortização! Economia de ${money(cleanDiscount)}.`);
    } else if (cleanDiscount > 0) {
        showToast(`Amortização parcial registrada! Saldo restante: ${money(amountRemaining(installment))}.`);
    } else if (installment.paid) {
        showToast("Parcela quitada com sucesso!");
    } else {
        showToast(`Pagamento parcial registrado! Saldo restante: ${money(amountRemaining(installment))}.`);
    }

    return true;
}

function payInstallment(loanId, installmentId) {
    const result = findInstallment(loanId, installmentId);
    if (!result) return;
    const { loan, installment } = result;
    const remaining = amountRemaining(installment);
    if (remaining <= 0.009) {
        showToast("Esta parcela já está quitada.", "warning");
        return;
    }

    openModal(
        "Pagar parcela",
        `
            <p><strong>${escapeHTML(loan.name)}</strong> · Parcela ${installment.number}/${loan.count}</p>
            <p>Vencimento: ${formatDate(installment.date)}</p>
            <p>Saldo restante: <strong>${money(remaining)}</strong></p>
            <div class="form-group">
                <label for="loanPayAmount">Valor pago agora (R$)</label>
                <input id="loanPayAmount" type="number" min="0.01" max="${remaining.toFixed(2)}" step="0.01" value="${remaining.toFixed(2)}">
            </div>
            <div class="form-group">
                <label for="loanPayDate">Data real do pagamento</label>
                <input id="loanPayDate" type="date" value="${dateForToday()}">
            </div>
        `,
        "Registrar pagamento",
        () => {
            const amount = Math.round((Number($("loanPayAmount")?.value) || 0) * 100) / 100;
            const paymentDate = $("loanPayDate")?.value;
            if (!paymentDate) return showToast("Informe a data real do pagamento.", "error");
            registerLoanPayment(loanId, installmentId, amount, 0, paymentDate);
        }
    );
}

function amortizeInstallment(loanId, installmentId) {
    const result = findInstallment(loanId, installmentId);
    if (!result) return;
    const { loan, installment } = result;
    const remaining = amountRemaining(installment);
    if (remaining <= 0.009) {
        showToast("Esta parcela já está quitada.", "warning");
        return;
    }

    openModal(
        "Amortizar Parcela",
        `
            <p>Empréstimo: <strong>${escapeHTML(loan.name)}</strong> · Parcela ${installment.number}/${loan.count}</p>
            <p>Vencimento: ${formatDate(installment.date)} · Valor original: <strong>${money(installment.amount)}</strong></p>
            <p>Saldo atual da parcela: <strong>${money(remaining)}</strong></p>

            <div class="form-group">
                <label for="amortizeDiscount">Desconto concedido (R$) — até 100% (${money(remaining)})</label>
                <input
                    type="number"
                    id="amortizeDiscount"
                    min="0"
                    max="${remaining.toFixed(2)}"
                    step="0.01"
                    value="0"
                >
            </div>

            <div class="form-group">
                <label for="amortizePayAmount">Valor a pagar agora (R$) — edite para amortização parcial</label>
                <input
                    type="number"
                    id="amortizePayAmount"
                    min="0"
                    max="${remaining.toFixed(2)}"
                    step="0.01"
                    value="${remaining.toFixed(2)}"
                >
            </div>

            <div class="form-group">
                <label for="amortizeFinal">Valor a pagar</label>
                <input
                    type="text"
                    id="amortizeFinal"
                    value="${money(remaining)}"
                    readonly
                >
            </div>

            <div class="form-group">
                <label for="amortizeSaving">Economia obtida</label>
                <input
                    type="text"
                    id="amortizeSaving"
                    value="${money(0)}"
                    readonly
                >
            </div>

            <div class="form-group">
                <label for="amortizeRemainingPreview">Saldo após amortização</label>
                <input
                    type="text"
                    id="amortizeRemainingPreview"
                    value="${money(0)} (Quitada)"
                    readonly
                >
            </div>

            <div class="form-group">
                <label for="amortizePaymentDate">Data real da operação</label>
                <input
                    type="date"
                    id="amortizePaymentDate"
                    value="${dateForToday()}"
                >
            </div>
        `,
        "Confirmar amortização",
        () => {
            const rawDiscount = Number($("amortizeDiscount")?.value) || 0;
            const discount = Math.round(Math.max(0, Math.min(remaining, rawDiscount)) * 100) / 100;
            const maxPayable = Math.max(0, Math.round((remaining - discount) * 100) / 100);

            const payInput = $("amortizePayAmount");
            const rawPay = payInput && payInput.value !== "" ? Number(payInput.value) : maxPayable;
            const amount = Math.round(Math.max(0, Math.min(maxPayable, rawPay)) * 100) / 100;
            const paymentDate = $("amortizePaymentDate")?.value;

            if (!paymentDate) {
                showToast("Informe a data real da operação.", "error");
                return;
            }

            if (amount + discount <= 0.009) {
                showToast("Informe um valor de pagamento ou desconto maior que zero.", "error");
                return;
            }

            registerLoanPayment(loanId, installmentId, amount, discount, paymentDate);
        }
    );

    setTimeout(() => {
        const discountInput = $("amortizeDiscount");
        const payInput = $("amortizePayAmount");
        const finalPreview = $("amortizeFinal");
        const savingPreview = $("amortizeSaving");
        const remPreview = $("amortizeRemainingPreview");

        if (!discountInput || !payInput) return;

        let userEditedPayAmount = false;

        function refreshAmortizePreview(triggeredByDiscount) {
            const rawDisc = Number(discountInput.value) || 0;
            const disc = Math.round(Math.max(0, Math.min(remaining, rawDisc)) * 100) / 100;
            const maxPay = Math.max(0, Math.round((remaining - disc) * 100) / 100);

            payInput.max = maxPay.toFixed(2);

            if (triggeredByDiscount && !userEditedPayAmount) {
                payInput.value = maxPay.toFixed(2);
            } else {
                const currentPay = Number(payInput.value) || 0;
                if (currentPay > maxPay) {
                    payInput.value = maxPay.toFixed(2);
                }
            }

            const payVal = Math.round(Math.max(0, Math.min(maxPay, Number(payInput.value) || 0)) * 100) / 100;
            const newRemaining = Math.max(0, Math.round((remaining - disc - payVal) * 100) / 100);

            if (finalPreview) {
                finalPreview.value = payVal <= 0.009 && disc >= remaining - 0.009
                    ? `${money(0)} (Quitação por perdão de saldo)`
                    : money(payVal);
            }

            if (savingPreview) {
                savingPreview.value = money(disc);
            }

            if (remPreview) {
                remPreview.value = newRemaining <= 0.009
                    ? `${money(0)} (${payVal <= 0.009 && disc > 0 ? "Quitada por perdão" : "Parcela quitada"})`
                    : `${money(newRemaining)} (Amortização parcial)`;
            }
        }

        discountInput.addEventListener("input", () => {
            refreshAmortizePreview(true);
        });

        payInput.addEventListener("input", () => {
            userEditedPayAmount = true;
            refreshAmortizePreview(false);
        });

        refreshAmortizePreview(true);
    }, 0);
}

function renderApp() {
    normalizeFinancialState();
    ensureFixedBills();
    updateMonthControls();
    updateSummary();
    updateChart();
    renderTransactions();
    renderNubank();
    renderSicredi();
    updateLoanSummary();
    renderLoans();
    renderMonthlyObligations();
    applyTheme();
}

// Os botões da fatura passam a usar o mesmo histórico de pagamentos parciais.
const oldNubankPayButton = $("payNubank");
if (oldNubankPayButton) {
    const newNubankPayButton = oldNubankPayButton.cloneNode(true);
    oldNubankPayButton.replaceWith(newNubankPayButton);
    newNubankPayButton.addEventListener("click", () => {
        const card = data.cards.nubank;
        openObligationPayment({
            id: "nubank-monthly-bill",
            kind: "nubank",
            title: "Fatura Nubank",
            dueDate: card.dueDate,
            amount: Number(card.amount) || 0,
            source: card
        });
    });
}

const oldNubankEditButton = $("editNubank");
if (oldNubankEditButton) {
    const newNubankEditButton = oldNubankEditButton.cloneNode(true);
    oldNubankEditButton.replaceWith(newNubankEditButton);
    newNubankEditButton.addEventListener("click", () => {
        const card = data.cards.nubank;
        openModal(
            "Atualizar Fatura Nubank",
            `
                <div class="form-group">
                    <label for="modalNubankValue">Valor da fatura (R$)</label>
                    <input
                        id="modalNubankValue"
                        type="number"
                        min="0"
                        step="0.01"
                        value="${card.amount}"
                    >
                </div>

                <div class="form-group">
                    <label for="modalNubankDate">Vencimento</label>
                    <input
                        id="modalNubankDate"
                        type="date"
                        value="${card.dueDate}"
                    >
                </div>
            `,
            "Salvar alterações",
            () => {
                const amount = Number($("modalNubankValue")?.value);
                const date = $("modalNubankDate")?.value;

                if (!Number.isFinite(amount) || amount < 0 || !date) {
                    showToast("Informe valores válidos.", "error");
                    return;
                }

                const oldDueDate = data.cards.nubank.dueDate;
                const wasFullyPaid = amountRemaining(data.cards.nubank) <= 0.009;

                data.cards.nubank.amount = amount;
                data.cards.nubank.dueDate = date;

                if (date !== oldDueDate || wasFullyPaid || amount <= 0) {
                    data.cards.nubank.payments = [];
                    data.cards.nubank.paidAmount = 0;
                    data.cards.nubank.discount = 0;
                    data.cards.nubank.paid = amount <= 0;
                    data.cards.nubank.paidDate = null;
                } else {
                    data.cards.nubank.paid = amountRemaining(data.cards.nubank) <= 0.009;
                    if (!data.cards.nubank.paid) {
                        data.cards.nubank.paidDate = null;
                    }
                }

                saveData();
                renderApp();
                showToast("Fatura atualizada!");
            }
        );
    });
}

// Ações do painel mensal: pagamento e amortização direta com chave estável.
if (!window.__finanlarObligationEventsBound) {
    document.addEventListener("click", event => {
        const payButton = event.target.closest("[data-obligation-pay], .obligation-pay-button");
        if (payButton) {
            const obligation = getObligationsForSelectedMonth().find(
                item => item.id === payButton.dataset.obligationId && item.kind === payButton.dataset.obligationKind
            );
            if (obligation) openObligationPayment(obligation);
            return;
        }

        const amortizeButton = event.target.closest("[data-obligation-amortize]");
        if (amortizeButton) {
            const loanId = amortizeButton.dataset.loanId;
            const instId = amortizeButton.dataset.installmentId;
            if (loanId && instId) {
                amortizeInstallment(loanId, instId);
            }
        }
    });
    window.__finanlarObligationEventsBound = true;
}

// Estilos complementares da lista mensal e histórico, sem alterar o arquivo CSS original.
if (!$("monthlyObligationsStyles")) {
    const style = document.createElement("style");
    style.id = "monthlyObligationsStyles";
    style.textContent = `
      .monthly-obligations-panel{margin:18px 0;padding:22px}
      .monthly-obligation-summary{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0;padding:12px;background:var(--bg-secondary,rgba(100,116,139,.08));border-radius:12px}
      .monthly-obligation-summary span{font-size:13px}.monthly-obligation-summary strong{font-size:15px}
      .monthly-obligation-summary .obligation-open-total{margin-left:auto}
      .monthly-obligation-list{display:grid;gap:10px}
      .monthly-obligation-row{display:flex;align-items:center;gap:14px;justify-content:space-between;flex-wrap:wrap;padding:13px;border:1px solid var(--border,rgba(100,116,139,.2));border-radius:12px}
      .monthly-obligation-main{display:grid;gap:5px;min-width:180px;flex:1}.monthly-obligation-main span,.monthly-obligation-values span,.obligation-paid-date{font-size:12px;color:var(--text-secondary,#64748b)}
      .obligation-history-line,.loan-installment-history{font-size:11px !important;color:var(--primary,#2563eb) !important;opacity:.9}
      .monthly-obligation-values{display:grid;gap:5px;text-align:right}.obligation-status{font-weight:700;letter-spacing:.04em}.status-paid{color:#16a34a}.status-pending{color:#d97706}.status-late{color:#dc2626}.status-partial{color:#2563eb}
      .monthly-obligation-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .obligation-pay-button,.obligation-amortize-button{white-space:nowrap;padding:9px 13px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700}
      @media(max-width:640px){.monthly-obligation-row{align-items:flex-start}.monthly-obligation-values{text-align:left}.monthly-obligation-actions{width:100%}.obligation-pay-button,.obligation-amortize-button{flex:1;width:100%}.monthly-obligation-summary .obligation-open-total{margin-left:0;width:100%}}
    `;
    document.head.appendChild(style);
}

// Atualiza a interface já inicializada pelo código original.
renderApp();

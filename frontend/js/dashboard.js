const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId");
const userName = localStorage.getItem("userName") || "User";

if (!token || !userId) window.location.href = "index.html";

// UI Setup
document.querySelector(".top-bar p").textContent = `Welcome back, ${userName}`;
document.querySelector(".avatar").textContent = userName.charAt(0).toUpperCase();

// Helpers
const formatCurrency = (amt) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt);
const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

// Global State
let allExpenses = [];
let allCategories = [];
let pieChart = null;
let trendChart = null;

const elements = {
    totalAmount: document.getElementById("totalAmount"),
    expenseCount: document.getElementById("expenseCount"),
    expenseList: document.getElementById("expenseList"),
    filterSearch: document.getElementById("filterSearch"),
    filterSort: document.getElementById("filterSort"),
    filterMonth: document.getElementById("filterMonth"),
    filterYear: document.getElementById("filterYear"),
    filterCategory: document.getElementById("filterCategory"),
    filterStartDate: document.getElementById("filterStartDate"),
    filterEndDate: document.getElementById("filterEndDate"),
    modal: document.getElementById("expenseModal"),
    categorySelect: document.getElementById("categorySelect"),
    addCategoryBtn: document.getElementById("addCategoryBtn"),
    addForm: document.getElementById("addExpenseForm"),
    profileMenu: document.getElementById("profileMenu"),
    profileTrigger: document.getElementById("profileTrigger"),
    toggleFiltersBtn: document.getElementById("toggleFiltersBtn"),
    filterPanel: document.getElementById("filterPanel"),
    themeToggle: document.getElementById("themeToggle"),
    addBudgetBtn: document.getElementById("addBudgetBtn"),
    budgetList: document.getElementById("budgetList"),
    // Subscription Elements
    manageSubsBtn: document.getElementById("manageSubsBtn"),
    subsModal: document.getElementById("subsModal"),
    subsList: document.getElementById("subsList"),
    closeSubsBtn: document.getElementById("closeSubsBtn")
};

// --- 1. INITIALIZATION ---
async function loadDashboard() {
    try {
        console.log("Loading Dashboard Data...");

        const [expenses, globalCats, userCats] = await Promise.all([
            apiRequest(`/expenses/user/${userId}`),
            apiRequest(`/categories/global`),
            apiRequest(`/categories/user/${userId}`)
        ]);

        // Merge Categories safely
        const safeGlobal = Array.isArray(globalCats) ? globalCats : [];
        const safeUser = Array.isArray(userCats) ? userCats : [];
        allCategories = [...safeGlobal, ...safeUser];
        allExpenses = expenses;

        // Populate UI
        populateCategoryDropdown(allCategories);
        populateFilterDropdowns(allCategories, expenses);

        applyFilters();
        renderTrendChart(expenses);
        loadBudgets();

    } catch (error) {
        console.error("Critical Error:", error);
        if (error.message.includes("User not found")) {
            localStorage.clear();
            window.location.href = "index.html";
        }
    }
}

// --- 2. BUDGET LOGIC ---
async function loadBudgets() {
    try {
        const budgets = await apiRequest(`/expenses/budget/status/user/${userId}`);

        if (!budgets || budgets.length === 0) {
            elements.budgetList.innerHTML = `<p class="text-muted" style="font-size:13px; text-align:center;">No budgets set.</p>`;
            return;
        }

        elements.budgetList.innerHTML = budgets.map(b => {
            let colorClass = "";
            if (b.percentage > 100) colorClass = "danger";
            else if (b.percentage > 80) colorClass = "warning";

            return `
            <div class="budget-item">
                <div class="budget-info">
                    <span>${b.categoryName}</span>
                    <span>${formatCurrency(b.spent)} / ${formatCurrency(b.limit)}</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill ${colorClass}" style="width: ${Math.min(b.percentage, 100)}%"></div>
                </div>
            </div>`;
        }).join("");
    } catch (e) {
        console.error("Budget Error", e);
    }
}

elements.addBudgetBtn.addEventListener("click", async () => {
    const catName = prompt("Enter exact Category Name to set budget for:");
    if (!catName) return;

    // Case-insensitive lookup
    const category = allCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());
    if (!category) return alert("Category not found! Please check spelling.");

    const amountStr = prompt(`Enter monthly limit for ${category.name}:`);
    if (!amountStr) return;

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
        return alert("Please enter a valid positive number for the budget.");
    }

    try {
        await apiRequest(`/expenses/budget/user/${userId}`, {
            method: "POST",
            body: JSON.stringify({ categoryId: category.id, limitAmount: amount })
        });
        alert("Budget Set!");
        loadBudgets();
    } catch (e) { alert("Failed: " + e.message); }
});


// --- 3. CHARTS ---
function renderPieChart(expenses) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const categoryTotals = {};
    expenses.forEach(exp => {
        const cat = exp.categoryName || 'Uncategorized';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount;
    });

    if (pieChart) pieChart.destroy();

    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: ['#FF9F6E', '#FF7A3D', '#64D2FF', '#A084FF', '#34C759', '#FFD60A'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: getComputedStyle(document.body).getPropertyValue('--text-muted'),
                        font: { size: 13, family: "'Plus Jakarta Sans', sans-serif" },
                        boxWidth: 14, padding: 15
                    }
                }
            }
        }
    });
}

function renderTrendChart(expenses) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    const isLight = document.body.getAttribute("data-theme") === "light";
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)';
    const textColor = isLight ? '#64748B' : '#9AA0AE';

    const dailyTotals = {};
    expenses.forEach(exp => {
        const date = exp.expenseDate;
        dailyTotals[date] = (dailyTotals[date] || 0) + exp.amount;
    });

    const sortedDates = Object.keys(dailyTotals).sort();
    const dataPoints = sortedDates.map(date => dailyTotals[date]);

    if (trendChart) trendChart.destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(255, 159, 110, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 159, 110, 0.0)');

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates.map(d => formatDate(d)),
            datasets: [{
                label: 'Daily Spending',
                data: dataPoints,
                borderColor: '#FF9F6E',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: isLight ? '#fff' : '#05070D',
                pointBorderColor: '#FF9F6E'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor } },
                y: { grid: { color: gridColor }, ticks: { color: textColor } }
            },
            plugins: { legend: { display: false } }
        }
    });
}


// --- 4. FILTERING (With Validation) ---
function applyFilters() {
    let filtered = [...allExpenses];
    const search = elements.filterSearch.value.toLowerCase();
    const startDate = elements.filterStartDate.value;
    const endDate = elements.filterEndDate.value;

    // Date Range Validation
    if (startDate && endDate) {
        if (new Date(startDate) > new Date(endDate)) {
            alert("Start Date cannot be after End Date!");
            elements.filterEndDate.value = "";
            return;
        }
    }

    // 1. Search
    if (search) filtered = filtered.filter(e => e.description.toLowerCase().includes(search) || (e.categoryName && e.categoryName.toLowerCase().includes(search)));

    // 2. Category
    if (elements.filterCategory.value !== 'all') filtered = filtered.filter(e => e.categoryName === elements.filterCategory.value);

    // 3. Date
    if (startDate || endDate) {
        if (startDate) filtered = filtered.filter(e => e.expenseDate >= startDate);
        if (endDate) filtered = filtered.filter(e => e.expenseDate <= endDate);
    } else {
        if (elements.filterMonth.value !== 'all') filtered = filtered.filter(e => new Date(e.expenseDate).getMonth() === parseInt(elements.filterMonth.value));
        if (elements.filterYear.value !== 'all') filtered = filtered.filter(e => new Date(e.expenseDate).getFullYear() === parseInt(elements.filterYear.value));
    }

    // 4. Sort
    const sort = elements.filterSort.value;
    filtered.sort((a, b) => {
        if (sort === 'date-desc') return new Date(b.expenseDate) - new Date(a.expenseDate);
        if (sort === 'date-asc') return new Date(a.expenseDate) - new Date(b.expenseDate);
        if (sort === 'amount-desc') return b.amount - a.amount;
        if (sort === 'amount-asc') return a.amount - b.amount;
        return 0;
    });

    updateStats(filtered);
    renderPieChart(filtered);
    renderList(filtered);
    renderTrendChart(filtered);
}

[elements.filterSearch, elements.filterSort, elements.filterCategory, elements.filterStartDate, elements.filterEndDate, elements.filterMonth, elements.filterYear]
    .forEach(el => el.addEventListener('input', applyFilters));


// --- 5. UI RENDERING HELPERS ---
function updateStats(expenses) {
    elements.totalAmount.textContent = formatCurrency(expenses.reduce((sum, exp) => sum + exp.amount, 0));
    elements.expenseCount.textContent = expenses.length;
}

function renderList(expenses) {
    if (expenses.length === 0) { elements.expenseList.innerHTML = `<p style="text-align:center; color:#555; margin-top:20px;">No expenses found.</p>`; return; }
    elements.expenseList.innerHTML = expenses.map(exp => `
        <div class="expense-item">
            <div class="expense-info">
                <h4>${exp.description}</h4>
                <div class="expense-meta">${formatDate(exp.expenseDate)} • <span style="color:var(--accent)">${exp.categoryName || 'General'}</span></div>
            </div>
            <div style="display:flex; align-items:center; gap: 8px;">
                <div class="expense-amount" style="margin-right:8px;">${formatCurrency(exp.amount)}</div>
                <button class="btn-edit" onclick="editExpense(${exp.id})" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                <button class="btn-delete" onclick="deleteExpense(${exp.id})" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
            </div>
        </div>
    `).join("");
}

function populateCategoryDropdown(categories) {
    if (!categories || categories.length === 0) {
        elements.categorySelect.innerHTML = '<option value="" disabled selected>No categories found</option>';
        return;
    }
    const opts = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    elements.categorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>' + opts;
}

function populateFilterDropdowns(categories, expenses) {
    if (categories && categories.length > 0) {
        const catOpts = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        elements.filterCategory.innerHTML = '<option value="all">All Categories</option>' + catOpts;
    }

    if (expenses && expenses.length > 0) {
        const years = [...new Set(expenses.map(e => new Date(e.expenseDate).getFullYear()))].sort((a, b) => b - a);
        const yearOpts = years.map(y => `<option value="${y}">${y}</option>`).join('');
        elements.filterYear.innerHTML = '<option value="all">All Years</option>' + yearOpts;
    }
}


// --- 6. ACTIONS (Forms & Buttons) ---

// Handle Add/Edit Form Submit
elements.addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("expenseId").value;
    const isRecurring = document.getElementById("isRecurring").checked;

    const amountVal = parseFloat(document.getElementById("amount").value);
    const dateVal = document.getElementById("date").value;

    if (isNaN(amountVal) || amountVal <= 0) return alert("Amount must be a positive number.");
    if (!dateVal) return alert("Please select a valid date.");

    const expenseData = {
        description: document.getElementById("desc").value,
        amount: amountVal,
        expenseDate: dateVal,
        categoryId: parseInt(elements.categorySelect.value)
    };

    try {
        if (id) {
            await apiRequest(`/expenses/${id}/user/${userId}`, { method: "PUT", body: JSON.stringify(expenseData) });
        } else if (isRecurring) {
            await apiRequest(`/expenses/recurring/user/${userId}`, { method: "POST", body: JSON.stringify(expenseData) });
            alert("Recurring Expense Set!");
        } else {
            await apiRequest(`/expenses/user/${userId}`, { method: "POST", body: JSON.stringify(expenseData) });
        }

        elements.modal.classList.remove("active");
        elements.addForm.reset();
        loadDashboard();
    } catch (err) { alert("Error: " + err.message); }
});

window.editExpense = (id) => {
    const expense = allExpenses.find(e => e.id === id);
    if (!expense) return;

    document.getElementById("expenseId").value = expense.id;
    document.getElementById("desc").value = expense.description;
    document.getElementById("amount").value = expense.amount;
    document.getElementById("date").value = expense.expenseDate;
    elements.categorySelect.value = expense.categoryId;

    document.getElementById("isRecurring").parentElement.style.display = "none";
    document.querySelector(".modal h3").textContent = "Edit Expense";
    document.querySelector(".modal button[type='submit']").textContent = "Update Expense";
    elements.modal.classList.add("active");
};

window.deleteExpense = async (id) => {
    if (!confirm("Delete this expense?")) return;
    try {
        await apiRequest(`/expenses/${id}/user/${userId}`, { method: 'DELETE' });
        loadDashboard();
    } catch (err) { alert(err.message); }
};

// Modal Controls
document.getElementById("openModalBtn").addEventListener("click", () => {
    elements.addForm.reset();
    document.getElementById("expenseId").value = "";
    document.getElementById("isRecurring").parentElement.style.display = "flex";
    document.querySelector(".modal h3").textContent = "Add Expense";
    document.querySelector(".modal button[type='submit']").textContent = "Save Expense";
    elements.modal.classList.add("active");
});

document.getElementById("closeModalBtn").addEventListener("click", () => elements.modal.classList.remove("active"));

// Add Category
elements.addCategoryBtn.addEventListener("click", async () => {
    const name = prompt("Enter new category name:");
    if (!name) return;
    try {
        const newCat = await apiRequest(`/categories/user/${userId}`, { method: "POST", body: JSON.stringify({ name: name }) });
        allCategories.push(newCat);
        const option = document.createElement("option"); option.value = newCat.id; option.textContent = newCat.name; option.selected = true; elements.categorySelect.appendChild(option);
    } catch (error) { alert("Failed: " + error.message); }
});

elements.toggleFiltersBtn.addEventListener("click", () => { elements.filterPanel.classList.toggle("active"); });

// Theme Logic
const savedTheme = localStorage.getItem("theme") || "dark";
document.body.setAttribute("data-theme", savedTheme);
updateThemeIcons(savedTheme);

elements.themeToggle.addEventListener("click", () => {
    const newTheme = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.body.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateThemeIcons(newTheme);
    applyFilters();
});

function updateThemeIcons(theme) {
    const sun = document.querySelector(".sun-icon");
    const moon = document.querySelector(".moon-icon");
    if (theme === "dark") { sun.style.display = "block"; moon.style.display = "none"; }
    else { sun.style.display = "none"; moon.style.display = "block"; }
}

// Profile & Export
elements.profileTrigger.addEventListener("click", (e) => { e.stopPropagation(); elements.profileMenu.classList.toggle("active"); });
document.addEventListener("click", (e) => { if (!elements.profileTrigger.contains(e.target) && !elements.profileMenu.contains(e.target)) elements.profileMenu.classList.remove("active"); });
document.getElementById("logoutBtn").addEventListener("click", () => { localStorage.clear(); window.location.href = "index.html"; });

document.getElementById("exportBtn").addEventListener("click", () => {
    if (allExpenses.length === 0) return alert("No expenses to export!");
    let csvContent = "data:text/csv;charset=utf-8,Date,Description,Category,Amount\n";
    allExpenses.forEach(exp => { csvContent += [exp.expenseDate, `"${exp.description}"`, exp.categoryName || "General", exp.amount].join(",") + "\n"; });
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", "my_expenses.csv"); document.body.appendChild(link); link.click(); document.body.removeChild(link);
});

// --- 7. SUBSCRIPTION MANAGER (View, Edit, Delete) ---

// Open Modal
elements.manageSubsBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    elements.profileMenu.classList.remove("active");
    elements.subsModal.classList.add("active");
    loadSubscriptions();
});

// Close Modal
elements.closeSubsBtn.addEventListener("click", () => {
    elements.subsModal.classList.remove("active");
});

// Load List (With Edit & Delete Buttons)
async function loadSubscriptions() {
    elements.subsList.innerHTML = '<p class="text-muted">Loading active subscriptions...</p>';

    try {
        const subs = await apiRequest(`/expenses/recurring/user/${userId}`);

        if (!subs || subs.length === 0) {
            elements.subsList.innerHTML = '<p class="text-muted">No active subscriptions found.</p>';
            return;
        }

        elements.subsList.innerHTML = subs.map(sub => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--border); margin-bottom:8px;">
                <div>
                    <div style="font-weight:600; color:var(--text-main);">${sub.description}</div>
                    <div style="font-size:12px; color:var(--text-muted);">
                        Next Due: <span style="color:var(--accent);">${formatDate(sub.nextDueDate)}</span> • ${formatCurrency(sub.amount)}
                        <br>
                        <span style="opacity:0.7; font-size:11px;">${sub.categoryName}</span>
                    </div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="editSubscription(${sub.id}, '${sub.amount}')" class="btn-edit" title="Update Amount" style="height:32px; width:32px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button onclick="cancelSubscription(${sub.id})" class="btn-delete" title="Cancel Subscription" style="height:32px; width:32px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>
        `).join("");

    } catch (error) {
        elements.subsList.innerHTML = `<p style="color:var(--danger)">Error: ${error.message}</p>`;
    }
}

// Edit Logic
window.editSubscription = async (id, currentAmount) => {
    const newAmountStr = prompt("Enter new monthly amount for this subscription:", currentAmount);
    if (!newAmountStr) return;

    const newAmount = parseFloat(newAmountStr);
    if (isNaN(newAmount) || newAmount <= 0) return alert("Invalid amount.");

    try {
        await apiRequest(`/expenses/recurring/${id}`, {
            method: "PUT",
            body: JSON.stringify({ amount: newAmount })
        });
        alert("Subscription updated! Future bills will use this amount.");
        loadSubscriptions();
    } catch (e) {
        alert("Update failed: " + e.message);
    }
};

// Cancel Logic
window.cancelSubscription = async (id) => {
    if (!confirm("Are you sure you want to cancel this recurring subscription? Future auto-payments will stop.")) return;

    try {
        await apiRequest(`/expenses/recurring/${id}`, { method: "DELETE" });
        loadSubscriptions();
    } catch (err) {
        alert("Failed to cancel: " + err.message);
    }
};

// Start
loadDashboard();
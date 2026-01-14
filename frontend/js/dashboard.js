// Auth Check
const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId");
const userName = localStorage.getItem("userName") || "User"; // ✅ Get Name

if (!token || !userId) window.location.href = "index.html";

// ✅ UPDATE UI WITH NAME
document.querySelector(".top-bar p").textContent = `Welcome back, ${userName}`;
document.querySelector(".avatar").textContent = userName.charAt(0).toUpperCase();

// Formatters
const formatCurrency = (amt) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt);
const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
};

// State
let chartInstance = null;
const elements = {
    totalAmount: document.getElementById("totalAmount"),
    expenseCount: document.getElementById("expenseCount"),
    expenseList: document.getElementById("expenseList"),
    modal: document.getElementById("expenseModal"),
    categorySelect: document.getElementById("categorySelect"),
    addCategoryBtn: document.getElementById("addCategoryBtn"), // ✅ New Button
    profileMenu: document.getElementById("profileMenu"),
    addForm: document.getElementById("addExpenseForm")
};

// 1. Load Data
async function loadDashboard() {
    try {
        // Fetch User Expenses + User Categories + Global Categories
        // We fetch "User Categories" (custom) and "Global" separately
        const [expenses, globalCats, userCats] = await Promise.all([
            apiRequest(`/expenses/user/${userId}`),
            apiRequest(`/categories/global`),
            apiRequest(`/categories/user/${userId}`) // ✅ Fetch custom categories
        ]);

        // Merge categories
        const allCategories = [...globalCats, ...userCats];

        populateCategoryDropdown(allCategories);
        updateStats(expenses);
        renderChart(expenses);
        renderList(expenses);

    } catch (error) {
        console.error(error);
    }
}

// 2. Dropdown Logic
function populateCategoryDropdown(categories) {
    // Save current selection if re-rendering
    const currentVal = elements.categorySelect.value;

    elements.categorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>';
    categories.forEach(cat => {
        elements.categorySelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });

    if (currentVal) elements.categorySelect.value = currentVal;
}

// ✅ 3. Add New Category Logic
elements.addCategoryBtn.addEventListener("click", async () => {
    const name = prompt("Enter new category name:");
    if (!name) return;

    try {
        // Call Backend to Create Category
        const newCat = await apiRequest(`/categories/user/${userId}`, {
            method: "POST",
            body: JSON.stringify({ name: name })
        });

        // Add to dropdown immediately and select it
        const option = document.createElement("option");
        option.value = newCat.id;
        option.textContent = newCat.name;
        option.selected = true;
        elements.categorySelect.appendChild(option);

    } catch (error) {
        alert("Failed to add category: " + error.message);
    }
});

// 4. Update Stats
function updateStats(expenses) {
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    elements.totalAmount.textContent = formatCurrency(total);
    elements.expenseCount.textContent = expenses.length;
}

// 5. Chart
function renderChart(expenses) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const categoryTotals = {};
    expenses.forEach(exp => {
        const catName = exp.categoryName || 'Uncategorized';
        categoryTotals[catName] = (categoryTotals[catName] || 0) + exp.amount;
    });

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
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
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { color: '#AAB0BC', font: { size: 10 } } } }
        }
    });
}

// 6. List with Delete
function renderList(expenses) {
    if (expenses.length === 0) {
        elements.expenseList.innerHTML = `<p style="text-align:center; color:#555; margin-top:20px;">No expenses found.</p>`;
        return;
    }
    elements.expenseList.innerHTML = expenses.map(exp => `
        <div class="expense-item">
            <div class="expense-info">
                <h4>${exp.description}</h4>
                <div class="expense-meta">
                    ${formatDate(exp.expenseDate)} • <span style="color:#FF9F6E">${exp.categoryName || 'General'}</span>
                </div>
            </div>
            <div style="display:flex; align-items:center;">
                <div class="expense-amount">${formatCurrency(exp.amount)}</div>
                <button class="btn-delete" onclick="deleteExpense(${exp.id})" title="Delete Expense">🗑</button>
            </div>
        </div>
    `).join("");
}

// 7. Actions
window.deleteExpense = async (id) => {
    if (!confirm("Delete this expense?")) return;
    try {
        await apiRequest(`/expenses/${id}/user/${userId}`, { method: 'DELETE' });
        loadDashboard(); // Refresh list
    } catch (err) { alert(err.message); }
};

document.getElementById("deleteAccountBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    if (!confirm("Permanently delete account?")) return;
    try {
        await apiRequest(`/users/${userId}`, { method: 'DELETE' });
        localStorage.clear();
        window.location.href = "index.html";
    } catch (err) { alert(err.message); }
});

// Event Listeners
document.getElementById("profileTrigger").addEventListener("click", () => elements.profileMenu.classList.toggle("active"));
document.addEventListener("click", (e) => {
    if (!e.target.closest(".user-profile")) elements.profileMenu.classList.remove("active");
});
elements.addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        await apiRequest(`/expenses/user/${userId}`, {
            method: "POST",
            body: JSON.stringify({
                description: document.getElementById("desc").value,
                amount: parseFloat(document.getElementById("amount").value),
                expenseDate: document.getElementById("date").value,
                categoryId: parseInt(elements.categorySelect.value)
            })
        });
        elements.modal.classList.remove("active");
        elements.addForm.reset();
        loadDashboard();
    } catch (err) { alert(err.message); }
});
document.getElementById("openModalBtn").addEventListener("click", () => elements.modal.classList.add("active"));
document.getElementById("closeModalBtn").addEventListener("click", () => elements.modal.classList.remove("active"));
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
});

// Init
loadDashboard();
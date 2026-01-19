package com.example.expensetracker.controller;

import com.example.expensetracker.dto.BudgetDto;
import com.example.expensetracker.dto.BudgetStatusDto;
import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.dto.ExpenseRequest;
import com.example.expensetracker.mapper.ExpenseMapper;
import com.example.expensetracker.model.*;
import com.example.expensetracker.repository.BudgetRepository;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import com.example.expensetracker.service.ExpenseService;
import com.example.expensetracker.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/expenses")
@CrossOrigin(origins = "*") // Added to ensure frontend can access
public class ExpenseController {

    private final ExpenseService expenseService;
    private final UserService userService;
    private final CategoryRepository categoryRepository;

    // ✅ NEW DEPENDENCIES for Features
    private final BudgetRepository budgetRepository;
    private final RecurringExpenseRepository recurringRepository;
    private final ExpenseRepository expenseRepository;

    // ✅ UPDATED CONSTRUCTOR
    public ExpenseController(ExpenseService expenseService, UserService userService, CategoryRepository categoryRepository, BudgetRepository budgetRepository, RecurringExpenseRepository recurringRepository, ExpenseRepository expenseRepository) {
        this.expenseService = expenseService;
        this.userService = userService;
        this.categoryRepository = categoryRepository;
        this.budgetRepository = budgetRepository;
        this.recurringRepository = recurringRepository;
        this.expenseRepository = expenseRepository;
    }

    // ================= EXISTING ENDPOINTS (Preserved) =================

    @PostMapping("/user/{userId}")
    public ResponseEntity<ExpenseDto> createExpense(@PathVariable Long userId, @Valid @RequestBody ExpenseRequest request) {
        User user = userService.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));

        Expense expense = new Expense();
        expense.setAmount(request.getAmount());
        expense.setDescription(request.getDescription());
        expense.setExpenseDate(request.getExpenseDate());

        Category category = new Category();
        category.setId(request.getCategoryId());
        expense.setCategory(category);

        Expense savedExpense = expenseService.createExpense(expense, user);

        return new ResponseEntity<>(ExpenseMapper.toDto(savedExpense), HttpStatus.CREATED);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<ExpenseDto>> getExpenses(@PathVariable Long userId) {
        User user = userService.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
        List<ExpenseDto> expenses = expenseService.getUserExpenses(user).stream().map(ExpenseMapper::toDto).collect(Collectors.toList());
        return ResponseEntity.ok(expenses);
    }

    @DeleteMapping("/{expenseId}/user/{userId}")
    public ResponseEntity<Void> deleteExpense(@PathVariable Long userId, @PathVariable Long expenseId) {
        User user = userService.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
        expenseService.deleteExpense(expenseId, user);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{expenseId}/user/{userId}")
    public ResponseEntity<ExpenseDto> updateExpense(@PathVariable Long expenseId, @PathVariable Long userId, @RequestBody ExpenseDto expenseDto) {
        User user = userService.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));

        Expense expenseUpdates = new Expense();
        expenseUpdates.setDescription(expenseDto.getDescription());
        expenseUpdates.setAmount(expenseDto.getAmount());
        expenseUpdates.setExpenseDate(expenseDto.getExpenseDate());

        if (expenseDto.getCategoryId() != null) {
            Category category = categoryRepository.findById(expenseDto.getCategoryId()).orElseThrow(() -> new RuntimeException("Category not found"));
            expenseUpdates.setCategory(category);
        }

        Expense updatedExpense = expenseService.updateExpense(expenseId, expenseUpdates, user);
        return ResponseEntity.ok(mapToDto(updatedExpense));
    }

    // ================= ✅ NEW BUDGET ENDPOINTS =================

    @PostMapping("/budget/user/{userId}")
    public ResponseEntity<?> setBudget(@PathVariable Long userId, @RequestBody BudgetDto dto) {
        User user = userService.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
        Category category = categoryRepository.findById(dto.getCategoryId()).orElseThrow(() -> new IllegalArgumentException("Category not found"));

        // Check if budget exists, else create new
        Budget budget = budgetRepository.findByUserAndCategoryId(user, dto.getCategoryId()).orElse(new Budget());

        budget.setUser(user);
        budget.setCategory(category);
        budget.setLimitAmount(dto.getLimitAmount());

        budgetRepository.save(budget);
        return ResponseEntity.ok("Budget Set Successfully");
    }

    @GetMapping("/budget/status/user/{userId}")
    public ResponseEntity<List<BudgetStatusDto>> getBudgetStatus(@PathVariable Long userId) {
        User user = userService.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
        List<Budget> budgets = budgetRepository.findByUser(user);

        // Define Month Range
        LocalDate startOfMonth = LocalDate.now().withDayOfMonth(1);
        LocalDate endOfMonth = LocalDate.now().plusMonths(1).withDayOfMonth(1).minusDays(1);

        List<BudgetStatusDto> statusList = budgets.stream().map(b -> {
            // Calculate total spent in this category for this month
            BigDecimal spent = expenseRepository.findByUserAndExpenseDateBetween(user, startOfMonth, endOfMonth).stream().filter(e -> e.getCategory() != null && e.getCategory().getId().equals(b.getCategory().getId())).map(Expense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

            double percentage = 0;
            if (b.getLimitAmount().doubleValue() > 0) {
                percentage = spent.doubleValue() / b.getLimitAmount().doubleValue() * 100;
            }

            return new BudgetStatusDto(b.getCategory().getName(), b.getLimitAmount(), spent, percentage);
        }).collect(Collectors.toList());

        return ResponseEntity.ok(statusList);
    }

    // ================= ✅ NEW RECURRING ENDPOINT =================

    @PostMapping("/recurring/user/{userId}")
    public ResponseEntity<?> addRecurring(@PathVariable Long userId, @RequestBody ExpenseDto dto) {
        User user = userService.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
        Category category = categoryRepository.findById(dto.getCategoryId()).orElseThrow(() -> new IllegalArgumentException("Category not found"));

        // 1. Save Recurring Record (For future automation)
        RecurringExpense rec = new RecurringExpense();
        rec.setAmount(dto.getAmount());
        rec.setDescription(dto.getDescription());
        rec.setFrequency("MONTHLY");
        // Next due date is exactly 1 month from the selected date
        rec.setNextDueDate(dto.getExpenseDate().plusMonths(1));
        rec.setCategory(category);
        rec.setUser(user);
        recurringRepository.save(rec);

        // 2. Save Immediate Expense (The one happening right now)
        Expense firstExp = new Expense();
        firstExp.setAmount(dto.getAmount());
        firstExp.setDescription(dto.getDescription());
        firstExp.setExpenseDate(dto.getExpenseDate());
        firstExp.setCategory(category);

        // Reuse your existing service logic
        expenseService.createExpense(firstExp, user);

        return ResponseEntity.ok("Recurring Expense Setup");
    }

    // Helper method (Kept from your original code)
    private ExpenseDto mapToDto(Expense expense) {
        return new ExpenseDto(expense.getId(), expense.getAmount(), expense.getDescription(), expense.getExpenseDate(), expense.getCategory() != null ? expense.getCategory().getId() : null, expense.getCategory() != null ? expense.getCategory().getName() : "Uncategorized");
    }
}
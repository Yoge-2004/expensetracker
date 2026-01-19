package com.example.expensetracker.controller;

import com.example.expensetracker.dto.ExpenseDto;
import com.example.expensetracker.dto.ExpenseRequest;
import com.example.expensetracker.mapper.ExpenseMapper;
import com.example.expensetracker.model.Category;
import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.User;
import com.example.expensetracker.repository.CategoryRepository;
import com.example.expensetracker.service.ExpenseService;
import com.example.expensetracker.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {

    private final ExpenseService expenseService;
    private final UserService userService;
    private final CategoryRepository categoryRepository;

    public ExpenseController(ExpenseService expenseService, UserService userService, CategoryRepository categoryRepository) {
        this.expenseService = expenseService;
        this.userService = userService;
        this.categoryRepository = categoryRepository;
    }

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

    @DeleteMapping("/{expenseId}/user/{userId}") // ✅ Add this endpoint
    public ResponseEntity<Void> deleteExpense(@PathVariable Long userId, @PathVariable Long expenseId) {

        User user = userService.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));

        expenseService.deleteExpense(expenseId, user);

        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{expenseId}/user/{userId}")
    public ResponseEntity<ExpenseDto> updateExpense(@PathVariable Long expenseId, @PathVariable Long userId, @RequestBody ExpenseDto expenseDto) {

        // 1. Fetch User (Assuming you have a method for this in UserService)
        // If userService returns Optional, use .orElseThrow()
        User user = userService.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));

        // 2. Map DTO to Entity
        Expense expenseUpdates = new Expense();
        expenseUpdates.setDescription(expenseDto.getDescription());
        expenseUpdates.setAmount(expenseDto.getAmount());
        expenseUpdates.setExpenseDate(expenseDto.getExpenseDate());

        // 3. Handle Category Lookup
        if (expenseDto.getCategoryId() != null) {
            Category category = categoryRepository.findById(expenseDto.getCategoryId()).orElseThrow(() -> new RuntimeException("Category not found"));
            expenseUpdates.setCategory(category);
        }

        // 4. Call Service
        Expense updatedExpense = expenseService.updateExpense(expenseId, expenseUpdates, user);

        // 5. Convert back to DTO for response
        return ResponseEntity.ok(mapToDto(updatedExpense));
    }

    // Helper method to convert Entity -> DTO
    private ExpenseDto mapToDto(Expense expense) {
        return new ExpenseDto(expense.getId(), expense.getAmount(), expense.getDescription(), expense.getExpenseDate(), expense.getCategory() != null ? expense.getCategory().getId() : null, expense.getCategory() != null ? expense.getCategory().getName() : "Uncategorized");
    }
}

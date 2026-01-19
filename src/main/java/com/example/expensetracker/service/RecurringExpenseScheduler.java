package com.example.expensetracker.service;

import com.example.expensetracker.model.Expense;
import com.example.expensetracker.model.RecurringExpense;
import com.example.expensetracker.repository.ExpenseRepository;
import com.example.expensetracker.repository.RecurringExpenseRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class RecurringExpenseScheduler {

    private final RecurringExpenseRepository recurringRepository;
    private final ExpenseRepository expenseRepository;

    public RecurringExpenseScheduler(RecurringExpenseRepository recurringRepo, ExpenseRepository expenseRepo) {
        this.recurringRepository = recurringRepo;
        this.expenseRepository = expenseRepo;
    }

    // Run every minute
    @Scheduled(cron = "0 * * * * *")
    @Transactional
    public void processRecurringExpenses() {
        LocalDate today = LocalDate.now();
        List<RecurringExpense> dueExpenses = recurringRepository.findByNextDueDateLessThanEqual(today);

        for (RecurringExpense recurring : dueExpenses) {
            // 1. Create the actual Expense
            Expense newExpense = new Expense();
            newExpense.setAmount(recurring.getAmount());
            newExpense.setDescription(recurring.getDescription() + " (Auto)");
            newExpense.setExpenseDate(recurring.getNextDueDate());
            newExpense.setCategory(recurring.getCategory());
            newExpense.setUser(recurring.getUser());

            expenseRepository.save(newExpense);

            // 2. Update Next Due Date (Add 1 Month)
            recurring.setNextDueDate(recurring.getNextDueDate().plusMonths(1));
            recurringRepository.save(recurring);
        }
    }
}
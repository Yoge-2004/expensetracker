package com.example.expensetracker.repository;

import com.example.expensetracker.model.RecurringExpense;
import com.example.expensetracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface RecurringExpenseRepository extends JpaRepository<RecurringExpense, Long> {
    List<RecurringExpense> findByUser(User user);
    // Find expenses that are due today or in the past (in case app was off)
    List<RecurringExpense> findByNextDueDateLessThanEqual(LocalDate date);

}
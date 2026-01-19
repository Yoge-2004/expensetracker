package com.example.expensetracker.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class BudgetDto {
    private Long categoryId;
    private BigDecimal limitAmount;
}
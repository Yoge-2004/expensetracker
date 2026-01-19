// BudgetStatusDto.java
package com.example.expensetracker.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class BudgetStatusDto {
    private String categoryName;
    private BigDecimal limit;
    private BigDecimal spent;
    private double percentage;
}
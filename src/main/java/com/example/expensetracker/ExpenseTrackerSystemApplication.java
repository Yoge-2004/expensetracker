package com.example.expensetracker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class ExpenseTrackerSystemApplication {

    public static void main(String[] args) {
        SpringApplication.run(ExpenseTrackerSystemApplication.class, args);
    }

}

package com.panpos.controller;

import com.panpos.dto.AnalyticsResponse;
import com.panpos.repository.ExpenseRepository;
import com.panpos.repository.SaleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    @Autowired private SaleRepository    saleRepo;
    @Autowired private ExpenseRepository expenseRepo;

    @GetMapping("/profit")
    public AnalyticsResponse profit(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt   = to.atTime(23, 59, 59);

        double totalSales    = saleRepo.findByDateBetween(fromDt, toDt)
                                       .stream().mapToDouble(s -> s.getTotal()).sum();
        double totalExpenses = expenseRepo.findByDateBetween(fromDt, toDt)
                                          .stream().mapToDouble(e -> e.getAmount()).sum();

        return new AnalyticsResponse(totalSales, totalExpenses, totalSales - totalExpenses);
    }
}

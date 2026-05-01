package com.panpos.dto;

public record AnalyticsResponse(
    Double totalSales,
    Double totalExpenses,
    Double profit
) {}

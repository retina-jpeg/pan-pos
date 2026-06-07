package com.panpos.dto;

import java.time.LocalDateTime;

public record ExpenseResponse(
    Long id,
    Double amount,
    String category,
    Long locationId,
    String note,
    LocalDateTime date,
    LocalDateTime createdAt
) {}

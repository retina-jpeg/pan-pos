package com.panpos.dto;

import java.time.LocalDateTime;

public record ExpenseRequest(
    Double amount,
    String category,
    Long locationId,
    String note,
    LocalDateTime date
) {}

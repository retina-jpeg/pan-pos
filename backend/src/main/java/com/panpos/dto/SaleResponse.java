package com.panpos.dto;

import java.time.LocalDateTime;
import java.util.List;

public record SaleResponse(
    Long id,
    LocalDateTime date,
    Long locationId,
    Double total,
    LocalDateTime createdAt,
    List<SaleItemResponse> items
) {}

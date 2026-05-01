package com.panpos.dto;

import java.time.LocalDateTime;
import java.util.List;

public record SaleRequest(
    LocalDateTime date,
    Long locationId,
    List<SaleItemRequest> items,
    Double total
) {}

package com.panpos.dto;

public record SaleItemRequest(
    Long productId,
    String productName,
    Integer quantity,
    Double price
) {}

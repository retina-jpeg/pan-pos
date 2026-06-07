package com.panpos.dto;

public record SaleItemResponse(
    Long productId,
    String productName,
    Integer quantity,
    Double price,
    Double costPrice
) {}

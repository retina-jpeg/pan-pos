package com.panpos.controller;

import com.panpos.dto.SaleRequest;
import com.panpos.entity.*;
import com.panpos.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/sales")
public class SaleController {

    @Autowired private SaleRepository     saleRepo;
    @Autowired private SaleItemRepository itemRepo;
    @Autowired private LocationRepository locationRepo;
    @Autowired private ProductRepository  productRepo;

    @GetMapping
    public List<Sale> getAll() {
        return saleRepo.findAll();
    }

    @PostMapping
    public Sale create(@RequestBody SaleRequest req) {
        Sale sale = new Sale();
        sale.setDate(req.date());
        sale.setTotal(req.total());
        locationRepo.findById(req.locationId()).ifPresent(sale::setLocation);
        saleRepo.save(sale);

        List<SaleItem> items = req.items().stream().map(r -> {
            SaleItem item = new SaleItem();
            item.setSale(sale);
            item.setProductName(r.productName());
            item.setQuantity(r.quantity());
            item.setPrice(r.price());
            if (r.productId() != null) productRepo.findById(r.productId()).ifPresent(item::setProduct);
            return item;
        }).toList();

        itemRepo.saveAll(items);
        return sale;
    }
}
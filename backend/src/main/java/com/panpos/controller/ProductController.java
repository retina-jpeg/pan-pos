package com.panpos.controller;

import com.panpos.entity.Product;
import com.panpos.entity.SaleItem;
import com.panpos.repository.ProductRepository;
import com.panpos.repository.SaleItemRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    @Autowired private ProductRepository  repo;
    @Autowired private SaleItemRepository saleItemRepo;

    @GetMapping
    public List<Product> getAll() {
        return repo.findAll();
    }

    @PostMapping
    public Product create(@RequestBody Product product) {
        product.setCreatedAt(LocalDateTime.now());
        product.setUpdatedAt(LocalDateTime.now());
        return repo.save(product);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Product> update(@PathVariable Long id, @RequestBody Product body) {
        return repo.findById(id).map(p -> {
            p.setName(body.getName());
            p.setPrice(body.getPrice());
            p.setCostPrice(body.getCostPrice());
            p.setCategoryId(body.getCategoryId());
            p.setUpdatedAt(LocalDateTime.now());
            return ResponseEntity.ok(repo.save(p));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public void delete(@PathVariable Long id) {
        // Keep past sale history intact: detach the product from its sale items, then delete it.
        List<SaleItem> items = saleItemRepo.findByProduct_Id(id);
        for (SaleItem item : items) item.setProduct(null);
        saleItemRepo.saveAll(items);
        repo.deleteById(id);
    }
}
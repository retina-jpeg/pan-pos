package com.panpos.controller;

import com.panpos.entity.Category;
import com.panpos.entity.Product;
import com.panpos.repository.CategoryRepository;
import com.panpos.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    @Autowired private CategoryRepository repo;
    @Autowired private ProductRepository  productRepo;

    @GetMapping
    public List<Category> getAll() {
        return repo.findAllByOrderBySortOrderAsc();
    }

    @PostMapping
    public Category create(@RequestBody Category category) {
        return repo.save(category);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Category> update(@PathVariable Long id, @RequestBody Category body) {
        return repo.findById(id).map(c -> {
            c.setName(body.getName());
            c.setSortOrder(body.getSortOrder());
            return ResponseEntity.ok(repo.save(c));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public void delete(@PathVariable Long id) {
        // Remove this category from any products that reference it, then delete it.
        List<Product> products = productRepo.findByCategoryId(id);
        for (Product p : products) p.getCategoryIds().remove(id);
        productRepo.saveAll(products);
        repo.deleteById(id);
    }
}

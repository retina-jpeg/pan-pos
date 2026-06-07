package com.panpos.controller;

import com.panpos.entity.Location;
import com.panpos.repository.LocationRepository;
import com.panpos.repository.SaleRepository;
import com.panpos.repository.ExpenseRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/locations")
public class LocationController {

    @Autowired private LocationRepository repo;
    @Autowired private SaleRepository     saleRepo;
    @Autowired private ExpenseRepository  expenseRepo;

    @GetMapping
    public List<Location> getAll() {
        return repo.findAll();
    }

    @PostMapping
    public Location create(@RequestBody Location location) {
        return repo.save(location);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public void delete(@PathVariable Long id) {
        // Remove dependent records first (sales cascade to their items), then the location.
        saleRepo.deleteAll(saleRepo.findByLocation_Id(id));
        expenseRepo.deleteAll(expenseRepo.findByLocation_Id(id));
        repo.deleteById(id);
    }
}
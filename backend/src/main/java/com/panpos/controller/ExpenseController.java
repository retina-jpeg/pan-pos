package com.panpos.controller;

import com.panpos.dto.ExpenseRequest;
import com.panpos.dto.ExpenseResponse;
import com.panpos.entity.Expense;
import com.panpos.repository.ExpenseRepository;
import com.panpos.repository.LocationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {

    @Autowired private ExpenseRepository  repo;
    @Autowired private LocationRepository locationRepo;

    @GetMapping
    @Transactional(readOnly = true)
    public List<ExpenseResponse> getAll() {
        return repo.findAll().stream().map(e -> new ExpenseResponse(
            e.getId(),
            e.getAmount(),
            e.getCategory(),
            e.getLocation() != null ? e.getLocation().getId() : null,
            e.getNote(),
            e.getDate(),
            e.getCreatedAt()
        )).toList();
    }

    @PostMapping
    public Expense create(@RequestBody ExpenseRequest req) {
        Expense e = new Expense();
        e.setAmount(req.amount());
        e.setCategory(req.category());
        e.setNote(req.note());
        e.setDate(req.date() != null ? req.date() : LocalDateTime.now());
        locationRepo.findById(req.locationId()).ifPresent(e::setLocation);
        return repo.save(e);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        repo.deleteById(id);
    }
}
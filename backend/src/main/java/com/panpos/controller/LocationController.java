package com.panpos.controller;

import com.panpos.entity.Location;
import com.panpos.repository.LocationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/locations")
public class LocationController {

    @Autowired private LocationRepository repo;

    @GetMapping
    public List<Location> getAll() {
        return repo.findAll();
    }

    @PostMapping
    public Location create(@RequestBody Location location) {
        return repo.save(location);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        repo.deleteById(id);
    }
}
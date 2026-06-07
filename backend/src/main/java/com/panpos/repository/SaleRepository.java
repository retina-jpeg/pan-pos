package com.panpos.repository;

import com.panpos.entity.Sale;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface SaleRepository extends JpaRepository<Sale, Long> {
    List<Sale> findByDateBetween(LocalDateTime from, LocalDateTime to);
    List<Sale> findByLocation_Id(Long locationId);
}

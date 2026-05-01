package com.panpos.repository;

import com.panpos.entity.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {
    List<Expense> findByDateBetween(LocalDateTime from, LocalDateTime to);
}

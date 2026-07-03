package com.panpos.repository;

import com.panpos.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {
    @Query("SELECT p FROM Product p JOIN p.categoryIds c WHERE c = :categoryId")
    List<Product> findByCategoryId(@Param("categoryId") Long categoryId);
}

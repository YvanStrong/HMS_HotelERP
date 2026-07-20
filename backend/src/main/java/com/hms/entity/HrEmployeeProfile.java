package com.hms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "hr_employee_profiles")
@Getter
@Setter
public class HrEmployeeProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hotel_id", nullable = false)
    private Hotel hotel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @Column(length = 120)
    private String department;

    @Column(name = "job_title", length = 120)
    private String jobTitle;

    @Column(name = "employment_type", nullable = false, length = 32)
    private String employmentType = "FULL_TIME";

    @Column(name = "employment_status", nullable = false, length = 32)
    private String employmentStatus = "ACTIVE";

    @Column(name = "hire_date")
    private LocalDate hireDate;

    @Column(name = "base_salary", precision = 14, scale = 2)
    private BigDecimal baseSalary;

    @Column(name = "salary_currency", length = 8)
    private String salaryCurrency = "USD";

    @Column(length = 32)
    private String phone;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(name = "national_id", length = 64)
    private String nationalId;

    @Column(name = "emergency_contact_name", length = 120)
    private String emergencyContactName;

    @Column(name = "emergency_contact_phone", length = 32)
    private String emergencyContactPhone;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}

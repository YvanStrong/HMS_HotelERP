package com.hms.entity;

import com.hms.domain.PosTicketLineStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "pos_table_ticket_lines")
@Getter
@Setter
public class PosTableTicketLine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ticket_id", nullable = false)
    private PosTableTicket ticket;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private DepotProduct product;

    @Column(name = "line_order", nullable = false)
    private int lineOrder;

    @Column(nullable = false, precision = 14, scale = 3)
    private BigDecimal quantity;

    @Column(name = "unit_price", nullable = false, precision = 14, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "line_total", nullable = false, precision = 14, scale = 2)
    private BigDecimal lineTotal;

    @Column(name = "line_notes", columnDefinition = "TEXT")
    private String lineNotes;

    @Enumerated(EnumType.STRING)
    @Column(name = "line_status", nullable = false, length = 20)
    private PosTicketLineStatus lineStatus = PosTicketLineStatus.PENDING;

    @Column(nullable = false)
    private boolean taxable = true;

    @Column(nullable = false)
    private int round = 1;

    @Column(name = "product_name", length = 150)
    private String productName;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "served_at")
    private Instant servedAt;

    @Column(name = "is_voided", nullable = false)
    private boolean voided;

    @Column(name = "void_reason", columnDefinition = "TEXT")
    private String voidReason;

    @Column(name = "discount_pct", precision = 5, scale = 2)
    private BigDecimal discountPct;

    @Column(name = "discount_amount", precision = 10, scale = 2)
    private BigDecimal discountAmount;

    @Column(name = "effective_price", precision = 10, scale = 2)
    private BigDecimal effectivePrice;

    @Column(name = "is_held", nullable = false)
    private boolean held;

    @Enumerated(EnumType.STRING)
    @Column(name = "hold_course", length = 20)
    private com.hms.domain.PosHoldCourse holdCourse;
}

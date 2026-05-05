package com.hms.service;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Irreversible removal of all rows scoped to a hotel so the {@code hotels} row can be deleted.
 * Uses PostgreSQL table/column names matching JPA mappings. Intended only for {@code purge=true}
 * platform super-admin deletes.
 */
@Service
public class HotelPurgeService {

    private final JdbcTemplate jdbc;

    public HotelPurgeService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public void purgeAllHotelScopedRows(UUID hotelId) {
        Object id = hotelId;

        jdbc.update(
                "DELETE FROM guest_feedback WHERE reservation_id IN (SELECT id FROM reservations WHERE hotel_id = ?)",
                id);

        jdbc.update(
                "DELETE FROM fb_order_lines WHERE order_id IN (SELECT id FROM fb_orders WHERE outlet_id IN (SELECT id FROM fb_outlets WHERE hotel_id = ?))",
                id);
        jdbc.update("DELETE FROM fb_orders WHERE outlet_id IN (SELECT id FROM fb_outlets WHERE hotel_id = ?)", id);
        // Element-collection tables for MenuItem are not cascade-deleted at DB level in all environments.
        jdbc.update(
                "DELETE FROM menu_item_categories WHERE menu_item_id IN (SELECT id FROM menu_items WHERE outlet_id IN (SELECT id FROM fb_outlets WHERE hotel_id = ?))",
                id);
        jdbc.update(
                "DELETE FROM menu_item_allergens WHERE menu_item_id IN (SELECT id FROM menu_items WHERE outlet_id IN (SELECT id FROM fb_outlets WHERE hotel_id = ?))",
                id);
        jdbc.update("DELETE FROM menu_items WHERE outlet_id IN (SELECT id FROM fb_outlets WHERE hotel_id = ?)", id);
        jdbc.update("DELETE FROM fb_outlets WHERE hotel_id = ?", id);

        jdbc.update(
                "DELETE FROM facility_bookings WHERE facility_id IN (SELECT id FROM facilities WHERE hotel_id = ?)",
                id);
        jdbc.update(
                "DELETE FROM facility_maintenances WHERE facility_id IN (SELECT id FROM facilities WHERE hotel_id = ?)",
                id);
        jdbc.update(
                "DELETE FROM facility_slots WHERE facility_id IN (SELECT id FROM facilities WHERE hotel_id = ?)", id);
        jdbc.update(
                "DELETE FROM facility_operating_hours WHERE facility_id IN (SELECT id FROM facilities WHERE hotel_id = ?)",
                id);
        jdbc.update(
                "DELETE FROM facility_amenities WHERE facility_id IN (SELECT id FROM facilities WHERE hotel_id = ?)", id);
        jdbc.update("DELETE FROM facilities WHERE hotel_id = ?", id);

        jdbc.update("DELETE FROM invoice_line_items WHERE invoice_id IN (SELECT id FROM invoices WHERE hotel_id = ?)", id);
        jdbc.update("DELETE FROM invoices WHERE hotel_id = ?", id);

        jdbc.update("DELETE FROM housekeeping_tasks WHERE hotel_id = ?", id);
        jdbc.update("DELETE FROM notifications WHERE hotel_id = ?", id);
        jdbc.update("DELETE FROM night_audit_runs WHERE hotel_id = ?", id);

        // Payments reference reservations (payments.reservation_id FK), so remove them before reservations.
        jdbc.update("DELETE FROM payments WHERE reservation_id IN (SELECT id FROM reservations WHERE hotel_id = ?)", id);
        jdbc.update("DELETE FROM payments WHERE hotel_id = ?", id);
        jdbc.update(
                "DELETE FROM room_charges WHERE reservation_id IN (SELECT id FROM reservations WHERE hotel_id = ?)", id);
        jdbc.update("DELETE FROM reservations WHERE hotel_id = ?", id);

        jdbc.update("DELETE FROM guest_feedback WHERE guest_id IN (SELECT id FROM guests WHERE hotel_id = ?)", id);
        jdbc.update(
                "DELETE FROM loyalty_transactions WHERE guest_id IN (SELECT id FROM guests WHERE hotel_id = ?)", id);
        jdbc.update("UPDATE guests SET portal_account_id = NULL WHERE hotel_id = ?", id);
        jdbc.update("DELETE FROM guests WHERE hotel_id = ?", id);

        jdbc.update("DELETE FROM housekeeping_restock_tasks WHERE hotel_id = ?", id);
        jdbc.update("DELETE FROM room_minibar_stock WHERE room_id IN (SELECT id FROM rooms WHERE hotel_id = ?)", id);
        // Depot / self-order domain can keep direct hotel FKs outside core reservation/invoice flows.
        jdbc.update(
                "DELETE FROM self_service_order_lines WHERE order_id IN (SELECT id FROM self_service_orders WHERE hotel_id = ?)",
                id);
        jdbc.update("DELETE FROM self_service_orders WHERE hotel_id = ?", id);
        jdbc.update(
                "DELETE FROM depot_sale_lines WHERE sale_id IN (SELECT id FROM depot_sales WHERE hotel_id = ?)",
                id);
        jdbc.update("DELETE FROM depot_sales WHERE hotel_id = ?", id);
        jdbc.update("DELETE FROM depot_products WHERE hotel_id = ?", id);
        jdbc.update("DELETE FROM inventory_depots WHERE hotel_id = ?", id);

        jdbc.update("DELETE FROM room_blocks WHERE hotel_id = ?", id);
        jdbc.update("DELETE FROM room_status_logs WHERE hotel_id = ?", id);

        jdbc.update(
                "DELETE FROM purchase_order_lines WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE hotel_id = ?)",
                id);
        jdbc.update("DELETE FROM purchase_orders WHERE hotel_id = ?", id);

        jdbc.update(
                "DELETE FROM stock_transactions WHERE item_id IN (SELECT id FROM inventory_items WHERE hotel_id = ?)",
                id);
        jdbc.update("DELETE FROM inventory_items WHERE hotel_id = ?", id);
        jdbc.update("DELETE FROM inventory_categories WHERE hotel_id = ?", id);

        jdbc.update("DELETE FROM suppliers WHERE hotel_id = ?", id);

        jdbc.update("DELETE FROM rooms WHERE hotel_id = ?", id);
        jdbc.update(
                "DELETE FROM room_type_nightly_rates WHERE room_type_id IN (SELECT id FROM room_types WHERE hotel_id = ?)",
                id);
        jdbc.update(
                "DELETE FROM room_type_amenities WHERE room_type_id IN (SELECT id FROM room_types WHERE hotel_id = ?)",
                id);
        jdbc.update("DELETE FROM room_types WHERE hotel_id = ?", id);

        jdbc.update("DELETE FROM daily_revenue_snapshots WHERE hotel_id = ?", id);
        jdbc.update("DELETE FROM platform_usage_metrics WHERE tenant_id = ?", id);
        jdbc.update("DELETE FROM provisioning_jobs WHERE tenant_id = ?", id);
        jdbc.update("DELETE FROM platform_audit_logs WHERE target_tenant_id = ?", id);

        jdbc.update("DELETE FROM app_users WHERE hotel_id = ?", id);
    }
}

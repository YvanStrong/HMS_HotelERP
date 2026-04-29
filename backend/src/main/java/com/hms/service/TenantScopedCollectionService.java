package com.hms.service;

import com.hms.entity.Room;
import java.util.ArrayList;
import java.util.List;
import org.springframework.security.access.prepost.PreFilter;
import org.springframework.stereotype.Service;

/**
 * Reference pattern for tenant-scoped collections: {@link PreFilter} delegates to
 * {@link com.hms.security.TenantCollectionSecurityHelper}.
 */
@Service
public class TenantScopedCollectionService {

    @PreFilter("@tenantCollectionSecurity.tenantRoom(filterObject)")
    public List<Room> enforceTenantRooms(List<Room> rooms) {
        return rooms;
    }

    /** Returns a mutable copy suitable for {@link PreFilter} in-place filtering. */
    public List<Room> mutableCopy(List<Room> source) {
        return new ArrayList<>(source);
    }
}

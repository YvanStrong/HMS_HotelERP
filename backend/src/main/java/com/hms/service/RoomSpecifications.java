package com.hms.service;

import com.hms.domain.CleanlinessStatus;
import com.hms.domain.RoomStatus;
import com.hms.entity.Room;
import com.hms.entity.RoomType;
import jakarta.persistence.criteria.Join;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

public final class RoomSpecifications {

    private RoomSpecifications() {}

    public static Specification<Room> hotel(UUID hotelId) {
        return (root, q, cb) -> cb.equal(root.get("hotel").get("id"), hotelId);
    }

    public static Specification<Room> statuses(Set<RoomStatus> statuses) {
        if (statuses == null || statuses.isEmpty()) {
            return null;
        }
        return (root, q, cb) -> root.get("status").in(statuses);
    }

    public static Specification<Room> cleanlinesses(Set<CleanlinessStatus> cleanlinessStatuses) {
        if (cleanlinessStatuses == null || cleanlinessStatuses.isEmpty()) {
            return null;
        }
        return (root, q, cb) -> root.get("cleanliness").in(cleanlinessStatuses);
    }

    public static Specification<Room> floor(Integer floor) {
        if (floor == null) {
            return null;
        }
        return (root, q, cb) -> cb.equal(root.get("floor"), floor);
    }

    public static Specification<Room> roomTypeId(UUID roomTypeId) {
        if (roomTypeId == null) {
            return null;
        }
        return (root, q, cb) -> cb.equal(root.get("roomType").get("id"), roomTypeId);
    }

    public static Specification<Room> roomTypeCode(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        return (root, q, cb) -> {
            Join<Room, RoomType> rt = root.join("roomType");
            return cb.equal(cb.lower(rt.get("code")), code.trim().toLowerCase());
        };
    }

    public static Specification<Room> combine(List<Specification<Room>> parts) {
        List<Specification<Room>> nonNull = new ArrayList<>();
        for (Specification<Room> p : parts) {
            if (p != null) {
                nonNull.add(p);
            }
        }
        if (nonNull.isEmpty()) {
            return (root, q, cb) -> cb.conjunction();
        }
        Specification<Room> acc = nonNull.get(0);
        for (int i = 1; i < nonNull.size(); i++) {
            acc = acc.and(nonNull.get(i));
        }
        return acc;
    }
}

package com.hms.api;

import com.hms.api.dto.ApiDtos;
import com.hms.service.PublicCatalogService;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
public class PublicCatalogController {

    private final PublicCatalogService publicCatalogService;

    public PublicCatalogController(PublicCatalogService publicCatalogService) {
        this.publicCatalogService = publicCatalogService;
    }

    @GetMapping("/hotels")
    public List<ApiDtos.PublicHotelCatalogItem> listHotels() {
        return publicCatalogService.listHotels();
    }

    @GetMapping("/hotels/{hotelId}/room-types")
    public List<ApiDtos.PublicRoomTypeCatalogItem> listRoomTypes(@PathVariable UUID hotelId) {
        return publicCatalogService.listRoomTypes(hotelId);
    }

    @GetMapping("/hotels/{hotelId}/rooms/offers")
    public List<ApiDtos.PublicRoomOffer> listRoomOffers(@PathVariable UUID hotelId) {
        return publicCatalogService.listRoomOffers(hotelId);
    }
}

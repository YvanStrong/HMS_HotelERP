package com.hms.service;

import com.hms.config.HmsEbmProperties;
import com.hms.ebm.ItemCdGenerator;
import com.hms.entity.EbmItemCdSequence;
import com.hms.entity.InventoryItem;
import com.hms.repository.EbmItemCdSequenceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class EbmItemCdService {

    private final EbmItemCdSequenceRepository sequenceRepository;
    private final ItemCdGenerator itemCdGenerator;
    private final HmsEbmProperties properties;

    public EbmItemCdService(
            EbmItemCdSequenceRepository sequenceRepository,
            ItemCdGenerator itemCdGenerator,
            HmsEbmProperties properties) {
        this.sequenceRepository = sequenceRepository;
        this.itemCdGenerator = itemCdGenerator;
        this.properties = properties;
    }

    @Transactional
    public String allocateItemCd(UUID hotelId, String itemTyCd, String pkgUnitCd, String qtyUnitCd) {
        EbmItemCdSequence seq = sequenceRepository
                .findForUpdate(hotelId)
                .orElseGet(() -> {
                    EbmItemCdSequence created = new EbmItemCdSequence();
                    created.setHotelId(hotelId);
                    created.setLastNumber(0);
                    return sequenceRepository.save(created);
                });
        long next = seq.getLastNumber() + 1;
        seq.setLastNumber(next);
        sequenceRepository.save(seq);
        return itemCdGenerator.generate(itemTyCd, pkgUnitCd, qtyUnitCd, next);
    }

    /** Assign RRA itemCd + classification defaults if missing. */
    @Transactional
    public void ensureItemCd(InventoryItem item) {
        if (item.getItemCd() != null && !item.getItemCd().isBlank()) {
            return;
        }
        if (item.getItemTyCd() == null || item.getItemTyCd().isBlank()) {
            item.setItemTyCd(properties.getDefaultItemTyCd());
        }
        if (item.getPkgUnitCd() == null || item.getPkgUnitCd().isBlank()) {
            item.setPkgUnitCd(properties.getDefaultPkgUnitCd());
        }
        if (item.getQtyUnitCd() == null || item.getQtyUnitCd().isBlank()) {
            item.setQtyUnitCd(properties.getDefaultQtyUnitCd());
        }
        if (item.getItemClsCd() == null || item.getItemClsCd().isBlank()) {
            item.setItemClsCd(properties.getDefaultItemClsCd());
        }
        item.setItemCd(allocateItemCd(
                item.getHotel().getId(), item.getItemTyCd(), item.getPkgUnitCd(), item.getQtyUnitCd()));
    }
}

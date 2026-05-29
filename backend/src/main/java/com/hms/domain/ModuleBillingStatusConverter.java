package com.hms.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class ModuleBillingStatusConverter implements AttributeConverter<ModuleBillingStatus, String> {
    @Override
    public String convertToDatabaseColumn(ModuleBillingStatus attribute) {
        return attribute != null ? attribute.name().toLowerCase() : null;
    }

    @Override
    public ModuleBillingStatus convertToEntityAttribute(String dbData) {
        return dbData != null ? ModuleBillingStatus.valueOf(dbData.toUpperCase()) : null;
    }
}

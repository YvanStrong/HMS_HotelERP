package com.hms.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class ModuleTierConverter implements AttributeConverter<ModuleTier, String> {
    @Override
    public String convertToDatabaseColumn(ModuleTier attribute) {
        return attribute != null ? attribute.name().toLowerCase() : null;
    }

    @Override
    public ModuleTier convertToEntityAttribute(String dbData) {
        return dbData != null ? ModuleTier.valueOf(dbData.toUpperCase()) : null;
    }
}

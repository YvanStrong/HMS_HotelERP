import { getCountries, getCountryCallingCode } from "libphonenumber-js";

export const GENDER_OPTIONS = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"] as const;

const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

export const COUNTRY_OPTIONS = getCountries()
  .map((iso2) => ({
    iso2,
    name: REGION_NAMES.of(iso2) ?? iso2,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const PHONE_CODE_OPTIONS = getCountries()
  .map((iso2) => {
    const name = REGION_NAMES.of(iso2) ?? iso2;
    const code = `+${getCountryCallingCode(iso2)}`;
    return {
      iso2,
      code,
      label: `${name} (${code})`,
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

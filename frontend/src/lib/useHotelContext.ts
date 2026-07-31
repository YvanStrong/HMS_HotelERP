"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { loadAuthUser } from "@/lib/auth";

export type HotelContextData = {
  hotelId: string;
  name: string;
  companyName: string;
  logoUrl: string | null;
  imageUrl: string | null;
  currency: string;
  country: string;
  phone: string;
  email: string;
  address: string;
  tinNumber: string;
  timezone: string;
  checkInTime: string;
  checkOutTime: string;
  invoicePrefix: string;
  businessCategoryId: string | null;
  businessCategoryCode: string | null;
  enabledModules: string[];
  visibleDisabledModules: string[];
};

type HotelContextResponse = {
  id: string;
  name: string;
  companyName?: string | null;
  logoUrl?: string | null;
  imageUrl?: string | null;
  currency?: string | null;
  defaultCountry?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  tinNumber?: string | null;
  timezone?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  invoicePrefix?: string | null;
  businessCategoryId?: string | null;
  businessCategoryCode?: string | null;
};

type ModuleEntitlementsResponse = {
  enabledModules: string[];
  visibleDisabledModules?: string[];
};

const ALWAYS_ON_MODULES = new Set(["DASHBOARD", "SETTINGS"]);

const EMPTY_CONTEXT: HotelContextData = {
  hotelId: "",
  name: "HMS",
  companyName: "",
  logoUrl: null,
  imageUrl: null,
  currency: "USD",
  country: "",
  phone: "",
  email: "",
  address: "",
  tinNumber: "",
  timezone: "UTC",
  checkInTime: "14:00",
  checkOutTime: "12:00",
  invoicePrefix: "HMS",
  businessCategoryId: null,
  businessCategoryCode: null,
  enabledModules: Array.from(ALWAYS_ON_MODULES),
  visibleDisabledModules: [],
};

export function useHotelContext(explicitHotelId?: string) {
  const authHotelId = loadAuthUser()?.hotelId ?? "";
  const hotelId = explicitHotelId ?? authHotelId;

  const query = useQuery({
    queryKey: ["hotel", hotelId],
    enabled: Boolean(hotelId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: () => apiFetch<HotelContextResponse>(`/api/v1/hotels/${hotelId}`),
  });
  const modulesQuery = useQuery({
    queryKey: ["hotel-modules", hotelId],
    enabled: Boolean(hotelId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: () => apiFetch<ModuleEntitlementsResponse>(`/api/v1/hotels/${hotelId}/module-entitlements`),
  });

  const raw = query.data;
  const hotel: HotelContextData = raw
    ? {
        hotelId: raw.id,
        name: raw.name,
        companyName: raw.companyName ?? raw.name,
        logoUrl: raw.logoUrl ?? null,
        imageUrl: raw.imageUrl ?? null,
        currency: raw.currency ?? "USD",
        country: raw.defaultCountry ?? "",
        phone: raw.phone ?? "",
        email: raw.email ?? "",
        address: raw.address ?? "",
        tinNumber: raw.tinNumber ?? "",
        timezone: raw.timezone ?? "UTC",
        checkInTime: raw.checkInTime ?? "14:00",
        checkOutTime: raw.checkOutTime ?? "12:00",
        invoicePrefix: raw.invoicePrefix ?? "HMS",
        businessCategoryId: raw.businessCategoryId ?? null,
        businessCategoryCode: raw.businessCategoryCode ?? null,
        enabledModules: modulesQuery.data?.enabledModules ?? Array.from(ALWAYS_ON_MODULES),
        visibleDisabledModules: modulesQuery.data?.visibleDisabledModules ?? [],
      }
    : { ...EMPTY_CONTEXT, hotelId };

  const entitlementsLoaded = Boolean(modulesQuery.data) || modulesQuery.isError;

  function hasModule(key: string): boolean {
    const normalized = key.trim().toUpperCase();
    if (ALWAYS_ON_MODULES.has(normalized)) return true;
    // Avoid "module disabled" flash on refresh while entitlements are still loading.
    if (!entitlementsLoaded) return true;
    return hotel.enabledModules.includes(normalized);
  }

  function isModuleVisibleWhenDisabled(key: string): boolean {
    const normalized = key.trim().toUpperCase();
    return hotel.visibleDisabledModules.includes(normalized);
  }

  return {
    ...query,
    hotel,
    hasModule,
    isModuleVisibleWhenDisabled,
    entitlementsLoaded,
    loading: query.isLoading || modulesQuery.isLoading,
  };
}


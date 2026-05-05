"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { loadAuthUser } from "@/lib/auth";

export type HotelContextData = {
  hotelId: string;
  name: string;
  logoUrl: string | null;
  currency: string;
  country: string;
  phone: string;
  email: string;
  address: string;
  timezone: string;
  checkInTime: string;
  checkOutTime: string;
  invoicePrefix: string;
};

type HotelContextResponse = {
  id: string;
  name: string;
  logoUrl?: string | null;
  currency?: string | null;
  defaultCountry?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  timezone?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  invoicePrefix?: string | null;
};

const EMPTY_CONTEXT: HotelContextData = {
  hotelId: "",
  name: "HMS",
  logoUrl: null,
  currency: "USD",
  country: "",
  phone: "",
  email: "",
  address: "",
  timezone: "UTC",
  checkInTime: "14:00",
  checkOutTime: "12:00",
  invoicePrefix: "HMS",
};

export function useHotelContext(explicitHotelId?: string) {
  const authHotelId = loadAuthUser()?.hotelId ?? "";
  const hotelId = explicitHotelId ?? authHotelId;

  const query = useQuery({
    queryKey: ["hotel", hotelId],
    enabled: Boolean(hotelId),
    staleTime: 5 * 60 * 1000,
    queryFn: () => apiFetch<HotelContextResponse>(`/api/v1/hotels/${hotelId}`),
  });

  const raw = query.data;
  const hotel: HotelContextData = raw
    ? {
        hotelId: raw.id,
        name: raw.name,
        logoUrl: raw.logoUrl ?? null,
        currency: raw.currency ?? "USD",
        country: raw.defaultCountry ?? "",
        phone: raw.phone ?? "",
        email: raw.email ?? "",
        address: raw.address ?? "",
        timezone: raw.timezone ?? "UTC",
        checkInTime: raw.checkInTime ?? "14:00",
        checkOutTime: raw.checkOutTime ?? "12:00",
        invoicePrefix: raw.invoicePrefix ?? "HMS",
      }
    : { ...EMPTY_CONTEXT, hotelId };

  return {
    ...query,
    hotel,
    loading: query.isLoading,
  };
}


"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { apiFetch, getToken } from "@/lib/api";
import { publicFetch } from "@/lib/publicApi";

type Hotel = {
  id: string;
  name: string;
  code: string;
  description?: string;
  currency: string;
  timezone?: string;
  address?: string;
  phone?: string;
  email?: string;
  imageUrl?: string;
  logoUrl?: string;
  starRating?: number;
  isActive: boolean;
  createdAt?: string;
};

type Room = {
  id: string;
  roomNumber: string;
  floor?: number;
  building?: string;
  status: string;
  cleanliness: string;
  roomTypeName: string;
  currentReservation?: {
    confirmationCode: string;
    guestName: string;
  } | null;
};

export default function PlatformHotelDetailPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setError("Not signed in.");
        setLoading(false);
        return;
      }
      
      try {
        // Load hotel details from public API (platform API doesn't support GET)
        const hotelsData = await publicFetch<Hotel[]>("/api/v1/public/hotels");
        const hotelData = hotelsData.find(h => h.id === hotelId);
        if (!hotelData) {
          throw new Error("Hotel not found");
        }
        if (!cancelled) setHotel(hotelData);
        
        // Load hotel rooms using hotel-scoped API
        try {
          const roomsData = await apiFetch<Room[] | { rooms?: Room[] }>(`/api/v1/hotels/${hotelId}/rooms`);
          // Handle different API response formats
          const roomsArray = Array.isArray(roomsData) ? roomsData : 
                            (roomsData as { rooms?: Room[] }).rooms || [];
          if (!cancelled) setRooms(roomsArray);
        } catch {
          // Rooms might not be accessible, that's okay
          if (!cancelled) setRooms([]);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load hotel");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-64 bg-muted rounded-xl" />
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-4 bg-muted rounded w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !hotel) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold mb-2">Error Loading Hotel</h2>
        <p className="text-muted-foreground mb-4">{error || "Hotel not found"}</p>
        <Link href="/platform/hotels" className="hms-btn-outline">
          Back to Hotels
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link 
          href="/platform/hotels" 
          className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Hotels
        </Link>
      </div>

      {/* Hero */}
      <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden bg-muted">
        {hotel.imageUrl ? (
          hotel.imageUrl.startsWith("data:") ? (
            <img src={hotel.imageUrl} alt={hotel.name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <Image
              src={hotel.imageUrl}
              alt={hotel.name}
              fill
              className="object-cover"
              priority
              unoptimized
            />
          )
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
            {hotel.logoUrl ? (
              hotel.logoUrl.startsWith("data:") ? (
                <img src={hotel.logoUrl} alt={`${hotel.name} logo`} className="max-w-[120px] max-h-[120px] object-contain" />
              ) : (
                <Image
                  src={hotel.logoUrl}
                  alt={`${hotel.name} logo`}
                  width={120}
                  height={120}
                  className="object-contain"
                  unoptimized
                />
              )
            ) : (
              <svg className="w-24 h-24 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            )}
          </div>
        )}
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        
        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {hotel.logoUrl && hotel.imageUrl && (
                  <div className="w-10 h-10 bg-white rounded-lg p-1 shadow-lg">
                    {hotel.logoUrl.startsWith("data:") ? (
                      <img src={hotel.logoUrl} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <Image
                        src={hotel.logoUrl}
                        alt={`${hotel.name} logo`}
                        width={32}
                        height={32}
                        className="object-contain w-full h-full"
                        unoptimized
                      />
                    )}
                  </div>
                )}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  hotel.isActive ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {hotel.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <h1 className="text-3xl font-bold text-white">{hotel.name}</h1>
              <p className="text-white/80 text-sm mt-1">{hotel.code}</p>
            </div>
            <div className="flex items-center gap-2">
              {hotel.starRating && (
                <div className="flex items-center gap-0.5 text-amber-400 bg-black/30 px-3 py-1.5 rounded-lg">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="font-bold">{hotel.starRating}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Details */}
        <div className="md:col-span-2 bg-card rounded-xl border border-border/60 p-5 shadow-soft">
          <h2 className="text-lg font-semibold mb-4">Hotel Details</h2>
          
          {hotel.description && (
            <p className="text-muted-foreground mb-4">{hotel.description}</p>
          )}
          
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Currency:</span>
              <p className="font-medium">{hotel.currency}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Timezone:</span>
              <p className="font-medium">{hotel.timezone || "UTC"}</p>
            </div>
            {hotel.address && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Address:</span>
                <p className="font-medium">{hotel.address}</p>
              </div>
            )}
            {hotel.phone && (
              <div>
                <span className="text-muted-foreground">Phone:</span>
                <p className="font-medium">{hotel.phone}</p>
              </div>
            )}
            {hotel.email && (
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="font-medium">{hotel.email}</p>
              </div>
            )}
            {hotel.createdAt && (
              <div>
                <span className="text-muted-foreground">Created:</span>
                <p className="font-medium">{new Date(hotel.createdAt).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
          <h2 className="text-lg font-semibold mb-4">Actions</h2>
          <div className="space-y-2">
            <Link
              href={`/platform/hotels/${hotelId}/edit`}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Hotel
            </Link>
            <Link
              href={`/hotels/${hotelId}/dashboard`}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Hotel Dashboard
            </Link>
            <Link
              href={`/book/hotels/${hotelId}`}
              target="_blank"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-accent transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Public Booking Page
            </Link>
          </div>
        </div>
      </div>

      {/* Rooms */}
      <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Rooms</h2>
          {rooms && (
            <span className="text-sm text-muted-foreground">
              {rooms.length} room{rooms.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {!rooms ? (
          <p className="text-muted-foreground">Loading rooms...</p>
        ) : rooms.length === 0 ? (
          <div className="text-center py-8 bg-muted/50 rounded-lg">
            <p className="text-muted-foreground mb-3">No rooms created yet</p>
            <p className="text-sm text-muted-foreground">
              Hotel staff can create rooms from their dashboard after logging in.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {rooms.map((room) => (
              <Link
                key={room.id}
                href={`/hotels/${hotelId}/rooms/${room.id}`}
                className="p-4 rounded-lg border border-border/60 hover:border-primary/30 hover:shadow-soft transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">Room {room.roomNumber}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    room.status === "VACANT_CLEAN" ? "bg-green-100 text-green-700" :
                    room.status === "OCCUPIED" ? "bg-blue-100 text-blue-700" :
                    room.status === "DIRTY" ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {room.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{room.roomTypeName}</p>
                {room.currentReservation && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Guest: {room.currentReservation.guestName}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

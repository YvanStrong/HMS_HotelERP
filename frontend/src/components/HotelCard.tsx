"use client";

import Image from "next/image";
import Link from "next/link";

interface HotelCardProps {
  id: string;
  name: string;
  code?: string;
  currency: string;
  timezone?: string;
  imageUrl?: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
}

export function HotelCard({
  id,
  name,
  code,
  currency,
  timezone,
  imageUrl,
  description,
  rating,
  reviewCount,
}: HotelCardProps) {
  // No gradients - use clean placeholder instead

  // Check if imageUrl is a data URL (base64) - use regular img tag for those
  const isDataUrl = imageUrl?.startsWith("data:");
  // Check if imageUrl is an external URL (http/https)
  const isExternalUrl = imageUrl?.startsWith("http://") || imageUrl?.startsWith("https://");

  return (
    <article className="group bg-white rounded-2xl border border-border/60 shadow-soft hover:shadow-float hover:border-primary/30 transition-all duration-300 overflow-hidden">
      {/* Image Section */}
      <div className="relative h-48 overflow-hidden bg-muted">
        {imageUrl ? (
          isDataUrl ? (
            // Use regular img for data URLs (base64 uploaded images)
            <img
              src={imageUrl}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : isExternalUrl ? (
            // Use Next.js Image for external URLs with unoptimized for non-configured domains
            <Image
              src={imageUrl}
              alt={name}
              fill
              unoptimized={!imageUrl.includes("unsplash.com") && !imageUrl.includes("cloudfront.net")}
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            // Fallback for relative URLs
            <img
              src={imageUrl}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          )
        ) : (
          <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 font-medium">{name}</p>
            {timezone && (
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {timezone}
              </p>
            )}
          </div>
        )}
        
        {/* Rating badge */}
        {rating && (
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
            <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-sm font-semibold text-foreground">{rating}</span>
            {reviewCount && (
              <span className="text-xs text-muted-foreground">({reviewCount})</span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
              {name}
            </h3>
            {code && (
              <p className="text-sm text-muted-foreground">Code: {code}</p>
            )}
          </div>
          <span className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-lg">
            {currency}
          </span>
        </div>

        {description && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{description}</p>
        )}

        <Link
          href={`/book/hotels/${id}`}
          className="mt-4 w-full inline-flex items-center justify-center px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm shadow-md hover:shadow-lg hover:brightness-105 active:scale-[0.98] transition-all"
        >
          See Availability
          <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </article>
  );
}

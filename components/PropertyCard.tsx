"use client";

import type { PropertyListing } from "@/types";

export default function PropertyCard({ property }: { property: PropertyListing }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 uppercase tracking-wide">{property.propertyType}</span>
            {property.mlsNumber && <span className="text-xs text-slate-400">MLS® {property.mlsNumber}</span>}
          </div>
          <h2 className="text-lg font-bold text-slate-900">{property.address}</h2>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-600">
            {property.bedrooms > 0 && (
              <span className="flex items-center gap-1">
                🛏️ <span className="font-semibold">{property.bedrooms}</span> bed{property.bedrooms !== 1 ? "s" : ""}
              </span>
            )}
            {property.bathrooms > 0 && (
              <span className="flex items-center gap-1">
                🚿 <span className="font-semibold">{property.bathrooms}</span> bath{property.bathrooms !== 1 ? "s" : ""}
              </span>
            )}
            {property.sqft && (
              <span className="flex items-center gap-1">
                📐 <span className="font-semibold">{property.sqft.toLocaleString()}</span> sq ft
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-slate-900">
            {property.price.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Listed Price</p>
          {property.assessedValue && (
            <p className="text-xs text-emerald-600 font-semibold mt-1">
              Assessed: {property.assessedValue.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 })}
            </p>
          )}
        </div>
      </div>
      {property.description && (
        <p className="text-sm text-slate-500 mt-3 line-clamp-2 border-t pt-3">{property.description}</p>
      )}
    </div>
  );
}

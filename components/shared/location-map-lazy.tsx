"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Leaflet touches `window`, so it is only ever rendered on the client. */
export const LocationMapLazy = dynamic(() => import("./location-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full rounded-xl bg-cream-deep" />,
});

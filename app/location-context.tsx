"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

type LocationContextValue = {
  coordinates: Coordinates | null;
  setCoordinates: (coordinates: Coordinates) => void;
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const value = useMemo(() => ({ coordinates, setCoordinates }), [coordinates]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const value = useContext(LocationContext);

  if (!value) {
    throw new Error("useLocation must be used within LocationProvider");
  }

  return value;
}

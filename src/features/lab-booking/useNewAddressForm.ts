"use client";

/**
 * The state behind adding a collection address (NewAddressForm): the area search as the patient
 * types (GET /api/labs/locations/search, nearby places first from the visitor's rough location),
 * "Use my current location" (GET /api/labs/locations/reverse), the chosen place's map point and the
 * collectors' reach (GET /api/labs/locations/:eloc, GET /api/labs/serviceability), then the saved
 * address (POST /api/address/add).
 */

import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/http/apiClient";
import { addAddress } from "@/services/addressService";
import { roughLocation } from "@/lib/location/roughLocation";
import {
  checkLabServiceability,
  findLabLocationAt,
  getLabLocationCoordinates,
  searchLabLocations,
} from "@/services/labTestService";
import type { LabCoordinates, LabPlaceMatch } from "@/types/labTest";

const NOT_SERVED = "Our partner lab does not collect in this area yet.";

export function useNewAddressForm(
  isFirst: boolean,
  onSaved: (addressId: number | null) => Promise<void>,
) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{
    query: string;
    matches: LabPlaceMatch[];
  } | null>(null);
  const [checkingEloc, setCheckingEloc] = useState<string | null>(null);
  const [place, setPlace] = useState<(LabPlaceMatch & LabCoordinates) | null>(
    null,
  );
  const [line, setLine] = useState("");
  const [landmark, setLandmark] = useState("");
  const [pincode, setPincode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const search = query.trim();

  const [locating, setLocating] = useState(false);

  // search as the patient types: from 2 letters, a beat after each key, the older search dropped
  useEffect(() => {
    if (place || search.length < 2) return;
    const stale = new AbortController();
    const timer = setTimeout(() => {
      searchLabLocations(search, roughLocation(), stale.signal)
        .then((matches) => setFound({ query: search, matches }))
        .catch((caught) => {
          if (!stale.signal.aborted) setError(errorMessage(caught));
        });
    }, 200);
    return () => {
      stale.abort();
      clearTimeout(timer);
    };
  }, [search, place]);

  const pick = async (match: LabPlaceMatch) => {
    if (checkingEloc) return;
    setCheckingEloc(match.eloc);
    setError(null);
    try {
      const point = await getLabLocationCoordinates(match.eloc);
      const reach = await checkLabServiceability(point);
      if (!reach.serviceable) setError(NOT_SERVED);
      else {
        setPlace({ ...match, ...point });
        setPincode(match.pincode);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setCheckingEloc(null);
    }
  };

  const locate = () => {
    if (locating || checkingEloc) return;
    if (!("geolocation" in navigator)) {
      setError("This browser cannot share your location. Search instead.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        findLabLocationAt({
          latitude: coords.latitude,
          longitude: coords.longitude,
        })
          .then(pick)
          .catch((caught) => setError(errorMessage(caught)))
          .finally(() => setLocating(false)),
      () => {
        setLocating(false);
        setError(
          "We could not get your location. Search for your area instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const complete =
    line.trim().length > 0 &&
    landmark.trim().length > 0 &&
    /^\d{6}$/.test(pincode);

  const save = async () => {
    if (!place || !complete || saving) return;
    setSaving(true);
    setError(null);
    try {
      const id = await addAddress({
        // city and state are saved in their own fields, so they are left out of the line
        addressLine: [
          line.trim(),
          ...place.address
            .split(",")
            .map((part) => part.trim())
            .filter(
              (part) => part && part !== place.city && part !== place.state,
            ),
        ].join(", "),
        landmark: landmark.trim(),
        city: place.city,
        state: place.state,
        pincode,
        latitude: place.latitude,
        longitude: place.longitude,
        isPrimary: isFirst,
      });
      await onSaved(id);
    } catch (caught) {
      setError(errorMessage(caught));
      setSaving(false);
    }
  };

  return {
    query,
    changeQuery: (value: string) => {
      setQuery(value);
      setError(null);
    },
    /** the latest matches, kept on screen while the next search runs; null before the first */
    matches: search.length >= 2 ? (found?.matches ?? null) : null,
    /** true while the matches shown are for older text than what is typed now */
    searching: search.length >= 2 && found?.query !== search,
    locating,
    locate,
    checkingEloc,
    pick,
    place,
    changePlace: () => setPlace(null),
    line,
    setLine,
    landmark,
    setLandmark,
    pincode,
    setPincode,
    complete,
    saving,
    save,
    error,
  };
}

/**
 * Google Street View Static façade imagery, resolved client-side from a
 * property's coordinates. Used as the PRIMARY photo when a key is configured
 * (it has the best Paris coverage); otherwise the dataset's baked images
 * (Mapillary street photos, or representative interiors) are used as-is.
 *
 * The key is a build-time env var (VITE_GSV_KEY). On a static site it is
 * necessarily visible in the image URLs, so it MUST be locked down with an
 * HTTP-referrer restriction in Google Cloud Console (to the app's domains).
 */

const KEY = import.meta.env.VITE_GSV_KEY as string | undefined;

export const hasStreetView = (): boolean => Boolean(KEY);

function url(lat: number, lng: number, heading: number, size: string): string {
  return (
    `https://maps.googleapis.com/maps/api/streetview?location=${lat},${lng}` +
    `&size=${size}&heading=${heading}&fov=80&pitch=6&source=outdoor&key=${KEY}`
  );
}

/** A small gallery of the building/street from four angles (empty if no key). */
export function streetViewGallery(lat: number, lng: number): string[] {
  if (!KEY) return [];
  return [0, 90, 180, 270].map((h) => url(lat, lng, h, "800x500"));
}

/** Thumbnail façade for cards/lists (null if no key). */
export function streetViewThumb(lat: number, lng: number): string | null {
  return KEY ? url(lat, lng, 0, "480x300") : null;
}

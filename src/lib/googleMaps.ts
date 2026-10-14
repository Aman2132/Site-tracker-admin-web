declare global {
  interface Window {
    /** Google calls this when it rejects the API key (wrong key, blocked referrer, billing off). */
    gm_authFailure?: () => void;
    /** Google calls this once the API is fully ready (the script `onload` fires earlier). */
    __googleMapsReady?: () => void;
  }
}

let loading: Promise<void> | null = null;
const failureListeners = new Set<() => void>();

/**
 * Loads the Google Maps JavaScript API once per page. Resolves when Google's
 * ready callback fires (not on the script's own `onload`, which is too early);
 * rejects if the script can't load.
 */
export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof google !== "undefined" && typeof google.maps?.importLibrary === "function") return Promise.resolve();
  if (!loading) {
    window.gm_authFailure = () => failureListeners.forEach(listener => listener());
    loading = new Promise<void>((resolve, reject) => {
      window.__googleMapsReady = () => resolve();
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&libraries=marker&v=weekly&callback=__googleMapsReady`;
      script.async = true;
      script.onerror = () => {
        loading = null;
        reject(new Error("Google Maps could not be loaded"));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

/** Calls `listener` if Google rejects the key. Returns a function that stops listening. */
export function onGoogleAuthFailure(listener: () => void): () => void {
  failureListeners.add(listener);
  return () => {
    failureListeners.delete(listener);
  };
}

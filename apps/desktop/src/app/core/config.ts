declare global {
  interface Window {
    /** Set by the Electron preload script. */
    evergreen?: { apiUrl: string };
  }
}

const fromQuery = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('api');

export const API_URL = (window.evergreen?.apiUrl ?? fromQuery ?? 'http://localhost:3000').replace(/\/$/, '');

export const STATUS_POLL_MS = 5000;
export const JOB_POLL_MS = 2000;

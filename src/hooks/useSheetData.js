import { useState, useEffect } from "react";
import Papa from "papaparse";

const BASE = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRejtusv9ILwc_N2oNJvFodxuKbHiem2qyL05wpdYLszSsEevbLl38XXyOrkk1f9iEj7_HN28X-pQ8E/pub";

export const SHEET_URLS = {
  complete_words:      `${BASE}?gid=0&single=true&output=csv`,
  daily_life:          `${BASE}?gid=1150558520&single=true&output=csv`,
  academic_passage:    `${BASE}?gid=1603153894&single=true&output=csv`,
  build_sentence:      `${BASE}?gid=83902741&single=true&output=csv`,
  email:               `${BASE}?gid=1183845265&single=true&output=csv`,
  discussion:          `${BASE}?gid=921109399&single=true&output=csv`,
  interview:           `${BASE}?gid=1842702455&single=true&output=csv`,
};

export function useSheetData(sheetKey) {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    const url = SHEET_URLS[sheetKey];

    if (!url) {
      const errorTimer = window.setTimeout(() => {
        setState({ data: [], loading: false, error: `Unknown sheet: ${sheetKey}` });
      }, 0);
      return () => window.clearTimeout(errorTimer);
    }

    const loadingTimer = window.setTimeout(() => {
      if (!cancelled) {
        setState((prev) => ({ ...prev, loading: true, error: null }));
      }
    }, 0);

    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!cancelled) {
          setState({ data: results.data, loading: false, error: null });
        }
      },
      error: (err) => {
        if (!cancelled) {
          setState({ data: [], loading: false, error: err.message });
        }
      },
    });

    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [sheetKey]);

  return state;
}

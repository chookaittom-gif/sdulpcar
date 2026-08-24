/* ===== GViz Service Layer (Read/Search Only) ===== */
(function(global) {
  'use strict';

  // 1. Escape GViz Value to prevent injection and break query
  function escapeGvizValue(val) {
    if (val === null || val === undefined) return '';
    return String(val)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  // 2. Client Cache (30 seconds TTL)
  const queryCache = new Map();
  const CACHE_TTL_MS = 30000;

  function getCache(key) {
    const cached = queryCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      return cached.data;
    }
    return null;
  }

  // Set cache with URL as key
  function setCache(key, data) {
    queryCache.set(key, {
      timestamp: Date.now(),
      data: data
    });
  }

  // 3. AbortController Pool for active requests
  let activeControllers = {};

  function abortPreviousRequest(slot) {
    if (activeControllers[slot]) {
      try {
        activeControllers[slot].abort();
      } catch (_) {}
      delete activeControllers[slot];
    }
  }

  // 4. Utility function to convert 0-based index to column letter
  function getColLetter(index) {
    if (typeof index !== 'number' || index < 0) return '';
    let temp = index;
    let letter = '';
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  }

  // Helper to construct phone regex match pattern (matches digits ignoring hyphens, spaces, etc.)
  function makePhoneRegexPattern(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '.*';
    return '.*' + digits.split('').map(d => d + '.*').join('');
  }

  // 5. Core GViz Query Executor with Retry and Timeout
  async function gvizQuery(sheetName, tq, slot = 'default', attempt = 1) {
    const gvizUrl = global.APP_CONFIG && global.APP_CONFIG.gvizUrl;
    if (!gvizUrl) {
      throw new Error('APP_CONFIG.gvizUrl is not configured');
    }

    // Build URL
    const url = new URL(gvizUrl);
    url.searchParams.set('sheet', sheetName);
    url.searchParams.set('tq', tq);

    const requestUrl = url.toString();
    
    // Check Client Cache
    const cached = getCache(requestUrl);
    if (cached) {
      return cached;
    }

    // Abort previous in-flight request for this slot
    abortPreviousRequest(slot);

    // Create new controller
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    if (controller) {
      activeControllers[slot] = controller;
    }

    const timeoutMs = (global.APP_CONFIG && global.APP_CONFIG.requestTimeoutMs) || 30000;
    const timeoutId = controller ? setTimeout(() => {
      controller.abort();
    }, timeoutMs) : null;

    try {
      const response = await fetch(requestUrl, {
        method: 'GET',
        mode: 'cors',
        signal: controller ? controller.signal : undefined
      });

      if (timeoutId) clearTimeout(timeoutId);
      delete activeControllers[slot];

      if (!response.ok) {
        throw new Error('HTTP status ' + response.status);
      }

      const text = await response.text();
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
      if (!match) {
        throw new Error('Invalid GViz response format');
      }

      const json = JSON.parse(match[1]);
      if (json.status === 'error') {
        throw new Error((json.errors && json.errors[0] && json.errors[0].detailed_message) || 'GViz query error');
      }

      const table = json.table;
      if (!table) {
        throw new Error('GViz empty table');
      }

      // Save to cache
      setCache(requestUrl, table);
      return table;

    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      delete activeControllers[slot];

      // Handle abort / check if it was cancelled
      const isAbort = err.name === 'AbortError' || String(err.message).indexOf('Abort') > -1;
      if (isAbort) {
        // If aborted due to new search query, don't retry, just propagate abort
        throw err;
      }

      // Retry exactly once on network error/timeout
      if (attempt < 2) {
        console.warn(`⚠️ GViz Query failed: ${err.message}. Retrying... (Attempt 2/2)`);
        return gvizQuery(sheetName, tq, slot, attempt + 1);
      }

      throw err;
    }
  }

  // 6. Specific Search Bookings by Phone (Returns array of { bookingId, summary })
  async function searchBookingsByPhone(phone) {
    const headerIndexes = global.APP_CONFIG && global.APP_CONFIG.headerIndexes;
    if (!headerIndexes) {
      throw new Error('Header indexes not loaded yet');
    }

    const phoneIdx = headerIndexes.phone;
    const bookingIdIdx = headerIndexes.bookingId;
    const statusIdx = headerIndexes.status;
    const startDateIdx = headerIndexes.startDate;
    const destinationIdx = headerIndexes.destination;

    if (phoneIdx === undefined || bookingIdIdx === undefined || statusIdx === undefined || startDateIdx === undefined || destinationIdx === undefined) {
      throw new Error('Missing required column indexes');
    }

    // Convert indices to column letters
    const colPhone = getColLetter(phoneIdx);
    const colBookingId = getColLetter(bookingIdIdx);
    const colStatus = getColLetter(statusIdx);
    const colStartDate = getColLetter(startDateIdx);
    const colDestination = getColLetter(destinationIdx);

    // Escape phone input to avoid query injection
    const escapedPattern = escapeGvizValue(makePhoneRegexPattern(phone));

    // Construct SQL Query
    // We select bookingId (0), startDate (1), destination (2), status (3)
    const tq = `select ${colBookingId}, ${colStartDate}, ${colDestination}, ${colStatus} ` +
               `where ${colPhone} matches '${escapedPattern}' ` +
               `and not (lower(${colStatus}) matches '.*(ไม่อนุมัติ|reject|ปฏิเสธ|fail|ยกเลิก|cancel).*') ` +
               `order by ${colBookingId} desc ` +
               `limit 5`;

    const table = await gvizQuery('Data', tq, 'searchBookings');
    
    if (!table || !table.rows || table.rows.length === 0) {
      return [];
    }

    return table.rows.map(row => {
      const getVal = (colIndex) => {
        const cell = row.c[colIndex];
        if (!cell) return '';
        return cell.f !== undefined ? cell.f : (cell.v !== null ? cell.v : '');
      };

      const bookingId = String(getVal(0));
      const startDateVal = getVal(1);
      const destinationVal = getVal(2);

      // Handle startDateVal (in GViz JSON, Date cell.v is like "Date(2026,6,6)" but cell.f is the formatted Thai date or DD/MM/YYYY)
      let dateStr = String(startDateVal);
      if (dateStr.startsWith('Date(')) {
        // If cell.f is missing, parse Date(y, m, d)
        try {
          const parts = dateStr.match(/\d+/g).map(Number);
          if (parts.length >= 3) {
            // Month in Date(y, m, d) in GViz is 0-indexed
            const d = new Date(parts[0], parts[1], parts[2]);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            dateStr = `${day}/${month}/${year}`;
          }
        } catch (_) {}
      }

      return {
        bookingId: bookingId,
        summary: `${dateStr} : ${destinationVal}`
      };
    });
  }

  // Debounce wrapper
  function makeDebounced(fn, wait) {
    let timeout;
    return function(...args) {
      const context = this;
      return new Promise((resolve, reject) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          Promise.resolve(fn.apply(context, args)).then(resolve).catch(reject);
        }, wait);
      });
    };
  }

  // Export to global scope
  global.GVizService = {
    query: gvizQuery,
    searchBookingsByPhone: searchBookingsByPhone,
    escapeGvizValue: escapeGvizValue,
    makeDebounced: makeDebounced
  };

})(window);

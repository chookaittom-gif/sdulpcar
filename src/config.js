(function initStaticConfig(global) {
  var APP_CONFIG = {
    webAppUrl: 'https://script.google.com/macros/s/AKfycbx9YcO01C1dJxS_5lfZPALEWdSelp1QMEaWWUlDN7Kjc9OSudzW520a0ZJ95y0qOA-p-A/exec',
    requestTimeoutMs: 60000,
    safeIntervalMs: 0,
    gvizUrl: ''
  };

  var API_ACTIONS = {
    ping: true,
    selfTestEarlyClose_All: true,
    logoutUser: true,
    verifyAdminLogin: true,
    getWebAppInitialData: true,
    clearInitialCache: true,
    getById: true,
    apiGetAdminPanelData: true,
    createBookingAndBroadcast: true,
    checkPendingBookingOverlap: true,
    getAvailableVehicles: true,
    apiUpdateBookingStatus: true,
    updateBookingStatus: true,
    apiUserCancelBooking: true,
    closeBookingActualEnd: true,
    specialApproveBooking: true,
    getRealTimeAvailableCount: true,
    apiGetBookingsByPhone: true,
    getVehicleList: true,
    getDriverList: true,
    getTimelineData: true,
    apiGetFuelFormOptions: true,
    apiGetLiveStatus: true,
    apiGetLiveStatusForModal: true,
    apiGetFuelHistory: true,
    apiGetInsuranceHistory: true,
    apiGetMaintenanceHistory: true,
    apiGetInsurancePlates: true,
    apiGetMaintenancePlates: true,
    apiSaveFuel: true,
    apiSaveMaintenance: true,
    saveInsuranceRecord: true,
    saveMaintenanceRecord: true,
    listInsuranceRecords: true,
    listMaintenanceRecords: true,
    getDashboardFuelLevels: true,
    apiRefreshDashboard: true,
    apiGenerateDashboardPdf: true,
    apiGenerateFuelMonthlyPdf: true,
    apiGenerateFuelDailyPdf: true,
    apiGenerateInsuranceAnnualPdf: true,
    apiGenerateMaintenanceMonthlyPdf: true,
    apiToggleDriverStatus: true,
    apiToggleVehicleStatus: true,
    createAvailabilityBlock: true,
    closeAvailabilityBlock: true,
    saveMaintenanceAvailability: true
  };

  var READ_API_ACTIONS = {
    ping: true,
    getWebAppInitialData: true,
    getById: true,
    apiGetAdminPanelData: true,
    apiGetFuelFormOptions: true,
    apiGetFuelHistory: true,
    apiGetInsuranceHistory: true,
    apiGetMaintenanceHistory: true,
    apiGetBookingsByPhone: true,
    getVehicleList: true,
    getDriverList: true,
    getAvailableVehicles: true,
    getRealTimeAvailableCount: true,
    getTimelineData: true,
    apiGetLiveStatus: true,
    apiGetLiveStatusForModal: true,
    getDashboardFuelLevels: true,
    apiGetInsurancePlates: true,
    apiGetMaintenancePlates: true,
    apiRefreshDashboard: true
  };

  var CACHEABLE_API_ACTIONS = {
    getWebAppInitialData: 30000,
    getVehicleList: 60000,
    getDriverList: 60000,
    getDashboardFuelLevels: 30000,
    apiGetAdminPanelData: 30000,
    apiGetFuelFormOptions: 60000
  };

  function normalizeUrl(url) {
    return String(url || '').trim();
  }

  function buildRequestKey(action, payload) {
    return action + '::' + JSON.stringify(payload == null ? null : payload);
  }

  function isReadAction(action) {
    return READ_API_ACTIONS[String(action || '').trim()] === true;
  }

  function buildGetUrl(baseUrl, action, payload) {
    var url = new URL(baseUrl);
    url.searchParams.set('action', action);
    url.searchParams.set('payload', JSON.stringify(payload == null ? {} : payload));
    return url.toString();
  }

  function shouldRetryOnce(action) {
    return String(action || '').trim() === 'getWebAppInitialData';
  }

  function isInitialDataAction(action) {
    return String(action || '').trim() === 'getWebAppInitialData';
  }

  function isHttp404Error(err) {
    return !!(err && (err.statusCode === 404 || String(err.message || err).indexOf('HTTP 404') > -1));
  }

  function sleepMs(ms) {
    return new Promise(function(resolve) {
      setTimeout(resolve, ms);
    });
  }

  function isAbortLikeError(err) {
    var msg = String(err && err.message ? err.message : err || '');
    return !!(err && err.name === 'AbortError') ||
      msg.indexOf('AbortError') > -1 ||
      msg.indexOf('signal is aborted') > -1;
  }

  function createFriendlyAbortError() {
    var err = new Error('REQUEST_TIMEOUT_OR_ABORTED');
    err.code = 'REQUEST_TIMEOUT_OR_ABORTED';
    err.userMessage = 'โหลดข้อมูลเริ่มต้นไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
    return err;
  }

  function createApiClient(cfg) {
    var queue = [];
    var busy = false;
    var lastRunAt = 0;
    var inflight = new Map();
    var responseCache = new Map();

    function processNext() {
      if (!queue.length) {
        busy = false;
        return;
      }

      busy = true;
      var task = queue.shift();
      var waitMs = Math.max(0, Number(cfg.safeIntervalMs || 0) - (Date.now() - lastRunAt));
      setTimeout(function() {
        lastRunAt = Date.now();
        task();
      }, waitMs);
    }

    function apiCall(action, payload) {
      action = String(action || '').trim();
      if (!API_ACTIONS[action]) {
        return Promise.reject(new Error('Unknown action: ' + action + '. Supported actions: ' + Object.keys(API_ACTIONS).sort().join(', ')));
      }

      var webAppUrl = normalizeUrl(cfg.webAppUrl);
      if (!webAppUrl || webAppUrl === 'PASTE_APPS_SCRIPT_WEB_APP_URL_HERE') {
        return Promise.reject(new Error('APP_CONFIG.webAppUrl is not configured'));
      }

      var requestKey = buildRequestKey(action, payload);
      var cacheTtl = CACHEABLE_API_ACTIONS[action] || 0;
      var cached = cacheTtl ? responseCache.get(requestKey) : null;
      if (cached && (Date.now() - cached.ts) < cacheTtl) return Promise.resolve(cached.value);
      if (inflight.has(requestKey)) return inflight.get(requestKey);

      var pending = new Promise(function(resolve, reject) {
        queue.push(function() {
          var useGet = isReadAction(action);
          var requestUrl = useGet ? buildGetUrl(webAppUrl, action, payload) : webAppUrl;
          var baseFetchOptions = {
            method: useGet ? 'GET' : 'POST',
            mode: 'cors',
            redirect: 'follow',
            credentials: 'omit'
          };

          if (!useGet) {
            baseFetchOptions.headers = {
              'Content-Type': 'text/plain;charset=utf-8'
            };
            baseFetchOptions.body = JSON.stringify({
              action: action,
              payload: payload
            });
          }

          function runFetchAttempt() {
            var controller = typeof AbortController === 'function' ? new AbortController() : null;
            var timeoutId = controller ? setTimeout(function() {
              controller.abort();
            }, Number(cfg.requestTimeoutMs || 30000)) : null;
            var fetchOptions = Object.assign({}, baseFetchOptions);
            if (controller) fetchOptions.signal = controller.signal;

            return fetch(requestUrl, fetchOptions)
              .then(function(response) {
                if (!response.ok) {
                  var httpErr = new Error('HTTP ' + response.status);
                  httpErr.statusCode = response.status;
                  httpErr.requestUrl = requestUrl;
                  throw httpErr;
                }
                return response.text();
              })
              .then(function(text) {
                var json;
                try {
                  json = text ? JSON.parse(text) : {};
                } catch (parseErr) {
                  throw new Error('Invalid JSON response');
                }

                if (!json || json.ok !== true) {
                  throw new Error((json && json.error) ? json.error : 'API request failed');
                }

                return Object.prototype.hasOwnProperty.call(json, 'data') ? json.data : json;
              })
              .finally(function() {
                if (timeoutId) clearTimeout(timeoutId);
              });
          }

          var attempts = 0;
          var maxAttempts = shouldRetryOnce(action) ? 2 : 1;
          var http404RetryDelays = [1500, 3000, 5000];

          function executeWithRetry() {
            attempts++;
            return runFetchAttempt().catch(function(err) {
              if (isInitialDataAction(action) && isHttp404Error(err) && attempts <= http404RetryDelays.length) {
                global.vbInitState = 'RETRYING';
                console.warn('RETRY getWebAppInitialData ' + attempts + '/3 after HTTP 404');
                try {
                  if (typeof global.showToast === 'function') global.showToast('กำลังลองโหลดข้อมูลอีกครั้ง...', 'info');
                } catch (_) {}
                return sleepMs(http404RetryDelays[attempts - 1]).then(executeWithRetry);
              }
              if (isAbortLikeError(err)) {
                if (attempts < maxAttempts) return executeWithRetry();
                throw createFriendlyAbortError();
              }
              throw err;
            });
          }

          executeWithRetry()
            .then(function(result) {
              if (!useGet || action === 'apiRefreshDashboard' || action === 'clearInitialCache') {
                responseCache.clear();
              }
              if (cacheTtl) responseCache.set(requestKey, { ts: Date.now(), value: result });
              resolve(result);
            })
            .catch(reject)
            .finally(function() {
              inflight.delete(requestKey);
              processNext();
            });
        });

        if (!busy) processNext();
      });

      inflight.set(requestKey, pending);
      return pending;
    }

    function createRunnerState(state) {
      var runnerState = state || {
        successHandler: null,
        failureHandler: null,
        userObject: undefined
      };

      return new Proxy({}, {
        get: function(_target, prop) {
          if (prop === 'withSuccessHandler') {
            return function(handler) {
              return createRunnerState({
                successHandler: handler,
                failureHandler: runnerState.failureHandler,
                userObject: runnerState.userObject
              });
            };
          }

          if (prop === 'withFailureHandler') {
            return function(handler) {
              return createRunnerState({
                successHandler: runnerState.successHandler,
                failureHandler: handler,
                userObject: runnerState.userObject
              });
            };
          }

          if (prop === 'withUserObject') {
            return function(userObject) {
              return createRunnerState({
                successHandler: runnerState.successHandler,
                failureHandler: runnerState.failureHandler,
                userObject: userObject
              });
            };
          }

          if (typeof prop !== 'string') return undefined;

          return function(payload) {
            return apiCall(prop, payload)
              .then(function(result) {
                if (typeof runnerState.successHandler === 'function') {
                  runnerState.successHandler(result, runnerState.userObject);
                }
                return result;
              })
              .catch(function(err) {
                if (typeof runnerState.failureHandler === 'function') {
                  runnerState.failureHandler(err, runnerState.userObject);
                  return undefined;
                }
                throw err;
              });
          };
        }
      });
    }

    return {
      call: apiCall,
      createRunner: function() {
        return createRunnerState();
      }
    };
  }

  global.APP_CONFIG = APP_CONFIG;
  global.API_ACTIONS = API_ACTIONS;
  global.vbApiClient = createApiClient(APP_CONFIG);
  global.apiCall = global.vbApiClient.call;
  global.google = global.google || {};
  global.google.script = global.google.script || {};
  global.google.script.run = global.vbApiClient.createRunner();
})(window);

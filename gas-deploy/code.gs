/** ===================== CONFIGURATION CONSTANTS ===================== */
const SHEET_MAIN_NAME   = 'Data';
const SHEET_ARCHIVE     = 'Data_Archive';
const SHEET_SETTING     = 'setting';
const SHEET_ADMIN       = 'Admin';
const SHEET_FUEL        = 'Fuel';
const SHEET_INSURANCE   = 'Insurance';
const SHEET_MAINTENANCE = 'Maintenance';
const SHEET_LOG         = 'Log';
const SHEET_VEHICLES    = 'Vehicles'; 
const SHEET_AVAILABILITY = 'Availability'; 
const HEADER_ROW        = 1;
const MAX_COLS          = 22;
const CACHE_SEC         = 120;
const TZ                = 'Asia/Bangkok';
const SHEET_VEHICLE_STATUS = 'VehicleStatus';
const INITIAL_DATA_CACHE_KEY = 'mainDataCache_v13_BerryFix';

const COLMAP = {
  // คงไว้เหมือนเดิม ไม่ต้องเอาคอลัมน์ของ Availability มาปนค่ะ
  name:        ['ชื่อ-สกุล', 'ชื่อผู้จอง'],
  status:['สถานะ', 'Status'],
  phone:       ['เบอร์โทร', 'เบอร์โทรศัพท์'],
  position:    ['ตำแหน่ง'],
  department:  ['สังกัด', 'หน่วยงาน'],
  email:['email', 'อีเมล'],
  workType:    ['ประเภทงาน', 'jobType'],
  workName:    ['งาน/โครงการ', 'ชื่อโครงการ/งาน', 'projectName', 'project'],
  destination:['สถานที่', 'สถานที่ปลายทาง'],
  carType:     ['ประเภทรถ'],
  vehicle:['เลขทะเบียนรถ', 'ทะเบียนรถ'],  
  requestedVehicle: ['รถที่เลือก'],            
  driver:      ['พนักงานขับรถ'],               
  startDate:   ['วันเริ่มต้น'],
  startTime:['เวลาเริ่มต้น'],
  endDate:     ['วันสิ้นสุด'],
  endTime:     ['เวลาสิ้นสุด'],
  passengers:  ['จำนวนผู้ร่วมเดินทาง'],
  bookingId:   ['Booking ID', 'ID'],
  fileUrl:     ['File', 'ไฟล์แนบ'],
  reason:      ['Reason', 'หมายเหตุ'],
  cancelReason:['CancelReason', 'เหตุผลยกเลิก'],
  vehicleCount:['จำนวนรถที่ต้องการ', 'Vehicle Count', 'จำนวนคัน']
};

const VB_CFG = {
  TZ: TZ,
  DATA_SHEET: SHEET_MAIN_NAME,
  INS_SHEET: SHEET_INSURANCE,
  MAINT_SHEET: SHEET_MAINTENANCE,
  ADVANCE_DAYS: 3
};

function _toA1ColGlobal_(n) {
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s || 'A';
}

function _sheetNameToA1_(name) {
  return "'" + String(name || '').replace(/'/g, "''") + "'";
}

function _sheetRangeA1_(sheet, row, col, numRows, numCols) {
  return _sheetNameToA1_(sheet.getName()) + '!' +
    _toA1ColGlobal_(col) + row + ':' +
    _toA1ColGlobal_(col + numCols - 1) + (row + numRows - 1);
}

function _sheetApiNormalizeRows_(rawValues, numRows, numCols) {
  var rows = rawValues || [];
  return Array.from({ length: numRows }, function(_, r) {
    var row = rows[r] || [];
    if (row.length >= numCols) return row.slice(0, numCols);
    return row.concat(Array(numCols - row.length).fill(''));
  });
}

function _sheetApiGetValues_(sheet, row, col, numRows, numCols, fallbackLabel) {
  var spreadsheetId = sheet.getParent().getId();
  var rangeA1 = _sheetRangeA1_(sheet, row, col, numRows, numCols);
  try {
    var resp = Sheets.Spreadsheets.Values.get(spreadsheetId, rangeA1, {
      majorDimension: 'ROWS',
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER'
    });
    return _sheetApiNormalizeRows_(resp && resp.values, numRows, numCols);
  } catch (sheetApiErr) {
    Logger.log((fallbackLabel || 'sheetApi get') + ' fallback to getValues: ' + (sheetApiErr && sheetApiErr.message ? sheetApiErr.message : sheetApiErr));
    return sheet.getRange(row, col, numRows, numCols).getValues();
  }
}

function _sheetApiUpdateValues_(sheet, row, col, values, options) {
  var rows = values || [];
  if (!rows.length || !rows[0] || !rows[0].length) return;
  var spreadsheetId = sheet.getParent().getId();
  var rangeA1 = _sheetRangeA1_(sheet, row, col, rows.length, rows[0].length);
  var valueInputOption = (options && options.valueInputOption) || 'USER_ENTERED';
  try {
    Sheets.Spreadsheets.Values.update(
      { values: rows },
      spreadsheetId,
      rangeA1,
      { valueInputOption: valueInputOption }
    );
  } catch (sheetApiErr) {
    Logger.log(((options && options.label) || 'sheetApi update') + ' fallback to setValues: ' + (sheetApiErr && sheetApiErr.message ? sheetApiErr.message : sheetApiErr));
    sheet.getRange(row, col, rows.length, rows[0].length).setValues(rows);
  }
}

function _sheetApiAppendRow_(sheet, rowValues, options) {
  var spreadsheetId = sheet.getParent().getId();
  var rangeA1 = _sheetNameToA1_(sheet.getName()) + '!A1';
  var valueInputOption = (options && options.valueInputOption) || 'USER_ENTERED';
  try {
    var resp = Sheets.Spreadsheets.Values.append(
      { values: [rowValues] },
      spreadsheetId,
      rangeA1,
      {
        valueInputOption: valueInputOption,
        insertDataOption: 'INSERT_ROWS',
        includeValuesInResponse: false
      }
    );
    var updatedRange = resp && resp.updates && resp.updates.updatedRange ? resp.updates.updatedRange : '';
    var match = String(updatedRange).match(/![A-Z]+(\d+):/);
    return match ? parseInt(match[1], 10) : sheet.getLastRow();
  } catch (sheetApiErr) {
    Logger.log(((options && options.label) || 'sheetApi append') + ' fallback to appendRow: ' + (sheetApiErr && sheetApiErr.message ? sheetApiErr.message : sheetApiErr));
    sheet.appendRow(rowValues);
    return sheet.getLastRow();
  }
}

function _sheetApiBatchUpdate_(spreadsheetId, requests, fallbackFn, label) {
  if (!requests || !requests.length) return;
  try {
    Sheets.Spreadsheets.batchUpdate({ requests: requests }, spreadsheetId);
  } catch (sheetApiErr) {
    Logger.log((label || 'sheetApi batchUpdate') + ' fallback: ' + (sheetApiErr && sheetApiErr.message ? sheetApiErr.message : sheetApiErr));
    if (typeof fallbackFn === 'function') fallbackFn();
  }
}

function _sheetApiDeleteRows_(sheet, rowNumbers, fallbackLabel) {
  var rows = (rowNumbers || []).slice().sort(function(a, b) { return b - a; });
  if (!rows.length) return;
  var spreadsheetId = sheet.getParent().getId();
  var sheetId = sheet.getSheetId();
  var requests = rows.map(function(rowNumber) {
    return {
      deleteDimension: {
        range: {
          sheetId: sheetId,
          dimension: 'ROWS',
          startIndex: rowNumber - 1,
          endIndex: rowNumber
        }
      }
    };
  });
  _sheetApiBatchUpdate_(spreadsheetId, requests, function() {
    rows.forEach(function(rowNumber) {
      sheet.deleteRow(rowNumber);
    });
  }, fallbackLabel || 'sheetApi delete rows');
}

function _sheetApiApplyFormatsForRow_(sheet, rowNumber, formatSpecs) {
  if (!formatSpecs || !formatSpecs.length) return;
  var spreadsheetId = sheet.getParent().getId();
  var sheetId = sheet.getSheetId();
  var requests = formatSpecs.map(function(spec) {
    return {
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: rowNumber - 1,
          endRowIndex: rowNumber,
          startColumnIndex: spec.colIndex,
          endColumnIndex: spec.colIndex + 1
        },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: spec.type,
              pattern: spec.pattern
            }
          }
        },
        fields: 'userEnteredFormat.numberFormat'
      }
    };
  });
  _sheetApiBatchUpdate_(spreadsheetId, requests, function() {
    formatSpecs.forEach(function(spec) {
      sheet.getRange(rowNumber, spec.colIndex + 1).setNumberFormat(spec.pattern);
    });
  }, 'sheetApi apply formats');
}

// ===================== CORE FUNCTIONS =====================
function doGet(e) {
  var action = String((e && e.parameter && e.parameter.action) || '').trim();
  if (!action) {
    return _renderWebAppIndex_();
  }
  return _handleWebApiRequest_(e, 'GET');
}

function doPost(e) {
  return _handleWebApiRequest_(e, 'POST');
}

function _renderWebAppIndex_() {
  var content = HtmlService.createHtmlOutputFromFile('index').getContent();
  content = content.replace(
    '<link rel="stylesheet" href="./style.css">',
    include_('Style')
  );
  content = content.replace(
    '        <script src="./config.js"></script>\n        <script src="./gviz-service.js"></script>\n        <script src="./app.js"></script>',
    include_('gviz-service') + '\n' + include_('JavaScript')
  );

  return HtmlService.createHtmlOutput(content)
    .setTitle('ระบบจองยานพาหนะ มหาวิทยาลัยสวนดุสิต ศูนย์การศึกษาลำปาง')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .addMetaTag('mobile-web-app-capable', 'yes')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

function _handleWebApiRequest_(e, method) {
  try {
    var req = _parseWebApiRequest_(e, method);
    if (!req.action) {
      return _jsonOutput_({
        ok: true,
        data: {
          status: 'ready',
          service: 'sdulpcar-api',
          method: method || 'GET'
        }
      });
    }

    var result = _dispatchWebApiAction_(req.action, req.payload);
    return _jsonOutput_({ ok: true, data: result });
  } catch (err) {
    return _jsonOutput_({
      ok: false,
      error: (err && err.message) ? err.message : String(err || 'Unknown error')
    });
  }
}

function _parseWebApiRequest_(e, method) {
  var params = (e && e.parameter) || {};
  var action = String(params.action || '').trim();
  var payload = undefined;

  if (String(method || '').toUpperCase() === 'POST') {
    var raw = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : '';
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if (parsed.action != null) action = String(parsed.action).trim();
        if (Object.prototype.hasOwnProperty.call(parsed, 'payload')) payload = parsed.payload;
      } else {
        payload = parsed;
      }
    }
  }

  if (payload === undefined && Object.prototype.hasOwnProperty.call(params, 'payload')) {
    payload = _parseWebApiPayloadValue_(params.payload);
  }

  return { action: action, payload: payload };
}

function _parseWebApiPayloadValue_(raw) {
  if (raw == null || raw === '') return raw;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return raw;
  }
}

function _dispatchWebApiAction_(action, payload) {
  var actionMap = _getWebApiActionMap_();
  var api = actionMap[action];
  if (!api || typeof api !== 'function') {
    throw new Error('Unknown action: ' + action + '. Supported actions: ' + Object.keys(actionMap).sort().join(', '));
  }
  return api(payload);
}

function _getWebApiActionMap_() {
  return {
    ping: ping,
    selfTestEarlyClose_All: selfTestEarlyClose_All,
    logoutUser: logoutUser,
    verifyAdminLogin: verifyAdminLogin,
    getWebAppInitialData: getWebAppInitialData,
    clearInitialCache: clearInitialCache,
    getById: getById,
    apiGetAdminPanelData: apiGetAdminPanelData,
    createBookingAndBroadcast: createBookingAndBroadcast,
    checkPendingBookingOverlap: checkPendingBookingOverlap,
    getAvailableVehicles: getAvailableVehicles,
    apiUpdateBookingStatus: apiUpdateBookingStatus,
    updateBookingStatus: updateBookingStatus,
    apiUserCancelBooking: apiUserCancelBooking,
    closeBookingActualEnd: closeBookingActualEnd,
    specialApproveBooking: specialApproveBooking,
    getRealTimeAvailableCount: getRealTimeAvailableCount,
    apiGetBookingsByPhone: apiGetBookingsByPhone,
    getVehicleList: getVehicleList,
    getDriverList: getDriverList,
    getTimelineData: getTimelineData,
    apiGetFuelFormOptions: apiGetFuelFormOptions,
    apiGetLiveStatus: apiGetLiveStatus,
    apiGetLiveStatusForModal: function(payload) {
      payload = payload || {};
      return apiGetLiveStatusForModal(payload.resourceType, payload.resourceId);
    },
    apiGetFuelHistory: apiGetFuelHistory,
    apiGetInsuranceHistory: apiGetInsuranceHistory,
    apiGetMaintenanceHistory: apiGetMaintenanceHistory,
    apiGetInsurancePlates: apiGetInsurancePlates,
    apiGetMaintenancePlates: apiGetMaintenancePlates,
    apiSaveFuel: apiSaveFuel,
    apiSaveMaintenance: apiSaveMaintenance,
    saveInsuranceRecord: saveInsuranceRecord,
    saveMaintenanceRecord: saveMaintenanceRecord,
    listInsuranceRecords: listInsuranceRecords,
    listMaintenanceRecords: listMaintenanceRecords,
    getDashboardFuelLevels: getDashboardFuelLevels,
    apiRefreshDashboard: apiRefreshDashboard,
    apiGenerateDashboardPdf: apiGenerateDashboardPdf,
    apiGenerateFuelMonthlyPdf: apiGenerateFuelMonthlyPdf,
    apiGenerateFuelDailyPdf: apiGenerateFuelDailyPdf,
    apiGenerateInsuranceAnnualPdf: apiGenerateInsuranceAnnualPdf,
    apiGenerateMaintenanceMonthlyPdf: apiGenerateMaintenanceMonthlyPdf,
    apiToggleDriverStatus: apiToggleDriverStatus,
    apiToggleVehicleStatus: apiToggleVehicleStatus,
    createAvailabilityBlock: createAvailabilityBlock,
    closeAvailabilityBlock: closeAvailabilityBlock,
    saveMaintenanceAvailability: saveMaintenanceAvailability
  };
}

function _jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}


function include_(file) {
  return HtmlService.createHtmlOutputFromFile(file).getContent();
}

function _probeHtmlTemplate_(name) {
  try {
    var tpl = HtmlService.createTemplateFromFile(name);
    var now = new Date();
    var tz = 'Asia/Bangkok';

    if (name === 'DashboardReport') {
      // ใส่ค่าจำลองให้ตรงกับที่ _defaultGenerateDashboardPdf_ ใช้
      var month = now.getMonth() + 1;
      var year  = now.getFullYear();
      var monthNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

      tpl.month       = month;
      tpl.year        = year;
      tpl.monthNames  = monthNames;
      tpl.generatedAt = Utilities.formatDate(now, tz, 'dd/MM/yyyy HH:mm');

      tpl.data = {
        totalBookings: 0,
        vehiclesReady: '0/0',
        alerts: 0,
        fuel: 0,
        topDrivers: [],
        topVehicles: []
      };
      tpl.systemName = 'V-Berry Fleet (SelfTest)';
    } else if (name === 'FuelReport') {
      // ใส่ค่าจำลองให้ตรงกับ FuelReport.html
      var year2  = now.getFullYear();
      var month2 = now.getMonth() + 1;

      tpl.title       = 'รายงานสรุปน้ำมัน (SelfTest)';
      tpl.period      = 'เดือน ' + month2 + '/' + (year2 + 543);
      tpl.generatedAt = Utilities.formatDate(now, tz, 'dd/MM/yyyy HH:mm');

      tpl.summary = [];      // ไม่มีข้อมูลจริง ใช้แค่ให้ template รันผ่าน
      tpl.detail  = [];
      tpl.totalLiters = 0;
      tpl.totalCost   = 0;
      tpl.systemName  = 'V-Berry Fleet (SelfTest)';
    }

    var html = tpl.evaluate().getContent();
    return 'OK(' + name + ', len=' + html.length + ')';
  } catch (e) {
    // โยน error กลับให้ selfTest log ต่อ
    throw new Error("Template '" + name + "' error: " + e.message);
  }
}

// ===================== DATA MANAGEMENT =====================
function getMainData() {
  return getMainData_();
}

// ANCHOR: getMainData_
function getMainData_(options) {
  options = options || {};
  const totalStart = Date.now();
  const CK = INITIAL_DATA_CACHE_KEY; 
  const forceRefresh = options.forceRefresh === true || options.skipCache === true;
  
  const cacheReadStart = Date.now();
  const cached = forceRefresh ? null : cacheGetLarge_(CK);
  const cacheReadTime = Date.now() - cacheReadStart;
  
  if (cached) {
    Logger.log('CACHE HIT key=' + CK + ' readMs=' + cacheReadTime + ' totalMs=' + (Date.now() - totalStart));
    Logger.log('[Timing] Cache Read Hit: ' + cacheReadTime + ' ms (total: ' + (Date.now() - totalStart) + ' ms)');
    if (cached && typeof cached === 'object' && cached.ok === true && cached.data) {
      return cached;
    }
    return { ok:true, data:cached };
  }
  Logger.log('CACHE MISS key=' + CK + (forceRefresh ? ' reason=forceRefresh' : '') + ' readMs=' + cacheReadTime);
  Logger.log('[Timing] Cache Read Miss: ' + cacheReadTime + ' ms');
  
  try {
    const settingsStart = Date.now();
    const settings = readAllSettings_();
    const settingsTime = Date.now() - settingsStart;
    Logger.log('[Timing] Read Settings Sheet: ' + settingsTime + ' ms');

    const sheetReadStart = Date.now();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_MAIN_NAME); 
    if (!sh) throw new Error("ไม่พบชีต 'Data' ค่ะ!");
    
    const spreadsheetId = ss.getId();
    const sheetNameA1 = "'" + String(sh.getName()).replace(/'/g, "''") + "'";
    const toA1Col_ = (n) => {
      let s = '';
      while (n > 0) {
        const m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - 1) / 26);
      }
      return s || 'A';
    };
    const lastCol = sh.getLastColumn();
    const lastRow = sh.getLastRow();
    let headers = [];
    let values = [];
    
    const fullRangeA1 = sheetNameA1 + '!A1:' + toA1Col_(lastCol) + lastRow;
    try {
      const fullResp = Sheets.Spreadsheets.Values.get(spreadsheetId, fullRangeA1, {
        majorDimension: 'ROWS',
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'SERIAL_NUMBER'
      });
      const rows = fullResp && fullResp.values ? fullResp.values : [];
      const headerRow = rows[0] || [];
      headers = Array.from({ length: lastCol }, (_, c) => String(headerRow[c] || '').trim());
      
      const rawValues = rows.slice(1);
      const numRows = Math.max(0, lastRow - 1);
      values = Array.from({ length: numRows }, (_, r) => {
        const row = rawValues[r] || [];
        if (row.length >= headers.length) return row;
        return row.concat(Array(headers.length - row.length).fill(''));
      });
    } catch (sheetApiErr) {
      Logger.log('getMainData_ full read fallback to getValues: ' + (sheetApiErr && sheetApiErr.message ? sheetApiErr.message : sheetApiErr));
      headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
      const numRows = Math.max(0, lastRow - 1);
      if (numRows > 0) {
        values = sh.getRange(2, 1, numRows, headers.length).getValues();
      }
    }
    const idx = headerIndex_(headers);
    const sheetReadTime = Date.now() - sheetReadStart;
    Logger.log('[Timing] Read Sheets (Data): ' + sheetReadTime + ' ms');
    
    // 🍓 BERRY FIX: อ่าน Actual Ends Map ก่อน Map Bookings (แก้เป็น getActualEndsMap ไม่มี _)
    const actualEndStart = Date.now();
    const actualEndsMap = getActualEndsMap();
    const actualEndTime = Date.now() - actualEndStart;
    Logger.log('[Timing] Read Sheets (BookingActualEnd): ' + actualEndTime + ' ms');

    const buildBookingsStart = Date.now();
    const seen = new Set(); 
    const startRow = 2; // Data rows start at row 2 (row 1 is header)
    const recentBookingsData = values.map((row, i) => {
      const id = String(row[idx.bookingId] || '').trim();
      if (!id || seen.has(id)) return null;
      seen.add(id);

      const startISO = parseDateToISO_(row[idx.startDate]);
      const baseEndDate = parseDateToISO_(row[idx.endDate]) || startISO;
      const baseEndTime = parseTimeSafe_(row[idx.endTime]);

      const statusRaw = String(row[idx.status] || '').trim().toLowerCase();
      const statusKey = getStatusKeySafe_(statusRaw);
      const isSoftClosed = /(closed|completed|done|finish|ปิด|เสร็จ|จบ)/.test(statusRaw);

      const aEndObj = actualEndsMap[id];
      const useActualEnd = !!(aEndObj && isSoftClosed);
      // ใช้ Actual End เฉพาะงานที่สถานะเป็นงานปิดจริงเท่านั้น (กันข้อมูลค้าง)
      const finalEndDate = useActualEnd ? aEndObj.actualEndDate : baseEndDate;
      const finalEndTime = useActualEnd ? aEndObj.actualEndTime : baseEndTime;
      
      return {
        bookingId: id,
        name: String(row[idx.name]||'').trim(),
        status: statusKey,
        
        plate: String(row[idx.vehicle]||'').trim(), 
        carName: String(row[idx.requestedVehicle]||'').trim(), 
        driver: String(row[idx.driver]||'').trim(),
        fileUrl: String(row[idx.fileUrl]||'').trim(),
        reason: String(row[idx.reason]||'').trim(),

        phone: formatPhoneNumber_(row[idx.phone]),
        position: String(row[idx.position]||'').trim(),
        org: String(row[idx.department]||'').trim(),
        email: String(row[idx.email]||'').trim(),
        
        workType: String(row[idx.workType] || row[idx.jobType] || '').trim(),
        workName: String(row[idx.workName] || row[idx.projectName] || row[idx.project] || row[idx.purpose] || '').trim(),
        
        destination: String(row[idx.destination]||'').trim(),
        carType: String(row[idx.carType]||'').trim(),
        
        startDate: startISO,
        startTime: parseTimeSafe_(row[idx.startTime]),
        endDate: finalEndDate,
        endTime: finalEndTime,
        
        // ส่ง Actual End เฉพาะงานปิดจริง เพื่อไม่ให้ทับสถานะอนุมัติ
        actualEndAt: useActualEnd ? aEndObj.actualEndAtISO : null,
        isSoftClosed: isSoftClosed,
        plannedEndDate: baseEndDate,
        plannedEndTime: baseEndTime,
        
        passengers: String(row[idx.passengers]||'').trim(),
        cancelReason: String(row[idx.cancelReason]||'').trim(),
        
        dateNum: startISO ? new Date(startISO).getTime() : 0,
        rowNumber: startRow + i
      };
    }).filter(Boolean); 

    const sortedBookings = recentBookingsData.sort((a,b) => {
      const aNum = parseInt(a.bookingId) || 0;
      const bNum = parseInt(b.bookingId) || 0;
      return bNum - aNum; 
    });
    const buildBookingsTime = Date.now() - buildBookingsStart;
    Logger.log('[Timing] Build Bookings (normalize/sort): ' + buildBookingsTime + ' ms');

    // 🍓 [BERRY FIX] Merge Availability Blocks into Calendar (Data UI Safe)
    const buildCalendarStart = Date.now();
    try {
       const shAvail = ss.getSheetByName('Availability');
       if(shAvail) {
          const availLastRow = shAvail.getLastRow();
          const availLastCol = shAvail.getLastColumn();
          if (availLastRow > 1 && availLastCol > 0) {
          const availSheetNameA1 = "'" + String(shAvail.getName()).replace(/'/g, "''") + "'";
          const availRangeA1 = availSheetNameA1 + '!A1:' + toA1Col_(availLastCol) + availLastRow;
          let avData = [];
          const availReadStart = Date.now();
          try {
            const availResp = Sheets.Spreadsheets.Values.get(spreadsheetId, availRangeA1, {
              majorDimension: 'ROWS',
              valueRenderOption: 'UNFORMATTED_VALUE',
              dateTimeRenderOption: 'SERIAL_NUMBER'
            });
            avData = (availResp && availResp.values) ? availResp.values : [];
          } catch (sheetApiErr) {
            Logger.log('getMainData_ Availability read fallback to getValues: ' + (sheetApiErr && sheetApiErr.message ? sheetApiErr.message : sheetApiErr));
            avData = shAvail.getRange(1, 1, availLastRow, availLastCol).getValues();
          }
          Logger.log('[Timing] Read Sheets (Availability): ' + (Date.now() - availReadStart) + ' ms');

          const header = avData[0] ||[];
          const col_assignedDriver = header.indexOf('assignedDriver');
          const col_tripPhase = header.indexOf('tripPhase');
          const col_closedBy = header.indexOf('closedBy');
          const col_closedAt = header.indexOf('closedAt');
          const col_closeNote = header.indexOf('closeNote');
          const formatClosedAtForCalendar_ = function(v) {
            if (!v) return { raw: '', text: '', iso: '' };
            var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
            var d = null;
            if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
              d = v;
            } else {
              var n = Number(v);
              if (isFinite(n) && String(v).trim().match(/^\d+(\.\d+)?$/)) {
                d = new Date(Math.round((n - 25569) * 86400 * 1000));
              } else if (typeof _parseAnyDateString_ === 'function') {
                d = _parseAnyDateString_(v);
              }
            }
            if (!d || isNaN(d.getTime())) return { raw: v, text: String(v), iso: String(v) };
            return {
              raw: v,
              text: (typeof _fmtThaiDateTimeBE_ === 'function')
                ? _fmtThaiDateTimeBE_(d)
                : Utilities.formatDate(d, tz, 'dd/MM/yyyy HH:mm น.'),
              iso: Utilities.formatDate(d, tz, "yyyy-MM-dd'T'HH:mm:ssXXX")
            };
          };
          
          for(let i=1; i<avData.length; i++) {
             const resType = String(avData[i][0] || '').trim();
             const resId = String(avData[i][1] || '').trim();
             const reason = String(avData[i][6] || '').trim();
             const isDriver = (resType === 'driver');
             const isRepair = reason.indexOf('ซ่อม') !== -1;
             const tripPhase = (col_tripPhase > -1) ? String(avData[i][col_tripPhase] || '').trim().toLowerCase() : '';
             
             // 🍓 BERRY FIX: Skip driver_block if reason contains "ซ่อม"
             if (isDriver && isRepair && tripPhase !== 'dropoff' && tripPhase !== 'pickup' && tripPhase !== 'pickup_support') {
                 continue; // ข้ามการสร้าง event ในปฏิทิน
             }
             
             // 🍓 BERRY FIX: ควบคุมการทำงานของ block ผ่านคอลัมน์ status
             const col_status = header.indexOf('status');
             const blockStatus = (col_status > -1) ? String(avData[i][col_status] || '').trim().toLowerCase() : '';
             const isClosed = (blockStatus === 'closed');
             const closedAtValue = (col_closedAt > -1) ? avData[i][col_closedAt] : '';
             const closedAtInfo = formatClosedAtForCalendar_(closedAtValue);
              
              const assignedDriverValue = (col_assignedDriver > -1) ? avData[i][col_assignedDriver] : '';

             // 🍓 FIX: detect isAllDay — raw time ว่าง/0/default ถือเป็น all-day จริง
             const rawStartTime = avData[i][3];
             const rawEndTime = avData[i][5];
             const isRawTimeEmpty = function(v) {
               if (v === null || v === undefined || v === '') return true;
               if (typeof v === 'number' && v === 0) return true;
               var sv = String(v).trim();
               return !sv || sv === '0' || sv === '0.00' || sv === '0.0' || sv === '00:00';
             };
             const parsedStartTime = parseTimeSafe_(rawStartTime);
             const parsedEndTime = parseTimeSafe_(rawEndTime);
             const blockIsAllDay = isRawTimeEmpty(rawStartTime) && (isRawTimeEmpty(rawEndTime) || parsedEndTime === '23:59');

             sortedBookings.push({
                bookingId: 'BLK-' + i,
                status: isDriver ? 'driver_block' : 'vehicle_block',
                blockStatus: blockStatus,
                isClosed: isClosed,
                closedBy: (col_closedBy > -1) ? String(avData[i][col_closedBy] || '').trim() : '',
                closedAt: closedAtInfo.raw,
                closedAtText: closedAtInfo.text,
                closedAtISO: closedAtInfo.iso,
                closeNote: (col_closeNote > -1) ? String(avData[i][col_closeNote] || '').trim() : '',
                isAllDay: blockIsAllDay,
                name: resId,          
                driver: isDriver ? resId : '-', 
                plate: isDriver ? '-' : resId,  
                vehicle: isDriver ? '-' : resId,
                destination: '-',     
                place: '-',
                workType: isDriver ? 'ลาพักงาน' : 'ส่งซ่อมบำรุง',
                workName: avData[i][6] || 'งดใช้งาน', 
                project: avData[i][6] || 'งดใช้งาน',
                startDate: parseDateToISO_(avData[i][2]),
                startTime: parsedStartTime,
                endDate: parseDateToISO_(avData[i][4]) || parseDateToISO_(avData[i][2]),
                endTime: parsedEndTime,
                dateNum: new Date(parseDateToISO_(avData[i][2])).getTime(),
                assignedDriver: assignedDriverValue,
                tripPhase: tripPhase
             });
          }
          }
       }
    } catch(ex) {
       Logger.log("Availability Merge Error: " + ex.message + "\nstack: " + ex.stack);
    }
    const buildCalendarTime = Date.now() - buildCalendarStart;
    Logger.log('[Timing] Build Calendar (Availability processing): ' + buildCalendarTime + ' ms');

    const buildDriversStart = Date.now();
    const driversRes = getDriversFromAdmin_(settings);
    const drivers = (driversRes.ok && Array.isArray(driversRes.drivers)) ? driversRes.drivers :[];
    const buildDriversTime = Date.now() - buildDriversStart;
    Logger.log('[Timing] Build Drivers (Admin sheet): ' + buildDriversTime + ' ms');
    
    const buildVehiclesStart = Date.now();
    const platesRes = getAllVehiclePlatesFromSettings(settings);
    const vehicles  = platesRes.ok ? {
      vans: platesRes.vans ||[],
      trucks: platesRes.trucks ||[],
      all: platesRes.all ||[]
    } : { vans:[], trucks: [], all:[] };
    const buildVehiclesTime = Date.now() - buildVehiclesStart;
    Logger.log('[Timing] Build Vehicles (Vehicles sheet): ' + buildVehiclesTime + ' ms');
    
    const buildDashboardStart = Date.now();
    // ดึงรายชื่อโครงการที่ไม่ซ้ำมาทำ Auto-complete (ใช้อิงจาก workName)
    const projects = Array.from(new Set(sortedBookings
      .map(r => String(r.workName || '').trim())
      .filter(Boolean)));
    const buildDashboardTime = Date.now() - buildDashboardStart;
    Logger.log('[Timing] Build Dashboard (Projects list): ' + buildDashboardTime + ' ms');
      
    const payload = {
      ok: true,
      data: {
        bookings: sortedBookings,
        isPartial: false,
        totalBookings: lastRow - 1,
        drivers,
        projects,
        vehicles,
        headerIndexes: idx,
        spreadsheetId: spreadsheetId
      }
    };
    
    const cacheWriteStart = Date.now();
    cachePutLarge_(CK, payload, CACHE_SEC || 120); 
    const cacheWriteTime = Date.now() - cacheWriteStart;
    Logger.log('[Timing] Cache Write: ' + cacheWriteTime + ' ms');
    
    Logger.log('[Timing] Total Time (Cache Miss): ' + (Date.now() - totalStart) + ' ms');
    return payload;
    
  } catch (e) {
    Logger.log('getMainData_ ERROR: ' + e.stack);
    return { ok:false, error:e.message };
  }
}


function fixEmptyFileColumn() {
  // Keep List:
  // - ทำงานกับชีต Data
  // - วนทั้งคอลัมน์ File แล้ว setValues ครั้งเดียว
  // - return {ok, updated} เหมือนเดิม

  Logger.log('===== fixEmptyFileColumn START =====');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_MAIN_NAME);
  if (!sh) throw new Error('ไม่พบชีต Data');

  var lastRow = sh.getLastRow();
  if (lastRow < 2) {
    Logger.log('INFO: No data rows');
    return { ok: true, updated: 0 };
  }

  // CHANGE: หา index คอลัมน์ File จาก header (กันชีตขยับคอลัมน์)
  var headers = sh.getRange(HEADER_ROW, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h || '').trim(); });
  var idx = headerIndex_(headers);
  if (idx.fileUrl === undefined || idx.fileUrl === -1) {
    throw new Error('ไม่พบคอลัมน์ File/ไฟล์แนบ ในชีต Data');
  }

  var col = idx.fileUrl + 1; // 1-based
  var rng = sh.getRange(2, col, lastRow - 1, 1);
  var vals = rng.getValues();

  var updated = 0;
  for (var i = 0; i < vals.length; i++) {
    var v = String(vals[i][0] == null ? '' : vals[i][0]).trim();

    // CHANGE: เป้าหมายคือ “ค่าว่าง” ไม่ใช่ "-"
    // - ถ้าเป็น "-" (ของเก่า) ให้ล้างเป็นว่าง
    // - ถ้าว่างอยู่แล้ว ไม่ต้องทำอะไร
    if (v === '-' || v === '–' || v === '—') { // CHANGE
      vals[i][0] = '';                          // CHANGE
      updated++;                                // CHANGE
    }
  }

  if (updated > 0) {
    rng.setValues(vals);
  }

  Logger.log('✅ Normalized File cells: "-" => "" count=' + updated); // CHANGE
  Logger.log('===== fixEmptyFileColumn END =====');
  return { ok: true, updated: updated };
}


function normalizeCarTypeKeyFromUi(raw) {
  var s = String(raw || '').trim().toLowerCase();

  // รองรับทั้งค่าจาก UI (van/truck) และค่าจากชีต ("รถตู้", "รถบรรทุก/รถกระบะบรรทุก")
  if (!s) return '';

  if (s === 'van') return 'van';
  if (s === 'truck') return 'truck';

  if (s.indexOf('รถตู้') > -1 || s.indexOf('ตู้') > -1) return 'van';
  if (s.indexOf('รถบรรทุก') > -1 || s.indexOf('บรรทุก') > -1 || s.indexOf('กระบะ') > -1) return 'truck';

  return '';
}

function checkPendingBookingOverlap(payload) {
  try {
    payload = payload || {};

    var reqStart = parseDateTime_(parseDateToISO_(payload.startDate), parseTimeSafe_(payload.startTime));
    var reqEnd = parseDateTime_(parseDateToISO_(payload.endDate || payload.startDate), parseTimeSafe_(payload.endTime));
    if (!reqStart || !reqEnd || isNaN(reqStart.getTime()) || isNaN(reqEnd.getTime())) {
      return { ok: true, hasPending: false, count: 0, items: [] };
    }

    var requestedTypes = String(payload.carType || '')
      .split(',')
      .map(normalizeCarTypeKeyFromUi)
      .filter(Boolean);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_MAIN_NAME);
    if (!sh || sh.getLastRow() < 2) return { ok: true, hasPending: false, count: 0, items: [] };

    var headers = _sheetApiGetValues_(sh, 1, 1, 1, sh.getLastColumn(), 'checkPendingBookingOverlap headers')[0]
      .map(function(h) { return String(h || '').trim(); });
    var idx = headerIndex_(headers);
    if (idx.status < 0 || idx.startDate < 0 || idx.startTime < 0 || idx.endDate < 0 || idx.endTime < 0) {
      return { ok: false, error: 'ไม่พบคอลัมน์จำเป็นสำหรับตรวจคำขอรออนุมัติ' };
    }

    var values = _sheetApiGetValues_(sh, 2, 1, sh.getLastRow() - 1, headers.length, 'checkPendingBookingOverlap rows');
    var items = [];

    function clean(v) { return String(v == null ? '' : v).trim(); }
    function hasTypeOverlap(rowTypeRaw) {
      if (!requestedTypes.length) return true;
      var rowTypes = clean(rowTypeRaw).split(',').map(normalizeCarTypeKeyFromUi).filter(Boolean);
      if (!rowTypes.length) return true;
      return rowTypes.some(function(t) { return requestedTypes.indexOf(t) > -1; });
    }

    for (var i = 0; i < values.length; i++) {
      var row = values[i] || [];
      var status = (typeof getStatusKeySafe_ === 'function') ? getStatusKeySafe_(row[idx.status]) : clean(row[idx.status]).toLowerCase();
      if (status !== 'pending') continue;
      if (!hasTypeOverlap(row[idx.carType])) continue;

      var rowStartISO = parseDateToISO_(row[idx.startDate]);
      var rowStart = parseDateTime_(rowStartISO, parseTimeSafe_(row[idx.startTime]));
      var rowEnd = parseDateTime_(parseDateToISO_(row[idx.endDate]) || rowStartISO, parseTimeSafe_(row[idx.endTime]));
      if (!rowStart || !rowEnd || isNaN(rowStart.getTime()) || isNaN(rowEnd.getTime())) continue;
      if (!isOverlapping_(reqStart, reqEnd, rowStart, rowEnd)) continue;

      items.push({
        bookingId: clean(row[idx.bookingId]),
        name: clean(row[idx.name]),
        carType: clean(row[idx.carType]),
        vehicleCount: clean(row[idx.vehicleCount] || '1'),
        startDate: parseDateToISO_(row[idx.startDate]) || clean(row[idx.startDate]),
        startTime: parseTimeSafe_(row[idx.startTime]),
        endDate: parseDateToISO_(row[idx.endDate]) || clean(row[idx.endDate]),
        endTime: parseTimeSafe_(row[idx.endTime])
      });
    }

    return { ok: true, hasPending: items.length > 0, count: items.length, items: items.slice(0, 5) };
  } catch (e) {
    Logger.log('checkPendingBookingOverlap Error: ' + (e && e.stack ? e.stack : e));
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}


// ===================== BOOKING MANAGEMENT =====================
// --- Helper Functions (Global Scope for access by other functions if needed) ---

function normalizePhoneText_(raw) {
  let s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  s = s.replace(/[^\d+]/g, '');
  if (s.indexOf('+66') === 0) s = '0' + s.substring(3);
  else if (s.indexOf('66') === 0 && s.length >= 11) s = '0' + s.substring(2);
  s = s.replace(/\D/g, '');
  return s;
}

function toOptText_(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s || s === '-' || s === '–' || s === '—') return "";
  return s;
}

function toHHmm_(v) {
  if (v == null || v === '') return '';
  const tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
  if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, tz, 'HH:mm');
  const s = String(v).trim();
  // Try HH:mm:ss or HH:mm
  let m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return s;
  return String(m[1]).padStart(2, '0') + ':' + m[2];
}

function coerceDateOnly_(v) {
  const tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(v.getTime())) {
    // Return Date object set to midnight in script TZ
    const iso = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
    return Utilities.parseDate(iso, tz, 'yyyy-MM-dd');
  }
  const s = String(v).trim();
  
  // Try ISO YYYY-MM-DD
  let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/); // Allow - or /
  if (m) {
    return Utilities.parseDate(`${m[1]}-${m[2]}-${m[3]}`, tz, 'yyyy-MM-dd');
  }
  
  // Try DMY (Thai) dd/mm/yyyy or dd-mm-yyyy
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (m) {
     let y = parseInt(m[3]);
     // Fix BE year if > 2400
     if(y > 2400) y -= 543; 
     // Format as ISO string then parse back to Date object to ensure correct date
     // Note: Using ISO string YYYY-MM-DD for parsing is safer
     return Utilities.parseDate(`${y}-${m[2]}-${m[1]}`, tz, 'yyyy-MM-dd');
  }
  return '';
}

// ANCHOR: sheetDateTextForCell
// แปลงวันที่ทุกรูปแบบ (Date / yyyy-MM-dd / dd/MM/yyyy) เป็น text '30/04/2026
// prefix ' บังคับ Sheets เก็บเป็น text ป้องกัน Wed Apr... GMT string
function sheetDateTextForCell(v) {
  var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
  var d = (typeof coerceDateOnlyInTz === 'function')
    ? coerceDateOnlyInTz(v, tz)
    : coerceDateOnly_(v);
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  return "'" + Utilities.formatDate(d, tz, 'dd/MM/yyyy');
}

// ANCHOR: selfTestSheetDateTextForCell
function selfTestSheetDateTextForCell() {
  var cases = [
    '2026-04-30',
    '30/04/2026',
    new Date(2026, 3, 30, 21, 0, 0)
  ];
  cases.forEach(function(v) {
    Logger.log(String(v) + ' => ' + sheetDateTextForCell(v));
  });
  return { ok: true };
}

function createBookingAndBroadcast(payload) {
  const cache = CacheService.getScriptCache();
  const sigBase = String(payload.name) + String(payload.startDate) + String(payload.startTime) + String(payload.workName || payload.projectName || payload.project || '');
  const signature = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, sigBase));

  if (cache.get(signature)) {
    return { ok: false, error: "รายการจองนี้กำลังถูกประมวลผลหรือเพิ่งส่งเข้ามาเมื่อครู่ค่ะ" };
  }
  cache.put(signature, "processing", 60);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: "ระบบทำงานหนัก รบกวนลองกดอีกครั้งนะคะ" };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_MAIN_NAME);
    if (!sh) throw new Error("ไม่พบชีตชื่อ 'Data'");

    const headers = _sheetApiGetValues_(sh, 1, 1, 1, sh.getLastColumn(), 'createBookingAndBroadcast headers')[0]
      .map(h => String(h || '').trim());
    const idx = headerIndex_(headers);
    const rowData = new Array(headers.length).fill("");
    const setV = (key, val) => { if (idx[key] !== undefined && idx[key] !== -1) rowData[idx[key]] = val; };

    // 🍓 [STEP 3] ใช้ Key ใหม่ workType และ workName
    let workType = String(payload.workType || payload.jobType || "").trim();
    let workName = String(payload.workName || payload.projectName || "").trim();

    const requestedCount = parseInt(payload.vehicleCount, 10) || 1;
    const availabilityCheck = getAvailableVehicles({
      startDate: payload.startDate,
      endDate: payload.endDate || payload.startDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      carTypes: (payload.carType || '').split(',')
    });

    if (availabilityCheck.ok) {
      const availableCount = availabilityCheck.vehicles.filter(v => v.available).length;
      const maxAllowed = Math.min(5, availableCount);
      if (requestedCount > maxAllowed) {
        return {
          ok: false,
          error: `ขออภัยค่ะ รถว่างไม่พอ (ขณะนี้เหลือว่าง ${maxAllowed} คัน แต่พี่ขอมา ${requestedCount} คัน) รบกวนปรับจำนวนหรือช่วงเวลาใหม่นะคะ`
        };
      }
    }

    const bookingId = reserveNextBookingId();
    const sIso = parseDateToISO_(payload.startDate);
    const eIso = parseDateToISO_(payload.endDate || payload.startDate);

    const buildDateObj = (iso) => {
      if (!iso) return null;
      const p = iso.split('-');
      return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]), 0, 0, 0);
    };

    const sDateObj = buildDateObj(sIso);
    const eDateObj = buildDateObj(eIso);

    const dayDiff = (eDateObj - sDateObj) / (1000 * 60 * 60 * 24);
    if (dayDiff > 30) {
      return { ok: false, error: `ไม่สามารถจองยาวเกิน 30 วันได้ค่ะ (คุณเลือก ${dayDiff} วัน) กรุณาตรวจสอบวันที่อีกครั้ง` };
    }

    const sTimeStr = parseTimeSafe_(payload.startTime);
    const eTimeStr = parseTimeSafe_(payload.endTime);

    const carTypeMap = { 'van': 'รถตู้', 'truck': 'รถบรรทุก' };
    const typeLabel = (payload.carType || '').split(',')
      .map(t => carTypeMap[String(t).trim().toLowerCase()] || t)
      .filter(Boolean).join(' + ');

    // 🍓 [STEP 6] หยอดข้อมูลลงตัวแปรแถว (ใช้ Key ใหม่)
    setV('bookingId', bookingId);
    setV('status', 'pending');
    setV('name', payload.name);
    setV('phone', payload.phone ? ("'" + String(payload.phone).replace(/\D/g, '')) : "");
    setV('position', payload.position || "-");
    setV('department', payload.department || payload.org || "-");
    setV('email', payload.email || "");

    setV('workType', workType);
    setV('workName', workName);

    setV('destination', payload.place || payload.destination);
    setV('carType', typeLabel);
    setV('vehicleCount', requestedCount);
    setV('startDate', sheetDateTextForCell(payload.startDate));  // FIX: text dd/MM/yyyy
    setV('startTime', sTimeStr);
    setV('endDate', sheetDateTextForCell(payload.endDate || payload.startDate));  // FIX: text dd/MM/yyyy
    setV('endTime', eTimeStr);
    setV('passengers', payload.passengers);

    if (!payload.fileUrl && payload.fileData && payload.fileName) {
      try {
        var dataStr = String(payload.fileData);
        var base64 = (dataStr.indexOf(',') !== -1) ? dataStr.split(',')[1] : dataStr;
        var bytes = Utilities.base64Decode(base64);
        var mime = payload.fileMime || 'application/octet-stream';
        var blob = Utilities.newBlob(bytes, mime, payload.fileName);

        var up = DriveApp.createFile(blob);
        up.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        payload.fileUrl = up.getUrl();
      } catch (fileErr) {
        Logger.log("Upload file error: " + (fileErr && fileErr.stack ? fileErr.stack : fileErr));
        payload.fileUrl = "";
      }
    }

    setV('fileUrl', payload.fileUrl || payload.file || "");
    setV('reason', payload.reason || "");

    const r = _sheetApiAppendRow_(sh, rowData, { label: 'createBookingAndBroadcast append' });
    try { clearInitialCache_(); } catch (e) {}
    try {
      const fmtDate = 'dd/MM/yyyy';
      const formatSpecs = [];
      if (idx.startDate !== -1) formatSpecs.push({ colIndex: idx.startDate, type: 'DATE', pattern: fmtDate });
      if (idx.endDate !== -1) formatSpecs.push({ colIndex: idx.endDate, type: 'DATE', pattern: fmtDate });
      if (idx.startTime !== -1) formatSpecs.push({ colIndex: idx.startTime, type: 'TEXT', pattern: '@' });
      if (idx.endTime !== -1) formatSpecs.push({ colIndex: idx.endTime, type: 'TEXT', pattern: '@' });
      if (idx.phone !== -1) formatSpecs.push({ colIndex: idx.phone, type: 'TEXT', pattern: '@' });
      _sheetApiApplyFormatsForRow_(sh, r, formatSpecs);
    } catch (e) {}

    if (!payload.noTelegram) {
      const notifyPayload = {
        ...payload,
        bookingId: bookingId,
        workType: workType,
        workName: workName,
        status: 'pending',
        vehicleCount: requestedCount,
        carType: typeLabel,
        startDate: sDateObj,
        endDate: eDateObj,
        fileUrl: payload.fileUrl || payload.file || "" 
      };
      sendTelegramNotify(notifyPayload, payload.testMode === true);
    }

    return { ok: true, id: bookingId, message: "บันทึกข้อมูลการจองสำเร็จแล้วค่ะ 🎉" };

  } catch (e) {
    Logger.log("Create Error: " + e.stack);
    return { ok: false, error: "เกิดข้อผิดพลาด: " + e.message };
  } finally {
    lock.releaseLock();
  }
}





/**
 * 🛠️ ฟังก์ชันเสริม: ปรับวันที่เป็น พ.ศ. dd/MM/yyyy
 */
function normalizeDateToDMY_(v) {
  if (!v) return "";
  var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
  var dateObj;

  if (v instanceof Date) {
    dateObj = v;
  } else {
    var s = String(v).trim();
    if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
      var p = s.split('-');
      dateObj = new Date(p[0], p[1] - 1, p[2]);
    } else {
      dateObj = new Date(s);
    }
  }

  if (dateObj && !isNaN(dateObj.getTime())) {
    var year = parseInt(Utilities.formatDate(dateObj, tz, 'yyyy'), 10);
    var finalYear = year < 2400 ? year + 543 : year;
    return Utilities.formatDate(dateObj, tz, 'dd/MM/') + finalYear;
  }
  return String(v);
}

function admin_resetBookingIdCounter() {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000); // รอ 15 วินาที
  try {
    Logger.log('--- 🔧 เริ่มต้น Reset Booking ID Counter ---');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_MAIN_NAME);
    if (!sh) {
      Logger.log(`❌ ไม่พบชีต '${SHEET_MAIN_NAME}'`);
      throw new Error(`ไม่พบชีต '${SHEET_MAIN_NAME}'`);
    }

    // 1. ค้นหา ID สูงสุดในชีต (ใช้ฟังก์ชันเดิมที่เรามี)
    const maxInSheet = detectMaxBookingId_(sh);
    Logger.log(`ℹ️ ID สูงสุดที่พบในชีต Data คือ: ${maxInSheet}`);

    // 2. ดึง ID ที่เก็บไว้ใน Counter
    const props = PropertiesService.getScriptProperties();
    const lastUsed = Number(props.getProperty('COUNTER_BOOKING_ID') || '0');
    Logger.log(`ℹ️ ID ที่เก็บไว้ใน Counter (Properties) คือ: ${lastUsed}`);

    if (maxInSheet < 100) {
        // ป้องกันกรณีชีตว่าง
        Logger.log('⚠️ คำเตือน: ID สูงสุดในชีตน้อยกว่า 100 (อาจจะยังไม่มีข้อมูล) - กำลังยกเลิกการ Reset');
        return { ok: false, error: 'Max ID in sheet is too low, aborting reset.' };
    }

    // 3. เขียนทับ Counter ด้วยค่าที่ถูกต้อง (ที่หาได้จากในชีต)
    props.setProperty('COUNTER_BOOKING_ID', String(maxInSheet));
    
    // 4. ตรวจสอบ
    const finalValue = props.getProperty('COUNTER_BOOKING_ID');
    Logger.log(`✅ Reset สำเร็จ! Counter ถูกตั้งค่าเป็น: ${finalValue}`);
    
    Logger.log('--- 🏁 Reset Booking ID Counter เสร็จสิ้น ---');
    
    return { ok: true, newCounterValue: finalValue };

  } catch(e) {
    Logger.log(`❌ เกิดข้อผิดพลาด أثناء Reset: ${e.stack}`);
    return { ok: false, error: e.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ===== [ANCHOR] Telegram Utilities (new) =====
// โหลด key-value จากชีต setting (คอลัมน์ A:B)
function getSettingMap_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('setting');
  if (!sh) return {};
  var last = sh.getLastRow();
  if (last < 1) return {};

  var vals = sh.getRange(1, 1, last, 2).getValues();
  var map = {};
  for (var i = 0; i < vals.length; i++) {
    var k = String(vals[i][0] || '').trim();
    var v = String(vals[i][1] || '').trim();
    if (k) map[k] = v;
  }
  return map;
}

function getTelegramConfig() {
  var map = (typeof getSettingMap === 'function')
    ? getSettingMap()
    : (typeof getSettingMap_ === 'function' ? getSettingMap_() : {});

  var token = String(map['Telegram Bot Token'] || map['Telegram Token'] || map['TELEGRAM_TOKEN'] || '').trim();
  var chatId = String(map['Telegram Chat Id'] || map['Telegram Chat ID'] || map['TELEGRAM_CHAT_ID'] || '').trim();

  if (!token || !chatId) {
    try {
      var p = PropertiesService.getScriptProperties();
      token = token || String(p.getProperty('TELEGRAM_TOKEN') || '').trim();
      chatId = chatId || String(p.getProperty('TELEGRAM_CHAT_ID') || '').trim();
    } catch (_) {}
  }

  return { token: token, chatId: chatId };
}


function postTelegram(text, opts) {
  var cfg = getTelegramConfig(); // ✅ ต้องไม่มี underscore
  if (!cfg.token || !cfg.chatId) {
    return { ok: false, error: 'TELEGRAM not configured (setting: Telegram Bot Token / Telegram Chat Id)' };
  }

  var url = 'https://api.telegram.org/bot' + cfg.token + '/sendMessage';
  var payload = {
    chat_id: cfg.chatId,
    text: String(text || ''),
    parse_mode: (opts && opts.parse_mode) ? String(opts.parse_mode) : 'HTML',
    disable_web_page_preview: !!(opts && (opts.disable_preview || opts.disable_web_page_preview))
  };

  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var code = res.getResponseCode();
    var body = res.getContentText();
    Logger.log('Telegram RESP ' + code + ': ' + body);

    return { ok: code >= 200 && code < 300, code: code, body: body };
  } catch (e) {
    Logger.log('postTelegram ERROR: ' + (e && e.stack ? e.stack : e));
    return { ok: false, error: e.message };
  }
}

function sendTelegramOnce(text, options) {
  options = options || {};

  var dedupeKey = String(options.dedupeKey || '').trim();
  var parseMode = options.parse_mode || options.parseMode || 'HTML';
  var disablePreview = (options.disable_preview !== undefined) ? !!options.disable_preview : true;
  var force = !!options.force; // ✅ support force

  if (!String(text || '').trim()) return { ok: false, error: 'Empty telegram text' };
  if (!dedupeKey) return { ok: false, error: 'Missing dedupeKey' };

  var lock = LockService.getScriptLock();
  var gotLock = false;

  try {
    gotLock = lock.tryLock(15000);
    if (!gotLock) return { ok: false, error: 'Lock timeout (telegram dedupe busy)' };

    var props = PropertiesService.getScriptProperties();
    var sentKey = 'TG_SENT_' + dedupeKey;
    var existing = props.getProperty(sentKey);

    // ✅ skip only when not forcing
    if (existing && !force) {
      return {
        ok: true,
        skipped: true,
        dedupeKey: dedupeKey,
        reason: 'already_sent',
        at: existing
      };
    }

    // ✅ Resolve sender function
    var sender = null;
    if (typeof postTelegram === 'function') sender = postTelegram;
    else if (typeof sendTelegram === 'function') sender = sendTelegram;
    else if (typeof postTelegram_ === 'function') sender = postTelegram_;

    if (!sender) {
      return { ok: false, error: 'Missing telegram sender function: postTelegram / sendTelegram / postTelegram_' };
    }

    var res = sender(text, {
      parse_mode: parseMode,
      disable_preview: disablePreview
    });

    var ok = !!(res && res.ok);

    // ✅ mark as sent only when telegram ok
    if (ok) {
      props.setProperty(sentKey, new Date().toISOString());
    }

    return {
      ok: ok,
      forced: force,
      dedupeKey: dedupeKey,
      response: res || null
    };

  } catch (e) {
    return { ok: false, error: e.message };

  } finally {
    try { if (gotLock) lock.releaseLock(); } catch (_) {}
  }
}

// ANCHOR: ForceThaiBuddhistDateDisplay
function forceThaiBuddhistDateDisplay() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_MAIN_NAME);
  if (!sh) throw new Error("ไม่พบชีตชื่อ 'Data'");

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(h => String(h || '').trim());
  const idx = headerIndex_(headers);

  if (idx.startDate === undefined || idx.endDate === undefined) {
    throw new Error('ไม่พบคอลัมน์วันเริ่มต้น/วันสิ้นสุด');
  }

  // CHANGE: พยายามตั้ง locale เป็นไทย (ถ้าโดเมนอนุญาต)
  try {
    const cur = ss.getSpreadsheetLocale();
    if (cur !== 'th_TH') {
      ss.setSpreadsheetLocale('th_TH'); // CHANGE
      Logger.log('Spreadsheet locale set to th_TH');
    }
  } catch (e) {
    Logger.log('Locale change blocked by domain: ' + e.message);
  }

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: true, rows: 0 };

  const fmtBE = 'dd/MM/yyyy';
  const fmtFallback = 'dd/MM/yyyy';

  const rows = lastRow - 1;

  // CHANGE: ฟอร์แมตทั้งคอลัมน์ (ไม่แตะค่า Date)
  try {
    sh.getRange(2, idx.startDate + 1, rows, 1).setNumberFormat(fmtBE);
    sh.getRange(2, idx.endDate + 1, rows, 1).setNumberFormat(fmtBE);
  } catch (e) {
    sh.getRange(2, idx.startDate + 1, rows, 1).setNumberFormat(fmtFallback);
    sh.getRange(2, idx.endDate + 1, rows, 1).setNumberFormat(fmtFallback);
  }

  SpreadsheetApp.flush();
  return { ok: true, rows: rows };
}

// ANCHOR: NormalizeDateOnlyColumnsFull
function normalizeDateOnlyColumns(opt) {
  opt = opt || {};
  var dryRun = opt.dryRun !== false; // default true
  var limit = Number(opt.limit || 10000);
  var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_MAIN_NAME);
  if (!sh) throw new Error("ไม่พบชีตชื่อ 'Data'");

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h || '').trim(); });
  var idx = headerIndex_(headers);

  if (idx.startDate === undefined || idx.startDate === -1) throw new Error('ไม่พบ header วันเริ่มต้น');
  if (idx.endDate === undefined || idx.endDate === -1) throw new Error('ไม่พบ header วันสิ้นสุด');

  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: true, dryRun: dryRun, scanned: 0, changed: 0, samples: [] };

  // CHANGE: สแกนทั้งชีตจากแถว 2 ไล่ลงมา (กันพลาดเหมือนเคสที่ sample ไปอยู่ row 2-19)
  var scanN = Math.min(limit, lastRow - 1);
  var startRow = 2;

  var range = sh.getRange(startRow, 1, scanN, sh.getLastColumn());
  var values = range.getValues();

  function isDateObj(v) { return (v instanceof Date) && !isNaN(v.getTime()); }
  function hhmmss(v) { return isDateObj(v) ? Utilities.formatDate(v, tz, 'HH:mm:ss') : ''; }
  function toDateOnly(v) {
    if (!isDateObj(v)) return null;
    var iso = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
    return Utilities.parseDate(iso, tz, 'yyyy-MM-dd'); // 00:00
  }

  var changed = 0;
  var samples = [];

  for (var i = 0; i < values.length; i++) {
    var rowIdx = startRow + i;

    var sd = values[i][idx.startDate];
    var ed = values[i][idx.endDate];

    var sdTime = hhmmss(sd);
    var edTime = hhmmss(ed);

    var needSd = (sdTime && sdTime !== '00:00:00');
    var needEd = (edTime && edTime !== '00:00:00');

    if (needSd || needEd) {
      changed++;
      var bid = (idx.bookingId !== undefined && idx.bookingId !== -1) ? values[i][idx.bookingId] : '';

      if (samples.length < 15) {
        samples.push({
          row: rowIdx,
          bookingId: String(bid || ''),
          startWas: isDateObj(sd) ? Utilities.formatDate(sd, tz, 'dd/MM/yyyy HH:mm:ss') : String(sd),
          endWas: isDateObj(ed) ? Utilities.formatDate(ed, tz, 'dd/MM/yyyy HH:mm:ss') : String(ed)
        });
      }

      if (!dryRun) {
        if (needSd) values[i][idx.startDate] = toDateOnly(sd);
        if (needEd) values[i][idx.endDate] = toDateOnly(ed);
      }
    }
  }

  Logger.log('normalizeDateOnlyColumns: dryRun=' + dryRun + ' scanned=' + scanN + ' changed=' + changed);
  Logger.log('samples=' + JSON.stringify(samples));

  if (!dryRun && changed > 0) {
    range.setValues(values);

    // CHANGE: ตั้ง format ให้เป็นวันล้วน (แสดงผลไทย)
    var fmtBE = 'dd/MM/yyyy';
    var fmtFallback = 'dd/MM/yyyy';
    try {
      sh.getRange(2, idx.startDate + 1, lastRow - 1, 1).setNumberFormat(fmtBE);
      sh.getRange(2, idx.endDate + 1, lastRow - 1, 1).setNumberFormat(fmtBE);
    } catch (e) {
      sh.getRange(2, idx.startDate + 1, lastRow - 1, 1).setNumberFormat(fmtFallback);
      sh.getRange(2, idx.endDate + 1, lastRow - 1, 1).setNumberFormat(fmtFallback);
    }

    SpreadsheetApp.flush();
  }

  return { ok: true, dryRun: dryRun, scanned: scanN, changed: changed, samples: samples };
}



// ANCHOR: RunNormalizeDateOnlyAllFull
function runNormalizeDateOnlyAllFull() {
  // CHANGE: รันแก้จริงทั้งชีต (แก้เฉพาะวันเริ่มต้น/วันสิ้นสุดเท่านั้น)
  return normalizeDateOnlyColumns({
    dryRun: false,
    limit: 10000
  });
}



// ===== Thai DateTime: DD/MM/พ.ศ. HH:mm น. OR "-" =====
function formatThaiDateTime_(dateText, timeText) {
  var tz = Session.getScriptTimeZone() || (typeof TZ !== 'undefined' ? TZ : 'Asia/Bangkok');

  function pad2(n) { return String(n).padStart(2, '0'); }
  function isValidHM_(hh, mm) {
    return isFinite(hh) && isFinite(mm) && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
  }

  function parseDate_(d) {
    if (typeof normalizeDateInputToDate_ === 'function') {
      return normalizeDateInputToDate_(d);
    }
    return null;
  }

  var dt = parseDate_(dateText);
  if (!(dt instanceof Date) || isNaN(dt.getTime())) return '-';

  var adYear = dt.getFullYear();
  var beYear = (adYear < 2400) ? (adYear + 543) : adYear;

  var datePart = Utilities.formatDate(dt, tz, 'dd/MM/') + beYear;

  function normalizeTimeStr_(s) {
    s = String(s == null ? '' : s).trim();
    if (!s || s === '-') return '';

    s = s.replace(/น\.\s*$/i, '').trim();

    var onlyH = s.match(/^(\d{1,2})$/);
    if (onlyH) {
      var hh0 = Number(onlyH[1]);
      if (!isValidHM_(hh0, 0)) return '';
      return pad2(hh0) + ':00';
    }

    var m = s.match(/^(\d{1,2})[:.](\d{1,2})(?::(\d{1,2}))?$/);
    if (m) {
      var hh = Number(m[1]);
      var mm = Number(m[2]);
      if (!isValidHM_(hh, mm)) return '';
      return pad2(hh) + ':' + pad2(mm);
    }

    if (typeof parseTimeSafe_ === 'function') {
      var r = String(parseTimeSafe_(s) || '').trim();
      if (r) return normalizeTimeStr_(r);
    }
    return '';
  }

  function timeFromSerial_(num) {
    if (typeof num !== 'number' || !isFinite(num)) return '';
    if (num < 0) return '';

    num = num % 1;
    var totalMinutes = Math.round(num * 24 * 60);
    if (!isFinite(totalMinutes)) return '';

    if (totalMinutes >= 24 * 60) totalMinutes = 24 * 60 - 1;
    if (totalMinutes < 0) totalMinutes = 0;

    var hh = Math.floor(totalMinutes / 60);
    var mi = totalMinutes % 60;
    if (!isValidHM_(hh, mi)) return '';
    return pad2(hh) + ':' + pad2(mi);
  }

  function coerceHHmm_(t) {
    if (t == null || t === '' || t === '-') return '';

    if (Object.prototype.toString.call(t) === '[object Date]' && !isNaN(t.getTime())) {
      return Utilities.formatDate(t, tz, 'HH:mm');
    }
    if (typeof t === 'number' && isFinite(t)) return timeFromSerial_(t);
    return normalizeTimeStr_(t);
  }

  var hhmm = '';
  try {
    hhmm = coerceHHmm_(timeText);
    if (hhmm && !/^\d{2}:\d{2}$/.test(hhmm)) hhmm = '';
  } catch (_) {}

  return datePart + ' ' + (hhmm ? (hhmm + ' น.') : '-');
}

// ANCHOR: CoerceDateOnlyInTz
function coerceDateOnlyInTz(v, tzOpt) {
  // CHANGE: centralize date-only coercion for Data sheet write
  var tz = tzOpt || (Session.getScriptTimeZone() || 'Asia/Bangkok');

  if (v == null || v === '') return '';

  // If already Date -> strip time in TZ
  if (v instanceof Date && !isNaN(v.getTime())) {
    var iso0 = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
    return Utilities.parseDate(iso0, tz, 'yyyy-MM-dd');
  }

  var s = String(v).trim();
  if (!s) return '';

  // accept "yyyy-MM-dd" or "yyyy-MM-ddTHH:mm:ss" -> take date part
  var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    var isoDate = iso[1] + '-' + iso[2] + '-' + iso[3];
    return Utilities.parseDate(isoDate, tz, 'yyyy-MM-dd');
  }

  // accept "dd/MM/yyyy" or "dd/MM/BBBB"
  var dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    var dd = Number(dmy[1]), mm = Number(dmy[2]), yy = Number(dmy[3]);
    if (yy >= 2400) yy -= 543;
    var iso2 = String(yy) + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
    return Utilities.parseDate(iso2, tz, 'yyyy-MM-dd');
  }

  // fallback (best-effort) -> normalize by formatting in TZ
  var d = new Date(s);
  if (!isNaN(d.getTime())) {
    var iso3 = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    return Utilities.parseDate(iso3, tz, 'yyyy-MM-dd');
  }

  return '';
}

// ANCHOR: NormalizeDateOnlyByBookingId
function normalizeDateOnlyByBookingId(opt) {
  opt = opt || {};
  var bookingId = String(opt.bookingId || '').trim();
  var dryRun = opt.dryRun !== false; // default true
  var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
  if (!bookingId) throw new Error('bookingId is required');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_MAIN_NAME);
  if (!sh) throw new Error("ไม่พบชีตชื่อ 'Data'");

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) {
    return String(h || '').trim();
  });
  var idx = headerIndex_(headers);

  if (idx.bookingId === undefined || idx.bookingId === -1) throw new Error('ไม่พบ header Booking ID');
  if (idx.startDate === undefined || idx.startDate === -1) throw new Error('ไม่พบ header วันเริ่มต้น');
  if (idx.endDate === undefined || idx.endDate === -1) throw new Error('ไม่พบ header วันสิ้นสุด');

  var lastRow = sh.getLastRow();
  if (lastRow < 2) throw new Error('no data rows');

  var ids = sh.getRange(2, idx.bookingId + 1, lastRow - 1, 1).getValues();
  var targetRow = -1;
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0] || '').trim() === bookingId) { targetRow = i + 2; break; }
  }
  if (targetRow < 2) throw new Error('bookingId not found: ' + bookingId);

  var sd = sh.getRange(targetRow, idx.startDate + 1).getValue();
  var ed = sh.getRange(targetRow, idx.endDate + 1).getValue();

  function isDateObj(v) { return (v instanceof Date) && !isNaN(v.getTime()); }
  function hhmmss(v) { return isDateObj(v) ? Utilities.formatDate(v, tz, 'HH:mm:ss') : ''; }
  function toDateOnly(v) {
    if (!isDateObj(v)) return null;
    var iso = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
    return Utilities.parseDate(iso, tz, 'yyyy-MM-dd');
  }

  var sdTime = hhmmss(sd);
  var edTime = hhmmss(ed);

  var needSd = (sdTime && sdTime !== '00:00:00');
  var needEd = (edTime && edTime !== '00:00:00');

  var preview = {
    row: targetRow,
    bookingId: bookingId,
    startWas: isDateObj(sd) ? Utilities.formatDate(sd, tz, 'dd/MM/yyyy HH:mm:ss') : String(sd),
    endWas: isDateObj(ed) ? Utilities.formatDate(ed, tz, 'dd/MM/yyyy HH:mm:ss') : String(ed),
    startNeedFix: needSd,
    endNeedFix: needEd,
    dryRun: dryRun
  };

  Logger.log('normalizeDateOnlyByBookingId preview=' + JSON.stringify(preview));

  if (!dryRun) {
    if (needSd) sh.getRange(targetRow, idx.startDate + 1).setValue(toDateOnly(sd));
    if (needEd) sh.getRange(targetRow, idx.endDate + 1).setValue(toDateOnly(ed));

    // set format ให้เห็นเป็นวันล้วน
    sh.getRange(targetRow, idx.startDate + 1).setNumberFormat('dd/MM/yyyy');
    sh.getRange(targetRow, idx.endDate + 1).setNumberFormat('dd/MM/yyyy');

    SpreadsheetApp.flush();
  }

  return { ok: true, preview: preview };
}

// ANCHOR: RunNormalize1352
function runNormalize1352() {
  return normalizeDateOnlyByBookingId({
    bookingId: '1352',
    dryRun: false   // เปลี่ยนเป็น true ถ้าจะดู preview ก่อน
  });
}

// ANCHOR: getIntegratedDailyReport
function getIntegratedDailyReport(targetDate, opts) {
  try {
    opts = opts || {};
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Data');
    if (!sh) return '❌ ไม่พบชีต Data';

    var tz = 'Asia/Bangkok';
    var d = (targetDate instanceof Date) ? targetDate : new Date();
    var reportDateISO = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    var reportTime = Utilities.formatDate(new Date(), tz, 'HH:mm');
    var DAILY_REPORT_ITEMS_PER_PAGE = 10;

    var TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    var dateHeader = Utilities.formatDate(d, tz, 'dd') + ' ' + TH_MONTHS[Number(Utilities.formatDate(d, tz, 'M')) - 1] + ' ' + (Number(Utilities.formatDate(d, tz, 'yyyy')) + 543);

    function returnDailyPages_(pages) {
      return opts.asPages === true ? pages : pages.join('\n\n');
    }

    function pageLimitChars_() {
      return 3800;
    }

    function splitPagesByLimit_(pages) {
      if (!Array.isArray(pages) || !pages.length) return [''];
      var out = [];
      pages.forEach(function(page) {
        var text = String(page || '').trim();
        if (!text) return;
        if (text.length <= pageLimitChars_()) {
          out.push(text);
          return;
        }
        var chunks = text.split(/\n(?=\d+\. )/);
        var cur = '';
        chunks.forEach(function(chunk) {
          var next = cur ? (cur + '\n' + chunk) : chunk;
          if (next.length > pageLimitChars_() && cur) {
            out.push(cur.trim());
            cur = chunk;
          } else {
            cur = next;
          }
        });
        if (cur) out.push(cur.trim());
      });
      return out.length ? out : [''];
    }

    function buildDailyHeaderLines_(pageNo, totalPages, statGroups) {
      return [
        '📋 รายงานระบบจองยานพาหนะ',
        '📅 ' + dateHeader,
        '📄 หน้า ' + pageNo + '/' + totalPages,
        '',
        '📊 สถิติรายการวันนี้',
        '⏳ รออนุมัติ: ' + statGroups.pending.length + ' รายการ',
        '✅ อนุมัติ: ' + statGroups.approved.length + ' รายการ',
        '⚡ พิเศษ: ' + statGroups.driver_special_approved.length + ' รายการ',
        '❌ ไม่อนุมัติ: ' + statGroups.rejected.length + ' รายการ',
        '🚫 ยกเลิก: ' + statGroups.cancelled.length + ' รายการ'
      ];
    }

    function buildNoJobMessage_() {
      var emptyGroups = { pending: [], approved: [], driver_special_approved: [], rejected: [], cancelled: [] };
      var out = buildDailyHeaderLines_(1, 1, emptyGroups);
      out.push('');
      out.push('━━━━━━━━━━━━━━');
      out.push('🍃 ไม่มีรายการเดินทางในวันนี้');
      out.push('');
      out.push('🤖 รายงานอัตโนมัติ ' + reportTime + ' น.');
      return out.join('\n');
    }

    var data = _sheetApiGetValues_(sh, 1, 1, sh.getLastRow(), sh.getLastColumn(), 'specialApproveBooking read');
    var noJobMsg = (typeof getNoJobTemplate_ === 'function')
      ? getNoJobTemplate_(dateHeader)
      : [
          '📋 รายงานระบบจองยานพาหนะ',
          '📅 ' + dateHeader,
          '──────────────',
          '',
          '🍃 ไม่มีรายการเดินทางในวันนี้',
          '',
          '🤖 รายงานอัตโนมัติ ' + reportTime + ' น.'
        ].join('\n');

    if (data.length < 2) return returnDailyPages_([buildNoJobMessage_()]);

    var h = data[0].map(function(x) { return String(x).trim(); });
    var idx = {
      status: h.indexOf('สถานะ'),
      name: h.indexOf('ชื่อ-สกุล'),
      place: h.indexOf('สถานที่'),
      vehicle: h.indexOf('เลขทะเบียนรถ'),
      driver: h.indexOf('พนักงานขับรถ'),
      startD: h.indexOf('วันเริ่มต้น'),
      endD: h.indexOf('วันสิ้นสุด'),
      startT: h.indexOf('เวลาเริ่มต้น'),
      endT: h.indexOf('เวลาสิ้นสุด'),
      bookingId: h.indexOf('Booking ID')
    };

    var groups = {
      pending: [],
      approved: [],
      driver_special_approved: [],
      rejected: [],
      cancelled: []
    };

    function splitMultiValue_(v) {
      var s = String(v == null ? '' : v).trim();
      if (!s || s === '-') return [];
      return s
        .split(/[,\n|\/]+/)
        .map(function(x) { return String(x || '').trim(); })
        .filter(function(x) { return x && x !== '-'; });
    }

    function cleanText_(v, fallback) {
      var s = String(v == null ? '' : v).trim();
      if (!s || s === '-') return fallback || '';
      return s;
    }

    function buildVehicleLine_(plateRaw, driverRaw) {
      var plates = splitMultiValue_(plateRaw);
      var drivers = splitMultiValue_(driverRaw);
      if (!plates.length && !drivers.length) return '';
      var parts = [];
      if (plates.length) parts.push(plates.join(', '));
      if (drivers.length) parts.push(drivers.join(', '));
      return '🚐 ' + parts.join(' • ');
    }

    function buildTimeRangeLines_(r) {
      var st = (typeof parseTimeSafe_ === 'function') ? parseTimeSafe_(r[idx.startT]) : cleanText_(r[idx.startT], '--:--');
      var et = (typeof parseTimeSafe_ === 'function') ? parseTimeSafe_(r[idx.endT]) : cleanText_(r[idx.endT], '--:--');
      var sIso = (typeof parseDateToISO_ === 'function') ? parseDateToISO_(r[idx.startD]) : '';
      var eIso = (typeof parseDateToISO_ === 'function') ? parseDateToISO_(r[idx.endD]) : (sIso || '');
      var sameDay = !!(sIso && eIso && sIso === eIso);
      var sDateTH = (typeof fmtThaiDateSafe_ === 'function') ? fmtThaiDateSafe_(r[idx.startD]) : cleanText_(r[idx.startD], '-');
      var eDateTH = (typeof fmtThaiDateSafe_ === 'function') ? fmtThaiDateSafe_(r[idx.endD] || r[idx.startD]) : cleanText_(r[idx.endD] || r[idx.startD], '-');

      if (sameDay) return ['🕒 ' + st + ' → ' + et + ' น.'];
      return ['🕒 ' + sDateTH + ' ' + st + ' → ' + eDateTH + ' ' + et + ' น.'];
    }

    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      var sIso = (typeof parseDateToISO_ === 'function') ? parseDateToISO_(r[idx.startD]) : '';
      var eIso = (typeof parseDateToISO_ === 'function') ? parseDateToISO_(r[idx.endD]) : (sIso || '');
      var finalEndIso = eIso || sIso;

      if (!sIso || reportDateISO < sIso || reportDateISO > finalEndIso) continue;

      var key = (typeof getStatusKeySafe_ === 'function') ? getStatusKeySafe_(r[idx.status]) : 'pending';
      if (key === 'driver_claimed') key = 'pending';
      if (key === 'approved_full' || key === 'approved_partial') key = 'approved';
      if (!groups[key]) key = 'pending';

      groups[key].push(r);
    }

    var totalFound =
      groups.pending.length +
      groups.approved.length +
      groups.driver_special_approved.length +
      groups.rejected.length +
      groups.cancelled.length;

    if (totalFound === 0) return returnDailyPages_([buildNoJobMessage_()]);

    function bookingIdOf_(r) {
      return idx.bookingId > -1 ? cleanText_(r[idx.bookingId], '') : '';
    }

    function compareBookingId_(a, b) {
      var aa = bookingIdOf_(a);
      var bb = bookingIdOf_(b);
      if (aa === bb) return 0;
      if (!aa) return 1;
      if (!bb) return -1;
      var na = parseInt(String(aa).replace(/[^\d]/g, ''), 10);
      var nb = parseInt(String(bb).replace(/[^\d]/g, ''), 10);
      if (isFinite(na) && isFinite(nb) && na !== nb) return na - nb;
      return String(aa).localeCompare(String(bb));
    }

    function sortDailyRows_(rows) {
      rows.sort(function(a, b) {
        var da = (typeof parseDateToISO_ === 'function') ? parseDateToISO_(a[idx.startD]) : '';
        var db = (typeof parseDateToISO_ === 'function') ? parseDateToISO_(b[idx.startD]) : '';
        var ta = (typeof parseTimeSafe_ === 'function') ? parseTimeSafe_(a[idx.startT]) : cleanText_(a[idx.startT], '');
        var tb = (typeof parseTimeSafe_ === 'function') ? parseTimeSafe_(b[idx.startT]) : cleanText_(b[idx.startT], '');
        var ka = (da || '9999-12-31') + ' ' + (ta || '99:99');
        var kb = (db || '9999-12-31') + ' ' + (tb || '99:99');
        if (ka !== kb) return ka < kb ? -1 : 1;
        return compareBookingId_(a, b);
      });
    }

    sortDailyRows_(groups.pending);
    sortDailyRows_(groups.approved);
    sortDailyRows_(groups.driver_special_approved);
    sortDailyRows_(groups.rejected);
    sortDailyRows_(groups.cancelled);

    function renderDailyItemLines_(r, itemNo) {
      var out = [];
      var timeLines = buildTimeRangeLines_(r);
      out.push(itemNo + '. ' + (timeLines[0] || '🕒 --:-- → --:-- น.'));
      for (var t = 1; t < timeLines.length; t++) out.push(timeLines[t]);
      out.push('📍 ' + cleanText_(r[idx.place], '-'));
      out.push('👤 ' + cleanText_(r[idx.name], '-'));
      var vehicleLine = buildVehicleLine_(r[idx.vehicle], r[idx.driver]);
      if (vehicleLine) out.push(vehicleLine);
      return out;
    }

    function buildStatLine_(key, label, icon) {
      return icon + ' ' + label + ': ' + groups[key].length + ' รายการ';
    }

    function buildDailyPages_() {
      var statusBlocks = [
        { key: 'pending', label: 'รายการรออนุมัติ', emoji: '⏳', rows: groups.pending },
        { key: 'approved', label: 'รายการอนุมัติ', emoji: '✅', rows: groups.approved },
        { key: 'driver_special_approved', label: 'รายการพิเศษ', emoji: '⚡', rows: groups.driver_special_approved },
        { key: 'rejected', label: 'รายการไม่อนุมัติ', emoji: '❌', rows: groups.rejected },
        { key: 'cancelled', label: 'รายการยกเลิก', emoji: '🚫', rows: groups.cancelled }
      ];

      var pageBlocks = [];
      var current = [];
      var currentCount = 0;

      statusBlocks.forEach(function(block) {
        if (!block.rows || block.rows.length === 0) return;
        var sorted = block.rows.slice().sort(function(a, b) {
          var da = (typeof parseDateToISO_ === 'function') ? parseDateToISO_(a[idx.startD]) : '';
          var db = (typeof parseDateToISO_ === 'function') ? parseDateToISO_(b[idx.startD]) : '';
          var ta = (typeof parseTimeSafe_ === 'function') ? parseTimeSafe_(a[idx.startT]) : cleanText_(a[idx.startT], '');
          var tb = (typeof parseTimeSafe_ === 'function') ? parseTimeSafe_(b[idx.startT]) : cleanText_(b[idx.startT], '');
          var ka = (da || '9999-12-31') + ' ' + (ta || '99:99');
          var kb = (db || '9999-12-31') + ' ' + (tb || '99:99');
          if (ka !== kb) return ka < kb ? -1 : 1;
          return compareBookingId_(a, b);
        });

        for (var i = 0; i < sorted.length; i += DAILY_REPORT_ITEMS_PER_PAGE) {
          var chunk = sorted.slice(i, i + DAILY_REPORT_ITEMS_PER_PAGE);
          if (currentCount > 0 && currentCount + chunk.length > DAILY_REPORT_ITEMS_PER_PAGE) {
            pageBlocks.push(current);
            current = [];
            currentCount = 0;
          }
          current.push({
            key: block.key,
            label: block.label,
            emoji: block.emoji,
            total: sorted.length,
            startIndex: i,
            rows: chunk
          });
          currentCount += chunk.length;
        }
      });
      if (current.length) pageBlocks.push(current);

      var totalPages = Math.max(pageBlocks.length, 1);
      return pageBlocks.map(function(blocks, pageIndex) {
        var out = buildDailyHeaderLines_(pageIndex + 1, totalPages, groups);
        blocks.forEach(function(block) {
          out.push('');
          out.push('━━━━━━━━━━━━━━');
          out.push(block.emoji + ' ' + block.label + ' (' + block.total + ' รายการ)');
          out.push('');
          block.rows.forEach(function(r, i) {
            if (i > 0) {
              out.push('');
              out.push('────────────────');
              out.push('');
            }
            Array.prototype.push.apply(out, renderDailyItemLines_(r, block.startIndex + i + 1));
          });
        });
        out.push('');
        out.push('🤖 รายงานอัตโนมัติ ' + reportTime + ' น.');
        return out.join('\n')
          .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/gi, '')
          .replace(/D\s*น\./gi, '')
          .replace(/[ \t]{2,}/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      });
    }

    return returnDailyPages_(buildDailyPages_());

    var lines = [
      '📋 รายงานระบบจองยานพาหนะ (ประจำวัน)',
      '📅 ' + dateHeader,
      '',
      '📊 สถิติรายการวันนี้',
      '⏳ รออนุมัติ: ' + groups.pending.length + ' รายการ',
      '✅ อนุมัติ: ' + groups.approved.length + ' รายการ',
      '⚡ อนุมัติกรณีพิเศษ: ' + groups.driver_special_approved.length + ' รายการ',
      '❌ ไม่อนุมัติ: ' + groups.rejected.length + ' รายการ',
      '🚫 ยกเลิก: ' + groups.cancelled.length + ' รายการ'
    ];

    // Helper function to render detail block for a status group
    function renderStatusBlock_(rows, statusLabel, statusEmoji) {
      if (!rows || rows.length === 0) return;
      lines.push('');
      lines.push('──────────────');
      lines.push(statusEmoji + ' ' + statusLabel + ' (' + rows.length + ' รายการ)');
      lines.push('');

      rows.forEach(function(r, index) {
        var timeLines = buildTimeRangeLines_(r);
        for (var t = 0; t < timeLines.length; t++) lines.push(timeLines[t]);
        lines.push('📍 ' + cleanText_(r[idx.place], '-'));
        lines.push('👤 ' + cleanText_(r[idx.name], '-'));
        var vehicleLine = buildVehicleLine_(r[idx.vehicle], r[idx.driver]);
        if (vehicleLine) lines.push(vehicleLine);
        if (index < rows.length - 1) lines.push('');
      });
    }

    // Render detail blocks for all statuses with entries (only if has items)
    renderStatusBlock_(groups.pending, 'รายการรออนุมัติ', '⏳');
    renderStatusBlock_(groups.approved, 'รายการอนุมัติ', '✅');
    renderStatusBlock_(groups.driver_special_approved, 'รายการอนุมัติกรณีพิเศษ', '⚡');
    renderStatusBlock_(groups.rejected, 'รายการไม่อนุมัติ', '❌');
    renderStatusBlock_(groups.cancelled, 'รายการยกเลิก', '🚫');

    lines.push('');
    lines.push('──────────────');
    lines.push('🤖 รายงานอัตโนมัติ ' + reportTime);

    return lines.join('\n')
      .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/gi, '')
      .replace(/D\s*น\./gi, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  } catch (e) {
    console.error('ERROR: ' + e.message);
    return '❌ เกิดข้อผิดพลาดในการสร้างรายงาน: ' + e.message;
  }
}

function getNoJobTemplate_(dateHeader) {
  var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
  return [
    '📋 รายงานระบบจองยานพาหนะ',
    '📅 ' + dateHeader,
    '──────────────',
    '',
    '🍃 ไม่มีรายการเดินทางในวันนี้',
    '',
    '🤖 รายงานอัตโนมัติ ' + Utilities.formatDate(new Date(), tz, 'HH:mm') + ' น.'
  ].join('\n');
}

function sanitizeBerryMessage(text) {
  if (!text) return "";

  return String(text)
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/gi, '')
    .replace(/D\s*น\./gi, '')
    .replace(/[ \t]+\n/g, '\n') // ลบ space ท้ายบรรทัด
    .replace(/\n{3,}/g, '\n\n') // บีบบรรทัดว่างที่เกิน 2 ให้เหลือ 2
    .trim();
}


/* =========================================
   CORE: TELEGRAM MESSAGE BUILDER (Fixed Time)
   ========================================= */
/* [ANCHOR: Thai DateTime Formatter (Strict BE for Server)] */
function getThaiDateTimeString(dateInput, timeInput) {
  try {
    var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
    var dateStr = '-';
    var timeStr = '-';

    // 1. แปลงวันที่ -> DD/MM/YYYY (พ.ศ.)
    if (dateInput) {
      // รองรับทั้ง Date Object และ String
      var d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
      
      // ตรวจสอบว่าเป็นวันที่ที่ถูกต้องหรือไม่
      if (!isNaN(d.getTime())) {
        var y = parseInt(Utilities.formatDate(d, tz, 'yyyy'), 10);
        // Logic: ถ้าปีน้อยกว่า 2400 (เช่น 2026) ให้บวก 543 เพื่อเป็น พ.ศ. (2569)
        var beYear = (y < 2400) ? y + 543 : y; 
        dateStr = Utilities.formatDate(d, tz, 'dd/MM/') + beYear;
      }
    }

    // 2. แปลงเวลา -> HH:mm
    if (timeInput) {
      if (timeInput instanceof Date) {
        timeStr = Utilities.formatDate(timeInput, tz, 'HH:mm');
      } else {
        var s = String(timeInput).trim();
        // พยายามจับรูปแบบ 9:00 หรือ 09:00
        var m = s.match(/(\d{1,2})[:.](\d{2})/);
        if (m) {
          timeStr = ('0' + m[1]).slice(-2) + ':' + m[2];
        }
      }
    }

    // 3. รวมร่าง: "20/01/2569 09:00 น."
    var tPart = (timeStr !== '-' && timeStr !== '') ? (timeStr + ' น.') : '';
    return (dateStr + ' ' + tPart).trim();

  } catch (e) {
    Logger.log("Date convert error: " + e.message);
    return '-';
  }
}

// [TELEGRAM] Status mapping (single source for all Telegram messages)
function getTelegramStatusMeta(statusKey) {
  var k = String(statusKey || 'pending').toLowerCase().trim();
  var map = {
    pending:          { icon:'⏳', th:'รออนุมัติ' },
    approved_full:    { icon:'✅', th:'อนุมัติครบ' },
    approved_partial: { icon:'🟠', th:'อนุมัติบางส่วน' },
    rejected:         { icon:'⛔', th:'ไม่อนุมัติ' },
    cancelled:        { icon:'🚫', th:'ยกเลิก' }
  };
  return map[k] || map.pending;
}

function parseApprovedVehicles(rowObj) {
  rowObj = rowObj || {};
  var raw = String(rowObj['รถที่เลือก'] || rowObj['vehicleSelected'] || '').trim();
  if (!raw) raw = String(rowObj['เลขทะเบียนรถ'] || rowObj['vehicle'] || rowObj['plate'] || '').trim();
  var plates = raw.split(',').map(function(x){ return String(x || '').trim(); }).filter(Boolean);
  var driversRaw = String(rowObj['พนักงานขับรถ'] || rowObj['driver'] || '').trim();
  var drivers = driversRaw.split(',').map(function(x){ return String(x || '').trim(); }).filter(Boolean);
  return { plates: plates, drivers: drivers };
}

function normalizeTelegramStatusKey(statusKey, reqCount, approvedCount) {
  var k = String(statusKey || 'pending').toLowerCase().trim();
  if (k === 'approved') {
    if (approvedCount > 0 && approvedCount < reqCount) return 'approved_partial';
    if (approvedCount >= reqCount && reqCount > 0) return 'approved_full';
    return 'approved_partial';
  }
  if (k === 'pending' || k === 'approved_full' || k === 'approved_partial' || k === 'rejected' || k === 'cancelled') return k;
  return k;
}

function formatPassengers(value) {
  var s = String(value == null ? '' : value).trim();
  if (!s) return 'ไม่ระบุ';
  if (s === '0') return '0 คน';
  var n = Number(s);
  if (isFinite(n) && String(n) === s.replace(/^0+(\d)/, '$1')) return (n + ' คน');
  return s;
}

function normalizePosition(value) {
  var s = String(value == null ? '' : value).trim();
  if (s === 'อาจารย์' || s === 'เจ้าหน้าที่' || s === 'นักศึกษา') return s;
  return '';
}

/* =========================================
   CORE: TELEGRAM MESSAGE BUILDER (Fixed Thai Date BE)
   ========================================= */
/* [ANCHOR: Date Range Generator (Noon Safe)] */
/**
 * สร้าง Array ของวันที่ (String) จากช่วงวัน
 * Logic: ใช้เวลาเที่ยงวัน (12:00) เพื่อป้องกัน Timezone Shift
 */
function buildLocalDateRangeList(startDateObj, endDateObj, tz) {
  tz = tz || (Session.getScriptTimeZone() || 'Asia/Bangkok');
  
  // [BERRY] ปรับ Format เป็น d/M/yyyy + พ.ศ. ให้ตรงกับ UI ส่วนอื่น (หรือแก้ pattern ตามต้องการ)
  function iso(d) { 
    return Utilities.formatDate(d, tz, 'd/M/') + (parseInt(Utilities.formatDate(d, tz, 'yyyy')) + 543);
  }

  if (!(startDateObj instanceof Date) || isNaN(startDateObj.getTime())) return [];

  // [BERRY] Clone วันที่และตั้งเวลาเป็น 12:00:00 (เที่ยงวัน)
  // เพื่อให้ข้าม Timezone Offset ได้ปลอดภัย ไม่ว่าจะ Run Server ที่ไหน
  var s = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate(), 12, 0, 0);
  
  var e;
  if (endDateObj instanceof Date && !isNaN(endDateObj.getTime())) {
    e = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate(), 12, 0, 0);
  } else {
    e = new Date(s.getTime());
  }

  // กรณีวันจบ < วันเริ่ม -> ให้ถือว่าเป็นวันเดียว (One Day Trip)
  if (e.getTime() < s.getTime()) e = new Date(s.getTime());

  var out = [];
  var cur = new Date(s.getTime());
  
  // [BERRY] Safety Limit: ป้องกัน Loop ตาย (จำกัดไม่เกิน 366 วัน)
  var limit = 0;
  var MAX_DAYS = 366; 

  while (cur.getTime() <= e.getTime() && limit < MAX_DAYS) {
    out.push(iso(cur));
    cur.setDate(cur.getDate() + 1); // บวก 1 วัน
    limit++;
  }
  
  return out;
}

// --- Helper: แยกวัตถุประสงค์ และ รายละเอียดโครงการ ---
function getProjectParts_(rawStr, rawDetail) {
  // กรณี 1: มีฟิลด์ detail แยกมาให้ชัดเจน
  if (rawDetail && rawDetail !== '-' && rawDetail !== '') {
    return { purpose: String(rawStr).trim(), detail: String(rawDetail).trim() };
  }

  // กรณี 2: ข้อมูลรวมอยู่ใน project ในรูปแบบ "Purpose: Detail" (Legacy support)
  var s = String(rawStr || '').trim();
  if (!s) return { purpose: '-', detail: '' };
  
  var idx = s.indexOf(':');
  if (idx === -1) {
    return { purpose: s, detail: '' };
  }
  
  var purpose = s.substring(0, idx).trim();
  var detail = s.substring(idx + 1).trim();
  return { purpose: purpose, detail: detail };
}

// --- Helper: จัดการเวลา (Time Block) ---
function buildTimeBlock_(dStart, dEnd, tStart, tEnd, reportDateISO) {
  var tz = 'Asia/Bangkok';
  
  function fmtD(v) {
    if (!v) return null;
    var dObj = (v instanceof Date) ? v : new Date(v);
    if (isNaN(dObj.getTime())) return String(v);
    var dd = Utilities.formatDate(dObj, tz, 'dd');
    var mm = Utilities.formatDate(dObj, tz, 'MM');
    var yyyy = parseInt(Utilities.formatDate(dObj, tz, 'yyyy')) + 543; // บังคับ พ.ศ.
    return dd + '/' + mm + '/' + yyyy;
  }
  
  function fmtShort(v) {
    var s = fmtD(v);
    return s ? s.substring(0, 5) : '';
  }

  function fmtT(v) {
    if (!v) return '00:00';
    var s = String(v).replace('น.', '').trim();
    var p = s.split(':');
    if (p.length === 2) return ('0' + p[0]).slice(-2) + ':' + ('0' + p[1]).slice(-2);
    return s;
  }

  var ds = fmtD(dStart), de = fmtD(dEnd);
  var ts = fmtT(tStart), te = fmtT(tEnd);
  var isoStart = (dStart instanceof Date) ? Utilities.formatDate(dStart, tz, 'yyyy-MM-dd') : String(dStart);
  var isoEnd = (dEnd instanceof Date) ? Utilities.formatDate(dEnd, tz, 'yyyy-MM-dd') : String(dEnd);

  var lines = [];
  if (isoStart === isoEnd) {
    lines.push('ไป: ' + ds + ' ' + ts + ' น.');
    lines.push('กลับ: ' + de + ' ' + te + ' น.');
  } else {
    lines.push('ไป: ' + ds + ' ' + ts + ' น.');
    lines.push('กลับ: ' + de + ' ' + te + ' น.');
    lines.push('ช่วงงาน: ' + fmtShort(dStart) + ' ' + ts + ' → ' + fmtShort(dEnd) + ' ' + te);
    lines.push('🌙 ค้างคืน');
    if (reportDateISO && isoStart < reportDateISO) {
      lines.push('🔁 ต่อเนื่องจากวันที่ ' + ds);
    }
  }
  return lines.join('\n');
}

// ANCHOR: buildBookingStatusMessage
function buildBookingStatusMessage(rowObj, statusKey, reasonFromPayload) {
  rowObj = rowObj || {};

  var st = getStatusKeySafe_(statusKey || rowObj.status || rowObj['สถานะ'] || 'pending');
  if (st === 'driver_claimed') st = 'pending';

  var rawNote = String(
    reasonFromPayload ||
    rowObj.Reason ||
    rowObj.reason ||
    rowObj.CancelReason ||
    rowObj.cancelReason ||
    ''
  ).trim();

  var eventMetaMap = {
    new_booking: { icon: '⏳', title: 'รายการจองใหม่' },
    approve_booking: { icon: '✅', title: 'อนุมัติรายการจอง' },
    special_approve: { icon: '⚡', title: 'อนุมัติด่วน' },
    reject_booking: { icon: '❌', title: 'ไม่อนุมัติรายการจอง' },
    cancel_booking: { icon: '🚫', title: 'ยกเลิกรายการจอง' },
    reassign_vehicle_driver: { icon: '🔄', title: 'เปลี่ยนรถ/คนขับ' },
    early_close: { icon: '🏁', title: 'ปิดงานก่อนเวลา' }
  };

  var statusLabelMap = {
    pending: { icon: '⏳', text: 'รออนุมัติ' },
    approved: { icon: '✅', text: 'อนุมัติ' },
    driver_special_approved: { icon: '✅', text: 'อนุมัติ' },
    rejected: { icon: '❌', text: 'ไม่อนุมัติ' },
    cancelled: { icon: '🚫', text: 'ยกเลิกงาน' }
  };

  function getV(keys) {
    for (var i = 0; i < keys.length; i++) {
      var val = rowObj[keys[i]];
      if (val != null && String(val).trim() !== '' && String(val).trim() !== '-') return val;
    }
    return '';
  }

  function cleanText(v, fallback) {
    var s = String(v == null ? '' : v).trim();
    var lower = s.toLowerCase();
    if (!s || s === '-' || lower === 'null' || lower === 'undefined') return fallback || '';
    return s;
  }

  function splitMultiValue_(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s || s === '-') return [];
    return s
      .split(/[,\n|\/]+/)
      .map(function(x) { return cleanText(x, ''); })
      .filter(function(x) { return !!x; });
  }

  function getAssignedCount_(plateRaw, driverRaw) {
    var plates = splitMultiValue_(plateRaw);
    var drivers = splitMultiValue_(driverRaw);
    return Math.max(plates.length, drivers.length);
  }

  function buildAssignments(plateRaw, driverRaw, titleLine, vehicleTypeRaw) {
    var plates = splitMultiValue_(plateRaw);
    var drivers = splitMultiValue_(driverRaw);
    var maxLen = Math.max(plates.length, drivers.length);
    var vehicleType = (typeof normalizeVehicleTypeLabel_ === 'function')
      ? normalizeVehicleTypeLabel_(vehicleTypeRaw)
      : cleanText(vehicleTypeRaw, '');
    var vehicleTypeLower = String(vehicleType || vehicleTypeRaw || '').toLowerCase();
    var vehicleIcon = '🚗';

    if (vehicleTypeLower.indexOf('รถตู้') > -1 || vehicleTypeLower.indexOf('van') > -1 || vehicleTypeLower.indexOf('ตู้') > -1) {
      vehicleIcon = '🚐';
    } else if (vehicleTypeLower.indexOf('รถบรรทุก') > -1 || vehicleTypeLower.indexOf('truck') > -1 || vehicleTypeLower.indexOf('กระบะ') > -1) {
      vehicleIcon = '🚚';
    }

    if (maxLen === 0) {
      return [
        titleLine || '✅ <b>มอบหมายยานพาหนะ</b>',
        '🚗 จำนวนที่จัดให้: 0 คัน',
        '1) ' + vehicleIcon + ' รอระบุทะเบียน | 👤 รอระบุชื่อ'
      ];
    }

    var out = [
      titleLine || '✅ <b>มอบหมายยานพาหนะ</b>',
      '🚗 จำนวนที่จัดให้: ' + maxLen + ' คัน'
    ];

    for (var i = 0; i < maxLen; i++) {
      var car = escapeHtml(plates[i] || 'รอระบุทะเบียน');
      var drv = escapeHtml(drivers[i] || 'รอระบุชื่อ');
      out.push((i + 1) + ') ' + vehicleIcon + ' ' + car + ' | 👤 ' + drv);
    }
    return out;
  }

  function toDateObj(v) {
    if (typeof normalizeDateInputToDate_ === 'function') return normalizeDateInputToDate_(v);
    return null;
  }

  var id = escapeHtml(cleanText(getV(['Booking ID', 'id', 'bookingId']), '-'));
  var name = escapeHtml(cleanText(getV(['ชื่อ-สกุล', 'name', 'ผู้จอง']), 'ไม่ระบุ'));
  var position = escapeHtml(cleanText(getV(['ตำแหน่ง', 'position']), ''));
  var phone = escapeHtml(cleanText(getV(['เบอร์โทร', 'เบอร์โทรศัพท์', 'phone']), ''));
  var workType = escapeHtml(cleanText(getV(['ประเภทงาน', 'workType', 'jobType']), ''));
  var workName = escapeHtml(cleanText(getV(['งาน/โครงการ', 'ชื่อโครงการ/งาน', 'workName', 'projectName', 'project']), 'ไม่ระบุ'));
  var place = escapeHtml(cleanText(getV(['สถานที่', 'destination', 'place']), 'ไม่ระบุ'));

  var sDateRaw = getV(['วันเริ่มต้น', 'startDate']);
  var eDateRaw = getV(['วันสิ้นสุด', 'endDate']);
  var sDateTH = fmtThaiDateSafe_(sDateRaw);
  var eDateTH = fmtThaiDateSafe_(eDateRaw || sDateRaw);

  var sTimeRaw = getV(['เวลาเริ่มต้น', 'startTime']);
  var eTimeRaw = getV(['เวลาสิ้นสุด', 'endTime']);
  var sTime = (typeof parseTimeSafe_ === 'function')
    ? parseTimeSafe_(sTimeRaw)
    : String(sTimeRaw || '00:00').replace('น.', '').trim();
  var eTime = (typeof parseTimeSafe_ === 'function')
    ? parseTimeSafe_(eTimeRaw)
    : String(eTimeRaw || '00:00').replace('น.', '').trim();

  var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
  var sDateObj = toDateObj(sDateRaw);
  var eDateObj = toDateObj(eDateRaw) || sDateObj;
  var isoStart = sDateObj ? Utilities.formatDate(sDateObj, tz, 'yyyy-MM-dd') : '';
  var isoEnd = eDateObj ? Utilities.formatDate(eDateObj, tz, 'yyyy-MM-dd') : isoStart;
  var isCrossDay = !!(isoStart && isoEnd && isoStart !== isoEnd);

  var actualEndRaw = getV(['actualEndAt', 'actualEndTime', 'Actual End', 'เวลาปิดงานจริง']);
  var actualEndText = escapeHtml(cleanText(fmtThaiDateTimeSafe_(actualEndRaw), ''));
  var closedBy = escapeHtml(cleanText(getV(['closedBy', 'ผู้ปิดงาน']), ''));

  var plate = getV(['เลขทะเบียนรถ', 'vehicle', 'plate']);
  var driver = getV(['พนักงานขับรถ', 'driver']);
  var pax = escapeHtml(cleanText(getV(['จำนวนผู้ร่วมเดินทาง', 'passengers']), '0'));
  var rawCarType = cleanText(getV(['ประเภทรถ', 'carType', 'vehicleType']), '');
  var carType = (typeof normalizeVehicleTypeLabel_ === 'function')
    ? normalizeVehicleTypeLabel_(rawCarType)
    : rawCarType;
  carType = escapeHtml(cleanText(carType, 'ไม่ระบุ'));
  var vCount = escapeHtml(cleanText(getV(['จำนวนรถที่ต้องการ', 'vehicleCount', 'carCount']), '1'));
  var assignedCount = getAssignedCount_(plate, driver);
  var phoneDisplay = escapeHtml(formatPhoneDisplay_(phone));

  var userDisplay = name;
  if (position) userDisplay += ' (' + position + ')';

  function isEarlyCloseReason_(text) {
    var s = cleanText(text, '').toLowerCase();
    if (!s) return false;
    return (
      s.indexOf('ปิดงานก่อนเวลา') > -1 ||
      s.indexOf('ปิดงานก่อนกำหนด') > -1 ||
      s.indexOf('early close') > -1
    );
  }

  function isReassignReason_(text) {
    var s = cleanText(text, '').toLowerCase();
    if (!s) return false;
    return (
      s.indexOf('เปลี่ยนรถ/คนขับ') > -1 ||
      s.indexOf('เปลี่ยนรถ') > -1 ||
      s.indexOf('เปลี่ยนคนขับ') > -1 ||
      s.indexOf('อัปเดตการมอบหมาย') > -1 ||
      s.indexOf('มอบหมายใหม่') > -1 ||
      s.indexOf('reassign') > -1 ||
      s.indexOf('change driver') > -1 ||
      s.indexOf('change vehicle') > -1
    );
  }

  var eventFlagRaw = cleanText(getV(['event', 'eventType', 'notifyEvent', 'telegramEvent', 'action']), '').toLowerCase();
  var isEarlyClose = isEarlyCloseReason_(rawNote) || !!actualEndRaw || eventFlagRaw === 'early_close';
  var isReassign = isReassignReason_(rawNote) || eventFlagRaw === 'reassign';

  var eventKey = 'new_booking';
  if (st === 'pending') eventKey = 'new_booking';
  else if (st === 'driver_special_approved') eventKey = 'special_approve';
  else if (st === 'approved' && isEarlyClose) eventKey = 'early_close';
  else if (st === 'approved' && isReassign) eventKey = 'reassign_vehicle_driver';
  else if (st === 'approved') eventKey = 'approve_booking';
  else if (st === 'rejected') eventKey = 'reject_booking';
  else if (st === 'cancelled') eventKey = 'cancel_booking';

  var statusKeyForLabel = st;
  if (st === 'driver_special_approved') statusKeyForLabel = 'approved';
  if (eventKey === 'reassign_vehicle_driver' || eventKey === 'early_close') statusKeyForLabel = 'approved';

  var eventMeta = eventMetaMap[eventKey] || eventMetaMap.new_booking;
  var statusMeta = statusLabelMap[statusKeyForLabel] || statusLabelMap.pending;
  var normalizedStartDate = sDateObj || sDateRaw;
  var normalizedEndDate = eDateObj || eDateRaw || sDateObj || sDateRaw;
  var normalizedStartTime = cleanText(sTime, '00:00');
  var normalizedEndTime = cleanText(eTime, '00:00');
  var timeBlockText = (typeof buildTimeBlock_ === 'function')
    ? buildTimeBlock_(normalizedStartDate, normalizedEndDate, normalizedStartTime, normalizedEndTime, isoStart)
    : ('ไป: ' + cleanText(sDateTH, 'ไม่ระบุ') + ' ' + normalizedStartTime + ' น.\nกลับ: ' + cleanText(eDateTH, cleanText(sDateTH, 'ไม่ระบุ')) + ' ' + normalizedEndTime + ' น.');

  var lines = [];
  lines.push('<b>' + eventMeta.icon + ' แจ้งเตือนการจองยานพาหนะ (' + eventMeta.title + ')</b>');
  lines.push('🆔 Booking ID: ' + cleanText(id, 'ไม่ระบุ'));
  lines.push('──────────────');
  lines.push('👤 ผู้จอง: ' + userDisplay);
  if (phoneDisplay) lines.push('📞 โทร: ' + phoneDisplay);
  if (workType) lines.push('🎯 ประเภทงาน: ' + workType);
  lines.push('📝 งาน/โครงการ: ' + workName);
  lines.push('📍 สถานที่: ' + place);
  lines.push('');
  lines.push('🕒 เวลาเดินทาง');
  lines = lines.concat(String(timeBlockText || '').split('\n').filter(function(x) { return String(x || '').trim() !== ''; }));
  lines.push('');
  lines.push('👥 ผู้ร่วมเดินทาง: ' + pax + ' คน');
  lines.push('🚐 ประเภทรถ: ' + carType);
  lines.push('🚗 จำนวนรถที่ขอ: ' + vCount + ' คัน');

  if (eventKey === 'approve_booking' || eventKey === 'special_approve' || eventKey === 'reassign_vehicle_driver') {
    lines.push('');
    lines.push('──────────────');
    var assignmentTitle = (eventKey === 'reassign_vehicle_driver')
      ? '🔄 <b>อัปเดตการมอบหมายใหม่</b>'
      : '✅ <b>มอบหมายยานพาหนะ</b>';
    lines = lines.concat(buildAssignments(plate, driver, assignmentTitle, carType));

    if (assignedCount > 0 && String(vCount) !== String(assignedCount)) {
      lines.push('ℹ️ สรุป: ขอ ' + vCount + ' คัน | จัดให้ ' + assignedCount + ' คัน');
    }
  }

  if (eventKey === 'early_close') {
    lines.push('');
    lines.push('──────────────');
    lines.push('🏁 <b>สรุปการปิดงานก่อนเวลา</b>');
    if (actualEndText) lines.push('🕒 เวลาปิดงานจริง: ' + actualEndText);
    if (closedBy) lines.push('👤 ผู้ปิดงาน: ' + closedBy);
  }

  lines.push('');
  lines.push('──────────────');
  lines.push('🔖 สถานะ');
  lines.push(statusMeta.icon + ' ' + statusMeta.text);

  var note = '';
  if (st === 'cancelled' || eventKey === 'cancel_booking') {
    note = cleanText(getV(['CancelReason', 'cancelReason']), '') || rawNote || cleanText(getV(['Reason', 'reason']), '');
  } else {
    note = rawNote || cleanText(getV(['Reason', 'reason']), '') || cleanText(getV(['CancelReason', 'cancelReason']), '');
  }
  note = escapeHtml(cleanText(note, ''));
  var noteLine = '';

  if (eventKey === 'special_approve') {
    noteLine = '💬 หมายเหตุ: อนุมัติด่วน';
    if (note && note.toLowerCase().indexOf('อนุมัติด่วน') === -1) {
      noteLine += '\n' + note;
    }
  } else if (eventKey === 'reassign_vehicle_driver') {
    noteLine = '💬 หมายเหตุ: เปลี่ยนรถ/คนขับ';
    if (note && note.toLowerCase().indexOf('เปลี่ยนรถ/คนขับ') === -1) {
      noteLine += '\n' + note;
    }
  } else if (eventKey === 'early_close') {
    if (note) noteLine = '💬 หมายเหตุ: ' + note;
  } else if (eventKey === 'reject_booking' || eventKey === 'cancel_booking') {
    if (note) noteLine = '💬 เหตุผล: ' + note;
  } else {
    if (note) noteLine = '💬 หมายเหตุ: ' + note;
  }

  if (noteLine) {
    lines.push('');
    lines.push(noteLine);
  }

  return lines.join('\n')
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/gi, '')
    .replace(/D\s*น\./gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function rowToBookingObject_(rowData, idx, headers) {
  rowData = rowData || [];
  idx = idx || {};
  const get = (k) => (idx[k] != null) ? rowData[idx[k]] : '';
  return {
    name: get('name') || get('fullname') || get('fullName') || get('ชื่อ-สกุล') || '',
    phone: get('phone') || get('tel') || get('เบอร์โทร') || '',
    email: get('email') || '',
    project: get('project') || get('งาน/โครงการ') || '',
    place: get('destination') || get('place') || get('สถานที่') || '',
    carType: get('carType') || get('ประเภทรถ') || '',
    vehicle: get('vehicle') || get('เลขทะเบียนรถ') || '',
    requestedVehicle: get('requestedVehicle') || get('รถที่เลือก') || '',
    driver: get('driver') || get('พนักงานขับรถ') || '',
    startDate: get('startDate') || get('วันเริ่มต้น') || '',
    startTime: get('startTime') || get('เวลาเริ่มต้น') || '',
    endDate: get('endDate') || get('วันสิ้นสุด') || '',
    endTime: get('endTime') || get('เวลาสิ้นสุด') || '',
    passengers: get('passengers') || get('จำนวนผู้ร่วมเดินทาง') || '',
    bookingId: get('bookingId') || get('Booking ID') || '',
    fileUrl: get('fileUrl') || get('File') || '',
    reason: get('reason') || get('Reason') || '',
    cancelReason: get('cancelReason') || get('CancelReason') || '',
    status: get('status') || get('สถานะ') || ''
  };
}



function buildBookingObjectFromRow_(headerRow, rowArr) {
  headerRow = headerRow || [];
  rowArr = rowArr || [];

  var obj = {};
  for (var c = 0; c < headerRow.length; c++) {
    var key = String(headerRow[c] || '').trim();
    if (!key) continue;
    obj[key] = rowArr[c];
  }

  // Add normalized keys that buildBookingStatusMessage_ might use
  // (still derived from header, not fixed index)
  obj.name       = obj['ชื่อ-สกุล'];
  obj.phone      = obj['เบอร์โทร'];
  obj.email      = obj['email'];
  obj.project    = obj['งาน/โครงการ'];
  obj.place      = obj['สถานที่'];
  obj.vehicleType= obj['ประเภทรถ'];
  obj.plate      = obj['เลขทะเบียนรถ'];
  obj.requestedVehicle = obj['รถที่เลือก'];
  obj.driver     = obj['พนักงานขับรถ'];
  obj.startDate  = obj['วันเริ่มต้น'];
  obj.startTime  = obj['เวลาเริ่มต้น'];
  obj.endDate    = obj['วันสิ้นสุด'];
  obj.endTime    = obj['เวลาสิ้นสุด'];
  obj.passengers = obj['จำนวนผู้ร่วมเดินทาง'];
  obj.bookingId  = obj['Booking ID'];
  obj.fileUrl    = obj['File'];
  obj.reason     = obj['Reason'];
  obj.cancelReason = obj['CancelReason'];
  obj.status     = obj['สถานะ'];

  return obj;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function safeTimeRange_(start, end) {
  // ✅ normalize any time-ish input into "HH:mm"
  function normalizeToHHmm_(v) {
    if (v == null) return '';

    // Date object
    if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
      var hh = v.getHours();
      var mm = v.getMinutes();
      return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    }

    var s = String(v || '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!s || s === '-' || s.toLowerCase() === 'null') return '';

    // remove Thai suffix "น."
    s = s.replace(/\s*น\.\s*$/g, '').trim();

    // already "HH:mm"
    var m24 = s.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) {
      var h24 = Number(m24[1]), min24 = Number(m24[2]);
      if (h24 >= 0 && h24 <= 23 && min24 >= 0 && min24 <= 59) {
        return String(h24).padStart(2, '0') + ':' + String(min24).padStart(2, '0');
      }
      return '';
    }

    // "HH:mm:ss"
    var m24s = s.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
    if (m24s) {
      var h24s = Number(m24s[1]), min24s = Number(m24s[2]), sec = Number(m24s[3]);
      if (h24s >= 0 && h24s <= 23 && min24s >= 0 && min24s <= 59 && sec >= 0 && sec <= 59) {
        return String(h24s).padStart(2, '0') + ':' + String(min24s).padStart(2, '0');
      }
      return '';
    }

    // "HH:mm AM/PM"
    var m12 = s.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
    if (m12) {
      var h12 = Number(m12[1]);
      var m12min = Number(m12[2]);
      var ap = String(m12[3]).toUpperCase();
      if (h12 < 1 || h12 > 12 || m12min < 0 || m12min > 59) return '';
      if (ap === 'PM' && h12 < 12) h12 += 12;
      if (ap === 'AM' && h12 === 12) h12 = 0;
      return String(h12).padStart(2, '0') + ':' + String(m12min).padStart(2, '0');
    }

    // fallback: try parse as DateTime string
    var dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      return String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
    }

    return '';
  }

  var a = normalizeToHHmm_(start);
  var b = normalizeToHHmm_(end);

  if (!a || !b) return '-';

  // ✅ output standard: always one "น." at end of each time
  return a + ' น.-' + b + ' น.';
}

function buildDailySummaryTelegram_(targetDate) {
  try {
    var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
    var d = targetDate ? new Date(targetDate) : new Date();
    if (targetDate instanceof Date) d = targetDate;

    function toStr(v) { return String(v == null ? '' : v).trim(); }
    function cleanText(v) { return toStr(v).replace(/[\u200B-\u200D\uFEFF]/g, '').trim(); }
    function isEmpty(v) {
      var s = cleanText(v);
      return !s || s === '–' || s === '—' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined';
    }
    function safeText(v) { return isEmpty(v) ? 'ไม่ระบุ' : cleanText(v); }

    function fmtDateBE(dateObj) {
      var ad = parseInt(Utilities.formatDate(dateObj, tz, 'yyyy'), 10);
      var be = (ad < 2400) ? (ad + 543) : ad;
      return Utilities.formatDate(dateObj, tz, 'dd/MM/') + be;
    }

    function dateISO(dateObj) { return Utilities.formatDate(dateObj, tz, 'yyyy-MM-dd'); }

    function parseDateAny(v) {
      if (v instanceof Date && !isNaN(v.getTime())) return v;
      var s = cleanText(v);
      if (!s) return null;

      s = s
        .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/g, '')
        .replace(/D\s*น\./g, '')
        .replace(/น\./g, '')
        .replace(/[ ]{2,}/g, ' ')
        .trim();

      var m1 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m1) return new Date(Number(m1[1]), Number(m1[2]) - 1, Number(m1[3]));

      var m2 = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
      if (m2) {
        var dd = Number(m2[1]), mm = Number(m2[2]), yy = Number(m2[3]);
        if (yy > 2400) yy -= 543;
        return new Date(yy, mm - 1, dd);
      }
      return null;
    }

    function parseToHM(v) {
      if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, tz, 'HH:mm');
      var s = cleanText(v);
      if (!s) return '';
      var m = s.match(/(\d{1,2}):(\d{2})/);
      if (!m) return '';
      return String(m[1]).padStart(2, '0') + ':' + String(m[2]);
    }

    function fmtHM(hm) { return hm ? (hm + ' น.') : ''; }

    function normalizePlateList(raw) {
      var s = cleanText(raw);
      if (!s) return [];
      var parts = s.split(',').map(function (x) { return cleanText(x); }).filter(Boolean);

      var out = [];
      parts.forEach(function (p) {
        var mm = p.match(/[ก-ฮ]{1,3}-\d{3,4}/g);
        if (mm && mm.length) mm.forEach(function (x) { out.push(cleanText(x)); });
        else out.push(p);
      });

      var seen = {};
      return out.filter(function (x) {
        x = cleanText(x);
        if (!x) return false;
        if (seen[x]) return false;
        seen[x] = true;
        return true;
      });
    }

    function statusKeyFromThai(v) {
      var s = cleanText(v).toLowerCase();
      if (!s) return 'pending';
      if (s.indexOf('ไม่ผ่าน') > -1 || s.indexOf('ไม่อนุมัติ') > -1 || s === 'rejected') return 'rejected';
      if (s.indexOf('ยกเลิก') > -1 || s === 'cancelled' || s === 'canceled') return 'cancelled';
      if (s.indexOf('อนุมัติ') > -1 || s === 'approved') return 'approved';
      if (s.indexOf('รอ') > -1 || s.indexOf('pending') > -1) return 'pending';
      return 'pending';
    }

    function sortByStartTime(arr) {
      arr.sort(function (a, b) {
        var ta = a.startTime || '';
        var tb = b.startTime || '';
        if (ta === tb) return 0;
        if (!ta) return 1;
        if (!tb) return -1;
        return ta < tb ? -1 : 1;
      });
    }

    // --- read sheet (map header) ---
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Data');
    if (!sh) return null;

    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return null;

    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return cleanText(h); });
    var map = {};
    headers.forEach(function (h, i) { if (h) map[h] = i; });

    function getByHeader(row, headerName) {
      var p = map[headerName];
      if (p == null) return '';
      return row[p];
    }

    var targetISO = dateISO(d);
    var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

    var groups = { approved_full: [], approved_partial: [], pending: [], rejected: [], cancelled: [] };

    values.forEach(function (row) {
      var startDateObj = parseDateAny(getByHeader(row, 'วันเริ่มต้น'));
      if (!startDateObj) return;

      var endDateObj = parseDateAny(getByHeader(row, 'วันสิ้นสุด'));
      var isoList = buildLocalDateRangeList(startDateObj, endDateObj, tz);
      if (isoList.indexOf(targetISO) === -1) return;

      var baseKey = statusKeyFromThai(getByHeader(row, 'สถานะ'));

      var it = {
        place: cleanText(getByHeader(row, 'สถานที่')),
        user: cleanText(getByHeader(row, 'ชื่อ-สกุล')),
        position: cleanText(getByHeader(row, 'ตำแหน่ง')),
        pax: getByHeader(row, 'จำนวนผู้ร่วมเดินทาง'),
        purpose: cleanText(getByHeader(row, 'งาน/โครงการ')),
        carType: cleanText(getByHeader(row, 'ประเภทรถ')),
        vCount: cleanText(getByHeader(row, 'จำนวนรถที่ต้องการ')) || '1',
        id: cleanText(getByHeader(row, 'Booking ID')),
        startTime: parseToHM(getByHeader(row, 'เวลาเริ่มต้น')),
        endTime: parseToHM(getByHeader(row, 'เวลาสิ้นสุด')),
        vehicleSelected: cleanText(getByHeader(row, 'รถที่เลือก')),
        plate: cleanText(getByHeader(row, 'เลขทะเบียนรถ')),
        driver: cleanText(getByHeader(row, 'พนักงานขับรถ')),
        fileUrl: cleanText(getByHeader(row, 'File')),
        reason: cleanText(getByHeader(row, 'Reason')),
        cancelReason: cleanText(getByHeader(row, 'CancelReason'))
      };

      var req = parseInt(cleanText(it.vCount), 10);
      req = (isFinite(req) && req > 0) ? req : 1;
      var plates = normalizePlateList(it.vehicleSelected || it.plate || '');
      var approvedCount = plates.length;

      var finalKey = baseKey;
      if (baseKey === 'approved') {
        finalKey = (approvedCount > 0 && approvedCount < req) ? 'approved_partial' : 'approved_full';
      }

      it.reqCountNum = req;
      it.approvedPlates = plates;
      it.approvedCount = approvedCount;

      groups[finalKey].push(it);
    });

    // sort each group by start time
    sortByStartTime(groups.approved_full);
    sortByStartTime(groups.approved_partial);
    sortByStartTime(groups.pending);
    sortByStartTime(groups.rejected);
    sortByStartTime(groups.cancelled);

    function sumRequestedCars(groupsObj) {
      var total = 0;
      ['approved_full', 'approved_partial', 'pending', 'rejected', 'cancelled'].forEach(function (k) {
        (groupsObj[k] || []).forEach(function (it) {
          var n = parseInt(cleanText(it.vCount), 10);
          total += (isFinite(n) && n > 0) ? n : 1;
        });
      });
      return total;
    }

    var totalJobs =
      groups.approved_full.length +
      groups.approved_partial.length +
      groups.pending.length +
      groups.rejected.length +
      groups.cancelled.length;

    var totalCars = sumRequestedCars(groups);

    var lines = [];
    lines.push('📋 สรุปงานยานพาหนะประจำวัน');
    lines.push('📅 ' + fmtDateBE(d));

    if (totalJobs === 0) {
      lines.push('');
      lines.push('🍃 วันนี้ไม่มีรายการจองยานพาหนะค่ะ');
      lines.push('(ระบบเปิดรับจองตามปกติ)');
      lines.push('');
      lines.push('— ออกรายงานอัตโนมัติ 05:00 น. —');
      return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    lines.push('📊 รวมทั้งหมด: ' + totalJobs + ' งาน');
    lines.push('🚗 รวมจำนวนรถที่ขอ: ' + totalCars + ' คัน');
    lines.push(
      '⏳ รอ: ' + groups.pending.length +
      ' | ✅ อนุมัติครบ: ' + groups.approved_full.length +
      ' | 🟠 บางส่วน: ' + groups.approved_partial.length +
      ' | ⛔ ไม่อนุมัติ: ' + groups.rejected.length +
      ' | 🚫 ยกเลิก: ' + groups.cancelled.length
    );
    lines.push('— ออกรายงานอัตโนมัติ 05:00 น. —');

    function fmtTimeRange(it) {
      var a = it.startTime ? fmtHM(it.startTime) : '';
      var b = it.endTime ? fmtHM(it.endTime) : '';
      if (a && b) return a + '-' + b;
      if (a) return a;
      if (b) return b;
      return '';
    }

    function renderGroup(titleLine, arr, kind) {
      if (!arr || arr.length === 0) return;

      lines.push('');
      lines.push(titleLine);

      for (var i = 0; i < arr.length; i++) {
        var it = arr[i];
        var idx = i + 1;

        var tr = fmtTimeRange(it);
        var place = safeText(it.place);
        var user = safeText(it.user);

        var pos = normalizePosition(it.position);
        var userLine = user + (pos ? (' (' + pos + ')') : '');

        var paxLabel = formatPassengers(it.pax);
        var purpose = safeText(it.purpose);
        var carType = normalizeVehicleTypeLabel_(it.carType) || '-';

        var approvedLine = '';
        if (kind === 'approved_full') {
          approvedLine = '✅ อนุมัติจริง: ' + it.approvedCount + ' คัน';
        } else if (kind === 'approved_partial') {
          approvedLine = '🟠 อนุมัติจริง ' + it.approvedCount + ' จาก ' + it.reqCountNum + ' คัน';
        } else {
          // pending/rejected/cancelled: show requested count
          approvedLine = '🚗 จำนวนที่ขอ: ' + it.reqCountNum + ' คัน';
        }

        var head = idx + ') ';
        if (tr) head += tr + ' : ' + place;
        else head += place;

        lines.push(head);
        lines.push('   👤 ' + userLine);
        lines.push('   👥 ผู้ร่วมเดินทาง: ' + paxLabel);
        lines.push('   📝 งาน/โครงการ: ' + purpose);
        lines.push('   🚐 ประเภทรถ: ' + carType);
        lines.push('   ' + approvedLine);

        if ((kind === 'approved_full' || kind === 'approved_partial') && it.approvedPlates && it.approvedPlates.length) {
          lines.push('   ✅ รถที่อนุมัติจริง: ' + it.approvedPlates.join(', '));
          if (!isEmpty(it.driver)) lines.push('   🧑‍✈️ คนขับ: ' + cleanText(it.driver));
        } else {
          if (!isEmpty(it.driver)) lines.push('   🧑‍✈️ คนขับ: ' + cleanText(it.driver));
        }

        if (!isEmpty(it.id)) lines.push('   🆔 Booking ID: ' + cleanText(it.id));

        if (kind === 'rejected' || kind === 'cancelled') {
          var rs = (kind === 'cancelled') ? (cleanText(it.cancelReason) || cleanText(it.reason)) : cleanText(it.reason);
          if (!isEmpty(rs)) lines.push('   💬 เหตุผล: ' + rs);
        }

        if (!isEmpty(it.fileUrl)) lines.push('   📎 ไฟล์แนบ: ' + cleanText(it.fileUrl));
      }
    }

    // order: approved_full -> approved_partial -> pending -> rejected -> cancelled
    renderGroup('✅ อนุมัติครบ', groups.approved_full, 'approved_full');
    renderGroup('🟠 อนุมัติบางส่วน', groups.approved_partial, 'approved_partial');
    renderGroup('⏳ รออนุมัติ', groups.pending, 'pending');
    renderGroup('⛔ ไม่อนุมัติ', groups.rejected, 'rejected');
    renderGroup('🚫 ยกเลิก', groups.cancelled, 'cancelled');

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  } catch (e) {
    Logger.log('buildDailySummaryTelegram_ error: ' + e);
    return null;
  }
}



function _uniqCsv_(text) {
  var s = String(text || '').trim();
  if (!s) return '';
  var parts = s.split(',').map(function(x){ return String(x || '').trim(); }).filter(function(x){ return !!x; });
  var seen = {};
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var k = parts[i];
    if (!seen[k]) { seen[k] = true; out.push(k); }
  }
  return out.join(', ');
}

function _shouldShowRequestedVehicle_(carType, vCount) {
  var ct = String(carType || '').trim();
  var vc = String(vCount || '').trim();
  if (vc && vc !== '1') return true;
  if (ct.indexOf('+') >= 0) return true;
  return false;
}

function fmtThaiDateBE(d) {
  var tz =
    (typeof VB_CFG !== 'undefined' && VB_CFG && VB_CFG.TZ) ? VB_CFG.TZ :
    ((typeof TZ !== 'undefined' && TZ) ? TZ : 'Asia/Bangkok');

  var x = d;

  if (!(x instanceof Date)) {
    var s = String(x || '').trim();
    if (!s || s === '-') return '-';

    var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) x = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    else x = new Date(s);
  }

  if (!(x instanceof Date) || isNaN(x.getTime())) return '-';

  var ad = x.getFullYear();
  var be = (ad < 2400) ? (ad + 543) : ad;
  return Utilities.formatDate(x, tz, 'dd/MM/') + be;
}

// ANCHOR: dailyVehicleSummaryIntegratedFix

function buildDailyReport(targetDate) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Data');
  if (!sh) return "ไม่พบชีต Data";

  var tz = Session.getScriptTimeZone() || "Asia/Bangkok";
  var d = (targetDate instanceof Date) ? targetDate : new Date();
  var targetISO = Utilities.formatDate(d, tz, "yyyy-MM-dd");

  // 1. แมป Header (ใช้ฟังก์ชันเดิมที่มีในระบบ)
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function(h) { return String(h || '').trim(); });
  var idx = headerIndex_(headers);

  // 2. ตัวช่วยอ่านค่าจาก Header แบบปลอดภัย
  function getVal(row, key) {
    var p = idx[key];
    return (p !== undefined && p !== -1) ? String(row[p] || '').trim() : '';
  }

  // 3. กรองและจัดกลุ่มข้อมูล
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var groups = { pending: [], approved: [], rejected: [], cancelled: [] };
  var stats = { totalJobs: 0, totalCars: 0 };

  values.forEach(function(row) {
    var rowDateISO = parseDateToISO_(row[idx.startDate]);
    if (rowDateISO !== targetISO) return;

    var statusRaw = getVal(row, 'status').toLowerCase();
    var stKey = "pending";
    if (statusRaw.indexOf('อนุมัติ') > -1 || statusRaw === 'approved') stKey = 'approved';
    else if (statusRaw.indexOf('ไม่') > -1 || statusRaw === 'rejected') stKey = 'rejected';
    else if (statusRaw.indexOf('ยกเลิก') > -1 || statusRaw === 'cancelled') stKey = 'cancelled';

    // ดึงจำนวนรถจากคอลัมน์ 22
    var vCount = parseInt(getVal(row, 'vehicleCount')) || 1;
    
    // ดึงทะเบียนรถ (ถ้าทะเบียนหลักว่าง ให้ไปดึงจากคอลัมน์ "รถที่เลือก")
    var plate = getVal(row, 'vehicle');
    if (!plate || plate === '-') plate = getVal(row, 'requestedVehicle');

    var item = {
      place: getVal(row, 'destination'),
      user: getVal(row, 'name'),
      pax: getVal(row, 'passengers') || '1',
      purpose: getVal(row, 'project'),
      carType: getVal(row, 'carType'),
      plate: (plate && plate !== '-') ? plate : '',
      driver: getVal(row, 'driver'),
      vCount: vCount,
      id: getVal(row, 'bookingId'),
      reason: getVal(row, 'reason'),
      file: getVal(row, 'fileUrl'),
      cancel: getVal(row, 'cancelReason'),
      startTime: getVal(row, 'startTime') // เก็บไว้ Sort
    };

    groups[stKey].push(item);
    stats.totalJobs++;
    stats.totalCars += vCount;
  });

  // 4. สร้างข้อความรายงาน
  var thYear = parseInt(Utilities.formatDate(d, tz, "yyyy")) + 543;
  var thDate = Utilities.formatDate(d, tz, "dd/MM/") + thYear;

  var lines = [
    '📋 <b>สรุปงานยานพาหนะประจำวัน</b>',
    '📅 <b>' + thDate + '</b>',
    '📊 <b>รวมทั้งหมด: ' + stats.totalJobs + ' งาน</b>',
    '🚗 <b>รวมจำนวนรถที่ขอ: ' + stats.totalCars + ' คัน</b>',
    '🟡 รอ: ' + groups.pending.length + ' | ✅ อนุมัติ: ' + groups.approved.length + ' | ⛔ ไม่ผ่าน: ' + groups.rejected.length + ' | 🚫 ยกเลิก: ' + groups.cancelled.length,
    ''
  ];

  if (groups.approved.length > 0) {
    lines.push('<b>✅ รายการที่อนุมัติแล้ว (' + groups.approved.length + ')</b>', '');
    
    // เรียงตามเวลาไป
    groups.approved.sort(function(a, b) { return a.startTime.localeCompare(b.startTime); });

    groups.approved.forEach(function(it) {
      lines.push('🔹 ' + it.place);
      lines.push('👤 ' + it.user + ' (' + it.pax + ' คน)');
      lines.push('📝 ' + it.purpose);
      lines.push('🚗 จำนวนรถที่ต้องการ: ' + it.vCount + ' คัน');
      
      // ทะเบียนรถ: ห้ามโชว์ (-)
      var plateDisplay = it.plate ? ' (' + it.plate + ')' : '';
      lines.push('🚐 ' + (normalizeVehicleTypeLabel_(it.carType) || '-') + plateDisplay);
      
      if (it.driver && it.driver !== '-') lines.push('🧑‍✈️ ' + it.driver);
      lines.push('🆔 ' + it.id);
      
      // ฟิลด์เสริม: ถ้าว่างห้ามแสดง
      if (it.reason && it.reason !== '-') lines.push('💬 ' + it.reason);
      if (it.file && it.file !== '-') lines.push('📎 ' + it.file);
      lines.push('');
    });
  }

  lines.push('— ออกรายงานอัตโนมัติ 05:00 น. —');

  // 5. Final Sanitize: กวาดล้าง Sat และ D น. รอบสุดท้าย
  var finalMsg = lines.join('\n')
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/gi, '') // ลบชื่อวัน
    .replace(/D\s*น\./g, '')                           // ลบ D น.
    .replace(/\s{2,}/g, ' ')                           // ลบช่องว่างซ้ำซ้อน
    .trim();

  return finalMsg;
}

/* 🍓 [BERRY FIXED] ฟังก์ชันสำหรับ Trigger ตอนตี 5 (รันแบบห้ามส่งซ้ำ) */
function dailySummaryAt5am() {
  Logger.log("⏰ Trigger: dailySummaryAt5am run");
  sendDailySummaryNotification(false); // false = ห้ามส่งซ้ำเด็ดขาด
}

/* 🍓 [BERRY FIXED] แกนหลักในการส่ง Report (รองรับระบบกันส่งซ้ำ) */
function sendDailySummaryNotification(forceSend) {
  try {
    var tz = "Asia/Bangkok";
    var now = new Date();

    Logger.log("===== DAILY REPORT TRIGGER START =====");
    Logger.log("Current Time: " + Utilities.formatDate(now, tz, "yyyy-MM-dd HH:mm:ss"));

    var reportPages = getIntegratedDailyReport(now, { asPages: true });
    if (!Array.isArray(reportPages)) reportPages = [reportPages];
    var msg = reportPages[0] || '';

    if (!msg || msg.indexOf('ไม่พบชีต Data') > -1) {
      Logger.log("❌ REPORT EMPTY OR ERROR → NOT SENDING");
      return;
    }

    Logger.log("📄 REPORT GENERATED PAGES: " + reportPages.length + " | FIRST LENGTH: " + msg.length);

    // กุญแจกันส่งซ้ำประจำวัน (1 วันส่งได้ครั้งเดียวต่อ 1 คีย์)
    var dedupeKey = 'DAILY_REPORT_' + Utilities.formatDate(now, tz, 'yyyyMMdd');
    Logger.log("DedupeKey: " + dedupeKey);

    // ส่งเข้า Telegram พร้อมระบบป้องกันการเบิ้ล
    var results = [];
    for (var p = 0; p < reportPages.length; p++) {
      var pageMsg = reportPages[p];
      if (!String(pageMsg || '').trim()) continue;
      if (String(pageMsg).length > 4096) {
        Logger.log("❌ DAILY REPORT PAGE TOO LONG: page=" + (p + 1) + " length=" + String(pageMsg).length);
        results.push({ ok: false, error: 'Telegram page exceeds 4096 chars', page: p + 1, length: String(pageMsg).length });
        continue;
      }

      var pageKey = (reportPages.length === 1)
        ? dedupeKey
        : (dedupeKey + '_P' + (p + 1) + '_OF_' + reportPages.length);
      var res = sendTelegramOnce(pageMsg, {
        parse_mode: 'HTML',
        disable_preview: true,
        dedupeKey: pageKey,
        force: forceSend === true // 🍓 ถ้าไม่ได้สั่ง force = true จะไม่ยอมส่งซ้ำค่ะ
      });
      results.push(res);
    }

    Logger.log("📤 TELEGRAM RESULT: " + JSON.stringify(results));
    Logger.log("===== DAILY REPORT TRIGGER END =====");

  } catch (e) {
    Logger.log("❌ ERROR sendDailySummaryNotification: " + e.message);
    Logger.log(e.stack);
  }
}

/* ====== TRIGGERS: create/list/check (05:00 daily) ====== */
function _vbListTriggers_() {
  var out = [];
  var ts = ScriptApp.getProjectTriggers() || [];
  for (var i = 0; i < ts.length; i++) {
    try {
      out.push({
        handler: ts[i].getHandlerFunction && ts[i].getHandlerFunction(),
        type: String(ts[i].getEventType && ts[i].getEventType()),
      });
    } catch (_){}
  }
  return out;
}

function installReminderTriggers() {
  var ts = ScriptApp.getProjectTriggers() || [];
  for (var i = 0; i < ts.length; i++) {
    try {
      var h = ts[i].getHandlerFunction ? ts[i].getHandlerFunction() : '';
      // 🍓 เพิ่มการค้นหาตัวที่ชื่อ sendDailySummaryNotification เพื่อลบทิ้งด้วย
      if (h === 'runAllReminders_' || h === 'dailySummaryAt5am_' || h === 'dailySummaryAt5am' || h === 'sendDailySummaryNotification') {
        ScriptApp.deleteTrigger(ts[i]);
      }
    } catch (_){}
  }
  
  // สร้างใหม่ให้เหลือแค่ 2 ตัวที่ถูกต้อง
  ScriptApp.newTrigger('runAllReminders_').timeBased().atHour(5).nearMinute(0).everyDays(1).create();
  ScriptApp.newTrigger('dailySummaryAt5am').timeBased().atHour(5).nearMinute(0).everyDays(1).create();
  
  var listed = _vbListTriggers_();
  try { Logger.log('installReminderTriggers: ' + JSON.stringify(listed)); } catch(_){}
  return { ok:true, triggers: listed };
}

/* API ให้เรียกจากหน้าเว็บ/ selfTest */
function apiInstallReminderTriggers(){
  try{
    var res = installReminderTriggers_();
    return _ok_(res);
  }catch(e){
    try { Logger.log('apiInstallReminderTriggers error: ' + e.stack); } catch(_){}
    return _err_(e);
  }
}

function apiListReminderTriggers(){
  try{
    var list = _vbListTriggers_();
    try{
      Logger.log('ReminderTriggers: ' + JSON.stringify(list));
      if (!list || !list.length) Logger.log('ReminderTriggers: EMPTY');
      else {
        for (var i=0;i<list.length;i++){
          Logger.log('Trigger['+i+'] ' + list[i].handler + ' | ' + list[i].type);
        }
      }
    }catch(_){}
    return _ok_({ triggers: list });
  }catch(e){
    try{ Logger.log('apiListReminderTriggers error: ' + e.stack); }catch(_){}
    return _err_(e);
  }
}

/* Dry-run ตรวจสอบและส่งแจ้งเตือน (ใช้ทดสอบจาก UI) */
function apiRunAllReminders(){
  try{
    var res = runAllReminders_();
    return _ok_(res);
  }catch(e){
    try { Logger.log('apiRunAllReminders error: ' + e.stack); } catch(_){}
    return _err_(e);
  }
}


function apiReminderScanDebug(){
  try{
    var leadI = _vb_getSettingNumber('InsuranceReminderDays', VB_CFG && VB_CFG.ADVANCE_DAYS || 3);
    var leadM = _vb_getSettingNumber('MaintenanceReminderDays', VB_CFG && VB_CFG.ADVANCE_DAYS || 3);
    var now = new Date();

    var insRaw = _vb_collectInsuranceDue_();
    var maiRaw = _vb_collectMaintenanceDue_();

    function mapInfo(arr, lead){
      return arr.map(function(it){
        var days = _vb_daysDiff(now, it.due);
        return {
          sheet: it.source,
          plate: it.plate,
          dueISO: Utilities.formatDate(it.due, TZ, 'yyyy-MM-dd\'T\'HH:mm'),
          daysToDue: days,
          withinWindow: (days >= 0 && days <= lead),
          reason: (days < 0 ? 'expired' : (days > lead ? 'not_in_window' : 'ok'))
        };
      });
    }

    var ins = mapInfo(insRaw, leadI);
    var mai = mapInfo(maiRaw, leadM);

    Logger.log('ReminderScanDebug insuranceRaw=' + insRaw.length + ' maintenanceRaw=' + maiRaw.length);
    if (ins.length) Logger.log(JSON.stringify(ins.slice(0,10)));
    if (mai.length) Logger.log(JSON.stringify(mai.slice(0,10)));

    return _ok_({
      leadDays: { insurance: leadI, maintenance: leadM },
      insurance: ins,
      maintenance: mai
    });
  }catch(e){
    Logger.log('apiReminderScanDebug error: ' + e.stack);
    return _err_(e);
  }
}

/* Self-test: เช็คเตือนประกันใกล้หมดอายุ + รถใกล้กำหนดเข้าศูนย์
 * default = dry-run (ไม่ส่ง Telegram)
 * ถ้าต้องการส่งจริงให้เรียก: selfTestReminderNotifications({ forceSend: true })
 */
function selfTestReminderNotifications(opts){
  try{
    var forceSend = !!(opts && opts.forceSend === true);
    var scanRes = apiReminderScanDebug();
    if (!scanRes || scanRes.ok !== true){
      return scanRes || { ok:false, error:'scan failed' };
    }

    var scanData = scanRes.data || {};
    var ins = Array.isArray(scanData.insurance) ? scanData.insurance : [];
    var mai = Array.isArray(scanData.maintenance) ? scanData.maintenance : [];

    var insWithin = ins.filter(function(x){ return !!(x && x.withinWindow); }).length;
    var maiWithin = mai.filter(function(x){ return !!(x && x.withinWindow); }).length;

    var sendRes = null;
    if (forceSend){
      sendRes = runAllReminders_();
    }

    var summary = {
      mode: forceSend ? 'send_real' : 'dry_run',
      leadDays: scanData.leadDays || { insurance: 3, maintenance: 3 },
      insurance: { total: ins.length, withinWindow: insWithin },
      maintenance: { total: mai.length, withinWindow: maiWithin },
      sendResult: sendRes
    };

    Logger.log('selfTestReminderNotifications => ' + JSON.stringify(summary));
    return { ok:true, data: summary };
  }catch(e){
    try{ Logger.log('selfTestReminderNotifications error: ' + e.stack); }catch(_){}
    return { ok:false, error: e.message };
  }
}

/* Self-test: ส่งแจ้งเตือนจริงด้วยข้อมูลจำลอง (ไม่แตะชีตจริง)
 * ตัวอย่าง: selfTestReminderNotificationsWithMock({ tag: 'UAT' })
 */
function selfTestReminderNotificationsWithMock(opts){
  try{
    var now = new Date();
    var tag = String((opts && opts.tag) || 'MOCK').trim();
    var insuranceInput = (opts && Array.isArray(opts.insurance)) ? opts.insurance : [
      { plate: 'TEST-INS-001', due: new Date(now.getTime() + 24 * 60 * 60 * 1000), source: 'MockInsurance' },
      { plate: 'TEST-INS-002', due: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), source: 'MockInsurance' }
    ];
    var maintenanceInput = (opts && Array.isArray(opts.maintenance)) ? opts.maintenance : [
      { plate: 'TEST-MAI-001', due: new Date(now.getTime() + 24 * 60 * 60 * 1000), source: 'MockMaintenance' },
      { plate: 'TEST-MAI-002', due: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), source: 'MockMaintenance' }
    ];

    function toDateSafe(v){
      if (v instanceof Date && !isNaN(v.getTime())) return v;
      var d = _vb_parseDate(v);
      return (d && !isNaN(d.getTime())) ? d : null;
    }

    function sendMock(list, kind){
      var sent = 0;
      var total = 0;
      var errors = [];
      var details = [];
      for (var i = 0; i < list.length; i++){
        var row = list[i] || {};
        var plate = String(row.plate || '').trim();
        var due = toDateSafe(row.due);
        var source = String(row.source || ('Mock' + kind)).trim();
        if (!plate || !due) continue;
        total++;

        var dd = _vb_fmtThaiDate(due) + ' เวลา ' + _vb_fmtThaiTime(due);
        var msg = (kind === 'insurance'
          ? '🛡️ [TEST] แจ้งเตือนประกันใกล้หมดอายุ\n'
          : '🧰 [TEST] แจ้งเตือนกำหนดเข้ารับบริการซ่อมครั้งถัดไป\n')
          + 'ทะเบียน: ' + plate + '\n'
          + (kind === 'insurance' ? 'ครบกำหนด: ' : 'กำหนด: ') + dd + '\n'
          + 'แหล่งข้อมูล: ' + source + '\n'
          + 'Tag: ' + tag;

        var dedupeKey = 'REM:TEST:' + kind.toUpperCase() + ':' + tag + ':' + plate + ':' + Utilities.formatDate(due, TZ, 'yyyyMMddHHmm');
        var r = sendTelegramOnce(msg, { parse_mode:'HTML', disable_preview:true, dedupeKey:dedupeKey, force:true });
        if (r && r.ok){
          sent++;
          details.push({ plate: plate, dueISO: due.toISOString(), ok: true });
        }else{
          var err = (r && r.error) ? r.error : 'send_failed';
          errors.push({ plate: plate, error: err });
          details.push({ plate: plate, dueISO: due.toISOString(), ok: false, error: err });
        }
      }
      return { sent: sent, total: total, errors: errors, details: details };
    }

    var insRes = sendMock(insuranceInput, 'insurance');
    var maiRes = sendMock(maintenanceInput, 'maintenance');
    var summary = {
      mode: 'mock_send_real',
      tag: tag,
      insurance: insRes,
      maintenance: maiRes
    };
    Logger.log('selfTestReminderNotificationsWithMock => ' + JSON.stringify(summary));
    return { ok:true, data: summary };
  }catch(e){
    try{ Logger.log('selfTestReminderNotificationsWithMock error: ' + e.stack); }catch(_){}
    return { ok:false, error: e.message };
  }
}

/** 🛡️ รายงานประกันภัยประจำปี (Server Side - Smart Robust Version) */
function apiGenerateInsuranceAnnualPdf() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('Insurance');
    if (!sh) throw new Error("ไม่พบชีต Insurance ในระบบค่ะ");

    const now = new Date();
    const currentYear = now.getFullYear(); // 2026
    const tz = Session.getScriptTimeZone();
    
    const data = _sheetApiGetValues_(sh, 1, 1, sh.getLastRow(), sh.getLastColumn(), 'checkResourcesConflict_ read');
    if (data.length < 2) throw new Error("ยังไม่มีข้อมูลในฐานข้อมูลประกันภัยค่ะ");

    // 1. Map Header Indices (ดึงตามชื่อคอลัมน์)
    const head = data[0].map(h => String(h||'').trim());
    const idx = {
      plate: head.indexOf('Plate'),
      provider: head.indexOf('Provider'),
      policy: head.indexOf('PolicyNumber'),
      start: head.indexOf('StartDate'),
      end: head.indexOf('EndDate'),
      status: head.indexOf('Status'),
      cost: head.indexOf('Cost'),
      remark: head.indexOf('Remark')
    };

    // เช็คคอลัมน์บังคับ
    if (idx.plate === -1 || idx.start === -1 || idx.end === -1) {
      throw new Error("หัวตารางชีต Insurance ไม่ถูกต้อง (ต้องมี Plate, StartDate, EndDate)");
    }

    let allProcessed = [];
    
    // 2. อ่านข้อมูลทั้งหมดและแปลงเป็น Object
    for (let i = 1; i < data.length; i++) {
      let r = data[i];
      let sISO = parseDateToISO_(r[idx.start]);
      let eISO = parseDateToISO_(r[idx.end]);
      if (!sISO) continue;

      let startDateObj = new Date(sISO + 'T00:00:00');
      let endDateObj = eISO ? new Date(eISO + 'T00:00:00') : startDateObj;
      let costVal = parseFloat(String(r[idx.cost]||'0').replace(/,/g,'')) || 0;

      allProcessed.push({
        plate: String(r[idx.plate] || '-'),
        provider: String(r[idx.provider] || '-'),
        policy: String(r[idx.policy] || '-'),
        startDate: startDateObj,
        endDate: endDateObj,
        costNum: costVal,
        status: String(r[idx.status] || '-'),
        remark: String(r[idx.remark] || '-')
      });
    }

    // 3. Smart Filtering (กรองที่คาบเกี่ยวปีปัจจุบัน)
    let list = allProcessed.filter(item => {
      let startY = item.startDate.getFullYear();
      let endY = item.endDate.getFullYear();
      // เงื่อนไข: เริ่มในปีนี้ OR จบในปีนี้ OR คุ้มครองยาวข้ามปีนี้
      return (startY === currentYear || endY === currentYear || (startY < currentYear && endY > currentYear));
    });

    let periodNote = "";
    // 4. Fallback: ถ้าปีปัจจุบันไม่มีเลย ให้เอา "ข้อมูลล่าสุดทั้งหมด" ในชีตมาโชว์
    if (list.length === 0 && allProcessed.length > 0) {
      list = allProcessed.sort((a,b) => b.startDate - a.startDate).slice(0, 30);
      periodNote = "(แสดงข้อมูลล่าสุดย้อนหลัง เนื่องจากปีปัจจุบันยังไม่มีรายการใหม่)";
    }

    // 5. สรุปสถิติจากรายการที่เลือก
    let stats = { total: 0, active: 0, expired: 0, cost: 0 };
    list.forEach(item => {
      stats.total++;
      stats.cost += item.costNum;
      
      let isStillActive = (item.status.toLowerCase().includes('active') || item.status.includes('คุ้มครอง') || item.endDate >= now);
      if (isStillActive) stats.active++; else stats.expired++;

      // แปลงค่าพร้อมโชว์ใน PDF
      item.startTxt = Utilities.formatDate(item.startDate, tz, "dd/MM/") + (item.startDate.getFullYear() + 543);
      item.endTxt = Utilities.formatDate(item.endDate, tz, "dd/MM/") + (item.endDate.getFullYear() + 543);
      item.costTxt = item.costNum.toLocaleString('th-TH', {minimumFractionDigits: 2});
      item.statusTxt = isStillActive ? "คุ้มครอง" : "หมดอายุ";
    });

    // 6. ส่งข้อมูลให้ Template
    const tpl = HtmlService.createTemplateFromFile('InsuranceReport');
    tpl.list = list.sort((a,b) => a.plate.localeCompare(b.plate));
    tpl.stats = stats;
    tpl.yearBE = currentYear + 543;
    tpl.periodNote = periodNote;
    tpl.generatedAt = Utilities.formatDate(now, tz, "dd/MM/") + (currentYear+543) + " " + Utilities.formatDate(now, tz, "HH:mm") + " น.";
    tpl.systemName = 'ระบบจองยานพาหนะ มหาวิทยาลัยสวนดุสิต';

    // 7. เจน PDF
    const html = tpl.evaluate().getContent();
    const url = __vb_htmlToPdfUrl__("Insurance_Annual_Report_" + (currentYear + 543), html);
    return { ok: true, url: url };

  } catch (e) {
    Logger.log("apiGenerateInsuranceAnnualPdf Error: " + e.stack);
    return { ok: false, error: e.message };
  }
}

/** 🔧 รายงานซ่อมบำรุงรายเดือน (Server Side - Full Robust Version) */
function apiGenerateMaintenanceMonthlyPdf() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('Maintenance');
    if (!sh) throw new Error("ไม่พบชีต Maintenance ในระบบค่ะ");

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const tz = Session.getScriptTimeZone();
    const monthNames = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

    const data = sh.getDataRange().getValues();
    if (data.length < 2) throw new Error("ยังไม่มีข้อมูลการซ่อมบำรุงในฐานข้อมูลค่ะ");

    // 1. Map Header Indices
    const head = data[0].map(h => String(h||'').trim());
    const idx = {
      plate: head.indexOf('Vehicle'),
      date: head.indexOf('Date'),
      type: head.indexOf('Type'),
      cost: head.indexOf('Cost'),
      remark: head.indexOf('Remark'),
      next: head.indexOf('NextDueDate')
    };

    // ตรวจสอบคอลัมน์สำคัญ
    if (idx.plate === -1 || idx.date === -1 || idx.cost === -1) {
      throw new Error("โครงสร้างหัวตารางในชีต Maintenance ไม่ถูกต้อง (ต้องมี Vehicle, Date, Cost)");
    }

    let allProcessed = [];
    let plateStats = {};
    let typeStats = {};

    // 2. Process All Rows
    for (let i = 1; i < data.length; i++) {
      let r = data[i];
      let plate = String(r[idx.plate] || '-').trim();
      if (!plate || plate === '-') continue;

      // ใช้ฟังก์ชัน Robust Date Parsing ที่บอสเพิ่งอัปเกรดไป
      let dISO = parseDateToISO_(r[idx.date]);
      if (!dISO) continue;
      
      let dt = parseDateTime_(dISO, "00:00");
      let costVal = parseFloat(String(r[idx.cost]||'0').replace(/,/g,'')) || 0;
      let serviceType = String(r[idx.type] || 'ทั่วไป');

      allProcessed.push({
        plate: plate,
        type: serviceType,
        dateObj: dt,
        year: dt.getFullYear(),
        month: dt.getMonth(),
        costNum: costVal,
        costTxt: costVal.toLocaleString('th-TH', {minimumFractionDigits: 2}),
        next: r[idx.next] ? parseDateToISO_(r[idx.next]) : null,
        remark: String(r[idx.remark] || '-')
      });
    }

    // 3. Filtering Logic (ดึงเดือนปัจจุบัน ถ้าไม่มีเอาล่าสุด)
    let list = allProcessed.filter(item => item.month === currentMonth && item.year === currentYear);
    let reportPeriod = monthNames[currentMonth] + " " + (currentYear + 543);

    if (list.length === 0) {
      // กรณีเดือนนี้ไม่มีข้อมูล -> ดึง 20 รายการล่าสุด
      list = allProcessed.sort((a,b) => b.dateObj - a.dateObj).slice(0, 20);
      reportPeriod = "ล่าสุด (ย้อนหลัง)";
    } else {
      // เรียงจากวันที่ล่าสุดไปเก่า
      list.sort((a,b) => b.dateObj - a.dateObj);
    }

    // 4. Calculate Summary Statistics
    let stats = { total: 0, cost: 0, topPlate: '-', topType: '-' };
    list.forEach(item => {
      stats.total++;
      stats.cost += item.costNum;
      plateStats[item.plate] = (plateStats[item.plate] || 0) + 1;
      typeStats[item.type] = (typeStats[item.type] || 0) + 1;
    });

    if (stats.total > 0) {
      stats.topPlate = Object.keys(plateStats).reduce((a, b) => plateStats[a] > plateStats[b] ? a : b);
      stats.topType = Object.keys(typeStats).reduce((a, b) => typeStats[a] > typeStats[b] ? a : b);
    }

    // 5. Prepare Template Data
    const tpl = HtmlService.createTemplateFromFile('MaintenanceReport');
    tpl.list = list.map(item => ({
      plate: item.plate,
      type: item.type,
      date: Utilities.formatDate(item.dateObj, tz, "dd/MM/") + (item.year + 543),
      cost: item.costTxt,
      next: item.next ? Utilities.formatDate(new Date(item.next), tz, "dd/MM/") + (new Date(item.next).getFullYear() + 543) : '-',
      remark: item.remark.length > 150 ? item.remark.substring(0, 147) + "..." : item.remark
    }));
    
    tpl.stats = {
      total: stats.total,
      cost: stats.cost.toLocaleString('th-TH', {minimumFractionDigits: 2}),
      topPlate: stats.topPlate,
      topType: stats.topType
    };
    tpl.period = reportPeriod;
    tpl.generatedAt = Utilities.formatDate(now, tz, "dd/MM/") + (currentYear+543) + " " + Utilities.formatDate(now, tz, "HH:mm") + " น.";
    tpl.systemName = 'ระบบจองยานพาหนะ มหาวิทยาลัยสวนดุสิต';

    // 6. Generate PDF URL
    const html = tpl.evaluate().getContent();
    const fileName = "Maint_Report_" + Utilities.formatDate(now, tz, "yyyyMMdd_HHmm");
    const url = __vb_htmlToPdfUrl__(fileName, html);

    return { ok: true, url: url };

  } catch (e) {
    Logger.log("apiGenerateMaintenanceMonthlyPdf Error: " + e.stack);
    return { ok: false, error: e.message };
  }
}

// ===== Triggers: Daily 05:00 Summary (Berry Fixed) =====
function installDailySummaryTrigger_() {
  try {
    var removed = 0;
    var all = ScriptApp.getProjectTriggers();
    for (var i = 0; i < all.length; i++) {
      var t = all[i];
      try {
        var h = t.getHandlerFunction ? t.getHandlerFunction() : '';
        // ลบทั้งตัวเก่า (มี _) และตัวใหม่ทิ้งก่อนสร้างใหม่
        if (h === 'dailySummaryAt5am_' || h === 'dailySummaryAt5am') {
          ScriptApp.deleteTrigger(t);
          removed++;
        }
      } catch (_){}
    }

    // 🍓 สร้างใหม่ ชี้ไปที่ฟังก์ชันหลัก (ไม่มี _)
    ScriptApp.newTrigger('dailySummaryAt5am')
      .timeBased()
      .atHour(5)
      .nearMinute(0)
      .everyDays(1)
      .inTimezone(Session.getScriptTimeZone())
      .create();

    var summary = listDailySummaryTriggers_();
    Logger.log('installDailySummaryTrigger_: removed=' + removed + ' now=' + JSON.stringify(summary));
    return { ok:true, removed: removed, now: summary };
  } catch (e) {
    Logger.log('installDailySummaryTrigger_ error: ' + e.stack);
    return { ok:false, error: e.message };
  }
}


// รายการ Trigger ที่เกี่ยวข้อง (ไว้ debug ใน selfTest)
function listDailySummaryTriggers_() {
  var out = [];
  var all = ScriptApp.getProjectTriggers();
  for (var i = 0; i < all.length; i++) {
    var t = all[i];
    var h = (t.getHandlerFunction && t.getHandlerFunction()) || '';
    if (h === 'dailySummaryAt5am' || h === 'dailySummaryAt5am_') {
      out.push({
        handler: h,
        type: String(t.getEventType && t.getEventType()),
        // ไม่มี method มาตรฐานให้ดึงชั่วโมง/นาทีตรง ๆ จาก trigger ที่สร้างแล้ว
        // จึงบันทึก handler ไว้ให้ตรวจด้วยชื่อแทน
      });
    }
  }
  return out;
}

// API เรียกจาก UI (google.script.run) เพื่อสร้าง Trigger และดู error ได้
function apiInstallDailySummaryTrigger() {
  try {
    var res = installDailySummaryTrigger_();
    return res && res.ok ? { ok:true, triggers: listDailySummaryTriggers_() } : res;
  } catch (e) {
    return { ok:false, error: e.message };
  }
}

// API ตรวจสุขภาพ Trigger + Telegram config
function apiDailySummaryHealth() {
  try {
    var cfg = getTelegramConfig();
    var trig = listDailySummaryTriggers_();
    return {
      ok: (!!cfg.token && !!cfg.chatId && trig.length > 0),
      telegram: { token: !!cfg.token, chatId: !!cfg.chatId },
      triggers: trig
    };
  } catch (e) {
    return { ok:false, error: e.message };
  }
}

// ยิงแจ้งเตือน Telegram ซ้ำสำหรับ "งานล่าสุดที่อนุมัติแล้ว" ทันที
function apiNotifyLatestApprovedTelegram(payload) {
  try {
    payload = payload || {};
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (e0) {}
    }

    var testMode = payload.testMode === true;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Data');
    if (!sh) return { ok: false, error: 'ไม่พบชีต "Data"' };

    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 1) {
      return { ok: false, error: 'ไม่พบข้อมูลในชีต Data' };
    }

    var headersRow = _sheetApiGetValues_(sh, 1, 1, 1, lastCol, 'apiNotifyLatestApprovedTelegram headers');
    var headers = (headersRow && headersRow[0]) ? headersRow[0].map(function(h){ return String(h || '').trim(); }) : [];
    var idx = (typeof headerIndex_ === 'function') ? headerIndex_(headers) : {};

    function normalizeIdx(v) {
      if (v === -1 || v == null || v === '' || v === false) return undefined;
      return v;
    }
    function colIndexByName(name) {
      var i = headers.indexOf(name);
      return (i >= 0) ? i : undefined;
    }

    idx = idx || {};
    if (idx.bookingId === undefined) idx.bookingId = colIndexByName('Booking ID');
    if (idx.status === undefined) idx.status = colIndexByName('สถานะ');
    idx.bookingId = normalizeIdx(idx.bookingId);
    idx.status = normalizeIdx(idx.status);

    if (idx.bookingId === undefined) return { ok: false, error: 'ไม่พบคอลัมน์ "Booking ID"' };
    if (idx.status === undefined) return { ok: false, error: 'ไม่พบคอลัมน์ "สถานะ"' };

    var rows = _sheetApiGetValues_(sh, 2, 1, lastRow - 1, lastCol, 'apiNotifyLatestApprovedTelegram rows');
    var foundOffset = -1;
    for (var i = rows.length - 1; i >= 0; i--) {
      var statusText = String(rows[i][idx.status] == null ? '' : rows[i][idx.status]).toLowerCase().trim();
      if (statusText.indexOf('approved') > -1 || statusText.indexOf('อนุมัติ') > -1) {
        foundOffset = i;
        break;
      }
    }

    if (foundOffset < 0) {
      return { ok: false, error: 'ไม่พบรายการที่มีสถานะอนุมัติในชีต Data' };
    }

    var rowVals = rows[foundOffset].slice();
    var rowObj = {};
    for (var c = 0; c < headers.length; c++) {
      var key = headers[c] || ('COL_' + (c + 1));
      rowObj[key] = rowVals[c];
    }
    rowObj.bookingId = rowVals[idx.bookingId];
    rowObj.status = rowVals[idx.status];

    if (typeof sendTelegramNotify !== 'function') {
      return { ok: false, error: 'ไม่พบฟังก์ชัน sendTelegramNotify ในระบบ' };
    }

    var notifyRes = sendTelegramNotify(rowObj, testMode === true);
    return {
      ok: true,
      mode: testMode ? 'preview' : 'send',
      bookingId: String(rowObj.bookingId || '').trim(),
      status: String(rowObj.status || '').trim(),
      sheetRow: foundOffset + 2,
      telegram: notifyRes
    };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

function getById(bookingId) {
  try {
    const idToFind = String(bookingId || '').trim();
    if (!idToFind) throw new Error('ไม่ระบุ Booking ID');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_MAIN_NAME);
    if (!sh) throw new Error("ไม่พบชีต 'Data'");

    const headers = _sheetApiGetValues_(sh, 1, 1, 1, sh.getLastColumn(), 'getById headers')[0]
      .map(h => String(h || '').trim());
    const idx = headerIndex_(headers);

    if (idx.bookingId === undefined) throw new Error("ไม่พบคอลัมน์ 'Booking ID'");

    const lastRow = sh.getLastRow();
    if (lastRow < 2) throw new Error('ไม่พบข้อมูลในชีต');

    // ค้นหาแถวจากล่างขึ้นบน
    const idColValues = _sheetApiGetValues_(sh, 2, idx.bookingId + 1, lastRow - 1, 1, 'getById bookingId scan');
    let foundRowIndex = -1;
    for (let i = idColValues.length - 1; i >= 0; i--) {
      if (String(idColValues[i][0]).trim() === idToFind) {
        foundRowIndex = i;
        break;
      }
    }

    if (foundRowIndex === -1) return { ok: false, error: `ไม่พบ ID: ${idToFind}` };

    const sheetRowNumber = foundRowIndex + 2;
    const rowValues = _sheetApiGetValues_(sh, sheetRowNumber, 1, 1, headers.length, 'getById row')[0];
    const startISO = parseDateToISO_(rowValues[idx.startDate]);

    const bookingObject = {
      bookingId: idToFind,
      name: String(rowValues[idx.name] || '').trim(),
      status: getStatusKeySafe_(rowValues[idx.status]),
      phone: formatPhoneNumber_(rowValues[idx.phone]),
      position: String(rowValues[idx.position] || '').trim(),
      org: String(rowValues[idx.department] || '').trim(),
      email: String(rowValues[idx.email] || '').trim(),
      
      // 🍓 [BERRY FIX] ใช้ Key มาตรฐานใหม่
      workType: String(rowValues[idx.workType] || rowValues[idx.jobType] || '').trim(),
      workName: String(rowValues[idx.workName] || rowValues[idx.projectName] || rowValues[idx.project] || rowValues[idx.purpose] || '').trim(),
      
      place: String(rowValues[idx.destination] || '').trim(),
      carType: String(rowValues[idx.carType] || '').trim(),
      vehicle: String(rowValues[idx.vehicle] || rowValues[idx.plate] || '').trim(),
      driver: String(rowValues[idx.driver] || '').trim(),
      requestedVehicle: String(rowValues[idx.requestedVehicle] || '').trim(),
      vehicleCount: String(rowValues[idx.vehicleCount] || '1').trim(),

      startDate: startISO,
      startTime: parseTimeSafe_(rowValues[idx.startTime]),
      endDate: parseDateToISO_(rowValues[idx.endDate]) || startISO,
      endTime: parseTimeSafe_(rowValues[idx.endTime]),
      passengers: String(rowValues[idx.passengers] || '').trim(),
      fileUrl: String(rowValues[idx.fileUrl] || '').trim(),
      reason: String(rowValues[idx.reason] || '').trim(),
      cancelReason: String(rowValues[idx.cancelReason] || '').trim(),
      rowNumber: sheetRowNumber
    };

    return { ok: true, data: bookingObject };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}


function normalizeStatusKey_(raw) {
  var s = String(raw || '').trim().toLowerCase();

  // รองรับ label / emoji
  if (s.indexOf('อนุมัติ') >= 0 || s === 'approved') return 'approved';
  if (s.indexOf('ไม่อนุมัติ') >= 0 || s.indexOf('reject') >= 0) return 'rejected';
  if (s.indexOf('ยกเลิก') >= 0 || s.indexOf('cancel') >= 0) return 'cancelled';
  if (s.indexOf('รอ') >= 0 || s.indexOf('pending') >= 0) return 'pending';

  // key ตรง ๆ
  if (s === 'pending' || s === 'approved' || s === 'rejected' || s === 'cancelled') return s;
  return '';
}

function splitCsv_(text) {
  var s = String(text || '').trim();
  if (!s) return [];
  return s.split(',').map(function (x) { return String(x || '').trim(); }).filter(Boolean);
}


function updateBookingStatus(payload) {
  var p = payload || {};
  var bookingId = String(p.bookingId || '').trim();
  var status = String(p.status || '').trim().toLowerCase();

  var dryRun = (p.dryRun === true || String(p.dryRun).toLowerCase() === 'true');
  var testMode = (p.testMode === true || String(p.testMode).toLowerCase() === 'true');

  try {
    if (!bookingId) throw new Error('INVALID_PAYLOAD: missing bookingId');
    if (!status) throw new Error('INVALID_PAYLOAD: missing status');

    var allowed = { pending: 1, approved: 1, rejected: 1, cancelled: 1 };
    if (!allowed[status]) throw new Error('INVALID_PAYLOAD: invalid status => ' + status);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_MAIN_NAME);
    if (!sh) throw new Error('SHEET_NOT_FOUND: ' + SHEET_MAIN_NAME);

    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow < 2) throw new Error('SHEET_EMPTY');

    // ✅ map headers
    var headers = _sheetApiGetValues_(sh, 1, 1, 1, lastCol, 'updateBookingStatus headers')[0]
      .map(function (h) { return String(h || '').trim(); });
    if (typeof headerIndex_ !== 'function') throw new Error('MISSING_HELPER: headerIndex_');
    var idx = headerIndex_(headers);

    if (typeof idx.bookingId !== 'number') throw new Error('HEADER_MISSING: Booking ID');
    if (typeof idx.status !== 'number') throw new Error('HEADER_MISSING: สถานะ');

    // optional columns
    // vehicle/driver/reason/file/cancelReason
    var hasVehicle = (typeof idx.vehicle === 'number');
    var hasDriver = (typeof idx.driver === 'number');
    var hasReason = (typeof idx.reason === 'number');
    var hasCancelReason = (typeof idx.cancelReason === 'number');
    var hasFile = (typeof idx.file === 'number');

    // ✅ find row by bookingId
    var startRow = 2;
    var values = _sheetApiGetValues_(sh, startRow, 1, lastRow - startRow + 1, lastCol, 'updateBookingStatus rows');
    var foundRowIndex = -1;
    var rowArr = null;

    for (var i = 0; i < values.length; i++) {
      var r = values[i];
      var idVal = String(r[idx.bookingId] || '').trim();
      if (idVal === bookingId) {
        foundRowIndex = startRow + i;
        rowArr = r;
        break;
      }
    }
    if (!rowArr) throw new Error('NOT_FOUND: bookingId=' + bookingId);

    var prevStatus = String(rowArr[idx.status] || '').trim().toLowerCase();

    // ✅ guard: if status unchanged and not testMode/dryRun -> do nothing (avoid duplicates)
    if (!testMode && !dryRun && prevStatus === status) {
      return { ok: true, skipped: true, reason: 'status_unchanged', bookingId: bookingId, status: status };
    }

    // ✅ update sheet first
    rowArr[idx.status] = status;

    // approved: update vehicles/drivers arrays (join as ", ")
    var vehicles = Array.isArray(p.vehicles) ? p.vehicles : [];
    var drivers = Array.isArray(p.drivers) ? p.drivers : [];

    if (status === 'approved') {
      if (hasVehicle) rowArr[idx.vehicle] = vehicles.length ? vehicles.join(', ') : '';
      if (hasDriver) rowArr[idx.driver] = drivers.length ? drivers.join(', ') : '';
      if (hasReason) rowArr[idx.reason] = String(p.reason || '').trim();
    }

    if (status === 'rejected') {
      if (hasReason) rowArr[idx.reason] = String(p.reason || '').trim();
    }

    if (status === 'cancelled') {
      if (hasReason) rowArr[idx.reason] = String(p.reason || '').trim();
      if (hasCancelReason) rowArr[idx.cancelReason] = String(p.cancelReason || p.reason || '').trim();
    }

    // file (optional)
    if (hasFile && p.file != null) {
      rowArr[idx.file] = String(p.file || '').trim();
    }

    // ✅ write back row (atomic row write)
    _sheetApiUpdateValues_(sh, foundRowIndex, 1, [rowArr], { label: 'updateBookingStatus row update' });

    // 🍓 BERRY FIX: กรณีแก้ไขสถานะจาก "ปิดงาน" หรือสถานะอื่น ๆ กลับมาเป็นปกติต้องลบประวัติ Actual End ออก
    try {
        var shActual = ss.getSheetByName('BookingActualEnd');
        if (shActual) {
            var aData = _sheetApiGetValues_(shActual, 1, 1, shActual.getLastRow(), shActual.getLastColumn(), 'updateBookingStatus actualEnd read');
            var deleteRows = [];
            for (var ax = aData.length - 1; ax > 0; ax--) {
                if (String(aData[ax][0]).trim() === bookingId) {
                    deleteRows.push(ax + 1);
                }
            }
            _sheetApiDeleteRows_(shActual, deleteRows, 'updateBookingStatus actualEnd delete');
        }
    } catch(e) {
        Logger.log('Error clearing actual end: ' + e);
    }

    // 🍓 BERRY FIX: Clear cache เพื่อบังคับให้ UI/Calendar หน้าบ้านรีเฟรชข้อมูลสถานะและเวลาที่ถูกต้องทันที
    try { clearInitialCache_(); } catch(e) {}

    // ✅ build rowObj using header mapping (object)
    var rowObj = {};
    for (var c = 0; c < headers.length; c++) {
      rowObj[headers[c]] = rowArr[c];
    }

    // map into normalized keys for builder
    var norm = {
      bookingId: bookingId,
      status: status,
      name: String(rowObj['ชื่อ-สกุล'] || '').trim(),
      phone: String(rowObj['เบอร์โทร'] || '').trim(),
      email: String(rowObj['email'] || '').trim(),
      project: String(rowObj['งาน/โครงการ'] || '').trim(),
      place: String(rowObj['สถานที่'] || '').trim(),
      carType: String(rowObj['ประเภทรถ'] || '').trim(),
      vehicleCount: String(rowObj['จำนวนรถที่ต้องการ'] || '').trim(),
      passengers: String(rowObj['จำนวนผู้ร่วมเดินทาง'] || '').trim(),
      startDate: rowObj['วันเริ่มต้น'],
      startTime: rowObj['เวลาเริ่มต้น'],
      endDate: rowObj['วันสิ้นสุด'],
      endTime: rowObj['เวลาสิ้นสุด'],
      file: String(rowObj['File'] || '').trim(),
      reason: String(rowObj['Reason'] || '').trim(),
      cancelReason: String(rowObj['CancelReason'] || '').trim(),
      vehicles: vehicles,
      drivers: drivers
    };

    var previewText = buildBookingStatusMessage(norm, status, String(p.reason || '').trim());

    // ✅ PREVIEW ONLY mode
    if (testMode || dryRun) {
      Logger.log('updateBookingStatus: NO TELEGRAM (dryRun=' + dryRun + ', testMode=' + testMode + ')');
      Logger.log('--- TELEGRAM PREVIEW (NOT SENT) ---');
      Logger.log(previewText);
      Logger.log('----------------------------------');

      return {
        ok: true,
        bookingId: bookingId,
        status: status,
        preview: previewText,
        telegramSent: false
      };
    }

    // ✅ real send (dedupe by BookingID + status)
    var dedupeKey = 'BOOKING:' + bookingId + ':' + status;
    var sent = sendTelegramOnce(previewText, {
      parse_mode: 'HTML',
      disable_preview: true,
      dedupeKey: dedupeKey
    });

    return {
      ok: !!(sent && sent.ok),
      bookingId: bookingId,
      status: status,
      preview: previewText,
      telegramSent: !!(sent && sent.ok),
      telegram: sent || null
    };

  } catch (e) {
    Logger.log('updateBookingStatus Error: ' + (e && e.stack ? e.stack : e));
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}



// ===== helpers used by updateBookingStatus =====
function normalizeStatusKey_(s) {
  var x = String(s || '').toLowerCase().trim();
  x = x.replace(/✅|⏳|❌|🚫|🚗|⚡/g, '').trim();

  if (!x) return 'pending';

  if (x === 'driver_special_approved' || x.indexOf('กรณีพิเศษ') >= 0 || x.indexOf('เร่งด่วน') >= 0) return 'driver_special_approved';
  if (x === 'approved' || x === 'approve') return 'approved';
  if (x === 'pending' || x === 'wait' || x === 'waiting') return 'pending';
  if (x === 'rejected' || x === 'reject' || x === 'notapproved') return 'rejected';
  if (x === 'cancelled' || x === 'canceled' || x === 'cancel') return 'cancelled';

  if (x.indexOf('ไม่อนุมัติ') >= 0 || x.indexOf('ไม่ผ่าน') >= 0) return 'rejected';
  if (x.indexOf('ยกเลิก') >= 0) return 'cancelled';
  if (x.indexOf('อนุมัติ') >= 0) return 'approved';
  if (x.indexOf('รอดำเนินการ') >= 0 || x.indexOf('รอ') === 0) return 'pending';

  if (x === 'driver_claimed' || x.indexOf('รับงาน') >= 0) return 'pending';

  return 'pending';
}

function statusLabelThai_(statusKey) {
  var k = String(statusKey || '').toLowerCase().trim();
  if (k === 'approved') return '✅ อนุมัติ';
  if (k === 'pending') return '⏳ รอดำเนินการ';
  if (k === 'rejected') return '❌ ไม่อนุมัติ';
  if (k === 'cancelled') return '🚫 ยกเลิก';
  return String(statusKey || '');
}

function checkResourcesConflict_(sh, idx, sDate, sTime, eDate, eTime, excludeId, checkVehicles, checkDrivers) {
    if ((!checkVehicles || !checkVehicles.length) && (!checkDrivers || !checkDrivers.length)) return { hasConflict: false };
    
    // [BERRY FIX] ตรวจสอบ Availability Engine (การลางาน/ซ่อมบำรุง) เป็นด่านแรก
    if (checkDrivers && checkDrivers.length > 0) {
        for (let d of checkDrivers) {
           let avail = checkDriverAvailability(d, sDate, sTime, eDate, eTime);
           if (avail.conflict) return { hasConflict: true, message: `คนขับ ${d} ไม่พร้อมใช้งาน: ${avail.reason}` };
        }
    }
    if (checkVehicles && checkVehicles.length > 0) {
        for (let v of checkVehicles) {
           let avail = checkVehicleAvailability(v, sDate, sTime, eDate, eTime);
           if (avail.conflict) return { hasConflict: true, message: `รถ ${v} ไม่พร้อมใช้งาน: ${avail.reason}` };
        }
    }

    const data = sh.getDataRange().getValues();
    const reqStart = parseDateTime_(sDate, sTime);
    const reqEnd = parseDateTime_(eDate, eTime);
    
    if (!reqStart || !reqEnd) return { hasConflict: false };

    for (let r = 1; r < data.length; r++) {
        const row = data[r];
        const rowId = String(row[idx.bookingId] || '').trim();
        
       // ANCHOR
        // ข้ามตัวเอง และ ข้ามรายการที่ยังไม่ Approved
        if (rowId === String(excludeId)) continue;
        const status = getStatusKeySafe_(row[idx.status]);
        // 🍓 BERRY FIX: เพิ่มสถานะอนุมัติด่วน เพื่อล็อกไม่ให้คิวชนกัน
        if (status !== 'approved' && status !== 'driver_special_approved') continue;

        // เช็คเวลาชนกัน
        const rStartISO = parseDateToISO_(row[idx.startDate]);
        const rStartTime = parseTimeSafe_(row[idx.startTime]);
        const rEndISO = parseDateToISO_(row[idx.endDate]) || rStartISO;
        const rEndTime = parseTimeSafe_(row[idx.endTime]);

        const exStart = parseDateTime_(rStartISO, rStartTime);
        const exEnd = parseDateTime_(rEndISO, rEndTime);

        if (!exStart || !exEnd) continue;
        
        // Logic Overlap: (StartA < EndB) && (EndA > StartB)
        const isOverlapping = (reqStart < exEnd && reqEnd > exStart);
        
        if (isOverlapping) {
            // เช็คทะเบียนรถซ้ำ
            const rowVehicles = String(row[idx.vehicle] || '').split(',').map(v => v.trim());
            const vehicleConflict = checkVehicles.find(v => rowVehicles.includes(v));
            if (vehicleConflict) {
                return { hasConflict: true, message: `รถ ${vehicleConflict} ติดงานอื่นในช่วงเวลานี้ (Booking ID: ${rowId})` };
            }

            // เช็คคนขับซ้ำ (ถ้ามีคนขับส่งมาเช็ค) [BERRY FIX OVERRIDE]
            /*
            if (checkDrivers && checkDrivers.length > 0) {
                const rowDrivers = String(row[idx.driver] || '').split(',').map(d => d.trim());
                const driverConflict = checkDrivers.find(d => rowDrivers.includes(d));
                if (driverConflict) {
                    return { hasConflict: true, message: `คนขับ ${driverConflict} ติดงานอื่นในช่วงเวลานี้ (Booking ID: ${rowId})` };
                }
            */
            if (checkDrivers && checkDrivers.length > 0) {
                const headers = data[0] || [];
                const getColIndex_ = (candidates) => {
                    for (let name of candidates) {
                        let i = headers.indexOf(name);
                        if (i !== -1) return i;
                    }
                    return -1;
                };
                const workTypeIdx = (idx.workType !== undefined && idx.workType !== -1) ? idx.workType : getColIndex_(['ประเภทงาน', 'jobType']);
                const workNameIdx = (idx.workName !== undefined && idx.workName !== -1) ? idx.workName : getColIndex_(['งาน/โครงการ', 'ชื่อโครงการ/งาน', 'projectName', 'project']);
                
                const rowWorkType = (workTypeIdx !== -1) ? String(row[workTypeIdx] || '').trim() : '';
                const rowWorkName = (workNameIdx !== -1) ? String(row[workNameIdx] || '').trim() : '';
                const isRepairJob = /ซ่อม|repair|maintenance/i.test(rowWorkType + '|' + rowWorkName);

                if (!isRepairJob) {
                    const rowDrivers = String(row[idx.driver] || '').split(',').map(d => d.trim());
                    const driverConflict = checkDrivers.find(d => rowDrivers.includes(d));
                    if (driverConflict) {
                        return { hasConflict: true, message: `คนขับ ${driverConflict} ติดงานอื่นในช่วงเวลานี้ (Booking ID: ${rowId})` };
                    }
                }
            }
        }
    }
    return { hasConflict: false };
}

// ===================== UTILITY FUNCTIONS =====================
function normalizeStatus_(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'pending';
  if (['driver_special_approved', 'อนุมัติกรณีพิเศษ', 'อนุมัติเร่งด่วน', 'กรณีพิเศษ'].includes(s)) return 'driver_special_approved';
  if (['driver_claimed', 'คนขับรับงานแล้ว', 'รับงาน', 'พนักงานรับงานแล้ว'].includes(s)) return 'pending';
  if (['pending', 'รออนุมัติ', 'รอดำเนินการ', 'กำลังรอ'].includes(s)) return 'pending';
  if (['approved', 'อนุมัติ', 'ยืนยัน', 'ผ่าน'].includes(s)) return 'approved';
  if (['rejected', 'ไม่อนุมัติ', 'ปฏิเสธ', 'ไม่ผ่าน'].includes(s)) return 'rejected';
  if (['cancelled', 'ยกเลิก', 'ผู้จองยกเลิก', 'ยกเลิกการจอง'].includes(s)) return 'cancelled';
  return s;
}

function normalizeDateInputToDate_(v) {
  var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
  if (v == null || v === '') return null;

  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }

  var raw = String(v).trim();
  if (!raw || raw === '-') return null;
  raw = raw.replace(/[๐-๙]/g, function(ch) { return '๐๑๒๓๔๕๖๗๘๙'.indexOf(ch); });

  var asNum = Number(raw);
  if (isFinite(asNum) && raw.match(/^\d+(\.\d+)?$/)) {
    var utcMs = Math.round((asNum - 25569) * 86400 * 1000);
    var serialDate = new Date(utcMs);
    if (!isNaN(serialDate.getTime())) {
      var serialIso = Utilities.formatDate(serialDate, tz, 'yyyy-MM-dd');
      var sp = serialIso.split('-');
      return new Date(Number(sp[0]), Number(sp[1]) - 1, Number(sp[2]));
    }
  }

  var mIso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mIso) {
    return new Date(Number(mIso[1]), Number(mIso[2]) - 1, Number(mIso[3]));
  }

  var mSlash = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (mSlash) {
    var y = Number(mSlash[3]);
    if (y > 2400) y -= 543;
    return new Date(y, Number(mSlash[2]) - 1, Number(mSlash[1]));
  }

  var mThai = raw.match(/^(\d{1,2})\s+([\u0E00-\u0E7F\.]+)\s+(\d{4})$/);
  if (mThai) {
    var thMonths = {
      'มกราคม': 1, 'กุมภาพันธ์': 2, 'มีนาคม': 3, 'เมษายน': 4, 'พฤษภาคม': 5, 'มิถุนายน': 6,
      'กรกฎาคม': 7, 'สิงหาคม': 8, 'กันยายน': 9, 'ตุลาคม': 10, 'พฤศจิกายน': 11, 'ธันวาคม': 12,
      'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4, 'พ.ค.': 5, 'มิ.ย.': 6,
      'ก.ค.': 7, 'ส.ค.': 8, 'ก.ย.': 9, 'ต.ค.': 10, 'พ.ย.': 11, 'ธ.ค.': 12
    };
    var yy = Number(mThai[3]);
    if (yy > 2400) yy -= 543;
    var mm = thMonths[mThai[2]];
    if (!mm) return null;
    return new Date(yy, mm - 1, Number(mThai[1]));
  }

  var d2 = new Date(raw);
  if (isNaN(d2.getTime())) return null;
  return new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
}

/**
 * แปลงวันที่ทุกรูปแบบให้เป็น ISO AD (ค.ศ.) yyyy-MM-dd
 * [BERRY FIXED] แก้ปัญหาลบปีจนถอยไปยุคอยุธยา (1654)
 */
function parseDateToISO_(v) {
  try {
    var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
    var d = normalizeDateInputToDate_(v);
    if (!d || isNaN(d.getTime())) return null;
    return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  } catch (e) {
    return null;
  }
}

/**
 * รวมวันที่ ISO และเวลา String ให้เป็น Date Object (Local Time)
 */
function parseDateTime_(dateISO, timeStr) {
  try {
    if (!dateISO) return null;
    
    // 🍓 [BERRY FIX] ล้างค่าปีอีกครั้งก่อนสร้าง Object เพื่อความชัวร์
    const cleanISO = parseDateToISO_(dateISO); 
    if (!cleanISO) return null;

    const dParts = cleanISO.split('-');
    const year = parseInt(dParts[0]);
    const month = parseInt(dParts[1]) - 1; 
    const day = parseInt(dParts[2]);

    // จัดการเวลา (รองรับทั้ง 08:00 และ 08:00 น.)
    const tParts = String(timeStr || '00:00')
      .replace(/น\./g, '')
      .trim()
      .split(':');
      
    const hours = parseInt(tParts[0] || 0);
    const minutes = parseInt(tParts[1] || 0);

    // สร้าง Date Object แบบพารามิเตอร์เพื่อเลี่ยงปัญหา UTC offset
    const d = new Date(year, month, day, hours, minutes, 0, 0);
    
    if (isNaN(d.getTime())) return null;
    return d;
  } catch (e) {
    Logger.log(`parseDateTime_ Error: ${e.message}`);
    return null;
  }
}

/* [ANCHOR: Public Driver List for Dropdowns] */
function getDriverList() {
  try {
    // 1. ดึงข้อมูล Drivers ทั้งหมด (ใช้ฟังก์ชันเดิมของพี่)
    const driversRes = getDriversFromAdmin_(); 
    const driversRaw = driversRes.ok ? driversRes.drivers : [];

    // 2. อ่านสถานะ Active/Inactive จาก Setting
    const dStatusKv = readSettingKV_('DriverStatus'); 
    const dStatusMap = parseBoolMap_(dStatusKv.val);

    // 3. กรองเอาเฉพาะคนที่ Active (สถานะเป็น true)
    const activeDrivers = driversRaw.filter(d => {
       // ถ้าไม่มีค่าใน Setting ให้ถือว่า Active (true) โดย Default
       return dStatusMap.hasOwnProperty(d.name) ? dStatusMap[d.name] : true;
    });

    // 4. ส่งกลับเฉพาะ "ชื่อ" เป็น Array List
    return activeDrivers.map(d => d.name);

  } catch (e) {
    Logger.log("getDriverList Error: " + e.toString());
    // Fallback: ถ้า Error ให้ส่งค่าพื้นฐานไปก่อน
    return ["Admin", "Tester"]; 
  }
}

function apiGetAdminPanelData() {
  try {
    const driversRes = getDriversFromAdmin_();
    const driversRaw = driversRes.ok ? driversRes.drivers : [];
    const vehiclesRes = getAllVehiclePlatesFromSettings();
    const vehiclesRaw = vehiclesRes.ok ? vehiclesRes.all : [];

    const dStatusKv = readSettingKV_('DriverStatus');
    const dStatusMap = parseBoolMap_(dStatusKv.val);
    const vStatusKv = readSettingKV_('VehicleAvailability');
    const vStatusMap = parseBoolMap_(vStatusKv.val);

    // 🍓 BERRY FIX: ใช้แหล่งข้อมูลเดียวกับ Radar เสมอ
    // FIX-PERF: เรียก buildRadarContext_ ครั้งเดียว แล้วใช้ทั้ง liveMap + vehicleRepairBlockMap
    const radarCtxShared = buildRadarContext_();
    const liveRes = buildRadarData.fromCtx ? buildRadarData.fromCtx(radarCtxShared) : buildRadarData();
    const liveDriversMap = {};
    const liveVehiclesMap = {};

    if (liveRes && liveRes.ok) {
      (liveRes.drivers || []).forEach(d => { liveDriversMap[normalizeRadarName_(d.name)] = d; });
      (liveRes.vehicles || []).forEach(v => { liveVehiclesMap[normalizeRadarPlate_(v.plate)] = v; });
    }

    const drivers = driversRaw.map(function(d) {
      const name = normalizeRadarName_(d.name);
      const isActive = dStatusMap.hasOwnProperty(name) ? dStatusMap[name] : true;
      // 🍓 BERRY FIX: leave > busy > ready. isActive=false หมายถึงลาทันที ไม่ต้องเช็ค live
      const live = liveDriversMap[name] || { status: 'ready', label: 'พร้อม' };
      const drvStatus = !isActive ? 'leave' : live.status;
      const drvLabel  = !isActive ? 'ลา'    : live.label;

      let upcomingBadge = '';
      if (isActive && live.status === 'ready') {
        const todayMs = radarCtxShared.now ? radarCtxShared.now.getTime() : new Date().getTime();
        let earliestUpcoming = Infinity;
        let upcomingTimeStr = '';

        (radarCtxShared.approvedBookings || []).forEach(function(b) {
          const driversList = String(b.driverRaw || b.driver || '').split(/[,\n|\/]+/).map(normalizeRadarName_);
          if (driversList.indexOf(name) !== -1) {
            const startMs = b.startAt.getTime();
            if (startMs > todayMs && startMs < earliestUpcoming) {
              earliestUpcoming = startMs;
              upcomingTimeStr = Utilities.formatDate(b.startAt, 'Asia/Bangkok', 'HH:mm');
            }
          }
        });

        (radarCtxShared.availBlocks || []).forEach(function(blk) {
          if (blk.resourceType === 'driver' && !blk.isClosed && normalizeRadarName_(blk.resourceId) === name) {
            const startMs = blk.startAt.getTime();
            if (startMs > todayMs && startMs < earliestUpcoming) {
              earliestUpcoming = startMs;
              upcomingTimeStr = Utilities.formatDate(blk.startAt, 'Asia/Bangkok', 'HH:mm');
            }
          }
        });

        if (upcomingTimeStr) {
          upcomingBadge = 'มีภารกิจ ' + upcomingTimeStr;
        }
      }

      return {
        name: name, username: d.username, role: d.role, active: isActive,
        status: drvStatus, label: drvLabel,
        isBusy: (!isActive) || (live.status !== 'ready'),
        busyBadge: drvLabel,
        upcomingBadge: upcomingBadge
      };
    });

    // FIX: build vehicleRepairBlockMap จาก radarCtxShared.availBlocks (no extra sheet read)
    // รถที่มี vehicle_block ที่ครอบ today/ยังไม่จบ (not closed) → แสดงเป็น repair ใน modal
    const vehicleRepairBlockMap = {};
    const vehicleUpcomingBlockMap = {};
    try {
      const todayMs = radarCtxShared.now ? radarCtxShared.now.getTime() : new Date().getTime();
      (radarCtxShared.availBlocks || []).forEach(function(blk) {
        if (blk.resourceType !== 'vehicle') return;
        if (blk.isClosed) return;
        const startMs = blk.startAt ? blk.startAt.getTime() : Infinity;
        const endMs   = blk.endAt   ? blk.endAt.getTime()   : 0;
        // 🍓 FIX: ตรวจว่า block หมดอายุแล้ว (now > endAt) → skip ทันที
        if (todayMs >= endMs) return;
        const normPlate = normalizeRadarPlate_(blk.resourceId);
        
        if (todayMs >= startMs && todayMs < endMs) {
          if (!vehicleRepairBlockMap[normPlate]) {
            vehicleRepairBlockMap[normPlate] = {
              reason: blk.reason || 'ส่งซ่อมบำรุง',
              startMs: startMs,
              endMs: endMs
            };
          }
        } else if (todayMs < startMs) {
          if (!vehicleUpcomingBlockMap[normPlate] || startMs < vehicleUpcomingBlockMap[normPlate].startMs) {
            vehicleUpcomingBlockMap[normPlate] = {
              reason: blk.reason || 'ส่งซ่อมบำรุง',
              startMs: startMs,
              startAt: blk.startAt
            };
          }
        }
      });
    } catch (repairMapErr) {
      Logger.log('vehicleRepairBlockMap build error: ' + repairMapErr.message);
    }

    const vehicles = vehiclesRaw.map(function(v) {
      const plate = normalizeRadarPlate_(v.plate);
      const isActive = vStatusMap.hasOwnProperty(plate) ? vStatusMap[plate] : true;
      // 🍓 BERRY FIX: repair > busy > ready. isActive=false หมายถึงส่งซ่อมทันที ไม่ต้องเช็ค live
      const live = liveVehiclesMap[plate] || { status: 'ready', label: 'พร้อม' };
      // FIX: ถ้า live Radar ยังไม่ถึงเวลา active แต่มี repair block วันนี้/กำลังจะมา → force repair
      const repairBlock = vehicleRepairBlockMap[plate];
      const upcomingRepair = vehicleUpcomingBlockMap[plate];
      let vehStatus = !isActive ? 'repair' : live.status;
      let vehLabel  = !isActive ? 'ส่งซ่อม' : live.label;
      let vehReason = '';
      if (vehStatus === 'ready' && repairBlock) {
        vehStatus = 'repair';
        vehLabel  = 'ส่งซ่อมบำรุง';
        vehReason = repairBlock.reason || '';
      }
      if (vehStatus === 'repair' && !vehReason && live.job) vehReason = live.job;

      let upcomingBadge = '';
      if (isActive && vehStatus === 'ready') {
        const todayMs = radarCtxShared.now ? radarCtxShared.now.getTime() : new Date().getTime();
        let earliestUpcoming = Infinity;
        let upcomingLabel = '';

        if (upcomingRepair && upcomingRepair.startMs < earliestUpcoming) {
          earliestUpcoming = upcomingRepair.startMs;
          upcomingLabel = 'มีซ่อมบำรุง ' + Utilities.formatDate(upcomingRepair.startAt, 'Asia/Bangkok', 'HH:mm');
        }

        (radarCtxShared.approvedBookings || []).forEach(function(b) {
          const plates = String(b.vehicleRaw || b.vehicle || '').split(/[,\n|\/]+/).map(normalizeRadarPlate_);
          if (plates.indexOf(plate) !== -1) {
            const startMs = b.startAt.getTime();
            if (startMs > todayMs && startMs < earliestUpcoming) {
              earliestUpcoming = startMs;
              upcomingLabel = 'มีภารกิจ ' + Utilities.formatDate(b.startAt, 'Asia/Bangkok', 'HH:mm');
            }
          }
        });

        upcomingBadge = upcomingLabel;
      }

      return {
        plate: plate, name: v.name, type: v.type, active: isActive,
        status: vehStatus, label: vehLabel,
        reason: vehReason,
        available: isActive && (live.status === 'ready') && !repairBlock,
        badge: vehLabel,
        upcomingBadge: upcomingBadge
      };
    });

    return { ok: true, drivers: drivers, vehicles: vehicles };
  } catch (e) {
    Logger.log('apiGetAdminPanelData Error: ' + e.stack);
    return { ok: false, error: e.message };
  }
}

function apiToggleDriverStatus(payload) {
  const lock = LockService.getScriptLock();
  if(!lock.tryLock(5000)) return {ok:false, error:'System busy'};
  
  try {
    const { name, active } = payload;
    if(!name) throw new Error('Missing name');

    // อ่านค่าเดิม
    const kv = readSettingKV_('DriverStatus');
    const map = parseBoolMap_(kv.val);
    
    // อัปเดต
    map[name] = (active === true || active === 'true');
    
    // แปลงกลับเป็น String
    const newStr = Object.keys(map).map(k => `${k}:${map[k]}`).join(',');
    _saveSettingValue_('DriverStatus', newStr);
    
    return { ok: true, name: name, active: map[name] };
  } catch(e) {
    return { ok: false, error: e.message };
  } finally { lock.releaseLock(); }
}

function apiToggleVehicleStatus(payload) {
  const lock = LockService.getScriptLock();
  if(!lock.tryLock(5000)) return {ok:false, error:'System busy'};

  try {
    const { plate, active } = payload;
    if(!plate) throw new Error('Missing plate');

    const kv = readSettingKV_('VehicleAvailability');
    const map = parseBoolMap_(kv.val);
    
    map[plate] = (active === true || active === 'true');
    
    const newStr = Object.keys(map).map(k => `${k}:${map[k]}`).join(',');
    _saveSettingValue_('VehicleAvailability', newStr);
    
    return { ok: true, plate: plate, active: map[plate] };
  } catch(e) {
    return { ok: false, error: e.message };
  } finally { lock.releaseLock(); }
}


// Helper: บันทึกค่าลง Setting (ใช้คู่กับ readSettingKV_)
function _saveSettingValue_(key, value) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('setting');
  if(!sh) throw new Error("No setting sheet");
  
  // หา Row เดิม
  const data = sh.getRange("A:A").getValues();
  let row = -1;
  for(let i=0; i<data.length; i++){
    if(String(data[i][0]).trim() === key) {
      row = i + 1;
      break;
    }
  }
  
  if(row > 0) {
    sh.getRange(row, 2).setValue(value); // Update Col B
  } else {
    sh.appendRow([key, value]); // Create New
  }
  try { clearInitialCache_(); } catch (e) {}
}

function keepPhone(v) {
  var s = (v == null) ? '' : String(v).trim();
  if (!s) return '';
  // เก็บเฉพาะตัวเลขและเครื่องหมาย +
  s = s.replace(/[^\d+]/g, '');
  return s;
}

function normalizeVehicleTypeLabel_(raw) {
  var s = (raw == null) ? '' : String(raw).trim();
  if (!s) return '';

  var low = s.toLowerCase();

  if (s.indexOf(',') > -1 || s.indexOf('|') > -1) {
    var parts = s.split(/[,\|]+/).map(function(x) {
      return normalizeVehicleTypeLabel_(x);
    }).filter(Boolean);
    var uniq = [];
    var seen = {};
    parts.forEach(function(x) {
      if (!seen[x]) {
        seen[x] = true;
        uniq.push(x);
      }
    });
    return uniq.join('/');
  }

  if (low === 'van' || low.indexOf('van') > -1 || s.indexOf('ตู้') > -1) return 'รถตู้';
  if (low === 'truck' || low.indexOf('truck') > -1 || s.indexOf('กระบะ') > -1 || s.indexOf('บรรทุก') > -1) return 'รถบรรทุก';

  return '';
}

function getBookingRowById_(bookingId) {
  var id = String(bookingId || '').trim();
  if (!id) return null;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_MAIN_NAME);
  if (!sh) return null;

  var lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  var bookingCol = (typeof COL !== 'undefined' && COL.BOOKING_ID) ? COL.BOOKING_ID : 18;

  var ids = sh.getRange(2, bookingCol, lastRow - 1, 1).getValues();
  var foundRow = -1;
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '').trim() === id) { foundRow = i + 2; break; }
  }
  if (foundRow < 0) return null;

  var rowVals = sh.getRange(foundRow, 1, 1, sh.getLastColumn()).getValues()[0];

  function V(colIndex1Based) {
    return (colIndex1Based && colIndex1Based >= 1) ? rowVals[colIndex1Based - 1] : '';
  }

  var obj = {
    name: V(COL.NAME || 1),
    status: V(COL.STATUS || 2),
    phone: V(COL.PHONE || 3),
    position: V(COL.POSITION || 4),
    org: V(COL.ORG || 5),
    email: V(COL.EMAIL || 6),
    project: V(COL.PROJECT || 7),
    destination: V(COL.DESTINATION || 8),
    carType: V(COL.CAR_TYPE || 9),
    plate: V(COL.PLATE || 10),
    carName: V(COL.CAR_SELECTED || 11),
    driver: V(COL.DRIVER || 12),
    startDate: V(COL.START_D || 13),
    startTime: V(COL.START_T || 14),
    endDate: V(COL.END_D || 15),
    endTime: V(COL.END_T || 16),
    passengers: V(COL.PASSENGERS || 17),
    bookingId: id,
    fileUrl: V(COL.FILE || 19),
    reason: V(COL.REASON || 20),
    cancelReason: V(COL.CANCEL_REASON || 21),
    vehicleCount: V(COL.VEHICLE_COUNT || 22)
  };

  return obj;
}

function getHeaderMap_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var key = String(headers[i]).trim();
    if (key) map[key] = i + 1; // เก็บเป็น 1-based index
  }
  return map;
}

function normalizeDriverName(name) {
  if (!name) return '-';
  var s = String(name);
  
  // 1. Remove zero-width chars COMPLETELY
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 2. Convert control chars to space
  s = s.replace(/[\r\n\t]/g, ' ');

  // 3. Collapse multiple spaces
  s = s.replace(/\s+/g, ' ');

  // 4. Trim
  s = s.trim();

  // 5. [Berry Fix] Specific Correction
  if (s === 'ปรีชา ถวิล เวช') return 'ปรีชา ถวิลเวช';

  return s || '-';
}


// ===================== CACHE MANAGEMENT =====================
function cachePut_(key, data, seconds) {
  try {
    var ttl = (typeof seconds === 'number' ? seconds : CACHE_SEC);
    CacheService.getScriptCache().put(key, JSON.stringify(data), ttl);
  } catch (e) { Logger.log('Cache put error: ' + e.toString()); }
}

function cacheGet_(key) {
  try {
    const raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { 
    Logger.log('Cache get error: ' + e.toString());
    return null; 
  }
}

function cacheDelete_(key){ 
  cacheDeleteLarge_(key);
}

function clearInitialCache_() {
  cacheDeleteLarge_(INITIAL_DATA_CACHE_KEY);
  Logger.log('CACHE CLEAR key=' + INITIAL_DATA_CACHE_KEY);
  return true;
}

function clearInitialCache() {
  try {
    clearInitialCache_();
    return { ok: true, key: INITIAL_DATA_CACHE_KEY };
  } catch (e) {
    Logger.log('clearInitialCache error: ' + (e && e.stack ? e.stack : e));
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

function keepWebAppWarm() {
  Logger.log('Keep-warm trigger executed.');
  ping();
}

function cacheDelete(key) {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove(String(key || ''));
    return true;
  } catch (e) {
    Logger.log('cacheDelete fail: ' + (e && e.message ? e.message : e));
    return false;
  }
}

// Chunks management to bypass 100KB Cache limit (e.g. payload is ~211KB)
function cachePutLarge_(key, data, seconds) {
  try {
    const jsonStr = JSON.stringify(data);
    const ttl = (typeof seconds === 'number' ? seconds : 120);
    const cache = CacheService.getScriptCache();
    cacheDeleteLarge_(key);
    
    if (jsonStr.length < 90000) {
      cache.put(key, jsonStr, ttl);
      cache.put(key + '_chunks', '0', ttl);
      return;
    }
    
    const chunkSize = 90000;
    let index = 0;
    let chunkCount = 0;
    while (index < jsonStr.length) {
      const chunk = jsonStr.substring(index, index + chunkSize);
      cache.put(key + '_chunk_' + chunkCount, chunk, ttl);
      chunkCount++;
      index += chunkSize;
    }
    cache.put(key + '_chunks', String(chunkCount), ttl);
    cache.remove(key); // Remove legacy direct key
  } catch (e) {
    Logger.log('[CacheLarge] Put Error: ' + e.toString());
  }
}

function cacheGetLarge_(key) {
  try {
    const cache = CacheService.getScriptCache();
    const chunksVal = cache.get(key + '_chunks');
    
    if (!chunksVal) {
      const raw = cache.get(key);
      return raw ? JSON.parse(raw) : null;
    }
    
    const chunkCount = parseInt(chunksVal);
    if (chunkCount === 0) {
      const raw = cache.get(key);
      return raw ? JSON.parse(raw) : null;
    }
    
    let jsonStr = '';
    for (let i = 0; i < chunkCount; i++) {
      const chunk = cache.get(key + '_chunk_' + i);
      if (!chunk) return null; // Corrupted cache
      jsonStr += chunk;
    }
    
    return JSON.parse(jsonStr);
  } catch (e) {
    Logger.log('[CacheLarge] Get Error: ' + e.toString());
    return null;
  }
}

function cacheDeleteLarge_(key) {
  try {
    const cache = CacheService.getScriptCache();
    const chunksVal = cache.get(key + '_chunks');
    cache.remove(key);
    cache.remove(key + '_chunks');
    if (chunksVal) {
      const chunkCount = parseInt(chunksVal);
      for (let i = 0; i < chunkCount; i++) {
        cache.remove(key + '_chunk_' + i);
      }
    }
  } catch (e) {
    Logger.log('[CacheLarge] Delete Error: ' + e.toString());
  }
}

function readAllSettings_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('setting');
  if(!sh) throw new Error("ไม่พบชีต setting");
  const lastRow = sh.getLastRow();
  const rows = sh.getRange(1, 1, lastRow, 2).getValues();
  const settings = {};
  for (let i = 0; i < rows.length; i++) {
    const k = String(rows[i][0]).trim();
    if (k) {
      settings[k] = { row: i + 1, val: String(rows[i][1] || '') };
    }
  }
  return settings;
}


// ===================== VEHICLE MANAGEMENT =====================
function getAllVehiclePlatesFromSettings(settings) {
  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(SHEET_VEHICLES);
    if (!sh) return { ok:false, error:"ไม่พบชีต 'Vehicles'" };

    const lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok:true, vans:[], trucks:[], all:[] };

    const vs = _sheetApiGetValues_(sh, 1, 1, lastRow, sh.getLastColumn(), 'getAllVehiclePlatesFromSettings');
    const headers = vs[0].map(v => String(v||'').trim().toLowerCase());

    // 💖 Helper หา Index หัวตาราง (รองรับไทย/อังกฤษ)
    function findIdx(keywords) {
      for (var k of keywords) {
        var ix = headers.indexOf(k);
        if (ix > -1) return ix;
      }
      return -1;
    }

    const ixPlate = findIdx(['plate', 'ทะเบียน', 'ทะเบียนรถ', 'เลขทะเบียน']);
    const ixName  = findIdx(['name', 'ยี่ห้อ', 'ชื่อรถ', 'รุ่น', 'brand']);
    const ixType  = findIdx(['type', 'ประเภท', 'ชนิด', 'car_type']);
    
    // ถ้าหาไม่เจอ ให้ลองเดา (Col 1=Plate, Col 2=Name, Col 3=Type)
    const pIdx = ixPlate > -1 ? ixPlate : 0;
    const nIdx = ixName  > -1 ? ixName  : 1;
    const tIdx = ixType  > -1 ? ixType  : 2;

    // อ่านสถานะซ่อมบำรุงจาก Setting (VehicleAvailability)
    const vStatusKv = settings && settings['VehicleAvailability'] ? settings['VehicleAvailability'] : readSettingKV_('VehicleAvailability');
    const vStatusMap = parseBoolMap_(vStatusKv.val);

    const rows = vs.slice(1).filter(r => (r[pIdx] || '').trim());
    const all = rows.map(r => {
      const plate = String(r[pIdx]||'').trim();
      const rawType = String(r[tIdx]||'').trim().toLowerCase();
      
      // เช็คสถานะ (ถ้าไม่มีใน Map ให้ถือว่า True/Active)
      const isActive = vStatusMap.hasOwnProperty(plate) ? vStatusMap[plate] : true;

      return {
        plate: plate,
        name:  String(r[nIdx]||'').trim(),
        type:  rawType || 'van',
        active: isActive // ส่งสถานะไปด้วย
      };
    });
    
    const vans   = all.filter(x => x.type.includes('van') || x.type.includes('ตู้'));
    const trucks = all.filter(x => x.type.includes('truck') || x.type.includes('กระบะ') || x.type.includes('บรรทุก'));
    
    return { ok:true, vans, trucks, all };

  } catch (e) {
    Logger.log('getAllVehiclePlatesFromSettings Error: ' + e.stack);
    return { ok:false, error:e.message, vans:[], trucks:[], all:[] };
  }
}

function getDriversFromVehicles_() {
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName(SHEET_VEHICLES);
    if (!sh) throw new Error("Sheet 'Vehicles' not found");
    var vs = _sheetApiGetValues_(sh, 1, 1, sh.getLastRow(), sh.getLastColumn(), 'getDriversFromVehicles_');
    if (vs.length < 2) return [];

    var headers = vs[0].map(function (v) { return String(v || '').trim().toLowerCase(); });
    var ixDriver = (function (hs) {
      var keys = ['driverlist', 'drivers', 'คนขับ', 'พนักงานขับรถ'];
      for (var i = 0; i < hs.length; i++) {
        var h = hs[i];
        for (var k = 0; k < keys.length; k++) if (h === keys[k]) return i;
      }
      return -1;
    })(headers);
    if (ixDriver === -1) return [];

    var out = {};
    for (var r = 1; r < vs.length; r++) {
      var raw = String(vs[r][ixDriver] || '').trim();
      if (!raw) continue;
      raw.split(/[\n,;]/).forEach(function (x) {
        var s = String(x || '').trim();
        if (s) out[s] = true;
      });
    }
    return Object.keys(out).sort();
  } catch (e) {
    Logger.log('getDriversFromVehicles_ error: ' + e.toString());
    return [];
  }
}

function getDistinctProjectsFromData_() {
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName(SHEET_MAIN_NAME);
    if (!sh) throw new Error("Sheet Data not found");
    var rng = sh.getDataRange().getValues();
    if (rng.length < 2) return [];

    var headers = rng[0];
    var idx = headerIndex_(headers);
    var col = idx.project;
    if (col === undefined) return [];

    var set = {};
    for (var r = 1; r < rng.length; r++) {
      var val = String(rng[r][col] || '').trim();
      if (val) set[val] = true;
    }
    return Object.keys(set).sort();
  } catch (e) {
    Logger.log('getDistinctProjectsFromData_ error: ' + e.toString());
    return [];
  }
}

function getUsageCountsThisMonth_() {
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName(SHEET_MAIN_NAME);
    if (!sh) throw new Error('Data sheet not found');
    var vs = sh.getDataRange().getValues();
    if (vs.length < 2) return {};

    var headers = vs[0];
    var idx = headerIndex_(headers);
    var ixStatus = idx.status;
    var ixPlate = idx.vehicle;
    var ixStartDate = idx.startDate;

    if (ixPlate === undefined || ixStartDate === undefined) return {};

    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth();
    var start = new Date(y, m, 1);
    var end = new Date(y, m + 1, 1);

    var counts = {};
    for (var r = 1; r < vs.length; r++) {
      var row = vs[r];
      var plate = String(row[ixPlate] || '').trim();
      if (!plate) continue;

      var d = row[ixStartDate];
      var dt = (d instanceof Date) ? d : new Date(d);
      if (!(dt instanceof Date) || isNaN(dt.getTime())) continue;
      if (dt < start || dt >= end) continue;

      // ANCHOR
      var s = (ixStatus !== undefined) ? String(row[ixStatus] || '').trim().toUpperCase() : '';
      // 🍓 BERRY FIX: นับรวมงานที่อนุมัติกรณีพิเศษเข้าสถิติด้วย
      if (s && s !== 'A' && s !== 'APPROVED' && s !== 'อนุมัติ' && s !== 'DRIVER_SPECIAL_APPROVED' && s.indexOf('พิเศษ') === -1) continue;

      counts[plate] = (counts[plate] || 0) + 1;
    }
    return counts;
  } catch (e) {
    Logger.log('getUsageCountsThisMonth_ error: ' + e.toString());
    return {};
  }
}

function apiGetDashboardData() {
  try {
    var ss = SpreadsheetApp.getActive();
    if (!ss) throw new Error('Spreadsheet not found');

    var sh = ss.getSheetByName(SHEET_MAIN_NAME);
    if (!sh) throw new Error('Data sheet not found');

    var vs = sh.getDataRange().getValues();
    if (!vs || vs.length < 2) {
      return {
        ok: true,
        pending: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0
      };
    }

    var headers = vs[0];
    var idx = headerIndex_(headers);
    var ixStatus = idx.status;

    if (ixStatus === undefined) {
      throw new Error('ไม่พบคอลัมน์สถานะในชีต Data (status)');
    }

    var counts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0
    };

   // ANCHOR
    for (var r = 1; r < vs.length; r++) {
      var row = vs[r];
      if (!row) continue;

      var rawStatus = row[ixStatus];
      var norm = normalizeStatus_(rawStatus);  // ใช้ mapping เดิมในระบบ

      // 🍓 BERRY FIX: รวบกรณีพิเศษให้กลายเป็น approved ใน Dashboard เพื่อสถิติที่ตรงกัน
      if (norm === 'driver_special_approved') {
          norm = 'approved';
      }

      if (counts.hasOwnProperty(norm)) {
        counts[norm] = (counts[norm] || 0) + 1;
      }
    }

    Logger.log(
      'apiGetDashboardData: P=' + counts.pending +
      ', A=' + counts.approved +
      ', R=' + counts.rejected +
      ', C=' + counts.cancelled
    );

    return {
      ok: true,
      pending: counts.pending || 0,
      approved: counts.approved || 0,
      rejected: counts.rejected || 0,
      cancelled: counts.cancelled || 0
    };

  } catch (e) {
    Logger.log('apiGetDashboardData error: ' + e.toString());
    return {
      ok: false,
      error: e.message
    };
  }
}


function apiGetFuelFormOptions() {
  try {
    var platesRes = getAllVehiclePlatesFromSettings();
    if (!platesRes.ok) throw new Error(platesRes.error || 'Load plates failed');
    var plates = platesRes.all.map(function (v) { return v.plate; });

    var drivers = getDriversFromVehicles_();
    var projects = getDistinctProjectsFromData_();
    var counts = getUsageCountsThisMonth_();

    return { ok: true, plates: plates, drivers: drivers, projects: projects, counts: counts };
  } catch (e) {
    Logger.log('apiGetFuelFormOptions error: ' + e.toString());
    return { ok: false, error: e.message, plates: [], drivers: [], projects: [], counts: {} };
  }
}

/* ===== REMINDER: Insurance & Maintenance (3 days early, TH locale) ===== */
function _vb_norm(s){ return String(s||'').replace(/\s+/g,'').toLowerCase(); }
function _vb_idx(headers, aliases){
  var map = headers.map(function(h){ return _vb_norm(h); });
  for (var i=0;i<map.length;i++){
    for (var j=0;j<aliases.length;j++){
      if (map[i] === _vb_norm(aliases[j])) return i;
    }
  }
  return -1;
}

function _vb_parseDate(v){
  if (v instanceof Date) return v;
  if (v == null) return null;
  var s = String(v).trim();
  if (!s) return null;

  // dd/MM/yyyy or dd/MM/yyyy HH:mm (รองรับ พ.ศ. 25xx)
  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2})[:\.](\d{2}))?$/);
  if (m){
    var d = +m[1], mo = +m[2], y = +m[3];
    if (y > 2400) y -= 543; // พ.ศ. -> ค.ศ.
    var hh = +m[4] || 0, mm = +m[5] || 0;
    return new Date(y, mo - 1, d, hh, mm);
  }

  // yyyy-MM-dd or yyyy-MM-dd HH:mm (กันเคส export เป็นแบบ ISO)
  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2})[:\.](\d{2}))?$/);
  if (m){
    var y2 = +m[1]; if (y2 > 2400) y2 -= 543;
    var mo2 = +m[2], d2 = +m[3], hh2 = +m[4] || 0, mm2 = +m[5] || 0;
    return new Date(y2, mo2 - 1, d2, hh2, mm2);
  }

  var dflt = new Date(s);
  return isNaN(dflt) ? null : dflt;
}


function _vb_fmtThaiDate(d){
  if (!(d instanceof Date)) d = new Date(d);
  var thYear = d.getFullYear() + 543;
  return Utilities.formatDate(d, TZ, 'dd/MM/') + thYear;
}
function _vb_fmtThaiTime(d){
  if (!(d instanceof Date)) d = new Date(d);
  return Utilities.formatDate(d, TZ, 'HH.mm') + ' น.';
}
function _vb_daysDiff(a, b){ // b - a (in days)
  var ms = new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.round(ms / 86400000);
}

function _vb_getSettingNumber(key, fallback){
  var fb = (fallback != null) ? Number(fallback) : ((VB_CFG && VB_CFG.ADVANCE_DAYS) ? Number(VB_CFG.ADVANCE_DAYS) : 3);
  try{
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName(SHEET_SETTING); // ใช้คอนสแตนต์
    if (!sh) return fb;
    var last = Math.max(2, sh.getLastRow());
    var vals = sh.getRange(1,1,last,2).getValues();
    for (var i=0;i<vals.length;i++){
      if (_vb_norm(vals[i][0]) === _vb_norm(key)) return Number(vals[i][1] || fb);
    }
    return fb;
  }catch(e){ return fb; }
}

function _vb_getSettingString(key, fallback){
  try{
    var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_SETTING);
    if (!sh) return String(fallback||'');
    var rng = sh.getRange(1,1,Math.max(2, sh.getLastRow()), 2).getValues();
    for (var i=0;i<rng.length;i++){
      if (String(rng[i][0]).trim().toLowerCase() === String(key||'').trim().toLowerCase()){
        return String(rng[i][1]||'');
      }
    }
    return String(fallback||'');
  }catch(e){ return String(fallback||''); }
}

function _vb_csvToArray(s){
  return String(s||'').split(/[,\|]/).map(function(x){return x.trim();}).filter(function(x){return !!x;});
}

function _vb_findFirstDateColumn_(vals){
  var head = vals[0] || [];
  var last = Math.min(vals.length, Math.max(2, Math.min(50, vals.length)));
  var bestIdx = -1, bestScore = 0;
  for (var c=0; c<head.length; c++){
    var score = 0;
    for (var r=1; r<last; r++){
      var d = _vb_parseDate(vals[r][c]);
      if (d) score++;
    }
    if (score > bestScore){ bestScore = score; bestIdx = c; }
  }
  return (bestScore >= 1) ? bestIdx : -1;
}


/* ---------- Read DUEs: Insurance ---------- */
function _vb_collectInsuranceDue_(){
  var out = [];
  var ss = SpreadsheetApp.getActive();

  var shVS = ss.getSheetByName(SHEET_VEHICLE_STATUS);
  if (shVS && shVS.getLastRow() >= 2){
    var vals = shVS.getRange(1,1,shVS.getLastRow(), shVS.getLastColumn()).getValues();
    var head = vals[0] || [];
    var ixPlate = _vb_idx(head, ['ทะเบียน','plate','เลขทะเบียนรถ']);
    var pref = _vb_csvToArray(_vb_getSettingString('InsuranceDueHeader','วันหมดอายุประกัน,วันสิ้นสุดประกัน,สิ้นสุดประกัน,ครบกำหนดประกัน,insuranceend,enddate'));
    var ixDue = _vb_idx(head, pref);
    if (ixDue < 0) ixDue = _vb_findFirstDateColumn_(vals);
    for (var r=1;r<vals.length;r++){
      var plate = (ixPlate>=0)? String(vals[r][ixPlate]||'').trim() : '';
      var due   = (ixDue  >=0)? _vb_parseDate(vals[r][ixDue]) : null;
      if (plate && due) out.push({ type:'insurance', plate:plate, due:due, source:'VehicleStatus' });
    }
  }

  var shI = ss.getSheetByName(SHEET_INSURANCE);
  if (shI && shI.getLastRow() >= 2){
    var valsI = shI.getRange(1,1,shI.getLastRow(), shI.getLastColumn()).getValues();
    var headI = valsI[0] || [];
    var ixPlateI = _vb_idx(headI, ['ทะเบียนรถ','ทะเบียน','plate','เลขทะเบียนรถ']);
    var prefI = _vb_csvToArray(_vb_getSettingString('InsuranceSheetDueHeader','วันสิ้นสุด,วันสิ้นสุดประกัน,วันที่สิ้นสุด,ครบกำหนด,end,enddate,หมดอายุ'));
    var ixDueI = _vb_idx(headI, prefI);
    if (ixDueI < 0) ixDueI = _vb_findFirstDateColumn_(valsI);
    for (var i=1;i<valsI.length;i++){
      var plateI = (ixPlateI>=0)? String(valsI[i][ixPlateI]||'').trim() : '';
      var dueI   = (ixDueI  >=0)? _vb_parseDate(valsI[i][ixDueI]) : null;
      if (plateI && dueI) out.push({ type:'insurance', plate:plateI, due:dueI, source:'Insurance' });
    }
  }
  return out;
}

/* ---------- Read DUEs: Maintenance NextDueDate ---------- */
function _vb_collectMaintenanceDue_(){
  var out = [];
  var ss = SpreadsheetApp.getActive();

  var shVS = ss.getSheetByName(SHEET_VEHICLE_STATUS);
  if (shVS && shVS.getLastRow() >= 2){
    var vals = shVS.getRange(1,1,shVS.getLastRow(), shVS.getLastColumn()).getValues();
    var head = vals[0] || [];
    var ixPlate = _vb_idx(head, ['ทะเบียน','plate','เลขทะเบียนรถ']);
    var pref = _vb_csvToArray(_vb_getSettingString('MaintenanceNextDueHeader','รอบบริการถัดไป,nextduedate,nextservice,กำหนดครั้งถัดไป,กำหนดเข้าซ่อม'));
    var ixDue = _vb_idx(head, pref);
    if (ixDue < 0) ixDue = _vb_findFirstDateColumn_(vals);
    for (var r=1;r<vals.length;r++){
      var plate = (ixPlate>=0)? String(vals[r][ixPlate]||'').trim() : '';
      var due   = (ixDue  >=0)? _vb_parseDate(vals[r][ixDue]) : null;
      if (plate && due) out.push({ type:'maintenance', plate:plate, due:due, source:'VehicleStatus' });
    }
  }

  var shM = ss.getSheetByName(SHEET_MAINTENANCE);
  if (shM && shM.getLastRow() >= 2){
    var valsM = shM.getRange(1,1,shM.getLastRow(), shM.getLastColumn()).getValues();
    var headM = valsM[0] || [];
    var ixPlateM = _vb_idx(headM, ['plate','ทะเบียน','ทะเบียนรถ','เลขทะเบียนรถ']);
    var prefM = _vb_csvToArray(_vb_getSettingString('MaintenanceSheetNextDueHeader','nextduedate,รอบบริการถัดไป,กำหนดครั้งถัดไป,กำหนดเข้าซ่อม'));
    var ixDueM = _vb_idx(headM, prefM);
    if (ixDueM < 0) ixDueM = _vb_findFirstDateColumn_(valsM);
    for (var j=1;j<valsM.length;j++){
      var plateM = (ixPlateM>=0)? String(valsM[j][ixPlateM]||'').trim() : '';
      var dueM   = (ixDueM  >=0)? _vb_parseDate(valsM[j][ixDueM]) : null;
      if (plateM && dueM) out.push({ type:'maintenance', plate:plateM, due:dueM, source:'Maintenance' });
    }
  }
  return out;
}



/* ---------- Core check & notify ---------- */
function runInsuranceReminder_(){
  var lead = _vb_getSettingNumber('InsuranceReminderDays', 3);
  var now = new Date();
  var list = _vb_collectInsuranceDue_();
  var sent = 0;

  for (var i = 0; i < list.length; i++){
    var it = list[i];
    var days = _vb_daysDiff(now, it.due);
    if (days < 0) continue;      // already expired
    if (days > lead) continue;   // not yet within window

    var dd = _vb_fmtThaiDate(it.due) + ' เวลา ' + _vb_fmtThaiTime(it.due);
    var msg = '🛡️ แจ้งเตือนประกันใกล้หมดอายุ\n'
            + 'ทะเบียน: ' + it.plate + '\n'
            + 'ครบกำหนด: ' + dd + '\n'
            + 'แหล่งข้อมูล: ' + it.source;

    var key = 'REM:INS:' + it.plate + ':' + Utilities.formatDate(it.due, TZ, 'yyyyMMdd');
    var r = sendTelegramOnce(msg, { parse_mode:'HTML', disable_preview:true, dedupeKey:key, force:true });
    if (r && r.ok) sent++;
  }

  try { Logger.log('Insurance reminder sent: ' + sent + '/' + list.length); } catch(_){}
  return { ok:true, sent:sent, total:list.length };
}

function runMaintenanceReminder_(){
  var lead = _vb_getSettingNumber('MaintenanceReminderDays', 3);
  var now = new Date();
  var list = _vb_collectMaintenanceDue_();
  var sent = 0;

  for (var i = 0; i < list.length; i++){
    var it = list[i];
    var days = _vb_daysDiff(now, it.due);
    if (days < 0) continue;
    if (days > lead) continue;

    var dd = _vb_fmtThaiDate(it.due) + ' เวลา ' + _vb_fmtThaiTime(it.due);
    var msg = '🧰 แจ้งเตือนกำหนดเข้ารับบริการซ่อมครั้งถัดไป\n'
            + 'ทะเบียน: ' + it.plate + '\n'
            + 'กำหนด: ' + dd + '\n'
            + 'แหล่งข้อมูล: ' + it.source;

    var key = 'REM:MAINT:' + it.plate + ':' + Utilities.formatDate(it.due, TZ, 'yyyyMMdd');
    var r = sendTelegramOnce(msg, { parse_mode:'HTML', disable_preview:true, dedupeKey:key, force:true });
    if (r && r.ok) sent++;
  }

  try { Logger.log('Maintenance reminder sent: ' + sent + '/' + list.length); } catch(_){}
  return { ok:true, sent:sent, total:list.length };
}


function runAllReminders_(){
  var a = runInsuranceReminder_();
  var b = runMaintenanceReminder_();
  return { ok:true, insurance:a, maintenance:b };
}



/********************** SETTINGS & COMMON HELPERS **********************/
function getSettingsSheet_() {
  const ss = SpreadsheetApp.getActive();
  return ss.getSheetByName('setting');
}

function getSetting_(key) {
  try {
    const sh = getSettingsSheet_();
    if (!sh) return null;
    const rng = sh.getRange(1, 1, sh.getLastRow(), 2).getValues(); // คอลัมน์ A=key, B=value
    for (var i = 0; i < rng.length; i++) {
      if (String(rng[i][0]).trim() === String(key).trim()) return String(rng[i][1] || '').trim();
    }
    return null;
  } catch (e) { return null; }
}

function firstExistingFunction_(names) {
  for (var i = 0; i < names.length; i++) {
    var n = names[i];
    try { if (n && typeof this[n] === 'function') return n; } catch (_){}
  }
  return null;
}

function getVehiclesPlates_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Vehicles');
  if (!sh) return [];
  const vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  const header = vals[0];
  const idxPlate = header.indexOf('plate');
  if (idxPlate < 0) return [];
  const set = {};
  for (var r = 1; r < vals.length; r++) {
    const v = String(vals[r][idxPlate] || '').trim();
    if (v) set[v] = true;
  }
  return Object.keys(set);
}

/********************** FUEL/INSURANCE/MAINTENANCE FORM APIs **********************/
function _getPlateListFromVehiclesSheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('Vehicles'); // ชื่อชีตต้องเป๊ะ
    if (!sh) return [];
    
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return []; 
    
    const data = sh.getRange(1, 1, lastRow, sh.getLastColumn()).getValues();
    const headers = data[0].map(h => String(h).toLowerCase().trim());
    const plateIndex = headers.indexOf('plate'); // หาคอลัมน์ plate
    
    if (plateIndex === -1) return [];

    // ดึงเฉพาะคอลัมน์ plate, ตัดหัวตาราง, กรองค่าว่าง
    const plates = data.slice(1)
      .map(r => String(r[plateIndex]).trim())
      .filter(p => p !== '');
      
    return [...new Set(plates)].sort(); // ตัดซ้ำและเรียงลำดับ
  } catch (e) {
    Logger.log('Error getting plates: ' + e.message);
    return [];
  }
}

// API สำหรับ Tab ประกันภัย (ดึงทะเบียนจริงจาก Vehicles)
function apiGetInsurancePlates() {
  return { ok: true, plates: _getPlateListFromVehiclesSheet() };
}

// API สำหรับ Tab ซ่อมบำรุง (ดึงทะเบียนจริงจาก Vehicles)
function apiGetMaintenancePlates() {
  return { ok: true, plates: _getPlateListFromVehiclesSheet() };
}

/********************** THAI DATE/TIME (B.E.) **********************/
function pad2_(n){ return (n < 10 ? '0' : '') + n; }
function toThaiDate_(dt) {
  const tz = 'Asia/Bangkok';
  const y = parseInt(Utilities.formatDate(dt, tz, 'yyyy'), 10) + 543;
  const m = Utilities.formatDate(dt, tz, 'MM');
  const d = Utilities.formatDate(dt, tz, 'dd');
  return d + '/' + m + '/' + y;
}
function toThaiDateTime_(dt) {
  const tz = 'Asia/Bangkok';
  return toThaiDate_(dt) + '   ⏰ ' + Utilities.formatDate(dt, tz, 'HH:mm') + ' น.';
}

/* ===================== DASHBOARD & REPORT APIs (BERRY FIXED - COMPLETE) ===================== */
// 1. Helper: จัดการการเรียกฟังก์ชันแบบปลอดภัย
function __vb_invoke_(names) {
  for (var i = 0; i < names.length; i++) {
    var fn = this[names[i]];
    if (typeof fn === 'function') return fn;
  }
  return null;
}

function _ok_(obj){ obj = obj || {}; obj.ok = true; return obj; }
function _err_(e){ return { ok:false, error: (e && e.message) ? e.message : String(e) }; }
function __vb_pad2(n){ return (n<10 ? '0' : '') + n; }

// Helper สำหรับแปลง HTML เป็น PDF และบันทึกลง Drive (ใช้ร่วมกัน)
function __vb_htmlToPdfUrl__(filename, html) {
  var name = String(filename||'report.pdf');
  if (!/\.pdf$/i.test(name)) name += '.pdf';
  var pdfBlob = Utilities.newBlob(html, 'text/html', 'tmp.html').getAs('application/pdf').setName(name);
  
  // สร้างไฟล์ที่ Root Folder เพื่อให้ได้ URL ที่เปิดได้จริง
  var file = DriveApp.createFile(pdfBlob);
  // ตั้งค่าแชร์ให้อ่านได้ทุกคนที่มีลิงก์ (สำคัญมาก ไม่งั้น Client เปิดไม่ได้)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  return file.getUrl();
}

// 2. API: รีเฟรชข้อมูล Dashboard (เคลียร์ Cache)
function apiRefreshDashboard() {
  try {
    clearInitialCache_();
    return _ok_({ message: 'Refreshed' });
  } catch (e) { 
    return _err_(e); 
  }
}

function buildDashboardPdfData(year, month, fuelData) {
  const out = {
    totalBookings: 0,
    vehiclesReady: '0/0',
    readyVehicles: [],
    alerts: 0,
    fuel: 0,
    topDrivers: [],
    topVehicles: []
  };

  const y0 = Number(year);
  const m0 = Number(month) - 1;

  function normalizePlate(v) {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v).trim();

    if (typeof v === 'object') {
      const keys = ['plate', 'ทะเบียนรถ', 'เลขทะเบียนรถ', 'registration', 'reg', 'vehiclePlate', 'name', 'value', 'text', 'label'];
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (v[k] != null && String(v[k]).trim()) return String(v[k]).trim();
      }
      return '';
    }
    return '';
  }

  // 1) Fuel
  try {
    if (Array.isArray(fuelData) && fuelData.length) {
      out.fuel = fuelData.reduce((acc, r) => {
        const ts = r && (r.ts || r.date || r.datetime);
        const dt = ts ? new Date(ts) : null;
        if (!dt || isNaN(dt.getTime())) return acc;
        if (dt.getFullYear() !== y0 || dt.getMonth() !== m0) return acc;

        const liters = parseFloat(String(r.liters || r.liter || '0').replace(/,/g, '')) || 0;
        return acc + liters;
      }, 0);
    }
  } catch (_) {}

  // 2) Vehicles ready
  try {
    if (
      typeof getAllVehiclePlatesFromSettings === 'function' &&
      typeof readSettingKV_ === 'function' &&
      typeof parseBoolMap_ === 'function'
    ) {
      const res = getAllVehiclePlatesFromSettings();
      const allRaw = (res && Array.isArray(res.all)) ? res.all : [];

      const kv = readSettingKV_('VehicleAvailability');
      const map = parseBoolMap_(kv && kv.val);

      const seen = {};
      const allPlates = [];

      allRaw.forEach(item => {
        const plate = normalizePlate(item);
        if (!plate) return;
        if (seen[plate]) return;
        seen[plate] = true;
        allPlates.push(plate);
      });

      const total = allPlates.length;
      const readyList = [];
      let ready = 0;

      allPlates.forEach(plate => {
        const isReady = Object.prototype.hasOwnProperty.call(map, plate) ? !!map[plate] : true;
        if (isReady) {
          ready++;
          if (readyList.length < 5) readyList.push(plate);
        }
      });

      out.vehiclesReady = `${ready}/${total}`;
      out.readyVehicles = readyList;
    }
  } catch (e) {
    Logger.log('buildDashboardPdfData vehiclesReady error: ' + e);
    out.vehiclesReady = out.vehiclesReady || '0/0';
    out.readyVehicles = Array.isArray(out.readyVehicles) ? out.readyVehicles : [];
  }

  // 3) Summary from Data Sheet
  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('Data');
    if (!sh) {
      out.topDrivers = [{ name: 'ไม่มีข้อมูล', count: 0 }];
      out.topVehicles = [{ plate: 'ไม่มีข้อมูล', trips: 0 }];
      return out;
    }

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 1) {
      out.topDrivers = [{ name: 'ไม่มีข้อมูล', count: 0 }];
      out.topVehicles = [{ plate: 'ไม่มีข้อมูล', trips: 0 }];
      return out;
    }

    const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = (values[0] || []).map(h => String(h || '').trim());
    const hmap = {};
    headers.forEach((h, i) => { if (h) hmap[h] = i; });

    const ixBookingId = (hmap['Booking ID'] != null) ? hmap['Booking ID'] : -1;
    const ixStatus = (hmap['สถานะ'] != null) ? hmap['สถานะ'] : -1;
    const ixDriver = (hmap['พนักงานขับรถ'] != null) ? hmap['พนักงานขับรถ'] : -1;
    const ixStartDate = (hmap['วันเริ่มต้น'] != null) ? hmap['วันเริ่มต้น'] : -1;

    const ixVehicleSelected = (hmap['รถที่เลือก'] != null) ? hmap['รถที่เลือก'] : -1;
    const ixPlate = (hmap['เลขทะเบียนรถ'] != null) ? hmap['เลขทะเบียนรถ'] : -1;

    if (ixBookingId < 0 || ixStatus < 0 || ixDriver < 0 || ixStartDate < 0) {
      out.topDrivers = [{ name: 'ไม่มีข้อมูล', count: 0 }];
      out.topVehicles = [{ plate: 'ไม่มีข้อมูล', trips: 0 }];
      return out;
    }

    const driverCount = {};
    const vehicleTrips = {};

    let totalBookings = 0;
    let alerts = 0;

    for (let r = 1; r < values.length; r++) {
      const row = values[r] || [];

      const bookingId = String(row[ixBookingId] || '').trim();
      if (!bookingId) continue;

      let dt = null;
      const raw = row[ixStartDate];

      if (raw instanceof Date && !isNaN(raw.getTime())) {
        dt = raw;
      } else {
        const s = String(raw || '').trim();
        if (s) {
          const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
          const mDm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (mIso) {
            dt = new Date(Number(mIso[1]), Number(mIso[2]) - 1, Number(mIso[3]));
          } else if (mDm) {
            let yy = Number(mDm[3]);
            if (yy > 2400) yy -= 543;
            dt = new Date(yy, Number(mDm[2]) - 1, Number(mDm[1]));
          } else {
            const t = new Date(s);
            if (!isNaN(t.getTime())) dt = t;
          }
        }
      }

      if (!dt || isNaN(dt.getTime())) continue;
      if (dt.getFullYear() !== y0 || dt.getMonth() !== m0) continue;

      totalBookings++;

      const statusRaw = row[ixStatus];
      const statusKey = (typeof getStatusKeySafe_ === 'function')
        ? String(getStatusKeySafe_(statusRaw) || '').toLowerCase().trim()
        : String(statusRaw || '').toLowerCase().trim();

      const isPending =
        statusKey === 'pending' ||
        statusKey === 'wait' ||
        statusKey === 'waiting' ||
        statusKey.indexOf('รอ') === 0;

      if (isPending) alerts++;

      const isApproved =
        statusKey === 'approved' ||
        statusKey.indexOf('อนุมัติ') !== -1;

      if (isApproved) {
        // [Berry Fix] Normalize Driver Name
        const drivers = String(row[ixDriver] || '')
          .split(',')
          .map(s => normalizeDriverName(s)) // ใช้ Helper
          .filter(Boolean);

        const plateRaw =
          ((ixVehicleSelected >= 0) ? String(row[ixVehicleSelected] || '').trim() : '') ||
          ((ixPlate >= 0) ? String(row[ixPlate] || '').trim() : '');

        const plates = plateRaw
          .split(',')
          .map(s => String(s || '').trim())
          .filter(Boolean);

        drivers.forEach(name => { driverCount[name] = (driverCount[name] || 0) + 1; });
        plates.forEach(plate => { vehicleTrips[plate] = (vehicleTrips[plate] || 0) + 1; });
      }
    }

    out.totalBookings = totalBookings;
    out.alerts = alerts;

    const topDrivers = Object.keys(driverCount)
      .map(k => ({ name: k, count: driverCount[k] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topVehicles = Object.keys(vehicleTrips)
      .map(k => ({ plate: k, trips: vehicleTrips[k] }))
      .sort((a, b) => b.trips - a.trips)
      .slice(0, 10);

    out.topDrivers = topDrivers.length ? topDrivers : [{ name: 'ไม่มีข้อมูล', count: 0 }];
    out.topVehicles = topVehicles.length ? topVehicles : [{ plate: 'ไม่มีข้อมูล', trips: 0 }];

    if (!Array.isArray(out.readyVehicles)) out.readyVehicles = [];
    out.readyVehicles = out.readyVehicles.map(normalizePlate).filter(Boolean).slice(0, 5);

    return out;
  } catch (e) {
    Logger.log('buildDashboardPdfData error: ' + (e && e.stack ? e.stack : e));
    out.topDrivers = Array.isArray(out.topDrivers) && out.topDrivers.length ? out.topDrivers : [{ name: 'ไม่มีข้อมูล', count: 0 }];
    out.topVehicles = Array.isArray(out.topVehicles) && out.topVehicles.length ? out.topVehicles : [{ plate: 'ไม่มีข้อมูล', trips: 0 }];
    out.readyVehicles = Array.isArray(out.readyVehicles) ? out.readyVehicles.map(normalizePlate).filter(Boolean).slice(0, 5) : [];
    out.vehiclesReady = out.vehiclesReady || '0/0';
    out.totalBookings = Number(out.totalBookings) || 0;
    out.alerts = Number(out.alerts) || 0;
    out.fuel = Number(out.fuel) || 0;
    return out;
  }
}

/* [ANCHOR: Generate PDF Common (Berry Improved - Auto Summary & Header)] */
function _generatePdfCommon_(tplName, dataOpt) {
  try {
    dataOpt = dataOpt || {};
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth() + 1;
    var d = now.getDate();
    var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';

    // 1. เตรียมข้อมูลพื้นฐาน
    var mainData = {};
    var fuelData = [];
    var reportTitle = '';
    var reportPeriod = '';

    // 2. ดึงข้อมูล Dashboard (ถ้าจำเป็น)
    if (tplName === 'DashboardReport') {
      try {
        var dRes = getMainData_();
        if (dRes && dRes.ok) mainData = dRes.data || {};
        
        if (typeof buildDashboardPdfData === 'function') {
           var fRes = apiGetFuelHistory();
           var allFuel = (fRes && fRes.ok) ? fRes.data : [];
           var dashData = buildDashboardPdfData(y, m, allFuel);
           for (var k in dashData) mainData[k] = dashData[k];
        }
      } catch (e) { console.warn('Dashboard data error', e); }
    }

    // 3. ดึงและกรองข้อมูลน้ำมัน (สำหรับ FuelReport)
    if (tplName === 'FuelReport') {
      var fRes = apiGetFuelHistory();
      var allFuel = (fRes && fRes.ok) ? fRes.data : [];
      
      if (dataOpt.day) {
        // --- รายงานรายวัน ---
        reportTitle = 'รายงานสรุปน้ำมัน (รายวัน)';
        var thDay = Utilities.formatDate(now, tz, 'dd/MM/');
        var thY = parseInt(Utilities.formatDate(now, tz, 'yyyy')) + 543;
        reportPeriod = 'ประจำวันที่ ' + thDay + thY;
        
        fuelData = allFuel.filter(function(row) {
           if (!row.timestamp) return false;
           var rd = new Date(row.timestamp);
           return rd.getDate() === d && rd.getMonth() === (m-1) && rd.getFullYear() === y;
        });

      } else {
        // --- รายงานรายเดือน ---
        reportTitle = 'รายงานสรุปน้ำมัน (เดือนนี้)';
        var thY2 = parseInt(Utilities.formatDate(now, tz, 'yyyy')) + 543;
        reportPeriod = 'ประจำเดือน ' + m + '/' + thY2;
        
        fuelData = allFuel.filter(function(row) {
           if (!row.timestamp) return false;
           var rd = new Date(row.timestamp);
           return rd.getMonth() === (m-1) && rd.getFullYear() === y;
        });
      }
    }

    // 4. [BERRY FIX] คำนวณยอดรวมและ Grouping (แก้ปัญหาตารางสรุปว่าง)
    var totalCost = 0;
    var totalLiters = 0;
    var summaryMap = {}; // เก็บข้อมูลแยกตามทะเบียนรถ

    fuelData.forEach(function(r) {
       r.remark = r.jobType || r.budgetType || '-';
       var c = (r.cost || 0);
       var l = (r.liters || 0);
       var p = r.plate || 'ไม่ระบุ';

       totalCost += c;
       totalLiters += l;

       // Grouping Logic
       if (!summaryMap[p]) {
           summaryMap[p] = { plate: p, trips: 0, liters: 0, cost: 0, driversSet: new Set() };
       }
       summaryMap[p].trips++;
       summaryMap[p].liters += l;
       summaryMap[p].cost += c;
       if (r.driver) summaryMap[p].driversSet.add(r.driver);
    });

    // แปลง Map กลับเป็น Array เพื่อส่งให้ Template วนลูป
    var summaryArray = Object.keys(summaryMap).map(function(k) { 
      var sm = summaryMap[k];
      sm.drivers = Array.from(sm.driversSet || []).filter(Boolean).join(', ');
      return sm; 
    });

    // 5. เตรียม Template Data
    var templateData = {
      year: y,
      month: m,
      day: dataOpt.day || null,
      generatedAt: Utilities.formatDate(now, tz, 'dd/MM/') + (y+543) + ' ' + Utilities.formatDate(now, tz, 'HH:mm') + ' น.',
      
      // ✅ แก้ชื่อระบบตรงนี้ (ส่งไปให้ Template)
      systemName: 'ระบบจองยานพาหนะ มหาวิทยาลัยสวนดุสิต ศูนย์การศึกษาลำปาง', 
      
      // Dashboard Data
      data: mainData,
      monthNames: ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'],
      
      // Fuel Report Data
      title: reportTitle,
      period: reportPeriod,
      detail: fuelData, 
      summary: summaryArray, // ✅ ส่งข้อมูลสรุปที่คำนวณแล้วไป
      totalCost: totalCost,
      totalLiters: totalLiters
    };

    // 6. Generate HTML & PDF
    var html = '';
    try {
      var t = HtmlService.createTemplateFromFile(tplName);
      for (var key in templateData) { t[key] = templateData[key]; }
      html = t.evaluate().getContent();
    } catch (e) {
      html = '<h1>Error Generating PDF</h1><p>' + e.message + '</p>';
    }

    var fileName = tplName + '_' + Utilities.formatDate(now, tz, 'yyyyMMdd-HHmm') + '.pdf';
    var url = __vb_htmlToPdfUrl__(fileName, html);

    return { ok: true, url: url };

  } catch (e) {
    Logger.log('_generatePdfCommon_ Error: ' + e.message);
    return { ok: false, error: e.message };
  }
}



// 4. API Wrappers (เรียกใช้จากหน้าเว็บผ่าน google.script.run)
// ฟังก์ชันเหล่านี้ต้องชื่อตรงกับที่ JS ฝั่ง Client เรียกใช้เป๊ะๆ

function apiGenerateDashboardPdf() {
  return _generatePdfCommon_('DashboardReport', {});
}

function apiGenerateFuelMonthlyPdf() {
  return _generatePdfCommon_('FuelReport', {});
}

function apiGenerateFuelDailyPdf() {
  // ส่งวันที่ปัจจุบันเข้าไปเพื่อทำรายงานรายวัน
  return _generatePdfCommon_('FuelReport', { day: new Date().getDate() });
}

function selfTestFuelReportUIFix() {
  Logger.log("--- SELF TEST: Fuel Report Modification ---");
  var fRes = apiGetFuelHistory();
  var allFuel = (fRes && fRes.ok) ? fRes.data : [];
  
  Logger.log("STEP1: fuelData โหลดได้กี่ record: " + allFuel.length);

  var totalCost = 0, totalLiters = 0, summaryMap = {};
  allFuel.forEach(function(r) {
     var c = (r.cost || 0), l = (r.liters || 0), p = r.plate || 'ไม่ระบุ';
     r.remark = r.jobType || r.budgetType || '-'; 
     if (!summaryMap[p]) summaryMap[p] = { plate: p, trips: 0, liters: 0, cost: 0, driversSet: new Set() };
     summaryMap[p].trips++;
     summaryMap[p].liters += l;
     summaryMap[p].cost += c;
     if (r.driver) summaryMap[p].driversSet.add(r.driver);
  });

  var summaryArray = Object.keys(summaryMap).map(function(k) { 
        var sm = summaryMap[k];
        sm.drivers = Array.from(sm.driversSet || []).filter(Boolean).join(', ');
        return sm; 
    });
  Logger.log("STEP2: summaryMap grouping มีกี่ plate: " + summaryArray.length);

  var allPlatesHaveDrivers = summaryArray.every(function(s) { return s.drivers != null; });
  Logger.log("STEP3: แต่ละ plate มี drivers field ถูกต้อง: " + (allPlatesHaveDrivers ? "PASS" : "FAIL"));

  var allDetailsHaveRemark = allFuel.every(function(r) { return r.remark != null; });
  Logger.log("STEP4: detail array มี remark field ครบทุก record: " + (allDetailsHaveRemark ? "PASS" : "FAIL"));

  try {
     var res = apiGenerateFuelMonthlyPdf();
     Logger.log("STEP5: PDF generate สำเร็จ: " + ((res && res.ok && res.url) ? "PASS" : "FAIL"));
  } catch (e) {
     Logger.log("STEP5: PDF generate สำเร็จ: FAIL (" + e.message + ")\n" + e.stack);
  }
}

// ===================== DRIVER MANAGEMENT =====================
function getDriversFromAdmin_(settings) {
  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('Admin');
    if (!sh) {
      return { ok: false, error: "ไม่พบชีต 'Admin'", drivers: [] };
    }

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2) {
      return { ok: true, drivers: [] };
    }

    const vs = _sheetApiGetValues_(sh, 1, 1, lastRow, lastCol, 'getDriversFromAdmin_');
    const headers = vs[0].map(h => String(h || '').trim().toLowerCase());
    const ixUser = headers.indexOf('username');
    const ixPass = headers.indexOf('password');
    const ixName = headers.indexOf('name');
    const ixRole = headers.indexOf('role');

    if (ixUser === -1 || ixPass === -1 || ixName === -1 || ixRole === -1) {
      return {
        ok: false,
        error: "ชีต Admin ต้องมีหัวตาราง: username | password | name | Role",
        drivers: []
      };
    }

    const statusKv = settings && settings['DriverStatus'] ? settings['DriverStatus'] : readSettingKV_('DriverStatus');
    const statusMap = parseBoolMap_(statusKv.val);

    const allowedRoles = ['driver', 'admindriver'];
    const rows = vs.slice(1);
    const drivers = rows
      .map(r => {
        const rawRole = String(r[ixRole] || '').trim();
        return {
          username: String(r[ixUser] || '').trim(),
          pass:     String(r[ixPass] || '').trim(),
          name:     String(r[ixName] || '').trim(),
          role:     rawRole,
          _roleLc:  rawRole.toLowerCase()
        };
      })
      .filter(d => d.username || d.name)
      .filter(d => allowedRoles.indexOf(d._roleLc) !== -1)
      .map(d => {
        const isActive = statusMap.hasOwnProperty(d.name) 
          ? !!statusMap[d.name] 
          : true;

        return {
          username: d.username,
          pass: d.pass,
          name: d.name,
          role: d.role,
          active: isActive
        };
      });
      
    return { ok: true, drivers: drivers };
  } catch (e) {
    return { ok: false, error: e.message, drivers: [] };
  }
}

// ===================== ADDITIONAL REQUIRED FUNCTIONS =====================
const TH_MONTHS_ = {
  'มกราคม':1,'กุมภาพันธ์':2,'มีนาคม':3,'เมษายน':4,'พฤษภาคม':5,'มิถุนายน':6,
  'กรกฎาคม':7,'สิงหาคม':8,'กันยายน':9,'ตุลาคม':10,'พฤศจิกายน':11,'ธันวาคม':12,
  'ม.ค.':1,'ก.พ.':2,'มี.ค.':3,'เม.ย.':4,'พ.ค.':5,'มิ.ย.':6,
  'ก.ค.':7,'ส.ค.':8,'ก.ย.':9,'ต.ค.':10,'พ.ย.':11,'ธ.ค.':12
};

function thaiToArabic_(text) {
  if (text == null) return text;
  return String(text).replace(/[๐-๙]/g, d => '๐๑๒๓๔๕๖๗๘๙'.indexOf(d));
}

function parseTimeSafe_(timeInput) {
  if (timeInput instanceof Date) return Utilities.formatDate(timeInput, TZ, 'HH:mm');
  // FIX: Google Sheets serial time (dateTimeRenderOption:SERIAL_NUMBER) arrives as decimal fraction in [0,1).
  // e.g. 0.3333 = 08:00, 0.5416 = 13:00. Must convert before string processing to avoid fallback to 00:00.
  if (typeof timeInput === 'number' && timeInput >= 0 && timeInput < 1) {
    var totalMins = Math.round(timeInput * 24 * 60);
    var hh = Math.floor(totalMins / 60) % 24;
    var mm = totalMins % 60;
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }
  let s = thaiToArabic_(String(timeInput || '').trim()).toLowerCase();
  if (!s) return '00:00';

  s = s.replace(/นาฬิกา/g,'').replace(/น\./g,'').replace(/\s+/g,' ');
  s = s.replace(/[\. ]+/g, ':')
       .replace(/[^0-9:]/g,'')
       .replace(/:+/g,':')
       .replace(/^:|:$/g,'');

  if (/^\d{3,4}$/.test(s)) s = s.padStart(4,'0').replace(/(\d{2})(\d{2})/, '$1:$2');
  if (/^\d{1,2}$/.test(s)) s = s + ':00';

  const m = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return '00:00';
  const h = +m[1], mi = +m[2];
  if (h>23 || mi>59) return '00:00';
  return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`;
}

function formatPhoneNumber_(raw) {
  if (!raw) return '';
  let phone = String(raw).replace(/[\s\-\(\)]/g, '');
  if (phone.length === 9 && !phone.startsWith('0')) phone = '0' + phone;
  return phone;
}

function formatPhoneDisplay_(raw) {
  var phone = formatPhoneNumber_(raw);
  if (!phone) return '';
  if (/^0\d{9}$/.test(phone)) return phone.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
  return phone;
}

function getStatusKeySafe_(raw) {
  try {
    if (typeof getStatusKey_ === 'function') {
      const k = getStatusKey_(raw);
      if (k) {
        if (k === 'driver_claimed') return 'pending';
        return k;
      }
    }
  } catch (_) {}

  const t = String(raw || '').toLowerCase().trim();

  if (/ไม่อนุมัติ|reject|ปฏิเสธ|fail/.test(t)) return 'rejected';
  if (/ยกเลิก|cancel/.test(t)) return 'cancelled';
  // รองรับสถานะงานที่ถูก "ปิด/เสร็จ" ให้ถือเป็นงานอนุมัติแล้ว
  if (/closed|completed|done|finish|ปิดงาน|ปิดแล้ว|เสร็จ|จบงาน/.test(t)) return 'approved';
  if (t === 'driver_special_approved' || /กรณีพิเศษ|เร่งด่วน/.test(t)) return 'driver_special_approved';
  if (t === 'driver_claimed' || /รับงาน/.test(t)) return 'pending';
  if (t === 'approved' || /อนุมัติ|อนมัติ|approved|ok|pass/.test(t)) return 'approved';
  if (/รออนุมัติ|pending/.test(t)) return 'pending';

  return 'pending';
}

function headerIndex_(headArr, logs) {
  const head = headArr.map(s => String(s || '').trim());
  const idx = {};

  // helper: find first matching header from a list (case-sensitive first, then case-insensitive)
  const findHeader_ = (candidates) => {
    const list = (Array.isArray(candidates) ? candidates : [candidates])
      .map(x => String(x || '').trim())
      .filter(Boolean);

    // 1) exact match
    for (var i = 0; i < list.length; i++) {
      var p = head.indexOf(list[i]);
      if (p !== -1) return p;
    }

    // 2) case-insensitive match
    const headLower = head.map(h => String(h).toLowerCase());
    for (var j = 0; j < list.length; j++) {
      var q = headLower.indexOf(String(list[j]).toLowerCase());
      if (q !== -1) return q;
    }

    return -1;
  };

  // ✅ ใช้ COLMAP เป็นหลัก (รองรับหัวคอลัมน์หลายชื่อ เช่น email/อีเมล และ File/ไฟล์แนบ)
  Object.keys(COLMAP).forEach(k => {
    idx[k] = findHeader_(COLMAP[k]);
  });

  // Alias (คงเดิมเพื่อไม่ให้ของเก่าพัง)
  idx['place'] = idx['destination'];
  idx['plate'] = idx['vehicle'];
  idx['vehicleSelected'] = idx['requestedVehicle'];
  idx['file'] = idx['fileUrl'];

  return idx;
}

// ===================== BOOKING ID MANAGEMENT =====================
function reserveNextBookingId() {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Data');
    if (!sh) throw new Error('ไม่พบชีต Data');
    
    var maxInSheet = detectMaxBookingId_(sh);
    var lastUsed = Number(props.getProperty('COUNTER_BOOKING_ID') || '0');
    var base = Math.max(maxInSheet, lastUsed);
    var next = base + 1;
    
    props.setProperty('COUNTER_BOOKING_ID', String(next));
    
    Logger.log('reserveNextBookingId: MaxInSheet=' + maxInSheet + ', LastUsed=' + lastUsed + ', Base=' + base + ' -> Next ID=' + next);
    return next;
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function detectMaxBookingId_(sheet) {
  var pos = findHeaderRowAndCol_(sheet);
  var startRow = pos.headerRow + 1;
  var lastRow = sheet.getLastRow();
  if (lastRow < startRow) return 0;
  
  var range = sheet.getRange(startRow, pos.idCol, lastRow - pos.headerRow + 1, 1);
  var values = range.getValues();
  
  var maxId = 0;
  for (var i = 0; i < values.length; i++) {
    var id = parseFloat(values[i][0]);
    if (!isNaN(id) && id > maxId) {
      maxId = id;
    }
  }
  return maxId;
}

function findHeaderRowAndCol_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var scanHeaderRows = Math.min(lastRow, 5);
  if (scanHeaderRows < 1) return { headerRow: 1, idCol: 18 };

  var headVals = sheet.getRange(1, 1, scanHeaderRows, lastCol).getValues();
  var aliases = ['booking id', 'bookingid', 'booking-id', 'id'];
  
  for (var r = 0; r < headVals.length; r++) {
    for (var c = 0; c < headVals[r].length; c++) {
      var cellValue = String(headVals[r][c] || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (aliases.includes(cellValue)) {
        return { headerRow: r + 1, idCol: c + 1 };
      }
    }
  }
  return { headerRow: 1, idCol: 18 };
}

// ===================== DATA ROW BUILDER =====================
function buildRowForDataSheet(parsed, bookingIdFinal) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Data');
  if (!sh) throw new Error("ไม่พบชีต 'Data' ค่ะบอส!");

  // ✅ ดึง Header ล่าสุดจากหน้าชีตจริง
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(h => String(h || '').trim());

  if (typeof headerIndex_ !== 'function') {
    throw new Error('Missing function: headerIndex_');
  }
  const idx = headerIndex_(headers) || {};

  // ✅ สร้างแถวเปล่าตามจำนวนคอลัมน์จริงใน Sheet (Index-agnostic)
  const row = new Array(headers.length).fill('');

  const tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
  const toStr = (v) => String(v == null ? '' : v).trim();

  // ✅ normalize "-" / empty
  const cleanDash = (v) => {
    const s = toStr(v);
    if (!s) return '';
    if (s === '-') return '';
    return s;
  };

  // ✅ Date formatter รองรับ Date/ISO/dd/MM/yyyy/BE
  const fmtD = (d) => {
    if (!d) return '';
    if (d instanceof Date && !isNaN(d.getTime())) return Utilities.formatDate(d, tz, 'dd/MM/yyyy');

    const s = toStr(d);

    // ISO: yyyy-MM-dd
    const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (mIso) return `${mIso[3]}/${mIso[2]}/${mIso[1]}`;

    // dd/MM/yyyy or dd/MM/BBBB
    const mDMY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mDMY) {
      const dd = String(mDMY[1]).padStart(2, '0');
      const mm = String(mDMY[2]).padStart(2, '0');
      const yy = String(mDMY[3]);
      return `${dd}/${mm}/${yy}`;
    }

    return s;
  };

  // ✅ Time formatter รองรับ "9:00", "09:00", "09:00 AM", "9.00", "0900"
  const fmtT = (t) => {
    const s0 = toStr(t);
    if (!s0) return '';

    // ถ้ามี parseTimeSafe_ ให้ใช้ก่อน
    if (typeof parseTimeSafe_ === 'function') {
      const hhmm = toStr(parseTimeSafe_(s0));
      if (hhmm) return hhmm;
    }

    let s = s0.replace('.', ':').replace(/\s+/g, ' ').trim();

    // 0900 -> 09:00
    const m4 = s.match(/^(\d{2})(\d{2})$/);
    if (m4) return `${m4[1]}:${m4[2]}`;

    // 9:00 / 09:00
    const m = s.match(/^(\d{1,2}):(\d{2})/);
    if (m) return String(m[1]).padStart(2, '0') + ':' + m[2];

    // fallback: ส่งคืนเดิม (แต่ถือว่าไม่ชัวร์)
    Logger.log('[buildRowForDataSheet] ⚠️ Unrecognized time format: ' + s0);
    return s0;
  };

  // ✅ Normalize carType ให้เป็นภาษาไทยมาตรฐาน + รองรับ array
  const normalizeCarType_ = (raw) => {
    let s = raw;
    if (Array.isArray(s)) s = s.join(', ');
    s = toStr(s);

    if (!s || s === '-') return '';

    const low = s.toLowerCase();
    const typeList =[];

    if (low.includes('van') || low.includes('ตู้') || low.includes('รถตู้') || low.includes('win')) typeList.push('รถตู้');
    if (low.includes('truck') || low.includes('กระบะ') || low.includes('บรรทุก') || low.includes('รถบรรทุก')) typeList.push('รถบรรทุก');

    return typeList.length ? Array.from(new Set(typeList)).join(', ') : s;
  };

  // ✅ key alias รองรับ headerIndex_ ที่ใช้ชื่อไม่เหมือนกัน
  const ALIAS = {
    name:['name', 'fullname', 'ชื่อ-สกุล'],
    status: ['status', 'สถานะ'],
    phone:['phone', 'tel', 'เบอร์โทร'],
    position:['position', 'ตำแหน่ง'],
    department:['department', 'org', 'dept', 'หน่วยงาน', 'ฝ่าย', 'ส่วนงาน', 'สังกัด'],
    email:['email', 'Email'],
    
    // 🍓[BERRY FIX] เพิ่ม Alias สำหรับ 2 คอลัมน์ใหม่
    workType: ['workType', 'jobType', 'ประเภทงาน'], 
    workName:['workName', 'projectName', 'ชื่อโครงการ/งาน', 'project', 'purpose', 'งาน/โครงการ'],
    
    destination:['destination', 'place', 'location', 'สถานที่'],
    carType:['carType', 'vehicleType', 'ประเภทรถ'],
    startDate:['startDate', 'วันเริ่มต้น', 'วันไป'],
    startTime:['startTime', 'เวลาเริ่มต้น', 'เวลาไป'],
    endDate:['endDate', 'วันสิ้นสุด', 'วันกลับ'],
    endTime: ['endTime', 'เวลาสิ้นสุด', 'เวลากลับ'],
    passengers:['passengers', 'people', 'จำนวนผู้ร่วมเดินทาง'],
    bookingId:['bookingId', 'id', 'Booking ID'],
    vehicleCount:['vehicleCount', 'carCount', 'จำนวนรถที่ต้องการ'],
    fileUrl:['fileUrl', 'file', 'File', 'ไฟล์แนบ'],
    reason:['reason', 'Reason', 'หมายเหตุ/เหตุผล', 'หมายเหตุ'],
    cancelReason:['cancelReason', 'CancelReason', 'เหตุผลยกเลิก'],
    vehicle:['vehicle', 'plate', 'เลขทะเบียนรถ'],
    driver:['driver', 'drivers', 'พนักงานขับรถ']
  };

  // ✅ set cell by canonical key with alias fallback
  const setCellSmart_ = (canonicalKey, value) => {
    const keys = ALIAS[canonicalKey] || [canonicalKey];

    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (idx[k] !== undefined && idx[k] !== -1) {
        row[idx[k]] = value;
        return true;
      }
    }
    return false;
  };

  // ✅ warn for missing required keys (แต่ไม่ throw เพื่อไม่ทำให้ระบบเดิมพัง)
  (function assertHeaderMap_() {
    const must =['bookingId', 'name', 'status', 'startDate', 'startTime', 'endDate', 'endTime'];
    const missing = must.filter(k => !setCellSmart_(k, row[idx[k] || 0])); 
  })();

  // ✅ ตรวจ missing แบบไม่มี side effect
  (function warnMissingHeaderKeys_() {
    const must =['bookingId', 'name', 'status', 'startDate', 'startTime', 'endDate', 'endTime'];
    const missing =[];

    must.forEach(k => {
      const keys = ALIAS[k] || [k];
      const okFound = keys.some(kk => idx[kk] !== undefined && idx[kk] !== -1);
      if (!okFound) missing.push(k);
    });

    if (missing.length) {
      Logger.log('[buildRowForDataSheet] ⚠️ Missing header map for keys: ' + missing.join(', '));
    }
  })();

  // ✅ Values
  const name = toStr(parsed.name);
  const status = toStr(parsed.status || 'pending');

  const phone = (typeof formatPhoneNumber_ === 'function')
    ? formatPhoneNumber_(parsed.phone)
    : toStr(parsed.phone);

  const dept = toStr(parsed.org || parsed.department);
  
  // 🍓 [BERRY FIX] ดึงค่าประเภทงานและชื่อโครงการจาก parsed payload ให้ถูกต้อง
  const jobType = toStr(parsed.workType || parsed.jobType);
  const projectName = toStr(parsed.workName || parsed.projectName || parsed.project || parsed.purpose);
  
  const place = toStr(parsed.place || parsed.destination);

  const carType = normalizeCarType_(parsed.carType || parsed.vehicleType);

  const startDate = fmtD(parsed.startDate);
  const startTime = fmtT(parsed.startTime);
  const endDate = fmtD(parsed.endDate || parsed.startDate);
  const endTime = fmtT(parsed.endTime);

  const passengers = toStr(parsed.passengers == null ? '1' : parsed.passengers);
  const bookingId = toStr(bookingIdFinal);

  const reason = toStr(parsed.reason);
  const cancelReason = toStr(parsed.cancelReason);

  const vehicleCount = toStr(parsed.vehicleCount || '1');

  // 💖[FILE LOGIC] หยอดลงคอลัมน์ File เสมอ ถ้าว่างให้ใส่ '-'
  let fileVal = cleanDash(parsed.fileUrl || parsed.file);
  if (!fileVal) fileVal = '-';

  // ✅ Write row
  setCellSmart_('name', name);
  setCellSmart_('status', status);
  setCellSmart_('phone', phone);
  setCellSmart_('position', toStr(parsed.position));
  setCellSmart_('department', dept);
  setCellSmart_('email', toStr(parsed.email));
  
  // 🍓 [BERRY FIX] เขียนค่าลง 2 คอลัมน์ใหม่
  setCellSmart_('workType', jobType);
  setCellSmart_('workName', projectName);
  
  setCellSmart_('destination', place);
  setCellSmart_('carType', carType);

  setCellSmart_('startDate', startDate);
  setCellSmart_('startTime', startTime);
  setCellSmart_('endDate', endDate);
  setCellSmart_('endTime', endTime);

  setCellSmart_('passengers', passengers);
  setCellSmart_('vehicleCount', vehicleCount);

  setCellSmart_('bookingId', bookingId);

  setCellSmart_('fileUrl', fileVal);

  setCellSmart_('reason', reason);
  setCellSmart_('cancelReason', cancelReason);

  // ✅ ล้างค่าคอลัมน์ที่ควรว่างตอนเริ่ม
  setCellSmart_('vehicle', '');
  setCellSmart_('driver', '');

  // ✅ HARDEN: ถ้า startTime/endTime ว่าง ให้ log เตือน (ช่วยตาม bug เวลา 00:00)
  if (!startTime) Logger.log('[buildRowForDataSheet] ⚠️ startTime empty → message may fallback to 00:00');
  if (!endTime) Logger.log('[buildRowForDataSheet] ⚠️ endTime empty → message may fallback to 00:00');

  return row;
}



function getBookingObjectById_(bookingId) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_MAIN_NAME);
  if (!sh) throw new Error('ไม่พบชีต Data');

  var id = String(bookingId || '').trim();
  if (!id) throw new Error('bookingId ว่าง');

  var lr = sh.getLastRow();
  var lc = sh.getLastColumn();
  if (lr < 2) return null;

  var headers = sh.getRange(1, 1, 1, lc).getValues()[0].map(function(x){ return String(x||'').trim(); });
  var idCol = headers.indexOf('Booking ID') + 1;
  if (idCol < 1) throw new Error('ไม่พบคอลัมน์ Booking ID');

  var ids = sh.getRange(2, idCol, lr - 1, 1).getValues();
  var rowIndex = -1;
  for (var i = 0; i < ids.length; i++) {
    var v = String(ids[i][0] || '').trim();
    if (v === id) { rowIndex = i + 2; break; }
  }
  if (rowIndex < 0) return null;

  var row = sh.getRange(rowIndex, 1, 1, lc).getValues()[0];
  var obj = {};
  for (var c = 0; c < headers.length; c++) obj[headers[c] || ('C' + (c+1))] = row[c];

  obj.bookingId = obj.bookingId || obj['Booking ID'] || id;
  obj.name = obj.name || obj['ชื่อ-สกุล'];
  obj.phone = obj.phone || obj['เบอร์โทร'];
  obj.project = obj.project || obj['งาน/โครงการ'];
  obj.place = obj.place || obj['สถานที่'];
  obj.carType = obj.carType || obj['ประเภทรถ'];
  obj.plate = obj.plate || obj['เลขทะเบียนรถ'];
  obj.driver = obj.driver || obj['พนักงานขับรถ'];
  obj.startDate = obj.startDate || obj['วันเริ่มต้น'];
  obj.startTime = obj.startTime || obj['เวลาเริ่มต้น'];
  obj.endDate = obj.endDate || obj['วันสิ้นสุด'];
  obj.endTime = obj.endTime || obj['เวลาสิ้นสุด'];
  obj.passengers = obj.passengers || obj['จำนวนผู้ร่วมเดินทาง'];
  obj.vehicleCount = obj.vehicleCount || obj['จำนวนรถที่ต้องการ'];
  obj.status = obj.status || obj['สถานะ'];
  obj.reason = obj.reason || obj['Reason'];
  obj.cancelReason = obj.cancelReason || obj['CancelReason'];

  return obj;
}


// ===================== SETTINGS MANAGEMENT =====================
function readSettingKV_(key){
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('setting');
  if(!sh) throw new Error("ไม่พบชีต setting");
  const lastRow = sh.getLastRow();
  const rows = sh.getRange(1,1,lastRow,2).getValues();
  for (let i=0;i<rows.length;i++){
    if (String(rows[i][0]).trim() === key) {
      return {row:i+1, val:String(rows[i][1]||'')};
    }
  }
  return {row:-1, val:''};
}

function parseBoolMap_(s){
  const m={};
  String(s||'').split(',').forEach(pair=>{
    const [k,v] = pair.split(':').map(x=>String(x||'').trim());
    if(k) m[k]= (String(v).toLowerCase()==='true' || v==='1');
  });
  return m;
}

// ===================== ADD MISSING FUNCTIONS =====================
function logEvent_(type, bookingId, obj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Log') || ss.insertSheet('Log');
  sh.appendRow([new Date(), String(type||''), String(bookingId||''), JSON.stringify(obj||{},null,0)]);
}

function logActivity_(action, id, message) {
  logEvent_(action, id, { message: message });
}

function getTZ() {
  return VB_CFG.TZ || 'Asia/Bangkok';
}


function isOverlapping_(startA, endA, startB, endB) {
  // เงื่อนไขคือ:
  // A เริ่มก่อน B จบ และ A จบหลัง B เริ่ม
  return startA < endB && endA > startB;
}

function formatVehicleUnavailableLabel_(reason) {
  var r = String(reason || '').trim();
  if (!r) return 'รถไม่ว่าง';
  if (/ซ่อม|repair|maintenance|งดใช้|ส่งซ่อม/i.test(r)) return 'รถไม่ว่าง (ซ่อม)';
  return 'รถไม่ว่าง';
}

function stripVehicleReasonDriverNotes_(reason) {
  var r = String(reason || '').trim();
  var idx = r.indexOf(' | ');
  return idx > -1 ? r.substring(0, idx).trim() : r;
}

function getAvailableVehicles(payload) {
  try {
    if (!payload) throw new Error('ข้อมูลวันเวลาไม่ครบถ้วน');

    const d1 = payload.startDate || payload.date;
    const d2 = payload.endDate || payload.date || d1;
    const excludeId = String(payload.bookingId || '').trim();
    const includeDrivers = payload.includeDrivers !== false;
    const clean = function(s) {
      return String(s || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    };

    const nd1 = parseDateToISO_(d1);
    const nd2 = parseDateToISO_(d2);
    const startTime24 = parseTimeSafe_(payload.startTime);
    const endTime24 = parseTimeSafe_(payload.endTime);
    const reqStart = parseDateTime_(nd1, startTime24);
    const reqEnd = parseDateTime_(nd2, endTime24);
    const nowMs = getServerNowBangkok_().getTime();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_MAIN_NAME);
    const headers = _sheetApiGetValues_(sh, 1, 1, 1, sh.getLastColumn(), 'getAvailableVehicles headers')[0];
    const idx = headerIndex_(headers);
    const lastRow = sh.getLastRow();
    const neededDataCols = [
      idx.bookingId, idx.status, idx.startDate, idx.startTime, idx.endDate, idx.endTime,
      idx.vehicle, idx.driver, idx.project, idx.purpose, idx.workType
    ].filter(function(v) { return typeof v === 'number' && v >= 0; });
    const dataReadCols = neededDataCols.length ? (Math.max.apply(null, neededDataCols) + 1) : headers.length;
    const values = lastRow > 1
      ? _sheetApiGetValues_(sh, 2, 1, lastRow - 1, dataReadCols, 'getAvailableVehicles rows')
      : [];

    const busyPlatesMap = {};
    const busyDriversMap = {};
    const actualEndsMap = getActualEndsMap();

    for (const row of values) {
      const rowId = clean(row[idx.bookingId]);
      if (excludeId && rowId === excludeId) continue;

      const statusRaw = String(row[idx.status] || '').trim().toLowerCase();
      const status = getStatusKeySafe_(statusRaw);
      const isSoftClosedStatus = /(closed|completed|done|finish|ปิด|เสร็จ|จบ)/.test(statusRaw);
      if (status === 'approved' || status === 'pending' || status === 'driver_special_approved') {
        const rStartISO = parseDateToISO_(row[idx.startDate]);
        const bStart = parseDateTime_(rStartISO, parseTimeSafe_(row[idx.startTime]));
        let bEnd = parseDateTime_(parseDateToISO_(row[idx.endDate]) || rStartISO, parseTimeSafe_(row[idx.endTime]));

        const aEndObj = actualEndsMap[rowId];
        if (isSoftClosedStatus && aEndObj && aEndObj.actualEndAtObj && !isNaN(aEndObj.actualEndAtObj.getTime())) {
          bEnd = aEndObj.actualEndAtObj;
        }

        if (bEnd && !isNaN(bEnd.getTime()) && bEnd.getTime() <= nowMs) {
          continue;
        }

        if (bStart && bEnd && isOverlapping_(reqStart, reqEnd, bStart, bEnd)) {
          const job = clean(row[idx.project] || row[idx.purpose] || 'ติดงาน');

          const pCell = clean(row[idx.vehicle]);
          if (pCell) {
            pCell.split(',').forEach(function(p) {
              const plate = clean(p);
              if (plate) busyPlatesMap[plate] = job;
            });
          }

          // skip driver marking จาก booking row ที่เป็นงานซ่อม
          // Availability sheet handle driver scope แบบ per-phase (dropoff/pickup/pickup_support)
          const workTypeRaw = clean(idx.workType >= 0 ? row[idx.workType] : '');
          const purposeRaw  = clean(row[idx.project] || row[idx.purpose] || '');
          const isRepairJob = /ซ่อม|repair|maintenance|ส่งซ่อม/i.test(workTypeRaw + '|' + purposeRaw);
          if (!isRepairJob) {
            const dCell = clean(row[idx.driver]);
            if (dCell) {
              dCell.split(',').forEach(function(d) {
                const name = normalizeRadarName_(clean(d)) || clean(d);
                if (name) busyDriversMap[name] = job;
              });
            }
          }
        }
      }
    }

    // ─────────────────────────────────────────────
    // 🍓 BERRY FIX: parse เวลาจาก Availability Sheet
    // รองรับ Date object และ Serial Number
    // เหมือนวิธีที่ Radar ใช้ใน getRadarDateTime_()
    // ─────────────────────────────────────────────
    const tz = Session.getScriptTimeZone() || 'Asia/Bangkok';

    function parseAvailTime_(tVal) {
      if (!tVal && tVal !== 0) return '00:00';
      if (tVal instanceof Date && !isNaN(tVal.getTime())) {
        return Utilities.formatDate(tVal, tz, 'HH:mm');
      }
      if (typeof tVal === 'number' && isFinite(tVal)) {
        var mins = Math.round((tVal % 1) * 24 * 60);
        mins = Math.max(0, Math.min(mins, 1439));
        return (Math.floor(mins / 60) < 10 ? '0' : '') + Math.floor(mins / 60) + ':' +
               (mins % 60 < 10 ? '0' : '') + mins % 60;
      }
      return parseTimeSafe_(String(tVal));
    }

    function parseAvailDate_(dVal) {
      if (!dVal) return null;
      if (dVal instanceof Date && !isNaN(dVal.getTime())) {
        return Utilities.formatDate(dVal, tz, 'yyyy-MM-dd');
      }
      return parseDateToISO_(dVal);
    }

    const shAvail = ss.getSheetByName('Availability');
    if (shAvail) {
      const availLastRow = shAvail.getLastRow();
      const availLastCol = shAvail.getLastColumn();
      if (availLastRow > 1 && availLastCol > 0) {
      const availData = _sheetApiGetValues_(shAvail, 1, 1, availLastRow, availLastCol, 'getAvailableVehicles availability rows');
      const avHeaders = availData[0];
      const avStatusIdx = avHeaders.indexOf('status');
      const avTripPhaseIdx = avHeaders.indexOf('tripPhase');

      for (let i = 1; i < availData.length; i++) {
        const resTypeLc = clean(availData[i][0]).toLowerCase();
        const resId     = clean(availData[i][1]);
        const reason    = clean(availData[i][6]);
        const avStatus = (avStatusIdx > -1) ? String(availData[i][avStatusIdx] || '').trim().toLowerCase() : '';
        const avTripPhase = (avTripPhaseIdx > -1) ? clean(availData[i][avTripPhaseIdx]).toLowerCase() : '';

        if (avStatus === 'closed') continue;
        if (resTypeLc !== 'vehicle' && resTypeLc !== 'driver') continue;

        const bStart = parseDateTime_(
          parseAvailDate_(availData[i][2]),
          parseAvailTime_(availData[i][3])
        );
        let bEnd = parseDateTime_(
          parseAvailDate_(availData[i][4]) || parseAvailDate_(availData[i][2]),
          parseAvailTime_(availData[i][5])
        );
        bEnd = normalizeDriverTripPhaseEnd_(resTypeLc, avTripPhase, bStart, bEnd);

        Logger.log('[AdminPanel] Avail row ' + i +
          ' type=' + resTypeLc + ' id=' + resId +
          ' bStart=' + (bStart ? Utilities.formatDate(bStart, tz, 'yyyy-MM-dd HH:mm') : 'NULL') +
          ' bEnd='   + (bEnd   ? Utilities.formatDate(bEnd,   tz, 'yyyy-MM-dd HH:mm') : 'NULL') +
          ' overlap=' + (bStart && bEnd ? isOverlapping_(reqStart, reqEnd, bStart, bEnd) : 'SKIP')
        );

        if (bEnd && !isNaN(bEnd.getTime()) && bEnd.getTime() <= reqStart.getTime()) {
          continue;
        }

        if (bStart && bEnd && isOverlapping_(reqStart, reqEnd, bStart, bEnd)) {
          if (resTypeLc === 'vehicle') {
            busyPlatesMap[resId] = reason || 'งดใช้/ซ่อมบำรุง 🔧';
          } else if (resTypeLc === 'driver') {
            const driverKey = normalizeRadarName_(resId) || resId;
            busyDriversMap[driverKey] = reason || 'ลางาน/พักงาน';
          }
        }
      }
      }
    }

    const vStatusMap = parseBoolMap_(readSettingKV_('VehicleAvailability').val);
    const dStatusMap = parseBoolMap_(readSettingKV_('DriverStatus').val);

    const vehiclesRes = getAllVehiclePlatesFromSettings();
    const vehicleStatus = (vehiclesRes.ok ? vehiclesRes.all : []).map(function(v) {
      const p = clean(v.plate);
      const isManualActive = vStatusMap.hasOwnProperty(p) ? vStatusMap[p] : true;
      const plateBusyReason = busyPlatesMap[p];

      if (plateBusyReason && typeof plateBusyReason === 'string' && /หมดเวลา|พ้นเวลา|expired|past|เลยเวลา/i.test(plateBusyReason)) {
        delete busyPlatesMap[p];
      }

      if (!isManualActive) {
        return {
          plate: p,
          name: v.name,
          type: v.type,
          active: false,
          available: false,
          badge: 'งดใช้/ซ่อมบำรุง 🔧'
        };
      }

      if (busyPlatesMap[p]) {
        const reasonText = busyPlatesMap[p];
        return {
          plate: p,
          name: v.name,
          type: v.type,
          active: true,
          available: false,
          badge: formatVehicleUnavailableLabel_(reasonText),
          busyDetail: stripVehicleReasonDriverNotes_(reasonText)
        };
      }

      return {
        plate: p,
        name: v.name,
        type: v.type,
        active: true,
        available: true,
        badge: 'ว่าง'
      };
    });

    const driversRes = includeDrivers ? getDriversFromAdmin_() : { ok: true, drivers: [] };
    const driverList = (driversRes.ok ? driversRes.drivers : []).map(function(d) {
      const name = clean(typeof d === 'object' ? d.name : d);
      const normName = normalizeRadarName_(name) || name;
      const isManualActive = dStatusMap.hasOwnProperty(name) ? dStatusMap[name] : true;
      const busyJob = busyDriversMap[normName] || busyDriversMap[name];

      if (!isManualActive) {
        return {
          name: name,
          active: false,
          busyBadge: 'พักงาน',
          isBusy: false
        };
      }

      return {
        name: name,
        active: true,
        busyBadge: busyJob ? ('ติดงาน: ' + busyJob) : '',
        isBusy: !!busyJob
      };
    });

    return { ok: true, vehicles: vehicleStatus, drivers: driverList };

  } catch (e) {
    Logger.log('getAvailableVehicles Error: ' + e.stack);
    return { ok: false, error: e.message };
  }
}


function getTimelineData(payload) {
  try {
    if (!payload || !payload.dateISO) throw new Error('dateISO is required');
    const dateISO = String(payload.dateISO);
    const filterPlate = String(payload.plate || '').trim();

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(SHEET_MAIN_NAME);
    if (!sh) throw new Error("Sheet Data not found");

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 1) {
      return { ok: true, dateISO: dateISO, plates:[], bookings: [] };
    }
    const rng = sh.getRange(1, 1, lastRow, lastCol).getValues();

    const header = rng[0].map(x => String(x || '').trim());
    const idx = headerIndex_(header);
    
    // ตรวจสอบคอลัมน์ที่จำเป็นพื้นฐาน
    if (idx.startDate === undefined || idx.startTime === undefined || idx.status === undefined) {
      throw new Error("Timeline failed: Missing required columns (startDate, startTime, status).");
    }

    // วันเป้าหมาย (00:00 - 23:59)
    const dayStart = parseDateTime_(dateISO, "00:00");
    const dayEnd = parseDateTime_(dateISO, "23:59");

    function overlaps(d1, t1, d2, t2) {
      const iso1 = parseDateToISO_(d1) || String(d1 || '');
      const iso2 = parseDateToISO_(d2) || iso1;
      
      const sTimeSafe = parseTimeSafe_(t1 || '00:00');
      const eTimeSafe = parseTimeSafe_(t2 || t1 || '00:00');

      const s = parseDateTime_(iso1, sTimeSafe);
      const e = parseDateTime_(iso2, eTimeSafe);
      if (!s || !e) return false;
      
      // ถ้าเวลาเริ่มและจบเท่ากัน ให้บวก 1 นาทีเพื่อให้คำนวณช่วงเวลาได้
      if (e.getTime() === s.getTime()) {
        e.setMinutes(e.getMinutes() + 1);
      }
      
      return (e >= dayStart && s <= dayEnd);
    }

    const list =[];
    for (let r = 1; r < rng.length; r++) {
      const row = rng[r];
      const st = getStatusKeySafe_(row[idx.status]);
      
      // 💖[BERRY UPDATE] ปลดล็อก: ดึงทุกสถานะ (Approved, Pending, Rejected, Cancelled)
      // เพื่อให้รายงานสรุปประจำวัน (Daily Report) ได้ข้อมูลครบถ้วน
      
      const plate = String(idx.vehicle >= 0 ? row[idx.vehicle] : '').trim();
      if (filterPlate && plate !== filterPlate) continue;

      const sDate = (idx.startDate >= 0 ? row[idx.startDate] : '');
      const sTime = (idx.startTime >= 0 ? row[idx.startTime] : '');
      const eDate = (idx.endDate >= 0 ? row[idx.endDate] : sDate);
      const eTime = (idx.endTime >= 0 ? row[idx.endTime] : sTime);

      if (!overlaps(sDate, sTime, eDate, eTime)) continue;
      
      const driver = String(idx.driver >= 0 ? row[idx.driver] : '').trim();
      
      list.push({
        bookingId: String(idx.bookingId >= 0 ? row[idx.bookingId] : '').trim(),
        status: st,
        plate: plate,
        carType: String(idx.carType >= 0 ? row[idx.carType] : '').trim(), 
        requestedVehicle: String(idx.requestedVehicle >= 0 ? row[idx.requestedVehicle] : '').trim(),
        name: String(idx.name >= 0 ? row[idx.name] : '').trim(),
        // 🍓 [BERRY FIX] ดึงจาก Key ใหม่ และมี Fallback
        purpose: String(idx.workName >= 0 ? row[idx.workName] : (idx.project >= 0 ? row[idx.project] : '')).trim(),
        destination: String(idx.destination >= 0 ? row[idx.destination] : '').trim(),
        startDate: parseDateToISO_(sDate) || dateISO,
        startTime: parseTimeSafe_(sTime),
        endDate: parseDateToISO_(eDate) || dateISO,
        endTime: parseTimeSafe_(eTime),
        driver: driver,
        passengers: String(idx.passengers >= 0 ? row[idx.passengers] : '').trim(),
        
        // 💖 [BERRY ADD] เพิ่มฟิลด์ให้ครบถ้วนสำหรับ UI และ Report
        phone: String(idx.phone >= 0 ? row[idx.phone] : '').trim(),
        org: String(idx.department >= 0 ? row[idx.department] : '').trim(),
        fileUrl: String(idx.fileUrl >= 0 ? row[idx.fileUrl] : '').trim(), // File
        reason: String(idx.reason >= 0 ? row[idx.reason] : '').trim(), // Note/Reason
        cancelReason: String(idx.cancelReason >= 0 ? row[idx.cancelReason] : '').trim() // Cancel Reason
      });
    }

    // รายการทะเบียนรถสำหรับ dropdown (เหมือนเดิม)
    let plates =[];
    try {
      const pRes = getAllVehiclePlatesFromSettings();
      if (pRes && pRes.ok && pRes.all) {
        plates = pRes.all.map(v => v.plate);
      }
    } catch (e) {
      const set = {};
      for (let r2 = 1; r2 < rng.length; r2++) {
        const p = String(idx.vehicle >= 0 ? rng[r2][idx.vehicle] : '').trim();
        if (p) set[p] = 1;
      }
      plates = Object.keys(set);
    }

    return { ok: true, dateISO: dateISO, plates: plates, bookings: list };
  } catch (err) {
    Logger.log("getTimelineData Error: " + err.stack);
    return { ok: false, error: err.message };
  }
}
// ===================== EXPORT FUNCTIONS =====================
function getWebAppInitialData() {
  var payload = arguments && arguments.length ? (arguments[0] || {}) : {};
  return getMainData_({
    forceRefresh: payload.forceRefresh === true || payload.skipCache === true
  });
}



function ping() {
  return { ok:true, ts: new Date().toISOString() };
}

function submitForm(payload) {
  return createBookingAndBroadcast_(payload);
}

// ===================== AUTH & SESSION =====================
function logoutUser() {
  // ใน GAS Web App ไม่มี Session ฝั่ง Server ถาวร 
  // แต่เราต้องมีฟังก์ชันนี้เพื่อให้ Client เรียกแล้วไม่ Error
  // และใช้สำหรับเคลียร์ Cache ฝั่ง Server ที่เกี่ยวข้องกับ User คนนั้น (ถ้ามี)
  return { ok: true, message: 'Logged out from server context' };
}

// ===================== ADMIN FUNCTIONS =====================
function checkUserSession() {
  try {
    return { ok: true, data: { isLoggedIn: false, role: 'Guest' } };
  } catch (e) {
    Logger.log(`Error in checkUserSession: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

function verifyAdminLogin(formData) {
  try {
    const { username, password } = formData;
    
    if (!username || !password) {
      return { ok: false, error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };
    }

    const userData = getUserDataByUsername_(username);
    if (!userData) {
      return { ok: false, error: 'ไม่พบชื่อผู้ใช้นี้ในระบบ' };
    }

    const isPasswordMatch = checkPassword_(username, password);
    if (isPasswordMatch) {
      return {
        ok: true,
        data: {
          isLoggedIn: true,
          username: username,
          role: userData.Role,
          displayName: userData.DisplayName
        }
      };
    } else {
      return { ok: false, error: 'รหัสผ่านไม่ถูกต้อง' };
    }
  } catch (e) {
    Logger.log(`Error in verifyAdminLogin: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

function apiUserCancelBooking(payload) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: "ระบบยุ่ง กรุณาลองใหม่ค่ะ" };

  try {
    var id = String(payload.bookingId).trim();
    var inputPhoneRaw = String(payload.phone || '').replace(/\D/g, '');
    var inputPhoneCheck = inputPhoneRaw.substring(inputPhoneRaw.length - 9); 

    var reason = String(payload.reason || '').trim();
    var noTelegram = payload.noTelegram === true;

    if (!id || inputPhoneRaw.length < 9 || !reason) throw new Error("ข้อมูลไม่ครบ");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Data");
    if (!sheet) throw new Error("ไม่พบชีต Data");

    var headers = _sheetApiGetValues_(sheet, 1, 1, 1, sheet.getLastColumn(), 'apiUserCancelBooking headers')[0];
    var map = headerIndex_(headers);

    if (map.bookingId === undefined || map.phone === undefined || map.status === undefined) {
      throw new Error("โครงสร้างตารางไม่ถูกต้อง");
    }

    var data = _sheetApiGetValues_(sheet, 1, 1, sheet.getLastRow(), sheet.getLastColumn(), 'apiUserCancelBooking rows');
    var rowIndex = -1;
    var rowData = null;

    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][map.bookingId]).trim() === id) {
        var rowPhoneRaw = String(data[i][map.phone]).replace(/\D/g, '');
        var rowPhoneCheck = rowPhoneRaw.substring(rowPhoneRaw.length - 9);

        if (rowPhoneCheck !== inputPhoneCheck) {
          throw new Error("เบอร์โทรศัพท์ไม่ตรงกับข้อมูลการจอง");
        }
        
        var currentStatus = String(data[i][map.status] || '').toLowerCase();
        if (currentStatus === 'cancelled' || currentStatus === 'rejected') {
          throw new Error("รายการนี้ถูกยกเลิกหรือปฏิเสธไปแล้ว");
        }

        rowIndex = i + 1;
        rowData = data[i];
        break;
      }
    }

    if (rowIndex === -1) throw new Error("ไม่พบรายการจอง หรือเบอร์โทรผิด");

    // บันทึกลง Sheet
    rowData[map.status] = 'cancelled';
    if (map.cancelReason !== undefined) {
      rowData[map.cancelReason] = reason;
    } else if (map.reason !== undefined) {
      rowData[map.reason] = "User Cancel: " + reason;
    }

    _sheetApiUpdateValues_(sheet, rowIndex, 1, [rowData], { label: 'apiUserCancelBooking row update' });
    try { clearInitialCache_(); } catch(e) {}

    // 📢 ส่วนแจ้งเตือน Telegram
    if (!noTelegram) {
      try {
        var notifyData = {};
        for (var k = 0; k < headers.length; k++) {
          notifyData[headers[k]] = rowData[k];
        }
        
        // 🍓 Berry Edit: อัปเดตข้อมูลให้สดใหม่ก่อนส่งไป Build Message
        notifyData['สถานะ'] = 'cancelled';
        notifyData['status'] = 'cancelled'; // เพิ่มเผื่อไว้
        notifyData['Reason'] = reason;     // เพื่อให้ไปโผล่ในบรรทัดหมายเหตุของ Telegram
        notifyData['Booking ID'] = id;

        // เรียกใช้ตัวส่งที่เราทำไว้ (ส่งจริง)
        sendTelegramNotify(notifyData, false); 
      } catch (ex) {
        Logger.log("Notify Error: " + ex.message);
      }
    }

    try { logActivity_('USER_CANCEL', id, { status: 'cancelled', reason: reason }); } catch(e) {}

    return { ok: true, id: id, status: 'cancelled' };

  } catch (e) {
    Logger.log("Cancel Error: " + e.stack);
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function getUserDataByUsername_(username) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Admin"); 
    if (!sheet) {
      throw new Error("ไม่พบชีต 'Admin' ค่ะ!");
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase()); 
    
    const userCol = headers.indexOf("username");
    const nameCol = headers.indexOf("name");        
    const roleCol = headers.indexOf("role");        

    if (userCol === -1 || roleCol === -1 || nameCol === -1) {
      Logger.log(`❌ [Helper Error] ไม่พบคอลัมน์ที่ต้องการค่ะ!`);
      Logger.log(`   (กำลังมองหา: 'username', 'name', 'role')`);
      Logger.log(`   (ที่เจอในชีตคือ: [${headers.join(', ')}])`);
      return null;
    }

    const cleanString = (str) => {
      if (typeof str !== 'string') str = str.toString();
      return str.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();
    };

    const safeUsername = cleanString(username);

    for (let i = 1; i < data.length; i++) {
      const sheetUsername = cleanString(data[i][userCol]);
      if (sheetUsername === safeUsername) {
        return { 
          Role: data[i][roleCol], 
          DisplayName: data[i][nameCol] 
        };
      }
    }
    return null;
  } catch (e) {
    Logger.log(`❌ [Helper Error] เกิดข้อผิดพลาด: ${e.message}`);
    return null;
  }
}

function checkPassword_(username, password) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Admin");
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase());
    const userCol = headers.indexOf("username");
    const passCol = headers.indexOf("password");

    if (passCol === -1) {
      Logger.log("❌ [checkPassword_] ไม่พบคอลัมน์ 'password' ในชีต Admin!");
      return false;
    }

    const cleanString = (str) => {
      if (typeof str !== 'string') str = str.toString();
      return str.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();
    };
    
    const cleanUsername = cleanString(username);

    for (let i = 1; i < data.length; i++) {
      const sheetUsername = cleanString(data[i][userCol]);
      if (sheetUsername === cleanUsername) {
        return data[i][passCol].toString() === password.toString();
      }
    }
    return false;
  } catch (e) {
     Logger.log(`❌ [checkPassword_] Error: ${e.message}`);
     return false;
  }
}

// ===================== ANCHOR: File Upload & Form Data (NEW) =====================
/* [ANCHOR: Insurance & Maintenance Services (Full Safe Version)] */

// --- Helper 1: ค้นหาแถวว่างถัดไป (คงไว้เผื่อใช้) ---
function _getNextRow_(sh) {
  return sh.getLastRow() + 1;
}

// --- Helper 3: Save Base64 File (จำเป็นสำหรับ Maintenance) ---
function _saveBase64File_(base64Data, filename) {
  if (!base64Data || !filename) return null;
  try {
    var parts = base64Data.split(',');
    var mimeType = parts[0].match(/:(.*?);/)[1];
    var bytes = Utilities.base64Decode(parts[1]);
    var blob = Utilities.newBlob(bytes, mimeType, filename);
    
    // หาโฟลเดอร์ (หรือสร้างใหม่ถ้าไม่มี)
    var folders = DriveApp.getFoldersByName("V-Berry Uploads");
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("V-Berry Uploads");
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (e) {
    Logger.log("Save File Error: " + e.message);
    return "";
  }
}

// 1. บันทึกข้อมูลประกันภัย (เพิ่ม LockService)
function apiSaveInsurance(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // รอคิวสูงสุด 10 วินาที
    
    if (!payload || !payload.plate || !payload.company || !payload.endDate) {
      throw new Error('ข้อมูลไม่ครบถ้วน (ทะเบียนรถ, บริษัท, วันสิ้นสุด)');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('Insurance');
    if (!sh) throw new Error("ไม่พบชีต 'Insurance'");

    const id = 'INS-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyMMddHHmm');
    const end = new Date(payload.endDate);
    const now = new Date();
    const status = (end < now) ? 'Expired' : 'Active';

    // Map ตาม Header: InsuranceID | Plate | Provider | PolicyNumber | StartDate | EndDate | Status | Remark | Cost
    const newRow = [
      id,
      String(payload.plate || ''),
      String(payload.company || ''),
      String(payload.policyNo || ''),
      payload.startDate ? new Date(payload.startDate) : null,
      end,
      status,
      String(payload.note || ''),
      payload.cost ? Number(payload.cost) : 0
    ];
    
    sh.appendRow(newRow); // ใช้ appendRow ปลอดภัยกว่า
    
    return { ok: true, id: id };
  } catch (e) {
    Logger.log('❌ apiSaveInsurance ERROR: ' + e.stack);
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

// 2. ดึงข้อมูลประกันภัย
function apiGetInsuranceHistory() {
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Insurance');
    if (!sh || sh.getLastRow() < 2) return { ok: true, data: [] };
    
    const lastRow = sh.getLastRow();
    // อ่านข้อมูล A ถึง I (9 คอลัมน์)
    const vals = sh.getRange(2, 1, lastRow - 1, 9).getValues();
    
    const data = vals.map(r => {
      const endDate = r[5] ? new Date(r[5]) : null;
      let realStatus = 'active';
      if (endDate) {
         const now = new Date();
         const diff = (endDate - now) / (1000 * 60 * 60 * 24);
         if (diff < 0) realStatus = 'expired';
         else if (diff < 30) realStatus = 'warning';
      }

      return {
        id: String(r[0]),
        plate: String(r[1]),
        company: String(r[2]),
        policyNo: String(r[3]),
        startDate: _fmtThaiDateBE(r[4] ? new Date(r[4]) : null),
        endDate: _fmtThaiDateBE(endDate),
        status: realStatus,        
        remark: String(r[7]),
        cost: Number(r[8] || 0)
      };
    }).reverse();

    return { ok: true, data: data };
  } catch (e) { 
    return { ok: false, error: e.message }; 
  }
}

// 3. บันทึกข้อมูลซ่อมบำรุง (เพิ่ม LockService + File Upload)
function apiSaveMaintenance(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    if (!payload || !payload.plate || !payload.topic || !payload.cost || !payload.startDate) {
      throw new Error('ข้อมูลไม่ครบถ้วน (ทะเบียนรถ, รายการซ่อม, ค่าใช้จ่าย, วันที่ซ่อม)');
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('Maintenance');
    if (!sh) throw new Error("ไม่พบชีต 'Maintenance'");
    
    const id = 'MAINT-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyMMddHHmm');
    
    // จัดการไฟล์แนบ
    let fileUrl = '';
    if (payload.fileData) {
      fileUrl = _saveBase64File_(payload.fileData, payload.fileName || 'maint_upload.png');
    }
    
    // Map ตาม Header
    const newRow = [
      id,
      String(payload.plate || ''),
      'ซ่อมบำรุงทั่วไป',
      String(payload.topic || ''),
      new Date(payload.startDate),
      payload.cost ? Number(payload.cost) : 0,
      payload.nextDate ? new Date(payload.nextDate) : null,
      String(payload.note || ''),
      '1',
      new Date(),
      fileUrl
    ];
    
    sh.appendRow(newRow);
    
    return { ok: true, id: id, fileUrl: fileUrl };
  } catch (e) {
    Logger.log('❌ apiSaveMaintenance ERROR: ' + e.stack);
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

// 4. ดึงข้อมูลซ่อมบำรุง
function apiGetMaintenanceHistory() {
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Maintenance');
    if (!sh || sh.getLastRow() < 2) return { ok: true, data: [] };
    
    const lastRow = sh.getLastRow();
    // อ่านข้อมูล A ถึง K (11 คอลัมน์)
    const vals = sh.getRange(2, 1, lastRow - 1, 11).getValues();
    
    const data = vals.map(r => {
      return {
        id: String(r[0]),
        plate: String(r[1]),
        topic: String(r[3]),
        date: _fmtThaiDateBE(r[4] ? new Date(r[4]) : null),
        cost: Number(r[5] || 0),
        nextDate: _fmtThaiDateBE(r[6] ? new Date(r[6]) : null),
        fileUrl: String(r[10] || '')
      };
    }).reverse();
    
    return { ok: true, data: data };
  } catch (e) { return { ok: false, error: e.message }; }
}

function saveInsuranceRecord(form) {
  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('Insurance');
    
    // รวม Driver เข้าไปใน Remark (เพราะชีตนี้ไม่มีคอลัมน์ Driver แยก)
    let finalRemark = form.note || form.remark || '';
    if (form.driver) {
      finalRemark = (finalRemark ? finalRemark + ' ' : '') + '(ผู้บันทึก: ' + form.driver + ')';
    }

    // ✅ เรียงข้อมูลให้ตรงกับชีต Insurance (A-I)
    // [A:ID, B:Plate, C:Provider, D:PolicyNumber, E:StartDate, F:EndDate, G:Status, H:Remark, I:Cost]
    
    const rowData = [
      Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy, HH:mm:ss"), // A
      form.plate,                        // B
      form.company,                      // C
      form.policyNo || form.policyNumber,// D
      form.startDate,                    // E
      form.endDate,                      // F
      'Active',                          // G
      finalRemark,                       // H
      form.cost                          // I: Cost (✅ แก้แล้ว: ใส่ Cost ให้ถูกช่องท้ายสุด)
    ];

    sh.appendRow(rowData);
    return { ok: true, message: 'บันทึกข้อมูลประกันภัยเรียบร้อย' };

  } catch (e) {
    return { ok: false, message: e.toString() };
  }
}

function listInsuranceRecords() {
  try {
    const sheetName = (typeof SHEET_INSURANCE !== 'undefined') ? SHEET_INSURANCE : 'Insurance';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) return { ok: true, data:[] };

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { ok: true, data:[] };

    const rows = data.slice(1);

    const result = rows.map(row => {
      let sDate = row[4] ? _fmtThaiDateBE(row[4]) : '';
      let eDate = row[5] ? _fmtThaiDateBE(row[5]) : '';

      if (sDate === '-') sDate = '';
      if (eDate === '-') eDate = '';

      let realStatus = 'active';
      if (row[5]) {
         const now = new Date();
         const due = new Date(row[5]);
         const diff = (due - now) / (1000 * 60 * 60 * 24);
         if (diff < 0) realStatus = 'expired';
         else if (diff < 30) realStatus = 'warning';
      }

      return {
        timestamp: String(row[0] || ''), // 🍓 BERRY FIX: บังคับเป็น String ป้องกัน Payload แครช
        vehicle:   String(row[1] || ''),
        company:   String(row[2] || ''),
        policyNo:  String(row[3] || ''),
        startDate: sDate,
        endDate:   eDate,
        status:    realStatus,
        remark:    String(row[7] || ''),
        cost:      Number(row[8] || 0)
      };
    });

    return { ok: true, data: result.reverse() };

  } catch (e) {
    Logger.log("List Ins Error: " + e.toString());
    return { ok: false, message: e.toString(), data:[] };
  }
}

/* [ANCHOR: Server - listMaintenanceRecords] */
function listMaintenanceRecords() {
  try {
    const sheetName = (typeof SHEET_MAINTENANCE !== 'undefined') ? SHEET_MAINTENANCE : 'Maintenance';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) return { ok: true, data:[] };

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { ok: true, data:[] };

    const rows = data.slice(1);
    const result = rows.map(row => ({
      timestamp: String(row[0] || ''), // 🍓 BERRY FIX: บังคับเป็น String ป้องกัน Payload แครช
      vehicle:   String(row[1] || ''),
      date:      row[2] ? _fmtThaiDateBE(row[2]) : '',
      type:      String(row[3] || ''),
      cost:      Number(row[4] || 0),
      odometer:  String(row[5] || ''),
      location:  String(row[6] || ''),
      remark:    String(row[7] || ''),
      fileUrl:   String(row[8] || '')
    }));

    return { ok: true, data: result.reverse() };

  } catch (e) {
    Logger.log("List Maint Error: " + e.toString());
    return { ok: false, message: e.toString(), data:[] };
  }
}



function saveMaintenanceRecord(form, fileData) {
  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('Maintenance');

    // จัดการไฟล์
    let fileUrl = '';
    if (fileData && fileData.data && fileData.fileName) {
       try {
         const folderName = 'Maintenance_Slip';
         const folder = DriveApp.getFoldersByName(folderName).hasNext() ? DriveApp.getFoldersByName(folderName).next() : DriveApp.createFolder(folderName);
         const blob = Utilities.newBlob(Utilities.base64Decode(fileData.data), fileData.mimeType || 'image/jpeg', fileData.fileName);
         const file = folder.createFile(blob);
         file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
         fileUrl = file.getUrl();
       } catch (err) { Logger.log("Maint Upload Error: " + err); }
    }

    // รวม Driver เข้าไปใน Remark (เพราะชีตนี้ไม่มีคอลัมน์ Driver แยก)
    let finalRemark = form.remark || '';
    if (form.driver) {
      finalRemark = (finalRemark ? finalRemark + ' ' : '') + '(ผู้บันทึก: ' + form.driver + ')';
    }

    // ✅ เรียงข้อมูลให้ตรงกับชีต Maintenance (A-I)
    // [A:TimeStamp, B:Vehicle, C:Date, D:Type, E:Cost, F:Odometer, G:Location, H:Remark, I:File]
    
    const rowData = [
      Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy, HH:mm:ss"), // A
      form.vehicle || form.plate,        // B
      form.service_date,                 // C
      form.service_type || form.topic,   // D
      form.cost,                         // E
      form.odometer || '',               // F: Odometer (✅ แก้แล้ว: รับค่าจากฟอร์มมาใส่)
      form.location,                     // G
      finalRemark,                       // H
      fileUrl                            // I
    ];

    sh.appendRow(rowData);
    return { ok: true, message: 'บันทึกข้อมูลซ่อมบำรุงเรียบร้อย', fileUrl: fileUrl };

  } catch (e) {
    return { ok: false, message: e.toString() };
  }
}

/* ===================== ANCHOR: Fuel Management (Fixed Columns) ===================== */
// Helper: สร้าง ID แบบสุ่ม
function _generateFuelLogId() {
  return 'FL-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyMMddHHmmss');
}

// Helper: บันทึกไฟล์ Base64 ลง Drive (ปรับปรุงใหม่ รองรับ PNG/JPG อัตโนมัติ)
function _saveBase64File_(base64Data, fileName) {
  try {
    if (!base64Data) return '';
    
    // แปลง Base64 เป็น Blob
    var decoded = Utilities.base64Decode(base64Data);
    
    // ⚠️ แก้ไข: ไม่ Fix MimeType เป็น JPEG เพื่อให้รองรับ PNG จาก Test Script ได้
    // ให้ Google Drive ตรวจจับจากนามสกุลไฟล์เอง หรือระบุ null
    var blob = Utilities.newBlob(decoded, null, fileName); 
    
    // บันทึกลง Drive
    var file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return file.getUrl();
    
  } catch (e) {
    Logger.log("⚠️ Error Saving File: " + e.toString());
    return ''; 
  }
}

// 🍓 BERRY FIX: จัดการ Header ใหม่ให้ตรง Schema เสมอ และซ่อมแซมคอลัมน์ที่ว่าง/ขาดหายให้ถูกตำแหน่ง ป้องกันคอลัมน์เลื่อน
function syncFuelHeaders_(sh) {
  Logger.log("STEP1: ตรวจ header sheet Fuel");
  const schema = ['FuelLogID', 'BookingID', 'Plate', 'JobType', 'ProjectName', 'Driver', 'StartFuelLevel', 'EndFuelLevel', 'Liters', 'PricePerLiter', 'Cost', 'BudgetType', 'Remark', 'Timestamp', 'Month', 'ReceiptURL'];
  let headers = [];
  if (sh.getLastRow() >= 1) {
    headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), schema.length)).getValues()[0].map(h => String(h || '').trim());
  }
  
  let changed = false;
  
  // ซ่อมแซมและจัดตำแหน่งของคอลัมน์ให้ตรงตาม Schema เสมอ
  for (let i = 0; i < schema.length; i++) {
    if (i >= headers.length) {
      headers.push(schema[i]);
      changed = true;
    } else if (!headers[i] || headers[i] === '') {
      headers[i] = schema[i];
      changed = true;
    }
  }

  if (changed) {
    Logger.log("STEP2: ตรวจว่าคอลัมน์ที่ขาดหรือว่างถูกซ่อมแซมได้จริง");
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f1f5f9");
  }
  
  Logger.log(`STEP3: ตรวจจำนวนคอลัมน์ใหม่ครบตาม schema (Total: ${headers.length})`);
  const map = {};
  headers.forEach((h, i) => map[h] = i);
  return { map, headers };
}

function apiSaveFuel(form) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('Fuel');
    if (!sh) throw new Error("ไม่พบชีต Fuel");

    const sync = syncFuelHeaders_(sh);
    const map = sync.map;
    const headers = sync.headers;

    // File Upload
    let fileUrl = '';
    if (form.fileData && form.fileName) {
       const folder = DriveApp.getFoldersByName('Fuel_Receipts').hasNext() ? DriveApp.getFoldersByName('Fuel_Receipts').next() : DriveApp.createFolder('Fuel_Receipts');
       const blob = Utilities.newBlob(Utilities.base64Decode(form.fileData), form.mimeType || 'application/octet-stream', form.fileName);
       const file = folder.createFile(blob);
       file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
       fileUrl = file.getUrl();
    }
    Logger.log(`STEP6: ตรวจว่า ReceiptURL ลงคอลัมน์ถูกต้อง (${fileUrl ? 'YES' : 'NO'})`);

    const liters = parseFloat(form.liters) || 0;
    const price = parseFloat(form.pricePerLiter) || 0;
    const cost = (liters > 0 && price > 0) ? (liters * price) : 0; 
    Logger.log(`STEP5: ตรวจว่า Cost = Liters × PricePerLiter (${liters} x ${price} = ${cost})`);

    const logId = 'FL-' + Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMddHHmmss");
    const ts = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
    const month = Utilities.formatDate(new Date(), "Asia/Bangkok", "MM/yyyy");

    Logger.log(`STEP4: ตรวจ mapping payload -> row ตาม header ใหม่`);
    Logger.log(`STEP7: ตรวจว่า BudgetType ถูกบันทึกลงคอลัมน์จริง (${form.budgetType})`);
    
    const rowData = new Array(headers.length).fill('');
    const setV = (key, val) => { if (map[key] !== undefined) rowData[map[key]] = val; };

    setV('FuelLogID', logId);
    setV('BookingID', form.project || ''); 
    setV('Plate', form.plate);
    setV('JobType', form.workType);
    setV('ProjectName', form.project);
    setV('Driver', form.driver);
    setV('StartFuelLevel', form.fuelPercentStart);
    setV('EndFuelLevel', form.fuelPercentEnd);
    setV('Liters', liters > 0 ? liters : '');
    setV('PricePerLiter', price > 0 ? price : '');
    setV('Cost', cost > 0 ? cost : '');
    setV('BudgetType', form.budgetType);
    setV('Remark', form.remark);
    setV('Timestamp', ts);
    setV('Month', month);
    setV('ReceiptURL', fileUrl);

    sh.appendRow(rowData);
    return { ok: true, message: 'บันทึกข้อมูลเรียบร้อย', fileUrl: fileUrl };

  } catch (e) {
    Logger.log(`FAIL: apiSaveFuel Error - ${e.message}\nStack: ${e.stack}`);
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function coerceTimeHHmm_(v) {
  const tz = Session.getScriptTimeZone();
  if (v == null || v === '') return '';

  // Case 1: Date object
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, tz, 'HH:mm');
  }

  // Case 2: number serial (Sheets time fraction)
  if (typeof v === 'number') {
    var d = new Date(1899, 11, 30);
    d.setMilliseconds(v * 86400000);
    return Utilities.formatDate(d, tz, 'HH:mm');
  }

  // Case 3: String
  var s = String(v).trim();
  if (s.match(/^\d{1,2}:\d{2}$/)) return s;
  
  return '';
}

function apiGetFuelHistory() {
  try {
    Logger.log("STEP8: ทดสอบ list/read ตารางย้อนหลังจาก schema ใหม่");
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Fuel');
    if (!sh || sh.getLastRow() < 2) return { ok: true, data:[] };

    const sync = syncFuelHeaders_(sh);
    const map = sync.map;
    const headers = sync.headers;

    const vals = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();
    const tz = Session.getScriptTimeZone() || 'Asia/Bangkok';

    const data = vals.filter(r => String(r[map['FuelLogID']] || '').trim() && String(r[map['Plate']] || '').trim()).map(r => {
      const rawDate = r[map['Timestamp']];
      let dateObj = null, dateStr = '-';
      if (rawDate instanceof Date && !isNaN(rawDate.getTime())) dateObj = rawDate;
      else if (rawDate && !isNaN(new Date(rawDate).getTime())) dateObj = new Date(rawDate);

      if (dateObj) {
        // Normalize year to Gregorian (AD) if in Buddhist Era (BE)
        const yFull = dateObj.getFullYear();
        if (yFull >= 2400) {
          const normalizedDate = new Date(dateObj.getTime());
          normalizedDate.setFullYear(yFull - 543);
          dateObj = normalizedDate;
        }
        const y = parseInt(Utilities.formatDate(dateObj, tz, 'yyyy'));
        dateStr = Utilities.formatDate(dateObj, tz, 'dd/MM/') + ((y < 2400) ? y + 543 : y) + ' ' + Utilities.formatDate(dateObj, tz, 'HH:mm') + ' น.';
      }

      return {
        id: String(r[map['FuelLogID']] || ''),
        plate: String(r[map['Plate']] || ''),
        driver: String(r[map['Driver']] || ''),
        jobType: String(r[map['JobType']] || ''),
        budgetType: String(r[map['BudgetType']] || ''),
        liters: Number(r[map['Liters']] || 0),
        pricePerLiter: Number(r[map['PricePerLiter']] || 0),
        cost: Number(r[map['Cost']] || 0),
        fileUrl: String(r[map['ReceiptURL']] || ''),
        timestamp: dateObj ? dateObj.getTime() : 0,
        dateDisplay: dateStr
      };
    }).sort((a, b) => b.timestamp - a.timestamp);

    return { ok: true, data: data };
  } catch (e) {
    Logger.log(`FAIL: apiGetFuelHistory Error - ${e.message}\nStack: ${e.stack}`);
    return { ok: false, error: e.message };
  }
}

/* [ANCHOR: Dashboard Fuel Level Widget - Server] */
function getDashboardFuelLevels() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Fuel');
    if (!sh) return { ok: true, data: [] };

    var lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok: true, data: [] };

    const sync = syncFuelHeaders_(sh);
    const map = sync.map;
    const headers = sync.headers;

    var vals = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
    var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';

    // Group by Plate → เลือก record ล่าสุดจาก Timestamp
    var plateMap = {};

    for (var i = 0; i < vals.length; i++) {
      var plate = String(vals[i][map['Plate']] || '').trim();   // Dynamic mapping for Plate
      if (!plate) continue;

      var rawEnd = vals[i][map['EndFuelLevel']];                // Dynamic mapping for EndFuelLevel
      var rawTs  = vals[i][map['Timestamp']];                   // Dynamic mapping for Timestamp

      // Parse timestamp
      var tsMs = 0;
      var dateObj = null;
      if (rawTs instanceof Date && !isNaN(rawTs.getTime())) {
        dateObj = rawTs;
      } else if (rawTs) {
        var parsed = new Date(rawTs);
        if (!isNaN(parsed.getTime())) {
          dateObj = parsed;
        }
      }

      if (dateObj) {
        // Normalize year to Gregorian (AD) if in Buddhist Era (BE)
        var yFull = dateObj.getFullYear();
        if (yFull >= 2400) {
          var normalizedDate = new Date(dateObj.getTime());
          normalizedDate.setFullYear(yFull - 543);
          dateObj = normalizedDate;
        }
        tsMs = dateObj.getTime();
      }

      // เลือก record ที่ Timestamp ใหม่สุดต่อ Plate
      if (!plateMap[plate] || tsMs > plateMap[plate].tsMs) {
        // Sanitize EndFuelLevel
        var endLevel = parseFloat(rawEnd);
        if (isNaN(endLevel) || endLevel === null || endLevel === undefined) {
          endLevel = null;
        } else {
          endLevel = Math.round(endLevel);
        }

        // แปลงวันที่เป็น พ.ศ.
        var dateDisplay = '-';
        if (dateObj) {
          var y = parseInt(Utilities.formatDate(dateObj, tz, 'yyyy'));
          var thYear = (y < 2400) ? y + 543 : y;
          dateDisplay = Utilities.formatDate(dateObj, tz, 'dd/MM/') + thYear + ' ' + Utilities.formatDate(dateObj, tz, 'HH:mm') + ' น.';
        }

        plateMap[plate] = {
          plate: plate,
          endFuelLevel: endLevel,
          timestamp: tsMs,
          dateDisplay: dateDisplay
        };
      }
    }

    // แปลง Map → Array เรียงตาม Plate
    var result = [];
    for (var p in plateMap) {
      if (plateMap.hasOwnProperty(p)) {
        result.push(plateMap[p]);
      }
    }
    result.sort(function(a, b) {
      return a.plate < b.plate ? -1 : (a.plate > b.plate ? 1 : 0);
    });

    return { ok: true, data: result };

  } catch (e) {
    Logger.log('getDashboardFuelLevels Error: ' + e.message);
    return { ok: false, error: e.message };
  }
}

// ===================== ANCHOR: Data Fetchers (สำหรับดึงมาแสดงหน้าเว็บ) =====================
/* [ANCHOR: Date Helper (Standard - Fixed Time)] */
function _fmtThaiDateTime(d, tStr) {
  var tz = Session.getScriptTimeZone(); // ใช้ TZ ของ Script (Asia/Bangkok)
  
  // --- 1. จัดการวันที่ (Date) ---
  var datePart = '-';
  if (d) {
    // ถ้าเป็น Date Object หรือ String ที่แปลงได้
    var dateObj = (d instanceof Date) ? d : new Date(d);
    if (!isNaN(dateObj.getTime())) {
      var y = parseInt(Utilities.formatDate(dateObj, tz, 'yyyy'));
      var thYear = (y < 2400) ? y + 543 : y; // แปลง ค.ศ. -> พ.ศ.
      datePart = Utilities.formatDate(dateObj, tz, 'dd/MM/') + thYear;
    } else {
      datePart = String(d); // ถ้าแปลงไม่ได้จริงๆ ให้โชว์ค่าเดิม
    }
  }

  // --- 2. จัดการเวลา (Time) ---
  var timePart = '';
  if (tStr) {
    var tObj = null;
    
    // กรณี A: รับมาเป็น Date Object ตรงๆ
    if (tStr instanceof Date) {
      tObj = tStr;
    } 
    // กรณี B: รับมาเป็น String (รวมถึง String ยาวๆ แบบ "Sat Dec 30 1899...")
    else {
      var s = String(tStr).trim();
      // ถ้าเป็น String ยาวๆ ของปี 1899 ให้ลองแปลงเป็น Date
      if (s.length > 10 && (s.includes('1899') || s.includes('GMT') || s.includes('Sat'))) {
         var tryDate = new Date(s);
         if (!isNaN(tryDate.getTime())) tObj = tryDate;
      }
    }

    if (tObj) {
      // ถ้าได้เป็น Date Object แล้ว ให้จัดรูปแบบเป็น HH:mm
      timePart = Utilities.formatDate(tObj, tz, 'HH:mm');
    } else {
      // กรณี C: เป็น String เวลาปกติ เช่น "09:00" หรือ "9:30"
      var m = String(tStr).match(/(\d{1,2}):(\d{2})/);
      if (m) {
        timePart = m[1].padStart(2, '0') + ':' + m[2];
      } else {
        timePart = String(tStr); // ยอมแพ้ คืนค่าเดิม
      }
    }

    // เติม "น." ถ้ามีเวลาและยังไม่มีหน่วย
    if (timePart && timePart !== '-' && !timePart.includes('น.')) {
      timePart += ' น.';
    }
  }
  
  return (datePart + ' ' + timePart).trim();
}

// 1. ดึงประวัติประกันภัย
function apiGetInsuranceHistory() {
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_INSURANCE);
    if (!sh || sh.getLastRow() < 2) return { ok: true, data: [] };
    
    const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
    const data = vals.map(r => ({
      plate: String(r[1]),
      company: String(r[2]),
      endDate: _fmtThaiDateBE(r[5] ? new Date(r[5]) : null), // ใช้ Helper แปลง
      status: calculateStatus_(r[5])
    })).reverse();
    
    return { ok: true, data: data };
  } catch (e) { return { ok: false, error: e.message }; }
}

// 2. ดึงประวัติซ่อมบำรุง
function apiGetMaintenanceHistory() {
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MAINTENANCE);
    if (!sh || sh.getLastRow() < 2) return { ok: true, data: [] };
    
    const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
    const data = vals.map(r => ({
      date: _fmtThaiDateBE(r[0] ? new Date(r[0]) : null), // ใช้ Helper แปลง
      plate: String(r[1]),
      topic: String(r[2]),
      cost: Number(r[3] || 0).toLocaleString()
    })).reverse();
    
    return { ok: true, data: data };
  } catch (e) { return { ok: false, error: e.message }; }
}


// Helper เล็กๆ สำหรับคำนวณสถานะประกัน
function calculateStatus_(dateObj) {
  if (!dateObj) return 'ไม่ระบุ';
  const now = new Date();
  const due = new Date(dateObj);
  const diff = (due - now) / (1000 * 60 * 60 * 24);
  
  if (diff < 0) return 'expired'; // หมดอายุ
  if (diff < 30) return 'warning'; // ใกล้หมด (<30 วัน)
  return 'active'; // ปกติ
}

function getRealTimeAvailableCount(arg1, arg2, arg3) {
  try {
    var dateISO, startTime, endTime;

    // 🛠️ แก้ไขการรับค่า: รองรับทั้งแบบ Object (จาก Client) และ Arguments (จาก Server Test)
    if (typeof arg1 === 'object' && arg1 !== null) {
       dateISO = arg1.dateISO;
       startTime = arg1.startTime;
       endTime = arg1.endTime;
    } else {
       dateISO = arg1;
       startTime = arg2;
       endTime = arg3;
    }

    // 1. ตรวจสอบข้อมูลนำเข้า
    if (!dateISO || !startTime || !endTime) {
      return { ok: false, error: 'ข้อมูลวันเวลาไม่ครบถ้วน (Server Received: ' + JSON.stringify(arg1) + ')' };
    }

    // แปลงเวลาให้เป็น Date Object
    const reqStart = parseDateTime_(dateISO, startTime);
    const reqEnd = parseDateTime_(dateISO, endTime);
    
    if (!reqStart || !reqEnd) {
       return { ok: false, error: 'รูปแบบเวลาไม่ถูกต้อง (Time Parse Error)' };
    }
    
    if (reqEnd <= reqStart) {
      return { ok: false, error: 'เวลาสิ้นสุดต้องหลังเวลาเริ่มต้น' };
    }

    const availableRes = getAvailableVehicles({
      startDate: dateISO,
      endDate: dateISO,
      startTime: startTime,
      endTime: endTime,
      includeDrivers: false
    });
    if (!availableRes || !availableRes.ok) {
      throw new Error(availableRes && availableRes.error ? availableRes.error : 'Unable to check available vehicles');
    }

    const availableListFast = (availableRes.vehicles || [])
      .filter(function(v) { return v && v.available; })
      .map(function(v) { return String(v.plate || '').trim(); })
      .filter(Boolean);
    return {
      ok: true,
      count: availableListFast.length,
      maxAllowed: Math.min(5, availableListFast.length),
      debug: availableListFast
    };

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 2. ดึงข้อมูลรถทั้งหมดและเช็คสถานะซ่อมบำรุง
    const vehiclesRes = getAllVehiclePlatesFromSettings();
    const allVehicles = (vehiclesRes.ok && vehiclesRes.all) ? vehiclesRes.all : [];
    
    const vStatusKv = readSettingKV_('VehicleAvailability');
    const vStatusMap = parseBoolMap_(vStatusKv.val);

    let availableList = allVehicles.filter(v => {
      const isActive = vStatusMap.hasOwnProperty(v.plate) ? vStatusMap[v.plate] : true;
      return isActive;
    }).map(v => v.plate);

    // 3. ตัดรถที่ติดจอง "อนุมัติ"
    const sh = ss.getSheetByName('Data');
    if (sh) {
      const headers = _sheetApiGetValues_(sh, 1, 1, 1, sh.getLastColumn(), 'getRealTimeAvailableCount data headers')[0];
      const idx = headerIndex_(headers);
      const lastRow = sh.getLastRow();
      
    // ANCHOR
      if (lastRow > 1) {
        // อ่านข้อมูลเฉพาะคอลัมน์ที่จำเป็นเพื่อความเร็ว
        const data = _sheetApiGetValues_(sh, 2, 1, lastRow - 1, headers.length, 'getRealTimeAvailableCount data rows');
        
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const status = getStatusKeySafe_(row[idx.status]);
          
          // 🍓 BERRY FIX: เพิ่มเช็ค driver_special_approved
          if (status !== 'approved' && status !== 'driver_special_approved') continue;

          const plateStr = String(row[idx.vehicle] || '').trim();
          if (!plateStr) continue;

          const rDateISO = parseDateToISO_(row[idx.startDate]);
          const rStart = parseDateTime_(rDateISO, parseTimeSafe_(row[idx.startTime]));
          const rEnd = parseDateTime_(parseDateToISO_(row[idx.endDate]) || rDateISO, parseTimeSafe_(row[idx.endTime]));

          if (rStart && rEnd) {
             if (reqStart < rEnd && reqEnd > rStart) {
                const busyPlates = plateStr.split(',').map(p => p.trim());
                availableList = availableList.filter(p => !busyPlates.includes(p));
             }
          }
        }
      }
    }

    // 🍓 BERRY FIX: ตัดรถที่ติดซ่อมบำรุงในช่วงเวลานั้นๆ ออกจากคิว Real-time ด้วย (Auto-Unlock Framework)
    const shAvail = ss.getSheetByName('Availability');
    if (shAvail) {
       const availLastRow = shAvail.getLastRow();
       const availLastCol = shAvail.getLastColumn();
       if (availLastRow > 1 && availLastCol > 0) {
       const availData = _sheetApiGetValues_(shAvail, 1, 1, availLastRow, availLastCol, 'getRealTimeAvailableCount availability rows');
       const headers = availData[0];
       const stIdx = headers.indexOf('status');
       for (let i = 1; i < availData.length; i++) {
          const status = stIdx > -1 ? String(availData[i][stIdx] || '').trim().toLowerCase() : '';
          if (status === 'closed') continue; // 🍓 BERRY FIX: ข้ามบล็อกที่ปิดงานไปแล้ว
          
          if (String(availData[i][0]).trim() === 'vehicle') {
             const vId = String(availData[i][1]).trim();
             // ถ้ารถคันนี้ถูกมองว่าว่างอยู่ ให้ลองเช็คว่าติดซ่อมเวลานี้หรือไม่
             if (availableList.includes(vId)) {
                const bStart = parseDateTime_(availData[i][2], availData[i][3]);
                const bEnd = parseDateTime_(availData[i][4], availData[i][5]);
                if (bStart && bEnd && isOverlapping_(reqStart, reqEnd, bStart, bEnd)) {
                   availableList = availableList.filter(p => p !== vId);
                }
             }
          }
       }
       }
    }

    const count = availableList.length;
    const maxAllowed = Math.min(5, count);

    return { 
      ok: true, 
      count: count, 
      maxAllowed: maxAllowed,
      debug: availableList 
    };

  } catch (e) {
    Logger.log('getRealTimeAvailableCount Error: ' + e.toString());
    return { ok: false, error: e.message };
  }
}

function apiGetBookingsByPhone(phone) {
  try {
    const searchPhone = String(phone || '').replace(/\D/g, ''); // เก็บเฉพาะตัวเลข
    if (searchPhone.length < 9) return { ok: false, error: 'เบอร์โทรศัพท์สั้นเกินไปค่ะ' };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('Data'); // ใช้ชื่อชีตตาม Config
    if (!sh) throw new Error("ไม่พบชีต Data");

    const lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok: true, data: [] };

    // ดึงข้อมูลทั้งหมดมาครั้งเดียว (เพื่อความเร็ว)
    // คาดการณ์ Column Index จาก Header (ใช้ Helper เดิมที่มี)
    const headers = _sheetApiGetValues_(sh, 1, 1, 1, sh.getLastColumn(), 'apiGetBookingsByPhone headers')[0]
      .map(h => String(h || '').trim());
    const idx = headerIndex_(headers); // ฟังก์ชันเดิมในระบบ

    // ตรวจสอบ Index ที่จำเป็น
    if (idx.phone === undefined || idx.bookingId === undefined) {
      throw new Error("ไม่พบคอลัมน์ Phone หรือ Booking ID");
    }

    const neededCols = [idx.phone, idx.bookingId, idx.status, idx.startDate, idx.destination]
      .filter(v => typeof v === 'number' && v >= 0);
    const readCols = neededCols.length ? (Math.max.apply(null, neededCols) + 1) : headers.length;
    const data = _sheetApiGetValues_(sh, 2, 1, lastRow - 1, readCols, 'apiGetBookingsByPhone rows');
    const found = [];

    // วนลูปจากล่างขึ้นบน (ล่าสุดก่อน)
    for (let i = data.length - 1; i >= 0; i--) {
      const row = data[i];
      const rowPhone = String(row[idx.phone] || '').replace(/\D/g, '');
      const status = getStatusKeySafe_(idx.status > -1 ? row[idx.status] : '');

      // เงื่อนไข: เบอร์ตรงกัน และ สถานะต้องไม่ใช่ Cancelled หรือ Rejected ไปแล้ว
      if (rowPhone === searchPhone && status !== 'cancelled' && status !== 'rejected') {
        const dateRaw = idx.startDate > -1 ? row[idx.startDate] : '';
        const dateStr = (dateRaw instanceof Date) ? Utilities.formatDate(dateRaw, 'Asia/Bangkok', 'dd/MM/yyyy') : String(dateRaw);
        
        found.push({
          bookingId: String(row[idx.bookingId]),
          summary: `${dateStr} : ${String(idx.destination > -1 ? row[idx.destination] : '-')}`
        });
      }

      if (found.length >= 5) break; // เอาแค่ 5 รายการล่าสุด
    }

    return { ok: true, data: found };

  } catch (e) {
    Logger.log("apiGetBookingsByPhone Error: " + e.message);
    return { ok: false, error: e.message };
  }
}

/* [ANCHOR: Public Vehicle List for Dropdowns] */
function getVehicleList() {
  try {
    // 1. ดึงข้อมูลรถทั้งหมด (ใช้ Helper ที่พี่มีอยู่แล้ว)
    // ถ้าไม่มีฟังก์ชันนี้ ให้ลองเช็คว่าใน Code.gs มี getAllVehiclePlatesFromSettings ไหม
    var vehiclesRes = getAllVehiclePlatesFromSettings(); 
    var allVehicles = vehiclesRes.ok ? vehiclesRes.all : [];

    // 2. อ่านสถานะ Active/Inactive จาก Setting
    var vStatusKv = readSettingKV_('VehicleAvailability');
    var vStatusMap = parseBoolMap_(vStatusKv.val);

    // 3. กรองเอาเฉพาะรถที่ Active (สถานะเป็น true)
    var activeVehicles = allVehicles.filter(function(v) {
       // ถ้าไม่มีค่าใน Setting ให้ถือว่า Active (true) โดย Default
       return vStatusMap.hasOwnProperty(v.plate) ? vStatusMap[v.plate] : true;
    });

    // 4. ส่งกลับเฉพาะ "เลขทะเบียน" เป็น Array
    return activeVehicles.map(function(v) { return v.plate; });

  } catch (e) {
    Logger.log("getVehicleList Error: " + e.toString());
    // Fallback: กรณี Error ให้ส่งค่าว่าง หรือค่าทดสอบไปก่อน
    return ["99-9999 Test", "ฮค-1234"]; 
  }
}


function apiCheckAndPatchFileColumn() {
  const log = [];
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('Data'); // ชื่อชีตต้องตรงตาม Config
    if (!sh) throw new Error("ไม่พบชีต Data");

    const lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok: true, msg: "ไม่มีข้อมูลให้ตรวจสอบ" };

    // ค้นหา Index ของคอลัมน์ File จาก Header
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    let fileColIdx = -1;
    
    // ตรวจหาคอลัมน์ที่มีคำว่า File (Case-insensitive)
    for (let i = 0; i < headers.length; i++) {
      if (String(headers[i]).toLowerCase().trim() === 'file') {
        fileColIdx = i + 1; // 1-based index
        break;
      }
    }

    if (fileColIdx === -1) {
        // Fallback: ใช้ค่าคงที่ถ้าหาไม่เจอ (จาก index 19 หรือ Col S)
        fileColIdx = 19; 
        log.push("⚠️ ไม่พบ Header 'File' โดยตรง ใช้ Default Col index: " + fileColIdx);
    } else {
        log.push("✅ พบ Header 'File' ที่คอลัมน์: " + fileColIdx);
    }

    // อ่านข้อมูลเฉพาะคอลัมน์ File
    const range = sh.getRange(2, fileColIdx, lastRow - 1, 1);
    const values = range.getValues();
    let fixedCount = 0;

    const newValues = values.map((r, i) => {
      let val = String(r[0]).trim();
      // ถ้าว่าง หรือ เป็น null/undefined ให้แก้เป็น "-"
      if (!val || val === '') {
        fixedCount++;
        return ['-'];
      }
      return [val];
    });

    // บันทึกกลับถ้ามีการแก้ไข
    if (fixedCount > 0) {
      range.setValues(newValues);
      log.push(`🛠️ ซ่อมแซมแถวที่ว่างจำนวน ${fixedCount} รายการ เรียบร้อยแล้ว`);
    } else {
      log.push("✅ ข้อมูลคอลัมน์ File สมบูรณ์ดีอยู่แล้ว");
    }

    return { ok: true, logs: log };

  } catch (e) {
    return { ok: false, error: e.message, logs: log };
  }
}

function apiUpdateBookingStatus(payload) {
  try {
    payload = payload || {};
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (e0) {}
    }

    // Validate payload (ถ้ามี helper อยู่แล้วให้ใช้)
    if (typeof _assertUpdateStatusPayload_ === 'function') {
      _assertUpdateStatusPayload_(payload);
    }

    var bookingId = String(payload.bookingId || payload.id || '').trim();
    var newStatus = String(payload.status || '').toLowerCase().trim();
    var reasonText = (payload.reason == null) ? '' : String(payload.reason);
    var testMode = payload.testMode === true;
    var noTelegram = payload.noTelegram === true;

    if (!bookingId) return { ok: false, error: 'กรุณาระบุ Booking ID' };
    if (!newStatus) return { ok: false, error: 'กรุณาระบุสถานะ' };

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Data');
    if (!sheet) return { ok: false, error: 'ไม่พบชีต "Data" ในระบบค่ะ' };

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return { ok: false, error: 'ไม่พบข้อมูลในชีต Data' };

    // ---- headers (แถว 1) ----
    var headersRow = _sheetApiGetValues_(sheet, 1, 1, 1, lastCol, 'apiUpdateBookingStatus headers');
    var headers = (headersRow && headersRow[0]) ? headersRow[0].map(function (h) { return String(h || '').trim(); }) : [];

    // ---- idx mapping ----
    var idx = (typeof headerIndex_ === 'function') ? headerIndex_(headers) : null;

    function colIndexByName(name) {
      var i = headers.indexOf(name);
      return (i >= 0) ? i : undefined;
    }

    function normalizeIdx(v) {
      // กัน -1 หรือค่าประหลาด ให้เป็น undefined
      if (v === -1) return undefined;
      if (v === null || v === '' || v === false) return undefined;
      return v;
    }

    if (!idx || typeof idx !== 'object') idx = {};

    // เติม index ที่สำคัญ (ถ้า headerIndex_ ไม่ได้ให้มา)
    if (idx.bookingId === undefined) idx.bookingId = colIndexByName('Booking ID');
    if (idx.status === undefined) idx.status = colIndexByName('สถานะ');
    if (idx.reason === undefined) idx.reason = colIndexByName('Reason');
    if (idx.cancelReason === undefined) idx.cancelReason = colIndexByName('CancelReason');
    if (idx.vehicleCount === undefined) idx.vehicleCount = colIndexByName('จำนวนรถที่ต้องการ');
    if (idx.vehicle === undefined) idx.vehicle = colIndexByName('เลขทะเบียนรถ');
    if (idx.driver === undefined) idx.driver = colIndexByName('พนักงานขับรถ');

    // normalize ทั้งหมด (กัน -1 จาก headerIndex_)
    idx.bookingId = normalizeIdx(idx.bookingId);
    idx.status = normalizeIdx(idx.status);
    idx.reason = normalizeIdx(idx.reason);
    idx.cancelReason = normalizeIdx(idx.cancelReason);
    idx.vehicleCount = normalizeIdx(idx.vehicleCount);
    idx.vehicle = normalizeIdx(idx.vehicle);
    idx.driver = normalizeIdx(idx.driver);

    if (idx.bookingId === undefined) return { ok: false, error: 'ไม่พบคอลัมน์ "Booking ID"' };
    if (idx.status === undefined) return { ok: false, error: 'ไม่พบคอลัมน์ "สถานะ"' };

    // 1) Find row (อ่านทีเดียวทั้ง data)
    var data = _sheetApiGetValues_(sheet, 2, 1, lastRow - 1, lastCol, 'apiUpdateBookingStatus rows');
    var foundOffset = -1; // offset ใน data (0-based)
    for (var i = 0; i < data.length; i++) {
      var idCell = data[i][idx.bookingId];
      if (String(idCell == null ? '' : idCell).trim() === bookingId) {
        foundOffset = i;
        break;
      }
    }
    if (foundOffset < 0) return { ok: false, error: 'ไม่พบ Booking ID: ' + bookingId };

    var rowIndex = foundOffset + 2; // ชีตจริง (1-based) โดยเริ่มข้อมูลที่แถว 2

    // 2) Prepare vehicles/drivers strings
    var vehiclesStr = '';
    var driversStr = '';
    if (payload.vehicles != null) {
      vehiclesStr = Array.isArray(payload.vehicles) ? payload.vehicles.join(', ') : String(payload.vehicles || '');
    }
    if (payload.drivers != null) {
      driversStr = Array.isArray(payload.drivers) ? payload.drivers.join(', ') : String(payload.drivers || '');
    }

    // helper: build row object from row values
    function buildRowObj(rowVals) {
      var obj = {};
      for (var c = 0; c < headers.length; c++) {
        var key = headers[c] || ('COL_' + (c + 1));
        obj[key] = rowVals[c];
      }
      // key มาตรฐานสำหรับ notify
      obj.bookingId = (idx.bookingId !== undefined) ? rowVals[idx.bookingId] : (obj['Booking ID'] || '');
      obj.status = (idx.status !== undefined) ? rowVals[idx.status] : (obj['สถานะ'] || '');
      return obj;
    }

    // Snapshot เดิม
    var oldRowVals = data[foundOffset] ? data[foundOffset].slice() : [];
    var rowObj = buildRowObj(oldRowVals);

    // Guard: กันการกด "อนุมัติ" ซ้ำโดยข้อมูลมอบหมายไม่เปลี่ยนจริง
    if (newStatus === 'approved') {
      var currentStatus = String((idx.status !== undefined ? oldRowVals[idx.status] : '') || '').toLowerCase().trim();
      var requestedCount = null;
      if (payload.vehicleCount != null && payload.vehicleCount !== '') {
        var reqVc = parseInt(payload.vehicleCount, 10);
        if (isFinite(reqVc) && reqVc > 0) requestedCount = reqVc;
      }

      var nextStatusVal = newStatus;
      var nextReasonVal = (idx.reason !== undefined) ? oldRowVals[idx.reason] : '';
      var nextVehicleCountVal = (idx.vehicleCount !== undefined) ? oldRowVals[idx.vehicleCount] : '';
      var nextVehicleVal = (idx.vehicle !== undefined) ? oldRowVals[idx.vehicle] : '';
      var nextDriverVal = (idx.driver !== undefined) ? oldRowVals[idx.driver] : '';

      if (idx.reason !== undefined && reasonText) nextReasonVal = reasonText;
      if (idx.vehicleCount !== undefined && requestedCount != null) nextVehicleCountVal = requestedCount;
      if (idx.vehicle !== undefined && vehiclesStr) nextVehicleVal = vehiclesStr;
      if (idx.driver !== undefined && driversStr) nextDriverVal = driversStr;

      function normCompare(v) {
        if (v == null) return '';
        return String(v).trim();
      }

      var isNoEffectiveChange =
        currentStatus === 'approved' &&
        normCompare(currentStatus) === normCompare(nextStatusVal) &&
        normCompare((idx.reason !== undefined) ? oldRowVals[idx.reason] : '') === normCompare(nextReasonVal) &&
        normCompare((idx.vehicleCount !== undefined) ? oldRowVals[idx.vehicleCount] : '') === normCompare(nextVehicleCountVal) &&
        normCompare((idx.vehicle !== undefined) ? oldRowVals[idx.vehicle] : '') === normCompare(nextVehicleVal) &&
        normCompare((idx.driver !== undefined) ? oldRowVals[idx.driver] : '') === normCompare(nextDriverVal);

      if (isNoEffectiveChange) {
        return {
          ok: true,
          id: bookingId,
          status: newStatus,
          actualCount: normCompare(nextVehicleCountVal),
          testMode: testMode,
          noTelegram: noTelegram,
          telegram: null,
          skipped: true,
          skipReason: 'approved_unchanged'
        };
      }
    }

    // 🍓 [BERRY FIX] ตรวจสอบคิวรถและคนขับชนกัน (Conflict Check) ก่อนบันทึกลงชีต
    if (newStatus === 'approved') {
      if (idx.startDate === undefined) idx.startDate = colIndexByName('วันเริ่มต้น');
      if (idx.startTime === undefined) idx.startTime = colIndexByName('เวลาเริ่มต้น');
      if (idx.endDate === undefined) idx.endDate = colIndexByName('วันสิ้นสุด');
      if (idx.endTime === undefined) idx.endTime = colIndexByName('เวลาสิ้นสุด');

      var sd = rowObj['วันเริ่มต้น'] || '';
      var st = rowObj['เวลาเริ่มต้น'] || '';
      var ed = rowObj['วันสิ้นสุด'] || '';
      var et = rowObj['เวลาสิ้นสุด'] || '';

      var reqVehicles = payload.vehicles ? (Array.isArray(payload.vehicles) ? payload.vehicles : String(payload.vehicles).split(',').map(function(s){return s.trim();})) : [];
      var reqDrivers = payload.drivers ? (Array.isArray(payload.drivers) ? payload.drivers : String(payload.drivers).split(',').map(function(s){return s.trim();})) : [];

      // เรียกใช้ฟังก์ชันตรวจสอบการชนกัน
      if (typeof checkResourcesConflict_ === 'function') {
        var conflictRes = checkResourcesConflict_(sheet, idx, sd, st, ed, et, bookingId, reqVehicles, reqDrivers);
        if (conflictRes && conflictRes.hasConflict) {
          // หากพบการชนกัน จะส่ง Error กลับไปยังหน้าบ้านทันทีและไม่บันทึก
          return { ok: false, error: conflictRes.message }; 
        }
      }
    }

    // 3) Update fields
    oldRowVals[idx.status] = newStatus;

    // ✅ แยก Reason / CancelReason ให้ตรงคอลัมน์
    if (newStatus === 'cancelled') {
      if (idx.cancelReason !== undefined && reasonText) {
        oldRowVals[idx.cancelReason] = reasonText;
      }
    } else {
      if (idx.reason !== undefined && reasonText) {
        oldRowVals[idx.reason] = reasonText;
      }
    }

    // vehicleCount (ถ้าส่งมา)
    var actualCount = null;
    if (payload.vehicleCount != null && payload.vehicleCount !== '') {
      var vc = parseInt(payload.vehicleCount, 10);
      if (isFinite(vc) && vc > 0) {
        if (idx.vehicleCount !== undefined) {
          oldRowVals[idx.vehicleCount] = vc;
        }
        actualCount = vc;
      }
    }

    // Approved -> write vehicles/drivers
    if (newStatus === 'approved') {
      if (idx.vehicle !== undefined && vehiclesStr) oldRowVals[idx.vehicle] = vehiclesStr;
      if (idx.driver !== undefined && driversStr) oldRowVals[idx.driver] = driversStr;
    }

    // 🍓 BERRY FIX: ถ้าแก้สถานะกลับจาก "ปิดงานก่อนเวลา" ให้ล้างประวัติ Actual End
    // เพื่อให้ปฏิทิน/รายการจองแสดงช่วงเวลาและสถานะตามข้อมูลล่าสุดจริง
    try {
      var shActual = ss.getSheetByName('BookingActualEnd');
      if (shActual) {
        var aLastRow = shActual.getLastRow();
        if (aLastRow > 1) {
          var aVals = _sheetApiGetValues_(shActual, 2, 1, aLastRow - 1, 1, 'apiUpdateBookingStatus actualEnd read');
          var deleteRows = [];
          for (var ax = aVals.length - 1; ax >= 0; ax--) {
            if (String(aVals[ax][0] || '').trim() === bookingId) {
              deleteRows.push(ax + 2);
            }
          }
          _sheetApiDeleteRows_(shActual, deleteRows, 'apiUpdateBookingStatus actualEnd delete');
        }
      }
    } catch (eActual) {
      Logger.log('[apiUpdateBookingStatus] clear BookingActualEnd error: ' + eActual);
    }

    // ให้แน่ใจว่าค่าถูกเขียนแล้วก่อนอ่านกลับ
    _sheetApiUpdateValues_(sheet, rowIndex, 1, [oldRowVals], { label: 'apiUpdateBookingStatus row update' });

    // 🍓 BERRY FIX: clear cache ให้หน้าบ้านดึงข้อมูลสถานะล่าสุดเสมอ
    try { clearInitialCache_(); } catch (eCache) {}

    // 4) Refresh rowObj for notify + return
    var freshRowVals = oldRowVals.slice();
    rowObj = buildRowObj(freshRowVals);

    // หากไม่ได้ส่ง vehicleCount มา ลองอ่านจากชีต
    if (actualCount == null) {
      if (idx.vehicleCount !== undefined) {
        var vccell = freshRowVals[idx.vehicleCount];
        var vci = parseInt(vccell, 10);
        actualCount = (isFinite(vci) ? vci : (vccell == null ? '' : vccell));
      } else {
        actualCount = '';
      }
    }

    // 5) Notify (เคารพ noTelegram + testMode)
    var notifyRes = null;
    if (!noTelegram && typeof sendTelegramNotify === 'function') {
      notifyRes = sendTelegramNotify(rowObj, testMode === true);
    }

    return {
      ok: true,
      id: bookingId,
      status: newStatus,
      actualCount: actualCount,
      testMode: testMode,
      noTelegram: noTelegram,
      telegram: notifyRes
    };

  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}



function _assertUpdateStatusPayload_(payload) {
  payload = payload || {};
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch (e) {}
  }

  function err_(msg) { throw new Error('INVALID_PAYLOAD: ' + msg); }

  // bookingId
  var bookingId = String(payload.bookingId || payload.id || '').trim();
  if (!bookingId) err_('missing bookingId');

  // status
  var statusKey = String(payload.status || '').toLowerCase().trim();
  if (!statusKey) err_('missing status');

  var ALLOWED = { pending: 1, approved: 1, rejected: 1, cancelled: 1, canceled: 1 };
  if (!ALLOWED[statusKey]) err_('invalid status => ' + statusKey);

  // dryRun/testMode type guard
  function coerceBool_(v) {
    if (v === true || v === false) return v;
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (v == null || v === '') return false;
    err_('invalid boolean => ' + v);
  }
  if ('dryRun' in payload) payload.dryRun = coerceBool_(payload.dryRun);
  if ('testMode' in payload) payload.testMode = coerceBool_(payload.testMode);

  // vehicles/drivers shape (optional)
  function isCsvOrArr_(v) {
    if (v == null || v === '') return true;
    if (Array.isArray(v)) return true;
    if (typeof v === 'string') return true;
    return false;
  }
  if (!isCsvOrArr_(payload.vehicles)) err_('invalid vehicles type');
  if (!isCsvOrArr_(payload.drivers)) err_('invalid drivers type');

  return true;
}




function coerceTimeHHmm_(v, tz) {
  tz = tz || Session.getScriptTimeZone() || 'Asia/Bangkok';

  if (v == null || v === '') return '';

  // Case 2: number serial (Sheets time fraction)
  if (typeof v === 'number' && isFinite(v)) {
    var totalMinutes = Math.round(v * 24 * 60);
    var hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
    var mi = String(totalMinutes % 60).padStart(2, '0');
    return hh + ':' + mi;
  }

  // Case 3: string
  var s = String(v).trim();
  if (!s) return '';

  // Allow "9:00" -> "09:00"
  var m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return String(m[1]).padStart(2, '0') + ':' + m[2];

  // If it's something else (like "00:00:00") try trim
  m = s.match(/^(\d{1,2}):(\d{2}):(\d{2})/);
  if (m) return String(m[1]).padStart(2, '0') + ':' + m[2];

  return s; // fallback
}

function assertSheetTimeSanity_(sh, hm, bookingId, ok, ng) {
  bookingId = String(bookingId || '').trim();
  if (!bookingId) {
    ng('Sheet time sanity', 'Missing bookingId');
    return;
  }

  // ✅ local helper: coerce time to HH:mm
  function coerceTimeHHmm_(val, tz) {
    try {
      if (val == null || val === '') return '';

      // Date object
      if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime())) {
        return Utilities.formatDate(val, tz, 'HH:mm');
      }

      // number serial (Sheets time fraction)
      if (typeof val === 'number' && isFinite(val)) {
        var totalMinutes = Math.round(val * 24 * 60);
        var hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
        var mi = String(totalMinutes % 60).padStart(2, '0');
        return hh + ':' + mi;
      }

      // string
      var s = String(val).trim();
      if (!s) return '';
      s = s.replace(/\s+/g, ' ').replace(/น\.$/, '').trim(); // remove thai suffix if any
      var m = s.match(/^(\d{1,2}):(\d{2})/);
      if (m) return ('0' + m[1]).slice(-2) + ':' + m[2];

      // string with seconds
      m = s.match(/^(\d{1,2}):(\d{2}):\d{2}/);
      if (m) return ('0' + m[1]).slice(-2) + ':' + m[2];

      return s;
    } catch (_) {
      return '';
    }
  }

 
  // ✅ find row index (duplicate tiny finder to avoid dependency)
  function findRowByBookingIdLocal_(sh2, hm2, bookingId2) {
    bookingId2 = String(bookingId2 || '').trim();
    if (!bookingId2) return -1;

    var lastRow = sh2.getLastRow();
    if (lastRow < 2) return -1;

    var bookingCol = hm2.col('Booking ID');
    var data = sh2.getRange(2, 1, lastRow - 1, hm2.lastCol).getValues();

    for (var i = 0; i < data.length; i++) {
      var v = String(data[i][bookingCol - 1] || '').trim();
      if (v === bookingId2) return i + 2;
    }
    return -1;
  }

  var rowIndex = findRowByBookingIdLocal_(sh, hm, bookingId);
  if (rowIndex <= 0) {
    ng('Sheet time sanity', 'Booking ID not found: ' + bookingId);
    return;
  }

  function pickTimeCol_(candidates) {
    for (var i = 0; i < candidates.length; i++) {
      var h = candidates[i];
      try {
        var colNo = hm.col(h);
        if (colNo) return h;
      } catch (_) {}
    }
    return '';
  }

  var goHeader = pickTimeCol_(['เวลาไป', 'เวลาเริ่มต้น', 'Start Time', 'startTime']);
  var backHeader = pickTimeCol_(['เวลากลับ', 'เวลาสิ้นสุด', 'End Time', 'endTime']);

  if (!goHeader) {
    ng('Sheet เวลาไป header exists', 'Missing header: เวลาไป/เวลาเริ่มต้น/startTime');
    return;
  }
  if (!backHeader) {
    ng('Sheet เวลากลับ header exists', 'Missing header: เวลากลับ/เวลาสิ้นสุด/endTime');
    return;
  }

  var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';

  var goRaw = sh.getRange(rowIndex, hm.col(goHeader)).getValue();
  var backRaw = sh.getRange(rowIndex, hm.col(backHeader)).getValue();

  var go = coerceTimeHHmm_(goRaw, tz);
  var back = coerceTimeHHmm_(backRaw, tz);

  function isInvalid_(t) {
    if (!t) return true;
    if (t === '-' || t === '00:00') return true;
    if (t === '00:00 น.' || t === '00:00:00') return true;
    return false;
  }

  if (!isInvalid_(go)) ok('Sheet เวลาไป valid', go);
  else ng('Sheet เวลาไป valid', 'invalid=' + (go || '(empty)') + ' | raw=' + String(goRaw));

  if (!isInvalid_(back)) ok('Sheet เวลากลับ valid', back);
  else ng('Sheet เวลากลับ valid', 'invalid=' + (back || '(empty)') + ' | raw=' + String(backRaw));
}

// ANCHOR: sendTelegramNotify
function sendTelegramNotify(payload, testMode) {
  function toStr(v) {
    return String(v == null ? '' : v).trim();
  }

  function firstValue(obj, keys) {
    obj = obj || {};
    for (var i = 0; i < keys.length; i++) {
      var val = obj[keys[i]];
      if (val != null && String(val).trim() !== '' && String(val).trim() !== '-') {
        return val;
      }
    }
    return '';
  }

  function normalizeStatus(raw) {
    var s = toStr(raw).toLowerCase();

    if (!s) return 'pending';
    if (s.indexOf('กรณีพิเศษ') > -1 || s.indexOf('พิเศษ') > -1 || s === 'driver_special_approved') return 'driver_special_approved';
    if (s.indexOf('ยกเลิก') > -1 || s.indexOf('cancel') > -1 || s === 'cancelled') return 'cancelled';
    if (s.indexOf('ไม่') > -1 || s.indexOf('reject') > -1 || s === 'rejected') return 'rejected';
    if (s.indexOf('อนุมัติ') > -1 || s.indexOf('approve') > -1 || s === 'approved') return 'approved';
    if (s.indexOf('รับงาน') > -1 || s === 'driver_claimed') return 'pending';

    return 'pending';
  }

  function isEarlyCloseReason_(reasonText) {
    var s = toStr(reasonText).toLowerCase();
    return !!s && (
      s.indexOf('ปิดงานก่อนเวลา') > -1 ||
      s.indexOf('ปิดงานก่อนกำหนด') > -1 ||
      s.indexOf('early close') > -1
    );
  }

  function isBlockFlowPayload_(obj) {
    var status = normalizeStatus(firstValue(obj, ['status', 'สถานะ']));
    var rawType = toStr(firstValue(obj,[
      'resourceType',
      'blockType',
      'availabilityType',
      'type',
      'modalType'
    ])).toLowerCase();

    var rawStatus = toStr(firstValue(obj,[
      'rawStatus',
      'originalStatus',
      'bookingStatus',
      'sourceStatus'
    ])).toLowerCase();

    // 🍓 BERRY FIX 1: ถ้านี่คืองานจองปกติที่อนุมัติแล้ว จะไม่ใช่ฟอร์มการ "ลา/ซ่อม" แน่นอน ให้ปล่อยผ่าน
    if (status === 'approved' || status === 'driver_special_approved') {
      if (rawType !== 'driver' && rawType !== 'vehicle' && rawStatus !== 'driver_block' && rawStatus !== 'vehicle_block') {
        return false;
      }
    }

    var reason = toStr(firstValue(obj, ['reason', 'Reason', 'cancelReason', 'CancelReason']));
    var note = toStr(firstValue(obj, ['note', 'closeNote', 'closeReason']));
    var merged = (reason + ' ' + note).toLowerCase();

    if (rawType === 'driver' || rawType === 'vehicle') return true;
    if (rawStatus === 'driver_block' || rawStatus === 'vehicle_block') return true;
    
    // 🍓 BERRY FIX 2: ดักจับบั๊กคำว่า "เวลา" มีคำว่า "ลา" ซ่อนอยู่
    var isLeave = merged.indexOf('ลางาน') > -1 || (merged.indexOf('ลา') > -1 && merged.indexOf('เวลา') === -1);
    var isRepair = merged.indexOf('ส่งซ่อม') > -1 || merged.indexOf('ซ่อม') > -1;

    if (isLeave || isRepair) {
      return true;
    }

    return false;
  }

  var msg = '';
  var statusKey = 'pending';
  var bookingKey = 'SYS';
  var skipTelegram = false;

  if (typeof payload === 'object' && payload !== null) {
    var safePayload = Object.assign({}, payload);

    var rawStatus = firstValue(safePayload, ['status', 'สถานะ']) || 'pending';
    statusKey = normalizeStatus(rawStatus);

    bookingKey = toStr(firstValue(safePayload,['bookingId', 'id', 'Booking ID']) || 'SYS');

    var reason = '';
    if (statusKey === 'cancelled') {
      reason = toStr(firstValue(safePayload,[
        'cancelReason',
        'CancelReason',
        'reason',
        'Reason'
      ]));
    } else {
      reason = toStr(firstValue(safePayload,[
        'reason',
        'Reason',
        'cancelReason',
        'CancelReason'
      ]));
    }

    var isEarlyClose = isEarlyCloseReason_(reason);

    var actualEndAt = firstValue(safePayload,[
      'actualEndAt',
      'actualEndTime',
      'Actual End',
      'เวลาปิดงานจริง'
    ]);

    if (actualEndAt) {
      safePayload.actualEndAt = actualEndAt;
      if (!safePayload.actualEndTime) safePayload.actualEndTime = actualEndAt;
      if (!safePayload['เวลาปิดงานจริง']) safePayload['เวลาปิดงานจริง'] = actualEndAt;
      if (!safePayload['Actual End']) safePayload['Actual End'] = actualEndAt;
    }

    if (isEarlyClose && !safePayload.Reason && !safePayload.reason) {
      safePayload.Reason = reason;
    } else if (!reason && actualEndAt) {
      reason = 'ปิดงานก่อนเวลา';
      safePayload.Reason = reason;
      isEarlyClose = true;
    }

    if (isEarlyClose && isBlockFlowPayload_(safePayload)) {
      skipTelegram = true;
    }

    msg = buildBookingStatusMessage(safePayload, statusKey, reason);
  } else {
    msg = toStr(payload || '');
  }

  msg = toStr(msg)
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/gi, '')
    .replace(/D\s*น\./gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  if (testMode === true) {
    return {
      ok: true,
      skipped: skipTelegram,
      log: skipTelegram ? '[SKIP TELEGRAM] early close block flow\n' + msg : msg
    };
  }

  if (skipTelegram) {
    Logger.log('[Telegram] SKIP: early close for leave/repair flow | booking=' + bookingKey);
    if (typeof appendTgLog_ === 'function') {
      appendTgLog_('SKIP_EARLY_CLOSE_' + bookingKey, null, msg);
    }
    return { ok: true, skipped: true, message: 'Skip Telegram for early-close block flow' };
  }

  var config = (typeof getTelegramConfig === 'function')
    ? getTelegramConfig()
    : { token: '', chatId: '' };

  var token = config.token;
  var chatId = config.chatId;

  if (testMode === 'send_test') {
    var map = (typeof getSettingMap_ === 'function') ? getSettingMap_() : {};
    token = map['Telegram Bot Test Token ID'] || map['Telegram Bot Test Token'] || token;
    chatId = map['Telegram Test Chat ID'] || map['Telegram Test Chat Id'] || chatId;
  }

  if (!token || !chatId) {
    var err = '❌ Telegram Config Missing (Token or ChatID)';
    if (typeof appendTgLog_ === 'function') appendTgLog_('ERR_CONFIG', null, err);
    return { ok: false, error: err };
  }

  try {
    var url = 'https://api.telegram.org/bot' + token + '/sendMessage';
    var options = {
      method: 'post',
      payload: {
        chat_id: chatId,
        text: msg,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      },
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var resText = response.getContentText();
    var resJson;

    try {
      resJson = JSON.parse(resText);
    } catch (parseErr) {
      resJson = { ok: false, error: 'Telegram response is not valid JSON', raw: resText };
    }

    if (typeof appendTgLog_ === 'function') {
      appendTgLog_('BID_' + bookingKey, response, msg);
    }

    return resJson;
  } catch (e) {
    console.error('❌ Telegram Send Error: ' + e.message);
    if (typeof appendTgLog_ === 'function') {
      appendTgLog_('ERR_SEND', null, e.message);
    }
    return { ok: false, error: e.message };
  }
}


// ===================== FEATURE 1: DRIVER CLAIM =====================
function claimBooking(payload) {
  return {
    ok: false,
    error: 'ปิดการใช้งานฟังก์ชันคนขับรับงานเองแล้ว กรุณาใช้ขั้นตอนอนุมัติจากผู้ดูแลระบบ'
  };
}

// ANCHOR
function specialApproveBooking(payload) {
  var actionRole = String((payload || {})._actionRole || '').toLowerCase().trim();
  if (actionRole === 'driver' || actionRole === 'admin') {
    return { ok: false, error: 'เฉพาะ Role AdminDriver เท่านั้นที่มีสิทธิ์อนุมัติด่วน' };
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return { ok: false, error: 'ระบบไม่ตอบสนอง', stage: 'lock' };
  }

  try {
    payload = payload || {};
    Logger.log('[specialApproveBooking] payload=' + JSON.stringify(payload));

    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName('Data');
    if (!sh) throw new Error('ไม่พบชีต Data');

    var data = _sheetApiGetValues_(sh, 1, 1, sh.getLastRow(), sh.getLastColumn(), 'closeAvailabilityBlock read');
    if (!data || data.length < 2) throw new Error('ไม่พบข้อมูลการจอง');

    var h = data[0].map(function(x) { return String(x || '').trim(); });
    // 🍓 BERRY FIX: ใช้ระบบ Map หัวคอลัมน์อัจฉริยะ ป้องกันบั๊กหาคอลัมน์ไม่เจอ
    var idxMap = headerIndex_(h);
    var idx = {
      bid: idxMap.bookingId,
      st: idxMap.status,
      v: idxMap.vehicle,
      d: idxMap.driver
    };

    if (idx.bid === undefined || idx.st === undefined || idx.v === undefined || idx.d === undefined) {
      throw new Error('โครงสร้างชีต Data ไม่ครบคอลัมน์สำคัญ');
    }

    var bookingId = String(payload.bookingId || '').trim();
    var driverName = String(payload.driverName || '').trim();
    var plate = String(payload.plate || '').trim();

    if (!bookingId) throw new Error('ไม่พบ Booking ID');
    if (!driverName) throw new Error('ไม่พบชื่อพนักงานขับรถ');
    if (!plate) throw new Error('ไม่พบเลขทะเบียนรถ');

    var rowIndex = -1;
    var rowData = null;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idx.bid] || '').trim() === bookingId) {
        rowIndex = i + 1;
        rowData = data[i];
        break;
      }
    }

    if (rowIndex === -1 || !rowData) {
      throw new Error('ไม่พบข้อมูลการจอง');
    }

    var currentStatus = getStatusKeySafe_(rowData[idx.st]);
    if (currentStatus !== 'pending') {
      throw new Error('รายการนี้ไม่ได้อยู่ในสถานะรออนุมัติแล้ว');
    }

    rowData[idx.st] = 'driver_special_approved';
    rowData[idx.v] = plate;
    rowData[idx.d] = driverName;
    _sheetApiUpdateValues_(sh, rowIndex, 1, [rowData], { label: 'specialApproveBooking row update' });
    try { clearInitialCache_(); } catch (e) {}

    Logger.log('[specialApproveBooking] sheet updated bookingId=' + bookingId + ', plate=' + plate + ', driver=' + driverName);

    var freshRow = rowData.slice();
    var notifyObj = {};
    h.forEach(function(key, colIndex) {
      notifyObj[key] = freshRow[colIndex];
    });

    notifyObj.status = 'driver_special_approved';
    notifyObj.bookingId = bookingId;
    notifyObj.driverName = driverName;
    notifyObj.plate = plate;

    var tg = sendTelegramNotify(notifyObj, false);
    Logger.log('[specialApproveBooking] telegram result bookingId=' + bookingId + ' => ' + JSON.stringify(tg));

    var tgOk = !!(tg && (tg.ok === true || tg.result));
    if (!tgOk) {
      return {
        ok: false,
        error: 'บันทึกข้อมูลสำเร็จ แต่ส่ง Telegram ไม่สำเร็จ',
        stage: 'telegram',
        bookingId: bookingId,
        status: 'driver_special_approved',
        plate: plate,
        driverName: driverName,
        sheetSaved: true,
        telegram: tg
      };
    }

    return {
      ok: true,
      bookingId: bookingId,
      status: 'driver_special_approved',
      plate: plate,
      driverName: driverName,
      sheetSaved: true,
      telegram: tg
    };
  } catch (e) {
    Logger.log('[specialApproveBooking][ERROR] ' + (e && e.stack ? e.stack : e));
    return {
      ok: false,
      error: e.message,
      stage: 'server'
    };
  } finally {
    lock.releaseLock();
  }
}
// ===================== FEATURE 2: AVAILABILITY ENGINE =====================
function _getAvailabilitySheet() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('Availability');
  var expectedHeaders = ['resourceType','resourceId','startDate','startTime','endDate','endTime','reason','createdBy','createdAt','assignedDriver','status','closedBy','closedAt','closeNote','tripPhase'];
  if(!sh) {
    sh = ss.insertSheet('Availability');
    _sheetApiUpdateValues_(sh, 1, 1, [expectedHeaders], { label: '_getAvailabilitySheet init headers', valueInputOption: 'RAW' });
  } else {
    // 🍓 BERRY FIX: Backward compatibility for assignedDriver and soft close
    var headerWidth = Math.max(sh.getLastColumn(), expectedHeaders.length);
    var headers = _sheetApiGetValues_(sh, 1, 1, 1, headerWidth, '_getAvailabilitySheet headers')[0];
    var headerChanged = false;
    expectedHeaders.forEach(function(headerName) {
      if (headers.indexOf(headerName) === -1) {
        headers.push(headerName);
        headerChanged = true;
      }
    });
    if (headerChanged) {
      _sheetApiUpdateValues_(sh, 1, 1, [headers], { label: '_getAvailabilitySheet sync headers', valueInputOption: 'RAW' });
    }
  }
  return sh;
}

function createAvailabilityBlock(payload) {
  var lock = LockService.getScriptLock();
  if(!lock.tryLock(5000)) return {ok:false, error:'System busy'};
  try {
    var sh = _getAvailabilitySheet();
    var headers = _sheetApiGetValues_(sh, 1, 1, 1, sh.getLastColumn(), 'createAvailabilityBlock headers')[0];
    var assignedDriverColIndex = headers.indexOf('assignedDriver');
    var tripPhaseColIndex = headers.indexOf('tripPhase');
    
    var rowData = [
      payload.resourceType || '', 
      payload.resourceId || '',
      sheetDateTextForCell(payload.startDate),  // FIX: text dd/MM/yyyy
      parseTimeSafe_(payload.startTime),
      sheetDateTextForCell(payload.endDate || payload.startDate),  // FIX: text dd/MM/yyyy
      parseTimeSafe_(payload.endTime),
      payload.reason || '', 
      payload.createdBy || '', 
      new Date()
    ];

    if (assignedDriverColIndex > -1) {
      // Pad array if needed
      while (rowData.length < assignedDriverColIndex) {
        rowData.push('');
      }
      rowData[assignedDriverColIndex] = payload.assignedDriver || '';
    }
    if (tripPhaseColIndex > -1) {
      while (rowData.length < tripPhaseColIndex) rowData.push('');
      rowData[tripPhaseColIndex] = payload.tripPhase || '';
    }

    _sheetApiAppendRow_(sh, rowData, { label: 'createAvailabilityBlock append' });
    try { clearInitialCache_(); } catch (e) {}
    return {ok:true};
  } catch(e) { return {ok:false, error:e.message}; }
  finally { lock.releaseLock(); }
}

// ANCHOR: closeAvailabilityBlock
function closeAvailabilityBlock(payload) {
  var step = 'START';
  try {
    payload = payload || {};

    var bookingId = String(payload.bookingId || '').trim();
    var closedBy = String(payload.closedBy || 'System').trim();
    var closeNote = String(payload.closeNote || 'ปิดงานก่อนเวลา').trim();
    var noTelegram = payload.noTelegram === true;

    Logger.log('[EarlyClose] STEP1 input bookingId=' + bookingId + ' noTelegram=' + noTelegram);

    if (!bookingId) {
      throw new Error('ไม่พบ bookingId สำหรับปิดงานก่อนเวลา');
    }

    var sh = _getAvailabilitySheet();
    if (!sh) throw new Error('ไม่พบชีต Availability');

    var data = _sheetApiGetValues_(sh, 1, 1, sh.getLastRow(), sh.getLastColumn(), 'closeAvailabilityBlock read');
    if (!data || data.length < 2) throw new Error('ไม่พบข้อมูลในชีต Availability');

    var headers = data[0].map(function(h) { return String(h || '').trim(); });

    var col = {
      resourceType: headers.indexOf('resourceType'),
      resourceId: headers.indexOf('resourceId'),
      reason: headers.indexOf('reason'),
      assignedDriver: headers.indexOf('assignedDriver'),
      status: headers.indexOf('status'),
      closedBy: headers.indexOf('closedBy'),
      closedAt: headers.indexOf('closedAt'),
      closeNote: headers.indexOf('closeNote'),
      bookingId: headers.indexOf('bookingId'),
      startDate: headers.indexOf('startDate'),
      startTime: headers.indexOf('startTime'),
      endDate: headers.indexOf('endDate'),
      endTime: headers.indexOf('endTime'),
      createdBy: headers.indexOf('createdBy'),
      createdAt: headers.indexOf('createdAt'),
      tripPhase: headers.indexOf('tripPhase')
    };

    if (col.status === -1) throw new Error('Availability ไม่มีคอลัมน์ status');

    var now = new Date();
    var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
    // 🍓 BERRY FIX: ใช้ Formatter แบบปลอดภัย
    var nowThai = typeof _fmtThaiDateTimeBE_ === 'function' ? _fmtThaiDateTimeBE_(now) : Utilities.formatDate(now, tz, 'dd/MM/yyyy HH:mm น.');
    var nowISO = Utilities.formatDate(now, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
    
    function cellText_(row, idx) {
      return idx > -1 ? String(row[idx] || '').trim() : '';
    }

    function cellKey_(row, idx) {
      if (idx < 0) return '';
      var v = row[idx];
      if (v && Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
        return String(v.getTime());
      }
      return String(v == null ? '' : v).trim();
    }

    function syntheticBookingId_(rowIndex) {
      return 'BLK-' + rowIndex;
    }

    function rowBookingId_(row, rowIndex) {
      return (col.bookingId > -1 && row[col.bookingId])
        ? String(row[col.bookingId]).trim()
        : syntheticBookingId_(rowIndex);
    }

    function isRepairTripPhase_(phase) {
      return /^(repair|dropoff|pickup|pickup_support)$/.test(String(phase || '').trim().toLowerCase());
    }

    var targetRowIndex = -1;
    var targetRow = null;
    for (var t = 1; t < data.length; t++) {
      if (rowBookingId_(data[t], t) === bookingId) {
        targetRowIndex = t;
        targetRow = data[t];
        break;
      }
    }

    var closeRepairGroup = false;
    var targetCreatedAtKey = '';
    var targetCreatedByKey = '';
    if (targetRow) {
      var targetResourceType = cellText_(targetRow, col.resourceType).toLowerCase();
      var targetTripPhase = cellText_(targetRow, col.tripPhase).toLowerCase();
      closeRepairGroup = col.bookingId === -1 && targetResourceType === 'vehicle' && targetTripPhase === 'repair';
      targetCreatedAtKey = cellKey_(targetRow, col.createdAt);
      targetCreatedByKey = cellKey_(targetRow, col.createdBy);
    }

    function shouldCloseRow_(row, rowIndex) {
      if (rowBookingId_(row, rowIndex) === bookingId) return true;
      if (!closeRepairGroup) return false;
      if (!targetCreatedAtKey || cellKey_(row, col.createdAt) !== targetCreatedAtKey) return false;
      if (targetCreatedByKey && cellKey_(row, col.createdBy) !== targetCreatedByKey) return false;
      return isRepairTripPhase_(cellText_(row, col.tripPhase));
    }

    function buildClosedItem_(row) {
      return {
        bookingId: bookingId,
        resourceType: cellText_(row, col.resourceType),
        resourceId: cellText_(row, col.resourceId),
        reason: cellText_(row, col.reason),
        assignedDriver: cellText_(row, col.assignedDriver),
        startDate: col.startDate > -1 ? parseDateToISO_(row[col.startDate]) : '',
        startTime: col.startTime > -1 ? parseTimeSafe_(row[col.startTime]) : '',
        endDate: col.endDate > -1 ? (parseDateToISO_(row[col.endDate]) || parseDateToISO_(row[col.startDate])) : '',
        endTime: col.endTime > -1 ? parseTimeSafe_(row[col.endTime]) : '',
        createdBy: cellText_(row, col.createdBy),
        tripPhase: cellText_(row, col.tripPhase),
        closedAtISO: nowISO,
        closedAtText: nowThai,
        closeNote: closeNote
      };
    }

    function buildAvailabilityNotifyObject_(item) {
      item = item || {};
      var isVehicle = String(item.resourceType || '').toLowerCase() === 'vehicle';
      var note = String(item.closeNote || closeNote || '').trim();
      return {
        bookingId: bookingId,
        id: bookingId,
        status: 'approved',
        notifyEvent: 'early_close',
        name: item.createdBy || closedBy || 'Admin',
        workType: isVehicle ? 'ส่งซ่อมบำรุง' : 'งานย่อยส่งซ่อม',
        workName: item.reason || 'ส่งซ่อมบำรุง',
        project: item.reason || 'ส่งซ่อมบำรุง',
        place: isVehicle ? 'รายการรถซ่อมหลัก' : 'รายการงานย่อยของงานซ่อม',
        startDate: item.startDate || '',
        startTime: item.startTime || '',
        endDate: item.endDate || item.startDate || '',
        endTime: item.endTime || '',
        vehicle: isVehicle ? item.resourceId : '',
        plate: isVehicle ? item.resourceId : '',
        driver: item.assignedDriver || '',
        passengers: '0',
        carType: 'รถราชการ',
        vehicleCount: isVehicle && item.resourceId ? '1' : '0',
        reason: note,
        Reason: note,
        actualEndAt: nowISO,
        actualEndTime: nowThai,
        closedBy: closedBy
      };
    }

    var updated = 0;
    var closedRows =[];
    var lastClosedItem = null;
    var mainClosedItem = null;

    for (var i = 1; i < data.length; i++) {
      // 🍓 BERRY FIX: ถ้าไม่มีคอลัมน์ bookingId ให้ต่อ String BLK- เข้ากับ index (Fallback)
      var rowBookingId = rowBookingId_(data[i], i);
      var rowStatus = col.status > -1 ? String(data[i][col.status] || '').trim().toLowerCase() : '';

      if (!shouldCloseRow_(data[i], i)) continue;
      if (rowStatus === 'closed') continue;

      if (col.status > -1) data[i][col.status] = 'closed';
      if (col.closedBy > -1) data[i][col.closedBy] = closedBy;
      // ลงชีตเก็บเป็น Date ปกติได้
      if (col.closedAt > -1) data[i][col.closedAt] = now;
      if (col.closeNote > -1) data[i][col.closeNote] = closeNote;
      _sheetApiUpdateValues_(sh, i + 1, 1, [data[i]], { label: 'closeAvailabilityBlock row update' });

      updated++;

      lastClosedItem = buildClosedItem_(data[i]);
      if (i === targetRowIndex || (!mainClosedItem && String(lastClosedItem.tripPhase || '').toLowerCase() === 'repair')) {
        mainClosedItem = lastClosedItem;
      }

      closedRows.push(i + 1);
    }

    Logger.log('[EarlyClose] STEP2 matched rows=' + updated + ' rows=' + JSON.stringify(closedRows));

    if (updated === 0) {
      throw new Error('ไม่พบ Availability row ที่ยังเปิดอยู่สำหรับ bookingId: ' + bookingId);
    }

    try { clearInitialCache_(); } catch (e) {}

    var notifyResult = null;

    // ปิดงานก่อนเวลาจากงานจองต้องแจ้ง Telegram เสมอ เว้นแต่ caller ตั้ง noTelegram ชัดเจน
    if (!noTelegram) {
      try {
        var bookingObj = null;

        var notifyItem = mainClosedItem || lastClosedItem;
        var isSyntheticBlockId = /^BLK-\d+$/i.test(bookingId);

        if (!isSyntheticBlockId && typeof getBookingById === 'function') {
          var bookingRes = getBookingById(bookingId);
          if (bookingRes && bookingRes.ok && bookingRes.data) {
            bookingObj = bookingRes.data;
          }
        }

        if (!isSyntheticBlockId && !bookingObj && typeof getById === 'function') {
          var fallbackRes = getById(bookingId);
          if (fallbackRes && fallbackRes.ok && fallbackRes.data) {
            bookingObj = fallbackRes.data;
          }
        }

        if (!bookingObj && notifyItem) {
          bookingObj = buildAvailabilityNotifyObject_(notifyItem);
        }

        if (!bookingObj) {
          bookingObj = { bookingId: bookingId, status: 'approved' };
        }

        bookingObj.bookingId = bookingObj.bookingId || bookingObj.id || bookingId;
        bookingObj.id = bookingObj.id || bookingId;
        bookingObj.status = bookingObj.status || bookingObj['สถานะ'] || 'approved';
        bookingObj.actualEndAt = nowISO;
        bookingObj.actualEndTime = nowThai;
        bookingObj['เวลาปิดงานจริง'] = nowThai;
        bookingObj.reason = closeNote;
        bookingObj.Reason = closeNote;
        bookingObj.closedBy = closedBy;
        bookingObj.notifyEvent = 'early_close';

        if (typeof sendTelegramNotify === 'function') {
          notifyResult = sendTelegramNotify(bookingObj, false);
          Logger.log('[EarlyClose] Telegram Result bookingId=' + bookingId + ' => ' + JSON.stringify(notifyResult));
        } else if (typeof sendTelegramAvailabilityClosed_ === 'function') {
          notifyResult = sendTelegramAvailabilityClosed_(lastClosedItem);
        }
      } catch (tgErr) {
        Logger.log('[EarlyClose] Telegram Error: ' + (tgErr && tgErr.message ? tgErr.message : tgErr));
      }
    }

    Logger.log('[EarlyClose] STEP5 success bookingId=' + bookingId + ' closedAt=' + nowThai);

    return {
      ok: true,
      bookingId: bookingId,
      updatedCount: updated,
      closedAtISO: nowISO, // ห้ามส่ง now ตรงๆ
      closedAtText: nowThai,
      closeNote: closeNote,
      noTelegram: noTelegram,
      telegram: notifyResult,
      item: lastClosedItem
    };

  } catch (err) {
    Logger.log('[EarlyClose] FAIL step=' + step + ' message=' + err.message);
    return { ok: false, error: err.message };
  }
}

function saveMaintenanceAvailability(payload) {
  var lock = LockService.getScriptLock();
  if(!lock.tryLock(10000)) return {ok:false, error:'System busy'};
  try {
    var sh = _getAvailabilitySheet();
    var headers = _sheetApiGetValues_(sh, 1, 1, 1, sh.getLastColumn(), 'saveMaintenanceAvailability headers')[0];
    var timestamp = new Date();
    var repairMode = String(payload.repairMode || 'one_day').trim();
    var dropoffMethod = String(payload.dropoffMethod || 'internal_driver').trim();
    var pickupDeliveryType = String(payload.pickupDeliveryType || 'internal_driver').trim();

    function addMinutesToTime_(timeText, minutes) {
      var t = parseTimeSafe_(timeText || '00:00');
      var parts = String(t || '00:00').split(':');
      var total = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0) + (parseInt(minutes, 10) || 0);
      total = Math.max(0, Math.min((23 * 60) + 59, total));
      var h = Math.floor(total / 60);
      var m = total % 60;
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }

    function ensureDriverPhaseEndTime_(startTime, endTime) {
      var start = parseTimeSafe_(startTime || '00:00');
      var end = parseTimeSafe_(endTime || '');
      if (!end || end === '00:00') return addMinutesToTime_(start, 59);
      var sParts = String(start).split(':');
      var eParts = String(end).split(':');
      var sTotal = (parseInt(sParts[0], 10) || 0) * 60 + (parseInt(sParts[1], 10) || 0);
      var eTotal = (parseInt(eParts[0], 10) || 0) * 60 + (parseInt(eParts[1], 10) || 0);
      return eTotal > sTotal ? end : addMinutesToTime_(start, 59);
    }

    function buildRow_(opts) {
      var row = new Array(headers.length).fill('');
      function set_(name, value) {
        var idx = headers.indexOf(name);
        if (idx > -1) row[idx] = value;
      }
      var startTimeValue = parseTimeSafe_(opts.startTime || payload.startTime);
      var endTimeValue = parseTimeSafe_(opts.endTime || payload.endTime);
      var phase = String(opts.tripPhase || '').trim().toLowerCase();
      if (opts.resourceType === 'driver' && (phase === 'dropoff' || phase === 'pickup' || phase === 'pickup_support')) {
        endTimeValue = ensureDriverPhaseEndTime_(startTimeValue, endTimeValue);
      }
      set_('resourceType', opts.resourceType || '');
      set_('resourceId', opts.resourceId || '');
      set_('startDate', sheetDateTextForCell(opts.startDate || payload.startDate));
      set_('startTime', startTimeValue);
      set_('endDate', sheetDateTextForCell(opts.endDate || payload.endDate || payload.startDate));
      set_('endTime', endTimeValue);
      set_('reason', opts.reason || payload.reason || 'ซ่อม');
      set_('createdBy', payload.createdBy || '');
      set_('createdAt', timestamp);
      set_('assignedDriver', opts.assignedDriver || '');
      set_('tripPhase', opts.tripPhase || '');
      return row;
    }

    var rows = [];
    function normalizeDriverName_(name) {
      return String(name || '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
    }
    function buildAssignedDriverText_(dropoff, pickup) {
      var d1 = normalizeDriverName_(dropoff);
      var d2 = normalizeDriverName_(pickup);
      if (d1 && d2 && d1 !== d2) return d1 + ' / ' + d2;
      return d1 || d2 || '';
    }
    function buildRepairReason_() {
      var baseReason = String(payload.reason || 'ซ่อม').trim();
      var externalPickupBy = String(payload.externalPickupBy || '').replace(/\s+/g, ' ').trim();
      var deliveredBy = String(payload.pickupDeliveredBy || '').replace(/\s+/g, ' ').trim();
      var supportDriver = normalizeDriverName_(payload.supportDriver);
      var notes = [];
      if (repairMode === 'service_center' && dropoffMethod === 'repair_center_pickup' && externalPickupBy) {
        notes.push('ศูนย์มารับรถ: ' + externalPickupBy);
      }
      if (repairMode === 'service_center' && pickupDeliveryType === 'repair_center_delivery' && deliveredBy) {
        notes.push('ศูนย์นำรถมาส่ง: ' + deliveredBy);
      }
      if (repairMode === 'service_center' && pickupDeliveryType === 'internal_driver' && supportDriver) {
        notes.push('พนักงานไปส่งคนขับไปรับรถ: ' + supportDriver);
      }
      return notes.length ? baseReason + ' | ' + notes.join(' | ') : baseReason;
    }
    rows.push(buildRow_({
      resourceType: 'vehicle',
      resourceId: payload.vehiclePlate || payload.resourceId || '',
      assignedDriver: repairMode === 'service_center'
        ? buildAssignedDriverText_(dropoffMethod === 'internal_driver' ? payload.dropoffDriver : '', pickupDeliveryType === 'internal_driver' ? payload.pickupDriver : '')
        : (payload.assignedDriver || ''),
      reason: buildRepairReason_(),
      tripPhase: repairMode === 'service_center' ? 'repair' : ''
    }));

    if (repairMode === 'service_center') {
      var dropoffDriver = String(payload.dropoffDriver || '').trim();
      var pickupDriver = String(payload.pickupDriver || '').trim();
      var dropoffTime = parseTimeSafe_(payload.dropoffTime || payload.startTime);
      var pickupTime = parseTimeSafe_(payload.pickupTime || payload.endTime);
      var externalPickupBy = String(payload.externalPickupBy || '').replace(/\s+/g, ' ').trim();
      var pickupDeliveredBy = String(payload.pickupDeliveredBy || '').replace(/\s+/g, ' ').trim();
      var hasDriverDropoffSupport = pickupDeliveryType === 'internal_driver' && (payload.hasDriverDropoffSupport === true || String(payload.hasDriverDropoffSupport || '').toLowerCase() === 'true');
      var supportDriver = normalizeDriverName_(payload.supportDriver);
      var supportDriverTime = parseTimeSafe_(payload.supportDriverTime || payload.pickupTime || payload.endTime);
      if (!dropoffTime || !pickupTime ||
          (dropoffMethod === 'internal_driver' && !dropoffDriver) ||
          (dropoffMethod === 'repair_center_pickup' && !externalPickupBy) ||
          (pickupDeliveryType === 'internal_driver' && !pickupDriver) ||
          (pickupDeliveryType === 'repair_center_delivery' && !pickupDeliveredBy) ||
          (hasDriverDropoffSupport && (!supportDriver || !supportDriverTime))) {
        throw new Error('ข้อมูลฝากรถไว้ศูนย์ไม่ครบ');
      }
      if (dropoffMethod === 'internal_driver') {
        rows.push(buildRow_({
          resourceType: 'driver',
          resourceId: dropoffDriver,
          startDate: payload.startDate,
          startTime: dropoffTime,
          endDate: payload.startDate,
          endTime: addMinutesToTime_(dropoffTime, 59),
          assignedDriver: dropoffDriver,
          reason: (payload.reason || 'ซ่อม') + ' (นำรถไปส่ง)',
          tripPhase: 'dropoff'
        }));
      }
      if (pickupDeliveryType === 'internal_driver') {
        rows.push(buildRow_({
          resourceType: 'driver',
          resourceId: pickupDriver,
          startDate: payload.endDate || payload.startDate,
          startTime: pickupTime,
          endDate: payload.endDate || payload.startDate,
          endTime: addMinutesToTime_(pickupTime, 59),
          assignedDriver: pickupDriver,
          reason: (payload.reason || 'ซ่อม') + ' (รับรถกลับ)',
          tripPhase: 'pickup'
        }));
        if (hasDriverDropoffSupport && supportDriver && normalizeDriverName_(supportDriver) !== normalizeDriverName_(pickupDriver)) {
          rows.push(buildRow_({
            resourceType: 'driver',
            resourceId: supportDriver,
            startDate: payload.endDate || payload.startDate,
            startTime: supportDriverTime,
            endDate: payload.endDate || payload.startDate,
            endTime: addMinutesToTime_(supportDriverTime, 59),
            assignedDriver: supportDriver,
            reason: (payload.reason || 'ซ่อม') + ' (พนักงานไปส่งคนขับไปรับรถ)',
            tripPhase: 'pickup_support'
          }));
        }
      }
    } else if (payload.assignedDriver) {
      rows.push(buildRow_({
        resourceType: 'driver',
        resourceId: payload.assignedDriver,
        assignedDriver: payload.assignedDriver
      }));
    }

    _sheetApiUpdateValues_(sh, sh.getLastRow() + 1, 1, rows, { label: 'saveMaintenanceAvailability append rows' });
    try { clearInitialCache_(); } catch (eCache) {}
    return {ok:true};
  } catch(e) { return {ok:false, error:e.message}; }
  finally { lock.releaseLock(); }
}

function normalizeDriverTripPhaseEnd_(rowType, tripPhase, startAt, endAt) {
  var type = String(rowType || '').trim().toLowerCase();
  var phase = String(tripPhase || '').trim().toLowerCase();
  if (type !== 'driver') return endAt;
  if (phase !== 'dropoff' && phase !== 'pickup' && phase !== 'pickup_support') return endAt;
  if (!startAt || !endAt || isNaN(startAt.getTime()) || isNaN(endAt.getTime())) return endAt;
  return new Date(startAt.getTime() + 59 * 60 * 1000);
}

function _checkAvailabilityOverlap(resType, resId, reqStart, reqEnd) {
  var sh = _getAvailabilitySheet();
  var data = _sheetApiGetValues_(sh, 1, 1, sh.getLastRow(), sh.getLastColumn(), '_checkAvailabilityOverlap read');
  if (!data || data.length < 2) return { conflict: false };

  var headers = data[0] || [];
  var stIdx = headers.indexOf('status');
  var phaseIdx = headers.indexOf('tripPhase');

  var normType = String(resType || '').trim().toLowerCase();
  var normId = (normType === 'driver')
    ? normalizeRadarName_(resId)
    : normalizeRadarPlate_(resId);

  if (!reqStart || !reqEnd || isNaN(reqStart.getTime()) || isNaN(reqEnd.getTime())) {
    Logger.log('[Radar] _checkAvailabilityOverlap invalid request range: type=' + normType + ' id=' + normId);
    return { conflict: false };
  }

  for (var i = 1; i < data.length; i++) {
    var row = data[i] || [];
    var status = stIdx > -1 ? String(row[stIdx] || '').trim().toLowerCase() : '';
    if (status === 'closed') continue;

    var rowType = String(row[0] || '').trim().toLowerCase();
    var rowId = (rowType === 'driver')
      ? normalizeRadarName_(row[1])
      : normalizeRadarPlate_(row[1]);

    if (rowType !== normType || rowId !== normId) continue;

    var bStart = getRadarDateTime_(row[2], row[3]);
    var bEnd = getRadarDateTime_(row[4], row[5]);
    bEnd = normalizeDriverTripPhaseEnd_(rowType, phaseIdx > -1 ? row[phaseIdx] : '', bStart, bEnd);

    if (!bStart || !bEnd || isNaN(bStart.getTime()) || isNaN(bEnd.getTime())) {
      Logger.log('[Radar] _checkAvailabilityOverlap skip invalid row: row=' + (i + 1));
      continue;
    }

    if (bEnd.getTime() < bStart.getTime()) {
      Logger.log(
        '[Radar] _checkAvailabilityOverlap invalid block end<start fallback: row=' + (i + 1) +
        ' start=' + Utilities.formatDate(bStart, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss') +
        ' end=' + Utilities.formatDate(bEnd, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss')
      );
      bEnd = new Date(bStart.getTime());
    }

    if (isOverlapping_(reqStart, reqEnd, bStart, bEnd)) {
      return {
        conflict: true,
        reason: String(row[6] || '').trim()
      };
    }
  }

  return { conflict: false };
}

function checkDriverAvailability(driver, sd, st, ed, et) {
  var normDriver = normalizeRadarName_(driver);
  var rs = getRadarDateTime_(sd, st);
  var re = getRadarDateTime_(ed, et);

  if (!rs || !re || isNaN(rs.getTime()) || isNaN(re.getTime())) {
    Logger.log('[Radar] checkDriverAvailability invalid datetime: driver=' + normDriver);
    return { conflict: false };
  }

  return _checkAvailabilityOverlap('driver', normDriver, rs, re);
}

function checkVehicleAvailability(plate, sd, st, ed, et) {
  var normPlate = normalizeRadarPlate_(plate);
  var rs = getRadarDateTime_(sd, st);
  var re = getRadarDateTime_(ed, et);

  if (!rs || !re || isNaN(rs.getTime()) || isNaN(re.getTime())) {
    Logger.log('[Radar] checkVehicleAvailability invalid datetime: plate=' + normPlate);
    return { conflict: false };
  }

  return _checkAvailabilityOverlap('vehicle', normPlate, rs, re);
}

var VB_RADAR_DRIVER_MASTER = [
  'ชัชวาลย์ วงศ์มั่น',
  'ประเสริฐ หน่อแก้ว',
  'ปรีชา ถวิลเวช',
  'ปริญญา ก้อนสัมฤทธิ์',
  'อภิรัฐวุฒิ คณารักษ์'
];

var VB_RADAR_VEHICLE_MASTER = [
  'ฮล-466',
  'ฮค-4964',
  '1นช-6112',
  'ฮร-4820',
  'ห-4845'
];

function normalizeRadarName_(v) {
  var s = String(v == null ? '' : v)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (s === 'ปรีชา ถวิล เวช') s = 'ปรีชา ถวิลเวช';

  return s;
}

function normalizeRadarPlate_(v) {
  return String(v == null ? '' : v)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[–—−]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDateTimeBkk_(dateRaw, timeRaw) {
  return getRadarDateTime_(dateRaw, timeRaw);
}

function getServerNowBangkok_() {
  var tz = 'Asia/Bangkok';
  var nowStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
  // 🍓 BERRY FIX: ระบุ tz ใน parseDate ด้วย ไม่ใช่แค่ format
  return Utilities.parseDate(nowStr, tz, 'yyyy-MM-dd HH:mm:ss');
}

function isNowBetween_(now, startAt, endAt) {
  if (!now || !startAt || !endAt) return false;
  if (isNaN(now.getTime()) || isNaN(startAt.getTime()) || isNaN(endAt.getTime())) return false;
  return now.getTime() >= startAt.getTime() && now.getTime() <= endAt.getTime();
}

// ANCHOR: getRadarDateTime_
function getRadarDateTime_(dateVal, timeVal) {
  var TZ = 'Asia/Bangkok';
  var d = _radarNormalizeDateOnly_(dateVal);
  var t = _radarNormalizeTimeOnly_(timeVal);
  if (!d) return null;

  // 🍓 BERRY FIX: ใช้ formatDate+parseDate เพื่อ force Bangkok TZ แทน new Date(y,m,d,h,m)
  var dateStr = Utilities.formatDate(d, TZ, 'yyyy-MM-dd') +
    ' ' +
    ('0' + t.h).slice(-2) + ':' + ('0' + t.m).slice(-2) + ':00';

  var dt = Utilities.parseDate(dateStr, TZ, 'yyyy-MM-dd HH:mm:ss');

  try {
    Logger.log(
      '[Radar] getRadarDateTime_ parsed: dISO=%s tStr=%s -> %s',
      String(dateVal),
      String(timeVal),
      Utilities.formatDate(dt, TZ, 'yyyy-MM-dd HH:mm:ss')
    );
  } catch (_) {}

  return dt;
}

var REASON_TO_STATUS_KEY_ = {
  'ซ่อม': 'repair',
  'ส่งซ่อม': 'repair',
  'ลา': 'leave'
};

var CENTRAL_STATUS_MAP = {
  repair: { key: 'repair', label: 'ส่งซ่อม', priority: 4, cssClass: 'inactive', emoji: '🛠', color: 'red' },
  leave: { key: 'leave', label: 'ลา', priority: 3, cssClass: 'inactive', emoji: '☕', color: 'red' },
  busy: { key: 'busy', label: 'ติดภารกิจ', priority: 2, cssClass: 'busy', emoji: '⏳', color: 'yellow' },
  ready: { key: 'ready', label: 'พร้อม', priority: 1, cssClass: 'available', emoji: '✅', color: 'green' }
};

function getCentralStatusMeta_(statusKey) {
  var key = String(statusKey || 'ready').toLowerCase().trim();
  var meta = CENTRAL_STATUS_MAP[key] || CENTRAL_STATUS_MAP.ready;
  return {
    key: meta.key,
    label: meta.label,
    priority: meta.priority,
    cssClass: meta.cssClass,
    emoji: meta.emoji,
    color: meta.color
  };
}

function resolveResourceStatus_(reason, isBusy) {
  var resolved = getCentralStatusMeta_('ready');
  var reasonText = String(reason || '').trim();
  var reasonLc = reasonText.toLowerCase();
  var reasonKey = REASON_TO_STATUS_KEY_[reasonText] || '';

  if (!reasonKey) {
    if (reasonText.indexOf('ซ่อม') > -1 || reasonLc.indexOf('repair') > -1 || reasonLc.indexOf('maintenance') > -1) {
      reasonKey = 'repair';
    } else if (reasonText.indexOf('ลา') > -1 || reasonText.indexOf('พัก') > -1) {
      reasonKey = 'leave';
    }
  }

  if (reasonKey) {
    var reasonMeta = getCentralStatusMeta_(reasonKey);
    if (reasonMeta.priority > resolved.priority) resolved = reasonMeta;
  }

  if (isBusy === true) {
    var busyMeta = getCentralStatusMeta_('busy');
    if (busyMeta.priority > resolved.priority) resolved = busyMeta;
  }

  return {
    key: resolved.key,
    label: resolved.label,
    cssClass: resolved.cssClass,
    emoji: resolved.emoji
  };
}

function getAvailabilityMap_(targetTimeMs) {
  var map = {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_AVAILABILITY);
  var atMs = (typeof targetTimeMs === 'number' && isFinite(targetTimeMs)) ? targetTimeMs : new Date().getTime();

  if (!sh) return map;

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return map;

  var values = _sheetApiGetValues_(sh, 1, 1, lastRow, lastCol, 'getAvailabilityMap_ read');
  var headers = values[0] || [];
  var colStatus = headers.indexOf('status');
  var colClosedAt = headers.indexOf('closedAt');
  var colTripPhase = headers.indexOf('tripPhase');

  function isClosed_(row) {
    var closedAt = colClosedAt > -1 ? row[colClosedAt] : '';
    var blockStatus = colStatus > -1 ? String(row[colStatus] || '').trim().toLowerCase() : '';
    return !!closedAt || blockStatus === 'closed';
  }

  function normalizeEnd_(startAt, endAt, row) {
    if (!startAt || !endAt) return endAt;
    if (endAt.getTime() >= startAt.getTime()) return endAt;

    var startDateOnly = _radarNormalizeDateOnly_(row[2]);
    var endDateOnly = _radarNormalizeDateOnly_(row[4] || row[2]);
    var sameDateText = false;

    if (startDateOnly && endDateOnly) {
      sameDateText =
        startDateOnly.getFullYear() === endDateOnly.getFullYear() &&
        startDateOnly.getMonth() === endDateOnly.getMonth() &&
        startDateOnly.getDate() === endDateOnly.getDate();
    }

    return sameDateText ? new Date(endAt.getTime() + 24 * 60 * 60 * 1000) : endAt;
  }

  for (var i = 1; i < values.length; i++) {
    var row = values[i] || [];
    var resType = String(row[0] || '').trim().toLowerCase();
    var resourceId = String(row[1] || '').trim();
    var reason = String(row[6] || '').trim();

    if (!resourceId) continue;
    if (isClosed_(row)) continue;

    var startAt = getRadarDateTime_(row[2], row[3] || '00:00');
    var endAt = getRadarDateTime_(row[4] || row[2], row[5] || '23:59');
    endAt = normalizeEnd_(startAt, endAt, row);

    if (!startAt || !endAt) continue;
    if (atMs < startAt.getTime() || atMs > endAt.getTime()) continue;

    var statusKey = resolveResourceStatus_(reason, false).key;
    var mapKey = resType === 'driver' ? normalizeRadarName_(resourceId) : normalizeRadarPlate_(resourceId);
    var prev = map[mapKey];
    var nextPriority = getCentralStatusMeta_(statusKey).priority;
    var prevPriority = prev ? getCentralStatusMeta_(prev.statusKey).priority : 0;

    if (!prev || nextPriority >= prevPriority) {
      map[mapKey] = {
        reason: reason,
        statusKey: statusKey,
        tripPhase: colTripPhase > -1 ? String(row[colTripPhase] || '').trim().toLowerCase() : ''
      };
    }
  }

  return map;
}

function _radarNormalizeDateOnly_(dateVal) {
  if (dateVal === null || dateVal === undefined || dateVal === '') return null;

  if (Object.prototype.toString.call(dateVal) === '[object Date]' && !isNaN(dateVal.getTime())) {
    var y0 = dateVal.getFullYear();
    if (y0 > 2400) y0 -= 543;
    return new Date(y0, dateVal.getMonth(), dateVal.getDate(), 0, 0, 0, 0);
  }

  var s = String(dateVal).trim();
  if (!s) return null;

  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    var y1 = parseInt(m[1], 10);
    if (y1 > 2400) y1 -= 543;
    return new Date(y1, parseInt(m[2], 10) - 1, parseInt(m[3], 10), 0, 0, 0, 0);
  }

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    var d2 = parseInt(m[1], 10);
    var mo2 = parseInt(m[2], 10) - 1;
    var y2 = parseInt(m[3], 10);
    if (y2 > 2400) y2 -= 543;
    return new Date(y2, mo2, d2, 0, 0, 0, 0);
  }

  var tmp = new Date(s);
  if (!isNaN(tmp.getTime())) {
    var y3 = tmp.getFullYear();
    if (y3 > 2400) y3 -= 543;
    return new Date(y3, tmp.getMonth(), tmp.getDate(), 0, 0, 0, 0);
  }

  return null;
}

function _radarNormalizeTimeOnly_(timeVal) {
  if (timeVal === null || timeVal === undefined || timeVal === '') {
    return { h: 0, m: 0 };
  }

  // FIX: Google Sheets serial time (SERIAL_NUMBER render) arrives as decimal in [0,1).
  // e.g. 0.3333 = 08:00, 0.5416 = 13:00. Must handle BEFORE String conversion.
  // Without this, "0.3333..." matches regex as h=0,m=33 (00:33) instead of 08:00.
  if (typeof timeVal === 'number' && timeVal >= 0 && timeVal < 1) {
    var totalMins = Math.round(timeVal * 24 * 60);
    return {
      h: Math.floor(totalMins / 60) % 24,
      m: totalMins % 60
    };
  }

  if (Object.prototype.toString.call(timeVal) === '[object Date]' && !isNaN(timeVal.getTime())) {
    return {
      h: timeVal.getHours(),
      m: timeVal.getMinutes()
    };
  }

  var s = String(timeVal).trim();
  if (!s) return { h: 0, m: 0 };

  var m = s.match(/(\d{1,2})[\.:](\d{2})/);
  if (m) {
    return {
      h: Math.max(0, Math.min(23, parseInt(m[1], 10))),
      m: Math.max(0, Math.min(59, parseInt(m[2], 10)))
    };
  }

  var tmp = new Date(s);
  if (!isNaN(tmp.getTime())) {
    return {
      h: tmp.getHours(),
      m: tmp.getMinutes()
    };
  }

  return { h: 0, m: 0 };
}

// ANCHOR: buildRadarContext_
function buildRadarContext_() {
  var TZ = 'Asia/Bangkok';
  var ctx = {
    tz: TZ,
    now: getServerNowBangkok_(),
    nowText: '',
    availMap: {},
    availBlocks: [],
    approvedBookings:[],
    byDriver: {},
    byVehicle: {}
  };

  function fmt_(d) {
    if (!d || isNaN(d.getTime())) return '-';
    return Utilities.formatDate(d, TZ, 'yyyy-MM-dd HH:mm');
  }

  function splitDriverValues_(raw) {
    return String(raw || '')
      .split(/[,\n|\/]+/)
      .map(function(part) { return normalizeRadarName_(part); })
      .filter(function(part) { return part && part !== '-'; });
  }

  function splitVehicleValues_(raw) {
    return String(raw || '')
      .split(/[,\n|\/]+/)
      .map(function(part) { return normalizeRadarPlate_(part); })
      .filter(function(part) { return part && part !== '-'; });
  }

  function addDriverSlot_(driverName, item) {
    splitDriverValues_(driverName).forEach(function(name) {
      if (!ctx.byDriver[name]) ctx.byDriver[name] = [];
      ctx.byDriver[name].push(item);
    });
  }

  function addVehicleSlot_(vehicleName, item) {
    splitVehicleValues_(vehicleName).forEach(function(plate) {
      if (!ctx.byVehicle[plate]) ctx.byVehicle[plate] = [];
      ctx.byVehicle[plate].push(item);
    });
  }

  function isOvernightTimeOnlyFix_(startAt, endAt, rawStartDate, rawEndDate) {
    if (!startAt || !endAt) return false;

    var startDateOnly = _radarNormalizeDateOnly_(rawStartDate);
    var endDateOnly = _radarNormalizeDateOnly_(rawEndDate || rawStartDate);

    var sameDateText = false;
    if (startDateOnly && endDateOnly) {
      sameDateText =
        startDateOnly.getFullYear() === endDateOnly.getFullYear() &&
        startDateOnly.getMonth() === endDateOnly.getMonth() &&
        startDateOnly.getDate() === endDateOnly.getDate();
    }

    var sameDayObj =
      startAt.getFullYear() === endAt.getFullYear() &&
      startAt.getMonth() === endAt.getMonth() &&
      startAt.getDate() === endAt.getDate();

    if (!(sameDateText || sameDayObj)) return false;

    var startMin = startAt.getHours() * 60 + startAt.getMinutes();
    var endMin = endAt.getHours() * 60 + endAt.getMinutes();

    return endMin < startMin;
  }

  try {
    ctx.nowText = Utilities.formatDate(ctx.now, TZ, 'yyyy-MM-dd HH:mm:ss');
    Logger.log('[Radar] STEP1 serverNow(BKK): ' + ctx.nowText);
    ctx.availMap = getAvailabilityMap_(ctx.now.getTime());
    Logger.log('[Radar] STEP1.1 availabilityMap=%s', Object.keys(ctx.availMap).length);

    var mainData = getMainData_();
    if (!mainData || !mainData.ok || !mainData.data || !mainData.data.bookings) {
      Logger.log('[Radar] STEP0 mainData invalid');
      return ctx;
    }

    var rows = mainData.data.bookings ||[];
    var actualEndsMap = typeof getActualEndsMap === 'function' ? getActualEndsMap() : {};

    rows.forEach(function(b) {
      var status = String(b.status || '').trim().toLowerCase();

      // =========================
      // CASE A: availability block
      // =========================
      if (status === 'driver_block' || status === 'vehicle_block') {
        
        // 🍓 BERRY FIX: ข้ามงานที่ถูกปิด (Soft Close) ไปแล้ว เพื่อไม่ให้แสดงในเรดาร์ว่าติดงาน
        if (b.isClosed === true || String(b.blockStatus || '').toLowerCase() === 'closed') {
           Logger.log('[Radar] STEP5 skip closed block: id=' + String(b.bookingId || ''));
           return; 
        }

        var blockStart = getRadarDateTime_(b.startDate || b.date, b.startTime || '00:00');
        var blockEnd = getRadarDateTime_(b.endDate || b.startDate || b.date, b.endTime || '23:59');

        if (!blockStart || !blockEnd) {
          Logger.log('[Radar] STEP5 skip invalid block datetime: id=' + String(b.bookingId || ''));
          return;
        }

        if (blockEnd.getTime() < blockStart.getTime()) {
          if (isOvernightTimeOnlyFix_(blockStart, blockEnd, b.startDate || b.date, b.endDate || b.startDate || b.date)) {
            blockEnd = new Date(blockEnd.getTime() + 24 * 60 * 60 * 1000);
          } else {
            Logger.log(
              '[Radar] STEP5 invalid block endAt<startAt fallback: id=%s start=%s end=%s',
              String(b.bookingId || ''),
              fmt_(blockStart),
              fmt_(blockEnd)
            );
            blockEnd = new Date(blockStart.getTime());
          }
        }

        // 🍓 FIX: skip expired availability block — ถ้า now > blockEnd ให้ข้ามทันที
        if (ctx.now.getTime() > blockEnd.getTime()) {
          Logger.log('[Radar] skip expired block: id=' + String(b.bookingId || '') + ' endAt=' + fmt_(blockEnd));
          return;
        }

        var blockItem = {
          bookingId: String(b.bookingId || ''),
          resourceType: status === 'driver_block' ? 'driver' : 'vehicle',
          resourceId: status === 'driver_block'
            ? normalizeRadarName_(b.driver || b.name || b.resourceId)
            : normalizeRadarPlate_(b.vehicle || b.plate || b.name || b.resourceId),
          startAt: blockStart,
          endAt: blockEnd,
          reason: String(b.reason || b.note || b.project || '').trim(),
          status: status,
          isClosed: b.isClosed === true,
          tripPhase: String(b.tripPhase || '').trim().toLowerCase()
        };

        ctx.availBlocks.push(blockItem);

        Logger.log(
          '[Radar] STEP5 availBlock: type=%s id=%s start=%s end=%s reason=%s',
          blockItem.resourceType,
          blockItem.resourceId,
          fmt_(blockItem.startAt),
          fmt_(blockItem.endAt),
          blockItem.reason || '-'
        );

        if (blockItem.resourceType === 'driver') {
          addDriverSlot_(blockItem.resourceId, blockItem);
        } else {
          addVehicleSlot_(blockItem.resourceId, blockItem);
        }

        return;
      }

      // =========================
      // CASE B: approved booking
      // =========================
      if (status !== 'approved' && status !== 'driver_special_approved') return;

      var rawStartDate = b.startDate || b.date;
      var rawEndDate = b.endDate || b.startDate || b.date;
      var rawStartTime = b.startTime || '00:00';
      var rawEndTime = b.endTime || '23:59';

      var startAt = getRadarDateTime_(rawStartDate, rawStartTime);
      var endAt = getRadarDateTime_(rawEndDate, rawEndTime);

      Logger.log(
        '[Radar] STEP2 booking: id=%s status=%s driver=%s vehicle=%s',
        String(b.bookingId || ''),
        status,
        String(b.driver || '').trim(),
        String(b.vehicle || b.plate || '').trim()
      );

      if (!startAt || !endAt) {
        Logger.log(
          '[Radar] STEP3 skip invalid datetime: id=%s startAt=%s endAt=%s',
          String(b.bookingId || ''),
          String(startAt),
          String(endAt)
        );
        return;
      }
      
      // ใช้ Actual End เฉพาะกรณีงานปิดจริงเท่านั้น (กันข้อมูลค้างใน BookingActualEnd)
      if (b.isSoftClosed === true && b.bookingId && actualEndsMap[b.bookingId]) {
         var aEndObj = actualEndsMap[b.bookingId].actualEndAtObj;
         if (aEndObj && aEndObj.getTime() < endAt.getTime()) {
           Logger.log('[Radar] STEP3 Early End Overwrite: id=%s %s -> %s', String(b.bookingId || ''), fmt_(endAt), fmt_(aEndObj));
           endAt = aEndObj;
           rawEndTime = Utilities.formatDate(aEndObj, TZ, 'HH:mm');
         }
      }

      if (endAt.getTime() < startAt.getTime()) {
        if (isOvernightTimeOnlyFix_(startAt, endAt, rawStartDate, rawEndDate)) {
          endAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
        } else {
          Logger.log(
            '[Radar] STEP3 invalid endAt<startAt fallback: id=%s start=%s end=%s',
            String(b.bookingId || ''),
            fmt_(startAt),
            fmt_(endAt)
          );
          endAt = new Date(startAt.getTime());
        }
      }

      var bookingItem = {
        bookingId: String(b.bookingId || ''),
        driver: String(b.driver || '').trim(),
        driverRaw: String(b.driver || '').trim(),
        vehicle: String(b.vehicle || b.plate || '').trim(),
        vehicleRaw: String(b.vehicle || b.plate || '').trim(),
        startAt: startAt,
        endAt: endAt,
        destination: String(b.destination || b.place || '').trim(),
        workName: String(b.workName || b.project || '').trim(),
        status: status,
        raw: b
      };

      ctx.approvedBookings.push(bookingItem);

      Logger.log(
        '[Radar] STEP3 booking parsed: startAt=%s endAt=%s rawEndTime=%s rawEndTimeType=%s isDate=%s',
        fmt_(bookingItem.startAt),
        fmt_(bookingItem.endAt),
        String(rawEndTime),
        typeof rawEndTime,
        Object.prototype.toString.call(rawEndTime) === '[object Date]'
      );

      addDriverSlot_(bookingItem.driver, bookingItem);
      addVehicleSlot_(bookingItem.vehicle, bookingItem);
    });

    Logger.log(
      '[Radar] STEP2 loaded: availBlocks=%s approvedBookings=%s',
      parseInt(ctx.availBlocks.length, 10),
      parseInt(ctx.approvedBookings.length, 10)
    );
    Logger.log('[Radar] DEBUG Server Context: currentTime = ' + ctx.nowText);

    return ctx;

  } catch (err) {
    Logger.log('[Radar] EXCEPTION buildRadarContext_: ' + (err && err.stack ? err.stack : err));
    return ctx;
  }
}

function isBookingActiveNow(start, end, now) {
  if (!start || !end || !now) return false;

  var s = new Date(start);
  var e = new Date(end);
  var n = new Date(now);

  if (isNaN(s.getTime()) || isNaN(e.getTime()) || isNaN(n.getTime())) return false;

  if (e.getTime() < s.getTime()) {
    e = new Date(e.getTime() + 24 * 60 * 60 * 1000);
  }

  return n.getTime() >= s.getTime() && n.getTime() <= e.getTime();
}

function isSameDay(dateA, dateB) {
  if (!dateA || !dateB) return false;

  var a = new Date(dateA);
  var b = new Date(dateB);

  if (isNaN(a.getTime()) || isNaN(b.getTime())) return false;

  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function isBookingToday(start, end, now) {
  if (!start || !end || !now) return false;

  var s = new Date(start);
  var e = new Date(end);
  var n = new Date(now);

  if (isNaN(s.getTime()) || isNaN(e.getTime()) || isNaN(n.getTime())) return false;

  if (e.getTime() < s.getTime()) {
    e = new Date(e.getTime() + 24 * 60 * 60 * 1000);
  }

  return isSameDay(s, n) || isSameDay(e, n) || (n.getTime() >= s.getTime() && n.getTime() <= e.getTime());
}

function calculateVehicleStatus(plate, ctx) {
  var normPlate = normalizeRadarPlate_(plate);
  var availMap = (ctx && ctx.availMap) ? ctx.availMap : {};
  var avail = availMap[normPlate] || null;

// ANCHOR: isTargetActiveRightNow precise logic
function isTargetActiveRightNow(startAt, endAt) {
  if (!startAt || !endAt) return false;
  
  // 🍓 BERRY FIX: บังคับใช้ Timestamp (ms) เปรียบเทียบ เพื่อตัดปัญหา Timezone Shift ใน GAS
  var nowMs = (ctx && ctx.now) ? ctx.now.getTime() : new Date().getTime();
  var startMs = startAt.getTime();
  var endMs = endAt.getTime();
  
  // Logic: ตอนนี้ >= เริ่มต้น AND ตอนนี้ < สิ้นสุด
  var isActive = (nowMs >= startMs && nowMs < endMs);
  
  return isActive;
}

  function buildRadarStatus(statusKey, job) {
    var meta = getCentralStatusMeta_(statusKey);
    return { status: meta.key, label: meta.label, color: meta.color, job: String(job || '').trim() };
  }

  if (!normPlate) return { status: 'unknown', label: '-', color: 'gray', job: 'ไม่พบทะเบียนรถ' };

  // 1) เช็คติดภารกิจ (Busy)
  var busyBooking = (ctx && ctx.approvedBookings || []).find(function(b) {
    var plates = String(b.vehicleRaw || b.vehicle || '').split(/[,\n|\/]+/).map(normalizeRadarPlate_);
    return (plates.indexOf(normPlate) !== -1) && isTargetActiveRightNow(b.startAt, b.endAt);
  });

  var resolved = resolveResourceStatus_(avail ? avail.reason : '', !!busyBooking);
  if (resolved.key === 'busy' && busyBooking) return buildRadarStatus(resolved.key, busyBooking.destination || busyBooking.workName);
  if (avail) return buildRadarStatus(resolved.key, avail.reason || resolved.label);
  return buildRadarStatus(resolved.key, 'พร้อมใช้งาน');
}

function calculateDriverStatus(driverName, ctx) {
  var name = normalizeRadarName_(driverName);
  var availMap = (ctx && ctx.availMap) ? ctx.availMap : {};
  var avail = availMap[name] || null;

// ANCHOR: isTargetActiveRightNow precise logic
function isTargetActiveRightNow(startAt, endAt) {
  if (!startAt || !endAt) return false;
  
  // 🍓 BERRY FIX: บังคับใช้ Timestamp (ms) เปรียบเทียบ เพื่อตัดปัญหา Timezone Shift ใน GAS
  var nowMs = (ctx && ctx.now) ? ctx.now.getTime() : new Date().getTime();
  var startMs = startAt.getTime();
  var endMs = endAt.getTime();
  
  // Logic: ตอนนี้ >= เริ่มต้น AND ตอนนี้ < สิ้นสุด
  var isActive = (nowMs >= startMs && nowMs < endMs);
  
  return isActive;
}

  function buildRadarStatus(statusKey, job) {
    var meta = getCentralStatusMeta_(statusKey);
    return { status: meta.key, label: meta.label, color: meta.color, job: String(job || '').trim() };
  }

  if (!name) return { status: 'unknown', label: '-', color: 'gray', job: 'ไม่พบชื่อพนักงาน' };

  // 1) เช็คภารกิจจากงานจอง (ติดภารกิจ)
  var busyBooking = (ctx && ctx.approvedBookings || []).find(function(b) {
    var drivers = String(b.driverRaw || b.driver || '').split(/[,\n|\/]+/).map(normalizeRadarName_);
    return (drivers.indexOf(name) !== -1) && isTargetActiveRightNow(b.startAt, b.endAt);
  });
  
  var resolved = resolveResourceStatus_(avail ? avail.reason : '', !!busyBooking);
  if (resolved.key === 'busy' && busyBooking) return buildRadarStatus(resolved.key, busyBooking.destination || busyBooking.workName);
  if (avail) return buildRadarStatus(resolved.key, avail.reason || resolved.label);
  return buildRadarStatus(resolved.key, 'พร้อมปฏิบัติงาน');
}

function buildRadarData() {
  var ctx = buildRadarContext_();
  var tz = (ctx && ctx.tz) ? ctx.tz : 'Asia/Bangkok';
  var now = (ctx && ctx.now instanceof Date) ? ctx.now : getServerNowBangkok_();
  var yearBE = parseInt(Utilities.formatDate(now, tz, 'yyyy'), 10) + 543;

  var driverMaster = Array.isArray(VB_RADAR_DRIVER_MASTER) ? VB_RADAR_DRIVER_MASTER : [];
  var vehicleMaster = Array.isArray(VB_RADAR_VEHICLE_MASTER) ? VB_RADAR_VEHICLE_MASTER : [];

  var drivers = driverMaster.map(function(name) {
    var st = calculateDriverStatus(name, ctx);

    Logger.log(
      '[Radar] STEP6 driver: ' + name +
      ' → status=' + st.status +
      ' label=' + st.label +
      ' job=' + st.job
    );

    return {
      name: name,
      active: true,
      status: st.status,
      label: st.label,
      color: st.color,
      job: st.job
    };
  });

  var vehicles = vehicleMaster.map(function(plate) {
    var st = calculateVehicleStatus(plate, ctx);

    Logger.log(
      '[Radar] STEP6 vehicle: ' + plate +
      ' → status=' + st.status +
      ' label=' + st.label +
      ' job=' + st.job
    );

    return {
      plate: plate,
      active: true,
      status: st.status,
      label: st.label,
      color: st.color,
      job: st.job
    };
  });

  return {
    ok: true,
    serverNow: Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm:ss'),
    serverDateThai: Utilities.formatDate(now, tz, 'dd/MM/') + yearBE,
    drivers: drivers,
    vehicles: vehicles
  };
}

function apiGetLiveStatus() {
  try {
    var data = buildRadarData();

    Logger.log(
      '[Radar] apiGetLiveStatus OK: drivers=' +
      ((data && data.drivers) ? data.drivers.length : 0) +
      ' vehicles=' +
      ((data && data.vehicles) ? data.vehicles.length : 0) +
      ' serverNow=' +
      (data && data.serverNow ? data.serverNow : '-')
    );

    return data;
  } catch (e) {
    Logger.log('[Radar] apiGetLiveStatus ERROR: ' + (e && e.stack ? e.stack : e));
    return {
      ok: false,
      error: e && e.message ? e.message : String(e)
    };
  }
}

// ANCHOR: apiGetLiveStatusForModal
// 🍓 BERRY FIX: Modal DayOff ต้องเรียก function นี้แทนการ query แยก
// เพื่อให้ใช้ source เดียวกับ Radar (buildRadarData)
function apiGetLiveStatusForModal(resourceType, resourceId) {
  try {
    var data = buildRadarData();
    if (!data || !data.ok) return { ok: false, error: 'buildRadarData failed' };

    var normId = (resourceType === 'driver')
      ? normalizeRadarName_(resourceId)
      : normalizeRadarPlate_(resourceId);

    var result = null;

    if (resourceType === 'driver') {
      var found = (data.drivers || []).filter(function(d) {
        return normalizeRadarName_(d.name) === normId;
      });
      result = found.length > 0 ? found[0] : null;
    } else {
      var found = (data.vehicles || []).filter(function(v) {
        return normalizeRadarPlate_(v.plate) === normId;
      });
      result = found.length > 0 ? found[0] : null;
    }

    Logger.log(
      '[Modal] apiGetLiveStatusForModal: type=%s id=%s -> status=%s label=%s serverNow=%s',
      resourceType,
      normId,
      result ? result.status : 'not_found',
      result ? result.label : '-',
      data.serverNow || '-'
    );

    return {
      ok: true,
      serverNow: data.serverNow,
      resource: result
    };
  } catch (e) {
    Logger.log('[Modal] apiGetLiveStatusForModal ERROR: ' + (e && e.stack ? e.stack : e));
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}
// ===================== BERRY FIX: ACTUAL END MANAGEMENT =====================
// ANCHOR: getActualEndsMap
function getActualEndsMap() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('BookingActualEnd');
  var map = {};
  if (!sheet) return map;

  var data = _sheetApiGetValues_(sheet, 1, 1, sheet.getLastRow(), sheet.getLastColumn(), 'getActualEndsMap read');
  if (!data || data.length < 2) return map;

  var tz = 'Asia/Bangkok';

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var bookingId = String(row[0] || '').trim();
    if (!bookingId) continue;

    var rawDate = row[1];
    var rawTime = row[2];
    var rawAt = row[3];

    var actualEndDate = '';
    var actualEndTime = '';
    var actualEndAtObj = null;
    var actualEndAtISO = '';

    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      actualEndDate = Utilities.formatDate(rawDate, tz, 'yyyy-MM-dd');
    } else if (rawDate) {
      actualEndDate = String(rawDate).trim();
    }

    if (rawTime instanceof Date && !isNaN(rawTime.getTime())) {
      actualEndTime = Utilities.formatDate(rawTime, tz, 'HH:mm');
    } else if (rawTime) {
      actualEndTime = String(rawTime).trim();
    }

    if (rawAt instanceof Date && !isNaN(rawAt.getTime())) {
      actualEndAtObj = rawAt;
      actualEndAtISO = Utilities.formatDate(rawAt, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
    } else if (actualEndDate && actualEndTime) {
      var composed = new Date(actualEndDate + 'T' + actualEndTime + ':00');
      if (!isNaN(composed.getTime())) {
        actualEndAtObj = composed;
        actualEndAtISO = Utilities.formatDate(composed, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
      }
    }

    map[bookingId] = {
      actualEndDate: actualEndDate,
      actualEndTime: actualEndTime,
      actualEndAtObj: actualEndAtObj,
      actualEndAtISO: actualEndAtISO
    };
  }

  return map;
}

// ANCHOR: closeBookingActualEnd
function closeBookingActualEnd(payload) {
  var actionRole = String((payload || {})._actionRole || '').toLowerCase().trim();
  if (actionRole === 'driver') {
    return { ok: false, error: 'Role Driver ไม่มีสิทธิ์ปิดงานก่อนเวลา' };
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: "ระบบยุ่ง กรุณาลองใหม่ค่ะ" };

  try {
    payload = payload || {};

    var bId = String(payload.bookingId || "").trim();
    var closedBy = String(payload.closedBy || 'Unknown').trim();
    var noteText = String(payload.note || '').trim();

    if (!bId) throw new Error("ไม่ระบุรหัสอ้างอิง Booking ID");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('BookingActualEnd');
    if (!sh) {
      sh = ss.insertSheet('BookingActualEnd');
      _sheetApiUpdateValues_(sh, 1, 1, [['bookingId', 'actualEndDate', 'actualEndTime', 'actualEndAt', 'closedBy', 'closedAt', 'note']], { label: 'closeBookingActualEnd init headers', valueInputOption: 'RAW' });
    }

    var data = _sheetApiGetValues_(sh, 1, 1, sh.getLastRow(), sh.getLastColumn(), 'closeBookingActualEnd read');
    var foundIdx = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === bId) {
        foundIdx = i + 1;
        break;
      }
    }

    var now = new Date();
    var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
    var aDateISO = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
    var aTimeStr = Utilities.formatDate(now, tz, 'HH:mm');
    var aFullAt = new Date(now.getTime());
    // 🍓 BERRY FIX: สร้าง ISO String สำหรับส่งกลับ Client โดยเฉพาะ
    var aFullAtISO = Utilities.formatDate(now, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");

    var finalNote = noteText || 'ปิดงานก่อนเวลา เนื่องจากภารกิจเสร็จเร็วกว่ากำหนด';

    if (foundIdx > 0) {
      _sheetApiUpdateValues_(sh, foundIdx, 2, [[
        aDateISO,
        aTimeStr,
        aFullAt, // ลงชีตเป็น Date Obj ปกติ
        closedBy,
        new Date(),
        finalNote
      ]], { label: 'closeBookingActualEnd update row' });
    } else {
      _sheetApiAppendRow_(sh, [
        bId,
        aDateISO,
        aTimeStr,
        aFullAt,
        closedBy,
        new Date(),
        finalNote
      ], { label: 'closeBookingActualEnd append row' });
    }

    try { clearInitialCache_(); } catch (e) {}

    var notifyResult = null;
    try {
      var bookingObj = null;

      if (typeof getBookingById === 'function') {
        var bookingRes = getBookingById(bId);
        if (bookingRes && bookingRes.ok && bookingRes.data) {
          bookingObj = bookingRes.data;
        }
      }

      if (!bookingObj && typeof getById === 'function') {
        var fallbackRes = getById(bId);
        if (fallbackRes && fallbackRes.ok && fallbackRes.data) {
          bookingObj = fallbackRes.data;
        }
      }

      if (!bookingObj) {
        bookingObj = { bookingId: bId, status: 'approved' };
      }

      bookingObj.bookingId = bookingObj.bookingId || bookingObj.id || bId;
      bookingObj.id = bookingObj.id || bId;
      bookingObj.status = bookingObj.status || bookingObj['สถานะ'] || 'approved';
      bookingObj.actualEndAt = aFullAtISO; // ส่งเข้า Telegram เป็น ISO/String
      bookingObj.actualEndTime = aTimeStr;
      bookingObj['เวลาปิดงานจริง'] = aTimeStr;
      bookingObj.reason = finalNote;
      bookingObj.Reason = finalNote;
      bookingObj.closedBy = closedBy;

      if (!payload.noTelegram) {
          if (typeof sendTelegramNotify === 'function') {
            notifyResult = sendTelegramNotify(bookingObj, false);
            Logger.log('closeBookingActualEnd Telegram Result: ' + JSON.stringify(notifyResult));
          }
      }
    } catch (notifyErr) {
      Logger.log('closeBookingActualEnd Telegram Error: ' + notifyErr.message);
    }

    return {
      ok: true,
      actualEndAtISO: aFullAtISO, // 🍓 ห้ามคืนค่า aFullAt ที่เป็น Date Obj เด็ดขาด
      actualEndDate: aDateISO,
      actualEndTime: aTimeStr,
      telegramOk: !!(notifyResult && notifyResult.ok),
      message: "ปิดงานก่อนเวลาของรถและพนักงานขับเรียบร้อยแล้วค่ะ! 🚗💨"
    };

  } catch (err) {
    Logger.log("closeBookingActualEnd Error: " + err.stack);
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ANCHOR: Thai Date/Time Formatter Utilities (Unified)
// ============================================================================
// Helper: ตัวแปลงวันที่อัจฉริยะ (ดึงเวลามาด้วย ไม่ให้หาย)
function _parseAnyDateString_(s) {
  if (!s || s === '-') return null;
  var baseDate = (typeof normalizeDateInputToDate_ === 'function') ? normalizeDateInputToDate_(s) : null;
  if (!baseDate || isNaN(baseDate.getTime())) return null;

  var text = String(s).trim();
  var tm = text.match(/(\d{1,2}):(\d{2})/);
  if (tm) {
    baseDate.setHours(Number(tm[1]), Number(tm[2]), 0, 0);
  } else {
    baseDate.setHours(0, 0, 0, 0);
  }
  return baseDate;
}

// 1. Core Date Formatter
function _fmtThaiDateBE_(value) {
  var tz = (typeof TZ !== 'undefined' && TZ) ? TZ : (Session.getScriptTimeZone() || 'Asia/Bangkok');
  var d = (value instanceof Date) ? value : _parseAnyDateString_(value);

  if (!d || isNaN(d.getTime())) return '-';

  var adYear = parseInt(Utilities.formatDate(d, tz, 'yyyy'), 10);
  var beYear = (adYear < 2400) ? (adYear + 543) : adYear;
  return Utilities.formatDate(d, tz, 'dd/MM/') + beYear;
}

// 2. Core DateTime Formatter
function _fmtThaiDateTimeBE_(value) {
  var tz = (typeof TZ !== 'undefined' && TZ) ? TZ : (Session.getScriptTimeZone() || 'Asia/Bangkok');
  var d = (value instanceof Date) ? value : _parseAnyDateString_(value);

  if (!d || isNaN(d.getTime())) return '-';

  // 🍓 BERRY FIX: ใช้ดึงวันที่และเวลาแยกกัน แล้วเอามาประกอบใหม่ (เวลาจะไม่กลายเป็น 00:00 แล้ว)
  var dateText = _fmtThaiDateBE_(d);
  var timeText = Utilities.formatDate(d, tz, 'HH:mm');
  return dateText + ' ' + timeText + ' น.';
}

// 3. Safe Wrappers (หุ้มด้วย Try-Catch กันระบบพัง)
function fmtThaiDateSafe_(v) {
  try { return _fmtThaiDateBE_(v); } catch (e) { return '-'; }
}

function fmtThaiDateTimeSafe_(v) {
  try { return _fmtThaiDateTimeBE_(v); } catch (e) { return ''; }
}

// 4. Aliases (ชื่อเดิมที่ระบบเคยเรียกใช้ จะถูกส่งต่อมายัง Core Function ตัวใหม่)
function fmtThaiDateBE_(d) { return _fmtThaiDateBE_(d); }
function _fmtThaiDateBE(value) { return _fmtThaiDateBE_(value); } 
// ============================================================================
// ANCHOR: runFullTelegramLogTest
function runFullTelegramLogTest() {
  Logger.log('🚀 === เริ่มต้นการทดสอบระบบ V-Berry Diagnostics (Log Only) ===\n');

  var mockPayload = {
    'Booking ID': 'TEST-1391',
    'ชื่อ-สกุล': 'คุณปรีชา ทดสอบระบบ',
    'ตำแหน่ง': 'อาจารย์',
    'เบอร์โทร': '0812345678',
    'ประเภทงาน': 'ประชุม',
    'งาน/โครงการ': 'วางแผนยุทธศาสตร์ AI 2026',
    'สถานที่': 'มหาวิทยาลัยสวนดุสิต (กรุงเทพฯ)',
    'ประเภทรถ': 'รถตู้',
    'จำนวนรถที่ต้องการ': '2',
    'จำนวนผู้ร่วมเดินทาง': '12',
    'วันเริ่มต้น': '2026-03-12',
    'เวลาเริ่มต้น': '08:30',
    'วันสิ้นสุด': '2026-03-12',
    'เวลาสิ้นสุด': '16:30',
    'เลขทะเบียนรถ': '',
    'พนักงานขับรถ': '',
    'Reason': '',
    'CancelReason': '',
    'actualEndAt': ''
  };

  function logDivider() {
    Logger.log('----------------------------------------');
  }

  function runIndividualCase(caseTitle, status, extraData) {
    Logger.log('💬 [' + caseTitle + ']');

    var payload = Object.assign({}, mockPayload, extraData || {});
    payload.status = status;

    var msg = buildBookingStatusMessage(payload, status, payload.Reason || payload.reason || payload.CancelReason || payload.cancelReason || '');
    Logger.log('\n' + msg + '\n');

    if (typeof sendTelegramNotify === 'function') {
      try {
        var res = sendTelegramNotify(payload, true);
        if (res && res.ok && res.log) {
          Logger.log('[Telegram Preview OK]');
          Logger.log(res.log);
        } else {
          Logger.log('[Telegram Preview Skip/Fail]');
          if (res) Logger.log(JSON.stringify(res));
        }
      } catch (e) {
        Logger.log('[Telegram Preview Error] ' + e.message);
      }
    }

    logDivider();
  }

  function mockSpreadsheetWithRows(rows) {
    return function() {
      return {
        getSheetByName: function(name) {
          if (name !== 'Data') return null;
          return {
            getDataRange: function() {
              return {
                getValues: function() {
                  return rows;
                }
              };
            }
          };
        }
      };
    };
  }

  function runDailyCase(caseTitle, rows, targetDate) {
    Logger.log('📋 [' + caseTitle + ']');

    var originalGetActive = SpreadsheetApp.getActiveSpreadsheet;
    try {
      SpreadsheetApp.getActiveSpreadsheet = mockSpreadsheetWithRows(rows);
      var msg = getIntegratedDailyReport(targetDate || new Date(2026, 2, 12));
      Logger.log(msg);
    } catch (e) {
      Logger.log('❌ Daily case failed: ' + caseTitle + ' | ' + e.message);
      Logger.log(e.stack || '');
    } finally {
      SpreadsheetApp.getActiveSpreadsheet = originalGetActive;
    }

    Logger.log('\n----------------------------------------');
  }

  try {
    runIndividualCase('1. จองใหม่ (Pending) - งานข้ามวัน', 'pending', {
      'Booking ID': '1383',
      'ชื่อ-สกุล': 'ผศ.ดร.นพพร แพทย์รัตน์',
      'ตำแหน่ง': 'อาจารย์',
      'เบอร์โทร': '0992361553',
      'ประเภทงาน': '',
      'งาน/โครงการ': 'อบรม',
      'สถานที่': 'มหาวิทยาลัยสวนดุสิต กรุงเทพมหานคร',
      'วันเริ่มต้น': '2026-03-08',
      'เวลาเริ่มต้น': '09:00',
      'วันสิ้นสุด': '2026-03-10',
      'เวลาสิ้นสุด': '17:00',
      'จำนวนผู้ร่วมเดินทาง': '3',
      'จำนวนรถที่ต้องการ': '1',
      'เลขทะเบียนรถ': '',
      'พนักงานขับรถ': ''
    });

    runIndividualCase('2. อนุมัติกรณีพิเศษ - ได้ครบ 2 คัน', 'driver_special_approved', {
      'เลขทะเบียนรถ': 'นข-9999|ฮค-8888',
      'พนักงานขับรถ': 'นายสมชาย|นายวิทยา'
    });

    runIndividualCase('3. อนุมัติปกติ - ได้ครบ 2 คัน', 'approved', {
      'เลขทะเบียนรถ': 'ฮค-1234|กท-4567',
      'พนักงานขับรถ': 'พี่ยอด|พี่เอก'
    });

    runIndividualCase('4. อนุมัติปกติ - ขอ 3 ได้ 2', 'approved', {
      'Booking ID': 'TEST-2001',
      'ชื่อ-สกุล': 'ดร.ทดสอบ ขอสามได้สอง',
      'ตำแหน่ง': 'อาจารย์',
      'เบอร์โทร': '0890000001',
      'ประเภทงาน': 'สัมมนา',
      'งาน/โครงการ': 'โครงการทดสอบหลายคัน',
      'สถานที่': 'ศูนย์การประชุมฯ',
      'จำนวนรถที่ต้องการ': '3',
      'จำนวนผู้ร่วมเดินทาง': '18',
      'เลขทะเบียนรถ': 'ฮค-2222|กท-3333',
      'พนักงานขับรถ': 'พี่ต้น|พี่หนึ่ง'
    });

    runIndividualCase('5. เปลี่ยนรถ/คนขับ', 'approved', {
      'เลขทะเบียนรถ': 'กท-5555|นข-7777',
      'พนักงานขับรถ': 'นายเอกชัย|นายธนา',
      'Reason': 'อัปเดตการมอบหมายรถ/คนขับใหม่'
    });

    runIndividualCase('6. ปิดงานก่อนเวลา', 'approved', {
      'Booking ID': 'TEST-EARLY-01',
      'ชื่อ-สกุล': 'เจ้าหน้าที่ทดสอบปิดงานก่อนเวลา',
      'ตำแหน่ง': 'เจ้าหน้าที่',
      'เลขทะเบียนรถ': 'ฮค-4964',
      'พนักงานขับรถ': 'ประเสริฐ หน่อแก้ว',
      'Reason': 'ปิดงานก่อนเวลา เนื่องจากภารกิจเสร็จเร็วกว่ากำหนด',
      'actualEndAt': '2026-03-12T14:10:00+07:00'
    });

    runIndividualCase('7. ไม่อนุมัติ', 'rejected', {
      'Reason': 'รถติดภารกิจ'
    });

    runIndividualCase('8. ยกเลิกการจอง', 'cancelled', {
      'CancelReason': 'ยกเลิกโครงการ'
    });

    var mockHeaders = [
      'Booking ID',
      'สถานะ',
      'ชื่อ-สกุล',
      'ประเภทงาน',
      'งาน/โครงการ',
      'สถานที่',
      'เลขทะเบียนรถ',
      'พนักงานขับรถ',
      'วันเริ่มต้น',
      'เวลาเริ่มต้น',
      'วันสิ้นสุด',
      'เวลาสิ้นสุด',
      'จำนวนรถที่ต้องการ',
      'actualEndAt'
    ];

    runDailyCase(
      '9. รายงานสรุปประจำวัน (มีงาน 1 คัน)',
      [
        mockHeaders,
        ['BK-001', 'approved', 'สมชาย จองจริง', 'ประชุม', 'งานแผน', 'ศูนย์ฯ ลำปาง', 'ฮค-4964', 'ประเสริฐ', '2026-03-12', '09:00', '2026-03-12', '12:00', '1', ''],
        ['BK-002', 'pending', 'สมหญิง พึ่งพา', 'อบรม', 'โครงการ A', 'กทม.', '', '', '2026-03-12', '07:00', '2026-03-14', '17:00', '1', '']
      ],
      new Date(2026, 2, 12)
    );

    runDailyCase(
      '10. รายงานสรุปประจำวัน (หลายคันใน 1 งาน)',
      [
        mockHeaders,
        ['BK-010', 'approved', 'สมชาย จองจริง', 'ประชุม', 'งานแผน', 'ศูนย์ฯ ลำปาง', 'ฮค-1234|กท-4567', 'พี่ยอด|พี่เอก', '2026-03-12', '09:00', '2026-03-12', '12:00', '2', ''],
        ['BK-011', 'driver_special_approved', 'ผอ.ศูนย์', 'รับรอง', 'ต้อนรับแขก', 'สนามบิน', 'นข-1111|ฮค-7777', 'พี่ยอด|นายสมชาย', '2026-03-12', '14:00', '2026-03-12', '16:00', '2', ''],
        ['BK-012', 'pending', 'สมหญิง พึ่งพา', 'อบรม', 'โครงการ A', 'กทม.', '', '', '2026-03-12', '07:00', '2026-03-14', '17:00', '1', '']
      ],
      new Date(2026, 2, 12)
    );

    runDailyCase(
      '11. รายงานสรุปประจำวัน (ขอ 3 ได้ 2)',
      [
        mockHeaders,
        ['BK-020', 'approved', 'ดร.ทดสอบ ขอสามได้สอง', 'สัมมนา', 'โครงการทดสอบหลายคัน', 'ศูนย์การประชุมฯ', 'ฮค-2222|กท-3333', 'พี่ต้น|พี่หนึ่ง', '2026-03-12', '08:30', '2026-03-12', '16:30', '3', '']
      ],
      new Date(2026, 2, 12)
    );

    runDailyCase(
      '12. รายงานสรุปประจำวัน (งานข้ามวัน)',
      [
        mockHeaders,
        ['BK-030', 'approved', 'ผศ.ดร.นพพร แพทย์รัตน์', 'อบรม', 'อบรมเชิงปฏิบัติการ', 'มหาวิทยาลัยสวนดุสิต กรุงเทพมหานคร', 'นข-5000', 'นายสมชาย', '2026-03-08', '09:00', '2026-03-10', '17:00', '1', ''],
        ['BK-031', 'driver_special_approved', 'ผอ.ศูนย์', 'รับรอง', 'ต้อนรับคณะดูงาน', 'สนามบินดอนเมือง', 'ฮค-9000|กท-1111', 'พี่ยอด|พี่เอก', '2026-03-10', '06:00', '2026-03-12', '20:00', '2', '']
      ],
      new Date(2026, 2, 10)
    );

    runDailyCase(
      '13. รายงานสรุปประจำวัน (มีงานปิดก่อนเวลา)',
      [
        mockHeaders,
        ['BK-040', 'approved', 'เจ้าหน้าที่ทดสอบปิดงาน', 'ติดตั้ง', 'งานระบบ', 'อาคาร A', 'ฮค-4964', 'ประเสริฐ', '2026-03-12', '09:00', '2026-03-12', '17:00', '1', '2026-03-12T14:10:00+07:00']
      ],
      new Date(2026, 2, 12)
    );

    runDailyCase(
      '14. รายงานสรุปประจำวัน (ไม่มีงาน)',
      [mockHeaders],
      new Date(2026, 2, 12)
    );

  } catch (e) {
    Logger.log('❌ runFullTelegramLogTest() FAILED: ' + e.message);
    Logger.log(e.stack || '');
  }

  Logger.log('\n🏁 === สิ้นสุดการทดสอบระบบ V-Berry Diagnostics ===');
}


// ANCHOR: selfTestEarlyClose_All
function selfTestEarlyClose_All() {
  var logs = [];
  var passed = 0;
  var total = 0;

  function log(msg) {
    msg = String(msg || '');
    logs.push(msg);
    Logger.log(msg);
  }

  function pass(msg) {
    total++;
    passed++;
    log('✅ ' + msg);
  }

  function fail(msg) {
    total++;
    log('❌ ' + msg);
  }

  function info(msg) {
    log('ℹ️ ' + msg);
  }

  function warn(msg) {
    log('⚠️ ' + msg);
  }

  function clean(v) {
    return String(v == null ? '' : v).trim();
  }

  function parseDateTimeLocal_(dateValue, timeValue) {
    var d = clean(dateValue);
    var t = clean(timeValue) || '00:00';
    if (!d) return null;

    var direct = new Date(d);
    if (d.indexOf('T') > -1 && !isNaN(direct.getTime())) return direct;

    var parts = d.split(/[-\/]/);
    if (parts.length !== 3) return null;

    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var day = parseInt(parts[2], 10);

    if (String(parts[0]).length !== 4) {
      day = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
      y = parseInt(parts[2], 10);
      if (y > 2400) y -= 543;
    }

    var timeParts = t.split(':');
    var hh = parseInt(timeParts[0] || '0', 10);
    var mm = parseInt(timeParts[1] || '0', 10);
    var ss = parseInt(timeParts[2] || '0', 10);

    var dt = new Date(y, m - 1, day, hh, mm, ss);
    return isNaN(dt.getTime()) ? null : dt;
  }

  function getBookingStart_(b) {
    return parseDateTimeLocal_(
      clean(b && (b.startDate || b.dateStart || b.fromDate)),
      clean(b && (b.startTime || b.timeStart || b.fromTime))
    );
  }

  function getBookingEnd_(b) {
    var actualEndAt = clean(b && (b.actualEndAt || b.closedAt || b.completedAt));
    if (actualEndAt) {
      var a = new Date(actualEndAt);
      if (!isNaN(a.getTime())) return a;
    }

    return parseDateTimeLocal_(
      clean(b && (b.endDate || b.returnDate || b.toDate || b.plannedEndDate || b.startDate)),
      clean(b && (b.endTime || b.returnTime || b.toTime || b.plannedEndTime))
    );
  }

  function isBookingActiveNow_(b, now) {
    var start = getBookingStart_(b);
    var end = getBookingEnd_(b);
    if (!start || !end) return false;
    return now >= start && now <= end;
  }

  function getOpenAvailabilityBookingMap_() {
    var map = {};
    var rows = [];
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Availability');
    if (!sh || sh.getLastRow() < 2) {
      return { map: map, rows: rows };
    }

    var values = _sheetApiGetValues_(sh, 1, 1, sh.getLastRow(), sh.getLastColumn(), 'getOpenAvailabilityBookingMap_ read');
    var headers = values[0].map(function(h) { return clean(h); });

    function colIndex_(candidates) {
      for (var i = 0; i < candidates.length; i++) {
        var idx = headers.indexOf(candidates[i]);
        if (idx > -1) return idx;
      }
      return -1;
    }

    var bookingIdCol = colIndex_(['bookingId', 'Booking ID', 'รหัสการจอง', 'เลขที่การจอง']);
    var statusCol = colIndex_(['status', 'สถานะ']);
    var actualEndCol = colIndex_(['actualEndAt', 'closedAt', 'completedAt', 'เวลาคืนจริง']);
    var resourceTypeCol = colIndex_(['resourceType', 'ประเภททรัพยากร']);
    var resourceIdCol = colIndex_(['resourceId', 'รหัสทรัพยากร']);
    var reasonCol = colIndex_(['reason', 'Reason', 'หมายเหตุ']);

    if (bookingIdCol < 0) {
      return { map: map, rows: rows };
    }

    for (var r = 1; r < values.length; r++) {
      var row = values[r] || [];
      var bookingId = clean(row[bookingIdCol]);
      if (!bookingId) continue;

      var rowStatus = statusCol > -1 ? clean(row[statusCol]).toLowerCase() : '';
      var actualEndAt = actualEndCol > -1 ? clean(row[actualEndCol]) : '';
      var isClosed = !!actualEndAt || /(closed|completed|done|finish|ปิด|เสร็จ|จบ)/.test(rowStatus);

      if (!isClosed) {
        map[bookingId] = true;
        rows.push({
          bookingId: bookingId,
          resourceType: resourceTypeCol > -1 ? clean(row[resourceTypeCol]) : '',
          resourceId: resourceIdCol > -1 ? clean(row[resourceIdCol]) : '',
          reason: reasonCol > -1 ? clean(row[reasonCol]) : '',
          rowNumber: r + 1
        });
      }
    }

    return { map: map, rows: rows };
  }

  function findBookingById_(bookings, bookingId) {
    var id = clean(bookingId);
    var list = Array.isArray(bookings) ? bookings : [];
    for (var i = 0; i < list.length; i++) {
      var b = list[i] || {};
      if (clean(b.bookingId || b.id) === id) return b;
    }
    return null;
  }

  function findVehicleByPlate_(vehicles, plate) {
    var key = clean(plate);
    var list = Array.isArray(vehicles) ? vehicles : [];
    for (var i = 0; i < list.length; i++) {
      var v = list[i] || {};
      if (clean(v.plate) === key) return v;
    }
    return null;
  }

  function findDriverByName_(drivers, name) {
    var key = clean(name);
    var list = Array.isArray(drivers) ? drivers : [];
    var i, d, nm;

    for (i = 0; i < list.length; i++) {
      d = list[i] || {};
      nm = clean(d.name);
      if (nm === key) return d;
    }

    for (i = 0; i < list.length; i++) {
      d = list[i] || {};
      nm = clean(d.name);
      if (nm && key && (nm.indexOf(key) > -1 || key.indexOf(nm) > -1)) return d;
    }

    return null;
  }

  function hasSoftCloseIndicator_(booking) {
    if (!booking) return false;
    if (clean(booking.actualEndAt)) return true;
    if (clean(booking.closedAt)) return true;
    if (clean(booking.completedAt)) return true;
    if (clean(booking.closeNote)) return true;

    var s = clean(booking.status).toLowerCase();
    return /(closed|completed|done|finish|ปิด|เสร็จ|จบ)/.test(s);
  }

  function pickBookingForRealClose_(bookings, openMap) {
    var now = new Date();
    var list = Array.isArray(bookings) ? bookings : [];

    for (var i = 0; i < list.length; i++) {
      var b = list[i] || {};
      var bookingId = clean(b.bookingId || b.id);
      var status = clean(b.status).toLowerCase();
      var plate = clean(b.plate || b.vehicle || b.assignedVehicle);
      var driver = clean(b.driver || b.assignedDriver);

      if (!bookingId) continue;
      if (!openMap[bookingId]) continue;
      if (status !== 'approved' && status !== 'driver_special_approved') continue;
      if (!plate || !driver) continue;
      if (hasSoftCloseIndicator_(b)) continue;
      if (!isBookingActiveNow_(b, now)) continue;

      return {
        mode: 'real',
        bookingId: bookingId,
        vehiclePlate: plate,
        driverName: driver
      };
    }

    return null;
  }

  function pickBookingForMock_(bookings) {
    var now = new Date();
    var list = Array.isArray(bookings) ? bookings : [];

    for (var i = 0; i < list.length; i++) {
      var b = list[i] || {};
      var bookingId = clean(b.bookingId || b.id);
      var status = clean(b.status).toLowerCase();
      var plate = clean(b.plate || b.vehicle || b.assignedVehicle);
      var driver = clean(b.driver || b.assignedDriver);

      if (!bookingId) continue;
      if (status !== 'approved' && status !== 'driver_special_approved') continue;
      if (!plate || !driver) continue;
      if (!isBookingActiveNow_(b, now)) continue;

      return {
        mode: 'mock',
        bookingId: bookingId,
        vehiclePlate: plate,
        driverName: driver
      };
    }

    return null;
  }

  try {
    info('STEP1 โหลดข้อมูลล่าสุดจาก getWebAppInitialData');
    var beforeMain = getWebAppInitialData();
    if (!beforeMain || !beforeMain.ok || !beforeMain.data) {
      throw new Error((beforeMain && beforeMain.error) || 'getWebAppInitialData failed');
    }
    pass('โหลดข้อมูลหลักสำเร็จ');

    var openAvail = getOpenAvailabilityBookingMap_();
    info('STEP2 open availability candidates=' + openAvail.rows.length);

    var target = pickBookingForRealClose_(beforeMain.data.bookings || [], openAvail.map);
    if (target) {
      pass('พบ booking ที่ปิดงานก่อนเวลาได้จริง');
      info('STEP3 target(real): bookingId=' + target.bookingId + ' | รถ=' + target.vehiclePlate + ' | คนขับ=' + target.driverName);

      var closeRes = closeAvailabilityBlock({
        bookingId: target.bookingId,
        closedBy: 'SelfTest',
        closeNote: 'SELFTEST EARLY CLOSE',
        noTelegram: true
      });

      if (!closeRes || !closeRes.ok) {
        throw new Error((closeRes && closeRes.error) || 'closeAvailabilityBlock failed');
      }
      pass('closeAvailabilityBlock สำเร็จ');

      var afterMain = getWebAppInitialData();
      if (!afterMain || !afterMain.ok || !afterMain.data) {
        throw new Error((afterMain && afterMain.error) || 'after getWebAppInitialData failed');
      }
      pass('โหลดข้อมูลหลัง Early Close สำเร็จ');

      var afterBooking = findBookingById_(afterMain.data.bookings || [], target.bookingId);
      if (afterBooking && hasSoftCloseIndicator_(afterBooking)) {
        pass('booking ถูก soft close จริง');
      } else {
        fail('booking ยังไม่สะท้อน soft close หลัง refresh');
      }

      var adminRes = apiGetAdminPanelData();
      if (!adminRes || !adminRes.ok) {
        throw new Error((adminRes && adminRes.error) || 'apiGetAdminPanelData failed');
      }
      pass('โหลด Admin Panel Data สำเร็จ');

      var vehicleState = findVehicleByPlate_(adminRes.vehicles || [], target.vehiclePlate);
      var driverState = findDriverByName_(adminRes.drivers || [], target.driverName);

      if (vehicleState) pass('อ่านสถานะรถหลัง Early Close ได้');
      else fail('ไม่พบสถานะรถ ' + target.vehiclePlate);

      if (driverState) pass('อ่านสถานะคนขับหลัง Early Close ได้');
      else fail('ไม่พบสถานะคนขับ ' + target.driverName);

      return {
        ok: passed === total,
        status: (passed === total) ? 'PASS' : 'FAIL',
        passed: passed,
        total: total,
        logs: logs,
        meta: {
          mode: 'real',
          bookingId: target.bookingId,
          vehiclePlate: target.vehiclePlate,
          driverName: target.driverName
        },
        data: {
          closeRes: closeRes,
          afterBooking: afterBooking || null,
          vehicleState: vehicleState || null,
          driverState: driverState || null
        }
      };
    }

    var mockTarget = pickBookingForMock_(beforeMain.data.bookings || []);
    if (!mockTarget) {
      fail('ไม่พบ booking สำหรับ real test และไม่พบ mock target สำหรับตรวจเช็ค');
      return {
        ok: false,
        status: 'NO_TARGET',
        passed: passed,
        total: total,
        logs: logs,
        meta: {}
      };
    }

    warn('ไม่พบ Availability row เปิดอยู่จริง → fallback เป็น mock verify');
    info('STEP3 target(mock): bookingId=' + mockTarget.bookingId + ' | รถ=' + mockTarget.vehiclePlate + ' | คนขับ=' + mockTarget.driverName);

    var mockBooking = findBookingById_(beforeMain.data.bookings || [], mockTarget.bookingId);
    if (mockBooking) {
      pass('พบ booking mock สำหรับตรวจ flow');
    } else {
      fail('ไม่พบ booking mock ใน main data');
    }

    var mockAdminRes = apiGetAdminPanelData();
    if (!mockAdminRes || !mockAdminRes.ok) {
      throw new Error((mockAdminRes && mockAdminRes.error) || 'apiGetAdminPanelData failed');
    }
    pass('โหลด Admin Panel Data สำหรับ mock verify สำเร็จ');

    var mockVehicleState = findVehicleByPlate_(mockAdminRes.vehicles || [], mockTarget.vehiclePlate);
    var mockDriverState = findDriverByName_(mockAdminRes.drivers || [], mockTarget.driverName);

    if (mockVehicleState) pass('พบสถานะรถสำหรับ mock verify');
    else fail('ไม่พบสถานะรถสำหรับ mock verify');

    if (mockDriverState) {
      pass('พบสถานะคนขับสำหรับ mock verify');
    } else {
      warn('ไม่พบสถานะคนขับสำหรับ mock verify');
    }

    info('mockVehicleState=' + JSON.stringify({
      plate: mockVehicleState && mockVehicleState.plate || '',
      active: mockVehicleState && mockVehicleState.active,
      available: mockVehicleState && mockVehicleState.available,
      badge: mockVehicleState && mockVehicleState.badge || ''
    }));

    info('mockDriverState=' + JSON.stringify({
      name: mockDriverState && mockDriverState.name || '',
      active: mockDriverState && mockDriverState.active,
      isBusy: mockDriverState && mockDriverState.isBusy,
      badge: mockDriverState && (mockDriverState.badge || mockDriverState.busyBadge) || ''
    }));

    return {
      ok: passed === total,
      status: (passed === total) ? 'MOCK_PASS' : 'MOCK_FAIL',
      passed: passed,
      total: total,
      logs: logs,
      meta: {
        mode: 'mock',
        bookingId: mockTarget.bookingId,
        vehiclePlate: mockTarget.vehiclePlate,
        driverName: mockTarget.driverName
      },
      data: {
        afterBooking: mockBooking || null,
        vehicleState: mockVehicleState || null,
        driverState: mockDriverState || null
      }
    };

  } catch (e) {
    fail('selfTestEarlyClose_All ERROR: ' + e.message);
    if (e && e.stack) log('📨 stack: ' + e.stack);

    return {
      ok: false,
      status: 'ERROR',
      passed: passed,
      total: total,
      logs: logs,
      error: e.message,
      meta: {}
    };
  }
}

// ANCHOR: selfTestMainDataReadHealth
function selfTestMainDataReadHealth() {
  var out = {
    ok: false,
    sheetApi: { ok: false, rows: 0, cols: 0, error: '' },
    mainData: { ok: false, bookings: 0, error: '' },
    ts: new Date().toISOString()
  };

  Logger.log('[selfTestMainDataReadHealth] START ts=%s', out.ts);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_MAIN_NAME);
    if (!sh) throw new Error("ไม่พบชีต '" + SHEET_MAIN_NAME + "'");

    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    var a1 = _sheetNameToA1_(sh.getName()) + '!A1:' + _toA1ColGlobal_(Math.max(1, lastCol)) + Math.max(1, lastRow);

    try {
      var resp = Sheets.Spreadsheets.Values.get(ss.getId(), a1, {
        majorDimension: 'ROWS',
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'SERIAL_NUMBER'
      });
      var values = (resp && resp.values) ? resp.values : [];
      out.sheetApi.ok = true;
      out.sheetApi.rows = values.length;
      out.sheetApi.cols = (values[0] || []).length;
      Logger.log('[selfTestMainDataReadHealth] SHEETS_API_OK range=%s rows=%s cols=%s', a1, out.sheetApi.rows, out.sheetApi.cols);
    } catch (eApi) {
      out.sheetApi.ok = false;
      out.sheetApi.error = (eApi && eApi.message) ? eApi.message : String(eApi);
      Logger.log('[selfTestMainDataReadHealth] SHEETS_API_FAIL %s', out.sheetApi.error);
    }

    try {
      var res = getMainData_();
      out.mainData.ok = !!(res && res.ok && res.data && Array.isArray(res.data.bookings));
      out.mainData.bookings = out.mainData.ok ? res.data.bookings.length : 0;
      if (!out.mainData.ok) {
        out.mainData.error = (res && res.error) ? res.error : 'invalid_mainData_shape';
      }
      Logger.log('[selfTestMainDataReadHealth] MAIN_DATA_OK=%s bookings=%s error=%s',
        out.mainData.ok, out.mainData.bookings, out.mainData.error || '-');
    } catch (eMain) {
      out.mainData.ok = false;
      out.mainData.error = (eMain && eMain.message) ? eMain.message : String(eMain);
      Logger.log('[selfTestMainDataReadHealth] MAIN_DATA_FAIL %s', out.mainData.error);
    }

    out.ok = out.sheetApi.ok && out.mainData.ok;
    Logger.log('[selfTestMainDataReadHealth] DONE ok=%s sheetApi.ok=%s mainData.ok=%s bookings=%s',
      out.ok, out.sheetApi.ok, out.mainData.ok, out.mainData.bookings);
    return out;
  } catch (e) {
    out.ok = false;
    out.mainData.error = (e && e.message) ? e.message : String(e);
    Logger.log('[selfTestMainDataReadHealth] FATAL %s', out.mainData.error);
    return out;
  }
}

// 🍓 BERRY FIX: SELF TEST - สถานะตามเวลาจริง Radar & Modal
function runSelfTest_VberryFix() {
  Logger.log("=== START: SELF TEST Radar & Modal Real-time Status ===");
  var tz = 'Asia/Bangkok';
  
  // Create Mock Environment Context
  var mockBookings = [
    {
      bookingId: 'TEST-001',
      status: 'approved',
      driver: 'ฮล-466',      // A mock driver name
      vehicle: '1นช-6112',   // A mock vehicle
      startDate: '2026-03-23',
      endDate: '2026-03-23',
      startTime: '11:30 น.', // Testing the parsing error fix
      endTime: '16:30 น.'
    }
  ];
  
  // Helper to build context dynamically for a specific "now"
  function buildTestRadarContext(simNow) {
    var ctx = {
      tz: tz,
      now: simNow,
      nowText: Utilities.formatDate(simNow, tz, 'yyyy-MM-dd HH:mm:ss'),
      availBlocks: [],
      approvedBookings: [],
      byDriver: {},
      byVehicle: {}
    };
    
    // Parse the booking exactly as buildRadarContext_ would
    mockBookings.forEach(function(b) {
      var startAt = getRadarDateTime_(b.startDate, b.startTime);
      var endAt = getRadarDateTime_(b.endDate, b.endTime);
      
      var bookingItem = {
        bookingId: b.bookingId,
        driverRaw: b.driver,
        vehicleRaw: b.vehicle,
        startAt: startAt,
        endAt: endAt,
        status: b.status
      };
      ctx.approvedBookings.push(bookingItem);
    });
    return ctx;
  }
  
  // Define our 3 cases
  var cases = [
    { name: "CASE 1: ก่อนเวลาเริ่มใช้งาน (10:00)", time: "2026-03-23T10:00:00", expectedD: "ready", expectedV: "ready" },
    { name: "CASE 2: ระหว่างเวลาใช้งาน (13:00)", time: "2026-03-23T13:00:00", expectedD: "busy", expectedV: "busy" },
    { name: "CASE 3: หลังเวลาสิ้นสุด (17:00)", time: "2026-03-23T17:00:00", expectedD: "ready", expectedV: "ready" }
  ];
  
  var allPass = true;
  
  cases.forEach(function(c) {
    var simNow = new Date(c.time);
    var ctx = buildTestRadarContext(simNow);
    var b = ctx.approvedBookings[0];
    
    Logger.log("--- " + c.name + " ---");
    Logger.log("Now: " + ctx.nowText);
    Logger.log("startAt: " + Utilities.formatDate(b.startAt, tz, 'yyyy-MM-dd HH:mm:ss') + " | endAt: " + Utilities.formatDate(b.endAt, tz, 'yyyy-MM-dd HH:mm:ss'));
    
    var driverStatus = calculateDriverStatus('ฮล-466', ctx).status;
    var vehicleStatus = calculateVehicleStatus('1นช-6112', ctx).status;
    
    var passD = driverStatus === c.expectedD;
    var passV = vehicleStatus === c.expectedV;
    
    Logger.log("Driver  : expected=" + c.expectedD + " | actual=" + driverStatus + " | " + (passD ? "PASS" : "FAIL"));
    Logger.log("Vehicle : expected=" + c.expectedV + " | actual=" + vehicleStatus + " | " + (passV ? "PASS" : "FAIL"));
    
    if (!passD || !passV) allPass = false;
  });
  
  Logger.log("--- Modal Architecture Check ---");
  var modalUsesRadarLogic = apiGetAdminPanelData.toString().indexOf("apiGetLiveStatus()") !== -1;
  Logger.log("Modal uses same source as Radar (apiGetLiveStatus): " + (modalUsesRadarLogic ? "TRUE (PASS)" : "FALSE (FAIL)"));
  if (!modalUsesRadarLogic) allPass = false;
  
  Logger.log("=== FINAL RESULT: " + (allPass ? "ALL TESTS PASSED ✅" : "SOME TESTS FAILED ❌") + " ===");
  return { success: allPass };
}

// ===================== SPREADSHEET TRIGGERS =====================

/**
 * Simple trigger that runs when a cell value is edited.
 * Clears the main cache to ensure changes reflect on the website immediately.
 */
function onEdit(e) {
  try {
    clearInitialCache_();
    Logger.log('onEdit simple trigger: cleared initial cache');
  } catch (err) {
    Logger.log('onEdit simple trigger error: ' + err.message);
  }
}

/**
 * Installable trigger that runs when structural changes occur (e.g., row deletions).
 * Clears the main cache to ensure changes reflect on the website immediately.
 */
function onChange(e) {
  try {
    clearInitialCache_();
    Logger.log('onChange installable trigger: cleared initial cache, changeType=' + (e ? e.changeType : 'unknown'));
  } catch (err) {
    Logger.log('onChange installable trigger error: ' + err.message);
  }
}

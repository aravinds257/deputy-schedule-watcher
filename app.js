/**
 * Deputy Schedule & Excel Exporter
 * Fully client-side application for GitHub Pages
 */

(() => {
  'use strict';

  // --- Constants & Storage Keys ---
  const STORAGE_KEYS = {
    INSTANCE: 'deputy_instance_url',
    TOKEN: 'deputy_bearer_token',
    CORS_PROXY: 'deputy_use_cors_proxy',
    CUSTOM_PROXY: 'deputy_custom_proxy_url',
    PROFILE: 'deputy_cached_profile'
  };

  const DEFAULT_PROXY = 'https://corsproxy.io/?url=';

  // --- State Management ---
  const state = {
    instance: 'a2c28219075424.uk.deputy.com',
    token: '',
    useProxy: true,
    proxyUrl: DEFAULT_PROXY,
    currentUser: null,
    shifts: [],
    filteredShifts: [],
    membersMap: new Map(),
    locationsMap: new Map(),
    rolesMap: new Map(),
    sortColumn: 'date',
    sortAsc: true,
    isDemo: false
  };

  // --- DOM Elements ---
  const elements = {
    // Auth & Config
    deputyInstance: document.getElementById('deputy-instance'),
    bearerToken: document.getElementById('bearer-token'),
    btnToggleTokenVisibility: document.getElementById('btn-toggle-token-visibility'),
    corsProxyToggle: document.getElementById('cors-proxy-toggle'),
    customProxyWrap: document.getElementById('custom-proxy-wrap'),
    customProxyUrl: document.getElementById('custom-proxy-url'),
    btnTestConnection: document.getElementById('btn-test-connection'),
    connectionStatusPill: document.getElementById('connection-status-pill'),
    userProfileCard: document.getElementById('user-profile-card'),
    userAvatarInitials: document.getElementById('user-avatar-initials'),
    userDisplayName: document.getElementById('user-display-name'),
    userMemberId: document.getElementById('user-member-id'),
    userEmailMeta: document.getElementById('user-email-meta'),

    // Date & Schedule Controls
    startDate: document.getElementById('start-date'),
    endDate: document.getElementById('end-date'),
    presetButtons: document.querySelectorAll('.btn-chip'),
    memberFilterSelect: document.getElementById('member-filter-select'),
    btnFetchShifts: document.getElementById('btn-fetch-shifts'),
    manualJsonInput: document.getElementById('manual-json-input'),
    btnImportJson: document.getElementById('btn-import-json'),

    // Stats
    statTotalShifts: document.getElementById('stat-total-shifts'),
    statTotalHours: document.getElementById('stat-total-hours'),
    statRequesterName: document.getElementById('stat-requester-name'),

    // Table & Exports
    shiftsTable: document.getElementById('shifts-table'),
    shiftsTableBody: document.getElementById('shifts-table-body'),
    tableSubtitle: document.getElementById('table-subtitle'),
    tableSearch: document.getElementById('table-search'),
    filteredCountBadge: document.getElementById('filtered-count-badge'),
    footerTotalHours: document.getElementById('footer-total-hours'),
    btnExportExcel: document.getElementById('btn-export-excel'),
    btnExportCsv: document.getElementById('btn-export-csv'),

    // Modals & Navigation
    btnTokenGuide: document.getElementById('btn-token-guide'),
    linkHowToken: document.getElementById('link-how-token'),
    modalTokenGuide: document.getElementById('modal-token-guide'),
    btnCloseTokenModal: document.getElementById('btn-close-token-modal'),
    btnUnderstandToken: document.getElementById('btn-understand-token'),
    modalDevLink: document.getElementById('modal-dev-link'),
    btnDemoMode: document.getElementById('btn-demo-mode'),
    toast: document.getElementById('toast')
  };

  // --- Initialization ---
  function init() {
    loadSettings();
    bindEvents();
    updateModalLinks();
  }

  // --- Settings & Persistence ---
  function loadSettings() {
    const savedInstance = localStorage.getItem(STORAGE_KEYS.INSTANCE);
    if (savedInstance) {
      state.instance = savedInstance;
      elements.deputyInstance.value = savedInstance;
    }

    const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (savedToken) {
      state.token = savedToken;
      elements.bearerToken.value = savedToken;
    }

    const savedProxy = localStorage.getItem(STORAGE_KEYS.CORS_PROXY);
    if (savedProxy !== null) {
      state.useProxy = savedProxy === 'true';
      elements.corsProxyToggle.checked = state.useProxy;
    }

    const savedCustomProxy = localStorage.getItem(STORAGE_KEYS.CUSTOM_PROXY);
    if (savedCustomProxy) {
      state.proxyUrl = savedCustomProxy;
      elements.customProxyUrl.value = savedCustomProxy;
    }

    const savedProfile = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (savedProfile) {
      try {
        state.currentUser = JSON.parse(savedProfile);
        displayUserProfile(state.currentUser);
        setConnectionStatus(true);
      } catch (e) {
        console.warn('Failed to parse cached profile', e);
      }
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEYS.INSTANCE, elements.deputyInstance.value.trim());
    localStorage.setItem(STORAGE_KEYS.TOKEN, elements.bearerToken.value.trim());
    localStorage.setItem(STORAGE_KEYS.CORS_PROXY, elements.corsProxyToggle.checked);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_PROXY, elements.customProxyUrl.value.trim());
  }

  // --- UI Event Handlers ---
  function bindEvents() {
    elements.deputyInstance.addEventListener('input', () => {
      state.instance = elements.deputyInstance.value.trim();
      saveSettings();
      updateModalLinks();
    });

    elements.bearerToken.addEventListener('input', () => {
      state.token = elements.bearerToken.value.trim();
      saveSettings();
    });

    elements.corsProxyToggle.addEventListener('change', () => {
      state.useProxy = elements.corsProxyToggle.checked;
      saveSettings();
    });

    elements.btnToggleTokenVisibility.addEventListener('click', () => {
      const isPassword = elements.bearerToken.type === 'password';
      elements.bearerToken.type = isPassword ? 'text' : 'password';
      elements.btnToggleTokenVisibility.style.color = isPassword ? 'var(--brand-primary)' : 'var(--text-tertiary)';
    });

    elements.btnTestConnection.addEventListener('click', () => testConnection());
    elements.btnFetchShifts.addEventListener('click', () => fetchShiftsFromApi());
    elements.btnImportJson.addEventListener('click', () => handleManualJsonImport());
    elements.btnDemoMode.addEventListener('click', () => loadDemoData());
    elements.btnExportExcel.addEventListener('click', () => exportToExcel());
    elements.btnExportCsv.addEventListener('click', () => exportToCsv());
    elements.tableSearch.addEventListener('input', () => applyTableFilters());
    elements.memberFilterSelect.addEventListener('change', () => applyTableFilters());

    elements.presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.presetButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyDatePreset(btn.dataset.preset);
      });
    });

    elements.shiftsTable.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (state.sortColumn === col) {
          state.sortAsc = !state.sortAsc;
        } else {
          state.sortColumn = col;
          state.sortAsc = true;
        }
        sortAndRenderShifts();
      });
    });

    const openModal = () => elements.modalTokenGuide.style.display = 'flex';
    const closeModal = () => elements.modalTokenGuide.style.display = 'none';

    elements.btnTokenGuide.addEventListener('click', openModal);
    elements.linkHowToken.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
    elements.btnCloseTokenModal.addEventListener('click', closeModal);
    elements.btnUnderstandToken.addEventListener('click', closeModal);

    elements.modalTokenGuide.addEventListener('click', (e) => {
      if (e.target === elements.modalTokenGuide) closeModal();
    });
  }

  function updateModalLinks() {
    const rawInstance = cleanInstanceUrl(elements.deputyInstance.value || 'a2c28219075424.uk.deputy.com');
    elements.modalDevLink.textContent = `https://${rawInstance}/exec/devapp/oauth_clients`;
  }

  function cleanInstanceUrl(input) {
    return input.replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim();
  }

  // --- Toast Notifications ---
  function showToast(message, type = 'info') {
    elements.toast.className = `toast toast-${type}`;
    elements.toast.innerHTML = `<span>${message}</span>`;
    elements.toast.style.display = 'flex';

    setTimeout(() => {
      elements.toast.style.display = 'none';
    }, 4000);
  }

  // --- Date Presets ---
  function applyDatePreset(preset) {
    const now = new Date();
    let start, end;

    if (preset === 'target-july2026') {
      start = '2026-07-01T00:00';
      end = '2026-07-31T23:59';
    } else if (preset === 'this-month') {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      start = `${year}-${month}-01T00:00`;
      end = `${year}-${month}-${String(lastDay).padStart(2, '0')}T23:59`;
    } else if (preset === 'next-month') {
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const year = nextMonthDate.getFullYear();
      const month = String(nextMonthDate.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, nextMonthDate.getMonth() + 1, 0).getDate();
      start = `${year}-${month}-01T00:00`;
      end = `${year}-${month}-${String(lastDay).padStart(2, '0')}T23:59`;
    } else if (preset === 'last-month') {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year = lastMonthDate.getFullYear();
      const month = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, lastMonthDate.getMonth() + 1, 0).getDate();
      start = `${year}-${month}-01T00:00`;
      end = `${year}-${month}-${String(lastDay).padStart(2, '0')}T23:59`;
    }

    if (start && end) {
      elements.startDate.value = start;
      elements.endDate.value = end;
    }
  }

  // --- API Client Layer ---
  function buildApiUrl(endpointPath) {
    const rawInstance = cleanInstanceUrl(elements.deputyInstance.value || state.instance);
    const targetUrl = `https://${rawInstance}${endpointPath}`;

    if (elements.corsProxyToggle.checked) {
      const proxyBase = elements.customProxyUrl.value.trim() || DEFAULT_PROXY;
      return `${proxyBase}${encodeURIComponent(targetUrl)}`;
    }
    return targetUrl;
  }

  async function callDeputyApi(endpointPath, options = {}) {
    const token = elements.bearerToken.value.trim();
    if (!token) {
      throw new Error('Please enter your Deputy Bearer Token first.');
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const url = buildApiUrl(endpointPath);

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      let errorDetails = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson.error || errorJson.message) {
          errorDetails += ` - ${errorJson.error || errorJson.message}`;
        }
      } catch (_) {}
      throw new Error(errorDetails);
    }

    return await response.json();
  }

  // --- Connection & Profile Testing ---
  async function testConnection() {
    const originalText = elements.btnTestConnection.innerHTML;
    elements.btnTestConnection.disabled = true;
    elements.btnTestConnection.innerHTML = 'Connecting to Deputy...';

    try {
      const userProfile = await callDeputyApi('/api/v1/me');
      state.currentUser = userProfile;
      state.isDemo = false;
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(userProfile));

      displayUserProfile(userProfile);
      setConnectionStatus(true);
      showToast(`Connected as ${getDisplayName(userProfile)}`, 'success');

      // Re-filter shifts if already loaded
      if (state.shifts.length > 0) {
        populateMemberFilterDropdown();
        applyTableFilters();
      }
    } catch (err) {
      console.error('Connection test failed:', err);
      setConnectionStatus(false);
      showToast(err.message, 'error');
    } finally {
      elements.btnTestConnection.disabled = false;
      elements.btnTestConnection.innerHTML = originalText;
    }
  }

  function getDisplayName(user) {
    if (!user) return 'User';
    return user.DisplayName ||
           user.displayName ||
           `${user.FirstName || user.firstName || ''} ${user.LastName || user.lastName || ''}`.trim() ||
           user.Name ||
           user.name ||
           (user.Employee ? `Employee #${user.Employee}` : `Member #${user.Id || user.id}`);
  }

  function displayUserProfile(user) {
    if (!user) return;
    elements.userProfileCard.style.display = 'flex';
    const name = getDisplayName(user);
    elements.userDisplayName.textContent = name;
    elements.statRequesterName.textContent = name;

    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
    elements.userAvatarInitials.textContent = initials;

    const id = user.Employee || user.EmployeeId || user.Id || user.id || user.memberId || '--';
    elements.userMemberId.textContent = id;
    elements.userEmailMeta.innerHTML = `Employee/Member ID: <strong>${id}</strong> &bull; ${user.Email || user.email || 'No email'}`;
  }

  function setConnectionStatus(connected) {
    if (connected) {
      elements.connectionStatusPill.className = 'status-pill status-connected';
      elements.connectionStatusPill.textContent = 'Connected';
    } else {
      elements.connectionStatusPill.className = 'status-pill status-disconnected';
      elements.connectionStatusPill.textContent = 'Disconnected';
    }
  }

  // --- Shift Fetching & Payload Construction ---
  async function fetchShiftsFromApi() {
    const originalText = elements.btnFetchShifts.innerHTML;
    elements.btnFetchShifts.disabled = true;
    elements.btnFetchShifts.innerHTML = 'Fetching shifts...';

    try {
      const startInput = elements.startDate.value;
      const endInput = elements.endDate.value;

      if (!startInput || !endInput) {
        throw new Error('Please select both start and end dates.');
      }

      const startDateObj = new Date(startInput);
      const endDateObj = new Date(endInput);

      const payload = {
        data: {
          start: formatDateToIsoWithTz(startDateObj),
          end: formatDateToIsoWithTz(endDateObj),
          locationIds: [],
          locationMode: "ALL",
          expandMetadata: true
        }
      };

      // 1. Ensure profile is retrieved to know requester's Employee ID & Name
      if (!state.currentUser) {
        try {
          const profile = await callDeputyApi('/api/v1/me');
          state.currentUser = profile;
          displayUserProfile(profile);
          setConnectionStatus(true);
        } catch (profileErr) {
          console.warn('Auto profile fetch warning:', profileErr);
        }
      }

      // 2. Call Shifts Search Endpoint: /api/schedule/v2/me/shifts:search
      const responseData = await callDeputyApi('/api/schedule/v2/me/shifts:search', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      state.isDemo = false;
      processAndRenderResponse(responseData);
      showToast('Schedules fetched successfully!', 'success');
    } catch (err) {
      console.error('Fetch shifts failed:', err);
      showToast(err.message, 'error');
    } finally {
      elements.btnFetchShifts.disabled = false;
      elements.btnFetchShifts.innerHTML = originalText;
    }
  }

  function formatDateToIsoWithTz(date) {
    const tzOffset = -date.getTimezoneOffset();
    const diff = tzOffset >= 0 ? '+' : '-';
    const pad = (num) => String(Math.floor(Math.abs(num))).padStart(2, '0');
    
    return date.getFullYear() +
      '-' + pad(date.getMonth() + 1) +
      '-' + pad(date.getDate()) +
      'T' + pad(date.getHours()) +
      ':' + pad(date.getMinutes()) +
      ':' + pad(date.getSeconds()) +
      diff + pad(tzOffset / 60) +
      ':' + pad(tzOffset % 60);
  }

  // --- Manual JSON Import ---
  function handleManualJsonImport() {
    const raw = elements.manualJsonInput.value.trim();
    if (!raw) {
      showToast('Please paste valid JSON data into the text box.', 'error');
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      state.isDemo = false;
      processAndRenderResponse(parsed);
      showToast('JSON imported and processed successfully!', 'success');
    } catch (e) {
      showToast('Invalid JSON structure: ' + e.message, 'error');
    }
  }

  // --- Shift Processing & Normalization ---
  function processAndRenderResponse(data) {
    state.shifts = [];
    state.membersMap.clear();
    state.locationsMap.clear();
    state.rolesMap.clear();

    // Extract metadata if available
    const metadata = data.metadata || (data.data && data.data.metadata) || {};
    
    // Member / Employee metadata mapping
    const memberSources = [
      metadata.employees,
      metadata.members,
      metadata.rosterMembers,
      metadata.roster_members,
      metadata.users,
      metadata.staff
    ];

    memberSources.forEach(list => {
      if (Array.isArray(list)) {
        list.forEach(m => {
          const id = String(m.id ?? m.Id ?? m.employee ?? m.memberId ?? m.userId ?? '');
          const name = m.displayName ?? m.DisplayName ?? m.name ?? `${m.firstName || m.FirstName || ''} ${m.lastName || m.LastName || ''}`.trim();
          if (id && name) {
            state.membersMap.set(id, name);
          }
        });
      }
    });

    // Locations / Operational Units metadata
    const locationSources = [
      metadata.locations,
      metadata.operationalUnits,
      metadata.companies
    ];

    locationSources.forEach(list => {
      if (Array.isArray(list)) {
        list.forEach(l => {
          const id = String(l.id ?? l.Id ?? '');
          const name = l.name ?? l.operationalUnitName ?? l.locationName ?? l.strUnitName ?? '';
          if (id && name) {
            state.locationsMap.set(id, name);
          }
        });
      }
    });

    // Areas / Roles metadata
    const roleSources = [
      metadata.areas,
      metadata.roles,
      metadata.positions
    ];

    roleSources.forEach(list => {
      if (Array.isArray(list)) {
        list.forEach(r => {
          const id = String(r.id ?? r.Id ?? '');
          const name = r.name ?? r.areaName ?? r.roleName ?? r.positionName ?? '';
          if (id && name) {
            state.rolesMap.set(id, name);
          }
        });
      }
    });

    // Extract raw shifts array (handling all Deputy API response wrappers)
    let rawShifts = [];
    if (Array.isArray(data)) {
      rawShifts = data;
    } else if (data.data && Array.isArray(data.data.shifts)) {
      rawShifts = data.data.shifts;
    } else if (Array.isArray(data.shifts)) {
      rawShifts = data.shifts;
    } else if (data.data && Array.isArray(data.data)) {
      rawShifts = data.data;
    } else if (data.response && Array.isArray(data.response)) {
      rawShifts = data.response;
    } else if (data.id && data.start && data.end) {
      // Single shift object passed
      rawShifts = [data];
    }

    // If current authenticated user is known, ensure their ID is mapped
    if (state.currentUser) {
      ['Id', 'id', 'Employee', 'employee', 'EmployeeId', 'employeeId', 'UserId', 'userId'].forEach(key => {
        if (state.currentUser[key]) {
          state.membersMap.set(String(state.currentUser[key]), getDisplayName(state.currentUser));
        }
      });
    }

    // Normalize each shift
    state.shifts = rawShifts.map(s => normalizeShift(s));

    // Populate dropdown with all unique employees detected
    populateMemberFilterDropdown();

    applyTableFilters();
  }

  function normalizeShift(raw) {
    // Start & End Timestamps
    const startStr = raw.start || raw.startTime || raw.intStart || raw.Start || raw.StartTime;
    const endStr = raw.end || raw.endTime || raw.intEnd || raw.End || raw.EndTime;

    const startDate = parseDeputyDate(startStr);
    const endDate = parseDeputyDate(endStr);

    // Employee / Member ID Resolution (Field is `employee` or `memberId` in Deputy API)
    const employeeId = String(raw.employee ?? raw.memberId ?? raw.employeeId ?? raw.userId ?? raw.member ?? '');

    // Note / Employee Name detection
    const noteText = raw.note || raw.notes || raw.comment || raw.strComment || '';

    let memberName = raw.memberName || raw.employeeName || state.membersMap.get(employeeId);

    if (!memberName) {
      if (state.currentUser) {
        const uids = [
          state.currentUser.Employee,
          state.currentUser.EmployeeId,
          state.currentUser.Id,
          state.currentUser.id,
          state.currentUser.UserId
        ].filter(Boolean).map(String);

        if (uids.includes(employeeId) || !employeeId) {
          memberName = getDisplayName(state.currentUser);
        }
      }
    }

    // If still no memberName, check note or fallback
    if (!memberName) {
      if (noteText && noteText.trim().length > 0 && noteText.trim().length <= 25 && !noteText.includes('\n')) {
        // Frequently Deputy shifts assign the employee name in `note` (e.g. "PRINCE")
        memberName = noteText.trim();
      } else if (employeeId) {
        memberName = `Employee #${employeeId}`;
      } else {
        memberName = state.currentUser ? getDisplayName(state.currentUser) : 'Requester';
      }
    }

    // If we now have a resolved name for this employeeId, save to map
    if (employeeId && memberName && !state.membersMap.has(employeeId)) {
      state.membersMap.set(employeeId, memberName);
    }

    // Meal Break Duration (in minutes)
    let mealBreakMins = 0;
    if (raw.mealbreakDuration !== undefined && raw.mealbreakDuration !== null) {
      mealBreakMins = Number(raw.mealbreakDuration);
    } else if (raw.mealbreakMinutes !== undefined) {
      mealBreakMins = Number(raw.mealbreakMinutes);
    } else if (raw.breakMinutes !== undefined) {
      mealBreakMins = Number(raw.breakMinutes);
    } else if (raw.totalMealbreak !== undefined) {
      mealBreakMins = Number(raw.totalMealbreak);
    } else if (Array.isArray(raw.mealbreakSlots) && raw.mealbreakSlots.length > 0) {
      mealBreakMins = raw.mealbreakSlots.reduce((sum, slot) => {
        if (slot.duration) return sum + slot.duration;
        if (slot.start && slot.end) {
          return sum + (new Date(slot.end) - new Date(slot.start)) / 60000;
        }
        return sum;
      }, 0);
    }

    // Total Hours Calculation
    let totalHours = 0;
    if (startDate && endDate) {
      const diffMs = endDate.getTime() - startDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const breakHours = mealBreakMins > 0 ? (mealBreakMins / 60) : 0;
      totalHours = Math.max(0, diffHours - breakHours);
    } else if (raw.duration !== undefined && raw.duration !== null) {
      const d = parseFloat(raw.duration);
      // In Deputy V2 Shifts API, duration is in HOURS (e.g. 14).
      // Only divide by 3600 if value is large (> 100, which means seconds).
      totalHours = d > 100 ? (d / 3600) : d;
    }

    // Role / Area (Field in Deputy is `areaName` or `area`)
    const areaId = String(raw.area ?? raw.roleId ?? raw.role ?? '');
    const roleName = raw.areaName || raw.roleName || raw.positionName || state.rolesMap.get(areaId) || (areaId ? `Area #${areaId}` : 'Shift');

    // Location (Field in Deputy is `locationName` or `location`)
    const locationId = String(raw.location ?? raw.operationalUnitId ?? raw.companyId ?? '');
    const locationName = raw.locationName || raw.operationalUnitName || raw.companyName || state.locationsMap.get(locationId) || (locationId ? `Location #${locationId}` : 'Main Site');

    // Status & Confirmation
    let statusLabel = 'Confirmed';
    let statusClass = 'badge-confirmed';

    if (raw.isPublished === true) {
      statusLabel = 'Published';
      statusClass = 'badge-confirmed';
    }

    if (raw.isOpen === true) {
      statusLabel = 'Open';
      statusClass = 'badge-open';
    } else if (raw.isPublished === false) {
      statusLabel = 'Draft';
      statusClass = 'badge-draft';
    }

    if (raw.confirmationStatus && typeof raw.confirmationStatus === 'string') {
      if (raw.confirmationStatus.includes('CONFIRMED')) {
        statusLabel = 'Confirmed';
        statusClass = 'badge-confirmed';
      }
    }

    return {
      raw,
      id: raw.id || raw.shiftId || Math.random().toString(36).substr(2, 9),
      startDate,
      endDate,
      memberId: employeeId,
      employeeId,
      memberName,
      roleName,
      locationName,
      mealBreakMins,
      totalHours: Number(totalHours.toFixed(2)),
      status: statusLabel,
      statusClass,
      notes: noteText
    };
  }

  function parseDeputyDate(val) {
    if (!val) return null;
    if (typeof val === 'number') {
      return val > 10000000000 ? new Date(val) : new Date(val * 1000);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  function populateMemberFilterDropdown() {
    const currentVal = elements.memberFilterSelect.value;
    const uniqueMembers = new Map();

    state.shifts.forEach(s => {
      if (s.employeeId) {
        uniqueMembers.set(s.employeeId, s.memberName);
      }
    });

    let optionsHtml = '';
    const requesterName = state.currentUser ? getDisplayName(state.currentUser) : 'Authenticated User';
    
    optionsHtml += `<option value="auto">Auto (Only My Shifts: ${requesterName})</option>`;
    optionsHtml += `<option value="all">All Shifts (${state.shifts.length} total)</option>`;

    uniqueMembers.forEach((name, id) => {
      const shiftCount = state.shifts.filter(s => s.employeeId === id).length;
      optionsHtml += `<option value="${id}">${name} (ID: ${id} - ${shiftCount} shifts)</option>`;
    });

    elements.memberFilterSelect.innerHTML = optionsHtml;
    
    if (currentVal && Array.from(elements.memberFilterSelect.options).some(o => o.value === currentVal)) {
      elements.memberFilterSelect.value = currentVal;
    }
  }

  // --- Filtering & Sorting ---
  function applyTableFilters() {
    const searchTerm = elements.tableSearch.value.toLowerCase().trim();
    const memberFilter = elements.memberFilterSelect.value;

    // Collect all valid IDs and display names for current user
    const currentUserKeys = [];
    if (state.currentUser) {
      ['Employee', 'EmployeeId', 'employee', 'employeeId', 'Id', 'id', 'UserId', 'userId', 'memberId'].forEach(k => {
        if (state.currentUser[k] !== undefined && state.currentUser[k] !== null) {
          currentUserKeys.push(String(state.currentUser[k]));
        }
      });
    }

    state.filteredShifts = state.shifts.filter(shift => {
      // 1. Employee / Member Filter
      if (memberFilter === 'auto') {
        if (currentUserKeys.length > 0) {
          const shiftEmp = String(shift.employeeId || shift.memberId || shift.raw?.employee || '');
          const matchesId = currentUserKeys.includes(shiftEmp);
          
          let matchesName = false;
          if (state.currentUser && state.currentUser.DisplayName) {
            const uName = state.currentUser.DisplayName.toLowerCase();
            matchesName = shift.memberName.toLowerCase().includes(uName) ||
                          (shift.notes && shift.notes.toLowerCase().includes(uName));
          }

          if (!matchesId && !matchesName) {
            // If shift does not match the active requester's ID or name, filter it out
            return false;
          }
        }
      } else if (memberFilter !== 'all') {
        const targetId = String(memberFilter);
        const shiftEmp = String(shift.employeeId || shift.memberId || shift.raw?.employee || '');
        if (shiftEmp !== targetId) {
          return false;
        }
      }

      // 2. Search Term Filter
      if (searchTerm) {
        const matchString = `${shift.memberName} ${shift.roleName} ${shift.locationName} ${shift.status} ${shift.notes}`.toLowerCase();
        if (!matchString.includes(searchTerm)) {
          return false;
        }
      }

      return true;
    });

    sortAndRenderShifts();
  }

  function sortAndRenderShifts() {
    const col = state.sortColumn;
    const asc = state.sortAsc ? 1 : -1;

    state.filteredShifts.sort((a, b) => {
      if (col === 'date' || col === 'start') {
        return ((a.startDate ? a.startDate.getTime() : 0) - (b.startDate ? b.startDate.getTime() : 0)) * asc;
      }
      if (col === 'end') {
        return ((a.endDate ? a.endDate.getTime() : 0) - (b.endDate ? b.endDate.getTime() : 0)) * asc;
      }
      if (col === 'hours') {
        return (a.totalHours - b.totalHours) * asc;
      }
      if (col === 'break') {
        return (a.mealBreakMins - b.mealBreakMins) * asc;
      }
      if (col === 'member') {
        return a.memberName.localeCompare(b.memberName) * asc;
      }
      if (col === 'role') {
        return a.roleName.localeCompare(b.roleName) * asc;
      }
      if (col === 'location') {
        return a.locationName.localeCompare(b.locationName) * asc;
      }
      if (col === 'status') {
        return a.status.localeCompare(b.status) * asc;
      }
      return 0;
    });

    renderTable();
    updateStats();
  }

  // --- Render Table & Summary Cards ---
  function renderTable() {
    const tbody = elements.shiftsTableBody;
    tbody.innerHTML = '';

    if (state.filteredShifts.length === 0) {
      const totalRaw = state.shifts.length;
      tbody.innerHTML = `
        <tr class="empty-state-row">
          <td colspan="10">
            <div class="empty-state">
              <div class="empty-icon">🔍</div>
              <h3>${totalRaw > 0 ? 'No shifts match current filter' : 'No schedule data loaded'}</h3>
              <p>${totalRaw > 0 ? 'Try changing the "Filter by Member" dropdown to "All Shifts" or adjusting your search term.' : 'Click "Fetch Schedules from Deputy" or "Load Demo Data" to get started.'}</p>
            </div>
          </td>
        </tr>
      `;
      elements.btnExportExcel.disabled = true;
      elements.btnExportCsv.disabled = true;
      elements.filteredCountBadge.textContent = '0 shifts';
      elements.footerTotalHours.textContent = '0.00 hrs';
      return;
    }

    elements.btnExportExcel.disabled = false;
    elements.btnExportCsv.disabled = false;
    elements.filteredCountBadge.textContent = `${state.filteredShifts.length} shift${state.filteredShifts.length === 1 ? '' : 's'}`;

    state.filteredShifts.forEach(s => {
      const tr = document.createElement('tr');

      const dateStr = s.startDate ? s.startDate.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '--';
      const startStr = s.startDate ? s.startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '--';
      const endStr = s.endDate ? s.endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '--';

      tr.innerHTML = `
        <td class="cell-date">${dateStr}</td>
        <td><strong>${escapeHtml(s.memberName)}</strong> <small style="color:var(--text-tertiary);">#${s.employeeId}</small></td>
        <td>${startStr}</td>
        <td>${endStr}</td>
        <td class="cell-hours">${s.totalHours.toFixed(2)} hrs</td>
        <td>${s.mealBreakMins} min</td>
        <td>${escapeHtml(s.roleName)}</td>
        <td>${escapeHtml(s.locationName)}</td>
        <td><span class="excel-badge ${s.statusClass}">${s.status}</span></td>
        <td>${escapeHtml(s.notes || '-')}</td>
      `;
      tbody.appendChild(tr);
    });

    const startRange = elements.startDate.value ? elements.startDate.value.split('T')[0] : '';
    const endRange = elements.endDate.value ? elements.endDate.value.split('T')[0] : '';
    elements.tableSubtitle.textContent = `Displaying ${state.filteredShifts.length} shifts between ${startRange} and ${endRange}`;
  }

  function updateStats() {
    const count = state.filteredShifts.length;
    const totalHours = state.filteredShifts.reduce((acc, s) => acc + s.totalHours, 0);

    elements.statTotalShifts.textContent = count;
    elements.statTotalHours.textContent = `${totalHours.toFixed(2)} hrs`;
    elements.footerTotalHours.textContent = `${totalHours.toFixed(2)} hrs`;

    if (state.currentUser) {
      elements.statRequesterName.textContent = getDisplayName(state.currentUser);
    } else if (state.filteredShifts.length > 0) {
      elements.statRequesterName.textContent = state.filteredShifts[0].memberName;
    } else {
      elements.statRequesterName.textContent = 'Not loaded';
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Excel (.xlsx) & CSV Exporters ---
  function exportToExcel() {
    if (state.filteredShifts.length === 0) {
      showToast('No shifts to export', 'error');
      return;
    }

    if (typeof XLSX === 'undefined') {
      showToast('SheetJS library is still loading. Please try again.', 'error');
      return;
    }

    try {
      const rows = state.filteredShifts.map(s => ({
        'Date': s.startDate ? s.startDate.toISOString().split('T')[0] : '',
        'Day': s.startDate ? s.startDate.toLocaleDateString(undefined, { weekday: 'long' }) : '',
        'Member / Employee Name': s.memberName,
        'Employee ID': s.employeeId,
        'Start Time': s.startDate ? s.startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '',
        'End Time': s.endDate ? s.endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '',
        'Break (Mins)': s.mealBreakMins,
        'Total Hours': s.totalHours,
        'Area / Role': s.roleName,
        'Location': s.locationName,
        'Status': s.status,
        'Notes': s.notes
      }));

      const totalHours = state.filteredShifts.reduce((sum, s) => sum + s.totalHours, 0);
      rows.push({
        'Date': 'TOTAL',
        'Day': '',
        'Member / Employee Name': '',
        'Employee ID': '',
        'Start Time': '',
        'End Time': '',
        'Break (Mins)': '',
        'Total Hours': Number(totalHours.toFixed(2)),
        'Area / Role': '',
        'Location': '',
        'Status': `${state.filteredShifts.length} Shifts`,
        'Notes': 'Generated via Deputy Schedule Exporter'
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);

      const colWidths = [
        { wch: 12 }, // Date
        { wch: 12 }, // Day
        { wch: 24 }, // Member Name
        { wch: 14 }, // Employee ID
        { wch: 12 }, // Start Time
        { wch: 12 }, // End Time
        { wch: 12 }, // Break
        { wch: 14 }, // Total Hours
        { wch: 20 }, // Role/Area
        { wch: 22 }, // Location
        { wch: 14 }, // Status
        { wch: 30 }  // Notes
      ];
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule');

      const requester = (state.currentUser ? getDisplayName(state.currentUser) : (state.filteredShifts[0]?.memberName || 'Deputy_Schedule')).replace(/[^a-zA-Z0-9_-]/g, '_');
      const startStr = elements.startDate.value.split('T')[0] || 'start';
      const endStr = elements.endDate.value.split('T')[0] || 'end';
      const filename = `${requester}_Schedule_${startStr}_to_${endStr}.xlsx`;

      XLSX.writeFile(workbook, filename);
      showToast(`Exported ${filename} successfully!`, 'success');
    } catch (err) {
      console.error('Excel export failed:', err);
      showToast('Export failed: ' + err.message, 'error');
    }
  }

  function exportToCsv() {
    if (state.filteredShifts.length === 0) return;

    const headers = ['Date', 'Day', 'Member Name', 'Employee ID', 'Start Time', 'End Time', 'Break (Mins)', 'Total Hours', 'Area / Role', 'Location', 'Status', 'Notes'];
    const csvRows = [headers.join(',')];

    state.filteredShifts.forEach(s => {
      const dateStr = s.startDate ? s.startDate.toISOString().split('T')[0] : '';
      const dayStr = s.startDate ? s.startDate.toLocaleDateString(undefined, { weekday: 'long' }) : '';
      const startStr = s.startDate ? s.startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
      const endStr = s.endDate ? s.endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';

      const row = [
        `"${dateStr}"`,
        `"${dayStr}"`,
        `"${s.memberName.replace(/"/g, '""')}"`,
        `"${s.employeeId}"`,
        `"${startStr}"`,
        `"${endStr}"`,
        s.mealBreakMins,
        s.totalHours,
        `"${s.roleName.replace(/"/g, '""')}"`,
        `"${s.locationName.replace(/"/g, '""')}"`,
        `"${s.status}"`,
        `"${(s.notes || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Deputy_Schedule_${Date.now()}.csv`;
    link.click();
    showToast('CSV downloaded successfully!', 'success');
  }

  // --- Demo Mode Data ---
  function loadDemoData() {
    state.isDemo = true;
    state.currentUser = {
      Id: 101,
      Employee: 101,
      DisplayName: 'Prince (Deputy User)',
      FirstName: 'Prince',
      LastName: '',
      Email: 'prince@example.com',
      Role: 'Team Member'
    };

    displayUserProfile(state.currentUser);
    setConnectionStatus(true);

    // Realistic shifts matching the Deputy API response structure provided
    const demoPayload = {
      metadata: {
        employees: [
          { id: 101, displayName: 'Prince' },
          { id: 102, displayName: 'Sarah Jenkins' }
        ],
        locations: [
          { id: 8, name: 'Westfield' },
          { id: 9, name: 'Central Hub' }
        ],
        areas: [
          { id: 46, name: 'Live in' },
          { id: 47, name: 'Day Duty' }
        ]
      },
      data: {
        shifts: [
          {
            id: 53892,
            start: "2026-07-09T08:00:00+01:00",
            end: "2026-07-09T22:00:00+01:00",
            mealbreakDuration: 0,
            mealbreakSlots: [],
            duration: 14,
            cost: 0,
            area: 46,
            employee: 101,
            note: "PRINCE",
            isPublished: true,
            isOpen: false,
            confirmationStatus: "ROSTER_CONFIRMATION_NOT_REQUIRED",
            areaName: "Live in",
            location: 8,
            locationName: "Westfield"
          },
          {
            id: 53893,
            start: "2026-07-10T08:00:00+01:00",
            end: "2026-07-10T22:00:00+01:00",
            mealbreakDuration: 0,
            mealbreakSlots: [],
            duration: 14,
            cost: 0,
            area: 46,
            employee: 101,
            note: "PRINCE",
            isPublished: true,
            isOpen: false,
            confirmationStatus: "ROSTER_CONFIRMATION_NOT_REQUIRED",
            areaName: "Live in",
            location: 8,
            locationName: "Westfield"
          },
          {
            id: 53894,
            start: "2026-07-13T09:00:00+01:00",
            end: "2026-07-13T17:30:00+01:00",
            mealbreakDuration: 30,
            mealbreakSlots: [],
            duration: 8,
            cost: 0,
            area: 47,
            employee: 101,
            note: "PRINCE",
            isPublished: true,
            isOpen: false,
            confirmationStatus: "ROSTER_CONFIRMATION_NOT_REQUIRED",
            areaName: "Day Duty",
            location: 8,
            locationName: "Westfield"
          },
          {
            id: 53895,
            start: "2026-07-15T08:00:00+01:00",
            end: "2026-07-15T22:00:00+01:00",
            mealbreakDuration: 0,
            mealbreakSlots: [],
            duration: 14,
            cost: 0,
            area: 46,
            employee: 101,
            note: "PRINCE",
            isPublished: true,
            isOpen: false,
            confirmationStatus: "ROSTER_CONFIRMATION_NOT_REQUIRED",
            areaName: "Live in",
            location: 8,
            locationName: "Westfield"
          },
          {
            id: 53896,
            start: "2026-07-18T08:00:00+01:00",
            end: "2026-07-18T22:00:00+01:00",
            mealbreakDuration: 0,
            mealbreakSlots: [],
            duration: 14,
            cost: 0,
            area: 46,
            employee: 101,
            note: "PRINCE",
            isPublished: true,
            isOpen: false,
            confirmationStatus: "ROSTER_CONFIRMATION_NOT_REQUIRED",
            areaName: "Live in",
            location: 8,
            locationName: "Westfield"
          },
          {
            id: 53897,
            start: "2026-07-22T08:00:00+01:00",
            end: "2026-07-22T22:00:00+01:00",
            mealbreakDuration: 0,
            mealbreakSlots: [],
            duration: 14,
            cost: 0,
            area: 46,
            employee: 101,
            note: "PRINCE",
            isPublished: true,
            isOpen: false,
            confirmationStatus: "ROSTER_CONFIRMATION_NOT_REQUIRED",
            areaName: "Live in",
            location: 8,
            locationName: "Westfield"
          },
          {
            id: 53898,
            start: "2026-07-25T08:00:00+01:00",
            end: "2026-07-25T22:00:00+01:00",
            mealbreakDuration: 0,
            mealbreakSlots: [],
            duration: 14,
            cost: 0,
            area: 46,
            employee: 101,
            note: "PRINCE",
            isPublished: true,
            isOpen: false,
            confirmationStatus: "ROSTER_CONFIRMATION_NOT_REQUIRED",
            areaName: "Live in",
            location: 8,
            locationName: "Westfield"
          },
          {
            id: 53899,
            start: "2026-07-29T08:00:00+01:00",
            end: "2026-07-29T22:00:00+01:00",
            mealbreakDuration: 0,
            mealbreakSlots: [],
            duration: 14,
            cost: 0,
            area: 46,
            employee: 101,
            note: "PRINCE",
            isPublished: true,
            isOpen: false,
            confirmationStatus: "ROSTER_CONFIRMATION_NOT_REQUIRED",
            areaName: "Live in",
            location: 8,
            locationName: "Westfield"
          },
          // Another employee shift for testing filter
          {
            id: 53900,
            start: "2026-07-09T09:00:00+01:00",
            end: "2026-07-09T17:00:00+01:00",
            mealbreakDuration: 30,
            mealbreakSlots: [],
            duration: 7.5,
            cost: 0,
            area: 47,
            employee: 102,
            note: "SARAH",
            isPublished: true,
            isOpen: false,
            confirmationStatus: "ROSTER_CONFIRMATION_NOT_REQUIRED",
            areaName: "Day Duty",
            location: 8,
            locationName: "Westfield"
          }
        ]
      }
    };

    processAndRenderResponse(demoPayload);
    showToast('Loaded demo shifts matching Deputy payload structure. Filtered for Employee #101.', 'info');
  }

  // --- Start App on DOM Ready ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

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
    // Inputs change
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

    // Password visibility toggle
    elements.btnToggleTokenVisibility.addEventListener('click', () => {
      const isPassword = elements.bearerToken.type === 'password';
      elements.bearerToken.type = isPassword ? 'text' : 'password';
      elements.btnToggleTokenVisibility.style.color = isPassword ? 'var(--brand-primary)' : 'var(--text-tertiary)';
    });

    // Test Connection Button
    elements.btnTestConnection.addEventListener('click', () => testConnection());

    // Fetch Shifts Button
    elements.btnFetchShifts.addEventListener('click', () => fetchShiftsFromApi());

    // Import JSON Manual
    elements.btnImportJson.addEventListener('click', () => handleManualJsonImport());

    // Demo Mode Button
    elements.btnDemoMode.addEventListener('click', () => loadDemoData());

    // Export Buttons
    elements.btnExportExcel.addEventListener('click', () => exportToExcel());
    elements.btnExportCsv.addEventListener('click', () => exportToCsv());

    // Table Search Filter
    elements.tableSearch.addEventListener('input', () => applyTableFilters());

    // Member filter dropdown
    elements.memberFilterSelect.addEventListener('change', () => applyTableFilters());

    // Date Presets
    elements.presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.presetButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyDatePreset(btn.dataset.preset);
      });
    });

    // Table Headers Sorting
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

    // Modal Events
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
      // Endpoint /api/v1/me returns the logged-in user's profile
      const userProfile = await callDeputyApi('/api/v1/me');
      state.currentUser = userProfile;
      state.isDemo = false;
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(userProfile));

      displayUserProfile(userProfile);
      setConnectionStatus(true);
      showToast(`Connected as ${getDisplayName(userProfile)}`, 'success');
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
    return user.DisplayName || `${user.FirstName || ''} ${user.LastName || ''}`.trim() || user.Name || `Member #${user.Id}`;
  }

  function displayUserProfile(user) {
    if (!user) return;
    elements.userProfileCard.style.display = 'flex';
    const name = getDisplayName(user);
    elements.userDisplayName.textContent = name;
    elements.statRequesterName.textContent = name;

    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
    elements.userAvatarInitials.textContent = initials;

    const id = user.Id || user.EmployeeId || user.id || '--';
    elements.userMemberId.textContent = id;
    elements.userEmailMeta.innerHTML = `memberId: <strong>${id}</strong> &bull; ${user.Email || 'No email'}`;

    // Update filter options
    elements.memberFilterSelect.innerHTML = `
      <option value="auto">Auto (${name})</option>
      <option value="all">All Returned Members</option>
    `;
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
      // Construct Date Range in ISO-8601 with Timezone Offset
      const startInput = elements.startDate.value;
      const endInput = elements.endDate.value;

      if (!startInput || !endInput) {
        throw new Error('Please select both start and end dates.');
      }

      const startDateObj = new Date(startInput);
      const endDateObj = new Date(endInput);

      // Deputy Payload Format matching user prompt
      const payload = {
        data: {
          start: formatDateToIsoWithTz(startDateObj),
          end: formatDateToIsoWithTz(endDateObj),
          locationIds: [],
          locationMode: "ALL",
          expandMetadata: true
        }
      };

      // 1. Ensure we have profile to resolve requester name if not already cached
      if (!state.currentUser) {
        try {
          const profile = await callDeputyApi('/api/v1/me');
          state.currentUser = profile;
          displayUserProfile(profile);
          setConnectionStatus(true);
        } catch (_) {
          console.warn('Could not auto-fetch profile prior to shift search.');
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
      showToast('JSON imported successfully!', 'success');
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

    // Extract metadata if returned
    const metadata = data.metadata || (data.data && data.data.metadata) || {};
    if (metadata.members || metadata.employees || metadata.users) {
      const memberList = metadata.members || metadata.employees || metadata.users || [];
      memberList.forEach(m => {
        const id = String(m.id || m.Id || m.memberId);
        const name = m.displayName || m.DisplayName || `${m.firstName || m.FirstName || ''} ${m.lastName || m.LastName || ''}`.trim();
        if (id && name) state.membersMap.set(id, name);
      });
    }

    if (metadata.locations || metadata.operationalUnits) {
      const locList = metadata.locations || metadata.operationalUnits || [];
      locList.forEach(l => {
        const id = String(l.id || l.Id);
        const name = l.name || l.operationalUnitName || l.locationName;
        if (id && name) state.locationsMap.set(id, name);
      });
    }

    if (metadata.roles || metadata.positions) {
      const roleList = metadata.roles || metadata.positions || [];
      roleList.forEach(r => {
        const id = String(r.id || r.Id);
        const name = r.name || r.roleName || r.positionName;
        if (id && name) state.rolesMap.set(id, name);
      });
    }

    // Extract raw shifts array
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
    }

    // If current user is known, map their ID
    if (state.currentUser) {
      const uid = String(state.currentUser.Id || state.currentUser.id || state.currentUser.EmployeeId);
      state.membersMap.set(uid, getDisplayName(state.currentUser));
    }

    // Normalize each shift
    state.shifts = rawShifts.map(s => normalizeShift(s));

    // Populate dropdown with unique members
    populateMemberFilterDropdown();

    applyTableFilters();
  }

  function normalizeShift(raw) {
    // Start & End Timestamps
    const startStr = raw.startTime || raw.start || raw.intStart || raw.Start || raw.StartTime;
    const endStr = raw.endTime || raw.end || raw.intEnd || raw.End || raw.EndTime;

    const startDate = parseDeputyDate(startStr);
    const endDate = parseDeputyDate(endStr);

    // Member / Employee
    const memberId = String(raw.memberId || raw.employeeId || raw.employee || raw.userId || raw.Id || '');
    let memberName = raw.memberName || raw.employeeName || state.membersMap.get(memberId);
    
    if (!memberName) {
      if (state.currentUser && (memberId === String(state.currentUser.Id) || !memberId)) {
        memberName = getDisplayName(state.currentUser);
      } else {
        memberName = memberId ? `Member #${memberId}` : (state.currentUser ? getDisplayName(state.currentUser) : 'Me');
      }
    }

    // Meal break in minutes
    const mealBreakMins = Number(raw.mealbreakMinutes || raw.totalMealbreak || raw.mealbreak || raw.breakMinutes || 0);

    // Calculate total hours
    let totalHours = 0;
    if (raw.totalHours !== undefined) {
      totalHours = parseFloat(raw.totalHours);
    } else if (raw.duration !== undefined) {
      totalHours = parseFloat(raw.duration) / 3600;
    } else if (startDate && endDate) {
      const diffMs = endDate.getTime() - startDate.getTime();
      totalHours = Math.max(0, (diffMs / (1000 * 60 * 60)) - (mealBreakMins / 60));
    }

    // Role & Location
    const roleId = String(raw.roleId || raw.role || '');
    const roleName = raw.roleName || raw.positionName || state.rolesMap.get(roleId) || raw.role || 'Staff';

    const locationId = String(raw.operationalUnitId || raw.locationId || raw.companyId || '');
    const locationName = raw.operationalUnitName || raw.locationName || raw.companyName || state.locationsMap.get(locationId) || 'Main Site';

    // Status
    const rawStatus = raw.status || raw.publishStatus || raw.approvalState || 'Confirmed';
    let statusLabel = 'Confirmed';
    let statusClass = 'badge-confirmed';

    if (typeof rawStatus === 'string') {
      if (rawStatus.toLowerCase().includes('sched') || rawStatus.toLowerCase().includes('publish')) {
        statusLabel = 'Scheduled';
        statusClass = 'badge-scheduled';
      } else if (rawStatus.toLowerCase().includes('open')) {
        statusLabel = 'Open';
        statusClass = 'badge-open';
      } else if (rawStatus.toLowerCase().includes('draft')) {
        statusLabel = 'Draft';
        statusClass = 'badge-draft';
      }
    }

    return {
      raw,
      id: raw.id || raw.shiftId || Math.random().toString(36).substr(2, 9),
      startDate,
      endDate,
      memberId,
      memberName,
      roleName,
      locationName,
      mealBreakMins,
      totalHours: Number(totalHours.toFixed(2)),
      status: statusLabel,
      statusClass,
      notes: raw.notes || raw.comment || raw.strComment || ''
    };
  }

  function parseDeputyDate(val) {
    if (!val) return null;
    if (typeof val === 'number') {
      // Unix timestamp (seconds or milliseconds)
      return val > 10000000000 ? new Date(val) : new Date(val * 1000);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  function populateMemberFilterDropdown() {
    const currentVal = elements.memberFilterSelect.value;
    const uniqueMembers = new Map();

    state.shifts.forEach(s => {
      if (s.memberId && s.memberName) {
        uniqueMembers.set(s.memberId, s.memberName);
      }
    });

    let optionsHtml = '';
    const requesterName = state.currentUser ? getDisplayName(state.currentUser) : 'Authenticated Requester';
    optionsHtml += `<option value="auto">Auto (${requesterName})</option>`;
    optionsHtml += `<option value="all">All Members (${state.shifts.length} shifts)</option>`;

    uniqueMembers.forEach((name, id) => {
      optionsHtml += `<option value="${id}">${name} (ID: ${id})</option>`;
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
    const currentUserId = state.currentUser ? String(state.currentUser.Id || state.currentUser.id || '') : '';

    state.filteredShifts = state.shifts.filter(shift => {
      // Member Filter
      if (memberFilter === 'auto') {
        if (currentUserId && shift.memberId && shift.memberId !== currentUserId) {
          return false;
        }
      } else if (memberFilter !== 'all') {
        if (shift.memberId !== memberFilter) {
          return false;
        }
      }

      // Search Term Filter
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
      tbody.innerHTML = `
        <tr class="empty-state-row">
          <td colspan="10">
            <div class="empty-state">
              <div class="empty-icon">🔍</div>
              <h3>No matching shifts found</h3>
              <p>Try adjusting your search filter or date range above.</p>
            </div>
          </td>
        </tr>
      `;
      elements.btnExportExcel.disabled = true;
      elements.btnExportCsv.disabled = true;
      elements.filteredCountBadge.textContent = '0 shifts';
      elements.footerTotalHours.textContent = '0.00';
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
        <td><strong>${escapeHtml(s.memberName)}</strong></td>
        <td>${startStr}</td>
        <td>${endStr}</td>
        <td class="cell-hours">${s.totalHours.toFixed(2)}h</td>
        <td>${s.mealBreakMins} min</td>
        <td>${escapeHtml(s.roleName)}</td>
        <td>${escapeHtml(s.locationName)}</td>
        <td><span class="excel-badge ${s.statusClass}">${s.status}</span></td>
        <td>${escapeHtml(s.notes || '-')}</td>
      `;
      tbody.appendChild(tr);
    });

    // Update table header subtitle
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
      // 1. Prepare structured sheet rows
      const rows = state.filteredShifts.map(s => ({
        'Date': s.startDate ? s.startDate.toISOString().split('T')[0] : '',
        'Day': s.startDate ? s.startDate.toLocaleDateString(undefined, { weekday: 'long' }) : '',
        'Member Name': s.memberName,
        'Member ID': s.memberId,
        'Start Time': s.startDate ? s.startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '',
        'End Time': s.endDate ? s.endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '',
        'Break (Mins)': s.mealBreakMins,
        'Total Hours': s.totalHours,
        'Role / Position': s.roleName,
        'Location / Department': s.locationName,
        'Status': s.status,
        'Notes': s.notes
      }));

      // 2. Add summary row
      const totalHours = state.filteredShifts.reduce((sum, s) => sum + s.totalHours, 0);
      rows.push({
        'Date': 'TOTAL',
        'Day': '',
        'Member Name': '',
        'Member ID': '',
        'Start Time': '',
        'End Time': '',
        'Break (Mins)': '',
        'Total Hours': Number(totalHours.toFixed(2)),
        'Role / Position': '',
        'Location / Department': '',
        'Status': `${state.filteredShifts.length} Shifts`,
        'Notes': 'Generated via Deputy Schedule Exporter'
      });

      // 3. Create worksheet & workbook
      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Auto-fit column widths
      const colWidths = [
        { wch: 12 }, // Date
        { wch: 12 }, // Day
        { wch: 22 }, // Member Name
        { wch: 12 }, // Member ID
        { wch: 12 }, // Start Time
        { wch: 12 }, // End Time
        { wch: 12 }, // Break
        { wch: 12 }, // Total Hours
        { wch: 20 }, // Role
        { wch: 22 }, // Location
        { wch: 14 }, // Status
        { wch: 30 }  // Notes
      ];
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule');

      // 4. Generate dynamic filename
      const requester = (state.currentUser ? getDisplayName(state.currentUser) : 'Deputy_Schedule').replace(/[^a-zA-Z0-9_-]/g, '_');
      const startStr = elements.startDate.value.split('T')[0] || 'start';
      const endStr = elements.endDate.value.split('T')[0] || 'end';
      const filename = `${requester}_Schedule_${startStr}_to_${endStr}.xlsx`;

      // 5. Download file
      XLSX.writeFile(workbook, filename);
      showToast(`Exported ${filename} successfully!`, 'success');
    } catch (err) {
      console.error('Excel export failed:', err);
      showToast('Export failed: ' + err.message, 'error');
    }
  }

  function exportToCsv() {
    if (state.filteredShifts.length === 0) return;

    const headers = ['Date', 'Day', 'Member Name', 'Member ID', 'Start Time', 'End Time', 'Break (Mins)', 'Total Hours', 'Role', 'Location', 'Status', 'Notes'];
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
        `"${s.memberId}"`,
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
      Id: 1042,
      DisplayName: 'Aravind S (Deputy User)',
      FirstName: 'Aravind',
      LastName: 'S',
      Email: 'aravind@example.com',
      Role: 'Team Member'
    };

    displayUserProfile(state.currentUser);
    setConnectionStatus(true);

    // Realistic July 2026 Shift Schedule (UK Timezone)
    const demoPayload = {
      metadata: {
        members: [
          { id: 1042, displayName: 'Aravind S (Deputy User)' }
        ],
        locations: [
          { id: 1, name: 'London Central Hub' },
          { id: 2, name: 'Westminster Office' }
        ],
        roles: [
          { id: 101, name: 'Senior Specialist' },
          { id: 102, name: 'Shift Coordinator' }
        ]
      },
      data: {
        shifts: [
          { id: 501, memberId: 1042, roleId: 101, operationalUnitId: 1, start: '2026-07-02T09:00:00+01:00', end: '2026-07-02T17:30:00+01:00', mealbreakMinutes: 30, status: 'Confirmed', notes: 'Main shift assignment' },
          { id: 502, memberId: 1042, roleId: 101, operationalUnitId: 1, start: '2026-07-03T09:00:00+01:00', end: '2026-07-03T17:30:00+01:00', mealbreakMinutes: 30, status: 'Confirmed', notes: 'Standard duty' },
          { id: 503, memberId: 1042, roleId: 102, operationalUnitId: 2, start: '2026-07-06T08:30:00+01:00', end: '2026-07-06T17:00:00+01:00', mealbreakMinutes: 30, status: 'Scheduled', notes: 'Opening coordinator' },
          { id: 504, memberId: 1042, roleId: 101, operationalUnitId: 1, start: '2026-07-08T09:00:00+01:00', end: '2026-07-08T17:30:00+01:00', mealbreakMinutes: 30, status: 'Confirmed', notes: '' },
          { id: 505, memberId: 1042, roleId: 101, operationalUnitId: 1, start: '2026-07-10T09:00:00+01:00', end: '2026-07-10T17:30:00+01:00', mealbreakMinutes: 30, status: 'Confirmed', notes: 'Team sprint check-in' },
          { id: 506, memberId: 1042, roleId: 102, operationalUnitId: 2, start: '2026-07-14T09:00:00+01:00', end: '2026-07-14T17:30:00+01:00', mealbreakMinutes: 30, status: 'Confirmed', notes: '' },
          { id: 507, memberId: 1042, roleId: 101, operationalUnitId: 1, start: '2026-07-16T10:00:00+01:00', end: '2026-07-16T18:30:00+01:00', mealbreakMinutes: 30, status: 'Confirmed', notes: 'Late afternoon coverage' },
          { id: 508, memberId: 1042, roleId: 101, operationalUnitId: 1, start: '2026-07-20T09:00:00+01:00', end: '2026-07-20T17:30:00+01:00', mealbreakMinutes: 30, status: 'Confirmed', notes: '' },
          { id: 509, memberId: 1042, roleId: 101, operationalUnitId: 1, start: '2026-07-22T09:00:00+01:00', end: '2026-07-22T17:30:00+01:00', mealbreakMinutes: 30, status: 'Confirmed', notes: '' },
          { id: 510, memberId: 1042, roleId: 102, operationalUnitId: 2, start: '2026-07-27T08:30:00+01:00', end: '2026-07-27T17:00:00+01:00', mealbreakMinutes: 30, status: 'Scheduled', notes: 'Monthly schedule wrap-up' },
          { id: 511, memberId: 1042, roleId: 101, operationalUnitId: 1, start: '2026-07-29T09:00:00+01:00', end: '2026-07-29T17:30:00+01:00', mealbreakMinutes: 30, status: 'Confirmed', notes: '' },
          { id: 512, memberId: 1042, roleId: 101, operationalUnitId: 1, start: '2026-07-31T09:00:00+01:00', end: '2026-07-31T17:00:00+01:00', mealbreakMinutes: 30, status: 'Confirmed', notes: 'Month end handover' }
        ]
      }
    };

    processAndRenderResponse(demoPayload);
    showToast('Loaded demo shifts for July 2026. Ready to export to Excel!', 'info');
  }

  // --- Start App on DOM Ready ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

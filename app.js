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
    PROFILE: 'deputy_cached_profile',
    EMAIL: 'deputy_user_email'
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

  // --- Helper to safely get element ---
  const $ = (id) => document.getElementById(id);

  // --- Initialization ---
  function init() {
    console.log('[Deputy App] Initializing...');
    loadSettings();
    applyDatePreset('this-month'); // Default to current month dynamically
    bindEvents();
    updateModalLinks();
    setupBookmarklet();
    checkUrlHashData();
  }

  // --- 1-Click Bookmarklet Setup ---
  function setupBookmarklet() {
    const bookmarkBtn = $('bookmarklet-btn');
    if (!bookmarkBtn) return;

    const now = new Date();
    const curYearMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    const bookmarkletCode = `javascript:(async function(){
      try {
        if (!window.location.host.includes('deputy.com')) {
          alert('Please click this bookmark while on your Deputy tab (e.g. a2c28219075424.uk.deputy.com)');
          return;
        }
        
        var defaultMonth = "${curYearMonth}";
        var userMonth = prompt("Enter Month to export (YYYY-MM):", defaultMonth);
        if (!userMonth) return;
        
        var parts = userMonth.split("-");
        var y = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10);
        if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
          alert("Invalid month format. Please use YYYY-MM (e.g. 2026-08)");
          return;
        }
        
        var lastDay = new Date(y, m, 0).getDate();
        var pad = function(n){ return String(n).padStart(2, '0'); };
        var start = y + "-" + pad(m) + "-01T00:00:00+01:00";
        var end = y + "-" + pad(m) + "-" + pad(lastDay) + "T23:59:59+01:00";
        
        var banner = document.createElement('div');
        banner.style = 'position:fixed;top:20px;right:20px;z-index:999999;background:#065f46;color:#ffffff;padding:16px 22px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.35);font-family:sans-serif;font-size:14px;border:2px solid #34d399;';
        banner.innerHTML = '<strong>⏳ Deputy Exporter:</strong> Fetching schedule for ' + userMonth + '...';
        document.body.appendChild(banner);
        
        var meData = null;
        try {
          var meResp = await fetch('/api/v1/me');
          if (meResp.ok) meData = await meResp.json();
        } catch(e) {}
        
        var payload = {
          data: { start: start, end: end, locationIds: [], locationMode: 'ALL', expandMetadata: true }
        };
        
        var shiftsResp = await fetch('/api/schedule/v2/me/shifts:search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (!shiftsResp.ok) throw new Error('HTTP ' + shiftsResp.status + ' fetching shifts');
        var shiftsData = await shiftsResp.json();
        
        banner.innerHTML = '<strong>✅ ' + userMonth + ' Schedule retrieved!</strong> Opening Excel Viewer...';
        
        var fullPayload = { me: meData, shifts: shiftsData, queryStart: start, queryEnd: end };
        var jsonStr = JSON.stringify(fullPayload);
        
        var viewerUrl = 'https://aravinds257.github.io/deputy-schedule-watcher/#import=' + encodeURIComponent(jsonStr);
        var win = window.open(viewerUrl, '_blank');
        
        setTimeout(function(){ banner.remove(); }, 2000);
      } catch(err) {
        alert('Deputy Exporter Error: ' + err.message);
      }
    })();`.replace(/\s+/g, ' ');

    bookmarkBtn.setAttribute('href', bookmarkletCode);
  }

  // --- Auto-Import from URL Hash (and clean hash to prevent persistence) ---
  function checkUrlHashData() {
    if (window.location.hash && window.location.hash.includes('import=')) {
      try {
        const rawParam = window.location.hash.split('import=')[1];
        if (rawParam) {
          const decoded = decodeURIComponent(rawParam);
          const data = JSON.parse(decoded);
          console.log('[Deputy App] Auto-imported data from bookmarklet hash:', data);
          
          if (data.me) {
            state.currentUser = data.me;
            displayUserProfile(data.me);
            setConnectionStatus(true);
          }
          
          if (data.queryStart && data.queryEnd) {
            if ($('start-date')) $('start-date').value = data.queryStart.slice(0, 16);
            if ($('end-date')) $('end-date').value = data.queryEnd.slice(0, 16);
          }

          if (data.shifts) {
            processAndRenderResponse(data.shifts);
            showToast('Schedule imported from Deputy! Ready to export Excel.', 'success');
          }

          // Crucial: Clear hash from address bar so page refresh does not re-import old data!
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        }
      } catch (e) {
        console.warn('Hash import error:', e);
      }
    }

    // Also listen for postMessage
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'DEPUTY_IMPORTED_DATA' && event.data.payload) {
        const p = event.data.payload;
        if (p.me) {
          state.currentUser = p.me;
          displayUserProfile(p.me);
          setConnectionStatus(true);
        }
        if (p.queryStart && p.queryEnd) {
          if ($('start-date')) $('start-date').value = p.queryStart.slice(0, 16);
          if ($('end-date')) $('end-date').value = p.queryEnd.slice(0, 16);
        }
        if (p.shifts) {
          processAndRenderResponse(p.shifts);
          showToast('Schedule loaded via 1-Click Bookmarklet!', 'success');
        }
      }
    });
  }

  // --- Settings & Persistence ---
  function loadSettings() {
    try {
      const savedInstance = localStorage.getItem(STORAGE_KEYS.INSTANCE);
      if (savedInstance) {
        state.instance = savedInstance;
        if ($('deputy-instance')) $('deputy-instance').value = savedInstance;
        if ($('login-instance')) $('login-instance').value = savedInstance;
      }

      const savedEmail = localStorage.getItem(STORAGE_KEYS.EMAIL);
      if (savedEmail && $('login-email')) {
        $('login-email').value = savedEmail;
      }

      const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (savedToken) {
        state.token = savedToken;
        if ($('bearer-token')) $('bearer-token').value = savedToken;
      }

      const savedProxy = localStorage.getItem(STORAGE_KEYS.CORS_PROXY);
      if (savedProxy !== null) {
        state.useProxy = savedProxy === 'true';
        if ($('cors-proxy-toggle')) $('cors-proxy-toggle').checked = state.useProxy;
      }

      const savedCustomProxy = localStorage.getItem(STORAGE_KEYS.CUSTOM_PROXY);
      if (savedCustomProxy && $('custom-proxy-url')) {
        state.proxyUrl = savedCustomProxy;
        $('custom-proxy-url').value = savedCustomProxy;
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
    } catch (err) {
      console.warn('LocalStorage error:', err);
    }
  }

  function saveSettings() {
    try {
      const inst = (($('deputy-instance')?.value || $('login-instance')?.value) || state.instance).trim();
      localStorage.setItem(STORAGE_KEYS.INSTANCE, inst);
      if ($('login-email')) localStorage.setItem(STORAGE_KEYS.EMAIL, $('login-email').value.trim());
      if ($('bearer-token')) localStorage.setItem(STORAGE_KEYS.TOKEN, $('bearer-token').value.trim());
      if ($('cors-proxy-toggle')) localStorage.setItem(STORAGE_KEYS.CORS_PROXY, $('cors-proxy-toggle').checked);
      if ($('custom-proxy-url')) localStorage.setItem(STORAGE_KEYS.CUSTOM_PROXY, $('custom-proxy-url').value.trim());
    } catch (e) {
      console.warn('Error saving settings:', e);
    }
  }

  // --- UI Event Handlers ---
  function bindEvents() {
    const loginInst = $('login-instance');
    const depInst = $('deputy-instance');
    const emailInput = $('login-email');
    const tokenInput = $('bearer-token');
    const proxyToggle = $('cors-proxy-toggle');
    const searchInput = $('table-search');
    const memberSelect = $('member-filter-select');

    if (loginInst) {
      loginInst.addEventListener('input', () => {
        if (depInst) depInst.value = loginInst.value;
        state.instance = loginInst.value.trim();
        saveSettings();
        updateModalLinks();
      });
    }

    if (depInst) {
      depInst.addEventListener('input', () => {
        if (loginInst) loginInst.value = depInst.value;
        state.instance = depInst.value.trim();
        saveSettings();
        updateModalLinks();
      });
    }

    if (emailInput) emailInput.addEventListener('input', saveSettings);
    if (tokenInput) {
      tokenInput.addEventListener('input', () => {
        state.token = tokenInput.value.trim();
        saveSettings();
      });
    }

    if (proxyToggle) {
      proxyToggle.addEventListener('change', () => {
        state.useProxy = proxyToggle.checked;
        saveSettings();
      });
    }

    if (searchInput) searchInput.addEventListener('input', () => applyTableFilters());
    if (memberSelect) memberSelect.addEventListener('change', () => applyTableFilters());

    document.querySelectorAll('.btn-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyDatePreset(btn.dataset.preset);
      });
    });

    const table = $('shifts-table');
    if (table) {
      table.querySelectorAll('th[data-sort]').forEach(th => {
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
    }
  }

  // --- Exposed Window Functions ---
  window.switchAuthTab = function(tab) {
    const tabLogin = $('tab-btn-login');
    const tabToken = $('tab-btn-token');
    const tabSession = $('tab-btn-session');

    const formLogin = $('login-auth-form');
    const formToken = $('token-auth-form');
    const viewSession = $('session-helper-view');

    if (tabLogin) tabLogin.classList.toggle('active', tab === 'login');
    if (tabToken) tabToken.classList.toggle('active', tab === 'token');
    if (tabSession) tabSession.classList.toggle('active', tab === 'session');

    if (formLogin) formLogin.style.display = tab === 'login' ? 'flex' : 'none';
    if (formToken) formToken.style.display = tab === 'token' ? 'flex' : 'none';
    if (viewSession) viewSession.style.display = tab === 'session' ? 'block' : 'none';
  };

  window.toggleLoginPassword = function() {
    const input = $('login-password');
    const iconBtn = $('btn-toggle-login-pass');
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    if (iconBtn) iconBtn.style.color = isPass ? 'var(--brand-primary)' : 'var(--text-tertiary)';
  };

  window.toggleTokenPassword = function() {
    const input = $('bearer-token');
    const iconBtn = $('btn-toggle-token-visibility');
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    if (iconBtn) iconBtn.style.color = isPass ? 'var(--brand-primary)' : 'var(--text-tertiary)';
  };

  window.openTokenModal = function() {
    if ($('modal-token-guide')) $('modal-token-guide').style.display = 'flex';
  };

  window.closeTokenModal = function() {
    if ($('modal-token-guide')) $('modal-token-guide').style.display = 'none';
  };

  window.handleDeputyLoginClick = function() {
    handleDeputyLogin();
  };

  window.testConnectionClick = function() {
    testConnection();
  };

  window.fetchShiftsClick = function() {
    fetchShiftsFromApi();
  };

  window.importJsonClick = function() {
    handleManualJsonImport();
  };

  window.loadDemoClick = function() {
    loadDemoData();
  };

  window.exportExcelClick = function() {
    exportToExcel();
  };

  window.exportCsvClick = function() {
    exportToCsv();
  };

  function updateModalLinks() {
    const rawInstance = cleanInstanceUrl($('deputy-instance')?.value || $('login-instance')?.value || 'a2c28219075424.uk.deputy.com');
    if ($('modal-dev-link')) {
      $('modal-dev-link').textContent = `https://${rawInstance}/exec/devapp/oauth_clients`;
    }
  }

  function cleanInstanceUrl(input) {
    if (!input) return 'a2c28219075424.uk.deputy.com';
    return input.replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim();
  }

  // --- Toast Notifications ---
  function showToast(message, type = 'info') {
    const toast = $('toast');
    if (!toast) return;
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    toast.style.display = 'flex';

    setTimeout(() => {
      toast.style.display = 'none';
    }, 4500);
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
      if ($('start-date')) $('start-date').value = start;
      if ($('end-date')) $('end-date').value = end;
    }
  }

  // --- API Client Layer ---
  function buildApiUrl(targetFullUrl) {
    const isProxy = $('cors-proxy-toggle') ? $('cors-proxy-toggle').checked : state.useProxy;
    if (isProxy) {
      const proxyBase = ($('custom-proxy-url')?.value || '').trim() || DEFAULT_PROXY;
      return `${proxyBase}${encodeURIComponent(targetFullUrl)}`;
    }
    return targetFullUrl;
  }

  function getBaseInstanceUrl() {
    const raw = $('deputy-instance')?.value || $('login-instance')?.value || state.instance;
    return `https://${cleanInstanceUrl(raw)}`;
  }

  async function callDeputyApi(endpointPath, options = {}) {
    const token = ($('bearer-token')?.value || state.token || '').trim();
    if (!token) {
      throw new Error('Please enter your Deputy Bearer Token first or use the 1-Click Bookmarklet above.');
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const targetUrl = `${getBaseInstanceUrl()}${endpointPath}`;
    const url = buildApiUrl(targetUrl);

    console.log('[Deputy API Request]', url);

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson.error || errorJson.message || errorJson.error_description) {
          errorDetails += ` - ${errorJson.error || errorJson.message || errorJson.error_description}`;
        }
      } catch (_) {}
      throw new Error(errorDetails);
    }

    return await response.json();
  }

  // --- Deputy Direct Login (Fallback) ---
  async function handleDeputyLogin() {
    const username = ($('login-email')?.value || '').trim();
    const password = $('login-password')?.value || '';
    const instance = cleanInstanceUrl($('login-instance')?.value || state.instance);

    if (!username || !password) {
      showToast('Please enter your Deputy email and password.', 'error');
      return;
    }

    const btn = $('btn-do-login');
    const origText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'Connecting to Deputy...';
    }

    try {
      saveSettings();

      const candidateEndpoints = [
        {
          url: 'https://once.deputy.com/api/v1/auth/login',
          options: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ username, password })
          }
        },
        {
          url: `https://${instance}/api/v1/auth/login`,
          options: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ username, password })
          }
        }
      ];

      let foundToken = null;

      for (const attempt of candidateEndpoints) {
        try {
          const proxiedUrl = buildApiUrl(attempt.url);
          const resp = await fetch(proxiedUrl, attempt.options);
          if (resp.ok) {
            const data = await resp.json().catch(() => null);
            if (data) {
              foundToken = data.access_token ||
                           data.token ||
                           data.dp_token ||
                           (data.data && (data.data.access_token || data.data.token));
              if (foundToken) break;
            }
          }
        } catch (e) {
          console.warn('Login attempt error:', e);
        }
      }

      if (foundToken) {
        state.token = foundToken;
        if ($('bearer-token')) $('bearer-token').value = foundToken;
        saveSettings();
        showToast('Login successful! Bearer token retrieved.', 'success');
        await testConnection();
      } else {
        throw new Error('Deputy requires MFA/session cookie. Please use the 1-Click Bookmarklet button at the top!');
      }
    } catch (err) {
      console.error('Login process error:', err);
      showToast(err.message, 'error');
      window.switchAuthTab('token');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    }
  }

  // --- Connection & Profile Testing ---
  async function testConnection() {
    const btn = $('btn-test-connection');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'Connecting to Deputy...';
    }

    try {
      const userProfile = await callDeputyApi('/api/v1/me');
      state.currentUser = userProfile;
      state.isDemo = false;
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(userProfile));

      displayUserProfile(userProfile);
      setConnectionStatus(true);
      showToast(`Connected as ${getDisplayName(userProfile)}`, 'success');

      if (state.shifts.length > 0) {
        populateMemberFilterDropdown();
        applyTableFilters();
      }
    } catch (err) {
      console.error('Connection test failed:', err);
      setConnectionStatus(false);
      showToast(err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
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
    const card = $('user-profile-card');
    if (card) card.style.display = 'flex';
    const name = getDisplayName(user);
    if ($('user-display-name')) $('user-display-name').textContent = name;
    if ($('stat-requester-name')) $('stat-requester-name').textContent = name;

    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
    if ($('user-avatar-initials')) $('user-avatar-initials').textContent = initials;

    const id = user.Employee || user.EmployeeId || user.Id || user.id || user.memberId || '--';
    if ($('user-member-id')) $('user-member-id').textContent = id;
    if ($('user-email-meta')) {
      $('user-email-meta').innerHTML = `Employee/Member ID: <strong>${id}</strong> &bull; ${user.Email || user.email || 'No email'}`;
    }
  }

  function setConnectionStatus(connected) {
    const pill = $('connection-status-pill');
    if (!pill) return;
    if (connected) {
      pill.className = 'status-pill status-connected';
      pill.textContent = 'Connected';
    } else {
      pill.className = 'status-pill status-disconnected';
      pill.textContent = 'Disconnected';
    }
  }

  // --- Shift Fetching & Payload Construction ---
  async function fetchShiftsFromApi() {
    const btn = $('btn-fetch-shifts');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'Fetching shifts...';
    }

    try {
      const startInput = $('start-date')?.value;
      const endInput = $('end-date')?.value;

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

      console.log('[Deputy Shifts Search Payload]', payload);

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
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
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
    const raw = ($('manual-json-input')?.value || '').trim();
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

    const metadata = data.metadata || (data.data && data.data.metadata) || {};
    
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
      rawShifts = [data];
    }

    if (state.currentUser) {
      ['Id', 'id', 'Employee', 'employee', 'EmployeeId', 'employeeId', 'UserId', 'userId'].forEach(key => {
        if (state.currentUser[key]) {
          state.membersMap.set(String(state.currentUser[key]), getDisplayName(state.currentUser));
        }
      });
    }

    state.shifts = rawShifts.map(s => normalizeShift(s));

    populateMemberFilterDropdown();
    applyTableFilters();
  }

  function normalizeShift(raw) {
    const startStr = raw.start || raw.startTime || raw.intStart || raw.Start || raw.StartTime;
    const endStr = raw.end || raw.endTime || raw.intEnd || raw.End || raw.EndTime;

    const startDate = parseDeputyDate(startStr);
    const endDate = parseDeputyDate(endStr);

    const employeeId = String(raw.employee ?? raw.memberId ?? raw.employeeId ?? raw.userId ?? raw.member ?? '');
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

    if (!memberName) {
      if (noteText && noteText.trim().length > 0 && noteText.trim().length <= 25 && !noteText.includes('\n')) {
        memberName = noteText.trim();
      } else if (employeeId) {
        memberName = `Employee #${employeeId}`;
      } else {
        memberName = state.currentUser ? getDisplayName(state.currentUser) : 'Requester';
      }
    }

    if (employeeId && memberName && !state.membersMap.has(employeeId)) {
      state.membersMap.set(employeeId, memberName);
    }

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

    let totalHours = 0;
    if (startDate && endDate) {
      const diffMs = endDate.getTime() - startDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const breakHours = mealBreakMins > 0 ? (mealBreakMins / 60) : 0;
      totalHours = Math.max(0, diffHours - breakHours);
    } else if (raw.duration !== undefined && raw.duration !== null) {
      const d = parseFloat(raw.duration);
      totalHours = d > 100 ? (d / 3600) : d;
    }

    const areaId = String(raw.area ?? raw.roleId ?? raw.role ?? '');
    const roleName = raw.areaName || raw.roleName || raw.positionName || state.rolesMap.get(areaId) || (areaId ? `Area #${areaId}` : 'Shift');

    const locationId = String(raw.location ?? raw.operationalUnitId ?? raw.companyId ?? '');
    const locationName = raw.locationName || raw.operationalUnitName || raw.companyName || state.locationsMap.get(locationId) || (locationId ? `Location #${locationId}` : 'Main Site');

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
    const memberSelect = $('member-filter-select');
    if (!memberSelect) return;

    const currentVal = memberSelect.value;
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

    memberSelect.innerHTML = optionsHtml;
    
    if (currentVal && Array.from(memberSelect.options).some(o => o.value === currentVal)) {
      memberSelect.value = currentVal;
    }
  }

  // --- Filtering & Sorting ---
  function applyTableFilters() {
    const searchTerm = ($('table-search')?.value || '').toLowerCase().trim();
    const memberFilter = $('member-filter-select')?.value || 'auto';

    const currentUserKeys = [];
    if (state.currentUser) {
      ['Employee', 'EmployeeId', 'employee', 'employeeId', 'Id', 'id', 'UserId', 'userId', 'memberId'].forEach(k => {
        if (state.currentUser[k] !== undefined && state.currentUser[k] !== null) {
          currentUserKeys.push(String(state.currentUser[k]));
        }
      });
    }

    state.filteredShifts = state.shifts.filter(shift => {
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
    const tbody = $('shifts-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    const btnExcel = $('btn-export-excel');
    const btnCsv = $('btn-export-csv');
    const countBadge = $('filtered-count-badge');
    const footHours = $('footer-total-hours');

    if (state.filteredShifts.length === 0) {
      const totalRaw = state.shifts.length;
      tbody.innerHTML = `
        <tr class="empty-state-row">
          <td colspan="10">
            <div class="empty-state">
              <div class="empty-icon">🔍</div>
              <h3>${totalRaw > 0 ? 'No shifts match current filter' : 'No schedule data loaded'}</h3>
              <p>${totalRaw > 0 ? 'Try changing the "Filter by Employee" dropdown to "All Shifts".' : 'Click "Fetch Schedules from Deputy" or use the 1-Click Bookmarklet above.'}</p>
            </div>
          </td>
        </tr>
      `;
      if (btnExcel) btnExcel.disabled = true;
      if (btnCsv) btnCsv.disabled = true;
      if (countBadge) countBadge.textContent = '0 shifts';
      if (footHours) footHours.textContent = '0.00 hrs';
      return;
    }

    if (btnExcel) btnExcel.disabled = false;
    if (btnCsv) btnCsv.disabled = false;
    if (countBadge) countBadge.textContent = `${state.filteredShifts.length} shift${state.filteredShifts.length === 1 ? '' : 's'}`;

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

    const startRange = $('start-date')?.value ? $('start-date').value.split('T')[0] : '';
    const endRange = $('end-date')?.value ? $('end-date').value.split('T')[0] : '';
    if ($('table-subtitle')) {
      $('table-subtitle').textContent = `Displaying ${state.filteredShifts.length} shifts between ${startRange} and ${endRange}`;
    }
  }

  function updateStats() {
    const count = state.filteredShifts.length;
    const totalHours = state.filteredShifts.reduce((acc, s) => acc + s.totalHours, 0);

    if ($('stat-total-shifts')) $('stat-total-shifts').textContent = count;
    if ($('stat-total-hours')) $('stat-total-hours').textContent = `${totalHours.toFixed(2)} hrs`;
    if ($('footer-total-hours')) $('footer-total-hours').textContent = `${totalHours.toFixed(2)} hrs`;

    if (state.currentUser) {
      if ($('stat-requester-name')) $('stat-requester-name').textContent = getDisplayName(state.currentUser);
    } else if (state.filteredShifts.length > 0) {
      if ($('stat-requester-name')) $('stat-requester-name').textContent = state.filteredShifts[0].memberName;
    } else {
      if ($('stat-requester-name')) $('stat-requester-name').textContent = 'Not loaded';
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
      const startStr = $('start-date')?.value ? $('start-date').value.split('T')[0] : 'start';
      const endStr = $('end-date')?.value ? $('end-date').value.split('T')[0] : 'end';
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

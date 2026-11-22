import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api';

const AuthContext = createContext({
  user: null,
  account: null,
  isAuthenticated: false,
  isConnected: false,
  isLoading: true,
  isSyncing: false,
  lastSyncedAt: null,
  syncStatus: null,
  authNotification: null,
  serverStatus: null,
  checkAuthStatus: () => {},
  triggerSync: () => {},
  connectGmail: () => {},
  logout: () => {},
  disconnectAccount: () => {},
  deleteAccountData: () => {},
  clearAuthNotification: () => {}
});

const ALLOWED_BATCH_SIZES = [20, 50, 100, 200];
const DEFAULT_BATCH_SIZE = 50;

function getInitialBatchSize() {
  const cached = localStorage.getItem('mailmind_sync_batch_size');
  const num = Number(cached);
  if (ALLOWED_BATCH_SIZES.includes(num)) return num;
  return DEFAULT_BATCH_SIZE;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncBatchSize, setSyncBatchSize] = useState(getInitialBatchSize);
  const [authNotification, setAuthNotification] = useState(null);
  const [serverStatus, setServerStatus] = useState(null);

  // Check URL params for OAuth redirect feedback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authSuccess = urlParams.get('auth');
    const authAccount = urlParams.get('account');
    const authError = urlParams.get('auth_error');

    if (authSuccess === 'success') {
      setAuthNotification({
        type: 'success',
        message: authAccount 
          ? `Successfully connected Gmail account: ${authAccount}` 
          : 'Google OAuth connection successful! Welcome to MailMind AI.'
      });
      window.history.replaceState({}, document.title, window.location.pathname);
      checkAuthStatus();
    } else if (authError) {
      setAuthNotification({
        type: 'error',
        message: decodeURIComponent(authError)
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Listen for unauthorized events across the entire application
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setAuthNotification({
        type: 'info',
        message: 'Your session has expired. Please connect your Gmail account to continue.'
      });
    };

    window.addEventListener('mailmind:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('mailmind:unauthorized', handleUnauthorized);
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      // 1. Health check
      const healthRes = await apiFetch('/api/health');
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setServerStatus(healthData);
      }

      // 2. Fetch authenticated user profile
      const meRes = await apiFetch('/api/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.authenticated && meData.user) {
          setUser(meData.user);
          if (meData.user.settings?.syncBatchSize) {
            setSyncBatchSize(meData.user.settings.syncBatchSize);
            localStorage.setItem('mailmind_sync_batch_size', String(meData.user.settings.syncBatchSize));
          }
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn('[MAILMIND] Server check error:', err.message);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Updates batch size in state, localStorage, and user_settings in database
  const updateSyncBatchSize = async (newSize) => {
    const sizeNum = Number(newSize);
    if (!ALLOWED_BATCH_SIZES.includes(sizeNum)) return;
    setSyncBatchSize(sizeNum);
    localStorage.setItem('mailmind_sync_batch_size', String(sizeNum));

    try {
      await apiFetch('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({ syncBatchSize: sizeNum })
      });
    } catch (err) {
      console.warn('[MAILMIND] Failed to persist sync batch size to server:', err.message);
    }
  };

  // Triggers live sync for authenticated user
  const triggerSync = async (options = {}) => {
    if (!user) return;
    const batchSizeToUse = options.batchSize || options.maxResults || syncBatchSize;
    setIsSyncing(true);
    setSyncStatus({ state: 'syncing', message: `Syncing latest ${batchSizeToUse} emails with Gmail...` });

    const safetyTimer = setTimeout(() => {
      setIsSyncing(false);
      checkAuthStatus();
    }, 120000);

    try {
      const res = await apiFetch('/api/emails/sync', {
        method: 'POST',
        body: JSON.stringify({
          ...options,
          batchSize: batchSizeToUse,
          maxResults: batchSizeToUse
        })
      });
      clearTimeout(safetyTimer);

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.code === 'TOKEN_EXPIRED') {
          setAuthNotification({
            type: 'error',
            message: 'Your Google session has expired or was revoked. Please reconnect your account.'
          });
          setSyncStatus({ state: 'error', message: 'Token expired. Reconnection required.' });
        } else {
          setSyncStatus({ state: 'error', message: data.error || 'Sync failed.' });
        }
        return data;
      }

      const summaryMessage = data.requestedBatchSize !== undefined
        ? `Requested ${data.usedBatchSize} · Fetched ${data.fetchedNew ?? data.newEmailsCount} new · ${data.alreadyHad ?? data.skippedDuplicates ?? 0} already synced · ${data.failed ?? 0} failed`
        : `Live sync complete: ${data.newEmailsCount} new emails, ${data.skippedDuplicates || 0} duplicates skipped.`;

      setSyncStatus({
        state: 'success',
        message: summaryMessage,
        newCount: data.fetchedNew ?? data.newEmailsCount,
        summary: data,
        lastSyncedAt: data.lastSyncedAt || new Date().toISOString()
      });

      await checkAuthStatus();
      return data;
    } catch (err) {
      console.error('[Sync Error]', err);
      setSyncStatus({ state: 'error', message: err.message || 'Network error during sync.' });
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Initiates Google OAuth consent flow
  const connectGmail = async () => {
    try {
      const res = await apiFetch('/api/auth/url');
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Google OAuth credentials not configured on backend.');
      }

      window.location.href = data.url;
    } catch (err) {
      setAuthNotification({
        type: 'error',
        message: err.message
      });
      throw err;
    }
  };

  // Logs out user
  const logout = async () => {
    try {
      setIsLoading(true);
      await apiFetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setSyncStatus(null);
      setAuthNotification({
        type: 'info',
        message: 'You have been logged out successfully.'
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Permanently deletes all user emails, tasks, drafts, logs and revokes token
  const deleteAccountData = async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch('/api/auth/me', { method: 'DELETE' });
      const data = await res.json();
      setUser(null);
      setSyncStatus(null);
      setAuthNotification({
        type: 'info',
        message: data.message || 'All user data and Google access have been permanently removed.'
      });
    } catch (err) {
      console.error('Delete user data failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuthNotification = () => {
    setAuthNotification(null);
  };

  const isAuthenticated = Boolean(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        account: user, // Alias for backward compatibility
        isAuthenticated,
        isConnected: isAuthenticated,
        isLoading,
        isSyncing,
        syncBatchSize,
        updateSyncBatchSize,
        allowedBatchSizes: ALLOWED_BATCH_SIZES,
        lastSyncedAt: user?.last_sync_at || syncStatus?.lastSyncedAt || null,
        syncStatus,
        authNotification,
        serverStatus,
        checkAuthStatus,
        triggerSync,
        connectGmail,
        logout,
        disconnectAccount: deleteAccountData, // Alias
        deleteAccountData,
        clearAuthNotification
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext({
  account: null,
  isConnected: false,
  isDemoMode: false,
  isLiveMode: false,
  isLoading: true,
  isSyncing: false,
  lastSyncedAt: null,
  syncStatus: null,
  authNotification: null,
  serverStatus: null,
  checkAuthStatus: () => {},
  triggerSync: () => {},
  connectGmail: () => {},
  disconnectAccount: () => {},
  clearAuthNotification: () => {}
});

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
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
          ? `Successfully connected live Gmail account: ${authAccount}` 
          : 'Google OAuth connection successful! Live synchronization ready.'
      });
      // Clean query parameters from URL without reloading
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

  const checkAuthStatus = useCallback(async () => {
    try {
      // 1. Health check
      const healthRes = await fetch('/api/health');
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setServerStatus(healthData);
      }

      // 2. Account auth status
      const authRes = await fetch('/api/auth/status');
      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.success && authData.account) {
          setAccount(authData.account);
        } else {
          setAccount(null);
        }
      }
    } catch (err) {
      console.warn('[MAILMIND] Server offline or not reachable:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Triggers live sync (latest 20 emails)
  const triggerSync = async (options = {}) => {
    setIsSyncing(true);
    setSyncStatus({ state: 'syncing', message: 'Syncing inbox with Gmail...' });

    // Safety timeout prevents UI spinner from hanging indefinitely (60s threshold for large batches)
    const safetyTimer = setTimeout(() => {
      setIsSyncing(false);
      checkAuthStatus();
    }, 60000);

    try {
      const res = await fetch('/api/emails/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
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

      setSyncStatus({
        state: 'success',
        message: data.mode === 'LIVE'
          ? `Live sync complete: ${data.newEmailsCount} new emails, ${data.skippedDuplicates || 0} duplicates skipped.`
          : 'Demo inbox refreshed.',
        newCount: data.newEmailsCount,
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
      const res = await fetch('/api/auth/url');
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Google OAuth credentials not configured on backend.');
      }

      // Redirect user to Google authorization consent screen
      window.location.href = data.url;
    } catch (err) {
      setAuthNotification({
        type: 'error',
        message: err.message
      });
      throw err;
    }
  };

  // Disconnects active account
  const disconnectAccount = async () => {
    try {
      setIsLoading(true);
      await fetch('/api/auth/disconnect', { method: 'POST' });
      setAccount(null);
      setSyncStatus(null);
      setAuthNotification({
        type: 'info',
        message: 'Account successfully disconnected.'
      });
      await checkAuthStatus();
    } catch (err) {
      console.error('Disconnect failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuthNotification = () => {
    setAuthNotification(null);
  };

  const isConnected = Boolean(account);
  const isDemoMode = Boolean(account?.is_demo);
  const isLiveMode = Boolean(account && !account.is_demo);

  return (
    <AuthContext.Provider
      value={{
        account,
        isConnected,
        isDemoMode,
        isLiveMode,
        isLoading,
        isSyncing,
        lastSyncedAt: account?.last_synced_at || syncStatus?.lastSyncedAt || null,
        syncStatus,
        authNotification,
        serverStatus,
        checkAuthStatus,
        triggerSync,
        connectGmail,
        disconnectAccount,
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

import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext({
  account: null,
  isConnected: false,
  isLoading: true,
  isSyncing: false,
  serverStatus: null,
  checkAuthStatus: () => {},
  triggerSync: () => {},
  disconnectAccount: () => {}
});

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [serverStatus, setServerStatus] = useState(null);

  const checkAuthStatus = async () => {
    try {
      // 1. Check server health
      const healthRes = await fetch('/api/health');
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setServerStatus(healthData);
      }

      // 2. Check active OAuth account
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
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/emails/sync', { method: 'POST' });
      const data = await res.json();
      await checkAuthStatus();
      return data;
    } catch (err) {
      console.error('Sync failed:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  const disconnectAccount = async () => {
    try {
      await fetch('/api/auth/disconnect', { method: 'POST' });
      setAccount(null);
      await checkAuthStatus();
    } catch (err) {
      console.error('Disconnect failed:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        account,
        isConnected: Boolean(account),
        isLoading,
        isSyncing,
        serverStatus,
        checkAuthStatus,
        triggerSync,
        disconnectAccount
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

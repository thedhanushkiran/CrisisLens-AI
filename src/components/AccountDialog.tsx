import React, { useState } from 'react';
import {
  AccountProfile,
  listMyReports,
  loginAccount,
  logoutAccount,
  registerAccount,
  ServerReport,
} from '../services/apiService';

interface AccountDialogProps {
  account: AccountProfile | null;
  initialError?: string | null;
  onClose: () => void;
  onAuthenticated: (account: AccountProfile) => void;
  onLoggedOut: () => void;
}

export const AccountDialog: React.FC<AccountDialogProps> = ({
  account,
  initialError,
  onClose,
  onAuthenticated,
  onLoggedOut,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError || null);
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<ServerReport[] | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = mode === 'register'
        ? await registerAccount({
            display_name: displayName,
            email,
            phone: phone.trim() || null,
            password,
          })
        : await loginAccount({ email, password });
      setPassword('');
      onAuthenticated(user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to authenticate this account.');
    } finally {
      setBusy(false);
    }
  };

  const handleLoadReports = async () => {
    setBusy(true);
    setError(null);
    try {
      setReports(await listMyReports());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your reports.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setError(null);
    try {
      await logoutAccount();
      onLoggedOut();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Unable to sign out.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="w-full max-w-lg rounded-xl border border-surface-container-high bg-surface-container-lowest p-5 shadow-2xl sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-dialog-title"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">CrisisLens Account</p>
            <h2 id="account-dialog-title" className="mt-1 text-xl font-bold text-on-surface">
              {account ? 'Your profile' : mode === 'register' ? 'Create a profile' : 'Sign in'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container" aria-label="Close account dialog">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {account ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-container-low p-4 text-sm text-on-surface">
              <p className="font-bold">{account.display_name}</p>
              <p className="mt-1 text-on-surface-variant">{account.email}</p>
              <p className="text-on-surface-variant">{account.phone || 'No phone number saved'}</p>
            </div>
            <p className="text-xs leading-relaxed text-on-surface-variant">
              Profile details are stored by the configured CrisisLens API database. Reports are stored in the same database when synchronized; local SQLite is only this development setup.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleLoadReports} disabled={busy} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary disabled:opacity-60">
                {busy ? 'Loading…' : 'View my synchronized reports'}
              </button>
              <button type="button" onClick={handleLogout} disabled={busy} className="min-h-11 rounded-lg border border-surface-container-high px-4 text-sm font-bold text-on-surface disabled:opacity-60">
                Sign out
              </button>
            </div>
            {reports && (
              <ul className="max-h-40 space-y-2 overflow-y-auto rounded-lg bg-surface-container-low p-3 text-xs text-on-surface">
                {reports.length ? reports.map((report) => (
                  <li key={report.id} className="flex justify-between gap-3">
                    <span className="font-mono">{report.id}</span>
                    <span>{report.review_status}</span>
                  </li>
                )) : <li>No synchronized reports are linked to this account.</li>}
              </ul>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <>
                <label className="block text-xs font-semibold text-on-surface" htmlFor="account-name">Name</label>
                <input id="account-name" required maxLength={120} autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="h-11 w-full rounded-lg border border-surface-container-high bg-surface-container-low px-3 text-sm" />
                <label className="block text-xs font-semibold text-on-surface" htmlFor="account-phone">Phone (optional)</label>
                <input id="account-phone" type="tel" maxLength={40} autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="h-11 w-full rounded-lg border border-surface-container-high bg-surface-container-low px-3 text-sm" />
              </>
            )}
            <label className="block text-xs font-semibold text-on-surface" htmlFor="account-email">Email</label>
            <input id="account-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-lg border border-surface-container-high bg-surface-container-low px-3 text-sm" />
            <label className="block text-xs font-semibold text-on-surface" htmlFor="account-password">Password</label>
            <input id="account-password" type="password" required minLength={mode === 'register' ? 10 : 1} maxLength={128} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-lg border border-surface-container-high bg-surface-container-low px-3 text-sm" />
            {mode === 'register' && <p className="text-xs text-on-surface-variant">Use at least 10 characters. Passwords are stored as salted hashes, never as readable text.</p>}
            <p className="text-xs leading-relaxed text-on-surface-variant">
              Accounts are saved in the FastAPI database. They are cloud-persisted only after you deploy the API and configure a hosted PostgreSQL `DATABASE_URL`.
            </p>
            {error && <p role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
            <button type="submit" disabled={busy} className="min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-bold text-on-primary disabled:opacity-60">
              {busy ? 'Please wait…' : mode === 'register' ? 'Create profile' : 'Sign in'}
            </button>
            <button type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(null); }} className="w-full py-2 text-sm font-semibold text-primary hover:underline">
              {mode === 'register' ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </button>
          </form>
        )}

        {account && error && <p role="alert" className="mt-4 rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
      </section>
    </div>
  );
};

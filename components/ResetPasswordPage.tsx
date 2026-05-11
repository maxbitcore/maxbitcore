import React, { useState, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { resetPassword } from '../services/authService';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/', { replace: true }), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0b0f1a] flex flex-col items-center justify-center p-6 text-center text-slate-300">
        <p className="mb-6">Missing reset link. Request a new one from the login screen.</p>
        <Link to="/" className="text-cyan-400 hover:underline font-bold">
          Back to site
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#0b0f1a] flex flex-col items-center justify-center p-6 text-center text-white">
        <p className="text-lg font-bold text-cyan-400 mb-4">Password updated.</p>
        <p className="text-slate-400 text-sm">You can sign in. Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] flex flex-col items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 p-8 rounded-2xl border border-slate-800 bg-[#0f172a]/80"
      >
        <h1 className="text-xl font-black text-white uppercase tracking-widest">Set new password</h1>
        {error ? <p className="text-red-400 text-sm">{error}</p> : null}
        <div>
          <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">New password</label>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-[#0b0f1a] px-4 py-3 text-white outline-none focus:border-cyan-500"
            required
            minLength={8}
          />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Confirm</label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-[#0b0f1a] px-4 py-3 text-white outline-none focus:border-cyan-500"
            required
            minLength={8}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-cyan-500 text-[#0b0f1a] font-black uppercase text-sm disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Update password'}
        </button>
        <Link to="/" className="block text-center text-sm text-slate-500 hover:text-cyan-400">
          Cancel
        </Link>
      </form>
    </div>
  );
};

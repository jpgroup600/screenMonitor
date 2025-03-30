// ResetPasswordModal.js
import React, { useState } from 'react';
import request from '../../../Actions/request';

export default function ResetPasswordModal({ userId, onClose }) {
  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      return setError('Passwords do not match');
    }
    setLoading(true);
    try {
      await request.put(`/admin/reset-password/${userId}`, {
        newPassword: passwords.newPassword
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-6 w-full max-w-md border border-slate-700">
        <h3 className="text-xl font-bold text-amber-400 mb-4">Reset Password</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-slate-300 block mb-1">New Password</label>
            <input
              type="password"
              value={passwords.newPassword}
              onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
              className="w-full bg-slate-800 rounded-lg px-4 py-2 text-slate-300"
              required
            />
          </div>
          <div>
            <label className="text-slate-300 block mb-1">Confirm Password</label>
            <input
              type="password"
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})}
              className="w-full bg-slate-800 rounded-lg px-4 py-2 text-slate-300"
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-blue-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded-lg"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
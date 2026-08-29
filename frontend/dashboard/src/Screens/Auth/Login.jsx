// src/Components/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdEmail, MdLock } from 'react-icons/md';
import { FaSpinner } from 'react-icons/fa';
import request from '../../Actions/request';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await request.post('/admin/login', { email, password });
      if (response?.token) {
        localStorage.setItem('token', response.token);
        navigate('/');
        window.location.reload();
      }
    } catch (err) {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1E2939] to-[#0F172A] p-4">
      <div className="bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-8 w-full max-w-md shadow-2xl border border-slate-700">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Welcome Back
          </h2>
          <p className="text-slate-400 mt-2">Sign in to continue</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-900/30 text-rose-400 rounded-lg text-center border border-rose-800/50">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Email Input */}
            <div className="group relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                <MdEmail className="text-slate-400 group-focus-within:text-blue-400 transition-colors" size={20} />
              </div>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/50 text-slate-300 rounded-lg pl-10 pr-4 py-3 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none transition-all"
                placeholder="Email address"
              />
            </div>

            {/* Password Input */}
            <div className="group relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                <MdLock className="text-slate-400 group-focus-within:text-blue-400 transition-colors" size={20} />
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/50 text-slate-300 rounded-lg pl-10 pr-4 py-3 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none transition-all"
                placeholder="Password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-medium hover:shadow-[0_0_20px_-3px_rgba(59,130,246,0.4)] transition-all relative overflow-hidden"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <FaSpinner className="animate-spin mr-2" size={18} />
                Authenticating...
              </span>
            ) : (
              <span className="relative z-10">Sign In</span>
            )}
            <div className="absolute inset-0 bg-white/5 opacity-0 hover:opacity-100 transition-opacity" />
          </button>
        </form>
      </div>
    </div>
  );
}
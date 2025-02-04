// src/Components/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { MdEmail, MdLock } from 'react-icons/md';
import { FaSpinner } from 'react-icons/fa';
import request from '../../Actions/request'; // Adjust the path as needed

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const navigate = useNavigate(); // Initialize navigate

  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent page refresh
    setLoading(true);
    setError(null);

    try {
      // Send a POST request to the /admin/login endpoint with the email and password
      const response = await request.post('/admin/login', { email, password });
      
      // Assume the response contains a token property. Store it in localStorage.
      if (response && response.token) {
        localStorage.setItem('token', response.token);
        navigate('/');
        window.location.reload(); // Forces the entire app to reload
      } else {
        throw new Error('Token not found in response');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4">
      <div className="bg-[#121222] rounded-xl p-8 w-full max-w-md shadow-xl">
        <h2 className="text-white text-2xl mb-6 text-center">Login</h2>

        {error && <p className="text-red-500 mb-4 text-center">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <MdEmail className="text-teal-500" size={20} />
            </span>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#020617] text-white rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Enter your email"
            />
          </div>

          {/* Password Field */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <MdLock className="text-teal-500" size={20} />
            </span>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#020617] text-white rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Enter your password"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-all duration-300 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <FaSpinner className="animate-spin mr-2" size={18} /> Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

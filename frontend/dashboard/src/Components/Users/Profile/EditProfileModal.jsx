import React, { useState, useEffect } from 'react';
import request from '../../../Actions/request';

export default function EditProfileModal({ employee, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    designation: '',
    phoneNumber: '',
    role: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (employee) {
      setFormData({
        fullName: employee.fullName,
        email: employee.email,
        designation: employee.designation,
        phoneNumber: employee.phoneNumber,
        role: employee.role
      });
    }
  }, [employee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await request.patch(`/admin/update-profile/${employee.id}`, formData);
      onSuccess();
      onClose();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-[#1E2939] to-[#0F172A] rounded-xl p-6 w-full max-w-md border border-slate-700">
        <h3 className="text-xl font-bold text-blue-400 mb-4">Edit Profile</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-slate-300 block mb-1">Full Name</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              className="w-full bg-slate-800 rounded-lg px-4 py-2 text-slate-300"
              required
            />
          </div>
          
          <div>
            <label className="text-slate-300 block mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full bg-slate-800 rounded-lg px-4 py-2 text-slate-300"
              required
            />
          </div>
          
          <div>
            <label className="text-slate-300 block mb-1">Designation</label>
            <input
              type="text"
              value={formData.designation}
              onChange={(e) => setFormData({...formData, designation: e.target.value})}
              className="w-full bg-slate-800 rounded-lg px-4 py-2 text-slate-300"
              required
            />
          </div>
          
          <div>
            <label className="text-slate-300 block mb-1">Phone Number</label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
              className="w-full bg-slate-800 rounded-lg px-4 py-2 text-slate-300"
            />
          </div>
          
          <div>
            <label className="text-slate-300 block mb-1">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              className="w-full bg-slate-800 rounded-lg px-4 py-2 text-slate-300"
            >
              <option value="Employee">Employee</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
          
          {message && <p className="text-red-400 text-sm">{message}</p>}
          
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-blue-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
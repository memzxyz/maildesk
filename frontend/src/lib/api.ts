import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const getMe = () => api.get('/auth/me').then(r => r.data);
export const getTeam = () => api.get('/auth/team').then(r => r.data);

// Emails
export const getEmails = (params?: any) => api.get('/api/emails', { params }).then(r => r.data);
export const getEmail = (id: string) => api.get(`/api/emails/${id}`).then(r => r.data);
export const updateEmailStatus = (id: string, status: string) =>
  api.patch(`/api/emails/${id}/status`, { status }).then(r => r.data);

// Assignments
export const assignEmail = (email_id: string, assigned_to: string | null) =>
  api.post('/api/assignments', { email_id, assigned_to }).then(r => r.data);

// Comments
export const getComments = (emailId: string) => api.get(`/api/comments/${emailId}`).then(r => r.data);
export const postComment = (data: { email_id: string; body: string; mentions?: string[] }) =>
  api.post('/api/comments', data).then(r => r.data);
export const updateComment = (id: string, body: string) =>
  api.patch(`/api/comments/${id}`, { body }).then(r => r.data);
export const deleteComment = (id: string) => api.delete(`/api/comments/${id}`).then(r => r.data);

// Replies
export const sendReply = (email_id: string, body_html: string) =>
  api.post('/api/replies', { email_id, body_html }).then(r => r.data);

// Notifications
export const getNotifications = () => api.get('/api/notifications').then(r => r.data);
export const markAllRead = () => api.patch('/api/notifications/read-all').then(r => r.data);

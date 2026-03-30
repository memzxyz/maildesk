export interface Workspace {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface User {
  id: string;
  workspace_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: 'owner' | 'admin' | 'member';
  google_id?: string;
  created_at: string;
}

export interface GmailAccount {
  id: string;
  workspace_id: string;
  user_id: string;
  gmail_address: string;
  access_token: string;
  refresh_token: string;
  token_expiry?: string;
  history_id?: string;
  watch_expiry?: string;
}

export interface Email {
  id: string;
  workspace_id: string;
  gmail_account_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  subject?: string;
  from_address: string;
  from_name?: string;
  to_addresses: string[];
  cc_addresses: string[];
  snippet?: string;
  body_html?: string;
  body_text?: string;
  status: 'open' | 'resolved' | 'snoozed';
  is_read: boolean;
  received_at: string;
  created_at: string;
  // Joined fields
  assigned_to?: User;
  comment_count?: number;
}

export interface Comment {
  id: string;
  email_id: string;
  user_id: string;
  body: string;
  edited_at?: string;
  created_at: string;
  user?: User;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'assignment' | 'mention' | 'reply';
  email_id?: string;
  comment_id?: string;
  actor_id?: string;
  is_read: boolean;
  created_at: string;
  actor?: User;
  email?: Pick<Email, 'id' | 'subject' | 'from_address'>;
}

export interface AuthRequest extends Request {
  user?: User;
  workspace?: Workspace;
}

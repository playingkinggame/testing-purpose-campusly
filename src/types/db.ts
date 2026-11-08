// Types that match phase1_database.sql + phase2_additions.sql.
// "My" profile = raw row (only I can read it). "Public" profile = profiles_public view.

export type Residence = 'day_scholar' | 'hosteller';

export interface MyProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_path: string | null;
  reg_no: string | null;
  batch: number | null;
  branch: string | null;
  school: string | null;
  residence: Residence | null;
  hostel_block: string | null;
  room_no: string | null;
  clubs: string[];
  languages: string[];
  interests: string[];
  bio: string | null;
  social_link: string | null;
  streak_count: number;
  last_active_on: string | null;
  hearts_total: number;
  hide_online: boolean;
  hide_last_seen: boolean;
  hide_reg_no: boolean;
  last_seen_at: string | null;
  onboarded: boolean;
  created_at: string;
  updated_at: string;
}

/** The only columns the database lets a user update on their own profile. */
export interface ProfilePatch {
  username?: string;
  full_name?: string;
  avatar_path?: string | null;
  reg_no?: string;
  batch?: number;
  branch?: string;
  school?: string;
  residence?: Residence;
  hostel_block?: string | null;
  room_no?: string | null;
  clubs?: string[];
  languages?: string[];
  interests?: string[];
  bio?: string | null;
  social_link?: string | null;
  hide_online?: boolean;
  hide_last_seen?: boolean;
  hide_reg_no?: boolean;
  onboarded?: boolean;
}

export interface PublicProfile {
  id: string;
  username: string;
  full_name: string;
  avatar_path: string | null;
  batch: number | null;
  branch: string | null;
  school: string | null;
  residence: Residence | null;
  hostel_block: string | null;
  clubs: string[];
  languages: string[];
  interests: string[];
  bio: string | null;
  social_link: string | null;
  streak_count: number;
  hearts_total: number;
  reg_no: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export type MiniProfile = Pick<PublicProfile, 'id' | 'username' | 'full_name' | 'avatar_path'>;

export interface Badge { id: string; slug: string; name: string; description: string | null; icon: string | null }
export interface UserBadge { awarded_at: string; badges: Badge }

export type AchievementKind = 'certificate' | 'hackathon' | 'fest' | 'club_role' | 'other';
export interface Achievement {
  id: string; user_id: string; kind: AchievementKind; title: string; description: string | null;
  issuer: string | null; achieved_on: string | null; file_path: string | null; created_at: string;
}

export type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'blocked';
export interface Connection {
  id: string; requester_id: string; addressee_id: string; status: ConnectionStatus;
  created_at: string; responded_at: string | null;
}
/** How I relate to another person (from discover_people / helper). */
export type RelationStatus =
  | 'none' | 'pending_out' | 'pending_in' | 'accepted' | 'declined_out' | 'declined_in';

export interface DiscoverPerson {
  id: string; username: string; full_name: string; avatar_path: string | null;
  batch: number | null; branch: string | null; school: string | null;
  residence: Residence | null; hostel_block: string | null;
  clubs: string[]; languages: string[]; interests: string[]; bio: string | null;
  streak_count: number; hearts_total: number;
  match_percent: number; reasons: string[]; mutual_count: number;
  connection_id: string | null; connection_status: RelationStatus;
}

export interface LeaderboardRow {
  id: string; username: string; full_name: string; avatar_path: string | null;
  branch: string | null; batch: number | null; hearts_this_week: number;
}

export type MessageKind = 'text' | 'image' | 'file' | 'voice';

export interface ConversationSummary {
  conversation_id: string; type: 'dm' | 'group'; last_message_at: string | null;
  last_message_id: string | null; last_message_kind: MessageKind | null; last_message_body: string | null;
  last_message_sender: string | null; last_message_unsent: boolean | null;
  unread_count: number; muted: boolean;
  other_user_id: string | null; group_name: string | null; group_avatar: string | null;
  group_visibility: 'public' | 'private' | null;
}

export interface Message {
  id: string; conversation_id: string; sender_id: string; kind: MessageKind;
  body: string | null; media_path: string | null; media_name: string | null; media_mime: string | null;
  media_size: number | null; duration_ms: number | null; waveform: number[] | null;
  reply_to: string | null; edited_at: string | null; deleted_at: string | null; created_at: string;
}
export interface MessageReaction { message_id: string; user_id: string; emoji: string; created_at: string }
export interface MessageReceipt { message_id: string; user_id: string; delivered_at: string | null; seen_at: string | null }

export type GroupRole = 'owner' | 'admin' | 'member';
export interface Group {
  id: string; name: string; description: string | null; avatar_path: string | null;
  visibility: 'public' | 'private'; owner_id: string; member_count: number; created_at: string;
}
export interface GroupMember { group_id: string; user_id: string; role: GroupRole; joined_at: string }
export interface Announcement { id: string; group_id: string; author_id: string; title: string; body: string; created_at: string }
export interface PinnedMessage { id: string; conversation_id: string; message_id: string; pinned_by: string; pinned_at: string }

export interface TeammatePost {
  id: string; author_id: string; title: string; description: string | null; event_name: string | null;
  skills_needed: string[]; team_size: number | null; status: 'open' | 'closed'; created_at: string;
}
export interface TeammateInvite {
  id: string; post_id: string; from_user: string; to_user: string; message: string | null;
  status: 'pending' | 'accepted' | 'declined'; created_at: string;
}
export interface TeammateMatch {
  id: string; username: string; full_name: string; avatar_path: string | null; branch: string | null;
  batch: number | null; interests: string[]; matched_skills: string[]; invite_status: string | null;
}
export interface StudyRoom { id: string; creator_id: string; name: string; subject: string | null; description: string | null; created_at: string }
export interface StudyNote {
  id: string; room_id: string; uploader_id: string; title: string; file_path: string;
  file_name: string | null; mime_type: string | null; size_bytes: number | null; created_at: string;
}
export interface EventRow {
  id: string; creator_id: string; title: string; description: string | null; location: string | null;
  club: string | null; starts_at: string; ends_at: string | null; created_at: string;
  going_count: number; i_going: boolean;
}
export interface LostFound {
  id: string; author_id: string; kind: 'lost' | 'found'; title: string; description: string | null;
  location: string | null; image_path: string | null; status: 'open' | 'resolved'; created_at: string;
}
export interface Ride {
  id: string; author_id: string; origin: string; destination: string; depart_at: string; seats: number;
  cost_note: string | null; notes: string | null; status: 'open' | 'full' | 'closed'; created_at: string;
}
export interface ConfessionFeedRow { id: string; body: string; created_at: string }
export interface Notice { id: string; author_id: string | null; title: string; body: string; pinned: boolean; expires_at: string | null; created_at: string }
export interface SeniorQuestion {
  id: string; asker_id: string; senior_id: string; question: string; answer: string | null;
  answered_at: string | null; created_at: string;
}

export type ReportTarget = 'profile' | 'message' | 'post' | 'confession' | 'group' | 'event';
export type ReportReason = 'spam' | 'harassment' | 'hate' | 'nsfw' | 'impersonation' | 'self_harm' | 'other';
export interface AdminReport {
  id: string; reporter_id: string; target_type: ReportTarget; target_id: string; reason: ReportReason;
  details: string | null; status: 'open' | 'reviewing' | 'actioned' | 'dismissed'; created_at: string;
  target_preview: string | null;
}
export interface BlockedUser { blocked_id: string; username: string | null; full_name: string | null; avatar_path: string | null; blocked_at: string }

export type NotificationKind =
  'connection_request' | 'connection_accepted' | 'teammate_invite' | 'senior_question' | 'senior_answer';
export interface AppNotification {
  id: string; user_id: string; kind: NotificationKind; actor_id: string | null; ref_id: string | null;
  created_at: string; read_at: string | null;
}

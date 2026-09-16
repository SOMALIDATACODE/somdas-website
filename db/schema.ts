import {sqliteTable,text,integer,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const sectionDrafts=sqliteTable('section_drafts',{key:text('key').primaryKey(),body:text('body').notNull(),baseBody:text('base_body').notNull(),revision:integer('revision').notNull(),status:text('status').notNull(),updatedAt:text('updated_at').notNull(),updatedBy:text('updated_by').notNull(),ownerId:text('owner_id'),assignedTo:text('assigned_to'),scheduledAt:text('scheduled_at'),publishError:text('publish_error')});
export const sectionHistory=sqliteTable('section_history',{id:text('id').primaryKey(),key:text('key').notNull(),body:text('body').notNull(),revision:integer('revision').notNull(),action:text('action').notNull(),createdAt:text('created_at').notNull(),createdBy:text('created_by').notNull()},t=>[index('idx_section_history_key_created').on(t.key,t.createdAt)]);
export const cmsUsers=sqliteTable('cms_users',{
 id:text('id').primaryKey(),platformId:text('platform_id'),name:text('name').notNull(),email:text('email').notNull(),role:text('role').notNull(),status:text('status').notNull(),
 passwordHash:text('password_hash'),twoFactorSecret:text('two_factor_secret'),twoFactorEnabled:integer('two_factor_enabled').notNull().default(0),lastLoginAt:text('last_login_at'),
 createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),createdBy:text('created_by').notNull()
},t=>[uniqueIndex('idx_cms_users_email').on(t.email),uniqueIndex('idx_cms_users_platform').on(t.platformId)]);
export const cmsSessions=sqliteTable('cms_sessions',{
 tokenHash:text('token_hash').primaryKey(),userId:text('user_id').notNull().references(()=>cmsUsers.id,{onDelete:'cascade'}),expiresAt:text('expires_at').notNull(),createdAt:text('created_at').notNull(),lastSeenAt:text('last_seen_at').notNull()
},t=>[index('idx_cms_sessions_user').on(t.userId),index('idx_cms_sessions_expiry').on(t.expiresAt)]);
export const cmsAuthChallenges=sqliteTable('cms_auth_challenges',{
 tokenHash:text('token_hash').primaryKey(),userId:text('user_id').notNull().references(()=>cmsUsers.id,{onDelete:'cascade'}),purpose:text('purpose').notNull(),setupSecret:text('setup_secret'),codeHash:text('code_hash'),expiresAt:text('expires_at').notNull(),attempts:integer('attempts').notNull().default(0),createdAt:text('created_at').notNull()
},t=>[index('idx_cms_challenges_user').on(t.userId),index('idx_cms_challenges_expiry').on(t.expiresAt)]);
export const cmsActivity=sqliteTable('cms_activity',{id:text('id').primaryKey(),actorId:text('actor_id').notNull(),actorName:text('actor_name').notNull(),actorRole:text('actor_role').notNull(),action:text('action').notNull(),targetType:text('target_type').notNull(),targetKey:text('target_key').notNull(),targetLabel:text('target_label').notNull(),createdAt:text('created_at').notNull()},t=>[index('idx_cms_activity_created').on(t.createdAt),index('idx_cms_activity_actor').on(t.actorId,t.createdAt)]);
export const cmsSettings=sqliteTable('cms_settings',{key:text('key').primaryKey(),value:text('value').notNull(),updatedAt:text('updated_at').notNull(),updatedBy:text('updated_by').notNull()});
export const analyticsEvents=sqliteTable('analytics_events',{id:text('id').primaryKey(),date:text('date').notNull(),path:text('path').notNull(),visitorHash:text('visitor_hash').notNull(),referrer:text('referrer').notNull(),device:text('device').notNull(),createdAt:text('created_at').notNull()},t=>[index('idx_analytics_date').on(t.date),index('idx_analytics_path_date').on(t.path,t.date),index('idx_analytics_visitor_date').on(t.visitorHash,t.date)]);
export const adminWorkspace=sqliteTable('admin_workspace',{id:integer('id').primaryKey(),body:text('body').notNull(),revision:integer('revision').notNull(),baseRevision:integer('base_revision').notNull(),status:text('status').notNull(),updatedAt:text('updated_at').notNull(),updatedBy:text('updated_by').notNull()});
export const adminHistory=sqliteTable('admin_history',{id:text('id').primaryKey(),body:text('body').notNull(),revision:integer('revision').notNull(),action:text('action').notNull(),createdAt:text('created_at').notNull(),createdBy:text('created_by').notNull()},t=>[index('idx_admin_history_created').on(t.createdAt)]);
export const contentDocuments=sqliteTable('content_documents',{id:integer('id').primaryKey(),body:text('body').notNull(),revision:integer('revision').notNull(),updatedAt:text('updated_at').notNull(),updatedBy:text('updated_by').notNull()});
export const media=sqliteTable('media',{id:text('id').primaryKey(),filename:text('filename').notNull(),type:text('type').notNull(),size:integer('size').notNull(),createdAt:text('created_at').notNull(),createdBy:text('created_by').notNull()},t=>[index('idx_media_created').on(t.createdAt)]);

export const contactMessages=sqliteTable('contact_messages',{id:text('id').primaryKey(),name:text('name').notNull(),email:text('email').notNull(),topic:text('topic').notNull(),message:text('message').notNull(),createdAt:text('created_at').notNull()},t=>[index('contact_email_created').on(t.email,t.createdAt),index('contact_created').on(t.createdAt)]);

export const members=sqliteTable('members',{
  id:text('id').primaryKey(),
  name:text('name').notNull(),
  email:text('email').notNull(),
  passwordHash:text('password_hash').notNull(),
  profileImageKey:text('profile_image_key'),
  createdAt:text('created_at').notNull(),
  updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('idx_members_email').on(t.email)]);

export const memberSessions=sqliteTable('member_sessions',{
  tokenHash:text('token_hash').primaryKey(),
  memberId:text('member_id').notNull().references(()=>members.id,{onDelete:'cascade'}),
  expiresAt:text('expires_at').notNull(),
  createdAt:text('created_at').notNull(),
},t=>[index('idx_member_sessions_member').on(t.memberId),index('idx_member_sessions_expiry').on(t.expiresAt)]);

export const passwordResetOtps=sqliteTable('password_reset_otps',{
  id:text('id').primaryKey(),
  memberId:text('member_id').notNull().references(()=>members.id,{onDelete:'cascade'}),
  codeHash:text('code_hash').notNull(),
  expiresAt:text('expires_at').notNull(),
  attempts:integer('attempts').notNull().default(0),
  usedAt:text('used_at'),
  createdAt:text('created_at').notNull(),
},t=>[index('idx_password_reset_member_created').on(t.memberId,t.createdAt),index('idx_password_reset_expiry').on(t.expiresAt)]);

export const authRateLimits=sqliteTable('auth_rate_limits',{
  key:text('key').primaryKey(),
  attempts:integer('attempts').notNull(),
  resetAt:integer('reset_at').notNull(),
},t=>[index('idx_auth_rate_limits_reset').on(t.resetAt)]);

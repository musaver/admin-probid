import {
  mysqlTable,
  varchar,
  datetime,
  text,
  primaryKey,
  mysqlEnum,
  int,
  json,
  index,
  decimal
} from 'drizzle-orm/mysql-core';

// ✅ User table (required)
export const user = mysqlTable('user', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: datetime('emailVerified'),
  image: text('image'),
  type: mysqlEnum('type', ['bidder', 'county']).default('bidder'),
  profilePicture: varchar('profile_picture', { length: 255 }),
  username: varchar('username', { length: 100 }),
  displayName: varchar('display_name', { length: 100 }),
  skill: varchar('skill', { length: 100 }),
  occupation: varchar('occupation', { length: 100 }),
  country: varchar('country', { length: 100 }),
  city: varchar('city', { length: 100 }),
  address: varchar('address', { length: 100 }),
  state: varchar('state', { length: 100 }),
  aboutMe: text('about_me'),
  phone: varchar('phone', { length: 20 }),
  countyId: varchar('county_id', { length: 255 }), // FK to user.id (county who invited this bidder)
  // Visibility Control (user-level defaults)
  visibilityMinBid: int('visibility_min_bid').default(1).notNull(),
  visibilityCurrentBid: int('visibility_current_bid').default(1).notNull(),
  visibilityBidHistory: int('visibility_bid_history').default(0).notNull(),
  visibilityPropertyStatus: int('visibility_property_status').default(1).notNull(),
  visibilityBidderList: int('visibility_bidder_list').default(0).notNull(),
  visibilityDocuments: int('visibility_documents').default(0).notNull(),
  bidderNumber: varchar('bidder_number', { length: 50 }),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

// ✅ Accounts table (OAuth support: Google, Facebook)
export const account = mysqlTable(
  'account',
  {
    userId: varchar('userId', { length: 255 }).notNull(),
    type: varchar('type', { length: 255 }).notNull(),
    provider: varchar('provider', { length: 255 }).notNull(),
    providerAccountId: varchar('providerAccountId', { length: 255 }).notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: datetime('expires_at'),
    token_type: varchar('token_type', { length: 255 }),
    scope: varchar('scope', { length: 255 }),
    id_token: text('id_token'),
    session_state: varchar('session_state', { length: 255 }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.provider, table.providerAccountId] }),
  })
);

// ✅ Sessions table (for session-based auth, even if using JWT)
export const sessions = mysqlTable('sessions', {
  sessionToken: varchar('sessionToken', { length: 255 }).primaryKey(),
  userId: varchar('userId', { length: 255 }).notNull(),
  expires: datetime('expires').notNull(),
});

// ✅ Verification tokens (for email OTP, magic links)
export const verification_tokens = mysqlTable(
  'verification_tokens',
  {
    identifier: varchar('identifier', { length: 255 }).notNull(),
    token: varchar('token', { length: 255 }).notNull(),
    otp: varchar('otp', { length: 255 }).notNull(),
    expires: datetime('expires').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.identifier, table.token, table.otp] }),
  })
);

// ✅ Property table
export const property = mysqlTable('property', {
  id: varchar('id', { length: 255 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  address: text('address'),
  parcelId: varchar('parcel_id', { length: 255 }),
  saleId: varchar('sale_id', { length: 255 }).notNull(), // User requested "Sale ID" to be required
  city: varchar('city', { length: 255 }),
  zipCode: varchar('zip_code', { length: 20 }),
  squareFeet: int('square_feet'),
  yearBuilt: int('year_built'),
  lotSize: varchar('lot_size', { length: 50 }),
  owners: json('owners'), // List of owner names ["Smith, John", ...]
  auctionStart: datetime('auction_start'), // Auction start date (scheduled sale start)
  auctionEnd: datetime('auction_end'), // Auction end / closing date for the sale
  minBid: decimal('min_bid', { precision: 12, scale: 2 }),
  winningBid: decimal('winning_bid', { precision: 12, scale: 2 }), // Manual override or record
  winningBidderId: varchar('winning_bidder_id', { length: 255 }), // Linked to user.id
  visibilitySettings: json('visibility_settings'),
  status: mysqlEnum('status', [
    'active',
    'sold',
    'withdrawn',
    'on_list',
    'sold_at_tax_sale',
    'redeemed',
    'voided',
    'cancelled',
    'deed_in_progress',
    'deed_issued',
    'redeemed_check_issued',
  ]).default('active'),
  createdBy: varchar('created_by', { length: 255 }).notNull(), // FK to user.id
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

// ✅ Property Bids table (real bidding)
export const propertyBids = mysqlTable(
  'property_bids',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    propertyId: varchar('property_id', { length: 255 }).notNull(), // FK to property.id
    bidderId: varchar('bidder_id', { length: 255 }).notNull(), // FK to user.id
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    createdAt: datetime('created_at').notNull(),
  },
  (table) => ({
    propertyIdIdx: index('property_bids_property_id_idx').on(table.propertyId),
    propertyAmountIdx: index('property_bids_property_amount_idx').on(
      table.propertyId,
      table.amount
    ),
  })
);

// ✅ Property Linked Bidders table
export const propertyLinkedBidders = mysqlTable('property_linked_bidders', {
  id: varchar('id', { length: 255 }).primaryKey(),
  propertyId: varchar('property_id', { length: 255 }).notNull(), // FK to property.id
  bidderId: varchar('bidder_id', { length: 255 }).notNull(), // FK to user.id
  status: mysqlEnum('status', ['invited', 'interested', 'bidding', 'won']).default('invited'),
  linkedAt: datetime('linked_at').notNull(),
});

// ✅ Property Documents table
export const propertyDocuments = mysqlTable('property_documents', {
  id: varchar('id', { length: 255 }).primaryKey(),
  propertyId: varchar('property_id', { length: 255 }).notNull(), // FK to property.id
  name: varchar('name', { length: 255 }),
  url: text('url'),
  pathname: text('pathname'),
  type: varchar('type', { length: 50 }),
  size: varchar('size', { length: 50 }),
  uploadedAt: datetime('uploaded_at').notNull(),
});

// ✅ Bidder Identity Documents table
export const bidderDocuments = mysqlTable(
  'bidder_documents',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    bidderId: varchar('bidder_id', { length: 255 }).notNull(), // FK to user.id
    name: varchar('name', { length: 255 }),
    url: text('url'),
    pathname: text('pathname'),
    type: varchar('type', { length: 50 }),
    size: varchar('size', { length: 50 }),
    uploadedAt: datetime('uploaded_at').notNull(),
  },
  (table) => ({
    bidderIdIdx: index('bidder_documents_bidder_id_idx').on(table.bidderId),
    uploadedAtIdx: index('bidder_documents_uploaded_at_idx').on(table.uploadedAt),
  })
);

// ✅ Conversations table
export const conversations = mysqlTable('conversations', {
  id: varchar('id', { length: 255 }).primaryKey(),
  participant1Id: varchar('participant1_id', { length: 255 }).notNull(), // FK to user.id
  participant2Id: varchar('participant2_id', { length: 255 }).notNull(), // FK to user.id
  propertyId: varchar('property_id', { length: 255 }), // FK to property.id
  lastMessageAt: datetime('last_message_at'),
  createdAt: datetime('created_at').notNull(),
  sharedKey: text('shared_key'), // Shared key for E2EE (simplified)
});

// ✅ Messages table
export const messages = mysqlTable('messages', {
  id: varchar('id', { length: 255 }).primaryKey(),
  conversationId: varchar('conversation_id', { length: 255 }).notNull(), // FK to conversations.id
  senderId: varchar('sender_id', { length: 255 }).notNull(), // FK to user.id
  content: text('content').notNull(), // Encrypted content
  createdAt: datetime('created_at').notNull(),
  isRead: int('is_read').default(0), // 0 or 1
});

// ✅ Property Alerts (audit log of emails sent)
export const propertyAlerts = mysqlTable(
  'property_alerts',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    propertyId: varchar('property_id', { length: 255 }).notNull(), // FK to property.id
    sentByUserId: varchar('sent_by_user_id', { length: 255 }).notNull(), // FK to user.id
    subject: varchar('subject', { length: 255 }).notNull(),
    message: text('message').notNull(),
    recipientCount: int('recipient_count').notNull(),
    createdAt: datetime('created_at').notNull(),
  },
  (table) => ({
    propertyIdIdx: index('property_alerts_property_id_idx').on(table.propertyId),
    sentByIdx: index('property_alerts_sent_by_idx').on(table.sentByUserId),
  })
);

// ✅ Notifications (in-app)
export const notifications = mysqlTable(
  'notifications',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull(), // FK to user.id
    type: mysqlEnum('type', ['alert', 'bid', 'status']).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message'),
    href: varchar('href', { length: 255 }),
    metadata: json('metadata'),
    isRead: int('is_read').default(0),
    createdAt: datetime('created_at').notNull(),
  },
  (table) => ({
    userIdIdx: index('notifications_user_id_idx').on(table.userId),
    userUnreadIdx: index('notifications_user_unread_idx').on(table.userId, table.isRead),
    createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
  })
);

// ✅ Invite Tokens (for magic link authentication)
export const invite_tokens = mysqlTable('invite_tokens', {
  id: varchar('id', { length: 255 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  userId: varchar('user_id', { length: 255 }).notNull(), // FK to user.id
  expires: datetime('expires').notNull(),
  createdAt: datetime('created_at').notNull(),
});


// ✅ Admin Users table (for admin authentication)
export const adminUsers = mysqlTable("admin_users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  roleId: varchar("roleId", { length: 255 }).notNull(),
  role: varchar('role', { length: 255 }).notNull(),
  createdAt: datetime("createdAt").notNull(),
  updatedAt: datetime("updatedAt").notNull(),
});

// ✅ Admin Roles table (for role-based access control)
export const adminRoles = mysqlTable("admin_roles", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  permissions: text("permissions").notNull(),
  createdAt: datetime("createdAt").notNull(),
  updatedAt: datetime("updatedAt").notNull(),
});

// ✅ Admin Logs table (for tracking admin actions)
export const adminLogs = mysqlTable("admin_logs", {
  id: varchar("id", { length: 255 }).primaryKey(),
  adminId: varchar("adminId", { length: 255 }).notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  details: text("details"),
  createdAt: datetime("createdAt").notNull(),
});

// ============================================================================
// 🔄 Bidirectional sync with OwnMidwest (data.ownmidwest.com)
// See BIDIRECTIONAL_SYNC_PROPOSAL.md. These four tables hold sync MACHINERY
// state (queues, dedupe, id mapping) — not property data.
// Keep identical to probid/src/lib/schema.ts (shared DB).
// ============================================================================

// Direction A: outbound queue of changes to push TO OwnMidwest
export const syncOutbox = mysqlTable('sync_outbox', {
  id: varchar('id', { length: 255 }).primaryKey(),
  aggregateType: varchar('aggregate_type', { length: 32 }).notNull(), // tax_sale | owner | address | status
  aggregateId: varchar('aggregate_id', { length: 255 }).notNull(),    // property.id
  operation: varchar('operation', { length: 40 }).notNull(),          // add_tax_sale | update_tax_sale | update_status | update_owner | update_address
  payload: json('payload').notNull(),                                 // body already mapped to OwnMidwest field names
  idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull().unique(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  status: mysqlEnum('status', ['pending', 'in_flight', 'delivered', 'dead']).default('pending').notNull(),
  attempts: int('attempts').default(0).notNull(),
  nextAttemptAt: datetime('next_attempt_at').notNull(),
  lockedAt: datetime('locked_at'),
  lastError: text('last_error'),
  createdAt: datetime('created_at').notNull(),
  deliveredAt: datetime('delivered_at'),
}, (table) => ({
  dueIdx: index('sync_outbox_due_idx').on(table.status, table.nextAttemptAt),
  aggregateIdx: index('sync_outbox_aggregate_idx').on(table.aggregateId),
}));

// Direction B: dedupe log of events received FROM OwnMidwest
export const syncInbox = mysqlTable('sync_inbox', {
  id: varchar('id', { length: 255 }).primaryKey(),
  eventId: varchar('event_id', { length: 255 }).notNull().unique(), // = X-Idempotency-Key
  operation: varchar('operation', { length: 40 }).notNull(),
  mapId: varchar('map_id', { length: 255 }),
  countyId: int('county_id'),
  status: mysqlEnum('status', ['processed', 'duplicate', 'unmatched', 'failed']).notNull(),
  payload: json('payload'),
  result: text('result'),
  receivedAt: datetime('received_at').notNull(),
}, (table) => ({
  receivedIdx: index('sync_inbox_received_idx').on(table.receivedAt),
}));

// Identity mapping + echo-suppression hashes (one row per synced property)
export const syncStatusMap = mysqlTable('sync_status_map', {
  propertyId: varchar('property_id', { length: 255 }).primaryKey(), // FK -> property.id
  omMapId: varchar('om_map_id', { length: 255 }).notNull(),
  omCountyId: int('om_county_id').notNull(),
  omExists: int('om_exists').default(0).notNull(),                  // 0/1: has AddTaxSale succeeded yet?
  lastOutboundHash: varchar('last_outbound_hash', { length: 64 }),
  lastInboundHash: varchar('last_inbound_hash', { length: 64 }),
  lastSyncedAt: datetime('last_synced_at'),
}, (table) => ({
  omKeyIdx: index('sync_map_om_key_idx').on(table.omMapId, table.omCountyId),
}));

// Lookup mapping seeded from GetAllCounty / GetAllTaxSalesStatus / GetAllCompetitorStatus
export const syncLookup = mysqlTable('sync_lookup', {
  id: varchar('id', { length: 255 }).primaryKey(),
  kind: mysqlEnum('kind', ['county', 'tax_status', 'competitor_status']).notNull(),
  omId: int('om_id').notNull(),                          // the integer id on OwnMidwest
  omName: varchar('om_name', { length: 255 }),
  bbValue: varchar('bb_value', { length: 64 }),          // BidBridge enum value / county id it maps to
  updatedAt: datetime('updated_at').notNull(),
}, (table) => ({
  kindIdx: index('sync_lookup_kind_idx').on(table.kind, table.omId),
}));

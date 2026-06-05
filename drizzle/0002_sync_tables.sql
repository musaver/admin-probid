-- =====================================================================
-- Bidirectional sync tables (Phase 1)
-- Run ONCE against the shared MySQL database (both apps point at the same DB).
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- =====================================================================

-- 1) Outbound queue: changes that must be pushed TO OwnMidwest (Direction A)
CREATE TABLE IF NOT EXISTS `sync_outbox` (
  `id` varchar(255) NOT NULL,
  `aggregate_type` varchar(32) NOT NULL,          -- tax_sale | owner | address | status
  `aggregate_id` varchar(255) NOT NULL,           -- property.id
  `operation` varchar(40) NOT NULL,               -- add_tax_sale | update_tax_sale | update_status | update_owner | update_address
  `payload` json NOT NULL,                         -- body already mapped to OwnMidwest field names
  `idempotency_key` varchar(255) NOT NULL,         -- stable per logical change; UNIQUE = cannot enqueue twice
  `content_hash` varchar(64) NOT NULL,             -- sha256 of payload (echo suppression)
  `status` enum('pending','in_flight','delivered','dead') NOT NULL DEFAULT 'pending',
  `attempts` int NOT NULL DEFAULT 0,
  `next_attempt_at` datetime NOT NULL,             -- backoff schedule
  `locked_at` datetime,
  `last_error` text,
  `created_at` datetime NOT NULL,
  `delivered_at` datetime,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sync_outbox_idem_key` (`idempotency_key`),
  KEY `sync_outbox_due_idx` (`status`, `next_attempt_at`),
  KEY `sync_outbox_aggregate_idx` (`aggregate_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Inbound dedupe log: events received FROM OwnMidwest (Direction B)
CREATE TABLE IF NOT EXISTS `sync_inbox` (
  `id` varchar(255) NOT NULL,
  `event_id` varchar(255) NOT NULL,                -- = X-Idempotency-Key sent by OwnMidwest; UNIQUE = apply once
  `operation` varchar(40) NOT NULL,
  `map_id` varchar(255),
  `county_id` int,
  `status` enum('processed','duplicate','unmatched','failed') NOT NULL,
  `payload` json,
  `result` text,
  `received_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sync_inbox_event_id` (`event_id`),
  KEY `sync_inbox_received_idx` (`received_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Identity mapping + echo-suppression hashes (one row per synced property)
CREATE TABLE IF NOT EXISTS `sync_status_map` (
  `property_id` varchar(255) NOT NULL,             -- FK -> property.id
  `om_map_id` varchar(255) NOT NULL,               -- OwnMidwest mapId
  `om_county_id` int NOT NULL,                      -- OwnMidwest countyIDFK
  `om_exists` int NOT NULL DEFAULT 0,               -- 0/1: has AddTaxSale succeeded yet? (Add vs Update)
  `last_outbound_hash` varchar(64),                -- last value we PUSHED to OM
  `last_inbound_hash` varchar(64),                 -- last value we RECEIVED from OM
  `last_synced_at` datetime,
  PRIMARY KEY (`property_id`),
  KEY `sync_map_om_key_idx` (`om_map_id`, `om_county_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) Lookup mapping seeded from GetAllCounty / GetAllTaxSalesStatus / GetAllCompetitorStatus
CREATE TABLE IF NOT EXISTS `sync_lookup` (
  `id` varchar(255) NOT NULL,
  `kind` enum('county','tax_status','competitor_status') NOT NULL,
  `om_id` int NOT NULL,                             -- the integer id on OwnMidwest
  `om_name` varchar(255),                           -- human label from OwnMidwest
  `bb_value` varchar(64),                           -- BidBridge enum value / county id it maps to
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sync_lookup_kind_idx` (`kind`, `om_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

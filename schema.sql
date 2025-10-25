-- R10 Video Gallery Database Schema
-- Cloudflare D1 SQLite Database

-- Videos table stores metadata for all rendered videos
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded INTEGER NOT NULL,
  size INTEGER NOT NULL,

  -- Render parameters
  distortionType TEXT,
  trailHue TEXT,
  trailSat TEXT,
  trailLight TEXT,
  pngUrl TEXT,
  profile TEXT,

  -- Session and timing
  sessionId TEXT,
  renderedAt INTEGER,

  -- Audio source
  audioUrl TEXT,

  -- Song metadata from iTunes
  songName TEXT,
  artistName TEXT,
  artworkUrl TEXT,

  -- Video thumbnail (400x400 square from last frame)
  thumbnailUrl TEXT,

  -- Timestamps
  createdAt INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Index for gallery query (newest first)
CREATE INDEX IF NOT EXISTS idx_videos_uploaded ON videos(uploaded DESC);

-- Index for session lookup
CREATE INDEX IF NOT EXISTS idx_videos_session ON videos(sessionId);

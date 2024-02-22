CREATE TABLE IF NOT EXISTS feeds
  (
     id                       SERIAL PRIMARY KEY,
     title                    TEXT,
     category                 TEXT,
     link                     TEXT,
     valid                    BOOL,
     last_updated_epoch       INTEGER,
     last_added_epoch         INTEGER,
     update_frequency_seconds INTEGER,
     fallback_image           TEXT,
     latest_uids              TEXT,
     UNIQUE (link),
     UNIQUE (title)
  ); 

CREATE TABLE IF NOT EXISTS articles
  (
     id              SERIAL PRIMARY KEY,
     uid             TEXT,
     title           TEXT,
     link            TEXT,
     image           TEXT,
     added_epoch     INTEGER,
     published_epoch INTEGER,
     read_epoch      INTEGER,
     feed_id         INTEGER,
     FOREIGN KEY (feed_id) REFERENCES feeds (id),
     UNIQUE (uid, link)
  );

CREATE INDEX IF NOT EXISTS article_read_index ON articles(read_epoch);

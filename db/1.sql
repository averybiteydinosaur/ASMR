CREATE TABLE IF NOT EXISTS categories
  (
     id    SERIAL PRIMARY KEY,
     title TEXT,
     UNIQUE (title)
  );

CREATE TABLE IF NOT EXISTS feeds
  (
     id                       SERIAL PRIMARY KEY,
     title                    TEXT,
     category_id              INTEGER,
     link                     TEXT,
     valid                    BOOL,
     last_updated_epoch       INTEGER,
     last_added_epoch         INTEGER,
     update_frequency_seconds INTEGER,
     fallback_image           TEXT,
     latest_uids              TEXT,
     FOREIGN KEY (category_id) REFERENCES categories (id),
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

use deadpool_postgres::{Config, Pool, Runtime};
use postgres::NoTls;
use serde::{Deserialize, Serialize};

use crate::api;
use crate::parser;

#[derive(Debug, Deserialize, Serialize)]
pub struct FeedEntry {
    pub id: i32,
    pub title: String, //TODO title category pair to be unique or just title to be unique tbd
    pub category_id: i32,
    pub link: String, //TODO link to be made unique
    pub valid: bool,
    pub last_updated_epoch: i32,
    pub last_added_epoch: i32,
    pub update_frequency_seconds: i32,
    pub fallback_image: String,
    pub latest_uids: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ArticleEntry {
    pub id: i32,
    pub uid: String,
    pub title: String,
    pub link: String,
    pub image: String,
    pub added_epoch: i32,
    pub published_epoch: i32,
    pub read_epoch: i32,
    pub feed_id: i32,
    pub feed_category_id: i32,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CategoryEntry {
    pub id: i32,
    pub title: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct BackupImage {
    pub link: String,
}

fn get_db_config() -> Config {
    let mut config = Config::new();
    config.host = Some("db".to_string());
    config.user = Some("postgres".to_string());
    config.dbname = Some("postgres".to_string());
    config.password = Some("mysecretpassword".to_string());

    config
}

pub async fn startup() -> Pool {
    let config = get_db_config();

    let pool = config.create_pool(Some(Runtime::Tokio1), NoTls).unwrap();
    let client = pool.get().await.unwrap();

    client
        .batch_execute(
            "CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            title TEXT,
            UNIQUE (title)
            )",
        )
        .await
        .unwrap();

    client
        .batch_execute(
            "CREATE TABLE IF NOT EXISTS feeds (
            id SERIAL PRIMARY KEY,
            title TEXT,
            category_id INTEGER,
            link TEXT,
            valid BOOL,
            last_updated_epoch INTEGER,
            last_added_epoch INTEGER,
            update_frequency_seconds INTEGER,
            fallback_image TEXT,
            latest_uids TEXT,
            FOREIGN KEY (category_id) REFERENCES categories (id),
            UNIQUE (link),
            UNIQUE (title)
            )",
        )
        .await
        .unwrap();

    client
        .batch_execute(
            "create TABLE IF NOT EXISTS articles (
            id SERIAL PRIMARY KEY,
            uid TEXT,
            title TEXT,
            link TEXT,
            image TEXT,
            added_epoch INTEGER,
            published_epoch INTEGER,
            read_epoch INTEGER,
            feed_id INTEGER,
            FOREIGN KEY (feed_id) REFERENCES FEEDS (id),
            UNIQUE (uid, link)
            )",
        )
        .await
        .unwrap();

    client
        .batch_execute("CREATE INDEX IF NOT EXISTS article_read_index ON articles(read_epoch)")
        .await
        .unwrap();

    client
        .execute(
            "UPDATE feeds SET last_updated_epoch = ($1)+3*id-update_frequency_seconds",
            &[&parser::seconds_since_epoch()],
        )
        .await
        .unwrap();

    pool
}

pub async fn get_categories(pool: &Pool) -> Vec<CategoryEntry> {
    let pool = pool.clone();

    let conn = pool.get().await.unwrap();
    conn.query("SELECT * from categories", &[])
        .await
        .unwrap()
        .into_iter()
        .map(|row| CategoryEntry {
            id: row.get(0),
            title: row.get(1),
        })
        .collect()
}

pub async fn add_category(pool: &Pool, category: String) {
    let pool = pool.clone();

    let conn = pool.get().await.unwrap();

    let _resp = conn
        .execute(
            "INSERT INTO categories (title) VALUES ($1) ON CONFLICT (title) DO NOTHING",
            &[&category],
        )
        .await
        .unwrap();
}

//TODO remove this and pretify
pub async fn update_feeds(
    pool: &Pool,
    id: i32,
    last_updated_epoch: i32,
    last_added_epoch: i32,
    uid: Vec<String>,
) {
    let pool = pool.clone();

    let conn = pool.get().await.unwrap();

    let latest_uids = serde_json::to_string(&uid).unwrap();

    conn.execute(
        "UPDATE feeds SET last_updated_epoch = $1, last_added_epoch = $2, latest_uids= $3 WHERE id = $4",
        &[&last_updated_epoch, &last_added_epoch, &latest_uids, &id],
    )
        .await
    .expect("issue");
}

pub async fn get_feeds(pool: &Pool) -> Vec<FeedEntry> {
    let pool = pool.clone();

    let conn = pool.get().await.unwrap();
    conn.query("SELECT * from feeds", &[])
        .await
        .unwrap()
        .into_iter()
        .map(|row| FeedEntry {
            id: row.get(0),
            title: row.get(1),
            category_id: row.get(2),
            link: row.get(3),
            valid: row.get(4),
            last_updated_epoch: row.get(5),
            last_added_epoch: row.get(6),
            update_frequency_seconds: row.get(7),
            fallback_image: row.get(8),
            latest_uids: row.get(9),
        })
        .collect()
}

pub async fn backup_image(pool: &Pool, feed_id: i32) -> String {
    let pool = pool.clone();

    let conn = pool.get().await.unwrap();
    conn.query(
        "SELECT fallback_image FROM feeds WHERE id = $1",
        &[&feed_id],
    )
    .await
    .unwrap()
    .get(0)
    .unwrap()
    .get(0)
}

pub async fn add_feeds(pool: &Pool, feeds: Vec<api::IncomingFeed>) {
    let pool = pool.clone();

    let mut conn = pool.get().await.unwrap();
    let transact = conn.transaction().await.unwrap();

    for feed in feeds {
        transact.execute("INSERT INTO feeds (title, category_id, link, valid, last_updated_epoch, last_added_epoch, update_frequency_seconds, fallback_image, latest_uids) SELECT $1, id, $3, $4, $5, $6, $7, $8, $9 FROM categories WHERE title = $2",
        &[&feed.title, &feed.category, &feed.link, &true, &-1_i32, &-1_i32, &feed.update_frequency, &feed.fallback_image, &"[]".to_string()],
        ).await.unwrap();
    }

    let _ = transact.commit().await;
}

pub async fn add_article(pool: &Pool, article: parser::NewArticle) {
    let pool = pool.clone();

    let conn = pool.get().await.unwrap();

    let _resp = conn.execute("INSERT INTO articles (id, uid, title, link, image, added_epoch, published_epoch, read_epoch, feed_id) VALUES (DEFAULT, $1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (uid, link) DO NOTHING",
        &[&article.uid, &article.title, &article.link, &article.image, &article.added_epoch, &article.published_epoch, &0_i32, &article.feed_id],
        ).await.unwrap();
}

pub async fn mark_feeds_valid(pool: &Pool, ids: Vec<i32>) {
    let pool = pool.clone();

    let mut conn = pool.get().await.unwrap();
    let transact = conn.transaction().await.unwrap();

    for id in ids {
        transact
            .execute("UPDATE feeds SET valid=1 WHERE id = (?)", &[&id])
            .await
            .unwrap();
    }

    let _ = transact.commit().await;
}

pub async fn mark_feeds_invalid(pool: &Pool, ids: Vec<i32>) {
    let pool = pool.clone();

    let mut conn = pool.get().await.unwrap();
    let transact = conn.transaction().await.unwrap();

    for id in ids {
        transact
            .execute("UPDATE feeds SET valid=0 WHERE id = (?)", &[&id])
            .await
            .unwrap();
    }

    let _ = transact.commit().await;
}

pub async fn update_articles_read(pool: &Pool, update_details: api::UpdateReadDetails) {
    let pool = pool.clone();
    let conn = pool.get().await.unwrap();

    match update_details.read {
        Some(x) => match x {
            true => {
                let epoch = parser::seconds_since_epoch();
                match update_details.id {
                    Some(id) => {
                        let query =
                            "UPDATE articles SET read_epoch= $1 WHERE id = $2 AND read_epoch=0"
                                .to_string();
                        conn.execute(&query, &[&epoch, &id]).await.unwrap();
                    }
                    None => match update_details.feed_id {
                        Some(feed_id) => {
                            let query = "UPDATE articles SET read_epoch= $1 WHERE feed_id = $2 AND read_epoch=0".to_string();
                            conn.execute(&query, &[&epoch, &feed_id]).await.unwrap();
                        }
                        None => match update_details.category_id {
                            Some(category_id) => {
                                let query = "UPDATE articles SET read_epoch= $1 WHERE feed_id IN (SELECT id FROM feeds WHERE category_id = $2) AND read_epoch=0".to_string();
                                conn.execute(&query, &[&epoch, &category_id]).await.unwrap();
                            }
                            None => println!("oops"),
                        },
                    },
                };
            }
            _ => {
                let epoch = 0;
                match update_details.id {
                    Some(id) => {
                        let query = "UPDATE articles SET read_epoch= $1 WHERE id = $2".to_string();
                        conn.execute(&query, &[&epoch, &id]).await.unwrap();
                    }
                    None => match update_details.feed_id {
                        Some(feed_id) => {
                            let query =
                                "UPDATE articles SET read_epoch= $1 WHERE feed_id = $2".to_string();
                            conn.execute(&query, &[&epoch, &feed_id]).await.unwrap();
                        }
                        None => match update_details.category_id {
                            Some(category_id) => {
                                let query = "UPDATE articles SET read_epoch= $1 WHERE feed_id IN (SELECT id FROM feeds WHERE category_id = $2)".to_string();
                                conn.execute(&query, &[&epoch, &category_id]).await.unwrap();
                            }
                            None => println!("oops"),
                        },
                    },
                };
            }
        },
        None => {
            let query = "UPDATE articles SET read_epoch=0 WHERE read_epoch = (SELECT MAX(read_epoch) from articles)".to_string();
            conn.execute(&query, &[]).await.unwrap();
        }
    };
}

pub async fn get_articles(pool: &Pool, filter: api::Filter) -> Vec<ArticleEntry> {
    let pool = pool.clone();
    let conn = pool.get().await.unwrap();

    dbg!("{}", filter.category_id);
    dbg!("{}", filter.feed);

    let query = match filter.read {
        Some(x) => if x {
            "SELECT articles.*, feeds.category_id FROM articles INNER JOIN feeds ON articles.feed_id=feeds.id WHERE read_epoch > 0 AND feeds.category_id = COALESCE($1, feeds.category_id) AND feeds.id = COALESCE($2, feeds.id) AND articles.id < COALESCE($3, articles.id+1) ORDER by articles.id desc LIMIT 200"
        } else {
            " SELECT articles.*, feeds.category_id FROM articles INNER JOIN feeds ON articles.feed_id=feeds.id WHERE read_epoch < 1 AND feeds.category_id = COALESCE($1, category_id) AND feeds.id = COALESCE($2, feeds.id) AND articles.id < COALESCE($3, articles.id+1) ORDER by articles.id desc LIMIT 200"
        },
        None => "SELECT articles.*, feeds.category_id FROM articles INNER JOIN feeds ON articles.feed_id=feeds.id WHERE feeds.category_id = COALESCE($1, category_id) AND feeds.id = COALESCE($2, feeds.id) AND articles.id < COALESCE($3, articles.id+1) ORDER by articles.id desc LIMIT 200",
    };

    dbg!(query);
    dbg!(&[&filter.category_id, &filter.feed, &filter.before]);

    conn.query(query, &[&filter.category_id, &filter.feed, &filter.before])
        .await
        .unwrap()
        .into_iter()
        .map(|row| ArticleEntry {
            id: row.get(0),
            uid: row.get(1),
            title: row.get(2),
            link: row.get(3),
            image: row.get(4),
            added_epoch: row.get(5),
            published_epoch: row.get(6),
            read_epoch: row.get(7),
            feed_id: row.get(8),
            feed_category_id: row.get(9),
        })
        .collect()
}

pub async fn get_articles_by_search_term(pool: &Pool, search_term: String) -> Vec<ArticleEntry> {
    let pool = pool.clone();
    let conn = pool.get().await.unwrap();

    let query = "SELECT articles.*, feeds.category_id FROM articles INNER JOIN feeds ON articles.feed_id=feeds.id WHERE title LIKE (?) ORDER by last_added_epoch desc LIMIT 200";

    conn.query(query, &[&search_term])
        .await
        .unwrap()
        .into_iter()
        .map(|row| ArticleEntry {
            id: row.get(0),
            uid: row.get(1),
            title: row.get(2),
            link: row.get(3),
            image: row.get(4),
            added_epoch: row.get(5),
            published_epoch: row.get(6),
            read_epoch: row.get(7),
            feed_id: row.get(8),
            feed_category_id: row.get(9),
        })
        .collect()
}

use deadpool_postgres::Pool;
use feed_rs::parser;
use futures::stream::{FuturesUnordered, StreamExt};
use reqwest::header::USER_AGENT;
use serde::{Deserialize, Serialize};
use std::{error, thread, time};
use tokio::runtime::Runtime as Runtime2;

use crate::db;

#[derive(Debug, Deserialize, Serialize)]
pub struct NewArticle {
    pub uid: String,
    pub title: String,
    pub link: String,
    pub image: String,
    pub added_epoch: i32,
    pub published_epoch: i32,
    pub read_epoch: i32,
    pub feed_id: i32,
}

async fn feed_from_link(feed_link: &str) -> Result<feed_rs::model::Feed, Box<dyn error::Error>> {
    let client = reqwest::Client::new();
    let content = client
        .get(feed_link)
        .header(USER_AGENT, "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36")
        .send()
        .await?
        .bytes()
        .await?;
    let channel = parser::parse(&content[..])?;
    Ok(channel)
}

async fn get_image(
    pool: &Pool,
    item_media: Vec<feed_rs::model::MediaObject>,
    feed_id: i32,
) -> String {
    match item_media.len() {
        0 => db::backup_image(pool, feed_id).await,
        1 => match item_media[0].thumbnails.len() {
            0 => item_media[0].content[0]
                .url
                .as_ref()
                .expect("Failed to parse image from feed")
                .as_str(),
            _ => item_media[0].thumbnails[0].image.uri.as_str(),
        }
        .to_string(),
        _ => "Something has gone horribly wrong".to_string(),
    }
}

fn feed_should_run(feed_db_entry: &db::FeedEntry) -> bool {
    feed_db_entry.valid
        && (seconds_since_epoch()
            > feed_db_entry.last_updated_epoch + feed_db_entry.update_frequency_seconds)
}

pub fn seconds_since_epoch() -> i32 {
    time::UNIX_EPOCH
        .elapsed()
        .expect("failed to calucalte seconds since epoch")
        .as_secs() as i32
}

async fn create_article(pool: &Pool, feed_item: feed_rs::model::Entry, feed_id: i32) -> NewArticle {
    NewArticle {
        uid: feed_item.id,
        title: match feed_item.title {
            Some(v) => v.content,
            None => "No title found in RSS feed!".to_string(),
        },
        link: match feed_item.links.get(0) {
            Some(v) => v.href.clone(),
            None => "https://www.google.com/search?q=do+a+barrel+roll".to_string(),
        },
        image: get_image(pool, feed_item.media, feed_id).await,
        added_epoch: seconds_since_epoch(),
        published_epoch: 0,
        read_epoch: 0,
        feed_id,
    }
}

async fn add_new_entries(
    pool: &Pool,
    feed: feed_rs::model::Feed,
    mut feed_db_entry: db::FeedEntry,
) {
    let previous_uids: Vec<String> = serde_json::from_str(&feed_db_entry.latest_uids)
        .expect("failed to parse previous UIDs as JSON"); //Array was stored as DB string

    let mut current_uids = vec![];

    let feed_items = feed.entries.into_iter().rev(); //Fixes ordering for front end for comics and similar that update a week all at once in one feed update

    for feed_item in feed_items {
        current_uids.push(feed_item.id.clone());

        if !previous_uids.contains(&feed_item.id) {
            let new_article = create_article(pool, feed_item, feed_db_entry.id).await;

            db::add_article(pool, new_article).await;
            feed_db_entry.last_added_epoch = seconds_since_epoch();
        }
    }

    db::update_feeds(
        pool,
        feed_db_entry.id,
        seconds_since_epoch(), //last_updated_epoch
        feed_db_entry.last_added_epoch,
        current_uids,
    )
    .await
}

pub async fn update_feeds(pool: &Pool, feed_db_entries: Vec<db::FeedEntry>) {
    let mut workers = FuturesUnordered::new();

    for feed_db_entry in feed_db_entries {
        if feed_should_run(&feed_db_entry) {
            workers.push(update_feed(pool, feed_db_entry))
        }
    }

    loop {
        match workers.next().await {
            Some(feed_link) => match feed_link {
                Ok(_feed_link) => (), //println!("{}", feed_link),
                Err(error) => println!("{}", error),
            },
            None => {
                break;
            }
        }
    }
}

pub async fn update_feed(
    pool: &Pool,
    feed_db_entry: db::FeedEntry,
) -> Result<String, Box<dyn error::Error>> {
    let link = feed_db_entry.link.clone();
    let feed = match feed_from_link(&feed_db_entry.link).await {
        Ok(resp) => resp,
        Err(e) => {
            eprintln!("{}", feed_db_entry.link);
            return Err(e);
        }
    };

    add_new_entries(pool, feed, feed_db_entry).await;
    Ok(link.to_string())
}

pub fn reader(pool: Pool) {
    let rt = Runtime2::new().expect("failed to create initial runtime");

    loop {
        let _now = time::Instant::now(); //TODO REMOVE ME

        let feed_db_entries = rt.block_on(db::get_feeds(&pool));

        rt.block_on(update_feeds(&pool, feed_db_entries));

        //println!("{}", now.elapsed().as_secs()); //TODO REMOVE ME
        thread::sleep(time::Duration::from_secs(10));
    }
}

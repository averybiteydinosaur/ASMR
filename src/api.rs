use actix_web::{get, http::header::ContentType, post, put, web, HttpResponse};
use deadpool_postgres::Pool;
use serde::{Deserialize, Serialize};

use crate::db;

#[derive(Debug, Deserialize, Serialize)]
pub struct IncomingFeed {
    pub title: String,
    pub category: String,
    pub link: String,
    pub fallback_image: String,
    pub update_frequency: i32,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct IncomingCategory {
    category: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct IncomingFeeds {
    feeds: Vec<IncomingFeed>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Ids {
    ids: Vec<i32>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateReadDetails {
    pub read: Option<bool>,
    pub id: Option<i32>,
    pub feed_id: Option<i32>,
    pub category: Option<String>,
    pub last_id: Option<i32>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Category {
    name: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Filter {
    pub before: Option<i32>,
    pub category: Option<String>,
    pub feed: Option<i32>,
    pub read: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SearchTerm {
    pub term: String,
}

#[get("api")]
pub async fn list_endpoints() -> HttpResponse {
    HttpResponse::Ok()
        .content_type(ContentType::json())
        .json(vec![
            "feeds",
            "feeds/mark_valid",           //to retire
            "feeds/mark_invalid",         //to retire
            "feeds/articles/list",        //done
            "feeds/articles/list_unread", //done
            "feeds/articles/list_search",
            "feeds/articles/mark_read",
            "feeds/articles/mark_unread",
            "feeds/articles/mark_read_undo",
        ])
}

#[get("api/categories")]
pub async fn categories_list(db: web::Data<Pool>) -> HttpResponse {
    let categories = db::get_categories(&db).await;

    HttpResponse::Ok()
        .content_type(ContentType::json())
        .json(categories)
}

#[post("api/categories")]
pub async fn category_add(
    db: web::Data<Pool>,
    incomingcategory: web::Json<IncomingCategory>,
) -> HttpResponse {
    db::add_category(&db, incomingcategory.into_inner().category).await;

    HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body("Seemed to work")
}

#[get("api/feeds")]
pub async fn feeds_list(db: web::Data<Pool>) -> HttpResponse {
    let feeds = db::get_feeds(&db).await;

    HttpResponse::Ok()
        .content_type(ContentType::json())
        .json(feeds)
}

//TODO fix this curl -k -H 'Content-Type: application/json' -X POST https://blackbox/api/feeds -d '{"feeds": [{"title":"Book title","category":"Books","link":"https://examplelinkhere"}]}'
#[post("api/feeds")]
pub async fn feeds_add(
    db: web::Data<Pool>,
    incomingfeeds: web::Json<IncomingFeeds>,
) -> HttpResponse {
    db::add_feeds(&db, incomingfeeds.into_inner().feeds).await;

    HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body("Seemed to work")
}

#[put("api/feeds/mark_valid")] //TODO combine to #[put("feeds")] for general updates
pub async fn feeds_mark_valid(db: web::Data<Pool>, feedids: web::Json<Ids>) -> HttpResponse {
    db::mark_feeds_valid(&db, feedids.into_inner().ids).await;

    HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body("Seemed to work")
}

#[put("api/feeds/mark_invalid")] //TODO combine to #[put("feeds")] for general updates
pub async fn feeds_mark_invalid(db: web::Data<Pool>, feedids: web::Json<Ids>) -> HttpResponse {
    db::mark_feeds_invalid(&db, feedids.into_inner().ids).await;

    HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body("Seemed to work")
}

#[get("api/feeds/articles")]
pub async fn list_articles(db: web::Data<Pool>, filter: web::Query<Filter>) -> HttpResponse {
    let feeds = db::get_articles(&db, filter.into_inner()).await;

    HttpResponse::Ok()
        .content_type(ContentType::json())
        .json(feeds)
}

#[get("api/feeds/articles_list_search")] //TODO combine to #[get("feeds/articles")]
pub async fn list_articles_by_search_term(
    db: web::Data<Pool>,
    search_term: web::Query<SearchTerm>,
) -> HttpResponse {
    let feeds = db::get_articles_by_search_term(&db, search_term.into_inner().term).await;

    HttpResponse::Ok()
        .content_type(ContentType::json())
        .json(feeds)
}

#[put("api/feeds/articles_update_read")] //TODO combine to #[put("feeds/articles")]
pub async fn articles_update_read(
    db: web::Data<Pool>,
    update_details: web::Query<UpdateReadDetails>,
) -> HttpResponse {
    db::update_articles_read(&db, update_details.into_inner()).await;

    HttpResponse::Ok()
        .content_type(ContentType::plaintext())
        .body("Seemed to work")
}

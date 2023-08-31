use actix_files;
use actix_web::{web, App, HttpServer};
use clap::Parser;
use std::thread;

mod api;
mod db;
mod parser;

/// Web based RSS reader
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Port to run on
    #[arg(short, long, default_value_t = 8080)]
    port: u16,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let args = Args::parse();

    if args.port < 1025 {
        println!("WARNING: ports under 1024 are system reserved by default, this may cause permission/connection issues");
    }

    let pool = db::startup().await;

    let pool_clone = pool.clone();

    thread::spawn(move || {
        parser::reader(pool_clone);
    });

    println!("starting HTTP server at http://localhost:{}", args.port);
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(pool.clone())) //Pool is an Arc under the hood, so clone is just an incremented reference to the pool
            .service(api::list_endpoints)
            .service(api::feeds_list)
            .service(api::category_add)
            .service(api::feeds_add)
            .service(api::feeds_mark_valid)
            .service(api::feeds_mark_invalid)
            .service(api::list_articles)
            .service(api::list_articles_by_search_term)
            .service(api::articles_update_read)
            .service(actix_files::Files::new("/", "static").index_file("RSS.html"))
    })
    .bind(("0.0.0.0", args.port))?
    .run()
    .await
}

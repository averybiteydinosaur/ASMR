ARG RUST_VERSION=1.76.0
FROM rust:${RUST_VERSION}-slim-bookworm AS builder

RUN cargo new rss
WORKDIR rss
COPY Cargo.toml Cargo.lock ./
RUN cargo build --locked --release

COPY src src

RUN set -e && \
    touch src/main.rs && \
    cargo build --locked --release 

FROM debian:bookworm-slim AS final

RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/nonexistent" \
    --shell "/sbin/nologin" \
    --no-create-home \
    --uid "10001" \
    appuser
USER appuser
   
COPY --from=builder /rss/target/release/rss /bin/rss
COPY static/ /static

EXPOSE 8080
   
CMD ["/bin/rss"]

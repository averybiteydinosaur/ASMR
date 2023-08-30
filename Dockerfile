ARG RUST_VERSION=1.71.1
FROM rust:${RUST_VERSION}-slim-bookworm AS builder

RUN --mount=type=bind,source=src,target=src \
    --mount=type=bind,source=Cargo.toml,target=Cargo.toml \
    --mount=type=bind,source=Cargo.lock,target=Cargo.lock \
    --mount=type=cache,target=/app/target/ \
    set -e && \
    cargo build --locked --release && \
    pwd && \
    cp ./target/release/rss /bin/rss 

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
   
COPY --from=builder /bin/rss /bin/rss
COPY static/ /static

EXPOSE 8080
   
CMD ["/bin/rss"]

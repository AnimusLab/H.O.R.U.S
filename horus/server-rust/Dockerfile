FROM rust:1.88-bookworm AS build
WORKDIR /src
COPY server-rust/Cargo.toml server-rust/Cargo.lock* ./server-rust/
COPY server-rust/build.rs ./server-rust/build.rs
COPY server-rust/src ./server-rust/src
COPY engine-cpp ./engine-cpp
RUN cargo build --release --manifest-path server-rust/Cargo.toml

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install --no-install-recommends -y curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/server-rust/target/release/horus-server /usr/local/bin/horus-server
EXPOSE 4000
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/horus-server"]

FROM rust:1.88-bookworm AS build
WORKDIR /src
COPY eidolon-proxy/Cargo.toml eidolon-proxy/Cargo.lock* ./eidolon-proxy/
COPY eidolon-proxy/src ./eidolon-proxy/src
RUN cargo build --release --manifest-path eidolon-proxy/Cargo.toml

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install --no-install-recommends -y curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/eidolon-proxy/target/release/eidolon-gateway /usr/local/bin/eidolon-gateway
EXPOSE 5000
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/eidolon-gateway"]

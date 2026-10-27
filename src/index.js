// novx-proxy — minimal self-written Emby reverse proxy for NOVX Player.
//
// Design (deliberately minimal):
//   - One upstream only, taken from the Worker environment variable
//     UPSTREAM_URL (set by the deployer in their own Cloudflare dashboard,
//     e.g. https://your-emby-server:8096). No other upstream exists.
//   - Anti open-relay: the target host NEVER comes from the request.
//     Path, query, headers and parameters are never used to pick a host;
//     everything is forwarded to UPSTREAM_URL and nothing else.
//   - Passthrough: method, path, query, request headers (except Host),
//     request body, response status/headers/body are forwarded as-is.
//     Range requests pass through untouched, so 206 partial content works.
//   - Accept-Encoding is forced to identity: the Workers runtime may
//     decompress a gzipped upstream body while keeping the
//     content-encoding header, which would corrupt the stream. Forcing
//     identity keeps body and headers byte-consistent (Emby API payloads
//     are small; media is not gzipped anyway).
//   - WebSocket is NOT proxied in this version (returns 501).
//   - No panel, no bot, no D1/KV, no CORS rewriting.

export default {
  async fetch(request, env, ctx) {
    const configured = (env.UPSTREAM_URL || "").replace(/\/+$/, "");
    if (!configured) {
      return new Response("UPSTREAM_URL is not configured", { status: 500 });
    }

    let base;
    try {
      base = new URL(configured);
    } catch {
      return new Response("UPSTREAM_URL is invalid", { status: 500 });
    }
    if (base.protocol !== "http:" && base.protocol !== "https:") {
      return new Response("UPSTREAM_URL must be http(s)", { status: 500 });
    }

    // WebSocket upgrade: not proxied in this version.
    if (request.headers.get("Upgrade") === "websocket") {
      return new Response("WebSocket is not proxied in this version", {
        status: 501,
      });
    }

    const incoming = new URL(request.url);

    // Join base path (if the deployer put Emby under a sub-path) with the
    // incoming path. The leading "/" of the incoming path replaces the
    // base path in plain URL resolution, so join manually.
    const basePath = base.pathname.replace(/\/+$/, "");
    const targetPath =
      basePath === "" || basePath === "/"
        ? incoming.pathname
        : basePath + incoming.pathname;
    const target = new URL(targetPath + incoming.search, base);

    const headers = new Headers(request.headers);
    headers.delete("Host"); // fetch() sets Host from the target URL.
    headers.delete("connection"); // hop-by-hop header, must not be forwarded.
    headers.set("Accept-Encoding", "identity"); // see header comment.

    const init = {
      method: request.method,
      headers,
      redirect: "manual", // pass 3xx through as-is, do not follow.
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
      init.duplex = "half"; // required for streaming request bodies.
    }

    let upstreamResp;
    try {
      upstreamResp = await fetch(target.toString(), init);
    } catch {
      return new Response("Upstream fetch failed", { status: 502 });
    }

    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      statusText: upstreamResp.statusText,
      headers: upstreamResp.headers,
    });
  },
};

/**
 * CloudBreak — VLESS + VMess over WebSocket on Cloudflare Workers
 * Protocol: VLESS (RFC-ish) over WebSocket, TLS terminated by Cloudflare
 * DPI evasion: Cloudflare provides genuine TLS cert + valid SNI → traffic
 *              is indistinguishable from normal HTTPS to any DPI appliance.
 *
 * Environment variables (set via wrangler deploy --var or dashboard):
 *   UUID        — VLESS authentication UUID (required)
 *   WS_PATH     — WebSocket endpoint path (default: "/ws")
 *   PROXYIP     — Optional chaining IP; if set, all TCP connects go here:443
 *   DEPLOY_TIME — Informational timestamp injected at deploy time
 */

import { connect } from "cloudflare:sockets";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a UUID string ("xxxxxxxx-xxxx-…") to a 16-byte Uint8Array. */
function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32) throw new Error("Invalid UUID length");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Compare two Uint8Arrays for equality. */
function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Parse the VLESS request header from a raw byte buffer.
 *
 * VLESS header layout (version 0):
 *   [0]      — version (must be 0x00)
 *   [1..16]  — UUID (16 bytes)
 *   [17]     — addons length (M)
 *   [18..17+M] — addons data (skip)
 *   [18+M]   — command (0x01 = TCP)
 *   [19+M, 20+M] — destination port (big-endian uint16)
 *   [21+M]   — address type
 *                0x01 → IPv4  (4 bytes)
 *                0x02 → domain (1-byte length + N bytes)
 *                0x03 → IPv6  (16 bytes)
 *   [...]    — address bytes
 *   [rest]   — initial payload
 *
 * Returns { uuid, command, port, address, payloadOffset } or throws.
 */
function parseVlessHeader(buf) {
  const view = new DataView(buf);
  let offset = 0;

  // Version
  const version = view.getUint8(offset++);
  if (version !== 0x00) throw new Error(`Unsupported VLESS version: ${version}`);

  // UUID (16 bytes)
  const uuid = new Uint8Array(buf, offset, 16);
  offset += 16;

  // Addons
  const addonsLen = view.getUint8(offset++);
  offset += addonsLen;

  // Command
  const command = view.getUint8(offset++);

  // Port (big-endian uint16)
  const port = view.getUint16(offset, false);
  offset += 2;

  // Address type + address
  const addrType = view.getUint8(offset++);
  let address;

  if (addrType === 0x01) {
    // IPv4
    address = `${view.getUint8(offset)}.${view.getUint8(offset + 1)}.${view.getUint8(offset + 2)}.${view.getUint8(offset + 3)}`;
    offset += 4;
  } else if (addrType === 0x02) {
    // Domain name
    const domainLen = view.getUint8(offset++);
    address = new TextDecoder().decode(new Uint8Array(buf, offset, domainLen));
    offset += domainLen;
  } else if (addrType === 0x03) {
    // IPv6
    const parts = [];
    for (let i = 0; i < 8; i++) {
      parts.push(view.getUint16(offset, false).toString(16));
      offset += 2;
    }
    address = `[${parts.join(":")}]`;
  } else {
    throw new Error(`Unknown address type: ${addrType}`);
  }

  return { uuid, command, port, address, payloadOffset: offset };
}

// ---------------------------------------------------------------------------
// Subscription link generators
// ---------------------------------------------------------------------------

function makeVlessLink(uuid, host, wsPath) {
  const params = new URLSearchParams({
    encryption: "none",
    security: "tls",
    sni: host,
    fp: "chrome",
    type: "ws",
    host: host,
    path: wsPath,
    alpn: "h2,http/1.1",
  });
  return `vless://${uuid}@${host}:443?${params.toString()}#CF-VLESS-IR`;
}

function makeVmessLink(uuid, host, wsPath) {
  const config = {
    v: "2",
    ps: "CF-VMess-IR",
    add: host,
    port: 443,
    id: uuid,
    aid: 0,
    net: "ws",
    type: "none",
    host: host,
    path: wsPath,
    tls: "tls",
    sni: host,
    alpn: "h2,http/1.1",
    fp: "chrome",
  };
  return `vmess://${btoa(JSON.stringify(config))}`;
}

// ---------------------------------------------------------------------------
// WebSocket proxy handler
// ---------------------------------------------------------------------------

async function handleWebSocket(request, env) {
  const { UUID, PROXYIP } = env;

  // Validate UUID env var is present
  if (!UUID) {
    return new Response("UUID environment variable not configured", { status: 500 });
  }

  let expectedUuidBytes;
  try {
    expectedUuidBytes = uuidToBytes(UUID);
  } catch {
    return new Response("Invalid UUID format in environment", { status: 500 });
  }

  // Must be a WebSocket upgrade
  const upgradeHeader = request.headers.get("Upgrade");
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
    return new Response(
      "This endpoint requires a WebSocket connection (Upgrade: websocket)",
      { status: 426, headers: { Upgrade: "websocket" } }
    );
  }

  // Create WebSocket pair — server side used by this worker, client side
  // sent back to the connecting client.
  const [clientWs, serverWs] = new WebSocketPair();
  serverWs.accept();

  // Track the TCP socket so we can clean it up
  let tcpSocket = null;
  let tcpWriter = null;
  let connectionEstablished = false;

  // We resolve this promise when the proxy session ends so the handler
  // can keep the worker alive for the duration of the connection.
  let resolveSession;
  const sessionDone = new Promise((r) => (resolveSession = r));

  // ------------------------------------------------------------------
  // Incoming WebSocket messages from the client
  // ------------------------------------------------------------------
  serverWs.addEventListener("message", async (event) => {
    try {
      const rawData = event.data;

      // ArrayBuffer for binary frames, string for text (shouldn't happen)
      const buf =
        rawData instanceof ArrayBuffer
          ? rawData
          : new TextEncoder().encode(rawData).buffer;

      if (!connectionEstablished) {
        // ----------------------------------------------------------------
        // First message — must contain the VLESS header
        // ----------------------------------------------------------------
        let parsed;
        try {
          parsed = parseVlessHeader(buf);
        } catch (err) {
          console.error("VLESS header parse failed:", err.message);
          serverWs.close(1002, "Bad VLESS header");
          resolveSession();
          return;
        }

        // Validate UUID
        if (!bytesEqual(parsed.uuid, expectedUuidBytes)) {
          console.error("UUID mismatch — rejecting connection");
          serverWs.close(1008, "Unauthorized");
          resolveSession();
          return;
        }

        // Only TCP (0x01) is supported
        if (parsed.command !== 0x01) {
          console.warn(`Unsupported VLESS command: ${parsed.command}`);
          serverWs.close(1003, "Unsupported command");
          resolveSession();
          return;
        }

        // ----------------------------------------------------------------
        // Determine destination
        // If PROXYIP is configured, chain through it (useful for countries
        // where workers.dev itself is blocked — route via a relay IP).
        // ----------------------------------------------------------------
        const destHost = PROXYIP || parsed.address;
        const destPort = PROXYIP ? 443 : parsed.port;

        // Open TCP connection to destination
        try {
          tcpSocket = connect({ hostname: destHost, port: destPort });
          tcpWriter = tcpSocket.writable.getWriter();
        } catch (err) {
          console.error("TCP connect failed:", err.message);
          serverWs.close(1011, "TCP connection failed");
          resolveSession();
          return;
        }

        // Send VLESS response header: [version=0x00, addon_length=0x00]
        serverWs.send(new Uint8Array([0x00, 0x00]));
        connectionEstablished = true;

        // Forward any payload bytes that arrived after the VLESS header
        if (parsed.payloadOffset < buf.byteLength) {
          const initialPayload = buf.slice(parsed.payloadOffset);
          await tcpWriter.write(new Uint8Array(initialPayload));
        }

        // ----------------------------------------------------------------
        // Pump TCP → WebSocket in background
        // ----------------------------------------------------------------
        (async () => {
          try {
            const reader = tcpSocket.readable.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              serverWs.send(value);
            }
          } catch (err) {
            // Remote closed connection — normal
          } finally {
            try { serverWs.close(1000, "Remote closed"); } catch {}
            resolveSession();
          }
        })();

      } else {
        // ----------------------------------------------------------------
        // Subsequent messages — raw proxy data
        // ----------------------------------------------------------------
        await tcpWriter.write(new Uint8Array(buf));
      }
    } catch (err) {
      console.error("WebSocket message handler error:", err.message);
      try { serverWs.close(1011, "Internal error"); } catch {}
      resolveSession();
    }
  });

  serverWs.addEventListener("close", async () => {
    try {
      if (tcpWriter) {
        await tcpWriter.close();
      }
    } catch {}
    resolveSession();
  });

  serverWs.addEventListener("error", (err) => {
    console.error("WebSocket error:", err.message);
    resolveSession();
  });

  // Return the 101 Switching Protocols response
  const response = new Response(null, {
    status: 101,
    webSocket: clientWs,
  });

  // Keep the worker alive for the duration of the proxy session
  // (Cloudflare requires we await something to prevent early exit)
  sessionDone.then(() => {});

  return response;
}

// ---------------------------------------------------------------------------
// Subscription endpoint (/sub)
// ---------------------------------------------------------------------------

function handleSub(request, env) {
  const { UUID, WS_PATH = "/ws" } = env;
  if (!UUID) {
    return new Response("UUID not configured", { status: 500 });
  }

  const host = request.headers.get("Host") || "your-worker.workers.dev";
  const vlessLink = makeVlessLink(UUID, host, WS_PATH);
  const vmessLink = makeVmessLink(UUID, host, WS_PATH);

  const combined = `${vlessLink}\n${vmessLink}`;
  const b64 = btoa(combined);

  return new Response(b64, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// ---------------------------------------------------------------------------
// Health endpoint (/health)
// ---------------------------------------------------------------------------

function handleHealth(request, env) {
  const { UUID, WS_PATH = "/ws", DEPLOY_TIME = "unknown" } = env;
  const host = request.headers.get("Host") || "unknown";

  const data = {
    status: "ok",
    worker: "CloudBreak",
    protocols: ["vless", "vmess"],
    transport: "websocket",
    tls: "cloudflare",
    host,
    ws_path: WS_PATH,
    uuid_configured: Boolean(UUID),
    deployed: DEPLOY_TIME,
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

// ---------------------------------------------------------------------------
// Root endpoint (/)
// ---------------------------------------------------------------------------

function handleRoot() {
  return new Response("CloudBreak Worker — Active", {
    headers: { "Content-Type": "text/plain" },
  });
}

// ---------------------------------------------------------------------------
// Main fetch handler (ES module export)
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const wsPath = env.WS_PATH || "/ws";

    // Route requests
    if (path === wsPath) {
      return handleWebSocket(request, env);
    }

    if (path === "/sub") {
      return handleSub(request, env);
    }

    if (path === "/health") {
      return handleHealth(request, env);
    }

    if (path === "/") {
      return handleRoot();
    }

    return new Response("Not Found", { status: 404 });
  },
};

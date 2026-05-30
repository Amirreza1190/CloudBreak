/**
 * CloudBreak Worker — VLESS over WebSocket
 * Uses dynamic import for cloudflare:sockets to avoid module-level crash (Error 1101)
 */

// ---------------------------------------------------------------------------
// UUID helpers
// ---------------------------------------------------------------------------
const byteToHex = [];
for (let i = 0; i < 256; i++) byteToHex.push((i + 256).toString(16).slice(1));

function stringify(arr, offset = 0) {
  return (
    byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] +
    byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' +
    byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' +
    byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' +
    byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' +
    byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] +
    byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] +
    byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]
  ).toLowerCase();
}

function isValidUUID(uuid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

// ---------------------------------------------------------------------------
// Link generators
// ---------------------------------------------------------------------------
function makeVlessLink(uuid, host, wsPath) {
  const p = new URLSearchParams({
    encryption: 'none', security: 'tls', sni: host,
    fp: 'chrome', type: 'ws', host, path: wsPath, alpn: 'h2,http/1.1',
  });
  return `vless://${uuid}@${host}:443?${p}#CF-VLESS-IR`;
}

function makeVmessLink(uuid, host, wsPath) {
  const cfg = {
    v: '2', ps: 'CF-VMess-IR', add: host, port: 443, id: uuid,
    aid: 0, net: 'ws', type: 'none', host, path: wsPath,
    tls: 'tls', sni: host, alpn: 'h2,http/1.1', fp: 'chrome',
  };
  return 'vmess://' + btoa(JSON.stringify(cfg));
}

// ---------------------------------------------------------------------------
// VLESS header parser
// ---------------------------------------------------------------------------
function parseVlessHeader(buf, expectedUUID) {
  if (buf.byteLength < 24) return { error: 'too short' };

  const view = new DataView(buf);
  let offset = 0;

  // version must be 0
  if (view.getUint8(offset++) !== 0) return { error: 'bad version' };

  // UUID — 16 bytes
  const uuidBytes = new Uint8Array(buf, offset, 16);
  offset += 16;
  const uuid = stringify(uuidBytes);
  if (uuid !== expectedUUID.toLowerCase()) return { error: 'uuid mismatch' };

  // addons
  const addonsLen = view.getUint8(offset++);
  offset += addonsLen;

  // command — only TCP (0x01)
  const cmd = view.getUint8(offset++);
  if (cmd !== 1) return { error: `unsupported cmd ${cmd}` };

  // port
  const port = view.getUint16(offset, false);
  offset += 2;

  // address type
  const addrType = view.getUint8(offset++);
  let address = '';

  if (addrType === 1) {
    // IPv4
    address = Array.from(new Uint8Array(buf, offset, 4)).join('.');
    offset += 4;
  } else if (addrType === 2) {
    // domain
    const len = view.getUint8(offset++);
    address = new TextDecoder().decode(new Uint8Array(buf, offset, len));
    offset += len;
  } else if (addrType === 3) {
    // IPv6
    const parts = [];
    for (let i = 0; i < 8; i++) {
      parts.push(view.getUint16(offset, false).toString(16));
      offset += 2;
    }
    address = `[${parts.join(':')}]`;
  } else {
    return { error: `unknown addrType ${addrType}` };
  }

  return { address, port, payloadStart: offset };
}

// ---------------------------------------------------------------------------
// Safe WebSocket close
// ---------------------------------------------------------------------------
function safeClose(ws, code = 1000, reason = '') {
  try {
    if (ws.readyState < 2) ws.close(code, reason);
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// WebSocket → TCP pump
// ---------------------------------------------------------------------------
async function proxyWsToTcp(ws, uuid, proxyIP) {
  // Dynamic import — avoids module-level Error 1101
  const { connect } = await import('cloudflare:sockets');

  const { promise: done, resolve } = Promise.withResolvers
    ? Promise.withResolvers()
    : (() => { let r; const p = new Promise(res => r = res); return { promise: p, resolve: r }; })();

  let tcpWriter = null;
  let headerDone = false;
  let vlessRespSent = false;

  ws.accept();

  ws.addEventListener('message', async ({ data }) => {
    try {
      const buf = data instanceof ArrayBuffer ? data : await new Blob([data]).arrayBuffer();

      // First message — parse VLESS header
      if (!headerDone) {
        headerDone = true;
        const parsed = parseVlessHeader(buf, uuid);
        if (parsed.error) {
          console.error('VLESS parse error:', parsed.error);
          safeClose(ws, 1002, parsed.error);
          resolve();
          return;
        }

        const destHost = proxyIP || parsed.address;
        const destPort = proxyIP ? 443 : parsed.port;

        let tcpSocket;
        try {
          tcpSocket = connect({ hostname: destHost, port: destPort });
        } catch (e) {
          console.error('TCP connect failed:', e);
          safeClose(ws, 1011, 'tcp fail');
          resolve();
          return;
        }

        tcpWriter = tcpSocket.writable.getWriter();

        // Send VLESS response header
        ws.send(new Uint8Array([0x00, 0x00]));
        vlessRespSent = true;

        // Forward payload bytes after header
        if (parsed.payloadStart < buf.byteLength) {
          await tcpWriter.write(new Uint8Array(buf, parsed.payloadStart));
        }

        // TCP → WS pump
        (async () => {
          try {
            const reader = tcpSocket.readable.getReader();
            while (true) {
              const { done: rdone, value } = await reader.read();
              if (rdone) break;
              if (ws.readyState === 1) ws.send(value);
            }
          } catch (e) {
            console.error('TCP read error:', e);
          } finally {
            safeClose(ws, 1000, 'remote closed');
            resolve();
          }
        })();

        return;
      }

      // Subsequent messages — forward raw bytes to TCP
      if (tcpWriter) {
        await tcpWriter.write(new Uint8Array(buf));
      }
    } catch (e) {
      console.error('ws message handler error:', e);
      safeClose(ws, 1011, 'error');
      resolve();
    }
  });

  ws.addEventListener('close', () => {
    if (tcpWriter) {
      tcpWriter.close().catch(() => {});
    }
    resolve();
  });

  ws.addEventListener('error', (e) => {
    console.error('ws error:', e);
    resolve();
  });

  return done;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export default {
  async fetch(request, env) {
    const uuid    = env.UUID;
    const wsPath  = env.WS_PATH  || '/ws';
    const proxyIP = env.PROXYIP  || '';
    const deployT = env.DEPLOY_TIME || 'unknown';

    // UUID is required
    if (!uuid || !isValidUUID(uuid)) {
      return new Response(
        'CloudBreak: UUID environment variable is not set or invalid.\n' +
        'Set it via wrangler.toml [vars] or --var UUID:your-uuid',
        { status: 500 }
      );
    }

    const url  = new URL(request.url);
    const path = url.pathname;
    const host = request.headers.get('Host') || url.hostname;

    // ── WebSocket proxy endpoint ────────────────────────────────────────────
    if (path === wsPath) {
      const upgrade = request.headers.get('Upgrade') || '';
      if (upgrade.toLowerCase() !== 'websocket') {
        return new Response(
          'CloudBreak: This endpoint requires a WebSocket upgrade.',
          { status: 426, headers: { Upgrade: 'websocket' } }
        );
      }

      const [client, server] = Object.values(new WebSocketPair());
      const done = proxyWsToTcp(server, uuid, proxyIP);

      // Keep worker alive for duration of connection
      const resp = new Response(null, { status: 101, webSocket: client });
      done.then(() => {}).catch(() => {});
      return resp;
    }

    // ── /sub ───────────────────────────────────────────────────────────────
    if (path === '/sub') {
      const vless = makeVlessLink(uuid, host, wsPath);
      const vmess = makeVmessLink(uuid, host, wsPath);
      const body  = btoa(vless + '\n' + vmess);
      return new Response(body, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    // ── /health ────────────────────────────────────────────────────────────
    if (path === '/health') {
      return new Response(JSON.stringify({
        status:          'ok',
        worker:          'CloudBreak',
        protocols:       ['vless', 'vmess'],
        transport:       'websocket',
        tls:             'cloudflare',
        host,
        ws_path:         wsPath,
        uuid_configured: true,
        proxy_ip:        proxyIP || null,
        deployed:        deployT,
        timestamp:       new Date().toISOString(),
      }, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    }

    // ── / ──────────────────────────────────────────────────────────────────
    if (path === '/') {
      return new Response('CloudBreak Worker — Active', {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};

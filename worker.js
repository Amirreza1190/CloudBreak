/**
 * CloudBreak Worker — VLESS over WebSocket on Cloudflare Workers
 * Core engine based on zizifn/edgetunnel (battle-tested implementation)
 * Added: /health endpoint, /sub subscription endpoint, /UUID config page
 */

import { connect } from 'cloudflare:sockets';

// ---------------------------------------------------------------------------
// Config — overridden by env vars set in wrangler.toml at deploy time
// ---------------------------------------------------------------------------
let userID   = 'd342d11e-d424-4583-b36e-524ab1f0afa4';
let proxyIP  = '';
let wsPath   = '/ws';

if (!isValidUUID(userID)) {
  throw new Error('uuid is not valid');
}

// ---------------------------------------------------------------------------
// Main fetch handler
// ---------------------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    try {
      // Pull config from env (set via wrangler.toml [vars])
      userID  = env.UUID    || userID;
      proxyIP = env.PROXYIP || proxyIP;
      wsPath  = env.WS_PATH || wsPath;

      const upgradeHeader = request.headers.get('Upgrade');
      const url = new URL(request.url);
      const host = request.headers.get('Host') || url.hostname;

      // WebSocket upgrade → proxy handler
      if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
        return await vlessOverWSHandler(request);
      }

      // HTTP routes
      switch (url.pathname) {
        case '/':
          return new Response('CloudBreak Worker — Active', {
            headers: { 'Content-Type': 'text/plain' },
          });

        case '/health':
          return new Response(JSON.stringify({
            status:          'ok',
            worker:          'CloudBreak',
            protocol:        'vless',
            transport:       'websocket',
            tls:             'cloudflare',
            host:            host,
            ws_path:         wsPath,
            uuid_configured: Boolean(env.UUID),
            deployed:        env.DEPLOY_TIME || 'unknown',
            timestamp:       new Date().toISOString(),
          }, null, 2), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
            },
          });

        case '/sub': {
          // Base64-encoded subscription feed (VLESS + optional VMess)
          const vlessLink = makeVlessLink(userID, host, wsPath);
          const b64 = btoa(vlessLink);
          return new Response(b64, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          });
        }

        case `/${userID}`: {
          // Human-readable config page (original edgetunnel style)
          return new Response(getVLESSConfig(userID, host, wsPath), {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }

        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (err) {
      return new Response(String(err), { status: 500 });
    }
  },
};

// ---------------------------------------------------------------------------
// VLESS over WebSocket handler
// ---------------------------------------------------------------------------
async function vlessOverWSHandler(request) {
  const webSocketPair = new WebSocketPair();
  const [client, webSocket] = Object.values(webSocketPair);

  webSocket.accept();

  let address          = '';
  let portWithRandomLog = '';

  const log = (info, event) => {
    console.log(`[${address}:${portWithRandomLog}] ${info}`, event || '');
  };

  const earlyDataHeader    = request.headers.get('sec-websocket-protocol') || '';
  const readableWSStream   = makeReadableWebSocketStream(webSocket, earlyDataHeader, log);

  let remoteSocketWrapper = { value: null };
  let udpStreamWrite      = null;
  let isDns               = false;

  // WS → remote
  readableWSStream.pipeTo(new WritableStream({
    async write(chunk, controller) {
      if (isDns && udpStreamWrite) {
        return udpStreamWrite(chunk);
      }

      if (remoteSocketWrapper.value) {
        const writer = remoteSocketWrapper.value.writable.getWriter();
        await writer.write(chunk);
        writer.releaseLock();
        return;
      }

      const {
        hasError, message,
        portRemote = 443,
        addressRemote = '',
        rawDataIndex,
        vlessVersion = new Uint8Array([0, 0]),
        isUDP,
      } = processVlessHeader(chunk, userID);

      address           = addressRemote;
      portWithRandomLog = `${portRemote}--${Math.random()} ${isUDP ? 'udp' : 'tcp'}`;

      if (hasError) {
        throw new Error(message);
      }

      if (isUDP) {
        if (portRemote === 53) {
          isDns = true;
        } else {
          throw new Error('UDP proxy only enabled for DNS (port 53)');
        }
      }

      const vlessResponseHeader = new Uint8Array([vlessVersion[0], 0]);
      const rawClientData       = chunk.slice(rawDataIndex);

      if (isDns) {
        const { write } = await handleUDPOutBound(webSocket, vlessResponseHeader, log);
        udpStreamWrite = write;
        udpStreamWrite(rawClientData);
        return;
      }

      handleTCPOutBound(
        remoteSocketWrapper, addressRemote, portRemote,
        rawClientData, webSocket, vlessResponseHeader, log,
      );
    },
    close() { log('readableWSStream closed'); },
    abort(reason) { log('readableWSStream aborted', JSON.stringify(reason)); },
  })).catch(err => { log('pipeTo error', err); });

  return new Response(null, { status: 101, webSocket: client });
}

// ---------------------------------------------------------------------------
// TCP outbound
// ---------------------------------------------------------------------------
async function handleTCPOutBound(
  remoteSocket, addressRemote, portRemote,
  rawClientData, webSocket, vlessResponseHeader, log,
) {
  async function connectAndWrite(address, port) {
    const tcpSocket = connect({ hostname: address, port });
    remoteSocket.value = tcpSocket;
    log(`connected to ${address}:${port}`);
    const writer = tcpSocket.writable.getWriter();
    await writer.write(rawClientData);
    writer.releaseLock();
    return tcpSocket;
  }

  async function retry() {
    const tcpSocket = await connectAndWrite(proxyIP || addressRemote, portRemote);
    tcpSocket.closed.catch(err => {
      console.log('retry tcpSocket closed error', err);
    }).finally(() => safeCloseWebSocket(webSocket));
    remoteSocketToWS(tcpSocket, webSocket, vlessResponseHeader, null, log);
  }

  const tcpSocket = await connectAndWrite(addressRemote, portRemote);
  remoteSocketToWS(tcpSocket, webSocket, vlessResponseHeader, retry, log);
}

// ---------------------------------------------------------------------------
// Readable stream from WebSocket
// ---------------------------------------------------------------------------
function makeReadableWebSocketStream(webSocketServer, earlyDataHeader, log) {
  let readableStreamCancel = false;

  return new ReadableStream({
    start(controller) {
      webSocketServer.addEventListener('message', event => {
        if (readableStreamCancel) return;
        controller.enqueue(event.data);
      });

      webSocketServer.addEventListener('close', () => {
        safeCloseWebSocket(webSocketServer);
        if (!readableStreamCancel) controller.close();
      });

      webSocketServer.addEventListener('error', err => {
        log('webSocket error');
        controller.error(err);
      });

      const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
      if (error)     controller.error(error);
      else if (earlyData) controller.enqueue(earlyData);
    },
    cancel(reason) {
      if (readableStreamCancel) return;
      log(`ReadableStream cancelled: ${reason}`);
      readableStreamCancel = true;
      safeCloseWebSocket(webSocketServer);
    },
  });
}

// ---------------------------------------------------------------------------
// VLESS header parser
// ---------------------------------------------------------------------------
function processVlessHeader(vlessBuffer, userID) {
  if (vlessBuffer.byteLength < 24) {
    return { hasError: true, message: 'invalid data' };
  }

  const version     = new Uint8Array(vlessBuffer.slice(0, 1));
  const uuidBytes   = new Uint8Array(vlessBuffer.slice(1, 17));
  const isValidUser = stringify(uuidBytes) === userID;

  if (!isValidUser) {
    return { hasError: true, message: 'invalid user' };
  }

  const optLength = new Uint8Array(vlessBuffer.slice(17, 18))[0];
  const command   = new Uint8Array(vlessBuffer.slice(18 + optLength, 19 + optLength))[0];

  let isUDP = false;
  if      (command === 1) { /* TCP */ }
  else if (command === 2) { isUDP = true; }
  else {
    return { hasError: true, message: `command ${command} not supported` };
  }

  const portIndex  = 18 + optLength + 1;
  const portRemote = new DataView(vlessBuffer.slice(portIndex, portIndex + 2)).getUint16(0);

  let addressIndex      = portIndex + 2;
  const addressType     = new Uint8Array(vlessBuffer.slice(addressIndex, addressIndex + 1))[0];
  let addressLength     = 0;
  let addressValueIndex = addressIndex + 1;
  let addressValue      = '';

  switch (addressType) {
    case 1: // IPv4
      addressLength = 4;
      addressValue  = new Uint8Array(vlessBuffer.slice(addressValueIndex, addressValueIndex + 4)).join('.');
      break;
    case 2: // domain
      addressLength     = new Uint8Array(vlessBuffer.slice(addressValueIndex, addressValueIndex + 1))[0];
      addressValueIndex += 1;
      addressValue      = new TextDecoder().decode(
        vlessBuffer.slice(addressValueIndex, addressValueIndex + addressLength)
      );
      break;
    case 3: { // IPv6
      addressLength = 16;
      const dv  = new DataView(vlessBuffer.slice(addressValueIndex, addressValueIndex + 16));
      const ipv6 = [];
      for (let i = 0; i < 8; i++) ipv6.push(dv.getUint16(i * 2).toString(16));
      addressValue = ipv6.join(':');
      break;
    }
    default:
      return { hasError: true, message: `invalid addressType: ${addressType}` };
  }

  if (!addressValue) {
    return { hasError: true, message: `empty address, type ${addressType}` };
  }

  return {
    hasError:      false,
    addressRemote: addressValue,
    addressType,
    portRemote,
    rawDataIndex:  addressValueIndex + addressLength,
    vlessVersion:  version,
    isUDP,
  };
}

// ---------------------------------------------------------------------------
// Remote socket → WebSocket pump
// ---------------------------------------------------------------------------
async function remoteSocketToWS(remoteSocket, webSocket, vlessResponseHeader, retry, log) {
  let hasIncomingData = false;
  let vlessHeader     = vlessResponseHeader;

  await remoteSocket.readable.pipeTo(new WritableStream({
    async write(chunk, controller) {
      hasIncomingData = true;
      if (webSocket.readyState !== WS_READY_STATE_OPEN) {
        controller.error('webSocket not open');
        return;
      }
      if (vlessHeader) {
        webSocket.send(await new Blob([vlessHeader, chunk]).arrayBuffer());
        vlessHeader = null;
      } else {
        webSocket.send(chunk);
      }
    },
    close()        { log(`remote readable closed, hadData=${hasIncomingData}`); },
    abort(reason)  { console.error('remote readable aborted', reason); },
  })).catch(err => {
    console.error('remoteSocketToWS error', err.stack || err);
    safeCloseWebSocket(webSocket);
  });

  if (!hasIncomingData && retry) {
    log('no data from remote, retrying via proxyIP');
    retry();
  }
}

// ---------------------------------------------------------------------------
// UDP outbound (DNS only)
// ---------------------------------------------------------------------------
async function handleUDPOutBound(webSocket, vlessResponseHeader, log) {
  let isVlessHeaderSent = false;

  const transform = new TransformStream({
    transform(chunk, controller) {
      for (let i = 0; i < chunk.byteLength;) {
        const udpLen  = new DataView(chunk.slice(i, i + 2)).getUint16(0);
        const udpData = new Uint8Array(chunk.slice(i + 2, i + 2 + udpLen));
        i += 2 + udpLen;
        controller.enqueue(udpData);
      }
    },
  });

  transform.readable.pipeTo(new WritableStream({
    async write(chunk) {
      const resp     = await fetch('https://1.1.1.1/dns-query', {
        method:  'POST',
        headers: { 'content-type': 'application/dns-message' },
        body:    chunk,
      });
      const result   = await resp.arrayBuffer();
      const size     = result.byteLength;
      const sizeBuf  = new Uint8Array([(size >> 8) & 0xff, size & 0xff]);

      if (webSocket.readyState === WS_READY_STATE_OPEN) {
        log(`DNS success, response size=${size}`);
        if (isVlessHeaderSent) {
          webSocket.send(await new Blob([sizeBuf, result]).arrayBuffer());
        } else {
          webSocket.send(await new Blob([vlessResponseHeader, sizeBuf, result]).arrayBuffer());
          isVlessHeaderSent = true;
        }
      }
    },
  })).catch(err => log('DNS UDP error: ' + err));

  const writer = transform.writable.getWriter();
  return { write: chunk => writer.write(chunk) };
}

// ---------------------------------------------------------------------------
// Link generators
// ---------------------------------------------------------------------------
function makeVlessLink(uuid, host, path) {
  const params = new URLSearchParams({
    encryption: 'none',
    security:   'tls',
    sni:        host,
    fp:         'chrome',
    type:       'ws',
    host:       host,
    path:       path,
    alpn:       'h2,http/1.1',
  });
  return `vless://${uuid}@${host}:443?${params.toString()}#CF-VLESS-IR`;
}

function getVLESSConfig(uuid, host, path) {
  const vlessLink = makeVlessLink(uuid, host, path);
  return [
    '################################################################',
    'v2ray / Hiddify / Streisand',
    '---------------------------------------------------------------',
    vlessLink,
    '---------------------------------------------------------------',
    '################################################################',
    'Clash Meta config:',
    '---------------------------------------------------------------',
    `- type: vless`,
    `  name: ${host}`,
    `  server: ${host}`,
    `  port: 443`,
    `  uuid: ${uuid}`,
    `  network: ws`,
    `  tls: true`,
    `  sni: ${host}`,
    `  client-fingerprint: chrome`,
    `  ws-opts:`,
    `    path: "${path}"`,
    `    headers:`,
    `      host: ${host}`,
    '---------------------------------------------------------------',
    '################################################################',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
const WS_READY_STATE_OPEN    = 1;
const WS_READY_STATE_CLOSING = 2;

function safeCloseWebSocket(socket) {
  try {
    if (socket.readyState === WS_READY_STATE_OPEN ||
        socket.readyState === WS_READY_STATE_CLOSING) {
      socket.close();
    }
  } catch (e) {
    console.error('safeCloseWebSocket error', e);
  }
}

function base64ToArrayBuffer(base64Str) {
  if (!base64Str) return { error: null };
  try {
    const b64     = base64Str.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(b64);
    const buf     = Uint8Array.from(decoded, c => c.charCodeAt(0));
    return { earlyData: buf.buffer, error: null };
  } catch (e) {
    return { error: e };
  }
}

function isValidUUID(uuid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

// UUID byte array → string
const byteToHex = Array.from({ length: 256 }, (_, i) => (i + 256).toString(16).slice(1));

function unsafeStringify(arr, offset = 0) {
  return [
    byteToHex[arr[offset]],    byteToHex[arr[offset+1]],
    byteToHex[arr[offset+2]],  byteToHex[arr[offset+3]], '-',
    byteToHex[arr[offset+4]],  byteToHex[arr[offset+5]], '-',
    byteToHex[arr[offset+6]],  byteToHex[arr[offset+7]], '-',
    byteToHex[arr[offset+8]],  byteToHex[arr[offset+9]], '-',
    byteToHex[arr[offset+10]], byteToHex[arr[offset+11]],
    byteToHex[arr[offset+12]], byteToHex[arr[offset+13]],
    byteToHex[arr[offset+14]], byteToHex[arr[offset+15]],
  ].join('').toLowerCase();
}

function stringify(arr, offset = 0) {
  const uuid = unsafeStringify(arr, offset);
  if (!isValidUUID(uuid)) throw new TypeError('Invalid UUID bytes');
  return uuid;
}

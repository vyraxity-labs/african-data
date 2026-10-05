/**
 * Secure HTTP/HTTPS Client with Anti-DNS Rebinding and Socket-Level IP Validation
 *
 * Implements Step 12.3 requirements:
 * 1. Defend against DNS Rebinding / TOCTOU (Time-Of-Check to Time-Of-Use):
 *    - Custom DNS resolution resolves target hostname.
 *    - All resolved IP addresses are strictly validated against SSRF rules.
 *    - Low-level socket creation intercepts the TCP handshake and inspects `socket.remoteAddress`.
 *    - If the actual connected destination IP is private, link-local, loopback, or cloud metadata,
 *      the socket is immediately destroyed before sending any HTTP request headers or data.
 * 2. Does NOT rely on naive `dns.lookup()` followed by standard `fetch()`.
 * 3. Enforces connect and response timeouts.
 */

import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';
import * as tls from 'node:tls';
import * as dns from 'node:dns/promises';
import {
  assertAllowedProtocol,
  assertSafeHostname,
  assertSafeDestinationIp,
  SsrfBlockedError,
} from './ssrf';

export interface SecureRequestOptions {
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  timeoutMs?: number;
  /**
   * Optional custom resolver injection for testing DNS rebinding or custom DNS.
   */
  customResolver?: (hostname: string) => Promise<string[]>;
}

export interface SecureResponse {
  statusCode: number;
  statusMessage: string;
  headers: http.IncomingHttpHeaders;
  connectedIp: string;
  bodyPreview?: Buffer;
}

/**
 * Creates a secure TCP connection to host:port.
 * Validates resolved IPs before connecting, and inspects actual socket.remoteAddress
 * immediately upon connection before any HTTP payload can be transmitted.
 */
function createSecureConnection(
  options: {
    host: string;
    port: number;
    timeoutMs: number;
    customResolver?: (hostname: string) => Promise<string[]>;
  },
  onConnected: (err: Error | null, socket?: net.Socket, resolvedIp?: string) => void
): void {
  const { host, port, timeoutMs, customResolver } = options;

  (async () => {
    try {
      assertSafeHostname(host);

      let targetIps: string[];
      if (net.isIP(host) !== 0) {
        // Direct IP target
        targetIps = [host];
      } else if (customResolver) {
        targetIps = await customResolver(host);
      } else {
        const lookupResults = await dns.lookup(host, { all: true });
        targetIps = lookupResults.map((r) => r.address);
      }

      if (!targetIps || targetIps.length === 0) {
        throw new Error(`DNS resolution returned no records for host "${host}".`);
      }

      // Step 1: Pre-connect validation on all resolved records
      for (const ip of targetIps) {
        assertSafeDestinationIp(ip);
      }

      // Pick the first validated address
      const targetIp = targetIps[0]!;

      // Step 2: Open socket directly to the validated IP address
      const socket = net.createConnection({
        host: targetIp,
        port,
      });

      socket.setTimeout(timeoutMs);

      socket.once('connect', () => {
        // Step 3: Validate actual connected remoteAddress before sending HTTP data
        const actualRemoteIp = socket.remoteAddress;

        if (!actualRemoteIp) {
          socket.destroy();
          onConnected(new SsrfBlockedError(host, 'Socket connected without a valid remoteAddress.'));
          return;
        }

        try {
          assertSafeDestinationIp(actualRemoteIp);
          onConnected(null, socket, actualRemoteIp);
        } catch (err: any) {
          // IP is private/unauthorized -> Destroy socket immediately
          socket.destroy();
          onConnected(err);
        }
      });

      socket.once('timeout', () => {
        socket.destroy();
        onConnected(new Error(`Connection timeout after ${timeoutMs}ms to ${host}:${port}`));
      });

      socket.once('error', (err) => {
        onConnected(err);
      });
    } catch (err: any) {
      onConnected(err);
    }
  })();
}

/**
 * Creates custom http.Agent and https.Agent with socket-level IP verification
 */
export function createSecureAgents(
  timeoutMs: number,
  customResolver?: (hostname: string) => Promise<string[]>
): { httpAgent: http.Agent; httpsAgent: https.Agent } {
  // HTTP Agent
  const httpAgent = new http.Agent({
    keepAlive: false,
    maxSockets: 50,
  });

  (httpAgent as any).createConnection = function (
    opts: any,
    cb: (err: Error | null, socket?: net.Socket) => void
  ) {
    const host = opts.host || opts.hostname;
    const port = opts.port || 80;
    createSecureConnection(
      { host, port, timeoutMs, customResolver },
      (err, socket) => {
        cb(err, socket);
      }
    );
  };

  // HTTPS Agent
  const httpsAgent = new https.Agent({
    keepAlive: false,
    maxSockets: 50,
  });

  (httpsAgent as any).createConnection = function (
    opts: any,
    cb: (err: Error | null, socket?: net.Socket) => void
  ) {
    const host = opts.host || opts.hostname;
    const port = opts.port || 443;

    createSecureConnection(
      { host, port, timeoutMs, customResolver },
      (err, rawSocket, connectedIp) => {
        if (err || !rawSocket) {
          cb(err);
          return;
        }

        // Upgrade raw validated TCP socket to TLS
        const tlsSocket = tls.connect({
          socket: rawSocket,
          servername: host, // SNI uses original host
          rejectUnauthorized: true,
        });

        tlsSocket.once('secureConnect', () => {
          // Double-check remoteAddress on secure socket
          const tlsRemoteIp = tlsSocket.remoteAddress || connectedIp;
          try {
            if (tlsRemoteIp) {
              assertSafeDestinationIp(tlsRemoteIp);
            }
            cb(null, tlsSocket);
          } catch (secErr: any) {
            tlsSocket.destroy();
            cb(secErr);
          }
        });

        tlsSocket.once('error', (tlsErr) => {
          cb(tlsErr);
        });
      }
    );
  };

  return { httpAgent, httpsAgent };
}

/**
 * Performs a single secure HTTP/HTTPS request defending against SSRF and DNS rebinding.
 * Returns response metadata and connected remote IP. Does not automatically follow redirects.
 */
export async function executeSecureRequest(
  targetUrl: string,
  options: SecureRequestOptions = {}
): Promise<SecureResponse> {
  const parsedUrl = new URL(targetUrl);
  assertAllowedProtocol(parsedUrl);
  assertSafeHostname(parsedUrl.hostname);

  const timeoutMs = options.timeoutMs || 8000;
  const method = options.method || 'HEAD';
  const isHttps = parsedUrl.protocol === 'https:';

  const { httpAgent, httpsAgent } = createSecureAgents(timeoutMs, options.customResolver);
  const agent = isHttps ? httpsAgent : httpAgent;
  const requestFn = isHttps ? https.request : http.request;

  return new Promise((resolve, reject) => {
    let connectedIp = '';

    const req = requestFn(
      parsedUrl,
      {
        method,
        agent,
        headers: {
          'User-Agent': 'AfricanDataDirectory/1.0 (LinkHealthChecker; +https://africandata.org)',
          'Accept': '*/*',
          ...(options.headers || {}),
        },
      },
      (res) => {
        connectedIp = (res.socket as net.Socket)?.remoteAddress || connectedIp;

        const chunks: Buffer[] = [];
        let totalBytes = 0;
        const maxBytes = 4096; // First 4 KB preview

        res.on('data', (chunk: Buffer) => {
          if (totalBytes < maxBytes) {
            chunks.push(chunk);
            totalBytes += chunk.length;
          } else {
            // Stop receiving body once preview threshold reached
            res.destroy();
          }
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            statusMessage: res.statusMessage || '',
            headers: res.headers,
            connectedIp,
            bodyPreview: Buffer.concat(chunks),
          });
        });

        res.on('close', () => {
          resolve({
            statusCode: res.statusCode || 0,
            statusMessage: res.statusMessage || '',
            headers: res.headers,
            connectedIp,
            bodyPreview: Buffer.concat(chunks),
          });
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`HTTP request timed out after ${timeoutMs}ms.`));
    });

    req.on('socket', (socket: net.Socket) => {
      socket.once('connect', () => {
        if (socket.remoteAddress) {
          connectedIp = socket.remoteAddress;
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

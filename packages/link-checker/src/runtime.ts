/**
 * Node.js Runtime Guard & Validation for Link Checker
 *
 * Requirements (Step 12.1):
 * - Must strictly run in a Node.js runtime environment.
 * - Must NOT run on an Edge runtime (e.g. Cloudflare Workers, Vercel Edge Runtime, Deno Deploy)
 *   because low-level socket, DNS, and IP validation controls (SSRF protection, custom dispatchers)
 *   require full Node.js POSIX socket / undici networking support.
 */

import * as dns from 'node:dns';
import * as net from 'node:net';
import * as http from 'node:http';
import * as https from 'node:https';

export interface RuntimeEnvironmentInfo {
  isNodeRuntime: boolean;
  isEdgeRuntime: boolean;
  nodeVersion: string | null;
  features: {
    hasDnsLookup: boolean;
    hasNetSocket: boolean;
    hasHttpAgent: boolean;
  };
}

/**
 * Checks whether the current runtime environment is a supported Node.js runtime.
 * Throws an explicit error if executed under an Edge runtime environment.
 */
export function assertNodeRuntime(): RuntimeEnvironmentInfo {
  // Edge runtime environments typically expose EdgeRuntime global or lack process.versions.node
  const isEdge =
    typeof (globalThis as any).EdgeRuntime !== 'undefined' ||
    (typeof process !== 'undefined' && (process.env as any)?.NEXT_RUNTIME === 'edge');

  const isNode =
    !isEdge &&
    typeof process !== 'undefined' &&
    !!process.versions &&
    !!process.versions.node;

  if (isEdge || !isNode) {
    throw new Error(
      'UNSUPPORTED RUNTIME: Link checker requires the Node.js runtime for low-level socket, DNS resolution, and SSRF security controls. Edge runtimes are strictly prohibited.'
    );
  }

  const hasDnsLookup = typeof dns.lookup === 'function';
  const hasNetSocket = typeof net.Socket === 'function';
  const hasHttpAgent = typeof http.Agent === 'function' && typeof https.Agent === 'function';

  if (!hasDnsLookup || !hasNetSocket || !hasHttpAgent) {
    throw new Error(
      'MISSING NETWORKING PRIMITIVES: The host environment does not provide standard Node.js networking modules (node:dns, node:net, node:http).'
    );
  }

  return {
    isNodeRuntime: true,
    isEdgeRuntime: false,
    nodeVersion: process.version,
    features: {
      hasDnsLookup,
      hasNetSocket,
      hasHttpAgent,
    },
  };
}

export * from './runtime';

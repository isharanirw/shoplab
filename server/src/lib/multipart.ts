import type { Request } from 'express';
import { ApiError } from './errors';

export interface MultipartFile {
  field: string;
  filename: string;
  contentType: string;
  data: Buffer;
}

export interface MultipartBody {
  fields: Record<string, string>;
  files: MultipartFile[];
}

const MAX_PARTS = 20;
const CRLF = Buffer.from('\r\n');
const HEADER_END = Buffer.from('\r\n\r\n');

/** The boundary from a `multipart/form-data; boundary=...` header, or null when it is not multipart. */
export function boundaryOf(contentType: string | undefined): string | null {
  if (!contentType || !/^multipart\/form-data\s*;/i.test(contentType)) return null;
  const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  const boundary = match?.[1] ?? match?.[2];
  return boundary && boundary.length <= 200 ? boundary : null;
}

function malformed(): never {
  throw new ApiError('VALIDATION_ERROR', 'The request body is not valid multipart/form-data.');
}

function parseDisposition(value: string): { name: string | null; filename: string | null } {
  const name = /;\s*name="([^"]*)"/i.exec(value)?.[1] ?? null;
  const filename = /;\s*filename="([^"]*)"/i.exec(value)?.[1] ?? null;
  return { name, filename };
}

/** Splits a multipart/form-data body into text fields and files. Throws a 400 ApiError when it is malformed. */
export function parseMultipart(body: Buffer, boundary: string): MultipartBody {
  const delimiter = Buffer.from(`--${boundary}`);
  const result: MultipartBody = { fields: {}, files: [] };

  let pos = body.indexOf(delimiter);
  if (pos === -1) malformed();
  let parts = 0;
  for (;;) {
    pos += delimiter.length;
    if (body.subarray(pos, pos + 2).toString('latin1') === '--') return result;
    if (!body.subarray(pos, pos + 2).equals(CRLF)) malformed();
    pos += 2;

    const headerEnd = body.indexOf(HEADER_END, pos);
    if (headerEnd === -1) malformed();
    const headers = body.subarray(pos, headerEnd).toString('utf8').split('\r\n');
    const dataStart = headerEnd + HEADER_END.length;
    const next = body.indexOf(Buffer.concat([CRLF, delimiter]), dataStart);
    if (next === -1) malformed();
    const data = body.subarray(dataStart, next);

    parts += 1;
    if (parts > MAX_PARTS) malformed();

    let disposition: ReturnType<typeof parseDisposition> | null = null;
    let contentType = 'text/plain';
    for (const line of headers) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      if (key === 'content-disposition') disposition = parseDisposition(value);
      if (key === 'content-type') contentType = value;
    }
    if (!disposition || disposition.name === null) malformed();

    if (disposition.filename !== null) {
      result.files.push({ field: disposition.name, filename: disposition.filename, contentType, data: Buffer.from(data) });
    } else {
      result.fields[disposition.name] = data.toString('utf8');
    }
    pos = next + CRLF.length;
  }
}

/** The most bytes read and thrown away from an oversized upload before the connection is cut. */
const DRAIN_LIMIT = 25 * 1024 * 1024;

export interface BodyRead {
  tooLarge: boolean;
  body: Buffer;
}

/**
 * Reads the raw request body. A body over `maxBytes` is not kept: the rest of it is read and
 * discarded (so the client gets a clean answer instead of a dropped connection) and `tooLarge` is set.
 */
export function readRawBody(req: Request, maxBytes: number): Promise<BodyRead> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve({ tooLarge, body: tooLarge ? Buffer.alloc(0) : Buffer.concat(chunks) });
    };
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        tooLarge = true;
        chunks.length = 0;
      } else if (!tooLarge) {
        chunks.push(chunk);
      }
      if (size > DRAIN_LIMIT) finish();
    });
    req.on('end', finish);
    req.on('error', (err) => {
      if (!done) {
        done = true;
        reject(err);
      }
    });
    req.on('close', finish);
  });
}

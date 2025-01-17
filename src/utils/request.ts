import type http from 'http'

async function readDataFromRequest(request: http.IncomingMessage) {
  const buffers = []
  for await (const chunk of request) {
    buffers.push(chunk)
  }
  return Buffer.concat(buffers).toString()
}

function parseUrl(request: http.IncomingMessage) {
  if (request.url && request.headers.host) {
    const parts = new URL(request.url, `http://${request.headers.host}`)
    return [
      parts.hostname,
      parts.port && Number.parseInt(parts.port, 10),
      parts.pathname,
      Object.fromEntries(parts.searchParams.entries()),
    ] as const
  }

  return []
}

const actionTypeFromRequest = (request: http.IncomingMessage) =>
  typeof request.method !== 'string' ||
    ['GET', 'OPTIONS'].includes(request.method)
    ? 'GET'
    : 'SET'

function contentTypeFromRequest(request: http.IncomingMessage) {
  const header = request.headers['content-type']
  if (typeof header === 'string') {
    return header.split(';')[0]
  }

  return undefined
}

export async function actionFromRequest(
  request: http.IncomingMessage,
  incomingPort: number
) {
  const [hostname, port, path, queryParams] = parseUrl(request)
  const data = await readDataFromRequest(request)

  return {
    type: actionTypeFromRequest(request),
    payload: {
      ...(data && { data }),
      method: request.method,
      hostname:
        typeof hostname === 'string' ? hostname.toLowerCase() : undefined,
      port: port || incomingPort,
      path: typeof path === 'string' ? path.toLowerCase() : undefined,
      queryParams,
      contentType: contentTypeFromRequest(request),
      headers: request.headers as Record<string, string>,
    },
    meta: {},
  }
}

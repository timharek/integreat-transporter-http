import test from 'ava'
import sinon = require('sinon')
import http = require('http')
import got from 'got'
import { Connection } from './types'

import listen from './listen'

// Setup

const options = {
  method: 'GET' as const,
  headers: { 'Content-Type': 'application/json' },
  throwHttpErrors: false,
  retry: 0,
}

// Tests

test('should return ok when on await listen', async (t) => {
  const dispatch = sinon
    .stub()
    .resolves({ status: 'ok', data: JSON.stringify([{ id: 'ent1' }]) })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: { host: ['localhost'], path: ['/entries'], port: 9001 },
  }

  const ret = await listen(dispatch, connection)

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 0) // No dispatching witouth requests

  connection.server.close()
})

test('should dispatch GET request as GET action and respond with response', async (t) => {
  const responseData = JSON.stringify([{ id: 'ent1' }])
  const dispatch = sinon.stub().resolves({ status: 'ok', data: responseData })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: { host: ['localhost'], path: ['/entries'], port: 9002 },
  }
  const url = 'http://localhost:9002/entries'
  const options = {
    headers: { 'Content-Type': 'application/json' },
  }
  const expectedAction = {
    type: 'GET',
    payload: {
      method: 'GET',
      hostname: 'localhost',
      port: 9002,
      path: '/entries',
      contentType: 'application/json',
      headers: {
        'accept-encoding': 'gzip, deflate, br',
        connection: 'close',
        'content-type': 'application/json',
        host: 'localhost:9002',
        'user-agent': 'got (https://github.com/sindresorhus/got)',
      },
    },
    meta: {},
  }

  const ret = await listen(dispatch, connection)
  const response = await got(url, options)

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 1)
  t.deepEqual(dispatch.args[0][0], expectedAction)
  t.is(response.statusCode, 200)
  t.is(response.headers['content-type'], 'application/json')
  t.is(response.body, responseData)

  connection.server.close()
})

test('should dispatch POST request as SET action', async (t) => {
  const requestData = JSON.stringify([{ id: 'ent1' }])
  const dispatch = sinon.stub().resolves({ status: 'ok', data: null })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: { host: ['localhost'], path: ['/entries'], port: 9003 },
  }
  const url = 'http://localhost:9003/entries'
  const options = {
    method: 'POST' as const,
    headers: { 'Content-Type': 'application/json' },
    body: requestData,
  }
  const expectedAction = {
    type: 'SET',
    payload: {
      data: requestData,
      method: 'POST',
      hostname: 'localhost',
      port: 9003,
      path: '/entries',
      contentType: 'application/json',
      headers: {
        'accept-encoding': 'gzip, deflate, br',
        connection: 'close',
        'content-type': 'application/json',
        'content-length': '15',
        host: 'localhost:9003',
        'user-agent': 'got (https://github.com/sindresorhus/got)',
      },
    },
    meta: {},
  }

  const ret = await listen(dispatch, connection)
  const response = await got(url, options)

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 1)
  t.deepEqual(dispatch.args[0][0], expectedAction)
  t.is(response.statusCode, 200)
  t.is(response.headers['content-type'], 'application/json')
  t.is(response.body, '')

  connection.server.close()
})

test('should dispatch PUT request as SET action', async (t) => {
  const requestData = JSON.stringify([{ id: 'ent1' }])
  const dispatch = sinon.stub().resolves({ status: 'ok', data: requestData })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: { host: ['localhost'], path: ['/entries'], port: 9004 },
  }
  const url = 'http://localhost:9004/entries'
  const options = {
    method: 'PUT' as const,
    headers: { 'Content-Type': 'application/json' },
    body: requestData,
  }

  const ret = await listen(dispatch, connection)
  await got(url, options)

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 1)
  const dispatchedAction = dispatch.args[0][0]
  t.is(dispatchedAction.type, 'SET')
  t.is(dispatchedAction.payload.method, 'PUT')

  connection.server.close()
})

test('should dispatch other content-type', async (t) => {
  const requestData = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <SomeWeirdSoapAction />
  </soap:Body>
</soap:Envelope>
`
  const responseData = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <SomeWeirdSoapActionResponse />
  </soap:Body>
</soap:Envelope>`
  const dispatch = sinon.stub().resolves({
    status: 'ok',
    data: responseData,
    headers: {
      'content-type': 'text/xml;charset=utf-8',
    },
  })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: { host: ['localhost'], path: ['/soap11'], port: 9005 },
  }
  const url = 'http://localhost:9005/soap11'
  const options = {
    method: 'POST' as const,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: 'http://api.net/SomeWeirdSoapAction',
    },
    body: requestData,
  }

  const ret = await listen(dispatch, connection)
  const response = await got(url, options)

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 1)
  const dispatchedAction = dispatch.args[0][0]
  t.is(dispatchedAction.type, 'SET')
  t.is(dispatchedAction.payload.method, 'POST')
  t.is(dispatchedAction.payload.contentType, 'text/xml')
  t.is(
    dispatchedAction.payload.headers['content-type'],
    'text/xml; charset=utf-8'
  )
  t.is(
    dispatchedAction.payload.headers.soapaction,
    'http://api.net/SomeWeirdSoapAction'
  )
  t.is(response.statusCode, 200)
  t.is(response.headers['content-type'], 'text/xml;charset=utf-8')
  t.is(response.body, responseData)

  connection.server.close()
})

test('should stringify response data', async (t) => {
  const responseData = [{ id: 'ent1' }, { id: 'ent2' }]
  const dispatch = sinon.stub().resolves({
    status: 'ok',
    data: responseData,
  })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: { host: ['localhost'], path: ['/entries'], port: 9006 },
  }
  const url = 'http://localhost:9006/entries'

  const ret = await listen(dispatch, connection)
  const response = await got(url, options)

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 1)
  t.is(response.statusCode, 200)
  t.is(response.headers['content-type'], 'application/json')
  t.is(response.body, JSON.stringify(responseData))

  connection.server.close()
})

test('should respond with 201 on queued', async (t) => {
  const dispatch = sinon.stub().resolves({
    status: 'queued',
  })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: { host: ['localhost'], path: ['/entries'], port: 9012 },
  }
  const url = 'http://localhost:9012/entries'

  const ret = await listen(dispatch, connection)
  const response = await got(url, options)

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 1)
  t.is(response.statusCode, 201)

  connection.server.close()
})

test('should respond with 500 on error', async (t) => {
  const dispatch = sinon.stub().resolves({
    status: 'error',
    error: 'What just happened?',
    data: { error: 'Everything is under control' },
  })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: { host: ['localhost'], path: ['/entries'], port: 9007 },
  }
  const url = 'http://localhost:9007/entries'

  const ret = await listen(dispatch, connection)
  const response = await got(url, options)

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 1)
  t.is(response.statusCode, 500)
  t.is(response.headers['content-type'], 'application/json')
  t.is(response.body, JSON.stringify({ error: 'Everything is under control' }))

  connection.server.close()
})

test('should respond with 400 on badrequest', async (t) => {
  const dispatch = sinon.stub().resolves({
    status: 'badrequest',
    error: 'Please read the documentation',
  })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: { host: ['localhost'], path: ['/entries'], port: 9008 },
  }
  const url = 'http://localhost:9008/entries'

  const ret = await listen(dispatch, connection)
  const response = await got(url, options)

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 1)
  t.is(response.statusCode, 400)

  connection.server.close()
})

test('should respond with 401 on noaccess', async (t) => {
  const dispatch = sinon.stub().resolves({
    status: 'noaccess',
    error: 'Above your paygrade',
  })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: { host: ['localhost'], path: ['/entries'], port: 9009 },
  }
  const url = 'http://localhost:9009/entries'

  const ret = await listen(dispatch, connection)
  const response = await got(url, options)

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 1)
  t.is(response.statusCode, 401)

  connection.server.close()
})

test('should respond with 404 on notfound', async (t) => {
  const dispatch = sinon.stub().resolves({
    status: 'notfound',
    error: 'Where is it?',
  })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: { host: ['localhost'], path: ['/entries'], port: 9010 },
  }
  const url = 'http://localhost:9010/entries'

  const ret = await listen(dispatch, connection)
  const response = await got(url, options)

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 1)
  t.is(response.statusCode, 404)

  connection.server.close()
})

test('should respond with 404 on noaction', async (t) => {
  const dispatch = sinon.stub().resolves({
    status: 'noaction',
    error: 'Not supported',
  })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: { host: ['localhost'], path: ['/entries'], port: 9013 },
  }
  const url = 'http://localhost:9013/entries'

  const ret = await listen(dispatch, connection)
  const response = await got(url, options)

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 1)
  t.is(response.statusCode, 404)

  connection.server.close()
})

test('should respond with 408 on timeout', async (t) => {
  const dispatch = sinon.stub().resolves({
    status: 'timeout',
    error: 'Too slow',
  })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: { host: ['localhost'], path: ['/entries'], port: 9011 },
  }
  const url = 'http://localhost:9011/entries'

  const ret = await listen(dispatch, connection)
  const response = await got(url, options)

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 1)
  t.is(response.statusCode, 408)

  connection.server.close()
})

test('should return with status badrequest when no connection', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok', data: [] })
  const connection = null

  const ret = await listen(dispatch, connection)

  t.deepEqual(ret, {
    status: 'badrequest',
    error: 'Cannot listen to server. No connection',
  })
})

test('should return 404 when path pattern does not match', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok', data: '[]' })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: { host: ['localhost'], path: ['/entries'], port: 9014 },
  }
  const url = 'http://localhost:9014/unknown'

  const ret = await listen(dispatch, connection)
  const response = await got(url, options)

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 0)
  t.is(response.statusCode, 404)
  t.falsy(response.headers['content-type'])

  connection.server.close()
})

test('should return 404 when host pattern does not match', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok', data: '[]' })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: {
      host: ['shining.api', 'newest.api'],
      path: ['/entries'],
      port: 9015,
    },
  }
  const url = 'http://localhost:9015/entries'

  const ret = await listen(dispatch, connection)
  const response = await got(url, options)

  t.deepEqual(ret, { status: 'ok' })
  t.is(dispatch.callCount, 0)
  t.is(response.statusCode, 404)
  t.falsy(response.headers['content-type'])

  connection.server.close()
})

test('should dispatch when path pattern is root', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok', data: '[]' })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: {
      host: ['localhost'],
      path: ['/'],
      port: 9016,
    },
  }
  const url = 'http://localhost:9016/entries'

  const ret = await listen(dispatch, connection)
  const response = await got(url, options)

  t.deepEqual(ret, { status: 'ok' })
  t.is(response.statusCode, 200)
  t.is(dispatch.callCount, 1)

  connection.server.close()
})

test('should dispatch when no path pattern', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok', data: '[]' })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: {
      host: ['localhost'],
      path: [],
      port: 9017,
    },
  }
  const url = 'http://localhost:9017/entries'

  const ret = await listen(dispatch, connection)
  const response = await got(url, options)

  t.deepEqual(ret, { status: 'ok' })
  t.is(response.statusCode, 200)
  t.is(dispatch.callCount, 1)

  connection.server.close()
})

test('should dispatch when no host pattern', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok', data: '[]' })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: {
      host: [],
      path: ['/entries'],
      port: 9018,
    },
  }
  const url = 'http://localhost:9018/entries'

  const ret = await listen(dispatch, connection)
  const response = await got(url, options)

  t.deepEqual(ret, { status: 'ok' })
  t.is(response.statusCode, 200)
  t.is(dispatch.callCount, 1)

  connection.server.close()
})

test('should dispatch to matching service', async (t) => {
  const responseData0 = JSON.stringify([{ id: 'ent1' }])
  const responseData1 = JSON.stringify([{ id: 'ent2' }])
  const dispatch0 = sinon.stub().resolves({ status: 'ok', data: responseData0 })
  const dispatch1 = sinon.stub().resolves({ status: 'ok', data: responseData1 })
  const server = http.createServer()
  const connection0 = {
    status: 'ok',
    server,
    incoming: { host: ['localhost'], path: ['/entries'], port: 9019 },
  }
  const connection1 = {
    status: 'ok',
    server,
    incoming: { host: ['localhost'], path: ['/accounts'], port: 9019 },
  }
  const url = 'http://localhost:9019/accounts'

  const ret0 = await listen(dispatch0, connection0)
  const ret1 = await listen(dispatch1, connection1)
  const response = await got(url, options)

  t.deepEqual(ret0, { status: 'ok' })
  t.deepEqual(ret1, { status: 'ok' })
  t.is(dispatch0.callCount, 0)
  t.is(dispatch1.callCount, 1)
  t.is(response.statusCode, 200)
  t.is(response.headers['content-type'], 'application/json')
  t.is(response.body, responseData1)

  server.close()
})

test('should keep port setups seperate', async (t) => {
  const responseData0 = JSON.stringify([{ id: 'ent1' }])
  const responseData1 = JSON.stringify([{ id: 'ent2' }])
  const dispatch0 = sinon.stub().resolves({ status: 'ok', data: responseData0 })
  const dispatch1 = sinon.stub().resolves({ status: 'ok', data: responseData1 })
  const server0 = http.createServer()
  const server1 = http.createServer()
  const connection0 = {
    status: 'ok',
    server: server0,
    incoming: { host: ['localhost'], path: ['/entries'], port: 9020 },
  }
  const connection1 = {
    status: 'ok',
    server: server1,
    incoming: { host: ['localhost'], path: ['/entries'], port: 9021 },
  }
  const url = 'http://localhost:9021/entries'

  const ret0 = await listen(dispatch0, connection0)
  const ret1 = await listen(dispatch1, connection1)
  const response = await got(url, options)

  t.deepEqual(ret0, { status: 'ok' })
  t.deepEqual(ret1, { status: 'ok' })
  t.is(dispatch0.callCount, 0)
  t.is(dispatch1.callCount, 1)
  t.is(response.statusCode, 200)
  t.is(response.headers['content-type'], 'application/json')
  t.is(response.body, responseData1)

  server0.close()
  server1.close()
})

test('should return with status badrequest when incomming has no port', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok', data: [] })
  const connection = {
    status: 'ok',
    server: http.createServer(),
    incoming: { host: ['localhost'], path: ['/entries'] }, // No `port`
  }

  const ret = await listen(dispatch, connection as Connection)

  t.deepEqual(ret, {
    status: 'badrequest',
    error: 'Cannot listen to server. No port set on incoming options',
  })

  connection.server.close()
})

test('should return with status badrequest when connection has no server', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok', data: [] })
  const connection = {
    status: 'ok',
    server: undefined,
    incoming: { host: ['localhost'], path: ['/entries'], port: 9000 },
  }

  const ret = await listen(dispatch, connection)

  t.deepEqual(ret, {
    status: 'badrequest',
    error: 'Cannot listen to server. No server set on connection',
  })
})

test('should return with status noaction when connection has no incomming', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok', data: [] })
  const connection = {
    status: 'ok',
    server: undefined,
    incoming: undefined,
  }

  const ret = await listen(dispatch, connection)

  t.deepEqual(ret, {
    status: 'noaction',
    error: 'Service not configured for listening',
  })
})
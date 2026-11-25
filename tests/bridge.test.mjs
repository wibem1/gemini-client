import assert from 'node:assert/strict'
import { request as httpRequest } from 'node:http'
import { EventEmitter, once } from 'node:events'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import { cliArgs, createBridge } from '../windows/bridge.mjs'

test('pairing, job progress, concurrency, cancel and session resume', async (t) => {
  const origin = 'https://gemini-client-chat.wibem1.chatgpt.site'
  const launches = []
  const server = createBridge({
    token: 'test-token',
    projects: new Map([['owner/example', 'approved']]),
    verify: async (_, cwd) => cwd,
    launch(cwd, prompt, session, resume) {
      const child = new EventEmitter()
      for (const stream of ['stdout', 'stderr', 'stdin']) child[stream] = new PassThrough()
      child.kill = () => setImmediate(() => child.emit('close', null))
      launches.push({ cwd, prompt, session, resume, child })
      return child
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const request = (path, { body, method, headers } = {}) => new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: '127.0.0.1',
      port: server.address().port,
      path,
      method: method ?? (body ? 'POST' : 'GET'),
      headers: { Origin: origin, Authorization: 'Bearer test-token', 'Content-Type': 'application/json', ...headers }
    }, (res) => {
      let content = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { content += chunk })
      res.on('end', () => resolve({ status: res.statusCode, json: () => JSON.parse(content) }))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end(body ? JSON.stringify(body) : undefined)
  })
  assert.equal((await request('/projects', { headers: { Origin: 'https://example.com' } })).status, 403)
  assert.equal((await request('/projects', { headers: { Host: 'example.com' } })).status, 403)
  assert.equal((await request('/projects', { headers: { Authorization: 'Bearer wrong' } })).status, 401)
  assert.equal((await request('/projects', { method: 'OPTIONS' })).status, 204)
  const data = { project: 'owner/example', prompt: '--literal text' }
  assert.equal((await request('/jobs', { body: { ...data, project: '../bad' } })).status, 400)
  const first = await request('/jobs', { body: data })
  assert.equal(first.status, 202)
  const { id } = await first.json()
  assert.equal((await request('/jobs', { body: data })).status, 409)
  const { child, session, prompt, cwd } = launches[0]
  assert.equal(cwd, 'approved')
  assert.equal(prompt, data.prompt)
  const emit = (stream, event) => stream.write(JSON.stringify(event) + '\n')
  emit(child.stdout, { type: 'system', subtype: 'init', session_id: session })
  emit(child.stdout, { type: 'assistant', message: { content: [{ type: 'text', text: '<b>Änderung</b>' }] } })
  const get = (id) => request('/jobs/' + id).then((response) => response.json())
  assert.match((await get(id)).output, /<b>Änderung<\/b>/)
  assert.equal((await request('/jobs/' + id + '/cancel', { body: {} })).status, 202)
  const waitState = async (id, expected) => {
    for (let i = 0; i < 30; i++) {
      const job = await get(id)
      if (job.state === expected) return job
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    assert.fail('Expected state ' + expected)
  }
  assert.equal((await waitState(id, 'Abgebrochen')).resumable, true)
  const next = await request('/jobs', { body: { ...data, resume: id } })
  assert.equal(next.status, 202)
  assert.equal(launches[1].session, session)
  assert.equal(launches[1].resume, true)
  emit(launches[1].child.stdout, { type: 'result', subtype: 'success', is_error: false })
  launches[1].child.emit('close', 0)
  await waitState((await next.json()).id, 'Abgeschlossen')
  assert.deepEqual(cliArgs(session, true).slice(-2), ['--resume', session])
  assert.equal(cliArgs(session, false).includes('Bash'), false)
})

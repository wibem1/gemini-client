import { createServer } from 'node:http'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'

const port = 37419
const origin = 'https://gemini-client-chat.wibem1.chatgpt.site'
const repoPattern = /^[a-z0-9-]+\/[a-z0-9_.-]+$/i

export function createBridge({ token, projects, launch, verify, allowedOrigin = origin }) {
  let active
  const jobs = new Map()
  const send = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(data))
  }

  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    if (req.headers.origin !== allowedOrigin || req.headers.host !== '127.0.0.1:' + req.socket.localPort) {
      return send(res, 403, { error: 'Herkunft nicht zugelassen.' })
    }
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
    res.setHeader('Vary', 'Origin')
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Private-Network': 'true'
      })
      return res.end()
    }
    const supplied = Buffer.from(req.headers.authorization ?? '')
    const expected = Buffer.from('Bearer ' + token)
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return send(res, 401, { error: 'Kopplungscode ungültig.' })
    }

    if (req.method === 'GET' && req.url === '/projects') {
      return send(res, 200, { projects: [...projects.keys()], active: active?.id })
    }
    const match = /^\/jobs\/([0-9a-f-]+)(\/cancel)?$/.exec(req.url)
    if (match) {
      const job = jobs.get(match[1])
      if (!job) return send(res, 404, { error: 'Auftrag nicht gefunden.' })
      if (req.method === 'GET' && !match[2]) {
        const { id, project, state, output, resumable } = job
        return send(res, 200, { id, project, state, output, resumable })
      }
      if (req.method === 'POST' && match[2] && active === job) {
        job.state = 'Wird abgebrochen'
        job.child?.kill()
        return send(res, 202, { id: job.id })
      }
    }
    if (req.method !== 'POST' || req.url !== '/jobs') return send(res, 404, { error: 'Unbekannter Aufruf.' })
    if (req.headers['content-type'] !== 'application/json') return send(res, 415, { error: 'JSON erwartet.' })

    let data
    try {
      let size = 0
      const chunks = []
      for await (const chunk of req) {
        size += chunk.length
        if (size > 16384) {
          send(res, 413, { error: 'Auftrag ist zu groß.' })
          return
        }
        chunks.push(chunk)
      }
      data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      return send(res, 400, { error: 'Ungültiger Auftrag.' })
    }
    const { project, prompt, resume } = data ?? {}
    const previous = jobs.get(resume)
    if (!projects.has(project) || typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000 ||
        (resume !== undefined && (!previous?.resumable || previous.project !== project))) {
      return send(res, 400, { error: 'Projekt, Auftrag oder vorherige Sitzung ungültig.' })
    }
    if (active) return send(res, 409, { error: 'Ein Auftrag läuft bereits.' })

    const id = randomUUID()
    const job = { id, project, state: 'Projekt wird geprüft', output: '', resumable: false }
    active = job
    jobs.set(id, job)
    if (jobs.size > 20) jobs.delete(jobs.keys().next().value)
    send(res, 202, { id })

    const session = previous?.session ?? randomUUID()
    const append = (line) => { job.output = (job.output + line + '\n').slice(-24000) }
    try {
      const cwd = await verify(project, projects.get(project))
      if (job.state === 'Wird abgebrochen') return
      job.state = 'Läuft'
      const child = launch(cwd, prompt, session, Boolean(previous))
      job.child = child
      const decoder = new StringDecoder('utf8')
      let pending = ''
      let success = false
      child.stdout.on('data', (chunk) => {
        pending += decoder.write(chunk)
        let end
        while ((end = pending.indexOf('\n')) !== -1) {
          const line = pending.slice(0, end)
          pending = pending.slice(end + 1)
          try {
            const event = JSON.parse(line)
            if (event.type === 'system' && event.subtype === 'init' && event.session_id === session) {
              job.session = session
              append('Claude Code hat die Sitzung gestartet.')
            }
            if (event.type === 'assistant') {
              for (const block of event.message?.content ?? []) {
                if (block.type === 'text' && typeof block.text === 'string') append(block.text)
                if (block.type === 'tool_use') append('Werkzeug: ' + block.name)
              }
            }
            if (event.type === 'result') success = event.subtype === 'success' && event.is_error === false
          } catch {
            // Unvollständige oder fremde Ausgabe wird nicht an den Browser weitergegeben.
          }
        }
        if (pending.length > 512000) pending = ''
      })
      let diagnostic = false
      child.stderr.on('data', () => { diagnostic = true })
      child.stdin.on('error', () => {})
      const deadline = setTimeout(() => {
        append('Die maximale Laufzeit von 30 Minuten wurde erreicht.')
        child.kill()
      }, 30 * 60 * 1000)
      const code = await new Promise((resolve, reject) => {
        child.once('error', reject)
        child.once('close', resolve)
        child.stdin.end(prompt, 'utf8')
      }).finally(() => clearTimeout(deadline))
      if (job.state !== 'Wird abgebrochen') {
        job.state = code === 0 && success ? 'Abgeschlossen' : 'Fehlgeschlagen'
        if (job.state === 'Fehlgeschlagen') append('Claude Code meldete keinen erfolgreichen Abschluss.' +
          (diagnostic ? ' Prüfe die CLI-Version und die lokale Anmeldung.' : ''))
      }
    } catch {
      if (job.state !== 'Wird abgebrochen') {
        job.state = 'Fehlgeschlagen'
        append('Projekt oder Claude Code konnte nicht gestartet werden. Prüfe die lokale Konfiguration.')
      }
    } finally {
      if (job.state === 'Wird abgebrochen') job.state = 'Abgebrochen'
      job.resumable = Boolean(job.session)
      delete job.child
      active = undefined
    }
  })
}

export function cliArgs(session, resume) {
  return [
    '--print', '--safe-mode', '--no-chrome', '--strict-mcp-config',
    '--disallowedTools', 'mcp__*',
    '--output-format', 'stream-json', '--verbose', '--max-turns', '20',
    '--permission-mode', 'acceptEdits', '--tools', 'Read,Glob,Grep,Edit,Write',
    resume ? '--resume' : '--session-id', session
  ]
}

async function main() {
  if (process.platform !== 'win32') throw new Error('Diese Bridge benötigt Windows.')
  const configPath = process.argv[2] ?? join(process.env.LOCALAPPDATA, 'KI Workspace Bridge', 'projects.json')
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  const executable = async (path, name) => {
    if (typeof path !== 'string' || !isAbsolute(path)) throw new Error('Absoluter Programmpfad erforderlich.')
    const resolved = await realpath(path)
    if (!resolved.toLowerCase().endsWith('\\' + name)) throw new Error('Unzulässiges Programm.')
    return resolved
  }
  const claude = await executable(config.claude, 'claude.exe')
  const git = await executable(config.git, 'git.exe')
  const projects = new Map()
  for (const [repo, path] of Object.entries(config.projects)) {
    if (!repoPattern.test(repo) || typeof path !== 'string' || !isAbsolute(path)) throw new Error('Ungültiger Projekteintrag.')
    projects.set(repo, await realpath(path))
  }
  if (!projects.size) throw new Error('Mindestens ein GitHub-Checkout ist erforderlich.')
  // Keine Anbieter- oder GitHub-Token aus der Umgebung an Claude weitergeben.
  const names = /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|HOMEDRIVE|HOMEPATH|LOCALAPPDATA|APPDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMDATA)$/i
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => names.test(key)))
  const gitRun = promisify(execFile)
  const verify = async (project, cwd) => {
    if (await realpath(cwd) !== cwd) throw new Error('Pfad wurde umgeleitet.')
    const options = { cwd, env, timeout: 5000, windowsHide: true }
    const { stdout: root } = await gitRun(git, ['rev-parse', '--show-toplevel'], options)
    if (await realpath(root.trim()) !== cwd) throw new Error('Nur Git-Wurzelverzeichnisse sind erlaubt.')
    const { stdout } = await gitRun(git, ['config', '--local', '--get', 'remote.origin.url'], options)
    const remote = stdout.trim().replace(/\.git$/i, '').toLowerCase()
    const slug = project.toLowerCase()
    if (remote !== 'https://github.com/' + slug && remote !== 'git@github.com:' + slug) {
      throw new Error('GitHub-Remote stimmt nicht mit der Freigabe überein.')
    }
    return cwd
  }
  const token = randomBytes(32).toString('hex')
  const server = createBridge({
    token, projects, verify,
    launch: (cwd, _prompt, session, resume) => spawn(claude, cliArgs(session, resume), {
      cwd, env, windowsHide: true, shell: false
    })
  })
  server.on('error', () => {
    console.error('Bridge konnte den lokalen Port nicht öffnen.')
    process.exitCode = 1
  })
  server.listen(port, '127.0.0.1', () => {
    console.log('KI Workspace Bridge. Kopplungscode für diese Sitzung:\n' + token)
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error('Bridge konnte nicht starten. Prüfe projects.json und Programmpfade.')
    process.exitCode = 1
  })
}

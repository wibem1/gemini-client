const dialog = document.getElementById('development-dialog')
const element = (name) => document.getElementById('development-' + name)
const project = element('project')
const prompt = element('prompt')
const status = element('status')
const start = element('start')
const resume = element('resume')
const cancel = element('cancel')
let token = ''
let job
let busy = false
let running = false
let timer

async function bridge(path, payload) {
  const options = {
    headers: { Authorization: 'Bearer ' + token },
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(5000)
  }
  if (payload) {
    options.method = 'POST'
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(payload)
  }
  const response = await fetch('http://127.0.0.1:37419' + path, options).catch(() => {
    throw new Error('Windows-Bridge nicht erreichbar. Prüfe, ob sie läuft und ob der Browser Zugriff auf das lokale Netzwerk erlaubt.')
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Aufruf fehlgeschlagen.')
  return data
}

function controls() {
  start.disabled = busy || running || !project.value
  cancel.disabled = busy || !running
  resume.disabled = start.disabled || !job?.resumable || job.project !== project.value
  element('connect').disabled = busy
  element('github').hidden = !project.value
  if (project.value) element('github').href = 'https://github.com/' + project.value
}

function schedulePoll() {
  clearTimeout(timer)
  if (dialog.open && job?.id && running) timer = setTimeout(poll, 1000)
}

async function poll() {
  const current = job?.id
  if (!current || busy) return schedulePoll()
  try {
    const state = await bridge('/jobs/' + current)
    if (job?.id !== current || busy) return schedulePoll()
    job = state
    running = !['Abgeschlossen', 'Fehlgeschlagen', 'Abgebrochen'].includes(job.state)
    status.textContent = job.state
    element('output').textContent = job.output
  } catch (error) {
    status.textContent = error.message
  }
  controls()
  schedulePoll()
}

async function act(action) {
  if (busy) return
  busy = true
  controls()
  try {
    await action()
  } catch (error) {
    status.textContent = error.message
  } finally {
    busy = false
    controls()
    schedulePoll()
  }
}

element('open').onclick = () => {
  closeSidebar()
  dialog.showModal()
  controls()
  schedulePoll()
}
dialog.addEventListener('close', () => clearTimeout(timer))
project.onchange = controls
element('connect').onclick = () => act(async () => {
  const input = element('token')
  const candidate = input.value.trim()
  input.value = ''
  if (candidate) token = candidate
  const result = await bridge('/projects')
  project.replaceChildren(...result.projects.map((name) => new Option(name, name)))
  job = result.active ? { id: result.active } : undefined
  running = Boolean(job)
  element('output').textContent = ''
  status.textContent = 'Windows-Bridge verbunden.'
})
async function submit(previous) {
  if (!prompt.value.trim()) throw new Error('Gib einen Entwicklungsauftrag ein.')
  const result = await bridge('/jobs', { project: project.value, prompt: prompt.value, resume: previous })
  job = { id: result.id }
  running = true
  prompt.value = ''
  element('output').textContent = ''
  status.textContent = 'Auftrag angenommen.'
}
start.onclick = () => act(() => submit())
resume.onclick = () => act(() => submit(job.id))
cancel.onclick = () => act(async () => {
  await bridge('/jobs/' + job.id + '/cancel', {})
  status.textContent = 'Abbruch angefordert.'
})

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' }) // fallback

// The DATABASE_URL may be a prisma+postgres:// proxy URL.
// Extract the raw postgres:// URL from the embedded base64 API key if needed.
function resolveConnectionString(): string {
  const url = process.env.DATABASE_URL ?? ''
  if (url.startsWith('prisma+postgres://')) {
    const match = url.match(/[?&]api_key=([^&]+)/)
    if (match) {
      try {
        const decoded = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'))
        if (decoded.databaseUrl) return decoded.databaseUrl
      } catch { /* fall through */ }
    }
  }
  return url
}

const pool = new Pool({ connectionString: resolveConnectionString() })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ── Seed data ────────────────────────────────────────────────────────────────

const USERS = [
  { email: 'admin@flexora.test', name: 'Admin User',   password: 'password123' },
  { email: 'alice@flexora.test', name: 'Alice Rossi',  password: 'password123' },
  { email: 'bob@flexora.test',   name: 'Bob Esposito', password: 'password123' },
]

const STATUS_OPTIONS = [
  { id: 'opt-todo',        label: 'To Do',       color: '#6366f1' },
  { id: 'opt-inprogress',  label: 'In Progress',  color: '#f59e0b' },
  { id: 'opt-review',      label: 'In Review',    color: '#06b6d4' },
  { id: 'opt-done',        label: 'Done',         color: '#10b981' },
]

const PRIORITY_OPTIONS = [
  { id: 'opt-low',    label: 'Low',    color: '#10b981' },
  { id: 'opt-medium', label: 'Medium', color: '#f59e0b' },
  { id: 'opt-high',   label: 'High',   color: '#ef4444' },
]

const CRM_STAGE_OPTIONS = [
  { id: 'opt-lead',       label: 'Lead',       color: '#8b5cf6' },
  { id: 'opt-qualified',  label: 'Qualified',  color: '#06b6d4' },
  { id: 'opt-proposal',   label: 'Proposal',   color: '#f59e0b' },
  { id: 'opt-closed-won', label: 'Closed Won', color: '#10b981' },
  { id: 'opt-closed-lost',label: 'Closed Lost',color: '#ef4444' },
]

async function main() {
  console.log('🌱 Seeding database…')

  // ── Users ────────────────────────────────────────────────────────────────
  const createdUsers: Record<string, string> = {} // email → id
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 12)
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, passwordHash: hash },
    })
    createdUsers[u.email] = user.id
    console.log(`  ✓ User: ${u.email}`)
  }

  const adminId = createdUsers['admin@flexora.test']
  const aliceId = createdUsers['alice@flexora.test']
  const bobId   = createdUsers['bob@flexora.test']

  // ── Workspace 1: Product Team ─────────────────────────────────────────────
  const ws1 = await prisma.workspace.upsert({
    where: { slug: 'product-team-seed' },
    update: {},
    create: {
      name: 'Product Team',
      slug: 'product-team-seed',
      description: 'Product development and roadmap planning',
      color: '#6366f1',
      iconEmoji: '🚀',
    },
  })
  console.log(`  ✓ Workspace: ${ws1.name}`)

  // Members
  for (const [userId, role] of [[adminId, 'owner'], [aliceId, 'admin'], [bobId, 'member']] as [string, string][]) {
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: ws1.id, userId } },
      update: {},
      create: { workspaceId: ws1.id, userId, role },
    })
  }

  // App 1: Roadmap
  const taskFields = JSON.stringify([
    { id: 'f-status',   name: 'Status',   type: 'category', options: STATUS_OPTIONS },
    { id: 'f-priority', name: 'Priority', type: 'category', options: PRIORITY_OPTIONS },
    { id: 'f-due',      name: 'Due Date', type: 'date' },
    { id: 'f-effort',   name: 'Effort',   type: 'number' },
    { id: 'f-feature',  name: 'Feature',  type: 'toggle' },
  ])

  const app1 = await prisma.app.upsert({
    where: { id: 'seed-app-roadmap' },
    update: {},
    create: {
      id: 'seed-app-roadmap',
      workspaceId: ws1.id,
      name: 'Roadmap',
      description: 'Q2 product roadmap and feature backlog',
      iconEmoji: '📈',
      color: '#6366f1',
      fieldsJson: taskFields,
    },
  })

  const roadmapItems = [
    { title: 'User authentication revamp', status: 'opt-done',       priority: 'opt-high',   feature: true,  effort: 8 },
    { title: 'Kanban board view',           status: 'opt-done',       priority: 'opt-high',   feature: true,  effort: 13 },
    { title: 'CSV export',                  status: 'opt-done',       priority: 'opt-medium', feature: false, effort: 3 },
    { title: 'Automations engine',          status: 'opt-inprogress', priority: 'opt-high',   feature: true,  effort: 21 },
    { title: 'Mobile responsive design',    status: 'opt-inprogress', priority: 'opt-medium', feature: false, effort: 8 },
    { title: 'Gantt chart view',            status: 'opt-todo',       priority: 'opt-low',    feature: true,  effort: 34 },
    { title: 'API public endpoints',        status: 'opt-review',     priority: 'opt-medium', feature: true,  effort: 13 },
    { title: 'Dark mode polish',            status: 'opt-review',     priority: 'opt-low',    feature: false, effort: 5 },
    { title: 'Slack integration',           status: 'opt-todo',       priority: 'opt-medium', feature: true,  effort: 13 },
    { title: 'Bulk import from CSV',        status: 'opt-todo',       priority: 'opt-low',    feature: false, effort: 8 },
  ]

  for (const item of roadmapItems) {
    const data = JSON.stringify({
      'f-status':   item.status,
      'f-priority': item.priority,
      'f-due':      new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      'f-effort':   item.effort,
      'f-feature':  item.feature,
    })
    await prisma.item.upsert({
      where: { id: `seed-item-${item.title.replace(/\s+/g, '-').toLowerCase()}` },
      update: {},
      create: {
        id: `seed-item-${item.title.replace(/\s+/g, '-').toLowerCase()}`,
        appId: app1.id,
        title: item.title,
        dataJson: data,
        creatorId: adminId,
      },
    })
  }
  console.log(`  ✓ App: ${app1.name} (${roadmapItems.length} items)`)

  // App 2: Bug Tracker
  const bugFields = JSON.stringify([
    { id: 'f-bstatus',   name: 'Status',   type: 'category', options: STATUS_OPTIONS },
    { id: 'f-bpriority', name: 'Severity', type: 'category', options: PRIORITY_OPTIONS },
    { id: 'f-breporter', name: 'Reporter', type: 'text' },
    { id: 'f-burl',      name: 'Repro URL',type: 'url' },
    { id: 'f-bfixed',    name: 'Fixed',    type: 'toggle' },
  ])

  const app2 = await prisma.app.upsert({
    where: { id: 'seed-app-bugs' },
    update: {},
    create: {
      id: 'seed-app-bugs',
      workspaceId: ws1.id,
      name: 'Bug Tracker',
      description: 'Track reported bugs and regressions',
      iconEmoji: '🐛',
      color: '#ef4444',
      fieldsJson: bugFields,
    },
  })

  const bugs = [
    { title: 'Login page freezes on Safari',     status: 'opt-inprogress', severity: 'opt-high',   fixed: false, reporter: 'alice@flexora.test' },
    { title: 'Notification count not resetting', status: 'opt-todo',       severity: 'opt-medium', fixed: false, reporter: 'bob@flexora.test' },
    { title: 'CSV export missing header row',    status: 'opt-done',       severity: 'opt-low',    fixed: true,  reporter: 'admin@flexora.test' },
    { title: 'Filter bar wraps on mobile',       status: 'opt-review',     severity: 'opt-low',    fixed: false, reporter: 'alice@flexora.test' },
    { title: 'Kanban cards not draggable',       status: 'opt-todo',       severity: 'opt-medium', fixed: false, reporter: 'bob@flexora.test' },
  ]

  for (const bug of bugs) {
    await prisma.item.upsert({
      where: { id: `seed-bug-${bug.title.replace(/\s+/g, '-').toLowerCase().slice(0, 40)}` },
      update: {},
      create: {
        id: `seed-bug-${bug.title.replace(/\s+/g, '-').toLowerCase().slice(0, 40)}`,
        appId: app2.id,
        title: bug.title,
        dataJson: JSON.stringify({ 'f-bstatus': bug.status, 'f-bpriority': bug.severity, 'f-breporter': bug.reporter, 'f-bfixed': bug.fixed }),
        creatorId: aliceId,
      },
    })
  }
  console.log(`  ✓ App: ${app2.name} (${bugs.length} items)`)

  // ── Workspace 2: Sales CRM ─────────────────────────────────────────────────
  const ws2 = await prisma.workspace.upsert({
    where: { slug: 'sales-crm-seed' },
    update: {},
    create: {
      name: 'Sales CRM',
      slug: 'sales-crm-seed',
      description: 'Track deals, leads, and customer pipeline',
      color: '#10b981',
      iconEmoji: '🤝',
    },
  })
  console.log(`  ✓ Workspace: ${ws2.name}`)

  for (const [userId, role] of [[adminId, 'owner'], [bobId, 'admin']] as [string, string][]) {
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: ws2.id, userId } },
      update: {},
      create: { workspaceId: ws2.id, userId, role },
    })
  }

  const crmFields = JSON.stringify([
    { id: 'f-cstage',   name: 'Stage',    type: 'category', options: CRM_STAGE_OPTIONS },
    { id: 'f-cvalue',   name: 'Value (€)', type: 'number' },
    { id: 'f-ccompany', name: 'Company',  type: 'text' },
    { id: 'f-cemail',   name: 'Email',    type: 'email' },
    { id: 'f-cclosed',  name: 'Closed',   type: 'toggle' },
    { id: 'f-ccdate',   name: 'Close Date', type: 'date' },
  ])

  const app3 = await prisma.app.upsert({
    where: { id: 'seed-app-deals' },
    update: {},
    create: {
      id: 'seed-app-deals',
      workspaceId: ws2.id,
      name: 'Deals',
      description: 'Active sales pipeline',
      iconEmoji: '💰',
      color: '#10b981',
      fieldsJson: crmFields,
    },
  })

  const deals = [
    { title: 'Acme Corp — Enterprise Plan',     stage: 'opt-closed-won',  value: 24000, company: 'Acme Corp',     email: 'cto@acme.com',     closed: true  },
    { title: 'Globex Corp — Starter',           stage: 'opt-proposal',    value:  4800, company: 'Globex Corp',   email: 'buy@globex.com',   closed: false },
    { title: 'Initech — Pro Plan',              stage: 'opt-qualified',   value:  9600, company: 'Initech',       email: 'info@initech.io',  closed: false },
    { title: 'Umbrella Ltd — Team',             stage: 'opt-lead',        value:  3600, company: 'Umbrella Ltd',  email: 'hello@umbrella.co',closed: false },
    { title: 'Soylent Inc — Enterprise',        stage: 'opt-closed-lost', value: 18000, company: 'Soylent Inc',   email: 'deals@soylent.com',closed: false },
    { title: 'Hooli — Custom Contract',         stage: 'opt-proposal',    value: 60000, company: 'Hooli',         email: 'vp@hooli.net',     closed: false },
    { title: 'Pied Piper — Startup Deal',       stage: 'opt-qualified',   value:  2400, company: 'Pied Piper',    email: 'rh@piedpiper.io',  closed: false },
  ]

  for (const deal of deals) {
    await prisma.item.upsert({
      where: { id: `seed-deal-${deal.title.replace(/[\s—]+/g, '-').toLowerCase().slice(0, 40)}` },
      update: {},
      create: {
        id: `seed-deal-${deal.title.replace(/[\s—]+/g, '-').toLowerCase().slice(0, 40)}`,
        appId: app3.id,
        title: deal.title,
        dataJson: JSON.stringify({
          'f-cstage':   deal.stage,
          'f-cvalue':   deal.value,
          'f-ccompany': deal.company,
          'f-cemail':   deal.email,
          'f-cclosed':  deal.closed,
          'f-ccdate':   new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        }),
        creatorId: adminId,
      },
    })
  }
  console.log(`  ✓ App: ${app3.name} (${deals.length} items)`)

  console.log('\n✅ Seed complete!\n')
  console.log('Test credentials:')
  console.log('  admin@flexora.test / password123  (owner of both workspaces)')
  console.log('  alice@flexora.test / password123  (admin of Product Team)')
  console.log('  bob@flexora.test   / password123  (member of Product Team, admin of Sales CRM)')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

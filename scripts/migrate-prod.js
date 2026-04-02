#!/usr/bin/env node
// Runs prisma migrate deploy on Vercel only.
// Handles Neon cold-start and clears stale advisory locks from previous failed builds.
'use strict'

if (!process.env.VERCEL) process.exit(0)

const { spawnSync } = require('child_process')
const { Client } = require('pg')

const PRISMA_ADVISORY_LOCK_KEY = 72707369
const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL
if (!url) { console.error('No DATABASE_URL for migrations'); process.exit(1) }

function clientOpts() {
  const opts = { connectionString: url, connectionTimeoutMillis: 30000 }
  // Explicit SSL to avoid pg-connection-string deprecation warning
  if (!url.includes('sslmode=disable')) {
    opts.ssl = { rejectUnauthorized: true }
  }
  return opts
}

async function prepareDb() {
  const client = new Client(clientOpts())
  await client.connect()
  try {
    // Find PIDs holding a stale Prisma advisory lock (e.g. from a crashed build)
    const stale = await client.query(
      `SELECT pid FROM pg_locks WHERE locktype = 'advisory' AND objid = $1 AND pid != pg_backend_pid()`,
      [PRISMA_ADVISORY_LOCK_KEY]
    )
    for (const row of stale.rows) {
      console.log(`Releasing stale advisory lock held by PID ${row.pid}`)
      await client.query('SELECT pg_terminate_backend($1)', [row.pid])
    }
  } finally {
    await client.end().catch(() => {})
  }
  // Wait for terminated backends to fully disconnect
  if ((await Promise.resolve(true))) {
    await new Promise(r => setTimeout(r, 1000))
  }
}

async function main() {
  for (let i = 0; i < 3; i++) {
    try { await prepareDb(); break } catch (e) {
      console.error(`DB prep attempt ${i + 1} failed: ${e.message}`)
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  const env = { ...process.env, DATABASE_URL: url }
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', env })
    if (result.status === 0) process.exit(0)
    console.error(`migrate deploy attempt ${attempt} failed, retrying…`)
    await new Promise(r => setTimeout(r, 3000))
  }
  process.exit(1)
}

main()

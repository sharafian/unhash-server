'use strict'

const fs = require('fs-extra')
const path = require('path')
const Koa = require('koa')
const Router = require('koa-router')
const Logger = require('koa-logger')
const Boom = require('boom')
const DigestStream = require('digest-stream')
const tempy = require('tempy')

const app = new Koa()
const router = new Router()

app.use(Logger())
app.use(router.routes())
app.use(router.allowedMethods({
  throw: true,
  notImplemented: () => Boom.notImplemented(),
  methodNotAllowed: () => Boom.methodNotAllowed()
}))

const SHA256_REGEX = /^[0-9a-fA-F]{64}$/

const digestToPath = (digest) =>
  path.resolve(__dirname, 'data', digest.substring(0, 2), digest)

router.get('/.well-known/unhash.json', (ctx) => {
  ctx.body = {
    upload: 'http://localhost:3000/upload'
  }
})

router.post('/upload', async (ctx) => {
  const tempPath = tempy.file()

  const digest = await (new Promise((resolve, reject) => {
    const digestStream = DigestStream('sha256', 'hex', resolve)
    const stream = fs.createWriteStream(tempPath)
    ctx.req.pipe(digestStream).pipe(stream)
  }))

  const digestPath = digestToPath(digest)
  if (await fs.exists(digestPath)) {
    ctx.status = 200
  } else {
    await fs.ensureDir(path.dirname(digestPath))
    await fs.move(tempPath, digestPath)
    ctx.status = 201
  }

  ctx.body = digest
})

router.get('/:hash', async (ctx) => {
  if (SHA256_REGEX.exec(ctx.params.hash)) {
    const digest = ctx.params.hash.toLowerCase()
    const digestPath = digestToPath(digest)

    if (await fs.exists(digestPath)) {
      ctx.status = 200
      ctx.body = fs.createReadStream(digestPath)
    }
  }
})

router.get('/', (ctx) => {
  ctx.body = 'Hello World!'
})

app.listen(3000)
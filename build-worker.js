import { build } from 'vite'
import { mkdir, cp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

async function ensureDir(dir) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

async function buildWorker() {
  try {
    // 确保目标目录存在
    await ensureDir('dist')
    await ensureDir(join('dist', 'src', 'api'))
    
    // 复制源文件到构建目录
    await cp('src/api', join('dist', 'src', 'api'), { recursive: true })
    
    // 构建 worker
    await build({
      configFile: 'worker.config.js'
    })
    
    console.log('✅ Worker 构建成功')
  } catch (error) {
    console.error('❌ Worker 构建失败:', error)
    process.exit(1)
  }
}

buildWorker()
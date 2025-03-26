import { withConnection } from './db.js'

// 默认配置
export const defaultConfig = {
  resourceSites: [],
  parseApi: '',
  backgroundImage: '',
  enableLogin: false,
  loginPassword: '',
  announcement: '',
  customTitle: ''
}

/**
 * Base64 三次编码
 */
function encodeBase64(str) {
  let encoded = str
  for (let i = 0; i < 3; i++) {
    encoded = Buffer.from(encoded).toString('base64')
  }
  return encoded
}

/**
 * Base64 三次解码
 */
function decodeBase64(str) {
  try {
    let decoded = str
    for (let i = 0; i < 3; i++) {
      decoded = Buffer.from(decoded, 'base64').toString()
    }
    return decoded
  } catch (e) {
    console.error('Base64解码失败:', e)
    return ''
  }
}

// 获取配置
export async function getConfig(dsn) {
  try {
    if (!dsn) {
      console.log('未提供 DSN，返回默认配置')
      return defaultConfig
    }
    
    return await withConnection(dsn, async (connection) => {
      const [rows] = await connection.query('SELECT config FROM configs ORDER BY id DESC LIMIT 1')
      if (Array.isArray(rows) && rows.length > 0) {
        const config = typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config
        
        // 如果有密码，在返回前进行三次Base64加密，仅用于传输
        if (config.loginPassword) {
          console.log('对密码进行三次Base64加密用于传输')
          config.loginPassword = encodeBase64(config.loginPassword)
        }
        
        return config
      }
      return defaultConfig
    }).catch(error => {
      console.error('获取配置失败:', error)
      return defaultConfig
    })
  } catch (error) {
    console.error('获取配置失败:', error)
    return defaultConfig
  }
}

// 更新配置
export async function updateConfig(config, dsn) {
  try {
    if (!dsn) {
      throw new Error('未提供数据库连接信息')
    }

    return await withConnection(dsn, async (connection) => {
      // 创建配置的副本
      const configToUpdate = { ...config }
      
      // 密码不需要解密，因为前端传来的就是明文密码
      // 数据库中存储的也是明文密码

      // 先检查是否存在记录
      const [rows] = await connection.query('SELECT id FROM configs LIMIT 1')
      
      if (rows.length > 0) {
        // 如果存在记录，执行更新
        await connection.query('UPDATE configs SET config = ? WHERE id = ?', [
          JSON.stringify(configToUpdate),
          rows[0].id
        ])
      } else {
        // 如果不存在记录，执行插入
        await connection.query('INSERT INTO configs (config) VALUES (?)', [
          JSON.stringify(configToUpdate)
        ])
      }
      
      return { success: true, message: '配置更新成功' }
    }).catch(error => {
      console.error('更新配置失败:', error)
      return { success: false, message: error.message }
    })
  } catch (error) {
    console.error('更新配置失败:', error)
    return { success: false, message: error.message }
  }
}

// 获取公开配置（不包含密码）
export async function getPublicConfig(dsn) {
  const config = await getConfig(dsn)
  const { loginPassword, ...publicConfig } = config
  return publicConfig
}

// 验证密码（使用明文对比）
export async function verifyPassword(password, dsn) {
  try {
    if (!dsn) {
      return true
    }

    return await withConnection(dsn, async (connection) => {
      const [rows] = await connection.query('SELECT config FROM configs ORDER BY id DESC LIMIT 1')
      if (Array.isArray(rows) && rows.length > 0) {
        const dbConfig = typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config
        return password === dbConfig.loginPassword
      }
      return true
    }).catch(error => {
      console.error('验证密码失败:', error)
      return false
    })
  } catch (error) {
    console.error('验证密码失败:', error)
    return false
  }
}

<script setup lang="ts">
import { ref, onBeforeUnmount, watch} from 'vue'
import DPlayer from 'dplayer'
import Hls from 'hls.js'

interface Props {
  url: string
  parseApi: string
  refreshTrigger?: number  // 添加刷新触发器属性
}

const props = defineProps<Props>()
const playerContainer = ref<HTMLElement | null>(null)
const iframeContainer = ref<HTMLIFrameElement | null>(null) 
let player: DPlayer | null = null
let hls: Hls | null = null
let retryCount = 0
const MAX_RETRY_COUNT = 1
const isHtmlVideo = ref(false)

// 添加状态监控
let lastPlayingTime = 0
let lastCheckTime = 0
let stuckCheckTimer: number | null = null
let waitingTimer: number | null = null
const STUCK_THRESHOLD = 3000 // 3秒无响应认为卡住
const CHECK_INTERVAL = 3000 // 每3秒检查一次
const WAITING_TIMEOUT = 3000 // 等待数据超时时间

// 添加一个变量来记录用户最后选择的时间点
let userSelectedTime = 0

// 添加标志变量
let isUrlChanging = false

// 添加一个标志变量来标识是否是手动刷新
let isManualRefresh = false

// 修改检查重试函数
const checkAndRetry = () => {
  // 手动刷新或 URL 变化过程中不执行重试
  if (isManualRefresh || isUrlChanging) {
    return false
  }
  
  if (retryCount >= MAX_RETRY_COUNT) {
    console.error('已达到最大重试次数，停止重试')
    return false
  }
  retryCount++
  console.log(`开始第 ${retryCount} 次重试...`)
  return true
}

// 检查播放器状态
const checkPlayerStatus = () => {
  if (!player?.video || !hls) return

  const currentTime = player.video.currentTime
  const now = Date.now()

  // 检查是否播放卡住
  if (player.video.paused) {
    // 暂停状态不检查
    lastCheckTime = now
    return
  }

  // 只在播放状态下检查
  if (player.video.readyState < 3) { // HAVE_FUTURE_DATA = 3
    // 还在缓冲中，延长检查间隔
    lastCheckTime = now
    return
  }

  // 检查视频是否真正在播放
  if (currentTime === lastPlayingTime && now - lastCheckTime > STUCK_THRESHOLD) {
    console.warn('检测到播放器可能卡住，尝试恢复...')
    handlePlaybackStuck()
  }

  lastPlayingTime = currentTime
  lastCheckTime = now
}

// 处理播放卡住
const handlePlaybackStuck = () => {
  if (!player?.video || !hls) return

  // 1. 先尝试重新加载当前时间点
  const currentTime = player.video.currentTime
  hls.startLoad(currentTime)
  
  // 2. 如果视频元素出错，重置视频元素
  if (player.video.error || player.video.networkState === 3) {
    player.video.load()
  }

  // 3. 如果还是无法恢复，使用 switchVideo 重新加载
  setTimeout(() => {
    if (player?.video && 
        (player.video.readyState === 0 || 
         player.video.networkState === 3 || 
         player.video.error)) {
      console.warn('播放器无法恢复，尝试重新加载...')
      const savedTime = currentTime
      // @ts-ignore
      player.switchVideo({
        url: props.url,
        type: detectVideoType(props.url)
      })
      
      // 等待视频加载完成后恢复进度
      const onCanPlay = () => {
        if (player?.video) {
          player.video.removeEventListener('canplay', onCanPlay)
          player.video.currentTime = savedTime
          player.video.play()
        }
      }
      player.video.addEventListener('canplay', onCanPlay)
    }
  }, 3000)
}

// 初始化状态监控
const initStatusMonitor = () => {
  if (!player) return

  // 清理旧的定时器
  if (stuckCheckTimer) {
    clearInterval(stuckCheckTimer)
  }
  if (waitingTimer) {
    clearTimeout(waitingTimer)
  }

  // 设置新的状态监控
  stuckCheckTimer = window.setInterval(checkPlayerStatus, CHECK_INTERVAL)

  // 监听播放器事件
  // @ts-ignore
  player.on('error', () => {
    if (!checkAndRetry()) return
    
    // 延迟一段时间后重试
    setTimeout(() => {
      console.log('尝试重新初始化播放器final...')
      initPlayer(props.url)
    }, 1000)

  })

  // @ts-ignore
  player.on('seeking', () => {
    if (player?.video) {
      const currentTime = player.video.currentTime
      userSelectedTime = currentTime
      
      lastPlayingTime = currentTime
      lastCheckTime = Date.now()
    }
  })

  // @ts-ignore
  player.on('waiting', () => {
    
    // 清理旧的等待定时器
    if (waitingTimer) {
      clearTimeout(waitingTimer)
    }
    
    // 设置新的等待超时处理
    waitingTimer = window.setTimeout(() => {
      if (!player?.video || !hls) return
      
      const targetTime = userSelectedTime || player.video.currentTime
      console.warn('等待数据超时，尝试恢复播放...', {
        currentTime: player.video.currentTime,
        targetTime,
        readyState: player.video.readyState,
        networkState: player.video.networkState,
        buffered: player.video.buffered.length > 0 ? {
          start: player.video.buffered.start(0),
          end: player.video.buffered.end(0)
        } : null
      })

      try {
        // 1. 先停止当前加载
        hls.stopLoad()
        
        // 2. 检查是否在缓冲区边界附近
        if (player.video.buffered.length > 0) {
          const bufferedEnd = player.video.buffered.end(player.video.buffered.length - 1)
          const isNearBufferEnd = Math.abs(targetTime - bufferedEnd) < 1 // 如果在缓冲区末尾1秒内
          
          if (isNearBufferEnd) {
            console.log('检测到在缓冲区边界，继续加载新数据')
            // 如果当前不是最低质量，切换到较低质量
            if (hls.currentLevel > 0) {
              console.log('切换到较低质量级别:', hls.currentLevel - 1)
              hls.nextLevel = hls.currentLevel - 1
            }
            
            // 继续尝试加载当前位置的数据
            hls.startLoad(targetTime)
            return // 直接返回，等待新数据加载
          }
        }
        
        // 如果不在缓冲区边界，也不要往回跳，就在当前位置继续等待
        console.log('继续等待数据加载...')
        if (hls.currentLevel > 0) {
          console.log('切换到较低质量级别:', hls.currentLevel - 1)
          hls.nextLevel = hls.currentLevel - 1
        }
        hls.startLoad(targetTime)
      } catch (error) {
        console.error('恢复播放出错:', error)
        if (checkAndRetry()) {
          console.log('尝试切换视频源...')
          // @ts-ignore
          player?.switchVideo({
            url: props.url,
            type: detectVideoType(props.url)
          })
        } else {
          console.log('尝试重新初始化播放器...')
          initPlayer(props.url)
        }
      }
    }, WAITING_TIMEOUT)
  })

  // @ts-ignore
  player.on('playing', () => {
    
    retryCount = 0  // 只在成功播放时重置重试计数
    
    // 清理等待定时器
    if (waitingTimer) {
      clearTimeout(waitingTimer)
      waitingTimer = null
    }
    lastPlayingTime = player?.video?.currentTime || 0
    lastCheckTime = Date.now()
  })

  // @ts-ignore
  player.on('pause', () => {
    // 暂停时更新检测时间
    lastCheckTime = Date.now()
  })

  // 监听网页全屏
  // @ts-ignore
  player.on('webfullscreen', () => {
    if (playerContainer.value) {
      document.body.classList.add('web-fullscreen')
    }
  })

  // 监听退出网页全屏
  // @ts-ignore
  player.on('webfullscreen_cancel', () => {
    if (playerContainer.value) {
      document.body.classList.remove('web-fullscreen')
    }
  })
}

// 检测视频格式
const detectVideoType = (url: string): string => {
  const extension = url.split('?')[0].split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'm3u8':
      return 'm3u8'
    case 'mp4':
      return 'auto'
    case 'webm':
      return 'auto'
    case 'ogv':
      return 'auto'
    case 'flv':
      return 'flv'
    case 'html':
      isHtmlVideo.value = true
      return 'html'
    default:
      // 如果链接包含特定关键字
      if (url.includes('m3u8')) {
        return 'm3u8'
      }
      if (url.includes('html')) {
        isHtmlVideo.value = true
        return 'html'
      }
      return 'auto'
  }
}

// 获取解析后的URL
const getParseUrl = (url: string): string => {

  // 如果是HTML视频且存在解析API配置，则拼接URL
  if (isHtmlVideo.value && props.parseApi) {
    return `${props.parseApi}${url}`
  }
  return url
}

// 初始化视频
const initVideo = () => {

  // 重置HTML视频标记
  isHtmlVideo.value = false
  
  // 先检测视频类型 - 确保这一步总是执行
  const videoType = detectVideoType(props.url)
  
  if (videoType === 'html') {
    isHtmlVideo.value = true

    return true
  } else {
    return false
  }
}

const refreshVideoIframe = () => {
  if (isHtmlVideo.value && iframeContainer.value) {
    iframeContainer.value.src = getParseUrl(props.url);
  }
}

// 初始化播放器
const initPlayer = (url: string) => {
  if (!playerContainer.value) {
    console.error('播放器容器不存在')
    return
  }

  try {
    // 清理旧的播放器实例
    if (player) {
      console.log('销毁旧的播放器实例')
      player.destroy()
      player = null
    }

    // 清理 HLS 实例
    if (hls) {
      console.log('销毁旧的 HLS 实例')
      hls.destroy()
      hls = null
    }

    // 清空容器
    console.log('清空播放器容器')
    playerContainer.value.innerHTML = ''

    // 检测视频类型
    const videoType = detectVideoType(url)
    console.log('检测到的视频类型:', videoType)

    // 创建新的播放器实例
    player = new DPlayer({
      container: playerContainer.value,
      video: {
        url: url,
        type: videoType,
        customType: {
          m3u8: (video: HTMLVideoElement, player: DPlayer) => {

            if (Hls.isSupported()) {
              hls = new Hls({
                // HLS 配置
                maxBufferSize: 0,
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                startLevel: -1,
                manifestLoadingTimeOut: 10000,
                manifestLoadingMaxRetry: 3,
                levelLoadingTimeOut: 10000,
                levelLoadingMaxRetry: 3,
                fragLoadingTimeOut: 10000,
                fragLoadingMaxRetry: 3,
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 30,
                testBandwidth: true,
                //progressive: true, // 这个参数可能会让广告过滤失败，故注释掉
                stretchShortVideoTrack: true,
                forceKeyFrameOnDiscontinuity: true,
                
                // 添加自定义加载器
                loader: customLoaderFactory(),
              })

              // 绑定 HLS 事件
              hls.on(Hls.Events.ERROR, (event, data) => {
                if (!hls) {
                  console.error('HLS 实例不存在，无法处理错误')
                  return
                }

                console.error('HLS 错误:', data)
                if (data.fatal) {
                  switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                      console.log('尝试恢复网络错误...')
                      if (hls.media) {
                        hls.startLoad()
                      }
                      break
                    case Hls.ErrorTypes.MEDIA_ERROR:
                      console.log('尝试恢复媒体错误...')
                      if (hls.media) {
                        hls.recoverMediaError()
                      }
                      break
                    default:
                      console.error('无法恢复的错误，尝试切换视频源')
                      if (checkAndRetry()) {
                        // @ts-ignore
                        player?.switchVideo({
                          url: url,
                          type: videoType
                        })
                      } else {
                        console.log('尝试重新初始化播放器...')
                        initPlayer(url)
                      }
                      break
                  }
                }
              })

              hls.loadSource(url)
              hls.attachMedia(video)

            } else {
              console.error('不支持 HLS 播放')
              player.notice('当前浏览器不支持 HLS 播放', 3000, 0.5)
            }
          }
        }
      },
      autoplay: false,
      theme: '#3B82F6',
      lang: 'zh-cn',
      hotkey: true,
      preload: 'auto',
      volume: 1.0,
      playbackSpeed: [0.5, 0.75, 1, 1.25, 1.5, 2]
    })

    // 初始化完成后启动状态监控
    if (player) {
      console.log('播放器初始化完成，启动状态监控')
      initStatusMonitor()
    }
  } catch (error) {
    console.error('初始化播放器失败:', error)
  }
}

// 重置播放器
const resetPlayer = async () => {
  // 1. 暂停播放和停止加载
  if (player?.video) {
    try {
      player.pause()
      player.video.src = ''
      player.video.load()
    } catch (error) {
      console.warn('重置视频元素失败:', error)
    }
  }
  
  // 2. 停止并销毁 HLS 实例
  if (hls) {
    try {
      hls.stopLoad()
      hls.detachMedia()
      hls.destroy()
      hls = null
    } catch (error) {
      console.warn('销毁 HLS 实例失败:', error)
    }
  }
  
  // 3. 清理所有定时器
  if (stuckCheckTimer) {
    clearInterval(stuckCheckTimer)
    stuckCheckTimer = null
  }
  if (waitingTimer) {
    clearTimeout(waitingTimer)
    waitingTimer = null
  }
  
  // 4. 销毁播放器实例
  if (player) {
    try {
      player.destroy()
      player = null
    } catch (error) {
      console.warn('销毁播放器实例失败:', error)
    }
  }
  
  // 5. 重置所有状态
  retryCount = 0
  userSelectedTime = 0
  lastPlayingTime = 0
  lastCheckTime = Date.now()
  
  // 6. 清理 DOM
  if (playerContainer.value) {
    playerContainer.value.innerHTML = ''
  }
  
  // 7. 等待一小段时间确保清理完成
  await new Promise(resolve => setTimeout(resolve, 100))
}

// 暴露必要的方法和属性
defineExpose({ 
  player: {
    get value() { 
      return player 
    }
  },
  resetPlayer,
  initPlayer
})

// 修改 URL 监听函数
watch(() => props.url, async (newUrl, oldUrl) => {
  // 去掉空格后的 URL
  const trimmedNewUrl = newUrl?.trim() || ''
  const trimmedOldUrl = oldUrl?.trim() || ''

  const initVideoFlag = initVideo()

  if (initVideoFlag) {
    return
  }

  if (!trimmedNewUrl) {
    await resetPlayer()
    return
  }

  // 只在 URL 真正改变时才执行重置和初始化
  if (trimmedNewUrl !== trimmedOldUrl) {
    
    // 设置标志，禁用重试逻辑
    isUrlChanging = true
    
    // 重置状态
    retryCount = 0
    userSelectedTime = 0  // URL 不同时重置进度
    lastPlayingTime = 0
    lastCheckTime = Date.now()
    
    // 清理定时器
    if (waitingTimer) {
      clearTimeout(waitingTimer)
      waitingTimer = null
    }
    if (stuckCheckTimer) {
      clearInterval(stuckCheckTimer)
      stuckCheckTimer = null
    }

    try {
      // 重置并初始化播放器
      await resetPlayer()
      initPlayer(trimmedNewUrl)
    } catch (error) {
      console.error('初始化播放器失败:', error)
    } finally {
      // 恢复重试逻辑
      isUrlChanging = false
    }
  }
}, { immediate: true })

// 修改组件卸载函数
onBeforeUnmount(async () => {
  await resetPlayer()
})

// 修改刷新触发器的监听
watch(() => props.refreshTrigger, async (newVal, oldVal) => {

  const initVideoFlag = initVideo()

  if (initVideoFlag) {
    refreshVideoIframe()
    return
  }

  // 忽略初始化时的触发
  if (newVal === oldVal || !props.url) return
  
  // 保存当前进度
  const currentTime = player?.video?.currentTime || 0
  userSelectedTime = currentTime
  
  try {
    // 设置手动刷新标志
    isManualRefresh = true
    
    // 重置并初始化播放器
    await resetPlayer()
    initPlayer(props.url)
    
    // 等待视频加载完成后恢复进度
    if (player?.video) {
      const onCanPlay = () => {
        if (player?.video) {
          player.video.removeEventListener('canplay', onCanPlay)
          console.log('恢复播放进度:', currentTime)
          
          // 确保 HLS 已经准备好
          if (hls) {
            const onFragLoaded = () => {
              hls?.off(Hls.Events.FRAG_LOADED, onFragLoaded)
              player.video.currentTime = currentTime
              userSelectedTime = currentTime
            }
            hls.on(Hls.Events.FRAG_LOADED, onFragLoaded)
          } else {
            // 非 HLS 视频直接设置进度
            player.video.currentTime = currentTime
            userSelectedTime = currentTime
          }
        }
      }
      player.video.addEventListener('canplay', onCanPlay)
    }
  } catch (error) {
    console.error('刷新播放器失败:', error)
  } finally {
    // 重置手动刷新标志
    isManualRefresh = false
  }
})

// 自定义加载器工厂函数
function customLoaderFactory() {
  // 获取默认加载器
  const DefaultLoader = Hls.DefaultConfig.loader;
  
  // 创建自定义加载器类
  class CustomLoader extends DefaultLoader {
    constructor(config: any) {
      super(config);
      const load = this.load.bind(this);
      
      this.load = function(context: any, config: any, callbacks: any) {

        if (context.type === 'manifest' || context.type === 'level') {
          
          // 覆盖原始回调
          const originalSuccessCallback = callbacks.onSuccess;
          callbacks.onSuccess = function(response: any, stats: any, context: any) {
            if (response.data) {

              const originalContent = response.data;
            
              let lines = originalContent.split('\n');
              let filteredLines = [];

              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                if (line.startsWith('#EXT-X-DISCONTINUITY')) {
                  if (i > 0 && lines[i - 1].startsWith('#EXT-X-PLAYLIST-TYPE')) {
                        filteredLines.push(line);

                        continue;
                    } else {
                        continue;
                    }
                }
                
                filteredLines.push(line);
              }

              const filteredContent = filteredLines.join('\n');
              response.data = filteredContent;
            }
            
            // 调用原始成功回调
            originalSuccessCallback(response, stats, context);
          };
        }
        
        // 调用原始加载函数
        load(context, config, callbacks);
      };
    }
  }
  
  return CustomLoader;
}

</script>

<template>
  <div v-if="!isHtmlVideo" ref="playerContainer" class="relative w-full aspect-video bg-black"></div>
  <iframe
    v-else
    ref="iframeContainer"
    :src="getParseUrl(url)"
    class="w-full aspect-video border-0"
    allowfullscreen
    frameborder="0"
  >
  </iframe>
</template>

<style>
.web-fullscreen {
  overflow: hidden !important;
}

/* 在网页全屏模式下隐藏分割线和右侧面板 */
body.web-fullscreen .lg\:block.lg\:w-1,
body.web-fullscreen .lg\:h-auto.p-4 {
  display: none !important;
}

/* 在网页全屏模式下让视频区域占满宽度 */
body.web-fullscreen .lg\:h-auto.relative {
  width: 100% !important;
}

.web-fullscreen .dplayer {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  bottom: 0 !important;
  right: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  margin: 0 !important;
  padding: 0 !important;
  z-index: 9999 !important;
}

.web-fullscreen .dplayer-video-wrap {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  height: 100% !important;
}

.web-fullscreen .dplayer-video-current {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
  max-height: 100vh !important;
}

.dplayer-web-fullscreen-fix {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  margin: 0 !important;
  padding: 0 !important;
  z-index: 9999 !important;
}
</style> 
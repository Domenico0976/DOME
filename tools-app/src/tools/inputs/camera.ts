import type { ToolDef } from '../../core/types'

const videos = new Map<string, HTMLVideoElement>()

async function startVideo(uid: string): Promise<void> {
  let v = videos.get(uid)
  if (!v) {
    v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    videos.set(uid, v)
  }
  if (v.srcObject) return
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    v.srcObject = stream
    await v.play().catch(() => {})
  } catch {
    /* permission denied — placeholder stays */
  }
}

export const cameraTool: ToolDef = {
  id: 'camera',
  kind: 'input',
  version: '1.0.0',
  label: 'Camera',
  icon: '📷',
  category: 'Inputs',
  defaultParams: { mirror: 'on' },
  controls: [{ param: 'mirror', label: 'Mirror', kind: 'select', options: ['on', 'off'] }],
  render(ctx, _frame, item, _audio, stack) {
    const { width, height } = stack
    const v = videos.get(item.uid)
    if (!v || v.readyState < 2) {
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = '#666'
      ctx.font = '14px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Camera', width / 2, height / 2)
      void startVideo(item.uid)
      return
    }
    const mirror = String(item.params.mirror ?? 'on') === 'on'
    if (mirror) {
      ctx.save()
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
    }
    const rw = v.videoWidth || width
    const rh = v.videoHeight || height
    const scale = Math.max(width / rw, height / rh)
    const dw = rw * scale
    const dh = rh * scale
    ctx.drawImage(v, (width - dw) / 2, (height - dh) / 2, dw, dh)
    if (mirror) ctx.restore()
  },
}

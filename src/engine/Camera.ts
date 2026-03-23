export interface CameraConfig {
  viewportW: number; viewportH: number
  worldW: number; worldH: number
  lerpFactor: number
}

export class Camera {
  x = 0; y = 0
  private tx = 0; private ty = 0

  constructor(private config: CameraConfig) {}

  setTarget(wx: number, wy: number) { this.tx = wx; this.ty = wy }

  update() {
    const { lerpFactor, viewportW, viewportH, worldW, worldH } = this.config
    this.x += (this.tx - this.x) * lerpFactor
    this.y += (this.ty - this.y) * lerpFactor
    this.x = Math.max(0, Math.min(this.x, worldW - viewportW))
    this.y = Math.max(0, Math.min(this.y, worldH - viewportH))
  }

  toScreenX(wx: number) { return wx - this.x }
  toScreenY(wy: number) { return wy - this.y }

  isVisible(wx: number, wy: number, w: number, h: number) {
    const { viewportW, viewportH } = this.config
    return wx + w > this.x && wx < this.x + viewportW &&
           wy + h > this.y && wy < this.y + viewportH
  }

  snapTo(wx: number, wy: number) { this.x = wx; this.y = wy; this.tx = wx; this.ty = wy }
}

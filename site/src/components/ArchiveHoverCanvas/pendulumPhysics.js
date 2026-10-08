// src/components/ArchiveHoverCanvas/pendulumPhysics.js
//
// Cannon.js-style pendulum: gravity is a real constant force, cursor velocity
// delivers lateral impulses. Sub-stepped integration keeps the swing smooth
// and frame-rate-independent.

export const DEFAULT_PARAMS = {
  GRAVITY: 5200,
  ROD_LENGTH: 320,
  DAMPING: 0.978,
  IMPULSE: 0.05,
  VEL_DEADZONE: 300,
  MAX_ANGLE: Math.PI / 4,
  RESTITUTION: 0.35,
  SPEED_SCALE: 0.003,
  DRIVE_SMOOTH: 0.4,
  VEL_SMOOTH: 0.15,
  ACC_SMOOTH: 0.12,
  SUB_STEPS: 6,
}

export function createPendulumState() {
  return {
    theta: 0, omega: 0,
    prevX: null, vel: 0, driveVel: 0, prevVel: 0, accel: 0,
    speed: 0, lean: 0,
  }
}

export function stepPendulum(state, cursorX, dt, p = DEFAULT_PARAMS) {
  if (state.prevX === null) state.prevX = cursorX
  if (dt <= 0) dt = 1 / 60
  if (dt > 0.05) dt = 0.05

  const rawVel = (cursorX - state.prevX) / dt
  state.prevX = cursorX

  state.driveVel += (rawVel - state.driveVel) * p.DRIVE_SMOOTH
  state.vel += (rawVel - state.vel) * p.VEL_SMOOTH
  const rawAccel = (state.vel - state.prevVel) / dt
  state.prevVel = state.vel
  state.accel += (rawAccel - state.accel) * p.ACC_SMOOTH

  const absDrive = Math.abs(state.driveVel)
  const impulseDir = state.driveVel > 0 ? 1 : -1

  const subDt = dt / p.SUB_STEPS
  for (let i = 0; i < p.SUB_STEPS; i++) {
    const gravAlpha = -(p.GRAVITY / p.ROD_LENGTH) * Math.sin(state.theta)
    const impulseAlpha = absDrive > p.VEL_DEADZONE
      ? impulseDir * (absDrive - p.VEL_DEADZONE) * p.IMPULSE
      : 0

    state.omega = (state.omega + (gravAlpha + impulseAlpha) * subDt) * p.DAMPING
    state.theta += state.omega * subDt

    if (state.theta >= p.MAX_ANGLE) {
      state.theta = p.MAX_ANGLE
      state.omega = -Math.abs(state.omega) * p.RESTITUTION
    } else if (state.theta <= -p.MAX_ANGLE) {
      state.theta = -p.MAX_ANGLE
      state.omega = Math.abs(state.omega) * p.RESTITUTION
    }
  }

  const absVel = Math.abs(state.vel)
  state.speed = Math.min(Math.max((absVel - p.VEL_DEADZONE) * p.SPEED_SCALE, 0), 1)
  state.lean = state.theta > 0.01 ? 1 : state.theta < -0.01 ? -1 : 0
  return { theta: state.theta, omega: state.omega, speed: state.speed, lean: state.lean }
}

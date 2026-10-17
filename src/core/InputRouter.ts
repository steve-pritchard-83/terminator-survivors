import type { InputManager } from '../input/InputManager';
import type { UIManager } from '../ui/UIManager';
import type { SceneManager } from '../graphics/SceneManager';
import type { RunState } from '../state/RunState';
import type { AudioEngine } from '../audio/AudioEngine';

export interface InputRouterHost {
  readonly inputManager: InputManager;
  readonly uiManager: UIManager;
  readonly sceneManager: SceneManager;
  readonly runState: RunState;
  readonly audioEngine: AudioEngine;
}

export interface InputResult {
  move: { x: number; z: number };
  aim: number | null;
  aimPos?: { x: number; z: number } | null;
}

export class InputRouter {
  constructor(
    private readonly host: InputRouterHost,
    private readonly onPause: () => void
  ) {
    this.setupCallbacks();
  }

  private setupCallbacks(): void {
    this.host.inputManager.onDashCallback = () => {
      if (this.host.runState.mode === 'playing') {
        this.host.inputManager.consumeDash();
        if (this.host.runState.triggerDash()) {
          this.host.audioEngine.playCombatDive();
        }
      }
    };

    this.host.inputManager.onPauseCallback = () => {
      this.onPause();
    };

    this.host.inputManager.gamepadManager.onConnectCallback = (status) => {
      this.host.uiManager.hudView.showControllerNotification(status.name, true);
      this.host.uiManager.hudView.setGamepadActive(true, status.isXbox);
    };

    this.host.inputManager.gamepadManager.onDisconnectCallback = (status) => {
      this.host.uiManager.hudView.showControllerNotification(status.name, false);
      this.host.uiManager.hudView.setGamepadActive(false, false);
    };
  }

  public update(dt: number): InputResult {
    this.host.inputManager.update(dt);
    this.host.uiManager.updateGamepad(this.host.inputManager.gamepadManager, dt);

    if (this.host.runState.mode !== 'playing') {
      return { move: { x: 0, z: 0 }, aim: null };
    }

    if (this.host.inputManager.consumeDash()) {
      const dashed = this.host.runState.triggerDash();
      if (dashed) {
        this.host.audioEngine.playCombatDive();
      }
    }

    let aimPos: { x: number; z: number } | null = null;
    let move = this.host.inputManager.getMovement();
    if (this.host.inputManager.isMouseAimActive()) {
      const mousePos = this.host.inputManager.getMouseScreenPos();
      if (mousePos) {
        const worldMouse = this.host.sceneManager.screenToWorldGround(mousePos.x, mousePos.y);
        if (worldMouse) {
          aimPos = { x: worldMouse.x, z: worldMouse.z };
          const dx = worldMouse.x - this.host.runState.playerPos.x;
          const dz = worldMouse.z - this.host.runState.playerPos.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.15) {
            this.host.inputManager.setAimAngle(Math.atan2(dx, dz));
          }
          if (
            this.host.inputManager.isMouseMoveActive() &&
            !this.host.inputManager.hasKeyboardMovement() &&
            dist > 0.65
          ) {
            const speedScale = Math.min(1.0, (dist - 0.5) / 1.5);
            move = {
              x: (dx / dist) * speedScale,
              z: (dz / dist) * speedScale
            };
          }
        }
      }
    } else {
      this.host.inputManager.setAimAngle(null);
    }

    return {
      move,
      aim: this.host.inputManager.getAimAngle(),
      aimPos
    };
  }
}

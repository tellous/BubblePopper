import * as hz from 'horizon/core';
import LocalCamera from 'horizon/camera';
import * as hzui from 'horizon/ui';
import { BubbleTappedEvent, ForceGameOverEvent, GameOverResetCameraEvent, PlayerColorAssignEvent, RequestPlayerColorEvent, ScoreEvent } from './Events';

const playerData = {
  colorNameBinding: new hzui.Binding('red'),
  scoreBinding: new hzui.Binding(0),
}

class Local extends hz.Component<typeof Local> {
  static propsDefinition = {
    playerUI: { type: hz.PropTypes.Entity },
    lookAt: { type: hz.PropTypes.Entity },
    ray: { type: hz.PropTypes.Entity },
  };

  private stunnedUntil = 0;
  private localPlayer?: hz.Player;
  private serverPlayer?: hz.Player;
  private rayGizmo?: hz.RaycastGizmo;

  start() {
    this.localPlayer = this.world.getLocalPlayer();
    this.serverPlayer = this.world.getServerPlayer();

    this.props.playerUI?.owner.set(this.localPlayer);

    if (this.localPlayer === this.serverPlayer) {
      return;
    }

    this.requestColorInfo();

    this.rayGizmo = this.props.ray?.as(hz.RaycastGizmo);
    if (this.rayGizmo && this.localPlayer) {
      this.rayGizmo.owner.set(this.localPlayer);
    }
    this.localPlayer.enterFocusedInteractionMode();

    const pos = this.props.lookAt?.position.get() ?? hz.Vec3.zero;
    const playerPos = this.localPlayer.position.get();

    // Create 2D versions of the positions (ignoring Y-axis height)
    const pos2D = new hz.Vec3(pos.x, playerPos.y, pos.z);
    const playerPos2D = new hz.Vec3(playerPos.x, playerPos.y, playerPos.z);

    // Calculate forward direction based on 2D positions
    const forward = pos2D.sub(playerPos2D).normalize() ?? hz.Vec3.forward;

    // Position the camera behind the player looking at the target
    LocalCamera.setCameraModeFixed({
      position: pos.sub(forward.mul(1)).add(hz.Vec3.up.mul(.5)),
      rotation: hz.Quaternion.lookRotation(forward, hz.Vec3.up)
    });
    LocalCamera.overrideCameraFOV(60);

    this.connectLocalBroadcastEvent(
      hz.PlayerControls.onFocusedInteractionInputEnded,
      this.onInteraction.bind(this)
    );

    // Listen for game over event to reset camera to first person
    this.connectNetworkBroadcastEvent(
      GameOverResetCameraEvent,
      this.resetCamera.bind(this)
    );

    // Listen for color assignment from the server
    this.connectNetworkBroadcastEvent(
      PlayerColorAssignEvent,
      this.onColorAssign.bind(this)
    );

    // Listen for score updates
    this.connectNetworkBroadcastEvent(
      ScoreEvent,
      this.onScoreUpdate.bind(this)
    );

    this.connectCodeBlockEvent(
      this.entity,
      hz.CodeBlockEvents.OnPlayerExitedFocusedInteraction,
      this.exit.bind(this)
    );

    // Request initial color assignment
    if (this.localPlayer) {
      this.requestColorInfo();
    }
  }

  private onColorAssign(data: { color: string }) {
    // Update the color name for the UI text
    playerData.colorNameBinding.set(this.getColorName(data.color));
  }

  private getColorName(hexColor: string): string {
    // Basic mapping of color hex codes to names
    const colorMap: Record<string, string> = {
      '#FF0000': 'red',
      '#00FF00': 'green',
      '#0000FF': 'blue',
      '#FFFF00': 'yellow',
      '#FF00FF': 'magenta',
      '#00FFFF': 'cyan',
      '#FFD700': 'gold' // for special bubbles
    };

    return colorMap[hexColor] || 'assigned';
  }

  private resetCamera() {
    LocalCamera.setCameraModeThirdPerson();
    LocalCamera.resetCameraFOV();
    
    // Exit focused interaction mode when the game ends
    if (this.localPlayer) {
      this.localPlayer.exitFocusedInteractionMode();
    }
  }

  private exit() {
    this.resetCamera();

    // Force game over by broadcasting the game over event
    this.sendNetworkBroadcastEvent(ForceGameOverEvent, {});
  }

  private onInteraction(data: { interactionInfo: hz.InteractionInfo[] }) {
    if (Date.now() < this.stunnedUntil) {
      return; // still stunned
    }
    const info = data.interactionInfo[0];
    if (!info || !this.rayGizmo || !this.localPlayer) return;
    const hit = this.rayGizmo.raycast(
      info.worldRayOrigin,
      info.worldRayDirection,
      { layerType: hz.LayerType.Objects }
    );
    if (hit?.targetType === hz.RaycastTargetType.Entity) {
      const ent = hit.target;
      
      // Send the event to the bubble
      this.sendNetworkEvent(
        ent,
        BubbleTappedEvent,
        { player: this.localPlayer }
      );
      
      // The bubble component will handle the stun response, we don't need to stun here
      // We'll only stun on bad bubbles, not all bubbles
      
      console.log("Bubble tapped at: " + Date.now());
    }
  }

  private requestColorInfo() {
    // Request color information from the server
    if (this.localPlayer) {
      this.sendNetworkBroadcastEvent(RequestPlayerColorEvent, {
        player: this.localPlayer
      });
    }
  }

  private onScoreUpdate(data: { player: hz.Player; score: number, entity: hz.Entity }) {
    // Only update score for the local player
    if (data.player === this.localPlayer) {
      playerData.scoreBinding.set(data.score);
    }
  }
}
hz.Component.register(Local);

class PlayerUI extends hzui.UIComponent<typeof PlayerUI> {
  start() {

  }
  preStart() {

  }

  initializeUI() {
    return hzui.View({
      children: [
        hzui.View({
          children: [
            hzui.Text({
              text: playerData.colorNameBinding.derive((colorName) => { return `Pop the ${colorName} bubbles` }),
              style: {
                fontSize: 24,
                fontWeight: 'bold',
              }
            }),
            hzui.View({
              style: {
                width: 30,
                height: 30,
                marginTop: 20,
                borderRadius: 50,
                backgroundColor: playerData.colorNameBinding
              }
            }),
            hzui.Text({
              text: playerData.scoreBinding.derive((score) => { return `Bubbles Popped: ${score}` }),
              style: {
                fontSize: 24,
                fontWeight: 'bold',
                marginTop: 20,
              }
            }),
            hzui.Text({
              text: "Yellow bubbles count as x2!",
              style: {
                fontSize: 24,
                color: '#FFD700',
                marginTop: 10,
                fontWeight: 'bold'
              }
            })
          ],
          style: {
            alignItems: 'center',
          }
        })
      ],
      style: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 20,
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginBottom: 50,
      }
    });
  }
}
hzui.UIComponent.register(PlayerUI);
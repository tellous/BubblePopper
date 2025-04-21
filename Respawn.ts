import * as hz from 'horizon/core';

class Respawn extends hz.Component<typeof Respawn> {
  static propsDefinition = {
    spawnPoint: { type: hz.PropTypes.Entity }
  };

  start() {

  }

  preStart() {
    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerEnterTrigger, this.respawn);
  }

  respawn = (player: hz.Player) => {
    this.props.spawnPoint?.as(hz.SpawnPointGizmo).teleportPlayer(player);
  }
}
hz.Component.register(Respawn);
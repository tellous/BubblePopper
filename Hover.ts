import * as hz from 'horizon/core';

class Hover extends hz.Component<typeof Hover> {
  static propsDefinition = {
  };
  
  start(){}

  preStart(){
    this.connectLocalBroadcastEvent(
        hz.World.onUpdate,
        this.onUpdate
    );
  }

    onUpdate = () => {
        //Make the entity hover
        const time = Date.now() * 0.002;
        const y = Math.sin(time) * 0.1;
        const position = this.entity.transform.position.get();
        const up = this.entity.up.get();
        position.addInPlace(up.mul(y*0.04));
        this.entity.transform.position.set(position);
    };
}
hz.Component.register(Hover);
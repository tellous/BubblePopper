import * as hz from 'horizon/core';

class ZeroGTrigger extends hz.Component<typeof ZeroGTrigger> {
    static propsDefinition = {
    };

    start() {
    }
    preStart() {
        this.connectCodeBlockEvent(
            this.entity,
            hz.CodeBlockEvents.OnPlayerEnterTrigger,
            this.onPlayerEnter.bind(this)
        );

        this.connectCodeBlockEvent(
            this.entity,
            hz.CodeBlockEvents.OnPlayerExitTrigger,
            this.onPlayerExit.bind(this)
        );
    }
    private onPlayerEnter(player: hz.Player) {
        player.gravity.set(2);
    }

    private onPlayerExit(player: hz.Player) {
        player.gravity.set(9.81);
    }
}
hz.Component.register(ZeroGTrigger);
// filepath: c:\Users\Matt\AppData\LocalLow\Meta\Horizon Worlds\Bubble Popper_10236608238414849\scripts\BubbleComponent.ts
import * as hz from 'horizon/core';
import { BubbleTappedEvent, AssignDataEvent, ScoreEvent } from './Events';
import * as GameConstants from './GameConstants';

class BubbleComponent extends hz.Component<typeof BubbleComponent> {
    static propsDefinition = {
        mesh: { type: hz.PropTypes.Entity },
        popSfx: { type: hz.PropTypes.Entity },
        badSfx: { type: hz.PropTypes.Entity }, // Sound for when a bad (stun) bubble is popped
        specialSfx: { type: hz.PropTypes.Entity }, // Sound for when a special bubble is popped
    }

    mesh?: hz.MeshEntity;
    player?: hz.Player;
    score: number = 0; // default score
    private risingSpeed: number = 0.2; // speed at which bubble rises upward
    private isBadBubble: boolean = false; // stun bubble flag
    private isSpecialBubble: boolean = false; // special bubble flag
    private bubbleColor: string = ''; // store the bubble color

    start() { }

    preStart() {
        this.mesh = this.props.mesh?.as(hz.MeshEntity);

        // VR: detect hand collisions
        this.connectCodeBlockEvent(
            this.entity,
            hz.CodeBlockEvents.OnPlayerCollision,
            this.onCollision.bind(this)
        );

        // Listen for color assignment
        this.connectLocalEvent(
            this.entity,
            AssignDataEvent,
            this.onAssignData.bind(this)
        );

        // Listen for bubble tap events
        this.connectNetworkEvent(
            this.entity,
            BubbleTappedEvent,
            this.onBubbleTapped.bind(this)
        );

        // Connect to update event for continuous rising motion
        this.connectLocalBroadcastEvent(
            hz.World.onUpdate,
            this.onUpdate.bind(this)
        );

        this.mesh?.style.tintStrength.set(1); // Set the tint strength to 1 for full color visibility
    }

    private onUpdate(data: { deltaTime: number }) {
        // Move the bubble upward at a constant speed
        const currentPosition = this.entity.position.get();
        const upwardMovement = new hz.Vec3(0, this.risingSpeed * data.deltaTime, 0);
        const newPosition = currentPosition.add(upwardMovement);
        this.entity.position.set(newPosition);
    }

    private onAssignData = (data: { player?: hz.Player, color: string, score: number }) => {
        this.player = data.player;
        this.score = data.score;
        this.bubbleColor = data.color;

        // Determine bubble type based on color
        this.isBadBubble = data.color === '#8B4513'; // Brown color for stun bubbles
        this.isSpecialBubble = data.color === '#FFD700'; // Gold color for special bubbles

        // Make special bubbles slightly larger (1.5x size)
        if (this.isSpecialBubble) {
            this.entity.scale.set(new hz.Vec3(1.5, 1.5, 1.5));
        }

        this.mesh?.style.tintColor.set(hz.Color.fromHex(data.color)); // Set the color of the bubble mesh
    }

    private onCollision(other: hz.Player) {
        if (this.isBadBubble) {
            // Any player can pop a stun bubble
            this.popStunBubble(other);
        } else if (this.player && this.player.id === other.id) {
            // Regular bubble - only assigned player can pop it
            this.pop(other);
        } else if (this.isSpecialBubble) {
            // Special bubble - anyone can pop it
            this.pop(other);
        }
    }

    private onBubbleTapped(data: { player: hz.Player }) {
        if (this.isBadBubble) {
            // Any player can pop a stun bubble
            this.popStunBubble(data.player);
        } else if (this.player && this.player === data.player) {
            // Regular bubble - only assigned player can pop it
            this.pop(data.player);
        } else if (this.isSpecialBubble) {
            // Special bubble - anyone can pop it
            this.pop(data.player);
        }
    }

    private popStunBubble(player: hz.Player) {
        // Play the stun sound effect
        if (this.props.badSfx) {
            this.props.badSfx.position.set(this.entity.position.get());
            this.props.badSfx.as(hz.AudioGizmo)?.play();
        } else if (this.props.popSfx) {
            // Fallback to regular pop sound
            this.props.popSfx.position.set(this.entity.position.get());
            this.props.popSfx.as(hz.AudioGizmo)?.play();
        }

        // Apply stun effect (negative score)
        this.sendLocalBroadcastEvent(ScoreEvent, { 
            player: player, 
            score: this.score, // Use the assigned score (should be -1)
            entity: this.entity 
        });
    }

    private pop(player: hz.Player) {
        // Play the appropriate sound effect
        if (this.isSpecialBubble && this.props.specialSfx) {
            this.props.specialSfx.position.set(this.entity.position.get());
            this.props.specialSfx.as(hz.AudioGizmo)?.play();
        } else if (this.props.popSfx) {
            this.props.popSfx.position.set(this.entity.position.get());
            this.props.popSfx.as(hz.AudioGizmo)?.play();
        }

        // Calculate final score (special bubbles get multiplier if popped by correct player)
        let finalScore = this.score;
        if (this.isSpecialBubble && this.player && this.player.id === player.id) {
            // If the special bubble is popped by the assigned player, apply the multiplier
            finalScore *= GameConstants.SPECIAL_SCORE_MULTIPLIER;
        }

        // Award points
        this.sendLocalBroadcastEvent(ScoreEvent, { 
            player: player, 
            score: finalScore, 
            entity: this.entity 
        });
    }
}
hz.Component.register(BubbleComponent);
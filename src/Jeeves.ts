import Doodad from "game/doodad/Doodad";
import { DoodadType } from "game/doodad/IDoodad";
import { MessageType } from "game/entity/player/IMessageManager";
import Player from "game/entity/player/Player";
import { TileUpdateType } from "game/IGame";
import { ITile } from "game/tile/ITerrain";
import Message from "language/dictionary/Message";
import { HookMethod } from "mod/IHookHost";
import Mod from "mod/Mod";
import Register from "mod/ModRegistry";
import Component from "ui/component/Component";
import { CheckButton } from "ui/component/CheckButton";
import { Direction } from "utilities/math/Direction";
import { IGlobalData, JeevesOptions } from "./IJeeves";
import { Dictionary } from "language/Dictionaries";
import Translation from "language/Translation";

export default class Jeeves extends Mod {
    @Mod.instance<Jeeves>("Jeeves")
    public static readonly INSTANCE: Jeeves;

    @Mod.globalData<Jeeves>()
    public globalData: IGlobalData;

    //#region Init

    @Register.message("Init")
    public readonly initMsg: Message;

    @HookMethod
    public onGameScreenVisible(): void {
        localPlayer.messages.type(MessageType.Good).send(this.initMsg, modManager.getVersion(this.getIndex()));
    }

    //#endregion

    //#region Options

    @Register.dictionary("Options", JeevesOptions)
    public readonly options: Dictionary;

    @Register.optionsSection
    public optCloseDoor(section: Component) {
        section.append(
            new CheckButton()
                .setText(() => new Translation(this.options, JeevesOptions.CloseDoor))
                .setRefreshMethod(() => !!this.globalData.CloseDoor)
                .event.subscribe("toggle", (_, checked) => this.globalData.CloseDoor = checked)
        );
    }

    //#endregion

    @Register.message("ClosedDoor")
    public readonly closedDoorMsg: Message;

    private isClosingDoor = false;

    @HookMethod
    public onMove(player: Player, nextX: number, nextY: number, tile: ITile, direction: Direction): boolean | undefined {
        if (this.canCloseDoor(player, tile)) {
            // Set property to indicate we're trying to close the door, then actually do it
            this.isClosingDoor = true;
            this.closeDoor(player);
        }

        this.event.emitAsync
        return undefined;
    }

    /**
     * Determine if we can close a door for the player
     * @param player Player to close the door for
     * @param tile Tile player is moving to
     * @returns If the tile has a door to close
     */
    private canCloseDoor(player: Player, tile: ITile): boolean {
        if (!this.globalData.CloseDoor
            || this.isClosingDoor
            || tile.creature
            || tile.npc
            || tile.doodad?.blocksMove()) return false;
        // Check if doodad is a door or gate and is open (!closed)
        let dd = player.getTile().doodad?.description();
        return dd && (dd.isDoor || dd.isGate) && !dd.isClosed || false;
    }

    /**
     * Attempt to close the door for the player
     * @param player Player to close the door for
     */
    private closeDoor(player: Player): void {
        // Get the player's tile where the door should(?) be
        let door = player.getTile().doodad;
        if (!door) return;

        // Only update when the door toggled
        if (this.toggleDoor(door)) {
            world.updateTile(door.x, door.y, door.z, door.getTile(), TileUpdateType.DoodadChangeType);
            renderer?.render();
            player.messages.type(MessageType.None).send(this.closedDoorMsg, door.getName());
        }

        this.isClosingDoor = false;
    }

    /**
     * Attempts to toggle the doodad/door based on it's current type
     * @param door Doodad that is the suspected door
     * @returns Whether the door has been toggled
     */
    private toggleDoor(door: Doodad): boolean {
        switch (door.type) {

            case DoodadType.WoodenDoorOpen:
                door.changeType(DoodadType.WoodenDoor);
                return true;

            case DoodadType.WoodenGateOpen:
                door.changeType(DoodadType.WoodenGate);
                return true;

            // Add any future doors here

            // Do not update tile and render when we don't change door
            default: return false;
        }
    }
}

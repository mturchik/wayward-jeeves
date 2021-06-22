import Doodad from "game/doodad/Doodad";
import { DoodadType } from "game/doodad/IDoodad";
import { MessageType, Source } from "game/entity/player/IMessageManager";
import Player from "game/entity/player/Player";
import { TileUpdateType } from "game/IGame";
import Message from "language/dictionary/Message";
import { HookMethod } from "mod/IHookHost";
import Mod from "mod/Mod";
import Register from "mod/ModRegistry";
import Component from "ui/component/Component";
import { CheckButton } from "ui/component/CheckButton";
import { IGlobalData, JeevesOptions } from "./IJeeves";
import { Dictionary } from "language/Dictionaries";
import Translation from "language/Translation";
import { EventHandler } from "event/EventManager";
import { EventBus } from "event/EventBuses";
import { Direction } from "utilities/math/Direction";
import MessageManager from "game/entity/player/MessageManager";

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

    @EventHandler(EventBus.LocalPlayer, "moveComplete")
    public moveComplete(player: Player) {
        if (!this.globalData.CloseDoor) return;

        let tile = this.getTileBehindPlayer(player);
        if (tile && tile.doodad && this.isClosableDoor(tile.doodad))
            this.closeDoor(tile.doodad);
    }

    /**
     * Get the tile that the player just moved from
     * @param player Player who moved
     * @returns Tile behind the player after movement
     */
    private getTileBehindPlayer(player: Player) {
        let vector = Direction.vector(player.facingDirection);
        return game.getTile(
            player.fromX - vector.x,
            player.fromY - vector.y,
            player.z
        );
    }

    /**
     * Determine if we can close a door
     * @param door Door doodad to close
     * @returns If the doodad is a door that can be closed
     */
    private isClosableDoor(door: Doodad): boolean {
        let dd = door?.description();
        // Check if doodad is a door or gate and is open (!closed)
        return dd && (dd.isDoor || dd.isGate) && !dd.isClosed || false;
    }

    /**
     * Attempt to close the door for the player
     * @param door Door doodad to close
     */
    private closeDoor(door: Doodad): void {
        if (door.type == DoodadType.WoodenDoorOpen)
            door.changeType(DoodadType.WoodenDoor);
        else if (door.type == DoodadType.WoodenGateOpen)
            door.changeType(DoodadType.WoodenGate);
        else return;

        world.updateTile(door.x, door.y, door.z, door.getTile(), TileUpdateType.DoodadChangeType);
        renderer?.render();
        MessageManager.toAll(message => message
            .source(Source.Action)
            .type(MessageType.None)
            .send(this.closedDoorMsg, door.getName())
        );
    }
}

import { IGlobalData, JeevesTranslations, CheckboxOption } from "./IJeeves";
import { EventBus } from "event/EventBuses";
import { EventHandler } from "event/EventManager";
import Doodad from "game/doodad/Doodad";
import { DoodadType } from "game/doodad/IDoodad";
import Player from "game/entity/player/Player";
import MessageManager from "game/entity/player/MessageManager";
import { MessageType, Source } from "game/entity/player/IMessageManager";
import { ITile } from "game/tile/ITerrain";
import Message from "language/dictionary/Message";
import Translation from "language/Translation";
import Mod from "mod/Mod";
import Register from "mod/ModRegistry";
import Component from "ui/component/Component";
import { CheckButton } from "ui/component/CheckButton";
import Bindable from "ui/input/Bindable";
import { IInput } from "ui/input/IInput";
import GameScreen from "ui/screen/screens/GameScreen";
import Dictionary from "/language/Dictionary";
import Vector2 from "utilities/math/Vector2";
import Island from "game/island/Island";
import { TileUpdateType } from "game/IGame";

export default class Jeeves extends Mod {
    @Mod.instance<Jeeves>("Jeeves")
    public static readonly INSTANCE: Jeeves;

    @Mod.globalData<Jeeves>()
    public globalData: IGlobalData;

    //#region Init

    @Register.message("Init")
    public readonly initMsg: Message;

    @EventHandler(GameScreen, "show")
    public onGameScreenVisible(): void {
        localPlayer.messages.type(MessageType.Good).send(this.initMsg, modManager.getVersion(this.getIndex()));
    }

    //#endregion

    //#region Options

    @Register.dictionary("Translations", JeevesTranslations)
    public readonly translations: Dictionary;

    @Register.bindable("ToggleGroundContainer", IInput.key("KeyG"))
    public readonly bindableToggleGroundContainer: Bindable;

    @Register.optionsSection
    public optionSetup(section: Component): void {
        section.append(
            this.createCheckButton(
                CheckboxOption.CloseDoor,
                JeevesTranslations.CloseDoor,
                JeevesTranslations.CloseDoorTooltip
            ).element,
            // this.createCheckButton(
            //     CheckboxOption.ManageGroundContainer,
            //     JeevesTranslations.ManageGroundContainer,
            //     JeevesTranslations.ManageGroundContainerTooltip
            // ).element
        );
    }

    private createCheckButton(opt: CheckboxOption, text: JeevesTranslations, tooltipText: JeevesTranslations): CheckButton {
        return new CheckButton()
            .setText(() => Translation.get(this.translations, text))
            .setTooltip(tooltip => tooltip.addText(text => text.setText(Translation.get(this.translations, tooltipText))))
            .setRefreshMethod(() => !!this.globalData[opt])
            .event.subscribe("toggle", (btn: CheckButton, checked: boolean) => { this.globalData[opt] = checked; });
    }

    //#endregion

    //#region Close Door

    @Register.message("ClosedDoor")
    public readonly closedDoorMsg: Message;

    @EventHandler(EventBus.Players, "moveComplete")
    public moveComplete(player: Player): void {
        if (!this.globalData[CheckboxOption.CloseDoor]) return;

        let tile = this.getTileBehindPlayer(player);
        if (tile?.doodad && this.isClosableDoor(tile.doodad))
            this.closeDoor(tile.doodad, player);
    }

    /**
     * Get the tile that the player just moved from
     * @param player Player who moved
     * @returns Tile behind the player after movement
     */
    private getTileBehindPlayer(player: Player): ITile | undefined {
        let vector = Vector2.DIRECTIONS[player.facingDirection];
        let island = this.getIsland(player);
        return island?.getTile(
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
     * @param player Player who moved to close door
     */
    private closeDoor(door: Doodad, player: Player): void {
        if (door.type == DoodadType.WoodenDoorOpen)
            door.changeType(DoodadType.WoodenDoor);
        else if (door.type == DoodadType.WoodenGateOpen)
            door.changeType(DoodadType.WoodenGate);
        else return;

        let island = this.getIsland(player);
        island?.emitTileUpdate(door.getTile(), door.x, door.y, door.z, TileUpdateType.DoodadChangeType, true);

        MessageManager.toAll(message => message
            .source(Source.Action)
            .type(MessageType.None)
            .send(this.closedDoorMsg, door.getName(), player.name)
        );
    }

    private getIsland(player: Player): Island | undefined {
        return game.islands.active.find(i => i.players.has(player));
    }

    //#endregion

    //#region Ground Container

    /** Disabling the Ground Container functionality because I'd like to actually play the game and 2.11 broke how I was doing it before. */

    // @Register.message("ToggleGroundContainer")
    // public readonly toggleGroundContainerMsg: Message;

    // @Bind.onDown(Registry<Jeeves>().get("bindableToggleGroundContainer"))
    // public onToggleGroundContainer(): boolean {
    //     console.clear()
    //     if (!this.globalData[CheckboxOption.ManageGroundContainer]) return false;

    //     let island = this.getIsland(localPlayer);
    //     // let v3 = localPlayer.getFacingPoint();
    //     let tile = island?.getTileFromPoint(localPlayer.getFacingPoint());
    //     console.log(tile);
    //     console.log(<IContainer>tile)
    //     let isOpen = oldui.isContainerOpen(<IContainer>tile);
    //     console.log(isOpen);

    //     // let tileContainer = island?.tileContainers.find(tc => tc.x == v3.x && tc.y == v3.y && tc.z == v3.z);
    //     console.log(!tile?.containedItems?.length)
    //     if (!tile?.containedItems?.length) return false;

    //     if (oldui.isContainerOpen(<IContainer>tile)) {
    //         oldui.closeContainer(<IContainer>tile);
    //         localPlayer.messages.type(MessageType.None).send(this.toggleGroundContainerMsg, 'hidden');
    //         console.log('hidden')
    //     } else {
    //         oldui.openContainer(<IContainer>tile, 'Ground');
    //         localPlayer.messages.type(MessageType.None).send(this.toggleGroundContainerMsg, 'shown');
    //         console.log('shown')
    //     }

    //     return true;
    // }

    //#endregion
}

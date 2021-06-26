import Doodad from "game/doodad/Doodad";
import { DoodadType } from "game/doodad/IDoodad";
import { MessageType, Source } from "game/entity/player/IMessageManager";
import Player from "game/entity/player/Player";
import { TileUpdateType } from "game/IGame";
import Message from "language/dictionary/Message";
import { HookMethod } from "mod/IHookHost";
import Mod from "mod/Mod";
import Register, { Registry } from "mod/ModRegistry";
import Component from "ui/component/Component";
import { CheckButton } from "ui/component/CheckButton";
import { IGlobalData, CheckboxOption, JeevesTranslations } from "./IJeeves";
import { Dictionary } from "language/Dictionaries";
import Translation from "language/Translation";
import { EventHandler } from "event/EventManager";
import { EventBus } from "event/EventBuses";
import { Direction } from "utilities/math/Direction";
import MessageManager from "game/entity/player/MessageManager";
import Bindable from "ui/input/Bindable";
import { IInput } from "ui/input/IInput";
import Bind from "ui/input/Bind";
import { ITooltip } from "ui/component/IComponent";

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

    @Register.bindable("ToggleGroundContainer", IInput.key("KeyG"))
    public readonly bindableToggleGroundContainer: Bindable;

    @Register.optionsSection
    public optionSetup(section: Component) {
        section.append(
            this.createCheckButton(
                JeevesTranslations.CloseDoor,
                JeevesTranslations.CloseDoorTooltip,
                CheckboxOption.CloseDoor)
        ).append(
            this.createCheckButton(
                JeevesTranslations.ManageGroundContainer,
                JeevesTranslations.ManageGroundContainerTooltip,
                CheckboxOption.ManageGroundContainer)
        );
    }

    private createCheckButton(t1: JeevesTranslations, t2: JeevesTranslations, opt: CheckboxOption) {
        return new CheckButton()
            .setText(() => this.getTranslation(t1))
            .setTooltip(tooltip => this.addTooltipText(tooltip, t2))
            .setRefreshMethod(() => !!this.globalData[opt])
            .event.subscribe("toggle", (_, checked) => this.globalData[opt] = checked);
    }

    private addTooltipText(tooltip: ITooltip, t: JeevesTranslations): ITooltip {
        return tooltip.addText(text => text.setText(this.getTranslation(t)));
    }

    //#endregion

    //#region Translations

    @Register.dictionary("Translations", JeevesTranslations)
    public readonly translations: Dictionary;

    private getTranslation(t: JeevesTranslations): Translation { return new Translation(this.translations, t); }

    //#endregion

    //#region Close Door

    @Register.message("ClosedDoor")
    public readonly closedDoorMsg: Message;

    @EventHandler(EventBus.Players, "moveComplete")
    public moveComplete(player: Player) {
        if (!this.globalData[CheckboxOption.CloseDoor]) return;

        let tile = this.getTileBehindPlayer(player);
        if (tile && tile.doodad && this.isClosableDoor(tile.doodad))
            this.closeDoor(tile.doodad, player);
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
     * @param player Player who moved to close door
     */
    private closeDoor(door: Doodad, player: Player): void {
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
            .send(this.closedDoorMsg, door.getName(), player.name)
        );
    }

    //#endregion

    //#region Ground Container

    @Register.message("ToggleGroundContainer")
    public readonly toggleGroundContainerMsg: Message;

    @Bind.onDown(Registry<Jeeves>().get("bindableToggleGroundContainer"))
    public onToggleGroundContainer() {
        if (!this.globalData[CheckboxOption.ManageGroundContainer]) return false;

        let facingContainerItems = localPlayer.getFacingTile().doodad?.containedItems;
        if (facingContainerItems !== undefined) return false;

        let facingPoint = localPlayer.getFacingPoint()
        let tileContainer = itemManager.getTileContainer(facingPoint.x, facingPoint.y, facingPoint.z);
        if (tileContainer.containedItems.length == 0) return false;

        if (oldui.isContainerOpen(tileContainer)) {
            oldui.closeContainer(tileContainer);
            localPlayer.messages.type(MessageType.None).send(this.toggleGroundContainerMsg, 'hidden');
        } else {
            oldui.openContainer(tileContainer);
            localPlayer.messages.type(MessageType.None).send(this.toggleGroundContainerMsg, 'shown');
        }

        return true;
    }

    //#endregion

}

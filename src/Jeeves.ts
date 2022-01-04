import { IGlobalData, JeevesTranslations, CheckboxOption } from "./IJeeves";
import Mod from "mod/Mod";
import Register, { Registry } from "mod/ModRegistry";
import { EventBus } from "event/EventBuses";
import { EventHandler } from "event/EventManager";
import { RenderSource } from "renderer/IRenderer";
import Doodad from "game/doodad/Doodad";
import { DoodadType } from "game/doodad/IDoodad";
import Player from "game/entity/player/Player";
import { MessageType, Source } from "game/entity/player/IMessageManager";
import { ITile, ITileContainer } from "game/tile/ITerrain";
import Item from "game/item/Item";
import ItemManager from "game/item/ItemManager";
import { IContainer } from "game/item/IItem";
import Island from "game/island/Island";
import Translation from "language/Translation";
import Message from "language/dictionary/Message";
import MessageManager from "game/entity/player/MessageManager";
import Component from "ui/component/Component";
import { CheckButton } from "ui/component/CheckButton";
import Bindable from "ui/input/Bindable";
import { IInput } from "ui/input/IInput";
import GameScreen from "ui/screen/screens/GameScreen";
import Bind from "ui/input/Bind";
import Dictionary from "language/Dictionary";
import Vector2 from "utilities/math/Vector2";
import Vector3 from "utilities/math/Vector3";
import { Direction } from "utilities/math/Direction";

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
            this.createCheckButton(
                CheckboxOption.ManageGroundContainer,
                JeevesTranslations.ManageGroundContainer,
                JeevesTranslations.ManageGroundContainerTooltip
            ).element
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

        let tile = this.getBehindTile(player);
        if (tile?.doodad && this.isClosableDoor(tile.doodad))
            this.closeDoor(tile.doodad, player);
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

        game.updateView(RenderSource.Mod, false, true);

        MessageManager.toAll(message => message
            .source(Source.Action)
            .type(MessageType.None)
            .send(this.closedDoorMsg, door.getName(), player.name)
        );
    }

    //#endregion

    //#region Ground Container

    @Bind.onDown(Registry<Jeeves>().get("bindableToggleGroundContainer"))
    public onToggleGroundContainer(): boolean {
        if (!this.globalData[CheckboxOption.ManageGroundContainer]) return false;

        let tileContainer = <ITileContainer>localPlayer.getFacingTile();
        if (!tileContainer?.containedItems) return false;

        let isOpen = oldui.isContainerOpen(tileContainer);
        if (isOpen) { oldui.closeContainer(tileContainer); }
        else { oldui.openContainer(tileContainer, `${Direction[localPlayer.facingDirection]} Tile`); }

        return true;
    }

    @EventHandler(EventBus.ItemManager, "containerItemUpdate")
    public itemMoved(host: ItemManager, item: Item, containerFrom: IContainer | undefined, containerFromPosition: Vector3 | undefined, containerTo: IContainer): void {
        if (!this.globalData[CheckboxOption.ManageGroundContainer]) return;

        // Container no longer exists, close the ui
        if (!containerFrom && containerFromPosition) {
            let tileContainer = <ITileContainer>item.island?.getTileFromPoint(containerFromPosition);
            if (tileContainer && oldui.isContainerOpen(tileContainer))
                oldui.closeContainer(tileContainer);
        }

        if (!containerFrom || (<ITileContainer>containerFrom).x || (<ITileContainer>containerTo).x)
            game.updateView(RenderSource.Mod, false, true);
    }

    //#endregion

    private getIsland(player: Player): Island | undefined {
        return game.islands.active.find(i => i.players.has(player));
    }

    /**
     * Get the tile behind the player
     * @param player Player
     * @returns Tile behind the player
     */
    private getBehindTile(player: Player): ITile | undefined {
        let vector = Vector2.DIRECTIONS[player.facingDirection];
        return this.getIsland(player)?.getTile(
            player.fromX - vector.x,
            player.fromY - vector.y,
            player.z
        );
    }

}

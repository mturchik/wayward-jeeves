import { IGlobalData, JeevesTranslations, CheckboxOption } from "./Models";
import Mod from "mod/Mod";
import Register, { Registry } from "mod/ModRegistry";
import { EventBus } from "event/EventBuses";
import { EventHandler } from "event/EventManager";
import { RenderSource } from "renderer/IRenderer";
import Doodad from "game/doodad/Doodad";
import { DoodadType } from "game/doodad/IDoodad";
import Player from "game/entity/player/Player";
import { ActionType } from "game/entity/action/IAction";
import { ITile, ITileContainer, TerrainType } from "game/tile/ITerrain";
import Item from "game/item/Item";
import ItemManager from "game/item/ItemManager";
import { IContainer } from "game/item/IItem";
import Island from "game/island/Island";
import Translation from "language/Translation";
import Message from "language/dictionary/Message";
import MessageManager from "game/entity/player/MessageManager";
import { MessageType, Source } from "game/entity/player/IMessageManager";
import Component from "ui/component/Component";
import { CheckButton } from "ui/component/CheckButton";
import Bindable from "ui/input/Bindable";
import { IInput } from "ui/input/IInput";
import Bind from "ui/input/Bind";
import Dictionary from "language/Dictionary";
import Vector2 from "utilities/math/Vector2";
import Vector3 from "utilities/math/Vector3";
import { Direction } from "utilities/math/Direction";
import TileHelpers from "utilities/game/TileHelpers";

export default class Jeeves extends Mod {
    @Mod.instance<Jeeves>("Jeeves") public static readonly INSTANCE: Jeeves;

    @Mod.globalData<Jeeves>() public globalData: IGlobalData;

    @Register.message("Init") public readonly initMsg: Message;
    @Register.message("CloseDoor") public readonly closeDoorMsg: Message;
    @Register.message("AutoPaddle") public readonly autoPaddleMsg: Message;

    @EventHandler(EventBus.Game, "play")
    public onPlay(): void { localPlayer.messages.type(MessageType.Good).send(this.initMsg, modManager.getVersion(this.getIndex())); }

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
            ).element,
            this.createCheckButton(
                CheckboxOption.AutoPaddle,
                JeevesTranslations.AutoPaddle,
                JeevesTranslations.AutoPaddleTooltip
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

    @EventHandler(EventBus.Players, "moveComplete")
    public toggleDoorOnMoveComplete(player: Player): void {
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
            .send(this.closeDoorMsg, door.getName(), player.name)
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
    public onContainerItemUpdate(host: ItemManager, item: Item, containerFrom: IContainer | undefined, containerFromPosition: Vector3 | undefined, containerTo: IContainer): void {
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

    //#region Auto Paddle

    @EventHandler(EventBus.Players, "preMove")
    public autoPaddleOnMoveComplete(player: Player, fromX: number, fromY: number, fromZ: number, fromTile: ITile, toX: number, toY: number, toZ: number, toTile: ITile): void {
        if (!this.globalData[CheckboxOption.AutoPaddle]) return;
        // Do nothing if player is already on a boat, already swimming, or not moving to a swimming position
        if (this.shouldNotAutoPaddle(player, toX, toY, toZ, toTile)) return;
        // Find the best boat in the player inventory, and give it a paddling
        let boat = player.island.items.getBestSafeItemInContainerByUse(player.inventory, ActionType.Paddle, true, true, false);
        if (boat) {
            player.messages.type(MessageType.None).send(this.autoPaddleMsg, boat.getName());
            player.island.items.moveToContainer(player, boat, player.inventory);
            player.setPaddling(boat, false);
        }
    }

    private shouldNotAutoPaddle(player: Player, toX: number, toY: number, toZ: number, toTile: ITile): boolean {
        return !!player.vehicleItemReference
            || player.isSwimming()
            || !this.isSwimmableTile(toTile)
            || !TileHelpers.isOpenTile(player.island, new Vector3(toX, toY, toZ), toTile);
    }

    private isSwimmableTile(tile: ITile): boolean {
        let tileTerrain = TileHelpers.getType(<ITile>tile);
        return [
            TerrainType.Seawater,
            TerrainType.DeepSeawater,
            TerrainType.FreshWater,
            TerrainType.DeepFreshWater,
            TerrainType.FreezingFreshWater,
            TerrainType.FreezingSeawater
        ].some(tt => tt === tileTerrain);
    }

    //#endregion

    //#region Misc Helper

    /** Get the island the player is on from the game manager. The Island on the player does not hold all tiles, at the time of this writing */
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

    //#endregion
}

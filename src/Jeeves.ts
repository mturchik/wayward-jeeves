import Doodad from "game/doodad/Doodad";
import MessageManager from "game/entity/player/MessageManager";
import Player from "game/entity/player/Player";
import Message from "language/dictionary/Message";
import Translation from "language/Translation";
import Mod from "mod/Mod";
import Register from "mod/ModRegistry";
import Component from "ui/component/Component";
import Bind from "ui/input/Bind";
import Bindable from "ui/input/Bindable";
import {
    MessageType, IInput, CheckButton, ITile, Direction, DoodadType, Source, RecipeComponent, ItemType,
    SkillType, RecipeLevel, ItemTypeGroup, Action, EntityType, TurnType, ActionType, Dictionary,
    EventBus, EventHandler, HookMethod, Quality, Registry, RenderSource, TileUpdateType
} from "./Barrel";
import { IGlobalData, CheckboxOption, JeevesTranslations, ISaveData } from "./IJeeves";

export default class Jeeves extends Mod {
    @Mod.instance<Jeeves>("Jeeves")
    public static readonly INSTANCE: Jeeves;

    @Mod.globalData<Jeeves>()
    public globalData: IGlobalData;

    @Mod.saveData<Jeeves>()
    public saveData: ISaveData;

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
    public optionSetup(section: Component): void {
        let closeDoorBtn = this.createCheckButton(JeevesTranslations.CloseDoor, JeevesTranslations.CloseDoorTooltip, CheckboxOption.CloseDoor);
        section.append(closeDoorBtn.element);

        let groundContainerBtn = this.createCheckButton(JeevesTranslations.ManageGroundContainer, JeevesTranslations.ManageGroundContainerTooltip, CheckboxOption.ManageGroundContainer);
        section.append(groundContainerBtn.element);
    }

    private createCheckButton(text: JeevesTranslations, tooltipText: JeevesTranslations, opt: CheckboxOption): CheckButton {
        return new CheckButton()
            .setText(() => this.getTranslation(text))
            .setTooltip(tooltip => tooltip.addText(text => text.setText(this.getTranslation(tooltipText))))
            .setRefreshMethod(() => !!this.globalData[opt])
            .event.subscribe("toggle", (_, checked) => this.globalData[opt] = checked);
    }

    //#endregion

    //#region Translations

    @Register.dictionary("Translations", JeevesTranslations)
    public readonly translations: Dictionary;

    public getTranslation(t: JeevesTranslations): Translation { return new Translation(this.translations, t); }

    //#endregion

    //#region Close Door

    @Register.message("ClosedDoor")
    public readonly closedDoorMsg: Message;

    @EventHandler(EventBus.Players, "moveComplete")
    public moveComplete(player: Player): void {
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
    private getTileBehindPlayer(player: Player): ITile {
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
        game.updateView(RenderSource.Mod, true);
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
    public onToggleGroundContainer(): boolean {
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

    @Register.item("ServantWhistle", {
        use: [Registry<Jeeves>().get("actionBlowWhistle")],
        recipe: {
            components: [
                RecipeComponent(ItemType.IronIngot, 7, 7, 7, false),
                RecipeComponent(ItemType.Sailboat, 1, 1, 0, true),
                RecipeComponent(ItemType.GoldCoins, 5, 5, 0, true),
                RecipeComponent(ItemType.GoldenSextant, 1, 1, 0, true),
            ],
            skill: SkillType.Bartering,
            level: RecipeLevel.Expert,
            reputation: 1000
        },
        // disassemble: true,
        durability: 1000,
        weight: 10,
        // worth: 2500,
        groups: [
            ItemTypeGroup.Tool,
            ItemTypeGroup.Treasure
        ],
        imagePath: "/static/image/item/servantwhistle"
    })
    public servantWhistle: ItemType;

    @Register.message("BlowWhistle")
    public readonly blowWhistleMsg: Message;

    @Register.action("BlowWhistle", new Action()
        .setUsableBy(EntityType.Player)
        .setPreExecutionHandler(action => {
            action.setDelay(30);
            action.setPassTurn(TurnType.Idle);
        })
        .setHandler(action => {
            action.executor.messages.type(MessageType.None).send(Jeeves.INSTANCE.blowWhistleMsg);
        }))
    public readonly actionBlowWhistle: ActionType;

    @Register.command("CreateWhistle")
    public command(_player: Player, _args: string) { _player.createItemInInventory([this.servantWhistle], Quality.None, true); }
}

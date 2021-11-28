import { ItemType } from "game/item/IItem";
import Item from "game/item/Item";

export enum JeevesTranslations {
    CloseDoor,
    CloseDoorTooltip,

    ManageGroundContainer,
    ManageGroundContainerTooltip,

    ServantName
}

export enum CheckboxOption {
    CloseDoor,
    ManageGroundContainer
}

export type IGlobalData = {
    [prop in CheckboxOption]: boolean;
} & {

};

export interface ISaveData {
    Bank: (Item | ItemType)[];
}

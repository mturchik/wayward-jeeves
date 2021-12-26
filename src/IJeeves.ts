export enum JeevesTranslations {
    CloseDoor,
    CloseDoorTooltip,

    ManageGroundContainer,
    ManageGroundContainerTooltip
}

export enum CheckboxOption {
    CloseDoor,
    ManageGroundContainer
}

export type IGlobalData = {
    [prop in CheckboxOption]: boolean;
} & {

};

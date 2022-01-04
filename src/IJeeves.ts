export enum JeevesTranslations {
    CloseDoor,
    CloseDoorTooltip,

    ManageGroundContainer,
    ManageGroundContainerTooltip,

    AutoPaddle,
    AutoPaddleTooltip
}

export enum CheckboxOption {
    CloseDoor,
    ManageGroundContainer,
    AutoPaddle
}

export type IGlobalData = {
    [prop in CheckboxOption]: boolean;
} & {

};

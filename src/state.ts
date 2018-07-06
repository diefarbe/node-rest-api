export type ChannelInfo = {
    upHoldLevel?: number;
    downHoldLevel?: number;
    upMaximumLevel?: number;
    downMinimumLevel?: number;
    upHoldDelay?: number;
    downHoldDelay?: number;
    upIncrement?: number;
    downDecrement?: number;
    upIncrementDelay?: number;
    downDecrementDelay?: number;
    startDelay?: number;
    effectId?: number;
}

export type StateInfo = {
    red: ChannelInfo,
    green: ChannelInfo,
    blue: ChannelInfo,
}

export type StateChangeRequest = {
    key: string,
    data: StateInfo;
}
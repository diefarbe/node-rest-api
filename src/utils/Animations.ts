import * as math from "mathjs";
import { IAnimation, IChannelAnimation, IChannelInfo, IStateInfo } from "../types";

export class Animations {
    public static signalAnimation(animation: IAnimation, value: number): IStateInfo {
        return {
            blue: Animations.signalAnimationHelper(animation.blue, value),
            green: Animations.signalAnimationHelper(animation.green, value),
            red: Animations.signalAnimationHelper(animation.red, value),
        };
    }

    public static solidColor(color: string): IAnimation {
        return {
            blue: {
                direction: "inc",
                upHoldLevel: parseInt(color.substr(4, 2), 16).toString(),
            },
            green: {
                direction: "inc",
                upHoldLevel: parseInt(color.substr(2, 2), 16).toString(),
            },
            red: {
                direction: "inc",
                upHoldLevel: parseInt(color.substr(0, 2), 16).toString(),
            },
        };
    }

    public static solidColorFlashing(color: string): IAnimation {
        return {
            blue: {
                direction: "incDec",
                downDecrement: "40",
                downHoldDelay: "20",
                downHoldLevel: "0",
                upHoldDelay: "20",
                upHoldLevel: parseInt(color.substr(4, 2), 16).toString(),
                upIncrement: "255",
            },
            green: {
                direction: "incDec",
                downDecrement: "40",
                downHoldDelay: "20",
                downHoldLevel: "0",
                upHoldDelay: "20",
                upHoldLevel: parseInt(color.substr(2, 2), 16).toString(),
                upIncrement: "255",
            },
            red: {
                direction: "incDec",
                downDecrement: "40",
                downHoldDelay: "20",
                downHoldLevel: "0",
                upHoldDelay: "20",
                upHoldLevel: parseInt(color.substr(0, 2), 16).toString(),
                upIncrement: "255",
            },

        };
    }

    private static signalAnimationHelper(channelAnimation: IChannelAnimation, value: number): IChannelInfo {
        const scope = {
            signal: value
        };
        return {
            downDecrement: channelAnimation.downDecrement === undefined ? undefined : math.eval(channelAnimation.downDecrement, scope),
            downDecrementDelay: channelAnimation.downDecrementDelay === undefined ? undefined : math.eval(channelAnimation.downDecrementDelay, scope),
            downHoldDelay: channelAnimation.downHoldDelay === undefined ? undefined : math.eval(channelAnimation.downHoldDelay, scope),
            downHoldLevel: channelAnimation.downHoldLevel === undefined ? undefined : math.eval(channelAnimation.downHoldLevel, scope),
            downMinimumLevel: channelAnimation.downMinimumLevel === undefined ? undefined : math.eval(channelAnimation.downMinimumLevel, scope),

            direction: channelAnimation.direction === undefined ? undefined : channelAnimation.direction,
            effectId: channelAnimation.effectId === undefined ? undefined : math.eval(channelAnimation.effectId, scope),

            upHoldDelay: channelAnimation.upHoldDelay === undefined ? undefined : math.eval(channelAnimation.upHoldDelay, scope),
            upHoldLevel: channelAnimation.upHoldLevel === undefined ? undefined : math.eval(channelAnimation.upHoldLevel, scope),
            upIncrement: channelAnimation.upIncrement === undefined ? undefined : math.eval(channelAnimation.upIncrement, scope),
            upIncrementDelay: channelAnimation.upIncrementDelay === undefined ? undefined : math.eval(channelAnimation.upIncrementDelay, scope),
            upMaximumLevel: channelAnimation.upMaximumLevel === undefined ? undefined : math.eval(channelAnimation.upMaximumLevel, scope),

            startDelay: channelAnimation.startDelay === undefined ? undefined : math.eval(channelAnimation.startDelay, scope),
            transition: channelAnimation.transition === undefined ? undefined : math.eval(channelAnimation.transition, scope),
        };
    }
}
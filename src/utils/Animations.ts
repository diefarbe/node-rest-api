import { ChannelAnimation, StateInfo, ChannelInfo, Animation } from "../types";
import * as math from "mathjs";

export class Animations {
    public static signalAnimation(animation: Animation, value: number): StateInfo {
        return {
            red: Animations.signalAnimationHelper(animation.red, value),
            green: Animations.signalAnimationHelper(animation.green, value),
            blue: Animations.signalAnimationHelper(animation.blue, value),
        };
    }

    private static signalAnimationHelper(channelAnimation: ChannelAnimation, value: number): ChannelInfo {
        const scope = {
            signal: value
        };
        return {
            upHoldLevel: channelAnimation.upHoldLevel === undefined ? undefined : math.eval(channelAnimation.upHoldLevel, scope),
            downHoldLevel: channelAnimation.downHoldLevel === undefined ? undefined : math.eval(channelAnimation.downHoldLevel, scope),
            upMaximumLevel: channelAnimation.upMaximumLevel === undefined ? undefined : math.eval(channelAnimation.upMaximumLevel, scope),
            downMinimumLevel: channelAnimation.downMinimumLevel === undefined ? undefined : math.eval(channelAnimation.downMinimumLevel, scope),
            upHoldDelay: channelAnimation.upHoldDelay === undefined ? undefined : math.eval(channelAnimation.upHoldDelay, scope),
            downHoldDelay: channelAnimation.downHoldDelay === undefined ? undefined : math.eval(channelAnimation.downHoldDelay, scope),
            upIncrement: channelAnimation.upIncrement === undefined ? undefined : math.eval(channelAnimation.upIncrement, scope),
            downDecrement: channelAnimation.downDecrement === undefined ? undefined : math.eval(channelAnimation.downDecrement, scope),
            upIncrementDelay: channelAnimation.upIncrementDelay === undefined ? undefined : math.eval(channelAnimation.upIncrementDelay, scope),
            downDecrementDelay: channelAnimation.downDecrementDelay === undefined ? undefined : math.eval(channelAnimation.downDecrementDelay, scope),
            startDelay: channelAnimation.startDelay === undefined ? undefined : math.eval(channelAnimation.startDelay, scope),
            effectId: channelAnimation.effectId === undefined ? undefined : math.eval(channelAnimation.effectId, scope),
            direction: channelAnimation.direction === undefined ? undefined : math.eval(channelAnimation.direction, scope),
            transition: channelAnimation.transition === undefined ? undefined : math.eval(channelAnimation.transition, scope),
        };
    }

    public static solidColor(color: string): Animation {
        return {
            red: {
                upHoldLevel: parseInt(color.substr(0, 2), 16).toString(),
                direction: '"inc"'
            },
            green: {
                upHoldLevel: parseInt(color.substr(2, 2), 16).toString(),
                direction: '"inc"'
            },
            blue: {
                upHoldLevel: parseInt(color.substr(4, 2), 16).toString(),
                direction: '"inc"'
            }
        };
    }

    public static solidColorFlashing(color: string): Animation {
        return {
            red: {
                upHoldLevel: parseInt(color.substr(0, 2), 16).toString(),
                downHoldLevel: "0",
                direction: '"incDec"',
                upIncrement: "255",
                downDecrement: "40",
                upHoldDelay: "20",
                downHoldDelay: "20"
            },
            green: {
                upHoldLevel: parseInt(color.substr(2, 2), 16).toString(),
                downHoldLevel: "0",
                direction: '"incDec"',
                upIncrement: "255",
                downDecrement: "40",
                upHoldDelay: "20",
                downHoldDelay: "20"
            },
            blue: {
                upHoldLevel: parseInt(color.substr(4, 2), 16).toString(),
                downHoldLevel: "0",
                direction: '"incDec"',
                upIncrement: "255",
                downDecrement: "40",
                upHoldDelay: "20",
                downHoldDelay: "20"
            }
        };
    }
}
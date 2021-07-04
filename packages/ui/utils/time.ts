import Wei from "@synthetixio/wei";
import { Balance } from "../queries/streamswap";

export const TimePeriod = {
    sec: 1,
    min: 60,
    hour: 3600,
    day: 86400,
    week: 604800,
    month: 2629800, // 86400 * 365.25 / 12
    year: 31536000
};

export function currentBalance(balance: Balance, curTime: Date) {
    return new Wei(curTime.getTime() / 1000 - balance.lastAction).mul(balance.netFlow).add(balance.balance);
}